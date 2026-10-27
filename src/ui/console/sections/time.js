// ◔ Time (console §3.5): the dial with the day's events as arcs (keys unchanged), the transport (−1 seasonal hour,
// play/pause, +1; 1× 10× 60× 600×), the date, the zman buttons and "How the hours are counted". No lists: an arc click or
// Enter opens that event's card under the dial (Go, Show me, Set clock to start).
import { createTimeControl } from '../../timepanel.js';
import { renderCard } from '../card.js';
import { seasonal, fromDial } from '../../format.js';

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
        el.append(ctl.el);
        // LT / RT on a gamepad: ∓ 1/12 seasonal hour
        app.stepClockFn = (hours) => { const t = ctx.time; if (t?.zmanim) t.set(fromDial(t, seasonal(t, t.t).s + hours)); };
        return {
          show(opts = {}) {
            ctl.rebuild();
            if (opts.focusEvent) { const ev = ctx.schedule?.byId?.(opts.focusEvent) || app.data.events().find((e) => e.id === opts.focusEvent); if (ev) onArc(ev); }
          },
          hide() {},
          update() { ctl.update(false); card?.update(); },
          focusTarget: () => ctl.focusTarget(),
          control: ctl,
        };
      },
    },
  };
}
