// ✦ Happening (console §3.5): now and next. A filter — Everywhere · Here · Near me (≤ 60 m), plus Aggadah when that
// layer is on. "Now" is grouped by area with counts; each stage's individual offerings collapse into one row ("7
// individual offerings at the rings · Show me one ▸"). "Next" lists the next six. Every row is the single event row.
import { h } from '../../dom.js';
import { w2m, AMAH } from '../../../core/units.js';
import { eventRow, dynGroup, stageTitle } from '../eventrow.js';

const NEAR_M = 60;

export function happeningSection(app) {
  const { ctx, data } = app;
  const count = () => data.active(ctx.time?.t).length;
  return {
    id: 'happening',
    title: { en: 'Happening', he: 'עכשיו' },
    section: {
      id: 'happening', label: { en: 'Happening', he: 'עכשיו' }, icon: 'happening', order: 20,
      badge: () => `· ${count()}`,
      mount(el) {
        let filter = 'all', key = '', rows = [];
        const openGroups = new Set();
        const seg = h('div.mk-seg.mk-hap__filter', { role: 'group', 'aria-label': 'Show' });
        const nowBox = h('div.mk-hap__now');
        const nextBox = h('div.mk-evs');
        el.append(seg, h('section.mk-sec', h('h3.mk-h', 'Now'), nowBox), h('section.mk-sec', h('h3.mk-h', 'Next'), nextBox));
        const FILTERS = [['all', 'Everywhere'], ['here', 'Here'], ['near', 'Near me'], ['aggadah', 'Aggadah']];
        function paintSeg() {
          const agg = ctx.settings.get('aggadah') !== false;
          if (!agg && filter === 'aggadah') filter = 'all';
          seg.replaceChildren(...FILTERS.filter(([id]) => id !== 'aggadah' || agg).map(([id, label]) => h('button', {
            type: 'button', 'aria-pressed': filter === id ? 'true' : 'false', 'data-filter': id, on: { click: () => { filter = id; key = ''; paintSeg(); render(); } },
          }, label)));
        }
        const near = (ev) => {
          const p = ctx.player?.position, q = data.eventPos(ev);
          if (!p || !q) return false;
          const s = w2m(p);
          return Math.hypot(q[0] - s.X, q[1] - s.Y) * AMAH <= NEAR_M;
        };
        function keep(ev) {
          if (filter === 'here') { const z = data.currentZoneId(); return ev.zone === z || (Array.isArray(ev.zones) && ev.zones.includes(z)); }
          if (filter === 'near') return near(ev);
          if (filter === 'aggadah') return ev.layer === 'aggadah';
          return true;
        }
        function render() {
          const t = ctx.time?.t;
          const act = data.active(t).filter(keep);
          const next = data.upcoming(t, 30).filter(keep).slice(0, 6);
          const k = `${filter}|${data.currentZoneId()}|${act.map((e) => e.id).join()}|${next.map((e) => e.id).join()}`;
          if (k !== key) {
            key = k;
            rows = [];
            // by area: the day's events, then each stage's individual offerings as one row
            const areas = new Map();
            for (const ev of act) {
              const z = ev.zone || '';
              if (!areas.has(z)) areas.set(z, { stat: [], dyn: new Map() });
              const a = areas.get(z);
              if (ev.dynamic) { const p = ev.parent || ''; if (!a.dyn.has(p)) a.dyn.set(p, []); a.dyn.get(p).push(ev); } else a.stat.push(ev);
            }
            const order = [...areas.entries()].sort((x, y) => (y[1].stat.length + y[1].dyn.size) - (x[1].stat.length + x[1].dyn.size));
            nowBox.replaceChildren(...(order.length ? order.map(([z, a]) => {
              const n = a.stat.length + [...a.dyn.values()].reduce((s, l) => s + l.length, 0);
              const name = (data.zone(z)?.name?.en || 'Elsewhere').split(' — ')[0];
              const box = h('div.mk-evs');
              for (const ev of a.stat) { const r = eventRow(app, ev, { place: false }); rows.push(r); box.append(r.el); }
              for (const [pid, list] of a.dyn) {
                const parent = ctx.schedule?.byId?.(pid);
                const g = dynGroup(app, list, { key: `${z}-${pid}`, title: stageTitle(pid, parent?.title?.en || list[0]?.parentTitle?.en, list.length), open: openGroups.has(`${z}-${pid}`), onToggle: (on) => (on ? openGroups.add(`${z}-${pid}`) : openGroups.delete(`${z}-${pid}`)) });
                rows.push(g);
                box.append(g.el);
              }
              return h('div.mk-hap__area', h('h4.mk-hap__areah', h('button.mk-linkbtn', { type: 'button', on: { click: () => app.card(`zone:${z}`) } }, name), h('span.mk-muted', ` · ${n}`)), box);
            }) : [h('div.mk-empty', filter === 'all' ? 'Nothing in the order of the day at this hour. The fires on the altar burn on.' : 'Nothing here at this hour.')]));
            nextBox.replaceChildren(...(next.length ? next.map((ev) => { const r = eventRow(app, ev); rows.push(r); return r.el; }) : [h('div.mk-empty', 'Nothing further scheduled for this date.')]));
          }
          for (const r of rows) r.update(t);
        }
        ctx.bus.on('settings:change', (e) => { if (e?.key === 'aggadah') { paintSeg(); key = ''; } });
        ctx.bus.on('time:date', () => { key = ''; });
        paintSeg();
        return {
          show(opts = {}) { if (opts.filter) { filter = opts.filter; paintSeg(); } key = ''; render(); },
          hide() {},
          update: render,
          focusTarget: () => seg.querySelector('[aria-pressed=true]'),
        };
      },
    },
  };
}
