// The live Web Audio graph: master bus, space reverbs, spatial voices, loop virtualisation, voice budget.
//
//   voice:  src ─ g(level·gain·fade) ─┬─ air(lowpass: distance + occlusion) ─ d(occlusion) ─ panner ─ dry ─┐
//                                     └─ send (critical-distance model) ─────────────────── revIn ─ conv ─┤
//   bed:    src ─ g ─ bedIn ─ bedFilter (indoors: muffled) ─ bedOut ──────────────────────────────────────┤
//   mix ─ glue compressor ─ limiter ─ master (user volume) ─ destination  ◀────────────────────────────────┘
import { Vector3, Quaternion } from 'three';
import { m2w, w2m } from '../core/units.js';
import { zoneAtSite } from '../data/site.js';
import { Renderer } from './renderer.js';
import { CUE_LIB, LOOP_LIB, CUE_ALIAS, VOICE_LIMIT, SYNTH_RATE, CHOIR_RATE, IR_MAX, CACHE_MB, OCCLUSION_RAYS, ROLLOFF, splToGainDb } from './library.js';
import { spaceForZone, CAPTIONS } from './synth/meta.js';
import { sectionLyrics, sectionTiming } from './timeline.js';

const dbToGain = (d) => Math.pow(10, d / 20);
// acoustic coupling per space: critical distance r_c (m) where direct = reverberant, and how fast the
// reverberant level falls with distance beyond it (0 = diffuse enclosed room, 1 = open air)
const SPACE_ACOUSTICS = {
  open: { rc: 40, alpha: 1, enclosed: false }, mount: { rc: 18, alpha: 0.75, enclosed: false }, stoa: { rc: 7, alpha: 0.4, enclosed: false },
  court: { rc: 14, alpha: 0.5, enclosed: false }, hall: { rc: 3, alpha: 0, enclosed: true }, chamber: { rc: 1.6, alpha: 0, enclosed: true },
  heichal: { rc: 2, alpha: 0, enclosed: true }, tight: { rc: 1.3, alpha: 0, enclosed: true },
};
// outdoor beds (wind, insects, doves) heard from each space: gain and lowpass cutoff
const BED_BY_SPACE = {
  open: [1, 20000], mount: [1, 20000], stoa: [0.75, 9000], court: [0.8, 14000], hall: [0.22, 1100], chamber: [0.16, 900],
  heichal: [0.1, 650], tight: [0.12, 700],
};
// How closed each space is to sound from outside it (walls, doors, roof). A source and listener in different
// spaces get at least this occlusion, combined from both sides — no ray needed, so it holds on the low tier,
// for area sources, and where colliders are missing. Walled courts open to the sky pass most of it.
const TRANSMISSION = { heichal: 0.9, chamber: 0.8, hall: 0.75, tight: 0.6, stoa: 0.3, court: 0.3, mount: 0, open: 0 };

const _v = new Vector3(), _f = new Vector3(), _u = new Vector3(), _q = new Quaternion(), _ray = new Vector3(), _a = new Vector3();
const perfNow = () => performance.now() / 1000;
const sameOpts = (a, b) => JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());

export class AudioEngine {
  constructor(ctx) {
    this.ctx = ctx;
    this.tier = ctx.quality?.key || 'medium';
    this.ac = null;
    this.state = 'locked';
    this.userVolume = 0.8;
    this.renderer = new Renderer({ tier: this.tier, budgetMB: CACHE_MB[this.tier] || 80 });
    this.voices = new Set();   // playing one-shots
    this.pending = new Set();  // one-shots scheduled for later (no voice slot yet)
    this.inflight = new Set(); // one-shots whose buffer is still rendering
    this.loops = new Set();    // loop handles (active or virtual)
    this.listener = new Vector3();
    this.space = null;
    this.reverbs = new Map();
    this.spaceTimer = 0; this.tickTimer = 0; this.rayCursor = 0;
    this.zoneId = null;
    this.warned = new Set();
    this.captionsOn = true;
    this.tracks = new Set();   // lyric caption tracks of sung sections (cues and loops)
    this.music = new Set();    // choir-psalm cues sounding or due ({ v, end (perf s) }) — a 'choir' loop continues after one
  }

  get running() { return this.ac?.state === 'running'; }
  get sr() { return this.ac?.sampleRate || 48000; }
  /** synthesis sample rate: fixed (48 kHz; 32 kHz on low) so buffers rendered before the AudioContext exists stay
   *  valid; AudioBufferSourceNode resamples. Only impulse responses must match the context rate. */
  get synthRate() { return SYNTH_RATE[this.tier] || 48000; }
  /** synthesis rate for a render id: the choir has its own (CHOIR_RATE) */
  rateFor(id) { return id === 'choir-psalm' || id === 'choir' ? CHOIR_RATE[this.tier] || this.synthRate : this.synthRate; }

  // ---------------------------------------------------------------- lifecycle
  async unlock() {
    if (!globalThis.AudioContext) return false;
    if (!this.ac) {
      try {
        this.ac = new AudioContext({ latencyHint: this.tier === 'low' || this.tier === 'medium' ? 'balanced' : 'interactive' });
      } catch (e) { this.warnOnce('ctx', `[audio] AudioContext unavailable: ${e.message}`); return false; }
      this.build();
      this.ac.onstatechange = () => { this.state = this.ac.state; this.ctx.bus?.emit('audio:state', { state: this.ac.state }); };
    }
    if (this.ac.state !== 'running' && !this.hidden) {
      try { await this.ac.resume(); } catch { /* needs a user gesture; the next one will retry */ }
    }
    this.state = this.ac.state;
    return this.ac.state === 'running';
  }

  build() {
    const ac = this.ac;
    this.mix = new GainNode(ac, { gain: 1 });
    this.glue = new DynamicsCompressorNode(ac, { threshold: -20, knee: 12, ratio: 2.5, attack: 0.012, release: 0.3 });
    this.limiter = new DynamicsCompressorNode(ac, { threshold: -3, knee: 0, ratio: 20, attack: 0.002, release: 0.12 });
    this.master = new GainNode(ac, { gain: this.userVolume });
    this.mix.connect(this.glue).connect(this.limiter).connect(this.master).connect(ac.destination);
    this.dry = new GainNode(ac, { gain: 1 });
    this.dry.connect(this.mix);
    this.revIn = new GainNode(ac, { gain: 1 });
    this.bedIn = new GainNode(ac, { gain: 1 });
    this.bedFilter = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 20000, Q: 0.5 });
    this.bedOut = new GainNode(ac, { gain: 1 });
    this.bedIn.connect(this.bedFilter).connect(this.bedOut).connect(this.mix);
    this.panningModel = this.tier === 'high' || this.tier === 'ultra' ? 'HRTF' : 'equalpower';
  }

  setVolume(v) {
    this.userVolume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.userVolume, this.ac.currentTime, 0.05);
  }

  setHidden(hidden) {
    this.hidden = hidden;
    if (!this.ac) return;
    if (hidden) this.ac.suspend().catch(() => {}); else if (this.state !== 'locked') this.ac.resume().catch(() => {});
    // a suspended context paused the sung loops while their verses' clock ran on: restart them at the right verse
    if (!hidden) for (const v of this.loops) if (v.anchor !== undefined && v.nodes) this.deactivate(v, 0.05);
  }

  setTier(key) {
    if (!key || key === this.tier) return;
    this.tier = key;
    this.renderer.budget = (CACHE_MB[key] || 80) * 1024 * 1024;
    this.renderer.retier(key, (id) => this.rateFor(id), IR_MAX[key] || 3.5);
    this.panningModel = key === 'high' || key === 'ultra' ? 'HRTF' : 'equalpower';
    // rebuild the current room at the new tier's impulse-response length
    if (this.ac && this.space) {
      const now = this.ac.currentTime, space = this.space;
      for (const o of this.reverbs.values()) {
        o.out.gain.setTargetAtTime(0, now, 0.1);
        setTimeout(() => {
          try { if (o.connected) this.revIn.disconnect(o.conv); } catch { /* ok */ }
          try { o.conv.disconnect(); o.out.disconnect(); } catch { /* ok */ }
        }, 600);
      }
      this.reverbs.clear();
      this.space = null;
      this.setSpace(space);
    }
  }

  warnOnce(k, msg) { if (!this.warned.has(k)) { this.warned.add(k); console.warn(msg); } }

  // ---------------------------------------------------------------- positions
  /** world Vector3 | {x,y,z} | [X, Y, Z] site amot → Vector3 (world m), or null for non-spatial */
  toWorld(p, target = new Vector3()) {
    if (!p) return null;
    if (Array.isArray(p)) return m2w(p[0], p[1], p[2] ?? 0, target);
    if (p.isObject3D) return p.getWorldPosition(target);
    if (Number.isFinite(p.x)) return target.set(p.x, p.y, p.z);
    return null;
  }

  /** area: { min: [X,Y,Z], max: [X,Y,Z] } or a list of such boxes (site amot) → [{ min, max }] world space */
  toArea(a) {
    if (!a) return null;
    const list = (Array.isArray(a) ? a : [a]).filter((b) => b?.min && b?.max).map((b) => {
      const p = m2w(b.min[0], b.min[1], b.min[2] ?? 0), q = m2w(b.max[0], b.max[1], b.max[2] ?? 0);
      return { min: new Vector3(Math.min(p.x, q.x), Math.min(p.y, q.y), Math.min(p.z, q.z)), max: new Vector3(Math.max(p.x, q.x), Math.max(p.y, q.y), Math.max(p.z, q.z)) };
    });
    return list.length ? list : null;
  }

  /** current source position for a voice (follows an Object3D, or the nearest point of its area's boxes) */
  sourcePos(v) {
    if (v.follow) return v.follow.getWorldPosition(v.pos || (v.pos = new Vector3()));
    if (v.area) {
      let best = Infinity;
      for (const b of v.area) {
        const d = _a.copy(this.listener).clamp(b.min, b.max).distanceToSquared(this.listener);
        if (d < best) { best = d; v.pos.copy(_a); }
      }
    }
    return v.pos;
  }

  /** occlusion floor between the listener's space and a source's space (see TRANSMISSION) */
  transmission(srcSpace) {
    const a = this.space, b = srcSpace;
    if (!a || !b || a === b) return 0;
    return 1 - (1 - (TRANSMISSION[a] ?? 0)) * (1 - (TRANSMISSION[b] ?? 0));
  }

  // ---------------------------------------------------------------- one-shots
  resolveId(id) { return CUE_LIB[id] ? id : CUE_ALIAS[id] || null; }

  synthOpts(def, opts, variant) {
    const o = {};
    for (const k of def.synth || []) if (opts[k] !== undefined) o[k] = opts[k];
    if (variant) o.v = variant;
    return o;
  }

  /** Estimated linear loudness at the listener (for priorities and culling). */
  estimate(v) {
    if (!v.spatial) return v.levelLin * v.userGain;
    const p = this.sourcePos(v);
    const d = p.distanceTo(this.listener);
    return v.levelLin * v.userGain * Math.min(1, Math.pow(Math.max(d, 0.01) / v.def.r0, -ROLLOFF)) * (1 - 0.6 * (v.occ || 0));
  }

  cue(rawId, pos, opts = {}) {
    const id = this.resolveId(rawId);
    if (!id) { this.warnOnce(`cue:${rawId}`, `[audio] unknown cue "${rawId}"`); return null; }
    const def = CUE_LIB[id];
    const variant = typeof opts.variant === 'number' ? opts.variant : this.pickVariant(id, def, opts);
    const sOpts = this.synthOpts(def, opts, variant);
    const v = {
      id, def, kind: 'cue', opts, sOpts, spatial: !!(pos || opts.area || opts.follow), userGain: opts.gain ?? 1,
      levelLin: dbToGain(splToGainDb(def.spl) + (opts.levelDb || 0) + peopleDb(def, opts.people)), pos: this.toWorld(pos), area: this.toArea(opts.area),
      follow: opts.follow || null, rate: opts.rate || 1, stopped: false, occ: 0, occT: 0, nodes: null,
    };
    if (v.area) v.pos = new Vector3();
    if (v.spatial && !v.pos) v.pos = new Vector3();
    v.space = v.spatial ? this.spaceAt(this.sourcePos(v)) : null;
    v.occ = v.floor = this.transmission(v.space);
    let endResolve;
    const ended = new Promise((r) => { endResolve = r; });
    v.endResolve = endResolve;
    const handle = {
      id, ended,
      stop: (fade = 0.15) => this.stopVoice(v, fade),
      setPosition: (p) => {
        if (!p) return;
        v.pos = this.toWorld(p, v.pos || new Vector3()); v.area = null; v.space = this.spaceAt(v.pos); v.floor = this.transmission(v.space);
        if (v.nodes?.pan) this.placePanner(v, 0.02);
      },
      setGain: (g, t = 0.1) => { v.userGain = g; this.applyGain(v, t); },
      get duration() { return v.buffer?.duration ?? v.secDur ?? null; },
    };
    v.handle = handle;
    const capKey = def.caption?.(opts);
    const wantCaption = capKey && opts.caption !== false && this.captionsOn;
    // a sung section: its verses are captioned as they are sung (after the heading), and its clock is known exactly
    // before it renders (timeline.js) — due at request + delay, from opts.offset
    const lyrics = def.lyrics && opts.caption !== false;
    const heading = opts.captionHeading !== false ? capKey : null;
    const offset0 = Math.max(0, +opts.offset || 0);
    if (def.lyrics) {
      const timing = sectionTiming(opts), due = perfNow() + (opts.delay || 0);
      v.timing = timing; v.secDur = timing.duration; v.offset0 = offset0;
      v.mentry = { v, sOpts, end: due + timing.duration - offset0 }; // a 'choir' loop of this section follows on
      this.music.add(v.mentry);
      // the verses run on the real clock from the moment they are due — the text is not held up by a slow render, and
      // shows with sound locked — and follow the section's own clock once it sounds (tickTracks)
      if (lyrics) this.startTrack(v, { t0: due, offset: offset0, heading });
    }
    if (!this.ac || this.ac.state !== 'running') {
      // no sound yet (locked / hidden): still show the subtitle so the moment is not lost
      if (!def.lyrics && wantCaption && this.audibleEnough(v)) this.caption(capKey, opts.captionDuration || 5, v);
      endResolve(false);
      return handle;
    }
    if (def.lyrics) { this.playSection(v); return handle; }
    const t0 = this.ac.currentTime;
    this.inflight.add(v); // a time jump must also cancel cues whose buffer is still rendering (§9)
    this.renderer.get('cue', id, sOpts, this.rateFor(id), { priority: 10 + def.priority }).then((buf) => {
      this.inflight.delete(v);
      if (v.stopped || !this.ac) { endResolve(false); return; }
      const late = this.ac.currentTime - t0, delay = opts.delay || 0;
      // a blast heard a few seconds late still means something, much later it would be a wrong moment (sung sections
      // join in progress instead: playSection)
      if (late > (opts.maxLatency ?? (def.cat === 'music' || def.cat === 'voice' ? 15 : 10))) { v.stopped = true; endResolve(false); return; }
      if (offset0 >= buf.duration - 0.5) { v.stopped = true; endResolve(false); return; }
      v.buffer = buf;
      // the start time is fixed on the audio clock now; a delayed cue claims its voice slot only just
      // before it sounds (scheduled sequences must not crowd out what is playing in between)
      const when = this.ac.currentTime + Math.max(0, delay - late);
      const go = () => {
        if (v.stopped || !this.ac) { endResolve(false); return; }
        if (!this.admit(v)) { v.stopped = true; endResolve(false); return; }
        this.startVoice(v, buf, Math.max(when, this.ac.currentTime), offset0, opts.fadeIn ?? 0.004);
        // subtitles only if the call is audible where the observer stands when it sounds
        if (!def.lyrics && wantCaption) setTimeout(() => { if (!v.stopped && this.audibleEnough(v)) this.caption(capKey, buf.duration, v); }, Math.max(0, (when - this.ac.currentTime) * 1000));
        if (id === 'magrefah') this.onMagrefah?.(v);
        if (id === 'crowd-prostrate') this.onProstrate?.(v);
      };
      const lead = (when - this.ac.currentTime - 0.15) * 1000;
      if (lead > 0) { v.pending = setTimeout(go, lead); this.pending.add(v); } else go();
    }).catch((e) => { this.inflight.delete(v); v.stopped = true; this.warnOnce(`render:${id}`, `[audio] render failed for ${id}: ${e.message}`); endResolve(false); });
    return handle;
  }

  /**
   * A random variant, but one already rendered when the drawn one is not (no seconds-long wait on a phone);
   * the drawn variant renders in the background for a later play.
   */
  pickVariant(id, def, opts) {
    const n = def.variants || 1, k = Math.floor(Math.random() * n), sr = this.rateFor(id);
    if (n < 2 || this.renderer.peek('cue', id, this.synthOpts(def, opts, k), sr)) return k;
    for (let j = 0; j < n; j++) {
      if (!this.renderer.peek('cue', id, this.synthOpts(def, opts, j), sr)) continue;
      this.renderer.get('cue', id, this.synthOpts(def, opts, k), sr, { priority: 1 });
      return j;
    }
    return k;
  }

  /** subtitles only for calls the observer could actually make out (≈ -48 dBFS or louder) */
  audibleEnough(v) { return !v.spatial || this.estimate(v) > dbToGain(-32); }

  /** key: a CAPTIONS id, or a ready { en, he } text (the psalm of the day) */
  caption(key, duration, v) {
    const text = typeof key === 'string' ? CAPTIONS[key] : key;
    if (!text) return;
    this.ctx.bus?.emit('caption', { id: typeof key === 'string' ? key : v?.id, text, duration: Math.max(2.5, Math.min(12, duration || 4)), pos: v?.pos?.clone?.() || null });
  }

  /**
   * A lyric caption track: the section's verses shown as they are sung. t0: real seconds (performance clock) when
   * the section is at `offset`; a one-shot that is sounding follows its buffer's playhead on the AudioContext clock
   * instead (exact; holds through a suspended context). period: a loop's length (the verses come round again).
   */
  startTrack(v, { t0, offset = 0, period = 0, heading = null }) {
    const lines = sectionLyrics(v.opts);
    if (!lines.length) return null;
    const tr = { v, lines, t0, offset, period, heading, i: 0, last: -1 };
    this.tracks.add(tr);
    return tr;
  }

  /** per frame (also while sound is locked): emit the verse being sung when it starts, if the choir is audible */
  tickTracks() {
    const pnow = perfNow();
    for (const m of this.music) if (m.v.stopped || m.end < pnow - 1) this.music.delete(m);
    if (!this.tracks.size) return;
    const anow = this.ac ? this.ac.currentTime : 0;
    for (const tr of this.tracks) {
      const v = tr.v;
      if (v.stopped || v.removed) { this.tracks.delete(tr); continue; }
      const playing = v.kind === 'cue' && v.nodes && v.startTime !== undefined;
      let pos = playing ? (anow - v.startTime) * (v.rate || 1) : pnow - tr.t0 + tr.offset;
      if (pos < 0) continue;
      if (tr.period > 0) { pos %= tr.period; if (pos < tr.last) tr.i = 0; }
      tr.last = pos;
      const show = this.captionsOn && this.audibleEnough(v);
      if (tr.heading) { if (pos < 3 && show) this.caption(tr.heading, 6, v); tr.heading = null; }
      let k = -1;
      while (tr.i < tr.lines.length && tr.lines[tr.i].t <= pos) k = tr.i++;
      if (k >= 0 && show) {
        const L = tr.lines[k], rem = L.t + L.dur - pos;
        if (rem > 1) this.ctx.bus?.emit('caption', { id: v.id, verse: L.key, text: L.text, duration: Math.max(2.5, Math.min(20, rem)), pos: v.pos?.clone?.() || null });
      }
      if (!tr.period && tr.i >= tr.lines.length) this.tracks.delete(tr);
    }
  }

  /** voice budget: admit v, stealing the quietest playing voice if needed */
  admit(v) {
    const limit = VOICE_LIMIT[this.tier] || 20;
    const active = [...this.voices].concat([...this.loops].filter((l) => l.nodes));
    if (active.length < limit) return true;
    const mine = this.estimate(v) * (1 + v.def.priority);
    let worst = null, worstE = Infinity;
    for (const o of active) { const e = this.estimate(o) * (1 + (o.def.priority || 1)); if (e < worstE) { worst = o; worstE = e; } }
    if (!worst || worstE >= mine) return false;
    if (worst.kind === 'loop') { this.deactivate(worst, 0.05); worst.blockedUntil = performance.now() + 3000; } else this.stopVoice(worst, 0.05);
    return true;
  }

  startVoice(v, buffer, when, offset, fadeIn) {
    const src = new AudioBufferSourceNode(this.ac, { buffer, loop: v.kind === 'loop', playbackRate: v.rate || 1 });
    v.startTime = when - offset / (v.rate || 1);
    const nodes = this.chain(v, when, fadeIn);
    nodes.src = src;
    src.connect(nodes.g);
    src.start(when, offset);
    if (v.kind === 'cue') {
      this.voices.add(v);
      src.onended = () => { this.voices.delete(v); this.disconnect(nodes); v.nodes = null; v.endResolve?.(true); };
    }
  }

  /** a voice's processing chain (gain, air, occlusion, panner, reverb send), its gain rising from `when` over fadeIn */
  chain(v, when, fadeIn) {
    const ac = this.ac;
    if (v.pending) { v.pending = 0; this.pending.delete(v); }
    const g = new GainNode(ac, { gain: 0 });
    const nodes = { g };
    if (v.def.bed && !v.spatial) {
      g.connect(this.bedIn);
    } else if (v.spatial) {
      nodes.air = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 20000, Q: 0.5 });
      nodes.d = new GainNode(ac, { gain: 1 });
      nodes.pan = new PannerNode(ac, {
        panningModel: this.panningModel, distanceModel: 'exponential', refDistance: v.def.r0, rolloffFactor: ROLLOFF, maxDistance: 10000,
        coneInnerAngle: 360, coneOuterAngle: 360,
      });
      g.connect(nodes.air).connect(nodes.d).connect(nodes.pan).connect(this.dry);
    } else {
      g.connect(this.dry);
    }
    if (!v.def.bed || v.spatial) {
      nodes.send = new GainNode(ac, { gain: 0 });
      g.connect(nodes.send).connect(this.revIn);
    }
    v.nodes = nodes;
    if (v.spatial) { this.placePanner(v, 0); this.updateAcoustics(v, true); }
    const target = v.levelLin * v.userGain * (v.fade ?? 1);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(target, when + Math.max(0.002, fadeIn));
    return nodes;
  }

  // ---------------------------------------------------------------- sung sections, verse by verse
  // A section is rendered and played as its verse chunks (timeline.js sectionTiming().chunks): each chunk is its own
  // buffer, started at its place on the section's clock (v.startTime: the audio-clock time of the section's zero) as
  // soon as it is rendered. Someone who arrives mid-section waits for one verse, not for the whole section: the chunk
  // being sung renders first (or the next one, when it could not be ready before its verse ends), and a chunk that
  // arrives late joins in progress with a short fade.

  /** the chunk records of a section: [{ k, t0, t1, end (its singing ends), sOpts, buf, pass }] */
  sectionParts(sOpts, T) {
    const { chunk, ...base } = sOpts;
    return T.chunks.map((c, i) => ({ k: c.k, t0: c.t0, t1: c.t1, end: T.verses[i]?.t1 ?? T.singEnd, sOpts: { ...base, chunk: c.k }, buf: null, pass: -Infinity }));
  }

  /**
   * Request a section's chunks in the order they are needed from section position `pos` (s; negative: not yet begun).
   * The chunk sung at pos goes first unless it could not be rendered before its singing ends: a cue then skips it, a
   * loop (wrap) wants it for its next pass, after the others. Returns the requested parts, each with .promise.
   */
  fetchParts(parts, pos, { priority, hold = 0, pin = false, wrap = false }) {
    const sr = this.rateFor('choir-psalm'), R = this.renderer;
    const ahead = parts.filter((p) => p.t1 > pos), behind = wrap ? parts.filter((p) => p.t1 <= pos) : [];
    const cur = ahead[0];
    if (cur && cur.t0 < pos && pos + R.estimate('choir-psalm', cur.t1 - cur.t0) > cur.end - 1 && !R.peek('cue', 'choir-psalm', cur.sOpts, sr)) {
      ahead.shift();
      if (wrap) behind.push(cur);
    }
    const order = [...ahead, ...behind];
    order.forEach((p, i) => { p.promise = R.get('cue', 'choir-psalm', p.sOpts, sr, { priority: priority - i * 0.001, hold, pin }); });
    return order;
  }

  /** render a sung section's chunks ahead, in order (opts: the cue's options; first: only that many) → their promises */
  fetchSection(opts, { priority = 2, hold = 0, first = Infinity } = {}) {
    const parts = this.sectionParts(this.synthOpts(CUE_LIB['choir-psalm'], opts, 0), sectionTiming(opts)).slice(0, first);
    return this.fetchParts(parts, -1, { priority, hold }).map((p) => p.promise);
  }

  /**
   * Play a choir-psalm cue (sound running): its clock is due at request + delay from opts.offset, and holds — a chunk
   * that renders late joins in progress — unless opts.catchUp is false: then the section starts from opts.offset once
   * its first chunk is ready (dropped after maxLatency, 15 s).
   */
  playSection(v) {
    const opts = v.opts, ac = this.ac, delay = opts.delay || 0, rate = v.rate || 1, catchUp = opts.catchUp !== false;
    const req = ac.currentTime;
    v.startTime = req + delay - v.offset0 / rate;
    v.parts = this.sectionParts(v.sOpts, v.timing);
    const order = this.fetchParts(v.parts, v.offset0 - delay * rate, { priority: 10 + v.def.priority });
    if (!order.length) { v.stopped = true; v.endResolve(false); return; }
    this.inflight.add(v); // a time jump must also cancel cues whose buffer is still rendering (§9)
    for (const p of order) p.promise.then((buf) => { p.buf = buf; if (v.nodes && !v.stopped) this.schedulePart(v, p); }, () => {});
    order[0].promise.then(() => {
      this.inflight.delete(v);
      if (v.stopped || !this.ac) { v.endResolve(false); return; }
      const late = this.ac.currentTime - req;
      if (!catchUp && late > delay) {
        if (late > (opts.maxLatency ?? 15)) { v.stopped = true; v.endResolve(false); return; }
        v.startTime += late - delay; // starts now, from opts.offset
        v.mentry.end += late - delay;
      }
      if ((this.ac.currentTime - v.startTime) * rate >= v.secDur - 0.5) { v.stopped = true; v.endResolve(false); return; }
      // the voice slot is claimed just before the first chunk sounds (a scheduled sequence must not crowd out what plays
      // in between)
      const first = Math.max(this.ac.currentTime, v.startTime + order[0].t0 / rate);
      const go = () => {
        if (v.stopped || !this.ac) { v.endResolve(false); return; }
        if (!this.admit(v)) { v.stopped = true; v.endResolve(false); return; }
        this.chain(v, this.ac.currentTime, 0.004);
        this.voices.add(v);
        for (const p of v.parts) if (p.buf) this.schedulePart(v, p);
      };
      const lead = (first - this.ac.currentTime - 0.15) * 1000;
      if (lead > 0) { v.pending = setTimeout(go, lead); this.pending.add(v); } else go();
    }).catch((e) => { this.inflight.delete(v); v.stopped = true; this.warnOnce('render:choir-psalm', `[audio] render failed for choir-psalm: ${e.message}`); v.endResolve(false); });
  }

  /**
   * Start chunk p of section voice v at its place on the section's clock (passStart: the loop pass's offset, s). Late:
   * it joins in progress with a 0.5 s fade, unless less than 0.3 s of it is left. → whether it was started.
   */
  schedulePart(v, p, passStart = 0) {
    const ac = this.ac, n = v.nodes;
    if (!n || !p.buf || v.stopped || !ac) return false;
    const rate = v.rate || 1, at = v.startTime + (passStart + p.t0) / rate, now = ac.currentTime + 0.01;
    const off = at < now ? (now - at) * rate : 0, when = Math.max(at, now);
    if (off > p.buf.duration - 0.3) return false;
    const src = new AudioBufferSourceNode(ac, { buffer: p.buf, playbackRate: rate });
    let out = src;
    if (off > 0.05) {
      out = new GainNode(ac, { gain: 0 });
      out.gain.setValueAtTime(0, when);
      out.gain.linearRampToValueAtTime(1, when + 0.5);
      src.connect(out);
    }
    out.connect(n.g);
    src.start(when, off);
    const rec = { src, out };
    (n.srcs ||= new Set()).add(rec);
    src.onended = () => { n.srcs.delete(rec); try { out.disconnect(); if (out !== src) src.disconnect(); } catch { /* ok */ } };
    this.onPart?.(v, p, when, off); // test hook (dev/song-live.js)
    return true;
  }

  /** a section loop: start each ready chunk of the current pass, and of the next one in its last 4 s */
  scheduleLoop(v) {
    if (!v.nodes || !this.ac) return;
    const rate = v.rate || 1, P = v.secDur, pos = (this.ac.currentTime - v.startTime) * rate;
    const n0 = Math.max(0, Math.floor(pos / P));
    for (const n of [n0, n0 + 1]) {
      if (n * P - pos > 4) break;
      for (const p of v.parts) {
        if (!p.buf || p.pass >= n) continue;
        this.schedulePart(v, p, n * P);
        p.pass = n; // started, or too late for this pass
      }
    }
  }

  /** a section cue is over (or stopped): free its voice and chunks */
  endSection(v, ok) {
    this.voices.delete(v);
    const n = v.nodes;
    v.nodes = null;
    if (n) this.disconnect(n);
    v.endResolve?.(ok);
  }

  applyGain(v, t = 0.1) {
    if (!v.nodes || !this.ac) return;
    v.nodes.g.gain.setTargetAtTime(v.levelLin * v.userGain * (v.fade ?? 1), this.ac.currentTime, t / 3);
  }

  stopVoice(v, fade = 0.15) {
    v.stopped = true;
    if (v.pending) { clearTimeout(v.pending); v.pending = 0; this.pending.delete(v); }
    if (!v.nodes || !this.ac) { v.endResolve?.(false); return; }
    const now = this.ac.currentTime, n = v.nodes;
    n.g.gain.cancelScheduledValues(now);
    n.g.gain.setValueAtTime(n.g.gain.value, now);
    n.g.gain.linearRampToValueAtTime(0, now + fade);
    try { n.src?.stop(now + fade + 0.02); } catch { /* already stopped */ }
    if (v.parts) {
      for (const r of n.srcs || []) { try { r.src.stop(now + fade + 0.02); } catch { /* ok */ } }
      setTimeout(() => { if (v.nodes === n) this.endSection(v, true); }, (fade + 0.1) * 1000);
    }
  }

  disconnect(n) {
    for (const k of Object.keys(n)) {
      if (k === 'srcs') { for (const r of n.srcs) { try { r.src.stop(); } catch { /* ok */ } try { r.out.disconnect(); r.src.disconnect(); } catch { /* ok */ } } n.srcs.clear(); continue; }
      try { n[k].disconnect(); } catch { /* ok */ }
    }
  }

  placePanner(v, smoothing = 0.03) {
    const p = this.sourcePos(v), pan = v.nodes.pan, now = this.ac.currentTime;
    if (smoothing <= 0) { pan.positionX.value = p.x; pan.positionY.value = p.y; pan.positionZ.value = p.z; return; }
    pan.positionX.setTargetAtTime(p.x, now, smoothing); pan.positionY.setTargetAtTime(p.y, now, smoothing); pan.positionZ.setTargetAtTime(p.z, now, smoothing);
  }

  /** distance air absorption, occlusion, and the reverb send (critical-distance model) */
  updateAcoustics(v, instant = false) {
    const n = v.nodes;
    if (!n) return;
    const now = this.ac.currentTime, tc = instant ? 0.001 : 0.08;
    const sp = SPACE_ACOUSTICS[this.space] || SPACE_ACOUSTICS.court;
    let send = 0;
    if (v.spatial) {
      const p = this.sourcePos(v), d = Math.max(0.01, p.distanceTo(this.listener));
      // air absorption: ~-3 dB at 4 kHz per ~100 m; occlusion closes it further
      const fc = Math.max(1800, 22000 / (1 + d / 65)) * (1 - 0.72 * v.occ);
      n.air.frequency.setTargetAtTime(Math.min(fc, this.sr * 0.45), now, tc);
      n.d.gain.setTargetAtTime(1 - 0.6 * v.occ, now, tc);
      // the reverberant level equals the direct level at the critical distance rc, then falls with alpha
      // (0: a diffuse enclosed room, 1: open air) — in the same compressed scale as the direct path
      const srcSpace = v.space || 'court';
      const coupling = srcSpace === this.space ? 1 : sp.enclosed ? 0.3 : 0.6;
      send = Math.pow(Math.min(1, v.def.r0 / sp.rc), ROLLOFF) * Math.pow(Math.max(d, sp.rc) / sp.rc, -ROLLOFF * sp.alpha) * coupling;
    } else {
      send = 0.3;
    }
    send = Math.min(2, send * (v.def.send ?? 0.5));
    n.send?.gain.setTargetAtTime(send, now, tc);
  }

  // ---------------------------------------------------------------- loops
  loop(rawId, pos, opts = {}) {
    const id = LOOP_LIB[rawId] ? rawId : null;
    if (!id) { this.warnOnce(`loop:${rawId}`, `[audio] unknown loop "${rawId}"`); return null; }
    const def = LOOP_LIB[id];
    const spatial = !!(pos || opts.area || opts.follow);
    const v = {
      id, def, kind: 'loop', opts, sOpts: this.synthOpts(def, opts, 0), spatial, userGain: opts.gain ?? 1,
      levelLin: dbToGain(splToGainDb(def.spl) + (opts.levelDb || 0) + peopleDb(def, opts.people)), pos: this.toWorld(pos), area: this.toArea(opts.area),
      follow: opts.follow || null, rate: opts.rate || 1, nodes: null, occ: 0, occT: 0, fade: 1, quietSince: 0, phase: Math.random(),
    };
    if (v.area || (spatial && !v.pos)) v.pos = new Vector3();
    v.space = v.spatial ? this.spaceAt(this.sourcePos(v)) : null;
    v.occ = v.floor = this.transmission(v.space);
    if (def.shareCue) {
      // a section sung through, over and over, on its own clock (real seconds): it plays the choir-psalm cue's own
      // buffer, from opts.offset — or, when a choir-psalm cue of the same section is still sounding, from its end on
      v.rsOpts = this.synthOpts(CUE_LIB[def.shareCue], opts, 0);
      delete v.rsOpts.chunk;
      v.timing = sectionTiming(opts); v.secDur = v.timing.duration;
      v.parts = this.sectionParts(v.rsOpts, v.timing); // played verse by verse, as the cue (activateSection)
      const now = perfNow();
      let anchor = now - Math.max(0, +opts.offset || 0);
      for (const m of this.music) if (!m.v.stopped && m.end > now + 0.5 && sameOpts(m.sOpts, v.rsOpts)) anchor = Math.max(anchor, m.end);
      v.anchor = anchor;
      // verse captions on request only: a loop never captioned before audio-2, and a caller staging another text over
      // this sound (G3's Shabbat stand-in) must not see the stand-in's verses named
      if (def.lyrics && opts.caption === true) this.startTrack(v, { t0: anchor, period: v.secDur });
    }
    this.loops.add(v);
    const handle = {
      id,
      setGain: (g, t = 0.5) => { v.userGain = g; this.applyGain(v, t); },
      setPeople: (n) => { v.levelLin = dbToGain(splToGainDb(def.spl) + (opts.levelDb || 0) + peopleDb(def, n)); this.applyGain(v, 1); },
      setPosition: (p) => {
        if (!p) return;
        const np = this.toWorld(p, _a);
        if (!np || (!v.area && v.pos && v.pos.distanceToSquared(np) < 1e-4)) return; // static fires re-sent every 0.5 s
        v.pos = (v.pos || new Vector3()).copy(np); v.area = null; v.space = this.spaceAt(v.pos); v.floor = this.transmission(v.space);
        if (v.nodes?.pan) this.placePanner(v);
      },
      stop: (fade = 1) => {
        this.loops.delete(v); v.removed = true; this.deactivate(v, fade);
        // the shared section chunks stay pinned only while a loop still sings them
        if (v.parts && ![...this.loops].some((o) => o.rsOpts && sameOpts(o.rsOpts, v.rsOpts))) for (const p of v.parts) this.renderer.pin('cue', def.shareCue, p.sOpts, this.rateFor(def.shareCue), false);
      },
      get active() { return !!v.nodes; },
    };
    v.handle = handle;
    return handle;
  }

  activate(v) {
    if (v.loading || !this.running) return;
    if (v.parts) { this.activateSection(v); return; }
    const sr = this.rateFor(v.id);
    const buf = this.renderer.peek('loop', v.id, v.sOpts, sr);
    if (!buf) {
      v.loading = true;
      this.renderer.get('loop', v.id, v.sOpts, sr, { priority: 5 + (v.def.priority || 1), pin: true })
        .then(() => { v.loading = false; })
        .catch((e) => { v.loading = false; v.failed = true; this.warnOnce(`render:${v.id}`, `[audio] loop render failed ${v.id}: ${e.message}`); });
      return;
    }
    if (!this.admit(v)) return;
    this.occlusionFloor(v);
    // resume the "virtual playhead" so culled-and-restored loops do not restart from zero
    const offset = ((this.ac.currentTime / buf.duration + v.phase) % 1) * buf.duration;
    this.startVoice(v, buf, this.ac.currentTime + 0.01, offset, 1.2);
  }

  /** start at the right muffling, not open for the first ticks */
  occlusionFloor(v) {
    if (!v.spatial) return;
    if (v.area || v.follow) v.space = this.spaceAt(this.sourcePos(v));
    v.floor = this.transmission(v.space);
    v.occ = Math.max(v.occ || 0, v.floor);
  }

  /**
   * A section loop comes into earshot. Its playhead is its own clock (v.anchor, real seconds; it may start in the future,
   * after the cue it follows); its chunks are requested once, the one sung now first, and pinned while a loop sings them.
   * It sounds as soon as any chunk is ready; the others join at their places as they arrive (scheduleLoop).
   */
  activateSection(v) {
    const d = perfNow() + 0.01 - v.anchor; // s since the first pass began (< 0: not yet)
    if (!v.requested) {
      v.requested = true;
      for (const p of this.fetchParts(v.parts, d < 0 ? d : d % v.secDur, { priority: 5 + (v.def.priority || 1), pin: true, wrap: true })) {
        p.promise.then((buf) => { p.buf = buf; if (v.nodes) this.scheduleLoop(v); }, (e) => this.warnOnce(`render:${v.id}`, `[audio] loop render failed ${v.id}: ${e.message}`));
      }
    }
    if (!v.parts.some((p) => p.buf) || !this.admit(v)) return;
    this.occlusionFloor(v);
    this.chain(v, this.ac.currentTime + 0.01, 0.05);
    v.startTime = this.ac.currentTime + 0.01 - d / (v.rate || 1); // the first pass's zero on the audio clock
    for (const p of v.parts) p.pass = -Infinity;
    this.scheduleLoop(v);
  }

  deactivate(v, fade = 0.8) {
    const n = v.nodes;
    if (!n || !this.ac) return;
    v.nodes = null;
    const now = this.ac.currentTime;
    n.g.gain.cancelScheduledValues(now);
    n.g.gain.setValueAtTime(n.g.gain.value, now);
    n.g.gain.linearRampToValueAtTime(0, now + fade);
    if (n.src) {
      try { n.src.stop(now + fade + 0.05); } catch { /* ok */ }
      n.src.onended = () => this.disconnect(n);
    } else { // a section loop: its chunks (also those set to start later) stop with the fade
      for (const r of n.srcs || []) { try { r.src.stop(now + fade + 0.05); } catch { /* ok */ } }
      setTimeout(() => this.disconnect(n), (fade + 0.15) * 1000);
    }
  }

  // ---------------------------------------------------------------- spaces & reverb
  spaceAt(worldPos) {
    const s = w2m(worldPos);
    return spaceForZone(zoneAtSite(s.X, s.Y, s.Z));
  }

  listenerZone() {
    const z = this.ctx.zones?.current;
    const id = typeof z === 'string' ? z : z?.id;
    if (id) return id;
    const s = w2m(this.listener);
    return zoneAtSite(s.X, s.Y, s.Z);
  }

  setSpace(key) {
    if (key === this.space || !this.ac) return;
    const prev = this.space;
    this.space = key;
    const sr = this.ac.sampleRate;
    this.renderer.get('ir', key, { maxLen: IR_MAX[this.tier] || 3.5 }, sr, { priority: 30, pin: true }).then((buf) => {
      if (this.space !== key || !this.ac) return;
      let r = this.reverbs.get(key);
      if (!r) {
        const conv = new ConvolverNode(this.ac, { disableNormalization: true });
        conv.buffer = buf;
        const out = new GainNode(this.ac, { gain: 0 });
        conv.connect(out).connect(this.mix);
        r = { conv, out, connected: false };
        this.reverbs.set(key, r);
      }
      const now = this.ac.currentTime;
      if (!r.connected) { this.revIn.connect(r.conv); r.connected = true; }
      r.out.gain.setTargetAtTime(1, now, 0.35);
      for (const [k, o] of this.reverbs) {
        if (k === key || !o.connected) continue;
        o.out.gain.setTargetAtTime(0, now, 0.35);
        // stop feeding the old room; its tail rings out, then it costs nothing
        setTimeout(() => { if (this.space !== k && o.connected) { try { this.revIn.disconnect(o.conv); } catch { /* ok */ } o.connected = false; } }, 1500);
      }
      // drop rooms not used for a while (low tier keeps only the current one)
      if (this.tier === 'low') for (const [k, o] of this.reverbs) if (k !== key && k !== prev) { try { o.conv.disconnect(); o.out.disconnect(); } catch { /* ok */ } this.reverbs.delete(k); }
    }).catch((e) => this.warnOnce('ir', `[audio] reverb failed: ${e.message}`));
    const [bg, bf] = BED_BY_SPACE[key] || BED_BY_SPACE.court;
    const now = this.ac.currentTime;
    this.bedOut.gain.setTargetAtTime(bg, now, 0.4);
    this.bedFilter.frequency.setTargetAtTime(Math.min(bf, this.ac.sampleRate * 0.45), now, 0.4);
    this.ctx.bus?.emit('audio:space', { space: key, zone: this.zoneId });
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const cam = this.ctx.camera;
    const running = this.ac?.state === 'running';
    if (cam) {
      cam.updateWorldMatrix(true, false);
      cam.matrixWorld.decompose(_v, _q, _u);
      this.listener.copy(_v); // tracked even while locked: captions are gated by distance
    }
    this.tickTracks();
    if (!running) return;
    // a sung section is over when its clock passes its end (its chunks are separate sources)
    for (const v of this.voices) if (v.parts && v.nodes && this.ac.currentTime > v.startTime + v.secDur / (v.rate || 1) + 0.05) this.endSection(v, true);
    if (cam) {
      _f.set(0, 0, -1).applyQuaternion(_q);
      _u.set(0, 1, 0).applyQuaternion(_q);
      const L = this.ac.listener, now = this.ac.currentTime;
      const moved = !this.lastL || this.lastL[0].distanceToSquared(_v) > 1e-6 || this.lastL[1].distanceToSquared(_f) > 1e-7 || this.lastL[2].distanceToSquared(_u) > 1e-7;
      if (!moved) { /* listener still: no automation events */ } else if (L.positionX) {
        (this.lastL ||= [new Vector3(), new Vector3(), new Vector3()]).forEach((x, i) => x.copy([_v, _f, _u][i]));
        L.positionX.setTargetAtTime(_v.x, now, 0.015); L.positionY.setTargetAtTime(_v.y, now, 0.015); L.positionZ.setTargetAtTime(_v.z, now, 0.015);
        L.forwardX.setTargetAtTime(_f.x, now, 0.015); L.forwardY.setTargetAtTime(_f.y, now, 0.015); L.forwardZ.setTargetAtTime(_f.z, now, 0.015);
        L.upX.setTargetAtTime(_u.x, now, 0.015); L.upY.setTargetAtTime(_u.y, now, 0.015); L.upZ.setTargetAtTime(_u.z, now, 0.015);
      } else {
        (this.lastL ||= [new Vector3(), new Vector3(), new Vector3()]).forEach((x, i) => x.copy([_v, _f, _u][i]));
        L.setPosition?.(_v.x, _v.y, _v.z);
        L.setOrientation?.(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z);
      }
    }
    // moving sources (follow / area) every frame
    for (const v of this.voices) if (v.nodes?.pan && (v.follow || v.area)) this.placePanner(v);
    for (const v of this.loops) if (v.nodes?.pan && (v.follow || v.area)) this.placePanner(v);

    this.spaceTimer -= dt;
    if (this.spaceTimer <= 0) {
      this.spaceTimer = 0.25;
      this.zoneId = this.listenerZone();
      this.setSpace(spaceForZone(this.zoneId));
    }
    this.tickTimer -= dt;
    if (this.tickTimer <= 0) { this.tickTimer = 0.1; this.tick(); }
  }

  tick() {
    const now = performance.now();
    // loops: activate audible, virtualise inaudible (with hysteresis); -44 dB here ≈ -60 dBFS at the ear
    const on = dbToGain(-44), off = dbToGain(-50);
    for (const v of this.loops) {
      if (v.failed) continue;
      const e = this.estimate(v) * (v.fade ?? 1);
      if (!v.nodes) { if (e > on && !(v.blockedUntil > now)) this.activate(v); }
      else if (e < off) { if (!v.quietSince) v.quietSince = now; else if (now - v.quietSince > 1500) this.deactivate(v, 0.6); }
      else v.quietSince = 0;
      if (v.parts && v.nodes) this.scheduleLoop(v); // the next pass's chunks, 4 s ahead
    }
    // occlusion: the space-to-space transmission floor for every source (moving and area sources re-locate
    // their space each tick), plus round-robin rays for point sources on medium+ (walls within one space)
    const rays = OCCLUSION_RAYS[this.tier] ?? 2;
    const phys = this.ctx.physics;
    const list = [...this.voices, ...[...this.loops].filter((l) => l.nodes)];
    for (const v of list) {
      if (!v.spatial) continue;
      if (v.area || v.follow) v.space = this.spaceAt(this.sourcePos(v));
      v.floor = this.transmission(v.space);
    }
    if (rays && phys?.raycast && list.length) {
      for (let k = 0; k < Math.min(rays, list.length); k++) {
        const v = list[(this.rayCursor++) % list.length];
        if (!v.spatial) continue;
        const p = this.sourcePos(v), d = p.distanceTo(this.listener);
        let occ = 0;
        if (d > 3 && !v.area) {
          _ray.subVectors(p, this.listener).normalize();
          const hit = phys.raycast(this.listener, _ray, d - 1.2);
          occ = hit ? 1 : 0;
        }
        v.rayOcc = occ;
      }
    }
    for (const v of list) {
      if (v.spatial) v.occ = v.occ * 0.4 + Math.max(v.rayOcc || 0, v.floor || 0) * 0.6;
      this.updateAcoustics(v);
    }
  }

  /** stop everything (e.g. time jump), including cues still waiting for their buffer */
  stopAll(fade = 0.3) {
    for (const v of [...this.voices, ...this.pending]) this.stopVoice(v, fade);
    for (const v of this.inflight) { v.stopped = true; v.endResolve?.(false); }
    this.inflight.clear();
    // sung sections' captions (also those running on the real clock while sound is locked); loops keep theirs
    for (const m of this.music) m.v.stopped = true;
    this.music.clear();
    for (const tr of this.tracks) if (tr.v.kind === 'cue') { tr.v.stopped = true; this.tracks.delete(tr); }
  }
}

/** crowd-scaled sources: +10 log10(N / N0) dB (power adds), capped */
function peopleDb(def, people) {
  if (!def.people || !Number.isFinite(people)) return 0;
  if (people <= 0) return -80;
  return Math.max(-30, Math.min(12, 10 * Math.log10(people / def.people)));
}
