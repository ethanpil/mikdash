#!/usr/bin/env node
// UI behaviour checks (dev only). Starts its own Vite server; drives keyboard, pointer and API paths; prints PASS/FAIL.
//   node src/ui/dev/uitest.mjs [--q low] [--out shots/ui]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const q = args.includes('--q') ? args[args.indexOf('--q') + 1] : 'low';
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'shots/ui';
mkdirSync(resolve(root, out), { recursive: true });
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`); if (!ok) fails++; };
const logs = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${base}?q=${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 150000, polling: 250 });
  await page.waitForTimeout(800);
  const ev = (js) => page.evaluate(js);

  // settings API
  check('ctx.settings get/set + bus', await ev(() => {
    const c = __mikdash; let got = null;
    const off = c.bus.on('settings:change', (e) => { got = e; });
    c.settings.set('mouseSensitivity', 1.4); off();
    return c.settings.get('mouseSensitivity') === 1.4 && got?.key === 'mouseSensitivity' && localStorage.getItem('mikdash.mouseSensitivity') === '1.4';
  }));
  await ev(() => __mikdash.settings.set('mouseSensitivity', 1));

  // intro: Enter key closes it
  check('intro visible after boot', await ev(() => !!document.querySelector('.mk-intro.in')));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  check('Enter closes intro', await ev(() => !document.querySelector('.mk-intro')));

  // the first Tabs never land on an invisible floating tag; the location card is named by its place
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  check('Tab skips invisible event tags', await ev(() => { const a = document.activeElement; return !(a?.classList?.contains('mk-tag') && +getComputedStyle(a).opacity < 0.2); }),
    await ev(() => document.activeElement?.className || 'body'));
  check('location card label names the place', await ev(() => { const id = __mikdash.zones?.current; const n = (__mikdash.zones?.content?.[id]?.name?.en || '').split(' — ')[0]; return !!n && document.querySelector('.mk-loc').getAttribute('aria-label').includes(n); }),
    await ev(() => document.querySelector('.mk-loc').getAttribute('aria-label')));
  await ev(() => document.activeElement?.blur?.());

  // the compass strip follows the heading (qa-r1 UI-1: a NaN comparison froze it at ≈ 244°)
  const comp = [];
  for (const hd of [0, 90, 180]) {
    await page.evaluate((h) => __mikdash.player.setLook(h, 0), hd);
    await page.waitForTimeout(150);
    comp.push(await ev(() => ({ h: __mikdash.player.heading, x: parseFloat((document.querySelector('.mk-compass__strip').style.transform.match(/-?[\d.]+/) || ['NaN'])[0]) })));
  }
  check('compass strip turns with the heading (centre = heading)', comp.every((c) => Math.abs(c.x - (140 - (c.h + 180) * 2.2)) < 1) && new Set(comp.map((c) => c.x)).size === 3, JSON.stringify(comp));

  // floating tags at the dawn start never overlap (qa-r1 UI-3: three tags within 18 px)
  await ev(() => __mikdash.player.setLook(270, 10));
  await page.waitForTimeout(700);
  const tagRects = () => page.evaluate(() => [...document.querySelectorAll('.mk-tag')].filter((t) => +getComputedStyle(t).opacity > 0.2).map((t) => { const b = t.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }));
  const overlapping = (rs) => rs.some((a, i) => rs.some((b, j) => j > i && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]));
  const tr0 = await tagRects();
  check('floating tags do not overlap at the start', tr0.length >= 2 && !overlapping(tr0), JSON.stringify(tr0.map((r) => r.map(Math.round))));

  // shortcuts
  await page.keyboard.press('t'); await page.waitForTimeout(350);
  check('T opens time panel', await ev(() => __mikdash.ui.panel === 'time'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('Esc closes panel', await ev(() => __mikdash.ui.panel === null));
  await page.keyboard.press('i'); await page.waitForTimeout(300);
  check('I opens info', await ev(() => __mikdash.ui.panel === 'info'));
  await page.keyboard.press('m'); await page.waitForTimeout(300);
  check('M opens map (one panel at a time)', await ev(() => __mikdash.ui.panel === 'map' && !document.querySelector('[data-panel=info].open')));
  await page.keyboard.press('g'); await page.waitForTimeout(300);
  check('G opens settings', await ev(() => __mikdash.ui.panel === 'settings'));
  await page.keyboard.press('g'); await page.waitForTimeout(300);
  check('G again toggles closed', await ev(() => __mikdash.ui.panel === null));

  // panels cover the HUD cleanly: nothing reads through, and the docked tools stay usable beside the time drawer
  await ev(() => __mikdash.ui.open('time'));
  await page.waitForTimeout(400);
  const cov = await ev(() => {
    const q = (s) => document.querySelector(s);
    const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
    const pr = q('[data-panel=time]').getBoundingClientRect(), tr = q('.mk-tools').getBoundingClientRect();
    return { chip: vis(q('.mk-chip')), tools: vis(q('.mk-tools')), beside: tr.right <= pr.left, labels: getComputedStyle(q('.mk-labels')).display };
  });
  check('time drawer: chip hidden, tools docked beside it, tags hidden', !cov.chip && cov.tools && cov.beside && cov.labels === 'none', JSON.stringify(cov));
  await page.click('.mk-tools [data-tool=map]');
  await page.waitForTimeout(300);
  check('docked Map button switches panels', await ev(() => __mikdash.ui.panel === 'map'));
  await ev(() => __mikdash.ui.open('info'));
  await page.waitForTimeout(300);
  check('info drawer covers the location card', await ev(() => document.querySelector('.mk-loc').classList.contains('mk-covered') && getComputedStyle(document.querySelector('.mk-loc')).visibility === 'hidden'));
  await ev(() => __mikdash.ui.close());
  await page.waitForTimeout(300);
  check('closing restores the HUD', await ev(() => !document.querySelector('.mk-covered') && getComputedStyle(document.querySelector('.mk-chip')).display !== 'none'));

  // settings is a modal: Tab stays inside it, in both directions; its groups are named by their visible labels
  await ev(() => __mikdash.ui.open('settings'));
  await page.waitForTimeout(300);
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  const inSet = await ev(() => !!document.activeElement?.closest('[data-panel=settings]'));
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+Tab');
  const inSet2 = await ev(() => !!document.activeElement?.closest('[data-panel=settings]'));
  check('settings traps Tab (both directions)', inSet && inSet2);
  check('settings groups are named by their labels', await ev(() => [...document.querySelectorAll('[data-panel=settings] .mk-seg')].every((g) => /^[A-Z]/.test(g.getAttribute('aria-label')))));
  // Settings → Controls → "Show all" opens About at its controls (qa-r1 UI-4)
  await page.click('[data-panel=settings] .mk-set button:has-text("Show all")');
  await page.waitForTimeout(700);
  check('Settings "Show all" opens About at the controls', await ev(() => {
    const p = document.querySelector('[data-panel=about]'), s = document.getElementById('mk-about-controls');
    if (__mikdash.ui.panel !== 'about' || !s) return false;
    const b = p.querySelector('.mk-panel__body').getBoundingClientRect(), r = s.getBoundingClientRect();
    return r.top >= b.top - 2 && r.top < b.bottom - 40;
  }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  // About: the ? key, the HUD button; method, badges, choices, amah, controls (Space/E/Q/C, Esc, /), credits
  await page.keyboard.press('Shift+Slash');
  await page.waitForTimeout(500);
  const ab = await ev(() => {
    const p = document.querySelector('[data-panel=about]');
    const txt = p?.textContent || '';
    return {
      open: __mikdash.ui.panel === 'about',
      sections: ['method', 'badges', 'choices', 'amah', 'controls', 'credits'].every((id) => document.getElementById(`mk-about-${id}`)),
      keys: ['Space', 'E', 'Q', 'C', 'Esc', '/', 'G'].every((k) => [...p.querySelectorAll('.mk-keys .mk-kbd')].some((x) => x.textContent === k)),
      credits: ['three.js', 'three-mesh-bvh', 'postprocessing', 'N8AO', 'Open Font License'].every((k) => txt.includes(k)),
      choices: p.querySelectorAll('.mk-choice').length,
      unlinked: [...p.querySelectorAll('span.mk-src')].map((x) => x.textContent),
    };
  });
  check('? opens About with every section, the full controls and the credits', ab.open && ab.sections && ab.keys && ab.credits && ab.choices >= 8 && !ab.unlinked.length, JSON.stringify(ab));
  await page.keyboard.press('Shift+Slash');
  await page.waitForTimeout(300);
  check('? again closes About', await ev(() => __mikdash.ui.panel === null));
  await page.click('.mk-tools [data-tool=about]');
  await page.waitForTimeout(400);
  check('the HUD About button opens it', await ev(() => __mikdash.ui.panel === 'about'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // time panel: dial drag to the top (midday)
  await ev(() => __mikdash.ui.open('time'));
  await page.waitForTimeout(500);
  const box = await page.locator('[data-panel=time] svg.mk-dial').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = box.width * (118 / 344);
  await page.mouse.move(cx - r, cy + 2);
  await page.mouse.down();
  await page.mouse.move(cx - r * 0.7, cy - r * 0.7, { steps: 6 });
  await page.mouse.move(cx, cy - r, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const mid = await ev(() => { const t = __mikdash.time; return { t: t.t, chatzot: t.zmanim.chatzot, z: t.toZmani() }; });
  check('dial drag to top ≈ midday', Math.abs(mid.t - mid.chatzot) < 6, `t=${mid.t.toFixed(1)} chatzot=${mid.chatzot.toFixed(1)} ${mid.z.label}`);

  // keyboard on dial: +1 hour with PageUp
  await page.locator('[data-panel=time] .mk-dial__ring').focus();
  await page.keyboard.press('PageUp');
  const pu = await ev(() => __mikdash.time.toZmani());
  check('PageUp advances one seasonal hour', pu.half === 'day' && Math.abs(pu.hour - 7) < 0.1, `${pu.hour.toFixed(2)}`);

  // event arcs: packed into lanes, one tab stop, arrow keys move, the centre previews, Enter sets the clock
  const arcs = await ev(() => {
    const gs = [...document.querySelectorAll('[data-panel=time] .mk-ev-arc')];
    const lanes = new Set(gs.filter((g) => !g.classList.contains('is-long')).map((g) => g.querySelector('.mk-ev-arc__vis').getAttribute('d').match(/A([\d.]+)/)[1]));
    return { n: gs.length, stops: gs.filter((g) => g.getAttribute('tabindex') === '0').length, lanes: lanes.size };
  });
  check('arcs: a single tab stop, packed into lanes', arcs.n > 5 && arcs.stops === 1 && arcs.lanes >= 2, JSON.stringify(arcs));
  await page.locator('[data-panel=time] .mk-ev-arc[tabindex="0"]').focus();
  const a1 = await ev(() => document.activeElement.getAttribute('aria-label'));
  await page.keyboard.press('ArrowRight');
  const a2 = await ev(() => ({ label: document.activeElement.getAttribute('aria-label'), peek: document.querySelector('[data-panel=time] .mk-readout').classList.contains('is-peek'), title: document.querySelector('[data-panel=time] .mk-readout__title').textContent }));
  check('arrow key moves between arcs and previews in the centre', a2.label !== a1 && a2.peek && a2.label.startsWith(a2.title), `${a1.split(',')[0]} → ${a2.title}`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  check('Enter on an arc sets the clock to its start', await page.evaluate((t) => [...document.querySelectorAll('.mk-toast')].some((x) => x.textContent.includes(t)), a2.title));
  await ev(() => __mikdash.time.set(__mikdash.time.zmanim.chatzot + 54));

  // speed + pause
  await page.click('[data-panel=time] [data-speed="60"]');
  check('speed 60×', await ev(() => __mikdash.time.speed === 60 && !__mikdash.time.paused));
  await page.click('[data-panel=time] .mk-play');
  check('pause', await ev(() => __mikdash.time.paused === true));
  await page.click('[data-panel=time] .mk-play');
  await page.click('[data-panel=time] [data-speed="1"]');

  // date: next day → Hebrew date changes
  const d0 = await ev(() => document.querySelector('[data-panel=time] .mk-daterow__he').textContent);
  await page.click('[data-panel=time] .mk-daterow button[aria-label="Next day"]');
  await page.waitForTimeout(250);
  const d1 = await ev(() => ({ he: document.querySelector('[data-panel=time] .mk-daterow__he').textContent, ds: __mikdash.time.dateString, input: document.querySelector('[data-panel=time] input[type=date]').value }));
  check('next day updates date + Hebrew date', d1.ds === '2026-11-03' && d1.input === d1.ds && d1.he !== d0, `${d0} → ${d1.he}`);
  await ev(() => __mikdash.time.setDate('2026-11-02'));

  // grouped offerings: a speed choice each, headers named after their stage (qa-r1 UI-9)
  await ev(() => __mikdash.time.set(__mikdash.time.fromZmani('day', 3)));
  await page.waitForTimeout(600);
  const dg = await ev(() => {
    document.querySelectorAll('[data-panel=time] .mk-dyn:not(.is-open) .mk-mev__hit').forEach((b) => b.click());
    const t = [...document.querySelectorAll('[data-panel=time] .mk-dyn .mk-mev__title')].map((e) => e.textContent);
    return { n: t.length, distinct: new Set(t).size, selects: document.querySelectorAll('[data-panel=time] .mk-dyn select').length, t };
  });
  check('offering groups: a speed choice each, headers named by their stage', dg.n > 0 && dg.selects === dg.n && dg.distinct === dg.n, JSON.stringify(dg));
  await page.screenshot({ path: resolve(root, out, 'test-time-dyn.png') });

  // jump to an event start, then lists show it active
  await ev(() => __mikdash.time.set(__mikdash.time.fromZmani('day', 8.6)));
  await page.waitForTimeout(400);
  const act = await ev(() => [...document.querySelectorAll('[data-panel=time] .mk-ev.is-active .mk-ev__title')].map((e) => e.textContent));
  check('happening now at day 8.6 lists the afternoon Tamid', act.some((t) => /afternoon tamid/i.test(t)), act.join(' | '));
  await page.screenshot({ path: resolve(root, out, 'test-time-afternoon.png') });

  // Go (instant) on the first active row → teleports via fade
  const before = await ev(() => { const p = __mikdash.player.position; return [p.x, p.z]; });
  await page.selectOption('[data-panel=time] .mk-ev.is-active .mk-select', 'instant');
  await page.click('[data-panel=time] .mk-ev.is-active .mk-btn--primary');
  await page.waitForTimeout(1500);
  const after = await ev(() => { const p = __mikdash.player.position; const s = __mikdash.units.w2m(p); return { x: p.x, z: p.z, X: s.X, Y: s.Y, panel: __mikdash.ui.panel, veil: getComputedStyle(document.querySelector('.mk-veil')).opacity }; });
  check('Go (instant) moves the player and closes the panel', Math.hypot(after.x - before[0], after.z - before[1]) > 5 && after.panel === null && +after.veil < 0.05,
    `now at site ${after.X.toFixed(1)},${after.Y.toFixed(1)} veil ${after.veil}`);

  // the row's speed choice is sticky (it set the default to 'instant')
  check('row speed choice becomes the default', await ev(() => __mikdash.settings.get('travelSpeed') === 'instant'));
  // Go (walk) from the map: status pill shows, cancel hides it
  await ev(() => __mikdash.settings.set('travelSpeed', 'walk'));
  await ev(() => __mikdash.ui.open('map'));
  await page.waitForTimeout(400);
  // a click selects a place; a double-click goes there (the map closes so the walk is seen)
  const mb = await page.locator('[data-panel=map] .mk-mapv__stage').boundingBox();
  await page.mouse.dblclick(mb.x + mb.width * 0.5, mb.y + mb.height * 0.75);
  await page.waitForTimeout(600);
  const st = await ev(() => ({ hidden: document.querySelector('.mk-status').hidden, text: document.querySelector('.mk-status').textContent, mode: __mikdash.player.mode, panel: __mikdash.ui.panel }));
  check('map double-click starts a walk with a status pill (map closes)', !st.hidden && st.panel === null, `${st.text} · mode ${st.mode}`);
  await page.screenshot({ path: resolve(root, out, 'test-walking.png') });
  await ev(() => __mikdash.player.cancel());
  await page.waitForTimeout(300);
  check('cancel hides the status pill', await ev(() => document.querySelector('.mk-status').hidden));

  // captions
  await ev(() => __mikdash.bus.emit('caption', { id: 'barkai', text: { en: '"Barkai!" — the east is alight (Tamid 3:2)', he: 'בַּרְקַאי!' }, duration: 4 }));
  await page.waitForTimeout(500);
  check('caption shown (en + he)', await ev(() => { const c = document.querySelector('.mk-cap.in'); return !!c && /Barkai/.test(c.textContent) && !!c.querySelector('[lang=he]'); }));
  await page.screenshot({ path: resolve(root, out, 'test-caption.png') });

  // settings effects
  await ev(() => __mikdash.settings.set('fov', 75));
  check('fov setting applies to camera', await ev(() => Math.abs(__mikdash.camera.fov - 75) < 0.01));
  await ev(() => __mikdash.settings.set('fov', 62));
  await ev(() => __mikdash.time.set(__mikdash.time.zmanim.alot - 6));
  await page.waitForTimeout(400);
  const tagsOn = await ev(() => document.querySelectorAll('.mk-tag').length);
  await ev(() => __mikdash.settings.set('labels', false));
  await page.waitForTimeout(400);
  const tagsOff = await ev(() => document.querySelectorAll('.mk-tag').length);
  check('floating labels toggle', tagsOn > 0 && tagsOff === 0, `${tagsOn} → ${tagsOff}`);
  await ev(() => __mikdash.settings.set('labels', true));
  await ev(() => __mikdash.settings.set('reducedMotion', true));
  check('reduced motion class + headBob follows', await ev(() => document.getElementById('ui-root').classList.contains('mk-reduce') && __mikdash.settings.get('headBob') === false));
  await ev(() => { __mikdash.settings.set('reducedMotion', false); localStorage.removeItem('mikdash.reducedMotion'); });

  // crossing into a place an Israelite could not enter is announced once, with its rule and source
  const ek = await ev(() => {
    const c = __mikdash;
    c.bus.emit('zone:change', { zone: 'ezrat-yisrael' });
    c.bus.emit('zone:change', { zone: 'ezrat-kohanim' });
    return document.querySelector('.mk-loc').classList.contains('is-restricted');
  });
  await page.waitForTimeout(300);
  const note = await ev(() => [...document.querySelectorAll('.mk-toast')].map((t) => t.textContent).find((t) => /Ezrat Kohanim/.test(t)) || '');
  check('entering Ezrat Kohanim announces its access rule (and tints the card)', ek && /semichah/.test(note) && /Kelim 1:8/.test(note), note);
  await ev(() => { __mikdash.bus.emit('zone:change', { zone: 'har-habayit' }); __mikdash.bus.emit('zone:change', { zone: 'ezrat-kohanim' }); });
  await page.waitForTimeout(300);
  // stepping down to Har HaBayit took the notice away; coming straight back (boundary flapping) does not bring it again
  check('the notice does not repeat on re-entry', await ev(() => [...document.querySelectorAll('.mk-toast.in')].filter((t) => /Ezrat Kohanim/.test(t.textContent)).length === 0));
  // the notice quotes the place's own rule whole, citation and all, and adds no second citation (qa-r1 UI-7: "— 8). (Kelim 1:8)")
  await ev(() => { __mikdash.bus.emit('zone:change', { zone: 'har-habayit' }); __mikdash.bus.emit('zone:change', { zone: 'kevesh' }); });
  await page.waitForTimeout(300);
  const kv = await ev(() => ({ access: __mikdash.zones.content.kevesh.access, toasts: [...document.querySelectorAll('.mk-toast')].map((t) => t.textContent) }));
  const kt = kv.toasts.find((t) => /Kevesh/.test(t)) || '';
  check('the Kevesh notice starts its rule from the beginning, with one citation', kt.includes(kv.access.slice(0, 24)) && !/\)\.\s*\(/.test(kt), kt);
  check('stepping down out of the place takes its notice away', await ev(async () => {
    __mikdash.bus.emit('zone:change', { zone: 'ezrat-yisrael' });
    await new Promise((r) => setTimeout(r, 600));
    return ![...document.querySelectorAll('.mk-toast')].some((t) => /Kevesh/.test(t.textContent));
  }));
  // a Go takes the access notice away too
  await ev(() => { __mikdash.bus.emit('zone:change', { zone: 'har-habayit' }); __mikdash.bus.emit('zone:change', { zone: 'heichal' }); });
  await page.waitForTimeout(300);
  const hadHeichal = await ev(() => [...document.querySelectorAll('.mk-toast')].some((t) => /observer/.test(t.textContent)));
  await ev(() => __mikdash.ui.open('time'));
  await page.waitForTimeout(500);
  await page.selectOption('[data-panel=time] .mk-ev.is-active .mk-select', 'walk');
  await page.click('[data-panel=time] .mk-ev.is-active .mk-btn--primary');
  await page.waitForTimeout(700);
  check('a Go takes the access notice away', hadHeichal && await ev(() => ![...document.querySelectorAll('.mk-toast')].some((t) => /observer/.test(t.textContent))));
  await ev(() => __mikdash.player.cancel());
  await ev(() => __mikdash.settings.set('travelSpeed', 'walk'));

  // Shabbat night is not "night on Friday"; Saturday night is motza'ei Shabbat (qa-r1 UI-8)
  const days = await ev(async () => {
    const f = await import('/src/ui/format.js');
    const z = { alot: 290, sunrise: 370, sunset: 1000, tzeit: 1025 };
    return [[5, 'friday', 1200], [5, 'friday', 1010], [6, 'shabbat', 1200], [1, 'weekday', 1200], [6, 'shabbat', 100]]
      .map(([weekday, dayType, t]) => `${f.dayPhrase({ zmanim: z, weekday, dayType }, t, 'night')} | ${f.dayBadge({ zmanim: z, weekday, dayType }, t)}`);
  });
  check('day boundaries named by the halachic day', days[0] === 'Shabbat night (Friday evening) | Shabbat night' && /^dusk as Shabbat begins/.test(days[1])
    && days[2] === "motza'ei Shabbat (Saturday night) | Motza'ei Shabbat" && days[3] === 'Monday evening, the night of Tuesday | Weekday' && days[4] === 'night on Shabbat | Shabbat', days.join(' / '));

  // the time panel survives a missing clock (synchronous: no frame runs while ctx.time is gone)
  const nc = await ev(() => {
    const c = __mikdash, t = c.time;
    let err = null, shown = false;
    c.time = undefined;
    try {
      c.ui.open('time');
      document.querySelector('[data-panel=time] .mk-play').click();
      document.querySelector('[data-panel=time] .mk-step').click();
      document.querySelector('[data-panel=time] [data-speed="10"]').click();
      shown = !document.querySelector('[data-panel=time] .mk-panel__body > .mk-empty').hidden;
    } catch (e) { err = e.message; }
    c.time = t;
    c.ui.close();
    return { err, shown };
  });
  check('time panel without a clock: no errors, an empty state', !nc.err && nc.shown, JSON.stringify(nc));

  // fade(ms) dip contract
  const dip = await ev(async () => { await __mikdash.ui.fade(200); const o = +getComputedStyle(document.querySelector('.mk-veil')).opacity; await new Promise((r) => setTimeout(r, 700)); return [o, +getComputedStyle(document.querySelector('.mk-veil')).opacity]; });
  check('fade(ms) dips to black then lifts', dip[0] > 0.95 && dip[1] < 0.05, JSON.stringify(dip));

  // quality change reloads at the same place and time
  await ev(() => __mikdash.ui.open('settings'));
  await page.waitForTimeout(300);
  const [nav] = await Promise.all([
    page.waitForNavigation({ timeout: 20000 }).then(() => page.url()).catch(() => null),
    page.click('[data-panel=settings] .mk-seg button:has-text("Medium")'),
  ]);
  const u = nav ? new URL(nav) : null;
  check('quality change reloads with pos/look/t/date and no q', !!u && !u.searchParams.has('q') && u.searchParams.has('pos') && u.searchParams.has('t') && u.searchParams.get('date') === '2026-11-02', nav || 'no navigation');
  await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 150000, polling: 250 });
  check('after reload: tier from storage is medium', await ev(() => __mikdash.quality.key === 'medium' && localStorage.getItem('mikdash.quality') === 'medium'));
  await ev(() => localStorage.clear());

  // ---------------- phone (390×844, touch): sheets, toasts, drag to dismiss ----------------
  const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  ph.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[phone ${m.type()}] ${m.text()}`); });
  ph.on('pageerror', (e) => logs.push(`[phone pageerror] ${e.message}`));
  await ph.goto(`${base}?q=${q}`, { waitUntil: 'load' });
  await ph.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 150000, polling: 250 });
  await ph.evaluate(() => __mikdash.ui.enter());
  await ph.waitForTimeout(900);
  // touch: ghost controls where the thumbs go, for the first seconds (qa-r1 UI-4: phones got no hint at all)
  check('phone: ghost walk / look controls after Enter', await ph.evaluate(() => { const g = document.querySelector('.mk-touchhint'); return !!g && !g.hidden && getComputedStyle(g).display !== 'none' && !document.querySelector('.mk-hints'); }));
  await ph.screenshot({ path: resolve(root, out, 'test-phone-start.png') });
  const rect = (sel) => ph.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }, sel);
  const hits = (a, b) => a.r > b.l && a.l < b.r && a.b > b.t && a.t < b.b;
  await ph.evaluate(() => __mikdash.ui.toast('Clock set to ≈ 05:58 · The great gate is opened'));
  await ph.waitForTimeout(400);
  const [tr, lr, tl] = [await rect('.mk-toast'), await rect('.mk-loc'), await rect('.mk-tools')];
  check('phone: toast clear of the location card and the tools', !hits(tr, lr) && !hits(tr, tl), JSON.stringify({ toast: tr, loc: lr, tools: tl }));
  await ph.evaluate(() => __mikdash.ui.open('time'));
  await ph.waitForTimeout(500);
  check('phone: an open sheet hides the tool column, the chip stays', await ph.evaluate(() => document.querySelector('.mk-tools').classList.contains('mk-covered') && !document.querySelector('.mk-chip').classList.contains('mk-covered')));
  // qa-r2 UI-R2-4: the ghost joystick / look pill are still in their first seconds here, but not through the panel
  const hintOp = await ph.evaluate(() => { const g = document.querySelector('.mk-touchhint'); return g && !g.hidden ? +getComputedStyle(g).opacity : null; });
  check('phone: the first-run touch hints do not show through an open panel', hintOp !== null && hintOp < 0.02, `opacity ${hintOp}`);
  const listTop = await ph.evaluate(() => document.querySelector('[data-panel=time] .mk-evs .mk-ev')?.getBoundingClientRect().top ?? 9999);
  check('phone: the first event row starts above the fold', listTop < 844 - 60, `top ${Math.round(listTop)}`);
  await ph.screenshot({ path: resolve(root, out, 'test-phone-time.png') });
  const hb = await rect('[data-panel=time] .mk-panel__title');
  await ph.mouse.move(hb.l + 20, hb.t + 8);
  await ph.mouse.down();
  await ph.mouse.move(hb.l + 20, hb.t + 120, { steps: 4 });
  const midDrag = await ph.evaluate(() => getComputedStyle(document.querySelector('[data-panel=time]')).transform);
  await ph.mouse.move(hb.l + 20, hb.t + 400, { steps: 6 });
  await ph.mouse.up();
  await ph.waitForTimeout(500);
  check('phone: dragging the sheet down dismisses it', await ph.evaluate(() => __mikdash.ui.panel === null) && midDrag !== 'none', midDrag);
  await ph.evaluate(() => __mikdash.ui.open('info'));
  await ph.waitForTimeout(400);
  const hb2 = await rect('[data-panel=info] .mk-panel__title');
  await ph.mouse.move(hb2.l + 20, hb2.t + 8);
  await ph.mouse.down();
  await ph.mouse.move(hb2.l + 20, hb2.t + 40, { steps: 3 });
  await ph.mouse.up();
  await ph.waitForTimeout(400);
  check('phone: a short drag springs back', await ph.evaluate(() => __mikdash.ui.panel === 'info' && getComputedStyle(document.querySelector('[data-panel=info]')).transform === 'none'));

  // touch on the floating tags (qa-r1 UI-3): inside the view, apart; a drag that starts on one looks; a tap opens the hour
  const cdp = await ph.context().newCDPSession(ph);
  const touchPath = async (pts) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1], id: 1 }] });
    for (const [x, y] of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }); await ph.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await ph.evaluate(() => { __mikdash.ui.close(); __mikdash.time.set(__mikdash.time.zmanim.alot - 6); __mikdash.player.setLook(270, 10); });
  await ph.waitForTimeout(1200);
  const pt = await ph.evaluate(() => [...document.querySelectorAll('.mk-tag')].filter((t) => +getComputedStyle(t).opacity > 0.2).map((t) => { const b = t.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }));
  const ptOverlap = pt.some((a, i) => pt.some((b, j) => j > i && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]));
  check('phone: tags apart and inside the view', pt.length > 0 && !ptOverlap && pt.every((r) => r[0] >= 0 && r[2] <= 390), JSON.stringify(pt.map((r) => r.map(Math.round))));
  if (pt.length) {
    // on the tag, in the right half if it reaches there (the player's left 45 % is the walk joystick)
    const [x, y] = [Math.min(pt[0][2] - 12, Math.max(pt[0][0] + 24, 200)), (pt[0][1] + pt[0][3]) / 2];
    const p0 = await ph.evaluate(() => ({ h: __mikdash.player.heading, x: __mikdash.player.position.x, z: __mikdash.player.position.z }));
    await touchPath(Array.from({ length: 11 }, (_, i) => [x + i * 12, y + i * 2]));
    await ph.waitForTimeout(300);
    const p1 = await ph.evaluate(() => ({ h: __mikdash.player.heading, x: __mikdash.player.position.x, z: __mikdash.player.position.z, panel: __mikdash.ui.panel }));
    const turn = Math.abs(((p1.h - p0.h + 540) % 360) - 180), moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    check('phone: a drag that starts on a tag reaches the view (look, or the walk joystick on the left)', (x >= 200 ? turn > 5 : moved > 0.2) && p1.panel === null,
      `at x ${Math.round(x)}: turned ${turn.toFixed(1)}°, moved ${moved.toFixed(2)} m`);
    await ph.evaluate(() => __mikdash.player.setLook(270, 10));
    await ph.waitForTimeout(600);
    const tg = await ph.evaluate(() => { const t = [...document.querySelectorAll('.mk-tag')].find((e) => +getComputedStyle(e).opacity > 0.2); if (!t) return null; const b = t.getBoundingClientRect(); return [b.left + 20, (b.top + b.bottom) / 2]; });
    if (tg) await touchPath([tg]);
    await ph.waitForTimeout(500);
    check('phone: a tap on a tag opens the hour at its event', !!tg && await ph.evaluate(() => __mikdash.ui.panel === 'time'));
  }
  // a pinch on a panel does not zoom the page (qa-r1 UI-6: it stuck at 5×); the map's own pinch still zooms the plan
  await ph.evaluate(() => __mikdash.ui.open('info'));
  await ph.waitForTimeout(600);
  const pinch = async (cx, cy) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 20, y: cy, id: 1 }, { x: cx + 20, y: cy, id: 2 }] });
    for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 20 - i * 9, y: cy - i * 4, id: 1 }, { x: cx + 20 + i * 9, y: cy + i * 4, id: 2 }] }); await ph.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await ph.waitForTimeout(400);
  };
  const ib = await rect('[data-panel=info] .mk-panel__body');
  await pinch((ib.l + ib.r) / 2, (ib.t + ib.b) / 2);
  const s1 = await ph.evaluate(() => visualViewport.scale);
  const lb = await rect('.mk-chip');
  await pinch((lb.l + lb.r) / 2, lb.b + 4);
  const s2 = await ph.evaluate(() => visualViewport.scale);
  await ph.evaluate(() => __mikdash.ui.open('map'));
  await ph.waitForTimeout(900);
  const k0 = await ph.evaluate(() => __mikdash.ui.map?.view()?.k);
  await pinch(195, 450);
  const k1 = await ph.evaluate(() => __mikdash.ui.map?.view()?.k);
  const s3 = await ph.evaluate(() => visualViewport.scale);
  check('phone: pinches on a panel and the HUD leave the page at 1×; the map still zooms', s1 === 1 && s2 === 1 && s3 === 1 && k1 > k0 * 1.5, JSON.stringify({ s1, s2, s3, k0, k1 }));
  await ph.close();
} catch (e) {
  console.error(e);
  fails++;
} finally {
  console.log(logs.length ? `console (${logs.length}):\n  ${logs.slice(0, 40).join('\n  ')}` : 'console: clean');
  await browser.close();
  await server.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
