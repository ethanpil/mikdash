// perf-1: lit materials drawn by both plain and instanced meshes (each such material compiles two programs), with the
// meshes on each side.   node src/render/dev/session.mjs src/render/dev/variant-users.mjs --q low --out shots/perf-1/wip
export default async function (h) {
  const r = await h.ev(() => {
    const c = globalThis.__mikdash;
    const byMat = new Map();
    c.scene.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m?.isMeshStandardMaterial) continue;
        const key = `${m.customProgramCacheKey?.() || ''}|${m.name}`;
        const e = byMat.get(key) || { P: [], I: [] };
        let p = o, path = [];
        while (p && path.length < 4) { if (p.name) path.push(p.name); p = p.parent; }
        e[o.isInstancedMesh ? 'I' : 'P'].push(`${path.join(' < ').slice(0, 90)}${o.isInstancedMesh ? ` (n=${o.count})` : ''}`);
        byMat.set(key, e);
      }
    });
    return [...byMat].filter(([, e]) => e.P.length && e.I.length).map(([k, e]) => ({ k, P: e.P.slice(0, 12), nP: e.P.length, I: e.I.slice(0, 6), nI: e.I.length }));
  });
  for (const e of r) {
    h.log(`${e.k}  plain ${e.nP}  inst ${e.nI}`);
    for (const u of e.P) h.log('   P', u);
    for (const u of e.I) h.log('   I', u);
  }
}
