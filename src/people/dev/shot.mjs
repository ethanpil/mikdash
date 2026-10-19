#!/usr/bin/env node
// Screenshots of the stand-alone people harness (src/people/dev/harness.html), modelled on tools/shot.mjs.
//   node src/people/dev/shot.mjs [--out DIR] [--w W --h H] [--name N] [--js CODE] "<query>" ...   |   --batch file.json
// Prints console errors/warnings, draw calls, triangles and people stats.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { out: 'shots/people', w: 1280, h: 720, timeout: 90 };
const queries = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') opt.out = args[++i];
  else if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--name') opt.name = args[++i];
  else if (a === '--js') opt.js = args[++i]; // JS evaluated after init (URL-encoded for you)
  else if (a === '--batch') for (const it of JSON.parse(readFileSync(args[++i], 'utf8'))) queries.push(it);
  else queries.push({ name: opt.name, query: a });
}
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
mkdirSync(resolve(root, opt.out), { recursive: true });
try {
  for (const { name, query } of queries) {
    const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h } });
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 400)}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const url = `${base}src/people/dev/harness.html?${query}${opt.js ? `&eval=${encodeURIComponent(opt.js)}` : ''}`;
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'load' });
    try { await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: opt.timeout * 1000 }); } catch { logs.push('[harness] timeout'); }
    const info = await page.evaluate(() => {
      const c = globalThis.__mikdash;
      const r = c?.renderer;
      return r ? { calls: r.info.render.calls, tris: r.info.render.triangles, people: c.people?.stats } : null;
    }).catch((e) => String(e));
    const file = resolve(root, opt.out, `${name || 'harness'}.png`);
    await page.screenshot({ path: file });
    console.log(`=== ${file} (${((Date.now() - t0) / 1000).toFixed(1)}s) ${JSON.stringify(info)}`);
    if (logs.length) console.log(`  ${logs.slice(0, 20).join('\n  ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
