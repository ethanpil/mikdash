// render-audio-3: the Kodesh probe's sky share (env/probes.js skyShare) through a day, one boot; the probe is re-captured
// at each time (a forced sync capture after the jump).
//   T=sunrise+20,sunrise+60,d2,d3,d6,d9,d11,sunset-10,n1 node src/render/dev/session.mjs src/render/dev/kodesh-share-times.mjs --q high --out shots/render-audio-3/wip
export default async function (h) {
  const times = (process.env.T || 'sunrise+40,sunrise+90,sunrise+150,d3,d9').split(',');
  await h.ev(() => { const c = globalThis.__mikdash; c.time.pause(true); c.player.teleport({ at: [150, 330.5] }); c.player.setLook(270, 4); });
  for (const t of times) {
    await h.ev((t) => { const c = globalThis.__mikdash; c.time.set(c.time.parse(t)); }, t);
    await h.wait(3500);
    const r = await h.ev(() => {
      const c = globalThis.__mikdash, p = c.env.probes.probes.find((q) => q.id === 'kodesh');
      return { share: +p.share.toFixed(3), deepF: +(p.deepF ?? -1).toFixed(4), sunAlt: +c.time.sun.altitude.toFixed(1), sunAz: +c.time.sun.azimuth.toFixed(1), clock: c.time.format(c.time.t) };
    });
    h.log(t, JSON.stringify(r));
  }
}
