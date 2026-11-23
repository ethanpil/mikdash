# lifelike-wear — decision log

`- **Choice** — why (source / reasoning) — alternative.` Owned: `src/world/materials/index.js` (route data only).
Brief: make the place look used through small, restrained wear baked into the existing materials, at no runtime cost
(no new program, sampler, texture or draw call on any tier). Shots: `shots/lifelike/wear/` (low, d3, SwiftShader; the
"before" is a copy of the tree at the start, shot from that copy so no edit could leak into it).

## What was already there (not redone)

- The altar already carries soot toward its top course and horns, ash along its top edges and over each ma'arachah
  (`MK_ALTAR`, `lime_whitewash_soot`), faint stains where the blood is applied, and darker glossier foot lanes on the
  kevesh, sovev and walkway (`lime_whitewash_worn`). The Herodian walls have a dust band and contact AO at their foot
  (`MK_FOOT`). The Mount's pavement has the crowds' worn routes (`mkWear`, qa-r2). Nothing was added on top of these: the
  altar is whitewashed twice a year and wiped every Erev Shabbat (Middot 3:4), so more soot would read as neglect.

## Worn flights reuse the Mount's route-wear uniforms (patch.js `mkWear`) — kept

- **Every patched material already declares `mkWear` / `mkWearA..C` (three route segments in world x, z) and runs the
  route code behind `mkWear.x > 0`; only `paving_mount` set it.** Giving another key its own segments is uniform data:
  the program text is unchanged, so no program, sampler, texture, draw call or bake work is added on any tier (shots:
  draw calls, textures and program counts identical before / after). The cost is the ALU the branch already costs the
  Mount (three point-to-segment distances) on `steps_stone`'s fragments. `wear: true` is still the Mount's; `wear: 'steps'`
  names the new set (`wearUniforms(kind)`, one uniform object per kind). — Alternatives: a mask texture or a vertex
  attribute per flight (a new sampler / builder changes in several kits); a patch.js shader change (re-keys every lit
  program).
- **The steps (`steps_stone`): the middle of the three flights on the east axis — the twelve Chel steps through the
  threshold of the Ezrat Nashim's east gate, the fifteen semicircular steps up to Sha'ar Nikanor, the Ulam's twelve steps
  (Middot 2:3, 2:5, 3:6) — half-width 2.4 m: dust scuffed off (+4 % and the macro dust tint eased by the shared code) and
  the treads a little smoother (roughness −0.10).** Measured at the foot of the Chel steps (low, d3): +3 sRGB levels in
  the flights' middle, zero at their sides; reads as a slightly cleaner centre where the feet go, not as a stripe. The
  same key's other uses (the soreg, stoas, sills) lie far from the segments and are untouched. Risers inside the band
  take the same small change (the route code reads position, not orientation): invisible at these amounts. The band's
  place and width: reconstruction.
- **A first try at +1 % / −0.06 changed the Chel steps by 1–2 levels (invisible) and was raised to the values above.**

## Dropped

- **A worn, damp way on the Azarah floor (`paving_azarah`: Sha'ar Nikanor round the altar's south-east to the kevesh foot,
  along it and up to the kiyor, Tamid 1:4; Yoma 37a).** Same mechanism. As a darker-glossier band it nets to 0 ± 1.5
  levels on low at d3: the shared code eases the macro's warm dust tint inside a route (it brightens by about as much as
  a polish darkens), and the gloss reads only in specular light. A paler band (the first try: +4 levels) is the opposite
  of polished, wet marble. Not worth a change no one sees; it would need the route code to take a separate tint easing
  per key (a patch.js uniform layout change: re-keys every lit program), so it was left.
- Soot / ash on the altar, damp round the kiyor, rain darkening under copings: either present already (above) or needing
  a new mask (sampler) or a shader change outside this round's budget.

## Not verified

- Shots are SwiftShader, low tier, one time of day (d3); no medium shot (the route code is ALU only and reads no
  texture, so the texture size does not enter it). The roughness change reads only in specular light; it was not checked
  on high / ultra, at sunrise or by lamplight. Not timed on the HD 4600 (the branch's ALU on one more key is estimated,
  not measured).
