// The Great Sanhedrin (group G4). Events served (choreo 'sanhedrin'):
//   sanhedrin      weekdays, from the morning tamid to the afternoon tamid (Sanhedrin 88b): the seventy-one sit "like
//                  half a round threshing floor, so that they see one another" (Sanhedrin 4:3) in the chol half of
//                  Lishkat HaGazit — no one sits in the Azarah (Yoma 25a; Rambam BhB 5:17) — on the stepped benches
//                  build-courts made (azarah.chamber.gazit, station 'sanhedrin'): the Nasi at the apex, the Av Beit Din
//                  at his right, the rest before them (Rambam Sanhedrin 1:3); two scribes stand before them, one at the
//                  right and one at the left (Sanhedrin 4:3). From time to time a kohen stands before them to have his
//                  lineage examined (Middot 5:4).
//   court-in-chel  on Shabbat they sit in the Chel instead (Sanhedrin 88b): below the Gazit's door to the Chel, on the
//                  steps of its flight inside the soreg — "Rabban Gamliel and the elders were sitting on the steps on
//                  Har HaBayit" (Sanhedrin 11b) ⚙ — facing the Mount, where people come to ask.
// The judges come up from the city by the circuit (g4/mount.js), the Gazit's flight and its chol door, a few at a time
// over the half-hour before the session (outer benches first, so no one climbs past a seated man), and leave the same
// way when it ends (front benches first). Pure function of (t, date, seed).
import { rand, smooth } from '../lib/core.js';
import { crossed } from '../lib/cue.js';
import { AMAH } from '../../core/units.js';
import { Itin, Troupe, daySeed, tierCount, win, hm, observerNear, norm, lerpH } from './g4/lib.js';
import { visit, fitAt } from './g4/mount.js';
import { g4Book, planBefore } from './g4/book.js';
import { headingTo } from '../lib/path.js';

const SEED = 0x5a4e;
const CAPTION_RANGE = 25;
const N = 71;
// the Gazit's benches as built (courts/chambers.js amphitheatre; world-4: risers of one amah, so a judge sitting on a
// tier has his feet on the tier below — people's 'sit' assumes a 1-amah seat): centre, the tiers' inner radii and tops
// (amot above the floor), open toward the chol door (west); the Nasi's seat 0.35 over the first tier with a footstool of
// 0.35 before it. Read from the anchor courts.gazit.benches at init; these are its values.
const GZ = { c: [53, 381], Z: 16, rIn: [4.6, 5.7, 6.8, 7.9], tz: [1, 2, 3, 4], seat: 1.0, footstool: 0.35 };
const DOOR_IN = [46, 383.5, 16], DOOR_OUT = [46, 379, 16];
const SCRIBES = [{ at: [51.25, 378.0, 16], face: 75 }, { at: [51.25, 384.0, 16], face: 105 }];
const CANDIDATE = [48.6, 381.0, 16];

export default {
  id: 'sanhedrin',
  lead: 40,
  lag: 20,
  importance: 2,

  init(ctx, events, sim) {
    sim.setBounds([-200, 230, -30], [440, 470, 40]);
    const gz = ctx.elOpt?.('azarah.chamber.gazit')?.params?.stations?.sanhedrin;
    if (gz) { GZ.c = [gz[0], GZ.c[1]]; }
    const bn = ctx.anchors?.get?.('courts.gazit.benches');
    if (Array.isArray(bn?.tz) && bn.tz.length === 4) GZ.tz = bn.tz.slice();
    if (Array.isArray(bn?.rIn) && bn.rIn.length === 4) GZ.rIn = bn.rIn.slice();
    if (Number.isFinite(bn?.footstool)) GZ.footstool = bn.footstool;
    return {
      judges: sim.pool({ name: 'judges', role: 'sanhedrin', count: N, seed: SEED + 1, importance: 2, prop: null }),
      scribes: sim.pool({ name: 'scribes', role: 'israelite', count: 2, seed: SEED + 2, importance: 2, prop: null }),
      candidate: sim.pool({ name: 'candidate', role: 'kohen_offduty', count: 1, seed: SEED + 3, importance: 2, prop: null }),
      askers: sim.pool({ name: 'askers', role: 'israelite', count: 3, seed: SEED + 4, importance: 1, prop: null }),
      plan: null, planGen: -1, troupes: [],
      fmt: (m) => ctx.time?.format?.(m) ?? hm(m),
    };
  },

  /** the day's plan (g4/book.js: planned after courts-daily, before chambers-daily and nikanor-stations) */
  plan(ctx, state, sim) { return plan(ctx, state, sim); },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, state, sim);
    for (const tr of state.troupes) tr.update(ctx, sim, t);
    if (sim.crossing.ok) for (const c of P.cues) if (crossed(state, c.at)) sim.cueAt(c.key, c.at, () => { if (observerNear(ctx, c.pos, CAPTION_RANGE)) sim.caption(c.text, { id: 'sanhedrin', duration: 7 }); });
  },

  debug(s) {
    const P = s.plan;
    return P ? `${P.mode} ${P.W ? `${s.fmt(P.W[0])}–${s.fmt(P.W[1])}` : '-'} · candidates ${P.cand.map((c) => `${s.fmt(c.t)}${c.fit ? '' : '✗'}`).join(' ')}` : 'no plan';
  },
};

/**
 * How many of the 71 are staged: all on medium and above; on low, crowdScale × 1.4 (at least half) — the front benches
 * by rank. The Great Sanhedrin did not always sit complete: one who had to go out first saw that twenty-three remained
 * (Sanhedrin 37a; Rambam Sanhedrin 3:2) ⚙. Seventy-one close figures are more than the low tier draws at speed.
 */
const attendance = (sim) => Math.min(N, Math.max(Math.ceil(N / 2), Math.round(N * Math.min(1, sim.crowdScale * 1.4))));

const WHO = 'sanhedrin';
function plan(ctx, state, sim) {
  if (state.plan && state.planGen === sim.generation && state.planDate === ctx.time?.dateString) return state.plan;
  planBefore(ctx, sim, WHO);
  const book = g4Book(ctx, sim);
  book.dropOwner(WHO);
  state.book = book;
  const seed = daySeed(ctx, SEED);
  const wk = win(sim, 'sanhedrin'), sh = win(sim, 'court-in-chel');
  const P = { W: wk || sh, mode: wk ? 'gazit' : sh ? 'chel' : 'none', cand: [], cues: [] };
  state.troupes = [];
  if (wk) gazit(state, P, seed, sim, wk);
  else if (sh) chel(state, P, seed, sim, sh);
  for (const tr of state.troupes) tr.replan(sim.generation);
  state.plan = P;
  state.planGen = sim.generation;
  state.planDate = ctx.time?.dateString;
  return P;
}

// ------------------------------------------------------------------------------------------------ the Gazit
/** the 71 seats: tier, angle (rad, 0 = the apex east), the sitting origin and where he stands to sit down */
function gazitSeats() {
  const seats = [];
  const per = [15, 19, 22, 26];
  for (let k = 0; k < 4; k++) {
    const rs = GZ.rIn[k] + 0.45;
    const n = per[k];
    for (let i = 0; i < n; i++) {
      // tier 0 leaves the apex to the Nasi's raised seat (the builder's): its seats from ±12° outward
      const a = k === 0 ? (i < n / 2 ? -1 : 1) * (0.21 + (Math.PI / 2 - 0.27) * ((i < n / 2 ? i : i - Math.ceil(n / 2)) + 0.5) / Math.ceil(n / 2))
        : -Math.PI / 2 + 0.06 + (Math.PI - 0.12) * (i + 0.5) / n;
      seats.push({ k, a, rs });
    }
  }
  // nearest the apex first on every tier: the Nasi, the Av Beit Din at his right (north, as he faces west), then by
  // rank inward-out (Rambam Sanhedrin 1:3 "according to their years and their importance")
  seats.sort((p, q) => p.k - q.k || Math.abs(p.a) - Math.abs(q.a) || q.a - p.a);
  const out = [{ k: 0, a: 0, rs: GZ.rIn[0] + 0.32, nasi: true }];
  for (const s of seats) if (out.length < N) out.push(s);
  return out.map((s) => {
    const X = GZ.c[0] + s.rs * Math.cos(s.a), Y = GZ.c[1] + s.rs * Math.sin(s.a);
    const top = GZ.Z + (s.nasi ? GZ.tz[0] + 0.35 : GZ.tz[s.k]);
    const face = headingTo(X, Y, GZ.c[0], GZ.c[1]);
    // where he stands to sit: a pace in front, on the bench below (the floor before tier 0); the Nasi on his footstool
    // (world-4: rIn[0] − 0.75 … − 0.05, its top 0.35)
    const rf = s.nasi ? GZ.rIn[0] - 0.4 : (s.k === 0 ? GZ.rIn[0] - 0.55 : GZ.rIn[s.k] - 0.55);
    const zf = s.nasi ? GZ.Z + GZ.footstool : s.k === 0 ? GZ.Z : GZ.Z + GZ.tz[s.k - 1];
    return { ...s, sit: [X, Y, top - GZ.seat], stand: [GZ.c[0] + rf * Math.cos(s.a), GZ.c[1] + rf * Math.sin(s.a), zf], face };
  });
}

/** up the benches to a seat's standing place (tread-midpoint line), from the open floor at the seat's angle */
function climb(seat) {
  const pts = [];
  const a = seat.a, cx = GZ.c[0], cy = GZ.c[1];
  const P = (r, z) => [cx + r * Math.cos(a), cy + r * Math.sin(a), z];
  pts.push(P(3.4, GZ.Z));
  if (seat.k === 0) { pts.push(seat.stand); return pts; }
  pts.push(P(GZ.rIn[0] - 0.5, GZ.Z));
  for (let j = 0; j < seat.k; j++) pts.push(P(GZ.rIn[j] + 0.55, GZ.Z + GZ.tz[j]));
  return pts;
}

function gazit(state, P, seed, sim, [w0, w1]) {
  const seats = gazitSeats();
  // arrival order: outer benches first, the Av Beit Din and the Nasi last; departure the reverse ⚙
  const order = seats.map((s, i) => ({ i, key: (3 - s.k) * 100 + rand(seed, 'ar', i) * 90 - (s.nasi ? 1000 : 0) * 0 }));
  order.sort((a, b) => a.key - b.key);
  order.push(...order.splice(order.findIndex((o) => o.i === 1), 1), ...order.splice(order.findIndex((o) => o.i === 0), 1));
  const rankIn = new Array(N), rankOut = new Array(N);
  order.forEach((o, r) => { rankIn[o.i] = r; });
  [...order].reverse().forEach((o, r) => { rankOut[o.i] = r; });
  const nSeat = attendance(sim);
  const planFn = (i) => {
    if (i >= nSeat) return [];
    const s = seats[i];
    const v = 0.95 + 0.2 * rand(seed, 'jv', i);
    const tSit = w0 - 28 + 27 * (rankIn[i] / (N - 1));
    const tRise = w1 + 0.4 + 12 * (rankOut[i] / (N - 1));
    // the elders at the slow pace of the stream (its first lane) ⚙
    const r = fitAt(state.book, WHO, tSit, (mp) => {
      const it = new Itin();
      it.mp = mp;
      return visit(it, {
        gate: 'ce', spur: 'gazit', cls: 0,
        build: (it) => {
          const up = climb(s);
          it.walkTo([DOOR_IN, ...up], v * 0.85);
          it.stand(0.08, s.face);
          it.mark = it.T;
          it.stand(Math.max(1, tRise - tSit), s.face, { pose: 'sit', at: s.sit, ease: 0.012 });
          it.stand(0.1, s.face, { at: s.stand, ease: 0.012 });
          it.walkTo([...up].reverse().concat([DOOR_OUT]), v * 0.85);
        },
      }).done();
    });
    return [{ t0: r.t0, T: r.it.T, it: r.it }];
  };
  // planned in the order they come (each finds the places and lanes those before him took), handed out by seat
  const byArrival = seats.map((_, i) => i).sort((a, b) => rankIn[a] - rankIn[b]);
  const jEps = new Array(N);
  for (const i of byArrival) jEps[i] = planFn(i);
  state.troupes.push(new Troupe(state.judges, { plan: (i) => jEps[i] || [], legs: (e) => e.it }));
  // the two scribes: at their lecterns through the session ⚙ (writing: the hands on the desk)
  const scribe = (k) => {
    const S = SCRIBES[k];
    const r = fitAt(state.book, WHO, w0 - 1.5 - k * 0.6, (mp) => {
     const it = new Itin();
     it.mp = mp;
     return visit(it, {
      gate: 'ce', spur: 'gazit', cls: 1,
      build: (it) => {
        it.walkTo([DOOR_IN, [S.at[0] - 1.6, S.at[1], 16], S.at], 1.0);
        it.mark = it.T;
        let left = w1 - w0 + 0.5, n = 0;
        while (left > 0.05 && n < 400) {
          const d = Math.min(left, 1 + 4 * rand(seed, 'sw', k, n));
          // the scroll held open on the desk, writing the words of those who acquit and those who convict (Sanhedrin 4:3)
          it.stand(d, S.face + (rand(seed, 'sh', k, n) - 0.5) * 30, { pose: n % 3 === 1 ? 'stand' : 'carry', prop: 'scroll', at: S.at, turn: true });
          left -= d; n++;
        }
        it.walkTo([S.at, [S.at[0] - 1.6, S.at[1], 16], DOOR_OUT], 1.0);
      },
     }).done();
    });
    return [{ t0: r.t0, T: r.it.T, it: r.it }];
  };
  state.troupes.push(new Troupe(state.scribes, { plan: scribe, legs: (e) => e.it }));
  // a kohen comes before them to have his lineage examined, every hour or so (Middot 5:4) ⚙
  const cEps = [];
  for (let t = w0 + 25 + rand(seed, 'c0') * 20; t < w1 - 30; t += 55 + rand(seed, 'cg', Math.round(t)) * 45) {
    const fit = rand(seed, 'fit', Math.round(t)) < 0.85;
    let stood = 0;
    const r = fitAt(state.book, WHO, t, (mp) => {
      const it = new Itin();
      it.mp = mp;
      return visit(it, {
        gate: 'ce', spur: 'gazit', cls: 1,
        build: (it) => {
          it.walkTo([DOOR_IN, CANDIDATE], 1.0);
          it.mark = it.T;
          it.stand(5.5, 90);
          stood = it.T;
          it.stand(0.25, 90, { pose: 'bow', phase: (q) => q });
          it.walkTo([CANDIDATE, DOOR_OUT], 1.0);
        },
      }).done();
    });
    cEps.push({ t0: r.t0, T: r.it.T, it: r.it });
    P.cand.push({ t, fit });
    P.cues.push({
      key: `lineage:${Math.round(t)}`, at: r.t0 + stood, pos: CANDIDATE,
      text: fit
        ? { en: 'No flaw is found in his lineage: he will put on white, wrap himself in white, and go in to serve with his brothers the kohanim (Middot 5:4)', he: 'לוֹבֵשׁ לְבָנִים וּמִתְעַטֵּף לְבָנִים, נִכְנָס וּמְשַׁמֵּשׁ עִם אֶחָיו הַכֹּהֲנִים' }
        : { en: 'A flaw is found in his lineage: he will put on black, wrap himself in black, and go on his way (Middot 5:4)', he: 'לוֹבֵשׁ שְׁחוֹרִים וּמִתְעַטֵּף שְׁחוֹרִים, וְיוֹצֵא וְהוֹלֵךְ לוֹ' },
    });
  }
  state.troupes.push(new Troupe(state.candidate, { plan: () => cEps, legs: (e) => e.it }));
}

// ------------------------------------------------------------------------------------------------ Shabbat: the Chel
// The Gazit's flight (azarah.chamber.gazit.flight): foot at X 27 (Z 0), ascending east half an amah per half-amah
// step to the chol door at X 43 (Z 16); the soreg crosses it at X 33. Inside the soreg (steps 13–32) the steps are
// Chel. A man sits on step j (top 0.5 j) with his feet on step j − 2 — exactly the people 'sit' pose's amah of seat.
// Rows on the even steps 14…30, four either side of an aisle up the middle, all facing the Mount (west).
const FLIGHT = { x0: 27, y0: 376, y1: 386 };
function chelSeats() {
  const ys = [376.85, 377.95, 379.05, 380.15, 381.85, 382.95, 384.05, 385.15];
  const seats = [];
  for (let j = 14; j <= 30 && seats.length < N; j += 2) {
    const X = FLIGHT.x0 + 0.5 * j - 0.25;
    // the Nasi in the middle of the front row, the Av Beit Din at his right (north, facing west) ⚙
    const row = j === 14 ? [380.15, 381.85, 379.05, 382.95, 377.95, 384.05, 376.85, 385.15] : ys;
    for (const y of row) if (seats.length < N) seats.push({ j, X, Y: y, sit: [X, y, 0.5 * j - 1], stand: [X, y, 0.5 * j] });
  }
  return seats;
}
const zFlight = (X) => Math.max(0, Math.min(16, X - FLIGHT.x0 + 0.25));

function chel(state, P, seed, sim, [w0, w1]) {
  const seats = chelSeats();
  const nSeat = attendance(sim);
  const planFn = (i) => {
    if (i >= nSeat) return [];
    const s = seats[i];
    const v = 0.95 + 0.2 * rand(seed, 'jv', i);
    // back rows first; the front row last (the Nasi last of all); leaving, the front row first
    const rIn = (seats.length - 1 - i), rOut = i;
    const tSit = w0 - 26 + 25 * (rIn / (N - 1)) - (i === 0 ? -0.5 : 0);
    const tRise = w1 + 0.3 + 10 * (rOut / (N - 1));
    const aisle = s.Y < 381 ? 380.75 : 381.25;
    const r = fitAt(state.book, WHO, tSit, (mp) => {
      const it = new Itin();
      it.mp = mp;
      return visitFlight(it, 1.1, seed, i, (it) => {
        it.walkTo([[24.6, 381.0, 0], [26.75, aisle, 0], [s.X, aisle, zFlight(s.X)], [s.X, s.Y, 0.5 * s.j]], v * 0.85);
        it.stand(0.06, 270);
        it.mark = it.T;
        it.stand(Math.max(1, tRise - tSit), 270, { pose: 'sit', at: s.sit, ease: 0.012 });
        it.stand(0.1, 270, { at: s.stand, ease: 0.012 });
        it.walkTo([[s.X, s.Y, 0.5 * s.j], [s.X, aisle, zFlight(s.X)], [26.75, aisle, 0], [24.6, 381.0, 0]], v * 0.85);
      });
    });
    return [{ t0: r.t0, T: r.it.T, it: r.it }];
  };
  // planned in the order they come (back rows first)
  const jEps = new Array(N);
  for (let i = seats.length - 1; i >= 0; i--) jEps[i] = planFn(i);
  state.troupes.push(new Troupe(state.judges, { plan: (i) => jEps[i] || [], legs: (e) => e.it }));
  // people come to the foot of the flight with their questions (Sanhedrin 88b "a question was asked before them") ⚙
  const askEps = [[], [], []];
  for (let k = 0; k < 3; k++) {
    for (let t = w0 + 10 + k * 17 + rand(seed, 'q0', k) * 20; t < w1 - 25; t += 35 + rand(seed, 'qg', k, Math.round(t)) * 50) {
      // at the flight's foot, east of the circuit's line (the stream's lanes are west of it, the mourner on it)
      const at = [26.35, 379.2 + k * 1.3, 0];
      const r = fitAt(state.book, WHO, t, (mp) => {
        const it = new Itin();
        it.mp = mp;
        return visitFlight(it, 1.25, seed, 100 + k, (it) => {
          it.walkTo([[24.6, 381.0, 0], at], 1.0);
          it.mark = it.T;
          it.stand(0.25, 90, { pose: 'bow', phase: (q) => q * 0.9 });
          it.stand(4 + rand(seed, 'qd', k, Math.round(t)) * 5, 90);
          it.stand(0.25, 90, { pose: 'bow', phase: (q) => q * 0.9 });
          it.walkTo([at, [24.6, 381.0, 0]], 1.0);
        });
      });
      askEps[k].push({ t0: r.t0, T: r.it.T, it: r.it });
    }
  }
  state.troupes.push(new Troupe(state.askers, { plan: (k) => askEps[k], legs: (e) => e.it }));
}

/**
 * Round the circuit to the foot of the Gazit's flight and back (the west side, by the stream: from the north, turning
 * left off it to the flight's foot; back onto it going south, out by the first gate). build(it) adds what is done there,
 * starting and ending at (24.6, 381).
 */
function visitFlight(it, v, seed, i, build) {
  return visit(it, { gate: 'ce', spur: 'flightFoot', v, build }).done();
}
