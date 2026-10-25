# gate-world-materials — decision log

`- **Choice** — why (source / reasoning) — alternative.` Owned: `src/world/**` (incl. `src/world/materials/**`).
Final QA gate findings (scratchpad `gate.json`): #4 "Kodesh gold reads as matte mustard card" (the material half), #5 "Altar
fire close-up" (the world half), #6 "Har HaMishchah sunrise view…". The lighting halves (the Kodesh's falloff from the
gate, the low tier's analytic environment, the night sheen; the flame cards and the low tier's fire sprite) are
env-render's and render's, done in parallel by their own gate tasks.
Shots: `shots/gate-world-materials/` — `before/` (the QA's own views, first run), `before2/` and `after/` (the same views,
before = this tree with `src/world/**` from HEAD, shot back to back with after so env-render's concurrent changes are the
same on both sides), `wip1–3/` (iterations), `diag/`.

## #4 Kodesh gold (material half)

- **The plating's F0 is the gate's (0.96, 0.78, 0.40) linear → sRGB #fae5aa (gold_plate, gold_relief, gold_plate_door);
  metalness 1 (unchanged).** — qa-r2 had (0.965, 0.815, 0.456), a paler natural gold, chosen when the room's probe light
  was warm-red and uniform; with the Kodesh now lit through its gate the plating gets gold's saturation back. The vessels
  keep pure gold #ffe39d. Reconstruction (grade of the plating).
- **The metal IBL treatment for gold (patch.js MK_METAL): blend toward the mean ambient 0.18 → 0.06, peak cap 6 → 10
  (× ambient).** — the blend replaced 18 % of every reflection by the room's average light: with the probe's own
  near-uniform radiance that flattened the walls into a matte card with no sheen toward the gate. The cap still stops a
  sunlit doorway clipping to white. The cool-cast desaturation (0.6) stays (gold under blue sky).
- **Burnished crests on the relief: roughness −0.09 where the relief stands ≥ 6–18 mm (heads, chests, wing bones, palm
  trunks, rosette hearts), so 0.18 on the highs, 0.27 on the raised work, 0.36 on the hammered ground.** — gilded relief
  is rubbed bright on its high points by fitting and handling; the edges and highs now catch the gate's light as sharper
  highlights against the duller ground. Alternative: stronger normals (the relief's heights are already physical).
- **Parochet: lit albedo multiplied by #dce2dd (linear (0.72, 0.77, 0.73)) and its sheen #4a3444 → #4a3038.** — after the
  gold change the room's metered exposure rose and the curtain displayed (124, 81, 90) at d3 on high, magenta of the
  documented deep red-violet (109, 74, 79); now (112, 74, 80). The dyes and the four-ply even mix (Shekalim 8:5) are
  unchanged. The value depends on env-render's room light and exposure (their gate task changes both): re-measure there.
  On low it reads deep maroon (43, 15, 7; was 54, 19, 11) — the low tier's room light.

## #5 Altar fire (world half)

- **Every billet ±30 % in length and thickness, turned by up to ≈ ±12° (great pile) / ±10° (cribs), tilted a little;
  the cribs' billets laid end to end with uneven gaps and overhangs, a course now and then missing a billet.** —
  Tamid 2:4 (the great pile with "air between the gizrin"), 2:5; the gizer's size is Zevachim 62b's shortened amah,
  which branch-wood (marbiyot) only approximates. The old ±10 % length, ±8–20 % radius and ±2° yaw read as a lattice.
- **Bark ridges in the geometry (lib.js `logGeometry(…, ridge)`): alternate ring vertices ±ridge × radius, swelling
  along the log — fig 1.2 % (smooth bark), walnut 5.5 % (deep furrows), pine 4 % (plates); 12 / 14 ring segments on
  high / ultra (were 8 / 10), 8 on medium, 6 on low (walnut only, 3.5 %).** The bark normal maps carry the fine relief.
- **A burning-wood material per species (`timber_burn_fig / _walnut / _pine / _end`, patch.js MK_BURN): the bark set
  with the char set blended in by a per-vertex attribute `mkBurn` (x char, y ash crust, z ember glow) that fire.js
  paints per billet.** Painting: heat from each arrangement's heart of coals (the great pile's bed ellipse, each crib's
  heap; hotter low down, 70 % less at the top of the pile) plus the billet's own state (+0.05…0.45; the shortened,
  slumped billets of the burnt-out heart +0.45…0.65); the char climbs from the underside (the lower two-thirds first,
  broken into tongues by ~30 cm noise), the hottest parts — the ends toward the heart — crust grey-white with ash, and
  the undersides over the heart glow in the char's cracks (#ff5c16, 650 cd/m² × the fire emission scale, as the embers
  key does). The cut ends char a step earlier than the bark (end grain checks first), but are not ashed unless hot.
  — alternative: per-log material switching (fresh / charred) — two looks only, no gradient along a log; the CHAR mesh
  of the old charred billets is gone (one draw call fewer).
- **Charcoal matte on the logs: the char's roughness floored at 0.92, its alligator checks' contrast eased 35 % toward
  the char's local mean.** — the satin crests (0.66) mirrored the dawn sky as pale caps on low and, with the cushions,
  drew an orange net under the fire at night (`wip2`). What remains of the net at night is the walnut bark's own
  interlaced furrows lit by the fire (physical).
- **The billets and the ash are their own meshes in fire.js (one per key, as the StaticBatcher would make)** — the
  batcher keeps only position / normal / uv and would strip `mkBurn` (geom.js is the orchestrator's).
- **Ash beds 10–20 cm with a glowing core (`ash_burn`: the ash set with the coal-bed set blended in by x, its glow mask
  by z): the great pile's bed 0.36 amah (≈ 17 cm) at its heart (was 0.55, 26 cm), the cribs' heaps 0.32 amah (15 cm).**
  The coal bed shows through toward each heart, glowing under the arrangement (#ff6a1f, 1400 cd/m², as `embers`).
- **Soot round each arrangement on the ash floor (ash_burn x on the floor, ~0.5–0.7 m beyond each pile's box with a
  wobbling edge): the ash darkened up to 40 % and, close in, strewn with the coal bed's charcoal.** — the old floor was
  uniform ash up to the logs. The lime keys' MK_ALTAR soot stays on the altar's faces; the ash floor covers the top.
  Low draws the floor on a 12 × 12 grid (was one quad) so the soot has vertices.
- Fig, walnut and oil-tree (pine) per Tamid 2:3 as before (species from their own stream; the incense pile fig, Tamid
  2:5; low walnut only). Never olive or vine.
- Flames (layered soft cards, the day colour) and the low tier's sprite are render's (gate-render).

## #6 Har HaMishchah, the causeway and the city

- **The "glossy blue ribbon" is the terrain itself: the Parah path's middle drawn with the blend's rock layer at weight
  0.4–0.6 (qa-r1-fix-world).** Identified in game by raycasting the ribbon's pixels from the anchor (`diag/`):
  `terrain:ground.3 | terrain_blend`. The cool grey rock layer, lighter than the soil, read under the dawn sky as a
  strip of wet stone reflecting it. Now trodden soil with the limestone showing through in patches (rock 0.22–0.32),
  warm rock, roughness ≥ 0.9, and the specular occlusion below.
- **terrain_blend: roughness floored at 0.9, and its specular IBL scaled by the cavity AO × 0.35 (micro-occlusion by
  clods, stones and grass: dry porous soil scatters back toward the light, not forward).** — the GGX lobe of a 0.85–0.9
  surface still mirrored the bright dawn sky at grazing angles: the "dark wet mud".
- **Warm layers (the QA gate's ≈ sRGB 170, 140, 110 mean in daylight): rock #8e8a81 → #b2a48c (warm cream-grey
  limestone), roughness 0.95; terra rossa #6d5d4e → #977d66, its stony variant #8b7964; the cultivated ground likewise;
  the macro drift tint #aaa498 → #b0a491.** An intermediate, more saturated soil (#8f6e54) read as Mars-red in the dawn
  views (`wip2`). terrain_rock (boulders, loose stones, ledges) warmed the same way (it read blue-white, like snow).
- **The burning place's floor in a new key `stone_local` (set `stone_rough`: rough hammer- and point-dressed local
  limestone, warm buff, matte 0.9, pitted), replacing terrain_rock / steps_stone slabs that read as polished veined
  marble tiles.** The floor itself (Parah 3:8–9 fixes the place, not a pavement) stays reconstruction.
- **Ground cover: the dry grass and garrigue cushions in a matte key `grass_dry` (the olive leaf set, roughness × 1.6)
  instead of olive_foliage, whose glossy upper sides made the tufts read as plastic.** Same program (shared shader).
- **Olive groves: 1100 / 2000 / 3200 / 4200 trees per tier (were 700 / 1400 / 2400 / 3000), in three levels of detail:
  near (≤ 70–150 m, detailed, casting), mid (≤ 280–600 m: five lumps, two limbs, ≈ 140 triangles), far (two lumps and a
  bole, ≈ 50 triangles).** A second row on each deep terrace bench (quincunx), fewer gaps (22 → 15 %), more of the
  west face terraced (patch threshold −0.02 → −0.15). The Parah sight line (Middot 2:4; plan.sightTop) still keeps
  every crown under the line in the viewpoints' cones. Draw calls: +4 on low (2 forms × trunk / crown), +6 on medium+.
- **Gnarled trunks: three spiralling flutes round each limb (±20 %), a second harmonic, the limb twisted 0.9–1.5 rad
  along its length; the olive bark darker (#7c786e → #66625a).** — the old trunks were smooth bulging tubes.
- **Stepped bedrock ledges: where the terraced patches stop, the bedrock steps out along the same contours (the nari
  crust) — low long rocks (2.2–3.8 × 0.45–0.75 × 1–1.6 m) end to end every ~3.4 m, in the rocks' instanced draw call
  (160 / 420 / 700 / 900 per tier).** Terrace walls 1.2 m (were 0.95 m; Judean terrace risers are 1–2 m).
- **The rubble set ~10 % darker:** the terrace walls' sunlit tops read as white dashes across the olive slopes, and the
  city's rubble walls now sit a further value step below the Temple's marble.
- **City: most blocks are courtyard houses (0.6 in the upper city, 0.42 elsewhere; were 0.42 / 0.26) — the period's
  common house; lanes 3.2 m (were 4.2 m), narrow enough to read as dark cuts; a tree in ~45 % of the courts (fig,
  pomegranate or olive: the garden trees of trees.js).**
- **Roof parapets (ma'akeh) 10 tefachim = 1⅔ amot (0.8 m) high, from 0.55 m: the halachic minimum (Rambam Hilchot
  Rotze'ach uShmirat HaNefesh 11:3; Shulchan Aruch Choshen Mishpat 427:5).** — 0.55 m was below it.
- The city stays restrained massing, all of it reconstruction (no building is placed by the research): city.js header,
  build-mount.md; the materials' info marks house_rubble / roof_earth as reconstruction. It is lower in value than the
  Temple (rubble and earth roofs darker than the marble).

## Verification

- Before / after from the same views, back to back (`before2/` = HEAD's `src/world/**` in an otherwise identical tree;
  `after/`), high and low: `mishchah-anchor` (the QA's teleport anchor, `at=2171.67,330.5&look=270,-2.5&t=sunrise`),
  `causeway-sunrise`, `aerial-d3`, `mishchah-slope-d3` (new), `fire-great-d` / `fire-cribs-d` / `fire-great-n` (new
  close-ups on the altar top), `kodesh-d3`, `kodesh-n3`, `relief-1m-d3`. The QA's own first-run views are in `before/`.
- Measured (mean sRGB, fixed regions): the far west face of Har HaMishchah at d3 (131, 118, 104) → (157, 134, 111) on high
  and low (the gate's ≈ 170, 140, 110); the crest's ground at sunrise (54, 55, 65) blue-grey → (70, 63, 66) high,
  (72, 64, 67) low; Kodesh walls at d3 (139, 98, 52) → (128, 82, 35) high (F0 per the gate; their uniformity is the
  room's light), parochet (112, 72, 81) → (112, 74, 80).
- Draw calls / triangles (whole frame as shot.mjs reports): low +2…+4 calls, +0.01–0.03 M triangles in every view
  (max 279 calls, 0.72 M); high +1…+22 calls, +0.08–0.26 M (the olive groves). Within budget (low ≤ 350 / 1.5 M).
- Programs: +1 (the MK_BURN variant, shared by the four burning-wood keys and ash_burn); texture sets +1 on medium+
  (`stone_rough`, 448²; char / embers were already baked there for timber_charred / embers), +3 on low (stone_rough,
  char, embers: ≈ 1.3 MB).
- Consoles of every batch clean (no errors or warnings). `npx vite build` passes. validate-schedule: 0 errors /
  0 warnings; coverage: no gaps (longest 7 min). nav-coverage, sim tests and warmup-check: see the report.

## Requests

- **env-render (gate):** the Kodesh's light is theirs — after this task the walls' reflection still varies little along
  the room (luma sd ≈ 8 over a wall region at d3, as before); the gold now has the gate's F0, a 6 % (not 18 %) ambient
  blend and burnished crests, so a falloff and a gate image in the probe will read directly. The parochet's displayed
  value follows the room's exposure: re-measure it against (109, 74, 79) once the falloff lands (multiplier
  `COLOR_PAROCHET` in materials/index.js). On low the curtain reads deep maroon (43, 15, 7).
- **render (gate):** the flame cards (layered, soft, pale by day) and the low tier's crossed cards are theirs; the logs
  under them now char and glow (MK_BURN), and fx's `emissionScale`, when exposed, drives the ember emission too.
- **schedule-data / zones-content:** `outside`'s description says the city is shown "only as massing"; it is now courtyard
  houses with parapets, lanes and court trees — still reconstruction; the wording could say so.
- **orchestrator (docs):** docs/API.md materials — new keys `timber_burn_fig / _walnut / _pine / _end`, `ash_burn`
  (per-vertex attribute `mkBurn` = x char, y ash crust, z ember glow; geometry without it renders as plain bark / ash),
  `stone_local`, `grass_dry`; gold plating F0 #fae5aa. CLAUDE.md lesson: the StaticBatcher keeps only position / normal
  / uv, so a material that needs an extra vertex attribute gets its own mesh (altar/fire.js `own`).

