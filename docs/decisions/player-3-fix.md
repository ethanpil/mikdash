# Player 3 fix — floors at a figure's level, shut doors in nav (review findings)

Task player-3-fix: the player-3-review findings on `standFloor(x, z, nearY, true)` (physics.js `levelFloor`) and the
nav shut-door options. Format: **choice** — why — alternative. Heights in amot; the review's scripts are in
shots/player-3-review/.

## levelFloor: the tier order (findings 1, 2)

- **The floor for feet expected at y is chosen in this order:**
  1. the standable floor nearest y in y − 2 … y + 0.8 (unchanged);
  2. open ground at the feet's level (y − 0.5 … y + 0.8) with an underside ½ amah or more over it, before the next
     standable floor (the pavement under a table: undersides 1.1–1.4 over it);
  3. the lowest standable floor up to 1.5 over y;
  4. a surface of the spot's own column at the feet's level, with open floor at that height ½ or 1 amah away and
     no ring floor between that height and the floor over the spot (a column plinth, a pillar's foot, a vessel's
     base, a pile's edge);
  5. the lowest standable floor up to 2.5 over y;
  6. as 4, 2½ amot away (a thick base: the kiyor);
  7. the nearest standable floor, the one below unless it is more than twice as far as the one above;
  8. a walkable surface at the feet's level, else the top surface.

  — Why: player-3's tier 2 took any up-facing surface in the band, so the court under a stair and a stair's buried
  faces beat the tread over them. Its tiers 4 and 5 always preferred the floor below, however far.
  The column profiles that decide the order (shots/player-3-review probes):
  - inside a closed stair the court face is inside the solid;
  - under an open-shell stair it has treads over it but no underside;
  - under a table it is open with an underside (marble tables: 16 / 17.2 down / 17.5).

  Columns, pillars and piles look like stairs in one column. What tells them apart is beside the spot: a stair has
  steps between the level and the tread over the spot, and an obstacle has a sharp edge. — Alternatives:
  - the review's order (open surface, tread ≤ 1.5, covered surface last). It still sinks the G5 walker at
    (275.29, 334.18) 2 amot under the 8 tread, and puts a hint 0.8–2.5 under a tread on the court under the stair
    when the stair is an open shell with a soffit;
  - a plain ring test (open floor within 1 amah at the level). It fired on stairs: the Korban flight at hint 6.5
    found the 7 tread 2½ amot away and placed the figure inside the flight.
- **The ring tier needs a surface at the level in the spot's own column** (an up-face, or a solid's bottom face such
  as the kiyor base's). — Why: without one, the night-watch officer over a 13 tread at hint 15.5 was placed in mid-air
  at the next step's height (15.5).
- **An underside closer than ½ amah to the ground is a seam, not a table.** — Why: a step block north of the Heichal
  floats 0.064 amah over the pavement at (121.37, 399.41), which read as a table and put hint 16 inside the 17 step.
- **The 1.5 and 2.5 reaches are inclusive past float32 rounding (+0.1 mm).** — Why: 1.5 amot is 0.72000003 m in the
  column buffer, so the NE corner stair's 1.5 tread fell out of reach at hint 0.
- **Rejected sub-point (finding 2): (3.06, 490.96), hint 0 → 0, not the 5 tread.** — Evidence (column dump): the
  ground there is open at the hint's own height under a soffit 3.44 amot (1.65 m) up, and the 5 tread is 2.4 m over
  the walker's expected feet. The torch bearer is offset sideways from a route on the ground (night-watch.js `offset`),
  so his feet belong on the ground. The same holds at (496.88, 493.01): the soffit is 1.39 over the ground and the
  tread 2.5 over it. That is a caller offset under a stair; neither answer is right, and the hint's level is the
  requested one.

Results (low):
- **Reviewer's weekday recording** (record-calls.js, 2,647 distinct sim calls): 2,642 equal the old rule. The 5 that
  differ are intended:
  - the Gazit column, 16 (was the roof 36);
  - a G5 spot at a pillar by Nikanor, 13.5 (was a roof at 33.5);
  - the wood pile's edge on the altar, 25 / 25.03 (was the pile top 26.8; twice);
  - the soffit case above, 0.

  player-3 had 23 differing calls, 14 of them sunk into stairs.
- **Reviewer's site sweep** (floor-sweep.js, 1.9 M probes):
  - BURIED-step: 10,422 → 0 (5 before the seam rule, all at the seam above).
  - buried-vs-cap: 12,773 → 4,063, mostly datum hints at the foot of tall walls (0 at the foot, not the wall top 56).
  - below-cap: 21,694 → 2,691, mostly a hint of 67 in the Ulam (the floor 22, not the roof 112).
  - Cost: 0.018–0.036 ms per call by machine load (old rule 0.011).
- **src/player/dev/level-doors.js** passes:
  - 25 floor cases, including every point the review named;
  - a chord sweep across the whole width of the Ulam steps (lines along X every ½ amah) and the 15 steps (radial
    every 10°, and E–W lines). It runs the chord, 1 amah under it and 1 over it: 13,536 samples, all on the tread.
    The exception is 6 samples 1 amah under the chord at the Ulam steps' side edge, 0.1 amah below the court beside
    the stair, which give that court (accepted there only);
  - shots/player-3-fix/steps15-new.png = steps15-old.png (walkers on the treads), and ulam-new.png (the kohen on
    the 18.5 tread).

## G2's ways check (finding 6)

- **level-doors.js §3 runs G2's §2 ways check with `nearestFloor`** (the old rule, which reads a table, pile or pillar
  top), until G2 switches its own test (request filed again). Tables still give the pavement under `standFloor(…,
  true)`, by request. Result: 102,240 samples, none off the floor. G1's Gazit plinth places no longer show; they
  would be listed as known.

## Shut doors: wickets, snapping, cut ways (findings 3, 4, 5)

- **A wicket is a hole in its gate's leaf** (doors.js `walls`). It applies to a door `door:<gate>.<name>` whose site
  element `<gate>` has `params.<name>.box`; today that is the Moked gate's pishpash. While a query does not block the
  wicket itself, its opening is cut out of the gate's shut leaf boxes: the parts beside it along the leaf, and the
  part over it.
  - With `closedDoors`, the wicket passes while open above the threshold. With `blockedDoors`, it passes unless named.
  - The cut is widened so the gap left for a body's centre is at least 0.55 m (the 2-amah wicket leaves 0.36 m after
    the capsule radius; the main grid is 0.5 m). The widening is 0.095 m each side, and the leaf is not a collider.
  - `nav.lastCut` names the wickets cut.

  — Why: Tamid 1:3, the kohanim come in by the pishpash while the gate is locked, which is the night route this option
  exists for. Result: gate shut, pishpash open, `closedDoors` → 4.5 m through the wicket (was null); pishpash shut →
  null. — Alternative: give the pishpash its own footprint and subtract it in markBlocks (needs holes in the marks).
- **The start and the goal snap off the shut leaves, on their own side of each leaf.** A node is accepted only if
  it is free and the straight step from the point to it does not cross a leaf's mid-plane within the leaf's span
  (`crosses`). — Why: player-3 opened the whole door when the start's node was in a doorway band. A start 1 amah
  outside the shut Tadi gate at Z 0, with the ground 2 amot lower, snapped into the doorway band, so the route went
  through the leaves. Now it detours 686 m; a start inside the Nikanor doorway leaves backwards (225 m round by Beit
  HaMoked). — Alternative: unblock only the band nodes on the start's side. The snap still crosses when the far
  side's node is nearer in height.
- **Shut doors split the coarse graph for the query** (`buildOverlay`). Each coarse node holding walled nodes is split
  into the local components of its free nodes. Their edges come from those nodes' fine links (either direction) and
  stitches. Distances come from a door-aware Dijkstra from the goal: an infinite one is a cut way (null at once), and
  a finite one steers the A* round the detour. The marks and the overlay are kept while queries repeat the same wall
  set (`walls().sig`). This replaces player-3's A* (60 k) + two-ended flood + full A*. — Why: the bound player-3
  documented did not hold. Its flood ran out of budget when both sides were large (start → Kidron 545 ms), and a
  detour misled by the door-blind heuristic took 1.3 s. Measured on low at 02:30 (a 2026 weekday):

  | query | player-3 | now |
  | --- | --- | --- |
  | closedDoors, start → Kidron (cut) | 545 ms | 33–51 ms |
  | closedDoors, EN → Azarah (cut) | 170 ms | 0.5 ms |
  | Heichal great gate + N wicket blocked (cut) | 55 ms | 2–5 ms |
  | Shushan blocked, outside it → the Mount (detour) | 1,338 ms (1,269 m) | 27–32 ms (1,278 m) |
  | each door blocked with its wickets, front → back (94 queries) | — | 0–37 ms |
  | Nikanor + wickets blocked, EN → Azarah (207 m) | 20–48 ms | 29–69 ms (first query of a wall set builds its overlay) |
  | default (no options), EN → Azarah | 57.8 m | 57.8 m (unchanged) |

  The first query of a new wall set also marks the blocks and builds the overlay; later ones reuse them. — Alternatives:
  door-aware component labels per wall set (a whole-graph flood, ~900 k nodes, on every new set); bounding the fallback
  A* (cut ways still flood up to the bound).
- **The A* weight is 1.25 with shut doors (1.1 otherwise).** — Why: a detour round the Mount hugs walls. Their
  near-edge cost (×1.35) is not in the coarse distance, so with 1.1 the 1.27 km detour round the shut Shushan expanded
  157 k nodes (204–573 ms, by machine load). With 1.25 it expands 12.8 k (22–47 ms), and the paths stay within 1% of
  the 1.1 lengths (Shushan 1,272–1,278 m vs 1,271 m, Nikanor 258 vs 257 m, others equal). Queries without door
  options keep 1.1, so their routes are unchanged. — Alternative: 1.4 (8.6 k expansions, no faster in time).
- player-3.md's tier list, start-in-doorway rule and timing table are superseded by this log (a note is added there).

## Checks (low, HD 4600)

- `npx vite build` passes (output deleted).
- `node tools/nav-coverage.mjs --q low` and `--q medium`: 130 of 132, console clean. The 2 failures are the Heichal
  roof (no walking route, Middot 4:5).
- Real-time walks (shots/player-2-fix/walk.mjs, shots/player-3/cases.json): all 7 arrive, no falls, the Parvah roof's
  one hop as before, console clean. Door footprints at init: 10 ms.
- Sim tests: navwest.js all 12 legs; g1-night.js "t=n3" no failures, deterministic on the three dates, cues once,
  0 jump calls (1 pop at 00:00 on Friday and Shabbat: a 43 m hand-over between altar-night and moked-night, in plan,
  not floors or nav; altar-night.js is being edited by another group); g2.js deterministic, ways 0 of 102,240 off,
  no face twice, no hand-over gap, cues once, no warnings.
- level-doors.js, the reviewer's record-calls.js and floor-sweep.js: as above.

## Second review (player-3-review r2)

Format as above. Scripts and outputs: shots/player-3-fix/r2/.

- **Finding 1 (cost at 09:19 on the 15 steps): the ring test stops at the first step it finds.** In `besideLevel`, a
  ring floor above the feet's band (over y + 0.8 + 0.35) and under the floor over the spot (fa − 0.35) is a step
  between that level and the tread. That rejects the ring tier whatever level it would find, because the level found is
  never above y + 0.8, so the scan returns at once. The full scan already ended in the same null. — Why: G5's walkers
  on the 15 steps are hinted at Z 6. Each call scanned all 16 ring points (and 8 more at 2½ amot) before rejecting,
  while the first point downhill already lands on the next tread (rise and depth ½ amah, Middot 2:5).
  Measured by recording the sim's exact floor calls over 240 real-time frames and replaying them
  (perframe-replay.js, replay-after.js; date 2026-11-02, low):

  | moment | calls | before | now | old rule (nearestFloor) | results changed |
  | --- | --- | --- | --- | --- | --- |
  | 09:19 | 1,363 | 0.056 ms/call (0.32 ms/frame) | 0.020 ms/call (0.12 ms/frame) | 0.011 ms/call | 0 |
  | 14:05 | 102 | 0.011 | 0.011 | 0.008 | 0 |
  | 21:20 | 720 | 0.009 | 0.008 | 0.009 | 0 |

  The reviewer's live perframe.js at 09:19: 0.16–0.17 ms/frame, p95 0.3–0.4 (the old rule 0.13, p95 0.3; review
  0.47–0.50). The ring tier can still scan all 16 points (~0.2 ms) when it finds no floor at the level and no step,
  e.g. a hint 1.5–2.5 under a raised floor with a buried face at the hint (the review's (83, 396) probe). No sampled
  moment makes those calls every frame.
  — Rejected alternatives:
  - an exact-input memo: none of the 2,185 recorded calls repeats its inputs (walkers move every frame), so it would
    never hit;
  - a per-actor or quantized (x, z, y) memo: standFloor has no actor, and a quantized key changes results at stair
    edges.

  The caller-side fix stays with G5: pass the interpolated Z on stair legs (request filed). Those calls then take tier
  1 (0.01 ms).
- **Finding 3 (a late re-measure moved the Heichal great gate's inner leaves): a grouped door's leaf poses are put
  back.** `measure()` keeps the dynamic leaf sets' instance matrices of a door that has `userData.openGroup`. After
  `open(f0)` (which sets every leaf to the outer leaf's amount, and keeps `openAmount` and the kit's own `l.f` of
  leaf 0 right), it writes those matrices back, so each leaf has the pose it had before. The inner leaves' internal
  `f` is then stale, but the kit reads it only after setting it again (`setOpen`), and `openAmount` reads the outer
  leaf. The sim handle's per-group cache therefore matches what is shown. — Why: gates.js drives `setGroup('inner')`
  and `setGroup('outer')` at different times, and the handle caches the last amounts, so a late re-measure left the
  inner pair wrong until its amount next changed. It could not happen today, since every door is measured at init
  (9 ms), but a rebuild that replaces a movable would trigger it.
  — Check (level-doors.js, new last block): outer 0.3, inner 0.8, then a fresh `createDoors(ctx)` measures the gate.
  Result: no leaf set changed, openAmount 0.3 → 0.3, and the 4 boxes equal the init footprint. With `openGroup`
  hidden (the old path), the same check sees the leaf set move (replay-after.js), so the test catches the bug.
  — Alternative (the review's first choice): the builders' `userData.closedBoxes()`, which nav would read without
  moving the door. It is still requested; the player does not read it yet, as no builder has it.
- **Finding 2 (stale API text): docs/API.md now has a player-3 / player-3-fix entry built from the code on disk.** It
  covers levelFloor's 8 tiers, nearestFloor, findPath's door options (wicket holes, snapping, cut ways, the 1.25
  weight for door queries only), lastBlocked, lastCut, doorFootprint and buildTimes['player.doors'].
  standFloor's old line there now names the exact rule. ARCHITECTURE.md is the orchestrator's: its §12/§14 lines
  are filed as a request with the text to use.
- **Finding 4 (the night-watch torch bearer under the NW corner stair): rejected for the player; no change.** It is
  the same case as the soffit sub-point above. At (3.06, 490.96) hint 0, the ground is open at the hint's level
  under a soffit 3.44 amot up, and the 5 tread is 2.4 m over the route. The torch bearer is offset sideways
  (night-watch.js:123, `R.path.offset(…, ±TORCH_SIDE, …)`) from a ground route under the stair. Neither floor is
  right for him, and the hint's level is the rule that was asked for. A request to night-watch's owner is filed:
  clamp the offset off stair footprints, or drop it where the ground under the route has a soffit lower than a body.

Checks after these changes (low unless named; the machine was shared, CPU about 85% busy):
- `npx vite build`: passes (output deleted).
- nav-coverage: low and medium 130 of 132, console clean. The 2 failures are the Heichal roof, which has no walking
  route (Middot 4:5).
- level-doors.js: ok, no failures:
  - floors: 25 cases;
  - sweep: 13,536 samples, 0 bad (6 edge samples, accepted);
  - ways: 0 of 102,240 off;
  - doors: 47 footprints; door routes as in the table above (cut 0.5–30 ms; Shushan detour 22 ms; the 94 per-door
    queries at most 42 ms);
  - the re-measure check passes.
- Sim tests:
  - navwest.js: all 12 legs.
  - g1-night.js "t=n3": no failures; deterministic on the three dates; cues once; 0 jump calls. The 1 pop at 00:00
    on Friday and Shabbat is the known in-plan hand-over.
  - g2.js (weekday): deterministic; ways 0 of 102,240 off; no face twice; no hand-over gaps; no doubled cues; no
    warnings.
- Real-time walks (cases from shots/player-3): all 7 arrive with no falls, the Parvah-roof walk makes its one hop,
  and the console is clean. One run had 51 ms and 23 ms player frames on the two newel-stair walks; a re-run of both
  had a 3.8 ms max. The player never calls levelFloor, so those frames were machine load.
- Shot: shots/player-3-fix/r2/date-2026-11-02_at-290-330.5-6_look-270-4_t-09_19.png. The G5 walkers stand on the
  15 steps' treads, as in the review's steps15-09-19.png.
