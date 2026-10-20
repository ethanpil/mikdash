// render-env-2: does the nivreshet flash (a) when its highlight is not widened by three's geometry roughness (runtime
// patch of lights_physical_fragment behind a define on its material only), (b) with its material's maps dropped
// (plain roughness 0.06, no normal / roughness map)? Court view at the flash moment. Dev only.
//   T=sunrise+18 node src/render/dev/session.mjs src/render/dev/niv-spark.mjs --q high --out shots/render-env-2/wip
export default async function (h) {
  const t = process.env.T || 'sunrise+18';
  await h.ev((t) => { const c = globalThis.__mikdash, T = c.time; T.pause(true); T.set(T.parse(t)); c.player.setMode('walk'); c.player.teleport({ at: [210, 345] }); c.player.setLook(252, 28); }, t);
  await h.wait(6000);
  const { resolve } = await import('node:path');
  for (const mode of ['base', 'sharp', 'plain']) {
    const s = await h.ev(async (mode) => {
      const c = globalThis.__mikdash, THREE = await import('/node_modules/.vite/deps/three.js');
      let mesh = null;
      c.scene.traverse((o) => { if (o.name === 'heichal:nivreshet') mesh = o; });
      if (!mesh) return { none: true };
      if (mode === 'sharp') {
        const SC = THREE.ShaderChunk, a = 'material.roughness += geometryRoughness;';
        if (!SC.lights_physical_fragment.includes('MK_SHARP_SPEC')) SC.lights_physical_fragment = SC.lights_physical_fragment.replace(a, `\n#ifndef MK_SHARP_SPEC\n${a}\n#endif\n`);
        const m = mesh.material;
        m.defines = { ...(m.defines || {}), MK_SHARP_SPEC: '' };
        m.needsUpdate = true;
      }
      if (mode === 'plain') {
        const m = mesh.material;
        m.roughnessMap = null; m.normalMap = null; m.bumpMap = null; m.roughness = 0.06;
        m.needsUpdate = true;
      }
      const p = new THREE.Vector3();
      mesh.getWorldPosition(p);
      const sp = p.clone().project(c.camera);
      return { mode, roughness: mesh.material.roughness, name: mesh.material.name, screen: [Math.round((sp.x * 0.5 + 0.5) * innerWidth), Math.round((1 - (sp.y * 0.5 + 0.5)) * innerHeight)] };
    }, mode);
    await h.wait(2500);
    const f = await h.shot(`niv-spark-${h.q}-${mode}`);
    await h.page.screenshot({ path: resolve(h.out, `niv-spark-${h.q}-${mode}-crop.png`), clip: { x: Math.max(0, s.screen[0] - 80), y: Math.max(0, s.screen[1] - 60), width: 160, height: 120 } });
    h.log(JSON.stringify(s), f);
  }
}
