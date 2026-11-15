// perf-cpu round 2: what a frame submits and re-keys, for the pre-pass light-state change (render/prepass.js
// prepassLight). Run with the GL counter:
//   node src/sim/dev/run.mjs --q low --init tools/perf-cpu-glcount-init.js --script tools/perf-cpu-prepass.js "<query>"
// → programs (count, the pre-pass material's own programs and keys' light counts), and per frame over N drawn frames:
// GL calls by method, renderer.info calls / triangles, setRenderTarget calls, getProgram calls (material
// customProgramCacheKey, which three calls inside getProgram) by material.
const r = ctx.renderer, N = +(ctx.params.raw.get('frames') || 4);
await frames(3);
const keyed = {}, restore = [];
let on = false;
const wrapKey = (o) => {
  for (const m of [].concat(o.material || [])) {
    if (m.__k) continue;
    const own = Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey'), f = m.customProgramCacheKey;
    m.__k = true;
    m.customProgramCacheKey = function () { if (on) { const kk = m.name || m.type; keyed[kk] = (keyed[kk] || 0) + 1; } return f.call(this); };
    restore.push(() => { delete m.__k; if (own) m.customProgramCacheKey = f; else delete m.customProgramCacheKey; });
  }
};
ctx.scene.traverse(wrapKey);
ctx.fx?.scene?.traverse?.(wrapKey);
const pre = ctx.post?.pipeline?.prepass;
if (pre?.material) wrapKey({ material: pre.material });
let rts = 0;
const srt = r.setRenderTarget;
r.setRenderTarget = function (...a) { if (on) rts++; return srt.apply(this, a); };
const calls = [], tris = [];
const glc = globalThis.__glc;
glc.n = {};
on = true; glc.on = true;
const rf = ctx.engine.renderFn;
let k = 0;
await new Promise((done) => {
  ctx.engine.renderFn = (dt) => { try { return rf(dt); } finally { calls.push(r.info.render.calls); tris.push(r.info.render.triangles); if (++k >= N) { ctx.engine.renderFn = rf; done(); } } };
});
on = false; glc.on = false;
r.setRenderTarget = srt;
for (const f of restore) f();
const per = (x) => +(x / N).toFixed(2);
const gl = {};
for (const [m, v] of Object.entries(glc.n).sort()) gl[m] = per(v);
const pick = (re) => Object.entries(gl).filter(([m]) => re.test(m)).reduce((s, [, v]) => s + v, 0);
const progKeys = pre?.material ? [...(r.properties.get(pre.material).programs?.values?.() || [])].map((p) => p.cacheKey.split(',').slice(0, 3).join(',') + ' …') : [];
const lights = [];
ctx.scene.traverse((o) => { if (o.isLight) lights.push(`${o.name || o.type} L${o.layers.mask.toString(2)}${o.castShadow ? ' shadow' : ''}${o.visible ? '' : ' hidden'}`); });
// every program: its shader name and a hash of its cache key (to diff two builds' sets)
const h = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
const programList = r.info.programs.map((p) => `${p.name} ${h(p.cacheKey)}`).sort();
return {
  programList,
  tier: ctx.quality.key, programs: r.info.programs.length, prepass: !!pre?.enabled, prepassPrograms: progKeys.length,
  lights, frames: N, calls: calls.join(' '), tris: tris.join(' '), setRenderTarget: per(rts),
  draws: pick(/^draw/), bindFramebuffer: pick(/^bindFramebuffer$/), useProgram: pick(/^useProgram$/), uniforms: pick(/^uniform/), clears: pick(/^clear$/),
  getProgramPerFrame: per(Object.values(keyed).reduce((a, b) => a + b, 0)), keyed,
  gl,
};
