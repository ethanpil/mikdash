// DEV FIXTURE (player task only) — a coarse, temple-like maze used to benchmark the nav grid and A* on
// long multi-level routes while the real builders are stubs. NOT research data, never imported by the
// app: load it from a test page with `await import('/src/player/dev/fixture.js')`.
// Layout is schematic (site amot): Mount walls with gates, a lower eastern approach with steps up to the
// Shushan gate, soreg + chel steps, Ezrat Nashim (+6), 15 steps to Nikanor (+13.5), Azarah (+16), altar
// with a ramp, Ulam steps to the Heichal (+22) with its door, a colonnade and an underground passage.
import { Group } from 'three';
import { StaticBatcher, siteBoxGeometry } from '../../world/geom.js';

const AX = 250; // E–W axis (site Y) of the fixture

export function buildFixture(ctx) {
  const b = new StaticBatcher(ctx, 'player-fixture');
  const box = (min, max, mat = 'ashlar_plain') => b.add(siteBoxGeometry(min, max), mat);
  const wallX = (x0, x1, y0, y1, z0, z1, gaps = [], mat) => { // wall running along Y with gaps [y0,y1]
    let y = y0;
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > y) box([x0, y, z0], [x1, g0, z1], mat); y = g1; }
    if (y < y1) box([x0, y, z0], [x1, y1, z1], mat);
  };
  const wallY = (y0, y1, x0, x1, z0, z1, gaps = [], mat) => { // wall running along X with gaps [x0,x1]
    let x = x0;
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > x) box([x, y0, z0], [g0, y1, z1], mat); x = g1; }
    if (x < x1) box([x, y0, z0], [x1, y1, z1], mat);
  };
  const stairs = (axis, from, to, across0, across1, z0, n, rise, zBase) => { // n steps along ±X/±Y
    const dir = Math.sign(to - from), tread = Math.abs(to - from) / n;
    for (let i = 0; i < n; i++) {
      const a0 = from + dir * i * tread, a1 = to;
      const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      const top = z0 + (i + 1) * rise;
      if (axis === 'X') box([lo, across0, zBase], [hi, across1, top], 'steps_stone');
      else box([across0, lo, zBase], [across1, hi, top], 'steps_stone');
    }
  };

  // ground: Mount interior at 0, lower approach east of the Mount at -6, lower ground elsewhere outside
  // Mount slab, carved around the underground passage (X 246..330, Y AX+95..AX+99)
  box([0, 0, -12], [500, AX + 95, 0], 'paving_mount');
  box([0, AX + 99, -12], [500, 500, 0], 'paving_mount');
  box([0, AX + 95, -12], [246, AX + 99, 0], 'paving_mount');
  box([330, AX + 95, -12], [500, AX + 99, 0], 'paving_mount');
  box([506, 150, -12], [650, 350, -6], 'paving_mount');
  box([-150, -150, -20], [650, 0, -14]); box([-150, 500, -20], [650, 650, -14]); box([-150, 0, -20], [0, 500, -14]);
  box([506, 0, -20], [650, 150, -14]); box([506, 350, -20], [650, 500, -14]);
  // steps from the approach (-6) up to the Shushan threshold (0): 12 steps, tread 1
  stairs('X', 518, 506, AX - 15, AX + 15, -6, 12, 0.5, -12);
  // Mount walls (6 thick, 40 high above the Mount) with gates
  const wallMat = 'herodian_wall';
  wallX(500, 506, -6, 506, -20, 40, [[AX - 5, AX + 5]], wallMat); // east, Shushan
  box([500, AX - 5, -12], [506, AX + 5, 0], 'paving_mount'); // Shushan threshold
  wallX(-6, 0, -6, 506, -20, 40, [[300, 310]], wallMat); // west, Kiponus (exit drops to the lower ground)
  wallY(-6, 0, 0, 500, -20, 40, [[100, 110], [200, 210]], wallMat); // south, Chuldah
  wallY(500, 506, 0, 500, -20, 40, [[250, 260]], wallMat); // north, Tadi
  // a colonnade along the south wall (stoa columns)
  for (let x = 20; x < 480; x += 12) for (const y of [15, 30]) box([x - 1, y - 1, 0], [x + 1, y + 1, 30], 'marble_white');
  box([10, 5, 30], [490, 35, 32], 'cedar');

  // soreg (10 tefachim ≈ 1.67 amot) ring with openings, chel steps east of Ezrat Nashim
  const sx0 = 95, sx1 = 455, sy0 = 160, sy1 = 340;
  wallY(sy0, sy0 + 0.4, sx0, sx1, 0, 1.67, [[150, 160], [250, 260], [350, 360]], 'marble_white');
  wallY(sy1 - 0.4, sy1, sx0, sx1, 0, 1.67, [[150, 160], [250, 260], [350, 360]], 'marble_white');
  wallX(sx1 - 0.4, sx1, sy0, sy1, 0, 1.67, [[AX - 8, AX + 8]], 'marble_white');
  wallX(sx0, sx0 + 0.4, sy0, sy1, 0, 1.67, [], 'marble_white');
  stairs('X', 447, 441, AX - 20, AX + 20, 0, 12, 0.5, -1); // 12 steps ½×½ up to +6

  // Ezrat Nashim (+6): X 306..441 (135), walls 6 thick
  box([306, AX - 67.5, -1], [441, AX + 67.5, 6], 'paving_azarah');
  wallX(435, 441, AX - 73.5, AX + 73.5, 6, 46, [[AX - 5, AX + 5]], wallMat); // east gate
  wallY(AX - 73.5, AX - 67.5, 306, 441, 6, 46, [], wallMat);
  wallY(AX + 67.5, AX + 73.5, 306, 441, 6, 46, [], wallMat);
  // a chamber in the NE corner with an upper floor (multi-level)
  box([405, AX + 27.5, 6], [435, AX + 28.5, 22]); box([405, AX + 28.5, 6], [406, AX + 67.5, 22]);
  box([405, AX + 27.5, 14], [435, AX + 67.5, 15]);

  // 15 steps (½×½) from +6 up to the Nikanor threshold +13.5 at X 306
  stairs('X', 313.5, 306, AX - 20, AX + 20, 6, 15, 0.5, -1);
  // Azarah east wall with Nikanor gate (X 300..306)
  wallX(300, 306, AX - 73.5, AX + 73.5, -1, 46, [[AX - 5, AX + 5]], wallMat);
  box([300, AX - 5, -1], [306, AX + 5, 13.5], 'paving_azarah');
  // Ezrat Yisrael (+13.5) X 289..300, then 5 steps to the Azarah (+16)
  box([289, AX - 67.5, -1], [300, AX + 67.5, 13.5], 'paving_azarah');
  stairs('X', 289, 286.5, AX - 67.5, AX + 67.5, 13.5, 5, 0.5, -1);
  box([113, AX - 67.5, -1], [286.5, AX + 67.5, 16], 'paving_azarah');
  wallY(AX - 73.5, AX - 67.5, 107, 300, 16, 46, [[200, 210]], wallMat);
  wallY(AX + 67.5, AX + 73.5, 107, 300, 16, 46, [[200, 210]], wallMat);
  wallX(107, 113, AX - 73.5, AX + 73.5, -1, 46, [], wallMat);
  // altar 32×32×10 with a ramp from the south
  box([216, AX - 30, 16], [248, AX + 2, 26], 'lime_whitewash');
  for (let i = 0; i < 16; i++) box([226, AX - 62 + i * 2, 16], [238, AX - 30, 16 + (i + 1) * 0.625], 'lime_whitewash');

  // Ulam steps: 12 steps rise ½, tread ~1.83 from X 198 down to 176, Heichal floor +22
  stairs('X', 198, 176, AX - 20, AX + 20, 16, 12, 0.5, 15);
  box([113, AX - 50, 15], [176, AX + 50, 22], 'paving_azarah');
  // Heichal shell: walls 6 thick around the Kodesh (interior X 125..165, Y 240..260), door 10 wide on the east
  wallX(165, 171, AX - 26, AX + 26, 22, 122, [[AX - 5, AX + 5]], wallMat);
  wallX(119, 125, AX - 26, AX + 26, 22, 122, [], wallMat);
  wallY(AX - 26, AX - 10, 119, 171, 22, 122, [], wallMat);
  wallY(AX + 10, AX + 26, 119, 171, 22, 122, [], wallMat);
  box([165, AX - 5, 42], [171, AX + 5, 122], wallMat); // lintel above the 20-high door
  box([119, AX - 26, 62], [171, AX + 26, 64], wallMat); // ceiling slab (aliyah floor)
  box([119, AX - 26, 120], [171, AX + 26, 122], wallMat); // roof

  // underground passage: from a stair-pit near the north soreg opening, down 8 amot, east under the Mount
  stairs('X', 262, 246, AX + 95, AX + 99, -8, 16, 0.5, -12); // down-stair (rising westward from -8 to 0)
  box([246, AX + 95, -12], [330, AX + 99, -8], 'paving_mount'); // tunnel floor
  box([262, AX + 95, -3], [330, AX + 99, 0], 'paving_mount'); // tunnel roof = Mount surface (two levels)
  return b;
}

/** Replace the current colliders with the fixture (test pages only), rebuild physics + nav. */
export async function installFixture(ctx, { hideOthers = true } = {}) {
  if (hideOthers) {
    ctx.colliders.length = 0;
    for (const c of [...(ctx.world?.children || [])]) c.visible = false;
  }
  const b = buildFixture(ctx);
  const g = new Group();
  g.name = 'player-fixture';
  g.add(b.build());
  ctx.world.add(g);
  return ctx.physics.rebuild();
}
