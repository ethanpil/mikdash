# materials-2-fix — decision log

`- **Choice** — why (source / reasoning) — alternative.` Owned: `src/world/materials/**`.
Shots: `shots/materials-2-fix/` — `before/{high,medium,low}` (the materials-2 code; three high views — `mount-predawn`,
`wall-2m-d3`, `wall-2m-raking` — were covered by a Vite error overlay from a concurrent sim edit and are the review run's
copies, `shots/materials-2-review/high`, same code), `after/{high,medium,low}` (final), `wip1–wip4` (iterations),
`perf/` (opt-out A/B), `scratch/`. Lab harnesses (scratchpad, not shipped): a material lab, a per-kind compile timer and a
boot A/B page (`ready()` → 3 s synthetic build calling `get()` → all baked; old vs new library, cold browsers).

## 1 Herodian ashlar close up (review: smooth plastic panels, a drawn outline, crack-like veins, grout lines at 20 m)

- **The dressing is sized to the texels: the boss is pointed — bowl-shaped pits 1.1–2.9 mm deep on ~3.4 cm and ~2.2 cm
  cells (≥ 3 texels on high; faded below that on medium/low), kept off the bevel's crest — and is rough (0.80) against a
  smooth combed margin (0.55).** — the 0.3 mm pecking on 12 mm cells was 1.5 texels: invisible. A first version used
  `pit / depth` in the AO and roughness lines (a 0–1 mask divided by metres): pitted texels went black; fixed in the lab.
- **The comb-chisel strokes are millimetre-scale, so they live in a new close-range detail map, `d_comb` (grooves 2.4 mm
  apart in strokes 3–6 cm long), masked to the margin by the baked roughness step (margin < 0.64 < 0.72 < boss) and
  turned across the margin it dresses (vertical on the top/bottom margins, horizontal on the sides — from the
  course-local height).** Patch flag `comb` (`MK_COMB`). — a margin/boss mask in a spare channel: the albedo alpha holds
  the block distance (bit-packing breaks under filtering) and the ORM is RG8.
- **A chamfer, not a step: bevel 3.2–5 cm with a hand-cut wander (5 + 2.5 + 1.2 mm noise), near-linear profile (35 %
  smoothstep), boss 11–19 mm proud; no margin brightening (was +2.5 %); cavity AO 0.1 (was 0.35).** — under raking sun it
  now reads as a lit/shaded band 8–10 px wide at 2 m (`after/high/wall-2m-raking`), not a 1–2 px line.
- **Marble veins: a core 0.75–1.15× wide (was 0.35–1.65×) in a halo of FIXED width, core and halo fading out together;
  the width/fade field is the smooth noise channel.** — the halo scaled with the swelling core: veins ended in smudges.

## 2 The keruv relief (review: a cartoon stencil — disc head, dress, stick legs, rabbit-ear wings, flat plateaus)

- **A modelled bas-relief in metres (hRange 3 cm): every part a signed-distance shape (smooth unions), each given a
  domed cross-section (`dome(d, H, R, re)`), relief deepest at head and chest (2.1–2.4 cm with the arm), wings 1.05 cm at
  the bone falling to ~0.4 cm at the feather tips; silhouettes rounded over ≥ 3 texels, small features (nose, lips, eye,
  fingers) over 1.5 texels so they survive.** Texture 1088 × 816 (3.5 mm/texel on high; 3.75 jagged at 1 m).
- **The child (Sukkah 5b; Chagigah 13b "ke-ravya"): a large head under a cap of short irregular curls (Voronoi), a
  modelled profile — rounded brow, small nose and lips grown out of the face (smooth unions: as separate domes the nose
  looked stuck on), cheek, eye in a shallow socket under its lid, ear; short neck, chubby torso, a boy's short belted
  tunic with short sleeves and a few soft folds, plump arm raised toward the palm with an open hand, knees, calves,
  feet.** Iterations in `wip`/lab: a big ball head with a tiny face read as a robot; the ear as a ring read as headphones.
- **Wings as bird wings attached at the shoulder blades (Shemot 25:20 "spreading their wings upward"): a curved bone rising
  up and a little back (near wing) and a more upright far wing behind it, each with marginal coverts, two rows of coverts
  and long flight feathers leaning toward the tip, overlapping like shingles, their rounded tips scalloping the trailing
  edge.** — tried and rejected: wings arching over toward the palm (a huge rainbow arch, a muddled X between back-to-back
  figures); a sickle rising from behind the head (read as a headdress: the root was hidden by the head).
- **Palm: a slightly curving trunk of leaf-base stubs in a criss-cross diamond pattern, a full crown of nine arched,
  drooping fronds with slanting leaflets, two date clusters; each pair of keruvim faces its palm (axis 0.5 m from it).**
  — horizontal scale rows read as a ladder.
- No halo, no Ezekiel faces, no floor-length robe. Drawing is reconstruction.

## 3 Parochet (review: a flat pink blur on medium/low, a plaid on high, dusty rose)

- **The plaid had one cause: the 16 mm twist pitch was exactly two cord pitches, so every float of a thread showed the same
  ply — each thread one colour, i.e. stripes both ways. Twist 12.3 mm (incommensurate) plus a per-float phase jitter.**
  Per-thread slubs and dye tone now vary every few cm along the thread (12 periods/m), decorrelated thread to thread; the
  tile-scale linen-share drift is gone.
- **`minPx` 640: every tier keeps ≥ 5 texels per 8 mm cord** (low and medium drew a flat heather). Cost: +3.3 MB on medium,
  +4.2 MB on low — the parochet is the Kodesh's largest surface; the detail layer (0.2 mm) cannot carry an 8 mm weave.
- **Techelet sky-blue (Part VII §23 "wool dyed sky-blue"): #2a4f80; argaman #4a0f2a, tola'at shani #7a1020, linen #8c8370
  at ~6 % (finer thread); ~5 % mean reflectance, gaps darkened 0.75.** — deep-dyed, deep-piled wool; with brighter dyes
  the probe fill and the gold room's white balance lifted it to lilac (measured L 0.52 at d3 on high). Tones are
  reconstruction.
- **Inside the Kodesh on high it still displays as a light mauve (hue 343 → 324°, saturation 0.17 → 0.19, lightness 0.47
  → 0.49), and that is the room's light, not the texture:** in game at d3, all three.js lights off changes the curtain by
  3 % (173,114,128 → 168,110,124), `envMapIntensity = 0` by nothing, sheen and specular together by 8 %; halving the albedo
  takes it to (116,67,83). The light is env's interior room ambient — strong enough to lift a 5.6 % cloth to mid-grey while
  the gold walls' (specular) reflection stays darker (curtain/wall 1.32): diffuse and specular interior light disagree
  ~10× (request). Outside, in daylight, the same texture reads deep plum-violet (`after/high/door-heichal`), and in the
  Kodesh on low deep plum (L ≈ 0.25).

## 4 Kochla courses and course heights (review: regular blue stripes; course heights not done)

- **12 courses per tile (13.2 m) in an irregular sequence — kochla every 3rd, 4th, 5th course — with the set-out
  alternation unchanged (even rows).** — the strict white/kochla/marmara cycle made pinstripes at 50 m.
  `+14 MB` on high for `herodian`, paid for by the trims in §12.
- **Kochla's chroma halved and its residual cast grey-green rather than blue (#cbd0ca / band #bfc6c0), value ~0.3 stop
  under the shayish; kochla blocks vary ±10 % and about a third are pale, close to the shayish.** — skylight before dawn
  amplified the blue.
- **Course table shipped as variant keys, `herodian_wall_courses` / `herodian_wall_inner_courses` (courses 1.12 1.04 1.18
  1.08 1.00 1.15 1.20 1.06 1.10 1.02 1.16 1.09 m, 13.2 m tile), with `ctx.mats.tile(key).courses` and
  `ctx.mats.courseAt(key, y)` → `{ index, y0, h, setOut, type }`.** Generators read the row from a 1-cm course LUT; the
  patch identifies blocks through a course map (`MK_COURSES`). The 1.1 m keys stay for the current geometry (builders
  model the set-out courses on 1.1 m). — changing the main key under the builders (joints up to 10 cm off their steps).

## 5 terrain_blend (review: snow-like blobs far off, polka-dot near, blurry rock with dotted crevices)

- **Edges widen with distance (band × (1 + 5) between 60 and 900 m) and with the weights' screen-space rate (fwidth);
  far off the three layers converge 35 % toward their shared mid-tone; the rock layer is weathered mid-grey limestone
  with patina (#8e8a81), not pale fresh stone.** — pale blobs read as snow from 10 m to 2 km.
- **The open hillside: irregular clumps of dry grass (20–60 cm, clustered at ~2 m) of short combed blade strokes in three
  directions over a dark base of stems, fraying at the edges; batha cushions with darker lower rims and a shadow ring;
  grit. A tile-period warp (0.45 m) breaks the basis's short repeats.** — every basis lookup repeats every 4 noise cells
  (16 Voronoi cells): a thresholded field drew a lattice of marks every 1.5 m (found by isolating the terms).
  Rejected on the way: radial tufts (read as daisies), Voronoi tufts (polka dots), cell-limited shrubs (shard edges).
- **Cultivated ground in early November is ploughed after the first rains: shallow, wandering furrow traces (an ard
  scratches), clods, straw remnants, a little new green.** — stubble rows read as corduroy and a moiré grid at 50 m.
  In the final pass the rows also wobble at metre scale (±7 cm), the furrow profile is soft and the straw sparser (no
  measurable change in the olive views: stripe energy 3.35 → 3.30). The concentric arcs and the ~10 m dark blob on the
  ground in `after/high/olive-15m` are NOT the texture: in game, removing the terrain normal map lowers their stripe
  energy 16 %, raising the sun cascades' shadow bias (−0.00004 → −0.002, normalBias 0.012 → 0.112) removes the blob
  (+19 % mean luminance) and lowers it 28 % — shadow acne (request to render).
- **Crevices never under ~3 texels and gated softly (taper, no dot chains); rock tile 6 m (was 8 m).**
- The weights' own noise scale is build-mount's (request).

## 6 Bark (review: species patches wash across single logs; no relief)

- **One species per set: `timber_bark_fig` (smooth silvery grey, lenticels, ring creases), `timber_bark_walnut` (= the
  new `timber_rough`: two families of long furrows crossing at small angles — the interlaced diamonds — 7 mm deep with
  AO), `timber_bark_pine` (long plates, dark fissures, red-brown inner bark where flakes have gone), `olive_bark`
  (twisted fissures at a slant, lichen; outdoor).** Builders assign per log (they already hash each log). — keying the
  species in the material: merged geometry has no per-log identity, and world-cell hashing splits logs at cell borders.

## 7 Olive foliage (review: a camouflage of dark blobs and white spots, a mossy rock)

- **Leaves in sprays: each spray's leaves share one of four directions (a second weakly), dense inside, thinning into
  darker gaps between sprays; a leaf is the 3.2:1 Voronoi cell shrunk from its border (an elongated hexagon, pointed both
  ends); upper side grey-green #6a735f and glossy (0.52–0.60), underside only a little paler #8b907e and matte (0.72); the
  canopy interior #3e4537.** — the silver is the glossy upper sides' sky reflection and the turned undersides, not white
  albedo blobs. A 0.4 roughness looked wet. Verified at 5 / 15 / 50 m (`after/*/olive-*`).

## 8 Cold start (review: 1.8–2.4 s cold on low against 1.5 s)

- **Progressive start: before the build only the basis maps (main thread, first) and the six boot kinds (walls, pavement,
  steps, soreg, gate gold, ashlar) compile; the other 25 compile in three priority groups after 'ready', in idle time.
  Their sets are allocated when the builders ask (the materials hold their final textures from the start, pre-cleared to
  the key's flat look) and bake in place, a few per 6 ms idle slice, when their group is linked. Screenshot mode
  (`?shot=1`) compiles every group during the build and bakes at 'ready'.**
- Measured (HD 4600, shared with other agents' browsers): total generator compile work ≈ 8.0 s cold (5.9 s before — the
  redrawn relief alone 1.9 s); overlapping it with the build only stretched the build (boot A/B: 4.4–6.8 s vs 5.2–5.8 s);
  basis Workers were slower than the main thread (0.38–1.9 s of thread start and three cold JITs vs 0.23–0.26 s);
  baking during the build while other programs compiled stalled on synchronous GL queries (0.35 → 1.2 s). Final boot
  A/B (3 cold pairs): `ready()` 0.84–0.87 s vs 2.03–2.16 s; time to 'ready' 3.95–3.99 vs 5.52–5.67 s; the later groups
  finished ~3.7 s after 'ready'. In game (low, first page of the final batch): `ready()` 0.60 s + boot bake 0.22 s
  = 0.82 s (an earlier cold run: 0.85 + 0.32 s); warm pages 0.22–0.33 s + 0.06–0.09 s.
- The basis is uploaded as Float32 into RGBA16F (no JS float→half pass); the low tier's Voronoi bases are sampled at 384 px.
- A deferred surface seen in the first seconds shows its flat colour, then its texture appears. — compiling everything
  first (the old path, 2+ s more before the world appears on a first visit).

## 9 lime_whitewash_worn (review: featureless; a flat grey plane in shade)

- **The stones stay buried (faint 2–4 mm bulges), but the lime has character carried in the ALBEDO (in shade only albedo
  reads): broad bare-foot bands along the ramp (v; one per 4 m, wandering, fading in and out, darker and glossier),
  cloth-wipe streaks, the buried stones' outlines ghosting through as faint grime lines, hairline crazing in patches
  (≥ 1.1 texel wide), patched repairs, a soft mottle of wear.** — two narrow lanes read as tyre tracks.

## 10 Outdoor opt-out switch (review: `?matout=0` / `setOutdoorOpt()` did nothing; the 4–6 ms claim)

- **`setOutdoorOpt(on)` and `?matout=0` now flip `userData.mkInterior` AND env's `MK_NO_ROOMS` define on the outdoor-only
  materials (and set it at creation when env's chunk supports it, so materials made after env's traversal get it too);
  the patch's own `#undef MK_INT` stays as the fallback for an env without `MK_NO_ROOMS`.**
- **Correction of materials-2's figure: measured on the path that ships (same page, alternating, low; the define verified
  on/off every pair): Kidron 32.6 vs 38.0 ms, Har HaMishchah 39.8 vs 41.6 ms, full-screen ground 20.8 vs 20.7 ms (medians;
  ±10 ms between pairs on this shared machine). The saving is not reliably distinguishable from zero — consistent with the
  review's 0–0.5 ms; the "−4 to −6 ms" of materials-2 measured the materials fallback while env's own path was absent.**

## 11 New keys (review: cow print, reptile leather, salmon, plastic, granite, planed board, marble, sugar)

- **house_rubble: rounded stones (pillow profile) standing proud of a raked-back mortar of close value; relief and cavity AO
  carry the read. timber_charred: flat-topped blocks elongated along the grain (anisotropic Voronoi: straight bisector
  cracks), deep dark cracks with ash, satin (0.66–0.8). leather: the flesh side's fibrous connective tissue (three fibre
  directions per region), fat, a membrane sheen, coarse salt crystals with dark rims (0.75 m tile so they resolve); no
  vessels. terracotta: a new `clay` kind — wheel striations, throwing ridges, slip thinning on high spots, firing clouds,
  sparse grit and voids, muted earthen colour. embers: clustered coal lumps (ash-dusted tops) in ash drifts. timber_split:
  sharp torn ridges and splinters (a bug in the old riven term: its brightening was applied after the albedo was written).
  copper_worn: an even oxide film rubbed bright only at the highest ridges between hammer dishes. frankincense: irregular
  amber tears, thin edges paler and more saturated (the subsurface cue in albedo), white bloom, glassy broken facets.**
  — reconstruction; a transmission material for the resin (costly extra pass).

## 12 Texture memory (review: 227 MB in game with < 3 % headroom; 261.5 MB with every key)

- **`_v` wood keys are UV-swapped views of their u sets (`rotOf`; the patch swaps every map's UV in the vertex shader —
  the tangent frame follows; `MK_UVSWAP`, also under `?matfx=0`): no second bake (−13 MB on high).**
- **Trimmed rarely-close sets: small-tile metals 512 → 384, linens 512 → 256, wood 1024×256 → 768×192, marbles/steps 512 →
  448, plaster/bedrock/terrain_rock 640 → 576, paving 896 → 832, goldplate 1024×512 → 896×448, ashlar(_wash), whitewash,
  logs/logend/lattice/olive one step down, herodian_inner 1024 → 896; the hero herodian stays 1664 px (7.8 mm).**
- Measured in game on high: 57 sets, 193.0 MB (was 227.2). Every key baked (debug=mats): 70 sets, 254.1 MB (was 261.5)
  — the two course-table alternatives (39.5 MB) never coexist with the 1.1 m keys once builders switch.

## Also fixed (found while working)

- **The macro variation's two world-space lookups each degenerated to a 1-D function on one family of planes (xz: constant
  along y on walls — vertical bands; (x − z, y): diagonal stripes on floors). Both are oblique projections now, 2-D on
  floors and on walls of either orientation.**

## Also fixed in the final pass

- **Grit (~1 cm stones) on the terrain's soil layers fades where a texel is larger than a stone (medium ×0.7, low off):
  on low it aliased into single bright texels — the near "polka dots" (`wip5/low/low-kidron-west-d3`).**

## Verification

- `npx vite build` passes. Consoles of the final batches: no material errors or warnings (the high batch shows only another
  task's `[sim:g4] courts-daily plan failed`).
- Shots, before → after: high 22 views (+ `wall-20m-d3`, `keruv-1m-d3`, `olive-5m/15m/50m`, after only), medium 9 views
  + 10 swatch rows (+ 7, after only), low 7 views. The olive views and the Kidron views on medium/low were re-taken after
  the two terrain fixes above (the superseded ones are in `wip5/`).
- Memory (baker formula, after `loaded()`): high 57 sets 193.0 MB (budget 256), every key 254.1 MB; medium 57 sets
  55.2 MB, every key 70.6 MB; low 51 sets 22.2 MB (budget 48).
- Generation on low: see §8 (0.82 s first page, budget 1.5 s). High `ready()` 0.69–1.41 s across the batch.
- Kochla course contrast (mean luminance step between kochla and shayish courses, `mount-*`): predawn 0.42 → 0.31 stops
  (blue cast difference 0.465 → 0.26), sunrise + 20 min 0.44 → 0.36, d6 0.28 → 0.18.
- Parochet: §3 (hue and saturation moved toward violet-maroon; display lightness on high is the room's light).

## Requests

- **build-altar / courts**: pick a bark key per log (`timber_bark_fig` / `_walnut` / `_pine`; e.g. from the log's existing
  random) for the altar piles (fire.js, kevesh.js, kitchen.js) and the courts' instanced logs; `timber_rough` is now walnut.
- **build-mount**: `olive_bark` for the olive trunks (trees.js uses timber_rough); `house_rubble` / `roof_earth` for the
  city; review the terrain weights' own noise scale with terrain_blend's widened far edges.
- **build-mount / build-courts / build-heichal (decision)**: switch to `herodian_wall_courses` / `herodian_wall_inner_courses`
  and model the set-out steps from `ctx.mats.courseAt(key, y)` (heichal/uv.js `ub`/`uz` fit the rovadin to courses).
- **env / render (Kodesh light on high)**: the interior room ambient lifts the 5.6 %-reflectance parochet to mid-grey while
  the gold walls' specular reflection stays darker (§3) — the diffuse and specular interior terms disagree ~10× there;
  on low the same curtain reads deep plum. Check the room's ambient level / white balance against its probe.
- **render**: expose `ctx.fx.emissionScale` (embers now replicate fx's fire gain formula as a fallback).
- **render (sun cascades, high)**: shadow acne on the terrain — concentric arcs and a false ~10 m shadow blob at
  `at=924,197&look=90,4&t=d3` (`after/high/olive-15m`); `render:sun-csm` bias −0.00004 / normalBias 0.012 (§5).
- **orchestrator**: docs/API.md materials section and CLAUDE.md notes (see the report's api field).
