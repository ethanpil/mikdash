// The Shabbat musaf: two yearling lambs as an olah with their flour-offering and wine (Bamidbar 28:9–10; Yoma 33a;
// Sukkah 5:5; Shekalim 8:8; Rosh HaShanah 31a; Rambam Temidin uMusafin 4:9). One per-date plan of Scripts and free props.
//
//   brought    two Levites lead the lambs up the flight of Sha'ar HaKorban (Middot 1:5 names the gate; that the
//              most-holy offerings came in by it is the commentators' reading — report §03) and hand the leads to the
//              slaughterer and a limb-bearer inside the gate ⚙, just before the window, so the lambs and the crew stand
//              at the rings from its start (the jump-to-event lands there)
//   slaughter  "whoever won a task at the morning tamid does it for the two musaf lambs" (TuM 4:9): the morning's
//              slaughterer slaughters both, the morning's receiver receives and throws both bloods; bound as the tamid,
//              head south and face west, at two rings of the second row, two kneeling to hold it from the north and
//              the others standing back as at the tamid (Tamid 4:1; g2/tamid.js ⚙ for the musaf)
//   blood      an olah: north-east and south-west corners below the red line, the rest on the southern base (Zevachim 5:4)
//   flay       hung by the hind leg on the dwarf pillars, flayed and cut in the tamid's order; the morning's six bearers
//              stand in a row for their parts (Tamid 4:2–3 ⚙ for the musaf); the hides to Lishkat HaParvah ⚙
//   ramp       laid on the lower half of the ramp, on its west side (Shekalim 8:8), salted by the flour and wine men
//   up         the morning's fourth-lottery men carry them up to the great pile (TuM 4:9), the first lamb's parts then the
//              second's; then the fine flour mixed with oil — two tenths for the two lambs (Bamidbar 28:9) — by the
//              morning's fourth-lottery flour man (tamid-morning's U[6])
//   wine       the second lottery's wine man only brings the jug to the ramp, as at the tamid (TuM 4:6 "the thirteenth
//              brings up the wine"); the man who took the morning's wine up from the ramp (G3's brother 12, who on
//              Shabbat hands it to the Kohen Gadol) takes it up, round to the left to the south-west horn, and pours
//              (Zevachim 6:3; TuM 4:9) — staged by libation-song, or here as a fallback; the song — this Shabbat's
//              section of Ha'azinu (RH 31a) — with nine blasts (Sukkah 5:5): see shabbat-musaf.js
// ⚙ = staging (docs/decisions/choreo-g6-shabbat.md). Minutes are fractions of the event's window (42 min as scheduled).
import { Script, SPEED, jit, walkMin, seedFrom } from '../g2/lib.js';
import { rampDown, circuit } from '../g2/places.js';
import { CARRIERS_FALLBACK } from '../g2/tamid.js';
import { g6places, evWin, Z, wrap, HAAZINU, haazinuSection } from './common.js';
import { clamp } from '../../lib/core.js';
import { AMAH } from '../../../core/units.js';

/** crew slots = G2's tamid crew slots (same seed: the same men as the morning's winners) */
export const MC = { S: 0, R: 1, L: [2, 3, 4, 5, 6, 7], F: 8, WN: 10 };
export const MC_N = 11;
/** the fourth lottery's men (SEEDS.up): the six limbs and the flour (slot 6), as tamid-morning's U[0..6] */
export const UP_N = 7;
/** the man who takes the wine up from the ramp: G3's brother 12 (g3/day.js pool 'brothers', seed 0x6734), the morning
 *  tamid's — slot 0 of a pool with this seed is the same face (g2/lib.js seedFrom); used only when libation-song does
 *  not stage the musaf's pour */
export const POURER_SEED = seedFrom(0x6734, 12);

/** a lamb walking behind its leader: the leader's points with the last one drawn back `back` amot */
function behind(from, pts, back = 1.6) {
  const n = pts.length;
  const a = n > 1 ? pts[n - 2] : from, b = pts[n - 1];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [...pts.slice(0, n - 1), [b[0] - ((b[0] - a[0]) / L) * back, b[1] - ((b[1] - a[1]) / L) * back, b[2]]];
}

export function buildMusaf(ctx, sim, opts = {}) {
  const zm = ctx.time?.zmanim || {};
  const sr = zm.sunrise ?? 356;
  const W = evWin(sim, 'shabbat-musaf', sr);
  if (!W) return null;
  const [M0, M1] = W;
  const k = Math.min(1.2, Math.max(0.6, (M1 - M0) / 42));     // stretch the timeline with the window
  const m = (u) => M0 + u * k;
  const G = g6places(ctx), P = G.P, KB = G.korban, A = P.altar, R = P.ramp, ZT = A.ZT;
  const carriers = ctx.people?.tamid?.carriers?.length === 9 ? ctx.people.tamid.carriers : CARRIERS_FALLBACK;
  const gz = P.gazit;
  const north = [gz.door, ...P.way.gazitToNW.slice(0, 3), [200, 386.6, Z]];
  const items = [], leads = [], warn = [];
  const crew = Array.from({ length: MC_N }, () => null);
  const t = {};

  // ---------------------------------------------------------------------------------------------- the two lambs
  const L = [
    { ring: [221, 351.5, Z], pillar: 5, seed: 0x6d61 },
    { ring: [213, 351.5, Z], pillar: 3, seed: 0x6d62 },
  ].map((o) => {
    const r = o.ring, hook = P.slaughter.hook(o.pillar);
    return {
      ...o, hook, gap: hook[0] - 2,
      hookStand: [hook[0] - 0.85, hook[1] - 1.15, Z],
      spot: [r[0] + 0.15, r[1] + 1.05, Z],              // its body north of the ring, the neck at it
      sStand: [r[0] + 1.3, r[1] + 0.6, Z],               // the slaughterer east of it, facing west (Tamid 4:1)
      rStand: [r[0] + 0.35, r[1] - 0.95, Z],             // the receiver at the neck
      // as G2's tamid: two kneel holding it from the north (hind legs, hindquarters), two stand 2½–3 amot back; its
      // head (south), face (west) and the slaughterer on its east stay open to the south-west ⚙
      hold: [[r[0] + 1.05, r[1] + 2.5, 215, 'hold_legs'], [r[0] - 0.75, r[1] + 2.25, 140, 'hold_legs'],
        [r[0] + 2.9, r[1] + 3.5, 220, 'stand'], [r[0] - 2.7, r[1] + 2.9, 130, 'stand']],
      lane: (x) => [[x + 0.1, 382.4, Z], [x, 376.2, Z], [x, 371, Z]],
    };
  });

  // ---------------------------------------------------------------------------------------------- brought up (Middot 1:5)
  // ⚙ before the window: at its start the lambs are at the rings with the crew round them
  const levites = [];
  const lambs = [];
  const inside = [[KB.inside[0] - 1.6, KB.inside[1], Z], [KB.inside[0] + 1.6, KB.inside[1], Z]];
  const up = (x) => [[x, KB.foot[1], KB.foot[2]], [x, KB.head[1], KB.head[2]], [x, KB.passage[1], Z]];
  const HAND = -1.75;                                   // the hand-over inside the gate (minutes of the window)
  t.lev = [];
  for (let i = 0; i < 2; i++) {
    const x = KB.mount[0] + (i ? 1.4 : -1.4);
    const s = Script.from(m(HAND - 0.97) + 0.08 * i, [x, KB.mount[1] + 1.5 * i, KB.mount[2]], 180, `levite${i}`);
    s.walk([[x, KB.foot[1] + 1.2, KB.foot[2]]], { speed: SPEED.lamb, pose: 'lead_walk' });
    s.walk(up(x), { speed: 0.5, pose: 'lead_walk' });
    s.walk([inside[i]], { speed: SPEED.lamb, pose: 'lead_walk' });
    t.lev[i] = s.now();
    s.until(m(HAND) + 0.05 * i, { pose: 'lead', heading: i ? 200 : 160, sway: 8, seed: 0x6c76 + i });
    s.act(0.12, { pose: 'stand', heading: i ? 200 : 160 });
    // back down to the Mount ⚙
    s.walk([[x, KB.passage[1], Z], [x, KB.head[1], KB.head[2]], [x, KB.foot[1], KB.foot[2]], [x + (i ? 2 : -2), KB.mount[1] + 2, KB.mount[2]]], { speed: SPEED.slow });
    levites.push(s);
    const lb = Script.from(s.t0 - 0.02, [x, KB.mount[1] + 1.5 * i + 1.6, KB.mount[2]], 180, `lamb${i}`);
    lb.walk(behind([x, KB.mount[1] + 1.6, 0], [[x, KB.foot[1] + 1.2, KB.foot[2]], ...up(x), inside[i]], 1.4), { speed: SPEED.lamb * 0.62, pose: 'walk_led' });
    lb.until(m(HAND + 0.08), { pose: 'stand_led', heading: 180, sway: 12, seed: 0x6c62 + i });
    lambs.push(lb);
    leads.push([s.t0, m(HAND + 0.04) + 0.05 * i, i, 'levite']);
  }
  if (Math.max(...t.lev) > m(HAND - 0.07)) warn.push('levites late at the gate');

  // ---------------------------------------------------------------------------------------------- the crew out of the Gazit
  // S and the first bearer to Sha'ar HaKorban for the leads; the rest to the rings
  const toGate = [gz.door, ...P.way.gazitToNW.slice(0, 2), [KB.inside[0] - 2.5, 386.5, Z]];
  const S = Script.from(m(HAND - 1.17), gz.inside, 90, 'slaughterer');
  S.walk([...toGate, [inside[0][0], inside[0][1] - 1.7, Z]], { speed: SPEED.walk, props: [null, 'knife'] });
  S.until(m(HAND + 0.04), { pose: 'stand', heading: 0, props: [null, 'knife'] });
  const L1 = Script.from(m(HAND - 1.12), gz.inside, 90, 'bearer1');
  L1.walk([...toGate, [inside[1][0], inside[1][1] - 1.7, Z]], { speed: SPEED.walk });
  L1.until(m(HAND + 0.09), { pose: 'stand', heading: 0 });
  // led to the slaughterhouse: along the north of the court and through the pillars to the rings
  const toRing = (Li, back) => [[KB.inside[0] + (back ? 1 : -1), 389.4, Z], [182, 387.6, Z], [200, 387.4 - 0.4 * back, Z], [Li.gap, 387.0, Z], ...Li.lane(Li.gap), [Li.spot[0] + 0.6, Li.spot[1] + 3.2, Z]];
  t.atRing = [];
  for (const [i, s] of [[0, S], [1, L1]]) {
    const Li = L[i];
    s.walk(toRing(Li, i), { speed: SPEED.lamb, pose: 'lead_walk', props: i === 0 ? [null, 'knife'] : null });
    s.walk([i === 0 ? Li.sStand : [Li.hold[0][0], Li.hold[0][1], Z]], { speed: SPEED.slow, pose: 'lead_walk', props: i === 0 ? [null, 'knife'] : null });
    t.atRing[i] = s.now();
    const lb = lambs[i];
    lb.walk(behind(inside[i], [...toRing(Li, i), i === 0 ? Li.sStand : [Li.hold[0][0], Li.hold[0][1], Z]], 1.4), { speed: SPEED.lamb * 0.99, pose: 'walk_led' });
    lb.walk([Li.spot], { speed: 0.4, pose: 'walk_led' });
    leads.push([m(HAND + 0.04) + 0.05 * i, NaN, i, i === 0 ? 'S' : 'L1']);
  }
  crew[MC.S] = S; crew[MC.L[0]] = L1;
  const R1 = Script.from(m(-0.95), gz.inside, 90, 'receiver');
  R1.walk([...north, ...L[0].lane(L[0].gap), [L[0].ring[0] + 2.4, L[0].ring[1] - 1.2, Z], L[0].rStand], { speed: SPEED.walk, props: ['mizrak_gold', null] });
  crew[MC.R] = R1;
  // the bearers' places at the binding: A — L[1], L[2] kneel, L[3] stands back; B — L1 and L[4] kneel, L[5] and L[1]
  // (over from A) stand back
  const holdOf = (i) => (i < 4 ? L[0].hold[i - 1] : L[1].hold[i === 4 ? 1 : 3]);
  for (let i = 1; i < 6; i++) {
    const s = Script.from(m(-0.85) + 0.07 * i, gz.inside, 90, `bearer${i + 1}`);
    const Li = i < 4 ? L[0] : L[1];
    const h = holdOf(i);
    s.walk([...north, [Li.gap - 0.5 + 0.35 * i, 386.8, Z], ...Li.lane(Li.gap), [h[0], h[1], Z]], { speed: SPEED.walk * (0.95 + 0.02 * i) });
    crew[MC.L[i]] = s;
  }

  // ---------------------------------------------------------------------------------------------- slaughter, blood (Tamid 4:1)
  const KN = [null, 'knife'], KNR = ['knife', null], MZ = ['mizrak_gold', null];
  t.bind = [m(2.2), m(5.5)];
  t.cut = [m(2.75), m(6.2)];
  const binding = (s, h, i, seed) => {
    s.until(t.bind[i], { pose: 'stand', face: L[i].spot, sway: 8, seed });
    s.act(0.4, { pose: h[3], heading: h[2] });
    s.until(t.cut[i] + 0.6, { pose: h[3], heading: h[2] });
    s.act(0.15, { pose: 'stand', heading: h[2] });
  };
  // lamb A: two kneel holding it, one stands back, S slaughters, R receives
  for (let i = 1; i < 4; i++) binding(crew[MC.L[i]], holdOf(i), 0, 0x6d00 + i);
  // L1 leads lamb B in and waits with it by its ring, then binds it with the fifth and sixth bearers and L2 (from A)
  {
    const s = L1;
    s.until(t.bind[1] - 0.1, { pose: 'lead', face: L[1].spot, sway: 6, seed: 0x6d10 });
    leads[3][1] = t.bind[1] + 0.15;
    const h = L[1].hold[0];
    s.act(0.4, { pose: h[3], heading: h[2] });
    s.until(t.cut[1] + 0.6, { pose: h[3], heading: h[2] });
    s.act(0.15, { pose: 'stand', heading: h[2] });
  }
  for (let i = 4; i < 6; i++) binding(crew[MC.L[i]], holdOf(i), 1, 0x6d20 + i);
  {
    const s = crew[MC.L[1]], h = L[1].hold[2];   // from A to B's place standing back ⚙
    s.walk([[L[0].ring[0] - 2.8, L[0].ring[1] + 3.6, Z], [h[0], h[1] + 0.6, Z], [h[0], h[1], Z]], { speed: SPEED.slow });
    binding(s, h, 1, 0x6d30);
  }
  // the slaughterer: A, then carries it to its hook; then B; then carries B to its hook
  S.until(t.bind[0], { pose: 'lead', face: L[0].spot, sway: 6, seed: 0x6d40, props: KN });
  leads[2][1] = t.bind[0] + 0.15;
  S.act(0.3, { pose: 'hold_legs', heading: 270 });
  S.until(t.cut[0] - 0.18, { pose: 'stand', heading: 270, props: KNR });
  S.act(0.68, { pose: 'slaughter', heading: 270, props: KNR });
  S.act(0.2, { pose: 'stand', heading: 270, props: KNR });
  const carry = (Li, i) => {
    S.act(0.15, { pose: 'bow', phase: [0, 0.45], face: Li.spot, props: KN });
    t[`lift${i}`] = S.now();
    // between the two who knelt to hold it (they have stood up), north to the lane ⚙
    const path = [[Li.ring[0] + 0.15, Li.ring[1] + 3.3, Z], [Li.gap, 371, Z], [Li.gap, 376.0, Z], [Li.hookStand[0] - 0.4, Li.hookStand[1] - 0.4, Z], Li.hookStand];
    S.walk(path, { speed: 0.75, pose: 'carry_walk', props: KN });
    S.act(0.3, { pose: 'flay', heading: 36, props: KN });
    t[`hang${i}`] = S.now();
    return path;
  };
  const pathA = carry(L[0], 0);
  S.walk([[L[0].gap, 376.0, Z], [L[0].gap, 371, Z], [L[1].sStand[0] + 0.8, L[1].sStand[1] + 3, Z], L[1].sStand], { speed: SPEED.walk, props: KN });
  S.until(t.bind[1], { pose: 'stand', face: L[1].spot, props: KN });
  S.act(0.3, { pose: 'hold_legs', heading: 270 });
  S.until(t.cut[1] - 0.18, { pose: 'stand', heading: 270, props: KNR });
  S.act(0.68, { pose: 'slaughter', heading: 270, props: KNR });
  S.act(0.2, { pose: 'stand', heading: 270, props: KNR });
  const pathB = carry(L[1], 1);
  // the receiver: A's blood, then B's
  const ne = [A.yesod.max[0] + 0.55, A.yesod.max[1] + 0.55, Z];
  const swC = [A.yesod.min[0] - 0.35, A.yesod.min[1] - 0.25, Z];
  t.throw = []; t.pourBlood = [];
  const blood = (Li, i) => {
    R1.until(t.cut[i] - 0.05, { pose: 'stand', face: Li.spot, props: MZ });
    R1.act(0.75, { pose: 'receive', heading: 330, props: MZ });
    R1.walk([[Li.ring[0] + 4, Li.ring[1] - 4, Z], ne], { speed: SPEED.walk, props: MZ });
    t.throw.push(R1.now() + 0.2);
    R1.act(0.45, { pose: 'throw', phase: [0, 1], face: [A.yesod.max[0] - 0.5, A.yesod.max[1] - 0.5], props: MZ });
    R1.walk([[A.yesod.max[0] - 1, A.yesod.max[1] + 1.5, Z], [P.apronX, A.yesod.max[1] + 0.6, Z], [P.apronX, 321, Z], [199.7, 309.4, Z], swC], { speed: SPEED.walk, props: MZ });
    t.throw.push(R1.now() + 0.2);
    R1.act(0.45, { pose: 'throw', phase: [0, 1], face: [A.yesod.min[0] + 0.5, A.yesod.min[1] + 0.5], props: MZ });
    R1.act(0.1, { pose: 'stand', face: [A.yesod.min[0] + 1.4, A.yesod.min[1] + 0.5], props: MZ });
    t.pourBlood.push(R1.now() + 0.25);
    R1.act(0.45, { pose: 'pour', phase: [0, 1], face: [A.yesod.min[0] + 1.4, A.yesod.min[1] + 0.5], props: MZ });
  };
  blood(L[0], 0);
  R1.walk([[199.7, 309.4, Z], [P.apronX, 321, Z], [P.apronX, 338, Z], [205, 345.5, Z], [L[1].ring[0] + 2.4, L[1].ring[1] - 1.4, Z], L[1].rStand], { speed: SPEED.walk, props: MZ });
  if (R1.now() > t.cut[1] - 0.1) warn.push(`receiver late for B ${(R1.now() - t.cut[1]).toFixed(2)}`);
  blood(L[1], 1);

  // the lambs: led, bound, slaughtered, carried to the hooks
  for (let i = 0; i < 2; i++) {
    const lb = lambs[i], Li = L[i];
    lb.until(t.bind[i] + 0.25, { pose: 'stand_led', heading: 200, sway: 10, seed: 0x6c70 + i });
    lb.act(0.1, { pose: 'struggle', heading: 180 });
    lb.until(t.cut[i] - 0.2, { pose: 'bound', heading: 180 });
    lb.until(t.cut[i] + 0.35, { pose: 'struggle', heading: 180 });
    lb.until(t[`lift${i}`], { pose: 'bound', phase: 0, heading: 180 });
    const lifted = [];
    let prev = Li.spot;
    for (const p of (i ? pathB : pathA)) {
      const D = Math.hypot(p[0] - prev[0], p[1] - prev[1]) || 1;
      lifted.push([p[0] + ((p[0] - prev[0]) / D) * 0.95, p[1] + ((p[1] - prev[1]) / D) * 0.95, Z + 1.5]);
      prev = p;
    }
    lb.walk(lifted, { speed: 0.75, pose: 'bound', zExact: true });
    lb.until(t[`hang${i}`], { pose: 'bound', phase: 0, heading: 90, zExact: true });
  }

  // ---------------------------------------------------------------------------------------------- flaying (Tamid 4:2–3 ⚙)
  // S flays A, then B; the six bearers stand in a row for each lamb's parts in turn; R takes the hides to the Parvah
  const FLAYH = 36;
  const parts = [
    [['head', 'limb_head', null], ['rleg', 'limb_head', 'limb']],
    [['forelegs', 'limb_foreleg', 'limb_foreleg']],
    [['tail', 'limb_oketz', null], ['lleg', 'limb_oketz', 'limb']],
    [['breast', 'limb_chazeh', null], ['neck', 'limb_chazeh', 'limb_gerah']],
    [['rflank', 'limb_dofen', null], ['lflank', 'limb_dofen', 'limb_dofen']],
    [['innards', 'entrails_bazach', null]],
  ];
  const FR = { head: 0.29, shanks: 0.32, hide: 0.5, forelegs: 0.56, rleg: 0.6, open: 0.62, innards: 0.645, breast: 0.68, rflank: 0.72, neck: 0.76, lflank: 0.8, tail: 0.84, lleg: 0.88, row: 0.91 };
  const flayWin = [[m(7.9), m(15.9)], [m(16.6), m(24.6)]];
  t.cuts = flayWin.map(([f0, f1]) => { const o = {}; for (const [kk, x] of Object.entries(FR)) o[kk] = f0 + (f1 - f0) * x; return o; });
  for (let i = 0; i < 2; i++) {
    const Li = L[i], cut = t.cuts[i];
    if (i === 0) {
      // the knife for flaying is his own ⚙ (the tamid's flaying knife stays on its table — tamid-morning)
      S.walk([[L[0].hookStand[0] + 1.0, L[0].hookStand[1] - 0.8, Z], L[0].hookStand], { speed: SPEED.walk, props: KN });
    } else {
      S.walk([[Li.hookStand[0] + 1.6, Li.hookStand[1] - 0.6, Z], Li.hookStand], { speed: SPEED.walk, props: KNR });
    }
    for (const ev of ['head', 'shanks', 'hide', 'forelegs', 'rleg', 'open', 'innards', 'breast', 'rflank', 'neck', 'lflank', 'tail', 'lleg']) {
      S.until(cut[ev] - 0.08, { pose: 'flay', heading: FLAYH, props: KNR });
      S.act(0.16, { pose: 'flay', heading: FLAYH + (ev.length % 2 ? -12 : 10), props: KNR });
    }
    S.until(cut.row + 0.2, { pose: 'stand', heading: FLAYH, props: KNR });
    const atHook = (tk) => [{ t: tk, X: Li.hook[0], Y: Li.hook[1], Z: Li.hook[2], h: 0 }];
    items.push({ name: 'lamb_hung', show: [t[`hang${i}`], cut.head], keys: atHook(t[`hang${i}`]) });
    items.push({ name: 'carcass_flaying', show: [cut.head, cut.open], keys: atHook(cut.head) });
    items.push({ name: 'carcass_hung', show: [cut.open, cut.lleg], keys: atHook(cut.open) });
  }
  S.walk([[L[1].gap - 0.5, 376.4, Z], [L[1].gap - 0.5, 382.2, Z], [200, 386.6, Z], ...P.way.gazitToNW.slice(0, 3).reverse(), gz.door, gz.inside], { speed: SPEED.walk, props: KNR });
  // the bearers: in a row west of the flayer; each steps up for his parts as they are cut (Tamid 4:3)
  const rowAt = (Li, i) => [Li.hook[0] - 2.6 - 1.45 * i, Li.hook[1] - 1.75 - 0.25 * (i % 2), Z];
  const take = (Li, i) => [Li.hook[0] - 2.15, Li.hook[1] - 1.35 - 0.35 * (i % 2), Z];
  const ROWH = 75;
  // the lower half of the ramp, west side (Shekalim 8:8): lamb A's parts in the tamid's column, B's a column east ⚙
  const Y0 = R.halfY - 1.9, DY = 1.33;
  const placeX = (i) => [R.box.min[0] + 1.3 + 2.7 * i, R.box.min[0] + 2.45 + 2.7 * i];
  const spot = (i, q) => [placeX(i)[1] + 1.15, Y0 - DY * q];
  const file = (Li, q) => [[Li.hook[0] - 7.5, 377.0 - 0.15 * q, Z], [205.0, 376.6, Z], [205.0, 371, Z], [205, 345.5, Z], [P.apronX, 338, Z], [P.apronX, 321, Z], [199.7, 309.4, Z], [202.6, 296, Z], [206.3, 274.3, Z], [spot(0, 0)[0] + 0.3, R.foot - 1.0, Z]];
  t.laid = [[], []];
  const back = (i) => [[R.west + 2.4 + 0.3 * i, R.foot + 0.4, R.kevZ(R.foot + 0.4)], [R.west + 1.8, R.foot - 1.4, Z]];
  for (let i = 0; i < 2; i++) {
    const Li = L[i], cut = t.cuts[i];
    for (let q = 0; q < 6; q++) {
      const s = crew[MC.L[q]];
      const ra = rowAt(Li, q);
      if (i === 0) s.walk([[Li.ring[0] - 0.8 + 0.5 * q, Li.ring[1] + 4.5, Z], [Li.gap + 0.35 * (q % 2), 371, Z], [Li.gap + 0.35 * (q % 2), 376.2, Z], ra], { speed: SPEED.slow });
      else s.walk([[206.3, 274.3, Z], [202.6, 296, Z], [199.7, 309.4, Z], [P.apronX, 321, Z], [P.apronX, 338, Z], [205, 345.5, Z], [205.0, 371, Z], [205.0, 376.6, Z], ra], { speed: SPEED.walk });
      if (s.now() > cut.head - 0.4) warn.push(`bearer ${q} late for lamb ${i}`);
      let props = null;
      for (const [ev, r, l] of parts[q]) {
        s.until(cut[ev] - 0.3, { pose: props ? carriers[q].pose : 'stand', heading: ROWH, props, sway: props ? 3 : 8, seed: 0x6e00 + 10 * i + q });
        s.walk([take(Li, q)], { speed: SPEED.slow, pose: props ? (carriers[q].pose === 'carry' ? 'carry_walk' : 'carry_limbs_walk') : 'walk', props });
        s.act(0.22, { pose: props ? carriers[q].pose : 'stand', face: [Li.hook[0], Li.hook[1]], props });
        props = r || l ? [r, l] : null;
        s.walk([ra], { speed: SPEED.slow, pose: carriers[q].pose === 'carry' ? 'carry_walk' : 'carry_limbs_walk', props });
      }
      s.until(cut.row + 0.15 + 0.05 * q, { pose: carriers[q].pose, heading: ROWH, props, sway: 3, seed: 0x6e20 + 10 * i + q });
      // to the ramp in file, laid on its lower west half
      const sp = spot(i, q);
      const walkPose = carriers[q].pose === 'carry' ? 'carry_walk' : 'carry_limbs_walk';
      s.walk([...file(Li, q), [sp[0], sp[1], R.kevZ(sp[1])]], { speed: 1.0, pose: walkPose, props });
      s.act(0.1, { pose: carriers[q].pose, heading: 270, props });
      s.act(0.14, { pose: 'bow', phase: [0, 0.42], heading: 270, props });
      const tl = s.now();
      t.laid[i][q] = tl;
      s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 270 });
      const names = props.filter(Boolean);
      names.forEach((nm, j) => {
        const y = sp[1] + (names.length > 1 ? (j === 0 ? 0.3 : -0.3) : 0);
        const x = names.length > 1 ? placeX(i)[j] : (placeX(i)[0] + placeX(i)[1]) / 2;
        items.push({ name: nm, show: [tl, null], keys: [{ t: tl, X: x, Y: y, Z: R.kevZ(y) + 0.07, h: 90 + jit(0x6e40, 12, 'ph', i * 20 + q * 2 + j) }], part: [i, q] });
      });
      s.walk(back(q), { speed: SPEED.walk });
      if (i === 1) s.walk([[206.3, 274.3, Z], [202.6, 296, Z], [199.7, 309.4, Z], [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk });
    }
    // the hide: off at its cut, laid by the pillar; the receiver takes it to Lishkat HaParvah ⚙ (not salted on Shabbat)
    const hideAt = [Li.hook[0] + 1.7, Li.hook[1] - 0.95, Z + 0.02];
    t[`hide${i}`] = cut.row + 0.6;
    items.push({ name: 'hide', show: [cut.hide, t[`hide${i}`]], keys: [{ t: cut.hide, X: hideAt[0], Y: hideAt[1], Z: hideAt[2], h: 80 }] });
    Li.hideAt = hideAt;
  }
  // the receiver: the gold basin back to Lishkat HaKelim ⚙, then by the slaughterhouse; the two hides to the Parvah
  const parvah = [130.2, 276.6, Z];
  const toParvah = (gx) => [[gx + 0.6, 376.0, Z], [gx + 0.6, 371, Z], [205, 345.5, Z], [P.apronX, 338, Z], [P.apronX, 321, Z], [199.7, 309.4, Z], [191, 296, Z], [176, 279.2, Z], parvah, [parvah[0], parvah[1] - 2.2, Z]];
  const K = P.kelim;
  R1.walk([[199.7, 309.4, Z], [P.apronX, 321, Z], [P.apronX, 338, Z], [205, 341.4, Z], [232.5, 341.6, Z], [P.way.eastLine, 372, Z], [241.4, 384.4, Z], [243.0, 385.2, 15], [245.2, 386, K.ZY], K.out, K.door, K.in], { speed: SPEED.walk, props: MZ });
  R1.act(0.1, { pose: 'bow', phase: [0, 0.42], heading: 0, props: MZ });
  R1.act(0.1, { pose: 'bow', phase: [0.7, 1], heading: 0 });
  R1.walk([K.door, K.out, [245.2, 386, K.ZY], [243.0, 385.2, 15], [241.4, 384.4, Z], [232, 386.8, Z], [L[0].gap + 1.2, 386.4, Z], [L[0].hookStand[0] + 1.4, L[0].hookStand[1] - 2.4, Z]], { speed: SPEED.walk });
  for (let i = 0; i < 2; i++) {
    const Li = L[i];
    R1.until(t[`hide${i}`] - 0.35, { pose: 'stand', face: [Li.hook[0], Li.hook[1]], sway: 10, seed: 0x6e50 + i });
    R1.walk([[Li.hideAt[0] - 0.4, Li.hideAt[1] - 1.1, Z]], { speed: SPEED.slow });
    R1.act(0.1, { pose: 'bow', phase: [0, 0.45], face: Li.hideAt });
    R1.act(0.1, { pose: 'bow', phase: [0.7, 1], face: Li.hideAt, props: ['hide', null] });
    R1.walk(toParvah(Li.gap), { speed: SPEED.walk, pose: 'carry_shoulder_walk', props: ['hide', null] });
    if (i === 0) {
      R1.act(0.25, { pose: 'bow', phase: [0, 1], heading: 180 });
      R1.walk([...toParvah(L[1].gap)].reverse().slice(1).concat([[L[1].hookStand[0] + 1.7, L[1].hookStand[1] - 2.3, Z]]), { speed: SPEED.walk });
    }
  }

  // ---------------------------------------------------------------------------------------------- flour and wine (⚙ by Nikanor)
  const chav = G.chav;
  const fwSpots = [spot(0, 6), spot(0, 7)];
  const waitC = [R.box.max[0] + 5.2, R.foot - 5.6, Z];
  const waitAt = (q) => { const a = (q * 51 + 30) / 57.2958; return [waitC[0] + Math.sin(a) * 1.8, waitC[1] + Math.cos(a) * 1.8, Z]; };
  const salt = [R.box.min[0] + 0.85, R.foot + 1.7, R.kevZ(R.foot + 1.7) + 0.06];
  t.fwLaid = [];
  for (const [j, slot, name] of [[0, MC.F, 'solet'], [1, MC.WN, 'wine_jug']]) {
    const s = Script.from(t.laid[0][0] - 3.6 + 0.12 * j, [chav[0], chav[1] - 0.6 + 0.8 * j, chav[2]], 270, `fw${j}`);
    const sp = fwSpots[j];
    s.walk([[246, 319.5 + 0.4 * j, 13.5], [240.5, 320 + 0.4 * j, Z], [P.way.eastLine - 0.2 * j, 300, Z], [231.2, 273.2 + 0.3 * j, Z], [sp[0] + 0.3, R.foot - 1.0, Z], [sp[0], sp[1], R.kevZ(sp[1])]], { speed: SPEED.carry, pose: 'carry_walk', props: [name, null] });
    s.act(0.14, { pose: 'bow', phase: [0, 0.42], heading: 270, props: [name, null] });
    t.fwLaid[j] = s.now();
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 270 });
    const y = sp[1];
    items.push({ name, show: [t.fwLaid[j], null], keys: [{ t: t.fwLaid[j], X: (placeX(0)[0] + placeX(0)[1]) / 2, Y: y, Z: R.kevZ(y) + 0.07, h: 90 }], fw: j });
    crew[slot] = s;
  }
  // they salt each lamb's parts when laid (as the tamid's flour and chavitin men — Tamid 4:3; Menachot 21b ⚙)
  t.salted = [0, 0];
  for (let i = 0; i < 2; i++) {
    for (const [j, slot] of [[0, MC.F], [1, MC.WN]]) {
      const s = crew[slot];
      const tReady = Math.max(...t.laid[i]) + 0.1 + 0.15 * j;
      if (i === 1 || s.now() < tReady - 0.2) s.until(tReady - (i === 1 ? walkMin(s.cur, [[salt[0] + 1.6, salt[1] + 0.9, R.kevZ(salt[1] + 0.9)]], SPEED.walk) + 0.05 : 0), { pose: 'stand', face: i === 1 ? waitC : [R.mid, R.halfY], sway: 12, seed: 0x6e60 + 10 * i + j });
      const ys = salt[1] + 0.9;
      s.walk([[spot(i, 0)[0] - (i ? 0 : 0.4) + 0.3 * j, ys + 0.95 * j, R.kevZ(ys + 0.95 * j)]], { speed: SPEED.slow });
      s.act(0.1, { pose: 'bow', phase: [0, 0.4], face: salt });
      s.act(0.08, { pose: 'bow', phase: [0.7, 1], face: salt, props: [null, 'salt'] });
      const qs = j === 0 ? [2, 1, 0] : [5, 4, 3];
      for (const q of qs) {
        const sp = spot(i, q);
        s.walk([[sp[0], sp[1], R.kevZ(sp[1])]], { speed: SPEED.slow, props: [null, 'salt'] });
        s.act(0.2, { pose: 'salt', heading: 270, props: [null, 'salt'] });
      }
      t.salted[i] = Math.max(t.salted[i], s.now());
      const off = [[R.west + 2.4, s.cur[1] - 1.0, R.kevZ(s.cur[1] - 1.0)], [R.west + 2.4, R.foot + 0.4, R.kevZ(R.foot + 0.4)], [R.west + 1.8, R.foot - 1.4, Z]];
      if (i === 0) {
        s.walk([...off, [R.mid + 1, R.foot - 1.6, Z], waitAt(6 + j)], { speed: SPEED.walk });
        s.act(0.1, { pose: 'stand', face: waitC });
      } else {
        // their part done (the fourth lottery's men take the flour up, the morning's wine man the wine): back in, as the
        // tamid's crew after the salting (Tamid 4:3) ⚙
        s.walk([...off, [206.3, 274.3, Z], [202.6, 296, Z], [199.7, 309.4, Z], [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk });
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- up onto the fire (TuM 4:9)
  // the morning's fourth-lottery men, each his part of A then of B; then the flour (U[6], as at the morning tamid); then
  // the wine to the SW horn
  const UP = [];
  t.pick = [[], []]; t.toss = [[], []];
  const upStart = Math.max(t.salted[1] + 0.6, m(24.5));
  const gazitWait = [R.box.max[0] + 3.0, R.foot - 3.2, Z];
  for (let q = 0; q < UP_N; q++) {
    const s = Script.from(upStart - 2.6 + 0.08 * q, gz.inside, 90, `up${q}`);
    s.walk([gz.door, ...P.way.gazitToNW, [P.apronX, 321, Z], [199.7, 309.4, Z], [202.6, 296, Z], [206.3, 274.3, Z], [gazitWait[0] + jit(0x6e70, 1.2, 'x', q), gazitWait[1] + jit(0x6e70, 1.2, 'y', q), Z]], { speed: SPEED.walk });
    UP.push(s);
  }
  const trip = (s, i, q, tAt) => {
    const c = carriers[q], props = [c.right, c.left];
    const walkPose = c.pose === 'carry' ? 'carry_walk' : 'carry_limbs_walk';
    const sp = spot(i, q);
    const pts = [[sp[0] + 0.3, R.foot - 1.2, Z], [sp[0] + 0.3, R.foot + 0.5, R.kevZ(R.foot + 0.5)], [sp[0], sp[1] - 0.6, R.kevZ(sp[1] - 0.6)], [sp[0], sp[1], R.kevZ(sp[1])]];
    const go = tAt - walkMin(s.cur, pts, SPEED.walk);
    if (go > s.now() + 0.02) s.until(go, { pose: 'stand', face: [R.mid, R.halfY], sway: 12, seed: 0x6e80 + 10 * i + q });
    s.walkBy(tAt, pts);
    s.act(0.12, { pose: 'bow', phase: [0, 0.42], heading: 270 });
    t.pick[i][q] = s.now();
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 270, props });
    const ex = R.east + jit(0x6e90, 0.5, 'ex', i * 6 + q);
    const y1 = sp[1] + 1.2;
    s.walk([[ex, y1, R.kevZ(y1)], [ex, R.head - 0.8, R.kevZ(R.head - 0.8)], [ex, R.head + 0.6, ZT], [A.wk.E, A.wk.S, ZT], [A.wk.E - 0.5, A.great.min[1] + 1.0 + ((i * 6 + q) % 5) * 1.4, ZT]], { speed: SPEED.ramp, pose: walkPose, props });
    s.act(0.1, { pose: c.pose, heading: 270, props });
    t.toss[i][q] = s.now() + 0.18;
    s.act(0.32, { pose: 'toss', phase: [0, 1], heading: 270, props });
    s.act(0.15, { pose: 'stand', heading: 270 });
    s.walk([...circuit(P, 'ne', 'sw'), [R.west, A.wk.S, ZT]], { speed: SPEED.walk });
    s.walk(rampDown(P, R.west + jit(0x6e90, 0.5, 'dw', i * 6 + q)), { speed: 1.05 });
  };
  for (let q = 0; q < 6; q++) trip(UP[q], 0, q, upStart + 0.42 * q);
  for (let q = 0; q < 6; q++) trip(UP[q], 1, q, Math.max(UP[q].now() + 0.3, upStart + 2.2 + 0.42 * q));
  for (let q = 0; q < 6; q++) UP[q].walk([[206.3, 274.3, Z], [202.6, 296, Z], [199.7, 309.4, Z], [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk });
  const limbsDone = Math.max(...t.toss[1]);
  // the flour (the minchah of the nesachim, burned whole) — the morning's fourth-lottery flour man up to the great pile
  {
    const s = UP[6];
    const sp = fwSpots[0];
    const tAt = limbsDone + 0.5;
    const pts = [[sp[0] + 0.3, R.foot - 1.2, Z], [sp[0] + 0.3, R.foot + 0.5, R.kevZ(R.foot + 0.5)], [sp[0], sp[1], R.kevZ(sp[1])]];
    s.until(tAt - walkMin(s.cur, pts, SPEED.walk), { pose: 'stand', face: [R.mid, R.halfY], sway: 12, seed: 0x6ea0 });
    s.walkBy(tAt, pts);
    s.act(0.12, { pose: 'bow', phase: [0, 0.42], heading: 270 });
    t.pickF = s.now();
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 270, props: ['solet', null] });
    s.walk([[R.east, sp[1] + 1.2, R.kevZ(sp[1] + 1.2)], [R.east, R.head - 0.8, R.kevZ(R.head - 0.8)], [R.east, R.head + 0.6, ZT], [A.wk.E, A.wk.S, ZT], [A.wk.E - 0.5, A.great.min[1] + 2.4, ZT]], { speed: SPEED.ramp, pose: 'carry_walk', props: ['solet', null] });
    s.act(0.1, { pose: 'carry', heading: 270, props: ['solet', null] });
    t.tossF = s.now() + 0.18;
    s.act(0.32, { pose: 'toss', phase: [0, 1], heading: 270, props: ['solet', null] });
    s.act(0.15, { pose: 'stand', heading: 270 });
    s.walk([...circuit(P, 'ne', 'sw'), [R.west, A.wk.S, ZT], ...rampDown(P, R.west).slice(1), [206.3, 274.3, Z], [202.6, 296, Z], [199.7, 309.4, Z], [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk });
  }
  // the wine: up, to the left round to the south-west horn, poured; back on his heels (Zevachim 6:3) ⚙ minutes
  t.wineOnRamp = [(placeX(0)[0] + placeX(0)[1]) / 2, fwSpots[1][1], R.kevZ(fwSpots[1][1]) + 0.07];
  t.pickW = Math.max(t.tossF + 0.4, limbsDone + 1.0);
  const swAt = [A.wk.W + 0.4, A.wk.S + 0.6, ZT];
  let pourer = null;
  if (opts.pourBySong) {
    // libation-song stages the pour and the concert (it claims 'shabbat-musaf-song'): its pourer — G3's brother 12, the
    // man who took the morning's wine up — takes the jug from the ramp at t.pickW (published on ctx.__g6musaf) and pours
    // at t.pour ⚙
    t.pour = t.pickW + 0.9;
  } else {
    // fallback: the same man (POURER_SEED), out of the Gazit to the ramp's foot
    const s = pourer = Script.from(t.pickW - 3.4, gz.inside, 90, 'pourer');
    s.walk([gz.door, ...P.way.gazitToNW, [P.apronX, 321, Z], [199.7, 309.4, Z], [202.6, 296, Z], [206.3, 274.3, Z], [R.west - 1.2, R.foot - 2.0, Z]], { speed: SPEED.walk });
    const sp = fwSpots[1];
    const pts = [[sp[0] + 0.3, R.foot - 1.2, Z], [sp[0] + 0.3, R.foot + 0.5, R.kevZ(R.foot + 0.5)], [sp[0], sp[1], R.kevZ(sp[1])]];
    if (s.now() > t.pickW - walkMin(s.cur, pts, SPEED.walk)) warn.push('pourer late at the ramp');
    s.until(t.pickW - walkMin(s.cur, pts, SPEED.walk), { pose: 'stand', face: [R.mid, R.halfY], sway: 12, seed: 0x6ea1 });
    s.walkBy(t.pickW, pts);
    s.act(0.12, { pose: 'bow', phase: [0, 0.42], heading: 270 });
    t.pickW = s.now();
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 270, props: ['wine_jug', null] });
    const upW = [[R.west, sp[1] + 1.2, R.kevZ(sp[1] + 1.2)], [R.west, R.head - 0.8, R.kevZ(R.head - 0.8)], [R.west, R.head + 0.6, ZT], [A.wk.W + 1.2, A.wk.S, ZT], swAt];
    s.walk(upW, { speed: SPEED.ramp, pose: 'carry_walk', props: ['wine_jug', null] });
    s.act(0.1, { pose: 'carry', heading: 225, props: ['wine_jug', null] });
    t.wineAt = s.now();
    t.pour = Math.max(s.now() + 0.4, M0 + 0.5);
    s.until(t.pour - 0.05, { pose: 'carry', heading: 225, props: ['wine_jug', null] });
    s.act(0.6, { pose: 'pour', phase: [0, 1], heading: 225, props: ['wine_jug', null] });
    s.act(0.3, { pose: 'stand', heading: 225, props: ['wine_jug', null] });
    s.walk([...upW].reverse().slice(1), { speed: SPEED.ramp, props: ['wine_jug', null] });
    s.walk([[R.west, R.foot - 1.2, Z], [206.3, 274.3, Z], [202.6, 296, Z], [199.7, 309.4, Z], [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk, props: ['wine_jug', null] });
  }
  // the parts on the ramp until each is taken up; the flour and wine until theirs
  for (const it of items) {
    if (it.part) it.show[1] = t.pick[it.part[0]][it.part[1]];
    else if (it.fw === 0) it.show[1] = t.pickF;
    else if (it.fw === 1) it.show[1] = t.pickW;
  }
  if (t.pour > M1 - 6) warn.push(`pour late ${(t.pour - M1).toFixed(1)}`);
  for (const it of items) { it.show = it.show.map(wrap); it.keys = it.keys.map((kk) => ({ ...kk, t: wrap(kk.t) })); }
  for (const s of [...crew, ...UP, ...levites, ...lambs, pourer]) if (s) warn.push(...s.warn);

  return {
    M0, M1, crew, up: UP, levites, lambs, pourer, items, warn, t,
    leads: leads.map(([a, b, i, who]) => [wrap(a), wrap(Number.isFinite(b) ? b : a + 1), i, who]),
    at: { gate: KB.inside, ringA: L[0].ring, ringB: L[1].ring, hookA: L[0].hook, ramp: [212, 284, 18], altar: [217, 321, 25], sw: swAt, ne, swC },
  };
}

// the concert's lengths in seconds as ctx.audio.libation plays them (src/audio/index.js; the same numbers as
// g3/plan.js libTimeline — the trumpet set's pattern, the Psalm 92 sections' melody + 3.5 s)
const D_SET = 0.03 + 3.1 + 0.55 + (9 * 0.27 + 0.12) + 0.55 + 3.1 + 0.5;
export const PSALM_STAND_IN = 92;
const PSALM_DUR = [24.304, 20.323, 19.413];

/**
 * The concert in sim minutes, in step with ctx.audio.libation (as g3/plan.js libTimeline): the first set on the table
 * of the fats, the walk to Ben Arza, the cymbal at the pour, three sections each after a set. L0 is placed so the
 * cymbal falls on the pour. The fallback trumpeters' Scripts follow it.
 */
function concert(ctx, M) {
  const G = g6places(ctx), P = G.P, fats = G.fats;
  const table = [(fats.min[0] + fats.max[0]) / 2, (fats.min[1] + fats.max[1]) / 2, fats.max[2] + 3];
  const du = G.duchan;
  const benArza = [(du.min[0] + du.max[0]) / 2, (du.min[1] + du.max[1]) / 2 + 0.0, du.max[2] + 3];
  // the trumpeters' way from the table to Ben Arza: round the ramp's foot and up Ezrat Kohanim ⚙
  const onTable = [[fats.max[0] - 0.5, fats.min[1] + 0.45, fats.max[2]], [fats.max[0] - 0.5, fats.max[1] - 0.45, fats.max[2]]];
  const by = [[du.min[0] - 0.8, benArza[1] - 1.3, Z], [du.min[0] - 0.8, benArza[1] + 1.3, Z]];
  const way = (k) => [[fats.max[0] + 1.0, onTable[k][1], Z], [206.3, 274.3 - 0.5 * k, Z], [231.2, 273.2 + 0.5 * k, Z], [236.6 + 0.4 * k, 300, Z], [240.4, 322 + 0.6 * k, Z], by[k]];
  let len = 0, prev = onTable[0];
  for (const p of way(0)) { len += Math.hypot(p[0] - prev[0], p[1] - prev[1]) * AMAH; prev = p; }
  const walkS = clamp(len / 1.7, 4, 25);
  const sets = [], blow = [], cym = [], ch = [], prost = [];
  let x = 0;
  for (let s = 0; s < 3; s++) {
    sets.push(x); blow.push(x + D_SET - 0.48); prost.push(x + D_SET - 2.2);
    x += D_SET - 0.2;
    if (s === 0) { x += walkS; cym.push(x); x += 0.9; }
    ch.push([x, x + PSALM_DUR[s] - 3.5, x + PSALM_DUR[s]]);
    x += PSALM_DUR[s] - 2.6;
  }
  const L0 = M.t.pour - cym[0] / 60;
  const mm = (s) => L0 + s / 60;
  const tl = { sets: sets.map(mm), blow: blow.map(mm), cym: cym.map(mm), ch: ch.map((c) => c.map(mm)), prost: prost.map(mm), end: mm(ch[2][2]) };
  // the two trumpeters (fallback only): out of the Gazit to the table of the fats, up onto it; blow; to Ben Arza at
  // his right and left; blow before each later section; back in when the song is done ⚙ ways
  const gz = P.gazit;
  const trumpeters = [0, 1].map((k) => {
    const T = ['trumpet', null];
    const s = Script.from(L0 - 2.6 + 0.06 * k, gz.inside, 90, `trumpeter${k}`);
    s.walk([gz.door, ...P.way.gazitToNW, [P.apronX, 321, Z], [199.7, 309.4, Z], [202.6, 296, Z], [fats.max[0] + 1.0, onTable[k][1], Z]], { speed: SPEED.walk, props: T });
    s.until(L0 - 0.35, { pose: 'stand', heading: 90, props: T });
    s.shift(onTable[k], 0.15, { pose: 'walk', heading: 270, props: T, zExact: true });
    s.act(0.12, { pose: 'stand', heading: 90, props: T, zExact: true });
    s.until(tl.sets[0], { pose: 'stand', heading: 90, props: T, zExact: true });
    s.until(tl.blow[0], { pose: 'blow_trumpet', heading: 90, props: T, zExact: true });
    s.shift([fats.max[0] + 1.0, onTable[k][1], Z], 0.06, { pose: 'walk', heading: 90, props: T });
    s.walk(way(k).slice(1), { until: tl.cym[0] - 0.02, props: T });
    s.until(tl.sets[1], { pose: 'stand', heading: 90, props: T });
    s.until(tl.blow[1], { pose: 'blow_trumpet', heading: 90, props: T });
    s.until(tl.sets[2], { pose: 'stand', heading: 90, props: T });
    s.until(tl.blow[2], { pose: 'blow_trumpet', heading: 90, props: T });
    s.until(tl.end + 0.4, { pose: 'stand', heading: 90, props: T });
    s.walk([[240.4, 322 + 0.6 * k, Z], [236.6 + 0.4 * k, 300, Z], [231.2, 273.2, Z], [206.3, 274.3, Z], [202.6, 296, Z], [199.7, 309.4, Z], [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk, props: T });
    return s;
  });
  return { L0, tl, table, benArza, walkS, trumpeters, section: haazinuSection(ctx) };
}


/**
 * The musaf plan for the current date, cached per runtime generation: pourBySong = libation-song stages the pour and
 * the concert (its pourer takes the jug from the ramp). Pure function of (date, pourBySong); null when not Shabbat.
 */
export function musafPlan(ctx, sim, pourBySong = false) {
  const gen = sim.generation;
  let c = ctx.__g6musafPlans;
  if (!c || c.gen !== gen) c = ctx.__g6musafPlans = { gen, plans: new Map() };
  const key = pourBySong ? 1 : 0;
  if (c.plans.has(key)) return c.plans.get(key);
  let M = null;
  try {
    M = buildMusaf(ctx, sim, { pourBySong });
    if (M) {
      M.song = concert(ctx, M);
      M.claimed = !!pourBySong;
      const S = M.song, T = M.t;
      M.concert = {
        generation: gen, event: 'shabbat-musaf', claimed: !!pourBySong,
        L0: S.L0, tPour: T.pour, sets: S.tl.sets, blow: S.tl.blow, cym: S.tl.cym, ch: S.tl.ch, prost: S.tl.prost, end: S.tl.end, t1: M.M1,
        walkS: S.walkS, table: S.table, benArza: S.benArza, pourAt: M.at.sw,
        wine: { at: T.wineOnRamp, laid: T.fwLaid[1], pick: T.pickW },
        haazinu: { section: S.section, ...HAAZINU[S.section] }, psalmStandIn: PSALM_STAND_IN,
      };
    }
  } catch (e) { console.warn('[sim] g6 musaf plan failed', e); M = null; }
  c.plans.set(key, M);
  return M;
}

/**
 * For libation-song (G3): the musaf's concert as libation-song would stage it — absolute minutes unwrapped near
 * sunrise: L0 (first teki'ah-teru'ah-teki'ah, on the table of the fats), tPour (the pour = the cymbal), sets / blow /
 * cym / ch / prost / end (the ctx.audio.libation timeline, as g3 libTimeline with walkS), t1 (the event's end), wine
 * { at (site [X,Y,Z] on the ramp), laid, pick (when the pourer takes it) }, pourAt (the SW corner of the top),
 * haazinu { section 0..5, he, en }. null when not Shabbat.
 * The pourer is the man who took the morning tamid's wine up from the ramp (TuM 4:9 — each task by the morning's man):
 * libation-song's brother 12 (on Shabbat morning he hands it to the Kohen Gadol, Tamid 7:3); the jug on the ramp was
 * laid by the second lottery's wine man (MC.WN), as at the tamid.
 */
export function musafConcert(ctx, sim) { return musafPlan(ctx, sim, true)?.concert || null; }
