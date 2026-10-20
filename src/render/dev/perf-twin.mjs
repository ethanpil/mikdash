// render-env-2-fix: frame-interleaved A/B of two shader variants of the interior patch (dev only). Both variants are
// compiled at once — the patched chunks become `#ifdef MK_VAR_B <B> #else <A> #endif` and every lit material gets a
// twin with MK_VAR_B defined — and every mesh swaps to its twin on alternate frames, so contention from other
// processes on a shared GPU hits A and B alike (sequential runs swung by 30 ms on the HD 4600 here).
//   VIEWS=court,kodesh B=old node src/render/dev/session.mjs src/render/dev/perf-twin.mjs --q medium --query fixedres=1
// A: the current chunks (or A=<variant>); B: 'old' (src/render/dev/old-interiors-glsl.js), 'stock', or a perf-ab variant.
import { VARIANTS } from './perf-ab.mjs';
const VIEWS = { court: [[238, 385], [200, 0]], facade: [[200, 300], [300, 15]], kodesh: [[136, 330.5], [270, 5]], altar: [[190, 360], [140, 6]], khk: [[113, 333], [250, -6]], mount: [[300, 250], [250, 5]] };
export default async function (h) {
  const views = (process.env.VIEWS || 'court,kodesh').split(',');
  const A = process.env.A || 'full', B = process.env.B || 'old';
  const N = +(process.env.PAIRS || 60);
  await h.ev((t) => { const T = globalThis.__mikdash.time; T.pause(true); T.set(T.parse(t)); }, process.env.T || 'n3');
  const setup = await h.ev(async ([A, B, VA, VB]) => {
    const c = globalThis.__mikdash;
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const mod = await import('/src/env/interiors-glsl.js');
    const SC = THREE.ShaderChunk;
    const KEYS = ['envmap_physical_pars_fragment', 'lights_fragment_begin', 'lights_fragment_maps', 'clipping_planes_fragment'];
    mod.setInteriorStage(SC, 3);
    const base = Object.fromEntries(KEYS.map((k) => [k, SC[k]]));
    // 'early': the room setup at the start of main() (clipping_planes_fragment follows diffuseColor's declaration in
    // every lit material), with the flat geometric normal and the material's base roughness
    if (A === 'early' || B === 'early') {
      const call = 'mkSetup( - vViewPosition, nonPerturbedNormal, normal, material.roughness );';
      if (!base.lights_fragment_begin.includes(call)) throw new Error('mkSetup call not found');
    }
    mod.setInteriorStage(SC, 0);
    const stock = Object.fromEntries(KEYS.map((k) => [k, SC[k]]));
    const make = async (name, edits) => {
      if (name === 'stock') return stock;
      if (name === 'old') {
        const fake = Object.fromEntries(Object.keys(SC).filter((k) => !k.startsWith('__')).map((k) => [k, SC[k]]));
        for (const k of KEYS) fake[k] = stock[k];
        const old = await import('/src/render/dev/old-interiors-glsl.js');
        const I = c.env.interiors;
        old.installInteriorChunks(fake, { probes: !!c.env.probes, origin: [I.origin.x, I.origin.y, I.origin.z], records: I.records });
        return Object.fromEntries(KEYS.map((k) => [k, fake[k]]));
      }
      const out = { ...base };
      if (name === 'early') {
        out.lights_fragment_begin = out.lights_fragment_begin.replace('mkSetup( - vViewPosition, nonPerturbedNormal, normal, material.roughness );', '');
        out.clipping_planes_fragment = `${out.clipping_planes_fragment}
#ifdef MK_INT
  { vec3 mkGn = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) ); mkSetup( - vViewPosition, mkGn, mkGn, roughness ); }
#endif
`;
      }
      for (const [k, src, rep] of edits || []) { const re = new RegExp(src); if (!re.test(out[k])) throw new Error(`pattern ${src.slice(0, 40)}`); out[k] = out[k].replace(re, rep); }
      return out;
    };
    const a = await make(A, VA), b = await make(B, VB);
    for (const k of KEYS) SC[k] = `#ifdef MK_VAR_B\n${b[k]}\n#else\n${a[k]}\n#endif\n`;
    // twins
    const pairs = [];
    const twinOf = new Map();
    c.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (!ms.some((m) => m.isMeshStandardMaterial)) return;
      const tw = ms.map((m) => {
        if (!m.isMeshStandardMaterial) return m;
        let t = twinOf.get(m);
        if (!t) {
          t = m.clone();
          t.onBeforeCompile = m.onBeforeCompile;
          t.customProgramCacheKey = m.customProgramCacheKey;
          t.defines = { ...(m.defines || {}), MK_VAR_B: '' };
          m.needsUpdate = true;
          twinOf.set(m, t);
        }
        return t;
      });
      pairs.push([o, o.material, Array.isArray(o.material) ? tw : tw[0]]);
    });
    globalThis.__twin = pairs;
    return { pairs: pairs.length, materials: twinOf.size };
  }, [A, B, VARIANTS[A] && VARIANTS[A] !== 'old' ? VARIANTS[A] : null, VARIANTS[B] && VARIANTS[B] !== 'old' ? VARIANTS[B] : null]);
  h.log('twins', JSON.stringify(setup));
  for (const view of views) {
    const [at, look] = VIEWS[view];
    await h.ev(([a, l]) => { const c = globalThis.__mikdash; c.player.setMode('walk'); c.player.teleport({ at: a }); c.player.setLook(l[0], l[1]); }, [at, look]);
    await h.wait(2500);
    const r = await h.ev(async (N) => {
      const c = globalThis.__mikdash, gl = c.renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const use = (b) => { for (const [o, ma, mb] of globalThis.__twin) o.material = b ? mb : ma; };
      // compile both (a few frames each)
      for (const b of [0, 1, 0, 1]) { use(b); for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res)); }
      c.engine.stop();
      const t = [[], []];
      for (let i = 0; i < N; i++) {
        for (const b of i % 2 ? [1, 0] : [0, 1]) {
          use(b);
          for (const u of c.engine.updaters) u.fn(1 / 60, c);
          const q = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, q); c.engine.renderFn(1 / 60); gl.endQuery(ext.TIME_ELAPSED_EXT);
          await new Promise((ok) => { const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ok(); else setTimeout(poll, 2); }; poll(); });
          if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) t[b].push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(q);
        }
      }
      use(0);
      c.engine.start(c);
      const st = (a) => { a.sort((x, y) => x - y); return [a[0], a[a.length >> 3], a[a.length >> 2], a[a.length >> 1]].map((x) => +x.toFixed(1)); };
      return { A: st(t[0]), B: st(t[1]) };
    }, N);
    h.log(view, `${A}: ${r.A.join('/')}   ${B}: ${r.B.join('/')}   (min / p12 / p25 / median ms)`);
  }
}
