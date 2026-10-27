// ? Help (console §3.5): the essentials (three lines), your controls for the device you use — with a switcher Mouse &
// keyboard / Touch / Gamepad / Screen reader (from controls.js, the single source that also feeds README) — replay the
// welcome, what the symbols mean (into Learn → How to read), and what's new (a dot when the version changed).
import { h } from '../../dom.js';
import { ico } from '../icons.js';
import { DEVICES, controlsEl, ESSENTIALS } from '../../controls.js';
import { WHATS_NEW } from '../welcome.js';

export const HELP_TOPICS = [
  ['essentials', 'The essentials', ['help', 'how', 'start', 'keys']],
  ['controls', 'Your controls', ['controls', 'keys', 'keyboard', 'mouse', 'touch', 'gamepad', 'screen reader', 'shortcuts']],
  ['welcome', 'Replay the welcome', ['intro', 'welcome', 'start again']],
  ['symbols', 'What the symbols mean', ['symbols', 'badges', 'icons', 'diamonds', 'rungs']],
  ['whatsnew', 'What’s new', ['new', 'changes', 'version', 'update']],
];

export function helpSection(app) {
  app.helpDocs = () => HELP_TOPICS.map(([id, t, kw]) => ({ id: `help:${id}`, kind: 'help', title: { en: t }, keywords: kw, subtitle: { en: 'Help' } }));
  return {
    id: 'help',
    title: { en: 'Help', he: 'עזרה' },
    section: {
      id: 'help', label: { en: 'Help', he: 'עזרה' }, icon: 'help', order: 80, key: 'Slash', keyCap: '?', capName: 'help', fullDetent: true,
      badge: () => (app.flags.whatsNew ? 'new' : null),
      mount(el) {
        let device = null;
        const devSeg = h('div.mk-seg.mk-help__dev', { role: 'group', 'aria-label': 'Controls for' });
        const keys = h('div.mk-help__keys');
        const newDot = h('span.mk-dot', { hidden: true, 'aria-label': 'new' });
        const sec = (id, title, ...c) => h('section.mk-sec', { id: `mk-help-${id}` }, h('h3.mk-h', { tabindex: '-1' }, title), ...c);
        el.append(
          sec('essentials', 'The essentials', h('p.mk-help__ess', ESSENTIALS)),
          sec('controls', 'Your controls', devSeg, keys),
          sec('welcome', 'The welcome', h('button.mk-btn', { type: 'button', on: { click: () => app.welcome.replay() } }, ico('back'), 'Replay the welcome')),
          sec('symbols', 'What the symbols mean',
            h('dl.mk-defs.mk-help__sym',
              h('dt', h('span.mk-sym.mk-sym--dot')), h('dd', 'You, on the minimap; the cone is where you look, the gold diamond on its rim points to the Kodesh HaKodashim.'),
              h('dt', h('span.mk-sym.mk-sym--dia')), h('dd', 'Something happening now: on the minimap, the map and in the world (an activity marker).'),
              h('dt', h('span.mk-rungs', { 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5, 6].map((i) => h(`i${i === 6 ? '.cur' : '.on'}`, { style: { height: `${3 + i}px` } })))), h('dd', 'The rung of sanctity of a place, on the ladder of ten.'),
              h('dt', h('span.mk-imp', [1, 2, 3].map((i) => h(`i${i <= 2 ? '.on' : ''}`)))), h('dd', 'How central a rite is to the day (one to three).')),
            h('button.mk-linkbtn', { type: 'button', on: { click: () => app.open('learn', { section: 'how', from: 'nav' }) } }, 'How to read the badges and the ladder ›')),
          sec('whatsnew', h('span', 'What’s new ', newDot), h('ul.mk-list', WHATS_NEW.map((t) => h('li', t)))),
        );
        function paintDev() {
          devSeg.replaceChildren(...DEVICES.map((d) => h('button', { type: 'button', 'aria-pressed': d.id === device ? 'true' : 'false', 'data-device': d.id, on: { click: () => { device = d.id; paintDev(); } } }, d.label)));
          keys.replaceChildren(controlsEl(device));
        }
        return {
          show(opts = {}) {
            const m = app.input.mode;
            if (!device) device = m === 'pad' ? 'pad' : m === 'touch' ? 'touch' : 'mouse';
            paintDev();
            newDot.hidden = !app.flags.whatsNew;
            if (opts.topic) {
              if (opts.topic === 'welcome') { app.welcome.replay(); return; }
              requestAnimationFrame(() => { const s = el.querySelector(`#mk-help-${opts.topic}`); s?.scrollIntoView({ block: 'start' }); s?.querySelector('h3')?.focus({ preventScroll: true }); });
            }
          },
          hide() { app.flags.whatsNew = false; },
          focusTarget: () => el.querySelector('h3'),
        };
      },
    },
  };
}
