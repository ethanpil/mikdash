// render-env-2: read back a probe's six captured faces (scene units × P) — mean / max luminance and where the max is.
//   PROBE=ulam T=alot-6 node src/render/dev/session.mjs src/render/dev/probe-faces.mjs --q medium
export default async function (h) {
  const t = process.env.T || 'alot-6';
  await h.ev((t) => { const T = globalThis.__mikdash.time; T.pause(true); T.set(T.parse(t)); const c = globalThis.__mikdash; c.player.setMode('walk'); c.player.teleport({ at: [196, 331] }); c.player.setLook(270, 18); }, t);
  await h.wait(6000);
  for (const id of (process.env.PROBE || 'ulam,court').split(',')) {
    const r = await h.ev(async (id) => {
      const c = globalThis.__mikdash, THREE = await import('/node_modules/.vite/deps/three.js');
      const p = c.env.probes.probes.find((q) => q.id === id);
      if (!p) return { id, none: true };
      const rt = p.rt, n = rt.width, buf = new Uint16Array(n * n * 4), out = [];
      for (let f = 0; f < 6; f++) {
        c.renderer.readRenderTargetPixels(rt, 0, 0, n, n, buf, f);
        let sum = 0, max = 0, mi = 0, hot = 0;
        for (let i = 0; i < n * n; i++) {
          const L = 0.2126 * THREE.DataUtils.fromHalfFloat(buf[i * 4]) + 0.7152 * THREE.DataUtils.fromHalfFloat(buf[i * 4 + 1]) + 0.0722 * THREE.DataUtils.fromHalfFloat(buf[i * 4 + 2]);
          sum += L; if (L > max) { max = L; mi = i; }
        }
        const mean = sum / (n * n);
        for (let i = 0; i < n * n; i++) {
          const L = 0.2126 * THREE.DataUtils.fromHalfFloat(buf[i * 4]) + 0.7152 * THREE.DataUtils.fromHalfFloat(buf[i * 4 + 1]) + 0.0722 * THREE.DataUtils.fromHalfFloat(buf[i * 4 + 2]);
          if (L > 10 * mean) hot++;
        }
        out.push({ f, mean: +mean.toPrecision(3), max: +max.toPrecision(3), at: [mi % n, Math.floor(mi / n)], hot });
      }
      return { id, n, capGain: p.capGain, Pcap: p.Pcap, P: c.env.preExposure, world: p.world.toArray().map((v) => +v.toFixed(1)), faces: out };
    }, id);
    h.log(JSON.stringify(r));
  }
}
