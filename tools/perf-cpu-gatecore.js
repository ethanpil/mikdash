// perf-cpu round 2b: gate-core's deferral in normal play with the world's batches split into cells (world/sectors.js).
// Run in play mode (the UI and intro up, no shot):
//   node src/sim/dev/run.mjs --q low --keep-ui --timeout 3000 --script tools/perf-cpu-gatecore.js ""
// Reads, a few seconds after the deferred world was revealed ('shown') and again once everything queued has linked
// ('drained'): the world meshes left hidden, the world materials still hidden, ctx.bootDeferred, and the renderer's
// programs (name + cache-key hash) — to compare two builds.
const c = ctx;
const h = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
const until = async (f, ms) => { const t0 = performance.now(); while (!f() && performance.now() - t0 < ms) await sleep(500); return f(); };
await until(() => c.bootTimes.shown > 0, 600000);
await until(() => performance.now() > c.bootTimes.shown + 4000, 60000);
const read = () => {
  const hiddenMeshes = [], hiddenMats = new Set(), mats = new Set();
  c.world.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.visible) hiddenMeshes.push(o.name || o.type);
    for (const m of [].concat(o.material || [])) { mats.add(m); if (!m.visible) hiddenMats.add(m.name || m.type); }
  });
  return {
    t: Math.round(performance.now() - c.bootTimes.firstFrame), worldMeshes: (() => { let n = 0; c.world.traverse((o) => { if (o.isMesh) n++; }); return n; })(),
    hiddenMeshes: hiddenMeshes.length, hiddenMeshNames: [...new Set(hiddenMeshes)].sort(), hiddenMaterials: [...hiddenMats].sort(), worldMaterials: mats.size,
    bootDeferred: { world: [...(c.bootDeferred?.world || [])].sort(), late: [...(c.bootDeferred?.late || [])].sort(), released: c.bootDeferred?.released },
    programs: c.renderer.info.programs.length, programList: c.renderer.info.programs.map((p) => `${p.name} ${h(p.cacheKey)}`).sort(),
  };
};
const atShown = read();
await until(() => c.bootTimes.drained > 0, 400000);
const atDrained = read();
return { bootTimes: c.bootTimes, sectorStats: c.sectorStats || null, atShown, atDrained };
