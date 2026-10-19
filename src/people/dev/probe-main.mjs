// Main-app probe (dev only, modelled on tools/shot.mjs): load the app, wait until ready, evaluate a script file in
// the page, print its result and console problems.  node src/people/dev/probe-main.mjs "<query>" checks.js [shot.png]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { resolve, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
const root = 'C:/Code/temple-walk/mikdash';
const [query, file, shotPath] = process.argv.slice(2);
const js = readFileSync(file, 'utf8');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`${server.resolvedUrls.local[0]}?${query}`);
await page.waitForFunction(() => window.__mikdashReady === true, null, { timeout: 180000 });
const r = await page.evaluate(async (code) => { try { return await (0, eval)(code); } catch (e) { return 'ERR ' + e.stack; } }, js);
console.log(typeof r === "string" ? r : JSON.stringify(r));
if (shotPath) await page.screenshot({ path: shotPath });
console.log(logs.filter((l) => !/X4122|favicon|404/.test(l)).slice(0, 25).join('\n'));
await browser.close();
await server.close();
