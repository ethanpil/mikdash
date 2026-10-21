// The lotteries (payis) — Yoma 2:1–4, 22a–26a; Tamid 1:2, 3:1, 5:2–3; report Part VIII §27.2. Events served
// (choreo 'lotteries'):
//   first-lottery              in Beit HaMoked, round the hearth: those who immersed (Tamid 1:2–3). The same five men and
//                              the officer as the night's plan (g1/plan.js): "raise your fingers" — one or two, never a
//                              thumb (Yoma 22a); the officer lifts one man's mitre and counts the fingers round from him
//                              (Yoma 25a); the slab kohen wins; two light the torches at the hearth (weekdays).
//   second-lottery             Lishkat HaGazit, the kodesh half (station 'lottery', Yoma 25a: "the lottery in its east"):
//                              thirteen tasks in one draw (Tamid 3:1; Yoma 2:3). The kohanim come in from the altar
//                              (terumat-hadeshen's winner and brothers, arriving at its east door) and from the chavitin
//                              chamber with the officer; two of the circle go out as the barkai watchers (barkai.js).
//   third-fourth-lottery       "Those new to the incense, come and cast lots" — only they hold out fingers; then "new and
//                              old together: who brings the limbs up from the ramp to the altar" (Tamid 5:2); those who did
//                              not win are handed to the attendants (chazzanim), who take off their garments and lay them
//                              in the niches marked with the vessels' names, leaving them the breeches (Tamid 5:3); the
//                              attendants are staged as Levites ⚙; the men go out in the breeches (people's kohen_breeches).
//   afternoon-lottery          new men draw for the afternoon incense; the morning's other tasks stand (Yoma 26a).
//   afternoon-lottery-shabbat  the incoming mishmar draws the afternoon's tasks afresh, then the incense (Yoma 26a).
// The kohanim stand in a circle (kuliyar), in the four garments, barefoot; the officer in its middle turns to each finger
// as he counts. Every pose is a pure function of (t, date). ⚙ marks reconstruction (minutes, spots, counts).
import { nightPlan, SEED, MITRE_GRASP, MITRE_REACH } from './g1/plan.js';
import { makePools, stage, runCues, FreeProps, windowAmount } from './g1/stage.js';
import { Track, lotHand, personAt, applyLeg, ramp } from './g1/util.js';
import { gazitPlaces, mokedPlaces, lotRadius } from './g1/places.js';
import { rand, clamp } from '../lib/core.js';
import { CUE_LEAD } from '../lib/cue.js';

const WALK = 1.15, SLOW = 0.85;   // m/s ⚙
const TEXT = {
  raise: { en: '"Raise your fingers!" — one finger or two; one does not put out a thumb in the Mikdash (Yoma 22a)', he: 'הַצְבִּיעוּ — אַחַת אוֹ שְׁתַּיִם, וְאֵין מוֹצִיאִין אֲגוּדָל בַּמִּקְדָּשׁ' },
  mitre: { en: 'The officer lifts the mitre from one man\'s head: the count begins with him (Yoma 25a)', he: 'נוֹטֵל מִצְנֶפֶת מֵרֹאשׁוֹ שֶׁל אֶחָד מֵהֶן, וְיוֹדְעִין שֶׁמִּמֶּנּוּ פַּיִיס מַתְחִיל' },
  won1: { en: 'The count ends on him: he has won the clearing of the altar — "whoever won, won" (Tamid 1:2)', he: 'הֵפִיסוּ, זָכָה מִי שֶׁזָּכָה' },
  call2: { en: '"Come and cast lots: who slaughters, who throws the blood, who clears the inner altar, who clears the Menorah, who carries the limbs to the ramp — the head and the hind leg, the two forelegs, the tail and the hind leg, the breast and the neck, the two flanks, the innards — the fine flour, the chavitin, the wine" (Tamid 3:1)', he: 'בֹּאוּ וְהָפִיסוּ: מִי שׁוֹחֵט, מִי זוֹרֵק…' },
  won2: { en: 'Thirteen kohanim won in one draw, the tasks falling in order from where the count ended (Tamid 3:1; Yoma 25a)', he: 'שְׁלֹשָׁה עָשָׂר כֹּהֲנִים זָכוּ בּוֹ' },
  call3: { en: '"Those new to the incense — come and cast lots!" Only a kohen who has never offered it holds out his fingers; no one offered it twice, for it brings wealth (Tamid 5:2; Yoma 26a)', he: 'חֲדָשִׁים לַקְּטֹרֶת, בֹּאוּ וְהָפִיסוּ' },
  won3: { en: 'The incense falls to one of the new men', he: 'זָכָה בַּקְּטֹרֶת' },
  call4: { en: '"New and old together — come and cast lots: who brings the limbs up from the ramp to the altar" (Tamid 5:2)', he: 'חֲדָשִׁים עִם יְשָׁנִים, בֹּאוּ וְהָפִיסוּ, מִי מַעֲלֶה אֵבָרִים מִן הַכֶּבֶשׁ לַמִּזְבֵּחַ' },
  strip: { en: 'Those who did not win are handed over to the attendants, who take off their garments; there are niches there, with the names of the garments written on them (Tamid 5:3)', he: 'שֶׁלֹּא זָכוּ, מוֹסְרִין אוֹתָן לַחַזָּנִין' },
  callPm: { en: '"Those new to the incense — come and cast lots!" The afternoon incense is drawn afresh; the morning\'s other tasks stand (Yoma 26a)', he: 'פַּיִיס לַקְּטֹרֶת שֶׁל בֵּין הָעַרְבַּיִם' },
  callShabbat: { en: 'Shabbat: the watch changes, so the incoming mishmar casts lots for the afternoon tamid as in the morning (Yoma 26a; Sukkah 56b)', he: 'בְּשַׁבָּת מַפִּיסִין, מִפְּנֵי שֶׁהַמִּשְׁמָרוֹת מִתְחַלְּפוֹת' },
  wonPm: { en: 'The afternoon incense falls to a new man (Yoma 26a)', he: 'זָכָה בַּקְּטֹרֶת' },
};
const G2_ID = 'terumat-hadeshen';

export default {
  id: 'lotteries',
  lead: 5,          // the officer leaves Beit HaMoked for the second lottery at its t0 − 4.75
  lag: 16,          // after the second lottery they wait in the Gazit for the barkai and go out to bring the lamb ⚙
  importance: 3,

  init(ctx, events, sim) {
    sim.setBounds([60, 360, 10], [240, 420, 30]);
    const pools = makePools(sim, ['slab:k', 'officer:k'], 3);
    // terumat-hadeshen's brothers 0–7 (same seed): 0–3 are the night's young kohanim, 4–7 its others
    pools['young:k'] = sim.pool({ name: 'young:k', role: 'kohen', count: 8, seed: SEED.brothers, importance: 3 });
    pools['barkai:k'] = sim.pool({ name: 'barkai:k', role: 'kohen', count: 2, seed: SEED.barkai, importance: 3 });
    pools['gazit:k'] = sim.pool({ name: 'gazit:k', role: 'kohen', count: 20, seed: SEED.gazit, importance: 2 });
    // those who did not win, left in the breeches alone (Tamid 5:3)
    pools['gazit:br'] = sim.pool({ name: 'gazit:br', role: 'kohen_breeches', count: 20, seed: SEED.gazit, importance: 2 });
    // the attendants (chazzanim) of Tamid 5:3 ⚙ Levites
    pools['chazzan:levi'] = sim.pool({ name: 'chazzan:levi', role: 'levi', count: 3, seed: SEED.chazzan, importance: 2 });
    return { pools, G: gazitPlaces(ctx), M: mokedPlaces(ctx), wicket: sim.door('azarah.gate.moked.pishpash'), gz: null, gzGen: -1, gzG2: false, plan: null, cues: [], props: new FreeProps(ctx), fmt: (m) => ctx.time?.format?.(m) ?? '--', n: 0, out: {} };
  },

  update(ctx, state, t, dt, sim) {
    const P = nightPlan(ctx, sim);
    // ---- the first lottery: the shared plan's legs owned here
    if (state.plan !== P) {
      state.plan = P;
      state.cues = firstCues(P);
    }
    let n = stage(ctx, sim, state.pools, P, 'lot', t);
    runCues(ctx, sim, state, state.cues, 'lot');
    // ---- the Gazit's draws (their own plan, rebuilt per date and when terumat-hadeshen's plan appears)
    const g2 = g2Plan(sim);
    if (state.gzGen !== sim.generation || state.gzG2 !== !!g2) {
      state.gz = gazitScenes(ctx, sim, state, g2);
      state.gzGen = sim.generation; state.gzG2 = !!g2;
      state.props.set(state.gz.props);
    }
    const gz = state.gz;
    state.props.update(t);
    for (let i = 0; i < gz.people.length; i++) {
      const p = gz.people[i];
      const r = personAt(p.eps, t, state.out);
      if (!r || r.leg.owner !== 'lot') continue;
      const pool = state.pools[`${p.pool}:${r.leg.role}`];
      const slot = pool?.slot(p.idx);
      if (!slot || !sim.due(slot)) continue;
      applyLeg(ctx, slot, r.leg, r.local);
      n++;
    }
    runCues(ctx, sim, state, gz.cues, 'lot');
    // Beit HaMoked's wicket for the officer going out to the second lottery
    const a = windowAmount(t, gz.wicket, 0.25);
    if (a > 0) state.wicket.set(a);
    state.n = n;
  },

  release(ctx, state) { state.props.hide(); },

  debug(s) {
    const g = s.gz, f = s.fmt;
    return `figures ${s.n} · gazit scenes ${g ? g.scenes.map((x) => `${x.id} ${f(x.t0)} n${x.n}`).join(', ') : '-'} · g2 ${s.gzG2 ? 'read' : 'fallback'}`;
  },
};

/** the first lottery's cues from the shared plan */
function firstCues(P) {
  const L = P.lot1, M = P.M;
  if (!L) return [];
  const at = M.hearth;
  return [
    { key: `lot1-raise:${Math.round(L.tCall * 10)}`, t: L.tCall, caption: TEXT.raise, at, range: 35, owner: 'lot' },
    { key: `lot1-mitre:${Math.round(L.tMitre * 10)}`, t: L.tMitre, caption: TEXT.mitre, at, range: 35, owner: 'lot' },
    { key: `lot1-won:${Math.round(L.tWon * 10)}`, t: L.tWon, caption: TEXT.won1, at, range: 35, owner: 'lot' },
  ];
}

/** terumat-hadeshen's per-date plan (sim.planOf: built now if need be), read-only: its men's arrival in the Gazit */
function g2Plan(sim) {
  const P = sim.planOf?.(G2_ID);
  return P && P.W && Array.isArray(P.B) ? P : null;
}

// --------------------------------------------------------------------------------------------------- the Gazit
/**
 * One scene per Gazit lottery of the day. Each participant: an episode from his arrival to his going out; the officer in
 * the circle's middle. Circle: round the lottery station, its radius from the count (g1/places.js lotRadius: ≈0.68 m a
 * man, 2.6–3.9 amot, clear of the column plinths; the twenty of the third lottery ≈0.59 m apart) ⚙.
 */
function gazitScenes(ctx, sim, state, g2) {
  const G = state.G;
  const ev = (id) => { const e = sim.schedule.byId(id); return e && Number.isFinite(e.t0) && Number.isFinite(e.t1) ? e : null; };
  const out = { scenes: [], people: [], cues: [], props: [], wicket: [], mitre: {} };
  const people = new Map();   // `${pool}:${idx}` -> person
  const person = (pool, idx) => {
    const k = `${pool}:${idx}`;
    if (!people.has(k)) { const p = { pool, idx, eps: [] }; people.set(k, p); out.people.push(p); }
    return people.get(k);
  };
  const Z = G.Z, c = G.lot;
  const doorIn = [G.eastIn[0] + 0.5, G.eastY, Z];            // = terumat-hadeshen's 'inside' (gd.x − 2.5) ⚙
  const doorway = [G.b.max[0] + 0.4, G.eastY, Z];
  const spotOf = (n, k, r) => {
    const a = (k / n) * 360 + 90;                             // the first spot faces the east door
    const ar = (a * Math.PI) / 180;
    return { at: [c[0] + Math.sin(ar) * r, c[1] + Math.cos(ar) * r, Z], h: (a + 180) % 360 };
  };
  const radius = lotRadius;

  // ---- the second lottery
  const L2 = ev('second-lottery');
  if (L2) {
    const S = L2.t0, E = L2.t1;
    const bk = ev('barkai');
    const tOut = bk ? Math.min(E, wrapNear(bk.t0, S) - 1.0) + 0.1 : E + 0.1;   // barkai.js: the watchers go out then
    // they go out to their tasks after the report, following tamid-morning's lamb-bringers out of the door ⚙
    const lamb = ev('lamb-brought');
    const tDisp = Math.max(bk ? wrapNear(bk.t1, S) - 0.6 : E + 8, lamb ? wrapNear(lamb.t0, S) + 0.4 : -Infinity);
    // who: terumat-hadeshen's winner and its eight brothers (from the altar, by the east door); two who will be the
    // barkai watchers and five more with the officer, from the chavitin chamber ⚙
    const g2arr = [];
    const g2w = g2 ? wrapNear(g2.W.tEnd, S) : S - 2.2;
    g2arr.push({ pool: 'slab', idx: 0, t: g2w });
    for (let i = 0; i < 8; i++) g2arr.push({ pool: 'young', idx: i, t: g2 && g2.B[i] ? wrapNear(g2.B[i].tEnd, S) : S - 2.1 + 0.12 * (i + 1) });
    const others = [{ pool: 'barkai', idx: 0 }, { pool: 'barkai', idx: 1 }, ...[0, 1, 2, 3, 4].map((i) => ({ pool: 'gazit', idx: i }))];
    const all = [...g2arr, ...others];
    const n = all.length, r = radius(n);
    // circle places: the altar's men on the door side as they come in, the chavitin party on the far side ⚙
    const order = [...g2arr.map((_, i) => i), ...others.map((_, i) => g2arr.length + i)];
    const spots = new Map(order.map((who, k) => [who, spotOf(n, (k * 7) % n, r)]));
    const fromChav = chavitinWay(G, ctx);
    const counted = all.map((w, i) => ({ ...w, spot: spots.get(i) }));
    const draw = { tCall: S + CUE_LEAD, tUp: S + 0.65, tMitre: S + 0.95, tCount: [S + 1.3, S + 3.55], tWon: S + 3.65, tDown: S + 3.85 };
    const trs = [];
    counted.forEach((w, i) => {
      const p = person(w.pool, w.idx);
      let tr;
      if (i < g2arr.length) {
        tr = new Track(w.t, doorIn, 270, 'lot', 'k');
        tr.walk([w.spot.at], { speed: SLOW });
      } else {
        const t0 = S - 4.6 + 0.16 * (i - g2arr.length);
        tr = new Track(t0, fromChav[0], 270, 'lot', 'k');
        tr.walk([...fromChav.slice(1), doorway, doorIn, w.spot.at], { speed: WALK });
      }
      circleDraw(tr, w.spot, draw, i, true);
      if (w.pool === 'barkai') {
        // sent out to see whether the time for slaughter has come (Tamid 3:2): at the door when barkai.js takes them
        tr.until(tOut - tr.walkMin([doorIn], SLOW) - 0.02, { pose: 'stand', h: w.spot.h });
        tr.walk([doorIn], { until: tOut });
      } else {
        lingerAndGo(tr, w.spot, tDisp + 0.12 * i, [doorIn, doorway], i);
      }
      p.eps.push(tr.episode());
      trs[i] = tr;
    });
    // the officer: from Beit HaMoked, where he waited after the inspection (g1/plan.js takes him there from the chavitin
    // chamber through the court), out by the wicket and along the court's north side under the Moked's wall ⚙; the call;
    // the mitre; the count; then he waits with them
    {
      const p = person('officer', 0);
      const M = state.M, Zc = M.Z;
      const tr = new Track(S - 4.75, M.gateIn, 180, 'lot', 'k');
      tr.walk([[M.pish[0], M.pish[1], Zc], M.gateOut], { speed: SLOW });
      out.wicket.push([S - 4.75 - 0.05, tr.now() + 0.05]);
      tr.walk([[M.gateOut[0] - 1.2, 387.2, Zc], [200, 386.4, Zc], [181, 384.5, Zc], [156, 383.6, Zc], [99.2, 377, Zc], [G.b.max[0] + 3, G.eastY, Zc], doorway, doorIn, c], { speed: WALK });
      out.mitre.second = bare(trs, officerDraw(tr, c, counted.map((w) => w.spot), draw, 0x2a));
      tr.until(tDisp + 0.12 * n + 0.2, { pose: 'stand', h: 90 });
      tr.walk([doorIn, doorway], { speed: SLOW });
      p.eps.push(tr.episode());
    }
    out.cues.push(...drawCues('second', draw, TEXT.call2, TEXT.won2, c, out.mitre.second));
    out.scenes.push({ id: 'second', t0: S, n });
  }

  // ---- the third and fourth lotteries
  const L3 = ev('third-fourth-lottery');
  if (L3) {
    const S = L3.t0, E = L3.t1;
    const N = 20, r = radius(N);
    const inPlace = sim.hasChoreo('gazit-shema');           // they are in the Gazit already for the Shema
    const isNew = (i) => rand(SEED.gazit, 'new', i) < 0.4;
    const winners3 = new Set([3]);                          // the incense ⚙ (a new man)
    const pan = 4;                                           // "win the pan with me" (R' Yehudah, Yoma 25b) ⚙
    const limbWinners = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19]);   // the limbs from the ramp to the altar ⚙
    const drawA = { tCall: S + CUE_LEAD, tUp: S + 0.6, tMitre: S + 0.85, tCount: [S + 1.15, S + 2.1], tWon: S + 2.2, tDown: S + 2.35 };
    const drawB = { tCall: S + 2.55, tUp: S + 2.7, tMitre: S + 2.9, tCount: [S + 3.2, S + 4.3], tWon: S + 4.4, tDown: S + 4.55 };
    const tracks = [];
    for (let i = 0; i < N; i++) {
      const spot = spotOf(N, i, r);
      const tr = inPlace ? new Track(S - 0.3, spot.at, spot.h, 'lot', 'k') : new Track(S - 2.6 + 0.09 * i, doorIn, 270, 'lot', 'k');
      if (!inPlace) tr.walk([spot.at], { speed: SLOW });
      const nw = isNew(i) || winners3.has(i);
      circleDraw(tr, spot, drawA, i, nw);
      circleDraw(tr, spot, drawB, i, true);
      const won = winners3.has(i) || i === pan || limbWinners.has(i);
      if (won && (winners3.has(i) || i === pan)) {
        // the incense and pan winners: at the east doorway exactly when ketoret-morning takes them (g3/morning.js:
        // third-fourth-lottery.t1 − 0.46 / − 0.42, at its doors.gazit = this doorway)
        const tDoor = E - (i === pan ? 0.42 : 0.46);
        tr.until(tDoor - tr.walkMin([doorIn, doorway], SLOW) - 0.03, { pose: 'stand', h: spot.h });
        tr.walk([doorIn, doorway], { until: tDoor });
      } else if (won) lingerAndGo(tr, spot, E - 0.9 + 0.06 * i, [doorIn, doorway], i);
      else {
        // to his niche (Tamid 5:3), where an attendant will take his garments
        const ni = G.niche(i);
        tr.until(S + 4.75 + 0.05 * (i % 8), { pose: 'stand', h: spot.h });
        tr.walk([ni.at], { speed: SLOW });
      }
      tracks.push({ i, tr, won, spot });
    }
    // ---- the attendants (Tamid 5:3): "they handed them to the chazzanim, who stripped them of their garments and left
    // them only the breeches; there were niches there with the names of the vessels written on them". Three come in by
    // the east door during the fourth draw and go from man to man along the walls, each garment-bundle laid in its
    // niche (lower row, courts/chambers.js) ⚙
    const strip = tracks.filter((x) => !x.won).sort((a, b) => (a.i % 2) - (b.i % 2) || G.niche(a.i).at[0] - G.niche(b.i).at[0]);
    const NA = 3, serve = new Map(), per = Math.ceil(strip.length / NA);
    for (let k = 0; k < NA; k++) {
      const p = person('chazzan', k);
      const at = new Track(drawB.tCall + 0.25 * k, doorIn, 270, 'lot', 'levi');
      at.walk([[c[0] + 4.2, c[1] + (k - 1) * 1.6, Z]], { speed: SLOW });
      at.until(S + 4.6, { pose: 'stand', face: c });
      for (const m of strip.slice(k * per, (k + 1) * per)) {
        const ni = G.niche(m.i), side = ni.at[1] > c[1] ? -1 : 1;     // toward the room from the wall
        const reach = m.tr.now();
        const besideAt = [ni.at[0] + 0.85, ni.at[1] + side * 0.35, Z];
        at.walk([besideAt], { speed: SLOW });
        at.until(Math.max(at.now(), reach + 0.08), { pose: 'stand', face: ni.at });
        const t0 = at.now();
        at.hold(0.32, { face: ni.at, pose: 'receive' });                          // the garments taken off him
        at.hold(0.06, { h: ni.h, pose: 'carry', prop: 'folded_garments' });
        at.hold(0.12, { h: ni.h, pose: 'bow', phase: (l, d) => 0.5 * Math.min(1, l / d), prop: 'folded_garments' });
        const tPut = at.now();
        at.hold(0.1, { h: ni.h, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * Math.min(1, l / d) });
        serve.set(m.i, t0);
        const wallY = side < 0 ? G.b.max[1] - 1 + 0.25 : G.b.min[1] + 1 - 0.25;
        out.props.push({ name: 'folded_garments', at: [ni.at[0], wallY, Z + 1.6], h: 0, show: [tPut, E + 14.5] });   // (until the module's lag ends)
      }
      at.walk([[c[0] + 4.2, c[1] + (k - 1) * 1.6, Z], doorIn, doorway], { speed: SLOW });
      p.eps.push(at.episode());
    }
    for (const { i, tr, won } of tracks) {
      const p = person('gazit', i);
      if (!won) {
        const ni = G.niche(i), t0 = serve.get(i) ?? tr.now() + 0.2;
        tr.until(t0, { pose: 'stand', h: ni.h });
        // stripped of their garments, "they left on them only the breeches" (Tamid 5:3): he bends as the tunic, sash and
        // mitre come off and stands in the breeches alone (people's kohen_breeches - the change at the bend unseen), then
        // goes out by the east door to put on his own clothes ⚙ (where is not said)
        tr.hold(0.16, { h: ni.h, pose: 'bow', phase: (l, d) => 0.5 * clamp(l / d) });
        tr.hold(0.16, { h: ni.h, pose: 'bow', phase: (l, d) => 0.5 + 0.5 * clamp(l / d), role: 'br' });
        tr.until(Math.max(tr.now() + 0.3, E + 0.4 + 0.08 * i), { h: 90, pose: 'stand', role: 'br' });
        tr.walk([[ni.at[0] + 1.5, c[1] + (ni.at[1] < c[1] ? -2.5 : 2.5), Z], doorIn, doorway], { speed: SLOW, role: 'br' });
      }
      p.eps.push(tr.episode());
    }
    {
      const p = person('officer', 0);
      const tr = inPlace ? new Track(S - 0.3, c, 90, 'lot', 'k') : new Track(S - 2.9, doorIn, 270, 'lot', 'k');
      if (!inPlace) tr.walk([c], { speed: SLOW });
      const spots = Array.from({ length: N }, (_, i) => spotOf(N, i, r));
      const trs = tracks.map((x) => x.tr);
      out.mitre.third = bare(trs, officerDraw(tr, c, spots, drawA, 0x3a, spots.map((_, i) => isNew(i) || winners3.has(i))));
      out.mitre.fourth = bare(trs, officerDraw(tr, c, spots, drawB, 0x4a));
      tr.until(E + 0.3, { pose: 'stand', h: 90 });
      tr.walk([doorIn, doorway], { speed: SLOW });
      p.eps.push(tr.episode());
    }
    out.cues.push(...drawCues('third', drawA, TEXT.call3, TEXT.won3, c, out.mitre.third), ...drawCues('fourth', drawB, TEXT.call4, null, c, out.mitre.fourth));
    out.cues.push({ key: `strip:${Math.round(S * 10)}`, t: S + 4.75, caption: TEXT.strip, at: c, range: 35, owner: 'lot' });
    out.scenes.push({ id: 'third-fourth', t0: S, n: N });
  }

  // ---- the afternoon lottery (weekday: the incense) / Shabbat (the incoming watch: the tasks, then the incense)
  const Lp = ev('afternoon-lottery') || ev('afternoon-lottery-shabbat');
  if (Lp) {
    const shabbat = Lp.id === 'afternoon-lottery-shabbat';
    const S = Lp.t0, E = Lp.t1;
    const N = shabbat ? 20 : 12, r = radius(N);
    const isNew = (i) => rand(SEED.gazit, 'pm', i) < 0.45;
    const drawA = shabbat
      ? { tCall: S + CUE_LEAD, tUp: S + 0.7, tMitre: S + 1.0, tCount: [S + 1.35, S + 3.4], tWon: S + 3.5, tDown: S + 3.7 }
      : { tCall: S + CUE_LEAD, tUp: S + 0.7, tMitre: S + 1.0, tCount: [S + 1.35, S + 2.9], tWon: S + 3.0, tDown: S + 3.2 };
    const drawB = shabbat ? { tCall: S + 4.1, tUp: S + 4.3, tMitre: S + 4.55, tCount: [S + 4.9, S + 6.0], tWon: S + 6.1, tDown: S + 6.3 } : null;
    const tGo = (shabbat ? S + 7.2 : S + 4.2);
    const trs = [];
    for (let i = 0; i < N; i++) {
      const spot = spotOf(N, i, r);
      const p = person('gazit', i);
      const tr = new Track(S - 2.7 + 0.1 * i, doorIn, 270, 'lot', 'k');
      trs[i] = tr;
      tr.walk([spot.at], { speed: SLOW });
      if (shabbat) { circleDraw(tr, spot, drawA, i, true); circleDraw(tr, spot, drawB, i, isNew(i)); } else circleDraw(tr, spot, drawA, i, isNew(i));
      lingerAndGo(tr, spot, Math.min(tGo + 0.13 * i, E + 1.2), [doorIn, doorway], i);
      p.eps.push(tr.episode());
    }
    {
      const p = person('officer', 0);
      const tr = new Track(S - 3.0, doorIn, 270, 'lot', 'k');
      tr.walk([c], { speed: SLOW });
      const spots = Array.from({ length: N }, (_, i) => spotOf(N, i, r));
      if (shabbat) {
        out.mitre.pmA = bare(trs, officerDraw(tr, c, spots, drawA, 0x5a));
        out.mitre.pmB = bare(trs, officerDraw(tr, c, spots, drawB, 0x6a, spots.map((_, i) => isNew(i))));
      } else out.mitre.pmA = bare(trs, officerDraw(tr, c, spots, drawA, 0x5a, spots.map((_, i) => isNew(i))));
      tr.until(Math.min(tGo + 0.13 * N + 0.2, E + 2.6), { pose: 'stand', h: 90 });
      tr.walk([doorIn, doorway], { speed: SLOW });
      p.eps.push(tr.episode());
    }
    if (shabbat) out.cues.push(...drawCues('pm-a', drawA, TEXT.callShabbat, TEXT.won2, c, out.mitre.pmA), ...drawCues('pm-b', drawB, TEXT.callPm, TEXT.wonPm, c, out.mitre.pmB));
    else out.cues.push(...drawCues('pm', drawA, TEXT.callPm, TEXT.wonPm, c, out.mitre.pmA));
    out.scenes.push({ id: Lp.id, t0: S, n: N });
  }
  return out;
}

/** t near ref on the cycle (unwrapped to within ±12 h of ref) */
function wrapNear(t, ref) { return ref + ((((t - ref) % 1440) + 2160) % 1440) - 720; }

/** from inside the chavitin chamber, up the duchan and along the court's north side to before the Gazit's east door ⚙ */
function chavitinWay(G, ctx) {
  const d = ctx.elOpt('azarah.chamber.chavitin')?.params?.door;
  const door = d ? [d.x, (d.y[0] + d.y[1]) / 2, d.z?.[0] ?? 13.5] : [248, 319.5, 13.5];
  return [[door[0] + 1.6, door[1], door[2]], [door[0] - 0.8, door[1], door[2]], [door[0] - 3.6, door[1] + 0.6, 16], [236.4, 336, 16], [236.5, 372.5, 16],
    [181, 384.5, 16], [156, 383.6, 16], [99.2, 377, 16], [G.b.max[0] + 3, G.eastY, 16]];
}

/** a man of the circle through one draw: hand out (if he takes part) at tUp, down at tDown; small seeded lags ⚙ */
function circleDraw(tr, spot, D, i, takesPart) {
  const off = 0.04 * rand(SEED.gazit, 'up', i);
  tr.until(D.tUp + off, { pose: 'stand', h: spot.h });
  if (takesPart) tr.until(D.tDown + off, { pose: 'circle_lot', phase: lotHand(0.07, 0.1), h: spot.h });
  else tr.until(D.tDown + off, { pose: 'stand', h: spot.h });
}

/**
 * The officer in the middle: the call; the mitre lifted from the head of the first man who holds out his fingers - he
 * steps in before him, his crown MITRE_REACH ahead (people's lift_mitre; Yoma 25a) - and back to the middle with it in
 * his left hand; the count round the raised fingers; the mitre put back on that man's head ⚙ before they go to serve.
 * Returns { j (the man's index in spots), tOff, tOn } (his head bare between).
 */
function officerDraw(tr, c, spots, D, seed, part = null) {
  const seq = [];
  const who = spots.map((_, i) => i).filter((i) => !part || part[i]);
  const j0 = who[0], tgt = spots[j0];
  const toC = Math.hypot(c[0] - tgt.at[0], c[1] - tgt.at[1]) || 1;
  const before = [tgt.at[0] + ((c[0] - tgt.at[0]) / toC) * MITRE_REACH, tgt.at[1] + ((c[1] - tgt.at[1]) / toC) * MITRE_REACH, c[2]];
  const hT = (tgt.h + 180) % 360;                                     // facing him
  const MI = [null, 'migbaat'];
  tr.until(D.tCall - 0.05, { pose: 'stand', face: tgt.at });
  tr.until(D.tMitre - 0.12, { pose: 'stand', face: tgt.at });
  tr.walk([before], { until: D.tMitre - 0.09 });
  tr.hold(0.03, { h: hT, pose: 'lift_mitre', phase: ramp(0, MITRE_GRASP) });
  const tOff = tr.now();
  tr.hold(0.05, { h: hT, pose: 'lift_mitre', phase: ramp(MITRE_GRASP, 1), prop: 'migbaat' });
  tr.walk([c], { until: Math.max(tr.now() + 0.03, D.tCount[0] - 0.08), prop: 'migbaat' });
  const fingers = who.map((i) => 1 + (rand(seed, 'f', i) < 0.3 ? 1 : 0));
  // the number named: a little over one round of the fingers ⚙
  const total = fingers.reduce((a, b) => a + b, 0);
  const named = total + 1 + Math.floor(rand(seed, 'n') * Math.max(1, total * 0.6));
  for (let k = 0; seq.length < named; k++) { const j = k % who.length; for (let f = 0; f < fingers[j] && seq.length < named; f++) seq.push(who[j]); }
  const dt = Math.max(0.02, (D.tCount[1] - D.tCount[0]) / seq.length);
  tr.until(D.tCount[0], { pose: 'stand', face: tgt.at, props: MI });
  for (const j of seq) tr.hold(dt, { face: spots[j].at, pose: 'point', props: MI });
  tr.until(D.tDown + 0.1, { pose: 'stand', props: MI });
  tr.walk([before], { until: D.tDown + 0.14, prop: 'migbaat' });
  tr.hold(0.05, { h: hT, pose: 'lift_mitre', phase: ramp(1, MITRE_GRASP), prop: 'migbaat' });
  const tOn = tr.now();
  tr.hold(0.03, { h: hT, pose: 'lift_mitre', phase: ramp(MITRE_GRASP, 0) });
  tr.walk([c], { until: tr.now() + 0.04 });
  return { j: j0, tOff, tOn };
}

/** the man whose mitre was lifted: his head bare between tOff and tOn (g1/util.js Track.mark -> applyLeg) */
function bare(trs, m) {
  if (m && trs[m.j]) trs[m.j].mark(m.tOff, m.tOn);
  return m;
}

/** after the draw: at ease in the circle (a seeded turn), then out by the east door at tGo */
function lingerAndGo(tr, spot, tGo, door, i) {
  const ease = (rand(SEED.gazit, 'ease', i) - 0.5) * 70;
  tr.until(tGo - 0.02, { pose: 'stand', h: (spot.h + ease + 360) % 360, turn: 0.04 });
  tr.walk(door, { speed: SLOW });
}

function drawCues(tag, D, call, won, c, m) {
  const k = (x) => `${tag}:${Math.round(x * 10)}`;
  const out = [
    { key: `call-${k(D.tCall)}`, t: D.tCall, caption: call, at: c, range: 40, owner: 'lot', duration: 9 },
    { key: `mitre-${k(D.tMitre)}`, t: m ? m.tOff + 0.02 : D.tMitre + 0.1, caption: TEXT.mitre, at: c, range: 40, owner: 'lot' },
  ];
  if (won) out.push({ key: `won-${k(D.tWon)}`, t: D.tWon, caption: won, at: c, range: 40, owner: 'lot', duration: 7 });
  return out;
}

