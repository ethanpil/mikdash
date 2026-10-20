// Render service: turns (kind, id, synthesis options) into cached AudioBuffers in module Workers (falls back
// to rendering on the main thread if a Worker cannot start). Two lanes, each its own Worker and queue, so a
// multi-second choir or crowd render never delays a trumpet blast. AudioBuffers are context-independent, so
// cues can be rendered before the AudioContext exists.

const HEAVY = new Set(['choir-psalm', 'choir', 'crowd-murmur']);
// the Levites' song has its own lane: a whole section renders for seconds (13–71 s of audio), and must not hold up the
// crowd beds behind it
const MUSIC = new Set(['choir-psalm', 'choir']);
const laneOf = (id) => (MUSIC.has(id) ? 'music' : HEAVY.has(id) ? 'heavy' : 'light');

class Lane {
  constructor(name, owner) { this.name = name; this.owner = owner; this.queue = []; this.busy = false; this.worker = null; this.jobs = new Map(); this.seq = 0; }

  push(job) {
    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);
    this.pump();
  }

  pump() {
    if (this.busy || !this.queue.length) return;
    const job = this.queue.shift();
    this.busy = true;
    this.run(job).then((r) => this.owner.done(job, r), (err) => this.owner.fail(job, err))
      .finally(() => { this.busy = false; this.pump(); });
  }

  run(job) {
    const msg = { kind: job.kind, id: job.id, opts: job.opts, sr: job.sr, tier: job.tier };
    if (!this.owner.workerFailed) {
      try {
        if (!this.worker) {
          this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module', name: `mikdash-audio-${this.name}` });
          this.worker.onmessage = (e) => {
            const j = this.jobs.get(e.data.job);
            if (!j) return;
            this.jobs.delete(e.data.job);
            if (e.data.ok) j.resolve(e.data); else j.reject(new Error(e.data.error));
          };
          this.worker.onerror = (e) => {
            // the worker script itself failed to load: render on the main thread from now on
            e.preventDefault?.();
            this.owner.workerFailed = true;
            this.worker?.terminate(); this.worker = null;
            const pending = [...this.jobs.values()];
            this.jobs.clear();
            for (const p of pending) runLocal(p.msg).then(p.resolve, p.reject);
          };
        }
        const n = ++this.seq;
        return new Promise((resolve, reject) => {
          this.jobs.set(n, { resolve, reject, msg });
          this.worker.postMessage({ job: n, ...msg });
        });
      } catch {
        this.owner.workerFailed = true;
      }
    }
    return runLocal(msg);
  }

  dispose() { this.worker?.terminate(); this.worker = null; this.queue.length = 0; }
}

async function runLocal(msg) {
  const { synthesize } = await import('./synth/index.js');
  const t0 = performance.now();
  const r = synthesize(msg);
  return { channels: r.channels, sampleRate: r.sampleRate, ms: performance.now() - t0 };
}

export class Renderer {
  constructor({ tier = 'medium', budgetMB = 80 } = {}) {
    this.tier = tier;
    this.budget = budgetMB * 1024 * 1024;
    this.cache = new Map(); // key -> { promise, buffer, bytes, used, pinned }
    this.lanes = { light: new Lane('light', this), heavy: new Lane('heavy', this), music: new Lane('music', this) };
    this.workerFailed = false;
    this.stats = { renders: 0, ms: 0, bytes: 0, failures: 0 };
  }

  get queue() { return [...this.lanes.light.queue, ...this.lanes.heavy.queue, ...this.lanes.music.queue]; }
  get worker() { return this.lanes.light.worker || this.lanes.heavy.worker || this.lanes.music.worker; }

  /** Cache key. The heavy renders (choir, crowd) also depend on the quality tier (singer/talker counts). */
  key(kind, id, opts, sr) {
    const o = opts && Object.keys(opts).length ? JSON.stringify(opts, Object.keys(opts).sort()) : '';
    return `${kind}:${id}:${sr}:${o}${HEAVY.has(id) ? `:${this.tier}` : ''}`;
  }

  /**
   * Promise<AudioBuffer>. priority: higher first. pin: never evicted (beds). hold: performance.now() ms until which it
   * is not evicted (a prefetched concert, kept until it has been sung; extended, never shortened, by a later request).
   */
  get(kind, id, opts = {}, sr = 48000, { priority = 1, pin = false, hold = 0 } = {}) {
    const key = this.key(kind, id, opts, sr);
    const lane = this.lanes[laneOf(id)];
    let e = this.cache.get(key);
    if (e) {
      e.used = performance.now();
      if (pin) e.pinned = true;
      if (hold > e.hold) e.hold = hold;
      // a queued job asked for again at a higher priority moves up
      const q = lane.queue.find((j) => j.key === key);
      if (q && priority > q.priority) { q.priority = priority; lane.queue.sort((a, b) => b.priority - a.priority); }
      return e.promise;
    }
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    promise.catch(() => {});
    e = { promise, buffer: null, bytes: 0, used: performance.now(), pinned: pin, hold: +hold || 0, kind, id, sr, opts, tier: this.tier };
    this.cache.set(key, e);
    lane.push({ key, kind, id, opts, sr, tier: this.tier, priority, resolve, reject });
    return promise;
  }

  /** Pin (never evict) or unpin a cached buffer, rendered or still rendering. */
  pin(kind, id, opts = {}, sr = 48000, on = true) {
    const e = this.cache.get(this.key(kind, id, opts, sr));
    if (e) { e.pinned = !!on; e.used = performance.now(); }
    if (!on) this.evict();
  }

  /** The buffer if it is already rendered (synchronous), else null. */
  peek(kind, id, opts = {}, sr = 48000) {
    const e = this.cache.get(this.key(kind, id, opts, sr));
    if (e?.buffer) e.used = performance.now();
    return e?.buffer || null;
  }

  /**
   * Quality change: drop rendered buffers the new tier will never ask for again (other synthesis rate, another
   * tier's choir/crowd, impulse responses of another length). Buffers still playing stay alive in their nodes.
   */
  retier(tier, synthRate, irMaxLen) {
    this.tier = tier;
    const rate = typeof synthRate === 'function' ? synthRate : () => synthRate; // per id (the choir has its own rate)
    for (const [k, e] of this.cache) {
      const stale = e.kind === 'ir' ? e.opts?.maxLen !== irMaxLen : e.sr !== rate(e.id) || (HEAVY.has(e.id) && e.tier !== tier);
      if (!stale) continue;
      if (e.buffer) this.cache.delete(k); else e.pinned = false;
    }
    this.evict();
  }

  done(job, r) {
    const buf = toAudioBuffer(r.channels, r.sampleRate);
    const e = this.cache.get(job.key);
    // a finished render counts as just used: a long render requested more than 15 s ago must not be the first evicted
    if (e) { e.buffer = buf; e.bytes = buf.length * buf.numberOfChannels * 4; e.used = performance.now(); }
    this.stats.renders++; this.stats.ms += r.ms || 0;
    job.resolve(buf);
    this.evict();
  }

  fail(job, err) {
    this.stats.failures++;
    this.cache.delete(job.key);
    job.reject(err);
  }

  /**
   * LRU eviction of unpinned, unheld buffers above the budget. Pinned and held buffers count toward it but are kept:
   * during a long concert on low the cache may sit above the budget, the other cues giving way.
   */
  evict() {
    let total = 0;
    for (const e of this.cache.values()) total += e.bytes;
    this.stats.bytes = total;
    if (total <= this.budget) return;
    const now = performance.now();
    const list = [...this.cache.entries()].filter(([, e]) => e.buffer && !e.pinned && !(e.hold > now)).sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of list) {
      if (total <= this.budget * 0.85) break;
      if (performance.now() - e.used < 15000) continue; // recently used: likely still playing
      total -= e.bytes;
      this.cache.delete(k);
    }
    this.stats.bytes = total;
  }

  dispose() { for (const l of Object.values(this.lanes)) l.dispose(); this.cache.clear(); }
}

export function toAudioBuffer(channels, sampleRate) {
  const buf = new AudioBuffer({ length: channels[0].length, numberOfChannels: channels.length, sampleRate });
  channels.forEach((c, i) => buf.copyToChannel(c, i));
  return buf;
}
