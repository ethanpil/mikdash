// perf-fix-1: medium's key-light shadow cache (render/shadow-cache.js) in motion. (1) static re-renders while the view
// is still, turns and walks (env's framing hold); (2) a world group moved after the cache was built: frames with the
// cache and without it must match (shots <out>/after-medium/moved.png and <out>/head-medium/moved.png).
//   node src/render/dev/session.mjs src/render/dev/shadowcache-check.mjs --q medium --out shots/perf-fix-1/scc --query "…"
export default async function (h) {
  await h.wait(+(process.env.SETTLE || 6000));
  const frames = (n) => h.ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const statics = () => h.ev(() => globalThis.__mikdash.post.shadowCache?.stats.statics ?? -1);
  let s = await statics();
  await frames(30);
  h.log('still 30 frames: static re-renders', (await statics()) - s);
  s = await statics();
  // turn the view 90° over 45 frames, then walk 12 m forward over 60 frames
  const moved = await h.ev(async () => {
    const c = globalThis.__mikdash, pl = c.player;
    const step = () => new Promise((r) => requestAnimationFrame(r));
    const out = { turn: 0, walk: 0 };
    let k0 = c.post.shadowCache.stats.statics;
    const h0 = pl.heading;
    for (let i = 0; i < 45; i++) { pl.setLook(h0 + 2 * (i + 1), null); await step(); }
    out.turn = c.post.shadowCache.stats.statics - k0;
    k0 = c.post.shadowCache.stats.statics;
    const fwd = c.camera.getWorldDirection(c.camera.position.clone()).setY(0).normalize();
    const feet = pl.position.clone();
    for (let i = 0; i < 60; i++) { feet.addScaledVector(fwd, 0.2); pl.teleport(feet.clone()); await step(); }
    out.walk = c.post.shadowCache.stats.statics - k0;
    return out;
  });
  h.log('turn 90° (45 frames) / walk 12 m (60 frames): static re-renders', JSON.stringify(moved));
  // back to the query's view; move the world group nearest the camera 1.5 m east; with and without the cache
  await h.page.reload({ waitUntil: 'load' });
  await h.page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 480000, polling: 250 });
  await h.wait(3000);
  const name = await h.ev(() => {
    const c = globalThis.__mikdash;
    const g = c.world.children.find((o) => /courts/i.test(o.name)) || c.world.children[0];
    g.position.x += 1.5; g.updateMatrixWorld(true);
    return g.name;
  });
  await frames(5);
  h.log('moved', name, 'static re-renders so far', await statics());
  const shoot = async (dir) => { const { mkdirSync, renameSync } = await import('node:fs'); const { dirname, join } = await import('node:path'); const f = await h.shot('moved'); const d = join(dirname(f), dir); mkdirSync(d, { recursive: true }); renameSync(f, join(d, 'moved.png')); };
  await shoot('after-medium');
  await h.ev(() => { globalThis.__mikdash.post.shadowCache.enabled = false; });
  await frames(5);
  await shoot('head-medium');
  // the same state with the cache again (head-low vs after-low: the noise between two frames of the same setting)
  await h.ev(() => { globalThis.__mikdash.post.shadowCache.enabled = true; });
  await frames(5);
  h.log('static re-renders at the end', await statics());
  await shoot('after-low');
  await (async () => { const { copyFileSync, mkdirSync } = await import('node:fs'); const { join, resolve } = await import('node:path'); const d = resolve(h.out); mkdirSync(join(d, 'head-low'), { recursive: true }); copyFileSync(join(d, 'after-medium', 'moved.png'), join(d, 'head-low', 'moved.png')); })();
}
