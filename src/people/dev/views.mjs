#!/usr/bin/env node
// Many camera views of one people-harness page load (src/people/dev/harness.html): the bake and shader compile are
// paid once, then each view moves the camera (site amot, like the harness's pos/look), optionally runs JS (e.g. sets a
// pose phase on ctx.people.demo.solo[i]) and screenshots, optionally clipped.
//   node src/people/dev/views.mjs --out DIR [--w W --h H] file.json
//   file.json: [{ query, views: [{ name, pos: [X,Y,Z], look: [H,P], fov?, js?, clip?: [x,y,w,h], frames? }] }]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { out: 'shots/people', w: 1280, h: 720, timeout: 120 };
let jobs = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') opt.out = args[++i];
  else if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else jobs = jobs.concat(JSON.parse(readFileSync(a, 'utf8')));
}
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
mkdirSync(resolve(root, opt.out), { recursive: true });
try {
  for (const job of jobs) {
    const page = await browser.newPage({ viewport: { width: job.w || opt.w, height: job.h || opt.h } });
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/X4122|favicon|404/.test(m.text())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const t0 = Date.now();
    await page.goto(`${base}src/people/dev/harness.html?${job.query}`, { waitUntil: 'load' });
    try { await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: opt.timeout * 1000 }); } catch { logs.push('[harness] timeout'); }
    console.log(`--- ${job.query} ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    for (const v of job.views) {
      await page.evaluate(async (v) => {
        const c = globalThis.__mikdash, cam = c.camera, A = 0.48;
        if (v.js) (0, eval)(v.js);
        if (v.pos) cam.position.set(v.pos[0] * A, v.pos[2] * A, -v.pos[1] * A);
        if (v.look) cam.rotation.set(v.look[1] * Math.PI / 180, -v.look[0] * Math.PI / 180, 0, 'YXZ');
        if (v.fov) { cam.fov = v.fov; cam.updateProjectionMatrix(); }
        for (let i = 0; i < (v.frames || 4); i++) await new Promise((r) => requestAnimationFrame(r));
      }, v);
      const file = resolve(root, opt.out, `${v.name}.png`);
      await page.screenshot({ path: file, clip: v.clip ? { x: v.clip[0], y: v.clip[1], width: v.clip[2], height: v.clip[3] } : undefined });
      console.log(`=== ${file}`);
    }
    if (logs.length) console.log(`  ${logs.slice(0, 20).join('\n  ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
