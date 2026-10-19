// Citation strings → Sefaria links where the mapping is unambiguous; plain text otherwise.
// Every title spelling below was checked against the Sefaria API (see docs/decisions/ui.md).
//   'Tamid 3:9'            → Mishnah_Tamid.3.9           (chapter:mishnah = Mishnah)
//   'Yoma 21b'             → Yoma.21b                    (daf + amud = Bavli)
//   'Rambam BhB 5:1'       → Mishneh_Torah,_The_Chosen_Temple.5.1
//   'Exodus 30:8' / 'Shemot 30:8' → Exodus.30.8
// Ranges ('Middot 5:1–2', 'Tamid 3:9–4:1', 'Yoma 16a–b') link to their first reference.

const BASE = 'https://www.sefaria.org/';

/** tractate aliases → Sefaria title (Mishnah: "Mishnah_<t>", Bavli: "<t>") */
const TRACTATES = {
  middot: 'Middot', tamid: 'Tamid', shekalim: 'Shekalim', kelim: 'Kelim', parah: 'Parah', yoma: 'Yoma',
  sukkah: 'Sukkah', pesachim: 'Pesachim', taanit: 'Taanit', "ta'anit": 'Taanit', arachin: 'Arakhin', arakhin: 'Arakhin',
  bikkurim: 'Bikkurim', berachot: 'Berakhot', berakhot: 'Berakhot', sotah: 'Sotah', menachot: 'Menachot',
  zevachim: 'Zevachim', sanhedrin: 'Sanhedrin', chagigah: 'Chagigah', megillah: 'Megillah',
  'rosh hashanah': 'Rosh_Hashanah', rh: 'Rosh_Hashanah', shabbat: 'Shabbat', 'bava batra': 'Bava_Batra', bb: 'Bava_Batra',
  keritot: 'Keritot', chullin: 'Chullin', avot: 'Avot', 'pirkei avot': 'Avot',
};
/** tractates with no Bavli daf numbering we can trust for a link */
const NO_BAVLI = new Set(['Middot', 'Kelim', 'Parah', 'Shekalim', 'Avot', 'Bikkurim']);

const TANAKH = {
  genesis: 'Genesis', bereshit: 'Genesis', bereishit: 'Genesis', exodus: 'Exodus', shemot: 'Exodus',
  leviticus: 'Leviticus', vayikra: 'Leviticus', numbers: 'Numbers', bamidbar: 'Numbers',
  deuteronomy: 'Deuteronomy', devarim: 'Deuteronomy', 'i kings': 'I_Kings', '1 kings': 'I_Kings', 'i melachim': 'I_Kings',
  'ii kings': 'II_Kings', '2 kings': 'II_Kings', 'ii melachim': 'II_Kings', 'i samuel': 'I_Samuel', '1 samuel': 'I_Samuel', 'i shmuel': 'I_Samuel',
  'ii samuel': 'II_Samuel', '2 samuel': 'II_Samuel', 'ii shmuel': 'II_Samuel', ezekiel: 'Ezekiel', yechezkel: 'Ezekiel', ezra: 'Ezra',
  nehemiah: 'Nehemiah', nechemiah: 'Nehemiah', haggai: 'Haggai', chaggai: 'Haggai', zechariah: 'Zechariah',
  psalms: 'Psalms', psalm: 'Psalms', tehillim: 'Psalms', 'i chronicles': 'I_Chronicles', '1 chronicles': 'I_Chronicles', 'i dh': 'I_Chronicles',
  'ii chronicles': 'II_Chronicles', '2 chronicles': 'II_Chronicles', 'ii dh': 'II_Chronicles', daniel: 'Daniel', job: 'Job', iyov: 'Job',
  isaiah: 'Isaiah', yeshayahu: 'Isaiah', jeremiah: 'Jeremiah', yirmiyahu: 'Jeremiah', lamentations: 'Lamentations', eichah: 'Lamentations',
};

/** Rambam, Mishneh Torah: book aliases → Sefaria title */
const RAMBAM = {
  bhb: 'The_Chosen_Temple', 'beit habechirah': 'The_Chosen_Temple', 'beit ha-bechirah': 'The_Chosen_Temple',
  'hilchot beit habechirah': 'The_Chosen_Temple', 'bet habechirah': 'The_Chosen_Temple',
  khm: 'Vessels_of_the_Sanctuary_and_Those_who_Serve_Therein', 'klei hamikdash': 'Vessels_of_the_Sanctuary_and_Those_who_Serve_Therein',
  'temidin umusafin': 'Daily_Offerings_and_Additional_Offerings', tum: 'Daily_Offerings_and_Additional_Offerings',
  "bi'at mikdash": 'Admission_into_the_Sanctuary', 'biat mikdash': 'Admission_into_the_Sanctuary',
  'maaseh hakorbanot': 'Sacrificial_Procedure', "ma'aseh hakorbanot": 'Sacrificial_Procedure',
  'parah adumah': 'Red_Heifer', 'avodat yom hakippurim': 'Service_on_the_Day_of_Atonement',
};
const RAMBAM_ONLY = new Set(['bhb', 'khm', 'beit habechirah', 'klei hamikdash', 'temidin umusafin']);

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** One citation → { text, url|null } */
export function parseCitation(raw) {
  const text = typeof raw === 'string' ? raw : (raw?.ref || raw?.text || String(raw ?? ''));
  let s = text.trim().replace(/^(mishnah|m\.|bavli|b\.|bt|talmud)\s+/i, '');
  const mishnahHint = /^(mishnah|m\.)\s/i.test(text.trim());
  let m;

  // Rambam (Mishneh Torah)
  m = /^(?:rambam,?\s+|mishneh torah,?\s+|hilchot\s+)?([a-z'’ -]+?)\s+(\d+)(?::(\d+))?/i.exec(s);
  if (m) {
    const book = norm(m[1].replace(/’/g, "'")).replace(/^hilchot /, ''); // "Rambam Hilchot Bi'at Mikdash 2:1"
    const isRambam = /^(rambam|mishneh torah|hilchot)\b/i.test(s) || RAMBAM_ONLY.has(book);
    if (isRambam && RAMBAM[book]) {
      return { text, url: `${BASE}Mishneh_Torah,_${RAMBAM[book]}.${m[2]}${m[3] ? `.${m[3]}` : ''}` };
    }
  }
  // Talmud Bavli: "Yoma 21b"
  m = /^([a-z'’ ]+?)\s+(\d+)([ab])\b/i.exec(s);
  if (m && !mishnahHint) {
    const t = TRACTATES[norm(m[1].replace(/’/g, "'"))];
    if (t && !NO_BAVLI.has(t)) return { text, url: `${BASE}${t}.${m[2]}${m[3].toLowerCase()}` };
  }
  // Mishnah: "Tamid 3:9" — or Tanakh, whose book may carry a number ("1 Kings 6:2", "II Chronicles 3:1")
  m = /^((?:[12]\s+)?[a-z'’ ]+?)\s+(\d+):(\d+)/i.exec(s);
  if (m) {
    const key = norm(m[1].replace(/’/g, "'"));
    const t = TRACTATES[key];
    if (t) return { text, url: t === 'Avot' ? `${BASE}Pirkei_Avot.${m[2]}.${m[3]}` : `${BASE}Mishnah_${t}.${m[2]}.${m[3]}` };
    const b = TANAKH[key];
    if (b) return { text, url: `${BASE}${b}.${m[2]}.${m[3]}` };
  }
  // Tanakh chapter only: "Psalms 48", "Bamidbar 28"
  m = /^((?:i{1,2}\s+|[12]\s+)?[a-z]+)\s+(\d+)\s*$/i.exec(s);
  if (m && TANAKH[norm(m[1])]) return { text, url: `${BASE}${TANAKH[norm(m[1])]}.${m[2]}` };
  return { text, url: null };
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
