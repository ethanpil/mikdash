// lighting-polish-fix: show the probe atlas (scene.environment on medium+), each slice exposed by its own mean.
export async function dumpAtlas(h, name) {
  const info = await h.ev(() => {
    const c = globalThis.__mikdash, pr = c.env.probes, rt = pr.atlas, r = c.renderer;
    const W = rt.width, H = rt.height;
    const buf = new Uint16Array(W * H * 4);
    r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    const half = (h) => { const e = (h >> 10) & 0x1f, f = h & 0x3ff; const v = e === 0 ? 6.103515625e-5 * (f / 1024) : e === 31 ? Infinity : 2 ** (e - 15) * (1 + f / 1024); return (h & 0x8000) ? -v : v; };
    const nS = pr.probes.length + 1, stride = W / nS;
    const means = [];
    for (let s = 0; s < nS; s++) { let m = 0, n = 0; for (let y = 0; y < H; y++) for (let x = Math.floor(s * stride); x < Math.floor((s + 1) * stride) - 8; x++) { const i = (y * W + x) * 4; const l = half(buf[i]) + half(buf[i + 1]) + half(buf[i + 2]); if (Number.isFinite(l) && l > 0) { m += l; n++; } } means.push(n ? m / n : 1); }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cv.style.cssText = `position:fixed;left:0;top:0;width:${Math.min(1280, W * 1.2)}px;height:${H * 1.2}px;z-index:99;image-rendering:pixelated;background:#000`;
    document.body.appendChild(cv);
    const g = cv.getContext('2d'), img = g.createImageData(W, H);
    let bad = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, s = Math.min(nS - 1, Math.floor(x / stride)), k = 1.5 / means[s];
      const o = ((H - 1 - y) * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) { const v = half(buf[i + ch]); if (!Number.isFinite(v) || v < 0) bad++; img.data[o + ch] = Math.round(255 * Math.pow(Math.max(v, 0) * k / (1 + Math.max(v, 0) * k), 1 / 2.2)); }
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    globalThis.__atlasCv = cv;
    return { W, H, nS, means, bad };
  });
  h.log('atlas', JSON.stringify(info));
  await h.shot(name);
  await h.ev(() => { globalThis.__atlasCv?.remove(); });
}
export default async function (h) {
  await h.ev(() => { const t = globalThis.__mikdash.time; t.set(t.fromZmani('night', 3)); });
  await h.wait(3000);
  await dumpAtlas(h, 'atlas-0');
  await h.ev(() => { const c = globalThis.__mikdash; c.player.teleport({ at: [136, 330.5] }); c.player.setLook(270, 5); });
  for (let i = 1; i <= 4; i++) {
    await h.wait(4000);
    const st = await h.ev(() => { const p = globalThis.__mikdash.env.probes; return { captures: p.stats.captures, probes: p.probes.map((q) => [q.id, q.mode, +q.Ecap.toPrecision(3)]) }; });
    h.log(`t+${i * 4}s`, JSON.stringify(st));
    await dumpAtlas(h, `atlas-${i}`);
  }
}
