// In-page A/B of shader-text variants of the interior patch (string edits on the patched chunk; recompiles via a define)
const VARIANTS = {
  stock: null,
  full: [],
  noSetup: [[/  mkP = mkIntP;\n  mkQ = mkIntQ;/, '  mkP = mkIntP;\n  mkQ = mkIntQ;\n  return;']],
};
export default async function (h) {
  const order = (process.env.VARS || 'full,stock,cheapAp,noRay,fetch1,full,stock').split(',');
  for (const name of order) {
    const r = await h.ev(async ([name, edits, k]) => {
      const c = globalThis.__mikdash, gl = c.renderer.getContext();
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const mod = await import('/src/env/interiors-glsl.js');
      const SC = THREE.ShaderChunk;
      if (!globalThis.__mkBase) { mod.setInteriorStage(SC, 3); globalThis.__mkBase = SC.envmap_physical_pars_fragment; }
      if (edits === null) mod.setInteriorStage(SC, 0); else {
        mod.setInteriorStage(SC, 3);
        let t = globalThis.__mkBase;
        for (const [re, rep] of edits) { const r2 = new RegExp(re.source, re.flags); if (!r2.test(t)) return { name, error: 'pattern ' + re.source.slice(0, 40) }; t = t.replace(r2, rep); }
        SC.envmap_physical_pars_fragment = t;
      }
      c.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (m.isMeshStandardMaterial) m.defines = { ...(m.defines || {}), MK_VAR: String(k) }; m.needsUpdate = true; } });
      for (let i = 0; i < 40; i++) await new Promise((res) => requestAnimationFrame(res));
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      c.engine.stop();
      const res = [];
      for (let i = 0; i < 14; i++) {
        for (const u of c.engine.updaters) u.fn(1 / 60, c);
        const q = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q); c.engine.renderFn(1 / 60); gl.endQuery(ext.TIME_ELAPSED_EXT);
        await new Promise((ok) => { const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ok(); else setTimeout(poll, 4); }; poll(); });
        res.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q);
      }
      c.engine.start(c);
      res.sort((a, b) => a - b);
      return { name, min: +res[0].toFixed(1), q1: +res[3].toFixed(1), median: +res[7].toFixed(1) };
    }, [name, VARIANTS[name] ? VARIANTS[name].map(([re, rep]) => [{ source: re.source, flags: re.flags }, rep]) : VARIANTS[name], Math.random().toString(36).slice(2, 7)]);
    h.log(JSON.stringify(r));
  }
}
