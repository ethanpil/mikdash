#!/usr/bin/env node
// Per-tier golden screenshots and their comparison (lowend-visuals): the guard that no tier's image gets worse.
//
//   node tools/goldens.mjs --label base                       # capture every view × tier into shots/goldens/base/
//   node tools/goldens.mjs --label base2                      # a second capture of the same build: the noise floor
//   node tools/goldens.mjs --label new --against base --noise base2 [--expect low,medium]
//   node tools/goldens.mjs --compare new --against base --noise base2 [--expect low,medium]   # compare only
//
// Options: --tiers low,medium,high,ultra   --views spawn-predawn,azarah-d3,…   --prod (production bundle; default the dev
// server)   --out DIR (default shots/goldens)   --ref TIER (the reference tier for --expect, default ultra).
//
// Each tier × view is one page of one browser (tools/shot.mjs's shot mode: clock paused, fixed resolution, everything the
// view needs compiled and baked before window.__mikdashReady). Metrics, per tier × view, on 8-bit sRGB pixels:
//   mean  — mean absolute difference over RGB (/255) at full resolution
//   px8   — share of pixels whose largest channel difference exceeds 8/255
//   lum8  — mean absolute luminance difference at 1/8 resolution (box filtered: the lighting, not the edges or the noise)
// Verdicts. A tier not in --expect must be UNCHANGED: mean and px8 within the noise floor (the same build captured twice,
// --noise; without it 1.0/255 and 0.5 %) × 1.5 + a small epsilon, at least 0.35/255 and 1 % (fires and smoke animate in
// real time even in shot mode). A tier in --expect (its capability flags changed on
// purpose) may change, but must not move AWAY from the reference tier: its lum8 distance to the reference tier's image of
// the same view (the reference captured in the same run) may not grow beyond the noise floor — it should shrink.
// Writes <label>/compare-<base>.json and a contact sheet <label>/compare-<base>.jpg (per view: each tier's before, after
// and the difference ×4). Exit code 1 when any verdict fails.
import { createServer, build as viteBuild, preview as vitePreview } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { launchBrowser, GPU_ARGS } from './browser.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

// the views the user named: the spawn before dawn, the Azarah at day hour 3, the Kodesh at night hour 3 and day hour 3,
// Har HaMishchah at sunrise (the stand of zones-content.js) and an aerial over the Mount's south-east corner
export const VIEWS = {
  'spawn-predawn': '',
  'azarah-d3': 'at=238,385&look=215,4&t=d3',
  'kodesh-n3': 'at=136,330.5&look=270,5&t=n3',
  'kodesh-d3': 'at=136,330.5&look=270,5&t=d3',
  'mishchah-sunrise': 'at=2171.667,330.5,141.667&look=270,-2&t=sunrise',
  aerial: 'pos=430,40,240&look=315,-28&fly=1&t=d3',
};
const ALL_TIERS = ['low', 'medium', 'high', 'ultra'];

const args = process.argv.slice(2);
const opt = { out: 'shots/goldens', tiers: ALL_TIERS, views: Object.keys(VIEWS), label: null, compare: null, against: null, noise: null, expect: [], ref: 'ultra', prod: false, w: 1280, h: 720, timeout: 600 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--label') opt.label = args[++i];
  else if (a === '--compare') opt.compare = args[++i];
  else if (a === '--against') opt.against = args[++i];
  else if (a === '--noise') opt.noise = args[++i];
  else if (a === '--expect') opt.expect = args[++i].split(',').filter(Boolean);
  else if (a === '--ref') opt.ref = args[++i];
  else if (a === '--tiers') opt.tiers = args[++i].split(',').filter(Boolean);
  else if (a === '--views') opt.views = args[++i].split(',').filter(Boolean);
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--prod') opt.prod = true;
  else if (a === '--timeout') opt.timeout = +args[++i];
  else { console.error(`unknown argument ${a}`); process.exit(2); }
}
for (const v of opt.views) if (!(v in VIEWS)) { console.error(`unknown view ${v} (${Object.keys(VIEWS).join(', ')})`); process.exit(2); }
const outDir = resolve(root, opt.out);
const dirOf = (label) => join(outDir, label);
const pngOf = (label, tier, view) => join(dirOf(label), tier, `${view}.png`);

const { browser, label: browserLabel } = await launchBrowser(chromium, {
  headless: true, args: [...GPU_ARGS, '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
}).catch((e) => { console.error(e.message); process.exit(1); });
console.log(`browser: ${browserLabel} ${browser.version()}`);
let failed = false;
try {
  if (opt.label) await capture(opt.label);
  const cmp = opt.compare || (opt.against ? opt.label : null);
  if (cmp && opt.against) failed = !(await compare(cmp, opt.against));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);

async function capture(label) {
  let server, prodDir = null;
  if (opt.prod) {
    prodDir = join(tmpdir(), `mikdash-goldens-${process.pid}`);
    await viteBuild({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), build: { outDir: prodDir, emptyOutDir: true } });
    server = await vitePreview({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), build: { outDir: prodDir }, preview: { port: 0, host: '127.0.0.1', strictPort: false } });
  } else {
    server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null } });
    await server.listen();
  }
  const base = server.resolvedUrls.local[0];
  let rev = '?';
  try { rev = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim() + (execSync('git status --porcelain -- src', { cwd: root }).toString().trim() ? '+dirty' : ''); } catch { /* not a checkout */ }
  const metaFile = join(dirOf(label), 'meta.json');
  const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : { shots: {} };
  Object.assign(meta, { rev, browser: `${browserLabel} ${browser.version()}`, prod: opt.prod, size: [opt.w, opt.h], date: new Date().toISOString() });
  try {
    for (const tier of opt.tiers) {
      mkdirSync(join(dirOf(label), tier), { recursive: true });
      for (const view of opt.views) {
        const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h } });
        const logs = [];
        page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`); });
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const qs = new URLSearchParams(VIEWS[view]);
        qs.set('shot', '1');
        qs.set('q', tier);
        const t0 = Date.now();
        await page.goto(`${base}?${qs}`, { waitUntil: 'load', timeout: opt.timeout * 1000 });
        let ok = true;
        try { await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: opt.timeout * 1000, polling: 250 }); }
        catch { ok = false; logs.push('[harness] timed out waiting for __mikdashReady'); }
        const info = await page.evaluate(() => {
          const c = globalThis.__mikdash;
          if (!c) return { error: globalThis.__mikdashError || 'no ctx' };
          return { tier: c.quality?.key, calls: c.renderer.info.render.calls, triangles: c.renderer.info.render.triangles, programs: c.renderer.info.programs?.length, error: globalThis.__mikdashError };
        }).catch((e) => ({ error: String(e) }));
        const file = pngOf(label, tier, view);
        await page.screenshot({ path: file });
        await page.close();
        meta.shots[`${tier}/${view}`] = { ...info, secs: +((Date.now() - t0) / 1000).toFixed(1), ok, logs: logs.slice(0, 10) };
        console.log(`${label} ${tier} ${view}: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${info.calls} calls${logs.length ? `, ${logs.length} console lines: ${logs.slice(0, 3).join(' | ')}` : ''}`);
        if (!ok) failed = true;
      }
    }
  } finally {
    writeFileSync(metaFile, JSON.stringify(meta, null, 1));
    await (server.close?.() ?? server.httpServer?.close?.());
    if (prodDir) { try { rmSync(prodDir, { recursive: true, force: true }); } catch { /* ignore */ } }
  }
}

// ------------------------------------------------------------------------------------------------ comparison (in a page)
async function compare(label, against) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent('<!doctype html><title>goldens</title><body></body>');
  await page.evaluate(PAGE_LIB);
  const load = async (key, file) => {
    if (!existsSync(file)) return false;
    await page.evaluate(([k, b64]) => globalThis.__load(k, b64), [key, readFileSync(file).toString('base64')]);
    return true;
  };
  const rows = [];
  const tiers = opt.tiers;
  const refTier = opt.ref;
  for (const view of opt.views) {
    for (const tier of tiers) {
      const have = (await load('a', pngOf(against, tier, view))) && (await load('b', pngOf(label, tier, view)));
      if (!have) { rows.push({ tier, view, missing: true }); continue; }
      const d = await page.evaluate(() => globalThis.__diff('a', 'b'));
      const row = { tier, view, ...d };
      if (opt.noise && (await load('n', pngOf(opt.noise, tier, view)))) row.noise = await page.evaluate(() => globalThis.__diff('a', 'n'));
      if (opt.expect.includes(tier) && tier !== refTier) {
        // the distance of before and after to the reference tier's image (each run's own reference)
        // (a run that did not capture the reference tier compares with the base run's: pass --tiers with it to be exact)
        const refA = await load('ra', pngOf(against, refTier, view));
        const refB = (await load('rb', pngOf(label, refTier, view))) || (await load('rb', pngOf(against, refTier, view)));
        if (refA && refB) {
          row.refBefore = (await page.evaluate(() => globalThis.__diff('a', 'ra'))).lum8;
          row.refAfter = (await page.evaluate(() => globalThis.__diff('b', 'rb'))).lum8;
          if (opt.noise && (await load('rn', pngOf(opt.noise, refTier, view)))) row.refNoise = (await page.evaluate(() => globalThis.__diff('n', 'rn'))).lum8;
        }
      }
      rows.push(row);
    }
  }
  // verdicts
  let pass = true;
  for (const r of rows) {
    if (r.missing) { r.verdict = 'missing'; pass = false; continue; }
    const nm = r.noise ? r.noise.mean : 1.0, np = r.noise ? r.noise.px8 : 0.5, nl = r.noise ? r.noise.lum8 : 0.5;
    // floors: the flames and smoke animate in real time even with the clock paused (≈ 0.2–0.8 % of a view with fires)
    r.limit = { mean: +Math.max(nm * 1.5 + 0.25, 0.35).toFixed(3), px8: +Math.max(np * 1.5 + 0.1, 1.0).toFixed(3) };
    const same = r.mean <= r.limit.mean && r.px8 <= r.limit.px8;
    if (!opt.expect.includes(r.tier) || r.tier === refTier) {
      r.verdict = same ? 'unchanged' : 'CHANGED';
    } else if (same) r.verdict = 'unchanged';
    else if (r.refBefore == null) r.verdict = 'changed (no reference)';
    else {
      const slack = Math.abs((r.refNoise ?? r.refBefore) - r.refBefore) + nl * 1.5 + 0.1;
      r.verdict = r.refAfter <= r.refBefore - 0.05 ? 'closer to reference' : r.refAfter <= r.refBefore + slack ? 'changed, as close' : 'FURTHER from reference';
    }
    if (/CHANGED|FURTHER/.test(r.verdict)) pass = false;
  }
  const fmt = (x) => (x == null ? '   —  ' : x.toFixed(2).padStart(6));
  console.log(`\n${label} vs ${against}${opt.noise ? ` (noise: ${opt.noise})` : ''}; mean, px8 % and lum8 in /255 and %; ref = ${refTier} lum8 distance before → after`);
  for (const r of rows) {
    if (r.missing) { console.log(`${r.tier.padEnd(7)}${r.view.padEnd(18)} missing`); continue; }
    console.log(`${r.tier.padEnd(7)}${r.view.padEnd(18)}mean${fmt(r.mean)} px8${fmt(r.px8)} lum8${fmt(r.lum8)}  noise${fmt(r.noise?.mean)}${fmt(r.noise?.px8)}`
      + `${r.refBefore != null ? `  ref ${r.refBefore.toFixed(2)} → ${r.refAfter.toFixed(2)}` : ''}  ${r.verdict}`);
  }
  console.log(pass ? '\nPASS' : '\nFAIL');
  const out = join(dirOf(label), `compare-${against}.json`);
  writeFileSync(out, JSON.stringify({ label, against, noise: opt.noise, expect: opt.expect, ref: refTier, pass, rows }, null, 1));
  // contact sheet: per view one row per tier — before | after | |difference| × 4
  for (const r of rows) {
    if (r.missing) continue;
    for (const [k, l] of [['a', against], ['b', label]]) {
      await page.evaluate(([key, b64]) => globalThis.__thumb(key, b64), [`${r.tier}/${r.view}/${k}`, readFileSync(pngOf(l, r.tier, r.view)).toString('base64')]);
    }
  }
  const sheet = await page.evaluate((list) => globalThis.__sheet(list), rows.filter((r) => !r.missing).map((r) => ({ key: `${r.tier}/${r.view}`, text: `${r.tier} ${r.view}: ${r.verdict} (mean ${r.mean.toFixed(2)}, lum8 ${r.lum8.toFixed(2)})` })));
  if (sheet) {
    const f = join(dirOf(label), `compare-${against}.jpg`);
    writeFileSync(f, Buffer.from(sheet, 'base64'));
    console.log(`sheet: ${f}`);
  }
  // summary sheet (--expect): per view, each expected tier before | after, then the reference tier
  if (opt.expect.length) {
    const cols = [];
    for (const t of opt.expect) if (t !== refTier) cols.push([`${t} before`, against, t], [`${t} after`, label, t]);
    cols.push([`${refTier} (reference)`, existsSync(pngOf(label, refTier, opt.views[0])) ? label : against, refTier]);
    const cells = [];
    for (const view of opt.views) {
      for (const [title, l, t] of cols) {
        const f = pngOf(l, t, view);
        if (!existsSync(f)) continue;
        const key = `S/${view}/${title}`;
        await page.evaluate(([k, b64]) => globalThis.__thumb(k, b64), [key, readFileSync(f).toString('base64')]);
        cells.push({ key, title, view });
      }
    }
    const jpg = await page.evaluate(([cells, ncol]) => globalThis.__grid(cells, ncol), [cells, cols.length]);
    if (jpg) {
      const f = join(dirOf(label), `summary-${against}.jpg`);
      writeFileSync(f, Buffer.from(jpg, 'base64'));
      console.log(`summary: ${f}`);
    }
  }
  console.log(`report: ${out}`);
  await page.close();
  return pass;
}

// image maths in the page: decode with createImageBitmap, read back through a 2D canvas
function PAGE_LIB() {
  const imgs = (globalThis.__imgs = {});
  const thumbs = (globalThis.__thumbs = {});
  globalThis.__load = async (key, b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    imgs[key] = { w: bmp.width, h: bmp.height, data: g.getImageData(0, 0, bmp.width, bmp.height).data, bmp };
  };
  const lumSmall = (im) => {
    const W = Math.floor(im.w / 8), H = Math.floor(im.h / 8), out = new Float32Array(W * H), d = im.data;
    for (let y = 0; y < H * 8; y++) for (let x = 0; x < W * 8; x++) {
      const i = (y * im.w + x) * 4;
      out[(y >> 3) * W + (x >> 3)] += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 64;
    }
    return out;
  };
  globalThis.__diff = (ka, kb) => {
    const a = imgs[ka], b = imgs[kb];
    if (!a || !b || a.w !== b.w || a.h !== b.h) return { mean: 255, px8: 100, lum8: 255, size: false };
    const A = a.data, B = b.data;
    let sum = 0, over = 0;
    const n = a.w * a.h;
    for (let i = 0; i < A.length; i += 4) {
      const dr = Math.abs(A[i] - B[i]), dg = Math.abs(A[i + 1] - B[i + 1]), db = Math.abs(A[i + 2] - B[i + 2]);
      sum += dr + dg + db;
      if (Math.max(dr, dg, db) > 8) over++;
    }
    const la = lumSmall(a), lb = lumSmall(b);
    let ls = 0;
    for (let i = 0; i < la.length; i++) ls += Math.abs(la[i] - lb[i]);
    return { mean: sum / (3 * n), px8: (100 * over) / n, lum8: ls / la.length };
  };
  const TW = 320, TH = 180;
  globalThis.__thumb = async (key, b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }), { resizeWidth: TW, resizeHeight: TH, resizeQuality: 'medium' });
    const c = new OffscreenCanvas(TW, TH);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    thumbs[key] = g.getImageData(0, 0, TW, TH);
  };
  globalThis.__grid = async (cells, ncol) => {
    const LH = 16, rows = Math.ceil(cells.length / ncol);
    const c = new OffscreenCanvas(TW * ncol, (TH + LH) * rows);
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    g.font = '12px sans-serif'; g.fillStyle = '#e8dcc0';
    cells.forEach((it, i) => {
      const x = (i % ncol) * TW, y = Math.floor(i / ncol) * (TH + LH);
      g.fillText(`${it.view} — ${it.title}`, x + 4, y + 12);
      if (thumbs[it.key]) g.putImageData(thumbs[it.key], x, y + LH);
    });
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  globalThis.__sheet = async (list) => {
    const LH = 18;
    const c = new OffscreenCanvas(TW * 3, (TH + LH) * list.length);
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    g.font = '13px sans-serif';
    list.forEach((it, i) => {
      const a = thumbs[`${it.key}/a`], b = thumbs[`${it.key}/b`];
      if (!a || !b) return;
      const y = i * (TH + LH);
      g.fillStyle = /CHANGED|FURTHER/.test(it.text) ? '#ff8080' : '#e8dcc0';
      g.fillText(`${it.text}   [before | after | difference x4]`, 4, y + 13);
      g.putImageData(a, 0, y + LH);
      g.putImageData(b, TW, y + LH);
      const d = new ImageData(TW, TH);
      for (let k = 0; k < d.data.length; k += 4) {
        for (let j = 0; j < 3; j++) d.data[k + j] = Math.min(255, 4 * Math.abs(a.data[k + j] - b.data[k + j]));
        d.data[k + 3] = 255;
      }
      g.putImageData(d, 2 * TW, y + LH);
    });
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
}
