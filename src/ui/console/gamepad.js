// Gamepad in the console (console §6.1, standard mapping): Start (9) opens / closes the Menu, View (8) the map. In the
// Menu: D-pad / left stick ↑↓ move focus within the region, ←→ between rail and content (or between tiles), LB/RB the
// sections, A activates, B goes back then closes, X the focused row's Show me, Y its Go; the right stick scrolls; LT/RT
// on Time step the clock by 1/12 hour. During a trip with the Menu closed, D-pad ←→ change the pace. Repeat 400 ms, then
// 90 ms. The player reads no pad input while the Menu is open (setInputEnabled({ pad: false })).
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select:not([disabled]), [tabindex="0"]';
const REPEAT0 = 400, REPEAT = 90;

export function createGamepad(app) {
  const { ctx } = app;
  let pads = 0;
  addEventListener('gamepadconnected', () => { pads++; });
  addEventListener('gamepaddisconnected', () => { pads = Math.max(0, pads - 1); });
  const prev = new Map(); // button index -> pressed
  const held = new Map(); // logical key -> { since, next }

  const visible = (e) => e.getClientRects().length && !e.closest('[hidden], [inert], .is-hidden');
  const regionEls = () => {
    const m = app.menuEl;
    if (!m) return [];
    return [m.querySelector('.mk-rail:not([hidden])'), m.querySelector('.mk-menu__view.is-current'), m.querySelector('.mk-head')].filter((x) => x && visible(x));
  };
  function focusables(region) { return [...region.querySelectorAll(FOCUSABLE)].filter(visible); }
  function moveFocus(d) {
    const regs = regionEls();
    const a = document.activeElement;
    let reg = regs.find((r) => r.contains(a)) || regs.find((r) => r.matches('.mk-menu__view')) || regs[0];
    if (!reg) return;
    const list = focusables(reg);
    if (!list.length) return;
    const i = list.indexOf(a);
    const n = list[i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + d))];
    n.focus({ preventScroll: false });
    n.scrollIntoView?.({ block: 'nearest' });
  }
  function switchRegion(d) {
    const regs = regionEls();
    if (!regs.length) return;
    const a = document.activeElement;
    // a grid of tiles: ← → move between tiles
    if (a?.closest('.mk-tiles')) { moveFocus(d); return; }
    const i = Math.max(0, regs.findIndex((r) => r.contains(a)));
    const r = regs[(i + d + regs.length) % regs.length];
    // the selected tab on the rail; otherwise the first visible control (the header's selected option is a closed
    // popover's: hidden)
    const sel = [...r.querySelectorAll('[aria-selected=true]')].find(visible);
    const f = sel || focusables(r)[0];
    f?.focus();
    f?.scrollIntoView?.({ block: 'nearest' });
  }
  function rowAct(act) {
    const a = document.activeElement;
    const row = a?.closest('.mk-row, .mk-card, .mk-sres');
    row?.querySelector(`[data-act="${act}"]`)?.click();
  }

  function press(i, gp) {
    app.input.setPad(gp.id);
    app.beacon?.wake('pad');
    const open = app.menuOpen();
    if (i === 9) { if (open) app.close(); else app.openMenu({ from: null }); return; }
    if (i === 8) { app.toggle('map'); return; }
    if (!open) {
      if (app.travel.trip && (i === 14 || i === 15)) { if (i === 14) app.travel.slower(); else app.travel.faster(); }
      return;
    }
    switch (i) {
      case 0: { const a = document.activeElement; if (a && a !== document.body && app.menuEl.contains(a)) a.click(); else moveFocus(0); break; }
      case 1: app.back(); break;
      case 2: rowAct('show'); break;
      case 3: rowAct('go'); break;
      case 4: app.stepSection(-1); break;
      case 5: app.stepSection(1); break;
      case 6: case 7: if (app.section === 'time') app.stepClock(i === 6 ? -1 / 12 : 1 / 12); break;
      default: break;
    }
  }
  /** repeat a held direction: 400 ms, then every 90 ms */
  function repeat(key, on, now, fn) {
    const h0 = held.get(key);
    if (!on) { held.delete(key); return; }
    if (!h0) { held.set(key, { next: now + REPEAT0 }); fn(); return; }
    if (now >= h0.next) { h0.next = now + REPEAT; fn(); }
  }

  return {
    tick(dt) {
      if (!pads || !navigator.getGamepads) return;
      const gp = [...navigator.getGamepads()].find((g) => g && g.connected);
      if (!gp) return;
      const now = performance.now();
      const b = (i) => !!gp.buttons[i]?.pressed;
      for (let i = 0; i < Math.min(17, gp.buttons.length); i++) {
        const p = b(i);
        if (p && !prev.get(i) && i !== 12 && i !== 13 && !(app.menuOpen() && (i === 14 || i === 15))) press(i, gp);
        prev.set(i, p);
      }
      if (!app.menuOpen()) { held.clear(); return; }
      if (gp.buttons.some((x) => x?.pressed)) app.input.setPad(gp.id);
      const ly = gp.axes[1] || 0, lx = gp.axes[0] || 0, ry = gp.axes[3] || 0;
      repeat('up', b(12) || ly < -0.6, now, () => moveFocus(-1));
      repeat('down', b(13) || ly > 0.6, now, () => moveFocus(1));
      repeat('left', b(14) || lx < -0.6, now, () => switchRegion(-1));
      repeat('right', b(15) || lx > 0.6, now, () => switchRegion(1));
      if (Math.abs(ry) > 0.2) {
        if (app.section === 'map' && app.mapPan) app.mapPan(0, -ry * 600 * dt);
        else {
          // the current view scrolls itself (or, in a view that does not, its first scrolling part)
          const v = app.menuEl.querySelector('.mk-menu__view.is-current');
          const sc = v && (v.scrollHeight > v.clientHeight + 1 ? v : v.querySelector('.mk-scroll, [data-scroll]'));
          sc?.scrollBy(0, ry * 900 * dt);
        }
      }
    },
  };
}
