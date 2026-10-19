# Mikdash — project notes for developers and LLMs

Browser 3D walk-through of Har HaBayit and the Second Temple (three.js r186, WebGLRenderer, Vite).
Read `ARCHITECTURE.md` first: it holds the contracts, ownership map, frames/units and verification tools.

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
- Schedule times are relative to zmanim with a confidence level (explicit / ordering / reconstruction); the sources
  give the ORDER of the service, rarely minutes. The first lottery is staged in Beit HaMoked (Tamid 1:2), not the
  Gazit as report §27.2 has it. Report self-contradictions found while building are in `docs/report-errata.md`.

## Tools
- `npm run dev` / `npm run build`
- `node tools/shot.mjs "at=X,Y&look=heading,pitch&t=sunrise+10"` → `shots/*.png` + console/draw-call report.
