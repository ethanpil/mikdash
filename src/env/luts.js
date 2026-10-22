// GPU passes of the atmosphere: transmittance + multiple-scattering LUTs (once), the sky-view LUT (whenever the
// Sun or Moon moves), and an 8x1 statistics pass read back asynchronously (sky irradiance, horizon colours)
// that drives exposure, fog colour and ambient intensity on the CPU.
import {
  WebGLRenderTarget, HalfFloatType, FloatType, RGBAFormat, LinearFilter, NearestFilter, RepeatWrapping,
  ClampToEdgeWrapping, ShaderMaterial, Mesh, PlaneGeometry, Scene, OrthographicCamera, Vector2, Vector3,
  DataUtils,
} from 'three';
import {
  ATMO, mieCoefficients, TRANSMITTANCE_FRAG, MULTISCAT_FRAG, SKYVIEW_FRAG, STATS_FRAG, FULLSCREEN_VERT,
} from './atmosphere.js';

/** The sky-view LUT stores radiance / LUT_SCALE (keeps the brightest aureole inside half-float range). */
export const LUT_SCALE = 16;

const DEG = Math.PI / 180;
/**
 * Source altitudes (deg) of the statistics table (lighting-polish-fix): dense through twilight, where the sky
 * changes by a decade every couple of degrees, sparse high up.
 */
export const TABLE_ALTS = (() => {
  const a = [];
  for (let x = -24; x < 12; x += 0.5) a.push(x);
  for (let x = 12; x < 30; x += 2) a.push(x);
  for (let x = 30; x <= 90; x += 5) a.push(x);
  return a;
})();
// a twilight source is boosted so the table's LUT values stay in half-float range (≈ a decade per 2.5° below −2°)
const tableBoost = (alt) => 10 ** (Math.max(0, -alt - 2) / 2.5);

function makeRT(w, h, { type = HalfFloatType, filter = LinearFilter, wrapS = ClampToEdgeWrapping } = {}) {
  const rt = new WebGLRenderTarget(w, h, {
    type, format: RGBAFormat, minFilter: filter, magFilter: filter, generateMipmaps: false,
    depthBuffer: false, stencilBuffer: false, wrapS, wrapT: ClampToEdgeWrapping,
  });
  rt.texture.name = 'env.lut';
  return rt;
}

export class AtmosphereLUTs {
  constructor(renderer, { skyW = 192, skyH = 96, steps = 28 } = {}) {
    this.renderer = renderer;
    this.skyW = skyW; this.skyH = skyH; this.steps = steps;
    const ext = renderer.extensions;
    this.floatStats = ext.has('EXT_color_buffer_float');
    this.atmo = {
      uRayleighScat: { value: new Vector3() }, uRayleighH: { value: 8 },
      uMieScat: { value: new Vector3() }, uMieExt: { value: new Vector3() }, uMieH: { value: 1.2 },
      uMieG: { value: 0.76 }, uOzoneAbs: { value: new Vector3() }, uGroundAlbedo: { value: new Vector3() },
    };
    this.transRT = makeRT(256, 64);
    this.msRT = makeRT(32, 32);
    this.skyRT = makeRT(skyW, skyH, { wrapS: RepeatWrapping });
    this.statsRT = makeRT(8, 1, { type: this.floatStats ? FloatType : HalfFloatType, filter: NearestFilter });
    this.statsBuf = this.floatStats ? new Float32Array(32) : new Uint16Array(32);
    this.asyncBuf = this.floatStats ? new Float32Array(32) : new Uint16Array(32); // the PBO read lands later
    this.stats = null; // decoded Float32Array(32), physical units
    this.statsSerial = 0;
    this.syncSerial = 0;
    this.reading = false;

    const mk = (frag, extra = {}) => new ShaderMaterial({
      uniforms: { ...this.atmo, ...extra }, vertexShader: FULLSCREEN_VERT, fragmentShader: frag,
      depthTest: false, depthWrite: false,
    });
    this.transMat = mk(TRANSMITTANCE_FRAG);
    this.msMat = mk(MULTISCAT_FRAG, { uTransmittance: { value: this.transRT.texture } });
    this.skyMat = mk(SKYVIEW_FRAG, {
      uTransmittance: { value: this.transRT.texture }, uMultiScat: { value: this.msRT.texture },
      uSize: { value: new Vector2(skyW, skyH) }, uObsR: { value: ATMO.groundRadius + ATMO.observerAltitude },
      uSunDir: { value: new Vector3(0, 1, 0) }, uSunE: { value: new Vector3() },
      uMoonDir: { value: new Vector3(0, -1, 0) }, uMoonE: { value: new Vector3() },
      uGroundIrr: { value: new Vector3() }, uSteps: { value: steps },
    });
    this.statsMat = new ShaderMaterial({
      uniforms: {
        uSky: { value: this.skyRT.texture }, uHorizonV: { value: 0.5 }, uRefAz: { value: 0 },
        uObsR: { value: ATMO.groundRadius + ATMO.observerAltitude },
      },
      vertexShader: FULLSCREEN_VERT, fragmentShader: STATS_FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.transMat);
    this.quad.frustumCulled = false;
    this.scene = new Scene();
    this.scene.add(this.quad);
    this.cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.setAtmosphere(ATMO);
  }

  setAtmosphere(p) {
    const { ext, scat } = mieCoefficients(p);
    const a = this.atmo;
    a.uRayleighScat.value.fromArray(p.rayleighScattering);
    a.uRayleighH.value = p.rayleighHeight;
    a.uMieScat.value.fromArray(scat);
    a.uMieExt.value.fromArray(ext);
    a.uMieH.value = p.mieHeight;
    a.uMieG.value = p.mieG;
    a.uOzoneAbs.value.fromArray(p.ozoneAbsorption);
    a.uGroundAlbedo.value.fromArray(p.groundAlbedo);
  }

  /** Run fn with renderer state saved (render target, shadow map, xr) and restored. */
  withState(fn) {
    const r = this.renderer;
    const rt = r.getRenderTarget(), face = r.getActiveCubeFace(), mip = r.getActiveMipmapLevel();
    const shadows = r.shadowMap.enabled, xr = r.xr.enabled;
    r.shadowMap.enabled = false; // also keeps our passes from consuming shadowMap.needsUpdate
    r.xr.enabled = false;
    try { fn(); } finally {
      r.setRenderTarget(rt, face, mip);
      r.shadowMap.enabled = shadows;
      r.xr.enabled = xr;
    }
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  /** Static LUTs (atmosphere only — independent of time). */
  init() {
    this.withState(() => {
      this.pass(this.transMat, this.transRT);
      this.pass(this.msMat, this.msRT);
    });
  }

  /** Runtime quality change: new sky-view LUT size / march steps (the texture object is kept; refill with updateSky). */
  resize({ skyW = this.skyW, skyH = this.skyH, steps = this.steps } = {}) {
    this.skyW = skyW; this.skyH = skyH; this.steps = steps;
    this.skyRT.setSize(skyW, skyH);
    this.skyMat.uniforms.uSize.value.set(skyW, skyH);
    this.skyMat.uniforms.uSteps.value = steps;
  }

  /** o: { sunDir, sunE: Vector3 (lx/LUT_SCALE), moonDir, moonE, groundIrr } */
  updateSky(o) {
    const u = this.skyMat.uniforms;
    u.uSunDir.value.copy(o.sunDir);
    u.uSunE.value.copy(o.sunE);
    u.uMoonDir.value.copy(o.moonDir);
    u.uMoonE.value.copy(o.moonE);
    u.uGroundIrr.value.copy(o.groundIrr);
    this.withState(() => this.pass(this.skyMat, this.skyRT));
  }

  runStats(refAzDeg) {
    this.statsMat.uniforms.uRefAz.value = refAzDeg * Math.PI / 180;
    this.withState(() => this.pass(this.statsMat, this.statsRT));
    this.statsSerial++;
  }

  decode(buf = this.statsBuf) {
    const out = new Float32Array(32);
    for (let i = 0; i < 32; i++) {
      const v = this.floatStats ? buf[i] : DataUtils.fromHalfFloat(buf[i]);
      out[i] = (Number.isFinite(v) ? v : 0) * LUT_SCALE;
    }
    return out;
  }

  /**
   * Statistics per unit source (lighting-polish-fix). The sky above the horizon is linear in its two sources
   * (the LUT's ground term only shows below it), so the 8 statistics of any sky are Σ E_source × T(altitude of
   * the source), the horizon terms rotated by the source's azimuth from the reference light. T is measured once
   * (one LUT + stats pass per altitude, ONE synchronous read): afterwards a clock jump or a time-lapse frame gets
   * its statistics without waiting for the GPU (a sync read there drained the whole frame: 120–190 ms a jump on
   * the HD 4600, ≈10 fps at 600×). Returns false (and the caller keeps reading back) when it cannot be built.
   */
  buildTable(alts = TABLE_ALTS, sunTOA = ATMO.sunIlluminanceTOA) {
    const n = alts.length;
    const rt = makeRT(8, n, { type: this.floatStats ? FloatType : HalfFloatType, filter: NearestFilter });
    const buf = this.floatStats ? new Float32Array(n * 32) : new Uint16Array(n * 32);
    try {
      this._tablePasses(rt, this.skyRT, alts, 0, n, sunTOA);
      this.renderer.readRenderTargetPixels(rt, 0, 0, 8, n, buf);
    } catch (e) {
      console.warn('[env] sky statistics table unavailable', e);
      return false;
    } finally {
      rt.dispose();
    }
    return this._tableFinish(buf, alts, sunTOA);
  }

  /**
   * perf-1: the same table built after the first view instead of in the boot (≈ 1 s of GPU work and a synchronous
   * read on the HD 4600): `perFrame` altitudes a frame into private targets (the live sky-view LUT is untouched), one
   * asynchronous read at the end. Until it lands env reads the statistics back as it does without a table.
   */
  async buildTableAsync(alts = TABLE_ALTS, sunTOA = ATMO.sunIlluminanceTOA, perFrame = 4) {
    const n = alts.length;
    const rt = makeRT(8, n, { type: this.floatStats ? FloatType : HalfFloatType, filter: NearestFilter });
    const sky = makeRT(this.skyW, this.skyH, { wrapS: RepeatWrapping });
    const buf = this.floatStats ? new Float32Array(n * 32) : new Uint16Array(n * 32);
    const frame = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));
    try {
      for (let k0 = 0; k0 < n; k0 += perFrame) {
        await frame();
        if (this.skyW !== sky.width || this.skyH !== sky.height) return false; // a tier change rebuilt it meanwhile
        this._tablePasses(rt, sky, alts, k0, Math.min(n, k0 + perFrame), sunTOA);
      }
      await this.renderer.readRenderTargetPixelsAsync(rt, 0, 0, 8, n, buf);
    } catch (e) {
      console.warn('[env] sky statistics table unavailable', e);
      return false;
    } finally {
      rt.dispose();
      sky.dispose();
    }
    return this._tableFinish(buf, alts, sunTOA);
  }

  /** rows k0..k1 of the table: the sky-view LUT for a unit source at each altitude (into `sky`), then its statistics */
  _tablePasses(rt, sky, alts, k0, k1, sunTOA) {
    const u = this.skyMat.uniforms;
    const keep = ['uSunDir', 'uSunE', 'uMoonDir', 'uMoonE', 'uGroundIrr'].map((k) => [k, u[k].value.clone()]);
    const su = this.statsMat.uniforms;
    const refAz = su.uRefAz.value, skyTex = su.uSky.value;
    try {
      this.withState(() => {
        u.uMoonE.value.set(0, 0, 0);
        u.uGroundIrr.value.set(0, 0, 0);
        su.uRefAz.value = 0;
        su.uSky.value = sky.texture;
        rt.scissorTest = true;
        for (let k = k0; k < k1; k++) {
          const a = alts[k] * DEG;
          const e = (sunTOA * tableBoost(alts[k])) / LUT_SCALE;
          u.uSunDir.value.set(0, Math.sin(a), -Math.cos(a)); // azimuth 0 (north) = the reference
          u.uSunE.value.set(e, e, e);
          this.pass(this.skyMat, sky);
          rt.viewport.set(0, k, 8, 1);
          rt.scissor.set(0, k, 8, 1);
          this.pass(this.statsMat, rt);
        }
      });
    } finally {
      for (const [k, v] of keep) u[k].value.copy(v);
      su.uRefAz.value = refAz;
      su.uSky.value = skyTex;
    }
  }

  _tableFinish(buf, alts, sunTOA) {
    const n = alts.length;
    // per lux of source at the top of the atmosphere, log for interpolation
    const T = new Float64Array(n * 32);
    let ok = true;
    for (let k = 0; k < n; k++) {
      const s = LUT_SCALE / (sunTOA * tableBoost(alts[k]));
      for (let i = 0; i < 32; i++) {
        const raw = this.floatStats ? buf[k * 32 + i] : DataUtils.fromHalfFloat(buf[k * 32 + i]);
        const v = Number.isFinite(raw) ? raw * s : 0;
        T[k * 32 + i] = Math.log(Math.max(v, 1e-30));
      }
      if (alts[k] >= 0 && !(T[k * 32] > -60)) ok = false; // a daylight sky must have irradiance
    }
    if (!ok) { console.warn('[env] sky statistics table empty'); return false; }
    this.table = { alts: Float64Array.from(alts), T };
    return true;
  }

  /**
   * Statistics (physical, the same layout as `stats`) of a sky lit by `sources` [{ alt, az (deg), E: [r,g,b] lx at
   * the top of the atmosphere }] with the horizon terms measured from azimuth `refAz`, from the table.
   */
  estimate(sources, refAz, out = new Float32Array(32)) {
    out.fill(0);
    const tb = this.table;
    if (!tb) return null;
    const { alts, T } = tb;
    const n = alts.length;
    const row = new Float64Array(32);
    for (const s of sources) {
      if (!s || !(Math.max(s.E[0], s.E[1], s.E[2]) > 0) || s.alt < alts[0] - 0.25) continue;
      // interpolate the row in log space
      let k = 0;
      while (k < n - 2 && alts[k + 1] <= s.alt) k++;
      const f = Math.min(Math.max((s.alt - alts[k]) / (alts[k + 1] - alts[k]), 0), 1);
      for (let i = 0; i < 32; i++) row[i] = Math.exp(T[k * 32 + i] + (T[(k + 1) * 32 + i] - T[k * 32 + i]) * f);
      // the source's own horizon profile H(x) (x = azimuth from the source, 0..180°, at 45° steps), symmetrised
      // about the reference like the stats pass: 0.5 (H(r − Δ) + H(r + Δ))
      let d = (((s.az - refAz) % 360) + 540) % 360 - 180;
      const H = (x, c) => {
        const a = Math.min(Math.abs(((x % 360) + 540) % 360 - 180), 180) / 45;
        const i0 = Math.min(Math.floor(a), 3), t = a - i0;
        return row[(2 + i0) * 4 + c] * (1 - t) + row[(3 + i0) * 4 + c] * t;
      };
      // the skyline profile (alpha of pixels 0..6, luminance per unit source): × the source's luminance
      const eL = 0.2126 * s.E[0] + 0.7152 * s.E[1] + 0.0722 * s.E[2];
      for (let i = 0; i < 7; i++) out[i * 4 + 3] += eL * row[i * 4 + 3];
      for (let c = 0; c < 3; c++) {
        const e = s.E[c];
        out[c] += e * row[c];
        out[4 + c] += e * row[4 + c];
        out[28 + c] += e * row[28 + c];
        for (let j = 0; j < 5; j++) {
          const r = 45 * j;
          out[(2 + j) * 4 + c] += e * 0.5 * (H(r - d, c) + H(r + d, c));
        }
      }
    }
    return out;
  }

  /** Blocking read (used on time jumps and at start-up so the first frame is exposed correctly). */
  readStatsSync() {
    try {
      this.renderer.readRenderTargetPixels(this.statsRT, 0, 0, 8, 1, this.statsBuf);
      this.stats = this.decode();
      this.syncSerial = this.statsSerial;
    } catch (e) {
      console.warn('[env] sky stats read failed', e);
    }
    return this.stats;
  }

  /**
   * Non-blocking read (fence + PBO); resolves a frame or two later. A result is dropped when a newer stats pass
   * was read synchronously meanwhile (a clock jump): it would put the previous sky back for seconds.
   */
  readStatsAsync(onDone) {
    if (this.reading) return;
    this.reading = true;
    const serial = this.statsSerial;
    this.renderer.readRenderTargetPixelsAsync(this.statsRT, 0, 0, 8, 1, this.asyncBuf)
      .then(() => {
        if (serial < this.syncSerial) return;
        this.stats = this.decode(this.asyncBuf);
        onDone?.(serial);
      })
      .catch(() => this.readStatsSync())
      .finally(() => { this.reading = false; });
  }

  dispose() {
    for (const rt of [this.transRT, this.msRT, this.skyRT, this.statsRT]) rt.dispose();
    for (const m of [this.transMat, this.msMat, this.skyMat, this.statsMat]) m.dispose();
    this.quad.geometry.dispose();
  }
}
