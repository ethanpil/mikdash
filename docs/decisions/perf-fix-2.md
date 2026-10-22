# perf-fix-2 — review fixes to perf-fix-1 (first-view stalls, low-tier frame rate, warm-up check)

Scope: the reviewer's findings on perf-fix-1 (`perf-fix-1.md`). Production bundle, HD 4600 (4 threads, ANGLE/D3D11),
cold profile per run, normal play (UI and intro up, Enter clicked after 2 s) unless noted. Format: **choice** — why —
alternative. Scripts used: `src/render/dev/kodesh-split.mjs`, `src/render/dev/room-cost.mjs`, `tools/warmup-check.mjs`.

**Measurement conditions.** The Mystify screensaver still ran, and during the second half of the task other processes
held 80–87 % of the CPU with this app closed. Absolute boot times therefore drifted by 1–3 s between batches; every
decision below rests on interleaved cold runs (this task vs perf-fix-1, same batch) or on interleaved variants in one page.

## What the "synchronous link stalls" are (finding 2)

- **A synchronous WebGL query waits for the GPU process to finish everything queued before it; around the first view
  that queue is the first frame's own GPU work.** A GPU-process trace (Chrome tracing, `CrGpuMain`) shows the GPU main
  thread 97–107 ms busy in every 100 ms window from the first frame on. Removing the first query only moves the wait to
  the next one: with three's shader checks on, the first frame waited 298–443 ms in `getProgramInfoLog`; with them off,
  366–518 ms in `getProgramParameter(ACTIVE_UNIFORMS)` (three's uniform scan); with the uniform scan also done early,
  300–420 ms in env's `getUniformBlockIndex` one frame later. No variant changed the first view's time beyond the noise
  (3 × 2 interleaved runs).
- **Kept anyway, as hygiene:** `renderer.debug.checkShaderErrors` off in the production bundle (`?shadercheck=1` turns it
  back on; dev keeps it) — three fewer synchronous queries per program; each program's first use (`getUniforms`) and env's
  fog / interiors-block binding (`ctx.env.bindPrograms()`) done in the warm-up poll as programs link (both only with
  KHR_parallel_shader_compile; without it a query links the program on the spot, so the first frame does it as before).
  The baker keeps its fallback for a generator that fails to link: it queries the link status itself, once per
  program, *before* the program's first draw (after the draw the query waited for the bake to run on the GPU).
- **The fix that paid: the later material groups start at the first view, not at 'ready' (normal play).** Their ≈ 25
  generator programs (`world/materials` LATER_GROUPS) were issued at 'ready' and linked alongside the first view's
  programs, and their bakes, queued in the warm-up's idle callbacks, ran on the GPU inside the first drawn frame.
  Disabling them (flag, 2 runs) cut 'compiled' → first frame from 448–947 ms to 106–197 ms. Deferred to 'firstFrame':
  'compiled' → first frame 63–435 ms (perf-fix-1: 114–925 ms); first view 14.81 s vs 15.79 s mean over 6 interleaved
  pairs (low spawn / Azarah, loaded machine). In a screenshot they still bake at 'ready'. The intro covers the view while
  they bake (5–12 s after the view); their programs are issued one per idle slice (`baker.compileGroup(i, pace)`), so no
  single task creates them all. The final `baker.sync()` read-back (a full GPU drain, 0.36–0.45 s frames 5–6 s into play)
  now runs in screenshot mode only — GL frees the released scratch targets once the queued bakes are done with them.
- **Tried and reverted:** uploading every texture during the warm-up (`renderer.initTexture`; 3 × 2 runs: no change);
  drawing each material into one pixel as soon as its programs linked, so the driver's first-draw work overlapped the
  remaining links (3 × 2 runs: first view 0.7 s *later* — that work runs on the GPU process's main thread, which the
  link polling also needs).
- **What remains, and is reported now:** the GPU still needs ≈ 0.45 s (low) to ≈ 1 s (medium–ultra: shadow maps, the
  probes' first capture, N8AO) after 'firstFrame' to finish the first frame; the frame after it waits in its first
  synchronous query. New `bootTimes.firstImage` (a fence polled without blocking) marks when the first frame is on
  screen; `tools/warmup-check.mjs` reports the worst frame and the synchronous calls over 50 ms in the 5 s after the view.

## Low tier: spawn and Kodesh frame rate (finding 1)

- **The event tags' pulse is a compositor animation (`ui/styles.css`).** In-page A/B at the low spawn (normal play,
  fixed resolution): hiding the UI 42 → 54.5 fps; only stopping the tags' pulsing dot 42 → 53. The pulse animated
  `box-shadow`, which repaints every tag on every frame. It is now a ring (`::before`) of the same size, colour and timing
  animated by `transform` and `opacity`: 43.2 → 47.9 fps (4 interleaved pairs, one page). Frozen at 8 points of the cycle
  the old and new tag differ by ≤ 0.08/255 mean, ≤ 0.23 % of pixels over 8/255 (the dot's antialiased edge; the ring is the
  dot's own gold, so drawn over it it changes nothing). The map list's "Happening now" dot uses the same ring.
- **The spawn has no "first 30 s" effect:** one page, fps every 5.5 s from 7 s to 70 s after the view: 38.7 → 42.7
  (before the pulse fix), i.e. steady; the review's 48.6 at +35 s came from a script that replaces the frame loop.
- **Low Kodesh: lower bound measured, no approximation shipped.** Normal play, fixed resolution, in-page interleaved:
  full 41.5–44.8 fps; env's room path compiled out (MK_NO_ROOMS on every world material) 57.5–58.4; the frame time
  sits on the vsync boundary (median 16.7 ms, 90th percentile 33.8 ms: 30–40 % of frames miss the interval). GPU timer,
  shot mode: frame 13–18 ms, room path 1.5–4.5 ms of it; people ≈ 0, the two fire lights ≈ 1.5 ms. Taking out one part
  of the room path at a time (temporary defines, 2 interleaved reps): sun mask 47.9, reflection exit test 49.6, lamp fill
  45.8, fire occluders 47.5, second-room test 47.6, aperture sky visibility 45.5 vs full 44.8 — each within the run noise
  (± 3 fps), and each changes the image: the sun mask is what keeps sunlight to the window patches by day, the exit test
  is what makes the gold walls reflect the windows, the lamp fill is the room's night light. None is negligible, so none
  ships; the low tier's adaptive resolution holds 60 fps there (scale 0.5–0.9). Cold runs of this build at fixed resolution:
  44.3, 46.1, 46.6, 46.4 fps (perf-fix-1 in the same batches: 44.0, 44.4, 46.1, 40.7; HEAD 27.0, 28.1).

## Medium shadow cache and the material bakes (finding 4)

- **The cache's signature includes the number of texture-set bakes (`ctx.mats.stats.bakes`, new).** The later groups
  bake into the same textures after the first view, and an alpha-tested caster (the olive cards' leaves) changes its
  shadow without any geometry change. Any bake now re-renders the cached depth on the next frame. Verified (medium Azarah,
  normal play, 40 s): every bake batch is followed by one re-render (bakes 16 → re-render 4, 41 → 5, 48 → 6, 56 → 7,
  63 → 8, all by 11.5 s); then one per ≈ 12 s as the Sun moves. Alternative: per-caster alpha map `texture.version` —
  the baker draws into render targets, whose texture version does not change.

## High / ultra draw-call peaks (finding 5) — not changed

- Skipping the pre-pass on frames that re-render the fires' cube shadow maps would remove ≈ 100 calls from those frames
  (1029 → ≈ 930 at the high spawn, still over the ≤ 900 budget, which HEAD already exceeded at 924) and make exactly
  those frames slower on the GPU (the pre-pass gives high +20–55 % fps). Left as is; the ruling on whether shadow and
  pre-pass passes count toward ARCHITECTURE's budget is requested of the orchestrator.

## Enter click (finding 7)

- **The Enter freeze is the AudioContext constructor.** CPU profile of the 1.5 s after the click (2 cold runs): the
  constructor 354–675 ms of self time; frame ticks ≈ 470–535 ms spread over the normal frames; nothing else above 110 ms.
  The constructor is a synchronous IPC to the browser's audio service: ≈ 105 ms in a blank page on this machine,
  300–1000 ms in the app with the machine loaded. It must stay in the gesture (iOS; Chrome's autoplay warning), and nothing
  else in the Enter frame is large enough to move. Tried: pre-warming the audio service with
  `navigator.mediaDevices.enumerateDevices()` (blank page: 40, 130, 54 ms vs 104, 109, 103 ms — inconclusive; a device
  enumeration is also a fingerprinting surface): not adopted.

## Remaining (measured, not changed)

- Medium boots no faster than perf-fix-1 (interleaved: 27.2–32.6 s vs 27.6–31.5 s); its warm-up is dominated by the
  first view's own 86 programs. On low the first view is 0.5 s earlier on average (18 interleaved pairs over three
  batches: 14.71 s vs 15.20 s mean; 13.7–16.8 vs 14.1–17.5).
- In medium play, each later-group program issued after the view costs one 57–92 ms frame: env's interiors-block binder
  queries every new program (`gl.getUniformBlockIndex`), and the query waits for the GPU's queued frame. Skipping the
  generator programs there would need a reliable "declares the block" test (three keeps no shader source); not done.
- High / ultra: env's asynchronous statistics read-backs (`getBufferSubData`) wait 0.4–0.8 s in the first 3 s of play,
  when frames are 100–200 ms of GPU each (pre-existing).

## Tools

- `tools/warmup-check.mjs`: one production build; every tier (low, medium, high, ultra) in both boot modes (shot,
  play), each a cold browser. Fails on a material with two programs, a 'compiled' → first-frame gap over the tier's limit
  (low / medium 1 s; high / ultra 2 s: their shadow passes' depth programs link in the first frame, 0.5–1.1 s on an idle
  machine and 1.9 s with the CPU loaded), any shader info-log read after 'ready', or console warnings. Reports the worst
  frame and the synchronous GL calls over 50 ms in the 5 s after the view.
- `src/render/dev/kodesh-split.mjs` (GPU time with parts switched off), `src/render/dev/room-cost.mjs` (GPU time of
  room-path variants by string edit).

## Results

Cold, production, normal play; final batch interleaved HEAD / perf-fix-1 / this task (HD 4600 with the screensaver and
other processes at 80–87 % CPU: every boot is 1–3 s slower than in perf-fix-1's runs; compare within a row).
'img' is the new bootTimes.firstImage (the first frame finished on the GPU).

| metric | HEAD | perf-fix-1 | perf-fix-2 |
|---|---|---|---|
| first view low spawn / Azarah / Kodesh (s) | 53.6, 56.2 / 51.1, 52.8 / 49.8, 50.6 | 15.2, 17.5 / 14.4, 14.9 / 15.2, 15.3 | 13.7, 16.8 / 14.6, 15.6 / 15.4, 14.2 |
| … earlier batch, low spawn + Azarah, 6 pairs (s, mean) | — | 15.79 | 14.81 |
| firstImage − firstFrame, low / medium / high / ultra (s) | — | — | 0.42–0.58 / 0.5–1.3 / 1.2–1.7 / 2.0 |
| 'compiled' → first frame, low (ms) | — | 114–925 | 63–435 |
| first view medium spawn / Azarah / Kodesh (s) | (113–119, review) | 28.8, 27.9 / 27.6, 28.1 / 31.5, 28.4 | 29.1, 28.1 / 28.8, 27.2 / 32.6, 27.3 |
| first view high spawn / Azarah (s) | (182–194, review) | 41.6 / 40.8 | 39.7 / 40.4 |
| first view ultra spawn (s) | (235, review) | 49.3 | 48.4 |
| programs at +20 s, low / medium / high / ultra | 72–75 / 90–94 / 111 / 114 | 69 / 86 / 98 / 102 | 69 / 85–86 / 93–95 / 90 |
| programs at the first view, play (warmup-check) low / medium / high / ultra | — | — | 55 / 72 / 75 / 79 |
| fixed-resolution fps low spawn / Azarah / Kodesh | 36.6, 32.6 / 24.6, 25.5 / 27.0, 28.1 | 49.6, 40.4 / 56.4, 55.8 / 44.0, 44.4 | 52.7, 51.4 / 56.6, 53.1 / 44.3, 46.1 |
| fixed-resolution fps medium spawn / Azarah / Kodesh | (10.3–11.6, review) | 18.4, 18.9 / 20.5, 20.3 / 17.6, 17.7 | 20.0, 20.3 / 20.2, 20.5 / 18.6, 18.2 |
| fixed-resolution fps high spawn / Azarah | (7.6, review) | 8.3 / 7.7 | 8.6 / 7.9 |
| frames drawn in the 20 s after the view, low spawn (adaptive) | 664, 733 | 680, 655 | 950, 969 |
| adaptive median fps low / medium / high / ultra | 60 / 30 / — / — | 60 / 30 / 10 / 5 | 60 / 30 / 10 / 5 |
| frames > 100 ms in 20 s after the view, low (all views) | 7–14 | 12–18 | 7–17 |
| frames > 100 ms, medium | — | 13–27 | 15–29 |
| Enter frame (≈ AudioContext constructor), low (ms) | 366–534 | 434–2319 | 234–968 |
| draw calls low spawn / Azarah / Kodesh | 177 / 149 / 87 | 256 / 223 / 141 | 256 / 223 / 141 |
| draw calls medium spawn / Azarah / Kodesh | — | 331–429 / 298 / 193 | 331 / 298 / 193 |
| draw calls high spawn / Azarah (one frame) | — | 1029 / 589 | 1029 / 589 |
| console warnings / errors (app) | 0 | 0 | 0 (one transient net::ERR_SOCKET_NOT_CONNECTED from the preview server in 1 of 36 runs) |
| visual vs HEAD, 9 views × low / medium / high (shot mode) | — | ≤ 0.35/255 except night (review) | ≤ 0.36/255 except Azarah night low 3.03, medium 1.66 (0 % of pixels > 8/255: run-to-run spread of the same build is 0.2–3.2/255 there) |

warmup-check (all tiers, both modes, final run): PASS. Low play 13.1 s (+212 ms), medium play 26.0 s (+583 ms), high
play 39.6 s (+987 ms), ultra play 47.8 s (+1088 ms); every first view's following frame waits 0.3 s (low) to 1.07 s
(high) in one synchronous query for the first frame's GPU work.
