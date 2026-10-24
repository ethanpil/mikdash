// ABOUT panel: how the reconstruction was made (the sources as authority), how to read the confidence badges, where
// the authorities differ and which reading the model follows, the amah, the clock, the controls, credits and licences.
// The choices listed are the research's locked decisions (report Part XI §57, Machloket Register §14) as built in
// src/data/site.js, and the service choices in docs/decisions; each names the reading it does not follow.
import { h } from './dom.js';
import { createPanel, section } from './panel.js';
import { sourcesEl } from './events.js';
import { controlsEl } from './controls.js';
import { AMAH_STANDARDS, AMAH_KEY } from '../core/units.js';
import { ZMAN_ANGLES } from '../time/zmanim.js';

/** the licence texts of the bundled code, as vite.config.js build.license emits them beside the page (no fonts) */
export const LICENSES_URL = 'third-party-licenses.md';
/** the typefaces' licence, from its publisher (the build's licence file lists only the bundled npm packages) */
export const OFL_URL = 'https://openfontlicense.org/open-font-license-official-text/';

/** where the model had to choose: [topic, the reading followed, its sources, the other reading, its sources] */
const CHOICES = [
  ['The Heichal', 'T-shaped: the Ulam front 100 amot wide, the House behind it 70, as the plain Mishnah reads (with the Raavad and Tosafot Yom Tov).', ['Middot 4:7'],
    'The Rambam: a full square, 100 by 100.', ['Rambam BhB 4:3–5']],
  ['Its walls', 'Solid, with the 38 ta\'im as cells along them in three storeys (Rashi\'s reading).', ['Middot 4:3'],
    'The Rambam: walls one within another with open spaces between them.', ['Rambam BhB 4:4–5']],
  ['Between the Kodesh and the Kodesh HaKodashim', 'Two curtains an amah apart.', ['Yoma 51b', 'Rambam BhB 4:2'],
    'R\' Yosi: a single curtain.', ['Yoma 51b']],
  ['The altar\'s place', 'Most of it south of the Temple\'s axis, the north kept clear for slaughter (R\' Eliezer ben Yaakov).', ['Yoma 16a–17a'],
    'R\' Yehudah: centred on the axis.', ['Yoma 16a', 'Zevachim 58b']],
  ['The six chambers of the Azarah', 'Lishkat HaGazit with its two neighbours on the north, the salt, hides and rinsers on the south.', ['Yoma 19a', 'Rambam BhB 5:17'],
    'The printed Mishnah reverses the sides; Chanukat HaBayit and Ezrat Kohanim hold to it. The question is genuinely open.', ['Middot 5:3–4']],
  ['The gates of the Azarah', 'Seven: three north, three south, Nikanor in the east.', ['Middot 1:4–5', 'Rambam BhB 5:4'],
    'Abba Yosi ben Chanan: thirteen.', ['Middot 2:6', 'Shekalim 6:3']],
  ['The Chel', 'A terrace ten amot wide inside the soreg, climbed by twelve steps.', ['Middot 2:3'],
    'A reading of the Rambam: a chel ten amot high, a low wall.', ['Rambam BhB 5:3']],
  ['The Menorah', 'Its lamps in a row from east to west, following the rite of Tamid (with the Raavad).', ['Tamid 3:9', 'Tamid 6:1'],
    'The Rambam: lamps in a row from north to south.', ['Rambam BhB 3:12']],
  ['The Ulam steps', 'Twelve steps of half an amah, with treads of an amah and landings between.', ['Middot 3:6'],
    'The Rambam: treads of half an amah, like every other stair.', ['Rambam BhB 6:4']],
  ['The kalya orev', 'A continuous iron blade an amah high, "like a sword", along the parapet of the roof.', ['Rambam BhB 4:3'],
    'Rashi: iron plates set with spikes.', ['Rashi on Shabbat 90a']],
  ['The rings for slaughter', 'Twenty-four, in six rows of four.', ['Middot 3:5'],
    'The other reading in the Mishnah: four rows of six.', ['Middot 3:5']],
  ['Friday night', 'No weekday fats or limbs are put on the fire once Shabbat begins; what was not burned in time is only raised to the altar top (the Ritva).', ['Rambam TuM 1:7', 'Kesef Mishneh on Rambam TuM 1:7', 'Yoma 46a'],
    'Rav Chisda: the end of the tamid\'s service does override Shabbat. The halachah follows Rava.', ['Yoma 46a']],
];

/** every citation this panel shows (the sources test checks that each one links) */
export const ABOUT_SOURCES = [...new Set(CHOICES.flatMap(([, , a, , b]) => [...a, ...b]).concat(['Pesachim 5:1', 'Kelim 1:6–9', 'Rambam BhB 7:12–22']))];

const CREDITS = [
  ['three.js', 'https://threejs.org/', 'MIT'],
  ['three-mesh-bvh', 'https://github.com/gkjohnson/three-mesh-bvh', 'MIT'],
  ['postprocessing', 'https://github.com/pmndrs/postprocessing', 'Zlib'],
  // as README: n8ao's package.json says ISC, the LICENSE file it ships is CC0 1.0
  ['N8AO', 'https://github.com/N8python/n8ao', 'ISC in its package metadata; the LICENSE file it ships is CC0 1.0'],
];
const FONTS = ['Cormorant Garamond', 'EB Garamond', 'Frank Ruhl Libre'];
/** where the typefaces come from at run time (src/ui/index.js loadFonts); null once they are self-hosted */
const FONTS_HOST = 'Google Fonts';

const ext = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

export function createAboutPanel(app) {
  const panel = createPanel(app, { name: 'about', title: 'About Mikdash', heTitle: 'על המקדש', side: 'modal', modal: true });
  panel.el.classList.add('mk-panel--about');
  const body = panel.body;
  const P = (...c) => h('p.mk-p', ...c);
  const sections = {};
  const sec = (id, title, ...children) => { sections[id] = section(title, ...children); sections[id].id = `mk-about-${id}`; return sections[id]; };

  const toc = h('nav.mk-toc', { 'aria-label': 'Sections' }, [
    ['method', 'Method'], ['badges', 'Badges'], ['choices', 'Where the sources differ'], ['amah', 'The amah'], ['controls', 'Controls'], ['credits', 'Credits'],
  ].map(([id, label]) => h('button.mk-chip2', { type: 'button', on: { click: () => go(id) } }, label)));

  const badge = (cls, text) => h('span', { class: `mk-badge ${cls}` }, text);
  const amahRows = Object.entries(AMAH_STANDARDS).map(([k, v]) => h('li', k === AMAH_KEY ? h('b', v.label) : v.label,
    ` — Har HaBayit's 500 amot ≈ ${Math.round(500 * v.meters)} m${k === AMAH_KEY ? ' (in use)' : ''}`));

  body.append(
    h('p.mk-p.mk-about__lead', 'The Second Temple in its final, Herodian form, the building Mishnah Middot measures, with its daily service as Mishnah Tamid and the Rambam set it out, hour by hour.'),
    toc,
    sec('method', 'How it was made',
      P('Only traditional Jewish sources are authorities here: Tanakh; the Mishnah (Middot, Tamid, Yoma, Shekalim, Kelim, Zevachim, Menachot and more) and the Talmud; the Rambam\'s Mishneh Torah (Hilchot Beit HaBechirah, Klei HaMikdash, Temidin uMusafin, Ma\'aseh HaKorbanot); the classic commentators (Rashi, the Raavad, Bartenura, Tosafot Yom Tov, the Kesef Mishneh); and Ezrat Kohanim for the placement of the courts on the Mount. No non-traditional or Christian reconstruction is used, and no modern drawing is taken as evidence.'),
      P('Every dimension is built from named numbers with their sources and checked against the Mishnah\'s own sums: the 500 amot of the Mount, the 187 by 135 of the Azarah, the 100 of the Heichal. Where the sources are silent (the footprint of some chambers, faces, the melodies of the Levites\' song, the minutes of the clock) the model fills in modestly and says so. Every place and event lists its sources, linked to the texts on Sefaria.')),
    sec('badges', 'Reading the badges',
      h('dl.mk-defs',
        h('dt', badge('mk-badge--gold', 'Time sourced')), h('dd', 'The sources fix when it happens: the afternoon tamid is slaughtered at eight and a half hours.', sourcesEl(['Pesachim 5:1'])),
        h('dt', badge('', 'Order sourced · minutes reconstructed')), h('dd', 'The sources give its place in the order of the service; its clock minutes are fitted to the day\'s hours.'),
        h('dt', badge('mk-badge--recon', 'Time reconstructed')), h('dd', 'The sources do not say when; the time is the model\'s estimate.')),
      P('Time is told in seasonal hours (sha\'ot zmaniyot): daylight, from sunrise to sunset, is twelve equal hours and the night twelve more, the Vilna Gaon\'s reckoning. ',
        `Dawn is taken with the sun ${Math.abs(ZMAN_ANGLES.alot)}° below the horizon and nightfall at ${Math.abs(ZMAN_ANGLES.tzeit)}°; clock times are Israel Standard Time for Jerusalem and always carry ≈, because the Mishnah counts hours, not minutes.`),
      P('Places sit on the ladder of the ten sanctities, each within the last. You may walk anywhere as an observer; the app tells you when you cross a line an Israelite could not.', sourcesEl(['Kelim 1:6–9', 'Rambam BhB 7:12–22']))),
    sec('choices', 'Where the sources differ',
      P('Where the authorities disagree, the model follows one reading, chosen in the research\'s locked decisions. The other reading stays legitimate.'),
      h('div.mk-choices', CHOICES.map(([topic, chosen, a, other, b]) => h('div.mk-choice',
        h('h4.mk-choice__t', topic),
        h('p.mk-choice__p', h('span.mk-choice__k', 'Shown'), chosen), sourcesEl(a),
        h('p.mk-choice__p.mk-choice__alt', h('span.mk-choice__k', 'Or'), other), sourcesEl(b))))),
    sec('amah', 'The amah',
      P('Every measure is in amot; the building amah is six tefachim. The sources give no metric length, so three accepted standards are offered (Settings → Length of the amah):'),
      h('ul.mk-list', amahRows)),
    sec('controls', 'Controls', controlsEl()),
    sec('credits', 'Credits & licences',
      P('Built with ', CREDITS.flatMap(([name, href, lic], i) => [i ? (i === CREDITS.length - 1 ? ' and ' : ', ') : '', ext(href, name), ` (${lic})`]), '.'),
      // FONTS_HOST: until the faces are self-hosted (qa-r1 UI-10) the page fetches them from Google Fonts: say so
      P(`Typefaces: ${FONTS.join(', ')}, under the `, ext(OFL_URL, 'SIL Open Font License 1.1'), FONTS_HOST ? `, served by ${FONTS_HOST}` : '', '.'),
      P('Everything else, from the stone, gold and cedar to the people, animals, sky and sounds, is generated in your browser from code: no textures, models or recordings are downloaded. Texts open on ', ext('https://www.sefaria.org/', 'Sefaria'), '.'),
      P(h('a', { href: LICENSES_URL, target: '_blank', rel: 'noopener' }, 'The full licence texts'), ' of the bundled code above.')),
  );

  function go(id) {
    const s = sections[id];
    if (!s) return;
    s.scrollIntoView({ block: 'start', behavior: app.reducedMotion() ? 'auto' : 'smooth' });
    s.querySelector('h3')?.setAttribute('tabindex', '-1');
    s.querySelector('h3')?.focus({ preventScroll: true });
  }

  return {
    ...panel,
    onOpen(opts = {}) {
      if (opts.section) requestAnimationFrame(() => { body.scrollTop = 0; go(opts.section); });
      else body.scrollTop = 0;
    },
  };
}
