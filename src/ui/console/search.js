// Search (console §4.4): one field in the Menu header for everything — places, things, rites (live offerings too),
// offering types, roles, words, Learn, Help, settings and commands — in English, Hebrew or transliteration. The engine
// is src/search/ (docs/decisions/console-travel.md), a lazy chunk loaded after 'firstFrame' (or on the first query);
// the UI adds its own documents (settings, commands, Learn, Help) and the modules'. Results are grouped by kind with
// scope chips, and the best match first ("Top result", Enter's default); ↑↓ choose, Enter opens, Ctrl/⌘+Enter goes,
// Alt+Enter shows it, → reaches the row's buttons, Esc clears then goes back. Every input event queries (60 ms debounce),
// during an IME composition too: Android keyboards compose every Latin and Hebrew word until a space.
import { h, fill, he, setText } from '../dom.js';
import { ico } from './icons.js';
import { COMMANDS, sectionCommands } from './commands.js';
import { clock, wrap } from '../format.js';
import { parseRef } from './describe.js';
import { runShow } from './eventrow.js';
import { w2m } from '../../core/units.js';

const KINDS = {
  place: { label: 'Places', icon: 'place' },
  thing: { label: 'Things', icon: 'object' },
  rite: { label: 'Rites', icon: 'event' },
  offering: { label: 'Offerings', icon: 'offering' },
  role: { label: 'People', icon: 'role' },
  word: { label: 'Words', icon: 'word' },
  learn: { label: 'Learn', icon: 'learn' },
  help: { label: 'Help', icon: 'help' },
  setting: { label: 'Settings', icon: 'settings' },
  command: { label: 'Commands', icon: 'command' },
};
const ORDER = ['place', 'rite', 'thing', 'offering', 'role', 'word', 'setting', 'learn', 'help', 'command'];
const SCOPES = [['all', 'All', null], ['place', 'Places', ['place']], ['rite', 'Rites', ['rite', 'offering']], ['role', 'People', ['role']], ['thing', 'Things', ['thing']], ['word', 'Words', ['word']], ['setting', 'Settings', ['setting']]];
const TRY = ['מזבח', 'altar', 'Nikanor', 'tamid', 'subtitles'];
const PER_GROUP = 6;

// ---------------------------------------------------------------- the engine
/**
 * src/search/ (a lazy chunk), loaded in idle time after 'firstFrame' or on the first query. Sources added before it
 * loads are replayed into it. A query before it has loaded returns [] and starts the load; onReady(fn) re-runs it.
 */
export function createSearchEngine(app) {
  let real = null, loading = null;
  const recs = [];
  const ready = new Set();
  const eng = {
    get core() { return !!real; },
    add(src) {
      const rec = { src, off: null };
      recs.push(rec);
      if (real) { try { rec.off = real.add(src); } catch (e) { console.error('[ui] search add', e); } }
      return () => { try { rec.off?.(); } catch { /* ignore */ } recs.splice(recs.indexOf(rec), 1); };
    },
    addModule(def, m) {
      const s = def.search;
      return eng.add({ kind: s.kind, label: s.label, live: true, docs: () => app.modules.call(m, 'search.docs', s.docs, app.ctx) || [] });
    },
    query(q, opts) {
      if (!real) { eng.load(); return []; }
      try { return real.query(q, opts) || []; } catch (e) { console.error('[ui] search query', e); return []; }
    },
    load() {
      if (!loading) {
        loading = import('../../search/index.js').then((mod) => {
          real = mod.createSearch(app.ctx);
          for (const rec of recs) { try { rec.off = real.add(rec.src); } catch (e) { console.error('[ui] search add', e); } }
          for (const f of ready) { try { f(); } catch (e) { console.error('[ui] search ready', e); } }
        }).catch((e) => { loading = null; console.error('[ui] search engine failed to load', e); });
      }
      return loading;
    },
    /** fn() once the engine has loaded (the UI re-runs a query typed before it) */
    onReady(fn) { ready.add(fn); return () => ready.delete(fn); },
    normalize(q) { return real?.normalize?.(q) || null; },
  };
  return eng;
}

// ---------------------------------------------------------------- the UI's own documents
export function addUiSources(app, eng) {
  const { ctx } = app;
  // settings (live: the subtitle is the current value)
  eng.add({
    kind: 'setting', label: { en: 'Settings' }, live: true,
    docs: () => app.settingDocs?.() || [],
  });
  // commands (live: only those that apply now), with the modules'
  eng.add({
    kind: 'command', label: { en: 'Commands' }, live: true,
    docs: () => [...COMMANDS.filter((c) => !c.when || c.when(app)), ...sectionCommands(app), ...app.modules.commands()].map((c) => ({
      id: `cmd:${c.id}`, kind: 'command', title: c.title, keywords: c.keywords || [], subtitle: c.key ? { en: c.key } : undefined,
    })),
  });
  eng.add({ kind: 'learn', label: { en: 'Learn' }, docs: () => app.learnDocs?.() || [] });
  eng.add({ kind: 'help', label: { en: 'Help' }, docs: () => app.helpDocs?.() || [] });
  void ctx;
}

// ---------------------------------------------------------------- the UI
export function createSearchUI(app) {
  const { ctx } = app;
  const eng = app.searchEngine;
  const uid = `mk-s${Math.random().toString(36).slice(2, 7)}`;
  const input = h('input.mk-search__input', {
    type: 'search', placeholder: 'Search places, rites, people, things…', autocomplete: 'off', spellcheck: false, dir: 'auto', enterkeyhint: 'search',
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': `${uid}-list`, 'aria-label': 'Search places, rites, people, things, words and settings',
    'aria-keyshortcuts': '/ Control+K',
  });
  const capEl = h('span.mk-kbd.mk-search__cap', { 'aria-hidden': 'true', 'data-cap': 'search' });
  const clearBtn = h('button.mk-search__clear', { type: 'button', 'aria-label': 'Clear the search', hidden: true, on: { click: () => { setQuery(''); input.focus(); } } }, ico('close'));
  const field = h('label.mk-search', ico('search'), input, capEl, clearBtn);

  const scopes = h('div.mk-search__scopes', { role: 'group', 'aria-label': 'Show' });
  const count = h('div.sr-only', { 'aria-live': 'polite' });
  const list = h('div.mk-search__list', { id: `${uid}-list`, role: 'listbox', 'aria-label': 'Results' });
  const empty = h('div.mk-search__empty');
  const keys = h('p.mk-search__keys', '↑↓ choose · Enter open · Ctrl+Enter Go · Alt+Enter Show me · → its buttons · Esc clear');
  const view = h('div.mk-searchview', scopes, list, empty, keys, count);

  let scope = 'all', results = [], active = -1, composing = false, debounceT = 0, expanded = new Set(), lastQ = '', base = null;
  const rows = []; // { el, doc }

  // ---------------- recent ----------------
  const recent = () => { try { return JSON.parse(localStorage.getItem('mikdash.recent') || '[]'); } catch { return []; } };
  const remember = (doc) => {
    try {
      const l = recent().filter((r) => r.id !== doc.id);
      l.unshift({ id: doc.id, kind: doc.kind, title: doc.title });
      localStorage.setItem('mikdash.recent', JSON.stringify(l.slice(0, 8)));
    } catch { /* ignore */ }
  };

  // ---------------- query ----------------
  /** the section the search was opened over (its scope gets the ×1.5 boost; over the Map it is filtered to Places) */
  function sectionScope() {
    const s = base;
    return s === 'map' ? 'place' : s === 'settings' || s === 'listen' ? 'setting' : null;
  }
  function run() {
    const q = input.value.trim();
    lastQ = q;
    clearBtn.hidden = !q;
    field.classList.toggle('has-text', !!q);
    if (!q) { results = []; render(); return; }
    const p = ctx.player?.position;
    const boostKind = sectionScope();
    const opts = { limit: 80, boost: { kinds: boostKind ? { [boostKind]: 1.5 } : {}, zone: app.data.currentZoneId() } };
    if (p) { const s = w2m(p); opts.boost.near = [s.X, s.Y]; }
    results = eng.query(q, opts);
    render();
  }
  function setQuery(q) { input.value = q; run(); }
  // a query typed before the engine loaded runs again once it has
  eng.onReady(() => { if (input.value.trim()) run(); });

  function groupOf(kind) { return KINDS[kind] ? kind : 'command'; }
  function render() {
    rows.length = 0;
    active = -1;
    input.removeAttribute('aria-activedescendant');
    const q = input.value.trim();
    empty.hidden = !!q;
    list.hidden = !q;
    keys.hidden = !q;
    scopes.hidden = !q;
    input.setAttribute('aria-expanded', q ? 'true' : 'false');
    if (!q) { renderEmpty(); setText(count, ''); return; }
    // scope chips with counts
    const byKind = new Map();
    for (const r of results) { const k = groupOf(r.doc.kind); if (!byKind.has(k)) byKind.set(k, []); byKind.get(k).push(r); }
    fill(scopes, ...SCOPES.map(([id, label, kinds]) => {
      const n = kinds ? kinds.reduce((s, k) => s + (byKind.get(k)?.length || 0), 0) : results.length;
      if (id !== 'all' && !n) return null;
      return h('button.mk-chip3.mk-chip3--btn', { type: 'button', 'aria-pressed': scope === id ? 'true' : 'false', on: { click: () => { scope = id; render(); } } }, label, h('span.mk-chip3__n', String(n)));
    }));
    const kinds = SCOPES.find(([id]) => id === scope)?.[2] || null;
    const groups = ORDER.filter((k) => byKind.has(k) && (!kinds || kinds.includes(k)));
    list.replaceChildren();
    let shown = 0;
    // the best match of all (the engine ranks by match tier, then score) leads, above the groups, and is Enter's default:
    // a weak rite match must not open before an exact role or setting because rites are grouped first
    const best = groups.length > 1 ? results.find((r) => groups.includes(groupOf(r.doc.kind))) : null;
    if (best) {
      list.append(h('div.mk-sgroup.mk-sgroup--top', { role: 'group', 'aria-label': 'Top result' }, h('div.mk-sgroup__h', { role: 'presentation' }, 'Top result'), row(best.doc)));
      shown++;
    }
    for (const k of groups) {
      const all = byKind.get(k).filter((r) => r !== best);
      if (!all.length) continue;
      const lim = scope === 'all' && !expanded.has(k) ? PER_GROUP : 999;
      const g = h('div.mk-sgroup', { role: 'group', 'aria-label': KINDS[k].label }, h('div.mk-sgroup__h', { role: 'presentation' }, KINDS[k].label, h('span.mk-muted', ` · ${byKind.get(k).length}`)));
      for (const r of all.slice(0, lim)) { g.append(row(r.doc)); shown++; }
      if (all.length > lim) g.append(h('button.mk-linkbtn.mk-sgroup__more', { type: 'button', on: { click: () => { expanded.add(k); render(); } } }, `${all.length - lim} more ›`));
      list.append(g);
    }
    if (!groups.length) list.append(h('div.mk-empty', eng.core ? `Nothing found for “${q}”.` : 'Preparing the search…'));
    const parts = groups.map((k) => `${byKind.get(k).length} ${KINDS[k].label.toLowerCase()}`);
    setText(count, `${results.length} result${results.length === 1 ? '' : 's'}${parts.length ? `: ${parts.slice(0, 3).join(', ')}` : ''}`);
    void shown;
  }

  function subtitleOf(doc) {
    const ref = parseRef(doc.id);
    if (doc.kind === 'rite' && ref?.kind === 'event') {
      const ev = ctx.schedule?.byId?.(ref.id) || app.data.events().find((e) => e.id === ref.id);
      const r = ev && app.data.times(ev);
      if (r) {
        const t = ctx.time?.t;
        const zn = (app.data.zone(ev.zone)?.name?.en || '').split(' — ')[0];
        const when = app.data.isActive(ev, t) ? `now · ${Math.max(1, Math.round(wrap(r.t1 - t)))} min left` : `≈ ${clock(r.t0)}`;
        return [zn, when].filter(Boolean).join(' · ');
      }
    }
    return doc.subtitle?.en || doc.subtitle || '';
  }

  function row(doc) {
    const kind = groupOf(doc.kind);
    const id = `${uid}-o${rows.length}`;
    const ref = parseRef(doc.id);
    const acts = [];
    if (kind === 'place' && ref?.kind === 'zone') acts.push(app.travel.control(() => { remember(doc); afterGo(); app.travel.goZone(ref.id); }, { small: true }));
    if (kind === 'rite' && ref?.kind === 'event') {
      acts.push(app.travel.control(() => { remember(doc); afterGo(); const ev = ctx.schedule?.byId?.(ref.id) || app.data.events().find((e) => e.id === ref.id); if (ev) app.travel.goEvent(ev); }, { small: true }));
      if (ctx.inspect?.seeInAction) acts.push(showBtn(doc.id, 'Show me'));
    }
    if (kind === 'thing' && ctx.inspect?.seeInAction) acts.push(showBtn(doc.id, 'Show me'));
    if (kind === 'offering' && ctx.inspect?.seeInAction) acts.push(showBtn(doc.id, 'Show me one'));
    if (kind === 'setting' && ref) { const c = app.settingInline?.(ref.id); if (c) acts.push(c); }
    if (kind === 'command' && doc.subtitle?.en) acts.push(h('span.mk-kbd', doc.subtitle.en));
    const sub = kind === 'command' ? '' : subtitleOf(doc);
    // the row's buttons are not Tab stops (the listbox keeps one): the keys reach them, and the option says which
    const hasGo = acts.some((a) => a.classList?.contains('mk-go'));
    const hasShow = acts.some((a) => a.dataset?.act === 'show');
    const can = [hasGo ? 'Control+Enter goes there' : null, hasShow ? 'Alt+Enter shows it' : null, acts.length ? 'right arrow reaches its buttons' : null].filter(Boolean);
    const el = h('div.mk-sres', { role: 'option', id, 'aria-selected': 'false', 'data-id': doc.id },
      h('button.mk-sres__main', { type: 'button', tabindex: '-1', on: { click: () => open(doc) } },
        h('span.mk-sres__ico', ico(KINDS[kind]?.icon || 'command')),
        h('span.mk-sres__txt',
          h('span.mk-sres__title', doc.title?.he ? [he(doc.title.he, 'mk-sres__he'), ' · '] : null, doc.title?.en || doc.id),
          sub ? h('span.mk-sres__sub', sub) : null),
        can.length ? h('span.sr-only', `. ${can.join('; ')}.`) : null),
      acts.length ? h('span.mk-sres__acts', acts) : null);
    for (const b of el.querySelectorAll('.mk-sres__acts button')) b.tabIndex = -1;
    el.addEventListener('pointerenter', () => mark(rows.findIndex((r) => r.el === el), false));
    rows.push({ el, doc });
    return el;
  }
  function showBtn(refId, label) {
    return h('button.mk-btn.mk-btn--sm', { type: 'button', 'data-act': 'show', on: { click: () => runShow(app, refId) } }, ico('show'), label);
  }

  function renderEmpty() {
    const t = ctx.time?.t;
    const p = ctx.player?.position;
    const evs = app.data.active(t, { dynamic: false });
    let near = evs;
    if (p) {
      const s = w2m(p);
      const dist = (ev) => { const q = app.data.eventPos(ev); return q ? Math.hypot(q[0] - s.X, q[1] - s.Y) : 1e9; };
      near = [...evs].sort((a, b) => dist(a) - dist(b));
    }
    const rec = recent();
    fill(empty, 
      near.length ? h('div.mk-sgroup', h('div.mk-sgroup__h', 'Near you now'), near.slice(0, 3).map((ev) => h('button.mk-sres__main.mk-sres--plain', { type: 'button', on: { click: () => app.card(`event:${ev.id}`) } },
        h('span.mk-sres__ico', ico('event')), h('span.mk-sres__txt', h('span.mk-sres__title', ev.title?.en || ev.id), h('span.mk-sres__sub', (app.data.zone(ev.zone)?.name?.en || '').split(' — ')[0]))))) : null,
      rec.length ? h('div.mk-sgroup', h('div.mk-sgroup__h', 'Recent'), rec.map((r) => h('button.mk-sres__main.mk-sres--plain', { type: 'button', on: { click: () => open(r) } },
        h('span.mk-sres__ico', ico(KINDS[groupOf(r.kind)]?.icon || 'search')), h('span.mk-sres__txt', h('span.mk-sres__title', r.title?.he ? [he(r.title.he), ' · '] : null, r.title?.en || r.id))))) : null,
      h('div.mk-sgroup', h('div.mk-sgroup__h', 'Try'), h('div.mk-chips', TRY.map((q) => h('button.mk-chip3.mk-chip3--btn', { type: 'button', dir: 'auto', on: { click: () => { setQuery(q); input.focus(); } } }, q)))),
    );
  }

  // ---------------- choose ----------------
  function mark(i, scroll = true) {
    if (i < 0 || i >= rows.length) return;
    active = i;
    rows.forEach((r, k) => r.el.setAttribute('aria-selected', k === i ? 'true' : 'false'));
    input.setAttribute('aria-activedescendant', rows[i].el.id);
    if (scroll) rows[i].el.scrollIntoView({ block: 'nearest' });
  }
  /** open a result: its card, its section, or run it; go = Ctrl/⌘+Enter */
  function open(doc, { go = false } = {}) {
    remember(doc);
    const ref = parseRef(doc.id);
    if (!ref) return;
    const kind = ref.kind;
    if (kind === 'cmd') {
      const c = [...COMMANDS, ...sectionCommands(app), ...app.modules.commands()].find((x) => x.id === ref.id);
      try { c?.run(c.module ? c.module.api : app); } catch (e) { console.error('[ui] command', e); }
      app.announce?.(`${c?.title?.en || 'Done'}`);
      return;
    }
    if (kind === 'setting') { app.openSetting?.(ref.id); return; }
    if (kind === 'learn') { app.open('learn', { section: ref.id }); return; }
    if (kind === 'help') { app.open('help', { topic: ref.id }); return; }
    if (go) {
      if (kind === 'zone') { afterGo(); app.travel.goZone(ref.id); return; }
      if (kind === 'event') { const ev = ctx.schedule?.byId?.(ref.id) || app.data.events().find((e) => e.id === ref.id); if (ev) { afterGo(); app.travel.goEvent(ev); return; } }
      const c = app.describe(doc.id);
      const g = c?.actions?.find((a) => a.kind === 'go');
      if (g) { afterGo(); app.travel.runAction(g, c); return; }
    }
    // a place searched over the Map: back to the Map, the place selected on the plan (it is the map's own search)
    if (kind === 'zone' && base === 'map' && app.mapPanel) {
      app.back?.();
      try { app.mapPanel().selectPlace(ref.id); } catch (e) { console.error('[ui] map select', e); }
      return;
    }
    app.card(doc.id);
  }
  /** after a Go from the search: the field lets go (+ and − are the trip's pace again, not text); focus to the pace */
  function afterGo() {
    input.blur();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const bar = app.travel.bar;
      const f = !bar.hidden && (bar.querySelector('.mk-travel__pace [aria-pressed=true]') || bar.querySelector('button'));
      if (f && f.offsetParent !== null) f.focus({ preventScroll: true });
    }));
  }
  /** a row's buttons in order (the Go control's two halves, Show me, a setting's control) */
  function rowButtons(i) {
    if (!rows[i]) return [];
    return [...rows[i].el.querySelectorAll('.mk-sres__acts button, .mk-sres__acts input, .mk-sres__acts select')].filter((b) => !b.disabled && b.offsetParent !== null);
  }
  // → from the field: into the active row's buttons; ← / → between them; ← from the first, ↑ ↓ or Esc: back to the field
  list.addEventListener('keydown', (e) => {
    const b = e.target.closest?.('.mk-sres__acts button, .mk-sres__acts input, .mk-sres__acts select');
    if (!b) return;
    const i = rows.findIndex((r) => r.el.contains(b));
    const bs = rowButtons(i);
    const k = bs.indexOf(b);
    if (e.key === 'ArrowRight' && k < bs.length - 1) { e.preventDefault(); bs[k + 1].focus(); }
    else if (e.key === 'ArrowLeft' && b.tagName === 'BUTTON') { e.preventDefault(); if (k > 0) bs[k - 1].focus(); else input.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      input.focus();
      if (e.key !== 'Escape') mark(Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
    }
  });

  // ---------------- input events ----------------
  input.addEventListener('focus', () => { app.root.classList.add('mk-searching'); app.showSearch?.(); });
  input.addEventListener('blur', () => app.root.classList.remove('mk-searching'));
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; schedule(); });
  // live during a composition too (only Enter waits for it)
  input.addEventListener('input', () => schedule());
  // a click into a field holding an earlier query selects it, so typing replaces it
  input.addEventListener('pointerdown', () => { if (document.activeElement !== input && input.value) requestAnimationFrame(() => input.select()); });
  // a new Menu session starts empty (the earlier query is under Recent)
  ctx.bus.on('ui:menu', (e) => {
    if (!e || e.open || !input.value) return;
    input.value = '';
    expanded.clear();
    results = [];
    lastQ = '';
    clearBtn.hidden = true;
    field.classList.remove('has-text');
    render();
  });
  function schedule() { clearTimeout(debounceT); debounceT = setTimeout(() => { app.showSearch?.(); run(); }, 60); }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mark(Math.min(rows.length - 1, active + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mark(Math.max(0, active - 1)); }
    else if (e.key === 'PageDown') { e.preventDefault(); mark(Math.min(rows.length - 1, active + 6)); }
    else if (e.key === 'PageUp') { e.preventDefault(); mark(Math.max(0, active - 6)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (composing || e.isComposing) return;
      clearTimeout(debounceT);
      if (input.value.trim() !== lastQ) run();
      const r = rows[active >= 0 ? active : 0];
      if (!r) return;
      if (e.altKey) {
        const b = r.el.querySelector('[data-act=show]');
        if (b) b.click(); else app.announce?.('Nothing to show for this result');
        return;
      }
      open(r.doc, { go: e.ctrlKey || e.metaKey });
    } else if (e.key === 'ArrowRight' && active >= 0 && input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
      const bs = rowButtons(active);
      if (bs.length) { e.preventDefault(); bs[0].focus(); }
    } else if (e.key === 'Escape') {
      // the first Esc clears the field; the next goes back (the app's Esc handler)
      if (input.value) { e.preventDefault(); e.stopPropagation(); setQuery(''); }
    }
  });
  function caps() { const v = app.input.cap('search'); setText(capEl, v || ''); capEl.hidden = !v; }
  app.input.on(caps);
  caps();

  return {
    field, input, view,
    focus(q) {
      if (q != null) setQuery(q);
      input.focus({ preventScroll: true });
      if (q == null) input.select();
      if (!input.value) render();
    },
    clear() { if (!input.value) return false; setQuery(''); return true; },
    render: () => { if (input.value.trim()) run(); else render(); },
    get results() { return results.slice(); },
    get query() { return input.value; },
    setScope(s) { scope = s || 'all'; },
    /** a search session begins over a section (base): its scope follows it (Places over the Map) unless one is given */
    begin(sectionId, s = null) { base = sectionId || null; scope = s || (base === 'map' ? 'place' : 'all'); },
    get base() { return base; },
  };
}
