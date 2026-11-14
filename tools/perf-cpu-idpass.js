// perf-cpu round 2b: gate-core's id pass (render/warmup.js seenMeshes / unseenMaterials) run by hand from a few cameras —
// the materials the boot would defer there — and the renderer's programs with their keys' heads, to compare two builds.
// (On a machine without KHR_parallel_shader_compile — SwiftShader — the boot does not defer at all; this runs the same
// functions directly.) Shot mode:
//   node src/sim/dev/run.mjs --q low --timeout 3000 --script tools/perf-cpu-idpass.js ""
const W = await import('/src/render/warmup.js');
const r = ctx.renderer;
const VIEWS = [['dawn start', 'alot-6', 'start', null], ['Azarah d3', 'd3', [238, 385], [215, 4]], ['south Mount', 'd3', [250, 40], [0, 2]]];
const out = {};
for (const [name, t, at, look] of VIEWS) {
  ctx.time.set(ctx.time.parse(t));
  ctx.player.teleport(typeof at === 'string' ? at : { at, heading: look[0] });
  if (look) ctx.player.setLook(look[0], look[1]);
  await frames(3);
  const exclude = [ctx.people?.root];
  const seen = W.seenMeshes(r, ctx.scene, ctx.camera, { exclude });
  const unseen = W.unseenMaterials(ctx.scene, seen, { exclude });
  out[name] = [...unseen.keys()].map((m) => m.name || m.type).sort();
}
const h = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
const users = new Map();
const visit = (o) => { for (const m of [].concat(o.material || [])) { const p = r.properties.get(m)?.programs; if (p) for (const prog of p.values()) { const k = prog.cacheKey; if (!users.has(k)) users.set(k, new Set()); users.get(k).add(`${m.name || m.type}${o.isInstancedMesh ? '[i]' : ''}`); } } };
ctx.scene.traverse(visit); ctx.fx?.scene?.traverse?.(visit);
const programs = r.info.programs.map((p) => `${p.name} ${h(p.cacheKey)} | ${[...(users.get(p.cacheKey) || [])].slice(0, 3).join(',')} | ${p.cacheKey.length > 60 ? p.cacheKey.slice(0, 24) + '…' + p.cacheKey.split(',').slice(-40, -20).join(',') : p.cacheKey}`).sort();
const depthKeys = r.info.programs.filter((p) => /^(depth|distance)/.test(p.cacheKey) || /depth|distance/i.test(p.name)).map((p) => `${p.name} ${h(p.cacheKey)} ${p.cacheKey}`);
// materials holding more than one program (warmup-check's test): the scene's, the people batches' depth / distance
// materials and the pre-pass's
const two = [];
const chk = (m, where) => { const p = m && r.properties.get(m)?.programs; if (p && p.size > 1) two.push(`${where}:${m.name || m.type} ×${p.size}`); };
ctx.scene.traverse((o) => { for (const m of [].concat(o.material || [])) chk(m, 'mat'); chk(o.customDepthMaterial, 'depth'); chk(o.customDistanceMaterial, 'distance'); });
chk(ctx.post?.pipeline?.prepass?.material, 'prepass');
return { unseen: out, programs, depthKeys, twoPrograms: [...new Set(two)].sort() };
