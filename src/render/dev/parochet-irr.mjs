// render-audio-3: the diffuse light the shader gives the parochet, in physical units. The parochet is made a plain grey
// Lambertian (albedo K, no map, no specular, no sheen), rendered with the Neutral tone mapper (linear below ~0.76), and
// its display luminance converted back: E/π = L_display / (K × exposureTotal × P × WB-luminance). Compare with
// kodesh-irr.mjs (cube integrations: the probe's own point and a capture at the parochet).
//   T=d3 node src/render/dev/session.mjs src/render/dev/parochet-irr.mjs --q high --out shots/render-audio-3/wip
export default async function (h) {
  const t = process.env.T || 'd3';
  const K = 0.1;
  await h.ev((t) => { const c = globalThis.__mikdash; c.time.pause(true); c.time.set(c.time.parse(t)); c.player.teleport({ at: [150, 330.5] }); c.player.setLook(270, 4); }, t);
  await h.wait(6000);
  await h.ev(() => globalThis.__mikdash.post.setToneMapper('neutral'));
  await h.wait(4000);
  const { resolve } = await import('node:path');
  const { PNG } = await import('../../../node_modules/playwright-core/lib/utilsBundle.js');
  const crops = { low: [600, 330, 120, 80], mid: [600, 200, 120, 80], high: [600, 60, 120, 80] };
  for (const share of [0, 1]) {
    const r = await h.ev(([share, K]) => {
      const c = globalThis.__mikdash, m = c.mats.get('parochet'), p = c.env.probes.probes.find((q) => q.id === 'kodesh');
      m.userData.__b = m.userData.__b || { map: m.map, color: m.color.clone(), sheen: m.sheen, spec: m.specularIntensity };
      m.map = null; m.color.setRGB(K, K, K); m.sheen = 0; m.specularIntensity = 0; m.needsUpdate = true;
      p.share = share;
      const wb = c.env.whiteBalance;
      return { P: c.env.preExposure, ex: c.post.exposureTotal, wbL: 0.2126 * wb.x + 0.7152 * wb.y + 0.0722 * wb.z };
    }, [share, K]);
    await h.wait(5000);
    const f = resolve(h.out, `parochet-irr-${h.q}-${t}-share${share}.png`);
    const buf = await h.page.screenshot({ path: f });
    const img = PNG.sync.read(buf);
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const out = {};
    for (const [k, [x0, y0, w, hh]] of Object.entries(crops)) {
      let s = 0, n = 0;
      for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * img.width + x) * 4; s += 0.2126 * lin(img.data[i]) + 0.7152 * lin(img.data[i + 1]) + 0.0722 * lin(img.data[i + 2]); n++; }
      const Ld = s / n;
      out[k] = { display: +Ld.toFixed(4), EoverPi: +(Ld / (K * r.ex * r.P * r.wbL)).toFixed(1) };
    }
    h.log(`share ${share}`, JSON.stringify({ ...r, ...out }));
  }
}
