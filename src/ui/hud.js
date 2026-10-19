// HUD: location (he + en + sanctity), seasonal-time chip, compass, tool buttons, captions, hints, toasts,
// travel status, the fade veil, and floating tags over active events. Updated from one throttled ticker.
import { Vector3 } from 'three';
import { h, he, icon, setText } from './dom.js';
import { seasonal, seasonalLabel, clock, accessLead } from './format.js';
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
  const tools = h('div.mk-tools', toolBtn('info', 'info', 'About this place', 'I'), toolBtn('map', 'map', 'Map', 'M'), toolBtn('settings', 'settings', 'Settings', 'G'));
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
  const hints = h('div.mk-hints', { 'aria-hidden': 'true' }, touch
    ? [h('span', 'Left thumb · walk'), h('span', 'Right thumb · look'), h('span', 'Tap the clock for time')]
    : [hint(['W', 'A', 'S', 'D'], 'walk'), hint(['Shift'], 'run'), hint(['T'], 'time'), hint(['I'], 'this place'), hint(['M'], 'map'), hint(['Esc'], 'free the mouse')]);
  hints.hidden = true;
  const captions = h('div.mk-captions', { 'aria-live': 'polite' });
  const bottom = h('div.mk-bottom', status, hints, captions);

  const toasts = h('div.mk-toasts', { 'aria-live': 'polite' });
  const labels = h('div.mk-labels');
  // tags last in the tab order (after the place, the clock and the tools); they paint underneath (z-index -1)
  root.append(loc, locLive, tr, compass, bottom, toasts, labels);

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
  function toast(msg, ms = 3200) {
    const text = typeof msg === 'string' ? msg : (msg?.en || '');
    if (!text) return;
    const el = h('div.mk-toast.mk-glass', typeof msg === 'object' && msg.he ? [he(msg.he, 'mk-toast__he'), ' '] : null, text);
    toasts.append(el);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, ms);
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
  let hintTimer = 0;
  function showHints() {
    hints.hidden = false;
    hints.classList.remove('out');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hideHints(), 14000);
  }
  function hideHints() {
    hints.classList.add('out');
    setTimeout(() => { hints.hidden = true; }, 950);
  }

  // ---------------- travel status ----------------
  /** text: the whole phrase ("Walking to the Chel"), or null to hide */
  function travel(text) {
    if (!text) { status.hidden = true; return; }
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
    const rule = accessLead(access) || `${L.rule}.`; // its lead sentence(s) (no lookbehind: old Safari)
    const observer = r >= 9 ? ' You see it here as an observer.' : '';
    toast({ en: `${z?.name?.en || L.en} — ${rule}${observer}${L.src ? ` (${L.src})` : ''}`, he: z?.name?.he || L.he }, 7000);
  }
  function setZone(id, animate = true) {
    if (id === zoneId) return;
    zoneId = id;
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
  const tags = new Map(); // ev.id -> { el, ev, pos: Vector3 }
  const v = new Vector3();
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
        h('span.mk-tag__dot'), ev.title?.en || ev.id);
      el.style.opacity = '0';
      el.tabIndex = -1; // out of the tab order until it is actually visible
      el.setAttribute('aria-hidden', 'true');
      labels.append(el);
      tags.set(ev.id, { el, ev, pos: m2w(p[0], p[1], (p[2] ?? 16) + 4.5) });
    }
    tagList = [...tags.values()];
  }
  function placeTags() {
    if (!tagList.length) return;
    const cam = ctx.camera;
    const W = innerWidth, H = innerHeight;
    for (const t of tagList) {
      v.copy(t.pos).project(cam);
      const dist = cam.position.distanceTo(t.pos);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist > 4;
      const op = vis ? Math.max(0, Math.min(1, (260 - dist) / 120)) : 0;
      const o = op.toFixed(2);
      if (t.o !== o) {
        t.o = o;
        const on = op > 0.2;
        t.el.style.opacity = o;
        t.el.style.pointerEvents = on ? 'auto' : 'none';
        if (on !== t.on) {
          t.on = on;
          t.el.tabIndex = on ? 0 : -1;
          if (on) t.el.removeAttribute('aria-hidden'); else t.el.setAttribute('aria-hidden', 'true');
        }
      }
      if (op > 0) {
        t.w ||= t.el.offsetWidth;
        const half = t.w / 2 + 8;
        const x = Math.max(half, Math.min(W - half, (v.x + 1) * 0.5 * W));
        const tr = `translate(${x.toFixed(1)}px, ${((1 - v.y) * 0.5 * H).toFixed(1)}px) translate(-50%, calc(-100% - 18px))`;
        if (t.tr !== tr) { t.tr = tr; t.el.style.transform = tr; }
      }
    }
  }

  // ---------------- per-tick update ----------------
  // the gold mark points at the centre of Kodesh HaKodashim, read from the site model (the direction of prayer)
  const khk = data.zoneCenter('kodesh-hakodashim');
  khkMark.hidden = !khk;
  let lastHeading = NaN, lastPosKey = '';
  function updateCompass() {
    const hd = ctx.player?.heading;
    if (!Number.isFinite(hd)) return;
    const turned = Math.abs(hd - lastHeading) >= 0.05;
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
    if (!app.panelOpen?.()) placeTags(); // the tags are hidden under an open panel
    tSlow += dt;
    if (tSlow < 0.25) return;
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
    root, tick, toast, fade, travel, showHints, hideHints, refresh, setZone,
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
