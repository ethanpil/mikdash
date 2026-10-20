// render-env-2: the Even Shetiyah with the KhK's gold fill on / off (the volume's gold flag), one boot. Dev only.
//   node src/render/dev/session.mjs src/render/dev/even-ab.mjs --q low --out shots/render-env-2/wip
export default async function (h) {
  await h.ev(() => { const c = globalThis.__mikdash, T = c.time; T.pause(true); T.set(T.parse('d3')); c.player.setMode('walk'); c.player.teleport({ at: [104, 331.5] }); c.player.setLook(262, -30); });
  await h.wait(6000);
  for (const gold of [true, false]) {
    const s = await h.ev((gold) => {
      const c = globalThis.__mikdash, v = c.env.interiors.volumes.find((q) => q.id === 'heichal.khk');
      v.gold = gold;
      return { vol: c.env.interiors.camera?.vol?.id, gain: c.env.interiors.roomGain(v) };
    }, gold);
    await h.wait(4000);
    const wb = await h.ev(() => globalThis.__mikdash.env.whiteBalance.toArray().map((x) => +x.toFixed(2)));
    const f = await h.shot(`even-ab-${h.q}-${gold ? 'gold' : 'plain'}`);
    h.log(JSON.stringify({ gold, ...s, wb }), f);
  }
}
