// render-env-2: when does Helena's nivreshet mirror the sun to the court viewpoint (schedule view at [210, 345])? Logs
// glint(sunDir, eye) and the sun's altitude / terrain visibility from sunrise+5 to +90; then shoots the best moment
// (full frame and a crop round the nivreshet) with and without bloom. Dev only.
export default async function (h) {
  const at = [210, 345], look = [252, 28];
  await h.ev(([a, l]) => { const c = globalThis.__mikdash; c.time.pause(true); c.player.teleport({ at: a }); c.player.setLook(l[0], l[1]); }, [at, look]);
  const rows = await h.ev(async () => {
    const c = globalThis.__mikdash, T = c.time, nv = c.movables.get('heichal.nivreshet');
    const out = [];
    for (let m = 5; m <= 90; m += 1) {
      T.set(T.parse(`sunrise+${m}`));
      for (const u of c.engine.updaters) u.fn(0, c);
      const eye = c.camera.position.clone();
      const g = nv?.userData?.glint ? nv.userData.glint(c.time.sun.dir, eye) : null;
      out.push([m, +c.time.sun.altitude.toFixed(2), g == null ? null : +(+g).toFixed(3), +c.env.sunTerrainVisibility.toFixed(2)]);
    }
    return out;
  });
  const best = rows.filter((r) => r[3] > 0.5).sort((a, b) => b[2] - a[2])[0] || rows[20];
  h.log('scan [min, alt, glint, sunVis]:', JSON.stringify(rows.filter((r, i) => i % 3 === 0 || r === best)));
  h.log('best', JSON.stringify(best));
  await h.ev((m) => { const T = globalThis.__mikdash.time; T.set(T.parse(`sunrise+${m}`)); }, best[0]);
  await h.wait(5000);
  const { resolve } = await import('node:path');
  const p = await h.ev(() => {
    const c = globalThis.__mikdash, nv = c.movables.get('heichal.nivreshet');
    const v = new (c.camera.position.constructor)();
    nv.getWorldPosition(v);
    v.project(c.camera);
    return [(v.x * 0.5 + 0.5) * innerWidth, (1 - (v.y * 0.5 + 0.5)) * innerHeight];
  });
  const clip = { x: Math.max(0, Math.round(p[0] - 120)), y: Math.max(0, Math.round(p[1] - 80)), width: 240, height: 160 };
  await h.shot(`nivreshet-best-${h.q}${process.env.TAG ? `-${process.env.TAG}` : ''}`);
  await h.page.screenshot({ path: resolve(h.out, `nivreshet-best-${h.q}${process.env.TAG ? `-${process.env.TAG}` : ''}-crop.png`), clip });
  h.log('screen', JSON.stringify(p));
}
