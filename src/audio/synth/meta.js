// Small, dependency-free tables shared by the main thread and the synthesis code (keeps the DSP out of the
// main audio chunk — it lives in the worker bundle).

/** Psalm of the day by weekday (0 = Sunday) — Tamid 7:4. */
export const PSALM_BY_DAY = [24, 48, 82, 94, 81, 93, 92];

/** Psalm of the day: number in Hebrew numerals and an English incipit (for the caption). */
export const PSALM_INFO = {
  24: { he: 'כ״ד', en: 'Of David, a psalm: the earth and its fullness are the Lord\'s' },
  48: { he: 'מ״ח', en: 'A song, a psalm of the sons of Korach: great is the Lord and much praised' },
  82: { he: 'פ״ב', en: 'A psalm of Asaf: God stands in the divine assembly' },
  94: { he: 'צ״ד', en: 'God of retribution' },
  81: { he: 'פ״א', en: 'Sing joyously to God our strength' },
  93: { he: 'צ״ג', en: 'The Lord reigns, robed in majesty' },
  92: { he: 'צ״ב', en: 'A psalm, a song for the Shabbat day' },
};
const HE_PART = ['א׳', 'ב׳', 'ג׳'];
/** Caption for a section of the Levites' song. */
export function psalmCaption(psalm, section = 0, style) {
  const p = PSALM_INFO[psalm];
  if (!p) return null;
  const k = Math.max(0, Math.min(2, section | 0));
  const lens = style === 'sg1612' ? ' — four voices, after Shiltei HaGiborim (1612)' : '';
  return {
    en: `The Levites sing the song of the day — Psalm ${psalm}, "${p.en}" (part ${k + 1} of 3; Tamid 7:3-4)${lens}`,
    he: `שִׁיר שֶׁל יוֹם — תְּהִלִּים ${p.he}, פֶּרֶק ${HE_PART[k]}`,
  };
}

/** Captions emitted with the voice cues (the UI shows them as subtitles). */
export const CAPTIONS = {
  barkai: { en: '"Barkai!" — the east is alight (Tamid 3:2)', he: 'בַּרְקַאי!' },
  'barkai-hebron': { en: '"Is the whole east lit, as far as Hebron?" — "Yes!" (Tamid 3:2, Matya ben Shmuel)', he: 'הֵאִיר פְּנֵי כָל הַמִּזְרָח עַד שֶׁבְּחֶבְרוֹן? — הֵין!' },
  gevini: { en: '"Arise, kohanim, to your service; Leviim to your platform; Israelites to your ma\'amad!" (Gevini the crier — Yoma 20b)', he: 'עִמְדוּ כֹהֲנִים לַעֲבוֹדַתְכֶם, וּלְוִיִּם לְדוּכָנְכֶם, וְיִשְׂרָאֵל לְמַעֲמַדְכֶם!' },
  'shalom-call': { en: '"Shalom alecha!" — the Officer of the Temple Mount on his round (Middot 1:2)', he: 'שָׁלוֹם עָלֶיךָ!' },
  'shalom-all-well': { en: '"Shalom! All is well." — the two torch companies meet (Tamid 1:3)', he: 'שָׁלוֹם, הַכֹּל שָׁלוֹם!' },
  'grinder-chant': { en: '"Hadek heitev, heitev hadek" — "grind it fine, fine grind it": the voice is good for the spices (Keritot 6b)', he: 'הָדֵק הֵיטֵב, הֵיטֵב הָדֵק' },
};

/** Zone id (ARCHITECTURE.md §8) → space key. Unknown zones fall back by prefix, then 'court'. */
export const ZONE_SPACE = {
  outside: 'open', kidron: 'open', 'har-hamishchah': 'open', 'parah-causeway': 'open',
  'har-habayit': 'mount', chel: 'mount', soreg: 'mount', 'gate-shushan': 'mount', 'gate-chuldah-w': 'tight', 'gate-chuldah-e': 'tight', 'gate-kiponus': 'mount', 'gate-tadi': 'mount',
  stoa: 'stoa', 'en-gallery': 'stoa',
  'ezrat-nashim': 'court', 'en-gate-east': 'court', 'fifteen-steps': 'court', nikanor: 'court', 'ezrat-yisrael': 'court', 'ezrat-kohanim': 'court', azarah: 'court',
  mizbeach: 'court', kevesh: 'court', 'slaughter-zone': 'court', 'bein-haulam-lamizbeach': 'court', kiyor: 'court', 'ulam-steps': 'court', roof: 'open',
  'en-chamber-wood': 'chamber', 'en-chamber-lepers': 'chamber', 'en-chamber-nazirites': 'chamber', 'en-chamber-oil': 'chamber', 'music-chambers': 'chamber',
  gazit: 'hall', golah: 'chamber', 'etz-parhedrin': 'chamber', melach: 'chamber', parvah: 'chamber', medichin: 'chamber', 'beit-hamoked': 'hall',
  'beit-avtinas': 'hall', 'beit-hanitzotz': 'chamber', 'beit-hachalifot': 'chamber',
  ulam: 'heichal', heichal: 'heichal', 'amah-traksin': 'heichal', 'kodesh-hakodashim': 'heichal', aliyah: 'heichal',
  taim: 'tight', mesibah: 'tight', 'underground-passage': 'tight', 'beit-hatevilah': 'chamber',
  'gate-delek': 'court', 'gate-bechorot': 'court', 'gate-mayim': 'court', 'gate-nitzotz': 'court', 'gate-korban': 'court', 'gate-moked': 'court',
};
export function spaceForZone(id) {
  if (!id) return 'open';
  if (ZONE_SPACE[id]) return ZONE_SPACE[id];
  if (id.startsWith('en-chamber') || id.endsWith('-chamber')) return 'chamber';
  if (id.startsWith('gate-')) return 'court';
  return 'court';
}

