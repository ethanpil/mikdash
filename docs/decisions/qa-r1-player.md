# qa-r1-fix-player — decisions

Fixes from the first QA round in src/player/** (PLR-1 … PLR-3). Format: **Choice** — why — alternative.
Shots and scripts: shots/qa-r1-fix-player/ (before/, after/, climb/), src/player/dev/goto-frame.js, src/player/dev/climb.js.

## PLR-1 — the opening view

- **The spawn heading belongs in the `start` anchor (src/world/mount/posts.js:74, heading 270), not in the player:
  requested from world as 270 → 250; the player is unchanged.** The player only falls back to 270 when an anchor has
  no heading; `start` sets one. ARCHITECTURE §5 gives the anchor's facing to the mount builder, and the anchor is used
  by nothing but the spawn. — Alternative: a player-side START_LOOK overriding the anchor; rejected, two sources for one
  number.
- **250, not 255 or 260.** Measured with `look=` on the unchanged build (low and high, 04:36 on 2026-11-02, pitch 10):
  250 puts the Ezrat Nashim gate (with the smoke column lit by the altar fire through it) on the right third, and the
  Ezrat Nashim SW corner tower and the south colonnade with its two lit torches on the left. 255 keeps only a sliver of
  the colonnade and one torch; 260 loses it; 270 is the flat symmetrical wall. Shots: l-h250/255/260, h-h250/255 against
  l-default / h-default. Nothing moves in the frame at 04:36 either way: that is SIM-2 (officer patrol timing).

## PLR-2 — how a goTo arrives

- **The +10° came from `instant` keeping the current pitch when the target sets none: the spawn's pitch is 10, and the
  UI's targets (ui/data.js viewTarget, sim viewOf) never carry one.** Walking arrivals eased to 0. Now every ground goTo
  arrives with a set pitch: the target's, else toward its `look` point, else ARRIVAL.pitch = −4°, the same for instant
  and walked arrivals. `teleport()` is unchanged (a raw placement keeps the view). — Alternative: keep the current pitch
  on instant; rejected, the reported bug.
- **New optional goTo target field `look`: the point to watch, site [X, Y, Z?] amot (Z omitted = the walking floor
  there) or a world Vector3.** The player cannot find an event's position from `{ at, heading, label }`, so the event
  position has to come with the target. Requested from ui (data.js viewTarget) and sim (schedule.js viewOf): add
  `look: <the event's pos as site [X, Y, Z]>`. Without it the arrival still gets the −4° default and the figure checks
  along the heading (below), but not the computed pitch. — Alternative: the player looks the event up by its label in
  ctx.schedule; rejected, a string match on titles.
- **Pitch toward `look`: atan of (look.Z + 0.5 m − eye) over the plan distance, clamped −25…+10°.** The 0.5 m: an event's
  point is the floor its people stand on, so aiming at the floor put standing people in the top third of the frame (the
  Sanhedrin view from 3.4 m clamped at −25° with the heads at the top edge); 0.5 m centres seated and kneeling people
  and keeps sleepers just below the middle. Measured: Moked −13.2° (was +10), Sanhedrin −18.3°, gate-levites +10 (the
  clamp: the Levites are 14 m off and 3.6 amot up the steps — that view is DATA-2's). — Alternative: the literal
  floor point; rejected for the reason above.
- **A stand is rejected when a figure is within 0.8 m (plan) of it (1.3 m from a lying figure's pelvis: the sleepers'
  bodies reach ~0.9 m each way; animals half their length + 0.35 m), or when a standing figure's body (radius 0.3 m)
  comes within 6° of the sight line short of its last 1.5 m; then the nearest clear point on rings 0.5 m apart out to
  3 m is taken.** The 6° cone, not just a ray: at the Sanhedrin a scribe 1.25–1.4 m in front, 12° off the line, still
  filled the middle of the frame, and a bare ray (radius 0.3) let the stand slide just past him. The last 1.5 m are the
  action itself (the people of the event). Lying figures only count for clearance (they are under the eye line). — The
  sight line is to `look`; without it, to the floor 4 m along the arrival heading.
- **A ring point must have a floor at the stand's level (±0.35 m), fit the body, have no wall between it and the data's
  stand (rays at knee and eye height), see the look point when the data's stand does, and lie within 0.5 m of a nav
  node; of a ring's clear points the one whose distance to `look` is nearest the original's is taken (the framing keeps
  its scale), without `look` the one farthest from the figures.** A given heading is turned by the change in bearing to
  `look`, so the data's framing offset is kept. — Alternative: always face `look`; rejected, the data's heading frames
  deliberately (DATA-2 owns the bad ones).
- **Figures are read from ctx.people.actors and ctx.people.system.crowds (world arrays, poseName).** The crowd members
  are not in the public API; system is exposed on ctx.people and read defensively. — Alternative: ask people for a public
  figures() query; not needed for one reader.
- **Walks check again on arrival (once): the figures moved during the walk, so a stand found blocked then is walked on
  to the nearest clear ring point.** At a paused clock the walked and the instant arrivals land on the same spot
  (Sanhedrin 45.93, 378.82 vs 46.25, 378.93; Moked unchanged).
- Results (low, 2026-11-02; shots/qa-r1-fix-player/before → after):
  - Sanhedrin d4: was behind a standing figure at 1.25 m, pitch +10; with `look` it moves 1.0 m to (46.25, 378.93),
    heading 73 (data 90, turned with the bearing), pitch −18.3, the semicircle of elders framed by the two scribes; without
    `look` (today's UI) it moves 0.5 m and the centre of the frame is clear, pitch −4.
  - Moked n3: pitch −13.2 with `look`, −4 without; the sleepers and the hearth are in frame (they were cut off the bottom).
  - gate-levites d4: unchanged stand, pitch +10 (clamp) with `look`, −4 without; the Levites stay small: DATA-2.
  - Cost: the framing runs once per goTo, 1–5 ms on low (instant goTo resolved in 1–5 ms including it).

## PLR-3 — the Heichal roof

- **The roof is reached by climbing the cedar posts at the aliyah door, as Middot 4:5 says ("in the door of the aliyah
  were two cedar posts, by which they went up to the roof of the aliyah"), so nav gained climb links instead of a stair
  or hatch route.** A walkable connection up to +112 would contradict the source; nulling roof.stand would take a real,
  described place off the Go list. — Alternatives: a stair through the aliyah (no source); data sets roof.stand to
  null (the map would then say the roof has no floor, which is false).
- **A climb is read from the site: every element with params.cedarPosts and postsTopZ (today heichal.aliyah.door).**
  For each post: the side where the top level lies (a clear spot on the post's top level within 8 amot, searched along the
  four axis directions), the foot on the other side (post radius 0.3 amah + body radius + 8 cm off the post, a clear
  standable spot at the post's foot), the crossing height (the lowest feet height from which rays at 0.1/0.5/1.0/1.77 m
  pass level from the climb column to the top spot) and an open column for the eye. The east post's foot is on the
  landing's cheek (floors 55 / 68.5), so only the west post (X 132.25) is used. — Alternative: hard-coded coordinates;
  rejected, they would not follow the amah standard.
- **The crossing is at +116, over the ma'akeh (+115) and the kalya orev (+116): the model's parapet and blade run
  unbroken round the roof, and the posts stop at +112 (site.js postsTopZ).** The rays find the lowest clear height, so
  if world opens the ma'akeh above the posts (a reconstruction it may want: one did not climb over an iron blade), the
  climb will step through at +112 with no player change. Requested from world, optional.
- **findPath joins the walk to the foot, the climb and the walk on from the top when the walk alone does not reach the
  goal and the goal (up) or the start (down) is on a climb's top level (±1.5 m); the path carries `climb: { i0, i1, id,
  heading }`.** Both extra queries run only then (13–34 ms on low for the whole plan), so the sim's routes are untouched.
  tools/nav-coverage.mjs therefore sees the roof reached with no change to the tool.
- **goTo walks the legs and climbs the via at the walking speed, easing in and out (fast: 33 s from the ta'im-roofs stand
  to the roof stand, 33 s back).** The view faces out from the wall on the post (−12°: the courts and the city open out
  below as one rises) and the way ahead across the parapet (−6°). Facing the post was tried first: ten seconds of a
  brown cylinder filling the frame. `ctx.player.path` now returns the whole path, climb included, so the map's route
  line shows the way to the roof, not only the first leg.
- Results: the roof stand [170, AX, 112] is planned through the west post from both nav-coverage origins under naeh,
  feinstein and chazonish (the walk alone ended at +67, or +22 under chazonish); the goTo up and down both arrive.

## Harness fixture

- **level-doors.js "start in the shut Nikanor doorway" now starts at X 257.5 (in the passage), not 259.75.** Since
  world-4 (6229608) the leaves hang at the gate's east face, X 259.47–260.04, so the old point was inside the shut
  leaves, which have no side to step back to: null in 1.4 ms (it found 225.1 m on 10-20). From the passage it finds
  225.3 m again. The climb wrapper cannot touch this case (neither end is near +112). — Open question, not changed: a
  walker standing inside a shut leaf (doors do not collide) gets no door-aware path and hops.

## Verification (low, HD 4600)

- `node tools/nav-coverage.mjs`: 132 targets, ALL REACHABLE (was 2 failures: the roof from both origins).
- `src/player/dev/level-doors.js`: floors, sweep (13,536 samples, 0 bad), doors all pass; one failure outside the player:
  the sim's terumat-hadeshen brother0#1 leg at (192.0, 315.0) Z 16 where the nearest floor is 2 (by the altar's SW corner).
- `src/ui/dev/uitest.mjs`: ALL PASSED (Go instant, map double-click walk, cancel). `src/sim/dev/tests/navwest.js`: ok.
- `npx vite build`: passes.
- `src/player/dev/goto-frame.js` (instant, with and without `look`, and walked) and `src/player/dev/climb.js` (plans
  under all three amot; the trips up and down) as above. No console errors in any run.
