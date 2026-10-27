// The wrong keyboard layout (docs/console-design.md §4.4): a query typed with the Israeli layout (SI-1452) while meaning
// Latin letters, or the reverse. `nzcj` → מזבח; `שךאשר` → altar.
const PAIRS = "q/ w' eק rר tא yט uו iן oם pפ aש sד dג fכ gע hי jח kל lך ;ף zז xס cב vה bנ nמ mצ ,ת .ץ";

export const EN_HE = {};
export const HE_EN = {};
for (const p of PAIRS.split(' ')) { EN_HE[p[0]] = p[1]; HE_EN[p[1]] = p[0]; }

/**
 * The query re-typed on the other layout: a query of only Latin letters and the layout's punctuation → Hebrew; a query
 * of only Hebrew letters → Latin. null for anything else (mixed, digits…).
 */
export function swapLayout(q) {
  const s = String(q ?? '').toLowerCase().trim();
  if (!s) return null;
  if (/^[a-z;,.'/\s]+$/.test(s) && /[a-z]/.test(s)) return [...s].map((c) => EN_HE[c] ?? c).join('');
  if (/^[\u05D0-\u05EA\s]+$/.test(s)) return [...s].map((c) => HE_EN[c] ?? c).join('');
  return null;
}
