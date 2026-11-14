# materials-realism — decision log

`- **Choice** — why (source / reasoning) — alternative.` Owned: `src/world/materials/**`.
Brief: "more beautiful and realistic, more immersive" without costing frame rate on low / medium. Four problems: (1) the
default view on low (pre-dawn, the Chel steps and the Ezrat Nashim east wall) read as flat tinted strips; (2) close range
on low (1–3 m) a blur, joints as wide soft dark bands, step risers flat stripes; (3) the courts sterile by day; (4) the
Kodesh's gold flat mustard on low. Shots: `shots/matreal/` (`final/{low,medium}-{before,after}/`, iterations `low-a1`,
`low-a2`); the "before" of every pair is the same tree with `src/world/materials/` as it was at the start (a snapshot in
the scratchpad), shot back to back with the "after".

## Diagnosis

- **Why close-range detail does not carry on low: there is none on low by design.** `index.js` turns the detail layer
  off below `quality.detail` 1 (no `d_*` sets, no `MK_DETAIL` program variant: one sampler fewer); what remains is the baked
  map, 512 px class: the Herodian wall at 31 mm a texel (tile 13 m / 416 px), the Azarah floor 48 mm, the steps 27 mm,
  the gold sheets 26 mm. At 1–3 m one texel spans 10–30 screen pixels, so anything in the map is a bilinear blur.
- **The baked maps put their energy in the wrong octaves for those texels.** The generators sample one point per texel
  (no supersampling); the marble's crystalline grain (26 / m), the boss's 38 / m tooling, the steps' 30–40 / m tooling and
  18 mm pits are above a 2–5 cm texel's Nyquist frequency (10–16 / m), so they aliased into texel-sized speckle — up close
  a soft mottled blur, not stone. The pointed boss's pits and the cavity at the bevel's foot are faded below ~3 texels
  (correctly), but nothing stood in for their mean, so on low and medium the boss and the margin had the same tone and
  occlusion: under the pre-dawn sky (almost all indirect light, where normal maps do little) the drafted margins vanished.
- **The pavement's joints were drawn two ways, both wrong for the texel.** On low (texel > 3 cm) the joint was widened to a
  half texel with a 0.6-texel arris at full darkness plus a 0.45 occlusion: a 5–10 cm grout band. On medium / high
  (12–24 mm texels) the 3–7 mm joint was point-sampled: depending on how a joint fell between texel centres it was drawn,
  half drawn or missing (visible in the audit's `m-azarah-d3`).
- **The low tier's gold is lit by an almost even analytic environment** (env `interiors-glsl.js` mkIBL, `goldRoom`: a
  reflection that stays in the room returns the room's albedo × V × the gate's light × the gilded gain, modulated only by
  the gate's visibility from where the reflected ray meets the room's box). The floor looking west reflects the far end
  wherever its facets point; no facet can turn a reflection 180° to the gate. So the metal returns one smooth radiance, and
  gold with one radiance is mustard paint. Measured on low at d3 (region of the floor, 960 × 540): mean sRGB (135, 102, 48),
  luminance sd 2.7.

## Analytic hairline joints (patch.js `mkJoint`; low and medium)

- **Where a masonry / sheet texture is magnified (≥ 1–2.2 screen pixels a texel), the patch draws each joint itself:
  a box-filtered dark line of the joint's physical width with a rounded arris whose mean slope over the pixel goes into the
  normal.** Course joints from the course coordinate (exact, also with the course table). Vertical joints from the albedo
  alpha the masonry sets already carry (block-local distance): across the one texel where bilinear filtering mixes two
  blocks the derived block start races along u (≈ len / texel times faster than u; inside a block it holds still), measured
  with screen derivatives (∂u0/∂u from the 2 × 2 Jacobian, so a course joint's vertical mix is not mistaken for one), and
  block starts lie on the layout's grid ((k + ½) q), so the joint is the nearest grid line; just right of a joint the small
  block-local distance confirms it too. The line is box-filtered over the pixel's footprint, so it never aliases and fades
  to its true mean darkness as it recedes. The baked soft joint stays under it (it is what reads from afar), at reduced
  strength on the pavement (below). — Alternatives: a hairline baked into the map (it cannot be thinner than a texel);
  sampling the layout LUT in the patch (a new sampler and a dependent read on low: not allowed); a higher-resolution map
  (memory: same sizes per tier was a constraint).
- **Widths per key (`JOINT` in index.js), the baked joints' own: Herodian 1.2 mm open joint + 4 mm rounded arris (laid
  dry), ashlar 1.5 + 4, the Heichal's washed ashlar 1 + 5 at a light tone (the wash fills it), the Azarah 1.2 + 5, the
  Mount 2 + 8 (worn), the gold sheets' seams 0.5 + 2.** Reconstruction (the sources fix the materials, not joint widths).
- **On low and medium only (`quality.textureSize` ≤ 1024), except the steps (below).** High's 6–8 mm texels draw the
  joints well enough and are left exactly as they were.
- **Cost (cannot be timed here — SwiftShader): ALU only, no texture fetch, no new sampler, no new program.** Per fragment of
  every patched material: 6 screen derivatives and ~15 ALU ops outside the branch; where a joint is near and magnified ~40 ALU
  ops more (the branch is coherent: whole regions are near or far). On the HD 4600 (≈ 400 GFLOP/s) at low's ≈ 0.9 M pixels
  that is ≈ 50 M ops a frame ≈ 0.1 ms, against the patch's measured 1–2 ms (materials.md). The uniforms (`mkJoint`,
  `mkJoint2`) are in every patched material so programs stay shared; program count unchanged (below).

## The steps (problem 2: risers as flat beige stripes)

- **The steps set is laid in blocks: one course per riser — half an amah, 0.24 m at the default amah (Middot 2:3:
  "רוּם הַמַּעֲלָה חֲצִי אַמָּה, וְשִׁלְחָהּ חֲצִי אַמָּה… כָּל הַמַּעֲלוֹת שֶׁהָיוּ שָׁם"; Middot 3:6 the Ulam's steps
  "רוּם מַעֲלָה חֲצִי אַמָּה" too) — stones 0.75–1.75 m long, joints broken course to course; the tile is 3 × 2.88 m so
  courses meet the risers' edges wherever a flight starts on a multiple of half an amah (all of them in site.js).** The
  stone lengths are reconstruction.
- **Nothing of the blocks is baked; the patch draws their joints and their stone-to-stone tone on vertical faces only
  (`mkJoint2.y` = −1: the face's normal from screen derivatives), on every tier.** World UVs run along a riser but across a
  tread of the same flight (applyWorldUV: floors take plan x as u), so baked or tread-side joints would run along the
  treads; the treads stay one monolithic stone each. High gains joints on the risers within a few metres (no baked joint
  there to clash with). — Alternative: builder-side UVs per tread (not this owner's).
- **The stone kind gained an optional layout (`uP1.x`: alpha = block-local distance) and is band-limited on coarse
  textures**: its 30–40 / m tooling and 18 mm pits fade above Nyquist and a 5–20 cm mottle carries the energy. High unchanged.

## The Herodian walls (problems 1 and 3)

- **On coarse textures (texel ≥ 11–16 mm: medium and low; `cz`, 0 on high) the mean of the unresolved dressing is baked:
  the pointed boss is darker under the sky than the smooth combed margin (micro-occlusion of its pits and ridges: occlusion
  −18 %, albedo −5 %, scaled by how much of the pitting the texture has faded), and the margin is shaded where it meets the
  foot of the bevel (occlusion −30 % over ~1.3 texels).** Net effect: the Herodian courts ~2–3 % darker on average (mean
  screen luminance, medium azarah-d3 148 → 144), the price of bosses that read as dressed stone. Under the pre-dawn sky, where the light is nearly all indirect,
  each stone now reads as a raised boss in a pale drafted frame instead of a flat rectangle. The previous logs warned against
  a pale margin drawn as an outline (materials-2) — this is not a drawn line but the boss's own mean darkening, and only where
  the boss's texture is not resolved; high (where the pits and the detail map carry it) is unchanged. — Alternatives:
  brightening the margin (an outline: rejected before); a stronger normal map (pre-dawn light is indirect: it barely reads).
- **The bevel is at least ~2.2 texels wide** (a 3–5 cm bevel at 31 mm texels stair-stepped into a broken line on low; ≥ 2.2
  texels is under 32 mm on high: unchanged there). **The drafted margin shows from 1.2 texels (was 1.5)**, so the courts'
  inner faces keep their margins on low (40 mm texels: they were plain blocks there).
- **Detail above the texture's Nyquist frequency is dropped on coarse textures** (the boss's 38 / m tooling, the marble's
  26 / m grain): it aliased into texel speckle. In the marble the grain's energy goes into an ~8 cm mottle the texture can
  carry, so the stone is not a flat plane up close. Unchanged where texels are under ~11 mm.
- **Stone-to-stone variety, every tier: about one stone in eight a little greyer (−6 %), one in ten creamier (warm — never
  blue, qa-r2), and a light film of dust bound by dew in patches, heavier toward each stone's foot and on some stones than
  others (≤ 4 %).** The building was kept and was at most ~90 years old: restrained weathering, not a ruin. Reconstruction.

## The pavement (problems 2 and 3)

- **The joint's colour and occlusion are drawn at least ~1.2 texels across at the joint's mean darkness over that width
  (but not under half — on low 0.6: dust settles in a joint and along its arrises, and on low the joints are the floor's
  main cue at 5–20 m; 0.75 brought the grout band back up close, 0.35 lost the grid in the sunlit Ezrat Nashim); the relief
  (normal) as before.** Every tier: high's
  Azarah joints go from point-sampled (drawn, half drawn or missing) to even at 58 % strength; the Mount's (10 mm with its
  worn arris) are unchanged on high. On low the 5–10 cm grout band is gone; up close the patch draws the hairline.
- **Marble slabs carry soft grey drifts across the slab, stronger on some slabs than others (the clouded white marbles;
  ≤ 16 % darker, slightly cool): the Azarah at full strength, the Mount's weathered slabs at 0.45.** A court of them no
  longer reads as one flat sheet. Rambam BhB 1:10 ("וּמְרַצְּפִין אֶת כָּל הָעֲזָרָה בַּאֲבָנִים יְקָרוֹת") fixes costly
  stones, not their figure: reconstruction. The same halachah (a loosened stone is unfit to stand on until it is set again)
  argues for a floor kept sound: no broken or lifted slabs were added.
- **On low the slab palette is pulled 30 % (was 50 %) toward its mean and the slab spread reduced by 30 % (was 50 %)** —
  qa-r1 halved them because flat-tinted slabs read as a checkerboard; with texture inside the slabs a little more tone
  between them reads as stone.

## The Kodesh's gold on low (problem 4, partly)

- **Low only (texel ≥ 15–24 mm; medium and high unchanged): each sheet beaten a little differently (F0 tone ± 6 %,
  roughness ± 0.05), burnished and duller zones of 10–30 cm (tone ± 9 %, roughness ∓ 0.07), the sheet's waviness twice as
  deep so its facets tilt a few degrees and break up the lamps' and the gate's highlights, and the 2.5 cm hammer dishes
  (a texel each: a noisy normal) mostly faded; the analytic seams show the sheets up close.** Floor region on low at d3:
  luminance sd 2.76 → 3.17, mean unchanged (135, 102, 48); the plating now reads as fitted sheets, not paint. — It
  is a stand-in in the texture for reflections the tier does not compute; the real fix is env's (below). F0 not changed:
  the plating's grade was tuned against the sources and the other tiers (gate-world-materials).

## Measured (this machine: SwiftShader, so no frame rates; before = the same tree with the materials of e4815ed)

- Texture memory (baker formula, `ctx.mats.stats.MB`): low 24.2 → 24.2 MB (57 sets), medium 61.2 → 61.2 MB. Same sizes.
- Programs (`renderer.info.programs` at capture): medium identical in all five views (90 / 91 / 91 / 89 / 90); low 74–77
  per view on both sides, varying ±1 between two captures of the same build (deferred compiles still landing); a dedicated
  pair at the default view, twice: 74 / 74 both times. No new define, variant or material.
- Bake time: every baked low set (57) re-baked with a GPU sync (`baker.bench`), three passes per page, two cold pages per
  side, interleaved: before 1943–2457 ms a pass (median ≈ 2165), after 1570–2366 (≈ 1920); `herodian_c` alone five times a
  page: 182–329 ms vs 198–427 ms (medians 274 / 273). No growth measurable above the noise (±15 % run to run). The
  generators gained one basis fetch (the marble's grain stand-in), one block hash and ~30 ALU ops in the Herodian kind, a
  texelFetch in the stone kind.
- Draw calls / triangles: unchanged in every view. Console: no errors or warnings from materials in any capture.

## Not changed

- Texture sizes, the set list, the detail layer's tiers, the parochet, kochla and gold grades, the altar's lime.
- The altar's lime on low stays as it was: its stones are 11–25 cm and already resolved; what reads as a blur in the audit
  shot is the shade (no direct light for the normals).

## Requests (needs from others)

- **env (low, gilded rooms):** the analytic environment for a reflection that stays in the room is the room's albedo ×
  V × the gate's light, scaled by the gate's visibility from the hit point (`inRad *= vH / mkV`); away from the gate that is
  nearly constant, so a metal (no diffuse term) shows one radiance: the gold reads as flat mustard however its normals and
  roughness vary. A cheap structure in that term would let materials' variation read: e.g. the gate's image as a bright
  rectangle on the box (the reflected ray's hit point inside the main aperture's projection on the opposite walls, softened
  by roughness), and a darker band at the floor/wall corners. Also the gilded gain (1 + ρ + ρ²) makes low's daylight more
  saturated and ~1.5× brighter than medium's probe-lit room (lowend-visuals summary, kodesh-d3).
- **orchestrator (docs):** CLAUDE.md non-obvious choices — see the report's proposed line; docs/API.md materials: SPEC `joint`,
  uniforms `mkJoint` / `mkJoint2`, the steps' layout (`ctx.mats.tile('steps_stone').courses` = 12 rows of 0.24 m).

## Round 2 — calmer masonry at a distance (orchestrator's review of the sky pass shots)

Review: on low and medium the court walls read as a patchwork of coloured bricks at 20–40 m (low plaza at sunset; medium
Ezrat Nashim looking west), every block framed by its margin, and the joints dark lines of equal weight everywhere.

- **Every stone-to-stone difference halved where textures are coarse (medium, low; `cz` / SPEC `calm: 0.5` for the
  Herodian keys and ashlar_plain): in the bake the marbles' base tones are pulled halfway to the shayish, and the tone
  spread (±3.5 → ±1.75 %), hue cast, the odd grey (−6 → −3 %) and cream stones and the per-stone share of the dust film
  are halved; in the patch the per-block value and hue (BLOCK_HERODIAN ±3.5 → ±1.75 %, ashlar ±7 → ±3.5 %).** One
  quarry's stone differs by a few percent block to block; the stones on these tiers carry no texture of their own to
  read beside the step, so it read as tint. High keeps round 1's spread (its stones have texture). The three marbles
  stay distinct per stone (qa-r1's choice, kept), at half the contrast. — Alternative: fading the
  variation with distance only (the near walls were also too patchy).
- **The baked joint lighter on coarse textures (albedo ×0.85 → ×0.92, occlusion 0.8 → 0.88).** Up close the patch's
  analytic hairline draws the joint (round 1), so the baked one only has to read from afar — as a faint coursing.
- **From ~8 m to 32 m the Herodian walls' baked occlusion (the boss's pecking, the bevel's foot, the joints) eases to the
  wall's mean, 0.87 (patch.js FOOT_AO, strength `mkFootG.y`: 1 on medium / low, 0 on high).** A far wall becomes a calm
  surface with a faint coursing; near, where margins and hairlines resolve, nothing changes. Cost: one smoothstep, one
  division, one mix per fragment of the four Herodian keys, reusing the occlusion already sampled by three's
  aomap_fragment — no fetch, no sampler, no program (the uniform was there, its y unused).
- Not touched: the steps, the pavement, the close range (the analytic joints, the margins' bake), high.
- Measured (luminance sd over a wall region, same view / tier / time; before = the sky pass's r2 shots): low plaza at sunset,
  the shaded Ezrat Nashim wall 4.99 → 3.53; medium Ezrat Nashim looking west, the left court walls 9.16 → 8.15; medium
  azarah-d3, the left walls 10.36 → 9.29. Close range unchanged: low steps-close differs from round 1 by 0.57 / 255 mean.
  Programs (90 / 91 medium, 74–75 low), texture memory and draw calls as round 1. Shots: `shots/matreal/r2/`.
- Still framed: the near court walls at 8–20 m in side light keep their margins — that part is the bevel's normal under
  direct light and the boss's 5 % albedo, which round 2 left alone (the close look was not to go flat).
