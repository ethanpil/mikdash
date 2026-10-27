// ♪ Listen (console §3.5): volume, sound on / off, subtitles, how the music is voiced, the recent captions (the last 50,
// each with ≈ time and source; tap to show it again), and the mount point for audio modules — narration, an audio
// guide (§5). Their blocks appear here when a module registers one.
import { h, he } from '../../dom.js';
import { ico } from '../icons.js';
import { createWidgets } from './widgets.js';
import { soundToggle } from '../header.js';

export function listenSection(app) {
  const { ctx } = app;
  return {
    id: 'listen',
    title: { en: 'Listen', he: 'שמע' },
    section: {
      id: 'listen', label: { en: 'Listen', he: 'שמע' }, icon: 'listen', order: 60,
      badge: () => (ctx.settings.get('volume') > 0 ? null : 'off'),
      mount(el) {
        const w = createWidgets(app);
        const sndBtn = h('button.mk-btn', { type: 'button', on: { click: () => { soundToggle(ctx); paint(); } } });
        const paint = () => { const on = ctx.settings.get('volume') > 0; sndBtn.replaceChildren(ico(on ? 'soundOn' : 'soundOff'), h('span', on ? 'Sound on' : 'Sound off')); sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); };
        paint();
        ctx.bus.on('settings:change', (e) => { if (e?.key === 'volume') paint(); });
        const modules = h('div.mk-listen__modules');
        const log = h('ol.mk-caplog', { 'aria-label': 'Recent captions' });
        el.append(
          h('section.mk-sec', h('h3.mk-h', 'Sound'),
            w.row('volume', 'Volume', null, w.range('volume', 'Volume', { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` })),
            w.row(null, 'Sound', 'All sound on or off (the volume is kept)', sndBtn),
            w.row('captions', 'Subtitles', 'Calls, cries and song, in English and Hebrew', w.toggle('captions', 'Subtitles')),
            w.row('musicStyle', 'Music', 'How the Levites’ song is voiced', w.seg('musicStyle', 'Music', [['mishnah', 'Mishnah', 'Voices with lyres, harps and the one cymbal (Arachin 2)'], ['sg1612', 'Shiltei HaGiborim', 'The 1612 reading of the instruments (a later, Renaissance lens)']]), true)),
          modules,
          h('section.mk-sec', h('h3.mk-h', 'Recent captions'), h('p.mk-set__help', 'Kept even with subtitles off. Tap one to show it again.'), log),
        );
        const mounted = new Map(); // module id -> handle
        function syncModules() {
          const recs = app.modules.listenBlocks();
          const ids = new Set(recs.map((r) => r.def.id));
          for (const [id, m] of mounted) if (!ids.has(id)) { try { m.handle?.dispose?.(); } catch { /* ignore */ } m.el.remove(); mounted.delete(id); }
          for (const r of recs) {
            if (mounted.has(r.def.id)) continue;
            const box = h('section.mk-sec', { 'data-module': r.def.id }, h('h3.mk-h', app.modules.t(r.def.title) || r.def.id));
            const handle = app.modules.call(r, 'listen.mount', r.def.listen.mount, box, r.api);
            modules.append(box);
            mounted.set(r.def.id, { el: box, handle });
          }
          // module settings in the Listen group
          for (const old of modules.querySelectorAll('.mk-listen__msets')) old.remove();
          const defs = Object.entries(ctx.settings.defs).filter(([, d]) => d.module && (d.group || 'listen') === 'listen');
          if (defs.length) modules.append(h('section.mk-sec.mk-listen__msets', h('h3.mk-h', 'Modules'), defs.map(([k, d]) => w.moduleRow(k, d))));
        }
        app.modules.onChange(syncModules);
        syncModules();
        let shown = 0;
        function renderLog() {
          const entries = app.captions.log;
          if (entries.length === shown && log.childElementCount === entries.length) return;
          shown = entries.length;
          log.replaceChildren(...(entries.length ? entries.map((c) => h('li', h('button.mk-caplog__b', { type: 'button', on: { click: () => app.captions.replay(c) } },
            h('span.mk-caplog__t', app.captions.timeOf(c)),
            h('span.mk-caplog__txt', c.en ? h('span', c.en) : null, c.he ? he(c.he) : null),
            h('span.mk-caplog__src', c.source === 'narration' ? 'narration' : c.source === 'audio' ? 'sound' : 'scene'))))
            : [h('li.mk-muted', 'No captions yet.')]));
        }
        app.captions.onLog(() => { shown = -1; });
        return {
          show() { shown = -1; renderLog(); for (const m of mounted.values()) m.handle?.update?.(); },
          hide() {},
          update() { renderLog(); for (const m of mounted.values()) { try { m.handle?.update?.(); } catch { /* ignore */ } } },
          focusTarget: () => el.querySelector('input'),
        };
      },
    },
  };
}
