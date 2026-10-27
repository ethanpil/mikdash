// UI system (ARCHITECTURE.md §13; the Luach console, docs/console-design.md).
//   ctx.settings = { get(key), set(key, value), all(), defs, define(def), isSet(key) }   localStorage 'mikdash.<key>';
//                  bus 'settings:change'
//   ctx.ui       = { toast(msg, ms?), fade(to, ms) | fade(ms) -> Promise, open(section, opts?), close(), toggle(section),
//                    panel, hints(on), enter(), card(ref | hit), search(q?, { scope }), banner(zone | {en, he}, { kind }),
//                    modules, console, map }   sections: 'here' | 'happening' | 'map' | 'time' | 'learn' | 'listen' |
//                    'settings' | 'help' (+ legacy 'info' → here, 'about' → learn)
// fade(to 0..1, ms) moves the black veil (the player's teleport contract: fade(1, 220) … fade(0, 320));
// fade(ms) alone dips to black, resolves when black, then lifts by itself.
// Nothing is mounted when ctx.params.ui is false (shot=1 or ui=0); the UI code is then never loaded.
import { createSettings } from './settings.js';

const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500'
  + '&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Frank+Ruhl+Libre:wght@400;500;700&display=swap';

/** Web fonts as a script-inserted <link> (never render- or boot-blocking; display=swap; Georgia/David until then). */
function loadFonts() {
  if (document.querySelector('link[data-mk-fonts]')) return;
  const link = (rel, href, cors) => {
    const l = document.createElement('link');
    l.rel = rel;
    l.href = href;
    if (cors) l.crossOrigin = 'anonymous';
    return l;
  };
  const sheet = link('stylesheet', FONTS_URL);
  sheet.setAttribute('data-mk-fonts', '');
  document.head.append(link('preconnect', 'https://fonts.googleapis.com'), link('preconnect', 'https://fonts.gstatic.com', true), sheet);
}

export async function init(ctx) {
  const p = ctx.params || {};
  ctx.settings = createSettings(ctx.bus, { ignoreStorage: !!p.shot });

  // field of view: the URL (?fov=) wins; otherwise the saved setting
  const urlFov = p.raw?.has?.('fov');
  const applyFov = () => {
    if (urlFov || !ctx.camera) return;
    const f = ctx.settings.get('fov');
    if (Number.isFinite(f) && Math.abs(ctx.camera.fov - f) > 0.01) { ctx.camera.fov = f; ctx.camera.updateProjectionMatrix(); }
  };
  applyFov();
  ctx.bus.on('settings:change', (e) => { if (e?.key === 'fov') applyFov(); });

  if (!p.ui || typeof document === 'undefined') {
    const noModules = { register: () => () => {}, unregister() {}, has: () => false, get: () => null };
    ctx.ui = {
      toast() {}, fade: async () => {}, open: () => false, close() {}, toggle() {}, panel: null, hints() {}, enter() {}, enabled: false,
      card: () => false, search() {}, banner() {}, modules: noModules, console: null, map: null,
    };
    return;
  }

  loadFonts(); // not awaited: nothing network-bound may stand in front of init's return
  const { mountUi } = await import('./app.js');
  const ui = mountUi(ctx);
  ui.enabled = true;
  ctx.ui = ui;

  // the screenshot tool's --keep-ui mode waits for __mikdashReady, which main.js only sets for shot=1.
  // Wait for the fonts so shots show the real faces, but never longer than 5 s (offline / slow fonts host).
  // (perf-1: from the first drawn frame — main.js compiles the shaders between 'ready' and 'firstFrame')
  ctx.bus.on('firstFrame', () => {
    let n = 0;
    const wait = () => {
      if (++n < 30) { requestAnimationFrame(wait); return; }
      const cap = new Promise((r) => { setTimeout(r, 5000); });
      Promise.race([Promise.resolve(document.fonts?.ready), cap]).finally(() => { if (globalThis.__mikdashReady !== true) globalThis.__mikdashReady = true; });
    };
    requestAnimationFrame(wait);
  });
}
