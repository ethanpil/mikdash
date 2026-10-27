// CPU picking for the inspect core (console-design §6.2 "Picking"). No readPixels, no GPU queries: one BVH ray through
// the physics for the occluder, then the pooled figures' pick solids (people/pick.js), the crowds' boxes, the site
// elements' boxes and the fires — all tested on the CPU against the view ray.
//
//   createPicker(ctx, { runtime, zones, objects }) -> {
//     pick(clientX, clientY, opts?) -> Hit | null,      opts { tolerancePx = 8, maxDist = 150, inset }
//     figures() -> [{ slot, entry, pool, index }]        the pickable pooled figures now (debug / tests)
//     elementBoxes -> [{ id, kind, pri, box3, vol }]
//     stats { last, n, cells, tested }
//   }
// Hit = { ref, kind: 'person'|'animal'|'object'|'place', crowd?, label:{en}, distance, world, at:[X,Y,Z], zone,
//         screen:{x,y}, alternatives? } — see the design §6.2.
import { Vector3, Box3, Ray } from 'three';
import { m2w, w2m, AMAH } from '../core/units.js';

const OBJ_PRI = { fixture: 0, curtain: 1, opening: 2, gate: 3, stair: 4, ramp: 5, chamber: 6, slab: 7, wall: 8 };
const CELL = 8;                    // m: the figures' bucket grid
const GRID_HZ = 4;                 // its rebuild rate
const FIG_FAR = 150;               // m: no figure beyond the occluder or this
const PERSON_BEATS = 0.5;          // m: a figure wins over an object entered up to this much nearer
const VIS_SLACK = 0.25;            // m: a figure behind the occluder by less still counts (feet on the floor)
const MAX_ALT = 4;
const POSE_VERB = {
  walk: 'walking', run: 'running', carry: 'carrying', carry_walk: 'carrying', carry_shoulder: 'carrying', carry_shoulder_walk: 'carrying',
  torch: 'with a torch', torch_walk: 'with a torch', prostrate: 'prostrating', bow: 'bowing', kneel: 'kneeling', sing: 'singing',
  play_kinnor: 'playing the kinnor', play_nevel: 'playing the nevel', play_cymbal: 'sounding the cymbal', blow_trumpet: 'sounding the trumpet',
  blow_shofar: 'sounding the shofar', raise_hands: 'blessing', raise_hands_low: 'blessing', pour: 'pouring', throw: 'casting the blood',
  sprinkle: 'sprinkling', sleep: 'asleep', lie: 'lying down', sit: 'sitting', sit_floor: 'sitting', slaughter: 'slaughtering', sweep: 'at work',
  circle_lot: 'casting lots', point: 'pointing', semichah: 'leaning on the offering', semichah_high: 'leaning on the offering',
  hold_legs: 'holding the animal', receive: 'receiving the blood', flay: 'flaying', carry_limbs: 'carrying the parts', carry_limbs_walk: 'carrying the parts',
  lead: 'leading an animal', lead_walk: 'leading an animal', wave: 'waving the offering', kemitzah: 'taking the handful', melikah: 'nipping the bird',
  stoke: 'tending the fire', toss: 'putting on the fire', salt: 'salting', call: 'calling out', knock: 'knocking', lock: 'locking', staff: 'with his staff',
  staff_walk: 'on his round', strike: 'striking', windlass: 'at the wheel', windlass_raise: 'at the wheel', crank: 'turning the wheel', kiddush: 'washing hands and feet',
  rinse: 'rinsing', carry_lamb: 'carrying a lamb', carry_lamb_walk: 'carrying a lamb', pour_low: 'pouring', wave_sudar: 'waving the flag', tend_lamp: 'dressing the lamps',
  warm: 'warming himself', bathe: 'immersing', eat: 'eating', knead: 'kneading', wave_under: 'waving the offering', wave_basket: 'waving the basket',
  carry_stack: 'carrying the bread', carry_stack_walk: 'carrying the bread', carry_slain: 'carrying the carcass', carry_slain_walk: 'carrying the carcass',
  carry_log: 'carrying wood', carry_log_walk: 'carrying wood', stand_hold: 'holding a vessel', walk_hold: 'carrying a vessel', lift_mitre: 'counting the lots',
  // animals
  bound: 'bound', bound_tied: 'bound', struggle: 'bound', walk_led: 'being led', stand_led: 'held on a lead', stand_halter: 'on a halter', drink: 'drinking',
  graze: 'grazing', peck: 'pecking', perch: 'perched', fly: 'flying',
};
const ROLE_TITLE = {
  kohen: 'Kohen', segan: 'The segan', kohen_gadol: 'The Kohen Gadol', kohen_gadol_white: 'The Kohen Gadol', kohen_offduty: 'Kohen (own clothes)',
  kohen_elder: 'Elder of the beit av', kohen_elder_offduty: 'Elder of the beit av', kohen_breeches: 'Kohen', kohen_bathing: 'Kohen', levi: 'Levi',
  guard_levi: 'Levite guard', levi_boy: 'Levite boy', israelite: 'Israelite', nazir: 'Nazir', nazir_shaven: 'Nazir', metzora: "Metzora", mourner: 'Mourner',
  menudeh: 'One under a ban', woman: 'Woman', elder: 'Elder', sanhedrin: 'Judge of the Sanhedrin', child: 'Child',
};
const ANIMAL_TITLE = { lamb: 'Lamb', ram: 'Ram', goat: 'Goat', ewe: 'Ewe lamb', she_goat: 'She-goat', bull: 'Bull', dove: 'Young pigeon', pigeon: 'Young pigeon', turtledove: 'Turtledove' };

export const poseVerb = (pose) => POSE_VERB[String(pose || '').replace(/~\d+$/, '')] || null;
export const roleTitle = (role) => ROLE_TITLE[role] || prettyRole(role);
export const animalTitle = (kind) => ANIMAL_TITLE[kind] || prettyRole(kind);
function prettyRole(s) { const t = String(s || 'figure').replace(/_/g, ' '); return t[0].toUpperCase() + t.slice(1); }

/** "kind:id" | { kind, id } → { kind, id } */
export function parseRef(r) {
  if (!r) return null;
  if (typeof r === 'object') return r.kind ? { kind: r.kind, id: String(r.id ?? '') } : (r.ref ? parseRef(r.ref) : null);
  const s = String(r);
  const i = s.indexOf(':');
  return i < 0 ? { kind: s, id: '' } : { kind: s.slice(0, i), id: s.slice(i + 1) };
}
/** 'actor:<choreo>:<pool…>:<index>' → { choreo, pool, index } */
export function parseActorId(id) {
  const parts = String(id).split(':');
  if (parts.length < 3) return null;
  const index = +parts[parts.length - 1];
  return Number.isInteger(index) ? { choreo: parts[0], pool: parts.slice(1, -1).join(':'), index } : null;
}

export function createPicker(ctx, { runtime, zones, objects: objects0 = null }) {
  let objects = objects0;
  const cam = ctx.camera;
  const eye = new Vector3(), dir = new Vector3(), tmp = new Vector3(), tmp2 = new Vector3();
  const ray = new Ray();
  const stats = { last: 0, n: 0, cells: 0, tested: 0 };

  // ---------------------------------------------------------------------------------------- element boxes (once)
  // (a new amah standard reloads the page, so these never go stale)
  const elementBoxes = [];
  for (const e of Object.values(ctx.site?.elements || {})) {
    const pri = OBJ_PRI[e.kind];
    if (pri === undefined || !e.box?.min || !e.box?.max) continue;
    const a = m2w(e.box.min[0], e.box.min[1], e.box.min[2]), b = m2w(e.box.max[0], e.box.max[1], e.box.max[2]);
    const box3 = new Box3().setFromPoints([a, b]);
    const sz = box3.getSize(tmp);
    elementBoxes.push({ id: e.id, kind: e.kind, pri, box3, vol: Math.max(1e-6, sz.x * sz.y * sz.z), name: e.name });
  }
  const PAD = 0.25 * AMAH;

  // ---------------------------------------------------------------------------------------- figure grid (4 Hz)
  let grid = new Map(), gridAt = -1;
  // a jump re-poses every figure at once: the next pick rebuilds the grid
  for (const ev of ['time:jump', 'time:date', 'player:arrived']) ctx.bus?.on?.(ev, () => { gridAt = -1; });
  const figs = [];
  const cellKey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
  function rebuildGrid(now) {
    if (now - gridAt < 1000 / GRID_HZ && gridAt >= 0) return;
    gridAt = now;
    grid = new Map();
    figs.length = 0;
    const entries = runtime?.entries || [];
    for (const entry of entries) {
      for (const pool of entry.pools) {
        for (let i = 0; i < pool.slots.length; i++) {
          const slot = pool.slots[i];
          if (!slot.shown || !slot.placed || !slot.actor) continue;
          const o = slot.actor.object3D;
          if (!o) continue;
          const f = { slot, entry, pool, index: i, crowd: null, ci: -1 };
          figs.push(f);
          const p = o.position;
          const k = cellKey(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
          let c = grid.get(k);
          if (!c) { c = []; grid.set(k, c); }
          c.push(f);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------------------- the ray
  let rect = null, rectAt = -1e9;
  globalThis.addEventListener?.('resize', () => { rectAt = -1e9; });
  function rectNow() {
    const now = performance.now();
    if (rect && now - rectAt < 250) return rect;
    rectAt = now;
    const el = ctx.renderer?.domElement;
    const b = el?.getBoundingClientRect?.();
    rect = b ? { left: b.left, top: b.top, width: b.width, height: b.height } : { left: 0, top: 0, width: globalThis.innerWidth || 1, height: globalThis.innerHeight || 1 };
    return rect;
  }
  function setRay(clientX, clientY) {
    const r = rectNow();
    const nx = ((clientX - r.left) / (r.width || 1)) * 2 - 1;
    const ny = -(((clientY - r.top) / (r.height || 1)) * 2 - 1);
    cam.updateMatrixWorld();
    eye.setFromMatrixPosition(cam.matrixWorld);
    dir.set(nx, ny, 0.5).unproject(cam).sub(eye).normalize();
    ray.set(eye, dir);
    return r;
  }
  /** metres of extra radius per metre of distance for a tolerance of px pixels */
  function tolPerM(px, viewH) {
    const fov = (cam.fov || 60) * Math.PI / 180;
    return px * 2 * Math.tan(fov / 2) / Math.max(1, viewH);
  }

  // ---------------------------------------------------------------------------------------- solids
  // ray vs vertical capsule [base, base + h] of radius r → entry distance or Infinity
  function hitCapsule(px, py, pz, r, h) {
    // closest approach between the ray and the vertical segment (exact for segment / line)
    const ux = dir.x, uy = dir.y, uz = dir.z;
    const wx = eye.x - px, wy = eye.y - py, wz = eye.z - pz;
    // segment direction (0,1,0), length h
    const b = uy, a = 1, c = 1;
    const d = ux * wx + uy * wy + uz * wz, e = wy;
    const den = a * c - b * b;
    let sc, tc;
    if (den < 1e-8) { sc = 0; tc = e; } else { sc = (b * e - c * d) / den; tc = (a * e - b * d) / den; }
    if (sc < 0) { sc = 0; tc = e; }
    tc = Math.max(0, Math.min(h, tc));
    // re-solve the ray parameter for the clamped segment point
    sc = Math.max(0, -(ux * wx + uy * (wy - tc) + uz * wz));
    const qx = eye.x + ux * sc - px, qy = eye.y + uy * sc - (py + tc), qz = eye.z + uz * sc - pz;
    const d2 = qx * qx + qy * qy + qz * qz;
    if (d2 > r * r) return Infinity;
    return Math.max(0, sc - Math.sqrt(r * r - d2));
  }
  // ray vs a box along a heading (len forward, wid across, h up; centre `off` ahead of the origin) → entry or Infinity
  const _b = new Box3();
  function hitHeadingBox(px, py, pz, headingDeg, len, wid, h, off, pad) {
    const yaw = (headingDeg || 0) * Math.PI / 180;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);       // forward (compass heading → world)
    const rx = -fz, rz = fx;                              // right
    const ox = eye.x - px, oy = eye.y - py, oz = eye.z - pz;
    // into the box frame: u = forward, v = up, w = right
    const lo = { u: ox * fx + oz * fz - off, v: oy, w: ox * rx + oz * rz };
    const ld = { u: dir.x * fx + dir.z * fz, v: dir.y, w: dir.x * rx + dir.z * rz };
    _b.min.set(-len / 2 - pad, -pad, -wid / 2 - pad);
    _b.max.set(len / 2 + pad, h + pad, wid / 2 + pad);
    return slab(lo.u, lo.v, lo.w, ld.u, ld.v, ld.w, _b);
  }
  function slab(ox, oy, oz, dx, dy, dz, b) {
    let t0 = 0, t1 = Infinity;
    const o = [ox, oy, oz], d = [dx, dy, dz], mn = [b.min.x, b.min.y, b.min.z], mx = [b.max.x, b.max.y, b.max.z];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return Infinity; continue; }
      let a = (mn[i] - o[i]) / d[i], c = (mx[i] - o[i]) / d[i];
      if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a;
      if (c < t1) t1 = c;
      if (t0 > t1) return Infinity;
    }
    return t0;
  }
  function hitSphere(cx, cy, cz, r) {
    const ox = eye.x - cx, oy = eye.y - cy, oz = eye.z - cz;
    const b = ox * dir.x + oy * dir.y + oz * dir.z;
    const c = ox * ox + oy * oy + oz * oz - r * r;
    const disc = b * b - c;
    if (disc < 0) return Infinity;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : (c < 0 ? 0 : Infinity);
  }

  function shapeOf(slot) {
    const a = slot.actor;
    const animal = slot.pool.spec?.animal || (a.kind === 'animal' ? a.role : null);
    const fn = ctx.people?.pickShape;
    const shape = fn ? fn(animal || a.role || slot.pool.spec?.role, a.poseName || slot._pose, a.scale) : { type: 'capsule', r: 0.3, h: 1.75 };
    return { shape, animal };
  }

  // ---------------------------------------------------------------------------------------- figures along the ray
  const _seen = new Set();
  function figureHits(range, perM) {
    const out = [];
    _seen.clear();
    // walk the grid along the ray's plan line (DDA in 4 m steps, each sample's 3×3 cells)
    const L = Math.min(range, FIG_FAR);
    const steps = Math.ceil(L / (CELL / 2)) + 1;
    let tested = 0;
    for (let s = 0; s <= steps; s++) {
      const d = Math.min(L, s * CELL / 2);
      const x = eye.x + dir.x * d, z = eye.z + dir.z * d;
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const k = cellKey(cx + i, cz + j);
          if (_seen.has(k)) continue;
          _seen.add(k);
          const list = grid.get(k);
          if (!list) continue;
          for (const f of list) {
            const slot = f.slot;
            if (!slot.shown || !slot.actor) continue;
            const p = slot.actor.object3D.position;
            const dist = tmp.copy(p).sub(eye).length();
            if (dist > L + 2) continue;
            tested++;
            const pad = dist * perM;
            const { shape, animal } = shapeOf(slot);
            let t = Infinity;
            if (shape.type === 'capsule') t = hitCapsule(p.x, p.y, p.z, shape.r + pad, shape.h + pad);
            else if (shape.type === 'box') t = hitHeadingBox(p.x, p.y, p.z, slot._heading ?? slot.actor.heading ?? 0, shape.len, shape.wid, shape.h, shape.off || 0, pad);
            else if (shape.type === 'sphere') t = hitSphere(p.x, p.y + shape.y, p.z, shape.r + pad);
            if (t === Infinity) continue;
            out.push({ f, t, animal });
          }
        }
      }
    }
    stats.cells = _seen.size;
    stats.tested = tested;
    return out;
  }

  // crowds: the region box 1.8 m high, or boxes round up to 64 of its points
  const crowdBoxes = new WeakMap();
  function crowdHits(range, perM) {
    const out = [];
    const entries = runtime?.entries || [];
    for (const entry of entries) {
      for (let ci = 0; ci < entry.crowds.length; ci++) {
        const c = entry.crowds[ci];
        if (!c.shown || !c.crowd) continue;
        const sp = c.spec || {};
        let boxes = crowdBoxes.get(c);
        if (!boxes) { boxes = []; crowdBoxes.set(c, boxes); } else { testCrowd(boxes, entry, ci, c, range, perM, out); continue; }
        if (sp.region?.min && sp.region?.max) {
          const z = Number.isFinite(sp.region.z) ? sp.region.z : (Number.isFinite(sp.region.near) ? sp.region.near : w2m(c.pos).Z);
          const a = m2w(sp.region.min[0], sp.region.min[1], z), b = m2w(sp.region.max[0], sp.region.max[1], z);
          const bx = new Box3().setFromPoints([a, b]);
          bx.max.y += 1.8;
          boxes.push(bx);
        } else if (Array.isArray(sp.points)) {
          for (const q of sp.points.slice(0, 64)) {
            const pt = Array.isArray(q) ? q : q?.pos;
            if (!pt) continue;
            const Z = Number.isFinite(pt[2]) ? pt[2] : (q.near ?? w2m(c.pos).Z);
            const w = m2w(pt[0], pt[1], Z);
            boxes.push(new Box3(new Vector3(w.x - 0.3, w.y, w.z - 0.3), new Vector3(w.x + 0.3, w.y + 1.8, w.z + 0.3)));
          }
        }
        testCrowd(boxes, entry, ci, c, range, perM, out);
      }
    }
    return out;
  }
  const _cb = new Box3();
  /** the ray against a crowd's boxes (each padded by the pick tolerance at its distance) */
  function testCrowd(boxes, entry, ci, c, range, perM, out) {
    let best = Infinity;
    for (const bx of boxes) {
      const dist = bx.distanceToPoint(eye);
      if (dist > range) continue;
      const p = ray.intersectBox(_cb.copy(bx).expandByScalar(dist * perM * 0.5), tmp2);
      if (p) best = Math.min(best, p.distanceTo(eye));
    }
    if (best < Infinity) out.push({ entry, ci, crowd: c, t: best });
  }

  // ---------------------------------------------------------------------------------------- objects
  function objectHits(hit, hitDist, maxDist) {
    const cands = [];
    const hp = hit?.point || null;
    const floorLike = hit?.normal ? hit.normal.y > 0.7 : false;
    for (const e of elementBoxes) {
      const b = e.box3;
      let t = Infinity, pass = false;
      if (hp && hp.x >= b.min.x - PAD && hp.x <= b.max.x + PAD && hp.y >= b.min.y - PAD && hp.y <= b.max.y + PAD && hp.z >= b.min.z - PAD && hp.z <= b.max.z + PAD) {
        // a chamber's floor is its place (the place card), not the chamber as an object
        if (floorLike && e.kind === 'chamber') continue;
        t = hitDist;
      } else if (e.pri <= 2 && !b.containsPoint(eye)) {
        const p = ray.intersectBox(b, tmp2);
        if (p) { const d = p.distanceTo(eye); if (d <= hitDist + 0.3) { t = d; pass = true; } }
      }
      if (t < Infinity) cands.push({ e, t, pass });
    }
    // fires the ray passes through before the occluder (should: 'fire:' refs that objects.js describes)
    const fires = ctx.fx?.fires;
    if (fires && objects) {
      for (const f of fires.values()) {
        if (!(f.cur > 0.05) || !objects[`fire:${f.id}`]) continue;
        const r = Math.max(0.3, (f.size || 1) * 0.6);
        const t = hitSphere(f.pos.x, f.pos.y + r * 0.6, f.pos.z, r);
        // a real intersection only: a sky ray has hitDist = Infinity, and Infinity <= Infinity would pick every lit fire
        if (t < Infinity && t <= Math.min(hitDist + 0.3, maxDist)) cands.push({ fire: f, t, pri: -1 });
      }
    }
    if (!cands.length) return null;
    cands.sort((a, b) => (a.pri ?? a.e.pri) - (b.pri ?? b.e.pri) || (a.e?.vol ?? 0) - (b.e?.vol ?? 0) || a.t - b.t);
    return cands[0];
  }

  // ---------------------------------------------------------------------------------------- labels
  const objTitle = (id) => objects?.[id]?.title?.en || ctx.elOpt?.(id)?.name?.en || id;
  function figureLabel(slot, animal) {
    const a = slot.actor;
    const verb = poseVerb(a.poseName || slot._pose);
    const title = animal ? animalTitle(animal) : roleTitle(a.role || slot.pool.spec?.role);
    return { en: verb ? `${title} · ${verb}` : title };
  }
  function zoneName(id) { return zones?.info?.(id)?.name?.en || id || 'Outside'; }

  function siteOf(v) { const s = w2m(v); return [s.X, s.Y, s.Z]; }
  function zoneAtPoint(v, normal) {
    // a wall hit: step back toward the eye so the point is in the place in front of the wall
    const p = tmp.copy(v);
    if (normal && Math.abs(normal.y) < 0.5) p.addScaledVector(dir, -0.3);
    const s = w2m(p);
    return zones?.atSite?.(s.X, s.Y, normal && normal.y > 0.7 ? s.Z : s.Z - 0.4) ?? null;
  }

  // ---------------------------------------------------------------------------------------- pick
  function pick(clientX, clientY, opts = {}) {
    const t0 = performance.now();
    const tolerancePx = opts.tolerancePx ?? 8, maxDist = opts.maxDist ?? 150;
    const rect = setRay(clientX, clientY);
    rebuildGrid(t0);
    const hit = ctx.physics?.raycast?.(eye, dir, maxDist) || null;
    const hitDist = hit ? hit.distance : Infinity;
    const range = Math.min(maxDist, hitDist + VIS_SLACK + 1);
    const perM = tolPerM(tolerancePx, rect.height);

    const figs = figureHits(range, perM).filter((h) => h.t <= hitDist + VIS_SLACK).sort((a, b) => a.t - b.t);
    const crowds = crowdHits(range, perM).filter((h) => h.t <= hitDist + VIS_SLACK).sort((a, b) => a.t - b.t);
    const obj = objectHits(hit, hitDist, maxDist);
    const screen = { x: clientX, y: clientY };

    const mkFig = (h) => {
      const { slot, entry, pool, index } = h.f;
      const p = slot.actor.object3D.position;
      const w = eye.clone().addScaledVector(dir, h.t);
      return {
        ref: `actor:${entry.id}:${pool.name}:${index}`, kind: h.animal ? 'animal' : 'person',
        label: figureLabel(slot, h.animal), distance: h.t, world: w, at: siteOf(p), zone: zoneAtPoint(p, { y: 1 }), screen,
      };
    };
    const mkCrowd = (h) => {
      const w = eye.clone().addScaledVector(dir, h.t);
      const role = h.crowd.spec?.roles;
      const r0 = typeof role === 'string' ? role : Array.isArray(role) ? role[0] : role ? Object.keys(role)[0] : 'israelite';
      return {
        ref: `crowd:${h.entry.id}:${h.ci}`, kind: 'person', crowd: true, label: { en: `${roleTitle(r0)}s` }, distance: h.t,
        world: w, at: siteOf(w), zone: zoneAtPoint(w, { y: 1 }), screen,
      };
    };

    let out = null;
    const people = [...figs.map((h) => ({ h, t: h.t, fig: true })), ...crowds.map((h) => ({ h, t: h.t, fig: false }))].sort((a, b) => a.t - b.t);
    // individual figures before a crowd at about the same depth
    people.sort((a, b) => (a.t - b.t) + (a.fig === b.fig ? 0 : (a.fig ? -0.6 : 0.6)));
    const firstP = people[0] || null;
    // a figure wins over an object entered up to 0.5 m nearer — and over an opening or curtain the ray only passes
    // through (a figure seen through a gateway or behind a drawn curtain)
    if (firstP && (!obj || firstP.t <= obj.t + PERSON_BEATS || obj.pass)) {
      out = firstP.fig ? mkFig(firstP.h) : mkCrowd(firstP.h);
      const alts = people.slice(1, 1 + MAX_ALT).map((x) => (x.fig ? mkFig(x.h) : mkCrowd(x.h)));
      if (alts.length) out.alternatives = alts;
    } else if (obj) {
      const w = obj.fire ? obj.fire.pos.clone() : (hit && obj.t >= hitDist - 0.01 ? hit.point.clone() : eye.clone().addScaledVector(dir, obj.t));
      const ref = obj.fire ? `fire:${obj.fire.id}` : `el:${obj.e.id}`;
      out = {
        ref, kind: 'object', label: { en: obj.fire ? (objects?.[`fire:${obj.fire.id}`]?.title?.en || obj.fire.id) : objTitle(obj.e.id) },
        distance: obj.t, world: w, at: siteOf(w), zone: zoneAtPoint(w, hit?.normal), screen,
      };
    } else if (hit) {
      const w = hit.point.clone();
      const zone = zoneAtPoint(w, hit.normal);
      if (zone) out = { ref: `zone:${zone}`, kind: 'place', label: { en: zoneName(zone) }, distance: hitDist, world: w, at: siteOf(w), zone, screen };
    }
    stats.last = performance.now() - t0;
    stats.n++;
    return out;
  }

  return {
    pick,
    /** the objects' content (src/data/objects.js): their own pick boxes replace or add to the elements' */
    setObjects(o) {
      objects = o;
      for (const [id, x] of Object.entries(o || {})) {
        if (!x.pickBoxes && x.pick !== false) continue;
        const kind = ctx.elOpt?.(id)?.kind || 'fixture';
        for (let i = elementBoxes.length - 1; i >= 0; i--) if (elementBoxes[i].id === id) elementBoxes.splice(i, 1);
        if (x.pick === false) continue;
        for (const pb of x.pickBoxes) {
          const a = m2w(pb.min[0], pb.min[1], pb.min[2]), b = m2w(pb.max[0], pb.max[1], pb.max[2]);
          const box3 = new Box3().setFromPoints([a, b]);
          const sz = box3.getSize(tmp);
          elementBoxes.push({ id, kind, pri: OBJ_PRI[kind] ?? 0, box3, vol: Math.max(1e-6, sz.x * sz.y * sz.z), own: !ctx.elOpt?.(id) });
        }
      }
    },
    elementBoxes,
    stats,
    figures() { rebuildGrid(performance.now() + 1e6); return figs.slice(); },
    /** world eye + direction of the last pick (debug) */
    get ray() { return { eye: eye.clone(), dir: dir.clone() }; },
  };
}
