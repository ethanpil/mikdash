// Tiny DOM helpers + inline icons (no assets).

/** h('div.cls#id', { attrs, on: {click}, style }, ...children) */
export function h(tag, props, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
  const el = document.createElement(m[1] || 'div');
  for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { children.unshift(props); props = null; }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className += ` ${v}`;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Hebrew text node, isolated and right-to-left */
export function he(text, cls = '') {
  return h(`span.he${cls ? `.${cls}` : ''}`, { lang: 'he', dir: 'rtl' }, text || '');
}

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

/** set textContent only when it changed (avoids layout churn in per-frame updates) */
export function setText(el, text) {
  const s = String(text ?? '');
  if (el.textContent !== s) el.textContent = s;
}

const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
export const ICON = {
  close: svg('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>'),
  info: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 10.5v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7.3" r="1.15" fill="currentColor"/>'),
  map: svg('<path d="M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 4.5v13M15 6.5v13" stroke="currentColor" stroke-width="1.4"/>'),
  settings: svg('<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  pause: svg('<path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" fill="currentColor"/>'),
  back: svg('<path d="M11 6l-6 6 6 6M19 6l-6 6 6 6" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  fwd: svg('<path d="M13 6l6 6-6 6M5 6l6 6-6 6" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  prev: svg('<path d="M14.5 6l-6 6 6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  next: svg('<path d="M9.5 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  walk: svg('<circle cx="13" cy="4.6" r="1.8" fill="currentColor"/><path d="M10.5 21l2-6 2.5 2.5V21M9 12l1.5-4.5 3.5 1 2 3.5M13 8.5l-1.5 6.5" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  clock: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>'),
  pin: svg('<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0113 0c0 4.8-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/>'),
  ext: svg('<path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  stop: svg('<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>'),
  cal: svg('<rect x="4" y="5.5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
};

export function icon(name, cls = '') {
  return h(`span.ico${cls ? `.${cls}` : ''}`, { html: ICON[name] || '' });
}
