# qa-r2-fix-env-render — decisions

Fixes from the second QA round in `src/render/**` and `src/env/**`. Format: **Choice** — why — alternative. ⚙ =
reconstruction. Shots: `shots/qa-r2-fix-env-render/{before,after}` (the QA's own queries, `tools/shot.mjs --q high`),
`wip/` (iterations), `diag/` (A/B and picks), `perf/` (ENV-R2-6). Dev scripts were one-boot `src/render/dev/session.mjs`
scripts kept out of the tree.

## ENV-R2-1 — the altar fire by day from the court floor

- **Not a grazing card.** The flame cards are cylindrical billboards that face the camera; from the QA's spot the
  flames stand 12° above the eye, about 80° from their own plane. Zoomed in at the same spot (fov 14°), the sheet was
  two things. First, the erosion noise ran at ≈ 17 cells per flame height, so a 2.4 m pile shredded into a dozen small
  fragments (≈ 3 px each at 25 m). Second, the hot core was confined to the lowest third, so with the fuel hidden
  behind the altar's edge only thin orange remained.
- **Tongues at ≈ 6 cells per flame height** (period-8 noise), with the 17-cell layer only fraying the edges, at 34 % and
  faded out as its cells drop under 2–6 px (`fwidth` of the card's v, taken before any branch). A wide pile now breaks
  into a few tongues, not into fragments. — Fewer cards (the overlap was not the cause).
- **A yellow-white centre inside each tongue in the upper, intermittent flame** (+0.3 · y × the tongue's interior ×
  thickness on the temperature). Its soot glows, and only the skin is orange-red. The core layer starts at T 0.6
  (was 0.62), pale yellow-white. Daylight luminance is unchanged: the body is still no brighter than sunlit stone
  (qa-r1). Only its distribution changed.
- **The heat shimmer never bends a flame's own pixels.** The flames have no depth of their own, so the shimmer (which
  bends only what lies behind the plume) bent them with the wall behind. Now:
  (a) the composer buffer's alpha carries an emitter mask: `FXPass` resets it to 1 with one colour-masked clear, and
  flames, embers, glows and glints multiply it by (1 − their coverage) through separate alpha blend factors;
  (b) the shimmer skips pixels that are emitters, or whose displaced source is one;
  (c) it starts in the flames' upper half (q.y −0.62 → −0.2, was −1 → −0.45).
  A thin flame (a lamp: soot emissivity ≈ 0.04) would barely mark the mask, so on the post tiers its hot core counts at
  0.4 at least. Behind a core that bright the extra occlusion cannot be seen.
  — A geometric cut alone (it left the flames' soft margins smeared), or a separate pass before the FX (an extra
  full-screen pass on the HD 4600).
- **A grazing fade (as asked) is kept only as a guard.** It fades a card seen within ≈ 25° of its plane, which with
  the lean can only happen looking down the axis. The lean toward the camera now applies from below too (|toCam.y|),
  for the altar's foot.

## ENV-R2-2 — the black band on the Heichal's west face

- **Cause:** the KhK's volume had been grown through the whole west wall to its outer face at the foot (X 89, 7 amot;
  render-env-2, for the lul). The wall steps back to 5 amot above +44 (site.js profile), so its outer face above the
  western ta'im roof (+55) stood 2 amot (0.96 m) inside the box, beyond the 0.4 m shell. It was lit as the dark,
  gilded room up to the KhK's ceiling (+63). This matches the QA's raycast (X 91.0, Z 60.1) and the "north face west
  end" (the same face seen past the corner).
- **Fix:** the KhK keeps its own box. Its west face joins a new volume, `heichal.lul-west` (the 4-tefach slot through
  the wall, inner to outer face at its height, as dark as the KhK). The curtain's back faces stay in the KhK, the
  jambs are in the slot, and nothing outside the wall's inner face is in the room. — A per-face shell (no such field;
  a 3 m shell on the whole box would have lit the Even Shetiyah's sides as sky), or excluding the exterior wall keys
  (the materials are shared).
- **The F1 band of the Kodesh is not affected:** the Kodesh is grown east only. The 5-amah north and south walls put
  their outer faces 2.4 m outside its box (`after/a2-*`).

## ENV-R2-3 — the south-west horizon at sunrise

- **Cause:** the aerial perspective's air light was a 3-term Fourier synthesis of five horizon samples (0, 45 … 180°
  from the Sun's azimuth). With the Sun just up, the sunward sample is many times the others, and the truncated series
  rang below zero about 100–120° from the Sun, red first. Clamped to zero, it left a blue-violet air light. Far ridges
  hazed to violet, and at the draw distance (T → 0) the crest was the pure air light: the blue line. The sky right
  above was warm grey.
- **Fix:** interpolate geometrically between the five measured samples themselves (`mkFogA0…A4`): exact at the
  samples and never below zero (fog.js, and `env.skyColorAt` on the CPU). Measured at
  `t=sunrise+20&at=2171.67,330.5`: the crest went from (56, 60, 119) to warm grey, matching the sky above, and the
  terrain from violet to brown-grey. — Clamping the series per channel (the colour would still be wrong between
  samples), or more Fourier terms (more uniforms for the same ringing).
- The terrain in the Earth's shadow at the exact sunrise stays blue-grey (build-mount.md), and now has no saturated
  line.

## ENV-R2-4 — night bloom and fire light

- **(a) The dotted line at the altar's foot is the great pile's cube shadow leaking, not the coal-bed decal** (hiding
  the decal changed nothing, `diag/e-foot-nobed`). The 128² cube map is drawn by the casters' back faces, and where the
  altar's body meets the yesod's top, the body's north face lies on the yesod: the taps leaked along that seam as a
  row of points (sparks to the bloom). **The shadow slot's light now also carries the fire occluder record**: the
  altar's top occludes it analytically below the top, as it already did for the plain slots. The row is gone
  (`diag/e-foot-rec`, `after/`). — More cube-map bias (that detaches near shadows) or front faces in the cube map
  (render-env-2 kept back faces: the near texels would need metres of offset).
- **(b) The "neon tubes" were the Nikanor gateway's upper courses lit by the altar's fire past the altar's corner,
  seen from the altar's shadow:** an L-shaped band far above the dark-adapted exposure. Without bloom it read as a lit
  wall (`diag/b-foot-nobloom`); the bloom drew it as glowing tubes. **At night the bloom source of a lit surface is
  clamped at 1 × threshold**, while emitters keep the broad (4×) and spark (120×) clamps. Surfaces are told from
  emitters by the emitter mask (ENV-R2-1), and the sky is excepted. The clamp fades in as the Sun sets from +2° to
  −4°. By day nothing changes (sun glints on gold and bronze are what the spark clamp is for). The eye's own glare
  round a 25 cd/m² wall at 1° is ~1 % of it. — A thin-line detector in the prefilter (it would also have clamped
  torch and lamp flames, which are as thin), or lowering the bloom radius for everything.
- **(c) The Menorah's "glow ball" was not the flames' bloom.** With bloom off it stayed, and with the fire lights off
  the seven flames stood clear (`diag/cmp-menorah`). It was the merged light of the seven lamps — one point at their
  centroid 1.2 m before the gold relief — printing one round, mirror-sharp hot spot. Two fixes:
  - A cluster of fires has its spread as source radius: √((0.35 × size)² + RMS distance of its fires from the light),
    ≤ 1.2 m. 1/(d² + r²) then gives the row's peak irradiance on the wall: 0.59 per candela·m⁻² against an exact sum
    of 0.60 over the seven lamps, where the point gave 0.69.
  - Fire lights widen their own highlights by their source size (Karis 2013, sphere lights: α' = α + r/2d, lobe ×
    (α/α')²; three's GGX and the light-info functions patched once in `installFireFalloffChunk`; the sun, moon and
    spot lights reset it).
  The seven flames now resolve, over a broad sheen. — A light per lamp (the budget is 2 lights on low, 8 on high).

## ENV-R2-5 — Beit HaMoked at night

- **Charred logs with smouldering cracks, and ash round the kerb, by the coal-bed decal.** A hearth's decal now
  reaches 2.8 × the bed's radius (`charR`, presets).
  - Beyond the glowing bed it chars the logs along their length (≈ 0.82, less on their flanks and on the kerb's
    vertical face) and lets dull red cracks smoulder toward the fire.
  - It greys the floor round the kerb by ash and soot to half its albedo ⚙ (a hearth burning day and night, Tamid 1:1).
  — The logs' own material (world/materials' files).
- **The floor near the hearth was not clipped:** 225 sRGB, ≈ 2.0 stops over 18 % grey, under walls lit at 194. Its
  whiteness is its high albedo. The ash ring lowers it where it was brightest, and no near-field clamp was added (the
  falloff is already 1/(d² + r²) with the flames' radius).
- Requests to materials/world: a soot gradient on the walls and dome above the hearth (and the oculus rim), and a
  softer wool weave for the sleepers' covers (people's props).

## ENV-R2-6 — low-tier sun shadows (measured, dropped)

- **Built and measured behind a dev switch, then removed.**
  - Built: a 1024² key-light map over ±30 m (±60 m with long shadows), static world only (the people keep their
    contact shadows), rendered straight into the light's own map, and re-rendered only when the light turned 0.25° or
    the viewer left the held framing.
  - Per-frame GPU on the HD 4600, separate boots, A/B/A/B (timer-query medians):
    | view | off (ms) | on (ms) | added |
    |---|---|---|---|
    | 15 steps d2 | 14.29 / 14.15 | 16.17 / 15.28 | +1.5 ms |
    | slaughter d4 | 14.92 / 14.99 | 18.43 / 17.10 | +2.8 ms |
    | court d3 | 14.09 / 14.95 | 16.31 / 17.33 | +2.3 ms |
    | default | 14.54 / 12.94 | 14.55 / 13.96 | +0.5 ms |
    The map itself is drawn once per framing. The cost is the 5-tap PCF in every lit fragment, and it takes the court
    past the 16.7 ms vsync budget.
  - Cold production first view (`tools/shot.mjs --prod --q low`, fresh browser each run, interleaved): firstImage
    20.45 / 20.03 s without, 21.28 / 20.67 s with (+0.7 s; 'compiled' +0.8 s, 3 more programs). The ≈ 14 s target is
    already over (PPL-R2-5).
  - The cost was not met, so the switch and the static-only cache path were taken out again. No request to core.
  - Alternative: hard 1-tap shadows (BasicShadowMap) — aliased edges, the defect ENV-R2-7 is about.

## ENV-R2-7 — the sawtooth on the 15 steps' risers

- **Cause:** with the casters' front faces in the map (render-env-2), a PCF tap a texel or two below a lit riser in
  light space lands on the tread in front of it. With a low Sun that tread is nearer the light by up to tap reach ×
  cot(altitude) (≈ 20 cm at 20°): a false shadow along every concave edge, stepped by the texel grid. A riser's normal
  offset is horizontal and cannot lift the receiver out of it. A 10× depth bias removed it but would detach the 8 cm
  lintels' shadows; radius 1 / 5 and more normal bias did not.
- **Fix:** the casters are drawn with a slope-scaled depth offset (glPolygonOffset factor 1, orthographic shadow maps
  only, the faces render-env-2 draws double-sided). Faces grazing the light (the treads: ≈ 9 cm at a 20° Sun) are
  pushed back; faces facing it (≈ 1.5 cm) barely move. Factor 1 removes the sawtooth. The lintel shadows, the sovev
  slab's contact and the lintel close-up change by < 0.2 mean (`diag/po-*`); factor 2.5 began to thin the lintel
  shadows. Applies to medium's key light too.

## ENV-R2-8 — the "floating disc" in the doorway (not reproduced as a defect)

- **It is the Sun's patch through Beit HaMoked's oculus on the inside of its dome**, seen through the open Moked gate,
  not the Ulam's north chamber. The pixel picks the dome's plaster at (205.8, 409.3, 39.3), 8.9 amot from the dome's
  axis. A ray from the oculus along the d4 Sun direction meets the dome at 9.1 amot, Z 40.2. It moves with the Sun
  (d3 higher, d4, gone by d5: `wip/cmp-f8-sunpatch`), and no fx sprite or probe mesh lies on that pixel.
- A sunlit patch in a hall otherwise lit through its gate is that much brighter than the dome round it. The dithered
  edge is three's 5-tap PCF penumbra. The oculus itself is ⚙ (moked.js: a smoke vent). No change.

## ENV-R2-9 — speckle on mid-distance robes (not reproduced as SSAO or dither)

- **N8AO off: unchanged. The people's shadow casters off: gone** (`diag/cmp-robes`). The pattern is the soft shadows
  the kohanim in the rows cast on each other at 07:08 (Sun ≈ 10° in the east-south-east): raised arms and bodies at
  3.4 cm texels. Zoomed (fov 16°) these are smooth penumbrae, and the speckle is their sub-pixel detail at 25 m. The
  people's dot screen (IGN-rotated taps) was fixed by the people task this round (PPL-R2-6). The fade dither cannot be
  the cause: it does not depend on the casters. Nothing changed in render/env.

## ENV-R2-10 — the "wet" streak in Beit HaChalifot

- **Cause:** the interior probes' rough reflections. In a room lit through its openings, the diffuse light from the
  probe is scaled by the sky-visibility ratio here / at the probe (V ≈ a fifth in the Ulam's north wing). The rough
  reflections were not scaled: render-audio-3 applied that to the Kodesh only and kept the Ulam's "as render-env-2 had
  them". The niche wall's rough specular (margins 0.55, pecked bosses 0.8) therefore carried the mid-porch's
  brightness: about a third of the wall's luminance, mottled by the bosses into a darker, glossy band. The atlas
  sampling matches three's cubeUV exactly, and the mips have no seam or padding error (`diag/atlas-ulam`); the dark
  region is the dim far end of the porch in the capture.
- **Fix:**
  - The rough-lobe visibility scaling (`mix(1, vr, smoothstep(0.35, 0.8, roughness))`) now applies in every interior
    probe's room. The gold leaves, the vine and the nivreshet (roughness < 0.35) keep their reflections.
  - Where the needed blur exceeds the probe's widest (roughness · √k > 1, box projection), the lookup blends toward
    the cosine-weighted radiance about the normal by 1 − 1/eR², the limit of a very wide lobe.
  The band is gone. The Ulam, Kodesh and court views change by < 0.5 mean (`wip/h10-*`).
- **Low (no probes): the same wall showed a hard-edged bright band** where reflected rays leave through the Ulam's
  opening, which the niche wall sees almost edge-on. The exit test works in the opening's own plane, so it stayed
  near a constant as the ray turned parallel to the plane, then fell to 0. For rough lobes (0.2 → 0.6) the exit is now
  weighted by the opening's foreshortening, smoothstep(0, 0.35, r·n). Glossy lobes keep the exact test, and the
  key light's mask through openings is unchanged. The band is reduced to a faint sliver on the top course
  (`tiers/cmp-low-chalifot`); the Kodesh, the Moked, the Gazit and the Ulam on low are unchanged.

## Cross-tier checks

- Medium (`tiers/medium`, `diag/cmp-m-*`): without the caster offset its key light showed the same sawtooth on the steps,
  worse at its 8–21 cm texels; with it they are clean, and the sovev slab is identical. The night surface clamp works
  without AO; the small lamp flame kept its glow once its core marked the mask.
- Low (`tiers/low`): the flame changes apply (one erosion fetch, as before); no bloom or shimmer on low.
- The Kodesh's gold and the Moked's gold door read olive-dark at night in the final shots. An A/B with this task's last
  two interiors changes off is identical (`diag/grid-iso`, mean diff 0.1 / 1.1): it comes from the gold material's
  roughness change made concurrently in this round (materials, `kinds-metal.js`), not from env/render.

## Performance

- Programs: no new ones (the chunk patches change existing programs; the emitter-mask clear is a `gl.clear`).
- Per-fragment: the haze reads two alpha taps where a plume is; the bloom prefilter reads the centre's alpha (already
  fetched); fog interpolation adds an `acos`, 2 × 3 `log` and `exp` per fogged fragment (`mkApplyFog`); a GGX lobe
  adds 3 ALU per fire light.
- `node tools/warmup-check.mjs` (cold production, every tier × shot / play): ALL PASSED. First frame after 'compiled':
  +110 / +151 ms (low), +478 / +491 (medium), +952 / +1066 (high), +1135 / +1095 (ultra). First view: low 18.6–19.0 s,
  medium 31.8–32.3 s, high 49.8–50.3 s, ultra 60–70 s. These are slower than the perf pass's figures, but other fixers'
  sessions were rendering on the same HD 4600 throughout, and the uncommitted round-2 work of other areas is in the
  tree; no attribution was possible without a clean machine. `npm run build` passes.
