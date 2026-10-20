// lighting-polish-fix: shots of named views at several times in ONE page (one boot per tier).
//   VIEWS=court-nw,court-ne TIMES=n3,d3 node src/render/dev/session.mjs src/render/dev/views.mjs --q medium --out shots/x
// Optional TAG appended to file names (e.g. "noprobe" for a ?probes=0 run). Logs the meter at each view.
const ALL = {
  'court-nw': [[80, 385], [120, 2]],
  'court-ne': [[238, 385], [200, 0]],
  ulam: [[192, 331], [270, 12]],
  'kod-west': [[136, 330.5], [270, 5]],
  'kod-menorah': [[139, 332], [225, 0]],
  'kod-east': [[120, 330.5], [90, 5]],
  'kod-up': [[124, 330.5], [270, 40]],
  moked: [[210, 398, 16], [180, 10]],
  passage: [[203, 430, -12], [0, 0]],
  gazit: [[80, 385], [120, 2]],
  nikanor: [[236, 330.5], [90, 8]],
  facade: [[200, 300], [300, 15]],
};
export default async function (h) {
  const pick = (process.env.VIEWS || 'court-nw,court-ne,ulam').split(',').filter(Boolean);
  const times = (process.env.TIMES || 'n3,d3').split(',');
  const tag = process.env.TAG ? `-${process.env.TAG}` : '';
  const settle = +(process.env.SETTLE || 4500);
  for (const tn of times) {
    const half = tn[0] === 'n' ? 'night' : 'day';
    await h.ev(([a, b]) => { const t = globalThis.__mikdash.time; t.set(t.fromZmani(a, b)); }, [half, +tn.slice(1)]);
    for (const name of pick) {
      const [at, look] = ALL[name];
      await h.ev(([a, l]) => { const c = globalThis.__mikdash; c.player.teleport({ at: a }); c.player.setLook(l[0], l[1]); }, [at, look]);
      await h.wait(settle);
      const s = await h.ev(() => {
        const c = globalThis.__mikdash, e = c.env, ci = e.interiors?.camera;
        const k = e.probes?.probes.find((p) => p.id === 'kodesh');
        return { P: +e.preExposure.toPrecision(3), La: +e.luminance.toPrecision(3), V: ci ? +ci.V.toPrecision(3) : null, vol: ci?.vol?.id,
          kod: k ? { meanL: +k.meanL.toPrecision(3), geo: k.meanLog != null ? +Math.exp(k.meanLog).toPrecision(3) : null } : null };
      });
      h.log(`${tn} ${name}`, JSON.stringify(s));
      await h.shot(`${name}-${h.q}-${tn}${tag}`);
    }
  }
}
