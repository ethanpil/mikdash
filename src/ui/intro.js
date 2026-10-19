// Intro overlay shown after boot: title, framing paragraph (from the live clock and place), controls, Enter.
import { h, he } from './dom.js';
import { hebrewAt, WEEKDAYS } from './format.js';

export function createIntro(app, { onEnter }) {
  const { ctx, data } = app;
  const touch = matchMedia?.('(pointer: coarse)').matches;
  const fine = matchMedia?.('(pointer: fine)').matches;

  const time = ctx.time;
  const hd = time ? hebrewAt(time, time.t) : null;
  const wd = time ? WEEKDAYS[time.weekday] : '';
  const ordinary = time?.dayType === 'weekday' ? 'an ordinary ' : '';
  const z = time?.zmanim;
  const when = !z ? '' : (time.t >= z.alot - 30 && time.t < z.alot ? 'slightly before dawn'
    : time.t >= z.alot && time.t < z.sunrise ? 'first light'
      : time.t >= z.sunrise && time.t < z.sunset ? 'daytime'
        : time.t >= z.sunset && time.t < z.tzeit ? 'dusk' : 'night');
  const custom = ctx.params?.pos || ctx.params?.at;
  const place = custom ? `you stand in ${data.zone(data.currentZoneId())?.name?.en || 'the precinct'}` : 'you stand at the outer steps leading into the Temple';

  const helpRows = [];
  if (!touch || fine) {
    helpRows.push(['W A S D', 'walk'], ['Shift', 'run'], ['Mouse', 'look around (click the view)'], ['F', 'fly / walk'],
      ['T', 'the hour & what is happening'], ['I', 'about this place'], ['M', 'plan'], ['G', 'settings']);
  }
  if (touch) {
    helpRows.push(['Left thumb', 'walk'], ['Right thumb', 'look around'], ['Two fingers', 'tap to run / walk'], ['Clock', 'tap for the hour']);
  }
  const keys = (k) => (/^[A-Z](\s[A-Z])*$|^Shift$|^Esc$/.test(k) ? k.split(' ').map((x) => h('span.mk-kbd', x)) : h('span.mk-kbd', k));

  const enterBtn = h('button.mk-btn.mk-btn--primary.mk-intro__go', { type: 'button' }, 'Enter');
  const el = h('div.mk-intro.mk-live', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mk-intro-title', 'aria-describedby': 'mk-intro-text' },
    h('div.mk-intro__card',
      h('h1.mk-intro__title', { id: 'mk-intro-title', lang: 'he', dir: 'rtl' }, 'מקדש', h('span.sr-only', { lang: 'en' }, ' — Mikdash')),
      h('div.mk-intro__sub', { 'aria-hidden': 'true' }, 'Mikdash'),
      h('div.mk-orn', { 'aria-hidden': 'true' }, h('i')),
      h('p.mk-intro__text', { id: 'mk-intro-text' },
        'The Second Temple in its final, Herodian form, as ', h('em', 'Mishnah Middot'), ' measures it and ', h('em', 'Tamid'),
        ' and the Rambam describe its service. ',
        time ? `It is ${when} on ${ordinary}${wd}${hd?.en ? `, ${hd.en.replace(/ \d{4}$/, '')}` : ''}, and ${place}.` : `${place[0].toUpperCase()}${place.slice(1)}.`),
      hd?.he ? h('p.mk-intro__fine', he(hd.he)) : null,
      h('div.mk-intro__help', helpRows.map(([k, t]) => h('div', h('span', keys(k)), h('span', t)))),
      enterBtn,
      h('p.mk-intro__fine', 'Every measure comes from the sources; where they are silent, the reconstruction says so.')));

  let closed = false;
  function enter(e) {
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
    if (fine && !touch && e?.type === 'click') {
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
    if (e.key === 'Tab') { e.preventDefault(); enterBtn.focus(); }
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
