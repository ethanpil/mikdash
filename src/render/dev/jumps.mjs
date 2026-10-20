// lighting-polish (a): clock jumps + 600x fast-forward; logs mean frame brightness (sRGB 0..255) and env state.
const probe = () => {
  const c = globalThis.__mikdash, e = c.env;
  const src = c.renderer.domElement;
  const cv = globalThis.__mkCv || (globalThis.__mkCv = Object.assign(document.createElement('canvas'), { width: 32, height: 18 }));
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, 32, 18);
  const d = g.getImageData(0, 0, 32, 18).data;
  let s = 0, mx = 0, white = 0;
  for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; mx = Math.max(mx, l); if (l > 245) white++; }
  return { t: +c.time.t.toFixed(1), alt: +c.time.sun.altitude.toFixed(2), mean: +(s / (d.length / 4)).toFixed(1), white, P: +e.preExposure.toPrecision(3), Esky: +e.skyIrradiance.toPrecision(3) };
};
export default async function (h) {
  const tag = h.q;
  const set = (expr) => h.ev((x) => { const t = globalThis.__mikdash.time; t.set(new Function('t', `return ${x}`)(t)); }, expr);
  // 1. backwards day -> night (the report's repro)
  await set("t.fromZmani('day', 0.3)"); await h.wait(1500);
  h.log('day     ', JSON.stringify(await h.ev(probe)));
  await set('t.zmanim.alot - 6');
  for (const ms of [150, 1000, 3000]) { await h.wait(ms === 150 ? 150 : ms === 1000 ? 850 : 2000); h.log(`back +${ms}`, JSON.stringify(await h.ev(probe))); }
  await h.shot(`a-${tag}-back-after`);
  // 2. forward night -> day
  await set("t.fromZmani('day', 4)");
  for (const ms of [150, 1000, 3000]) { await h.wait(ms === 150 ? 150 : ms === 1000 ? 850 : 2000); h.log(`fwd  +${ms}`, JSON.stringify(await h.ev(probe))); }
  await h.shot(`a-${tag}-fwd-after`);
  // 3. noon -> deep night -> dusk jumps
  await set('t.zmanim.chatzot'); await h.wait(800);
  await set('t.zmanim.tzeit + 60'); await h.wait(150); h.log('noon->night+150', JSON.stringify(await h.ev(probe)));
  await set('t.zmanim.sunset - 5'); await h.wait(150); h.log('night->dusk+150', JSON.stringify(await h.ev(probe)));
  // 4. 600x through dawn and dusk (clock unpaused)
  for (const [name, start, end] of [['dawn', 't.zmanim.alot - 20', 't.zmanim.sunrise + 40'], ['dusk', 't.zmanim.sunset - 40', 't.zmanim.tzeit + 20']]) {
    await set(start);
    await h.ev(() => { const t = globalThis.__mikdash.time; t.setSpeed(600); t.pause(false); });
    const endT = await h.ev((x) => new Function('t', `return ${x}`)(globalThis.__mikdash.time), end);
    let worst = { mean: 0 }, n = 0;
    const rows = [];
    for (let i = 0; i < 80; i++) {
      await h.wait(125);
      const p = await h.ev(probe);
      rows.push(p); n++;
      if (p.mean > worst.mean) worst = p;
      if (p.t >= endT) break;
    }
    await h.ev(() => { const t = globalThis.__mikdash.time; t.pause(true); t.setSpeed(1); });
    h.log(`${name} 600x: ${n} samples, brightest`, JSON.stringify(worst));
    h.log(rows.filter((_, i) => i % 6 === 0).map((r) => `${r.alt}°:${r.mean}`).join('  '));
  }
}
