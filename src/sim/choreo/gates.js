// The gates (report Part VIII §28 rows 5 and 13). Events served (choreo 'gates-opening'):
//   dishun-men    the two men of the inner clearing go ahead with the Teni, the Kuz and two keys; one opens the north
//                 wicket of the great gate and they pass through the ta into the Heichal (Tamid 3:6–7).
//   gates-blasts  three blasts on the silver trumpets for the opening of the gates (Sukkah 5:5; Bamidbar 10:8) — the
//                 gates of the Mount and of the Azarah swing open with them.
//   great-gate    the great gate of the Heichal opened from within; the slaughterer waits for its sound, heard as far
//                 as Yericho (Tamid 3:7–8).
//   nivreshet     Helena's golden lamp flashes at sunrise — the time to read the Shema (Yoma 37b).
// The closing: the schedule's 'locking-up' (Middot 1:9; Shekalim 5:1 — Ben Gever over the locking of the gates).
//
// Door amounts are a pure function of t ALL DAY (always: true): a jump to any hour shows every door right — shut from
// the locking until the opening, open in between, mid-swing during either. The order within each window and every
// minute offset are reconstruction; with no data the module runs on its own fixtures. Headline cues sit CUE_LEAD after
// their event's start (lib/cue.js), so the UI's jump-to-event plays through them.
import { within, since, span, wrap, clamp } from '../lib/core.js';
import { navRoute, straightRoute } from '../lib/path.js';
import { doorAmount } from '../lib/world.js';
import { cueAt, crossed, CUE_LEAD } from '../lib/cue.js';
import { m2w } from '../../core/units.js';

const SEED = 0x6761;
const MOUNT = ['mount.gate.shushan', 'mount.gate.chuldah-e', 'mount.gate.chuldah-w', 'mount.gate.kiponus', 'mount.gate.tadi'];
// the seven gates of the Azarah (Middot 1:4)
const COURT = ['azarah.gate.nikanor', 'azarah.gate.mayim', 'azarah.gate.bechorot', 'azarah.gate.delek', 'azarah.gate.korban', 'azarah.gate.nitzotz', 'azarah.gate.moked'];
const GREAT = 'heichal.gate.great', WICKET = 'heichal.gate.wicket-n';
const SWING = { mount: 0.6, court: 0.45, great: 0.5, wicket: 0.25 };  // minutes per swing ⚙
const STAGGER = { mount: 0.15, court: 0.12 };                          // minutes between gates ⚙
const CLOSE_AT = { great: 0.0, court: [0.2, 0.035], mount: [0.75, 0.03] }; // fractions of the locking window ⚙
const WALK = 1.2;                    // m/s — the clearing men
const AHEAD = 1.5;                   // min: they reach the wicket this long before the great gate opens (Tamid 3:7) ⚙
const AT_WICKET = 0.45;              // min at the wicket: the key into the lock at arm's length ⚙
const CAPTION_RANGE = 260;           // m — the blasts and the great gate carry over the whole Mount (Tamid 3:8)
const NIV_LAG = 25;                  // min after nivreshet.t1 the flash may still first be seen (it needs the sun
                                     // clear of Har HaMishchah as seen from the Ulam — docs/decisions/build-heichal.md)
const GLINT_MIN = 0.75;              // heichal.nivreshet glint(sunDir, eye): ≥ this — a facet mirrors the sun to the eye

export const FIXTURES = [
  {
    id: 'gates-opening',
    title: { en: 'The gates are opened', he: 'פתיחת השערים' },
    when: { start: { at: 'sunrise', offset: -15 }, end: { at: 'sunrise', offset: -1 } },
    timing: { confidence: 'ordering', note: 'Three blasts at the opening of the gates (Sukkah 5:5); the slaughter waits for the sound of the great gate (Tamid 3:7). Minutes are reconstruction.' },
    zone: 'nikanor',
    pos: { el: 'azarah.gate.nikanor', f: [0.5, 0.5, 0] },
    summary: 'The gates swing open; three blasts on the silver trumpets; the great gate of the Heichal is opened from within.',
    sources: ['Sukkah 5:5', 'Tamid 3:6–8'],
    sounds: ['trumpet-set', 'great-gate-open', 'gate-boom'],
    choreo: 'gates-opening',
    importance: 3,
    layer: 'ritual',
    fixture: true,
  },
  {
    id: 'gates-closing',
    title: { en: 'The gates are locked for the night', he: 'נעילת השערים' },
    when: { start: { at: 'tzeit', offset: -15 }, end: { at: 'tzeit', offset: 5 } },
    timing: { confidence: 'reconstruction', note: 'Middot 1:9 "when the time of locking came"; minutes are reconstruction.' },
    zone: 'beit-hamoked',
    pos: { el: 'azarah.moked.keys-slab', f: [0.5, 0.5, 1] },
    summary: 'The gates are shut and locked; the keys go back under the marble slab in Beit HaMoked.',
    sources: ['Middot 1:9', 'Shekalim 5:1'],
    sounds: ['gate-boom', 'keys'],
    choreo: 'gates-closing',
    importance: 1,
    layer: 'ritual',
    fixture: true,
  },
];

export default {
  id: 'gates-opening',
  aliases: ['gates-closing'],
  always: true,
  importance: 2,
  fixtures: FIXTURES,

  init(ctx, events, sim) {
    const doors = [];
    const add = (id, kind, k) => {
      const h = sim.door(id);
      if (!h.exists) return;
      const b = ctx.elOpt(id)?.box;
      const centre = b ? [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2]] : null;
      doors.push({ id, kind, k, h, centre, pos: centre && [centre[0], centre[1], centre[2] + 4], tOpen: NaN, tClose: NaN });
    };
    MOUNT.forEach((id, k) => add(id, 'mount', k));
    COURT.forEach((id, k) => add(id, 'court', k));
    add(GREAT, 'great', 0);
    add(WICKET, 'wicket', 0);
    sim.setBounds([0, 0, -30], [505, 505, 60]);
    const nik = ctx.elOpt('azarah.gate.nikanor')?.box, gg = ctx.elOpt(GREAT)?.box;
    const nv = ctx.elOpt('heichal.ulam.nivreshet')?.box;
    const pts = clearingWay(ctx, sim);
    const state = {
      doors,
      trumpeters: sim.pool({ name: 'trumpeters', role: 'kohen', count: 2, seed: SEED + 2, importance: 2, prop: 'trumpet' }),
      clearing: sim.pool({ name: 'clearing-men', role: 'kohen', count: 2, seed: SEED + 3, importance: 2 }),
      opener: sim.pool({ name: 'great-gate-opener', role: 'kohen', count: 1, seed: SEED + 3, importance: 2 }),
      // the trumpeters at the west end of Nikanor's passage, clear of the swinging leaves, facing the Mount ⚙
      blastAt: nik ? [nik.min[0] + 0.8, (nik.min[1] + nik.max[1]) / 2, nik.min[2]] : null,
      openerAt: gg ? [gg.min[0] - 4, (gg.min[1] + gg.max[1]) / 2, gg.min[2]] : null,
      // the clearing men's way: authored waypoints; their timeline uses its straight length (nav-independent), nav
      // only reshapes the line between the points once it is ready
      way: pts,
      walk: pts ? straightRoute(pts) : null,
      nominal: pts ? nominalOf(pts) : null,
      walkVer: null, walkBusy: false,
      niv: nv ? { world: m2w((nv.min[0] + nv.max[0]) / 2, (nv.min[1] + nv.max[1]) / 2, (nv.min[2] + nv.max[2]) / 2), node: ctx.movables?.get?.('heichal.nivreshet') || null } : null,
      nivPrev: false,
      plan: null, planGen: -1,
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
      tmp: {}, tmp2: {},
    };
    if (pts) buildWalk(ctx, state);
    return state;
  },

  update(ctx, state, t, dt, sim) {
    if (state.way && !state.walkBusy && (state.walkVer !== (ctx.physics?.version ?? 0) || (state.walk?.source.startsWith('straight') && ctx.nav?.isReady))) buildWalk(ctx, state);
    const P = plan(ctx, sim, state);
    if (!P) return;
    for (let i = 0; i < state.doors.length; i++) {
      const d = state.doors[i];
      if (d.kind === 'great') {
        // from within: the inner pair first, then the outer; at the locking the outer pair is drawn shut first
        const sw = SWING.great;
        d.h.setGroup('inner', doorAmount(t, d.tOpen, wrap(d.tClose + sw), sw));
        d.h.setGroup('outer', doorAmount(t, wrap(d.tOpen + sw), d.tClose, sw));
      } else d.h.set(doorAmount(t, d.tOpen, d.tClose, SWING[d.kind]));
      doorCues(ctx, state, sim, d);
    }
    trumpeters(ctx, state, sim, t, P);
    clearingMen(ctx, state, sim, t, P);
    // the great gate opened from within: its opener in the doorway until the next service takes over
    if (state.openerAt && within(t, wrap(P.great - 0.6), P.greatEnd)) {
      const [X, Y, Z] = state.openerAt;
      state.opener.slot(0).placeNear(X, Y, Z).heading(90).pose('stand').prop('keys', 'right').show();
    }
    nivreshet(ctx, state, sim, t, P);
  },

  debug(s) {
    const P = s.plan, f = s.fmt;
    const open = s.doors.filter((d) => d.h.amount > 0.5).length;
    return P ? `doors ${open}/${s.doors.length} open · blasts ${f(P.blast)} · great ${f(P.great)} · clearing ${f(P.tStart)}→wicket ${f(P.tArrive)} · locking ${f(P.close[0])}+${P.close[1].toFixed(0)} · walk ${s.walk?.source ?? 'pending'}` : 'no plan';
  },
};

/**
 * The clearing men's way (Tamid 3:6–7): out of Lishkat HaGazit (the second lottery's view spot) along the north side
 * of the Ulam, up the Ulam steps from their north end, along the Ulam to the north wicket, then straight through it
 * into the ta. Waypoints from the site's boxes (the nav path, simplified) ⚙.
 */
function clearingWay(ctx, sim) {
  const wk = ctx.elOpt(WICKET)?.box;
  if (!wk) return null;
  const st = ctx.elOpt('altar.ulam-steps')?.box, ul = ctx.elOpt('heichal.ulam')?.box;
  const gz = sim.event('second-lottery')?.view?.at || [86, 376, 16];
  const Y = (wk.min[1] + wk.max[1]) / 2;
  const pts = [{ X: gz[0], Y: gz[1], Z: gz[2] ?? 16 }];
  if (st && ul) {
    pts.push({ X: st.min[0] - 1, Y: ul.max[1] + 6.5, Z: st.min[2] });
    pts.push({ X: st.max[0] - 0.5, Y: st.max[1], Z: st.min[2] });
    pts.push({ X: st.max[0] - 1.5, Y: st.max[1] - 2.5, Z: st.min[2] + 0.5 });
    pts.push({ X: ul.max[0] - 1.6, Y: st.max[1] - 1.4, Z: st.max[2] });
  }
  pts.push({ X: wk.max[0] + 1.2, Y, Z: wk.min[2], straight: true }, { X: wk.min[0] + 1, Y, Z: wk.min[2] });
  return pts;
}

/** straight lengths (m): to the wicket's front, and through it */
function nominalOf(pts) {
  const r = straightRoute(pts);
  const n = pts.length;
  return { approach: r.at[n - 2], inside: r.at[n - 1] - r.at[n - 2] };
}

function buildWalk(ctx, state) {
  state.walkBusy = true;
  const ver = ctx.physics?.version ?? 0;
  navRoute(ctx, state.way).then((r) => { state.walk = r; state.walkVer = ver; })
    .catch((e) => { state.walkVer = ver; console.error('[sim:gates] walk failed', e); })
    .finally(() => { state.walkBusy = false; });
}

// ------------------------------------------------------------------------------------------------ the plan

/** the day's moments from the schedule (by event id), fixtures, or fallbacks on the zmanim — once per date */
function plan(ctx, sim, state) {
  if (state.plan && state.planGen === sim.generation) return state.plan;
  const z = ctx.time?.zmanim;
  const ev = (id) => { const e = sim.event(id); return e && Number.isFinite(e.t0) ? e : null; };
  const gen = sim.eventsOf('gates-opening').find((e) => e.id === 'gates-opening' && Number.isFinite(e.t0));
  const genAt = (f) => (gen ? wrap(gen.t0 + f * (span(gen.t0, gen.t1) || 1)) : NaN);
  const sunrise = z?.sunrise;
  const blastsEv = ev('gates-blasts'), greatEv = ev('great-gate'), dishunEv = ev('dishun-men'), nivEv = ev('nivreshet');
  let blast = blastsEv ? wrap(blastsEv.t0 + CUE_LEAD) : genAt(0.55);
  if (!Number.isFinite(blast)) blast = wrap(sunrise - 7);
  let great = greatEv ? wrap(greatEv.t0 + CUE_LEAD) : genAt(0.8);
  if (!Number.isFinite(great)) great = wrap(blast + 2.3);
  const greatEnd = greatEv ? greatEv.t1 : wrap(great + 3.5);
  const dishun = dishunEv ? [dishunEv.t0, dishunEv.t1] : gen ? [gen.t0, wrap(gen.t0 + 0.6 * (span(gen.t0, gen.t1) || 1))] : [wrap(great - 10), great];
  const niv = nivEv ? [wrap(nivEv.t0 + CUE_LEAD), wrap(nivEv.t1 + NIV_LAG)] : (gen && Number.isFinite(sunrise) ? [wrap(sunrise + CUE_LEAD), wrap(sunrise + 30)] : null);
  // the locking: the schedule's 'locking-up', else our 'gates-closing', else before the night watch, else at tzeit
  const lock = sim.schedule.byId('locking-up') || sim.schedule.events.find((e) => e.choreo === 'locking-up')
    || sim.eventsOf('gates-closing').find((e) => Number.isFinite(e.t0));
  let close = lock && Number.isFinite(lock.t0) ? [lock.t0, Math.max(1, span(lock.t0, lock.t1))] : null;
  if (!close) {
    const nw = sim.schedule.events.find((e) => e.choreo === 'night-watch' && Number.isFinite(e.t0));
    const end = nw ? nw.t0 : z?.tzeit;
    close = Number.isFinite(end) ? [wrap(end - 15), 20] : null;
  }
  if (!close) return null;
  // the clearing men: one continuous walk — they reach the wicket AHEAD before the great gate opens; before that they
  // stand ready at the Gazit with their vessels from the start of their event
  const N = state.nominal;
  const walkMin = N ? N.approach / WALK / 60 : 1, inMin = N ? N.inside / WALK / 60 : 0.05;
  const tArrive = wrap(great - AHEAD), tStart = wrap(tArrive - walkMin), tGone = wrap(tArrive + AT_WICKET + inMin);
  const tReady = within(tStart, dishun[0], tGone) ? dishun[0] : tStart;
  const P = {
    blast, blastEnd: blastsEv ? blastsEv.t1 : wrap(blast + 2), great, greatEnd, dishun, tReady, tStart, tArrive, tGone, walkMin, inMin,
    wicket: wrap(tArrive + 0.25), niv, close,
    keyBlasts: `blasts:${Math.round(blast * 10)}`, keyNiv: niv ? `nivreshet:${Math.round(niv[0])}` : '',
  };
  // per door: its times and cue keys, computed once here (no per-frame strings)
  const [c0, cLen] = close;
  for (const d of state.doors) {
    if (d.kind === 'great') { d.tOpen = great; d.tClose = wrap(c0 + CLOSE_AT.great * cLen); d.tShutCue = wrap(d.tClose + 2 * SWING.great); }
    else if (d.kind === 'wicket') { d.tOpen = P.wicket; d.tClose = wrap(c0 + CLOSE_AT.great * cLen + 2 * SWING.great + 0.2); d.tKeysCue = wrap(d.tOpen - 0.15); }
    else {
      const c = CLOSE_AT[d.kind];
      d.tOpen = wrap(d.kind === 'mount' ? blast + STAGGER.mount * d.k : blast + 0.2 + STAGGER.court * d.k);
      d.tClose = wrap(c0 + (c[0] + c[1] * d.k) * cLen);
      d.tShutCue = wrap(d.tClose + SWING[d.kind]);
    }
    d.keyOpen = `open:${d.id}:${Math.round(d.tOpen * 10)}`;
    d.keyShut = `shut:${d.id}:${Math.round(d.tClose * 10)}`;
  }
  state.plan = P;
  state.planGen = sim.generation;
  return P;
}

function doorCues(ctx, state, sim, d) {
  const pos = d.pos;
  if (!pos) return;
  if (d.kind === 'great') {
    if (crossed(state, d.tOpen)) {
      cueAt(state, d.keyOpen, d.tOpen, () => {
        sim.sound('great-gate-open', pos);
        if (near(ctx, d.centre, CAPTION_RANGE)) sim.caption({ en: 'The great gate of the Heichal is opened from within: the slaughterer waits for its sound, heard as far as Yericho (Tamid 3:7–8)', he: 'קוֹל שַׁעַר הַגָּדוֹל שֶׁנִּפְתָּח' }, { id: 'great-gate-open', duration: 7 });
      });
    }
    if (crossed(state, d.tShutCue)) cueAt(state, d.keyShut, d.tShutCue, () => sim.sound('gate-boom', pos));
    return;
  }
  if (d.kind === 'wicket') {
    if (crossed(state, d.tKeysCue)) cueAt(state, d.keyOpen, d.tKeysCue, () => sim.sound('keys', pos));
    return;
  }
  if (crossed(state, d.tOpen)) cueAt(state, d.keyOpen, d.tOpen, () => sim.sound('gate-boom', pos));
  if (crossed(state, d.tShutCue)) cueAt(state, d.keyShut, d.tShutCue, () => sim.sound('gate-boom', pos));
}

/** two kohanim with the silver trumpets around the blasts (Sukkah 5:5; Bamidbar 10:8) */
function trumpeters(ctx, state, sim, t, P) {
  const at = state.blastAt;
  if (at && within(t, wrap(P.blast - 1.5), wrap(P.blastEnd + 0.8))) {
    const blowing = within(t, P.blast, wrap(P.blast + 0.6));
    for (let k = 0; k < 2; k++) {
      state.trumpeters.slot(k).placeNear(at[0], at[1] + (k ? 1.6 : -1.6), at[2]).heading(90)
        .prop('trumpet', 'right').pose(blowing ? 'blow_trumpet' : 'stand').show();
    }
  }
  if (!crossed(state, P.blast)) return;
  cueAt(state, P.keyBlasts, P.blast, () => {
    if (ctx.audio?.tekiahSet) { try { ctx.audio.tekiahSet(at ? [at[0], at[1], at[2] + 3] : undefined); } catch (e) { console.warn('[sim] tekiahSet failed', e); } }
    if (near(ctx, at, CAPTION_RANGE)) sim.caption({ en: 'Teki\'ah — teru\'ah — teki\'ah: three blasts for the opening of the gates (Sukkah 5:5)', he: 'תְּקִיעָה תְּרוּעָה תְּקִיעָה' }, { id: 'gates-blasts', duration: 6 });
  });
}

/**
 * The two clearing men (Tamid 3:6–7): ready at the Gazit with their vessels from the start of their event, then one
 * walk — to the north wicket, the key, through it into the ta — timed so they reach the wicket AHEAD minutes before
 * the great gate opens. The timeline uses the waypoints' straight length; the walked path (nav when ready) is
 * stretched over it.
 */
function clearingMen(ctx, state, sim, t, P) {
  const W = state.walk;
  if (!W || !within(t, P.tReady, P.tGone)) return;
  const n = W.at.length, dFront = W.at[n - 2], dIn = W.at[n - 1];
  let d = 0, pose = 'stand';
  if (within(t, P.tStart, P.tGone)) {
    const s = since(t, P.tStart);
    if (s < P.walkMin) { d = (s / P.walkMin) * dFront; pose = 'walk'; }
    else if (s < P.walkMin + AT_WICKET) d = dFront;                                   // the key in the wicket
    else { d = dFront + clamp((s - P.walkMin - AT_WICKET) / P.inMin) * (dIn - dFront); pose = 'walk'; }
  }
  for (let k = 0; k < 2; k++) {
    const a = state.clearing.slot(k);
    const q = W.path.offset(clamp(d - k * 1.3, 0, W.path.length), k ? -0.45 : 0.45, 0, k ? state.tmp2 : state.tmp);
    const atDoor = pose === 'stand' && d >= dFront - 0.01;
    const phase = pose === 'walk' ? walkPhase(ctx, a, d - k * 1.3) : undefined;
    a.placeNear(q.X, q.Y, Number.isFinite(q.Z) ? q.Z : 22).heading(q.heading)
      // four vessels in their hands: the Teni, the Kuz and two keys (Tamid 3:6); one hand shown each
      .prop(k === 0 ? (atDoor ? 'keys' : 'teni') : 'kuz', 'right')
      .pose(pose, phase).show();
  }
}

/**
 * Helena's nivreshet (Yoma 37b): the caption when, in continuous play inside the event's window (+ NIV_LAG), the
 * flash first becomes visible to the observer — the sun clear of the eastern horizon profile as seen from the
 * nivreshet, and a facet mirroring it toward the eye (the builder's glint(sunDir, eye), a physical reflection with no
 * added glow — build-heichal, Part VIII §32). Never on a jump; once a day.
 */
function nivreshet(ctx, state, sim, t, P) {
  if (!state.niv || !P.niv || !within(t, P.niv[0], P.niv[1])) { state.nivPrev = false; return; }
  const on = flashSeen(ctx, state.niv);
  const tc = wrap(t - 1e-6);   // a moment inside this update's crossing interval (t itself is its closed end)
  if (on && !state.nivPrev && crossed(state, tc)) {
    cueAt(state, P.keyNiv, tc, () => sim.caption({ en: 'The sun clears the Mount of Olives: sparks flash from Helena\'s golden nivreshet over the entrance of the Heichal — the time to read the Shema (Yoma 37b)', he: 'נִבְרֶשֶׁת שֶׁל זָהָב' }, { id: 'nivreshet', duration: 7 }));
  }
  state.nivPrev = on;
}

function flashSeen(ctx, N) {
  const sun = ctx.time?.sun, eye = ctx.camera?.position;
  if (!sun?.dir || !eye) return false;
  if (Math.hypot(eye.x - N.world.x, eye.z - N.world.z) > CAPTION_RANGE) return false;
  const hz = typeof ctx.env?.horizonElevation === 'function' ? ctx.env.horizonElevation(sun.azimuth, N.world.y) : 0;
  if (!(sun.altitude > hz)) return false;
  const g = N.node?.userData?.glint;
  return typeof g === 'function' ? g(sun.dir, eye) >= GLINT_MIN : true;
}

function walkPhase(ctx, slot, meters) {
  const f = ctx.people?.util?.phaseFor;
  if (f && slot.actor) return f(slot.actor, 'walk', Math.max(0, meters));
  const p = Math.max(0, meters) / 1.45;
  return p - Math.floor(p);
}

function near(ctx, sitePos, range) {
  const p = ctx.player?.position;
  if (!p || !sitePos) return false;
  const w = m2w(sitePos[0], sitePos[1], sitePos[2] ?? 0);
  return Math.hypot(p.x - w.x, p.z - w.z) < range;
}
