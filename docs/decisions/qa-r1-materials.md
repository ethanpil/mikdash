# qa-r1-materials — decisions

Format: **Choice** — why (source / reasoning) — alternative. Fixes MAT-1 … MAT-8 of the first QA round. Builds on
`materials.md`, `materials-2.md`, `materials-2-fix.md` (still valid unless noted). Owned: `src/world/materials/**`.
Shots: `shots/qa-r1-fix-materials/before/`, `diag/` (in-page experiments), `wip*/`, `after/` (`tools/shot.mjs`).

## MAT-1 — Herodian ashlar (margins, per-stone colour, edge wear, wall-foot dust)

- **The marble is chosen per STONE, not per course: shayish ~53 %, marmara ~30 %, kochla ~17 % (hash per block).** —
  Rashi on Sukkah 51b, on "like the waves of the sea": "the stones differ in appearance one from another, and the eyes
  looking at them wander"; his "apik shefa" there is "a row of stones set in and a row set out", so the courses alternate
  in plane, not in colour. A course of one marble drew a blue-grey stripe across every wall (`before/m1b-15steps`: the
  kochla courses 6 % darker and greyer than the white along their whole length). Shares: reconstruction. — keep course
  colours and only weaken them (the report's matrix says "courses of white, blue-green and veined marble"; Rashi is
  the more specific source for how the colour was distributed).
- Result (`after/m1b-15steps`, the court walls at d3): the spread of row-mean luma down the wall 5.74 → 3.43 and of its
  blue cast (b − r) 2.87 → 2.02 — what remains is the set-out courses' geometry and the cornices.
- **The course table keeps its nominal marble per row** (`ctx.mats.courseAt(key, y).type`, heichal/uv.js picks rows by
  it) — API unchanged; the texture just no longer paints the row in that marble.
- **Kochla a little closer to the white (≈ 0.2 stop under it, was 0.3): #d0d3cc / band #c7ccc5 / streak #dddeda;
  stone-to-stone tone ±3.5 % (kochla ±5 %), hue cast ±2.5–3 % (uP3.z 0.6 → 1); the shader patch's per-stone variation
  ±3.5 % (was ±6 %).** — QA: vary hue and value per block by ±3–5 %; scattered stone by stone, the deeper kochla read
  as a patchwork in shade under blue skylight. Also used by marble_kochla (one palette by design).
- **Drafted margins on the inner / court faces too** (`herodian_wall_inner*`: comb on, margin 10 cm (8–12 per side),
  boss raised 12 mm with shallower pits; the outer faces' margins also 8–12 cm now, was 8.3–13.8). — QA: margins
  wherever the research has dressed Herodian ashlar, retaining and court walls; the court walls are the same Herodian
  masonry (Part VII §21 #10, Part V §13.11). Dimensions and the lower inner boss: reconstruction. Not on the
  whitewashed Heichal (`heichal_whitewash`, the ashlar kind — Middot 3:4) nor on the altar.
- **The inner sets at 1280 × 1300 px (was 896 × 910): 10 mm per texel on high.** — at 14.5 mm the 4 cm bevel was ~3
  texels and the boss's 2–3 cm pits faded out: the first try showed only a faint line (`wip2/m1a`). +9 MB on high,
  +2.2 on medium, +0.6 on low (only the course-table set is baked in the scene).
- **Margins fade out where the narrowest margin is under ~2 texels** (`mOn`, smoothstep 1.5–2.5 texels): the low tier's
  inner faces (4 cm texels) keep an almost plain face, its outer faces (3.1 cm) keep their margins. — a 1–2 texel
  margin draws a printed outline round every stone (rejected in materials-2).
- **Worn arrises: along the joints, a 2.2 cm band (≥ 2 texels), gated sparsely along its length and heavier toward the
  corners, is chipped back ~2 mm, ~3.5 % paler (fresh stone) and +0.07 rougher.** — QA: arris edge-wear mask. A denser,
  5 % paler first try drew a pale double line along every joint (`wip3/m1a`: the "picture frame" of materials-2).
- **Dust and splash over the bottom 0.5 m of every Herodian wall, densest at the foot (up to ~20–30 % darker, warm
  grey-brown, +0.05 rough), and a contact-AO band over its bottom 16 cm (indirect light × 0.55 at the foot)** — patch.js
  `MK_FOOT`. The floor beside each face comes from a floor map built from the nav grid's main layer (0.5 m cells: the
  lowest and highest walkable floor per cell over site −20…520 amot, RG32F, 2.1 MB; cells the walking grid leaves empty
  beside walls take their neighbours' floors): the fragment's own normal (screen derivatives of its world position),
  0.35 m out, the higher floor if it lies below the fragment, else the lower one. Vertical faces only. Built in an idle
  slice once nav is ready, rebuilt when nav rebuilds; fades in over 1.5 s (until then off). — materials-2 had left the
  base patina out because the texture does not know where a wall meets the ground (Mount 0, courts +6/+16 amot, the
  valley); a world-height band is wrong on every terrace, a per-vertex attribute needs every builder. One texture fetch
  + ~25 ALU per wall fragment; the `F` flag joins the Herodian walls' existing programs (no extra program).

## MAT-2 — the outer altar

- **The lime is off-white (#ece7dc, was #f3f1ea) and the limed mass swells ±1.3 cm over ~0.4–1.5 m (uP3.w) on top of
  the stone pillows; fine crazing on all the altar's lime (was only on the walking surfaces), faded where a hairline
  would be wider than ~1 cm; the lime thinner over the stones' crowns (stone tone through ×1.5) and grime in the hollows
  between them ×1.5; cavity AO 0.7.** — Middot 3:4 (plastered twice a year, no iron trowel), Zevachim 54a (whole stones
  "large and small" in a lime slurry). Amplitudes: reconstruction.
- **Soot, ash crust and the altar frame from the site model** (patch.js `MK_ALTAR`, the five lime keys; one shared
  program): soot darkening rising from above the chut hasikra to the top (up to ~25 % darker), more within ~2–3 m of each
  ma'arachah (site.js `altar.maarachah-area` piles: great, incense, kiyum ha'esh), patchy and in vertical streaks
  (smoke rises straight up — Avot 5:5); an ash crust (grey, rougher) on the faces' top 0.45 m, the walkway's outer
  0.5–0.9 m and down the four corners, not on the horns. — QA: soot toward the top and above each ma'arachah, ash on
  the top edges and corners. Restrained: wiped every Erev Shabbat (Middot 3:4, Rebbi), relimed twice a year.
- **Blood stains darker and more present** (`lime_whitewash_stained`, already placed by build-altar on the S and W
  yesod, the NE / SW corners below the line and the horns' heads: Zevachim 53a, Tamid 4:1, Middot 3:1): dried blood
  #5a2820 (was #70372b), wash-out 0.25 (was 0.5), up to 62 % cover (was 42 %). — "very restrained" read as clean.
- **The chut hasikra is untouched by the soot (it starts 0.4 m above the line) and keeps the whitewash's skin.**
- **A broader hand-limed variation on the altar's lime (`MAC.altar`: albedo ±6 % over ~5 m, tint 0.3; was the plaster
  preset's ±2.5 % over 9 m).** — coats of lime applied by hand, older and fresher patches; in shade under skylight the
  face otherwise read as one flat grey (`before/m2a`). Measured on the 40 m view at d2: luma std over the lower body
  4.9 → 5.5, upper body 3.4 → 4.6, the upper body ~8 % darker than the lower (soot).

## MAT-3 — gold in the Kodesh

- **Diagnosis: the "white-hot" top half of the golden altar at d3 is not the coal bed** — no `g3.mizbach-hazahav.coals`
  fire is live at d3 (`diag/d-coals-d3`: `fx.list()` empty). It is the sunlit doorway reflected by the gold through
  env's interior probe (the sheet's east face at a grazing angle), clipped to white by the tone mapper.
- **Metal environment reflection treatment (patch.js `MK_METAL`, a uniform on every metal key; gold `[0.6, 0.18, 6]`):
  a COOL (sky-blue) cast in the IBL radiance and in the ambient is 60 % desaturated (warm light is left alone), the
  reflection is blended 18 % toward the mean ambient (a broad second lobe: beaten, not mirror, gold), and its peaks are
  soft-capped at ~7× the mean ambient.** — gold's colour comes from its F0 (#ffe39d, measured), so a neutral reflection
  stays gold; the cap keeps a bright doorway in interior gold saturating as gold, not white. A rendering approximation
  (energy is not conserved exactly), logged as such. The first try desaturated every reflection: candle-lit gold
  reflecting gold lost its amber and the Kodesh at night went silver-grey (`wip2/m3c` (44, 43, 43); in-page A/B with the
  term off, `diag/ab-m3c-off`: (38, 17, 1)). — a darker / more saturated F0 (not physical), or more roughness everywhere
  (dulls the plated walls and floor).
- **The coal bed itself is fine**: at sunrise + 80 (`after/m3e-heichal-sr80`, `g3.mizbach-hazahav.coals` live at 0.61)
  it is a small glow on the altar's top with no bloom halo; at sunrise + 55 the pan coals are a lamp on the floor. No
  request to env-render for it.
- Results: the golden altar's east face at d3 (250, 243, 223) clipped → (225, 206, 161); against the doorway from the
  west (157, 143, 123) grey-beige → (115, 86, 56) bronze-gold; the Kodesh walls at n3 (45, 25, 2) → (59, 35, 0) amber,
  the altar's night face smooth dark gold, no longer streaked.
- **Gold detail layer gentler (`DET.gold`: normal 0.16, albedo ±0.6 %, roughness ±0.03; was the metal preset's
  0.35 / 1.5 % / 0.08)** for gold_plate, gold_plate_door, gold_relief and the vessel golds. — the "rusty" mottling at
  night was millimetre noise in normal and roughness breaking the menorah's reflections into blotches.

## MAT-4 — gold-plated gate leaves in shade

- **The same `MK_METAL` gold treatment.** — blue skylight times gold's F0 (1.0, 0.77, 0.34) is olive-green; the
  desaturated reflection plus the warm mean-ambient lobe keep the leaves yellow-bronze in shade. Moked gate at d3: door
  pixels (66, 80, 70) hue 140° → (102, 91, 60) hue 44°; the north faces at d9 (Moked, Korban) and Nitzotz at d3 read
  bronze-gold on high and low (`after/m4*`, `after/l-m4*`). No change to roughness: the gold leaves keep their sheen.

## MAT-5 — Beit HaMoked dome

- **`roof_plaster` is now its own outdoor-only key (same `roof` texture set; `userData.mkInterior = false`, env's
  `MK_NO_ROOMS`), no longer an alias of `roof_tile`.** — every face that uses roof_plaster is a building's top (courts
  shells' `top`, the Moked hall and dome, the Heichal and Ulam roofs); the dome's outer shell lies deep inside the
  Moked hall's room box (volumes.js treats only outward faces within `shell` m of the box boundary as outside), so env
  lit it as interior. `diag/d-dome-outdoor` (roof material flagged outdoor in-page) proves the cause. No builder change
  needed. roof_tile (stoas, Mount chambers, gates, city) is unchanged. — a separate `roof_dome` key and a one-line
  swap in courts/moked.js (needs build-courts).
- **The outer dome's winding is correct**: moked.js `dome()` emits the outer quads (p00, p01, p11) whose cross product
  points outward in site space, and site → world is a proper rotation (x = X, y = Z, z = −Y).

## MAT-6 — the parochot

- **Woven as a weft-faced compound weave: every pass carries one six-ply thread of each of the four materials
  (4 × 6 = 24 strands — Shekalim 8:5, Yoma 71b) and the design brings one of them to the face** (the others float
  behind, which is how a ma'aseh choshev cloth has two different faces — Yoma 72b). — the old reading, every cord
  twisting all four plies, averages to a flat mauve at any distance; QA asked for the four colours to read at 5–20 m.
  The compound-weave reading of the 24 strands is reconstruction.
- **Design (reconstruction): broad horizontal bands on a 2 m repeat — techelet 64 cm, shesh 3 cm, argaman 64 cm,
  shesh 3 cm, tola'at shani 63 cm, shesh 3 cm — their edges stepping by one pick along a 6.25 cm zigzag, and ~20 % of
  the hidden passes' colours showing through the binding; no figures.** — the plainest design a compound weave makes;
  figures are not attested for the Second-Temple parochot (Rashi's lion and eagle illustrate the technique). Tones,
  deep-dyed: techelet #27477a (sky-blue), argaman #481836, tola'at shani #7a1824, shesh #bdb39b (natural linen). A first
  try with a 1 m repeat of 30 cm bands in clean, brighter tones read as candy stripes across the 19 m Devir curtain
  (`wip2/m3a`, `wip2/m6a`).
- **The parochet set is 1 × 2 m at 640 × 1280 px on high/ultra (+4.4 MB); medium and low keep 640 × 640, where the 8 mm
  picks fall under 3 texels and fade into each band's own colour** — same bands and tone on every tier.
- **The two faces are not differentiated** (one texture on both sides of the double-sided cloth). — would need the
  builders to mark the back sheet (a UV offset) for a per-face palette swap.
- **No sheen lobe on the parochet (all tiers MeshStandard).** — on high/ultra the mauve sheen washed the cloth to pastel
  pink while low showed dark maroon (`before/m3a` (131, 86, 113) vs `before/l-m6` (49, 26, 34)); the band pattern and
  the 640 px minimum are the same on every tier, so the tiers now differ only by lighting. Applies to every user of the
  key: the Devir pair, the Ulam curtain (heichal kit default) and the gate curtains (courts `Curtains`).

## MAT-7 — low tier: bronze doors, paving

- **Corinthian bronze on low: roughness ×1.8 (0.27 → 0.49) and a stronger environment treatment (desaturate 50 %,
  45 % toward the warm mean ambient, cap 5×)** (`SPEC.low`, re-applied on a tier switch). — the low tier's coarse
  environment reflected as brown and teal clouds in the polished leaves; a baked fake-highlight albedo would be wrong
  on the other tiers. On medium+ the bronze gets a lighter treatment (35 % / 12 % / 9×).
- **Paving on low: the slab-to-slab palette and value spread halved where the texture has ≥ 3–4.5 cm texels (the low
  tier only), and the shader patch's per-slab tint halved there.** — at 4.8 cm per texel the mottling inside each slab
  is gone and the slab tints alone drew a checkerboard (`before/l-m7b-default`).
- Results (low): the Nikanor leaves' luma std 25.9 / 14.2 → 4.3 / 5.9 (left / right leaf, `l-m7a`), an even warm bronze;
  the default view's paving luma std 5.6 → 3.5 at the same mean (`l-m7b`).

## MAT-8 — the grey streak in Beit HaChalifot

- **Not a weathering pattern in the material: it is a specular reflection from env's interior probe, so the asked
  fix (no run-off weathering on interior faces) does not apply.** The herodian kind's only streaks are a few faint
  11 cm ones on the top 0.5 m of set-out courses. `diag/`: the streak moves with the camera (`d-chalifot-shift`, 2 m
  east → it moves a niche), stays on the key when it is tinted (`d-chalifot-tint`: `herodian_wall_inner_courses`),
  disappears with roughness 1 (`d-chalifot-matte`) and narrows to a highlight with `probes=0` (`d-chalifot-noprobe`).
  With the drafted margins it now follows the stones: the rough pecked boss (0.8) shows a darker, sharp-edged patch
  where the smoother margin (0.55) does not (`after/m8`: 18 levels under the next stone; the band was 13). A darker
  reflection that gets sharper-edged at HIGHER roughness points at the probe's prefiltered mips (a seam or dark padding
  read at that direction), not at the surface. Left to env-render (request); no material change.

## Performance

- Draw calls: unchanged on every view, both tiers (low: 243 / 254 / 149 / 256 / 92 before and after; high: same-view
  counts equal where the frame captured the same shadow updates).
- Programs: +1 on high (96 → 97): the altar's five lime keys share one `A` program (they shared the plain stone program
  before); the Herodian outer and inner walls now share one (`CRF`) instead of two; metal and foot flags add none.
- Textures: +9 MB (inner Herodian sets) and +4.4 MB (parochet) on high, ≈ +0.6 MB on low; the wall-foot floor map is
  2.1 MB (RG32F, all tiers), built once in an idle slice after nav is ready.
- Per-fragment: the Herodian walls +1 texture fetch and ~25 ALU (foot); the altar's lime ~40 ALU + 1 fetch; metals ~20
  ALU (uniform-driven, no branch on a texture).
- `node tools/warmup-check.mjs` (cold production boots, every tier × shot / play): ALL PASSED — first frame after
  'compiled' +91 / +117 ms low, +623 / +509 medium, +1014 / +964 high, +1363 / +1117 ultra; low's first view 16.6–17.1 s
  with other sessions rendering on the same HD 4600. `vite build` passes.

## Notes

- One high shot in the final batch (`after/m2a`, first run) came out black after a WebGL context loss
  (`CONTEXT_LOST_WEBGL: loseContext: context lost`, from render/detect.js's benchmark context being released after a
  GPU reset); the rerun is normal and wip2/wip3 rendered the same view — several sessions were rendering on the shared
  HD 4600 at the time.

## Requests

- **env-render**: the interior probe reflection in Beit HaChalifot (`at=168,369,22&look=0,5&t=d3`): a ~2 m wide,
  sharp-edged darker band in the IBL that moves with the camera and is darker and sharper at roughness 0.8 than at
  0.55 (`diag/d-chalifot-*`, `after/m8`) — the probe's prefiltered mips look wrong in that direction (seam / dark
  padding / un-blurred high mip).
- **orchestrator (docs/API.md)**: `herodian_wall_inner` now has drafted margins; `roof_plaster` is an outdoor-only
  key of its own (not an alias); new `ctx.mats.footReady` (Promise) and `ctx.mats.stats.footMB`.
- **build-heichal (optional)**: the Ulam rovadin mapping (heichal/uv.js) picks texture rows by their nominal marble;
  the stones in a row are now mixed (per-stone marble), so the "shayish → kochla → marmara rovad cycle" comment no
  longer describes what is drawn.
