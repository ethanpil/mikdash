// Player system (ARCHITECTURE.md §12): first-person observer with capsule collision against a BVH of
// ctx.colliders, a multi-level nav grid + A*, and guided goTo().
//
//   ctx.physics = { floorAt(x, z) -> walking floor y|null (not roof tops), floorAt(x, z, fromY, minNy?, far?)
//                   -> highest surface below fromY, floorsAt(x, z) -> y[], standFloor(x, z, hintY?, exact?),
//                   insideAt(x, y, z), findStand(p, r), raycast(origin, dir, far) -> {point, distance, normal,
//                   faceIndex}|null, bvh, rebuild() -> Promise, stats }
//   ctx.nav     = { findPath(fromWorld, toWorld) -> Vector3[]|null, ready: Promise, nearest(p), landing(p, goal),
//                   floorsAt(x,z), rebuild(), stats, lastQueryMs }
//   ctx.player  = { position (feet), eye, heading, pitch (deg), mode 'walk'|'fly'|'auto', goTo(target, speed)
//                   -> Promise<boolean>, cancel(), teleport(target), setMode, setLook, setInputEnabled, ... }
// URL: ?pos=X,Y,Z (eye, site amot; X,Y alone = at) · ?at=X,Y[,Z] (Z picks the floor on any level) ·
//      ?look=heading,pitch · ?fly=1 · default anchor 'start'.
import { createPhysics } from './physics.js';
import { createNav } from './nav/index.js';
import { createController, BODY } from './controller.js';
import { createInput } from './input.js';
import { createAuto, resolveTarget, pickFloor, SPEEDS } from './goto.js';
import { headingToYaw, yawToHeading } from '../core/units.js';
import { PRIORITY } from '../core/engine.js';

const DEG = Math.PI / 180;

const HOLD = { dirX: 0, dirZ: 0, speed: 0, fly: null };
/** collider triangles above this suggest decorative geometry was left collidable */
const COLLIDER_TRIS_WARN = 750000;

export async function init(ctx) {
  const physics = createPhysics(ctx);
  ctx.physics = physics;
  physics.rebuild();
  const st = physics.stats;
  (ctx.buildTimes ||= {})['player.bvh'] = st.buildMs;
  console.info(`[player] collision: ${st.triangles} triangles, BVH ${st.buildMs} ms`);
  if (st.triangles > COLLIDER_TRIS_WARN) {
    console.warn(`[player] ${st.triangles} collider triangles: register decorative/overhead geometry with collide:false`);
  }
  const nav = createNav(ctx, physics);
  ctx.nav = nav;

  const ctrl = createController(ctx, physics);
  const auto = createAuto(ctx, ctrl, physics, nav);

  // ---- spawn: ?pos / ?at / anchor 'start' / fallback ----
  const p = ctx.params || {};
  let r = null;
  if (p.pos) r = resolveTarget(ctx, physics, { pos: p.pos });
  else if (p.at) r = resolveTarget(ctx, physics, { at: p.at });
  else if (ctx.anchors?.has('start')) r = resolveTarget(ctx, physics, 'start');
  if (!r) r = resolveTarget(ctx, physics, { at: [430, 330] });
  const fly = !!p.fly || r.air;
  if (fly) ctrl.setMode('fly');
  ctrl.place(r.feet, { air: fly });
  ctrl.yaw = headingToYaw(p.look?.heading ?? r.heading ?? 270);
  ctrl.pitch = (p.look?.pitch ?? r.pitch ?? 4) * DEG;
  ctrl.applyCamera(0);

  const input = createInput(ctx, {
    onLook: (dYaw, dPitch) => ctrl.look(dYaw, dPitch),
    onToggleFly: () => { auto.cancel(); ctrl.setMode(ctrl.mode === 'fly' ? 'walk' : 'fly'); },
    onIntent: () => { if (auto.active) auto.cancel(); },
  });

  const player = {
    /** feet position (world, meters) — live object, do not replace */
    get position() { return ctrl.feet; },
    /** eye/camera position (world) */
    get eye() { return ctrl.eye; },
    get heading() { return yawToHeading(ctrl.yaw); },
    set heading(h) { ctrl.yaw = headingToYaw(h); },
    get pitch() { return ctrl.pitch / DEG; },
    set pitch(d) { ctrl.pitch = d * DEG; },
    get mode() { return auto.active ? 'auto' : ctrl.mode; },
    set mode(m) { player.setMode(m); },
    get velocity() { return ctrl.vel; },
    get grounded() { return ctrl.state.grounded; },
    get running() { return input.state.run; },
    get locked() { return input.state.locked; },
    speeds: { ...SPEEDS, instant: Infinity },
    body: BODY,
    /** walk (or glide/teleport) to a target; resolves true on arrival, false if cancelled/superseded */
    goTo: (target, speed = 'walk') => auto.goTo(target, speed),
    cancel: () => auto.cancel(),
    teleport: (target) => auto.teleport(target),
    setMode(m) { auto.cancel(); ctrl.setMode(m); },
    /** set view (degrees) */
    setLook(heading, pitch) {
      if (heading != null) ctrl.yaw = headingToYaw(heading);
      if (pitch != null) ctrl.pitch = pitch * DEG;
    },
    /** disable/enable user input (e.g. while a modal panel is open); releases pointer lock when disabling */
    setInputEnabled: (v) => input.setEnabled(v),
    unlock: () => input.unlock(),
    /** floor the observer would stand on at site (X, Y) — world y or null */
    floorAtSite: (X, Y) => { const t = resolveTarget(ctx, physics, { at: [X, Y] }); return t ? t.feet.y : null; },
    pickFloor: (x, z, hintY, exact) => pickFloor(ctx, physics, x, z, hintY, exact),
  };
  ctx.player = player;

  ctx.bus.on('ui:goto', (e) => {
    if (e?.target == null) return;
    player.goTo(e.target, e.speed ?? 'walk').catch((err) => console.error('[player] goTo failed', err));
  });

  ctx.engine.onUpdate((dt) => {
    input.update(dt);
    if (auto.active) ctrl.update(dt, auto.update(dt) || HOLD, null);
    else ctrl.update(dt, null, input.state);
  }, PRIORITY.player);

  // nav grid: built off-thread once the first frame is on screen (never blocks startup)
  let kicked = false;
  const kick = () => { if (!kicked) { kicked = true; nav.rebuild(); } };
  ctx.bus.on('ready', () => requestAnimationFrame(() => requestAnimationFrame(kick)));
  setTimeout(kick, 5000);
}
