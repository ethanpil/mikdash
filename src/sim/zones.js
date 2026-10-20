// ctx.zones (ARCHITECTURE §8): which named place the observer stands in. Geometry from site.js (zoneAtSite: the
// highest-priority, then smallest, containing box), content from src/data/zones-content.js when it exists.
import { SITE, zoneAtSite, zoneGeometry, CANONICAL_ZONES } from '../data/site.js';
import { w2m } from '../core/units.js';

/** the feet sit ON the floor plane: test a point just above it (same offset as the UI's own fallback) */
const FEET = 0.4; // amot

export function createZones(ctx, mod) {
  const content = mod?.ZONE_CONTENT || mod?.default || null;
  const ids = [...new Set([...(CANONICAL_ZONES || []), ...Object.keys(SITE.zones || {}), ...Object.keys(content || {})])];
  const cache = new Map();
  const zones = {
    /** zone id the observer is in (string) or null */
    current: null,
    /** ZONE_CONTENT, or null while src/data/zones-content.js is missing */
    content,
    /** every known zone id */
    list: ids,
    /** merged { id, ...geometry (boxes, priority, floorZ), ...content } or null */
    info(id) {
      if (!id) return null;
      if (cache.has(id)) return cache.get(id);
      const g = zoneGeometry(id), c = content?.[id];
      const r = g || c ? { id, ...(g || {}), ...(c || {}) } : null;
      cache.set(id, r);
      return r;
    },
    /** zone id at a world position (feet) */
    at(worldPos) {
      if (!worldPos) return null;
      const s = w2m(worldPos);
      return zoneAtSite(s.X, s.Y, s.Z + FEET);
    },
    /** zone id at a site point (amot) */
    atSite(X, Y, Z = 0) { return zoneAtSite(X, Y, Z + FEET); },
  };
  return zones;
}

/** throttled tracker of the observer's zone → ctx.zones.current + bus 'zone:change' { zone, prev } */
export function trackZones(ctx, zones, hz = 5) {
  let acc = Infinity;
  const check = () => {
    const p = ctx.player?.position;
    if (!p) return;
    const id = zones.at(p);
    if (id === zones.current) return;
    const prev = zones.current;
    zones.current = id;
    ctx.bus.emit('zone:change', { zone: id, prev });
  };
  ctx.bus.on('player:arrived', () => { acc = Infinity; });
  return (dt) => {
    acc += dt;
    if (acc < 1 / hz) return;
    acc = 0;
    check();
  };
}
