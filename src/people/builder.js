// Procedural mesh builder for skinned figures and props.
// Every vertex carries: position, uv (meters along the surface), colour multiplier (linear), up to 4 bone
// indices + weights, and pMat = (roughness, metalness, pattern id, colour class + 8 * optional group).
// Geometry is authored in the rig's REST pose (figure space, meters; figure faces -z).
import {
  BufferGeometry, Float32BufferAttribute, Uint8BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute,
  Vector3, Color, Matrix4,
} from 'three';

// colour classes (vertex shader palette)
export const CLS = { FIX: 0, SKIN: 1, HAIR: 2, GA: 3, GB: 4, STRIPE: 5 };
// fragment detail patterns
export const PAT = {
  NONE: 0, SKIN: 1, LINEN_BOX: 2, WOOL: 3, METAL: 4, AVNET: 5, TECHELET: 6, EPHOD: 7, LINEN: 8, HAIR: 9,
  FLEECE: 10, WOOD: 11, HORN: 12, GEM: 13, TZITZ: 14, WOOL_CLAVI: 15, REED: 16, MEAT: 17, CORD: 18, FACE: 19,
  FAT: 20, COAT: 21, EYE: 22, HAIR_SHELL: 23, FLEECE_SHELL: 24, FACE1: 25, WOUND: 26, AEYE: 27, ROPE: 28, SALT: 29,
  BREAD: 30, FLOUR: 31, LIQUID: 32, FEATHER: 33, NAIL: 34, COAT_LONG: 35, MUZZLE: 36, HIDE: 38,
};

const _c = new Color();
export function lin(hex) { _c.set(hex); return [_c.r, _c.g, _c.b]; } // three converts sRGB hex → linear

const _p = new Vector3(), _a = new Vector3(), _b = new Vector3(), _ab = new Vector3();

/** distance from p to segment a-b */
function segDist(p, a, b) {
  _ab.subVectors(b, a);
  const l2 = _ab.lengthSq();
  let t = l2 > 0 ? _p.subVectors(p, a).dot(_ab) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return _a.copy(a).addScaledVector(_ab, t).distanceTo(p);
}

const MAIN_CHILD = {
  pelvis: 'spine', chest: 'neck', hand_l: 'fing_l', hand_r: 'fing_r', root: 'pelvis', body: 'neck', head: null,
};

/** bone segments (rest) for envelope weighting */
export function boneSegments(rig) {
  if (rig._segs) return rig._segs;
  const segs = [];
  for (let i = 0; i < rig.n; i++) {
    const name = rig.names[i];
    const kids = [];
    for (let j = 0; j < rig.n; j++) if (rig.parent[j] === i) kids.push(j);
    let end = null;
    const pref = MAIN_CHILD[name];
    if (pref !== undefined && pref !== null && rig.index[pref] !== undefined) end = rig.rest[rig.index[pref]];
    else if (pref === undefined && kids.length === 1) end = rig.rest[kids[0]];
    else if (pref === undefined && kids.length > 1) end = rig.rest[kids[0]];
    if (!end) {
      const p = rig.parent[i];
      const dir = p >= 0 ? rig.rest[i].clone().sub(rig.rest[p]) : new Vector3(0, 1, 0);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      end = rig.rest[i].clone().addScaledVector(dir.normalize(), name === 'head' ? 0.18 : 0.06);
    }
    segs.push({ a: rig.rest[i], b: end });
  }
  rig._segs = segs;
  return segs;
}

/**
 * Envelope weights: inverse-distance to bone segments.
 * bones: array of names, or { name: multiplier }. Returns [[boneIndex, weight], ...] (≤4, normalised).
 */
export function envelope(rig, p, bones, power = 4) {
  const segs = boneSegments(rig);
  const list = Array.isArray(bones) ? bones.map((b) => [b, 1]) : Object.entries(bones);
  const ws = [];
  for (const [name, mul] of list) {
    const i = rig.index[name];
    if (i === undefined) continue;
    const d = segDist(p, segs[i].a, segs[i].b);
    ws.push([i, mul / Math.pow(d + 0.012, power)]);
  }
  return normW(ws);
}

export function normW(ws) {
  ws.sort((x, y) => y[1] - x[1]);
  const top = ws.slice(0, 4);
  let s = 0;
  for (const w of top) s += w[1];
  if (s <= 0) return [[top[0]?.[0] ?? 0, 1]];
  const out = [];
  for (const w of top) { const v = w[1] / s; if (v > 0.02) out.push([w[0], v]); }
  let s2 = 0;
  for (const w of out) s2 += w[1];
  for (const w of out) w[1] /= s2;
  return out;
}

export class MeshBuilder {
  constructor(rig = null) {
    this.rig = rig;
    this.pos = []; this.uv = []; this.col = []; this.mat = []; this.si = []; this.sw = []; this.idx = [];
    this.seams = [];
    this.mo = null;        // per-vertex morph deltas (xyz face-shape field, w fullness along the normal) when morph is set
    this.morph = null;     // (P: Vector3) => [dx, dy, dz, dn] evaluated for every vertex added while set
    this.cur = { color: [1, 1, 1], rough: 0.8, metal: 0, pat: PAT.NONE, cls: CLS.FIX, grp: 0 };
    this.xf = null;
  }
  get count() { return this.pos.length / 3; }

  /** set current material state: { color: hex|[r,g,b], rough, metal, pat, cls, grp } */
  set(o) {
    const c = { ...this.cur, ...o };
    if (typeof c.color === 'string' || typeof c.color === 'number') c.color = lin(c.color);
    this.cur = c;
    return this;
  }
  /** push/pop a transform applied to subsequently added positions (Matrix4) */
  transform(m) { this.xf = m; return this; }

  /** add a vertex. w: bone index | [[bone, w], ...] | function(p) → weights. shade: colour multiplier */
  v(p, u, vv, w, shade = 1, colOverride = null) {
    const P = p.isVector3 ? p.clone() : new Vector3(p[0], p[1], p[2]);
    if (this.xf) P.applyMatrix4(this.xf);
    this.pos.push(P.x, P.y, P.z);
    this.uv.push(u, vv);
    const c = colOverride || this.cur.color;
    this.col.push(c[0] * shade, c[1] * shade, c[2] * shade);
    this.mat.push(this.cur.rough, this.cur.metal, this.cur.pat, this.cur.cls + 8 * this.cur.grp);
    if (this.morph || this.mo) {
      if (!this.mo) this.mo = new Array((this.count - 1) * 4).fill(0);
      const d = this.morph ? this.morph(P) : null;
      this.mo.push(d ? d[0] : 0, d ? d[1] : 0, d ? d[2] : 0, d ? d[3] : 0);
    }
    let ws = typeof w === 'function' ? w(P) : (typeof w === 'number' ? [[w, 1]] : (w || [[0, 1]]));
    if (this.maxInfluences && ws.length > this.maxInfluences) ws = normW(ws.slice().sort((a, b) => b[1] - a[1]).slice(0, this.maxInfluences));
    const s = [0, 0, 0, 0], ww = [0, 0, 0, 0];
    for (let k = 0; k < Math.min(4, ws.length); k++) { s[k] = ws[k][0]; ww[k] = ws[k][1]; }
    this.si.push(...s);
    this.sw.push(...ww);
    return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }

  /**
   * Generic grid. fn(i, j) → { p: Vector3, u, v, w, shade?, col? } for i ∈ [0..nu], j ∈ [0..nv].
   * wrap: column nu duplicates column 0 (seam normals are averaged). outward(i,j,p) optional: a point the
   * surface faces away from, used to choose the winding.
   */
  grid(nu, nv, fn, opts = {}) {
    const base = this.count;
    const pts = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const r = fn(i, j);
        this.v(r.p, r.u ?? i / nu, r.v ?? j / nv, r.w, r.shade ?? 1, r.col || null);
        if (i === 0 && j === 0) pts.push(r);
      }
    }
    const id = (i, j) => base + j * (nu + 1) + i;
    // winding: area-weighted vote of every quad's normal against the 'inside' reference
    let flip = !!opts.flip;
    if (opts.inside) {
      const P = this.pos;
      const A = new Vector3(), B = new Vector3(), C = new Vector3(), n = new Vector3(), e1 = new Vector3(), e2 = new Vector3();
      let vote = 0;
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
          const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1);
          A.set(P[a * 3], P[a * 3 + 1], P[a * 3 + 2]);
          B.set(P[b * 3], P[b * 3 + 1], P[b * 3 + 2]);
          C.set(P[c * 3], P[c * 3 + 1], P[c * 3 + 2]);
          n.crossVectors(e1.subVectors(B, A), e2.subVectors(C, A));
          if (n.lengthSq() < 1e-14) continue;
          const inside = typeof opts.inside === 'function' ? opts.inside(A) : opts.inside;
          vote += n.dot(e1.subVectors(A, inside).normalize());
        }
      }
      flip = vote < 0;
      if (opts.invert) flip = !flip;
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        if (flip) this.quad(a, d, c, b); else this.quad(a, b, c, d);
      }
    }
    if (opts.wrap) for (let j = 0; j <= nv; j++) this.seams.push([id(0, j), id(nu, j)]);
    if (opts.weld) for (const [i0, j0, i1, j1] of opts.weld) this.seams.push([id(i0, j0), id(i1, j1)]);
    return { base, id };
  }

  /**
   * Tube through rings. rings: [{ c: Vector3, rx, rz, ax?: Vector3, az?: Vector3 }] (ax/az = ring axes,
   * default world x / z). opts: seg, arc [a0, a1] radians (θ measured from +ax toward +az),
   * weights(p, ringIndex, θ), radial(θ, ringIndex, ring) → radius multiplier, shade(θ, j) → colour mult,
   * capA / capB: 'flat' | 'dome' | null, uvMode: 'arc' (default) | 'x' (u = lateral x — used by clavi),
   * lift(θ, j, ring) → extra y (m) per vertex (rings that rise toward the back, e.g. a collar).
   */
  tube(rings, opts = {}) {
    const seg = opts.seg || 16;
    const [a0, a1] = opts.arc || [0, Math.PI * 2];
    const full = !opts.arc;
    const n = rings.length;
    let vacc = 0;
    const vs = [0];
    for (let j = 1; j < n; j++) { vacc += rings[j].c.distanceTo(rings[j - 1].c); vs.push(vacc); }
    const X = new Vector3(1, 0, 0), Z = new Vector3(0, 0, 1);
    const centerAt = (j) => rings[j].c;
    const g = this.grid(seg, n - 1, (i, j) => {
      const R = rings[j];
      const th = a0 + (a1 - a0) * (i / seg);
      const ax = R.ax || X, az = R.az || Z;
      const m = opts.radial ? opts.radial(th, j, R) : 1;
      const p = R.c.clone().addScaledVector(ax, Math.cos(th) * R.rx * m).addScaledVector(az, Math.sin(th) * R.rz * m);
      if (opts.lift) p.y += opts.lift(th, j, R);
      const ravg = (R.rx + R.rz) / 2;
      const u = opts.uvMode === 'x' ? p.x : th * ravg;
      return {
        p, u, v: -vs[j] + (opts.v0 || 0),
        w: opts.weights ? (q) => opts.weights(q, j, th) : opts.bone ?? 0,
        shade: opts.shade ? opts.shade(th, j, p) : 1,
      };
    }, { wrap: full, invert: opts.invert, inside: (A) => {
      // nearest ring centre as the inside reference
      let best = centerAt(0), bd = Infinity;
      for (let j = 0; j < n; j++) { const d = A.distanceTo(rings[j].c); if (d < bd) { bd = d; best = rings[j].c; } }
      return best;
    }, flip: opts.flip });
    const capRing = (j, dir) => {
      const R = rings[j];
      const ax = R.ax || X, az = R.az || Z;
      const axis = new Vector3().crossVectors(ax, az).normalize();
      // axis should point away from the tube
      const other = rings[j === 0 ? 1 : n - 2].c;
      if (axis.dot(R.c.clone().sub(other)) < 0) axis.negate();
      const tip = R.c.clone().addScaledVector(axis, (opts.domeH ?? 0.6) * Math.min(R.rx, R.rz) * (dir === 'dome' ? 1 : 0.0001));
      const wts = opts.weights ? (q) => opts.weights(q, j, 0) : opts.bone ?? 0;
      if (dir === 'dome') {
        const rows = 3;
        const prev = [];
        for (let i = 0; i <= seg; i++) prev.push(g.id(i, j));
        let last = prev;
        for (let k = 1; k <= rows; k++) {
          const t = k / rows;
          const ang = t * Math.PI / 2;
          const row = [];
          for (let i = 0; i <= seg; i++) {
            const th = a0 + (a1 - a0) * (i / seg);
            const m = opts.radial ? opts.radial(th, j, R) : 1;
            const rr = Math.cos(ang);
            const p = R.c.clone().addScaledVector(ax, Math.cos(th) * R.rx * m * rr).addScaledVector(az, Math.sin(th) * R.rz * m * rr)
              .addScaledVector(axis, Math.sin(ang) * (opts.domeH ?? 0.6) * Math.min(R.rx, R.rz));
            row.push(this.v(p, th * R.rx, (j === 0 ? 1 : -1) * k * 0.01, wts, opts.shade ? opts.shade(th, j, p) : 1));
          }
          for (let i = 0; i < seg; i++) {
            const A = last[i], B = last[i + 1], C = row[i + 1], D = row[i];
            this._quadOut(A, B, C, D, R.c);
          }
          if (full) this.seams.push([row[0], row[seg]]);
          last = row;
        }
      } else {
        const ci = this.v(tip, 0, 0, wts, opts.shade ? opts.shade(0, j, tip) : 1);
        for (let i = 0; i < seg; i++) this._triOut(g.id(i, j), g.id(i + 1, j), ci, R.c.clone().addScaledVector(axis, -1));
      }
    };
    if (opts.capA) capRing(0, opts.capA);
    if (opts.capB) capRing(n - 1, opts.capB);
    return g;
  }

  _triOut(a, b, c, inside) {
    const P = this.pos;
    const A = new Vector3(P[a * 3], P[a * 3 + 1], P[a * 3 + 2]);
    const B = new Vector3(P[b * 3], P[b * 3 + 1], P[b * 3 + 2]);
    const C = new Vector3(P[c * 3], P[c * 3 + 1], P[c * 3 + 2]);
    const n = new Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A));
    const cen = A.clone().add(B).add(C).multiplyScalar(1 / 3);
    if (n.dot(cen.sub(inside)) < 0) this.tri(a, c, b); else this.tri(a, b, c);
  }
  _quadOut(a, b, c, d, inside) { this._triOut(a, b, c, inside); this._triOut(a, c, d, inside); }

  /**
   * Ellipsoid (lat-long). c centre, r [rx, ry, rz]. opts: nu, nv, lat [v0, v1] (0 = top pole, 1 = bottom),
   * lon [u0, u1] radians (0 = front -z, increasing toward +x), deform(p, local, n) → Vector3,
   * weights, shade(local, p) → mult, uvScale, xf (Matrix4 applied to local before c offset).
   */
  ellipsoid(c, r, opts = {}) {
    const nu = opts.nu || 16, nv = opts.nv || 10;
    const [v0, v1] = opts.lat || [0, 1];
    const [u0, u1] = opts.lon || [0, Math.PI * 2];
    const full = !opts.lon;
    const center = c.clone();
    return this.grid(nu, nv, (i, j) => {
      const phi = opts.phiMap ? opts.phiMap(i / nu) : u0 + (u1 - u0) * (i / nu);
      const tv = opts.thMap ? opts.thMap(j / nv) : v0 + (v1 - v0) * (j / nv);
      const th = Math.PI * Math.min(0.9995, Math.max(0.0005, tv));
      const local = new Vector3(Math.sin(th) * Math.sin(phi) * r[0], Math.cos(th) * r[1], -Math.sin(th) * Math.cos(phi) * r[2]);
      let q = opts.deform ? opts.deform(local.clone(), phi, th) : local.clone();
      const uv = opts.uvFn ? opts.uvFn(q, phi, th) : null;
      if (opts.xf) q.applyMatrix4(opts.xf);
      const p = q.add(center);
      return {
        p, u: uv ? uv[0] : phi * (r[0] + r[2]) / 2 * (opts.uvScale || 1), v: uv ? uv[1] : -th * r[1] * (opts.uvScale || 1),
        w: opts.weights ?? opts.bone ?? 0, shade: opts.shade ? opts.shade(local, phi, th) : 1,
        col: opts.col ? opts.col(local, phi, th) : null,
      };
    }, { wrap: full, inside: opts.inside || center, flip: opts.flip });
  }

  /** axis-aligned box (optionally transformed by m: Matrix4 applied after centring) */
  box(c, size, opts = {}) {
    const hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2;
    const m = opts.m || null;
    const faces = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
      [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
      [[0, 0, 1], [-1, 0, 0], [0, 1, 0]], [[0, 0, -1], [1, 0, 0], [0, 1, 0]],
    ];
    const cen = c.clone ? c.clone() : new Vector3(...c);
    const taper = opts.taper || null; // [sx, sz] scale at +y face
    for (const [n, u, v] of faces) {
      const N = new Vector3(...n), U = new Vector3(...u), Vv = new Vector3(...v);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
        const p = new Vector3(N.x * hx + U.x * a * hx + Vv.x * b * hx, N.y * hy + U.y * a * hy + Vv.y * b * hy, N.z * hz + U.z * a * hz + Vv.z * b * hz);
        if (taper && p.y > 0) { p.x *= taper[0]; p.z *= taper[1]; }
        if (m) p.applyMatrix4(m);
        return p.add(cen);
      });
      const ids = corners.map((p, k) => this.v(p, [0, 1, 1, 0][k] * size[0], [0, 0, 1, 1][k] * size[1], opts.weights ?? opts.bone ?? 0, opts.shade ? opts.shade(p) : 1));
      const inside = m ? cen : cen;
      this._quadOut(ids[0], ids[1], ids[2], ids[3], inside);
    }
  }

  /** flat double-sided ribbon along a polyline (tzitzit strands, strings, chains) */
  ribbon(points, width, opts = {}) {
    const side = opts.side || new Vector3(1, 0, 0);
    const ids = [];
    let acc = 0;
    for (let k = 0; k < points.length; k++) {
      if (k) acc += points[k].distanceTo(points[k - 1]);
      const p = points[k];
      const w = (typeof width === 'function' ? width(k / (points.length - 1)) : width) / 2;
      ids.push([
        this.v(p.clone().addScaledVector(side, -w), 0, acc, opts.weights ?? opts.bone ?? 0, opts.shade ?? 1),
        this.v(p.clone().addScaledVector(side, w), w * 2, acc, opts.weights ?? opts.bone ?? 0, opts.shade ?? 1),
      ]);
    }
    for (let k = 0; k < points.length - 1; k++) {
      const [a, b] = ids[k], [c, d] = ids[k + 1];
      this.quad(a, b, d, c);
      this.quad(a, c, d, b); // back face
    }
  }

  /** append another builder's content */
  merge(o) {
    const base = this.count;
    this.pos.push(...o.pos); this.uv.push(...o.uv); this.col.push(...o.col); this.mat.push(...o.mat);
    this.si.push(...o.si); this.sw.push(...o.sw);
    if (this.mo || o.mo) {
      if (!this.mo) this.mo = new Array(base * 4).fill(0);
      if (o.mo) this.mo.push(...o.mo); else for (let i = 0; i < o.pos.length / 3; i++) this.mo.push(0, 0, 0, 0);
    }
    for (const i of o.idx) this.idx.push(i + base);
    for (const [a, b] of o.seams) this.seams.push([a + base, b + base]);
  }

  /** mirror across x (for left-hand prop variants): x → -x and flip winding */
  mirrorX() {
    for (let i = 0; i < this.pos.length; i += 3) this.pos[i] = -this.pos[i];
    for (let i = 0; i < this.idx.length; i += 3) { const t = this.idx[i + 1]; this.idx[i + 1] = this.idx[i + 2]; this.idx[i + 2] = t; }
    return this;
  }
  applyMatrix(m) {
    const v = new Vector3();
    for (let i = 0; i < this.pos.length; i += 3) {
      v.set(this.pos[i], this.pos[i + 1], this.pos[i + 2]).applyMatrix4(m);
      this.pos[i] = v.x; this.pos[i + 1] = v.y; this.pos[i + 2] = v.z;
    }
    if (m.determinant() < 0) {
      for (let i = 0; i < this.idx.length; i += 3) { const t = this.idx[i + 1]; this.idx[i + 1] = this.idx[i + 2]; this.idx[i + 2] = t; }
    }
    return this;
  }

  build() {
    const g = new BufferGeometry();
    const n = this.count;
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('pMat', new Float32BufferAttribute(this.mat, 4));
    g.setAttribute('pIdx', new Uint8BufferAttribute(this.si, 4));
    // quantise weights to bytes that sum to exactly 255 (a sum ≠ 1 would shrink the skinned vertex)
    const wq = new Uint8Array(this.sw.length);
    for (let i = 0; i < this.sw.length; i += 4) {
      let s = 0, big = i;
      for (let k = 0; k < 4; k++) {
        wq[i + k] = Math.round(this.sw[i + k] * 255);
        s += wq[i + k];
        if (this.sw[i + k] > this.sw[big]) big = i + k;
      }
      wq[big] = Math.max(0, Math.min(255, wq[big] + (255 - s)));
    }
    g.setAttribute('pW', new Uint8BufferAttribute(wq, 4, true));
    if (this.mo) {
      while (this.mo.length < n * 4) this.mo.push(0, 0, 0, 0);
      g.setAttribute('pMorph', new Float32BufferAttribute(this.mo, 4));
    }
    g.setIndex(n > 65535 ? new Uint32BufferAttribute(this.idx, 1) : new Uint16BufferAttribute(this.idx, 1));
    g.computeVertexNormals();
    // weld seam normals
    const N = g.attributes.normal;
    for (const [a, b] of this.seams) {
      const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      N.setXYZ(a, x / l, y / l, z / l);
      N.setXYZ(b, x / l, y / l, z / l);
    }
    g.computeBoundingSphere();
    return g;
  }
}

export { Matrix4 };
