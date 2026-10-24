// The altar top: the ash floor of the ma'arachah place, the tapuach and the three ma'arachot (lock #17, R' Yosi).
//
// Tamid 2:2 — the tapuach, the ash mound in the middle of the altar ("at times ~300 kor"); Tamid 2:3 — "they began to
// bring up gizrin (cut pieces) to arrange the fire": all woods are valid except olive and vine, the custom: branch-wood
// (marbiyot) of fig, walnut and oil-tree (pine); Tamid 2:4 — the great pile to the east, its face east, the inner ends
// of the gizrin touching the tapuach, with air between the gizrin where the kindling was lit; Tamid 2:5 — the second
// pile for the incense coals opposite the SW horn, drawn 4 amot north (fine fig wood); Yoma 45a (R' Yosi) — the third
// pile, for keeping the fire. The gizer itself (Zevachim 62b): "the gizrin Moshe made — length an amah, width an amah,
// thickness as the strickle of a heaped se'ah; R' Yirmiyah: in a shortened amah". Positions/sizes from site.js
// altar.maarachah-area params. Second Temple: an ordinary wood fire (fx 'pyre'), smoke straight up; no heavenly glow.
// Movables: 'altar.maarachah.great.pile' (build(f); its rows follow the tapuach's size), 'altar.tapuach' (grow(f),
// heightAt(X, Y)), 'altar.two-logs' (.visible) — below.
import { Group, Mesh, OctahedronGeometry, Matrix4, Quaternion, Euler, Vector3, BufferAttribute, DynamicDrawUsage } from 'three';
import { heightField, polarField, logGeometry, logBetween, rng, noise2, Mesher } from './lib.js';
import { applyWorldUV, mergeGeometries } from '../geom.js';

export function buildFire(A) {
  const { el, d, B, ctx } = A;
  const R = rng(A.seed ^ 0x5a17);
  const nz = noise2(A.seed + 17);
  const maar = el('altar.maarachah-area');
  const Z = maar.box.min[2];
  const [mx0, my0] = maar.box.min, [mx1, my1] = maar.box.max;
  const tp = maar.params.tapuach;
  const [tcx, tcy] = tp.center;
  const TR = tp.radius, TH = tp.height;
  const piles = Object.fromEntries(maar.params.piles.map((p) => [p.id, p]));
  const ASH = 'ash';
  // bark: one species per billet — fig, walnut and oil-tree (pine), Tamid 2:3 (world-4); the species come from their own
  // random stream, so nothing else on the altar moves. The incense pile is "fine fig wood" (Tamid 2:5). Detail 0 (low)
  // draws every billet in walnut, as the courts do there: one bark mesh in the batch and one in the pile, not three
  // each (world-4-fix; walnut is timber_rough's set, baked on low anyway).
  const BARKS = ['timber_bark_fig', 'timber_bark_walnut', 'timber_bark_pine'].map((k) => A.mat(k, 'timber_rough'));
  const BARK = BARKS[1], END = A.mat('timber_pile_end', 'timber_rough');
  const RS = rng(A.seed ^ 0x51ec7);
  const species = (sp) => (d === 0 ? 1 : sp ?? Math.min(2, Math.floor(RS() * 3)));
  // charred wood and charcoal: the materials task's timber_charred once it exists; meanwhile the darkest non-metal key
  // (glass_dark: charcoal's satin black) — never the fresh bark, which hid the burnt core
  const CHAR = A.mat('timber_charred', A.mat('glass_dark', BARK));
  const GIZ = A.mat('timber_split', A.mat('wood_lattice', BARK));   // riven faces of the two Moshe-standard gizrin
  const jitter = (s, rnd = R) => (rnd() - 0.5) * 2 * s;

  // ---------------------------------------------------------------- the tapuach: heaped ash at its angle of repose
  // a broad, slightly flattened crown, straight flanks (tan ≈ 0.84, 40°: site.js's 3 high on a radius of 4 leaves no
  // room for gentler flanks), a soft talus toe running 0.6 amah past the radius into the floor drift.
  // qa-r2-fix-world: a heap of dumped, slumping ash, not a turned dome ⚙ — the crest stands off-centre toward the west
  // (the ash is raked up onto it from the fires on the east, Tamid 2:2, so the east flank is the long one), the
  // footprint is an irregular oval pushed out in a few slump tongues, the flanks carry broad low-frequency swells and
  // shallow chutes where loose ash has run down the fall line, and (detail ≥ 2) shovel scoops.
  // Everything is sampled in plan (X, Y), so the surface is continuous through the crown (no pinched star).
  const SL = 0.84, RE = TR + 0.6;
  const span = 2 * TH / SL - RE, rTot = RE - span;      // flank length; crown radius + toe width
  const rCr = rTot * 0.6, rFl = rCr + span, apr = RE - rFl;
  const prof = (r) => (r <= rCr ? TH - (SL / (2 * rCr)) * r * r
    : r <= rFl ? TH - SL * rCr / 2 - SL * (r - rCr)
      : r < RE ? (SL / (2 * apr)) * (RE - r) * (RE - r) : 0);
  const RT = rng(A.seed ^ 0x7a9c);                       // the heap's own stream (nothing else on the altar moves)
  const angD = (a, b) => { let x = (a - b) % (2 * Math.PI); if (x > Math.PI) x -= 2 * Math.PI; if (x < -Math.PI) x += 2 * Math.PI; return x; };
  const tongues = Array.from({ length: 4 }, (_, i) => ({ a: (i / 4) * 2 * Math.PI + 0.9 + RT() * 1.1, w: 0.32 + 0.22 * RT(), amp: 0.04 + 0.05 * RT() }));
  const chutes = Array.from({ length: d >= 2 ? 9 : d >= 1 ? 6 : 0 }, () => ({ a: RT() * 2 * Math.PI, w: 0.22 + 0.2 * RT(), dep: 0.07 + 0.08 * RT() }));
  const SKEW = [-0.5, 0.25];                             // the crest's offset from the centre (amot) ⚙
  // (scaled by 0.96 so the mean footprint stays site.js's: the tongues push it out ≤ ½ amah in a few directions)
  const lobe = (t) => 0.96 * (1 + 0.06 * Math.cos(2 * (t - 0.5)))              // an oval, its long axis WSW–ENE
    * (1 + 0.085 * nz(Math.cos(t) * 0.9 + 3.1, Math.sin(t) * 0.9 + 7.3, 2) + 0.03 * nz(Math.cos(t) * 2.2 + 11, Math.sin(t) * 2.2 + 5, 2))
    + tongues.reduce((s, g) => s + g.amp * Math.exp(-((angD(t, g.a) / g.w) ** 2)), 0);
  const scoops = [];
  if (d >= 2) for (let i = 0; i < 6; i++) {
    const a = R() * Math.PI * 2, rr = TR * (0.45 + 0.35 * R());
    scoops.push({ x: tcx + Math.cos(a) * rr, y: tcy + Math.sin(a) * rr, a, w: 0.35 + 0.2 * R(), l: 0.55 + 0.3 * R(), dep: 0.1 + 0.08 * R() });
  }
  const tapZ = (X, Y) => {
    let dx = X - tcx, dy = Y - tcy, t = Math.atan2(dy, dx);
    const r0 = Math.hypot(dx, dy) / (RE * lobe(t));
    if (r0 >= 1) return Z - 0.03;
    // the crest carried off-centre: the profile is read about a centre that moves with the height (none at the toe)
    const k = (1 - r0) * (1 - r0);
    dx -= SKEW[0] * k; dy -= SKEW[1] * k; t = Math.atan2(dy, dx);
    const r01 = Math.min(0.999, Math.hypot(dx, dy) / (RE * lobe(t)));
    const flank = Math.sin(Math.PI * Math.min(1, r01 * 1.15));     // 0 at the crown's centre and at the toe
    let h = prof(r01 * RE) * (1 + 0.07 * Math.cos(t - 3.6));          // a little fuller toward the WSW
    h += 0.24 * nz(X * 0.26 + 13, Y * 0.26 - 7, 2) * flank;                                // broad swells of the dumps
    for (const g of tongues) h += 1.6 * g.amp * Math.exp(-((angD(t, g.a) / g.w) ** 2)) * Math.max(0, Math.sin(Math.PI * Math.min(1, (r01 - 0.45) / 0.55)));
    if (d >= 1) {
      h += 0.16 * nz(X * 0.45 + 4, Y * 0.45 - 2, 3) * flank;                               // lumps of dumped shovelfuls
      // chutes down the fall line on the flanks, widening toward the toe
      const fl = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (r01 - 0.3) / 0.68))));
      for (const c of chutes) { const q = angD(t, c.a) * r01 * RE / (c.w * (0.6 + 0.6 * r01)); h -= c.dep * Math.exp(-q * q) * fl; }
    }
    if (d >= 2) h += 0.07 * nz(X * 1.6 - 9, Y * 1.6 + 3, 2) * flank;                       // slumps
    // the crest is dumped ash too: lumps over the crown as well (they fade out toward the toe, which meets the floor)
    const crown = Math.max(0, 1 - Math.max(0, r01 - 0.55) / 0.35);
    if (d >= 1) h += (0.13 * nz(X * 0.62 + 2, Y * 0.62 + 9, 2) + (d >= 2 ? 0.05 * nz(X * 2.1 + 5, Y * 2.1 - 1, 2) : 0)) * crown * (1 - 0.5 * flank);
    for (const s of scoops) {                                                              // shovel scoops on the flanks
      const ux = X - s.x, uy = Y - s.y, ca = Math.cos(s.a), sa = Math.sin(s.a);
      const along = (ux * ca + uy * sa) / s.l, across = (-ux * sa + uy * ca) / s.w;
      h -= s.dep * Math.exp(-(along * along + across * across) * 2.2);
    }
    return Z - 0.03 + Math.max(0, h);
  };
  const rings = [8, 14, 24, 32][d], segs = [18, 32, 56, 72][d];
  // a movable of its own (grow(f), below); its collider stays the full mound
  const tapGeo = polarField(tcx, tcy, rings, segs, (t) => RE * lobe(t), (r01, t, X, Y) => tapZ(X, Y), (u) => 0.35 * u * u + 0.65 * u);
  ctx.addCollider(tapGeo.clone(), 'altar:tapuach');
  const tapChars = [];

  // ---------------------------------------------------------------- the ash floor of the 24 × 24 (a fine drift, 0 at the edge)
  const n = [1, 24, 40, 56][d];
  const ashH = (X, Y) => {
    const edge = Math.min(X - mx0, mx1 - X, Y - my0, my1 - Y);
    const fall = Math.min(1, Math.max(0, edge / 1.2));
    const dr = Math.hypot(X - tcx, Y - tcy);
    const skirt = Math.max(0, 1 - Math.max(0, dr - TR * 0.85) / 2.5) * 0.12;   // ash spilling off the tapuach
    return Z + fall * (0.025 + 0.03 * (nz(X * 0.45, Y * 0.45, 3) + 1) + skirt);
  };
  B.geo(heightField(mx0, my0, mx1, my1, n, n, d === 0 ? () => Z : ashH), ASH, { collide: true, cast: true });

  // ---------------------------------------------------------------- wood
  const seg = [5, 7, 8, 10][d], rows = d === 0 ? 1 : d === 1 ? 2 : 3;
  const sides = [[], [], []], caps = [], chars = [];
  /** a billet from site point a to b (amot), radius r; o: { char, taper (radius factor at a), squash, roll, species };
   *  rec: a great-pile billet record that takes the geometry (the movable pile) instead of the static lists;
   *  rnd: the random stream (the pile's extension billets draw from their own, so nothing else moves) */
  const addLog = (a, b, r, o = {}, rec = null, rnd = R) => {
    const { matrix, len } = logBetween(a, b);
    const rb = r * A.AMAH * (0.92 + 0.16 * rnd());
    const g = logGeometry(len, rb * (o.taper ?? 1), rb * (0.88 + 0.12 * rnd()), seg, rnd, d >= 2 ? 0.07 : 0.04, rows, o.squash ?? 1, o.roll ?? 0);
    g.side.applyMatrix4(matrix);
    g.caps.applyMatrix4(matrix);
    const sp = species(o.species);
    if (rec) { rec.char = !!o.char; rec.sp = sp; rec.side = g.side; rec.caps = g.caps; pileRecs.push(rec); return; }
    if (o.char) chars.push(g.side, g.caps); else { sides[sp].push(g.side); caps.push(g.caps); }
  };
  const pileRecs = [];
  const section = (rnd = R) => (rnd() < 0.35 ? { squash: 0.55 + 0.15 * rnd(), roll: rnd() * Math.PI } : {});   // split or round
  const GL = 5 / 6;                                      // a gizer: one shortened amah (5 tefachim ⚙) — Zevachim 62b

  // the bed of coals and ash the great pile has burnt down into: deepest at its heart, toward the tapuach
  const gp = piles.great.box;
  const [gx0, gy0, gz0] = gp.min, [gx1, gy1, gz1] = gp.max;
  const gcx = (gx0 + gx1) / 2, gcy = (gy0 + gy1) / 2;
  const bcx = gx0 + 1.5, bcy = gcy, brx = 3.4, bry = (gy1 - gy0) / 2 + 0.3, bedH = 0.55;
  const bedZ = (X, Y) => {
    const q = Math.hypot((X - bcx) / brx, (Y - bcy) / bry);
    if (q >= 1) return Z - 0.02;
    return Z - 0.02 + bedH * Math.pow(1 - q * q, 0.8) * (1 + (d >= 1 ? 0.25 * nz(X * 1.1 + 2, Y * 1.1 - 6, 2) : 0));
  };
  B.geo(polarField(bcx, bcy, [4, 6, 9, 12][d], [14, 22, 30, 40][d], (t) => 1 / Math.hypot(Math.cos(t) / brx, Math.sin(t) / bry),
    (r01, t, X, Y) => bedZ(X, Y)), ASH, { collide: true, cast: true });
  // how far a billet has burnt: 1 at the heart of the bed, 0 at the fresh outer faces
  const burnAt = (X, Y, j) => Math.max(0, 1 - Math.hypot((X - bcx) / (brx * 0.8), (Y - bcy) / (bry * 0.75))) * (1 - 0.06 * j);

  // the great pile: rows of gizrin east–west, laid end to end so the innermost ends touch the tapuach (Tamid 2:4),
  // layered crosswise-offset with air between the rows, narrowing upward; the east ends staggered (the face east);
  // burnt from the inside — the heart a hollow over the coals, charred and shortened billets slumped into it
  const lr = 0.12;                                       // mean billet radius ≈ 6 cm (branch-wood, marbiyot)
  const layerH = 2 * lr * 0.88, sp = 2 * lr * 1.55;
  const nL = Math.max(1, Math.floor((gz1 - gz0 - lr) / layerH) + 1);
  const mJ = (j) => 0.15 + j * 0.18;                     // side margin of layer j (the pile narrows upward)
  // every row and its billet slots, laid or not (interior, buried and burnt-away slots are still there for support):
  // the movable pile below fits the rows to the tapuach's current size
  const pileRows = [];
  for (let j = 0; j < nL; j++) {
    const z = gz0 + lr * 0.8 + j * layerH;
    const ys = [];
    for (let y = gy0 + mJ(j) + (j % 2 ? sp / 2 : 0); y <= gy1 - mJ(j); y += sp) ys.push(y);
    const m2 = mJ(Math.min(nL, j + 2));
    ys.forEach((y0, ri) => {
      const y = y0 + jitter(0.05);
      // inner end: march west until the mound's surface stands at the billet's height (its end touches the tapuach)
      let xin = gx0 + jitter(0.25), touch1 = false;
      for (let x = gx0 + 1.0; x > gx0 - 2.6; x -= 0.05) { if (tapZ(x, y) >= z - lr * 0.4) { xin = x + 0.03; touch1 = true; break; } }
      const xout = gx1 - j * 0.12 + 0.3 - R() * 0.9;      // staggered, broken east ends
      const row = { j, ri, y, z, xin, touch1, slots: [] };
      pileRows.push(row);
      if (xout - xin < 0.5) return;
      const edgeRow = ri < 2 || ri >= ys.length - 2 || y < gy0 + m2 + sp || y > gy1 - m2 - sp;
      let x = xout, first = true;
      while (x - xin > 0.2) {
        let L = Math.min(GL * (0.9 + 0.2 * R()), x - xin);
        const last = x - L - xin < 0.25;
        if (last) L = x - xin;
        const xa = x - L, xm = x - L / 2;
        const slot = { xa, xb: x, ext: false, mask: 0, rec: null };
        row.slots.push(slot);
        const b = burnAt(xm, y, j);
        const top = j >= nL - 2, visible = top || edgeRow || first || last || b > 0.2;
        const buried = z + lr < bedZ(xm, y) - 0.02;
        if (visible && !buried) {
          if (b > 0.62 && j <= 4) { /* burnt away: the hollow heart over the coals */ }
          else if (b > 0.4) {
            // charred, shortened, tapering toward the heart; a third slumped 10–25° into the bed
            const Ls = L * (0.45 + 0.35 * R()), slump = R() < 0.33 ? (10 + 15 * R()) * Math.PI / 180 : 0;
            const zz = z - (b - 0.4) * 0.5;
            const inner = [x - Ls, y + jitter(0.06), zz - Ls * Math.sin(slump)], outer = [x - 0.02, y + jitter(0.06), zz];
            addLog(inner, outer, lr * (0.65 + 0.4 * R()), { char: true, taper: 0.45 + 0.3 * R(), ...section() }, slot.rec = { j, ri, x: xm });
          } else {
            const yaw = jitter(0.035), pitch = jitter(0.025);
            addLog([xa + 0.02, y - yaw, z + jitter(0.03) - pitch], [x - 0.02, y + yaw, z + jitter(0.03) + pitch], lr * (0.75 + 0.5 * R()),
              { char: b > 0.22 && R() < 0.5, ...section() }, slot.rec = { j, ri, x: xm });
          }
        }
        x = xa - 0.03 - R() * 0.08;
        first = false;
      }
    });
  }
  const gTop = gz0 + lr * 0.8 + (nL - 1) * layerH + lr;

  // ---------------------------------------------------------------- the great pile against a smaller tapuach
  // The rows above are laid against the full mound (site.js r 4, h 3). When the tapuach is smaller (grow(f) < 1) the
  // gizrin are still laid "with their inner ends touching the tapuach" (Tamid 2:4), so for each size on a grid of
  // tenths each row is fitted again:
  //  · where the smaller mound still reaches the row's height (within the original reach, 2.6 amot west of the pile
  //    box), the row runs on west to touch it: extension billets (their own random stream, so nothing else moves),
  //    the innermost one's tip pushed into the ash;
  //  · where it no longer does, the row keeps only the billets that rest on the layer below — each layer may overhang
  //    the one under it by at most OV (the corbel the mound's 40° flank gives, ≈ ¼ amah a layer, with a margin), or by
  //    its own overhang in the full pile if that is more; the bottom layer lies on the floor and the ember bed.
  // The pile at 1 is untouched; every billet carries a mask of the sizes at which it lies there.
  const GN = 10, OV = 0.35, Zb = Z - 0.03;
  const growScale = (g) => [0.55 + 0.45 * g, 0.25 + 0.75 * g];   // the tapuach's radius / height factors (grow(f))
  const tapZg = (X, Y, sr, sz) => Zb + sz * (tapZ(tcx + (X - tcx) / sr, tcy + (Y - tcy) / sr) - Zb);
  for (const row of pileRows) {
    row.xt = new Array(GN + 1).fill(null);
    row.xt[GN] = row.touch1 ? row.xin : null;
    const zt = row.z - lr * 0.4;
    let start = gx0 + 1.0;
    for (let gi = GN - 1; gi >= 0; gi--) {          // the mounds are nested: once a row misses one, it misses the smaller
      const [sr, sz] = growScale(gi / GN);
      if (Math.abs(row.y - tcy) > RE * 1.12 * sr || Zb + sz * (TH + 0.3) < zt) break;   // beside or below the mound
      // a coarse march, then the first touch to 0.05 amah inside the last coarse step
      const hit = (x) => tapZg(x, row.y, sr, sz) >= zt;
      let x = start;
      while (x > gx0 - 2.6 && !hit(x)) x -= 0.2;
      if (x <= gx0 - 2.6) break;
      let xf = x + 0.15;
      while (xf > x + 0.01 && !hit(xf)) xf -= 0.05;
      row.xt[gi] = (xf > x + 0.01 ? xf : x) + 0.03;
      start = Math.min(gx0 + 1.0, row.xt[gi] + 0.3);
    }
  }
  const R2 = rng(A.seed ^ 0x2b7c);
  for (const row of pileRows) {
    const reach = row.xt.filter((v) => v != null);
    if (!reach.length || !row.slots.length) continue;
    const xmin = Math.min(...reach) - 0.1, { y, z, j, ri } = row;
    let x = row.slots[row.slots.length - 1].xa - 0.03 - R2() * 0.05;
    while (x - xmin > 0.15) {
      let L = Math.min(GL * (0.9 + 0.2 * R2()), x - xmin);
      if (x - L - xmin < 0.25) L = x - xmin;
      const xa = x - L, xm = x - L / 2;
      const slot = { xa, xb: x, ext: true, mask: 0, rec: null };
      row.slots.push(slot);
      const b = burnAt(xm, y, j);
      if (z + lr >= bedZ(xm, y) - 0.02 && !(b > 0.62 && j <= 4)) {
        const yaw = jitter(0.035, R2), pitch = jitter(0.025, R2);
        addLog([xa + 0.02, y - yaw, z + jitter(0.03, R2) - pitch], [x - 0.02, y + yaw, z + jitter(0.03, R2) + pitch], lr * (0.75 + 0.5 * R2()),
          { char: b > 0.4 || (b > 0.22 && R2() < 0.5), ...section(R2) }, slot.rec = { j, ri, x: xm, ext: true }, R2);
      }
      x = xa - 0.03 - R2() * 0.08;
    }
  }
  {
    const byLayer = [];
    for (const row of pileRows) (byLayer[row.j] ||= []).push(row);
    for (const row of pileRows) {
      row.under = row.j ? byLayer[row.j - 1].filter((q) => Math.abs(q.y - row.y) < sp * 0.9) : [];
      row.E = new Float64Array(GN + 1);
      row.allow = OV;
    }
    for (const gi of [GN, ...Array.from({ length: GN }, (_, k) => GN - 1 - k)]) {
      for (const layer of byLayer) for (const row of layer) {
        const xt = row.xt[gi];
        let S = -Infinity;                               // the inner end of the layer below, under this row
        for (const q of row.under) S = Math.max(S, q.E[gi]);
        if (gi === GN && xt == null && row.j > 0 && Number.isFinite(S)) {
          let own = Infinity;
          for (const s of row.slots) if (!s.ext) own = Math.min(own, s.xa);
          if (Number.isFinite(own)) row.allow = Math.max(OV, S - own + 0.02);
        }
        const lim = S === -Infinity ? -Infinity : S - row.allow;
        let E = Infinity;
        for (const s of row.slots) {
          const on = gi === GN ? !s.ext : xt != null ? s.xb > xt + 0.1 : row.j === 0 ? !s.ext : !s.ext && s.xa >= lim;
          if (on) { s.mask |= 1 << gi; if (s.xa < E) E = s.xa; }
        }
        row.E[gi] = E;
      }
    }
    for (const row of pileRows) for (const s of row.slots) if (s.rec) s.rec.mask = s.mask;
  }

  // the second pile (incense coals, Tamid 2:5) and the third (keeping the fire, Yoma 45a): cribs of gizrin over a
  // heap of coals, the billets a shortened amah long, laid end to end where the crib is wider than one
  const crib = (box, r, perLayer, layers, charredLayers, sp = null) => {
    const [x0, y0, z0] = box.min, [x1, y1] = box.max;
    const runs = (a0, a1) => {                           // billets end to end across [a0, a1]
      const k = Math.max(1, Math.round((a1 - a0) / (GL + 0.06))), w = (a1 - a0) / k, out = [];
      for (let i = 0; i < k; i++) out.push([a0 + i * w + 0.03 + R() * 0.05, a0 + (i + 1) * w - 0.03 - R() * 0.05]);
      return out;
    };
    for (let j = 0; j < layers; j++) {
      const z = z0 + 0.12 + r + j * 2 * r * 0.92;
      const ew = j % 2 === 0;
      for (let i = 0; i < perLayer; i++) {
        const t = (i + 0.5) / perLayer;
        const o = { char: j < charredLayers, ...section(), ...(sp != null ? { species: sp } : {}) };
        if (ew) { const y = y0 + 0.15 + t * (y1 - y0 - 0.3) + jitter(0.04); for (const [a, b] of runs(x0 + 0.05, x1 - 0.05)) addLog([a, y, z], [b, y + jitter(0.05), z], r * (0.8 + 0.4 * R()), o); }
        else { const x = x0 + 0.15 + t * (x1 - x0 - 0.3) + jitter(0.04); for (const [a, b] of runs(y0 + 0.05, y1 - 0.05)) addLog([x, a, z], [x + jitter(0.05), b, z], r * (0.8 + 0.4 * R()), o); }
      }
    }
    // the coals heaped inside
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rr = Math.min(x1 - x0, y1 - y0) * 0.55;
    B.geo(polarField(cx, cy, [3, 4, 6, 8][d], [10, 16, 22, 28][d], (t) => rr * (1 + 0.08 * Math.sin(3 * t)), (r01) => z0 - 0.02 + 0.32 * (1 - r01 * r01)), ASH, { collide: true, cast: true });
    return { cx, cy, rr, z0 };
  };
  const cribI = crib(piles.incense.box, 0.08, 5, 4, 2, 0);       // fine fig wood (Tamid 2:5)
  const cribK = crib(piles['kiyum-haesh'].box, 0.11, 6, 4, 1);

  // ---------------------------------------------------------------- charcoal and half-burnt chunks (detail ≥ 1)
  if (d >= 1) {
    const oct = new OctahedronGeometry(1, 0);
    const q = new Quaternion(), e = new Euler(), sv = new Vector3(), pv = new Vector3(), mtx = new Matrix4();
    const chunk = (X, Y, Zs, size, list = chars, rnd = R, sink = 0) => {
      e.set(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3);
      q.setFromEuler(e);
      const sz = size * A.AMAH;
      sv.set(sz * (0.8 + 0.6 * rnd()), sz * (0.45 + 0.3 * rnd()), sz * (0.6 + 0.5 * rnd()));
      pv.set(X * A.AMAH, (Zs + size * (0.12 - sink)) * A.AMAH, -Y * A.AMAH);
      list.push(applyWorldUV(oct.clone().applyMatrix4(mtx.compose(pv, q, sv))));
    };
    // on the mound itself they go with it (the tapuach movable); on the floor drift beyond its toe they stay
    const onHeap = (X, Y, size, rnd, sink) => { const zt = tapZ(X, Y), za = ashH(X, Y); chunk(X, Y, Math.max(zt, za), size, zt >= za ? tapChars : chars, rnd, sink); };
    const nT = [0, 14, 28, 40][d];
    for (let i = 0; i < nT; i++) {                       // scattered over the flanks and toe, thicker toward the toe
      const a = R() * Math.PI * 2, r01 = 0.4 + 0.6 * Math.sqrt(R());
      onHeap(tcx + Math.cos(a) * RE * lobe(a) * r01, tcy + Math.sin(a) * RE * lobe(a) * r01, 0.035 + 0.055 * R(), R, 0);
    }
    // qa-r2-fix-world: dark streaks of charcoal down the fall line — the coarse, half-burnt bits raked up with the ash
    // roll furthest and gather in fans at the toe; most on the east flank, where the fire's ash is thrown up ⚙
    const RS2 = rng(A.seed ^ 0x3c5d);
    const nS = [0, 9, 16, 22][d];
    for (let k = 0; k < nS; k++) {
      const a0 = k < nS * 0.55 ? (RS2() - 0.5) * 2.2 : RS2() * 2 * Math.PI;      // the east sector first
      for (let r01 = 0.3 + 0.15 * RS2(); r01 < 1.04; r01 += 0.035 + 0.04 * RS2()) {
        const n2 = r01 > 0.75 ? 2 : 1;
        for (let j = 0; j < n2; j++) {
          const a = a0 + (RS2() - 0.5) * (0.05 + 0.16 * r01);
          const rr = RE * lobe(a) * Math.min(1.02, r01 + (RS2() - 0.5) * 0.03);
          onHeap(tcx + Math.cos(a) * rr, tcy + Math.sin(a) * rr, 0.025 + 0.04 * RS2() + 0.04 * r01 * RS2(), RS2, 0.18);
        }
      }
    }
    // a few charred stubs of gizrin raked up with the ash, half buried at the toe (not on the east, where the great
    // pile's billets touch the heap) ⚙
    if (d >= 2) for (let i = 0; i < 6; i++) {
      const a = 0.9 + RS2() * (2 * Math.PI - 1.8), r01 = 0.82 + 0.12 * RS2(), rr = RE * lobe(a) * r01;
      const X = tcx + Math.cos(a) * rr, Y = tcy + Math.sin(a) * rr, L = 0.35 + 0.3 * RS2(), yaw = a + Math.PI / 2 + (RS2() - 0.5) * 1.2;
      const p0 = [X - Math.cos(yaw) * L / 2, Y - Math.sin(yaw) * L / 2], p1 = [X + Math.cos(yaw) * L / 2, Y + Math.sin(yaw) * L / 2];
      const r = 0.05 + 0.03 * RS2();
      const { matrix, len } = logBetween([p0[0], p0[1], tapZ(...p0) + r * 0.2], [p1[0], p1[1], tapZ(...p1) + r * 0.2]);
      const g = logGeometry(len, r * A.AMAH * 0.7, r * A.AMAH, seg, RS2, 0.05, rows, 0.8, RS2() * Math.PI);
      tapChars.push(g.side.applyMatrix4(matrix), g.caps.applyMatrix4(matrix));
    }
    const nB = [0, 20, 40, 64][d];
    for (let i = 0; i < nB; i++) {                       // on the great pile's coal bed, round its hollow heart
      const a = R() * Math.PI * 2, rq = Math.sqrt(R()) * 0.85;
      const X = bcx + Math.cos(a) * brx * rq, Y = bcy + Math.sin(a) * bry * rq;
      chunk(X, Y, bedZ(X, Y), 0.06 + 0.09 * R());
    }
    for (const c of [cribI, cribK]) for (let i = 0; i < [0, 6, 12, 18][d]; i++) {   // on the small piles' coal heaps
      const a = R() * Math.PI * 2, rq = Math.sqrt(R()) * 0.9, X = c.cx + Math.cos(a) * c.rr * rq, Y = c.cy + Math.sin(a) * c.rr * rq;
      chunk(X, Y, c.z0 - 0.02 + 0.32 * (1 - rq * rq), 0.04 + 0.05 * R());
    }
  }

  const merged = (list) => (list.length ? mergeGeometries(list, false) : null);
  for (const [list, key] of [[sides[0], BARKS[0]], [sides[1], BARKS[1]], [sides[2], BARKS[2]], [caps, END], [chars, CHAR]]) {
    const g = merged(list);
    if (g) B.geo(g, key, { collide: false, cast: true });
  }

  // ---------------------------------------------------------------- the great pile and the tapuach as movables
  // The sim (terumat-hadeshen) clears the great pile down to its bed of embers and builds it again with the new gizrin
  // (Tamid 2:3–4), and heaps the raked ash onto the tapuach (Tamid 2:2).
  //   'altar.maarachah.great.pile'  userData.build(f): 0 = cleared (only the static ember bed and its coals remain) …
  //                                 1 = the built pile; billets appear layer by layer from the bottom, each layer row by
  //                                 row from the south, each row from the tapuach out to the face ⚙ order. The pile at 1
  //                                 is the burning pile (its heart burnt hollow and charred), as before.
  //   'altar.tapuach'               userData.grow(f): 1 = site.js's mound (r 4, h 3: "at times about 300 kor") … 0 = a low
  //                                 remnant (radius × 0.55, height × 0.25) after the ash was carried out ⚙ scale. The
  //                                 pile follows it: its rows run on to touch the smaller mound, and billets the mound
  //                                 no longer carries are not laid (above, in tenths of f). heightAt(X, Y): the visible
  //                                 mound's site Z there at the current size (null off it) — the colliders stay static.
  // Both also answer open(f) (the sim's door-handle contract) and report amount / openAmount; default 1.
  {
    const order = pileRecs.map((r, i) => i).sort((a, b) => {
      const p = pileRecs[a], q = pileRecs[b];
      return p.j - q.j || p.ri - q.ri || p.x - q.x;
    });
    const recs = order.map((i) => pileRecs[i]);
    const N = recs.length;
    const vc = (g) => (g.index ? g.index.count : g.attributes.position.count);
    const mats = [...BARKS.map((key, sp) => [key, (r) => (r.char || r.sp !== sp ? [] : [r.side])]),
      [END, (r) => (r.char ? [] : [r.caps])], [CHAR, (r) => (r.char ? [r.side, r.caps] : [])]];
    const pile = new Group();
    pile.name = 'altar.maarachah.great.pile';
    const parts = [];
    for (const [key, pick] of mats) {
      const list = [], start = new Int32Array(N), count = new Int32Array(N);
      if (!recs.some((r) => pick(r).length)) continue;
      let c = 0;
      recs.forEach((r, k) => { start[k] = c; for (const g of pick(r)) { list.push(g); c += vc(g); } count[k] = c - start[k]; });
      if (!list.length) continue;
      // the billets laid at the tapuach's current size, in building order: an index over the merged billets
      const geo = mergeGeometries(list, false);
      const index = new BufferAttribute(c > 65535 ? new Uint32Array(c) : new Uint16Array(c), 1);
      index.setUsage(DynamicDrawUsage);
      geo.setIndex(index);
      const mesh = new Mesh(geo, ctx.mats.get(key));
      mesh.name = `altar.maarachah.great.pile:${key}`;   // keys: the three barks, the ends, the char
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pile.add(mesh);
      parts.push({ mesh, index, start, count, cum: new Int32Array(N + 1) });
    }
    let gi = -1, laid = [];                               // the grid size in force; the record indices laid at it
    const fit = (g) => {
      const k = Math.min(GN, Math.max(0, Math.floor(g * GN + 1e-6)));
      if (k === gi) return;
      gi = k;
      laid = [];
      for (let i = 0; i < N; i++) if (recs[i].mask & (1 << gi)) laid.push(i);
      for (const p of parts) {
        const a = p.index.array;
        let c = 0;
        laid.forEach((i, n) => { const s = p.start[i], m = p.count[i]; for (let v = 0; v < m; v++) a[c++] = s + v; p.cum[n + 1] = c; });
        p.index.needsUpdate = true;
      }
    };
    const pud = {
      kind: 'pile', id: 'altar.maarachah.great.pile', f: 1,
      get billets() { return laid.length; },
      get amount() { return pud.f; },
      get openAmount() { return pud.f; },
      build(f) {
        const v = Math.min(1, Math.max(0, +f || 0));
        pud.f = v;
        const k = Math.round(v * laid.length);
        for (const { mesh, cum } of parts) { mesh.geometry.setDrawRange(0, cum[k]); mesh.visible = cum[k] > 0; }
        return v;
      },
      open(f) { return pud.build(f); },
    };
    fit(1);
    pud.build(1);
    pile.userData = pud;
    A.group.add(pile);
    A.movables.set(pile.name, pile);

    const tap = new Group();
    tap.name = 'altar.tapuach';
    const base = new Vector3(tcx * A.AMAH, (Z - 0.03) * A.AMAH, -tcy * A.AMAH);
    tap.position.copy(base);
    const add = (g, key) => {
      const mesh = new Mesh(g.translate(-base.x, -base.y, -base.z), ctx.mats.get(key));
      mesh.name = `altar.tapuach:${key}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      tap.add(mesh);
    };
    // the heap's own ash key once materials adds it (greyer, streaked, roughness 1 — qa-r2-fix-world request), else the floor's
    add(tapGeo, A.mat('ash_heap', ASH));
    if (tapChars.length) add(mergeGeometries(tapChars, false), CHAR);
    const tud = {
      kind: 'mound', id: 'altar.tapuach', f: 1,
      get amount() { return tud.f; },
      get openAmount() { return tud.f; },
      grow(f) {
        const v = Math.min(1, Math.max(0, +f || 0));
        tud.f = v;
        const [sr, sz] = growScale(v);
        tap.scale.set(sr, sz, sr);
        fit(v);
        pud.build(pud.f);
        return v;
      },
      open(f) { return tud.grow(f); },
      heightAt(X, Y) { const [sr, sz] = growScale(tud.f), h = tapZg(X, Y, sr, sz); return h > Zb + 1e-3 ? h : null; },
    };
    tap.userData = tud;
    A.group.add(tap);
    A.movables.set(tap.name, tap);
  }

  // ---------------------------------------------------------------- ash spilt onto the walkway beside the piles
  // low drifts straddling the ma'arachah line, their rims buried under the walkway and the floor ash (no open edge)
  const drift = (cx, cy, rx, ry, hh) => B.geo(polarField(cx, cy, [2, 3, 4, 5][d], [10, 14, 18, 22][d],
    (t) => 1 / Math.hypot(Math.cos(t) / rx, Math.sin(t) / ry),
    (r01, t, X, Y) => Z - 0.012 + hh * (1 - r01 * r01) * (1 + (d >= 1 ? 0.35 * nz(X * 2.1, Y * 2.1, 2) : 0))), ASH, { collide: false, cast: false });
  drift(mx1 + 0.05, gy0 + 1.1, 0.75, 1.3, 0.05);
  drift(mx1 + 0.1, gcy + 0.4, 0.85, 1.6, 0.06);
  drift(mx1 + 0.05, gy1 - 1.0, 0.7, 1.2, 0.045);
  drift(mx0 - 0.05, (piles.incense.box.min[1] + piles.incense.box.max[1]) / 2, 0.6, 1.0, 0.04);

  // simple solid colliders for the piles (the logs themselves are not colliders)
  const col = new Mesher();
  for (const p of Object.values(piles)) col.box([p.box.min[0] + 0.2, p.box.min[1] + 0.2, p.box.min[2]], [p.box.max[0] - 0.2, p.box.max[1] - 0.2, p.box.max[2] - 0.2]);
  ctx.addCollider(col.geometry(), 'altar:piles');

  // ---------------------------------------------------------------- the two gizrin laid on the great pile (movable)
  // "two gizrei etzim" of the order of the day (Yoma 2:5, 26b; 22a) — Moshe's standard read literally (Zevachim 62b):
  // a shortened amah long and wide, as thick as the strickle of a heaped se'ah (≈ 2 etzba'ot ⚙): riven boards
  const two = new Group();
  two.name = 'altar.two-logs';
  {
    const parts = [];
    const W = GL / 2, TK = 1 / 12;
    for (const dy of [-0.55, 0.55]) {
      const yc = gcy + dy + jitter(0.08), xc = gx1 - 1.6 + jitter(0.15);   // laid on from the pile's face, east
      const { matrix, len } = logBetween([xc - GL / 2, yc, gTop + TK / 2 + 0.01], [xc + GL / 2, yc + jitter(0.08), gTop + TK / 2 + 0.03]);
      const g = logGeometry(len, W * A.AMAH, W * A.AMAH * 0.96, Math.max(8, seg + 2), R, 0.03, rows, TK / (2 * W));
      g.side.applyMatrix4(matrix); g.caps.applyMatrix4(matrix);
      parts.push(g.side, g.caps);
    }
    const mesh = new Mesh(mergeGeometries(parts, false), ctx.mats.get(GIZ));
    mesh.name = 'altar.two-logs:mesh';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    two.add(mesh);
  }
  A.group.add(two);
  A.movables.set(two.name, two);

  // ---------------------------------------------------------------- fires (fx: 'pyre' — ordinary wood fire, smoke straight up)
  // The great pile burns end to end with two emitters 2.7 amot (1.3 m) apart: fx clusters same-kind fires within 1.6 m
  // into ONE light, which takes the fire-shadow slot — a second, unshadowed light leaked through the altar onto the
  // yesod and the pavement. Both emitters smoke, so the great pile's column is two overlapping, fire-lit columns —
  // wider and denser than the small piles' single thin ones.
  // The merged light sits at the candela-weighted mean, +28.55: under the kevesh's plane extended (+28.97 there), so the
  // ramp's top gets none of it. Without .inner's light it would be +28.90, still under the plane, with a quarter less on
  // the altar top. Where a pyre's light stands is fx's to decide (world-3-fix r2: render request).
  const gMain = [gcx + 0.4, gcy, Z + 0.9], gInner = [gcx + 0.4 - 2.7, gcy + 0.3, Z + bedH];
  A.fires.push(ctx.addFire({ id: 'altar.maarachah.great', kind: 'pyre', pos: gMain, size: 2.4, intensity: 1, schedule: 'always', smoke: true }));
  A.fires.push(ctx.addFire({ id: 'altar.maarachah.great.inner', kind: 'pyre', pos: gInner, size: 1.9, intensity: 0.9, schedule: 'always', smoke: true }));
  const cen = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
  // the incense pile is a bed of coals with low flames; the third pile a modest fire
  const [ix, iy] = cen(piles.incense.box);
  // the two small piles light nothing of their own (light: false — render-env-2): occluded by the great pile's light,
  // they only took two of the budgeted fire-light slots; flames, glow and smoke stay
  A.fires.push(ctx.addFire({ id: 'altar.maarachah.incense', kind: 'pyre', pos: [ix, iy, Z + 0.4], size: 0.75, intensity: 0.6, schedule: 'always', smoke: true, light: false }));
  const [kx, ky] = cen(piles['kiyum-haesh'].box);
  A.fires.push(ctx.addFire({ id: 'altar.maarachah.kiyum', kind: 'pyre', pos: [kx, ky, Z + 0.5], size: 1.15, intensity: 0.75, schedule: 'always', smoke: true, light: false }));

  return { gTop, tapuachTop: tapZ(tcx, tcy) };
}
