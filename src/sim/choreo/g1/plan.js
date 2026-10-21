// The G1 night, planned once per date (cached on the runtime generation) and shared by the G1 modules: the locking,
// the Moked's sleepers, the impure kohen's descent, the dawn immersions, Gevini, the officer's knock, the first lottery,
// the torch inspection — and the altar's evening crew, whose men go to sleep in the Moked. Each person is a list of
// episodes (util.js); each leg names the module that stages it ('moked' = moked-night with its aliases locking-up and
// moked-dawn; 'altar' = altar-night; 'lot' = lotteries; 'insp' = torch-inspection; 'none' = not shown), so a man walks
// from one module's scene into the next without ever being shown twice.
//
// Hand-overs to other groups (same pool seeds → the same faces): the first lottery's five go on as terumat-hadeshen's
// winner (the slab kohen, who wins) and brothers 0–3 (the young y0–y3), standing where that module's figures appear (its
// groupSpot, facing west) at muchni.t0 − 0.8.
//
// Sources: Middot 1:6–9; Tamid 1:1–3; Rambam BhB 8:5–7, 8:11–12; Yoma 22a, 25a. Minutes and spots: reconstruction ⚙.
import { wrap, span, rand, clamp } from '../../lib/core.js';
import { CUE_LEAD } from '../../lib/cue.js';
import { Track, SitePath, downHoldUp, lotHand, win, hTo, cycles, ramp } from './util.js';
import { mokedPlaces, altarPlaces, gazitPlaces } from './places.js';
import { AMAH } from '../../../core/units.js';

/** people's station geometry (src/people/clips.js, figure frame at scale 1, metres → amot here) */
export const MITRE_GRASP = 0.33;                    // ctx.people.stations.mitreGrasp: lift_mitre's grasp phase
export const MITRE_REACH = 0.5 / AMAH;              // lift_mitre: the crown 0.5 m before the officer
const LOCK_REACH = 0.5 / AMAH;                      // lock: the door face 0.5 m ahead
const KNOCK_REACH = 0.47 / AMAH;                    // knock: the door 0.47 m ahead

export const SEED = {
  winner: 0x7468,      // = terumat-hadeshen's 'winner' pool seed (G2): the slab kohen, who wins the first lottery
  brothers: 0x7469,    // = terumat-hadeshen's 'brothers' pool seed (G2): y0–y3 are its brothers 0–3
  barkai: 0x6261,      // = barkai's 'watchers' pool seed (G2): two of the second lottery's circle go out as the watchers
  keri: 0x6740, elders: 0x6741, levite: 0x6742, officer: 0x6743, gevini: 0x6744, gazit: 0x6745, chazzan: 0x6746,
};
const G2_SEED = 0x7468;   // terumat-hadeshen's SEED (its groupSpot jitter)

const WALK = 1.15, SLOW = 0.85, ELDER = 0.8, STAIR = 0.5, MIKVEH = 0.45, INSPECT = 0.8;   // m/s ⚙
const CREW_LEAD = 2.3;   // minutes before evening-altar.t0 the evening crew leave Beit HaMoked (altar-night's lead covers it)
const DAY = 1440;
/** the limbs still on the fire after midnight (Tamid 2:1 "the limbs and fats not consumed since evening"): spots on the
 * great pile (places.js onPile), names, headings; [4] is terumat-hadeshen's leftover limb ⚙ */
export const LEFT = [{ idx: 2, name: 'limb_oketz', h: 40 }, { idx: 3, name: 'limb_chazeh', h: 130 }, { idx: 4, name: 'limb_gerah', h: 220 }];
export const VOLUNTEERS = ['y0', 'winner', 'y1', 'y2', 'y3'];   // the young and the slab kohen (the order they go down: P.imm)

let CACHE = { gen: -1, ctx: null, plan: null };

/** the night's plan for the current date (shared by every G1 module) */
export function nightPlan(ctx, sim) {
  if (CACHE.plan && CACHE.gen === sim.generation && CACHE.ctx === ctx) return CACHE.plan;
  const plan = build(ctx, sim);
  CACHE = { gen: sim.generation, ctx, plan };
  return plan;
}

// --------------------------------------------------------------------------------------------------- times
function times(ctx, sim) {
  const z = ctx.time?.zmanim || {};
  const ev = (id) => { const e = sim.schedule.byId(id); return e && Number.isFinite(e.t0) && Number.isFinite(e.t1) ? e : null; };
  const W = (id) => win(ev(id));
  const T = { dayType: ctx.time?.dayType || 'weekday' };
  T.lock = W('locking-up') || [wrap(z.tzeit - 15), wrap(z.tzeit + 5)];
  T.night = W('moked-night') || [T.lock[1], wrap(z.alot - 70)];
  T.keri = W('mesibah-keri');
  T.imm = W('dawn-immersion') || [wrap(z.alot - 95), wrap(z.alot - 72)];
  T.gev = W('gevini') || [wrap(z.alot - 72), wrap(z.alot - 70)];
  T.knock = W('memuneh-knock') || [wrap(z.alot - 70), wrap(z.alot - 68)];
  T.first = W('first-lottery') || [T.knock[1], wrap(T.knock[1] + 5)];
  T.lot2 = W('second-lottery');
  const ti = ev('torch-inspection') || ev('lamp-inspection-shabbat');
  T.insp = win(ti) || [T.first[1], wrap(T.first[1] + 13)];
  T.inspId = ti?.id || 'torch-inspection';
  T.torches = T.inspId !== 'lamp-inspection-shabbat';     // no light in hand on Shabbat night (Rambam BhB 8:12)
  T.meetAt = Array.isArray(ti?.pos) ? ti.pos : [238.5, 319.5, 16];
  const mu = ev('muchni');
  T.handG2 = wrap((mu ? mu.t0 : T.insp[1]) - 0.8);       // terumat-hadeshen's figures stand from muchni.t0 − 0.8
  const bl = ev('gates-blasts');
  T.blast = bl ? wrap(bl.t0 + CUE_LEAD) : wrap((z.sunrise ?? 360) - 7);  // gates.js: the blasts and the first gates
  // gates.js opens the court gates from blast + 0.2, 0.12 apart (the Moked's is the 7th), the Mount's 0.15 apart (Kiponus
  // the 4th); swings 0.45 / 0.6 — the residents leave when theirs is open
  T.mokedGateOpen = wrap(T.blast + 0.2 + 0.12 * 6 + 0.5);
  T.kiponusOpen = wrap(T.blast + 0.15 * 3 + 0.65);
  const eve = ev('evening-altar') || ev('friday-last-fats') || ev('shabbat-evening-altar');
  T.eve = eve ? { t0: eve.t0, t1: eve.t1, id: eve.id, n: eve.id === 'shabbat-evening-altar' ? 3 : 4, friday: eve.id === 'friday-last-fats' } : null;
  T.late = W('late-turning');
  T.nightTurn = W('night-turning');
  T.fats = W('fats-burning');
  T.sday = W('shabbat-altar-day');          // Shabbat between the services: the limbs burning, the pile tended now and then
  T.divide = W('showbread-divided');         // … whose groups stand east of the altar, across the tenders' way
  T.sunset = z.sunset; T.midnight = z.midnight; T.alot = z.alot;
  // gates.js closes the court gates at the locking: CLOSE_AT court [0.2, 0.035] × window, order nikanor … korban (4) …
  // moked (6), swing 0.45 — the locking kohen locks the Korban gate and is back inside the Moked gate before it shuts
  const L = span(T.lock[0], T.lock[1]) || 20;
  T.closeKorban = T.lock[0] + (0.2 + 0.035 * 4) * L;
  T.closeMoked = T.lock[0] + (0.2 + 0.035 * 6) * L;
  return T;
}

// --------------------------------------------------------------------------------------------------- build
function build(ctx, sim) {
  const T = times(ctx, sim);
  const M = mokedPlaces(ctx), A = altarPlaces(ctx), G = gazitPlaces(ctx);
  const ar = ctx.elOpt('azarah.achsadra-route')?.params?.routes || null;
  const P = { ctx, T, M, A, G, ar, people: {}, cues: [], props: [], doors: { chel: [], pish: [], nw: [], night: null }, fire: null, stairLog: [], slab: [], keysWin: [] };
  const Z = M.Z, cx = M.cx, ky = M.ky;

  // ---- the floor (⚙): four mats and three seats laid against the figures' real footprints (floorPlan below); who lies
  // where depends on the night (assignments below); the ways run through the kodesh half, where no one lies
  const F = floorPlan(M);
  P.floor = F;
  const slabLie = F.mats.S;
  const SD = M.stairDown[0];
  const KOD = ky - 0.6, XW = cx - 5.4, XE = cx + 4.55, BAND = ky + 2.5;
  const H = { SD, KOD, XW, XE, BAND, KW: [XW, KOD, Z], KE: [XE, KOD, Z], WW: [XW, ky + 2.6, Z], W2: [cx - 4.85, ky + 4.25, Z],
    NW2: [cx - 4.75, ky + 6.9, Z], HNW: [cx - 2.35, ky + 7.15, Z] };
  P.hall = H;
  // the first lottery's circle round the hearth (Yoma 25a "the kohanim stand round"), r 2.75: the two who come up first
  // wait on its south, between the mats and the hearth, while the others still sleep; the impure kohen sits apart (K1)
  const altarAtNight = !!T.nightTurn;                 // y0 turns the limbs in the small hours (not on Shabbat's)
  // the order they go down to immerse: the night-turner last (he stays on the altar as long as he may); on a night with
  // no turning, y0 — who sat up by the hearth — first
  const order = altarAtNight ? ['winner', 'y1', 'y2', 'y3', 'y0'] : ['y0', 'winner', 'y1', 'y2', 'y3'];
  P.order = order;
  const circleAng = { [order[0]]: order[0] === 'winner' ? 150 : 210, [order[1]]: order[1] === 'winner' ? 150 : 210, [order[2]]: 330, [order[3]]: 30, [order[4]]: 90 };
  P.circle = Object.fromEntries(Object.entries(circleAng).map(([k, a]) => [k, { at: M.byHearth(a, 2.75), h: (a + 180) % 360, ang: a }]));
  // round the circle clockwise from 30°, where the officer lifts the first man's mitre
  P.countOrder = Object.keys(circleAng).sort((a, b) => ((circleAng[a] - 30 + 360) % 360) - ((circleAng[b] - 30 + 360) % 360));
  P.officerSpot = [cx, M.hearth[1] + 3.35, Z];        // north of the circle, facing the hearth
  const A_ = F.mats.A.at, B_ = F.mats.B.at, C_ = F.mats.C.at, S_ = F.mats.S.at;
  const lens = [[cx - 2.3, ky + 4.6, Z], [cx - 2.2, ky + 7.05, Z]];   // past the hearth's west, north of it
  /** from a mat or seat to the stair door (C, the slab kohen and K2 round by the kodesh half) */
  const toStair = {
    A: [[A_[0], ky + 3.4, Z], [XW, ky + 3.1, Z], SD],
    B: [[B_[0] - 1.2, B_[1] + 0.15, Z], [XW, B_[1] + 0.55, Z], [XW, ky + 2.6, Z], SD],
    C: [[XE, BAND, Z], [XE, KOD, Z], [XW, KOD, Z], [XW, ky + 2.6, Z], SD],
    S: [[XE, S_[1] - 0.5, Z], [XE, KOD, Z], [XW, KOD, Z], [XW, ky + 2.6, Z], SD],
    K2: [[XE, F.seats.K2.at[1] - 0.2, Z], [XE, KOD, Z], [XW, KOD, Z], [XW, ky + 2.6, Z], SD],
  };
  /** from the stair door back up to the circle: the south places by the kodesh half and the band south of the hearth
   * (the mats still occupied); the north ones across the emptied west bay */
  const fromStair = (key) => {
    const c = P.circle[key].at;
    if (c[1] < M.hearth[1]) return [[XW, ky + 2.6, Z], [XW, KOD, Z], [XE, KOD, Z], [XE, BAND, Z], [c[0], BAND, Z], c];
    const via = [[A_[0], ky + 3.4, Z], ...lens];
    if (c[0] < cx) return [...via, c];
    return [...via, [cx + 2.1, ky + 7.05, Z], c];
  };
  /** from inside the wicket (gateIn) or the Moked gate to a mat or seat */
  const intoX = {
    A: [[XW, KOD, Z], [XW, ky + 2.6, Z], [A_[0], ky + 3.4, Z], A_],
    B: [[B_[0], KOD, Z], B_],
    C: [[XE, KOD, Z], [XE, BAND, Z], C_],
    S: [[XE, KOD, Z], [XE, S_[1] - 0.5, Z], S_],
    K1: [[XE, KOD, Z], [XE, F.seats.K1.at[1] - 0.8, Z], F.seats.K1.at],
    K2: [[XE, KOD, Z], [XE, F.seats.K2.at[1] - 0.2, Z], F.seats.K2.at],
  };
  P.ways = { toStair, fromStair, intoX };

  // ---- who lies where (⚙): the floor holds the slab kohen and three young; the impure kohen's mat (A) is taken after
  // his keri by a man of the evening crew; on Friday night there are more young than mats, so two sit up by the hearth
  const crew = T.eve ? (T.eve.n === 3 ? ['y0', 'y1', 'y2'] : ['y0', 'y1', 'y2', 'y3']) : [];
  P.crew = crew;
  const friday = !!T.eve?.friday, shabbatEve = T.eve?.n === 3;
  const EVE = friday ? { y4: ['A'], y1: ['B'], y2: ['C'], y0: ['K2'], y3: ['K1', 'A'] }
    : shabbatEve ? { y4: ['A'], y3: ['B'], y1: ['A'], y2: ['C'] }
      : { y4: ['A'], y1: ['A'], y2: ['B'], y3: ['C'] };
  const SMALL = T.dayType === 'shabbat' ? { y1: 'A', y3: 'B', y2: 'C' }
    : T.dayType === 'friday' ? { y3: 'A', y1: 'B', y2: 'C' }
      : { y1: 'A', y2: 'B', y3: 'C' };
  SMALL.y0 = altarAtNight ? null : 'K2';
  P.assign = { EVE, SMALL };
  const place = (id) => F.mats[id] || F.seats[id];
  P.place = place;

  // ---- the immersions (dawn-immersion): the five go down as a pair and then a trio, one a little behind another, and
  // come up together, so no two pass on the winding stair; each lays his garments by the mikveh, immerses, stands
  // drying, warms himself at the fire, dresses where he laid them and waits for his companions (Tamid 1:1–2) ⚙. The
  // arrivals are spaced so that someone is always at the mikveh (the dawn-immersion view) through the event
  const sched = immersionSchedule(T, order);
  P.imm = sched;
  P.immArrive = sched.a;
  P.stairLog = [];
  P.descentFromWicket = descentMinutes(P, M, 'y0', null);
  const fromOf = (key) => (key === 'winner' ? 'S' : SMALL[key]);
  const rise = {};
  for (const key of VOLUNTEERS) {
    if (key === 'y0' && altarAtNight) continue;
    rise[key] = sched.a[key] - descentMinutes(P, M, key, fromOf(key));
  }
  P.rise = rise;
  P.insp = inspectionPlan(P, T, M);
  meeting(P, T, M);
  P.cues.push({ key: `imm:${Math.round(sched.w0 * 10)}`, t: sched.w0 + CUE_LEAD, caption: CAP.imm, at: M.passage[1], range: 70, owner: 'moked' });

  // ---- the altar crew (altar-night): who is on the altar when, and where each hands over to the Moked
  const ALTAR = altarPlan(P, T, M, A, altarAtNight);
  P.altar = ALTAR;

  // ---- the evening: the impure kohen's keri first (it frees mat A), then the others
  P.eveTracks = {};
  for (const key of ['y4', 'y0', 'y1', 'y2', 'y3']) {
    const plan = EVE[key];
    const hand = ALTAR.eveningHand[key];
    if (!plan || (crew.includes(key) && !hand)) continue;      // on the altar through 24:00 (late-turning)
    P.eveTracks[key] = eveningYoung(P, T, M, G, key, plan, hand);
  }
  // ---- the young kohanim (brothers 0–3) and the impure one (y4)
  for (const key of ['y0', 'y1', 'y2', 'y3', 'y4']) {
    const eps = [...(ALTAR.episodes[key] || [])];
    // -------- small hours (00:00 → the morning)
    if (key === 'y4') eps.push(tevulYomSmall(P, M, T));
    else {
      const sp = SMALL[key] ? place(SMALL[key]) : null;
      const tr = new Track(0, sp ? sp.at : M.gateIn, sp ? sp.h : 0, 'moked', 'off');
      if (!sp) {
        tr.until(ALTAR.y0hand, { owner: 'none' });     // on the altar (altar-night) until he comes in by the wicket
        tr.at(M.gateIn, 0);
      } else if (sp.pose === 'sit_floor') sitUp(tr, rise[key], sp, key);
      else tr.until(rise[key], { pose: sp.pose, h: sp.h });
      immersion(tr, P, M, key, SMALL[key]);
      waitAndTurn(tr, P, T, key);
      firstLottery(tr, P, T, M, key);
      inspection(tr, P, T, M, key);
      eps.push(tr.episode());
    }
    // -------- the evening (→ 24:00); a crew member who stays on the altar has none
    if (P.eveTracks[key]) eps.push(P.eveTracks[key]);
    P.people[key] = { pool: key === 'y4' ? 'keri' : 'young', idx: key === 'y4' ? 0 : +key[1], eps };
  }

  // ---- the slab kohen (G2's winner)
  {
    const eps = [];
    const tr = new Track(0, slabLie.at, slabLie.h, 'moked', 'off');
    tr.until(rise.winner, { pose: 'lie' });
    immersion(tr, P, M, 'winner', 'S');
    waitAndTurn(tr, P, T, 'winner');
    firstLottery(tr, P, T, M, 'winner');
    inspection(tr, P, T, M, 'winner');
    eps.push(tr.episode());
    eps.push(lockingKohen(P, T, M, G, slabLie));
    P.people.winner = { pool: 'slab', idx: 0, eps };
  }

  // ---- the elders on the rovadin, the Levite who sleeps outside (Middot 1:9), the officer, Gevini
  P.people.elders = M.elders.map((e, i) => ({ pool: 'elders', idx: i, eps: elderEps(P, T, M, G, e, i) }));
  P.people.levite = { pool: 'levite', idx: 0, eps: leviteEps(P, T, M) };
  P.people.officer = { pool: 'officer', idx: 0, eps: officerEps(P, T, M) };
  P.people.gevini = { pool: 'gevini', idx: 0, eps: geviniEps(P, T, ctx) };

  // ---- doors (wanted open, minutes): the Moked's chel door at the knock; the wicket for the inspection and the crew
  P.doors.chel.push([T.knock[0] + 0.72, T.knock[0] + 1.55]);
  // the corner chambers' doors shut for the night (Middot 2:3: every opening had doors) ⚙; the NW one opens for those
  // going down the winding stair — the impure kohen, the dawn immersions
  // (from the first man to come in for the night: on Friday the crew at sunset)
  const firstIn = Math.min(T.lock[0], ...Object.values(ALTAR.eveningHand).map((x) => x.t));
  P.doors.night = [firstIn - 1, T.mokedGateOpen];
  for (const u of P.stairLog) P.doors.nw.push(u.dir === 'down' ? [u.t0 - 0.45, u.t0 + 0.4] : [u.t1 - 0.4, u.t1 + 0.35]);
  P.doors.pish.push(...ALTAR.wicket, P.insp.pishOpen, P.insp.pishBack);
  P.fire = ALTAR.fire;
  return P;
}

// --------------------------------------------------------------------------------------------------- the floor
/**
 * The chol half of Beit HaMoked as built (courts/moked.js) holds four sleeping mats clear of one another, of the hearth
 * (its kerb and star logs), of the chel door's two 5-amah leaves (the Ish Har HaBayit's party swings them open at night —
 * night-watch.js), of the lamp stand of the kohanic post and of the way to the stair door (plan-check.mjs --moked draws
 * and tests it against places.js FOOT):
 *   S  the slab kohen on his back, his head on the keys slab, feet east (Middot 1:9)
 *   A  north–south in the west bay by the stair door (the impure kohen's until his keri, then a crewman's)
 *   B  east–west along the kodesh line, west of the slab
 *   C  north–south in the east bay
 * and two seats in the NE corner of the floor, by the east ledges: K1 ("he came and sat beside his brothers", Tamid 1:1)
 * and K2, for those who sit up on Friday night (there are more young than mats then) ⚙. The elders climb onto the
 * ledges at their kodesh end, so the corner stays clear.
 */
function floorPlan(M) {
  const Z = M.Z, cx = M.cx, ky = M.ky, s = M.slab, h = M.hearth;
  return {
    mats: {
      S: { pose: 'lie', at: [s[0] + 3.55, s[1] - 0.4, Z], h: 90 },
      A: { pose: 'sleep', at: [cx - 4.2, ky + 6.1, Z], h: 90 },
      B: { pose: 'sleep', at: [cx - 1.25, ky + 1.55, Z], h: 180 },
      C: { pose: 'sleep', at: [cx + 3.65, ky + 3.15, Z], h: 270 },
    },
    seats: {
      K1: { pose: 'sit_floor', at: [cx + 5.9, ky + 2.5, Z], h: 270 },
      K2: { pose: 'sit_floor', at: [cx + 5.9, ky + 0.95, Z], h: 270 },
    },
  };
}

/**
 * sitting on the floor, back on his heels, hands on his thighs ("he came and sat beside his brothers", Tamid 1:1 —
 * people's sit_floor), turning a little now and then; now and then up on his knees a moment, shifting his weight ⚙;
 * until t
 */
function sitUp(tr, t, sp, key) {
  let k = 0;
  while (tr.now() < t - 0.6) {
    const s0 = Math.round(tr.now());
    const seg = Math.min(t - tr.now() - 0.35, 4 + 6 * rand(0x6a1b, key, s0, k));
    tr.hold(seg, { at: sp.at, h: (sp.h + 20 * (rand(0x6a1b, key, s0, 'h') - 0.5) + 360) % 360, turn: 0.08, pose: 'sit_floor' });
    if (t - tr.now() > 0.5 && rand(0x6a1b, key, k, 's') < 0.4) {
      tr.hold(0.14, { pose: 'kneel', phase: (l, d) => 0.5 - 0.17 * Math.sin(Math.PI * clamp(l / d)) });   // shifts his weight
    }
    k++;
  }
  tr.until(t, { at: sp.at, h: sp.h, turn: 0.08, pose: 'sit_floor' });
}

/** standing about (a slow turn now and then) until t */
function dawdle(tr, t, h, key, role, prop) {
  let k = 0;
  while (tr.now() < t - 0.35) {
    const s0 = Math.round(tr.now() * 10);
    const seg = Math.min(t - tr.now() - 0.2, 0.6 + 1.1 * rand(0x6a1a, key, s0, k));
    tr.hold(seg, { h: (h + 26 * (rand(0x6a1a, key, s0, 'h') - 0.5) + 360) % 360, turn: 0.04, pose: 'stand', role, prop });
    k++;
  }
  tr.until(t, { h, turn: 0.04, pose: 'stand', role, prop });
}

// --------------------------------------------------------------------------------------------------- the immersion
/**
 * The order and minutes of the dawn immersions ⚙ (order: a pair, then a trio — build() above), each arriving at the
 * mikveh as the one before him goes over to the fire, so someone is always there (the dawn-immersion view); each stands
 * drying D minutes, warms himself F at the fire, dresses and waits for his companions; the pair goes up as the trio
 * comes down (before them: no two pass on the stair), and the trio's last man is dressed as the event ends.
 */
function immersionSchedule(T, order) {
  const w0 = T.imm[0], w1 = w0 + span(T.imm[0], T.imm[1]);
  const LAY = 0.6, DRESS = 0.35;
  const F = clamp((w1 - 0.1 - (w0 + 1.14)) / 6.9, 1.4, 4.5), D = 0.95 * F;
  const TM = LAY + D + F + DRESS;
  const [p0, p1, t0, t1, t2] = order;
  const a = {};
  a[p0] = w0 - 0.3; a[p1] = a[p0] + F;
  const leave1 = a[p1] + TM + 0.1;
  a[t0] = leave1 - 0.6; a[t1] = a[t0] + F; a[t2] = a[t1] + F;
  const leave2 = a[t2] + TM + 0.1;
  return {
    w0, w1, F, D, LAY, a,
    group: { [p0]: leave1, [p1]: leave1, [t0]: leave2, [t1]: leave2, [t2]: leave2 },
    rank: { [p0]: 0, [p1]: 1, [t0]: 0, [t1]: 1, [t2]: 2 },
    slot: { [p0]: 0, [p1]: 1, [t0]: 2, [t1]: 0, [t2]: 1 },
  };
}

/** a volunteer's places in the Beit HaTevilah: where he lays his garments, stands and dresses; his place at the fire */
function immSpot(P, M, key) {
  const K = M.mikveh, j = P.imm.slot[key];
  const X = K.deep[0] + 0.15 + 1.25 * j, Y = M.bht.min[1] + 0.95;
  const f = M.medurah, ang = [220, 250, 195][j] * Math.PI / 180;
  return { spot: [X, Y, M.zF], laid: [X + 0.1, M.bht.min[1] + 1.75, M.zF], fire: [f[0] + Math.sin(ang) * 2.15, f[1] + Math.cos(ang) * 2.15, M.zF],
    exit: [K.edge[0] + 0.25, Y + 0.35, M.zF] };
}

/** up from his mat or seat (or in at the wicket from the altar, dressed) and down to his place by the mikveh */
function descend(tr, P, M, key, from) {
  const Z = M.Z, H = P.hall, sp = immSpot(P, M, key);
  const garments = from ? 'folded_garments' : null;
  const role = from ? 'off' : 'k';
  if (from) {
    // up from the mat (or from sitting) onto his knees, the garments taken from beside him, up on his feet
    if (P.place(from).pose === 'sit_floor') tr.hold(0.1, { pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d) });
    else tr.hold(0.14, { pose: 'kneel', phase: downHoldUp(0.04, 0.05) });
    tr.hold(0.04, { pose: 'stand', prop: garments });
    tr.walk(P.ways.toStair[from], { speed: SLOW, prop: garments });
  } else tr.walk([[M.gateIn[0], H.KOD, Z], H.KW, H.WW, H.SD], { speed: WALK, role: 'k' });
  // down the winding stair to the passage under the Birah (Middot 1:9)
  const s0 = tr.now();
  tr.walk(M.stairDown.slice(1), { speed: STAIR, prop: garments, role });
  P.stairLog.push({ key, dir: 'down', t0: s0, t1: tr.now() });
  tr.walk(M.passage.slice(1), { speed: WALK, prop: garments, role });
  tr.walk([[M.passageEnd[0] - 0.9, sp.spot[1], M.zF], sp.spot], { speed: WALK, prop: garments, role });
}

/** minutes from rising (or from the wicket) to his place by the mikveh (a dry run of descend) */
function descentMinutes(P, M, key, from) {
  const tr = new Track(0, from ? P.place(from).at : M.gateIn, 0, 'moked', 'off');
  const log = P.stairLog;
  P.stairLog = [];
  descend(tr, P, M, key, from);
  P.stairLog = log;
  return tr.now();
}

/**
 * The volunteers rise in their own clothes, take their folded garments, go down the winding stair and along the lamp-lit
 * passage to the Beit HaTevilah, lay the garments by the mikveh, go down into it and immerse, come up, stand drying,
 * warm themselves at the fire, put on the four garments where they laid them, wait for their companions and come back
 * up dressed (Tamid 1:1–2: whoever wishes to clear the altar rises early and immerses; Yoma 3:3: none enters the court
 * for service without immersing). The garments are laid on the stone by the mikveh's south side ⚙ (where the
 * dawn-immersion view looks). from: his mat or seat (null: he comes in from the altar, dressed, by the wicket).
 */
function immersion(tr, P, M, key, from) {
  const S = P.imm, K = M.mikveh, a = S.a[key], sp = immSpot(P, M, key);
  descend(tr, P, M, key, from);
  if (tr.now() < a - 0.02) tr.until(a, { h: 0, pose: 'stand', prop: from ? 'folded_garments' : null, role: from ? 'off' : 'k' });
  // his clothes off by the mikveh — the holy garments laid on the stone (in from the altar) or the folded bundle with
  // his own clothes — and the linen sheet wrapped about him (people's kohen_bathing; Yoma 3:3) ⚙ the change unseen
  if (!from) {
    tr.hold(0.14, { h: 0, pose: 'kneel', phase: downHoldUp(0.04, 0, true), role: 'k' });
    tr.hold(0.12, { h: 0, pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), role: 'bath' });
  } else {
    tr.hold(0.1, { h: 0, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d), prop: 'folded_garments', role: 'off' });
    tr.hold(0.08, { h: 0, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), role: 'bath' });
  }
  const tLaid = tr.now() - 0.07;
  // the mikveh: down its steps from the east into the deep part, immerse, come up (Yoma 31a: an amah by an amah by 3)
  tr.walk([[K.edge[0], sp.spot[1] + 0.3, M.zF], K.edge, K.top, K.step, K.deep], { speed: MIKVEH, role: 'bath' });
  tr.hold(0.16, { h: 270, pose: 'bathe', phase: ramp(0, 1), role: 'bath' });
  tr.walk([K.step, K.top, K.edge, [K.edge[0], sp.spot[1] + 0.3, M.zF], sp.spot], { speed: MIKVEH, role: 'bath' });
  // "he came up, dried himself and warmed himself before the fire" (Tamid 1:1): in the sheet by his garments, then
  // his hands to the fire (people's 'warm')
  dawdle(tr, a + S.LAY + S.D, 0, key, 'bath');
  tr.walk([sp.exit, sp.fire], { speed: SLOW, role: 'bath' });
  const back = tr.walkMin([sp.exit, sp.spot], SLOW);
  tr.until(a + S.LAY + S.D + S.F - back, { face: M.medurah, pose: 'warm', role: 'bath' });
  tr.walk([sp.exit, sp.spot], { speed: SLOW, role: 'bath' });
  // the four garments (Yoma 7:5): he kneels by them in the sheet and rises dressed ⚙ (the change itself unseen)
  tr.hold(0.16, { h: 0, pose: 'kneel', phase: downHoldUp(0.05, 0, true), role: 'bath' });
  const tDressed = tr.now();
  tr.hold(0.16, { h: 0, pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), role: 'k' });
  P.props.push({ name: 'folded_garments', at: sp.laid, h: 90, show: [tLaid, tDressed], owner: 'moked' });
  // he waits by the mikveh for his companions; they go up one behind another, to wait by the hearth
  dawdle(tr, S.group[key] + 0.13 * S.rank[key], 20, key, 'k');
  tr.walk([[M.passageEnd[0] - 0.9, sp.spot[1], M.zF], M.passageEnd, [M.passage[0][0], M.passage[0][1], M.zF]], { speed: WALK, role: 'k' });
  const u0 = tr.now();
  tr.walk([...M.stairDown].reverse().slice(1), { speed: STAIR, role: 'k' });
  P.stairLog.push({ key, dir: 'up', t0: u0, t1: tr.now() });
  tr.walk(P.ways.fromStair(key), { speed: SLOW, role: 'k' });
}

/** after the immersion: by the hearth, facing it; turning to the door at the knock; then the circle's centre */
function waitAndTurn(tr, P, T, key) {
  const c = P.circle[key];
  const door = [P.M.cx, P.M.door.min[1], P.M.Z];
  tr.until(T.knock[0] + 0.55 + 0.04 * P.order.indexOf(key), { pose: 'stand', face: P.M.hearth, role: 'k' });
  tr.until(T.knock[0] + 1.3, { pose: 'stand', face: door, role: 'k' });
  tr.until(T.first[0], { pose: 'stand', h: c.h, role: 'k' });
}

// --------------------------------------------------------------------------------------------------- the first lottery
/**
 * Round the hearth (Tamid 1:2; Yoma 22a, 25a): "raise your fingers" — one finger or two, never a thumb; the officer
 * lifts one man's mitre and counts the fingers round from him; where the count ends, he has won. Weekdays: then two of
 * them light the torches at the hearth (Tamid 1:3). Legs owned by the lotteries module.
 */
/**
 * The first lottery's minutes ⚙ from its start F: the officer goes behind the first man of the count (L.go → L.reach),
 * grasps his mitre (→ L.grasp: people's MITRE_GRASP; the man's headgear off from here), lifts it (→ L.lifted), back to his
 * place (→ L.back), counts (F + 1.07 … 2.57), and after the winner is named puts it back on his head (L.ret0 → L.on:
 * headgear on; → L.done) — no kohen serves without the mitznefet (Zevachim 17b) ⚙ — and is back at his place by L.home.
 */
export function lot1Times(F) {
  return { go: F + 0.55, reach: F + 0.58, grasp: F + 0.61, lifted: F + 0.66, back: F + 0.7, ret0: F + 2.72, ret1: F + 2.76, on: F + 2.81, done: F + 2.84, home: F + 2.88 };
}

function firstLottery(tr, P, T, M, key) {
  const F = T.first[0], c = P.circle[key], k = P.countOrder.indexOf(key);
  const off = 0.015 * k + 0.02 * rand(SEED.officer, 'lot', k);
  tr.set({ owner: 'lot', role: 'k' });
  tr.until(F + 0.55 + off, { pose: 'stand', h: c.h });
  tr.until(F + 2.85 + off, { pose: 'circle_lot', phase: lotHand(0.07, 0.1), h: c.h });
  // the count starts with the man whose mitre the officer lifts (Yoma 25a): his head bare until it is put back
  if (key === P.countOrder[0]) { const L = lot1Times(F); tr.mark(L.grasp, L.on); }
  const bearer = P.insp.torch && (P.insp.torch.east === key || P.insp.torch.west === key);
  if (bearer) {
    const lightAt = M.byHearth(c.ang, 2.05);
    tr.until(F + 3.15 + (key === P.insp.torch.west ? 0.3 : 0), { pose: 'stand', h: c.h });
    tr.walk([lightAt], { speed: SLOW });
    tr.hold(0.1, { face: M.hearth, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d) });
    tr.hold(0.1, { face: M.hearth, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), prop: 'torch' });
    tr.walk([c.at], { speed: SLOW, pose: 'torch_walk', prop: 'torch' });
    tr.until(T.insp[0], { h: c.h, pose: 'torch', prop: 'torch' });
  } else tr.until(T.insp[0], { pose: 'stand', h: c.h });
}

/** the officer's lottery: the call, the mitre, the count (one turn of his head per finger), the winner announced */
function officerLottery(tr, P, T, M) {
  const F = T.first[0], L = lot1Times(F);
  tr.set({ owner: 'lot', role: 'k' });
  tr.until(F + 0.45, { pose: 'stand', face: M.hearth });
  const fc = P.circle[P.countOrder[0]], first = fc.at;
  // behind the first man, outside the circle and facing the hearth as he does: his crown MITRE_REACH before the officer
  const behind = M.byHearth(fc.ang, 2.75 + MITRE_REACH), home = P.officerSpot;
  const MI = [null, 'migbaat'];
  tr.until(L.go, { pose: 'stand', face: first });
  tr.walk([behind], { until: L.reach, speed: 0.85 });
  // he takes the mitre from his head (Yoma 25a): people's lift_mitre — reach, grasp at MITRE_GRASP, raise, at the chest
  tr.hold(L.grasp - L.reach, { h: fc.h, pose: 'lift_mitre', phase: ramp(0, MITRE_GRASP) });
  tr.hold(L.lifted - L.grasp, { h: fc.h, pose: 'lift_mitre', phase: ramp(MITRE_GRASP, 1), prop: 'migbaat' });
  tr.walk([home], { until: L.back, prop: 'migbaat' });
  tr.until(F + 1.07, { pose: 'stand', face: first, props: MI });
  // the fingers held out: one or two each (Yoma 22a); the count named runs three rounds and ends on the winner — the
  // mitre in his left hand while he points ⚙
  const fingers = P.countOrder.map((k, i) => 1 + (rand(SEED.officer, 'f', i) < 0.35 ? 1 : 0));
  const seq = [];
  for (let r = 0; r < 3; r++) P.countOrder.forEach((k, i) => { for (let f = 0; f < fingers[i]; f++) seq.push(k); });
  for (let i = 0; i < P.countOrder.length; i++) { const k = P.countOrder[i]; for (let f = 0; f < fingers[i]; f++) seq.push(k); if (k === 'winner') break; }
  const dt = (2.62 - 1.12) / seq.length;
  for (const k of seq) tr.hold(dt, { face: P.circle[k].at, pose: 'point', props: MI });
  tr.until(L.ret0, { pose: 'stand', face: P.circle.winner.at, props: MI });
  // the mitre put back on his head ⚙ (lift_mitre played back), before anyone goes to serve
  tr.walk([behind], { until: L.ret1, prop: 'migbaat' });
  tr.hold(L.on - L.ret1, { h: fc.h, pose: 'lift_mitre', phase: ramp(1, MITRE_GRASP), prop: 'migbaat' });
  tr.hold(L.done - L.on, { h: fc.h, pose: 'lift_mitre', phase: ramp(MITRE_GRASP, 0) });
  tr.walk([home], { until: L.home, speed: 0.85 });
  tr.until(F + 4.3, { pose: 'stand', face: P.circle.winner.at });
  P.lot1 = { tCall: F + 0.5, tMitre: L.grasp, tBack: L.on, tWon: F + 2.68, count: seq.length, fingers, target: P.countOrder[0] };
  // round the east of the circle to the keys slab: he will take the key (Tamid 1:3)
  const S = M.slab, Z = M.Z;
  tr.walk([[M.cx + 3.85, M.hearth[1] + 2.4, Z], [M.cx + 4.7, M.hearth[1] - 1.3, Z], [S[0] + 2.4, S[1] - 1.35, Z], [S[0], S[1] - 0.65, Z]], { until: T.insp[0], speed: SLOW });
}

// --------------------------------------------------------------------------------------------------- the inspection
function inspectionPlan(P, T, M) {
  const I = T.insp[0];
  const r = { tKey: I + CUE_LEAD, tUnlock: I + 0.8, pishOpen: [I + 0.82, I + 2.3] };
  r.east = ['officer', 'y2', 'y0'];  r.west = ['y1', 'winner', 'y3'];
  r.file = ['y2', 'y0', 'y1', 'winner', 'y3'];          // after the officer through the wicket
  r.torch = T.torches ? { east: 'y2', west: 'y1' } : null;
  // terumat-hadeshen's spots (its groupSpot / winner start), facing west: they take over there at muchni.t0 − 0.8
  const G = T.meetAt, Gz = G[2] ?? 16;
  const jit = (a, k0, k1) => (rand(G2_SEED, k0, k1) * 2 - 1) * a;
  r.g2 = { winner: [G[0] - 2.4, G[1] - 0.6, Gz] };
  ['y0', 'y1', 'y2', 'y3'].forEach((k, i) => { r.g2[k] = [G[0] - 1.6 + jit(0.35, 'gx', i), G[1] - 3.2 + (i % 4) * 1.35 + jit(0.3, 'gy', i), Gz]; });
  r.hand = T.handG2;
  return r;
}

/**
 * The two companies (Tamid 1:3; Rambam BhB 8:11): the officer takes the key, opens the wicket and goes into the court;
 * the kohanim follow with two torches (none on Shabbat night — BhB 8:12), part east and west along the achsadra
 * (site.js azarah.achsadra-route, reconstruction), inspecting as they go, to the chavitin chamber; "Shalom — all is
 * well"; the officer takes the torches in to set the chavitin makers to work ⚙; the five wait where terumat-hadeshen's
 * men wait. Legs owned by torch-inspection. Each company walks in file: every man the leader's distance along the
 * route less his place × SPACING, so they stop behind one another when the leader stops to look.
 */
const SPACING = 1.35;   // m between men in file ⚙

function companyRoute(P, side) {
  const ar = P.ar, M = P.M;
  const raw = ar?.[side] || (side === 'east'
    ? [[213.25, 389.5, 16], [238.5, 389.5, 16], [238.5, 319.5, 16]]
    : [[213.25, 389.5, 16], [101, 389.5, 16], [101, 368.25, 16], [73.5, 368.25, 16], [73.5, 279, 16], [200, 279, 16], [200, 269.5, 16], [238.5, 269.5, 16], [238.5, 319.5, 16]]);
  // up to the meeting place: the companies stop short of each other by the chamber (east from the north, west from the
  // south) ⚙
  const pts = raw.filter((p) => p[2] >= 15.9).map((p) => [p[0], p[1], p[2]]);
  const last = pts[pts.length - 1];
  last[1] = side === 'east' ? P.T.meetAt[1] + 2.9 : P.T.meetAt[1] - 2.9;
  return [[M.gateOut[0], M.gateOut[1], M.Z], ...pts.slice(1)];
}

/** the leader's distance along the route over time: { path, tS, dS, vS (m/min), L, tEnd } */
function companyTimeline(P, side, t0) {
  const pts = companyRoute(P, side);
  const speed = side === 'east' ? 0.68 : INSPECT;
  const pauses = {};
  if (side === 'west') for (let i = 1; i < pts.length - 1; i++) pauses[i] = 0.2;
  else {
    // the east company stops at the court's north-east corner, by the slaughter rings and at the altar's north-east,
    // torches raised ⚙
    const a = pts[1];
    pts.splice(2, 0, [a[0], 355.5, 16], [a[0], 336.5, 16]);
    pauses[1] = 0.55; pauses[2] = 0.45; pauses[3] = 0.4;
  }
  const path = new SitePath(pts);
  const tS = [], dS = [], vS = [];
  let t = t0, d = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = path.cum[i] - path.cum[i - 1];
    tS.push(t); dS.push(d); vS.push(speed * 60);
    t += L / (speed * 60); d += L;
    if (pauses[i] && i < pts.length - 1) { tS.push(t); dS.push(d); vS.push(0); t += pauses[i]; }
  }
  tS.push(t); dS.push(d); vS.push(0);
  return { path, pts, tS, dS, vS, L: d, tEnd: t, t0, speed };
}

/** the companies' timelines and the meeting, once the inspection's times are known */
function meeting(P, T, M) {
  const R = P.insp, I = T.insp[0];
  P.comp = { east: companyTimeline(P, 'east', I + 1.0), west: companyTimeline(P, 'west', I + 1.3) };
  const e = P.comp.east, w = P.comp.west;
  const lag = (2 * SPACING) / (INSPECT * 60);
  const t = Math.max(e.tEnd, w.tEnd + lag) + 0.2;
  const officerAt = e.pts[e.pts.length - 1];
  P.meet = { t, officerAt, tGiveE: t + 0.28, tGiveW: t + 0.62, tDisperse: t + 0.82 };
  const d = P.ctx.elOpt('azarah.chamber.chavitin')?.params?.door;
  P.chavitinDoor = d ? [d.x, (d.y[0] + d.y[1]) / 2, d.z?.[0] ?? 13.5] : [248, 319.5, 13.5];
  P.cues.push({ key: `insp-key:${Math.round(I * 10)}`, t: I + CUE_LEAD, id: 'keys', at: [M.slab[0], M.slab[1], M.Z + 1], caption: T.torches ? CAP.key : CAP.keyShabbat, range: 40, owner: 'insp' });
  P.cues.push({ key: `insp-wicket:${Math.round(I * 10)}`, t: R.tUnlock - 0.12, id: 'keys', at: [M.pish[0], M.pish[1], M.Z + 1.5], owner: 'insp' });
  P.cues.push({ key: `insp-split:${Math.round(I * 10)}`, t: I + 1.5, caption: CAP.split, at: [M.gateOut[0], M.gateOut[1], 16], range: 60, owner: 'insp' });
  P.cues.push({ key: `insp-shalom:${Math.round(t * 10)}`, t, id: 'shalom-call', at: [officerAt[0], officerAt[1] - 1.5, 19], opts: { variant: 'all-well', caption: false }, caption: CAP.allWell, range: 70, owner: 'insp' });
  P.cues.push({ key: `insp-bakers:${Math.round(t * 10)}`, t: P.meet.tGiveW + 0.45, caption: CAP.bakers, at: P.chavitinDoor, range: 60, owner: 'insp' });
}

function inspection(tr, P, T, M, key) {
  const R = P.insp, Z = M.Z;
  tr.set({ owner: 'insp', role: 'k' });
  const torch = R.torch && (R.torch.east === key || R.torch.west === key) ? 'torch' : null;
  const pose = torch ? 'torch' : 'stand', wpose = torch ? 'torch_walk' : 'walk';
  const side = R.east.includes(key) ? 'east' : 'west';
  const rank = (side === 'east' ? R.east : R.west).indexOf(key);
  const C = P.comp[side];
  // the moment his place in the file reaches the start of the route; he comes through the wicket just before it
  const tJoin = C.t0 + (rank * SPACING) / (C.speed * 60);
  const c = P.circle[key].at;
  const way = c[1] > M.hearth[1] + 1 ? [[M.cx + 3.9, M.hearth[1] + 1.9, Z], [M.cx + 4.3, M.hearth[1] - 2.0, Z], [M.gateIn[0] + 0.2, M.ky - 0.7, Z]]
    : c[0] > M.cx + 2 ? [[M.cx + 4.3, M.hearth[1] - 2.0, Z], [M.gateIn[0] + 0.2, M.ky - 0.7, Z]]
      : [[M.gateIn[0] - 0.3, M.ky - 0.7, Z]];
  const route = [...way, M.gateIn, [M.pish[0], M.pish[1], Z], M.gateOut];
  tr.until(tJoin - 0.01 - tr.walkMin(route, SLOW), { pose, prop: torch, h: P.circle[key].h });
  tr.walk(route, { until: tJoin - 0.01, pose: wpose, prop: torch });
  tr.hold(0.01, { pose, prop: torch });
  tr.follow(C, rank * SPACING, { pose: wpose, idle: pose, prop: torch });
  // the meeting: "Shalom — all is well" (Tamid 1:3), the torches to the officer, then to terumat-hadeshen's spots
  const meet = P.meet;
  tr.until(meet.t, { pose, prop: torch, h: side === 'east' ? 180 : 0 });
  if (torch) {
    if (side === 'west') tr.walk([[meet.officerAt[0], meet.officerAt[1] - 1.5, Z]], { until: meet.tGiveW - 0.05, pose: wpose, prop: torch });
    tr.until(side === 'east' ? meet.tGiveE : meet.tGiveW, { face: meet.officerAt, pose: 'torch', prop: torch });
    tr.hold(0.08, { face: meet.officerAt, pose: 'stand' });
  }
  tr.until(meet.tDisperse + 0.07 * VOLUNTEERS.indexOf(key), { pose: 'stand', face: meet.officerAt });
  tr.walk([R.g2[key]], { speed: SLOW });
  tr.until(R.hand, { h: 270, pose: 'stand' });
}

/** the officer: the key from under the slab, the wicket, leading the east company, the torches, into the chamber */
function officerInspection(tr, P, T, M) {
  const R = P.insp, Z = M.Z;
  tr.set({ owner: 'insp', role: 'k' });
  // he takes the key — the slab lifted by its ring (Middot 1:9; Tamid 1:3): the wicket's key alone off the chain
  // (world: setKeys(7) — the wicket key is the last of the eight) ⚙
  tr.hold(0.1, { h: 0, pose: 'kneel', phase: downHoldUp(0.06, 0, true) });
  const k0 = tr.now();
  tr.hold(0.12, { h: 0, pose: 'hold_legs' });
  const kw = [tr.now() + 0.01, NaN, 7];
  P.keysWin.push(kw);
  tr.hold(0.08, { h: 0, pose: 'hold_legs', prop: 'keys' });
  slabLift(P, k0 + 0.01, tr.now() + 0.06);
  tr.hold(0.08, { h: 0, pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), prop: 'keys' });
  // the wicket in the Moked gate's east leaf (it swings into the hall): before it, its face LOCK_REACH ahead, the key
  // turned (people's 'lock'); a step back while it swings open
  const ml = mokedLeaf(P.ctx), pk = P.ctx.elOpt('azarah.gate.moked')?.params?.pishpash?.box;
  const unlockAt = [(pk ? pk.max[0] - 0.25 : M.pish[0] + 0.75) + 0.25, ml.y + LOCK_REACH, Z];
  tr.walk([[M.gateIn[0] - 0.4, M.ky - 2, Z], M.gateIn, unlockAt], { speed: SLOW, prop: 'keys' });
  tr.until(R.tUnlock - 0.16, { h: 180, pose: 'stand', prop: 'keys' });
  tr.hold(0.12, { h: 180, pose: 'lock', phase: ramp(0, 1), prop: 'keys' });
  tr.walk([M.gateIn], { until: R.pishOpen[0] - 0.01, prop: 'keys' });
  tr.hold(0.06, { h: 180, pose: 'stand', prop: 'keys' });
  tr.walk([[M.pish[0], M.pish[1], Z], M.gateOut], { until: P.comp.east.t0 - 0.01 });
  tr.hold(0.01);
  tr.follow(P.comp.east, 0, { pose: 'walk', idle: 'stand' });
  const meet = P.meet;
  tr.until(meet.t, { h: 180, pose: 'stand' });
  if (R.torch) {
    tr.until(meet.tGiveE, { h: 0, pose: 'stand' });
    tr.until(meet.tGiveW - 0.08, { h: 0, pose: 'torch', prop: 'torch' });
    tr.hold(0.08, { h: 180, pose: 'torch', prop: 'torch' });
    tr.hold(0.14, { h: 180, pose: 'torch', props: ['torch', 'torch'] });
  } else tr.hold(0.5, { h: 180, pose: 'stand' });
  // down the duchan's steps to the chavitin chamber's door and in (Tamid 1:3; Middot 1:4 — beside Nikanor) ⚙; he stands
  // just inside, the torches lighting the makers' work (chambers-daily stages the bakers round him), then lays them by
  // the griddle — the makers' fire is lit from them ⚙ — and, the makers at work, walks out of the chamber and back
  // through the court to Beit HaMoked by its wicket (never over the Mount in the holy garments; the court's gates are
  // still shut), where he waits inside the wicket until he goes to the Gazit for the second lottery (lotteries.js takes
  // him there at second-lottery − 4.75) ⚙
  const door = P.chavitinDoor;
  const props = R.torch ? ['torch', 'torch'] : null;
  const inside = [door[0] + 1.6, door[1], door[2]];
  tr.walk([[meet.officerAt[0] + 2.2, door[1] + 0.5, Z], [door[0] - 3.4, door[1], door[2]], [door[0] - 0.7, door[1], door[2]], inside],
    { speed: SLOW, props });
  tr.until(meet.tGiveW + 2.4, { h: 90, pose: R.torch ? 'torch' : 'stand', props });
  if (R.torch) {
    const lay = [door[0] + 3.4, door[1] - 0.9, door[2]];
    tr.walk([lay], { speed: SLOW, pose: 'torch_walk', props });
    tr.hold(0.14, { h: 120, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d), props });
    tr.hold(0.1, { h: 120, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d) });
    tr.walk([inside], { speed: SLOW });
  }
  const tGo = (T.lot2 ? T.lot2[0] : T.insp[1] + 40) - 4.75;
  // out of the chamber, up over the duchan into the court and along its east and north to the wicket ⚙
  const back = [[door[0] - 0.7, door[1], door[2]], [door[0] - 3.6, door[1] + 0.6, Z], [236.4, 336, Z], [236.5, 372.5, Z], [M.gateOut[0] + 0.4, 383.5, Z], M.gateOut];
  const tOut = Math.max(tr.now() + 0.6, Math.min(meet.tGiveW + 3.6, tGo - tr.walkMin(back, SLOW) - 2.5));
  dawdle(tr, tOut, 90, 'officer', 'k');
  tr.walk(back, { speed: SLOW });
  const tPish = tr.now();
  tr.walk([[M.pish[0], M.pish[1], Z], M.gateIn], { speed: SLOW });
  R.pishBack = [tPish - 0.12, tr.now() + 0.05];
  R.pishWins = [R.pishOpen, R.pishBack];
  // the wicket's key hung back on the chain under the slab ⚙ (the Mishnah says only that he took it)
  const kneelAt = [M.slab[0], M.slab[1] - 0.65, Z];
  tr.walk([[M.gateIn[0] - 0.4, M.ky - 2, Z], kneelAt], { speed: SLOW });
  tr.hold(0.1, { h: 0, pose: 'kneel', phase: downHoldUp(0.06, 0, true) });
  const r0 = tr.now();
  tr.hold(0.14, { h: 0, pose: 'hold_legs' });
  kw[1] = tr.now();
  tr.hold(0.1, { h: 0, pose: 'hold_legs' });
  slabLift(P, r0 + 0.01, tr.now());
  tr.hold(0.1, { h: 0, pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d) });
  // inside the wicket, a little aside, until he leaves for the Gazit; then back at the wicket facing it
  const wait = [M.gateIn[0] - 1.3, M.gateIn[1] + 1.6, Z];
  tr.walk([wait], { speed: SLOW });
  dawdle(tr, tGo - 0.35, 30, 'officer-moked', 'k');
  tr.walk([M.gateIn], { speed: SLOW });
  tr.until(tGo, { h: 180, turn: 0.1, pose: 'stand' });
  P.officerOut = { at: M.gateIn, t: tGo };
}

// --------------------------------------------------------------------------------------------------- the evening
/**
 * A young kohen's evening: in from the court (or from the altar) to his mat or seat, the holy garments taken off and
 * folded by his head (Tamid 1:1; Rambam BhB 8:6); y4 also goes down at his keri (mesibah-keri). plan: the mat / seat ids
 * he uses in turn (Friday: y3 sits up by the hearth until the impure kohen's mat is free).
 */
function eveningYoung(P, T, M, G, key, plan, hand) {
  const Z = M.Z, H = P.hall, sp = P.place(plan[0]);
  let tr;
  const into = P.ways.intoX[plan[0]];
  if (hand) {
    tr = new Track(hand.t, hand.at, 0, 'moked', 'k');
    tr.walk([into[0]], { speed: WALK, role: 'k' });
    // the impure kohen's mat: only once he has gone down (his keri)
    if (plan[0] === 'A' && P.keriLeftA != null) tr.until(Math.max(tr.now(), P.keriLeftA + 0.35), { pose: 'stand', h: 0, role: 'k' });
    tr.walk(into.slice(1), { speed: WALK, role: 'k' });
  } else {
    // with the others from Lishkat HaGazit's door along the north side, in through the Moked gate before it shuts ⚙
    const t0 = T.lock[0] - 1.2 + ({ y0: 0.4, y1: 0.8, y2: 1.2, y3: 1.6, y4: 2.0 }[key] || 0);
    tr = new Track(t0, G.eastIn, 90, 'moked', 'k');
    tr.walk([...northLane(G, M), [M.cx - 0.4, M.pish[1] + 3.0, Z], ...into], { speed: WALK, role: 'k' });
  }
  tr.hold(0.04, { h: sp.h, role: 'k' });
  // he takes off the holy garments, folds them and lays them by his head (Tamid 1:1; Rambam BhB 8:6)
  tr.hold(0.32, { h: sp.h, pose: 'kneel', phase: downHoldUp(0.06, 0, true), role: 'k' });
  tr.hold(0.05, { h: sp.h, pose: 'kneel', phase: 0.5, role: 'off' });
  tr.set({ role: 'off' });
  if (key === 'y4' && T.keri) keri(tr, P, M, T, sp);
  else if (sp.pose === 'sit_floor' && plan[1]) {
    // sitting up by the hearth (Friday night) until a mat is free, then to it
    sitUp(tr, Math.max(tr.now() + 0.2, (P.keriLeftA ?? DAY - 3) + 0.35), sp, key);
    tr.hold(0.1, { pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d) });
    const m = P.place(plan[1]);
    tr.walk([[H.XE, sp.at[1] - 0.6, Z], [H.XE, H.KOD, Z], ...P.ways.intoX[plan[1]]], { speed: SLOW });
    tr.hold(0.04, { h: m.h });
    tr.hold(0.2, { h: m.h, pose: 'kneel', phase: downHoldUp(0.06, 0, true) });
    tr.until(DAY, { pose: m.pose, h: m.h, at: m.at });
  } else if (sp.pose === 'sit_floor') sitUp(tr, DAY, sp, key);
  else tr.until(DAY, { pose: sp.pose, h: sp.h, at: sp.at });
  return tr.episode();
}

/**
 * mesibah-keri (Tamid 1:1; Middot 1:9; Rambam BhB 8:7): he rises from his mat and goes out by the winding stair, so as to
 * be in the passage under the Birah as the event begins, and walks it slowly, the lamps burning on either side; in the
 * Beit HaTevilah, past the privy of honour (Tamid 1:1 tells of its honour; his use of it is not staged), down into the
 * mikveh to immerse; he comes up and stands drying and warming himself before the fire on its west side (seen down the
 * passage through its arch) ⚙; he comes back along the passage as the event ends, up the stair, and sits beside his
 * brothers (K1) until the gates open. The fire takes up the slack of the event's window.
 */
function keri(tr, P, M, T, sp) {
  const K = M.mikveh, zF = M.zF;
  const w0 = T.keri[0] < T.lock[0] ? T.keri[0] + DAY : T.keri[0];
  const w1 = Math.min(w0 + span(T.keri[0], T.keri[1]), DAY - 3);   // kept inside the evening (late summer midnights)
  const dry = new Track(0, sp.at, sp.h, 'moked', 'off');
  keriDown(dry, P, M, { stairLog: [], cues: [] });
  const k0 = Math.max(tr.now() + 0.2, Math.min(w0 - dry.now(), w1 - 9));
  tr.until(k0, { pose: sp.pose, h: sp.h, at: sp.at });
  const t0 = tr.now();
  keriDown(tr, P, M, P);
  tr.walk(M.passage.slice(1), { speed: 0.5 });                             // slowly, by the lamps
  // his own clothes off by the mikveh, the linen sheet about him ⚙ (the change unseen); down into it and immerse
  const clothes = [K.edge[0] + 1.4, K.my - 0.6, zF];
  tr.walk([[M.passageEnd[0] + 1.2, M.passageEnd[1] + 2.0, zF], clothes], { speed: SLOW });
  tr.hold(0.1, { face: K.edge, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d) });
  tr.hold(0.08, { face: K.edge, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), role: 'bath' });
  tr.set({ role: 'bath' });
  tr.walk([K.edge, K.top, K.step, K.deep], { speed: SLOW });
  tr.hold(0.16, { h: 270, pose: 'bathe', phase: ramp(0, 1) });
  tr.walk([K.step, K.top, K.edge], { speed: MIKVEH });
  // dried and warmed before the fire (Tamid 1:1): his hands to it (people's 'warm'); then he dresses by the mikveh
  const toFire = [[K.edge[0] + 2.3, K.my + 3.0, zF], M.keriFire];
  tr.walk(toFire, { speed: SLOW });
  const toClothes = [toFire[0], clothes];
  const back = [[M.passageEnd[0] + 1.2, M.passageEnd[1] + 2.0, zF], [M.passageEnd[0], M.passageEnd[1] + 1.2, zF], M.passageEnd, [M.passage[0][0], M.passage[0][1], zF]];
  const ret = tr.walkMin(toClothes, SLOW) + 0.3 + (new Track(0, clothes, 0)).walkMin(back, 0.5);
  tr.until(Math.max(tr.now() + 0.5, w1 - ret), { face: M.medurah, pose: 'warm' });
  tr.walk(toClothes, { speed: SLOW });
  tr.hold(0.14, { face: K.edge, pose: 'kneel', phase: downHoldUp(0.05, 0, true) });
  tr.hold(0.16, { face: K.edge, pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), role: 'off' });
  tr.set({ role: 'off' });
  keriBack(tr, P, M, P, back);
  P.keriSpan = [t0, tr.now()];
  P.cues.push({ key: `keri:${Math.round(T.keri[0] * 10)}`, t: Math.max(T.keri[0] + CUE_LEAD, t0 + 0.3), caption: CAP.keri, at: M.passage[0], range: 60, owner: 'moked' });
  // "he came and sat beside his brothers the kohanim until the gates open" — on his knees, back on his heels ⚙
  const seat = P.floor.seats.K1;
  tr.hold(0.12, { h: seat.h, pose: 'kneel', phase: downHoldUp(0.05, 0, true) });
  sitUp(tr, DAY, seat, 'y4');
}

/** up from mat A and down the winding stair to the passage's start (log: P, or a dry run's own) */
function keriDown(tr, P, M, log) {
  tr.hold(0.12, { pose: 'kneel', phase: downHoldUp(0.04, 0.05) });
  tr.walk(P.ways.toStair.A, { speed: SLOW });
  if (log === P) P.keriLeftA = tr.now();
  const s0 = tr.now();
  tr.walk(M.stairDown.slice(1), { speed: STAIR });
  log.stairLog.push({ key: 'y4', dir: 'down', t0: s0, t1: tr.now() });
  log.cues.push({ key: `keri-steps:${Math.round(tr.now() * 10)}`, t: tr.now() + 0.05, id: 'footsteps', at: M.passage[0], opts: { steps: 24, pace: 0.6 }, owner: 'moked' });
}

/** from the fire back along the passage, up the stair and round by the kodesh half to his seat (K1) */
function keriBack(tr, P, M, log, back) {
  const H = P.hall;
  tr.walk(back, { speed: 0.5 });
  const u0 = tr.now();
  tr.walk([...M.stairDown].reverse().slice(1), { speed: STAIR });
  log.stairLog.push({ key: 'y4', dir: 'up', t0: u0, t1: tr.now() });
  tr.walk([[H.XW, M.ky + 2.6, M.Z], [H.XW, H.KOD, M.Z], ...P.ways.intoX.K1], { speed: SLOW });
}

/** the walk along the court's north side from the Gazit's east door to before the Moked gate ⚙ (open pavement) */
function northLane(G, M) {
  return [G.eastOut, [99.2, 377, 16], [156, 383.6, 16], [181, 384.5, 16], [M.cx - 0.4, M.pish[1] - 4, 16]];
}

/** the impure kohen in the small hours: sitting by his brothers until the gates open, then out (Tamid 1:1) */
function tevulYomSmall(P, M, T) {
  const Z = M.Z, seat = P.floor.seats.K1;
  const tr = new Track(0, seat.at, seat.h, 'moked', 'off');
  const tGo = T.kiponusOpen + 0.3;
  sitUp(tr, tGo, seat, 'y4s');
  tr.hold(0.1, { pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d) });
  P.doors.chel.push([tr.now() + 0.12, tr.now() + 0.8]);
  // across the emptied floor east of the hearth to the chel door (the others have gone to the altar)
  tr.walk([[M.cx + 4.4, M.ky + 3.8, Z], [M.cx + 2.6, M.ky + 7.3, Z], [M.cx + 0.3, M.door.min[1] - 0.9, Z], ...mokedExit(M)], { speed: WALK });
  return tr.episode();
}

/** from the chel door down the flight onto the Mount and west to the Kiponus gate (Middot 1:3: entry and exit) ⚙ */
function mokedExit(M) {
  const f = M.flight;
  const fx = (f.min[0] + f.max[0]) / 2;
  return [[fx, M.door.max[1] + 0.3, M.Z], [fx, f.max[1] + 1.2, 0], [fx - 7, f.max[1] + 1.5, 0], [187.5, 426.5, 0], [186.6, 418.6, 0],
    [120, 418.5, 0], [60, 420, 0], [26, 410, 0], [14, 300, 0], [8, 255, 0], [1.5, 250, 0]];
}

// --------------------------------------------------------------------------------------------------- the locking
/**
 * The locking (Middot 1:9): the kohen lifts the marble slab by its ring, takes the keys from the chain, locks from
 * within — here the Korban gate, then the Moked's own gate from inside the hall (gates.js swings the leaves; the other
 * gates are shut by their keepers ⚙) — hangs the keys back, sets the slab in its place, spreads his garment on it and
 * sleeps on it. He is in his own clothes: locking is no service ⚙.
 */
function lockingKohen(P, T, M, G, slabLie) {
  const Z = M.Z, L0 = T.lock[0];
  const kneelAt = [M.slab[0], M.slab[1] - 0.65, Z];
  const tr = new Track(L0 - 2.4, G.eastIn, 90, 'moked', 'off');
  tr.walk([...northLane(G, M), [M.cx + 0.4, M.pish[1] + 3, Z], [M.cx + 0.2, M.ky - 2.5, Z], kneelAt], { until: L0 + 0.25 });
  // down on his knees; both hands to the slab's ring, the slab raised (world: azarah.moked.keys-slab lift(f)); the keys
  // taken from the chain beneath it (setKeys(false)). The slab stays open while he goes to lock: "he finished locking,
  // returned the keys to the chain and the tablet to its place" (Middot 1:9) — laid back fully open (world's lift 1,
  // 80°) so it stands by itself; one window from here to after the keys are back (below)
  tr.hold(0.12, { h: 0, pose: 'kneel', phase: downHoldUp(0.06, 0, true) });
  const t0 = tr.now();
  tr.hold(0.24, { h: 0, pose: 'hold_legs' });
  P.keysWin.push([tr.now() + 0.01, NaN, false]);
  const kw = P.keysWin[P.keysWin.length - 1];
  tr.hold(0.16, { h: 0, pose: 'hold_legs', prop: 'keys' });
  tr.hold(0.08, { h: 0, pose: 'hold_legs', prop: 'keys' });
  tr.hold(0.06, { h: 0, pose: 'kneel', phase: 0.5, prop: 'keys' });
  tr.hold(0.12, { h: 0, pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), prop: 'keys' });
  P.cues.push({ key: `lock-keys:${Math.round(L0 * 10)}`, t: L0 + 0.6, id: 'keys', at: [M.slab[0], M.slab[1], Z + 1], caption: CAP.lockKeys, range: 45, owner: 'moked' });
  // to the Korban gate, inside the court; once gates.js has swung its leaves shut (closeKorban … + 0.45) he steps into
  // the gateway, the leaves' inner face LOCK_REACH before him, and turns the key at their meeting from within (Middot 1:9;
  // people's 'lock') ⚙
  const kg = [161.5, 396.2, 16];
  const kl = korbanLeaf(P.ctx);
  const lockK = [kl.x - 0.25, kl.y - LOCK_REACH, 16];
  tr.walk([[M.cx + 1.4, M.ky - 6, Z], [M.cx + 1.4, M.pish[1] - 1.5, Z], [196, 385.5, 16], [168, 393.2, 16], kg], { speed: SLOW, prop: 'keys' });
  tr.until(T.closeKorban + 0.47, { h: 15, pose: 'stand', prop: 'keys' });
  tr.walk([[kg[0] - 0.25, 398.4, 16], lockK], { speed: SLOW, prop: 'keys' });
  tr.hold(0.02, { h: 0, pose: 'stand', prop: 'keys' });
  const tLockK = tr.now() + 0.035;
  tr.hold(0.1, { h: 0, pose: 'lock', phase: ramp(0, 1), prop: 'keys' });
  P.cues.push({ key: `lock-korban:${Math.round(tLockK * 10)}`, t: tLockK, id: 'keys', at: [kl.x, kl.y, 17], owner: 'moked' });
  // back inside the Moked gate before it shuts; then, its leaves shut, into its gateway: the lock from within
  tr.walk([[kg[0] - 0.25, 398.4, 16], [168, 393.2, 16], [196, 385.5, 16], [M.cx - 0.6, M.pish[1] - 1.5, Z], [M.cx - 0.6, M.pish[1] + 2.6, Z], [M.cx + 0.55, M.pish[1] + 2.0, Z]], { speed: WALK, prop: 'keys' });
  const ml = mokedLeaf(P.ctx);
  const lockM = [ml.x + 0.25, ml.y + LOCK_REACH, Z];
  tr.until(T.closeMoked + 0.47, { h: 200, pose: 'stand', prop: 'keys' });
  tr.walk([lockM], { speed: SLOW, prop: 'keys' });
  tr.hold(0.02, { h: 180, pose: 'stand', prop: 'keys' });
  const tLockM = tr.now() + 0.035;
  tr.hold(0.1, { h: 180, pose: 'lock', phase: ramp(0, 1), prop: 'keys' });
  P.cues.push({ key: `lock-moked:${Math.round(tLockM * 10)}`, t: tLockM, id: 'keys', at: [ml.x, ml.y, 17], owner: 'moked' });
  // the keys back on the chain, the slab in its place
  tr.walk([[M.cx + 0.55, M.pish[1] + 2.0, Z], [M.cx - 0.3, M.ky - 2.5, Z], kneelAt], { speed: SLOW, prop: 'keys' });
  tr.hold(0.12, { h: 0, pose: 'kneel', phase: downHoldUp(0.06, 0, true), prop: 'keys' });
  tr.hold(0.18, { h: 0, pose: 'hold_legs', prop: 'keys' });
  const tBack = tr.now();
  kw[1] = tBack;
  tr.hold(0.24, { h: 0, pose: 'hold_legs' });
  slabLift(P, t0 + 0.03, tBack + 0.1, 1);
  tr.hold(0.06, { h: 0, pose: 'kneel', phase: 0.5 });
  P.cues.push({ key: `lock-back:${Math.round(tBack * 10)}`, t: tBack + 0.05, id: 'keys', at: [M.slab[0], M.slab[1], Z + 1], caption: CAP.lockBack, range: 45, owner: 'moked' });
  tr.hold(0.12, { h: 0, pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d) });
  // his garment spread over the slab; he lies down with his head on it (Middot 1:9)
  tr.walk([[slabLie.at[0] - 0.4, slabLie.at[1] - 0.2, Z]], { speed: SLOW });
  tr.hold(0.2, { h: slabLie.h, pose: 'kneel', phase: downHoldUp(0.07, 0, true) });
  tr.until(DAY, { at: slabLie.at, h: slabLie.h, pose: 'lie' });
  P.lock = { tLockK, tLockM, tBack };
  return tr.episode();
}

/**
 * The keys slab raised by its ring (world: 'azarah.moked.keys-slab' lift(f), 0 in place … 1 = 80°): up from t0 over
 * 0.1 min to SLAB_UP (or `up`), held, down over the 0.08 min ending at t1 (Middot 1:9) ⚙ — the windows P.slab
 * ([t0, up at, down from, t1, level?]), applied by moked-night.
 */
const SLAB_UP = 0.75;
function slabLift(P, t0, t1, up = undefined) { P.slab.push([t0, t0 + 0.1, t1 - 0.08, t1, up]); }

/** the Korban gate's leaves when shut (courts' door: hinged at its outer face, swinging into the court): where they
 *  meet, and the inner (court) face — site.js azarah.gate.korban; the leaves 0.25 amah inside its outer face ⚙ */
function korbanLeaf(ctx) {
  const b = ctx.elOpt('azarah.gate.korban')?.box || { min: [156.5, 398, 16], max: [166.5, 403, 36] };
  return { x: (b.min[0] + b.max[0]) / 2, y: b.max[1] - 0.51 };
}
/** the Moked gate's leaves when shut (hinged 0.25 inside its court face, swinging into the hall): their meeting, and
 *  the hall face (courts/moked.js gates) */
function mokedLeaf(ctx) {
  const b = ctx.elOpt('azarah.gate.moked')?.box || { min: [205.75, 390, 16], max: [215.75, 392, 36] };
  return { x: (b.min[0] + b.max[0]) / 2, y: b.min[1] + 0.51 };
}

// --------------------------------------------------------------------------------------------------- the elders
function elderEps(P, T, M, G, e, i) {
  const Z = M.Z, west = e.side < 0, H = P.hall;
  // up onto his tread one ledge after another (½ each) at the ledges' kodesh end — standing and walking there is no
  // sitting — then along his tread into the chol half; he kneels and lies down (feet at the kodesh line, head north) ⚙
  const yUp = M.ky - 0.8;
  const front = [west ? M.i.min[0] + 3.6 : M.i.max[0] - 3.6, yUp, Z];
  const climb = [];
  for (let k = 0; k <= e.k; k++) { const t = M.tread(e.side, k); climb.push([t.X - 0.18 * e.side, yUp, t.Z]); }
  const lieAt = e.at;
  const kneelAt = [lieAt[0], lieAt[1] + 1.15, lieAt[2]];
  climb.push(kneelAt);
  const eps = [];
  // ---- small hours: asleep; two of the west side open the chel door at the knock; all go out when the gates open
  {
    // (role 'elder' = kohen_elder: lying, people draws him in his own clothes on his folded garments on the ledge,
    // covered by his own mantle; 'eoff' = kohen_elder_offduty, the same man awake in his own clothes - Tamid 1:1)
    const tr = new Track(0, lieAt, 180, 'moked', 'elder');
    if (i === 0 || i === 2) {
      const k = i === 0 ? 0 : 1;
      tr.until(T.knock[0] + 0.5 + 0.06 * k, { pose: 'lie' });
      tr.hold(0.08, { at: kneelAt, pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), role: 'eoff' });
      const leaf = [M.cx + (k ? 1.7 : -2.7), M.door.min[1] - 1.15, Z];
      tr.walk([...[...climb].reverse().slice(1), front, H.KW, H.WW, H.W2, H.NW2, H.HNW, leaf], { speed: ELDER * 1.4, role: 'eoff' });
      tr.until(T.knock[0] + 1.6, { h: 0, pose: 'stand', role: 'eoff' });
      tr.walk([H.HNW, H.NW2, H.W2, H.WW, H.KW, front, ...climb], { speed: ELDER, role: 'eoff' });
      tr.hold(0.08, { at: kneelAt, h: 180, pose: 'kneel', phase: downHoldUp(0.03, 0, true), role: 'eoff' });
    }
    const tOut = T.mokedGateOpen + 0.3 + 0.25 * i;
    tr.until(tOut, { at: lieAt, h: 180, pose: 'lie' });
    tr.hold(0.12, { at: kneelAt, pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), role: 'eoff', prop: 'folded_garments' });
    // out through the Moked gate with their folded garments and along the north side to Lishkat HaGazit (⚙ where they go)
    tr.walk([...[...climb].reverse().slice(1), front, west ? H.KW : H.KE, [M.cx - 0.6 + 0.4 * e.side, M.pish[1] + 2.5, Z], [M.cx - 0.6 + 0.4 * e.side, M.pish[1] - 4, 16],
      ...[...northLane(G, M)].reverse().slice(1), G.eastIn], { speed: ELDER, role: 'eoff', prop: 'folded_garments' });
    eps.push(tr.episode());
  }
  // ---- evening: from the Gazit's door along the north side, in through the Moked gate while it is open, onto the ledge
  {
    const t0 = T.lock[0] - 3.3 + 0.45 * i;
    // in the four garments from the day's service; on his knees he takes them off and folds them, and lies down on them
    // in his own clothes (Tamid 1:1) - the change at the kneel unseen ⚙
    const tr = new Track(t0, G.eastIn, 90, 'moked', 'elder');
    tr.walk([...northLane(G, M), [M.cx - 0.3, M.pish[1] + 3.2, Z], west ? H.KW : H.KE, front, ...climb], { speed: ELDER });
    tr.hold(0.06, { h: 180 });
    tr.hold(0.25, { at: kneelAt, h: 180, pose: 'kneel', phase: downHoldUp(0.08, 0, true) });
    tr.hold(0.04, { at: kneelAt, h: 180, pose: 'kneel', phase: 0.5, role: 'eoff' });
    tr.until(DAY, { at: lieAt, h: 180, pose: 'lie' });
    eps.push(tr.episode());
  }
  return eps;
}

// --------------------------------------------------------------------------------------------------- the Levite outside
/** "and a Levite sleeps outside" (Middot 1:9): at the foot of the Moked's flight on the Mount; up when the officer comes */
function leviteEps(P, T, M) {
  const f = M.flight;
  const bed = [f.max[0] + 1.6, f.max[1] - 3.2, 0];
  const eps = [];
  {
    const tr = new Track(0, bed, 270, 'moked', 'guard');
    tr.until(T.knock[0] - 0.45, { pose: 'sleep' });
    tr.hold(0.12, { pose: 'kneel', phase: (l, d) => 0.5 + 0.5 * clamp(l / d) });
    const post = [f.max[0] + 1.8, f.max[1] + 1.2, 0];
    tr.walk([post], { speed: SLOW });
    tr.until(T.kiponusOpen + 0.1, { h: 0, pose: 'stand' });
    tr.walk(mokedExit(M).slice(2), { speed: WALK });
    eps.push(tr.episode());
  }
  {
    // he comes from Lishkat HaKorban's door on the Mount as the locking begins ⚙
    const tr = new Track(T.lock[0] + 0.6, [175.6, 421.6, 0], 180, 'moked', 'guard');
    tr.walk([[176.2, 418.6, 0], [186.6, 418.8, 0], [187.6, 426.6, 0], [203.4, 431.4, 0], [f.max[0] + 1.6, f.max[1] + 0.8, 0], [bed[0], bed[1] + 0.6, 0]], { speed: SLOW });
    tr.hold(0.2, { h: 270, pose: 'kneel', phase: downHoldUp(0.06, 0, true) });
    tr.until(DAY, { at: bed, h: 270, pose: 'sleep' });
    eps.push(tr.episode());
  }
  return eps;
}

// --------------------------------------------------------------------------------------------------- the officer
/**
 * The officer (memuneh — Matya ben Shmuel was over the lots, Shekalim 5:1): from Lishkat HaKorban's door on the Mount ⚙
 * to the Moked's flight, up it; he knocks, the elders open, he steps in: "Whoever has immersed — come and cast lots!"
 * (Tamid 1:2). Then the lottery and the inspection; at its end he goes into the chavitin chamber.
 */
function officerEps(P, T, M) {
  const f = M.flight, Z = M.Z;
  const fx = (f.min[0] + f.max[0]) / 2;
  // on the flight's top tread, the leaves' outer face KNOCK_REACH before him (people's 'knock': three raps, a pause)
  const atDoor = [fx, M.door.max[1] + KNOCK_REACH, Z];
  const pts = [[176.2, 418.6, 0], [186.6, 418.8, 0], [187.6, 426.6, 0], [203.4, 431.4, 0], [fx, f.max[1] + 1.3, 0], [fx, f.max[1] - 0.2, 0.2], atDoor];
  const tKnock = T.knock[0] + CUE_LEAD;
  const tr = new Track(0, [175.6, 421.6, 0], 180, 'moked', 'k');
  tr.until(tKnock - 0.12 - tr.walkMin(pts, WALK), { owner: 'none' });
  tr.walk(pts, { speed: WALK });
  tr.until(tKnock - 0.04, { h: 180, pose: 'stand' });
  tr.hold(0.1, { h: 180, pose: 'knock', phase: cycles(3) });       // "the officer comes and knocks on them" (Tamid 1:2)
  tr.hold(0.12, { h: 180, pose: 'stand' });
  P.cues.push({ key: `knock:${Math.round(tKnock * 10)}`, t: tKnock, id: 'knock', at: [fx, M.door.max[1], Z + 3], caption: CAP.knock, range: 30, owner: 'moked' });
  tr.until(T.knock[0] + 1.02, { h: 180, pose: 'stand' });
  tr.walk([[fx, M.door.min[1] - 0.8, Z], P.officerSpot], { speed: SLOW });
  tr.hold(0.06, { face: M.hearth });
  const tSay = T.knock[0] + 1.3;
  P.cues.push({ key: `come:${Math.round(tSay * 10)}`, t: tSay, caption: CAP.come, at: M.hearth, range: 30, owner: 'moked' });
  tr.until(T.first[0], { pose: 'stand', face: M.hearth });
  officerLottery(tr, P, T, M);
  officerInspection(tr, P, T, M);
  return [tr.episode()];
}

// --------------------------------------------------------------------------------------------------- Gevini
/**
 * Gevini the crier (Yoma 20b; Shekalim 5:1): out of the instrument chamber under Ezrat Yisrael ⚙, up the fifteen steps
 * to their head, facing east over the Ezrat Nashim, the call; back down and in.
 */
function geviniEps(P, T, ctx) {
  const mc = ctx.elOpt('en.music-chambers')?.params?.rooms?.find((r) => r.side === 'N');
  const d = mc?.door || { min: [255, 350, 6], max: [260, 354, 12] };
  const s15 = ctx.elOpt('en.steps15')?.params || { center: [260, 330.5, 6], outerRadius: 17.5, landingRadius: 10.5 };
  const c = s15.center, Ro = s15.outerRadius, Rl = s15.landingRadius, zTop = 13.5;
  const dy = (d.min[1] + d.max[1]) / 2;
  const inside = [d.min[0] + 0.8, dy, 6], outside = [d.max[0] + 1.4, dy, 6];
  const a = Math.atan2(dy - 1.5 - c[1], 6.5);
  const foot = [c[0] + Math.cos(a) * (Ro + 0.6), c[1] + Math.sin(a) * (Ro + 0.6), 6];
  const head = [c[0] + Math.cos(a) * (Rl - 0.4), c[1] + Math.sin(a) * (Rl - 0.4), zTop];
  const stand = [c[0] + 5.4, c[1] + 3.1, zTop];
  const tCall = T.gev[0] + CUE_LEAD;
  const tr = new Track(0, inside, 90, 'moked', 'levi');
  const route = [outside, foot, head, stand];
  tr.until(tCall - 0.35 - tr.walkMin(route, 1.0), { owner: 'none' });
  tr.walk(route, { speed: 1.0 });
  tr.until(tCall - 0.04, { h: 90, pose: 'stand' });
  tr.hold(0.16, { h: 90, pose: 'call', phase: cycles(2) });    // the hands cupped round the mouth (people's 'call') ⚙
  P.cues.push({ key: `gevini:${Math.round(tCall * 10)}`, t: tCall, id: 'gevini', at: [stand[0], stand[1], zTop + 3.4], opts: { caption: false }, caption: CAP.gevini, range: 400, owner: 'moked' });
  tr.until(T.gev[1] + 0.25, { h: 90, pose: 'stand' });
  tr.walk([head, foot, outside, inside], { speed: 1.0 });
  P.gevini = { stand, tCall };
  return [tr.episode()];
}

// --------------------------------------------------------------------------------------------------- the altar crew
/**
 * The altar through the evening and the night (altar-night): who is on the altar when; where each hands over to the
 * Moked. Weekday: four kohanim until midnight bring up the last limbs and fats and tend the pile with forks (Tamid 2:1;
 * Rambam MK 4:2), wood now and then ⚙; after midnight one turns what lies on it now and then (Rambam TuM 1:6) until he
 * goes in to immerse before dawn. Friday: until sunset only (Rambam TuM 1:7 with the Kesef Mishneh). Shabbat: three put
 * Shabbat's limbs on before sunset and tend them after it (Rambam MK 4:3).
 */
function altarPlan(P, T, M, A, altarAtNight) {
  const out = { episodes: {}, eveningHand: {}, wicket: [], fire: null, stack: [], pile: [], spring: null, tosses: [], y0hand: 0 };
  const Z16 = 16;
  const GO = M.gateOut, GI = M.gateIn;
  // from the foot of the ramp's west half round the altar's east to the Moked (⚙ open pavement)
  const round = [[A.xW, A.yFoot - 1.4, Z16], [233.6, A.yFoot - 1.2, Z16], [237.2, 300, Z16], [237.2, 341, Z16], [236.5, 372.5, Z16]];
  const toWicket = [...round, [GO[0] + 0.4, 383.5, Z16], GO, [M.pish[0], M.pish[1], M.Z], GI];
  const toMokedGate = [...round, [M.cx + 1.4, 384, Z16], [M.cx + 1.4, M.pish[1] + 3, M.Z]];
  const st = A.stations;
  const R = (k0, k1, k2) => rand(0x6a17, k0, k1, k2);
  const forkDown = (tr, i = 0) => {
    tr.walk([A.downTop, A.downFoot], { speed: WALK, prop: 'fork' });
    tr.walk([[A.forkRest[0] + 0.6 * (i - 1.5) + 1.1, A.forkRest[1] + 0.2, Z16]], { speed: WALK, prop: 'fork' });
    tr.hold(0.12, { h: 270, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d), prop: 'fork' });   // the fork laid with the vessels ⚙
    tr.hold(0.08, { h: 270, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d) });
  };

  // ---------- the evening (weekday / Friday / Shabbat)
  if (T.eve) {
    const E0 = T.eve.t0, E1 = T.eve.t1;
    const friday = T.eve.friday, shabbat = T.eve.n === 3;
    const carryEnd = friday ? E1 - 4 : shabbat ? T.sunset - 3 : E1 - 30;
    const nLimbs = shabbat ? 3 : friday ? 4 : 6;           // what is left at dusk ⚙
    const limbNames = ['limb_foreleg', 'limb_dofen', 'limb_foreleg', 'limb_oketz', 'limb_chazeh', 'limb_gerah'];
    const carries = [];
    for (let j = 0; j < nLimbs; j++) { const tc = E0 + 2.5 + 11 * j; if (tc + 4 < carryEnd) carries.push({ t: tc, j }); }
    const woods = [];
    if (!shabbat) for (let k = 0; ; k++) { const tw = E0 + 33 + 64 * k; if (tw + 4 > (friday ? E1 - 2 : E1 - 15)) break; woods.push(tw); }
    // the limbs lying on the ramp at dusk; each shown until it is picked up
    // where each goes on the pile: the evening's last three stay on the fire through the night — they are the small
    // hours' leftover limbs (LEFT), the last of them terumat-hadeshen's at dawn; the earlier ones burn away ⚙
    carries.forEach((c, n) => {
      const L = LEFT[n - (carries.length - LEFT.length)];
      c.pile = L ? { idx: L.idx, name: L.name, h: L.h, persist: true } : { idx: [0, 1, 6][n] ?? 0, name: limbNames[n % limbNames.length], h: 70 * n + 15 };
      out.stack.push({ name: c.pile.name, at: A.limbStack[c.j % A.limbStack.length], h: 30 + 50 * (c.j % 3), from: E0 - 2, until: null });
    });
    out.carries = carries; out.woods = woods; out.E = [E0, E1];
    P.crew.forEach((key, i) => {
      const x = A.xE + (i % 2 ? 1.2 : -1.2);
      // out of Beit HaMoked by its gate (open by day), round the altar's east to the vessels by the ramp's west foot for
      // a fork, then up the ramp's east half (Zevachim 6:3: up on the right) to a station by the pile ⚙
      const tr = new Track(E0 - CREW_LEAD + 0.3 * i, [GI[0] - 0.6 + 0.4 * i, GI[1] + 0.4, M.Z], 180, 'altar', 'k');
      const rest = [A.forkRest[0] + 0.6 * (i - 1.5), A.forkRest[1] + 0.2, Z16];
      tr.walk([[GO[0] - 0.6 + 0.4 * i, GO[1], Z16], ...[...round].reverse().slice(0, -1), [A.xW + 1.2, A.yFoot - 1.6, Z16], [rest[0] + 1.1, rest[1], Z16]], { speed: WALK });
      tr.hold(0.12, { h: 270, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d) });
      tr.hold(0.1, { h: 270, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), prop: 'fork' });
      tr.walk([[x, A.yFoot - 1.8 - 0.5 * i, Z16], [x, A.yFoot + 0.6, A.rampZ(A.yFoot + 0.6)], [x, A.yHead + 0.8, A.Zt]], { speed: WALK, prop: 'fork' });
      let sIdx = [0, 2, 1, 3][i] ?? 0;
      tr.walk([st[sIdx].at], { speed: WALK, prop: 'fork' });
      const jobs = [];
      if (key === 'y2') for (const c of carries) jobs.push({ t: c.t, kind: 'limb', j: c.j, pile: c.pile });
      if (key === 'y3') for (const tw of woods) jobs.push({ t: tw, kind: 'wood' });
      if (key === 'y1' && !friday && !shabbat) jobs.push({ t: E0 + 0.62 * (E1 - E0), kind: 'spring' });
      jobs.sort((a, b) => a.t - b.t);
      const stays = key === 'y0' && T.late;
      const end = stays ? T.late[0] : E1;
      let b = 0;
      while (tr.now() < end - 0.6) {
        const jb = jobs.find((x) => !x.done && x.t >= tr.now() - 0.01);
        const blockEnd = Math.min(end - 0.6, jb ? jb.t : end, tr.now() + 3 + 4 * R(i, b, 'L'));
        // tending: the fork in the fire for a while, then a rest with it (Tamid 2:1 — the forks; TuM 1:6 — turning)
        const sNow = st[sIdx];
        const stoke = Math.min(blockEnd - tr.now(), 0.8 + 1.6 * R(i, b, 'S'));
        if (stoke > 0.01) tr.hold(stoke, { h: sNow.h, pose: 'stoke', prop: 'fork' });
        if (blockEnd - tr.now() > 0.02) tr.until(blockEnd, { h: sNow.h + 25 * (R(i, b, 'H') - 0.5), pose: 'stand', prop: 'fork' });
        b++;
        if (jb && Math.abs(tr.now() - jb.t) < 0.02) {
          jb.done = true;
          if (jb.kind === 'limb') limbTrip(tr, A, jb, out);
          else if (jb.kind === 'wood') woodTrip(tr, A, out);
          else springTrip(tr, A, out);
          sIdx = (sIdx + 2) % 4;
          tr.walk([st[sIdx].at], { speed: WALK, prop: 'fork' });
        } else if (R(i, b, 'M') < 0.4 && end - tr.now() > 2) {
          // round the pile, mostly on its south and east; now and then to its north side ⚙
          sIdx = R(i, b, 'N') < 0.15 ? 4 + (i % 2) : (sIdx + (R(i, b, 'D') < 0.5 ? 1 : 3)) % 4;
          tr.walk([st[sIdx].at], { speed: SLOW, prop: 'fork' });
        }
      }
      if (stays) {
        // after midnight (late-turning): he alone turns what lies on the fire now and then (visits below)
        tr.until(T.late[0], { pose: 'stand', prop: 'fork' });
        visits(tr, A, DAY);
        out.episodes[key] = [tr.episode()];
        return;
      }
      // down the west half, the fork laid by, and in to sleep in the Moked (Friday: by its gate, still open; else the
      // wicket) ⚙
      tr.until(E1 + 0.15 * i, { pose: 'stand', prop: 'fork' });
      forkDown(tr, i);
      tr.walk(friday ? toMokedGate : toWicket, { speed: WALK });
      if (!friday) out.wicket.push([tr.now() - 0.42, tr.now() + 0.1]);
      out.eveningHand[key] = { t: tr.now(), at: tr.cur };
      out.episodes[key] = [tr.episode()];
    });
  }

  // ---------- the small hours: one kohen turning the limbs now and then (night-turning), then in to immerse. He leaves
  // the altar so as to reach the Beit HaTevilah at his place in the immersions (P.immArrive.y0)
  if (altarAtNight) {
    const dry = new Track(0, A.waitAt, 0, 'altar', 'k');
    forkDown(dry, 0);
    dry.walk(toWicket, { speed: WALK });
    const toWicketMin = dry.now();
    const leave = P.immArrive.y0 - toWicketMin - P.descentFromWicket;
    const tr = new Track(0, A.waitAt, hTo(A.waitAt, [A.gx, A.gy]), 'altar', 'k');
    visits(tr, A, leave);
    out.turnerLeft = tr.now();
    forkDown(tr, 0);
    tr.walk(toWicket, { speed: WALK });
    out.wicket.push([tr.now() - 0.42, tr.now() + 0.1]);
    out.y0hand = tr.now();
    (out.episodes.y0 ||= []).push(tr.episode());
    P.rise.y0 = out.y0hand;
  }
  // ---------- Shabbat between the services (shabbat-altar-day)
  if (T.sday) out.day = shabbatDay(T, M, A, out, round, forkDown);
  out.tosses.sort((a, b) => a - b);
  out.fire = T.fats ? { window: T.fats, tosses: out.tosses, quiet: !altarAtNight } : null;
  return out;
}

/**
 * Shabbat between the services: the morning tamid's and the musaf's limbs burn on the great pile in their day, overriding
 * Shabbat and not put off to the night (Rambam MK 4:3); the fire is kept (Vayikra 6:6). Who tended it by day is not
 * recorded ⚙: now and then one or two of the beit av's young kohanim (the evening crew's faces) come out of Beit HaMoked
 * by its gate (open by day), take forks with the vessels by the ramp's west foot, go up the east half (Zevachim 6:3) and
 * stir the pile from its south and east — no wood carried, no new limbs: nothing comes up between the services on
 * Shabbat (Temurah 2:1) — then down the west half, the forks laid by, and back in. A visit every 8–20 minutes (seeded),
 * 3½–6½ minutes at the pile, the last ending before the afternoon crew takes the altar; the first once the division of
 * the showbread is over (its two groups stand east of the altar, across the way round it). Returns { window, visits,
 * tosses (the stirrings: the fire's flare) }.
 */
function shabbatDay(T, M, A, out, round, forkDown) {
  const R = (k0, k1, k2, k3) => rand(0x6a1c, k0, k1, k2, k3);
  const D0 = T.sday[0], D1 = D0 + span(T.sday[0], T.sday[1]);
  const Z16 = 16, st = A.stations, GI = M.gateIn;
  const fromMoked = [[M.cx + 1.4, M.pish[1] + 3, M.Z], [M.cx + 1.4, 384, Z16], ...[...round].reverse()];
  const toMoked = [...round, [M.cx + 1.4, 384, Z16], [M.cx + 1.4, M.pish[1] + 3, M.Z], [M.cx - 0.6, GI[1] + 1.6, M.Z]];
  const day = { window: [D0, D1], visits: [], tosses: [] };
  const keys = ['y1', 'y2', 'y3', 'y0'];
  const divEnd = T.divide ? D0 + ((T.divide[1] - D0 + 2160) % 1440) - 720 : -Infinity;
  let t = Math.max(D0 + 0.9, divEnd + 4);
  for (let v = 0; v < 60; v++) {
    const two = R(v, 'n') < 0.4;
    const who = two ? [keys[(2 * v) % 4], keys[(2 * v + 1) % 4]] : [keys[v % 4]];
    const stay = 3.5 + 3 * R(v, 's');
    const tracks = [], tosses = [];
    who.forEach((key, i) => {
      // out of the hall by the Moked gate, round the altar's east to the vessels by the ramp's west foot for a fork
      const tr = new Track(t + 0.3 * i, [M.cx + 0.6 - 1.2 * i, GI[1] + 1.6, M.Z], 180, 'altar', 'k');
      const rest = [A.forkRest[0] + 0.6 * (i - 1.5), A.forkRest[1] + 0.2, Z16];
      tr.walk([...fromMoked, [A.xW + 1.2, A.yFoot - 1.6, Z16], [rest[0] + 1.1, rest[1], Z16]], { speed: WALK });
      tr.hold(0.12, { h: 270, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d) });
      tr.hold(0.1, { h: 270, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), prop: 'fork' });
      const x = A.xE + (i % 2 ? 1.2 : -1.2);
      tr.walk([[x, A.yFoot - 1.8 - 0.5 * i, Z16], [x, A.yFoot + 0.6, A.rampZ(A.yFoot + 0.6)], [x, A.yHead + 0.8, A.Zt]], { speed: WALK, prop: 'fork' });
      // at the pile: its south side first (seen from the ramp's top), the second man at its east
      let sIdx = i ? 2 : 0;
      tr.walk([st[sIdx].at], { speed: WALK, prop: 'fork' });
      const leave = tr.now() + stay;
      for (let b = 0; tr.now() < leave - 0.45 && b < 12; b++) {
        const stoke = Math.min(leave - tr.now() - 0.2, 0.7 + 1.1 * R(v, i, b, 'k'));
        if (stoke > 0.05) { tosses.push(tr.now() + 0.15); tr.hold(stoke, { h: st[sIdx].h, pose: 'stoke', prop: 'fork' }); }
        const rest2 = Math.min(leave - tr.now() - 0.2, 0.4 + 0.9 * R(v, i, b, 'r'));
        if (rest2 > 0.05) tr.hold(rest2, { h: st[sIdx].h + 25 * (R(v, i, 'h') - 0.5), pose: 'stand', prop: 'fork' });
        if (R(v, i, b, 'm') < 0.35 && leave - tr.now() > 1.5) {
          // a step round the pile: the south and east sides ⚙
          sIdx = i ? (sIdx === 2 ? 3 : 2) : (sIdx === 0 ? 1 : 0);
          tr.walk([st[sIdx].at], { speed: SLOW, prop: 'fork' });
        }
      }
      tr.until(Math.max(tr.now(), leave), { h: st[sIdx].h, pose: 'stand', prop: 'fork' });
      forkDown(tr, i);
      tr.walk(toMoked, { speed: WALK });
      tracks.push({ key, tr });
    });
    const end = Math.max(...tracks.map((x) => x.tr.now()));
    if (end > D1 - 0.3) break;
    for (const { key, tr } of tracks) (out.episodes[key] ||= []).push(tr.episode());
    day.tosses.push(...tosses);
    day.visits.push({ t0: t, t1: end, who });
    t = end + 8 + 12 * R(v, 'gap');
  }
  day.tosses.sort((a, b) => a - b);
  return day;
}

/**
 * After midnight nothing new goes on the fire; what is on it is turned now and then until the morning (Rambam TuM 1:6;
 * MK 4:2). The one kohen waits on the altar top south of the pile, back from its heat, facing it with his fork, and at
 * every TURN_C minutes of the clock goes to the pile and turns the limbs (south side, now and then the east) ⚙. The
 * grid is the clock's own (1440 is a multiple of TURN_C), so the evening's track at 24:00 and the small hours' at 00:00
 * are the same moment of the same round: no jump at the day's wrap.
 */
const TURN_C = 15, VISIT_MAX = 6.5;
function visits(tr, A, until) {
  const st = A.stations, W = A.waitAt, hW = hTo(W, [A.gx, A.gy]);
  if (Math.hypot(tr.cur[0] - W[0], tr.cur[1] - W[1]) > 0.05) tr.walk([W], { speed: SLOW, prop: 'fork' });
  const waitTo = (t) => {
    // standing by, a slow turn now and then; the last half minute before a turning faces the fire squarely
    let k = 0;
    while (tr.now() < t - 0.55) {
      const seg = Math.min(t - 0.5 - tr.now(), 1.1 + 2.0 * rand(0x6a18, Math.round(tr.now() * 10), k));
      tr.hold(seg, { h: (hW + 22 * (rand(0x6a18, Math.round(tr.now() * 10), k, 'h') - 0.5) + 360) % 360, turn: 0.05, pose: 'stand', prop: 'fork' });
      k++;
    }
    tr.until(t, { h: hW, turn: 0.05, pose: 'stand', prop: 'fork' });
  };
  let g = Math.ceil((tr.now() - 1e-6) / TURN_C) * TURN_C;
  while (g + VISIT_MAX <= until) {
    waitTo(g);
    const k = Math.round(g / TURN_C) % (DAY / TURN_C);
    const sA = st[k % 2];
    tr.hold(0.04, { face: sA.at, turn: 0.03, pose: 'stand', prop: 'fork' });
    tr.walk([sA.at], { speed: SLOW, prop: 'fork' });
    tr.hold(1.3 + 1.1 * rand(0x6a19, k), { h: sA.h, pose: 'stoke', prop: 'fork' });
    if (rand(0x6a19, k, 'e') < 0.45) {
      tr.walk([st[2].at], { speed: SLOW, prop: 'fork' });
      tr.hold(0.8 + 0.6 * rand(0x6a19, k, 'E'), { h: st[2].h, pose: 'stoke', prop: 'fork' });
    }
    tr.hold(0.12, { pose: 'stand', prop: 'fork' });
    tr.walk([W], { speed: SLOW, prop: 'fork' });
    g += TURN_C;
  }
  waitTo(Math.max(tr.now(), until));
}

/** one limb up to the fire: down the west half to where they lie salted (Tamid 4:3), up the east half, onto the pile */
function limbTrip(tr, A, jb, out) {
  const s = A.limbStack[jb.j % A.limbStack.length], name = out.stack.find((x) => x.at === s)?.name || 'limb_foreleg';
  tr.walk([A.downTop, [A.xW, s[1] + 1.4, A.rampZ(s[1] + 1.4)], [s[0] + 0.9, s[1] + 0.6, A.rampZ(s[1] + 0.6)]], { speed: WALK });
  tr.hold(0.14, { face: s, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d) });
  const tPick = tr.now();
  tr.hold(0.1, { face: s, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), prop: name });
  tr.walk([[A.xE - 1, s[1] + 0.6, A.rampZ(s[1] + 0.6)], A.upTop, [A.g.max[0] + 1.6, A.gy + 0.4 - 1.2 * (jb.j % 3), A.Zt]], { speed: WALK * 0.9, pose: 'carry_limbs_walk', prop: name });
  tr.hold(0.04, { h: 270, pose: 'carry_limbs', prop: name });
  const tToss = tr.now() + 0.07;
  tr.hold(0.14, { h: 270, pose: 'toss', phase: (l, d) => clamp(l / d), props: [name, null] });
  const rec = out.stack.find((x) => x.at === s && x.until == null);
  if (rec) rec.until = tPick;
  out.pile.push({ name, at: A.onPile[jb.pile.idx], h: jb.pile.h, from: tToss, persist: !!jb.pile.persist });
  out.tosses.push(tToss);
  tr.hold(0.15, { h: 270, pose: 'stand' });
}

/** a log for the fire ⚙ (Tamid 2:3 — "they began to bring up logs"; the evening's are reconstruction) */
function woodTrip(tr, A, out) {
  const from = [A.xE + 3.4, A.yFoot - 2.6, 16];
  tr.walk([A.downTop, A.downFoot, [A.xW + 1, A.yFoot - 1.8, 16], from], { speed: WALK });
  tr.hold(0.12, { h: 180, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d) });
  tr.hold(0.1, { h: 180, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), prop: 'log' });
  tr.walk([[A.xE, A.yFoot - 0.6, 16], A.upFoot, A.upTop, [A.g.max[0] + 1.6, A.gy - 0.8, A.Zt]], { speed: WALK * 0.85, pose: 'carry_shoulder_walk', prop: 'log' });
  out.tosses.push(tr.now() + 0.08);
  tr.hold(0.16, { h: 270, pose: 'toss', phase: (l, d) => clamp(l / d), props: ['log', null] });
}

/** a limb that sprang off the fire before midnight is put back (Zevachim 9:6; Rambam MK 6:3) ⚙ where it lands */
function springTrip(tr, A, out) {
  const at = [A.g.max[0] + 1.3, A.g.max[1] + 1.1, A.Zt];
  const t0 = tr.now() - 1.6;
  tr.walk([[at[0] - 1.0, at[1] - 0.2, A.Zt]], { speed: SLOW, prop: 'fork' });
  tr.hold(0.12, { face: at, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d), prop: 'fork' });
  const tPick = tr.now();
  tr.hold(0.1, { face: at, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), prop: 'limb_foreleg' });
  tr.hold(0.04, { h: 225, pose: 'carry_limbs', prop: 'limb_foreleg' });
  const tToss = tr.now() + 0.07;
  tr.hold(0.14, { h: 225, pose: 'toss', phase: (l, d) => clamp(l / d), props: ['limb_foreleg', null] });
  out.stack.push({ name: 'limb_foreleg', at: [at[0], at[1], at[2]], h: 110, from: t0, until: tPick });
  out.pile.push({ name: 'limb_foreleg', at: A.onPile[7], h: 200, from: tToss });
  out.spring = { t: t0, tPick, tToss, at };
  out.tosses.push(tToss);
}

// --------------------------------------------------------------------------------------------------- captions
export const CAP = {
  lockKeys: { en: 'The time of locking: the kohen lifts the marble slab by its ring and takes the keys from the chain beneath it (Middot 1:9)', he: 'הִגְבִּיהַּ אֶת הַטַּבְלָא בַּטַּבַּעַת וְנָטַל אֶת הַמַּפְתְּחוֹת מִן הַשַּׁלְשֶׁלֶת' },
  lockBack: { en: 'Locked from within: he hangs the keys back on the chain, sets the slab in its place, spreads his garment over it and sleeps on it (Middot 1:9)', he: 'הֶחֱזִיר אֶת הַמַּפְתְּחוֹת לַשַּׁלְשֶׁלֶת וְאֶת הַטַּבְלָא לִמְקוֹמָהּ, נָתַן כְּסוּתוֹ עָלֶיהָ, יָשֵׁן לוֹ' },
  keri: { en: 'A kohen who became impure in the night goes out by the winding passage under the Birah, lamps burning on either side, to the Beit HaTevilah (Tamid 1:1)', he: 'יוֹצֵא וְהוֹלֵךְ לוֹ בַּמְּסִבָּה הַהוֹלֶכֶת תַּחַת הַבִּירָה' },
  imm: { en: 'Whoever wishes to clear the altar rises early and immerses before the officer comes (Tamid 1:2)', he: 'מִי שֶׁהוּא רוֹצֶה לִתְרֹם אֶת הַמִּזְבֵּחַ מַשְׁכִּים וְטוֹבֵל' },
  gevini: { en: '"Arise, kohanim, to your service; Levites, to your platform; Israelites, to your ma\'amad!" — Gevini the crier (Yoma 20b)', he: 'עִמְדוּ כֹהֲנִים לַעֲבוֹדַתְכֶם, וּלְוִיִּם לְדוּכָנְכֶם, וְיִשְׂרָאֵל לְמַעֲמַדְכֶם!' },
  knock: { en: 'The officer knocks on the kohanim of Beit HaMoked, and they open to him (Tamid 1:2)', he: 'הַמְמֻנֶּה בָא וְדוֹפֵק עֲלֵיהֶם, וְהֵם פָּתְחוּ לוֹ' },
  come: { en: '"Whoever has immersed — come and cast lots!" (Tamid 1:2)', he: 'מִי שֶׁטָּבַל יָבֹא וְיָפִיס' },
  raise: { en: '"Raise your fingers!" — one finger or two; one does not put out a thumb in the Mikdash (Yoma 22a)', he: 'הַצְבִּיעוּ — אַחַת אוֹ שְׁתַּיִם, וְאֵין מוֹצִיאִין אֲגוּדָל בַּמִּקְדָּשׁ' },
  mitre: { en: 'The officer lifts the mitre from one man\'s head: the count begins with him (Yoma 25a)', he: 'נוֹטֵל מִצְנֶפֶת מֵרֹאשׁוֹ שֶׁל אֶחָד מֵהֶן, וְיוֹדְעִין שֶׁמִּמֶּנּוּ פַּיִיס מַתְחִיל' },
  won1: { en: 'The count ends on him: he has won the clearing of the altar — "whoever won, won" (Tamid 1:2)', he: 'הֵפִיסוּ, זָכָה מִי שֶׁזָּכָה' },
  key: { en: 'He takes the key, opens the wicket and goes in from Beit HaMoked to the Azarah; the kohanim follow with two burning torches (Tamid 1:3)', he: 'נָטַל אֶת הַמַּפְתֵּחַ וּפָתַח אֶת הַפִּשְׁפָּשׁ' },
  keyShabbat: { en: 'He takes the key and opens the wicket; tonight, Shabbat, no light is carried — they search by the lamps lit before Shabbat (Tamid 1:3; Rambam BhB 8:12)', he: 'בְּלֵילֵי שַׁבָּת אֵין בְּיָדָם אוּר' },
  split: { en: 'They divide into two companies: one along the colonnade by the east, one by the west, inspecting as they go (Tamid 1:3)', he: 'נֶחְלְקוּ לִשְׁתֵּי כִתּוֹת' },
  allWell: { en: '"Shalom! All is well." — the two companies meet at the chamber of the chavitin makers (Tamid 1:3)', he: 'שָׁלוֹם, הַכֹּל שָׁלוֹם!' },
  bakers: { en: 'They set the chavitin makers to work (Tamid 1:3)', he: 'הֶעֱמִידוּ עוֹשֵׂי חֲבִתִּים לַעֲשׂוֹת חֲבִתִּים' },
};
