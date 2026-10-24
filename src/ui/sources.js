// Citation strings → Sefaria links where the mapping is unambiguous; plain text otherwise.
// Every title spelling below was checked against the Sefaria API (see docs/decisions/ui.md, qa-r1-ui.md).
//   'Tamid 3:9'            → Mishnah_Tamid.3.9           (chapter:mishnah = Mishnah)
//   'Yoma 21b'             → Yoma.21b                    (daf + amud = Bavli)
//   'Rambam BhB 5:1'       → Mishneh_Torah,_The_Chosen_Temple.5.1
//   'Exodus 30:8' / 'Shemot 30:8' → Exodus.30.8
//   'Kesef Mishneh on Rambam TuM 1:7' → Kessef_Mishneh_on_Mishneh_Torah,_Daily_Offerings_and_Additional_Offerings.1.7
// Ranges link as Sefaria ranges: 'Middot 5:1–2' → Mishnah_Middot.5.1-2, 'Tamid 3:9–4:1' → Mishnah_Tamid.3.9-4.1,
// 'Yoma 16a–b' → Yoma.16a-16b, 'Yoma 30b–31a' → Yoma.30b-31a, 'Bamidbar 28:9–10' → Numbers.28.9-10.
// A citation quoted inside another work ("Ritva on Yoma ch. 1 (in Kesef Mishneh TuM 1:7)") links to where it is quoted.
// Plain text on purpose: the report ("Report §…"), Ezrat Kohanim (not on Sefaria), Shiltei HaGiborim (Portaleone, 1612;
// Sefaria's "Shiltei HaGiborim" is a different work, on the Rif), Yerushalmi, and the Tosefta, whose Sefaria edition
// numbers its halachot differently from the Zuckermandel numbering the Gemara and the report use (Tosefta Sanhedrin 2:6
// is Sefaria's 2:2), so a link would open a different passage.

const BASE = 'https://www.sefaria.org/';

/** tractate aliases → Sefaria title (Mishnah: "Mishnah_<t>", Bavli: "<t>") */
const TRACTATES = {
  middot: 'Middot', tamid: 'Tamid', shekalim: 'Shekalim', kelim: 'Kelim', parah: 'Parah', yoma: 'Yoma',
  sukkah: 'Sukkah', pesachim: 'Pesachim', taanit: 'Taanit', "ta'anit": 'Taanit', arachin: 'Arakhin', arakhin: 'Arakhin',
  bikkurim: 'Bikkurim', berachot: 'Berakhot', berakhot: 'Berakhot', sotah: 'Sotah', menachot: 'Menachot',
  zevachim: 'Zevachim', sanhedrin: 'Sanhedrin', chagigah: 'Chagigah', megillah: 'Megillah',
  'rosh hashanah': 'Rosh_Hashanah', rh: 'Rosh_Hashanah', shabbat: 'Shabbat', 'bava batra': 'Bava_Batra', bb: 'Bava_Batra',
  keritot: 'Keritot', chullin: 'Chullin', avot: 'Avot', 'pirkei avot': 'Avot',
  kinnim: 'Kinnim', negaim: 'Negaim', "nega'im": 'Negaim', nazir: 'Nazir', temurah: 'Temurah',
  bekhorot: 'Bekhorot', bechorot: 'Bekhorot', eruvin: 'Eruvin', ketubot: 'Ketubot', ketubbot: 'Ketubot',
  shevuot: 'Shevuot', "shevu'ot": 'Shevuot',
};
/** tractates with no Bavli daf numbering we can trust for a link */
const NO_BAVLI = new Set(['Middot', 'Kelim', 'Parah', 'Shekalim', 'Avot', 'Bikkurim', 'Kinnim', 'Negaim']);

const TANAKH = {
  genesis: 'Genesis', bereshit: 'Genesis', bereishit: 'Genesis', exodus: 'Exodus', shemot: 'Exodus',
  leviticus: 'Leviticus', vayikra: 'Leviticus', numbers: 'Numbers', bamidbar: 'Numbers',
  deuteronomy: 'Deuteronomy', devarim: 'Deuteronomy', 'i kings': 'I_Kings', '1 kings': 'I_Kings', 'i melachim': 'I_Kings',
  'ii kings': 'II_Kings', '2 kings': 'II_Kings', 'ii melachim': 'II_Kings', 'melachim i': 'I_Kings', 'melachim ii': 'II_Kings',
  'i samuel': 'I_Samuel', '1 samuel': 'I_Samuel', 'i shmuel': 'I_Samuel', 'shmuel i': 'I_Samuel', '1 shmuel': 'I_Samuel',
  'ii samuel': 'II_Samuel', '2 samuel': 'II_Samuel', 'ii shmuel': 'II_Samuel', 'shmuel ii': 'II_Samuel', '2 shmuel': 'II_Samuel',
  ezekiel: 'Ezekiel', yechezkel: 'Ezekiel', ezra: 'Ezra',
  nehemiah: 'Nehemiah', nechemiah: 'Nehemiah', haggai: 'Haggai', chaggai: 'Haggai', zechariah: 'Zechariah',
  psalms: 'Psalms', psalm: 'Psalms', tehillim: 'Psalms', 'i chronicles': 'I_Chronicles', '1 chronicles': 'I_Chronicles', 'i dh': 'I_Chronicles',
  'ii chronicles': 'II_Chronicles', '2 chronicles': 'II_Chronicles', 'ii dh': 'II_Chronicles',
  '1 divrei hayamim': 'I_Chronicles', 'i divrei hayamim': 'I_Chronicles', 'divrei hayamim i': 'I_Chronicles',
  '2 divrei hayamim': 'II_Chronicles', 'ii divrei hayamim': 'II_Chronicles', 'divrei hayamim ii': 'II_Chronicles',
  daniel: 'Daniel', job: 'Job', iyov: 'Job',
  isaiah: 'Isaiah', yeshayahu: 'Isaiah', jeremiah: 'Jeremiah', yirmiyahu: 'Jeremiah', lamentations: 'Lamentations', eichah: 'Lamentations',
};

/** Rambam, Mishneh Torah: book aliases → Sefaria title */
const RAMBAM = {
  bhb: 'The_Chosen_Temple', 'beit habechirah': 'The_Chosen_Temple', 'beit ha-bechirah': 'The_Chosen_Temple',
  'hilchot beit habechirah': 'The_Chosen_Temple', 'bet habechirah': 'The_Chosen_Temple',
  khm: 'Vessels_of_the_Sanctuary_and_Those_who_Serve_Therein', 'klei hamikdash': 'Vessels_of_the_Sanctuary_and_Those_who_Serve_Therein',
  'temidin umusafin': 'Daily_Offerings_and_Additional_Offerings', tum: 'Daily_Offerings_and_Additional_Offerings',
  "bi'at mikdash": 'Admission_into_the_Sanctuary', 'biat mikdash': 'Admission_into_the_Sanctuary',
  mk: 'Sacrificial_Procedure', 'maaseh hakorbanot': 'Sacrificial_Procedure', "ma'aseh hakorbanot": 'Sacrificial_Procedure',
  'pesulei hamukdashin': 'Sacrifices_Rendered_Unfit', 'pesulei hamukdashim': 'Sacrifices_Rendered_Unfit',
  bikkurim: 'First_Fruits_and_other_Gifts_to_Priests_Outside_the_Sanctuary',
  'parah adumah': 'Red_Heifer', 'avodat yom hakippurim': 'Service_on_the_Day_of_Atonement',
};
/** abbreviations that mean the Rambam even without "Rambam" before them ('mk' is not here: it can be Moed Katan) */
const RAMBAM_ONLY = new Set(['bhb', 'khm', 'beit habechirah', 'klei hamikdash', 'temidin umusafin']);

const norm = (s) => s.toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ').trim();
const DASH = '\\s*[–—-]\\s*';
/** "c:v", "c:v–w" or "c:v–c2:w" after a book name → Sefaria "c.v", "c.v-w", "c.v-c2.w" */
const VERSE = new RegExp(`^(\\d+):(\\d+)(?:${DASH}(\\d+)(?::(\\d+))?)?`);
function verseRef(rest) {
  const m = VERSE.exec(rest);
  if (!m) return null;
  let ref = `${m[1]}.${m[2]}`;
  if (m[3] && m[4]) ref += `-${m[3]}.${m[4]}`;
  else if (m[3]) ref += `-${m[3]}`;
  return ref;
}
/** "21b", "16a–b", "30b–31a" → Sefaria "21b", "16a-16b", "30b-31a" */
const DAF = new RegExp(`^(\\d+)([ab])\\b(?:${DASH}(\\d+)?([ab])\\b)?`, 'i');
function dafRef(rest) {
  const m = DAF.exec(rest);
  if (!m) return null;
  const a = `${m[1]}${m[2].toLowerCase()}`;
  return m[4] ? `${a}-${m[3] || m[1]}${m[4].toLowerCase()}` : a;
}
/** "28" or "25–30" (chapters) */
const CHAPTERS = new RegExp(`^(\\d+)(?:${DASH}(\\d+))?\\s*$`);

/** split "Book c:v…" into [book, rest]: the book is the words before the first number (a leading 1/2 belongs to it) */
function splitBook(s) {
  const m = /^((?:[12]\s+)?[a-z'’ ,-]*?[a-z'’])\s+(\d.*)$/i.exec(s);
  return m ? [m[1].replace(/,$/, ''), m[2]] : null;
}

/** "BhB 5:1", "Hilchot Bi'at Mikdash 2:1", "MK 6:1–18" (after "Rambam") → URL or null */
function rambamUrl(s, prefix = 'Mishneh_Torah,_') {
  const p = splitBook(s);
  if (!p) return null;
  const book = norm(p[0]).replace(/^hilchot /, '');
  const ref = verseRef(p[1]) || (CHAPTERS.test(p[1]) ? p[1].trim().replace(new RegExp(DASH), '-') : null);
  return RAMBAM[book] && ref ? `${BASE}${prefix}${RAMBAM[book]}.${ref}` : null;
}

/** One citation → { text, url|null } */
export function parseCitation(raw) {
  const text = typeof raw === 'string' ? raw : (raw?.ref || raw?.text || String(raw ?? ''));
  const trimmed = text.trim();
  const url = citationUrl(trimmed);
  if (url) return { text, url };
  // quoted inside another work: "Ritva on Yoma ch. 1 (in Kesef Mishneh TuM 1:7)" → where it is quoted
  const inner = /\(in ([^()]+)\)\s*$/i.exec(trimmed);
  if (inner) { const u = citationUrl(inner[1].trim()); if (u) return { text, url: u }; }
  return { text, url: null };
}

function citationUrl(t) {
  if (/^report\b/i.test(t)) return null;
  const mishnahHint = /^(mishnah|m\.)\s/i.test(t);
  let s = t.replace(/^(mishnah|m\.|bavli|b\.|bt|talmud)\s+/i, '');

  // commentary on the Rambam: "Kesef Mishneh on Rambam TuM 1:7", "Kesef Mishneh TuM 1:7"
  let m = /^kess?ef mishneh(?:\s+on)?(?:\s+(?:rambam|mishneh torah),?)?\s+(.+)$/i.exec(s);
  if (m) return rambamUrl(m[1], 'Kessef_Mishneh_on_Mishneh_Torah,_');
  // Bartenura on a Mishnah ("Bartenura on Middot 1:4–5"); Rashi on the Bavli or the Torah ("Rashi on Shabbat 90a")
  m = /^(bartenura|rashi)\s+on\s+(.+)$/i.exec(s);
  if (m) {
    const u = citationUrl(m[2]);
    const ref = u?.slice(BASE.length);
    if (!ref) return null;
    if (/^bartenura$/i.test(m[1])) return ref.startsWith('Mishnah_') ? `${BASE}Bartenura_on_${ref}` : null;
    return ref.startsWith('Mishnah_') || ref.startsWith('Mishneh_Torah') ? null : `${BASE}Rashi_on_${ref}`;
  }
  // Rambam (Mishneh Torah)
  m = /^(rambam|mishneh torah|hilchot)\b,?\s*/i.exec(s);
  if (m) {
    const rest = m[1].toLowerCase() === 'hilchot' ? s : s.slice(m[0].length);
    const u = rambamUrl(rest);
    if (u) return u;
  } else {
    const p = splitBook(s);
    if (p && RAMBAM_ONLY.has(norm(p[0]))) { const u = rambamUrl(s); if (u) return u; }
  }
  const p = splitBook(s);
  if (!p) return null;
  const key = norm(p[0]);
  const t2 = TRACTATES[key];
  // Talmud Bavli: "Yoma 21b", "Yoma 16a–b"
  const daf = dafRef(p[1]);
  if (t2 && daf && !mishnahHint) return NO_BAVLI.has(t2) ? null : `${BASE}${t2}.${daf}`;
  // Mishnah "Tamid 3:9", or Tanakh "1 Kings 6:2", "Shmuel I 21:7"
  const ref = verseRef(p[1]);
  if (ref) {
    if (t2) return t2 === 'Avot' ? `${BASE}Pirkei_Avot.${ref}` : `${BASE}Mishnah_${t2}.${ref}`;
    if (TANAKH[key]) return `${BASE}${TANAKH[key]}.${ref}`;
    return null;
  }
  // Tanakh chapter(s) only: "Psalms 48", "Shemot 25–30"
  m = CHAPTERS.exec(p[1]);
  if (m && TANAKH[key]) return `${BASE}${TANAKH[key]}.${m[1]}${m[2] ? `-${m[2]}` : ''}`;
  return null;
}

/** A sources array (strings, possibly "A; B") → flat list of { text, url } */
export function parseSources(list) {
  const out = [];
  for (const item of list || []) {
    const str = typeof item === 'string' ? item : (item?.ref || item?.text || '');
    for (const part of str.split(/\s*;\s*/)) if (part.trim()) out.push(parseCitation(part));
  }
  return out;
}
