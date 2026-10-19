// The amah — running water in the open channel of the Azarah (Middot 3:2; Tamid 5:5; Pesachim 5:8; Yoma 58b).
// build-courts cuts the 1-amah-deep channel into the pavement along azarah.amah-channel params.openSegments; this lays
// the only water surface in it, running (its UVs scroll along the course: south from the shit under the SW corner,
// then east to the covered culvert toward the Water Gate), and the dark culvert mouths where the drain from the
// shitin enters and where the channel goes under the pavement.
import { BufferGeometry, Float32BufferAttribute, Mesh } from 'three';
import { AMAH } from '../../core/units.js';

export function buildWater(A) {
  const { el, ctx, B } = A;
  const ch = el('azarah.amah-channel').params;
  const segs = ch.openSegments;
  const path = ch.path.filter((p) => p.open).map((p) => p.at);
  if (!segs.length || path.length < 2) return;
  const zW = segs[0].max[2] - 0.35;                      // ≈ 17 cm under the pavement: lit and reflecting, not a black slot ⚙
  const pos = [], uv0 = [], dir = [], idx = [];
  segs.forEach((b, i) => {
    const a = path[i], c = path[i + 1];
    const fx = Math.sign(c[0] - a[0]), fy = Math.sign(c[1] - a[1]);
    const base = pos.length / 3;
    const [x0, y0] = b.min, [x1, y1] = b.max;
    for (const [X, Y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
      pos.push(X * AMAH, zW * AMAH, -Y * AMAH);
      uv0.push(X * AMAH, Y * AMAH);
      dir.push(fx, fy);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const uv = new Float32BufferAttribute(uv0.slice(), 2);
  g.setAttribute('uv', uv);
  g.setIndex(idx);
  const mesh = new Mesh(g, ctx.mats.get('water'));
  mesh.name = 'altar.amah:water';
  mesh.receiveShadow = true;
  A.group.add(mesh);
  // the current: ≈ 0.3 m/s along the course (texture features move downstream)
  const speed = 0.3;
  let t = 0;
  ctx.engine?.onUpdate?.((dt) => {
    t = (t + dt * speed) % 1000;
    const a = uv.array;
    for (let i = 0; i < dir.length / 2; i++) {
      a[i * 2] = uv0[i * 2] - dir[i * 2] * t;
      a[i * 2 + 1] = uv0[i * 2 + 1] - dir[i * 2 + 1] * t;
    }
    uv.needsUpdate = true;
  }, 45);

  // culvert mouths (dark arches) — where the shit's drain enters and where the channel dives under the pavement
  const dark = B.m(A.mat('glass_dark', 'iron'), { collide: false, cast: false });
  const zb = segs[0].min[2];
  const arch = (cx, cy, face, w = 0.7) => {
    // the crown just under the pavement, so the mouth stands clear of the water running into it
    const r = w / 2, n = 8, pts = [], spring = Math.max(0.2, segs[0].max[2] - 0.08 - r - zb);
    pts.push([-r, zb], [r, zb], [r, zb + spring]);
    for (let i = 1; i < n; i++) { const a = (Math.PI * i) / n; pts.push([r * Math.cos(a), zb + spring + r * Math.sin(a)]); }
    pts.push([-r, zb + spring]);
    const P = pts.map(([u, z]) => (face[0] !== 0 ? [cx, cy + u, z] : [cx + u, cy, z]));
    dark.poly(P, [face[0], face[1], 0]);
  };
  const s0 = segs[0], s1 = segs[segs.length - 1];
  const eps = 0.01;
  // head of the channel (north end of the first run), facing downstream (south)
  arch((s0.min[0] + s0.max[0]) / 2, s0.max[1] - eps, [0, -1]);
  // the outflow: the covered course continues south from the last run's east end
  const last = ch.path.findIndex((p) => p.covered && ch.path.indexOf(p) > 1);
  const out = ch.path[last]?.at;
  if (out) {
    if (out[1] < s1.min[1]) arch(Math.min(Math.max(out[0], s1.min[0] + 0.4), s1.max[0] - 0.4), s1.min[1] + eps, [0, 1]);
    else arch(s1.max[0] - eps, (s1.min[1] + s1.max[1]) / 2, [-1, 0]);
  }
}
