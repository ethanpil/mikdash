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
