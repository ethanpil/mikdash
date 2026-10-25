# gate-core-r2 — decisions

The gate re-check's core finding: play froze for 1–10 s in the first seconds after Enter, while gate-core's post-boot
queue was still linking programs, and warmup-check measured only the first 5 s after the first view. Format:
**Choice** — why — alternative. Measuring scripts are in the scratchpad (`r2/drv.mjs`: the gate's `bootmid` with every
`linkProgram` after 'ready' logged with its caller, each program's issue / observed link / first use, and the unlinked
programs per frame); production bundles, HD 4600, Edge, nothing else on the GPU.

## What froze

- **Reproduced** (low, default start, Enter as soon as the intro is up): 7.6 s, 0.85 s and 2.0 s worst frames in three
  runs; high 7.0 s / 10.7 s (the gate's runs).
- **No frame drew a program before it linked** (every post-boot program's first `useProgram` came after its observed
  link). The frames waited on the GPU process: each freeze ended exactly when queued links completed.
- **Too many programs were linking at once.** compileLater counted queued objects, not programs (an object or a
  people warm-up child can make several; `made` missed a program created while another was released): 3–5 of its
  programs were pending at once. The material baker's later groups (`Baker.compileKinds`, ≈ 25 generator programs from
  'firstFrame', one kind per idle slice) issued on their own beside them: up to 8 more. ANGLE links on (logical cores
  − 1) worker threads, 3 on this i5-4690K. A program issued while all 3 are busy blocks the GPU process's main thread
  until one frees (ANGLE resolves the shaders' compile in linkProgram). Every frame, the compositor and every
  synchronous query wait with it. Each freeze began with a queue or baker issue while ≥ 3 were pending.

## Fix

- **compileLater budgets unlinked programs, all of the renderer's** (render/warmup.js `pendingPrograms`: three caches a
  linked program's `isReady`, so only pending ones are queried), not objects. A frame's own programs and any other
  caller's count too. A program pending over 60 s no longer counts (a driver that never reports completion).
- **The limit is logical cores − 2 (2 here, at most 3)** (main.js `backgroundPolicy.limit`): one worker stays free for
  a program a frame needs at once. **0 for 2.5 s after Enter** (ENTER_QUIET_MS; the intro's close is watched from the
  first view, because the queue may first pump after it). — Alternative: 1 while the visitor is past the intro (the
  gate's suggestion). Measured on the same build pair, high: worst frames 1.30 / 0.94 / 0.81 s with 1 against 0.92 /
  0.89 / 0.77 s with 2, but the hidden world surfaces were shown at +63 s against +43 s after the first view. Low with
  2: worst 0.21–0.24 s, shown +10 s (1: +15 s). The frozen frames came from 5–13 pending, not from 2. 1 only delays
  surfaces the visitor may walk up to.
- **The baker's post-boot generator programs go through the same queue** (world/materials: `baker.gate`, set at
  'firstFrame' in play; `compileKinds` issues through it; `prepareRest` issues one kind per entry when gated). A
  screenshot boot is unchanged (everything at 'ready').
- **Priorities in the one queue**: 0 the deferred world materials (surfaces missing until shown), 1 the baker's later
  groups (surfaces flat until baked), 2 hidden meshes (warmHidden) and the people's variants (the default: people/ is
  unchanged). In call order within a priority. — Alternative: hold the people's variants until 'shown' (the gate's
  suggestion). The priority does that where it matters, without a second mechanism.
- **A screenshot boot has no limit** (it waits for everything and nothing moves; ANGLE links in issue order, so the
  deferred world, queued first, still comes first). With the global count it was capped at 2 (or 3) while the people's
  own detail programs, released at the first frame (5–11 s each on high), filled the slots: high / ultra shot missed the
  30 s reveal.
- **After the reveal the probes re-capture amortised** (env/probes.js `refresh()`, a 1-line addition: every idle probe
  queued as when the Sun has moved, one face a frame). The full sync capture that warmDeferred requested made one
  frame of 1 s on high and 2.2 s on ultra (warmup-check: `a 2219 ms frame in play at +51325 ms`, right at shown). A
  screenshot keeps the sync capture (it is taken a few frames after). Verified: 8 captures, all 4 probes valid after the
  drain on high; the after-drain play view matches the gate's bundle (`shots/gate-core-r2/*-high-play-drained.png`).
- **bootTimes.drained**: the queue empty and every program linked, held for 3 s (the baker paces its kinds by idle
  slices, so the queue empties between them).

## warmup-check

Play now does what the gate did: Enter as soon as the intro is up, then frames are recorded from the first view until
`drained` (cap 240 s). It reports `worst frame in play` (the frame Enter fell in left out, see below) and fails over
PLAY_WORST_MS (low / medium 1.5 s, high / ultra 2 s) or when nothing drained. The 5 s figure stays as it was.

## Results (production, HD 4600; worst frame after Enter, the Enter frame aside)

| run | before | after |
|---|---|---|
| low, default start (×3 before, ×2 after) | 7.6 s / 0.85 s / 2.0 s | 0.20 s / 0.20 s |
| low, 22:00 at 60× | 7.4 s (gate) | 0.46 s |
| high, default start | 7.0 s / 10.7 s (gate) | 1.14 s (env probe read-back, below) |

Max unlinked programs after the first view: 13 → 2. Hidden world shown (after the first view): low +6.6 → +9.4–10 s,
high +24 → +42 s (the visitor walking; behind the intro it is shorter). Drained: low ≈ +30 s, high ≈ +87 s. Console
clean.

`node tools/warmup-check.mjs` (final code; high / ultra play re-run after the probes change): ALL PASSED.

| tier | first frame play / shot (s) | worst frame in play (after Enter … drained) | shown play / shot | drained |
|---|---|---|---|---|
| low | 13.5 / 14.6 | 0.47 s | +9.8 / +4.8 s | +29 s |
| medium | 23.5 / 24.5 | 0.72 s | +27.6 / +18.2 s | +47 s |
| high | 31.0 / 32.7 | 1.09 s (+1.2 s, before Enter) | +42.7 / +25.4 s | +89 s |
| ultra | 39.2 / 39.2 | 1.34 s (+2.3 s, before Enter) | +48.5 / +32.3 s | +97 s |

The first-view numbers are unchanged from gate-core (this task changes nothing before the first frame). SHOWN_MS is
now per mode: shot 30 s (ultra 45 s: the gate's own bundle showed ultra's 48 materials at +30.4 / +30.6 s, this code at
+31.9 / +32.7 s), play 60 s.

Before / after, same views (`shots/gate-core-r2/`, before = the gate's bundle): dawn start in shot mode, low and high;
play after the drain, low and high. No visible difference beyond the other fixers' round-2 floor tint.

Other harnesses: build OK; validate-schedule no gaps; coverage longest gap 7 min; nav-coverage `--q low` all
reachable; sim `jumps.js` deterministic, `views.js` ok, `firstnight.js` ok. `midnight.js` is flaky at its 100 ms limit
(1 of 3 passes; failing frames 110–148 ms with the sim at ≤ 1.7 ms). It records from shown + 6 s, while on low the
people's variants are still linking. A copy that waits for `bootTimes.drained` passes the midnight segments every time.
Its date-picker segment (10:00 next day) then exceeds the limit by 0.4–13 ms with no background work left. `uitest.mjs`:
the phone section is timing-flaky on this machine, before this change too (baseline 1 failure in 3, this code 4 in 6:
a 30 s goto timeout, the 9 s touch-hint timer, a 500 ms fade). The phone page boots while the desktop page, reloaded at
medium, is still linking (now ≈ 45 s, rate-limited). With one line, waiting for the desktop page's
`bootTimes.drained` before the phone page, it passed 3 of 3.

## Not mine (requests)

- **env**: probes.js gained `refresh()` (above), the only edit outside my files; please keep it.
- **env, probes**: `readRenderTargetPixelsAsync`'s `getBufferSubData` blocks 150–280 ms every ≈ 2.7 s on high for the
  whole run, after the queue has drained too, and once 1066 ms (the 1.14 s frame above). The read-back waits for
  every GPU command queued after its fence. Delay the read one or two frames after the fence, or meter less often on
  slow frames.
- **ui**: the frame that dismisses the intro takes 0.45–0.6 s on low, before and after this change, with no main-thread
  samples in a CPU profile: a compositor / GPU cost of the HUD and hints appearing as the intro fades.
- **sim**: `src/sim/dev/tests/midnight.js` should start recording at `ctx.bootTimes.drained` (new), not shown + 6 s.
- **ui**: `src/ui/dev/uitest.mjs`, before the phone page: `await page.waitForFunction(() => __mikdash.bootTimes.drained > 0,
  null, { timeout: 200000 })`. Also still open from gate-core: settingspanel.js reload() should call core/resume.js
  `reloadHere(ctx, { edit, delay: 250 })`.
- **orchestrator (ARCHITECTURE.md §14 Boot, §15)**: bootTimes now has `unseen`, `shown` and `drained`. Post-boot compiles
  go through render/warmup.js compileLater (an unlinked-program budget). warmup-check's play mode presses Enter and
  measures until drained.
- **sim**: the gate's 720 ms sim frame on high (the plan job's final re-pose) did not recur in 3 high runs here (sim
  ≤ 2.1 ms); spreading that re-pose over frames is the sim owner's call.
