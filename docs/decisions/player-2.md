# Player 2 — nav and walking on the real world

Task player-2: newel stairs in the nav, goal snapping by level, long multi-level walks, far terrain heights, startup cost,
coverage test. Supersedes the matching bullets of `player.md` where noted.

## Nav layers (src/player/nav/multi.js, nav/index.js)

- **Three kinds of layer stitched into one graph instead of one 0.5 m grid**: the 0.5 m main grid; ≈4 cm "fine" patches
  (main cell / 12) over the site's winding stairs; a 2 m "outer" layer over the far ground out to the far targets, with
  0.5 m "near" patches (±12 m) round each far target. A finer layer's rectangle is aligned to its parent's cells and
  those parent cells stay empty (`cfg.exclude`), so every place belongs to one layer. Stitches link each parent node
  in the ring of cells round a child rectangle to the child nodes along the shared edge: same floor within a step plus
  the slope over the distance, and the floor continuous in two probes between them. Components and the coarse guidance
  graph are global. — Why: a 0.3 m capsule has a 7–12 cm band between a newel (r 0.24 m) and the shaft (0.91–0.98 m).
  No 0.5 m cell centre falls in it, and a whole-site grid fine enough would be ~100× larger. — Alternative: explicit
  helix links built from the builders' spiral parameters. Those are builder internals: the courts builder enlarges the
  site.js stair boxes (r 1.95 in a 3-amah box). Turret doors and landings would still need fine cells.
- **Fine regions are read from site.js, not hard-coded.** They are:
  - stair elements whose params say spiral/winding/newel (`azarah.underground.stair`);
  - params objects of any element that do (`azarah.gate.mayim.house.roofStair`, `azarah.chamber.medichin.mesibah`), together with the element itself;
  - rooms whose `params.stair` names such a stair (`azarah.moked.chamber.tevilah-descent`);
  - chambers that carry another chamber on their roof whose floor is not a walking datum (the Nitzotz exedra under Beit HaNitzotz; the Water Gate house under Beit Avtinas).

  Each is grown by 1.5 amot. The datum rule keeps out the Pinchas/Chavitin chambers at +13.5 over the music cellars (a 47 m strip for nothing). — Alternative: detect newels in the geometry (stacked small step surfaces); thresholds were fragile (a 3-storey chamber looks the same in a column count).
- **Fine layers bridge 1-cell cracks**: a cell with no surface within 0.3 m below a level that both of its opposite
  neighbours stand on gets a floor there. — The Nitzotz, Water Gate and Medichin stairs end with their top step 0.05
  amah (2.4 cm) inside the square hole they rise through. A 4 cm cell centre in that crack cut the stair off from the
  floor above. A walker steps across it.
- **Far ground**: the outer layer's extent is the bounding box of anchors, zone stands and event viewpoints outside the
  main grid (+40 m). The UI's targets come from `nav.targets`, loaded at player init from `zones-content.js` /
  `schedule.js` (read-only), or from `ctx.zones` / `ctx.schedule`. It is capped at 450 k cells and skipped with a
  warning beyond that. 2 m cells, `climbOrth` 2 m (links over 0.4 m are probed every 0.5 m, each ≤ a step). — Why:
  three stands (Kidron bed, Parah causeway, Har HaMishchah) lay 130–730 m outside the old grid and always ended in a
  fade-hop. — Alternative: widen the 0.5 m grid (≈2.7 M cells).
- **Main grid keeps up to 6 levels per cell (was 4)**. At medium detail the ta'im columns under the aliyah landing
  hold 5 floors (+22, +33, +44, roof +55, landing +67). Lowest-first truncation dropped the landing, and the aliyah
  became unreachable on medium and above. `stats.fullCells` counts columns at the cap.
- **Goal and start snapping keep to the requested level**: the nearest-node metric is plan² + 2·dy² within ±0.4 m, and
  plan² + 16·dy² beyond (symmetric). A floor one storey (3.5 m) up or down counts like 14 m in plan, so a point in the
  music cellars snaps to the cellar, not to Ezrat Yisrael over it. A walker on a roof edge also starts on the roof,
  not on the storey below (a cause of multi-level walks "stopping midway"). — Was: 9·dy² above, 2·dy² below (a floor
  3.5 m below counted like 5 m in plan). `landing()` for fliers kept the old asymmetric rule; superseded by a trip-time
  ranking with a level-move check (player-2-fix.md).
- **Memory**: per-node component and coarse ids are stored as 16-bit when they fit, and the A* open/closed marks share
  one array. Low tier: 892 k nodes, 26.7 MB (was 629 k nodes, ≈24 MB, one layer).

## Walking (goto.js, controller.js, physics.js)

- **Progress projection rejects only segments whose height RANGE is > 1.2 m from the body**, not segments whose
  interpolated height is. A string-pulled segment runs from a stair head straight to a far node (the Chuldah tunnel:
  stair then level passage), so its chord can be metres above the stair the body is on. The point-height test froze
  progress, the carrot fell behind and the walker oscillated, then hopped. Stuck-hops now land on the floor nearest
  the body's own height, not at the chord's height in mid-air. Pitch looks at the floor 4 m ahead, not the chord.
- **Arrival needs the goal's level (|Δy| < 0.6 m)**: a stacked path (a newel stair whose top is over its foot) can pass
  over or under its end in plan.
- **Newel stairs**: the carrot is the farthest point along the path whose skipped vertices stay within 7 cm of the
  line from the feet, so it never aims across the newel. The view aims along the stair (12 cm). Speed is capped at
  2 rad/s of turning (mean turning over the next 1.5 m), so the view keeps up and "turn in place" never triggers
  mid-stair. On a 0.6 m newel radius this is ≈1.2 m/s, before the stair slowdown.
- **Ground probe ring = the capsule radius (0.3 m, was 0.22), first ray along the motion**: the six ring rays at 60°
  missed the narrow wedge of a newel step approached from its open outer edge. The capsule touches the next step's
  0.48 m face from 0.247 m, so the body stood against it with nothing to climb onto. Rays start 0.4 m above the feet,
  so a two-riser step is still never climbed.
- **`{at:[X,Y,Z]}` with nothing at that level right there**: when the only floor in the column is more than 0.5 m
  ABOVE Z (a wood pile, a table), the target moves to the nearest spot within 1.5 m with a floor within 0.35 m of Z
  (e.g. the Etz chamber stand sits on the wood stack). A floor below Z is kept, because the Z is then a ground estimate.

## Physics

- **`floorAt(x, z, fromY)` beyond the colliders' extent answers from the site's terrain height field**
  (`world/terrain/height.js` `getTerrain(ctx).heightASL`, read-only). The terrain collider ends at the tier's draw
  distance (2.5 km on low), and env samples 350 m – 4 km for the horizon profile.

## Startup (HD 4600, dev server, headless Edge)

- Measured: low 97.5 k collider triangles, BVH 95–270 ms; medium 198 k, BVH 245–390 ms (main thread, once). BVH leaf
  size 10/16/24 made no reliable difference (130–240 ms offline), so the build is unchanged. Nav worker (all 8 layers):
  offline Node warm 2.3 s low / 2.9 s medium, cold 3.9–4.3 s; in the browser 5–13 s, competing with the first frames'
  shader compiles. Graph 26.7 MB, JS heap ≈140 MB total.
- **(Superseded by player-2-fix.md: the worker is now spawned at init and started on `ready`.)** **The nav build still starts two frames after `ready`.** Started at player init, it was ready ~0.6 s before the
  first interactive frame, but that frame came ~2 s later: the worker competes with shader compilation on 4 cores.
  `goTo` already waits for `nav.ready`. — Alternative: start at init (nav ready sooner, first paint later).
- Build cost cut where it was waste: typed-array copies instead of `Uint16Array.from` (iterator) and array pushes in
  the soup clip.

## Geometry found blocking (not player-side; in the report's requests)

- The Moked winding stair is capped by the Mount pavement (surface at Z 0 across the shaft X 201.25–205.25, Y 406.5–411.5).
- The Water Gate terrace walk is blocked between the stair top and Beit Avtinas. (Corrected in player-2-fix.md: site.js and the builder now use the narrowed tank X 217.75–221.25, Y 258.5–261; the blocker is elsewhere.)
- The chel strips inside the soreg between the N/S gate flights are sealed. The soreg opens only at the flights, and the flights' cheek walls close the chel.
- The Har HaMishchah stand (low tier) sits on a 1 m platform with no steps.
- The Heichal roof (+112) is reached by climbing the cedar posts (Middot 4:5): no walking route, by design.
