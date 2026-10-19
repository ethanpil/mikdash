// SETTINGS panel. Quality and the amah standard apply on reload (they shape the world at build time); the page
// reloads at the same place, time and date. Everything else applies live through bus 'settings:change'.
import { h, setText } from './dom.js';
import { createPanel, section } from './panel.js';
import { AMAH_STANDARDS, AMAH_KEY, w2m } from '../core/units.js';
import { TIERS } from '../core/quality.js';
import { SPEEDS } from './events.js';
import { clock } from './format.js';

export function createSettingsPanel(app) {
  const { ctx } = app;
  const S = ctx.settings;
  const panel = createPanel(app, { name: 'settings', title: 'Settings', heTitle: 'הגדרות', side: 'modal', modal: true });
  const body = panel.body;

  const row = (label, help, ctl, wide = false) => h(`div.mk-set${wide ? '.mk-set--wide' : ''}`,
    h('span.mk-set__label', label), h('div.mk-set__ctl', ctl), help ? h('div.mk-set__help', help) : null);

  function seg(key, label, options, { onPick, current } = {}) {
    const cur = current ?? S.get(key);
    const g = h('div.mk-seg', { role: 'group', 'aria-label': label }, options.map(([v, l, title]) => h('button', {
      type: 'button', 'aria-pressed': v === cur ? 'true' : 'false', title: title || '',
      on: { click: (e) => { for (const b of g.children) b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'); (onPick || ((x) => S.set(key, x)))(v); } },
    }, l)));
    return g;
  }
  const switches = new Map();
  function toggle(key, label) {
    const b = h('button.mk-switch', { type: 'button', role: 'switch', 'aria-label': label, 'aria-checked': S.get(key) ? 'true' : 'false' });
    b.addEventListener('click', () => S.set(key, !S.get(key)));
    switches.set(key, b);
    return b;
  }
  // keep switches in step with changes made elsewhere (e.g. head bob following reduced motion)
  ctx.bus.on('settings:change', () => { for (const [k, b] of switches) b.setAttribute('aria-checked', S.get(k) ? 'true' : 'false'); });
  function range(key, label, { min, max, step, fmt }) {
    const val = h('span.mk-range__val');
    const r = h('input.mk-range', { type: 'range', min, max, step, 'aria-label': label });
    r.value = S.get(key);
    const paint = () => { r.style.setProperty('--p', `${((r.value - min) / (max - min)) * 100}%`); setText(val, fmt(+r.value)); };
    r.addEventListener('input', () => { S.set(key, +r.value); paint(); });
    paint();
    return [r, val];
  }

  /** reload at the same place/time with the new build-time setting */
  function reload() {
    const u = new URL(location.href);
    for (const k of ['q', 'amah', 'pos', 'at', 'look', 't', 'date']) u.searchParams.delete(k);
    const eye = ctx.player?.eye;
    if (eye) { const s = w2m(eye); u.searchParams.set('pos', [s.X, s.Y, s.Z].map((n) => n.toFixed(2)).join(',')); }
    if (Number.isFinite(ctx.player?.heading)) u.searchParams.set('look', `${ctx.player.heading.toFixed(1)},${(ctx.player.pitch || 0).toFixed(1)}`);
    if (ctx.time?.t != null) u.searchParams.set('t', clock(ctx.time.t));
    if (ctx.time?.dateString) u.searchParams.set('date', ctx.time.dateString);
    try { sessionStorage.setItem('mikdash.resume', '1'); } catch { /* ignore */ }
    app.toast('Reloading…');
    setTimeout(() => location.replace(u.toString()), 250);
  }

  const qNow = ctx.quality?.key;
  const tierHelp = (k) => (k === 'auto' ? 'Chosen for this device' : TIERS[k]?.label || k);
  const qSeg = seg('quality', 'Quality', ['auto', 'low', 'medium', 'high', 'ultra'].map((k) => [k, k[0].toUpperCase() + k.slice(1), tierHelp(k)]), {
    onPick: (v) => { if (v === S.get('quality')) return; S.set('quality', v); reload(); },
  });
  const amahSeg = seg('amah', 'Length of the amah', Object.entries(AMAH_STANDARDS).map(([k, v]) => [k, { naeh: 'R’ Chaim Naeh', feinstein: 'R’ Moshe Feinstein', chazonish: 'Chazon Ish' }[k], v.label]), {
    current: AMAH_KEY,
    onPick: (v) => { if (v === AMAH_KEY) return; S.set('amah', v); reload(); },
  });

  body.append(
    section('Graphics',
      row('Quality', `Now running: ${TIERS[qNow]?.label || qNow || '—'}. Changing it reloads the page where you stand.`, qSeg, true)),
    section('Measure',
      row('Length of the amah', `Every dimension is in amot; this sets the metric size of the whole site (now ${Math.round(AMAH_STANDARDS[AMAH_KEY].meters * 1000) / 10} cm). Reloads the page.`, amahSeg, true)),
    section('Sound',
      row('Volume', null, range('volume', 'Volume', { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` })),
      row('Subtitles', 'Calls, cries and song, in English and Hebrew', toggle('captions', 'Subtitles')),
      row('Music', 'How the Levites’ song is voiced', seg('musicStyle', 'Music', [['mishnah', 'Mishnah', 'Voices with lyres, harps and the one cymbal (Arachin 2)'], ['sg1612', 'Shiltei HaGiborim', 'The 1612 reading of the instruments (a later, Renaissance lens)']]), true)),
    section('Controls',
      row('Look sensitivity', 'Mouse and touch', range('mouseSensitivity', 'Look sensitivity', { min: 0.2, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(2)}×` })),
      row('Invert vertical look', null, toggle('invertY', 'Invert vertical look')),
      row('Field of view', null, range('fov', 'Field of view', { min: 40, max: 95, step: 1, fmt: (v) => `${Math.round(v)}°` })),
      row('Head bob', 'A gentle sway while walking', toggle('headBob', 'Head bob')),
      row('Travel speed', 'Default for “Go” and map clicks', seg('travelSpeed', 'Travel speed', SPEEDS.map(([v, l]) => [v, l])), true)),
    section('Display',
      row('Floating labels', 'Tags over what is happening now', toggle('labels', 'Floating labels')),
      row('Aggadah layer', 'Narrative and miracle traditions the sources report (Avot 5:5), shown subtly', toggle('aggadah', 'Aggadah layer')),
      row('Reduce motion', 'Fewer animations; no head bob unless chosen', toggle('reducedMotion', 'Reduce motion'))),
    h('p.mk-sample', 'Settings are kept on this device.'),
  );

  return { ...panel };
}
