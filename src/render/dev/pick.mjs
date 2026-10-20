// lighting-polish-fix: what is under a screen pixel (PX="x,y" in 1280×720), and its room / sky visibility.
export default async function (h) {
  const [px, py] = (process.env.PX || '447,400').split(',').map(Number);
  await h.wait(2500);
  const r = await h.ev(async ([px, py]) => {
    const c = globalThis.__mikdash;
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(px / 640 - 1, 1 - py / 360), c.camera);
    const hits = rc.intersectObjects(c.world.children, true).slice(0, 3);
    return hits.map((x) => {
      const ins = c.env.interiors.at(x.point);
      const n = x.face ? x.face.normal.clone().transformDirection(x.object.matrixWorld) : null;
      const s = c.units ? [x.point.x / c.units.AMAH, -x.point.z / c.units.AMAH, x.point.y / c.units.AMAH] : null;
      return { obj: x.object.name, parent: x.object.parent?.name, mat: x.object.material?.name || x.object.material?.type, site: s?.map((v) => +v.toFixed(2)), normal: n?.toArray().map((v) => +v.toFixed(2)), V: +ins.V.toFixed(3), vol: ins.vol?.id || null, s: +ins.s.toFixed(2) };
    });
  }, [px, py]);
  h.log(JSON.stringify(r, null, 1));
}
