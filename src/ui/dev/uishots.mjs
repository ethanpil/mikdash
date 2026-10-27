#!/usr/bin/env node
// UI screenshot walk-through (dev only; modelled on tools/shot.mjs — starts its own Vite server on a free port).
//   node src/ui/dev/uishots.mjs [--w 1280 --h 720] [--touch] [--q low] [--out shots/console] [--prefix desk]
//          [--query "t=sunrise+20"] [--steps steps.json]
// --touch (implied below 768 px wide) emulates a real touch device (hasTouch, isMobile, DPR 2), landscape included.
// Default steps (console §7.1): play, wake, the Menu home / each section, search en/he, a card, the banner (enter,
// arrive, restricted, breadcrumb), Welcome. Prints console errors/warnings.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { w: 1280, h: 720, q: 'low', out: 'shots/console', prefix: 'desk', query: '', steps: null, timeout: 150, touch: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--q') opt.q = args[++i];
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--prefix') opt.prefix = args[++i];
  else if (a === '--query') opt.query = args[++i];
  else if (a === '--steps') opt.steps = JSON.parse(readFileSync(args[++i], 'utf8'));
  else if (a === '--touch') opt.touch = true;
}
const STEPS = opt.steps || [
  { shot: 'welcome' },
  { js: '__mikdash.ui.enter()', wait: 1600, shot: 'play' },
  { js: "__mikdash.ui.console && document.querySelector('.mk-wake') && (document.querySelector('.mk-wake').classList.add('is-awake'))", wait: 400, shot: 'wake' },
  { js: "__mikdash.ui.open(innerWidth >= 960 && innerHeight >= 560 ? 'here' : null) || document.querySelector('.mk-beacon').click()", wait: 1200, shot: 'menu' },
  { js: "__mikdash.ui.open('here')", wait: 1000, shot: 'here' },
  { js: "__mikdash.ui.open('happening')", wait: 900, shot: 'happening' },
  { js: "__mikdash.ui.open('map')", wait: 1600, shot: 'map' },
  { js: "__mikdash.ui.open('time')", wait: 900, shot: 'time' },
  { js: "__mikdash.ui.open('learn')", wait: 700, shot: 'learn' },
  { js: "__mikdash.ui.open('listen')", wait: 600, shot: 'listen' },
  { js: "__mikdash.ui.open('settings')", wait: 600, shot: 'settings' },
  { js: "__mikdash.ui.open('help')", wait: 600, shot: 'help' },
  { js: "__mikdash.ui.search('mizbeach')", wait: 900, shot: 'search-en' },
  { js: "__mikdash.ui.search('מזבח')", wait: 900, shot: 'search-he' },
  { js: "__mikdash.ui.card('el:altar.kiyor') || __mikdash.ui.card('term:kiyor')", wait: 900, shot: 'card-object' },
  { js: "__mikdash.ui.card('event:' + __mikdash.schedule.active()[0].id)", wait: 900, shot: 'card-event' },
  { js: "__mikdash.ui.close(); __mikdash.ui.banner('ezrat-yisrael')", wait: 700, shot: 'banner-enter' },
  { js: "__mikdash.ui.banner('mizbeach', { kind: 'arrive' })", wait: 700, shot: 'banner-arrive' },
  { js: "__mikdash.ui.banner('heichal', { kind: 'restricted' })", wait: 700, shot: 'banner-restricted' },
];

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
mkdirSync(resolve(root, opt.out), { recursive: true });
let code = 0;
try {
  const mobile = opt.touch || opt.w < 768;
  const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  const qs = new URLSearchParams(opt.query);
  if (!qs.has('q')) qs.set('q', opt.q);
  const url = `${base}?${qs}`;
  await page.goto(url, { waitUntil: 'load', timeout: opt.timeout * 1000 });
  await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: opt.timeout * 1000, polling: 250 });
  await page.waitForTimeout(900);
  for (const s of STEPS) {
    if (s.js) {
      const r = await page.evaluate((code) => { try { const v = (0, eval)(code); return v === undefined ? 'ok' : JSON.stringify(v); } catch (e) { return `ERR ${e.message}`; } }, s.js);
      if (String(r).startsWith('ERR') || s.print) console.log(`step ${s.shot || s.js}: ${r}`);
    }
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.shot) {
      const file = resolve(root, opt.out, `${opt.prefix}-${s.shot}.png`);
      await page.screenshot({ path: file });
      console.log(`saved ${file}`);
    }
  }
  console.log(`url: ${url}`);
  if (logs.length) console.log(`console (${logs.length}):\n  ${logs.slice(0, 60).join('\n  ')}`);
  else console.log('console: clean');
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  await browser.close();
  await server.close();
}
process.exit(code);
