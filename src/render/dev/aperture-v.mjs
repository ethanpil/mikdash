// render-audio-3: the shader's cheap aperture solid angle (interiors-glsl.js mkAperture, ported) against env's exact CPU
// form (interiors.at) at the Kodesh probe and up the parochet — the irradiance correction divides one by the other.
//   node src/render/dev/session.mjs src/render/dev/aperture-v.mjs --q high --out shots/render-audio-3/wip
export default async function (h) {
  await h.wait(3000);
  const r = await h.ev(async () => {
    const c = globalThis.__mikdash, I = c.env.interiors, { m2w } = await import('/src/core/units.js');
    const vol = I.volumes.find((v) => v.id === 'heichal.kodesh'), kod = c.el('heichal.kodesh').box;
    const cheap = (p) => {
      let v = vol.base;
      for (const a of vol.apertures) {
        if (!(a.value > 0)) continue;
        const d = [a.centre.x - p.x, a.centre.y - p.y, a.centre.z - p.z];
        const h0 = d[a.axis] * a.sign;
        if (h0 <= 0) continue;
        const o = [0, 1, 2].filter((k) => k !== a.axis);
        const cc = [d[o[0]], d[o[1]]], he = [a.hx, a.hy];
        const h2 = h0 * h0, A = 4 * a.hx * a.hy;
        const e = [Math.max(Math.abs(cc[0]) - he[0], 0), Math.max(Math.abs(cc[1]) - he[1], 0)];
        const k = h2 / (h2 + e[0] * e[0] + e[1] * e[1]);
        v += (1 - h0 / Math.sqrt(h2 + A * 0.3183099)) * k * Math.sqrt(k) * a.value;
      }
      return Math.min(Math.max(v, 0), 1);
    };
    const p = c.env.probes.probes.find((q) => q.id === 'kodesh');
    const at = (X, Z) => m2w(X, (kod.min[1] + kod.max[1]) / 2, kod.min[2] + Z);
    const rows = [['probe', p.world]];
    for (const z of [2, 10, 20, 30, 38]) rows.push([`curtain z${z}`, at(kod.min[0] + 0.05, z)]);
    for (const x of [10, 30, 37]) rows.push([`axis x${x} z3.4`, at(kod.min[0] + x, 3.4)]);
    const ex0 = I.at(p.world, { V: 1, vol: null, s: 0 }).V, ch0 = cheap(p.world);
    return {
      apertures: vol.apertures.map((a) => ({ axis: a.axis, sign: a.sign, hx: +a.hx.toFixed(2), hy: +a.hy.toFixed(2), value: +a.value.toFixed(3), c: a.centre.toArray().map((v) => +v.toFixed(1)) })),
      rows: rows.map(([n, q]) => { const ex = I.at(q, { V: 1, vol: null, s: 0 }).V, ch = cheap(q); return { n, exact: +ex.toFixed(4), cheap: +ch.toFixed(4), ratioExact: +(ex / ex0).toFixed(3), ratioCheap: +(ch / ch0).toFixed(3), ratioMixed: +(ch / ex0).toFixed(3) }; }),
    };
  });
  h.log(JSON.stringify(r, null, 1));
}
