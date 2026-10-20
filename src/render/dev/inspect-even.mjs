// render-env-2: the Even Shetiyah's material and the KhK's light at it (dev only)
export default async function (h) {
  await h.ev(() => { const T = globalThis.__mikdash.time; T.pause(true); T.set(T.parse('d3')); });
  await h.ev(() => { const c = globalThis.__mikdash; c.player.teleport({ at: [104, 331.5] }); c.player.setLook(262, -30); });
  await h.wait(4000);
  const r = await h.ev(() => {
    const c = globalThis.__mikdash, out = [];
    c.scene.traverse((o) => {
      const m = o.material;
      if (!o.isMesh || !m || Array.isArray(m)) return;
      if (/bedrock/i.test(m.name || '') || /even/i.test(o.name || '')) {
        o.geometry.computeBoundingBox();
        out.push({ obj: o.name, mat: m.name, color: m.color?.getHexString(), rough: m.roughness, metal: m.metalness, envI: m.envMapIntensity, map: !!m.map, aoMap: !!m.aoMap, vc: m.vertexColors, bb: o.geometry.boundingBox?.min.toArray().map((x) => +x.toFixed(2)).concat(o.geometry.boundingBox?.max.toArray().map((x) => +x.toFixed(2))) });
      }
    });
    const I = c.env.interiors, A = c.units.AMAH;
    const p = { x: 98 * A, y: 22.1 * A, z: -330.5 * A };
    const at = I.at(p);
    return { meshes: out.slice(0, 8), V: at.V, vol: at.vol?.id, s: at.s, gain: I.roomGain(at.vol), envI: c.scene.environmentIntensity };
  });
  h.log(JSON.stringify(r, null, 1));
}
