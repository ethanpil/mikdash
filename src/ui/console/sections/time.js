// ◔ Time (console §3.5): the dial with the day's events as arcs (keys unchanged), the transport (−1 seasonal hour,
// play/pause, +1; 1× 10× 60× 600×), the date, the zman buttons and "How the hours are counted". No lists: an arc click or
// Enter opens that event's card under the dial (Go, Show me, Set clock to start).
import { createTimeControl } from '../../timepanel.js';
import { renderCard } from '../card.js';
import { seasonal, fromDial } from '../../format.js';
import { h } from '../../dom.js';
import { eventRow } from '../eventrow.js';

export function timeSection(app) {
  const { ctx } = app;
  return {
    id: 'time',
    title: { en: 'Time', he: 'זמן' },
    section: {
      id: 'time', label: { en: 'Time', he: 'זמן' }, icon: 'time', order: 40, key: 'KeyT', keyCap: 'T', capName: 'time',
      badge: () => { const t = ctx.time; const i = t?.zmanim ? seasonal(t, t.t) : null; return i ? `${i.half === 'day' ? 'day' : 'night'} hour ${i.hour}` : null; },
      mount(el) {
        let card = null;
        const ctl = createTimeControl(app, { onArc: (ev, slot) => onArc(ev, slot) });
        /** an arc's event card, under the dial */
        function onArc(ev, slot = ctl.arcSlot) {
          const c = app.describe(`event:${ev.id}`);
          if (!c) return;
          card = renderCard(app, c, { onBack: () => { slot.replaceChildren(); card = null; ctl.focusTarget()?.focus?.(); }, backLabel: 'Close' });
          slot.replaceChildren(card.el);
          requestAnimationFrame(() => { card?.el.scrollIntoView({ block: 'nearest', behavior: app.reducedMotion() ? 'auto' : 'smooth' }); card?.focus(); });
          ctx.bus.emit('ui:card', { ref: `event:${ev.id}`, card: c });
        }
        // the day's main rites (importance 3) as event rows: Show me jumps there (ux-audit finding 16; the arcs on the dial
        // are thin and need a steady pointer). The schedule of the date shown (ctx.schedule.events follows setDate).
        const mainBox = h('div.mk-evs');
        const mainSec = h('section.mk-sec.mk-time__main', h('h3.mk-h', 'The day’s main rites'), mainBox);
        let mainKey = '', mainRows = [];
        function paintMain() {
          const list = app.data.events().filter((e) => !e.dynamic && (e.importance || 1) >= 3 && app.data.dayOk(e) && app.data.times(e))
            .sort((a, b) => app.data.times(a).t0 - app.data.times(b).t0).slice(0, 16);
          const k = `${ctx.time?.dateString}|${list.map((e) => e.id).join()}`;
          if (k !== mainKey) {
            mainKey = k;
            const seen = new Set();
            mainRows = list.map((e) => eventRow(app, e, { gloss: seen }));
            mainBox.replaceChildren(...mainRows.map((r) => r.el));
            mainSec.hidden = !list.length;
          }
          for (const r of mainRows) r.update();
        }
        el.append(ctl.el, mainSec);
        // LT / RT on a gamepad: ∓ 1/12 seasonal hour
        app.stepClockFn = (hours) => { const t = ctx.time; if (t?.zmanim) t.set(fromDial(t, seasonal(t, t.t).s + hours)); };
        return {
          show(opts = {}) {
            ctl.rebuild();
            mainKey = '';
            paintMain();
            if (opts.focusEvent) { const ev = ctx.schedule?.byId?.(opts.focusEvent) || app.data.events().find((e) => e.id === opts.focusEvent); if (ev) onArc(ev); }
          },
          hide() {},
          update() { ctl.update(false); card?.update(); paintMain(); },
          focusTarget: () => ctl.focusTarget(),
          control: ctl,
        };
      },
    },
  };
}
