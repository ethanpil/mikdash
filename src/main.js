// Boot: engine -> context -> world -> subsystems -> loop.
import { Engine } from './core/engine.js';
import { readParams } from './core/params.js';
import { resolveTier } from './core/quality.js';
import { createContext } from './core/context.js';
import { buildWorld } from './world/index.js';
import { SYSTEMS } from './systems.js';
import { installShaderLogFilter } from './render/log-filter.js';
import {
  compileScene, compilePasses, whenReady, rendersOffscreen, singleInstance, parallelCompile, seenMeshes, unseenMaterials, warmDeferred,
  hideDeferred, showDeferred, inSight, seenAround, compileDepth, backgroundPolicy, backgroundState,
} from './render/warmup.js';
import { reloadHere } from './core/resume.js';
import { startPrebake } from './people/prebake.js';
import { markPrepass } from './render/prepass.js';

const params = readParams();
// give up waiting for parallel shader compilation after this long (a driver that never reports completion)
const WARMUP_TIMEOUT = 180000;
// gate-core: what was deferred past the first view starts compiling this long after it (play; see the first frame below)
const SETTLE_MS = 2000;
// gate-core-r2: no background program is issued for this long after the visitor leaves the intro (the first turn and
// steps of play, and the frames that start the walk, have the GPU's compiler threads to themselves)
const ENTER_QUIET_MS = 2500;

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
  if (contextLost) return; // (the boot goes on a little after a loss: the notice stays)
  const el = document.getElementById('boot-progress');
  if (el) el.style.width = `${Math.round(frac * 100)}%`;
  const tx = document.getElementById('boot-label');
  if (tx && label) tx.textContent = label;
}

/**
 * qa-r1 CORE-3: the boot failed — say what to do in plain words, offer a retry, and fold the engine's text into a
 * detail (it is what a bug report needs, not what a visitor can act on). `graphics`: no WebGL 2 context.
 */
function showBootError(e, graphics, reason = '') {
  console.error('[boot] fatal', e);
  if (contextLost) return; // the graphics-reset notice is up and the page reloads

  globalThis.__mikdashReady = true;
  globalThis.__mikdashError = String(e?.stack || e);
  const host = document.getElementById('boot-label')?.parentElement;
  if (!host) return;
  const tag = (name, text, cls) => {
    const el = document.createElement(name);
    if (text) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const box = tag('div', '', 'boot-msg');
  box.setAttribute('role', 'alert');
  if (graphics) {
    box.append(tag('p', 'Mikdash needs WebGL 2, and this browser could not start it.', 'lead'),
      tag('p', 'Turn on hardware (graphics) acceleration in the browser’s settings, update the browser or the graphics '
        + 'drivers, or open the page in a current Chrome, Edge, Firefox or Safari.', 'hint'));
  } else {
    box.append(tag('p', 'Mikdash could not start.', 'lead'),
      tag('p', 'Try again. If it keeps failing, update the browser or the graphics drivers.', 'hint'));
  }
  const retry = tag('button', 'Retry');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  const details = tag('details');
  details.append(tag('summary', 'Technical details'),
    tag('pre', [e?.message || String(e), reason && `Reason: ${reason}`, `Browser: ${navigator.userAgent}`].filter(Boolean).join('\n')));
  box.append(retry, details);
  host.append(box);
  document.body.classList.add('boot-failed');
  retry.focus();
}

// gate-core: a lost WebGL context. Mobile browsers drop it under memory pressure or with the tab in the background, and
// a GPU-process crash does the same on desktop. three rebuilds its own state on 'webglcontextrestored', but env's uniform
// block buffer, the GPU-baked material textures and every program of this page belonged to the old context: the view
// stayed black for good under a live HUD. Rebuilding all of it in place is a second boot; a reload where the visitor
// stood is the same and certain. So the loop stops, a short notice covers the view, and the page reloads at the same
// place and time (core/resume.js) when the context comes back, or after RESTORE_WAIT. A second loss within a minute of
// such a reload does not reload by itself (a device that cannot keep the context would loop): it offers a button.
const RESET_KEY = 'mikdash.gfxReset';
const RESTORE_WAIT = 4000;
let contextLost = false;

function showGraphicsReset(again, reload) {
  document.body.classList.add('gfx-reset');
  const label = document.getElementById('boot-label');
  if (label) {
    label.textContent = again ? '' : 'Graphics were reset — reloading…';
    label.setAttribute('role', 'status');
  }
  if (!again || !label?.parentElement) return;
  const box = document.createElement('div');
  box.className = 'boot-msg';
  box.setAttribute('role', 'alert');
  const p = (text, cls) => { const e = document.createElement('p'); e.textContent = text; e.className = cls; return e; };
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Reload';
  b.addEventListener('click', reload);
  box.append(p('The graphics were reset again.', 'lead'), p('The device may be short of graphics memory. Close other tabs or apps, then reload.', 'hint'), b);
  label.parentElement.append(box);
  b.focus();
}

function watchContext(engine) {
  let timer = 0;
  const reload = () => {
    clearTimeout(timer);
    timer = 0;
    try { sessionStorage.setItem(RESET_KEY, String(Date.now())); } catch { /* no loop guard then */ }
    reloadHere(globalThis.__mikdash || null);
  };
  engine.canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault(); // without it the browser never restores the context
    if (contextLost) return;
    contextLost = true;
    engine.lost = true;
    engine.stop();
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ignore */ }
    let last = 0;
    try { last = +sessionStorage.getItem(RESET_KEY) || 0; } catch { /* ignore */ }
    const again = Date.now() - last < 60000;
    console.warn(`[boot] WebGL context lost${again ? ' again' : ''}; ${again ? 'offering a reload' : 'reloading at the same place and time'}`);
    showGraphicsReset(again, reload);
    if (!again) timer = setTimeout(reload, RESTORE_WAIT);
  });
  engine.canvas.addEventListener('webglcontextrestored', () => { if (timer) reload(); });
}

async function boot() {
  installShaderLogFilter(); // benign ANGLE/D3D X4122 warnings, before any shader compiles
  const canvas = document.getElementById('scene');
  // qa-r1 CORE-3: the renderer's own context is the WebGL 2 check (three throws when it cannot get one), made before
  // anything else starts — no chunk preloads, no bake worker on a browser that cannot run the page
  let reason = '';
  canvas.addEventListener('webglcontextcreationerror', (ev) => { reason = ev.statusMessage || reason; });
  let engine;
  try { engine = new Engine(canvas, params); } catch (e) { showBootError(e, true, reason.trim()); return; }
  watchContext(engine);
  // perf-1: the systems' chunks load (no evaluation) and the people's animation clips bake in a Worker while this
  // thread builds the world
  preloadBootChunks();
  startPrebake();
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
  // gate-core: what the first view does not draw waits until after it. People hold their programs but the far figures'
  // and the props' LOD1 (people/system.js held) unless a figure in the view draws or asks for one; the world materials the
  // boot camera cannot see are hidden and compiled after the first view (render/warmup.js). `?defer=0` turns both off.
  const deferOn = parallelCompile(engine.renderer) && params.raw.get('defer') !== '0';
  const heldPeople = (m) => !!ctx.people?.system?.held?.(m);
  let deferred = new Map();
  let around = new Set(); // what turning on the spot shows: revealed first (render/warmup.js seenAround)
  const skip = (m) => heldPeople(m) || deferred.has(m);
  const findUnseen = () => {
    const exclude = [ctx.people?.root];
    const seen = seenMeshes(engine.renderer, ctx.scene, ctx.camera, { exclude });
    return [seen, unseenMaterials(ctx.scene, seen, { exclude })];
  };
  for (const [name, load] of SYSTEMS) {
    setLoading(`Preparing ${name}…`, 0.7 + (i++ / SYSTEMS.length) * 0.15);
    // (before people issue their programs: the pass links its own small ones at once only while none is queued)
    if (name === 'people' && deferOn) {
      try {
        deferred = findUnseen()[1];
        if (deferred.size) around = seenAround(engine.renderer, ctx.scene, ctx.camera, { exclude: [ctx.people?.root] });
        hideDeferred(engine.renderer, deferred.keys());
      } catch (e) { console.warn('[boot] visibility pass failed', e); deferred = new Map(); }
      mark('unseen');
    }
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
    if (name === 'people') warm = [compileScene(engine.renderer, ctx.scene, ctx.camera, null, rendersOffscreen(ctx), skip)];
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
  const ppl = ctx.people?.system;
  if (ppl?.wanted) ppl.wanted.length = 0; // (that update was the sim's warm frame: every pooled figure stood before the camera)
  const off = rendersOffscreen(ctx);
  warm = [...(warm || []), compileScene(engine.renderer, ctx.scene, ctx.camera, null, off, skip)];
  if (ctx.fx?.scene) warm.push(compileScene(engine.renderer, ctx.fx.scene, ctx.camera, null, off));
  if (ctx.people?.root) warm.push(compileDepth(engine.renderer, ctx.people.root, ctx.camera, ctx.scene));
  const pre = ctx.post?.pipeline?.prepass;
  // (the pre-pass draws one layer, which holds no lights: three keys programs by light counts)
  if (pre?.enabled) warm.push(compileScene(engine.renderer, pre.warmupObjects(), ctx.camera, null, off));
  const passes = ctx.post?.pipeline?.post?.warmupMaterials?.();
  if (passes?.length) warm.push(compilePasses(engine.renderer, passes, ctx.camera));
  try { if (ctx.env?.warmupMaterials) warm.push(ctx.env.warmupMaterials()); } catch (e) { console.warn('[boot] env warm-up failed', e); }
  // perf-fix-1: 'warmup:tail' once most of the first view's programs are linked: the compiler threads free up and this
  // thread idles (gate-core: people no longer issue their other variants then — they were the held detail programs)
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
      const more = [compileScene(engine.renderer, ctx.scene, ctx.camera, null, off, skip)];
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
  // gate-core: a held people program is needed after all where a figure that asked for it is in sight (people cull by the
  // frustum only: the animals penned behind the courts' walls, the limbs on the altar asked for theirs from the dawn start)
  const released = [];
  if (ppl?.holdDetail && ppl.wanted.length) {
    const keys = new Set();
    for (const [k, x, y, z] of ppl.wanted) if (!keys.has(k) && inSight(ctx, x, y, z)) keys.add(k);
    if (keys.size) {
      ppl.release(keys);
      released.push(...keys);
      warm.push(compileScene(engine.renderer, ppl.root, ctx.camera, ctx.scene, off, heldPeople));
    }
  }
  await linked(warm);
  // gate-core: the view as posed now (the discovery frames re-posed everything, e.g. a gate the sim opened; the systems
  // made meshes since the first pass): a deferred material that shows after all is compiled now. Checked once the view's
  // programs are linked: while they compile the GPU process drains this pass's commands only between them (3 s on low)
  const late = [];
  if (deferred.size) {
    try {
      for (const m of deferred.keys()) m.visible = true;
      for (const objs of deferred.values()) objs.length = 0;
      ctx.scene.traverse((o) => { for (const m of [].concat(o.material || [])) if (o.isMesh && deferred.has(m)) deferred.get(m).push(o); });
      const [seen] = findUnseen();
      for (const [m, objs] of deferred) {
        if (!objs.some((o) => seen.has(o))) { m.visible = false; continue; }
        showDeferred(m);
        deferred.delete(m);
        late.push(m.name || m.type);
        for (const o of objs) warm.push(compileScene(engine.renderer, o, ctx.camera, ctx.scene, off));
      }
    } catch (e) {
      console.warn('[boot] visibility re-check failed', e);
      for (const m of deferred.keys()) showDeferred(m);
      deferred.clear();
      warm.push(compileScene(engine.renderer, ctx.scene, ctx.camera, null, off, skip));
    }
    if (late.length) await linked(warm);
  }
  ctx.bootDeferred = { world: [...deferred.keys()].map((m) => m.name || m.type), late, people: !!ppl?.holdDetail, released: released.length }; // (profiling)
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
  // gate-core: the deferred world materials, each shown once linked (render/warmup.js compileLater), queued ahead of the
  // people's variants, which 'warmup:issued' starts (people/index.js). In play, SETTLE_MS after the first frame: the
  // first frames' own late programs (the probes' first capture and metering, medium+) then compile with no queue ahead
  // (a 224 ms link took 2.3–3.2 s behind two deferred ones on the HD 4600)
  // gate-core-r2: how many programs may be left linking while the background queue issues the next (render/warmup.js
  // compileLater counts every unlinked program of the renderer). ANGLE links on (logical cores − 1) worker threads, three
  // on the dev machine's 4-thread i5; a program issued while all are busy freezes every frame until one frees. So cores − 2
  // (2 there, at most 3): a program a frame needs at once still finds a thread. None for ENTER_QUIET_MS after Enter.
  // (One in play instead of two was measured: worst frames alike on the HD 4600, the hidden world shown 20 s later on
  // high: docs/decisions/gate-core-r2.md.) A screenshot waits for all of it and has no visitor: no limit (the workers
  // link in issue order, so the deferred world, queued first, is shown first).
  if (params.shot) backgroundPolicy.limit = () => Infinity;
  else {
    const limit = Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 4) - 2));
    const introOpen = () => !!document.querySelector('.mk-intro-open');
    let quietUntil = 0;
    // (the intro's close is watched from the first view on: the queue may first pump after it)
    if (introOpen()) {
      const watch = setInterval(() => {
        if (introOpen()) return;
        quietUntil = performance.now() + ENTER_QUIET_MS;
        clearInterval(watch);
      }, 100);
    }
    backgroundPolicy.limit = () => (performance.now() < quietUntil ? 0 : limit);
  }
  const later = new Promise((resolve) => setTimeout(() => {
    resolve(deferred.size ? warmDeferred(ctx, deferred, around) : 0);
    ctx.bus.emit('warmup:issued', ctx);
  }, params.shot ? 0 : SETTLE_MS));
  later.then(() => {
    mark('shown');
    // (profiling, tools/warmup-check.mjs) bootTimes.drained: since then the background queue has been empty and every
    // program linked (3 s without a new entry: the baker paces its kinds by idle slices)
    let since = 0;
    const drained = () => {
      const st = backgroundState(engine.renderer);
      const now = Math.round(performance.now());
      if (st.queued || st.pending) since = 0;
      else if (!since) since = now;
      if (since && now - since >= 3000) bootTimes.drained = since; else setTimeout(drained, 250);
    };
    setTimeout(drained, 250);
  });

  if (params.shot) {
    // a screenshot shows the finished frame: whatever was deferred is linked and drawn first
    await later;
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

boot().catch((e) => showBootError(e, false));
