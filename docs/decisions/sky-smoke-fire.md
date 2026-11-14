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
