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
// the western Chuldah gate as his event begins, reaches the sleeping guard CUE_LEAD into that event, and is back at
// his gate to go out as his event ends; nav only reshapes the line he walks between the waypoints.
import { headingTo, angleDiff, floorZ, navRoute, straightRoute } from '../lib/path.js';
import { within, since, span, wrap, wanderer, rand, clamp, smooth, window4, upperBound } from '../lib/core.js';
import { cueAt, crossed, CUE_LEAD } from '../lib/cue.js';
import { m2w, AMAH } from '../../core/units.js';

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
// the incident, as fractions of his visit (from the unanswered greeting to the event's end): blows, the guard up, the
// torch put to his garment, the fire out, the officer moves on (1) ⚙
const INC = { strike: [0.04, 0.12], wake: 0.12, bearer: [0.16, 0.62], fire: [0.2, 0.26, 0.55, 0.7] };
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
      // the Moked's doors on his way: their stops, and (per date) the minutes after p0 when the party passes them
      passDoors: C.passes.map((id) => ({ id, door: sim.door(id), idx: C.stops.reduce((a, s, i) => (s.pass === id ? [...a, i] : a), []), e: null })),
      gpaths: levites.map(() => null),
      pathsVer: null, pathsBusy: false, routeSource: 'straight',
      plan: null, planGen: -1,
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
      tmp: {}, tmpA: {}, tmpB: {}, tmpG: {}, pat: {},
      patrol: null, cloak: null, cloakLevel: -1, cloakAt: null,
    };
    buildPaths(ctx, state);
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
      let pose = O.walking ? 'walk' : 'stand', ph = O.walking ? phaseFor(ctx, o, 'walk', O.d) : undefined;
      if (O.incident && O.u > INC.strike[0] && O.u < INC.strike[1]) { pose = 'throw'; ph = (O.u * L(P) * 5) % 1; } // the staff ⚙ pose
      o.placeNear(O.X, O.Y, O.Z).heading(O.heading).pose(pose, ph).show();
      if (!shabbatNight) {
        // no light in hand on Shabbat night — by analogy with the dawn inspection (Rambam BhB 8:12) ⚙
        const R = state.route, bw = O.walking && !O.gate;
        for (let k = 0; k < 2; k++) {
          const b = state.bearers.slot(k);
          const q = R.path.offset(O.dAhead, k ? -TORCH_SIDE : TORCH_SIDE, TORCH_AHEAD, k ? state.tmpB : state.tmpA);
          let X = q.X, Y = q.Y, Z = Number.isFinite(q.Z) ? q.Z : O.Z;
          let hd = bw ? q.heading : headingTo(X, Y, O.faceX, O.faceY);
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
      greetCues(ctx, state, sim, P);
    }
    mokedDoors(state, P, t);
    incident(ctx, state, sim, t, W, incPost, shabbatNight);

    // ---- the 21 Levites: walking in through their gates, at their posts, walking out
    if (W.watch) guards(ctx, state, sim, t, P, O, incPost);

    // ---- the kohanim asleep at their posts
    if (W.upper && within(t, W.upper[0], W.upper[1])) sleepAll(state.upperPool, state.upper, t, W.upper);
  },

  release(ctx, state) {
    if (state.cloak) { state.cloak.setIntensity(0); state.cloakLevel = 0; }
  },

  debug(s) {
    const R = s.route, P = s.plan, O = s.patrol, f = s.fmt;
    const r = R ? ` ${(R.path.length / 1000).toFixed(2)} km, round ${s.nom.T.toFixed(1)} min` : '';
    const pl = P?.patrol ? ` · ${P.patrol.nEnd} rounds ×${P.patrol.s1.toFixed(3)}/${P.patrol.s2.toFixed(3)} · ${P.patrol.arrT.length} greetings` : '';
    const st = O ? ` · ${O.incident ? `INCIDENT u=${O.u.toFixed(2)}` : O.gate ? 'at his gate' : O.walking ? `to ${s.stops[(O.stop + 1) % s.stops.length].post?.id ?? 'via'}` : `at ${s.stops[O.stop].post?.id}`}` : '';
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
  return { watch, upper: win(sim.event('watch-upper-chambers')) || watch, patrol, incident, incidentPost, lockStart };
}

/**
 * The officer's night. His own timeline v (minutes): rounds of nom.T laid end to end from his first arrival at the
 * Chuldah post. Real time u (minutes since that arrival, = p0 + CUE_LEAD) maps onto it with two scales close to 1:
 * s1 until he reaches the sleeping guard exactly at the incident's anchor, s2 after it so that his last round ends
 * back at his gate, greeting it, just before his event ends. The visit to the sleeping guard lasts the incident.
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
  // the last arrival at his gate (stop 0) at v = nEnd·T, then his greeting there, then out
  let nEnd = Math.max(Math.floor(v2 / T) + 1, Math.round((Utot - u2 + v2 - DWELL) / T));
  if (nEnd < 1) nEnd = 1;
  const s2 = (Utot - u2) / (nEnd * T + DWELL - v2);
  // minutes after p0 of a moment v on his own timeline (ascending in v)
  const eOf = (v) => CUE_LEAD + (!inc || v <= vInc ? v * (inc ? s1 : s2) : u2 + (v - v2) * s2);
  // every greeting of the night (minutes after p0, clock time, stop, cue key), in order — precomputed, so the
  // per-frame check is a binary search and allocates nothing
  const arrE = [], arrK = [], arrKey = [];
  for (let r = 0; r <= nEnd; r++) {
    for (let k = 0; k < stops.length; k++) {
      if (!stops[k].post) continue;
      const v = r * T + nom.tDwell[k];
      if (v > nEnd * T + 1e-9) break;
      arrE.push(eOf(v)); arrK.push(k); arrKey.push(`shalom:${r}:${stops[k].post.id}`);
    }
  }
  // the Moked's doors: when the party passes each (going in and coming out, every round), minutes after p0
  for (const pd of state.passDoors) {
    const es = [];
    for (let r = 0; r < nEnd; r++) for (const i of pd.idx) es.push(eOf(r * T + nom.tDwell[i]));
    pd.e = Float64Array.from(es);
  }
  return {
    p0, len, inMin, Utot, uInc, vInc, kInc, L: Linc, s1, s2, nEnd, inc, u2, v2,
    arrE: Float64Array.from(arrE), arrT: Float64Array.from(arrE, (e) => wrap(p0 + e)), arrK, arrKey,
  };
}

/** the officer at time t → state.pat { X, Y, Z, heading, d, dAhead, walking, stop, faceX/Y, incident, u, gate } */
function patrolAt(state, P, t) {
  const Q = P.patrol, nom = state.nom, R = state.route, O = state.pat;
  const e = since(t, Q.p0);
  if (e >= Q.len) return null;
  const s0 = state.stops[0];
  O.incident = false; O.u = 0; O.stop = 0; O.gate = false;
  let u = e - CUE_LEAD;
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
  if (!Q.inc || u < Q.uInc) v = u / (Q.inc ? Q.s1 : Q.s2);
  else if (u < Q.u2) { v = Q.vInc; O.incident = true; O.u = (u - Q.uInc) / Q.L; }
  else v = Q.v2 + (u - Q.u2) / Q.s2;
  const round = Math.floor(v / nom.T + 1e-9);
  const w = Math.max(0, v - round * nom.T);
  let i = nom.tDwell.length - 1;
  if (O.incident) i = Q.kInc;
  else while (i > 0 && w < nom.tDwell[i] - 1e-9) i--;
  const walking = !O.incident && w >= nom.tWalk[i];
  const at = R.at;
  const d = walking ? at[i] + clamp((w - nom.tWalk[i]) / (nom.tNext[i] - nom.tWalk[i] || 1)) * (at[i + 1] - at[i]) : at[i];
  const q = R.path.sample(d, state.tmp);
  const st = state.stops[i];
  O.X = q.X; O.Y = q.Y; O.Z = Number.isFinite(q.Z) ? q.Z : st.Z;
  O.walking = walking; O.stop = i; O.d = d; O.dAhead = d;
  O.faceX = st.post ? st.post.X : q.X; O.faceY = st.post ? st.post.Y : q.Y;
  O.heading = walking || !st.post ? q.heading : headingTo(q.X, q.Y, st.post.X, st.post.Y);
  return O;
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
      g.placeNear(p.X, p.Y, p.Z).heading(p.Y < (ctx.site?.axisY ?? 330.5) ? 180 : 0).pose('sleep').show();
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

  post('gate-chuldah-w');
  if (tw && te) { viaP(tw.low); viaP(tw.high); viaP(te.high); viaP(te.low); }
  post('gate-chuldah-e');
  if (te) { viaP(te.low); viaP(te.high); }
  post('mount-se');
  viaP(out); via(rx, 316); via(rx, 253);
  post('azarah-se');
  via(rx, 253); via(rx, 316); viaP(out); viaP(inEN);
  post('gate-nikanor');
  viaP(inEN); viaP(out); via(rx, 345); via(rx, 407);
  post('azarah-ne');
  via(rx, 407); via(rx, 345); viaP(out); via(413, 330.5); via(413, 418); via(236, 428);
  if (moked) {
    viaP(moked.foot); viaP(moked.door, { pass: DOOR_CHEL, straight: true }); viaP(moked.hall); viaP(moked.out, { straight: true });
    viaP(moked.pass, { pass: PISH, straight: true }); viaP(moked.in);
    // round the Gazit's kodesh half and the Heichal's NW corner to the strip behind the Kaporet
    via(94.3, 374.5, 16); via(76.6, 365.1, 16);
    post('achorei-beit-hakaporet');
    via(76.6, 365.1, 16); via(94.3, 374.5, 16);
    viaP(moked.in, { straight: true }); viaP(moked.pass, { pass: PISH, straight: true }); viaP(moked.out); viaP(moked.hall, { straight: true });
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
  return { stops, entry, passes };
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

/** nav-refined lines (async): the circuit, then each Levite's way from his gate to his post */
function buildPaths(ctx, state) {
  state.pathsBusy = true;
  const ver = ctx.physics?.version ?? 0;
  (async () => {
    const r = await navRoute(ctx, state.stops, { loop: true });
    if (r.source !== 'straight (no nav)') { state.route = r; state.routeSource = r.source; state.routeFailed = r.failed; }
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
  if (!post) { setCloak(ctx, state, 0); return; }
  const [i0, i1] = W.incident;
  const Ln = span(i0, i1) || 1;
  const u = within(t, i0, i1) ? since(t, i0) / Ln : -1;
  // no burning on Shabbat night ⚙
  const level = !shabbatNight && u >= 0 ? smooth(INC.fire[0], INC.fire[1], u) * (1 - smooth(INC.fire[2], INC.fire[3], u)) : 0;
  setCloak(ctx, state, level);
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

function setCloak(ctx, state, level) {
  if (Math.abs(level - state.cloakLevel) < 0.01) return;
  if (!state.cloak && level > 0 && ctx.fx?.add && state.cloakAt) {
    const c = state.cloakAt;
    const z = floorZ(ctx, c.X, c.Y, c.Z) ?? c.Z;
    try { state.cloak = ctx.fx.add({ id: CLOAK_FIRE, kind: 'torch', pos: [c.X, c.Y, z + 0.1], size: 0.3, intensity: 0, schedule: 'always', smoke: true }); } catch { state.cloak = null; }
  }
  state.cloak?.setIntensity(level);
  state.cloakLevel = level;
}
