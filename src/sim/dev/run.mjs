#!/usr/bin/env node
// Interactive test harness for the sim (modelled on tools/shot.mjs): starts its own Vite dev server, opens the app,
// waits for window.__mikdashReady, then runs a test script in the page. The script file is the BODY of an async
// function evaluated in the page with `ctx` (= window.__mikdash), `shot(name)` (screenshot into --out), `frames(n)`
// (await n animation frames), `sleep(ms)`, `log(...)` and `cdp(method, params)` (DevTools protocol; heap sampling
// profiles come back aggregated by allocating function) in scope; its return value is printed as JSON.
//
//   node src/sim/dev/run.mjs [--q low] [--out shots/sim] [--keep-ui] [--w 1280 --h 720] [--init FILE] --script FILE "<query>"
// --init FILE: a script run in the page before the app boots (e.g. to hook console.error, or set __simSpeed).
//
// Tests (src/sim/dev/tests): jumps.js (determinism under clock jumps), cues.js (600x through a night: every cue once,
// none on jumps, per-frame cost), jumpto.js (the UI's jump-to-event then play: each event's headline cue once),
// firstnight.js (first night frame after a day boot: no shader-compile stall), gc.js (per-frame garbage),
// night.js / patrol.js / visual.js / clearing.js (state + screenshots), zones.js (zone tracking, schedule API, UI +
// audio live; use --keep-ui), dates.js (day types, Shabbat night), helpers.js, initcost.js, navwest.js (reproduces
// the nav coarse-graph rejection west of the Azarah), views.js ("Go": every stand open, every rite of importance ≥ 2
// seen from it — fails on any miss), midnight.js (normal play, --keep-ui: no frame over 100 ms across a date change).
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { out: 'shots/sim', q: 'low', w: 1280, h: 720, timeout: 180, keepUi: false, script: null, init: null };
let query = '';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') opt.out = args[++i];
  else if (a === '--q') opt.q = args[++i];
  else if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--keep-ui') opt.keepUi = true;
  else if (a === '--script') opt.script = args[++i];
  else if (a === '--init') opt.init = args[++i];
  else if (a === '--timeout') opt.timeout = +args[++i];
  else query = a.replace(/^\?/, '');
}
if (!opt.script) { console.error('--script FILE required'); process.exit(2); }
const body = readFileSync(resolve(opt.script), 'utf8');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({
  root, logLevel: 'error', configFile: join(root, 'vite.config.js'),
  server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: EDGE, headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
mkdirSync(resolve(root, opt.out), { recursive: true });
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h } });
  if (opt.init) await page.addInitScript({ content: readFileSync(resolve(opt.init), 'utf8') });
  const logs = [];
  page.on('console', (m) => {
    const t = m.text();
    if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${t}`);
    else if (t.startsWith('[test]')) console.log(t);
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.exposeFunction('__simShot', async (name) => {
    const file = resolve(root, opt.out, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(`[shot] ${file}`);
    return file;
  });
  // cdp(method, params): Chrome DevTools Protocol passthrough. HeapProfiler.getSamplingProfile and .stopSampling (both
  // return the whole profile) come back aggregated: { total, samples, top: [['fn @ src/…:line', bytes], …] } (self
  // sizes by allocating function), so a profile never crosses back into the page. The browser → Node pipe still carries
  // the raw profile (Playwright caps one message at 100 MB): sample at a coarse interval over short windows (gc.js).
  const client = await page.context().newCDPSession(page);
  await page.exposeFunction('__simCdp', async (method, params) => {
    const r = await client.send(method, params || {});
    if (method !== 'HeapProfiler.getSamplingProfile' && method !== 'HeapProfiler.stopSampling') return r;
    const agg = new Map();
    let total = 0;
    const walk = (n) => {
      const cf = n.callFrame;
      if (n.selfSize) {
        total += n.selfSize;
        const k = `${cf.functionName || '(anon)'} @ ${(cf.url || '').replace(/^.*\/src\//, 'src/')}:${cf.lineNumber + 1}`;
        agg.set(k, (agg.get(k) || 0) + n.selfSize);
      }
      for (const c of n.children || []) walk(c);
    };
    walk(r.profile.head);
    return { total, samples: r.profile.samples?.length ?? 0, top: [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300) };
  });
  const qs = new URLSearchParams(query);
  if (!opt.keepUi && !qs.has('shot')) qs.set('shot', '1');
  if (!qs.has('q')) qs.set('q', opt.q);
  const url = `${base}?${qs}`;
  console.log(`url: ${url}`);
  await page.goto(url, { waitUntil: 'load', timeout: opt.timeout * 1000 });
  await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: opt.timeout * 1000, polling: 250 });
  const result = await page.evaluate(async (src) => {
    const ctx = globalThis.__mikdash;
    const frames = (n = 1) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const shot = (name) => globalThis.__simShot(name);
    const log = (...a) => console.log('[test]', ...a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))));
    const cdp = (m, p) => globalThis.__simCdp(m, p);
    try {
      const fn = new Function('ctx', 'frames', 'sleep', 'shot', 'log', 'cdp', `return (async () => {\n${src}\n})();`);
      return { ok: true, value: await fn(ctx, frames, sleep, shot, log, cdp) };
    } catch (e) { return { ok: false, error: String(e?.stack || e) }; }
  }, body);
  console.log(`result: ${JSON.stringify(result, null, 1)}`);
  if (!result.ok) code = 1;
  if (logs.length) console.log(`console (${logs.length}):\n  ${logs.slice(0, 60).join('\n  ')}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(code);
