// perf-1: what a depth pre-pass would save (low tier, direct rendering): GPU time of the frame as is vs depth-only world
// pass first (opaque, non-alpha-tested, single-sided-or-not lit meshes), then the normal frame with depth kept.
//   node src/render/dev/session.mjs src/render/dev/prepass-ab.mjs --q low --query "..."
export default async function (h) {
  await h.wait(+(process.env.SETTLE || 8000));
  for (const v of (process.env.VARS || 'full,prepass,full,prepass').split(',')) {
    const r = await h.ev(async (v) => {
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const c = globalThis.__mikdash, e = c.engine, R = c.renderer, gl = R.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const dm = globalThis.__ppMat ||= new THREE.MeshDepthMaterial();
      const rf = e.renderFn;
      let pre = null;
      if (v === 'prepass') {
        const list = [];
        c.world.traverse((o) => { if (o.isMesh && o.visible && o.material?.isMeshStandardMaterial && !o.material.alphaTest && !o.material.transparent) list.push(o); });
        const s = new THREE.Scene();
        pre = () => {
          // draw the opaque world into depth only, then let the frame's own render() keep that depth
          const parents = list.map((o) => o.parent);
          const prevAuto = R.autoClear;
          R.setRenderTarget(null);
          R.clear(true, true, false);
          gl.colorMask(false, false, false, false);
          const st = R.state; st.buffers.color.setMask(false); st.buffers.color.setLocked(true);
          s.overrideMaterial = dm;
          for (const o of list) { s.children.push(o); }
          R.autoClear = false;
          R.render(s, c.camera);
          s.children.length = 0;
          st.buffers.color.setLocked(false); st.buffers.color.setMask(true);
          R.autoClear = prevAuto;
          return parents;
        };
      }
      const gpu = [];
      let busy = false;
      const origClear = c.post.pipeline.render.bind(c.post.pipeline);
      e.renderFn = (dt) => {
        let q = null;
        if (!busy) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); busy = true; }
        if (pre) {
          // run pipeline.render without its clear: patch renderer.render's autoClear for the first scene draw
          const p = c.post.pipeline;
          const keep = p.render;
          p.render = function () {
            pre();
            const { renderer: r, scene, camera } = c;
            r.autoClear = false;
            r.clear(true, false, false);
            r.render(scene, camera);
            r.render(c.fx.scene, camera);
            r.autoClear = true;
          };
          rf(dt);
          p.render = keep;
        } else rf(dt);
        if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); busy = false; } else setTimeout(poll, 4); }; setTimeout(poll, 4); }
      };
      await new Promise((r) => setTimeout(r, 3000));
      gpu.sort((a, b) => a - b);
      const out = { v, gpuMs: +gpu[gpu.length >> 1].toFixed(1), n: gpu.length };
      if (v === 'prepass') { await new Promise((r) => setTimeout(r, 100)); }
      globalThis.__ppKeep = e.renderFn;
      if (v !== 'prepass') e.renderFn = rf; else globalThis.__ppRestore = rf;
      return out;
    }, v);
    h.log(JSON.stringify(r));
    if (r.v === 'prepass') {
      await h.shot(`prepass-${h.q}`);
      await h.ev(() => { const e = globalThis.__mikdash.engine; e.renderFn = globalThis.__ppRestore; });
      await h.wait(500);
      await h.shot(`noprepass-${h.q}`);
    }
  }
}
