// Player input: keyboard (WASD/arrows, Shift, F, Space/E, Q/C), mouse look with pointer lock (drag-look
// fallback), touch (left virtual joystick, right-side drag look, two-finger tap toggles run), gamepad.
// The input never moves the camera itself: it fills `state` and calls onLook(dYaw, dPitch) in radians.

const MOVE_KEYS = {
  KeyW: ['fwd', 1], ArrowUp: ['fwd', 1], KeyS: ['fwd', -1], ArrowDown: ['fwd', -1],
  KeyA: ['strafe', -1], KeyD: ['strafe', 1], ArrowLeft: ['turn', -1], ArrowRight: ['turn', 1],
  Space: ['up', 1], KeyE: ['up', 1], KeyQ: ['up', -1], KeyC: ['up', -1],
};

export function createInput(ctx, { onLook, onToggleFly, onIntent }) {
  const canvas = ctx.renderer?.domElement || document.getElementById('scene');
  const doc = canvas.ownerDocument || document;
  const keys = new Set();
  const state = {
    fwd: 0, strafe: 0, up: 0, turn: 0, // -1..1
    run: false, // Shift / gamepad / touch latch
    touchRun: false,
    enabled: true,
    locked: false,
    usingTouch: false,
  };
  const listeners = [];
  const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); listeners.push(() => el.removeEventListener(type, fn, opts)); };

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

  const look = (dx, dy, base) => {
    const k = base * sens();
    onLook(-dx * k, -dy * k * (invert() ? -1 : 1));
  };

  // ---------- keyboard ----------
  const typing = (t) => !!t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
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
  on(window, 'keydown', (e) => {
    if (!state.enabled || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (e.code === 'KeyF' && !e.repeat) { onToggleFly(); onIntent('fly'); return; }
    if (e.code === 'Escape') { onIntent('escape'); return; }
    if (MOVE_KEYS[e.code] || e.code.startsWith('Shift')) {
      // Space on a focused button would click it: only steal it when nothing interactive has focus
      if (e.code === 'Space' && doc.activeElement && doc.activeElement !== doc.body && doc.activeElement !== canvas) return;
      keys.add(e.code);
      recompute();
      if (MOVE_KEYS[e.code]) { onIntent('key'); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); }
    }
  });
  on(window, 'keyup', (e) => { if (keys.delete(e.code)) recompute(); });
  on(window, 'blur', () => { keys.clear(); recompute(); });

  // ---------- mouse: pointer lock, drag-look fallback ----------
  // lockFailed: drag-look fallback; retried after 1.5 s (browsers refuse a re-lock right after Esc)
  let dragging = false, lockFailed = 0;
  const failLock = () => { lockFailed = performance.now(); };
  on(canvas, 'pointerdown', (e) => {
    if (!state.enabled || e.pointerType !== 'mouse' || e.button !== 0) return;
    doc.activeElement?.blur?.();
    if (!state.locked && performance.now() - lockFailed > 1500 && canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(failLock);
      } catch { failLock(); }
    }
    dragging = true;
  });
  on(window, 'pointerup', (e) => { if (e.pointerType === 'mouse') dragging = false; });
  on(doc, 'pointerlockchange', () => { state.locked = doc.pointerLockElement === canvas; if (state.locked) lockFailed = 0; });
  on(doc, 'pointerlockerror', failLock);
  // Pointer-lock spike filter. Browsers occasionally report one absurd movementX/Y; a genuine fast turn on a
  // slow device (one coalesced event per 70–100 ms frame) is large too, but comes with large neighbours.
  // `recent` follows the event magnitude (fed by every event, so a sustained flick passes in full from its
  // second event). Over 250 px: kept if in line with recent motion, else clamped to 250; over 1000 px and
  // isolated: dropped.
  let recent = 0;
  on(doc, 'mousemove', (e) => {
    if (!state.enabled) return;
    if (!state.locked && !(dragging && (e.buttons & 1))) return;
    let dx = e.movementX || 0, dy = e.movementY || 0;
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    const ref = recent;
    recent = recent * 0.4 + Math.min(m, 1500) * 0.6;
    if (m > 250 && m > 4 * ref) {
      if (m > 1000) return;
      dx *= 250 / m; dy *= 250 / m;
    }
    if (dx || dy) { look(dx, dy, 0.0022); if (Math.abs(dx) + Math.abs(dy) > 1) onIntent('look'); }
  });

  // ---------- touch: left joystick, right look, two-finger tap ----------
  const touchUI = createTouchUI(ctx);
  const touches = new Map(); // pointerId -> { role, x0, y0, x, y, t0 }
  let joyId = null, joyX = 0, joyY = 0;
  let tapCandidate = null; // { ids:Set, t0, moved }
  const joyRadius = () => Math.max(44, Math.min(70, Math.min(innerWidth, innerHeight) * 0.12));
  on(canvas, 'pointerdown', (e) => {
    if (!state.enabled || e.pointerType === 'mouse') return;
    state.usingTouch = true;
    canvas.setPointerCapture?.(e.pointerId);
    const t = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), role: 'look' };
    if (joyId === null && e.clientX < innerWidth * 0.45) { t.role = 'joy'; joyId = e.pointerId; touchUI.show(t.x0, t.y0, joyRadius()); }
    touches.set(e.pointerId, t);
    // two-finger tap detection
    if (touches.size === 2) {
      const all = [...touches.values()];
      if (Math.abs(all[0].t0 - all[1].t0) < 300) tapCandidate = { ids: new Set(touches.keys()), t0: performance.now(), moved: false, up: 0 };
    } else if (touches.size > 2) tapCandidate = null;
  });
  on(canvas, 'pointermove', (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    t.x = e.clientX; t.y = e.clientY;
    if (tapCandidate?.ids.has(e.pointerId) && Math.hypot(t.x - t.x0, t.y - t.y0) > 14) tapCandidate.moved = true;
    if (t.role === 'joy') {
      const r = joyRadius();
      let jx = (t.x - t.x0) / r, jy = (t.y - t.y0) / r;
      const m = Math.hypot(jx, jy);
      if (m > 1) { jx /= m; jy /= m; }
      joyX = jx; joyY = jy;
      touchUI.knob(jx * r, jy * r, state.touchRun);
    } else if (!tapCandidate || tapCandidate.moved) {
      look(dx, dy, 0.0048);
      if (Math.abs(t.x - t.x0) + Math.abs(t.y - t.y0) > 6) onIntent('touch');
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
        if (!tapCandidate.moved && performance.now() - tapCandidate.t0 < 350) {
          state.touchRun = !state.touchRun;
          touchUI.flash(state.touchRun ? 'Run' : 'Walk');
        }
        tapCandidate = null;
      }
    }
  };
  on(canvas, 'pointerup', endTouch);
  on(canvas, 'pointercancel', endTouch);

  // ---------- gamepad ----------
  let pads = 0, prevY = false;
  on(window, 'gamepadconnected', () => { pads++; });
  on(window, 'gamepaddisconnected', () => { pads = Math.max(0, pads - 1); });
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);

  /** Poll per frame. dt seconds. */
  function update(dt) {
    let fwd = kb.fwd, strafe = kb.strafe, up = kb.up, turn = kb.turn, run = kb.run;
    if (joyId !== null) {
      const m = Math.hypot(joyX, joyY);
      if (m > 0.12) { fwd = -joyY; strafe = joyX; onIntent('touch'); }
      run = run || state.touchRun;
    }
    if (state.enabled && pads && navigator.getGamepads) {
      for (const gp of navigator.getGamepads()) {
        if (!gp || !gp.connected) continue;
        const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
        if (lx || ly) { strafe = lx; fwd = -ly; onIntent('pad'); }
        if (rx || ry) { look(rx * 900 * dt, ry * 700 * dt, 0.0022); onIntent('pad'); }
        const b = (i) => !!gp.buttons[i]?.pressed;
        if (b(10) || b(6)) run = true;
        if (b(0) || b(5)) up = 1; else if (b(1) || b(4)) up = -1;
        const y = b(3);
        if (y && !prevY) { onToggleFly(); onIntent('fly'); }
        prevY = y;
        break;
      }
    }
    state.fwd = Math.max(-1, Math.min(1, fwd));
    state.strafe = Math.max(-1, Math.min(1, strafe));
    state.up = up; state.turn = turn; state.run = run;
    if (turn) onLook(-turn * 1.6 * dt, 0);
  }

  function setEnabled(v) {
    state.enabled = !!v;
    if (!v) {
      keys.clear(); recompute();
      joyId = null; joyX = joyY = 0; touches.clear(); touchUI.hide();
      if (state.locked) doc.exitPointerLock?.();
    }
  }

  function dispose() { listeners.forEach((f) => f()); touchUI.dispose(); }

  return { state, update, setEnabled, dispose, unlock: () => doc.exitPointerLock?.() };
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
