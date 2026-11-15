# sky-smoke-fire — a real sky, the altar's pillar of smoke, flames that are not cut-outs

Scope: `src/env/**`, `src/render/**` (fx). Format: **Choice** — why (source / reasoning) — alternative. ⚙ = reconstruction /
art direction. Shots: `shots/skyfx/{before,after}` (low, 960 × 540, the same queries; `before` from a copy of the tree with
HEAD's env/ and render/), `shots/skyfx/after-medium`. Two dev pages iterate without booting the app (`shots/skyfx/lab/`:
`index.html` the fx alone — fires, smoke, lamps over a stand-in court; `sky.html` env alone — dome, clouds, stars — on a
plain ground; not bundled, `shots/` is git-ignored). Switches: `?clouds=0`, `?cumulus=0..0.4`, `?cirrus=0..1`.

## Sources (opened in this session on Sefaria, read in Hebrew)

- **Avot 5:5** (ten miracles in the Temple): "וְלֹא כִבּוּ גְשָׁמִים אֵשׁ שֶׁל עֲצֵי הַמַּעֲרָכָה, **וְלֹא נָצְחָה הָרוּחַ אֶת עַמּוּד
  הֶעָשָׁן**" — the wind never defeated the pillar of smoke.
- **Yoma 21a** (the baraita): "וַעֲשַׁן הַמַּעֲרָכָה, אֲפִילּוּ כׇּל הָרוּחוֹת שֶׁבָּעוֹלָם בָּאוֹת וּמְנַשְּׁבוֹת בּוֹ — **אֵין מְזִיזוֹת אוֹתוֹ
  מִמְּקוֹמוֹ**" — all the winds of the world could not move it from its place.
- **Yoma 21b**: (1) the heavenly fire "אֵינָהּ מַעֲלָה עָשָׁן", and the answer "כִּי קָא אָמְרִינַן — **בִּדְהֶדְיוֹט**" (Rashi: "דמעלה
  עשן בהדיוט קאמרי' באש הדיוט שהיו מביאין אצלה"): the smoke rose from the ordinary fire the kohanim brought; in the Second
  Temple the fire "רְבוּצָה כְּכֶלֶב" (R' Chanina Segan HaKohanim) — an ordinary wood fire. (2) On the night after Sukkot all
  watched which way the smoke leaned (נוֹטֶה כְּלַפֵּי צָפוֹן / דָרוֹם / מִזְרָח / מַעֲרָב), and the Gemara reconciles it with the
  miracle: "**דְּאָזֵיל וְאָתֵי כְּדִיקְלֵי, וְאִבַּדּוֹרֵי לָא הֲוָה מִיבַּדַּר**" — it came and went like a palm tree, but it
  was never scattered.
- So the pillar is one coherent column, rising from the wood fire, never dispersed or sheared off by wind; at most it sways
  slowly like a palm. Its height, width and density are not given: ⚙.

## 1. Clouds

- **A cloud tile baked once on the CPU in a Worker (`env/clouds-core.js`, `clouds.worker.js`), sampled by the existing sky
  dome; every tier draws the same clouds.** 1024² RGBA8 (5.6 MB with mips): R a rank-equalised cumulus "dome height" (inverted
  cellular billows on a fbm of fields), G cirrus fibres (brush strokes ≈ 27 × 4 km, broken into tufts, fibrous texture,
  warped into hooks, in patches; equalised), B a smooth weather mask, A cauliflower detail. Rank equalisation makes the
  shader's threshold `1 − coverage` cover exactly that share of the layer. Baked in ≈ 1.3–1.5 s (Node, loaded machine) in a
  Worker started by `env.prewarm` before the world build; a screenshot waits for it, play fades the clouds in over 1.5 s if
  it lands after env's init (it has not, in the runs below). — Alternatives: a GPU bake (a generator program: 0.3–3 s of
  compile on the HD 4600, CLAUDE.md), ALU noise in the dome (the old high/ultra cirrus; the reason low/medium had a clear
  dome), a downloaded texture (forbidden).
- **Cumulus as domes over the field, found by a short march along the ray through the layer (1.8–2.6 km).** A cloud's
  cross-section narrows with height (the threshold rises with z), so a cumulus shows a flat grey base and a rounded, lit top.
  The march has `n ≈ 3 / tan e` slices (3 from ≈ 45° up, the cap — 16 low, 24 where `quality.detail ≥ 1` — by 7–10°),
  explicit LODs (dynamic loop: no derivative in flow control, ANGLE/D3D11), slice heights dithered per pixel by ±¼ slice (interleaved
  gradient noise) so what is left of their terraces is a fine grain. A first try with two planes (base, top) drew flat lenses;
  six fixed slices drew stacked stripes near the horizon (each cloud took one slice). Fade below ≈ 5° (the haze, and the
  slices would part). — Alternative: a full ray march (dozens of steps), billboarded cloud sprites (popping, sorting).
- **Lighting: the Sun's beam at the cloud from the transmittance LUT (its colour and its planet shadow — the layer is lit
  minutes after the ground's sunset: red undersides), the Moon's beam (CPU, its slant path), sky and ground ambient; bases lit
  only through the cloud unless the Sun is near the cloud's horizon; flanks by the side facing the Sun; one fetch up the
  sunbeam shades the far sides; a capped forward peak for silver linings. The air in front hazes them (extinction of the
  exponential atmosphere between observer and layer, in-scatter from the sky LUT in proportion).** Cirrus as before
  (gate-env-render) but with the forward peak capped (×2.2): the setting Sun blew the old cirrus into a white fan.
- **The clouds are in the visible dome only: not in the environment map's sky (`ENV_PASS`), not in the probes' captures
  (`withoutDiscs` hides them), not in the exposure meter (the clear-sky LUT statistics), and they cast no shadow.** The
  orchestrator's constraint: the courts' lighting and exposure stay exactly as they were. The cost of that is physical: a
  cumulus over the Sun does not dim the courts (fair-weather cumulus cover ≤ 0.4, usually far less, and the Sun is behind one
  a few percent of the day). — Alternative: cloud shadows from the same tile (a lookup in every lit shader: a new sampler in
  the world's programs, recompiles, and a change of the courts' light).
- **Discs, aureoles and stars behind clouds.** The sky's sun and moon discs keep `(1 − cumulus) × (1 − 0.6 cirrus)` of their
  light; the stars' vertex shader reads the cover once per star (two explicit-LOD fetches) and hides them.
- **Weather is a pure function of date and time ⚙.** Per date: a field offset; cumulus on a seasonal chance (≈ 60 % of days
  November–February, none June–August) with 6–16 % cover (× 0.2–1.2 by the weather mask); cirrus as gate-env-render's seasonal floor and draw. The cumulus
  cover follows the day's heating (×0.55 at night, full 13:00–16:00). Drift: the low-level wind ≈ 5 m/s from the WSW, the
  upper ≈ 20 m/s, × the minutes since the epoch (`time.ms`), wrapped to the tile in doubles on the CPU (no jump at midnight).
  The detail fetch is at an integer multiple of the tile so it wraps with it. At 600× the cumulus move ≈ 9°/s at 15 km: they
  race, as in a time-lapse; overhead they would step visibly per frame.

## 2. The pillar of smoke

- **One column per plume, drawn as a single ribbon (24 quads) turned to the viewer about its vertical axis and shaded as a
  cylinder of smoke** (`fx/materials.js` SMOKE_VS/FS, `fx/batch.js` `{ ribbon }`). Radius r = r0 + k·h (an entraining plume
  widens linearly, k = 0.085 — half-angle ≈ 5° ⚙; τ across the great pile's base ≈ 2.4 × √(burning area / a 2 m pile's) ⚙); optical depth across ∝ r0 / r (mass conserved: it thins as it widens); per pixel the
  chord 2r√(1 − x²), billows from the fx noise basis rising with the gas (three fetches; two on low), the edge bulging with
  them; the key light through the column (bright sunward face, shaded far side), a forward-scattered rim when backlit, sky and
  ground light, the fire's glow from below at night (the SMOKE_GLOW_PATH law kept). The puffs (24–52 per column) were each
  about the column's width: they read as thin streaks that faded in ≈ 15 m above the flames.
- **The altar's piles make one plume.** Pyre columns within 3.2 m (the great pile's two emitters) merge into one at their
  area-weighted centroid, their burning areas summed; a smaller pile within 9.5 m of a bigger plume smokes for three flame
  heights and dissolves into it. Before: four parallel columns, one per pile ("three thin vertical streaks").
- **Thick vs thin: kept.** The column's optical depth follows the fires' intensity as before (`fire.cur`, which the sim's
  fireWant drives: full with the evening's limbs and fats, flares as each goes on, lower in the small hours and on Friday
  night, the embers before the clearing), now up to 1.25 (a flare thickens it) where it was clamped at 1.
- **Straight; a palm's sway at most ⚙.** The axis is vertical; the upper column sways by ≤ 1.2 % of its height (≈ 1 m at
  ≈ 88 m, under 1°), two slow incommensurate periods (≈ 57 and 72 s): Yoma 21b "דְּאָזֵיל וְאָתֵי כְּדִיקְלֵי". It never bends off
  or breaks up. The smoke forms among the flames' tips (0.6 of their height), thin for the first 2 m + 0.8 r so the flames stay
  bright over it (it began at 0.75 of their height and faded in over ≈ 15 m: a band of clear air under a far-off column).
- **Animation in fx's real-time clock, not sim time** (as the flames): at 600× the smoke rises at its own pace, no strobing;
  its look carries no sim state.

## 3. Flames

- **Oil lamps (the Menorah, the night lamps) are drawn as steady wick flames** (`presets.js` lamp `style: 'oil'`,
  `fx/materials.js` `oilFlame`): a teardrop (rounded foot, widest a quarter up, drawn to a point), a faint blue foot, a dimmer
  vapour core over the wick, the yellow-white luminous zone, an orange tip; it breathes and sways a little and never breaks up.
  Before: the fire's eroded-noise card at low turbulence, a soft blob.
- **Wood and pitch flames: a glowing fringe beyond the luminous edge and an inner roll.** The edge was a cut (discard at the
  noise threshold) over an evenly filled tongue: now the thinning gas glows dull orange for ≈ 0.2 of the erosion's range
  beyond it (emission only), and a fourth, finer and faster noise field (32 cells) streaks the temperature and brightness
  inside each tongue (emission only). The cool margins (T < 0.12) no longer occlude: with the lit column now right behind the
  flames they printed grey, ghostly sheets round every tongue. The layered cards, the hot core, the soot occlusion of the
  body and the low tier's split tone mapping are kept.
- **Embers, coal bed, heat haze unchanged** (embers on every tier at night, the shimmer on the post tiers only).
- **Firelight adaptation (kodesh-night-fx.md) untouched**: no change to `viewFireLuminance`, `roomExit`, the gate gain or the
  fill.

## 4. Low's gilded rooms (env/interiors-glsl.js, the probe-less gold path)

- **Measured first** (linear luminance of the 960 × 540 frames, `shots/matreal/final` low vs medium, Kodesh d3 looking west):
  overall the two tiers agree (mean 0.115 vs 0.107; saturation 0.61 vs 0.64), but low's right wall is 1.28× medium's and
  flat (p90/p10 1.34 vs 1.51) and its floor flat (1.23 vs 2.46): the "flat mustard paint" is the missing structure more than a
  level. So: structure, not a global gain (the room meter also reads `roomGain`, so a gain change is metered away).
- **Where the reflected ray meets the room's box, light it as that surface would be ⚙**: the face met (the axis whose exit
  comes first), corners and edges darker (× 0.5 within 2.5 m of an edge: each sees less of the room), walls brighter low
  (floor bounce, the patch the gate lets in) than under the ceiling (× 1.2 → 0.65), the ceiling dim (× 0.55), the floor
  bright (× 1.15), the face opposite the main opening (the Kodesh's parochet, dark wool) × 0.45. ALU only, on the box and main
  opening the shader already holds; rough lobes (≥ 0.5) keep the local value as before. It also serves the KhK on every
  tier (gilded, no probe).
- **Result (low, `before|after/09-kodesh-d3`)**: mean 0.081 → 0.077, wall 0.070 → 0.068 (p90/p10 2.65 → 2.78), floor 0.115 →
  0.106 (p90/p10 1.26 → 1.68: the floor now darkens toward the far end and mirrors the walls' lower bands), parochet end
  unchanged. Night Kodesh identical (the gate is shut: no main-opening term). Not done: a fake image of the gate in the gold
  beyond what `mkHit` already draws (its exit test), and any change of the probe tiers.

## Costs per tier (HD 4600 figures are estimates: this machine renders with SwiftShader; nothing here is an fps claim)

| item | programs | draw calls | per-pixel work | texture memory | load time |
|---|---|---|---|---|---|
| 1 clouds | 0 new (the dome's, the stars' programs change; the env pass's loses high/ultra's cirrus) | 0 | sky pixels only: 3 fetches + 3…16 (low) / 24 (medium+) explicit-LOD slices near the horizon, 3–5 above ≈ 30°, 2 LUT fetches, ≈ 25 ALU a slice; none of the slices on clear days (uniform branch). Stars: 2 vertex fetches a star | +5.6 MB (1024² RGBA8 + mips), every tier | Worker bake ≈ 0.65 s CPU (Node) off the main thread, started before the world build; IndexedDB cache after the first visit; one 4 MB upload + mipmaps |
| 2 smoke | 0 (the smoke program changes) | 0 (still one instanced draw) | one ribbon layer per column instead of 24–52 overlapping puffs: less overdraw; 3 noise fetches (2 low) | 0 | 0 |
| 3 flames | 0 (the flame program changes) | 0 | +1 noise fetch a flame pixel; the fringe widens each card's drawn area a little; the lamp branch is ALU only | 0 | 0 |
| 4 gold | 0 | 0 | ≈ 20 ALU in the probe-less gold rooms' reflection only | 0 | 0 |

Same frame, before vs after (low, shot mode, the ten views): draw calls and triangles identical in every view (e.g. start 259 /
683 k; Azarah d3 251 / 673 k), linked programs 74–77 both.

Medium's Kodesh is untouched (identical frames before/after). Still open: low's daylit Kodesh stays brighter than medium's in
this view (linear mean 0.077 vs 0.059, floor 0.106 vs 0.062) — but it is not more saturated (0.60 vs 0.64). A gain on the
probe-less gold path is partly metered away by env's room meter (it reads `roomGain`); left for a calibrated pass.

## Verification

- `npm run build`: passes. Console: no errors in any of the 22 shots (low ×12, medium ×10); the only warnings are the
  machine's (SwiftShader "GPU stall due to ReadPixels", "KHR_parallel_shader_compile not supported"), present before too.
- Shots, same queries before / after: `shots/skyfx/before|after` (low, 10 views), `before-medium|after-medium` (5 views),
  `after/11-*, 12-*` (night lamp views), `lab-out/` (the dev pages: fire close-ups day / night, lamps, sky at five times).
- Boot (shot mode, low, cold, same machine, other agents rendering): env's init phase median 1.9 s → 2.7 s (a screenshot
  awaits the cloud bake there; normal play does not), first frame median 15.1 s → 17.4 s across the ten views. The before
  runs came from a copy of the tree taken at the start (other agents' files since then differ) under different load, so this
  is not a clean A/B: `tools/warmup-check.mjs` (cold production) was not run.

## Round 2 (review): the weak tiers' cumulus, boot, look fixes

- **The weak tiers draw the cumulus as a flat, loop-free layer; the march stays on the others.** Chosen by flags in env
  (`cloudPath`): `ao === 'volume'` or no `post` → flat (low, medium), else march (high, ultra; `CLOUD_MARCH` define). The flat
  layer is two explicit-LOD fetches (the point; and, low in the sky, one 0.5 km nearer the viewer along the view's azimuth —
  above ≈ 16° the same fetch reads the field at 8× the scale, the lobes within a base; the switch lies where neither use is
  weighted) plus the cirrus fetch:
  three cloud fetches a sky pixel, no loop, no LUT fetch (the Sun's beam at each layer is now a CPU uniform, `uCuSunE` /
  `uCiSunE`, from `transmittanceCPU`). Its shading is prepared at bake time: A is now R blurred over ≈ 0.5 km (the cloud's
  smooth mass) — the outline toward the viewer follows A (a straight, flat underside, grey, warm and side-lit when the Sun is
  low), the rest follows R (the lobed tops, lit by the relief R − A on the side facing the light, greyer on the far side and
  over a cloud's thick middle); overhead the base: grey, thin margins brighter. The layer is mapped as a shallow dome
  (horizontal distance ∝ 1 / (sin e + 0.06)) so a cloud near the horizon keeps some height. The explicit LOD is the footprint
  ACROSS the ray (the implicit one took the along-ray axis near the horizon and averaged the clouds away). — Alternatives: a
  baked normal / light-direction table (one more channel per light azimuth), the march with fewer slices (still a loop).
- **The tile is 512² (1.4 MB with mips) on the flat tiers, 1024² (5.6 MB) where marched.** The IndexedDB entry is keyed by
  the bake's version and size (one entry kept). A runtime tier switch keeps the first size (the shading adapts to it).
- **The bake starts after the first view in play** (1 s after 'firstFrame', in the Worker; IndexedDB-cached) and the clouds
  fade in over 4 s once uploaded (the start view's sky is dark before dawn). A screenshot starts it in env's prewarm and waits
  for it (deterministic frames). The dome's program is the same before and after the upload (the 1 × 1 placeholder is the same
  sampler type): no later variant, no hitch.
- **New cumulus field** (bake v6, a 64 km tile): domain-warped cellular clouds ≈ 3.2 km, gradient-noise towers ≈ 1.3 km and
  lobes ≈ 0.6 km, a 250 m fringe, on the fields; varied sizes come from the fields (clusters merge cells). Cellular towers
  and lobes (v3–v5) met along straight Voronoi ridges: close overhead the clouds read as polygons. The cumulus noise has its
  own random stream, so the accepted cirrus is unchanged. Brighter: albedo 0.8, sunward side up to
  1.15 × the Lambert term plus the relief; the old "mid-grey under a noon Sun" came from the bases' share and the 0.75 albedo.
  Bases darker: they see the sky only at grazing angles and the region's ground (`ATMO.groundAlbedo`, not the courts'
  limestone), and the forward-scattering peak lights only the thin margins (silver lining) — near the Sun the base glowed.
  The march (high / ultra) keeps the upper slices on the smooth mass (rounded tops; with the lobed field they stood up as
  spires) and a smaller jitter (± 0.15 slice).
- **The march's slice jitter is a white hash per pixel**, not interleaved gradient noise (whose structure showed as combed,
  directional streaks).
- **Time-lapse:** the clouds' opacity is lowered with the clock's speed past 60× (to 30 % at 600×). Their position stays a
  function of the sim time; only how much shows depends on the speed. At 600× the cumulus move ≈ 9°/s at 15 km and overhead
  would step from frame to frame; the cirrus faster still.
- **Night smoke's "card edge"** (`after/05`, a pale flap above the flames on low): the low tier tone-maps a flame's colour per
  unit of its coverage; once the cool margins stopped occluding (round 1), a torn-off tongue's coverage fell to the 0.15
  floor and its colour, tone-mapped at ≈ 7× its radiance, washed out pale. The coverage is now the visible density (and
  fringe), not the soot alone; and a flame card's tongue reaching the card's side or top is faded by a window on the card
  (its light and cover, not its edge: shifting the edge cut the tongue along the window's own flat contour). Two straight
  cuts were also possible over the flames — a flame card's tongue reaching the card's
  border (cut along the quad's side or top), and the smoke ribbon's straight sides where the billow bulge (≤ 1.375 radii)
  passed the ribbon's half-width (1.3). The bulge is now clamped to 1.3 inside a 1.45-radius ribbon.
- **Sunset smoke**: the key light's colour is half desaturated on the smoke and the ambient 40 %: a sun on the horizon
  scattered by grey particles, with the blue ambient in the shade, read as a magenta plume. Lit smoke at sunset is warm grey.
- **Menorah, in the app** (`shots/skyfx/r2/{low,medium}/13-menorah-n3`, `14-menorah-d3`, crops `*-crop.png`): seven small
  teardrop flames at night, by day the ner ma'aravi alone (second from the east) — no square, no clipping in the cups.

### A/B of the boot (low, shot mode, start view, the same tree, `?clouds=0` vs default interleaved ×4)

| run | env init (ms) A / B | first frame (ms) A / B |
|---|---|---|
| 0 | 1921 / 1482 | 18174 / 11543 |
| 1 | 1410 / 1843 | 15358 / 13674 |
| 2 | 2401 / 2432 | 17909 / 14696 |
| 3 | 2229 / 1928 | 15580 / 15003 |
| median | 2075 / 1886 | 16745 / 14185 |

Default (clouds) is not slower than `?clouds=0`; the spread between runs (11.5–18.2 s) is the machine's load. Shot mode
still waits for the bake in env's init (it overlaps the world build), so play — which bakes after the first view — cannot be
slower than this.

### Costs per tier (revised)

| tier | cumulus path | cloud fetches / sky pixel | loops | texture | programs |
|---|---|---|---|---|---|
| low | flat | 3 (cirrus, cumulus point, near point) + 0 LUT | none | 512² RGBA8 + mips, 1.4 MB | 0 new |
| medium | flat | 3 | none | 1.4 MB | 0 new |
| high / ultra | march | 2 + 3…16 / 24 slices + 2 LUT | one dynamic loop, explicit LODs | 1024², 5.6 MB | 0 new |
| all | stars: 2 vertex fetches per star (cover) | | | | |

### Round 2 verification

- Shots: `shots/skyfx/r2/low` and `r2/medium` (same queries as round 1's `after/` for 01, 02, 03, 04, 05, 07; cumulus on a
  cloudy date 2026-11-06: 15 overhead / north, 17 the aerial looking west; Menorah 13 night / 14 day, with crops), the A/B
  boot frames in `r2/ab`, crops of the night fire `r2/crop-*`. Lab pages' outputs are not evidence of the app.
- `npm run build` passes. Console: no error in any r2 shot (the SwiftShader warnings as before).
- Not run: `tools/warmup-check.mjs` (cold production, every tier) and an HD 4600 compile timing of the march (high / ultra
  only now).
