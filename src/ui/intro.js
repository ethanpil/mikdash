// Intro overlay shown after boot: title, framing paragraph (from the live clock and place), controls, Enter.
import { h, he } from './dom.js';
import { hebrewAt, dayPhrase } from './format.js';
import { introRows, keyCaps } from './controls.js';

export function createIntro(app, { onEnter }) {
  const { ctx, data } = app;
  const touch = matchMedia?.('(pointer: coarse)').matches;
  const fine = matchMedia?.('(pointer: fine)').matches;

  const time = ctx.time;
  const hd = time ? hebrewAt(time, time.t) : null;
  const z = time?.zmanim;
  // before sunset; from sunset on the day is named by the halachic day that has begun (dayPhrase)
  const when = !z ? '' : (time.t >= z.alot - 30 && time.t < z.alot ? 'slightly before dawn'
    : time.t >= z.alot && time.t < z.sunrise ? 'first light'
      : time.t >= z.sunrise && time.t < z.sunset ? 'daytime' : 'night');
  const day = z ? dayPhrase(time, time.t, when) : '';
  const custom = ctx.params?.pos || ctx.params?.at;
  const place = custom ? `you stand in ${data.zone(data.currentZoneId())?.name?.en || 'the precinct'}` : 'you stand at the outer steps leading into the Temple';

  const helpRows = introRows({ touch, fine });

  const enterBtn = h('button.mk-btn.mk-btn--primary.mk-intro__go', { type: 'button' }, 'Enter');
  // the method, sources and credits: enters (no pointer lock, which would close the panel again) and opens About
  const aboutBtn = h('button.mk-intro__about', { type: 'button' }, 'How this was reconstructed: method, sources & credits');
  aboutBtn.addEventListener('click', (e) => { enter(e, { lock: false }); app.open('about'); });
  const el = h('div.mk-intro.mk-live', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mk-intro-title', 'aria-describedby': 'mk-intro-text' },
    h('div.mk-intro__card',
      h('h1.mk-intro__title', { id: 'mk-intro-title', lang: 'he', dir: 'rtl' }, 'מקדש', h('span.sr-only', { lang: 'en' }, ' — Mikdash')),
      h('div.mk-intro__sub', { 'aria-hidden': 'true' }, 'Mikdash'),
      h('div.mk-orn', { 'aria-hidden': 'true' }, h('i')),
      h('p.mk-intro__text', { id: 'mk-intro-text' },
        'The Second Temple in its final, Herodian form, as ', h('em', 'Mishnah Middot'), ' measures it and ', h('em', 'Tamid'),
        ' and the Rambam describe its service. ',
        day ? `It is ${day}${hd?.en ? `, ${hd.en.replace(/ \d{4}$/, '')}` : ''}, and ${place}.` : `${place[0].toUpperCase()}${place.slice(1)}.`),
      hd?.he ? h('p.mk-intro__fine', he(hd.he)) : null,
      h('div.mk-intro__help', helpRows.map(([k, t]) => h('div', h('span', keyCaps(k)), h('span', t)))),
      enterBtn,
      h('p.mk-intro__fine', 'Every measure comes from the sources; where they are silent, the reconstruction says so.'),
      h('p.mk-intro__fine.mk-intro__links', aboutBtn)));

  let closed = false;
  function enter(e, { lock = true } = {}) {
    if (closed) return;
    closed = true;
    // sound may only start inside a real gesture; otherwise audio/ unlocks itself on the first one
    if (e?.isTrusted) {
      try {
        if (ctx.audio?.unlock) ctx.audio.unlock()?.catch?.(() => {});
        else ctx.bus.emit('audio:unlock');
      } catch { /* ignore */ }
    }
    // pointer lock must be requested inside the click gesture (desktop only)
    if (lock && fine && !touch && e?.type === 'click') {
      try {
        const p = ctx.renderer?.domElement?.requestPointerLock?.();
        if (p?.catch) p.catch(() => {});
      } catch { /* ignore */ }
    }
    el.classList.add('out');
    setTimeout(() => el.remove(), 750);
    onEnter?.();
  }
  enterBtn.addEventListener('click', enter);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === enterBtn ? aboutBtn : enterBtn).focus(); }
  });

  return {
    el,
    show() {
      requestAnimationFrame(() => { el.classList.add('in'); enterBtn.focus({ preventScroll: true }); });
    },
    enter,
    get open() { return !closed; },
  };
}
