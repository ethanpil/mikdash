// lighting-polish-fix: unfold a probe's cube, exposed by its own mean, and report value statistics (NaN, negative,
// subnormal-range texels). env PROBE=<id> (default court), TIME=n3 (zmani spec), AT="x,y", LOOK="h,p".
export default async function (h) {
  const id = process.env.PROBE || 'court';
  const tn = process.env.TIME || 'n3';
  await h.ev(([a, b]) => { const t = globalThis.__mikdash.time; t.set(t.fromZmani(a, b)); }, [tn[0] === 'n' ? 'night' : 'day', +tn.slice(1)]);
  if (process.env.AT) {
    await h.ev(([a, l]) => { const c = globalThis.__mikdash; c.player.teleport({ at: a }); c.player.setLook(l[0], l[1]); }, [process.env.AT.split(',').map(Number), (process.env.LOOK || '0,0').split(',').map(Number)]);
  }
  await h.wait(4000);
  const info = await h.ev((id) => {
    const c = globalThis.__mikdash, p = c.env.probes.probes.find((q) => q.id === id), r = c.renderer;
    const n = p.rt.width;
    const half = (h) => { const e = (h >> 10) & 0x1f, f = h & 0x3ff; const v = e === 0 ? 6.103515625e-5 * (f / 1024) : e === 31 ? Infinity : 2 ** (e - 15) * (1 + f / 1024); return (h & 0x8000) ? -v : v; };
    const cv = document.createElement('canvas'); cv.width = n * 4; cv.height = n * 3;
    cv.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:768px;z-index:99;image-rendering:pixelated;background:#000';
    document.body.appendChild(cv);
    const g = cv.getContext('2d'); const img = g.createImageData(n, n);
    const at = [[2, 1], [0, 1], [1, 0], [1, 2], [1, 1], [3, 1]];
    const faces = [];
    let sum = 0, cnt = 0, nan = 0, neg = 0, sub = 0, inf = 0, max = 0;
    for (let f = 0; f < 6; f++) {
      const buf = new Uint16Array(n * n * 4);
      r.readRenderTargetPixels(p.rt, 0, 0, n, n, buf, f);
      faces.push(buf);
      for (let i = 0; i < n * n * 4; i++) {
        if (i % 4 === 3) continue;
        const v = half(buf[i]);
        if (Number.isNaN(v)) nan++; else if (!Number.isFinite(v)) inf++; else { if (v < 0) neg++; if (v !== 0 && Math.abs(v) < 6.1e-5) sub++; max = Math.max(max, v); sum += v; cnt++; }
      }
    }
    const mean = sum / Math.max(cnt, 1);
    const k = 0.5 / Math.max(mean, 1e-12);
    faces.forEach((buf, f) => {
      for (let i = 0; i < n * n; i++) {
        const tm = (x) => Math.round(255 * Math.pow(Math.max(x, 0) * k / (1 + Math.max(x, 0) * k), 1 / 2.2));
        const y = n - 1 - Math.floor(i / n), x = i % n, o = (y * n + x) * 4;
        img.data[o] = tm(half(buf[i * 4])); img.data[o + 1] = tm(half(buf[i * 4 + 1])); img.data[o + 2] = tm(half(buf[i * 4 + 2])); img.data[o + 3] = 255;
      }
      g.putImageData(img, at[f][0] * n, at[f][1] * n);
    });
    return { id, n, Pcap: p.Pcap, P: c.env.preExposure, Ecap: p.Ecap, Egcap: p.Egcap, valid: p.valid, meanScene: mean, max, nan, inf, neg, subnormal: sub };
  }, id);
  h.log(JSON.stringify(info));
  await h.shot(`probedump-${id}-${h.q}-${tn}${process.env.TAG ? `-${process.env.TAG}` : ''}`);
}
