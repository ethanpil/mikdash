// Last input → #ui-root[data-input] = mouse | touch | keyboard | pad (console §1.1: key caps follow the last input).
// The gamepad module reports pad input through set('pad'); PlayStation pads swap the glyphs (padKind 'ps').

const PS = /054c|playstation|dualsense|dualshock/i;

/** key caps per input for the console's controls; null = none shown */
const CAPS = {
  menu: { mouse: 'Esc', keyboard: 'Esc', pad: { xbox: '☰', ps: 'Options' }, touch: null },
  map: { mouse: 'M', keyboard: 'M', pad: { xbox: 'View', ps: 'Create' }, touch: null },
  time: { mouse: 'T', keyboard: 'T', pad: null, touch: null },
  here: { mouse: 'I', keyboard: 'I', pad: null, touch: null },
  search: { mouse: '/', keyboard: '/', pad: null, touch: null },
  help: { mouse: '?', keyboard: '?', pad: null, touch: null },
  pause: { mouse: 'P', keyboard: 'P', pad: null, touch: null },
  close: { mouse: 'Esc', keyboard: 'Esc', pad: { xbox: 'B', ps: '○' }, touch: null },
  inspect: { mouse: 'E', keyboard: 'E', pad: { xbox: 'X', ps: '□' }, touch: null },
  go: { mouse: null, keyboard: null, pad: { xbox: 'Y', ps: '△' }, touch: null },
  show: { mouse: null, keyboard: null, pad: { xbox: 'X', ps: '□' }, touch: null },
  slower: { mouse: '−', keyboard: '−', pad: '◀', touch: null },
  faster: { mouse: '+', keyboard: '+', pad: '▶', touch: null },
};

export function createInputMode(root, { coarse }) {
  let mode = coarse ? 'touch' : 'mouse';
  let padKind = 'xbox';
  const subs = new Set();
  const set = (m) => {
    if (m === mode) return;
    mode = m;
    root.dataset.input = m;
    for (const f of subs) { try { f(m); } catch (e) { console.error('[ui] input mode', e); } }
  };
  root.dataset.input = mode;
  // the mouse is told by pointer events of type 'mouse' only: mobile browsers fire a compatibility mousemove at every
  // tap, which must not turn a phone's key caps into Esc / T / M. A tiny jitter is not a switch either (a pad user's desk)
  let mx = null, my = null, touchAt = -1e9;
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    // (with the pointer captured the position stands still; movementX / Y carry the motion)
    const moved = document.pointerLockElement ? Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)
      : mx === null ? 0 : Math.abs(e.screenX - mx) + Math.abs(e.screenY - my);
    mx = e.screenX; my = e.screenY;
    if (moved > 6 && performance.now() - touchAt > 800) set('mouse');
  }, { passive: true, capture: true });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { if (performance.now() - touchAt > 800) set('mouse'); return; }
    touchAt = performance.now();
    set('touch');
  }, { passive: true, capture: true });
  const textField = (t) => !!t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  addEventListener('keydown', (e) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    // a soft keyboard typing into the search (or composing) says nothing about the device in hand
    if (e.isComposing || e.key === 'Unidentified' || e.key === 'Process' || ((mode === 'touch') && textField(e.target))) return;
    // movement keys say "mouse & keyboard", not a keyboard-only user; Tab and arrows in the UI do
    if (/^(Tab|Arrow|Enter|Escape| )/.test(e.key) || e.key === 'Tab') set('keyboard');
    else if (mode === 'touch' || mode === 'pad') set('mouse');
  }, { capture: true });
  return {
    get mode() { return mode; },
    get padKind() { return padKind; },
    set,
    setPad(id) { padKind = PS.test(id || '') ? 'ps' : 'xbox'; set('pad'); },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** the key cap to print on a control for the active device, or null */
    cap(name) {
      const c = CAPS[name]?.[mode === 'keyboard' ? 'keyboard' : mode];
      if (c && typeof c === 'object') return c[padKind];
      return c ?? null;
    },
  };
}
