// render-audio-3: is the Kodesh's diffuse light where it is seen what its probe says? Reads the probe's cube (half
// floats), integrates the cosine-weighted irradiance for a few normals (physical: ÷ capture gain ÷ P at capture), then
// moves the capture point along the room's axis, re-captures, and compares each with the probe's own point (and with
// the sky-visibility ratio V(here) / V(probe), which the shader's correction uses). Restores the probe at the end.
//   T=d3,sunrise+40 AT=1,8,16,28,36,-3 node src/render/dev/session.mjs src/render/dev/kodesh-irr.mjs --q high --out shots/render-audio-3/wip
// AT: amot from the Kodesh's west end (negative: from its east end).
export default async function (h) {
  const times = (process.env.T || 'd3').split(',');
  const ats = (process.env.AT || '1,-3').split(',').map(Number);
  const measure = () => h.ev(() => {
    const c = globalThis.__mikdash, P = c.env.probes, p = P.probes.find((q) => q.id === 'kodesh');
    const half = (x) => { const e = (x >> 10) & 0x1f, f = x & 0x3ff; const v = e === 0 ? 6.103515625e-5 * (f / 1024) : e === 31 ? Infinity : 2 ** (e - 15) * (1 + f / 1024); return (x & 0x8000) ? -v : v; };
    const n = p.rt.width, buf = new Uint16Array(n * n * 4);
    // GL cube-map convention (sampling textureCube(worldDir) gives the world radiance in dir)
    const dir = [
      (s, t) => [1, -t, -s], (s, t) => [-1, -t, s], (s, t) => [s, 1, t],
      (s, t) => [s, -1, -t], (s, t) => [s, -t, 1], (s, t) => [-s, -t, -1],
    ];
    const N = { east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0], north: [0, 0, -1] };
    const E = Object.fromEntries(Object.keys(N).map((k) => [k, 0]));
    let wsum = 0;
    for (let f = 0; f < 6; f++) {
      c.renderer.readRenderTargetPixels(p.rt, 0, 0, n, n, buf, f);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const s = ((x + 0.5) / n) * 2 - 1, tt = ((y + 0.5) / n) * 2 - 1;
        const d = dir[f](s, tt), l = Math.hypot(...d);
        const w = 1 / (l * l * l); // texel solid angle ∝ (1 + s² + t²)^-3/2
        const i = (y * n + x) * 4, L = 0.2126 * half(buf[i]) + 0.7152 * half(buf[i + 1]) + 0.0722 * half(buf[i + 2]);
        for (const k in N) { const cs = (d[0] * N[k][0] + d[1] * N[k][1] + d[2] * N[k][2]) / l; if (cs > 0) E[k] += L * cs * w; }
        wsum += w;
      }
    }
    const k = (4 * Math.PI) / wsum / Math.PI / p.Pcap; // → E/π, physical cd/m² (Pcap = P × the capture gain)
    for (const q in E) E[q] = +(E[q] * k).toPrecision(4);
    const ins = c.env.interiors.at(p.world, { V: 1, vol: null, s: 0 });
    return { V: +ins.V.toFixed(4), cg: +p.capGain.toFixed(3), E };
  });
  const moveTo = (a) => h.ev(async (a) => {
    const c = globalThis.__mikdash, p = c.env.probes.probes.find((q) => q.id === 'kodesh');
    const kod = c.el('heichal.kodesh').box;
    const { m2w } = await import('/src/core/units.js');
    p.__home = p.__home || p.world.clone();
    const w = a == null ? p.__home : m2w(a >= 0 ? kod.min[0] + a : kod.max[0] + a, (kod.min[1] + kod.max[1]) / 2, kod.min[2] + 1.65 / c.units.AMAH);
    p.world.copy(w); p.cam.position.copy(w); p.cam.updateMatrixWorld(true);
    c.env.probes.capture();
  }, a);
  // measured without the irradiance correction (render-audio-3): the captures are what it is fitted to
  await h.ev(() => { const c = globalThis.__mikdash; c.time.pause(true); c.player.teleport({ at: [150, 330.5] }); c.player.setLook(270, 4); const p = c.env.probes.probes.find((q) => q.id === 'kodesh'); p.irr = null; p.share = 0; });
  for (const t of times) {
    await h.ev((t) => { const c = globalThis.__mikdash; c.time.set(c.time.parse(t)); }, t);
    await moveTo(null);
    await h.wait(6000);
    const ref = await measure();
    h.log(t, 'probe', JSON.stringify(ref));
    for (const a of ats) {
      await moveTo(a);
      await h.wait(4500);
      const m = await measure();
      const r = {};
      for (const q in m.E) r[q] = +(m.E[q] / ref.E[q]).toFixed(3);
      h.log(t, `at ${a}`, JSON.stringify({ V: m.V, Vratio: +(m.V / ref.V).toFixed(3), ratio: r }));
    }
  }
  await moveTo(null);
  await h.wait(3000);
}
