// The Menu header (console §3.4), on every Menu view: the minimap disc, the place (Hebrew and English names, its rung
// of sanctity, a storey tag, "About this place ›"), the live clock (seasonal hour, ≈ civil time, pause, speed, a Back
// chip after a Show me), the search field, labelled actions (Fly / Walk, Sound, Close) and one module status chip.
// Phones: a compact strip in a section (disc 56 px, names on one line, the clock line, "About ›"); the full header on
// the home screen (disc 72 px), where Fly and Sound sit under the tiles instead.
import { h, fill, he, setText } from '../dom.js';
import { ico } from './icons.js';
import { createMinimap } from './minimap.js';
import { seasonal, clock } from '../format.js';
import { LADDER, RESTRICTED_RUNG } from '../data.js';

export const CLOCK_SPEEDS = [1, 10, 60, 600];

/** sound on/off on top of the volume setting: off stores the level and sets 0; on restores it */
export function soundToggle(ctx) {
  const S = ctx.settings;
  const on = S.get('volume') > 0;
  if (on) {
    try { localStorage.setItem('mikdash.soundVolume', String(S.get('volume'))); } catch { /* ignore */ }
    S.set('volume', 0);
  } else {
    let v = 0.8;
    try { v = parseFloat(localStorage.getItem('mikdash.soundVolume')) || 0.8; } catch { /* ignore */ }
    S.set('volume', v);
    try { ctx.audio?.unlock?.()?.catch?.(() => {}); } catch { /* ignore */ }
  }
}
export function flyToggle(ctx) {
  const p = ctx.player;
  if (!p?.setMode) return;
  p.setMode(p.mode === 'fly' ? 'walk' : 'fly');
}

export function createHeader(app) {
  const { ctx, data } = app;
  const disc = createMinimap(app, { size: 120 });
  const discBtn = h('button.mk-head__disc', {
    type: 'button', title: 'The map, centred on you', 'aria-label': 'Map, centred on you',
    on: { click: () => app.open('map', { centerMe: true }) },
  }, disc.el);

  // ---------------- place ----------------
  const heEl = he('', 'mk-head__he');
  const enEl = h('span.mk-head__en');
  const rungs = h('span.mk-rungs', { 'aria-hidden': 'true' }, LADDER.map((_, i) => h('i', { style: { height: `${3 + i}px` } })));
  const sanctTxt = h('span.mk-head__sancttxt');
  const storeyTag = h('span.mk-head__storey', { hidden: true });
  const sanct = h('div.mk-head__sanct', rungs, sanctTxt, storeyTag);
  const about = h('button.mk-head__about', { type: 'button', on: { click: () => app.openAbout() } }, h('span.mk-head__aboutlong', 'About this place'), h('span.mk-head__aboutshort', 'About'), ' ›');
  // the rung and About this place share one line, so the header stays near the spec's 170 px
  const loc = h('div.mk-head__loc', h('div.mk-head__names', heEl, enEl), h('div.mk-head__sanctrow', sanct, about));
  const live = h('div.sr-only', { 'aria-live': 'polite' });

  // ---------------- clock ----------------
  const dial = miniDial();
  const hourEl = h('span.mk-head__hour');
  const civilEl = h('span.mk-head__civil.num');
  const clockBtn = h('button.mk-head__clockbtn', { type: 'button', title: 'The hour — open Time', on: { click: () => app.open('time') } },
    dial.el, h('span.mk-head__clocktxt', hourEl, civilEl));
  const playIco = h('span.mk-head__playico');
  const playTxt = h('span.mk-head__playtxt');
  const playBtn = h('button.mk-hbtn.mk-head__play', { type: 'button', 'aria-keyshortcuts': 'P', on: { click: () => app.togglePause() } },
    playIco, playTxt, h('span.mk-kbd.mk-chipcap', { 'data-cap': 'pause' }));
  const speedTxt = h('span.num');
  const speedBtn = h('button.mk-hbtn.mk-head__speed', { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', title: 'Clock speed', on: { click: () => toggleSpeed() } },
    speedTxt, ico('down'));
  const speedMenu = h('div.mk-pop.mk-head__speedmenu', { role: 'listbox', 'aria-label': 'Clock speed', hidden: true },
    CLOCK_SPEEDS.map((n) => h('button.mk-pop__opt', {
      type: 'button', role: 'option', 'data-speed': n, 'aria-selected': 'false',
      on: { click: () => { const t = ctx.time; if (t) { t.setSpeed(n); t.pause(false); } toggleSpeed(false); update(true); speedBtn.focus(); } },
    }, n === 1 ? '1× real time' : `${n}×`)));
  // "↶ Back to 08:51": it names what it undoes (the clock and place before a Show me), unlike a card's own Back
  const backTxt = h('span.mk-head__backtxt', 'Back');
  const backChip = h('button.mk-hbtn.mk-head__back', { type: 'button', hidden: true, on: { click: () => ctx.inspect?.back?.() } }, ico('back'), backTxt);
  const transport = h('div.mk-head__transport', playBtn, h('div.mk-head__speedwrap', speedBtn, speedMenu), backChip);
  function toggleSpeed(on = speedMenu.hidden) {
    speedMenu.hidden = !on;
    speedBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) speedMenu.querySelector('[aria-selected=true]')?.focus();
  }
  speedMenu.addEventListener('keydown', (e) => {
    const opts = [...speedMenu.children];
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); toggleSpeed(false); speedBtn.focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!speedMenu.hidden && !e.target.closest('.mk-head__speedwrap')) toggleSpeed(false); }, true);

  // ---------------- actions ----------------
  const flyIco = h('span.mk-head__flyico');
  const flyTxt = h('span');
  const flyBtn = h('button.mk-hbtn.mk-head__fly', { type: 'button', on: { click: () => { flyToggle(ctx); update(true); } } }, flyIco, flyTxt);
  const sndIco = h('span');
  const sndTxt = h('span');
  const sndBtn = h('button.mk-hbtn.mk-head__sound', { type: 'button', on: { click: () => { soundToggle(ctx); update(true); } } }, sndIco, sndTxt);
  const closeBtn = h('button.mk-hbtn.mk-head__close', { type: 'button', 'aria-keyshortcuts': 'Escape', on: { click: (e) => app.close({ relock: e.detail > 0 }) } },
    ico('close'), h('span.mk-head__closetxt', 'Close'), h('span.mk-kbd.mk-chipcap', { 'data-cap': 'close' }));
  const status = h('div.mk-head__status', { hidden: true });
  const acts = h('div.mk-head__acts', flyBtn, sndBtn);
  const clockEl = h('div.mk-head__clock', clockBtn, transport);
  const searchSlot = h('div.mk-head__search');
  // Fly and Sound beside the search field (dock): the clock row then holds the hour, Pause and the speed on one line
  const searchRow = h('div.mk-head__searchrow', searchSlot, acts);

  const el = h('header.mk-head', discBtn, loc, closeBtn, clockEl, searchRow, status, live);

  // ---------------- update (4 Hz) ----------------
  let last = {};
  function update(force = false) {
    if (force) last = {};
    // place
    const id = data.currentZoneId();
    if (id !== last.zone) {
      last.zone = id;
      const z = data.zone(id);
      const he0 = z?.name?.he?.split(' — ')[0] || '';
      setText(heEl, he0);
      heEl.hidden = !he0;
      const en = (z?.name?.en || (id ? '' : 'Outside the precinct'));
      enEl.replaceChildren(...(app.layout.isSheet ? [en.split(' — ')[0]] : [en.split(' — ')[0], en.includes(' — ') ? h('span.mk-head__ensub', ` — ${en.split(' — ').slice(1).join(' — ')}`) : '']));
      const r = data.rung(id);
      const split = data.split(id);
      sanct.hidden = r === null && !storeyTag.textContent;
      if (r !== null) {
        [...rungs.children].forEach((b, i) => { b.className = i === r ? 'cur' : (i < r ? 'on' : ''); });
        // a chamber half in kodesh and half in chol (the Sanhedrin sits in the chol half of Lishkat HaGazit): one rung
        // would misplace whoever stands in the other half
        setText(sanctTxt, split ? 'Half kodesh, half chol ⓘ' : `Sanctity of ${LADDER[r].en.replace(/^The /, 'the ')}`);
        sanct.title = split ? (z?.sanctityNote || '') : `${LADDER[r].en}: ${LADDER[r].rule}`;
      }
      rungs.hidden = r === null;
      sanctTxt.hidden = r === null;
      el.classList.toggle('is-restricted', r !== null && r >= RESTRICTED_RUNG && !split);
      const lvl = app.mapModel?.()?.get(id)?.level;
      const tag = lvl && lvl !== 'ground' ? { upper: 'Upper storey', roof: 'On the roof', below: 'Below ground' }[lvl] : '';
      setText(storeyTag, tag);
      storeyTag.hidden = !tag;
      about.setAttribute('aria-label', `About this place: ${en.split(' — ')[0]}`);
    }
    // clock
    const tm = ctx.time;
    const i = tm?.zmanim ? seasonal(tm, tm.t) : null;
    const hourTxt = i ? `${i.half === 'day' ? 'Day' : 'Night'} · hour ${i.hour} of 12` : 'The clock is unavailable';
    if (hourTxt !== last.hour) { last.hour = hourTxt; setText(hourEl, hourTxt); }
    const civ = tm ? `≈ ${clock(tm.t)}` : '';
    if (civ !== last.civ) { last.civ = civ; setText(civilEl, civ); clockBtn.setAttribute('aria-label', `${hourTxt}, about ${clock(tm?.t)}. Open Time`); }
    if (i) dial.set(i.s, i.half);
    const paused = !!tm?.paused;
    if (paused !== last.paused) {
      last.paused = paused;
      playIco.replaceChildren(ico(paused ? 'play' : 'pause'));
      setText(playTxt, paused ? 'Play' : 'Pause');
      playBtn.setAttribute('aria-label', paused ? 'Play the clock' : 'Pause the clock');
    }
    const sp = tm?.speed ?? 1;
    if (sp !== last.speed) {
      last.speed = sp;
      setText(speedTxt, `${sp}×`);
      speedBtn.setAttribute('aria-label', `Clock speed ${sp} times. Change`);
      for (const b of speedMenu.children) b.setAttribute('aria-selected', +b.dataset.speed === sp ? 'true' : 'false');
    }
    const back = !!ctx.inspect?.canBack && app.showBackChip?.();
    if (back !== last.back || (back && ctx.inspect.backLabel?.en !== last.backLabel)) {
      last.back = back;
      last.backLabel = ctx.inspect?.backLabel?.en;
      backChip.hidden = !back;
      if (back) {
        const full = last.backLabel || 'Back';
        setText(backTxt, full.replace(/\s+at\s+.*$/, '')); // "Back to 08:39" (the place is in the title)
        backChip.title = full;
        backChip.setAttribute('aria-label', full);
      }
    }
    // actions
    const fly = ctx.player?.mode === 'fly';
    if (fly !== last.fly) {
      last.fly = fly;
      flyIco.replaceChildren(ico(fly ? 'walk' : 'fly'));
      setText(flyTxt, fly ? 'Walk' : 'Fly');
      flyBtn.title = fly ? 'Land and walk (F)' : 'Fly over the courts (F)';
    }
    flyBtn.hidden = !ctx.player?.setMode;
    const snd = ctx.settings.get('volume') > 0;
    if (snd !== last.snd) {
      last.snd = snd;
      sndIco.replaceChildren(ico(snd ? 'soundOn' : 'soundOff'));
      setText(sndTxt, snd ? 'Sound on' : 'Sound off');
      sndBtn.setAttribute('aria-pressed', snd ? 'true' : 'false');
    }
    // the module status chip
    const st = app.modules.status();
    const sk = st ? `${app.modules.t(st.label)}|${app.modules.t(st.action?.label)}` : '';
    if (sk !== last.status) {
      last.status = sk;
      status.hidden = !st;
      fill(status, ...(st ? [h('span', app.modules.t(st.label)), st.action ? h('button.mk-hbtn', { type: 'button', on: { click: () => app.modules.call(st.module, 'status.action', st.action.run) } }, app.modules.t(st.action.label)) : null] : []));
    }
  }
  function caps() {
    for (const k of el.querySelectorAll('[data-cap]')) { const v = app.input.cap(k.dataset.cap); setText(k, v || ''); k.hidden = !v; }
  }
  app.input.on(caps);
  caps();

  return {
    el, disc, searchSlot, discBtn, closeBtn, about,
    update,
    tick(dt) { disc.tick(dt); },
    announce(text) { setText(live, ''); requestAnimationFrame(() => setText(live, text)); },
    setDiscSize(px) { disc.setSize(px); },
  };
}

/** 24-seasonal-hour mini dial: day arc above, night below; a dot for now (moved from the old HUD chip) */
function miniDial() {
  const NS = 'http://www.w3.org/2000/svg';
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '-20 -20 40 40');
  el.setAttribute('class', 'mk-head__dial');
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
