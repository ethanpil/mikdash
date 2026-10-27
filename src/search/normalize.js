// Search normalisation (docs/console-design.md §6.3.2): Hebrew without niqqud, cantillation and final forms;
// transliteration folded so the common spellings meet (ch/kh/h, tz/ts/z, k/q/c/ck, ph/f, w/v, th/t, doubled letters,
// ei/ai/ay/ey, a word-final h after a vowel); the Ashkenazi s↔t variant; a vowel-free skeleton as a lower tier.
// Pure functions, no DOM: shared by the engine and its node test.

const CANT = /[\u0591-\u05AF]/g;
const NIQQUD = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const LIGATURES = { 'װ': 'וו', 'ױ': 'וי', 'ײ': 'יי' };
/** the prefixes a Hebrew word may carry (the article, and, in, to, from, that) */
const HE_PREFIX = 'הובלמש';
/** English words dropped from matching (unless the query is only these) */
export const STOP = new Set(['the', 'of', 'a', 'an', 'and']);

export const isHebrew = (s) => /[\u05D0-\u05EA]/.test(s);
export const isLatin = (s) => /[a-z]/i.test(s);

/**
 * Hebrew text → letters only: NFKD (presentation forms decompose too), cantillation and niqqud removed, maqaf → space,
 * geresh / gershayim / ' / " removed, final letters folded, everything else → space, whitespace collapsed.
 */
export function normHe(s) {
  let t = String(s ?? '');
  if (/[\uFB1D-\uFB4F]/.test(t)) t = t.normalize('NFKD'); // presentation forms (letters with their points in one)
  return t.replace(CANT, '').replace(NIQQUD, '')
    .replace(/\u05BE/g, ' ').replace(/[\u05F3\u05F4'"]/g, '')
    .replace(/[\u05F0\u05F1\u05F2]/g, (c) => LIGATURES[c]).replace(/[\u05DA\u05DD\u05DF\u05E3\u05E5]/g, (c) => FINALS[c])
    .replace(/[^\u05D0-\u05EA]+/g, ' ').trim();
}

/** a Hebrew token without its prefix letter (≥ 3 letters left), or null */
export function heStrip(tok) {
  return tok.length >= 3 && HE_PREFIX.includes(tok[0]) ? tok.slice(1) : null;
}
/** a Hebrew token without its article ה (doc side: המזבח ~ מזבח), or null */
export function heArticle(tok) {
  return tok.length >= 3 && tok[0] === 'ה' ? tok.slice(1) : null;
}
/** matres-lectionis-free skeleton: medial and final י / \u05D5 dropped (\u05E0\u05D9\u05E7\u05E0\u05D5\u05E8 ~ \u05E0\u05E7\u05E0\u05D5\u05E8, \u05E7\u05D5\u05D3\u05E9 ~ \u05E7\u05D3\u05E9) */
export function heSkeleton(tok) {
  return tok[0] + tok.slice(1).replace(/[\u05D9\u05D5]/g, '');
}

/** fold one Latin word (already lower case, letters and digits); memoised (titles repeat their words) */
const folded = new Map();
export function foldWord(w) {
  let f = folded.get(w);
  if (f === undefined) {
    f = fold(w);
    if (folded.size > 20000) folded.clear();
    folded.set(w, f);
  }
  return f;
}
function fold(w) {
  return w
    .replace(/([aeiou])h$/, '$1')                       // olah ~ ola, semichah ~ smicha (before ch → h: ח stays)
    .replace(/sh/g, '§')                                  // protected from the s / h folds below
    .replace(/t[zs]/g, 'z')
    .replace(/[ck]h/g, 'h')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/ck/g, 'k').replace(/[qc]/g, 'k')
    .replace(/w/g, 'v')
    .replace(/x/g, 'ks')
    .replace(/ei|ai|ay|ey/g, 'ai').replace(/ee/g, 'i').replace(/oo/g, 'u')
    .replace(/(.)\1+/g, '$1');
}

/**
 * Latin text → folded tokens: NFKD and combining marks stripped, lower case, ' ’ ‘ ` . removed, a hyphen is a space
 * (the compact form, all tokens joined, matches the joined spelling), other punctuation a space; stop words dropped
 * unless nothing else is left; each token folded (foldWord).
 */
export function latinTokens(s) {
  let raw = String(s ?? '');
  if (/[^\u0000-\u007f]/.test(raw)) raw = raw.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
  raw = raw.toLowerCase()
    .replace(/[’‘'`.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!raw) return [];
  const all = raw.split(' ');
  const kept = all.filter((w) => !STOP.has(w));
  return (kept.length ? kept : all).map(foldWord).filter(Boolean);
}
export const normLatin = (s) => latinTokens(s).join(' ');

/** a token without a leading article "ha" (≥ 3 letters left), or null */
export function latinArticle(tok) {
  return tok.length >= 5 && tok.startsWith('ha') ? tok.slice(2) : null;
}
/** the Ashkenazi variant: s → t at the word's end or between vowels (Shabbos, Beis, ezras); null when unchanged */
export function ashkenazi(tok) {
  const v = tok.replace(/s$/, 't').replace(/([aeiou])s(?=[aeiou])/g, '$1t');
  return v === tok ? null : v;
}
/** the consonant skeleton (a leading vowel kept): kodashim ~ kodoshim, mizbeach ~ mizbe'ach */
export function skeleton(tok) {
  return tok.length < 2 ? tok : tok[0] + tok.slice(1).replace(/[aeiouy]/g, '');
}
