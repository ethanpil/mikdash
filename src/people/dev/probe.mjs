// one-off probe: load the harness with JS, wait, then evaluate an expression in the page
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { launchBrowser, GPU_ARGS } from '../../../tools/browser.mjs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const [query, js, expr] = process.argv.slice(2);
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const { browser } = await launchBrowser(chromium, { headless: true, args: [...GPU_ARGS] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on('console', (m) => { if (['error'].includes(m.type())) console.log('[console]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${server.resolvedUrls.local[0]}src/people/dev/harness.html?${query}&eval=${encodeURIComponent(js || '')}`);
await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 60000 });
console.log(await page.evaluate((e) => { try { return JSON.stringify((0, eval)(e)); } catch (err) { return 'ERR ' + err.message; } }, expr));
await browser.close();
await server.close();
