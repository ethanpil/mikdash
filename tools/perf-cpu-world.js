// perf-cpu round 2: the world's geometry per view — calls / triangles of one frame by pass and builder (renderBufferDirect
// wrapped for a few frames), and each world mesh's triangles drawn vs inside the view frustum. Run with the sim harness:
//   node src/sim/dev/run.mjs --q low --timeout 3000 --script tools/perf-cpu-world.js "t=d3"
const sys = ctx.people.system;
const VIEWS = [
  ['a start', '2026-11-02', 'alot-6', 'start', null, null],
  ['b azarah d3', '2026-11-02', 'd3', [238, 385], [215, 4], null],
  ['d night n3', '2026-11-02', 'n3', [238, 385], [215, 4], null],
  ['aerial d3', '2026-11-02', 'd3', null, [315, -28], [430, 40, 240]],
];
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
  const big = [];
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
      const all0 = all, inv0 = inv;
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
      big.push([`${top.name}/${o.name || ''}:${[].concat(o.material).map((x) => x.name).join('+')}${o.isInstancedMesh && !o.userData.mkSingle ? ` ×${inst}` : ''}`, all - all0, inv - inv0]);
    });
    res[top.name] = { meshes, drawnTris: all, inFrustum: inv, share: all ? +(inv / all).toFixed(3) : 0, culledByThree };
  }
  res.biggest = big.sort((a, b) => b[1] - a[1]).slice(0, 14);
  return res;
}

const r = ctx.renderer, A = 0.48;
const groupOf = (o) => { let p = o, top = null; while (p) { if (p === ctx.people?.root) return 'people'; if (p === ctx.fx?.scene) return 'fx'; if (p.parent && p.parent.parent === ctx.scene && p.parent.name === 'world') top = p; if (p.parent === ctx.scene && !top) top = p; p = p.parent; } return top?.name || 'other'; };
async function frame() {
  const P = r.renderBufferDirect, cur = {};
  r.renderBufferDirect = function (camera, scene, geometry, material, object) {
    const c0 = r.info.render.calls, t0 = r.info.render.triangles;
    const res = P.apply(this, arguments);
    const pass = material?.isMeshDepthMaterial || material?.isMeshDistanceMaterial || /depth|distance/i.test(material?.name || '') ? (camera === ctx.camera ? 'prepass' : 'shadow') : camera === ctx.camera ? 'main' : 'other';
    const k = `${pass}|${groupOf(object)}`;
    const e = cur[k] || (cur[k] = [0, 0]); e[0] += r.info.render.calls - c0; e[1] += r.info.render.triangles - t0;
    return res;
  };
  await frames(1);
  r.renderBufferDirect = P;
  return { calls: r.info.render.calls, tris: r.info.render.triangles, by: cur };
}
// the collision soup (ctx.colliders): count, triangles and a position checksum — must not change with the world's render
// meshes (the nav grid and the physics BVH are built from it)
const coll = (() => {
  let n = 0, tris = 0, sum = 0;
  for (const c of ctx.colliders) {
    n++;
    const g = c.object.isMesh ? c.object.geometry : c.object;
    const p = g.attributes?.position;
    if (!p) continue;
    tris += (g.index ? g.index.count : p.count) / 3;
    const a = p.array;
    for (let i = 0; i < a.length; i += 7) sum += a[i] * ((i % 13) + 1);
  }
  return { n, tris, checksum: +sum.toFixed(1) };
})();
const out = { colliders: coll };
for (const [name, date, t, at, look, pos] of VIEWS) {
  if (ctx.time.dateString !== date) { ctx.time.setDate(date); await frames(2); }
  ctx.time.set(ctx.time.parse(t));
  if (pos) { ctx.player.setMode('fly'); ctx.player.teleport({ pos: [pos[0], pos[1], pos[2]] }); }
  else { ctx.player.setMode('walk'); ctx.player.teleport(typeof at === 'string' ? at : { at, heading: look?.[0] }); }
  if (look) ctx.player.setLook(look[0], look[1]);
  await frames(4);
  const f = [await frame(), await frame(), await frame()];
  const pick = f.sort((x, y) => x.calls - y.calls)[1];   // median frame by calls
  const world = worldInView();
  const p = ctx.player.position;
  out[name] = { calls: pick.calls, tris: pick.tris, by: pick.by, world, meshes: (() => { let n = 0; ctx.world.traverse((o) => { if (o.isMesh) n++; }); return n; })(), programs: r.info.programs.length, eye: [p.x, p.y, p.z].map((v) => +v.toFixed(1)) };
  await shot(`world-${ctx.quality.key}-${name.replace(/\s+/g, '-')}`);
  log(name, pick.calls, pick.tris);
}
return out;
