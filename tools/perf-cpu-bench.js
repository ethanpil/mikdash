// perf-cpu: micro-benchmark of the per-frame CPU work of the sim runtime and the people system, called in tight loops in
// the page (no drawing in between), with the clock advanced by hand as play would advance it. Run with the sim harness:
//   node src/sim/dev/run.mjs --q low --timeout 3000 --script tools/perf-cpu-bench.js "at=238,385&look=215,4&t=d3"
// For each moment: ms per call and KB allocated per call of people.system.update(1/60) and of the sim runtime's update()
// (+ the zone tracker), the scene graph's size by subtree and the cost of one scene.updateMatrixWorld(). Repeat a run
// and compare minima: the machine's load varies.
const rt = ctx.schedule.runtime, sys = ctx.people.system;
const N = 600;
const MOMENTS = [
  ['b 1x', '2026-11-02', 'd3', [238, 385], [215, 4], 1],
  ['b 60x', '2026-11-02', 'd3', [238, 385], [215, 4], 60],
  ['c musaf', '2026-11-11', 'sunrise+140', [238, 385], [215, 4], 1],
  ['d n3', '2026-11-02', 'n3', [238, 385], [215, 4], 1],
  ['a start', '2026-11-02', 'alot-6', 'start', null, 1],
];
const heap = async (fn) => {
  await cdp('HeapProfiler.startSampling', { samplingInterval: 2048, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  fn();
  const r = await cdp('HeapProfiler.stopSampling');
  return r;
};
const out = {};
// the world's triangles drawn (whole merged batches pass three's culling) vs those whose vertices are not all outside one
// frustum plane: what spatially split batches could leave out (an upper bound of the in-view share: no occlusion)
function worldInView() {
  const cam = ctx.camera; cam.updateMatrixWorld();
  const F = new sys.frustum.constructor();
  const M = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
  F.setFromProjectionMatrix(M);
  const P = F.planes.map((p) => [p.normal.x, p.normal.y, p.normal.z, p.constant]);
  const res = {};
  const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const tmp = new Float32Array(9);
  const m = new Float64Array(16);
  for (const top of ctx.world.children) {
    let all = 0, inv = 0, meshes = 0, culledByThree = 0;
    top.traverse((o) => {
      if (!o.isMesh || !o.geometry || !shown(o) || !o.layers.test(cam.layers)) return;
      const mats = [].concat(o.material); if (!mats.some((x) => x.visible)) return;
      const g = o.geometry, pos = g.attributes.position, idx = g.index;
      if (!pos) return;
      const nTri = (idx ? Math.min(idx.count, g.drawRange.count) : Math.min(pos.count, g.drawRange.count)) / 3 | 0;
      const inst = o.isInstancedMesh ? o.count : 1;
      meshes++;
      // three's own test (bounding sphere, whole object)
      if (o.frustumCulled !== false && !o.isInstancedMesh) {
        if (!g.boundingSphere) g.computeBoundingSphere();
        const sp = g.boundingSphere.clone().applyMatrix4(o.matrixWorld);
        if (!F.intersectsSphere(sp)) { culledByThree += nTri * inst; return; }
      }
      const W = o.matrixWorld.elements;
      for (let k = 0; k < inst; k++) {
        if (o.isInstancedMesh) {
          const I = o.instanceMatrix.array, b = k * 16;
          for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { let sum = 0; for (let j = 0; j < 4; j++) sum += W[j * 4 + r] * I[b + c * 4 + j]; m[c * 4 + r] = sum; }
        } else for (let j = 0; j < 16; j++) m[j] = W[j];
        for (let t = 0; t < nTri; t++) {
          for (let v = 0; v < 3; v++) {
            const vi = idx ? idx.getX(t * 3 + v) : t * 3 + v;
            const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
            tmp[v * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; tmp[v * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; tmp[v * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
          }
          let out = false;
          for (const [a, b2, c, d] of P) {
            if (a * tmp[0] + b2 * tmp[1] + c * tmp[2] + d < 0 && a * tmp[3] + b2 * tmp[4] + c * tmp[5] + d < 0 && a * tmp[6] + b2 * tmp[7] + c * tmp[8] + d < 0) { out = true; break; }
          }
          all++; if (!out) inv++;
        }
      }
    });
    res[top.name] = { meshes, drawnTris: all, inFrustum: inv, share: all ? +(inv / all).toFixed(3) : 0, culledByThree };
  }
  return res;
}
const step = (speed) => {
  const d = speed / 60 / 60;           // sim minutes per 1/60 s frame
  const tm = ctx.time;
  tm.t = (tm.t + d) % 1440; tm.frameDelta = d;
};
for (const [name, date, t, at, look, speed] of MOMENTS) {
  if (ctx.time.dateString !== date) { ctx.time.setDate(date); await frames(2); }
  ctx.player.teleport(typeof at === 'string' ? at : { at, heading: look?.[0] });
  if (look) ctx.player.setLook(look[0], look[1]);
  ctx.time.set(ctx.time.parse(t));
  await frames(6);
  const t0 = ctx.time.t;
  // people: N updates of one frame each
  for (let i = 0; i < 60; i++) sys.update(1 / 60);
  let a = performance.now();
  const hp = await heap(() => { for (let i = 0; i < N; i++) sys.update(1 / 60); });
  const pMs = (performance.now() - a) / N;
  a = performance.now();
  for (let i = 0; i < N; i++) sys.update(1 / 60);
  const pMs2 = (performance.now() - a) / N;
  // sim: N frames of play at `speed` (the runtime's LOD cadences follow the performance clock: the loop's own pace)
  ctx.time.set(t0); rt.update();
  a = performance.now();
  const hs = await heap(() => { for (let i = 0; i < N; i++) { step(speed); rt.update(); } });
  const sMs = (performance.now() - a) / N;
  ctx.time.set(t0); rt.update();
  a = performance.now();
  for (let i = 0; i < N; i++) { step(speed); rt.update(); }
  const sMs2 = (performance.now() - a) / N;
  ctx.time.set(t0);
  await frames(3);
  // scene graph
  const count = (o) => { let n = 0, auto = 0; o.traverse((x) => { n++; if (x.matrixAutoUpdate) auto++; }); return [n, auto]; };
  const sub = {};
  for (const c of ctx.scene.children) {
    if (c.name === 'world') for (const w of c.children) sub[`world/${w.name || w.type}`] = count(w);
    else sub[c.name || c.type] = count(c);
  }
  for (let i = 0; i < 20; i++) ctx.scene.updateMatrixWorld();
  a = performance.now();
  for (let i = 0; i < 200; i++) ctx.scene.updateMatrixWorld();
  const umw = (performance.now() - a) / 200;
  a = performance.now();
  for (let i = 0; i < 200; i++) ctx.people.root.updateMatrixWorld();
  const umwPeople = (performance.now() - a) / 200;
  out[name] = {
    people: { msPerCall: +Math.min(pMs, pMs2).toFixed(4), kbPerCall: +(hp.total / 1024 / N).toFixed(2), top: hp.top.slice(0, 8).map(([k, b]) => [k, +(b / 1024 / N).toFixed(2)]), stats: { ...sys.stats, lod: [...sys.stats.lod] }, actors: sys.actors.size },
    sim: { msPerCall: +Math.min(sMs, sMs2).toFixed(4), kbPerCall: +(hs.total / 1024 / N).toFixed(2), top: hs.top.slice(0, 8).map(([k, b]) => [k, +(b / 1024 / N).toFixed(2)]), figures: rt.stats.figures },
    graph: { updateMatrixWorldMs: +umw.toFixed(4), peopleRootMs: +umwPeople.toFixed(4), sub },
    world: name === 'b 1x' || name === 'a start' || name === 'd n3' ? worldInView() : undefined,
  };
  log(name, JSON.stringify({ p: out[name].people.msPerCall, pKB: out[name].people.kbPerCall, s: out[name].sim.msPerCall, sKB: out[name].sim.kbPerCall, umw }));
}
return out;
