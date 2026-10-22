// Device tiering: GPU-string classification refined by a quick fragment-ALU micro-benchmark.
// The benchmark runs in a separate tiny WebGL2 context (so three's GL state cache is untouched), takes
// ~10–60 ms once, and is cached per GPU string in localStorage.
//
//   import { detectTier, detectDevice } from '../render/detect.js';
//   detectTier(renderer) -> 'low' | 'medium' | 'high' | 'ultra'
//   detectDevice(renderer) -> { tier, gpu, mobile, stringTier, benchTier, score, reason }
const ORDER = ['low', 'medium', 'high', 'ultra'];
const CACHE_KEY = 'mikdash.gpuBench.v1';
// Score unit: giga shader-loop iterations per second. Measured: Intel HD 4600 = 5.9 (68 ms incl. context +
// compile, first run only). Bounds ≈ 2.5x / 8x / 30x that iGPU, i.e. roughly Iris Xe & Apple M1 -> medium,
// GTX 1060-class -> high, RTX 3060-class and up -> ultra (by FP32 throughput ratios).
const BENCH_BOUNDS = [15, 48, 180];

export function gpuString(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch { return ''; }
}

export function isMobile() {
  const nav = globalThis.navigator || {};
  if (nav.userAgentData?.mobile) return true;
  const ua = nav.userAgent || '';
  // iPadOS reports as Mac; touch points disambiguate
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1);
}

/**
 * perf-fix-1: a tile-based (deferred) GPU — phones, tablets, Apple silicon (Safari reports every Mac as "Apple GPU"),
 * Mali / PowerVR / Adreno — removes hidden fragments in hardware, so a depth pre-pass only adds draws and vertices there.
 */
export function tiledGpu(renderer) {
  return isMobile() || /apple|mali|immortalis|powervr|img |adreno|xclipse/i.test(gpuString(renderer));
}

/** Tier from the GPU string alone, or null when unknown. */
export function classifyGpu(gpu, mobile) {
  const g = gpu.toLowerCase();
  if (!g) return null;
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(g)) return 'low';
  if (mobile) {
    if (/apple gpu|apple a1[7-9]|apple m\d/.test(g)) return 'medium';
    if (/adreno \(tm\) (7[3-9]\d|8\d\d)|adreno (7[3-9]\d|8\d\d)|immortalis|mali-g7[1-9]\d|mali-g9\d\d|xclipse/.test(g)) return 'medium';
    return 'low';
  }
  // NVIDIA
  let m = g.match(/rtx\s*(?:a)?(\d{4})/);
  if (m) {
    const n = +m[1];
    const series = Math.floor(n / 1000), cls = n % 100;
    if (cls >= 80 || (cls >= 70 && series >= 4)) return 'ultra';
    if (cls >= 60) return 'high';
    return 'high';
  }
  if (/titan|rtx a[4-6]000|quadro rtx [5-8]000/.test(g)) return 'ultra';
  m = g.match(/gtx\s*(\d{3,4})/);
  if (m) {
    const n = +m[1];
    if (n >= 1070) return 'high';
    if (n >= 960) return 'medium';
    return 'low';
  }
  if (/geforce (mx|gt )|nvidia.*(mx\d{3}|gt \d{3})/.test(g)) return 'low';
  // AMD
  m = g.match(/rx\s*(\d{3,4})/);
  if (m) {
    const n = +m[1];
    if (n >= 6800 && n < 7000) return 'ultra';
    if (n >= 7800 || (n >= 9060 && n < 9999)) return 'ultra';
    if (n >= 5600) return 'high';
    if (n >= 470) return 'medium';
    return 'low';
  }
  if (/radeon pro|vega (56|64)|radeon vii/.test(g)) return 'high';
  if (/radeon.*(780m|880m|890m)/.test(g)) return 'medium';
  if (/radeon\(tm\)( graphics)?|vega \d\b|radeon graphics/.test(g)) return 'medium';
  // Apple silicon (desktop)
  if (/apple m\d (max|ultra)/.test(g)) return 'ultra';
  if (/apple m[2-9]|apple m1 (pro|max)/.test(g)) return 'high';
  if (/apple m1|apple gpu/.test(g)) return 'medium';
  // Intel
  if (/arc.*\b(a7\d0|b5\d0|b580|a770|a750)/.test(g)) return 'high';
  if (/arc/.test(g)) return 'medium';
  if (/iris\(r\) xe|iris xe|iris\(r\) plus|iris plus|iris pro/.test(g)) return 'medium';
  if (/intel.*(hd|uhd) graphics|intel\(r\) (hd|uhd)/.test(g)) return 'low';
  if (/intel/.test(g)) return 'low';
  return null;
}

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform float uSeed; uniform int uIter;
out vec4 o;
void main(){
  vec2 q = gl_FragCoord.xy * 0.001 + uSeed;
  float a = q.x, b = q.y;
  for (int i = 0; i < 256; i++) {
    if (i >= uIter) break;
    a = fract(sin(a * 1.31 + b) * 43.7 + b * 0.73);
    b = fract(cos(b * 1.17 - a) * 37.3 + a * 0.61);
  }
  o = vec4(a, b, a * b, 1.0);
}`;

/** Giga loop-iterations per second, or 0 if WebGL2 is unavailable. */
export function microBenchmark() {
  if (typeof document === 'undefined') return 0;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance', antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) return 0;
  const lose = () => { try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ignore */ } };
  try {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { lose(); return 0; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const SIZE = 256;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, SIZE, SIZE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, SIZE, SIZE);
    const uSeed = gl.getUniformLocation(prog, 'uSeed');
    const uIter = gl.getUniformLocation(prog, 'uIter');
    const px = new Uint8Array(4);
    const run = (draws, iter) => {
      gl.uniform1i(uIter, iter);
      const t0 = performance.now();
      for (let i = 0; i < draws; i++) { gl.uniform1f(uSeed, Math.random()); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // sync
      return performance.now() - t0;
    };
    run(2, 16); // warm-up: compile, clocks
    let draws = 4;
    const iter = 128;
    let best = Infinity;
    let work = 0;
    for (let round = 0; round < 4; round++) {
      const ms = run(draws, iter);
      if (ms < 6 && draws < 256) { draws *= 4; continue; } // too short to time reliably
      work = SIZE * SIZE * draws * iter;
      best = Math.min(best, ms);
      if (round >= 2) break;
    }
    lose();
    if (!Number.isFinite(best) || !work) return 0;
    return work / (best * 1e6); // giga-iterations / s
  } catch {
    lose();
    return 0;
  }
}

function cachedScore(gpu) {
  try {
    const c = JSON.parse(globalThis.localStorage?.getItem(CACHE_KEY) || 'null');
    if (c && c.gpu === gpu && c.score > 0) return c.score;
  } catch { /* storage unavailable */ }
  return 0;
}

function storeScore(gpu, score) {
  try { globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify({ gpu, score, at: Date.now() })); } catch { /* ignore */ }
}

export function detectDevice(renderer, { bench = true } = {}) {
  const gpu = gpuString(renderer);
  const mobile = isMobile();
  const stringTier = classifyGpu(gpu, mobile);
  let score = 0;
  const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
  if (bench && !software) {
    score = cachedScore(gpu);
    if (!score) { score = microBenchmark(); if (score > 0) storeScore(gpu, score); }
  }
  let benchTier = null;
  if (score > 0) {
    let i = 0;
    while (i < BENCH_BOUNDS.length && score >= BENCH_BOUNDS[i]) i++;
    benchTier = ORDER[i];
  }
  let tier;
  let reason;
  if (software) {
    tier = 'low'; reason = 'software renderer';
  } else if (stringTier && benchTier) {
    // trust the benchmark within one tier of the GPU string (strings miss laptop variants, clocks, drivers)
    const s = ORDER.indexOf(stringTier), b = ORDER.indexOf(benchTier);
    tier = ORDER[Math.max(s - 1, Math.min(s + 1, b))];
    reason = `gpu=${stringTier}, bench=${benchTier}`;
  } else {
    tier = stringTier || benchTier || 'medium';
    reason = stringTier ? `gpu=${stringTier}` : benchTier ? `bench=${benchTier}` : 'unknown GPU';
  }
  if (mobile && ORDER.indexOf(tier) > 1) { tier = 'medium'; reason += ', mobile cap'; }
  // perf-fix-1: a first visit compiles every shader on the CPU (ANGLE translates and FXC compiles on the browser's worker
  // threads; a strong GPU does not speed it up): ≈ 28 s for medium and ≈ 42 s for high on a 4-thread CPU (HD 4600 box),
  // ultra more. Few threads → a lower default (Settings still offers every tier; later visits hit the GPU program cache)
  const threads = globalThis.navigator?.hardwareConcurrency || 0;
  const cpuMax = !threads ? 3 : threads <= 4 ? 1 : threads < 8 ? 2 : 3;
  if (ORDER.indexOf(tier) > cpuMax) { tier = ORDER[cpuMax]; reason += `, cpu cap (${threads} threads)`; }
  return { tier, gpu, mobile, stringTier, benchTier, score: Math.round(score * 10) / 10, reason };
}

export function detectTier(renderer) {
  return detectDevice(renderer).tier;
}
