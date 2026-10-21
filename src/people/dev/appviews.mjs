#!/usr/bin/env node
// Many views of ONE app page load (index.html, the real world): the boot is paid once, then a setup script runs
// (e.g. spawning actors at the Moked's ledges), and each view flies the observer to a point and screenshots.
//   node src/people/dev/appviews.mjs --out DIR [--q low|high] [--w W --h H] file.json
//   file.json: [{ query: "t=sunrise+120&at=X,Y", setup?: "JS", views: [{ name, eye: [X,Y,Z] (site amot), look: [H,P],
//                 fov?, js?, frames?, clip?: [x,y,w,h] }] }]
// Setup/view JS runs in the page with `ctx` = __mikdash and `S` = a scratch object kept across the job's views.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { out: 'shots/people', w: 1280, h: 720, q: 'medium', timeout: 240 };
let jobs = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') opt.out = args[++i];
  else if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--q') opt.q = args[++i];
  else jobs = jobs.concat(JSON.parse(readFileSync(a, 'utf8')));
}
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
mkdirSync(resolve(root, opt.out), { recursive: true });
const run = (page, code) => page.evaluate(async (code) => {
  const ctx = globalThis.__mikdash, S = (globalThis.__S ||= {});
  try { const r = await (0, eval)(`(async (ctx, S) => { ${code} })`)(ctx, S); return r === undefined ? null : JSON.stringify(r); } catch (e) { return `ERR ${e.message}`; }
}, code);
try {
  for (const job of jobs) {
    const page = await browser.newPage({ viewport: { width: job.w || opt.w, height: job.h || opt.h } });
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/X4122|favicon|status of 404/.test(m.text())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const qs = new URLSearchParams(job.query);
    if (!qs.has('shot')) qs.set('shot', '1');
    if (!qs.has('q')) qs.set('q', job.q || opt.q);
    const t0 = Date.now();
    await page.goto(`${base}?${qs}`, { waitUntil: 'load', timeout: opt.timeout * 1000 });
    try { await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: opt.timeout * 1000, polling: 250 }); } catch { logs.push('[appviews] timeout'); }
    console.log(`--- ${qs} ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (job.setup) console.log(`setup: ${await run(page, job.setup)}`);
    for (const v of job.views) {
      const r = await run(page, `
        const A = 0.48, p = ctx.player;
        ${v.js || ''}
        if (${JSON.stringify(!!v.eye)}) { p.setMode('fly'); const e = ${JSON.stringify(v.eye || [0, 0, 0])}; p.position.set(e[0] * A, e[2] * A - (p.eye.y - p.position.y), -e[1] * A); }
        if (${JSON.stringify(!!v.look)}) p.setLook(${(v.look || [0, 0])[0]}, ${(v.look || [0, 0])[1]});
        if (${v.fov || 0}) { ctx.camera.fov = ${v.fov || 60}; ctx.camera.updateProjectionMatrix(); }
        for (let i = 0; i < ${v.frames || 6}; i++) await new Promise((r) => requestAnimationFrame(r));
      `);
      const file = resolve(root, opt.out, `${v.name}.png`);
      await page.screenshot({ path: file, clip: v.clip ? { x: v.clip[0], y: v.clip[1], width: v.clip[2], height: v.clip[3] } : undefined });
      console.log(`=== ${file}${r && r !== 'null' ? `  ${r}` : ''}`);
    }
    const info = await run(page, 'const r = ctx.renderer.info.render; return { calls: r.calls, tris: r.triangles, fps: Math.round(ctx.engine.fps) };');
    console.log(`info: ${info}`);
    if (logs.length) console.log(`  ${logs.slice(0, 20).join('\n  ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
