// Group G6 (Shabbat and Friday) — shared places and helpers for shabbat-eve, shabbat-musaf, shabbat-showbread and
// shabbat-mishmar. Not a choreo module itself (the runtime loads only src/sim/choreo/*.js).
//
// Staging is built on G2's toolkit (g2/lib.js Script / FreeProps; g2/places.js): a figure's day is a Script of walks
// along authored waypoints and actions in place, evaluated as a pure function of the clock; plans are rebuilt once per
// date (sim.generation). Places here come from src/data/site.js through ctx.elOpt, with its numbers as fallbacks.
// Spots marked ⚙ are staging choices (docs/decisions/choreo-g6-shabbat.md).
import { places } from '../g2/places.js';
import { playerNear } from '../g2/lib.js';
import { cueAt, crossed } from '../../lib/cue.js';
import { wrap, since } from '../../lib/core.js';

export const Z = 16;          // Azarah pavement
export const ZH = 22;         // Ulam / Heichal floor

/** G6 places, computed once per boot (on top of G2's) */
export function g6places(ctx) {
  if (ctx.__g6places) return ctx.__g6places;
  const P = places(ctx);
  const el = (id) => ctx.elOpt?.(id) || null;
  const box = (id, fb) => el(id)?.box || fb;
  const C = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];

  // ---- Sha'ar HaKorban and its flight down to the Mount (Middot 1:5 names it; that the most-holy offerings were brought
  // in by it is the commentators' reading — report §03)
  const kb = box('azarah.gate.korban', { min: [156.5, 398, 16], max: [166.5, 403, 36] });
  const kf = el('azarah.gate.korban.flight')?.params || { head: [161.5, 403, 16], foot: [161.5, 419, 0] };
  const kx = C(kb)[0];
  const korban = {
    x: kx,
    mount: [kx + 0.6, kf.foot[1] + 3.2, kf.foot[2]],          // on the Mount below the flight, where the lambs appear ⚙
    foot: [kx + 0.6, kf.foot[1] - 0.4, kf.foot[2] + 0.2],
    head: [kx + 0.6, kf.head[1] + 0.4, kf.head[2] - 0.2],
    passage: [kx + 0.6, (kb.min[1] + kb.max[1]) / 2, Z],
    inside: [kx + 0.6, kb.min[1] - 1.6, Z],                   // the handing-over, just inside the court ⚙
  };

  // ---- the Ulam, the great gate, the Shulchan (Middot 4:1, 4:7; Menachot 11:5–7; Shekalim 6:4)
  const steps = box('altar.ulam-steps', { min: [179, 320.5, 16], max: [201, 340.5, 22] });
  const ulam = box('heichal.ulam', { min: [163, 285.5, 22], max: [174, 375.5, 62] });
  const gg = box('heichal.gate.great', { min: [157, 325.5, 22], max: [163, 335.5, 42] });
  const sh = box('heichal.shulchan', { min: [129.5, 337.166667, 22], max: [131.166667, 338, 23.25] });
  const ut = el('heichal.ulam.tables')?.params || { marble: { min: [163.5, 337, 22], max: [165.5, 338, 23.5] }, gold: { min: [163.5, 323, 22], max: [165.5, 324, 23.5] } };
  const shC = C(sh), shTop = sh.max[2];
  const sxW = sh.min[0] + (sh.max[0] - sh.min[0]) * 0.25, sxE = sh.min[0] + (sh.max[0] - sh.min[0]) * 0.75;   // the two stacks' centres (E–W)
  const tableTop = (b) => [C(b)[0], C(b)[1], b.max[2]];
  const heichal = {
    steps, ulam, gg, sh, shC, shTop, sxW, sxE,
    gateY: C(gg)[1],
    // the Ulam steps are climbed westward from the apron at their foot (the height between is the tread's own) ⚙
    stepsN: (y = 335.5) => [[P.apronX, y, Z], [steps.min[0] + 0.6, y, steps.max[2]], [ulam.max[0] + 0.6, y, ZH]],
    stepsS: (y = 325.5) => [[P.apronX, y, Z], [steps.min[0] + 0.6, y, steps.max[2]], [ulam.max[0] + 0.6, y, ZH]],
    // the marble table (incoming bread) north of the axis, the gold (outgoing) south — both against the Heichal's front wall
    marble: ut.marble, gold: ut.gold,
    marbleTop: tableTop(ut.marble), goldTop: tableTop(ut.gold),
    marbleStand: [ut.marble.max[0] + 0.85, C(ut.marble)[1] - 0.2, ZH],
    goldStand: [ut.gold.max[0] + 0.85, C(ut.gold)[1] + 0.2, ZH],
    // through the great gate (its leaves stand open by day — gates.js)
    gateE: [gg.max[0] + 1.2, C(gg)[1] + 1.2, ZH], gateW: [gg.min[0] - 2.5, C(gg)[1] + 1.5, ZH],
    // the Shulchan: the bringers-in on the north facing south, the takers-out on the south facing north (Menachot 11:7)
    northW: [sxW, sh.max[1] + 0.55, ZH], northE: [sxE, sh.max[1] + 0.55, ZH],
    southW: [sxW, sh.min[1] - 0.5, ZH], southE: [sxE, sh.min[1] - 0.5, ZH],
    // the bowls' bearers beside them, past the table's ends ⚙
    northBW: [sh.min[0] - 0.75, sh.max[1] + 0.75, ZH], northBE: [sh.max[0] + 0.75, sh.max[1] + 0.75, ZH],
    southBW: [sh.min[0] - 0.7, sh.min[1] - 1.05, ZH], southBE: [sh.max[0] + 0.7, sh.min[1] - 1.05, ZH],
    // ways round the table: east of the golden altar to the north side (between the table and the north wall)
    toNorth: [[141, 336.6, ZH], [134.2, 339.2, ZH]],
    toSouth: [[141, 333.8, ZH], [134.5, 335.4, ZH]],
  };

  // ---- Beit HaMoked's showbread chamber (Beit Garmu, Middot 1:6; Yoma 38a) and the way out through the Moked gate
  const sb = box('azarah.moked.chamber.showbread', { min: [215.75, 392, 16], max: [220.75, 398, 26] });
  const bakery = {
    in: [C(sb)[0] - 0.6, sb.max[1] - 1.4, Z], door: [C(sb)[0] - 0.6, sb.max[1] + 0.9, Z],
    hall: [C(sb)[0] - 3.2, sb.max[1] + 0.9, Z], gateIn: [211.6, 393.6, Z], gateOut: [211.4, 387.8, Z],
  };

  // ---- Ezrat Kohanim east of the altar: the incoming divide in the north, the outgoing in the south (Sukkah 5:8)
  const ek = { north: [238.6, 347.2, Z], south: [238.6, 313.6, Z], eastLine: P.way.eastLine };

  // ---- the duchan and the table of the fats (Tamid 7:3)
  const du = box('azarah.duchan', { min: [242, 263, 13.5], max: [244, 398, 16] });
  const fats = box('altar.table.marble', { min: [205, 285, 16], max: [206, 287, 17.5] });
  const chav = [251, 319.5, 13.5];       // the chavitin makers' chamber by Nikanor (Middot 1:4), as G2 ⚙

  const G = { P, korban, heichal, bakery, ek, duchan: du, fats, chav, Z, ZH };
  ctx.__g6places = G;
  return G;
}

/**
 * A caption (and optional sound) once when continuous play crosses tCue, for an observer within `range` metres of
 * `at` (site). sound: [id, pos | null (= at), opts]. Never on jumps (cueAt).
 */
export function say(ctx, state, sim, key, tCue, at, text, { id = 'sim', dur = 6, sound = null, range = 45 } = {}) {
  if (!Number.isFinite(tCue) || !crossed(state, tCue)) return;
  cueAt(state, `${key}:${Math.round(tCue * 10)}`, tCue, () => {
    if (sound) sim.sound(sound[0], sound[1] || at, sound[2]);
    if (text && (range === Infinity || playerNear(ctx, at, range))) sim.caption(text, { id, duration: dur });
  });
}

/** an event's window [t0, t1] as minutes unwrapped near `base` (null when it does not run today) */
export function evWin(sim, id, base) {
  const e = sim.event(id);
  if (!e || !Number.isFinite(e.t0)) return null;
  // (an event a module retimes keeps the data's window as tPlan: the staging reads that — gate-sim-data)
  const w = e.tPlan || [e.t0, e.t1];
  const t0 = Number.isFinite(base) ? base + ((w[0] - base + 2160) % 1440) - 720 : w[0];
  return [t0, t0 + since(w[1], w[0])];
}

/** the aggadah layer is shown (settings key 'aggadah', default on) */
export function aggadahOn(ctx) {
  try { const v = ctx.settings?.get?.('aggadah'); return v === undefined || v === null ? true : v !== false && v !== 'false'; } catch { return true; }
}

/**
 * Which of the six sections of Ha'azinu the Levites sing over this Shabbat's musaf (Rosh HaShanah 31a: הזי"ו ל"ך, one
 * section a Shabbat, then the cycle begins again). The phase of the cycle is not recorded: it is counted in whole weeks
 * from the Shabbat of 2026-01-03 ⚙, so it is fixed for a date and advances one section a week.
 */
export const HAAZINU = [
  { he: 'הַאֲזִינוּ', en: '"Give ear, O heavens" (Devarim 32:1–6)' },
  { he: 'זְכֹר יְמוֹת עוֹלָם', en: '"Remember the days of old" (32:7–12)' },
  { he: 'יַרְכִּבֵהוּ', en: '"He made him ride on the heights" (32:13–18)' },
  { he: 'וַיַּרְא ה׳ וַיִּנְאָץ', en: '"The Lord saw and spurned" (32:19–28)' },
  { he: 'לוּ חָכְמוּ', en: '"Were they wise" (32:29–39)' },
  { he: 'כִּי אֶשָּׂא אֶל שָׁמַיִם', en: '"For I lift My hand to heaven" (32:40–43)' },
];
export function haazinuSection(ctx) {
  const d = ctx.time?.date;
  if (!d) return 0;
  const days = Math.round((Date.UTC(d.y, d.m - 1, d.d) - Date.UTC(2026, 0, 3)) / 86400000);
  return ((Math.floor(days / 7) % 6) + 6) % 6;
}

export { wrap, since };
