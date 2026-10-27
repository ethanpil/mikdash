#!/usr/bin/env node
// Console behaviour checks (dev only; console-design §7.1). Starts its own Vite server and drives the app in Edge
// (Playwright) at desktop 1280×720 (mouse), 1920×1080, phone 390×844 and 360×740 (touch, DPR 2), phone landscape 844×390
// (touch), tablet 1024×768 (touch) and 768×1024. Ports every uitest.mjs and maptest.mjs check onto the console, plus the
// console's own: the beacon, wake, invocation per device (pointer lock emulated with a stubbed pointerLockElement, the
// gamepad with a stubbed navigator.getGamepads), sections, search, cards, travel, the area banner, modules, captions,
// performance guards. Prints PASS/FAIL; exit 1 on any failure.
//   node src/ui/dev/consoletest.mjs [--q low] [--out shots/console-test] [--only desk,phone,landscape,tablet,wide]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const q = arg('--q', 'low');
const out = arg('--out', 'shots/console-test');
const only = new Set((arg('--only', 'desk,map,phone,landscape,tablet,wide')).split(','));
mkdirSync(resolve(root, out), { recursive: true });
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
let fails = 0, passes = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`); if (ok) passes++; else fails++; };
const logs = [];
const shot = (pg, name) => pg.screenshot({ path: resolve(root, out, `${name}.png`) });
const overlaps = (rs) => { for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) return `${a.id} × ${b.id}`; } return null; };

/** a fresh context; opts.fresh: no stored settings; init(page) before load; enter: dismiss the Welcome */
async function boot(name, ctxOpts, { enter = true, query = '', init = null } = {}) {
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${name} ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[${name} pageerror] ${e.message}`));
  if (init) await page.addInitScript(init);
  await page.goto(`${base}?q=${q}${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 180000, polling: 250 });
  await page.waitForTimeout(700);
  if (enter) { await page.evaluate(() => __mikdash.ui.enter()); await page.waitForTimeout(500); }
  return page;
}
const st = (pg) => pg.evaluate(() => __mikdash.ui.console.state());
const vis = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.05; }, sel);
const rect = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, sel);

try {
  // =================================================================== desktop 1280×720
  if (only.has('desk') || only.has('map')) {
    const page = await boot('desk', { viewport: { width: 1280, height: 720 } }, {
      enter: false,
      // the old travel speed migrates to way + pace (console §4.3)
      init: () => { if (!sessionStorage.getItem('mk-test-init')) { sessionStorage.setItem('mk-test-init', '1'); localStorage.setItem('mikdash.travelSpeed', 'fast'); } },
    });
    const ev = (fn, a) => page.evaluate(fn, a);

    if (only.has('desk')) {
      // ---------------- settings ----------------
      check('ctx.settings get/set + bus', await ev(() => {
        const c = __mikdash; let got = null;
        const off = c.bus.on('settings:change', (e) => { got = e; });
        c.settings.set('mouseSensitivity', 1.4); off();
        return c.settings.get('mouseSensitivity') === 1.4 && got?.key === 'mouseSensitivity' && localStorage.getItem('mikdash.mouseSensitivity') === '1.4';
      }));
      await ev(() => __mikdash.settings.set('mouseSensitivity', 1));
      check('travelSpeed migrates to travelWay + travelPace (fast → walk 2×), then is removed', await ev(() => __mikdash.settings.get('travelWay') === 'walk' && __mikdash.settings.get('travelPace') === 2 && localStorage.getItem('mikdash.travelSpeed') === null),
        await ev(() => `${__mikdash.settings.get('travelWay')} ${__mikdash.settings.get('travelPace')}`));
      await ev(() => __mikdash.settings.set('travelPace', 1));

      // ---------------- Welcome ----------------
      // (its panel is painted once the boot has settled, ~2 s after the first frame: app.js afterSettle)
      await page.waitForFunction(() => __mikdash.ui.console.state().view?.type === 'welcome', null, { timeout: 10000 }).catch(() => {});
      const w0 = await st(page);
      check('first run: the Menu opens in the Welcome state, docked', w0.open && w0.welcome && w0.layout === 'dock' && w0.view?.type === 'welcome', JSON.stringify(w0));
      check('Welcome: מקדש, the framing sentence, three device lines, Enter the courts', await ev(() => {
        const w = document.querySelector('.mk-welcome');
        return !!w && /מקדש/.test(w.textContent) && /Herodian/.test(w.textContent) && w.querySelectorAll('.mk-welcome__line').length === 3 && /Enter the courts/.test(w.textContent);
      }));
      await shot(page, 'desk-welcome');
      const ctaIn = async () => ev(() => { const b = document.querySelector('.mk-welcome__go').getBoundingClientRect(); const v = document.querySelector('.mk-welcomewrap').getBoundingClientRect(); return { b: Math.round(b.bottom), t: Math.round(b.top), vb: Math.round(v.bottom), ih: innerHeight }; });
      const cta1 = await ctaIn();
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.waitForTimeout(400);
      const cta2 = await ctaIn();
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(400);
      check('Welcome at 1280×720 and 1366×768: "Enter the courts" is in view', [cta1, cta2].every((c) => c.t >= 0 && c.b <= c.vb && c.b <= c.ih), JSON.stringify({ cta1, cta2 }));
      check('boot: the sleeping quick chips are out of the Tab order, and already labelled', await ev(() => [...document.querySelectorAll('.mk-qchip')].every((c) => c.tabIndex === -1) && /hour/.test(document.querySelector('.mk-qchip--hour').textContent)),
        JSON.stringify(await ev(() => [...document.querySelectorAll('.mk-qchip')].map((c) => `${c.tabIndex}:${c.textContent}`))));
      // a rail tab beside the Welcome, then Close: the Welcome ends; nothing is left swallowing keys or picks
      await page.click('.mk-tab[data-section=time]');
      await page.waitForTimeout(400);
      const wr = await ev(() => ({ s: __mikdash.ui.console.state(), intro: document.getElementById('ui-root').classList.contains('mk-intro-open') }));
      check('a rail tab during the Welcome ends it and opens that section', !wr.s.welcome && !wr.intro && wr.s.view?.type === 'section' && wr.s.view.id === 'time', JSON.stringify(wr));
      await page.click('.mk-head__close');
      await page.waitForTimeout(400);
      await ev(() => document.activeElement?.blur?.());
      await page.keyboard.press('t');
      await page.waitForTimeout(400);
      check('…then Close, and T opens Time; picking and markers are on', await ev(() => __mikdash.ui.panel === 'time' && !__mikdash.ui.console.state().welcome && !document.querySelector('.mk-picklayer').classList.contains('is-off')));
      await page.keyboard.press('t');
      await page.waitForTimeout(300);
      // Help → Replay the welcome: the Welcome again, for the Enter check
      await ev(() => __mikdash.ui.open('help', { topic: 'welcome' }));
      await page.waitForTimeout(600);
      check('Help → Replay the welcome shows it again', (await st(page)).welcome);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(900);
      const w1 = await st(page);
      check('Enter closes the Welcome and remembers the visit', !w1.open && !w1.welcome && !!(await ev(() => localStorage.getItem('mikdash.seen'))), JSON.stringify(w1));

      // ---------------- the beacon ----------------
      const bc = await ev(() => {
        const b = document.querySelector('.mk-beacon'), r = b.getBoundingClientRect();
        return { label: b.getAttribute('aria-label'), keys: b.getAttribute('aria-keyshortcuts'), text: b.textContent, cap: b.querySelector('.mk-beacon__cap')?.textContent, disc: !!b.querySelector('canvas.mk-mini__map'), x: r.left, y: r.top, he: b.querySelector('.mk-beacon__he')?.textContent };
      });
      check('beacon: disc, Hebrew and English names, "Menu", key cap Esc, top-left', bc.disc && !!bc.he && /Menu/.test(bc.text) && bc.cap === 'Esc' && bc.x < 40 && bc.y < 40, JSON.stringify(bc));
      check('beacon label names the place and its sanctity, with Escape', await ev(() => { const id = __mikdash.zones?.current; const n = (__mikdash.zones?.content?.[id]?.name?.en || '').split(' — ')[0]; const l = document.querySelector('.mk-beacon').getAttribute('aria-label'); return !!n && l.includes(n) && /^Menu — /.test(l) && /sanctity/.test(l); }) && bc.keys === 'Escape', bc.label);
      // a fresh page: sequential focus starts at the top of the document
      await ev(() => { document.activeElement?.blur?.(); document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute('tabindex'); });
      await page.keyboard.press('Tab');
      check('the beacon is the first Tab stop', await ev(() => document.activeElement?.classList.contains('mk-beacon')), await ev(() => document.activeElement?.className));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      check('Enter on the beacon opens the Menu (focus moves into it)', (await st(page)).open && await ev(() => document.querySelector('.mk-menu').contains(document.activeElement)));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      check('Esc closes it; focus returns to the beacon', !(await st(page)).open && await ev(() => document.activeElement?.classList.contains('mk-beacon')));
      await ev(() => document.activeElement?.blur?.());

      // ---------------- wake ----------------
      await page.waitForTimeout(4600);
      await page.mouse.move(400, 400); await page.mouse.move(460, 430, { steps: 4 });
      await page.waitForTimeout(200);
      check('a mouse move wakes the beacon: the quick chips within 200 ms', await ev(() => document.querySelector('.mk-wake').classList.contains('is-awake') && /hour/.test(document.querySelector('.mk-qchip--hour').textContent)));
      await shot(page, 'desk-wake');
      await page.waitForTimeout(4600);
      check('…and they go after 4 s', await ev(() => !document.querySelector('.mk-wake').classList.contains('is-awake')));
      await ev(() => { document.activeElement?.blur?.(); document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute('tabindex'); });
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      check('asleep, the quick chips are not Tab stops (the second stop is past them)', await ev(() => !document.activeElement?.classList.contains('mk-qchip')), await ev(() => document.activeElement?.className));
      await ev(() => document.activeElement?.blur?.());
      await page.mouse.move(1000, 600);
      await ev(() => document.activeElement?.blur?.());

      // ---------------- accelerators (from the world) ----------------
      await page.keyboard.press('t'); await page.waitForTimeout(400);
      check('T opens the Menu at Time', await ev(() => __mikdash.ui.panel === 'time'));
      await page.keyboard.press('t'); await page.waitForTimeout(400);
      check('T again closes it', await ev(() => __mikdash.ui.panel === null));
      await page.keyboard.press('i'); await page.waitForTimeout(400);
      check('I opens Here', await ev(() => __mikdash.ui.panel === 'here'));
      await page.keyboard.press('m'); await page.waitForTimeout(500);
      check('M switches to the Map (one view at a time)', await ev(() => __mikdash.ui.panel === 'map' && document.querySelectorAll('.mk-menu__view.is-current').length === 1));
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      check('Esc closes the Menu', await ev(() => __mikdash.ui.panel === null));
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      check('Esc (pointer free) opens the Menu at the last section used', await ev(() => __mikdash.ui.panel === 'map'));
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      await page.keyboard.press('g'); await page.waitForTimeout(400);
      check('G (silent alias) opens Settings', await ev(() => __mikdash.ui.panel === 'settings'));
      await page.keyboard.press('g'); await page.waitForTimeout(300);
      check('G again toggles closed', await ev(() => __mikdash.ui.panel === null));
      await page.keyboard.press('p'); await page.waitForTimeout(400);
      check('P pauses the clock; the beacon disc shows ❚❚', await ev(() => __mikdash.time.paused && document.querySelector('.mk-mini__speed').textContent === '❚❚'));
      await page.keyboard.press('p');
      await page.keyboard.press('Control+k'); await page.waitForTimeout(400);
      check('Ctrl+K opens the search, focused', await ev(() => document.activeElement?.classList.contains('mk-search__input') && __mikdash.ui.console.state().view?.type === 'search'));
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      await ev(() => __mikdash.ui.close());

      // ---------------- the Menu: dock, header on every view, labels ----------------
      await ev(() => __mikdash.ui.open('here'));
      await page.waitForTimeout(500);
      const dock = await rect(page, '.mk-menu');
      const free = await ev(() => __mikdash.ui.console.free());
      check('dock: the Menu on the right, 560 px, the world free on the left', dock && Math.abs(dock.w - 560) < 2 && Math.abs(dock.r - 1268) < 2 && free.r > 560 && free.r < 590, JSON.stringify({ dock, free }));
      const sections = await ev(() => [...document.querySelectorAll('.mk-rail [role=tab]')].map((t) => t.dataset.section));
      check('eight sections in the rail, in order', sections.join() === 'here,happening,map,time,learn,listen,settings,help', sections.join());
      const hdr = [];
      for (const s of sections) {
        await ev((x) => __mikdash.ui.open(x), s);
        await page.waitForTimeout(s === 'map' ? 700 : 300);
        hdr.push(await ev((x) => {
          const v = (sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; };
          return { s: x, disc: v('.mk-head__disc'), name: v('.mk-head__en') && !!document.querySelector('.mk-head__en').textContent, about: v('.mk-head__about'), clock: v('.mk-head__clockbtn') };
        }, s));
      }
      check('every section starts with the header: minimap, names, About this place, clock', hdr.every((x) => x.disc && x.name && x.about && x.clock), JSON.stringify(hdr.filter((x) => !(x.disc && x.name && x.about && x.clock))));
      const hh = await ev(() => Math.round(document.querySelector('.mk-head').getBoundingClientRect().height));
      check('the dock header at 1280×720 stays near the spec (≤ 210 px; it was 266)', hh <= 210, `${hh} px`);
      await ev(() => __mikdash.ui.open('learn'));
      await ev(() => { document.querySelector('.mk-menu__view.is-current').scrollTop = 9999; });
      check('scrolling a section never hides the header', await vis(page, '.mk-head__disc') && await vis(page, '.mk-head__about'));
      check('every icon has a visible label (rail, header actions, Close)', await ev(() => [...document.querySelectorAll('.mk-rail .mk-tab')].every((t) => t.querySelector('.mk-tab__label')?.textContent.trim())
        && ['.mk-head__fly', '.mk-head__sound', '.mk-head__close', '.mk-head__play'].every((s) => document.querySelector(s)?.textContent.trim().length > 1)));
      // rail keyboard
      await page.locator('.mk-tab[data-section=learn]').focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      check('rail: ↓ moves to the next section (roving tabindex)', await ev(() => __mikdash.ui.panel === 'listen' && document.activeElement?.dataset.section === 'listen' && document.querySelectorAll('.mk-rail [tabindex="0"]').length === 1));
      await page.keyboard.press('End'); await page.waitForTimeout(200);
      check('rail: End goes to the last (Help)', await ev(() => __mikdash.ui.panel === 'help'));
      // the world beside the docked Menu
      await ev(() => { __mikdash.ui.open('here'); document.activeElement?.blur?.(); });
      await page.waitForTimeout(300);
      await page.mouse.click(300, 400);
      await page.waitForTimeout(300);
      check('a click on the world never closes the Menu', (await st(page)).open);
      await ev(() => document.activeElement?.blur?.());
      const p0 = await ev(() => __mikdash.player.position.toArray());
      await page.keyboard.down('w'); await page.waitForTimeout(600); await page.keyboard.up('w');
      const p1 = await ev(() => __mikdash.player.position.toArray());
      check('W A S D still walk with the docked Menu open', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 0.2, `${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2)} m`);
      await ev(() => __mikdash.ui.close());

      // ---------------- Help and Learn (the old About's content) ----------------
      await page.keyboard.press('Shift+Slash'); await page.waitForTimeout(500);
      const hp = await ev(() => {
        const v = document.querySelector('.mk-menu__view.is-current');
        return { open: __mikdash.ui.panel === 'help', ess: /Esc = Menu/.test(v.textContent), keys: ['Space', 'E', 'Q', 'C', 'Esc', '/', 'M', 'T', 'P'].every((k) => [...v.querySelectorAll('.mk-keys .mk-kbd')].some((x) => x.textContent === k)), devices: v.querySelectorAll('.mk-help__dev button').length };
      });
      check('? opens Help: the essentials, the full controls, four devices', hp.open && hp.ess && hp.keys && hp.devices === 4, JSON.stringify(hp));
      await page.click('.mk-help__dev [data-device=pad]');
      check('Help: the device switcher shows the gamepad controls', await ev(() => /Start \/ Menu/.test(document.querySelector('.mk-help__keys').textContent)));
      await page.keyboard.press('Shift+Slash'); await page.waitForTimeout(300);
      check('? again closes Help', await ev(() => __mikdash.ui.panel === null));
      const lr = {};
      for (const id of ['method', 'choices', 'amah', 'credits', 'how', 'words', 'offerings', 'people', 'places', 'things', 'rites']) {
        await ev((x) => __mikdash.ui.open('learn', { section: x }), id);
        await page.waitForTimeout(id === 'words' ? 900 : 400);
        lr[id] = await ev(() => { const b = document.querySelector('.mk-learn__body'); return { n: b?.querySelectorAll('button, .mk-choice, li, p').length || 0, txt: b?.textContent || '', unlinked: [...(b?.querySelectorAll('span.mk-src') || [])].map((x) => x.textContent) }; });
      }
      check('Learn: method, where the sources differ (≥ 8), the amah, credits with every licence', /traditional Jewish sources/.test(lr.method.txt) && (lr.choices.txt.match(/Shown/g) || []).length >= 8 && /Har HaBayit's 500 amot/.test(lr.amah.txt)
        && ['three.js', 'three-mesh-bvh', 'postprocessing', 'N8AO', 'Open Font License'].every((k) => lr.credits.txt.includes(k)) && !lr.choices.unlinked.length, JSON.stringify({ choices: (lr.choices.txt.match(/Shown/g) || []).length, unlinked: lr.choices.unlinked }));
      check('Learn: words (the whole glossary), offerings, people, places, things, rites, how to read', lr.words.n > 300 && lr.offerings.n > 10 && lr.people.n > 5 && lr.places.n > 40 && lr.things.n > 40 && lr.rites.n > 20 && /ladder/.test(lr.how.txt),
        JSON.stringify(Object.fromEntries(Object.entries(lr).map(([k, v]) => [k, v.n]))));
      await ev(() => __mikdash.ui.open('learn', { section: 'words' }));
      await page.waitForTimeout(700);
      await page.click('.mk-learn__entry >> nth=0');
      await page.waitForTimeout(500);
      check('a word opens its card: definition, sources', await ev(() => { const c = __mikdash.ui.console.card(); return c?.kind === 'term' && !!c.what?.text?.en && document.querySelectorAll('.mk-cardview .mk-src').length >= 0; }), JSON.stringify(await ev(() => __mikdash.ui.console.card()?.title)));
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      check('Esc from a card goes back one level (to Learn)', await ev(() => __mikdash.ui.console.state().view?.type === 'section' && __mikdash.ui.panel === 'learn'));
      await ev(() => __mikdash.ui.close());

      // ---------------- Time ----------------
      await ev(() => __mikdash.ui.open('time'));
      await page.waitForTimeout(700);
      const box = await page.locator('.mk-menu svg.mk-dial').boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = box.width * (118 / 344);
      await page.mouse.move(cx - r, cy + 2);
      await page.mouse.down();
      await page.mouse.move(cx - r * 0.7, cy - r * 0.7, { steps: 6 });
      await page.mouse.move(cx, cy - r, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      const mid = await ev(() => { const t = __mikdash.time; return { t: t.t, chatzot: t.zmanim.chatzot }; });
      check('dial drag to the top ≈ midday', Math.abs(mid.t - mid.chatzot) < 6, `t=${mid.t.toFixed(1)} chatzot=${mid.chatzot.toFixed(1)}`);
      await page.locator('.mk-menu .mk-dial__ring').focus();
      await page.keyboard.press('PageUp');
      const pu = await ev(() => __mikdash.time.toZmani());
      check('PageUp advances one seasonal hour', pu.half === 'day' && Math.abs(pu.hour - 7) < 0.1, `${pu.hour.toFixed(2)}`);
      const arcs = await ev(() => {
        const gs = [...document.querySelectorAll('.mk-menu .mk-ev-arc')];
        const lanes = new Set(gs.filter((g) => !g.classList.contains('is-long')).map((g) => g.querySelector('.mk-ev-arc__vis').getAttribute('d').match(/A([\d.]+)/)[1]));
        return { n: gs.length, stops: gs.filter((g) => g.getAttribute('tabindex') === '0').length, lanes: lanes.size };
      });
      check('arcs: a single tab stop, packed into lanes', arcs.n > 5 && arcs.stops === 1 && arcs.lanes >= 2, JSON.stringify(arcs));
      await page.locator('.mk-menu .mk-ev-arc[tabindex="0"]').focus();
      const a1 = await ev(() => document.activeElement.getAttribute('aria-label'));
      await page.keyboard.press('ArrowRight');
      const a2 = await ev(() => ({ label: document.activeElement.getAttribute('aria-label'), peek: document.querySelector('.mk-menu .mk-readout').classList.contains('is-peek'), title: document.querySelector('.mk-menu .mk-readout__title').textContent }));
      check('an arrow key moves between arcs and previews in the centre', a2.label !== a1 && a2.peek && a2.label.startsWith(a2.title), `${a1.split(',')[0]} → ${a2.title}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      const arcCard = await ev(() => { const c = document.querySelector('.mk-timectl__card .mk-card'); return c ? { title: c.querySelector('.mk-card__en')?.textContent, time: !!c.querySelector('[data-act=time]'), go: !!c.querySelector('[data-act=go]') } : null; });
      check('Enter on an arc opens its event card under the dial (Go, Set clock to start)', !!arcCard && arcCard.title === a2.title && arcCard.time && arcCard.go, JSON.stringify(arcCard));
      await page.click('.mk-timectl__card [data-act=time]');
      await page.waitForTimeout(200);
      const setT = await ev(() => { const ev2 = __mikdash.ui.console.state(); void ev2; const c = document.querySelector('.mk-timectl__card .mk-card'); const id = c.dataset.ref.slice(6); const e = __mikdash.schedule.byId(id); return { t: __mikdash.time.t, t0: e.t0 }; });
      check('"Set clock to start" sets the clock to the event', Math.abs(((setT.t - setT.t0 + 1440) % 1440)) < 1, JSON.stringify(setT));
      await page.click('.mk-timectl [data-speed="60"]');
      check('speed 60×', await ev(() => __mikdash.time.speed === 60 && !__mikdash.time.paused));
      await page.click('.mk-menu .mk-play');
      check('pause', await ev(() => __mikdash.time.paused === true));
      await page.click('.mk-menu .mk-play');
      await page.click('.mk-timectl [data-speed="1"]');
      await page.click('.mk-head__speed');
      await page.click('.mk-head__speedmenu [data-speed="10"]');
      check('the header speed menu sets 10×', await ev(() => __mikdash.time.speed === 10));
      await page.click('.mk-head__play');
      check('the header ❚❚ pauses', await ev(() => __mikdash.time.paused === true));
      await ev(() => { __mikdash.time.pause(false); __mikdash.time.setSpeed(1); });
      const d0 = await ev(() => document.querySelector('.mk-menu .mk-daterow__he').textContent);
      await page.click('.mk-menu .mk-daterow button[aria-label="Next day"]');
      await page.waitForTimeout(300);
      const d1 = await ev(() => ({ he: document.querySelector('.mk-menu .mk-daterow__he').textContent, ds: __mikdash.time.dateString, input: document.querySelector('.mk-menu input[type=date]').value }));
      check('next day updates the date and the Hebrew date', d1.ds === '2026-11-03' && d1.input === d1.ds && d1.he !== d0, `${d0} → ${d1.he}`);
      const dl = await ev(() => [...document.querySelectorAll('.mk-menu .mk-daterow button[aria-label$=" day"]')].map((b) => { const t = b.querySelector('.mk-daybtn__t'); return { name: b.getAttribute('aria-label'), text: t?.textContent || '', w: t?.getBoundingClientRect().width || 0 }; }));
      check('the day buttons carry visible labels (Previous, Next) that start their names', dl.length === 2 && dl.every((d) => d.w > 0 && d.text && d.name.startsWith(d.text)), JSON.stringify(dl));
      await ev(() => __mikdash.time.setDate('2026-11-02'));
      check('"How the hours are counted" lives in Time', await ev(() => /How the hours are counted/.test(document.querySelector('.mk-menu .mk-explain summary').textContent)));
      const nc = await ev(() => {
        const c = __mikdash, t = c.time;
        let err = null, shown = false;
        c.ui.close();
        c.time = undefined;
        try {
          c.ui.open('time');
          document.querySelector('.mk-menu .mk-play').click();
          document.querySelector('.mk-menu .mk-step').click();
          document.querySelector('.mk-menu .mk-timectl [data-speed="10"]').click();
          shown = !document.querySelector('.mk-menu .mk-timectl > .mk-empty').hidden;
        } catch (e) { err = e.message; }
        c.time = t;
        c.ui.close();
        return { err, shown };
      });
      check('Time without a clock: no errors, an empty state', !nc.err && nc.shown, JSON.stringify(nc));

      // ---------------- Happening ----------------
      await ev(() => { __mikdash.time.set(__mikdash.time.fromZmani('day', 3)); __mikdash.ui.open('happening'); });
      await page.waitForTimeout(900);
      const dg = await ev(() => [...document.querySelectorAll('.mk-menu .mk-hap__area')].map((ar) => [...ar.querySelectorAll('.mk-dyn > .mk-dyn__hit .mk-row__title')].map((e) => e.textContent)));
      const dgAll = dg.flat();
      check('individual offerings collapse into one row per stage and area, named by the stage', dgAll.length > 0 && dg.every((l) => new Set(l).size === l.length) && dgAll.every((x) => /^\d+ /.test(x)), JSON.stringify(dg));
      check('every event row has exactly Go (and Show me with the inspect core) — no speed selects', await ev(() => [...document.querySelectorAll('.mk-menu .mk-row:not(.mk-dyn)')].every((r) => r.querySelectorAll(':scope > .mk-row__acts > [data-act], :scope > .mk-row__acts > .mk-go').length <= 2 && !r.querySelector('select'))));
      await shot(page, 'desk-happening');
      await ev(() => __mikdash.time.set(__mikdash.time.fromZmani('day', 8.6)));
      await page.waitForTimeout(700);
      const act = await ev(() => [...document.querySelectorAll('.mk-menu__view.is-current .mk-evs > .mk-row.is-active .mk-row__title')].map((e) => e.textContent));
      check('Happening at day 8.6 lists the afternoon tamid', act.some((t) => /afternoon tamid/i.test(t)), act.slice(0, 6).join(' | '));
      const nAll = await ev(() => document.querySelectorAll('.mk-menu .mk-hap__now .mk-row').length);
      await page.click('.mk-hap__filter [data-filter=here]');
      await page.waitForTimeout(400);
      const nHere = await ev(() => document.querySelectorAll('.mk-menu .mk-hap__now .mk-row').length);
      check('the Here filter narrows the list', nHere <= nAll, `${nAll} → ${nHere}`);
      await page.click('.mk-hap__filter [data-filter=all]');
      await page.waitForTimeout(400);
      // the Go menu: way Instant becomes the default
      await page.click('.mk-menu__view.is-current .mk-evs > .mk-row.is-active:not(.mk-dyn) .mk-go__more');
      await page.click('.mk-gomenu [data-way=instant]');
      check('the Go menu sets the default way (sticky)', await ev(() => __mikdash.settings.get('travelWay') === 'instant' && /Instant/.test(document.querySelector('.mk-menu__view.is-current .mk-evs > .mk-row.is-active:not(.mk-dyn) .mk-go__sub').textContent)));
      await page.keyboard.press('Escape');
      const before = await ev(() => { const p = __mikdash.player.position; return [p.x, p.z]; });
      const bnBefore = await ev(() => JSON.stringify(__mikdash.ui.console.banners().slice(-1)[0] || null));
      const goTitle = await ev(() => document.querySelector('.mk-menu__view.is-current .mk-evs > .mk-row.is-active:not(.mk-dyn) .mk-row__title, .mk-menu__view.is-current .mk-evs > .mk-row.is-active:not(.mk-dyn) .mk-row__en')?.textContent || null);
      await page.click('.mk-menu__view.is-current .mk-evs > .mk-row.is-active:not(.mk-dyn) .mk-go__main');
      await page.waitForTimeout(1600);
      const after = await ev(() => { const p = __mikdash.player.position; return { x: p.x, z: p.z, open: __mikdash.ui.console.state().open, veil: getComputedStyle(document.querySelector('.mk-veil')).opacity, banners: __mikdash.ui.console.banners(), kick: document.querySelector('.mk-banner__kick').textContent }; });
      check('Go (instant) moves the observer; the docked Menu stays open; the veil lifts', Math.hypot(after.x - before[0], after.z - before[1]) > 5 && after.open && +after.veil < 0.05, `veil ${after.veil}`);
      check('…and ARRIVED shows (instant too)', after.banners.some((b) => b.kind === 'arrive'), JSON.stringify(after.banners.slice(-2)));
      // an instant hop: ARRIVED only, once — no on-foot "Entering X" from its zone:change, during it or just after
      await page.waitForTimeout(1400);
      const sinceGo = await ev((last) => { const l = __mikdash.ui.console.banners(); return l.slice(l.findLastIndex((x) => JSON.stringify(x) === last) + 1); }, bnBefore);
      check('instant travel: ARRIVED once and no "Entering" banner (none during the trip nor ~1 s after)', sinceGo.length === 1 && sinceGo[0].kind === 'arrive', JSON.stringify(sinceGo.map((b) => `${b.kind}:${b.zone}`)));
      check('…the event Go names what you came to watch ("In place to watch", from go.js\'s context)', after.kick === 'In place to watch' && (!goTitle || sinceGo[0]?.text === goTitle || sinceGo[0]?.text.includes(goTitle) || goTitle.includes(sinceGo[0]?.text)), JSON.stringify({ kick: after.kick, goTitle, text: sinceGo[0]?.text }));
      await ev(() => __mikdash.settings.set('travelWay', 'walk'));

      // ---------------- travel bar ----------------
      await ev(() => __mikdash.ui.close());
      await ev(() => { window.__go = null; const P = __mikdash.player; const g = P.goTo; P.goTo = (t, s) => { window.__go = s; P.goTo = g; return g.call(P, t, s); }; });
      await ev(() => __mikdash.ui.card('event:' + __mikdash.schedule.active()[0].id));
      await page.waitForTimeout(400);
      await page.click('.mk-cardview .mk-go__main');
      await page.waitForTimeout(900);
      const tb = await ev(() => ({ bar: !document.querySelector('.mk-travel').hidden, txt: document.querySelector('.mk-travel__txt').textContent, mode: __mikdash.player.mode, arg: window.__go, pace: !document.querySelector('.mk-travel__pace').hidden, skip: [...document.querySelectorAll('.mk-travel button')].some((b) => /Skip/.test(b.textContent)) }));
      check('Go (walk) shows the one travel bar: "Walking to …", Stop', tb.bar && /Walking to/.test(tb.txt) && tb.mode === 'auto', JSON.stringify(tb));
      check('Go calls goTo(target, { way, pace, label })', typeof tb.arg === 'object' && tb.arg.way === 'walk' && Number.isFinite(tb.arg.pace) && !!tb.arg.label?.en, JSON.stringify(tb.arg));
      check('the travel bar has the pace buttons and Skip', tb.pace && tb.skip);
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      check('Esc never cancels a walk', await ev(() => __mikdash.player.mode === 'auto'));
      await shot(page, 'desk-travel');
      await page.click('.mk-travel__stop');
      await page.waitForTimeout(500);
      check('Stop cancels the walk and hides the bar', await ev(() => __mikdash.player.mode !== 'auto' && document.querySelector('.mk-travel').hidden));
      await ev(() => __mikdash.ui.close());

      // ---------------- the area banner ----------------
      await ev(() => __mikdash.time.set(__mikdash.time.fromZmani('day', 4)));
      const tp = async (zone) => { await ev(async (z) => { const s = __mikdash.zones.content[z].stand; await __mikdash.player.teleport({ at: s }); }, zone); await page.waitForTimeout(1600); };
      await tp('ezrat-nashim');
      const bn1 = await ev(() => __mikdash.ui.console.banners().slice(-1)[0]);
      check('on foot: entering a place shows its banner after the dwell', bn1?.zone === 'ezrat-nashim' && bn1.kind === 'enter', JSON.stringify(bn1));
      check('the banner: ENTERING, Hebrew, English, rungs, More ›', await ev(() => { const b = document.querySelector('.mk-banner'); return !b.hidden && /Entering/i.test(b.querySelector('.mk-banner__kick').textContent) && !!b.querySelector('.mk-banner__he').textContent && /Ezrat Nashim/.test(b.textContent) && /More/.test(b.textContent); }));
      await shot(page, 'desk-banner');
      await tp('ezrat-kohanim');
      const bn2 = await ev(() => ({ b: __mikdash.ui.console.banners().slice(-1)[0], rule: document.querySelector('.mk-banner__rule').textContent, toasts: [...document.querySelectorAll('.mk-toast')].map((t) => t.textContent) }));
      check('entering Ezrat Kohanim: the restricted variant with its rule and source (no toast)', bn2.b?.kind === 'restricted' && /semichah/.test(bn2.rule) && /Kelim 1:8/.test(bn2.rule) && !bn2.toasts.some((t) => /Ezrat Kohanim/.test(t)), JSON.stringify(bn2));
      check('the restricted banner reads as a sentence: "Who may enter: …"', /^Who may enter: \S/.test(bn2.rule), bn2.rule);
      await shot(page, 'desk-banner-restricted');
      // an activity marker steered under the banner keeps its diamond but loses its label (it would run under the banner)
      await page.mouse.move(4, 700);
      const mk = await ev(async () => {
        const M = __mikdash, wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const W = innerWidth, H = innerHeight, cam = M.camera;
        const tanV = Math.tan((cam.fov * Math.PI) / 360), tanH = tanV * cam.aspect, D = 180 / Math.PI;
        const bnEl = document.querySelector('.mk-banner');
        const pos = (el) => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform); return m ? { x: +m[1], y: +m[2] } : null; };
        M.ui.banner('ezrat-kohanim', { kind: 'restricted' });
        await wait(400);
        const b = bnEl.getBoundingClientRect();
        const tx = b.left + b.width * 0.3, ty = (b.top + b.bottom) / 2;
        const h0 = M.player.heading, p0 = M.player.pitch;
        const tried = [];
        for (const id of M.ui.console.markers().map((m) => m.id)) {
          const el = document.querySelector(`.mk-marker[data-ev="${CSS.escape(id)}"]`);
          if (!el) continue;
          bnEl.hidden = true; bnEl.classList.remove('in'); // (the banner away: the label as it would be)
          M.player.setLook(M.player.heading, 0);
          for (let i = 0; i < 8 && !el.classList.contains('is-on'); i++) { M.player.setLook((M.player.heading + 45) % 360, 0); await wait(160); }
          for (let i = 0; i < 5; i++) {
            const p = pos(el);
            if (!p || !el.classList.contains('is-on')) break;
            const dh = Math.atan(((p.x - W / 2) / (W / 2)) * tanH) * D - Math.atan(((tx - W / 2) / (W / 2)) * tanH) * D;
            const dp = Math.atan(((H / 2 - p.y) / (H / 2)) * tanV) * D - Math.atan(((H / 2 - ty) / (H / 2)) * tanV) * D;
            M.player.setLook((M.player.heading + dh + 360) % 360, M.player.pitch + dp);
            await wait(160);
          }
          const p = pos(el);
          const at = !!p && Math.abs(p.x - tx) < 12 && Math.abs(p.y - ty) < 12 && el.classList.contains('is-on');
          const before = el.classList.contains('is-label');
          tried.push({ id, at, before });
          if (!at || !before) continue;
          M.ui.banner('ezrat-kohanim', { kind: 'restricted' });
          await wait(400);
          const r = { id, at, before, after: el.classList.contains('is-label'), on: el.classList.contains('is-on'), banner: !bnEl.hidden };
          M.player.setLook(h0, p0);
          return r;
        }
        M.player.setLook(h0, p0);
        return { none: true, tried };
      });
      if (mk.none) console.log(`SKIP  marker under the banner: no labelled marker could be steered there (${JSON.stringify(mk.tried)})`);
      else check('a marker under the area banner stays a diamond: its label is demoted', mk.banner && mk.on && mk.before && !mk.after, JSON.stringify(mk));
      await tp('ezrat-nashim');
      const n3 = await ev(() => __mikdash.ui.console.banners().filter((b) => b.zone === 'ezrat-nashim').length);
      check('the same place is not named again within 60 s', n3 === 1, `${n3}`);
      await ev(() => __mikdash.settings.set('areaNames', 'off'));
      await tp('nikanor');
      await tp('ezrat-kohanim');
      const bnOff = await ev(() => __mikdash.ui.console.banners().slice(-2));
      check('area names off: no ordinary banner; the restricted notice still (its own setting, 90 s rule)', !bnOff.some((b) => b.zone === 'nikanor'), JSON.stringify(bnOff));
      await ev(() => __mikdash.settings.set('areaNames', 'always'));
      await tp('gazit');
      await page.click('.mk-banner__main');
      await page.waitForTimeout(500);
      check('a click on the banner opens that place (Here)', await ev(() => __mikdash.ui.panel === 'here' && /Gazit/.test(document.querySelector('.mk-menu .mk-card__en').textContent)));
      check('Lishkat HaGazit (half kodesh, half chol) is not given one rung in the header', await ev(() => /Half kodesh, half chol/.test(document.querySelector('.mk-head__sancttxt').textContent) && /Sanhedrin/.test(document.querySelector('.mk-head__sanct').title)),
        await ev(() => document.querySelector('.mk-head__sancttxt').textContent));
      await ev(() => __mikdash.ui.close());

      // ---------------- search ----------------
      await ev(() => document.activeElement?.blur?.());
      await page.keyboard.press('/');
      await page.waitForTimeout(300);
      await page.keyboard.type('kiyor', { delay: 30 });
      await page.waitForTimeout(500);
      const sr1 = await ev(() => __mikdash.ui.console.results().slice(0, 5).map((r) => r.doc.id));
      check('"/" + typing searches: the Kiyor is found', sr1.some((id) => /kiyor/.test(id)), sr1.join());
      check('search: a live result count for screen readers', await ev(() => /result/.test(document.querySelector('.mk-searchview [aria-live]').textContent)));
      await page.keyboard.press('ArrowDown');
      check('↓ marks a result (aria-activedescendant)', await ev(() => !!document.querySelector('.mk-search__input').getAttribute('aria-activedescendant')));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      check('Esc clears the field first (the search stays open)', await ev(() => document.querySelector('.mk-search__input').value === '' && __mikdash.ui.console.state().view?.type === 'search'));
      await page.keyboard.type('מזבח', { delay: 30 });
      await page.waitForTimeout(500);
      check('Hebrew: מזבח finds the Mizbeach', (await ev(() => __mikdash.ui.console.results().slice(0, 3).map((r) => r.doc.id))).includes('zone:mizbeach'));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      check('Enter opens the result (the Mizbeach, in Here)', await ev(() => __mikdash.ui.panel === 'here' && /Mizbeach/.test(document.querySelector('.mk-menu .mk-card__en').textContent)));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      check('Back from that place returns to the results', await ev(() => __mikdash.ui.console.state().view?.type === 'search' && document.querySelector('.mk-search__input').value === 'מזבח' && document.querySelectorAll('.mk-sres').length > 0));
      const topOf = async (q) => { await ev((x) => __mikdash.ui.search(x), q); await page.waitForTimeout(500); return ev(() => ({ first: document.querySelector('.mk-sres')?.dataset.id, top: !!document.querySelector('.mk-sgroup--top .mk-sres'), best: __mikdash.ui.console.results()[0]?.doc.id })); };
      const tk = await topOf('kohen');
      check('search: the best match leads as "Top result" (kohen → the role, not a place or a rite)', tk.top && tk.first === tk.best && tk.first === 'role:kohen', JSON.stringify(tk));
      const tm = await topOf('mouse');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      check('…and Enter opens it (mouse → a setting, not a rite)', /^setting:/.test(tm.first) && tm.first === tm.best && await ev(() => __mikdash.ui.panel === 'settings'), JSON.stringify(tm));
      check('search: a section by name ("map") finds the command that opens it', (await topOf('map')).first === 'cmd:open-map');
      await ev(() => __mikdash.ui.search('kiyor'));
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowRight');
      check('search: → reaches the marked row\'s buttons (Go, Show me)', await ev(() => !!document.activeElement?.closest('.mk-sres__acts')), await ev(() => document.activeElement?.className));
      await page.keyboard.press('Escape');
      check('…and Esc returns to the field', await ev(() => document.activeElement?.classList.contains('mk-search__input')));
      await ev(() => __mikdash.ui.close());
      await page.waitForTimeout(200);
      await ev(() => document.activeElement?.blur?.());
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(300);
      check('a new search session starts with an empty field (no stale query)', await ev(() => document.querySelector('.mk-search__input').value === ''));
      await ev(() => __mikdash.ui.close());
      await ev(() => __mikdash.ui.search('subtitles'));
      await page.waitForTimeout(500);
      check('settings and commands are searchable (subtitles)', (await ev(() => __mikdash.ui.console.results().map((r) => r.doc.id))).some((id) => id === 'setting:captions' || /subtitles/.test(id)));
      await ev(() => __mikdash.ui.search('pause'));
      await page.waitForTimeout(500);
      const cmd = await ev(() => __mikdash.ui.console.results().findIndex((r) => r.doc.id === 'cmd:pause'));
      check('a command is found (Pause the clock)', cmd >= 0);
      await ev(() => document.querySelector('.mk-sres[data-id="cmd:pause"] .mk-sres__main').click());
      check('…and runs from its row', await ev(() => __mikdash.time.paused));
      await ev(() => { __mikdash.time.pause(false); __mikdash.ui.close(); });

      // ---------------- cards ----------------
      const cid = await ev(() => __mikdash.schedule.active()[0].id);
      await ev((id) => __mikdash.ui.card(`event:${id}`), cid);
      await page.waitForTimeout(500);
      const cd = await ev(() => { const el = document.querySelector('.mk-cardview .mk-card'); const c = __mikdash.ui.console.card(); return { type: el.querySelector('.mk-card__type').textContent, title: !!el.querySelector('.mk-card__en').textContent, now: !el.querySelector('.mk-card__now').hidden, src: /Sources \d+/.test(el.textContent), go: !!el.querySelector('.mk-card__acts .mk-go'), map: !!el.querySelector('[data-act=map]'), kind: c?.kind }; });
      check('an event card: type chip, title, NOW, Sources n ›, Go, Map', /Rite/.test(cd.type) && cd.title && cd.now && cd.src && cd.go && cd.map && cd.kind === 'event', JSON.stringify(cd));
      await shot(page, 'desk-card');
      const hasInspect = await ev(() => !!__mikdash.inspect?.pick);
      if (hasInspect) {
        await ev(() => __mikdash.ui.open('here'));
        await page.waitForTimeout(1200);
        check('opening Here shows where you are (a place pinned by an earlier search does not stick)', await ev(() => { const z = __mikdash.zones.current; const id = typeof z === 'string' ? z : z?.id; return document.querySelector('.mk-menu__view.is-current .mk-card')?.dataset.ref === `zone:${id}`; }));
        check('Here → Nearby lists subjects with bearing and distance (inspect core)', await ev(() => { const s = document.querySelector('.mk-menu [data-sec=nearby]'); return !!s && /\d+ m/.test(s.textContent); }));
        const pk = await ev(() => { const r = [[640, 360], [500, 420], [800, 420], [640, 480]].map(([x, y]) => { try { const h = __mikdash.inspect.pick(x, y); return h ? h.kind : null; } catch (e) { return `ERR ${e.message}`; } }); return r; });
        check('picking at screen points never throws', !pk.some((x) => String(x).startsWith('ERR')), JSON.stringify(pk));
      }
      await ev(() => __mikdash.ui.close());

      // ---------------- integration: inspect × UI (pick, card, Show me, Back) ----------------
      check('the inspect core is installed in play', hasInspect);
      if (hasInspect) {
        await ev(() => __mikdash.inspect.ready);
        await ev(() => { __mikdash.time.set(__mikdash.time.fromZmani('day', 3)); __mikdash.time.pause(false); __mikdash.time.setSpeed?.(1); });
        // stand where the morning service is watched and face a figure
        const fig = await ev(async () => {
          const ev0 = __mikdash.schedule.active().find((e) => (e.participants || []).length && __mikdash.schedule.viewOf?.(e));
          const v = ev0 && __mikdash.schedule.viewOf(ev0);
          if (v) __mikdash.player.teleport(v.at ? { at: v.at, heading: v.heading } : v);
          await new Promise((r) => setTimeout(r, 1200));
          const near = __mikdash.inspect.nearby(30, { limit: 40 }).filter((i) => i.kind === 'person' && !i.crowd && /^actor:/.test(i.ref));
          for (const n of near) {
            await __mikdash.inspect.frame(n.ref, { ms: 0 });
            await new Promise((r) => setTimeout(r, 300));
            const p = __mikdash.inspect.anchorOf(n.ref);
            if (!p) continue;
            const q = p.clone(); q.y += 1.2; q.project(__mikdash.camera);
            const x = (q.x + 1) / 2 * innerWidth, y = (1 - q.y) / 2 * innerHeight;
            const hit = __mikdash.inspect.pick(x, y);
            if (hit?.ref === n.ref && !hit.alternatives?.length) return { ref: n.ref, x, y, ev: ev0.id };
          }
          return { none: near.length, ev: ev0?.id };
        });
        check('a figure in view picks to its own ref', !!fig.ref, JSON.stringify(fig));
        if (fig.ref) {
          await page.mouse.move(fig.x - 30, fig.y);
          await page.mouse.move(fig.x, fig.y, { steps: 4 });
          await page.waitForTimeout(450);
          check('hover over a person: the name tooltip and a pointer cursor', await ev(() => document.querySelector('.mk-ptip').classList.contains('in') && !!document.querySelector('.mk-ptip').textContent && document.querySelector('canvas').style.cursor === 'pointer'));
          const t0 = Date.now();
          await page.mouse.click(fig.x, fig.y);
          await page.waitForFunction(() => __mikdash.ui.console.card()?.kind === 'person', null, { timeout: 3000 }).catch(() => {});
          const pc = await ev(() => { const el = document.querySelector('.mk-cardview .mk-card'); const c = __mikdash.ui.console.card(); return { kind: c?.kind, locked: !!document.pointerLockElement, title: el?.querySelector('.mk-card__en')?.textContent, now: el && !el.querySelector('.mk-card__now').hidden, show: !!el?.querySelector('[data-act=show]'), ring: document.querySelector('.mk-ring').classList.contains('in'), top: document.querySelector('.mk-cardview').scrollTop }; });
          check('a click on a person opens the person card (no capture), with NOW and Show me', pc.kind === 'person' && !pc.locked && pc.now && pc.show, `${JSON.stringify(pc)} ${Date.now() - t0} ms`);
          check('the ring marks the subject of the open card', pc.ring);
          check('a new card opens at its top (title and NOW in view)', pc.top === 0, `${pc.top}`);
          const pa = await ev(() => { const a = document.querySelector('.mk-cardview .mk-card__acts').getBoundingClientRect(), v = document.querySelector('.mk-cardview').getBoundingClientRect(); return { actsTop: Math.round(a.top), actsBottom: Math.round(a.bottom), viewBottom: Math.round(v.bottom), chips: document.querySelectorAll('.mk-cardview .mk-card__blk .mk-src').length, srcChips: document.querySelectorAll('.mk-cardview .mk-card__srcchip').length }; });
          check('a person card at 1280×720: its actions (Show me, Go) are in view without scrolling', pa.actsBottom <= pa.viewBottom, JSON.stringify(pa));
          check('…and each WHY / WHO cites through one "n sources ›" chip, not a row of citations', pa.chips <= 3, JSON.stringify(pa));
          await shot(page, 'int-person-card');
          const snap = await ev(() => ({ t: __mikdash.time.t, h: __mikdash.player.heading }));
          await page.click('.mk-cardview [data-act=show]');
          await page.waitForFunction(() => ['showing', 'done', 'failed', 'cancelled'].includes(__mikdash.inspect.show?.phase), null, { timeout: 12000 }).catch(() => {});
          const sh = await ev(() => ({ phase: __mikdash.inspect.show?.phase, chip: !document.querySelector('.mk-showchip').hidden, txt: document.querySelector('.mk-showchip').textContent, back: __mikdash.inspect.canBack }));
          check('Show me reaches "showing"; the chip reads "Showing: X · Back to …"', sh.phase === 'showing' && sh.chip && /^Showing: /.test(sh.txt) && /Back/.test(sh.txt) && !/Showing: Showing/.test(sh.txt), JSON.stringify(sh));
          await page.waitForTimeout(500); // (the header repaints at 4 Hz)
          const hb = await ev(() => { const b = document.querySelector('.mk-head__back'); return { shown: !b.hidden, txt: b.textContent.trim(), card: document.querySelector('.mk-cardview .mk-card__back')?.textContent.trim() }; });
          check('the header\'s Back says what it undoes ("Back to 08:51"), unlike the card\'s own Back', hb.shown && /^Back to \d{2}:\d{2}$/.test(hb.txt), JSON.stringify(hb));
          await ev(() => __mikdash.bus.emit('caption', { text: 'A caption beside the Show chip, long enough to need its lane', duration: 4 }));
          await page.waitForTimeout(600);
          const capR = await ev(() => { const c = [...document.querySelectorAll('.mk-cap')].pop()?.getBoundingClientRect(), k = document.querySelector('.mk-showchip').getBoundingClientRect(); return c && { cap: Math.round(c.bottom), chip: Math.round(k.top) }; });
          check('captions ride above the Show chip', !!capR && capR.cap <= capR.chip + 1, JSON.stringify(capR));
          await shot(page, 'int-showing');
          await page.click('.mk-showchip .mk-hbtn');
          await page.waitForTimeout(1500);
          const bk = await ev((s) => ({ dt: Math.abs(__mikdash.time.t - s.t), dh: Math.abs(((__mikdash.player.heading - s.h + 540) % 360) - 180) }), snap);
          check('Back restores the clock and the view', bk.dt < 0.6 && bk.dh < 2, JSON.stringify(bk));
        }
        // a warp: the Show-me bar with Skip; captions held while warping
        await ev(() => __mikdash.ui.close());
        // 8 sim min before the next rite: its card offers "Skip ahead 8 min" (a warp, §4.1)
        const warp = await ev(() => {
          const t = __mikdash.time.t;
          for (const e of (__mikdash.schedule.upcoming(t, 40) || []).filter((x) => !x.dynamic && !x.nextDay && Number.isFinite(x.t0) && x.t0 > t + 1)) {
            __mikdash.time.set(e.t0 - 8);
            const c = __mikdash.inspect.describe(`event:${e.id}`, __mikdash.time.t);
            if ((c.actions || []).some((x) => x.kind === 'see-in-action' && x.mode === 'warp')) return e.id;
          }
          return null;
        });
        check('some rite today offers a warp ("Skip ahead …")', !!warp);
        if (warp) {
          await ev((id) => __mikdash.ui.card(`event:${id}`), warp);
          await page.waitForTimeout(300);
          await ev(() => { const b = [...document.querySelectorAll('.mk-cardview [data-act=show]')].find((x) => /Skip ahead/.test(x.textContent)) || document.querySelector('.mk-cardview [data-act=show]'); b.click(); });
          await page.waitForFunction(() => __mikdash.inspect.show?.phase === 'warping', null, { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(400);
          await ev(() => __mikdash.bus.emit('caption', { text: 'Held during the warp', duration: 3 }));
          await page.waitForTimeout(200);
          const wb = await ev(() => ({ phase: __mikdash.inspect.show?.phase, bar: !document.querySelector('.mk-showbar').hidden, mode: document.querySelector('.mk-show__mode').textContent, skip: [...document.querySelectorAll('.mk-showbar button')].some((b) => !b.hidden && /Skip/.test(b.textContent)), cap: [...document.querySelectorAll('.mk-cap')].some((c) => /Held during/.test(c.textContent)) }));
          check('a warp shows the Show-me bar: "Skipping ahead n min", Skip, Cancel', wb.phase === 'warping' && wb.bar && /Skipping ahead/.test(wb.mode) && wb.skip, JSON.stringify(wb));
          check('captions are held during the warp', wb.phase === 'warping' && !wb.cap);
          await shot(page, 'int-warp');
          await ev(() => [...document.querySelectorAll('.mk-showbar button')].find((b) => /Skip/.test(b.textContent))?.click());
          await page.waitForFunction(() => ['showing', 'done', 'failed', 'cancelled'].includes(__mikdash.inspect.show?.phase), null, { timeout: 8000 }).catch(() => {});
          check('Skip ends the warp at the moment', await ev(() => __mikdash.inspect.show?.phase === 'showing'));
          await page.waitForTimeout(400);
          check('…and the held caption is shown after it', await ev(() => [...document.querySelectorAll('.mk-cap')].some((c) => /Held during/.test(c.textContent))));
          await ev(() => __mikdash.inspect.back());
          await page.waitForTimeout(1200);
        }
        // E with the pointer free, after Esc (input mode "keyboard"): it opens the card (and announces it); Esc then
        // returns to the world — a card picked in the world is the Menu's only level
        if (fig.ref) {
          await ev(() => __mikdash.ui.close());
          await page.waitForTimeout(300);
          // the figure again, framed now (time has run since)
          const f2 = await ev(async (ref) => {
            await __mikdash.inspect.frame(ref, { ms: 0 });
            await new Promise((r) => setTimeout(r, 300));
            const p = __mikdash.inspect.anchorOf(ref);
            if (!p) return null;
            const q = p.clone(); q.y += 1.2; q.project(__mikdash.camera);
            return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight };
          }, fig.ref) || fig;
          await page.mouse.move(f2.x, f2.y, { steps: 2 });
          await page.waitForTimeout(300);
          await page.keyboard.press('Escape'); await page.waitForTimeout(300);
          await page.keyboard.press('Escape'); await page.waitForTimeout(300);
          const km = await ev(() => __mikdash.ui.console.input());
          await page.keyboard.press('KeyE');
          await page.waitForTimeout(500);
          const ek = await ev(() => ({ s: __mikdash.ui.console.state(), chooser: !document.querySelector('.mk-chooser').hidden, said: document.querySelector('.mk-picklayer .sr-only')?.textContent }));
          check('E with the pointer free after Esc (keyboard mode) opens the card, and says what it is', km === 'keyboard' && (ek.s.view?.type === 'card' || ek.chooser) && /^Ahead: /.test(ek.said || ''), JSON.stringify({ km, ...ek }));
          if (ek.chooser) await ev(() => document.querySelector('.mk-chooser .mk-pop__opt').click());
          await page.waitForTimeout(200);
          const lone = await st(page);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          check('a card picked in the world is the only level: Esc returns to the world', lone.stack.length === 1 && !(await st(page)).open, JSON.stringify(lone));
        }
        const ch = await ev(async () => {
          const I = __mikdash.inspect;
          const near = I.nearby(40, { limit: 20 }).filter((i) => /^actor:/.test(i.ref)).slice(0, 2);
          if (near.length < 2) return { none: true };
          const mk = (n, d, x) => ({ ref: n.ref, kind: 'person', label: { en: 'Woman' }, distance: d, screen: { x, y: 360 } });
          const orig = I.pick;
          I.pick = () => ({ ...mk(near[0], 5.2, 560), alternatives: [mk(near[1], 7.9, 720)] });
          try { __mikdash.bus.emit('player:tap', { x: 600, y: 360, pointerType: 'mouse' }); } finally { I.pick = orig; }
          await new Promise((r) => setTimeout(r, 200));
          const c = document.querySelector('.mk-chooser');
          const r = { shown: !c.hidden, labels: [...c.querySelectorAll('.mk-pop__opt')].map((b) => b.textContent), parent: c.parentElement?.id, z: +getComputedStyle(c).zIndex };
          c.hidden = true;
          return r;
        });
        check('chooser: look-alike candidates are told apart, and it opens above the Menu', ch.shown && ch.labels.length === 2 && new Set(ch.labels).size === 2 && ch.labels.every((l) => /\d+ m/.test(l)) && ch.parent === 'ui-root' && ch.z > 7, JSON.stringify(ch));
        // three alike at the same metre and side: finer bearing, then 0.5 m, then ordinals; a focused row rings its subject
        const ch3 = await ev(async () => {
          const I = __mikdash.inspect;
          const near = I.nearby(40, { limit: 20 }).filter((i) => /^actor:/.test(i.ref)).slice(0, 3);
          if (near.length < 3) return { none: true };
          const mk = (n, d, x) => ({ ref: n.ref, kind: 'person', label: { en: 'Kohen' }, distance: d, screen: { x, y: 360 } });
          const orig = I.pick;
          I.pick = () => ({ ...mk(near[0], 5.1, 600), alternatives: [mk(near[1], 5.3, 602), mk(near[2], 5.4, 604)] });
          try { __mikdash.bus.emit('player:tap', { x: 600, y: 360, pointerType: 'mouse' }); } finally { I.pick = orig; }
          await new Promise((r) => setTimeout(r, 200));
          const c = document.querySelector('.mk-chooser');
          const opts = [...c.querySelectorAll('.mk-pop__opt')];
          opts[2]?.focus();
          await new Promise((r) => setTimeout(r, 120));
          const r = { shown: !c.hidden, labels: opts.map((b) => b.textContent), ring: document.querySelector('.mk-ring').dataset.ref, want: near[2].ref };
          c.hidden = true;
          return r;
        });
        check('chooser: three alike rows (same name, metre and side) all read differently', ch3.none || (ch3.shown && ch3.labels.length === 3 && new Set(ch3.labels).size === 3), JSON.stringify(ch3));
        check('chooser: focusing a row rings that row\'s subject in the world', ch3.none || ch3.ring === ch3.want, JSON.stringify(ch3));
        // a subject picked in the world behind where the dock opens is turned into the free area (§4.1 step 3)
        if (fig.ref) {
          await ev(() => __mikdash.ui.close());
          await page.waitForTimeout(300);
          const projOf = (ref) => ev((r) => { const p = __mikdash.inspect.anchorOf(r); if (!p) return null; const q = p.clone(); q.y += 1.2; q.project(__mikdash.camera); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight }; }, ref);
          await ev(async (ref) => { const M = __mikdash; await M.inspect.frame(ref, { ms: 0 }); await new Promise((r) => setTimeout(r, 200)); M.player.heading = (M.player.heading - 24 + 360) % 360; }, fig.ref);
          await page.waitForTimeout(300);
          const fp = await projOf(fig.ref);
          if (fp && fp.x > 740) {
            await page.mouse.move(fp.x - 20, fp.y); await page.mouse.move(fp.x, fp.y, { steps: 3 });
            await page.waitForTimeout(450);
            await page.mouse.click(fp.x, fp.y);
            await page.waitForTimeout(250);
            await ev((ref) => { const c = document.querySelector('.mk-chooser'); if (!c.hidden) c.querySelector(`.mk-pop__opt[data-ref="${ref}"]`)?.click(); }, fig.ref);
            await page.waitForTimeout(900);
            const fr = await ev(() => ({ free: __mikdash.ui.console.free(), card: __mikdash.ui.console.card()?.ref }));
            const fa = await projOf(fig.ref);
            const cx = (fr.free.l + 1280 - fr.free.r) / 2;
            check('a person picked where the dock opens is turned to the free area\'s centre', !!fa && fr.free.r > 500 && Math.abs(fa.x - cx) < 40 && fa.x < 1280 - fr.free.r, JSON.stringify({ before: fp, after: fa, cx, free: fr.free, card: fr.card }));
          } else console.log(`SKIP  frame into the free area: the figure is not under the dock (${JSON.stringify(fp)})`);
          await ev(() => __mikdash.ui.close());
        }
        const holdRef = await ev(() => { const I = __mikdash.inspect; for (const n of I.nearby(60, { limit: 40 })) { if (!/^actor:/.test(n.ref)) continue; try { const c = I.describe(n.ref); if ((c?.holding || []).some((p) => p.what?.en || typeof p.what === 'string')) return n.ref; } catch { /* next */ } } return null; });
        if (holdRef) {
          await ev((r) => __mikdash.ui.card(r), holdRef);
          await page.waitForTimeout(500);
          await ev(() => [...document.querySelectorAll('.mk-cardview .mk-chip3--btn[aria-expanded]')].find((b) => !b.classList.contains('mk-card__srcchip'))?.click());
          await page.waitForTimeout(200);
          check('HOLDING: a prop opens what it is for in place (no hover needed)', await ev(() => { const w = document.querySelector('.mk-cardview .mk-card__holdwhat'); return !!w && !w.hidden && w.textContent.length > 10; }));
          await ev(() => __mikdash.ui.close());
        } else console.log('SKIP  HOLDING: no figure holding a described prop in view');
        const stale = await ev(async () => {
          const I = __mikdash.inspect, T = __mikdash.time, wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const strip = (x) => String(x || '').replace(/^\s*[▸◎↶►⟶→]\s*/u, '').replace(/\s*[▸►]\s*$/u, '');
          const t0 = T.t;
          for (const e of __mikdash.schedule.active().filter((x) => !x.dynamic && Number.isFinite(x.t1) && x.t1 > x.t0)) {
            const a = (I.describe(`event:${e.id}`).actions || []).find((x) => x.kind === 'see-in-action');
            if (!a) continue;
            __mikdash.ui.card(`event:${e.id}`);
            await wait(500);
            const before = document.querySelector('.mk-cardview [data-act=show]')?.textContent;
            T.set((e.t1 + 30) % 1440);
            await wait(1800);
            const after = document.querySelector('.mk-cardview [data-act=show]')?.textContent;
            const want = strip((I.describe(`event:${e.id}`).actions || []).find((x) => x.kind === 'see-in-action')?.label?.en);
            T.set(t0);
            __mikdash.ui.close();
            return { id: e.id, before, after, want };
          }
          return null;
        });
        check('an open card\'s Show me follows the clock (the label says what will happen now)', !!stale && stale.before !== stale.after && stale.after === stale.want, JSON.stringify(stale));
        // E inside the Menu does nothing (§2.3)
        await ev(() => __mikdash.ui.open('here'));
        await page.waitForTimeout(400);
        await ev(() => document.querySelector('.mk-menu .mk-rail [role=tab]')?.focus());
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(300);
        check('E with focus inside the Menu opens no card', await ev(() => __mikdash.ui.console.state().view?.type === 'section'));
        await ev(() => __mikdash.ui.close());
        // Here → Nearby at the Gazit (the Sanhedrin): the nearest 12, then "Show all n nearby ›", which expands in place
        await tp('gazit');
        await ev(() => __mikdash.ui.open('here'));
        await page.waitForTimeout(1500);
        const ng = await ev(() => ({ n: __mikdash.inspect.nearby(15, { limit: Infinity }).length, rows: document.querySelectorAll('.mk-menu .mk-nearby__b').length, all: document.querySelector('.mk-menu .mk-nearby__all')?.textContent || null }));
        check('Here → Nearby at the Gazit: the nearest 12, then "Show all n nearby ›"', ng.n > 12 && ng.rows === 12 && new RegExp(`^Show all ${ng.n} nearby`).test(ng.all || ''), JSON.stringify(ng));
        await page.click('.mk-menu .mk-nearby__all');
        await page.waitForTimeout(400);
        const ng2 = await ev(() => {
          const have = new Set([...document.querySelectorAll('.mk-menu .mk-nearby__b')].map((b) => b.dataset.ref));
          const want = __mikdash.inspect.nearby(15, { limit: Infinity });
          return { n: want.length, rows: have.size, missing: want.filter((i) => i.distance < 14.5 && !have.has(i.ref)).map((i) => i.ref), heads: [...document.querySelectorAll('.mk-menu .mk-nearby__h')].map((x) => x.textContent), focus: document.activeElement?.className };
        });
        check('…expanded, grouped by kind: every inspect.nearby(15, { limit: Infinity }) subject is reachable', ng2.n > 12 && !ng2.missing.length && ng2.heads.length >= 1 && ng2.heads.every((x) => /^(People|Animals|Things) · \d+$/.test(x)), JSON.stringify(ng2));
        await ev(() => __mikdash.ui.close());
      }

      // ---------------- integration: travel × UI (pace, way, Skip, banners on the route) ----------------
      await ev(() => { __mikdash.settings.set('travelWay', 'walk'); __mikdash.settings.set('travelPace', 1); });
      await tp('ezrat-nashim');
      await ev(() => __mikdash.ui.card('zone:mizbeach'));
      await page.waitForTimeout(400);
      await page.click('.mk-menu .mk-card__acts .mk-go__main');
      await page.waitForFunction(() => !!__mikdash.player.trip?.total, null, { timeout: 8000 }).catch(() => {});
      await ev(() => document.activeElement?.blur?.());
      await page.keyboard.press('Equal');
      await page.waitForTimeout(300);
      const tp1 = await ev(() => ({ pace: __mikdash.player.trip?.pace, pressed: document.querySelector('.mk-travel__pace [aria-pressed=true]')?.textContent, txt: document.querySelector('.mk-travel__txt').textContent }));
      check('+ during a trip raises the pace (1× → 2×) and the bar follows', tp1.pace === 2 && tp1.pressed === '2×', JSON.stringify(tp1));
      check('the travel bar shows distance and time left from the travel core', /\d+ m/.test(tp1.txt) && /~\d+ (s|min)/.test(tp1.txt), tp1.txt);
      await page.click('.mk-travel__way [data-way=run]');
      await page.waitForTimeout(300);
      check('Run in the bar switches the way mid-trip', await ev(() => __mikdash.player.trip?.way === 'run' && /Running/.test(document.querySelector('.mk-travel__txt').textContent)));
      check('the way and pace chosen in the bar become the defaults', await ev(() => __mikdash.settings.get('travelWay') === 'run' && __mikdash.settings.get('travelPace') === 2));
      await page.mouse.move(700, 300); await page.mouse.move(760, 320, { steps: 5 });
      await page.waitForTimeout(200);
      check('moving the mouse (looking) does not stop the trip', await ev(() => __mikdash.player.mode === 'auto' && !!__mikdash.player.trip));
      await ev(() => [...document.querySelectorAll('.mk-travel button')].find((b) => /Skip/.test(b.textContent)).click());
      await page.waitForFunction(() => !__mikdash.player.trip && __mikdash.player.mode !== 'auto', null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      const sk = await ev(() => ({ last: __mikdash.ui.console.banners().slice(-1)[0], bar: document.querySelector('.mk-travel').hidden, zone: __mikdash.zones.current?.id ?? __mikdash.zones.current }));
      check('Skip arrives at once: ARRIVED banner, the bar gone', sk.bar && sk.last?.kind === 'arrive', JSON.stringify(sk));
      await ev(() => __mikdash.ui.close());
      // 10× run across several places: ENTERING banners from travel:zone with a "via" breadcrumb, then ARRIVED
      await ev(() => { __mikdash.settings.set('travelWay', 'run'); __mikdash.settings.set('travelPace', 10); });
      await tp('chel');
      const nb0 = await ev(() => JSON.stringify(__mikdash.ui.console.banners().slice(-1)[0] || null));
      await ev(() => __mikdash.ui.card('zone:azarah'));
      await page.waitForTimeout(400);
      await page.click('.mk-menu .mk-card__acts .mk-go__main');
      await page.waitForTimeout(800);
      check('10× shows the comfort vignette', await ev(() => document.querySelector('.mk-vignette').classList.contains('on')));
      await page.waitForFunction(() => !__mikdash.player.trip, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(500);
      const route = await ev((last) => { const l = __mikdash.ui.console.banners(); return l.slice(l.findLastIndex((x) => JSON.stringify(x) === last) + 1); }, nb0);
      check('10× run: places on the route are named as entered, then ARRIVED', route.filter((b) => b.kind !== 'arrive').length >= 2 && route.slice(-1)[0]?.kind === 'arrive', JSON.stringify(route.map((b) => `${b.kind}:${b.zone}`)));
      check('…with a "via" breadcrumb when they come fast', route.some((b) => b.via?.length), JSON.stringify(route.map((b) => b.via)));
      await ev(() => { __mikdash.settings.set('travelWay', 'walk'); __mikdash.settings.set('travelPace', 1); __mikdash.ui.close(); });
      // trips the UI did not start (the director, a module: goTo called directly) get ARRIVED too, once per trip
      const extTrip = async (fn) => {
        const last = await ev(() => JSON.stringify(__mikdash.ui.console.banners().slice(-1)[0] || null));
        const ok = await ev(fn);
        await page.waitForTimeout(1600);
        const since = await ev((l) => { const b = __mikdash.ui.console.banners(); return b.slice(b.findLastIndex((x) => JSON.stringify(x) === l) + 1); }, last);
        return { ok, since: since.map((b) => `${b.kind}:${b.zone}`), arrive: since.filter((b) => b.kind === 'arrive').length, enter: since.filter((b) => b.kind !== 'arrive').length, zone: await ev(() => __mikdash.zones.current?.id ?? __mikdash.zones.current) };
      };
      await tp('ezrat-nashim');
      const xr = await extTrip(() => __mikdash.player.goTo({ at: __mikdash.zones.content['ezrat-yisrael'].stand }, { way: 'run', pace: 10 }));
      check('a run started outside the UI (goTo): ARRIVED once, at the place reached', xr.ok && xr.arrive === 1 && xr.since.slice(-1)[0] === `arrive:${xr.zone}`, JSON.stringify(xr));
      const xi = await extTrip(() => __mikdash.player.goTo({ at: __mikdash.zones.content['ezrat-nashim'].stand }, 'instant'));
      check('an instant hop started outside the UI: ARRIVED once, no "Entering"', xi.ok && xi.arrive === 1 && xi.enter === 0, JSON.stringify(xi));
      const xs = await extTrip(async () => { const P = __mikdash.player; const p = P.goTo({ at: __mikdash.zones.content.gazit.stand }, { way: 'walk', pace: 1 }); await new Promise((r) => setTimeout(r, 900)); P.finishTrip(); return p; });
      check('a walk started outside the UI and skipped: ARRIVED once', xs.ok && xs.arrive === 1, JSON.stringify(xs));

      // ---------------- integration: search core × UI ----------------
      const srch = async (q) => { await ev((x) => __mikdash.ui.search(x), q); await page.waitForTimeout(400); return ev(() => __mikdash.ui.console.results().slice(0, 5).map((r) => r.doc.id)); };
      check('search core: wrong layout "nzcj" → the Mizbeach first', (await srch('nzcj'))[0] === 'zone:mizbeach');
      check('search core: "kohen gadol" finds the role', (await srch('kohen gadol')).some((id) => id === 'role:kohen_gadol'));
      check('search core: "shofar" finds a thing', (await srch('shofar')).some((id) => /^(el|fire|term):/.test(id)));
      check('search core: "tamid" finds the rite', (await srch('tamid')).some((id) => /^event:/.test(id)));
      await ev(() => __mikdash.ui.close());
      // §7.2 script 3: search → Ctrl+Enter goes; during the trip + raises the pace (focus has left the field)
      await ev(() => { __mikdash.settings.set('travelWay', 'walk'); __mikdash.settings.set('travelPace', 1); document.activeElement?.blur?.(); });
      await tp('ezrat-nashim');
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(300);
      await page.keyboard.type('nikanor', { delay: 20 });
      await page.waitForTimeout(500);
      await page.keyboard.press('Control+Enter');
      await page.waitForFunction(() => !!__mikdash.player.trip?.total, null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(300);
      await page.keyboard.press('Equal');
      await page.waitForTimeout(300);
      const sg = await ev(() => ({ pace: __mikdash.player.trip?.pace, field: document.querySelector('.mk-search__input').value, focus: document.activeElement?.className }));
      check('Go from the search: the field lets go, so + raises the pace mid-trip', sg.pace === 2 && !/[=+]/.test(sg.field), JSON.stringify(sg));
      await ev(() => { __mikdash.player.cancel?.(); __mikdash.settings.set('travelPace', 1); __mikdash.ui.close(); });
      await page.waitForTimeout(300);

      // ---------------- captions ----------------
      await ev(() => __mikdash.bus.emit('caption', { id: 'barkai', text: { en: '"Barkai!" — the east is alight (Tamid 3:2)', he: 'בַּרְקַאי!' }, duration: 4 }));
      await page.waitForTimeout(500);
      check('a caption shows (en + he)', await ev(() => { const c = document.querySelector('.mk-cap.in'); return !!c && /Barkai/.test(c.textContent) && !!c.querySelector('[lang=he]'); }));
      await ev(() => __mikdash.settings.set('captions', false));
      await ev(() => __mikdash.bus.emit('caption', { text: 'Silent test line', duration: 3 }));
      await page.waitForTimeout(300);
      check('subtitles off: not shown, but logged in Listen', await ev(() => ![...document.querySelectorAll('.mk-cap')].some((c) => /Silent test/.test(c.textContent))));
      await ev(() => __mikdash.ui.open('listen'));
      await page.waitForTimeout(500);
      check('Listen: volume, sound, subtitles, music, recent captions (both lines)', await ev(() => { const v = document.querySelector('.mk-menu__view.is-current'); return ['volume', 'captions', 'musicStyle'].every((k) => v.querySelector(`[data-setting=${k}]`)) && /Silent test/.test(v.querySelector('.mk-caplog').textContent) && /Barkai/.test(v.querySelector('.mk-caplog').textContent); }));
      await ev(() => { __mikdash.settings.set('captions', true); __mikdash.ui.close(); });

      // ---------------- settings effects ----------------
      await ev(() => __mikdash.settings.set('fov', 75));
      check('fov applies to the camera', await ev(() => Math.abs(__mikdash.camera.fov - 75) < 0.01));
      await ev(() => __mikdash.settings.set('fov', 62));
      await ev(() => { __mikdash.time.set(__mikdash.time.fromZmani('day', 3)); });
      await page.waitForTimeout(1200);
      const mOn = await ev(() => __mikdash.ui.console.markers().length);
      await ev(() => __mikdash.settings.set('labels', false));
      await page.waitForTimeout(800);
      const mOff = await ev(() => __mikdash.ui.console.markers().length);
      check('activity markers: at most 3, and the setting turns them off', mOn <= 3 && mOff === 0, `${mOn} → ${mOff}`);
      await ev(() => __mikdash.settings.set('labels', true));
      await ev(() => __mikdash.settings.set('reducedMotion', true));
      check('reduced motion: class + head bob follows', await ev(() => document.getElementById('ui-root').classList.contains('mk-reduce') && __mikdash.settings.get('headBob') === false));
      check('reduced motion: the Show-me sundial (outside #ui-root) does not spin', await ev(() => { const v = document.querySelector('.mk-veiltxt'); v.classList.add('on'); const n = getComputedStyle(document.querySelector('.mk-veiltxt__glyph svg')).animationName; v.classList.remove('on'); return n === 'none'; }));
      await ev(() => { __mikdash.settings.set('reducedMotion', false); localStorage.removeItem('mikdash.reducedMotion'); });
      const days = await ev(async () => {
        const f = await import('/src/ui/format.js');
        const z = { alot: 290, sunrise: 370, sunset: 1000, tzeit: 1025 };
        return [[5, 'friday', 1200], [5, 'friday', 1010], [6, 'shabbat', 1200], [1, 'weekday', 1200], [6, 'shabbat', 100]]
          .map(([weekday, dayType, t]) => `${f.dayPhrase({ zmanim: z, weekday, dayType }, t, 'night')} | ${f.dayBadge({ zmanim: z, weekday, dayType }, t)}`);
      });
      check('day boundaries named by the halachic day', days[0] === 'Shabbat night (Friday evening) | Shabbat night' && /^dusk as Shabbat begins/.test(days[1])
        && days[2] === "motza'ei Shabbat (Saturday night) | Motza'ei Shabbat" && days[3] === 'Monday evening, the night of Tuesday | Weekday' && days[4] === 'night on Shabbat | Shabbat', days.join(' / '));
      const dip = await ev(async () => { await __mikdash.ui.fade(200); const o = +getComputedStyle(document.querySelector('.mk-veil')).opacity; await new Promise((r) => setTimeout(r, 700)); return [o, +getComputedStyle(document.querySelector('.mk-veil')).opacity]; });
      check('fade(ms) dips to black, then lifts', dip[0] > 0.95 && dip[1] < 0.05, JSON.stringify(dip));
      const fd = await ev(async () => { const s2 = {}; __mikdash.ui.fade(1, 300).then(() => { s2.a = true; }); await new Promise((r) => setTimeout(r, 100)); __mikdash.ui.fade(0, 300).then(() => { s2.b = true; }); await new Promise((r) => setTimeout(r, 1200)); return s2; });
      check('two overlapping fades both resolve (a superseded fade settles)', fd.a && fd.b, JSON.stringify(fd));
      check('no animation runs on the hidden veil (the Show-me sundial spins only while shown)', await ev(() => !document.getAnimations().some((a) => a.animationName === 'mk-spin' && a.playState === 'running')));
      const days2 = await ev(async () => { const m = await import('/src/ui/console/showbar.js'); return [m.dayText('2026-11-02', '2026-11-03'), m.dayText('2026-11-02', '2026-11-04'), m.dayText('2026-11-02', '2026-11-01')]; });
      check('the Show-me bar names the day: Tomorrow only for +1', days2[0] === 'Tomorrow' && /^Wednesday 4 Nov/.test(days2[1]) && days2[2] === 'Yesterday', days2.join(' / '));
      await ev(() => __mikdash.ui.toast('One')); await ev(() => __mikdash.ui.toast('Two')); await ev(() => __mikdash.ui.toast('Three'));
      check('notices: at most 2', await ev(() => document.querySelectorAll('.mk-toast').length <= 2));

      // ---------------- modules (AC-14) ----------------
      const mod = await ev(async () => {
        const { registerDemo } = await import('/src/ui/dev/demo-module.js');
        const d = registerDemo(__mikdash.ui);
        await new Promise((r) => setTimeout(r, 300));
        __mikdash.ui.open('demo');
        await new Promise((r) => setTimeout(r, 900)); // badges refresh at 2 Hz
        const r = { tab: !!document.querySelector('.mk-rail [data-section=demo]'), body: !!document.querySelector('[data-demo=section]'), badge: document.querySelector('.mk-rail [data-section=demo] .mk-tab__micro')?.textContent };
        __mikdash.ui.open('listen');
        await new Promise((r2) => setTimeout(r2, 300));
        r.listen = !!document.querySelector('[data-demo=listen]');
        r.setting = /Zzyzx demo flag/.test(document.querySelector('.mk-menu__view.is-current').textContent);
        __mikdash.ui.card('event:' + __mikdash.schedule.active()[0].id);
        await new Promise((r2) => setTimeout(r2, 300));
        r.action = !!document.querySelector('[data-act=module-demo-act]');
        document.querySelector('[data-act=module-demo-act]')?.click();
        __mikdash.ui.search('zzyzx');
        await new Promise((r2) => setTimeout(r2, 400));
        const ids = __mikdash.ui.console.results().map((x) => x.doc.id);
        r.doc = ids.includes('demo:tour');
        r.cmd = ids.includes('cmd:demo.cmd');
        d.off();
        await new Promise((r2) => setTimeout(r2, 300));
        __mikdash.ui.search('zzyzx');
        await new Promise((r2) => setTimeout(r2, 400));
        const ids2 = __mikdash.ui.console.results().map((x) => x.doc.id);
        r.gone = !document.querySelector('.mk-rail [data-section=demo]') && !document.querySelector('[data-demo=listen]') && !ids2.includes('demo:tour') && !ids2.includes('cmd:demo.cmd');
        r.log = d.log;
        __mikdash.ui.close();
        return r;
      });
      check('a module appears as a section (badge), a Listen block, a setting, a card action, a search doc and a command', mod.tab && mod.body && mod.badge === 'test' && mod.listen && mod.setting && mod.action && mod.doc && mod.cmd && mod.log.includes('action'), JSON.stringify(mod));
      check('…and unregisters cleanly', mod.gone && mod.log.includes('dispose'), JSON.stringify(mod.log));

      // ---------------- pointer lock (emulated) ----------------
      const pl = await ev(async () => {
        const canvas = __mikdash.renderer.domElement;
        let locked = null;
        Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => locked });
        const fire = () => document.dispatchEvent(new Event('pointerlockchange'));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const hf = document.hasFocus;
        __mikdash.ui.close();
        // Esc in the world: the browser frees the mouse → the Menu opens
        document.hasFocus = () => true;
        locked = canvas; fire(); await wait(100);
        locked = null; fire(); await wait(200);
        const esc = __mikdash.ui.console.state().open;
        __mikdash.ui.close(); await wait(100);
        // alt-tab / blur: no focus → no Menu
        document.hasFocus = () => false;
        locked = canvas; fire(); await wait(100);
        locked = null; fire(); await wait(200);
        const blur = __mikdash.ui.console.state().open;
        // leaving fullscreen
        document.hasFocus = () => true;
        locked = canvas; fire(); await wait(100);
        document.dispatchEvent(new Event('fullscreenchange'));
        locked = null; fire(); await wait(200);
        const fs = __mikdash.ui.console.state().open;
        document.hasFocus = hf;
        delete document.pointerLockElement;
        __mikdash.ui.close();
        return { esc, blur, fs };
      });
      check('pointer lock: Esc (the browser frees the mouse) opens the Menu', pl.esc, JSON.stringify(pl));
      check('pointer lock: never on alt-tab / blur, nor on leaving fullscreen', !pl.blur && !pl.fs, JSON.stringify(pl));

      // ---------------- gamepad (emulated) ----------------
      const gp = await ev(async () => {
        const pad = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', connected: true, index: 0, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
        navigator.getGamepads = () => [pad];
        window.dispatchEvent(new Event('gamepadconnected'));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const press = async (i) => { pad.buttons[i].pressed = true; await wait(120); pad.buttons[i].pressed = false; await wait(150); };
        __mikdash.ui.close();
        await press(9);
        const r = { start: __mikdash.ui.console.state().open, input: __mikdash.ui.console.input(), cap: document.querySelector('.mk-head__close .mk-chipcap')?.textContent };
        const s0 = __mikdash.ui.panel;
        await press(5);
        r.rb = __mikdash.ui.panel !== s0;
        await press(13);
        r.focusIn = document.querySelector('.mk-menu').contains(document.activeElement);
        await press(1);
        r.back = !__mikdash.ui.console.state().open;
        await press(8);
        r.view = __mikdash.ui.panel === 'map';
        await press(9);
        r.closed = !__mikdash.ui.console.state().open;
        navigator.getGamepads = () => [];
        window.dispatchEvent(new Event('gamepaddisconnected'));
        return r;
      });
      check('gamepad: Start opens the Menu, RB the next section, the D-pad moves focus, B closes, View opens the Map', gp.start && gp.rb && gp.focusIn && gp.back && gp.view && gp.closed, JSON.stringify(gp));
      check('gamepad: the key caps swap to the pad (Close shows B)', gp.input === 'pad' && gp.cap === 'B', JSON.stringify(gp));
      const gp2 = await ev(async () => {
        const pad = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', connected: true, index: 0, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
        navigator.getGamepads = () => [pad];
        window.dispatchEvent(new Event('gamepadconnected'));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const press = async (i) => { pad.buttons[i].pressed = true; await wait(120); pad.buttons[i].pressed = false; await wait(150); };
        __mikdash.ui.open('happening');
        await wait(700);
        const v = document.querySelector('.mk-menu__view.is-current');
        v.scrollTop = 0;
        v.querySelector('button')?.focus();
        pad.axes[3] = 1; await wait(800); pad.axes[3] = 0; await wait(100);
        const r = { scrolled: v.scrollTop, max: v.scrollHeight - v.clientHeight };
        await press(14);
        r.rail = !!document.activeElement?.closest('.mk-rail');
        await press(14);
        r.head = !!document.activeElement?.closest('.mk-head');
        r.focus = document.activeElement?.className;
        __mikdash.ui.close();
        navigator.getGamepads = () => [];
        window.dispatchEvent(new Event('gamepaddisconnected'));
        return r;
      });
      check('gamepad: the right stick scrolls the section; D-pad ← reaches the rail, then the header', gp2.scrolled > 50 && gp2.rail && gp2.head, JSON.stringify(gp2));
      await page.mouse.move(100, 100); await page.mouse.move(200, 200, { steps: 3 });

      // ---------------- performance guards ----------------
      // steady play, the Menu closed (the EMA spans ~60 frames)
      await ev(() => __mikdash.ui.close());
      await page.waitForTimeout(4000);
      const stt = await ev(() => __mikdash.ui.console.stats());
      const parts = Object.entries(stt.parts).map(([k, v]) => `${k} ${v.ema.toFixed(3)}`).join(', ');
      check('UI tick in play: EMA ≤ 0.3 ms', stt.tickMs <= 0.3, `${stt.tickMs.toFixed(3)} ms EMA (${parts})`);
      await ev(() => __mikdash.ui.open('here'));
      await page.waitForTimeout(4000);
      const stt2 = await ev(() => __mikdash.ui.console.stats());
      check('UI tick with Here open: EMA ≤ 0.4 ms', stt2.tickMs <= 0.4, `${stt2.tickMs.toFixed(3)} ms EMA`);
      await ev(() => __mikdash.ui.close());
      const css = ['src/ui/styles.css', 'src/ui/console/console.css'].map((f) => readFileSync(resolve(root, f), 'utf8')).join('\n');
      const kfs = [...css.matchAll(/@keyframes[^{]+\{((?:[^{}]*\{[^}]*\})*)[^}]*\}/g)].map((m) => m[1]);
      check('no CSS animation of box-shadow or filter', !kfs.some((k) => /box-shadow|filter/.test(k)), `${kfs.length} keyframes`);
      check('no transition of box-shadow or filter', !/transition:[^;]*(box-shadow|filter)/.test(css));
      await shot(page, 'desk-end');

      // ---------------- memory: no detached UI kept alive (after the timing guards: its forced GCs would skew them) ----------------
      {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('HeapProfiler.enable');
        const gc = async () => { await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(300); await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(200); };
        await ev(() => __mikdash.ui.close());
        await gc();
        const n0 = (await cdp.send('Memory.getDOMCounters')).nodes;
        await ev(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const ids = __mikdash.schedule.active().map((e) => e.id).slice(0, 10);
          for (let i = 0; i < 50; i++) { __mikdash.ui.card(`event:${ids[i % ids.length]}`); await wait(40); }
          for (const q of ['kiyor', 'altar', 'מזבח', 'tamid', 'olah', 'nzcj', 'gazit', 'kohen', 'shofar', 'menorah', 'nikanor', 'chel', 'levi', 'duchan', 'mouse', 'pause', 'incense', 'laver', 'ezrat', 'parochet']) { __mikdash.ui.search(q); await wait(90); }
          __mikdash.ui.close();
        });
        await page.waitForTimeout(300);
        await gc();
        const n1 = (await cdp.send('Memory.getDOMCounters')).nodes;
        await cdp.detach();
        check('memory: 50 cards and 20 searches leave fewer than 3000 DOM nodes behind (detached Go controls are freed)', n1 - n0 < 3000, `${n0} → ${n1}`);
      }


      // ---------------- quality change reloads; the Menu reopens at Settings ----------------
      await ev(() => __mikdash.ui.open('settings'));
      await page.waitForTimeout(300);
      const [nav] = await Promise.all([
        page.waitForNavigation({ timeout: 20000 }).then(() => page.url()).catch(() => null),
        page.click('.mk-menu [data-setting=quality] .mk-seg button:has-text("Medium")'),
      ]);
      const u = nav ? new URL(nav) : null;
      check('a quality change reloads with pos/look/t/date and no q', !!u && !u.searchParams.has('q') && u.searchParams.has('pos') && u.searchParams.has('t') && u.searchParams.get('date') === '2026-11-02', nav || 'no navigation');
      await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 180000, polling: 250 });
      await page.waitForTimeout(800);
      check('after the reload: tier medium, no Welcome, the Menu at Settings', await ev(() => __mikdash.quality.key === 'medium' && !__mikdash.ui.console.state().welcome && __mikdash.ui.panel === 'settings'),
        JSON.stringify(await ev(() => __mikdash.ui.console.state())));
      await ev(() => { localStorage.setItem('mikdash.quality', 'low'); });
    }
    await page.close();
  }

  // =================================================================== the map (desktop)
  if (only.has('map')) {
    const page = await boot('map', { viewport: { width: 1280, height: 720 } });
    const ev = (fn, a) => page.evaluate(fn, a);
    await ev(() => { __mikdash.time.pause(true); __mikdash.time.set(__mikdash.time.parse('d3')); });
    const stage = async () => page.locator('.mk-mapv__stage').boundingBox();
    const at = async (X, Y) => { const b = await stage(); const [x, y] = await ev(([a, c]) => __mikdash.ui.map.siteToScreen(a, c), [X, Y]); return [b.x + x, b.y + y]; };
    await page.waitForFunction(() => !!document.querySelector('.mk-mapv__stage') && document.querySelectorAll('.mk-mapl__opt').length > 20, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    const openMs = await ev(() => { const t0 = performance.now(); __mikdash.ui.open('map'); const t1 = performance.now(); __mikdash.ui.close(); return t1 - t0; });
    check('map prewarmed: opening it costs little main-thread time', openMs < 120, `${openMs.toFixed(1)} ms`);
    await page.waitForTimeout(400);
    await ev(() => document.activeElement?.blur?.());
    await page.keyboard.press('m');
    await page.waitForTimeout(800);
    check('M opens the Map; the dock widens to the viewport; the header shows the overview', await ev(() => { const r = document.querySelector('.mk-menu').getBoundingClientRect(); return __mikdash.ui.panel === 'map' && r.width > 1240 && document.querySelector('.mk-head .mk-mini').classList.contains('is-overview'); }));
    const zl = await ev(() => [...document.querySelectorAll('.mk-mapv__zoom button')].map((b) => { const t = b.querySelector('.mk-mapv__btnl'); return { name: b.getAttribute('aria-label'), text: t?.textContent || '', w: t?.getBoundingClientRect().width || 0 }; }));
    check('the map: Zoom in, Zoom out and Centre on me carry visible labels', zl.length === 3 && zl.every((z) => z.w > 0 && z.text && z.name.toLowerCase().includes(z.text.toLowerCase())), JSON.stringify(zl));
    await page.waitForTimeout(600); // (the overview redraws at 4 Hz)
    const ov = await ev(() => {
      const mini = document.querySelector('.mk-head .mk-mini'), m = mini.getBoundingClientRect();
      const one = (sel) => { const e = mini.querySelector(sel), r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { shown: cs.display !== 'none' && r.width > 0, x: r.left + r.width / 2 - (m.left + m.width / 2), y: r.top + r.height / 2 - (m.top + m.height / 2) }; };
      return { r: m.width / 2, dot: one('.mk-mini__dot'), halo: one('.mk-mini__halo') };
    });
    check('the overview disc keeps the gold dot and its halo, together, at your spot inside the disc', ov.dot.shown && ov.halo.shown && Math.hypot(ov.dot.x - ov.halo.x, ov.dot.y - ov.halo.y) < 1 && Math.hypot(ov.dot.x, ov.dot.y) <= ov.r && Math.hypot(ov.dot.x, ov.dot.y) > 1, JSON.stringify(ov));
    check('the places list has no search input of its own (the header search finds places)', await ev(() => !document.querySelector('.mk-mapl input')));
    const slid = async (label) => {
      const r = await ev(() => {
        const m = __mikdash.ui.map;
        const bad = [];
        for (const L of m.labelRects()) {
          const z = m.model().get(L.id);
          if (!z || z.area < 20000) continue;
          const [X, Y] = m.screenToSite((L.l + L.r) / 2, (L.t + L.b) / 2);
          if (!m.owns(L.id, X, Y)) bad.push(L.id);
        }
        return { bad, n: m.labels().length };
      });
      check(`${label}: big places are named only on their own ground`, !r.bad.length, `${r.n} labels; ${r.bad.join(', ') || 'none astray'}`);
    };
    await ev(() => __mikdash.ui.map.setView({ cx: 217, cy: 321, k: 9 }));
    await page.waitForTimeout(500);
    await slid('inside the Azarah (k 9)');
    check('…and the city, the Mount and the Chel are not named there', await ev(() => !__mikdash.ui.map.labels().some((id) => ['outside', 'har-habayit', 'chel'].includes(id))));
    for (const p of ['courts', 'sanctuary', 'mount']) { await ev((k) => __mikdash.ui.map.fit(k), p); await page.waitForTimeout(500); await slid(p); }
    const roofAt = [];
    for (const k of [6, 9, 16]) { await ev((kk) => __mikdash.ui.map.setView({ cx: 137, cy: 330.5, k: kk }), k); await page.waitForTimeout(400); if ((await ev(() => __mikdash.ui.map.labels())).includes('roof')) roofAt.push(k); }
    check('the roof is labelled when the Heichal is zoomed in', roofAt.length >= 2, `at k ${roofAt.join(', ') || 'none'}`);
    check('the Heichal offers its aliyah and roof under "Also here"', await ev(() => { const o = __mikdash.ui.map.model().otherLevels('heichal'); return o.includes('roof') && o.includes('aliyah'); }));
    await ev(() => __mikdash.ui.map.setView({ cx: 140, cy: 330, k: 6 }));
    await page.waitForTimeout(600);
    const mk = await ev(() => ({ m: __mikdash.ui.map.marker(), L: __mikdash.ui.map.labelRects() }));
    check('the off-screen chevron is not under a label', !!mk.m?.off && !mk.L.some((r) => mk.m.x + 14 > r.l && mk.m.x - 14 < r.r && mk.m.y + 14 > r.t && mk.m.y - 14 < r.b), JSON.stringify(mk.m));
    const p0 = await ev(() => __mikdash.player.position.toArray());
    await ev(() => document.activeElement?.blur?.());
    await page.keyboard.down('w'); await page.waitForTimeout(600); await page.keyboard.up('w');
    const p1 = await ev(() => __mikdash.player.position.toArray());
    check('player input is off while the Map is open', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) < 0.05);
    await ev(() => __mikdash.ui.map.fit('courts'));
    await page.waitForTimeout(700);
    const lr = await ev(() => __mikdash.ui.map.labelRects());
    check('Courts: many places labelled, no two labels overlap', lr.length >= 25 && !overlaps(lr), `${lr.length} labels; ${overlaps(lr) || 'no overlap'}`);
    const blockers = await ev(() => { const s = document.querySelector('.mk-mapv__stage').getBoundingClientRect(); return [...document.querySelectorAll('.mk-mapv__tools, .mk-mapv__zoom, .mk-mapv__legend')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.className, l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top }; }); });
    check('labels stay clear of the map controls', !lr.some((a) => blockers.some((b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b)));
    await ev(() => __mikdash.ui.map.fit('sanctuary'));
    await page.waitForTimeout(700);
    const sanct = await ev(() => __mikdash.ui.map.labels());
    check('zoomed in: small places appear (Amah Traksin, Beit HaChalifot)', sanct.includes('amah-traksin') && sanct.includes('beit-hachalifot'), `${sanct.length} labels`);
    await ev(() => __mikdash.ui.map.fit('mount'));
    await page.waitForTimeout(600);
    const mountIds = await ev(() => __mikdash.ui.map.labels());
    check('zoomed out: small chambers declutter away', !mountIds.includes('amah-traksin') && !mountIds.includes('medichin'));
    await ev(() => __mikdash.ui.map.fit('courts'));
    await page.waitForTimeout(600);
    const b = await stage();
    const cx = b.x + b.width * 0.55, cy = b.y + b.height * 0.5;
    const before = await ev(([x, y]) => ({ v: __mikdash.ui.map.view(), s: __mikdash.ui.map.screenToSite(x, y) }), [cx - b.x, cy - b.y]);
    await page.mouse.move(cx, cy);
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(60); }
    await page.waitForTimeout(500);
    const after = await ev(([x, y]) => ({ v: __mikdash.ui.map.view(), s: __mikdash.ui.map.screenToSite(x, y) }), [cx - b.x, cy - b.y]);
    check('wheel zooms in about the cursor', after.v.k > before.v.k * 1.4 && Math.hypot(after.s[0] - before.s[0], after.s[1] - before.s[1]) < 1.5, `k ${before.v.k.toFixed(2)} → ${after.v.k.toFixed(2)}`);
    await page.keyboard.down('Control'); await page.mouse.wheel(0, 40); await page.keyboard.up('Control');
    await page.waitForTimeout(200);
    check('trackpad pinch (ctrl+wheel) zooms out', (await ev(() => __mikdash.ui.map.view().k)) < after.v.k);
    const v0 = await ev(() => __mikdash.ui.map.view());
    await page.mouse.move(cx, cy); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(cx + 12 * i, cy + 5 * i);
    await page.mouse.up();
    await page.waitForTimeout(700);
    const v1 = await ev(() => __mikdash.ui.map.view());
    check('drag pans the map', (v0.cx - v1.cx) * v0.k > 100 && (v1.cy - v0.cy) * v0.k > 40);
    check('a drag does not select', await ev(() => __mikdash.ui.map.selected() === null));
    await page.locator('.mk-mapv__stage').focus();
    const k0 = await ev(() => __mikdash.ui.map.view());
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('+');
    await page.waitForTimeout(500);
    const k1 = await ev(() => __mikdash.ui.map.view());
    check('arrow keys pan, + zooms (the map stage keeps + and −)', k1.cx > k0.cx && k1.k > k0.k * 1.3);
    await ev(() => __mikdash.ui.map.fit('courts'));
    await page.waitForTimeout(600);
    const [mx, my] = await at(217, 321);
    await page.mouse.move(mx, my, { steps: 3 });
    await page.waitForTimeout(250);
    check('hover shows the place in a tooltip', await ev(() => document.querySelector('.mk-mapv__tip.in')?.textContent.includes('Mizbeach')));
    await page.mouse.click(mx, my);
    await page.waitForTimeout(500);
    check('a click selects the place and opens its card', await ev(() => __mikdash.ui.map.selected() === 'mizbeach' && !document.querySelector('.mk-mapcard').hidden && /Mizbeach/.test(document.querySelector('.mk-mapcard__en').textContent)));
    check('screen-reader summary of the selection', await ev(() => /Selected: .*Mizbeach/.test(document.querySelector('.mk-mapv [aria-live]').textContent)));
    check('the map card: the one Go control, This spot, About; event rows with Go', await ev(() => { const c = document.querySelector('.mk-mapcard'); return !!c.querySelector('.mk-mapcard__go .mk-go') && /About/.test(c.textContent) && !c.querySelector('select, .mk-mapcard__speed'); }));
    await shot(page, 'map-select');
    const enRect = (await ev(() => __mikdash.ui.map.labelRects())).find((r) => ['heichal', 'azarah', 'kodesh-hakodashim', 'ulam'].includes(r.id));
    if (enRect) { await page.mouse.click(b.x + (enRect.l + enRect.r) / 2, b.y + (enRect.t + enRect.b) / 2); await page.waitForTimeout(400); }
    check('a click on a label selects its place', !!enRect && await ev((id) => __mikdash.ui.map.selected() === id, enRect.id));
    await ev(() => __mikdash.ui.map.select('ezrat-nashim'));
    await page.waitForTimeout(500);
    await page.click('.mk-mapcard .mk-go__more');
    await page.click('.mk-gomenu [data-way=run]');
    check('the Go menu choice is remembered (travelWay) and shown on Go', await ev(() => __mikdash.settings.get('travelWay') === 'run' && /Run/.test(document.querySelector('.mk-mapcard .mk-go__sub').textContent)));
    await page.click('.mk-gomenu [data-way=walk]');
    await page.keyboard.press('Escape');
    const chip = await page.locator('.mk-mapcard__levels .mk-chip2').count();
    if (chip) { await page.locator('.mk-mapcard__levels .mk-chip2').first().click(); await page.waitForTimeout(500); }
    check('"Also here" selects the storey above (the gallery)', chip > 0 && await ev(() => __mikdash.ui.map.selected() === 'en-gallery' && /upper/i.test(document.querySelector('.mk-mapcard__lvl').textContent)));
    await page.click('.mk-mapv__presets [data-preset=sanctuary]');
    await page.waitForTimeout(800);
    check('a preset button animates to the Sanctuary', await ev(() => __mikdash.ui.map.view().k > 2.5 && document.querySelector('.mk-mapv__presets [data-preset=sanctuary]').getAttribute('aria-pressed') === 'true'));
    await page.click('.mk-mapv__zoom button[aria-label="Centre on me"]');
    await page.waitForTimeout(800);
    check('centre on me puts the observer in view', await ev(() => {
      const m = __mikdash.ui.map;
      const st2 = document.querySelector('.mk-mapv__stage');
      const s = __mikdash.units.w2m(__mikdash.player.position);
      const [x, y] = m.siteToScreen(s.X, s.Y);
      return x > 0 && y > 0 && x < st2.clientWidth && y < st2.clientHeight;
    }));
    // search finds places while the map is open
    await ev(() => document.activeElement?.blur?.());
    await page.locator('.mk-mapv__stage').focus();
    await page.keyboard.press('/');
    await page.keyboard.type('kiyor', { delay: 30 });
    await page.waitForTimeout(500);
    check('"/" on the map searches; the Kiyor is the first place', await ev(() => __mikdash.ui.console.results().find((r) => r.doc.kind === 'place')?.doc.id === 'zone:kiyor'));
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    check('Esc clears, then goes back to the map', await ev(() => __mikdash.ui.panel === 'map' && __mikdash.ui.console.state().view?.type === 'section'));
    await page.click('.mk-head__search .mk-search__input');
    await page.keyboard.type('gazit', { delay: 20 });
    await page.waitForTimeout(500);
    const msc = await ev(() => document.querySelector('.mk-search__scopes [aria-pressed=true]')?.textContent || '');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const msel = await ev(() => ({ panel: __mikdash.ui.panel, view: __mikdash.ui.console.state().view?.type, sel: __mikdash.ui.map.selected() }));
    check('the header search over the Map is scoped to Places; Enter selects the place on the map', /^Places/.test(msc) && msel.panel === 'map' && msel.view === 'section' && msel.sel === 'gazit', JSON.stringify({ msc, msel }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    check('Esc closes the Menu and gives input back', await ev(() => __mikdash.ui.panel === null));
    const q0 = await ev(() => __mikdash.player.position.toArray());
    await ev(() => document.activeElement?.blur?.());
    await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
    const q1 = await ev(() => __mikdash.player.position.toArray());
    check('after closing, the observer walks again', Math.hypot(q1[0] - q0[0], q1[2] - q0[2]) > 0.1);
    await ev(() => __mikdash.ui.open('map'));
    await page.waitForTimeout(1500);
    const sA = await ev(() => __mikdash.ui.map.stats());
    await page.waitForTimeout(2000);
    const sB = await ev(() => __mikdash.ui.map.stats());
    const dynRate = (sB.dyn - sA.dyn) / 2, baseRate = (sB.base - sA.base) / 2;
    check('idle: the dynamic layer ≤ 15 fps, the static layer not redrawn', dynRate <= 16 && dynRate >= 4 && baseRate <= 0.5, `dyn ${dynRate}/s, base ${baseRate}/s`);
    await ev(() => __mikdash.ui.close());
    const sC = await ev(() => __mikdash.ui.map.stats());
    await page.waitForTimeout(1200);
    const sD = await ev(() => __mikdash.ui.map.stats());
    check('closed: no map drawing at all', sD.dyn === sC.dyn && sD.base === sC.base && sD.raster === sC.raster);
    await ev(() => __mikdash.ui.open('map'));
    await page.waitForTimeout(600);
    await ev(() => __mikdash.ui.map.fit('courts'));
    await page.waitForTimeout(600);
    const gs = await ev(() => {
      const m = __mikdash.ui.map;
      const [x0, y0] = m.siteToScreen(205, 333), [x1, y1] = m.siteToScreen(229, 309);
      for (let y = y0; y < y1; y += 6) for (let x = x0; x < x1; x += 6) { const r = m.hit(x, y); if (r.kind !== 'event' && r.id === 'mizbeach') return [x, y]; }
      return m.siteToScreen(217, 321);
    });
    const gb = await stage();
    await page.mouse.dblclick(gb.x + gs[0], gb.y + gs[1]);
    await page.waitForTimeout(1000);
    const dw = await ev(() => ({ mode: __mikdash.player.mode, open: __mikdash.ui.panel, txt: document.querySelector('.mk-travel__txt').textContent, inMap: !!document.querySelector('.mk-mapv__travel .mk-travel'), trip: __mikdash.ui.map.trip() }));
    check('double-click goes to the place under the pointer; the travel bar and route show in the map', dw.mode === 'auto' && /Mizbeach/.test(dw.txt) && dw.inMap && !!dw.trip, JSON.stringify(dw));
    const pc = await ev(() => {
      const R = (s) => { const e = document.querySelector(s); return e && !e.hidden ? e.getBoundingClientRect() : null; };
      const o = (p, q2) => !!(p && q2) && p.left < q2.right && q2.left < p.right && p.top < q2.bottom && q2.top < p.bottom;
      const t = R('.mk-mapv__travel'), p = R('.mk-mapv__tools'), c = R('.mk-mapcard');
      return { shown: !!t, tools: o(t, p), card: o(t, c) };
    });
    check('the travel bar in the map is clear of the toolbar and the card', pc.shown && !pc.tools && !pc.card, JSON.stringify(pc));
    await shot(page, 'map-walking');
    await page.click('.mk-mapv__travel .mk-travel__stop');
    await page.waitForTimeout(600);
    check('Stop cancels the walk and hides the bar', await ev(() => __mikdash.player.mode !== 'auto' && document.querySelector('.mk-mapv__travel').hidden));
    await ev(() => __mikdash.ui.map.select('gazit'));
    await page.waitForTimeout(600);
    await page.click('.mk-mapcard__acts .mk-btn:has-text("About")');
    await page.waitForTimeout(500);
    check('About opens Here for the selected place', await ev(() => __mikdash.ui.panel === 'here' && /Gazit/.test(document.querySelector('.mk-menu .mk-card__en')?.textContent || '')));
    await ev(() => __mikdash.ui.open('map'));
    await page.waitForTimeout(500);
    await ev(() => __mikdash.ui.map.fit('mount'));
    await page.waitForTimeout(600);
    const [hx, hy] = await at(150, 120);
    await page.mouse.click(hx, hy);
    await page.waitForTimeout(500);
    check('a click on open ground offers "This spot"', await ev(() => __mikdash.ui.map.selected() === 'har-habayit' && [...document.querySelectorAll('.mk-mapcard__acts .mk-btn')].some((x) => /This spot/.test(x.textContent) && !x.hidden)));
    await ev(() => __mikdash.settings.set('reducedMotion', true));
    const rm = await ev(() => { __mikdash.ui.map.select('kodesh-hakodashim'); return JSON.stringify(__mikdash.ui.map.view()); });
    await page.waitForTimeout(50);
    check('reduced motion: a fly-to lands at once', rm === await ev(() => JSON.stringify(__mikdash.ui.map.view())));
    await ev(() => { __mikdash.settings.set('reducedMotion', false); localStorage.removeItem('mikdash.reducedMotion'); });
    await ev(() => __mikdash.ui.close());
    await page.close();
  }

  // =================================================================== phone 390×844 (touch)
  if (only.has('phone')) {
    const ph = await boot('phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const pe = (fn, a) => ph.evaluate(fn, a);
    check('phone: ghost walk / look controls in the first touch session', await pe(() => { const g = document.querySelector('.mk-touchhint'); return !!g && !g.hidden; }));
    const br = await rect(ph, '.mk-beacon');
    check('phone: the beacon bottom-right, clear of the joystick zone (left 45 %)', br.r > 370 && br.b > 780 && br.l > 390 * 0.45 && br.w <= 222, JSON.stringify(br));
    check('phone: the beacon shows no key cap', await pe(() => document.querySelector('.mk-beacon__cap').hidden));
    await ph.evaluate(() => __mikdash.ui.toast('Clock set · test'));
    await ph.waitForTimeout(400);
    const tr = await rect(ph, '.mk-toast');
    check('phone: a notice is clear of the beacon', tr.b < br.t, JSON.stringify({ tr, br }));
    await ph.waitForTimeout(800);
    const co = await pe(() => { const c = document.querySelector('.mk-coach'); const g = document.querySelector('.mk-touchhint__joy span'); const r = c.getBoundingClientRect(), q = g?.getBoundingClientRect(); return { shown: !c.hidden, at: c.dataset.at, l: Math.round(r.left), t: Math.round(r.top), b: Math.round(r.bottom), ghost: q && !document.querySelector('.mk-touchhint').hidden ? { r: Math.round(q.right), t: Math.round(q.top), b: Math.round(q.bottom) } : null }; });
    check('phone: the first coach mark sits right of the joystick zone (clear of "Drag to walk")', co.shown && co.l >= 390 * 0.45 - 1 && !(co.ghost && co.ghost.r > co.l && co.ghost.t < co.b && co.ghost.b > co.t), JSON.stringify(co));
    await ph.locator('.mk-beacon').tap();
    await ph.waitForTimeout(700);
    const home = await pe(() => ({ s: __mikdash.ui.console.state(), tiles: [...document.querySelectorAll('.mk-tile')].map((t) => { const l = t.querySelector('.mk-tile__label'); return { txt: l.textContent, fits: l.scrollWidth <= l.clientWidth + 1, h: t.getBoundingClientRect().height, w: t.getBoundingClientRect().width }; }) }));
    check('phone: tapping the beacon opens the home: a 4×2 grid of labelled tiles, at the peek detent', home.s.view?.type === 'home' && home.s.detent === 'peek' && home.tiles.length === 8 && home.tiles.every((t) => t.fits && t.h >= 64 && t.w >= 84), JSON.stringify(home));
    check('phone: the header (minimap, names, About, clock, search) on the home', await vis(ph, '.mk-head__disc') && await vis(ph, '.mk-head__about') && await vis(ph, '.mk-head__clockbtn') && await vis(ph, '.mk-search'));
    await shot(ph, 'phone-home');
    const homeEnd = await pe(async () => { const v = document.querySelector('.mk-home'); v.scrollTop = v.scrollHeight; await new Promise((r) => setTimeout(r, 200)); const a = document.querySelector('.mk-home__acts').getBoundingClientRect(); return { b: Math.round(a.bottom), ih: innerHeight, max: v.scrollHeight - v.clientHeight }; });
    check('phone (peek): the home scrolls to its end in sight (Fly, Sound)', homeEnd.b <= homeEnd.ih, JSON.stringify(homeEnd));
    await ph.locator('.mk-tile[data-section=here]').tap();
    await ph.waitForTimeout(600);
    check('phone: a tile drills into its section: "‹ Menu", the compact strip', await pe(() => __mikdash.ui.panel === 'here' && /Menu/.test(document.querySelector('.mk-drill__back').textContent) && getComputedStyle(document.querySelector('.mk-drill')).display !== 'none') && await vis(ph, '.mk-head__disc'));
    await ph.locator('.mk-drill__back').tap();
    await ph.waitForTimeout(500);
    check('phone: "‹ Menu" goes back to the tiles', await pe(() => __mikdash.ui.console.state().view?.type === 'home'));
    await ph.locator('.mk-tile[data-section=time]').tap();
    await ph.waitForTimeout(500);
    await pe(() => history.back());
    await ph.waitForTimeout(700);
    check('phone: the system back goes back one level', await pe(() => __mikdash.ui.console.state().open && __mikdash.ui.console.state().view?.type === 'home'), JSON.stringify(await st(ph)));
    await pe(() => history.back());
    await ph.waitForTimeout(700);
    check('phone: …and once more closes, without leaving the page', await pe(() => !__mikdash.ui.console.state().open && typeof __mikdash === 'object'));
    // drag the sheet
    await pe(() => __mikdash.ui.open('time'));
    await ph.waitForTimeout(600);
    const gr = await rect(ph, '.mk-menu__grab');
    await ph.mouse.move(gr.l + 100, gr.t + 6); await ph.mouse.down();
    await ph.mouse.move(gr.l + 100, gr.t + 30, { steps: 3 }); await ph.mouse.up();
    await ph.waitForTimeout(500);
    check('phone: a short drag springs back (open)', (await st(ph)).open);
    const gr2 = await rect(ph, '.mk-menu__grab');
    await ph.mouse.move(gr2.l + 100, gr2.t + 6); await ph.mouse.down();
    await ph.mouse.move(gr2.l + 100, gr2.t + 140, { steps: 4 });
    const midDrag = await pe(() => document.querySelector('.mk-menu').style.transform);
    await ph.mouse.move(gr2.l + 100, 840, { steps: 8 }); await ph.mouse.up();
    await ph.waitForTimeout(600);
    check('phone: dragging the sheet down closes it (it follows the finger)', !(await st(ph)).open && /translateY/.test(midDrag), midDrag);
    // search at the full detent
    await pe(() => __mikdash.ui.search('altar'));
    await ph.waitForTimeout(700);
    check('phone: search takes the full detent (modal: focus trapped)', await pe(() => { const s = __mikdash.ui.console.state(); return s.detent === 'full' && document.querySelector('.mk-menu').getAttribute('aria-modal') === 'true'; }));
    await pe(() => __mikdash.ui.close());
    // touch on markers / taps: a drag that starts anywhere on the right half looks around
    const cdp = await ph.context().newCDPSession(ph);
    const touchPath = async (pts) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1], id: 1 }] });
      for (const [x, y] of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }); await ph.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await pe(() => { __mikdash.time.set(__mikdash.time.zmanim.alot - 6); __mikdash.player.setLook(270, 10); });
    await ph.waitForTimeout(1000);
    const h0 = await pe(() => __mikdash.player.heading);
    await touchPath(Array.from({ length: 11 }, (_, i) => [230 + i * 12, 400 + i * 2]));
    await ph.waitForTimeout(300);
    const h1 = await pe(() => ({ h: __mikdash.player.heading, open: __mikdash.ui.console.state().open }));
    check('phone: a drag on the right looks around (the Menu stays closed)', Math.abs(((h1.h - h0 + 540) % 360) - 180) > 5 && !h1.open, JSON.stringify(h1));
    await touchPath([[250, 300]]);
    await ph.waitForTimeout(400);
    check('phone: a tap on empty scenery (or a subject) wakes the beacon or opens a card', await pe(() => document.querySelector('.mk-wake').classList.contains('is-awake') || __mikdash.ui.console.state().view?.type === 'card'));
    // a subject picked where the peek sheet opens is turned up into the world left above the sheet (§4.1 step 3)
    await pe(() => __mikdash.ui.close());
    const pf = await pe(async () => {
      const M = __mikdash, I = M.inspect, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!I?.frame) return { none: 'no inspect core' };
      await I.ready;
      const proj = (ref) => { const p = I.anchorOf(ref); if (!p) return null; const q = p.clone(); q.y += 1.2; q.project(M.camera); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight }; };
      let n = null;
      for (let k = 0; k < 12 && !n; k++) { const l = I.nearby(40, { limit: 60 }); n = l.find((i) => /^actor:/.test(i.ref)) || l.find((i) => /^el:/.test(i.ref)); if (!n) await wait(500); }
      if (!n) return { none: 'nothing near' };
      await I.frame(n.ref, { ms: 0 });
      await wait(250);
      const s0 = proj(n.ref);
      M.ui.card({ ref: n.ref, kind: n.kind, label: n.label, distance: n.distance, screen: s0 }, { fromWorld: true });
      await wait(1000);
      const f = M.ui.console.free();
      return { ref: n.ref, s0, s1: proj(n.ref), free: f, cy: (f.t + innerHeight - f.b) / 2, detent: M.ui.console.state().detent };
    });
    if (pf.none) console.log(`SKIP  phone framing: ${pf.none}`);
    else check('phone: a subject under the opening peek sheet is turned into the world above it', pf.detent === 'peek' && pf.free.b > 300 && pf.s0.y > 844 - pf.free.b - 20 && !!pf.s1 && Math.abs(pf.s1.y - pf.cy) < 40, JSON.stringify(pf));
    await pe(() => __mikdash.ui.close());
    // pinches
    const pinch = async (cx2, cy2) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx2 - 20, y: cy2, id: 1 }, { x: cx2 + 20, y: cy2, id: 2 }] });
      for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx2 - 20 - i * 9, y: cy2 - i * 4, id: 1 }, { x: cx2 + 20 + i * 9, y: cy2 + i * 4, id: 2 }] }); await ph.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await ph.waitForTimeout(400);
    };
    await pe(() => __mikdash.ui.open('here'));
    await ph.waitForTimeout(600);
    const vb = await rect(ph, '.mk-menu__view.is-current');
    await pinch((vb.l + vb.r) / 2, vb.t + 120);
    const s1 = await pe(() => visualViewport.scale);
    await pe(() => __mikdash.ui.open('map'));
    await ph.waitForTimeout(1000);
    const mk0 = await pe(() => __mikdash.ui.map?.view()?.k);
    const sb = await ph.locator('.mk-mapv__stage').boundingBox();
    await pinch(sb.x + sb.width / 2, sb.y + sb.height / 2);
    const mk1 = await pe(() => __mikdash.ui.map?.view()?.k);
    const s2 = await pe(() => visualViewport.scale);
    check('phone: a pinch on the Menu leaves the page at 1×; the map still zooms', s1 === 1 && s2 === 1 && mk1 > mk0 * 1.5, JSON.stringify({ s1, s2, mk0, mk1 }));
    // the map, full screen
    const fr = await rect(ph, '.mk-menu');
    check('phone: the Map takes the full screen', fr.l === 0 && fr.w === 390 && fr.h >= 800, JSON.stringify(fr));
    await pe(() => __mikdash.ui.map.fit('courts'));
    await ph.waitForTimeout(600);
    const sb2 = await ph.locator('.mk-mapv__stage').boundingBox();
    const [tx, ty] = await pe(([a, c]) => __mikdash.ui.map.siteToScreen(a, c), [330, 330]);
    await ph.touchscreen.tap(sb2.x + tx, sb2.y + ty);
    await ph.waitForTimeout(700);
    const card = await pe(() => { const r = document.querySelector('.mk-mapcard').getBoundingClientRect(); return { sel: __mikdash.ui.map.selected(), l: r.left, w: r.width, b: r.bottom, h: r.height }; });
    check('phone: a tap selects; the card is a bottom sheet', card.sel === 'ezrat-nashim' && card.l <= 1 && card.w >= 388 && card.b >= 838 && card.h < 844 * 0.62, JSON.stringify(card));
    await shot(ph, 'phone-map');
    await ph.locator('.mk-placesbtn').tap();
    await ph.waitForTimeout(400);
    check('phone: Places opens the list', await pe(() => getComputedStyle(document.querySelector('.mk-mapl')).display !== 'none'));
    await ph.locator('.mk-mapl__opt[data-id="kiyor"]').first().tap();
    await ph.waitForTimeout(700);
    check('phone: choosing a place closes the list and shows its card', await pe(() => getComputedStyle(document.querySelector('.mk-mapl')).display === 'none' && __mikdash.ui.map.selected() === 'kiyor' && !document.querySelector('.mk-mapcard').hidden));
    await ph.locator('.mk-keybtn').tap();
    await ph.waitForTimeout(300);
    check('phone: the labelled Key shows the legend', await pe(() => getComputedStyle(document.querySelector('.mk-mapv__legend')).display !== 'none'));
    await ph.locator('.mk-keybtn').tap();
    const tt = await pe(() => {
      const hs = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height));
      return { presets: hs('.mk-mapv__presets button'), places: hs('.mk-placesbtn'), key: hs('.mk-keybtn'), go: hs('.mk-mapcard .mk-go__main'), close: hs('.mk-drill__close') };
    });
    check('phone: map controls at least 40 px tall', Object.values(tt).every((a) => a.length && a.every((v) => v >= 40)), JSON.stringify(tt));
    await pe(() => { __mikdash.ui.map.select('mizbeach'); });
    await ph.waitForTimeout(600);
    await pe(() => { const c = document.querySelector('.mk-mapcard'); c.scrollTop = 300; });
    await pe(() => __mikdash.ui.map.select('gazit'));
    await ph.waitForTimeout(500);
    check('phone: a newly selected place opens at its name', await pe(() => document.querySelector('.mk-mapcard').scrollTop === 0));
    // a double tap goes
    const selKiyor = async () => { await pe(() => { __mikdash.player.cancel?.(); if (__mikdash.ui.panel !== 'map') __mikdash.ui.open('map'); __mikdash.ui.map.select('kiyor'); }); await ph.waitForTimeout(700); };
    await selKiyor();
    // a double tap with its own timestamps (the view pairs taps by the events' times, not by when they are handled)
    const sbx = await ph.locator('.mk-mapv__stage').boundingBox();
    const [dx, dy] = await pe(() => { const a = __mikdash.ui.map.anchor('kiyor'); return __mikdash.ui.map.siteToScreen(a[0], a[1]); });
    const touch = (type, ts) => cdp.send('Input.dispatchTouchEvent', { type, timestamp: ts, touchPoints: type === 'touchEnd' ? [] : [{ x: sbx.x + dx, y: sbx.y + dy, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
    const T0 = Date.now() / 1000;
    await touch('touchStart', T0); await touch('touchEnd', T0 + 0.03);
    await touch('touchStart', T0 + 0.2); await touch('touchEnd', T0 + 0.23);
    await ph.waitForTimeout(1200);
    const went = await pe(() => __mikdash.player.mode === 'auto');
    check('phone: a double tap on the map goes; the Menu collapses to its strip (mini)', went && (await st(ph)).detent === 'mini', JSON.stringify(await st(ph)));
    check('phone: the travel bar shows above the strip', await vis(ph, '.mk-travel'));
    await shot(ph, 'phone-walking');
    await pe(() => __mikdash.player.cancel());
    await ph.waitForTimeout(400);
    check('phone: the travel bar goes when the walk ends', await pe(() => document.querySelector('.mk-travel').hidden));
    // a card at the peek detent: the actions in sight, and its end scrolls into sight
    await pe(() => { __mikdash.ui.close(); __mikdash.ui.card('el:altar.kiyor'); });
    await ph.waitForTimeout(800);
    const pk = await pe(async () => {
      const v = document.querySelector('.mk-cardview');
      const a = document.querySelector('.mk-cardview .mk-card__acts').getBoundingClientRect();
      const r = { detent: __mikdash.ui.console.state().detent, actsB: Math.round(a.bottom), ih: innerHeight };
      v.scrollTop = v.scrollHeight;
      await new Promise((res) => setTimeout(res, 200));
      const last = document.querySelector('.mk-cardview .mk-card').lastElementChild;
      const kids = [...document.querySelector('.mk-cardview .mk-card').children].filter((e) => e.getClientRects().length);
      r.endB = Math.round(kids[kids.length - 1].getBoundingClientRect().bottom);
      r.lastTag = last?.className;
      return r;
    });
    check('phone (peek): a card\'s actions are in sight, and its end scrolls into sight', pk.detent === 'peek' && pk.actsB <= pk.ih && pk.endB <= pk.ih, JSON.stringify(pk));
    const hit = await pe(() => {
      const hs = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height));
      return { btn: hs('.mk-cardview .mk-btn'), chips: hs('.mk-cardview .mk-chip3--btn'), src: hs('.mk-cardview .mk-src'), sources: hs('.mk-cardview .mk-card__srcbtn'), about: hs('.mk-head__about') };
    });
    check('phone: card controls are at least 44 px tall', Object.values(hit).every((a) => a.every((v) => v >= 44)), JSON.stringify(hit));
    await pe(() => __mikdash.ui.close());
    // two taps (and their compatibility mouse events) leave the phone in touch mode: no Esc / T / M key caps
    await touchPath([[100, 150]]);
    await ph.waitForTimeout(400);
    await pe(() => __mikdash.ui.close());
    await touchPath([[300, 200]]);
    await ph.waitForTimeout(400);
    await pe(() => __mikdash.ui.close());
    await ph.waitForTimeout(200);
    check('phone: taps keep touch mode (no key caps on the beacon)', await pe(() => document.getElementById('ui-root').dataset.input === 'touch' && document.querySelector('.mk-beacon__cap').hidden), await pe(() => document.getElementById('ui-root').dataset.input));
    // flying: Rise / Sink are not under the wake chips, and holding Rise climbs
    await pe(() => { __mikdash.ui.close(); __mikdash.player.setMode('fly'); });
    await ph.waitForTimeout(600);
    // (a look drag wakes the chips: the player's look intent)
    await pe(() => __mikdash.bus.emit('player:intent', { kind: 'look' }));
    await ph.waitForTimeout(400);
    const fl = await pe(() => {
      const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
      const vs = [...document.querySelectorAll('.mk-vert')].filter((e) => e.getClientRects().length).map(R);
      const cs = [...document.querySelectorAll('.mk-wake.is-awake .mk-qchip')].filter((e) => e.getClientRects().length).map(R);
      const hitp = vs.some((a) => cs.some((b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b));
      return { vs: vs.length, cs: cs.length, overlap: hitp, rise: vs[0] };
    });
    check('phone, flying: Rise / Sink are clear of the awake chips', fl.vs === 2 && fl.cs > 0 && !fl.overlap, JSON.stringify(fl));
    if (fl.rise) {
      const y0 = await pe(() => __mikdash.camera.position.y);
      const cx = (fl.rise.l + fl.rise.r) / 2, cy = (fl.rise.t + fl.rise.b) / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
      await ph.waitForTimeout(1200);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const y1 = await pe(() => __mikdash.camera.position.y);
      check('phone, flying: holding Rise climbs', y1 > y0 + 0.3, `${y0.toFixed(2)} → ${y1.toFixed(2)}`);
    }
    await pe(() => { __mikdash.player.setMode('walk'); __mikdash.ui.close(); });
    // Hebrew with an IME: results while composing
    await pe(() => __mikdash.ui.search(''));
    await ph.waitForTimeout(500);
    await cdp.send('Input.imeSetComposition', { text: 'מז', selectionStart: 2, selectionEnd: 2 });
    await ph.waitForTimeout(400);
    const ime = await pe(() => ({ v: document.querySelector('.mk-search__input').value, n: __mikdash.ui.console.results().length }));
    check('phone: search results update while an IME composes (מז)', ime.v === 'מז' && ime.n > 0, JSON.stringify(ime));
    await cdp.send('Input.insertText', { text: 'מזבח' });
    await ph.waitForTimeout(400);
    check('phone: no keyboard hint row on touch', !(await vis(ph, '.mk-search__keys')));
    // the full sheet traps Tab inside it
    let out = 0;
    for (let i = 0; i < 45; i++) { await ph.keyboard.press('Tab'); if (await pe(() => !document.querySelector('.mk-menu').contains(document.activeElement))) out++; }
    check('phone: the full sheet keeps Tab inside it (aria-modal)', out === 0, `${out} of 45 outside`);
    await pe(() => __mikdash.ui.close());
    // a 10× trip: the travel bar's controls are 44 px tall
    await pe(() => { __mikdash.settings.set('travelPace', 10); __mikdash.ui.card('zone:mizbeach'); });
    await ph.waitForTimeout(600);
    await pe(() => document.querySelector('.mk-menu .mk-card__acts .mk-go__main')?.click());
    await ph.waitForTimeout(900);
    const tb = await pe(() => [...document.querySelectorAll('.mk-travel button')].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height)));
    check('phone: the travel bar\'s pace, way, Skip and Stop are at least 44 px tall', tb.length >= 7 && tb.every((v) => v >= 44), JSON.stringify(tb));
    await pe(() => { __mikdash.player.cancel?.(); __mikdash.settings.set('travelPace', 1); __mikdash.ui.close(); });
    await cdp.detach();
    await ph.close();

    // 360×740: every tile label fits
    const p3 = await boot('phone360', { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await p3.evaluate(() => __mikdash.ui.open(null) || document.querySelector('.mk-beacon').click());
    await p3.waitForTimeout(700);
    const t3 = await p3.evaluate(() => [...document.querySelectorAll('.mk-tile__label')].map((l) => ({ t: l.textContent, fits: l.scrollWidth <= l.clientWidth + 1 && l.getBoundingClientRect().width > 0 })));
    check('phone 360 px: all eight tile labels fully visible', t3.length === 8 && t3.every((x) => x.fits), JSON.stringify(t3.filter((x) => !x.fits)));
    await shot(p3, 'phone360-home');
    await p3.close();
  }

  // =================================================================== phone landscape 844×390 (touch)
  if (only.has('landscape')) {
    const ls = await boot('landscape', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const le = (fn, a) => ls.evaluate(fn, a);
    await ls.locator('.mk-beacon').tap();
    await ls.waitForTimeout(700);
    const lm = await le(() => { const r = document.querySelector('.mk-menu').getBoundingClientRect(); return { s: __mikdash.ui.console.state(), l: r.left, w: r.width, h: r.height, tiles: document.querySelectorAll('.mk-tile').length, fits: [...document.querySelectorAll('.mk-tile__label')].every((l) => l.scrollWidth <= l.clientWidth + 1) }; });
    check('landscape: a right sheet with the 4×2 tiles', lm.s.layout === 'sheet-landscape' && lm.l > 340 && lm.w <= 0.58 * 844 + 1 && lm.h >= 388 && lm.tiles === 8 && lm.fits, JSON.stringify(lm));
    check('landscape: the beacon hides while the Menu is open', !(await vis(ls, '.mk-beacon')));
    await shot(ls, 'landscape-home');
    await le(() => __mikdash.ui.open('map'));
    await ls.waitForTimeout(900);
    await le(() => __mikdash.ui.map.select('mizbeach'));
    await ls.waitForTimeout(800);
    const lc = await le(() => { const r = document.querySelector('.mk-mapcard').getBoundingClientRect(); const s = document.querySelector('.mk-mapv__stage').getBoundingClientRect(); return { w: r.width, sw: s.width, right: s.right - r.right, menuW: document.querySelector('.mk-menu').getBoundingClientRect().width }; });
    check('landscape: the Map takes the full screen; the card sits at the side', lc.menuW >= 840 && lc.w < lc.sw * 0.6 && lc.right < 12, JSON.stringify(lc));
    const lrs = await le(() => __mikdash.ui.map.labelRects());
    check('landscape: labels do not overlap', !overlaps(lrs), `${lrs.length} labels`);
    await le(() => { document.querySelector('.mk-mapcard').scrollTop = 300; });
    await le(() => __mikdash.ui.map.select('beit-hatevilah'));
    await ls.waitForTimeout(500);
    check('landscape: a newly selected place opens at its name', (await le(() => document.querySelector('.mk-mapcard').scrollTop)) === 0);
    await le(() => __mikdash.ui.map.select('slaughter-zone'));
    await ls.waitForTimeout(600);
    const lrow = await le(() => {
      const c = document.querySelector('.mk-mapcard'), f = c.querySelector('.mk-mapcard__foot').getBoundingClientRect();
      const row = c.querySelector('.mk-mapcard__sec .mk-mapcard__evs > *')?.getBoundingClientRect();
      return { rowTop: row ? Math.round(row.top) : null, footTop: Math.round(f.top), go: !!c.querySelector('.mk-mapcard__foot .mk-go') };
    });
    check('landscape: the first activity here is in view above the Go row', lrow.rowTop !== null && lrow.rowTop < lrow.footTop && lrow.go, JSON.stringify(lrow));
    await shot(ls, 'landscape-map');
    await le(() => __mikdash.ui.search('altar'));
    await ls.waitForTimeout(700);
    await ls.setViewportSize({ width: 844, height: 190 });
    await ls.waitForTimeout(600);
    const lk = await le(() => { const r = document.querySelector('.mk-sres')?.getBoundingClientRect(); return { layout: __mikdash.ui.console.state().layout, first: r ? Math.round(r.top) : null, ih: innerHeight }; });
    check('landscape, keyboard up: the first results show above it', lk.layout === 'sheet-landscape' && lk.first !== null && lk.first < lk.ih - 30, JSON.stringify(lk));
    await shot(ls, 'landscape-search-kbd');
    await ls.setViewportSize({ width: 844, height: 390 });
    await ls.waitForTimeout(400);
    await ls.close();
  }

  // =================================================================== tablets and a wide screen
  if (only.has('tablet')) {
    const tb = await boot('tablet-l', { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await tb.evaluate(() => __mikdash.ui.open('here'));
    await tb.waitForTimeout(700);
    const tl = await tb.evaluate(() => ({ s: __mikdash.ui.console.state(), hits: [...document.querySelectorAll('.mk-rail .mk-tab, .mk-head .mk-hbtn:not([hidden])')].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height)) }));
    check('tablet landscape (touch): the docked layout with 44 px targets', tl.s.layout === 'dock' && tl.hits.every((x) => x >= 44), JSON.stringify(tl));
    await shot(tb, 'tablet-landscape');
    await tb.evaluate(() => __mikdash.ui.search('kiyor'));
    await tb.waitForTimeout(600);
    await tb.setViewportSize({ width: 1024, height: 368 });
    await tb.waitForTimeout(500);
    const tk1 = await tb.evaluate(() => __mikdash.ui.console.state().layout);
    await tb.setViewportSize({ width: 1024, height: 768 });
    await tb.waitForTimeout(500);
    check('tablet landscape: a keyboard shortening the view while typing keeps the dock', tk1 === 'dock' && (await tb.evaluate(() => __mikdash.ui.console.state().layout)) === 'dock', tk1);
    await tb.close();
    const tp = await boot('tablet-p', { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await tp.locator('.mk-beacon').tap();
    await tp.waitForTimeout(700);
    check('tablet portrait: the phone sheet (home tiles)', await tp.evaluate(() => { const s = __mikdash.ui.console.state(); return s.layout === 'sheet-portrait' && s.view?.type === 'home'; }));
    await tp.evaluate(() => __mikdash.ui.search('kiyor'));
    await tp.waitForTimeout(600);
    await tp.setViewportSize({ width: 768, height: 600 });
    await tp.waitForTimeout(500);
    const tk2 = await tp.evaluate(() => __mikdash.ui.console.state().layout);
    await tp.setViewportSize({ width: 768, height: 1024 });
    await tp.waitForTimeout(500);
    check('tablet portrait: a keyboard shortening the view while typing keeps the bottom sheet', tk2 === 'sheet-portrait', tk2);
    await shot(tp, 'tablet-portrait');
    await tp.close();
  }
  if (only.has('wide')) {
    const wd = await boot('wide', { viewport: { width: 1920, height: 1080 } });
    await wd.evaluate(() => __mikdash.ui.open('happening'));
    await wd.waitForTimeout(700);
    const wr = await rect(wd, '.mk-menu');
    check('1920×1080: the dock is 560 px; the beacon hides while it is open', Math.abs(wr.w - 560) < 2 && !(await vis(wd, '.mk-beacon')), JSON.stringify(wr));
    await wd.evaluate(() => __mikdash.ui.close());
    await wd.waitForTimeout(300);
    check('1920×1080: the beacon is back on close', await vis(wd, '.mk-beacon'));
    await shot(wd, 'wide-happening');
    await wd.close();
    const rv = await boot('returning', { viewport: { width: 1280, height: 720 } }, { enter: false, init: () => { if (!sessionStorage.getItem('mk-rv')) { sessionStorage.setItem('mk-rv', '1'); localStorage.setItem('mikdash.seen', '1'); } } });
    await rv.waitForTimeout(1500);
    const rvs = await rv.evaluate(() => ({ welcome: __mikdash.ui.console.state().welcome, coach: !document.querySelector('.mk-coach').hidden, txt: document.querySelector('.mk-coach').textContent }));
    check('a visitor of the interface before the console (seen = 1) gets the coach marks, not the Welcome', !rvs.welcome && rvs.coach && /Menu/.test(rvs.txt), JSON.stringify(rvs));
    await rv.close();
  }
} catch (e) {
  console.error(e);
  fails++;
} finally {
  const mine = logs.filter((l) => !/GPU stall|WebGL|ReadPixels|swiftshader|Automatic fallback/i.test(l));
  console.log(mine.length ? `console (${mine.length}):\n  ${mine.slice(0, 40).join('\n  ')}` : 'console: clean');
  if (mine.length) fails++;
  await browser.close();
  await server.close();
}
console.log(`${passes} passed, ${fails} failed`);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
