// Group G4 — the animals of the composite sets this group stages: the nazir's three (a ewe lamb for a chatat, a lamb
// for an olah, a ram for his shelamim — Bamidbar 6:14; Nazir 6:7–9; Rambam Nezirut 8:1–4) and the healed metzora's
// chatat and olah after his asham (Negaim 14:7–10; Rambam Mechusrei Kapparah 4:2). private-offerings (G5) counts these
// sets but leaves them to G4 (g5/plan.js: "staged by the chambers / Nikanor modules"), so they are staged here with
// G5's own staging of an animal offering — its court geometry and walking graph (g5/geo.js buildGeo, imported, not
// changed) and its per-figure timelines (g5/track.js Track) — step by step as g5/plan.js scriptAnimal does it:
// semichah, shechitah with the blood received in a mizrak, the blood by its rite (the chatat on the four horns from
// the sovev, the others "two that are four"), hung on a hook and flayed, the innards rinsed, the hide to the Parvah,
// the limbs carried up and salted (an olah) or the eimurim (a chatat; the ram's waved first), the meat to the kohanim
// (a chatat), the libations.
//
// Where: rings, hooks and tables G5's lanes never use (g5/geo.js LANE_RINGS / LANE_PILLARS): the rings of the fifth
// row and the hooks and tables of the two end pillars (0 and 7) ⚙; the shared places at the altar (the corners, the
// pile's face, the cups, the salting place, the hearth's drop place) are kept free of G5's bookings (its plan's
// P.hot) and booked in the day's G4 register, so no two scenes are ever in one place.
//
// Evaluation: SetCast poses these tracks per frame as private-offerings does (planted feet, the rope from an animal to
// the hand leading it, the slain lamb carried in the arms, props, turning at a natural rate), on the calling module's
// own pools. The free props hung on the hooks are spawned here.
import { buildGeo } from '../g5/geo.js';
import { Track, one, fix, segAt, sampleSeg, phaseOf, HOLD, WALK, CARRIED, WALKPH, tableOrder } from '../g5/track.js';
import { createSource } from '../g5/dynamic.js';
import { SPURS, SPUR_SUB } from './mount.js';
import { OFFERING_TYPES, NESACHIM } from '../../../data/offerings.js';
import { SitePath, angleDiff } from '../../lib/path.js';
import { rng, hashStr, smooth, upperBound } from '../../lib/core.js';

const AM = 0.48;
const SPEED = { kohen: 1.25, lead: 0.95, carry: 1.05, owner: 1.15 };
const D16 = 16;
const TURN_RATE = 240;

// ------------------------------------------------------------------------------------------------ geometry
const GEO = new WeakMap();
/** G5's court geometry for this world (built once; a pure function of the site) */
export function geoOf(ctx) {
  let g = GEO.get(ctx);
  if (!g) { g = buildGeo(ctx); g.g4 = g4Places(ctx, g); GEO.set(ctx, g); }
  return g;
}

/**
 * The rings, hooks and tables G4 uses: rings 16 and 18 (the fifth row, west and third column) and the metzora's ring
 * 11; hooks on the end pillars 0 and 7, on their south faces (the lamb row) and on the outer faces (0 west, 7 east:
 * the ram row); their tables ⚙.
 */
function g4Places(ctx, G) {
  const el = (id) => ctx.elOpt?.(id);
  const rp = el('altar.rings')?.params, nn = el('altar.nanasin')?.params, tabs = el('altar.marble-tables')?.params?.tables || [];
  const ring = (idx) => { const p = rp?.positions?.[idx]; const row = Math.floor(idx / 4), col = idx % 4; return p ? [p[0], p[1], D16] : [205 + 8 * col, 347.5 + 4 * row, D16]; };
  const capW = (nn?.section || 1) * 1.3;
  const hookZ = nn?.hookRowsZ || [19.2, 19.5, 19.8];
  const pil = (p) => nn?.pillars?.[p] || [203 + 4 * p, 383.75, D16];
  const table = (p) => {
    const tb = tabs[p] || { min: [pil(p)[0] - 1.25, 372.75], max: [pil(p)[0] + 1.25, 374.25] };
    const tX = (tb.min[0] + tb.max[0]) / 2;
    return { at: [tX, (tb.min[1] + tb.max[1]) / 2, 17.5], stand: [tX, (tb.max?.[1] ?? 374.25) + 0.9, D16], id: `table:${p}` };
  };
  const hook = (p, face) => {
    const [px, py] = pil(p);
    // the table's south side: the south-face hook's man at its west end, the side-face hook's at its east end
    const tb = table(p);
    const tStand = (dx) => ({ ...tb, stand: [tb.stand[0] + dx, tb.stand[1], tb.stand[2]] });
    if (face === 'S') { const y = py - capW / 2 - 0.2; return { id: `hook:${p}${face}`, pillar: p, at: [px, y, hookZ[0] + 0.02], atRam: [px, y, hookZ[1] + 0.02], flayer: [px, y - 1.3, D16], fh: 0, h: 180, table: tStand(-0.75) }; }
    const sx = face === 'W' ? -1 : 1;
    const x = px + sx * (capW / 2 + 0.2);
    return { id: `hook:${p}${face}`, pillar: p, at: [x, py, hookZ[0] + 0.02], atRam: [x, py, hookZ[1] + 0.02], flayer: [x + sx * 1.3, py, D16], fh: sx < 0 ? 90 : 270, h: sx < 0 ? 270 : 90, table: tStand(0.75) };
  };
  const ringOf = (idx) => {
    const [X, Y] = ring(idx);
    return { id: `ring:${idx}`, idx, ring: [X, Y, D16], hold: [X + 3.2, Y + 1.0, D16], bound: [X, Y + 0.9, D16], label: `ring ${idx + 1}`,
      view: { at: [240, Y + 1.5, D16], heading: 262 } };
  };
  return {
    rings: [ringOf(16), ringOf(18)], metzoraRing: ringOf(11),
    hooks: [hook(0, 'S'), hook(7, 'S'), hook(0, 'W'), hook(7, 'E')],
    // inside the Parvah: where these sets' hides are laid, clear of G5's places and of chambers-daily's salters ⚙
    hideSpots: [[124.6, 271.2, D16], [136.4, 271.6, D16]],
    // in Lishkat HaMedichin: a third row of places for the stomach's rinsing, behind G5's two (S.medSpot) ⚙
    medSpots: G.S.medSpot.slice(0, 3).map((p) => [p[0], p[1] - 5.2, D16]),
    // the nazir's waving: a row north of G5's waving places east of the altar (S.wave), the nazir east facing west and
    // the kohen west of him, 1.3 amot apart (Menachot 61b) ⚙
    wave: (() => { const tp = G.S.tenufah.pos; const y = tp[1] + 6.6; return { owner: [tp[0] + 0.65, y, D16], kohen: [tp[0] - 0.65, y, D16], ownerIn: [tp[0] + 2.8, y, D16], kohenIn: [tp[0] - 3.1, y, D16] }; })(),
  };
}

// ------------------------------------------------------------------------------------------------ building blocks
// (as g5/plan.js: a step's minutes from the data, the step marks the "Happening now" rows read, arriving at a place)
function minutes(type, id, r, fb = [1, 2]) {
  const st = OFFERING_TYPES[type]?.steps?.find((x) => x.id === id);
  const [lo, hi] = st?.minutes || fb;
  return lo + (hi - lo) * r();
}
function stepData(type, id) { return OFFERING_TYPES[type]?.steps?.find((x) => x.id === id) || null; }
function mark(B, id, t0, t1, o = {}) {
  const sd = stepData(o.type || B.type, o.dataId || id) || stepData('olah', o.dataId || id) || stepData('shelamim', o.dataId || id);
  B.steps.push({ id, label: o.label || sd?.label || id, t0, t1, zone: o.zone || 'azarah', view: o.view, parent: o.parent || B.parent,
    sources: o.sources || sd?.sources || [], note: o.note || null });
}
function arriveAt(G, tr, from, to, tArr, o = {}) {
  const r = G.route(from, to, o);
  const dur = r.path.length / (o.speed || SPEED.kohen) / 60;
  const p0 = typeof from === 'string' ? [G.N[from].X, G.N[from].Y, G.N[from].Z] : from;
  tr.at(tArr - dur, p0, 0);
  tr.walkRoute(r, { speed: o.speed || SPEED.kohen, pose: o.pose || 'walk', prop: o.prop, hand: o.hand, prop2: o.prop2 });
  return tr;
}
const add = (p, dx, dy, z) => [p[0] + dx, p[1] + dy, z ?? p[2]];
const headTo = (a, b) => { const h = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI; return h < 0 ? h + 360 : h; };
function sovevBack(G) {
  const pts = ['SV_SW', 'SV_NW', 'SV_NE', 'SV_SE'].map((k) => [G.N[k].X, G.N[k].Y, G.N[k].Z]);
  const path = new SitePath(pts);
  return { path, near: new Uint8Array(pts.length), length: path.length };
}
function wineRoute(G, from, i) {
  const c = G.S.cups.pos;
  const pts = [from, [G.N.K_FW.X - 0.5, G.N.K_FW.Y, 16], [211.0 + i * 0.8, 283.5, G.kevZ(283.5)], [211.0 + i * 0.8, 305.5, G.kevZ(305.5)],
    [210.5, 307.4, 25], [c[0] + 0.4 + i * 0.9, c[1] + 0.2, 25]];
  const path = new SitePath(pts);
  return { path, near: Uint8Array.from([0, 0, 0, 1, 1, 1]), length: path.length };
}
function reverseRoute(r) {
  const pts = [...r.path.points].reverse().map((p) => [p.X, p.Y, p.Z]);
  const path = new SitePath(pts);
  return { path, near: Uint8Array.from([...r.near].reverse()), length: path.length };
}
/** a route of my own points (Z exact unless marked near) */
export function pathOf(pts, near = null) {
  const path = new SitePath(pts);
  return { path, near: near ? Uint8Array.from(near) : new Uint8Array(pts.length), length: path.length };
}

/** walk a route from distance d0 on (a leader whose own walk began before this route's start point: the animals
 * following him on the route keep their places behind him) */
function walkFrom(tr, r, d0, o) {
  const len = r.path.length;
  const dur = Math.max(0, len - d0) / (o.speed || SPEED.lead) / 60;
  const seg = { kind: WALK, t0: tr.t, t1: tr.t + dur, path: r.path, nearPts: r.near, d0, d1: len, pose: o.pose || 'walk', ph: WALKPH,
    prop: o.prop ?? null, hand: o.hand || 'right', prop2: null, lag: 0, side: 0, lead: null, back: false };
  tr.segs.push(seg);
  tr.t = seg.t1;
  const end = r.path.sample(len, {});
  tr.p = [end.X, end.Y, Number.isFinite(end.Z) ? end.Z : tr.p[2]];
  tr.h = end.heading;
  tr.lastWalk = seg;
  return tr;
}

/**
 * The last few metres of the Korban spur as a party walks it up from the circuit (its class-0 lane: g4/mount.js), so
 * the court's tracks start exactly where the Mount's itineraries end, the animals on their ropes behind: points from
 * BACK metres before the flight's foot to the foot.
 */
const BACK = 3.2;
export function entryBack() {
  const R = SPURS.korban.inRoute, L = R.length, side = SPUR_SUB[0], q = {};
  const pts = [];
  for (let x = BACK; x >= -1e-6; x -= 0.4) { R.sample(L - Math.max(0, x), q, side); pts.push([q.X, q.Y, q.Z]); }
  return pts;
}
/** ways to lay the nazir's set out at G4's rings and hooks (ring A for the chatat and the ram, ring B for the olah) */
export const NAZIR_COMBOS = [
  { rA: 0, rB: 1, hC: 0, hO: 1, hR: 2 }, { rA: 1, rB: 0, hC: 1, hO: 0, hR: 3 },
  { rA: 0, rB: 1, hC: 2, hO: 3, hR: 0 }, { rA: 1, rB: 0, hC: 3, hO: 2, hR: 1 },
];

/**
 * private-offerings' plan for the current date through the runtime's documented getter (sim.planOf: built now if it is
 * not yet; null without that module). Read here: P.ok, P.counts, P.hot (the shared places' bookings), P.insts.
 */
export function g5PlanOf(ctx, sim) {
  const P = sim.planOf?.('private-offerings') ?? null;
  return P && !P.counts ? { ...P, counts: {} } : P;
}

/** a set under construction: tracks, steps, props, resources used (minutes from its own start) */
export function Built(parent, type, set) {
  return { parent, type, set, tracks: [], steps: [], props: [], cues: [], res: [], fires: [] };
}
const uses = (B, id, a, b) => B.res.push({ id, a, b });

/**
 * One activity at the altar (the blood, the limbs, the eimurim, the libations) as a queue would have it: built at its
 * earliest time t into a scratch set, then put off by the least delay d (quarter-minutes, up to `max`) for which every
 * shared place its figures use is free — of private-offerings' bookings (P5.hot), of the day's G4 register, and of
 * this set's own earlier activities — and, where it uses places G5 does not book, of G5's steps of that kind (its
 * olot's limbs salted on the ramp; its libations). graft: [[scratch track, main track]] continues a figure of the set
 * (the kohen with the blood waits where he is, then goes). F = the set's fit context (null: no fitting, as in a probe).
 * Returns { end, d, S }.
 */
function fitSub(B, F, t, build, { max = 30, g5 = null, graft = null, graftFirst = null } = {}) {
  const S = Built(B.parent, B.type, B.set);
  S.role = B.role;
  const end = build(S, t);
  let d = 0;
  if (F) {
    const hot = hotOf(F.H, S);
    const t0 = Math.min(...S.tracks.map((tr) => tr.t0)), t1 = Math.max(...S.tracks.map((tr) => tr.t1));
    for (d = 0; d <= max; d += 0.25) if (subFree(F, hot, d, g5, t0, t1)) break;
    // it cannot wait that long (the blood): the whole set is laid out later instead (placeSet stops this build here)
    if (d > max) { d = max; B.failed = true; throw ABORT; }
    hot.forEach((list, i) => { for (const [a, b] of list) F.local[i].push([F.abs + a + d, F.abs + b + d]); });
    if (g5) F.own.push([F.abs + t0 + d, F.abs + t1 + d, g5]);
  }
  for (const tr of S.tracks) tr.shift(d);
  for (const st of S.steps) { st.t0 += d; st.t1 += d; }
  for (const pr of S.props) { pr.t0 += d; pr.t1 += d; }
  for (const c of S.cues) c.t += d;
  for (const u of S.res) { u.a += d; u.b += d; }
  const grafted = new Set();
  if (graftFirst && S.tracks.length) graft = [[S.tracks[0], graftFirst], ...(graft || [])];
  for (const [sc, main] of graft || []) {
    if (!sc.segs.length) continue;
    main.hold(sc.segs[0].t0, { pose: 'stand', h: main.h, prop: sc.segs[0].prop, hand: sc.segs[0].hand });
    for (const sg of sc.segs) main.segs.push(sg);
    main.t = sc.t; main.p = sc.p; main.h = sc.h; main.lastWalk = sc.lastWalk;
    grafted.add(sc);
  }
  for (const tr of S.tracks) if (!grafted.has(tr)) B.tracks.push(tr);
  B.steps.push(...S.steps); B.props.push(...S.props); B.cues.push(...S.cues); B.res.push(...S.res);
  return { end: end + d, d, S };
}
const ABORT = { abort: true };
function subFree(F, hot, d, g5, t0, t1) {
  const abs = F.abs;
  for (let i = 0; i < hot.length; i++) {
    const id = F.H[i]?.id ?? i;
    const res = F.book.resource(`hot:${id}`);
    for (const [a, b] of hot[i]) {
      const A = abs + a + d, Bb = abs + b + d;
      if (F.P5?.hot?.[i]?.book?.hits?.(A, Bb)) return false;
      if (!res.free(A, Bb)) return false;
      for (const [x, y] of F.local[i]) if (A < y && Bb > x) return false;
    }
  }
  if (g5) {
    const A = abs + t0 + d, Bb = abs + t1 + d;
    for (const [x, y] of F.g5[g5] || []) if (A < y && Bb > x) return false;
    for (const [x, y, k] of F.own) if (k === g5 && A < y && Bb > x) return false;
    if (!F.book.resource(`g4:${g5}`).free(A, Bb)) return false;
  }
  return true;
}
/** G5's steps that use places it does not book: its olot's limbs salted on the ramp, its libations (cached per plan) */
function g5Windows(P5) {
  if (!P5) return {};
  if (P5.__g4w) return P5.__g4w;
  const w = { limbs: [], nesachim: [] };
  for (const inst of P5.insts || []) for (const st of inst.steps || []) {
    if (st.id === 'haalaah' && st.zone === 'kevesh' && !/eimurim/i.test(st.label || '')) w.limbs.push([st.t0 - 0.3, st.t1 + 0.3]);
    if (st.id === 'nesachim') w.nesachim.push([st.t0 - 0.6, st.t1 + 0.4]);
  }
  P5.__g4w = w;
  return w;
}

// ------------------------------------------------------------------------------------------------ one animal
/**
 * One animal of a set, from the moment it stands by its ring with its leader (t) to its last step. o: { type
 * ('chatat'|'olah'|'shelamim'), sp ('lamb'|'ram'), A (the animal's Track, standing by the ring), lead (role leading
 * it), O (the one who leans and slaughters: the owner's Track, or null — then the kohen K0 of o.K0 slaughters),
 * lean (semichah here: false when he leaned from the gateway), ring, hook, hideSpot, r (seeded draws), keepRam (the
 * ram: its eimurim, breast and thigh set aside for the waving, the meat given to o.meatTo) }. Returns times.
 */
function animal(B, G, t, o) {
  const { type, sp, A, ring: L, hook: H, r } = o;
  const T = OFFERING_TYPES[type];
  const S0 = G.S;
  const view = (v) => ({ at: v.at, heading: v.heading });
  const kk = type === 'chatat' || type === 'olah';
  const rite = T.blood?.rite;
  const roles = o.roles;
  // ---- to the ring, facing west; the leaning (Rambam MK 3:13–14: the animal in the north facing west, the leaner east
  // of it facing west, both hands between the horns)
  const aSemi = [L.ring[0] + 1.15, L.ring[1], 16];
  const headX = aSemi[0] - (sp === 'ram' ? 0.66 : 0.55) / AM;
  const oSemi = [headX + 0.384 / AM, L.ring[1] + 0.32 / AM, 16];
  A.step(aSemi, { pose: 'walk_led', speed: 0.7, lead: o.lead });
  const slayer = o.O || o.K0;
  if (o.O) o.O.step(oSemi, { pose: 'walk', speed: 0.7 });
  else { o.K0.hold(Math.max(o.K0.t, t), { pose: 'stand', h: 270 }); o.K0.step(add(L.ring, 2.0, -0.5), { pose: 'walk', speed: 0.7 }); }
  t = Math.max(A.t, slayer.t, t);
  const tRing = t;
  if (o.lean !== false && o.O) {
    const dS = minutes(type, 'semichah', r, [1, 3]);
    A.hold(t + dS, { pose: 'stand_halter', h: 270, lead: o.lead });
    o.O.hold(t + dS, { pose: 'semichah', h: 230 });
    B.cues.push({ t: t + 0.35, key: `semichah-${type}`, pos: L.ring, range: 26,
      text: T.semichah?.words === 'viduy'
        ? { en: `Leaning with all his strength on his ${type === 'chatat' ? 'sin-offering' : 'burnt-offering'}, he confesses: "I have sinned… and this is my atonement" (Rambam MK 3:14–15)`, he: 'חָטָאתִי עָוִיתִי פָּשַׁעְתִּי… וְזוֹ כַּפָּרָתִי' }
        : { en: 'Leaning on his peace-offering he speaks words of praise — no confession over a shelamim (Rambam MK 3:15)', he: 'דִּבְרֵי שֶׁבַח' } });
    mark(B, 'semichah', t, t + dS, { type, view: view(L.view), zone: 'slaughter-zone', label: `${o.title}: the leaning (${T.semichah?.words === 'viduy' ? 'with confession' : 'with praise'})` });
    t += dS;
  } else {
    A.hold(t + 0.25, { pose: 'stand_halter', h: 270, lead: o.lead });
    t += 0.25;
  }
  // ---- the kohanim come from Beit HaMoked to the ring: the receiver and the one who holds the legs
  const K1 = new Track(null, `${roles}K1`, 'kohen'), K2 = new Track(null, `${roles}K2`, 'kohen');
  B.tracks.push(K1, K2);
  const bound = L.bound;
  const pRecv = add(bound, 1.7, -2.2), pHold = add(bound, 1.1, 1.6), pSlay = add(bound, 2.1, -0.6);
  arriveAt(G, K1, 'MOK_X', add(pRecv, 0.6, 0.4), t - 0.6 - r() * 0.5);
  arriveAt(G, K2, 'MOK_X', add(pHold, 0.8, 0.9), t - 0.5 - r() * 0.6);
  uses(B, L.id, Math.min(K1.t, K2.t, tRing) - 0.6, NaN);
  const ringUse = B.res[B.res.length - 1];
  K1.hold(t, { pose: 'stand', h: headTo(K1.p, bound), prop: 'mizrak_silver' });
  K2.hold(t, { pose: 'stand', h: headTo(K2.p, bound) });
  // ---- shechitah: laid down and held as an akedah, head south and face west, the shochet east of it (Tamid 4:1)
  const tBind = t;
  A.step(bound, { pose: 'struggle', speed: 0.5, minDur: 0.18, ph: null });
  K2.step(pHold, { pose: 'walk', speed: 0.7 });
  K1.step(pRecv, { pose: 'walk', speed: 0.7, prop: 'mizrak_silver' });
  slayer.step(pSlay, { pose: 'walk', speed: 0.7 });
  t = Math.max(A.t, K2.t, K1.t, slayer.t);
  const dSh = minutes(type, 'shechitah', r, [0.5, 1.5]);
  const tShEnd = t + dSh;
  A.hold(tShEnd, { pose: 'bound', h: 180 });
  K2.hold(tShEnd, { pose: 'hold_legs', h: 200 });
  K1.hold(tShEnd, { pose: 'receive', h: 300, prop: 'mizrak_silver' });
  slayer.hold(tShEnd, { pose: 'slaughter', h: 270, prop: 'knife' });
  B.cues.push({ t: tBind + 0.05, kind: 'sound', id: 'sheep', pos: bound, opts: { kind: sp === 'ram' ? 'ram' : 'lamb' } });
  mark(B, 'shechitah', tBind, tShEnd, { type, view: view(L.view), zone: 'slaughter-zone', label: `${o.title}: slaughtered at ${L.label}, the blood received in a silver mizrak` });
  // ---- the blood (K1): straight to the altar, unless a corner it needs is taken — then he waits with the mizrak
  t = tShEnd;
  K1.step(add(pRecv, 0.4, 0.8), { pose: 'walk', speed: 0.8, prop: 'mizrak_silver' });
  // (a chatat's blood before an olah's: Zevachim 10:2)
  const blood = fitSub(B, o.F, Math.max(K1.t, o.bloodAfter ?? -Infinity), (S, tb) => {
    const Kb = new Track(null, K1.role, 'kohen');
    S.tracks.push(Kb);
    Kb.at(tb, K1.p, K1.h);
    if (rite === 'four-horns') {
      const t0 = Kb.t;
      Kb.walk(G, 'KE_RS', { speed: SPEED.kohen, prop: 'mizrak_silver', hand: 'left', to: 'KE_RS' });
      Kb.walk(G, 'RS_2', { speed: 1.0, prop: 'mizrak_silver', hand: 'left' });
      for (const [hn, node] of [['hornSE', 'SV_SE'], ['hornNE', 'SV_NE'], ['hornNW', 'SV_NW'], ['hornSW', 'SV_SW']]) {
        Kb.walk(G, node, { speed: 1.05, prop: 'mizrak_silver', hand: 'left' });
        Kb.holdFor(0.14, { pose: 'sprinkle', h: S0[hn].heading ?? 0, prop: 'mizrak_silver', hand: 'left' });
      }
      Kb.walk(G, 'SV_SE', { speed: 1.1, prop: 'mizrak_silver', hand: 'left', route: sovevBack(G) });
      Kb.walk(G, 'RS_1', { speed: 1.0, prop: 'mizrak_silver', hand: 'left' });
      Kb.walk(G, 'KE_RS', { speed: 1.0, prop: 'mizrak_silver', hand: 'left' });
      Kb.walk(G, 'RY_Y', { speed: 1.0, prop: 'mizrak_silver', hand: 'left', route: G.route('KE_RS', 'RY_Y', { from: 'KE_RS', to: 'RY_Y' }) });
      Kb.holdFor(0.16, { pose: 'pour', ph: one(), h: 0, prop: 'mizrak_silver' });
      mark(S, 'matanot', t0, Kb.t, { type, zone: 'mizbeach', view: view(G.V.sovev), parent: o.bloodParent || B.parent, label: `${o.title}: its blood with the finger on the four horns from the sovev, the rest on the southern yesod` });
      const tEnd = Kb.t;
      Kb.walk(G, 'MOK_X', { speed: SPEED.kohen, route: G.route('RY_Y', 'MOK_X', { from: 'RY_Y' }) });
      return tEnd;
    }
    // two that are four: thrown at the NE corner, then the SW, below the line; the rest on the southern yesod
    const t0 = Kb.t;
    Kb.walk(G, S0.altarNE.pos, { speed: SPEED.kohen, prop: 'mizrak_silver' });
    Kb.holdFor(0.12, { pose: 'throw', ph: one(), h: S0.altarNE.heading, prop: 'mizrak_silver' });
    Kb.walk(G, S0.swPoint.pos, { speed: SPEED.kohen, prop: 'mizrak_silver' });
    Kb.holdFor(0.12, { pose: 'throw', ph: one(), h: S0.swPoint.heading, prop: 'mizrak_silver' });
    Kb.holdFor(0.14, { pose: 'pour', ph: one(), h: S0.swPoint.heading, prop: 'mizrak_silver' });
    mark(S, 'zerikah', t0, Kb.t, { type, zone: 'mizbeach', view: view(G.V.sw), parent: o.bloodParent || B.parent, label: `${o.title}: its blood thrown at the NE and SW corners below the line, the rest on the southern yesod` });
    const tEnd = Kb.t;
    Kb.walk(G, 'MOK_X', { speed: SPEED.kohen });
    return tEnd;
  }, { max: 3, graftFirst: K1 });
  o.out.blood = blood.end;
  // the slayer steps back
  if (o.O) o.O.holdFor(0.1, { pose: 'stand', h: 270 });
  else { o.K0.holdFor(0.1, { pose: 'stand', h: 270, prop: 'knife' }); }
  // ---- hefshet: after the blood the carcass to its hook, hung by a hind leg pierced at the hock and flayed
  K2.hold(tShEnd + 0.1, { pose: 'hold_legs', h: 200 });
  K2.hold(Math.max(K2.t, o.out.blood), { pose: 'stand', h: 200 });
  K2.step(add(bound, 0.9, 0.2), { pose: 'walk', speed: 0.7 });
  K2.holdFor(0.12, { pose: 'kneel', ph: fix(0.32), h: 270 });
  const tLift = K2.t;
  A.hold(tLift, { pose: 'bound', h: 180 });
  ringUse.b = tLift + 0.1;
  o.out.lift = tLift;
  K2.walk(G, H.flayer, { speed: SPEED.carry, pose: 'carry_walk' });
  A.carried(K2.lastWalk, { up: 0.74, hOff: -90, fwd: 0.36, side: 0 });
  const tHang = K2.t;
  const dF = minutes(type, 'hefshet', r, [10, 20]);
  K2.hold(tHang + dF, { pose: 'flay', h: H.fh, prop: 'knife_flay' });
  const at = sp === 'ram' ? H.atRam : H.at;
  B.props.push({ name: 'lamb_hung', hook: H.id, t0: tHang, t1: tHang + 0.14 * dF, at, h: H.h });
  B.props.push({ name: 'carcass_flaying', hook: H.id, t0: tHang + 0.14 * dF, t1: tHang + 0.72 * dF, at, h: H.h });
  const hungFinal = { name: 'carcass_hung', hook: H.id, t0: tHang + 0.72 * dF, t1: NaN, at, h: H.h };
  B.props.push(hungFinal);
  mark(B, 'hefshet', tLift, tHang + dF, { type, zone: 'slaughter-zone', view: { at: [H.flayer[0] + (H.fh === 0 ? 3 : H.fh === 90 ? -3.5 : 3.5), 371.0, D16], heading: H.fh === 0 ? 345 : H.fh === 90 ? 20 : 340 },
    label: `${o.title}: hung on ${H.pillar === 0 ? 'the westernmost' : 'the easternmost'} pillar's hooks and flayed${type === 'olah' ? ', cut into its limbs' : ', the fats taken out'}` });
  // ---- hadachah: the intestines rinsed on the marble table, the stomach in Lishkat HaMedichin (Tamid 4:2)
  const tR0 = K2.t;
  const dR = minutes(type, 'hadachah', r, [5, 12]);
  K2.step(H.table.stand, { pose: 'carry_walk', speed: 0.8, prop: 'entrails_bazach' });
  K2.holdFor(Math.max(0.6, dR * 0.35), { pose: 'flay', h: 180 });
  K2.walk(G, G.g4.medSpots[o.medLane ?? 0], { speed: SPEED.kohen, pose: 'carry_walk', prop: 'entrails_bazach' });
  K2.holdFor(Math.max(0.4, dR * 0.2), { pose: 'carry', h: 180, prop: 'entrails_bazach' });
  K2.walk(G, H.table.stand, { speed: SPEED.kohen, pose: 'carry_walk', prop: 'entrails_bazach' });
  if (K2.t < tR0 + dR) K2.hold(tR0 + dR, { pose: 'flay', h: 180 });
  else K2.holdFor(0.15, { pose: 'carry', h: 180, prop: 'entrails_bazach' });
  uses(B, `${H.table.id}:${H.id}`, tR0, K2.t + 0.2);
  uses(B, `med:${o.medLane ?? 0}`, tR0, K2.t);
  t = K2.t;
  // ---- or: a most-holy offering's hide to the Parvah (Middot 5:3; Zevachim 12:3)
  if (kk) {
    // (a moment's wait at the table when another of the set's hides is on its way to the Parvah)
    if (o.orAfter > t) { K2.hold(o.orAfter, { pose: 'stand', h: 180 }); t = o.orAfter; }
    const tO = t;
    K2.step(H.flayer, { pose: 'walk', speed: 0.8 });
    K2.holdFor(0.12, { pose: 'flay', h: H.fh });
    K2.walk(G, o.hideSpot, { speed: SPEED.carry, pose: 'carry_shoulder_walk', prop: 'hide' });
    K2.holdFor(0.35, { pose: 'carry_shoulder', h: 180, prop: 'hide' });
    mark(B, 'or', tO, K2.t, { type, zone: 'parvah', view: view(G.V.south), label: `${o.title}: its hide to the Parvah, to be salted` });
    o.out.orEnd = K2.t - 0.6;
    K2.walk(G, 'MOK_X', { speed: SPEED.kohen });
    t = tO + 0.25;
  }
  o.out.dressed = t;
  o.out.K2 = K2;
  o.out.hungFinal = hungFinal;
  o.out.tFlayed = tHang + dF;
  return o.out;
}

/** the olah's limbs to the ramp, salted, up the east half and thrown on the great pile (6 carriers and a salter — as
 * g5/plan.js for a lamb) */
function limbsUp(B, G, t, H, title, r) {
  const S = G.S;
  const pairs = [['limb_head', 'limb'], ['limb_foreleg', 'limb_foreleg'], ['limb_oketz', 'limb'], ['limb_chazeh', 'limb_gerah'], ['limb_dofen', 'limb_dofen'], ['entrails_bazach', null]];
  const n = pairs.length;
  const C = pairs.map((_, k) => new Track(null, `${B.role}C${k}`, 'kohen'));
  B.tracks.push(...C);
  // (the first to go wait in the back row, by the way out, and come last: g5/track.js tableOrder)
  const spots = pairs.map((_, k) => { const j = tableOrder(n, k).spot; return add(H.table.stand, (j % 4 - 1.5) * 0.98, 0.2 + Math.floor(j / 4) * 1.25); });
  C.forEach((c, k) => arriveAt(G, c, 'MOK_X', spots[k], t + 0.1 + 0.04 * tableOrder(n, k).arrive));
  const tPick = t + 0.12 * n * 0.25 + 0.2;
  let tGo = -Infinity;
  C.forEach((c, k) => {
    const [pr, pl] = pairs[k];
    c.hold(Math.max(c.t, t), { pose: 'stand', h: 180 });
    c.holdFor(0.18, { pose: pl ? 'carry_limbs' : 'carry', h: 180, prop: pr, prop2: pl });
    // each goes once he has his limbs and 0.05 after the one before him (the first to go came last: never two at once)
    tGo = Math.max(c.t, tGo + 0.05, tPick + 0.05 * k);
    c.hold(tGo, { pose: pl ? 'carry_limbs' : 'carry', h: 180, prop: pr, prop2: pl });
  });
  const saltAt = [214.1, 280.8, G.kevZ(280.8)], salter = new Track(null, `${B.role}S`, 'kohen');
  B.tracks.push(salter);
  const toSalt = (j) => [saltAt[0] + 1.6 + (j % 3) * 1.0, saltAt[1] - 1.0 + Math.floor(j / 3) * 1.3, G.kevZ(saltAt[1] - 1.0 + Math.floor(j / 3) * 1.3)];
  let tSalt = 0;
  C.forEach((c, k) => {
    const [pr, pl] = pairs[k];
    c.walk(G, toSalt(n - 1 - k), { speed: SPEED.carry, pose: pl ? 'carry_limbs_walk' : 'carry_walk', prop: pr, prop2: pl, to: 'K_FW' });
    tSalt = Math.max(tSalt, c.t);
  });
  arriveAt(G, salter, 'MOK_X', saltAt, tSalt - 0.6, { prop: 'salt', hand: 'left' });
  salter.hold(tSalt, { pose: 'stand', h: 90, prop: 'salt', hand: 'left' });
  salter.holdFor(0.9, { pose: 'salt', h: 90, prop: 'salt', hand: 'left' });
  salter.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'K_FW' });
  mark(B, 'haalaah', t, tSalt + 0.9, { type: 'olah', zone: 'kevesh', view: { at: G.V.westRamp.at, heading: G.V.westRamp.heading }, label: `${title}: its limbs brought to the ramp and salted` });
  const pile = (k) => [S.pileFaceX, S.pileY[0] + ((S.pileY[1] - S.pileY[0]) * k) / Math.max(1, n - 1), 25];
  let tTop = 0;
  C.forEach((c, k) => {
    const [pr, pl] = pairs[k];
    c.hold(tSalt + 0.9 + 0.05 * k, { pose: pl ? 'carry_limbs' : 'carry', h: 0, prop: pr, prop2: pl });
    c.step([220.6, c.p[1] + 1.2, G.kevZ(c.p[1] + 1.2)], { pose: pl ? 'carry_limbs_walk' : 'carry_walk', prop: pr, prop2: pl, speed: 0.9 });
    c.walk(G, pile(n - 1 - k), { speed: SPEED.carry, pose: pl ? 'carry_limbs_walk' : 'carry_walk', prop: pr, prop2: pl, from: 'KE_MID', to: 'TP_E' });
    tTop = Math.max(tTop, c.t);
  });
  C.forEach((c, k) => {
    const [pr, pl] = pairs[k];
    c.hold(tTop + 0.04 + 0.022 * k + 0.012 * r(), { pose: pl ? 'carry_limbs' : 'carry', h: 270, prop: pr, prop2: pl });
    c.holdFor(0.1, { pose: pl ? 'toss' : 'throw', ph: one(), h: 270, prop: pr, prop2: pl });
    c.hold(tTop + 0.04 + 0.022 * n + 0.13 + 0.04 * k, { pose: 'stand', h: 270 });
    c.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'TP_E' });
  });
  const tThrown = tTop + 0.04 + 0.022 * n + 0.13;
  mark(B, 'haalaah', tSalt + 0.9, tThrown, { type: 'olah', zone: 'mizbeach', view: { at: G.V.top.at, heading: G.V.top.heading }, label: `${title}: its limbs thrown on the great pile` });
  return tThrown;
}

/** eimurim by one kohen: salted on the lower west half of the ramp, up the east half and thrown on the pile; a
 * chatat's meat then to the hearth's drop place for the kohanim's meal (as g5/plan.js) */
function eimurimUp(B, G, t, H, title, o = {}) {
  const S = G.S;
  const Ke = new Track(null, `${B.role}K3`, 'kohen');
  B.tracks.push(Ke);
  arriveAt(G, Ke, 'MOK_X', add(H.table.stand, 0.4, 1.3), t + 0.1);
  Ke.holdFor(0.2, { pose: 'carry', h: 180, prop: 'bowl' });
  const t0 = Ke.t;
  Ke.walk(G, S.saltE, { speed: SPEED.carry, pose: 'carry_walk', prop: 'bowl', to: 'K_FW' });
  Ke.holdFor(0.08, { pose: 'kneel', ph: fix(0.3), h: 90, prop: 'bowl' });
  Ke.holdFor(0.35, { pose: 'salt', h: 90, prop: 'salt', hand: 'left' });
  Ke.holdFor(0.08, { pose: 'kneel', ph: fix(0.3), h: 90 });
  const sy = S.saltE[1];
  Ke.step([220.6, sy + 1.2, G.kevZ(sy + 1.2)], { pose: 'carry_walk', prop: 'bowl', speed: 0.9 });
  Ke.walk(G, [S.pileFaceX, 321.5 + 2.4, 25], { speed: SPEED.carry, pose: 'carry_walk', prop: 'bowl', from: 'KE_MID', to: 'TP_E' });
  Ke.holdFor(0.1, { pose: 'throw', ph: one(), h: 270, prop: 'bowl' });
  mark(B, 'haalaah', t0, Ke.t, { type: o.type || B.type, zone: 'mizbeach', view: { at: G.V.ramp.at, heading: G.V.ramp.heading }, label: `${title}: its eimurim salted and burned on the great pile` });
  if (o.meat) {
    // the most-holy meat to the kohanim's cooking place in the court (Zevachim 5:3, 11:4)
    Ke.walk(G, H.flayer, { speed: SPEED.kohen, from: 'TP_E' });
    const tTake = Ke.t;
    B.tTake = tTake;
    Ke.holdFor(0.15, { pose: 'flay', h: H.fh });
    Ke.walk(G, S.drop.pos, { speed: SPEED.carry, pose: 'carry_shoulder_walk', prop: 'lamb_carcass', to: 'E_K' });
    Ke.holdFor(0.4, { pose: 'carry_shoulder', h: S.drop.heading, prop: 'lamb_carcass' });
    mark(B, 'achilah', tTake, Ke.t, { type: o.type || B.type, zone: 'ezrat-kohanim', view: { at: G.V.kitchen.at, heading: G.V.kitchen.heading }, parent: o.mealParent,
      label: `${title}: its meat to the kohanim's cooking place, to be eaten in the court by male kohanim until midnight` });
    Ke.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'E_K' });
  } else Ke.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'TP_E' });
  return Ke.t;
}

/** the libations: the flour-and-oil burned whole on the pile, the wine poured at the SW horn (Menachot 9:6;
 * Zevachim 6:2–3) — one kohen with the flour, one with the wine, for all the animals of the set together ⚙ */
function nesachim(B, G, t, label) {
  const S = G.S;
  const N1 = new Track(null, `${B.role}N1`, 'kohen'), N2 = new Track(null, `${B.role}N2`, 'kohen');
  B.tracks.push(N1, N2);
  const tN0 = t + 0.3;
  arriveAt(G, N1, 'MOK_X', [207.3, 279.9, 16], tN0, { to: 'K_FW' });
  arriveAt(G, N2, 'MOK_X', [208.0, 281.2, 16], tN0 + 0.05, { to: 'K_FW' });
  N1.holdFor(0.2, { pose: 'carry', h: 270, prop: 'solet' });
  N1.walk(G, 'K_FE', { speed: SPEED.carry, pose: 'carry_walk', prop: 'solet' });
  N1.walk(G, [S.pileFaceX, 322.5 + 1.6, 25], { speed: SPEED.carry, pose: 'carry_walk', prop: 'solet', from: 'K_FE', to: 'TP_E' });
  N1.holdFor(0.1, { pose: 'toss', ph: one(), h: 270, prop: 'solet' });
  const t1 = N1.t;
  N1.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'TP_E' });
  N2.holdFor(0.2, { pose: 'carry', h: 270, prop: 'wine_jug' });
  const up = wineRoute(G, N2.p, 0);
  N2.walkRoute(up, { speed: SPEED.carry, pose: 'carry_walk', prop: 'wine_jug' });
  N2.holdFor(0.16, { pose: 'pour', ph: one(0.02, 0.15), h: S.cups.heading ?? 180, prop: 'wine_jug' });
  const t2 = N2.t;
  N2.walkRoute(reverseRoute(up), { speed: SPEED.kohen });
  N2.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'K_FW' });
  const tEnd = Math.max(t1, t2);
  B.cues.push({ t: tEnd - 0.12, key: 'nesachim', pos: S.cups.pos, range: 30, text: { en: `${label} — the wine poured into the silver cup at the south-west horn (Menachot 9:6; Zevachim 6:2)`, he: 'נִסּוּךְ הַיַּיִן' } });
  mark(B, 'nesachim', tN0, tEnd, { type: 'nesachim', zone: 'mizbeach', view: { at: G.V.top.at, heading: G.V.top.heading }, label });
  return tEnd;
}

// ------------------------------------------------------------------------------------------------ the nazir's set
/**
 * The nazir's three animals in the court, from the moment his party reaches the foot of Sha'ar HaKorban's flight
 * (minute 0). Roles: O the nazir (leads the ram), C1 a companion leading the two lambs, C2 one carrying the basket of
 * twenty loaves; then each animal in order — the chatat first, then the olah, then the shelamim, and only then he
 * shaves (Rambam Nezirut 8:2). The nazir leans on each and slaughters it (any Israelite may slaughter, Zevachim 3:1);
 * after the ram is slaughtered he goes down to his chamber in Ezrat Nashim to be shaved (Middot 2:5; Rambam Nezirut
 * 8:3), C2 with him with the basket; C1 waits for the ram: its eimurim, breast and thigh are set aside for the waving
 * (Rambam MK 9:9), the rest of it he takes down on his shoulder to be cooked in the chamber (ibid.). Returns the built
 * set with its sync times: { tNazirOut (he leaves the rings), pNazirOut, tMeat (C1 sets off with the meat), tEimurim }.
 */
export function scriptNazir(G, k, seed, places, back, F = null) {
  const B = Built('nazirites', 'nazir', 'nazir');
  B.role = `n${k}`;
  const r = rng(hashStr(`g4:nazir:${seed}:${k}`));
  const P4 = G.g4;
  const [ringA, ringB] = [P4.rings[places.rA], P4.rings[places.rB]];
  const [hC, hO, hR] = [P4.hooks[places.hC], P4.hooks[places.hO], P4.hooks[places.hR]];
  const O = new Track(null, 'O', 'nazir'), C1 = new Track(null, 'C1', 'companion'), C2 = new Track(null, 'C2', 'companion');
  const AC = new Track(null, 'AC', 'lamb'), AO = new Track(null, 'AO', 'lamb'), AR = new Track(null, 'AR', 'ram');
  B.tracks.push(O, C1, C2, AC, AO, AR);
  // ---- in at the foot of Sha'ar HaKorban's flight (Middot 1:5) — where their walk over the Mount ends — up the flight
  // to the rings: the nazir leads the ram, C1 the two lambs, C2 carries the basket, a little apart. Each leader's walk
  // begins a few metres back down the spur, so the animals behind him go on from where they were. By ring A each has
  // his own waiting place east of it, clear of where the kohanim will stand (⚙ places)
  const dt = { C1: 0.13, C2: 0.34 }, lagR = 1.4, lagL = [1.4, 2.3];
  const [X, Y] = ringA.ring;
  const spot = { O: [X + 3.6, Y - 1.9, D16], AR: [X + 3.6, Y + 1.4, D16], C2: [X + 4.7, Y + 0.5, D16], C1: [X + 2.7, Y + 2.7, D16], AC: [X + 1.7, Y + 3.3, D16], AO: [X + 3.0, Y + 3.8, D16] };
  const start = back[back.length - 1];
  const lead = (tr, t0, to, pose, prop) => {
    const g = G.route(start, to, { from: 'KOR_FOOT' });
    const pts = [...back.map((p) => p.slice()), ...g.path.points.slice(1).map((p) => [p.X, p.Y, p.Z])];
    const path = pathOf(pts, [...back.map(() => 1), ...Array.from(g.near).slice(1)]);
    const d0 = path.path.cum[back.length - 1];
    tr.at(t0, start, 0);
    walkFrom(tr, path, d0, { speed: SPEED.lead, pose, prop });
  };
  lead(O, 0, spot.O, 'lead_walk', null);
  AR.at(0, back[0], 0); AR.follow(O.lastWalk, lagR, { lead: 'O' });
  AR.step(spot.AR, { pose: 'walk_led', speed: 0.6, lead: 'O' });
  lead(C1, dt.C1, spot.C1, 'lead_walk', null);
  AC.at(dt.C1, back[0], 0); AC.follow(C1.lastWalk, lagL[0], { lead: 'C1' });
  AC.step(spot.AC, { pose: 'walk_led', speed: 0.6, lead: 'C1' });
  AO.at(dt.C1, back[0], 0); AO.follow(C1.lastWalk, lagL[1], { lead: 'C1' });
  AO.step(spot.AO, { pose: 'walk_led', speed: 0.6, lead: 'C1' });
  lead(C2, dt.C2, spot.C2, 'carry_shoulder_walk', 'loaves_todah');
  let t = Math.max(O.t, C1.t, C2.t, AR.t, AC.t, AO.t) + 0.3;
  O.hold(t, { pose: 'lead', h: 270 }); AR.hold(t, { pose: 'stand_halter', h: 270, lead: 'O' });
  C1.hold(t, { pose: 'lead', h: 270 }); AC.hold(t, { pose: 'stand_halter', h: 260, lead: 'C1' }); AO.hold(t, { pose: 'stand_halter', h: 280, lead: 'C1' });
  C2.hold(t, { pose: 'carry_shoulder', h: 270, prop: 'loaves_todah' });
  mark(B, 'arrive', 0, t, { type: 'nazir', zone: 'slaughter-zone', view: { at: G.V.korban.at, heading: G.V.korban.heading },
    label: 'The nazir comes in by Sha\'ar HaKorban with a ewe lamb, a lamb and a ram, and a basket of twenty loaves (Bamidbar 6:14–15)' });
  // the ram's rope to C2 (beside it) while the nazir leans on the lambs
  O.holdFor(0.3, { pose: 'lead', h: 0 });
  AR.hold(O.t, { pose: 'stand_halter', h: 270, lead: 'O' });
  C2.hold(O.t, { pose: 'carry_shoulder', h: 300, prop: 'loaves_todah' });
  AR.hold(O.t + 0.05, { pose: 'stand_halter', h: 270, lead: 'C2' });
  t = O.t + 0.1;
  C2.hold(t, { pose: 'carry_shoulder', h: 300, prop: 'loaves_todah' });
  // ---- the chatat (the ewe lamb) at ring A, C1 holding the olah's rope: the nazir leans and slaughters
  C1.hold(t, { pose: 'lead', h: 250 });
  AO.hold(t, { pose: 'stand_halter', h: 280, lead: 'C1' });
  const oC = animal(B, G, t, { type: 'chatat', sp: 'lamb', A: AC, lead: 'C1', O, ring: ringA, hook: hC, hideSpot: P4.hideSpots[0], r, roles: 'c', title: 'The nazir\'s chatat (a ewe lamb)', out: {}, medLane: 0, F });
  // ---- the olah (the lamb) at ring B, straight after: C1 leads it along the row of rings, the nazir follows
  const [XB, YB] = ringB.ring;
  t = Math.max(O.t, C1.t);
  C1.hold(t, { pose: 'lead', h: 250 });
  AO.hold(t, { pose: 'stand_halter', h: 280, lead: 'C1' });
  const c1B = [XB + 2.7, YB + 2.7, D16], aoB = [XB + 3.0, YB + 3.8, D16];
  const dWalk = (Math.hypot(c1B[0] - C1.p[0], c1B[1] - C1.p[1]) * AM) / 0.9 / 60;
  C1.step(c1B, { pose: 'lead_walk', speed: 0.9 });
  AO.step(aoB, { pose: 'walk_led', speed: (Math.hypot(aoB[0] - AO.p[0], aoB[1] - AO.p[1]) * AM) / (dWalk * 60), lead: 'C1' });
  O.step([XB + 3.6, YB - 1.9, D16], { pose: 'walk', speed: 0.9 });
  t = Math.max(C1.t, O.t, AO.t);
  C1.hold(t, { pose: 'lead', h: 250 });
  AO.hold(t, { pose: 'stand_halter', h: 270, lead: 'C1' });
  const oO = animal(B, G, t, { type: 'olah', sp: 'lamb', A: AO, lead: 'C1', O, ring: ringB, hook: hO, hideSpot: P4.hideSpots[1], r, roles: 'o', title: 'The nazir\'s olah (a lamb)', out: {}, medLane: 1, F, orAfter: oC.orEnd, bloodAfter: oC.blood + 0.1 });
  C1.hold(Math.max(C1.t, O.t), { pose: 'stand', h: 250 });
  // ---- the ram, back at ring A once the chatat has been lifted from it: C2 brings it
  O.step([X + 3.6, Y - 1.9, D16], { pose: 'walk', speed: 0.9 });
  const tR0 = Math.max(O.t, oC.lift + 0.3);
  O.hold(tR0, { pose: 'stand', h: 270 });
  C2.hold(tR0 - 0.4, { pose: 'carry_shoulder', h: 270, prop: 'loaves_todah' });
  AR.hold(tR0 - 0.4, { pose: 'stand_halter', h: 270, lead: 'C2' });
  C2.step([X + 2.7, Y + 2.6, D16], { pose: 'carry_shoulder_walk', speed: 0.6, prop: 'loaves_todah' });
  AR.hold(Math.max(tR0, C2.t), { pose: 'stand_halter', h: 270, lead: 'C2' });
  C2.hold(Math.max(tR0, C2.t), { pose: 'carry_shoulder', h: 250, prop: 'loaves_todah' });
  const oR = animal(B, G, Math.max(tR0, C2.t), { type: 'shelamim', sp: 'ram', A: AR, lead: 'C2', O, ring: ringA, hook: hR, r, roles: 'r', title: 'The nazir\'s ram (shelamim)', out: {}, medLane: 2, F });
  // the waiting places by the rings are the set's from its arrival until the ram is lifted
  uses(B, ringA.id, 0, oR.lift + 0.1);
  uses(B, ringB.id, oC.lift - 6, oO.lift + 0.1);
  // ---- he goes down to his chamber to shave (after the slaughter of the shelamim — Rambam Nezirut 8:2); C2 with him
  const tNazirOut = O.t + 0.1;
  const gate0 = tNazirOut;
  O.holdFor(0.1, { pose: 'stand', h: 90 });
  O.walk(G, 'STEP_FOOT', { speed: SPEED.owner, to: 'NIK_W' });
  const tC2 = Math.max(C2.t, tNazirOut + 0.05);
  C2.hold(tC2, { pose: 'carry_shoulder', h: 90, prop: 'loaves_todah' });
  C2.walk(G, add([G.N.STEP_FOOT.X, G.N.STEP_FOOT.Y, G.N.STEP_FOOT.Z], 0, 1.6), { speed: SPEED.owner, pose: 'carry_shoulder_walk', prop: 'loaves_todah', to: 'NIK_W' });
  // through Nikanor's gateway (kept clear of the metzora's rites there: nikanor-stations books them first)
  uses(B, 'gate:nikanor', gate0, Math.max(O.t, C2.t));
  // ---- the olah's limbs and the chatat's eimurim and meat, the libations of the olah and the ram
  const lim = fitSub(B, F, oO.dressed, (S, tt) => limbsUp(S, G, tt, hO, 'The nazir\'s olah', r), { g5: 'limbs' });
  oO.hungFinal.t1 = oO.dressed + lim.d + 0.3;
  const tLimbs = lim.end;
  const ce = fitSub(B, F, oC.dressed, (S, tt) => eimurimUp(S, G, tt, hC, 'The nazir\'s chatat', { meat: true, type: 'chatat', mealParent: 'kodashim-meal' }));
  oC.hungFinal.t1 = ce.S.tTake + 0.1;
  const tCe = ce.end;
  const tNes = fitSub(B, F, Math.max(tLimbs, oR.blood), (S, tt) => nesachim(S, G, tt, 'The libations of the nazir\'s olah and ram (Bamidbar 6:17; Menachot 9:6)'), { g5: 'nesachim' }).end;
  // ---- the ram: its eimurim, breast and thigh taken off and set aside on the table for the waving (Rambam MK 9:9);
  // C1 waits by the hooks and takes the rest down on his shoulder to be cooked in the nazirites' chamber
  const K2 = oR.K2;
  const tDress = oR.dressed;
  K2.hold(Math.max(K2.t, tDress), { pose: 'stand', h: 180 });
  K2.step(hR.flayer, { pose: 'walk', speed: 0.8 });
  K2.holdFor(0.3, { pose: 'flay', h: hR.fh, prop: 'knife_flay' });
  K2.step(hR.table.stand, { pose: 'carry_walk', speed: 0.8, prop: 'bowl' });
  K2.holdFor(0.3, { pose: 'carry', h: 180, prop: 'bowl' });
  K2.walk(G, 'MOK_X', { speed: SPEED.kohen });
  uses(B, `${hR.table.id}:${hR.id}`, tDress, NaN);
  const tableUse = B.res[B.res.length - 1];
  const meetAt = add(hR.flayer, hR.fh === 90 ? -1.2 : 1.2, -0.6);
  C1.walk(G, meetAt, { speed: SPEED.owner });
  C1.hold(Math.max(C1.t, tDress + 0.5), { pose: 'stand', h: headTo(meetAt, hR.flayer) });
  const tTake = C1.t;
  oR.hungFinal.t1 = tTake + 0.1;
  C1.holdFor(0.3, { pose: 'carry_shoulder', h: headTo(meetAt, hR.flayer), prop: 'lamb_carcass' });
  const tMeat = C1.t;
  const tC1g = C1.t;
  C1.walk(G, 'STEP_FOOT', { speed: SPEED.carry, pose: 'carry_shoulder_walk', prop: 'lamb_carcass', to: 'NIK_W' });
  uses(B, 'gate:nikanor', tC1g + 0.4 * (C1.t - tC1g), C1.t);
  mark(B, 'takeout', tTake, C1.t, { type: 'shelamim', zone: 'ezrat-yisrael', view: { at: G.V.nikanor.at, heading: G.V.nikanor.heading },
    label: 'The ram\'s meat carried down through Nikanor to the nazirites\' chamber, to be cooked; its eimurim, breast and thigh wait for the waving (Rambam MK 9:9)' });
  B.sync = { tNazirOut, pNazirOut: O.p.slice(), tNazirFoot: O.t, tC2Foot: C2.t, pC2Foot: C2.p.slice(),
    tMeat, tMeatFoot: C1.t, pMeatFoot: C1.p.slice(), tableUse, tableStand: hR.table.stand, hook: hR, tNes, tCe, dtC1: dt.C1, dtC2: dt.C2, lagR, lagL };
  B.title = { en: 'The nazir completes his term — his three offerings', he: 'קָרְבְּנוֹת נָזִיר' };
  return B;
}

/**
 * The waving, later the same day (minute 0: the kohen reaches the pot): KW1 comes down from Beit HaMoked through the
 * court and Nikanor to the nazirites' chamber, takes the cooked foreleg from the pot and a loaf and a wafer from the
 * basket (Nazir 6:9 "the kohen takes the cooked foreleg") and goes up with the nazir behind him to the waving place
 * east of the altar; KW2 brings the breast, the thigh and the eimurim from the marble table where they were set aside.
 * There everything is on the nazir's palms, the kohen's hands beneath, and it is waved (Rambam MK 9:9); KW2 then salts
 * the eimurim on the ramp and burns them; the breast and thigh are the kohanim's. sync: { tTake, tW, dur, owner,
 * ownerIn } (set-relative).
 */
export function scriptWaving(G, k, seed, sy, place, F = null) {
  const B = Built('nazirites', 'nazir', 'nazir');
  B.role = `w${k}`;
  const W = G.g4.wave;
  const K1 = new Track(null, 'KW', 'kohen'), K2 = new Track(null, `w${k}K3`, 'kohen');
  B.tracks.push(K1, K2);
  const { potAt, basketAt } = place;
  const foot = [G.N.STEP_FOOT.X, G.N.STEP_FOOT.Y, G.N.STEP_FOOT.Z];
  const chamberIn = [foot, [300, 324.5, 6], [360, 321, 6], [375, 309, 6], [375, 302, 6]];
  const atPot = [potAt[0] - 2.3, potAt[1] + 0.2, 6], atBasket = [basketAt[0] + 0.2, basketAt[1] + 1.4, 6];
  // down to the chamber
  const g1 = G.route('MOK_X', foot, { to: 'STEP_FOOT' });
  const down = pathOf([...g1.path.points.map((p) => [p.X, p.Y, p.Z]), ...chamberIn.slice(1), atBasket, atPot]);
  const dDown = down.length / SPEED.kohen / 60;
  K1.at(-dDown, [G.N.MOK_X.X, G.N.MOK_X.Y, G.N.MOK_X.Z], 180);
  K1.walkRoute(down, { speed: SPEED.kohen });
  K1.holdFor(0.25, { pose: 'kneel', ph: fix(0.35), h: 90 });
  K1.holdFor(0.2, { pose: 'carry', h: 90, prop: 'limb_foreleg' });
  const tTake = K1.t;
  mark(B, 'nikanor', 0, tTake, { type: 'nazir', zone: 'en-chamber-nazirites', view: { at: [380, 283, 6], heading: 170 }, label: 'A kohen takes the cooked foreleg from the pot, and a loaf and a wafer from the basket (Nazir 6:9)' });
  // up with the nazir behind him to the waving place (his own side: from the west)
  const upPts = [atPot, ...[...chamberIn].reverse().slice(1)];
  const g2 = G.route(foot, W.kohenIn, { from: 'STEP_FOOT' });
  const up = pathOf([...upPts, ...g2.path.points.slice(1).map((p) => [p.X, p.Y, p.Z]), W.kohen]);
  K1.walkRoute(up, { speed: 1.0, pose: 'carry_walk', prop: 'limb_foreleg', prop2: 'chavitin' });
  const tW = K1.t + 0.25;
  K1.hold(tW, { pose: 'carry', h: 90, prop: 'limb_foreleg', prop2: 'chavitin' });
  // KW2 with the bowl from the table
  arriveAt(G, K2, 'MOK_X', sy.tableStand, tW - 2.6);
  K2.holdFor(0.25, { pose: 'carry', h: 180, prop: 'bowl' });
  K2.walk(G, add(W.kohen, -0.2, 1.4), { speed: SPEED.carry, pose: 'carry_walk', prop: 'bowl' });
  K2.hold(tW, { pose: 'carry', h: 120, prop: 'bowl' });
  // the waving
  const dur = 2.2;
  K1.hold(tW + 0.2, { pose: 'carry', h: 90 });
  K1.hold(tW + dur, { pose: 'carry', h: 90 });
  K2.hold(tW + dur, { pose: 'stand', h: 120 });
  mark(B, 'tenufah', tW, tW + dur, { type: 'nazir', zone: 'ezrat-kohanim', view: { at: [W.owner[0] + 3.4, W.owner[1] + 4.6, D16], heading: 215 },
    label: 'The cooked foreleg, a loaf and a wafer, with the breast, the thigh and the eimurim, on the nazir\'s palms; the kohen\'s hands beneath — waved (Nazir 6:9; Rambam MK 9:9)' });
  K1.holdFor(0.3, { pose: 'stand', h: 90 });
  K1.walk(G, 'MOK_X', { speed: SPEED.kohen });
  // the eimurim up and onto the pile (when the ramp's salting place and the pile are free); the breast and thigh are
  // the kohanim's
  K2.holdFor(0.2, { pose: 'carry', h: 120, prop: 'bowl' });
  fitSub(B, F, K2.t, (S, tt) => {
    const Kx = new Track(null, K2.role, 'kohen');
    S.tracks.push(Kx);
    Kx.at(tt, K2.p, K2.h);
    const t0 = Kx.t;
    Kx.walk(G, G.S.saltE, { speed: SPEED.carry, pose: 'carry_walk', prop: 'bowl', to: 'K_FW' });
    Kx.holdFor(0.08, { pose: 'kneel', ph: fix(0.3), h: 90, prop: 'bowl' });
    Kx.holdFor(0.35, { pose: 'salt', h: 90, prop: 'salt', hand: 'left' });
    const syE = G.S.saltE[1];
    Kx.step([220.6, syE + 1.2, G.kevZ(syE + 1.2)], { pose: 'carry_walk', prop: 'bowl', speed: 0.9 });
    Kx.walk(G, [G.S.pileFaceX, 321.5 + 2.4, 25], { speed: SPEED.carry, pose: 'carry_walk', prop: 'bowl', from: 'KE_MID', to: 'TP_E' });
    Kx.holdFor(0.1, { pose: 'throw', ph: one(), h: 270, prop: 'bowl' });
    mark(S, 'haalaah', t0, Kx.t, { type: 'shelamim', zone: 'mizbeach', view: { at: G.V.ramp.at, heading: G.V.ramp.heading }, label: 'The ram\'s eimurim salted and burned; now the nazir may drink wine (Nazir 6:9)' });
    const te = Kx.t;
    Kx.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'TP_E' });
    return te;
  }, { graftFirst: K2, max: 20 });
  // the waving place and the table are this set's while it is used
  uses(B, 'wave', tW - 1.5, tW + dur + 0.6);
  // the kohen down and up through Nikanor, the nazir up with him and back down after the waving
  uses(B, 'gate:nikanor', -dDown * 0.6, tW);
  uses(B, 'gate:nikanor', tW + dur + 0.2, tW + dur + 2.2);
  uses(B, `${sy.hook.table.id}:${sy.hook.id}`, tW - 2.7, tW - 2.0);
  B.tracks = B.tracks.filter((tr) => tr.segs.length);
  B.title = { en: 'The nazir\'s waving', he: 'תְּנוּפַת הַנָּזִיר' };
  B.sync = { tTake, tW, dur, owner: W.owner, ownerIn: W.ownerIn };
  return B;
}

// ------------------------------------------------------------------------------------------------ the metzora's
/**
 * The healed metzora's chatat and olah (lambs), after the asham's rites: each led by a kohen (K0) from Sha'ar HaKorban
 * to the gateway of Nikanor, broadside within his reach — he leans on it from the gateway, his hands stretched in, as
 * on the asham (he may not enter before his atonement — Rambam MK 3:12, Mechusrei Kapparah 4:2 ⚙ for these two) —
 * then to its ring, slaughtered by the kohen, its blood (the chatat first), the limbs and eimurim, the chatat's meat to
 * the kohanim; then the libations of all three animals (Menachot 9:6; three esronim of flour mixed with oil, Negaim
 * 14:7). tLean: when the first is at the gate (minute 0 of the built set = when K0 appears). Returns the set with
 * sync.lean = [[t0, t1], [t0, t1]] (the two leanings, set-relative) and sync.atoned (the chatat's blood done).
 */
export function scriptMetzora(G, seed, places, gateAt, F = null) {
  const B = Built('metzora', 'metzora', 'metzora');
  B.role = 'm';
  const r = rng(hashStr(`g4:metzora:${seed}`));
  const P4 = G.g4;
  const rings = [places.rC === 'm' ? P4.metzoraRing : P4.rings[places.rC], P4.rings[places.rO]];
  const hooks = [P4.hooks[places.hC], P4.hooks[places.hO]];
  const foot = [G.N.KOR_FOOT.X, G.N.KOR_FOOT.Y, G.N.KOR_FOOT.Z];
  const lean = [];
  const outs = [];
  let tNext = 0;
  ['chatat', 'olah'].forEach((type, j) => {
    // his agent brings it in by Sha'ar HaKorban (an Israelite: the kohanim in their garments do not go out to the city)
    // to the gateway, where he leans on it; a kohen takes it from there to its ring and slaughters it
    const AG = new Track(null, `m${j}AG`, 'israelite'), K0 = new Track(null, `m${j}K0`, 'kohen'), A = new Track(null, `m${j}A`, 'lamb');
    B.tracks.push(AG, K0, A);
    const start = j === 0 ? 0 : tNext;
    AG.at(start, foot, 180); A.at(start, foot, 180);
    AG.walk(G, [252.9, gateAt[1] + 1.4, 13.5], { speed: SPEED.lead, pose: 'lead_walk', from: 'KOR_HEAD' });
    A.follow(AG.lastWalk, 1.0, { lead: `m${j}AG` });
    // broadside before the gate, its head within his reach; he leans from the gateway
    const tL0 = Math.max(AG.t, A.t) + 0.3;
    A.step([254.3, gateAt[1] - 0.3, 13.5], { pose: 'walk_led', speed: 0.6, lead: `m${j}AG` });
    A.hold(tL0 + 1.3, { pose: 'stand_halter', h: 0, lead: `m${j}AG` });
    AG.hold(tL0 + 1.3, { pose: 'lead', h: 160 });
    lean.push([tL0, tL0 + 1.3]);
    mark(B, 'semichah', tL0, tL0 + 1.3, { type, zone: 'nikanor', view: { at: [266, 331.5, 13.5], heading: 266 }, label: `The metzora leans on his ${type === 'chatat' ? 'chatat' : 'olah'} from the gateway, his hands stretched into the court` });
    // the kohen takes it to its ring; the agent goes out the way he came
    arriveAt(G, K0, 'MOK_X', [252.4, gateAt[1] - 1.6, 13.5], tL0 + 1.0);
    K0.hold(tL0 + 1.4, { pose: 'lead', h: 0 });
    AG.walk(G, 'KOR_FOOT', { speed: SPEED.owner, to: 'KOR_HEAD' });
    const ringPath = G.route(K0.p, rings[j].hold, {});
    K0.walkRoute(ringPath, { speed: 0.9, pose: 'lead_walk' });
    A.follow(K0.lastWalk, 1.0, { lead: `m${j}K0` });
    const t = Math.max(K0.t, A.t) + 0.1;
    K0.hold(t, { pose: 'lead', h: 270 });
    A.hold(t, { pose: 'stand_halter', h: 270, lead: `m${j}K0` });
    const o = animal(B, G, t, { type, sp: 'lamb', A, lead: `m${j}K0`, O: null, K0, lean: false, ring: rings[j], hook: hooks[j], hideSpot: P4.hideSpots[j], r, roles: `m${j}`,
      title: `The metzora's ${type === 'chatat' ? 'chatat' : 'olah'} (a lamb)`, out: {}, medLane: j, bloodParent: 'metzora', F, bloodAfter: j === 1 ? outs[0].blood + 0.1 : undefined });
    K0.walk(G, 'MOK_X', { speed: SPEED.kohen });
    outs.push(o);
    // the olah is brought once the chatat is at its ring (the chatat's blood comes first: Zevachim 10:2)
    if (j === 0) tNext = Math.max(0, o.blood - 4.5);
  });
  const [oC, oO] = outs;
  const lim = fitSub(B, F, oO.dressed, (S, tt) => limbsUp(S, G, tt, hooks[1], 'The metzora\'s olah', r), { g5: 'limbs' });
  oO.hungFinal.t1 = oO.dressed + lim.d + 0.3;
  const ce = fitSub(B, F, oC.dressed, (S, tt) => eimurimUp(S, G, tt, hooks[0], 'The metzora\'s chatat', { meat: true, type: 'chatat', mealParent: 'kodashim-meal' }));
  oC.hungFinal.t1 = ce.S.tTake + 0.1;
  fitSub(B, F, lim.end, (S, tt) => nesachim(S, G, tt, 'The libations of the metzora\'s three offerings — three tenths of flour mixed with oil, and wine (Negaim 14:7; Menachot 9:6)'), { g5: 'nesachim' });
  B.sync = { lean, atoned: Math.max(oC.blood, oO.blood) };
  B.tracks = B.tracks.filter((tr) => tr.segs.length);
  B.title = { en: 'The healed metzora\'s chatat and olah', he: 'חַטָּאת וְעוֹלַת הַמְּצֹרָע' };
  return B;
}

// ------------------------------------------------------------------------------------------------ placing a set
/** shift a built set to clock minute s (in place; its sync times stay set-relative: add B.s) */
export function shiftSet(B, s) {
  for (const tr of B.tracks) tr.shift(s);
  for (const st of B.steps) { st.t0 += s; st.t1 += s; }
  for (const p of B.props) { p.t0 += s; p.t1 += s; }
  for (const c of B.cues) c.t += s;
  for (const u of B.res) { u.a += s; u.b += s; }
  B.s = (B.s || 0) + s;
  return B;
}

/**
 * The shared places at the altar a built set's figures hold or walk through (as g5/plan.js hotOf, against private-
 * offerings' own list of places), as [[t0, t1], …] per place, at the set's nominal start.
 */
function hotOf(H, B) {
  const out = H.map(() => []);
  for (const tr of B.tracks) {
    if (tr.pool === 'lamb' || tr.pool === 'ram') continue;
    for (const sg of tr.segs) {
      H.forEach((h, hi) => {
        const [cx, cy] = h.c, rr = h.r, [z0, z1] = h.z;
        if (sg.kind === HOLD) { if (sg.Z > z0 && sg.Z < z1 && Math.hypot(sg.X - cx, sg.Y - cy) < rr) out[hi].push([sg.t0 - 0.04, sg.t1 + 0.04]); return; }
        if (sg.kind !== WALK) return;
        const pts = sg.path.points, cum = sg.path.cum, span = sg.d1 - sg.d0, dur = sg.t1 - sg.t0;
        if (!(span > 0)) return;
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i], b = pts[i + 1];
          if (!(Math.min(a.Z, b.Z) < z1 && Math.max(a.Z, b.Z) > z0)) continue;
          const dx = b.X - a.X, dy = b.Y - a.Y, fx = a.X - cx, fy = a.Y - cy;
          const A = dx * dx + dy * dy, Bq = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - rr * rr;
          let u0 = 0, u1 = 1;
          if (A < 1e-9) { if (C > 0) continue; } else {
            const disc = Bq * Bq - 4 * A * C;
            if (disc <= 0) continue;
            const q = Math.sqrt(disc);
            u0 = Math.max(0, (-Bq - q) / (2 * A)); u1 = Math.min(1, (-Bq + q) / (2 * A));
            if (u1 <= u0) continue;
          }
          const dA = cum[i] + u0 * (cum[i + 1] - cum[i]), dB = cum[i] + u1 * (cum[i + 1] - cum[i]);
          const lag = sg.lag || 0;
          out[hi].push([sg.t0 + ((dA + lag - sg.d0) / span) * dur - 0.04, sg.t0 + ((dB + lag - sg.d0) / span) * dur + 0.04]);
        }
      });
    }
  }
  return out;
}

/**
 * Is the built set (at nominal start 0) free when shifted by s? Its rings, hooks, tables and rinsing places in the
 * G4 register, the altar's shared places in G5's bookings (P5.hot) and in the register. Returns true / false.
 */
export function setFits(B, s, book, P5, hot) {
  if (B.failed) return false;
  for (const u of B.res) {
    const b = Number.isFinite(u.b) ? u.b : u.a + 30;
    if (!book.resource(u.id).free(u.a + s, b + s)) return false;
  }
  for (const p of B.props) if (!book.resource(p.hook).free(p.t0 + s - 0.3, (Number.isFinite(p.t1) ? p.t1 : p.t0 + 20) + s + 0.3)) return false;
  if (hot) {
    for (let i = 0; i < hot.length; i++) for (const [a, b] of hot[i]) {
      if (P5?.hot?.[i]?.book?.hits?.(a + s, b + s)) return false;
      if (!book.resource(`hot:${P5?.hot?.[i]?.id ?? i}`).free(a + s, b + s)) return false;
    }
  }
  return true;
}
/** book a placed (already shifted) set in the register (its resources, hooks, altar places); returns the handles */
export function bookSet(B, book, P5, hot, who, H = null, own = null) {
  const h = [];
  for (const u of B.res) h.push(book.resource(u.id).add(u.a, Number.isFinite(u.b) ? u.b : u.a + 30, who));
  for (const p of B.props) h.push(book.resource(p.hook).add(p.t0 - 0.3, (Number.isFinite(p.t1) ? p.t1 : p.t0 + 20) + 0.3, who));
  const ids = (H || []).map((x) => x.id);
  if (hot) hot.forEach((list, i) => { for (const [a, b] of list) h.push(book.resource(`hot:${ids[i] ?? P5?.hot?.[i]?.id ?? i}`).add(a, b, who)); });
  for (const [a, b, k] of own || []) h.push(book.resource(`g4:${k}`).add(a, b, who));
  return h;
}
/** the hot places to check: private-offerings' list when its plan is there, else the same places by default */
export function hotPlaces(G, P5) {
  if (P5?.hot?.length) return P5.hot;
  const S = G.S;
  return [{ id: 'sw', c: S.swPoint.pos, r: 1.3, z: [15, 17.6] }, { id: 'drop', c: S.drop.pos, r: 1.1, z: [15, 17.6] },
    { id: 'se', c: [S.seBird.pos[0] - 1.2, S.seBird.pos[1] + 0.4], r: 2.2, z: [21, 23.6] }, { id: 'ne', c: S.altarNE.pos, r: 1.2, z: [15, 17.6] },
    { id: 'pile', c: [S.pileFaceX, (S.pileY[0] + S.pileY[1]) / 2], r: 4.6, z: [24, 26.5] }, { id: 'cups', c: S.cups.pos, r: 1.8, z: [24, 26.5] },
    { id: 'salt', c: S.saltE, r: 1.6, z: [16.5, 21.5] }];
}
/**
 * Place a set: build it for clock minute s0 + d (d = 0, step, …, maxShift) with a fit context — so each of its
 * activities at the altar waits for its own free moment (fitSub) — until its rings, hooks, tables and other places in
 * the G4 register are free; null when it never fits. Returns { B (shifted to the clock), hot (its altar places,
 * absolute, to book) }. build(F) → the set at minute 0.
 */
export function placeSet(build, s0, book, P5, G, { step = 2, maxShift = 90 } = {}) {
  const H = hotPlaces(G, P5);
  const w = g5Windows(P5);
  const builds = Array.isArray(build) ? build : [build];
  // the earliest start (then the first of the ways to lay it out) that fits
  for (let d = 0; d <= maxShift; d += step) {
    for (const b of builds) {
      const F = { abs: s0 + d, H, P5, book, local: H.map(() => []), g5: w, own: [] };
      let B;
      try { B = b(F); } catch (e) { if (e === ABORT) continue; throw e; }
      if (setFits(B, s0 + d, book, P5, null)) { shiftSet(B, s0 + d); return { B, hot: F.local, H, own: F.own }; }
    }
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ posing
/**
 * The figures of the placed sets, on the module's own pools: assign(tracks) gives every track a pool slot free over
 * its time (pools: { role pool name → ActorPool }), update() poses each slot's current track as private-offerings
 * does. Free props: the hung carcass stages on the G4 hooks.
 */
export class SetCast {
  constructor(ctx, pools) {
    this.ctx = ctx;
    this.pools = pools;
    this.slots = {};                  // pool → [[tracks sorted]]
    for (const [k, p] of Object.entries(pools)) this.slots[k] = Array.from({ length: p.count }, () => []);
    this.props = [];
    this.o = {}; this.tmp = {};
    this.free = new Map();
    this.missing = 0;
  }
  reset() { for (const k of Object.keys(this.slots)) for (const l of this.slots[k]) l.length = 0; this.props = []; this.missing = 0; }
  /** give each track a slot (forced: { track → slot index } for figures that must be a given slot) */
  assign(B, forced = new Map()) {
    const byRole = {};
    for (const tr of B.tracks) byRole[tr.role] = tr;
    for (const tr of B.tracks) {
      tr.byRole = byRole;
      const lists = this.slots[tr.pool];
      if (!lists) { tr.slot = -1; continue; }
      let k = forced.has(tr) ? forced.get(tr) : -1;
      if (k < 0) for (let i = 0; i < lists.length; i++) if (!lists[i].some((x) => x.t0 < tr.t1 + 0.1 && x.t1 > tr.t0 - 0.1)) { k = i; break; }
      if (k < 0) { tr.slot = -1; this.missing++; continue; }
      tr.slot = k;
      lists[k].push(tr);
      lists[k].sort((a, b) => a.t0 - b.t0);
      for (const sg of tr.segs) sg.pkey = sg.prop2 ? `${sg.prop}|${sg.prop2}` : `${sg.prop || ''}|${sg.hand || 'right'}`;
    }
    for (const p of B.props) this.props.push(p);
    this.props.sort((a, b) => a.t0 - b.t0);
  }
  /** pose every slot holding a track at t */
  update(sim, t, dt) {
    const forced = sim.forced;
    for (const pool of Object.keys(this.slots)) {
      const lists = this.slots[pool], ap = this.pools[pool];
      for (let i = 0; i < lists.length; i++) {
        const list = lists[i];
        if (!list.length) continue;
        const tr = trackAt(list, t);
        if (!tr) continue;
        const slot = ap.slot(i);
        if (!sim.due(slot)) continue;
        this.pose(slot, tr, t, dt, forced);
      }
    }
    this.poseProps(t);
  }
  pose(slot, tr, t, dt, forced) {
    let k = segAt(tr.segs, t);
    if (k < 0) k = Math.max(0, upperBound(tr.segs.map((s) => s.t0), t) - 1);
    const s = tr.segs[k];
    const o = sampleSeg(s, t, this.o, this.tmp);
    if (slot._by !== 'set') { slot._by = 'set'; slot._pkey = null; slot._p2 = 'set'; slot._leg = null; slot._hs = NaN; }
    if (s.kind === CARRIED) slot.place(o.X, o.Y, o.Z + o.up);
    else if (o.near) slot.placeNear(o.X, o.Y, o.Z);
    else slot.place(o.X, o.Y, o.Z);
    let h = o.h;
    if (!forced && Number.isFinite(slot._hs) && dt > 0) {
      const d = angleDiff(slot._hs, h), max = TURN_RATE * dt;
      h = Math.abs(d) <= max ? h : (slot._hs + Math.sign(d) * max + 360) % 360;
    }
    slot._hs = h;
    slot.heading(h);
    let ph;
    if (s.ph?.k === 'walk') { const f = this.ctx.people?.util?.phaseFor; ph = f && slot.actor ? f(slot.actor, s.pose, Math.max(0, o.d)) : (o.d / 1.45) % 1; }
    else ph = phaseOf(s, t);
    slot.pose(s.pose, ph);
    if (s.kind !== CARRIED && slot._pkey !== s.pkey) {
      slot._pkey = s.pkey;
      const a = slot.ensure();
      if (s.prop2) a.setProps?.(s.prop, s.prop2);
      else { a.setProps?.(null, null); a.setProp(s.prop || null, s.hand || 'right'); }
      slot._prop = s.prop || null; slot._hand = s.hand || 'right';
    }
    if (tr.pool === 'lamb' || tr.pool === 'ram') {
      const lt = s.lead ? tr.byRole?.[s.lead] : null;
      const leader = lt && lt.slot >= 0 && t >= lt.t0 && t < lt.t1 ? this.pools[lt.pool]?.slot(lt.slot)?.actor : null;
      if (slot._lead !== leader) { slot._lead = leader; slot.actor?.setLead?.(leader || null); }
    }
    slot.show();
  }
  /** the hung carcass stages on the hooks (one free prop per hook and stage) */
  poseProps(t) {
    const on = this._on || (this._on = new Set());
    on.clear();
    for (const p of this.props) {
      if (p.t0 > t) break;
      if (!(t < p.t1)) continue;
      const f = this.prop(p.hook, p.name);
      if (!f) continue;
      on.add(f);
      const key = `${p.at[0]},${p.at[1]},${p.at[2]},${p.h}`;
      if (f.key !== key) { f.key = key; f.a.setSite(p.at[0], p.at[1], p.at[2]); f.a.setHeading(p.h); }
      if (!f.on) { f.on = true; f.a.setVisible(true); }
    }
    for (const f of this.free.values()) if (f.on && !on.has(f)) { f.on = false; f.a.setVisible(false); }
  }
  prop(hook, name) {
    const k = `${hook}|${name}`;
    let f = this.free.get(k);
    if (f === undefined) {
      let a = null;
      try { a = this.ctx.people?.spawnProp?.(name, { seed: hashStr(k) }) || null; a?.setVisible?.(false); } catch { a = null; }
      f = a ? { a, on: false, key: '' } : null;
      this.free.set(k, f);
    }
    return f;
  }
  hide() { for (const f of this.free.values()) if (f?.on) { f.on = false; f.a.setVisible(false); } }
  dispose() { for (const f of this.free.values()) f?.a?.dispose?.(); this.free.clear(); }
}
function trackAt(list, t) {
  let lo = 0, hi = list.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m].t0 <= t) { k = m; lo = m + 1; } else hi = m - 1; }
  if (k < 0) return null;
  const tr = list[k];
  return t < tr.t1 ? tr : null;
}

// ------------------------------------------------------------------------------------------------ watchable rows
/**
 * The placed sets' steps as rows of the schedule ("Happening now", the map) through private-offerings' own source
 * (g5/dynamic.js): each set is one row, at its current step, with a view of it, under its event (the nazirites',
 * the metzora's, or the kohanim's meal for the chatat's meat). getSets() → the placed sets of the current plan.
 */
export function setsSource(ctx, id, getSets) {
  const parents = new Set(['nazirites', 'metzora', 'kodashim-meal', 'private-offerings']);
  const cache = { list: null, P: null };
  const getPlan = () => {
    let sets = null;
    try { sets = getSets(); } catch { sets = null; }
    if (!sets) return null;
    if (cache.list !== sets) {
      cache.list = sets;
      const insts = sets.filter((B) => B.steps.length).map((B, i) => {
        const t0 = Math.min(...B.tracks.map((tr) => tr.t0)), t1 = Math.max(...B.tracks.map((tr) => tr.t1));
        return { id: `set:${B.type}:${B.role}:${i + 1}`, type: B.type, kind: 'set', lane: 0, steps: [...B.steps].sort((a, b) => a.t0 - b.t0), tracks: B.tracks,
          title: B.title, t0, t1, tEnd: Math.max(...B.steps.map((st) => st.t1)), ev: null, cur: -1, job: null };
      }).sort((a, b) => a.t0 - b.t0);
      cache.P = { ok: true, insts, instT0: Float64Array.from(insts, (x) => x.t0), maxDur: insts.reduce((m, x) => Math.max(m, x.t1 - x.t0), 0), parents, G: { lanes: [] } };
    }
    return cache.P;
  };
  // its rows' ids are 'set:<type>:<role>:<n>' (private-offerings' own are 'offering:…': byId never confuses them)
  const src = createSource(ctx, getPlan, { prefix: 'set:' });
  src.id = id;
  return src;
}

export { smooth };
