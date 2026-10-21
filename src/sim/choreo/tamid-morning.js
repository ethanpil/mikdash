// The morning tamid (Tamid 3:3–4:3, 7:3; Yoma 33a; Arachin 2:5; Middot 3:5, 4:7; report Part IV §11, lock #16, #18).
//
// Events served (choreo 'tamid-morning'):
//   lamb-brought     "Go and bring a lamb from the lamb chamber": two kohanim out of Lishkat HaGazit, through the wicket into
//                    Beit HaMoked, a lamb chosen and led out to the Azarah by the Moked gate (Tamid 3:3).
//   vessels          four kohanim bring the vessels out of Lishkat HaKelim, two at a time in their hands: to the silver
//                    table west of the ramp (Shekalim 6:4) and the slaughter vessels to a marble table in the
//                    slaughterhouse ⚙ (Tamid 3:4); one lights the dark chamber with a torch (not on Shabbat).
//   lamb-watered     water from a gold cup; inspected again by torchlight; drawn to the slaughterhouse, the limb-winners
//                    after him (Tamid 3:4–5). The slaughterer brings the knives from Beit HaChalifot (Middot 4:7).
//   tamid-slaughter  bound akedah-fashion at the NW second ring, head south, face west, held by the limb-winners; the
//                    slaughterer east of it facing west; the receiver catches the blood (Tamid 4:1).
//   tamid-blood      NE corner, SW corner, the rest on the southern yesod (Tamid 4:1).
//   flaying          hung on a hook of the dwarf pillars, flayed, cut in the Mishnah's order, each part handed to its
//                    winner; the innards rinsed on a marble table; all stand in a row (Tamid 4:2–3).
//   limbs-to-ramp    the nine in a row to the lower half of the ramp, west side; laid down and salted; then to the Gazit
//                    for the Shema (Tamid 4:3).
//   limbs-up         the winners of the fourth lottery (lotteries.js's Gazit men 11–18) come from the Gazit, carry the
//                    limbs up the ramp's east side and throw them on the great pile; then the minchah and the chavitin
//                    (Tamid 5:2, 7:3; Yoma 33a). The parts stay on the fire for hours (altar-night's convention ⚙).
// The module is `always`: it keeps the lamb chamber's lambs (no fewer than six, Arachin 2:5), the vessels set out on the
// silver and marble tables until they go back in the evening ⚙, the salt on the ramp (Menachot 21b) and both temidim's
// limbs on the fire. Every pose is a pure function of (t, date); the shared builder (g2/tamid.js) lays out both temidim.
import { Script, runScripts, FreeProps, setLead, playerNear, phaseFn, evalScript, jit, SPEED, within, wrap, since } from './g2/lib.js';
import { places } from './g2/places.js';
import { buildTamid, planAfternoon, limbsUp, kohenGadol, pileItems, tamidWindows, cfgFor, lambSpots, vesselTable, buildReturn,
  silverSlot, VESSEL_LOADS, RETURN_TRIPS, CREW, CREW_N, SEEDS } from './g2/tamid.js';
import { cueAt, crossed } from '../lib/cue.js';
import { window4, rand } from '../lib/core.js';

const NEAR = 45;            // m — captions for what can be seen and heard close by
const WICKET = 'azarah.gate.moked.pishpash';
const LIMB_BURNS = 240;     // minutes a limb stays visible on the fire (= altar-night.js) ⚙
const N_UP = 8;             // the fourth lottery's: the six limbs, the flour, the chavitin (lotteries' Gazit men 11–18)

export default {
  id: 'tamid-morning',
  always: true,
  importance: 3,

  init(ctx, events, sim) {
    const P = places(ctx);
    sim.setBounds([80, 265, 0], [256, 405, 30]);
    const state = {
      P,
      crew: sim.pool({ name: 'crew', role: 'kohen', count: CREW_N, seed: SEEDS.morning, importance: 3 }),
      fetch: sim.pool({ name: 'fetchers', role: 'kohen', count: 2, seed: SEEDS.morning + 50, importance: 2 }),
      bearers: sim.pool({ name: 'vessel-bearers', role: 'kohen', count: 4, seed: SEEDS.morning + 60, importance: 2 }),
      up: sim.pool({ name: 'limbs-up', role: 'kohen', count: N_UP, seed: SEEDS.up, importance: 2 }),
      lambs: sim.pool({ name: 'lambs', animal: 'lamb', count: 8, seed: SEEDS.lambs, importance: 1 }),
      // Shabbat: the Kohen Gadol and the segan at the limbs (Tamid 7:3; Rambam KhM 5:12)
      kg: sim.pool({ name: 'kohen-gadol', role: 'kohen_gadol', count: 1, seed: 0x6b67, importance: 3 }),
      segan: sim.pool({ name: 'segan', role: 'segan', count: 1, seed: 0x7367, importance: 3 }),
      props: new FreeProps(ctx),
      wicket: sim.door(WICKET),
      plan: null, planGen: -1, out: {}, fns: { crew: [], fetch: [], bearers: [], up: [], lamb: [], kg: [], segan: [] },
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
    };
    // the per-date plan now, behind the loader (it is rebuilt on a new date)
    try { plan(ctx, sim, state); } catch (e) { console.warn(`[sim] ${sim.id} plan at init failed`, e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, sim, state);
    if (!P) return;
    const S = state, out = S.out;
    runScripts(ctx, S.crew, P.M.crew, t, out, S.fns.crew);
    runScripts(ctx, S.fetch, P.M.fetch, t, out, S.fns.fetch);
    runScripts(ctx, S.bearers, P.V, t, out, S.fns.bearers);
    runScripts(ctx, S.up, P.U, t, out, S.fns.up);
    if (P.KG) { runScripts(ctx, S.kg, [P.KG.kg], t, out, S.fns.kg); runScripts(ctx, S.segan, [P.KG.segan], t, out, S.fns.segan); }
    lambs(ctx, S, P, t);
    S.props.update(t);
    // the wicket stands open while they fetch the lamb through it (Middot 1:7; Tamid 3:3) ⚙
    let a = 0;
    for (const w of P.wicket) { const L = since(w[1], w[0]); if (within(t, w[0], w[1])) a = Math.max(a, window4(since(t, w[0]), 0, 0.12, L - 0.12, L)); }
    if (a > 0) S.wicket.set(a);
    cues(ctx, S, P, sim);
  },

  /** the day's plan, for sim.planOf('tamid-morning'): read by gazit-shema.js (M.t.gazitIn — each man's arrival in the Gazit) */
  plan(ctx, state, sim) { return plan(ctx, sim, state); },

  debug(s) {
    const P = s.plan, f = s.fmt;
    if (!P) return 'no plan';
    const T = P.M.t;
    const warn = [...P.M.crew, ...P.M.fetch, ...P.V, ...P.U, P.M.lamb].flatMap((x) => x?.warn || []);
    return `lamb out ${f(T.leadOut)} · water ${f(T.water[0])} · bind ${f(T.bind)} · cut ${f(T.tCut)} · throw ${f(T.throw1)}/${f(T.throw2)} · hang ${f(T.cuts.hang)} · row ${f(T.cuts.row)} · laid ${f(T.laid[0])} · props ${s.props.shown}/${s.props.count}${warn.length ? `\n   ⚠ ${warn.slice(0, 4).join(' · ')}` : ''}`;
  },
};

function plan(ctx, sim, state) {
  if (state.plan && state.planGen === sim.generation) return state.plan;
  const P = state.P, Z = P.Z, R = P.ramp;
  const Wall = tamidWindows(ctx, sim);
  const M = buildTamid(ctx, P, cfgFor('morning', ctx, P, Wall));
  const PA = planAfternoon(ctx, P, Wall);
  const A = PA.A;
  const ret = buildReturn(P, Wall.a.up[1]);
  const VT = vesselTable(P);
  const items = [...M.items];
  const gz = P.gazit;

  // ---------------------------------------------------------------------------------------------- the vessels (Tamid 3:4)
  // Three kohanim carry, two vessels a trip, to the silver table west of the ramp (Shekalim 6:4) and the slaughter
  // vessels to a marble table in the slaughterhouse ⚙; a fourth lights the dark chamber with a torch (before dawn ⚙)
  // and hands them out from the shelves by the door.
  const V = [];
  const placed = [];       // { name, table, slot, t, at, h }
  {
    const [v0] = Wall.m.fetch;     // 'vessels' shares lamb-brought's window
    const K = P.kelim;
    const north = [gz.door, ...P.way.gazitToNW.slice(0, 3), [200, 386.4, Z]];
    // the duchan's steps between Ezrat Kohanim (16) and Ezrat Yisrael (13.5) are stairs: those legs query the floor
    const toKelim = [...north, [232, 386.6, Z], [240.6, 388.6, Z]];
    const downIn = [[243.0, 388.6, 15], [245.2, 388.6, K.ZY], K.out, K.door, K.in];
    const outKelim = [K.door, K.out, [245.2, 386, K.ZY], [243.0, 385.2, 15], [241.4, 384.4, Z]];
    const intoKelim = [[243.0, 385.2, 15], [245.2, 386, K.ZY], K.out, K.door, K.in];
    const ts = P.tables.silver, sStand = P.tables.silverStand;
    const toSilver = [[P.way.eastLine, 372, Z], ...P.way.eastBend, [231.2, 273.2, Z], [208.0, 273.4, Z], [sStand[0] + 0.5, ts.min[1] - 1.6, Z], sStand];
    const fromSilver = [[sStand[0] + 0.5, ts.min[1] - 1.6, Z], [208.0, 273.4, Z], [231.2, 273.2, Z], ...[...P.way.eastBend].reverse(), [P.way.eastLine, 372, Z], [241.4, 384.4, Z]];
    const mStand = [VT.stand[0] - 0.4, VT.stand[1] + 0.3, Z];
    const shelf = (k, j) => [K.in[0] + [-2.4, 2.4, -1.2][k] + (j % 2 ? 0.6 : 0), K.in[1] + [4.0, 4.0, 2.6][k] + (j % 2 ? 0.8 : 0), K.ZY];
    const takeIn = (s, k, j, props) => {
      s.walk([shelf(k, j)], { speed: SPEED.slow });
      s.act(0.12, { pose: 'bow', phase: [0, 0.4], heading: 0 });
      s.act(0.3 + 0.08 * k, { pose: 'bow', phase: 0.45, heading: 0 });
      s.act(0.1, { pose: 'bow', phase: [0.7, 1], heading: 0, props });
      s.walk([K.in], { speed: SPEED.slow, props });
    };
    const backGazit = [...[...north].reverse(), gz.inside];
    VESSEL_LOADS.forEach((loads, k) => {
      const s = Script.from(v0 + 0.12 * k, gz.inside, 90, `vessels${k}`).exact();
      s.walk(toKelim, { speed: SPEED.walk });
      s.walk(downIn, { speed: SPEED.slow, zExact: false });
      loads.forEach((ld, j) => {
        if (j > 0) s.walk(intoKelim, { speed: SPEED.slow, zExact: false });
        takeIn(s, k, j, ld.props);
        s.walk(outKelim, { speed: SPEED.slow, props: ld.props, zExact: false });
        if (ld.to === 'silver') {
          s.walk(toSilver, { speed: SPEED.carry, props: ld.props });
          s.act(0.1, { pose: 'bow', phase: [0, 0.4], heading: 270, props: ld.props });
          ld.q.forEach((q, n) => placed.push({ name: ld.props[n], table: 'silver', slot: q, t: s.now(), at: silverSlot(P, q), h: 90 }));
          s.act(0.1, { pose: 'bow', phase: [0.7, 1], heading: 270 });
          if (j < loads.length - 1) s.walk(fromSilver, { speed: SPEED.walk });
        } else {
          s.walk([[234.5, 378.8, Z], [VT.stand[0] + 3, 376.6, Z], mStand], { speed: SPEED.carry, props: ld.props });
          s.act(0.1, { pose: 'bow', phase: [0, 0.4], heading: 180, props: ld.props });
          for (const n of ld.q) placed.push({ name: n, table: 'marble', slot: n, t: s.now(), at: VT[n], h: 90 });
          s.act(0.1, { pose: 'bow', phase: [0.7, 1], heading: 180 });
          if (j < loads.length - 1) s.walk([[VT.stand[0] + 3, 376.6, Z], [234.5, 378.8, Z], [241.4, 384.4, Z]], { speed: SPEED.walk });
        }
      });
      if (s.cur[1] < 300) s.walk([[sStand[0], ts.min[1] - 1.6, Z], ...P.way.westUp.slice(1), [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk });
      else s.walk([[VT.stand[0] - 6, 376.4, Z], [VT.stand[0] - 6, 382.2, Z], [VT.stand[0] - 6, 386.4, Z], ...backGazit], { speed: SPEED.walk });
      V.push(s);
    });
    // the torch-bearer: lighting the shelves by the door until the others are done (on Shabbat no light in hand — Rambam
    // BhB 8:12 ⚙ analogy: they take the vessels out by the lamps' light)
    {
      const lamp = ctx.time?.dayType === 'shabbat' ? [null, null] : ['torch', null];
      const lp = lamp[0] ? 'torch_walk' : 'walk';
      const s = Script.from(v0 + 0.05, gz.inside, 90, 'vessels3').exact();
      s.walk(toKelim, { speed: SPEED.walk, pose: lp, props: lamp });
      s.walk(downIn, { speed: SPEED.slow, pose: lp, props: lamp, zExact: false });
      const tOut = Math.max(...V.map((x) => x.tEnd)) - 3.2;
      let j = 0;
      while (s.now() < tOut - 0.8) {
        const sp = [K.in[0] + (j % 3 - 1) * 0.9, K.in[1] + 1.2 + (j % 2) * 0.7, K.ZY];
        s.walk([sp], { speed: SPEED.slow, pose: lp, props: lamp });
        s.until(Math.min(tOut, s.now() + 0.9), { pose: lamp[0] ? 'torch' : 'bow', phase: lamp[0] ? null : 0.45, heading: j % 2 ? 330 : 30, props: lamp });
        j++;
      }
      s.walk([K.in], { speed: SPEED.slow, pose: lp, props: lamp });
      s.walk(outKelim, { speed: SPEED.slow, pose: lp, props: lamp, zExact: false });
      s.walk([[234.5, 380.4, Z], [VT.stand[0] - 6, 380.4, Z], [VT.stand[0] - 6, 386.4, Z], ...backGazit], { speed: SPEED.walk, pose: lp, props: lamp });
      V.push(s);
    }
  }
  // each vessel on its table from when it is set down until it goes back, except while in use (morning and afternoon)
  const useOf = (n) => [...(M.use[n] || []), ...(A.use[n] || [])].filter((u) => Number.isFinite(u[0]) && Number.isFinite(u[1])).sort((a, b) => a[0] - b[0]);
  const backAt = (pl) => {
    const tr = RETURN_TRIPS[pl.table].findIndex((list) => list.includes(pl.slot));
    return ret.pick[pl.table][Math.max(0, tr)];
  };
  for (const pl of placed) {
    const end = backAt(pl);
    let a = pl.t;
    // only the marble table's vessels are taken into use (the slaughter vessels — g2/tamid.js); unwrapped same-day times
    for (const [u0, u1] of pl.table === 'marble' ? useOf(pl.name) : []) {
      if (u0 > a) items.push({ name: pl.name, show: [wrap(a), wrap(u0)], keys: [{ t: wrap(a), X: pl.at[0], Y: pl.at[1], Z: pl.at[2], h: pl.h }] });
      a = Math.max(a, u1);
    }
    if (end > a) items.push({ name: pl.name, show: [wrap(a), wrap(end)], keys: [{ t: wrap(a), X: pl.at[0], Y: pl.at[1], Z: pl.at[2], h: pl.h }] });
  }

  // ---------------------------------------------------------------------------------------------- limbs up (Tamid 5:2; Yoma 33a)
  // the winners of the fourth lottery come from Lishkat HaGazit (where they won it) and wait south of the ramp's foot ⚙;
  // by the north passage and the east of the court, not across the Ulam's steps while the kohanim bless the people there
  const [u0] = Wall.m.up;
  const waitUp = (k) => [R.west - 1.4 + 1.15 * (k % 4) + jit(0x7570, 0.25, 'x', k), R.foot - 2.3 - 1.05 * Math.floor(k / 4) + jit(0x7570, 0.2, 'y', k), Z];
  const U = [];
  for (let k = 0; k < N_UP; k++) {
    const route = [gz.door, ...P.way.gazitToNW.slice(0, 3), [200, 386.4, Z], [P.way.eastLine, 386.4, Z], ...P.way.eastBend, [233.5, 271.8, Z], waitUp(k)];
    const s = Script.from(u0 - 3.6 + 0.11 * k, gz.inside, 90, `up${k}`).exact();
    s.walk(route, { speed: SPEED.walk + 0.03 * (k % 3) });
    s.act(0.1, { pose: 'stand', face: [R.mid, R.halfY] });
    U.push(s);
  }
  // the limbs first, then the minchah, then the chavitin (Yoma 33a) ⚙ spacing
  const order = [0, 1, 2, 3, 4, 5, 6, 7];
  const shabbat = ctx.time?.dayType === 'shabbat';
  let up, KG = null;
  if (shabbat) {
    // the Kohen Gadol offers on Shabbat (Rambam KhM 5:12): the limbs are handed to him at the head of the ramp (Tamid 7:3)
    KG = kohenGadol(P, M, U, Wall.m.up, null);
    up = KG.up;
    limbsUp(P, M, U, [6, 7], [u0 + 8.3, u0 + 9.4], null, up);
  } else {
    const times = [0.15, 0.95, 1.75, 2.55, 3.35, 4.15, 5.6, 6.8].map((x) => u0 + x);
    up = limbsUp(P, M, U, order, times, null);
  }
  for (const k of order) U[k].walk([[R.west, R.foot - 2.2, Z], ...P.way.westUp, [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk });
  // the parts on the ramp until each is taken up; the wine until the libation
  const wineEnd = Wall.m.wine ? Wall.m.wine[0] + 0.5 : u0 + 13;
  for (const it of items) {
    if (it.part == null) continue;
    const end = it.part === 8 ? wineEnd : up.picks[it.part];
    it.show = [wrap(it.show[0]), wrap(end ?? u0 + 2)];
    it.keys = it.keys.map((k) => ({ ...k, t: wrap(k.t) }));
  }
  for (const it of items) if (it.part == null) { it.show = it.show.map(wrap); it.keys = it.keys.map((k) => ({ ...k, t: wrap(k.t) })); }
  // both temidim's limbs on the great pile from their throw (Tamid 7:3), burning for hours ⚙ — this module is always
  // relevant, so the afternoon's stay after tamid-afternoon's window
  for (const it of [...pileItems(P, M, up.tossAt, LIMB_BURNS, 0), ...pileItems(P, A, PA.up.tossAt, LIMB_BURNS, 1)]) {
    items.push({ ...it, show: it.show.map(wrap), keys: it.keys.map((k) => ({ ...k, t: wrap(k.t) })) });
  }
  // the salt kept on the ramp, always ⚙
  const salt = cfgFor('morning', ctx, P, Wall).salt;
  items.push({ name: 'salt', show: null, keys: [{ t: 0, X: salt[0], Y: salt[1], Z: salt[2], h: 20 }] });
  state.props.setPlan(items);

  // ---------------------------------------------------------------------------------------------- the lamb chamber
  const z = ctx.time?.zmanim || {};
  const sunset = z.sunset ?? 1009, sunrise = z.sunrise ?? 356;
  const LS = lambSpots(P);
  const idle = (spot, tEnd, name, seed) => {
    // brought in, inspected, the evening before ⚙: lying at night, up by day
    const s = Script.from(sunset + 5, spot, spot[3], name).exact();
    let end = tEnd;
    while (end < sunset + 6) end += 1440;
    const dawn = sunrise + 1440;
    if (end > dawn) {
      s.until(dawn - 25, { pose: 'lie', heading: spot[3] });
      s.until(end, { pose: 'stand', heading: spot[3], sway: 18, seed });
    } else {
      s.until(end - 1.5, { pose: 'lie', heading: spot[3] });
      s.until(end, { pose: 'stand', heading: spot[3], sway: 10, seed });
    }
    return s;
  };
  const lambIdle = [idle(LS.morning, M.lamb.t0, 'lamb-m', 31), idle(LS.afternoon, A.lamb.t0, 'lamb-a', 37)];

  const T = M.t;
  const P2 = {
    M, A, V, U, ret, lambIdle, LS, sunset, sunrise, KG,
    wicket: [[Wall.m.fetch[0] + 0.6, T.atWater + 0.4]].map((w) => [wrap(w[0]), wrap(w[1])]),
    leads: M.leads.map(([a, b, who]) => [wrap(a), wrap(b), who]),
    cue: {
      bleat: wrap(T.ledFrom + 0.1), drink: wrap(T.drink[0] + 0.1), vessels: wrap(Wall.m.fetch[0] + 0.55), struggle: wrap(Math.max(T.struggle, Wall.m.slaughter[0] + 0.5)),
      cut: wrap(T.tCut + 0.05), throw1: wrap(T.throw1), throw2: wrap(T.throw2), pour: wrap(T.pour), hang: wrap(Math.max(T.cuts.hang, Wall.m.flay[0] + 0.5)),
      row: wrap(T.cuts.row), laid: wrap(Math.max(T.laid[0], Wall.m.carry[0] + 0.5)), salted: wrap(T.salted), toss: wrap(Math.max(KG ? up.tossAt[6] ?? up.tossAt[0] : up.tossAt[0], u0 + 0.55)),
    },
    near: { chamber: [203, 395, 16], water: M.lambWater, ring: M.ring, hook: M.hook, ramp: [212, 284, 18], kelim: P.kelim.out, altar: [217, 321, 25] },
  };
  state.plan = P2;
  state.planGen = sim.generation;
  return P2;
}

/** the lambs of the chamber: the day's two tamid lambs and the six kept with them (Arachin 2:5) */
function lambs(ctx, S, P, t) {
  const out = S.out;
  // slot 0: the morning tamid lamb — in the chamber, then the service
  const s0 = S.lambs.slot(0);
  if (!S.fns.lamb[0]) S.fns.lamb[0] = phaseFn(ctx, s0);
  evalScript(P.lambIdle[0], t, out, null);
  if (!out.vis) evalScript(P.M.lamb, t, out, S.fns.lamb[0]);
  if (out.vis) {
    if (out.zx) s0.place(out.X, out.Y, out.Z); else s0.placeNear(out.X, out.Y, out.Z);
    s0.heading(out.h).pose(out.pose, out.ph).show();
  }
  let lead = null;
  for (const [a, b, who] of P.leads) if (within(t, a, b)) lead = who === 'fetch' ? S.fetch.slot(0) : S.crew.slot(CREW.S);
  setLead(s0, lead);
  // slot 1: the afternoon's lamb, waiting in the chamber until tamid-afternoon leads it out (same seed and slot there)
  const s1 = S.lambs.slot(1);
  evalScript(P.lambIdle[1], t, out, null);
  if (out.vis) s1.place(out.X, out.Y, out.Z).heading(out.h).pose(out.pose, out.ph).show();
  // the six: lying at night, by day standing, lying or at the manger, changing every half hour or so ⚙
  const night = !within(t, wrap(P.sunrise - 20), wrap(P.sunset + 10));
  for (let i = 0; i < 6; i++) {
    const sp = P.LS.flock[i];
    const sl = S.lambs.slot(2 + i);
    let pose = 'lie', h = sp[3];
    if (!night) {
      const block = Math.floor((t + 37 * i) / 33);
      const r = rand(0x6c, i, block);
      pose = r < 0.45 ? 'stand' : r < 0.7 ? 'lie' : 'graze';
      h = sp[3] + (rand(0x6d, i, block) - 0.5) * 50;
    }
    sl.place(sp[0], sp[1], sp[2]).heading(((h % 360) + 360) % 360).pose(pose).show();
  }
}

function cues(ctx, S, P, sim) {
  const c = P.cue, n = P.near;
  const say = (key, tc, at, text, id, dur = 6, sound) => {
    if (!crossed(S, tc)) return;
    cueAt(S, `${key}:${Math.round(tc * 10)}`, tc, () => {
      if (sound) sim.sound(sound[0], sound[1] || at, sound[2]);
      if (text && playerNear(ctx, at, NEAR)) sim.caption(text, { id, duration: dur });
    });
  };
  say('bleat', c.bleat, n.chamber, { en: '"Go out and bring a lamb from the lamb chamber" — one is chosen from the inspected lambs and led out (Tamid 3:3; Arachin 2:5)', he: 'צְאוּ וְהָבִיאוּ טָלֶה מִלִּשְׁכַּת הַטְּלָאִים' }, 'lamb-brought', 6, ['sheep', null, { kind: 'lamb' }]);
  say('vessels', c.vessels, n.kelim, { en: 'They go into Lishkat HaKelim and bring out ninety-three vessels of silver and of gold (Tamid 3:4)', he: 'וְהוֹצִיאוּ מִשָּׁם תִּשְׁעִים וּשְׁלֹשָׁה כְּלֵי כֶסֶף וּכְלֵי זָהָב' }, 'vessels');
  say('drink', c.drink, n.water, { en: 'They give the tamid water to drink from a cup of gold, and inspect it again by the light of torches (Tamid 3:4)', he: 'הִשְׁקוּ אֶת הַתָּמִיד בְּכוֹס שֶׁל זָהָב' }, 'lamb-watered', 6, ['sheep', null, { kind: 'lamb' }]);
  say('struggle', c.struggle, n.ring, null, 'tamid-bound', 4, ['sheep', null, { kind: 'lamb' }]);
  say('cut', c.cut, n.ring, { en: 'Bound, head to the south and face to the west, at the second ring: the slaughterer slaughters and the receiver receives the blood (Tamid 4:1)', he: 'שָׁחַט הַשּׁוֹחֵט וְקִבֵּל הַמְקַבֵּל' }, 'tamid-slaughter', 7);
  say('throw1', c.throw1, n.altar, { en: 'At the north-east corner he gives the blood toward the east and the north (Tamid 4:1)', he: 'נוֹתֵן מִזְרָחָה צָפוֹנָה' }, 'tamid-blood-ne');
  say('throw2', c.throw2, [201, 305, 16], { en: 'At the south-west corner, toward the west and the south (Tamid 4:1)', he: 'מַעֲרָבָה דָרוֹמָה' }, 'tamid-blood-sw');
  say('pour', c.pour, [201, 305, 16], { en: 'The rest of the blood is poured out on the southern base of the altar (Tamid 4:1)', he: 'שְׁיָרֵי הַדָּם הָיָה שׁוֹפֵךְ עַל יְסוֹד דְּרוֹמִית' }, 'tamid-blood-pour');
  say('hang', c.hang, n.hook, { en: 'He does not break the leg: he pierces it at the hock and hangs the lamb by it, then flays it down to the breast (Tamid 4:2)', he: 'נוֹקְבוֹ מִתּוֹךְ עַרְכּוּבּוֹ וְתוֹלֶה בוֹ' }, 'flaying', 7);
  say('row', c.row, n.hook, { en: 'They all stand in a row with the parts in their hands: the head and the right hind leg, the forelegs, the tail and the left leg, the breast and the neck, the flanks, the innards in a bazach with the shanks on top… (Tamid 4:3)', he: 'נִמְצְאוּ כֻלָּן עוֹמְדִין בְּשׁוּרָה וְהָאֵבָרִים בְּיָדָם' }, 'tamid-row', 8);
  say('laid', c.laid, n.ramp, { en: 'They lay them on the lower half of the ramp, on its west side, and salt them — all but the wine (Tamid 4:3; Rambam Isurei Mizbeach 5:11)', he: 'וּנְתָנוּם מֵחֲצִי הַכֶּבֶשׁ וּלְמַטָּה בְּמַעֲרָבוֹ, וּמְלָחוּם' }, 'limbs-to-ramp', 7);
  if (P.KG) {
    say('kgUp', P.KG.cue.mid, n.ramp, { en: 'The Kohen Gadol goes up the ramp with the segan at his right; at the middle of the ramp the segan takes him by the right hand and brings him up (Tamid 7:3)', he: 'הִגִּיעַ לְמַחֲצִית הַכֶּבֶשׁ, אָחַז הַסְּגָן בִּימִינוֹ וְהֶעֱלָהוּ' }, 'kg-ramp', 8);
    say('kgFirst', P.KG.cue.first, n.altar, { en: 'The first hands him the head and the hind leg; he leans his hands on them and throws them on the fire. The second hands the forelegs to the first, who gives them to the Kohen Gadol (Tamid 7:3)', he: 'הוֹשִׁיט לוֹ הָרִאשׁוֹן הָרֹאשׁ וְהָרֶגֶל, וְסָמַךְ עֲלֵיהֶן וּזְרָקָן' }, 'kg-limbs', 9);
    say('kgRound', P.KG.cue.round, n.altar, { en: 'He goes round the altar: from the south-east corner to the north-east, the north-west and the south-west (Tamid 7:3)', he: 'בָּא לוֹ לְהַקִּיף אֶת הַמִּזְבֵּחַ' }, 'kg-round', 7);
  }
  say('toss', c.toss, n.altar, { en: 'The winners of the fourth lottery bring the limbs up from the ramp onto the fire, then the fine-flour offering, then the chavitin (Tamid 5:2; Yoma 33a)', he: 'מִי מַעֲלֶה אֵבָרִים מִן הַכֶּבֶשׁ לַמִּזְבֵּחַ' }, 'limbs-up', 6);
}
