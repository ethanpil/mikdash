# render-env-2 — decisions

Scope `src/render/**`, `src/env/**`. Format: **choice** — why — alternative. Shots: `shots/render-env-2/`
(`*-before` = HEAD, `*-after` = this task, `wip/` intermediate). Dev scripts (not bundled): `src/render/dev/env2-views.mjs`
(named views × times in one boot; logs exposure, light slots, white balance and the shot's mean display luminance;
`CROP=x,y,w,h`), `compile-time.mjs` (compile + first draw of every lit material: stock / this patch / pieces compiled
out), `perf-var.mjs` (GPU time, `VARS=full,stock,…`), `shadow-ab.mjs` (bias / caster-side variants at one view),
`ulam-night.mjs` (the Ulam with / without its probe), `probe-faces.mjs` (a probe's captured faces read back),
`nivreshet-scan.mjs` (when the nivreshet mirrors the sun to the court), `niv-spark.mjs` (its shading variants),
`even-ab.mjs` (the KhK's gold fill on / off), `inspect-even.mjs`. The HD 4600 was shared
with up to 68 Edge processes of other agents during this task: absolute timings are noisy; A/B pairs were taken in one
page.

## (1) Fire light leaks
- **Fire occluders: analytic, site-derived shapes instead of a fire-shadow slot on medium.** A court open to the sky
  (`azarah`, `ezrat-nashim`: the inner faces of their walls, a top per wall) stops a fire's light where the ray leaves
  the court below the wall top; the top of the solid a fire stands on (`altar.top`, its test plane 12 cm under the top
  so the whitewash's bumps do not speckle) stops it where the ray goes down through that top. Soft: the edge is
  compared with the flames' radius (0.3 × the fire's size) at the fire's distance — a real penumbra, metres wide near
  the altar. `env/volumes.js defineFireOccluders`; the records are literal constants behind a uniform branch in the
  chunk. ONE light a frame carries them — the brightest plain slot with a record (the great pile on low / medium) —
  evaluated once per fragment in `mkSetup` (one block read). — the altar's great pile lit the north yesod and pavement
  through 9 amot of altar and the Ezrat Nashim through the 35-amah wall (`altar-n-*`, `en-gate-*`); this also fixes low.
  A first version carried two lights through an indexed const array: four constant-buffer loads per light per
  fragment, ≈ 10 ms a frame on the HD 4600 at low (`perf-var` noOcc). A medium cube-shadow slot would cost a 6-face
  world render on every assignment (StaticBatcher meshes span the site: no culling), 5 cube taps per lit fragment, and
  people frozen into the map (no per-light caster exclusion in three's shadow pass) or a refresh hitch. Not modelled:
  the Heichal's own body (the strip west of it stays lit by the altar on low / medium), gates (shut at night, Tamid
  1:1; by day firelight is negligible), the smaller fires (request: `light: false` on the small piles).
- **Light ranking: a fire in the camera's own room × 3; between rooms max(V_fire · V_cam, 0.05 × openness(fire room) ×
  openness(camera room)); open air with a fire occluder record: its visibility from the camera through the court's
  walls (not the altar's top — a camera under it still sees the court the pile lights), floor 0.03.** — the 0.05 floor
  alone let the altar outrank the Menorah from inside the closed Kodesh (low: 2 slots). Openness = the room's most open
  aperture (doors, curtains).
- **`light: false` on a fire spec**: flames, coal bed, glow and smoke only — no point light, no room fill, no
  adaptation; its smoke is still lit from below by the flames (`glowCandela`). Requested for the altar's two small
  piles (builders).
- **fx's local adaptation also samples the firelit surfaces in view** (five BVH rays every 0.2 s, centre-weighted,
  ADAPT_ALBEDO × E / π at the hits, occluders and rooms included, weight 0.6). — with the leak gone the camera on the
  dark Mount (behind the walls) received no firelight, so the Heichal's facade, legitimately lit by the altar and seen
  over the courts' walls, blew out.

## (2) Fire schedule 'day'
- **`schedule: 'day'` = smooth(−3°, +3°) of the Sun's altitude** (1 − the night factor). Used by the nazirites' hearth.

## (3) Interior balance
- **Night vs day in the Kodesh: no firelight bump of the exposure key any more; instead the key is lowered by the
  glare of the flames in view (× (1 − 0.4 × the fires' share of the room's light)).** — lighting-polish raised the
  key toward 0.115 in lamp-lit rooms, which put the Kodesh lit by seven oil lamps (≈ 21 cd in a 19 × 10 × 19 m room,
  ≈ 0.01 cd/m²) above its daylight level (shots measured night 0.17–0.19 mean display luminance vs day 0.08 looking
  west). Now night 0.10–0.12 vs day 0.13 (west) / 0.39 (toward the gate) on medium; low 0.07–0.09 vs 0.15. A fixed
  lower key (tried 0.06, 0.035) also darkened the hearth-lit Moked (1.5 cd/m²) three-fold — alternative.
- **Interior adaptation 0.9 → 1, but at most 2 decades below the outdoor level (cone / neural adaptation within
  seconds; deeper darkness takes minutes).** — the Kodesh by day (≈ 1.7 decades below the court) is metered as it is;
  the KhK behind its two closed parochot (≈ 2.5 decades) stays "a dark chamber": 0.04 vs the Kodesh's 0.13–0.15 (was the
  same level as the Kodesh). Alternative: a per-room exposure bias (arbitrary).
- **Chromatic adaptation toward the light that fills the room — the probe's measured mean colour (medium+: the
  capture's Σ w·RGB, the mean shader now outputs RGB instead of the linear luminance), else the fires' and daylight's
  mix tinted by the walls (gold) — degree 0.75 × the fires' share + 0.45 × the rest (was 0.6 toward the bare flame
  colour).** — gold under 1900 K lamps, squared by interreflection, read deep orange-red under AgX; the eye adapts to
  the room's light, i.e. the gold-coloured light. The night Kodesh now reads warm gold. Flames, embers and coal beds
  undo 85 % of the room's white balance (`uWB`): the eye adapts locally to a bright source, and the flame ramp is paler
  than the fires' light colour, so the correction turned the Moked's flames blue-white.
- **The daylight part's degree rises from 0.45 to 0.9 as the room closes (× 1 − its openness: the most open aperture).**
  — with daylight in view through an opening (the Kodesh by day, gate open) the eye keeps a white reference; behind the
  KhK's parochot the gold-tinted light (gain ≈ 1.2 / 0.98 / 0.62 normalised) is all it sees, and at 0.45 the room read
  saturated orange-brown with the Even Shetiyah's rock taking the same tint (it read pale before the gold fill).
- **Gold-room fill: rooms flagged `gold` (Kodesh, KhK) multiply the light from their openings by 1 + ρ + ρ² with
  ρ = 0.9 × gold's F0 (≈ 2.7 / 2.2 / 1.4) where no probe of their own exists (the KhK; the Kodesh on low); env meters the
  room with the same gain; the fire fill takes the gold tint (luminance kept).** — the KhK's walls and the Even
  Shetiyah received a single bounce of a sky-tinted light; a probe captures the bounces itself (the gain there lit
  the Kodesh's capture twice over: the first try darkened the daylit Kodesh on medium). The Even Shetiyah still reads
  no paler than the gold floor (low, sRGB means rock / floor): 74,52,17 / 81,56,10 with the fill and 83,50,2 / 91,54,0
  without (`even-ab.mjs`) — the fill only desaturates it; the rock's tone against the floor is the materials' (the
  `bedrock` set's albedo and baked AO, which multiplies all of the KhK's indirect light, against the current gold;
  that library is being reworked in the working tree) — requested from materials.
- **An Ulam probe (medium+), interior and `skylit`: its irradiance is scaled by the local sky visibility over the
  visibility at the probe (clamped 0–1.5), it is not metered (env meters the porch from its openings as before) and
  captured in one pass.** — the gate leaves, vine and nivreshet mirrored the court probe's sky (teal); a plain interior
  probe lit the dim wings like the opening (the knife niches came out white). MK_LIMITS.probe 3 → 4 (court, Kodesh,
  Ulam, Ezrat Nashim on high+).
- **The Ulam probe is captured without the fires' light, like the court probe; it never sees its previous self.** — at
  night its capture held the altar top lit from a metre by the great pile and the pile's highlights on the gold leaves
  (47–72 texels a face at 10–700 × its mean, read back with `probe-faces.mjs`); its irradiance spread them over
  the porch, which went white (`ulam-alot-6-*-on/off` in wip/). The pile lights the porch through its point light. Cost:
  at night the gold gate leaves mirror the moonlit court (a slight teal cast), not the fire-lit altar.
- **The Ulam's box grows by the knife niches' depth (¾ amah + 0.05) into both wing end walls; the KhK's grows through
  its west wall to the wall's outer face.** — the niches (deeper than the 0.3 m margin) read as open sky and glowed;
  the lul's small curtain hung inside the shell of the old west face, so its folded back faces and the slot's jambs lit
  as sky — the bright dotted edge. The slot itself is no aperture (17 amot long, curtained). Alternative: a general
  "recess" depth in the shader's insideness test (would pull court surfaces next to chamber boxes inside).
- **The sun / moon reaches a fragment in a room only where the ray toward it leaves through an aperture (soft by a slack
  of 0.35 m where shadow maps draw the true edge, 0.06 m on low), on every tier.** — shadow-map leaks lit stripes into
  inner corners (the north wing's corner by the knife niches) and along chamber ceilings; on low (no shadow maps) the
  sun was V × full sun everywhere in a room, now patches through the doors. Packed with the aperture loop (same pass).

## (4) Shadows
- **Sun / moon shadow casters draw their front faces too (double-sided depth, orthographic shadow cameras only: env's
  key light on medium, the cascades on high / ultra), with the receiver offset along its normal by the bias × (1 +
  tan θ, ≤ 4).** — three draws a FrontSide material into the map by its back faces, so wherever a caster touches a
  receiver (the sovev slab's underside on the kevesh, the milah lintels and the set-out courses, a curtain against
  its jamb) the caster's back face lies on the receiver and the PCF taps just past the contact read the receiver's own
  far side as lit: a saw-toothed lit band under every contact edge. A/B at the slab (`shadow-ab-sovev-am3-high-*`):
  identical with PCF radius 2.2 / 1.2, depth bias −2.5e-4 / −4e-5 / 0 / +3e-5 and normal bias 0 / 0.6 / 1.5 texel;
  gone with front faces. The slope term keeps lit surfaces free of acne at grazing sun (the depth error across a texel
  grows with tan θ). Fire cube maps keep back faces (their near texels would need metres of offset); the people keep
  their own depth material. Implemented as a hook on `Object3D.prototype.onBeforeShadow` (the depth material's side,
  per pass) and patches of three's `shadowmap_vertex` / `shadowmap_pars_fragment` (render/shadows.js). Alternative:
  `material.shadowSide` (materials' objects, and it would also apply to the fires' cube maps).
- **Normal bias per cascade: base + 0.6 × that cascade's texel (sunShadowCascade[i].w); depth bias −4e-5 (≈ 1.5 cm,
  was −2.5e-4 ≈ 10 cm over the cascade's depth range).** — one world-space offset was either too small for the far
  cascade or too large for the near one (shadows lifting off the 8 cm proud lintels).
- **High: 3072² per cascade (was 2048²), split 40 m (24), far 180 m (210); ultra: split 40 m (30), far 300 m.** — from
  the court the Heichal's facade (25–60 m) stood in the far cascade's 27 cm texels; now ≈ 3.4 cm to 40 m and 15 cm
  beyond on high (ultra 2.6 / 16 cm). Cost: high's depth atlas 6144 × 3072 (72 MB, was 32 MB).
- **Medium (env's key light): depth bias 4 → 1.5 cm, normal bias 1.2 → 0.7 texel (× the slope term).**
- **Light inside rooms: the sun mask through apertures (section 3)** removes the leak stripes at inner corners (the
  north wing's corner by the knife niches) and along chamber ceilings on every tier.

## (5) Bloom and smoke
- **Bloom prefilter: the per-pixel clamp of the bloom source is 4 × threshold for broad bright areas but 120 ×
  threshold for an isolated highlight (coverage = how many of four taps 2 px out on the diagonals are above the
  threshold; the clamp is blended by coverage).** — a sun glint on polished gold seen across the court (Helena's
  nivreshet at sunrise, Yoma 37b) is a 1–3 px spark: the per-pixel clamp kept 1/100 of its flux and it never bloomed,
  while a sunlit gold panel with the same flux did. Broad areas (the sun's disc, gold walls, flames) bloom as before.
- **The nivreshet still does not flash at the court viewpoint (open).** `nivreshet-scan.mjs` (high): the builder's
  glint passes 0.75 from sunrise+5 and the Sun clears the Mount at the camera at sunrise+18 (alt 3°, az 109°); the
  globe hangs in the sunlit patch on the Ulam's back wall (env's sun mask through the opening opened wide: no change).
  Yet no pixel carries the Sun's mirror image: at roughness 0.05–0.09 (α = r²) the image on a lobe is ≈ 1 mm across,
  far under a pixel (≈ 2 cm at 25 m), and three's specular anti-aliasing (geometry roughness ≈ 0.16 here) spreads it
  over the globe at ≈ 1/200 of its peak. `niv-spark.mjs`: without that widening, and with the material's maps dropped
  (plain 0.06), the lobes show a few small points, no flare. Physically the globe returns I ≈ E·F·r²/4 ≈ 20 cd at a
  3° Sun (≈ 260 × a facade pixel at 25 m) — a spark the eye sees as a star. Rendering it needs a flux-conserving glint
  impostor at the mirror point (render/fx, sun visibility by one ray), which the builder's "physical flash, no added
  glow" note rules out today: left for a decision (requests). The bloom side is ready for it.
- **Pyre smoke density × (size / reference)^0.8 (0.3–1.5), on top of the width (∝ size) and height (∝ √size).** — the
  smoke flux of a pile grows with its burning area while its column's width and rise speed grow ≈ with its size, so
  its optical depth grows with size: the great pile's column (two emitters) is now denser and wider than the small
  piles' thin ones (incense pile 0.75 m: density × 0.48, third pile 1.15 m: × 0.64, great pile 2.4 m: × 1.16).
- **The thin vertical line above the Moked hearth is the gap between the two leaves of the door to the chel** (courts
  `doorPair`: each leaf (s1 − s0)/2 − 0.02 amah, the leaf set 0.04 narrower — 2–4 cm open at the meeting stiles, the
  dark night outside showing through; on low, without SMAA, a crisp black line). Not render's: requested from
  build-courts (a lapping astragal, as the Mount gates have).

## (6) Far haze
- **The aerial perspective reaches full density at the boot tier's draw distance, from 0.55 × it (smoothstep on the
  transmittance; `mkFogParams.w`, `?farhaze=0` off).** — the terrain ends at quality.drawDistance and its skirt (1.5 ×)
  showed its texture as pale streaks on the far ridges (low: 2.5 km); the Mount of Olives (≈ 1 km) is untouched on every
  tier. Alternative: physical haze only (T ≈ 0.8 at 3 km in Jerusalem autumn air — the skirt stays visible).
- **Known: fully hazed, the far ridges read ≈ 5–10 / 255 lighter than the sky right above them** (a light rim on low
  seen from a raised viewpoint, `haze-low-after`, `haze-w-low-after`). The fog's air light is the sky statistics' horizon fit; the sky just above a
  far silhouette (at or below 0° from a raised viewpoint) is darker in the sky-view LUT. Fitting the air light to
  0.1–1.0° instead of 0.5–3.5° changed it by < 1 / 255 and was dropped; matching it would need the LUT itself in the
  fog (a texture unit in every lit material).

## (7) Performance
Measured with GPU timer queries on the HD 4600 (`perf-var.mjs`, min / median of 30 frames, full patch vs three's stock
chunks alternated in one page, night, court view [238, 385] and Kodesh view [136, 330.5]). Before this task, the same
script: medium court +22 ms (66.8 vs 44.6), Kodesh +30 ms (77.6 vs 47.5); the room loop ≈ 11 / 17 ms and the probes
≈ 10 / 13 ms of that.
- **Every block read is a memory load on this iGPU (≈ 1–2 ms a frame per vec4 per fragment at medium), so the data is
  packed and indexed instead of scanned:**
  - a plan grid over the union of the selected rooms (32 × 24 cells of 16 bits, `mkGrid`): a fragment in the union
    reads its cell (one load) and tests only the ≤ 4 rooms listed there (one half-float box each), instead of every
    selected room (8 on medium, 12 high+); more than four in a cell: the four highest-ranked (rare);
  - apertures one uvec4 each (centre in cm from the room's box, openness and brightness beyond as unorm8, extents in
    cm, axis code) — was two vec4;
  - probes: one uvec4 influence box (cm from a fixed site origin + half2 shell / margin), then three vec4 only for a
    fragment inside it; probes sorted interior first and the loop stops once their weight has used the fragment up
    (was two vec4 per probe for every lit fragment, five more inside);
  - point lights' room records as half + bits, four lights to a uvec4;
  - a fragment outside every room never reads the interior probes' boxes (their count is in the header's flags);
  - a room with its own probe (Kodesh, Ulam on medium+) skips the reflection's exit test over its apertures (the probe
    holds the opening in its capture) — ≈ 1–2 ms in the Kodesh at low-tier resolution;
  - the fire occluder: one light, its shapes literal constants (one block read).
- **"Bake sky visibility into a low-res 3D texture" (the suggestion) was not taken:** a sampler for it would need a
  texture unit in every lit material — three clones texture uniforms per material (`UniformsUtils.cloneUniforms`), and
  a unit bound behind three's back is fragile (the reason the probes live in the envMap atlas). The grid does the part
  of that idea that mattered (finding the room cheaply); V itself stays analytic over ≤ 4 packed apertures.
- **Opt-out: materials with `userData.mkInterior === false` compile the room path out (`MK_NO_ROOMS`; probes, sky and
  fire occluders stay).** env sets the define before the first compile and once more on 'ready'; the materials
  library now marks its outdoor-only keys (terrain, olive, roof earth, rubble, bark). The room path's mere presence
  costs ≈ 9–12 ms a frame on medium where it never runs (every material compiled without it: `perf-var` noRoomCode),
  but opting out more of the scene bought nothing measurable, so neither of these was kept:
  - per material, automatically (every material none of whose meshes has a vertex within 1.5 m of a room: 15 of 55 —
    terrain, olive foliage, timber, lattices, some whitewash variants): court 71.6 / 72.0 ms, Kodesh 91 / 92 ms (with /
    without, alternated in one page);
  - per object (a static mesh whose world box misses every room draws with a copy of its material without the room
    path, the copy following its source on every draw: 31 meshes, 24 materials — the altar, some court pieces):
    court even, facade view ≈ 2.5 ms slower with the copies, Kodesh noise. (A first try with plain `Material.clone()`
    measured 4–5 ms faster: `copy()` drops `onBeforeCompile`, so those clones had lost the materials' own patch.)
  The stone, pavement and wall batches that fill the frame are merged site-wide (StaticBatcher: one draw per
  material) and touch some room; only splitting them near the rooms could take them off the room path.
- **Loops run to data-dependent counts (aperture, probe, occluder loops), and an aperture's frame is built once and
  branch-free** — FXC unrolled constant-bound loops with breaks (16 apertures × three inlined tests). Compile + first
  draw of every lit program, cold, medium (`compile-time.mjs`, one page; programs later in a run take longer, so
  these compare at the same place in the run): stock 24 s, HEAD's patch 87 s, this patch 90 s. Of this patch's
  share: the room path ≈ 37 s, the probe loop ≈ 26 s, the fire occluder ≈ 10 s (each compiled out in turn).
- **An earlier call of the room setup (before three's lights, to shorten live ranges) measured no difference** and was
  reverted.
- **Result: frame cost about where it was — the extra work of this task (fire occluder, sun mask through apertures,
  Ulam probe, gold gain) was paid for by the packing, but the overhead was not reduced substantially.** Same scenes,
  full patch − stock, min of 30 frames, alternated in one page (HEAD = the patch before this task, measured the same
  way in a copy of the tree with HEAD's `src/env` and `src/render`): medium court +19–25 ms (HEAD +16–25), Kodesh
  +26–30 ms (HEAD +24–28); low court +4 ms (HEAD +3), Kodesh +9 ms (HEAD +7). The remaining overhead is register
  pressure from the room path (≈ 9–12 ms, above) plus the probe loop on medium (≈ 10 ms court); the next levers are
  the world splitting its batches near rooms, or a screen-space pre-pass for the room terms at reduced resolution.
  Timings swing ± 5 ms between runs on this shared machine (other agents' browsers, a CPU-bound desktop app).
