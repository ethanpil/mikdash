# builders-2-inner-fix — decisions

The review pass on builders-2-inner (`src/world/altar/**`, `src/world/heichal/**`). The standing choices are in
`builders-2-inner.md`, whose bullets were corrected in place where this pass changed them (marked *fix*). Format:
**choice** — why — alternative. ⚙ = reconstruction. Shots: `shots/builders-2-inner-fix/` (low and high; the inspection
shots hide the people and remove Vite's error overlay, which a concurrent `src/sim` edit raised).

## Fixed
- **Charred wood without `timber_charred`: a half-burnt brand is drawn as it lies after a burning — its burnt end
  (40–50 %) grey with ash, tapered and a little thinner than the bark it burnt back from, the rest bark (`timber_rough`,
  end grain `timber_pile_end`); charcoal lumps take `iron`.** `brandGeometry()` in `altar/lib.js` serves the kitchen
  hearth and the Beit HaDeshen heap. `glass_dark` (#111, roughness 0.3) drew the brands as glossy black pipes (review).
  Iron is a dark, rough metal: its reflectance (F0 ≈ 0.05) is a black dielectric's and it has no diffuse, so it reads as
  satin charcoal. All keys fall back through `A.mat('timber_charred', …)`, so the materials task's key takes over when it
  lands. No new draw calls (ash, bark, end grain and iron buckets already exist). — Alternative: `timber_rough` for the
  whole brand (the review's interim suggestion). It loses the burnt end, which is what says "brand".
- **The kitchen fire burns on the bed UNDER the cauldron, a little toward the stoking mouth, size 0.24 m (was 0.4 m in
  the 17 cm gap between cauldron and griddle). The hearth course is 0.55 amah (≈ 26 cm, was 0.36), the cauldron seated
  on the stones' inner arrises (`zb = Z + h − 0.12`, where the profile's r = 0.4 meets the 0.8-amah-wide interior).** ⚙
  fx puts a fire's light point 0.6 × size over its base, with no per-fire offset for a static fire. With the old 17 cm
  course the light point of any visible fire under the pot fell INSIDE the pot, leaving its belly unlit by its own
  flames. Now the light point is at Z 16.387, 2.3 cm under the pot's bottom (16.436 at the fire's offset; measured
  in-page). The flames lick up to about the belly's widest point and show through the mouth and round the pot. At
  night the glow lights the pot's underside and the stones' inner faces (`kitchen-night-lit`). A 26 cm course is
  ordinary for a cooking hearth. — Alternatives: a fire at the pot's edge (the light outside the pot, but the flames
  beside the vessels again); a raised pot on taller stones without a seat (the same light, a less stable pot).
- **The cauldron's bottom and lower belly are fire-blackened ⚙: a skin 0.005 amah (2.4 mm) proud of the copper, from
  the bottom to a ragged line between profile heights 0.155 and 0.255 (just under the widest part), in `soot` once
  materials adds it, else `iron`.** Its rows are the lathe profile's own vertices, and the ragged edge stays within one
  profile segment, so every skin quad lies on a single copper facet. The first try sampled rows anywhere along the
  profile: its quads bridged the profile's convex bends, sank into the copper and showed only as black streaks
  (`pot-side-off` before/after). Detail ≥ 1; cast as the iron bucket. — Alternative: a sooted copper material (requested
  as `soot`/a worn copper; the polished upper half is the copper key's).
- **Kitchen colliders: one box over the hearth and a 12-sided prism round the basin, both 2 amot (≈ 0.96 m) high; the
  hearth stones themselves no longer collide.** The old colliders were the 17 cm stones (steppable, into the fire) and a
  0.3-amah box over the basin (steppable, onto the water). Walk tests (held W into each from E, W, N and S, medium
  tier): the observer stops 0.29–0.3 m off at +16 and never gets on top. Two intermediate heights failed and are why
  it is 2 amot. At 1.2 amot a walk from the woodpile (0.45 amah, which may be stood on) climbed onto the hearth box,
  crossed it and stepped onto the basin's prism of the same height. At 0.85 amah nav's stair rule (a riser of
  0.35 + 1.2·d m within a 0.5 m cell) took the basin's 0.41 m drum for a step. Above the capsule's lifted step probe
  (≈ 0.65 m) the height no longer changes where the observer stops. `station.kitchen` and every sim spot round the
  kitchen (courts-daily COOK, SERVE, the three SCOUR places, the eaters' groups) still path from the Azarah. —
  Alternative: a ring collider round the basin rim (the 0.6 m capsule cannot fit in the 0.5 m basin, so it would stand
  on the rim over the water).
- **Ulam chain links are stadiums of constant wire (two half-rings joined by straight sides, a TubeGeometry) instead of
  a torus stretched ×1.6.** — Checking the review's "1-cm wire" finding: the wire radius is 0.022 amah, so the wire is
  ≈ 2.1 cm thick (the wording is corrected in `builders-2-inner.md` and in `ulam.js`). The stretched torus also made the
  wire 1.6× thicker at the bends, where links bear on each other. With the pitch 2(r·k − w), which is right for constant
  wire, each crossing link then cut 1.3 cm into the next (B's top bend spans Y −0.071…−0.001 amah against A's bottom
  bend −0.115…−0.045). No pitch could fix that: the bends needed p ≤ 2k(r − w) = 0.090 to clear and p ≥ k(r + w) = 0.115
  to keep the two links inside one link apart. With constant wire both hold at p = 0.116. Outside ≈ 10 × 7 cm, the same
  instance count and triangles (tube 3×6 / 4×8 / 5×10 by detail), one draw call. The end ring's offset was already
  written for constant wire. — Alternative: keep the torus and change only the wording (the fused bends hang 4 amot
  over the Ulam floor, at arm's reach).

## Not changed here, with the evidence
- **The morning sawtooth under the sovev slab is render's.** The leak sits exactly at the slab/kevesh contact edge
  (`builders-2-inner-review/sovev-under-high.png`). three draws FrontSide materials into the shadow map by their back
  faces, so the caster for the wall just under the slab is the slab's own underside, within shadow bias of the receiver.
  No closed geometry change moves that. The reviewer's raycasts confirm the slab is closed (underside Z 21.000, south
  face Y 302.076, east face X 227), and the leak is gone at noon. — For render: normal bias / bias on the sun cascades,
  or more near-cascade resolution.
- **Anchor frames and index bases stay as built; the API text should state them (orchestrator).** The sim already
  reads them this way: `sim/choreo/g5/geo.js` `anchorSite()` converts `pos` and passes `stand`/`target` through as site
  amot, and `g2/places.js` reads `w2m(a.pos)`. Changing the frames now would break both. For docs/API.md:
  - `ctx.addAnchor` turns `pos` into a world Vector3 (core/context.js). Every other array field stays as given, so
    `stand`, `target` and `foot` are SITE amot [X, Y, Z].
  - The task's new families are 0-based: `altar.hook.<0–7>.<0–2>`, `altar.ring.<0–23>`, `altar.table.<0–7>`,
    `heichal.ulam.chain-<0–3>`.
  - The older `altar.nanas.<1–8>` and `altar.flaying.<1–7>` are 1-based and unchanged. Pillar p of `altar.hook.<p>.*`
    is `altar.nanas.<p+1>`.
  - The `altar.table.<i>` anchors are the eight marble tables of the slaughter zone (element `altar.marble-tables`).
    The ELEMENTS `altar.table.marble` / `.silver` are the two tables west of the kevesh, whose anchors are
    `station.table-marble` / `station.table-silver`.
- **The four `station.horn-*` anchors stay off the nav grid.** The sovev is 1 amah wide (site.js `altar.sovev`;
  Middot 3:1), narrower than the 0.6 m nav capsule. The sim places actors there with `setSite(X, Y, 22)`.
- **The fire-shadow cost in the first report was overstated.** The review measured no steady-state difference by day
  with the kitchen fire on or off (the great altar fire already holds the high tier's one slot), and +10 calls mean at
  night. The render request about small fires is optional. Related, for render: the fire-shadow camera's near plane
  is 0.3 m, so the hearth stones and the pot cast no shadow from a fire under them, and its light reaches the pavement
  behind the stones on high as on low.
- **`build-altar.md` (the solid sovev branch, the in-shaft hook rows) and `build-heichal.md` (chains to +48) still
  carry the superseded text.** Those logs belong to other tasks; the orchestrator should mark them superseded by
  `builders-2-inner.md`.

## Verification
- `npx vite build` passes (output deleted).
- Draw calls and triangles: altar 29 / 36,260 at low, 29 / 137,098 at high (was 29 / 36k, 137,242). Heichal 41 /
  274,858 at high (unchanged).
- nav-coverage (low): 127 of 129 from both origins. The only failures are the `roof` stand (+112), as before this pass.
  The kitchen-area views (kodashim-meal, scouring, terumat-hadeshen, bird-offerings, notar-burning) all pass.
- `validate-schedule`: 0 errors. One warning, which predates this pass (chavitin-bakers zone).
- Console: no errors from the altar or the Heichal. The only errors were the sim's `nikanor-stations.js` failing to
  parse (a concurrent edit in `src/sim`).
