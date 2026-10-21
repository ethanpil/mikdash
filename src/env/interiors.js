// Interior light: runtime side of interiors-glsl.js. Converts the site volumes (volumes.js) to world space,
// keeps the K volumes nearest the camera (or a probe being captured) in the shader's uniforms, reads door /
// curtain states every frame, assigns each point light to its volume, and offers the same sky-visibility
// function on the CPU (exposure meter, fire adaptation, light ranking, probe scheduling).
//
//   ctx.env.interiors = {
//     volumes,                         // world-space volumes: { id, min, max (Vector3), base, apertures, probe, gold }
//     at(worldPos, out?) -> { V, Vap, vol (volume or null), s }   // sky visibility at a point (all volumes); Vap: through
//                                      the room's apertures only (what reaches it from a light outside the room)
//     occlusion(a, b) -> 0..1           // light between two points (same volume 1, else V(a)·V(b))
//     openness(vol) -> 0..1             // how open a room is to the outside (its most open aperture; 1 outdoors)
//     mainVisibility(worldPos, out?) -> { V, vol }  // the sky through the room's main (first) opening, by the shader's cheap form
//     fireRecord(pos) -> index          // the fire occluder record of a fire's light (render-env-2), -1 none
//     fireRadius(size) -> m             // the flames' radius the occluders' penumbra uses
//     fireVisibility(rec, L, P, rad)    // that record's analytic occlusion between a fire and a point (CPU mirror)
//     camera: { V, vol, s }             // at the camera this frame
//     setKey(dir, slack)                // the key light's direction (sun / moon) and its mask slack (env, per frame)
//     setIntEnv(rgb, albedo)            // what rooms' openings show, per unit sky irradiance (env, per frame)
//     fireLuminance(vol)                // a room's mean surface luminance from its own fires (env's meter)
//     viewVisibility(vol, p, dir)       // sky visibility where a view ray meets the room's walls (env's meter)
//     roomGain(vol) -> [r, g, b]        // a gilded room's interreflection gain for outdoor light (1 elsewhere)
//     stats
//   }
// Point lights arrive pre-multiplied by the sky visibility at their fire (render/fx/lights.js, userData.mkV) and carry
// their fire occluder record (userData.mkRec).
import { Vector3, ShaderChunk, Box3, Frustum, Matrix4, DataUtils } from 'three';
import { m2w } from '../core/units.js';
import { UniformBlock } from './uniforms.js';
import { MK_LIMITS, MK_BLOCK, MK_FLAGS, OCC_EDGE, installInteriorChunks, setInteriorDebug } from './interiors-glsl.js';
import { defineVolumes, defineFireOccluders } from './volumes.js';

const TWO_PI = 2 * Math.PI;
const _p = new Vector3();

// site axis -> world axis / sign (X → x, Y → −z, Z → y)
const W_AXIS = [0, 2, 1];
const W_SIGN = [1, -1, 1];

// Gilded rooms without a probe (the KhK; the Kodesh on low by day): the light that comes in through the openings is
// passed on by the gold walls bounce after bounce: 1 + ρ + ρ² with ρ ≈ 0.9 × gold's F0 (materials: #ffe39d) — a
// pale, warm fill in which the bare bedrock of the Even Shetiyah reads as stone, not as a black hole (render-env-2)
const GOLD_RHO = [0.9, 0.69, 0.3];
const GOLD_GAIN = GOLD_RHO.map((r) => 1 + r + r * r);
// fire occluders: the flames' radius (m; the penumbra of the walls and of the altar's top) from the fire's size
const fireRadius = (size) => Math.min(Math.max(0.3 * (size || 0.3), 0.05), 1.2);

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
  return { centre: m2w(c[0], c[1], c[2]), axis: wax, sign: sgn * W_SIGN[sax], hx: wHalf[wo[0]], hy: wHalf[wo[1]], open: ap.open, beyond: ap.beyond, value: 0, openness: 0 };
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
// centimetre fixed point (the shader's packed apertures and probe boxes), 0 … 655.35 m
const cm = (v) => Math.max(0, Math.min(65535, Math.round(v * 100)));
const cmDown = (v) => Math.max(0, Math.min(65535, Math.floor(v * 100)));
const cmUp = (v) => Math.max(0, Math.min(65535, Math.ceil(v * 100)));
const u8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** insideness without the normal test (points: lights, the camera, fires) */
function inside(p, v) {
  const d = Math.min(p.x - v.min.x, v.max.x - p.x, p.y - v.min.y, v.max.y - p.y, p.z - v.min.z, v.max.z - p.z);
  if (d < -v.margin) return 0;
  const t = Math.min(1, (d + v.margin) / Math.max(v.margin, 1e-3));
  return t * t * (3 - 2 * t);
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** opts.probes: compile the probe loop (tiers with scene probes; env switches it on a tier change) */
export function createInteriors(ctx, opts = {}) {
  const { renderer, camera } = ctx;
  const AMAH = ctx.units.AMAH;
  const volumes = defineVolumes(ctx).map((v) => {
    const wb = toWorldBox(v.min, v.max);
    return { id: v.id, min: wb.min, max: wb.max, base: v.base, margin: v.margin, shell: v.shell, probe: v.probe, gold: v.gold, site: v, apertures: v.apertures.map((a) => toWorldAperture(a, AMAH)), apStart: 0, slot: -1 };
  });
  // the 16-bit centimetre coordinates count from here: the site from X −300, Y +900, Z −100 amot (655 m covers it)
  const origin = m2w(-300, 900, -100);
  // fire occluder records (world): every court × (on the altar's top or not)
  const occ = defineFireOccluders(ctx);
  const records = [];
  const encW = occ.enclosures.map((e) => {
    const a = m2w(e.rect[0], e.rect[1]), b = m2w(e.rect[2], e.rect[3]);
    // tops per world face: x− (site X min), x+ (X max), z− (site Y max: north), z+ (Y min: south)
    return { id: e.id, rect: [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)], tops: [e.tops[0], e.tops[1], e.tops[3], e.tops[2]].map((z) => z * AMAH), minTop: Math.min(...e.tops) * AMAH };
  });
  const plateW = occ.plates.map((p) => {
    const a = m2w(p.rect[0], p.rect[1]), b = m2w(p.rect[2], p.rect[3]);
    // the test plane 12 cm under the top: the bumps of the altar's whitewashed field stones dip below it (speckles);
    // the side faces just under the top face away from a fire on it
    return { id: p.id, rect: [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)], top: p.top * AMAH - 0.12 };
  });
  const within = (r, x, z, m = 0) => x > r[0] - m && x < r[2] + m && z > r[1] - m && z < r[3] + m;
  for (const e of encW) {
    for (const plate of [null, ...plateW.filter((p) => within(e.rect, (p.rect[0] + p.rect[2]) / 2, (p.rect[1] + p.rect[3]) / 2))]) records.push({ enc: e, plate });
  }
  if (ctx.params?.raw?.get?.('intshader') !== '0' && !installInteriorChunks(ShaderChunk, { probes: opts.probes !== false, origin: [origin.x, origin.y, origin.z], records, debug: !!Number(ctx.params?.raw?.get?.('intdebug')) })) return null; // ?intshader=0: logic without the shader patch (profiling)
  const K = MK_LIMITS.vol;
  const NA = MK_LIMITS.ap;
  const uni = new UniformBlock(renderer, 'MkInteriors', MK_BLOCK);
  const buf = {
    volA: new Float32Array(K * 4), volB: new Float32Array(K * 4), volC: new Float32Array(K * 4), volD: new Float32Array(K * 4),
    apU: new Uint32Array(NA * 4), volH: new Uint32Array(K * 4), intP: new Float32Array(4), pt: new Uint32Array(MK_LIMITS.lights),
    grid: new Uint32Array(MK_LIMITS.grid * 4), key: new Float32Array([0, 1, 0, 0.3]), occ: new Float32Array(MK_LIMITS.occ * 4),
  };
  uni.set('mkKey', buf.key);
  let selected = [];
  // rooms that may be candidates per fragment (each costs one block read where its plan cell lists it): the nearest
  // few on weak tiers
  const TIER_VOLUMES = { low: 4, medium: 8, high: 12, ultra: 12 };
  let maxVolumes = Math.min(K, TIER_VOLUMES[ctx.quality?.key] ?? 8);
  ctx.bus?.on?.('quality:change', () => { maxVolumes = Math.min(K, TIER_VOLUMES[ctx.quality?.key] ?? 8); selPos.set(1e9, 0, 0); });
  let lastProbeFor = null;
  const selPos = new Vector3(1e9, 0, 0);
  let directK = 0;
  let camVolSlot = 0;
  let debugView = Number(ctx.params?.raw?.get?.('intdebug')) || 0;
  const hdr = { ua: [1e9, 1e9, 1e9], ub: [-1e9, -1e9, -1e9], probes: 0, interiorProbes: 0, ptRoom: 0, capture: false, invW: 0, occ: 0 };
  const stats = { volumes: volumes.length, selected: 0, apertures: 0, uploads: 0, gridCells: 0, gridOverflow: 0, records: records.length };

  /** read door / curtain states (cheap); true when any aperture changed noticeably */
  function readApertures() {
    let changed = false;
    for (const v of volumes) {
      for (const a of v.apertures) {
        let o;
        try { o = a.open(); } catch { o = 1; }
        const op = Math.max(0, Math.min(1, Number.isFinite(o) ? o : 1));
        const val = op * a.beyond;
        if (Math.abs(val - a.value) > 0.01 || (val === 0) !== (a.value === 0)) { a.value = val; a.openness = op; changed = true; }
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
    // curtain): small, but they are what is seen from inside
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

  /** a room's aperture → one uvec4: centre (cm from the room's grown min), openness and brightness beyond, extents, axis */
  function packAperture(a, v, i) {
    const ox = v.min.x - v.margin, oy = v.min.y - v.margin, oz = v.min.z - v.margin;
    const c = a.centre;
    buf.apU[i * 4] = (cm(c.x - ox) | (cm(c.y - oy) << 16)) >>> 0;
    buf.apU[i * 4 + 1] = (cm(c.z - oz) | (u8(a.openness) << 16) | (u8(a.beyond) << 24)) >>> 0;
    buf.apU[i * 4 + 2] = (cm(a.hx) | (cm(a.hy) << 16)) >>> 0;
    buf.apU[i * 4 + 3] = a.axis + (a.sign > 0 ? 0 : 3);
  }
  /**
   * a gilded room's gain as 3 × 10 bits (/256); 0 = none. Not where the room's own probe exists (medium+: the Kodesh):
   * its captures already hold the bounces, and the gain would light the capture itself twice over
   */
  const gilded = (v) => !!v?.gold && !(hdr.probes > 0 && v.probe);
  // bit 30: the room has its own probe (the shader skips the reflection's exit test there)
  const gainBits = (v) => ((gilded(v) ? (Math.round(GOLD_GAIN[0] * 256) | (Math.round(GOLD_GAIN[1] * 256) << 10) | (Math.round(GOLD_GAIN[2] * 256) << 20)) : 0)
    | (hdr.probes > 0 && v.probe ? 0x40000000 : 0)) >>> 0;

  function pack() {
    buf.volA.fill(0); buf.volB.fill(0); buf.volC.fill(0); buf.volD.fill(0); buf.apU.fill(0); buf.volH.fill(0);
    let na = 0;
    selected.forEach((v, i) => {
      v.slot = i;
      // grown by the margin: the shader's coarse rejection needs no third load
      buf.volA.set([v.min.x - v.margin, v.min.y - v.margin, v.min.z - v.margin, v.base], i * 4);
      buf.volB.set([v.max.x + v.margin, v.max.y + v.margin, v.max.z + v.margin, v.shell], i * 4);
      const lo = [v.min.x - v.margin, v.min.y - v.margin, v.min.z - v.margin].map(halfDown);
      const hi = [v.max.x + v.margin, v.max.y + v.margin, v.max.z + v.margin].map(halfUp);
      buf.volH.set([(lo[0] | (lo[1] << 16)) >>> 0, (lo[2] | (hi[0] << 16)) >>> 0, (hi[1] | (hi[2] << 16)) >>> 0, gainBits(v)], i * 4);
      const a0 = na;
      for (const a of v.apertures) {
        if (na >= NA) break;
        a.index = na;
        a.room = v;
        packAperture(a, v, na);
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
    packGrid();
    writeHeader();
    stats.selected = selected.length;
    stats.apertures = na;
    uni.set('mkVolA', buf.volA); uni.set('mkVolB', buf.volB); uni.set('mkVolC', buf.volC);
    uni.set('mkVolD', buf.volD);
    uni.setU32('mkApU', buf.apU);
    uni.setU32('mkVolH', buf.volH);
    writeIntP();
  }

  /**
   * The plan grid over the union box (render-env-2): each cell lists the (≤ 4) selected rooms whose grown box overlaps
   * its column, so a fragment reads one cell instead of every room's box (8 reads a fragment on medium inside the
   * union, ≈ 11 ms a frame in the court on the HD 4600). More than four: the four highest-ranked (rare: where the
   * Heichal's passages meet).
   */
  function packGrid() {
    const g = buf.grid;
    g.fill(0);
    const NX = MK_LIMITS.gridX, NZ = MK_LIMITS.gridZ;
    if (!selected.length) { uni.setU32('mkGrid', g); return; }
    const x0 = hdr.ua[0], z0 = hdr.ua[2], sx = Math.max(hdr.ub[0] - x0, 1e-3) / NX, sz = Math.max(hdr.ub[2] - z0, 1e-3) / NZ;
    const cells = new Uint8Array(NX * NZ * 5); // count, then up to 4 slots + 1
    let filled = 0, over = 0;
    for (const v of selected) {
      const i0 = Math.max(0, Math.floor((v.min.x - v.margin - x0) / sx)), i1 = Math.min(NX - 1, Math.floor((v.max.x + v.margin - x0) / sx));
      const k0 = Math.max(0, Math.floor((v.min.z - v.margin - z0) / sz)), k1 = Math.min(NZ - 1, Math.floor((v.max.z + v.margin - z0) / sz));
      for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
        const c = (i + k * NX) * 5;
        const n = cells[c];
        if (n < 4) cells[c + 1 + n] = v.slot + 1;
        cells[c] = n + 1;
      }
    }
    for (let c = 0; c < NX * NZ; c++) {
      const n = cells[c * 5];
      if (!n) continue;
      filled++;
      // more than four: the four highest-ranked rooms (selected is in rank order)
      if (n > 4) over++;
      let bits = 0;
      for (let j = 0; j < Math.min(n, 4); j++) bits |= cells[c * 5 + 1 + j] << (4 * j);
      g[c >> 1] |= (bits & 0xffff) << ((c & 1) * 16);
    }
    for (let i = 0; i < g.length; i++) g[i] >>>= 0;
    stats.gridCells = filled; stats.gridOverflow = over;
    uni.setU32('mkGrid', g);
  }

  /**
   * The union vec4s are all an outdoor fragment reads (interiors-glsl.js): A = union min + flags (active probes, a point
   * light in a selected room, capture, debug view, the first four lights' fire occluder records), B = union max +
   * 1 / width of scene.environment
   */
  function writeHeader() {
    const flags = Math.min(hdr.probes, MK_FLAGS.probes) + (hdr.ptRoom ? MK_FLAGS.ptRoom : 0) + (hdr.capture ? MK_FLAGS.capture : 0)
      + (debugView << MK_FLAGS.debugShift) + hdr.occ + Math.min(hdr.interiorProbes, 7) * 2 ** MK_FLAGS.intShift;
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
    if (!bv) { out.V = 1; out.vol = null; out.s = 0; out.raw = 1; out.Vap = 1; return out; }
    let Va = 0;
    for (const a of bv.apertures) Va += apertureFraction(p, a);
    const V = Math.min(1, Math.max(0, bv.base + Va));
    Va = Math.min(1, Va);
    out.V = 1 + (V - 1) * best; out.vol = bv; out.s = best; out.raw = V;
    // through the apertures only (render-env-2-fix): what reaches the point from a light outside its room
    out.Vap = 1 + (Va - 1) * best;
    return out;
  }

  /**
   * render-audio-3: the share of the sky a point sees through its room's MAIN (first) opening, by the shader's own cheap
   * form (interiors-glsl.js mkAperture → mkVm; openness and brightness beyond quantised as packed), so that a ratio of the
   * two is like for like. → { V, vol } (V 0: outdoors, or that opening shut)
   */
  const _mv = { V: 1, vol: null, s: 0 };
  function mainVisibility(p, out = { V: 0, vol: null }) {
    at(p, _mv);
    out.vol = _mv.vol; out.V = 0;
    const a = _mv.vol?.apertures[0];
    if (!a) return out;
    const w = (u8(a.openness) / 255) * (u8(a.beyond) / 255);
    const c = a.centre, d = [c.x - p.x, c.y - p.y, c.z - p.z];
    const h = d[a.axis] * a.sign;
    if (!(w > 0) || h <= 0) return out;
    const o = a.axis === 0 ? [1, 2] : a.axis === 1 ? [0, 2] : [0, 1];
    const ex = Math.max(Math.abs(d[o[0]]) - a.hx, 0), ey = Math.max(Math.abs(d[o[1]]) - a.hy, 0);
    const h2 = h * h, k = h2 / (h2 + ex * ex + ey * ey);
    out.V = (1 - h / Math.sqrt(h2 + (4 * a.hx * a.hy) / Math.PI)) * k * Math.sqrt(k) * w;
    return out;
  }

  /** how open a room is to the outside: its most open aperture (doors, curtains), 1 outdoors */
  function openness(v) {
    if (!v) return 1;
    let o = 0;
    for (const a of v.apertures) o = Math.max(o, a.openness || 0);
    return o;
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
    return A.V * B.Vap;
  }

  /** the fire occluder record of a static fire light at world `pos`, -1 none */
  function fireRecord(pos) {
    if (at(pos, _a).s > 0.5) return -1; // in a room: its walls and openings (V) do the work
    let best = -1;
    records.forEach((r, i) => {
      if (!within(r.enc.rect, pos.x, pos.z, -0.05) || pos.y > r.enc.minTop) return;
      const onPlate = r.plate && within(r.plate.rect, pos.x, pos.z) && pos.y > r.plate.top && pos.y < r.plate.top + 6;
      if (r.plate && !onPlate) return;
      if (best < 0 || (r.plate && !records[best].plate)) best = i;
    });
    return best;
  }
  /**
   * CPU mirror of mkFireOcc: visibility 0..1 of the fire at L (world, flames' radius rad m) from point P, record ri.
   * plate false: the court's walls only (light ranking: a camera under the altar's top still sees the court it lights)
   */
  function fireVisibility(ri, L, P, radius = 0.3, plate = true) {
    const r = records[ri];
    if (!r) return 1;
    const dx = P.x - L.x, dy = P.y - L.y, dz = P.z - L.z, rad = Math.max(radius, 0.02);
    let vis = 1;
    if (plate && r.plate && L.y > r.plate.top && P.y < r.plate.top) {
      const t = (L.y - r.plate.top) / (L.y - P.y);
      const qx = L.x + dx * t, qz = L.z + dz * t, R = r.plate.rect;
      const sd = Math.min(qx - R[0], R[2] - qx, qz - R[1], R[3] - qz) / Math.max(1 - t, 1e-3);
      vis *= 1 - smoothstep(-rad, rad, sd);
    }
    const R = r.enc.rect;
    const outside = -Math.min(P.x - R[0], R[2] - P.x, P.z - R[1], R[3] - P.z);
    if (outside > 0) {
      const ix = Math.abs(dx) > 1e-4 ? 1 / dx : 1e4, iz = Math.abs(dz) > 1e-4 ? 1 / dz : 1e4;
      const tx = ((dx > 0 ? R[2] : R[0]) - L.x) * ix, tz = ((dz > 0 ? R[3] : R[1]) - L.z) * iz;
      const t = Math.min(tx, tz);
      const T = r.enc.tops;
      const top = tx < tz ? (dx > 0 ? T[1] : T[0]) : (dz > 0 ? T[3] : T[2]);
      vis *= 1 - smoothstep(-rad, rad, (top - (L.y + dy * t)) / Math.max(1 - t, 1e-3)) * smoothstep(0, OCC_EDGE, outside);
    }
    return vis;
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
  /** the key light's direction (world, toward the light) and the slack of its mask at openings (m) — env, per frame */
  function setKey(dir, slack) {
    buf.key[0] = dir.x; buf.key[1] = dir.y; buf.key[2] = dir.z; buf.key[3] = slack;
    uni.set('mkKey', buf.key);
  }
  // per light: low half = the sky visibility fx already multiplied it by (lights.js, userData.mkV) — a fragment in the
  // light's own room divides it out, one in another room multiplies its own; bits 16–19 its room slot + 1.
  // Fire occluders (userData.mkRec, mkRecPos, mkRecR): the record of the brightest light that has one, and every
  // light sharing that record (render-env-2-fix: the altar's small piles leaked through its body while only the
  // great pile was occluded). They are evaluated ONCE per fragment, from their intensity-weighted centroid with the
  // cluster's RMS extent as the flames' radius (three piles a few metres apart on one altar act as one wide source):
  // mkOcc = centroid, w = record + 4 × the shader-index mask of those lights + radius / 4 (fraction).
  const _occ = [];
  const OCC_MASK_BITS = 12;
  function writeLights(lights) {
    buf.pt.fill(0);
    let pr = 0;
    _occ.length = 0;
    if (lights) {
      for (let i = 0; i < lights.length && i < MK_LIMITS.lights; i++) {
        const l = lights[i];
        l.getWorldPosition(_p);
        const r = at(_p, _lv);
        const slot = r.vol && r.vol.slot >= 0 && r.s > 0.5 ? r.vol.slot + 1 : 0;
        if (slot) pr = 1;
        const V = Number.isFinite(l.userData.mkV) ? l.userData.mkV : 1;
        buf.pt[i] = (half(V) | (slot << 16)) >>> 0;
        const rec = l.userData.mkRec;
        if (Number.isInteger(rec) && rec >= 0 && rec < Math.min(records.length, 4) && l.intensity > 0 && i < OCC_MASK_BITS) _occ.push({ i, l, rec });
      }
    }
    let bits = 0;
    buf.occ.fill(0);
    if (_occ.length) {
      let top = _occ[0];
      for (const o of _occ) if (o.l.intensity > top.l.intensity) top = o;
      let w = 0, mask = 0;
      const c = _occCtr.set(0, 0, 0);
      for (const o of _occ) {
        if (o.rec !== top.rec) continue;
        const q = o.l.userData.mkRecPos || o.l.getWorldPosition(_p);
        c.addScaledVector(q, o.l.intensity); w += o.l.intensity;
        mask |= 1 << o.i;
      }
      c.multiplyScalar(1 / w);
      let r2 = 0;
      for (const o of _occ) {
        if (o.rec !== top.rec) continue;
        const q = o.l.userData.mkRecPos || o.l.getWorldPosition(_p);
        const rr = o.l.userData.mkRecR || 0.3;
        r2 += o.l.intensity * (rr * rr + q.distanceToSquared(c));
      }
      const rad = Math.min(Math.sqrt(r2 / w), 3.99);
      buf.occ.set([c.x, c.y, c.z, top.rec + 4 * mask + rad / 4], 0);
      bits = 2 ** MK_FLAGS.occShift;
      stats.occLights = mask.toString(2);
    } else stats.occLights = '';
    uni.setU32('mkPtU', buf.pt);
    uni.set('mkOcc', buf.occ);
    if (pr !== hdr.ptRoom || bits !== hdr.occ) { hdr.ptRoom = pr; hdr.occ = bits; writeHeader(); }
  }
  const _occCtr = new Vector3();

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

  /**
   * probe uniforms from probes.js: H (Uint32Array, packed influence boxes) and C, D, E (Float32Array), NP × 4 each;
   * `interior` of them come first (a fragment outside every room skips them)
   */
  function setProbes(H, C, D, E, count = MK_LIMITS.probe, interior = 0) {
    uni.setU32('mkPrH', H); uni.set('mkPrC', C); uni.set('mkPrD', D); uni.set('mkPrE', E);
    if (count !== hdr.probes || interior !== hdr.interiorProbes) {
      const had = hdr.probes > 0;
      hdr.probes = count; hdr.interiorProbes = interior; writeHeader();
      if (had !== count > 0) pack();
    }
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
    // and the brightest a captured texel may be (luminance, after the gain; 0 = none): skylit probes (probes.js)
    intQ[3] = opts.clamp > 0 ? opts.clamp : 0;
    uni.set('mkIntQ', intQ);
    hdr.capture = intQ[2] > 0 || intQ[3] > 0; writeHeader();
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
    intQ[2] = 0; intQ[3] = 0;
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
    mainVisibility,
    occlusion,
    openness,
    fireRecord,
    fireRadius,
    fireVisibility,
    records,
    origin,
    camera: cam,
    update,
    beforeRender,
    setProbes,
    setEnvWidth,
    setIntEnv,
    setKey,
    /** mean luminance (cd/m², as rendered) of a room's surfaces lit by its own fires, interreflected; 0 none */
    fireLuminance: (vol) => vol?.fireL || 0,
    /** sky visibility of room `vol` where the view ray from p along dir meets its walls (null: not in the room) */
    viewVisibility: (vol, p, dir) => (vol ? viewVisibility(vol, p, dir) : null),
    /** a gilded room's interreflection gain for the light from its openings (rgb), else [1, 1, 1] */
    roomGain: (vol) => (gilded(vol) ? GOLD_GAIN : [1, 1, 1]),
    beginCapture,
    endCapture,
    apply: () => uni.apply(),
    setDirectAttenuation(k) { const v = Math.max(0, Math.min(1, +k || 0)); if (v !== directK) { directK = v; writeIntP(); } },
    get directAttenuation() { return directK; },
    /** how many volumes (nearest the camera) the shader tests per fragment (≤ 12) */
    get maxVolumes() { return maxVolumes; },
    set maxVolumes(n) { maxVolumes = Math.max(0, Math.min(K, Math.round(+n) || 0)); camera.getWorldPosition(_p); select(_p, cameraFrustum()); },
    /**
     * debug view: 0 off, 1 sky visibility (grey), 2 volume tint x probe weights (r interior, g outdoor, b sky), 3 the
     * room path taken (r inside the union, g the plan cell lists rooms, b inside a room); ?intdebug=1|2|3
     */
    get debug() { return debugView; },
    set debug(v) {
      debugView = Math.max(0, Math.min(3, Math.round(+v) || 0));
      // the views are compiled in only when asked for (render-env-2-fix): the first use recompiles the lit materials
      if (debugView && setInteriorDebug(ShaderChunk, true)) {
        ctx.scene.traverse((o) => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) if (m.isMeshStandardMaterial) m.needsUpdate = true; });
      }
      writeIntP(); writeHeader();
    },
    get selected() { return selected.map((v) => v.id); },
    stats,
    uniforms: uni,
  };
}
