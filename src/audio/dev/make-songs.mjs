#!/usr/bin/env node
// Generates src/audio/songs-text.js: for every verse the Levites sing (the seven daily psalms, the Shabbat
// afternoon songs and Ha'azinu) the caption Hebrew and a syllabified chant transliteration.
//
//   node src/audio/dev/make-songs.mjs [--cache DIR]        (fetches from Sefaria when DIR has no copy)
//
// Source text: the Westminster Leningrad Codex (public domain; tanach.us), Sefaria version "Tanach with Ta'amei
// Hamikra" — vowels and cantillation. The cantillation is used here and then dropped:
//  * the stressed syllable of each word is the one carrying its (non-positional) accent;
//  * ',' (half-verse: the psalm tone's mediant) after etnach — and in Psalms after ole-veyored; a half-verse longer
//    than LONG syllables is split again at the strongest disjunctive accent near its middle; '.' ends the verse.
// Caption Hebrew keeps the vowels, drops the accents, keeps the qere (not the ketiv), and writes the Divine Names in
// their customary written substitutes (ה׳, אֱלֹקִים, קֵל, קָהּ); the chant sings them as Hashem / Elokim / Kel / Kah.
// Where Leningrad's spelling differs from a Sefer Torah's, the caption follows the Torah (SPELLING).
// The transliteration is a neutral Sephardi-like reading for the formant choir (docs/decisions/audio-2.md): it sets
// the syllable count, stress and phrasing the melody is timed by; it does not claim the ancient pronunciation.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const cacheDir = args.includes('--cache') ? resolve(args[args.indexOf('--cache') + 1]) : null;
const VERSION = "Tanach with Ta'amei Hamikra";

// [sefaria ref, short key prefix, first verse number, poetic accent system]
const TEXTS = [
  ['Psalms.24', 'Ps 24', 1, true], ['Psalms.48', 'Ps 48', 1, true], ['Psalms.82', 'Ps 82', 1, true], ['Psalms.94', 'Ps 94', 1, true],
  ['Psalms.81', 'Ps 81', 1, true], ['Psalms.93', 'Ps 93', 1, true], ['Psalms.92', 'Ps 92', 1, true],
  ['Exodus.15.1-18', 'Ex 15', 1, false], ['Numbers.21.17-20', 'Nu 21', 17, false], ['Deuteronomy.32.1-43', 'Dt 32', 1, false],
];

// Elohim / El used of judges or of other gods: not a Divine Name, left as written (occurrence index among the
// Elohim/El matches of that verse). Ps 82:1, 82:6 (Rashi: angels; Radak: true judges); Ps 81:10; Dt 32:12, 17, 21, 37, 39.
const PROFANE = { 'Ps 82:1': [2], 'Ps 82:6': [0], 'Ps 81:10': [0, 1], 'Dt 32:12': [0], 'Dt 32:17': [0, 1], 'Dt 32:21': [0], 'Dt 32:37': [0], 'Dt 32:39': [0] };

// Spellings where the Leningrad Codex differs from the Aleppo Codex tradition a Sefer Torah follows, as Miqra according
// to the Masorah has them (checked against MAM; audio-2-fix): the caption shows the Torah's spelling. The pronunciation is
// the same, so the chant is left as generated. [Leningrad, Torah] with every mark spelled out (marks in source order).
const SPELLING = {
  'Dt 32:7': [['דּוֹר־וָדוֹר', 'דֹּר־וָדֹר']], // דּוֹר־וָדוֹר → דֹּר־וָדֹר
  'Dt 32:24': [['בְּהֵמוֹת', 'בְּהֵמֹת']], // בְּהֵמוֹת → בְּהֵמֹת
  'Dt 32:27': [['יָדֵינוּ', 'יָדֵנוּ']], // יָדֵינוּ → יָדֵנוּ
  'Dt 32:34': [['חָתֻם', 'חָתוּם']], // חָתֻם → חָתוּם
};

const LONG = 18;

// ------------------------------------------------------------------ Unicode
const SHEVA = 0x5b0, HSEGOL = 0x5b1, HPATAH = 0x5b2, HQAMATS = 0x5b3, HIRIQ = 0x5b4, TSERE = 0x5b5, SEGOL = 0x5b6, PATAH = 0x5b7,
  QAMATS = 0x5b8, HOLAM = 0x5b9, HOLAMV = 0x5ba, QUBUTS = 0x5bb, DAGESH = 0x5bc, METEG = 0x5bd, MAQAF = 0x5be, SHIN = 0x5c1, SIN = 0x5c2, QQATAN = 0x5c7;
const VOWEL = { [HSEGOL]: 'e', [HPATAH]: 'a', [HQAMATS]: 'o', [HIRIQ]: 'i', [TSERE]: 'e', [SEGOL]: 'e', [PATAH]: 'a', [QAMATS]: 'a', [HOLAM]: 'o', [HOLAMV]: 'o', [QUBUTS]: 'u', [QQATAN]: 'o' };
const LONGV = new Set([QAMATS, TSERE, HOLAM, HOLAMV]);
const isAccent = (c) => c >= 0x591 && c <= 0x5af;
// prepositive / postpositive accents: their place is not the stress (segolta, pashta, telisha q./g., zarqa, yetiv,
// dehi, geresh muqdam)
const POSITIONAL = new Set([0x592, 0x599, 0x5a9, 0x5ae, 0x59a, 0x5a0, 0x5ad, 0x59d]);
// disjunctives for splitting a long half-verse, strongest first
const SPLIT_PROSE = [[0x592, 0x593, 0x594, 0x595], [0x597, 0x599, 0x5ae], [0x596, 0x59b, 0x59c, 0x5a1]];
const SPLIT_POETIC = [[0x597, 0x593, 0x5a1], [0x5ad, 0x5ae, 0x59c], [0x596]];
const isLetter = (c) => c >= 0x5d0 && c <= 0x5ea;
const BEGADKEFAT = new Set('בגדכךפףת');

const CONS = { 'א': '', 'ב': 'v', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'ch', 'ך': 'ch', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': '', 'פ': 'f', 'ף': 'f', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't' };
const HARD = { 'ב': 'b', 'כ': 'k', 'ך': 'k', 'פ': 'p', 'ף': 'p' };

// ------------------------------------------------------------------ fetch
async function fetchText(ref) {
  const file = cacheDir && join(cacheDir, `${ref}.json`);
  if (file && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).versions[0].text;
  const url = `https://www.sefaria.org/api/v3/texts/${ref}?version=${encodeURIComponent(`hebrew|${VERSION}`)}&return_format=text_only`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${ref}: HTTP ${r.status}`);
  const j = await r.json();
  if (j.versions?.[0]?.versionTitle !== VERSION) throw new Error(`${ref}: got version ${j.versions?.[0]?.versionTitle}`);
  if (file) { mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify(j)); }
  return j.versions[0].text;
}

/** raw verse → clean pointed text: qere for ketiv, no paragraph marks, no paseq/sof pasuq/joiners */
function clean(v) {
  return v.replace(/[א-ת]+ \[([^\]]+)\]/g, '$1').replace(/\((?:פ|ס)\)/g, '').replace(/[׀׃‍͏]/g, '')
    // a furtive patach typed under the yod before a final ayin (הוֹפִֽיַע, Ps 94:1) belongs to the ayin
    .replace(/יַע(?=\s|$)/g, 'יעַ')
    .replace(/\s+/g, ' ').trim();
}

/** a word (between maqafs) → letter units */
function units(w) {
  const out = [];
  for (const ch of w) {
    const c = ch.codePointAt(0);
    if (isLetter(c)) out.push({ ch, marks: [], acc: [] });
    else if (out.length) { if (isAccent(c)) out[out.length - 1].acc.push(c); else out[out.length - 1].marks.push(c); }
  }
  for (const u of out) {
    u.dagesh = u.marks.includes(DAGESH);
    u.meteg = u.marks.includes(METEG);
    u.v = u.marks.find((m) => VOWEL[m] || m === SHEVA) ?? null;
    if (u.ch === 'ש') u.cons = u.marks.includes(SIN) ? 's' : 'sh';
    else u.cons = u.dagesh && HARD[u.ch] ? HARD[u.ch] : CONS[u.ch];
  }
  return out;
}

const letters = (w) => [...w].filter((ch) => isLetter(ch.codePointAt(0))).join('');
const stripAcc = (w) => [...w].filter((ch) => { const c = ch.codePointAt(0); return !isAccent(c) && c !== METEG; }).join('');

/** Divine Name in a sub-word: { kind, prefix (letters) } or null */
function divineName(w) {
  const L = letters(w), U = units(w);
  const m = /^([והלבכמש]{0,2})יהוה$/.exec(L);
  if (m) return { kind: 'yhvh', prefix: m[1].length };
  const y = /^([ובלכמש]?)יה$/.exec(L);
  if (y && U[U.length - 1].dagesh) return { kind: 'yah', prefix: y[1].length };
  const e = /^([והלבכמש]{0,2})א(לו?)ה(ים|י|ינו|יך|יכם|יו|ימו|יהם)?$/.exec(L);
  if (e) {
    const lam = U[e[1].length + 1];
    const holam = lam.v === HOLAM || (e[2] === 'לו' && U[e[1].length + 2].v === HOLAM);
    if (holam) return { kind: 'elohim', prefix: e[1].length, he: e[1].length + 1 + e[2].length };
  }
  const ad = /^([ובלכמש]{0,2})אדני$/.exec(L);
  if (ad && U[U.length - 2].v === QAMATS) return { kind: 'adonai', prefix: ad[1].length };
  const el = /^([ובלכמש]{0,2})אל(י)?$/.exec(L);
  if (el && U[el[1].length].v === TSERE) return { kind: 'el', prefix: el[1].length };
  return null;
}

/**
 * Transliterate one sub-word: → { syl: [string], stress: index | null, unitSyl } . stressUnit from the accents.
 * name: divine-name substitution (or null).
 */
function translit(w, { lastOfVerse, name }) {
  let U = units(w);
  if (name?.kind === 'yhvh' || name?.kind === 'yah' || name?.kind === 'adonai') {
    const pre = U.slice(0, name.prefix);
    const r = pre.length ? translit(pre.map((u) => u.ch + String.fromCodePoint(...u.marks)).join(''), { lastOfVerse: false, name: null }) : { syl: [] };
    // prefix vowels before the name: the prefix's own vowel, else the name's first vowel (la-, ba-, va-)
    const syl = [...r.syl];
    if (syl.length && /[^aeiou]$/.test(syl[syl.length - 1])) syl[syl.length - 1] += 'a';
    if (pre.length && !syl.length) syl.push(`${pre.map((u) => u.cons).join('')}a`);
    return name.kind === 'yah' ? { syl: [...syl, 'kah'], stress: syl.length } : { syl: [...syl, 'ha', 'shem'], stress: syl.length + 1 };
  }
  if (name?.kind === 'elohim') U[name.he].cons = 'k';
  if (name?.kind === 'el') U[name.prefix].cons = 'k';
  const n = U.length;
  const hasV = (u) => u && u.v !== null && u.v !== SHEVA;
  // vav (shuruk, holam male) first: it gives the letter before it its vowel; then yod, then alef / he
  for (let i = 0; i < n; i++) U[i].role = 'cons';
  for (let i = 0; i < n; i++) {
    const u = U[i], p = U[i - 1];
    if (u.ch !== 'ו') continue;
    if (u.v === null && u.dagesh && (i === 0 || !hasV(p))) { u.role = i === 0 ? 'shuruk0' : 'mater'; if (p) p.vEx = 'u'; }
    else if ((u.v === HOLAM || (u.v === null && u.marks.includes(HOLAM))) && p && !hasV(p) && p.v !== SHEVA && !p.vEx) { u.role = 'mater'; p.vEx = 'o'; }
  }
  for (let i = 0; i < n; i++) {
    const u = U[i], p = U[i - 1];
    if (u.ch !== 'י' || u.v !== null || u.dagesh || u.vEx || !p || !(hasV(p) || p.vEx)) continue;
    const pv = p.vEx ? null : p.v;
    if (pv === HIRIQ || pv === SEGOL) u.role = 'mater';
    else if (pv === TSERE) { u.role = 'mater'; p.vEx = 'ei'; }
    else if ((pv === QAMATS || pv === PATAH) && U[i + 1]?.ch === 'ו' && i + 1 === n - 1) u.role = 'mater';
    else if (pv === QAMATS || pv === PATAH) { u.role = 'mater'; p.vEx = 'ai'; }
    else u.role = 'coda';
  }
  for (let i = 0; i < n; i++) {
    const u = U[i], p = U[i - 1];
    if (u.ch === 'א' && u.v === null && !u.vEx) u.role = 'mater';
    if (u.ch === 'ה' && i === n - 1 && u.v === null && !u.dagesh) u.role = 'mater';
    // furtive patach: final chet / ayin / he-mappiq after a vowel
    if (i === n - 1 && i > 0 && u.v === PATAH && 'חעה'.includes(u.ch) && (hasV(p) || p.vEx || p.role === 'mater')) u.role = 'furtive';
  }
  // sheva: na or nach
  for (let i = 0; i < n; i++) {
    const u = U[i];
    if (u.v !== SHEVA) continue;
    const p = U[i - 1], nx = U[i + 1];
    const last = U.slice(i + 1).every((x) => x.role === 'mater' && !x.vEx);
    let na = false;
    if (last) na = false;
    else if (i === 0 || p?.role === 'shuruk0') na = true;
    else if (p?.v === SHEVA && !p.na) na = true;
    else if (u.dagesh && (!BEGADKEFAT.has(u.ch) || hasV(p))) na = true;
    else if (p && (p.meteg || p.acc.length) && (LONGV.has(p.v) || p.vEx === 'u' || p.vEx === 'o' || p.vEx === 'ei' || (p.v === HIRIQ && U[i - 1 + 1]?.role === 'mater'))) na = true;
    else if (nx && nx.ch === u.ch) na = true;
    u.na = na;
  }
  // syllables
  const syl = []; const unitSyl = new Array(n).fill(-1);
  let cur = null;
  for (let i = 0; i < n; i++) {
    const u = U[i];
    if (u.role === 'shuruk0') { cur = { on: '', v: 'u', co: '', q: false }; syl.push(cur); unitSyl[i] = syl.length - 1; continue; }
    if (u.role === 'mater') { unitSyl[i] = syl.length - 1; continue; }
    if (u.role === 'furtive') { if (cur) cur.co += `a${u.cons}`; unitSyl[i] = syl.length - 1; continue; }
    const v = u.vEx ? u.vEx : (u.v !== null && u.v !== SHEVA ? VOWEL[u.v] : u.v === SHEVA && u.na ? 'e' : null);
    if (v && u.role !== 'coda') {
      cur = { on: u.cons, v, co: '', q: u.v === QAMATS && !u.vEx, meteg: u.meteg, u: i };
      syl.push(cur); unitSyl[i] = syl.length - 1;
    } else {
      if (!cur) { cur = { on: '', v: 'e', co: '' }; syl.push(cur); }
      cur.co += u.cons; unitSyl[i] = syl.length - 1;
    }
  }
  // stress from the accents
  let su = -1;
  for (let i = 0; i < n; i++) for (const a of U[i].acc) if (!POSITIONAL.has(a)) su = i;
  if (su < 0) {
    const pashta = U.map((u, i) => (u.acc.includes(0x599) ? i : -1)).filter((i) => i >= 0);
    if (pashta.length > 1) su = pashta[0];
  }
  if (su < 0 && lastOfVerse) for (let i = 0; i < n; i++) if (U[i].meteg) su = i; // silluq
  const hasAccent = U.some((u) => u.acc.length) || (lastOfVerse && U.some((u) => u.meteg));
  let stress = su >= 0 ? unitSyl[su] : hasAccent ? syl.length - 1 : null;
  if (stress < 0) stress = syl.length - 1;
  // qamats qatan (unmarked in this text): a closed syllable without meteg in an unaccented word before a maqaf
  // (kol-), or in the kodesh / ozen nouns; elsewhere a closed qamats is too often a verb's qamats gadol (gad-lu)
  const QQ = /^[ובלכמשה]{0,2}(קדש|אזנ)/.test(letters(w));
  syl.forEach((s, k) => { if (s.q && s.co && !s.meteg && (stress === null || (k !== stress && QQ))) s.v = 'o'; });
  return { syl: syl.map((s) => s.on + s.v + s.co), stress };
}

/** one verse → { he, tr, names: [..] } */
function verse(raw, key, poetic) {
  const words = clean(raw).split(' ');
  const profane = PROFANE[key] || [];
  let nameIdx = 0;
  const names = [];
  const toks = words.map((w, wi) => {
    const subs = w.split('־');
    const lastOfVerse = wi === words.length - 1;
    const parts = subs.map((sw, si) => {
      let name = divineName(sw);
      if (name && (name.kind === 'elohim' || name.kind === 'el')) {
        if (profane.includes(nameIdx)) { names.push(`${name.kind}#${nameIdx} profane ${stripAcc(sw)}`); name = null; } else names.push(`${name.kind}#${nameIdx} ${stripAcc(sw)}`);
        nameIdx++;
      } else if (name) names.push(`${name.kind} ${stripAcc(sw)}`);
      const t = translit(sw, { lastOfVerse: lastOfVerse && si === subs.length - 1, name });
      return { sw, name, t };
    });
    // the compound's stress: its last accented part
    let stressPart = parts.length - 1;
    for (let k = parts.length - 1; k >= 0; k--) if (parts[k].t.stress !== null) { stressPart = k; break; }
    const sylls = []; let stressAt = -1;
    parts.forEach((p, k) => { if (k === stressPart) stressAt = sylls.length + (p.t.stress ?? p.t.syl.length - 1); sylls.push(...p.t.syl); });
    const tr = sylls.map((s, k) => (k === stressAt && k !== sylls.length - 1 ? `${s}*` : s)).join('-');
    const accs = new Set(); for (const ch of w) { const c = ch.codePointAt(0); if (isAccent(c)) accs.add(c); }
    const he = parts.map((p) => heWord(p.sw, p.name)).join('־');
    return { tr, he, accs, n: sylls.length };
  });
  // phrasing: ',' at the main division(s), '.' at the end; long half-verses split again
  const cut = new Set();
  toks.forEach((t, i) => {
    if (i === toks.length - 1) return;
    if (t.accs.has(0x591)) cut.add(i);
    if (poetic && t.accs.has(0x5ab) && t.accs.has(0x5a5)) cut.add(i);
  });
  const tiers = poetic ? SPLIT_POETIC : SPLIT_PROSE;
  const splitRange = (a, b) => { // tokens a..b inclusive form one half-verse
    const len = toks.slice(a, b + 1).reduce((s, t) => s + t.n, 0);
    if (len <= LONG) return;
    for (const tier of tiers) {
      let best = -1, bestD = Infinity, acc = 0;
      for (let i = a; i < b; i++) {
        acc += toks[i].n;
        if (acc < 6 || len - acc < 6) continue;
        if (![...toks[i].accs].some((c) => tier.includes(c))) continue;
        const d = Math.abs(acc - len / 2);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) { cut.add(best); splitRange(a, best); splitRange(best + 1, b); return; }
    }
  };
  let a = 0;
  for (let i = 0; i < toks.length; i++) if (cut.has(i) || i === toks.length - 1) { splitRange(a, i); a = i + 1; }
  const tr = toks.map((t, i) => t.tr + (i === toks.length - 1 ? '.' : cut.has(i) ? ',' : '')).join(' ');
  const he = toks.map((t) => t.he).join(' ');
  return { he, tr: tr[0].toUpperCase() + tr.slice(1), names };
}

/** caption Hebrew for a sub-word: no accents, the Divine Name in its written substitute */
function heWord(sw, name) {
  const s = stripAcc(sw);
  if (!name) return s;
  const chars = [...s];
  const idx = []; chars.forEach((ch, i) => { if (isLetter(ch.codePointAt(0))) idx.push(i); });
  if (name.kind === 'yhvh') return `${chars.slice(0, idx[name.prefix]).join('')}ה׳`;
  if (name.kind === 'yah') return `${chars.slice(0, idx[name.prefix]).join('')}קָהּ`;
  if (name.kind === 'adonai') return `${chars.slice(0, idx[name.prefix]).join('')}אֲדֹ-נָי`;
  if (name.kind === 'elohim') { chars[idx[name.he]] = 'ק'; return chars.join(''); }
  if (name.kind === 'el') { chars[idx[name.prefix]] = 'ק'; return chars.join(''); }
  return s;
}

// ------------------------------------------------------------------ main
const out = {};
const report = [];
for (const [ref, key, first, poetic] of TEXTS) {
  const vs = await fetchText(ref);
  vs.forEach((raw, i) => {
    const k = `${key}:${first + i}`;
    const r = verse(raw, k, poetic);
    for (const [from, to] of SPELLING[k] || []) {
      if (!r.he.includes(from)) throw new Error(`${k}: spelling ${from} not found in ${r.he}`);
      r.he = r.he.replace(from, to);
      report.push(`${k}: spelling ${from} → ${to}`);
    }
    out[k] = [r.he, r.tr];
    if (r.names.length) report.push(`${k}: ${r.names.join(' | ')}`);
  });
}
const body = Object.entries(out).map(([k, [he, tr]]) => `  '${k}': [${JSON.stringify(he)}, ${JSON.stringify(tr)}],`).join('\n');
const file = `// GENERATED by src/audio/dev/make-songs.mjs — do not edit by hand (fix the generator and re-run it).
// Hebrew: the Westminster Leningrad Codex (public domain; tanach.us, via Sefaria "${VERSION}"), vowels kept,
// cantillation dropped, qere for ketiv; the Divine Names in their customary written substitutes (ה׳, אֱלֹקִים, קֵל, קָהּ);
// four words of Ha'azinu in the Sefer Torah's (Aleppo) spelling (Dt 32:7, 24, 27, 34 — make-songs.mjs SPELLING).
// tr: the chant's syllables ('-'), stress when not final ('*', from the accents), half-verse ',' and verse end '.'.
// key → [caption Hebrew, chant transliteration]
export const HEB = {
${body}
};
`;
writeFileSync(join(root, 'src/audio/songs-text.js'), file);
console.log(`wrote src/audio/songs-text.js: ${Object.keys(out).length} verses, ${(file.length / 1024).toFixed(1)} KB`);
console.log(report.join('\n'));
