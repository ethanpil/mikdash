// perf-cpu round 2c: per view, materials holding more than one program (warmup-check's test, with the people batches'
// depth / distance materials and the pre-pass's) and getProgram calls per drawn frame (material customProgramCacheKey,
// which three calls inside getProgram). Shot mode, e.g. on high:
//   node src/sim/dev/run.mjs --q high --timeout 6000 --script tools/perf-cpu-twoprog.js "at=238,385&look=215,4&t=d3"
const r = ctx.renderer;
const VIEWS = [['Azarah d3', 'd3'], ['Azarah n3', 'n3']];
const N = 3;
const out = {};
for (const [name, t] of VIEWS) {
  ctx.time.set(ctx.time.parse(t));
  ctx.player.teleport({ at: [238, 385], heading: 215 }); ctx.player.setLook(215, 4);
  await frames(6);
  const keyed = {}, restore = [];
  let on = false;
  const wrap = (m) => {
    if (!m || m.__k) return;
    const own = Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey'), f = m.customProgramCacheKey;
    m.__k = true;
    m.customProgramCacheKey = function () { if (on) keyed[m.name || m.type] = (keyed[m.name || m.type] || 0) + 1; return f.call(this); };
    restore.push(() => { delete m.__k; if (own) m.customProgramCacheKey = f; else delete m.customProgramCacheKey; });
  };
  ctx.scene.traverse((o) => { for (const m of [].concat(o.material || [])) wrap(m); wrap(o.customDepthMaterial); wrap(o.customDistanceMaterial); });
  ctx.fx?.scene?.traverse?.((o) => { for (const m of [].concat(o.material || [])) wrap(m); });
  wrap(ctx.post?.pipeline?.prepass?.material);
  on = true; await frames(N); on = false;
  for (const f of restore) f();
  const two = [];
  const chk = (m, where) => {
    const p = m && r.properties.get(m)?.programs;
    if (!p || p.size < 2) return;
    const keys = [...p.keys()].map((k) => k.split(','));
    const diff = keys[0].map((v, i) => [i, keys.map((k) => k[i])]).filter(([, vs]) => new Set(vs).size > 1).map(([i, vs]) => `${i}:${vs.join('|')}`);
    two.push(`${where}:${m.name || m.type} ×${p.size} [${diff.join(' ')}]`);
  };
  ctx.scene.traverse((o) => { for (const m of [].concat(o.material || [])) chk(m, 'mat'); chk(o.customDepthMaterial, 'depth'); chk(o.customDistanceMaterial, 'distance'); });
  ctx.fx?.scene?.traverse?.((o) => { for (const m of [].concat(o.material || [])) chk(m, 'fx'); });
  chk(ctx.post?.pipeline?.prepass?.material, 'prepass');
  out[name] = { getProgramPerFrame: +(Object.values(keyed).reduce((a, b) => a + b, 0) / N).toFixed(2), keyed, twoPrograms: [...new Set(two)].sort(), programs: r.info.programs.length, calls: r.info.render.calls };
  log(name, JSON.stringify(out[name]).slice(0, 400));
}
return out;
