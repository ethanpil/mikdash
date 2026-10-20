// Repro: day -> night backwards jump (lighting-polish task (a)).
const probe = () => {
  const c = globalThis.__mikdash, e = c.env, f = c.fx?.stats || {};
  return { t: +c.time.t.toFixed(1), alt: +c.time.sun.altitude.toFixed(2), P: +e.preExposure.toPrecision(3), La: +e.luminance.toPrecision(3),
    Esky: +e.skyIrradiance.toPrecision(3), envI: +c.scene.environmentIntensity.toPrecision(3), key: +e.keyLight.intensity.toPrecision(3),
    exp: +(c.post?.exposureTotal ?? 0).toPrecision(3), tmExp: +c.renderer.toneMappingExposure.toPrecision(3), fxP: f.P, adapt: f.adaptation, lights: f.lights };
};
export default async function (h) {
  const tag = h.q;
  await h.ev(() => { const t = globalThis.__mikdash.time; t.set(t.fromZmani('day', 0.3)); });
  await h.wait(1500);
  h.log('day', JSON.stringify(await h.ev(probe)));
  await h.shot(`a-${tag}-0-day`);
  await h.ev(() => { const t = globalThis.__mikdash.time; t.set(t.zmanim.alot - 6); });
  for (const ms of [100, 400, 1000, 3000, 9000]) {
    await h.wait(ms === 100 ? 100 : ms - [100, 400, 1000, 3000, 9000][[100, 400, 1000, 3000, 9000].indexOf(ms) - 1]);
    h.log(`+${ms}`, JSON.stringify(await h.ev(probe)));
    if (ms >= 1000) await h.shot(`a-${tag}-night-${ms}`);
  }
}
