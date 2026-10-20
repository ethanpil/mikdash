#!/usr/bin/env node
// Dev harness for interactive lighting tests (lighting-polish). Not bundled (nothing imports it).
//   node src/render/dev/session.mjs <script.mjs> [--q low] [--query "at=..&look=..&t=.."] [--out shots/x]
// The script module exports `default async function (h)` where h = { page, shot(name), wait(ms), ev(fn|str, arg),
// log(...), q, out }. Starts its own Vite dev server + headless Edge (same flags as tools/shot.mjs).
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { q: 'low', query: '', out: 'shots/lighting-polish', w: 1280, h: 720, ui: false };
let script = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--q') opt.q = args[++i];
  else if (a === '--query') opt.query = args[++i];
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--ui') opt.ui = true;
  else script = a;
}
const mod = await import(pathToFileURL(resolve(script)).href);
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
mkdirSync(resolve(root, opt.out), { recursive: true });
const logs = [];
try {
  const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h } });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  const qs = new URLSearchParams(opt.query);
  if (!opt.ui && !qs.has('shot')) qs.set('shot', '1');
  if (!qs.has('q')) qs.set('q', opt.q);
  await page.goto(`${base}?${qs}`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: +(process.env.BOOT_TIMEOUT || 480000), polling: 250 });
  const h = {
    page, q: opt.q, out: opt.out,
    wait: (ms) => page.waitForTimeout(ms),
    ev: (fn, arg) => page.evaluate(fn, arg),
    log: (...a) => console.log(...a),
    async shot(name) { const f = resolve(root, opt.out, `${name}.png`); await page.screenshot({ path: f }); console.log(`saved ${f}`); return f; },
  };
  await mod.default(h);
} finally {
  if (logs.length) console.log(`console (${logs.length}):\n  ${logs.slice(0, 40).join('\n  ')}`);
  await browser.close();
  await server.close();
}
