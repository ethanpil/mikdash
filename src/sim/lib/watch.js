// Watch views (gate-sim-data): where the UI's "Go" stands the observer to watch an event, checked against what the
// camera will show there. The UI goes to ev.view (at, heading) and arrives at ARRIVAL.pitch (player/goto.js: −4°),
// so a stand "sees" a figure when, from the eye at that heading and pitch, two of its head, chest and knees fall in
// the frustum with nothing solid (physics rays) between, and it is at least MIN_FRAC of the screen's height tall.
//
//   figuresOf(entry, at, near)         the drawn-or-wanted figures of a choreo entry near a world point
//   seesAny(ctx, view, figs)           the share of the screen of the best-seen figure from a view (0 = none seen)
//   standFor(ctx, focus, figs, opts)   a stand on open floor round a focus point (site amot) from which figs are seen
//   createAutoView(ctx, runtime, schedule)  fn(ev, t): the data's view while it shows the event's figures, else a stand
//                                     that does (installed as the schedule's auto view: ev.view's getter asks it)
import { Vector3, Ray, Box3 } from 'three';
import { AMAH, EYE_HEIGHT, m2w } from '../../core/units.js';

export const MIN_FRAC = 0.08;        // a 1.7 m figure 8% of the screen's height: ≈ 17 m at the default 62° FOV
export const NEAR = 18;              // m: the figures that belong to an event's place
const KEEP = 1.25;
const FRESH_MS = 1500;               // a cached view is also re-checked after this much real time (a paused clock)
const LEVEL = 5;                     // m: an event's figures are those within this height of its place                   // a data view is kept while its figures are this much over MIN_FRAC
const PITCH = -4;                    // player/goto.js ARRIVAL.pitch (the UI's view carries no pitch)
const DEG = Math.PI / 180;
const _E = new Vector3(), _P = new Vector3(), _d = new Vector3(), _f = new Vector3(), _r = new Vector3(), _u = new Vector3();

/** the figures of a runtime entry its choreo wants now, within `near` m of world point `at` (all when at is null) */
export function figuresOf(entry, at = null, near = NEAR) {
  const out = [];
  if (!entry) return out;
  for (const p of entry.pools) {
    const kind = p.spec?.animal || '';
    const H = /dove|pigeon/.test(kind) ? 0.25 : kind ? 0.75 : 1.7;
    for (const s of p.slots) {
      if (!s.want || !s.actor || !s.placed) continue;
      if (at && s.pos.distanceTo(at) > near) continue;
      out.push({ p: s.pos, H });
    }
  }
  for (const c of entry.crowds) if (c.want && c.pos && (!at || c.pos.distanceTo(at) <= near)) out.push({ p: c.pos, H: 1.6 });
  return out;
}

/** an event of no figures (the nivreshet's flash, the fire alone): its own place, seen when one of three points is */
export const objectOf = (at) => [{ p: at.clone(), H: 1.2, need: 1, minFrac: 0 }];

/** world feet of a view's stand: [X, Y, Z] amot (Z: that level's floor; omitted: the walking floor) → Vector3 | null */
function feetOf(ctx, at, out = new Vector3()) {
  const ph = ctx.physics;
  const x = at[0] * AMAH, z = -at[1] * AMAH;
  let y = null;
  if (Number.isFinite(at[2])) y = ph?.levelFloor?.(x, z, at[2] * AMAH) ?? at[2] * AMAH;
  else y = ph?.standFloor?.(x, z) ?? ph?.floorAt?.(x, z) ?? 0;
  return Number.isFinite(y) ? out.set(x, y, z) : null;
}

/**
 * From feet (world) at compass heading h and pitch: the share of the screen's height of the best-seen figure (0: none),
 * and how many are seen. A figure is seen when two of three points (0.85, 0.6, 0.25 of its height) are in the frustum
 * (5% margin) with no solid between.
 */
export function seen(ctx, feet, heading, figs, pitch = PITCH) {
  const ph = ctx.physics, cam = ctx.camera;
  const tanV = Math.tan(((cam?.fov || 62) * DEG) / 2) * 0.95, tanH = tanV * (cam?.aspect || 16 / 9);
  const h = heading * DEG, p = pitch * DEG;
  _f.set(Math.sin(h) * Math.cos(p), Math.sin(p), -Math.cos(h) * Math.cos(p));
  _r.set(Math.cos(h), 0, Math.sin(h));
  _u.crossVectors(_r, _f);
  _E.copy(feet); _E.y += EYE_HEIGHT;
  const bodies = bodiesNear(ctx, _E);
  let best = 0, n = 0, inFrame = false, small = 0;
  for (const g of figs) {
    let ok = 0, depth = 0, framed = 0;
    for (const u of [0.85, 0.6, 0.25]) {
      _P.copy(g.p); _P.y += g.H * u;
      _d.copy(_P).sub(_E);
      const z = _d.dot(_f);
      if (z < 0.3 || Math.abs(_d.dot(_r)) > z * tanH || Math.abs(_d.dot(_u)) > z * tanV) continue;
      framed++;
      const L = _d.length();
      const hit = ph?.raycast?.(_E, _d, L);
      if (hit && hit.distance < L - 0.25) continue;
      if (blockedByDoor(ctx, _E, _d, L)) continue;
      if (blockedByBody(bodies, _E, _P, g.p)) continue;
      ok++; depth = z;
    }
    if (framed) inFrame = true;
    if (ok < (g.need ?? 2)) continue;
    const frac = g.H / (2 * depth * (tanV / 0.95));
    if (frac < (g.minFrac ?? MIN_FRAC)) { small = Math.max(small, frac); continue; }
    n++;
    if (frac > best) best = frac;
  }
  // (why nothing is seen: 'none in frame' | 'hidden by a solid' | 'too small' — for the tests)
  return { frac: n ? best : small, n, why: n ? '' : !figs.length ? 'no figure' : small ? 'too small' : inFrame ? 'hidden by a solid' : 'none in frame' };
}

/** a view { at, heading } seen from: { frac, n } (frac 0 when nothing is seen or the stand has no floor) */
export function seesAny(ctx, view, figs) {
  const at = view?.at;
  if (!Array.isArray(at) || !Number.isFinite(view.heading)) return { frac: 0, n: 0 };
  let feet = feetOf(ctx, at, new Vector3());
  // (from where the arrival will stand: it steps aside when a figure is in the way — player/goto.js)
  if (feet) feet = arrivalOf(ctx, ctx.schedule?.runtime, feet, view.heading);
  return feet ? seen(ctx, feet, view.heading, figs) : { frac: 0, n: 0, why: 'no stand' };
}

// player/goto.js ARRIVAL (standBlocked): the arrival steps aside (up to 3 m, wherever that lands) when a figure stands
// within `clear` (0.8 m; 1.3 m from a lying one) or a standing one's body (0.3 m) comes within 6° of the sight segment —
// the eye toward the floor 4 m ahead, short of its last 1.5 m. A stand chosen here keeps clear by the same rule, over
// the sim's figures and the drawn crowds, so the observer arrives where the check was made.
const A_CLEAR = 0.8, A_CLEAR_LYING = 1.3, A_RAD = 0.3, A_RAD_ANIMAL = 0.4, A_CONE = Math.tan(6 * DEG), A_AHEAD = 4, A_SKIP = 1.5, A_AIM = 0.5;
const LYING = /^(sleep|lie|prostrate|bound|struggle)/;
/** would the arrival at world feet (heading h) step aside for a figure? */
export function crowded(runtime, feet, h, ctx = null) {
  const ex = feet.x, ey = feet.y + EYE_HEIGHT, ez = feet.z;
  const ax = Math.sin(h * DEG) * A_AHEAD, az = -Math.cos(h * DEG) * A_AHEAD, ay = A_AIM - EYE_HEIGHT;
  const L2 = ax * ax + az * az, L = Math.sqrt(L2), tMax = (L - A_SKIP) / L;
  const test = (fx, fy, fz, lying, animal, H) => {
    if (Math.abs(fy - feet.y) < 1.2 && Math.hypot(fx - ex, fz - ez) < (lying && !animal ? A_CLEAR_LYING : animal ? A_CLEAR + 0.1 : A_CLEAR)) return true;
    if (lying) return false;
    const t = Math.max(0, Math.min(tMax, ((fx - ex) * ax + (fz - ez) * az) / L2));
    const y = ey + ay * t;
    return y > fy && y < fy + H && Math.hypot(ex + ax * t - fx, ez + az * t - fz) < (animal ? A_RAD_ANIMAL : A_RAD) + t * L * A_CONE;
  };
  for (const e of runtime?.entries || []) {
    for (const p of e.pools) {
      const animal = !!p.spec?.animal;
      for (const s of p.slots) {
        if (!s.want || !s.placed) continue;
        if (test(s.pos.x, s.pos.y, s.pos.z, LYING.test(s._pose || ''), animal, animal ? 0.9 : 1.7)) return true;
      }
    }
  }
  // the drawn crowds' members (people's instanced crowds: world arrays), as the arrival sees them
  for (const c of ctx?.people?.system?.crowds || []) {
    if (!c?.visible || !c.count || !c.x) continue;
    const lying = LYING.test(c.poseName || '');
    for (let i = 0; i < c.count; i++) if (test(c.x[i], c.y[i], c.z[i], lying, false, 1.7)) return true;
  }
  return false;
}

/**
 * Where the arrival at world feet (heading h) actually stands (player/goto.js clearStand, approximated): the feet when
 * not crowded; else the nearest ring point (0.5 m rings out to 3 m) on the same level (±0.35 m), not inside a solid, in
 * line of sight of the feet, not crowded itself, farthest from the figures; null when there is none.
 */
export function arrivalOf(ctx, runtime, feet, h) {
  if (!crowded(runtime, feet, h, ctx)) return feet;
  const ph = ctx.physics;
  const near = [];
  for (const e of runtime?.entries || []) for (const p of e.pools) for (const sl of p.slots) if (sl.want && sl.placed && sl.pos.distanceTo(feet) < 6) near.push(sl.pos);
  const eye = new Vector3(), eye2 = new Vector3(), c = new Vector3();
  for (let d = 0.5; d <= 3 + 1e-6; d += 0.5) {
    const m = Math.max(8, Math.round((2 * Math.PI * d) / 0.5));
    let best = null, bs = -Infinity;
    for (let i = 0; i < m; i++) {
      const an = (i / m) * 2 * Math.PI, x = feet.x + Math.cos(an) * d, z = feet.z + Math.sin(an) * d;
      let y = null, bd = 0.35;
      for (const f of ph?.floorsAt?.(x, z) || []) { const dy = Math.abs(f - feet.y); if (dy <= bd) { bd = dy; y = f; } }
      if (y === null || ph.insideAt?.(x, y + 0.05, z)) continue;
      c.set(x, y, z);
      eye.set(feet.x, feet.y + EYE_HEIGHT, feet.z); eye2.set(x, y + EYE_HEIGHT, z);
      _d.subVectors(eye2, eye);
      const hit = ph.raycast?.(eye, _d, _d.length());
      if (hit && hit.distance < _d.length()) continue;
      if (crowded(runtime, c, h, ctx)) continue;
      let md = 3;
      for (const q of near) md = Math.min(md, Math.hypot(q.x - x, q.z - z));
      if (md > bs) { bs = md; best = c.clone(); }
    }
    if (best) return best;
  }
  return null;
}

// the other figures hide what is behind them ("only dark backs show"): each a 0.22 m upright cylinder, 1.6 m tall
const BODY_R = 0.22, BODY_H = 1.6;
function bodiesNear(ctx, eye, far = 40) {
  const out = [];
  for (const e of ctx.schedule?.runtime?.entries || []) {
    for (const p of e.pools) {
      if (p.spec?.animal) continue;
      for (const sl of p.slots) {
        if (!sl.want || !sl.placed || LYING.test(sl._pose || '')) continue;
        if (Math.abs(sl.pos.x - eye.x) > far || Math.abs(sl.pos.z - eye.z) > far) continue;
        out.push(sl.pos);
      }
    }
  }
  return out;
}
/** does a body (not the target's own, at `self`) stand across the segment from E to P? */
function blockedByBody(bodies, E, P, self) {
  const dx = P.x - E.x, dz = P.z - E.z, dy = P.y - E.y, L2 = dx * dx + dz * dz;
  if (L2 < 1e-6) return false;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (Math.abs(b.x - self.x) < 0.05 && Math.abs(b.z - self.z) < 0.05) continue;
    const t = ((b.x - E.x) * dx + (b.z - E.z) * dz) / L2;
    if (t <= 0.02 || t >= 0.92) continue;               // (not the figure's own neighbourhood at the far end)
    const cx = E.x + dx * t - b.x, cz = E.z + dz * t - b.z;
    if (cx * cx + cz * cz > BODY_R * BODY_R) continue;
    const y = E.y + dy * t;
    if (y > b.y && y < b.y + BODY_H) return true;
  }
  return false;
}

// door leaves are movables, not colliders: a stand looking through a shut leaf is caught by their boxes
const _ray = new Ray(), _hit = new Vector3(), _box = new Box3();
let doorCache = { at: -1e9, boxes: [] };
function doorBoxes(ctx) {
  const now = performance.now();
  if (now - doorCache.at < 250) return doorCache.boxes;
  const out = [];
  ctx.movables?.forEach?.((obj, id) => {
    if (!String(id).startsWith('door:') || !obj?.isObject3D || obj.visible === false) return;
    obj.updateMatrixWorld?.(true);
    obj.traverse((m) => { if (m.isMesh && m.visible !== false) { const b = new Box3().setFromObject(m); if (!b.isEmpty()) out.push(b); } });
  });
  doorCache = { at: now, boxes: out };
  return out;
}
function blockedByDoor(ctx, o, d, L) {
  const boxes = doorBoxes(ctx);
  if (!boxes.length) return false;
  _ray.origin.copy(o); _ray.direction.copy(d).normalize();
  for (const b of boxes) if (_ray.intersectBox(b, _hit) && _hit.distanceTo(o) < L - 0.25) return true;
  return false;
}

const bearing = (fx, fy, tx, ty) => ((Math.atan2(tx - fx, ty - fy) / DEG) % 360 + 360) % 360;

/**
 * A stand from which `figs` are seen, round the focus F = [X, Y, Z] (site amot): rings at opts.dists amot, bearings
 * (from F to the stand) starting at opts.from and widening both ways; on a standable floor at the focus's level or
 * below it (never above by more than an amah), nothing solid at +1 m, nothing within 1.5 m straight ahead; facing F.
 * Among the first ring that sees any, the stand that sees the most figures wins, the bearing nearest `from` first.
 * → { at, heading } | null
 */
export function standFor(ctx, F, figs, { dists = [12, 15, 9, 19, 24], from = null, step = 20, runtime = ctx.schedule?.runtime } = {}) {
  const ph = ctx.physics;
  if (!ph || !figs.length) return null;
  const b0 = Number.isFinite(from) ? from : 180;
  const bears = [b0];
  for (let k = step; k <= 180; k += step) { bears.push(b0 + k); if (k < 180) bears.push(b0 - k); }
  const feet = new Vector3();
  for (const D of dists) {
    let best = null;
    for (const b of bears) {
      const X = F[0] + D * Math.sin(b * DEG), Y = F[1] + D * Math.cos(b * DEG);
      const x = X * AMAH, z = -Y * AMAH;
      const floors = ph.floorsAt?.(x, z) || [];
      // the focus's level, else the nearest below it
      let fy = null;
      for (const y of floors) if (y <= (F[2] + 1) * AMAH && (fy == null || y > fy)) fy = y;
      if (fy == null) continue;
      if (ph.insideAt?.(x, fy + 1.0, z)) continue;
      const h = bearing(X, Y, F[0], F[1]);
      feet.set(x, fy, z);
      // nothing close straight ahead (a wall or pier filling the screen)
      _E.set(x, fy + EYE_HEIGHT, z);
      _d.set(Math.sin(h * DEG), 0, -Math.cos(h * DEG));
      const hit = ph.raycast?.(_E, _d, 1.5);
      if (hit && hit.distance < 1.5) continue;
      if (crowded(runtime, feet, h, ctx)) continue;
      const s = seen(ctx, feet, h, figs);
      if (!s.n) continue;
      // (the bearing nearest `from` wins unless another sees more of the figures)
      if (!best || s.n > best.n) best = { at: [round(X), round(Y), round(fy / AMAH)], heading: Math.round(h), n: s.n, frac: s.frac };
    }
    if (best) return { at: best.at, heading: best.heading };
  }
  return null;
}
const round = (v) => Math.round(v * 100) / 100;

/**
 * The schedule's auto view (schedule.setAutoView): for an event in progress with figures (its participants), the data's
 * view while from it the event's figures are seen; otherwise a stand that sees them, round their centre, starting on
 * the data view's side. Cached per event for two seconds of the clock and per runtime generation. null = the data's.
 */
export function createAutoView(ctx, runtime, schedule) {
  const cache = new Map();
  const _at = new Vector3();
  return (ev, t, base) => {
    if (!ev || !Number.isFinite(t) || !Number.isFinite(ev.t0)) return null;
    const span = ((ev.t1 - ev.t0) % 1440 + 1440) % 1440, since = ((t - ev.t0) % 1440 + 1440) % 1440;
    if (since > span) return null;                       // not in progress: the data's view
    const key = `${runtime.generation}:${Math.round(t * 30)}`;
    const c = cache.get(ev.id);
    const now = performance.now();
    if (c && c.key === key && now - c.at < FRESH_MS) return c.v;
    let v = null;
    try {
      const entry = runtime.choreo(ev.choreo);
      const at = schedule.positionOf(ev, _at);
      // (its figures about its place; in a lull there — the incense burned, the kohanim withdrawn — those a little further)
      // (on its own level: a guard on the Mount under Beit HaMoked is not one of the hall's sleepers)
      // (preferably on its own level: a guard on the Mount under Beit HaMoked is not one of the hall's sleepers; the
      // barkai's watcher come down from the roof still is the event's)
      const level = (list) => { const l = list.filter((g) => Math.abs(g.p.y - at.y) <= LEVEL); return l.length ? l : list; };
      let figs = !at ? [] : ev.participants?.length ? (entry ? level(figuresOf(entry, at)) : []) : objectOf(at);
      if (!figs.length && at && entry && ev.participants?.length) figs = level(figuresOf(entry, at, 2 * NEAR));
      // (the data's view is kept only when it shows them with a margin: the arrival may shift the stand a little)
      if (figs.length && !(seesAny(ctx, base, figs.map((g) => ({ ...g, minFrac: (g.minFrac ?? MIN_FRAC) * KEEP }))).n > 0)) {
        // round the figure nearest the event's place (then the next two: scattered figures have no useful centre — a
        // meal-offering's two kohanim on either side of the altar), watched from the data view's side when it has one
        const order = figs.slice().sort((a, b) => a.p.distanceTo(at) - b.p.distanceTo(at));
        for (const g of order.slice(0, 3)) {
          const F = siteOf(g.p);
          const from = Array.isArray(base?.at) ? bearing(F[0], F[1], base.at[0], base.at[1]) : null;
          v = standFor(ctx, F, figs, { from, dists: ev.participants?.length ? undefined : [24, 40, 60, 80, 100] });
          if (v) break;
        }
      }
    } catch (e) { v = null; }
    cache.set(ev.id, { key, v, at: now });
    return v;
  };
}

/** a site point [X, Y, Z] for a world Vector3 */
export const siteOf = (v) => [v.x / AMAH, -v.z / AMAH, v.y / AMAH];
export { m2w };

/**
 * A live view (schedule.liveView) that follows one figure: pick(t) → its Slot (or null: the data's view); the stand
 * from standFor round it, starting on the side `from` gives (a bearing, or fn(F, t) → bearing, F = [X, Y, Z] amot).
 * Cached for two seconds of the clock and per runtime generation.
 */
export function followView(ctx, pick, { dists, from = null, H = 1.7 } = {}) {
  let key = '', v = null, at = 0;
  return (t) => {
    if (!Number.isFinite(t)) return null;
    const k = `${ctx.schedule?.runtime?.generation ?? 0}:${Math.round(t * 30)}`;
    const now = performance.now();
    if (k === key && now - at < FRESH_MS) return v;
    const s = pick(t);
    // (nothing cached while the figure is not placed yet: with the clock paused the key would never change)
    if (!s?.actor || !s.want || !s.placed) return null;
    key = k; at = now;
    const F = siteOf(s.pos);
    const b = typeof from === 'function' ? from(F, t) : from;
    v = standFor(ctx, F, [{ p: s.pos, H }], { dists, from: b });
    return v;
  };
}
/** compass bearing from site point a to b (deg) */
export const bearingTo = (a, b) => bearing(a[0], a[1], b[0], b[1]);

/**
 * A dynamic row's "Go" (G4/G5 rows: ev.view's getter): the step's own view while from it the row's figure at site
 * point `pos` is seen, else a stand round it that sees it. Cached on `holder` for two seconds of the clock.
 */
export function watchPoint(ctx, base, pos, holder) {
  if (!base || !Array.isArray(pos) || !Number.isFinite(pos[0])) return base;
  const t = ctx.time?.t;
  const key = `${ctx.schedule?.runtime?.generation ?? 0}:${Math.round((t ?? 0) * 30)}:${pos[0].toFixed(1)},${pos[1].toFixed(1)}`;
  const c = holder._watch;
  const now = performance.now();
  if (c && c.key === key && c.base === base && now - c.at < FRESH_MS) return c.v;
  let v = base;
  try {
    const figs = [{ p: m2w(pos[0], pos[1], pos[2] ?? 16, new Vector3()), H: 1.7 }];
    if (!(seesAny(ctx, base, [{ ...figs[0], minFrac: MIN_FRAC * KEEP }]).n > 0)) v = standFor(ctx, [pos[0], pos[1], pos[2] ?? 16], figs, { from: Array.isArray(base.at) ? bearing(pos[0], pos[1], base.at[0], base.at[1]) : null }) || base;
  } catch { v = base; }
  holder._watch = { key, base, v, at: now };
  return v;
}

/**
 * The staged end of an event (gate-sim-data): the last minute of [t0, t1] (cyclic) at which any of `scripts` (a
 * module's Scripts, evaluated purely by evalAt(S, t, out) → out { vis, X, Y, Z }) stands within nearA amot (plan) of
 * the site point `at`, scanning back from t1 by `step`; NaN when none does. Modules publish it with
 * schedule.retime so a row is not listed after its figures have gone ("Happening now" must be watchable).
 */
export function lastNear(evalAt, scripts, t0, t1, at, nearA = NEAR / AMAH, step = 0.1, dz = 15) {
  const out = {};
  const L = ((t1 - t0) % 1440 + 1440) % 1440;
  const any = (u) => {
    const t = (t0 + u) % 1440;
    for (let i = 0; i < scripts.length; i++) {
      const S = scripts[i];
      if (!S) continue;
      evalAt(S, t, out);
      if (out.vis && Math.hypot(out.X - at[0], out.Y - at[1]) <= nearA && !(Math.abs(out.Z - at[2]) > dz)) return true;
    }
    return false;
  };
  // back from the end in steps of 5 × step, then forward by `step` through the last stretch found (it is built in the
  // frame a new date's plan is: a few ms, not tens)
  const big = 5 * step;
  for (let u = L; u > -big; u -= big) {
    const a = Math.max(0, u);
    if (!any(a)) continue;
    let last = a;
    for (let v = a + step; v <= Math.min(L, a + big); v += step) if (any(v)) last = v;
    return (t0 + last) % 1440;
  }
  return NaN;
}

/**
 * Retime helper: install schedule.retime for `ids` on `sim`, giving [t0, end] where ends()[id] is this date's staged
 * end (a minute in the data's window, see lastNear), else the data's window. ends() → { [id]: minute } | null for a
 * stale or missing plan. After building a plan, call apply() so the rows take it at once.
 */
export function stagedRetime(sim, ids, ends) {
  const S = sim.schedule;
  if (!S?.retime) return { apply() {} };
  for (const id of ids) {
    S.retime(id, (t0, t1, o) => {
      const e = o?.nextDay ? null : ends()?.[id];
      if (!Number.isFinite(e)) return [t0, t1];
      const L = ((t1 - t0) % 1440 + 1440) % 1440, u = ((e - t0) % 1440 + 1440) % 1440;
      if (u > L || L - u < 0.5) return [t0, t1];
      return [t0, (t0 + Math.max(1, u + 0.3)) % 1440];
    });
  }
  return { apply() { for (const id of ids) { const ev = S.byId?.(id); if (ev && !ev.dynamic) S.resolveEvent?.(ev); } } };
}
