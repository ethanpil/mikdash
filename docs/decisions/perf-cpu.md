# perf-cpu — main-thread CPU per frame on low and medium (JS, garbage, geometry)

Scope: the brief "better performance on low and mid hardware", measured where this machine can measure honestly: the
main thread's JavaScript per frame, garbage per frame, and what each frame draws. This machine has no GPU (SwiftShader on
4 shared cores, two other agents rendering): no frame rates are claimed. Format: **choice** — why — alternative.

## Tools (new)

- `tools/cpu-prof.mjs` — one browser, one boot in normal play (UI and intro up, Enter pressed, everything the boot defers
  waited for: `bootTimes.drained`, then the day's plan job), then each scene applied through the app's own API (date, clock,
  speed, teleport, look; no reboot). Each scene is measured in two windows:
  - **update** (20 s, drawing off: `engine.drawing = false`): the updaters run at ≈ 55 frames a second, as on a machine
    whose GPU keeps up, so the sim's LOD cadences (mid choreos at 15 Hz, far ones at 4 Hz) and the people's per-frame work
    are what a visitor's frame pays. The engine's updaters are wrapped by priority (performance.now()), the CDP sampling
    CPU profiler runs at 200 µs, the CDP sampling heap profiler keeps the objects minor and major GCs collected (so its total
    is the bytes allocated, not the bytes surviving).
  - **draw** (30–40 s, drawing on): the render JS (three's renderer, render/). SwiftShader draws a frame in 3–4.5 s here,
    so this window has 11–13 frames: one-off work (a batch built, a program linked) shows in its averages; read it for the
    render side only.
  - then 6 drawn frames with `renderBufferDirect` wrapped: calls and triangles by pass (main / pre-pass / shadow) and by what
    is drawn (world builder, people archetype × LOD, props, fx), and the materials three re-keyed (`getProgram`) per frame.
- `tools/cpu-prof-table.mjs` — the tables below from its JSON.
- `tools/perf-cpu-bench.js` (run with `src/sim/dev/run.mjs`) — the people system's and the sim runtime's update in tight
  loops in one page (ms and KB per call), the scene graph's size, and the world's triangles inside the view frustum.
- `tools/perf-cpu-snap.js` (run with `src/sim/dev/run.mjs`) — a fingerprint of every shown sim figure and every people
  batch's instances at 7 moments, for before / after equality.

Scenes (low unless noted; site amot): **a** default start (alot − 6, Chel steps); **b** the Azarah's east end at day hour 3
(`at=238,385&look=215,4&t=d3`, 2026-11-02), speed 1; **b60** the same at 60×; **c** Rosh Chodesh musaf
(`date=2026-11-11&t=sunrise+140`, same spot); **d** the same spot at night hour 3; **e** walking forward (W held) from b's
spot; **f** b on medium.

## Baseline (HEAD + other agents' work in progress, low, dev server, 1280 × 720)

JS ms per frame in the update window, by the engine's updater priorities (time 0, sim 10, zones 11, people 20, player 30,
env 40, world LOD 45, fx 50 — the world's emissive / water updaters share 50 and 55 —, audio 60, ui 70). "busy" is the CPU
profile's non-idle self time per frame (all JS on the main thread, plus GC and native calls); KB/f = bytes allocated per
frame. The draw columns come from the draw window (render JS per frame and the frame's draws).

| scene | upd tick | sim | zones | people | player | env | fx+world(50) | world(45/55) | audio | ui | busy | gc | KB/f | draw JS | draw tick | calls | tris | programs | figures drawn (L0/1/2/3) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a start | 1.60 | 0.42 | 0.01 | 0.48 | 0.01 | 0.24 | 0.30 | 0.01 | 0.01 | 0.06 | 1.74 | 0.12 | 294 | 21.18* | 39.03* | 263 | 0.686M | 75 | 76 (0/0/3/56) |
| b Azarah d3 | 2.19 | 0.87 | 0.01 | 0.69 | 0.01 | 0.21 | 0.24 | 0.02 | 0.01 | 0.10 | 2.12 | 0.13 | 251 | 15.02 | 22.94 | 250 | 0.669M | 77 | 96 (0/0/14/41) |
| b60 (60×) | 5.31 | 1.41 | 0.01 | 1.80 | 0.02 | 1.41 | 0.40 | 0.03 | 0.02 | 0.16 | 5.06 | 0.34 | 345 | 22.44 | 29.91 | 255 | 0.688M | 77 | 102 (0/1/11/48) |
| c RC musaf | 2.20 | 0.91 | 0.01 | 0.71 | 0.01 | 0.18 | 0.22 | 0.01 | 0.01 | 0.08 | 2.01 | 0.14 | 245 | 18.38 | 23.68 | 249 | 0.661M | 77 | 96 (0/0/12/46) |
| d night n3 | 3.00 | 1.01 | 0.01 | 1.08 | 0.02 | 0.38 | 0.31 | 0.02 | 0.01 | 0.10 | 2.63 | 0.11 | 201 | 10.59 | 15.03 | 243 | 0.639M | 77 | 35 (0/0/0/21) |
| e walking | 4.25 | 1.48 | 0.01 | 1.56 | 0.09 | 0.31 | 0.31 | 0.02 | 0.16 | 0.25 | 4.27 | 0.34 | 286 | 15.36 | 33.74 | 251 | 0.665M | 77 | 92 (0/2/15/36) |

\* a's draw window contains a one-off (people 13.8 ms/f averaged over 13 frames: a batch built in it).

Context: 1190–1258 people actors exist (every pooled figure of every choreography), 69–218 of them visible; 64–191
figures wanted by the sim.

### Where the time goes (update window, self ms/frame; b at 1× unless noted)

- **people** 0.48–1.80: `Actor._tick` over every actor, visible or not (1190–1258 of them; 0.10–0.24 self), `update`
  (0.09–0.19 self + inlined into its updater closure 0.06–0.12), `_updateFlames`, `updateWorldMatrix` of each visible actor,
  `propVariant` (a key string per prop per frame).
- **sim** 0.42–1.48: g4 Troupes (`legAt`, `episodeAt`, `Itin.sample`, `Route.sample`: 0.24 inclusive), courts-daily (0.20),
  private-offerings (`trackAt`, `poseSlot`, g5 `track.js get t0`: 0.14), the runtime's `budgetPass` over every slot (0.05),
  chambers-daily, ketoret-morning (0.05; 0.09 at night).
- **env** 0.2–0.4 (1.41 at 60×: `env/index.js update`, `interiors.updateFill`, uniform uploads), **fx** 0.24–0.40 (fire
  lights, `illuminanceAt`), **ui** 0.06–0.25 — not mine (see "Needs from others").
- **Garbage**: 200–345 KB per frame (12–20 MB/s at 60 fps). The largest single allocator everywhere is
  `PeopleSystem.update` (78–97 KB/f), then `Actor._tick` (7–40 KB/f), fx (`illuminanceAt`, `writeFire`, `lights.update`:
  20–40 KB/f), three-mesh-bvh ray casts (the player's floor probe, 15 KB/f).
- **The day's plan job** (not per frame): 1.1–1.5 s of CPU after the boot and after every date change, in slices of ≤ 8 ms
  (one slice of 196 ms and one of 110 ms measured) — on this machine its slices ran one per drawn frame, so a date change
  kept the G4 / G5 figures off for 9 minutes of wall time (a SwiftShader artefact: the slices wait behind 3–4 s frames).

### Render side (draw window, not my paths)

- **Every lit material is re-keyed every frame**: three calls `getProgram` (its `getParameters` and the program cache key
  string) for 64–74 materials per frame, 420 calls in 6 frames at b. Cause: the depth pre-pass draws `ctx.scene` with the
  camera on layer 29, which holds no light, so three's light state for that scene changes twice a frame and every lit
  material fails `materialProperties.lightsStateVersion === lights.state.version` in the main pass. 0.8–1.4 ms/f of JS
  (`getProgram` inclusive) and 150–190 KB/f of garbage (`getParameters`, `getProgramCacheKeyParameters`, `join`).
- three's scene traversal: `updateMatrixWorld` 0.37–0.55 ms/f, `projectObject` 0.4 ms/f; per-draw state (`setProgram`,
  uniform `upload`, binding states) for ≈ 250 draws.

### Geometry (one frame, low, calls / triangles by pass)

| view | world main | world pre-pass | people (figures) | props | fx | total |
|---|---|---|---|---|---|---|
| a start | 157 / 422 k | 78 / 194 k | 6 / 50 k | 11 / 18 k | 6 / 1.5 k | 263 / 686 k |
| b Azarah d3 | 142 / 422 k | 77 / 200 k | 7 / 26 k | 14 / 20 k | 5 / 1.5 k | 250 / 669 k |
| d night | 144 / 425 k | 77 / 200 k | 3 / 5.6 k | 8 / 6 k | 6 / 1.5 k | 243 / 639 k |

The world is 91–96 % of every view's triangles; the people (figures and props) 2–10 %. The world's merged batches are one
mesh per material over the whole precinct, so three's frustum culling cannot drop any part of them: the same ≈ 422 k
triangles are drawn whichever way one looks (and ≈ 200 k again in the pre-pass).

### Medium (f: scene b, same method)

| scene | upd tick | sim | people | env | fx+world(50) | ui | busy | gc | KB/f | draw JS | calls | tris | programs | figures drawn (L0/1/2/3) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| b Azarah d3, medium | 2.82 | 1.10 | 0.86 | 0.29 | 0.30 | 0.13 | 2.67 | 0.16 | 297 | 15.08 | 339 | 1.498M | 91 | 114 (0/1/18/54) |

One frame on medium at b: world 184 calls / 990 k triangles in the main pass and 91 / 416 k in the pre-pass (94 % of the
triangles), people and props 36 / 64 k, their shadow casters 7 / 24 k.

## Changes (phase 2)

The profile has no single dominant item on the update side: at speed 1 the updaters cost ≈ 1.6–3 ms per frame here, the
people system being the largest (0.5–1.6 ms) and the sim (0.4–1.5 ms) a long tail of 24 choreographies, none above
≈ 0.25 ms. The render side (three's per-draw work, ≈ 8–15 ms of JS per frame on SwiftShader) is larger but not mine. So the
changes are where the people system spends on figures that are not drawn, and where it makes garbage.

- **The people system ticks only the figures it may draw; a hidden actor catches up in one step when it is next needed
  (`Actor._flush`, `PeopleSystem._clock`).** — `update()` ticked all 1190–1258 actors every frame (every pooled figure of
  every choreography), though 69–218 were visible; `_tick` was the system's top self-time function and allocated 7–45
  KB/frame. A hidden actor is flushed (the summed real time applied at once) before anything that changes how it advances —
  `setPose`, `setSpeed`, `setScale`, `setVisible` — and visible or still cross-fading / scratch-holding actors are flushed
  every frame as before. One step of the summed time gives the same phase and fade as many small ones (a loop wraps, a
  one-shot clamps or wraps by `% 1`, a fade floors at 0), so the poses are the same. Verified (`tools/perf-cpu-tick.js`):
  991 actors (835 hidden), each mirrored by a copy ticked every frame with the system's own clamped dt, 600 frames: worst
  phase difference 2.2e-15, fade 0. Alternative: tick hidden actors round-robin (an approximation; this is exact).
- **Actors' transforms hang outside the scene (`sys.actorRoot`) and set their matrices by hand (`matrixAutoUpdate` off,
  `Actor._placed`).** — three's `updateMatrixWorld` and `projectObject` visited every actor group every frame: 1255–1340
  objects under `people.root` of 1450–1530 in the scene, ≈ 60 % of the scene's matrix update (`people.root.updateMatrixWorld`
  0.15–0.28 ms of a 0.20–0.45 ms `scene.updateMatrixWorld()`). The groups draw nothing (the batches under `people.root` do);
  every setter (`setSite`, `setPosition`, `setHeading`, `_refloor`) already updated the world matrix, which `update()`
  reads (its per-actor `updateWorldMatrix(true, false)` is gone). A hidden `people.root` still hides every figure (checked
  once a frame). Nothing outside people/ reads an actor's place in the graph (inspect-pick reads `position`, player/goto
  `updateWorldMatrix(true, false)`, both unaffected). The torch anchors stay under `people.root` (fx follows them) with
  their matrices set by hand too.
- **No garbage in the frame loop's own code** — arrays mirroring the actor / crowd Sets in insertion order (rebuilt only
  when one comes or goes: a Set's `for…of` allocated an iterator result per element where Maglev, not TurboFan, ran the
  loop — `%GetOptimizationStatus` showed `update`, `_tick`, `push`, `end` Maglev-optimised with deopts), the per-figure
  `showP` and per-frame `propBatch` closures as functions, the props of a figure in one reused array, the crowd tint read in
  place (was a `subarray` view per member per frame), `flames.find(closure)` → a loop, `Batch.end` without array literals,
  the distance sort's comparator made once and returning −1 / 0 / 1 (same order; a boxed double per comparison before),
  the sleeper's automatic prop object kept (`shownProp`), the lead ropes' temporaries at module level.
- **props.js caches what it recomputed per drawn prop per frame** — `gripClass` (gripOf built arrays and a matrix each
  call), `propTip` (a vector and four matrices per torch per frame: now one shared, read-only vector per prop × grip × side),
  `propAttach` and `propVariant` (nested Maps instead of a key string per call).
- **A baked animal's source geometry is built once per kind and LOD (`bakeAnimal`)** — a carcass, a dove in the hand or a
  cage of birds first drawn in play rebuilt the live animal's geometry for every prop variant (twice per cage): 40–150 ms in
  the frame the prop appeared (`buildAnimalGeometry` 145 ms + `buildPropGeometry` 162 ms in one 20 s walking window). CPU
  arrays only, read and never changed.

Not changed (measured, and why):
- **The sim.** No function above ≈ 0.04 ms/frame of self time; the cost is the sum of the choreographies' own posing
  (g4 Troupes 0.24–0.36 ms inclusive, courts-daily 0.20–0.28, private-offerings 0.14–0.30, the runtime's loops and budget
  pass ≈ 0.16–0.38). The obvious candidates (skipping idle pools in `budgetPass`, cached track bounds instead of
  `Track.t0` getters in `trackAt`, sorted cue windows) are 0.01–0.04 ms each and touch the determinism-critical paths; not
  worth their risk. Its allocations (25–75 KB per update) are mostly boxed doubles returned from small helpers (`wrap`,
  getters) and per-frame object literals in cue checks (`rosh-chodesh-musaf` `Object.entries` + `say(…, {…})`).
- **The day's plan job** (1.1–1.9 s of CPU after the boot and after a date change, slices up to 130–615 ms here): not
  per-frame; its long slices are single generator steps. Splitting them is a sim-planner task.

## Evidence

**Output unchanged.**
- `tools/perf-cpu-snap.js` (every shown sim figure's place / heading / pose / phase / prop, every people batch's instances —
  matrix, tint, mask, rig row — the LOD counts and the torch anchors, at 7 moments: dawn start, d3, sunrise+40, the Rosh
  Chodesh musaf, n3, d7.5, a Shabbat d4), a copy of the tree with only people/system.js and people/props.js at their
  previous version against this one: identical at all 7 moments, except a prop batch's pAnimB.x, its holder's animation
  frame, which follows the real-time clock (a sleeper's breathing; compared without it). (A first pair differed by the
  seal-buyers that another agent's uncommitted chambers-daily.js adds to the working tree; the base copy was then refreshed
  from the working tree.)
- `tools/perf-cpu-tick.js`: the lazy tick against an every-frame tick, 991 actors, 600 frames: worst phase difference
  2.2e-15, fade 0.
- `src/sim/dev/tests/jumps.js` "t=d3" (run with drawing off — the same script after `ctx.engine.drawing = false`):
  deterministic, no diffs.
- Screenshots, low, shot mode, base copy vs this tree (`shots/perf-cpu/{b,n3}-{base,new}.png`, diffs `*-diff-x8.png`):
  Azarah d3 0.116/255 mean, 0.44 % of pixels > 8/255; n3 0.330/255, 0.45 % — the altar's flames and smoke (real-time
  animation) and the figures' idle breathing; same draw calls and triangles (251 / 674 120).

**Interleaved A/B in one machine state** (`tools/perf-cpu-bench.js`, base copy and this tree alternated, 2 runs each;
600 calls per figure; min of the two runs):

| moment | people.update ms/call base → new | KB/call base → new | scene.updateMatrixWorld ms base → new |
|---|---|---|---|
| a start | 0.300 → 0.096 | 122 → 46 | 0.190 → 0.028 |
| b d3 1× | 0.242 → 0.135 | 143 → 62 | 0.185 → 0.047 |
| b d3 60× | 0.232 → 0.114 | 146 → 60 | 0.214 → 0.028 |
| c RC musaf | 0.279 → 0.111 | 161 → 60 | 0.218 → 0.028 |
| d n3 | 0.190 → 0.071 | 129 → 36 | 0.243 → 0.033 |

(The sim runtime, unchanged, measured 0.09–0.67 ms/call in the same runs: the machine's noise for code that did not change.)

## After (same runner, same scenes; the other agents' env / ui / render work changed between the runs)

| scene | upd tick | sim | people | env | ui | busy | gc | KB/f | draw JS* | calls | tris |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a start | 1.60 → 1.93 | 0.42 → 0.54 | 0.48 → 0.45 | 0.24 → 0.29 | 0.06 → 0.08 | 1.74 → 2.10 | 0.12 → 0.23 | 294 → 199 | 21.2 → 11.5 | 263 | 0.686M |
| b Azarah d3 | 2.19 → 2.07 | 0.87 → 0.85 | 0.69 → 0.55 | 0.21 → 0.24 | 0.10 → 0.11 | 2.12 → 2.07 | 0.13 → 0.07 | 251 → 172 | 15.0 → 8.1 | 250 | 0.669M |
| b60 (60×) | 5.31 → 4.54 | 1.41 → 1.38 | 1.80 → 1.30 | 1.41 → 0.95 | 0.16 → 0.41 | 5.06 → 4.01 | 0.34 → 0.21 | 345 → 208 | 22.4 → 11.3 | 255 | 0.691M |
| c RC musaf | 2.20 → 2.95 | 0.91 → 1.40 | 0.71 → 0.76 | 0.18 → 0.29 | 0.08 → 0.11 | 2.01 → 2.93 | 0.14 → 0.01 | 245 → 181 | 18.4 → 16.4 | 249 | 0.659M |
| d night n3 | 3.00 → 2.51 | 1.01 → 1.01 | 1.08 → 0.57 | 0.38 → 0.34 | 0.10 → 0.11 | 2.63 → 2.50 | 0.11 → 0.10 | 201 → 136 | 10.6 → 10.9 | 243 | 0.639M |
| e walking | 4.25 → 4.83 | 1.48 → 2.04 | 1.56 → 1.10 | 0.31 → 0.33 | 0.25 → 0.63 | 4.27 → 5.16 | 0.34 → 0.27 | 286 → 203 | 15.4 → 16.4 | 251 | 0.665M |
| f medium b | 2.82 → 2.34 | 1.10 → 0.97 | 0.86 → 0.62 | 0.29 → 0.26 | 0.13 → 0.10 | 2.67 → 2.34 | 0.16 → 0.15 | 297 → 233 | 15.1 → 38.0 | 339 | 1.499M |

\* 8–13 frames of SwiftShader: one-off work in the window dominates (c and e built a prop / animal batch in theirs; the
medium window had 9 frames of 10 s). Read the draw column for the order of magnitude only.

Reading it: what this task changed (people) went down in every scene but c (0.71 → 0.76, inside the window noise) —
by 0.03–0.51 ms/frame, 20–47 % — and allocations went down 21–40 % in every scene (the most robust figure: it does not
depend on the machine's load). Columns this task did not touch moved by as much as ±50 % between the two runs (sim in c and
e: unchanged code; ui and env: other agents' changes in between), which is the noise of 20 s windows on this shared
machine; the interleaved micro-benchmark above is the reliable comparison for the people system (−44 to −68 % per call).
Draw-side: three's scene matrix update no longer visits 1250+ actor groups (0.19–0.24 → 0.03–0.05 ms per call).
Calls and triangles are unchanged in every scene (the people's geometry and LODs are the same).

## Triangles and draw calls (findings; proposals, not changed)

- **The world is 91–96 % of every frame's triangles and none of it is culled.** Its merged batches span the precinct, so
  three's frustum test keeps all of them; the view frustum holds only a share (bench, low, triangles whose three vertices
  are not all outside one frustum plane — an upper bound, occlusion ignored):

  | builder | drawn (main pass, low) | in the frustum at b (Azarah, SW) | at a (start, W) |
  |---|---|---|---|
  | terrain | 207 k | 43 k (21 %) | 37 k (18 %) |
  | mount | 99 k | 28 k (28 %) | 35 k (36 %) |
  | courts | 61 k | 13 k (21 %) | 59 k (98 %) |
  | altar | 41 k | 37 k (91 %) | 41 k (100 %) |
  | heichal | 29 k | 28 k (97 %) | 29 k (100 %) |

  The largest single offenders are instanced batches spread over the whole landscape: `olive-crowns-far` (2 × ≈ 540
  instances, 32–33 k triangles each, 1–2 % in view), `rocks` (410 instances, 33 k, 2–5 %), the stoas' `stoa-columns`
  (370 instances, 56 k, 34–43 %), and merged batches `ashlar_plain` (mount 36 k, 20 %), `house_rubble` (26 k, 30–35 %).
  On medium the terrain alone is 544 k triangles of the main pass and 242 k of the pre-pass at b (52 % of the frame).
  **Proposal (world builders, my paths, not done: its GPU effect cannot be measured here and it trades draw calls for
  triangles):** split the landscape's instanced far batches (olive crowns, rocks) and the city's merged batches into 6–8
  angular sectors around the Mount, and the stoa columns into their four stoas, so three's culling drops what is behind the
  viewer: ≈ −90 k triangles at b on low (≈ −60 k main, ≈ −30 k pre-pass where they qualify), ≈ −250 k on medium, for ≈ +15–25
  calls (≈ +0.3–0.5 ms of CPU submission on the HD 4600 at perf-1's ≈ 20 µs a call). Needs a GPU-timer A/B on the HD 4600
  (render/dev/gpu-split.mjs) before it is worth doing; the low shadow map's static-caster signature would not change
  (sectors do not move).
- **The pre-pass doubles the world's triangles** (77 calls / 200 k low, 91 / 416 k medium): perf-1 measured it as a large
  GPU win on the HD 4600 and it stays; noted here because it also costs ≈ 0.6 ms of JS per frame (below) beyond its draw
  calls.
- **People are cheap in geometry**: 2–10 % of the triangles (low: 20–70 k; medium: 64 k + 24 k shadow casters), 7–36 calls
  (props are most of them: one call per distinct prop variant, capped 14 / 22 per tier). Far figures are at LOD3 (41–56 of
  76–102 drawn at b and a), no figure is LOD0 on low in these views; animals cap at LOD1 beyond their hero distance.

## Needs from others (measured; not my paths)

- **render (prepass.js): every lit material is re-keyed every frame.** The pre-pass renders `ctx.scene` with the camera on
  layer 29 only, which holds no light, so three's light state for the scene's render state changes twice a frame and every
  lit material fails `lightsStateVersion === lights.state.version` in the main pass: `getProgram` (`getParameters` + the
  program cache-key string) for 64–77 materials a frame on every tier with the pre-pass. Tried in the page without changing a
  file (`tools/cpu-prof.mjs --exp lights29`, medium b, 4 interleaved windows): with every light also on layer 29, getProgram
  calls 308 → 0 per 4 frames, its time 0.61 / 1.10 → 0 ms/frame, allocations 603 / 556 → 334 / 316 KB/frame, draw JS
  15.1 / 12.3 → 7.0 / 7.1 ms/frame (SwiftShader; 8 frames a window). **Fix**: in `DepthPrepass` enable `PREPASS_LAYER` on the
  scene's lights (env's key / moon / hemisphere lights, fx's fire-light pool — e.g. once at construction and on
  `fx` light creation), or toggle it on them for the pre-pass's `render()`. The pre-pass then sees the main pass's light
  counts (three keeps `lights.state.version`); its shadow maps stay suspended (`autoUpdate` / `needsUpdate` false), its depth
  material needs no light uniforms. Programs and pixels are the same (the cache keys do not change); verify with
  `tools/goldens.mjs` and `tools/warmup-check.mjs` (no material with two programs).
- **env (fog.js `FogUniforms.apply`) at fast clock speeds**: whenever a fog uniform changes (every frame at 60×, the sun
  moving), every program is bound and 11 uniforms uploaded into each — 75+ `useProgram` and ≈ 800 `uniform*` calls a frame:
  env's update 1.41 ms/frame at 60× on low (0.2 ms at 1×), 0.66 ms of it in `apply` (uniform3fv 0.19, useProgram 0.10).
  Put these in env's existing uniform block (one `bufferSubData` a frame), or upload them lazily per program in
  `onBeforeRender` of what is drawn.
- **fx**: `illuminanceAt`, `writeFire`, `lights.update` allocate 20–40 KB/frame (per-frame arrays / vectors); 0.24–0.40
  ms/frame. Worth a pass with `tools/cpu-prof.mjs` (the heap section lists them by function).
- **ui**: 0.06–0.25 ms/frame (0.4–0.6 while walking, `ui/console/markers.js place` and the minimap); no hotspot over
  0.05 ms in the profiles, nothing proposed.
- **sim (planners)**: the day's plan job ran single generator steps of 110–615 ms here (`chambers-daily` nazirites
  `placeSet` → `scriptNazir` → `fitSub` / `hotOf` / `subFree`): each is a frame of that length on the visitor's machine
  (≈ 1/3–1/2 of it on the HD 4600's CPU) once per boot and per date change. A candidate (not tried): yield inside `placeSet`'s shift loop.

## Not done / not verified

- No frame rates (no GPU here). The draw-window JS includes SwiftShader's GL submission; its absolute values are not the
  HD 4600's.
- The terrain / stoa sectoring above (needs a GPU A/B on the HD 4600).
- Boot (brief item 5): this task changes nothing before the first frame (the actors' setters do the same matrix work as
  before; `bootTimes` in the runs: low firstFrame 12.1–16.3 s, medium 13.3–18.4 s on the dev server, play mode, loaded
  machine — not comparable to warmup-check's production numbers). `tools/boot-prof.mjs --cpu` was not run: no boot work was
  in scope of a change here.
- `tools/warmup-check.mjs` and `tools/goldens.mjs` not run (no shader, program or material change; the screenshots above
  cover the pixels at two views on low).
- Medium "after" is one run (no interleaved repeat).

## Proposed CLAUDE.md lines

- People: an actor's `object3D` hangs under `people.system.actorRoot`, outside the scene, with `matrixAutoUpdate` off — move
  actors only through their setters (setSite / setPosition / setHeading); hidden actors are ticked lazily (`Actor._flush`
  runs before any setter that changes how a figure advances), so read `actor.phase` only after a flush.
- Per-frame code here often runs in Maglev, not TurboFan: a Set's `for…of`, closures, array literals, destructuring and
  `subarray` in a frame loop allocate. Measure garbage with `tools/cpu-prof.mjs` (CDP heap sampling keeps what minor GCs
  collected), not with heap snapshots.
- The depth pre-pass draws the scene with no lights; unless the lights are on its layer, three re-keys every lit material
  every frame (getProgram for every lit material, ≈ 1 ms of JS and ≈ 250 KB of garbage per frame).
- On SwiftShader measure the updaters with drawing off (`engine.drawing = false`): frames take seconds there, which runs
  every sim LOD every frame and gives the plan job one slice per frame.
