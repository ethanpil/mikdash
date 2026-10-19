// Guided movement: goTo(target, speed) follows a nav path with smooth turning and gentle look-ahead,
// glides when flying (down to a connected floor first when the target is a floor), teleports (with a fade
// when ctx.ui.fade exists) for 'instant' and for the last stretch to targets the walk cannot reach.
import { Vector3 } from 'three';
import { m2w, a, EYE_HEIGHT, headingToYaw } from '../core/units.js';

/** m/s; 'instant' teleports */
export const SPEEDS = { slow: 0.8, walk: 1.4, fast: 2.4, run: 4.5 };
const DEG = Math.PI / 180;
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
    let y = physics.standFloor(feet.x, feet.z, exact ? a(zHint) : hintY, exact);
    if (y === null) y = exact ? a(zHint) : 0;
    feet.y = y;
    return { feet, air: false, heading: target.heading, pitch: target.pitch, label: target.label || `${X},${Y}` };
  }
  return null;
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

  /** End of a walk: arrived when within ~1 m (0.5 m in height) of the target, else hop the rest. */
  function arrive(j) {
    const f = ctrl.feet, t = j.r.feet;
    if (Math.hypot(f.x - t.x, f.z - t.z) > 1.0 || Math.abs(f.y - t.y) > 0.5) hop(j);
    else { j.phase = 'turn'; j.t = 0; }
  }

  function walkPlan(j) {
    const path = nav.findPath(ctrl.feet, j.r.feet);
    if (!path) { hop(j); return; }
    Object.assign(j, { path: preparePath(path), s: 0, seg: 0, lastS: 0, stuckT: 0, v: 0, t: 0 });
    if (j.path.total < 0.15) arrive(j); else j.phase = 'walk';
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

  function pointAt(P, s, out) {
    const { pts, cum, total } = P;
    if (s <= 0) return out.copy(pts[0]);
    if (s >= total) return out.copy(pts[pts.length - 1]);
    let k = 1;
    while (k < pts.length - 1 && cum[k] < s) k++;
    const seg = cum[k] - cum[k - 1] || 1;
    return out.lerpVectors(pts[k - 1], pts[k], (s - cum[k - 1]) / seg);
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
        const j = { target, r, speed: v, resolve, phase: 'plan', t: 0, v: 0, s: 0, seg: 0, lastS: 0, stuckT: 0, nudges: 0 };
        job = j;
        if (v === 0) {
          j.phase = 'instant';
          instant(r, j).then(() => { if (job === j) finish(true); });
          return;
        }
        if (r.air) { glide(j, r.feet, false); return; } // a point in the air: straight free flight
        const plan = () => {
          if (job !== j) return;
          if (ctrl.mode === 'fly') {
            // flying to a floor: come down onto a floor connected to the target, then walk (never through walls)
            const land = nav.isReady ? nav.landing(ctrl.feet, r.feet, 16) : null;
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

      if (j.phase === 'walk') {
        const P = j.path;
        // progress: project the body onto the next few segments (monotonic)
        let bestS = j.s, bestD = Infinity, bestSeg = j.seg;
        for (let k = j.seg; k < Math.min(j.seg + 4, P.pts.length - 1); k++) {
          const A = P.pts[k], B = P.pts[k + 1];
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
        if (distGoal < 0.18 || (P.total - j.s < 0.05 && distGoal < 0.6)) { arrive(j); return hold(); }

        // steering: carrot slightly ahead on the path
        const look = 0.55 + 0.3 * j.speed;
        pointAt(P, j.s + look, tmp);
        let dx = tmp.x - feet.x, dz = tmp.z - feet.z;
        const dl = Math.hypot(dx, dz) || 1;
        dx /= dl; dz /= dl;
        // view: turn toward a point further ahead; pitch gently toward the ground ahead (stairs!)
        pointAt(P, j.s + 1.8 + 0.6 * j.speed, tmp2);
        const vx = tmp2.x - feet.x, vz = tmp2.z - feet.z;
        let yawErr = 0;
        if (Math.hypot(vx, vz) > 0.3) yawErr = turnToward(Math.atan2(-vx, -vz), dt, 2.4);
        pointAt(P, j.s + 4, tmp2);
        const hd = Math.max(1.5, Math.hypot(tmp2.x - feet.x, tmp2.z - feet.z));
        const pitchT = Math.max(-0.28, Math.min(0.28, Math.atan2(tmp2.y - feet.y, hd) * 0.75)) - 0.03;
        ctrl.pitch += (pitchT - ctrl.pitch) * (1 - Math.exp(-dt * 2.2));
        // speed: turn in place while the way lies well off the view (never walk backwards), ease in,
        // slow for sharp turns, ease out at the goal
        const turning = Math.abs(yawErr) > 1.2;
        const turnK = Math.max(0.35, Math.min(1, 1 - Math.abs(yawErr) / 1.6));
        const acc = Math.max(1.6, j.speed * 0.9), dec = Math.max(1.1, j.speed * 0.45);
        const want = turning ? 0 : Math.min(j.speed * turnK, Math.sqrt(2 * dec * Math.max(0, remaining - 0.1)) + 0.12);
        j.v += Math.max(-2 * acc * dt, Math.min(acc * dt, want - j.v));
        // stuck recovery: hop forward along the path, then give up and teleport
        if (j.s > j.lastS + 0.25) { j.lastS = j.s; j.stuckT = 0; } else if (!turning) j.stuckT += dt;
        if (j.stuckT > 2.2) {
          j.stuckT = 0;
          if (++j.nudges > 3) { hop(j); return hold(); }
          pointAt(P, j.s + 1.2, tmp); ctrl.place(tmp); j.s += 1.2; j.lastS = j.s;
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
