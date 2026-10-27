// ❡ Learn (console §3.5): the codex. Places · Rites & events (today; the other day types read-only) · People (roles) ·
// Things · Offerings · Words (the glossary, A–Z and א–ת) · How to read (the badges, the ladder of sanctity, a link to
// the hours) · Method · Where the sources differ · The amah · Credits & licences. Every entry opens its card.
// The method, the choices, the amah and the credits moved here from the old About panel; the choices are the
// research's locked decisions (report Part XI §57, Machloket Register §14) as built in src/data/site.js, and the
// service choices in docs/decisions; each names the reading it does not follow.
import { h, he } from '../../dom.js';
import { ico } from '../icons.js';
import { sourcesEl } from '../card.js';
import { AMAH_STANDARDS, AMAH_KEY } from '../../../core/units.js';
import { LADDER, LADDER_SOURCES } from '../../data.js';
import { GROUPS } from '../../map/model.js';
import { ROLE_NAMES } from '../describe.js';
import { clock } from '../../format.js';

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

/** every citation Learn shows outside the cards (the sources test checks that each one links) */
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
const PICKABLE = new Set(['fixture', 'gate', 'chamber', 'curtain', 'stair', 'ramp', 'opening']);

export const LEARN_SECTIONS = [
  ['places', 'Places', 'place', ['zones', 'courts', 'chambers', 'gates']],
  ['rites', 'Rites & events', 'event', ['service', 'schedule', 'order of the day']],
  ['people', 'People', 'role', ['roles', 'kohanim', 'levites', 'who']],
  ['things', 'Things', 'object', ['objects', 'vessels', 'gates', 'elements']],
  ['offerings', 'Offerings', 'offering', ['korbanot', 'sacrifices', 'olah', 'chatat']],
  ['words', 'Words', 'word', ['glossary', 'terms', 'dictionary', 'hebrew']],
  ['how', 'How to read', 'help', ['badges', 'confidence', 'sanctity', 'ladder', 'rungs']],
  ['method', 'Method', 'learn', ['sources', 'how it was made', 'reconstruction']],
  ['choices', 'Where the sources differ', 'learn', ['machloket', 'disputes', 'readings', 'choices']],
  ['amah', 'The amah', 'learn', ['cubit', 'measure', 'length', 'chazon ish', 'naeh', 'feinstein']],
  ['credits', 'Credits & licences', 'learn', ['credits', 'licences', 'licenses', 'fonts', 'three.js']],
];

const ext = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
const P = (...c) => h('p.mk-p', ...c);
const badge = (cls, text) => h('span', { class: `mk-badge ${cls}` }, text);

export function learnSection(app) {
  const { ctx, data } = app;
  app.learnDocs = () => LEARN_SECTIONS.map(([id, title, , kw]) => ({ id: `learn:${id}`, kind: 'learn', title: { en: title }, keywords: kw, subtitle: { en: 'Learn' } }));
  return {
    id: 'learn',
    title: { en: 'Learn', he: 'לימוד' },
    section: {
      id: 'learn', label: { en: 'Learn', he: 'לימוד' }, icon: 'learn', order: 50, fullDetent: true,
      mount(el) {
        let cur = null;
        const index = h('div.mk-learn__index', LEARN_SECTIONS.map(([id, title, icon]) => h('button.mk-learn__item', { type: 'button', 'data-learn': id, on: { click: () => go(id) } }, ico(icon), h('span', title), ' ›')));
        const page = h('div.mk-learn__page', { hidden: true });
        el.append(h('p.mk-p.mk-learn__lead', 'The Second Temple in its final, Herodian form, the building Mishnah Middot measures, with its daily service as Mishnah Tamid and the Rambam set it out, hour by hour.'), index, page);

        const list = (items) => h('div.mk-learn__list', items);
        const entry = (ref, title, heT, sub) => h('button.mk-learn__entry', { type: 'button', on: { click: () => app.card(ref) } },
          heT ? he(heT, 'mk-learn__he') : null, h('span.mk-learn__en', title), sub ? h('span.mk-learn__sub', sub) : null);

        const builders = {
          places() {
            const model = app.mapModel();
            return GROUPS.map((g) => h('section.mk-sec', h('h3.mk-h', g.label), list(model.list.filter((z) => z.group === g.id).sort((a, b) => a.order - b.order).map((z) => {
              const n = data.zone(z.id)?.name || {};
              return entry(`zone:${z.id}`, (n.en || z.id).split(' — ')[0], n.he?.split(' — ')[0]);
            }))));
          },
          rites() {
            const evs = data.events().filter((e) => data.dayOk(e) && data.layerOk(e)).map((e) => ({ e, r: data.times(e) })).sort((a, b) => (a.r?.t0 ?? 9999) - (b.r?.t0 ?? 9999));
            const out = [h('section.mk-sec', h('h3.mk-h', `Today · ${evs.length}`), list(evs.map(({ e, r }) => entry(`event:${e.id}`, e.title?.en || e.id, e.title?.he, r ? `≈ ${clock(r.t0)}` : ''))))];
            const ef = app.content.eventsFor;
            if (ef) {
              const today = ctx.time?.dayType;
              for (const [dt, label] of [['weekday', 'On a weekday'], ['friday', 'On Erev Shabbat'], ['shabbat', 'On Shabbat']]) {
                if (dt === today) continue;
                let l = [];
                try { l = ef(dt) || []; } catch { l = []; }
                const ids = new Set(evs.map(({ e }) => e.id));
                const only = l.filter((e) => !ids.has(e.id) && (!e.dayTypes || !e.dayTypes.includes('occasional')));
                if (!only.length) continue;
                out.push(h('section.mk-sec', h('h3.mk-h', `${label}, not today · ${only.length}`),
                  h('ul.mk-list.mk-learn__ro', only.map((e) => h('li', h('b', e.title?.en || e.id), e.title?.he ? [' ', he(e.title.he)] : null, e.summary ? h('span.mk-learn__sub', e.summary) : null)))));
              }
            }
            return out;
          },
          people() {
            const ids = Object.keys(app.content.rolesInfo || ROLE_NAMES);
            return [list(ids.map((id) => { const c = app.describe(`role:${id}`); return entry(`role:${id}`, c?.title?.en || ROLE_NAMES[id]?.[0] || id, c?.title?.he); }))];
          },
          things() {
            const O = app.content.objects;
            const els = Object.values(ctx.site?.elements || {}).filter((e) => (O ? O[e.id] : PICKABLE.has(e.kind)) && e.name?.en);
            const byKind = new Map();
            for (const e of els) { if (!byKind.has(e.kind)) byKind.set(e.kind, []); byKind.get(e.kind).push(e); }
            const KL = { fixture: 'Vessels and fixtures', gate: 'Gates', chamber: 'Chambers', curtain: 'Curtains', stair: 'Stairs', ramp: 'Ramps', opening: 'Openings' };
            return [...byKind.entries()].map(([k, l]) => h('section.mk-sec', h('h3.mk-h', `${KL[k] || k} · ${l.length}`),
              list(l.sort((a, b) => a.name.en.localeCompare(b.name.en)).map((e) => entry(`el:${e.id}`, e.name.en, e.name.he)))));
          },
          offerings() {
            const O = app.content.offerings || {};
            return [list(Object.values(O).map((o) => entry(`offering:${o.id}`, o.names?.en || o.id, o.names?.he, o.category)))];
          },
          words() {
            const G = app.content.glossary || {};
            let by = 'en';
            const box = h('div');
            const seg = h('div.mk-seg', { role: 'group', 'aria-label': 'Order' },
              h('button', { type: 'button', 'aria-pressed': 'true', on: { click: (e) => { by = 'en'; mark(e); fill(); } } }, 'A–Z'),
              h('button', { type: 'button', 'aria-pressed': 'false', on: { click: (e) => { by = 'he'; mark(e); fill(); } } }, 'א–ת'));
            const mark = (e) => { for (const b of seg.children) b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'); };
            const fill = () => {
              const keys = Object.keys(G).sort((a, b) => (by === 'he' ? String(G[a].he).localeCompare(String(G[b].he), 'he') : String(G[a].translit || a).localeCompare(String(G[b].translit || b), 'en', { sensitivity: 'base' })));
              box.replaceChildren(list(keys.map((k) => entry(`term:${k}`, G[k].translit || k, G[k].he, G[k].en.split(/[.:;]/)[0]))));
            };
            fill();
            return [h('p.mk-p.mk-muted', `${Object.keys(G).length} terms, each with its sources.`), seg, box];
          },
          how() {
            return [
              h('section.mk-sec', h('h3.mk-h', 'The badges'),
                h('dl.mk-defs',
                  h('dt', badge('mk-badge--gold', 'Time sourced')), h('dd', 'The sources fix when it happens: the afternoon tamid is slaughtered at eight and a half hours.', sourcesEl(['Pesachim 5:1'])),
                  h('dt', badge('', 'Order sourced · minutes reconstructed')), h('dd', 'The sources give its place in the order of the service; its clock minutes are fitted to the day\'s hours.'),
                  h('dt', badge('mk-badge--recon', 'Time reconstructed')), h('dd', 'The sources do not say when; the time is the model\'s estimate.'),
                  h('dt', badge('mk-badge--gold', 'Sourced')), h('dd', 'A place, thing or measure the sources give.'),
                  h('dt', badge('mk-badge--recon', 'Reconstruction')), h('dd', 'Where the sources are silent the model fills in modestly, and says so.'))),
              h('section.mk-sec', h('h3.mk-h', 'The ladder of sanctity'),
                P('Places sit on the ladder of the ten sanctities, each within the last. You may walk anywhere as an observer; the place you enter is named as you arrive, and a line an Israelite could not cross is marked in red-gold.'),
                h('ol.mk-ladderlist', LADDER.map((L, i) => h('li', h('span.mk-rungs', { 'aria-hidden': 'true' }, LADDER.map((_, j) => h(`i${j === i ? '.cur' : j < i ? '.on' : ''}`, { style: { height: `${3 + j}px` } }))),
                  h('b', L.en), ' ', he(L.he), h('span.mk-learn__sub', `${L.rule}${L.src ? ` (${L.src})` : ''}`)))),
                sourcesEl(LADDER_SOURCES)),
              h('section.mk-sec', h('h3.mk-h', 'The hours'),
                P('Time is told in seasonal hours (sha\'ot zmaniyot); clock times carry ≈ because the Mishnah counts hours, not minutes. ',
                  h('button.mk-linkbtn', { type: 'button', on: { click: () => { app.open('time', { from: 'nav' }); requestAnimationFrame(() => { const d = document.querySelector('.mk-explain'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }); } } }, 'How the hours are counted ›'))),
            ];
          },
          method() {
            return [
              P('Only traditional Jewish sources are authorities here: Tanakh; the Mishnah (Middot, Tamid, Yoma, Shekalim, Kelim, Zevachim, Menachot and more) and the Talmud; the Rambam\'s Mishneh Torah (Hilchot Beit HaBechirah, Klei HaMikdash, Temidin uMusafin, Ma\'aseh HaKorbanot); the classic commentators (Rashi, the Raavad, Bartenura, Tosafot Yom Tov, the Kesef Mishneh); and Ezrat Kohanim for the placement of the courts on the Mount. No non-traditional or Christian reconstruction is used, and no modern drawing is taken as evidence.'),
              P('Every dimension is built from named numbers with their sources and checked against the Mishnah\'s own sums: the 500 amot of the Mount, the 187 by 135 of the Azarah, the 100 of the Heichal. Where the sources are silent (the footprint of some chambers, faces, the melodies of the Levites\' song, the minutes of the clock) the model fills in modestly and says so. Every place and event lists its sources, linked to the texts on Sefaria.'),
              P('People are never invented individuals: a figure is a role ("a kohen of the morning crew"), and a card shows only what the sources say of that role and that rite.'),
            ];
          },
          choices() {
            return [
              P('Where the authorities disagree, the model follows one reading, chosen in the research\'s locked decisions. The other reading stays legitimate.'),
              h('div.mk-choices', CHOICES.map(([topic, chosen, a, other, b]) => h('div.mk-choice',
                h('h4.mk-choice__t', topic),
                h('p.mk-choice__p', h('span.mk-choice__k', 'Shown'), chosen), sourcesEl(a),
                h('p.mk-choice__p.mk-choice__alt', h('span.mk-choice__k', 'Or'), other), sourcesEl(b)))),
            ];
          },
          amah() {
            return [
              P('Every measure is in amot; the building amah is six tefachim. The sources give no metric length, so three accepted standards are offered (Settings → Measure):'),
              h('ul.mk-list', Object.entries(AMAH_STANDARDS).map(([k, v]) => h('li', k === AMAH_KEY ? h('b', v.label) : v.label,
                ` — Har HaBayit's 500 amot ≈ ${Math.round(500 * v.meters)} m${k === AMAH_KEY ? ' (in use)' : ''}`))),
            ];
          },
          credits() {
            return [
              P('Built with ', CREDITS.flatMap(([name, href, lic], i) => [i ? (i === CREDITS.length - 1 ? ' and ' : ', ') : '', ext(href, name), ` (${lic})`]), '.'),
              // FONTS_HOST: until the faces are self-hosted (qa-r1 UI-10) the page fetches them from Google Fonts: say so
              P(`Typefaces: ${FONTS.join(', ')}, under the `, ext(OFL_URL, 'SIL Open Font License 1.1'), FONTS_HOST ? `, served by ${FONTS_HOST}` : '', '.'),
              P('Everything else, from the stone, gold and cedar to the people, animals, sky and sounds, is generated in your browser from code: no textures, models or recordings are downloaded. Texts open on ', ext('https://www.sefaria.org/', 'Sefaria'), '.'),
              P(h('a', { href: LICENSES_URL, target: '_blank', rel: 'noopener' }, 'The full licence texts'), ' of the bundled code above.'),
            ];
          },
        };

        async function go(id, { focus = true } = {}) {
          const meta = LEARN_SECTIONS.find(([k]) => k === id);
          if (!meta) { home(); return; }
          cur = id;
          index.hidden = true;
          page.hidden = false;
          const title = h('h3.mk-learn__title', { tabindex: '-1', id: `mk-learn-${id}` }, ico(meta[2]), meta[1]);
          page.replaceChildren(h('button.mk-hbtn.mk-learn__back', { type: 'button', on: { click: () => home(true) } }, ico('prev'), h('span', 'Learn')), title, h('div.mk-learn__body', h('p.mk-muted', 'Loading…')));
          if (['people', 'offerings', 'words', 'rites', 'things'].includes(id)) await app.content.load();
          if (cur !== id) return;
          let parts = [];
          try { parts = builders[id](); } catch (e) { console.error('[ui] learn', id, e); parts = [h('p.mk-empty', 'This part could not be shown.')]; }
          page.querySelector('.mk-learn__body').replaceChildren(...parts);
          el.scrollTop = 0;
          if (focus) title.focus({ preventScroll: true });
        }
        function home(focus = false) {
          cur = null;
          page.hidden = true;
          page.replaceChildren();
          index.hidden = false;
          if (focus) index.querySelector('button')?.focus({ preventScroll: true });
        }
        return {
          show(opts = {}) { if (opts.section) go(opts.section, { focus: opts.focus !== false }); },
          hide() {},
          onEscape() { if (cur) { home(true); return true; } return false; },
          focusTarget: () => (cur ? page.querySelector('.mk-learn__title') : index.querySelector('button')),
          get current() { return cur; },
        };
      },
    },
  };
}
