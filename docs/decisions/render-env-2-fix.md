# render-env-2-fix — decisions

Review fixes to render-env-2 (scope `src/render/**`, `src/env/**`). Format: **choice** — why — alternative.
Shots: `shots/render-env-2-fix/` (`*-medium-before` = the render-env-2 tree; `*-after` = this task on low / medium /
high; low / high "before" are the review's `shots/render-env-2-review/diag-*`; `wip/` = A/B and zooms).
Dev scripts (not bundled; `node src/render/dev/session.mjs <script> --q <tier>`): `env2-views.mjs` (named views; now also
logs env's room meter, the glint and the occluded-light mask), `perf-twin.mjs` (frame-interleaved A/B of two shader
variants compiled side by side), `perf-ab.mjs`
(sequential variants; too noisy on the shared GPU — kept for its variant table), `diag-fix.mjs` (niche probe / gloss
A/B, the glint through the morning, the kitchen hearth's shadow slot), `shadow-ab.mjs` (medium sets added),
`hlsl-dump.mjs` (ANGLE's translated HLSL of one lit program), `old-interiors-glsl.js` (render-env-2's patch, for A/B).

## Fire light (findings 1, 3, 4)
- **A court's fire-occluder rect is its walls' OUTER faces, and a receiver counts as beyond the walls only from 0.1 m
  outside them (smoothstep).** — with the inner faces every court-facing wall fragment lay on the boundary: sub-mm noise
  flipped the outside test and `u = (top − y) / (1 − t)` exploded near t = 1 — black-dot noise and vertical stripes on
  the firelit walls (`court-n3`, `altar-nw3`, `ey-nw-n`, all tiers). The outer faces face away from the fire. CPU mirror
  (`fireVisibility`) changed alike. Alternative: inner faces + margin only (the coping and jambs stay on the edge).
- **Every plain light that shares the brightest light's occluder record is occluded, from ONE evaluation at their
  intensity-weighted centroid with their RMS extent as the flames' radius** (mkOcc.w = record + 4 × shader-index mask +
  radius / 4). — the incense and kiyum piles (same record) lit the north / east / south pavement through the altar; one
  evaluation keeps the per-fragment cost of render-env-2 (two lights through an indexed array had cost ≈ 10 ms on low).
  Three piles a few metres apart act as one wide source (radius ≈ 2.3 m on low / medium): the far pavement is still lit
  over the top's edge by the tall flames, the yesod and near pavement are dark (`altar-n3`, `court-s-n3`). Alternative:
  2–3 occluded lights (a block read and ≈ 60 ALU each, every fragment).
- **A light outside a fragment's room reaches it only through the room's apertures (`mkVap` = V without the closed
  room's `base`), in the shader, fx's illuminance and the light ranking.** — the court fires lit the KhK's gold through
  two closed parochot × V = 0.0015, then × the KhK's exposure (2 decades above outdoors); the altar 58 m away showed as a
  highlight. KhK at night now 0.0001 mean display luminance on low, medium and high (was 0.024). The fire side keeps V
  (a room's own lamps divide it out). Alternative: × openness (double-counts partly open curtains).
- **The occluder is skipped where no outdoor light enters (mkVap < 0.02)** — a closed room needs none of it.
- **Fire-shadow cameras: near plane = 0.25 × the fire's size within 0.05–0.3 m; normal offset capped the same way.** —
  builders-2-inner-fix: at 0.3 m the kitchen hearth's stones and pot (a hand's breadth from its 0.24 m flames) cast
  nothing. (see Verification for the hearth check)

## Interior balance (findings 5, 6, 11, 12)
- **FIRE_GLARE 0.4 → 0.75.** — a lamp-lit room is a few bright pools in the dark: the log-average the eye adapts to sits
  far below them, and they dominate what is seen, while daylight through the gate fills the Kodesh evenly. Mean display
  luminance, night (n3) / day (d3), camera on the Kodesh floor: medium west 0.062 / 0.122 (0.51×, was 0.81×), Menorah
  0.077 / 0.122 (0.63×, was 0.98×); high west 0.066 / 0.119 (0.56×), Menorah 0.079 / 0.119 (0.66×); low 0.049 / 0.153
  (0.32×), 0.058 / 0.171 (0.34×). Night stays warm gold. (0.65: 0.70–0.79× on medium.) One outlier (0.091) came from the
  eye still adapting down from the KhK's P ≈ 5000 in the previous view: a real transition, not a level.
- **Chromatic adaptation to firelight: degree 0.55 in non-gilded rooms, 0.75 kept in gilded ones.** — incomplete
  adaptation to low-CCT, mesopic light: the hearth-lit Moked read as a daylit room (wb 0.58 / 1.30 / 3.29); now
  0.68 / 1.24 / 2.45, cream-gold walls, Lmean 0.21–0.29 (was 0.37).
- **The Ulam probe (skylit) is captured WITH the fires' light — at fx's adapted gain — with its texels clamped to 24 × the
  capture's expected mean; its replay follows the fires' share of its light level (adaptation included), its staleness the
  physical change only.** — render-env-2 captured it without fires (the white-out); a first try with the fires at env's
  exposure whited the porch out again (the eye sees the open-air fires through fx's local adaptation, ≈ 1/3000 there).
  The gate leaves now carry the firelit altar top; their upper part mirrors the pre-dawn eastern sky they face (gold ×
  twilight blue reads olive at alot-6 — physical). Alternative: a warm term from the occluded light (not a reflection).
- **Probe reflections take roughness × √k, k = the reflected surface's distance from the fragment over its distance from
  the probe (1–16).** — a probe's blur is an angle seen from the probe; the Ulam probe sits 2.6 m from the opening, so the
  north wing's end wall (21 m away) mirrored the jambs sharply. With the Ulam probe off the smear vanishes; with the wall's
  roughness × 2.5 too: the cause is `herodian_wall_inner`'s near-polished map (request to materials). The √k term only
  softens it; it is kept because it is the correct footprint for every box-projected probe.

## Shadows (finding 8)
- **Medium's key light: PCF radius 1.5 (was three's 1).** — at 1 the 7.8 cm texels of the ±80 m map showed as scallops
  under the lintels and courses; 2–3 removed them but grained the lit stone (the Vogel taps reach the faces' own depth,
  `wip/shadow-ab-medium-zoom.png`); a ±64 m map only moved them and would drop casters > 32 m behind the viewer at 14° Sun.

## Bloom / glint (finding 7)
- **render/fx draws the nivreshet's sun glints: one spark per lobe that mirrors the Sun to the eye, I = E⊥ · F(θ) ·
  R1 R2 / 4, deposited as I / d² into a ≈ 1 px Gaussian at its point, with the eye's own near glare round it**
  (`fx/glint.js`). — the Sun's image on the polished lobes is ≈ 1 mm; no surface shader resolves it. The lobes are the
  builder's (16, r = R (0.93 + 0.1 sin πf · sin^0.6 φ), flattened 0.82): each sweeps ≈ ±40° of azimuth, so 4–5 sparks,
  each with its own curvature (Σ ≈ the plain sphere's r² / 4). Gated by the terrain horizon at the globe's height and one
  BVH ray toward the Sun every 0.25 s. From the court: from sunrise+14 (I ≈ 56 cd, half the Sun over Har HaMishchah),
  ≈ 185 cd at +18, 280 at +22, 500 at +30. The glare is the CIE 2002 disability-glare spread (L / E = 10 / θ³ + 5 / θ²,
  0.1–1.5°, ≈ 17 % of the flux taken from the core): at 25 m it is about the scene's mean luminance 0.2° from the sparks —
  the bloom's kernel is far wider than these few pixels and gave a point almost no near halo. Medium, sunrise+22: the
  sparks change the brightest globe pixel by 215 / 765 (RGB sum) and light a pale-gold glow ≈ 10 px across
  (`wip/glint-onoff-medium.png`); nothing is added to the globe's own shading (build-heichal's note). Alternative: lower the
  material's roughness (the image stays sub-pixel).

## Far haze (finding 9)
- **The far-haze ramp's air light follows the dome's skyline profile** — the stats pass now also measures the sky-view
  LUT's luminance (azimuth-averaged) at −8 … +0.25° (alpha of its pixels; the per-source table carries it for jumps),
  and fog.js scales the air light by profile(elevation) / band where the ramp closes. — the Fourier terms fit the 0.5–3.5°
  band; just above (and below) a far silhouette the LUT is darker, so fully hazed ridges were a pale rim. The rim is now
  grey-beige, close to the sky above (`wip/haze-zoom.png`); a slight hue difference remains (the profile is luminance).

## Performance (finding 2)
Method: `perf-twin.mjs` — both variants compiled at once (the patched chunks become `#ifdef MK_VAR_B … #else … #endif`,
every lit material gets a twin), frame-interleaved, 50 pairs, the 12th percentile quoted. Sequential runs (`perf-ab`,
render-env-2's method) swung by 30 ms on this shared GPU (stock alone 67 → 81 ms between runs) and are not used for any
conclusion here. Night (n3), fixedres, medium unless noted; court [238, 385], Kodesh [136, 330.5], altar [190, 360].

- **Where the overhead is (medium, a lightly loaded moment: full patch vs stock court 65 / 49 ms = +16 ms, Kodesh 82 / 56 =
  +26 ms, altar 55 / 44 = +11 ms):** the room path compiled out of every material −7 / −14 / −5 ms; the probe loop
  compiled out −6 / −8 / −4; the aperture loop compiled out −1.6 / −5 / −0.7. Every block read made constant-indexed
  (correct in the Kodesh view) −10 ms (6 %) in the Kodesh, nothing in the court; the room setup moved to the start of
  `main()` (before material sampling, flat normal, base roughness): no change. So neither the dynamic block reads nor the
  register peak of the room code's placement is what costs; the cost is the code's presence plus its work in rooms.
- **Kept: fewer values live across three's light loop** — `mkSetup` keeps only what the light loop and the IBL read (V,
  V through apertures, room slot, insideness, the key light's mask, the reflection's exit, the room's record word, fill,
  flags, the occluded-light mask and visibility); world position and normal are recomputed in `mkIBL`, the gold gain and
  fill centre read there from the record; the debug views compile only with `MK_DEBUG` (`?intdebug`, or the `debug`
  setter, which recompiles). Result vs render-env-2's patch (same method): court 69.1 / 70.8, Kodesh 82.2 / 86.6, altar
  56.7 / 58.5 ms on medium (−2 / −4 / −2 ms); low 19.0 / 19.1, 25.4 / 27.0, 28.2 / 28.5. Full vs stock at the end: medium
  altar 58.8 / 48.4 (+10 ms); court and Kodesh were measured in a heavily loaded hour (+38 / +33 ms, stock 94 / 97 ms);
  low court 20.1 / 16.5 (+3.6), Kodesh 27.6 / 18.9 (+8.7), altar 18.2 / 15.3 (+2.9).
- **Compile + first draw of every lit material, cold (medium, `compile-time.mjs`, stock / render-env-2 / now alternated in
  one page, each later in the run than the one before):** stock 28.7 / 24.3 s, render-env-2 109.5 / 114.3 s, now 89.6 /
  91.3 s — ≈ 20 s (18 %) less (the debug views compiled out, the room setup's working set local to one function).
- **Tried and dropped: splitting the static world batches by room proximity at run time** (each batch's triangles —
  large near ones subdivided to 3 m — partitioned into "may lie in a room" and "away from every room", the latter drawn
  with a twin material compiled without the room path; the reviewer's option (c) done in env). 14 batches split, 48
  swapped whole, 151k triangles moved off the room path — but the frame-filling court pavement is not one of them, and
  frame-interleaved it measured court −3, altar +3, Kodesh −4, Mount +4 ms (noise), for 2–3 s of main-thread work after
  load and extra draw calls in every pass. Reverted.
- **Not reached: half the overhead.** The remaining levers need geometry the world owns: the pavement and the
  frame-filling batches split by room (or room-local materials), which the room path compiled out of every material bounds
  at −7 ms in the court; or a screen-space pass for the room terms (a depth pre-pass this pipeline does not have, and a
  sampler three would clone per material — the atlas trick cannot hold a screen-sized buffer at 4 × 64 rows).

## Verification
- `npx vite build --outDir .build-render-env-2-fix --emptyOutDir` passes (deleted after).
- Shots read: medium 24 views before / after (`*-medium-before`, `*-medium-after`), low 17 and high 20 after (before: the
  review's `diag-*`), zooms in `wip/` (glint, lintels, haze, yesod, niches).
- Console: no errors or warnings from render / env in any session (the twin A/B's own material clones warned about
  serialising textures — dev script only; the shipped code shares userData by reference).
- The kitchen hearth (high, the great piles taken out of fx for the test): its cluster takes the shadow slot with near
  0.06 m and normal offset 0.06 m; the stones and cauldron shade the pavement behind them, light leaves through the
  hearth's mouth (`kitchen-high.png`).

## Requests
- **materials:** `herodian_wall_inner` ("plain fine-dressed faces") is near-polished in its roughness map: the Ulam's wing
  end walls mirror the porch (the chrome-like stripe above the knife niches; gone with roughness × 2.5,
  `wip/niches-high-rough25.png`). Fine-dressed ashlar ≈ 0.5–0.65.
- **builders (altar):** `light: false` on `altar.maarachah.incense` and `.kiyum` still frees two light slots (they are now
  occluded with the great pile, so no longer a leak).
- **world (courts, StaticBatcher owners):** the pavement and the big wall batches split near the room boxes (or room
  materials kept apart) so the frame-filling geometry can compile the room path out (bounded at −7 ms court / −14 ms
  Kodesh on medium by compiling it out everywhere).
- **orchestrator (docs/API.md, CLAUDE.md):** see the report's api field; for CLAUDE.md: frame-time A/B on the shared HD 4600
  must be frame-interleaved (`perf-twin.mjs`); ANGLE clamps every dynamic UBO index through float (`hlsl-dump.mjs`).
