// The double stoas of Har HaBayit — "stav lifnim mistav", a portico within a portico (Rambam BhB 5:1): two aisles of
// 10 between the Mount wall, a middle row and a front row of columns (mount.stoa.*: depth 20, bay 10, roof top +20,
// walkable flat roof — the itztaba of Shekalim 8:4 and Sukkah 4:4). Every proportion below is reconstruction
// (docs/decisions/build-mount.md): monolithic white-marble columns with an Attic base and a plain Doric-type capital
// (no figures, no foliage), a three-fascia architrave, plain frieze and cornice in white marble, a cedar beam ceiling
// (the cedar of Middot 3:8 / 4:5 is the period's roofing timber), a lime-concrete roof (ma'azivah) with a parapet of
// 10 tefachim on the open edge (Devarim 22:8), and a stair to the roof in each corner bay.
// Over the three gates that open at the Mount level the outer aisle is raised into a gate bay (soffit above the gate
// head and its inner lintel) so the 20-amah gates are not cut by the 18.7 ceiling ⚙.
import { InstancedMesh, LatheGeometry, BoxGeometry, Vector2, Matrix4, Vector3, Quaternion, BufferGeometry, Float32BufferAttribute } from 'three';
import { AMAH, m2w } from '../../core/units.js';
import { mergeGeometries } from '../geom.js';

export const STOA = {
  plinthTop: 0.45, shaftBot: 1.0, shaftTop: 15.2, abacus: [15.9, 16.4], arch: [16.4, 17.8],
  beam: [17.8, 18.7], ceil: 18.7, frieze: [17.8, 19.0], cornice: [19.0, 20.0], parapetH: 10 / 6, parapetT: 0.8,
  r: 1.0, archW: 2.2, gateHalf: 7,
};

/** column centres for the whole Mount (each corner once) */
export function stoaColumns(ctx) {
  const st = ctx.el('mount.stoa.south').params;
  const [dMid, dFront] = st.columnRowsFromWall;
  const bay = st.bay;
  const M = ctx.el('mount.floor').box.max[0];                      // 500
  const gaps = {};
  for (const side of ['south', 'north', 'east', 'west']) gaps[side] = (ctx.el(`mount.stoa.${side}`).params.gateGaps || []).map(([a, b]) => (a + b) / 2);
  const cols = [];
  const seen = new Set();
  const push = (x, y, row) => { const k = `${x.toFixed(3)},${y.toFixed(3)}`; if (!seen.has(k)) { seen.add(k); cols.push({ x, y, row }); } };
  for (const [row, d] of [['mid', dMid], ['front', dFront]]) {
    const lo = d, hi = M - d;
    // each side: fixed points (corners + gate flanks), evenly divided near the nominal bay
    const sides = [
      { side: 'south', fixed: (v) => [v, lo], range: [lo, hi] },
      { side: 'north', fixed: (v) => [v, hi], range: [lo, hi] },
      { side: 'west', fixed: (v) => [lo, v], range: [lo, hi] },
      { side: 'east', fixed: (v) => [hi, v], range: [lo, hi] },
    ];
    for (const s of sides) {
      const fixed = [s.range[0], s.range[1]];
      const pairs = [];
      for (const g of gaps[s.side]) { fixed.push(g - STOA.gateHalf, g + STOA.gateHalf); pairs.push([g - STOA.gateHalf, g + STOA.gateHalf]); }
      fixed.sort((a, b) => a - b);
      for (let i = 0; i + 1 < fixed.length; i++) {
        const a = fixed[i], b = fixed[i + 1];
        const isGate = pairs.some(([p, q]) => Math.abs(p - a) < 1e-6 && Math.abs(q - b) < 1e-6);
        const n = isGate ? 1 : Math.max(1, Math.round((b - a) / bay));
        for (let k = 0; k <= n; k++) push(...s.fixed(a + (b - a) * k / n), row);
      }
    }
  }
  return { cols, dMid, dFront, M };
}

/**
 * The raised gate bays over the outer aisle in front of the three Mount-level gates ⚙. s = along the wall,
 * t = distance from the wall's inner face. Soffit above the gate head + its inner lintel; roof at the low east
 * wall's top on the east (the Parah line), 3.6 above the stoa roof elsewhere.
 */
export function gateBays(ctx) {
  const M = ctx.el('mount.floor').box.max[0];
  const [dMid] = ctx.el('mount.stoa.south').params.columnRowsFromWall;
  const roofTop = ctx.el('mount.stoa.south').box.max[2];
  const out = [];
  for (const side of ['east', 'west', 'north', 'south']) {
    const st = ctx.el(`mount.stoa.${side}`);
    const wallTop = ctx.el(`mount.wall.${side}`).box.max[2];
    for (const [a, b] of st.params.gateGaps || []) {
      const g = (a + b) / 2;
      const low = wallTop <= roofTop + 2.5;                          // the low east wall: roof flush with its top
      const zR = low ? wallTop - 0.05 : roofTop + 3.6;
      const zS = zR - (low ? 0.55 : 1.0);
      const P = side === 'east' ? (s, t, z) => [M - t, s, z] : side === 'west' ? (s, t, z) => [t, s, z]
        : side === 'north' ? (s, t, z) => [s, M - t, z] : (s, t, z) => [s, t, z];
      const wallFace = { east: 'e', west: 'w', north: 'n', south: 's' }[side];
      const tB = dMid + STOA.archW / 2;
      const sHalf = STOA.gateHalf + STOA.archW / 2;
      const c0 = P(g - sHalf, 0, 0), c1 = P(g + sHalf, tB, 0);
      const rect = [Math.min(c0[0], c1[0]), Math.min(c0[1], c1[1]), Math.max(c0[0], c1[0]), Math.max(c0[1], c1[1])];
      out.push({ side, g, zR, zS, P, wallFace, tB, sHalf, rect, access: low, roofTop, dMid });
    }
  }
  return out;
}

function columnGeometry(detail) {
  const A = AMAH;
  const radial = [8, 12, 16, 20][Math.max(0, Math.min(3, detail))];
  const S = STOA;
  const P = [];
  const pt = (r, y) => P.push(new Vector2(r * A, y * A));
  // Attic base on the plinth: torus, scotia, torus, fillet
  if (detail >= 1) {
    pt(1.14, S.plinthTop); pt(1.26, S.plinthTop + 0.08); pt(1.25, S.plinthTop + 0.18); pt(1.12, S.plinthTop + 0.24);
    pt(1.0, S.plinthTop + 0.33); pt(1.1, S.plinthTop + 0.43); pt(1.12, S.plinthTop + 0.49); pt(1.06, S.plinthTop + 0.54);
  } else {
    pt(1.2, S.plinthTop); pt(1.2, S.plinthTop + 0.25); pt(1.08, S.plinthTop + 0.5);
  }
  // shaft with a slight entasis and taper (1.0 -> 0.86)
  const ys = detail >= 2 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
  for (const f of ys) {
    const y = S.shaftBot + (S.shaftTop - S.shaftBot) * f;
    pt(S.r * (1 - 0.14 * f * f + 0.02 * Math.sin(Math.PI * f)), y);
  }
  // capital: astragal, neck, echinus (Doric-type, plain)
  const rt = S.r * 0.86;
  if (detail >= 1) {
    pt(rt + 0.07, S.shaftTop + 0.04); pt(rt + 0.07, S.shaftTop + 0.13); pt(rt, S.shaftTop + 0.18);
    pt(rt + 0.02, S.shaftTop + 0.22); pt(rt + 0.25, S.shaftTop + 0.36); pt(rt + 0.44, S.shaftTop + 0.52); pt(rt + 0.52, S.abacus[0]);
  } else {
    pt(rt + 0.4, S.abacus[0] - 0.15); pt(rt + 0.52, S.abacus[0]);
  }
  pt(0.01, S.abacus[0]);
  const lathe = new LatheGeometry(P, radial).toNonIndexed();
  // cylindrical UVs: u = arc length at r = 1 amah (m), v = height (m)
  const uv = lathe.attributes.uv, pos = lathe.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * S.r * A, pos.getY(i));
  const plinth = new BoxGeometry(2.5 * A, S.plinthTop * A, 2.5 * A).translate(0, S.plinthTop * A / 2, 0).toNonIndexed();
  const ab = new BoxGeometry(2.9 * A, (S.abacus[1] - S.abacus[0]) * A, 2.9 * A).translate(0, (S.abacus[0] + S.abacus[1]) / 2 * A, 0).toNonIndexed();
  for (const g of [plinth, ab]) {
    const p = g.attributes.position, u = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const ny = Math.abs(n.getY(i)), nx = Math.abs(n.getX(i));
      u.setXY(i, ny > 0.5 ? p.getX(i) : (nx > 0.5 ? p.getZ(i) : p.getX(i)), ny > 0.5 ? p.getZ(i) : p.getY(i));
    }
  }
  return mergeGeometries([plinth, lathe, ab], false);
}

/** Columns: instanced; on medium+ a near LOD (full mouldings) and a far LOD (8-sided, plain base) swapped by distance. */
function buildColumns(ctx, group, cols, detail) {
  const A = AMAH, S = STOA;
  const mat = ctx.mats.get('marble_white');
  const lod = detail >= 1 && !!ctx.engine?.onUpdate;
  const near = new InstancedMesh(columnGeometry(detail), mat, cols.length);
  near.name = 'mount:stoa-columns';
  const far = lod ? new InstancedMesh(columnGeometry(0), mat, cols.length) : null;
  if (far) far.name = 'mount:stoa-columns-far';
  const mats = new Float32Array(cols.length * 16);
  const wp = new Float32Array(cols.length * 2);
  const mtx = new Matrix4(), q = new Quaternion(), one = new Vector3(1, 1, 1), p = new Vector3();
  const colTris = [];
  const ring = (cx, cz, r, y0, y1) => {
    const n = 8;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
      colTris.push(x0, y0, z0, x1, y1, z1, x1, y0, z1, x0, y0, z0, x0, y1, z0, x1, y1, z1);   // outward winding
    }
  };
  cols.forEach((c, i) => {
    m2w(c.x, c.y, 0, p);
    mtx.compose(p, q, one);
    mtx.toArray(mats, i * 16);
    wp[i * 2] = p.x; wp[i * 2 + 1] = p.z;
    ring(p.x, p.z, S.r * A * 1.02, 0, S.abacus[1] * A);
  });
  const all = [near, far].filter(Boolean);
  for (const im of all) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; group.add(im); }
  const R = [0, 90, 120, 150][Math.max(0, Math.min(3, detail))];
  const assign = (cx, cz) => {
    let kn = 0, kf = 0;
    for (let i = 0; i < cols.length; i++) {
      mtx.fromArray(mats, i * 16);
      const dx = wp[i * 2] - cx, dz = wp[i * 2 + 1] - cz;
      if (!far || dx * dx + dz * dz < R * R) near.setMatrixAt(kn++, mtx); else far.setMatrixAt(kf++, mtx);
    }
    near.count = kn; near.visible = kn > 0; near.instanceMatrix.needsUpdate = true;
    if (far) { far.count = kf; far.visible = kf > 0; far.instanceMatrix.needsUpdate = true; }
  };
  assign(250 * A, -250 * A);                                        // before the first frame: near round the Mount centre
  for (const im of all) im.computeBoundingSphere();
  if (far) {
    let lx = Infinity, lz = Infinity;
    ctx.engine.onUpdate(() => {
      const c = ctx.camera?.position;
      if (!c || (c.x - lx) ** 2 + (c.z - lz) ** 2 < 64) return;
      lx = c.x; lz = c.z;
      assign(c.x, c.z);
    }, 45);
  }
  const cg = new BufferGeometry();
  cg.setAttribute('position', new Float32BufferAttribute(new Float32Array(colTris), 3));
  ctx.addCollider(cg, 'mount.columns');
}

/**
 * A straight flight of half-steps along the E / W wall of a corner bay ⚙: treads and risers, an open sloping
 * soffit underneath (no solid mass), a moulded string along the soffit on the open side and a parapet of
 * 10 tefachim on the open side following the nosings.
 */
function buildStair(kit, xa, xb, y0, dir, n, S, roofTop, detail) {
  const D = 1.6;                                                     // vertical depth of the flight under the nosing line
  const PH = S.parapetH, PT = 0.35;
  const xi = xa === 0 ? xb : xa, nOpen = xa === 0 ? 1 : -1;         // the open (aisle) side
  const xp = xi - nOpen * PT;                                        // inner face of the parapet
  const yAt = (k) => y0 + dir * k;                                   // k = run from the foot (amot)
  const zS = (k) => Math.max(0, k + 0.5 - D);                       // soffit line
  const yTop = yAt(n * 0.5);
  const stone = 'steps_stone';
  for (let i = 0; i < n; i++) {
    const ya = yAt(i * 0.5), yb = yAt((i + 1) * 0.5), zt = (i + 1) * 0.5, zb = i * 0.5;
    kit.quad([[xa, ya, zt], [xb, ya, zt], [xb, yb, zt], [xa, yb, zt]], [0, 0, 1], stone);
    kit.quad([[xa, ya, zb], [xb, ya, zb], [xb, ya, zt], [xa, ya, zt]], [0, -dir, 0], stone);
  }
  // open side below the parapet line z = k: from the floor / soffit up to it
  const k0 = D - 0.5, kT = n * 0.5;
  kit.quad([[xi, yAt(0), 0], [xi, yAt(k0), 0], [xi, yAt(k0), k0], [xi, yAt(0), 0]], [nOpen, 0, 0], 'ashlar_plain');
  kit.quad([[xi, yAt(k0), 0], [xi, yTop, zS(kT)], [xi, yTop, kT], [xi, yAt(k0), k0]], [nOpen, 0, 0], 'ashlar_plain');
  // the soffit and the flight's upper end
  kit.quad([[xa, yAt(k0), 0], [xb, yAt(k0), 0], [xb, yTop, zS(kT)], [xa, yTop, zS(kT)]], [0, dir, -1], 'ashlar_plain');
  kit.quad([[xa, yTop, zS(kT)], [xb, yTop, zS(kT)], [xb, yTop, roofTop], [xa, yTop, roofTop]], [0, dir, 0], 'ashlar_plain', { collide: false });
  // parapet: bottom on the line through the tread backs (z = k), top 10 tefachim above the nosings
  const pb = (k) => k, pt = (k) => k + 0.5 + PH;
  kit.quad([[xi, yAt(0), pb(0)], [xi, yTop, pb(kT)], [xi, yTop, pt(kT)], [xi, yAt(0), pt(0)]], [nOpen, 0, 0], 'ashlar_plain');
  kit.quad([[xp, yAt(0), pb(0)], [xp, yTop, pb(kT)], [xp, yTop, pt(kT)], [xp, yAt(0), pt(0)]], [-nOpen, 0, 0], 'ashlar_plain');
  kit.quad([[xi, yAt(0), pt(0)], [xi, yTop, pt(kT)], [xp, yTop, pt(kT)], [xp, yAt(0), pt(0)]], [0, -dir, 1], 'marble_white');
  kit.quad([[xi, yAt(0), 0], [xp, yAt(0), 0], [xp, yAt(0), pt(0)], [xi, yAt(0), pt(0)]], [0, -dir, 0], 'ashlar_plain');
  if (detail >= 1) {
    // a moulded string along the soffit on the open side
    const so = 0.08, sh = 0.35, xo = xi + nOpen * so;
    kit.quad([[xo, yAt(k0), 0], [xo, yTop, zS(kT)], [xo, yTop, zS(kT) + sh], [xo, yAt(k0), sh]], [nOpen, 0, 0], 'marble_white', { collide: false, castShadow: false });
    kit.quad([[xi, yAt(k0), 0], [xo, yAt(k0), 0], [xo, yTop, zS(kT)], [xi, yTop, zS(kT)]], [0, dir, -1], 'marble_white', { collide: false, castShadow: false });
    kit.quad([[xi, yAt(k0), sh], [xo, yAt(k0), sh], [xo, yTop, zS(kT) + sh], [xi, yTop, zS(kT) + sh]], [0, -dir, 1], 'marble_white', { collide: false, castShadow: false });
  }
  return yTop;
}

/** The raised bay over the outer aisle in front of a Mount-level gate ⚙. */
function buildGateBay(kit, bay, detail, S) {
  const { P, g, zR, zS, tB, sHalf, wallFace, dMid } = bay;
  const aw = S.archW, hw = S.gateHalf;
  const faces = (s0, s1, t0, t1, z0, z1, mats, opts) => {
    const a = P(s0, t0, z0), b = P(s1, t1, z1);
    const m = { ...mats };
    if (Math.min(t0, t1) <= 1e-6) delete m[wallFace];               // never a face against the wall's inner face
    kit.faces([Math.min(a[0], b[0]), Math.min(a[1], b[1]), z0], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), z1], m, opts);
  };
  const all = (key) => ({ e: key, w: key, n: key, s: key, t: key, b: key });
  const slab = 0.4;
  // transverse marble architraves across the outer aisle (wall -> middle-row architrave), and the bay's side walls
  for (const sc of [g - hw, g + hw]) {
    faces(sc - aw / 2, sc + aw / 2, 0, dMid - aw / 2, S.arch[0], S.arch[1], all('marble_white'), { collide: false });
    faces(sc - aw / 2, sc + aw / 2, 0, tB, S.arch[1], zR - slab, all('marble_white'), { collide: false });
  }
  // the attic over the middle-row architrave, fronting the bay toward the Mount
  faces(g - hw + aw / 2, g + hw - aw / 2, dMid - aw / 2, tB, S.arch[1], zR - slab, all('marble_white'), { collide: false });
  // roof slab over the whole bay (walkable on the east), cedar soffit (casts the bay's shadow)
  faces(g - sHalf, g + sHalf, 0, tB, zR - slab, zR, { t: 'roof_tile', e: 'marble_white', w: 'marble_white', n: 'marble_white', s: 'marble_white' });
  // a plain projecting cornice round the bay's exposed top edge (seen over the stoa roof from the Mount)
  if (detail >= 1) faces(g - sHalf - 0.22, g + sHalf + 0.22, 0, tB + 0.22, zR - slab, zR - 0.05, all('marble_white'), { collide: false, castShadow: false });
  const a = P(g - hw + aw / 2, 0, zS), b = P(g + hw - aw / 2, dMid - aw / 2, zS);
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  kit.quad([[x0, y0, zS], [x1, y0, zS], [x1, y1, zS], [x0, y1, zS]], [0, 0, -1], 'cedar', { collide: false });
  if (detail >= 1) {
    // cedar beams along the wall, resting on the side walls
    for (let t = 2; t < dMid - aw / 2 - 0.4; t += 2) faces(g - hw + aw / 2, g + hw - aw / 2, t - 0.25, t + 0.25, zS - 0.55, zS, { e: 'cedar', w: 'cedar', n: 'cedar', s: 'cedar', b: 'cedar' }, { collide: false });
  }
  if (bay.access) {
    // the east bay's roof is the landing before Shushan HaBirah: half-steps up from the stoa roof, parapets ⚙
    const n = Math.max(1, Math.round((zR - bay.roofTop) / 0.5));
    const rise = (zR - bay.roofTop) / n;
    for (let i = 0; i < n; i++) {
      const t1 = tB + (n - i) * 0.5, t0 = t1 - 0.5;
      faces(g - 1.5, g + 1.5, t0, t1, bay.roofTop, bay.roofTop + (i + 1) * rise, { t: 'steps_stone', e: 'steps_stone', w: 'steps_stone', n: 'steps_stone', s: 'steps_stone' });
    }
    const pT = 0.5, pH = S.parapetH;
    faces(g - sHalf, g - sHalf + pT, 0, tB, zR, zR + pH, all('marble_white'));
    faces(g + sHalf - pT, g + sHalf, 0, tB, zR, zR + pH, all('marble_white'));
    faces(g - sHalf + pT, g - 1.5, tB - pT, tB, zR, zR + pH, all('marble_white'));
    faces(g + 1.5, g + sHalf - pT, tB - pT, tB, zR, zR + pH, all('marble_white'));
  }
}

export function buildStoas(ctx, kit, group, detail) {
  const S = STOA;
  const { cols, dMid, dFront, M } = stoaColumns(ctx);
  const roofTop = ctx.el('mount.stoa.south').box.max[2];
  const half = S.archW / 2;
  const Fo = dFront + half;                                         // outer face of the front entablature (from the wall)

  // ---- columns
  buildColumns(ctx, group, cols, detail);

  // ---- stairs to the roofs, one per corner bay, along the E / W walls ⚙
  const stairs = [];
  for (const [xa, xb, south] of [[M - 4, M, true], [M - 4, M, false], [0, 4, true], [0, 4, false]]) {
    const n = Math.round(roofTop / 0.5);
    const y0 = south ? 4.5 : M - 4.5;                               // a landing in the corner for the corner watch (Middot 1:1)
    const dir = south ? 1 : -1;
    const yTop = buildStair(kit, xa, xb, y0, dir, n, S, roofTop, detail);
    // the roof is open above the upper part of the flight (headroom 4 amot under the beams)
    const yHole0 = y0 + dir * (S.beam[0] - 4 + 0.5), hole = [xa, Math.min(yHole0, yTop), xb, Math.max(yHole0, yTop)];
    stairs.push({ hole, xa, xb, south, yTop });
  }

  // ---- raised gate bays
  const bays = gateBays(ctx);
  for (const bay of bays) buildGateBay(kit, bay, detail, S);
  const bayRects = bays.map((b) => b.rect);

  // ---- bands: ceiling, beams, roof, entablatures
  const holes = stairs.map((s) => s.hole);
  const bands = [
    { side: 'south', rect: [0, 0, M, Fo], across: 'Y', wall: 0, sign: 1 },
    { side: 'north', rect: [0, M - Fo, M, M], across: 'Y', wall: M, sign: -1 },
    { side: 'west', rect: [0, Fo, Fo, M - Fo], across: 'X', wall: 0, sign: 1 },
    { side: 'east', rect: [M - Fo, Fo, M, M - Fo], across: 'X', wall: M, sign: -1 },
  ];
  const rectMinus = (r, hs) => {
    // split r by the holes it contains (grid split on hole edges)
    const xs = new Set([r[0], r[2]]), ys = new Set([r[1], r[3]]);
    for (const h of hs) if (h[0] < r[2] && h[2] > r[0] && h[1] < r[3] && h[3] > r[1]) { xs.add(Math.max(h[0], r[0])); xs.add(Math.min(h[2], r[2])); ys.add(Math.max(h[1], r[1])); ys.add(Math.min(h[3], r[3])); }
    const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b), out = [];
    for (let j = 0; j + 1 < Y.length; j++) for (let i = 0; i + 1 < X.length; i++) {
      const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2;
      if (hs.some((h) => cx > h[0] && cx < h[2] && cy > h[1] && cy < h[3])) continue;
      out.push([X[i], Y[j], X[i + 1], Y[j + 1]]);
    }
    return out;
  };
  const tile = (r, z, n, key, opts) => {
    const step = 60;
    for (let x = r[0]; x < r[2] - 1e-6; x += step) for (let y = r[1]; y < r[3] - 1e-6; y += step) {
      const x1 = Math.min(x + step, r[2]), y1 = Math.min(y + step, r[3]);
      kit.quad([[x, y, z], [x1, y, z], [x1, y1, z], [x, y1, z]], [0, 0, n], key, opts);
    }
  };
  for (const B of bands) {
    // ceiling boards (inside the front entablature) and roof. The ceiling faces down, so it is what casts the
    // stoa's shadow (three renders a FrontSide material's back faces into the shadow map: the up-facing roof cannot)
    const inner = B.across === 'Y'
      ? (B.sign > 0 ? [B.rect[0], 0, B.rect[2], dFront - half] : [B.rect[0], M - dFront + half, B.rect[2], M])
      : (B.sign > 0 ? [0, B.rect[1], dFront - half, B.rect[3]] : [M - dFront + half, B.rect[1], M, B.rect[3]]);
    for (const r of rectMinus(inner, [...holes, ...bayRects])) tile(r, S.ceil, -1, 'cedar', { collide: false });
    for (const r of rectMinus(B.rect, [...holes, ...bayRects])) tile(r, roofTop, 1, 'roof_tile', { castShadow: false });
    // cedar beams across the aisles, every 2 amot, resting on the wall and the architraves ⚙
    if (detail >= 1) {
      const span = B.across === 'Y' ? [B.rect[0], B.rect[2]] : [B.rect[1], B.rect[3]];
      for (let v = span[0] + 1; v < span[1] - 0.5; v += 2) {
        let a0 = B.sign > 0 ? 0 : M - dFront + half, a1 = B.sign > 0 ? dFront - half : M;
        const bw = 0.28;
        for (const h of holes) {
          const inH = B.across === 'Y' ? (v > h[0] - bw && v < h[2] + bw) : (v > h[1] - bw && v < h[3] + bw);
          if (!inH) continue;
          if (B.across === 'Y') { if (B.sign > 0) a1 = Math.min(a1, h[1]); else a0 = Math.max(a0, h[3]); }
          else { if (B.sign > 0) a0 = Math.max(a0, h[2]); else a1 = Math.min(a1, h[0]); }
        }
        for (const bay of bays) {
          if (bay.side !== B.side || Math.abs(v - bay.g) > bay.sHalf + bw) continue;
          if (B.sign > 0) a0 = Math.max(a0, bay.tB); else a1 = Math.min(a1, M - bay.tB);
        }
        if (a1 - a0 < 1) continue;
        if (B.across === 'Y') kit.faces([v - bw, a0, S.beam[0]], [v + bw, a1, S.beam[1]], { e: 'cedar', w: 'cedar', b: 'cedar', n: 'cedar', s: 'cedar' }, { collide: false });
        else kit.faces([a0, v - bw, S.beam[0]], [a1, v + bw, S.beam[1]], { n: 'cedar', s: 'cedar', b: 'cedar', e: 'cedar', w: 'cedar' }, { collide: false });
      }
    }
  }
  // hole edges in roof/ceiling + parapets round the stair openings
  for (const s of stairs) {
    const [x0, y0, x1, y1] = s.hole;
    const xi = s.xa === 0 ? x1 : x0;                                // the open (aisle) side of the hole
    const yEnd = s.south ? y0 : y1;                                 // the lower end of the hole
    kit.quad([[xi, y0, S.beam[0]], [xi, y1, S.beam[0]], [xi, y1, roofTop], [xi, y0, roofTop]], [s.xa === 0 ? -1 : 1, 0, 0], 'ashlar_plain', { collide: false });
    kit.quad([[x0, yEnd, S.beam[0]], [x1, yEnd, S.beam[0]], [x1, yEnd, roofTop], [x0, yEnd, roofTop]], [0, s.south ? 1 : -1, 0], 'ashlar_plain', { collide: false });
    const pt = 0.5, ph = roofTop + S.parapetH;
    kit.box([s.xa === 0 ? x1 : x0 - pt, y0, roofTop], [s.xa === 0 ? x1 + pt : x0, y1, ph], 'marble_white');
    kit.box([x0 - (s.xa === 0 ? 0 : pt), s.south ? y0 - pt : y1, roofTop], [x1 + (s.xa === 0 ? pt : 0), s.south ? y0 : y1 + pt, ph], 'marble_white');
  }

  // ---- architraves (both rows), frieze, cornice and parapet (front row) — white marble ⚙
  const rowsLoop = (d) => [[d, d], [M - d, d], [M - d, M - d], [d, M - d]];
  for (const [d, front] of [[dMid, false], [dFront, true]]) {
    const L = rowsLoop(d);
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = L[k], [bx, by] = L[(k + 1) % 4];
      const alongX = ay === by;
      const lo = alongX ? Math.min(ax, bx) - half : Math.min(ay, by) - half, hi = alongX ? Math.max(ax, bx) + half : Math.max(ay, by) + half;
      const c = alongX ? ay : ax;
      const out = alongX ? (ay < M / 2 ? 1 : -1) : (ax < M / 2 ? 1 : -1);   // toward the open Mount
      const bx3 = (s0, s1, t0, t1, z0, z1, key, opts) => {
        const mn = alongX ? [s0, Math.min(t0, t1), z0] : [Math.min(t0, t1), s0, z0];
        const mx = alongX ? [s1, Math.max(t0, t1), z1] : [Math.max(t0, t1), s1, z1];
        kit.box(mn, mx, key, opts);
      };
      bx3(lo, hi, c - half, c + half, S.arch[0], S.arch[1], 'marble_white', { collide: false });
      if (!front) continue;
      // the open (plaza) face; projections stop at the re-entrant corners of the plaza (sLo..sHi)
      const face = c + out * half, back = c - out * half;
      const sLo = lo + 2 * half, sHi = hi - 2 * half;
      if (detail >= 1) {                                            // three fasciae on the open face
        bx3(sLo, sHi, face, face + out * 0.06, S.arch[0] + 0.45, S.arch[1], 'marble_white', { collide: false, castShadow: false });
        bx3(sLo, sHi, face, face + out * 0.12, S.arch[0] + 0.95, S.arch[1], 'marble_white', { collide: false, castShadow: false });
      }
      bx3(lo, hi, back, face, S.frieze[0], S.frieze[1], 'marble_white', { collide: false });
      bx3(sLo, sHi, face, face + out * 0.2, S.frieze[0], S.frieze[1], 'marble_white', { collide: false });
      bx3(sLo, sHi, face, face + out * 0.9, S.cornice[0], S.cornice[1], 'marble_white');
      if (detail >= 1) bx3(sLo, sHi, face + out * 0.2, face + out * 0.55, S.cornice[0] - 0.25, S.cornice[0], 'marble_white', { collide: false, castShadow: false });
      // parapet of 10 tefachim on the roof edge (Devarim 22:8 minimum) ⚙
      bx3(sLo, sHi, face + out * 0.9 - out * S.parapetT, face + out * 0.9, roofTop, roofTop + S.parapetH, 'marble_white');
    }
  }
  return { columns: cols.length, stairs, bays };
}
