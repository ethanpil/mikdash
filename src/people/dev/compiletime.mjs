// Measures time-to-ready of the people harness for a solo figure (shader compile dominated):
//   node src/people/dev/compiletime.mjs [--cold] "<query>" [...]
// --cold: every query in a fresh browser (no program cache shared with an earlier page); vite's transforms are warmed
// once by a first page all the same (qa-r2: A/B of shader changes)
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const cold = process.argv.includes('--cold');
const launch = () => chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
let browser = await launch();
// warm vite's transform cache once
{ const p = await browser.newPage(); await p.goto(`${base}src/people/dev/harness.html?solo=dove`); await p.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 300000 }); await p.close(); }
for (const q of process.argv.slice(2).filter((a) => a !== '--cold')) {
  if (cold) { await browser.close(); browser = await launch(); }
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const t0 = Date.now();
  await page.goto(`${base}src/people/dev/harness.html?${q}`);
  await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 300000 });
  const n = await page.evaluate(() => globalThis.__mikdash.renderer.info.programs.length);
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s  programs ${n}  ${q}`);
  await page.close();
}
await browser.close();
await server.close();
