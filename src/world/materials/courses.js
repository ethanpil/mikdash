// Course runs for the builders that model the Herodian set-out courses ("one course set out and one drawn in",
// apik shefa v'a'eil shefa — Bava Batra 4a) from the materials' course table: ctx.mats.courseAt(key, y) gives the
// course at world height y (metres; the wall textures' v = y = site Z × AMAH), so the modelled steps and the baked
// joints, set-out relief and shelter bands land on the same lines (herodian_wall_courses: 1.00–1.20 m courses).
import { AMAH } from '../../core/units.js';
import { courseStarts } from './gen/layout.js';

/** the course at world height y (m): the library's course table, else uniform rows of tile(key).rowH (even rows set out) */
function courseOf(mats, key, y) {
  const c = mats?.courseAt?.(key, y);
  if (c) return c;
  const rowH = mats?.tile?.(key)?.rowH ?? 1.1;
  const k = Math.floor(y / rowH);
  return { index: k, y0: k * rowH, h: rowH, setOut: ((k % 2) + 2) % 2 === 0, type: null };
}

/**
 * The courses of `key` over site heights [z0, z1] (amot), bottom up, clipped to the range:
 * [{ z0, z1 (amot), setOut, type, index, whole (the course lies wholly inside the range) }].
 */
export function courseRuns(mats, key, z0, z1) {
  const out = [];
  const yEnd = z1 * AMAH;
  let y = z0 * AMAH;
  for (let guard = 0; y < yEnd - 1e-6 && guard < 4096; guard++) {
    const c = courseOf(mats, key, y + 1e-6);
    const top = c.y0 + c.h;
    const a = Math.max(c.y0, z0 * AMAH), b = Math.min(top, yEnd);
    if (b > a) out.push({ z0: a / AMAH, z1: b / AMAH, setOut: !!c.setOut, type: c.type, index: c.index, whole: c.y0 >= z0 * AMAH - 1e-6 && top <= yEnd + 1e-6 });
    y = Math.max(top, y + 1e-4);
  }
  return out;
}

/**
 * The rows of one tile of `key`'s course table: [{ r, y0, h (m), setOut, type }] (heights from tile(key).courses, else
 * uniform rowH rows). For mappers that fit modelled courses onto chosen texture rows (heichal/uv.js, the rovadin).
 */
export function courseRows(mats, key) {
  const t = mats?.tile?.(key);
  const heights = t?.courses || Array.from({ length: Math.max(1, Math.round((t?.tile?.[1] ?? 13.2) / (t?.rowH ?? 1.1))) }, () => t?.rowH ?? 1.1);
  const y0s = courseStarts(heights);
  return heights.map((h, r) => {
    const c = courseOf(mats, key, y0s[r] + h / 2);
    return { r, y0: y0s[r], h, setOut: !!c.setOut, type: c.type };
  });
}
