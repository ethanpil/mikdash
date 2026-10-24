#!/usr/bin/env node
// Headless screenshot harness (parallel-safe: each run starts its own Vite dev server on a free port).
//
//   node tools/shot.mjs [options] "<query>" [more queries...]
//   node tools/shot.mjs --batch shots.json          # [{ "name": "altar", "query": "at=...&look=..." }, ...]
//
// Options:
//   --out DIR        output directory (default shots/)
//   --name NAME      file name for a single query (default derived from query)
//   --q TIER         quality tier low|medium|high|ultra (default medium) — appended unless query has q=
//   --w W --h H      viewport size (default 1280x720)
//   --timeout S      seconds to wait for window.__mikdashReady (default 120)
//   --keep-ui        do not add shot=1 (renders the UI too; clock keeps running)
//   --eval "JS"      evaluate JS in the page after ready (result printed; a Promise is awaited), e.g. "__mikdash.renderer.info.render"
//   --prod           measure the PRODUCTION bundle: vite build into a temp dir, served by vite preview
//                    (slower to start, but timings match what visitors get)
//   --browser-arg A  extra browser command-line switch (repeatable), e.g. --browser-arg=--disable-3d-apis (no WebGL)
//
// Browser: CHROME_PATH, else Edge, else Chrome, else Playwright's Chromium (tools/browser.mjs).
// Prints: browser, saved paths, console errors/warnings, GPU string, draw calls/triangles, build times.
// Then Read the PNGs to look at them.
import { createServer, build as viteBuild, preview as vitePreview } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, GPU_ARGS } from './browser.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { out: 'shots', q: 'medium', w: 1280, h: 720, timeout: 120, keepUi: false, evals: [], prod: false, browserArgs: [] };
const queries = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') opt.out = args[++i];
  else if (a === '--name') opt.name = args[++i];
  else if (a === '--q') opt.q = args[++i];
  else if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--timeout') opt.timeout = +args[++i];
  else if (a === '--keep-ui') opt.keepUi = true;
  else if (a === '--eval') opt.evals.push(args[++i]);
  else if (a === '--prod') opt.prod = true;
  else if (a === '--browser-arg') opt.browserArgs.push(args[++i]);
  else if (a.startsWith('--browser-arg=')) opt.browserArgs.push(a.slice('--browser-arg='.length));
  else if (a === '--batch') {
    const list = JSON.parse(readFileSync(args[++i], 'utf8'));
    for (const it of list) queries.push({ name: it.name, query: it.query });
  } else queries.push({ name: null, query: a.replace(/^\?/, '') });
}
if (!queries.length) queries.push({ name: 'default', query: '' });

function slug(s) {
  return (s || 'default').replace(/[^a-z0-9.,=-]+/gi, '_').replace(/[=,]/g, '-').slice(0, 80) || 'default';
}

// the browser first: a machine without one fails here, before the dev server or the production build
const { browser, label: browserLabel } = await launchBrowser(chromium, {
  headless: true, args: [...GPU_ARGS, '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', ...opt.browserArgs],
}).catch((e) => { console.error(e.message); process.exit(1); });
console.log(`browser: ${browserLabel} ${browser.version()}`);

let server, prodDir = null;
if (opt.prod) {
  prodDir = join(tmpdir(), `mikdash-prod-${process.pid}`);
  await viteBuild({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), build: { outDir: prodDir, emptyOutDir: true } });
  server = await vitePreview({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'),
    build: { outDir: prodDir }, preview: { port: 0, host: '127.0.0.1', strictPort: false } });
} else {
  server = await createServer({
    root, logLevel: 'error', configFile: join(root, 'vite.config.js'),
    server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null },
  });
  await server.listen();
}
const base = server.resolvedUrls.local[0];
mkdirSync(resolve(root, opt.out), { recursive: true });
let failures = 0;
try {
  for (const { name, query } of queries) {
    const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h } });
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const qs = new URLSearchParams(query);
    if (!opt.keepUi && !qs.has('shot')) qs.set('shot', '1');
    if (!qs.has('q')) qs.set('q', opt.q);
    const url = `${base}?${qs}`;
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'load', timeout: opt.timeout * 1000 });
    try {
      await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: opt.timeout * 1000, polling: 250 });
    } catch { logs.push('[harness] timed out waiting for __mikdashReady'); failures++; }
    const info = await page.evaluate(() => {
      const c = globalThis.__mikdash;
      if (!c) return { error: globalThis.__mikdashError || 'no ctx' };
      const r = c.renderer;
      let gpu = '';
      try {
        const gl = r.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
      } catch { /* ignore */ }
      return {
        tier: c.quality?.key, gpu, fps: Math.round(c.engine.fps),
        calls: r.info.render.calls, triangles: r.info.render.triangles,
        geometries: r.info.memory.geometries, textures: r.info.memory.textures,
        buildTimes: c.buildTimes, bootTimes: c.bootTimes, programs: r.info.programs?.length,
        time: c.time?.t, error: globalThis.__mikdashError,
      };
    }).catch((e) => ({ error: String(e) }));
    const evals = [];
    for (const js of opt.evals) {
      evals.push(await page.evaluate(async (code) => {
        try { return JSON.stringify(await (0, eval)(code)); } catch (e) { return `ERR ${e.message}`; }
      }, js).catch((e) => `ERR ${e.message}`));
    }
    const file = resolve(root, opt.out, `${name || opt.name || slug(query)}.png`);
    await page.screenshot({ path: file });
    console.log(`\n=== ${file}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    console.log(`url: ${url}`);
    console.log(`info: ${JSON.stringify(info)}`);
    evals.forEach((e, i) => console.log(`eval[${i}]: ${e}`));
    if (logs.length) console.log(`console (${logs.length}):\n  ${logs.slice(0, 40).join('\n  ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  await (server.close?.() ?? server.httpServer?.close?.());
  if (prodDir) { try { rmSync(prodDir, { recursive: true, force: true }); } catch { /* ignore */ } }
}
process.exit(failures ? 1 : 0);
