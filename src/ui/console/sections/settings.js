// ⚙ Settings (console §3.5). Travel: the default way and pace. Look & move: look mode, sensitivity, invert, field of
// view, head bob. Display: quick chips, area names, restricted-area notices, activity markers, the aggadah layer,
// reduce motion. Graphics: quality (reloads). Measure: the amah (reloads). Sound and subtitles live in Listen.
// Quality and the amah shape the world at build time: the page reloads where you stand, at the same time and date,
// and the Menu reopens here.
import { h } from '../../dom.js';
import { ico } from '../icons.js';
import { AMAH_STANDARDS, AMAH_KEY } from '../../../core/units.js';
import { TIERS } from '../../../core/quality.js';
import { reloadHere } from '../../../core/resume.js';
import { createWidgets } from './widgets.js';
import { PACES } from '../../settings.js';

const PACE_LABEL = { 0.5: '½×', 1: '1×', 2: '2×', 5: '5×', 10: '10×' };
/** which section holds a setting (search → "Settings at that control") */
export const LISTEN_KEYS = new Set(['volume', 'captions', 'musicStyle']);

export function settingsSection(app) {
  const { ctx } = app;
  const S = ctx.settings;
  const LABELS = {
    travelWay: ['Way to travel', ['travel', 'go', 'walk', 'run', 'instant', 'default']],
    travelPace: ['Pace', ['travel', 'speed', 'faster', 'slower', 'pace']],
    lookMode: ['Look mode', ['mouse', 'pointer lock', 'drag', 'look', 'camera', 'trackpad']],
    mouseSensitivity: ['Look sensitivity', ['mouse', 'sensitivity', 'look speed', 'touch']],
    invertY: ['Invert vertical look', ['invert', 'mouse', 'look', 'y axis']],
    fov: ['Field of view', ['fov', 'zoom', 'wide', 'angle', 'camera']],
    headBob: ['Head bob', ['bob', 'sway', 'motion', 'walking']],
    quickChips: ['Quick chips', ['chips', 'wake', 'menu', 'buttons']],
    areaNames: ['Area names', ['banner', 'names', 'places', 'entering', 'arrived']],
    restrictedNotices: ['Restricted-area notices', ['restricted', 'access', 'notice', 'kohanim', 'warning']],
    labels: ['Activity markers', ['markers', 'labels', 'tags', 'diamonds', 'activity']],
    aggadah: ['Aggadah layer', ['aggadah', 'miracles', 'traditions', 'legends']],
    reducedMotion: ['Reduce motion', ['motion', 'animation', 'accessibility', 'sickness']],
    quality: ['Graphics quality', ['quality', 'graphics', 'performance', 'gpu', 'low', 'high', 'ultra']],
    amah: ['Length of the amah', ['amah', 'cubit', 'measure', 'scale', 'naeh', 'chazon ish', 'feinstein']],
    volume: ['Volume', ['volume', 'sound', 'audio', 'loud']],
    captions: ['Subtitles', ['subtitles', 'captions', 'text', 'hearing']],
    musicStyle: ['Music', ['music', 'levites', 'song', 'instruments', 'shiltei hagiborim']],
  };
  const valueText = (k) => {
    const v = S.get(k);
    if (typeof v === 'boolean') return v ? 'On' : 'Off';
    if (k === 'volume') return `${Math.round(v * 100)}%`;
    if (k === 'travelPace') return PACE_LABEL[v] || `${v}×`;
    if (k === 'fov') return `${Math.round(v)}°`;
    if (k === 'mouseSensitivity') return `${(+v).toFixed(2)}×`;
    return String(v ?? '');
  };
  // search: every setting, with its current value
  app.settingDocs = () => [
    ...Object.entries(LABELS).map(([k, [t, kw]]) => ({ id: `setting:${k}`, kind: 'setting', title: { en: t }, keywords: kw, subtitle: { en: valueText(k) } })),
    ...Object.entries(S.defs).filter(([, d]) => d.module).map(([k, d]) => ({ id: `setting:${k}`, kind: 'setting', title: { en: app.modules.t(d.label) || k }, keywords: [], subtitle: { en: valueText(k) } })),
  ];
  /** an inline control for a search result row (switches only) */
  app.settingInline = (k) => {
    const d = S.defs[k];
    if (d?.type !== 'bool') return null;
    const b = h('button.mk-switch', { type: 'button', role: 'switch', 'aria-label': LABELS[k]?.[0] || k, 'aria-checked': S.get(k) ? 'true' : 'false' });
    b.addEventListener('click', (e) => { e.stopPropagation(); S.set(k, !S.get(k)); b.setAttribute('aria-checked', S.get(k) ? 'true' : 'false'); });
    return b;
  };
  /** open the section that holds a setting, at its control */
  app.openSetting = (k) => {
    const sec = LISTEN_KEYS.has(k) || (S.defs[k]?.module && (S.defs[k].group || 'listen') === 'listen') ? 'listen' : 'settings';
    app.open(sec, { from: 'nav', focus: false });
    requestAnimationFrame(() => {
      const row = document.querySelector(`.mk-menu [data-setting="${CSS.escape(k)}"]`);
      if (!row) return;
      row.scrollIntoView({ block: 'center', behavior: app.reducedMotion() ? 'auto' : 'smooth' });
      row.classList.add('is-focus');
      setTimeout(() => row.classList.remove('is-focus'), 1600);
      row.querySelector('button, input')?.focus({ preventScroll: true });
    });
  };

  return {
    id: 'settings',
    title: { en: 'Settings', he: 'הגדרות' },
    section: {
      id: 'settings', label: { en: 'Settings', he: 'הגדרות' }, icon: 'settings', order: 70, fullDetent: true,
      mount(el) {
        const w = createWidgets(app);
        const sec = (title, ...c) => h('section.mk-sec', h('h3.mk-h', title), ...c);
        function reload(key) {
          app.toast('Reloading…');
          try { sessionStorage.setItem('mikdash.resumeMenu', 'settings'); } catch { /* ignore */ }
          // the changed one is read from storage after the reload, so its URL parameter goes; the other stays (a shared
          // ?amah=chazonish link keeps its scale when the quality changes, a ?q= its tier when the amah does)
          reloadHere(ctx, { delay: 250, resume: true, edit: (q) => { q.delete(key === 'quality' ? 'q' : 'amah'); if (q.has('amah')) q.set('amah', AMAH_KEY); } });
        }
        const qNow = ctx.quality?.key;
        // a ?q= link overrides the stored choice (core/quality.js resolveTier): show what runs, and let any other pick apply
        const qUrl = new URLSearchParams(location.search).get('q');
        const qCur = TIERS[qUrl] ? qUrl : S.get('quality');
        const tierHelp = (k) => (k === 'auto' ? 'Chosen for this device' : TIERS[k]?.label || k);
        const qSeg = w.seg('quality', 'Quality', ['auto', 'low', 'medium', 'high', 'ultra'].map((k) => [k, k[0].toUpperCase() + k.slice(1), tierHelp(k)]), {
          current: qCur, onPick: (v) => { if (v === qCur) return; S.set('quality', v); reload('quality'); },
        });
        const amahSeg = w.seg('amah', 'Length of the amah', Object.entries(AMAH_STANDARDS).map(([k, v]) => [k, { naeh: 'R’ Chaim Naeh', feinstein: 'R’ Moshe Feinstein', chazonish: 'Chazon Ish' }[k], v.label]), {
          current: AMAH_KEY, onPick: (v) => { if (v === AMAH_KEY) return; S.set('amah', v); reload('amah'); },
        });
        const modBox = h('div');
        el.append(
          sec('Travel',
            w.row('travelWay', 'Way to travel', 'The default for every Go ▸ (each Go menu changes it too)', w.seg('travelWay', 'Way to travel', [['walk', 'Walk'], ['run', 'Run'], ['instant', 'Instant']]), true),
            w.row('travelPace', 'Pace', 'How fast a walk or run plays: the clock is not changed', w.seg('travelPace', 'Pace', PACES.map((p) => [p, PACE_LABEL[p]])), true)),
          sec('Look & move',
            w.row('lookMode', 'Look mode', 'Capture the mouse to look (click the view; Esc frees it), or drag to look', w.seg('lookMode', 'Look mode', [['lock', 'Capture the mouse'], ['drag', 'Drag to look']]), true),
            w.row('mouseSensitivity', 'Look sensitivity', 'Mouse and touch', w.range('mouseSensitivity', 'Look sensitivity', { min: 0.2, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(2)}×` })),
            w.row('invertY', 'Invert vertical look', null, w.toggle('invertY', 'Invert vertical look')),
            w.row('fov', 'Field of view', null, w.range('fov', 'Field of view', { min: 40, max: 95, step: 1, fmt: (v) => `${Math.round(v)}°` })),
            w.row('headBob', 'Head bob', 'A gentle sway while walking', w.toggle('headBob', 'Head bob'))),
          sec('Display',
            w.row('quickChips', 'Quick chips', 'The hour, Map, Search and Help beside the Menu button', w.seg('quickChips', 'Quick chips', [['wake', 'When you move'], ['always', 'Always']]), true),
            w.row('areaNames', 'Area names', 'The name of each place as you enter it', w.seg('areaNames', 'Area names', [['always', 'Always'], ['travel', 'When travelling'], ['off', 'Off']]), true),
            w.row('restrictedNotices', 'Restricted-area notices', 'When you cross a line an Israelite could not, with its rule and source', w.toggle('restrictedNotices', 'Restricted-area notices')),
            w.row('labels', 'Activity markers', 'Gold diamonds over what is happening near you', w.toggle('labels', 'Activity markers')),
            w.row('aggadah', 'Aggadah layer', 'Narrative and miracle traditions the sources report (Avot 5:5), shown subtly', w.toggle('aggadah', 'Aggadah layer')),
            w.row('reducedMotion', 'Reduce motion', 'Fewer animations; no head bob unless chosen', w.toggle('reducedMotion', 'Reduce motion'))),
          sec('Graphics', w.row('quality', 'Quality', `Now running: ${TIERS[qNow]?.label || qNow || '—'}. Changing it reloads the page where you stand.`, qSeg, true)),
          sec('Measure', w.row('amah', 'Length of the amah', `Every dimension is in amot; this sets the metric size of the whole site (now ${Math.round(AMAH_STANDARDS[AMAH_KEY].meters * 1000) / 10} cm). Reloads the page.`, amahSeg, true)),
          modBox,
          h('p.mk-p', h('button.mk-linkbtn', { type: 'button', on: { click: () => app.open('listen', { from: 'nav' }) } }, ico('listen'), ' Sound & subtitles are in Listen ›')),
          h('p.mk-sample', 'Settings are kept on this device.'),
        );
        // module settings, by their group (not 'listen')
        function syncMods() {
          const defs = Object.entries(S.defs).filter(([, d]) => d.module && (d.group || 'listen') !== 'listen');
          const by = new Map();
          for (const [k, d] of defs) { const g = d.group || 'Modules'; if (!by.has(g)) by.set(g, []); by.get(g).push(w.moduleRow(k, d)); }
          modBox.replaceChildren(...[...by.entries()].map(([g, rows]) => sec(g[0].toUpperCase() + g.slice(1), ...rows)));
        }
        app.modules.onChange(syncMods);
        syncMods();
        return { show() {}, hide() {}, focusTarget: () => el.querySelector('.mk-seg button') };
      },
    },
  };
}
