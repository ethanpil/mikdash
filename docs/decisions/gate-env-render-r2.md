# gate-env-render-r2 — decisions

Round 2 of the QA gate's env/render findings: the cirrus that read as a jet contrail, and the Kodesh by day (remainder of
gate finding 4, lighting). Format: **Choice** — why — alternative. ⚙ = reconstruction / art direction.
Shots: `shots/gate-env-render-r2/{before,after}/{high,low}` (same queries before and after; `cmp/` side-by-sides and crops).

## 1. Cirrus: patches of hooked, fibrous cirrus, not one long streak (high / ultra)

- **Reproduced.** From Har HaMishchah at sunrise (`at=1350,330&look=270,1` and `look=300,20`) the old field drew one
  straight pink line ≈ 25° long; the opening frame at sunrise + 15 had a bare sky. The old density was an fbm 16 km
  along the wind × 4.5 km across plus a "streak" term 50 km along × 1.1 km across with a single octave across: at the
  default coverage only the streak term's crests crossed the threshold, so the visible cloud was one long band of even
  width.
- **New field (`sky.js` `cirrus()`) ⚙.** A low-frequency isotropic mask (≈ 25 km) places patches; coverage is how much
  of the layer they take (`0.5 − 0.3 c … 0.62 − 0.3 c` on a 2-octave fbm, calibrated offline so the default date's
  0.21–0.35 gives patches over the opening frame and the Mishchah view). In a patch the fibres come in tufts ≈ 7 km
  long down the wind, staggered across it, of uneven strength (×0.35–1), each a dense head with a trailing fall-streak
  that curls to one side by a per-tuft hook, the form of cirrus uncinus ("mares' tails") and fibratus, the high cloud
  that comes ahead of the early-rain fronts (yoreh) of Cheshvan. A slow cross-wind warp bends the fibres. Fine ridged
  strands (≈ 170 m apart, 12 : 1) run inside each tuft. No feature runs straight and even for more than a few km
  (≲ 10° seen from 40 km). Measured on the default date: Mishchah views show two or three patches of hooked
  tufts, pink-lit at sunrise; the opening frame shows a patch over the wall. Mid-morning views (`d6`, `d9`) show
  sparse, faint wisps.
- **Aliasing / cost.** The fibres' octaves and the strands fade, then stop being sampled, where they shrink below the
  pixel's footprint at the cloud (the geometric mean of its two axes). Outside a patch the cost is the mask alone
  (2 noise lookups, was 7). Shot fps with and without (`&cirrus=0`) on the HD 4600 at high is within noise
  (24 / 22 vs 20 / 25 on the sky-filled Mishchah view). Low and medium keep the clear dome, as before.
- Iterated offline with a JS port of the shader noise (`scratchpad/r2/cirrus-preview.mjs`, not in the repo): the first
  shader pass read as smooth brush strokes (fine octaves faded too early), the second added the strands.
  — Alternative: keep the clear dome (the QA's fallback). Not needed: no contrail remains.

## 2. Kodesh by day: the falloff now reaches the gold through its ambient (medium+); low lights a reflection by what it meets

Measured first, in linear light (scene rendered into a float target and read back, `--eval`), view
`at=152,330&look=270,6&t=d3`: the camera stands 5 amot inside the gate looking west.

- **What flattened the gold (medium+).** The gate-share factor on the gold's probe reflections (r1, `(Vm/Vref)^0.85`)
  does fall ≈ 2 stops from the near walls to the parochet's end, yet the walls fell 0.9 stops and the floor 0.5. With
  the probe's irradiance zeroed the gold went black: the materials' metal treatment (`patch.js` MK_METAL) soft-caps a
  metal's reflection at 10 × the mean ambient, and in the Kodesh the cap is active. So the gold followed the ambient's
  falloff, the irradiance's √ law (render-audio-3), whatever its reflections did. Probe weights on floor and walls
  are 1 (no uniform outdoor term re-added), the probe's sky share at d3 is 0.9996, and the wide-lobe blend toward
  the irradiance (eR > 1) never triggers on these surfaces.
- **Choice: seen (not captured), a main-opening room's irradiance takes the gate's ratio to the power 0.85, as its
  gold's reflections do** (`interiors-glsl.js`, probe loop, `mainSeen`). The √ law was fitted to captures taken when
  the gold walls, the room's main secondary source, reflected the room evenly lit. With their reflections falling
  off, the light they pass on falls off too. The capture keeps √ (0.85 there would compound bounce after bounce).
  Night is unchanged (the sky share is ≈ 0, so the factor is 1). The parochet's end takes 0.33 of the probe's light
  (was 0.53): ≈ 2.9 stops under the gate's capped 2.5.
  Linear: walls 0.097 → 0.052 became 0.100 → 0.046 (−0.91 → −1.13 stops); floor bottom → mid-room 0.132 → 0.094
  became 0.145 → 0.091 (−0.49 → −0.67). Display (the QA's crops): far wall (98,60,22) → (93,54,20), floor bottom
  (146,101,68) → (150,106,71), mid (139,97,64) → (141,100,66).
- **Not done, and why: a long sheen on the floor looking WEST.** The floor's raw probe reflection in this view is flat
  (0.10 linear on every row with the falloff factor removed). Every floor reflection in this frame leaves westward
  and meets the far west wall, 12–19 m away. Taking the falloff where the reflected ray lands (tested: mkAperture at
  the box-projected hit point) gives a flat 0.07 on every row. A metal floor mirrors the far end, wherever on the
  floor you look. The gate is 100–145° off the specular direction there, outside any GGX lobe at roughness 0.25–0.4.
  So the warm sheen toward the gate is what a viewer sees facing EAST (`kod-east-d3`, unchanged on high: the floor
  glows toward the gate). A sheen looking west would need a diffuse share in the floor (dust, wear), which belongs to
  the material (request below).
- **Low (no probe): a reflection that stays in the gilded room is lit as the surface it meets** (`mkIBL`, `rem` path).
  Where the reflected ray leaves the room's box, take the sky visibility through the main opening there (the same
  disc formula, `mkAperture`) plus a bounce floor of 0.4 × this fragment's ⚙. Most of a gold room's light is
  interreflection, which spreads more evenly and also lights the gate's own wall, which sees the gate edge-on. A 0.2
  floor left the west view murky. This replaces r1's ×0.5 … ×2 by the ray's angle to the gate, which barely changed
  the relief: a facet's reflection rarely swings toward the gate. A facet turned toward the gate now mirrors the bright
  walls beside it, one turned away mirrors the dim far end. Looking east, the floor mirrors the bright gate in its
  darker wall, a warm sheen that darkens westward. Rough lobes (≥ 0.5) keep the local value. The room's box and
  main opening are recorded in `mkSetup` (`mkBoxLo/Hi`, `mkMainAp`); where two rooms meet, the box's upper corner is
  taken from the room actually chosen (the swap carried A and C but not B, which nothing used after it until now).
  Linear, west view: walls 0.123 → 0.055 became 0.085 → 0.046; the floor falls monotonically to the parochet (0.125 →
  0.078). Looking east (`kod-east-d3` low), the near walls are dark and the walls and floor by the gate bright, and
  the relief reads light and dark by facing. — Alternative: probes on low (cost, ENV-R2-6).
- The same path serves the KhK on every tier (gilded, no probe; its parochot are its main opening). Checked by A/B:
  see Verification.

## Requests (not my files)

- **world-materials (`src/world/materials/patch.js` MK_METAL, `index.js` IBL.gold):** the gold's peak cap (10 × the mean
  ambient) is active in the Kodesh by day and still binds the gold's reflections to its ambient. Ask: raise the cap
  for `goldplate` / `relief` in interiors (≈ 25), or cap against the reflection's own local mean, so the near-gate
  gold can sit 2.5–3 stops over the parochet's end as the QA asks. F0 / metalness stay as they are (natural gold F0,
  metalness 1).
- **world-materials:** if the QA still wants a floor sheen looking west, give the Kodesh floor plating a little
  diffuse (wear / dust from the kohanim's bare feet, ≈ 3–5 % albedo, or metalness 0.95). The lighting would then carry
  the gate falloff onto it through the irradiance.

## Verification

- Before / after at high and low from the same queries (`before/`, `after/`): Mishchah sunrise ×2, opening frame
  sunrise + 15, Kodesh d3 west and east, Kodesh night n3 (unchanged: the gate is shut at night), KhK d3, sky d6 / d9.
- Linear read-backs for the Kodesh quoted above (shot.mjs `--eval`, float render target).
- Medium spot-check: `after/medium/kodesh-d3`.
- `npm run build` passes. `validate-schedule`: no gaps; `coverage`: longest gap 7 min (unaffected). Sim `firstnight.js`
  (low, t=d3) ran: first-night max 103 ms, but its "again" max read 127 then 67 ms across two runs on this machine
  (shared with other tasks' dev servers), so the run is noise-bound. No programs were added.
- `node tools/warmup-check.mjs`: all tiers and modes pass except one `ultra play` run (the deferred world materials
  shown after > 30 s). A re-run of ultra + high play passed (ALL PASSED). Ultra's compile time swung 38.5 → 52.8 s
  between the two runs, which is load, not code. Compile times: low 14.5 s, medium 24.7 s, high 32.3 s (CLAUDE.md:
  ~13 / 22 / 30 s), within that noise.
- During the shots the engine logged `this._nearFade is not a function` and `vnoise2 is not defined` from
  `src/people/` (another task's edits in progress, picked up by Vite's reload). Not in this area.
