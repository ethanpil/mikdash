// Subsystem registry, initialised in this order after the world is built.
// Each module exports `async function init(ctx)` and attaches its API to ctx (see ARCHITECTURE.md).
// A failing subsystem is logged and skipped so the rest of the experience still runs.
export const SYSTEMS = [
  ['time', () => import('./time/index.js')],
  ['env', () => import('./env/index.js')],
  ['render', () => import('./render/index.js')],
  ['player', () => import('./player/index.js')],
  ['people', () => import('./people/index.js')],
  ['sim', () => import('./sim/index.js')],
  ['audio', () => import('./audio/index.js')],
  ['ui', () => import('./ui/index.js')],
];
