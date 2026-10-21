// First-person character: capsule walking with gravity, step-up and wall sliding; free flight (noclip);
// camera placement with stair smoothing and a subtle head-bob.
import { Vector3 } from 'three';
import { EYE_HEIGHT } from '../core/units.js';

export const BODY = {
  radius: 0.3, height: 1.75, stepUp: 0.35, snapDown: 0.45, gravity: 9.81, terminal: 30, eye: EYE_HEIGHT,
};
export const MOVE = { walk: 1.4, run: 4.5, fly: 6, flyFast: 22 };

export function createController(ctx, physics) {
  const cam = ctx.camera;
  const feet = new Vector3();
  const vel = new Vector3();
  const eye = new Vector3();
  const prev = new Vector3();
  const moved = new Vector3();
  const rest = new Vector3();
  const s = {
    yaw: 0, pitch: 0, mode: 'walk', grounded: false, blocked: false,
    eyeY: 0, bobPhase: 0, bobAmp: 0, speedH: 0, sumY: 0, sumX: 0, slope: 0, voidY: null,
    checkStand: false, // validate the position on the next walking step (set when fly mode ends)
    restVer: -1, // physics.version while standing still at `rest` (collision queries skipped)
  };

  // head-bob: setting 'headBob' (default on), off under prefers-reduced-motion
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  let bobOn = null;
  const readBob = () => {
    let v;
    try { v = ctx.settings?.get?.('headBob'); } catch { v = undefined; }
    bobOn = v === undefined || v === null ? !reduced : !!v && v !== 'false';
  };
  ctx.bus?.on?.('settings:change', (e) => { if (!e || e.key === 'headBob') bobOn = null; });

  function look(dYaw, dPitch) {
    s.yaw += dYaw;
    s.pitch = Math.max(-1.48, Math.min(1.48, s.pitch + dPitch));
  }

  /** Place the body (teleport): feet position, optional heading/pitch in radians already converted by caller. */
  function place(p, { air = false } = {}) {
    feet.copy(p);
    vel.set(0, 0, 0);
    s.grounded = !air;
    s.blocked = false;
    s.voidY = null;
    s.restVer = -1;
    s.checkStand = false;
    if (!air) {
      ensureStand();
      const g = physics.probeGround(feet, BODY.stepUp + 0.05, 0.6);
      if (g !== null) feet.y = g;
    }
    if (air && s.mode === 'walk') s.mode = 'fly';
    s.eyeY = feet.y + BODY.eye;
    s.bobAmp = 0;
    applyCamera(0);
  }

  /**
   * A walker needs free space with something to stand on below. Inside a solid, or below every floor of
   * its column (leaving fly mode underground or inside a wall, a target inside masonry), it moves to the
   * nearest standable spot; only a column with no geometry at all keeps the "sane ground" void hold.
   * Returns true when the body was moved.
   */
  function ensureStand() {
    if (!physics.bvh) return false;
    const inside = physics.insideAt(feet.x, feet.y + 0.05, feet.z);
    if (!inside && physics.floorAt(feet.x, feet.z, feet.y + 0.4) !== null) return false;
    const top = physics.floorAt(feet.x, feet.z, 1e4);
    if (!inside && top === null) return false; // outside every collider
    const p = physics.findStand(feet, 8);
    if (p) feet.copy(p);
    else feet.y = physics.nearestFloor(feet.x, feet.z, feet.y) ?? top ?? feet.y;
    vel.set(0, 0, 0);
    s.grounded = true;
    s.voidY = null;
    s.restVer = -1;
    return true;
  }

  function setMode(m) {
    if (m !== 'walk' && m !== 'fly') return;
    if (m === s.mode) return;
    s.mode = m;
    s.restVer = -1;
    if (m === 'walk') { s.grounded = false; vel.y = Math.min(vel.y, 0); s.checkStand = true; }
  }

  /** Walking physics. dirX/dirZ: world horizontal direction (length 0..1); speed m/s. */
  function walk(dt, dirX, dirZ, speed) {
    if (s.checkStand) { s.checkStand = false; ensureStand(); }
    // standing still on unchanged ground: nothing can move the body, skip every query (the stairs estimate
    // is kept as it was)
    if (s.restVer === physics.version && ((dirX === 0 && dirZ === 0) || speed === 0)
      && feet.x === rest.x && feet.y === rest.y && feet.z === rest.z) {
      s.speedH = 0;
      return;
    }
    const slowOnStairs = 1 / (1 + 0.8 * s.slope);
    const tx = dirX * speed * slowOnStairs, tz = dirZ * speed * slowOnStairs;
    // accelerate the horizontal velocity toward the wish (vector move-toward)
    const dx = tx - vel.x, dz = tz - vel.z;
    const dl = Math.hypot(dx, dz);
    const accel = s.grounded ? (Math.hypot(tx, tz) > Math.hypot(vel.x, vel.z) ? 9 : 12) : 1.5;
    const k = dl > 0 ? Math.min(1, (accel * dt) / dl) : 0;
    vel.x += dx * k; vel.z += dz * k;

    const horiz = Math.hypot(vel.x, vel.z) * dt;
    const n = Math.min(12, Math.max(1, Math.ceil(Math.max(horiz / 0.12, Math.abs(vel.y) * dt / 0.3))));
    const h = dt / n;
    const startY = feet.y, startX = feet.x, startZ = feet.z;
    for (let it = 0; it < n; it++) {
      prev.copy(feet);
      feet.x += vel.x * h; feet.z += vel.z * h;
      // ceiling / too-high-ledge contacts cannot be slid along: refuse the move — unless we were already
      // stuck where we stood (e.g. teleported under a low ceiling), then let the user walk out
      if (physics.collideCapsule(feet, BODY.radius, BODY.stepUp, BODY.height)) {
        if (!s.blocked) {
          moved.copy(feet);
          feet.x = prev.x; feet.z = prev.z;
          if (physics.collideCapsule(feet, BODY.radius, BODY.stepUp, BODY.height)) {
            s.blocked = true; feet.x = moved.x; feet.z = moved.z;
          }
        }
      } else s.blocked = false;
      // vertical: ground snap / gravity (the probe ring's first ray points along the motion)
      const fall = s.grounded ? 0 : Math.max(0, -(vel.y - BODY.gravity * h) * h);
      const dir = vel.x !== 0 || vel.z !== 0 ? Math.atan2(vel.z, vel.x) : 0;
      const g = physics.probeGround(feet, BODY.stepUp + 0.05, (s.grounded ? BODY.snapDown : 0.02) + fall, BODY.radius, dir);
      if (s.grounded) {
        if (g !== null) { feet.y = g; vel.y = 0; s.voidY = null; }
        else if (!physics.bvh || physics.floorAt(feet.x, feet.z, feet.y + 0.4, 0.3) === null) {
          // nothing below: under the floors of this column → climb out; outside every collider → keep a
          // sane ground at the current height
          if (ensureStand()) continue;
          if (s.voidY === null) s.voidY = feet.y;
          feet.y = s.voidY; vel.y = 0;
        } else { s.grounded = false; s.voidY = null; vel.y = 0; }
      } else {
        vel.y = Math.max(vel.y - BODY.gravity * h, -BODY.terminal);
        const ny = feet.y + vel.y * h;
        if (g !== null && ny <= g + 1e-3) { feet.y = g; vel.y = 0; s.grounded = true; s.voidY = null; }
        else if (g === null && (!physics.bvh || physics.floorAt(feet.x, feet.z, feet.y + 0.4, 0.3) === null)) {
          if (ensureStand()) continue;
          s.grounded = true; s.voidY = feet.y; vel.y = 0; // falling into nothing: hold this height
        } else feet.y = ny;
      }
      // remove velocity lost against walls so we do not keep pushing into them
      if (h > 0) {
        const mx = (feet.x - prev.x) / h, mz = (feet.z - prev.z) / h;
        if (Math.hypot(mx, mz) < Math.hypot(vel.x, vel.z) - 1e-3) { vel.x = mx; vel.z = mz; }
      }
    }
    // stairs/slope estimate (exponential window ~0.4 s) — slows walking on stairs like a real climber
    const mv = Math.hypot(feet.x - startX, feet.z - startZ);
    const decay = Math.exp(-dt / 0.4);
    s.sumY = s.sumY * decay + (s.grounded ? Math.abs(feet.y - startY) : 0);
    s.sumX = s.sumX * decay + mv;
    s.slope = Math.min(1.5, s.sumY / Math.max(s.sumX, 0.08));
    s.speedH = mv / Math.max(dt, 1e-4);
    if (s.grounded && tx === 0 && tz === 0 && vel.x === 0 && vel.y === 0 && vel.z === 0) {
      s.restVer = physics.version; rest.copy(feet);
    } else s.restVer = -1;
  }

  function fly(dt, fx, fy, fz, speed) {
    const tx = fx * speed, ty = fy * speed, tz = fz * speed;
    const k = Math.min(1, dt * 6);
    vel.x += (tx - vel.x) * k; vel.y += (ty - vel.y) * k; vel.z += (tz - vel.z) * k;
    feet.addScaledVector(vel, dt);
    s.grounded = false;
    s.speedH = 0;
  }

  /**
   * Per-frame update.
   *  manual: input state { fwd, strafe, up, run } (camera-relative)   — or —
   *  cmd: { dirX, dirZ, speed, fly } world-space command from the auto-walker (fly: a feet position to
   *       glide to; a walking command while flying hovers)
   */
  function update(dt, cmd, manual) {
    if (dt <= 0) return;
    const sy = Math.sin(s.yaw), cy = Math.cos(s.yaw);
    if (s.mode === 'fly' && !cmd) {
      const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
      // forward follows the view (incl. pitch); strafe horizontal; up/down world vertical
      let fx = -sy * cp * manual.fwd + cy * manual.strafe;
      let fy = sp * manual.fwd + manual.up;
      let fz = -cy * cp * manual.fwd - sy * manual.strafe;
      const l = Math.hypot(fx, fy, fz);
      if (l > 1) { fx /= l; fy /= l; fz /= l; }
      fly(dt, fx, fy, fz, manual.run ? MOVE.flyFast : MOVE.fly);
    } else if (cmd) {
      if (cmd.fly) { feet.copy(cmd.fly); vel.set(0, 0, 0); s.grounded = false; }
      else if (s.mode === 'fly') { vel.set(0, 0, 0); s.speedH = 0; }
      else walk(dt, cmd.dirX || 0, cmd.dirZ || 0, cmd.speed || 0);
    } else {
      let dx = -sy * manual.fwd + cy * manual.strafe;
      let dz = -cy * manual.fwd - sy * manual.strafe;
      const l = Math.hypot(dx, dz);
      if (l > 1) { dx /= l; dz /= l; }
      walk(dt, dx, dz, manual.run ? MOVE.run : MOVE.walk);
    }
    applyCamera(dt);
  }

  function applyCamera(dt) {
    const target = feet.y + BODY.eye;
    if (s.mode === 'fly' || dt === 0 || (!s.grounded && vel.y < -2.5)) s.eyeY = target;
    else {
      // stairs: ease the eye toward the body (critically damped feel), never lag more than 0.6 m
      if (s.eyeY > target + 0.6) s.eyeY = target + 0.6; else if (s.eyeY < target - 0.6) s.eyeY = target - 0.6;
      const tau = s.eyeY < target ? 0.12 : 0.09;
      s.eyeY += (target - s.eyeY) * (1 - Math.exp(-dt / tau));
    }
    // head-bob (vertical: one dip per step; lateral: one sway per stride)
    if (bobOn === null) readBob();
    let bobY = 0, bobX = 0, bobZ = 0;
    if (dt > 0) {
      const walking = bobOn && s.mode === 'walk' && s.grounded && s.speedH > 0.15;
      const runK = Math.min(1, Math.max(0, (s.speedH - 1.6) / 2.6));
      if (walking) s.bobPhase += (s.speedH * dt) / (0.74 + 0.6 * runK);
      const targetAmp = walking ? Math.min(1, s.speedH / 1.3) : 0;
      s.bobAmp += (targetAmp - s.bobAmp) * (1 - Math.exp(-dt * 6));
      if (s.bobAmp > 1e-3) {
        const av = (0.013 + 0.017 * runK) * s.bobAmp, al = (0.007 + 0.006 * runK) * s.bobAmp;
        bobY = -av * (0.5 - 0.5 * Math.cos(2 * Math.PI * s.bobPhase));
        const lat = al * Math.sin(Math.PI * s.bobPhase);
        bobX = Math.cos(s.yaw) * lat; bobZ = -Math.sin(s.yaw) * lat;
      }
    }
    cam.position.set(feet.x + bobX, s.eyeY + bobY, feet.z + bobZ);
    cam.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    cam.updateMatrixWorld();
    eye.copy(cam.position);
  }

  return {
    feet, vel, eye, state: s,
    get yaw() { return s.yaw; }, set yaw(v) { s.yaw = v; },
    get pitch() { return s.pitch; }, set pitch(v) { s.pitch = Math.max(-1.48, Math.min(1.48, v)); },
    get mode() { return s.mode; },
    look, place, setMode, update, applyCamera,
  };
}
