// First run and returning visitors (console §3.9). First run (no localStorage 'mikdash.seen'): the Menu opens in the
// Welcome state — מקדש, the live framing sentence and the Hebrew date, three lines for this device, [Enter the courts]
// and "How this was reconstructed ›" — then up to three coach marks, one at a time (each goes on its action or after
// 8 s; 'mikdash.coach'). The touch joystick / look ghosts show in the first touch session only. Returning visitors skip
// the Welcome; "Welcome back · Esc opens the menu" shows in their first 3 returning sessions; a new version puts a dot
// on Help → What's new and, once, on the beacon.
import { h, he } from '../dom.js';
import { ico } from './icons.js';
import { hebrewAt, dayPhrase } from '../format.js';
import { welcomeLines, keyCaps, ESSENTIALS } from '../controls.js';

/** the console's version: a change shows "What's new" (Help) and a dot on the beacon once */
export const UI_VERSION = '2026.11-luach';
export const WHATS_NEW = [
  'One Menu for everything: press Esc (or click the Menu button, top-left; on touch, bottom-right). It always shows where you are, with a live map.',
  'Click or tap anyone or anything to learn what it is and see it in action.',
  'E now inspects what you face; Space still rises when flying, and Q or C sink.',
  'Search everything — places, rites, people, things, words, settings — in English, Hebrew or transliteration (/ or Ctrl K).',
  'Go ▸ walks, runs or moves you at once, at ½× to 10× pace; the place you enter is named as you arrive.',
];

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export function createWelcome(app) {
  const { ctx, data } = app;
  const seen = ls.get('mikdash.seen');
  const firstRun = !seen;
  const versionChanged = !!seen && seen !== UI_VERSION;
  // a visitor of the interface before this console ('1', or a version before 2026.11): the whole interface and the E key
  // changed, so the three coach marks run once for them too
  const preConsole = versionChanged && !(/^\d{4}\.\d{2}/.test(seen) && seen >= '2026.11');
  let open = false, entered = false;

  // ---------------- the Welcome view ----------------
  const sentence = h('p.mk-welcome__text', { id: 'mk-welcome-text' });
  const heDate = h('p.mk-welcome__he');
  const lines = h('div.mk-welcome__lines');
  const enterBtn = h('button.mk-btn.mk-btn--primary.mk-welcome__go', { type: 'button', on: { click: (e) => enter(e) } }, 'Enter the courts');
  const method = h('button.mk-linkbtn.mk-welcome__method', { type: 'button', on: { click: (e) => { enter(e, { lock: false }); app.open('learn', { section: 'method' }); } } }, 'How this was reconstructed ›');
  const el = h('div.mk-welcome', { role: 'document', 'aria-labelledby': 'mk-welcome-title', 'aria-describedby': 'mk-welcome-text' },
    h('h1.mk-welcome__title', { id: 'mk-welcome-title', lang: 'he', dir: 'rtl' }, 'מקדש', h('span.sr-only', { lang: 'en' }, ' — Mikdash')),
    h('div.mk-welcome__sub', { 'aria-hidden': 'true' }, 'Mikdash'),
    h('div.mk-orn', { 'aria-hidden': 'true' }, h('i')),
    sentence, heDate, lines,
    h('div.mk-welcome__cta', enterBtn),
    h('p.mk-welcome__fine', ESSENTIALS),
    h('p.mk-welcome__fine', 'Every measure comes from the sources; where they are silent, the reconstruction says so.'),
    method);

  function fill() {
    const time = ctx.time;
    const hd = time ? hebrewAt(time, time.t) : null;
    const z = time?.zmanim;
    const when = !z ? '' : (time.t >= z.alot - 30 && time.t < z.alot ? 'slightly before dawn'
      : time.t >= z.alot && time.t < z.sunrise ? 'first light'
        : time.t >= z.sunrise && time.t < z.sunset ? 'daytime' : 'night');
    const day = z ? dayPhrase(time, time.t, when) : '';
    const custom = ctx.params?.pos || ctx.params?.at;
    const place = custom ? `you stand in ${(data.zone(data.currentZoneId())?.name?.en || 'the precinct').split(' — ')[0]}` : 'you stand at the outer steps leading into the Temple';
    sentence.replaceChildren('The Second Temple in its final, Herodian form, as ', h('em', 'Mishnah Middot'), ' measures it and ', h('em', 'Tamid'),
      ' and the Rambam describe its service. ',
      day ? `It is ${day}${hd?.en ? `, ${hd.en.replace(/ \d{4}$/, '')}` : ''}, and ${place}.` : `${place[0].toUpperCase()}${place.slice(1)}.`);
    heDate.replaceChildren(hd?.he ? he(hd.he) : '');
    const dev = app.input.mode === 'pad' ? 'pad' : app.coarse ? 'touch' : 'mouse';
    lines.replaceChildren(...welcomeLines(dev).map(([k, t]) => h('div.mk-welcome__line', h('span.mk-welcome__caps', keyCaps(k)), h('span', t))));
  }

  // ---------------- coach marks ----------------
  const coachTxt = h('span');
  const coach = h('div.mk-coach.mk-live', { role: 'status', hidden: true }, coachTxt,
    h('button.mk-hbtn', { type: 'button', on: { click: () => nextCoach() } }, h('span', 'Got it')));
  const MARKS = [
    { id: 'menu', text: 'Your Menu: where you are, the map, the hour and everything else', at: 'beacon', until: 'ui:menu' },
    { id: 'pick', text: app.coarse ? 'Tap anyone or anything to learn what it is' : 'Click anyone or anything to learn what it is', at: 'centre', until: 'ui:card', needs: () => !!ctx.inspect?.pick },
    { id: 'dot', text: 'The gold dot is you', at: 'disc' },
  ];
  let coachI = -1, coachT = 0, coachOff = null;
  function nextCoach() {
    clearTimeout(coachT);
    coachOff?.();
    coachOff = null;
    if (coachI >= 0) ls.set('mikdash.coach', String(coachI + 1));
    coachI++;
    while (coachI < MARKS.length && MARKS[coachI].needs && !MARKS[coachI].needs()) coachI++;
    const m = MARKS[coachI];
    if (!m || app.menuOpen()) { coach.hidden = true; if (m && app.menuOpen()) { coachI--; waitClosed(); } return; }
    coachTxt.textContent = m.text;
    coach.dataset.at = m.at;
    coach.hidden = false;
    coach.classList.remove('in');
    void coach.offsetWidth;
    coach.classList.add('in');
    if (m.until) coachOff = ctx.bus.on(m.until, (e) => { if (m.until !== 'ui:menu' || e?.open) nextCoach(); });
    coachT = setTimeout(nextCoach, 8000);
  }
  function waitClosed() { const off = ctx.bus.on('ui:menu', (e) => { if (!e?.open) { off(); setTimeout(nextCoach, 600); } }); }
  function startCoach() {
    const done = +(ls.get('mikdash.coach') || 0);
    if (done >= MARKS.length) return;
    coachI = done - 1;
    setTimeout(nextCoach, 900);
  }

  // ---------------- touch ghosts (first touch session) ----------------
  const ghosts = h('div.mk-touchhint', { 'aria-hidden': 'true', hidden: true },
    h('div.mk-touchhint__joy', h('i'), h('span', 'Drag to walk')),
    h('div.mk-touchhint__look', h('b', ico('prev'), ico('next')), h('span', 'Drag to look')));
  function showGhosts() {
    if (!app.coarse || ls.get('mikdash.touchSeen')) return;
    ls.set('mikdash.touchSeen', '1');
    ghosts.hidden = false;
    const canvas = ctx.renderer?.domElement;
    const off = () => { ghosts.classList.add('out'); setTimeout(() => { ghosts.hidden = true; }, 900); canvas?.removeEventListener('pointerdown', off); };
    canvas?.addEventListener('pointerdown', off);
    setTimeout(off, 9000);
  }

  // ---------------- enter ----------------
  function enter(e, { lock = true } = {}) {
    if (!open) return;
    open = false;
    entered = true;
    app.root.classList.remove('mk-intro-open');
    // sound may only start inside a real gesture; otherwise audio/ unlocks itself on the first one
    if (e?.isTrusted) {
      try { if (ctx.audio?.unlock) ctx.audio.unlock()?.catch?.(() => {}); else ctx.bus.emit('audio:unlock'); } catch { /* ignore */ }
    }
    ls.set('mikdash.seen', UI_VERSION);
    app.closeWelcome();
    // pointer lock must be requested inside the click gesture (desktop, look mode 'lock')
    if (lock && e?.type === 'click' && !app.coarse && ctx.settings.get('lookMode') !== 'drag') {
      try { const p = ctx.renderer?.domElement?.requestPointerLock?.(); if (p?.catch) p.catch(() => {}); } catch { /* ignore */ }
    }
    showGhosts();
    startCoach();
  }

  return {
    el, coach, ghosts,
    get open() { return open; },
    get firstRun() { return firstRun; },
    get versionChanged() { return versionChanged; },
    get entered() { return entered; },
    /** at 'firstFrame': the Welcome (first run, or always without storage) or the returning-visitor notice */
    start({ resume = false } = {}) {
      if (resume) { entered = true; return; }
      // the Welcome is open from the first frame (keys, picks and the boot's Enter pause follow it), but its docked panel
      // is painted once the boot has settled (app.afterSettle: its first raster competed with the first view's links)
      if (firstRun) {
        app.root.classList.add('mk-intro-open');
        open = true;
        app.afterSettle(() => { if (!open) return; fill(); app.openWelcome(); });
        return;
      }
      entered = true;
      if (versionChanged) { app.beacon.setNew(true); setTimeout(() => app.beacon.setNew(false), 30000); ls.set('mikdash.seen', UI_VERSION); app.flags.whatsNew = true; }
      if (preConsole) { ls.set('mikdash.coach', '0'); startCoach(); }
      const n = +(ls.get('mikdash.returns') || 0);
      if (n < 3) {
        ls.set('mikdash.returns', String(n + 1));
        const k = app.input.cap('menu');
        setTimeout(() => app.toast(k ? `Welcome back · ${k} opens the menu` : 'Welcome back · the Menu button opens the menu', 3200), 800);
      }
    },
    /** Help → Replay the welcome */
    replay() { open = true; app.root.classList.add('mk-intro-open'); fill(); app.openWelcome(); },
    enter,
    focus() { enterBtn.focus({ preventScroll: true }); },
  };
}
