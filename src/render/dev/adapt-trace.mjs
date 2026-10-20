export default async function (h) {
  for (let i = 0; i < 10; i++) {
    const r = await h.ev(() => { const c = globalThis.__mikdash; return { f: c.engine.frame, P: +c.env.preExposure.toPrecision(3), La: +c.env.luminance.toPrecision(3), fx: c.fx.stats.adaptation, fxP: c.fx.stats.P }; });
    h.log(JSON.stringify(r));
    await h.wait(700);
  }
}
