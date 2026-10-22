# perf-1 — boot and frame-time profiling

Scope: boot critical path and shader compilation (all tiers), measured on the production bundle on the HD 4600
(4 cores, ANGLE/D3D11). Format: **choice** — why — alternative. Tools: `tools/boot-prof.mjs` (new; cold profile per run:
bootTimes, every GL call timed, per-program blocking time and issue → link timeline, long tasks, frames after the first
view, `--cpu` CPU profile, `--nomin` readable names, `--fps S` steady-state frame times, `--noinst` without the GL
wrapper), `src/render/dev/chunk-cost.mjs` (single-program compile latency under chunk / define variants),
`src/render/dev/variant-users.mjs` (materials drawn by both plain and instanced meshes). Shots: `shots/perf-1/`
(`matrix/before-*` = HEAD, `matrix/after-*` = this task, same queries, cold).

## Where the 40–70 s went (HEAD, low, spawn)
- The first frame was ONE long task of 31 s (medium 62 s): 74 programs (94 on medium) compiled and linked one after
  another inside it. three's `checkShaderErrors` calls `getProgramInfoLog` on first use, which blocks until the GPU
  process has linked the program. Lit fragment shaders are 117–143 KB; one costs 1–1.5 s alone on low (people
  1.6–2.5 s, people with pattern detail 3.3–4 s; on medium 2–3 s / 7.5 s).
- Cost structure of one lit world program (chunk-cost.mjs, low): full 1.4 s; without the interior room path 0.74 s;
  stock three chunks 0.4 s; env fog, tone mapping and the materials patch ≈ 0 each. The interior room path is half
  of every lit program; it is kept (visible in every room on every tier). `#pragma optimize(off)` changes nothing
  (ANGLE does not pass it to FXC).
- Before the frame: world 3.7 s (terrain 1.7 s, matgen), env 2.4 s (2.2 s of it its own LUT / PMREM programs linked
  synchronously, plus the 94-pass statistics table and its synchronous read), sim 1 s (2.2–5 s once compile threads
  compete: the people's clip atlas bake), and each system's chunk fetched only when that system starts.

## Choices
- **KHR_parallel_shader_compile: issue every program, poll, draw when linked (`render/warmup.js`, `main.js`).** —
  `renderer.compile()` only creates programs; ANGLE links them on worker threads (≈ 2.8× the serial rate on 4 cores) and
  the page stays responsive. The loop runs one update without drawing (sim, then people make the first view's batches
  lazily), then rests while the rest compiles (its updates took CPU from the compiler threads; the frame clamp skipped a
  stalled first frame the same way before), then draws behind the loading screen; `body.booted` after that frame. The
  loading bar shows "Preparing shaders… n / N". Without the extension three reports programs ready at once and the
  first frame compiles them as before. Alternative: `compileAsync` (no progress, no batching across scenes).
- **Compile against the target the frame draws into.** — three keys programs by output colour space and tone mapping;
  on medium+ the scene is drawn into the composer's HDR target. A first try compiled for the canvas and built 117
  programs on medium, then compiled the real ones in the first frame (81 s).
- **Order: people's predicted figure programs first, then the world's** — the compiler threads take programs in issue
  order; the longest first finishes the set soonest.
- **One program per material instead of a plain and an instanced one: plain lit world meshes are drawn as one
  instance** (`singleInstance`: the same Mesh object gains `isInstancedMesh`, an identity `instanceMatrix`, `count` 1,
  `instanceColor`/`morphTexture` null, `userData.mkSingle`; nav/doors.js treats mkSingle as plain). — keeps every
  reference (movables, colliders, anchors) and is pixel-identical (world matrix × identity); −4 lit programs on low.
  Relies on three r186's duck typing of InstancedMesh (WebGLObjects, BindingStates, renderBufferDirect, programs).
  Alternative: rebuild as InstancedMesh (breaks references) or batch everything by hand.
- **Materials patch: the UV swap of the `*_v` keys is a uniform (`mkUvSwap`), and the comb flag enters the key only
  with detail** (MK_COMB is compiled only then). — −2 programs on every tier, −1 more on low; a select per vertex.
- **People: options that compile to the same program are made equal** (`figureMatOpts` / `propMatOpts`): without
  pattern detail every group is compiled in (outside P_DETAIL a group's code is per-pattern-id branches that never meet
  another class's ids; measured free: 1.66 → 1.68 s), lerp and morph are on and LOD 2/3 push 0 for the frame fraction
  and morph weights (`Batch.flat`; animals have zero weights and no morph attribute); with detail the High Priest's
  group is in every man's program (7.5 → 7.6 s on medium, his own program cost another 7.5 s; the ephod / tzitz /
  bells / gems patterns occur only in his garments); LOD 0 dithers like LOD 1 on medium+ (a hero is drawn only at
  alpha > 0.999, so it never discards). Animals keep their own detail program (merged: +4 s on the longest program).
  Low spawn: 9 → 4 people programs; medium 9 → 5.
- **People warm-up (`PeopleSystem.warmupObjects`)** — one-instance dummies keyed exactly like the batches (same
  options; the geometry has position / normal / uv / colour(3), what three's key reads) are compiled at people init;
  every other variant after the first view. Dummy materials stay referenced, so their programs are never released.
- **Clip atlas baked in a Worker started before the world build (`people/prebake.js`, `bake.worker.js`).** — `bakeRig`
  is the old loop as a pure function, used on both sides; the worker gets the amah standard through its name
  (`core/units.js` reads it only inside a WorkerGlobalScope). People init waits for it (≤ 10 s, else the main thread
  bakes as before). 2.2–5.4 s of main-thread CPU → 0.2 s.
- **Env's fixed passes compile during the world build (`env.prewarm`, called from main.js before buildWorld).** — the
  atmosphere LUT materials and PMREM's cube→cubeUV and GGX programs, compiled against a render target on a geometry
  with only a position attribute: three's own `PMREMGenerator._compileMaterial` uses an empty geometry, whose key lacks
  `hasPositionAttribute`, so its precompile never matches the drawn program (uses PMREM's private `_setSize` /
  `_allocateTargets`, guarded). env init 2.4 s → 0.15 s.
- **The sky statistics table is built after the first view (`buildTableAsync`)**: 4 altitudes a frame into private
  targets, one asynchronous read. — until it lands env reads the statistics back as it does without a table (the first
  view's exposure is the measured one, the table's estimate is within 1 % by day). Sync `buildTable` kept for tier changes.
  *(perf-fix-1: now built during the shader warm-up and the boot re-metered from it, as HEAD did.)*
- **Boot chunks modulepreloaded at boot start** (vite.config.js lists them in `<meta name="mk-boot-chunks">`; optional
  chunks — post (preloaded by main.js on medium+), debug overlays, the people demo, materials preview — stay on demand).
  — removes the per-system round-trip waterfall; locally the preview server, starved by the compiler threads, took 2 s
  to serve the schedule chunk.
- **Boot chunks modulepreloaded at boot start** also covers their stylesheets (`rel=preload as=style`): the UI chunk's
  CSS, fetched only when vite's preload helper imported the UI, held the UI's init 1.5–6 s. *(perf-fix-1: that preload
  lacked crossorigin and was never used — a second fetch and console warnings; stylesheets are now attached as such.)*
- **Post pipeline materials compiled with the scene** (`post.warmupMaterials()`, `compilePasses`). — bloom prefilter,
  SMAA, effect passes were ≈ 1.5 s of synchronous compile in the first frame on medium. A pass's material is a
  prototype getter (`fullscreenMaterial`), read explicitly.
- **The warm-up iterates**: after the first set links, three undrawn frames run and anything new (a prop attached by a
  choreography a few updates in, a batch at another LOD) is compiled, until a round brings nothing (≤ 3 rounds). In
  normal play people programs found in those rounds do not hold the view (next item); for a screenshot (`shot=1`)
  everything is waited for.
- **People batches whose program is still linking draw at the next coarser existing LOD** (`_batchFor`, `_drawable`;
  props may create their LOD 1 batch: small geometry, shared material linked at boot). — a figure or prop variant that
  comes near for the first time (the High Priest, a carcass at LOD 0) used to freeze the frame for its program, 1.5–7 s;
  now its detail appears when linked (seconds later). Without KHR_parallel_shader_compile three reports programs ready
  and the first draw compiles, as before. Coarser batches are never created for figures (a first try built every
  archetype × LOD during the warm-up: a 4 s task).
- **Depth pre-pass (`render/prepass.js`), on every tier** *(perf-fix-1: off by default on tile-based GPUs; a polygon-offset
  margin; stricter eligibility)*. — the world is a few dozen merged batches, one per material,
  and three sorts opaque draws by program before depth, so the 1–3 k-instruction lit shaders ran on every hidden
  fragment of the courts behind a wall. Opaque, non-alpha-tested, front/double-sided lit world meshes whose world radius
  is ≥ 8 m (walls, floors, roofs, the merged batches) carry layer 29 and are drawn first, depth only (MeshDepthMaterial,
  colour writes and fog off, shadow-map updates suspended, the real scene graph so hidden parents hide them); the frame
  keeps that depth (LessEqual). No world material displaces vertices, so both programs compute the same positions.
  GPU time in one page (HD 4600, low): spawn 25 → 17 ms, Kodesh 38 → 19, a wall-filling Azarah view 48 → 13–20;
  medium 59 → 50, 97 → 51, 83 → 51 (shadow updates excluded). Cost: +60–80 draw calls and +3–4 ms of CPU submission on
  low. Thresholds 0 / 4 / 8 / 16 m measured: below 8 the extra calls cost more than they hide. `?prepass=0` turns it off,
  `?prepassMin=N` sets the radius. Alternatives: front-to-back sorting (useless with world-spanning batches), splitting
  the batches by area (a world-builder change).
- **'firstFrame' bus event** (main.js, after the first drawn frame). — the intro panel, the map's idle-time prewarm,
  `__mikdashReady` for `--keep-ui` shots, the audio warm-up (4 s later), the people's background variants (1 s later, one
  per frame) and the sky table now follow it instead of 'ready', which fires before the shaders compile.

## Not done / measured and dropped
- `#pragma optimize(off)` — no effect on ANGLE's compile time.
- Merging the animals' and props' detail groups into the men's program — makes the longest program 11.7 s.
- Moving env and render init before the world build (so the world's programs could compile during it): feasible (fx
  consumes fires lazily, fire-occluder records come from the site) but env's 'ready' opt-out pass would then recompile
  materials; left for a later task.
- Shadow depth programs (medium+, ≈ 0.4–0.9 s in the first frame): three builds them inside WebGLShadowMap; not
  pre-compiled.
- Medium frame time: the key light's shadow map is re-rendered every frame while the light is on, and with a low Sun or
  Moon its camera spans the whole Mount (220 m, by design: long shadows from the eastern ridge): 9 ms at the spawn,
  38 ms in the Kodesh at night. Throttling it (static world cached, re-rendered when the light or the snapped centre
  moves; figures every frame into a copy) is the next lever for medium; not done here (visible if done naively).
- FXC compile flags or a program binary cache: not reachable from WebGL (the browser's GPU disk cache already makes a
  second visit fast).

## Results (HD 4600, production bundle, cold profile per run, shot=1 unless noted; `shots/perf-1/matrix`)
The machine was shared with other processes at 40–70 % CPU during the task: absolute timings drift by ±20 % between
runs; the interleaved A/B rows are the reliable comparisons.

| metric | before (HEAD) | after |
|---|---|---|
| first view, low spawn / Azarah / Kodesh (s) | 46.9 / 41.4 / 44.9 | 14.9 / 19.6 / 14.8 (normal play: 14.7 / 14.7–15.5) |
| first view, medium (s) | 74.0 / 79.8 / 72.9 | 28.4 / 28.5 / 28.1 |
| first view, high (s) | 187.8 / 185.8 / 194.2 | 128.4 / 154.0 / 92.0 |
| `ready`, low / medium / high spawn (s) | 8.8 / 9.5 / 13.0 | 7.0 / 8.9 / 10.7 |
| longest main-thread task in boot, low | 31.4 s (first frame) | 2–3.5 s (world build) |
| env init / sim init, low (s) | 2.4 / 1.0 (5.7 under compile load) | 0.15–0.2 / 1.1–1.3 |
| programs, low / medium spawn | 74 / 94 | 66 / 83 (lit at boot: 26 → 14 low) |
| draw calls low / medium / high (spawn, Azarah, Kodesh) | 177 149 87 / 330 329 122 / 924 489 136 | 256 223 141 / 429 423 193 / 547 589 212 |
| triangles low spawn / medium spawn (incl. pre-pass) | 0.42 M / 1.35 M | 0.57 M / 1.68 M |
| GPU ms in one page, pre-pass off → on, low | 25 / 48 / 38 | 17 / 13–20 / 19 |
| GPU ms, medium (shadow updates excluded) | 59 / 97 / 83 | 50 / 51 / 51 |
| fps in one page, pre-pass off → on, low | 28.3 / 15.8 / 18.9 | 32.4 / 35.7 / 31.5 |
| fps in one page, medium | 10.1 / 6.4 / 8.1 | 11.5 / 13.2 / 12.1 |
| steady fps, separate runs, low / medium / high | 46.6 26.6 30.5 / 16.2 10.0 11.9 / 6.0 3.0 4.6 | 37.5 40.5 27.0 / 13.1 11.5 11.9 / 7.8 7.0 9.0 |
| screenshots before vs after (mean abs diff /255, pixels > 8) | — | ≤ 1.03, ≤ 0.18 % (exposure ≈ 1/255 at boot, smoke, flicker) |

Targets: low < 15 s met at the spawn and in the Kodesh, and for a visitor in the Azarah (a flesh prop's detail program,
4.5 s alone, is found only a few updates in: a screenshot waits for it, play draws it at LOD 1 meanwhile); medium < 30 s
met; high boots faster. Frame rate: the pre-pass roughly doubles low's rate in walled views, but low ≥ 45 fps and medium
≥ 25 fps were not demonstrated on this loaded machine (low's GPU frame is 13–20 ms; medium is bound by the per-frame
key-light shadow map and per-pixel lighting — see "Not done").
