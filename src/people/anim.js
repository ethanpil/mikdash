// Animation atlas: every clip of every rig in use is baked (once, lazily) into ONE half-float RGBA texture of
// skinning matrices. Each frame = one texel row segment of MAX_BONES*3 texels (3 rows of a 3x4 matrix per
// bone). Frames are stacked in blocks of 1024 rows side by side, so the texture never exceeds 1024 rows
// (WebGL2 guarantees only 2048) and the vertex shader addresses a frame with two integer ops.
// A Float32 master copy is kept for CPU reads (hand anchors for torches, etc.).
import { DataTexture, RGBAFormat, HalfFloatType, NearestFilter, DataUtils, Matrix4, Vector3 } from 'three';
import { MAX_BONES, getRig } from './rig.js';
import { PoseBuilder, LocalPose, poseToSkin, blendPose } from './pose.js';
import { HUMAN_CLIPS } from './clips.js';
import { QUAD_CLIPS, BIRD_CLIPS } from './animal-clips.js';

export const BLOCK_ROWS = 1024;
export const BLOCK_W = MAX_BONES * 3;
const FLOATS_PER_FRAME = MAX_BONES * 12;
const LOCAL_STRIDE = MAX_BONES * 7;   // quaternion xyzw + offset xyz per bone
export const SCRATCH = 64;            // dynamic frames for cross-fades (blended on the CPU in local space)

export function clipSetFor(rig) {
  return rig.kind === 'human' ? HUMAN_CLIPS : rig.kind === 'quad' ? QUAD_CLIPS : BIRD_CLIPS;
}

export class AnimAtlas {
  constructor() {
    this.frames = 0;
    this.master = new Float32Array(0);
    this.entries = new Map(); // rigKey -> { rig, clips: { name: { start, frames, loop, rate, stride, grip, hand } } }
    this.uniform = { value: null };
    this.texture = null;
    this.locals = new Float32Array(0);
    this.data = null;
    this.width = 0;
    this.scratchFree = [];
    this.epoch = 0;
    this._lpA = null; this._lpB = null;
  }

  /** bake a rig's clip set (once) and return its entry */
  ensure(rigKey) {
    if (this.entries.has(rigKey)) return this.entries.get(rigKey);
    const rig = getRig(rigKey);
    const set = clipSetFor(rig);
    const names = Object.keys(set);
    const total = names.reduce((s, n) => s + set[n].frames, 0);
    const start0 = this.frames;
    const grown = new Float32Array((this.frames + total + SCRATCH) * FLOATS_PER_FRAME);
    grown.set(this.master.subarray(0, this.frames * FLOATS_PER_FRAME));
    const locals = new Float32Array((this.frames + total) * LOCAL_STRIDE);
    locals.set(this.locals.subarray(0, this.frames * LOCAL_STRIDE));
    const P = new PoseBuilder(rig);
    const clips = {};
    let f = start0;
    for (const name of names) {
      const c = set[name];
      clips[name] = {
        name, start: f, frames: c.frames, loop: !!c.loop, rate: c.rate ?? 0.2,
        stride: typeof c.stride === 'string' ? rig.dims[c.stride] : (c.stride || 0),
        grip: c.grip || 'fist', hand: c.hand || null,
      };
      for (let i = 0; i < c.frames; i++) {
        const ph = c.loop ? i / c.frames : i / (c.frames - 1);
        P.reset();
        try { c.fn(P, rig, ph); } catch (e) {
          if (!this._warned) { console.error(`[people] clip ${name} failed on ${rigKey}`, e); this._warned = true; }
          P.reset();
        }
        poseToSkin(rig, P.lp, grown, f * FLOATS_PER_FRAME);
        const lo = f * LOCAL_STRIDE;
        locals.set(P.lp.q, lo);
        locals.set(P.lp.t, lo + MAX_BONES * 4);
        f++;
      }
    }
    this.master = grown;
    this.locals = locals;
    this.frames = f;
    const entry = { key: rigKey, rig, clips };
    this.entries.set(rigKey, entry);
    // scratch frames sit after the last baked frame: re-issue them (holders notice the new epoch)
    this.scratchFree = Array.from({ length: SCRATCH }, (_, i) => this.frames + i);
    this.epoch++;
    this._upload();
    return entry;
  }

  _upload() {
    const rows = this.frames + SCRATCH;
    const blocks = Math.max(1, Math.ceil(rows / BLOCK_ROWS));
    const width = blocks * BLOCK_W;
    const height = Math.min(BLOCK_ROWS, Math.max(16, Math.ceil(rows / 16) * 16));
    const data = new Uint16Array(width * height * 4);
    const toH = DataUtils.toHalfFloat;
    for (let F = 0; F < this.frames; F++) {
      const bx = F >> 10, y = F & (BLOCK_ROWS - 1);
      const src = F * FLOATS_PER_FRAME;
      let dst = (y * width + bx * BLOCK_W) * 4;
      for (let i = 0; i < FLOATS_PER_FRAME; i++) data[dst++] = toH(this.master[src + i]);
    }
    const tex = new DataTexture(data, width, height, RGBAFormat, HalfFloatType);
    tex.minFilter = tex.magFilter = NearestFilter;
    tex.generateMipmaps = false;
    tex.flipY = false;
    tex.needsUpdate = true;
    tex.name = 'people-anim';
    // until the first full upload, partial updateRanges would upload ONLY those rows (three uses
    // texStorage + texSubImage per range) — so ranges are added only after onUpdate fired once
    this._fresh = true;
    tex.onUpdate = () => { this._fresh = false; };
    this.texture?.dispose();
    this.texture = tex;
    this.data = data;
    this.width = width;
    this.uniform.value = tex;
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
    const bx = F >> 10, y = F & (BLOCK_ROWS - 1);
    const start = (y * this.width + bx * BLOCK_W) * 4;
    const toH = DataUtils.toHalfFloat;
    for (let i = 0; i < FLOATS_PER_FRAME; i++) this.data[start + i] = toH(this.master[off + i]);
    if (!this._fresh) this.texture.addUpdateRange(start, FLOATS_PER_FRAME);
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
