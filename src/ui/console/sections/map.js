// ▦ Map (console §3.5): the existing map (plan, labels, presets, zoom, scale, live activity and markers, the route,
// select-and-go) as a section. The Menu widens to the whole viewport for it on desktop; full screen on phones, where
// player input is off (console.applyInput).
import { createMapPanel } from '../../mappanel.js';

export function mapSection(app) {
  let panel = null;
  const get = () => { if (!panel) panel = createMapPanel(app); return panel; };
  app.mapPanel = get;
  return {
    id: 'map',
    title: { en: 'Map', he: 'מפה' },
    section: {
      id: 'map', label: { en: 'Map', he: 'מפה' }, icon: 'map', order: 30, key: 'KeyM', keyCap: 'M', capName: 'map', noScroll: true, fullDetent: true,
      mount(el) {
        const p = get();
        el.classList.add('mk-mapview');
        el.append(p.el);
        return {
          show: (opts) => p.show(opts),
          hide: () => p.hide(),
          tick: (dt) => p.tick(dt),
          update: () => p.update(),
          onEscape: () => p.onEscape(),
          focusTarget: () => p.focusTarget(),
        };
      },
    },
  };
}
