// The continuous stream of individuals' offerings between the two temidim (G5). Events served (schedule.js, choreo
// 'private-offerings'): private-offerings, kayitz-hamizbeach, private-flaying, altar-blood, altar-limbs, bird-offerings,
// meal-offerings, tenufah, notar-burning (and bikkurim-late, reference-only: a bringer is staged when offeringWindows
// opens the bikkurim lane by the Hebrew date).
//
// A deterministic generator (g5/plan.js) reads src/data/offerings.js — offeringWindows() for the window and lanes, the
// day's mix from OFFERING_RULES.frequency.alone and the sets with ONE seeded day quantile, each type's steps with their
// minutes, stations, actors and props — and lays every offering of the day into a lane (ring + hook + marble table), a
// bird lane or a meal lane, with every figure's timeline (g5/track.js). This module only evaluates those timelines at t,
// so a jump to any minute re-poses everything at once; cues (captions of the confession, the bleat at the binding, the
// doves at the gate, the libation's wine…) fire only as continuous play crosses them.
//
// Each offering in progress is also a watchable sub-event of the schedule (g5/dynamic.js via ctx.schedule.addSource):
// listed under its stage's event in "Happening now" and counted on the map, with a spot to watch it from.
import { buildGeo } from './g5/geo.js';
import { buildPlan, POOLS } from './g5/plan.js';
import { segAt, sampleSeg, phaseOf, HOLD, WALK, CARRIED } from './g5/track.js';
import { createSource } from './g5/dynamic.js';
import { crossed, cueAt } from '../lib/cue.js';
import { upperBound, clamp, smooth } from '../lib/core.js';
import { angleDiff } from '../lib/path.js';
import { m2w } from '../../core/units.js';

const SEED = 0x6735;
const TURN_RATE = 240;       // degrees per real second: figures turn to a new heading, never snap (except on jumps)
const HUNG = ['lamb_hung', 'carcass_flaying', 'carcass_hung'];
const CAGES = ['bird_cage', 'bird_cage_pigeons'];
const LANES = 6, BIRD_LANES = 3;

export default {
  id: 'private-offerings',
  lead: 2,
  lag: 8,             // owners carrying their meat out through Ezrat Nashim after the last fats are on the fire

  init(ctx, events, sim) {
    const G = buildGeo(ctx);
    sim.setBounds([60, 236, -2], [412, 425, 40]);
    const pools = {};
    const imp = { kohen: 2, israelite: 2, kohen_offduty: 2, nazir: 2, levi: 1, lamb: 2, ram: 2, goat: 2 };
    for (const [name, n] of Object.entries(POOLS)) {
      const animal = ['lamb', 'ram', 'goat'].includes(name);
      pools[name] = sim.pool({ name: `g5-${name}`, ...(animal ? { animal: name } : { role: name }), count: n, seed: SEED + name.length * 131 + n, importance: imp[name] || 1, prop: animal ? undefined : null });
    }
    const state = {
      G, pools, plan: null, planKey: '', planGen: -1, free: null, propsOn: new Set(), fires: new Map(),
      o: {}, tmp: {}, fmt: (m) => ctx.time?.format?.(m) ?? '--', lastMs: 0,
    };
    // free props: the hung carcass stages at each lane's hook, a bird cage per bird lane, the bikkurim basket
    state.free = spawnFree(ctx);
    // the watchable instances, for the schedule (additive API: ctx.schedule.addSource)
    state.source = createSource(ctx, () => getPlan(ctx, state, sim));
    try { ctx.schedule?.addSource?.(state.source); } catch (e) { console.warn('[sim:g5] schedule source failed', e); }
    // build the current date's plan now (behind the loader) rather than in the first frame that needs it
    try { getPlan(ctx, state, sim); } catch (e) { console.error('[sim:g5] plan failed', e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const P = getPlan(ctx, state, sim);
    if (!P?.ok) { hideFree(state); return; }
    const forced = sim.forced;
    // ---- figures: each pool slot's timeline at t
    for (const pool in P.slotTracks) {
      const lists = P.slotTracks[pool];
      const ap = state.pools[pool];
      if (!ap) continue;
      for (let i = 0; i < lists.length; i++) {
        const list = lists[i];
        if (!list.length) continue;
        const tr = trackAt(list, t);
        if (!tr) continue;
        const slot = ap.slot(i);
        if (!sim.due(slot)) continue;
        poseSlot(ctx, state, P, slot, tr, t, dt, forced);
      }
    }
    // ---- free props (hung carcasses, cages, the basket), fires, cues
    poseFree(state, P, t);
    setFires(state, sim, P, t);
    cues(ctx, state, sim, P);
  },

  release(ctx, state) { hideFree(state); },

  /**
   * The day's plan, for other choreos through sim.planOf('private-offerings'): built now if it is not yet. Contracts
   * read by G4 (nikanor-stations, g4/sets.js): P.ok, P.counts (the day's counts of every type, the sets included),
   * P.insts (each with job.set, and s: the kohen takes a bird pair at Sha'ar Nikanor at inst.s + 0.5), P.hot (the shared
   * places' bookings), P.G (the court geometry).
   */
  plan(ctx, state, sim) { return getPlan(ctx, state, sim); },

  debug(s) {
    const P = s.plan;
    if (!P) return 'no plan';
    if (!P.ok) return `no individual offerings today (${P.D?.dayType})`;
    const by = {};
    for (const x of P.insts) by[x.type] = (by[x.type] || 0) + 1;
    const dr = Object.entries(P.dropped).map(([k, v]) => `${k}×${v}`).join(' ');
    return `q ${P.q.toFixed(2)} · ${P.insts.length} offerings ${s.fmt(P.win.a)}–${s.fmt(P.win.endAll)}: ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ')}`
      + `${dr ? `\n   not fitted: ${dr}` : ''}${P.missing ? ` · ${P.missing} figures over the pools` : ''} · plan ${P.ms?.toFixed(0)} ms`;
  },
};

// ------------------------------------------------------------------------------------------------ the plan
function getPlan(ctx, state, sim) {
  const key = `${ctx.time?.dateString}|${ctx.time?.dayType}`;
  if (state.plan && state.planKey === key && state.planGen === sim.generation) return state.plan;
  if (state.building) return state.plan;           // re-entry (a schedule lookup during the build)
  state.building = true;
  const t0 = performance.now();
  const ev = (id) => { const e = sim.event(id); return e && Number.isFinite(e.t0) ? e : null; };
  let P;
  try { P = buildPlan(ctx, state.G, ev); } catch (e) { console.error('[sim:g5] plan failed', e); P = { ok: false, insts: [] }; }
  P.ms = performance.now() - t0;
  // by role, for leads (an animal's rope in its owner's hand)
  for (const inst of P.insts || []) { inst.byRole = {}; for (const tr of inst.tracks) inst.byRole[tr.role] = tr; inst.kayitz = !!inst.job?.kayitz; }
  state.plan = P; state.planKey = key; state.planGen = sim.generation;
  state.building = false;
  return P;
}

/** the track of one pool slot that holds t (tracks in a slot never overlap) */
function trackAt(list, t) {
  let lo = 0, hi = list.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m].t0 <= t) { k = m; lo = m + 1; } else hi = m - 1; }
  if (k < 0) return null;
  const tr = list[k];
  return t < tr.t1 ? tr : null;
}

// ------------------------------------------------------------------------------------------------ posing
function poseSlot(ctx, state, P, slot, tr, t, dt, forced) {
  const segs = tr.segs;
  let k = segAt(segs, t);
  if (k < 0) {
    // between two segments of the same figure (should not happen): hold the last one's end
    k = Math.max(0, upperBound(segs.map((s) => s.t0), t) - 1);
  }
  const s = segs[k];
  const o = sampleSeg(s, t, state.o, state.tmp);
  if (s.kind === CARRIED) slot.place(o.X, o.Y, o.Z + o.up);
  else if (o.near) slot.placeNear(o.X, o.Y, o.Z);
  else slot.place(o.X, o.Y, o.Z);
  // turn toward the wanted heading at a natural rate; snap after a jump
  let h = o.h;
  const sw = s.sway;
  if (sw) h = (h + sw.amp * (0.62 * Math.sin(t / sw.p + sw.a) + 0.38 * Math.sin(t / sw.q + sw.b)) * smooth(s.t0, s.t0 + 0.3, t) * (1 - smooth(s.t1 - 0.2, s.t1, t)) + 360) % 360;
  if (!forced && Number.isFinite(slot._hs) && dt > 0) {
    const d = angleDiff(slot._hs, h);
    const max = TURN_RATE * dt;
    h = Math.abs(d) <= max ? h : (slot._hs + Math.sign(d) * max + 360) % 360;
  }
  slot._hs = h;
  slot.heading(h);
  let ph;
  if (s.ph?.k === 'walk') ph = walkPhase(ctx, slot, s.pose, o.d);
  else ph = phaseOf(s, t);
  slot.pose(s.pose, ph);
  if (s.kind !== CARRIED && slot._pkey !== s.pkey) setProps(slot, s.prop, s.hand, s.prop2, s.pkey);
  // an animal on its owner's rope
  if (tr.pool === 'lamb' || tr.pool === 'ram' || tr.pool === 'goat') {
    const lt = s.lead ? tr.inst.byRole?.[s.lead] : null;
    const leader = lt && lt.slot >= 0 && t >= lt.t0 && t < lt.t1 ? state.pools[lt.pool]?.slot(lt.slot)?.actor : null;
    if (slot._lead !== leader) { slot._lead = leader; slot.actor?.setLead?.(leader || null); }
  }
  slot.show();
}

function setProps(slot, prop, hand, prop2, key) {
  slot._pkey = key;
  const a = slot.ensure();
  if (prop2) a.setProps?.(prop, prop2);
  else { a.setProps?.(null, null); a.setProp(prop || null, hand || 'right'); }
  slot._prop = prop || null; slot._hand = hand || 'right';
}

function walkPhase(ctx, slot, pose, meters) {
  const f = ctx.people?.util?.phaseFor;
  if (f && slot.actor) return f(slot.actor, pose, Math.max(0, meters));
  const p = Math.max(0, meters) / 1.45;
  return p - Math.floor(p);
}

// ------------------------------------------------------------------------------------------------ free props
function spawnFree(ctx) {
  const P = ctx.people;
  const mk = (name) => {
    let a = null;
    try { a = P?.spawnProp?.(name, { seed: SEED }); } catch { a = null; }
    a?.setVisible?.(false);
    return a ? { a, on: false, key: '' } : null;
  };
  const f = { hung: {}, cage: {}, basket: [mk('basket')] };
  for (const n of HUNG) f.hung[n] = Array.from({ length: LANES }, () => mk(n));
  for (const n of CAGES) f.cage[n] = Array.from({ length: BIRD_LANES }, () => mk(n));
  f.list = [...Object.values(f.hung).flat(), ...Object.values(f.cage).flat(), ...f.basket].filter(Boolean);
  return f;
}
function freeOf(state, p) {
  const F = state.free;
  if (p.kind === 'hung') return F.hung[p.name]?.[p.lane];
  if (p.kind === 'cage') return F.cage[p.name]?.[p.lane];
  if (p.kind === 'basket') return F.basket[0];
  return null;
}
function poseFree(state, P, t) {
  const on = state._on || (state._on = new Set());
  on.clear();
  for (const p of P.props) {
    if (p.t0 > t) break;
    if (t >= p.t1) continue;
    const f = freeOf(state, p);
    if (!f) continue;
    on.add(f);
    if (f.key !== p.key) { f.key = p.key; f.a.setSite(p.at[0], p.at[1], p.at[2]); f.a.setHeading(p.h); }
    if (!f.on) { f.on = true; f.a.setVisible(true); }
  }
  for (const f of allFree(state)) if (f.on && !on.has(f)) { f.on = false; f.a.setVisible(false); }
}
function allFree(state) { return state.free?.list || []; }
function hideFree(state) { for (const f of allFree(state)) if (f.on) { f.on = false; f.a.setVisible(false); } }

// ------------------------------------------------------------------------------------------------ fires
/**
 * The notar fire on the ash place east of the ramp, the court's hearth while meal-offerings are fried or baked: this
 * module's wants (sim.fireWant — courts-daily wants the same hearth for the kohanim's meal; the larger wins).
 */
function setFires(state, sim, P, t) {
  const want = state.fires;
  want.clear();
  for (const f of P.fires) {
    if (t < f.t0 - 0.01 || t >= f.t1 + (f.fadeOut || 0.4)) continue;
    const fi = f.fadeIn || 0.3, fo = f.fadeOut || 0.4;
    // up as it is lit, down over fadeOut as the last of it burns away
    const v = f.v * smooth(f.t0, f.t0 + fi, t) * (1 - smooth(f.t1, f.t1 + fo, t));
    if (v > 0) want.set(f.id, sim.fireWant(f.id, clamp(v)));
  }
}

// ------------------------------------------------------------------------------------------------ cues
function cues(ctx, state, sim, P) {
  const c = sim.crossing;
  if (!c?.ok || !P.cues.length) return;
  const from = c.from, to = c.from + c.span;
  for (let i = upperBound(P.cueT, from); i < P.cues.length && P.cues[i].t <= to + 1e-9; i++) {
    const q = P.cues[i];
    if (!crossed(state, q.t)) continue;
    cueAt(state, `${q.key || q.id}:${q.inst.id}`, q.t, () => {
      const d = distTo(ctx, q.pos);
      if (q.kind === 'sound') { if (d < 90) sim.sound(q.id, q.pos, q.opts); }
      else if (d < (q.range || 30)) sim.caption(q.text, { id: `g5-${q.key}`, duration: 6, pos: m2w(q.pos[0], q.pos[1], q.pos[2] ?? 16) });
    });
  }
}
function distTo(ctx, p) {
  const pp = ctx.player?.position || ctx.camera?.position;
  if (!pp || !p) return Infinity;
  const w = m2w(p[0], p[1], p[2] ?? 16);
  return Math.hypot(pp.x - w.x, pp.z - w.z, (pp.y - w.y) * 0.5);
}

export { HOLD, WALK };
