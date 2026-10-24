# qa-r2-fix-world — decisions

Scope: `src/world/**` except `materials/` (terrain, mount, courts, altar, heichal). Tasks WLD-R2-1 … WLD-R2-9 of the
second QA round. Format: **choice** — why — alternative. ⚙ = reconstruction. Shots: `shots/qa-r2-world/` — `b-*`
before (the QA repro queries), `c-*` close-up before, `dbg-*` in-page experiments, `a-*` after.

## WLD-R2-1 — "blind panels" round the chambers in the court walls (env, not geometry)

- **No world change: the frame is the interior-light volume of each chamber, drawn by env.** Evidence: (1) a raycast
  in the page (`dbg-nitzotz`) — the chamber's outer face and the wall's face are coplanar at the wall face (Y 403.000),
  with the same material key (`herodian_wall_courses`) and the same world UVs (−44.84, 12.03 on both); the set-out
  course slabs (high, 1½ etzba proud) run on over the chamber's face; (2) on low (`dbg-kelim-low`) the coursing runs
  straight through the "panel" and the dark frame is still there; (3) with env's interior shader off (`?intshader=0`,
  `dbg-kelim-intshader0`) the panel is gone completely; `?intdebug=1` (`dbg-kelim-intdebug1`) shows the frame as a dip
  in sky visibility. Cause: `env/interiors-glsl.js mkInside` gives a volume 0.3 m of `margin` outside its box and lets
  only surfaces facing along the NEAREST face's normal out by the shell rule. The chamber boxes (site.js) reach the
  wall's outer face, so the wall face beside the box (normal +Y, nearest face ±X) and the top/bottom faces of the
  set-out courses 3 cm in front of it (normal ±Z, nearest face +Y) are lit as the closed room: a soft 0.3 m dark frame
  round Pinchas, Chavitin, Kelim, Etz, the Nitzotz exedra and Beit HaNitzotz, and dark dashes on the courses inside it.
  Filed to env-render (requests). — The QA's proposal (keep the wall's outer skin, subtract only the room) would leave
  the same frame: env reads the site boxes, not the meshes.

## WLD-R2-2 — Beit HaNitzotz, the open watch-room

- **Three open bays on each face, toward the court and toward the chel, between 1.5-amah piers, over a breast wall
  2¼ amot high, under 2¼ amot of lintel and roof slab (azarah.js `nitzotzBays`); at detail ≥ 1 a two-fascia marble
  lintel with a plain cap, impost blocks on the piers, a sill course and pier bases (`watchRoomDressing`).** ⚙ —
  Middot 1:5 "an upper storey built on it, the kohanim keep watch above"; report Part VII F12 "open colonnaded upper
  watch-room — open bays rather than windows". The court face had four window-like holes and the chel face none (a
  blank block from the chel). Counts, sizes and mouldings are reconstruction; the breast wall is a ma'akeh for a room
  open on two sides, its top (+38.25) clear of the Nitzotz gate's door-case below on the chel face (+37.9). Alternative:
  a colonnade of round columns (the exedra below already has them; the upper storey stands on the wall line, where piers
  carry the 10 amot of wall above).
- **masonry.js keeps the set-out course slabs off the chel-face bays** (they ran across the openings).
- The room is still lit as a closed chamber (env's volume has no apertures): filed to env-render.

## WLD-R2-3 — the tapuach

- Note on the repro: the "smooth white dome" at the right edge of `t=07:25&at=212,295&look=315,18` (`b-tapuach`,
  `a2-tapuach-far`) is the kipah of Beit HaMoked (Middot 1:6; site.js dome r 10 over (210.75, 402)), 107 amot away
  behind the Moked's fire; from the court floor the altar's rim hides the tapuach. The tapuach itself (`c-tapuach`,
  from the altar top) was the smooth turned mound the QA describes, and is reworked below. The Moked's plastered dome
  is left as it is.

- **A dumped, slumping heap instead of a turned dome (altar/fire.js `tapZ`)** ⚙: the crest carried ½ amah west and
  ¼ north of the centre (the ash is raked up from the fires on the east, Tamid 2:2, so the east flank is the long one);
  an oval footprint (±6 %, the whole scaled 0.96 so the mean radius stays site.js's) pushed out ≤ ½ amah in four
  slump tongues; broad low-frequency swells (0.24 amah) on the flanks, lumps over the crown too; chutes down the fall
  line (6 / 9 by tier). Site.js's radius and height are kept (the
  mound's volume within a few %), and the great pile's rows still find the surface by marching (Tamid 2:4). The
  heap's own random stream, so nothing else on the altar moves.
- **Charcoal in streaks down the fall line and fans at the toe (9 / 16 / 22 streaks by tier), mostly on the east flank,
  half sunk in the ash; the scattered bits halved; six charred gizrin stubs half buried at the toe (detail ≥ 2, not on
  the east where the great pile's billets touch).** ⚙ — coarse unburnt bits roll furthest down a heap; they also break
  the even grey. All in the tapuach movable (they shrink with `grow(f)`).
- **The heap's mesh asks for `ash_heap` (fallback `ash`).** The grey itself, its streaks and roughness 1 are the
  materials task's (requested); the floor drifts keep `ash`. The glow of the coal bed at the heap's foot on the fire
  side is env-render's (requested).

## WLD-R2-4 — olives on Har HaMishchah

- **Low, wide, domed crowns on short split boles (terrain/trees.js `FORMS`)**: ring 1.6–2.25 m up (was 2.05–3.15), lumps
  0.95–1.0 m (were 0.76–0.86), squash 0.72–0.85 (0.55–0.74), the top lumps ≈ 1.1 m over the ring, lump heights
  scattered over 0.9 m with the outermost hanging lowest (drooping outer masses); boles 0.75–1.3 m with leaders spreading
  wider; far crowns four ring lumps and one over the centre (were three and one: a flat three-cornered plate).** ⚙ —
  the tall bare trunk under a squashed plate read as an acacia; an olive's crown reaches to ≈ 1 m of the ground. +20
  triangles a far tree (+48 k on high with every tree in view). The crowns stay under the 5.5 m sight-line allowance.
- **Instance tint (1.22, 1.30, 1.08) × olive_foliage (#6c7462): toward #7d8a6a, silver-grey-green.** — the QA's target
  colour; the leaves' pale undersides make a grove lighter and greyer than the garden trees (unchanged).

## WLD-R2-5 — the stone of three steps

- **One block of veined marble (`marble_veined`, the House's marmara — Bava Batra 4a), cut as a section extruded
  across its width: risers set back a finger under a nosing, rounded arrises (detail ≥ 1), treads a little dished
  (detail ≥ 2) (heichal/vessels.js `stepStone`).** ⚙ — the Mishnah says only "a stone with three steps" (Tamid 3:9;
  Rambam BhB 3:11). The three stacked boxes in `marble_white` read as an untextured white box. Site.js's box and step
  count unchanged.

## WLD-R2-6 — light-leak slits on the gold and bronze leaves

- **Not gaps: flat bevels and edge faces of polished metal turned to the sun.** `dbg-chuldah-int0` / `dbg-nikanor-int0`
  (interior shader off) keep the strips, so they are shading, not env; the Chuldah strip is the panel bevel by the
  meeting stile; at Nikanor a raycast (`dbg-nik-ray`) puts one on the south leaf's flat hinge end (0.2 amah of it
  out of the reveal, facing ESE at the third hour) and the other on a panel chamfer of the north leaf. Hiding the leaves
  (`dbg-nikanor-noleaves`) removes both. A flat normal lights the whole strip at once.
- **Smooth-shaded mouldings: each panel bevel sweeps its normal from near the frame's face at its top to its own slope
  at the panel (an ovolo), and the leaves' vertical edges are shaded as rounded arrises across their thickness
  (normals turned up to ±0.9 toward the faces they meet) — mount/gates.js leafGeometry, courts/lib/kit.js leafGeometry
  (`quadsLocal` bevels, `roundEdges`).** ⚙ — the sun now draws a highlight line with a falloff. UVs are still projected
  from the flat faces (a per-vertex projection on turned normals would smear the plate), so `finishLocal` now projects
  each part by its own normals before merging (identical result for every other caller).
- **The hinge stile is a half-round pivot post (radius = half the leaf's thickness with its frames), its back half in
  the reveal; it turns in place as the leaf opens.** ⚙ — heavy leaves turned on pivots in sockets; the flat hinge end
  that stood 0.2 amah out of the reveal was the Nikanor slit. Chuldah (`a2-chuldah-far` vs `b-chuldah`): no white
  slit left — a rounded gold stile and graded moulding highlights. Nikanor (`a2-nikanor-close`): the bronze posts and
  one panel chamfer still gleam at the third hour, now as rounded highlights; that is the polished metal facing the
  sunlit court (it reflects the bright Ezrat Nashim; the leaves' faces reflect the dim passage). Damping it further is
  reflection control (env / materials), not geometry. Rejected: rebated jambs or a door stop in front of the hinge —
  they narrow the gates' 10-amah opening (Middot 2:3) — and setting the hinges deeper (the open gold leaves, folded
  flat against the passage walls, would sink into them).

## WLD-R2-7 — the opening frame

- **The start anchor turned 9° north of the axis (heading 279), pitch 10 kept (mount/posts.js).** — square on, the wall
  was a flat backdrop with the glow dead centre (`b-default`); turned (`a-start-279`), the Heichal's glow through the two
  gates sits left of centre and the wall recedes to its north corner. 261 (`a-start-261`) is the mirror image; 279 reads
  left to right into the depth. Pitch 10 keeps the steps, the soreg and the wall's crown with a band of stars. Still on
  the axis at the same place (the brief's start, before dawn at the Chel steps): off the axis the Ezrat Nashim gate and
  Nikanor no longer line up on the Heichal. Something alive in the first frame (the Ish Har HaBayit's torch on his
  round, Middot 1:2) is the sim's (requested).

## WLD-R2-8 — the nanasin blocks

- **Each block a timber (altar/slaughter.js `cedarBlock`): grain east–west along the row, so north, south and top are
  long grain and east and west end grain (`cedar_end` once materials adds it, else `cedar_v`, the grain turned across
  the face); vertical arrises chamfered (detail ≥ 1).** ⚙ — the same long grain wrapped round all four faces read as a
  cardboard box.
- **Forged hooks of a 1.5 cm bar (was 0.9), the crook a little fuller, each root under a square iron plate.** ⚙ — at
  0.9 cm they read as cracks in the wood.

## WLD-R2-9 — the city

- **Street fronts: continuous rows of houses on both sides of every street (plan.streets), 4.5–8.5 m wide, 6–10.5 m deep,
  party walls between them (8 in 10), a lane into the block after three or more houses, set back 1–1.5 m from the paving
  (terrain/city.js).** ⚙ — the streets were only gaps where houses had been clipped out of a rotated grid; a house row
  on each side draws them. The block lots and courtyard houses behind skip any rect that meets a street-front house
  (a spatial hash, point-in-quad tests).
- **Party walls between a block's lots (0.02 m each side, 3 in 4; was 0.15 m 6 in 10).** — the block reads as one mass
  with its lanes and courts as the gaps.
- **Low: full density (was thinned to 0.7), courtyard houses and roof parapets on every tier, budgets 2000 / 2600 /
  3400 / 4400 houses (were 1100 / 2200 / 3200 / 4200), and the units kept nearest the Mount first (distance × a
  0.75–1.25 jitter; street fronts × 0.55–0.95), not by a random shuffle.** — the low city was scattered cubes on the
  soil: a random pick spreads a budget smaller than the pool thinly over the whole draw area (low keeps 2000); by distance it is dense where it is seen from the Mount and thins out with a ragged edge. High keeps all
  ≈ 2900. Houses are quads in the terrain's merged batch: draw calls unchanged (low aerial `a3-city-low` 276 calls,
  709 k triangles; before 274 / 612 k — the city, its parapets and the olives' fuller far crowns; high near view
  2.34 M, was 2.12 M). Terrain build times stay within the run-to-run spread (low 1.1–2.3 s, high 3.2–5.9 s; before
  1.8 s and 2.9–5.0 s).
- **Fewer white walls: along the streets 35 % dressed stone, 20 % lime, 25 % earth plaster, 20 % rubble; behind them
  45 % rubble, 25 % earth, 20 % dressed, 10 % lime; roofs 80 % rolled earth.** ⚙ — the bright dressed and limed walls
  made the "white block-out"; the city should sit a value step below the Temple's marble (build-mount.md).
- **Not instanced.** — the QA suggested one instanced draw call; the merged batch is already one draw call per material
  key and keeps world-scaled UVs (an instanced unit box would stretch the stone and earth textures per house).

## Verification

- Shots (high unless noted): before `b-*`, `c-*`; after `a-*`, `a2-*`, `a3-*` (low: `a2-*-low`, `a3-city-*low`).
- `node tools/nav-coverage.mjs`: all 133 targets reachable from start and the Azarah.
- `src/sim/dev/tests/floors.js`: ways 3040 / tracks 356 375 / sweep 6434 figures — 0 bad (the reshaped tapuach included).
  `views.js`: ok (3 data-owned view notes, none at anything changed here).
- `node tools/validate-schedule.mjs`: 0 errors; `node tools/coverage.mjs`: no gap over 10 min.
- `node tools/warmup-check.mjs` (production, every tier × shot / play): ALL PASSED (no material with two programs).
