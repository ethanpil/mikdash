// Places of the G1 night scenes, derived from src/data/site.js elements only (ctx.el). Spots and walking lines that
// the sources do not fix are reconstruction (⚙) and are logged in docs/decisions/choreo-g1-night.md.
//
// Beit HaMoked (Middot 1:6–9; Tamid 1:1): the hall's chol half is the dormitory — elders on the rovadin, the young
// kohanim on the floor (no sitting or sleeping in the kodesh half, Yoma 25a); the hearth; the keys slab; the NW corner
// chamber with the winding stair down to the lamp-lit passage and the Beit HaTevilah (mikveh, fire, privy).
import { SitePath } from '../../lib/path.js';

const RAD = Math.PI / 180;

/** everything the Moked scenes need, once per world (pure geometry) */
export function mokedPlaces(ctx) {
  const hall = ctx.el('azarah.moked.hall'), p = hall.params, i = p.interior, Z = p.floorZ ?? i.min[2];
  const ky = p.kodeshLine?.y ?? (i.min[1] + i.max[1]) / 2;
  const cx = p.dome?.center?.[0] ?? (i.min[0] + i.max[0]) / 2;
  // the hearth as courts/moked.js builds it: in the chol half, 5 amot north of the kodesh line on the hall's axis
  const hearth = [cx, ky + 5, Z];
  const ksb = ctx.el('azarah.moked.keys-slab').box;
  const slab = [(ksb.min[0] + ksb.max[0]) / 2, (ksb.min[1] + ksb.max[1]) / 2, Z];
  const lambs = ctx.el('azarah.moked.chamber.lambs').box, desc = ctx.el('azarah.moked.chamber.tevilah-descent').box;
  const y0 = lambs.max[1], y1 = desc.min[1];
  // rovadin: three ledges of ½ rise, 1 amah deep each, on the W and E walls between the corner chambers
  // (courts/moked.js furnishings); exposed tread k (0 lowest) of the west side is X i.min + (2−k) … + (3−k)
  const tread = (side, k) => ({ X: side < 0 ? i.min[0] + 2.5 - k : i.max[0] - 2.5 + k, Z: Z + 0.5 * (k + 1) });
  const door = ctx.el('azarah.moked.door-chel').box;
  const gate = ctx.el('azarah.gate.moked'), pk = gate.params.pishpash.box;
  const pish = [(pk.min[0] + pk.max[0]) / 2, (pk.min[1] + pk.max[1]) / 2, pk.min[2]];
  const flight = ctx.el('azarah.moked.flight').box;
  // the NW chamber's door to the hall (courts/moked.js cornerChambers: 1.25 from its inner corner, in its south wall)
  const stairDoor = [desc.max[0] - 1.25, desc.min[1] + 0.25, Z];

  const M = {
    Z, ky, cx, hearth, slab, i, y0, y1, tread, door, pish, flight, stairDoor,
    doorMid: [(door.min[0] + door.max[0]) / 2, door.min[1] + 0.4, Z],
    doorOut: [(door.min[0] + door.max[0]) / 2, door.max[1] + 0.6, Z],
    gateIn: [pish[0], pk.max[1] + 1.2, Z],        // in the hall, before the wicket
    gateOut: [pish[0], pk.min[1] - 1.4, Z],       // in the Azarah, before the wicket
  };

  // ---- sleepers (⚙ spots). 'lie' (elders, the slab kohen): feet at the origin, head away from the heading.
  // 'sleep' (young kohanim, on the side, knees drawn up): the origin is at the FEET end; the body runs to the figure's
  // right (head 1.46 m from the origin), knees and hands toward the heading — see FOOT below (measured from the clips
  // and the folded_garments mat/cover, src/people/clips.js + props.js). Spots are laid in plan.js against FOOT.
  M.elders = [];
  for (const k of [0, 1, 2]) for (const side of [-1, 1]) {
    const t = tread(side, k);
    // a little toward the tread's open edge: the arm on the riser side clears the next ledge up
    M.elders.push({ at: [t.X - 0.18 * side, ky + 0.25, t.Z], h: 180, pose: 'lie', side, k, floor: [side < 0 ? i.min[0] + 3.6 : i.max[0] - 3.6, ky + 1.6 + 0.9 * k, Z] });
  }
  // what the floor must keep clear of (plan-check.mjs tests every sleeping spot against these): the hearth's kerb
  // (r 1.35) and its star logs (to r 1.7), the chel door's two 5-amah leaves swinging into the hall (the Ish Har
  // HaBayit's party opens them at night — night-watch.js), the lamp stand of the kohanic post, the stair door's way
  M.keep = {
    hearthR: 1.75, bodyR: 1.85, headR: 2.75,
    leaves: [[door.min[0], door.max[1] - 0.25], [door.max[0], door.max[1] - 0.25]], leafR: 5.05,
    lamp: [i.min[0] + 3.6, ky + 0.8], lampR: 0.75,
    floor: (X, Y) => (Y >= ky + 0.08 && Y <= y1 && X >= i.min[0] + 3 && X <= i.max[0] - 3) || (Y >= y1 && Y <= i.max[1] && X >= desc.max[0] && X <= i.max[0] - 5),
  };
  // where the woken / returned stand or kneel: by the hearth (warmth; the chol half, where sitting is allowed)
  M.byHearth = (deg, r = 2.9) => [hearth[0] + Math.sin(deg * RAD) * r, hearth[1] + Math.cos(deg * RAD) * r, Z];

  // ---- the winding stair (Middot 1:6, 1:9), as courts/moked.js builds it (parts.js spiral): centre, 56 steps of ½,
  // 14 to a turn, a0 −40°, clockwise ascent; its head a landing round the south of the shaft at the chamber's door.
  const st = ctx.el('azarah.underground.stair'), sp = st.params;
  const c = sp.center, zBot = st.box.min[2];
  const nSteps = sp.steps || Math.round((Z - zBot) / (sp.rise || 0.5));
  const da = -360 / 14, a0 = -40;
  const r1 = Math.min(st.box.max[0] - c[0], st.box.max[1] - c[1]) - 0.05, rw = (0.5 + r1) / 2 + 0.05;
  const stepZ = (phi) => {                      // walking surface at polar angle phi (deg, unwrapped), descending
    const k = Math.floor((phi - a0) / da);
    return k >= nSteps - 1 ? Z : k < 0 ? zBot : zBot + 0.5 * (k + 1);
  };
  const P = (phi, z, r = rw) => [c[0] + Math.cos(phi * RAD) * r, c[1] + Math.sin(phi * RAD) * r, z];
  const phiTop = a0 + (nSteps - 1) * da;        // the landing's descent edge
  let phiDoor = Math.atan2(stairDoor[1] - c[1], stairDoor[0] - c[0]) / RAD;
  while (phiDoor > phiTop) phiDoor -= 360;     // on the landing (beyond the top edge, the way the ascent turns)
  const down = [[stairDoor[0], stairDoor[1] - 1.2, Z], [stairDoor[0], stairDoor[1], Z], P(phiDoor, Z, rw + 0.4)];
  for (let phi = phiTop - 12; phi < a0 + 60; phi += 9) down.push(P(phi, phi <= phiTop ? Z : stepZ(phi)));
  const pa = ctx.el('azarah.underground.passage').box;
  const px = (pa.min[0] + pa.max[0]) / 2;
  down.push(P(a0 + 70, zBot), [c[0] + 0.7, st.box.max[1] + 0.3, zBot], [px, st.box.max[1] + 2, zBot]);
  M.stairDown = down;                           // hall → foot of the stair (site points, Z the tread under each)
  const tv = ctx.el('azarah.underground.beit-hatevilah'), tb = tv.box, tp = tv.params, zF = tp.floorZ ?? zBot;
  const mk = tp.mikveh;
  M.zF = zF;
  M.passageEnd = [px, tb.min[1] + 0.8, zF];
  M.passage = [[px, st.box.max[1] + 2, zF], [px, tb.min[1] + 0.8, zF]];
  M.passageLen = new SitePath(M.passage).length;
  M.stairLen = new SitePath(down).length;
  // the mikveh: steps go down westward from its east side (½ per 0.6), then the deep part (courts/moked.js underground)
  const my = (mk.min[1] + mk.max[1]) / 2, water = zF - 0.25, bot = water - 3;
  M.mikveh = {
    edge: [mk.max[0] + 0.7, my, zF], top: [mk.max[0] - 0.3, my, zF - 0.5],
    step: [mk.max[0] - 2.7, my, zF - 2.5], deep: [mk.min[0] + 0.5, my, bot], water, bot, my,
  };
  M.medurah = [tp.medurah[0], tp.medurah[1], zF];
  // the privy of honour (Tamid 1:1): before its door (on its south wall) and inside it (courts/moked.js underground)
  const pr = tp.beitKisseShelKavod;
  M.privy = { front: [pr.min[0] + 1.4, pr.min[1] - 0.75, zF], inside: [pr.min[0] + 1.4, pr.min[1] + 1.5, zF] };
  // the impure kohen's place at the fire: its west side, seen down the passage through its arch ⚙
  M.keriFire = [tp.medurah[0] - 1.8, tp.medurah[1] + 0.5, zF];
  // the stone bench along the east wall (courts/moked.js: X max−1.6…max, Y min+1…min+8, 1 high)
  M.bench = { X: tb.max[0] - 0.8, Y0: tb.min[1] + 1.3, Y1: tb.min[1] + 7.7, top: zF + 1, stand: tb.max[0] - 2.4 };
  M.bht = tb;
  return M;
}

/**
 * Floor footprints (amot) of a figure in the actor's own frame: r along the figure's right (heading + 90), f along the
 * heading. Measured from the people clips (src/people/dev/joints.mjs man sleep|lie 0.5) and the folded_garments mat
 * (1.95 × 0.78 m) and mantle cover of the pillow grips (src/people/props.js foldedGarments / cover):
 *   sleep: mat from 0.24 m behind the toes … the head end; cover to 0.25 m behind the back; the left hand 0.69 m forward
 *   lie:   mat from 0.25 m beyond the feet … past the head (1.71 m); cover ± 0.42 m across
 *   kneel / stand: the body (and kneeling shins) only
 * body: the figure itself (what a walker must not pass through). head: the head's centre.
 */
export const FOOT = {
  sleep: { r: [-0.5, 3.6], f: [-0.55, 1.45], body: { r: [0.3, 3.5], f: [-0.3, 1.45] }, head: [3.05, 0.2] },
  lie: { r: [-0.88, 0.88], f: [-3.65, 0.56], body: { r: [-0.75, 0.75], f: [-3.45, 0.1] }, head: [0, -3.1] },
  lie_bare: { r: [-0.75, 0.75], f: [-3.45, 0.1], body: { r: [-0.75, 0.75], f: [-3.45, 0.1] }, head: [0, -3.1] },
  kneel: { r: [-0.55, 0.55], f: [-0.75, 0.6], body: { r: [-0.55, 0.55], f: [-0.75, 0.6] }, head: [0, 0.1] },
};

/** a footprint's corners [[X, Y] × 4] and head point at a spot: pose 'sleep' | 'lie' | 'lie_bare' | 'kneel' */
export function footprint(pose, at, h, part = 'all') {
  const F = FOOT[pose] || FOOT.kneel, fp = part === 'body' ? F.body : F;
  const a = (h * Math.PI) / 180, fx = Math.sin(a), fy = Math.cos(a), rx = Math.cos(a), ry = -Math.sin(a);
  const P = (r, f) => [at[0] + rx * r + fx * f, at[1] + ry * r + fy * f];
  return { pts: [P(fp.r[0], fp.f[0]), P(fp.r[1], fp.f[0]), P(fp.r[1], fp.f[1]), P(fp.r[0], fp.f[1])], head: P(F.head[0], F.head[1]) };
}

/** the altar top and the ramp (site.js altar.*) */
export function altarPlaces(ctx) {
  const top = ctx.el('altar.top'), mar = ctx.el('altar.maarachah-area'), kv = ctx.el('altar.kevesh');
  const Zt = top.params?.topZ ?? top.box.max[2];
  const piles = Object.fromEntries((mar.params.piles || []).map((p) => [p.id, p]));
  const g = piles.great.box;
  const kp = kv.params, x0 = kv.box.min[0], x1 = kv.box.max[0];
  const yFoot = kp.from[1], yHead = kp.to[1], zFoot = kp.from[2], zHead = kp.to[2];
  const rampZ = (Y) => zFoot + (zHead - zFoot) * Math.min(1, Math.max(0, (Y - yFoot) / (yHead - yFoot)));
  const xE = (x0 + x1) / 2 + 4, xW = (x0 + x1) / 2 - 4;   // up on the east, down on the west (Zevachim 63a)
  const gx = (g.min[0] + g.max[0]) / 2, gy = (g.min[1] + g.max[1]) / 2;
  const A = {
    Zt, g, gx, gy, rampZ, xE, xW, yFoot, yHead,
    tapuach: mar.params.tapuach,
    // stations round the great pile on the ma'arachah's ash floor and the walkway east of it, in order round the pile:
    // 0–1 south (seen from the ramp), 2–3 east, 4–5 north (behind the fire from the ramp) ⚙
    stations: [
      { at: [gx - 1.6, g.min[1] - 1.35, Zt], h: 5 }, { at: [gx + 1.6, g.min[1] - 1.35, Zt], h: 350 },
      { at: [g.max[0] + 1.4, gy - 1.9, Zt], h: 280 }, { at: [g.max[0] + 1.4, gy + 1.8, Zt], h: 262 },
      { at: [gx + 1.9, g.max[1] + 1.4, Zt], h: 195 }, { at: [gx - 0.8, g.max[1] + 1.4, Zt], h: 178 },
    ],
    // the top of the ramp's two lanes, and the altar-top corner to turn toward the pile
    upTop: [xE, yHead + 0.8, Zt], downTop: [xW, yHead + 0.8, Zt],
    upFoot: [xE, yFoot + 0.6, rampZ(yFoot + 0.6)], downFoot: [xW, yFoot + 0.6, rampZ(yFoot + 0.6)],
    // where the limbs lie, salted, on the lower half of the ramp on its west side (Tamid 4:3) ⚙ spots
    limbStack: [0, 1, 2, 3, 4, 5].map((k) => { const X = xW - 1.8 + (k % 2) * 1.6, Y = yFoot + 6 + Math.floor(k / 2) * 3.2; return [X, Y, rampZ(Y)]; }),
    onPile: null,
  };
  // on the burning pile: limbs and fats laid on its south flank, which faces the ramp (the ramp-top view sees them in
  // front of the flames) ⚙. The great pile as altar/fire.js builds it: layers of billets 2·0.12·0.88 apart from
  // 0.096 above its floor, narrowing 0.18 a layer on each side, odd layers offset half a spacing (0.186): a limb lies
  // on the outermost billet of a layer, against the next layer up. [4] is terumat-hadeshen's leftover limb spot (its
  // leftoverLimbs: gx − 1.6, gy + 2.2 on top of the pile) — the small hours' last limb hands over there.
  // (origin at the limb's middle: lifted by half its thickness so it rests on the billet rather than in it)
  const flank = (j, X) => [X, g.min[1] + 0.15 + 0.18 * j + (j % 2 ? 0.186 : 0), g.min[2] + 0.096 + 0.2112 * j + 0.12 + 0.12];
  A.onPile = [flank(6, gx - 2.05), flank(6, gx - 0.75), flank(6, gx + 0.55), flank(4, gx - 1.3), [gx - 1.6, gy + 2.2, g.max[2] + 0.02],
    flank(4, gx + 0.05), flank(6, gx + 1.6), flank(4, gx + 1.2)];
  // the one kohen's place between his turnings after midnight: on the altar top south of the pile, back from its heat,
  // facing it with his fork (in the ramp-top view) ⚙
  A.waitAt = [gx - 0.4, g.min[1] - 4.6, Zt];
  // the forks are kept with the vessels by the ramp's west foot (terumat-hadeshen's tools; Tamid 2:1) ⚙
  A.forkRest = [xW - 1.4, yFoot - 0.6, zFoot];
  return A;
}

/** Lishkat HaGazit's kodesh half (site.js azarah.chamber.gazit) */
export function gazitPlaces(ctx) {
  const e = ctx.el('azarah.chamber.gazit'), b = e.box, p = e.params;
  const Z = b.min[2];
  const lot = p.stations?.lottery || [(p.kodeshHalf.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, Z];
  const dE = p.doors.find((d) => d.face === 'east') || p.doors[0];
  const dW = p.doors.find((d) => d.face === 'west') || p.doors[1];
  const ey = (dE.y[0] + dE.y[1]) / 2, wy = (dW.y[0] + dW.y[1]) / 2;
  return {
    Z, lot: [lot[0], lot[1], Z], b, split: p.dividingLine?.x ?? p.kodeshHalf.min[0],
    eastIn: [dE.x - 2, ey, Z], eastOut: [dE.x + 3, ey, Z], eastY: ey,
    westIn: [dW.x + 2, wy, Z], westOut: [dW.x - 1.5, wy, Z],
    // niches for the garments along the kodesh half's long walls (Tamid 5:3; courts/chambers.js)
    niche: (k) => { const n = 24, x0 = (p.dividingLine?.x ?? 65.5) + 0.4, dx = (b.max[0] - 1 - 0.4 - x0) / n; const s = k % 2; const j = Math.floor(k / 2) % n; return { at: [x0 + dx * (j + 0.5), s ? b.max[1] - 2.1 : b.min[1] + 2.1, Z], h: s ? 0 : 180 }; },
  };
}
