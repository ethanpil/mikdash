# qa-r2-materials — decisions

Format: **Choice** — why (source / reasoning) — alternative. Fixes MAT-R2-1 … MAT-R2-6 of the second QA round. Builds on
`materials.md`, `materials-2.md`, `materials-2-fix.md`, `qa-r1-materials.md` (still valid unless noted). Owned:
`src/world/materials/**`. Shots: `shots/qa-r2-fix-materials/before/`, `after/` (the QA's own queries, `tools/shot.mjs`,
high / low, plus medium `m*`), `wip1–3/`, `diag/` (one-boot in-page A/B: a lab script kept out of the tree).
Measurements are mean sRGB over fixed screen regions of the same view.

## MAT-R2-1 — the parochet's bands

- **Not a UV or mip fault: the bands were qa-r1's design** (MAT-6: a compound weave in 64 cm bands of techelet, argaman and
  tola'at shani parted by 3 cm linen lines). The Drape's UVs are metres along the cloth's rest width and height
  (heichal/lib/kit.js `put(…, q · Wrest · A, v · H · A)`): no stretch, no wrong orientation.
- **Every cord twisted of the four materials again, in a 2/2 twill (floats two cords long), 8 mm cords, 12.3 mm twist,
  per-cord jitter of the linen share; a 1 m tile at 640 px on every tier.** — Shekalim 8:5 (72 cords of 24 threads) with
  the report's reading, Part V §13.7: "each cord of 24 threads (4 materials × 6 …)": every cord carries all four, so the
  colours mix evenly and the cloth has no stripes. qa-r1's band design was a reconstruction for legibility at 5–20 m; it
  read as broad horizontal stripes with pinstripes (and near-black bands at night) — the compound-weave reading.
- **Tones deepened so the even mix reads as materials.md's deep heathered red-violet, ≈ sRGB (109, 74, 79) far off:
  techelet #1f3a66 (a deep-dyed sky-blue, Part VII §23), argaman #4f1530, tola'at shani #8a1a24, linen #bdb39b at ~12 %.**
  — with qa-r1's brighter blue (#27477a) the even mix read lilac (104, 71, 92). Measured in the Kodesh at d3 (high):
  (113, 73, 82) head-on, (109, 70, 79) from the menorah's side. Tones: reconstruction.
- **A soft wool sheen on high/ultra (MeshPhysical, sheen colour #4a3444, roughness 0.55): dark and dye-tinted.** — QA
  asked for a sheen; qa-r1 removed a pale mauve lobe that washed the cloth to pastel. Measured in-page: this sheen moves
  the curtain's mean by ≈ 1 % (black sheen 78.8 → 79.8 luma) — a grazing lift on the folds, not a wash. Low/medium stay
  MeshStandard (the tiers differ by lighting only: low reads deep maroon, as before). The parochet now shares the linen
  keys' physical program: one program fewer on high (98/100/103 → 97/99/102 in the same views).
- Close up (`after/x-parochet-1m-d3`) the four colours show in the twist; no plaid, no stripes. Texture memory: −4.4 MB
  on high/ultra (the band design needed 640 × 1280).
- Deeper, irregular vertical folds and a heavy hem are geometry (request to build-heichal).

## MAT-R2-2 — the Kodesh gold

- **Diagnosis (in-page, d3, high): the Kodesh's light, not the gold's F0 alone.** With the gold's F0 set to white the
  walls reflect (122, 107, 104): the interior probe holds a dim, warm-red light (hue ≈ 10°). The measured gold F0 times
  that, through the AgX look, displays at b/r 0.085 (the F0 itself is 0.336): orange. envMapIntensity 0 and every scene
  light at 0 change nothing; gold roughness ×0.6 / ×1.5 changes the walls < 6 %; the relief wall's luma sd is 4.4 — the
  reflection is nearly uniform, so no roughness can make the reliefs catch highlights. That part is env-render's (request).
- **A gold-on-gold saturation limit in MK_METAL was tried and removed.** — the hypothesis (a probe bounced off gold three
  times, F0³) was wrong: the probe's radiance is near-neutral, and the limit changed nothing by day (strength 0 vs 1 identical,
  `wip1/k1`) and 2 levels at night (`diag/k3`).
- **The plating (gold_plate, gold_relief, gold_plate_door) as natural gold — gold with ~20 % silver, F0 ≈ linear (0.965,
  0.815, 0.456), #fbe9b4; the vessels and the nivreshet keep pure gold (#ffe39d).** — most ancient gold was a natural
  Au–Ag alloy; the sources name the plating's metal, not its grade (Middot 4:1, Shekalim 4:4; the report notes seven
  grades, Yoma 44b–45a). Less saturated: the relief wall at d3 (137, 89, 40) → (133, 93, 51), from the menorah's side
  (133, 83, 22) → (127, 87, 36), hue 30° → 33°; at night (50, 34, 10) → (52, 38, 16), still amber. The QA's yellow
  (#d6b04a, hue 44°) cannot be reached in that light: F0 candidates from #ffe39d to the green #f0e6a6 all display at hue
  30–33° (`diag/k3`, `diag/k4`). Reconstruction — pure gold (more orange here); a display-referred tint (not physical).
- **Roughness varied by the hammering, 0.25–0.4: each dish of the beaten sheet its own (± 0.03) and the ridges between
  dishes rougher (+ 0.05), base 0.30 (mean ≈ 0.33, was ≈ 0.26 with the 0.85 multiplier, now 1); the relief: raised work
  0.27, hammered ground 0.36, ± 0.025 blow to blow.** — QA: "roughness 0.25–0.4 varied by hammering". A first try at
  ± 0.045 read as a sponge mottle under the night lamps (an intermediate pass); the per-sheet variation stays
  ± 0.005 (materials.md: larger per-sheet variance read as a checkerboard from 20 m).

## MAT-R2-3 — dashed black marks on the Nikanor frames

- **Not a material fault; nothing changed in materials.** Reproduced on high and low (`before/h05`, `l05`), then:
  `?mattex=0` (every library material flat, no textures at all) — the dashes stay, identical (`diag/frame2/l-mattex0`);
  `?intshader=0` (env's interior patch off) — they stay; the renderer's shadow map off — fewer, but some remain
  (`diag/frame3`). The frames are `marble_white` (a monolithic set with no joint grid and no arris wear: MAT-1's wear is
  only in the Herodian kind). The marks lie along the 2–4 cm step faces between the door case's fasciae
  (courts/masonry.js `doorCase`: three abutting boxes per side; the wickets' cases sit beside the gate's), so the likely
  causes are coplanar / overlapping faces (z-fighting) and shadow acne on those thin faces at grazing sun (d2: sun
  altitude 20°, azimuth 123°). Request to build-courts (geometry) and render (shadows).

## MAT-R2-4 — the blue-grey and beige patchwork

- **The per-stone hue cast now runs from warm cream to neutral only (`mix(1.025, 1, 0.96) … (0.99, 1, 1.01)` at 0.5; was
  ±2.5–3 % into a cool grey at 1.0), and the patch's per-stone hue ±0.5 % (was ±1.5 %); value variation unchanged
  (±3.5 %, kochla ±5 %).** — the cool half of the range drew blue-grey tiles in shade and before dawn.
- **Kochla's ground carries the shayish's warmth, a little deeper in value (#d7d2c6), and its grey-green lives in the
  bedding layers (band #c3c7be): the colour varies within each stone, as in the banded green marbles (cipollino); its
  "nearly grey" blocks greyed toward a warm grey.** — Bava Batra 4a's "waves of the sea"; QA: no block reads as a
  different colour. Alternative: keep a block-wide cool cast and only weaken it (it still reads as tiles in shade).
- Results: in direct sun (h07, 07:25) kochla blocks' b − r −35 / −34 against the shayish's −42 (2.7–3.3 %) → −43.5 /
  −41.4 against −42.6 (< 0.5 %); cell-to-cell b − r sd over the wall 3.02 → 1.30, luma sd 3.54 → 3.63 (value variation
  kept). Before dawn (default view) 4.99 → 4.51 and in the north wall's shade 5.23 → 4.23: what is left in shade is
  per-stone value and the set-out courses (`after/h01-default`).

## MAT-R2-5 — the Mount pavement's checkerboard

- **Slab-to-slab value ±3 % in all: a close palette (#d4cab5 / #cec4af / #d6cfc0, was #c2b7a0 / #d8d3c6 ±7 %), ±2.5 %
  per slab (new paving parameter uP3.x; was ±9 %), the warm-tinted slabs at 40 %, stains 0.08 (were 0.14), the patch's
  per-slab tint ±1.5 % / hue ±0.4 % (were ±6 % / ±1.5 %).** paving_azarah keeps its look (parameters default to the old).
- **Every row draws its own slab-length window (0.75–1.5, 1–2, 1.25–2.5 or 1.75–3 m; 25 cm start quantum).** —
  `masonryLayout({ rowLens })`, a separate RNG stream, so every other masonry set keeps its layout exactly.
- **Dust and wear over 20–60 m: paving_mount's macro preset `MAC.mount` (150 m period, 4 base cells: ~37 m features with
  octaves to a few metres), ±4.5 % albedo and 40 % toward a warm grey-brown dust; and the routes worn by the crowds —
  from each Chuldah passage's exit (Middot 1:3, the people's entry and exit) to a point outside the soreg's south-east
  corner, then north to the foot of the chel steps (Rambam BhB 6:1) — paler (+6 %), smoother (−0.07), with less dust, a
  7 m half-width with wandering edges.** Placed from site.js (`context.chuldah.tunnel-*.params.exit`,
  `mount.soreg.params.path`, `mount.chel.steps.params.foot`); checked with the lightening exaggerated
  (`diag/pave1/b-wear-exaggerated`). The route is a uniform-gated branch in the shared patch (`mkWear`), not a program
  variant: every patched material carries zero route uniforms (programs are shared, so a missing uniform would inherit
  the pavement's). Route geometry and widths: reconstruction.
- Results (aerial, d3, 500 × 120 px of plaza): pixel luma sd (the checkerboard) 5.79 → 3.30 on high, 3.11 → 2.66 on low;
  the 25 px-cell sd (the 20–60 m drift) 0.88 → 1.82, 0.79 → 1.96.
- **On the coarse tier (texels ≥ ~4 cm: low) the paving joints widen to half a texel (both sides together) and their
  arris to 0.6 texel, shallower and at a lighter tone (both paving keys).** — the 2 mm joints are sub-texel there: with the slab tints now close, the low
  default view showed a smooth floor crossed by stray joint dashes (an intermediate pass).
- **No negative mip bias.** — none exists in the materials; near the camera anisotropic filtering and the detail layer
  keep the slabs crisp, and a bias would bring back the far shimmer.

## MAT-R2-6 — the marmara veins

- **A branching, multi-scale vein network in `marble()` (glsl.js, shared by the Herodian walls, the paving and the
  monolithic marbles):** primaries from the smooth channel sampled anisotropically (0.3 × 2 cycles/m, warped; marmara
  4–12 mm across, shayish 3–9 mm, swelling and thinning along their length) with a faint 12 mm halo; secondaries from the
  rough 6-octave channel at ~2.3× the frequency, shown mostly within reach of a primary (they leave it as branches) and
  here and there free, thinner and fainter; the old hairlines very faint. Widths are physical: distance = |n| / |∇n|
  with ∇n by finite differences in the noise domain (+4 basis fetches; screen derivatives would jump at the joints).
  Lines are drawn at least 1.4 texels wide at proportionally lower contrast (a 1-texel line beaded into dots). — the old
  veins were |n| thresholds in noise units with a 3.2× halo: a few thick, isolated squiggles. Loop-free; generator only.
- Result (`after/z-h06-wall` vs `before/`): thin dark primaries with branches and a fainter secondary family, the
  per-stone marble mix of MAT-1 unchanged. Zero sets of 2-D noise still close into a loop now and then.

## Performance

- Programs: −1 on high (the parochet joins the linen physical program); low unchanged (72). No new variant: the route
  wear is a uniform branch in the plain stone program.
- Per fragment: every patched material +1 uniform test; paving_mount +3 segment distances (~25 ALU). Generators: the
  marble kinds +5 basis fetches (bake time only).
- Texture memory: −4.4 MB on high/ultra (parochet 1 × 1 m); the paving layout LUT 80 × 8 texels (was 40 × 8).
- `node tools/warmup-check.mjs` (cold production boots, every tier × shot / play): ALL PASSED — first frame after
  'compiled' +126 / +145 ms low, +465 / +492 medium, +943 / +1050 high, +1097 / +1321 ultra; low's first view 18.4–18.8 s
  (17.5–18.9 s on a re-run after the last paving edit) with other sessions rendering on the same HD 4600 (qa-r1 measured
  16.6–17.1 s under similar load; not separable from the load here).

## Requests

- **build-courts / render (MAT-R2-3)**: the dashed dark marks along the Nikanor door cases and wicket frames are not
  textures (identical with `?mattex=0`). Check `masonry.js doorCase` for coplanar / overlapping faces between the abutting
  fascia boxes and between the wicket cases and the gate frame (z-fighting), and the sun-cascade bias on 2–4 cm faces lit
  at grazing incidence (`at=284,330&look=270,4&t=d2`, high and low; with the shadow map off fewer marks remain).
- **env-render (MAT-R2-2, the lighting part)**: in the Kodesh by day the light the gold reflects is dim, warm-red and
  nearly uniform: a white mirror on the walls shows (122, 107, 104); the reliefs' luma sd is 4.4; env-map intensity and
  every scene light at 0 change nothing (all of it is the interior probe). The daylight through the great gate (QA
  ENV (c)) should reach the walls as brighter, whiter reflections toward the east end; and the AgX look takes gold's F0
  (b/r 0.336) to b/r ≈ 0.085 on screen — the "flat orange paint". With a more neutral, contrasted probe the natural-gold
  F0 and the hammered roughness will read as the yellow gold the QA asks for (#d6b04a).
- **build-heichal (MAT-R2-1)**: deeper, irregular vertical folds and a heavy hem for the parochot (kit Drape) — the
  even-mix cloth now relies on its folds for life.
- **orchestrator (docs)**: docs/API.md "Gold" line — gold_plate, gold_relief and gold_plate_door now use a natural-gold
  F0 #fbe9b4 (~20 % silver); gold_vessel and gold_polished keep #ffe39d. CLAUDE.md lesson: the parochet is the four-ply
  even mix (Shekalim 8:5 / Part V §13.7), not qa-r1's bands.
