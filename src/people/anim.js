// Animation atlas: every clip of every rig in use is baked (once, lazily) into ONE half-float RGBA texture of
// skinning matrices. Each frame = one texel row segment of MAX_BONES*3 texels (3 rows of a 3x4 matrix per
// bone). Frames are stacked in blocks of 1024 rows side by side, so the texture never exceeds 1024 rows
// (WebGL2 guarantees only 2048) and the vertex shader addresses a frame with two integer ops.
// A Float32 master copy is kept for CPU reads (hand anchors for torches, etc.).
// qa-r2: the half floats are kept and only a new rig's frames are encoded (by the bake, in the worker when prebaked);
// a wider texture re-lays the rows already encoded by copying them. Before, every ensure() re-encoded every frame baked
// so far and allocated a new buffer (quadratic in rigs: ≈ 1.25 s of the low boot at 8 rigs / 8.6k frames).
import { DataTexture, RGBAFormat, HalfFloatType, NearestFilter, DataUtils, Matrix4, Vector3 } from 'three';
import { MAX_BONES, getRig } from './rig.js';
import { PoseBuilder, LocalPose, poseToSkin, blendPose } from './pose.js';
import { HUMAN_CLIPS, SERVICE_CLIPS, SERVICE_RIGS, SERVICE_ANY } from './clips.js';
import { QUAD_CLIPS, BIRD_CLIPS } from './animal-clips.js';
import { clothCage, clothSkin } from './cloth.js';
import { takePrebaked } from './prebake.js';

export const BLOCK_ROWS = 1024;
export const BLOCK_W = MAX_BONES * 3;
const FLOATS_PER_FRAME = MAX_BONES * 12;
const LOCAL_STRIDE = MAX_BONES * 7;   // quaternion xyzw + offset xyz per bone
export const SCRATCH = 64;            // dynamic frames for cross-fades (blended on the CPU in local space)

export function clipSetFor(rig) {
  return rig.kind === 'human' ? HUMAN_CLIPS : rig.kind === 'quad' ? QUAD_CLIPS : BIRD_CLIPS;
}

let _bakeWarned = false;
/**
 * Bake a rig's clip set: { frames, clips: [{ name, start (from 0), frames, loop, rate, stride, grip, hand, halter, cord,
 * pairGrip }], master: Float32Array (skinning rows per frame), locals: Float32Array (local pose per frame) }. A pure
 * function of the rig and the clip code — runs on the main thread or in people/bake.worker.js (perf-1).
 */
export function bakeRig(rigKey) {
  const rig = getRig(rigKey);
  const set = clipSetFor(rig);
  // the temple-service clips (people-3) only for the men's rigs that serve; women, boys and children skip them
  // (≈ 0.5k frames each) — a missing pose falls back to 'stand' with a warning, as any unknown pose does
  const skip = (n) => rig.kind === 'human' && !SERVICE_RIGS.has(rigKey) && SERVICE_CLIPS[n] && !SERVICE_ANY.has(n);
  const names = Object.keys(set).filter((n) => !skip(n));
  const total = names.reduce((s, n) => s + set[n].frames, 0);
  const master = new Float32Array(total * FLOATS_PER_FRAME);
  const locals = new Float32Array(total * LOCAL_STRIDE);
  const P = new PoseBuilder(rig);
  const clips = [];
  let f = 0;
  for (const name of names) {
    const c = set[name];
    clips.push({
      name, base: name.split('~')[0], start: f, frames: c.frames, loop: !!c.loop, rate: c.rate ?? 0.2,
      stride: typeof c.stride === 'string' ? rig.dims[c.stride] : (c.stride || 0),
      grip: c.grip || 'fist', hand: c.hand || null, halter: !!c.halter, cord: !!c.cord, pairGrip: c.pairGrip || null,
    });
    for (let i = 0; i < c.frames; i++) {
      const ph = c.loop ? i / c.frames : i / (c.frames - 1);
      P.reset();
      try { c.fn(P, rig, ph); if (rig.kind === 'human') clothCage(P, rig); } catch (e) {
        if (!_bakeWarned) { console.error(`[people] clip ${name} failed on ${rigKey}`, e); _bakeWarned = true; }
        P.reset();
      }
      poseToSkin(rig, P.lp, master, f * FLOATS_PER_FRAME);
      if (rig.kind === 'human') clothSkin(rig, master, f * FLOATS_PER_FRAME);
      const lo = f * LOCAL_STRIDE;
      locals.set(P.lp.q, lo);
      locals.set(P.lp.t, lo + MAX_BONES * 4);
      f++;
    }
  }
  // the GPU copy's half floats, frame after frame (the atlas copies each frame's row segment into its block)
  const half = new Uint16Array(master.length);
  const toH = DataUtils.toHalfFloat;
  for (let i = 0; i < master.length; i++) half[i] = toH(master[i]);
  return { key: rigKey, frames: f, clips, master, locals, half };
}

export class AnimAtlas {
  constructor() {
    this.frames = 0;
    this.master = new Float32Array(0);   // (capacity grows geometrically: ≥ (frames + SCRATCH) frames)
    this.entries = new Map(); // rigKey -> { rig, clips: { name: { start, frames, loop, rate, stride, grip, hand } } }
    this.uniform = { value: null };
    this.texture = null;
    this.locals = new Float32Array(0);
    this.data = null;                    // the texture's half floats: width × BLOCK_ROWS texels, row-major
    this.width = 0;
    this.blocks = 0;
    this.scratchFree = [];
    this.epoch = 0;
    this._lpA = null; this._lpB = null;
    this._full = false;                  // a whole-texture upload is pending (no partial ranges until it is done)
    this.stats = { ensureMs: 0, uploads: 0, rigs: [] };
  }

  /** bake a rig's clip set (once) and return its entry */
  ensure(rigKey) {
    if (this.entries.has(rigKey)) return this.entries.get(rigKey);
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const rig = getRig(rigKey);
    // perf-1: baked ahead in a Worker at boot (people/prebake.js) when it got there first; the same bakeRig() either way
    const baked = takePrebaked(rigKey) || bakeRig(rigKey);
    const start0 = this.frames, end = start0 + baked.frames;
    this._reserve(end + SCRATCH);
    this.master.set(baked.master, start0 * FLOATS_PER_FRAME);
    this.master.fill(0, end * FLOATS_PER_FRAME, (end + SCRATCH) * FLOATS_PER_FRAME);
    this.locals.set(baked.locals, start0 * LOCAL_STRIDE);
    const clips = {};
    for (const c of baked.clips) clips[c.name] = { ...c, start: c.start + start0 };
    this.frames = end;
    const entry = { key: rigKey, rig, clips };
    this.entries.set(rigKey, entry);
    // scratch frames sit after the last baked frame: re-issue them (holders notice the new epoch)
    this.scratchFree = Array.from({ length: SCRATCH }, (_, i) => this.frames + i);
    this.epoch++;
    this._encode(start0, baked.half);
    const ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
    this.stats.ensureMs += ms;
    this.stats.rigs.push([rigKey, baked.frames, Math.round(ms)]);
    return entry;
  }

  /** grow the CPU buffers to hold `frames` frames (keeping their contents) */
  _reserve(frames) {
    if (this.master.length >= frames * FLOATS_PER_FRAME) return;
    const cap = Math.max(frames, Math.ceil(this.master.length / FLOATS_PER_FRAME * 1.5));
    const m = new Float32Array(cap * FLOATS_PER_FRAME);
    m.set(this.master);
    const l = new Float32Array(cap * LOCAL_STRIDE);
    l.set(this.locals);
    this.master = m;
    this.locals = l;
  }

  /**
   * Copy the new frames' half floats (from frame f0) into their blocks and schedule the upload. A texture with more
   * blocks re-lays the rows already there (a row copy, nothing re-encoded) and is created anew; otherwise the whole
   * texture is re-uploaded once at the next render, whatever number of rigs arrived before it (the boot ensures every
   * pooled rig before its first frame). Creating a DataTexture is CPU-only: three allocates and uploads at first use.
   */
  _encode(f0, half) {
    const blocks = Math.max(1, Math.ceil((this.frames + SCRATCH) / BLOCK_ROWS));
    const grow = blocks > this.blocks;
    if (grow) {
      const width = blocks * BLOCK_W;
      const data = new Uint16Array(width * BLOCK_ROWS * 4);
      if (this.data) {
        const ow = this.width * 4;
        for (let y = 0; y < BLOCK_ROWS; y++) data.set(this.data.subarray(y * ow, (y + 1) * ow), y * width * 4);
      }
      this.data = data;
      this.width = width;
      this.blocks = blocks;
    }
    const n = half.length / FLOATS_PER_FRAME;
    for (let i = 0; i < n; i++) {
      const F = f0 + i, bx = F >> 10, y = F & (BLOCK_ROWS - 1);
      this.data.set(half.subarray(i * FLOATS_PER_FRAME, (i + 1) * FLOATS_PER_FRAME), (y * this.width + bx * BLOCK_W) * 4);
    }
    if (grow || !this.texture) {
      const tex = new DataTexture(this.data, this.width, BLOCK_ROWS, RGBAFormat, HalfFloatType);
      tex.minFilter = tex.magFilter = NearestFilter;
      tex.generateMipmaps = false;
      tex.flipY = false;
      tex.name = 'people-anim';
      tex.onUpdate = () => { this._full = false; this.stats.uploads++; };
      this.texture?.dispose();
      this.texture = tex;
      this.uniform.value = tex;
    }
    // until a whole upload is done, partial updateRanges would upload ONLY those rows (three uses texStorage +
    // texSubImage per range, height 1) — so writeScratch adds ranges only once onUpdate fired
    this.texture.clearUpdateRanges();
    this.texture.needsUpdate = true;
    this._full = true;
  }

  // ---- cross-fade scratch frames
  allocScratch() { return this.scratchFree.length ? this.scratchFree.pop() : -1; }
  freeScratch(f) { if (f >= this.frames && f < this.frames + SCRATCH && !this.scratchFree.includes(f)) this.scratchFree.push(f); }

  /** local pose of a clip at a phase (slerp between the two sampled frames) */
  localAt(rig, clip, phase, out) {
    const fr = this.sample(clip, phase, _fr);
    const A = this._lp(0, rig), B = this._lp(1, rig);
    this._readLocal(fr[0], A);
    this._readLocal(fr[1], B);
    return blendPose(out, A, B, fr[2]);
  }
  _lp(i, rig) {
    const k = i ? '_lpB' : '_lpA';
    if (!this[k] || this[k].n !== rig.n) this[k] = new LocalPose(rig.n);
    return this[k];
  }
  _readLocal(F, lp) {
    const o = F * LOCAL_STRIDE;
    lp.q.set(this.locals.subarray(o, o + lp.n * 4));
    lp.t.set(this.locals.subarray(o + MAX_BONES * 4, o + MAX_BONES * 4 + lp.n * 3));
  }
  /** write a blended local pose into scratch frame F (CPU master + GPU row upload) */
  writeScratch(F, rig, lp) {
    const off = F * FLOATS_PER_FRAME;
    this.master.fill(0, off, off + FLOATS_PER_FRAME);
    poseToSkin(rig, lp, this.master, off);
    if (rig.kind === 'human') clothSkin(rig, this.master, off);
    const bx = F >> 10, y = F & (BLOCK_ROWS - 1);
    const start = (y * this.width + bx * BLOCK_W) * 4;
    const toH = DataUtils.toHalfFloat;
    for (let i = 0; i < FLOATS_PER_FRAME; i++) this.data[start + i] = toH(this.master[off + i]);
    if (!this._full) this.texture.addUpdateRange(start, FLOATS_PER_FRAME);
    this.texture.needsUpdate = true;
  }

  /**
   * phase → absolute frame pair + blend. Loop clips wrap; one-shots clamp.
   * Returns into `out` [f0, f1, frac].
   */
  sample(clip, phase, out) {
    const n = clip.frames;
    if (clip.loop) {
      let p = phase - Math.floor(phase);
      const x = p * n;
      const i = Math.floor(x) % n;
      out[0] = clip.start + i;
      out[1] = clip.start + ((i + 1) % n);
      out[2] = x - Math.floor(x);
    } else {
      const p = Math.min(1, Math.max(0, phase));
      const x = p * (n - 1);
      const i = Math.min(n - 2, Math.floor(x));
      out[0] = clip.start + i;
      out[1] = clip.start + i + 1;
      out[2] = x - i;
    }
    return out;
  }

  /** CPU: world (model-space) matrix of a bone at a sampled frame pair */
  boneMatrix(rig, f0, f1, frac, bone, out = new Matrix4()) {
    const a = f0 * FLOATS_PER_FRAME + bone * 12, b = f1 * FLOATS_PER_FRAME + bone * 12;
    const m = this.master, e = out.elements;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const v = m[a + r * 4 + c] + (m[b + r * 4 + c] - m[a + r * 4 + c]) * frac;
        e[c * 4 + r] = v;
      }
    }
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    // skin × T(rest) = bone world
    const rp = rig.rest[bone];
    _v.set(rp.x, rp.y, rp.z).applyMatrix4(out);
    e[12] = _v.x; e[13] = _v.y; e[14] = _v.z;
    return out;
  }
}
const _v = new Vector3();
const _fr = [0, 0, 0];
