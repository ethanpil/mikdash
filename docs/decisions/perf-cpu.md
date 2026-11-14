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
