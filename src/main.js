// Boot: engine -> context -> world -> subsystems -> loop.
import { Engine } from './core/engine.js';
import { readParams } from './core/params.js';
import { resolveTier } from './core/quality.js';
import { createContext } from './core/context.js';
import { buildWorld } from './world/index.js';
import { SYSTEMS } from './systems.js';
import { installShaderLogFilter } from './render/log-filter.js';
import { compileScene, compilePasses, whenReady, rendersOffscreen, singleInstance, parallelCompile } from './render/warmup.js';
import { startPrebake } from './people/prebake.js';
import { markPrepass } from './render/prepass.js';

const params = readParams();
// give up waiting for parallel shader compilation after this long (a driver that never reports completion)
const WARMUP_TIMEOUT = 180000;

// Boot timeline (ms since navigation start) — exposed as ctx.bootTimes for profiling (tools/shot.mjs prints it).
const T0 = performance.now();
const bootTimes = { start: Math.round(T0) };
const mark = (k) => { bootTimes[k] = Math.round(performance.now()); };

/** perf-1: modulepreload the chunks the boot will import, and attach their stylesheets (listed at build time by
 * vite.config.js). perf-fix-1: a stylesheet is attached as such, crossorigin like vite's loader, which then finds it and
 * skips its own: a `preload as=style` without crossorigin was never used (credentials mode mismatch, a second fetch and
 * two console warnings), and one used only at UI init (≈ 7 s) warns as unused anyway. The UI's rules are all scoped to
 * #ui-root / .mk-*, so attaching them early changes nothing on screen. */
function preloadBootChunks() {
  const meta = document.querySelector('meta[name="mk-boot-chunks"]');
  for (const f of (meta?.content || '').split(' ').filter(Boolean)) {
    const l = document.createElement('link');
    l.crossOrigin = '';
    l.rel = f.endsWith('.css') ? 'stylesheet' : 'modulepreload';
    l.href = new URL(f, document.baseURI).href;
    document.head.appendChild(l);
  }
}

/**
 * perf-fix-2: bootTimes.firstImage — when the GPU has finished the first drawn frame ('firstFrame' is when this thread
 * submitted it). The first frame's GPU work (each program's first draw, the first shadow and probe passes) took another
 * 0.4–1 s on the HD 4600; profiling only (a fence polled without blocking).
 */
function markFirstImage(renderer) {
  try {
    const gl = renderer.getContext();
    if (!gl.fenceSync) return;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const s = gl.clientWaitSync(sync, 0, 0);
      if (s === gl.WAIT_FAILED) { gl.deleteSync(sync); return; }
      if (s === gl.TIMEOUT_EXPIRED) { setTimeout(poll, 4); return; }
      mark('firstImage');
      gl.deleteSync(sync);
    };
    setTimeout(poll, 0);
  } catch { /* profiling only */ }
}

function setLoading(label, frac) {
  const el = document.getElementById('boot-progress');
  if (el) el.style.width = `${Math.round(frac * 100)}%`;
  const tx = document.getElementById('boot-label');
  if (tx && label) tx.textContent = label;
}

async function boot() {
  installShaderLogFilter(); // benign ANGLE/D3D X4122 warnings, before any shader compiles
  // perf-1: the systems' chunks load (no evaluation) and the people's animation clips bake in a Worker while this
  // thread builds the world
  preloadBootChunks();
  startPrebake();
  const canvas = document.getElementById('scene');
  const engine = new Engine(canvas, params);
  const quality = resolveTier(params.q, engine.renderer);
  engine.configure(quality);
  const ctx = createContext(engine, params, quality);
  ctx.bootTimes = bootTimes;
  ctx.bootMark = mark;
  globalThis.__mikdash = ctx;
  mark('context');
  document.body.classList.toggle('shot', params.shot);
  document.body.classList.toggle('no-ui', !params.ui);

  // perf-1: env's fixed GPU passes compile on the GPU process's threads during the world build; the post pipeline's
  // chunk (medium+) loads meanwhile
  try { (await import('./env/index.js')).prewarm?.(ctx); } catch (e) { console.warn('[boot] env prewarm failed', e); }
  if (quality.post) import('./render/post.js').catch(() => {});
  await buildWorld(ctx, (name, f) => setLoading(`Building ${name}…`, f * 0.7));
  // perf-1: one program per lit material instead of a plain and an instanced one (render/warmup.js)
  singleInstance(ctx.world);
  markPrepass(ctx.world, params.raw.has('prepassMin') ? +params.raw.get('prepassMin') : undefined); // the opaque world's depth first (render/prepass.js)
  mark('world');
  let i = 0;
  let warm = null;
  for (const [name, load] of SYSTEMS) {
    setLoading(`Preparing ${name}…`, 0.7 + (i++ / SYSTEMS.length) * 0.15);
    try {
      const mod = await load();
      await mod.init(ctx);
    } catch (e) {
      console.error(`[boot] system "${name}" failed`, e);
    }
    mark(`sys:${name}`);
    // perf-1: once env (shader chunks, sun / moon) and render (fire lights, shadow setup) are in place every world
    // program is final — issue them all now; the GPU process compiles them on its worker threads while the remaining
    // systems initialise on this one. After people, which issues its (longest) figure programs first: the compiler
    // threads take programs in order, and the long ones started first finish the set soonest
    if (name === 'people') warm = [compileScene(engine.renderer, ctx.scene, ctx.camera, null, rendersOffscreen(ctx))];
  }
  ctx.bus.emit('ready', ctx);
  // the loop runs without drawing until the first view's programs are linked: one update creates what the view needs
  // lazily (people batches, flames), which is then compiled too; the first draw happens behind the loading screen
  engine.drawing = false;
  engine.start(ctx);
  mark('ready');
  // one update (sim, then people) makes what the first view needs lazily (the engine's frame callback was queued first)
  await new Promise((r) => requestAnimationFrame(() => r()));
  // the clock rests while the shaders compile (the main thread's updates would take CPU from the compiler threads; the
  // frame clamp skipped a stalled first frame the same way before)
  engine.stop();
  const off = rendersOffscreen(ctx);
  warm = [...(warm || []), compileScene(engine.renderer, ctx.scene, ctx.camera, null, off)];
  if (ctx.fx?.scene) warm.push(compileScene(engine.renderer, ctx.fx.scene, ctx.camera, null, off));
  const pre = ctx.post?.pipeline?.prepass;
  // (the pre-pass draws one layer, which holds no lights: three keys programs by light counts)
  if (pre?.enabled) warm.push(compileScene(engine.renderer, pre.warmupObjects(), ctx.camera, null, off));
  const passes = ctx.post?.pipeline?.post?.warmupMaterials?.();
  if (passes?.length) warm.push(compilePasses(engine.renderer, passes, ctx.camera));
  try { if (ctx.env?.warmupMaterials) warm.push(ctx.env.warmupMaterials()); } catch (e) { console.warn('[boot] env warm-up failed', e); }
  // perf-fix-1: 'warmup:tail' once most of the first view's programs are linked: the compiler threads free up and this
  // thread idles, so deferrable programs can be issued then (people/index.js) rather than after the first view
  let tail = false;
  // (without KHR_parallel_shader_compile a query links the program there and then: the first frame does it, as before)
  const bindEarly = parallelCompile(engine.renderer);
  let bound = -1;
  const label = (d, n) => {
    setLoading(`Preparing shaders… ${d} / ${n}`, 0.85 + 0.15 * (n ? d / n : 1));
    // perf-fix-2: env's binders query each program as it links, not in the first frame (env bindPrograms)
    if (bindEarly && d !== bound) { bound = d; try { ctx.env?.bindPrograms?.(); } catch (e) { console.warn('[boot] env bind failed', e); } }
    if (!tail && (!n || d / n >= 0.6)) { tail = true; ctx.bus.emit('warmup:tail', ctx); }
  };
  const deadline = performance.now() + WARMUP_TIMEOUT;
  const linked = (sets) => Promise.race([whenReady(engine.renderer, sets, label), new Promise((r) => setTimeout(r, Math.max(0, deadline - performance.now())))]);
  // what the view makes a few updates later (a figure's prop attached, a batch at another LOD) is compiled too, until a
  // few undrawn frames bring nothing new
  const discover = async (rounds) => {
    const found = [];
    for (let round = 0; round < rounds && performance.now() < deadline; round++) {
      const n0 = engine.renderer.info.programs.length;
      engine.start(ctx);
      await new Promise((r) => { let k = 0; const f = () => (++k >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      engine.stop();
      const more = [compileScene(engine.renderer, ctx.scene, ctx.camera, null, off)];
      if (ctx.fx?.scene) more.push(compileScene(engine.renderer, ctx.fx.scene, ctx.camera, null, off));
      if (engine.renderer.info.programs.length === n0) break;
      // people batches found this late draw at a coarser LOD until their program is linked (people/system.js
      // _batchFor): the view need not wait for them — except for a screenshot, which must show the finished frame
      if (!params.shot && ctx.people?.root) {
        const own = new Set();
        ctx.people.root.traverse((o) => { if (o.material) own.add(o.material); });
        for (const set of more) for (const m of [...set]) if (own.has(m)) set.delete(m);
      }
      found.push(...more);
    }
    return found;
  };
  // perf-fix-1: the discovery frames run while the first set links (this thread idles then; after it they held the
  // first view 0.3–0.7 s on low); a screenshot checks again once everything is linked
  warm.push(...await discover(3));
  await linked(warm);
  if (params.shot) for (let round = 0; round < 3; round++) { const more = await discover(1); if (!more.length) break; await linked(more); }
  mark('compiled');
  setLoading('Ready', 1);
  engine.drawing = true;
  engine.start(ctx);
  await new Promise((r) => {
    const f0 = engine.frame;
    const firstFrame = () => (engine.frame > f0 ? r() : requestAnimationFrame(firstFrame));
    requestAnimationFrame(firstFrame);
  });
  mark('firstFrame');
  markFirstImage(engine.renderer);
  document.body.classList.add('booted');
  ctx.bus.emit('firstFrame', ctx);

  if (params.shot) {
    // let shaders compile, textures upload and FX settle, then signal the screenshot tool
    const waitFrames = 30;
    const start = engine.frame;
    const check = () => {
      if (engine.frame - start >= waitFrames) globalThis.__mikdashReady = true;
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }
}

boot().catch((e) => {
  console.error('[boot] fatal', e);
  const tx = document.getElementById('boot-label');
  if (tx) tx.textContent = `Failed to start: ${e.message}`;
  globalThis.__mikdashReady = true;
  globalThis.__mikdashError = String(e?.stack || e);
});
