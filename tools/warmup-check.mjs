#!/usr/bin/env node
// Shader warm-up check (perf-fix-1, perf-fix-2): on each tier, a cold production boot must draw its first view with the
// programs the warm-up compiled — no material may hold two programs (a warm-up keyed differently from the frame: light
// counts, shadow state, render target) — and the first drawn frame must follow 'compiled' within the tier's limit.
// Both boot modes are checked: a screenshot boot (shot=1: clock paused, everything discovered is waited for) and normal
// play (the UI and intro up, the clock running, late people batches drawn at a coarser LOD until linked).
//
//   node tools/warmup-check.mjs [--tiers low,medium,high,ultra] [--modes shot,play] ["<query>"]
// Exit code 1 on any failure. One production build; each tier × mode is one cold browser (fresh profile: no GPU program
// cache). Also reported (play): the worst frame and the synchronous GL calls over 50 ms in the 5 s after the view
// (before any input). Fails on any shader info-log read after 'ready' (the production bundle must not check shaders:
// core/engine.js) and on console errors / warnings.
//
// Gap limits ('compiled' → first frame): low / medium 1 s; high / ultra 2 s — their first frame also draws the
// cascades' and fires' shadow passes, whose depth programs three creates inside WebGLShadowMap (keyed by the previous
// light setup, not warmed: perf-fix-1.md): 0.5–1.1 s on the HD 4600 in the perf-fix-1 review's runs, 1.9 s
// with other processes holding ≈ 85 % of it (these links run on this thread and the GPU process's, CPU-bound).
import { createRequire } from 'node:module';
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build as viteBuild, preview as vitePreview } from 'vite';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const { chromium } = createRequire(join(root, 'package.json'))('playwright-core');
const args = process.argv.slice(2);
let tiers = ['low', 'medium', 'high', 'ultra'];
let modes = ['shot', 'play'];
let query = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tiers') tiers = args[++i].split(',');
  else if (args[i] === '--modes') modes = args[++i].split(',');
  else query = args[i];
}
const GAP_MS = { low: 1000, medium: 1000, high: 2000, ultra: 2000 };
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/microsoft-edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'].find((p) => existsSync(p));

const dir = join(tmpdir(), `mikdash-warmup-${process.pid}`);
await viteBuild({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), build: { outDir: dir, emptyOutDir: true } });
const server = await vitePreview({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), build: { outDir: dir }, preview: { port: 0, host: '127.0.0.1', strictPort: false } });
const base = server.resolvedUrls.local[0];

let failed = false;
for (const q of tiers) {
  for (const mode of modes) {
    const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
    const logs = [];
    let res = null;
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`); });
      page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
      await page.addInitScript(() => {
        const ft = (globalThis.__wcFrames = []);
        const slow = (globalThis.__wcSlow = []);
        const P = globalThis.WebGL2RenderingContext?.prototype;
        if (P) for (const k of ['getProgramInfoLog', 'getShaderInfoLog', 'getProgramParameter', 'getUniformBlockIndex', 'getActiveUniform', 'getUniformLocation', 'readPixels', 'getBufferSubData', 'finish']) {
          const o = P[k];
          if (!o) continue;
          P[k] = function (...a) {
            const t = performance.now();
            try { return o.apply(this, a); } finally { const d = performance.now() - t; if (d > 50 || /InfoLog/.test(k)) slow.push([k, Math.round(t), Math.round(d)]); }
          };
        }
        const f = (t) => { ft.push(t); requestAnimationFrame(f); };
        requestAnimationFrame(f);
      });
      const qs = new URLSearchParams(query);
      qs.set('q', q);
      if (mode === 'shot') qs.set('shot', '1');
      await page.goto(`${base}?${qs}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => globalThis.__mikdash?.bootTimes?.firstFrame > 0, null, { timeout: 600000, polling: 100 });
      await page.waitForFunction(() => performance.now() > globalThis.__mikdash.bootTimes.firstFrame + 5000, null, { timeout: 60000, polling: 250 });
      res = await page.evaluate(() => {
        const c = globalThis.__mikdash, r = c.renderer, mats = new Set(), dup = [];
        c.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => mats.add(m)); });
        for (const m of mats) { const p = r.properties.get(m).programs; if (p && p.size > 1) dup.push(m.name || m.type); }
        const bt = c.bootTimes, ff = bt.firstFrame, ft = globalThis.__wcFrames;
        let worst = 0;
        for (let i = 1; i < ft.length; i++) if (ft[i] > ff && ft[i - 1] < ff + 5000) worst = Math.max(worst, ft[i] - ft[i - 1]);
        const slow = globalThis.__wcSlow.filter(([, t]) => t > bt.ready);
        return {
          tier: c.quality.key, materials: mats.size, dup, programs: r.info.programs.length, bt, worst: Math.round(worst),
          infoLogs: slow.filter(([k]) => /InfoLog/.test(k)).length,
          slowAfter: slow.filter(([k, t, d]) => d > 50 && t >= ff && t < ff + 5000).map(([k, t, d]) => `${k}@+${t - ff}:${d}`),
        };
      });
    } catch (e) {
      logs.push(`[harness] ${String(e).slice(0, 300)}`);
    } finally {
      await browser.close();
    }
    if (!res) { console.log(`${q} ${mode}: FAIL (no result)\n  ${logs.slice(0, 6).join('\n  ')}`); failed = true; continue; }
    const gap = res.bt.firstFrame - res.bt.compiled;
    const problems = [];
    if (res.dup.length) problems.push(`${res.dup.length} materials with two programs (${res.dup.slice(0, 6).join(', ')})`);
    if (!(gap < (GAP_MS[q] ?? 1000))) problems.push(`first frame ${gap} ms after 'compiled' (limit ${GAP_MS[q] ?? 1000})`);
    if (res.infoLogs) problems.push(`${res.infoLogs} shader info-log reads after 'ready'`);
    if (logs.length) problems.push(`${logs.length} console warnings / errors`);
    if (problems.length) failed = true;
    console.log(`${q} ${mode}: ${problems.length ? 'FAIL' : 'PASS'}  programs ${res.programs}  compiled ${(res.bt.compiled / 1000).toFixed(1)} s  firstFrame ${(res.bt.firstFrame / 1000).toFixed(1)} s  (+${gap} ms)`
      + `  worst frame in 5 s ${res.worst} ms${res.slowAfter.length ? `  sync GL > 50 ms: ${res.slowAfter.join(' ')}` : ''}${problems.length ? `\n  ${problems.join('\n  ')}` : ''}`);
    if (logs.length) console.log(`  console:\n  ${logs.slice(0, 8).join('\n  ')}`);
  }
}
await server.close();
try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
console.log(failed ? 'FAILED' : 'ALL PASSED');
process.exit(failed ? 1 : 0);
