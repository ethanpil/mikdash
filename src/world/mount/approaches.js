// The ways onto the Mount:
//   * the two Chuldah passages (context.chuldah.tunnel-*, Middot 1:3): portal at the Ophel grade, a vaulted passage
//     north under the Mount (its hollow substructure — Parah 3:3), then a stair up into an open stairwell on the
//     pavement; the paved Ophel plaza before the portals ⚙
//   * the Parah causeway (context.parah-causeway): "they made a causeway from Har HaBayit to Har HaMishchah, arches upon
//     arches, an arch over the pier, because of the grave of the deep" (Parah 3:6) — two tiers along its whole length,
//     each upper arch centred over a lower pier, from the Shushan threshold across the Kidron
//   * the Kiponus approach (unsourced, site.js: "bridge/ramp to the upper city" ⚙) — a single arcade over the Tyropoeon
//   * a short flight down from Tadi to the northern grade
import { Shape } from 'three';
import { shapeInPlane } from './kit.js';
import { getTerrain } from '../terrain/height.js';
import { distToPolyline } from '../terrain/plan.js';

const PARAPET_H = 10 / 6;                          // 10 tefachim (Devarim 22:8 minimum) ⚙

export function buildApproaches(ctx, kit, group, detail) {
  const T = getTerrain(ctx);
  const floorHoles = [];
  const chuldah = [];
  for (const k of ['w', 'e']) chuldah.push(buildChuldah(ctx, kit, detail, k, floorHoles));
  buildOphelPlaza(ctx, kit, T);
  buildTadiSteps(ctx, kit);
  const kip = buildKiponusBridge(ctx, kit, T, detail);
  const cw = buildCauseway(ctx, kit, T, detail);
  return { floorHoles, chuldah, kip, cw };
}

// ------------------------------------------------------------------------------------------------ Chuldah passages
function buildChuldah(ctx, kit, detail, k, floorHoles) {
  const e = ctx.el(`context.chuldah.tunnel-${k}`);
  const P = e.params;
  const x0 = e.box.min[0], x1 = e.box.max[0], w = x1 - x0, r = w / 2, cx = (x0 + x1) / 2;
  const zP = P.portal[2];
  const lvl = P.level;
  const zCrown = lvl.max[2], zs = zCrown - r;
  const yIn = 0;                                                 // inner face of the S wall (the wall's own jambs before it)
  const sp = P.stairPath, yS0 = sp.from[1], yS1 = sp.to[1];
  const n = Math.round(sp.risers);
  const rise = (sp.to[2] - sp.from[2]) / n, tread = (yS1 - yS0) / n;
  const head = 5;                                                // headroom kept under the vault springing (amot) ⚙
  const yHole = Math.min(yS1, yS0 + Math.ceil(((zs - head) - zP) / rise) * tread);
  const floorTop = ctx.el('mount.floor').box.max[2];
  // floor of the level passage (and through the portal)
  kit.quad([[x0, lvl.min[1], zP], [x1, lvl.min[1], zP], [x1, yS0, zP], [x0, yS0, zP]], [0, 0, 1], 'paving_mount');
  // side walls up to the springing (level part + under the vault over the stair), and to the pavement in the stairwell
  kit.quad([[x0, yIn, zP], [x0, yHole, zP], [x0, yHole, zs], [x0, yIn, zs]], [1, 0, 0], 'ashlar_plain');
  kit.quad([[x1, yIn, zP], [x1, yHole, zP], [x1, yHole, zs], [x1, yIn, zs]], [-1, 0, 0], 'ashlar_plain');
  kit.quad([[x0, yHole, zP], [x0, yS1, zP], [x0, yS1, floorTop], [x0, yHole, floorTop]], [1, 0, 0], 'ashlar_plain');
  kit.quad([[x1, yHole, zP], [x1, yS1, zP], [x1, yS1, floorTop], [x1, yHole, floorTop]], [-1, 0, 0], 'ashlar_plain');
  // barrel vault (inner surface) from the wall to the stairwell
  const seg = [6, 10, 14, 18][Math.max(0, Math.min(3, detail))];
  for (let i = 0; i < seg; i++) {
    const a0 = Math.PI * i / seg, a1 = Math.PI * (i + 1) / seg;
    const p0 = [cx + r * Math.cos(a0), zs + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), zs + r * Math.sin(a1)];
    const am = (a0 + a1) / 2;
    kit.quad([[p0[0], yIn, p0[1]], [p1[0], yIn, p1[1]], [p1[0], yHole, p1[1]], [p0[0], yHole, p0[1]]], [-Math.cos(am), 0, -Math.sin(am)], 'ashlar_plain', { collide: false });
  }
  // spandrels where the square portal meets the vault (facing south), and the vault's end over the stairwell (facing north)
  const sp1 = new Shape();
  sp1.moveTo(x0, zs); sp1.lineTo(x0, zCrown);
  sp1.lineTo(x1, zCrown); sp1.lineTo(x1, zs);
  for (let i = 0; i <= seg; i++) { const a = Math.PI * i / seg; sp1.lineTo(cx + r * Math.cos(a), zs + r * Math.sin(a)); }
  kit.geo(shapeInPlane(sp1, 'X', yIn, -1, seg), 'ashlar_plain', { collide: false });
  const sp2 = new Shape();
  sp2.moveTo(x0, zs); sp2.lineTo(x0, floorTop);
  sp2.lineTo(x1, floorTop); sp2.lineTo(x1, zs);
  for (let i = 0; i <= seg; i++) { const a = Math.PI * i / seg; sp2.lineTo(cx + r * Math.cos(a), zs + r * Math.sin(a)); }
  kit.geo(shapeInPlane(sp2, 'X', yHole, 1, seg), 'ashlar_plain', { collide: false });
  // the stair: treads and risers
  for (let i = 0; i < n; i++) {
    const ya = yS0 + i * tread, yb = ya + tread, zt = zP + (i + 1) * rise, zb = zP + i * rise;
    kit.quad([[x0, ya, zt], [x1, ya, zt], [x1, yb, zt], [x0, yb, zt]], [0, 0, 1], 'steps_stone');
    kit.quad([[x0, ya, zb], [x1, ya, zb], [x1, ya, zt], [x0, ya, zt]], [0, -1, 0], 'steps_stone');
  }
  // the stairwell in the pavement, with a parapet on its three closed sides
  floorHoles.push([x0, yHole, x1, yS1]);
  const t = 1, h = floorTop + PARAPET_H;
  kit.box([x0 - t, yHole - t, floorTop], [x0, yS1, h], 'marble_white');
  kit.box([x1, yHole - t, floorTop], [x1 + t, yS1, h], 'marble_white');
  kit.box([x0, yHole - t, floorTop], [x1, yHole, h], 'marble_white');
  // lamps in the passage (night) ⚙ — small stone brackets
  const lamps = [];
  for (const [i, f] of [[0, 0.25], [1, 0.6], [2, 0.92]]) {
    const y = yIn + (yS0 - yIn) * f;
    const side = i % 2 ? x1 : x0, dir = i % 2 ? -1 : 1;
    const zl = zP + 7;
    if (detail >= 1) kit.box([Math.min(side, side + dir * 0.6), y - 0.35, zl - 0.25], [Math.max(side, side + dir * 0.6), y + 0.35, zl], 'ashlar_plain', { collide: false });
    lamps.push([side + dir * 0.35, y, zl + 0.1]);
  }
  return { id: `context.chuldah.tunnel-${k}`, x0, x1, cx, zP, yHole, exit: P.exit, portal: P.portal, lamps };
}

function buildOphelPlaza(ctx, kit, T) {
  const p = T.plan.plaza;
  const z = ctx.el('mount.gate.chuldah-w').box.min[2];
  kit.faces([p.x0, p.y0, z - 1.2], [p.x1, p.y1, z], { e: 'ashlar_plain', w: 'ashlar_plain', s: 'ashlar_plain' });
  for (let x = p.x0; x < p.x1 - 1e-6; x += 45) {
    const xb = Math.min(x + 45, p.x1);
    kit.quad([[x, p.y0, z], [xb, p.y0, z], [xb, p.y1, z], [x, p.y1, z]], [0, 0, 1], 'paving_mount', { castShadow: false });
  }
}

function buildTadiSteps(ctx, kit) {
  const g = ctx.el('mount.gate.tadi').box;
  const wN = ctx.el('mount.wall.north');
  const yFace = wN.box.max[1];
  const ground = wN.params.outerFootZ;
  const n = Math.max(1, Math.round((g.min[2] - ground) / 0.5));
  const rise = (g.min[2] - ground) / n;
  const xa = g.min[0] - 2, xb = g.max[0] + 2;
  for (let k = 1; k < n; k++) {
    const ya = yFace + (k - 1) * 0.5, yb = ya + 0.5, top = g.min[2] - k * rise;
    kit.faces([xa, ya, ground - 1.5], [xb, yb, top], { t: 'steps_stone', n: 'steps_stone', e: 'steps_stone', w: 'steps_stone' });
  }
}

/// ------------------------------------------------------------------------------------------------ arcades
/**
 * Elevation outlines (Shapes in the X–Z plane, site amot) of one arcade tier: solid between bottom(x) and top(x)
 * wherever it is deeper than minDepth; `xs` are the sample abscissae (sorted).
 */
function elevationShapes(xs, top, bottom, minDepth = 0.4) {
  const shapes = [];
  let run = [];
  const flush = () => {
    if (run.length >= 2) {
      const s = new Shape();
      s.moveTo(run[0].x, run[0].t);
      for (const p of run) s.lineTo(p.x, p.b);
      for (let i = run.length - 1; i >= 1; i--) s.lineTo(run[i].x, run[i].t);
      s.closePath();
      shapes.push(s);
    }
    run = [];
  };
  for (const x of xs) {
    const t = top(x);
    if (!Number.isFinite(t)) { flush(); continue; }
    const b = Math.min(bottom(x), t);
    if (t - b > minDepth) run.push({ x, t, b });
    else { if (run.length) run.push({ x, t, b: Math.min(b, t - 0.05) }); flush(); }
  }
  flush();
  return shapes;
}

/** Arch opening: centre c, half-span r, crown z, rise f (f = r: semicircle; less: segmental). */
function arch(c, r, crown, f) { const R = (r * r + f * f) / (2 * f); return { c, r, crown, f, R, zc: crown - R }; }
function intrados(o, x) { const d = x - o.c; return Math.abs(d) > o.r + 1e-9 ? -Infinity : o.zc + Math.sqrt(Math.max(0, o.R * o.R - d * d)); }
/** sample abscissae: every amah plus 16 points across each opening plus both sides of each step */
function samples(xa, xb, openings, steps = []) {
  const set = new Set([xa, xb]);
  for (let x = Math.ceil(xa); x < xb; x += 1) set.add(x);
  for (const o of openings) for (let i = 0; i <= 16; i++) { const x = o.c - o.r + 2 * o.r * i / 16; if (x > xa && x < xb) set.add(x); }
  for (const s of steps) for (const x of [s - 1e-3, s + 1e-3]) if (x > xa && x < xb) set.add(x);
  return [...set].sort((p, q) => p - q);
}

function buildKiponusBridge(ctx, kit, T, detail) {
  const g = ctx.el('mount.gate.kiponus').box;
  const xe = g.min[0], xw = T.plan.kipEndX;
  const yc = (g.min[1] + g.max[1]) / 2, half = (g.max[1] - g.min[1]) / 2 + 1;   // gate + a 1-amah parapet each side
  const y0 = yc - half, y1 = yc + half;
  const deck = g.min[2], slab = 0.6;
  // bay 18, piers 4: the 14-amah openings clear the Tyropoeon street, and one is centred on it ⚙
  const B = 18, pw = 4, r = (B - pw) / 2, crown = deck - slab - 1.4;
  const street = T.plan.streets.find((s) => s.id === 'tyropoeon');
  const cS = street ? distToPolyline(street.pts, xe, yc).x : xe - B / 2;
  const openings = [];
  for (let k = -60; k <= 60; k++) { const c = cS + k * B; if (c - r > xw + 1 && c + r < xe - 2) openings.push(arch(c, r, crown, r)); }
  const ground = (x) => Math.min(T.heightZ(x, y0), T.heightZ(x, yc), T.heightZ(x, y1)) - 2.5;
  const bottom = (x) => { let z = ground(x); for (const o of openings) z = Math.max(z, intrados(o, x)); return z; };
  for (const s of elevationShapes(samples(xw, xe, openings), () => deck - slab, bottom)) kit.extrude(s, 'X', y0, y1, 'ashlar_plain', {}, 6);
  deckOnTop(kit, xw - 2, xe, y0, y1, deck, slab, detail);
  return { x0: xw, x1: xe, y: yc, streetX: cS };
}

/**
 * The Parah causeway: "arches upon arches, an arch over the pier" (Parah 3:6) along its whole length. Bays of 20;
 * the upper arches are centred over the lower piers (xa + k·B), the upper piers over the lower arches. The tier
 * line halves the height in every bay (stepped at the upper piers, under a string course), so both tiers run
 * wherever the arcade stands; a tier too short for a semicircle gets a segmental arch; piers thicken with their
 * height. Only where the slope comes within 12 amot of the deck at the east end does it close in a solid abutment ⚙.
 */
function buildCauseway(ctx, kit, T, detail) {
  const e = ctx.el('context.parah-causeway');
  const b = e.box;
  const xa = b.min[0], xb = b.max[0], y0 = b.min[1], y1 = b.max[1], yc = (y0 + y1) / 2;
  const deck = e.params.deckZ, slab = 0.6;
  const B = 20, HMIN = 12;
  const dU = deck - slab, crownU = dU - 1.4;
  const gTrue = (x) => Math.min(T.heightZ(x, y0), T.heightZ(x, yc), T.heightZ(x, y1));
  const ground = (x) => gTrue(x) - 3;                            // footings 3 amot into the ground
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // regions: k ≥ 1 spans [xa + (k − ½)B, xa + (k + ½)B] round the lower pier k; region 0 = [xa, xa + ½B] at the wall
  const K = Math.ceil((xb - xa) / B + 0.5);
  const reg = [];
  for (let k = 0; k <= K; k++) {
    const r0 = Math.max(xa, xa + (k - 0.5) * B), r1 = Math.min(xb, xa + (k + 0.5) * B);
    if (r1 <= r0) break;
    let gmax = -Infinity;
    for (let x = r0; x <= r1; x += 2) gmax = Math.max(gmax, gTrue(x));
    const H = dU - gTrue(k === 0 ? xa + B : xa + k * B);
    const solid = dU - gmax < HMIN;
    const Zm = Math.round((dU - 0.5 * H) * 2) / 2;               // the tier line, on a half-amah course
    reg.push({ k, r0, r1, H, Zm, solid });
  }
  if (reg.length > 1 && !reg[1].solid) { reg[0].Zm = reg[1].Zm; reg[0].solid = false; }
  // once the abutment begins it continues to the end (no arches after it)
  const firstSolid = reg.findIndex((r, i) => i > 0 && r.solid);
  if (firstSolid > 0) for (let i = firstSolid; i < reg.length; i++) reg[i].solid = true;
  const regAt = (x) => reg[Math.max(0, Math.min(reg.length - 1, x <= xa + 0.5 * B ? 0 : Math.round((x - xa) / B)))];
  const upper = [], lower = [];
  for (const r of reg) {
    if (r.k === 0 || r.solid) continue;
    const hU = dU - r.Zm, pu = clamp(4 + (hU - 30) * 0.06, 4, 6.5), ru = (B - pu) / 2;
    const hop = crownU - r.Zm;
    upper.push(arch(xa + r.k * B, ru, crownU, clamp(hop - 1.5, 2.5, ru)));
  }
  for (let j = 0; j + 1 < reg.length; j++) {
    const L = reg[j], R = reg[j + 1];
    if (L.solid || R.solid) continue;
    const c = xa + (j + 0.5) * B;
    const crown = Math.min(L.Zm, R.Zm) - 1.6;
    const hL = crown - ground(c), pl = clamp(6 + (hL - 30) * 0.06, 6, 9), rl = (B - pl) / 2;
    const hop = crown - Math.max(ground(c - rl), ground(c), ground(c + rl));
    if (hop < 3) continue;
    lower.push(arch(c, rl, crown, clamp(hop - 1.5, 2.5, rl)));
  }
  const steps = reg.slice(1).map((r) => r.r0);
  const foot = (x) => { const r = regAt(x); return r.solid ? ground(x) : Math.max(r.Zm, ground(x)); };
  const bottomU = (x) => { let z = foot(x); for (const o of upper) z = Math.max(z, intrados(o, x)); return z; };
  const topL = (x) => { const r = regAt(x); return r.solid ? -Infinity : r.Zm; };
  const bottomL = (x) => { let z = ground(x); for (const o of lower) z = Math.max(z, intrados(o, x)); return z; };
  for (const s of elevationShapes(samples(xa, xb, upper, steps), () => dU, bottomU)) kit.extrude(s, 'X', y0, y1, 'ashlar_plain', {}, 8);
  for (const s of elevationShapes(samples(xa, xb, lower, steps), topL, bottomL)) kit.extrude(s, 'X', y0 - 0.5, y1 + 0.5, 'ashlar_plain', {}, 8);
  if (detail >= 1) {
    // a string course on the tier line of every arcaded bay
    for (const r of reg) {
      if (r.solid || ground((r.r0 + r.r1) / 2) > r.Zm - 1) continue;
      kit.box([r.r0, y0 - 0.85, r.Zm - 0.5], [r.r1, y1 + 0.85, r.Zm + 0.2], 'ashlar_plain', { collide: false, castShadow: false });
    }
  }
  deckOnTop(kit, xa, xb + 2, y0, y1, deck, slab, detail);
  const arcadeEnd = firstSolid > 0 ? reg[firstSolid].r0 : xb;
  return { x0: xa, x1: xb, y: yc, arcadeEnd, upper: upper.length, lower: lower.length, regions: reg };
}

/** paved deck slab with parapets of 10 tefachim along both edges */
function deckOnTop(kit, xa, xb, y0, y1, deck, slab, detail) {
  const t = 1;
  for (let x = xa; x < xb - 1e-6; x += 50) {
    const x2 = Math.min(x + 50, xb);
    kit.quad([[x, y0 + t, deck], [x2, y0 + t, deck], [x2, y1 - t, deck], [x, y1 - t, deck]], [0, 0, 1], 'paving_mount', { castShadow: false });
  }
  kit.faces([xa, y0 - 0.25, deck - slab], [xb, y1 + 0.25, deck - slab + 0.35], { n: 'ashlar_plain', s: 'ashlar_plain', b: 'ashlar_plain' }, { collide: false });
  kit.faces([xa, y0, deck - slab], [xb, y0 + t, deck + PARAPET_H], { n: 'ashlar_plain', s: 'ashlar_plain', t: 'ashlar_plain', w: 'ashlar_plain', e: 'ashlar_plain' });
  kit.faces([xa, y1 - t, deck - slab], [xb, y1, deck + PARAPET_H], { n: 'ashlar_plain', s: 'ashlar_plain', t: 'ashlar_plain', w: 'ashlar_plain', e: 'ashlar_plain' });
  if (detail >= 1) {
    kit.faces([xa, y0 - 0.12, deck + PARAPET_H - 0.2], [xb, y0 + t + 0.12, deck + PARAPET_H + 0.05], { n: 'ashlar_plain', s: 'ashlar_plain', t: 'ashlar_plain' }, { collide: false, castShadow: false });
    kit.faces([xa, y1 - t - 0.12, deck + PARAPET_H - 0.2], [xb, y1 + 0.12, deck + PARAPET_H + 0.05], { n: 'ashlar_plain', s: 'ashlar_plain', t: 'ashlar_plain' }, { collide: false, castShadow: false });
  }
}
