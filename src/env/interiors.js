// Interior light: runtime side of interiors-glsl.js. Converts the site volumes (volumes.js) to world space,
// keeps the K volumes nearest the camera (or a probe being captured) in the shader's uniforms, reads door /
// curtain states every frame, assigns each point light to its volume, and offers the same sky-visibility
// function on the CPU (exposure meter, fire adaptation, light ranking, probe scheduling).
//
//   ctx.env.interiors = {
//     volumes,                         // world-space volumes: { id, min, max (Vector3), base, apertures, probe }
//     at(worldPos, out?) -> { V, vol (volume or null), s }   // sky visibility at a point (all volumes)
//     occlusion(a, b) -> 0..1           // light between two points (same volume 1, else V(a)·V(b))
//     camera: { V, vol, s }             // at the camera this frame
//     setDirectAttenuation(k)           // 1: attenuate sun/moon by V (tiers without shadow maps), 0: shadows do it
//     setIntEnv(rgb, albedo)            // what rooms' openings show, per unit sky irradiance (env, per frame)
//     fireLuminance(vol)                // a room's mean surface luminance from its own fires (env's meter)
//     viewVisibility(vol, p, dir)       // sky visibility where a view ray meets the room's walls (env's meter)
//     stats
//   }
// Point lights arrive pre-multiplied by the sky visibility at their fire (render/fx/lights.js, userData.mkV).
import { Vector3, ShaderChunk, Box3, Frustum, Matrix4, DataUtils } from 'three';
import { m2w } from '../core/units.js';
import { UniformBlock } from './uniforms.js';
import { MK_LIMITS, MK_BLOCK, installInteriorChunks } from './interiors-glsl.js';
import { defineVolumes } from './volumes.js';

const TWO_PI = 2 * Math.PI;
const _p = new Vector3();

// site axis -> world axis / sign (X → x, Y → −z, Z → y)
const W_AXIS = [0, 2, 1];
const W_SIGN = [1, -1, 1];

function toWorldBox(min, max) {
  const a = m2w(min[0], min[1], min[2]), b = m2w(max[0], max[1], max[2]);
  return { min: new Vector3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)), max: new Vector3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)) };
}

function toWorldAperture(ap, AMAH) {
  const [sax, coord, sgn] = ap.plane;
  const o = [0, 1, 2].filter((k) => k !== sax);
  // centre in site coordinates
  const c = [0, 0, 0];
  c[sax] = coord;
  c[o[0]] = (ap.rect[0][0] + ap.rect[1][0]) / 2;
  c[o[1]] = (ap.rect[0][1] + ap.rect[1][1]) / 2;
  const half = [0, 0, 0];
  half[o[0]] = Math.abs(ap.rect[1][0] - ap.rect[0][0]) / 2 * AMAH;
  half[o[1]] = Math.abs(ap.rect[1][1] - ap.rect[0][1]) / 2 * AMAH;
  const wax = W_AXIS[sax];
  // half extents along the two OTHER world axes, in world axis order (x,y,z minus wax)
  const wHalf = [0, 0, 0];
  for (let s = 0; s < 3; s++) wHalf[W_AXIS[s]] = half[s];
  const wo = [0, 1, 2].filter((k) => k !== wax);
  return { centre: m2w(c[0], c[1], c[2]), axis: wax, sign: sgn * W_SIGN[sax], hx: wHalf[wo[0]], hy: wHalf[wo[1]], open: ap.open, beyond: ap.beyond, value: 0 };
}

/** exact solid angle of [0,x]×[0,y] at height h over its corner (signed in x, y) */
const omegaF = (x, y, h) => Math.atan2(x * y, h * Math.sqrt(h * h + x * x + y * y));

function apertureFraction(p, a) {
  const c = a.centre;
  const d = [c.x - p.x, c.y - p.y, c.z - p.z];
  let h = d[a.axis] * a.sign;
  if (h <= 0 || a.value <= 0) return 0;
  const o = a.axis === 0 ? [1, 2] : a.axis === 1 ? [0, 2] : [0, 1];
  const cx = d[o[0]], cy = d[o[1]];
  h = Math.max(h, 1e-3);
  const x0 = cx - a.hx, x1 = cx + a.hx, y0 = cy - a.hy, y1 = cy + a.hy;
  const om = omegaF(x1, y1, h) - omegaF(x0, y1, h) - omegaF(x1, y0, h) + omegaF(x0, y0, h);
  return Math.min(1, Math.max(0, om / TWO_PI)) * a.value;
}

// half floats rounded outward (the shader's coarse room test reads a room's box as six halves in one uvec4)
const half = (v) => DataUtils.toHalfFloat(v);
const unhalf = (h) => DataUtils.fromHalfFloat(h);
const halfStep = (h, up) => {
  const neg = (h & 0x8000) !== 0, mag = h & 0x7fff;
  if (up) return neg ? (mag === 0 ? 1 : h - 1) : h + 1;
  return neg ? h + 1 : (mag === 0 ? 0x8001 : h - 1);
};
function halfDown(v) { let h = half(v); if (unhalf(h) > v) h = halfStep(h, false); return h; }
function halfUp(v) { let h = half(v); if (unhalf(h) < v) h = halfStep(h, true); return h; }

/** insideness without the normal test (points: lights, the camera, fires) */
function inside(p, v) {
  const d = Math.min(p.x - v.min.x, v.max.x - p.x, p.y - v.min.y, v.max.y - p.y, p.z - v.min.z, v.max.z - p.z);
  if (d < -v.margin) return 0;
  const t = Math.min(1, (d + v.margin) / Math.max(v.margin, 1e-3));
  return t * t * (3 - 2 * t);
}

/** opts.probes: compile the probe loop (tiers with scene probes; env switches it on a tier change) */
export function createInteriors(ctx, opts = {}) {
  if (ctx.params?.raw?.get?.('intshader') !== '0' && !installInteriorChunks(ShaderChunk, { probes: opts.probes !== false })) return null; // ?intshader=0: logic without the shader patch (profiling)
  const { renderer, camera } = ctx;
  const AMAH = ctx.units.AMAH;
  const volumes = defineVolumes(ctx).map((v) => {
    const wb = toWorldBox(v.min, v.max);
    return { id: v.id, min: wb.min, max: wb.max, base: v.base, margin: v.margin, shell: v.shell, probe: v.probe, site: v, apertures: v.apertures.map((a) => toWorldAperture(a, AMAH)), apStart: 0, slot: -1 };
  });
  const K = MK_LIMITS.vol;
  const NA = MK_LIMITS.ap;
  const NP = MK_LIMITS.probe;
  const uni = new UniformBlock(renderer, 'MkInteriors', MK_BLOCK);
  const buf = {
    volA: new Float32Array(K * 4), volB: new Float32Array(K * 4), volC: new Float32Array(K * 4), volD: new Float32Array(K * 4),
    apA: new Float32Array(NA * 4), apB: new Float32Array(NA * 4), volH: new Uint32Array(K * 4), intP: new Float32Array(4), pt: new Float32Array(MK_LIMITS.lights * 4),
  };
  let selected = [];
  // rooms tested per fragment (each costs ≈ 1 ms a frame on the HD 4600 at low): the nearest few on weak tiers
  const TIER_VOLUMES = { low: 4, medium: 8, high: 12, ultra: 12 };
  let maxVolumes = Math.min(K, TIER_VOLUMES[ctx.quality?.key] ?? 8);
  ctx.bus?.on?.('quality:change', () => { maxVolumes = Math.min(K, TIER_VOLUMES[ctx.quality?.key] ?? 8); selPos.set(1e9, 0, 0); });
  let lastProbeFor = null;
  const selPos = new Vector3(1e9, 0, 0);
  let directK = 0;
  let camVolSlot = 0;
  let debugView = Number(ctx.params?.raw?.get?.('intdebug')) || 0;
  const hdr = { ua: [1e9, 1e9, 1e9], ub: [-1e9, -1e9, -1e9], probes: 0, ptRoom: 0, capture: false, invW: 0 };
  const stats = { volumes: volumes.length, selected: 0, apertures: 0, uploads: 0 };

  /** read door / curtain states (cheap); true when any aperture changed noticeably */
  function readApertures() {
    let changed = false;
    for (const v of volumes) {
      for (const a of v.apertures) {
        let o;
        try { o = a.open(); } catch { o = 1; }
        const val = Math.max(0, Math.min(1, Number.isFinite(o) ? o : 1)) * a.beyond;
        if (Math.abs(val - a.value) > 0.01 || (val === 0) !== (a.value === 0)) { a.value = val; changed = true; }
      }
    }
    return changed;
  }

  function distToBox(p, v) {
    const dx = Math.max(v.min.x - p.x, 0, p.x - v.max.x);
    const dy = Math.max(v.min.y - p.y, 0, p.y - v.max.y);
    const dz = Math.max(v.min.z - p.z, 0, p.z - v.max.z);
    return Math.hypot(dx, dy, dz);
  }

  /**
   * Choose the rooms the shader tests (≤ maxVolumes): by how large they appear from `pos` (r² / (d² + r²): 1 when
   * inside), rooms outside the view frustum (when one is given) nearly last — the Ulam and the Kodesh seen through
   * the court must win over the small chambers beside the viewer.
   */
  const _box = new Box3();
  const _home = { V: 1, vol: null, s: 0 }, _hb = new Box3(), _vb = new Box3();
  function select(pos, frustum = null) {
    for (const v of volumes) v.slot = -1;
    // the room the point is in, and the rooms touching it (a passage through its wall, the next room beyond a
    // curtain): small, but they are what is seen from inside (lighting-polish-fix: the NE ta's door beside the great
    // gate lost to bigger, farther rooms and its walls read as open sky)
    const home = at(pos, _home).s > 0.5 ? _home.vol : null;
    if (home) _hb.set(home.min, home.max).expandByScalar(0.5);
    selected = volumes.map((v) => {
      const d = distToBox(pos, v), r2 = v.min.distanceToSquared(v.max) / 4;
      let sc = r2 / (d * d + r2) / (1 + d / 25); // apparent size, damped with distance (a 240 m stoa behind the walls)
      if (frustum && d > 0 && !frustum.intersectsBox(_box.set(v.min, v.max))) sc *= 0.02;
      if (home && v !== home && _hb.intersectsBox(_vb.set(v.min, v.max))) sc = Math.max(sc * 8, 0.95); // only the home room (1) ranks higher
      return { v, sc };
    }).sort((a, b) => b.sc - a.sc).slice(0, Math.min(K, maxVolumes)).map((e) => e.v);
    selPos.copy(pos);
    pack();
  }
  const _frustum = new Frustum(), _pm = new Matrix4(), _dir = new Vector3(), selDir = new Vector3(0, 0, 0);
  function cameraFrustum() {
    camera.updateMatrixWorld();
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    return _frustum.setFromProjectionMatrix(_pm);
  }

  function pack() {
    buf.volA.fill(0); buf.volB.fill(0); buf.volC.fill(0); buf.volD.fill(0); buf.apA.fill(0); buf.apB.fill(0); buf.volH.fill(0);
    let na = 0;
    for (let k = 0; k < NA; k++) buf.apB[k * 4 + 3] = -1; // unused aperture slots belong to no volume
    selected.forEach((v, i) => {
      v.slot = i;
      // grown by the margin: the shader's coarse rejection needs no third load
      buf.volA.set([v.min.x - v.margin, v.min.y - v.margin, v.min.z - v.margin, v.base], i * 4);
      buf.volB.set([v.max.x + v.margin, v.max.y + v.margin, v.max.z + v.margin, v.shell], i * 4);
      const lo = [v.min.x - v.margin, v.min.y - v.margin, v.min.z - v.margin].map(halfDown);
      const hi = [v.max.x + v.margin, v.max.y + v.margin, v.max.z + v.margin].map(halfUp);
      buf.volH.set([(lo[0] | (lo[1] << 16)) >>> 0, (lo[2] | (hi[0] << 16)) >>> 0, (hi[1] | (hi[2] << 16)) >>> 0, 0], i * 4);
      const a0 = na;
      for (const a of v.apertures) {
        if (na >= NA) break;
        a.index = na;
        buf.apA.set([a.centre.x, a.centre.y, a.centre.z, a.value], na * 4);
        // axis code: 0..2 outward along +axis, 3..5 along −axis; w = the volume's slot
        buf.apB.set([a.hx, a.hy, a.axis + (a.sign > 0 ? 0 : 3), i], na * 4);
        na++;
      }
      buf.volC.set([a0, na - a0, v.margin, v.fill || 0], i * 4);
      buf.volD.set(v.fillAt ? [v.fillAt.x, v.fillAt.y, v.fillAt.z, v.fillR2 || 1] : [0, 0, 0, 1], i * 4);
    });
    // union of the grown boxes (the shader's first test); w = active probes (kept from setProbes)
    const ua = [1e9, 1e9, 1e9], ub = [-1e9, -1e9, -1e9];
    for (const v of selected) {
      ua[0] = Math.min(ua[0], v.min.x - v.margin); ua[1] = Math.min(ua[1], v.min.y - v.margin); ua[2] = Math.min(ua[2], v.min.z - v.margin);
      ub[0] = Math.max(ub[0], v.max.x + v.margin); ub[1] = Math.max(ub[1], v.max.y + v.margin); ub[2] = Math.max(ub[2], v.max.z + v.margin);
    }
    if (!selected.length) { ua.fill(1e9); ub.fill(-1e9); }
    hdr.ua = ua; hdr.ub = ub;
    writeHeader();
    stats.selected = selected.length;
    stats.apertures = na;
    uni.set('mkVolA', buf.volA); uni.set('mkVolB', buf.volB); uni.set('mkVolC', buf.volC);
    uni.set('mkVolD', buf.volD);
    uni.set('mkApA', buf.apA); uni.set('mkApB', buf.apB);
    uni.setU32('mkVolH', buf.volH);
    writeIntP();
  }

  /**
   * The union vec4s are all an outdoor fragment reads (interiors-glsl.js): A = union min + flags (active probes,
   * a point light in a selected room, capture, debug view), B = union max + 1 / width of scene.environment
   */
  function writeHeader() {
    const flags = Math.min(hdr.probes, 3) + (hdr.ptRoom ? 4 : 0) + (hdr.capture ? 8 : 0) + 16 * debugView;
    uni.set('mkUnionA', [hdr.ua[0], hdr.ua[1], hdr.ua[2], flags]);
    uni.set('mkUnionB', [hdr.ub[0], hdr.ub[1], hdr.ub[2], hdr.invW]);
  }
  function writeIntP() {
    buf.intP[0] = selected.length; buf.intP[1] = camVolSlot; buf.intP[2] = directK; buf.intP[3] = debugView;
    uni.set('mkIntP', buf.intP);
  }

  /** sky visibility at a world point over ALL volumes (not only the selected ones) */
  function at(p, out = { V: 1, vol: null, s: 0 }) {
    let best = 0, bv = null;
    for (const v of volumes) {
      if (p.x < v.min.x - v.margin || p.x > v.max.x + v.margin || p.y < v.min.y - v.margin || p.y > v.max.y + v.margin
        || p.z < v.min.z - v.margin || p.z > v.max.z + v.margin) continue;
      const s = inside(p, v);
      if (s > best) { best = s; bv = v; }
    }
    if (!bv) { out.V = 1; out.vol = null; out.s = 0; return out; }
    let V = bv.base;
    for (const a of bv.apertures) V += apertureFraction(p, a);
    V = Math.min(1, Math.max(0, V));
    out.V = 1 + (V - 1) * best; out.vol = bv; out.s = best; out.raw = V;
    return out;
  }

  /**
   * Sky visibility in room `v` at the surface the ray (p, dir) meets — 85 % of the way to the room box's boundary:
   * how bright the part of the room in view is (the walls beside the great gate vs the far end), for env's meter
   * where no probe measured the room (lighting-polish-fix)
   */
  const _h = new Vector3();
  function viewVisibility(v, p, dir) {
    let t = Infinity;
    for (const [o, d, lo, hi] of [[p.x, dir.x, v.min.x, v.max.x], [p.y, dir.y, v.min.y, v.max.y], [p.z, dir.z, v.min.z, v.max.z]]) {
      if (Math.abs(d) > 1e-6) t = Math.min(t, ((d > 0 ? hi : lo) - o) / d);
    }
    if (!Number.isFinite(t) || t <= 0) return null;
    _h.copy(p).addScaledVector(dir, 0.85 * t);
    let V = v.base;
    for (const a of v.apertures) V += apertureFraction(_h, a);
    return Math.min(1, Math.max(0, V));
  }

  const _a = { V: 1, vol: null, s: 0 }, _b = { V: 1, vol: null, s: 0 };
  /** light travelling from a to b: 1 in the same volume (or both outdoors), else through both volumes' openings */
  function occlusion(a, b, ia = null) {
    const A = ia || at(a, _a);
    const B = at(b, _b);
    if (A.vol === B.vol) return 1;
    return A.V * B.V;
  }

  /** point lights (shader order) → their volume slot + sky visibility */
  const _lv = { V: 1, vol: null, s: 0 };
  const intQ = new Float32Array(4);
  /** 1 / width of scene.environment (the probe atlas or the plain sky PMREM): env calls this on every refresh */
  function setEnvWidth(w) { hdr.invW = w > 0 ? 1 / w : 0; writeHeader(); }
  /**
   * what a room's openings show (rgb radiance per unit sky irradiance: the lit court stone and a little sky) and the
   * albedo of rooms' own surfaces in reflections — env, every frame
   */
  const intEnv = new Float32Array(4);
  function setIntEnv(rgb, albedo) {
    intEnv[0] = rgb[0]; intEnv[1] = rgb[1]; intEnv[2] = rgb[2]; intEnv[3] = albedo;
    uni.set('mkIntEnv', intEnv);
  }
  // y = the sky visibility fx already multiplied the light by (lights.js, userData.mkV): a fragment in the light's
  // own room divides it out, one in another room multiplies its own; an outdoor fragment reads nothing
  function writeLights(lights) {
    buf.pt.fill(0);
    if (lights) {
      for (let i = 0; i < lights.length && i < MK_LIMITS.lights; i++) {
        const l = lights[i];
        l.getWorldPosition(_p);
        const r = at(_p, _lv);
        buf.pt[i * 4] = r.vol && r.vol.slot >= 0 && r.s > 0.5 ? r.vol.slot + 1 : 0;
        buf.pt[i * 4 + 1] = Number.isFinite(l.userData.mkV) ? l.userData.mkV : 1;
      }
    }
    uni.set('mkPtVol', buf.pt);
  }

  // Fire fill: a room's own fires, spread over its surfaces and interreflected (≈ FILL_GAIN × the first bounce
  // for gilded / limestone rooms), as warm indirect light — where no probe captured the room (low tier, chambers).
  // Mean luminance ρ·E/π with E = 4π·I / area × FILL_GAIN (the fire lights' own scene units), shaped in the shader
  // by R²/(R² + d²) around the fires (R = a third of the room's size): FILL_PEAK × the mean next to the lamps.
  const FILL_GAIN = 1.6, FILL_RHO = 0.75, FILL_PEAK = 2.0;
  const _f = { V: 1, vol: null, s: 0 };
  const fillCol = new Float32Array([1, 0.46, 0.16, 0]);
  uni.set('mkFillCol', fillCol);
  // gainOverride: a probe capture's (env's exposure, without the viewer's local adaptation to firelight that fx's
  // own P carries — the capture is normalised by env's exposure)
  function updateFill(probeFor, gainOverride = 0) {
    const fx = ctx.fx;
    const gain = gainOverride || fx?.stats?.P || ctx.env?.preExposure || 0;
    let changed = false;
    const I = new Map(), C = new Map();
    // the fill's colour is the fires' own light colour (linear, as the point lights render it): the previous
    // constant was the lamp preset's sRGB hex read as linear — yellower and brighter than the lamps' own light,
    // so low (fill) and medium (probe of the point-lit room) disagreed (lighting-polish-fix)
    let cr = 0, cg = 0, cb = 0, cw = 0;
    const Il = new Map(); // Σ candela × luminance of the light colour (what the point lights render)
    if (fx?.fires && gain > 0) {
      for (const f of fx.fires.values()) {
        const c = (f.lightCandela || 0) * Math.max(0, f.cur || 0);
        if (c <= 0 || !f.lightPos) continue;
        const r = at(f.lightPos, _f);
        if (!r.vol || r.s <= 0.5) continue;
        I.set(r.vol, (I.get(r.vol) || 0) + c);
        const cc = C.get(r.vol) || C.set(r.vol, new Vector3()).get(r.vol);
        cc.addScaledVector(f.lightPos, c);
        const lc = f.lightColor;
        if (lc) { cr += lc.r * c; cg += lc.g * c; cb += lc.b * c; cw += c; }
        Il.set(r.vol, (Il.get(r.vol) || 0) + c * (lc ? 0.2126 * lc.r + 0.7152 * lc.g + 0.0722 * lc.b : 1));
      }
    }
    // every room's mean surface luminance from its own fires (physical, as rendered; env's meter)
    for (const v of volumes) {
      const il = Il.get(v) || 0;
      if (!il) { v.fireL = 0; continue; }
      const dx = v.max.x - v.min.x, dy = v.max.y - v.min.y, dz = v.max.z - v.min.z;
      v.fireL = (FILL_RHO * ((4 * Math.PI * il) / (2 * (dx * dy + dy * dz + dz * dx))) * FILL_GAIN) / Math.PI;
    }
    if (cw > 0) {
      const nc = [cr / cw, cg / cw, cb / cw];
      if (Math.abs(nc[0] - fillCol[0]) + Math.abs(nc[1] - fillCol[1]) + Math.abs(nc[2] - fillCol[2]) > 1e-3) {
        fillCol.set(nc); uni.set('mkFillCol', fillCol);
      }
    }
    for (const v of selected) {
      let fill = 0;
      const c = I.get(v) || 0;
      // a room whose probe captured it needs no fill; while that probe is off or stale (after a clock jump, in a
      // time-lapse) the fill stands in for it (probeFor → its coverage 0..1)
      const cover = Math.min(Math.max(Number(probeFor?.(v)) || 0, 0), 1);
      if (c > 0 && cover < 1) {
        const dx = v.max.x - v.min.x, dy = v.max.y - v.min.y, dz = v.max.z - v.min.z;
        const area = 2 * (dx * dy + dy * dz + dz * dx);
        fill = FILL_PEAK * (FILL_RHO * ((4 * Math.PI * c) / area) * FILL_GAIN / Math.PI) * gain * (1 - cover);
        const ctr = C.get(v).multiplyScalar(1 / c);
        const R = Math.max(dx, dy, dz) / 3;
        if (!v.fillAt) v.fillAt = new Vector3();
        if (v.fillAt.distanceToSquared(ctr) > 0.01 || v.fillR2 !== R * R) { v.fillAt.copy(ctr); v.fillR2 = R * R; changed = true; }
      }
      if (Math.abs(fill - (v.fill || 0)) > 1e-3 * Math.max(fill, v.fill || 0, 1e-12)) { v.fill = fill; changed = true; }
    }
    if (changed) {
      for (const v of selected) {
        buf.volC[v.slot * 4 + 3] = v.fill || 0;
        const a = v.fillAt;
        buf.volD.set(a ? [a.x, a.y, a.z, v.fillR2 || 1] : [0, 0, 0, 1], v.slot * 4);
      }
      uni.set('mkVolC', buf.volC);
      uni.set('mkVolD', buf.volD);
    }
  }

  const cam = { V: 1, vol: null, s: 0, raw: 1 };
  /** per frame (env update): door states, camera visibility, volume selection around the camera */
  function update(probeFor = null) {
    const doorsChanged = readApertures();
    camera.getWorldPosition(_p);
    camera.getWorldDirection(_dir);
    if (_p.distanceToSquared(selPos) > 4 || _dir.dot(selDir) < 0.97 || doorsChanged || !selected.length) {
      selDir.copy(_dir);
      select(_p, cameraFrustum());
    }
    lastProbeFor = probeFor;
    updateFill(probeFor);
    at(_p, cam);
    const slot = cam.vol && cam.vol.slot >= 0 && cam.s > 0.5 ? cam.vol.slot + 1 : 0;
    if (slot !== camVolSlot) { camVolSlot = slot; writeIntP(); }
  }

  /** just before drawing: point-light membership (fx moved its lights after env's update) and upload */
  function beforeRender(lights) {
    writeLights(lights);
    uni.apply();
  }

  /** probe uniforms from probes.js: arrays of NP × vec4 */
  function setProbes(a, b, c, d, e, f, count = MK_LIMITS.probe) {
    uni.set('mkPrA', a); uni.set('mkPrB', b); uni.set('mkPrC', c); uni.set('mkPrD', d); uni.set('mkPrE', e);
    if (f) uni.set('mkPrF', f);
    if (count !== hdr.probes) { hdr.probes = count; writeHeader(); }
  }

  /**
   * temporarily light the shader for a capture at `pos` (volumes near it, direct light attenuated);
   * opts.fires false: no fire fill (outdoor probes hold no fire light)
   */
  function beginCapture(pos, lights, opts = {}) {
    const prev = { directK, camVolSlot };
    select(pos);
    updateFill(lastProbeFor, ctx.env?.preExposure || 0);
    if (opts.fires === false) {
      for (const v of selected) buf.volC[v.slot * 4 + 3] = 0;
      uni.set('mkVolC', buf.volC);
    }
    // output gain of the capture (opts.gain; 0 = none), applied in env's tone-mapping chunk
    intQ[2] = opts.gain > 0 ? opts.gain : 0;
    uni.set('mkIntQ', intQ);
    hdr.capture = intQ[2] > 0; writeHeader();
    directK = 1;
    const r = at(pos, _lv);
    camVolSlot = r.vol && r.vol.slot >= 0 && r.s > 0.5 ? r.vol.slot + 1 : 0;
    writeIntP();
    writeLights(lights);
    uni.apply();
    return prev;
  }
  function endCapture(prev, lights) {
    directK = prev.directK;
    intQ[2] = 0;
    uni.set('mkIntQ', intQ);
    hdr.capture = false; writeHeader();
    camera.getWorldPosition(_p);
    select(_p, cameraFrustum());
    updateFill(lastProbeFor);
    camVolSlot = prev.camVolSlot;
    writeIntP();
    writeLights(lights);
    uni.apply();
  }

  return {
    volumes,
    at,
    occlusion,
    camera: cam,
    update,
    beforeRender,
    setProbes,
    setEnvWidth,
    setIntEnv,
    /** mean luminance (cd/m², as rendered) of a room's surfaces lit by its own fires, interreflected; 0 none */
    fireLuminance: (vol) => vol?.fireL || 0,
    /** sky visibility of room `vol` where the view ray from p along dir meets its walls (null: not in the room) */
    viewVisibility: (vol, p, dir) => (vol ? viewVisibility(vol, p, dir) : null),
    beginCapture,
    endCapture,
    apply: () => uni.apply(),
    setDirectAttenuation(k) { const v = Math.max(0, Math.min(1, +k || 0)); if (v !== directK) { directK = v; writeIntP(); } },
    get directAttenuation() { return directK; },
    /** how many volumes (nearest the camera) the shader tests per fragment (≤ 12) */
    get maxVolumes() { return maxVolumes; },
    set maxVolumes(n) { maxVolumes = Math.max(0, Math.min(K, Math.round(+n) || 0)); camera.getWorldPosition(_p); select(_p, cameraFrustum()); },
    /** debug view: 0 off, 1 sky visibility (grey), 2 volume tint x probe weights (r interior, g outdoor, b sky); ?intdebug=1|2 */
    get debug() { return debugView; },
    set debug(v) { debugView = Math.max(0, Math.min(2, Math.round(+v) || 0)); writeIntP(); writeHeader(); },
    get selected() { return selected.map((v) => v.id); },
    stats,
    uniforms: uni,
  };
}
