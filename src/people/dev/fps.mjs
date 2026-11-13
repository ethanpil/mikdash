// measure frames/second of the harness for a scene script (dev only)
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { launchBrowser, GPU_ARGS } from '../../../tools/browser.mjs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const [query, file] = process.argv.slice(2);
const js = file ? readFileSync(file, 'utf8') : '';
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const { browser } = await launchBrowser(chromium, { headless: true, args: [...GPU_ARGS] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${server.resolvedUrls.local[0]}src/people/dev/harness.html?${query}&eval=${encodeURIComponent(js)}`);
await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 60000 });
const r = await page.evaluate(() => new Promise((res) => {
  const c = globalThis.__mikdash; const f0 = c.engine.frame; const t0 = performance.now();
  setTimeout(() => {
    const ri = c.renderer.info.render;
    res({ fps: +((c.engine.frame - f0) / ((performance.now() - t0) / 1000)).toFixed(1), calls: ri.calls, tris: ri.triangles, stats: c.people.stats });
  }, 4000);
}));
console.log(JSON.stringify(r));
await browser.close(); await server.close();
