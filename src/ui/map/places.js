// Places list: a search box (combobox) over a grouped listbox of every zone. Typing filters (English, transliteration,
// Hebrew, id; apostrophes and niqqud ignored); ↑/↓ move the selection (the map follows), Enter goes there, Esc clears.
// Places with activity now are listed first under "Happening now", with a count badge; "soon" shows minutes.
import { h, he, setText } from '../dom.js';
import { GROUPS, searchKey } from './model.js';

let seq = 0;

/**
 * opts: { model, onSelect(id, {fly}), onGo(id), activity() -> { byZone: Map(id -> events[]), soon: Map(id -> min) } }
 */
export function createPlaces(opts) {
  const { model } = opts;
  const uid = `mk-pl${++seq}`;
  const input = h('input.mk-mapl__search', {
    type: 'search', placeholder: 'Find a place…', autocomplete: 'off', spellcheck: false, enterkeyhint: 'go',
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'true', 'aria-controls': `${uid}-list`,
    'aria-label': 'Find a place. Arrow keys choose, Enter goes there.',
  });
  const count = h('div.mk-mapl__count.sr-only', { 'aria-live': 'polite' });
  const list = h('div.mk-mapl__list', { id: `${uid}-list`, role: 'listbox', 'aria-label': 'Places', 'data-scroll': '' });
  const el = h('aside.mk-mapl', { 'aria-label': 'Places' },
    h('div.mk-mapl__head', h('label.mk-mapl__field', input, h('span.mk-kbd.mk-mapl__slash', { 'aria-hidden': 'true', title: 'Press / to search' }, '/'))),
    list, count);

  let selected = null;
  let options = []; // visible option elements, in order
  let actKey = '', nowIds = '';
  const rows = new Map(); // `${section}:${id}` -> { el, id, badge }

  function optionEl(id, section) {
    const z = model.get(id);
    const n = model.nameOf(z);
    const badge = h('span.mk-mapl__badge');
    const el = h('div.mk-mapl__opt', { role: 'option', id: `${uid}-${section}-${id}`, 'data-id': id, 'aria-selected': 'false' },
      h('span.mk-mapl__names', h('span.mk-mapl__en', n.short), n.he ? he(n.he, 'mk-mapl__he') : null),
      z.stacked ? h('span.mk-mapl__lvl', { 'data-level': z.level }, z.level) : null,
      badge);
    el.addEventListener('click', () => { select(id, true); });
    el.addEventListener('dblclick', () => { select(id, true); opts.onGo(id); });
    rows.set(`${section}:${id}`, { el, id, badge });
    return el;
  }

  function render() {
    const q = searchKey(input.value);
    const act = opts.activity();
    rows.clear();
    const frag = [];
    const match = (id) => !q || model.nameOf(model.get(id)).key.includes(q);
    // happening now (only while not filtering: then the groups show everything once)
    if (!q && act.byZone.size) {
      const ids = [...act.byZone.keys()].filter((id) => model.get(id))
        .sort((a, b) => (Math.max(...act.byZone.get(b).map((e) => e.importance || 1)) - Math.max(...act.byZone.get(a).map((e) => e.importance || 1)))
          || act.byZone.get(b).length - act.byZone.get(a).length);
      if (ids.length) {
        const hid = `${uid}-g-now`;
        frag.push(h('div.mk-mapl__group.is-now', { role: 'group', 'aria-labelledby': hid },
          h('div.mk-mapl__gh', { id: hid, role: 'presentation' }, h('i.mk-mapl__pulse', { 'aria-hidden': 'true' }), 'Happening now'),
          ids.map((id) => optionEl(id, 'now'))));
      }
    }
    for (const G of GROUPS) {
      const ids = model.list.filter((z) => z.group === G.id).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((z) => z.id).filter(match);
      if (!ids.length) continue;
      const hid = `${uid}-g-${G.id}`;
      frag.push(h('div.mk-mapl__group', { role: 'group', 'aria-labelledby': hid },
        h('div.mk-mapl__gh', { id: hid, role: 'presentation' }, G.label), ids.map((id) => optionEl(id, G.id))));
    }
    if (!frag.length) frag.push(h('div.mk-mapl__none', 'No place by that name.'));
    list.replaceChildren(...frag);
    options = [...list.querySelectorAll('[role=option]')];
    setText(count, q ? `${options.length} place${options.length === 1 ? '' : 's'} found` : '');
    paintActivity(true);
    mark();
  }

  function paintActivity(force = false) {
    const act = opts.activity();
    const key = `${[...act.byZone].map(([id, evs]) => `${id}${evs.length}`).join()}|${[...act.soon].map(([id, m]) => `${id}${Math.round(m)}`).join()}`;
    if (!force && key === actKey) return;
    actKey = key;
    const ids = [...act.byZone.keys()].sort().join();
    if (!force && ids !== nowIds && !input.value) { render(); return; } // the "Happening now" group changed
    nowIds = ids;
    for (const r of rows.values()) {
      const evs = act.byZone.get(r.id);
      const soon = act.soon.get(r.id);
      r.el.classList.toggle('is-active', !!evs);
      r.el.classList.toggle('is-soon', !evs && soon != null);
      if (evs) {
        setText(r.badge, String(evs.length));
        r.badge.title = `${evs.length} ${evs.length === 1 ? 'activity' : 'activities'} now`;
        r.badge.className = 'mk-mapl__badge is-now';
      } else if (soon != null) {
        setText(r.badge, `${Math.max(1, Math.round(soon))} min`);
        r.badge.title = `Starts in about ${Math.max(1, Math.round(soon))} minutes`;
        r.badge.className = 'mk-mapl__badge is-soon';
      } else {
        setText(r.badge, '');
        r.badge.className = 'mk-mapl__badge';
      }
      const n = model.nameOf(model.get(r.id));
      r.el.setAttribute('aria-label', `${n.short}${n.he ? ` (${n.he})` : ''}${model.get(r.id).stacked ? `, ${model.get(r.id).level} level` : ''}${evs ? `, ${evs.length} ${evs.length === 1 ? 'activity' : 'activities'} now` : soon != null ? `, activity in ${Math.max(1, Math.round(soon))} minutes` : ''}`);
    }
  }

  /** highlight the selected place (first matching option; the "now" copy wins when it is listed) */
  function mark(scroll = false) {
    let cur = null;
    for (const o of options) {
      const on = o.dataset.id === selected && !cur;
      if (on) cur = o;
      o.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    if (cur) {
      input.setAttribute('aria-activedescendant', cur.id);
      if (scroll) cur.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function select(id, fly) {
    selected = id;
    mark(true);
    opts.onSelect(id, { fly });
  }

  function move(d) {
    if (!options.length) return;
    let i = options.findIndex((o) => o.getAttribute('aria-selected') === 'true');
    i = i < 0 ? (d > 0 ? 0 : options.length - 1) : Math.max(0, Math.min(options.length - 1, i + d));
    select(options[i].dataset.id, true);
  }

  input.addEventListener('input', () => {
    render();
    // the first match becomes the selection, so Enter goes to it
    if (input.value && options.length && !options.some((o) => o.dataset.id === selected)) select(options[0].dataset.id, true);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); move(8); }
    else if (e.key === 'PageUp') { e.preventDefault(); move(-8); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (!selected && options.length) select(options[0].dataset.id, true);
      if (selected) opts.onGo(selected);
    }
  });

  return {
    el, input,
    render,
    update() { paintActivity(false); },
    setSelected(id) { selected = id; mark(true); },
    /** Esc in the search box clears it first */
    clear() { if (!input.value) return false; input.value = ''; render(); return true; },
    focus() { input.focus({ preventScroll: true }); input.select(); },
  };
}
