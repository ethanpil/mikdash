// render-env-2-fix diagnostics (dev only): STEPS=niches,kitchen node src/render/dev/session.mjs src/render/dev/diag-fix.mjs --q high
const STEPS = {
  // the chrome-like smear on the north wing's end wall above the knife niches: what is there, and with the Ulam probe off
  async niches(h) {
    await h.ev(() => { const T = globalThis.__mikdash.time; T.pause(true); T.set(T.parse('d3')); });
    await h.ev(() => { const c = globalThis.__mikdash; c.player.setMode('walk'); c.player.teleport({ at: [168, 368] }); c.player.setLook(0, 10); });
    await h.wait(4000);
    await h.shot(`niches-${h.q}-diag`);
    const r = await h.ev(async () => {
      const c = globalThis.__mikdash;
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const rc = new THREE.Raycaster();
      const out = [];
      for (const [px, py] of [[650, 200], [650, 400], [300, 200]]) {
        rc.setFromCamera(new THREE.Vector2(px / 640 - 1, 1 - py / 360), c.camera);
        const x = rc.intersectObjects(c.world.children, true)[0];
        if (!x) { out.push(null); continue; }
        const m = Array.isArray(x.object.material) ? x.object.material[0] : x.object.material;
        const ins = c.env.interiors.at(x.point);
        out.push({ px: [px, py], obj: x.object.name, mat: m?.name || m?.userData?.matKey, key: m?.userData?.matKey, rough: m?.roughness, rmap: !!m?.roughnessMap, metal: m?.metalness, site: [x.point.x / c.units.AMAH, -x.point.z / c.units.AMAH, x.point.y / c.units.AMAH].map((v) => +v.toFixed(2)), vol: ins.vol?.id, s: +ins.s.toFixed(2) });
      }
      return out;
    });
    h.log('pick', JSON.stringify(r));
    // the wall's own gloss: the material's roughness × 2.5 (the map's roughness is multiplied by this scalar)
    const rough = await h.ev(async () => {
      const c = globalThis.__mikdash;
      let m = null;
      c.scene.traverse((o) => { if (!m && o.material?.userData?.matKey === 'herodian_wall_inner') m = o.material; });
      if (!m) return null;
      const before = m.roughness;
      // what the map holds: read the roughness map's texels (G channel) when it is a plain texture
      let stats = null;
      try {
        const img = m.roughnessMap?.image;
        if (img && (img instanceof ImageBitmap || img instanceof HTMLCanvasElement || img instanceof HTMLImageElement)) {
          const cv = new OffscreenCanvas(img.width, img.height), g = cv.getContext('2d'); g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, img.width, img.height).data; let s = 0, lo = 255, hi = 0;
          for (let i = 1; i < d.length; i += 4) { s += d[i]; lo = Math.min(lo, d[i]); hi = Math.max(hi, d[i]); }
          stats = { mean: s / (d.length / 4) / 255, lo: lo / 255, hi: hi / 255 };
        } else stats = { type: m.roughnessMap?.constructor?.name, rt: !!m.roughnessMap?.isRenderTargetTexture };
      } catch (e) { stats = { error: String(e) }; }
      m.roughness = before * 2.5;
      globalThis.__roughM = [m, before];
      return { before, stats };
    });
    h.log('rough', JSON.stringify(rough));
    await h.wait(1500);
    await h.shot(`niches-${h.q}-rough25`);
    await h.ev(() => { const [m, b] = globalThis.__roughM || []; if (m) m.roughness = b; });
    await h.ev(() => { const c = globalThis.__mikdash; const p = c.env.probes?.probes.find((q) => q.id === 'ulam'); if (p) { globalThis.__ulamValid = p.valid; p.valid = false; } });
    await h.wait(1500);
    await h.shot(`niches-${h.q}-noulam`);
    await h.ev(() => { const c = globalThis.__mikdash; const p = c.env.probes?.probes.find((q) => q.id === 'ulam'); if (p) p.valid = globalThis.__ulamValid; });
  },
  // the nivreshet's sun glint (fx/glint.js) through the morning, from the court: stats + a crop round the globe
  async glint(h) {
    const at = (process.env.GLINT_AT || '210,345').split(',').map(Number);
    const look = (process.env.GLINT_LOOK || '252,28').split(',').map(Number);
    for (const m of (process.env.GLINT_T || '6,10,14,18,22,26,30,40').split(',')) {
      await h.ev(([t, a, l]) => {
        const c = globalThis.__mikdash, T = c.time; T.pause(true); T.set(T.parse(`sunrise+${t}`));
        c.player.setMode('walk'); c.player.teleport({ at: a }); c.player.setLook(l[0], l[1]);
      }, [m, at, look]);
      await h.wait(2500);
      const s = await h.ev(async () => {
        const c = globalThis.__mikdash, THREE = await import('/node_modules/.vite/deps/three.js');
        const piv = c.movables.get('heichal.nivreshet'), g = piv?.children?.[0];
        const p = new THREE.Vector3(); g?.getWorldPosition(p);
        const v = p.clone().project(c.camera);
        const sun = c.time.sun;
        return { sunAlt: +sun.altitude.toFixed(2), sunAz: +sun.azimuth.toFixed(1), beam: +(c.env.sunBeam || 0).toPrecision(3), glint: c.fx.stats.glint, px: [Math.round((v.x + 1) * 640), Math.round((1 - v.y) * 360)], hz: +c.env.horizonElevation(sun.azimuth, p.y).toFixed(2) };
      });
      h.log(`glint sunrise+${m}`, JSON.stringify(s));
      const [x, y] = s.px;
      const { resolve } = await import('node:path');
      if (x > 0 && x < 1280 && y > 0 && y < 720) await h.page.screenshot({ path: resolve(h.out, `glint-${h.q}-sr${m}.png`), clip: { x: Math.max(0, x - 120), y: Math.max(0, y - 80), width: 240, height: 160 } });
    }
    await h.shot(`glint-${h.q}-full`);
    // where the sparks land: projected positions, and one shot with them × 50
    const sp = await h.ev(async () => {
      const c = globalThis.__mikdash, THREE = await import('/node_modules/.vite/deps/three.js');
      let m = null;
      c.fx.scene.traverse((o) => { if (o.name === 'fx:glint') m = o; });
      if (!m) return { error: 'no glint mesh' };
      const g = m.geometry, P = g.getAttribute('iPos'), C = g.getAttribute('iCol');
      const out = [];
      for (let i = 0; i < g.instanceCount; i++) {
        const v = new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)).project(c.camera);
        out.push({ px: [Math.round((v.x + 1) * 640), Math.round((1 - v.y) * 360)], z: +v.z.toFixed(4), L: +C.getY(i).toFixed(2) });
      }
      globalThis.__glintBoost = true;
      const u = m.material.uniforms.uGlint.value;
      return { visible: m.visible, count: g.instanceCount, uGlint: [u.x, u.y, u.z, u.w], sparks: out, res: c.fx.materials.shared.uResolution.value.toArray() };
    });
    h.log('sparks', JSON.stringify(sp));
    // the sprite's own contribution: two screenshots of the globe, the glint mesh shown / hidden (fx update keeps it on:
    // its material's opacity path is cut instead by zeroing the instance count right before the frame)
    const { resolve } = await import('node:path');
    const clip = { x: sp.sparks[0].px[0] - 30, y: sp.sparks[0].px[1] - 30, width: 60, height: 60 };
    await h.page.screenshot({ path: resolve(h.out, `glint-${h.q}-on.png`), clip });
    await h.ev(() => { const c = globalThis.__mikdash; let m = null; c.fx.scene.traverse((o) => { if (o.name === 'fx:glint') m = o; }); m.onBeforeRender = () => { m.geometry.instanceCount = 0; }; });
    await h.wait(1500);
    await h.page.screenshot({ path: resolve(h.out, `glint-${h.q}-off.png`), clip });
    const diff = await h.page.evaluate(async ([a, b]) => {
      const load = async (s) => { const im = new Image(); im.src = `data:image/png;base64,${s}`; await im.decode(); const cv = new OffscreenCanvas(im.width, im.height), g = cv.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
      const A = await load(a), B = await load(b);
      let mx = 0, sum = 0;
      for (let i = 0; i < A.length; i += 4) { const d = (A[i] + A[i + 1] + A[i + 2]) - (B[i] + B[i + 1] + B[i + 2]); mx = Math.max(mx, d); sum += Math.max(d, 0); }
      return { maxDiff: mx, sumDiff: sum };
    }, [(await import('node:fs')).readFileSync(resolve(h.out, `glint-${h.q}-on.png`)).toString('base64'), (await import('node:fs')).readFileSync(resolve(h.out, `glint-${h.q}-off.png`)).toString('base64')]);
    h.log('glint on-off', JSON.stringify(diff));
  },
  // the kitchen hearth's shadow slot (high): stones and pot casting from the fire under the cauldron
  async kitchen(h) {
    await h.ev(() => { const T = globalThis.__mikdash.time; T.pause(true); T.set(T.parse('n3')); });
    for (const [tag, near] of [['', null]]) {
      const s = await h.ev(() => {
        const c = globalThis.__mikdash, A = c.units.AMAH;
        c.fx.setFire('altar.kitchen.fire', 1);
        // the great pile holds high's one shadow slot from anywhere near the altar: out for this test (the sim tends the
        // piles through setFire: hold them at 0)
        if (!c.fx.__setFire) { c.fx.__setFire = c.fx.setFire; c.fx.setFire = (id, v) => c.fx.__setFire(id, /maarachah\.(great|kiyum|incense)/.test(id) ? 0 : id === 'altar.kitchen.fire' ? 1 : v); }
        for (const id of ['altar.maarachah.great', 'altar.maarachah.great.inner', 'altar.maarachah.kiyum', 'altar.maarachah.incense']) c.fx.remove(id); // the sim tends them: out of fx for the test
        c.fx.setFire('altar.kitchen.fire', 1);
        const f = c.fx.fires.get('altar.kitchen.fire');
        const X = f.pos.x / A, Y = -f.pos.z / A, Z = f.pos.y / A;
        c.player.setMode('fly'); c.player.teleport({ pos: [X + 3.2, Y + 1.2, Z + 2.6] }); c.player.setLook(250, -30);
        return [X, Y, Z];
      });
      await h.wait(9000);
      const st = await h.ev(() => {
        const c = globalThis.__mikdash;
        const kf = c.fx.fires.get('altar.kitchen.fire');
        return `kitchen cur ${kf?.cur?.toFixed(2)} size ${kf?.size} | ` + c.fx.pointLights().slice(0, 3).map((l) => `${l.name}:${l.userData.shadowOwner || '-'}:${l.intensity.toExponential(1)}:near ${l.shadow?.camera?.near}:nb ${l.shadow?.normalBias}`).join(' | ');
      });
      h.log('kitchen', JSON.stringify(s), st);
      await h.shot(`kitchen-${h.q}${tag}`);
    }
  },
};
export default async function (h) {
  for (const name of (process.env.STEPS || 'niches').split(',')) {
    if (!STEPS[name]) { h.log(`unknown step ${name}`); continue; }
    await STEPS[name](h);
  }
}
