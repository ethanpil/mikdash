# Player 2 fix: review findings on flying, startup, the newel-stair view and the coverage tool

Task player-2-fix: the reviewer's findings on player-2. Supersedes the matching bullets of `player-2.md`.

## Fliers' landing (nav/index.js `landing`, `NavGraph.landingNode`; goto.js)

- **The landing spot must be reachable the way the glide actually moves.** The glide moves level at the flier's
  height over the spot, then straight down. So besides the open column (the old check), the level move must be
  clear: nine rays at feet +0.3 m, waist and eye height, on the centre line and at ±0.3 m. — Why: a flier at
  [180, 330.5, 60] bound for the court glided 12+ frames through the Ulam facade onto the ta'im roof.
  — Alternative: a swept capsule. Nine rays cost ≈0.1 ms per candidate and catch the cases found.
- **Candidates are ranked by trip time, not by distance from the flier**: cost = glide length (plan + drop) +
  walkK · the walk left to the goal. The walk comes from the coarse graph (max(coarse distance − slack, octile), as
  A*'s heuristic), and walkK = glide speed / walk speed = max(5, 3v)/v (goto.js passes it). — Why: the old metric
  (plan² + 2·dy² below) put a roof 14 m away ahead of the court 19 m straight down, then walked 68 s down the ta'im
  stairs. Now the case lands on the court and arrives in 21 s. — Alternative: prefer floors straight below. That
  still lands on the wrong side of a wall when the goal is beyond it.
- **A blocked level ray rules out its 0.5° direction bin beyond the hit**, so a wall facing many candidates costs
  one set of rays. Budgets are 4000 column tests and 160 ray tests. If the budget runs out, the floor straight below
  the flier is used. — Why: with only a test cap, a flier outside the Azarah S wall spent its 250 tests on court
  nodes under the chamber roofs and hopped; so did one inside the Ulam. Landing queries now take 5–28 ms, once per
  goTo.
- The old asymmetric snapping branch of `nearestNodeM` (9·dy² above, 2·dy² below), used only by landing, is removed.

## Startup (nav/index.js, player/index.js)

- **The nav worker is spawned at player init and handed the build on `ready`, before the first frame.** — Why,
  measured at 1280×720 low on the HD 4600:
  - The first frame after `ready` blocks the main thread for 25–47 s of shader compiles, at any viewport (also
    480×270).
  - Started two rAFs after `ready` (the old order), the worker began only after that frame. Nav was then ready
    4–15 s after the first interactive frame (baseline: frame end 51.4 s, nav 55.4 s).
  - Spawned on `ready` itself, it still did not start until the frame ended (worker start 50.8 s against a frame end
    of 50.6 s): loading a module worker's scripts needs the main thread.
  - Spawned at init and posted on `ready`, the worker ran during the frame (9.1 → 13.3 s), and nav was ready when
    the frame ended: low 42.05 / 42.00 s and 33.63 / 33.59 s, medium 39.40 / 39.32 s, 480×270 33.95 / 33.94 s and
    37.70 / 37.60 s (nav ready / frame end).
  - The first frame was no slower: 24.4–33 s with the early worker, against 24.9–47 s with the old order.

  The earlier choice (player-2.md: "starts two frames after `ready`") rested on a ~2 s first-frame delay at a
  small viewport. It did not reproduce. — Alternative: say in the UI that goTo is pending. No longer needed, since
  nav is ready at the first interactive frame.
- `ctx.buildTimes['player.nav']` is the worker's own build time (`stats.workerMs`; main-thread fallback:
  `totalMs`). `nav.stats.totalMs` stays the wall time from start to adoption, which now includes waiting for the
  first frame.

## Newel-stair view (goto.js walk phase)

- **On a winding stair the view looks across the curve and down at the treads**, not along the walk and the slope.
  "Winding stair" means: the path turns faster than 0.8 rad/m over the next 1.5 m, and the floor 1.2 m on is more
  than 0.3 m from the feet's level. Then:
  - yaw aims at the path 0.8 m on;
  - pitch aims at the tread 1.2 m on from the eye, plus 0.35 × half the vertical FOV, clamped to −46°…−3°.

  Measured on low, per stair frame (`shots/player-2-fix/viewbody.js`):
  - **Climbs:** pitch +14° → −29…−32° (median); frames with no tread within 6 m in a 9×7 ray grid 36–41 → 0–1;
    tread share 0 → 8–11 %.
  - **Descents:** pitch −18° → −46°; frames with no tread 26–32 → 0–1; tread share 0 → 3 %.
  - The straight Ulam steps are unchanged.

  — Why: the shaft wall is ≈0.75 m ahead along the walking line, and the treads 0.4–1.2 m on lie 37° (climbing) to
  79° (descending) below the eye. The reviewer's suggested clamp of −5…0° still shows only wall: treads appear only
  below about −15°. Static frames on the Nitzotz stair showed the treads clearly at −25…−30° with the view aimed
  0.8 m on.
  — Alternative: keep the view along the walk (yaw error median 6–9°, now 13–17°). The treads then sit at the frame
  edge or out of it.
- On descents, the −46° clamp keeps the treads only in the bottom quarter of the frame. Going lower would point the
  view at the feet.

## Coverage tool (tools/nav-coverage.mjs)

- A zone with `stand: null` (zones-content.js sets this on purpose for `ulam-upper`, which is built as solid masonry)
  is reported as `no-stand`, listed separately, and not counted as a failure. Before, it printed
  `[undefined] … goal undefined`. The schedule-data request about ulam-upper is withdrawn.
- The nav line prints the worker's build time and the time to ready.

## Geometry requests, corrected

- **Water Gate terrace:** site.js now has the narrowed tank (X 217.75–221.25, Y 258.5–261), and the courts builder
  (azarah.js) already builds it to that box. The terrace itself is clear: X 213.5–221.25 along the walk is one
  walkable component, and it reaches Beit Avtinas's door. Probed at 0.1 amah (`shots/player-2-fix/terrace.js`), the
  break is at the stair head:
  - a 0.1–0.15-amah crack at X ≈ 221.35–221.45 runs along the terrace edge (the stair box starts at 221.3);
  - the top tread (+36) is only a wedge south of Y 261.5 (X 221.5–222.2 at Y 261.0–261.2, narrowing to X 221.7 at
    Y 261.5);
  - in the band where the capsule fits between the tank face (Y 261) and the parapet (Y 262.6), Y 261.6–262.0, the
    well's NW corner X 221.4–221.8 is open down to +16; the treads there are at +35.5 from X 221.8 east.

  The walker could straddle a ~15 cm gap, but nav does not bridge more than one fine cell (4 cm). A route across an
  open well should come from a landing in the geometry, not from looser nav. site.js says the stair's "last step [is]
  turned west onto the terrace walk". — Alternative: let fine layers bridge gaps of up to ~7 cells at the same level.
  Rejected: it would also bridge real slots beside stair wells.
- **Kidron ↔ Parah causeway:** reachable, but only by a long walk (≈578 m, ≈447 s at 'walk') for targets 24 m apart
  in plan. This is information for the ui and schedule tasks (offer a fade-hop), not a player bug.
