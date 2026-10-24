// The night watch (Middot 1:1–2, 1:7; Tamid 1:1; Rambam BhB 8:4–10; report Part I §2.5, Part VIII §28 row 1).
//
// Events served (src/data/schedule.js, choreo 'night-watch'):
//   night-watch            21 Levites stand at their posts — the five Mount gates, its four inner corners, the five
//                          Azarah gates (outside), the Azarah's four outer corners, Lishkat HaKorban, Lishkat HaParochet
//                          and behind the Beit HaKaporet. They stand: a guard does not sit (Rambam BhB 8:8; Middot 1:2).
//                          They walk in through the Mount's gates as the watch begins and out again when it ends.
//   watch-upper-chambers   the young kohanim (rovim) of Beit Avtinas and Beit HaNitzotz, asleep in their own clothes,
//                          the holy garments folded under their heads (Tamid 1:1; Rambam BhB 8:5–6).
//   ish-har-habayit        the officer of the Mount goes round every Levite post, torches burning before him; at each
//                          post "Shalom alecha!" (Middot 1:2) — a cue only while the clock runs through the moment.
//   sleeping-guard         the officer finds a guard asleep: strikes him with his staff and burns his garment (Middot 1:2).
// The Moked's sleepers (elders on the ledges, young kohanim on the floor, the kohen on the keys slab — Tamid 1:1, Middot
// 1:8–9) are staged by the 'moked-night' module.
//
// Determinism: every pose is a pure function of (t, date, seed). The officer's timeline comes from the circuit's
// authored waypoints (straight lengths — nav-independent) and the day's windows, computed once per date: he comes in by
// the western Chuldah gate as his event begins, reaches the sleeping guard CUE_LEAD into that event, and reaches the foot
// of the Chel steps on his way in to Nikanor's post DAWN_LEAD after the default opening (alot − 6) ⚙ — so the opening
// view at those steps sees him and his torches; after his event ends he finishes the round's leg to the soreg's east
// entry and walks across the Mount to his gate and out (qa-r1 SIM-2). Without that anchor (an odd window) his last
// round ends back at his gate as his event ends. Nav only reshapes the line he walks between the waypoints.
// "Go" to his row stands ahead of him on his way, a little aside, facing back to him (ctx.schedule.liveView; qa-r2).
import { Box3, Ray, Vector3 } from 'three';
import { headingTo, angleDiff, floorZ, navRoute, straightRoute } from '../lib/path.js';
import { within, since, span, wrap, wanderer, rand, clamp, smooth, window4, upperBound } from '../lib/core.js';
import { cueAt, crossed, CUE_LEAD } from '../lib/cue.js';
import { m2w, AMAH } from '../../core/units.js';
import { DEFAULT_OFFSET_FROM_ALOT } from '../../time/index.js';
import { mokedPlaces } from './g1/places.js';

const SEED = 0x6e77;
const PATROL_SPEED = 1.15;         // m/s — a measured round ⚙
const DWELL = 0.35;                // minutes at each post (the greeting) ⚙
const STOP_OFFSET = 3.2;           // amot: the officer stops this far in front of the guard ⚙
const TORCH_AHEAD = 2.3, TORCH_SIDE = 0.55; // m: "torches burning before him" (Middot 1:2)
const GREET_RANGE = 12;            // m: a guard turns to face the approaching officer
const CAPTION_RANGE = 40;          // m
const ASLEEP_BEFORE = 30;          // minutes the guard has been asleep when the officer finds him ⚙
const GUARD_SPEED = 1.2;           // m/s: the Levites walking to and from their posts ⚙
const GUARD_WALK_MAX = 2.9;        // minutes: the longest walk on / off (within the module's lead / lag) ⚙
const KAPORET_EARLY = 3;           // the guard behind the Kaporet is at his post this long after the locking begins,
                                   // before the Azarah's gates are shut ⚙
const WAKE = 0.75;                 // minutes before their window ends the sleepers are up on their knees ⚙
const DOOR_PASS = [-0.17, -0.12, 0.12, 0.17]; // minutes round a pass: the Moked's doors swing for the officer's party ⚙
const CLOAK_FIRE = 'sim.night-watch.cloak';
// The round's phase (⚙ model choice: the sources fix none — "he went round every post", Middot 1:2; "all the night",
// Rambam BhB 8:10): he reaches the foot of the Chel steps, on his way in to Nikanor's post, DAWN_LEAD minutes after the
// default opening (src/time DEFAULT_OFFSET_FROM_ALOT) — in view of the start, at those steps, in its first minute
const DAWN_LEAD = 0.5;
// "Go" to his row (qa-r2 SIM-R2-5): a stand ahead of him on his way, a little to its side, facing back toward him, so he
// comes toward the viewer: the first of these (m ahead, m aside) that is open floor with him and a cone round him in
// clear view (no wall, pier or door leaf within VIEW_CONE.near) ⚙
// (15 m first: at his 1.15 m/s about 13 s of him coming on before he passes the viewer, a pace to the side)
const VIEW_AHEAD = [15, 12, 19, 9, 24, 6.5, 30, 36], VIEW_SIDE = [1.8, -1.8, 3, -3, 0];
const VIEW_CONE = { deg: 20, near: 3, level: 4 };
const VIEW_BEHIND = [-6, -9, -4];
const VIEW_PASS = { strict: { cone: true, level: true }, level: { cone: false, level: true, behind: true }, sight: { cone: false, level: false, behind: true } };
// the Mount's walkable floor inside its walls and stoas' back walls (site amot): the torch-bearers keep within it ⚙
const MOUNT_IN = [3, 497];
// m: at a post the torch-bearers stand this far ahead of him and to either side (the guard is STOP_OFFSET ahead); they
// move there over his last FLANK_BLEND metres to it ⚙
const FLANK_AHEAD = 0.9, FLANK_SIDE = 0.85, FLANK_BLEND = 2.5;
// the incident, as fractions of his visit (from the unanswered greeting to the event's end): blows, the guard up, the
// torch put to his garment, the fire out, the officer moves on (1) ⚙
const INC = { strike: [0.04, 0.12], wake: 0.12, back: [0.12, 0.15], bearer: [0.16, 0.62], fire: [0.2, 0.26, 0.55, 0.7] };
const STRIKE_SEC = 2.4;            // seconds a blow takes (people's 'strike': raised, down, held, back to the staff) ⚙
// people's STAFF.strike.tip: where the staff's tip lands, in the striker's frame (m, x his right, −z ahead) — on the
// sleeper's trunk; the sleeper ('sleep': origin at the feet, the body along his right, head 1.46 m away — g1/places.js
// FOOT) is struck at his hip, 2.2 amot along his body and 0.2 toward the way he faces ⚙
const STRIKE_TIP = { ahead: 1.32 / AMAH, right: 0.08 / AMAH }, HIP = { r: 2.2, f: 0.2 };
// the gates the Levites come in by and leave by (Middot 1:3: Tadi "served for nothing")
const EXITS = ['mount.gate.kiponus', 'mount.gate.shushan', 'mount.gate.chuldah-w', 'mount.gate.chuldah-e'];

export const FIXTURES = [{
  id: 'night-watch',
  title: { en: 'The night watch', he: 'משמרות הלילה' },
  when: { start: { at: 'tzeit' }, end: { at: 'sunrise', offset: -5 } },
  timing: { confidence: 'ordering', note: 'All night (Rambam BhB 8:2) until the gates open (Tamid 1:1); minutes are reconstruction.' },
  zone: 'har-habayit',
  pos: [478, 330.5, 0],
  summary: 'Levites stand at twenty-one posts and kohanim keep three; the Ish Har HaBayit goes round with torches.',
  sources: ['Middot 1:1', 'Middot 1:2', 'Tamid 1:1', 'Rambam BhB 8:4–10'],
  sounds: ['shalom-call'],
  choreo: 'night-watch',
  importance: 2,
  layer: 'ritual',
  fixture: true,
}];

export default {
  id: 'night-watch',
  lead: 16,       // the Kaporet guard walks to his post before the Azarah is locked
  lag: 3,         // the Levites walk out after the watch
  importance: 2,
  fixtures: FIXTURES,

  init(ctx, events, sim) {
    const posts = ctx.el('mount.watch-posts').params.posts.map((p) => ({ ...p, X: p.pos[0], Y: p.pos[1], Z: p.pos[2] }));
    const levites = posts.filter((p) => p.by === 'leviim');
    for (const p of levites) { p.face = faceOf(ctx, p); p.exit = exitOf(ctx, p); }
    sim.setBounds([-10, -10, -30], [510, 510, 50]);
    const upper = upperSleepers(ctx);
    const C = circuit(ctx, levites);
    const state = {
      levites, upper,
      guards: sim.pool({ name: 'guards', role: 'guard_levi', count: levites.length, seed: SEED, importance: 2, prop: null }),
      officer: sim.pool({ name: 'officer', role: 'guard_levi', count: 1, seed: SEED + 1, importance: 3, prop: null }),
      bearers: sim.pool({ name: 'torch-bearers', role: 'guard_levi', count: 2, seed: SEED + 2, importance: 3, prop: 'torch' }),
      upperPool: sim.pool({ name: 'rovim', role: 'kohen_offduty', count: upper.length, seed: SEED + 3, importance: 1, prop: null }),
      sway: levites.map((p, i) => wanderer(SEED + i * 31, 5 + 3 * rand(SEED, i))),
      // the circuit: its timeline is fixed by the straight legs; the walked line is nav's once ready
      stops: C.stops, entry: C.entry, nom: nominal(C.stops, C.entry),
      route: straightRoute(C.stops, { loop: true }),
      // after his event: out of the chel strip, across the Mount and down to his gate (the same split of timeline and line)
      exitWay: C.exitWay, exitNom: C.exitWay ? wayNominal(C.exitWay) : null, exitRoute: C.exitWay ? straightRoute(C.exitWay) : null,
      // the Moked's doors on his way: their stops, and (per date) the minutes after p0 when the party passes them
      passDoors: C.passes.map((id) => ({ id, door: sim.door(id), idx: C.stops.reduce((a, s, i) => (s.pass === id ? [...a, i] : a), []), e: null })),
      gpaths: levites.map(() => null),
      pathsVer: null, pathsBusy: false, routeSource: 'straight',
      plan: null, planGen: -1,
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
      tmp: {}, tmpA: {}, tmpB: {}, tmpG: {}, pat: {}, flank: {},
      patrol: null, cloak: null, cloakLevel: 0, cloakAt: null,
    };
    buildPaths(ctx, state);
    // "Go" to the officer's row: ahead of him on his way, facing back to him (the data's view when he is not out)
    try { state.offView = sim.schedule?.liveView?.('ish-har-habayit', (t) => officerView(ctx, state, sim, t)); } catch (e) { console.warn('[sim:night-watch] live view failed', e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    // colliders rebuilt since the paths were laid, or nav ready after the straight lines: lay them again
    if (!state.pathsBusy && (state.pathsVer !== (ctx.physics?.version ?? 0) || (state.routeSource === 'straight' && ctx.nav?.isReady))) buildPaths(ctx, state);
    const P = nightPlan(ctx, state, sim);
    const W = P.W;
    const shabbatNight = isShabbatNight(ctx, t);
    const incPost = W.incident ? state.levites.find((p) => p.id === W.incidentPost) : null;
    // he lay down where he should have stood; when he is up, the garment he slept under burns there
    state.cloakAt = incPost ? incPost : null;

    // ---- the officer, his torches and the sleeping guard (first: the guards turn toward him)
    const O = P.patrol ? patrolAt(state, P, t) : null;
    state.patrol = O;
    if (O) {
      const o = state.officer.slot(0);
      // his staff in his hand (Middot 1:2): planted at each post (people's 'staff'), passed along as he walks
      // ('staff_walk', stride-matched)
      let pose = O.walking ? 'staff_walk' : 'staff', ph = O.walking ? phaseFor(ctx, o, 'staff_walk', O.d) : undefined;
      let X = O.X, Y = O.Y, Z = O.Z, hd = O.heading;
      if (O.incident && incPost && O.u < INC.back[1]) {
        // "if he found him asleep, he struck him with his staff": a step to where the blow lands on the sleeper (people's
        // STAFF.strike.tip), three blows, then back before the post
        const S = strikeSpot(ctx, state, incPost, O);
        const k = O.u < INC.strike[1] ? smooth(0, INC.strike[0] - 0.005, O.u) : 1 - smooth(INC.back[0], INC.back[1], O.u);
        X += (S.X - X) * k; Y += (S.Y - Y) * k; Z += (S.Z - Z) * k;
        if (k > 0.98) hd = S.h; else if (k > 0.02) hd = headingTo(O.X, O.Y, S.X, S.Y);
        if (O.u > INC.strike[0] && O.u < INC.strike[1]) {
          const sec = (O.u - INC.strike[0]) * L(P) * 60, per = ((INC.strike[1] - INC.strike[0]) * L(P) * 60) / 3;
          pose = 'strike'; ph = Math.min(1, (sec % per) / STRIKE_SEC);
        } else pose = k > 0.02 && k < 0.98 ? 'staff_walk' : 'staff';
        if (pose === 'staff_walk') ph = phaseFor(ctx, o, 'staff_walk', Math.hypot(X - O.X, Y - O.Y) * AMAH);
      }
      o.placeNear(X, Y, Z).heading(hd).pose(pose, ph).prop('staff').show();
      if (!shabbatNight) {
        // no light in hand on Shabbat night — by analogy with the dawn inspection (Rambam BhB 8:12) ⚙
        const path = O.path || state.route.path, bw = O.walking && !O.gate;
        // at a post they stand before him, one either side, between him and the guard; blended in over his last metres
        // to it and out over his first metres from it (the path's "ahead" there would put them on the way back) ⚙
        const F = postBlend(state, O, state.flank);
        for (let k = 0; k < 2; k++) {
          const b = state.bearers.slot(k);
          const q = path.offset(O.dAhead, k ? -TORCH_SIDE : TORCH_SIDE, TORCH_AHEAD, k ? state.tmpB : state.tmpA);
          let X = q.X, Y = q.Y, Z = Number.isFinite(q.Z) ? q.Z : O.Z;
          let hd = bw ? q.heading : headingTo(X, Y, O.faceX, O.faceY);
          if (F.w > 0) {
            const h = (F.h * Math.PI) / 180, sd = k ? -FLANK_SIDE : FLANK_SIDE;
            const fx = F.X + (Math.sin(h) * FLANK_AHEAD + Math.cos(h) * sd) / AMAH, fy = F.Y + (Math.cos(h) * FLANK_AHEAD - Math.sin(h) * sd) / AMAH;
            X += (fx - X) * F.w; Y += (fy - Y) * F.w; Z += (F.Z - Z) * F.w;
            if (F.w > 0.5) hd = F.h;
          }
          // on the Mount's floor they keep inside its walls: along the north wall the path's side offset put one in the
          // wall (placed on its top, 40 amot up — qa-r2 SIM-R2-5) ⚙
          if (Math.abs(O.Z) < 1 && O.X > MOUNT_IN[0] && O.X < MOUNT_IN[1] && O.Y > MOUNT_IN[0] && O.Y < MOUNT_IN[1]) {
            X = clamp(X, MOUNT_IN[0], MOUNT_IN[1]); Y = clamp(Y, MOUNT_IN[0], MOUNT_IN[1]); Z = O.Z;
          }
          if (O.incident && k === 0 && state.cloakAt && O.u > INC.bearer[0] && O.u < INC.bearer[1]) {
            // the torch is put to the garment the guard slept under
            const c = state.cloakAt;
            const a = headingTo(c.X, c.Y, O.X, O.Y) * Math.PI / 180;
            X = c.X + Math.sin(a) * 1.7; Y = c.Y + Math.cos(a) * 1.7; Z = c.Z;
            hd = headingTo(X, Y, c.X, c.Y);
          }
          b.placeNear(X, Y, Z).heading(hd).pose(bw ? 'torch_walk' : 'torch', bw ? phaseFor(ctx, b, 'torch_walk', O.d + TORCH_AHEAD) : undefined).show();
        }
      }
    }
    // (outside the officer's window too: the update whose crossing holds his last greeting, just before the window
    // ends, may come after it — at 600× a frame is a sim minute)
    if (P.patrol) greetCues(ctx, state, sim, P);
    mokedDoors(state, P, t);
    incident(ctx, state, sim, t, W, incPost, shabbatNight);

    // ---- the 21 Levites: walking in through their gates, at their posts, walking out
    if (W.watch) guards(ctx, state, sim, t, P, O, incPost);

    // ---- the kohanim asleep at their posts
    if (W.upper && within(t, W.upper[0], W.upper[1])) sleepAll(state.upperPool, state.upper, t, W.upper);
  },

  release(ctx, state) { state.cloakLevel = 0; },

  debug(s) {
    const R = s.route, P = s.plan, O = s.patrol, f = s.fmt;
    const r = R ? ` ${(R.path.length / 1000).toFixed(2)} km, round ${s.nom.T.toFixed(1)} min` : '';
    const Q = P?.patrol;
    const pl = Q ? ` · ${Q.dawn ? `dawn anchor ${f(wrap(Q.p0 + CUE_LEAD + Q.uOpen))}, out ${f(wrap(Q.p0 + CUE_LEAD + Q.uStop))}` : `${Q.nEnd} rounds`} ×${Q.s1.toFixed(3)}/${Q.s2.toFixed(3)} · ${Q.arrT.length} greetings` : '';
    const st = O ? ` · ${O.incident ? `INCIDENT u=${O.u.toFixed(2)}` : O.exit ? (O.walking ? 'going out to his gate' : 'greeting his gate') : O.gate ? 'at his gate' : O.walking ? `to ${s.stops[(O.stop + 1) % s.stops.length].post?.id ?? 'via'}` : `at ${s.stops[O.stop].post?.id}`}` : '';
    const g = s.gpaths.filter(Boolean).length;
    return `route: ${s.routeSource}${r}${pl}\n   officer${st || ' off duty'} · guard paths ${g}/${s.gpaths.length} · watch ${f(P?.W.watch?.[0])}–${f(P?.W.watch?.[1])}`;
  },
};

const L = (P) => P.patrol?.L || 1;

// ------------------------------------------------------------------------------------------------ the day's plan

/** windows of each part of the scene and the officer's timeline for the current date — once per date */
function nightPlan(ctx, state, sim) {
  if (state.plan && state.planGen === sim.generation) return state.plan;
  const W = windows(ctx, sim);
  state.plan = { W, patrol: W.patrol ? patrolPlan(state, W) : null };
  state.planGen = sim.generation;
  return state.plan;
}

/** [t0, t1] of each part of the scene on the current date (real event ids; fixtures and fallbacks otherwise) */
function windows(ctx, sim) {
  const win = (ev) => (ev && Number.isFinite(ev.t0) ? [ev.t0, ev.t1] : null);
  const own = sim.events;
  const watchEv = own.find((ev) => ev.id === 'night-watch') || own[0];
  const watch = win(watchEv);
  const patrol = win(sim.event('ish-har-habayit')) || (watch ? [wrap(watch[0] + 8), watch[1]] : null);
  const incEv = sim.event('sleeping-guard');
  // he reaches the sleeping guard CUE_LEAD into the event: its unanswered "Shalom alecha" is the event's headline cue
  let incident = win(incEv), incidentPost = null;
  if (incident) incident = [wrap(incident[0] + CUE_LEAD), incident[1]];
  if (incident && patrol && since(incident[0], patrol[0]) < span(patrol[0], patrol[1])) {
    const at = Array.isArray(incEv.pos) ? incEv.pos : null;
    incidentPost = at ? nearestPost(sim.ctx, at) : null;
  }
  if (!incidentPost) incident = null;
  const lockEv = sim.schedule.byId('locking-up');
  const lockStart = lockEv && Number.isFinite(lockEv.t0) ? lockEv.t0 : (watch ? wrap(watch[0] - 15) : NaN);
  // the default opening (alot − 6) + DAWN_LEAD: when he is at the foot of the Chel steps
  const alot = ctx.time?.zmanim?.alot;
  const dawn = Number.isFinite(alot) ? wrap(alot + DEFAULT_OFFSET_FROM_ALOT + DAWN_LEAD) : NaN;
  return { watch, upper: win(sim.event('watch-upper-chambers')) || watch, patrol, incident, incidentPost, lockStart, dawn };
}

/**
 * The officer's night. His own timeline v (minutes): rounds of nom.T laid end to end from his first arrival at the
 * Chuldah post. Real time u (minutes since that arrival, = p0 + CUE_LEAD) maps onto it with scales close to 1:
 * s1 until he reaches the sleeping guard exactly at the incident's anchor (the visit lasts the incident), s2 after it
 * until the dawn anchor — the foot of the Chel steps on his way in to Nikanor (the stop marked 'dawn') at W.dawn —
 * and 1 after that, to the first pass of the soreg's east entry (the stop marked 'exit') at or after his event's end;
 * from there he walks the exit way to his gate, greets its guard and goes out (exitAt). Without a usable dawn anchor
 * s2 is set so that his last round ends back at his gate, greeting it, just before his event ends.
 */
function patrolPlan(state, W) {
  const nom = state.nom, T = nom.T, stops = state.stops;
  const p0 = W.patrol[0], len = span(W.patrol[0], W.patrol[1]);
  const inMin = nom.inMin;
  const Utot = Math.max(1, len - CUE_LEAD - inMin);
  let uInc = NaN, vInc = NaN, kInc = -1, Linc = 0, s1 = 1;
  if (W.incident) {
    kInc = stops.findIndex((s) => s.post?.id === W.incidentPost);
    if (kInc >= 0) {
      uInc = since(W.incident[0], p0) - CUE_LEAD;
      Linc = Math.max(DWELL, span(W.incident[0], W.incident[1]));
      if (!(uInc > 0 && uInc + Linc < Utot)) uInc = NaN;
    }
  }
  if (Number.isFinite(uInc)) {
    const r = Math.max(0, Math.round((uInc - nom.tDwell[kInc]) / T));
    vInc = r * T + nom.tDwell[kInc];
    s1 = vInc > 0 ? uInc / vInc : 1;
  }
  const inc = Number.isFinite(uInc);
  const u2 = inc ? uInc + Linc : 0, v2 = inc ? vInc + DWELL : 0;
  const Q = { p0, len, inMin, Utot, uInc, vInc, kInc, L: Linc, s1, s2: 1, nEnd: 0, inc, u2, v2, dawn: false, vMax: 0 };
  const D = dawnAnchor(state, W, Q);
  if (D) {
    Object.assign(Q, D);
    Q.Utot = Infinity;
    Q.vMax = D.vStop;
  } else {
    // the last arrival at his gate (stop 0) at v = nEnd·T, then his greeting there, then out
    let nEnd = Math.max(Math.floor(v2 / T) + 1, Math.round((Utot - u2 + v2 - DWELL) / T));
    if (nEnd < 1) nEnd = 1;
    Q.nEnd = nEnd;
    Q.s2 = (Utot - u2) / (nEnd * T + DWELL - v2);
    Q.vMax = nEnd * T;
  }
  // every greeting of the night (minutes after p0, clock time, stop, cue key), in order — precomputed, so the
  // per-frame check is a binary search and allocates nothing
  const arrE = [], arrK = [], arrKey = [];
  for (let r = 0; r * T <= Q.vMax + 1e-9; r++) {
    for (let k = 0; k < stops.length; k++) {
      if (!stops[k].post) continue;
      const v = r * T + nom.tDwell[k];
      if (v > Q.vMax + 1e-9) break;
      arrE.push(CUE_LEAD + uOf(Q, v)); arrK.push(k); arrKey.push(`shalom:${r}:${stops[k].post.id}`);
    }
  }
  if (Q.dawn && stops[0].post) { arrE.push(CUE_LEAD + Q.uStop + Q.xS0); arrK.push(0); arrKey.push(`shalom:out:${stops[0].post.id}`); }
  // the Moked's doors: when the party passes each (going in and coming out, every round), minutes after p0
  const vDoors = Q.dawn ? Q.vStop : Q.nEnd * T;
  for (const pd of state.passDoors) {
    const es = [];
    for (let r = 0; r * T < vDoors; r++) for (const i of pd.idx) { const v = r * T + nom.tDwell[i]; if (v < vDoors) es.push(CUE_LEAD + uOf(Q, v)); }
    pd.e = Float64Array.from(es);
  }
  Q.arrE = Float64Array.from(arrE);
  Q.arrT = Float64Array.from(arrE, (e) => wrap(p0 + e));
  Q.arrK = arrK; Q.arrKey = arrKey;
  return Q;
}

/**
 * The dawn anchor (⚙ model choice, see DAWN_LEAD): v of his arrival at the 'dawn' stop nearest a scale of 1 from the
 * previous anchor (the incident, or his first greeting), then ×1 to the first pass of the 'exit' stop at or after his
 * event's end. null when the opening is not inside his window or no exit way exists (then the old rule holds).
 */
function dawnAnchor(state, W, Q) {
  const nom = state.nom, T = nom.T, stops = state.stops, X = state.exitNom;
  const kD = stops.findIndex((s) => s.dawn), kX = stops.findIndex((s) => s.exit);
  if (kD < 0 || kX < 0 || !X || !Number.isFinite(W.dawn) || !W.patrol) return null;
  const uOpen = since(W.dawn, Q.p0) - CUE_LEAD;
  const uFrom = Q.inc ? Q.u2 : 0, vFrom = Q.inc ? Q.v2 : 0;
  // the opening falls in his window, at least half a round after his start (or the incident), not after his window
  if (!(uOpen > uFrom + T / 2 && uOpen + CUE_LEAD < Q.len)) return null;
  const tD = nom.tDwell[kD];
  let r = Math.round((uOpen - uFrom + vFrom - tD) / T);
  while (r * T + tD <= vFrom + T / 4) r++;
  const vOpen = r * T + tD;
  const sc = (uOpen - uFrom) / (vOpen - vFrom);
  // ×1 after the anchor, to the first pass of the exit stop at or after his event's end
  const vEnd = vOpen + since(W.patrol[1], W.dawn);
  const tX = nom.tDwell[kX];
  let rx = Math.floor((vEnd - tX) / T);
  if (rx * T + tX < vEnd - 1e-9) rx++;
  const vStop = rx * T + tX, uStop = uOpen + (vStop - vOpen);
  const atS0 = X.at[X.iS0], atE = X.at[X.iE];
  const xS0 = atS0 / PATROL_SPEED / 60, xOut = (atE - atS0) / PATROL_SPEED / 60;
  const len = CUE_LEAD + uStop + xS0 + DWELL + xOut;
  // out before the Levites leave their posts (the night watch's end) ⚙
  if (W.watch && since(wrap(Q.p0 + len), W.watch[0]) > span(W.watch[0], W.watch[1])) return null;
  return { dawn: true, kD, kX, uOpen, vOpen, vStop, uStop, xS0, xOut, len, s1: Q.inc ? Q.s1 : sc, s2: sc };
}

/** minutes after his first greeting (u) of moment v on his own timeline (ascending in v) */
function uOf(Q, v) {
  if (Q.inc && v <= Q.vInc) return v * Q.s1;
  if (Q.dawn && v >= Q.vOpen) return Q.uOpen + (v - Q.vOpen);
  return Q.inc ? Q.u2 + (v - Q.v2) * Q.s2 : v * (Q.dawn ? Q.s1 : Q.s2);
}

/**
 * The officer at time t → O { X, Y, Z, heading, d, dAhead, path, walking, stop, faceX/Y, incident, u, gate, exit }
 * (state.pat by default; tmp = a scratch for path samples)
 */
function patrolAt(state, P, t, O = state.pat, tmp = state.tmp) {
  const Q = P.patrol, nom = state.nom, R = state.route;
  const e = since(t, Q.p0);
  if (e >= Q.len) return null;
  const s0 = state.stops[0];
  O.incident = false; O.u = 0; O.stop = 0; O.gate = false; O.exit = false; O.path = R.path;
  const u = e - CUE_LEAD;
  if (Q.dawn && u >= Q.uStop) return exitAt(state, Q, u - Q.uStop, O, tmp);
  if (u < 0 || u >= Q.Utot) {
    // coming in by his gate (from the portal to the guard) / going out after his last greeting there
    const k = u < 0 ? clamp((e - (CUE_LEAD - Q.inMin)) / Q.inMin) : 1 - clamp((u - Q.Utot) / Q.inMin);
    const E = state.entry;
    O.X = E.X + (s0.X - E.X) * k; O.Y = E.Y + (s0.Y - E.Y) * k; O.Z = E.Z + (s0.Z - E.Z) * k;
    O.walking = k > 0 && k < 1;
    O.heading = u < 0 ? headingTo(E.X, E.Y, s0.X, s0.Y) : headingTo(s0.X, s0.Y, E.X, E.Y);
    O.d = 0; O.dAhead = 0; O.gate = true;
    O.faceX = s0.post.X; O.faceY = s0.post.Y;
    return O;
  }
  let v;
  if (Q.inc && u < Q.uInc) v = u / Q.s1;
  else if (Q.inc && u < Q.u2) { v = Q.vInc; O.incident = true; O.u = (u - Q.uInc) / Q.L; }
  else if (Q.dawn && u >= Q.uOpen) v = Q.vOpen + (u - Q.uOpen);
  else if (Q.inc) v = Q.v2 + (u - Q.u2) / Q.s2;
  else v = u / (Q.dawn ? Q.s1 : Q.s2);
  const round = Math.floor(v / nom.T + 1e-9);
  const w = Math.max(0, v - round * nom.T);
  let i = nom.tDwell.length - 1;
  if (O.incident) i = Q.kInc;
  else while (i > 0 && w < nom.tDwell[i] - 1e-9) i--;
  const walking = !O.incident && w >= nom.tWalk[i];
  const at = R.at;
  const d = walking ? at[i] + clamp((w - nom.tWalk[i]) / (nom.tNext[i] - nom.tWalk[i] || 1)) * (at[i + 1] - at[i]) : at[i];
  const q = R.path.sample(d, tmp);
  const st = state.stops[i];
  O.X = q.X; O.Y = q.Y; O.Z = Number.isFinite(q.Z) ? q.Z : st.Z;
  O.walking = walking; O.stop = i; O.d = d; O.dAhead = d;
  O.faceX = st.post ? st.post.X : q.X; O.faceY = st.post ? st.post.Y : q.Y;
  O.heading = walking || !st.post ? q.heading : headingTo(q.X, q.Y, st.post.X, st.post.Y);
  return O;
}

/** after his rounds (dawn variant): along the exit way to his gate's guard, the greeting, and out through the portal */
function exitAt(state, Q, w, O, tmp) {
  const X = state.exitNom, XR = state.exitRoute, s0 = state.stops[0];
  const atS0 = X.at[X.iS0];
  let ds = 0, walking = true;
  if (w < Q.xS0) ds = w * 60 * PATROL_SPEED;
  else if (w < Q.xS0 + DWELL) { ds = atS0; walking = false; }
  else ds = Math.min(X.at[X.iE], atS0 + (w - Q.xS0 - DWELL) * 60 * PATROL_SPEED);
  // the nominal metres onto the walked line, leg by leg (as the circuit: nav reshapes the line, not the timeline)
  const d = mapLegs(X.at, XR.at, ds);
  const q = XR.path.sample(d, tmp);
  O.X = q.X; O.Y = q.Y; O.Z = Number.isFinite(q.Z) ? q.Z : s0.Z;
  O.walking = walking; O.stop = 0; O.d = d; O.dAhead = d; O.path = XR.path; O.exit = true;
  O.faceX = walking ? q.X : s0.post.X; O.faceY = walking ? q.Y : s0.post.Y;
  O.heading = walking ? q.heading : headingTo(q.X, q.Y, s0.post.X, s0.post.Y);
  return O;
}

/**
 * Where the torch-bearers flank him at a post: out { w (0..1: how far they have moved there), X, Y, Z (his stand),
 * h (toward the guard) } — 1 while he stands at a post, rising over his last FLANK_BLEND metres to one and falling over
 * his first metres from one (not during the incident: its own staging)
 */
function postBlend(state, O, out) {
  out.w = 0;
  if (O.incident) return out;
  const stops = state.stops;
  const set = (st, w) => {
    out.w = w * w * (3 - 2 * w); out.X = st.X; out.Y = st.Y; out.Z = st.Z;
    out.h = headingTo(st.X, st.Y, st.post.X, st.post.Y);
    return out;
  };
  if (O.gate) {
    // between his gate's portal and its guard
    const s0 = stops[0], dd = Math.hypot(O.X - s0.X, O.Y - s0.Y) * AMAH;
    return dd < FLANK_BLEND && s0.post ? set(s0, 1 - dd / FLANK_BLEND) : out;
  }
  if (O.exit) {
    const X = state.exitRoute, i = state.exitNom.iS0, s0 = stops[0];
    const dd = Math.abs(X.at[i] - O.d);
    return dd < FLANK_BLEND && s0.post ? set(s0, 1 - dd / FLANK_BLEND) : out;
  }
  const i = O.stop, st = stops[i];
  if (!O.walking) return st.post ? set(st, 1) : out;
  const at = state.route.at, n = stops.length;
  const next = stops[(i + 1) % n];
  const toNext = at[i + 1] - O.d, fromThis = O.d - at[i];
  if (next.post && toNext < FLANK_BLEND) return set(next, 1 - toNext / FLANK_BLEND);
  if (st.post && fromThis < FLANK_BLEND) return set(st, 1 - fromThis / FLANK_BLEND);
  return out;
}

/** a distance along waypoint legs measured one way (nomAt) → the same fraction of the same leg another way (at) */
function mapLegs(nomAt, at, ds) {
  let i = upperBound(nomAt, ds) - 1;
  if (i < 0) i = 0;
  if (i > nomAt.length - 2) i = nomAt.length - 2;
  const L = nomAt[i + 1] - nomAt[i];
  return at[i] + clamp(L > 1e-9 ? (ds - nomAt[i]) / L : 0) * (at[i + 1] - at[i]);
}

/**
 * "Go" to his row: a stand ahead of him on the line he walks, a little to its side, facing back toward him — he comes
 * toward the viewer (behind him he walked out of the frame in seconds — qa-r2 SIM-R2-5). The first candidate (VIEW_AHEAD
 * × VIEW_SIDE) on open floor at his level, with nothing solid at +1 m, him in sight from the eye and a cone of ±20° round
 * him clear for VIEW_CONE.near metres (walls, piers, door leaves — the Moked's wicket); none: the nearest up his round.
 * Cached for 2 s of the clock; null when he is not out.
 */
const _vo = {}, _vt = {}, _vq = {};
let _vc = { key: '', v: null };
function officerView(ctx, state, sim, t) {
  if (!Number.isFinite(t)) return null;
  const P = nightPlan(ctx, state, sim);
  if (!P.patrol) return null;
  const key = `${sim.generation}:${Math.round(t * 30)}:${state.pathsVer}`;
  if (_vc.key === key && _vc.ctx === ctx) return _vc.v;
  const O = patrolAt(state, P, t, _vo, _vt);
  let v = null;
  if (O) {
    // at his gate's portal (coming in / going out by it): from his first stop on, up his round
    const path = O.gate ? state.route.path : O.path || state.route.path;
    const d0 = O.gate ? 0 : O.d;
    const doors = doorBoxes(ctx);
    let first = null;
    // (in a passage or on a stair nothing passes the cone: then nothing close ahead and him in sight; then him in sight
    // alone, from behind him too — down a stair the treads hide him from above)
    for (const pass of [VIEW_PASS.strict, VIEW_PASS.level, VIEW_PASS.sight]) {
      for (const a of pass.behind ? [...VIEW_AHEAD, ...VIEW_BEHIND] : VIEW_AHEAD) {
        for (const side of VIEW_SIDE) {
          const dd = d0 + a;
          const q = path.offset(path.loop ? dd : clamp(dd, 0, path.length), side, 0, _vq);
          const zHint = Number.isFinite(q.Z) ? q.Z : O.Z;
          const Z = floorZ(ctx, q.X, q.Y, zHint);
          if (!Number.isFinite(Z)) continue;
          const c = { at: [q.X, q.Y, Z], heading: headingTo(q.X, q.Y, O.X, O.Y) };
          first ||= c;
          if (Math.abs(Z - zHint) <= 1 && clearView(ctx, c, O, doors, pass)) { v = c; break; }
        }
        if (v) break;
      }
      if (v) break;
    }
    v ||= first;
  }
  _vc = { key, ctx, v };
  return v;
}

/** world AABBs of the door leaves as they stand now (ctx.movables 'door:*'), leaf by leaf (a door's group box would
 *  span its open gateway) */
function doorBoxes(ctx) {
  const out = [];
  const M = ctx.movables;
  if (!M?.forEach) return out;
  M.forEach((obj, id) => {
    if (!String(id).startsWith('door:') || !obj?.isObject3D || obj.visible === false) return;
    obj.updateMatrixWorld?.(true);
    obj.traverse((m) => {
      if (!m.isMesh || m.visible === false) return;
      const b = new Box3().setFromObject(m);
      if (!b.isEmpty()) out.push(b);
    });
  });
  return out;
}

const _o = new Vector3(), _d = new Vector3(), _ray = new Ray(), _hit = new Vector3();
/** the viewer's stand: nothing solid at +1 m; him in sight from the eye; a ±VIEW_CONE.deg cone toward him clear near by */
function clearView(ctx, c, O, doors, pass = VIEW_PASS.strict) {
  const ph = ctx.physics;
  if (!ph?.raycast) return true;
  const x = c.at[0] * AMAH, z = -c.at[1] * AMAH, y = c.at[2] * AMAH;
  if (ph.insideAt?.(x, y + 1.0, z)) return false;
  _o.set(x, y + 1.6, z);
  const blocked = (dir, far) => {
    const h = ph.raycast(_o, dir, far);
    if (h && h.distance < far) return true;
    _ray.set(_o, dir);
    for (const b of doors) if (_ray.intersectBox(b, _hit) && _hit.distanceTo(_o) < far) return true;
    return false;
  };
  // him: from the eye to his chest
  _d.set(O.X * AMAH - x, (Number.isFinite(O.Z) ? O.Z : c.at[2]) * AMAH + 1.3 - (y + 1.6), -O.Y * AMAH - z);
  const L = _d.length();
  if (L < 1.5) return false;
  _d.multiplyScalar(1 / L);
  if (blocked(_d, L - 0.5)) return false;
  // straight ahead (level) nothing within VIEW_CONE.level metres; the cone round him: nothing within VIEW_CONE.near
  const h0 = Math.atan2(_d.x, -_d.z);
  if (pass.level && blocked(new Vector3(Math.sin(h0), 0, -Math.cos(h0)), VIEW_CONE.level)) return false;
  if (!pass.cone) return true;
  for (const s of [-1, 1]) {
    const a = h0 + (s * VIEW_CONE.deg * Math.PI) / 180;
    if (blocked(new Vector3(Math.sin(a), 0, -Math.cos(a)), VIEW_CONE.near)) return false;
  }
  return true;
}

/** "Shalom alecha!" as he reaches each post — only for arrivals the continuous clock runs through */
function greetCues(ctx, state, sim, P) {
  const Q = P.patrol, c = sim.crossing;
  if (!c.ok) return;
  // the arrivals in this update's crossing interval, found by offset from the patrol's start; crossed() decides
  let a = since(c.from, Q.p0);
  if (a > 1440 - c.span - 1e-6) a -= 1440;           // the interval straddles the start
  const b = a + c.span + 1e-6;
  for (let i = upperBound(Q.arrE, a - 1e-6); i < Q.arrE.length && Q.arrE[i] <= b; i++) {
    if (!crossed(state, Q.arrT[i])) continue;
    const stop = state.stops[Q.arrK[i]];
    cueAt(state, Q.arrKey[i], Q.arrT[i], () => {
      sim.sound('shalom-call', [stop.X, stop.Y, stop.Z + 3.3], { caption: false });
      if (near(ctx, stop, CAPTION_RANGE)) {
        sim.caption({ en: `"Shalom alecha!" — the Ish Har HaBayit at the post of ${stop.post.place}, on his round (Middot 1:2)`, he: 'שָׁלוֹם עָלֶיךָ!' },
          { id: 'shalom-call', duration: 4.5, pos: m2w(stop.X, stop.Y, stop.Z) });
      }
    });
  }
}

/** Beit HaMoked's door to the chel and the wicket to the Azarah (Middot 1:7) swing for the party as it passes */
function mokedDoors(state, P, t) {
  const Q = P.patrol;
  if (!Q) return;
  const e = since(t, Q.p0);
  if (e >= Q.len) return;
  for (let k = 0; k < state.passDoors.length; k++) {
    const pd = state.passDoors[k];
    if (!pd.door.exists || !pd.e) continue;
    let a = 0;
    for (let i = upperBound(pd.e, e - DOOR_PASS[3]); i < pd.e.length && pd.e[i] < e - DOOR_PASS[0]; i++) {
      a = Math.max(a, window4(e - pd.e[i], DOOR_PASS[0], DOOR_PASS[1], DOOR_PASS[2], DOOR_PASS[3]));   // minutes from the pass
    }
    if (a > 0) pd.door.set(a);
  }
}

// ------------------------------------------------------------------------------------------------ the Levites

/**
 * Each Levite walks in from his gate to arrive at his post as the watch begins (the guard behind the Kaporet before
 * the Azarah is locked), stands his watch — facing what he guards, swaying a little, turning to the officer as he
 * comes — and walks out by the same gate when it ends. The walks follow nav (the posts stand from the start).
 */
function guards(ctx, state, sim, t, P, O, incPost) {
  const W = P.W;
  const t1 = W.watch[1];
  const swayFrom = wrap(W.watch[0] - 20);
  let asleep = false, aside = false;
  if (incPost) {
    const [i0, i1] = W.incident;
    const u = within(t, i0, i1) ? since(t, i0) / (span(i0, i1) || 1) : -1;
    asleep = within(t, wrap(i0 - ASLEEP_BEFORE), i1) && !(u >= INC.wake);
    aside = u >= INC.wake && u < INC.fire[3];           // up, off the garment that burns where he lay
  }
  for (let i = 0; i < state.levites.length; i++) {
    const p = state.levites[i];
    const g = state.guards.slot(i);
    const gp = state.gpaths[i];
    const tArr = p.id === 'achorei-beit-hakaporet' && Number.isFinite(W.lockStart) ? wrap(W.lockStart + KAPORET_EARLY) : W.watch[0];
    const wm = gp ? gp.min : 0;
    const t0 = wrap(tArr - wm), tEnd = wrap(t1 + wm);
    if (!within(t, t0, tEnd)) continue;
    if (!sim.due(g)) continue;
    const sOn = since(t, t0), sOff = since(t, t1);
    if (gp && sOn < wm) { walkGuard(ctx, state, g, gp, (sOn / wm) * gp.len, false); continue; }
    if (gp && sOff < wm && within(t, t1, tEnd)) { walkGuard(ctx, state, g, gp, gp.len - (sOff / wm) * gp.len, true); continue; }
    if (asleep && p === incPost) {
      // asleep at his post, on the ground (Middot 1:2), along the court's wall, clear of the post's lamp stand ⚙
      g.placeNear(p.X, p.Y, p.Z).heading(sleeperHeading(ctx, p)).pose('sleep').show();
      continue;
    }
    let X = p.X, Y = p.Y;
    if (aside && p === incPost) { const r = (p.face * Math.PI) / 180; X += Math.sin(r) * 1.5; Y += Math.cos(r) * 1.5; }
    let h = p.face + 16 * state.sway[i](since(t, swayFrom));
    if (O && !O.gate) {
      const dist = Math.hypot((O.X - X) * AMAH, (O.Y - Y) * AMAH);
      if (dist < GREET_RANGE) h += angleDiff(h, headingTo(X, Y, O.X, O.Y)) * clamp((GREET_RANGE - dist) / 4);
    }
    g.placeNear(X, Y, p.Z).heading(((h % 360) + 360) % 360).pose('stand').show();
  }
}

function walkGuard(ctx, state, g, gp, d, out) {
  const q = gp.path.sample(clamp(d, 0, gp.len), state.tmpG);
  g.placeNear(q.X, q.Y, Number.isFinite(q.Z) ? q.Z : 0).heading(out ? (q.heading + 180) % 360 : q.heading)
    .pose('walk', phaseFor(ctx, g, 'walk', out ? gp.len - d : d)).show();
}

/** Friday after midday → the coming night is Shabbat; Shabbat before midday → the night just past was */
function isShabbatNight(ctx, t) {
  const d = ctx.time?.dayType;
  return (d === 'friday' && t >= 720) || (d === 'shabbat' && t < 720);
}

function phaseFor(ctx, slot, pose, meters) {
  const f = ctx.people?.util?.phaseFor;
  if (f && slot.actor) return f(slot.actor, pose, Math.max(0, meters));
  const p = Math.max(0, meters) / 1.45;
  return p - Math.floor(p);
}

/** sleepers in their own clothes; in the last WAKE minutes of their window they are up on their knees ⚙ */
function sleepAll(pool, list, t, win) {
  const waking = since(win[1], t) <= WAKE;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    pool.slot(i).place(s.X, s.Y, s.Z).heading(s.heading).pose(waking ? 'kneel' : s.pose).show();
  }
}

// ------------------------------------------------------------------------------------------------ places

const centre = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];

function nearestPost(ctx, at) {
  const posts = ctx.el('mount.watch-posts').params.posts;
  let best = null, bd = Infinity;
  for (const p of posts) {
    if (p.by !== 'leviim') continue;
    const d = Math.hypot(p.pos[0] - at[0], p.pos[1] - at[1]);
    if (d < bd) { bd = d; best = p.id; }
  }
  return best;
}

/** which way a guard faces: Mount gates — into the gateway; Mount corners — over the Mount; posts of the courts and
 * chambers — outward, away from what they guard ⚙ */
function faceOf(ctx, p) {
  const el = (id) => ctx.elOpt(id)?.box;
  const mountGate = /^gate-(shushan|kiponus|tadi|chuldah-[we])$/.exec(p.id);
  if (mountGate) { const b = el(`mount.gate.${mountGate[1]}`); if (b) { const c = centre(b); return headingTo(p.X, p.Y, c[0], c[1]); } }
  if (p.id.startsWith('mount-')) { const b = el('mount.floor'); const c = b ? centre(b) : [250, 250]; return headingTo(p.X, p.Y, c[0], c[1]); }
  const azGate = /^gate-(delek|bechorot|mayim|korban|nikanor)$/.exec(p.id);
  if (azGate) { const b = el(`azarah.gate.${azGate[1]}`); if (b) { const c = centre(b); return headingTo(c[0], c[1], p.X, p.Y); } }
  if (p.id.startsWith('lishkat-')) { const b = el(`mount.chamber.${p.id.slice(10)}`); if (b) { const c = centre(b); return headingTo(c[0], c[1], p.X, p.Y); } }
  if (p.id.startsWith('achorei')) return 270; // behind the House, looking west along its back ⚙
  const s = el('azarah.wall.south'), n = el('azarah.wall.north');
  const c = s && n ? [(s.min[0] + s.max[0]) / 2, (s.max[1] + n.min[1]) / 2] : [159, 330.5];
  return headingTo(c[0], c[1], p.X, p.Y);
}

/** the gate a Levite comes in by: the nearest of the Mount's entries (a point inside its passage) ⚙ */
function exitOf(ctx, p) {
  let best = null, bd = Infinity;
  for (const id of EXITS) {
    const b = ctx.elOpt(id)?.box;
    if (!b) continue;
    const X = (b.min[0] + b.max[0]) / 2, Y = (b.min[1] + b.max[1]) / 2;
    const d = Math.hypot(X - p.X, Y - p.Y);
    if (d < bd) { bd = d; best = { X, Y, Z: b.min[2], id }; }
  }
  return best;
}

/** where the guard lies asleep at his post (his 'sleep' heading: along the court's wall) */
function sleeperHeading(ctx, p) { return p.Y < (ctx.site?.axisY ?? 330.5) ? 180 : 0; }

/** the officer's spot and heading for the blow: the staff's tip (STRIKE_TIP) on the sleeper's hip, approached from
 *  where he stopped before the post (cached per post) */
function strikeSpot(ctx, state, p, O) {
  if (state.strike?.post === p) return state.strike;
  const hs = (sleeperHeading(ctx, p) * Math.PI) / 180;
  const T = [p.X + Math.cos(hs) * HIP.r + Math.sin(hs) * HIP.f, p.Y - Math.sin(hs) * HIP.r + Math.cos(hs) * HIP.f];   // right = (cos h, −sin h)
  const st = standOf(ctx, p);
  const h = headingTo(st.X, st.Y, T[0], T[1]), a = (h * Math.PI) / 180;
  const X = T[0] - Math.sin(a) * STRIKE_TIP.ahead - Math.cos(a) * STRIKE_TIP.right;
  const Y = T[1] - Math.cos(a) * STRIKE_TIP.ahead + Math.sin(a) * STRIKE_TIP.right;
  state.strike = { post: p, X, Y, Z: floorZ(ctx, X, Y, p.Z) ?? p.Z, h };
  return state.strike;
}

/** a stand on the Mount behind a gate's guard (he faces into his gateway), on the floor nearest the post */
function behindOf(ctx, p) {
  const r = (p.face * Math.PI) / 180;
  const X = p.X - Math.sin(r) * STOP_OFFSET, Y = p.Y - Math.cos(r) * STOP_OFFSET;
  return [X, Y, floorZ(ctx, X, Y, p.Z) ?? p.Z];
}

/** the officer stops in front of the guard, on the floor nearest the post */
function standOf(ctx, p) {
  const r = (p.face * Math.PI) / 180;
  const X = p.X + Math.sin(r) * STOP_OFFSET, Y = p.Y + Math.cos(r) * STOP_OFFSET;
  return { X, Y, Z: floorZ(ctx, X, Y, p.Z) ?? p.Z };
}

/**
 * The officer's circuit (order ⚙; the sources say only "he went round every post, all night"): in by the western
 * Chuldah gate (Middot 1:3 — the Chuldah gates serve entry and exit) and through the tunnels to the eastern one; the
 * Mount's SE corner; in at the soreg's east entry to the Azarah's two eastern corners and up through the Ezrat Nashim
 * to Nikanor; round the north to Beit HaMoked, through its wicket into the Azarah — "through which they entered to
 * search the Azarah" (Middot 1:7) — to the post behind the Kaporet and back; the two northern chambers and the Korban
 * gate up its flight; the Azarah's two western corners, greeted across the soreg (the gate flights close those strips
 * of the chel off); the three southern gates up their flights; and the Mount's east, north and west. The Azarah's
 * gates are shut: no leg passes through them (nav ignores door leaves, so the waypoints keep to the open ways).
 * Entries: a post id = a stop in front of that guard; [X,Y,Z] = a point walked through; pass = a door it opens.
 */
function circuit(ctx, levites) {
  const byId = new Map(levites.map((p) => [p.id, p]));
  const el = (id) => ctx.elOpt(id);
  const box = (id) => el(id)?.box || null;
  const stops = [];
  const via = (X, Y, Z = 0, opt) => stops.push({ post: null, X, Y, Z, ...opt });
  const post = (id, at) => {
    const p = byId.get(id);
    if (!p) return;
    // at the Mount's own gates the guard faces into his gateway: the officer greets him from the Mount, behind him
    // (in front of him stood in the shut gate's passage, the bearers in its wall — qa-r2 SIM-R2-5) ⚙
    if (!at && /^gate-(tadi|shushan|kiponus)$/.test(id)) at = behindOf(ctx, p);
    stops.push({ post: p, ...(at ? { X: at[0], Y: at[1], Z: at[2] ?? p.Z } : standOf(ctx, p)) });
  };
  const flightFoot = (gate, dy) => { const f = el(`azarah.gate.${gate}.flight`)?.params?.foot; return f ? [f[0], f[1] + dy, f[2]] : null; };
  const viaP = (p, opt) => { if (p) via(p[0], p[1], p[2] ?? 0, opt); };
  // the Chuldah tunnels: level from the gate, then a stair up to the Mount
  const tunnel = (side) => {
    const sp = el(`context.chuldah.tunnel-${side}`)?.params?.stairPath;
    return sp ? { low: [sp.from[0], sp.from[1], sp.from[2]], high: [sp.to[0], sp.to[1] + 1.5, sp.to[2]] } : null;
  };
  const tw = tunnel('w'), te = tunnel('e');
  // the chel steps at the soreg's east entry, the strip between the soreg and the Ezrat Nashim's east wall
  const cs = el('mount.chel.steps')?.params;
  const out = cs ? [cs.foot[0] + 1, cs.foot[1], 0] : [408, 330.5, 0];
  const inEN = cs ? [cs.head[0] - 3, cs.head[1], cs.head[2]] : [397, 330.5, 6];
  const rx = 404.5;
  // Beit HaMoked: its flight from the chel, its door, the hall, the wicket in the Azarah gate's east leaf
  const mf = box('azarah.moked.flight'), mh = box('azarah.moked.hall');
  const pish = el('azarah.gate.moked')?.params?.pishpash?.box;
  const mx = mf ? (mf.min[0] + mf.max[0]) / 2 : 210.75;
  const moked = mf && mh && pish ? {
    foot: [mx, mf.max[1] + 2, 0], door: [mx, mf.min[1] - 1, mh.min[2]], hall: [mx, mh.min[1] + 6, mh.min[2]],
    out: [(pish.min[0] + pish.max[0]) / 2, pish.max[1] + 1.5, pish.min[2]], pass: [(pish.min[0] + pish.max[0]) / 2, (pish.min[1] + pish.max[1]) / 2, pish.min[2]],
    in: [(pish.min[0] + pish.max[0]) / 2, pish.min[1] - 2, pish.min[2]],
  } : null;
  const DOOR_CHEL = 'azarah.moked.door-chel', PISH = 'azarah.gate.moked.pishpash';
  // across the hall (Middot 1:6–7): down the hearth's west side between it and the west bay's mat, along its south side
  // between it and the mats by the kodesh line, then down the east lane between the slab kohen's mat and the seats by the
  // east ledges into the kodesh half — clear of the sleepers moked-night lays out (g1/plan.js floorPlan: by the hearth's
  // centre, the hall's axis and the kodesh line) and of the fire ⚙
  let hallWay = null;
  try {
    const H = mokedPlaces(ctx), hx = H.cx, ky = H.ky, hz = H.Z;
    hallWay = [[hx - 2.15, ky + 8.4], [hx - 2.25, ky + 5.0], [hx - 1.45, ky + 2.75], [hx + 1.45, ky + 2.5], [hx + 4.65, ky + 2.2], [hx + 4.65, ky - 0.6]].map(([X, Y]) => [X, Y, hz]);
  } catch { hallWay = moked ? [moked.hall] : null; }

  post('gate-chuldah-w');
  if (tw && te) { viaP(tw.low); viaP(tw.high); viaP(te.high); viaP(te.low); }
  post('gate-chuldah-e');
  if (te) { viaP(te.low); viaP(te.high); }
  post('mount-se');
  viaP(out); via(rx, 316); via(rx, 253);
  post('azarah-se');
  via(rx, 253); via(rx, 316); viaP(out, { dawn: true }); viaP(inEN);
  post('gate-nikanor');
  viaP(inEN); viaP(out); via(rx, 345); via(rx, 407);
  post('azarah-ne');
  via(rx, 407); via(rx, 345); viaP(out, { exit: true }); via(413, 330.5); via(413, 418); via(236, 428);
  if (moked) {
    viaP(moked.foot); viaP(moked.door, { pass: DOOR_CHEL, straight: true });
    for (const p of hallWay) viaP(p, { straight: true });
    viaP(moked.out, { straight: true });
    viaP(moked.pass, { pass: PISH, straight: true }); viaP(moked.in);
    // round the Gazit's kodesh half and the Heichal's NW corner to the strip behind the Kaporet
    via(94.3, 374.5, 16); via(76.6, 365.1, 16);
    post('achorei-beit-hakaporet');
    via(76.6, 365.1, 16); via(94.3, 374.5, 16);
    viaP(moked.in, { straight: true }); viaP(moked.pass, { pass: PISH, straight: true }); viaP(moked.out, { straight: true });
    for (let k = hallWay.length - 1; k >= 0; k--) viaP(hallWay[k], { straight: true });
    viaP(moked.door, { pass: DOOR_CHEL, straight: true }); viaP(moked.foot);
  }
  // Lishkat HaKorban (its door to the east), the Korban gate up its flight, Lishkat HaParochet (its door to the west)
  post('lishkat-hakorban');
  via(182.8, 419.5); via(182.8, 433); via(166, 433); viaP(flightFoot('korban', 2));
  post('gate-korban');
  viaP(flightFoot('korban', 2)); via(155.7, 433); via(140.1, 433); via(140.1, 419.3);
  post('lishkat-haparochet');
  // the western corners, across the soreg's west line (X 53)
  post('azarah-nw', [51, 405, 0]);
  via(25, 430); via(20, 400); via(28, 381);       // round the Gazit's flight
  post('azarah-sw', [51, 256, 0]);
  for (const gate of ['delek', 'bechorot', 'mayim']) {
    viaP(flightFoot(gate, -2));
    post(`gate-${gate}`);
    viaP(flightFoot(gate, -2));
  }
  post('gate-shushan'); post('mount-ne'); post('gate-tadi'); post('mount-nw'); post('gate-kiponus'); post('mount-sw');
  if (tw) { viaP(tw.high); viaP(tw.low); }
  // he comes in at the western Chuldah gate's portal, a few steps behind his first stop
  const g = box('mount.gate.chuldah-w');
  const s0 = stops[0];
  const entry = g ? { X: s0.X, Y: g.min[1] + 0.8, Z: s0.Z } : { X: s0.X, Y: s0.Y - 2, Z: s0.Z };
  const passes = moked ? [DOOR_CHEL, PISH] : [];
  // after his event: from the soreg's east entry (the 'exit' stop) out of the strip, across the open south of the
  // Mount to the western Chuldah stair, down the tunnel to his gate's guard, and out ⚙
  const P3 = (p) => ({ X: p[0], Y: p[1], Z: p[2] ?? 0 });
  // (a last point out beyond the portal: only for the torches going ahead of him through it)
  const exitWay = tw ? [P3(out), P3([413, 330.5, 0]), P3([413, 240, 0]), P3([169, 80, 0]), P3(tw.high), P3(tw.low), { X: s0.X, Y: s0.Y, Z: s0.Z }, { ...entry },
    { X: entry.X, Y: entry.Y - 6, Z: entry.Z }] : null;
  return { stops, entry, passes, exitWay };
}

/** the circuit's timeline from its straight legs (nav-independent): dwell at each post, walk at PATROL_SPEED */
function nominal(stops, entry) {
  const r = straightRoute(stops, { loop: true });
  const tDwell = [], tWalk = [], tNext = [];
  let T = 0;
  for (let i = 0; i < stops.length; i++) {
    tDwell.push(T); T += stops[i].post ? DWELL : 0;
    tWalk.push(T); T += (r.at[i + 1] - r.at[i]) / PATROL_SPEED / 60;
    tNext.push(T);
  }
  const inLen = Math.hypot(stops[0].X - entry.X, stops[0].Y - entry.Y) * AMAH;
  return { tDwell, tWalk, tNext, T, inMin: Math.max(0.01, inLen / PATROL_SPEED / 60) };
}

/** the exit way's straight lengths (m) per waypoint: its guard's stop (iS0) and the portal (iE) are the last but two/one */
function wayNominal(way) {
  const r = straightRoute(way);
  return { at: r.at, iS0: way.length - 3, iE: way.length - 2 };
}

/** nav-refined lines (async): the circuit, his way out at dawn, then each Levite's way from his gate to his post */
function buildPaths(ctx, state) {
  state.pathsBusy = true;
  const ver = ctx.physics?.version ?? 0;
  (async () => {
    const r = await navRoute(ctx, state.stops, { loop: true });
    if (r.source !== 'straight (no nav)') { state.route = r; state.routeSource = r.source; state.routeFailed = r.failed; }
    if (state.exitWay) {
      const x = await navRoute(ctx, state.exitWay);
      if (x.source !== 'straight (no nav)') { state.exitRoute = x; state.exitSource = x.source; }
    }
    for (let i = 0; i < state.levites.length; i++) {
      const p = state.levites[i], x = p.exit;
      if (!x) continue;
      const g = await navRoute(ctx, [{ X: x.X, Y: x.Y, Z: x.Z }, { X: p.X, Y: p.Y, Z: p.Z }]);
      if (g.source === 'straight (no nav)') continue;
      const len = g.path.length;
      state.gpaths[i] = { path: g.path, len, min: Math.min(GUARD_WALK_MAX, len / GUARD_SPEED / 60) };
    }
    state.pathsVer = ver;
  })().catch((e) => { state.pathsVer = ver; console.error('[sim:night-watch] paths failed', e); })
    .finally(() => { state.pathsBusy = false; });
}

/** the rovim in the two upper rooms, along each room's free floor (clear of the worktable, jars and stair) ⚙ spots */
function upperSleepers(ctx) {
  const out = [];
  const av = ctx.elOpt('azarah.beit-avtinas')?.box;
  if (av) {
    const y = (av.min[1] + av.max[1]) / 2 + 0.1;
    out.push({ X: av.min[0] + 3.8, Y: y, Z: av.min[2], heading: 0, pose: 'sleep' });
    out.push({ X: av.min[0] + 12.8, Y: y, Z: av.min[2], heading: 180, pose: 'sleep' });
  }
  const nz = ctx.elOpt('azarah.beit-hanitzotz')?.box;
  if (nz) {
    const y = nz.max[1] - 4.6;
    out.push({ X: nz.min[0] + 4.2, Y: y, Z: nz.min[2], heading: 0, pose: 'sleep' });
    out.push({ X: nz.min[0] + 10.4, Y: y, Z: nz.min[2], heading: 180, pose: 'sleep' });
  }
  return out;
}

function near(ctx, s, range) {
  const p = ctx.player?.position;
  if (!p) return false;
  const w = m2w(s.X, s.Y, s.Z ?? 0);
  return Math.hypot(p.x - w.x, p.z - w.z) < range && Math.abs(p.y - w.y) < 10;
}

/** the sleeping guard: struck with the staff, his garment burned (Middot 1:2) — fire and captions */
function incident(ctx, state, sim, t, W, post, shabbatNight) {
  if (!post) { state.cloakLevel = 0; return; }
  const [i0, i1] = W.incident;
  const Ln = span(i0, i1) || 1;
  const u = within(t, i0, i1) ? since(t, i0) / Ln : -1;
  // no burning on Shabbat night ⚙
  const level = !shabbatNight && u >= 0 ? smooth(INC.fire[0], INC.fire[1], u) * (1 - smooth(INC.fire[2], INC.fire[3], u)) : 0;
  setCloak(ctx, state, sim, level);
  const tStrike = wrap(i0 + INC.strike[0] * Ln + 0.05);
  if (crossed(state, tStrike)) {
    cueAt(state, `strike:${Math.round(i0)}`, tStrike, () => {
      if (near(ctx, post, CAPTION_RANGE)) sim.caption({ en: 'No answer: the guard is asleep. The Ish Har HaBayit strikes him with his staff (Middot 1:2)', he: 'נִכָּר שֶׁהוּא יָשֵׁן — חוֹבְטוֹ בְמַקְלוֹ' }, { id: 'sleeping-guard', duration: 5 });
    });
  }
  const tBurn = wrap(i0 + INC.fire[0] * Ln);
  if (!shabbatNight && crossed(state, tBurn)) {
    cueAt(state, `burn:${Math.round(i0)}`, tBurn, () => {
      if (near(ctx, post, 120)) sim.caption({ en: '"What is that sound in the Azarah?" — "A Levite being beaten and his garments burned, because he slept at his post" (Middot 1:2)', he: 'מַה קּוֹל בָּעֲזָרָה? קוֹל בֶּן לֵוִי לוֹקֶה וּבְגָדָיו נִשְׂרָפִין' }, { id: 'sleeping-guard-burn', duration: 7 });
    });
  }
}

/** the burning garment: this module's own small fire (added at 0 when first needed), a shared want while it burns */
function setCloak(ctx, state, sim, level) {
  state.cloakLevel = level;
  if (!(level > 0)) return;
  if (!state.cloak && ctx.fx?.add && state.cloakAt) {
    const c = state.cloakAt;
    const z = floorZ(ctx, c.X, c.Y, c.Z) ?? c.Z;
    try { state.cloak = ctx.fx.add({ id: CLOAK_FIRE, kind: 'torch', pos: [c.X, c.Y, z + 0.1], size: 0.3, intensity: 0, schedule: 'always', smoke: true }); } catch { state.cloak = null; }
  }
  sim.fireWant(CLOAK_FIRE, level);
}
