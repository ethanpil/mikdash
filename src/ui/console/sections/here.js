// ⌂ Here (console §3.5): the place card of where you stand (it follows you unless pinned). In order: Happening here (≤ 3,
// then "All in Happening ›"), Things here (the inspect core's thingsIn), Nearby (everyone and everything within 15 m,
// with bearing words — the way keyboard, screen-reader and gamepad users inspect without aiming), Who may enter, What
// is done here, About, Sources, Also here (storeys), and Go to this place.
import { h, setText } from '../../dom.js';
import { renderCard } from '../card.js';
import { eventRow, dynGroup } from '../eventrow.js';

const OWN = new Set(['happening', 'next', 'things', 'nearby']); // rendered live here, not from the card data
const NEAR_FIRST = 12; // Nearby's rows before "Show all n nearby ›"
const NEAR_GROUPS = new Map([['person', 'People'], ['animal', 'Animals'], ['object', 'Things']]);
/** "ahead-left, 6 m": the inspect core's bearing words already carry the distance; add it only when they do not */
const nearWhere = (i) => {
  const b = i.bearing?.en || '';
  const m = `${Math.max(1, Math.round(i.distance))} m`;
  return /\d\s*m\b/.test(b) ? b : b ? `${b}, ${m}` : m;
};

export function hereSection(app) {
  const { ctx, data } = app;
  return {
    id: 'here',
    title: { en: 'Here', he: 'כאן' },
    section: {
      id: 'here', label: { en: 'Here', he: 'כאן' }, icon: 'here', order: 10, key: 'KeyI', keyCap: 'I', capName: 'here',
      badge: () => null,
      mount(el) {
        let zone = null, pinned = false, passedAt = null, card = null, nearAcc = 1, nearbyOn = false;
        const passed = h('p.mk-passed', { hidden: true });
        const holder = h('div');
        el.append(passed, holder);

        // ---------------- live blocks ----------------
        function happeningBlock() {
          let key = '', rows = [];
          const box = h('div.mk-evs');
          const all = h('button.mk-linkbtn', { type: 'button', on: { click: () => app.open('happening', { filter: 'here', from: 'nav' }) } }, 'All in Happening ›');
          return {
            id: 'happening', title: { en: 'Happening here' }, open: true,
            mount(body) {
              body.append(box, all);
              const upd = (t) => {
                const list = data.at(zone, t, { dynamic: true });
                const stat = list.filter((e) => !e.dynamic), dyn = list.filter((e) => e.dynamic);
                const k = `${list.map((e) => e.id).join()}`;
                if (k !== key) {
                  key = k;
                  rows = stat.slice(0, 3).map((ev) => eventRow(app, ev, { place: false }));
                  if (dyn.length) rows.push(dynGroup(app, dyn, { key: `here-${zone}`, title: `${dyn.length} individual offering${dyn.length === 1 ? '' : 's'} here` }));
                  if (!rows.length) {
                    const next = data.nextAt(zone, t);
                    box.replaceChildren(h('div.mk-empty', 'Nothing in the order of the day here at this hour.',
                      next ? [h('br'), 'Next here: ', h('button.mk-linkbtn', { type: 'button', on: { click: () => app.card(`event:${next.id}`) } }, `${next.title?.en || next.id} ›`)] : null));
                  } else box.replaceChildren(...rows.map((r) => r.el));
                  all.hidden = stat.length <= 3 && !dyn.length;
                  const sum = body.closest('details')?.querySelector('summary');
                  if (sum) setText(sum, `Happening here · ${list.length}`);
                }
                for (const r of rows) r.update(t);
              };
              upd(ctx.time?.t);
              return { update: upd };
            },
          };
        }
        function thingsBlock() {
          if (!ctx.inspect?.thingsIn) return null;
          let items = [];
          try { items = ctx.inspect.thingsIn(zone) || []; } catch { items = []; }
          if (!items.length) return null;
          return {
            id: 'things', title: { en: 'Things here' }, open: true,
            mount(body) {
              body.append(h('div.mk-chips', items.map((t) => h('button.mk-chip3.mk-chip3--btn', { type: 'button', on: { click: () => app.card(t.ref) } }, t.title?.en || t.ref, ' ›'))));
            },
          };
        }
        function nearbyBlock() {
          // what is around you: only on the card of the place you are in (a pinned other place has none)
          if (!ctx.inspect?.nearby || zone !== data.currentZoneId()) return null;
          const list = h('ul.mk-nearby');
          // the nearest NEAR_FIRST; "Show all n nearby ›" expands the list in place, grouped by kind, so everyone and
          // everything within 15 m is reachable without aiming (AC-9)
          let expanded = false;
          return {
            id: 'nearby', title: { en: 'Nearby' }, open: true,
            mount(body) {
              body.append(list);
              let key = '';
              const row = (i) => h('li', h('button.mk-nearby__b', { type: 'button', 'data-ref': i.ref, on: { click: () => app.card(i.ref) } },
                h('span.mk-nearby__t', i.label?.en || i.title?.en || i.ref), h('span.mk-nearby__d', nearWhere(i)), ' ›'));
              const upd = (force) => {
                if (force !== true && (nearAcc += 0.25) < 1) return;
                nearAcc = 0;
                let items = [];
                try { items = ctx.inspect.nearby(15, { limit: Infinity }) || []; } catch { items = []; }
                const more = items.length > NEAR_FIRST;
                const shown = expanded ? items : items.slice(0, NEAR_FIRST);
                const k = `${expanded}|${items.length}|${shown.map((i) => `${i.ref}|${Math.round(i.distance)}|${i.bearing?.en}|${i.label?.en}`).join(';')}`;
                if (k === key) return;
                key = k;
                // a rebuild keeps keyboard focus on the same subject's row
                const focused = list.contains(document.activeElement) ? document.activeElement.dataset.ref || (document.activeElement.classList.contains('mk-nearby__all') ? 'all' : null) : null;
                let rows;
                if (!items.length) rows = [h('li.mk-muted', 'No one and nothing within 15 m.')];
                else if (!expanded) {
                  rows = shown.map(row);
                  if (more) rows.push(h('li', h('button.mk-linkbtn.mk-nearby__all', { type: 'button', on: { click: () => { expanded = true; key = ''; upd(true); list.querySelector('.mk-nearby__b')?.focus({ preventScroll: true }); } } }, `Show all ${items.length} nearby ›`)));
                } else {
                  rows = [];
                  for (const [kind, label] of NEAR_GROUPS) {
                    const g = items.filter((i) => (NEAR_GROUPS.has(i.kind) ? i.kind : 'object') === kind);
                    if (g.length) rows.push(h('li.mk-nearby__h', `${label} · ${g.length}`), ...g.map(row));
                  }
                }
                list.replaceChildren(...rows);
                if (focused) (focused === 'all' ? list.querySelector('.mk-nearby__b') : [...list.querySelectorAll('.mk-nearby__b')].find((b) => b.dataset.ref === focused))?.focus({ preventScroll: true });
              };
              upd(true);
              return { update: upd };
            },
          };
        }

        function render() {
          const c = app.describe(`zone:${zone}`);
          if (!c) { holder.replaceChildren(h('p.mk-p.mk-muted', 'Outside the precinct.')); card = null; return; }
          // the live blocks first; Go to this place and Map always (the inspect core's place card may carry others)
          nearbyOn = zone === data.currentZoneId();
          const augment = (cc) => {
            const own = [happeningBlock(), thingsBlock(), nearbyBlock()].filter(Boolean);
            const fb = app.placeCard(zone)?.actions || [];
            const acts = [...(cc.actions || [])];
            for (const a of fb) if (!acts.some((x) => x.kind === a.kind)) acts.push(a);
            // Happening here, Who may enter and About are sections here: the card's own NOW line and leads would repeat them
            return { ...cc, now: null, what: null, who: null, actions: acts, sections: [...own, ...(cc.sections || []).filter((s) => !OWN.has(s.id))] };
          };
          card = renderCard(app, c, {
            augment,
            pinned, sectionsFirst: true, now: false,
            onPin: () => { pinned = !pinned; if (!pinned) zone = data.currentZoneId(); render(); },
          });
          holder.replaceChildren(card.el);
          passed.hidden = !passedAt || zone === data.currentZoneId();
          setText(passed, passedAt ? `You passed through here at ${passedAt}.` : '');
        }
        function follow() {
          const id = data.currentZoneId();
          // pinned: Nearby comes and goes as you enter or leave the pinned place
          if (pinned) { if (card && (id === zone) !== nearbyOn) render(); return; }
          if (id !== zone) { zone = id; passedAt = null; render(); }
        }
        return {
          show(opts = {}) {
            // Back to this view: as it was when another level covered it (a pinned place, or where you are)
            if (opts.back && opts.state) {
              const st = opts.state;
              const z = st.pinned && st.zone ? st.zone : data.currentZoneId();
              const p = !!st.pinned && z !== data.currentZoneId();
              if (z !== zone || p !== pinned || !card) { zone = z; pinned = p; passedAt = st.passedAt || null; render(); }
              return;
            }
            if (opts.zone) { zone = opts.zone; pinned = opts.pinned !== false && opts.zone !== data.currentZoneId(); passedAt = opts.passedAt || null; render(); }
            // opened as "Here" (I, the rail, a tile, About this place): where you are; Back returns to a pinned place
            else if (!card || ((!pinned || (opts.from && !opts.back)) && zone !== data.currentZoneId())) { pinned = false; zone = data.currentZoneId(); passedAt = null; render(); }
            else if (pinned && opts.from && !opts.back) { pinned = false; render(); }
            if (opts.scrollTo) requestAnimationFrame(() => {
              const s = card?.section(opts.scrollTo);
              if (s) { if (s.tagName === 'DETAILS') s.open = true; s.scrollIntoView({ block: 'start', behavior: app.reducedMotion() ? 'auto' : 'smooth' }); s.querySelector('summary')?.focus({ preventScroll: true }); }
            });
          },
          hide() {},
          update() { follow(); card?.update(); },
          focusTarget: () => card?.el.querySelector('.mk-card__title'),
          /** what Back restores (console.js keeps it on the view's stack entry when another level covers it) */
          state: () => ({ zone: pinned ? zone : null, pinned, passedAt }),
          get zone() { return zone; },
          get pinned() { return pinned; },
        };
      },
    },
  };
}
