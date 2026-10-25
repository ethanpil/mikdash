// The day's heavy plans off the boot's critical path (qa-r2 SIM-R2-12). G4 / G5 plan the whole day at once (hundreds of
// booked walkers: 3.2–3.5 s of main thread on low in production, measured), and they did it in sim's init, before
// 'ready'. Now each such module's plan is a step of this job, run after the first image in short slices between frames,
// in the order the plans read one another (G5's offerings first, then g4/book.js ORDER); until its plan is in, a
// module shows nothing (its plan() returns null: sim.planNow() is false). A screenshot boot (shot=1) finishes the job at
// 'firstFrame' in one go, so a shot or a test sees the whole day planned as before (same order, same results).
// Measured (docs/decisions/qa-r2-sim.md): run in the shader warm-up instead, the planning only lengthened the CPU-bound
// warm-up by as much (the first image no sooner). A step is a function; one that returns an iterator is stepped (the
// planners yield every few arrivals).
export class PlanJob {
  constructor(ctx) {
    this.ctx = ctx;
    this.steps = [];
    this.open = true;         // steps may still be added (the runtime seals the job once every module is initialised)
    this.ready = false;       // 'ready' seen: the job may run in slices
    this.running = false;     // inside a step (a module's plan may build now)
    this.done = false;
    this.stats = { ms: 0, slices: 0, maxSlice: 0, maxNext: 0, maxNextId: '', flushedMs: 0, startedAt: NaN, doneAt: NaN, order: [] };
    this._timer = null;
  }
  /** add a step (before 'ready'); fn() → undefined | iterator */
  add(id, fn) { if (!this.done) this.steps.push({ id, fn, it: null, ms: 0 }); }
  /**
   * Run the job again for a new date (gate-sim-data: the midnight crossing and the date picker re-planned the G4 chain
   * synchronously, 0.6–0.75 s in one frame on low). steps: [{ id, fn }] in order; any step still pending from the
   * previous run is dropped (its module re-plans for the new date). The slices start on the next macrotask.
   */
  restart(steps) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this.steps = steps.map(({ id, fn }) => ({ id, fn, it: null, ms: 0 }));
    this.open = false;
    this.done = !this.steps.length;
    this.runs = (this.runs || 0) + 1;
    Object.assign(this.stats, { ms: 0, slices: 0, maxSlice: 0, maxNext: 0, maxNextId: '', startedAt: performance.now(), doneAt: NaN, order: [] });
    if (this.done) { this.stats.doneAt = performance.now(); return; }
    this.ready = true;
    this._timer = setTimeout(this._tick, 0);
  }
  /** one slice, then the next on the macrotask queue (between frames) while steps are left */
  _tick = () => {
    this._timer = null;
    if (!this.pending) return;
    this.run(this.budget ?? 8);
    if (this.pending) this._timer = setTimeout(this._tick, 0);
  };
  get pending() { return !this.done && (this.open || this.steps.length > 0); }
  /** no more steps: from now on the job only runs (an empty job is done at once) */
  seal() { this.open = false; if (!this.steps.length) this._finish(); }
  /** may a plan be built now? Inside a step, or once the job is done */
  planNow() { return !this.pending || this.running; }
  /** from 'firstFrame': slices of `budget` ms on the macrotask queue (between frames) until done */
  start(budget = 8) {
    if (this.ready) return;
    this.seal();
    this.ready = true;
    this.stats.startedAt = performance.now();
    this.budget = budget;
    this._timer = setTimeout(this._tick, 0);
  }
  /** run steps for up to `ms` (at least one step's slice) */
  run(ms) {
    if (!this.steps.length || this.running) return;
    const end = performance.now() + ms;
    this.running = true;
    const a = performance.now();
    try {
      do {
        const s = this.steps[0];
        const s0 = performance.now();
        try {
          if (!s.it) {
            const r = s.fn();
            s.it = r && typeof r.next === 'function' ? r : null;
            if (!s.it) { this._next(s, s0); continue; }
          }
          const r = s.it.next();
          const d = performance.now() - s0;
          if (ms !== Infinity && d > this.stats.maxNext) { this.stats.maxNext = d; this.stats.maxNextId = s.id; }
          if (r.done) this._next(s, s0); else s.ms += d;
        } catch (e) {
          console.error(`[sim] plan step "${s.id}" failed`, e);
          this._next(s, s0);
        }
      } while (this.steps.length && performance.now() < end);
    } finally {
      this.running = false;
      const d = performance.now() - a;
      this.stats.ms += d;
      this.stats.slices++;
      if (ms !== Infinity) this.stats.maxSlice = Math.max(this.stats.maxSlice, d);
      if (!this.steps.length) this._finish();
    }
  }
  /** finish every step now (a screenshot boot at 'firstFrame'; ?planjob=0 in init) */
  flush() {
    if (!this.pending || this.running) return;
    const a = performance.now();
    this.run(Infinity);
    this.stats.flushedMs += performance.now() - a;
  }
  _next(s, s0) {
    s.ms += performance.now() - s0;
    this.stats.order.push(`${s.id} ${Math.round(s.ms)}`);
    this.steps.shift();
  }
  _finish() {
    this.done = true;
    this.stats.doneAt = performance.now();
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}
