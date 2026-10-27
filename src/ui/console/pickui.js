// Pointing at people and things (console §4.1), on the inspect core (ctx.inspect: pick, pickCenter, hover, anchorOf).
// Pointer free: hover shows a name tooltip, a pointer cursor and a DOM ring at the subject's feet. Pointer locked or a
// gamepad: the centre reticle with its prompt "Kohen · slaughtering [E] Inspect". Click / tap / E / pad X picks; several
// candidates under the point give a chooser. Without the inspect core none of this shows.
import { Vector3 } from 'three';
import { h, setText } from '../dom.js';

const HOVER_HZ = 10, CENTER_HZ = 5, RING_HZ = 30;

export function createPickUI(app) {
  const { ctx } = app;
  const canvas = ctx.renderer?.domElement || document.getElementById('scene');
  const tip = h('div.mk-ptip', { 'aria-hidden': 'true' });
  const ring = h('div.mk-ring', { 'aria-hidden': 'true' });
  const reticle = h('div.mk-reticle', { 'aria-hidden': 'true' }, h('i'));
  const promptTxt = h('span');
  const promptCap = h('span.mk-kbd');
  const prompt = h('div.mk-rprompt', { 'aria-hidden': 'true' }, promptTxt, promptCap, h('span.mk-rprompt__v', 'Inspect'));
  // the chooser is mounted at the root (app.js), above the Menu: from a tap just above a phone sheet it must not open
  // under it
  const chooser = h('div.mk-chooser.mk-pop.mk-live', { role: 'dialog', 'aria-label': 'Several here', hidden: true });
  const live = h('div.sr-only', { 'aria-live': 'polite' });
  const el = h('div.mk-picklayer', ring, reticle, prompt, tip, live);
  const v = new Vector3();

  const ins = () => ctx.inspect;
  let hoverHit = null, mouse = null, hoverAcc = 0, centerAcc = 0, ringAcc = 0, centerHit = null, ringRef = null, ahead = null, chooseRef = null;
  /** a chooser row's subject: the ring moves to it now */
  function markChoice(ref) { chooseRef = ref; ringRef = ref; placeRing(); }

  // ---------------- hover (pointer free) ----------------
  canvas?.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse = { x: e.clientX, y: e.clientY, buttons: e.buttons };
  }, { passive: true });
  canvas?.addEventListener('pointerleave', () => { mouse = null; setHover(null); });
  function setHover(hit) {
    hoverHit = hit;
    const on = !!hit;
    if (canvas) canvas.style.cursor = on ? 'pointer' : '';
    tip.classList.toggle('in', on);
    if (on) {
      setText(tip, hit.label?.en || '');
      tip.style.transform = `translate(${Math.round(mouse.x + 14)}px, ${Math.round(mouse.y + 16)}px)`;
    }
  }

  // ---------------- pick ----------------
  /**
   * pick at client px (or the centre); opens the card, a chooser, or (touch, nothing) wakes the beacon. E (source 'key')
   * also announces "Ahead: …" for screen readers; announceOnly (the "What's ahead?" command) only announces it.
   * fromWorld: picked in the world (a card opened with the dock closed is the Menu's only level)
   */
  function pickAt(x, y, { source = 'click', pointerType = 'mouse', places = true, announceOnly = false, fromWorld = false } = {}) {
    const I = ins();
    if (!I?.pick) return false;
    let hit = null;
    try { hit = Number.isFinite(x) ? I.pick(x, y) : I.pickCenter(); } catch (e) { console.error('[ui] pick', e); }
    // a tap or a free click on bare floor or wall is empty scenery (it wakes the beacon); E and an aimed click open the place
    if (hit && !places && hit.kind === 'place') hit = null;
    if (!hit) {
      if (pointerType !== 'mouse') app.beacon?.wake('tap');
      return false;
    }
    if (announceOnly) {
      ahead = hit;
      say(`Ahead: ${hit.label?.en || 'something'}. Press Enter for details.`);
      return true;
    }
    // E opens the card like a click; with a screen reader it also says what it is
    if (source === 'key') say(`Ahead: ${hit.label?.en || 'something'}.`);
    if (hit.alternatives?.length) { choose(hit, x, y, fromWorld); return true; }
    app.card(hit, { fromWorld });
    return true;
  }
  /** degrees right (+) or left (−) of the view's centre line, from the hit's world point (else its screen point) */
  function yawOf(c) {
    const cam = ctx.camera;
    let nx = null;
    if (c.world && cam) { v.copy(c.world).project(cam); if (v.z < 1) nx = v.x; }
    if (nx === null && c.screen) nx = (c.screen.x / innerWidth) * 2 - 1;
    if (nx === null || !cam) return null;
    const tanH = Math.tan(((cam.fov || 60) * Math.PI) / 360) * (cam.aspect || innerWidth / innerHeight);
    return (Math.atan(nx * tanH) * 180) / Math.PI;
  }
  const sideOf = (a) => {
    const s = a < 0 ? 'left' : 'right', m = Math.abs(a);
    return m < 3 ? 'ahead' : m < 10 ? `slightly ${s}` : m < 25 ? s : `far ${s}`;
  };
  /**
   * "Woman · 6 m"; rows still alike get, in turn, their bearing ("slightly left"), the distance to 0.5 m, then an
   * ordinal (nearest first), so no two rows read the same
   */
  function optionLabels(all) {
    const rows = all.map((c) => ({ c, name: c.label?.en || c.ref, dist: Number.isFinite(c.distance) ? `${Math.max(1, Math.round(c.distance))} m` : '', side: '', n: '' }));
    const text = (r) => [r.name, r.dist, r.side, r.n].filter(Boolean).join(' · ');
    const alike = () => {
      const by = new Map();
      for (const r of rows) { const k = text(r); by.set(k, [...(by.get(k) || []), r]); }
      return [...by.values()].filter((g) => g.length > 1);
    };
    for (const g of alike()) for (const r of g) { const a = yawOf(r.c); if (a !== null) r.side = sideOf(a); }
    for (const g of alike()) for (const r of g) if (Number.isFinite(r.c.distance)) r.dist = `${(Math.round(r.c.distance * 2) / 2).toFixed(1)} m`;
    for (const g of alike()) g.forEach((r, i) => { r.n = `#${i + 1}`; });
    return rows.map(text);
  }
  function choose(hit, x, y, fromWorld) {
    const all = [hit, ...hit.alternatives].slice(0, 5);
    // a captured mouse could not point at the options: free it first (the app caused this unlock)
    if (ctx.player?.locked) { app.expectUnlock?.(); try { ctx.player.unlock?.(); } catch { /* ignore */ } }
    const labels = optionLabels(all);
    // the row under focus or the pointer rings its subject in the world, so look-alikes can be told apart by sight
    chooser.replaceChildren(h('p.mk-chooser__h', `${all.length} here:`), ...all.map((c, i) => h('button.mk-pop__opt', {
      type: 'button', 'data-ref': c.ref,
      on: { click: () => { chooser.hidden = true; chooseRef = null; app.card(c, { fromWorld }); }, focus: () => markChoice(c.ref), pointerenter: () => markChoice(c.ref) },
    }, labels[i])));
    chooser.hidden = false;
    // inside the free area (above a phone sheet, beside the dock)
    const f = app.layout.free;
    const cx = Number.isFinite(x) ? x : innerWidth / 2, cy = Number.isFinite(y) ? y : innerHeight / 2;
    const w = chooser.offsetWidth || 260, hgt = chooser.offsetHeight || 220;
    const maxX = innerWidth - f.r - w - 8, maxY = innerHeight - f.b - hgt - 8;
    chooser.style.left = `${Math.max(f.l + 8, Math.min(maxX, cx + 10))}px`;
    chooser.style.top = `${Math.max(f.t + 8, Math.min(maxY, cy + 10 + hgt > innerHeight - f.b ? cy - hgt - 10 : cy + 10))}px`;
    chooser.querySelector('button')?.focus({ preventScroll: true });
  }
  document.addEventListener('pointerdown', (e) => { if (!chooser.hidden && !chooser.contains(e.target)) chooser.hidden = true; }, true);
  chooser.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); chooser.hidden = true; } });
  // E with a screen reader: "Press Enter for details"
  addEventListener('keydown', (e) => {
    if (!ahead) return;
    if (e.key !== 'Enter') { if (!['Shift', 'Control', 'Alt', 'Meta', 'e', 'E'].includes(e.key)) ahead = null; return; }
    if (e.target.closest?.('#ui-root button, #ui-root input, #ui-root a')) return;
    const hit = ahead;
    ahead = null;
    e.preventDefault();
    app.card(hit);
  });
  const say = (t) => { setText(live, ''); requestAnimationFrame(() => setText(live, t)); };

  // ---------------- ring ----------------
  function placeRing() {
    const ref = ringRef;
    const I = ins();
    if ((ring.dataset.ref || '') !== (ref || '')) ring.dataset.ref = ref || '';
    if (!ref || !I?.anchorOf || !ctx.camera) { ring.classList.remove('in'); return; }
    let p = null;
    try { p = I.anchorOf(ref); } catch { p = null; }
    if (!p) { ring.classList.remove('in'); return; }
    const cam = ctx.camera;
    v.copy(p).project(cam);
    if (v.z >= 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { ring.classList.remove('in'); return; }
    const d = Math.max(0.5, cam.position.distanceTo(p));
    const fpx = innerHeight / 2 / Math.tan((cam.fov * Math.PI) / 360);
    const w = Math.max(14, Math.min(260, (1.1 / d) * fpx));
    const x = (v.x + 1) * 0.5 * innerWidth, y = (1 - v.y) * 0.5 * innerHeight;
    ring.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - w * 0.18).toFixed(1)}px) scale(${(w / 100).toFixed(3)}, ${(w / 100 * 0.36).toFixed(3)})`;
    ring.classList.add('in');
  }

  // ---------------- tick ----------------
  function tick(dt) {
    const I = ins();
    const usable = !!I?.pick && !app.welcomeOpen?.();
    el.classList.toggle('is-off', !usable);
    if (!usable) return;
    const locked = !!ctx.player?.locked;
    const pad = app.input.mode === 'pad';
    // hover, pointer free
    hoverAcc += dt;
    if (!locked && mouse && !mouse.buttons && hoverAcc >= 1 / HOVER_HZ && I.hover) {
      hoverAcc = 0;
      let hit = null;
      try { hit = I.hover(mouse.x, mouse.y); } catch { hit = null; }
      setHover(hit);
    } else if (locked && hoverHit) setHover(null);
    // reticle + prompt, locked or pad
    const showRet = (locked || pad) && !app.menuOpen?.();
    reticle.classList.toggle('in', showRet);
    centerAcc += dt;
    if (showRet && centerAcc >= 1 / CENTER_HZ) {
      centerAcc = 0;
      const vel = ctx.player?.velocity;
      const fast = vel && Math.hypot(vel.x, vel.z) > 2.2;
      if (!fast) { try { centerHit = I.pickCenter?.() || null; } catch { centerHit = null; } }
      const txt = centerHit?.label?.en || '';
      setText(promptTxt, txt);
      setText(promptCap, app.input.cap('inspect') || 'E');
      prompt.classList.toggle('in', !!txt);
    } else if (!showRet) prompt.classList.remove('in');
    // the ring: under the hovered subject, else the subject of the open card
    ringAcc += dt;
    if (ringAcc >= 1 / RING_HZ) {
      ringAcc = 0;
      const cardRef = app.cardRef?.();
      if (chooser.hidden) chooseRef = null;
      ringRef = chooseRef || hoverHit?.ref || (cardRef && /^(actor|crowd|el|fire):/.test(cardRef) ? cardRef : null);
      placeRing();
    }
  }

  return { el, chooser, tick, pickAt, get hover() { return hoverHit; } };
}
