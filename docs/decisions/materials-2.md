# materials-2 — decision log

`- **Choice** — why (source / reasoning) — alternative.` Shots: `shots/materials-2/` (`before/`, `wip*/`, `after/`).
Owned: `src/world/materials/**`. Everything below is materials-only; requests to other owners are at the end.

## Herodian walls (herodian_wall, herodian_wall_inner, ashlar_plain)

- **The three marbles alternate as a gentle three-step tonal wave, not as dark stripes: shayish the brightest warm
  white (#e7e2d7), marmara a little greyer with soft veins (#dad5cb), kochla a PALE blue-green-grey (#bcc8c5) about
  0.35 stop under the white.** — Bava Batra 4a: the Sages left the courses bare because "it looks like the waves of the
  sea" (כאדוותא דימא); report §21 #1, §26 ("blue-green"). The old kochla (#78878a, ~1.3 stops under the white) made one
  dark band every third course: navy/teal stripes from the Mount and at pre-dawn. The value is reconstruction, judged
  on the Mount at pre-dawn, sunrise + 20 and d3 — Magen's "dark kohl-blue" (reads as stripes at any distance).
- **Kochla stones vary more from block to block (tone ±11 % vs ±4.5 % for the whites, a warm-cream .. cool-grey cast,
  and some blocks nearly grey) and keep low-contrast wavy bedding.** — a course of identical stones reads as a painted band; a
  course of individually quarried stones shimmers. Per-block hue in the texture (hashed per block) adds to the shader
  patch's per-stone variation — a uniform course colour.
- **Marble veins: zero sets of ANISOTROPIC noise (elongated along the stone, then warped by the smooth 3-octave
  channel), soft grey core 35–65 % toward the vein tone inside a wide faint halo, fading in and out along their length;
  each stone has its own slant (±0.45 rad; kochla's bedding stays near the course).** — the old domain warp used the
  rough 6-octave channels and isotropic noise, so every vein was a closed, crinkled squiggle with a dark core: the
  "black doodles / cracks" of the review. In a small periodic tile (monolithic marble, 3 m) the anisotropy is kept by
  asking for more cells across than along (whole cells per axis) — isotropic Voronoi or ridged-noise veins.
- **Drafted margins: a flat comb-dressed band 8–14 cm wide, its width different on each side of each stone, then a
  ~2 cm bevel (its line wandering several mm) up to a boss raised 1–1.5 cm and finely pecked; margin only ~2.5 %
  lighter; cavity AO radius 12 mm (was 4 cm).** — the 5 mm vertical step plus a 4 cm cavity-AO ring drew a dark line
  round every boss ("picture frame", "modern striped building"); a bevel catches the light on the sun side and
  shades on the other, as the excavated Herodian margins do. Dimensions are reconstruction — the old crisp step.
- **Weathering restrained (the building was new): a drawn-in course is sheltered under the set-out course above — a
  faint warm dust patina in its top 18 cm and sky occlusion (AO, not albedo) in a 5 cm band; a few faint rain streaks
  run down each set-out course from its ledge. The old per-course soil band at the foot of every stone is gone.** —
  dirt at the bottom of every course and a −30 % albedo soffit band added a second set of horizontal stripes; the
  real shadow of the 4 cm set-out is geometry's (builders model it at detail ≥ 1).
- **Wall-base patina is NOT in the material.** — the texture repeats every 6.6 m vertically and the shader does not
  know where a wall meets the ground (Mount 0, courts +6 / +16 amot, the valley far below); a base band needs a
  per-vertex height-above-ground from the builders (request below) — a world-height band (wrong on every terrace).
- **Course heights stay 1.1 m.** — the builders model the set-out courses on that grid (mount/walls.js `strips`,
  courts/masonry.js fringe, heichal/uv.js `ub`/`uz` fits the Ulam's rovadin to rows at k × 1.1 m); varying the
  texture's course heights (1.0–1.2 m) without them would put the 4 cm step up to 10 cm off the joint and a joint
  inside a rovad. Offered as a request (a course table from `ctx.mats.tile(key)`), not done unilaterally.
- **ashlar_plain: joints filled with dust a little darker than the stone (not a dark line), arrises chipped at the
  corners, cavity radius 12 mm.** — read as modern tiling — dark grout lines.

## New keys

- **terrain_blend: three layer sets mixed per vertex (r rock, g soil, b vegetation) in a shader patch; each layer
  bakes two maps (albedo + height, normal.xy + roughness + AO: a new `pack: 'blend'` finish variant, 8 B/texel like
  the standard three maps); the weights are perturbed by world-space noise at ~9 m and ~2.5 m and by each layer's own
  height (rock stands proud of the soil, grass fills the hollows) and resolved with a narrow soft maximum.** —
  smooth vertex weights alone smear across the grid cells (2–20 m); per-pixel height blending gives natural edges.
  Six layer fetches + two noise fetches per terrain fragment — splat maps (memory, not asked), per-triangle materials.
- **Layer roles follow the builder's weights: the builder puts the vegetation weight only on cultivated ground
  (gardens, olive terraces), so g (soil) is the open November hillside — stony terra rossa (browner, desaturated:
  #745f4f) with sparse dry grass and grey dwarf-shrub cushions (batha) — and b is cultivated ground (dense stubble
  over tilled soil, a little new green after the first rains); r is grey limestone with patina and lichen.** — early
  November (default date 2026-11-02): end of the dry season, first rains (yoreh) possible. Reconstruction —
  bare red soil on every hillside (reads orange; the review's complaint about terrain_soil).
- **terrain_soil itself is browner and desaturated (#7b5d4a / #634a3b).** — it read orange.
- **olive_foliage (canopy surface) and olive_foliage_card (alpha-tested sprays, DoubleSide): narrow lanceolate leaves
  ~6 × 1.5 cm in four orientations (u, v, both diagonals), dark grey-green above (#4d5843) and silvery below
  (#8e9581, 28 %), a dark interior where the canopy opens; the instanceColor tints them per tree.** — the olive's
  grey-green with silver glints; the card is a 0.6 m tile of sprays — billboard impostors.
- **roof_earth: rolled earth with lime worked in, roller bands, straw flecks, a few shrinkage cracks (≥ 1 texel wide);
  house_rubble: rounded, warped field stones 20–40 cm in a mud-lime mortar raked back, chinking stones, lichen.** —
  period practice for the city's houses (build-mount's request) — re-using terrain_rock on walls (stretched karst).
- **terracotta (clay orange-brown, firing clouds, grit, wheel lines), leather (the flesh side of salted hides: creamy
  pink-tan, faint vessels, wrinkles, coarse salt in patches — Middot 5:3, Lishkat HaParvah), timber_charred (alligator
  char in 4.5 × 2.2 cm checks along the grain, satin black with grey sheen, ash dusting), soot (velvety dark crust),
  rope (laid hemp strands, 45° in a square tile), timber_split (pale riven faces, torn ridges along the grain),
  timber_weathered(_v) (sun-greyed oak with checks), bread (pale unleavened crust, toasted spots, blisters, flour —
  the showbread was matzah, Menachot 5:1), frankincense (pale frosted resin tears, glassier where broken).** —
  each as requested; looks are reconstruction.
- **embers: a coal bed under a cracked ash crust; the albedo alpha is the glow mask (cracks of exposed coal and seams
  in the ash over hot coals); emissive #ff6a1f × 1400 cd/m² × the fire emission scale, updated every frame
  (env.preExposure × env.fireScale with fx's fire gain: a reference flame core held at 1.8 × the display cap).** —
  env unit convention (scene value = photometric × preExposure); fx's coal beds are 2000 cd/m² mean, the brightest
  cracks of a coal bed under ash a little lower. fx's local fire adaptation is not visible to materials (request) —
  a constant emissive (wrong by orders of magnitude between noon and night).
- **lime_whitewash_worn / _soot / _stained share the altar skin's tile and seed (stones continue across the keys):
  worn = no field-stone relief, polished in broad patches by bare feet (roughness −0.18), grime in the low spots;
  soot = grey-brown patches in faint upward streaks (at most 55 % toward #4d4844); stained = mostly washed-out runs
  and patches of dried blood (at most ~40 % toward #70372b, halved by the wash-out).** — Middot 3:3–4 (limed twice a
  year, wiped with a cloth weekly "because of the blood"), Zevachim 53a, Tamid 4:1; "very restrained" by design.
- **copper_worn: hammered copper under an even brown oxide film (partly dielectric: metalness −0.45 × film), rubbed
  bright on the high spots; gold_polished: mirror gold, roughness 0.056–0.08 incl. faint polishing streaks, its own
  weak detail preset; gold_plate_door: one beaten sheet per leaf, no seams (dishing 0.8 mm on 2.5 cm, waviness
  1.2 mm).** — Yoma 37b (the nivreshet flashes at sunrise: a mirror); door leaves crossed by wall-sheet seams read as
  tiles — gold_plate's seams at a door-panel module (door sizes differ per gate).

## Fixes

- **ash: tile-scale drifts of lighter/darker, warmer/cooler ash (±10 %) and a smaller macro scale (4.5 m); charcoal
  half as dense, mostly buried and dusted; cavity AO 0.25 (was 0.5).** — the dark bits read as pits on a 2 m repeat.
- **silver: its own set — an even, slightly warm tarnish (40 %), base roughness 0.24 (vessels 0.16).** — in daily use.
- **copper (kiyor): thinner, even tarnish (28 %, evenness 0.55), verdigris 3 %.** — the 12 cm blotches. A new metal
  parameter (uP3.y) turns the patchy tarnish into an even film; uP3.z rubs it off the high spots.
- **cedar: desaturated toward red-brown (#8e6755 / #6a4a3b / #5c3f32).** — the caps read orange.
- **timber_rough (bark): pine patches rarer, fissures and walnut furrows shallower with softer, wandering edges, plate
  contrast halved (new softness parameter; the log pile keeps the old look).** — read as reptile scales.
- **gold_relief: the keruv redrawn as a child in profile — a large round head (~1/4.5 of the figure) with a child's
  face (small nose, full cheek, almond eye, soft curls only at the back), a short chubby body in a tunic above the
  knee, sturdy bare legs, the near arm reaching toward the palm, and two broad feathered wings rising from the
  shoulder blades (coverts near the root, primaries to scalloped tips), the far wing reaching forward over the head.
  Each palm is flanked by a pair facing it; between palms they stand back to back; the sheet seams moved onto the palm
  axis and midway between the pairs, never across a figure.** — Sukkah 5b, Chagigah 13b ("ke-ravya"), Shemot 25:20
  (wings spread upward; faces one toward the other), Yoma 54a (keruvim d'tzurta); the old figure was an adult in a
  floor-length robe with a disc head (build-heichal's review). Drawing is reconstruction; no halo, no Ezekiel faces.
- **parochet: a 1 m tile (was 38 cm, whose repetition read as large chevrons across a 19 m curtain), 8 mm cords in a
  plain weave (no long twill diagonals), 16 mm twist, plies blended 42 % toward their mean (wool fuzz), and below ~4
  texels per cord the structure fades into a heather of the same mean colour.** — "fine heathered cords at 1 UV = 1 m";
  the four plies per cord (Shekalim 8:5) are kept — 12 mm twill (moire and chevrons at distance).

## Performance

- **Per-material opt-out of env's interior terms: `material.userData.mkInterior = false` (set by `outdoor: true`)
  makes the patch `#undef MK_INT` right after env's chunk, so the room test, aperture loop, probe loop and room fill
  compile out; the sky slice is still read exactly as env does (`mkInvW` = 1 / textureSize(envMap), which equals env's
  mkUnionB.w, without a uniform-block load), and on tiers with probes MK_INT comes back before tone mapping with the
  flags read once, so probe captures still apply their gain.** Set for terrain_rock, terrain_soil, terrain_blend,
  olive_foliage(_card), roof_earth, house_rubble. — materials-only, guarded: if env's chunk changes shape the opt-out
  is skipped. **A concurrent env change (render-env-2, uncommitted while this ran) reads the same
  `userData.mkInterior === false` and compiles only its room path out (`MK_NO_ROOMS`), keeping its outdoor IBL,
  probes and new fire occluders; when env's chunk contains MK_NO_ROOMS this patch defers to it and does nothing, so
  the two never stack.** — keeping both (would strip env's fire occlusion from the terrain).
- **Program variants: the patch's cache key now carries its flags (B blend, E glow, O outdoor; `mk3…`).** `?matout=0`
  and `ctx.mats.setOutdoorOpt(bool)` switch the opt-out off/on for profiling.
- **Measured (HD 4600, low, same page, opt-out toggled 4× alternately while other agents loaded the GPU): Kidron view
  looking west 42.1 vs 46.2 ms median (−4 ms), Har HaMishchah looking west 33.0 vs 38.9 ms (−6 ms).** Noisy, but 7 of
  8 pairs agree. **Corrected in materials-2-fix §10: this timed the materials fallback while env's MK_NO_ROOMS path was
  absent; on the path that ships the saving is not distinguishable from zero (0–5 ms within ±10 ms noise).**
- **Texture memory held under budget by trimming set sizes, hero sets least: herodian 2048 → 1664 px (7.8 mm/texel on
  high), relief 1280 → 1024, paving 1152 → 896, ashlar(_wash) 1280 → 1024/896, goldplate 1280 → 1024, the 768 px stone
  and plaster sets → 640, terrain_rock/soil, whitewash, logs, water a step down; the new sets sized to their viewing
  distance (altar lime variants 512–640, door gold 512, hide 512, terrain layers 640–768, roof/rubble/olive/parochet
  640).** — measured in game on high before the trims: 59 sets = 292.6 MB (budget 256); after (same set list, same
  formula as the baker): ≈ 227 MB, ≈ 248 MB once builders adopt the six keys still pending, ≈ 262 MB only if every
  key in the library were used at once. Low, measured after the trims: 54 sets = 22.0 MB (budget 48). Generation on
  low 0.45–0.56 s warm (29 generator programs compiled in parallel + basis maps), 2.2–2.4 s on a cold first start
  under the other agents' load — a global per-tier scale (blurs the hero walls as much as the props).
- **The parochet's resolution fade depends on texels per cord, so it is a heather on low and medium and woven cords
  on high/ultra (5 texels per 8 mm cord at 640 px per metre).**

## Requests

- **build-mount**: use `house_rubble` for the rubble walls and `roof_earth` for the earth roofs (they still use
  terrain_rock / ash); `olive_foliage_card` exists for near-LOD crowns. In blend mode the Kidron bed's pale gravel is
  dropped from the weights (only r/g/b exist) — fold it into the rock weight if wanted. The vegetation weight sits
  only on cultivated ground; the soil layer now carries the open hillside's dry grass and shrubs.
- **build-altar**: use `embers` for the coal beds (fire.js, kevesh.js, kitchen) and `copper_worn` for the kitchen
  vessels (they use ash / copper).
- **build-mount, build-courts, build-heichal**: use `gold_plate_door` on door leaves (mount/gates.js makeDoors,
  courts `goldLeaf` style and moked.js leaves, the Heichal's doors) — wall-sheet seams cross the panels.
- **orchestrator / builders (decision)**: course heights varying 1.0–1.2 m need the builders' set-out geometry
  (mount/walls.js, courts/masonry.js) and heichal/uv.js `ub`/`uz` to follow a course table; materials can expose
  `ctx.mats.tile(key).courses` / `courseAt(y)` and switch the layout once they do. Until then 1.1 m stays.
- **builders**: a base patina on walls needs a per-vertex height above the ground (e.g. a `color` or second UV
  channel); the material cannot know where a wall meets the ground.
- **render**: expose `ctx.fx.emissionScale` (= fx's P × fire gain, incl. its local fire adaptation) — the embers
  material uses it when present, else env.preExposure × fireScale with fx's gain formula.
- **time-env / render-env-2**: keep honouring `userData.mkInterior === false` (MK_NO_ROOMS) — materials now defers to
  it; the fallback relies on env's chunk names (`#define MK_INT`, `mkInvW`, `mkUnionA`, `MK_PROBES`). Note env applies
  the define on a scene traversal at init and on 'ready': materials made later (e.g. a quality rebuild) need it too.

## Verification

- `npx vite build` passes (output deleted). Console clean in every shot (no errors, no warnings from materials).
- Shots: `shots/materials-2/before/` (6 wall views, medium), `wip1–3/`, `perf/` (low + high, A/B), `after/` (medium:
  the same 6 wall views, terrain, Kodesh relief, parochet, altar top, preview; low: Kidron, sunrise, wall close-up).
- Console: the only errors in the final shots came from `src/sim/choreo` g5 plans (a concurrent edit elsewhere).
