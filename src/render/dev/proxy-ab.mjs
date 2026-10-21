// render-audio-3: the terrain's shadow proxy by its back faces (new) vs front + back faces (render-env-2's override, old:
// emulated by setting the proxy material's shadowSide to DoubleSide) at several views, in one boot.
//   VIEWS="olive|924,197|90,4|d3;kidron|640,250|270,-2|sunrise+20" node src/render/dev/session.mjs src/render/dev/proxy-ab.mjs --q high --out shots/render-audio-3/wip
export default async function (h) {
  const views = (process.env.VIEWS || 'olive|924,197|90,4|d3').split(';').map((s) => { const [name, at, look, t] = s.split('|'); return { name, at: at.split(',').map(Number), look: look.split(',').map(Number), t }; });
  const { resolve } = await import('node:path');
  for (const v of views) {
    await h.ev((v) => { const c = globalThis.__mikdash; c.time.pause(true); c.time.set(c.time.parse(v.t)); c.player.teleport({ at: v.at }); c.player.setLook(v.look[0], v.look[1]); }, v);
    await h.wait(5000);
    for (const mode of ['new', 'old']) {
      await h.ev((old) => {
        const c = globalThis.__mikdash;
        c.scene.traverse((o) => { if (o.name === 'terrain:shadow-proxy') o.material.shadowSide = old ? 2 : null; });
        const sh = c.post.shadows?.light?.shadow; if (sh) sh.needsUpdate = true;
        if (c.env.sunLight?.shadow) c.env.sunLight.shadow.needsUpdate = true;
      }, mode === 'old');
      await h.wait(1500);
      const f = resolve(h.out, `proxy-${v.name}-${h.q}-${mode}.png`);
      await h.page.screenshot({ path: f });
      h.log(v.name, mode, f);
    }
    await h.ev(() => globalThis.__mikdash.scene.traverse((o) => { if (o.name === 'terrain:shadow-proxy') o.material.shadowSide = null; }));
  }
}
