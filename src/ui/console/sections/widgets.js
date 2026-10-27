// Setting controls shared by Settings and Listen (moved from the old settings panel): a labelled row, a segmented
// choice, a switch and a range. Each row carries data-setting so search can open Settings at that control.
import { h, setText } from '../../dom.js';

export function createWidgets(app) {
  const S = app.ctx.settings;
  const switches = new Map(), segs = new Map(), ranges = new Map();
  app.ctx.bus.on('settings:change', (e) => {
    const b = switches.get(e?.key);
    if (b) b.setAttribute('aria-checked', S.get(e.key) ? 'true' : 'false');
    const g = segs.get(e?.key);
    if (g) for (const x of g.children) x.setAttribute('aria-pressed', String(x.dataset.v) === String(S.get(e.key)) ? 'true' : 'false');
    const r = ranges.get(e?.key);
    if (r && +r.input.value !== S.get(e.key)) { r.input.value = S.get(e.key); r.paint(); }
  });
  const row = (key, label, help, ctl, wide = false) => h(`div.mk-set${wide ? '.mk-set--wide' : ''}`, { 'data-setting': key || null },
    h('span.mk-set__label', label), h('div.mk-set__ctl', ctl), help ? h('div.mk-set__help', help) : null);
  function seg(key, label, options, { onPick, current } = {}) {
    const cur = current ?? S.get(key);
    const g = h('div.mk-seg', { role: 'group', 'aria-label': label }, options.map(([v, l, title]) => h('button', {
      type: 'button', 'data-v': String(v), 'aria-pressed': String(v) === String(cur) ? 'true' : 'false', title: title || '',
      on: { click: (e) => { for (const b of g.children) b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'); (onPick || ((x) => S.set(key, x)))(v); } },
    }, l)));
    if (!onPick) segs.set(key, g);
    return g;
  }
  function toggle(key, label) {
    const b = h('button.mk-switch', { type: 'button', role: 'switch', 'aria-label': label, 'aria-checked': S.get(key) ? 'true' : 'false' });
    b.addEventListener('click', () => S.set(key, !S.get(key)));
    switches.set(key, b);
    return b;
  }
  function range(key, label, { min, max, step, fmt }) {
    const val = h('span.mk-range__val');
    const r = h('input.mk-range', { type: 'range', min, max, step, 'aria-label': label });
    r.value = S.get(key);
    const paint = () => { r.style.setProperty('--p', `${((r.value - min) / (max - min)) * 100}%`); setText(val, fmt(+r.value)); };
    r.addEventListener('input', () => { S.set(key, +r.value); paint(); });
    paint();
    ranges.set(key, { input: r, paint });
    return [r, val];
  }
  /** a module setting (def from ctx.settings.define) as a row */
  function moduleRow(key, def) {
    const label = app.modules.t(def.label) || key;
    if (def.type === 'bool') return row(key, label, null, toggle(key, label));
    if (def.type === 'number') return row(key, label, null, range(key, label, { min: def.min ?? 0, max: def.max ?? 1, step: def.step ?? 0.01, fmt: (v) => String(Math.round(v * 100) / 100) }));
    const vals = def.type === 'select' ? def.values.map(([v, l]) => [v, app.modules.t(l)]) : (def.values || []).map((v) => [v, String(v)]);
    return row(key, label, null, seg(key, label, vals), true);
  }
  return { row, seg, toggle, range, moduleRow };
}
