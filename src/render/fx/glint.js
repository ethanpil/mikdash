// Sun glints of mirror-polished convex bodies (render-env-2-fix): Helena's golden nivreshet over the Heichal's door —
// "when the sun rose, sparks went out of it" (Yoma 37b). At roughness ≈ 0.05–0.09 the Sun's image on a lobe is ≈ 1 mm
// across, far under a pixel at court distance (≈ 2 cm at 25 m), and specular anti-aliasing spreads it over the globe
// at ≈ 1/200 of its peak: no surface shader can show it. Physically a smooth convex mirror returns the Sun from each
// point whose normal bisects the Sun and the eye, as a point source of intensity
//   I = E⊥ · F(θi) · R1 · R2 / 4      (cd; E⊥ the beam illuminance, F gold's Fresnel, R1 R2 the principal radii there)
// — r² / 4 for a sphere of radius r. The nivreshet is gadrooned (heichal/ulam.js: 16 smooth lobes, r = R (0.93 + 0.1
// sin πf · sin^0.6 φ), flattened 0.82): each lobe's normals sweep ≈ ±40° of azimuth, so 4–5 lobes each hold such a
// point — a row of sparks across the globe, the tightly curved crests each a little dimmer than a plain sphere's one.
// Each spark's flux, I / d² at the eye, is deposited into a Gaussian of about a pixel at its point, with the eye's own
// near glare round it (CIE disability glare, 10 / θ³ + 5 / θ²: a few pixels — the bloom's kernel is far wider; nothing
// is added to the globe itself). The Sun must
// reach the globe: one BVH ray toward it (walls, the Ulam's opening) and the terrain horizon at the globe's height.
import { Mesh, PlaneGeometry, InstancedBufferGeometry, InstancedBufferAttribute, Vector3, Matrix4, DynamicDrawUsage } from 'three';

const KEY = 'heichal.nivreshet';
// the builder's lobe profile (heichal/ulam.js nivreshet())
const LOBES = 16, LOBE_AMP = 0.1, BASE = 0.93, FLAT = 0.82;
// gold's normal-incidence reflectance (materials: #ffe39d, linear)
const GOLD_F0 = [1.0, 0.768, 0.337];
const SIGMA_PX = 0.7;      // core: an isolated 1–3 px spark (the bloom prefilter's spark test)
const RAY_PERIOD = 0.25;   // s between sun-visibility rays
const MAX_SPARKS = 8;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The sparks of the lobed globe (local frame, unit equatorial radius) for the bisector h (local, unit): per lobe the
 * longitude whose surface normal points along h's azimuth, at the latitude whose normal has h's elevation.
 * Returns [{ p: [x, y, z], k: R1 R2 (unit radius²) }].
 */
function sparks(h, out) {
  out.length = 0;
  const ah = Math.atan2(h.z, h.x), eh = Math.asin(Math.max(-1, Math.min(1, h.y)));
  // the oblate spheroid (a = 1, b = FLAT): the parameter t whose normal has elevation eh, and the lobes' amplitude there
  const t = Math.atan(FLAT * Math.tan(eh));
  const ct = Math.cos(t), st = Math.sin(t);
  const amp = LOBE_AMP * Math.pow(Math.max(ct, 0), 0.6);
  // meridian radius of curvature of the spheroid at t
  const rm = (FLAT * FLAT) / Math.pow(st * st + FLAT * FLAT * ct * ct, 1.5);
  const D = (2 * Math.PI) / LOBES;
  // normal azimuth along the parallel: θ(λ) = λ − atan(r'/r), r = BASE + amp sin(πf), f = λ / D (fractional)
  const theta = (l0, f) => l0 + f * D - Math.atan((amp * Math.PI * Math.cos(Math.PI * f) / D) / (BASE + amp * Math.sin(Math.PI * f)));
  for (let k = 0; k < LOBES && out.length < MAX_SPARKS; k++) {
    const l0 = k * D;
    // θ rises monotonically over a lobe; bracket ah (wrapped about the lobe's middle)
    const mid = theta(l0, 0.5);
    const target = mid + wrap(ah - mid);
    let a = 0, b = 1;
    if (theta(l0, a) > target || theta(l0, b) < target) continue;
    for (let i = 0; i < 22; i++) { const m = (a + b) / 2; if (theta(l0, m) < target) a = m; else b = m; }
    const f = (a + b) / 2, lam = l0 + f * D;
    const r = (BASE + amp * Math.sin(Math.PI * f)) * ct;
    // dθ/dλ by a central difference; the parallel's radius of curvature r / (dθ/dλ), × 1 / cos(elevation) (Meusnier)
    const e = 1e-3;
    const dth = (theta(l0, f + e) - theta(l0, f - e)) / (2 * e * D);
    const raz = r / Math.max(dth, 1e-3) / Math.max(Math.cos(eh), 0.2);
    out.push({ p: [r * Math.cos(lam), FLAT * st * (1 + 0.06 * Math.sin(Math.PI * f)), r * Math.sin(lam)], k: Math.max(raz, 0) * rm });
  }
  return out;
}

export function createGlint(ctx, material) {
  const quad = new PlaneGeometry(2, 2);
  const geo = new InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  const iPos = new InstancedBufferAttribute(new Float32Array(MAX_SPARKS * 3), 3);
  const iCol = new InstancedBufferAttribute(new Float32Array(MAX_SPARKS * 3), 3);
  iPos.setUsage(DynamicDrawUsage); iCol.setUsage(DynamicDrawUsage);
  geo.setAttribute('iPos', iPos);
  geo.setAttribute('iCol', iCol);
  geo.instanceCount = 0;
  const mesh = new Mesh(geo, material);
  mesh.name = 'fx:glint';
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = 5;
  mesh.visible = false;
  const u = material.uniforms;
  const centre = new Vector3(), v = new Vector3(), n = new Vector3(), s = new Vector3(), o = new Vector3();
  const sl = new Vector3(), vl = new Vector3(), hl = new Vector3(), q = new Vector3();
  const inv = new Matrix4();
  let clock = 1e9, sunVis = 0, last = null;
  const list = [];
  const stats = { I: 0, vis: 0, L0: 0, n: 0 };

  /** P: env's pre-exposure (scene units per physical unit); low: no bloom; size: the target's size in px */
  function update(dt, P, low, size) {
    mesh.visible = false;
    stats.I = 0; stats.n = 0;
    const env = ctx.env, cam = ctx.camera;
    const piv = ctx.movables?.get?.(KEY);
    const globe = piv?.children?.[0];
    const R = piv?.userData?.radius;
    if (!globe || !(R > 0) || !env?.sunDir || !(env.sunBeam > 0) || env.keyIsMoon) return;
    s.copy(env.sunDir);
    if (s.y < -0.02) return;
    globe.updateWorldMatrix(true, false);
    globe.getWorldPosition(centre);
    v.copy(cam.position).sub(centre);
    const d = v.length();
    if (d < 3 * R) return;
    v.multiplyScalar(1 / d);
    n.copy(s).add(v);
    if (n.lengthSq() < 1e-8) return;
    n.normalize();
    // the Sun at the globe: terrain horizon at its height, then one ray through the built world from its sunward side
    clock += dt;
    if (clock > RAY_PERIOD || !last || last.distanceToSquared(centre) > 1e-4) {
      clock = 0;
      last = (last || new Vector3()).copy(centre);
      const alt = (Math.asin(Math.min(1, Math.max(-1, s.y))) * 180) / Math.PI;
      const az = ((Math.atan2(s.x, -s.z) * 180) / Math.PI + 360) % 360;
      const hz = env.horizonElevation ? env.horizonElevation(az, centre.y) : -90;
      let vis = smooth(-0.27, 0.27, alt - hz);
      if (vis > 0 && typeof ctx.physics?.raycast === 'function') {
        o.copy(centre).addScaledVector(n, 1.25 * R).addScaledVector(s, 0.05);
        let hit = null;
        try { hit = ctx.physics.raycast(o, s, 3000); } catch { hit = null; }
        if (hit) vis = 0;
      }
      sunVis = vis;
    }
    if (sunVis <= 0) return;
    // the sparks, in the globe's own frame (the sim may spin or swing it)
    inv.copy(globe.matrixWorld).invert();
    sl.copy(s).transformDirection(inv);
    vl.copy(v).transformDirection(inv);
    hl.copy(sl).add(vl).normalize();
    sparks(hl, list);
    if (!list.length) return;
    // gold's Fresnel at the incidence angle (Schlick); the beam's colour
    const ci = Math.max(hl.dot(sl), 0), fr = (1 - ci) ** 5;
    const bc = env.sunBeamColor;
    const F = [0, 1, 2].map((c) => (GOLD_F0[c] + (1 - GOLD_F0[c]) * fr) * (bc ? [bc.r, bc.g, bc.b][c] : 1));
    // flux at the eye over the core's footprint in solid angle (2π σ² pixels of Ω_px)
    const fov = ((cam.fov || 60) * Math.PI) / 180;
    const omegaPx = ((2 * Math.tan(fov / 2)) / Math.max(size.y, 1)) ** 2;
    const kL = P / (d * d * 2 * Math.PI * SIGMA_PX * SIGMA_PX * omegaPx);
    const E = (env.sunBeam * sunVis * R * R) / 4;
    const scale = globe.matrixWorld.getMaxScaleOnAxis();
    let n0 = 0, Isum = 0, Lmax = 0;
    for (const sp of list) {
      // local unit-radius point → world, pulled toward the viewer half a radius past the lobes' own surface (the post
      // tiers fade an emitter within 5 cm of the scene depth: the sparks must clear their own globe)
      q.set(sp.p[0] * R / scale, sp.p[1] * R / scale, sp.p[2] * R / scale).applyMatrix4(globe.matrixWorld);
      q.addScaledVector(v, 0.5 * R + 0.02);
      const I = E * sp.k;
      iPos.setXYZ(n0, q.x, q.y, q.z);
      iCol.setXYZ(n0, I * F[0] * kL, I * F[1] * kL, I * F[2] * kL);
      Isum += I * (0.2126 * F[0] + 0.7152 * F[1] + 0.0722 * F[2]);
      Lmax = Math.max(Lmax, I * kL * (0.2126 * F[0] + 0.7152 * F[1] + 0.0722 * F[2]));
      n0++;
    }
    geo.instanceCount = n0;
    iPos.needsUpdate = true; iCol.needsUpdate = true;
    // the sprite covers the eye's glare out to 1.5° (CIE disability glare, materials.js)
    const degPx = (cam.fov || 60) / Math.max(size.y, 1);
    u.uGlint.value.set(Math.min(Math.max(1.5 / degPx, 4), 48), SIGMA_PX, size.x, size.y);
    u.uGlint2.value.set(2 * Math.PI * SIGMA_PX * SIGMA_PX * omegaPx, degPx, 0, 0);
    mesh.visible = true;
    stats.I = Isum; stats.vis = sunVis; stats.L0 = Lmax; stats.n = n0;
  }

  return { mesh, update, stats, dispose() { geo.dispose(); quad.dispose(); } };
}
