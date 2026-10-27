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
- The research lives one level up (`../report/parts/*.md`, `../sources/`), outside this repository: it is not
  published with it. It is the authority.
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
- Performance (HD 4600, Edge, cold production, `tools/warmup-check.mjs`, play): first frame low ~13 s, medium ~22 s,
  high ~30 s, ultra ~37 s (gate-core; 20/35/52/64 before it, 56/115/190/235 before the perf pass). What the first view
  does not draw compiles after it: people hold every program but the far figures' and the props' LOD1 unless a figure in
  sight needs one; world materials the boot camera cannot see (an id pass) are hidden and revealed after the first view
  (docs/decisions/gate-core.md). Lessons: a synchronous WebGL query (getProgramParameter, getUniformBlockIndex,
  getProgramInfoLog, readPixels) waits for all queued GPU work — removing one only moves the wait; anything issued
  during the shader warm-up competes with the first view, so start non-view work after 'firstFrame'; the GPU process
  links three programs at a time, and a program a frame compiles synchronously waits behind every queued one, so
  background compiles (the baker's later kinds too) go through render/warmup.js `compileLater`, whose budget is
  the renderer's UNLINKED PROGRAMS, not queued objects (≤ logical cores − 2, none for 2.5 s after Enter): a program issued
  while all of ANGLE's (cores − 1) link workers are busy blocks the GPU process, which froze play 1–10 s after Enter
  (gate-core-r2); a shadow pass keys its depth programs
  with no lights but a shadow (warmup.js compileDepth); CSS animations of box-shadow/filter repaint every frame (the tag
  pulse cost 11 fps) — animate transform/opacity only; fps here is quantized by vsync, so A/B in-page, interleaved, in
  normal play.
- Tier features are capability flags in `src/core/quality.js` (shadows static/cached/cascaded, shadowFilter, aa, ao,
  interiors); code reads flags, never tier names. Low/medium take room sky visibility and AO from env's visibility volume
  (`env/visibility.js`): per-room bricks of each opening's solid-angle share × the live door weights in the uniform block
  (doors never need a recompute), and a 2 m precinct AO grid ray-marched through a 1 m voxelisation of the collision soup
  in a Worker after the first view (a BVH ray-cast took minutes; huge terrain/plaza triangles must be clipped to the grid
  before voxelising), cached in IndexedDB. Its samplers ride in three's ShaderLib standard/physical uniforms with a
  texture whose clone() returns itself: a sampler3D a program declares but no material binds defaults to unit 0 and
  clashes with the material's own sampler types (GL error, geometry vanishes). Low's sun shadow is 'static' (no per-frame
  pass; figures keep contact shadows) with one hardware PCF tap: three's 5-tap lookup alone cost 4.3 ms of low's frame.
  `tools/goldens.mjs` guards every tier's image (6 views × 4 tiers, noise floor, closer-to-ultra verdicts).
- UI is the Luach console (docs/console-design.md): one always-on Menu beacon, Esc as the only key to remember,
  one card system for every subject, a module registry for new sections (narration mounts in Listen). Inspect is
  CPU picking (no GPU queries); its describer and content load after firstFrame so cold boot does not regress.
- Schedule times are relative to zmanim with a confidence level (explicit / ordering / reconstruction); the sources
  give the ORDER of the service, rarely minutes. The first lottery is staged in Beit HaMoked (Tamid 1:2), not the
  Gazit as report §27.2 has it. Report self-contradictions found while building are in `docs/report-errata.md`.

## Tools
- README.md is the public page on GitHub: its controls, URL parameters and credits mirror `src/ui/controls.js`,
  `src/core/params.js` and the About panel (`src/ui/aboutpanel.js`). Update it when those change. Its three
  absolute links (live site, example, licence texts) hard-code the Pages address: change them if the repo is renamed
  or moves to a domain (the share cards follow the deploy on their own).
- `npm run dev` / `npm run build`
- `node tools/shot.mjs "at=X,Y&look=heading,pitch&t=sunrise+10"` → `shots/*.png` + console/draw-call report.
