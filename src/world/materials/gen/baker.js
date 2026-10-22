// GPU texture baker. Each texture set's generator renders into a scratch target (one packed texel: albedo /
// height / AO-roughness-metalness); a finish pass derives the tangent-space normal (Sobel on 16-bit height) and
// cavity AO into the set's own mipmapped render target:
//   textures[0] albedo  RGBA8 sRGB (alpha = block-local distance / cut-out / glow mask / 1)
//   textures[1] normal  RG8 (three reconstructs z: USE_PACKED_NORMALMAP)
//   textures[2] ORM     RG8 (AO, roughness) or RGBA8 (AO, roughness, metalness) for metal sets
// Detail sets bake one RGBA8 (normal.xy, albedo mod, roughness mod). Blend-layer sets (`pack: 'blend'`, the
// terrain_blend layers) bake two RGBA8: (albedo sRGB, height) and (normal.xy, roughness, AO).
// A set with `rotOf` is a view of another set (the material swaps its UVs): nothing is baked for it.
//
// Generators sample CPU-made periodic basis maps (gen/basis.js). Sets bake lazily, the first time a material that
// needs them is requested.
// materials-2-fix — progressive start: start(boot, later) builds the basis on the main thread, then compiles only the
// `boot` kinds (resolves whenReady). The `later` kinds' sets are allocated when requested — the materials hold their
// final textures from the start, pre-cleared to a flat look — and bake when their group has compiled (bakeGroup).
import {
  Mesh, Scene, OrthographicCamera, PlaneGeometry, RawShaderMaterial, GLSL3, WebGLRenderTarget, DataTexture,
  RGBAFormat, RGFormat, RGBAIntegerFormat, UnsignedByteType, UnsignedIntType, FloatType, SRGBColorSpace, NoColorSpace, LinearFilter,
  LinearMipmapLinearFilter, NearestFilter, RepeatWrapping, ClampToEdgeWrapping, Vector2, Vector4, Color,
} from 'three';
import { VERTEX, HEADER, LIB, MAIN, FINISH } from './glsl.js';
import { KINDS, KIND_PRELUDE } from './kinds.js';
import { SETS } from './sets.js';
import { masonryLayout } from './layout.js';
import { makeBasis } from './basis.js';

const genUniforms = () => ({
  uTile: { value: new Vector2(1, 1) },
  uRes: { value: new Vector2(1, 1) },
  uSeed: { value: 1 },
  uHRange: { value: 0.01 },
  uP0: { value: new Vector4() },
  uP1: { value: new Vector4() },
  uP2: { value: new Vector4() },
  uP3: { value: new Vector4() },
  uC0: { value: new Color() },
  uC1: { value: new Color() },
  uC2: { value: new Color() },
  uC3: { value: new Color() },
  uC4: { value: new Color() },
  uC5: { value: new Color() },
  uC6: { value: new Color() },
  tN: { value: null },
  tV: { value: null },
  tW: { value: null },
  tL: { value: null },
  tC: { value: null },
  uRows: { value: 1 },
  uCourses: { value: 0 },
  uRowH: { value: 1 },
  uDMax: { value: 1 },
  uQ: { value: 1 },
});

// Float32 data stored as RGBA16F (the driver converts on upload; half the memory of RGBA32F, filterable)
function halfTexture(data, size, mips) {
  const t = new DataTexture(data, size, size, RGBAFormat, FloatType);
  t.internalFormat = 'RGBA16F';
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = mips ? LinearMipmapLinearFilter : LinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = mips;
  t.colorSpace = NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export class Baker {
  /** @param {import('three').WebGLRenderer} renderer */
  constructor(renderer, { textureSize = 1024, anisotropy = 4 } = {}) {
    this.renderer = renderer;
    this.textureSize = textureSize;
    this.anisotropy = anisotropy;
    this.geo = new PlaneGeometry(2, 2);
    this.mesh = new Mesh(this.geo);
    this.mesh.frustumCulled = false;
    this.scene = new Scene();
    this.scene.add(this.mesh);
    this.cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mats = new Map();     // kind -> generator material
    this.finishMats = {};      // 'full' | 'detail' -> material
    this.scratch = null;
    this.layouts = new Map();  // set id -> { layout, tex, ctex }
    this.baked = new Map();    // set id -> result
    this.basis = null;         // { noise, vor16, vor5 } DataTextures
    this.compiledKinds = new Set();
    this.pending = new Map();  // set id -> allocated result awaiting its bake (a `later` kind not compiled yet)
    this.waiting = new Set();  // `later` kinds not compiled yet
    this.groups = [];          // `later` kinds in priority groups
    this.flatFor = null;       // (set id) -> [albedo Color (linear), roughness, metalness]: pre-clear of a waiting set
    this.whenReady = Promise.resolve();
    const lut0 = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType);
    lut0.minFilter = lut0.magFilter = NearestFilter;
    lut0.needsUpdate = true;
    this.lut0 = lut0;
    this.stats = { compileMs: 0, basisMs: 0, bakeMs: 0, flushMs: 0, laterMs: 0, sets: 0, bytes: 0, basisBytes: 0, kinds: 0, restMs: 0 };
  }

  /** the shared periodic fbm map (signed, 4 channels) — also used by the shader patch for macro variation */
  get noiseTex() { return this.basis?.noise || null; }

  genMaterial(kind) {
    let m = this.mats.get(kind);
    if (!m) {
      const K = KINDS[kind];
      if (!K) throw new Error(`unknown generator kind ${kind}`);
      m = new RawShaderMaterial({
        name: `matgen:${kind}`,
        glslVersion: GLSL3,
        vertexShader: VERTEX,
        fragmentShader: HEADER + LIB + KIND_PRELUDE + K.src + MAIN,
        uniforms: genUniforms(),
        depthTest: false,
        depthWrite: false,
      });
      this.mats.set(kind, m);
    }
    return m;
  }

  /** @param {false|true|'pack2'} detail  false: albedo/normal/ORM, true: a detail map, 'pack2': blend-layer pair */
  finishMaterial(detail) {
    const key = detail === 'pack2' ? 'pack2' : detail ? 'detail' : 'full';
    if (!this.finishMats[key]) {
      this.finishMats[key] = new RawShaderMaterial({
        name: `matgen:finish-${key}`,
        glslVersion: GLSL3,
        vertexShader: VERTEX,
        fragmentShader: ({ detail: '#define DETAIL\n', pack2: '#define PACK2\n' }[key] || '') + FINISH,
        uniforms: {
          tP: { value: null },
          uSize: { value: new Vector2(1, 1) },
          uTexel: { value: new Vector2(1, 1) },
          uHRange: { value: 0.01 },
          uAO: { value: new Vector4(0.01, 0.01, 0.5, 0) },
          uNormalGain: { value: 1 },
        },
        depthTest: false,
        depthWrite: false,
      });
    }
    return this.finishMats[key];
  }

  /** compile the given generator programs (and the finish programs) in parallel; resolves when linked */
  compileKinds(kinds, finish = true) {
    const scene = new Scene();
    const add = (mat) => {
      const me = new Mesh(this.geo, mat);
      me.frustumCulled = false;
      scene.add(me);
    };
    for (const k of kinds) add(this.genMaterial(k));
    if (finish) {
      add(this.finishMaterial(false));
      add(this.finishMaterial(true));
      add(this.finishMaterial('pack2'));
    }
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.ensureScratch(16, 16));
    let p;
    try {
      p = this.renderer.compileAsync(scene, this.cam);
    } finally {
      this.renderer.setRenderTarget(prev);
    }
    return p.then(() => { for (const k of kinds) this.compiledKinds.add(k); });
  }

  /**
   * Start the generation: the basis maps are built on the main thread first (cold on the HD 4600 0.23–0.26 s for the
   * low tier uncontended — 0.7–1.9 s while the GPU process compiled), then the `boot` kinds compile in parallel
   * (KHR_parallel_shader_compile: the GPU process links them on its own threads). Resolves when they are linked
   * (this.whenReady); sets of `later` kinds are allocated and queued until bakeGroup() has compiled their group.
   * `later`: kinds in priority groups (array of arrays).
   */
  start(boot = Object.keys(KINDS), later = []) {
    const t0 = performance.now();
    // (low: the Voronoi bases sampled at 384 px — the same feature points; the low tier's textures are 1/4 size)
    const ts = this.textureSize;
    const b = makeBasis({ noiseSize: ts >= 1024 ? 512 : 256, vorSize: ts >= 2048 ? 768 : ts >= 1024 ? 512 : 384, seed: 5786 });
    this.basis = {
      noise: halfTexture(b.noise, b.noiseSize, true),
      vor16: halfTexture(b.vor16, b.vorSize, false),
      vor5: halfTexture(b.vor5, b.vor5Size, false),
    };
    this.basis.noise.name = 'matgen:noise';
    this.basis.vor16.name = 'matgen:voronoi16';
    this.basis.vor5.name = 'matgen:voronoi5';
    this.stats.basisBytes = Math.round(b.noiseSize ** 2 * 8 * 4 / 3) + b.vorSize ** 2 * 8 + b.vor5Size ** 2 * 8;
    this.stats.basisMs = performance.now() - t0;
    const list = boot.filter((k) => KINDS[k]);
    this.groups = later.map((g) => g.filter((k) => KINDS[k] && !list.includes(k))).filter((g) => g.length);
    for (const g of this.groups) for (const k of g) this.waiting.add(k);
    this.stats.kinds = list.length;
    const t1 = performance.now();
    this.whenReady = this.compileKinds(list).then(() => { this.stats.compileMs = performance.now() - t1; });
    return this.whenReady;
  }

  /** (compatibility) start and wait */
  async prepare(kinds) {
    await this.start(kinds);
  }

  /**
   * Compile one `later` group (once): a promise. perf-fix-2: `pace` (optional, () => Promise) is awaited before each kind's
   * program is issued, one at a time: creating a program preprocesses its GLSL on this thread, and a whole group issued
   * at once held a frame of play for up to ≈ 1 s on the HD 4600
   */
  compileGroup(i, pace = null) {
    const g = this.groups[i];
    if (!g) return Promise.resolve();
    if (!g.promise) {
      const t0 = performance.now();
      const issue = pace ? (async () => { const all = []; for (const k of g) { await pace(); all.push(this.compileKinds([k], false)); } await Promise.all(all); })() : this.compileKinds(g, false);
      g.promise = issue.then(() => {
        for (const k of g) this.waiting.delete(k);
        this.stats.laterMs += performance.now() - t0;
      });
    }
    return g.promise;
  }

  /** Compile every `later` group at once (screenshots: everything ready at 'ready'). */
  compileLater() {
    return Promise.all(this.groups.map((g, i) => this.compileGroup(i)));
  }

  /**
   * Bake the queued sets whose kinds have compiled, into their allocated targets — all of them, or as many as fit in
   * `budgetMs` (the rest stay queued): returns how many are left.
   */
  flush(budgetMs = Infinity) {
    const t0 = performance.now();
    for (const [id, r] of [...this.pending]) {
      if (this.waiting.has(SETS[id].kind)) continue;
      if (performance.now() - t0 > budgetMs) break;
      this.pending.delete(id);
      try {
        this.bake(id, r);
      } catch (e) {
        console.warn(`[mats] texture set "${id}" failed to bake`, e);
      }
    }
    this.stats.flushMs += performance.now() - t0;
    return [...this.pending.keys()].filter((id) => !this.waiting.has(SETS[id].kind)).length;
  }

  /** Compile every generator program not compiled yet, in the background (after the world is built). */
  prepareRest() {
    const rest = Object.keys(KINDS).filter((k) => !this.compiledKinds.has(k));
    if (!rest.length) return Promise.resolve();
    const t0 = performance.now();
    return this.compileKinds(rest, false).then(() => { this.stats.restMs = performance.now() - t0; });
  }

  dims(set) {
    const f = this.textureSize / 2048;
    const min = set.minPx || 64;
    const scale = (v) => Math.max(min, Math.round((v * f) / 4) * 4);
    return [scale(set.px[0]), scale(set.px[1])];
  }

  layout(id) {
    const set = SETS[id];
    if (!set.layout) return null;
    let L = this.layouts.get(id);
    if (!L) {
      const layout = masonryLayout({ W: set.tile[0], H: set.tile[1], seed: set.seed || 1, ...set.layout });
      const tex = new DataTexture(layout.lut, layout.lutW, layout.rows, RGBAFormat, FloatType);
      tex.minFilter = tex.magFilter = NearestFilter;
      tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
      tex.needsUpdate = true;
      let ctex = null;
      if (layout.courseLut) {
        ctex = new DataTexture(layout.courseLut, layout.courseN, 1, RGBAFormat, FloatType);
        ctex.minFilter = ctex.magFilter = NearestFilter;
        ctex.wrapS = ctex.wrapT = ClampToEdgeWrapping;
        ctex.name = `mat:${id}:courses`;
        ctex.needsUpdate = true;
      }
      L = { layout, tex, ctex };
      this.layouts.set(id, L);
    }
    return L;
  }

  ensureScratch(w, h) {
    const s = this.scratch;
    if (s && s.width >= w && s.height >= h) return s;
    const W = Math.max(w, s?.width || 0);
    const H = Math.max(h, s?.height || 0);
    s?.dispose();
    const rt = new WebGLRenderTarget(W, H, {
      depthBuffer: false, generateMipmaps: false,
      minFilter: NearestFilter, magFilter: NearestFilter, type: UnsignedIntType, format: RGBAIntegerFormat,
    });
    rt.texture.internalFormat = 'RGBA32UI';
    rt.texture.name = 'matgen:scratch';
    this.scratch = rt;
    return rt;
  }

  /** Free the scratch target (re-created on demand). */
  releaseScratch() {
    this.scratch?.dispose();
    this.scratch = null;
  }

  setUniforms(mat, id, set, w, h) {
    const K = KINDS[set.kind];
    const u = mat.uniforms;
    u.uTile.value.set(set.tile[0], set.tile[1]);
    u.uRes.value.set(w, h);
    u.uSeed.value = set.seed || 1;
    u.uHRange.value = set.hRange ?? K.hRange;
    const P = set.u || {};
    for (let i = 0; i < 4; i++) {
      const v = P[`uP${i}`] || [0, 0, 0, 0];
      u[`uP${i}`].value.set(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 0);
    }
    for (let i = 0; i < 7; i++) u[`uC${i}`].value.set(P[`uC${i}`] || '#808080');
    u.tN.value = this.basis.noise;
    u.tV.value = this.basis.vor16;
    u.tW.value = this.basis.vor5;
    const L = this.layout(id);
    if (L) {
      u.tL.value = L.tex;
      u.uRows.value = L.layout.rows;
      u.uRowH.value = L.layout.rowH;
      u.uDMax.value = L.layout.dMax;
      u.uQ.value = L.layout.q;
      u.tC.value = L.ctex || this.lut0;
      u.uCourses.value = L.ctex ? L.layout.courseN : 0;
    } else {
      u.tL.value = this.lut0;
      u.tC.value = this.lut0;
      u.uCourses.value = 0;
      u.uRows.value = 1;
      u.uRowH.value = set.tile[1];
      u.uDMax.value = 1;
      u.uQ.value = set.tile[0] * 2;
    }
  }

  makeTarget(w, h, layout) {
    const rt = new WebGLRenderTarget(w, h, {
      count: layout.length, depthBuffer: false, generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, type: UnsignedByteType, format: RGBAFormat,
      wrapS: RepeatWrapping, wrapT: RepeatWrapping, anisotropy: this.anisotropy,
    });
    layout.forEach(([format, colorSpace], i) => {
      const t = rt.textures[i];
      t.format = format;
      t.colorSpace = colorSpace;
      t.anisotropy = this.anisotropy;
      t.wrapS = t.wrapT = RepeatWrapping;
    });
    return rt;
  }

  /**
   * perf-fix-2: the production bundle skips three's shader checks (core/engine.js), so a generator's link status is
   * queried here, once per program and BEFORE its first draw — where three's own first-use queries wait anyway (after
   * the draw it waited for that bake to run on the GPU: ≈ 1 s later 'ready' on the HD 4600) — so a failed generator
   * still falls back to the flat look
   */
  checkLinked(mat) {
    if (this.renderer.debug.checkShaderErrors) return;
    const prog = this.renderer.properties.get(mat).currentProgram;
    if (!prog?.program || (this._linked ||= new WeakSet()).has(prog)) return;
    const gl = this.renderer.getContext();
    if (gl.getProgramParameter(prog.program, gl.LINK_STATUS) === false) throw new Error(`${mat.name} failed to compile`);
    this._linked.add(prog);
  }

  /** Throw if a generator program failed to link (three logs the shader error itself). */
  check(mat) {
    const prog = this.renderer.properties.get(mat).currentProgram;
    if (prog?.diagnostics && prog.diagnostics.runnable === false) throw new Error(`${mat.name} failed to compile`);
  }

  /**
   * Bake (or return the cached) texture set by id; a `rotOf` view returns its base set. A set of a `later` kind not
   * compiled yet is allocated (pre-cleared) and queued for flush(): the returned textures are the final objects.
   */
  get(id) {
    const set = SETS[id];
    if (set?.rotOf) return this.get(set.rotOf);
    let r = this.baked.get(id);
    if (!r) {
      if (!this.waiting.has(set.kind)) r = this.bake(id);
      else {
        r = this.allocate(id);
        this.pending.set(id, r);
      }
      this.baked.set(id, r);
    }
    return r;
  }

  /**
   * Fill a not-yet-baked target with its material's flat colour, a flat normal, AO 1 and its roughness (and generate
   * the mip levels), so a surface seen before its bake shows a plain colour — never black.
   */
  preclear(rt, id, K, pack2) {
    const r = this.renderer;
    const gl = r.getContext();
    const [col, rough, metal] = this.flatFor?.(id) || [{ r: 0.5, g: 0.5, b: 0.5 }, 0.8, 0];
    const prev = r.getRenderTarget();
    try {
      r.setRenderTarget(rt);
      if (K.detail) gl.clearBufferfv(gl.COLOR, 0, [0.5, 0.5, 0.5, 0.5]);
      else if (pack2) {
        gl.clearBufferfv(gl.COLOR, 0, [col.r, col.g, col.b, 0.5]);
        gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, rough, 1]);
      } else {
        gl.clearBufferfv(gl.COLOR, 0, [col.r, col.g, col.b, 1]);
        gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 0, 1]);
        gl.clearBufferfv(gl.COLOR, 2, [1, rough, metal, 1]);
      }
      const ac = r.autoClear;
      r.autoClear = false;
      r.render(this.empty || (this.empty = new Scene()), this.cam);   // three generates the target's mip levels after a render
      r.autoClear = ac;
    } finally {
      r.setRenderTarget(prev);
    }
  }

  /** a set's render target and result object, not baked yet */
  allocate(id) {
    const set = SETS[id];
    if (!set) throw new Error(`unknown texture set ${id}`);
    const K = KINDS[set.kind];
    const [w, h] = this.dims(set);
    const pack2 = set.pack === 'blend';
    let rt;
    let bpp;
    if (K.detail) {
      rt = this.makeTarget(w, h, [[RGBAFormat, NoColorSpace]]);
      bpp = 4;
    } else if (pack2) {
      rt = this.makeTarget(w, h, [[RGBAFormat, SRGBColorSpace], [RGBAFormat, NoColorSpace]]);
      bpp = 8;
    } else {
      rt = this.makeTarget(w, h, [
        [RGBAFormat, SRGBColorSpace],
        [RGFormat, NoColorSpace],
        [set.metal ? RGBAFormat : RGFormat, NoColorSpace],
      ]);
      bpp = 4 + 2 + (set.metal ? 4 : 2);
    }
    const tex = rt.textures;
    tex.forEach((t, i) => {
      t.name = `mat:${id}:${(pack2 ? ['albedo+height', 'normal+rough+ao'] : ['albedo', 'normal', 'orm'])[i] || i}`;
      t.repeat.set(1 / set.tile[0], 1 / set.tile[1]);
    });
    const bytes = Math.round(w * h * bpp * 4 / 3);
    this.stats.sets++;
    this.stats.bytes += bytes;
    if (this.waiting.has(set.kind)) this.preclear(rt, id, K, pack2);
    const L = this.layout(id);
    return {
      id, rt, w, h, bytes, tile: set.tile, metal: !!set.metal, pack: set.pack || null,
      map: tex[0], normal: tex[1] || null, orm: tex[2] || null,
      layout: L ? { q: L.layout.q, rowH: L.layout.rowH, dMax: L.layout.dMax, heights: L.layout.heights, courseTex: L.ctex, courseN: L.layout.courseN } : null,
    };
  }

  /** Render a set (into `into`, an allocated result, or a new target). */
  bake(id, into = null) {
    const set = SETS[id];
    if (!set) throw new Error(`unknown texture set ${id}`);
    if (!this.basis) throw new Error('basis maps not ready (await ctx.mats.ready())');
    const K = KINDS[set.kind];
    const t0 = performance.now();
    const renderer = this.renderer;
    const r0 = into || this.allocate(id);
    const { w, h } = r0;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    const gen = this.genMaterial(set.kind);
    this.setUniforms(gen, id, set, w, h);
    try {
      const scratch = this.ensureScratch(w, h);
      scratch.viewport.set(0, 0, w, h);
      scratch.scissor.set(0, 0, w, h);
      renderer.setRenderTarget(scratch);
      this.mesh.material = gen;
      this.checkLinked(gen);
      renderer.render(this.scene, this.cam);
      this.check(gen);
      this.compiledKinds.add(set.kind);
      const pack2 = set.pack === 'blend';
      const fin = this.finishMaterial(pack2 ? 'pack2' : !!K.detail);
      const fu = fin.uniforms;
      fu.tP.value = scratch.texture;
      fu.uSize.value.set(w, h);
      fu.uTexel.value.set(set.tile[0] / w, set.tile[1] / h);
      fu.uHRange.value = set.hRange ?? K.hRange;
      const ao = set.ao || K.ao;
      fu.uAO.value.set(ao[0], ao[1], ao[2], 0);
      fu.uNormalGain.value = set.normalGain ?? 1;
      renderer.setRenderTarget(r0.rt);
      this.mesh.material = fin;
      this.checkLinked(fin);
      renderer.render(this.scene, this.cam);
      this.check(fin);
      fu.tP.value = null;
    } catch (e) {
      if (!into) {
        r0.rt.dispose();
        this.stats.sets--;
        this.stats.bytes -= r0.bytes;
      }
      throw e;
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.autoClear = prevAutoClear;
    }
    this.stats.bakeMs += performance.now() - t0;
    this.stats.bakes = (this.stats.bakes || 0) + 1; // perf-fix-2: textures re-drawn in place (render/shadow-cache.js)
    return r0;
  }

  /** Re-bake the given sets one by one, waiting for the GPU after each: { id: ms } (verification only). */
  bench(ids = Object.keys(SETS).filter((id) => !SETS[id].rotOf)) {
    const out = {};
    const buf = new Uint8Array(4);
    for (const id of ids) {
      const t0 = performance.now();
      const r = this.bake(id);
      this.renderer.readRenderTargetPixels(r.rt, 0, 0, 1, 1, buf);
      out[id] = Math.round(performance.now() - t0);
      this.stats.sets--;
      this.stats.bytes -= r.bytes;
      r.rt.dispose();
    }
    return out;
  }

  /** Block until the GPU has finished all queued bakes (1-pixel readback). Returns ms waited. */
  sync() {
    const t0 = performance.now();
    const last = [...this.baked.values()].pop();
    if (last) {
      const buf = new Uint8Array(4);
      try { this.renderer.readRenderTargetPixels(last.rt, 0, 0, 1, 1, buf); } catch { /* ignore */ }
    }
    return performance.now() - t0;
  }

  /** Re-bake every baked set at a new texture size (old targets disposed). */
  rebake(textureSize, anisotropy) {
    this.textureSize = textureSize;
    this.anisotropy = anisotropy;
    const ids = [...this.baked.keys()];
    const old = [...this.baked.values()];
    this.baked.clear();
    this.pending.clear();
    this.stats.bytes = 0;
    this.stats.sets = 0;
    for (const id of ids) this.get(id);
    for (const r of old) r.rt.dispose();
    return this.baked;
  }

  dispose() {
    for (const r of this.baked.values()) r.rt.dispose();
    this.baked.clear();
    this.releaseScratch();
    for (const m of this.mats.values()) m.dispose();
    for (const m of Object.values(this.finishMats)) m.dispose();
    for (const L of this.layouts.values()) { L.tex.dispose(); L.ctex?.dispose(); }
    if (this.basis) for (const t of Object.values(this.basis)) t.dispose();
    this.lut0.dispose();
    this.geo.dispose();
  }
}
