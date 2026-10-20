// Group G3 — the per-date plan accumulator shared by the morning, song and afternoon builders.
//   L[pool][slot] = [Script, …]  each figure's timelines (non-overlapping)
//   props[name]   = [{ t0, t1, at, h }]  free vessels' windows
//   lampOut[i] / lampLight[i]  the morning cleaning and the evening lighting of each lamp (NaN: never)
//   coals, incense, glow, silverOut, curtain  fires, smoke, the coals in the gold pan, the silver pan out of its niche,
//                                             the gate curtain's wanted amount (keyframes)
//   cues   [{ key, t, sound?: [id, pos, opts], caption?: {en, he}, at, range, kind? }]
//   prost  the people's prostrations (start minutes);  hush [[t0, t1]]
export const POOLS = {
  clearing: { role: 'kohen', count: 2, seed: 0x6764, importance: 3 },   // = gates.js clearing men / great-gate opener
  gazit: { role: 'kohen', count: 5, seed: 0x6745, importance: 3 },      // = lotteries' 'gazit:k' circle (3 incense, 4 pan)
  servers: { role: 'kohen', count: 9, seed: 0x6733, importance: 3 },
  brothers: { role: 'kohen', count: 18, seed: 0x6734, importance: 2 },
  segan: { role: 'segan', count: 1, seed: 0x7367, importance: 3 },      // = tamid-morning's segan (Shabbat hand-over)
  kg: { role: 'kohen_gadol', count: 1, seed: 0x6b67, importance: 3 },   // = tamid-morning's Kohen Gadol
  levites: { role: 'levi', count: 12, seed: 0x6735, importance: 3 },
  boys: { role: 'levi_boy', count: 4, seed: 0x6736, importance: 2 },
};
// servers: F friend (am) · M memuneh · I2 incense (pm) · F2 friend (pm) · T1/T2 trumpeters (pm) · W2 wine (pm) · P2 pan · B2 menorah (Shabbat pm)
export const SRV = { F: 0, M: 1, I2: 2, F2: 3, T1: 4, T2: 5, W2: 6, P2: 7, B2: 8 };

export function newDay(W) {
  const L = {};
  for (const k of Object.keys(POOLS)) L[k] = Array.from({ length: POOLS[k].count }, () => []);
  return {
    W, L, props: {}, lampOut: new Array(7).fill(NaN), lampLight: new Array(7).fill(NaN),
    coals: [], incense: [], glow: [], silverOut: [], curtain: [], cues: [], prost: [], hush: [], libs: [], warn: [],
  };
}
export const add = (D, pool, i, S) => { D.L[pool][i].push(S); return S; };
export const win = (D, name, t0, t1, at, h = 0) => { (D.props[name] ||= []).push({ t0, t1, at, h }); };
export const cue = (D, key, t, o) => { D.cues.push({ key: `${key}:${Math.round(t * 10)}`, t, ...o }); };
