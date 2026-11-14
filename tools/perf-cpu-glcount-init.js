// perf-cpu round 2 (run.mjs --init): counts every WebGL2 call by method while globalThis.__glc.on is true — for per-frame
// comparisons of what a frame submits (draws, framebuffer binds, program switches, uniform uploads) between two builds.
(() => {
  const P = globalThis.WebGL2RenderingContext?.prototype;
  if (!P) return;
  const C = { on: false, n: {} };
  globalThis.__glc = C;
  for (const k of Object.getOwnPropertyNames(P)) {
    const d = Object.getOwnPropertyDescriptor(P, k);
    if (!d || typeof d.value !== 'function' || k === 'constructor') continue;
    const f = d.value;
    P[k] = function (...a) { if (C.on) C.n[k] = (C.n[k] || 0) + 1; return f.apply(this, a); };
  }
})();
