// Inline SVG line icons for the console (console §3.8): 24-unit viewBox drawn at 20 px, stroke 1.5, currentColor.
// Every icon is shown with a visible text label beside it; the SVGs are aria-hidden.
import { h } from '../dom.js';

const S = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  here: S('<path d="M4 11.5L12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>'),
  happening: S('<path d="M12 3.5l1.9 5.4 5.6.3-4.4 3.5 1.5 5.5L12 15l-4.6 3.2 1.5-5.5-4.4-3.5 5.6-.3z"/>'),
  map: S('<path d="M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z"/><path d="M9 4.5v13M15 6.5v13"/>'),
  time: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>'),
  learn: S('<path d="M12 6.8c-1.9-1.5-4.6-2.1-7.8-1.8v12.6c3.2-.3 5.9.3 7.8 1.8 1.9-1.5 4.6-2.1 7.8-1.8V5c-3.2-.3-5.9.3-7.8 1.8zM12 6.8v12.6"/>'),
  listen: S('<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>'),
  settings: S('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/>'),
  help: S('<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 014.8 1c0 1.7-2.4 2-2.4 3.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  search: S('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  menu: S('<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>'),
  fly: S('<path d="M12 3.5v17M12 3.5l-4 4M12 3.5l4 4"/><path d="M5 14c2.5-1.5 4.5-1.5 7 0 2.5 1.5 4.5 1.5 7 0"/>'),
  walk: S('<circle cx="13" cy="4.6" r="1.6"/><path d="M10.5 21l2-6 2.5 2.5V21M9 12l1.5-4.5 3.5 1 2 3.5M13 8.5l-1.5 6.5"/>'),
  run: S('<circle cx="15" cy="4.6" r="1.6"/><path d="M6 20l3.5-4.5 3 1.5 1.5-5M8 10l3-2.5 4 1.5 1.5 3.5 3 1M12.5 12.5l-3 3"/>'),
  instant: S('<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>'),
  soundOn: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>'),
  soundOff: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  play: S('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  pause: S('<path d="M8 5.5v13M16 5.5v13" stroke-width="3"/>'),
  back: S('<path d="M9 7.5L4.5 12 9 16.5"/><path d="M5 12h9.5a5 5 0 010 10H12"/>'),
  prev: S('<path d="M14.5 6l-6 6 6 6"/>'),
  next: S('<path d="M9.5 6l6 6-6 6"/>'),
  down: S('<path d="M6 9.5l6 6 6-6"/>'),
  go: S('<path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"/>'),
  show: S('<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  follow: S('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  pin: S('<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0113 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.2"/>'),
  stop: S('<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>'),
  skip: S('<path d="M5 6l8 6-8 6zM14 6l6 6-6 6"/>'),
  plus: S('<path d="M12 6v12M6 12h12"/>'),
  minus: S('<path d="M6 12h12"/>'),
  ext: S('<path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/>'),
  cal: S('<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
  person: S('<circle cx="12" cy="7" r="3"/><path d="M5.5 20.5c.6-4 3.2-6.5 6.5-6.5s5.9 2.5 6.5 6.5"/>'),
  animal: S('<path d="M5 11c0-2.5 2.5-4 5.5-4h3c3 0 5.5 1.5 5.5 4 0 1.8-1 3-2.5 3.5V19M7.5 14.5V19M5 11l-1.5-2.5M19 11l1.5-2.5"/>'),
  object: S('<path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M4.5 7.7L12 12l7.5-4.3M12 12v8.5"/>'),
  place: S('<path d="M4 11.5L12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/>'),
  event: S('<path d="M12 3.5l1.9 5.4 5.6.3-4.4 3.5 1.5 5.5L12 15l-4.6 3.2 1.5-5.5-4.4-3.5 5.6-.3z"/>'),
  offering: S('<path d="M12 3.5c2.5 3 4 5.2 4 7.5a4 4 0 01-8 0c0-2.3 1.5-4.5 4-7.5z"/><path d="M5 17.5h14M7 20.5h10"/>'),
  word: S('<path d="M6 19V5h7a4 4 0 010 8H6M12 13l5 6"/>'),
  role: S('<circle cx="9" cy="8" r="2.6"/><circle cx="16.5" cy="9" r="2.1"/><path d="M3.5 19c.5-3.3 2.6-5.3 5.5-5.3s5 2 5.5 5.3M14.5 14.2c2.6-.3 4.8 1.4 5.5 4.8"/>'),
  command: S('<path d="M8 8h8v8H8z"/><path d="M8 8V6a2 2 0 10-2 2h2M16 8V6a2 2 0 112 2h-2M8 16v2a2 2 0 11-2-2h2M16 16v2a2 2 0 102-2h-2"/>'),
  voice: S('<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3"/>'),
  sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'),
  rise: S('<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>'),
  sink: S('<path d="M12 5v13M6.5 12.5L12 18l5.5-5.5"/>'),
  ahead: S('<path d="M12 20V5M7 10l5-5 5 5"/><circle cx="12" cy="20" r="1" fill="currentColor"/>'),
  key: S('<rect x="3.5" y="6.5" width="17" height="11" rx="2"/><path d="M7 10h1M10.5 10h1M14 10h1M17 10h.5M8 14h8"/>'),
  pad: S('<path d="M7.5 8h9a4 4 0 013.9 3.1l.9 4.3a2.4 2.4 0 01-4.2 2l-1.6-1.9h-7l-1.6 1.9a2.4 2.4 0 01-4.2-2l.9-4.3A4 4 0 017.5 8z"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".6" fill="currentColor"/><circle cx="17" cy="13.5" r=".6" fill="currentColor"/>'),
  touch: S('<path d="M9.5 11V5.5a1.5 1.5 0 013 0V11M12.5 10V8.5a1.5 1.5 0 013 0V12M15.5 11a1.5 1.5 0 013 0v3.5a6 6 0 01-6 6h-1a6 6 0 01-4.6-2.2L4 15a1.6 1.6 0 012.4-2.1L9.5 15"/>'),
  sr: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15 8.5h5M15 12h5M15 15.5h5"/>'),
};

/** an icon element: name from ICONS, or an SVG string (modules) */
export function ico(name, cls = '') {
  const svg = ICONS[name] || (typeof name === 'string' && name.trim().startsWith('<svg') ? name : '');
  return h(`span.ico${cls ? `.${cls}` : ''}`, { html: svg, 'aria-hidden': 'true' });
}
