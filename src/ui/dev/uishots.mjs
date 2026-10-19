#!/usr/bin/env node
// UI screenshot walk-through (dev only; modelled on tools/shot.mjs — starts its own Vite server on a free port).
//   node src/ui/dev/uishots.mjs [--w 1280 --h 720] [--q low] [--out shots/ui] [--prefix desk] [--query "t=sunrise+20"]
//          [--steps steps.json]
// Default steps: intro → hud → time → time (scrolled) → info → map → settings. Prints console errors/warnings.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { w: 1280, h: 720, q: 'low', out: 'shots/ui', prefix: 'desk', query: '', steps: null, timeout: 150 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--q') opt.q = args[++i];
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--prefix') opt.prefix = args[++i];
  else if (a === '--query') opt.query = args[++i];
  else if (a === '--steps') opt.steps = JSON.parse(readFileSync(args[++i], 'utf8'));
}
const STEPS = opt.steps || [
  { shot: 'intro' },
  { js: '__mikdash.ui.enter()', wait: 1400, shot: 'hud' },
  { js: "__mikdash.ui.open('time')", wait: 900, shot: 'time' },
  { js: "document.querySelector('[data-panel=time] .mk-panel__body').scrollTop = 99999", wait: 400, shot: 'time-list' },
  { js: "(document.querySelector('[data-panel=time] .mk-ev__hit')||{click(){}}).click(); document.querySelector('[data-panel=time] .mk-ev')?.scrollIntoView()", wait: 400, shot: 'time-event' },
  { js: "__mikdash.ui.open('info')", wait: 800, shot: 'info' },
  { js: "__mikdash.ui.open('map')", wait: 900, shot: 'map' },
  { js: "__mikdash.ui.open('settings')", wait: 800, shot: 'settings' },
];

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
mkdirSync(resolve(root, opt.out), { recursive: true });
let code = 0;
try {
  const mobile = opt.w < 768;
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
      if (String(r).startsWith('ERR')) console.log(`step ${s.shot || s.js}: ${r}`);
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
