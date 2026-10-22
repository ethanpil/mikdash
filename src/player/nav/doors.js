// Door leaves as nav obstacles, opt-in per findPath query. Leaves are not colliders (observers pass them,
// ARCHITECTURE §12), so the nav grid walks through every doorway; a query may ask for shut doors to count as walls
// (night routes that must not pass a locked gate).
//
// Footprint of a door = its leaves in the SHUT pose, as world AABBs. The builders keep the leaves inside their kits:
// InstancedMesh leaf sets beside the 'door:<id>' node (courts, heichal), a leaf object beside it (the Moked gate's
// east leaf), or meshes under the node (the Mount gates). So the door is set open and shut once, the things that moved
// are the leaves, their shut boxes are kept, and the door is set back to its amount (a door with leaf groups at
// different amounts, the Heichal great gate's outer and inner pairs, gets its leaves' poses back). Every door is measured at player
// init (the builders' amounts, before the sim drives any door); one that appears or is replaced later, when first asked.
// A door whose leaves cannot be found this way (the Moked gate's pishpash, a wicket inside a leaf) has no footprint.
// Such a wicket is a hole in its gate's leaf instead: 'door:<gate>.<name>' whose site element <gate> has
// params.<name>.box (the opening). While the wicket is passable for a query, its opening is cut out of the gate's
// shut leaves (Tamid 1:3: the kohanim come in by the pishpash while the gate is locked).
import { Box3, Matrix4, DynamicDrawUsage } from 'three';
import { AMAH } from '../../core/units.js';

/** openAmount at or below this counts as shut for `closedDoors: true` */
export const SHUT_BELOW = 0.05;
/** a wicket's cut is widened so the free gap left for node centres (after the capsule radius) is at least this (m) */
const WICKET_GAP = 0.55;

const M = new Matrix4();
const changed = (a, b, off = 0) => { for (let i = 0; i < 16; i++) if (Math.abs(a[off + i] - b[off + i]) > 1e-6) return true; return false; };

export function createDoors(ctx) {
  const cache = new Map(); // key -> { obj, boxes: Box3[] }
  let gen = 0; // bumped whenever a door is (re)measured: part of walls().sig
  const warned = new Set();

  /** shut-pose leaf boxes (world) of movable `key`, measured by moving the door; [] when no leaf moved */
  function measure(key, o) {
    const ud = o.userData;
    const f0 = +(ud.openAmount ?? ud.amount ?? 0) || 0;
    const own = [];
    o.traverse((c) => { if (c !== o && c.isMesh) own.push(c); });
    const sibs = (o.parent?.children ?? []).filter((c) => c !== o);
    const objs = sibs.filter((c) => !c.isInstancedMesh || c.userData.mkSingle); // mkSingle: a plain mesh drawn as one instance (render/warmup.js)
    const inst = sibs.filter((c) => c.isInstancedMesh && c.instanceMatrix?.usage === DynamicDrawUsage);
    const boxes = [];
    // a door whose leaf groups can stand at different amounts (the Heichal great gate: openGroup('outer'|'inner')) is
    // set back by open(f0) to the first leaf's amount only, so its leaves' poses are put back as they were; the sim's
    // per-group handle caches the amounts it set and would not repair them (player-3-fix r2)
    const grouped = typeof ud.openGroup === 'function';
    const inst0 = grouped ? inst.map((m) => m.instanceMatrix.array.slice()) : null;
    try {
      ud.open(1);
      o.updateWorldMatrix(true, true);
      const ownM = own.map((c) => c.matrixWorld.elements.slice());
      const objM = objs.map((c) => c.matrix.elements.slice());
      const instM = inst.map((m) => m.instanceMatrix.array.slice(0, m.count * 16));
      ud.open(0);
      o.updateWorldMatrix(true, true);
      own.forEach((c, i) => {
        if (!changed(c.matrixWorld.elements, ownM[i])) return;
        const g = c.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        boxes.push(g.boundingBox.clone().applyMatrix4(c.matrixWorld));
      });
      objs.forEach((c, i) => {
        if (!changed(c.matrix.elements, objM[i])) return;
        c.updateWorldMatrix(true, true);
        const b = new Box3().setFromObject(c);
        if (!b.isEmpty()) boxes.push(b);
      });
      inst.forEach((m, i) => {
        const a = m.instanceMatrix.array, s = instM[i];
        m.updateWorldMatrix(true, false);
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        for (let k = 0; k < m.count; k++) {
          if (!changed(a, s, k * 16)) continue;
          m.getMatrixAt(k, M);
          M.premultiply(m.matrixWorld);
          boxes.push(m.geometry.boundingBox.clone().applyMatrix4(M));
        }
      });
    } catch (e) {
      console.warn(`[nav] door ${key}: leaves not measured`, e);
    } finally {
      try { ud.open(f0); } catch { /* the builder's own error, reported above */ }
      if (inst0) {
        inst.forEach((m, i) => { m.instanceMatrix.array.set(inst0[i]); m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); });
      }
    }
    return boxes;
  }

  /** shut-pose leaf boxes (world Box3[], shared — do not mutate) of door `key`, or null (unknown / no leaves found) */
  function footprint(key) {
    const o = ctx.movables?.get?.(key);
    if (!o || typeof o.userData?.open !== 'function') return null;
    let c = cache.get(key);
    if (!c || c.obj !== o) { c = { obj: o, boxes: measure(key, o) }; cache.set(key, c); gen++; }
    return c.boxes.length ? c.boxes : null;
  }

  const keyOf = (id) => { const s = String(id); return s.startsWith('door:') ? s : `door:${s}`; };

  /** gate key -> [{ key: wicket key, box: opening (world Box3) }], from the site model (cached per movable) */
  const wicketCache = new Map();
  function wicketsOf(gateKey) {
    const o = ctx.movables?.get?.(gateKey);
    let c = wicketCache.get(gateKey);
    if (c && c.obj === o) return c.list;
    const list = [];
    ctx.movables?.forEach?.((w, k) => {
      if (typeof k !== 'string' || !k.startsWith(`${gateKey}.`)) return;
      const name = k.slice(gateKey.length + 1);
      const b = ctx.site?.elements?.[gateKey.slice(5)]?.params?.[name]?.box;
      if (!b?.min || !b?.max) return;
      // site amot (X east, Y north, Z up) -> world metres (x east, y up, −z north)
      list.push({ key: k, box: new Box3().set({ x: b.min[0] * AMAH, y: b.min[2] * AMAH, z: -b.max[1] * AMAH }, { x: b.max[0] * AMAH, y: b.max[2] * AMAH, z: -b.min[1] * AMAH }) });
    });
    wicketCache.set(gateKey, { obj: o, list });
    return list;
  }

  /**
   * Leaf box b with the wicket opening w cut out (both world Box3): the parts beside the opening along the leaf and
   * the part over it. The cut is widened so a body of `radius` has a gap of at least WICKET_GAP for its centre.
   */
  function cut(b, w, radius) {
    const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
    const v = sx >= sz ? 'x' : 'z';
    if (w.max[v] <= b.min[v] || w.min[v] >= b.max[v] || w.max.y <= b.min.y || w.min.y >= b.max.y) return [b];
    const thin = v === 'x' ? 'z' : 'x';
    if (w.max[thin] < b.min[thin] - radius || w.min[thin] > b.max[thin] + radius) return [b];
    const widen = Math.max(0, (WICKET_GAP - (w.max[v] - w.min[v] - 2 * radius)) / 2);
    const v0 = w.min[v] - widen, v1 = w.max[v] + widen;
    const out = [];
    if (v0 > b.min[v]) { const p = b.clone(); p.max[v] = v0; out.push(p); }
    if (v1 < b.max[v]) { const p = b.clone(); p.min[v] = v1; out.push(p); }
    if (w.max.y < b.max.y) { const p = b.clone(); p.min[v] = Math.max(b.min[v], v0); p.max[v] = Math.min(b.max[v], v1); p.min.y = w.max.y; out.push(p); }
    if (w.min.y > b.min.y) { const p = b.clone(); p.min[v] = Math.max(b.min[v], v0); p.max[v] = Math.min(b.max[v], v1); p.max.y = w.min.y; out.push(p); }
    return out;
  }

  /**
   * Door keys a query blocks: every door shut at or below `closedDoors` (true = SHUT_BELOW) plus `blockedDoors`
   * (ids with or without 'door:', blocked whatever their amount now), with or without a footprint.
   */
  function blockedSet({ closedDoors = false, blockedDoors = null } = {}) {
    const keys = new Set();
    const thr = closedDoors === true ? SHUT_BELOW : typeof closedDoors === 'number' && Number.isFinite(closedDoors) ? closedDoors : null;
    if (thr !== null) {
      ctx.movables?.forEach?.((o, k) => {
        if (typeof k !== 'string' || !k.startsWith('door:')) return;
        const f = +(o?.userData?.openAmount ?? o?.userData?.amount);
        if (Number.isFinite(f) && f <= thr) keys.add(k);
      });
    }
    if (blockedDoors) {
      for (const id of blockedDoors) {
        const k = keyOf(id);
        if (ctx.movables?.has?.(k)) keys.add(k);
        else if (!warned.has(k)) { warned.add(k); console.warn(`[nav] blockedDoors: unknown door "${id}"`); }
      }
    }
    return keys;
  }

  return {
    footprint,
    keyOf,
    /** measure every door now (player init: the builders' amounts, before the sim moves any) */
    measureAll() {
      ctx.movables?.forEach?.((o, k) => { if (typeof k === 'string' && k.startsWith('door:')) footprint(k); });
    },
    /** door keys a query walls off (blockedSet, only doors with a footprint) */
    select(opts) { return [...blockedSet(opts)].filter((k) => footprint(k)); },
    /**
     * What a query walls: { keys (as select), cut (wicket keys whose openings are cut out of their gate's leaves),
     * boxes (world Box3[]; shared when uncut — do not mutate), sig (a string naming the set) }. A wicket is cut
     * out while the query does not block it itself (closedDoors: open above the threshold; blockedDoors: not named).
     */
    walls(opts, radius) {
      const raw = blockedSet(opts);
      const keys = [...raw].filter((k) => footprint(k)).sort();
      const cutKeys = [], boxes = [];
      for (const k of keys) {
        let bs = footprint(k);
        for (const w of wicketsOf(k)) {
          if (raw.has(w.key)) continue;
          cutKeys.push(w.key);
          bs = bs.flatMap((b) => cut(b, w.box, radius));
        }
        for (const b of bs) boxes.push(b);
      }
      return { keys, cut: cutKeys, boxes, sig: `${gen}:${keys.join('|')}#${cutKeys.join('|')}` };
    },
  };
}
