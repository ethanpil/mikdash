# lifelike-atmosphere: small, free changes to air and sky

Scope: `src/env/**`. Format: **Choice**: why. Alternative. ⚙ marks reconstruction or art direction. Budget: zero runtime
cost on the HD 4600 `low` tier (no new program, sampler, pass or per-frame allocation), nothing before the first frame.

## What was already there (explored first, so not redone)

- The twilight gradient and the horizon glow at dawn and dusk come from the physical sky-view LUT. The low Sun's warm key
  light and the bluer shade come from the transmittance LUT and the sky irradiance. A hand-tuned tint on top would fight
  the model.
- The Moon has phase, maria and earthshine. The stars fade toward the horizon by air mass (Kasten-Young) and against the
  sky's luminance (limiting magnitude).
- Fire lights already flicker (`fx/lights.js`, `preset.light.flicker`). The smoke column already glows from the fire below
  at night (`SMOKE_GLOW_PATH`, sky-smoke-fire.md).

## 1. Stars scintillate on every tier

- **`twinkle: true` on low and medium (`env/index.js` TIERS).** The star vertex shader always computes the scintillation
  term: brightness × (1 ± (0.12 + 0.3 · min(X/6, 1))) from two slow sines per star, stronger near the horizon by air
  mass X. Low and medium only set its uniform to 0, so their sky was a frozen picture. Turning it on uses the same program,
  needs no recompile and adds no draw. The cost is a few vertex sines on 1200 points (low) or 3000 (medium).
- It animates in env's real-time clock (`st.clock`), as the flames and smoke do in fx. It is a visual effect of the air
  with no sim state, so a scrubbed clock does not strobe it.
- Alternative: faster, true-to-life scintillation (10–100 Hz) with colour flashing near the horizon. At 60 fps that
  aliases into noise, and a coloured term would change the program.

## 2. Morning surface haze (the night's inversion) ⚙

- **The fog's surface aerosol extinction (`mkFogParams.x`, and the stock-fog density fx reads) × (1 + 1.5 w)** (`env/index.js`
  `MORNING_HAZE`, `api.hazeDiurnal`). w = 1 from the evening twilight (Sun −4° → −30° in the west) through the night until
  the Sun is 4° up in the east. It eases to 0 by 30° (about 2½ h after an autumn sunrise) and stays 0 all afternoon. The
  branch is the Sun's azimuth (< 180°: the rising half of its circle). Both branches meet at 1 at solar midnight and at 0
  at noon, and Jerusalem's noon Sun is always above 30°, so there is no jump.
- Why: a clear night's radiative inversion holds the surface aerosol (the hills' dust, a city's hearth and lamp smoke)
  in a shallow layer, and the morning's convection mixes it up through a deeper one. Surface visibility is lowest around
  dawn and recovers by late morning. The magnitude (× 2.5: horizontal visibility ≈ 50 → 20 km at the Mount) is ⚙: a
  typical autumn morning, not a measurement for Jerusalem in antiquity.
- Effect: the far hills (Mount of Olives ≈ 0.8–1 km, the ridges beyond) sit softer in the dawn air and the court's far
  walls lose a little contrast. The sky dome and its LUT are unchanged: only the air between eye and surface. Cost: a CPU
  uniform value, already uploaded each frame.
- Alternative: a height-dependent mist layer (a second scale height in fog.js). It would change every lit program's fog
  chunk and so their compile. A change to the LUT's AOD would re-bake the sky LUTs whenever the factor moved.

## Evidence (low, 1280 × 720, SwiftShader; before from a clean export of the base commit, same queries)

Images are in `shots/lifelike/atmo/` of the main checkout (git-ignored).

- `east-sunrise15-{before,after,diff-x8}.png`, `east-sunrise15-crop-before-left-after-right.png`
  (`at=250,330.5&look=90,3&t=sunrise+15`, from the Heichal's porch east over the courts). Mean grey level (0–255):
  the near door jamb 100.4 → 100.5, the near floor 134.0 → 134.3, the sky 186.7 → 186.7. The far east wall and gate
  106.5 → 114.6, the court floor beyond 115.9 → 119.0. Only the distant surfaces change: they pick up the warm dawn air
  light and lose a little contrast. Subtle, and it goes the right way.
- `boot-{before,after,diff-x8}.png` (the boot view, before dawn at the Chel steps). No visible change. Everything is
  within ≈ 60 m, where even × 2.5 surface haze is below 1 %. The diff shows a few stars, which sit at another phase of
  their scintillation.
- `night-n5-{before,after,diff-x8}.png`, `night-n5-before-top-after-bottom.png` (`at=250,330.5&look=90,8&t=n5`). The
  gate is shut at night, so this is a regression check only, with the night's full × 2.5 haze. Mean 86.0 → 86.2, max
  pixel difference 11. Draw calls, triangles and programs are identical (163 / 468 295 / 73).
- No console errors in any shot. The warnings are the machine's, present before too: SwiftShader's "GPU stall due to
  ReadPixels" and "KHR_parallel_shader_compile not supported". Boot view draw calls (275) and triangles (495 900) are
  identical before and after. Linked programs: 73 before and after in both views.

## Not verified

- No HD 4600 timing. Both changes are uniform values in existing programs, so no frame-time change is expected, but none
  was measured.
- No shot looks far out over the city or the Mount of Olives at dawn, where the haze shows most. The one far view is the
  courts eastward (≈ 100–200 m).
- The goldens (`tools/goldens.mjs`) were not re-run. Night views on low and medium will differ slightly, because each star
  is held at a fixed phase of its scintillation when the clock does not run. Dawn views looking far will also differ.
- The scintillation cannot be judged from a still: the shots only show that the stars still draw and that there are no
  console errors.
