// G5 — the day's plan of individuals' offerings, built once per date as a pure function of (date, day type, zmanim,
// Hebrew date, seed). It decides how many of each offering come (OFFERING_RULES.frequency.alone and the sets, with ONE
// seeded day quantile q — never perDay plus sets: CLAUDE.md), when each comes, which lane (ring + hook + marble table)
// and which pooled figures stage it, and every figure's timeline step by step (OFFERING_TYPES[type].steps: their
// minutes, stations, actors and props). The per-frame code only evaluates these timelines at t.
//
// Halachic frame (offerings.js OFFERING_RULES; the schedule's events): nothing before the morning tamid is complete
// (Pesachim 58b); nothing slaughtered after 8.3 seasonal hours, the last blood by 8.35 and the last fats on the fire by
// 8.4, before the afternoon tamid (Pesachim 58b–59b; Rambam TuM 1:3); nothing on Shabbat (Temurah 2:1); notar burned by
// day only, in the morning (Rambam Pesulei HaMukdashin 19:4–5). Minutes and traffic are reconstruction.
import { OFFERING_TYPES, OFFERING_RULES, NESACHIM, offeringWindows } from '../../../data/offerings.js';
import { hashStr, rand, rng } from '../../lib/core.js';
import { Track, one, cyc, fix, WALK, tableOrder, carcassOf, WAVE_P, sampleSeg } from './track.js';
import { SitePath } from '../../lib/path.js';
import { vesselAt } from '../g4/metzora.js';

const AM = 0.48;
// Psalm 30's three sections as the audio renders them (render-audio-3: sectionTiming({ song: 'bikkurim' }, s).duration,
// seconds) and the whole song in minutes — the Levites sing it through as the basket reaches the court (Bikkurim 3:4)
const BIK_SECTIONS = [34.6, 39.6, 49.8];
const SONG_MIN = BIK_SECTIONS.reduce((a, b) => a + b, 0) / 60;
// the owners' and their animals' pools hold the walk over the Mount before and after each offering too (WAY_RES) — qa-r1
export const POOLS = { kohen: 44, israelite: 30, kohen_offduty: 3, nazir: 3, levi: 6, lamb: 14, ram: 8, goat: 9, ewe: 6, she_goat: 6 };
/** a pool's figure seeds (Slot spec.seed): private-offerings' pools, and courts-daily's figures that walk them in and out */
export const poolSeed = (name) => 0x6735 + name.length * 131 + POOLS[name];
/**
 * The owners, bringers and animals appear at the foot of a gate's flight on the Mount (KOR_FOOT, BECH_FOOT, CHEL_FOOT)
 * and are gone from there: courts-daily walks them up from the city to it and home again from it, as the same figures
 * (its pools mirror these: poolSeed). A track that begins or ends at one keeps its pool figure free for that walk —
 * WAY_RES minutes before / after — so the figure is never in two places ⚙ (qa-r1 SIM-1)
 */
export const WAY_NODES = ['KOR_FOOT', 'BECH_FOOT', 'CHEL_FOOT'];
export const WAY_POOLS = ['israelite', 'lamb', 'ram', 'goat', 'ewe', 'she_goat'];
export const WAY_RES = { pre: 14, post: 15 };
/** the animal pools (their tracks lead on a rope, are carried, never book a shared place) */
export const ANIMALS = new Set(['lamb', 'ram', 'goat', 'ewe', 'she_goat']);
// The species the data allows, weighted ⚙ — every kind with its own hung, flayed and hide states (people-4): an olah of
// the flock or of the goats, a male (Vayikra 1:10); an individual's chatat a she-goat or a ewe lamb (Vayikra 4:28, 4:32
// — people's she_goat and ewe); an asham brought alone is always a ram (gezelot, me'ilot, the shifchah charufah, talui —
// offerings.js; the lamb asham is the nazir's and the metzora's, staged elsewhere).
const SPECIES = {
  olah: [['lamb', 0.65], ['ram', 0.2], ['goat', 0.15]],
  chatat: [['ewe', 0.5], ['she_goat', 0.5]],
  asham: [['ram', 1]],
  shelamim: [['lamb', 0.5], ['ram', 0.25], ['goat', 0.25]],
  todah: [['lamb', 0.5], ['ram', 0.2], ['goat', 0.3]],
  bechor: [['lamb', 0.6], ['goat', 0.4]],
  maaser: [['lamb', 0.6], ['goat', 0.4]],
};
const KK = new Set(['olah', 'chatat', 'asham']);
const MEALS = ['minchat-solet', 'minchat-machavat', 'minchat-marcheshet', 'minchat-maafeh', 'minchat-chotei'];
const MEAL_PROP = { 'minchat-solet': 'solet', 'minchat-machavat': 'machavat', 'minchat-marcheshet': 'marcheshet', 'minchat-maafeh': 'machavat', 'minchat-chotei': 'solet' };
const SPEED = { kohen: 1.25, lead: 0.95, carry: 1.05, owner: 1.15 };
const ANIMAL_LANES = 6, BIRD_LANES = 3, MEAL_LANES = 3;

/** schedule event that heads a step (the stage of the stream it belongs to) */
const PARENT = {
  arrive: 'private-offerings', seal: 'private-offerings', semichah: 'private-offerings', shechitah: 'private-offerings',
  holachah: 'altar-blood', zerikah: 'altar-blood', matanot: 'altar-blood', 'matanah-achat': 'altar-blood',
  hefshet: 'private-flaying', hadachah: 'private-flaying', or: 'private-flaying',
  tenufah: 'tenufah', haalaah: 'altar-limbs', nesachim: 'altar-limbs', achilah: 'private-flaying', takeout: 'tenufah',
};

// ======================================================================================== the day
export function dayInputs(ctx) {
  const tm = ctx.time;
  const wd = tm?.weekday ?? 1;
  const prevDayType = wd === 0 ? 'shabbat' : wd === 6 ? 'friday' : 'weekday';
  return { dateString: tm?.dateString || '', dayType: tm?.dayType || 'weekday', zmanim: tm?.zmanim, hebrew: tm?.hebrew, prevDayType,
    dayH: (h) => (tm?.zmanim ? tm.zmanim.sunrise + h * (tm.zmanim.shaahDay ?? (tm.zmanim.sunset - tm.zmanim.sunrise) / 12) : NaN) };
}

/**
 * The plan. G: geo (buildGeo). ev(id): the schedule event (with t0/t1) or null. Returns { ok, ... } — ok false on
 * Shabbat or when the day has no individual window.
 */
export function buildPlan(ctx, G, ev) {
  const g = buildPlanSteps(ctx, G, ev);
  let r;
  do r = g.next(); while (!r.done);
  return r.value;
}
/** the same, as an iterator: a yield every few offerings placed (the boot's plan job slices it — qa-r2 SIM-R2-12) */
export function* buildPlanSteps(ctx, G, ev) {
  const D = dayInputs(ctx);
  const P = {
    ok: false, G, D, key: `${D.dateString}|${D.dayType}`, seed: hashStr(`g5:${D.dateString}:${ctx.params?.seed ?? 5786}`),
    insts: [], tracks: [], props: [], fires: [], cues: [], dropped: {}, counts: {}, q: 0,
    pools: Object.fromEntries(Object.entries(POOLS).map(([k, n]) => [k, Array.from({ length: n }, () => [])])),
    laneRes: Array.from({ length: ANIMAL_LANES }, () => ({ ring: [], hook: [], hold: [], table: [] })),
    birdRes: Array.from({ length: BIRD_LANES }, () => []), mealRes: Array.from({ length: MEAL_LANES }, () => []),
    // places one offering's figures may hold at a time (any figure of it within r amot, between heights z): the SW
    // corner with its strip, the place at the hearth where portions are set down for the kohanim's meal, and the
    // sovev's SE corner (a 1-amah ledge: a bird kohen there blocks the way round)
    hot: [{ id: 'sw', c: G.S.swPoint.pos, r: 1.3, z: [15, 17.6], book: new Book() }, { id: 'drop', c: G.S.drop.pos, r: 1.1, z: [15, 17.6], book: new Book() },
      { id: 'se', c: [G.S.seBird.pos[0] - 1.2, G.S.seBird.pos[1] + 0.4], r: 2.2, z: [21, 23.6], book: new Book() },
      // the NE corner (the first throw of "two that are four" and the firstling's one pouring), the great pile's east
      // face on the altar top (limbs, fats, handfuls, flour thrown on), the silver cups at the SW horn (the wine)
      { id: 'ne', c: G.S.altarNE.pos, r: 1.2, z: [15, 17.6], book: new Book() },
      { id: 'pile', c: [G.S.pileFaceX, (G.S.pileY[0] + G.S.pileY[1]) / 2], r: 4.6, z: [24, 26.5], book: new Book() },
      { id: 'cups', c: G.S.cups.pos, r: 1.8, z: [24, 26.5], book: new Book() },
      { id: 'salt', c: G.S.saltE, r: 1.6, z: [16.5, 21.5], book: new Book() }],
  };
  if (!D.zmanim || D.dayType === 'shabbat') return P;
  const W = offeringWindows(D.dayType, D.zmanim, { prevDayType: D.prevDayType, hebrew: D.hebrew });
  const ind = W.find((w) => w.id === 'individual');
  if (!ind) return P;
  const evT = (id, k, fb) => { const e = ev(id); return e && Number.isFinite(e[k]) ? e[k] : fb; };
  const a = evT('private-offerings', 't0', ind.t0);
  P.win = {
    a, b: evT('private-offerings', 't1', ind.t1),
    bloodEnd: evT('altar-blood', 't1', D.dayH(8.35)),
    endAll: evT('altar-limbs', 't1', D.dayH(8.4)),
    birds: [evT('bird-offerings', 't0', a + 4), evT('bird-offerings', 't1', D.dayH(8.4))],
    meal: [evT('meal-offerings', 't0', a + 9), evT('meal-offerings', 't1', D.dayH(8.4))],
    flay: evT('private-flaying', 't0', a + 4), limbs: evT('altar-limbs', 't0', a + 14), tenufah: evT('tenufah', 't0', a + 19),
    kayitz: ev('kayitz-hamizbeach') ? [evT('kayitz-hamizbeach', 't0', D.dayH(5)), evT('kayitz-hamizbeach', 't1', D.dayH(8))] : null,
    notar: W.find((w) => w.id === 'notar') ? [evT('notar-burning', 't0', W.find((w) => w.id === 'notar').t0), evT('notar-burning', 't1', W.find((w) => w.id === 'notar').t1)] : null,
    bikkurim: ind.offerings.includes('bikkurim'),
  };
  P.parents = new Set(['private-offerings', 'altar-blood', 'private-flaying', 'tenufah', 'altar-limbs', 'bird-offerings', 'meal-offerings',
    'kayitz-hamizbeach', 'notar-burning', 'kodashim-meal', 'bikkurim-late'].filter((id) => ev(id)));
  P.ok = true;

  // ---------------------------------------------------------------- the day's mix: one quantile q for everything
  const F = OFFERING_RULES.frequency;
  const q = P.q = rand(P.seed, 'q');
  const count = (id, lo, hi) => { const x = lo + q * (hi - lo); const n = Math.floor(x) + (rand(P.seed, 'round', id) < x - Math.floor(x) ? 1 : 0); P.counts[id] = n; return n; };
  const alone = (id) => (F.alone[id] ? count(id, F.alone[id][0], F.alone[id][1]) : 0);
  const set = (id) => { const f = OFFERING_TYPES[id]?.frequency; return f ? count(id, f.lo, f.hi) : 0; };

  const animalJobs = [];
  const pick = (type, i) => { const w = SPECIES[type]; let r = rand(P.seed, 'sp', type, i); for (const [k, p] of w) { if (r < p) return k; r -= p; } return w[0][0]; };
  for (const type of ['olah', 'chatat', 'asham', 'shelamim', 'todah', 'bechor', 'maaser']) {
    const n = alone(type);
    // the firstling is brought by the kohen who received it, in his own clothes until he serves (the data's arrive
    // actor): drawn as a man in ordinary clothes
    for (let i = 0; i < n; i++) animalJobs.push({ type, i, species: pick(type, i), owner: 'israelite', gate: type === 'bechor' ? 'bechorot' : 'korban', semichah: !!OFFERING_TYPES[type].semichah?.required });
  }
  const birdJobs = [];
  const nYol = set('yoledet'), nZav = set('zav-zavah');
  for (let i = 0; i < nYol; i++) {
    const lamb = rand(P.seed, 'yol-lamb', i) < (OFFERING_TYPES.yoledet.frequency.yields.olah || 0.15);
    const bj = { kind: lamb ? 'chatat' : 'pair', set: 'yoledet', i, source: 'set' };
    birdJobs.push(bj);
    // a mother who can afford a lamb brings it for her olah with a bird for her chatat; the chatat comes first, even
    // before an animal olah (Zevachim 90a; Mishnah Zevachim 10:4): her husband or agent leads the lamb in once the bird
    // has been offered (the arrival is set when the bird is placed)
    if (lamb) { const aj = { type: 'olah', i: 100 + i, species: 'lamb', owner: 'israelite', gate: 'korban', semichah: false, set: 'yoledet', after: bj }; bj.linked = aj; animalJobs.push(aj); }
  }
  for (let i = 0; i < nZav; i++) birdJobs.push({ kind: 'pair', set: 'zav-zavah', i, source: 'set' });
  // birds brought alone: the money put in the chests marked "kinnin" (one chatat, one olah) and "gozlei olah" (all
  // olot), and the kohanim offer birds for it (Shekalim 6:5, the Sages) — no owner comes in; or a man brings his own
  // bird for a vow or a gift (Kinnim 1:1: all of these are olot) and hands it over at Sha'ar Nikanor. The share
  // brought in person is reconstruction ⚙
  for (let i = 0, n = alone('chatat-haof'); i < n; i++) birdJobs.push({ kind: 'chatat', set: null, i: 200 + i, source: 'chest' });
  for (let i = 0, n = alone('olat-haof'); i < n; i++) birdJobs.push({ kind: 'olah', set: null, i: 300 + i, source: rand(P.seed, 'bring', i) < 0.45 ? 'bringer' : 'chest' });
  const mealJobs = [];
  for (const type of MEALS) for (let i = 0, n = alone(type); i < n; i++) mealJobs.push({ type, i });
  // the sets this module does not stage: the nazir's three animals and the metzora's rites are counted but staged by the
  // chambers / Nikanor modules' scenes (see docs/decisions/choreo-g5-offerings.md)
  set('nazir'); set('metzora');
  const nBik = P.win.bikkurim ? alone('bikkurim') : 0;

  // ---------------------------------------------------------------- arrivals, spread over the window (seeded, stratified)
  const shuffle = (arr, salt) => { const r = rng(hashStr(`${P.seed}:${salt}`)); for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const strat = (n, t0, t1, salt) => Array.from({ length: n }, (_, i) => t0 + ((i + 0.1 + 0.8 * rand(P.seed, salt, i)) / Math.max(1, n)) * Math.max(0, t1 - t0));

  // the healed metzora's asham is staged by the Nikanor module in its own window at the ring between lanes 1 and 5
  // (X 229, row 2) and a hook beside pillar 6: keep those lanes clear then (never two scenes in one place)
  const mz = ev('metzora');
  if (mz && Number.isFinite(mz.t0)) {
    const w = [mz.t0 - 3, mz.t1 + 4];
    P.G.lanes.forEach((L, i) => {
      const R = P.laneRes[i];
      if (Math.abs(L.ring[0] - 229) < 1 && Math.abs(L.ring[1] - 355.5) < 6) { R.ring.push(w); R.hold.push(w); }
      if (Math.abs(L.pillarX - 228) < 2.5) { R.hook.push(w); R.table.push(w); }
    });
    // its asham's blood is thrown at the NE and the SW corners by the Nikanor module's vessel kohen: booked for exactly
    // the minutes he holds them — the pure itinerary that module stages (g4/metzora.js), which it publishes as its
    // plan.M.neBlood / plan.M.swBlood — on the days this plan counts a metzora
    if (P.counts.metzora > 0) {
      const sw = P.hot.find((h) => h.id === 'sw'), ne = P.hot.find((h) => h.id === 'ne');
      const [a, b] = vesselAt(mz.t0, [sw, ne]);
      if (a) sw.book.push(a);
      if (b) ne.book.push(b);
      P.metzoraBlood = { sw: a, ne: b };
    }
  }

  // arrivals: stratified over the window (seeded); a mother's lamb waits for her bird (below)
  shuffle(animalJobs, 'animals');
  const lastArr = P.win.b - 16;
  const freeJobs = animalJobs.filter((j) => !j.after), linked = animalJobs.filter((j) => j.after);
  const arrA = strat(freeJobs.length, a + 0.6, lastArr, 'arrA');
  freeJobs.forEach((j, k) => { j.arr = arrA[k]; });
  shuffle(birdJobs, 'birds');
  const arrB = strat(birdJobs.length, P.win.birds[0] + 0.6, P.win.birds[1] - 9, 'arrB');
  birdJobs.forEach((j, k) => { j.arr = arrB[k]; });

  // the mother's bird chatat first, early enough for her lamb; the lamb led in once the bird has been offered
  for (const bj of birdJobs) {
    if (!bj.linked) continue;
    bj.arr = Math.min(bj.arr, P.win.endAll - 80);       // room for her lamb's whole service after it
    const inst = placeSimple(ctx, P, bj, 'bird');
    const mel = inst?.steps.find((s) => s.id === 'melikah');
    if (mel) bj.linked.arr = mel.t1 + 0.5 + 2.5 * rand(P.seed, 'yol-arr', bj.i);
    else bj.linked.skip = true;
  }

  // animals: lanes, slid later when a lane is busy; placed in order of arrival
  const order = [...freeJobs, ...linked.filter((j) => !j.skip)].sort((x, y) => x.arr - y.arr);
  let nPlaced = 0;
  for (const job of order) {
    if ((++nPlaced & 3) === 0) yield;
    const inst = placeAnimal(ctx, P, job);
    if (inst && job.after?.inst) { inst.link = job.after.inst.id; job.after.inst.link = inst.id; }
  }
  for (const j of linked) if (j.skip) P.dropped.olah = (P.dropped.olah || 0) + 1;

  // kayitz hamizbeach: olot from the surplus, in lanes left idle in its hours (Shekalim 4:4; report §33.6)
  if (P.win.kayitz) {
    const [k0, k1] = P.win.kayitz;
    let n = 0;
    for (let tt = k0 + 0.6; tt < k1 - 10 && n < 8; tt += 7) {
      const job = { type: 'olah', i: 500 + n, species: 'lamb', owner: 'kohen', gate: 'moked', semichah: false, kayitz: true, arr: tt };
      const busy = P.insts.filter((x) => x.job?.kayitz && x.t0 < tt + 30 && x.t1 > tt).length;
      if (busy >= 2) continue;
      if (placeAnimal(ctx, P, job, { maxShift: 6.5 })) n++;
    }
    P.counts.kayitz = n;
  }

  // the other birds: three kohanim's lanes, pairs and singles in arrival order
  for (const job of birdJobs) { if (job.linked) continue; if ((++nPlaced & 7) === 0) yield; placeSimple(ctx, P, job, 'bird'); }

  // meal-offerings
  shuffle(mealJobs, 'meal');
  const arrM = strat(mealJobs.length, P.win.meal[0] + 0.6, P.win.meal[1] - 30, 'arrM');
  mealJobs.forEach((j, k) => { j.arr = arrM[k]; });
  for (const job of mealJobs) { if ((++nPlaced & 7) === 0) yield; placeSimple(ctx, P, job, 'meal'); }

  // notar, yesterday's leftovers (by day only: Rambam Pesulei HaMukdashin 19:4)
  if (P.win.notar) commit(P, scriptNotar(P, { type: 'notar' }), 0, { kind: 'notar', type: 'notar', lane: 0, n: 0 });
  // bikkurim in season (offeringWindows opens the lane by the Hebrew date)
  if (nBik > 0) {
    const arrK = strat(nBik, a + 30, P.win.b - 40, 'arrK');
    for (let i = 0; i < nBik; i++) placeSimple(ctx, P, { type: 'bikkurim', i, arr: arrK[i] }, 'bikkurim');
  }

  finish(P);
  return P;
}

// ======================================================================================== placement
function overlaps(list, a, b) { for (const [x, y] of list) if (a < y && b > x) return true; return false; }

/** a place's bookings, kept sorted by start with the running maximum of the ends: "is [a, b) free?" by binary search */
class Book {
  constructor() { this.s = []; this.e = []; this.m = []; }
  get length() { return this.s.length; }
  push([a, b]) {
    const s = this.s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const k = (lo + hi) >> 1; if (s[k] <= a) lo = k + 1; else hi = k; }
    s.splice(lo, 0, a); this.e.splice(lo, 0, b); this.m.splice(lo, 0, 0);
    for (let k = lo; k < s.length; k++) this.m[k] = Math.max(k ? this.m[k - 1] : -Infinity, this.e[k]);
  }
  /** any booking [x, y) with a < y && b > x */
  hits(a, b) {
    const s = this.s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const k = (lo + hi) >> 1; if (s[k] < b) lo = k + 1; else hi = k; }
    return lo > 0 && this.m[lo - 1] > a;
  }
}
function poolFree(P, pool, a, b) {
  const slots = P.pools[pool];
  if (!slots) return -1;
  for (let i = 0; i < slots.length; i++) if (!overlaps(slots[i], a - 0.05, b + 0.05)) return i;
  return -1;
}
const WAY_SET = new Set(WAY_POOLS);
/** where a track appears / is gone on the Mount ({ a, b }: WAY_NODES ids or null; an animal is never led home) */
export function wayEnds(P, tr) {
  if (tr._ways) return tr._ways;
  let a = null, b = null;
  if (WAY_SET.has(tr.pool) && tr.segs.length) {
    const s0 = tr.segs[0], s1 = tr.segs[tr.segs.length - 1];
    const p0 = sampleSeg(s0, s0.t0, {}, {}), p1 = sampleSeg(s1, s1.t1, {}, {});
    for (const k of WAY_NODES) {
      const n = P.G.N[k];
      if (!n) continue;
      if (Math.hypot(p0.X - n.X, p0.Y - n.Y) < 3) a = k;
      if (!ANIMALS.has(tr.pool) && Math.hypot(p1.X - n.X, p1.Y - n.Y) < 3) b = k;
    }
  }
  return (tr._ways = { a, b });
}
/** the minutes a track holds its pool figure: its own, and the walks over the Mount before and after it */
function holdOf(P, tr, s = 0) {
  const w = wayEnds(P, tr);
  return [tr.t0 + s - (w.a ? WAY_RES.pre : 0), tr.t1 + s + (w.b ? WAY_RES.post : 0)];
}
/** do all of a built offering's figures find a free figure in their pools when shifted by s? (tentative, in order) */
function poolsFit(P, built, s) {
  const taken = [];
  let ok = true;
  for (const tr of built.tracks) {
    const [a, b] = holdOf(P, tr, s);
    const i = poolFree(P, tr.pool, a, b);
    if (i < 0) { ok = false; break; }
    P.pools[tr.pool][i].push([a, b]);
    taken.push([tr.pool, i]);
  }
  for (const [pool, i] of taken) P.pools[pool][i].pop();
  return ok;
}

function placeAnimal(ctx, P, job, { maxShift: mShift = 45 } = {}) {
  let best = null;
  const order = [...Array(ANIMAL_LANES).keys()];
  // lesser offerings prefer the eastern columns (offerings.js: "the model uses the eastern rows of rings")
  if (!KK.has(job.type)) order.sort((x, y) => (P.G.lanes[y].east - P.G.lanes[x].east) || x - y);
  // lanes in order of when their ring and hook are next free around the arrival; build only the first few
  const freeAt = (lane) => { const R = P.laneRes[lane]; let f = job.arr; for (const [x, y] of R.ring) if (y > f && x < f + 12) f = y; for (const [x, y] of R.hook) if (y > f + 8 && x < f + 30) f = Math.max(f, y - 8); return f; };
  const est = new Map(order.map((l) => [l, freeAt(l)]));
  order.sort((x, y) => (est.get(x) - est.get(y)) || 0);
  let tried = 0;
  for (const lane of order) {
    if (tried >= 3 && best) break;
    tried++;
    const built = scriptAnimal(P, job, lane);
    if (!built) continue;
    const R = P.laneRes[lane], res = built.res;
    const maxShift = mShift;
    for (let d = 0; d <= maxShift; d += 0.5) {
      const s = job.arr + d;
      if (s + built.lim.slaughter > P.win.b || s + built.lim.blood > P.win.bloodEnd || s + built.lim.end > P.win.endAll) break;
      if (s + built.lim.flay < P.win.flay || s + built.lim.limbs < P.win.limbs || (built.lim.tenufah != null && s + built.lim.tenufah < P.win.tenufah)) continue;
      if (overlaps(R.ring, res.ring[0] + s, res.ring[1] + s) || overlaps(R.hook, res.hook[0] + s, res.hook[1] + s)
        || overlaps(R.hold, res.hold[0] + s, res.hold[1] + s) || overlaps(R.table, res.table[0] + s, res.table[1] + s)) continue;
      if (hotBusy(P, built, s) || !poolsFit(P, built, s)) continue;
      if (!best || s < best.s - 1e-6) best = { s, lane, built };
      break;
    }
    if (best && best.s <= job.arr + 1e-6) break;
  }
  if (!best) { if (!job.kayitz) P.dropped[job.type] = (P.dropped[job.type] || 0) + 1; return null; }
  const { s, lane, built } = best;
  const R = P.laneRes[lane], res = built.res;
  R.ring.push([res.ring[0] + s, res.ring[1] + s]); R.hook.push([res.hook[0] + s, res.hook[1] + s]);
  R.hold.push([res.hold[0] + s, res.hold[1] + s]); R.table.push([res.table[0] + s, res.table[1] + s]);
  R.n = (R.n || 0) + 1;
  return commit(P, built, s, { kind: 'animal', type: job.type, lane, n: P.insts.length, job });
}

/** a bird, a meal-offering or a basket: the first lane (one kohen each) free from the arrival on, slid up to 40 min */
function placeSimple(ctx, P, job, kind) {
  const res = kind === 'bird' ? P.birdRes : kind === 'meal' ? P.mealRes : [[]];
  const end = kind === 'bird' ? P.win.birds[1] : kind === 'meal' ? P.win.meal[1] : P.win.endAll;
  let best = null;
  for (let lane = 0; lane < res.length; lane++) {
    const built = kind === 'bird' ? scriptBird(P, job, lane) : kind === 'meal' ? scriptMeal(P, job, lane) : scriptBikkurim(P, job, lane);
    const [l0, l1] = built.res.lane;
    let s = NaN;
    for (let d = 0; d < 40; d += 0.5) {
      const x = job.arr + d;
      if (best && x >= best.s) break;
      if (x + built.lim.end > end || (built.lim.slaughter != null && x + built.lim.slaughter > P.win.b)) break;
      if (overlaps(res[lane], x + l0 - 0.4, x + l1) || hotBusy(P, built, x) || !poolsFit(P, built, x)) continue;
      s = x;
      break;
    }
    if (!Number.isFinite(s)) continue;
    if (!best || s < best.s) best = { s, lane, built };
  }
  if (!best) { const k = job.type || job.kind; P.dropped[k] = (P.dropped[k] || 0) + 1; return null; }
  res[best.lane].push([best.s + best.built.res.lane[0], best.s + best.built.res.lane[1]]);
  return commit(P, best.built, best.s, { kind, type: best.built.type, lane: best.lane, n: P.insts.length, job });
}

// ---------------------------------------------------------------------------------------- shared places (P.hot)
/**
 * When a built offering has any figure within r of each shared place, at its nominal start 0: [[t0, t1], …] per place.
 * HOLD spots by distance; WALK legs exactly, by the line–circle intersection of each leg of the route (walkers only
 * on the pavement — the sovev, the ramps and the altar top are above). Cached on the built offering.
 */
function hotOf(P, built) {
  if (built.hot) return built.hot;
  const out = P.hot.map(() => []);
  for (const tr of built.tracks) {
    if (ANIMALS.has(tr.pool)) continue;
    for (const sg of tr.segs) {
      P.hot.forEach((H, hi) => {
        const [cx, cy] = H.c, r = H.r, [z0, z1] = H.z;
        if (sg.kind === 0) {
          if (sg.Z > z0 && sg.Z < z1 && Math.hypot(sg.X - cx, sg.Y - cy) < r) out[hi].push([sg.t0, sg.t1]);
          return;
        }
        if (sg.kind !== 1) return;
        const pts = sg.path.points, cum = sg.path.cum, span = sg.d1 - sg.d0, dur = sg.t1 - sg.t0;
        if (!(span > 0)) return;
        // the route's box (cached on the shared path): most walks are nowhere near a given place
        let bb = sg.path._bb;
        if (!bb) {
          bb = sg.path._bb = [Infinity, Infinity, -Infinity, -Infinity, Infinity, -Infinity];
          for (const q of pts) { bb[0] = Math.min(bb[0], q.X); bb[1] = Math.min(bb[1], q.Y); bb[2] = Math.max(bb[2], q.X); bb[3] = Math.max(bb[3], q.Y); bb[4] = Math.min(bb[4], q.Z); bb[5] = Math.max(bb[5], q.Z); }
        }
        if (cx < bb[0] - r || cx > bb[2] + r || cy < bb[1] - r || cy > bb[3] + r || bb[4] > z1 || bb[5] < z0) return;
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i], b = pts[i + 1];
          if (!(Math.min(a.Z, b.Z) < z1 && Math.max(a.Z, b.Z) > z0)) continue;
          const dx = b.X - a.X, dy = b.Y - a.Y, fx = a.X - cx, fy = a.Y - cy;
          const A = dx * dx + dy * dy, Bq = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
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
          out[hi].push([sg.t0 + ((dA + lag - sg.d0) / span) * dur, sg.t0 + ((dB + lag - sg.d0) / span) * dur]);
        }
      });
    }
  }
  // a little before and after (the body is not a point)
  for (const list of out) for (const iv of list) { iv[0] -= 0.04; iv[1] += 0.04; }
  built.hot = out;
  return out;
}
function hotBusy(P, built, s) {
  const h = hotOf(P, built);
  for (let i = 0; i < h.length; i++) for (const [a, b] of h[i]) if (P.hot[i].book.hits(a + s, b + s)) return true;
  return false;
}

/** shift a built offering into place, give its figures pool slots, keep its steps, props, fires and cues */
function commit(P, built, s, meta) {
  const inst = { ...meta, s, id: '', steps: built.steps, tracks: built.tracks, type: built.type || meta.type, species: built.species, title: built.title,
    t0: Infinity, t1: -Infinity, ev: null, cur: -1 };
  if (meta.job) meta.job.inst = inst;
  // book the shared places (computed on the unshifted timelines, before they move)
  hotOf(P, built).forEach((list, i) => { for (const [a, b] of list) P.hot[i].book.push([a + s, b + s]); });
  for (const tr of built.tracks) {
    tr.shift(s);
    tr.inst = inst;
    const [ha, hb] = holdOf(P, tr);
    const i = poolFree(P, tr.pool, ha, hb);
    tr.slot = i;
    if (i >= 0) P.pools[tr.pool][i].push([ha, hb]);
    P.tracks.push(tr);
    inst.t0 = Math.min(inst.t0, tr.t0); inst.t1 = Math.max(inst.t1, tr.t1);
  }
  for (const st of built.steps) { st.t0 += s; st.t1 += s; }
  // when its last step is done (the figures then only walk home): the watchable row ends here
  inst.tEnd = built.steps.reduce((m, st) => Math.max(m, st.t1), -Infinity);
  for (const p of built.props) { p.t0 += s; p.t1 += s; p.inst = inst; P.props.push(p); }
  for (const f of built.fires) { f.t0 += s; f.t1 += s; P.fires.push(f); }
  for (const c of built.cues) { c.t += s; c.inst = inst; P.cues.push(c); }
  inst.id = `offering:${inst.type}:${meta.kind === 'animal' ? `ring${P.G.lanes[meta.lane]?.ringIndex + 1}` : `${meta.kind}${meta.lane + 1}`}:${P.insts.length + 1}`;
  P.insts.push(inst);
  return inst;
}

function finish(P) {
  P.insts.sort((x, y) => x.t0 - y.t0);
  P.insts.forEach((x, i) => { x.order = i; });
  P.cues.sort((x, y) => x.t - y.t);
  P.cueT = Float64Array.from(P.cues, (c) => c.t);
  P.props.sort((x, y) => x.t0 - y.t0);
  // per pool slot: its tracks in time order (the per-frame lookup)
  P.slotTracks = {};
  for (const pool of Object.keys(P.pools)) P.slotTracks[pool] = Array.from({ length: P.pools[pool].length }, () => []);
  for (const tr of P.tracks) if (tr.slot >= 0) P.slotTracks[tr.pool][tr.slot].push(tr);
  for (const pool of Object.keys(P.slotTracks)) for (const list of P.slotTracks[pool]) list.sort((x, y) => x.t0 - y.t0);
  // per-frame keys computed once (no strings built while posing)
  let k = 0;
  for (const tr of P.tracks) {
    for (const sg of tr.segs) {
      sg.pkey = sg.prop2 ? `${sg.prop}|${sg.prop2}` : `${sg.prop || ''}|${sg.hand || 'right'}`;
      // idle variation: who stands a while shifts his gaze a little (a seeded slow sway, a pure function of t) ⚙
      if (sg.kind === 0 && (sg.pose === 'stand' || sg.pose === 'stand_halter' || sg.pose === 'lead') && sg.t1 - sg.t0 > 0.8) {
        k++;
        sg.sway = { amp: sg.pose === 'stand_halter' ? 10 : 7, a: rand(P.seed, 'sa', k) * 6.283, b: rand(P.seed, 'sb', k) * 6.283, p: 0.35 + 0.3 * rand(P.seed, 'sp', k), q: 0.55 + 0.4 * rand(P.seed, 'sq', k) };
      }
    }
  }
  for (const p of P.props) p.key = `${p.at[0]},${p.at[1]},${p.at[2]},${p.h}`;
  P.instT0 = Float64Array.from(P.insts, (x) => x.t0);
  P.maxDur = P.insts.reduce((m, x) => Math.max(m, x.t1 - x.t0), 0);
  P.missing = P.tracks.filter((t) => t.slot < 0).length;
}

// ======================================================================================== builders
function Built(P, type) {
  return { type, tracks: [], steps: [], props: [], fires: [], cues: [], res: {}, lim: {}, r: null };
}
/** a step's minutes from the data (seeded inside its range) */
function minutes(type, id, r, fb = [1, 2]) {
  const st = OFFERING_TYPES[type]?.steps?.find((x) => x.id === id);
  const [lo, hi] = st?.minutes || fb;
  return lo + (hi - lo) * r();
}
function stepData(type, id) { return OFFERING_TYPES[type]?.steps?.find((x) => x.id === id) || null; }
function mark(B, id, t0, t1, o = {}) {
  // a stage the type's data does not list (e.g. a firstling's innards rinsed): the olah's or shelamim's wording
  const sd = stepData(o.type || B.type, o.dataId || id) || stepData('olah', o.dataId || id) || stepData('shelamim', o.dataId || id);
  B.steps.push({ id, label: o.label || sd?.label || id, t0, t1, zone: o.zone || 'azarah', view: o.view, focus: o.focus || null, parent: o.parent || PARENT[id] || 'private-offerings',
    sources: sd?.sources || o.sources || [], note: o.note || null });
}
/** appear at `from` and walk to `to`, arriving at tArr (the track starts walkDur before) */
function arriveAt(G, tr, from, to, tArr, o = {}) {
  const r = G.route(from, to, o);
  const dur = r.path.length / (o.speed || SPEED.kohen) / 60;
  const p0 = typeof from === 'string' ? [G.N[from].X, G.N[from].Y, G.N[from].Z] : from;
  tr.at(tArr - dur, p0, 0);
  tr.walkRoute(r, { speed: o.speed || SPEED.kohen, pose: o.pose || 'walk', prop: o.prop, hand: o.hand, prop2: o.prop2, side: o.side });
  return tr;
}
const add = (p, dx, dy, z) => [p[0] + dx, p[1] + dy, z ?? p[2]];
const headTo = (a, b) => { const h = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI; return h < 0 ? h + 360 : h; };

// ---------------------------------------------------------------------------------------- the animal offerings
/**
 * One animal offering in lane `lane`, at nominal start 0 (the owner appears at the gate's foot). Steps follow
 * OFFERING_TYPES[type].steps: arrive → (seal, done before he came in) → semichah → shechitah → blood (by its rite) →
 * hefshet → hadachah → or (most-holy) → tenufah (lesser) → haalaah → nesachim → achilah / taking out.
 */
function scriptAnimal(P, job, lane) {
  const { G } = P;
  const L = G.lanes[lane];
  const type = job.type, T = OFFERING_TYPES[type];
  const B = Built(P, type);
  B.r = rng(hashStr(`${P.seed}:a:${type}:${job.i}:${job.kayitz ? 'k' : ''}`));   // same draws in every lane
  const r = B.r;
  B.species = job.species;
  const sp = job.species;
  const kk = KK.has(type), kalim = !kk;
  const rite = T.blood?.rite;
  const S = G.S;
  const view = (v) => ({ at: v.at, heading: v.heading });
  const waitSlot = (P.laneRes[lane].n || 0) % 2;
  const owner = job.owner === 'kohen' ? new Track(null, 'O', 'kohen') : new Track(null, 'O', job.owner);
  const A = new Track(null, 'A', sp);
  B.tracks.push(owner, A);

  // ---- arrive: the owner leads his animal in by its gate (Middot 1:4–5 names; Report §7.3), and waits by the ring
  const gateFoot = job.gate === 'bechorot' ? 'BECH_FOOT' : job.gate === 'moked' ? 'MOK_X' : 'KOR_FOOT';
  const gateView = job.gate === 'bechorot' ? G.V.bechorot : job.gate === 'moked' ? G.V.moked : G.V.korban;
  owner.at(0, [G.N[gateFoot].X, G.N[gateFoot].Y, G.N[gateFoot].Z], 0);
  A.at(0, owner.p, 0);
  owner.walk(G, L.hold, { speed: SPEED.lead, pose: 'lead_walk', to: undefined });
  A.follow(owner.lastWalk, 1.0, { lead: 'O' });
  // led up from the city on its rope (courts-daily): at the gate's foot it is a rope's length behind him, not under him
  if (job.gate !== 'moked') A.segs[A.segs.length - 1].extrap = true;
  const tHold = owner.t;
  const tArriveEnd = Math.max(minutes(type, 'arrive', r, [3, 10]), tHold + 0.8);
  owner.hold(tArriveEnd, { pose: 'lead', h: headTo(owner.p, L.ring) });
  A.hold(tArriveEnd, { pose: 'stand_halter', h: headTo(A.p, L.ring), lead: 'O' });
  mark(B, 'arrive', 0, tArriveEnd, { zone: 'slaughter-zone', view: view(gateView), label: job.kayitz ? 'A lamb led from the lambs\' chamber in Beit HaMoked' : undefined,
    note: job.kayitz ? 'Bought from the surplus funds (Shekalim 4:4) — no owner, so no leaning (Rambam MK 3:7)' : null });
  B.res.hold = [tHold - 0.2, tArriveEnd + 0.3];

  // ---- the animal to the ring, facing west; the leaning (Rambam MK 3:13–14: the animal in the north facing west, the
  // leaner east of it facing west, both hands between the horns)
  let t = tArriveEnd;
  const aSemi = [L.ring[0] + 1.15, L.ring[1], 16];
  const headX = aSemi[0] - (sp === 'ram' ? 0.66 : sp === 'goat' || sp === 'she_goat' ? 0.6 : 0.55) / AM;
  const oSemi = [headX + 0.384 / AM, L.ring[1] + 0.32 / AM, 16];
  A.step(aSemi, { pose: 'walk_led', speed: 0.7, lead: 'O' });
  owner.step(oSemi, { pose: 'walk', speed: 0.7 });
  t = Math.max(A.t, owner.t);
  B.res.ring = [t - 0.4, 0];
  const semi = job.semichah && T.semichah?.required;
  if (semi) {
    const dS = minutes(type, 'semichah', r, [1, 3]);
    A.hold(t + dS, { pose: 'stand_halter', h: 270 });
    owner.hold(t + dS, { pose: sp === 'bull' ? 'semichah_high' : 'semichah', h: 230 });
    const words = T.semichah.words;
    B.cues.push({ t: t + 0.35, kind: 'caption', key: 'semichah', pos: L.ring, range: 26,
      text: words === 'viduy'
        ? { en: '"I have sinned, I have done iniquity, I have transgressed… I have returned in repentance before You, and this is my atonement" — leaning with all his strength on his offering (Rambam MK 3:14–15)', he: 'חָטָאתִי עָוִיתִי פָּשַׁעְתִּי… וְחָזַרְתִּי בִּתְשׁוּבָה לְפָנֶיךָ וְזוֹ כַּפָּרָתִי' }
        : { en: 'Leaning on his peace-offering he speaks words of praise — no confession over a shelamim (Rambam MK 3:15)', he: 'דִּבְרֵי שֶׁבַח' } });
    mark(B, 'semichah', t, t + dS, { zone: 'slaughter-zone', view: view(L.view), label: OFFERING_TYPES[type].steps.find((s) => s.id === 'semichah')?.label });
    t += dS;
  } else {
    A.hold(t + 0.25, { pose: 'stand_halter', h: 270, lead: 'O' });
    owner.hold(t + 0.25, { pose: 'lead', h: 250 });
    t += 0.25;
  }

  // ---- the kohanim come from Beit HaMoked to the ring: the receiver (kabbalah) and the one who holds the legs
  const K1 = new Track(null, 'K1', 'kohen'), K2 = new Track(null, 'K2', 'kohen');
  B.tracks.push(K1, K2);
  const bound = L.bound;
  const pRecv = add(bound, 1.7, -2.2), pHold = add(bound, 1.1, 1.6), pSlay = add(bound, 2.1, -0.6);
  arriveAt(G, K1, 'MOK_X', add(pRecv, 0.6, 0.4), t - 0.6 - r() * 0.5);
  arriveAt(G, K2, 'MOK_X', add(pHold, 0.8, 0.9), t - 0.5 - r() * 0.6);
  // the ring is this offering's from when its kohanim come to wait by it (the last one's carcass is lifted by then)
  B.res.ring[0] = Math.min(B.res.ring[0], Math.min(K1.t, K2.t) - 0.15);
  K1.hold(t, { pose: 'stand', h: headTo(K1.p, bound), prop: 'mizrak_silver' });
  K2.hold(t, { pose: 'stand', h: headTo(K2.p, bound) });

  // ---- shechitah: laid down and held as an akedah, head south and face west, the shochet east of it (Tamid 4:1), the
  // blood received in a silver mizrak (Zevachim 5:1–7)
  const tBind = t;
  A.step(bound, { pose: 'struggle', speed: 0.5, minDur: 0.18, ph: null });
  K2.step(pHold, { pose: 'walk', speed: 0.7 });
  K1.step(pRecv, { pose: 'walk', speed: 0.7, prop: 'mizrak_silver' });
  const slayer = owner;
  slayer.step(pSlay, { pose: 'walk', speed: 0.7 });
  t = Math.max(A.t, K2.t, K1.t, slayer.t);
  const dSh = minutes(type, 'shechitah', r, [0.5, 1.5]);
  const tShEnd = t + dSh;
  A.hold(tShEnd, { pose: 'bound', h: 180 });
  K2.hold(tShEnd, { pose: 'hold_legs', h: 200 });
  K1.hold(tShEnd, { pose: 'receive', h: 300, prop: 'mizrak_silver' });
  slayer.hold(tShEnd, { pose: 'slaughter', h: 270, prop: 'knife' });
  B.cues.push({ t: tBind + 0.05, kind: 'sound', id: 'sheep', pos: bound, opts: { kind: sp === 'ram' ? 'ram' : 'lamb' } });
  mark(B, 'shechitah', tBind, tShEnd, { zone: 'slaughter-zone', view: view(L.view) });
  B.lim.slaughter = tShEnd;

  // ---- the owner after the slaughter
  if (job.owner === 'kohen') owner.walk(G, 'MOK_X', { speed: SPEED.kohen });
  else if (kk || job.set === 'yoledet') owner.walk(G, job.gate === 'bechorot' ? 'BECH_FOOT' : 'KOR_FOOT', { speed: SPEED.owner });
  // where they wait: two places per lane, taken in turn by the lane's offerings (a lane's next owner may arrive
  // before the last one has his meat) ⚙
  else if (type === 'bechor') owner.walk(G, [240.4 + (lane % 2) * 1.3, L.ring[1] + 3.0 - waitSlot * 1.4, 16], { speed: SPEED.owner });  // the kohen who brought it waits in the Ezrat Kohanim
  else owner.walk(G, add(L.eyWait, 0, -1.5 * waitSlot), { speed: SPEED.owner });   // a lesser offering's owner steps back into Ezrat Yisrael

  // ---- the blood (K1)
  t = tShEnd;
  K1.step(add(pRecv, 0.4, 0.8), { pose: 'walk', speed: 0.8, prop: 'mizrak_silver' });
  if (rite === 'four-horns') {
    // up the kevesh, right onto the sovev, the horns SE → NE → NW → SW, with the finger; round again and down to the
    // southern yesod for the remainder (Zevachim 5:3; Rambam MK 5:7–10)
    const t0 = K1.t;
    K1.walk(G, 'KE_RS', { speed: SPEED.kohen, prop: 'mizrak_silver', hand: 'left', to: 'KE_RS' });
    mark(B, 'holachah', t0, K1.t, { zone: 'kevesh', view: view(G.V.ramp) });
    const tM = K1.t;
    K1.walk(G, 'RS_2', { speed: 1.0, prop: 'mizrak_silver', hand: 'left' });
    for (const [hn, node] of [['hornSE', 'SV_SE'], ['hornNE', 'SV_NE'], ['hornNW', 'SV_NW'], ['hornSW', 'SV_SW']]) {
      K1.walk(G, node, { speed: 1.05, prop: 'mizrak_silver', hand: 'left' });
      K1.holdFor(0.14, { pose: 'sprinkle', h: S[hn].heading ?? 0, prop: 'mizrak_silver', hand: 'left' });
    }
    K1.walk(G, 'SV_SE', { speed: 1.1, prop: 'mizrak_silver', hand: 'left', route: sovevBack(G) });
    K1.walk(G, 'RS_1', { speed: 1.0, prop: 'mizrak_silver', hand: 'left' });
    K1.walk(G, 'KE_RS', { speed: 1.0, prop: 'mizrak_silver', hand: 'left' });
    K1.walk(G, 'RY_Y', { speed: 1.0, prop: 'mizrak_silver', hand: 'left', route: G.route('KE_RS', 'RY_Y', { from: 'KE_RS', to: 'RY_Y' }) });
    K1.holdFor(0.16, { pose: 'pour', ph: one(), h: 0, prop: 'mizrak_silver' });
    const dM = minutes(type, 'matanot', r, [3, 6]);
    if (K1.t < tM + dM) K1.hold(tM + dM, { pose: 'stand', h: 0, prop: 'mizrak_silver' });
    mark(B, 'matanot', tM, K1.t, { zone: 'mizbeach', view: view(G.V.sovev) });
    K1.walk(G, 'MOK_X', { speed: SPEED.kohen, route: G.route('RY_Y', 'MOK_X', { from: 'RY_Y' }) });
  } else if (rite === 'one') {
    // one pouring against the yesod (Zevachim 5:8; Rambam MK 5:17)
    const t0 = K1.t;
    K1.walk(G, S.altarNE.pos, { speed: SPEED.kohen, prop: 'mizrak_silver' });
    mark(B, 'holachah', t0, K1.t, { zone: 'mizbeach', view: view(G.V.ne) });
    const tM = K1.t;
    K1.holdFor(Math.max(0.2, minutes(type, 'matanah-achat', r, [0.5, 1]) - 0.05), { pose: 'pour', ph: one(0.05, 0.25), h: S.altarNE.heading, prop: 'mizrak_silver' });
    mark(B, 'matanah-achat', tM, K1.t, { zone: 'mizbeach', view: view(G.V.ne) });
    K1.walk(G, 'MOK_X', { speed: SPEED.kohen });
  } else {
    // two that are four: thrown from the vessel at the NE corner, then the SW, below the line; the rest on the southern
    // yesod (Zevachim 5:4–7; Tamid 4:1; Kinnim 1:1; Rambam MK 5:6)
    const t0 = K1.t;
    K1.walk(G, S.altarNE.pos, { speed: SPEED.kohen, prop: 'mizrak_silver' });
    mark(B, 'holachah', t0, K1.t, { zone: 'mizbeach', view: view(G.V.ne) });
    const tZ = K1.t;
    K1.holdFor(0.12, { pose: 'throw', ph: one(), h: S.altarNE.heading, prop: 'mizrak_silver' });
    // the SW from the point of the corner (a place one figure holds at a time — P.hot); he leaves it at once
    K1.walk(G, S.swPoint.pos, { speed: SPEED.kohen, prop: 'mizrak_silver' });
    K1.holdFor(0.12, { pose: 'throw', ph: one(), h: S.swPoint.heading, prop: 'mizrak_silver' });
    K1.holdFor(0.14, { pose: 'pour', ph: one(), h: S.swPoint.heading, prop: 'mizrak_silver' });
    const dZ = minutes(type, 'zerikah', r, [0.5, 1.5]);
    mark(B, 'zerikah', tZ, Math.max(K1.t, tZ + Math.min(dZ, 1)), { zone: 'mizbeach', view: view(G.V.sw) });
    K1.walk(G, 'MOK_X', { speed: SPEED.kohen });
  }
  const tBloodEnd = Math.max(...B.steps.filter((s) => PARENT[s.id] === 'altar-blood').map((s) => s.t1));
  B.lim.blood = tBloodEnd;

  // ---- hefshet: after the blood (Rambam MK 5:18) the carcass is carried to its hook, hung by a hind leg pierced at the
  // hock (Tamid 4:2) and flayed; an olah cut into its limbs, the others' fats taken out
  K2.hold(tShEnd + 0.1, { pose: 'hold_legs', h: 200 });
  K2.hold(Math.max(K2.t, tBloodEnd), { pose: 'stand', h: 200 });
  K2.step(add(bound, 0.9, 0.2), { pose: 'walk', speed: 0.7 });
  K2.holdFor(0.12, { pose: 'kneel', ph: fix(0.32), h: 270 });
  const tLift = K2.t;
  A.hold(tLift, { pose: 'bound', h: 180 });
  const CC = carcassOf(sp);
  if (CC.slain) {
    // the slain animal lifted into his arms, its back against him, the head hanging (people's *_slain in carry_lamb: the
    // cut across the throat, the coat dark with blood about it), carried to the hook; the live figure gone as he lifts it
    K2.holdFor(0.05, { pose: 'carry_lamb', h: 270, prop: CC.slain });
    K2.walk(G, L.flayer, { speed: SPEED.carry, pose: 'carry_lamb_walk', prop: CC.slain });
  } else {
    // a ram is too heavy to carry so (people-4): the bound animal itself is borne in his arms ⚙
    K2.walk(G, L.flayer, { speed: SPEED.carry, pose: 'carry_walk' });
    A.carried(K2.lastWalk, { up: 0.74, hOff: -90, fwd: 0.36, side: 0 });
  }
  const tHang = K2.t;
  B.res.ring[1] = tLift + 0.1;
  const tFlay0 = K2.t;
  const dF = minutes(type, 'hefshet', r, sp === 'bull' ? [25, 45] : [10, 20]);
  K2.hold(tFlay0 + dF, { pose: 'flay', h: 0, prop: 'knife_flay' });
  const hook = sp === 'ram' ? L.hookRam : L.hook;
  // the hung stages by kind (people-4): hung by the hock in its fleece or hair, the hide peeled to the breast (the head
  // cut off there), dressed — a goat in its own black hair, a ram with its horns
  const tFlayed = tFlay0 + 0.72 * dF;
  B.props.push({ kind: 'hung', lane, name: CC.hung, t0: tHang, t1: tFlay0 + 0.14 * dF, at: hook, h: 180 });
  B.props.push({ kind: 'hung', lane, name: CC.flaying, t0: tFlay0 + 0.14 * dF, t1: tFlay0 + 0.72 * dF, at: hook, h: 180 });
  const hungFinal = { kind: 'hung', lane, name: CC.dressed, t0: tFlayed, t1: NaN, at: hook, h: 180 };
  B.props.push(hungFinal);
  mark(B, 'hefshet', tLift, tFlay0 + dF, { zone: 'slaughter-zone', view: view(L.flayView),
    label: type === 'olah' ? 'Hung, flayed and cut into its limbs' : 'Hung and flayed; the fats taken out' });
  B.res.hook = [tHang - 0.1, 0];
  B.lim.flay = tLift;

  // ---- hadachah: the intestines rinsed on the marble table, the stomach in Lishkat HaMedichin (Tamid 4:2)
  const tR0 = K2.t;
  const dR = minutes(type, 'hadachah', r, [5, 12]);
  K2.step(L.tableStand, { pose: 'carry_walk', speed: 0.8, prop: 'entrails_bazach' });
  K2.holdFor(Math.max(0.6, dR * 0.35), { pose: 'flay', h: 180 });
  K2.walk(G, S.medSpot[lane], { speed: SPEED.kohen, pose: 'carry_walk', prop: 'entrails_bazach' });
  K2.holdFor(Math.max(0.4, dR * 0.2), { pose: 'carry', h: S.medFace?.[lane] ?? 180, prop: 'entrails_bazach' });
  K2.walk(G, L.tableStand, { speed: SPEED.kohen, pose: 'carry_walk', prop: 'entrails_bazach' });
  if (K2.t < tR0 + dR) K2.hold(tR0 + dR, { pose: 'flay', h: 180 });
  else K2.holdFor(0.15, { pose: 'carry', h: 180, prop: 'entrails_bazach' });
  mark(B, 'hadachah', tR0, K2.t, { zone: 'slaughter-zone', view: view(L.flayView) });
  B.res.table = [tR0, 0];
  t = K2.t;

  // ---- or: the hide of a most-holy offering to the Parvah to be salted (Middot 5:3; Zevachim 12:3)
  let tHideEnd = t;
  if (kk) {
    const tO = t;
    K2.step(L.flayer, { pose: 'walk', speed: 0.8 });
    K2.holdFor(0.12, { pose: 'flay', h: 0 });
    K2.walk(G, S.parSpot[lane], { speed: SPEED.carry, pose: 'carry_shoulder_walk', prop: CC.hide });
    K2.holdFor(0.35, { pose: 'carry_shoulder', h: 180, prop: CC.hide });
    tHideEnd = Math.max(K2.t, tO + minutes(type, 'or', r, [3, 6]) * 0.6);
    if (K2.t < tHideEnd) K2.hold(tHideEnd, { pose: 'stand', h: 180 });
    mark(B, 'or', tO, tHideEnd, { zone: 'parvah', view: view(G.V.south) });
    K2.walk(G, 'MOK_X', { speed: SPEED.kohen });
    t = tO + 0.25;     // the carry-up may start while he walks to the Parvah
  }

  // ---- tenufah (shelamim, todah): the parts on the owner's palms, the kohen's hands beneath them, east of the altar
  // (Menachot 5:6, 61b; Rambam MK 9:6–8): the owner faces west in 'wave', the kohen faces him in people's wave_under,
  // ONE phase for both from the waving's start and both at scale 1, WAVE_UNDER.partner apart (S.wave; people-4-fix).
  // Each comes to his place from his own side
  const K3 = new Track(null, 'K3', 'kohen');
  B.tracks.push(K3);
  const WV = S.wave[lane];
  if (type === 'shelamim' || type === 'todah') {
    const tT0 = t;
    arriveAt(G, K3, 'MOK_X', add(L.tableStand, 0.4, 1.3), tT0);
    K3.holdFor(0.25, { pose: 'carry', h: 180, prop: 'limb_chazeh' });
    K3.walk(G, WV.kohenIn, { speed: SPEED.carry, pose: 'carry_walk', prop: 'limb_chazeh' });
    K3.step(WV.kohen, { pose: 'carry_walk', speed: 0.8, prop: 'limb_chazeh' });
    const tW = K3.t + 0.1;
    const oWalk = walkMin(G, owner.p, WV.ownerIn, SPEED.owner, { to: 'E_M' }) + 0.05;
    owner.hold(Math.max(owner.t, tW - oWalk), { pose: 'stand', h: 270 });
    owner.walk(G, WV.ownerIn, { speed: SPEED.owner, to: 'E_M' });
    owner.step(WV.owner, { pose: 'walk', speed: 0.8 });
    const tW2 = Math.max(tW, owner.t);
    K3.hold(tW2, { pose: 'carry', h: 90, prop: 'limb_chazeh' });
    owner.hold(tW2, { pose: 'stand', h: 270 });
    const dT = minutes(type, 'tenufah', r, [2, 4]);
    owner.scale = 1; K3.scale = 1;
    owner.hold(tW2 + dT, { pose: 'wave', h: 270, prop: 'limb_chazeh', prop2: type === 'todah' ? 'chavitin' : 'limb', ph: cyc(WAVE_P, 0) });
    K3.hold(tW2 + dT, { pose: 'wave_under', h: 90, ph: cyc(WAVE_P, 0) });
    mark(B, 'tenufah', tT0, tW2 + dT, { zone: 'ezrat-kohanim', view: view(G.V.tenufah) });
    B.lim.tenufah = tW2;
    // the portions back to the kohen; he goes to the ramp by his own side
    K3.holdFor(0.15, { pose: 'carry', h: 90, prop: 'limb_chazeh' });
    K3.step(WV.kohenIn, { pose: 'carry_walk', speed: 0.8, prop: 'limb_chazeh' });
    t = tW2 + dT;
  }

  // ---- haalaah: salted on the ramp and carried up to the great pile, thrown on the fire; up on the east, round to the
  // right, down on the west (Rambam MK 6:4; Yoma 2:5–7; Zevachim 6:3)
  const tH0 = t;
  if (type === 'olah') {
    // a lamb's or kid's limbs by six (Rambam MK 6:17, from Yoma 2:5–7); a ram's meat by five and its innards by two
    // (Yoma 2:7)
    const pairs = sp === 'ram'
      ? [['limb_head', 'limb'], ['limb_foreleg', 'limb_foreleg'], ['limb_oketz', 'limb'], ['limb_chazeh', 'limb_gerah'], ['limb_dofen', 'limb_dofen'], ['entrails_bazach', null], ['entrails_bazach', null]]
      : [['limb_head', 'limb'], ['limb_foreleg', 'limb_foreleg'], ['limb_oketz', 'limb'], ['limb_chazeh', 'limb_gerah'], ['limb_dofen', 'limb_dofen'], ['entrails_bazach', null]];
    const n = pairs.length;
    const C = pairs.map((_, k) => new Track(null, `C${k}`, 'kohen'));
    B.tracks.push(...C);
    // round their own table, within its width, clear of the next lane's (tables 4 amot apart) ⚙
    // (the first to go wait in the back row, by the way out, and come last: track.js tableOrder)
    const spots = pairs.map((_, k) => { const j = tableOrder(n, k).spot; return add(L.tableStand, (j % 4 - 1.5) * 0.98, 0.2 + Math.floor(j / 4) * 1.25); });
    C.forEach((c, k) => arriveAt(G, c, 'MOK_X', spots[k], tH0 + 0.1 + 0.04 * tableOrder(n, k).arrive));
    const tPick = tH0 + 0.12 * n * 0.25 + 0.2;
    hungFinal.t1 = tH0 + 0.1;
    let tGo = -Infinity;
    C.forEach((c, k) => {
      const [pr, pl] = pairs[k];
      c.hold(Math.max(c.t, tH0), { pose: 'stand', h: 180 });
      c.holdFor(0.18, { pose: pl ? 'carry_limbs' : 'carry', h: 180, prop: pr, prop2: pl });
      // each goes once he has his limbs and 0.05 after the one before him (the first to go came last: never two at once)
      tGo = Math.max(c.t, tGo + 0.05, tPick + 0.05 * k);
      c.hold(tGo, { pose: pl ? 'carry_limbs' : 'carry', h: 180, prop: pr, prop2: pl });
    });
    // to the lower west half of the ramp, where a kohen salts them (Rambam MK 6:4; Tamid 4:3)
    // the salter stands west of the limbs, a step east of the way down the west half ⚙
    const saltAt = [214.1, 280.8, G.kevZ(280.8)], salter = new Track(null, 'S', 'kohen');
    B.tracks.push(salter);
    // the first to come goes to the farthest place (up the ramp, east), so nobody walks through a carrier already
    // standing; they go up again in the same order, and on the altar the first goes farthest along the pile
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
    mark(B, 'haalaah', tH0, tSalt + 0.9, { zone: 'kevesh', view: view(G.V.westRamp), label: 'Brought to the ramp and salted' });
    // up the east half, along the east face of the great pile, thrown on together; round to the right and down the west
    const pile = (k) => [S.pileFaceX, S.pileY[0] + ((S.pileY[1] - S.pileY[0]) * k) / Math.max(1, n - 1), 25];
    let tTop = 0;
    C.forEach((c, k) => {
      const [pr, pl] = pairs[k];
      c.hold(tSalt + 0.9 + 0.05 * k, { pose: pl ? 'carry_limbs' : 'carry', h: 0, prop: pr, prop2: pl });
      c.step([220.6, c.p[1] + 1.2, G.kevZ(c.p[1] + 1.2)], { pose: pl ? 'carry_limbs_walk' : 'carry_walk', prop: pr, prop2: pl, speed: 0.9 });
      c.walk(G, pile(n - 1 - k), { speed: SPEED.carry, pose: pl ? 'carry_limbs_walk' : 'carry_walk', prop: pr, prop2: pl, from: 'KE_MID', to: 'TP_SE' });
      tTop = Math.max(tTop, c.t);
    });
    C.forEach((c, k) => {
      const [pr, pl] = pairs[k];
      // thrown on one after another, a second or two apart, not in lockstep ⚙
      c.hold(tTop + 0.04 + 0.022 * k + 0.012 * r(), { pose: pl ? 'carry_limbs' : 'carry', h: 270, prop: pr, prop2: pl });
      c.holdFor(0.1, { pose: pl ? 'toss' : 'throw', ph: one(), h: 270, prop: pr, prop2: pl });
      c.hold(tTop + 0.04 + 0.022 * n + 0.13 + 0.04 * k, { pose: 'stand', h: 270 });       // the farthest goes on first
      c.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'TP_NE' });
    });
    const tThrown = tTop + 0.04 + 0.022 * n + 0.13;
    mark(B, 'haalaah', tSalt + 0.9, tThrown, { zone: 'mizbeach', view: view(G.V.top), dataId: 'haalaah' });
    t = tThrown;
  } else {
    // the eimurim by one kohen (the data's carryUp(1)): in a bowl to the lower west half of the ramp, where he salts
    // them like the limbs (Rambam MK 6:4; Vayikra 2:13 — every part burned is salted): the bowl set down, salt from the
    // salt there, taken up again; then up the east half and thrown on the fire. One place per lane, north of the
    // olah's limbs ⚙
    const Ke = K3;
    if (!(type === 'shelamim' || type === 'todah')) {
      arriveAt(G, Ke, 'MOK_X', add(L.tableStand, 0.4, 1.3), tH0 + 0.1);
      Ke.holdFor(0.2, { pose: 'carry', h: 180, prop: CC.eimurim });
    }
    const t0 = Ke.t;
    // one place, north of the olah's limbs, kept by one kohen at a time (P.hot 'salt')
    const sy = S.saltE[1], saltE = S.saltE;
    Ke.walk(G, saltE, { speed: SPEED.carry, pose: 'carry_walk', prop: CC.eimurim, to: 'K_FW' });
    Ke.holdFor(0.08, { pose: 'kneel', ph: fix(0.3), h: 90, prop: CC.eimurim });
    Ke.holdFor(0.3 + 0.1 * r(), { pose: 'salt', h: 90, prop: 'salt', hand: 'left' });
    Ke.holdFor(0.08, { pose: 'kneel', ph: fix(0.3), h: 90 });
    mark(B, 'haalaah', t0, Ke.t, { zone: 'kevesh', view: view(G.V.westRamp), label: 'The eimurim brought to the ramp and salted' });
    const tUp = Ke.t;
    Ke.step([220.6 - (lane % 2) * 0.9, sy + 1.2, G.kevZ(sy + 1.2)], { pose: 'carry_walk', prop: CC.eimurim, speed: 0.9 });
    Ke.walk(G, [S.pileFaceX, 321.5 + (lane - 2.5) * 1.1, 25], { speed: SPEED.carry, pose: 'carry_walk', prop: CC.eimurim, from: 'KE_MID', to: 'TP_SE' });
    Ke.holdFor(0.1, { pose: 'throw', ph: one(), h: 270, prop: CC.eimurim });
    const tToss = Ke.t;
    const dH = minutes(type, 'haalaah', r, [4, 8]);
    mark(B, 'haalaah', tUp, Math.max(tToss, t0 + Math.min(dH, 3.5)), { zone: 'mizbeach', view: view(G.V.ramp), dataId: 'haalaah' });
    if (kk) {
      // the most-holy meat to the kohanim's cooking place in the court (Zevachim 5:3, 11:4), set down where the
      // portions are left for the meal (one at a time: P.hot), reached from the south past the hearth
      Ke.walk(G, L.flayer, { speed: SPEED.kohen, from: 'TP_NE' });
      const tTake = Ke.t;
      hungFinal.t1 = tTake + 0.1;
      Ke.holdFor(0.15, { pose: 'flay', h: 0 });
      Ke.walk(G, S.drop.pos, { speed: SPEED.carry, pose: 'carry_shoulder_walk', prop: 'lamb_carcass', to: 'E_K' });
      Ke.holdFor(0.4, { pose: 'carry_shoulder', h: S.drop.heading, prop: 'lamb_carcass' });
      mark(B, 'achilah', tTake, Ke.t, { zone: 'ezrat-kohanim', view: view(G.V.kitchen), dataId: 'achilah',
        parent: P.parents?.has('kodashim-meal') ? 'kodashim-meal' : 'private-flaying', label: 'The meat to the kohanim\'s cooking place, to be eaten in the court' });
      Ke.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'E_K' });
      t = Ke.t;
    } else {
      Ke.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'TP_NE' });
      t = tToss + 0.1;
    }
    if (!Number.isFinite(hungFinal.t1)) hungFinal.t1 = NaN;
  }

  // ---- nesachim: the flour and oil burned whole on the pile, the wine poured into the cup at the SW horn — the wine
  // man goes up on the left and back on his heel (Menachot 9:6; Zevachim 6:2–3)
  if (T.nesachim && !/^none/.test(T.nesachim) && type !== 'chatat' && type !== 'asham') {
    const ns = NESACHIM[sp === 'goat' ? 'kid' : sp] || NESACHIM.lamb;
    const two = sp === 'ram';
    const N1 = [new Track(null, 'N1', 'kohen')], N2 = [new Track(null, 'N2', 'kohen')];
    if (two) { N1.push(new Track(null, 'N1b', 'kohen')); N2.push(new Track(null, 'N2b', 'kohen')); }
    B.tracks.push(...N1, ...N2);
    const tN0 = t + 0.3;
    const st = S.tableSilver.pos;
    const nsSpot = [[207.3, 279.9], [208.0, 281.2], [207.3, 282.5], [208.0, 283.6]];
    [...N1, ...N2].forEach((k, i) => arriveAt(G, k, 'MOK_X', [nsSpot[i][0], nsSpot[i][1], 16], tN0 + 0.05 * i, { to: 'K_FW' }));
    let tEnd = tN0;
    // a ram's are borne by two and two (Yoma 2:7). Each pair keeps the order the limbs keep: the one whose place is
    // farther in goes up first, the other GAP behind him, and the farther one comes away first, so neither walks
    // through the other while he throws or pours ⚙
    const GAP = 0.12;
    // the flour: up by TP_SE along the pile's east face, so the northern place (N1b) is the farther; off by TP_NE
    let tUp = -Infinity, tOff = -Infinity;
    for (let i = N1.length - 1; i >= 0; i--) {
      const k = N1[i];
      k.holdFor(0.2, { pose: 'carry', h: 270, prop: 'solet' });
      tUp = Math.max(k.t, tUp + GAP);
      k.hold(tUp, { pose: 'carry', h: 270, prop: 'solet' });
      k.walk(G, 'K_FE', { speed: SPEED.carry, pose: 'carry_walk', prop: 'solet' });
      k.walk(G, [S.pileFaceX, 322.5 + i * 1.1 + (lane - 2.5) * 0.5, 25], { speed: SPEED.carry, pose: 'carry_walk', prop: 'solet', from: 'K_FE', to: 'TP_SE' });
      k.holdFor(0.1, { pose: 'toss', ph: one(), h: 270, prop: 'solet' });
      tEnd = Math.max(tEnd, k.t);
      k.hold(Math.max(k.t, tOff + 0.06), { pose: 'stand', h: 270 });
      tOff = k.t;
      k.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'TP_NE' });
    }
    // the wine: along the top's south edge westward to the cups, so the western place (N2) is the farther
    tUp = -Infinity; tOff = -Infinity;
    const ups = N2.map((k, i) => {
      k.holdFor(0.2, { pose: 'carry', h: 270, prop: 'wine_jug' });
      tUp = Math.max(k.t, tUp + GAP);
      k.hold(tUp, { pose: 'carry', h: 270, prop: 'wine_jug' });
      const up = wineRoute(G, k.p, i);
      k.walkRoute(up, { speed: SPEED.carry, pose: 'carry_walk', prop: 'wine_jug' });
      k.holdFor(0.16, { pose: 'pour', ph: one(0.02, 0.15), h: G.S.cups.heading ?? 180, prop: 'wine_jug' });
      tEnd = Math.max(tEnd, k.t);
      return up;
    });
    for (let i = N2.length - 1; i >= 0; i--) {
      const k = N2[i];
      k.hold(Math.max(k.t, tOff + 0.08), { pose: 'stand', h: G.S.cups.heading ?? 180, prop: 'wine_jug' });
      tOff = k.t;
      k.walkRoute(reverseRoute(ups[i]), { speed: SPEED.kohen });
      k.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'K_FW' });
    }
    B.cues.push({ t: tEnd - 0.12, kind: 'caption', key: 'nesachim', pos: G.S.cups.pos, range: 30,
      text: { en: `The wine of its libation — ${ns.wine} log — poured into the silver cup at the south-west horn (Menachot 9:6; Zevachim 6:2)`, he: 'נִסּוּךְ הַיַּיִן' } });
    mark(B, 'nesachim', tN0, tEnd, { zone: 'mizbeach', view: view(G.V.top), label: `Its meal-offering (${ns.solet} isaron with ${ns.oil} log oil) burned and its wine (${ns.wine} log) poured at the SW horn` });
    t = tEnd;
  }

  // ---- taking out: a lesser offering's meat carried out to be eaten in Jerusalem (Zevachim 5:6–8; Kelim 1:8)
  if (kalim) {
    const tK0 = t + 0.1;
    // the kohen who flayed it brings the meat; the owner takes it on his shoulder (breast and thigh stay with the kohanim)
    K2.hold(Math.max(K2.t, tK0), { pose: 'stand', h: 180 });
    K2.step(L.flayer, { pose: 'walk', speed: 0.8 });
    const tTake = K2.t;
    hungFinal.t1 = tTake + 0.12;
    K2.holdFor(0.15, { pose: 'flay', h: 0 });
    let meet;
    const waved = type === 'shelamim' || type === 'todah';
    // the waving owner is handed his meat where he stands, by a kohen come down the east side (S.wave)
    if (waved) meet = [WV.owner[0] + 1.3, WV.owner[1], 16];
    else if (type === 'bechor') meet = add(owner.p, -1.2, 0, 16);
    else meet = [241.7, L.ring[1] + 0.5, 16];          // on the pavement by the duchan (X 242: its step — qa-r2 floors)
    K2.walk(G, meet, { speed: SPEED.carry, pose: 'carry_shoulder_walk', prop: 'lamb_carcass', to: waved ? 'E_M' : undefined });
    const tMeet = K2.t;
    if (type === 'maaser') { owner.hold(Math.max(owner.t, tMeet - 0.4), { pose: 'stand', h: 270 }); owner.step([243.7, L.ring[1] + 0.5, 14.5], { pose: 'walk', speed: 0.6 }); }
    owner.hold(Math.max(owner.t, tMeet), { pose: 'stand', h: headTo(owner.p, meet) });
    K2.holdFor(0.18, { pose: 'carry_shoulder', h: headTo(meet, owner.p), prop: 'lamb_carcass' });
    owner.hold(K2.t, { pose: 'stand', h: headTo(owner.p, meet) });
    K2.walk(G, 'MOK_X', { speed: SPEED.kohen, from: waved ? 'E_M' : undefined });
    const exit = type === 'bechor' ? 'BECH_FOOT' : 'CHEL_FOOT';
    const tOut = owner.t;
    if (waved) {
      // out by his own side once the kohen has gone
      owner.holdFor(0.08, { pose: 'carry_shoulder', h: 90, prop: 'lamb_carcass' });
      owner.step(WV.ownerIn, { pose: 'carry_shoulder_walk', speed: 0.9, prop: 'lamb_carcass' });
    }
    owner.walk(G, exit, { speed: SPEED.carry, pose: 'carry_shoulder_walk', prop: 'lamb_carcass', from: waved ? 'E_M' : undefined });
    mark(B, 'takeout', tK0, Math.min(owner.t, tOut + 2.5), { zone: type === 'bechor' ? 'azarah' : 'ezrat-yisrael', view: view(type === 'bechor' ? G.V.bechorot : G.V.nikanor), dataId: 'achilah', parent: (type === 'shelamim' || type === 'todah') ? 'tenufah' : 'private-offerings',
      label: type === 'bechor' ? 'The kohen carries the firstling\'s meat out, to eat it in Jerusalem with his household' : 'The owner carries the meat out, to eat it in Jerusalem' });
    t = Math.min(owner.t, tOut + 2.5);
  }
  if (!Number.isFinite(hungFinal.t1)) hungFinal.t1 = tHideEnd + 0.5;
  B.res.hook[1] = hungFinal.t1 + 0.1;
  B.res.table[1] = Math.max(B.res.table[0] + 1, hungFinal.t1);
  B.lim.limbs = B.steps.find((s) => s.id === 'haalaah')?.t0 ?? 0;
  B.lim.end = Math.max(...B.steps.filter((s) => PARENT[s.id] !== 'tenufah' || s.id === 'tenufah').map((s) => s.t1));
  // every figure leaves within the window's lag
  B.title = titleOf(type, sp, job);
  B.tracks = B.tracks.filter((tr) => tr.segs.length);
  return B;
}

function walkMin(G, a, b, speed, o) { return G.route(a, b, o).path.length / speed / 60; }

/** the sovev back from the SW horn round to the SE (the way off it is the small ramp at the SE) */
function sovevBack(G) {
  const pts = ['SV_SW', 'SV_NW', 'SV_NE', 'SV_SE'].map((k) => [G.N[k].X, G.N[k].Y, G.N[k].Z]);
  const path = new SitePath(pts);
  return { path, near: new Uint8Array(pts.length), length: path.length };
}
/** the wine: from the silver table up the WEST half of the kevesh straight to the cups at the SW horn (Zevachim 6:3) */
function wineRoute(G, from, i) {
  const c = G.S.cups.pos;
  // (round the kevesh's south-west corner (X 209, Y 275.5) from the waiting places west of it, not across it — qa-r2
  // floors: the straight leg went through the ramp)
  const kb = G.kevesh || { min: [209, 275.5] };
  const pts = [from, [kb.min[0] - 0.7, kb.min[1] - 0.5, 16], [G.N.K_FW.X - 0.5, G.N.K_FW.Y, 16], [211.0 + i * 0.8, 283.5, G.kevZ(283.5)], [211.0 + i * 0.8, 305.5, G.kevZ(305.5)],
    [210.5, 307.4, 25], [c[0] + 0.4 + i * 0.9, c[1] + 0.2, 25]];
  const path = new SitePath(pts);
  return { path, near: Uint8Array.from([0, 0, 0, 0, 1, 1, 1]), length: path.length };
}
function reverseRoute(r) {
  const pts = [...r.path.points].reverse().map((p) => [p.X, p.Y, p.Z]);
  const path = new SitePath(pts);
  return { path, near: Uint8Array.from([...r.near].reverse()), length: path.length };
}

function titleOf(type, sp, job) {
  const T = OFFERING_TYPES[type];
  const animal = { lamb: type === 'chatat' ? 'a ewe lamb' : 'a lamb', ram: 'a ram', goat: type === 'chatat' ? 'a she-goat' : 'a kid', bull: 'a bull' }[sp] || 'an animal';
  if (job?.kayitz) return { en: `Kayitz hamizbeach — an olah of ${animal} from the surplus funds`, he: 'קיץ המזבח — עולה' };
  if (job?.set === 'yoledet') return { en: `A mother's burnt-offering — ${animal} (she does not lean)`, he: 'עולת יולדת' };
  const short = { olah: 'An olah (burnt-offering)', chatat: 'A chatat (sin-offering)', asham: 'An asham (guilt-offering)', shelamim: 'Shelamim (a peace-offering)',
    todah: 'A todah (thanksgiving shelamim)', bechor: 'A bechor (firstling)', maaser: 'Ma\'aser behemah (animal tithe)' }[type] || T.names.en;
  return { en: `${short} — ${animal}`, he: T.names.he };
}

// ---------------------------------------------------------------------------------------- birds
/**
 * A pair (the chatat bird first, even before an olah: Zevachim 90a) or a single bird. The kohen takes the birds at
 * Sha'ar Nikanor; the chatat is nipped below the line at the SW corner, its blood sprinkled on the wall and the rest
 * squeezed onto the yesod (Zevachim 6:4); the olah on the sovev at the SE horn, its blood drained on the wall, head and
 * body salted and thrown onto the fire, crop and feathers to the ash place (Zevachim 6:5).
 */
function scriptBird(P, job, lane) {
  const { G } = P;
  const S = G.S;
  const type = job.kind === 'olah' ? 'olat-haof' : 'chatat-haof';
  const B = Built(P, type);
  B.r = rng(hashStr(`${P.seed}:b:${job.set}:${job.i}`));
  const r = B.r;
  B.species = r() < 0.5 ? 'turtledove' : 'pigeon';
  const cage = B.species === 'pigeon' ? 'bird_cage_pigeons' : 'bird_cage';
  const K = new Track(null, 'KB', 'kohen');
  B.tracks.push(K);
  const view = (v) => ({ at: v.at, heading: v.heading });
  const gate = [G.N.NIK_W.X - 1.0, G.N.NIK_W.Y + (lane - 1) * 1.6, 13.5];
  const src = job.source || (job.set ? 'set' : 'chest');
  const fromChest = src === 'chest';
  let tO = 0;
  if (!fromChest) {
    // at the gate from s + 0.5 (the Nikanor module's mothers and zavim hand over their birds then — keep this contract)
    arriveAt(G, K, 'MOK_X', gate, 0.5);
    if (src === 'bringer') {
      // a man brings his own bird for a vow or a gift (Kinnim 1:1): up from the Mount through Ezrat Nashim and the
      // fifteen steps to the gateway, hands the cage to the kohen, and goes ⚙
      const O = new Track(null, 'O', 'israelite');
      B.tracks.push(O);
      const hand = [gate[0] + 1.35, gate[1], 13.5];
      const foot = [G.N.CHEL_FOOT.X, G.N.CHEL_FOOT.Y + (lane - 1) * 0.9, G.N.CHEL_FOOT.Z];
      tO = 0.45 - walkMin(G, foot, hand, SPEED.owner);
      O.at(tO, foot, 270);
      O.walk(G, hand, { speed: SPEED.owner, pose: 'carry_walk', prop: cage });
      O.hold(0.58, { pose: 'carry', h: 270, prop: cage });
      O.hold(0.72, { pose: 'stand', h: 270 });
      O.walk(G, 'CHEL_FOOT', { speed: SPEED.owner });
      K.holdFor(0.08, { pose: 'stand', h: 90 });
    }
    K.holdFor(src === 'bringer' ? 0.22 : 0.3, { pose: 'carry', h: 90, prop: cage });
    B.cues.push({ t: 0.55, kind: 'sound', id: 'doves', pos: gate });
    mark(B, 'nikanor', tO, K.t, { type: 'bird', zone: 'nikanor', view: view(G.V.nikanor), parent: 'bird-offerings',
      label: job.set === 'yoledet' ? 'The mother\'s birds taken from her at Sha\'ar Nikanor' : job.set === 'zav-zavah' ? 'The pair of birds taken at Sha\'ar Nikanor'
        : 'A man hands his bird, a gift for the altar, to the kohen at Sha\'ar Nikanor',
      sources: job.set ? ['Sotah 1:5', 'Kelim 1:8'] : ['Kinnim 1:1', 'Kelim 1:8'] });
  } else {
    // bought with the money of the chests "kinnin" and "gozlei olah" (Shekalim 6:5): no owner; the kohen brings the
    // bird from the kohanim's side of the court (⚙ where the birds bought for the chests were kept is not stated)
    K.at(0, [G.N.MOK_X.X, G.N.MOK_X.Y, G.N.MOK_X.Z], 180);
    K.holdFor(0.05, { pose: 'carry', h: 180, prop: cage });
  }
  B.res.lane = [0, 0];
  let t = K.t;
  const doChatat = job.kind === 'pair' || job.kind === 'chatat';
  const doOlah = job.kind === 'pair' || job.kind === 'olah';
  if (doChatat) {
    // at his own place along the west face by the SW corner (S.swBird), in from the corridor west of it, the cage set
    // down behind him
    const SB = S.swBird[lane];
    K.walk(G, SB.approach, { speed: SPEED.kohen, pose: 'carry_walk', prop: cage });
    K.step(SB.pos, { pose: 'carry_walk', speed: 0.8, prop: cage });
    const kinninLabel = (k) => (k === 'chatat' ? 'A bird bought with the money of the chest marked "kinnin", brought by the kohen'
      : 'A bird bought with the money of the chest marked "gozlei olah", brought by the kohen');
    if (fromChest) mark(B, 'kinnin', 0, K.t, { type: 'bird', zone: 'bein-haulam-lamizbeach', view: view(G.V.sw), parent: 'bird-offerings', label: kinninLabel(job.kind), sources: ['Shekalim 6:5'] });
    const t0 = K.t;
    const hCage = headTo(SB.pos, SB.cage);
    K.holdFor(0.12, { pose: 'kneel', ph: fix(0.3), h: hCage, prop: cage });
    const d = minutes('chatat-haof', 'melikah', r, [1, 2]);
    K.holdFor(d, { pose: 'melikah', h: SB.heading, prop: 'dove_held', hand: 'left' });
    K.holdFor(0.12, { pose: 'kneel', ph: fix(0.3), h: hCage });
    B.props.push({ kind: 'cage', lane, name: cage, t0: t0 + 0.1, t1: K.t - 0.02, at: SB.cage, h: 60 });
    B.cues.push({ t: t0 + 0.1, kind: 'sound', key: 'doves-sw', id: 'doves', pos: SB.pos });
    mark(B, 'melikah', t0, K.t, { type: 'chatat-haof', zone: 'bein-haulam-lamizbeach', view: view(G.V.sw), parent: 'bird-offerings',
      label: 'The chatat bird nipped at the SW corner; its blood sprinkled below the red line, the rest squeezed onto the yesod' });
    K.step(SB.approach, { pose: 'carry_walk', speed: 0.9, prop: cage });
    t = K.t;
  }
  if (doOlah) {
    // on the sovev at the SE horn, facing the altar's wall (the blood is drained on the wall — Zevachim 6:5): one bird
    // kohen there at a time, and nobody passes along the 1-amah ledge meanwhile (P.hot 'se')
    const SE = S.seBird;
    K.walk(G, SE.pos, { speed: SPEED.kohen, pose: 'carry_walk', prop: cage, to: 'SV_SE' });
    if (fromChest && !doChatat) mark(B, 'kinnin', 0, K.t, { type: 'bird', zone: 'mizbeach', view: view(G.V.sovev), parent: 'bird-offerings', label: 'A bird bought with the money of the chest marked "gozlei olah", brought by the kohen', sources: ['Shekalim 6:5'] });
    const t0 = K.t;
    const hCage = headTo(SE.pos, SE.cage);
    K.holdFor(0.1, { pose: 'kneel', ph: fix(0.3), h: hCage, prop: cage });
    const d = minutes('olat-haof', 'melikah', r, [1, 2]);
    K.holdFor(d, { pose: 'melikah', h: SE.heading, prop: 'dove_held', hand: 'left' });
    mark(B, 'melikah', t0, K.t, { type: 'olat-haof', zone: 'mizbeach', view: view(G.V.sovev), parent: 'bird-offerings',
      label: 'The olah bird nipped on the sovev at the SE horn; its blood drained on the wall' });
    const tH = K.t;
    K.holdFor(0.12, { pose: 'throw', ph: one(), h: headTo(SE.pos, [224, 321.5]), prop: 'dove_held' });
    K.holdFor(0.12, { pose: 'throw', ph: one(), h: headTo(SE.pos, S.deshenTarget) });
    K.holdFor(0.14, { pose: 'throw', ph: one(), h: headTo(SE.pos, [224, 321.5]), prop: 'dove_held' });
    K.holdFor(0.1, { pose: 'kneel', ph: fix(0.3), h: hCage });
    B.props.push({ kind: 'cage', lane, name: cage, t0: t0 + 0.08, t1: K.t - 0.02, at: SE.cage, h: 300 });
    mark(B, 'haktarah', tH, K.t, { type: 'olat-haof', zone: 'mizbeach', view: view(G.V.sovev), parent: 'bird-offerings' });
    B.cues.push({ t: tH + 0.15, kind: 'caption', key: 'olat-haof', pos: SE.pos, range: 30,
      text: { en: 'From the sovev the kohen throws the salted head onto the fire, and flings the crop and feathers to the ash place east of the ramp (Zevachim 6:5; 64a)', he: 'סְפָגוֹ בְמֶלַח וּזְרָקוֹ עַל גַּבֵּי הָאִשִּׁים' } });
    K.walk(G, 'KE_RS', { speed: SPEED.kohen, pose: 'carry_walk', prop: cage, from: 'SV_SE', route: G.route(K.p, 'KE_RS', { from: 'SV_SE' }) });
    t = K.t;
  }
  // the chatat bird is the kohanim's to eat (Zevachim 6:4): set down where the portions are left for their meal (one
  // at a time — P.hot), reached from the south past the hearth
  if (doChatat) {
    K.walk(G, S.drop.pos, { speed: SPEED.kohen, pose: 'carry_walk', prop: cage, from: doOlah ? 'KW_RY' : undefined, to: 'E_K' });
    K.holdFor(0.2, { pose: 'carry', h: S.drop.heading, prop: cage });
    K.walk(G, 'MOK_X', { speed: SPEED.kohen, pose: 'carry_walk', prop: cage, from: 'E_K' });
  } else K.walk(G, 'MOK_X', { speed: SPEED.kohen, pose: 'carry_walk', prop: cage });
  B.res.lane = [fromChest ? 0 : 0.5, K.t - 0.6];
  B.lim.end = Math.max(...B.steps.map((s) => s.t1));
  B.type = job.kind === 'olah' ? 'olat-haof' : 'chatat-haof';
  B.title = job.kind === 'pair'
    ? { en: `${job.set === 'yoledet' ? 'A mother\'s pair of birds' : job.set === 'zav-zavah' ? 'A zav\'s or zavah\'s pair of birds' : 'A pair of birds'} — ${B.species === 'pigeon' ? 'young pigeons' : 'turtledoves'}`, he: 'קִנִּים' }
    : job.kind === 'chatat' ? { en: `A bird chatat${job.set === 'yoledet' ? ' (a mother who brings a lamb for her olah)' : ''} — ${B.species === 'pigeon' ? 'a young pigeon' : 'a turtledove'}`, he: 'חטאת העוף' }
      : { en: `A bird olah — ${B.species === 'pigeon' ? 'a young pigeon' : 'a turtledove'}`, he: 'עולת העוף' };
  B.pair = job.kind === 'pair';
  B.set = job.set;
  B.tracks = B.tracks.filter((tr) => tr.segs.length);
  return B;
}

// ---------------------------------------------------------------------------------------- meal-offerings
/**
 * Brought from home in a vessel and handed over at the edge of the Ezrat Kohanim; kneaded and fried or baked in the
 * court's pans (Rambam MK 12:23); brought to the point of the SW horn (hagashah, Zevachim 6:2); the handful taken
 * standing, with the right hand (Menachot 1:2), salted and burned with all the frankincense; the rest to the kohanim.
 */
function scriptMeal(P, job, lane) {
  const { G } = P;
  const S = G.S;
  const type = job.type, T = OFFERING_TYPES[type];
  const B = Built(P, type);
  B.r = rng(hashStr(`${P.seed}:m:${type}:${job.i}`));
  const r = B.r;
  const view = (v) => ({ at: v.at, heading: v.heading });
  const O = new Track(null, 'O', 'israelite'), K = new Track(null, 'KM', 'kohen');
  B.tracks.push(O, K);
  const vessel = 'solet';
  const pan = MEAL_PROP[type];
  // the owner up from the Mount, through Ezrat Nashim and Nikanor, to the foot of the duchan in Ezrat Yisrael; the
  // kohen steps down onto its lowest step to take the vessel (the owner has no need to enter: Kelim 1:8) ⚙
  const yHand = 324.5 - lane * 2.6;
  // (the owner clear of the duchan's lowest step, which reaches X 244.75 under the larger amot — qa-r2 floors)
  const oHand = [245.2, yHand, 13.5], kHand = [243.45, yHand, 14.5];
  O.at(0, [G.N.CHEL_FOOT.X, G.N.CHEL_FOOT.Y + (lane - 1) * 1.2, 0], 270);
  O.walk(G, oHand, { speed: SPEED.owner, pose: 'carry_walk', prop: vessel });
  const tMeet = O.t;
  arriveAt(G, K, 'MOK_X', kHand, tMeet - 0.15);
  K.hold(tMeet, { pose: 'stand', h: 90 });
  O.holdFor(0.25, { pose: 'carry', h: 270, prop: vessel });
  K.hold(O.t, { pose: 'stand', h: 90 });
  const dV = minutes(type, "hava'ah", r, [3, 6]);
  mark(B, "hava'ah", 0, Math.max(O.t, dV * 0.5), { zone: 'ezrat-yisrael', view: view(G.V.hava), parent: 'meal-offerings' });
  O.walk(G, 'CHEL_FOOT', { speed: SPEED.owner });
  let t = O.t - 0.0;
  t = K.t;
  K.holdFor(0.15, { pose: 'carry', h: 90, prop: vessel });
  const cooked = !!stepData(type, 'afiyah');
  if (cooked) {
    // at his own place along the hearth's east mouth, reached from the south (S.fry)
    const F = S.fry[lane];
    K.walk(G, F.approach, { speed: SPEED.carry, pose: 'carry_walk', prop: vessel, to: 'E_K' });
    K.step(F.pos, { pose: 'carry_walk', speed: 0.8, prop: vessel });
    const t0 = K.t;
    const d = minutes(type, 'afiyah', r, [20, 45]);
    K.holdFor(d * 0.4, { pose: 'kneel', ph: fix(0.42), h: F.heading });
    const tFry = K.t;
    K.hold(t0 + d, { pose: 'carry', h: F.heading, prop: pan });
    B.fires.push({ id: 'altar.kitchen.fire', t0: tFry - 0.3, t1: t0 + d, v: 0.85 });
    mark(B, 'afiyah', t0, K.t, { zone: 'ezrat-kohanim', view: view(G.V.kitchen), parent: 'meal-offerings' });
    K.step(F.approach, { pose: 'carry_walk', speed: 0.9, prop: pan });
  }
  // hagashah at the point of the SW horn (Zevachim 6:2; Rambam MK 13:12), on the corner's own place (P.hot 'sw')
  const held = cooked ? pan : vessel;
  const hg = S.swPoint.pos;
  const t1 = K.t;
  K.walk(G, hg, { speed: SPEED.carry, pose: 'carry_walk', prop: held, from: cooked ? 'E_K' : undefined });
  K.holdFor(Math.max(0.3, minutes(type, 'hagashah', r, [0.5, 1]) * 0.6), { pose: 'carry', h: S.swPoint.heading, prop: held });
  mark(B, 'hagashah', t1, K.t, { zone: 'azarah', view: view(G.V.sw), parent: 'meal-offerings' });
  // kemitzah by the silver table, standing, the right hand (Menachot 1:2)
  // each lane its own place, reached from the way west of them ⚙
  const km = add(S.kemitzah.pos, 1.2, 0.2 + lane * 1.3), kmIn = [G.N.KW_1.X + 0.3, km[1], 16];
  const t2 = K.t;
  K.walk(G, kmIn, { speed: 0.9, pose: 'carry_walk', prop: held });
  K.step(km, { pose: 'carry_walk', speed: 0.8, prop: held });
  K.holdFor(minutes(type, 'kemitzah', r, [1, 3]), { pose: 'kemitzah', h: S.kemitzah.heading ?? 24, prop: 'solet', hand: 'left' });
  mark(B, 'kemitzah', t2, K.t, { zone: 'azarah', view: view(G.V.westRamp), parent: 'meal-offerings' });
  // salt from Lishkat HaMelach, up the ramp, burned with the frankincense (Vayikra 2:2, 2:13; Middot 5:3)
  const t3 = K.t;
  K.step(kmIn, { pose: 'carry_walk', speed: 0.9, prop: 'bowl' });
  K.walk(G, S.melSpot[lane], { speed: SPEED.kohen, pose: 'carry_walk', prop: 'bowl' });
  K.holdFor(0.3, { pose: 'carry', h: 180, prop: 'bowl' });
  K.walk(G, [S.pileFaceX, 321.0 - lane * 1.3, 25], { speed: SPEED.kohen, pose: 'carry_walk', prop: 'bowl', to: 'TP_SE' });
  K.holdFor(0.1, { pose: 'throw', ph: one(), h: 270, prop: 'bowl' });
  mark(B, 'haktarah', t3, K.t, { zone: 'mizbeach', view: view(G.V.top), parent: 'meal-offerings' });
  B.cues.push({ t: K.t - 0.08, kind: 'caption', key: 'kometz', pos: [S.pileFaceX, 321, 25], range: 30,
    text: type === 'minchat-chotei'
      ? { en: 'The handful of the sinner\'s meal-offering, salted and burned on the great pile — dry flour, with no oil and no frankincense (Vayikra 5:11–12, 2:13)', he: 'הַקְטָרַת הַקֹּמֶץ — לֹא יָשִׂים עָלֶיהָ שֶׁמֶן וְלֹא יִתֵּן עָלֶיהָ לְבֹנָה' }
      : { en: 'The handful of the meal-offering, salted, burned on the great pile with all its frankincense (Vayikra 2:2, 2:13; Rambam MK 13:12)', he: 'הַקְטָרַת הַקֹּמֶץ' } });
  // the remainder to the kohanim, eaten in the court (Zevachim 6:1): set down where the portions are left for their meal
  K.walk(G, kmIn, { speed: SPEED.kohen, from: 'TP_NE' });
  K.step(km, { pose: 'walk', speed: 0.8 });
  K.holdFor(0.15, { pose: 'carry', h: 90, prop: 'solet' });
  K.step(kmIn, { pose: 'carry_walk', speed: 0.9, prop: 'solet' });
  const t4 = K.t;
  K.walk(G, S.drop.pos, { speed: SPEED.carry, pose: 'carry_walk', prop: 'solet', to: 'E_K' });
  K.holdFor(0.3, { pose: 'carry', h: S.drop.heading, prop: 'solet' });
  mark(B, 'achilah', t4, K.t, { zone: 'ezrat-kohanim', view: view(G.V.kitchen), parent: P.parents?.has('kodashim-meal') ? 'kodashim-meal' : 'meal-offerings', label: 'The remainder to the kohanim, eaten in the court' });
  K.walk(G, 'MOK_X', { speed: SPEED.kohen, from: 'E_K' });
  B.res.lane = [Math.max(0, tMeet - 1.5), K.t - 0.6];
  B.lim.end = Math.max(...B.steps.map((s) => s.t1));
  B.title = { en: `${T.names.en}${type === 'minchat-chotei' ? ' — dry flour, no oil, no frankincense' : ''}`, he: T.names.he };
  B.tracks = B.tracks.filter((tr) => tr.segs.length);
  return B;
}

// ---------------------------------------------------------------------------------------- notar
function scriptNotar(P) {
  const { G } = P;
  const S = G.S;
  const B = Built(P, 'notar');
  B.r = rng(hashStr(`${P.seed}:notar`));
  const [w0, w1] = P.win.notar;
  const view = { at: G.V.deshen.at, heading: G.V.deshen.heading };
  const A1 = new Track(null, 'N1', 'kohen'), A2 = new Track(null, 'N2', 'kohen');
  B.tracks.push(A1, A2);
  const dsh = S.deshen.pos;
  const p1 = add(dsh, 0.2, -1.0), p2 = add(dsh, 0.6, 1.2);
  // the fire is lit, then the leftover meat brought from the cooking place in loads and thrown on (Rambam MK 7:3)
  arriveAt(G, A2, 'MOK_X', p2, w0 + 1.0);
  A2.hold(w1 - 1.0, { pose: 'stoke', h: 260, prop: 'fork' });
  A2.walk(G, 'MOK_X', { speed: SPEED.kohen });
  // the loads taken up south-east of the hearth (S.pick), clear of the frying places and the eaters ⚙
  arriveAt(G, A1, 'MOK_X', S.pick, w0 + 1.6, { to: 'E_K' });
  let t = A1.t;
  let trip = 0;
  while (t < w1 - 5 && trip < 6) {
    A1.holdFor(0.25, { pose: 'carry_limbs', h: 270, prop: 'limb', prop2: 'limb' });
    A1.walk(G, p1, { speed: SPEED.carry, pose: 'carry_limbs_walk', prop: 'limb', prop2: 'limb' });
    A1.holdFor(0.1, { pose: 'toss', ph: one(), h: 270, prop: 'limb', prop2: 'limb' });
    A1.holdFor(1.4 + B.r() * 1.2, { pose: 'stand', h: 270 });
    if (A1.t > w1 - 5) break;
    A1.walk(G, S.pick, { speed: SPEED.kohen });
    t = A1.t; trip++;
  }
  A1.walk(G, 'MOK_X', { speed: SPEED.kohen });
  B.fires.push({ id: 'altar.beit-hadeshen.fire', t0: w0 + 0.6, t1: w1 + 1.5, v: 1, fadeIn: 1.2, fadeOut: 6 });
  mark(B, 'notar', w0, w1, { type: 'notar', zone: 'kevesh', view, parent: 'notar-burning', label: 'Yesterday\'s left-over most-holy meat burned by day east of the ramp',
    sources: ['Rambam Pesulei HaMukdashin 19:4–5', 'Rambam MK 7:3', 'Zevachim 104b', 'Pesachim 7:10'] });
  B.res.lane = [w0, w1];
  B.lim.end = w1;
  B.title = { en: 'Notar — yesterday\'s left-over most-holy meat, burned by day', he: 'שְׂרֵפַת נוֹתָר' };
  return B;
}

// ---------------------------------------------------------------------------------------- bikkurim
/**
 * A late basket of first fruits (Bikkurim 1:6 — from Sukkot to Chanukah, without the declaration): carried on his
 * shoulder from the Mount on (Bikkurim 3:4), the Levites singing "Aromimcha" as it reaches the court; the kohen's hand
 * beneath, waved; set down beside the altar south of the SW horn; he bows and leaves (Bikkurim 3:6).
 */
function scriptBikkurim(P, job, lane) {
  const { G } = P;
  const S = G.S;
  const B = Built(P, 'bikkurim');
  B.r = rng(hashStr(`${P.seed}:k:${job.i}`));
  const r = B.r;
  const view = (v) => ({ at: v.at, heading: v.heading });
  const O = new Track(null, 'O', 'israelite'), K = new Track(null, 'KB', 'kohen');
  B.tracks.push(O, K);
  O.at(0, [G.N.CHEL_FOOT.X, G.N.CHEL_FOOT.Y, 0], 270);
  O.walk(G, 'NIK_W', { speed: 1.0, pose: 'carry_shoulder_walk', prop: 'basket' });
  const tCourt = O.t;
  // Levites from their chambers under Ezrat Yisrael (Middot 2:6) up onto the duchan, singing as the basket reaches
  // the court (Bikkurim 3:4). ⚙ How many sang for a lone late bringer is not stated (song for him at all is
  // reconstruction: 3:4 describes the procession); six, standing in two staggered ranks on the duchan's treads. Each
  // goes at his own pace, a little apart from the man ahead, the later starters the slower so nobody overtakes; they
  // leave one by one
  const Lv = Array.from({ length: 6 }, (_, k) => new Track(null, `L${k}`, 'levi'));
  B.tracks.push(...Lv);
  let delay = 0;
  Lv.forEach((lv, k) => {
    const front = k % 2 === 0, j = k >> 1;
    const dst = front ? [242.75, 336.6 + j * 1.6, 15.5] : [243.55, 337.4 + j * 1.6, 14.5];
    delay += k ? 0.2 + 0.4 * r() : 0;
    const speed = 1.18 - 0.03 * k - 0.04 * r();
    const from = [262, 352 + (k % 2) * 1.2, 6];
    arriveAt(G, lv, from, dst, tCourt - 0.6 + delay, { speed, side: front ? -0.18 : 0.18 });
    lv.hold(tCourt + 0.35 + SONG_MIN + 0.3 + 0.15 * k + 0.25 * r(), { pose: 'sing', h: 270 + (r() - 0.5) * 16, near: true });
    lv.walk(G, from, { speed: speed + 0.05, from: 'EY_A', side: front ? -0.18 : 0.18 });
  });
  // the kinnor's opening, then Psalm 30 ("Aromimcha", the audio's song 'bikkurim': three sections back to back, its own
  // heading and verse captions — render-audio-3)
  B.cues.push({ t: tCourt + 0.3, kind: 'sound', id: 'kinnor', pos: [243, 340, 16] });
  let ts = tCourt + 0.35;
  BIK_SECTIONS.forEach((d, s) => { B.cues.push({ t: ts, kind: 'sound', key: `aromimcha-${s}`, id: 'choir-psalm', pos: [243, 340, 16], opts: { song: 'bikkurim', section: s } }); ts += d / 60; });
  // the waving east of the altar, south of the animal lanes' places (S.waveBik): the owner holds the basket by its
  // rims, the kohen facing him with his hands beneath it (Bikkurim 3:6) ⚙ no joint waving pose: held still
  const WB = S.waveBik;
  O.walk(G, WB.ownerIn, { speed: 1.0, pose: 'carry_shoulder_walk', prop: 'basket', from: 'EY_M', to: 'E_M' });
  O.step(WB.owner, { pose: 'carry_shoulder_walk', speed: 0.8, prop: 'basket' });
  mark(B, 'aliyah', 0, O.t, { type: 'bikkurim', zone: 'ezrat-yisrael', view: view(G.V.nikanor), parent: 'tenufah' });
  arriveAt(G, K, 'MOK_X', WB.kohenIn, O.t - 0.15);
  K.step(WB.kohen, { pose: 'walk', speed: 0.8 });
  const tW = Math.max(O.t + 0.1, K.t);
  const dW = minutes('bikkurim', 'tenufah', r, [2, 4]);
  // "he holds it by its rims; the kohen puts his hand beneath it and waves it" (Bikkurim 3:6): the owner in 'wave' (the
  // basket chooses people's wave_basket, held by the rims), the kohen in wave_under beneath it — one phase from tW + 0.1,
  // both at scale 1, WAVE_UNDER.partner apart (S.waveBik)
  O.scale = 1; K.scale = 1;
  O.hold(tW, { pose: 'carry_shoulder', h: 270, prop: 'basket' });
  O.hold(tW + 0.1, { pose: 'carry', h: 270, prop: 'basket' });
  O.hold(tW + dW, { pose: 'wave', h: 270, prop: 'basket', ph: cyc(WAVE_P, 0) });
  K.hold(tW + 0.1, { pose: 'stand', h: 90 });
  K.hold(tW + dW, { pose: 'wave_under', h: 90, ph: cyc(WAVE_P, 0) });
  mark(B, 'tenufah', tW, tW + dW, { type: 'bikkurim', zone: 'ezrat-kohanim', view: view(G.V.tenufah), parent: 'tenufah', label: 'The kohen\'s hands beneath the basket; it is waved' });
  // set down south of the SW horn (Bikkurim 3:6; Rambam Bikkurim 3:12), the bringer bows and goes
  const down = [203.4, 302.0, 16];
  K.step(WB.kohenIn, { pose: 'walk', speed: 0.9 });
  O.step(WB.ownerIn, { pose: 'carry_walk', speed: 0.9, prop: 'basket' });
  O.walk(G, down, { speed: 1.0, pose: 'carry_walk', prop: 'basket', from: 'E_M' });
  const tD = O.t;
  O.holdFor(0.15, { pose: 'kneel', ph: fix(0.3), h: 0, prop: 'basket' });
  O.holdFor(0.2, { pose: 'bow', ph: one(), h: 0 });
  mark(B, 'hanachah', tD, O.t, { type: 'bikkurim', zone: 'azarah', view: view(G.V.sw), parent: 'tenufah' });
  const bk = [202.7, 303.3, 16];
  const tBow = O.t;
  O.walk(G, 'CHEL_FOOT', { speed: SPEED.owner });
  // the kohen waits a little apart while the man bows, then takes the basket up once he has gone ⚙
  K.walk(G, add(down, 1.6, 0.5), { speed: SPEED.kohen });
  K.hold(Math.max(K.t, tBow + 1.4), { pose: 'stand', h: 290 });
  K.step([203.6, 302.6, 16], { pose: 'walk', speed: 0.8 });
  K.holdFor(0.15, { pose: 'kneel', ph: fix(0.3), h: headTo([203.6, 302.6], bk) });
  B.props.push({ kind: 'basket', lane: 0, name: 'basket', t0: tD + 0.15, t1: K.t - 0.02, at: bk, h: 0 });
  K.walk(G, 'MOK_X', { speed: SPEED.kohen, pose: 'carry_walk', prop: 'basket' });
  B.res.lane = [0, K.t];
  B.lim.end = Math.max(...B.steps.map((s) => s.t1));
  B.title = { en: 'Bikkurim — a late basket of first fruits, without the declaration', he: 'בִּכּוּרִים' };
  return B;
}

export { WALK };
