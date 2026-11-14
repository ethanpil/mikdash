// Group G7 (Rosh Chodesh) — the musaf of the new moon as one per-date plan of Scripts and free props (Bamidbar
// 28:11–15; Rambam Temidin uMusafin 6:3, 7:1–2; Yoma 2:5–7; Zevachim 5:3–4; Tamid 4:2–3). Not a choreo module itself
// (the runtime loads only src/sim/choreo/*.js): rosh-chodesh-musaf.js runs it. Pure function of (date, its zmanim,
// the events' windows): no ctx.audio, no import.meta (Node can build it — src/sim/dev/tests/rosh-chodesh.js).
//
//   brought    eleven animals up the flight of Sha'ar HaKorban (Middot 1:5, as the Shabbat musaf ⚙), each led by the
//              man who will flay it, before the window: two bulls, a ram, seven lambs and a goat, in the verse's order
//              (Bamidbar 28:11, 15), to their rings — the bulls in the last row, the ram and the goat in the east
//              column, the lambs in the second and third rows ⚙; the lanes between the ring columns (x 209, 217, 225)
//   slaughter  three slaughterers, each with his receiver, at once ⚙ (not recorded), in the verse's order: bulls, ram,
//              lambs, then the goat. Bound as the tamid, head south, face west (Tamid 4:1); two kneel to hold a lamb, three
//              a ram, four a bull ⚙. An olah's blood thrown at the NE and SW corners below the red line, the rest on the
//              southern yesod (Zevachim 5:4); the goat's put with the finger on the four horns from the sovev, SE → NE →
//              NW → SW, the rest on the southern yesod (Zevachim 5:3; Rambam MK 5:7, 5:10)
//   flaying    lambs, ram and goat hung from a hook of the dwarf pillars by the man who led them (Tamid 4:2), the ram from
//              the middle row as G5 hangs it; the bulls flayed on the pavement where they fell, two men to each ⚙ (a bull
//              does not clear the pavement from a hook — site.js altar.nanasin)
//   the file   each animal's carriers (Yoma 2:5–7: a bull 24, the ram 11, a lamb 8 — the tamid's nine without the
//              chavitin ⚙) come for their parts as they are cut, stand in a row with them, then go together (Tamid 4:3),
//              by the west of the court and the south of the altar to the ramp, up its east half (Zevachim 6:3), to the
//              walk of the kohanim's feet on the east side between the horns, where the parts are laid "to make it known
//              that it is Rosh Chodesh" (Rambam TuM 6:3), salted there and thrown on the great pile ⚙ (when, not
//              recorded); one procession on the east side at a time. Bulls last (their flaying is longest) ⚙
//   flour      the minchah of the nesachim, thrown on the fire after the limbs; wine poured at the SW horn, up the west
//              half "and back on his heels" (Zevachim 6:3), one man after another ⚙; the last bull's last jug is laid on
//              the lower ramp (as the tamid's wine — Tamid 4:3) for libation-song's pourer, whose pour starts the song
//   goat       its fats (eimurim_goat) up after the olot's limbs (Zevachim 10:2: "the limbs of an olah before the fats of a
//              chatat"); its meat left hanging for the kohanim's meal (Zevachim 5:3 — not staged)
// ⚙ = staging (docs/decisions/rosh-chodesh.md). Absolute minutes, unwrapped near sunrise; wrapped at the end.
import { Script, SPEED, jit, walkMin } from '../g2/lib.js';
import { places, rampDown } from '../g2/places.js';
import { CARRIERS_FALLBACK } from '../g2/tamid.js';

export const Z = 16;

/** the eleven animals in the verse's order; ring (site amot), hook pillar (lamb/ram/goat), team, crew pool & first slot */
export const ANIMALS = [
  { key: 'bullA', kind: 'bull', pool: 'bulls', slot: 0, ring: [213, 367.5], lane: 209, team: 0, crew: 'bullA' },
  { key: 'bullB', kind: 'bull', pool: 'bulls', slot: 1, ring: [221, 367.5], lane: 225, team: 1, crew: 'bullB' },
  { key: 'ram', kind: 'ram', pool: 'ram', slot: 0, ring: [229, 363.5], lane: 225, team: 2, crew: 'ram', pillar: 6 },
  { key: 'L1', kind: 'lamb', pool: 'lambs', slot: 0, ring: [205, 351.5], lane: 209, team: 0, crew: 'lambs', c0: 0, pillar: 0 },
  { key: 'L2', kind: 'lamb', pool: 'lambs', slot: 1, ring: [213, 351.5], lane: 217, team: 1, crew: 'lambs', c0: 8, pillar: 2 },
  { key: 'L3', kind: 'lamb', pool: 'lambs', slot: 2, ring: [221, 351.5], lane: 217, team: 2, crew: 'lambs', c0: 16, pillar: 4 },
  { key: 'L4', kind: 'lamb', pool: 'lambs', slot: 3, ring: [229, 351.5], lane: 225, team: 0, crew: 'lambs', c0: 24, pillar: 7 },
  { key: 'L5', kind: 'lamb', pool: 'lambs', slot: 4, ring: [205, 355.5], lane: 209, team: 1, crew: 'lambs', c0: 32, pillar: 1 },
  { key: 'L6', kind: 'lamb', pool: 'lambs', slot: 5, ring: [213, 355.5], lane: 217, team: 2, crew: 'lambs', c0: 40, pillar: 3 },
  { key: 'L7', kind: 'lamb', pool: 'lambs', slot: 6, ring: [221, 355.5], lane: 225, team: 0, crew: 'lambs', c0: 48, pillar: 5 },
  { key: 'goat', kind: 'goat', pool: 'goat', slot: 0, ring: [229, 359.5], lane: 225, team: 2, crew: 'goat', pillar: 0 },
];
/** the processions to the altar, in order (bulls last: their flaying is longest ⚙) */
export const PROCESSIONS = ['L1', 'L2', 'L3', 'ram', 'L4', 'L5', 'L6', 'L7', 'bullA', 'bullB'];
/** crew pools and their sizes (Yoma 2:5–7); 'teams' = three slaughterers and three receivers; 'goat' = its flayer and holder */
export const CREWS = { bullA: 24, bullB: 24, ram: 11, lambs: 56, goat: 2, teams: 6 };

const L = (right, left, role, part) => ({ right, left, pose: role === 'limb' ? 'carry_limbs' : 'carry', role, part });
const CF = CARRIERS_FALLBACK;
const flesh = (q) => L(CF[q].right, CF[q].left, 'limb', ['head and right leg', 'forelegs', 'tail and left leg', 'breast and neck', 'flanks'][q]);
/** each carrier's hands, in the Mishnah's order (Yoma 2:5–7; Tamid 4:3) */
export const CARRY = {
  lamb: [flesh(0), flesh(1), flesh(2), flesh(3), flesh(4), L('entrails_bazach', null, 'innards', 'innards'), L('solet', null, 'flour', 'flour'), L('wine_jug', null, 'wine', 'wine')],
  ram: [flesh(0), flesh(1), flesh(2), flesh(3), flesh(4), L('entrails_bazach', null, 'innards', 'innards'), L('entrails_bazach', null, 'innards', 'innards'),
    L('solet', null, 'flour', 'flour'), L('solet', null, 'flour', 'flour'), L('wine_jug', null, 'wine', 'wine'), L('wine_jug', null, 'wine', 'wine')],
  bull: [L('limb_head', null, 'limb', 'head'), L('limb', null, 'limb', 'right leg'), L('limb', null, 'limb', 'right leg'),
    L('limb_oketz', null, 'limb', 'tail'), L('limb_oketz', null, 'limb', 'tail'), L('limb', null, 'limb', 'left leg'), L('limb', null, 'limb', 'left leg'),
    L('limb_chazeh', null, 'limb', 'breast'), L('limb_gerah', null, 'limb', 'neck'), L('limb_gerah', null, 'limb', 'neck'), L('limb_gerah', null, 'limb', 'neck'),
    L('limb_foreleg', null, 'limb', 'foreleg'), L('limb_foreleg', null, 'limb', 'foreleg'), L('limb_dofen', null, 'limb', 'flank'), L('limb_dofen', null, 'limb', 'flank'),
    L('entrails_bazach', null, 'innards', 'innards'), L('entrails_bazach', null, 'innards', 'innards'), L('entrails_bazach', null, 'innards', 'innards'),
    L('solet', null, 'flour', 'flour'), L('solet', null, 'flour', 'flour'), L('solet', null, 'flour', 'flour'),
    L('wine_jug', null, 'wine', 'wine'), L('wine_jug', null, 'wine', 'wine'), L('wine_jug', null, 'wine', 'wine')],
};
/** holders at the binding (crew indices) by kind ⚙ */
const HOLD = { lamb: [0, 1], ram: [0, 1, 2], bull: [0, 1, 2, 3], goat: [0, 1] };
/** half the body's length (amot): the animal lies north of its ring, the neck at it */
const HALF = { lamb: 1.05, goat: 1.05, ram: 1.25, bull: 2.4 };
/** minutes from the hanging (the bull's fall) before its parts can be handed out ⚙ (G5: a bull 25–45 min, others 10–20,
 *  one man; here two to a bull and the cutting as the tamid's) */
const FLAY = { lamb: 5.0, ram: 6.0, goat: 4.0, bull: 19 };
/** hung states by kind (people-4 props) */
const HUNG = {
  lamb: ['lamb_hung', 'carcass_flaying', 'carcass_hung'],
  ram: ['ram_hung', 'carcass_flaying_ram', 'carcass_hung_ram'],
  goat: ['goat_hung', 'carcass_flaying_goat', 'carcass_hung_goat'],
};
const KN = [null, 'knife'], KNR = ['knife', null], MZ = [null, 'mizrak_gold'], MZR = ['mizrak_gold', null];
const SP = { ...SPEED, file: 0.95 };

/** an event's window [t0, t1] unwrapped near `base` (the data's tPlan when retimed), or null */
function evWin(sim, id, base) {
  const e = sim.event?.(id);
  if (!e || !Number.isFinite(e.t0)) return null;
  const w = e.tPlan || [e.t0, e.t1];
  const t0 = Number.isFinite(base) ? base + ((w[0] - base + 2160) % 1440) - 720 : w[0];
  return [t0, t0 + ((w[1] - w[0] + 1440) % 1440)];
}

/**
 * The plan for the current date, or null when it is not Rosh Chodesh (no 'rc-musaf-slaughter' event today). Returns
 * { M0, win: { slaughter, goat, flaying, limbs, song }, scripts: { [crew]: Script[] }, animals: { [pool]: Script[] },
 * leads: [[t0, t1, animalPool, slot, crewPool, crewSlot]], items, t, at, procs, wine: { at, laid, pick }, warn }.
 */
export function buildRC(ctx, sim) {
  const zm = ctx.time?.zmanim || {};
  const sr = zm.sunrise ?? 356;
  const W = evWin(sim, 'rc-musaf-slaughter', sr);
  if (!W) return null;
  const win = {
    slaughter: W, goat: evWin(sim, 'rc-goat-chatat', sr), flaying: evWin(sim, 'rc-musaf-flaying', sr),
    limbs: evWin(sim, 'rc-musaf-limbs', sr), song: evWin(sim, 'rc-musaf-song', sr),
  };
  const M0 = W[0];
  const m = (u) => M0 + u;
  const P = places(ctx), A = P.altar, R = P.ramp, ZT = A.ZT, gz = P.gazit;
  const wk = A.wk;
  const warn = [];
  const items = [];
  const t = { cut: {}, hang: {}, row: {}, rowEnd: {}, top: {}, toss: {}, pour: [], blood: {} };
  const scripts = Object.fromEntries(Object.entries(CREWS).map(([k, n]) => [k, Array.from({ length: n }, () => null)]));
  const animals = { bulls: [null, null], ram: [null], lambs: Array.from({ length: 7 }, () => null), goat: [null] };
  const leads = [];

  // ---------------------------------------------------------------------------------------------- places
  const kb = ctx.elOpt?.('azarah.gate.korban')?.box || { min: [156.5, 398, 16], max: [166.5, 403, 36] };
  const kf = ctx.elOpt?.('azarah.gate.korban.flight')?.params || { head: [161.5, 403, 16], foot: [161.5, 419, 0] };
  const kx = (kb.min[0] + kb.max[0]) / 2;
  const KB = {
    mount: [kx + 0.6, kf.foot[1] + 3.2, kf.foot[2]], foot: [kx + 0.6, kf.foot[1] - 0.4, kf.foot[2] + 0.2],
    head: [kx + 0.6, kf.head[1] + 0.4, kf.head[2] - 0.2], passage: [kx + 0.6, (kb.min[1] + kb.max[1]) / 2, Z], inside: [kx + 0.6, kb.min[1] - 1.6, Z],
  };
  const NP = 386.4;
  const Y_FILE = 273.4, Y_WINE = 271.8, Y_HOME = 269.4;                                     // the passage north of the nanasin (as g2/tamid.js)
  const north = [gz.door, ...P.way.gazitToNW.slice(0, 3)];             // the Gazit's door → north of the Ulam block
  const back = [...[...north].reverse(), gz.inside];
  // the way home keeps 2–3 amot north of the way out, under Beit HaMoked's wall (the north passage is ~5½ amot wide) ⚙
  const backN = [[181, 386.6, Z], [156, 385.8, Z], [gz.door[0] + 10, gz.door[1] + 2.6, Z], [gz.door[0] + 0.4, gz.door[1] + 1.2, Z], gz.inside];
  const ne = [A.yesod.max[0] + 0.55, A.yesod.max[1] + 0.55, Z];
  const swC = [A.yesod.min[0] - 0.35, A.yesod.min[1] - 0.25, Z];
  const swAt = [wk.W + 0.4, wk.S + 0.6, ZT];            // the silver cups at the SW horn (as g6/musaf.js)
  const rampFootE = (j = 0) => [R.east + j, R.foot - 1.2, Z];
  const upEast = (x) => [[x, R.foot + 0.6, R.kevZ(R.foot + 0.6)], [x, R.head - 0.8, R.kevZ(R.head - 0.8)], [x, R.head + 0.6, ZT]];
  const upWest = (x) => [[x, R.foot + 0.6, R.kevZ(R.foot + 0.6)], [x, R.head - 0.8, R.kevZ(R.head - 0.8)], [x, R.head + 0.6, ZT]];
  // west of the court to the south of the altar and the ramp's foot (the apron; g2 westUp reversed round the tables)
  const toRamp = (y0) => [[P.apronX, y0, Z], [P.apronX, 321, Z], ...P.way.westDown, [212.0, Y_FILE, Z]];
  // south of the ramp: the files east to its foot, the wine men west to theirs, the men going home east (≥ 1.4 amot apart)
  // back from the ramp's west foot: south of the ramp, up the east of the court, west along the north passage ⚙
  const home = (x) => [[x, Y_HOME, Z], [P.way.eastLine, Y_HOME, Z], ...[...P.way.eastBend].reverse(), [P.way.eastLine, 372.5, Z],
    [234.5, 378.8, Z], [232.4, NP + 2.2, Z], [200, NP + 2.2, Z], ...backN];
  const exitTop = (x0) => [[wk.E, wk.N, ZT], [wk.W, wk.N, ZT], [wk.W, wk.S, ZT], [R.west + 1.6, wk.S, ZT], ...rampDown(P, R.west + 1.6 + x0)];

  // ---------------------------------------------------------------------------------------------- the animals' places
  const AN = ANIMALS.map((a) => {
    const hook = Number.isFinite(a.pillar) ? P.slaughter.hook(a.pillar) : null;
    const h = HALF[a.kind];
    const spot = [a.ring[0] + 0.15, a.ring[1] + h, Z];
    const k = a.kind === 'bull' ? 2.1 : a.kind === 'ram' ? 1.25 : 1;
    return {
      ...a, hook, spot,
      hookRam: a.kind === 'ram',
      // the binding: kneeling north of it, two more standing for a bull (Tamid 4:1 as G2 ⚙)
      hold: a.kind === 'bull'
        // a bull at its sides, clear of the tables north of the last row ⚙
        ? [[a.ring[0] + 2.75, a.ring[1] + 4.2, 250, 'hold_legs'], [a.ring[0] - 2.45, a.ring[1] + 4.2, 110, 'hold_legs'],
          [a.ring[0] + 2.75, a.ring[1] + 2.5, 250, 'hold_legs'], [a.ring[0] - 2.45, a.ring[1] + 2.5, 110, 'hold_legs']]
        : [[a.ring[0] + 1.05 * k, a.ring[1] + h + 1.45 * k, 215, 'hold_legs'], [a.ring[0] - 0.75 * k, a.ring[1] + h + 1.2 * k, 140, 'hold_legs'],
          [a.ring[0] + 2.4 * k, a.ring[1] + h + 0.2 * k, 250, 'hold_legs']],
      sStand: [a.ring[0] + 1.3 * Math.min(k, 1.6), a.ring[1] + 0.6, Z],         // the slaughterer east of the neck, facing west
      rStand: [a.ring[0] + 0.35, a.ring[1] - 0.95, Z],                           // the receiver at the neck
      hookStand: hook ? [hook[0] - 0.85, hook[1] - 1.15, Z] : null,
      gap: hook ? hook[0] - 2 : null,
    };
  });
  const byKey = Object.fromEntries(AN.map((a) => [a.key, a]));
  // the walking lanes between the ring columns (205, 213, 221, 229) and outside them ⚙
  const laneNear = (x) => [201, 209, 217, 225, 233].reduce((b, l) => (Math.abs(l - x) < Math.abs(b - x) ? l : b), 201);
  const crewOf = (a, c) => scripts[a.crew][(a.c0 || 0) + c];
  const setCrew = (a, c, s) => { scripts[a.crew][(a.c0 || 0) + c] = s; };

  // ---------------------------------------------------------------------------------------------- brought (Middot 1:5 ⚙)
  // one after another up the flight, each led by its first carrier (who will flay it), down its lane to its ring
  const animalScript = {};
  AN.forEach((a, i) => {
    const t0 = m(-8.4 + 0.62 * i);
    const x = KB.mount[0] + (i % 2 ? 0.7 : -0.7);
    const up = [[x, KB.foot[1] + 1.2, KB.foot[2]], [x, KB.foot[1], KB.foot[2]], [x, KB.head[1], KB.head[2]], [x, KB.passage[1], Z], [x, KB.inside[1], Z]];
    const route = [[KB.inside[0] + 1, 389.4, Z], [182, 387.6, Z], [200, NP, Z], [a.lane, NP, Z], [a.lane, 382.0, Z], [a.lane, 376.0, Z], [a.lane, a.spot[1] + 0.4, Z], [a.spot[0] + (a.lane < a.spot[0] ? -1.2 : 1.2), a.spot[1] + 0.2, Z]];
    const leader = Script.from(t0, [x, KB.mount[1], KB.mount[2]], 180, `${a.key}-leader`);
    leader.walk([...up, ...route], { speed: SPEED.lamb, pose: 'lead_walk', props: null });
    const lb = Script.from(t0 + 0.02, [x, KB.mount[1] + (a.kind === 'bull' ? 3.0 : 1.6), KB.mount[2]], 180, a.key);
    lb.walk(behind([...up, ...route], a.kind === 'bull' ? 2.6 : 1.4), { speed: SPEED.lamb, pose: 'walk_led' });
    lb.walk([a.spot], { speed: 0.4, pose: 'walk_led' });
    a.arrive = lb.now();
    leads.push([t0, NaN, a.pool, a.slot, a.crew, a.c0 || 0]);
    leader.walk([[a.spot[0] + (a.lane < a.spot[0] ? -1.2 : 1.2) * 1.6, a.spot[1] + 0.9, Z]], { speed: 0.5, pose: 'lead_walk' });
    a.lead = leads[leads.length - 1];
    setCrew(a, 0, leader);
    animalScript[a.key] = lb;
  });

  // ---------------------------------------------------------------------------------------------- the teams
  // three slaughterers and three receivers out of the Gazit to their first rings; the cuts in the verse's order, each
  // team's next when its receiver is back from the corners ⚙
  const order = [['bullA', 1.6], ['bullB', 2.6], ['ram', 3.6], ['L1', 5.2], ['L2', 6.2], ['L3', 7.2], ['L4', 8.6], ['L5', 9.6], ['L6', 10.6], ['L7', 12.0], ['goat', 13.6]];
  const S = [0, 1, 2].map((k) => Script.from(m(-2.4 + 0.3 * k), gz.inside, 90, `slaughterer${k}`));
  const Rv = [0, 1, 2].map((k) => Script.from(m(-2.25 + 0.3 * k), gz.inside, 90, `receiver${k}`));
  for (let k = 0; k < 3; k++) {
    S[k].walk([...north, [200, NP - 1.4 - 0.5 * k, Z]], { speed: SPEED.walk, props: KN });
    Rv[k].walk([...north, [199.4, NP - 2.2 - 0.5 * k, Z]], { speed: SPEED.walk, props: MZ });
  }
  const ready = [m(0), m(0), m(0)];         // when each team's receiver can be at its next ring
  for (const [key, u] of order) {
    const a = byKey[key];
    const k = a.team, s = S[k], r = Rv[k];
    // to the ring: from the Gazit by the passage north of the nanasin and down the animal's lane; between rings by the
    // nearest lane, the strip north of the altar and the next lane — never across a ring column ⚙
    const viaS = s.cur[1] > 374 ? [[a.lane + 0.6, NP - 0.8, Z], [a.lane + 0.6, 376, Z], [a.lane + 0.6, a.sStand[1], Z]]
      : [[laneNear(s.cur[0]), s.cur[1], Z], [laneNear(s.cur[0]), 344.2, Z], [a.lane + 0.6, 344.2, Z], [a.lane + 0.6, a.sStand[1], Z]];
    s.walk([...viaS, a.sStand], { speed: SPEED.walk, props: KN });
    const viaR = r.cur[1] > 374 ? [[a.lane - 0.6, NP - 0.8, Z], [a.lane - 0.6, 376, Z], [a.lane - 0.6, a.rStand[1], Z]]
      : [[a.lane - 0.6, 343.6, Z], [a.lane - 0.6, a.rStand[1], Z]];
    r.walk([...viaR, a.rStand], { speed: SPEED.walk, props: MZ });
    const tCut = Math.max(m(u), s.now() + 0.6, r.now() + 0.2, ready[k], a.arrive + 0.6);
    if (tCut > m(u) + 0.8) warn.push(`${key} cut late ${(tCut - m(u)).toFixed(1)}`);
    t.cut[key] = tCut;
    const tBind = tCut - 0.55;
    // the binding: holders (the animal's crew) kneel north of it
    a.bind = tBind;
    s.until(tCut - 0.18, { pose: 'stand', face: a.spot, props: KNR, sway: 6, seed: 0x7a00 + k });
    s.act(0.68, { pose: 'slaughter', heading: 270, props: KNR });
    s.act(0.2, { pose: 'stand', heading: 270, props: KNR });
    // the blood: received at the neck, then the corners (olah) or the horns (the goat)
    r.until(tCut - 0.05, { pose: 'stand', face: a.spot, props: MZR });
    r.act(0.75, { pose: 'receive', heading: 330, props: MZR });
    if (a.kind !== 'goat') {
      r.walk([[a.lane - 0.6, a.rStand[1], Z], [a.lane - 0.6, 343.6, Z], [ne[0] + 1.2, ne[1] + 1.2, Z], ne], { speed: SPEED.walk, props: MZR });
      t.blood[key] = [r.now() + 0.2];
      r.act(0.45, { pose: 'throw', phase: [0, 1], face: [A.yesod.max[0] - 0.5, A.yesod.max[1] - 0.5], props: MZR });
      r.walk([[A.yesod.max[0] - 1, A.yesod.max[1] + 1.5, Z], [P.apronX, A.yesod.max[1] + 0.6, Z], [P.apronX, 321, Z], [199.7, 309.4, Z], swC], { speed: SPEED.walk, props: MZR });
      t.blood[key].push(r.now() + 0.2);
      r.act(0.45, { pose: 'throw', phase: [0, 1], face: [A.yesod.min[0] + 0.5, A.yesod.min[1] + 0.5], props: MZR });
      r.act(0.4, { pose: 'pour', phase: [0, 1], face: [A.yesod.min[0] + 1.4, A.yesod.min[1] + 0.5], props: MZR });
      r.walk([[199.7, 309.4, Z], [P.apronX, 321, Z], [P.apronX, 340.0, Z], [P.apronX + 1.2, 343.6, Z]], { speed: SPEED.walk, props: MZ });
    } else {
      // up the ramp's east half, right onto the sovev by its small ramp, the four horns with the finger, the rest on
      // the southern yesod (Zevachim 5:3; Rambam MK 5:7–10; the nodes as g5/geo.js)
      const SOV = 22;
      const rs = ctx.elOpt?.('altar.kevesh.ramp-sovev')?.params;
      const rsZ = (y) => (rs ? rs.from[2] + ((rs.to[2] - rs.from[2]) * (y - rs.from[1])) / (rs.to[1] - rs.from[1]) : SOV);
      const horns = [[231.5, 307.0, 135], [231.5, 336.0, 45], [202.5, 336.0, 315], [202.5, 307.0, 225]];
      r.walk([[a.lane - 0.6, a.rStand[1], Z], [a.lane - 0.6, 343.6, Z], [P.way.eastLine, 340, Z], [P.way.eastLine, 301, Z], [234.5, 297.5, Z], [228, 285, Z], [R.east, 274.3, Z], [R.east, 282, R.kevZ(282)], [223.6, 301.6, R.kevZ(301.6)]],
        { speed: SPEED.walk, props: MZR });
      r.walk([[226.0, 302.5, rsZ(302.5)], [226.0, 306.3, SOV], [226.0, 307.0, SOV]], { speed: 0.8, props: MZR, zExact: true });
      t.blood.goat = [];
      horns.forEach(([X, Y, h], j) => {
        r.walk([[X, Y, SOV]], { speed: 0.9, props: MZ, zExact: true });
        t.blood.goat.push(r.now() + 0.05);
        r.act(0.22, { pose: 'sprinkle', heading: h, props: MZ, zExact: true });
        void j;
      });
      // back round to the SE corner (the sovev is walked to the right — the way back the same ledge) and down
      r.walk([[202.5, 336.0, SOV], [231.5, 336.0, SOV], [231.5, 307.0, SOV], [226.0, 307.0, SOV], [226.0, 306.3, SOV], [226.0, 302.5, rsZ(302.5)]], { speed: 1.0, props: MZ, zExact: true });
      r.walk([[223.6, 301.6, R.kevZ(301.6)], [217, 300, R.kevZ(300)], [213, 296, R.kevZ(296)], [210.6, 292.4, R.kevZ(292.4)], [208.0, 292.7, 20.6], [208.0, 303.4, 17.05], [202.6, 304.6, 17.0]], { speed: 0.9, props: MZ });
      t.blood.goat.push(r.now() + 0.1);
      r.act(0.3, { pose: 'pour', phase: [0, 1], heading: 0, props: MZR });
      t.goatBloodEnd = r.now();
      r.walk([[200.6, 302, Z], [P.apronX, 321, Z], [P.apronX, 340, Z], [P.apronX + 1.2, 343.6, Z]], { speed: SPEED.walk, props: MZ });
    }
    ready[k] = r.now();
  }
  for (let k = 0; k < 3; k++) {
    S[k].walk([[laneNear(S[k].cur[0]), S[k].cur[1], Z], [laneNear(S[k].cur[0]), 376, Z], [laneNear(S[k].cur[0]), NP + 2.2, Z], [200, NP + 2.2, Z], ...backN], { speed: SPEED.walk, props: KN });
    Rv[k].walk([[199.4, 350, Z], [199.4, NP + 2.2, Z], ...backN], { speed: SPEED.walk, props: MZ });
    scripts.teams[2 * k] = S[k];
    scripts.teams[2 * k + 1] = Rv[k];
  }

  // ---------------------------------------------------------------------------------------------- holders, the animals
  for (const a of AN) {
    const hs = HOLD[a.kind];
    a.lead[1] = a.bind + 0.1;
    for (let j = 0; j < hs.length; j++) {
      const c = hs[j], h = a.hold[j];
      let s = crewOf(a, c);
      if (!s) {
        s = Script.from(a.bind - 1.6 - 0.1 * j, gz.inside, 90, `${a.key}-holder${c}`);
        s.walk([...north, [a.lane + (j % 2 ? -0.6 : 0.6), NP - 0.6, Z], [a.lane + (j % 2 ? -0.6 : 0.6), 376, Z], [a.lane + (j % 2 ? -0.6 : 0.6), h[1] + 1.4, Z], [h[0], h[1], Z]], { speed: SPEED.walk });
        setCrew(a, c, s);
      } else s.walk([[h[0], h[1], Z]], { speed: SPEED.slow, pose: 'lead_walk' });
      s.until(a.bind, { pose: c === 0 ? 'lead' : 'stand', face: a.spot, sway: 6, seed: 0x7a20 + c });
      s.act(0.35, { pose: h[3], heading: h[2] });
      s.until(t.cut[a.key] + 0.6, { pose: h[3], heading: h[2] });
      s.act(0.15, { pose: 'stand', heading: h[2] });
    }
    // the goat's holder is not a carrier: back in ⚙
    if (a.kind === 'goat') crewOf(a, 1).walk([[a.lane + 0.6, a.hold[1][1], Z], [a.lane + 0.6, 376, Z], [a.lane + 0.6, NP + 2.2, Z], [200, NP + 2.2, Z], ...backN], { speed: SPEED.walk });
    const lb = animalScript[a.key];
    lb.until(a.bind + 0.25, { pose: 'stand_led', heading: 180, sway: 10, seed: 0x7a40 + a.slot });
    lb.act(0.1, { pose: 'struggle', heading: 180 });
    lb.until(t.cut[a.key] - 0.2, { pose: 'bound', heading: 180 });
    lb.until(t.cut[a.key] + 0.35, { pose: 'struggle', heading: 180 });
  }

  // ---------------------------------------------------------------------------------------------- hung and flayed
  for (const a of AN) {
    const lb = animalScript[a.key];
    const s0 = crewOf(a, 0);
    if (a.kind === 'bull') {
      // flayed where it fell: its first two carriers bend over it with knives ⚙ (no bull carcass props — the figure
      // lies bound until its parts are taken)
      lb.until(t.cut[a.key] + 0.8, { pose: 'bound', phase: 0, heading: 180 });
      a.flay0 = t.cut[a.key] + 1.0;
      for (let c = 0; c < 2; c++) {
        const s = crewOf(a, c);
        const at = [a.spot[0] - 2.0, a.spot[1] + (c ? 1.1 : -0.9), Z];      // both on its west side; the parts are given east
        s.walk([at], { speed: SPEED.slow });
        s.act(0.2, { pose: 'stand', face: a.spot, props: KNR });
        a[`flayer${c}`] = s;
        a[`flayAt${c}`] = at;
      }
      continue;
    }
    // lifted and carried north up the lane to its hook (as g6/musaf.js) ⚙
    s0.until(t.cut[a.key] + 0.75, { pose: 'stand', face: a.spot });
    s0.walk([[a.spot[0] + 0.6, a.spot[1] + 1.3, Z]], { speed: SPEED.slow });
    s0.act(0.15, { pose: 'bow', phase: [0, 0.45], face: a.spot, props: KN });
    const tLift = s0.now();
    const path = [[a.lane, a.spot[1] + 1.6, Z], [a.lane, 376.0, Z], [a.gap, 378.5, Z], [a.hookStand[0] - 0.4, a.hookStand[1] - 0.4, Z], a.hookStand];
    s0.walk(path, { speed: 0.75, pose: 'carry_walk', props: KN });
    s0.act(0.3, { pose: 'flay', heading: 36, props: KN });
    const tHang = s0.now();
    lb.until(tLift, { pose: 'bound', phase: 0, heading: 180 });
    const lifted = [];
    let prev = [a.spot[0] + 0.6, a.spot[1] + 1.3];
    for (const p of path) {
      const D = Math.hypot(p[0] - prev[0], p[1] - prev[1]) || 1;
      lifted.push([p[0] + ((p[0] - prev[0]) / D) * 0.95, p[1] + ((p[1] - prev[1]) / D) * 0.95, Z + 1.5]);
      prev = p;
    }
    lb.walk(lifted, { speed: 0.75, pose: 'bound', zExact: true });
    lb.until(tHang, { pose: 'bound', phase: 0, heading: 90, zExact: true });
    t.hang[a.key] = tHang;
    a.flay0 = tHang;
    a.flayer0 = s0;
  }
  // the goat on the first lamb's hook: that lamb's parts must be gone first
  if (t.hang.goat < t.hang.L1 + FLAY.lamb + 1.5) warn.push('goat hung before L1 is cut down?');

  // ---------------------------------------------------------------------------------------------- the processions
  // one at a time on the east side of the altar's top: a procession's file reaches the top when the last one's flour
  // men have thrown theirs and gone (eastFree); the wine men up the west half when its men have come down (Zevachim 6:3)
  let eastFree = -Infinity, swFree = -Infinity;
  const procs = [];
  const walkTo = (pts, sp) => walkMin(pts[0], pts.slice(1), sp);
  for (const key of PROCESSIONS) {
    const a = byKey[key];
    const spec = CARRY[a.kind];
    const n = spec.length;
    const isBull = a.kind === 'bull';
    // take points (two, alternating) and the row (Tamid 4:3: "they stood in a row with the limbs in their hands")
    const take = isBull
      ? [[a.spot[0] + 2.4, a.spot[1] - 1.2, Z], [a.spot[0] + 2.4, a.spot[1] + 1.1, Z]]
      : [[a.hook[0] + 1.0, a.hook[1] - 1.35, Z], [a.hook[0] + 0.2, a.hook[1] - 2.05, Z]];
    const faceT = isBull ? a.spot : [a.hook[0], a.hook[1]];
    const rowY = isBull ? a.ring[1] - 2.6 : a.hook[1] - 3.45;
    const rowX0 = isBull ? a.spot[0] + 4.2 : a.hook[0] + 0.4;
    const flesh = spec.map((c, i) => [c, i]).filter(([c]) => c.role === 'limb' || c.role === 'innards');
    const nf = flesh.length;
    const rowAt = (i) => [rowX0 - 1.2 * (nf - 1 - i), rowY, Z];     // the head of the file stands farthest west
    const fromRowToTop = [...toRamp(rowY), rampFootE(), ...upEast(R.east)];
    // the earliest the parts can be handed out, then pushed so the file reaches the top after eastFree
    const ready = a.flay0 + FLAY[a.kind];
    const takeDur = 0.11 * nf + 0.35;
    const toTop = walkTo([rowAt(0), ...fromRowToTop], SP.file) + 0.2;
    let row0 = Math.max(ready, eastFree - takeDur - toTop + 0.2);
    t.row[key] = row0;
    // the flayer(s) until then
    for (let c = 0; c < (isBull ? 2 : 1); c++) {
      const s = a[`flayer${c}`];
      if (isBull) s.until(row0 - 0.1, { pose: 'bow', phase: 0.5, face: a.spot, props: KNR, sway: 4, seed: 0x7b00 + c });
      else {
        const F = FLAY[a.kind];
        for (let q = 0; q < 6; q++) {
          s.until(a.flay0 + F * (0.12 + 0.15 * q), { pose: 'flay', heading: 36, props: KNR });
          s.act(0.16, { pose: 'flay', heading: 36 + (q % 2 ? -12 : 10), props: KNR });
        }
        s.until(row0 - 0.1, { pose: 'flay', heading: 36, props: KNR });
      }
    }
    if (!isBull) {
      const [n0, n1, n2] = HUNG[a.kind], F = FLAY[a.kind];
      const at = [{ t: a.flay0, X: a.hook[0], Y: a.hook[1], Z: a.hook[2], h: 0 }];
      items.push({ name: n0, show: [a.flay0, a.flay0 + 0.14 * F], keys: at });
      items.push({ name: n1, show: [a.flay0 + 0.14 * F, a.flay0 + 0.72 * F], keys: at });
      a.dressed = { name: n2, show: [a.flay0 + 0.72 * F, NaN], keys: at };
      items.push(a.dressed);
    }
    // the carriers: each takes his part in turn and goes to the row; then all go together
    const takes = [];
    const tw = (i) => row0 + 0.11 * i;
    flesh.forEach(([c, ci], i) => {
      let s = crewOf(a, ci);
      const tp = take[i % 2];
      if (!s || (isBull && ci > 1) || (!isBull && ci > 0)) {
        // out of the Gazit (or back from holding, which ends in the Gazit), by the north passage and the lane east
        // of the pillar / the bull
        if (s) s.walk([[laneNear(s.cur[0]), s.cur[1], Z], [laneNear(s.cur[0]), NP + 2.2, Z], [200, NP + 2.2, Z], ...backN], { speed: SPEED.walk });
        const laneX = isBull ? a.spot[0] + 4.2 : a.hook[0] + 2;
        const approach = [...north, [200, NP, Z], [laneX, NP, Z], [laneX, isBull ? a.spot[1] + 2.6 : 382.2, Z], ...(isBull || i % 2 === 0 ? [] : [[laneX, tp[1], Z]]), tp];
        const go = tw(i) - walkTo([gz.inside, ...approach], SPEED.walk) - 0.05;
        if (s) {
          if (s.now() > go - 0.1) warn.push(`${key} carrier ${ci} late from holding ${(s.now() - go).toFixed(2)}`);
          s.hide(Math.max(go, s.now() + 0.05), gz.inside, 90);
        } else s = Script.from(go, gz.inside, 90, `${key}-c${ci}`);
        s.walk(approach, { speed: SPEED.walk });
        setCrew(a, ci, s);
      } else if (isBull) {
        // round the bull's head (south) to the east side ⚙
        s.walk([[a.spot[0] - 2.0, a.ring[1] - 0.9, Z], [a.spot[0] + 2.4, a.ring[1] - 0.9, Z], tp], { speed: SPEED.slow, props: KNR });
      } else {
        s.walk([tp], { speed: SPEED.slow, props: KNR });
      }
      s.until(tw(i), { pose: 'stand', face: faceT, props: ci < (isBull ? 2 : 1) ? KNR : null });
      s.act(0.08, { pose: 'bow', phase: [0, 0.45], face: faceT });
      const props = [c.right, c.left];
      s.act(0.08, { pose: 'bow', phase: [0.7, 1], face: faceT, props });
      // off south to the row's line — from a bull's northern take point first a step east, clear of the southern one
      s.walk([...(isBull && i % 2 ? [[tp[0] + 0.9, tp[1] - 0.4, Z], [tp[0] + 0.9, rowY, Z]] : [[tp[0], rowY, Z]]), rowAt(i)], { speed: SPEED.slow, pose: c.pose === 'carry' ? 'carry_walk' : 'carry_limbs_walk', props });
      takes.push(s);
    });
    const rowEnd = tw(nf - 1) + 0.35;
    t.rowEnd[key] = rowEnd;
    // the carcass goes as its parts are taken: the bull figure at the flanks ⚙, the hung carcass at the last part
    if (isBull) animalScript[a.key].until(tw(Math.min(nf - 1, 14)), { pose: 'bound', phase: 0, heading: 180 });
    else a.dressed.show[1] = tw(nf - 1);
    // the flayers who are not carriers of flesh go back in
    if (isBull) for (let c = 0; c < 2; c++) if (!flesh.some(([, ci]) => ci === c)) a[`flayer${c}`].walk([[a.spot[0] - 2.0, 376, Z], [laneNear(a.spot[0] - 2.0), 376, Z], [laneNear(a.spot[0] - 2.0), NP + 2.2, Z], [200, NP + 2.2, Z], ...backN], { speed: SPEED.walk });
    // the file: head first, 0.02 min apart (≈ 1.3 m) to the ramp, up its east half, along the south and east walk
    const tTop = [];
    flesh.forEach(([c, ci], i) => {
      const s = takes[i];
      const props = [c.right, c.left];
      const wp = c.pose === 'carry' ? 'carry_walk' : 'carry_limbs_walk';
      s.until(rowEnd + 0.03 * i, { pose: c.pose, heading: 270, props, sway: 3, seed: 0x7b20 + i });
      s.walk([...toRamp(rowY), rampFootE(jit(0x7b30, 0.3, key, i))], { speed: SP.file, pose: wp, props });
      s.walk(upEast(R.east + jit(0x7b31, 0.25, key, i)), { speed: SP.ramp, pose: wp, props });
      const slotY = wk.N - 1.6 - 1.12 * i;
      s.walk([[wk.E, wk.S, ZT], [wk.E - 0.2, slotY, ZT]], { speed: SP.ramp, pose: wp, props, zExact: true });
      tTop.push(s.now());
    });
    // laid between the horns (east of them, on the walk's outer half ⚙), a breath for all to see, salted, then thrown on
    // the great pile, the northernmost first, each going on round to the right and down the west half
    const allLaid = Math.max(...tTop) + 0.25;
    const tToss0 = allLaid + 0.45;
    t.top[key] = [Math.min(...tTop), allLaid];
    const tossAt = [];
    flesh.forEach(([c, ci], i) => {
      const s = takes[i];
      const slotY = wk.N - 1.6 - 1.12 * i;
      s.act(0.12, { pose: 'bow', phase: [0, 0.45], heading: 90, props: [c.right, c.left], zExact: true });
      const tl = s.now();
      s.act(0.1, { pose: 'bow', phase: [0.7, 1], heading: 90, zExact: true });
      const names = [c.right, c.left].filter(Boolean);
      const tToss = tToss0 + 0.07 * i;
      names.forEach((nm, j) => items.push({ name: nm, show: [tl, tToss - 0.12], keys: [{ t: tl, X: wk.E + 0.45, Y: slotY + (names.length > 1 ? (j ? -0.28 : 0.28) : 0), Z: ZT + 0.06, h: 0 + jit(0x7b40, 14, key, i * 2 + j) }], part: [key, i] }));
      s.until(tToss - 0.2, { pose: 'stand', heading: 90, sway: 4, seed: 0x7b50 + i, zExact: true });
      s.act(0.08, { pose: 'bow', phase: [0.2, 0.6], heading: 90, props: [c.right, c.left], zExact: true });
      s.act(0.3, { pose: 'toss', phase: [0, 1], face: [224, 321.5], props: [c.right, c.left], zExact: true });
      tossAt.push(s.now());
      s.act(0.08, { pose: 'stand', heading: 0, zExact: true });
      s.walk(exitTop(jit(0x7b60, 0.3, key, i)), { speed: SPEED.walk });
      s.walk(home(R.west + 1.6 + jit(0x7b61, 0.3, key, i)), { speed: SPEED.walk });
    });
    t.toss[key] = [Math.min(...tossAt), Math.max(...tossAt)];
    let lastDown = Math.max(...takes.map((s) => s.now()));
    // the flour men: from the chavitin makers' chamber by Nikanor (as g6/musaf.js ⚙) behind the file, up the east half;
    // they wait at the south-east corner until the limbs are on the fire, then throw the flour on the pile
    const fl = spec.map((c, i) => [c, i]).filter(([c]) => c.role === 'flour');
    let tFlourEnd = t.toss[key][1];
    fl.forEach(([c, ci], j) => {
      const tArr = t.top[key][1] + 0.3 + 0.12 * j;
      const from = [251, 319.5 - 0.6 * j, 13.5];
      const pts = [[246, 319.5, 13.5], [240.5, 320 + 0.4 * j, Z], [P.way.eastLine, 301, Z], ...P.way.eastBend.slice(1), [231.2, Y_FILE + 0.3 * j, Z], rampFootE(0.4), ...upEast(R.east + 0.3), [wk.E - 1.6 - 1.1 * j, wk.S, ZT]];
      const s = Script.from(tArr - walkMin(from, pts, SPEED.carry) - 0.1, from, 270, `${key}-flour${j}`);
      s.walk(pts, { speed: SPEED.carry, pose: 'carry_walk', props: ['solet', null] });
      const yF = 318.4 + 2.2 * (fl.length - 1 - j);      // the first the farthest north: none passes another
      s.until(t.toss[key][1] + 0.25 + 0.1 * j, { pose: 'carry', heading: 0, props: ['solet', null], zExact: true });
      s.walk([[wk.E - 0.2, wk.S + 0.4, ZT], [wk.E - 0.2, yF, ZT]], { speed: SPEED.ramp, pose: 'carry_walk', props: ['solet', null], zExact: true });
      s.act(0.08, { pose: 'carry', heading: 270, props: ['solet', null], zExact: true });
      s.act(0.32, { pose: 'toss', phase: [0, 1], heading: 270, props: ['solet', null], zExact: true });
      tFlourEnd = Math.max(tFlourEnd, s.now());
      s.act(0.08, { pose: 'stand', heading: 0, zExact: true });
      s.walk(exitTop(0.2 * j), { speed: SPEED.walk });
      lastDown = Math.max(lastDown, s.now());
      s.walk(home(R.west + 1.6 + 0.2 * j), { speed: SPEED.walk });
      setCrew(a, ci, s);
    });
    // the east walk is free when the last flour man has turned the NE corner
    eastFree = tFlourEnd + 0.6;
    // the wine: up the west half to the silver cups at the SW horn and poured, one after another; the last bull's last
    // jug is left on the lower ramp for the song's pourer (libation-song)
    const wn = spec.map((c, i) => [c, i]).filter(([c]) => c.role === 'wine');
    wn.forEach(([c, ci], j) => {
      const last = key === PROCESSIONS[PROCESSIONS.length - 1] && j === wn.length - 1;
      const from = [251, 320.4 + 0.5 * j, 13.5];
      const wait = [R.west - 1.6 - 1.1 * j, R.foot - 2.6, Z];
      const pts = [[246, 320.4, 13.5], [240.5, 320.8, Z], [P.way.eastLine - 0.4, 301, Z], ...P.way.eastBend.slice(1), [231.2, Y_WINE + 0.3 * j, Z], [R.west + 2, Y_WINE, Z], wait];
      // the west half's west lane, while the file's men come down its east lane (8 amot to a half; Zevachim 6:3 ⚙)
      const tUp = Math.max(t.top[key][0] + 0.2, swFree) + 0.05;
      const s = Script.from(tUp - walkMin(from, pts, SPEED.carry) - 0.8 - 0.2 * j, from, 270, `${key}-wine${j}`);
      s.walk(pts, { speed: SPEED.carry, pose: 'carry_walk', props: ['wine_jug', null] });
      setCrew(a, ci, s);
      if (last) {
        // as the tamid's ninth: laid on the lower half of the ramp, its west side (Tamid 4:3), then back in ⚙
        const y = R.halfY - 4.2;
        const at = [(R.box.min[0] + R.mid) / 2 - 0.4, y, R.kevZ(y) + 0.07];
        s.until(tUp, { pose: 'carry', heading: 0, props: ['wine_jug', null] });
        s.walk([[at[0] + 1.1, R.foot + 0.4, R.kevZ(R.foot + 0.4)], [at[0] + 1.1, y, R.kevZ(y)]], { speed: SPEED.ramp, pose: 'carry_walk', props: ['wine_jug', null] });
        s.act(0.14, { pose: 'bow', phase: [0, 0.42], heading: 270, props: ['wine_jug', null] });
        const tl = s.now();
        s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 270 });
        s.walk([[at[0] + 1.1, R.foot - 0.4, Z], ...home(at[0] + 1.1)], { speed: SPEED.walk });
        const item = { name: 'wine_jug', show: [tl, NaN], keys: [{ t: tl, X: at[0], Y: at[1], Z: at[2], h: 90 }], wine: true };
        items.push(item);
        t.wineLaid = tl;
        t.wineAt = at;
        return;
      }
      const start = Math.max(tUp, swFree);
      s.until(start, { pose: 'carry', heading: 0, props: ['wine_jug', null] });
      const upW = [...upWest(R.west - 1.7), [wk.W + 1.6, wk.S + 0.5, ZT], swAt];
      s.walk(upW, { speed: SPEED.ramp, pose: 'carry_walk', props: ['wine_jug', null] });
      s.act(0.1, { pose: 'carry', heading: 225, props: ['wine_jug', null], zExact: true });
      t.pour.push(s.now() + 0.1);
      s.act(0.45, { pose: 'pour', phase: [0, 1], heading: 225, props: ['wine_jug', null], zExact: true });
      s.act(0.1, { pose: 'stand', heading: 225, props: ['wine_jug', null], zExact: true });
      // back on his heels (Zevachim 6:3): the way he came, facing the altar ⚙ — walked
      s.walk([...upW].reverse().slice(1), { speed: SPEED.ramp, props: ['wine_jug', null] });
      swFree = s.now() + 0.05;
      s.walk([[R.west - 1.7, R.foot - 1.2, Z], ...home(R.west - 1.7)], { speed: SPEED.walk, props: ['wine_jug', null] });
    });
    procs.push({ key, kind: a.kind, n, flesh: nf, flour: fl.length, wine: wn.length, row: row0, rowEnd, top: t.top[key], toss: t.toss[key], eastFree });
  }

  // ---------------------------------------------------------------------------------------------- the goat's fats
  {
    const a = byKey.goat;
    const s = a.flayer0;
    const F = FLAY.goat;
    {
      const [n0, n1, n2] = HUNG.goat;
      const at = [{ t: a.flay0, X: a.hook[0], Y: a.hook[1], Z: a.hook[2], h: 0 }];
      items.push({ name: n0, show: [a.flay0, a.flay0 + 0.14 * F], keys: at });
      items.push({ name: n1, show: [a.flay0 + 0.14 * F, a.flay0 + 0.72 * F], keys: at });
      a.dressed = { name: n2, show: [a.flay0 + 0.72 * F, NaN], keys: at };
      items.push(a.dressed);
    }
    for (let q = 0; q < 5; q++) {
      s.until(a.flay0 + F * (0.12 + 0.17 * q), { pose: 'flay', heading: 36, props: KNR });
      s.act(0.16, { pose: 'flay', heading: 36 + (q % 2 ? -12 : 10), props: KNR });
    }
    // the fats up after the olot's limbs (Zevachim 10:2), by the same way; the meat stays on the hook to be eaten
    const pts = [[a.hook[0] + 1.0, a.hook[1] - 2.2, Z], [a.hook[0] + 1.0, 377.6, Z], [P.apronX, 377.6, Z], ...toRamp(377.6).slice(1), rampFootE(), ...upEast(R.east), [wk.E, wk.S, ZT], [wk.E - 0.2, 320.5, ZT]];
    const go = Math.max(eastFree, s.now() + 0.3);
    const tAt = go + walkMin(s.cur, pts, SPEED.carry);
    s.until(go - 0.25, { pose: 'flay', heading: 36, props: KNR });
    s.act(0.1, { pose: 'bow', phase: [0, 0.45], heading: 36 });
    s.act(0.1, { pose: 'bow', phase: [0.7, 1], heading: 36, props: ['eimurim_goat', null] });
    s.walkBy(tAt, pts, { pose: 'carry_walk', props: ['eimurim_goat', null], zExact: false });
    s.act(0.1, { pose: 'carry', heading: 270, props: ['eimurim_goat', null], zExact: true });
    t.goatFats = s.now() + 0.15;
    s.act(0.32, { pose: 'toss', phase: [0, 1], heading: 270, props: ['eimurim_goat', null], zExact: true });
    s.act(0.08, { pose: 'stand', heading: 0, zExact: true });
    s.walk(exitTop(0), { speed: SPEED.walk });
    s.walk(home(R.west + 1.6), { speed: SPEED.walk });
    a.dressed.show[1] = win.limbs ? win.limbs[1] : s.now() + 8;
    eastFree = Math.max(eastFree, t.goatFats + 0.6);
  }

  // ---------------------------------------------------------------------------------------------- the song's wine
  // libation-song's pourer takes the jug from the ramp (its musaf session: wine.pick) at the song's window
  const songW = win.song || [eastFree + 1, eastFree + 13];
  t.pickW = Math.max(songW[0] + 0.5, (t.pour.length ? Math.max(...t.pour) : 0) + 1.0, eastFree + 0.4);
  if (t.pickW > songW[0] + 3) warn.push(`song's wine late ${(t.pickW - songW[0]).toFixed(1)}`);
  t.tPour = t.pickW + 0.9;
  for (const it of items) if (it.wine) it.show[1] = t.pickW;
  if (win.limbs && eastFree > win.limbs[1] + 0.5) warn.push(`limbs run past their window ${(eastFree - win.limbs[1]).toFixed(1)}`);

  // the animals' scripts into their pools
  for (const a of AN) {
    animals[a.pool][a.slot] = animalScript[a.key];
    if (a.kind === 'bull') a.lead[1] = a.bind + 0.1;
  }
  // every slot of every crew has a script
  for (const [k, list] of Object.entries(scripts)) list.forEach((s, i) => { if (!s) warn.push(`${k}[${i}] has no script`); });
  for (const list of [...Object.values(scripts), ...Object.values(animals)]) for (const s of list) if (s) warn.push(...s.warn);

  // wrap for the cyclic clock
  for (const it of items) { it.show = it.show.map((x) => wrap(Number.isFinite(x) ? x : (win.limbs?.[1] ?? M0 + 50))); it.keys = it.keys.map((k) => ({ ...k, t: wrap(k.t) })); }
  return {
    M0, win, scripts, animals, items, warn, t, procs, AN,
    leads: leads.map(([a0, b0, pool, slot, crew, cs]) => [wrap(a0), wrap(Number.isFinite(b0) ? b0 : a0 + 1), pool, slot, crew, cs]),
    wine: { at: t.wineAt, laid: t.wineLaid, pick: t.pickW },
    at: { gate: KB.inside, rings: [221, 359.5, Z], hooks: [217, 381.0, Z], ramp: [217, 290, 20], walk: [wk.E, 321.5, ZT], sw: swAt, ne, swC, horns: [231.5, 307, 22], duchan: [243, 330.5, 16] },
  };
}

/** a led animal walking behind its leader: the leader's points with the last one drawn back `back` amot */
function behind(pts, back = 1.6) {
  const n = pts.length;
  const a = pts[n - 2], b = pts[n - 1];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [...pts.slice(0, n - 1), [b[0] - ((b[0] - a[0]) / L) * back, b[1] - ((b[1] - a[1]) / L) * back, b[2]]];
}
const wrap = (t) => ((t % 1440) + 1440) % 1440;
