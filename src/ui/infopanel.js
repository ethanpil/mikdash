// INFO panel: the place — names, its rung on the ladder of sanctity, who may enter, what is happening here now,
// what is done here, a description, and sources (Sefaria links).
import { h, he, clear } from './dom.js';
import { createPanel, section } from './panel.js';
import { eventRow, sourcesEl } from './events.js';
import { LADDER, LADDER_SOURCES } from './data.js';
import { clock } from './format.js';

export function createInfoPanel(app) {
  const { ctx, data } = app;
  const panel = createPanel(app, { name: 'info', title: 'This place', heTitle: 'המקום', side: 'left' });
  const body = panel.body;
  let zoneId = null, pinned = null, nowKey = '';
  let rows = [];
  const nowBox = h('div.mk-evs');

  function render() {
    const id = pinned || data.currentZoneId();
    zoneId = id;
    nowKey = '';
    clear(body);
    const z = data.zone(id);
    if (!z) { body.append(h('p.mk-p.mk-muted', 'Outside the precinct.')); return; }
    const name = z.name || {};
    const head = h('div.mk-sec',
      name.he ? he(name.he, 'mk-info__he') : null,
      h('span.mk-info__en', name.en || id),
      name.translit && !String(name.en || '').includes(name.translit) ? h('span.mk-info__tr', name.translit) : null);
    body.append(head);

    const r = data.rung(id);
    if (r !== null) {
      const bars = h('div.mk-ladder', { role: 'img', 'aria-label': `Sanctity: ${LADDER[r].en}, rung ${r + 1} of ${LADDER.length}` },
        LADDER.map((L, i) => h(`i${i === r ? '.cur' : i < r ? '.on' : ''}`, { title: `${L.en} — ${L.rule}`, style: { height: `${16 + i * 4.4}px` } })));
      body.append(section('Sanctity',
        bars,
        h('div.mk-ladder__labels', h('span', 'Eretz Yisrael'), h('span', 'Kodesh HaKodashim')),
        h('p.mk-ladder__cur', h('b', LADDER[r].en), ' ', he(LADDER[r].he), h('br'), h('span.mk-muted', LADDER[r].rule)),
        h('div.mk-note', 'The ten sanctities, each within the last: ', sourcesEl(LADDER_SOURCES))));
    }
    if (z.access) body.append(section('Who may enter', h('p.mk-p', z.access)));
    body.append(section('Happening here now', nowBox));
    updateNow(true);
    const services = Array.isArray(z.services) ? z.services : (z.services ? [z.services] : []);
    if (services.length) body.append(section('What is done here', h('ul.mk-list', services.map((s) => h('li', typeof s === 'string' ? s : (s.en || s.title || ''))))));
    if (z.description) body.append(section('About', ...String(z.description).split(/\n\s*\n/).map((p) => h('p.mk-p', p))));
    if (z.sources?.length) body.append(section('Sources', sourcesEl(z.sources)));
    if (z.fixture) body.append(h('p.mk-sample', 'Sample entry — the full gazetteer of places will replace this text.'));
  }

  function updateNow(force) {
    const t = ctx.time?.t;
    const here = data.at(zoneId, t);
    const key = here.map((e) => e.id).join(',');
    if (force || key !== nowKey) {
      nowKey = key;
      clear(nowBox);
      rows = here.map((ev) => eventRow(app, ev, { active: true }));
      for (const r of rows) nowBox.append(r.el);
      if (!rows.length) {
        const next = data.nextAt(zoneId, t);
        const times = next && data.times(next);
        nowBox.append(h('div.mk-empty', 'Nothing in the order of the day here at this hour.',
          next ? [h('br'), 'Next here: ', h('button.mk-btn.mk-btn--sm.mk-btn--ghost', { type: 'button', style: { padding: '0 6px', minHeight: '0' }, on: { click: () => app.open('time', { focusEvent: next.id }) } },
            `${next.title?.en || next.id}${times ? ` (≈ ${clock(times.t0)})` : ''}`)] : null));
      }
    }
    for (const r of rows) r.update(t);
  }

  let lastZone = null;
  return {
    ...panel,
    onOpen(opts = {}) { pinned = opts.zone || null; lastZone = data.currentZoneId(); render(); },
    update() {
      if (!pinned) {
        const id = data.currentZoneId();
        if (id !== lastZone) { lastZone = id; render(); return; }
      }
      updateNow(false);
    },
  };
}
