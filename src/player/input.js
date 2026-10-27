// Player input: keyboard (WASD/arrows, Shift, F, Space/Q/C, E inspects), mouse look with pointer lock (drag-look
// fallback, or `lookMode: 'drag'`), touch (left virtual joystick, right-side drag look, two-finger tap toggles run, a
// short tap anywhere is a tap), gamepad (sticks, run, fly, X inspects, B stops a walking trip).
// The input never moves the camera itself: it fills `state` and calls onLook(dYaw, dPitch) in radians, onIntent(kind)
// ('move' | 'look' | 'fly' | 'escape' | 'tap'), onInspect({ source, x?, y? }) and onTap({ x, y, pointerType })
// (docs/console-design.md §6.3.1).

const MOVE_KEYS = {
  KeyW: ['fwd', 1], ArrowUp: ['fwd', 1], KeyS: ['fwd', -1], ArrowDown: ['fwd', -1],
  KeyA: ['strafe', -1], KeyD: ['strafe', 1], ArrowLeft: ['turn', -1], ArrowRight: ['turn', 1],
  Space: ['up', 1], KeyQ: ['up', -1], KeyC: ['up', -1],
};
/** keys the Menu uses while focus is inside it (§2.3): the player leaves them alone then */
const UI_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Home', 'End', 'PageUp', 'PageDown']);
/** a click / tap: shorter than this (ms) and moving less than CLICK_PX (mouse) / TAP_PX (touch) */
const TAP_MS = 300, CLICK_PX = 5, TAP_PX = 10;
/** the joystick appears after this much movement (px) or hold (ms), so a quick tap neither flashes it nor moves */
const JOY_PX = 10, JOY_MS = 150;
const FIELDS = ['keys', 'move', 'look', 'pointerLock', 'pad', 'touch'];

export function createInput(ctx, { onLook, onToggleFly, onIntent, onInspect = () => {}, onTap = () => {}, onPadBack = () => {} }) {
  const canvas = ctx.renderer?.domElement || document.getElementById('scene');
  const doc = canvas.ownerDocument || document;
  const keys = new Set();
  const en = { keys: true, move: true, look: true, pointerLock: true, pad: true, touch: true };
  const state = {
    fwd: 0, strafe: 0, up: 0, turn: 0, // -1..1
    run: false, // Shift / gamepad / touch latch
    touchRun: false,
    /** any input enabled (the boolean form of setEnabled) */
    get enabled() { return FIELDS.some((k) => en[k]); },
    locked: false,
    usingTouch: false,
  };
  const listeners = [];
  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); listeners.push(() => el.removeEventListener(type, fn, opts)); };
  let lockFilter = null;
  let vertical = 0; // setVertical: touch Rise / Sink

  // ---------- settings ----------
  const setting = (...names) => {
    for (const n of names) {
      try { const v = ctx.settings?.get?.(n); if (v !== undefined && v !== null) return v; } catch { /* ignore */ }
    }
    return undefined;
  };
  const sens = () => {
    const s = Number(setting('mouseSensitivity', 'sensitivity', 'lookSensitivity'));
    return Number.isFinite(s) && s > 0 ? s : 1;
  };
  const invert = () => { const v = setting('invertY', 'invertMouse', 'invert'); return v === true || v === 'true' || v === 1; };
  const dragMode = () => setting('lookMode') === 'drag';

  const look = (dx, dy, base) => {
    const k = base * sens();
    onLook(-dx * k, -dy * k * (invert() ? -1 : 1));
  };

  // ---------- keyboard ----------
  const typing = (t) => !!t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  /** focus is on a control (inside the UI, or anything focusable that is not the page or the canvas) */
  const uiFocus = () => {
    const a = doc.activeElement;
    return !!a && a !== doc.body && a !== canvas && a !== doc.documentElement;
  };
  const recompute = () => {
    let fwd = 0, strafe = 0, up = 0, turn = 0;
    for (const k of keys) {
      const m = MOVE_KEYS[k];
      if (!m) continue;
      if (m[0] === 'fwd') fwd += m[1]; else if (m[0] === 'strafe') strafe += m[1];
      else if (m[0] === 'up') up += m[1]; else turn += m[1];
    }
    kb.fwd = Math.sign(fwd); kb.strafe = Math.sign(strafe); kb.up = Math.sign(up); kb.turn = Math.sign(turn);
    kb.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  };
  const kb = { fwd: 0, strafe: 0, up: 0, turn: 0, run: false };
  // the last pointer position over the page (E inspects there while the mouse is free)
  // (only over the world: over the Menu, E inspects at the centre)
  let mouseX = null, mouseY = null;
  on(doc, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.target === canvas) { mouseX = e.clientX; mouseY = e.clientY; } else mouseX = mouseY = null;
  }, { passive: true });
  on(window, 'keydown', (e) => {
    if (!en.keys || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (e.code === 'KeyE') {
      if (!e.repeat) onInspect(state.locked || mouseX === null ? { source: 'key' } : { source: 'key', x: mouseX, y: mouseY });
      return;
    }
    if (e.code === 'Escape') { onIntent('escape'); return; }
    if (e.code === 'KeyF') { if (!e.repeat && en.move) { onToggleFly(); onIntent('fly'); } return; }
    if (MOVE_KEYS[e.code] || e.code.startsWith('Shift')) {
      // arrows, Space, Enter… belong to the Menu while focus is inside it (and Space would click a focused button)
      if (UI_KEYS.has(e.code) && uiFocus()) return;
      if (!en.move) return;
      keys.add(e.code);
      recompute();
      const m = MOVE_KEYS[e.code];
      if (m) {
        onIntent(m[0] === 'up' ? 'fly' : 'move');
        if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      }
    }
  });
  on(window, 'keyup', (e) => { if (keys.delete(e.code)) recompute(); });
  on(window, 'blur', () => { keys.clear(); recompute(); });

  // ---------- mouse: pointer lock, drag-look fallback, clicks ----------
  // lockFailed: drag-look fallback; retried after 1.5 s (browsers refuse a re-lock right after Esc)
  let dragging = false, lockFailed = 0, down = null, dragPx = 0;
  const failLock = () => { lockFailed = performance.now(); };
  const stamp = (e) => (e.timeStamp > 0 ? e.timeStamp : performance.now());
  on(canvas, 'pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (!en.look && !en.pointerLock) return;
    doc.activeElement?.blur?.();
    // captured: a click inspects at the reticle (and does not re-lock)
    if (state.locked) { onInspect({ source: 'click' }); return; }
    let lock = en.pointerLock && en.look && !dragMode() && performance.now() - lockFailed > 1500 && !!canvas.requestPointerLock;
    if (lock && lockFilter) { try { lock = lockFilter(e) !== false; } catch { lock = true; } }
    down = { x: e.clientX, y: e.clientY, t: stamp(e), lock };
    if (lock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(failLock);
      } catch { failLock(); }
    }
    dragging = en.look;
    dragPx = 0;
  });
  on(window, 'pointerup', (e) => {
    if (e.pointerType !== 'mouse') return;
    dragging = false;
    const d = down;
    down = null;
    // a short click that did not capture the mouse (refused by the filter, drag mode, Menu open): a tap
    if (!d || state.locked || e.button !== 0) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < CLICK_PX && stamp(e) - d.t < TAP_MS && e.target === canvas) {
      onTap({ x: e.clientX, y: e.clientY, pointerType: 'mouse' });
      onIntent('tap');
    }
  });
  on(doc, 'pointerlockchange', () => {
    state.locked = doc.pointerLockElement === canvas;
    if (state.locked) lockFailed = 0;
  });
  on(doc, 'pointerlockerror', failLock);
  // Pointer-lock spike filter. Browsers occasionally report one absurd movementX/Y; a genuine fast turn on a
  // slow device (one coalesced event per 70–100 ms frame) is large too, but comes with large neighbours.
  // `recent` follows the event magnitude (fed by every event, so a sustained flick passes in full from its
  // second event). Over 250 px: kept if in line with recent motion, else clamped to 250; over 1000 px and
  // isolated: dropped.
  let recent = 0;
  on(doc, 'mousemove', (e) => {
    if (!en.look) return;
    if (!state.locked && !(dragging && (e.buttons & 1))) return;
    let dx = e.movementX || 0, dy = e.movementY || 0;
    if (!state.locked && dragPx < CLICK_PX) {
      // a drag looks once it has moved CLICK_PX (a click's jitter is not a look)
      dragPx += Math.abs(dx) + Math.abs(dy);
      if (dragPx < CLICK_PX) return;
    }
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    const ref = recent;
    recent = recent * 0.4 + Math.min(m, 1500) * 0.6;
    if (m > 250 && m > 4 * ref) {
      if (m > 1000) return;
      dx *= 250 / m; dy *= 250 / m;
    }
    if (dx || dy) { look(dx, dy, 0.0022); if (Math.abs(dx) + Math.abs(dy) > 1) onIntent('look'); }
  });

  // ---------- touch: left joystick, right look, two-finger tap, taps ----------
  const touchUI = createTouchUI(ctx);
  // Times are the events' own timestamps (a frame that blocks the main thread between pointerdown and pointerup must not
  // turn a tap into a hold). The joystick's hold has no event to time it, so it counts frame time, at most HOLD_STEP per
  // frame: a stall cannot by itself hold a touch long enough to become a joystick before its pointerup is read.
  const HOLD_STEP = 50;
  const touches = new Map(); // pointerId -> { role: 'joy-pending'|'joy'|'look', x0, y0, x, y, t0, held, multi, moved }
  let joyId = null, joyX = 0, joyY = 0, lastUpdate = 0;
  let tapCandidate = null; // { ids:Set, t0, moved }
  const joyRadius = () => Math.max(44, Math.min(70, Math.min(innerWidth, innerHeight) * 0.12));
  const startJoy = (id, t) => {
    t.role = 'joy';
    joyId = id;
    touchUI.show(t.x0, t.y0, joyRadius());
    moveJoy(t);
  };
  const moveJoy = (t) => {
    const r = joyRadius();
    let jx = (t.x - t.x0) / r, jy = (t.y - t.y0) / r;
    const m = Math.hypot(jx, jy);
    if (m > 1) { jx /= m; jy /= m; }
    joyX = jx; joyY = jy;
    touchUI.knob(jx * r, jy * r, state.touchRun);
  };
  on(canvas, 'pointerdown', (e) => {
    if (!en.touch || e.pointerType === 'mouse') return;
    state.usingTouch = true;
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already up (a stalled frame) */ }
    const t = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: stamp(e), held: 0, role: 'look', multi: touches.size > 0, moved: false };
    for (const o of touches.values()) o.multi = true;
    if (joyId === null && e.clientX < innerWidth * 0.45 && ![...touches.values()].some((o) => o.role === 'joy-pending')) t.role = 'joy-pending';
    touches.set(e.pointerId, t);
    // two-finger tap detection
    if (touches.size === 2) {
      const all = [...touches.values()];
      if (Math.abs(all[0].t0 - all[1].t0) < 300) tapCandidate = { ids: new Set(touches.keys()), t0: stamp(e), held: 0, moved: false, up: 0 };
    } else if (touches.size > 2) tapCandidate = null;
  });
  on(canvas, 'pointermove', (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    t.x = e.clientX; t.y = e.clientY;
    if (tapCandidate?.ids.has(e.pointerId) && Math.hypot(t.x - t.x0, t.y - t.y0) > 14) tapCandidate.moved = true;
    if (t.role === 'joy-pending' && Math.hypot(t.x - t.x0, t.y - t.y0) >= JOY_PX && (!tapCandidate || tapCandidate.moved)) startJoy(e.pointerId, t);
    if (t.role === 'joy') moveJoy(t);
    else if (t.role === 'look' && en.look && (!tapCandidate || tapCandidate.moved)) {
      look(dx, dy, 0.0048);
      if (Math.abs(t.x - t.x0) + Math.abs(t.y - t.y0) > 6) onIntent('look');
    }
  });
  const endTouch = (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (e.pointerId === joyId) { joyId = null; joyX = joyY = 0; touchUI.hide(); }
    if (tapCandidate?.ids.has(e.pointerId)) {
      tapCandidate.up++;
      if (tapCandidate.up === 2) {
        if (!tapCandidate.moved && stamp(e) - tapCandidate.t0 < 350) {
          state.touchRun = !state.touchRun;
          touchUI.flash(state.touchRun ? 'Run' : 'Walk');
        }
        tapCandidate = null;
      }
    }
    // a single short touch that did not move: a tap (in either zone; a joystick that never moved the observer too)
    if (e.type === 'pointerup' && !t.multi && !t.moved && Math.hypot(t.x - t.x0, t.y - t.y0) < TAP_PX && stamp(e) - t.t0 < TAP_MS) {
      onTap({ x: t.x, y: t.y, pointerType: e.pointerType || 'touch' });
      onIntent('tap');
    }
  };
  on(canvas, 'pointerup', endTouch);
  on(canvas, 'pointercancel', endTouch);

  // ---------- gamepad ----------
  let pads = 0;
  const prev = { x: false, y: false, b: false };
  on(window, 'gamepadconnected', () => { pads++; });
  on(window, 'gamepaddisconnected', () => { pads = Math.max(0, pads - 1); });
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
  // Hand-over: a button (or the left stick) held while the pad belonged to the Menu is ignored until it is released,
  // so the B that closes the Menu is not also a new B for the player (which stops a walking trip), and A / B / LB / RB
  // do not rise or sink for the rest of the hold. Filled every frame while pad input is off, and again on re-enabling.
  const PAD_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 10];
  const padHeld = new Set();
  const firstPad = () => {
    if (!pads || !navigator.getGamepads) return null;
    for (const gp of navigator.getGamepads()) if (gp && gp.connected) return gp;
    return null;
  };
  const leftStick = (gp) => !!(dz(gp.axes[0] || 0) || dz(gp.axes[1] || 0));
  const holdPad = (gp) => {
    if (!gp) return;
    for (const i of PAD_BUTTONS) if (gp.buttons[i]?.pressed) padHeld.add(i);
    if (leftStick(gp)) padHeld.add('ls');
    prev.x = prev.y = prev.b = false;
  };

  /** Poll per frame. dt seconds. */
  function update(dt) {
    let fwd = kb.fwd, strafe = kb.strafe, up = kb.up, turn = kb.turn, run = kb.run;
    const now = performance.now();
    const step = Math.min(HOLD_STEP, Math.max(0, now - (lastUpdate || now)));
    lastUpdate = now;
    if (tapCandidate) tapCandidate.held += step;
    for (const t of touches.values()) t.held += step;
    // a touch on the left held still for JOY_MS is a joystick too
    // (not while it may still be half of a two-finger tap)
    if (joyId === null && touches.size) {
      const twoTap = tapCandidate && !tapCandidate.moved && tapCandidate.held < 350;
      for (const [id, t] of touches) {
        if (t.role === 'joy-pending' && !twoTap && t.held >= JOY_MS) { startJoy(id, t); break; }
      }
    }
    if (joyId !== null && en.move) {
      const m = Math.hypot(joyX, joyY);
      if (m > 0.12) { fwd = -joyY; strafe = joyX; onIntent('move'); const t = touches.get(joyId); if (t) t.moved = true; }
      run = run || state.touchRun;
    }
    if (vertical) up = vertical;
    const gp = firstPad();
    if (gp && !en.pad) holdPad(gp);
    else if (gp) {
      // a held-over input counts again once released
      for (const k of padHeld) if (!(k === 'ls' ? leftStick(gp) : gp.buttons[k]?.pressed)) padHeld.delete(k);
      const lx = padHeld.has('ls') ? 0 : dz(gp.axes[0] || 0), ly = padHeld.has('ls') ? 0 : dz(gp.axes[1] || 0);
      const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      if ((lx || ly) && en.move) { strafe = lx; fwd = -ly; onIntent('move'); }
      if ((rx || ry) && en.look) { look(rx * 900 * dt, ry * 700 * dt, 0.0022); onIntent('look'); }
      const b = (i) => !!gp.buttons[i]?.pressed && !padHeld.has(i);
      if (b(10) || b(6)) run = true;
      if (b(0) || b(5)) up = 1; else if (b(1) || b(4)) up = -1;
      const x = b(2), y = b(3), back = b(1);
      if (x && !prev.x) onInspect({ source: 'pad' });
      if (y && !prev.y && en.move) { onToggleFly(); onIntent('fly'); }
      if (back && !prev.b) onPadBack();
      prev.x = x; prev.y = y; prev.b = back;
    }
    if (!en.move) { fwd = strafe = up = turn = 0; run = false; }
    state.fwd = Math.max(-1, Math.min(1, fwd));
    state.strafe = Math.max(-1, Math.min(1, strafe));
    state.up = up; state.turn = turn; state.run = run;
    if (turn) onLook(-turn * 1.6 * dt, 0);
  }

  function releaseAll() {
    keys.clear(); recompute();
    joyId = null; joyX = joyY = 0; touches.clear(); touchUI.hide();
    vertical = 0;
  }

  /** true / false: all on / all off (and release pointer lock); an object changes only the fields it gives */
  function setEnabled(v) {
    const padWas = en.pad;
    if (v && typeof v === 'object') {
      for (const k of FIELDS) if (k in v) en[k] = !!v[k];
      if (en.pad && !padWas) holdPad(firstPad());
      if (!en.keys && !en.move) { keys.clear(); recompute(); }
      if (!en.touch || !en.move) { joyId = null; joyX = joyY = 0; touchUI.hide(); }
      if (!en.touch) touches.clear();
      if ((!en.pointerLock || !en.look) && state.locked) doc.exitPointerLock?.();
      return;
    }
    for (const k of FIELDS) en[k] = !!v;
    if (en.pad && !padWas) holdPad(firstPad());
    if (!v) {
      releaseAll();
      if (state.locked) doc.exitPointerLock?.();
    }
  }

  /** fly up (1) / down (-1) while held, 0 releases (touch Rise / Sink) */
  function setVertical(v) {
    const n = Math.sign(Number(v) || 0);
    if (n && n !== vertical) onIntent('fly');
    vertical = n;
  }

  function dispose() { listeners.forEach((f) => f()); touchUI.dispose(); }

  return {
    state, update, setEnabled, setVertical, dispose,
    get enabled() { return { ...en }; },
    setLockFilter: (fn) => { lockFilter = typeof fn === 'function' ? fn : null; },
    unlock: () => doc.exitPointerLock?.(),
  };
}

/** Minimal joystick visual (owned by player/): base ring + knob, shown only while the left thumb is down. */
function createTouchUI(ctx) {
  if (ctx.params?.shot || typeof document === 'undefined') {
    return { show() {}, hide() {}, knob() {}, flash() {}, dispose() {} };
  }
  const root = document.createElement('div');
  root.id = 'player-touch';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:4;opacity:0;transition:opacity .15s;';
  const base = document.createElement('div');
  base.style.cssText = 'position:absolute;border-radius:50%;border:1.5px solid rgba(232,220,192,.55);background:rgba(13,11,8,.22);'
    + 'box-shadow:0 0 0 1px rgba(0,0,0,.15) inset;transform:translate(-50%,-50%);';
  const knob = document.createElement('div');
  knob.style.cssText = 'position:absolute;left:0;top:0;width:44%;height:44%;border-radius:50%;background:rgba(232,220,192,.7);'
    + 'transform:translate(-50%,-50%);transition:background .2s;';
  base.appendChild(knob);
  root.appendChild(base);
  const label = document.createElement('div');
  label.style.cssText = 'position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);'
    + 'font:600 12px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#e8dcc0;'
    + 'background:rgba(13,11,8,.55);padding:7px 12px;border-radius:999px;pointer-events:none;opacity:0;transition:opacity .3s;z-index:4;';
  document.body.append(root, label);
  let r = 50, flashT = 0;
  return {
    show(x, y, radius) {
      r = radius;
      base.style.width = base.style.height = `${r * 2}px`;
      base.style.left = `${x}px`; base.style.top = `${y}px`;
      knob.style.left = knob.style.top = '50%';
      root.style.opacity = '1';
    },
    knob(dx, dy, run) {
      knob.style.left = `calc(50% + ${dx}px)`; knob.style.top = `calc(50% + ${dy}px)`;
      knob.style.background = run ? 'rgba(212,166,64,.9)' : 'rgba(232,220,192,.7)';
    },
    hide() { root.style.opacity = '0'; },
    flash(text) {
      label.textContent = text;
      label.style.opacity = '1';
      clearTimeout(flashT);
      flashT = setTimeout(() => { label.style.opacity = '0'; }, 900);
    },
    dispose() { root.remove(); label.remove(); },
  };
}
