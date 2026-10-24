// The Ulam's fittings (Middot 3:8; Yoma 37a–b; Shekalim 6:4; Part VII §21 #18–#19): the cedar kelunsot tying the
// Heichal wall to the Ulam wall, the gold chains from the ceiling, the golden vine trained on cedar poles over the
// Heichal entrance, Queen Helena's golden nivreshet (movable 'heichal.nivreshet'), Zechariah's crowns in the two
// windows over the entrance (lock #28), the knives in the beit hachalifot niches, and the two curtains — the Ulam
// opening's and the great gate's (two of the thirteen parochot, Yoma 54a).
import {
  BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, TorusGeometry, TubeGeometry, CatmullRomCurve3, Mesh,
  Object3D, Vector3, Matrix4, Quaternion, Euler,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AMAH, m2w } from '../../core/units.js';
import { applyWorldUV } from '../geom.js';
import { Mesher, lathe, tube, sub3, cross3 } from './lib/geo.js';
import { Drape } from './lib/kit.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildUlam(H) {
  tieBeams(H);
  chains(H);
  vine(H);
  nivreshet(H);
  crowns(H);
  if (H.d >= 2) knives(H);
  curtains(H);
}

/** cedar kelunsot from the Heichal wall to the Ulam wall "so that it should not kick out" (Middot 3:8) ⚙ placement */
function tieBeams(H) {
  const { kit, el } = H;
  const u = el('heichal.ulam').box;
  const AY = H.axisY;
  const z1 = u.max[2] - 2.2, z0 = z1 - 1.4;            // just under the ceiling, clear of the chains' heads
  const m = kit.m('cedar', false, true);
  for (let k = 0; ; k++) {
    const dy = 4.5 + 9 * k;
    if (AY + dy > u.max[1] - 2) break;
    for (const y of [AY - dy, AY + dy]) m.box([u.min[0], y - 0.5, z0], [u.max[0], y + 0.5, z1], 'yYzZ');
  }
}

/**
 * four gold chains fixed in the Ulam ceiling and hanging to 4 amot over the floor — "by which the young kohanim climb
 * and see the crowns" (Middot 3:8; site params.topZ → params.bottomZ). A chain that is climbed is a heavy one: links
 * about 10 × 7 cm outside, of ≈ 2-cm wire (radius 0.022 amah) ⚙, one draw call of instanced links; the lowest link a
 * larger ring to take hold of ⚙.
 * Anchors 'heichal.ulam.chain-<i>' (south → north) mark the foot of each, for the sim's climbers.
 */
function chains(H) {
  const { kit, el, d } = H;
  const e = el('heichal.ulam.chains');
  const b = e.box, n = e.params.count;
  const x = (b.min[0] + b.max[0]) / 2;
  const ys = Array.from({ length: n }, (_, i) => b.min[1] + ((b.max[1] - b.min[1]) * i) / (n - 1));
  const top = e.params.topZ, bot = e.params.bottomZ;
  H.chainFeet = ys.map((y) => [x, y, bot]);
  for (const y of ys) kit.geo(lathe([[0, 0], [0.18, 0], [0.18, 0.06], [0.06, 0.1], [0, 0.1]], [x, y, top - 0.1], 12), 'gold_vessel', { collide: false });
  if (d < 1) {
    for (const y of ys) kit.geo(tube([x, y, bot], [x, y, top - 0.1], 0.05, 5), 'gold_vessel', { collide: false, castShadow: false });
    return;
  }
  // link: a stadium of wire radius w — two half-rings of centre radius r joined by straight sides, r·k from the centre
  // to each bend's centreline — so the wire keeps its thickness round the bends (a torus stretched ×k thickened it
  // ×k there, and the crossing links cut into each other). Interlocked links are pitched by the inner length
  // 2(r·k − w): each rests on the one above, and the two that cross inside a link clear each other (pitch ≥ r·k + w).
  const r = 0.05, k = 1.6, wire = 0.022, pitch = 2 * (r * k - wire);
  const A = AMAH;
  kit.set('chain-link', () => {
    const h = r * (k - 1), pts = [], arc = 8;
    for (const s of [1, -1]) {
      for (let i = 0; i <= arc; i++) {
        const a = (s > 0 ? 0 : Math.PI) + (Math.PI * i) / arc;
        pts.push(new Vector3(r * Math.cos(a) * A, (s * h + r * Math.sin(a)) * A, 0));
      }
    }
    // start at the top bend's crown so the tube's (even) segment count puts a ring at both crowns, where links bear
    const crown = arc / 2;
    const loop = [...pts.slice(crown), ...pts.slice(0, crown)];
    const g = new TubeGeometry(new CatmullRomCurve3(loop, true, 'centripetal'), d >= 3 ? 10 : d >= 2 ? 8 : 6, wire * A, d >= 3 ? 5 : d >= 2 ? 4 : 3, true);
    applyWorldUV(g);
    return g;
  }, 'gold_vessel', { cast: false });
  const q = new Quaternion(), s = new Vector3(1, 1, 1), up = new Vector3(0, 1, 0);
  const z0 = top - 0.15 - r * k;                      // the first link's centre, hung from the ceiling boss
  const ringR = 0.12, ringW = wire * 1.15;            // the end ring a hand closes on ⚙
  for (const [ci, y] of ys.entries()) {
    const turn = 0.3 + ci * 0.4;                      // each chain hangs a little differently turned
    const cnt = Math.floor((z0 - (bot + 2 * ringR)) / pitch) + 1;
    for (let i = 0; i < cnt; i++) {
      q.setFromAxisAngle(up, (i % 2) * Math.PI / 2 + turn);
      kit.inst('chain-link', new Matrix4().compose(m2w(x, y, z0 - i * pitch), q, s));
    }
    // the end ring, threaded through the last link (crossed with it), its foot at ≈ params.bottomZ
    const zLast = z0 - (cnt - 1) * pitch;
    const g = new TorusGeometry(ringR * A, ringW * A, d >= 2 ? 6 : 4, d >= 2 ? 18 : 12);
    g.rotateY(((cnt % 2) * Math.PI) / 2 + turn);
    const zc = zLast - r * k + wire + ringW - ringR;
    kit.geo(applyWorldUV(g.translate(...m2w(x, y, zc).toArray())), 'gold_vessel', { collide: false, castShadow: false });
  }
}

/**
 * a vine leaf (LOCAL meters, the blade facing +z): five pointed lobes round a stem sinus, cupped and tilted back from
 * its stalk — a thin blade of two smooth-shaded faces (indexed: one continuous highlight across the blade, not a
 * glint per facet), no side walls
 */
function leafGeometry(size, d) {
  const lobes = [0, 0.95, -0.95, 1.85, -1.85];
  const n = [16, 24, 30, 36][d];
  const rings = d >= 1 ? 2 : 1;
  const outline = [];
  for (let i = 0; i <= n; i++) {
    const phi = -2.55 + (5.1 * i) / n;
    let w = 0;
    for (const l of lobes) w = Math.max(w, Math.exp(-(((phi - l) / 0.32) ** 2)) * (l === 0 ? 1 : Math.abs(l) < 1.2 ? 0.85 : 0.62));
    const r = size * (0.32 + 0.68 * w) * (1 + 0.03 * Math.sin(phi * 9));
    outline.push([Math.sin(phi) * r, Math.cos(phi) * r * 0.95 + size * 0.15]);
  }
  const c0 = [0, size * 0.12];                         // where the stalk meets the blade
  const pos = [], idx = [];
  const lift = (x, y) => -0.16 * (x * x) / size - 0.1 * y + 0.04 * size * Math.sin((y / size) * 3);  // cup + tilt
  const thick = size * 0.012;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    pos.push(c0[0], c0[1], lift(c0[0], c0[1]) + side * thick);
    for (let k = 1; k <= rings; k++) for (const [ox, oy] of outline) {
      const x = c0[0] + ((ox - c0[0]) * k) / rings, y = c0[1] + ((oy - c0[1]) * k) / rings;
      pos.push(x, y, lift(x, y) + side * thick);
    }
    const ring = (k, i) => base + 1 + (k - 1) * (n + 1) + i;
    for (let i = 0; i < n; i++) {
      const tri = (a, b, c) => (side > 0 ? idx.push(a, b, c) : idx.push(a, c, b));
      tri(base, ring(1, i + 1), ring(1, i));
      for (let k = 1; k < rings; k++) { tri(ring(k, i), ring(k, i + 1), ring(k + 1, i + 1)); tri(ring(k, i), ring(k + 1, i + 1), ring(k + 1, i)); }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the front (+z) face must face +z
  if (g.attributes.normal.getZ(0) < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  applyWorldUV(g);
  return g;
}

/** a grape cluster (LOCAL meters, hanging down from the origin) */
function clusterGeometry(len, d, seed) {
  const R = rng(seed);
  const n = [8, 12, 16, 20][d];
  const parts = [];
  const r = len * 0.11;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const rad = len * 0.26 * (1 - 0.75 * t) * Math.sqrt(R());
    const a = R() * Math.PI * 2;
    const rr = r * (0.9 + 0.2 * R());
    const g = new IcosahedronGeometry(rr, 0);
    // smooth berries (detail 0 icosahedra come flat-shaded: a glint per facet)
    const p = g.attributes.position, nn = g.attributes.normal;
    for (let k = 0; k < p.count; k++) { const l = Math.hypot(p.getX(k), p.getY(k), p.getZ(k)) || 1; nn.setXYZ(k, p.getX(k) / l, p.getY(k) / l, p.getZ(k) / l); }
    g.translate(Math.cos(a) * rad, -len * (0.15 + 0.8 * t), Math.sin(a) * rad);
    parts.push(g);
  }
  const stem = new IcosahedronGeometry(r * 0.6, 0);
  stem.scale(0.5, 2.2, 0.5);
  stem.translate(0, -len * 0.05, 0);
  parts.push(stem);
  const g = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; }), false);
  applyWorldUV(g);
  return g;
}

/** a smooth gold tube along a curve through site points (radius r amot) → WORLD geometry */
function curveTube(pts, r, seg, radial) {
  const curve = new CatmullRomCurve3(pts.map((p) => m2w(p[0], p[1], p[2])), false, 'centripetal');
  const g = new TubeGeometry(curve, seg, r * AMAH, radial, false);
  applyWorldUV(g);
  return g;
}

/** the golden vine "standing over the entrance of the Heichal, trained on kelunsot" (Middot 3:8) ⚙ form */
function vine(H) {
  const { kit, el, d } = H;
  const b = el('heichal.ulam.vine').box;
  const AY = H.axisY;
  const wallX = b.min[0];                                   // the Heichal wall's Ulam face (163)
  const poleX = wallX + 0.55, poleZ = [b.min[2] + 1.6, b.max[2] - 0.6];   // two cedar poles
  const y0 = b.min[1], y1 = b.max[1];
  const cm = kit.m('cedar', false, true);
  const brackets = [];
  for (const z of poleZ) {
    cm.box([poleX - 0.15, y0, z - 0.15], [poleX + 0.15, y1, z + 0.15]);
    for (let y = y0 + 0.5; y <= y1 - 0.3; y += 4) { cm.box([wallX, y - 0.13, z - 0.42], [poleX + 0.12, y + 0.13, z - 0.15]); brackets.push(y); }
  }
  const R = rng(613);
  const gm = (g) => kit.geo(g, 'gold_vessel', { collide: false, castShadow: true });
  // two trunks rising from small gold sockets on the wall above the gate-curtain rod (the gate head), passing behind
  // the lower pole and over the upper one, where the canes divide along both poles ⚙
  const zBase = Math.max(b.min[2], H.gateSurround.z1) + 0.12;
  const canes = [];
  const tubeSeg = [10, 16, 28, 40][d], rad = [5, 6, 8, 10][d];
  for (const sy of [-1, 1]) {
    // clear of the pole brackets
    let yb = AY + sy * 1.8;
    for (const by of brackets) if (Math.abs(by - yb) < 0.45) yb += sy * 0.5;
    // the socket: a little gold console from the wall and a cup
    const sock = new Mesher();
    sock.box([wallX, yb - 0.12, zBase - 0.1], [wallX + 0.32, yb + 0.12, zBase]);
    gm(sock.geometry());
    gm(lathe([[0.05, 0], [0.12, 0.02], [0.13, 0.08], [0.1, 0.12], [0.08, 0.1], [0, 0.1]], [wallX + 0.2, yb, zBase], [8, 10, 14, 18][d]));
    const xb = wallX + 0.2;
    const pts = [
      [xb, yb, zBase + 0.05], [xb + 0.02, yb + sy * 0.12, zBase + 0.5], [wallX + 0.2, yb - sy * 0.08, poleZ[0]],
      [wallX + 0.24, yb + sy * 0.16, (poleZ[0] + poleZ[1]) / 2], [poleX - 0.26, yb - sy * 0.1, poleZ[1] - 0.1],
      [poleX - 0.05, yb + sy * 0.1, poleZ[1] + 0.27], [poleX + 0.22, yb + sy * 0.25, poleZ[1] + 0.05],
    ];
    gm(curveTube(pts, 0.075, tubeSeg, rad));
    for (const z of poleZ) for (const dir of [-1, 1]) {
      const start = [poleX, yb, z];
      const end = dir * sy > 0 ? (sy > 0 ? y1 - 0.2 : y0 + 0.2) : AY;   // outward to the end, inward to the middle
      canes.push({ start, endY: end, z });
    }
  }
  // canes winding round the poles (smooth curves)
  const leafPts = [], clusterPts = [];
  const caneSeg = [0.6, 0.45, 0.3, 0.22][d];
  for (const c of canes) {
    const L = Math.abs(c.endY - c.start[1]);
    const dirY = Math.sign(c.endY - c.start[1]);
    const n = Math.max(3, Math.ceil(L / caneSeg));
    const ph = R() * 6;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = c.start[1] + dirY * L * t;
      const p = [poleX + 0.21 * Math.cos(ph + t * L * 1.6), y, c.z + 0.21 * Math.sin(ph + t * L * 1.6)];
      pts.push(p);
      if (i > 0) { leafPts.push(p); if (R() < 0.42) clusterPts.push([p[0] + 0.1, p[1], p[2] - 0.2]); }
    }
    gm(curveTube(pts, 0.03, Math.max(8, n * 3), [4, 5, 6, 8][d]));
  }
  // leaves (instanced): most face the Ulam, tilted and turned at random; clusters hang below the poles
  const leafN = [60, 140, 260, 400][d], clN = [16, 34, 60, 90][d];
  const A = AMAH;
  // the vine's gold a little less than mirror-bright (chased sheet and cast grapes) ⚙ (instanced: the variant adds no
  // draw call). qa-r1-fix-world: roughness × 1.25 → × 0.9, so the leaves turned toward the sun throw a glint that carries
  // to the Mount and the hills (the smooth, randomly turned leaves no longer twinkle as a field of lights up close)
  const vineGold = kit.variant('gold-vine', 'gold_vessel', { roughness: 0.9 });
  kit.set('vine-leaf', () => leafGeometry(0.2, d), vineGold, { cast: d >= 2 });
  const e = new Euler(), q = new Quaternion(), s = new Vector3();
  for (let i = 0; i < leafN; i++) {
    const p = leafPts[Math.floor(R() * leafPts.length)];
    const off = [0.08 + R() * 0.35, (R() - 0.5) * 0.7, (R() - 0.45) * 0.7];
    const pos = m2w(p[0] + off[0], p[1] + off[1], p[2] + off[2]);
    // local leaf faces +z; turn it to face east (world +x), then turn it well away at random — a trained vine's leaves
    // face every way, so only a few mirror the low sun to any one eye
    e.set((R() - 0.5) * 2.0, Math.PI / 2 + (R() - 0.5) * 2.2, (R() - 0.5) * Math.PI);
    q.setFromEuler(e);
    const sc = 0.8 + R() * 0.4;
    kit.inst('vine-leaf', new Matrix4().compose(pos, q, s.set(sc, sc, sc)));
  }
  const clusterLen = 0.55 * A;
  kit.set('vine-cluster', () => clusterGeometry(clusterLen, d, 77), vineGold, { cast: d >= 2 });
  for (let i = 0; i < clN; i++) {
    const p = clusterPts.length ? clusterPts[Math.floor(R() * clusterPts.length)] : leafPts[0];
    const pos = m2w(p[0] + R() * 0.15, p[1] + (R() - 0.5) * 0.4, p[2] - R() * 0.15);
    q.setFromAxisAngle(new Vector3(0, 1, 0), R() * Math.PI * 2);
    const sc = 0.7 + R() * 0.6;
    kit.inst('vine-cluster', new Matrix4().compose(pos, q, s.set(sc, sc, sc)));
  }
}

/**
 * Queen Helena's golden nivreshet over the Heichal entrance (Yoma 37a–b): at sunrise "sparks went out of it" — the
 * keriat-Shema signal. Form ⚙: a lobed, faceted gold globe (gadrooned like a phiale) with a rim of small lamps, hung
 * by a gold chain from the Ulam ceiling. Each convex facet mirrors the low sun somewhere — the flash is physical
 * (no added glow, Part VIII §32). Movable 'heichal.nivreshet' (pivot at the chain's head; swing / spin by the sim).
 */
function nivreshet(H) {
  const { kit, el, d } = H;
  const e = el('heichal.ulam.nivreshet');
  const b = e.box;
  const A = AMAH;
  const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const ceil = el('heichal.ulam').box.max[2];
  // as large as the site box allows with the rim lamps (R × 1.12 + 0.12 ≤ half its width)
  const R = Math.min((b.max[0] - b.min[0]) * 0.39, ((b.max[0] - b.min[0]) / 2 - 0.12) / 1.12);
  const lobes = 16, lon = lobes * [3, 4, 6, 8][d], lat = [12, 16, 24, 32][d];
  // lobed globe in LOCAL meters, centred at the globe centre: SHARED vertices and smooth normals — every lobe is a
  // smooth convex mirror, so some point on it always mirrors the sun to the viewer (flat facets mirror only into a
  // few discrete directions and missed most viewers)
  const pos = [], idx = [];
  const P = (i, j) => {
    const phi = (Math.PI * j) / lat, lam = (2 * Math.PI * i) / lon;
    const fr = ((lobes * lam) / (2 * Math.PI)) % 1;
    const bulge = Math.sin(Math.PI * fr) * Math.pow(Math.max(0, Math.sin(phi)), 0.6);
    const r = R * (0.93 + 0.1 * bulge);
    return [r * Math.sin(phi) * Math.cos(lam) * A, R * 0.82 * Math.cos(phi) * A * (1 + 0.06 * bulge), r * Math.sin(phi) * Math.sin(lam) * A];
  };
  for (let j = 0; j <= lat; j++) for (let i = 0; i < lon; i++) pos.push(...P(i, j));
  const V = (i, j) => j * lon + (i % lon);
  for (let j = 0; j < lat; j++) for (let i = 0; i < lon; i++) idx.push(V(i, j), V(i, j + 1), V(i + 1, j + 1), V(i, j), V(i + 1, j + 1), V(i + 1, j));
  let globe = new BufferGeometry();
  globe.setAttribute('position', new Float32BufferAttribute(pos, 3));
  globe.setIndex(idx);
  globe.computeVertexNormals();
  // outward check on an equator vertex
  const eq = V(0, lat >> 1), gn = globe.attributes.normal;
  if (gn.getX(eq) * pos[eq * 3] + gn.getZ(eq) * pos[eq * 3 + 2] < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    globe.setIndex(idx);
    globe.computeVertexNormals();
  }
  applyWorldUV(globe);
  globe = globe.toNonIndexed();
  const parts = [globe];
  const lat2 = (prof, y, seg) => { const g = lathe(prof, [0, 0, 0], seg); g.translate(0, y * A, 0); return g; };
  // rim at the equator, neck and ring at the top, a finial below
  parts.push(lat2([[R * 0.98, -0.05], [R * 1.08, -0.03], [R * 1.1, 0.02], [R * 0.98, 0.05]], 0, lon / 2));
  parts.push(lat2([[0.06, 0], [0.12, 0.06], [0.1, 0.16], [0.07, 0.2], [0.05, 0.28], [0, 0.3]], R * 0.8, 12));
  parts.push(lat2([[0, -0.42], [0.04, -0.36], [0.1, -0.2], [0.14, -0.1], [0.12, -0.02], [0.05, 0]], -R * 0.8, 12));
  // seven small lamps round the rim (it is a lamp-stand — "nivreshet", Rashi) ⚙
  if (d >= 1) for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const g = lathe([[0, 0], [0.09, 0], [0.12, 0.04], [0.1, 0.08], [0.05, 0.09], [0, 0.09]], [0, 0, 0], 10);
    g.translate(Math.cos(a) * R * 1.12 * A, 0.04 * A, -Math.sin(a) * R * 1.12 * A);
    parts.push(g);
  }
  // the chain (a rod at this scale) up to the ceiling
  const chainLen = ceil - (cz + R * 0.8 + 0.3);
  const rod = lathe([[0.03, 0], [0.03, chainLen]], [0, 0, 0], 6);
  rod.translate(0, (R * 0.8 + 0.3) * A, 0);
  parts.push(rod);
  const g = mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); if (!q.attributes.uv) applyWorldUV(q); return q; }), false);
  g.computeBoundingSphere();
  // mirror-polished gold: the library's 'gold_polished' when it exists, else gold_vessel's own maps and program with
  // its roughness cut to ≈ 0.05 (a variant — no new shader program, no extra draw call: this mesh stands alone)
  const polished = kit.mat('gold_polished', null) || kit.variant('gold-polished', 'gold_vessel', { roughness: 0.65 });
  const mesh = new Mesh(g, kit.material(polished));
  mesh.name = 'heichal:nivreshet';
  mesh.castShadow = true; mesh.receiveShadow = true;
  // pivot at the chain's head in the ceiling; the mesh hangs below it
  const pivot = new Object3D();
  pivot.name = 'heichal.nivreshet';
  pivot.position.copy(m2w(cx, cy, ceil));
  mesh.position.set(0, (cz - ceil) * A, 0);
  pivot.add(mesh);
  const centreWorld = m2w(cx, cy, cz);
  pivot.userData = {
    kind: 'nivreshet', id: 'heichal.ulam.nivreshet', label: "Queen Helena's golden nivreshet",
    facing: 90, centre: centreWorld, radius: R * A,
    note: 'pivot at the chain head; rotation.y spins, rotation.x/z swing. Flash = sun mirrored by its facets (Yoma 37b).',
    /** 0..1: how squarely a facet can mirror the sun to an eye (cos of the half-angle; facets cover every direction) */
    glint(sunDir, eye) {
      if (!sunDir || !eye || sunDir.y < -0.02) return 0;
      const v = eye.clone().sub(centreWorld).normalize();
      return Math.max(0, (v.dot(sunDir) + 1) / 2);
    },
  };
  kit.add(pivot);
  H.ctx.movables.set(pivot.name, pivot);
}

/**
 * Zechariah's crowns, set in the two windows over the Heichal entrance (Bartenura on Middot 3:8; lock #28) ⚙ form:
 * a circlet with a wreath crest of pointed leaves (a period diadem, not a castellated crown), on a low stand just
 * inside each window's Ulam face — silver in the north window, gold in the south ("take silver and gold and make
 * crowns", Zechariah 6:11; which went where is not recorded).
 */
function crowns(H) {
  const { kit, el, d } = H;
  const AY = H.axisY;
  const ws = el('heichal.windows.f2').params.windows;
  for (const w of ws) {
    const key = (w.min[1] + w.max[1]) / 2 > AY ? 'silver' : 'gold_vessel';
    const r = Math.min(0.5, (w.max[1] - w.min[1]) / 2 - 0.3), h = 0.3, sh = 0.22;
    const x = w.max[0] - r - 0.25, y = (w.min[1] + w.max[1]) / 2, z = w.min[2] + sh;
    // the stand: a low moulded marble block on the sill
    const st = kit.m('marble_white', false, true);
    st.box([x - r * 0.8, y - r * 0.8, w.min[2]], [x + r * 0.8, y + r * 0.8, z - 0.05]);
    st.box([x - r * 0.88, y - r * 0.88, z - 0.05], [x + r * 0.88, y + r * 0.88, z]);
    // the circlet: a band with a beaded lower rim and a rolled upper edge
    kit.geo(lathe([[r * 0.9, 0], [r * 1.02, 0.01], [r * 1.04, 0.05], [r, 0.08], [r, h * 0.78], [r * 1.06, h * 0.86], [r * 1.04, h * 0.94], [r * 0.96, h * 0.9], [r * 0.92, 0.02]], [x, y, z], [12, 20, 32, 40][d]), key, { collide: false });
    if (d < 1) continue;
    // the crest: pointed leaves (laurel / olive-like) leaning out a little, alternately tall and short, both faces
    const m = kit.m(key, false, false);
    const nL = [0, 16, 20, 24][d];
    for (let k = 0; k < nL; k++) {
      const a = (k / nL) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const tall = k % 2 === 0 ? 0.24 : 0.15, hw = (Math.PI * r) / nL * 0.95;
      const out = [c, s, 0], tan = [-s, c, 0];
      const base = [x + c * r * 1.0, y + s * r * 1.0, z + h * 0.86];
      const P = (u, v) => [base[0] + tan[0] * u + out[0] * v * 0.35, base[1] + tan[1] * u + out[1] * v * 0.35, base[2] + v];
      const leaf = [P(-hw * 0.5, 0), P(hw * 0.5, 0), P(hw * 0.62, tall * 0.4), P(0, tall), P(-hw * 0.62, tall * 0.4)];
      const nrm = cross3(sub3(leaf[1], leaf[0]), sub3(leaf[3], leaf[0]));
      const o = nrm[0] * c + nrm[1] * s > 0 ? 1 : -1;
      m.poly(leaf, [o * nrm[0], o * nrm[1], o * nrm[2]]);
      m.poly(leaf.map((p) => [p[0] - c * 0.012, p[1] - s * 0.012, p[2]]), [-o * nrm[0], -o * nrm[1], -o * nrm[2]]);
    }
  }
}

/** knives (chalifot) in the open niches of the beit hachalifot */
function knives(H) {
  const { kit } = H;
  const m = kit.m('iron', false, false);
  const R = rng(97);
  for (const n of H.niches) {
    if (n.sealed) continue;
    const k = 2 + Math.floor(R() * 2);
    for (let i = 0; i < k; i++) {
      const x = n.x0 + 0.2 + (0.6 * i) / Math.max(1, k - 1);
      const y = n.face + n.dir * (0.25 + R() * 0.3);
      const z = n.z0 + 0.02;
      m.beam([x, y - n.dir * 0.2, z], [x + 0.03, y + n.dir * 0.25, z], 0.06, 0.012, [0, 0, 1]);
      m.beam([x, y - n.dir * 0.36, z + 0.01], [x, y - n.dir * 0.2, z + 0.01], 0.05, 0.035, [0, 0, 1]);
    }
  }
}

/** the curtain of the Ulam opening and the curtain before the great gate (Yoma 54a; Tamid 7:1 "he lifted the parochet") */
function curtains(H) {
  const { kit, el } = H;
  const T = 1 / 6;
  const uc = el('heichal.ulam-curtain').box;
  const xU = (uc.min[0] + uc.max[0]) / 2;
  const du = new Drape(kit, { id: 'heichal.ulam-curtain', a: [xU, uc.min[1]], b: [xU, uc.max[1]], z0: uc.min[2], z1: uc.max[2] - 0.15, t: T, fold: 1.5, amp: 0.13, gather: 0.17, seed: 3 });
  du.register('heichal.ulam-curtain', { open: 1, label: 'Curtain of the Ulam opening' });
  kit.geo(tube([xU, uc.min[1] - 0.3, uc.max[2] - 0.12], [xU, uc.max[1] + 0.3, uc.max[2] - 0.12], 0.07, 8, true), 'gold_vessel', { collide: false });
  // the gate curtain hangs before the outer doors with params.wallClearance (0.1 amah) of air between the wall face
  // and the deepest fold of its back face, at any open(f): the rod line is set back from the face by that clearance,
  // half the cloth's thickness and the drape's largest fold excursion toward the wall (site-model-2)
  const gce = el('heichal.gate-curtain'), gc = gce.box;
  const wallX = gce.params.wallFaceX, clear = gce.params.wallClearance;
  const gSpec = { fold: 1.3, amp: 0.1, gather: 0.2 };
  const xG = wallX + clear + Drape.backReach({ t: T, ...gSpec });
  const dg = new Drape(kit, { id: 'heichal.gate-curtain', a: [xG, gc.min[1]], b: [xG, gc.max[1]], z0: gc.min[2], z1: gc.max[2] - 0.1, t: T, ...gSpec, seed: 5 });
  dg.register('heichal.gate-curtain', { open: 1, label: 'Curtain of the Heichal gate' });
  kit.geo(tube([xG, gc.min[1] - 0.2, gc.max[2] - 0.08], [xG, gc.max[1] + 0.2, gc.max[2] - 0.08], 0.05, 8, true), 'gold_vessel', { collide: false });
  for (const y of [gc.min[1] - 0.1, gc.max[1] + 0.1]) {
    // the rod's brackets, fixed in the wall face
    const m = new Mesher();
    m.beam([wallX, y, gc.max[2] - 0.08], [xG + 0.05, y, gc.max[2] - 0.08], 0.08, 0.08);
    kit.geo(m.geometry(), 'gold_vessel', { collide: false });
  }
}
