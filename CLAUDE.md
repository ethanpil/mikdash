# Mikdash — project notes for developers and LLMs

Browser 3D walk-through of Har HaBayit and the Second Temple (three.js r186, WebGLRenderer, Vite).
Read `ARCHITECTURE.md` first: it holds the contracts, ownership map, frames/units and verification tools.

## Standing requirements from the user
- Accuracy to the research is paramount and drives every scene.
- People, animals, objects and textures in every scene must be ultra-realistic and properly attired for their role.
- Something must always be going on: between major rites, individuals' offerings (olah, chatat, asham, shelamim,
  todah, meal and bird offerings, libations) run whenever the halachah allows (between the two temidim, not on
  Shabbat) and are watchable from the "Happening now" list and the map; at night, the burning of the day's limbs and
  fats, the watch and the other night duties continue. `tools/coverage.mjs`/`validate-schedule.mjs` guard this.
- The map is labeled, shows the user's position and live activity per area, and lets the user select an area and go.
- Start: slightly before dawn at the outer (Chel) steps leading into the Temple.

## Ground truth
- The research lives one level up (`../report/parts/*.md`, `../sources/`). It is the authority.
- `../engine/temple_manifest.json`, `../diagrams/`, `../video/` are SAMPLES (the user said so): use them only as
  cross-checks, never as the source of coordinates, timings or visual design.
- Geometry at runtime comes only from `src/data/site.js` (research-derived, self-checked dimension chains).

## Non-obvious choices (keep updated)
- Site frame X east / Y north / Z up in amot; world frame meters with −z north. Default amah 48 cm (R' Chaim Naeh).
- Everything is procedural (no downloaded textures/models/audio) for size, licensing and load speed.
- Simulation is a pure function of sim time so the clock can be scrubbed/jumped instantly.
- `THREE.Clock` is deprecated in r186 → engine uses `THREE.Timer`.
- Dev machine GPU is an Intel HD 4600: the `low` tier is tuned against it.
- three r186: `PCFSoftShadowMap` is removed (use `PCFShadowMap`); cascaded sun shadows use the native
  `three/addons/lights/SunLight.js` (exactly 2 cascades), not `CSM.js`, which clobbers material `onBeforeCompile`.
- `postprocessing` BlendFunction.SCREEN darkens HDR values ≥ 1 — use ADD for light in scene-linear buffers.
  Its GodRaysEffect rejects a sun disc near the far plane, so render/ has custom sun shafts (ultra).
- Light units: photometric × `ctx.env.preExposure`; tone mapping AgX + look (gain 1.15 for ACES parity).
- Env replaces three's fog and tonemapping shader chunks globally (aerial perspective before tone mapping).
- Materials are baked on the GPU at load (`src/world/materials/gen`). On ANGLE/D3D11 keep generator shaders
  loop-free, read noise from basis textures, single output: ALU noise or MRT costs 0.3–3 s per program on the
  HD 4600. Features narrower than a texel must be widened/faded or they alias. `?matfx=0`, `?mattex=0` debug.
- Nav is built in a Worker by rasterising collider triangles into a 0.5 m multi-level grid; a coarse block graph
  steers A*. Half-amah stairs need sub-step probes (|Δh| up to 0.8 m per cell when each rise ≤ 0.35 m).
- Audio is synthesised in module Workers (`src/audio/worker.js`); `?debug=audio` opens an audition panel.
- Psalm melodies, choir size on low/medium, insect season: reconstruction (see docs/decisions/audio.md).
- Offerings: notar is burned by day only; at night the visible burning is the fats and limbs on the altar, turned
  all night (Rambam TuM 1:6); weekday fats are not burned on Shabbat, so Friday night shows the fire alone.
  Frequencies in OFFERING_RULES are totals that include the composite sets (yoledet, zav, nazir, metzora): stage
  from `frequency.alone` with one seeded day quantile, never perDay plus sets.
- People shaders: no dFdx/fwidth inside pattern branches (ANGLE/D3D11 flattens them; 10–18 s compiles); robes use
  a bake-time skirt cage + `clothSkin` flatten pass (MAX_BONES 36); people splice their own `lights_fragment_begin`.
- Schedule times are relative to zmanim with a confidence level (explicit / ordering / reconstruction); the sources
  give the ORDER of the service, rarely minutes. The first lottery is staged in Beit HaMoked (Tamid 1:2), not the
  Gazit as report §27.2 has it. Report self-contradictions found while building are in `docs/report-errata.md`.

## Tools
- `npm run dev` / `npm run build`
- `node tools/shot.mjs "at=X,Y&look=heading,pitch&t=sunrise+10"` → `shots/*.png` + console/draw-call report.
