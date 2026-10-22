# perf-fix-1 — review fixes to perf-1 (boot, shader warm-up, frame time)

Scope: the reviewer's findings on perf-1 (`perf-1.md`). Measured on the production bundle on the HD 4600 (4 threads,
ANGLE/D3D11), cold profile per run. Format: **choice** — why — alternative. Shots: `shots/perf-fix-1/`.

**Measurement conditions.** During the whole task the machine ran other processes at 40–100 % CPU, and a screensaver
(`Mystify.scr`, running since the evening before) held about 45 % of the iGPU's 3D engine (Windows GPU engine counters).
GPU timer queries therefore read ±30 % from one window to the next, and fps is pessimistic for an idle HD 4600. Every
decision below was taken on interleaved A/B in one page or on interleaved cold runs; the screensaver was not stopped
(it is not ours to stop).

**Correction (perf-fix-2).** The 45 % was the screensaver's share while the app idled. The review's per-process GPU
engine log shows it falling to 2–28 % (the app 70–99 %) whenever the app was GPU-bound, so the GPU-bound figures below
(medium's frame times, low's Kodesh) are not handicapped by anything like 45 %. Medium's shipping number is its adaptive
one: median 30 fps at the 0.5 scale floor, ≈ 21–25 fps on average (417–504 frames in 20 s, review).

## Fixes

- **Warm-up compiles with the frame's light state (`render/warmup.js` `setFrameLights` / `withFrameLights`, registered by
  render/index.js; `SunShadows.withFrameLights`).** — On high / ultra `SunShadows.beforeRender` hides env's key light and
  takes its shadow over only inside a frame; every warm-up compile ran outside one, so its programs were keyed with one
  more directional light and one less sun light than the frame draws with (72 of 114 materials held both). The first
  frame then compiled every lit program synchronously (50–90 s), and later freezes of 9–15 s followed. Now every
  `compileScene` (main.js scene / fx / pre-pass, people warm-up, people background variants, `_drawable`) runs inside the
  borrow; nested in a frame it runs as is. High spawn: 0 materials with two programs, 122 → 98 programs, first view
  130 → 42 s. Alternative: compile inside a real (undrawn) frame — the loop's render function is what decides the state.
- **Boot stylesheets attached as stylesheets, crossorigin like vite's loader (main.js `preloadBootChunks`).** — The
  `rel=preload as=style` link had no crossorigin while vite fetches CSS with it: Chrome discarded the preload (credentials
  mode mismatch), fetched twice and logged 2–7 warnings in every normal-play boot; a preload used only at UI init (7 s
  later) also warns as unused. A `rel=stylesheet crossorigin` link is fetched once, and vite's helper finds it and skips
  its own. All UI rules are scoped to `#ui-root` / `.mk-*`, so attaching them early changes nothing on screen.
- **Sky statistics table built during the shader warm-up (env 'ready' → `buildTableAsync`), and the boot re-metered from
  it if it lands before the first view.** — perf-1 built it after the first view; until then the first view metered by
  read-back, which put medium's court at night 2.2/255 off HEAD in a shot, and its passes and read stuttered the first
  seconds of play (0.15–0.25 s stretches in `getBufferSubData`). During the warm-up this thread and the GPU idle while
  programs link; the table lands in ≈ 0.5 s, then a forced refresh meters the boot exactly as HEAD did ('ready' forced
  one). If it lands after the first view, nothing is forced (perf-1's behaviour).
- **Post warm-up also collects a pass's own parentless full-screen meshes (`post.warmupMaterials`).** — N8AO (high /
  ultra) keeps its AO, denoise and compositer materials in `FullScreenTriangle._mesh`; the walk stopped at objects, so
  those programs (1.3 s + 0.3 + 0.2 + 0.1 on high) linked in the first frame. Each is compiled on its mesh's own geometry.
  Parentless only: FX meshes reached through FXPass are compiled with their scene.
- **Env's cube-map pass program in the warm-up (`ctx.env.warmupMaterials()`).** — compiled against the cube target under
  env's own render state (`luts.withState`: shadow maps off, which is in the key).
- **People background variants issued once 60 % of the first view's programs are linked (bus 'warmup:tail', main.js),
  not 1 s after the first view; only with KHR_parallel_shader_compile.** — creating a program object preprocesses
  ≈ 140 KB of GLSL, 0.1–0.25 s of this thread each: 3–4 stutters right after the first view. At the warm-up's tail the
  compiler threads are freeing up and this thread idles. A screenshot keeps the old timing (the later discovery rounds
  would otherwise wait for them). Without the extension a program issued ahead links at its first query — env's fog and
  uniform-block binders query every new program — so both the people warm-up and the background variants are skipped
  there (behaviour as before perf-1); perf-1 issued them regardless, which without the extension meant several
  synchronous 1.5–7 s links a second after the first view.
- **Warm-up discovery rounds run while the first set links (main.js `discover`).** — the three undrawn updates and the
  compile traversal that find what the view creates a few updates in ran after the first set had linked: 0.3–0.7 s on
  low's critical path while the main thread had been idle for seconds. They now run right after the set is issued; a
  screenshot checks again after linking.
- **Depth pre-pass: off by default on tile-based GPUs (`render/detect.js tiledGpu`: mobile, Apple — Safari reports every
  Mac as "Apple GPU" —, Mali, PowerVR, Adreno); `?prepass=1` forces it.** — those GPUs reject hidden fragments in
  hardware, so the pre-pass would only add 60–80 draws and ≈ 35 % vertices; it was measured on ANGLE/D3D11 only.
- **Pre-pass depth sits a polygon offset behind the frame's (factor 1, units 2).** — the frame's LessEqual test no longer
  depends on two programs computing bit-identical depth. A frame fragment of the same surface always passes and writes
  its own depth, so the image is the one without a pre-pass on any compiler; a hidden surface within the offset is merely
  shaded and overdrawn. Alternative: `invariant gl_Position` in both programs — invariance across *different* programs
  is only guaranteed for identical expressions and inputs, and it would touch every vertex shader of the project through
  a shared chunk; the offset needs neither.
- **`markPrepass` rejects materials with a displacement map, a polygon offset, a depth function other than LessEqual, or
  wireframe.** — none exist today; any of them would have mismatched silently.
- **The frame's scene pass skips the second world-matrix update after the pre-pass (`DepthPrepass.drawScene`).** — the
  pre-pass's `render()` already updated every matrix; `scene.matrixWorldAutoUpdate` is off for the scene pass only. The
  second projection traversal stays (layer test per object, cheap next to the matrix update).
- **Auto tier capped by CPU threads (`detectDevice`: ≤ 4 threads → medium at most, < 8 → high at most).** — a first visit
  compiles every program on the CPU (ANGLE + FXC on the browser's worker threads); a strong GPU does not shorten it:
  medium ≈ 28 s, high ≈ 42 s on this 4-thread CPU. Settings still offers every tier, and later visits hit the browser's
  GPU program cache. Alternatives: cap every first visit at medium and offer the upgrade (needs a UI prompt — requested
  of the UI owner); boot at medium and switch once high's programs are compiled in the background (high's keys depend
  on the cascaded-shadow scene state, which would have to be built alongside).

## Medium: key-light shadow cache (`render/shadow-cache.js`, env `setShadowHold`)

- **Static / dynamic split of env's key-light shadow map.** — three re-rendered the whole map every frame its light was
  on; in medium's Azarah by day that pass was a large share of the frame (GPU timer: 25–35 ms of ≈ 70, noisy). The
  non-people casters are drawn into a cached depth target only when their signature changes; each frame three's own pass
  clears the map, a depth blit copies the cache in (hooked on `shadow.getFrustum`, three's next call after the clear and
  viewport), and only `people.root` is drawn (every other scene root hidden for that pass). Depth min-composition is the
  same result as one pass. Signature: the light's framing (light / target position, ortho extent, near / far, map size)
  and, per static caster, world matrix, draw range, instance count, instance / position / index buffer versions and
  geometry id, over visible objects only (doors and curtains swinging, the stoas' and trees' instance LODs, the altar's
  wood, vessels shown or hidden all invalidate it). `?shadowcache=0` turns it off; `ctx.post.shadowCache` (`enabled`,
  `stats.statics` / `stats.frames`).
- **env holds the key light's shadow framing while it drifts little (only when the cache asks: `setShadowHold`).** — the
  texel-snapped centre moved with every step and every turn of the head (it leads the view by 0.35 R), and R changes
  continuously with a low Sun: the cache would have been rebuilt every frame. The framing is kept until the light turns
  by > 0.05°, R changes by > 2 %, or the ideal centre drifts > R / 16 in any light-space axis; a new framing is computed
  exactly as before. The map then reaches R − R/16 around the ideal centre (≥ 94 %), and the light lags ≤ 0.05°
  (≈ 1 cm of shadow per 10 m of height). Texels stay world-locked (same lattice).
- Verified: 7 medium views (shot mode), cache vs `?shadowcache=0`: mean ≤ 0.16/255, ≤ 0.02 % of pixels > 8/255 (fire
  flicker). In motion (`src/render/dev/shadowcache-check.mjs`): still view 0 static re-renders in 30 frames, a 90° turn
  over 45 frames 7, a 12 m walk over 60 frames 2; a world group moved 1.5 m re-renders the cache, and the frame with the
  cache equals the frame without it (0/255 mean; two frames of one setting: 0/255). A first version summed
  `drawRange.count`, which is Infinity by default: the signature was Infinity and never changed — caught by this check.
- **Moving casters are drawn every frame, not cached.** — in normal play the courts' golah wheel turns all day: its matrix
  changed every frame and rebuilt the cache every frame (90 of 90 frames; medium's Azarah kept 423 draw calls). A caster
  that changes twice within 4 frames joins the people's per-frame pass (outside the signature) until it has been still for
  300 frames; the passes select casters by toggling `castShadow` on the collected lists. Normal play now: 0 cache
  re-renders in 90 frames, 1 moving caster; one re-render per ≈ 10 s as the Sun moves. Interleaved in one page, normal
  play, fixed resolution, medium Azarah: 88.6 ms → 73.6 ms a frame (11.3 → 13.6 fps; 3 of 4 pairs).
- Not on high / ultra (render's cascades re-fit to the view every frame; their own cache would need the same split per
  cascade) and not low (no shadows).

## High tier: budgets and the pre-pass

- **Draw calls / triangles over a frame window (`shot.mjs --eval`, 60–90 frames, high, shot mode).** Spawn: median 547 /
  3.38 M, max 1029 / 6.64 M; Azarah 589 / 3.62 M, max 1099 / 6.85 M; Kodesh 212 / 1.65 M, max 687 / 4.84 M. Without the
  pre-pass: 442 / 489 / 136 median, 924 / 999 / 611 max (HEAD's readings). Main view alone (no shadow updates, no
  pre-pass): 244 / 1.61 M, 210 / 1.56 M, 136 / 1.17 M. The peaks are the frames that re-render the fires' cube shadow
  maps (6 faces each); they exceeded the ≤ 900 / ≤ 6 M budget on HEAD too (924 / 6.07 M); the pre-pass adds ≈ 100 calls
  and 0.6 M triangles to every frame. Steady frames are within budget.
- **Pre-pass kept on high** — interleaved in one page (fixed resolution, 3 × 5 s each): Azarah 3.5 → 5.3 fps, spawn
  4.9 → 5.9, Kodesh 5.2 → 8.1 with it. High is shadow-heavy, but the lit pass behind walls still dominates.
- **Still in the first frame on high (≈ 1–2.5 s; medium ≈ 0.5 s):** the shadow passes' depth / distance programs, which
  three creates inside WebGLShadowMap. They are keyed with the light state of the render state's previous
  `setupLights` — the pre-pass's, which sees no lights — so a warm-up would have to mimic that exactly per depth variant
  (side, instancing, alpha-tested map, people's custom depth); not done (fragile for ≈ 1 s on high).

## Tools

- `tools/warmup-check.mjs [--tiers low,medium,high] ["query"]` — cold production boot per tier; fails when any material
  holds two programs or the first frame trails `compiled` by ≥ 1 s. The harnesses otherwise run on low only.
- `tools/shot.mjs --eval` awaits a Promise result.
- `src/render/dev/shadowcache-check.mjs` (cache in motion), `fps-ab.mjs` VARS `cache` / `noCache`, `gpu-split.mjs` var
  `noCache`.

## Rejected / not done (with evidence)

- **AudioContext before the first view or in an idle callback.** — The ≈ 1 s is the AudioContext constructor itself (CPU
  profile: 961 ms self time in `AudioContext` at the Enter click). Created before a user gesture, Chrome and Edge log
  "The AudioContext was not allowed to start" on every visit (the console must stay clean), and iOS Safari only starts a
  context created or resumed inside the gesture. Moving it to an idle callback after the gesture moves the same stall
  into play. Kept in the gesture, where the intro closes.
- **Sim A* routing spikes (`coarseFrom` / `astar`, 0.2 s stretches).** — pre-existing (HEAD), sim/player-owned; not
  touched.
- **Merging more lit programs.** — the 14 lit programs of the low spawn now differ by real features (side, alpha test,
  physical vs standard, which maps, the patch's variants); sharing them means hacking three's key or adding dummy maps
  (fetches on 6-material batches covering most of the screen). Not done.
- **A cheaper low interior path for the Kodesh.** — low's Kodesh GPU frame is world shading alone (22–28 ms; without the
  world 4.6 ms; people −2 ms; under the screensaver's load): the room's aperture loop, lamp fill and two fire lights on
  gilded walls. Any approximation there changes the image; not done. (perf-fix-2 measured it: see perf-fix-2.md.)
- **Terrain build in a Worker (1.8 s on the critical path).** — a large refactor (Kit, site elements, materials); left
  for a world-builder task.

## Frame-time breakdown (GPU timer, HD 4600 shared with the screensaver, one page each; ms)

| view | low full | low no people | low no world | low no pre-pass | medium full | medium no shadow | medium no people | medium no pre-pass |
|---|---|---|---|---|---|---|---|---|
| spawn | 14.3 | 14.6 | 5.2 | 25.2 | 49–69 | 48.3 | 75 (noise) | 61.2 |
| Azarah | — | — | — | — | 67–79 | 41.5 | 77 | 160.6 |
| Kodesh | 22.6–27.8 | 19.8–25.7 | 4.6 | 32.7 | 83–85 | 82.8 | 66 | 124.9 |

Medium at fixed resolution cannot reach 25 fps (40 ms) on this GPU without visible changes: in the Kodesh the frame is
83–85 ms with the shadow pass contributing nothing (night) — the gilded room's per-pixel lighting and the people's
skinned vertices (≈ 19 ms) are the cost; by day the cache removes most of the shadow pass (Azarah 86.6 → 72.9 ms in one
page). Low's Kodesh (22–28 ms GPU) is per-pixel world shading. With adaptive resolution (the shipping behaviour) both
hold their targets.

## Exposure and hitches (findings 6–7)

- Medium court at night, shot mode, HEAD vs this task: 0.66/255 mean, 0.04 % of pixels > 8/255 (perf-1: 2.19/255,
  16.5 %): the boot meters from the table again. Low spawn's residual 1.2/255 is exposure still converging 30 frames
  after the view (both builds ease at τ 0.7 s from different snaps): after a 6 s settle HEAD vs this task is 0.01/255.
  Low court at night, 0.93/255 after the settle, equals two runs of the same build (0.94/255): fire flicker.
- Frames > 100 ms in the 20 s after the first view, normal play (cold runs, interleaved): low 5–8 (perf-1 2–7, HEAD
  4–14), medium 10–18 (HEAD 22–69), high 34–106 with the worst ≤ 1.8 s (perf-1: freezes of 9.5–14.7 s; HEAD ≤ 5.4 s).
  CPU profiles of the low ones: the people's bedding drape build (`cover`, idle prewarm), adaptive-resolution `setSize`,
  the AudioContext at Enter (≈ 0.4–1 s), A* routing, env's async statistics reads — none from this task's changes; the
  shader links, the sky-table passes and the people variants no longer appear after the first view.

## Results (HD 4600, production bundle, cold profile per run, interleaved; normal play unless noted)

| metric | HEAD | perf-1 | perf-fix-1 |
|---|---|---|---|
| first view low spawn / Azarah / Kodesh (s) | 58.8, 59.6 / 57.6, 57.9 / 56.7, 57.3 | 14.8, 15.0 / 14.8, 16.0 / 15.9, 15.1 | 13.7, 13.9 / 14.7, 14.7 / 14.3, 15.0 |
| first view medium (s) | 119, 114.5 / 113.2, 117.9 / 117.2, 114.5 | 28.3–28.8 (review) | 28.1, 26.8 / 27.5, 26.9 / 26.8, 26.9 |
| first view high (s) | 193.8 / 182.2 / 191.4 (review) | 129–132 / 116–130 / 94–97 (review) | 41.5, 42.0 / 40.4, 41.0 / 40.8, 40.7 |
| `compiled` → first frame, low / medium / high (s) | — | 0.1 / 0.5 / 87 | 0.15 / 0.5 / 0.9 |
| programs low / medium / high spawn | 74 / 94 / 111 | 69 / 86 / 122 | 69 / 86 / 98 |
| materials with two programs, high | — | 72 | 0 |
| console warnings, normal play | 0 | 4–5 | 0 |
| fixed-resolution fps, low spawn / Azarah / Kodesh | 33.1, 29.5 / 18.2, 18.9 / 23.2, 21.8 | 34.9, 56.8 / 45.7, 55.2 / 28.1, 35.6 (review) | 40.6, 40.1 / 52.6, 55.4 / 34.6, 44.5 |
| fixed-resolution fps, medium | 10.7, 10.3 / 7.7, 6.5 / 7.9, 8.8 | 11.6–15.9 / 12.7–13.4 / 11.6–12.8 (review) | 17.6, 17.5 / 17.2, 15.7 / 14.9, 12.7 |
| adaptive fps (median), low / medium / high | ≈ 60 / 20 / 6–10 | ≈ 60 / 20–30 / 12–20 | ≈ 60 / 20–30 / 8.6–30 |
| worst frame after the view, high (s) | 1.9–5.4 | 9.5–14.7 | ≤ 1.8 |
