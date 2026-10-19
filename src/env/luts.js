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
    this.stats = null; // decoded Float32Array(32), physical units
    this.statsSerial = 0;
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

  decode() {
    const out = new Float32Array(32);
    for (let i = 0; i < 32; i++) {
      const v = this.floatStats ? this.statsBuf[i] : DataUtils.fromHalfFloat(this.statsBuf[i]);
      out[i] = (Number.isFinite(v) ? v : 0) * LUT_SCALE;
    }
    return out;
  }

  /** Blocking read (used on time jumps and at start-up so the first frame is exposed correctly). */
  readStatsSync() {
    try {
      this.renderer.readRenderTargetPixels(this.statsRT, 0, 0, 8, 1, this.statsBuf);
      this.stats = this.decode();
    } catch (e) {
      console.warn('[env] sky stats read failed', e);
    }
    return this.stats;
  }

  /** Non-blocking read (fence + PBO); resolves a frame or two later. */
  readStatsAsync(onDone) {
    if (this.reading) return;
    this.reading = true;
    const serial = this.statsSerial;
    this.renderer.readRenderTargetPixelsAsync(this.statsRT, 0, 0, 8, 1, this.statsBuf)
      .then(() => { this.stats = this.decode(); onDone?.(serial); })
      .catch(() => this.readStatsSync())
      .finally(() => { this.reading = false; });
  }

  dispose() {
    for (const rt of [this.transRT, this.msRT, this.skyRT, this.statsRT]) rt.dispose();
    for (const m of [this.transMat, this.msMat, this.skyMat, this.statsMat]) m.dispose();
    this.quad.geometry.dispose();
  }
}
