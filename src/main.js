// Boot: engine -> context -> world -> subsystems -> loop.
import { Engine } from './core/engine.js';
import { readParams } from './core/params.js';
import { resolveTier } from './core/quality.js';
import { createContext } from './core/context.js';
import { buildWorld } from './world/index.js';
import { SYSTEMS } from './systems.js';
import { installShaderLogFilter } from './render/log-filter.js';

const params = readParams();

// Boot timeline (ms since navigation start) — exposed as ctx.bootTimes for profiling (tools/shot.mjs prints it).
const T0 = performance.now();
const bootTimes = { start: Math.round(T0) };
const mark = (k) => { bootTimes[k] = Math.round(performance.now()); };

function setLoading(label, frac) {
  const el = document.getElementById('boot-progress');
  if (el) el.style.width = `${Math.round(frac * 100)}%`;
  const tx = document.getElementById('boot-label');
  if (tx && label) tx.textContent = label;
}

async function boot() {
  installShaderLogFilter(); // benign ANGLE/D3D X4122 warnings, before any shader compiles
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

  await buildWorld(ctx, (name, f) => setLoading(`Building ${name}…`, f * 0.7));
  mark('world');
  let i = 0;
  for (const [name, load] of SYSTEMS) {
    setLoading(`Preparing ${name}…`, 0.7 + (i++ / SYSTEMS.length) * 0.3);
    try {
      const mod = await load();
      await mod.init(ctx);
    } catch (e) {
      console.error(`[boot] system "${name}" failed`, e);
    }
    mark(`sys:${name}`);
  }
  setLoading('Ready', 1);
  ctx.bus.emit('ready', ctx);
  engine.start(ctx);
  mark('ready');
  {
    // first rendered frame (shader compilation for the first view happens here)
    const f0 = engine.frame;
    const firstFrame = () => (engine.frame > f0 ? mark('firstFrame') : requestAnimationFrame(firstFrame));
    requestAnimationFrame(firstFrame);
  }
  document.body.classList.add('booted');

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
