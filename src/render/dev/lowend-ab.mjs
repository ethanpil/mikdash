#!/usr/bin/env node
// lowend-visuals: interleaved cold A/B of two checkouts' production bundles — the first view (cold boot, normal play) and the
// frame rate at a fixed resolution once the boot's background work has drained. Not bundled (nothing imports it).
//
//   node src/render/dev/lowend-ab.mjs --base <path of the other checkout> [--q low] [--views spawn,azarah,kodesh]
//                                     [--reps 3] [--secs 10] [--maxwait 90]
// Each sample is a fresh browser (no GPU program cache): ?q=…&fixedres=1&<view>, Enter as soon as the intro is up, then
// frames are timed for `secs` once bootTimes.drained is set (or `maxwait` s after the first frame). Builds alternate
// order every repetition. Prints per sample and a summary (mean of the samples' mean fps; first view in s).
import { build as viteBuild, preview as vitePreview } from 'vite';
import { chromium } from 'playwright-core';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, GPU_ARGS } from '../../../tools/browser.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { base: null, q: 'low', views: ['spawn', 'azarah', 'kodesh'], reps: 3, secs: 10, maxwait: 90, adaptive: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--base') opt.base = resolve(args[++i]);
  else if (a === '--q') opt.q = args[++i];
  else if (a === '--views') opt.views = args[++i].split(',');
  else if (a === '--reps') opt.reps = +args[++i];
  else if (a === '--secs') opt.secs = +args[++i];
  else if (a === '--maxwait') opt.maxwait = +args[++i];
  else if (a === '--adaptive') opt.adaptive = true;
}
if (!opt.base) { console.error('--base <checkout> is required'); process.exit(2); }
const VIEWS = {
  spawn: '',
  azarah: 'at=238,385&look=215,4&t=d3',
  kodesh: 'at=136,330.5&look=270,5&t=d3',
  'kodesh-n3': 'at=136,330.5&look=270,5&t=n3',
  aerial: 'pos=430,40,240&look=315,-28&fly=1&t=d3',
};

async function serve(dir, label) {
  const out = join(tmpdir(), `mikdash-ab-${label}-${process.pid}`);
  await viteBuild({ root: dir, logLevel: 'error', configFile: join(dir, 'vite.config.js'), build: { outDir: out, emptyOutDir: true } });
  const server = await vitePreview({ root: dir, logLevel: 'error', configFile: join(dir, 'vite.config.js'), build: { outDir: out }, preview: { port: 0, host: '127.0.0.1', strictPort: false } });
  return { label, server, out, url: server.resolvedUrls.local[0] };
}

const builds = [await serve(opt.base, 'base'), await serve(root, 'new')];
const results = {};
try {
  for (let rep = 0; rep < opt.reps; rep++) {
    for (const view of opt.views) {
      const order = rep % 2 ? [...builds].reverse() : builds;
      for (const b of order) {
        const { browser } = await launchBrowser(chromium, { headless: true, args: GPU_ARGS });
        let r = null;
        try {
          const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
          const qs = new URLSearchParams(VIEWS[view]);
          qs.set('q', opt.q);
          if (!opt.adaptive) qs.set('fixedres', '1');
          await page.goto(`${b.url}?${qs}`, { waitUntil: 'load', timeout: 120000 });
          await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 300000, polling: 100 });
          await page.evaluate(() => globalThis.__mikdash.ui.enter());
          await page.waitForFunction((ms) => { const bt = globalThis.__mikdash.bootTimes; return bt.drained > 0 || performance.now() > bt.firstFrame + ms; }, opt.maxwait * 1000, { timeout: opt.maxwait * 1000 + 60000, polling: 500 });
          // (and the first-visit AO ray-march, which follows the drain: its worker is not part of the steady frame)
          await page.evaluate(() => globalThis.__mikdash.env.visibility?.aoReady());
          await page.waitForTimeout(2500);
          r = await page.evaluate(async (secs) => {
            const d = [];
            let last = 0;
            const t0 = performance.now();
            let sc = 0, ns = 0;
            await new Promise((done) => { const f = (t) => { if (last) d.push(t - last); last = t; sc += globalThis.__mikdash.post.scale; ns++; if (t - t0 < secs * 1000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
            const s = [...d].sort((a, b) => a - b);
            const c = globalThis.__mikdash;
            return {
              fps: 1000 / (d.reduce((a, b) => a + b, 0) / d.length), median: 1000 / s[Math.floor(s.length / 2)], p90ms: s[Math.floor(s.length * 0.9)],
              first: c.bootTimes.firstFrame / 1000, drained: c.bootTimes.drained ? (c.bootTimes.drained - c.bootTimes.firstFrame) / 1000 : null,
              calls: c.post.stats.calls, scale: sc / Math.max(ns, 1), vis: c.env.visibility ? { ao: c.env.visibility.stats.aoWorkerMs, cached: c.env.visibility.stats.aoCached } : null,
            };
          }, opt.secs);
        } catch (e) { console.log(`${b.label} ${view}: ${String(e).slice(0, 200)}`); }
        finally { await browser.close(); }
        if (!r) continue;
        (results[`${view}|${b.label}`] ||= []).push(r);
        console.log(`rep ${rep} ${view.padEnd(10)} ${b.label.padEnd(5)} fps ${r.fps.toFixed(1)} (median ${r.median.toFixed(1)}, p90 ${r.p90ms.toFixed(1)} ms, scale ${r.scale.toFixed(2)})  first view ${r.first.toFixed(1)} s  drained +${r.drained ?? '—'} s  calls ${r.calls}${r.vis ? `  ao ${r.vis.ao} ms` : ''}`);
      }
    }
  }
} finally {
  for (const b of builds) { await b.server.close(); try { rmSync(b.out, { recursive: true, force: true }); } catch { /* ignore */ } }
}
console.log('\nsummary (mean over samples)');
for (const view of opt.views) {
  const line = builds.map((b) => {
    const a = results[`${view}|${b.label}`] || [];
    const m = (k) => a.reduce((s, x) => s + x[k], 0) / Math.max(a.length, 1);
    return `${b.label}: ${m('fps').toFixed(1)} fps, scale ${m('scale').toFixed(2)}, first view ${m('first').toFixed(2)} s (n ${a.length})`;
  }).join('   ');
  console.log(`${view.padEnd(10)} ${line}`);
}
