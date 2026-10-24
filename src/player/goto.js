// Guided movement: goTo(target, speed) follows a nav path with smooth turning and gentle look-ahead,
// glides when flying (down to a connected floor first when the target is a floor), teleports (with a fade
// when ctx.ui.fade exists) for 'instant' and for the last stretch to targets the walk cannot reach. A path through
// a climb (nav/climbs.js) is walked in legs with the climb between; the arrival is framed (ARRIVAL).
import { Vector3 } from 'three';
import { m2w, a, EYE_HEIGHT, headingToYaw } from '../core/units.js';
import { BODY } from './controller.js';

/** m/s; 'instant' teleports */
export const SPEEDS = { slow: 0.8, walk: 1.4, fast: 2.4, run: 4.5 };
const DEG = Math.PI / 180;
/**
 * How a goTo arrives (docs/decisions/qa-r1-player.md). Pitch toward the target's `look` point (aimed `aimUp` over it:
 * an event's point is the floor its people stand on) clamped to pitchMin…pitchMax, else `pitch`. The stand keeps
 * `clear` m (plan) from a standing figure's feet and `clearLying` from a lying one's pelvis (the body reaches ~0.9 m
 * each way), and no standing figure's body (radius `sightR`) may come within `cone`° of the sight line (to the look
 * point, else to the floor `ahead` m along the arrival heading) short of its last `sightSkip` m (the action itself);
 * otherwise the nearest clear point on rings `ringStep` apart out to `ringMax` m is taken.
 */
export const ARRIVAL = {
  pitchMin: -25, pitchMax: 10, aimUp: 0.5, pitch: -4,
  clear: 0.8, clearLying: 1.3, sightR: 0.3, cone: 6, sightSkip: 1.5, ahead: 4, ringStep: 0.5, ringMax: 3,
};
const LYING = new Set(['sleep', 'lie', 'prostrate']), LOW = new Set(['sit', 'kneel']);
/** winding stairs: m along the path to the tread kept in the lower part of the frame, and to the view's aim */
const NEWEL_LOOK = 1.2, NEWEL_YAW = 0.8;
const warnedSpeeds = new Set();

const wrap = (r) => { r = (r + Math.PI) % (2 * Math.PI); if (r < 0) r += 2 * Math.PI; return r - Math.PI; };
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** goTo speed → m/s, 0 = instant. Unknown values walk (a typo must never teleport). */
export function speedOf(speed) {
  if (speed === 'instant' || speed === Infinity) return 0;
  if (typeof speed === 'number' && speed > 0 && Number.isFinite(speed)) return speed;
  if (typeof speed === 'string' && Object.hasOwn(SPEEDS, speed)) return SPEEDS[speed];
  if (speed != null && !warnedSpeeds.has(String(speed))) {
    warnedSpeeds.add(String(speed));
    console.warn(`[player] unknown goTo speed ${JSON.stringify(speed)}; walking`);
  }
  return SPEEDS.walk;
}

/** The standing floor at (x, z) — see physics.standFloor (datum preference unless `exact`). World y or null. */
export function pickFloor(ctx, physics, x, z, hintY = null, exact = false) {
  return physics.standFloor(x, z, hintY, exact);
}

/**
 * Resolve a goTo/teleport target to { feet: Vector3 (world), heading?, pitch?, air, label }.
 * Targets: anchor name | { anchor } | { at:[X,Y(,Z)], z?, heading?, pitch? } (site amot; floor found, an
 *          explicit Z picks the floor nearest it on any level) | { pos:[X,Y,Z] } (EYE position in site amot,
 *          like ?pos=; without Z it is an `at`) | world Vector3 (feet) | [X,Y].
 * goTo also reads an object target's optional `look`: the point to watch, site [X, Y, Z?] or a world Vector3 (ARRIVAL).
 */
export function resolveTarget(ctx, physics, target, hintY = null) {
  if (target == null) return null;
  if (Array.isArray(target)) target = { at: target };
  if (typeof target === 'string' || target.anchor) {
    const name = typeof target === 'string' ? target : target.anchor;
    const an = ctx.anchors?.get(name);
    if (!an) { console.warn(`[player] unknown anchor "${name}"`); return null; }
    const feet = an.pos.clone();
    const f = physics.floorAt(feet.x, feet.z, feet.y + 1.0, 0.3, 2.5);
    if (f !== null) feet.y = f;
    return {
      feet, air: false, label: an.label || name,
      heading: target.heading ?? an.heading, pitch: target.pitch ?? an.pitch,
    };
  }
  if (target.isVector3) {
    const feet = target.clone();
    const f = physics.floorAt(feet.x, feet.z, feet.y + 0.4, 0.3, 2.9);
    if (f !== null) feet.y = f;
    return { feet, air: f === null && !!physics.bvh, label: 'point' };
  }
  if (target.pos) {
    const [X, Y, Z] = target.pos;
    if (!Number.isFinite(Z)) return resolveTarget(ctx, physics, { ...target, pos: null, at: [X, Y] }, hintY);
    const feet = m2w(X, Y, Z).setY(a(Z) - EYE_HEIGHT);
    const f = physics.floorAt(feet.x, feet.z, feet.y + 0.35, 0.3, 0.95);
    let air = f === null;
    if (f !== null) feet.y = f;
    else if (physics.bvh && (physics.insideAt(feet.x, feet.y + 0.05, feet.z) || physics.insideAt(feet.x, a(Z), feet.z))) {
      // the body would hover inside masonry: stand on the nearest floor instead
      const s = physics.findStand(feet, 8);
      if (s) { feet.copy(s); air = false; }
    }
    return { feet, air, heading: target.heading, pitch: target.pitch, label: target.label || 'position' };
  }
  if (target.at) {
    const [X, Y, Z] = target.at;
    const zHint = target.z ?? Z;
    const exact = Number.isFinite(zHint);
    const feet = m2w(X, Y, 0);
    let y = exact ? physics.nearestFloor(feet.x, feet.z, a(zHint)) : physics.standFloor(feet.x, feet.z, hintY);
    if (exact && physics.bvh && (y === null || y - a(zHint) > 0.5)) {
      // the only floor here is on top of something (a wood pile, a table, a wall top): the nearest spot on the
      // requested level instead (a floor BELOW the requested Z is kept: the Z is then an estimate of the ground)
      const s = nearOnLevel(physics, feet.x, feet.z, a(zHint), 1.5);
      if (s) { feet.x = s.x; feet.z = s.z; y = s.y; }
    }
    if (y === null) y = exact ? a(zHint) : 0;
    feet.y = y;
    return { feet, air: false, heading: target.heading, pitch: target.pitch, label: target.label || `${X},${Y}` };
  }
  return null;
}

/** Nearest column within r m of (x, z) with a standable floor within 0.35 m of level y: { x, y, z } | null. */
function nearOnLevel(physics, x, z, y, r) {
  for (let d = 0.25; d <= r + 1e-6; d += 0.25) {
    const m = Math.max(8, Math.round((2 * Math.PI * d) / 0.25));
    let best = null, bd = Infinity;
    for (let i = 0; i < m; i++) {
      const an = (i / m) * 2 * Math.PI, px = x + Math.cos(an) * d, pz = z + Math.sin(an) * d;
      for (const f of physics.floorsAt(px, pz)) {
        const dy = Math.abs(f - y);
        if (dy <= 0.35 && dy < bd) { bd = dy; best = { x: px, y: f, z: pz }; }
      }
    }
    if (best) return best;
  }
  return null;
}

// ---- arrival framing (ARRIVAL) ----

/** A target's `look` (site [X, Y, Z?] amot, Z omitted = the walking floor there; or a world Vector3) → world Vector3 | null. */
function lookPoint(physics, target) {
  const l = target?.look;
  if (l?.isVector3) return l.clone();
  if (!Array.isArray(l) || !Number.isFinite(l[0]) || !Number.isFinite(l[1])) return null;
  const p = m2w(l[0], l[1], Number.isFinite(l[2]) ? l[2] : 0);
  if (!Number.isFinite(l[2])) p.y = physics.standFloor(p.x, p.z) ?? 0;
  return p;
}

/** Compass heading (deg, [0, 360)) from feet to p. */
const bearing = (f, p) => { const h = Math.atan2(p.x - f.x, f.z - p.z) / DEG; return h < 0 ? h + 360 : h; };

/** View pitch (deg) from feet toward the look point, clamped. */
function pitchToward(feet, look) {
  const p = Math.atan2(look.y + ARRIVAL.aimUp - feet.y - EYE_HEIGHT, Math.hypot(look.x - feet.x, look.z - feet.z)) / DEG;
  return Math.max(ARRIVAL.pitchMin, Math.min(ARRIVAL.pitchMax, p));
}

const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

/**
 * The drawn people and animals within r m (plan) of (x, z): { x, y, z (world feet), h, rad (sight radius), clear,
 * lying }. Actors from ctx.people.actors, crowd members from ctx.people.system.crowds (world arrays).
 */
function figuresNear(ctx, x, z, r) {
  const out = [];
  const add = (fx, fy, fz, arch, scale, pose) => {
    if (Math.hypot(fx - x, fz - z) > r) return;
    const animal = !!arch?.isAnimal, H = (arch?.H || 1.7) * (scale || 1);
    const lying = LYING.has(pose) || (animal && /^(lie|bound|struggle)/.test(pose || ''));
    const half = animal ? (arch?.rig?.dims?.L || 1) * (scale || 1) / 2 : 0;
    out.push({
      x: fx, y: fy, z: fz, lying,
      h: LOW.has(pose) ? H * 0.75 : H,
      rad: animal ? 0.4 : ARRIVAL.sightR,
      clear: Math.max(lying && !animal ? ARRIVAL.clearLying : ARRIVAL.clear, half + 0.35),
    });
  };
  let actors = [];
  try { actors = ctx.people?.actors || []; } catch { /* no people system */ }
  for (const ac of actors) {
    if (!ac?.visible || ac.disposed || ac.kind === 'prop' || !ac.object3D?.parent || !shown(ac.object3D)) continue;
    ac.object3D.updateWorldMatrix(true, false);
    const e = ac.object3D.matrixWorld.elements;
    add(e[12], e[13], e[14], ac.arch, ac.scale, ac.poseName);
  }
  for (const c of ctx.people?.system?.crowds || []) {
    if (!c?.visible || !c.count) continue;
    for (let i = 0; i < c.count; i++) {
      if (c.fadeM && c.fadeM[i] <= 0.004) continue;
      add(c.x[i], c.y[i], c.z[i], c.arch?.[i], c.sc?.[i], c.poseName);
    }
  }
  return out;
}

/**
 * Does a figure stand within its clearance of the stand at feet, or cut its sight line: to the look point, else
 * (dir: the arrival heading's unit plan vector {x, z}) to the floor ARRIVAL.ahead m along the heading?
 */
function standBlocked(feet, look, figs, dir = null) {
  const ex = feet.x, ey = feet.y + EYE_HEIGHT, ez = feet.z;
  let ax = 0, ay = 0, az = 0, L2 = 0, tMax = 0;
  if (look || dir) {
    if (look) { ax = look.x - ex; ay = look.y + ARRIVAL.aimUp - ey; az = look.z - ez; }
    else { ax = dir.x * ARRIVAL.ahead; ay = ARRIVAL.aimUp - EYE_HEIGHT; az = dir.z * ARRIVAL.ahead; }
    L2 = ax * ax + az * az;
    const L = Math.sqrt(L2);
    tMax = L > ARRIVAL.sightSkip ? (L - ARRIVAL.sightSkip) / L : 0;
  }
  const L = Math.sqrt(L2), cone = Math.tan(ARRIVAL.cone * DEG);
  for (const f of figs) {
    if (Math.abs(f.y - feet.y) < 1.2 && Math.hypot(f.x - ex, f.z - ez) < f.clear) return true;
    if (tMax <= 0 || f.lying) continue;
    // the sight segment's point nearest the figure's axis (plan), and its height there; the figure blocks when its
    // body comes within `cone`° of the line (a near body fills the middle of the frame)
    const t = Math.max(0, Math.min(tMax, ((f.x - ex) * ax + (f.z - ez) * az) / L2));
    const y = ey + ay * t;
    if (y > f.y && y < f.y + f.h && Math.hypot(ex + ax * t - f.x, ez + az * t - f.z) < f.rad + t * L * cone) return true;
  }
  return false;
}

const RC = { o: new Vector3(), d: new Vector3() };
/** Is the straight line from p to q free of colliders (short of q by `short` m)? */
function lineClear(physics, p, q, short = 0) {
  RC.d.subVectors(q, p);
  const L = RC.d.length() - short;
  if (L <= 0.05) return true;
  return !physics.raycast(RC.o.copy(p), RC.d, L);
}

/**
 * The nearest stand on rings round feet (same level ±0.35 m) that the body fits, that no wall separates from feet,
 * that sees the look point when feet does, and that standBlocked passes; on a ring, the one whose distance to the
 * look point is nearest feet's (the framing keeps its scale), else the one farthest from the figures. Vector3 | null.
 */
function clearStand(physics, nav, feet, look, figs, dir = null) {
  const aim = look ? look.clone().setY(look.y + ARRIVAL.aimUp) : null;
  const eye = (p) => new Vector3(p.x, p.y + EYE_HEIGHT, p.z);
  const knee = (p) => new Vector3(p.x, p.y + 0.5, p.z);
  const sees = aim ? lineClear(physics, eye(feet), aim, 0.3) : false;
  const d0 = look ? Math.hypot(look.x - feet.x, look.z - feet.z) : 0;
  const fit = new Vector3();
  for (let d = ARRIVAL.ringStep; d <= ARRIVAL.ringMax + 1e-6; d += ARRIVAL.ringStep) {
    const m = Math.max(8, Math.round((2 * Math.PI * d) / ARRIVAL.ringStep));
    let best = null, bs = Infinity;
    for (let i = 0; i < m; i++) {
      const an = (i / m) * 2 * Math.PI, x = feet.x + Math.cos(an) * d, z = feet.z + Math.sin(an) * d;
      let y = null, bd = 0.35;
      for (const f of physics.floorsAt(x, z)) { const dy = Math.abs(f - feet.y); if (dy <= bd) { bd = dy; y = f; } }
      if (y === null || physics.insideAt(x, y + 0.05, z)) continue;
      const c = new Vector3(x, y, z);
      physics.collideCapsule(fit.copy(c), BODY.radius, BODY.stepUp, BODY.height);
      if (Math.hypot(fit.x - x, fit.z - z) > 0.02) continue; // against a wall
      if (!lineClear(physics, knee(feet), knee(c)) || !lineClear(physics, eye(feet), eye(c))) continue;
      if (sees && !lineClear(physics, eye(c), aim, 0.3)) continue;
      if (standBlocked(c, look, figs, dir)) continue;
      if (nav?.isReady) { const n = nav.nearest(c, 0.5); if (!n || Math.abs(n.y - y) > 0.35) continue; }
      let s;
      if (look) s = Math.abs(Math.hypot(look.x - x, look.z - z) - d0);
      else { let md = 3; for (const f of figs) md = Math.min(md, Math.hypot(f.x - x, f.z - z)); s = -md; }
      if (s < bs) { bs = s; best = c; }
    }
    if (best) return best;
  }
  return null;
}

/**
 * How far along path P from s (≤ maxD) the walker can aim in a straight line: every path vertex passed on the way
 * lies within tol m (plan) of the line from the feet to the aim point. On a newel stair this keeps the aim on the
 * stair instead of across the newel.
 */
function reach(P, s, maxD, tol, feet) {
  const { pts, cum } = P;
  let k0 = 1;
  while (k0 < pts.length - 1 && cum[k0] <= s + 1e-6) k0++;
  const ok = (L) => {
    pointAt(P, s + L, AIM);
    const ax = AIM.x - feet.x, az = AIM.z - feet.z, l2 = ax * ax + az * az;
    for (let k = k0; k < pts.length && cum[k] < s + L - 1e-6; k++) {
      const px = pts[k].x - feet.x, pz = pts[k].z - feet.z;
      let t = l2 > 0 ? (px * ax + pz * az) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      if (Math.hypot(px - ax * t, pz - az * t) > tol) return false;
    }
    return true;
  };
  if (ok(maxD)) return maxD;
  let k1 = k0;
  while (k1 + 1 < pts.length && cum[k1 + 1] < s + maxD) k1++;
  for (let k = k1; k >= k0; k--) {
    const L = cum[k] - s;
    if (L > 0.05 && L < maxD && ok(L)) return L;
  }
  return Math.min(maxD, Math.max(0.05, cum[k0] - s));
}

/** Mean turning of the path (rad per m, plan) over [s, s + len]: limits the walking speed on tight curves. */
function curvature(P, s, len) {
  const { pts, cum } = P;
  let turn = 0;
  for (let k = 1; k < pts.length - 1 && cum[k] < s + len; k++) {
    if (cum[k] <= s) continue;
    const ax = pts[k].x - pts[k - 1].x, az = pts[k].z - pts[k - 1].z, bx = pts[k + 1].x - pts[k].x, bz = pts[k + 1].z - pts[k].z;
    if (ax * ax + az * az < 1e-6 || bx * bx + bz * bz < 1e-6) continue;
    turn += Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz));
  }
  return turn / len;
}

const AIM = new Vector3();

function pointAt(P, s, out) {
  const { pts, cum, total } = P;
  if (s <= 0) return out.copy(pts[0]);
  if (s >= total) return out.copy(pts[pts.length - 1]);
  let k = 1;
  while (k < pts.length - 1 && cum[k] < s) k++;
  const seg = cum[k] - cum[k - 1] || 1;
  return out.lerpVectors(pts[k - 1], pts[k], (s - cum[k - 1]) / seg);
}

export function createAuto(ctx, ctrl, physics, nav) {
  let job = null;
  let veilOwner = null; // the job whose teleport currently holds the fade veil
  const tmp = new Vector3(), tmp2 = new Vector3();
  const cmd = { dirX: 0, dirZ: 0, speed: 0, fly: null }; // reused every frame

  const hold = () => {
    cmd.dirX = 0; cmd.dirZ = 0; cmd.speed = 0;
    cmd.fly = ctrl.mode === 'fly' ? ctrl.feet : null; // flying: hover in place
    return cmd;
  };
  const steer = (dx, dz, v) => { cmd.dirX = dx; cmd.dirZ = dz; cmd.speed = v; cmd.fly = null; return cmd; };

  function finish(ok) {
    const j = job;
    if (!j) return;
    job = null;
    if (ok) {
      ctrl.setMode(j.r.air ? 'fly' : 'walk');
      ctx.bus.emit('player:arrived', { target: j.target });
    }
    j.resolve(ok);
  }

  /** ctx.ui.fade(opacity, ms), bounded so a fade that never settles cannot hang the move */
  const fadeTo = (o, ms) => Promise.race([
    Promise.resolve().then(() => ctx.ui.fade(o, ms)).catch(() => {}),
    sleep(ms + 600),
  ]);

  /** Teleport for job j (fading out and in when the UI offers it); skipped if j was cancelled or replaced meanwhile. */
  async function instant(r, j) {
    const useFade = typeof ctx.ui?.fade === 'function' && !ctx.params?.shot;
    veilOwner = j;
    if (useFade) await fadeTo(1, 220);
    if (job === j) {
      ctrl.setMode(r.air ? 'fly' : 'walk');
      ctrl.place(r.feet, { air: r.air });
      if (r.heading != null) ctrl.yaw = headingToYaw(r.heading);
      if (r.pitch != null) ctrl.pitch = r.pitch * DEG;
      ctrl.applyCamera(0);
    }
    // lift the veil unless a newer teleport has taken it over
    if (useFade && veilOwner === j) { veilOwner = null; await fadeTo(0, 320); }
  }

  /** No walkable way (or not all the way): fade-teleport to the target, then turn to the requested view. */
  function hop(j) {
    j.phase = 'wait';
    instant(j.r, j).then(() => { if (job === j) { j.phase = 'turn'; j.t = 0; } });
  }

  /**
   * Arrival framing for job j (ARRIVAL) at stand `feet`: when a figure stands too close or in the sight line, move
   * j.r.feet to the nearest clear ring point (turning a given heading by the change in bearing to the look point);
   * then a pitch toward the look point (or ARRIVAL.pitch) and, without a heading, the bearing to it — unless the
   * target set them. Returns true when the stand moved.
   */
  function frame(j, feet) {
    const r = j.r;
    if (r.air) return false;
    const look = j.look;
    const dir = !look && r.heading != null ? { x: Math.sin(r.heading * DEG), z: -Math.cos(r.heading * DEG) } : null;
    const reach = (look ? Math.hypot(look.x - feet.x, look.z - feet.z) : ARRIVAL.ahead) + ARRIVAL.ringMax + 2;
    const figs = figuresNear(ctx, feet.x, feet.z, reach);
    let moved = false;
    if (standBlocked(feet, look, figs, dir)) {
      const c = clearStand(physics, nav, feet, look, figs, dir);
      if (c) {
        if (look && !j.autoHeading) r.heading = (((r.heading + bearing(c, look) - bearing(feet, look)) % 360) + 360) % 360;
        r.feet = c;
        moved = true;
      }
    }
    if (j.autoPitch) r.pitch = look ? pitchToward(r.feet, look) : ARRIVAL.pitch;
    if (j.autoHeading && look) r.heading = bearing(r.feet, look);
    return moved;
  }

  /**
   * End of a walk: arrived when within ~1 m (0.5 m in height) of the target, else hop the rest. The figures have
   * moved during the walk: frame once more from where the body stands, and walk on if a figure now blocks it.
   */
  function arrive(j) {
    const f = ctrl.feet, t = j.r.feet;
    if (Math.hypot(f.x - t.x, f.z - t.z) > 1.0 || Math.abs(f.y - t.y) > 0.5) { hop(j); return; }
    if (!j.reframed) {
      j.reframed = true;
      const keep = j.r.feet;
      if (frame(j, f.clone())) { walkPlan(j); return; }
      j.r.feet = keep;
    }
    if (j.autoPitch && j.look) j.r.pitch = pitchToward(f, j.look);
    if (j.autoHeading && j.look) j.r.heading = bearing(f, j.look);
    j.phase = 'turn'; j.t = 0;
  }

  function walkPlan(j) {
    const path = nav.findPath(ctrl.feet, j.r.feet);
    if (!path) { hop(j); return; }
    // a path through a climb (nav/climbs.js) is walked in legs: to the climb's foot, the climb, on from its top
    const c = path.climb;
    j.full = path;
    j.climb = c ? { via: path.slice(c.i0, c.i1 + 1), rest: path.slice(c.i1), heading: c.heading } : null;
    walkLeg(j, c ? path.slice(0, c.i0 + 1) : path);
  }

  function walkLeg(j, pts) {
    Object.assign(j, { path: preparePath(pts), s: 0, seg: 0, lastS: 0, stuckT: 0, v: 0, t: 0 });
    if (j.path.total < 0.15) legEnd(j); else j.phase = 'walk';
  }

  /** A walking leg is done: climb when it led to a climb's foot (else hop the rest), or arrive. */
  function legEnd(j) {
    if (!j.climb) { arrive(j); return; }
    const f = ctrl.feet, foot = j.climb.via[0];
    if (Math.hypot(f.x - foot.x, f.z - foot.z) > 1.0 || Math.abs(f.y - foot.y) > 0.5) { j.climb = null; hop(j); return; }
    const via = j.climb.via, cum = [0];
    for (let k = 1; k < via.length; k++) cum.push(cum[k - 1] + via[k].distanceTo(via[k - 1]));
    Object.assign(j.climb, { cum, total: cum[cum.length - 1], s: 0, v: 0 });
    j.phase = 'climb'; j.t = 0;
    ctrl.setMode('fly');
  }

  /** Fly to `to` (feet). thenWalk: a landing spot — move over it first, then descend, then walk the path. */
  function glide(j, to, thenWalk) {
    ctrl.setMode('fly');
    const from = ctrl.feet.clone();
    const plan = Math.hypot(to.x - from.x, to.z - from.z), dist = plan + Math.abs(to.y - from.y);
    Object.assign(j, {
      phase: 'glide', t: 0, from, to: to.clone(), thenWalk,
      hFrac: plan / (dist + 1e-6), // landing: share of the time spent moving over the spot before descending
      dur: Math.min(12, Math.max(0.8, dist / Math.max(5, j.speed * 3))),
    });
  }

  function preparePath(pts) {
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z));
    return { pts, cum, total: cum[cum.length - 1] };
  }

  const auto = {
    get active() { return !!job; },
    get job() { return job; },

    goTo(target, speed = 'walk') {
      auto.cancel();
      const r = resolveTarget(ctx, physics, target, ctrl.feet.y);
      if (!r) return Promise.resolve(false);
      const v = speedOf(speed);
      return new Promise((resolve) => {
        const j = {
          target, r, speed: v, resolve, phase: 'plan', t: 0, v: 0, s: 0, seg: 0, lastS: 0, stuckT: 0, nudges: 0,
          look: lookPoint(physics, target), autoPitch: r.pitch == null, autoHeading: r.heading == null, reframed: false,
        };
        job = j;
        frame(j, r.feet);
        if (v === 0) {
          j.phase = 'instant';
          instant(r, j).then(() => { if (job === j) finish(true); });
          return;
        }
        if (r.air) { glide(j, r.feet, false); return; } // a point in the air: straight free flight
        const plan = () => {
          if (job !== j) return;
          if (ctrl.mode === 'fly') {
            // flying to a floor: come down onto a floor connected to the target, then walk (never through walls);
            // the spot that makes the quickest trip, gliding at max(5, 3·speed) (see glide) and walking at speed
            const land = nav.isReady ? nav.landing(ctrl.feet, r.feet, 16, Math.max(5, v * 3) / v) : null;
            if (land) glide(j, land, true); else hop(j);
            return;
          }
          walkPlan(j);
        };
        if (nav.isReady) plan();
        else {
          j.phase = 'wait';
          Promise.race([nav.ready, sleep(20000)]).then(plan);
        }
      });
    },

    cancel() {
      if (!job) return;
      finish(false);
    },

    teleport(target) {
      auto.cancel();
      const r = resolveTarget(ctx, physics, target, ctrl.feet.y);
      if (!r) return false;
      ctrl.setMode(r.air ? 'fly' : 'walk');
      ctrl.place(r.feet, { air: r.air });
      if (r.heading != null) ctrl.yaw = headingToYaw(r.heading);
      if (r.pitch != null) ctrl.pitch = r.pitch * DEG;
      ctrl.applyCamera(0);
      return true;
    },

    /** Per frame while active: a command for the controller (one reused object: {dirX, dirZ, speed} or {fly: feet}). */
    update(dt) {
      const j = job;
      if (!j) return null;
      j.t += dt;
      const feet = ctrl.feet;

      if (j.phase === 'glide') {
        const u = Math.min(1, j.t / j.dur);
        const { from, to } = j;
        // landing: over the spot first, then straight down its clear column; free flight: straight line
        const hf = j.hFrac;
        const eh = !j.thenWalk ? smooth(u) : hf < 1e-3 ? 1 : smooth(u / hf);
        const ev = !j.thenWalk ? eh : hf > 1 - 1e-3 ? smooth(u) : smooth((u - hf) / (1 - hf));
        tmp.set(from.x + (to.x - from.x) * eh, from.y + (to.y - from.y) * ev, from.z + (to.z - from.z) * eh);
        const dx = to.x - from.x, dz = to.z - from.z;
        if (Math.hypot(dx, dz) > 2 && u < 0.85) turnToward(Math.atan2(-dx, -dz), dt, 2.2);
        if (u >= 1) {
          if (j.thenWalk) { ctrl.setMode('walk'); ctrl.place(to); walkPlan(j); return hold(); }
          j.phase = 'turn'; j.t = 0;
        }
        cmd.fly = tmp;
        return cmd;
      }

      if (j.phase === 'climb') {
        // along the climb's via (up the post, over the parapet onto the top level) at the walking pace, easing in and out
        const C = j.climb;
        const acc = Math.max(1.2, j.speed);
        const want = Math.min(j.speed, Math.sqrt(2 * acc * Math.max(0, C.total - C.s)) + 0.1);
        C.v += Math.max(-2 * acc * dt, Math.min(acc * dt, want - C.v));
        C.s = Math.min(C.total, C.s + C.v * dt);
        let k = 1;
        while (k < C.via.length - 1 && C.cum[k] < C.s) k++;
        const A = C.via[k - 1], B = C.via[k], seg = C.cum[k] - C.cum[k - 1] || 1;
        tmp.lerpVectors(A, B, Math.min(1, (C.s - C.cum[k - 1]) / seg));
        // the view: out from the wall on the post (the courts open out below; facing the post showed only the post),
        // the way ahead across the parapet
        const vertical = Math.abs(B.y - A.y) > 0.5 * seg;
        turnToward(vertical ? headingToYaw(C.heading + 180) : Math.atan2(-(B.x - A.x), -(B.z - A.z)), dt, 2.0);
        const pT = (vertical ? -12 : -6) * DEG;
        ctrl.pitch += (pT - ctrl.pitch) * (1 - Math.exp(-dt * 2.5));
        if (C.s >= C.total - 1e-4) {
          j.climb = null;
          ctrl.setMode('walk');
          ctrl.place(C.via[C.via.length - 1]);
          walkLeg(j, C.rest);
          return hold();
        }
        cmd.fly = tmp;
        return cmd;
      }

      if (j.phase === 'walk') {
        const P = j.path;
        // progress: project the body onto the next few segments (monotonic); a segment wholly above or below the
        // body (the path passing over itself on a newel stair, a stair under a landing) is not where we are. Only the
        // segment's height RANGE counts: a string-pulled segment runs straight from a stair head to a far node, so
        // its interpolated height can be metres off the stair the body is on.
        let bestS = j.s, bestD = Infinity, bestSeg = j.seg;
        for (let k = j.seg; k < Math.min(j.seg + 6, P.pts.length - 1); k++) {
          const A = P.pts[k], B = P.pts[k + 1];
          if (feet.y < Math.min(A.y, B.y) - 1.2 || feet.y > Math.max(A.y, B.y) + 1.2) continue;
          const sx = B.x - A.x, sz = B.z - A.z, l2 = sx * sx + sz * sz;
          let t = l2 > 0 ? ((feet.x - A.x) * sx + (feet.z - A.z) * sz) / l2 : 0;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(A.x + sx * t - feet.x, A.z + sz * t - feet.z);
          if (d < bestD - 1e-6) { bestD = d; bestS = P.cum[k] + t * Math.sqrt(l2); bestSeg = k; }
        }
        if (bestS > j.s) { j.s = bestS; j.seg = bestSeg; }
        const end = P.pts[P.pts.length - 1];
        const distGoal = Math.hypot(end.x - feet.x, end.z - feet.z);
        const remaining = Math.max(P.total - j.s, distGoal);
        // arrived only on the goal's own level (a stacked path can pass right over or under its end)
        if (Math.abs(end.y - feet.y) < 0.6 && (distGoal < 0.18 || (P.total - j.s < 0.05 && distGoal < 0.6))) { legEnd(j); return hold(); }

        // steering: carrot slightly ahead on the path, never across the inside of a tight curve
        const look = reach(P, j.s, 0.55 + 0.3 * j.speed, 0.07, feet);
        pointAt(P, j.s + look, tmp);
        let dx = tmp.x - feet.x, dz = tmp.z - feet.z;
        const dl = Math.hypot(dx, dz) || 1;
        dx /= dl; dz /= dl;
        // view. A winding stair (a tight curve whose floor 1.2 m on is another level): the shaft wall is ~0.75 m
        // ahead along the walk and the treads lie inside the curve, well below the eye (~37° climbing, ~65°
        // descending, 1.2 m on), so a view along the walk and the slope shows only wall and soffit. Look across
        // the curve at the treads 0.8 m on, down so the tread 1.2 m on stays in the lower part of the frame.
        // Elsewhere: turn toward a point further ahead and pitch gently toward the ground 4 m on (stairs!).
        const kappa = curvature(P, j.s, 1.5);
        let pitchT = null;
        if (kappa > 0.8) {
          pointAt(P, j.s + NEWEL_LOOK, tmp2);
          const ny = physics.nearestFloor(tmp2.x, tmp2.z, tmp2.y);
          if (ny !== null && Math.abs(ny - feet.y) > 0.3) {
            const d = Math.max(0.5, Math.hypot(tmp2.x - feet.x, tmp2.z - feet.z));
            const half = ((ctx.camera?.fov || 62) * DEG) / 2;
            pitchT = Math.max(-0.8, Math.min(-0.05, Math.atan2(ny - feet.y - EYE_HEIGHT, d) + 0.35 * half));
            pointAt(P, j.s + NEWEL_YAW, tmp2);
          }
        }
        if (pitchT === null) pointAt(P, j.s + Math.max(Math.min(look, 0.6), reach(P, j.s, 1.8 + 0.6 * j.speed, 0.12, feet)), tmp2);
        const vx = tmp2.x - feet.x, vz = tmp2.z - feet.z;
        let yawErr = 0;
        if (Math.hypot(vx, vz) > 0.3) yawErr = turnToward(Math.atan2(-vx, -vz), dt, 2.4);
        if (pitchT === null) {
          pointAt(P, j.s + 4, tmp2);
          const gy = physics.nearestFloor(tmp2.x, tmp2.z, tmp2.y); // the ground there, not the chord's height
          if (gy !== null) tmp2.y = gy;
          const hd = Math.max(1.5, Math.hypot(tmp2.x - feet.x, tmp2.z - feet.z));
          pitchT = Math.max(-0.28, Math.min(0.28, Math.atan2(tmp2.y - feet.y, hd) * 0.75)) - 0.03;
        }
        ctrl.pitch += (pitchT - ctrl.pitch) * (1 - Math.exp(-dt * 2.2));
        // speed: turn in place while the way lies well off the view (never walk backwards), ease in,
        // slow for sharp turns, ease out at the goal
        const turning = Math.abs(yawErr) > 1.2;
        const turnK = Math.max(0.35, Math.min(1, 1 - Math.abs(yawErr) / 1.6));
        const acc = Math.max(1.6, j.speed * 0.9), dec = Math.max(1.1, j.speed * 0.45);
        // tight curves (newel stairs, corners): keep the turn rate a person (and the view) can follow, ≤ 2 rad/s
        const vCurve = kappa > 0.2 ? Math.max(0.5, 2.0 / kappa) : Infinity;
        const want = turning ? 0 : Math.min(j.speed * turnK, vCurve, Math.sqrt(2 * dec * Math.max(0, remaining - 0.1)) + 0.12);
        j.v += Math.max(-2 * acc * dt, Math.min(acc * dt, want - j.v));
        // stuck recovery: hop forward along the path, then give up and teleport
        if (j.s > j.lastS + 0.25) { j.lastS = j.s; j.stuckT = 0; } else if (!turning) j.stuckT += dt;
        if (j.stuckT > 2.2) {
          j.stuckT = 0;
          if (++j.nudges > 3) { hop(j); return hold(); }
          // on the floor nearest the body's own height (the path's interpolated height can be in the air)
          pointAt(P, j.s + 1.2, tmp);
          const fy = physics.nearestFloor(tmp.x, tmp.z, feet.y);
          if (fy !== null) tmp.y = fy;
          ctrl.place(tmp); j.s += 1.2; j.lastS = j.s;
        }
        return steer(dx, dz, j.v);
      }

      if (j.phase === 'turn') {
        let done = true;
        if (j.r.heading != null) {
          const err = turnToward(headingToYaw(j.r.heading), dt, 2.0);
          if (Math.abs(err) > 0.012) done = false;
        }
        const pT = j.r.pitch != null ? j.r.pitch * DEG : 0;
        ctrl.pitch += (pT - ctrl.pitch) * (1 - Math.exp(-dt * 3.5));
        if (Math.abs(pT - ctrl.pitch) > 0.012) done = false;
        if (done || j.t > 2.5) finish(true);
        return hold();
      }
      return hold(); // plan / wait / instant
    },
  };

  /** Smoothly turn the view toward yaw target; returns the remaining error (rad). */
  function turnToward(target, dt, maxRate) {
    const err = wrap(target - ctrl.yaw);
    const step = err * (1 - Math.exp(-dt * 3.4));
    const lim = maxRate * dt;
    ctrl.yaw += Math.max(-lim, Math.min(lim, step));
    return wrap(target - ctrl.yaw);
  }

  return auto;
}
