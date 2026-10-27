// Pick shapes for CPU picking (console-design §6.2; src/sim/inspect-pick.js): a simple solid per figure, sized by its
// kind or role, its pose and its scale. No geometry, no GPU work — the inspect core rays these against the view ray.
//
//   pickShape(kindOrRole, poseName, scale = 1) ->
//     { type: 'capsule', r, h }                  upright: a vertical capsule from the feet (radius r, height h, metres)
//     { type: 'box', len, wid, h, off? }         lying / animals: a box along the heading (len forward, wid across, h up;
//                                                off = metres of its centre ahead of the origin)
//     { type: 'sphere', r, y }                   birds: a sphere of radius r centred y over the origin
//
// Heights follow the figures people builds (adult men ≈ 1.75 m; the reconstruction in docs/decisions/people.md); they only
// have to be close enough that a click on a figure's chest lands inside its shape.

const BIRDS = new Set(['dove', 'pigeon', 'turtledove']);
const SMALL_STOCK = new Set(['lamb', 'ram', 'goat', 'ewe', 'she_goat']);
const LYING = new Set(['prostrate', 'sleep', 'lie', 'prostration', 'sleeping']);
const KNEEL = new Set(['kneel', 'kneel_down', 'warm']);
const SIT = new Set(['sit', 'sit_floor', 'sit_ground', 'eat_sit']);
const BOW = new Set(['bow', 'semichah', 'semichah_high', 'slaughter', 'flay', 'receive', 'hold_legs', 'salt', 'kemitzah', 'melikah', 'rinse', 'knead']);
// standing heights by role (metres, before the figure's own scale)
const ROLE_H = { child: 1.2, levi_boy: 1.45, woman: 1.66 };
const ANIMAL_DOWN = new Set(['lie', 'bound', 'bound_tied', 'struggle']);

/** the pick solid for a figure */
export function pickShape(kindOrRole, poseName, scale = 1) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const k = String(kindOrRole || '');
  const pose = String(poseName || 'stand').replace(/~\d+$/, '');
  if (BIRDS.has(k)) return { type: 'sphere', r: 0.16 * s, y: pose === 'fly' ? 1.2 * s : 0.14 * s };
  if (k === 'bull') return ANIMAL_DOWN.has(pose) ? { type: 'box', len: 2.4 * s, wid: 1.0 * s, h: 0.9 * s, off: 0 } : { type: 'box', len: 2.4 * s, wid: 0.8 * s, h: 1.5 * s, off: 0 };
  if (SMALL_STOCK.has(k)) return ANIMAL_DOWN.has(pose) ? { type: 'box', len: 1.1 * s, wid: 0.6 * s, h: 0.5 * s, off: 0 } : { type: 'box', len: 1.1 * s, wid: 0.45 * s, h: 0.8 * s, off: 0 };
  const H = (ROLE_H[k] ?? 1.75) * s;
  if (LYING.has(pose)) return { type: 'box', len: 1.9 * s * (H / 1.75), wid: 0.6 * s, h: 0.5 * s, off: 0 };
  if (KNEEL.has(pose)) return { type: 'capsule', r: 0.32 * s, h: 1.1 * (H / 1.75) };
  if (SIT.has(pose)) return { type: 'capsule', r: 0.32 * s, h: 1.0 * (H / 1.75) * (pose === 'sit' ? 1.3 : 1) };
  if (BOW.has(pose)) return { type: 'capsule', r: 0.34 * s, h: 1.5 * (H / 1.75) };
  return { type: 'capsule', r: 0.3 * s, h: H };
}
