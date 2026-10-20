// Unfold a probe's cube (cross layout) into an overlay canvas and screenshot it. env PROBE=<id> (default kodesh)
export default async function (h) {
  const id = process.env.PROBE || 'kodesh';
  const info = await h.ev((id) => {
    const c = globalThis.__mikdash, p = c.env.probes.probes.find((q) => q.id === id), r = c.renderer;
    const n = p.rt.width, P = c.env.preExposure;
    const half = (h) => { const e = (h >> 10) & 0x1f, f = h & 0x3ff; const v = e === 0 ? 6.103515625e-5 * (f / 1024) : e === 31 ? 65504 : 2 ** (e - 15) * (1 + f / 1024); return (h & 0x8000) ? -v : v; };
    const cv = document.createElement('canvas'); cv.width = n * 4; cv.height = n * 3;
    cv.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:768px;z-index:99;image-rendering:pixelated;background:#000';
    document.body.appendChild(cv);
    const g = cv.getContext('2d'); const img = g.createImageData(n, n);
    // cross: +Y top, -X +Z +X -Z middle row, -Y bottom
    const at = [[2, 1], [0, 1], [1, 0], [1, 2], [1, 1], [3, 1]];
    const buf = new Uint16Array(n * n * 4);
    let mean = 0; const exp = 1 / Math.max(p.Pcap, 1e-9) * (Number(globalThis.__mkExp) || 0) ;
    for (let f = 0; f < 6; f++) {
      r.readRenderTargetPixels(p.rt, 0, 0, n, n, buf, f);
      for (let i = 0; i < n * n; i++) {
        let R = half(buf[i * 4]), G = half(buf[i * 4 + 1]), B = half(buf[i * 4 + 2]);
        const L = 0.2126 * R + 0.7152 * G + 0.0722 * B; mean += L;
        const k = 4 / Math.max(p.meanL * p.Pcap, 1e-9); // expose so the mean sits at ~0.8 (Reinhard)
        const tm = (x) => Math.round(255 * Math.pow(x * k / (1 + x * k), 1 / 2.2));
        const y = n - 1 - Math.floor(i / n), x = i % n;
        const o = (y * n + x) * 4; img.data[o] = tm(R); img.data[o + 1] = tm(G); img.data[o + 2] = tm(B); img.data[o + 3] = 255;
      }
      g.putImageData(img, at[f][0] * n, at[f][1] * n);
    }
    return { id, n, Pcap: p.Pcap, meanL: p.meanL, meanRaw: mean / (6 * n * n) / p.Pcap, P };
  }, id);
  h.log(JSON.stringify(info));
  await h.shot(`probeview-${id}-${h.q}-${process.env.TAG || ''}`);
}
