#!/usr/bin/env node
// Boot profiler: where does the time to the first rendered view go?
//
//   node tools/boot-prof.mjs [--prod] [--q low] [--frames 60] [--out shots/prof] [--name n] [--json f] "<query>"
//
// Instruments the page's WebGL2 context before any script runs: every GL call is timed; calls that block the main
// thread (sync calls into the GPU process: link status, uniform locations, read-backs …) are attributed to the
// program they concern (or the program in use for draws). After the first `--frames` frames it prints:
//   * bootTimes (ms marks from main.js), long tasks, the first frames' durations
//   * GL time per method (total / count / max)
//   * per program: blocking ms, material(s) using it, fragment source size, three's cache key head
// Each run is a fresh browser profile (cold GPU program cache), like shot.mjs.
import { build as viteBuild, preview as vitePreview, createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { noinst: false, fps: 0, cpu: null, nomin: false, q: 'low', frames: 60, prod: false, out: 'shots/prof', name: null, json: null, timeout: 400, top: 40, w: 1280, h: 720 };
let query = '';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--q') opt.q = args[++i];
  else if (a === '--frames') opt.frames = +args[++i];
  else if (a === '--prod') opt.prod = true;
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--name') opt.name = args[++i];
  else if (a === '--json') opt.json = args[++i];
  else if (a === '--top') opt.top = +args[++i];
  else if (a === '--timeout') opt.timeout = +args[++i];
  else if (a === '--cpu') opt.cpu = args[++i];
  else if (a === '--nomin') opt.nomin = true;
  else if (a === '--fps') opt.fps = +args[++i];
  else if (a === '--noinst') opt.noinst = true;
  else query = a.replace(/^\?/, '');
}

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));

// ------------------------------------------------------------------ in-page instrumentation
function instrument() {
  const P = WebGL2RenderingContext.prototype;
  const S = { methods: {}, programs: [], blocks: [], frames: [], longtasks: [] };
  globalThis.__prof = S;
  const now = () => performance.now();
  let current = null;
  const shaderSrc = new WeakMap();
  const progInfo = (p) => {
    if (!p.__prof) { p.__prof = { id: S.programs.length, ms: 0, link: 0, draws: 0, drawMs: 0, firstDrawMs: 0, maxCall: 0, shaders: [] }; S.programs.push(p.__prof); }
    return p.__prof;
  };
  const DRAW = new Set(['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']);
  for (const name of Object.getOwnPropertyNames(P)) {
    const d = Object.getOwnPropertyDescriptor(P, name);
    if (!d || typeof d.value !== 'function' || name === 'constructor') continue;
    const f = d.value;
    const m = (S.methods[name] = { n: 0, ms: 0, max: 0 });
    P[name] = function (...a) {
      const t = now();
      const r = f.apply(this, a);
      const dt = now() - t;
      m.n++; m.ms += dt; if (dt > m.max) m.max = dt;
      if (name === 'shaderSource') shaderSrc.set(a[0], a[1]);
      else if (name === 'attachShader') progInfo(a[0]).shaders.push(shaderSrc.get(a[1]) || '');
      else if (name === 'useProgram') current = a[0];
      if (a[0] instanceof WebGLProgram) {
        const pi = progInfo(a[0]);
        pi.ms += dt; if (dt > pi.maxCall) pi.maxCall = dt;
        if (name === 'getProgramParameter' && a[1] === 0x8B82) pi.link += dt;
        if (name === 'linkProgram') pi.linkAt = Math.round(t);
        if (name === 'getProgramParameter' && a[1] === 0x91B1 && r === true && !pi.doneAt) pi.doneAt = Math.round(t + dt);
        if (name === 'getProgramInfoLog' && !pi.doneAt) pi.doneAt = Math.round(t + dt);
      } else if (DRAW.has(name) && current) {
        const pi = progInfo(current);
        pi.draws++; pi.drawMs += dt;
        if (pi.draws === 1) pi.firstDrawMs = dt;
      }
      if (dt > 50) S.blocks.push({ name, at: Math.round(t), ms: Math.round(dt), prog: a[0] instanceof WebGLProgram ? a[0].__prof.id : (DRAW.has(name) && current ? current.__prof?.id : null) });
      return r;
    };
  }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) S.longtasks.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); })
      .observe({ type: 'longtask', buffered: true });
  } catch { /* unsupported */ }
  let last = 0;
  const raf = (t) => { if (last) S.frames.push({ at: Math.round(t), ms: Math.round(t - last) }); last = t; if (S.frames.length < 20000) requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

// ------------------------------------------------------------------ server + browser
let server, prodDir = null;
if (opt.prod) {
  prodDir = join(tmpdir(), `mikdash-prof-${process.pid}`);
  await viteBuild({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), build: { outDir: prodDir, emptyOutDir: true, minify: !opt.nomin } });
  server = await vitePreview({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), build: { outDir: prodDir }, preview: { port: 0, host: '127.0.0.1', strictPort: false } });
} else {
  server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null } });
  await server.listen();
}
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: EDGE, headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
mkdirSync(resolve(root, opt.out), { recursive: true });
const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h } });
if (!opt.noinst) await page.addInitScript(instrument);
let cdp = null;
if (opt.cpu) {
  cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
}
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) || m.text().startsWith('[pcx')) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const qs = new URLSearchParams(query);
if (!qs.has('shot')) qs.set('shot', '1');
if (!qs.has('q')) qs.set('q', opt.q);
await page.goto(`${base}?${qs}`, { waitUntil: 'load', timeout: opt.timeout * 1000 });
await page.waitForFunction((n) => globalThis.__mikdash?.bootTimes?.firstFrame && globalThis.__mikdash.engine.frame > n, opt.frames, { timeout: opt.timeout * 1000, polling: 250 });
let fpsRes = null;
if (opt.fps) {
  // steady state: let background work after the first view settle, then sample frame intervals
  await page.waitForTimeout(8000);
  fpsRes = await page.evaluate((secs) => new Promise((done) => {
    const d = []; let last = 0; const t0 = performance.now();
    const c = globalThis.__mikdash;
    const tick = (t) => { if (last) d.push(t - last); last = t; if (t - t0 < secs * 1000) requestAnimationFrame(tick); else {
      d.sort((a, b) => a - b);
      const mean = d.reduce((x, y) => x + y, 0) / d.length;
      done({ n: d.length, meanMs: +mean.toFixed(1), medianMs: +d[d.length >> 1].toFixed(1), p95Ms: +d[Math.floor(d.length * 0.95)].toFixed(1), fps: +(1000 / mean).toFixed(1), calls: c.renderer.info.render.calls, tris: c.renderer.info.render.triangles, scale: c.post?.scale });
    } };
    requestAnimationFrame(tick);
  }), opt.fps);
}
const res = await page.evaluate(() => {
  const c = globalThis.__mikdash, r = c.renderer, S = globalThis.__prof || { programs: [], methods: {}, blocks: [], frames: [], longtasks: [] };
  // map programs to materials in the scene (and fx scene)
  const users = new Map();
  const visit = (o) => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      const p = r.properties.get(m)?.currentProgram?.program;
      if (!p?.__prof) continue;
      const k = p.__prof.id;
      const s = users.get(k) || new Map();
      const key = `${m.name || m.type}${o.isInstancedMesh ? '[inst]' : ''}${o.isSkinnedMesh ? '[skin]' : ''}`;
      s.set(key, (s.get(key) || 0) + 1);
      users.set(k, s);
    }
  };
  c.scene.traverse(visit);
  c.fx?.scene?.traverse?.(visit);
  const infos = new Map((r.info.programs || []).map((p) => [p.program.__prof?.id, p]));
  const programs = S.programs.map((p) => {
    const fs = p.shaders[1] || '';
    const name = (fs.match(/#define SHADER_NAME (.*)/) || [])[1] || '';
    const info = infos.get(p.id);
    return {
      id: p.id, linkAt: p.linkAt, doneAt: p.doneAt, ms: Math.round(p.ms), link: Math.round(p.link), firstDrawMs: Math.round(p.firstDrawMs), maxCall: Math.round(p.maxCall),
      draws: p.draws, name, fsLen: fs.length, vsLen: (p.shaders[0] || '').length, live: !!info, usedTimes: info?.usedTimes,
      key: info ? info.cacheKey : '', users: users.has(p.id) ? [...users.get(p.id)].map(([k, n]) => `${k}×${n}`).slice(0, 6).join(', ') : '',
    };
  });
  const methods = Object.entries(S.methods).filter(([, m]) => m.ms > 20).sort((a, b) => b[1].ms - a[1].ms)
    .map(([k, m]) => ({ k, ms: Math.round(m.ms), n: m.n, max: Math.round(m.max) }));
  return {
    tier: c.quality.key, bootTimes: c.bootTimes, buildTimes: c.buildTimes, programs, methods,
    blocks: S.blocks, longtasks: S.longtasks, frames: S.frames,
    calls: r.info.render.calls, triangles: r.info.render.triangles, fps: Math.round(c.engine.fps),
    resources: performance.getEntriesByType('resource').map((e) => ({ n: e.name.split('/').pop().replace(/-[\w-]{8}\.js$/, '.js'), s: Math.round(e.startTime), d: Math.round(e.duration) })),
  };
});
await page.screenshot({ path: resolve(root, opt.out, `${opt.name || 'prof'}.png`) });
if (cdp) {
  const { profile } = await cdp.send('Profiler.stop');
  writeFileSync(resolve(root, opt.cpu), JSON.stringify(profile));
  // self time by function (top 30) and by script
  const self = new Map(), byUrl = new Map();
  const dt = new Map();
  for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
  for (const n of profile.nodes) {
    const us = dt.get(n.id) || 0;
    if (!us) continue;
    const f = n.callFrame;
    const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
    self.set(k, (self.get(k) || 0) + us);
    const u = f.url.split('/').pop() || f.functionName;
    byUrl.set(u, (byUrl.get(u) || 0) + us);
  }
  console.log('\nCPU self time by function (ms):');
  for (const [k, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`  ${(us / 1000).toFixed(0).padStart(6)}  ${k}`);
  console.log('CPU self time by script (ms):');
  for (const [k, us] of [...byUrl].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${(us / 1000).toFixed(0).padStart(6)}  ${k}`);
}
await browser.close();
await (server.close?.() ?? server.httpServer?.close?.());
if (prodDir) { try { rmSync(prodDir, { recursive: true, force: true }); } catch { /* ignore */ } }

// ------------------------------------------------------------------ report
const b = res.bootTimes;
console.log(`tier ${res.tier}  query "${query}"  calls ${res.calls}  tris ${res.triangles}  programs ${res.programs.length}`);
console.log('bootTimes', JSON.stringify(b));
if (fpsRes) console.log('steady', JSON.stringify(fpsRes));
console.log('buildTimes', JSON.stringify(res.buildTimes));
const progMs = res.programs.reduce((s, p) => s + p.ms + p.firstDrawMs, 0);
console.log(`program-attributed blocking: ${Math.round(progMs)} ms over ${res.programs.length} programs`);
console.log('\nGL methods (ms total / calls / max):');
for (const m of res.methods.slice(0, 18)) console.log(`  ${m.k.padEnd(28)} ${String(m.ms).padStart(7)} ${String(m.n).padStart(8)} ${String(m.max).padStart(6)}`);
console.log(`\nprograms by blocking ms (top ${opt.top}):  id  ms  link  1stDraw  fsLen  name  | users | key`);
for (const p of [...res.programs].sort((a, b2) => (b2.ms + b2.firstDrawMs) - (a.ms + a.firstDrawMs)).slice(0, opt.top)) {
  console.log(`  #${String(p.id).padStart(3)} ${String(p.ms).padStart(6)} ${String(p.link).padStart(6)} ${String(p.firstDrawMs).padStart(5)} ${String(p.fsLen).padStart(6)}  ${p.name.padEnd(22)} | ${p.users} | ${p.key.slice(0, 70)}`);
}
{
  // lit programs (the expensive ones): when issued and when linked
  const lit = res.programs.filter((p) => p.fsLen > 60000).sort((a, b) => (a.linkAt || 0) - (b.linkAt || 0));
  console.log(`
lit programs issued → linked (s): ${lit.map((p) => `${p.name.slice(0, 14)}@${((p.linkAt || 0) / 1000).toFixed(1)}→${((p.doneAt || 0) / 1000).toFixed(1)}`).join('  ')}`);
}
const lt = res.longtasks.filter((t) => t.ms > 200);
console.log(`\nlong tasks > 200 ms: ${lt.map((t) => `${t.at}+${t.ms}`).join('  ')}`);
const rs = res.resources.filter((r) => /\.js|\.css/.test(r.n));
console.log(`
scripts (${rs.length}): ${rs.map((r) => `${r.n}@${r.s}+${r.d}`).join('  ')}`);
{
  // frames from the first drawn one on: hitches after the view is shown (draw-time shader variants, late compiles)
  const ff = res.bootTimes.firstFrame || 0;
  const after = res.frames.filter((f) => f.at >= ff - 40).slice(0, 80);
  console.log(`frames from firstFrame (ms): ${after.map((f) => f.ms).join(' ')}`);
  console.log(`  max ${Math.max(0, ...after.map((f) => f.ms))}  over 50 ms: ${after.filter((f) => f.ms > 50).length}`);
}
if (logs.length) console.log(`console (${logs.length}):\n  ${logs.slice(0, 20).join('\n  ')}`);
if (opt.json) writeFileSync(resolve(root, opt.json), JSON.stringify({ ...res, steady: fpsRes }, null, 1));
process.exit(0);
