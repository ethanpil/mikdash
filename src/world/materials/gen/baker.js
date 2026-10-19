// GPU texture baker. Each texture set's generator renders into a scratch MRT (albedo / packed height /
// AO-roughness-metalness); a finish pass derives the tangent-space normal (Sobel on 16-bit height) and cavity
// AO into the set's own mipmapped render target:
//   textures[0] albedo  RGBA8 sRGB (alpha = block-local distance / cut-out / 1)
//   textures[1] normal  RG8 (three reconstructs z: USE_PACKED_NORMALMAP)
//   textures[2] ORM     RG8 (AO, roughness) or RGBA8 (AO, roughness, metalness) for metal sets
// Detail sets bake one RGBA8 (normal.xy, albedo mod, roughness mod).
//
// Generators sample CPU-made periodic basis maps (gen/basis.js, computed on the main thread while the GPU compiles
// the generator programs in parallel). Sets bake lazily, the first time a material that needs them is requested.
import {
  Mesh, Scene, OrthographicCamera, PlaneGeometry, RawShaderMaterial, GLSL3, WebGLRenderTarget, DataTexture,
  RGBAFormat, RGFormat, RGBAIntegerFormat, UnsignedByteType, UnsignedIntType, HalfFloatType, FloatType, SRGBColorSpace, NoColorSpace, LinearFilter,
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
  uRows: { value: 1 },
  uRowH: { value: 1 },
  uDMax: { value: 1 },
  uQ: { value: 1 },
});

function halfTexture(data, size, mips) {
  const t = new DataTexture(data, size, size, RGBAFormat, HalfFloatType);
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
    this.layouts = new Map();  // set id -> { layout, tex }
    this.baked = new Map();    // set id -> result
    this.basis = null;         // { noise, vor16, vor5 } DataTextures
    const lut0 = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType);
    lut0.minFilter = lut0.magFilter = NearestFilter;
    lut0.needsUpdate = true;
    this.lut0 = lut0;
    this.stats = { compileMs: 0, basisMs: 0, bakeMs: 0, sets: 0, bytes: 0, basisBytes: 0 };
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

  finishMaterial(detail) {
    const key = detail ? 'detail' : 'full';
    if (!this.finishMats[key]) {
      this.finishMats[key] = new RawShaderMaterial({
        name: `matgen:finish-${key}`,
        glslVersion: GLSL3,
        vertexShader: VERTEX,
        fragmentShader: (detail ? '#define DETAIL\n' : '') + FINISH,
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

  /**
   * Compile every generator program in parallel (KHR_parallel_shader_compile: the GPU process links them on
   * its own threads) and, meanwhile, compute the basis maps on this thread; resolves when both are done.
   */
  async prepare(kinds = Object.keys(KINDS)) {
    const t0 = performance.now();
    const scene = new Scene();
    const add = (mat) => {
      const me = new Mesh(this.geo, mat);
      me.frustumCulled = false;
      scene.add(me);
    };
    for (const k of kinds) add(this.genMaterial(k));
    add(this.finishMaterial(false));
    add(this.finishMaterial(true));
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.ensureScratch(16, 16));
    let compiled;
    try {
      compiled = this.renderer.compileAsync(scene, this.cam).then(() => { this.stats.compileMs = performance.now() - t0; });
    } finally {
      this.renderer.setRenderTarget(prev);
    }
    const tb = performance.now();
    const b = makeBasis({ noiseSize: this.textureSize >= 1024 ? 512 : 256, vorSize: this.textureSize >= 2048 ? 768 : 512, seed: 5786 });
    this.basis = {
      noise: halfTexture(b.noise, b.noiseSize, true),
      vor16: halfTexture(b.vor16, b.vorSize, false),
      vor5: halfTexture(b.vor5, b.vor5Size, false),
    };
    this.basis.noise.name = 'matgen:noise';
    this.basis.vor16.name = 'matgen:voronoi16';
    this.basis.vor5.name = 'matgen:voronoi5';
    this.stats.basisBytes = Math.round(b.noiseSize ** 2 * 8 * 4 / 3) + b.vorSize ** 2 * 8 + b.vor5Size ** 2 * 8;
    this.stats.basisMs = performance.now() - tb;
    await compiled;
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
      L = { layout, tex };
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
    } else {
      u.tL.value = this.lut0;
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

  /** Throw if a generator program failed to link (three logs the shader error itself). */
  check(mat) {
    const prog = this.renderer.properties.get(mat).currentProgram;
    if (prog?.diagnostics && prog.diagnostics.runnable === false) throw new Error(`${mat.name} failed to compile`);
  }

  /** Bake (or return the cached) texture set by id. */
  get(id) {
    let r = this.baked.get(id);
    if (!r) {
      r = this.bake(id);
      this.baked.set(id, r);
    }
    return r;
  }

  bake(id) {
    const set = SETS[id];
    if (!set) throw new Error(`unknown texture set ${id}`);
    if (!this.basis) throw new Error('basis maps not ready (await ctx.mats.ready())');
    const K = KINDS[set.kind];
    const t0 = performance.now();
    const renderer = this.renderer;
    const [w, h] = this.dims(set);
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    const gen = this.genMaterial(set.kind);
    this.setUniforms(gen, id, set, w, h);
    let rt = null;
    let bpp;
    try {
      const scratch = this.ensureScratch(w, h);
      scratch.viewport.set(0, 0, w, h);
      scratch.scissor.set(0, 0, w, h);
      renderer.setRenderTarget(scratch);
      this.mesh.material = gen;
      renderer.render(this.scene, this.cam);
      this.check(gen);
      const fin = this.finishMaterial(!!K.detail);
      const fu = fin.uniforms;
      fu.tP.value = scratch.texture;
      fu.uSize.value.set(w, h);
      fu.uTexel.value.set(set.tile[0] / w, set.tile[1] / h);
      fu.uHRange.value = set.hRange ?? K.hRange;
      const ao = set.ao || K.ao;
      fu.uAO.value.set(ao[0], ao[1], ao[2], 0);
      fu.uNormalGain.value = set.normalGain ?? 1;
      if (K.detail) {
        rt = this.makeTarget(w, h, [[RGBAFormat, NoColorSpace]]);
        bpp = 4;
      } else {
        rt = this.makeTarget(w, h, [
          [RGBAFormat, SRGBColorSpace],
          [RGFormat, NoColorSpace],
          [set.metal ? RGBAFormat : RGFormat, NoColorSpace],
        ]);
        bpp = 4 + 2 + (set.metal ? 4 : 2);
      }
      renderer.setRenderTarget(rt);
      this.mesh.material = fin;
      renderer.render(this.scene, this.cam);
      this.check(fin);
      fu.tP.value = null;
    } catch (e) {
      rt?.dispose();
      throw e;
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.autoClear = prevAutoClear;
    }
    const tex = rt.textures;
    tex.forEach((t, i) => {
      t.name = `mat:${id}:${['albedo', 'normal', 'orm'][i] || i}`;
      t.repeat.set(1 / set.tile[0], 1 / set.tile[1]);
    });
    const bytes = Math.round(w * h * bpp * 4 / 3);
    this.stats.bakeMs += performance.now() - t0;
    this.stats.sets++;
    this.stats.bytes += bytes;
    const L = this.layout(id);
    return {
      id, rt, w, h, bytes, tile: set.tile, metal: !!set.metal,
      map: tex[0], normal: tex[1] || null, orm: tex[2] || null,
      layout: L ? { q: L.layout.q, rowH: L.layout.rowH, dMax: L.layout.dMax } : null,
    };
  }

  /** Re-bake the given sets one by one, waiting for the GPU after each: { id: ms } (verification only). */
  bench(ids = Object.keys(SETS)) {
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
    for (const L of this.layouts.values()) L.tex.dispose();
    if (this.basis) for (const t of Object.values(this.basis)) t.dispose();
    this.lut0.dispose();
    this.geo.dispose();
  }
}
