// World builder: mount — Har HaBayit (owner: build-mount).
//   floor (paving_mount) · four walls with Herodian set-out/drawn-in courses (walls.js) · five gates with gold-plated
//   doors (movables 'door:<gate id>'), Tadi's leaning stones, Shushan HaBirah with its relief and the two amot
//   (gates.js) · the double stoas (stoas.js) · soreg, chel and its 12 steps (soreg.js) · the Mount chambers
//   (chambers.js) · the Parah causeway, Kiponus bridge, Chuldah passages, Tadi steps (approaches.js) ·
//   watch-post torches, anchors (posts.js).
// Every dimension comes from ctx.el(...) (src/data/site.js); see docs/decisions/build-mount.md for the design choices.
import { Group } from 'three';
import { Kit } from './kit.js';
import { buildWalls } from './walls.js';
import { buildGates, buildShushanChamber } from './gates.js';
import { buildStoas } from './stoas.js';
import { buildSoreg, buildChelSteps } from './soreg.js';
import { buildChambers } from './chambers.js';
import { buildApproaches } from './approaches.js';
import { buildPosts, registerAnchors } from './posts.js';

export async function build(ctx) {
  const t0 = performance.now();
  const detail = ctx.quality?.detail ?? 1;
  const group = new Group();
  group.name = 'mount';
  const kit = new Kit(ctx, 'mount');

  const chamber = ctx.el('mount.gate.shushan.chamber').box;
  const app = buildApproaches(ctx, kit, group, detail);          // first: it knows the floor openings (Chuldah stairwells)
  buildFloor(ctx, kit, app.floorHoles);
  buildWalls(ctx, kit, detail, { copingGaps: [[chamber.min[1], chamber.max[1]]] });
  buildGates(ctx, kit, group, detail);
  buildShushanChamber(ctx, kit, detail);
  const stoas = buildStoas(ctx, kit, group, detail);
  buildSoreg(ctx, kit, detail);
  buildChelSteps(ctx, kit, detail);
  buildChambers(ctx, kit, detail);
  buildPosts(ctx, kit, detail, app.chuldah);
  registerAnchors(ctx, app);

  group.add(kit.build());
  group.userData.stats = {
    batchedTris: Math.round(kit.tris), columns: stoas.columns, gateBays: stoas.bays.length,
    causeway: { upperArches: app.cw.upper, lowerArches: app.cw.lower, arcadeEnd: Math.round(app.cw.arcadeEnd * 10) / 10 },
    kiponusStreetX: Math.round(app.kip.streetX * 10) / 10, ms: Math.round(performance.now() - t0),
  };
  group.userData.causewayRegions = app.cw.regions;
  return group;
}

/** The pavement of the 500 x 500 (mount.floor), with the Chuldah stairwells left open. Tiled so no triangle spans the Mount. */
function buildFloor(ctx, kit, holes = []) {
  const f = ctx.el('mount.floor').box;
  const [x0, y0] = f.min, [x1, y1] = f.max, z = f.max[2];
  const xs = new Set([x0, x1]), ys = new Set([y0, y1]);
  for (const h of holes) { xs.add(h[0]); xs.add(h[2]); ys.add(h[1]); ys.add(h[3]); }
  const TILE = 50;
  for (let v = x0 + TILE; v < x1; v += TILE) xs.add(v);
  for (let v = y0 + TILE; v < y1; v += TILE) ys.add(v);
  const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b);
  for (let j = 0; j + 1 < Y.length; j++) {
    for (let i = 0; i + 1 < X.length; i++) {
      const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2;
      if (holes.some((h) => cx > h[0] && cx < h[2] && cy > h[1] && cy < h[3])) continue;
      kit.quad([[X[i], Y[j], z], [X[i + 1], Y[j], z], [X[i + 1], Y[j + 1], z], [X[i], Y[j + 1], z]], [0, 0, 1], 'paving_mount', { castShadow: false });
    }
  }
}
