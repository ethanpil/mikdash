#!/usr/bin/env node
// Main-thread CPU profiler for steady play (perf-cpu): JavaScript milliseconds per frame by system, by file and by
// function, garbage per frame, and what the frame draws — measured, not frame rates (GPU time is not JS time).
//
//   node tools/cpu-prof.mjs [--q low] [--scenes scenes.json] [--only a-,b-] [--secs 20] [--dsecs 30] [--settle 15]
//                           [--interval 200] [--noheap] [--exp lights29] [--out shots/perf-cpu/run] [--prod] [--nomin]
//                           [--timeout 1500] "<boot query>"
//
// One browser, one boot (normal play: the UI and intro up, Enter pressed, then everything the boot defers is waited for
// — bootTimes.drained), then each scene is applied through the app's own API (date, clock, speed, teleport, look; no
// reboot); the day's plan job is waited for (drawing off meanwhile), then `settle` s, then two windows:
//   * update (`secs`, drawing off: engine.drawing = false) — the updaters at the frame rate a GPU that keeps up gives, so
//     the sim's LOD cadences (15 Hz / 4 Hz) are a real machine's: the engine's updaters wrapped by priority (time sim
//     zones people player env world fx audio ui), the CDP sampling CPU profiler (`--interval` µs: self ms/frame by
//     function and file, the GC's own ms/frame, inclusive ms/frame), the CDP sampling heap profiler keeping the objects
//     minor and major GCs collected (bytes allocated per frame, by function and file);
//   * draw (`dsecs`, drawing on) — the render JS (SwiftShader draws a frame in seconds: few frames, read it for the
//     render side only);
//   * then 6 drawn frames with renderBufferDirect wrapped: calls / triangles by pass (main / pre-pass / shadow) and by what
//     is drawn (world builder, people archetype × LOD, props, fx), and the materials three re-keyed (getProgram) per frame.
// --exp lights29: after the scenes, the pre-pass light-state experiment (docs/decisions/perf-cpu.md), off / on / off / on.
// Scenes file: [{ "name", "date"?, "t", "at": [X, Y] | "anchor", "look": [heading, pitch], "speed"?, "walk"?: true (W held),
// "secs"?, "dsecs"?, "settle"? }]. Without --scenes the perf-cpu set below is used.
// Writes <out>/<scene>.json (+ .update/.draw .cpuprofile and .heapprofile) and prints a summary; tools/cpu-prof-table.mjs
// makes tables of them. Dev server by default (readable names, one URL per source file: the attribution); `--prod`
// measures the production bundle (add --nomin for names).
import { build as viteBuild, preview as vitePreview, createServer } from 'vite';
import { chromium } from 'playwright-core';
import { launchBrowser, GPU_ARGS } from './browser.mjs';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { q: 'low', scenes: null, secs: 20, dsecs: 30, settle: 15, interval: 200, out: 'shots/perf-cpu/run', prod: false, nomin: false, timeout: 1500, w: 1280, h: 720, only: null, heap: true };
let bootQuery = '';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--q') opt.q = args[++i];
  else if (a === '--scenes') opt.scenes = args[++i];
  else if (a === '--secs') opt.secs = +args[++i];
  else if (a === '--dsecs') opt.dsecs = +args[++i];
  else if (a === '--settle') opt.settle = +args[++i];
  else if (a === '--interval') opt.interval = +args[++i];
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--prod') opt.prod = true;
  else if (a === '--nomin') opt.nomin = true;
  else if (a === '--timeout') opt.timeout = +args[++i];
  else if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--only') opt.only = args[++i].split(',');
  else if (a === '--noheap') opt.heap = false;
  else if (a === '--exp') opt.exp = args[++i];
  else bootQuery = a.replace(/^\?/, '');
}

const AZ = [238, 385];
const DEFAULT_SCENES = [
  { name: 'a-start', date: '2026-11-02', t: 'alot-6', at: 'start', look: null, speed: 1 },
  { name: 'b-azarah-d3', date: '2026-11-02', t: 'd3', at: AZ, look: [215, 4], speed: 1 },
  { name: 'b60-azarah-d3-x60', date: '2026-11-02', t: 'd3', at: AZ, look: [215, 4], speed: 60 },
  { name: 'c-roshchodesh-musaf', date: '2026-11-11', t: 'sunrise+140', at: AZ, look: [215, 4], speed: 1 },
  { name: 'd-azarah-n3', date: '2026-11-02', t: 'n3', at: AZ, look: [215, 4], speed: 1 },
  { name: 'e-walk-azarah', date: '2026-11-02', t: 'd3', at: AZ, look: [215, 0], speed: 1, walk: true },
];
let scenes = opt.scenes ? JSON.parse(readFileSync(opt.scenes, 'utf8')) : DEFAULT_SCENES;
if (opt.only) scenes = scenes.filter((s) => opt.only.some((o) => s.name.startsWith(o)));

// ------------------------------------------------------------------ in-page instrumentation (installed after the boot)
function install() {
  if (globalThis.__cp) { globalThis.__cp.wrap(); return; }
  const c = globalThis.__mikdash, eng = c.engine, r = c.renderer;
  const NAMES = { 0: 'time', 10: 'sim', 20: 'people', 30: 'player', 40: 'env', 50: 'fx', 60: 'audio', 70: 'ui', 100: 'render-update' };
  const S = { acc: {}, frames: 0, t0: 0, tick: 0, calls: [], tris: [], intervals: [], last: 0 };
  const now = () => performance.now();
  const wrap = () => {
    for (const u of eng.updaters) {
      if (u.__cp) continue;
      const f = u.fn, k = NAMES[u.priority] ?? `p${u.priority}`;
      u.fn = (dt, cx) => { const t = now(); try { return f(dt, cx); } finally { S.acc[k] = (S.acc[k] || 0) + now() - t; } };
      u.__cp = true;
    }
    if (!eng.renderFn.__cp) {
      const rf = eng.renderFn;
      const w = (dt) => {
        const t = now();
        try { return rf(dt); } finally {
          S.acc.draw = (S.acc.draw || 0) + now() - t;
          S.calls.push(r.info.render.calls); S.tris.push(r.info.render.triangles);
        }
      };
      w.__cp = true;
      eng.renderFn = w;
    }
    if (!eng.__cpTick) {
      const tick = eng.tick.bind(eng);
      eng.tick = (ts) => {
        const t = now();
        try { return tick(ts); } finally {
          S.tick += now() - t; S.frames++;
          if (S.last) S.intervals.push(t - S.last);
          S.last = t;
        }
      };
      eng.__cpTick = true;
    }
  };
  wrap();
  const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  // one frame's draws by pass and by what is drawn (renderBufferDirect wrapped for `n` frames)
  const groupOf = (o) => {
    let p = o, top = null, actor = null;
    while (p) {
      if (p === c.people?.root) {
        const nm = o.name || '';
        if (nm.startsWith('people:prop:')) return `people/prop:L${nm.split(':').pop()}`;
        const m = /^people:([^:]+):(\w+)$/.exec(nm);
        if (m) return `people/${m[2] === 'shadow' ? 'proxy' : 'L' + m[2]}:${m[1]}`;
        return `people/${nm || 'other'}`;
      }
      if (p === c.fx?.scene) return 'fx';
      if (p.parent === c.scene && !top) top = p;
      if (p.parent && p.parent.parent === c.scene && p.parent.name === 'world') top = p;
      if (p.name?.startsWith?.('actor:')) actor = p;
      p = p.parent;
    }
    if (o.parent == null && o !== c.scene) return 'parentless';
    return `world/${top?.name || top?.type || o.name || o.type}`;
  };
  const breakdown = (n = 8) => new Promise((done) => {
    const P = r.renderBufferDirect;
    const frames = [];
    let cur = null;
    r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      const c0 = r.info.render.calls, t0 = r.info.render.triangles;
      const res = P.apply(this, arguments);
      if (cur) {
        const pass = material?.isMeshDepthMaterial || material?.isMeshDistanceMaterial || /depth|distance/i.test(material?.name || '')
          ? (camera === c.camera ? 'prepass' : 'shadow') : camera === c.camera ? 'main' : (camera?.isOrthographicCamera ? 'shadow/ortho' : 'other');
        const k = `${pass}|${groupOf(object)}`;
        const e = cur[k] || (cur[k] = [0, 0]);
        e[0] += r.info.render.calls - c0; e[1] += r.info.render.triangles - t0;
      }
      return res;
    };
    // three calls material.customProgramCacheKey() inside getProgram (WebGLPrograms.getProgramCacheKey): count those
    // calls per material — a material re-keyed every frame costs getParameters + a cache-key string each time
    const keyed = {}, restore = [];
    const wrapKey = (o) => {
      for (const m of [].concat(o.material || [])) {
        if (m.__cpKey) continue;
        const own = Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey'), f = m.customProgramCacheKey;
        m.__cpKey = true;
        m.customProgramCacheKey = function () { if (cur) { const kk = `${m.name || m.type}#${m.id}`; keyed[kk] = (keyed[kk] || 0) + 1; } return f.call(this); };
        restore.push(() => { delete m.__cpKey; if (own) m.customProgramCacheKey = f; else delete m.customProgramCacheKey; });
      }
    };
    c.scene.traverse(wrapKey);
    c.fx?.scene?.traverse?.(wrapKey);
    const rf = eng.renderFn;
    let k = 0;
    const seenV = new Map(), churn = {};
    const scanChurn = () => {
      const visit = (o) => {
        for (const m of [].concat(o.material || [])) {
          const pr = r.properties.get(m);
          const v = `${m.version}|${pr.lightsStateVersion}|${pr.__version}`;
          const was = seenV.get(m);
          if (was !== undefined && was !== v) { const key = `${m.name || m.type}${was.split('|')[0] !== v.split('|')[0] ? ' (version)' : ' (lights)'}`; churn[key] = (churn[key] || 0) + 1; }
          seenV.set(m, v);
        }
      };
      c.scene.traverse(visit);
      c.fx?.scene?.traverse?.(visit);
    };
    eng.renderFn = (dt) => {
      cur = {};
      try { return rf(dt); } finally {
        frames.push(cur); cur = null;
        scanChurn();
        if (++k >= n) {
          eng.renderFn = rf; r.renderBufferDirect = P;
          // median per key over the frames
          const keys = new Set(frames.flatMap((f) => Object.keys(f)));
          const out = {};
          for (const key of keys) out[key] = [med(frames.map((f) => f[key]?.[0] || 0)), med(frames.map((f) => f[key]?.[1] || 0))];
          out['churn (materials re-keyed per frame over n-1 frames)'] = churn;
          for (const f of restore) f();
          out['keyed (getProgram calls per material over n frames)'] = keyed;
          done(out);
        }
      }
    };
  });
  globalThis.__cp = {
    wrap,
    reset() { S.acc = {}; S.frames = 0; S.tick = 0; S.calls = []; S.tris = []; S.intervals = []; S.last = 0; S.t0 = now(); },
    read() {
      const f = Math.max(1, S.frames), wall = now() - S.t0;
      const per = {};
      for (const k in S.acc) per[k] = +(S.acc[k] / f).toFixed(3);
      const ps = c.people?.system?.stats;
      return {
        frames: S.frames, wallMs: Math.round(wall), wallMsPerFrame: +(wall / f).toFixed(1), tickMsPerFrame: +(S.tick / f).toFixed(3),
        perSystem: per, callsMed: med(S.calls), trisMed: med(S.tris), callsMax: Math.max(0, ...S.calls), trisMax: Math.max(0, ...S.tris),
        programs: r.info.programs?.length, geometries: r.info.memory.geometries, textures: r.info.memory.textures,
        people: ps ? JSON.parse(JSON.stringify(ps)) : null, actors: c.people?.system?.actors?.size, crowds: c.people?.system?.crowds?.size,
        t: c.time?.t, speed: c.time?.speed, zone: c.zones?.current, intervalMed: +med(S.intervals).toFixed(1),
        scale: c.post?.scale, plansDone: !!c.schedule?.runtime?.plans?.done, simFigures: c.schedule?.runtime?.stats?.figures,
        actorsVisible: [...(c.people?.system?.actors || [])].filter((a) => a.visible).length,
      };
    },
    breakdown,
  };
}

async function applyScene(page, s) {
  return page.evaluate((s) => {
    const c = globalThis.__mikdash;
    if (s.date && c.time.dateString !== s.date) c.time.setDate(s.date);
    if (s.t != null) c.time.set(c.time.parse(String(s.t)));
    c.time.setSpeed(s.speed ?? 1);
    c.time.pause(false);
    if (s.at) {
      const target = typeof s.at === 'string' ? s.at : { at: s.at, ...(s.look ? { heading: s.look[0] } : {}) };
      c.player.teleport(target);
    }
    if (s.look) c.player.setLook(s.look[0], s.look[1]);
    return { t: c.time.t, date: c.time.dateString, zone: c.zones?.current };
  }, s);
}

// ------------------------------------------------------------------ profile aggregation
const fileOf = (url) => {
  if (!url) return '';
  const u = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
  if (/node_modules\/\.vite\/deps\/three/.test(u) || /\/three\.module|three\.core/.test(u)) return 'three';
  if (/node_modules\/\.vite\/deps\/(postprocessing|n8ao)/.test(u)) return u.split('/').pop().replace(/\.js$/, '').split('_')[0];
  if (/node_modules\/\.vite\/deps\//.test(u)) return 'dep:' + u.split('/').pop();
  if (/@vite|vite\/dist/.test(u)) return 'vite-client';
  return u.replace(/^\/src\//, '');
};
const areaOf = (file, fn) => {
  if (!file) return fn.startsWith('(') ? fn : '(native)';
  if (file === 'three') return 'three';
  const m = /^(\w+)\//.exec(file);
  if (m) return m[1] === 'world' && /^world\/materials/.test(file) ? 'world/materials' : m[1];
  return file;
};

function aggregateCpu(profile, frames) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const ch of n.children || []) parent.set(ch, n.id);
  const keyOf = (n) => { const f = n.callFrame; const file = fileOf(f.url); return `${f.functionName || '(anon)'} ${file}:${f.lineNumber + 1}`; };
  const self = new Map(), total = new Map(), byFile = new Map(), byArea = new Map();
  let sum = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    const us = profile.timeDeltas[i + 1] ?? profile.timeDeltas[i] ?? 0; // a sample's time is the gap to the next
    const n = byId.get(id);
    if (!n) continue;
    sum += us;
    const f = n.callFrame, file = fileOf(f.url), k = keyOf(n);
    self.set(k, (self.get(k) || 0) + us);
    byFile.set(file || f.functionName, (byFile.get(file || f.functionName) || 0) + us);
    const ar = areaOf(file, f.functionName || '');
    byArea.set(ar, (byArea.get(ar) || 0) + us);
    const seen = new Set();
    for (let p = id; p != null; p = parent.get(p)) {
      const kk = keyOf(byId.get(p));
      if (seen.has(kk)) continue;
      seen.add(kk);
      total.set(kk, (total.get(kk) || 0) + us);
    }
  }
  const pf = (us) => +(us / 1000 / frames).toFixed(3);
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => [k, pf(us)]);
  const busy = sum - (self.get('(idle) :0') || 0) - (self.get('(program) :0') || 0);
  return {
    sampledMsPerFrame: pf(sum), busyMsPerFrame: pf(busy), gcMsPerFrame: pf(self.get('(garbage collector) :0') || 0),
    idleMsPerFrame: pf(self.get('(idle) :0') || 0), programMsPerFrame: pf(self.get('(program) :0') || 0),
    byArea: top(byArea, 40), byFile: top(byFile, 40), selfTop: top(self, 40),
    totalTop: top(new Map([...total].filter(([k]) => !/^\((root|program|idle)\)/.test(k))), 60),
  };
}

function aggregateHeap(profile, frames) {
  const byFn = new Map(), byFile = new Map(), byArea = new Map();
  let sum = 0;
  const walk = (n) => {
    if (n.selfSize) {
      const f = n.callFrame, file = fileOf(f.url);
      const k = `${f.functionName || '(anon)'} ${file}:${f.lineNumber + 1}`;
      byFn.set(k, (byFn.get(k) || 0) + n.selfSize);
      byFile.set(file || f.functionName, (byFile.get(file || f.functionName) || 0) + n.selfSize);
      const ar = areaOf(file, f.functionName || '');
      byArea.set(ar, (byArea.get(ar) || 0) + n.selfSize);
      sum += n.selfSize;
    }
    for (const ch of n.children || []) walk(ch);
  };
  walk(profile.head);
  const kb = (b) => +(b / 1024 / frames).toFixed(2);
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, b]) => [k, kb(b)]);
  return { kbPerFrame: kb(sum), byArea: top(byArea, 20), byFile: top(byFile, 25), byFn: top(byFn, 30) };
}

// ------------------------------------------------------------------ run
let server, prodDir = null;
if (opt.prod) {
  prodDir = join(tmpdir(), `mikdash-cpuprof-${process.pid}`);
  await viteBuild({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), build: { outDir: prodDir, emptyOutDir: true, minify: !opt.nomin } });
  server = await vitePreview({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), build: { outDir: prodDir }, preview: { port: 0, host: '127.0.0.1', strictPort: false } });
} else {
  server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null } });
  await server.listen();
}
const base = server.resolvedUrls.local[0];
const { browser } = await launchBrowser(chromium, {
  headless: true, args: [...GPU_ARGS, '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'],
});
const outDir = resolve(root, opt.out);
mkdirSync(outDir, { recursive: true });
const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h } });
page.setDefaultTimeout(opt.timeout * 1000);
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const qs = new URLSearchParams(bootQuery);
if (!qs.has('q')) qs.set('q', opt.q);
const T0 = Date.now();
const stamp = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;
await page.goto(`${base}?${qs}`, { waitUntil: 'load', timeout: opt.timeout * 1000 });
await page.waitForFunction(() => globalThis.__mikdash?.bootTimes?.firstFrame > 0, null, { timeout: opt.timeout * 1000, polling: 500 });
await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 300000, polling: 200 }).catch(() => {});
await page.evaluate(() => globalThis.__mikdash.ui?.enter?.());
console.log(`[${stamp()}] first frame; Enter; waiting for the boot's background work to drain`);
await page.waitForFunction(() => { const bt = globalThis.__mikdash.bootTimes; return bt.drained > 0 || performance.now() > bt.firstFrame + 600000; }, null, { timeout: opt.timeout * 1000, polling: 1000 });
const boot = await page.evaluate(() => ({ bootTimes: globalThis.__mikdash.bootTimes, tier: globalThis.__mikdash.quality.key, hc: navigator.hardwareConcurrency }));
console.log(`[${stamp()}] drained ${JSON.stringify(boot)}`);
await page.evaluate(install);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: opt.interval });
await cdp.send('HeapProfiler.enable');

const results = [];
// one measured window: drawing off (`update`: the updaters at the frame rate a fast GPU gives — the sim's LOD cadences
// (15 Hz / 4 Hz) then run as on a real machine) or on (`draw`: the render JS, at SwiftShader's few frames a second)
async function windowOf(s, mode, secs) {
  await page.evaluate((m) => { globalThis.__mikdash.engine.drawing = m === 'draw'; globalThis.__cp.reset(); }, mode);
  if (opt.heap) await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(secs * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const hp = opt.heap ? (await cdp.send('HeapProfiler.stopSampling')).profile : null;
  const st = await page.evaluate(() => globalThis.__cp.read());
  await page.evaluate(() => { globalThis.__mikdash.engine.drawing = true; });
  writeFileSync(join(outDir, `${s.name}.${mode}.cpuprofile`), JSON.stringify(profile));
  if (hp) writeFileSync(join(outDir, `${s.name}.${mode}.heapprofile`), JSON.stringify(hp));
  return { stats: st, cpu: aggregateCpu(profile, st.frames), heap: hp ? aggregateHeap(hp, st.frames) : null };
}
function printWindow(name, mode, w) {
  const { stats: st, cpu, heap } = w;
  const sys = Object.entries(st.perSystem).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  ');
  console.log(`[${stamp()}] ${name} [${mode}]: frames ${st.frames} wall ${st.wallMsPerFrame} ms/f  tick ${st.tickMsPerFrame} ms/f  | ${sys}`);
  console.log(`  cpu busy ${cpu.busyMsPerFrame} ms/f  gc ${cpu.gcMsPerFrame}  | heap ${heap?.kbPerFrame} KB/f  | calls ${st.callsMed} tris ${st.trisMed} programs ${st.programs}  people ${JSON.stringify(st.people)}`);
  console.log(`  areas: ${cpu.byArea.slice(0, 14).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log('  self top:'); for (const [k, v] of cpu.selfTop.slice(0, 25)) console.log(`    ${v.toFixed(3).padStart(8)}  ${k}`);
  if (heap) { console.log('  alloc top (KB/f):'); for (const [k, v] of heap.byFn.slice(0, 12)) console.log(`    ${v.toFixed(2).padStart(8)}  ${k}`); }
}
for (const s of scenes) {
  const applied = await applyScene(page, s);
  await page.evaluate(install);
  // the day's plan job (sim/lib/planjob.js: from the first frame, and again after a date change) must be done: it is
  // not steady-state work (on this machine it runs for minutes after the boot)
  // (drawing off meanwhile: on SwiftShader a frame takes seconds and the job gets one slice per frame — minutes of wall
  // time for ≈ 1.5 s of CPU)
  await page.evaluate(() => { globalThis.__mikdash.engine.drawing = false; });
  const pj = await page.waitForFunction(() => globalThis.__mikdash.schedule?.runtime?.plans?.done, null, { timeout: 900000, polling: 1000 })
    .then(() => page.evaluate(() => { const st = globalThis.__mikdash.schedule.runtime.plans.stats; return { ms: Math.round(st.ms), slices: st.slices, maxSlice: Math.round(st.maxSlice), wall: Math.round(st.doneAt - st.startedAt) }; }))
    .catch(() => 'not done');
  await page.evaluate(() => { globalThis.__mikdash.engine.drawing = true; });
  console.log(`\n[${stamp()}] scene ${s.name}: ${JSON.stringify(applied)}; plan job ${JSON.stringify(pj)}; settling ${s.settle ?? opt.settle} s`);
  await page.waitForTimeout((s.settle ?? opt.settle) * 1000);
  if (s.walk) { await page.mouse.click(5, opt.h - 5).catch(() => {}); await page.keyboard.down('w'); await page.waitForTimeout(500); }
  const upd = await windowOf(s, 'update', s.secs ?? opt.secs);
  printWindow(s.name, 'update', upd);
  if (s.walk) { await page.keyboard.up('w'); }
  const pos = await page.evaluate(() => { const p = globalThis.__mikdash.player.position; return [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]; });
  if (s.walk) await applyScene(page, s); // the draw window walks the same stretch again
  if (s.walk) { await page.waitForTimeout(3000); await page.keyboard.down('w'); }
  const drw = await windowOf(s, 'draw', s.dsecs ?? opt.dsecs);
  printWindow(s.name, 'draw', drw);
  if (s.walk) await page.keyboard.up('w');
  const draws = await page.evaluate(() => globalThis.__cp.breakdown(6));
  await page.screenshot({ path: join(outDir, `${s.name}.png`) }).catch(() => {});
  const res = { scene: s, applied, pos, update: upd, draw: drw, draws };
  writeFileSync(join(outDir, `${s.name}.json`), JSON.stringify(res, null, 1));
  results.push(res);
}
// --exp lights29: the render-side proposal for the pre-pass's light state (docs/decisions/perf-cpu.md), tried in the page
// without changing any file — every light also on the pre-pass layer, so the pre-pass sees the main pass's light counts and
// three's light-state version stays put; draw windows with it off / on / off / on on the last scene
if (opt.exp === 'lights29') {
  const toggle = (on) => page.evaluate((on) => {
    const c = globalThis.__mikdash;
    c.scene.traverse((o) => { if (o.isLight) { if (on) o.layers.enable(29); else if (!o.userData.__l29) o.layers.disable(29); } });
  }, on);
  await page.evaluate(() => globalThis.__mikdash.scene.traverse((o) => { if (o.isLight && o.layers.isEnabled(29)) o.userData.__l29 = true; }));
  const ex = [];
  for (const on of [false, true, false, true]) {
    await toggle(on);
    await page.waitForTimeout(4000);
    const w = await windowOf({ name: `exp-lights29-${on ? 'on' : 'off'}-${ex.length}` }, 'draw', opt.dsecs);
    const keyed = await page.evaluate(() => globalThis.__cp.breakdown(4)).then((d) => d['keyed (getProgram calls per material over n frames)']);
    const gp = w.cpu.totalTop.find(([k]) => /^getProgram three/.test(k));
    const row = { on, frames: w.stats.frames, drawJs: w.stats.perSystem.draw, busy: w.cpu.busyMsPerFrame, gc: w.cpu.gcMsPerFrame, kbPerFrame: w.heap?.kbPerFrame, getProgramMs: gp ? gp[1] : 0, keyedPer4Frames: Object.values(keyed || {}).reduce((x, y) => x + y, 0) };
    ex.push(row);
    console.log(`[${stamp()}] exp lights29 ${JSON.stringify(row)}`);
    await page.screenshot({ path: join(outDir, `exp-lights29-${on ? 'on' : 'off'}-${ex.length}.png`) }).catch(() => {});
  }
  await toggle(false);
  writeFileSync(join(outDir, 'exp-lights29.json'), JSON.stringify(ex, null, 1));
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ opt, bootQuery, boot, results: results.map((r) => ({ name: r.scene.name, pos: r.pos,
  ...Object.fromEntries(['update', 'draw'].map((m) => [m, { stats: r[m].stats, cpu: { busy: r[m].cpu.busyMsPerFrame, gc: r[m].cpu.gcMsPerFrame, byArea: r[m].cpu.byArea }, heap: r[m].heap && { kbPerFrame: r[m].heap.kbPerFrame, byArea: r[m].heap.byArea } }])) })), logs }, null, 1));
if (logs.length) console.log(`\nconsole (${logs.length}):\n  ${logs.slice(0, 30).join('\n  ')}`);
await browser.close();
await (server.close?.() ?? server.httpServer?.close?.());
if (prodDir) { try { rmSync(prodDir, { recursive: true, force: true }); } catch { /* ignore */ } }
process.exit(0);
