// Module registry (console §5), exposed as ctx.ui.modules. The eight built-in sections register through it too.
//   register(def) -> off()     def: { id, title, section?, listen?, cardActions?, cardSections?, search?, commands?,
//                                     settings?, banner?, status?, on? }
// A hook that throws is logged once and its module is disabled: it never breaks the Menu.
import { h } from '../dom.js';

const ID = /^[a-z][a-z0-9-]*$/;

export function createModules(app) {
  const mods = new Map(); // id -> { def, off: [fn], disabled }
  const subs = new Set();
  const changed = () => { for (const f of subs) { try { f(); } catch (e) { console.error('[ui] modules change', e); } } };
  const t = (o) => (o == null ? '' : typeof o === 'string' ? o : (o.en ?? ''));

  function apiFor(id) {
    return {
      ctx: app.ctx,
      open: (sectionId, opts) => app.open(sectionId, opts),
      card: (ref) => app.card(ref),
      close: () => app.close(),
      caption: (text, ms = 4000) => app.ctx.bus.emit('caption', { text, duration: ms / 1000, source: 'narration' }),
      notice: (text, ms) => app.toast(text, ms),
      settings: {
        get: (k) => app.ctx.settings.get(`module.${id}.${k}`),
        set: (k, v) => app.ctx.settings.set(`module.${id}.${k}`, v),
      },
      h,
      t,
    };
  }

  /** call a module hook safely: a throw disables the module (logged once) */
  function call(m, name, fn, ...args) {
    if (m.disabled || typeof fn !== 'function') return undefined;
    try { return fn(...args); } catch (e) {
      m.disabled = true;
      console.error(`[ui] module "${m.def.id}" failed in ${name} and was disabled`, e);
      queueMicrotask(changed);
      return undefined;
    }
  }

  const reg = {
    register(def) {
      if (!def || !ID.test(def.id || '')) throw new Error(`[ui] module id must match ${ID}: ${def?.id}`);
      if (mods.has(def.id)) reg.unregister(def.id);
      const m = { def, off: [], disabled: false, api: apiFor(def.id) };
      mods.set(def.id, m);
      // settings
      for (const s of def.settings || []) {
        const key = `module.${def.id}.${s.key}`;
        m.off.push(app.ctx.settings.define?.({ ...s, key, group: s.group || 'listen', label: s.label }) || (() => {}));
      }
      // bus hooks
      for (const [ev, fn] of Object.entries(def.on || {})) {
        m.off.push(app.ctx.bus.on(ev, (e) => call(m, `on.${ev}`, fn, e, m.api)));
      }
      // search docs + commands
      if (def.search && app.searchEngine) m.off.push(app.searchEngine.addModule(def, m));
      changed();
      return () => reg.unregister(def.id);
    },
    unregister(id) {
      const m = mods.get(id);
      if (!m) return;
      mods.delete(id);
      for (const f of m.off) { try { f?.(); } catch { /* ignore */ } }
      m.mounted?.dispose?.();
      changed();
    },
    has: (id) => mods.has(id),
    get: (id) => mods.get(id)?.def || null,
    /** live records (internal) */
    records: () => [...mods.values()].filter((m) => !m.disabled),
    /** Menu sections, by order */
    sections: () => reg.records().filter((m) => m.def.section).sort((a, b) => (a.def.section.order ?? 100) - (b.def.section.order ?? 100)),
    listenBlocks: () => reg.records().filter((m) => m.def.listen).sort((a, b) => (a.def.listen.order ?? 100) - (b.def.listen.order ?? 100)),
    commands: () => reg.records().flatMap((m) => (m.def.commands || []).map((c) => ({ ...c, module: m }))),
    cardActions(card) { return reg.records().flatMap((m) => call(m, 'cardActions', m.def.cardActions, card, m.api) || []); },
    cardSections(card) { return reg.records().flatMap((m) => call(m, 'cardSections', m.def.cardSections, card, m.api) || []); },
    banner(zoneId) {
      for (const m of reg.records()) { const r = call(m, 'banner', m.def.banner, zoneId, m.api); if (r) return r; }
      return null;
    },
    /** the header's one status chip */
    status() {
      for (const m of reg.records()) { const r = call(m, 'status', m.def.status, app.ctx); if (r) return { ...r, module: m }; }
      return null;
    },
    badge(m) { return call(m, 'badge', m.def.section?.badge, app.ctx) ?? null; },
    call,
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
    t,
  };
  return reg;
}
