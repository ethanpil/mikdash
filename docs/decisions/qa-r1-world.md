# qa-r1-fix-world — decisions

Scope: `src/world/**` except `materials/` (terrain, mount, heichal). Tasks WLD-1 (the Har HaMishchah / Kidron vistas)
and WLD-2 (the Heichal from afar). Format: **choice** — why — alternative. ⚙ = reconstruction. Shots:
`shots/qa-r1-fix-world/{before,wip*,after,probe}/`.

## WLD-1 — the slopes of Har HaMishchah and the Kidron

- **The near field of the Har HaMishchah viewpoints gets its own grid lines: a band over x from 125 m west of the slope
  lookout to just east of the burning place, y over the path and the lookout (plan.js `detail`), every 6 / 4 / 3 / 2.5 m
  by tier (9 / 6 / 5 / 4 m on the lower slope). The lines are added after the tensor grid is solved (grid.js
  `solveLines(…, extra)`), so the rest of the grid keeps its spacing; not in the shadow proxy.** — at 17 × 7 m cells
  (high; 42 × 19 m on low) the crest was facets of a plane whatever the height field held. High: 254 k grid triangles,
  still under the 300 k collider limit. Alternative: a camera-following clipmap patch (T-junctions, a second surface
  to z-fight).
- **Micro-relief only inside that band (height.js `micro`): hummocks (±0.2 m, ≈ 6 m) and broken limestone benches along
  the contours (every 1.25 m of height, the bench flattened to a third of the slope and the riser steepened), in
  patches, on slopes of 4–50 % only** ⚙ — the karst shelves of the Judean hills; nothing on graded beds or the crest's
  flat. Faded out at the band's edges, where the cells would alias it. Alternative: everywhere (the coarse cells sample
  it as noise spikes).
- **The burning place's graded margin 22 → 10 m.** — the level apron round the floor was the "flat dark plain" of the
  sunrise view. The floor itself and the eye height of the anchor are unchanged (site.js `groundEye`).
- **Ground cover round the camera (terrain/cover.js): tufts of dry grass, garrigue cushions, loose stones, generated per
  8 m chunk from a hash of the chunk, within 26 / 38 / 52 / 66 m by tier and thinning toward that radius; placed on the
  rendered grid (grid.js `gridSampler`, the cell's own triangle — max error 5e-8 m in a unit check), clumped by a noise
  patch, thinned on bare rock and steep ground; none on paving, the city, the Mount, the burning-place floor, the garden
  plots (tufts), or the trodden middle of the Parah path (its edges ragged with them).** ⚙ species and season: early
  November, the end of the dry season — straw and grey grass with a little green, grey thorny-burnet cushions. Same
  shader programs as the scrub (olive_foliage + instance colour) and the rocks (terrain_rock), so no new compile; 2
  draw calls on low, 3 on medium+. Caps 2 200 / 4 500 / 8 000 / 11 000 tufts. The same ground always carries the same
  tufts, wherever the camera came from (determinism checked in the page). Alternatives: a static scatter (either sparse
  everywhere or dense only at the anchors); alpha-card grass (a new program — 0.5–3 s on the HD 4600).
- **Tufts are sixteen tapering two-sided blades (one triangle a side), shading normal mostly up.** — 32 triangles a
  clump: 8 000 clumps on high = 256 k triangles. Two-segment blades doubled that for no visible gain at 1–50 m.
- **Rocks, terrace walls and trees may stand in a viewpoint's cone when they stay under the sight line from that
  viewpoint's eye to the Heichal entrance's sill, less ½ amah (plan.js `sightTop`).** — the old rule kept the cones
  (±40°, 60 m) empty, which left the slope bare exactly where the visitor looks. Alternative: smaller cones (they would
  still be bare).
- **The Parah path is the ground itself: the grid has lines on its edges and middle and its vertex weights wear it to
  limestone along the middle and trodden soil at the edges; the separate pale strip (terrain_rock over ashlar skirts) is
  gone.** — it read as a white slab with ruled edges; the ground material's noisy layer edges give it ragged ones. The
  bed is graded as before (level across). The causeway landing keeps its 0.17 m step to the deck. Alternative: the strip
  in the ground material (still a hard geometric edge).
- **The burning-place floor is laid in courses of separate slabs (1.1–1.5 × 1.3–2.6 amot, staggered joints a centimetre
  wide down to an earth bed 7 cm below), each with chamfered, worn arrises (1.5–5 cm, more on the floor's edge) and a
  lift / tilt of its own (±11 mm / ±9 mm); 70 % in the weathered limestone key, the rest fresh-dressed** ⚙ — it was one
  plane that read as a white sheet. Flush with site.js's crest ground as before. Alternative: a paving texture on the
  plane (no arrises, no shadowed joints).
- **Terrace and field walls in the city's rubble key (`house_rubble`), their tops ragged (0.6–1.2 m, some slumped to
  half), with gaps, in shorter patches.** — `terrain_rock` is the pale bare limestone; the long walls read as drawn white
  lines across the slope.
- **Three olive forms (trees.js `FORMS`): the broad three-leader tree, a younger taller two-leader tree, an old low
  sprawling one; each a near and a far instanced pair; two forms on low.** ⚙ — groves were rows of one clone. +8 draw
  calls on medium and up (+2 on low).
- **City: courtyard houses — wings of rooms round an open court on a whole block, the fourth side a wing or a wall with a
  gate — on 42 % of the upper city's blocks and 26 % elsewhere (detail ≥ 1)** ⚙ — the period's common house (rooms
  round a court) and the strongest break of the box field from above. Units are kept or dropped whole under the tier's
  house budget.
- **Parapets from detail 1 (was 2).** — a flat roof needs its ma'akeh (Devarim 22:8) on medium too.
- **Wall stone: rubble, dressed stone, lime plaster and earth plaster (the roofs' rolled-earth key on walls); roofs 75 %
  earth.** ⚙ — the earth-plastered walls give the city its value range without a new material or program.
- **Each block turned ±3° and shifted ±0.6 m.** ⚙ — the lanes wander instead of ruling the city into a grid.
- **Smoke of cooking fires and ovens from six courts within 700 m of the Mount, at least 120 m apart (three on low, where
  there are no courtyard houses: none), via render's smoke columns: from dawn to the end of the third seasonal hour
  and from the ninth hour to an hour after nightfall, each household on its own phase; none on Shabbat (from Friday's
  sunset to Saturday's nightfall — no fire is kindled, Shemot 35:3).** ⚙ times. A pure function of the clock.
- **The teal band on the south-western horizon is not the terrain's: it hits terrain at 2.3–5.9 km (azimuth ≈ 200–250°),
  and it stays when the ground's material is replaced by a plain grey MeshStandardMaterial
  (`probe/teal-grey.png`); on low it is a saturated blue with a hard vertical edge (`wip5-low/*`).** — handed to
  env-render (lighting / aerial perspective of the far field).
- **The fall to the Kidron from the crest:** site.js's profile is convex at the crest (12 % then 29 %), so from the
  ground eye the brow hides the slope below ≈ 150 m; the fall shows from `mount.har-hamishchah.slope` and the path.
  Not changed (the profile is site-model's; the framing is DATA-2).
- **"Slab and causeway" read as the burning-place floor and the Parah path** (the white strip in both shots). The
  causeway proper (arches, paved deck, ashlar parapets — Parah 3:6) is unchanged.

## WLD-2 — the Heichal from afar

- **The crowning kiyur (+107) projects 1 amah all round (was 0.36), the +62 kiyur ¾ round the Ulam block and 0.6 round the
  aliyah block (were ½ / 0.36); the ma'akeh's coping 0.55 (was 0.34).** ⚙ — a classical cornice projects about its own
  height; at the old depths their shadows were a fraction of a pixel from the Mount. Profiles and heights unchanged
  (site.js `heichal.ceiling.kiyur` / `heichal.roof.kiyur`, build-heichal's moulding). The south-face courses are
  notched round the two cedar posts at the aliyah door (Middot 4:5), which now stand inside the deeper cornice.
- **The vine's gold: roughness × 1.25 → × 0.9 of `gold_vessel`.** — the leaves turned toward the sun throw a glint that
  carries; the smooth, randomly turned leaves of build-heichal-fix no longer twinkle as a field of lights at the
  Ulam steps (`wip3/vine-sunrise20.png`).
- **The Ulam opening's darkness is left to the light:** env treats the Ulam as an interior volume (`heichal.ulam`,
  apertures, probe). At sunrise the sun shines straight in (correct — the nivreshet's hour); by day the recess shows the
  curtains and the gate. Darkening the stone would be a material claim without a source.
- **Not changed: the rovadin recess (⅓ amah) and the whitewash.** — build-heichal's decisions; what still makes the
  aliyah block read as one plane from afar is the even `heichal_whitewash` and the faint far-field contrast of the
  kochla rows (requests to materials).

## Requests

- **env-render:** the teal / blue band — sunlit far terrain at 2.3–5.9 km toward the south-west at sunrise and sunrise +
  30 renders saturated teal (high) or blue with a hard vertical edge (low), on any material
  (`shots/qa-r1-fix-world/probe/teal-grey.png`, `wip5-low/mishchah-sunrise.png`, `wip5-low/kidron-view-sunrise30.png`).
- **materials:** (1) `heichal_whitewash`: far-field variation — lime-wash streaks, a faint grey / ochre weathering band
  under the copings and stringcourses, the coursing ghosting through — so the aliyah block is not one even plane from
  the Mount; (2) `herodian_wall_inner_courses`: more value / hue contrast of the kochla and marmara rows at distance, so
  the Ulam's rovadin read at 0.5–1 km; (3) optional: a dry-grass blade key (instance-colour tintable, opaque) for the
  ground cover, which borrows `olive_foliage` now.
- **orchestrator:** a CLAUDE.md line: "Ground cover is per-chunk hashed round the camera (terrain/cover.js) and sits on the
  rendered grid (grid.js gridSampler), not on T.heightZ: the cells only sample the field, and on coarse cells the two
  differ by decimetres. The Parah path is the ground itself (grid lines + vertex weights), not a strip." docs/API.md:
  `terrain:cover` (`userData.rebuild(x, z)`, `userData.stats`); terrain stats `compounds`, `smokes`, `smokeState`.

## Verification

- `npx vite build` passes (into the scratchpad; output deleted).
- `tools/warmup-check.mjs`: ALL PASSED, every tier × mode. Programs: low 72, medium 88, high 100, ultra 104 (shot). High
  shows 100, the same as the before shots, so no new shader program. Compiled → first frame: low 18.4 s, medium 28.5 s,
  high 42.5 s, ultra 52.2 s. Other fixers' work is in the same tree.
- `tools/nav-coverage.mjs --q low`: 132 targets. The only failures are `roof` from both origins, as before. 893,510
  nodes; colliders 108,678 triangles (world-4 had ≈ 98 k; the extra is the grid bands and the slab floor).
- `src/sim/dev/tests/jumps.js` (low): ok, deterministic. `validate-schedule`: 0 errors. `coverage`: no gaps (longest
  7 min).
- In-page checks (`tests/`, medium):
  - Cover is deterministic: the same 3,863 instances and hash after leaving and coming back.
  - None in the city.
  - Rebuild cost 2.65 ms cached (every 4 m of movement) and 27 ms for a cold ring (a teleport).
  - Smoke: 6 columns, all lit at sunrise + 30 and in the evening window (d10). None at midday or at night. None on
    Shabbat (morning or afternoon). Friday d10 lit, none after sunset.
- Frame counts (all passes). Before → after:

  | View | Tier | Draw calls | Triangles |
  |---|---|---|---|
  | Har HaMishchah sunrise | high | 389 → 406 | 2.65 M → 3.00 M |
  | Kidron view | high | 401 → 417 | 2.75 M → 3.09 M |
  | Aerial | high | 544 → 547 | |
  | Crest views | medium | 350 / 355 | |
  | Crest and slope views | low | 268–273 | 0.59–0.61 M |
  | Spawn | low | 254 | 0.56 M |

  Terrain grid triangles: low 27 k, medium 99 k, high 254 k.
- Shots read (`after/high`, `after/low`, `after/medium`, `wip*`, against `before/`):
  - The crest at sunrise.
  - The Kidron view at sunrise + 30.
  - The crest by day.
  - The slope lookout in the afternoon.
  - The ground close up.
  - The city from the air.
  - The city from the slope (weekday and Shabbat).
  - The aerial, the Heichal's top and front zoomed, the Ulam and vine at sunrise + 20.
  - The spawn.
