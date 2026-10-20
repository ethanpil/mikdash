const probe = () => {
  const c = globalThis.__mikdash, e = c.env;
  const cv = globalThis.__mkCv || (globalThis.__mkCv = Object.assign(document.createElement('canvas'), { width: 32, height: 18 }));
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(c.renderer.domElement, 0, 0, 32, 18);
  const d = g.getImageData(0, 0, 32, 18).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
  return { alt: +c.time.sun.altitude.toFixed(2), mean: +(s / (d.length / 4)).toFixed(1), P: +e.preExposure.toPrecision(3), La: +e.luminance.toPrecision(3), Eg: +e.globalIlluminance.toPrecision(3),
    probes: e.probes?.probes.map((p) => [p.id, p.valid, +p.Pcap.toPrecision(3), +p.Ecap.toPrecision(3)]), sc: e.interiors ? [...e.interiors.uniforms.view('mkPrC')].filter((_, i) => i % 4 === 3).map((v) => +v.toPrecision(3)) : null, fx: c.fx.stats.P, adapt: c.fx.stats.adaptation };
};
export default async function (h) {
  for (const off of [40, 55]) {
    await h.ev((o) => { const t = globalThis.__mikdash.time; t.set(t.zmanim.sunset + o); }, off);
    await h.wait(2500);
    h.log(`sunset+${off}`, JSON.stringify(await h.ev(probe)));
    await h.shot(`dusk-${h.q}-${off}`);
  }
}
