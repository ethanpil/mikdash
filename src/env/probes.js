// Scene reflection probes (medium+): CubeCamera captures of the BUILT scene (people hidden; flames, smoke and
// glows live in render/'s separate FX scene and are never captured), prefiltered with env's PMREMGenerator and
// copied into slices of one CubeUV atlas that becomes scene.environment:
//
//   slice 0  env's sky PMREM (copied on every sky refresh; × scene.environmentIntensity as before)
//   slice k  probe k (scene units at its capture, × P_now / P_capture × light now / light at capture)
//
// interiors-glsl.js samples the slices by fragment position (influence boxes, box-projected reflections).
// Captures run inside render/'s frame (after the shadow light is set up, before the main draw) via render():
//   * SYNC (all faces; interior probes 2–3 passes so the gold room sees its own bounces), two frames after
//     'ready' or a world change, one frame after an isolated clock jump / date change, and after a burst of jumps
//     (time-panel drag) once the clock has rested (and on a new tier: a new instance);
//   * AMORTISED (one face per frame, then the PMREM): when the Sun moved a few degrees, the key light switched,
//     the outdoor light drifted > 1.6×, the fires inside an interior probe's influence changed (Menorah lamps lit
//     at dusk) or the doors of its room moved — at most once per probe per MIN_REFRESH (MIN_REFRESH_FAST in a
//     time-lapse); an interior probe's new capture enters the atlas when its measurement lands.
// The people, the world's terrain and Mount groups, the Sun / Moon discs, the stars and — for OUTDOOR probes —
// the fires are left out of captures (see docs/decisions/lighting-polish(-fix).md); captures are lit at env's
// exposure with an output gain that keeps dark ones in half-float range; a probe whose light drifted > 3× since its
// capture fades toward the sky map (outdoor) or the room's fire fill (interior) until it is refreshed.
import {
  WebGLRenderTarget, WebGLCubeRenderTarget, CubeCamera, HalfFloatType, FloatType, LinearFilter, RGBAFormat,
  LinearSRGBColorSpace, CubeUVReflectionMapping, ShaderMaterial, Mesh, PlaneGeometry, Scene, OrthographicCamera,
  Vector2, Vector3, NoBlending, DataUtils,
} from 'three';
import { m2w } from '../core/units.js';
import { MK_LIMITS } from './interiors-glsl.js';
import { defineProbes } from './volumes.js';

const DEG = Math.PI / 180;
const SUN_STEP = { medium: 3, high: 2, ultra: 1.5 }; // re-capture after the Sun moved this far (deg)
const SELF_FEEDBACK = 0.9; // a probe sees its previous self at most this strong during its own capture
const SYNC_DELAY = 2;      // frames after 'ready' before a full capture (env + fx exposure settle first)
const JUMP_DELAY = 1;      // frames after an isolated clock jump (fx re-schedules its fires and lights first)
const BURST_GAP = 0.4;     // s: a jump this soon after the previous one is a drag on the time panel …
const BURST_QUIET = 0.5;   // s (and 3 frames): … whose capture waits until the clock has been still this long
const METER_WAIT = 0.6;    // s: env holds its exposure snap at most this long for a post-jump measurement
const MIN_REFRESH = 1.5;   // s between amortised refreshes of one probe …
const MIN_REFRESH_FAST = 0.3; // … in a time-lapse (|speed| > 20), where 1.5 s real is 15 sim-minutes at 600×
const INTERIOR_PASSES = { medium: 2, high: 3, ultra: 3 }; // sync capture bounces of an interior (gold) probe
const LOG_EPS = 1e-4;      // cd/m²: the darkest luminance the log-average meter counts
const GAIN_TARGET = 0.5;   // scene units: a capture's mean is brought up to about this (captureGain)
const CLAMP_MEAN = 24;     // a skylit probe's texels are clamped to this × its capture's expected mean (captureClamp)

const COPY_VS = 'void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
// luminance of a captured cube (what the eye sees from the probe point): a 72 × 12 target, one fragment per
// cell of a 12 × 12 grid on each face, 4 × 4 samples each, weighted by texel solid angle; summed on the CPU.
// r = Σ w·ln(L + ε) (the log-average the eye adapts to: a sunlit doorway behind the viewer must not set the
// exposure of a dim room — lighting-polish-fix), g, b, a = Σ w·(R, G, B) (the mean colour: the room's light, to which
// the eye adapts chromatically — render-env-2); Σ w is a constant of the grid (sampleWeights)
const MEAN_W = 72, MEAN_H = 12;
const MEAN_FS = /* glsl */`
uniform samplerCube cube;
uniform float eps;
void main() {
  int f = int( gl_FragCoord.x ) / 12;
  vec2 cell = vec2( float( int( gl_FragCoord.x ) - f * 12 ), floor( gl_FragCoord.y ) );
  float slog = 0.0;
  vec3 slin = vec3( 0.0 );
  for ( int j = 0; j < 4; j ++ ) {
    for ( int i = 0; i < 4; i ++ ) {
      vec2 q = ( cell + ( vec2( float( i ), float( j ) ) + 0.5 ) / 4.0 ) / 12.0 * 2.0 - 1.0;
      vec3 d = f == 0 ? vec3( 1.0, q.y, - q.x ) : f == 1 ? vec3( - 1.0, q.y, q.x ) : f == 2 ? vec3( q.x, 1.0, - q.y )
        : f == 3 ? vec3( q.x, - 1.0, q.y ) : f == 4 ? vec3( q.x, q.y, 1.0 ) : vec3( - q.x, q.y, - 1.0 );
      float w = pow( 1.0 + dot( q, q ), - 1.5 ); // texel solid angle ∝ (1 + u² + v²)^-3/2
      vec3 c = max( textureLod( cube, d, 0.0 ).rgb, vec3( 0.0 ) );
      slog += log( dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ) + eps ) * w;
      slin += c * w;
    }
  }
  gl_FragColor = vec4( slog, slin );
}`;
/** Σ w of MEAN_FS per output cell (the same solid-angle weights, a constant of the grid) */
const sampleWeights = (() => {
  const W = new Float64Array(12 * 12);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    let s = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const u = ((x + (i + 0.5) / 4) / 12) * 2 - 1, v = ((y + (j + 0.5) / 4) / 12) * 2 - 1;
      s += (1 + u * u + v * v) ** -1.5;
    }
    W[y * 12 + x] = s;
  }
  return W;
})();
const COPY_FS = /* glsl */`
uniform sampler2D src;
uniform vec2 offset;
void main() { gl_FragColor = texelFetch( src, ivec2( gl_FragCoord.xy - offset ), 0 ); }`;

export function createProbes(ctx, { pmrem, cubeSize, tierKey, interiors, ready: started = false, withoutDiscs = (fn) => fn() }) {
  const defs = defineProbes(ctx).filter((d) => d.tiers.includes(tierKey)).slice(0, MK_LIMITS.probe);
  if (!defs.length || !interiors) return null;
  const { renderer, scene } = ctx;
  const cs = 2 ** Math.floor(Math.log2(cubeSize));
  const sliceW = 3 * Math.max(cs, 112);
  const H = 4 * cs;
  const stride = sliceW + MK_LIMITS.gap;
  const nSlices = defs.length + 1;
  const atlas = new WebGLRenderTarget(stride * nSlices, H, {
    type: HalfFloatType, format: RGBAFormat, colorSpace: LinearSRGBColorSpace, minFilter: LinearFilter,
    magFilter: LinearFilter, generateMipmaps: false, depthBuffer: false, stencilBuffer: false,
  });
  atlas.texture.mapping = CubeUVReflectionMapping;
  atlas.texture.name = 'env.probeAtlas';

  // copy pass (texel-exact) into one slice of the atlas
  const copyMat = new ShaderMaterial({
    uniforms: { src: { value: null }, offset: { value: new Vector2() } }, vertexShader: COPY_VS, fragmentShader: COPY_FS,
    depthTest: false, depthWrite: false, blending: NoBlending, toneMapped: false,
  });
  const copyScene = new Scene();
  const quad = new Mesh(new PlaneGeometry(2, 2), copyMat);
  quad.frustumCulled = false;
  copyScene.add(quad);
  const copyCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const meanMat = new ShaderMaterial({ uniforms: { cube: { value: null }, eps: { value: LOG_EPS } }, vertexShader: COPY_VS, fragmentShader: MEAN_FS, depthTest: false, depthWrite: false, toneMapped: false });
  // read back as FLOAT: reading a half-float target takes ~0.45 s on ANGLE/D3D11 (a slow conversion path)
  const floatRead = renderer.extensions.has('EXT_color_buffer_float');
  const meanRT = new WebGLRenderTarget(MEAN_W, MEAN_H, { type: floatRead ? FloatType : HalfFloatType, format: RGBAFormat, depthBuffer: false, stencilBuffer: false });
  const meanBuf = floatRead ? new Float32Array(MEAN_W * MEAN_H * 4) : new Uint16Array(MEAN_W * MEAN_H * 4);
  const half = (h) => { const e = (h >> 10) & 0x1f, f = h & 0x3ff; const v = e === 0 ? 6.103515625e-5 * (f / 1024) : e === 31 ? 65504 : 2 ** (e - 15) * (1 + f / 1024); return (h & 0x8000) ? -v : v; };
  /**
   * Luminance of probe p's latest capture as the eye adapts to it (physical, cd/m²): the log-average over the
   * sphere and per face, plus the arithmetic mean. Read back asynchronously (a synchronous read stalls ANGLE/D3D11
   * for ~0.35 s here, even with the GPU idle). Until it lands, env meters the room from its openings and fires
   * (roomProbe() returns null while meanL is 0) and, after a clock jump, keeps its exposure snapped (meterPending).
   */
  let meanPending = null;
  /** start measuring p's cube; onLand runs when the values land (same task). false: another read is in flight */
  function measure(p, onLand = null, Pm = ctx.env?.preExposure || 1) {
    if (meanPending && meanPending !== p) return false; // one read in flight; the next capture measures again
    const prevRT = renderer.getRenderTarget(), prevFace = renderer.getActiveCubeFace(), prevMip = renderer.getActiveMipmapLevel();
    meanMat.uniforms.cube.value = p.rt.texture;
    meanMat.uniforms.eps.value = LOG_EPS * Pm;
    quad.material = meanMat;
    renderer.setRenderTarget(meanRT);
    renderer.render(copyScene, copyCam);
    quad.material = copyMat;
    renderer.setRenderTarget(prevRT, prevFace, prevMip);
    const serial = ++p.measureSerial;
    meanPending = p;
    p.measuring = true;
    readMean(p, serial, Pm, onLand);
    return true;
  }
  function readMean(p, serial, Pm, onLand) {
    renderer.readRenderTargetPixelsAsync(meanRT, 0, 0, MEAN_W, MEAN_H, meanBuf)
      .then(() => {
        if (serial !== p.measureSerial) return;
        const v = (i) => (floatRead ? meanBuf[i] : half(meanBuf[i]));
        // per world direction (faces ±X ±Y ±Z of the sampling in MEAN_FS) and over the whole sphere
        const fLog = [0, 0, 0, 0, 0, 0], fLin = [0, 0, 0, 0, 0, 0], fW = [0, 0, 0, 0, 0, 0], rgb = [0, 0, 0];
        for (let y = 0; y < MEAN_H; y++) for (let x = 0; x < MEAN_W; x++) {
          const i = y * MEAN_W + x, f = Math.floor(x / 12);
          const r = v(i * 4 + 1), g = v(i * 4 + 2), b = v(i * 4 + 3);
          fLog[f] += v(i * 4); fLin[f] += 0.2126 * r + 0.7152 * g + 0.0722 * b; fW[f] += sampleWeights[y * 12 + (x % 12)];
          rgb[0] += r; rgb[1] += g; rgb[2] += b;
        }
        const sum = (a) => a.reduce((s, x) => s + x, 0);
        const ws = sum(fW), lnP = Math.log(Pm);
        const L = ws > 0 ? sum(fLin) / ws : NaN, G = ws > 0 ? sum(fLog) / ws : NaN;
        if (Number.isFinite(L) && Number.isFinite(G)) {
          p.meanL = Math.max(L / Pm, 1e-9);
          p.meanLog = G - lnP;
          p.meanFace = fLin.map((l, f) => Math.max(fW[f] > 0 ? l / fW[f] : L, 0) / Pm);
          p.faceLog = fLog.map((l, f) => (fW[f] > 0 ? l / fW[f] : G) - lnP);
          // the mean colour, normalised to luminance 1 (the light the eye adapts to in the room)
          const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
          p.meanColor = lum > 0 ? rgb.map((c) => c / lum) : [1, 1, 1];
          onLand?.();
        }
      })
      .catch(() => {})
      .finally(() => { if (meanPending === p) meanPending = null; if (serial === p.measureSerial) p.measuring = false; });
  }

  function copyInto(slice, texture) {
    const prevRT = renderer.getRenderTarget(), prevFace = renderer.getActiveCubeFace(), prevMip = renderer.getActiveMipmapLevel();
    const x = slice * stride;
    copyMat.uniforms.src.value = texture;
    copyMat.uniforms.offset.value.set(x, 0);
    atlas.viewport.set(x, 0, sliceW, H);
    atlas.scissor.set(x, 0, sliceW, H);
    atlas.scissorTest = true;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(atlas);
    renderer.render(copyScene, copyCam);
    renderer.autoClear = ac;
    atlas.scissorTest = false;
    atlas.viewport.set(0, 0, atlas.width, atlas.height);
    renderer.setRenderTarget(prevRT, prevFace, prevMip);
  }

  // Flames (render/'s FX scene) are never captured: their light already reaches every surface through the fire
  // point lights (diffuse AND the GGX highlight, which is the flame's mirror image on gold); an emissive flame in
  // the probe double-counted it — after a jump the court at night brightened 2.3× (lighting-polish).

  // probes
  const cubeOpts = { type: HalfFloatType, generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter };
  let scratch = null; // shared PMREM output (copied into the atlas right away)
  const probes = defs.map((d, i) => {
    const rt = new WebGLCubeRenderTarget(cs, cubeOpts);
    const cam = new CubeCamera(0.1, d.far, rt);
    cam.position.copy(m2w(...d.pos));
    cam.updateMatrixWorld(true);
    const a = m2w(...d.min), b = m2w(...d.max), pa = m2w(...d.proxyMin), pb = m2w(...d.proxyMax);
    const box = (u, v) => ({ min: new Vector3(Math.min(u.x, v.x), Math.min(u.y, v.y), Math.min(u.z, v.z)), max: new Vector3(Math.max(u.x, v.x), Math.max(u.y, v.y), Math.max(u.z, v.z)) });
    return {
      ...d, slice: i + 1, rt, cam, world: cam.position.clone(), infl: box(a, b), proxy: box(pa, pb), metered: !d.outdoor && !d.skylit,
      Pcap: 0, Ecap: 1, Egcap: 0, valid: false, face: -1, mode: null, pass: 0, meanL: 0, measureSerial: 0, doneAt: -1e9,
      sunAt: new Vector3(0, -2, 0), keyMoon: null, fireSig: -1, doorSig: -1,
    };
  });

  // packed for the shader (render-env-2): H = the influence box grown by its margin in centimetres from the interior
  // patch's origin + half2( shell, margin ); C = capture position + intensity; D = proxy min + weight; E = proxy max +
  // atlas slice (+ 8 for an outdoor probe). A fragment outside a probe's box reads one uvec4 for it.
  const PH = new Uint32Array(MK_LIMITS.probe * 4), C = new Float32Array(MK_LIMITS.probe * 4);
  const D = new Float32Array(MK_LIMITS.probe * 4), E = new Float32Array(MK_LIMITS.probe * 4);
  const O = interiors.origin || { x: 0, y: 0, z: 0 };
  const cmDown = (v) => Math.max(0, Math.min(65535, Math.floor(v * 100)));
  const cmUp = (v) => Math.max(0, Math.min(65535, Math.ceil(v * 100)));
  const halfBits = (v) => DataUtils.toHalfFloat(v);
  /**
   * Light reaching a probe's point (physical lux): the outdoor global illuminance through its room's openings, plus
   * (interior probes) the fires that see it. A probe is replayed × P_now/P_cap × E_now/E_cap, like env's sky map
   * (normalised by the sky irradiance): between refreshes — a 600× dusk changes the sky 100× in 15 sim-minutes —
   * its shape is stale, its brightness is not. OUTDOOR probes hold no fire light (see renderFaces): their diffuse
   * light is the same anywhere in their influence box, and a fire's is not (lighting-polish-fix).
   */
  const _ins = { V: 1, vol: null, s: 0 };
  const fireAdapt = () => { const a = Number(ctx.fx?.fireAdaptation); return Number.isFinite(a) && a > 0 ? Math.min(a, 1) : 1; };
  /**
   * opts.split: { sky, fire } instead of the sum. A skylit probe's fires (open-air fires lighting a porch, render-env-2-fix)
   * count as the viewer sees them: × fx's local adaptation to firelight (env's exposure leaves fires out)
   */
  function lightLevel(p, adapted = true) {
    const env = ctx.env;
    const Eg = env?.globalIlluminance || 0;
    const V = interiors.at(p.world, _ins).V;
    let Ef = 0;
    if (!p.outdoor) { try { Ef = ctx.fx?.illuminanceAt?.(p.world) || 0; } catch { Ef = 0; } }
    if (p.skylit && adapted) Ef *= fireAdapt();
    return Math.max(V * Eg + Ef, 1e-9);
  }
  /**
   * the probe's light now / at its capture (its replay gain). A skylit probe's fire share follows fx's adaptation
   * (already in lightLevel), its sky share env's exposure (the P ratio in writeUniforms)
   */
  const lightRatio = (p) => Math.min(Math.max(lightLevel(p) / p.Ecap, 1e-3), 1e3);

  /** outdoor light now vs at capture, as |ln| of the ratio (a probe's sky content follows this) */
  const skyDrift = (p) => Math.abs(Math.log(Math.max(ctx.env?.globalIlluminance || 0, 1e-9) / Math.max(p.Egcap || 1e-9, 1e-9)));
  /**
   * weight of a probe whose light drifted between refreshes (fast-forward): 1 up to 3×, gone by 10× — outdoor
   * probes by the sky, interior ones by their whole light (sky through the openings and the room's fires)
   */
  const staleness = (p) => {
    // a skylit probe: the light's physical change (the viewer's adaptation to its fires only rescales it)
    const d = p.outdoor ? skyDrift(p) : p.skylit ? Math.abs(Math.log(Math.max(lightLevel(p, false), 1e-9) / Math.max(p.EcapPhys || 1e-9, 1e-9))) : Math.abs(Math.log(lightRatio(p)));
    const t = (d - Math.log(3)) / (Math.log(10) - Math.log(3));
    return 1 - Math.min(Math.max(t, 0), 1);
  };
  /** how much a probe stands for its room now (0 while a post-jump capture is due, or when stale) */
  const coverage = (p) => (p.valid && p.Pcap > 0 && !wantSync ? staleness(p) : 0);

  /** probe uniforms; `self` = the probe being captured (scaled down / off) */
  function writeUniforms(self = null, selfScale = 1) {
    const P = ctx.env?.preExposure || 1;
    // interior probes first: their weight is taken before the outdoor probes and the sky
    const order = [...probes].sort((p, q) => Number(p.outdoor) - Number(q.outdoor));
    PH.fill(0); C.fill(0); D.fill(0); E.fill(0);
    order.forEach((p, k) => {
      let sc = p.valid && p.Pcap > 0 && !wantSync ? (P / p.Pcap) * lightRatio(p) : 0;
      if (p === self) sc *= selfScale;
      const m = p.margin;
      const lo = [p.infl.min.x - m - O.x, p.infl.min.y - m - O.y, p.infl.min.z - m - O.z].map(cmDown);
      const hi = [p.infl.max.x + m - O.x, p.infl.max.y + m - O.y, p.infl.max.z + m - O.z].map(cmUp);
      PH.set([(lo[0] | (lo[1] << 16)) >>> 0, (lo[2] | (hi[0] << 16)) >>> 0, (hi[1] | (hi[2] << 16)) >>> 0, (halfBits(p.shell) | (halfBits(m) << 16)) >>> 0], k * 4);
      C.set([p.world.x, p.world.y, p.world.z, sc], k * 4);
      D.set([p.proxy.min.x, p.proxy.min.y, p.proxy.min.z, p === self ? 1 : staleness(p)], k * 4);
      // fraction: the sky visibility at a skylit interior probe (its irradiance is scaled by V here / V there)
      const vRef = p.skylit ? Math.min(Math.max(interiors.at(p.world, _ins).V, 0.01), 0.99) : 0;
      E.set([p.proxy.max.x, p.proxy.max.y, p.proxy.max.z, p.slice + (p.outdoor ? 8 : 0) + vRef], k * 4);
    });
    interiors.setProbes(PH, C, D, E, order.length, order.filter((p) => !p.outdoor).length);
  }

  // ------------------------------------------------------------------ change detection
  const _v = new Vector3();
  function fireSignature(p) {
    const fx = ctx.fx;
    // outdoor probes are captured without fire light; a skylit porch's fires are the court's (outside its box), whose
    // changes its replay gain follows (lightLevel)
    if (!fx?.fires || p.outdoor || p.skylit) return 0;
    let s = 0;
    for (const f of fx.fires.values()) {
      const q = f.pos;
      if (q.x < p.infl.min.x - 2 || q.x > p.infl.max.x + 2 || q.y < p.infl.min.y - 2 || q.y > p.infl.max.y + 2 || q.z < p.infl.min.z - 2 || q.z > p.infl.max.z + 2) continue;
      s += (f.lightCandela || 0) * Math.max(0, f.cur || 0);
    }
    return s;
  }
  function doorSignature(p) {
    if (p.outdoor) return 0;
    let s = 0;
    for (const v of interiors.volumes) if (v.probe === p.id) for (const a of v.apertures) s += a.value;
    return s;
  }
  const sigChanged = (a, b) => Math.abs(a - b) > 0.12 * Math.max(Math.abs(a), Math.abs(b), 1e-3);
  function worldSignature() {
    const w = ctx.world;
    if (!w) return 0;
    let n = 0;
    w.traverse(() => { n++; });
    return n;
  }

  let wantSync = true;           // first frames after 'ready' (or a jump): a full capture is due
  let syncWait = SYNC_DELAY;     // … after this many frames
  let syncAt = -1;               // … or (> 0: a burst of jumps) once the clock has rested (onJump, render)
  let lastJump = -1e9;
  let worldSig = -1, worldCheck = 0, ready = started;
  const queue = [];              // amortised captures
  let clock = 0;
  /**
   * The rooms' measured luminance belongs to the previous capture: env meters them from their openings and fires
   * (roomProbe() is null while meanL is 0) and keeps its exposure snapped (meterPending) until the new capture's
   * measurement lands. Amortised work in progress is dropped (it renders the old time).
   */
  function invalidate() {
    for (const p of probes) {
      p.mode = null;
      if (!p.metered) continue;
      p.meanL = 0; p.meanLog = null; p.faceLog = null; p.meanFace = null; p.meanColor = null; p.measureSerial++;
      p.meterUntil = clock + 5; // until the capture (then METER_WAIT); a safety cap if it never comes
    }
    queue.length = 0;
  }
  const requestSync = (frames = SYNC_DELAY) => { wantSync = true; syncWait = frames; syncAt = -1; invalidate(); };
  /**
   * Clock jump. An isolated one is captured after JUMP_DELAY frames; a burst (the time panel sets the clock every
   * 90 ms while its dial is dragged) only once the clock has rested BURST_QUIET s — a full capture per step made a
   * drag stutter. Until then the probes are off (sky light + the rooms' fire fill, as env's meter assumes).
   */
  // in real time AND frames: on a slow tier a frame (often a capture's) lasts longer than the quiet period, and the
  // capped frame clock made every step of a drag look isolated (high on the HD 4600: a capture per step)
  let framesSinceJump = 1e9;
  function onJump() {
    const now = performance.now();
    const burst = now - lastJump < BURST_GAP * 1000 || framesSinceJump < 3;
    lastJump = now;
    framesSinceJump = 0;
    requestSync(JUMP_DELAY);
    if (burst) syncAt = 1; // due once quiet (render)
  }
  ctx.bus.on('ready', () => { ready = true; requestSync(); worldSig = worldSignature(); });
  ctx.bus.on('time:jump', onJump);
  ctx.bus.on('time:date', onJump);

  function schedule(dt) {
    const sun = ctx.time?.sun?.dir;
    const keyMoon = !!ctx.env?.keyIsMoon;
    const step = (SUN_STEP[tierKey] || 3) * DEG;
    worldCheck += dt;
    if (ready && worldCheck > 1) {
      worldCheck = 0;
      const s = worldSignature();
      if (s !== worldSig) { worldSig = s; requestSync(); }
    }
    for (const p of probes) {
      if (p.mode) continue;
      const fs = fireSignature(p), ds = doorSignature(p);
      const moved = sun && (p.sunAt.y < -1.5 || p.sunAt.angleTo(sun) > step);
      // at most one refresh a probe per MIN_REFRESH s; back to back in a time-lapse (the light changes 10× in a few
      // sim-minutes at twilight, and a stale room probe set the eye apart from what was drawn: flicker at 600×)
      const fast = !ctx.time?.paused && Math.abs(ctx.time?.speed || 0) > 20;
      if (clock - p.doneAt < (fast ? MIN_REFRESH_FAST : MIN_REFRESH)) continue;
      // the sky through the openings changed (twilight: ~1.5× every couple of sim-minutes at 1×)
      const drift = skyDrift(p) > Math.log(1.6) && (ctx.env?.globalIlluminance || 0) * interiors.at(p.world, _ins).V > 1e-3;
      if (moved || drift || keyMoon !== p.keyMoon || sigChanged(fs, p.fireSig) || sigChanged(ds, p.doorSig)) {
        p.mode = 'amortised'; p.face = 0; p.pass = 0;
        queue.push(p);
      }
    }
  }

  // ------------------------------------------------------------------ capture
  function stamp(p) {
    p.doneAt = clock;
    const sun = ctx.time?.sun?.dir;
    if (sun) p.sunAt.copy(sun);
    p.keyMoon = !!ctx.env?.keyIsMoon;
    p.fireSig = fireSignature(p);
    p.doorSig = doorSignature(p);
  }

  function missingShadowMap() {
    if (!renderer.shadowMap.enabled) return false;
    let missing = false;
    scene.traverseVisible((o) => { if (!missing && o.isLight && o.castShadow && o.shadow && !o.shadow.map) missing = true; });
    return missing;
  }

  /** render faces [f0, f1) of probe p into its cube target */
  function renderFaces(p, f0, f1, selfScale) {
    const fx = ctx.fx;
    const lights = fx?.pointLights?.() || null;
    let restoreLights = null;
    if (p.outdoor) {
      // an outdoor probe holds sky, Sun and Moon light only: its irradiance is used everywhere in its influence box,
      // and a fire's light is not the same everywhere — the court probe beside the altar lit every surface of the
      // night court (and every chamber through its door) like the faces next to the pyres (lighting-polish-fix).
      // The fires light the court through their real point lights (and their GGX highlights).
      // render-env-2-fix: a skylit porch (the Ulam) is captured WITH the fires' light (its gold gate leaves must mirror
      // the firelit altar and court at night, not the moonlit sky), its hot texels clamped (captureClamp)
      const saved = (lights || []).map((l) => l.intensity);
      for (const l of lights || []) l.intensity = 0;
      restoreLights = () => lights.forEach((l, i) => { l.intensity = saved[i]; });
    } else if (fx?.lightsFor) restoreLights = fx.lightsFor(p.world, { adapted: !!p.skylit });
    const prev = interiors.beginCapture(p.world, lights, { fires: !p.outdoor && !p.skylit, gain: p.capGain, clamp: p.skylit ? captureClamp(p) : 0 });
    writeUniforms(p, selfScale);
    interiors.apply();
    const people = ctx.people?.root;
    const peopleVis = people?.visible;
    if (people) people.visible = false;
    const hidden = [];
    for (const g of ctx.world?.children || []) if (g.visible && p.hide?.includes(g.name)) { g.visible = false; hidden.push(g); }
    const prevRT = renderer.getRenderTarget(), prevFace = renderer.getActiveCubeFace(), prevMip = renderer.getActiveMipmapLevel();
    const xr = renderer.xr.enabled, ac = renderer.autoClear;
    const shadowAuto = renderer.shadowMap.autoUpdate, shadowNeeds = renderer.shadowMap.needsUpdate;
    // env's key shadow (medium) is world-fixed around the viewer: keep the frame's map. render/'s cascaded sun
    // shadow (high/ultra) is fitted to the VIEW camera: let it refit for each face, or the cascades miss the probe
    const refit = !!ctx.post?.shadows;
    renderer.shadowMap.autoUpdate = refit;
    if (!refit) renderer.shadowMap.needsUpdate = false;
    renderer.xr.enabled = false;
    renderer.autoClear = true;
    try {
      const cam = p.cam;
      if (cam.coordinateSystem !== renderer.coordinateSystem) { cam.coordinateSystem = renderer.coordinateSystem; cam.updateCoordinateSystem(); }
      cam.updateMatrixWorld(true);
      const t0 = performance.now();
      withoutDiscs(() => { for (let f = f0; f < f1; f++) {
        // a shadow-casting light whose map was never rendered leaves its sampler bound to a non-depth texture and
        // every lit draw is rejected (render/index.js ensureShadowMaps): let this face render the missing maps
        if (!refit && missingShadowMap()) { renderer.shadowMap.autoUpdate = true; renderer.shadowMap.needsUpdate = true; }
        renderer.setRenderTarget(p.rt, f, 0);
        renderer.render(scene, cam.children[f]);
        if (!refit) { renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false; }
      } }, p.capGain);
      stats.faceMs = (performance.now() - t0) / Math.max(1, f1 - f0);
    } finally {
      renderer.setRenderTarget(prevRT, prevFace, prevMip);
      renderer.xr.enabled = xr;
      renderer.autoClear = ac;
      renderer.shadowMap.autoUpdate = shadowAuto;
      renderer.shadowMap.needsUpdate = shadowNeeds;
      if (people) people.visible = peopleVis;
      for (const g of hidden) g.visible = true;
      restoreLights?.();
      interiors.endCapture(prev, lights);
    }
  }

  const prof = (k, fn) => {
    const P = globalThis.__mkProbeProf;
    if (!P) return fn();
    const gl = renderer.getContext();
    gl.finish();
    const t0 = performance.now();
    const r = fn();
    gl.finish();
    P[k] = (P[k] || 0) + performance.now() - t0;
    return r;
  };
  /**
   * Output gain of a capture: a dark capture (the moonless court captured while the eye is adapted to a lamp-lit
   * room, P ≈ 4 instead of 124) fell into the half-float denormals, and their per-channel rounding came out of the
   * PMREM as green / magenta blotches on gold (lighting-polish-fix). The capture is brightened to a mean of about
   * GAIN_TARGET scene units (never darkened) and replayed × 1 / gain (its effective P_cap = P × gain).
   */
  function captureGain(p) {
    const P = ctx.env?.preExposure || 1;
    return Math.min(Math.max(GAIN_TARGET / Math.max(lightLevel(p) * 0.15 * P, 1e-12), 1), 1e4);
  }

  /**
   * The brightest a skylit probe's texel may be (scene units after the capture gain): CLAMP_MEAN × the capture's expected
   * mean (its light level × a mean reflectance × P × gain). The altar top lit from a metre by the great pile (a point
   * light, far brighter than a 2 m fire is that close) and the flames' highlights on gold were 10–700 × a face's mean;
   * the probe's irradiance spread them over the porch, which went white (render-env-2). By day nothing in the porch's
   * view (the sun disc is never captured) reaches the clamp.
   */
  function captureClamp(p) {
    const P = ctx.env?.preExposure || 1;
    return CLAMP_MEAN * lightLevel(p) * 0.15 * P * (p.capGain || 1);
  }

  function finish(p, measureMode = 'async', defer = false) {
    const t0 = performance.now();
    const Ecap = lightLevel(p), EcapPhys = lightLevel(p, false), Egcap = ctx.env?.globalIlluminance || 0, Pcap = (ctx.env?.preExposure || 1) * (p.capGain || 1);
    const apply = (tex) => { copyInto(p.slice, tex); p.Ecap = Ecap; p.EcapPhys = EcapPhys; p.Egcap = Egcap; p.Pcap = Pcap; p.valid = true; };
    if (defer && measureMode && p.metered && p.valid) {
      // amortised refresh of a metered room: the previous capture stays in the atlas until this one's measurement
      // lands, so the room's light and the eye's adaptation to it change in the same frame — swapping the light
      // first flashed the room for the frames the read-back took (600× time-lapse, lighting-polish-fix)
      p.pend = pmrem.fromCubemap(p.rt.texture, p.pend);
      const tex = p.pend.texture;
      if (!measure(p, () => apply(tex), Pcap)) apply(tex);
      stats.pmremMs = performance.now() - t0;
      return;
    }
    prof('pmrem', () => { scratch = pmrem.fromCubemap(p.rt.texture, scratch); });
    prof('copy', () => apply(scratch.texture));
    if (p.metered && measureMode) prof('measure', () => measure(p, null, Pcap));
    stats.pmremMs = performance.now() - t0;
  }

  function captureSync(p) {
    // pass 1 without the probe's previous self (it may be from another time of day), passes 2–3 see the pass
    // before: the gold room's first interreflections (later amortised refreshes keep converging)
    const passes = p.outdoor || p.skylit ? 1 : INTERIOR_PASSES[tierKey] || 2; // a skylit porch: its own bounce is minor
    p.capGain = captureGain(p);
    for (let k = 0; k < passes; k++) {
      prof('faces', () => renderFaces(p, 0, 6, k === 0 ? 0 : SELF_FEEDBACK));
      finish(p, k === passes - 1 ? 'last' : null);
    }
    if (p.metered) p.meterUntil = clock + METER_WAIT;
    stamp(p);
  }

  const stats = { captures: 0, faces: 0, lastMs: 0, faceMs: 0, pmremMs: 0, atlas: `${atlas.width}x${atlas.height}`, probes: probes.map((p) => p.id) };

  /** called by render/ each frame, after the shadow light is set up and before the main draw */
  function render(dt = 0) {
    if (!ready) return;
    clock += dt;
    framesSinceJump++;
    const t0 = performance.now();
    if (wantSync) {
      const due = syncAt > 0 ? framesSinceJump >= 3 && t0 - lastJump >= BURST_QUIET * 1000 : syncWait <= 0;
      if (!due) { if (syncAt <= 0) syncWait--; } else {
        wantSync = false;
        syncAt = -1;
        queue.length = 0;
        // every slice may be from another time of day: drop them all, then capture outdoor probes before the
        // interiors (the Kodesh sees the court through its door)
        for (const p of probes) { p.valid = false; p.mode = null; }
        const order = [...probes].sort((p, q) => Number(q.outdoor) - Number(p.outdoor));
        for (const p of order) { captureSync(p); stats.captures++; stats.faces += p.outdoor || p.skylit ? 6 : 18; }
      }
    } else {
      schedule(dt);
      const p = queue[0];
      if (p) {
        if (p.face === 0) p.capGain = captureGain(p); // one gain for all six faces of the refresh
        // a skylit porch never sees its previous self (as in its one-pass sync capture): its irradiance is scaled up
        // toward the opening (V / V at the probe, ≤ 1.5), so 0.9 × that × a pale wall's albedo can pass 1 (render-env-2)
        if (p.face < 6) { renderFaces(p, p.face, p.face + 1, p.skylit ? 0 : SELF_FEEDBACK); p.face++; stats.faces++; } else {
          finish(p, 'async', true); stamp(p); p.mode = null; queue.shift(); stats.captures++;
        }
      }
    }
    writeUniforms();
    const ms = performance.now() - t0;
    if (ms > 1) stats.lastMs = Math.round(ms * 10) / 10; // the last frame that captured something (CPU-side)
  }

  return {
    atlas,
    texture: atlas.texture,
    probes,
    stats,
    /** the valid interior probe of a room (interiors volume) with a measured luminance (env's meter), or null */
    roomProbe(vol) { return (vol && probes.find((p) => p.valid && p.metered && p.id === vol.probe && p.meanL > 0 && !wantSync)) || null; },
    /**
     * What the eye adapts to in probe p's room looking along world direction `dir` (cd/m²): log-averages — the
     * whole sphere's and a view-weighted one (centre-weighted metering) — averaged in log, × the room's light now /
     * at capture. A log-average lets the sunlit great gate behind the viewer (3 % of the sphere, 10× the walls)
     * count for what it is; the arithmetic mean it dominated kept the Kodesh murky by day (lighting-polish-fix).
     */
    roomLuminance(p, dir) {
      if (!p) return 0;
      const k = lightRatio(p);
      const all = Number.isFinite(p.meanLog) ? p.meanLog : Math.log(Math.max(p.meanL, 1e-9));
      if (!p.faceLog || !dir) return Math.exp(all) * k;
      const axes = [dir.x, -dir.x, dir.y, -dir.y, dir.z, -dir.z];
      let L = 0, W = 0;
      for (let f = 0; f < 6; f++) { const w = Math.max(axes[f], 0) ** 2 + 0.05; L += w * p.faceLog[f]; W += w; }
      return Math.exp(0.6 * all + 0.4 * (L / W)) * k;
    },
    /** true while a room's post-jump capture or its measurement is outstanding (env holds its exposure snap) */
    meterPending(vol) {
      if (!vol?.probe) return false;
      return probes.some((p) => p.metered && p.id === vol.probe && !(p.meanL > 0) && clock < (p.meterUntil || 0));
    },
    /** how much the probe `id` stands for its room now (0 none … 1): rooms fall back to their fire fill below 1 */
    coverage(id) { const p = probes.find((q) => q.id === id); return p ? coverage(p) : 0; },
    /** env: a new sky PMREM is ready */
    copySky(texture) { copyInto(0, texture); },
    /** per frame from env (exposure ratio changes with adaptation) */
    updateUniforms() { writeUniforms(); },
    render,
    /** force a full re-capture (after a couple of frames) */
    capture() { requestSync(); },
    dispose() {
      // no probe slots in the shader any more (a switch to low: scene.environment is the plain sky PMREM again)
      PH.fill(0); C.fill(0); D.fill(0); E.fill(0);
      interiors.setProbes(PH, C, D, E, 0);
      atlas.dispose(); scratch?.dispose(); copyMat.dispose(); quad.geometry.dispose();
      meanMat.dispose(); meanRT.dispose();
      for (const p of probes) { p.rt.dispose(); p.pend?.dispose(); }
    },
  };
}
