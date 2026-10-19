// The twelve steps of the Ulam (Middot 3:6; Yoma 4:3 "the fourth rovad"; Tamid 7:2; lock #25) — built from
// altar.ulam-steps params.profile: rise ½ each, treads "amah, amah, rovad of 3" ×3 and "amah, amah, rovad of 4" at the
// top; the level apron (the 22nd amah) is the court pavement. One stepped solid extruded across the 20-amah width;
// treads are the colliders (½ amah ≈ 0.24 m < the player's 0.35 m step-up).
export function buildUlamSteps(A) {
  const { el, d, B } = A;
  const st = el('altar.ulam-steps');
  const prof = st.params.profile;
  const [, y0, z0] = st.box.min, [, y1] = st.box.max;
  const xBack = st.box.min[0];                           // the Ulam's front face (the otem rises behind)
  const c = d >= 1 ? 0.04 : 0;                           // nosing arris (≈ 2 cm) ⚙
  const KEY = 'steps_stone';
  const m = B.m(KEY);
  // section polyline in (x, z), from the foot of the bottom riser, up and west to the Ulam face
  const sec = [[prof[0].riserX, z0]];
  for (const p of prof) {
    const x = p.riserX, zt = p.topZ;
    if (c) sec.push([x, zt - c], [x - c, zt]); else sec.push([x, zt]);
    sec.push([x - p.tread, zt]);
  }
  // treads + risers across the width (each segment a quad, normal by its direction)
  for (let i = 0; i < sec.length - 1; i++) {
    const [xa, za] = sec[i], [xb, zb] = sec[i + 1];
    if (Math.abs(xa - xb) < 1e-9 && Math.abs(za - zb) < 1e-9) continue;
    const n = [(zb - za), 0, -(xb - xa)];                // outward = the (x, z) direction turned clockwise
    const l = Math.hypot(n[0], n[2]) || 1;
    m.quadH([xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], [n[0] / l, 0, n[2] / l]);
  }
  // the two stepped ends (N and S faces) and the back (against the otem; kept for a watertight collider)
  const poly = [...sec, [xBack, z0]];
  m.poly(poly.map(([x, z]) => [x, y0, z]), [0, -1, 0]);
  m.poly(poly.map(([x, z]) => [x, y1, z]), [0, 1, 0]);
}
