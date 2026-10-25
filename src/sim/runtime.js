// Choreography runtime (ARCHITECTURE §9). Modules in src/sim/choreo/*.js export default:
//
//   {
//     id: 'night-watch',            // events reference it by event.choreo
//     aliases?: ['gates-closing'],  // further choreo ids this module serves (sim.eventsOf(alias) splits them)
//     always?: true,                // update even when none of its events is near (e.g. door states all day)
//     lead?: 2, lag?: 2,            // minutes before t0 / after t1 that still count as relevant (default 2 / 2)
//     importance?: 1..3,            // weights its actors in the figure budget (default: max of its events)
//     fixtures?: [events],          // used ONLY when the schedule has no event for this module (dev fallback)
//     init(ctx, events, sim) -> state,          // once, at boot; spawn pools here (they are warmed behind the loader)
//     update(ctx, state, t, dt, sim),           // pose everything as a PURE function of t (and date, seed)
//     release?(ctx, state, sim),                // it stopped being relevant (its pools are hidden automatically)
//     dispose?(ctx, state, sim),
//   }
//
// Determinism: update receives the sim time t; it must not accumulate state across frames (dt — real seconds since
// its previous update — is for smoothing only). After 'time:jump' / 'time:date' every relevant choreo is updated in
// the same frame, so the world re-poses instantly. Sound/caption cues go through cueAt(state, key, tCue, fn), never
// in [t0, t0 + CUE_LEAD) of their event (lib/cue.js). Per-date plans may be cached on sim.generation.
//
// Boot: every choreo is initialised at load, and on the first frame (behind the loading screen) every pooled figure is
// stood once in front of the camera on a ladder of distances, so people builds each archetype × LOD batch and the
// renderer compiles their programs then — not on the first jump into the night (3–5 s on an HD 4600).
//
// LOD: a choreo's distance = player → its bounds (sim.setBounds; default: its events' positions). Near (< 120 m)
// updates every frame, mid (< 350 m) at 15 Hz, far at 4 Hz; a choreo spanning the Mount can thin its own far figures
// with sim.due(slot). Figures: after all updates one budget pass shows at most maxFigures × 4 wanted figures (people
// draws maxFigures at LOD0–2 and up to 3× more as LOD3 silhouettes), crowds counted by their members, ranked by
// distance divided by (pool importance × choreo importance); figures beyond the far cut (drawDistance / 5) are hidden.
//
// Movables: sim.door(id) is shared between choreos — each states the amount it wants in its update; the runtime
// applies the largest wanted amount (the builder's default when none wants it), so a door one choreo stops driving
// returns to its default deterministically.
//
// Fires: the same for ctx.fx fires — sim.fireWant(id, level) states this choreo's level for this update (several
// calls in one update: the largest); once per frame, after every update, each fire gets the largest wanted level,
// or its builder's level (the fx spec's intensity; fx's schedule modulates it) when no choreo wants it (lib/world.js
// FireBoard). A choreo that is skipped by its LOD keeps its wants; one that stops being relevant drops them. Choreos
// never write fx levels themselves: a hand-over between two choreos driving one fire is just two windows of wants.
//
// Plans: a module may export plan(ctx, state, sim) -> its per-date plan (built on demand, cached on sim.generation);
// another choreo reads it with sim.planOf(id) (the module is initialised first if it was not yet). A module that also
// exports planRank (a number) plans its day in the boot's plan job instead (lib/planjob.js — qa-r2 SIM-R2-12): steps in
// planRank order, in slices between frames from 'firstFrame' on (all at once then on a screenshot boot); its plan()
// asks sim.planNow() before building (false until the job is done: no figures meanwhile). planSteps(ctx, state, sim),
// when exported, is the plan as an iterator (yielding every few arrivals). A new date in normal play (the clock through
// midnight, the date picker) runs the job again (remap → PlanJob.restart; gate-sim-data): never a whole day's plan in
// one frame; a screenshot boot plans on demand as before.
import { Box3, Vector3 } from 'three';
import { PRIORITY } from '../core/engine.js';
import { m2w } from '../core/units.js';
import { wrap, near } from './lib/core.js';
import { SIM, cueAt } from './lib/cue.js';
import { ActorPool, CrowdHandle } from './lib/actors.js';
import { movable, FireBoard, sound, caption } from './lib/world.js';
import { PlanJob } from './lib/planjob.js';

const MODULES = import.meta.glob('./choreo/*.js');
const LOD_NEAR = 120, LOD_MID = 350;           // meters
const LOD_INTERVAL = [0, 1 / 15, 1 / 4];       // seconds between updates per LOD level
const CROWD_SCALE = { low: 0.35, medium: 0.6, high: 1, ultra: 1 };
const LOD3_ALLOWANCE = 3;                      // people: up to 3 × maxFigures more as LOD3 silhouettes (docs/API.md)
// boot warm-up: metres in front of the camera — covers LOD0…LOD3 at every tier's thresholds; props on the near rungs
const WARM_D = [1.6, 2.4, 3.6, 5.4, 8, 12, 18, 27, 40, 60, 90, 135];
const WARM_PROP = [1.6, 2.4, 3.6, 5.4, 8, 12];
const byScore = (a, b) => a._score - b._score;
const _fwd = new Vector3(), _right = new Vector3(), _p = new Vector3();

const budgetOf = (ctx) => (ctx.quality?.maxFigures ?? 60) * (1 + LOD3_ALLOWANCE);

export async function createRuntime(ctx, schedule) {
  const entries = [];
  const byId = new Map(); // choreo id or alias → entry
  const doorReg = new Map(), doorList = [];
  const fireBoard = new FireBoard(ctx);
  const plans = new PlanJob(ctx);
  const runtime = {
    entries,
    /** sim minutes of continuous forward play since load (never decreases; cue bookkeeping) */
    playClock: 0,
    /** figures the sim lets people draw (maxFigures × 4) */
    budget: budgetOf(ctx),
    farCut: (ctx.quality?.drawDistance ?? 2500) / 5,
    /** bumped whenever the events are re-mapped (new date / day type): choreos key per-date plans on it */
    generation: 0,
    stats: { ms: 0, last: 0, msPeak: 0, figures: 0, wanted: 0, budget: 0, frames: 0 },
    choreo: (id) => byId.get(id) || null,
    /** re-map events → choreos (after the schedule re-selects for a new date / day type) */
    remap,
    /** force every relevant choreo to re-pose on the next frame */
    repose() { for (const e of entries) e.jumped = true; },
    /** the shared fires (lib/world.js FireBoard): fires.list, fires.state(id) -> { value, def, wants } */
    fires: fireBoard,
    /** a choreo's per-date plan (its module's exported plan()), or null — see sim.planOf */
    planOf: (id) => planOf(id),
    /** the boot's plan job (lib/planjob.js): stats { ms, slices, flushedMs, startedAt, doneAt, order } */
    plans,
    update,
    /** stop and free everything (choreos' dispose(), their figures) */
    dispose() {
      offUpdate?.();
      for (const e of entries) {
        if (e.inited && e.mod.dispose) { try { e.mod.dispose(ctx, e.state, e.sim); } catch (err) { console.error(`[sim] choreo "${e.id}" dispose failed`, err); } }
        for (const p of e.pools) p.dispose();
        for (const c of e.crowds) c.dispose();
      }
    },
  };
  let offUpdate = null;

  const loaded = await Promise.all(Object.entries(MODULES).map(async ([path, load]) => {
    try { return { path, mod: (await load()).default }; } catch (e) { console.error(`[sim] failed to load ${path}`, e); return null; }
  }));
  for (const it of loaded) {
    const mod = it?.mod;
    if (!mod?.id || typeof mod.update !== 'function') { if (it) console.warn(`[sim] ${it.path}: no default { id, update }`); continue; }
    const e = makeEntry(mod);
    entries.push(e);
    for (const k of [mod.id, ...(mod.aliases || [])]) {
      if (byId.has(k)) console.warn(`[sim] choreo id "${k}" claimed twice`);
      else byId.set(k, e);
    }
  }

  function makeEntry(mod) {
    const e = {
      mod, id: mod.id, events: [], fixture: false, state: null, inited: false, failed: false,
      relevant: false, lod: 0, dist: 0, nextAt: 0, acc: 0, jumped: true, forced: true, lastUpdate: 0,
      pools: [], crowds: [], doorWants: [], fireWants: [], bounds: null, autoBounds: true, importance: mod.importance ?? 1,
      ms: 0, updates: 0,
    };
    e.handle = { runtime, entry: e, crossing: { ok: false, from: 0, span: 0 }, fired: new Map() };
    e.sim = makeSim(e);
    return e;
  }

  // ---- shared movables (doors / curtains): every choreo states a wanted amount, the largest wins
  function sharedDoor(id) {
    let D = doorReg.get(id);
    if (!D) {
      const h = movable(ctx, id);
      D = { h, groups: [], wants: [] };
      doorReg.set(id, D);
      if (h.exists) doorList.push(D);
    }
    return D;
  }
  function doorProxy(e, id) {
    const D = sharedDoor(id);
    const w = { all: NaN, grp: [] };   // this choreo's wants (NaN = none)
    D.wants.push(w);
    e.doorWants.push(w);
    const p = {
      get id() { return D.h.id; },
      get exists() { return D.h.exists; },
      get node() { return D.h.node; },
      get amount() { return D.h.amount; },
      /** the amount this choreo wants for the whole door (0 shut … 1 open) */
      set(f) { w.all = +f; return p; },
      /** … for one leaf group (heichal great gate: 'outer' | 'inner') */
      setGroup(g, f) {
        let i = D.groups.indexOf(g);
        if (i < 0) i = D.groups.push(g) - 1;
        w.grp[i] = +f;
        return p;
      },
    };
    return p;
  }
  const clearSharedWants = (e) => {
    for (let i = 0; i < e.doorWants.length; i++) { const w = e.doorWants[i]; w.all = NaN; w.grp.fill(NaN); }
    for (let i = 0; i < e.fireWants.length; i++) e.fireWants[i].v = NaN;
  };
  function resolveDoors() {
    for (let k = 0; k < doorList.length; k++) {
      const D = doorList[k], W = D.wants;
      let all = NaN;
      for (let i = 0; i < W.length; i++) { const v = W[i].all; if (!(v <= all)) all = Number.isNaN(v) ? all : v; }
      if (!D.groups.length) { D.h.set(Number.isNaN(all) ? D.h.default : all); continue; }
      for (let g = 0; g < D.groups.length; g++) {
        let v = all;
        for (let i = 0; i < W.length; i++) { const x = W[i].grp[g]; if (x !== undefined && !Number.isNaN(x) && !(x <= v)) v = x; }
        D.h.setGroup(D.groups[g], Number.isNaN(v) ? D.h.default : v);
      }
    }
  }

  // ---- per-frame values the sim handles read
  // (fields of one object: a double kept in a closure variable would be re-boxed on every write)
  const F = { pp: ctx.camera.position, now: 0 };   // the observer (feet); seconds (performance clock)

  function makeSim(e) {
    const doors = new Map(), fireW = new Map(), fires = new Map();
    const fireWant = (id, level) => {
      let w = fireW.get(id);
      if (!w) { w = fireBoard.slot(id, e.id); fireW.set(id, w); e.fireWants.push(w); }
      if (Number.isFinite(level) && !(w.v >= level)) w.v = level;
      return level;
    };
    return {
      ctx,
      get id() { return e.id; },
      get events() { return e.events; },
      /** the choreo's events served under one id/alias (e.g. 'gates-closing') */
      eventsOf(choreoId) { return e.events.filter((ev) => (ev.choreo || e.id) === choreoId || (!ev.choreo && choreoId === e.id)); },
      get lod() { return e.lod; },
      get distance() { return e.dist; },
      get crossing() { return e.handle.crossing; },
      /** true in an update that must re-pose everything (after a jump, a date change, or on waking) */
      get forced() { return e.forced; },
      /** changes whenever the events were re-mapped (new date): key per-date plans on it */
      get generation() { return runtime.generation; },
      get physVersion() { return (ctx.physics?.version ?? 0) * 2 + (ctx.physics?.bvh ? 1 : 0); },
      get crowdScale() { return CROWD_SCALE[ctx.quality?.key] ?? 0.6; },
      get schedule() { return schedule; },
      /** is a choreo module registered for this id (another module may take over part of a scene)? */
      hasChoreo(id) { return byId.has(id); },
      /** the event with this id among the choreo's own events, else in the whole schedule */
      event(id) { return e.events.find((ev) => ev.id === id) || schedule.byId(id) || null; },
      pool(spec) { const p = new ActorPool(e.sim, spec); e.pools.push(p); return p; },
      crowd(spec) { const c = new CrowdHandle(e.sim, spec); e.crowds.push(c); return c; },
      /** shared movable: set(f) / setGroup(g, f) state what this choreo wants this update (largest want wins) */
      door(id) { if (!doors.has(id)) doors.set(id, doorProxy(e, id)); return doors.get(id); },
      /**
       * shared fire (ctx.fx id): the level 0..1 this choreo wants for it in this update (the largest of its calls);
       * the runtime applies the largest want of all choreos after the frame's updates, the builder's level when none
       */
      fireWant,
      /** the old handle, kept as an alias: set(v) = fireWant(id, v) */
      fire(id) {
        if (!fires.has(id)) {
          const h = { id, get exists() { return !!ctx.fx?.fires?.has?.(id); }, set(v) { fireWant(id, v); return h; } };
          fires.set(id, h);
        }
        return fires.get(id);
      },
      /** another choreo's per-date plan: its module's exported plan(ctx, state, sim), built now if needed; null without it */
      planOf: (id) => planOf(id),
      /** may this module build its per-date plan now? (the boot's plan job — false in the warm-up's undrawn frames) */
      planNow: () => plans.planNow(),
      sound: (id, pos, opts) => sound(ctx, id, pos, opts),
      caption: (text, opts) => caption(ctx, text, opts),
      cueAt: (key, tCue, fn) => cueAt(e.state, key, tCue, fn),
      /**
       * Per-slot LOD for a choreo spread over a large area: false = skip posing this slot this update (it stays as
       * it was, shown or not). Near the observer, after a jump and on waking always true; else at 15 Hz / 4 Hz.
       */
      due(slot) {
        if (e.forced) { slot._dueAt = 0; return true; }
        const d2 = slot.pos.distanceToSquared(F.pp);
        const lod = d2 < LOD_NEAR * LOD_NEAR ? 0 : d2 < LOD_MID * LOD_MID ? 1 : 2;
        if (lod === 0 || F.now >= slot._dueAt) { slot._dueAt = F.now + LOD_INTERVAL[lod]; return true; }
        slot.want = slot._wantPrev;
        return false;
      },
      /** site box (amot) the choreo spans, for LOD distance */
      setBounds(min, max) {
        e.bounds = new Box3().setFromPoints([m2w(min[0], min[1], min[2] ?? 0), m2w(max[0], max[1], max[2] ?? 0)]);
        e.autoBounds = false;
      },
    };
  }

  // the modules that plan their day in the plan job (planRank), in order — set once every module is initialised
  let ranked = null;
  const planStepsList = () => ranked.filter((e) => !e.failed).map((e) => ({
    id: e.id,
    fn: () => {
      if (typeof e.mod.planSteps === 'function') return e.mod.planSteps(ctx, e.state, e.sim);
      e.mod.plan(ctx, e.state, e.sim);
      return undefined;
    },
  }));

  function remap() {
    runtime.generation++;
    for (const e of entries) e.events.length = 0;
    for (const ev of schedule.events) {
      const e = byId.get(ev.choreo);
      if (e) e.events.push(ev);
    }
    for (const e of entries) {
      e.fixture = !e.events.length && Array.isArray(e.mod.fixtures) && e.mod.fixtures.length > 0;
      if (e.fixture) for (const ev of e.mod.fixtures) { schedule.resolveEvent(ev); e.events.push(ev); }
      if (e.autoBounds) e.bounds = boundsOf(e.events);
      const imp = Math.max(0, ...e.events.map((ev) => ev.importance || 1));
      e.importance = e.mod.importance ?? (imp || 1);
      e.jumped = true;
    }
    // a new date in play (the clock through midnight, the date picker): the ranked modules plan it in the plan job's
    // slices between frames, as at boot, and show nothing until their plan is in (gate-sim-data — it was one frame of
    // 0.6–0.75 s on low). A screenshot boot keeps planning on demand, in the frame that needs it (shots and tests see
    // the whole day planned at once). ?planjob=0 too.
    if (ranked && plans.ready && !ctx.params?.shot && ctx.params?.raw?.get?.('planjob') !== '0') plans.restart(planStepsList());
  }

  /** a choreo's per-date plan through its module's exported plan() (initialised first if it was not yet) */
  function planOf(id) {
    const x = byId.get(id);
    if (!x || x.failed || typeof x.mod.plan !== 'function') return null;
    if (!x.inited && !init(x)) return null;
    try { return x.mod.plan(ctx, x.state, x.sim) ?? null; } catch (err) { console.error(`[sim] choreo "${x.id}" plan failed`, err); return null; }
  }

  function boundsOf(events) {
    const b = new Box3();
    for (const ev of events) { const p = schedule.positionOf(ev); if (p) b.expandByPoint(p); }
    if (b.isEmpty()) return null;
    return b.expandByScalar(20);
  }

  // ---- clock bookkeeping
  let jumpPending = true;
  ctx.bus.on('time:jump', () => { jumpPending = true; });
  ctx.bus.on('time:date', () => { jumpPending = true; });
  ctx.bus.on('quality:change', () => {
    runtime.budget = budgetOf(ctx);
    runtime.farCut = (ctx.quality?.drawDistance ?? 2500) / 5;
  });

  // ---- the frame
  let warmPending = false, plansSeen = false, plansRun = 0;
  function update() {
    const t0 = performance.now();
    const time = ctx.time;
    if (!time) return;
    const nowS = F.now = t0 / 1000;
    const pp = F.pp = ctx.player?.position || ctx.camera.position;
    if (warmPending) { warmPending = false; if (warmFrame()) return; }
    const t = time.t, fd = time.frameDelta || 0;
    // the boot's plan job just finished (often inside the first drawn frame's updates): re-pose everything once more,
    // the fires snapping to the planned levels rather than easing in
    if (!plansSeen && plans.done) { plansSeen = true; plansRun = plans.runs || 0; jumpPending = true; }
    // a new date's plan job just finished: its modules re-pose everything once (not only the slots near the observer)
    else if (plans.done && (plans.runs || 0) !== plansRun) { plansRun = plans.runs; for (const e of ranked) e.jumped = true; }
    const jump = jumpPending || fd < 0;
    if (jump) {
      jumpPending = false;
      for (const e of entries) { e.jumped = true; e.acc = 0; e.handle.fired.clear(); }
    } else if (fd > 0) {
      runtime.playClock += fd;
      for (let i = 0; i < entries.length; i++) entries[i].acc += fd;
    }
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.failed) continue;
      const m = e.mod;
      const lead = m.lead ?? 2, lag = m.lag ?? 2;
      let rel = !!m.always;
      if (!rel) {
        for (let k = 0; k < e.events.length; k++) {
          const ev = e.events[k];
          if (Number.isFinite(ev.t0) && near(t, ev.t0, ev.t1, lead, lag)) { rel = true; break; }
          // a retimed event (schedule.retime: the listed window is the staged one) keeps its module relevant through the
          // data's window too: the staging reads that one (gate-sim-data — its men walking off must not vanish)
          const w = ev.tPlan;
          if (w && near(t, w[0], w[1], lead, lag)) { rel = true; break; }
        }
      }
      if (!rel) {
        if (e.relevant) release(e);
        e.acc = 0;
        continue;
      }
      const wake = !e.relevant;
      e.relevant = true;
      if (!e.inited && !init(e)) continue;
      e.dist = e.bounds ? e.bounds.distanceToPoint(pp) : 0;
      e.lod = e.dist < LOD_NEAR ? 0 : e.dist < LOD_MID ? 1 : 2;
      if (!(e.jumped || wake || nowS >= e.nextAt)) continue;
      e.nextAt = nowS + LOD_INTERVAL[e.lod];
      e.forced = e.jumped || wake;
      const c = e.handle.crossing;
      c.ok = !e.forced && e.acc > 0 && e.acc < 720;
      c.span = e.acc;
      c.from = wrap(t - e.acc);
      for (let k = 0; k < e.pools.length; k++) e.pools[k].clearWants();
      for (let k = 0; k < e.crowds.length; k++) e.crowds[k].want = false;
      clearSharedWants(e);
      const u0 = performance.now();
      try {
        m.update(ctx, e.state, t, e.lastUpdate ? Math.min(1, nowS - e.lastUpdate) : 0, e.sim);
      } catch (err) {
        console.error(`[sim] choreo "${e.id}" update failed — disabled`, err);
        e.failed = true;
        release(e);
      }
      e.ms = e.ms * 0.9 + (performance.now() - u0) * 0.1;
      e.updates++;
      e.lastUpdate = nowS;
      e.acc = 0;
      e.jumped = false;
      e.forced = false;
      c.ok = false;
    }
    resolveDoors();
    fireBoard.resolve();
    // a jump (or a new date) re-poses the fires with the figures: fx takes the new levels without easing
    if (jump) { try { ctx.fx?.snap?.(); } catch { /* fx missing */ } }
    budgetPass(pp);
    const ms = performance.now() - t0;
    const s = runtime.stats;
    s.last = ms;
    s.ms = s.ms * 0.95 + ms * 0.05;
    s.msPeak = Math.max(s.msPeak * 0.995, ms);
    s.frames++;
  }

  function init(e) {
    try {
      e.state = e.mod.init ? (e.mod.init(ctx, e.events, e.sim) || {}) : {};
      e.state[SIM] = e.handle;
      e.inited = true;
      for (const p of e.pools) p.warm();
      return true;
    } catch (err) {
      console.error(`[sim] choreo "${e.id}" init failed — disabled`, err);
      e.failed = true;
      return false;
    }
  }

  function release(e) {
    e.relevant = false;
    for (const p of e.pools) p.clearWants();
    for (const c of e.crowds) c.want = false;
    clearSharedWants(e);
    if (e.inited && e.mod.release) { try { e.mod.release(ctx, e.state, e.sim); } catch (err) { console.error(`[sim] choreo "${e.id}" release failed`, err); } }
  }

  /**
   * First frame only: every pooled figure stands once in front of the camera, spread over a ladder of distances
   * (props on the near rungs), so people creates every archetype × LOD batch and the renderer compiles the programs
   * now, behind the loading screen. The next frame re-poses everything (jumped) and the budget pass hides the rest.
   */
  function warmFrame() {
    const cam = ctx.camera;
    if (!cam || !ctx.people) return false;
    cam.updateMatrixWorld();
    cam.getWorldDirection(_fwd);
    _right.crossVectors(_fwd, cam.up);
    if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0); else _right.normalize();
    let j = 0, jp = 0, n = 0;
    for (const e of entries) {
      e.jumped = true;
      for (const p of e.pools) {
        for (const s of p.slots) {
          const a = s.ensure();
          const d = s._prop ? WARM_PROP[jp++ % WARM_PROP.length] : WARM_D[j++ % WARM_D.length];
          _p.copy(cam.position).addScaledVector(_fwd, d).addScaledVector(_right, ((n++ % 5) - 2) * 0.13 * d);
          _p.y -= 0.9;             // the figure's middle on the view ray
          a.setPosition?.(_p);
          s.pos.copy(_p);
          s.placed = false;        // the next place() puts it back where its choreo wants it
          s._apply(true);
        }
      }
    }
    return n > 0;
  }

  // one ranked pass over every wanted figure (slots: 1 each; crowds: their members)
  const cand = [];
  function budgetPass(pp) {
    cand.length = 0;
    let wanted = 0, total = 0;
    const far2 = runtime.farCut * runtime.farCut;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const w = e.importance || 1;
      for (let k = 0; k < e.pools.length; k++) {
        const p = e.pools[k];
        const pw = w * (p.importance || 1);
        for (let q = 0; q < p.slots.length; q++) {
          const s = p.slots[q];
          if (!s.want || !s.actor) { s._apply(false); continue; }
          wanted++;
          const d2 = s.pos.distanceToSquared(pp);
          if (d2 > far2) { s._apply(false); continue; }
          s._score = Math.sqrt(d2) / pw;
          cand.push(s);
          total++;
        }
      }
      for (let k = 0; k < e.crowds.length; k++) {
        const c = e.crowds[k];
        if (!c.want) { c._apply(false); continue; }
        wanted += c.count;
        const d2 = c.pos.distanceToSquared(pp);
        if (d2 > far2) { c._apply(false); continue; }
        c._score = Math.sqrt(d2) / w;
        cand.push(c);
        total += c._size;
      }
    }
    const B = runtime.budget;
    let shown = 0;
    if (total > B) {
      cand.sort(byScore);
      let left = B;
      for (let i = 0; i < cand.length; i++) {
        const x = cand[i];
        const n = Math.min(x._size, left);
        if (n >= 1) { x._apply(true, n); left -= n; shown += n; } else x._apply(false);
      }
    } else {
      for (let i = 0; i < cand.length; i++) cand[i]._apply(true, cand[i]._size);
      shown = total;
    }
    runtime.stats.figures = shown;
    runtime.stats.wanted = wanted;
    runtime.stats.budget = B;
  }

  remap();
  // initialise every choreo now (pools spawned hidden) and warm their figures on the first frame
  for (const e of entries) if (!e.failed && !e.inited) init(e);
  // the heavy per-date plans: steps of the boot's plan job, in the order they read one another's (planRank)
  ranked = entries.filter((e) => e.inited && !e.failed && Number.isFinite(e.mod.planRank) && typeof e.mod.plan === 'function')
    .sort((a, b) => a.mod.planRank - b.mod.planRank);
  for (const s of planStepsList()) plans.add(s.id, s.fn);
  plans.seal();
  // ?planjob=0: plan the day here, in init, as before the job (an A/B switch for boot measurements)
  if (ctx.params?.raw?.get?.('planjob') === '0') { plans.ready = true; plans.flush(); }
  // after the first image; a screenshot boot (shot=1, the dev tests) plans it all at once then
  ctx.bus.on('firstFrame', () => { if (ctx.params?.shot) { plans.ready = true; plans.seal(); plans.flush(); } else plans.start(); });
  warmPending = entries.some((e) => e.pools.length > 0);
  offUpdate = ctx.engine.onUpdate(() => update(), PRIORITY.sim);
  return runtime;
}
