// Group G7 (Rosh Chodesh) — the per-date plan cache and the musaf's concert for libation-song (G3), as g6/musaf.js
// publishes the Shabbat musaf's (musafConcert). The song for the Rosh Chodesh musaf is not recorded (docs/decisions/
// rosh-chodesh.md): RC_SONG is the stand-in the audio sings, Psalm 81 — "Blow the shofar at the new moon" (v. 4).
import { buildRC } from './plan.js';
import { g6places, concertClock } from '../g6/common.js';
import { clamp } from '../../lib/core.js';
import { AMAH } from '../../../core/units.js';

/** the audio's song id for the Rosh Chodesh musaf's concert (src/audio/songs.js) — reconstruction ⚙ */
export const RC_SONG = 'psalm-81';

/** the plan for the current date (g7/plan.js buildRC), cached on the runtime's generation; null when not Rosh Chodesh */
export function rcPlan(ctx, sim) {
  const gen = sim.generation;
  const c = ctx.__g7rc;
  if (c && c.gen === gen) return c.plan;
  let plan = null;
  try { plan = ctx.time?.roshChodesh ? buildRC(ctx, sim) : null; } catch (e) { console.warn('[sim] g7 Rosh Chodesh plan failed', e); plan = null; }
  ctx.__g7rc = { gen, plan, concert: undefined };
  return plan;
}

/**
 * For libation-song: the Rosh Chodesh musaf's concert in the shape of g6/musaf.js musafConcert — L0 (the first set on the
 * table of the fats), tPour (the cymbal: the pour of the last jug), t1 (the song window's end), walkS, table, benArza,
 * pourAt, wine { at, laid, pick } (the jug the plan leaves on the lower ramp), song (the audio's id). null when not
 * Rosh Chodesh. On Shabbat it is the only musaf song of the day: Rosh Chodesh's displaces Shabbat's (Rambam TuM 6:10).
 */
export function rcConcert(ctx, sim) {
  const P = rcPlan(ctx, sim);
  if (!P) return null;
  const c = ctx.__g7rc;
  if (c.concert !== undefined) return c.concert;
  let out = null;
  try {
    const G = g6places(ctx), fats = G.fats, du = G.duchan;
    const table = [(fats.min[0] + fats.max[0]) / 2, (fats.min[1] + fats.max[1]) / 2, fats.max[2] + 3];
    const benArza = [(du.min[0] + du.max[0]) / 2, (du.min[1] + du.max[1]) / 2, du.max[2] + 3];
    // the trumpeters' way from the table round the ramp's foot to Ben Arza, as g6/musaf.js reckons it for the audio
    const way = [[fats.max[0] + 1.0, fats.min[1] + 0.45, 16], [206.3, 274.3, 16], [231.2, 273.2, 16], [236.6, 300, 16], [240.4, 322, 16], [du.min[0] - 0.8, benArza[1] - 1.3, 16]];
    let len = 0;
    for (let i = 1; i < way.length; i++) len += Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1]) * AMAH;
    const walkS = clamp(len / 1.7, 4, 25);
    const A = concertClock(ctx, { song: RC_SONG, style: 'mishnah', walk: walkS });
    if (A && P.wine?.at) {
      const tPour = P.t.tPour;
      const L0 = tPour - A.pour / 60;
      out = {
        generation: sim.generation, event: 'rc-musaf-song', claimed: true,
        L0, tPour, t1: P.win.song ? P.win.song[1] : tPour + 12, walkS, table, benArza, pourAt: P.at.sw,
        wine: { at: P.wine.at, laid: P.wine.laid, pick: P.wine.pick }, song: A.song, title: A.title,
      };
    }
  } catch (e) { console.warn('[sim] g7 Rosh Chodesh concert failed', e); out = null; }
  c.concert = out;
  return out;
}
