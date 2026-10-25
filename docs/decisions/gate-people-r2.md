# gate-people-r2 — decisions

Round 2 of the final QA gate for area `people`: the re-check's "Figures still read as mannequins at the Go distances:
orange flat faces, beanie hair caps, cardboard mantles" (high) and "Figures walk through the camera; the near plane
slices the head open" (medium). Format: **Choice** — why — alternative. Builds on `gate-people.md` (still valid unless
noted). Shots: `shots/gate-people-r2/` — `before/` and `a2/` (app, the QA's three queries, `--q high` and `--q low`),
`a3/` (final), `h/` (people harness close-ups; `h/before/` is the state at the start of this task), `cmp/` (crops).

## Mantles (human.js `mantle`)

- **The drape is in the geometry, not in fold shading.** The old drape put 13 + 22 radial ripples round the body; on
  LOD1's 32 columns (≈ 6 across a front panel) the finer family aliased, and what read was crease shade on a flat panel.
  Now heavy wool falls in a few deep folds with rounded ridges and narrow valleys (two families, ≈ 12 and 7.5 cm apart,
  ≈ 4.5 cm deep at LOD0, 4.2 at LOD1, one family ≈ 23 cm at LOD2). The cloth only stands **out** from its clearance
  (valleys lie on it), so nothing sinks into the tunic. Depth grows from nothing on the trapezius to full half a metre
  below the shoulder, and on the front panels the folds fan out from the shoulder (their phase pulled toward it near the
  top). Valleys are shaded in the vertex colour (every tier). — A load-time cloth relaxation per rig pose (the QA's
  proposal): the rest rig is an A-pose and the sheet is skinned. A relaxed sheet only forms folds where it has more cloth
  than its support, and that excess is exactly what these folds author. It would have meant a solver in the bake worker
  for a result that a few authored functions already give deterministically.
- **More columns where the panels are**: LOD0 56 (was 44), LOD1 40 (was 32). Two or three folds now cross a front
  panel. Mantle +768 / +416 triangles; with the crown tufts (below, +264 / +144) the Israelite's LOD0 / LOD1 go
  22680 / 6872 → 23712 / 7432 (+4.5 % / +8 %).
- **The hem follows the folds** (±1 cm, a wavy edge, tzitzit corners on it). **The front edges cascade**: a slow zigzag
  of ±0.1 rad as the edge falls, which the rolled hem of gate-people follows.
- **The top edge lies round the neck** (`bodyAt` from the collar ring, was the 'trap' ring 55 % out to the shoulder).
  There it stood ~5 cm off the neck as a wide yoke with the dark lining showing across the shoulders. The lining is
  lit where it turns over at the collar (0.86) and dark where the cloth hangs (0.62). **The rows gather toward the
  shoulders** (`t = (j/nv)^1.45`). With the edge on the neck, evenly spaced rows cut a chord through the tunic's
  trapezius, and the tunic poked through the mantle as light flakes (seen on low; fixed).
- **The shoulder's corner is bridged**: a ~5 cm fillet where the flat top of the shoulder meets the arm, over the side
  columns. The silhouette was a horizontal top, then a vertical drop (the "square yoke").
- **LOD2: 14 × 6 with its inner face and the arm drape** (was 7 × 4, single-sided, no arm push). Low draws LOD2 from
  ≈ 9 m, which covers the d4 offering view. There it was a flat brown board, and a front panel went missing wherever
  its inside faced the camera, with the forearms showing through. +280 triangles per Israelite at LOD2 (732 → 1012).
  LOD3 stays a plain 5 × 3 sheet.
- **Wool sheen 0.45 → 0.2** (material.js pattern 3/15/6). The sheen lobe lit the mantles' turning edges on high as a
  satin rim: plastic, cardboard.
- Not done: swag folds across the back between the shoulders, and an arm-driven fold layer at the elbow (would need the
  bend per vertex). The mantle's form (symmetric, open in front, four corners in front) is the people.md
  reconstruction and is unchanged.

## Faces (material.js pattern 19/25, roles.js, human.js ears)

- **Skin palette less saturated again**: `#c0a08b` / `#7b5c49` (HSV saturation ≈ 27 % / 40 %, was 35 % / 49 %). This is
  still "olive to light brown" (roles.js header). The colour now comes from the zones: the cheeks, nose and lips'
  surround flushed redder and wider (×(1.08, 0.92, 0.9)); the ears redder ([1.1, 0.92, 0.88], were [1.05, 0.95, 0.92]);
  the jaw and upper lip cooler and darker (×(0.86, 0.9, 0.98) at 0.7, was ×(0.92, 0.945, 1) at 0.6, a man's beard
  shadow). Measured in the app at d2 (high), the cheek's sRGB saturation went from 0.48–0.52 to 0.39–0.47. What remains
  is the warm low sun.
- **Facial planes in the value**: the whole orbital recess darker (17 %) under a lit brow ridge (+7 %), the cheekbone
  top and the nose bridge catching light (+6 %), the hollow under the cheekbone (10 %, 4 % under a beard) and the
  temples (8 %) darker. These are painted on every tier (full on LOD1, ⅔ on LOD0, whose modelled sockets add their own
  shade). The analytic relief of gate-people only shades with P_DETAIL and is too soft at 2–8 m. — The QA's baked normal
  and cavity map per head variant: rejected in gate-people (a sampler per program, and it would not follow the
  continuous face morph). This round adds the value pass that the relief alone lacked.
- **LOD1's painted eye at its own value**: the sclera is a lid-shaded off-white (65 % toward (0.46, 0.43, 0.40)), no
  longer skin a shade lighter. The iris is dark brown with a darker rim. LOD0's socket shade is 0.12 (was 0.1).

## Hair (material.js pattern 9, human.js `hair`)

- **Clumped locks instead of ruled lines.** Pattern 9 drew two sines across the hair (≈ 1.9 cm and 0.24 cm periods),
  which read from 2–4 m as a cap ruled with lines. The cap's vertex streaks were a regular 19-period wave. Now the hair
  is cut into locks along its fall: ≈ 2.2 cm wide with wavering edges, each lock segment (≈ 5 cm, staggered per lock)
  its own tone, dark partings, rounded relief, and finer locks inside within reach. All of it fades to its mean before
  it aliases. The vertex tone follows smooth value-noise lumps (every tier, the low tier's only hair detail).
- **A lumpy cap**: the cap's offset is lifted by value-noise lumps (periodic in azimuth, so the wrap seam stays closed),
  0.45–1.5 × its volume (was a product of two sines, ±0.4). The cap is clamped at 1.5× (≈ 1 cm) because a head-cloth
  lies 1.2 cm off the head and the hair stays under it.
- **Tufts over the crown and temples**: 22 at LOD0, 12 at LOD1. These are longer locks lying along the fall from the
  whorl, tips lifting up to ~1.2 cm off the cap, alpha-tested like the shells (none on low). They break the dome's
  outline against the sky.
- **New group `GRP.HAIR_OPEN` (11)** for hair standing proud of the cap: the crown tufts, and now also the shells of
  grown hair. The vertex shader draws it only with the hair grown (mask bit 6) and no head-cloth on (bit 2). Before,
  the shells (up to 1.3 cm out) pierced an Israelite's optional head-cloth as dark specks on its crown. A bare kohen's
  shells stay in his BARE group. There is no mask bit of its own, so system.js mask code is unchanged.

## Near the camera (system.js, material.js)

- **A figure the camera comes close to dithers out**: the near plane cut a passer-by's head open (the QA's 05c frame).
  The test uses the camera's distance from the body: a capsule of 0.24 m about the figure's up axis, from 25 % of its
  height to the crown (an animal: a ball about its middle). The figure goes out below 0.55 m from the body (≈ 0.8 m
  from its axis) and comes back in beyond 0.75 m, the hysteresis keeping a figure on the boundary from flickering.
  Temporal like every people fade (FADE_S 0.25 s, snapping in stills and on jumps), so nothing is left half-dithered
  while the clock stands still. The alpha-tested IGN dither costs no blending. The camera position is
  `ctx.camera`'s, which the system already reads every frame, so no request to player/core was needed.
- **It keeps its shadow**: a near-faded figure is pushed with `pAnimA.w = 2 + alpha`. The colour pass reads
  `w > 1.5 ? w − 2 : w` and the depth pass's "w < 0.5 casts nothing" test is unchanged. On low, LOD0 has no dither
  define, so a fading hero drops to LOD1 there (medium and up keep LOD0, whose program dithers). Held props are let go
  below half alpha (props do not dither).
- Not done: steering walking figures around the player (that belongs to the sim's paths; the fade covers it wherever
  they pass).

## Dev

- `src/people/dev/harness.js`: `&env=<intensity>`. The RoomEnvironment's light boxes print blocky white highlights
  through the rough mips. That looked like gloss on the cloth in harness close-ups, but the app's environment is the
  sky. Also note that the harness's 2.4 cm shadow texels dapple figures on medium+, so judge cloth on low there, and in
  the app.

## Verification
(2026-10-25, HD 4600, a machine shared with other sessions)

- **Repro** (`before/`): the QA's three queries at high and low. Faces one orange-tan (cheek sRGB saturation 0.48–0.52),
  hair caps ruled with lines, mantles as flat panels with a square yoke, low d4 owners' mantles as flat brown boards.
  The crowd differs from run to run at d2, so the QA's 0.3 m passer-by was reproduced by standing the camera 0.3 m
  from a figure (`near-eval.js`).
- **After** (`a3/`, crops in `cmp/final-*.jpg`): mantles with rounded shoulders, folds, cascading front edges and
  uneven hems on both tiers (`final-low-landing-near.jpg`, `final-d4-owners.jpg`; low's d4 boards are gone). Faces less
  saturated (0.39–0.47) with flushed cheeks and nose, cool jaw, readable eye whites and orbital planes. Hair broken into
  locks with tufts on high (`h-head-l0.jpg`, `h-head-l1.jpg`); low's LOD1 cap is lumpier and toned along the fall, but
  without shells or a pattern it still reads as a smooth cap (`h-head-l1.jpg`, last panel).
- **Near camera**: app (`a3/near/`), the camera stood 0.3 m from the nearest figure → its near alpha 0 on high (a guard
  Levite with a torch) and on low (an Israelite; what stays in frame is his lamb at 1.3 m). Harness (`cmp/h-near.jpg`):
  gone at 0.3 m on both tiers, drawn at 1.2 m.
- **Cost**: low draw calls 246 / 254 / 244 (unchanged), triangles 0.641 / 0.686 / 0.671 M (+0.3 %). High main pass at
  the d4 view 641 calls / 4.17 M (before 641 / 4.16 M); its frames alternate with 1175 / 8.02 M ones, the cascade
  shadow refresh (sampled over 24 frames: same cadence as before). Israelite LOD0/1/2 22680 / 6872 / 732 → 23712 /
  7640 / 1012 triangles; kohen 20112 / 4688 unchanged.
- **Compile** (`compiletime.mjs --cold`, israelite solo high / medium, A = this round's shader code removed, interleaved
  ×4): the first version cost +0.3–0.6 s per 15 programs; after reusing the existing noise (no new `pNoise`, one hash)
  the two are within run-to-run noise (B 7.2–8.8 / 6.6–7.0 s, A 6.9–15.9 / 6.5–8.8 s).
- `tools/warmup-check.mjs`: ALL PASSED (final run). First frame low 14.6 / 13.9 s, medium 43.5 (an outlier; play
  24.3), high 31.6 / 31.3, ultra 39.1 / 38.4 s. Ultra's deferred world materials were shown at +31.9 / +33.1 s; an
  earlier run (before the shader slimming) failed ultra play once on that, and a re-run passed (+29.5 s). Flagged:
  this sits near the limit.
- Sim harness (`--q low`): `jumps.js "t=d3"` deterministic, no diffs; `views.js` stand 734 / watch 515, no failures.
- `validate-schedule.mjs` 0 errors / 0 warnings; `coverage.mjs` no gaps (longest 7 min).
- People: `propcheck.mjs` bad 0; `covercheck.mjs` all clean; `reach.mjs pair` 0.00 cm; `geotime.mjs` ok (atlas 8924);
  `npm run build` ok; app consoles clean.
