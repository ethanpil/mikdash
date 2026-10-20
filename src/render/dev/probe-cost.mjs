// lighting-polish-fix: probe capture cost (CPU + GPU via gl.finish) and world group sizes.
//   node src/render/dev/session.mjs src/render/dev/probe-cost.mjs --q medium --query "at=136,330.5&look=270,5&t=d3"
export default async function (h) {
  await h.wait(2000);
  const r = await h.ev(async () => {
    const c = globalThis.__mikdash, gl = c.renderer.getContext();
    const groups = (c.world?.children || []).map((g) => {
      let meshes = 0, tris = 0;
      g.traverse((o) => { if (o.isMesh) { meshes++; const gi = o.geometry; tris += (gi.index ? gi.index.count : gi.attributes.position?.count || 0) / 3 * (o.count || 1); } });
      return { name: g.name, visible: g.visible, meshes, ktris: Math.round(tris / 1000) };
    });
    const pr = c.env.probes;
    if (!pr) return { groups, probes: null };
    const out = { groups, probes: pr.probes.map((p) => ({ id: p.id, pos: p.world.toArray().map((v) => +v.toFixed(1)), hide: p.hide })) };
    // time one full sync capture (CPU and CPU + GPU drain)
    c.engine.stop();
    globalThis.__mkProbeProf = {};
    gl.finish();
    const t0 = performance.now();
    pr.capture();
    for (let i = 0; i < 4; i++) { for (const u of c.engine.updaters) u.fn(1 / 60, c); c.engine.renderFn(1 / 60); }
    gl.finish();
    out.fourFramesWithCaptureMs = +(performance.now() - t0).toFixed(1);
    out.prof = Object.fromEntries(Object.entries(globalThis.__mkProbeProf).map(([k, v]) => [k, +v.toFixed(1)]));
    globalThis.__mkProbeProf = null;
    const t1 = performance.now();
    for (let i = 0; i < 4; i++) { for (const u of c.engine.updaters) u.fn(1 / 60, c); c.engine.renderFn(1 / 60); }
    gl.finish();
    out.fourFramesMs = +(performance.now() - t1).toFixed(1);
    c.engine.start(c);
    out.stats = pr.stats;
    return out;
  });
  h.log(JSON.stringify(r, null, 1));
}
