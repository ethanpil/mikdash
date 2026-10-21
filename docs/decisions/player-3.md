# Player 3 — floors at a figure's level, shut doors in nav

Task player-3: the choreography groups' requests (choreo-g2-altar-fix.md "Ways and floors", choreo-g1-night.md "nav
ignores doors"). Format: **choice** — why — alternative.

> Superseded in part by player-3-fix.md (review findings): the `levelFloor` tier order below sank walkers into stairs;
> a start in a shut doorway no longer opens the door; the A* + two-ended flood is replaced by a door-aware coarse graph
> (its "5–180 ms" bound did not hold: start → Kidron took 545 ms, a 1.27 km detour 1.3 s).

## `standFloor(x, z, nearY, true)`: the floor at the hint's level (physics.js `levelFloor`)

- **With `exact` and a hint, the floor is chosen in this order** (amot):
  1. the standable floor nearest the hint between hint − 2 and hint + 0.8;
  2. else the highest walkable surface in that band (no clearance needed: a column plinth, the pavement under a
     table or dwarf pillar), unless a standable floor lies within ¾ amah over it;
  3. else the lowest standable floor up to 1.5 above the hint;
  4. else the highest standable floor below the band;
  5. else the lowest above.

  — Why: the old rule was "nearest on any level", and it lost to whatever stood over the spot. Measured on low:
  - inside a Gazit column at (82.5, 375.5), near 16: was 36 (the roof), now 16.3 (the plinth top);
  - on a nanas at (203, 383.75), near 16: was 20 (the cedar cap), now 16.25.

  The beam (18.6) and the table tops (17.5) are more than 0.8 over a court-level hint, so they lose too.
  — Alternative: return null where nothing is standable at the level, so callers keep their authored Z. Rejected:
  a hint of 0 over a solid court (gates.js and night-watch.js default Z to 0 or 22) must still find 16, and the
  courts' fill has no buried surfaces (probed), so tier 5 finds it.
- **Tier 2 skips a surface with a standable floor within ¾ amah over it.** — Why: stairs have buried tread faces.
  On the Ulam steps at X 184 a face at 21 lies under the 21.5 tread. A chord hint of 20.64 would otherwise sink the
  figure half a step into the stair. ¾ amah is just over one ½-amah riser. — Alternative: tier 3 before tier 2. That
  puts a figure hinted 0.3 above the pavement onto a table top 1.2 above it.
- **Tier 3 reaches 1.5 amot above the hint, but only when nothing lies in the band.** — Why: a straight chord from
  the Ulam steps' head to their foot runs up to 0.82 under a tread (X 187.5: chord 19.68, tread 20.5). Without
  tier 3 the figure dropped to the floor under the steps (16). With tiers 2 and 3, chord hints sampled every 0.5 amah
  along the Ulam steps give the same floor as before at all 132 points. — Alternative: widen the band to 1 amah.
  That still fails a 0.9 deviation, and it brings table tops into reach of a hint 0.5 above the pavement.
- **Consequence (by request):** a hint at the foot's level held over a whole stair leg now gives the foot's level
  mid-stair (Ulam X 196, near 16: 16, inside the stair; was the 17.5 tread). Callers on stairs must pass the
  interpolated Z, as G2's `Script` legs and `SitePath` samples already do.
- **The player keeps its own rule.** The player now calls the new `nearestFloor(x, z, y)` (the old exact rule) for:
  goTo targets with a Z, the stuck-hop, the pitch probe 4 m ahead, the newel-stair view, and leaving a solid. —
  Why: those probes start from a string-pulled chord or the body's height, which can sit metres below the floor ahead
  (a chord from a stair foot to a far node), so "at or below" would aim the view and hops at the wrong level. Same
  results as before: nav-coverage 130/132 on low (the 2 failures are the Heichal roof, which has no walking route
  by design), and the walk cases.
- Non-exact `standFloor` (datum floors) and `floorAt` are unchanged. People's `setSite(X, Y, {near})` uses the
  non-exact form and is not affected. The sim's `floorZ` / `placeNear` get the new rule.

## Shut doors in nav (nav/doors.js, nav/index.js)

- **Opt-in per query: `findPath(from, to, { closedDoors, blockedDoors })`.** With no options the path is identical
  (EN → Azarah: 57.8 m, 2042 expansions before and after). — `closedDoors: true` walls every `door:*` at
  openAmount ≤ 0.05 (a number sets the threshold). `blockedDoors` walls the doors named, whatever their amount,
  because a plan for a later time must not depend on how the doors stand now. — Alternative: a graph-wide door
  state (a rebuild per change, and every caller would share one state).
- **A door's footprint is its leaves in the shut pose, found by moving the door.** The builders keep leaves in kit
  internals, in three forms:
  - an InstancedMesh leaf set beside the `door:` node (courts, heichal);
  - a leaf object beside the node (the Moked gate's east leaf);
  - meshes under the node (the Mount gates).

  So each door is set open, then shut. The leaves are what moved; their shut boxes are kept, and the door is set
  back. This is done for all doors at player init, at the builders' amounts and before the sim drives any door
  (the heichal great gate's outer and inner groups are still uniform then). It took 8–41 ms on low. 47 of 48 doors
  give boxes matching their openings. The pishpash has none: its leaf sits inside the gate's leaf, so the gate covers
  it. — Alternatives considered:
  - the site element's box: it is a whole chamber for chamber doors, a wall for the ta'im door, and missing for six
    doors;
  - rays from the node: the node sits on a jamb for the wickets and the aliyah door;
  - a builder-side `closedBox` (requested).
- **Blocking marks nodes, not links.** A node is marked when a body there would touch a shut leaf:
  - in plan, the box grown by the capsule radius;
  - in height, the body's 1.75 m overlapping the leaf, and the leaf not low enough to step over.

  The grown box is at least 0.6 m deep, more than a 0.5 m cell, and a link moves one cell, so no route crosses it.
  String pulling (`los`) and the goal snap respect the marks.
- **A start inside a shut doorway leaves that door open for the query; a goal inside one snaps to the nearest free
  cell**, and its exact endpoint is not put back inside the leaves.
- **A way cut by shut doors: A* stops at 60 k expansions, then a flood from both ends in turn decides.** Components
  ignore doors, so a failing A* flooded the start's whole side. Measured on low:

  | query | before | after |
  | --- | --- | --- |
  | closedDoors at 04:36, Ezrat Nashim → Azarah | 421 ms / 241 k expansions | 181 ms |
  | Heichal great gate + north wicket blocked | 1081 ms / 793 k expansions | 55 ms |
  | Heichal → Azarah, all shut | — | 5 ms |
  | Nikanor and both wickets blocked (connected: 205 m via Beit HaMoked) | — | 20–48 ms |

  The flood's cost is at most twice the smaller side, typically a court closed by its gates. — Alternative:
  door-aware components or coarse graph per query (a rebuild of the block components each time).
- Curtains are never blocked: kohanim pass the parochet and the gate curtains.
- Memory: block marks are 16-bit per node (1.8 MB on low) and the flood's queues are 1.6 MB. Both are allocated on
  the first door-aware query; plain queries never allocate them.

## Checks (low, HD 4600)

- `npx vite build` passes.
- `src/player/dev/level-doors.js` (run with `node src/sim/dev/run.mjs --q low --script src/player/dev/level-doors.js "t=04:30"`) checks the floor cases and the door options above; it passes.
- `tools/nav-coverage.mjs` passes 130 of 132 targets on low and on medium. The 2 failures are the Heichal roof, which has no
  walking route by design. No console errors.
- Real-time goTo walks (shots/player-2-fix/walk.mjs, cases in shots/player-3/cases.json) all arrive, with no
  falls and a clean console. The cases cover:
  - start → aliyah;
  - the Nitzotz newel stair, up and down;
  - the Moked → underground passage;
  - the Parvah roof (one hop, as in player-2-fix);
  - the Ulam steps;
  - Ezrat Nashim → Azarah.
- Sim tests:
  - navwest.js: all legs found;
  - g1-night.js: no failures, deterministic on three dates, no pops or duplicates, every cue once;
  - g2.js: deterministic, cues once, no faces twice. Its ways check flags 2 of 102,250 samples: gazit-shema's
    k4 and k16 stand on the column plinths (floor 16.30 at Z 16), where they used to read the roof at 36. This is
    G1's known third-lottery circle issue.
- Shots: shots/player-3/at-86-378-16_* (the Gazit at the Shema: rows on the floor among the columns) and
  at-212-377-16_* (flaying at the nanasin: everyone on the pavement, none on the caps).

## Requests

- **g2 (src/sim/dev/tests/g2.js §2):** the ways check used `standFloor(…, true)` to catch a way that runs through
  a table, pile or pillar: it read the obstruction's top. Now it reads the level under the obstruction (by request),
  so tables no longer show. To keep catching them, use `ctx.physics.nearestFloor(x, z, y)` (the old rule) or
  `floorsAt`.
- **Builders (courts, heichal, mount):** optional `userData.closedBoxes()` on door movables (shut leaves, world or
  site boxes). The nav would use it instead of moving the door once at init. The pishpash could then report its
  wicket too.
