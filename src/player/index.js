// Player system (ARCHITECTURE.md §12): first-person observer with capsule collision against a BVH of
// ctx.colliders, a multi-level nav grid + A*, and guided goTo().
//
//   ctx.physics = { floorAt(x, z) -> walking floor y|null (not roof tops), floorAt(x, z, fromY, minNy?, far?)
//                   -> highest surface below fromY, floorsAt(x, z) -> y[], standFloor(x, z, hintY?, exact?), levelFloor(x, z, y), nearestFloor(x, z, y?),
//                   insideAt(x, y, z), findStand(p, r), raycast(origin, dir, far) -> {point, distance, normal,
//                   faceIndex}|null, bvh, rebuild() -> Promise, stats }
//   ctx.nav     = { findPath(fromWorld, toWorld, opts?) -> Vector3[]|null, ready: Promise, nearest(p), landing(p, goal),
//                   floorsAt(x,z), rebuild(), stats, lastQueryMs }
//   ctx.player  = { position (feet), eye, heading, pitch (deg), mode 'walk'|'fly'|'auto', goTo(target, speed)
//                   -> Promise<boolean>, cancel(), teleport(target), setMode, setLook, setInputEnabled, ... }
//                 goTo targets may carry `look` (site [X,Y,Z?]): the arrival pitches toward it and keeps figures out
//                 of the way (goto.js ARRIVAL); findPath crosses climbs (nav/climbs.js: the cedar posts, Middot 4:5).
// URL: ?pos=X,Y,Z (eye, site amot; X,Y alone = at) · ?at=X,Y[,Z] (Z picks the floor on any level) ·
//      ?look=heading,pitch · ?fly=1 · default anchor 'start'.
// Trips (docs/console-design.md §4.3, §6.3.1): goTo(target, { way, pace, label }) walks at a pace multiplier by
// sub-stepping the walker and the controller (never a higher m/s: collisions, stairs and nav corners stay as stable as
// at 1×); looking around during a trip offsets the view without steering (it eases back 2.5 s after the last look);
// only movement and flight input stop a trip. Bus: travel:* (goto.js), player:tap | inspect | intent (input.js).
import { createPhysics } from './physics.js';
import { createNav } from './nav/index.js';
import { createController, BODY } from './controller.js';
import { createInput } from './input.js';
import { createAuto, resolveTarget, pickFloor, SPEEDS } from './goto.js';
import { headingToYaw, yawToHeading, w2m } from '../core/units.js';
import { PRIORITY } from '../core/engine.js';
import { zoneAtSite } from '../data/site.js';

const DEG = Math.PI / 180;

const HOLD = { dirX: 0, dirZ: 0, speed: 0, fly: null };
/**
 * Sub-stepping: one walker step covers at most SUB s of walking time (a 4.5 m/s run moves 9 cm per step; the
 * controller sub-steps its collision further at 12 cm); at most MAX_SUB steps per frame, after which the pace
 * actually run is MAX_SUB·SUB/dt (reported as effectivePace). At 60 fps 10× takes 9 steps.
 */
const SUB = 1 / 50, MAX_SUB = 12;
/** free look during a trip: the view eases back to the walk's look-ahead LOOK_HOLD s after the last look input,
 * exponentially (τ LOOK_TAU s) plus a constant LOOK_MIN rad/s so it lands (a 90° look in 0.9 s); the pitch offset is
 * clamped */
const LOOK_HOLD = 2.5, LOOK_TAU = 0.6, LOOK_MIN = 40 * DEG, LOOK_PITCH_MAX = 60 * DEG;
/** player:intent is emitted at most this often per kind (s) */
const INTENT_GAP = 0.25;
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
  // the user's last look input on the frame clock (s; the sum of frame times): free look during a trip, and the arrival
  // keeping their view
  let clock = 0, lastLook = -1e9;
  const nowS = () => performance.now() / 1000;
  const zoneAt = (p) => {
    try { if (ctx.zones?.at) return ctx.zones.at(p); } catch { /* fall back to the site model */ }
    const s = w2m(p);
    return zoneAtSite(s.X, s.Y, s.Z + 0.4);
  };
  const auto = createAuto(ctx, ctrl, physics, nav, { zoneAt, lookedWithin: (s) => clock - lastLook < s });

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

  // the view offset of free look during a trip (rad), on top of the walker's own view (controller.state.offYaw/offPitch)
  const cs = ctrl.state;
  const foldLook = () => {
    if (!cs.offYaw && !cs.offPitch) return;
    ctrl.yaw += cs.offYaw;
    ctrl.pitch += cs.offPitch;
    cs.offYaw = cs.offPitch = 0;
  };
  const lastIntent = Object.create(null);
  const intent = (kind) => {
    // movement and flight input stop a trip; looking, Esc, taps and inspecting do not
    if ((kind === 'move' || kind === 'fly') && auto.active) auto.cancel();
    const t = nowS();
    if (t - (lastIntent[kind] ?? -1e9) < INTENT_GAP) return;
    lastIntent[kind] = t;
    ctx.bus.emit('player:intent', { kind });
  };
  const toggleFly = () => { auto.cancel(); ctrl.setMode(ctrl.mode === 'fly' ? 'walk' : 'fly'); return ctrl.mode; };

  const input = createInput(ctx, {
    onLook: (dYaw, dPitch) => {
      lastLook = clock;
      if (!auto.active) { ctrl.look(dYaw, dPitch); return; }
      cs.offYaw += dYaw;
      cs.offPitch = Math.max(-LOOK_PITCH_MAX, Math.min(LOOK_PITCH_MAX, cs.offPitch + dPitch));
    },
    onToggleFly: toggleFly,
    onIntent: intent,
    onInspect: (e) => ctx.bus.emit('player:inspect', e),
    onTap: (e) => ctx.bus.emit('player:tap', e),
    // pad B: stops a walking trip (in fly mode it sinks)
    onPadBack: () => { if (auto.active && ctrl.mode !== 'fly') intent('move'); },
  });

  /** teleport now (fade false: the caller holds its own veil, or none is wanted) or under the UI's veil (fade true) */
  async function veiledTeleport(target) {
    const fade = typeof ctx.ui?.fade === 'function' && !ctx.params?.shot;
    if (fade) { try { await ctx.ui.fade(1, 220); } catch { /* the veil is optional */ } }
    const ok = auto.teleport(target);
    if (fade) { try { await ctx.ui.fade(0, 320); } catch { /* the veil is optional */ } }
    return ok;
  }

  const player = {
    /** feet position (world, meters) — live object, do not replace */
    get position() { return ctrl.feet; },
    /** eye/camera position (world) */
    get eye() { return ctrl.eye; },
    /** the view's heading and pitch (deg), free look during a trip included */
    get heading() { return yawToHeading(ctrl.yaw + cs.offYaw); },
    set heading(h) { cs.offYaw = 0; ctrl.yaw = headingToYaw(h); },
    get pitch() { return Math.max(-1.48, Math.min(1.48, ctrl.pitch + cs.offPitch)) / DEG; },
    set pitch(d) { cs.offPitch = 0; ctrl.pitch = d * DEG; },
    get mode() { return auto.active ? 'auto' : ctrl.mode; },
    set mode(m) { player.setMode(m); },
    get velocity() { return ctrl.vel; },
    get grounded() { return ctrl.state.grounded; },
    get running() { return input.state.run; },
    get locked() { return input.state.locked; },
    speeds: { ...SPEEDS, instant: Infinity },
    body: BODY,
    /** the path (world feet points, read-only; a climb's via included) the current goTo follows, or null (no walk / not planned yet) */
    get path() { return auto.job?.full ?? auto.job?.path?.pts ?? auto.job?.trip?.route?.pts ?? null; },
    /**
     * walk (or glide/teleport) to a target; resolves true on arrival, false if cancelled/superseded.
     * speedOrOpts: 'instant'|'slow'|'walk'|'fast'|'run'|m/s (pace 1), or { way: 'instant'|'walk'|'run'|m/s,
     * pace: 0.25..10 (the UI offers ½ 1 2 5 10), label?: string | { en } }.
     */
    goTo: (target, speedOrOpts = 'walk') => auto.goTo(target, speedOrOpts),
    cancel: () => auto.cancel(),
    /** the current trip's pace (clamped 0.25..10); emits travel:pace; returns the pace */
    setPace: (p) => auto.setPace(p),
    /** the current trip's way, 'walk' ↔ 'run'; emits travel:pace */
    setWay: (w) => auto.setWay(w),
    /** veiled teleport to the trip's target (travel:end reason 'skipped'); resolves true when done */
    finishTrip: () => auto.finishTrip(),
    /** null | { id, label, way, pace, effectivePace, mps, s, total, remaining, eta, to: [X,Y,Z], zones: [{ zone, s0, s1 }] } */
    get trip() { return auto.tripInfo(); },
    /** teleport(target, { fade = false }): now (returns boolean), or under the UI's veil (fade: true; returns a Promise) */
    teleport: (target, { fade = false } = {}) => (fade ? veiledTeleport(target) : auto.teleport(target)),
    setMode(m) { auto.cancel(); ctrl.setMode(m); },
    /** Fly ↔ Walk (cancels a trip); returns the new mode */
    toggleFly,
    /** set view (degrees); clears a free-look offset */
    setLook(heading, pitch) {
      cs.offYaw = cs.offPitch = 0;
      if (heading != null) ctrl.yaw = headingToYaw(heading);
      if (pitch != null) ctrl.pitch = pitch * DEG;
    },
    /**
     * enable/disable user input. true / false: all on / all off (and release pointer lock). An object
     * { keys?, move?, look?, pointerLock?, pad?, touch? } changes only the fields given (pointerLock false releases it).
     */
    setInputEnabled: (v) => input.setEnabled(v),
    /** fn(pointerEvent) -> false keeps an unlocked click on the canvas from capturing the mouse (it is a player:tap) */
    setLockFilter: (fn) => input.setLockFilter(fn),
    /** held fly up (1) / down (-1) / release (0): touch Rise / Sink */
    setVertical: (v) => input.setVertical(v),
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

  /** one frame of guided movement: sub-stepped at the trip's pace (walk, climb), scaled (glide), real time otherwise */
  function stepAuto(dt) {
    let camDt = dt;
    if (auto.paced) {
      const pace = auto.pace;
      if (auto.phase === 'glide') {
        const h = dt * pace;
        ctrl.update(h, auto.update(h) || HOLD, null, true);
        camDt = h;
        auto.setEffectivePace(pace);
      } else {
        let n = Math.max(1, Math.ceil((pace * dt) / SUB - 1e-9)), eff = pace;
        if (n > MAX_SUB) { n = MAX_SUB; eff = (MAX_SUB * SUB) / dt; }
        const h = (eff * dt) / n;
        for (let i = 0; i < n; i++) {
          ctrl.update(h, auto.update(h) || HOLD, null, true);
          if (!auto.paced || auto.phase === 'glide') break;
        }
        camDt = eff * dt;
        auto.setEffectivePace(eff);
      }
    } else ctrl.update(dt, auto.update(dt) || HOLD, null, true);
    // free look: ease the offset back to the walk's look-ahead once the user stops looking
    // (at once during the arrival's turn: the arrival frames its target unless the user is looking, goto.js)
    if ((cs.offYaw || cs.offPitch) && (clock - lastLook > LOOK_HOLD || auto.phase === 'turn')) {
      const k = 1 - Math.exp(-dt / LOOK_TAU), m = LOOK_MIN * dt;
      const ease = (v) => { const d = Math.abs(v) * k + m; return Math.abs(v) <= d ? 0 : v - Math.sign(v) * d; };
      cs.offYaw = ease(cs.offYaw);
      cs.offPitch = ease(cs.offPitch);
    }
    // head bob is off for a trip at 5× and faster (comfort; the vignette is the UI's)
    cs.noBob = auto.active && auto.pace >= 5;
    ctrl.applyCamera(Math.min(camDt, 0.25));
    auto.tick(dt);
  }

  // test hook (src/player/dev/trip.js): _hold = true stops the engine's stepping; _tick(dt) steps one frame by hand
  let held = false;
  function update(dt) {
    clock += dt;
    input.update(dt);
    if (auto.active) stepAuto(dt);
    else {
      cs.noBob = false;
      foldLook();
      ctrl.update(dt, null, input.state);
    }
  }
  Object.defineProperties(player, {
    _hold: { get: () => held, set: (v) => { held = !!v; }, enumerable: false },
    _tick: { value: update, enumerable: false },
    _input: { value: input, enumerable: false },
    _walkerHeading: { value: () => yawToHeading(ctrl.yaw), enumerable: false },
    _flying: { value: () => ctrl.mode === 'fly', enumerable: false },
  });
  ctx.engine.onUpdate((dt) => { if (!held) update(dt); }, PRIORITY.player);

  // nav grid: built off-thread (the worker is spawned in createNav), started on 'ready' before the first frame.
  // That frame blocks the main thread for the shader compiles (25–47 s on the HD 4600, any viewport) while the
  // worker's core would sit idle; started there, nav is ready when the frame ends, and the frame is no slower
  // (docs/decisions/player-2-fix.md). The far-ground layer reaches the places the UI can send the observer to:
  // zone stands and event viewpoints.
  let kicked = false, haveTargets = false;
  const kick = () => { if (!kicked) { kicked = true; nav.rebuild(); } };
  const targets = navTargets().then((pts) => { nav.targets = pts; haveTargets = true; });
  ctx.bus.on('ready', () => { if (haveTargets) kick(); else targets.then(kick); });
  setTimeout(() => targets.then(kick), 5000);
}

/** Site points [X, Y, Z?] the UI sends the observer to (zone stands, event viewpoints); [] when the data is missing. */
async function navTargets() {
  const pts = [];
  const take = (p) => { if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) pts.push(p); };
  try { const m = await import('../data/zones-content.js'); for (const z of Object.values(m.ZONE_CONTENT || {})) take(z?.stand); } catch { /* optional */ }
  try { const m = await import('../data/schedule.js'); for (const e of m.EVENTS || []) take(e?.view?.at); } catch { /* optional */ }
  return pts;
}
