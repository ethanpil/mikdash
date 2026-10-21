// Group G3 — the day's windows and key moments, from the schedule's events (fallbacks on the zmanim), and the timeline
// of the libation concert built from the audio's own parts (src/audio/index.js libation()): three
// teki'ah-teru'ah-teki'ah sets, the first on the table of the fats, the cymbal at the pour, the three sections of the
// psalm, a prostration at each set. The concert is spread over the song's window (spreadTimeline): the audio plays the
// parts as separate cues at their moments, and the 'choir' loop carries each section on.
//
// The buffers' lengths are fixed by their synthesis (the trumpet set's pattern and each section's melody), so the sim
// stages them in sim minutes: at the clock's normal speed what is seen and heard coincide. D_SET and PSALM_DUR are those
// lengths (src/audio/synth/instruments.js trumpets(), music.js renderPsalm(): melody length + 3.5 s) —
// dev/tests/g3.js checks them against the synth.
import { wrap, since } from '../../lib/core.js';

export const CUE_LEAD = 0.5;
/** trumpet-set buffer: 0.03 + teki'ah 3.1 + 0.55 + teru'ah (9 × 0.27 + 0.12) + 0.55 + teki'ah 3.1, + 0.5 tail (s) */
export const D_SET = 0.03 + 3.1 + 0.55 + (9 * 0.27 + 0.12) + 0.55 + 3.1 + 0.5;
/**
 * choir-psalm section buffers (s) by psalm, from the audio's own pure timing when it has one (src/audio/timeline.js
 * sectionTiming — the same code that renders: since audio-2, every verse of each third), else the first audio
 * version's lengths (the opening verses of each third). Read through an eager glob so the sim builds either way.
 */
const AUDIO_TIMELINE = Object.values(import.meta.glob('../../../audio/timeline.js', { eager: true }))[0] || null;
const PSALM_DUR_V1 = {
  24: [23.043, 24.543, 25.993], 48: [16.883, 17.923, 22.443], 81: [20.503, 20.493, 20.373], 82: [23.093, 22.803, 21.233],
  92: [24.304, 20.323, 19.413], 93: [22.243, 25.313, 15.251], 94: [18.383, 20.373, 21.503],
};
const sectionDurs = (psalm) => {
  try { return [0, 1, 2].map((s) => AUDIO_TIMELINE.sectionTiming({ psalm }, s).duration); } catch { return null; }
};
export const PSALM_DUR = Object.fromEntries(Object.entries(PSALM_DUR_V1).map(([p, v]) => [p, (AUDIO_TIMELINE?.sectionTiming && sectionDurs(+p)) || v]));
export const PSALM_BY_DAY = [24, 48, 82, 94, 81, 93, 92];   // Tamid 7:4 (Sun … Shabbat)
export const PROSTRATE_S = 13;     // s: a full-length prostration — down, flat, up (people clip phases 0.3 / 0.7) ⚙
export const MAX_WALK_S = 25;      // the audio clamps the trumpeters' walk to 4–25 s

/** windows unwrapped within ±12 h of base (so arithmetic on them is linear) */
export const unwrapW = (w, base) => {
  const t0 = base + ((w[0] - base + 2160) % 1440) - 720;
  return [t0, t0 + since(w[1], w[0])];
};

/** the day's windows (minutes, unwrapped near sunrise); fallbacks follow the schedule's own specs */
export function windows(ctx, sim) {
  const z = ctx.time?.zmanim || {};
  const sr = Number.isFinite(z.sunrise) ? z.sunrise : 356, sh = Number.isFinite(z.shaahDay) ? z.shaahDay : 53.6;
  const dh = (h) => sr + h * sh;
  const ev = (...ids) => { for (const id of ids) { const e = sim.event(id); if (e && Number.isFinite(e.t0)) return [e.t0, e.t1]; } return null; };
  const U = (w, fb) => unwrapW(w || fb.map(wrap), sr);
  const dayType = ctx.time?.dayType || 'weekday';
  return {
    sr, sh, dayType, shabbat: dayType === 'shabbat',
    GG: U(ev('great-gate'), [sr - 5, sr - 1]),
    IC: U(ev('inner-clearing'), [sr - 1, sr + 4]),
    VS: U(ev('vessels'), [sr - 22, sr - 14]),
    TL: U(ev('third-fourth-lottery'), [sr + 44, sr + 50]),
    CP: U(ev('coal-pan'), [sr + 50, sr + 55]),
    MG: U(ev('magrefah'), [sr + 55, sr + 56]),
    IH: U(ev('into-heichal'), [sr + 56, sr + 62]),
    K: U(ev('ketoret-morning'), [sr + 62, sr + 71]),
    BK: U(ev('birkat-kohanim'), [sr + 71, sr + 75]),
    LU: U(ev('limbs-up'), [sr + 75, sr + 88]),
    LB: U(ev('libation'), [sr + 88, sr + 92]),
    SG: U(ev('song-weekday', 'song-friday', 'song-shabbat'), [sr + 92, sr + 106]),
    MM: U(ev('maamad-morning'), [sr - 8, sr + 106]),
    MA: U(ev('maamad-afternoon'), [dh(8.4), dh(9.95)]),
    KA: U(ev('ketoret-afternoon'), [dh(9.15), dh(9.3)]),
    ML: U(ev('menorah-lighting'), [dh(9.3), dh(9.45)]),
    AL: U(ev('afternoon-limbs'), [dh(9.5), dh(9.65)]),
    AS: U(ev('afternoon-song', 'afternoon-song-shabbat'), [dh(9.65), dh(9.95)]),
    LK: U(ev('locking-up'), [(z.tzeit ?? sr + 700) - 15, (z.tzeit ?? sr + 700) + 5]),
    eventIds: {
      song: ['song-weekday', 'song-friday', 'song-shabbat'].find((id) => sim.event(id)) || 'song-weekday',
      pmSong: ['afternoon-song', 'afternoon-song-shabbat'].find((id) => sim.event(id)) || 'afternoon-song',
    },
  };
}

/** the psalm of the day as the audio picks it (music(): Shabbat → index 6) */
export function psalmOfDay(ctx) {
  const wd = ctx.time?.dayType === 'shabbat' ? 6 : ctx.time?.weekday;
  return PSALM_BY_DAY[Number.isInteger(wd) ? wd : 1];
}

/**
 * The concert's timeline in absolute minutes from L0 (the first set on the table), for walk seconds walkS:
 * sets (each set's start), blow (each set's blowing end), cym (cymbal moments), ch ([start, singing end, ring end] per
 * section), prost (the crowd-prostrate sound per set), end (the last section's ring end), perf (when libation()
 * resolves). sg1612: the cymbal at every break.
 */
export function libTimeline(L0, psalm, style, walkS) {
  const D = PSALM_DUR[psalm] || PSALM_DUR[48];
  const sg = style === 'sg1612';
  const sets = [], blow = [], cym = [], ch = [], prost = [];
  let t = 0;
  for (let s = 0; s < 3; s++) {
    sets.push(t); blow.push(t + D_SET - 0.48); prost.push(t + D_SET - 2.2);
    t += D_SET - 0.2;
    if (s === 0) t += walkS;
    if (s === 0 || sg) { cym.push(t); t += 0.9; }
    ch.push([t, t + D[s] - 3.5, t + D[s]]);
    t += D[s] - 2.6;
  }
  const m = (x) => L0 + x / 60;
  return {
    L0, psalm, style: sg ? 'sg1612' : 'mishnah', walkS,
    sets: sets.map(m), blow: blow.map(m), cym: cym.map(m), ch: ch.map((c) => c.map(m)), prost: prost.map(m),
    end: m(ch[2][2]), perf: m(t), cym0S: sets[0] + D_SET - 0.2 + walkS,
  };
}

/** the pause between a section's last note and the next set's first blast (s) ⚙ */
export const GAP_S = 4;

/**
 * The concert spread over the song's window: the first set, the walk to Ben Arza and the pour exactly as libTimeline
 * (the audio's own order and lengths), then the three sections sung over [the pour, tEnd], the second and third sets
 * between them (Tamid 7:3 "they reached a section: they blew and the people prostrated"). The audio has only the opening
 * verses of each third (PSALM_DUR); each section is its choir-psalm cue and then the 'choir' loop of the same section
 * until the section ends (loop[s] = [from, to], or null). ⚙ the section lengths (the sources give no minutes).
 */
export function spreadTimeline(L0, psalm, style, walkS, tEnd) {
  const T = libTimeline(L0, psalm, style, walkS);
  const D = PSALM_DUR[psalm] || PSALM_DUR[48];
  const sg = T.style === 'sg1612';
  const m = (s) => s / 60;
  const setM = m(D_SET - 0.2), gap = m(GAP_S), cymM = sg ? m(0.9) : 0;
  const c0 = T.ch[0][0];
  const sing = Math.max(m(Math.max(...D)), (tEnd - c0 - 2 * (gap + setM + cymM)) / 3);
  const sets = [T.sets[0]], blow = [T.blow[0]], prost = [T.prost[0]], cym = [T.cym[0]], ch = [], loop = [];
  let c = c0;
  for (let s = 0; s < 3; s++) {
    ch.push([c, c + sing - m(3.5), c + sing]);
    const l0 = c + m(D[s] - 5), l1 = c + sing - m(3.5);
    loop.push(l1 - l0 > m(10) ? [l0, l1] : null);
    if (s === 2) break;
    const st = c + sing + gap;
    sets.push(st); blow.push(st + m(D_SET - 0.48)); prost.push(st + m(D_SET - 2.2));
    c = st + setM;
    if (sg) { cym.push(c); c += cymM; }
  }
  return { ...T, sets, blow, cym, ch, prost, loop, end: ch[2][2], perf: ch[2][2], spread: true };
}

/** a crowd prostration's phase at t for one that starts (going down) at p0: NaN outside it */
export function prostPhase(t, p0, dur = PROSTRATE_S / 60) {
  const d = since(t, wrap(p0));
  return d < dur ? d / dur : NaN;
}

/**
 * For other groups' figures in Ezrat Yisrael and Ezrat Nashim (G4's visitors and women): the people's prostration
 * phase at t, or NaN — the same moments the ma'amad keeps (the incense, the blessing, every teki'ah of both
 * libations). Filled by the G3 module (ketoret-morning) each date; [] until it has run.
 */
export function peopleProstration(ctx, t) {
  const L = ctx.__g3?.prost;
  if (!L) return NaN;
  for (let i = 0; i < L.length; i++) { const p = prostPhase(t, L[i]); if (p === p) return p; }
  return NaN;
}
