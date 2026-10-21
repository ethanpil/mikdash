// Group G3 — sanctuary & song. One module serves all the group's choreo ids, so the same kohanim, Levites and people
// carry on from scene to scene without being swapped (src/sim/choreo/g3/*):
//   ketoret-morning   inner-clearing, coal-pan, magrefah, into-heichal, ketoret-morning     (Tamid 3:9, 5:4–7:1; Yoma 44a)
//   birkat-kohanim    birkat-kohanim                                                        (Tamid 7:2)
//   libation-song     libation, song-weekday | song-friday | song-shabbat, afternoon-song(-shabbat) (Tamid 7:3–4; Arachin 2)
//   menorah-lighting  ketoret-afternoon, menorah-lighting                                   (Yoma 14b–15a, 44a; Tamid 6:1)
//   maamad            maamad-morning, maamad-afternoon                                      (Taanit 4:2)
// It is `always` relevant: the Menorah's lamps are a function of the hour all day (lit from the evening lighting until
// the morning's cleaning; the western lamp always), as are the vessels left on the silver table and the magrefah.
//
// Determinism: every figure, vessel, fire, lamp and the gate curtain is a pure function of (t, date); the plan is built
// once per date (sim.generation). Sounds and captions go through cueAt; the libation concert is the audio's parts as
// separate cues at the staged moments (g3/plan.js spreadTimeline: the sections spread over the song's window), with the
// 'choir' loop carrying each section on, so what is seen and heard coincide. The ma'amad's prostrations (one crowd) are
// published on ctx.__g3.prost for other groups' figures in the courts (g3/plan.js peopleProstration).
import { places } from './g3/places.js';
import { runScripts, FreeProps } from './g3/script.js';
import { POOLS, newDay } from './g3/day.js';
import { windows, prostPhase, PROSTRATE_S, CUE_LEAD } from './g3/plan.js';
import { buildMorning } from './g3/morning.js';
import { buildAfternoon } from './g3/afternoon.js';
import { buildSongs } from './g3/song.js';
import { crossed, cueAt } from '../lib/cue.js';
import { within, since, wrap, clamp, smooth } from '../lib/core.js';
import { m2w } from '../../core/units.js';

const SEED = 0x6730;
const COALS = 'g3.mizbach-hazahav.coals', GLOW = 'g3.pan-coals', LEDGE = 'g3.pan-coals.ledge';
const CURTAIN = 'curtain:heichal.gate-curtain';
const PROPS = ['teni', 'kuz', 'machtah_gold', 'kaf', 'magrefah'];
const INCENSE_DENSITY = { low: 1.0, medium: 0.043, high: 0.03, ultra: 0.023 };
const CROWD_AREA = [{ min: [260, 263, 6], max: [395, 398, 7.5] }, { min: [244, 263, 13.5], max: [255, 398, 15] }];
const TEXT = {
  maamad: { en: 'The men of this week\'s ma\'amad stand in Ezrat Yisrael over the offering of all Israel — "how can a man\'s offering be brought and he not stand by it?" (Taanit 4:2)', he: 'אַנְשֵׁי מַעֲמָד' },
};

export default {
  id: 'ketoret-morning',
  aliases: ['birkat-kohanim', 'menorah-lighting', 'libation-song', 'maamad'],
  always: true,
  importance: 3,
  // shabbat-musaf publishes its concert for this module to stage (g6/musaf.js musafConcert)
  claims: ['shabbat-musaf-song'],

  init(ctx, events, sim) {
    const P = places(ctx);
    sim.setBounds([115, 262, 0], [292, 400, 40]);
    const pools = {};
    for (const [k, s] of Object.entries(POOLS)) pools[k] = sim.pool({ name: k, role: s.role, count: s.count, seed: s.seed, importance: s.importance });
    const M = P.maamad, third = (M.y1 - M.y0) / 3;
    const band = (j, n) => sim.crowd({
      roles: { israelite: 6, elder: 1 }, count: n, region: { min: [M.x0, M.y0 + third * j], max: [M.x1, M.y0 + third * (j + 1)], z: M.Z },
      pose: 'stand', heading: 268, seed: SEED + 10 + j, layout: 'prostrate',
    });
    const stream = (h, j) => sim.crowd({ roles: 'israelite', count: 6, region: { min: [249, 328.7], max: [262, 332.3], z: P.EY }, pose: 'walk', heading: h, seed: SEED + 20 + j });
    const props = new FreeProps(ctx);
    props.ensure(PROPS);
    // the Menorah's lamps: their fx fires (build-heichal registers them 'service', the western one 'always')
    const lamps = [];
    for (let i = 0; i < P.heichal.nLamps; i++) lamps.push({ id: `heichal.menorah.lamp-${i}`, v: -1 });
    return {
      P, pools, props, lamps,
      crowds: [band(0, 10), band(1, 10), band(2, 10)], streamIn: stream(270, 0), streamOut: stream(90, 1),
      curtain: sim.door(CURTAIN),
      silverPan: ctx.movables?.get?.('altar.machtah') || null, panVis: null,
      coals: null, glow: null, ledge: null, incense: null, incenseV: 0,
      plan: null, planGen: -1, out: {}, fns: {}, choir: null, choirKey: '', hushKey: '',
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
    };
  },

  update(ctx, state, t, dt, sim) {
    const D = plan(ctx, sim, state);
    if (!D) return;
    const S = state, P = S.P, fl = P.floorAt;
    for (const k of Object.keys(S.pools)) runScripts(ctx, S.pools[k], D.L[k], t, S.out, (S.fns[k] ||= []), fl);
    S.props.update(t);
    lamps(S, D, t, sim);
    fires(ctx, S, D, t, sim);
    silverPan(S, D, t);
    curtain(S, D, t);
    crowds(ctx, S, D, t, sim);
    audio(ctx, S, D, t, sim);
  },

  release(ctx, state) {
    state.props.hideAll();
    stopChoir(state); state.choirKey = '';
  },

  dispose(ctx, state) {
    state.props.dispose();
    stopChoir(state);
    try { state.incense?.remove(); } catch { /* fx gone */ }
  },

  debug(s) {
    const D = s.plan;
    if (!D) return 'no plan';
    const f = s.fmt, W = D.W;
    const warn = Object.values(D.L).flat(2).flatMap((x) => x?.warn || []);
    const lib = (k) => D.libs.find((l) => l.key === k)?.T;
    const am = lib('am'), pm = lib('pm'), mu = lib('musaf');
    return `magrefah ${f(D.m.mg)} · prostrations ${D.prost.map(f).join(' ')}\n   libation am ${am ? `${f(am.L0)} pour ${f(am.cym[0])} end ${f(am.end)}` : '-'}${mu ? ` · musaf ${f(mu.L0)}–${f(mu.end)}` : ''} · pm ${pm ? `${f(pm.L0)}–${f(pm.end)}` : '-'} · ketoret ${f(W.K[0])} · lit ${D.lampLight.map((x) => (x === x ? f(x) : '·')).join(',')}${warn.length ? `\n   ⚠ ${warn.slice(0, 3).join(' · ')}` : ''}`;
  },
};

// ------------------------------------------------------------------------------------------------ the plan

function plan(ctx, sim, state) {
  if (state.plan && state.planGen === sim.generation) return state.plan;
  const P = state.P;
  const W = windows(ctx, sim);
  const D = newDay(W);
  try {
    D.m = buildMorning(ctx, P, W, D);
    D.a = buildAfternoon(ctx, P, W, D, D.m);
    D.s = buildSongs(ctx, P, W, D, D.m, sim);
  } catch (e) {
    console.error('[sim:g3] plan failed', e);
    state.plan = null; state.planGen = sim.generation;
    return null;
  }
  D.curtain.sort((a, b) => a.t - b.t);
  D.prost.sort((a, b) => a - b);
  D.cues.sort((a, b) => a.t - b.t);
  // the vessels' days: wrapped so the free props' windows read on the cyclic clock
  for (const name of PROPS) state.props.setWindows(name, (D.props[name] || []).map((w) => ({ t0: wrap(w.t0), t1: wrap(w.t1), at: w.at, h: w.h })));
  D.crowdWins = [
    // on Shabbat the people stay for the musaf's song and its prostrations ⚙
    { w: [W.MM[0], Math.max(W.MM[1], D.s.musaf ? D.s.musaf.end + 1 : W.MM[1])], key: 'am' }, { w: W.MA, key: 'pm' },
  ];
  ctx.__g3 = { gen: sim.generation, prost: D.prost.map(wrap) };
  state.plan = D;
  state.planGen = sim.generation;
  return D;
}

// ------------------------------------------------------------------------------------------------ the world

/**
 * The Menorah's lamps: lit from the evening lighting until the morning's cleaning; the western lamp always. Shared fire
 * wants (sim.fireWant): this module is `always`, so every lamp's level is stated in every update.
 */
function lamps(S, D, t, sim) {
  const nm = S.P.heichal.nerMaaravi;
  for (let i = 0; i < S.lamps.length; i++) {
    const L = S.lamps[i];
    const out = D.lampOut[i], light = D.lampLight[i];
    let v = 1;
    if (i !== nm && out === out && light === light) v = within(t, wrap(light), wrap(out)) ? 1 : 0;
    L.v = sim.fireWant(L.id, v);
  }
}

const level = (t, on, burn) => {
  const a = since(t, wrap(on));
  if (a > 300) return 0;
  const up = smooth(0, 0.06, a);
  if (!(burn === burn)) return a < 40 ? up : 0;
  const b = a - (burn - on);
  return up * (b < 6 ? 1 : clamp(1 - (b - 6) / 34)) * (b < 0 ? 1 : 0.85 + 0.15 * clamp(1 - b / 6));
};

/** the coals, the incense column and the coals in the pans: this module's own fires (added at 0), wanted while they burn */
function fires(ctx, S, D, t, sim) {
  const fx = ctx.fx;
  if (!fx?.add) return;
  const H = S.P.heichal;
  // the coals heaped on the golden altar (Tamid 6:2): glowing until the incense, dying away after it ⚙
  let c = 0;
  for (const e of D.coals) c = Math.max(c, level(t, e.on, e.burn));
  c = Math.round(c * 100) / 100;
  if (!S.coals && c > 0) {
    // no point light (fx light:false): from the coals on its top it lit the altar's own gold sides, which then glowed ⚙
    try { S.coals = fx.add({ id: COALS, kind: 'brazier', pos: [H.goldC[0], H.goldC[1], H.goldC[2] + 0.02], size: 0.13, intensity: 0, schedule: 'always', smoke: false, light: false }); } catch { S.coals = null; }
  }
  if (S.coals && c > 0) sim.fireWant(COALS, c);
  // the incense column: rising straight from the golden altar (Yoma 38a; Avot 5:5)
  let inc = 0, dk = 1;
  for (const e of D.incense) {
    const a = since(t, wrap(e.t0)), L = e.t1 - e.t0;
    if (a < L) { inc = Math.max(inc, smooth(0, 0.25, a) * (1 - smooth(3, L, a))); dk = e.dens ?? 1; }
  }
  inc = Math.round(inc * 100) / 100;
  // a jump from one incense straight into the other keeps the column: rebuilt when its density factor differs
  if (S.incense && inc > 0 && dk !== S.incenseDk) { try { S.incense.remove(); } catch { /* */ } S.incense = null; }
  if (inc > 0 && !S.incense && fx.smokeColumn) {
    S.incenseDk = dk;
    // a connected column at every tier (≈ 10 puffs on low): 9 m, dissolving toward the ceiling ⚙. fx lights smoke as if
    // it stood outdoors (no interior visibility yet — requested), which in the dim Heichal blows the column out into a
    // glowing shaft on the tiers with adaptive exposure: there it is thinned until it reads as grey-white smoke
    // (high 0.03 judged from shots; medium and ultra scaled by their puff counts, 18 and 34 against 26). In the afternoon
    // the Heichal is darker (the sun behind it), the exposure higher and the outdoor-lit column brighter: thinner (dens)
    const dens = ctx.quality?.key === 'low' ? INCENSE_DENSITY.low : (INCENSE_DENSITY[ctx.quality?.key] ?? INCENSE_DENSITY.medium) * dk;
    try { S.incense = fx.smokeColumn({ pos: [H.goldC[0], H.goldC[1], H.goldC[2] + 0.15], height: 9, width: 0.5, density: dens, kind: 'incense', rise: 0.6, spread: 1.1 }); } catch { S.incense = null; }
    S.incenseV = -1;
  }
  if (S.incense && inc !== S.incenseV) {
    S.incenseV = inc;
    if (inc <= 0) { try { S.incense.remove(); } catch { /* */ } S.incense = null; } else S.incense.setIntensity(inc);
  }
  // the coals in the pan, carried from the incense pile to the golden altar (a small flame at his hand ⚙), and standing
  // in the gold pan on the yesod ramp's ledge (a small brazier, an ember bed with low flames, that reads in daylight ⚙)
  let g = null, onLedge = null;
  for (const e of D.glow) {
    if (!(since(t, wrap(e.t0)) < e.t1 - e.t0)) continue;
    if (e.at) onLedge = onLedge || e; else g = g || e;
  }
  const lv = onLedge ? 1 : 0;
  if (lv > 0 && !S.ledge) {
    try { S.ledge = fx.add({ id: LEDGE, kind: 'brazier', pos: onLedge.at, size: 0.1, intensity: 0, schedule: 'always', smoke: false, light: false }); } catch { S.ledge = null; }
  }
  if (S.ledge && lv > 0) sim.fireWant(LEDGE, lv);
  let gv = 0, pos = null;
  if (g) {
    const slot = S.pools[g.slot[0]]?.slot(g.slot[1]);
    if (slot?.want && slot._g3h !== undefined) {
      const h = slot._g3h * Math.PI / 180;
      const x = slot._g3X, y = slot._g3Y, z = slot._g3Z;
      pos = g.hand ? [x + Math.sin(h + 1.57) * 0.5 + Math.sin(h) * 0.25, y + Math.cos(h + 1.57) * 0.5 + Math.cos(h) * 0.25, z + 1.55]
        : [x + Math.sin(h) * 0.62, y + Math.cos(h) * 0.62, z + 2.1];
      gv = 0.85;
    }
  }
  if (gv > 0 && !S.glow) {
    try { S.glow = fx.add({ id: GLOW, kind: 'lamp', pos: pos || [0, 0, 0], size: 0.09, intensity: 0, schedule: 'always', smoke: false }); } catch { S.glow = null; }
  }
  if (S.glow) {
    if (pos) S.glow.setPosition?.(pos);
    if (gv > 0) sim.fireWant(GLOW, gv);
  }
}

/** the silver pan out of its niche while the fire-pan man has it (by day; terumat-hadeshen drives it at dawn) */
function silverPan(S, D, t) {
  const n = S.silverPan;
  if (!n) return;
  const W = D.W;
  if (!within(t, wrap(W.IC[0]), wrap(W.LK[0]))) return;
  let out = false;
  for (const w of D.silverOut) if (since(t, wrap(w[0])) < w[1] - w[0]) { out = true; break; }
  if (S.panVis !== !out) { S.panVis = !out; n.visible = !out; }
}

/** the gate curtain's wanted amount from the plan's keyframes (eased; outside them: no want) */
function curtain(S, D, t) {
  const K = D.curtain;
  if (!K.length || !S.curtain.exists) return;
  for (let i = 0; i < K.length - 1; i++) {
    const a = K[i], b = K[i + 1];
    if (b.t - a.t > 60) continue;
    const d = since(t, wrap(a.t)), L = b.t - a.t;
    if (d <= L) { S.curtain.set(a.f + (b.f - a.f) * smooth(0, 1, L > 0 ? d / L : 1)); return; }
  }
}

// ------------------------------------------------------------------------------------------------ the people

// each band of the ma'amad goes down a moment after the one before it (not in lockstep) ⚙, min
const BAND_LAG = [0, 0.55 / 60, 1.2 / 60];
// the bands' prostration phase in steps of 1/240 (≈ 0.05 s of a 13-s prostration): fewer crowd re-poses per frame
const PH_Q = 240;

function crowds(ctx, S, D, t, sim) {
  const pd = PROSTRATE_S / 60;
  for (const { w } of D.crowdWins) {
    const t0 = w[0], t1 = w[1];
    for (let j = 0; j < S.crowds.length; j++) {
      const c = S.crowds[j];
      if (!within(t, wrap(t0 - 3 + 1.2 * j), wrap(t1 + 0.4 + 1.2 * j))) continue;
      c.show(true);
      let ph = NaN;
      for (let i = 0; i < D.prost.length; i++) { const p = prostPhase(t, D.prost[i] + BAND_LAG[j], pd); if (p === p) { ph = p; break; } }
      if (ph === ph) c.pose('prostrate', Math.round(ph * PH_Q) / PH_Q); else c.pose('stand');
    }
    if (within(t, wrap(t0 - 4), wrap(t0 + 0.4))) { S.streamIn.show(true); S.streamIn.pose('walk'); }
    if (within(t, wrap(t1 + 0.1), wrap(t1 + 3.6))) { S.streamOut.show(true); S.streamOut.pose('walk'); }
    if (crossed(S, t0 + CUE_LEAD)) {
      cueAt(S, `maamad:${Math.round(t0 * 10)}`, t0 + CUE_LEAD, () => { if (near(ctx, [250, 360, 13.5], 45)) sim.caption(TEXT.maamad, { id: 'maamad', duration: 7 }); });
    }
  }
}

// ------------------------------------------------------------------------------------------------ sound and captions

function audio(ctx, S, D, t, sim) {
  if (sim.forced) rehush(ctx, S, D, t);
  choir(ctx, S, D, t);
  const c = sim.crossing;
  if (!c.ok) return;
  for (const q of D.cues) {
    if (!crossed(S, q.t)) continue;
    cueAt(S, q.key, q.t, () => {
      if (q.sound) {
        const [id, pos, opts] = q.sound;
        if (q.crowd) sim.sound(id, null, { area: CROWD_AREA, people: 150, ...(opts || {}) });
        else sim.sound(id, pos, opts);
      }
      if (q.caption && near(ctx, q.at, q.range)) sim.caption(q.caption, { id: q.id || 'g3', duration: Math.min(8, 3 + q.caption.en.length / 45) });
    });
  }
  // the hush: the crowd falls silent at the magrefah (and the afternoon's withdrawal) until the prostration
  for (const h of D.hush) {
    if (crossed(S, h[0])) cueAt(S, `hush:${Math.round(h[0] * 10)}`, h[0], () => hush(ctx, h[1] - h[0]));
  }
  // the concerts: each part as its moment passes — the sections are spread over the song's window (g3/plan.js
  // spreadTimeline), so ctx.audio.libation's back-to-back order is not used; the 'choir' loop carries each section on
  for (const L of D.libs) {
    const T = L.T, k = Math.round(T.L0 * 10);
    for (let s = 0; s < 3; s++) {
      if (crossed(S, T.sets[s])) cueAt(S, `lib-set:${L.key}:${s}:${k}`, T.sets[s], () => sim.sound('trumpet-set', s === 0 ? L.at.table : L.at.benArza));
      if (crossed(S, T.prost[s])) cueAt(S, `lib-prost:${L.key}:${s}:${k}`, T.prost[s], () => sim.sound('crowd-prostrate', null, { area: CROWD_AREA, people: 150 }));
      if (crossed(S, T.ch[s][0])) cueAt(S, `lib-song:${L.key}:${s}:${k}`, T.ch[s][0], () => sim.sound('choir-psalm', L.at.duchan, { section: s, style: T.style, psalm: T.psalm, ...(L.audio.caption === false ? { caption: false } : {}) }));
    }
    for (let j = 0; j < T.cym.length; j++) if (crossed(S, T.cym[j])) cueAt(S, `lib-cym:${L.key}:${j}:${k}`, T.cym[j], () => sim.sound('cymbal', L.at.benArza));
  }
}

/**
 * The 'choir' loop of the section being sung, after its choir-psalm cue's opening verses (T.loop): a level, like the
 * hush, so it also sounds after a jump into a section; off while paused or above 8× (the sections pass in seconds) ⚙
 */
function choir(ctx, S, D, t) {
  const A = ctx.audio;
  if (!A?.loop) return;
  const tm = ctx.time;
  const speed = tm?.paused ? 0 : (tm?.speed ?? 1);
  let L = null, s = -1;
  if (speed > 0 && speed <= 8) {
    for (let i = 0; i < D.libs.length && !L; i++) {
      const lp = D.libs[i].T.loop;
      if (!lp) continue;
      for (let j = 0; j < 3; j++) {
        const w = lp[j];
        if (w && since(t, wrap(w[0])) < w[1] - w[0]) { L = D.libs[i]; s = j; break; }
      }
    }
  }
  const key = L ? `${S.planGen}:${L.key}:${s}` : '';
  if (key === S.choirKey) return;
  S.choirKey = key;
  stopChoir(S);
  if (!L) return;
  try { S.choir = A.loop('choir', L.at.duchan, { section: s, psalm: L.T.psalm, style: L.T.style }) || null; } catch { S.choir = null; }
}
function stopChoir(S) {
  if (S.choir) { try { S.choir.stop(2); } catch { /* audio gone */ } }
  S.choir = null;
}

function hush(ctx, minutes) {
  const amb = ctx.audio?.ambience;
  if (!amb?.hush) return;
  const speed = Math.max(0.05, ctx.time?.speed ?? 1);
  try { amb.hush((minutes * 60) / speed + 4); } catch { /* audio off */ }
}

/** after a jump into a hush window the silence holds for what remains of it (a level, not a cue) */
function rehush(ctx, S, D, t) {
  for (const h of D.hush) {
    const d = since(t, wrap(h[0])), L = h[1] - h[0];
    if (d < L) { hush(ctx, L - d); return; }
  }
}

function near(ctx, at, range) {
  const p = ctx.player?.position;
  if (!p || !at) return false;
  const w = m2w(at[0], at[1], at[2] ?? 0);
  return Math.hypot(p.x - w.x, p.z - w.z) < range;
}
