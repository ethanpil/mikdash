// Climbs: the places the observer reaches only by climbing, where no walkable surface joins two levels. Today one:
// the two cedar posts in the door of the aliyah, "by which they went up to the roof of the aliyah" (Middot 4:5;
// site.js heichal.aliyah.door params.cedarPosts, postsTopZ). A climb is a link of the nav graph: findPath joins
// the walk to its foot, the climb (via) and the walk on from its top, and marks the joined path with
// `climb: { i0, i1 }` (pts[i0] = via[0] … pts[i1] = via[last]). goto.js walks the legs and climbs the via.
// Choices: docs/decisions/qa-r1-player.md.
import { Vector3 } from 'three';
import { m2w, a, AMAH, EYE_HEIGHT } from '../../core/units.js';
import { BODY } from '../controller.js';

/** a climb's top level: a goal within this height (m) of it is "up there" (and a start, for the way down) */
const LEVEL_M = 1.5;
/** amot searched inward from a post for the first clear spot on its top level, and up from the top for the crossing */
const TOP_REACH = 8, CROSS_REACH = 8, STEP = 0.25;
/** a findPath end counts as reaching q within these (goto.js arrive's rule) */
const REACH_PLAN = 1.0, REACH_DY = 0.5;

export const reaches = (p, q) => {
  const e = p && p[p.length - 1];
  return !!e && Math.hypot(e.x - q.x, e.z - q.z) <= REACH_PLAN && Math.abs(e.y - q.y) <= REACH_DY;
};

export function createClimbs(ctx, physics) {
  let list = null, ver = -1;
  const ray = (p, q) => { const d = q.clone().sub(p), L = d.length(); return L < 1e-3 || !physics.raycast(p, d, L); };
  /** a standable, clear spot for the body at feet level y (world) at (x, z), or null */
  const standAt = (x, z, y) => {
    let f = null;
    for (const h of physics.floorsAt(x, z)) if (Math.abs(h - y) <= 0.2 && (f === null || Math.abs(h - y) < Math.abs(f - y))) f = h;
    if (f === null || physics.insideAt(x, f + 0.05, z)) return null;
    const v = new Vector3(x, f, z), fit = v.clone();
    physics.collideCapsule(fit, BODY.radius, BODY.stepUp, BODY.height);
    return Math.hypot(fit.x - x, fit.z - z) > 0.02 ? null : v;
  };

  /** The climb up the post at site (X, Y, Z) to topZ, or null when its foot, top or way is not clear. */
  function postClimb(id, X, Y, Z, topZ) {
    // the side the top level lies on (the post stands outside the wall it rises along)
    const off = 0.3 + (BODY.radius + 0.08) / AMAH; // the post's radius (site.js / heichal tube 0.3) + the body's
    for (const [ix, iy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      let top = null;
      for (let s = off; s <= TOP_REACH && !top; s += STEP) {
        const w = m2w(X + ix * s, Y + iy * s, topZ);
        top = standAt(w.x, w.z, w.y);
      }
      if (!top) continue;
      const fw = m2w(X - ix * off, Y - iy * off, Z);
      const foot = standAt(fw.x, fw.z, fw.y);
      if (!foot) continue;
      // the lowest feet height from which the body passes level from the post onto the top spot
      let cross = null;
      for (let z = topZ; z <= topZ + CROSS_REACH && cross === null; z += STEP) {
        const y = a(z);
        if ([0.1, 0.5, 1.0, EYE_HEIGHT + 0.15].every((dy) => ray(new Vector3(foot.x, y + dy, foot.z), new Vector3(top.x, y + dy, top.z)))) cross = y;
      }
      if (cross === null) continue;
      // the column the eye rises in, beside the post, is open
      if (!ray(new Vector3(foot.x, foot.y + 1, foot.z), new Vector3(foot.x, cross + EYE_HEIGHT + 0.15, foot.z))) continue;
      const via = [foot, new Vector3(foot.x, cross, foot.z), new Vector3(top.x, cross, top.z), top];
      return { id, foot, top, via, heading: (Math.atan2(ix, iy) * 180) / Math.PI };
    }
    return null;
  }

  function build() {
    const out = [];
    for (const [id, e] of Object.entries(ctx.site?.elements || {})) {
      const P = e?.params;
      if (!Array.isArray(P?.cedarPosts) || !Number.isFinite(P.postsTopZ)) continue;
      P.cedarPosts.forEach(([X, Y, Z], k) => { const c = postClimb(`${id}#${k}`, X, Y, Z, P.postsTopZ); if (c) out.push(c); });
    }
    return out;
  }

  return {
    /** the climbs (built on first use, again after the colliders change) */
    get list() {
      if (!list || ver !== physics.version) { list = build(); ver = physics.version; }
      return list;
    },
    /**
     * A path from → to through a climb when the walk alone does not reach `to`: up when the goal is on a climb's top
     * level, down when the start is. find(a, b) is the plain nav query. Returns the joined path (with .climb) or null.
     */
    route(from, to, find) {
      for (const c of this.list) {
        const up = Math.abs(to.y - c.top.y) < LEVEL_M && Math.abs(from.y - c.top.y) >= LEVEL_M;
        const down = !up && Math.abs(from.y - c.top.y) < LEVEL_M && Math.abs(to.y - c.top.y) >= LEVEL_M;
        if (!up && !down) continue;
        const [A, B, via] = up ? [c.foot, c.top, c.via] : [c.top, c.foot, [...c.via].reverse()];
        const p2 = find(B, to);
        if (!reaches(p2, to)) continue;
        const p1 = find(from, A);
        if (!reaches(p1, A)) continue;
        const pts = [...p1, ...via.map((v) => v.clone()), ...p2];
        pts.climb = { i0: p1.length, i1: p1.length + via.length - 1, id: c.id, heading: c.heading }; // toward the post
        return pts;
      }
      return null;
    },
  };
}
