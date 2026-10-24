// HUD: location (he + en + sanctity), seasonal-time chip, compass, tool buttons, captions, hints, toasts,
// travel status, the fade veil, and floating tags over active events. Updated from one throttled ticker.
import { Vector3 } from 'three';
import { h, he, icon, setText } from './dom.js';
import { seasonal, seasonalLabel, clock, accessLead, hasCitation } from './format.js';
import { m2w, w2m } from '../core/units.js';
import { LADDER, RESTRICTED_RUNG } from './data.js';

export function createHud(app) {
  const { ctx, data } = app;
  const root = h('div.mk-hud');

  // ---------------- location ----------------
  const locHe = he('', 'mk-loc__he');
  const locEn = h('span.mk-loc__en');
  const rungs = h('span.mk-rungs', { 'aria-hidden': 'true' }, LADDER.map((_, i) => h('i', { style: { height: `${3 + i}px` } })));
  const badgeText = h('span');
  const badge = h('span.mk-loc__badge', rungs, badgeText);
  const loc = h('button.mk-loc.mk-glass.mk-live', {
    type: 'button', 'aria-label': 'About this place (I)', title: 'About this place — I',
    on: { click: () => app.toggle('info') },
  }, locHe, locEn, badge);
  const locLive = h('div.sr-only', { 'aria-live': 'polite' });

  // ---------------- time chip + tools ----------------
  const dialSvg = miniDial();
  const chipMain = h('span.mk-chip__main');
  const barFill = h('i');
  const chipCivil = h('span.num');
  const chipSpeed = h('span.mk-chip__speed');
  const chip = h('button.mk-chip.mk-glass.mk-live', {
    type: 'button', title: 'Time — T', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
    on: { click: () => app.toggle('time') },
  }, dialSvg.el, h('span', chipMain, h('span.mk-chip__sub', h('span.mk-chip__bar', barFill), chipCivil, chipSpeed)));
  const toolBtn = (name, ico, label, key) => h('button.mk-iconbtn.mk-glass.mk-live', {
    type: 'button', 'aria-label': `${label} (${key})`, title: `${label} — ${key}`, 'aria-expanded': 'false', 'data-tool': name,
    on: { click: () => app.toggle(name) },
  }, icon(ico));
  const tools = h('div.mk-tools', toolBtn('info', 'info', 'About this place', 'I'), toolBtn('map', 'map', 'Map', 'M'), toolBtn('settings', 'settings', 'Settings', 'G'),
    toolBtn('about', 'book', 'Method, sources, controls & credits', '?'));
  const tr = h('div.mk-tr', chip, tools);

  // ---------------- compass ----------------
  const PX_PER_DEG = 2.2;
  const strip = h('div.mk-compass__strip');
  const khkMark = h('em', { title: 'Toward Kodesh HaKodashim' });
  for (let d = -180; d <= 540; d += 15) {
    const x = (d + 180) * PX_PER_DEG;
    const n = ((d % 360) + 360) % 360;
    const card = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n];
    const inter = { 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' }[n];
    strip.append(h(`span${n % 45 === 0 ? '.major' : ''}`, { style: { left: `${x}px` } }));
    if (card || inter) strip.append(h(`b${card ? '.card' : ''}`, { style: { left: `${x}px` } }, card || inter));
  }
  strip.append(khkMark);
  const compass = h('div.mk-compass', { 'aria-hidden': 'true' }, strip, h('div.mk-compass__caret'));

  // ---------------- bottom: status, hints, captions ----------------
  const statusText = h('span');
  const statusStop = h('button.mk-btn.mk-btn--sm', { type: 'button', on: { click: () => ctx.player?.cancel?.() } }, icon('stop'), 'Stop');
  const status = h('div.mk-status.mk-glass.mk-live', { hidden: true, role: 'status' }, icon('walk'), statusText, statusStop);
  const touch = matchMedia?.('(pointer: coarse)').matches;
  const hint = (k, t) => h('span', ...k.map((x) => h('span.mk-kbd', x)), t);
  // touch devices get ghost controls where the thumbs go instead of the key bar (which phones have no room for)
  const hints = touch
    ? h('div.mk-touchhint', { 'aria-hidden': 'true' },
      h('div.mk-touchhint__joy', h('i'), h('span', 'Drag to walk')),
      h('div.mk-touchhint__look', h('b', icon('back'), icon('fwd')), h('span', 'Drag to look')),
      h('div.mk-touchhint__pill', 'Two-finger tap: walk / run · tap the clock for the hour'))
    : h('div.mk-hints', { 'aria-hidden': 'true' },
      hint(['W', 'A', 'S', 'D'], 'walk'), hint(['Shift'], 'run'), hint(['T'], 'time'), hint(['I'], 'this place'), hint(['M'], 'map'),
      hint(['Esc'], 'free the mouse'), hint(['?'], 'all controls'));
  hints.hidden = true;
  const captions = h('div.mk-captions', { 'aria-live': 'polite' });
  const bottom = h('div.mk-bottom', status, touch ? null : hints, captions);

  const toasts = h('div.mk-toasts', { 'aria-live': 'polite' });
  const labels = h('div.mk-labels');
  // tags last in the tab order (after the place, the clock and the tools); they paint underneath (z-index -1)
  root.append(loc, locLive, tr, compass, bottom, toasts, labels);
  if (touch) root.append(hints);

  // ---------------- veil (fade for teleports) ----------------
  const veil = h('div.mk-veil', { 'aria-hidden': 'true' });
  document.body.append(veil);
  let veilAnim = null;
  function fade(a, b) {
    // fade(to 0..1, ms) — the player's contract; fade(ms) alone = dip to black, resolve when black, then lift
    let to, ms, dip = false;
    if (b === undefined && a > 1) { to = 1; ms = a; dip = true; } else { to = Math.max(0, Math.min(1, +a || 0)); ms = b ?? 300; }
    if (app.reducedMotion()) ms = Math.min(ms, 80);
    const from = +getComputedStyle(veil).opacity || 0;
    veilAnim?.cancel?.();
    veil.style.opacity = String(from);
    return new Promise((resolve) => {
      const anim = veil.animate?.([{ opacity: from }, { opacity: to }], { duration: Math.max(1, ms), easing: 'ease-in-out', fill: 'forwards' });
      veilAnim = anim;
      const done = () => {
        veil.style.opacity = String(to);
        resolve();
        if (dip) requestAnimationFrame(() => requestAnimationFrame(() => fade(0, ms * 1.4)));
      };
      if (anim) anim.onfinish = done; else done();
    });
  }

  // ---------------- toasts & captions ----------------
  /** opts.id: a toast with the same id replaces it, and dismiss(id) takes it away early */
  function toast(msg, ms = 3200, { id } = {}) {
    const text = typeof msg === 'string' ? msg : (msg?.en || '');
    if (!text) return;
    if (id) dismiss(id, true);
    const el = h('div.mk-toast.mk-glass', typeof msg === 'object' && msg.he ? [he(msg.he, 'mk-toast__he'), ' '] : null, text);
    if (id) el.dataset.toast = id;
    toasts.append(el);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, ms);
  }
  function dismiss(id, now = false) {
    for (const el of toasts.querySelectorAll(`[data-toast="${id}"]`)) {
      el.removeAttribute('data-toast');
      if (now) { el.remove(); continue; }
      el.classList.remove('in');
      setTimeout(() => el.remove(), 400);
    }
  }

  function caption(e) {
    const t = e?.text;
    const en = typeof t === 'string' ? t : t?.en;
    const heText = typeof t === 'object' ? t?.he : null;
    if (!en && !heText) return;
    if (ctx.settings?.get('captions') === false) return;
    const el = h('div.mk-cap', en ? h('span.mk-cap__en', en) : null, heText ? he(heText, 'mk-cap__he') : null);
    captions.append(el);
    while (captions.children.length > 2) captions.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    const ms = Math.max(2500, (e.duration || 4) * 1000);
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, ms);
  }
  ctx.bus.on('caption', caption);

  // ---------------- hints ----------------
  let hintTimer = 0, hintHide = 0;
  const canvas = ctx.renderer?.domElement || document.getElementById('scene');
  // touch: the ghosts go with the first touch on the view (the real joystick appears under the thumb)
  const firstTouch = (e) => { if (e.pointerType !== 'mouse') hideHints(); };
  function showHints() {
    hints.hidden = false;
    hints.classList.remove('out');
    clearTimeout(hintTimer);
    clearTimeout(hintHide);
    hintTimer = setTimeout(() => hideHints(), touch ? 9000 : 14000);
    if (touch) canvas?.addEventListener('pointerdown', firstTouch);
  }
  function hideHints() {
    canvas?.removeEventListener('pointerdown', firstTouch);
    clearTimeout(hintTimer);
    hints.classList.add('out');
    clearTimeout(hintHide);
    hintHide = setTimeout(() => { hints.hidden = true; }, 950);
  }

  // ---------------- travel status ----------------
  /** text: the whole phrase ("Walking to the Chel"), or null to hide */
  function travel(text) {
    if (!text) { status.hidden = true; setText(statusText, ''); return; } // no stale "Walking to …" left in the DOM
    setText(statusText, text);
    status.hidden = false;
  }

  // ---------------- zone ----------------
  // ARCHITECTURE §12: the observer may walk anywhere; crossing into a place an Israelite could not enter is announced
  // once per visit (a toast with the place's own access rule), and the card's border turns red-gold while there.
  let zoneId, prevRung = null, pendingNotice = null;
  const noticed = new Map(); // zone id -> time of the last notice (ms), so boundary flapping does not repeat it
  function accessNotice(id, z, r) {
    if (r === null || r < RESTRICTED_RUNG || (prevRung !== null && r <= prevRung)) return;
    if (ctx.settings?.get('captions') === false || app.introOpen?.()) return;
    // toasts hide under the map (a walk seen on the map): announce it once the map closes, if still there
    if (app.openPanel?.() === 'map') { pendingNotice = { id, z, r }; return; }
    showNotice(id, z, r);
  }
  function showNotice(id, z, r) {
    const now = performance.now();
    if (now - (noticed.get(id) ?? -Infinity) < 90000) return;
    noticed.set(id, now);
    const L = LADDER[r];
    const access = String(z?.access || '').trim();
    const rule = accessLead(access) || `${L.rule}.`; // its lead sentence(s)
    const observer = r >= 9 ? ' You see it here as an observer.' : '';
    // the ladder's Mishnah only when the place's own rule cites nothing
    const src = L.src && !hasCitation(rule) ? ` (${L.src})` : '';
    toast({ en: `${z?.name?.en || L.en} — ${rule}${observer}${src}`, he: z?.name?.he || L.he }, 7000, { id: 'access' });
    accessRung = r;
  }
  let accessRung = null; // the rung of the access notice on screen, or null
  /** the access notice is about where you stand: it goes when you step down out of it or set off elsewhere (a Go) */
  function dismissAccess() { if (accessRung !== null) { dismiss('access'); accessRung = null; } }
  function setZone(id, animate = true) {
    if (id === zoneId) return;
    zoneId = id;
    const rNew = data.rung(id);
    // stepping down below the notice's rung leaves the place it is about; a deeper place brings its own notice
    if (accessRung !== null && (rNew === null || rNew < accessRung)) dismissAccess();
    const z = data.zone(id);
    setText(locHe, z?.name?.he || '');
    locHe.hidden = !z?.name?.he;
    const en = z?.name?.en || (id ? '' : 'Outside the precinct');
    const cut = en.indexOf(' — ');
    locEn.replaceChildren(cut > 0 ? en.slice(0, cut) : en, cut > 0 ? h('span.mk-loc__sub', en.slice(cut)) : '');
    const r = data.rung(id);
    badge.hidden = r === null;
    if (r !== null) {
      [...rungs.children].forEach((b, i) => { b.className = i === r ? 'cur' : (i < r ? 'on' : ''); });
      setText(badgeText, `Sanctity of ${LADDER[r].en.replace(/^The /, 'the ')}`);
      badge.title = `${LADDER[r].en}: ${LADDER[r].rule}`;
    }
    loc.classList.toggle('is-restricted', r !== null && r >= RESTRICTED_RUNG);
    loc.setAttribute('aria-label', `${en || 'Unknown place'}${r !== null ? ` — sanctity of ${LADDER[r].en.replace(/^The /, 'the ')}` : ''}. About this place (I)`);
    if (animate) {
      loc.classList.remove('is-changing');
      void loc.offsetWidth;
      loc.classList.add('is-changing');
      setText(locLive, `${z?.name?.en || ''}`);
      accessNotice(id, z, r);
    }
    prevRung = r;
  }
  ctx.bus.on('zone:change', (e) => setZone(typeof e?.zone === 'string' ? e.zone : (e?.zone?.id ?? data.currentZoneId())));

  // ---------------- tags over active events ----------------
  // Projected each frame, then decluttered in screen space: the most important first (then the nearest), each above its
  // anchor and pushed up past the tags already placed, with a leader down to its anchor; kept inside the view and clear
  // of the location card, the clock and the tool column. On a coarse pointer the tags take no pointer events (a look-drag
  // that starts on one must reach the canvas, as the player's touch look lives there); a tap that barely moved is
  // hit-tested against them instead.
  const tags = new Map(); // ev.id -> { el, ev, pos: Vector3, imp, … }
  const v = new Vector3();
  const LEAD = 18, GAP = 4, EDGE = 8;
  let tagList = [];
  function syncTags(active) {
    const on = ctx.settings?.get('labels') !== false;
    const want = on ? active.slice(0, 4) : [];
    const ids = new Set(want.map((e) => e.id));
    for (const [id, t] of tags) if (!ids.has(id)) { t.el.remove(); tags.delete(id); }
    for (const ev of want) {
      if (tags.has(ev.id)) continue;
      const p = data.eventPos(ev);
      if (!p) continue;
      const el = h('button.mk-tag.mk-live', { type: 'button', title: ev.summary || '', on: { click: () => app.open('time', { focusEvent: ev.id }) } },
        h('span.mk-tag__dot'), h('span.mk-tag__t', ev.title?.en || ev.id));
      el.style.opacity = '0';
      el.tabIndex = -1; // out of the tab order until it is actually visible
      el.setAttribute('aria-hidden', 'true');
      labels.append(el);
      tags.set(ev.id, { el, ev, imp: ev.importance || 1, pos: m2w(p[0], p[1], (p[2] ?? 16) + 4.5) });
    }
    tagList = [...tags.values()];
  }
  const remeasure = () => { for (const t of tags.values()) t.w = 0; };
  document.fonts?.addEventListener?.('loadingdone', remeasure);
  window.addEventListener('resize', remeasure);
  // HUD pieces the tags keep clear of, measured in the slow tick (they only move on resize and panel docking)
  let avoid = [];
  function measureAvoid() {
    avoid = [loc, chip, tools].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ x0: r.left - GAP, x1: r.right + GAP, y0: r.top - GAP, y1: r.bottom + GAP }));
  }
  const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const vis = [], placed = [];
  function placeTags() {
    if (!tagList.length) return;
    const cam = ctx.camera;
    const W = innerWidth, H = innerHeight;
    vis.length = 0;
    for (const t of tagList) {
      v.copy(t.pos).project(cam);
      const dist = cam.position.distanceTo(t.pos);
      const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist > 4;
      const op = onScreen ? Math.max(0, Math.min(1, (260 - dist) / 120)) : 0;
      const o = op.toFixed(2);
      if (t.o !== o) {
        t.o = o;
        const on = op > 0.2;
        t.el.style.opacity = o;
        if (!touch) t.el.style.pointerEvents = on ? 'auto' : 'none';
        if (on !== t.on) {
          t.on = on;
          t.el.tabIndex = on ? 0 : -1;
          if (on) t.el.removeAttribute('aria-hidden'); else t.el.setAttribute('aria-hidden', 'true');
        }
      }
      if (op > 0) { t.ax = (v.x + 1) * 0.5 * W; t.ay = (1 - v.y) * 0.5 * H; t.dist = dist; vis.push(t); } else t.box = null;
    }
    vis.sort((a, b) => b.imp - a.imp || a.dist - b.dist);
    placed.length = 0;
    for (const [i, t] of vis.entries()) {
      if (!t.w) { t.w = t.el.offsetWidth; t.hh = t.el.offsetHeight; }
      // a tag pushed up has its leader running down behind the tags placed before it: those paint on top
      const zi = String(vis.length - i);
      if (t.zi !== zi) { t.zi = zi; t.el.style.zIndex = zi; }
      const w = t.w, hh = t.hh;
      const clampX = (x) => Math.max(EDGE + w / 2, Math.min(W - EDGE - w / 2, x));
      let x = clampX(t.ax), y1 = t.ay - LEAD;
      const box = () => ({ x0: x - w / 2, x1: x + w / 2, y0: y1 - hh, y1 });
      // out of the HUD's way: sideways (away from the screen edge the piece sits on), else below it
      for (const r of avoid) {
        if (!hits(box(), r)) continue;
        x = clampX(r.x0 > W / 2 ? r.x0 - w / 2 : r.x1 + w / 2);
        if (hits(box(), r)) y1 = r.y1 + hh;
      }
      // up past the tags already placed (each move can meet another: at most one pass per placed tag)
      for (let k = 0; k < placed.length; k++) {
        const b = box();
        const hit = placed.find((p) => hits(b, { x0: p.x0 - GAP, x1: p.x1 + GAP, y0: p.y0 - GAP, y1: p.y1 + GAP }));
        if (!hit) break;
        y1 = hit.y0 - GAP;
      }
      y1 = Math.max(y1, EDGE + hh);
      const b = box();
      placed.push(b);
      t.box = b;
      const tf = `translate(${b.x0.toFixed(1)}px, ${b.y0.toFixed(1)}px)`;
      if (t.tf !== tf) { t.tf = tf; t.el.style.transform = tf; }
      // the leader runs from the tag down to its anchor (its own x, kept within the tag's rounded ends)
      const lh = Math.max(0, Math.round(t.ay - y1)), lx = Math.round(Math.max(-(w / 2 - 12), Math.min(w / 2 - 12, t.ax - x)));
      if (t.lh !== lh) { t.lh = lh; t.el.style.setProperty('--lh', `${lh}px`); }
      if (t.lx !== lx) { t.lx = lx; t.el.style.setProperty('--lx', `${lx}px`); }
    }
  }
  /** the visible tag under a screen point (a little slop for fingers) */
  function tagAt(x, y, slop = 6) {
    for (const t of tagList) if (t.on && t.box && x > t.box.x0 - slop && x < t.box.x1 + slop && y > t.box.y0 - slop && y < t.box.y1 + slop) return t;
    return null;
  }
  if (touch) {
    let down = null;
    // timed by the events' own stamps: a short tap handled late on a busy page is still a tap (qa-r2, as map/view.js)
    const stamp = (e) => (e.timeStamp > 0 ? e.timeStamp : performance.now());
    window.addEventListener('pointerdown', (e) => {
      down = e.pointerType !== 'mouse' && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: stamp(e) } : null;
    }, { capture: true, passive: true });
    window.addEventListener('pointerup', (e) => {
      const d = down;
      down = null;
      if (!d || e.pointerId !== d.id || e.target !== canvas || app.panelOpen?.() || app.introOpen?.()) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || stamp(e) - d.t > 500) return; // a drag: the look's
      const t = tagAt(e.clientX, e.clientY);
      if (t) app.open('time', { focusEvent: t.ev.id });
    }, { capture: true, passive: true });
  }

  // ---------------- per-tick update ----------------
  // the gold mark points at the centre of Kodesh HaKodashim, read from the site model (the direction of prayer)
  const khk = data.zoneCenter('kodesh-hakodashim');
  khkMark.hidden = !khk;
  let lastHeading = Infinity, lastPosKey = ''; // Infinity, not NaN: any comparison with NaN is false (the strip never moved)
  function updateCompass() {
    const hd = ctx.player?.heading;
    if (!Number.isFinite(hd)) return;
    const turned = !(Math.abs(hd - lastHeading) < 0.05);
    if (turned) {
      lastHeading = hd;
      strip.style.transform = `translateX(${(140 - (hd + 180) * PX_PER_DEG).toFixed(1)}px)`;
    }
    const p = ctx.player?.position;
    if (!khk || !p) return;
    const s = w2m(p);
    const posKey = `${Math.round(s.X)}|${Math.round(s.Y)}`; // ≈ 0.5 m steps
    if (!turned && posKey === lastPosKey) return;
    lastPosKey = posKey;
    let b = Math.atan2(khk[0] - s.X, khk[1] - s.Y) * 180 / Math.PI;
    b = ((b % 360) + 360) % 360;
    if (b - hd > 180) b -= 360; else if (hd - b > 180) b += 360;
    khkMark.style.left = `${((b + 180) * PX_PER_DEG).toFixed(1)}px`;
  }

  function updateTime() {
    const time = ctx.time;
    if (!time?.zmanim) { setText(chipMain, '—'); return; }
    const info = seasonal(time, time.t);
    const lbl = `${info.half === 'day' ? 'Day' : 'Night'} · hour ${info.hour}`;
    if (chipMain.dataset.k !== lbl) { chipMain.dataset.k = lbl; chipMain.replaceChildren(lbl, h('span.mk-chip__of', ' of 12')); }
    barFill.style.width = `${(info.frac * 100).toFixed(1)}%`;
    setText(chipCivil, `≈ ${clock(time.t)}`);
    setText(chipSpeed, time.paused ? '❚❚' : (time.speed !== 1 ? `${time.speed}×` : ''));
    chip.setAttribute('aria-label', `${seasonalLabel(info, { long: true })}, about ${clock(time.t)}. Open time controls (T)`);
    dialSvg.set(info.s, info.half);
  }

  let tSlow = 0, lastActiveKey = '';
  function tick(dt) {
    updateCompass();
    tSlow += dt;
    const slow = tSlow >= 0.25;
    const open = app.panelOpen?.(); // the tags are hidden under an open panel
    if (slow && tagList.length && !open) measureAvoid(); // layout reads before this frame's tag writes
    if (!open) placeTags();
    if (!slow) return;
    tSlow = 0;
    updateTime();
    setZone(data.currentZoneId());
    if (pendingNotice && app.openPanel?.() !== 'map') {
      const p = pendingNotice;
      pendingNotice = null;
      if (p.id === zoneId) showNotice(p.id, p.z, p.r);
    }
    const active = data.active();
    const key = active.map((e) => e.id).join('|') + (ctx.settings?.get('labels') === false ? '0' : '1');
    if (key !== lastActiveKey) { lastActiveKey = key; syncTags(active); }
  }

  function refresh() { zoneId = undefined; lastActiveKey = ''; setZone(data.currentZoneId(), false); updateTime(); }

  return {
    root, tick, toast, dismiss, dismissAccess, fade, travel, showHints, hideHints, refresh, setZone,
    /** HUD pieces an open panel may cover (app.js fades the covered ones out) */
    coverable: [loc, chip, tools, compass],
    setExpanded(name, open) {
      chip.setAttribute('aria-expanded', name === 'time' && open ? 'true' : 'false');
      for (const b of tools.children) b.setAttribute('aria-expanded', b.dataset.tool === name && open ? 'true' : 'false');
    },
  };
}

/** 24-seasonal-hour mini dial for the chip: day arc above, night below; a dot for now. */
function miniDial() {
  const NS = 'http://www.w3.org/2000/svg';
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '-20 -20 40 40');
  el.setAttribute('class', 'mk-chip__dial');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<circle r="15" fill="none" stroke="rgba(43,58,88,.95)" stroke-width="4"/>'
    + '<path d="M-15 0 A15 15 0 0 1 15 0" fill="none" stroke="#e3c27c" stroke-width="4"/>'
    + '<line x1="-19" y1="0" x2="19" y2="0" stroke="rgba(10,8,5,.6)" stroke-width="1"/>'
    + '<circle class="dot" r="4.4" fill="#fff2c4" stroke="#1a140d" stroke-width="1.4"/>';
  const dot = el.querySelector('.dot');
  let last = '';
  return {
    el,
    set(s, half) {
      const phi = (s * 15 + 270) * Math.PI / 180;
      const k = `${s.toFixed(2)}${half}`;
      if (k === last) return;
      last = k;
      dot.setAttribute('cx', (15 * Math.sin(phi)).toFixed(2));
      dot.setAttribute('cy', (-15 * Math.cos(phi)).toFixed(2));
      dot.setAttribute('fill', half === 'day' ? '#ffe39a' : '#dfe6f4');
    },
  };
}
