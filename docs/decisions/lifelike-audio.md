# lifelike-audio — decisions

Small additions that make the ambience less static. Format: **choice** — why — alternative. Checks:
`node src/audio/dev/lifelike-test.mjs [--tier low|high]` (offline, no browser). Nobody has listened to these yet:
the numbers below are measured, the impression is not.

## What existed (not redone)

The ambience director already carries the pyre and the hearths (per fire, following fx's intensity), the nearest
torches, the amah's water at its open stretches, the lambs in their chamber, doves by day, crickets by the night's
temperature, three crowd areas by population and the ketoret's hush, per-space reverbs and the outdoor beds muffled
indoors. The sim cues the animals of the offerings (bleats, the doves at Nikanor), the muchni's water and the night
watch's steps. So the thin spots were the wind (one level all day, a 20 s loop that repeats its gusts) and the
visitor's own movement (silent).

## Wind that follows the gusts, the hour and the weather (ambience.js `windShape`)

- **The wind bed's gain is multiplied by a pure function of the sim's absolute time: two octaves of value noise
  (37 s and 13 s) of sim seconds, −2.7..+3.3 dB.** — the bed is a 20 s loop whose own gusts (0.07 Hz) repeat audibly;
  a slower level line that never repeats hides the period; a function of sim time keeps the clock scrubbable — a longer
  loop (render time and memory on every tier).
- **The gusts flatten when the clock runs fast (none at ≥ 30×).** — the director ticks every 0.5 s of real time; at 60×
  that is 30 sim-seconds per tick, so the level would only jump about — as the clouds' opacity drops above 60×.
- **An afternoon breeze: +2 dB from about 5 h after sunrise until an hour after sunset.** — Jerusalem's sea breeze
  reaches the hills around midday and calms after dark; reconstruction from the modern climate, not a source.
- **A day with cumulus (env's clouds: `ctx.env.clouds.uniforms.uCuUV.value.w`, 0..0.16) up to +3 dB.** — the weather is
  already a pure function of the date there (the early-rain season and winter bring cumulus, summer none); read only,
  so sound and sky agree without a second weather model — an independent per-date wind draw.
- Measured (autumn day, clear): range over the day −2.5..+5.1 dB; largest change between two 0.5 s ticks 0.19 dB (and
  `setGain` ramps over 2 s: no zipper); mean 04–06 h +0.4 dB, 14–16 h +2.5 dB, +5.5 dB on a cumulus afternoon; gust
  range at 60× 0.0 dB. The wind's synthesis is unchanged (bed RMS −20 dBFS, centroid 109 Hz on low). Cost: a few
  float ops every 0.5 s.
- Not verified: how the gusts feel at the ear, and whether +5.5 dB on a cloudy afternoon is too much for a bed of
  43 dB SPL (at its loudest it stays ≈ 6 dB under the court crowd heard from 10 m by day).

## The visitor's own bare feet, on the pavement and on stairs (ambience.js `updateSteps`, foley.js `footsteps`)

- **One barefoot step per stride the visitor walks (0.72 m; 0.9 m running), played at the feet as the existing
  `footsteps` cue with `steps: 1`.** — walking through silent courts felt like floating; barefoot because no one entered
  the Mount in shoes (Berakhot 9:5) and the existing cue is already the bare foot on stone (Zevachim 24a) — a separate
  synth (none needed).
- **Only on the ground, not in flight, not above 4.5 m/s (fast travel) and not across a camera jump (> 1 m drop or a
  teleport); standing still is silent.** — the step must belong to a body walking.
- **A stride with an abrupt height change of the feet (> 0.1 m in one frame and steeper than 0.6) is a step on a stair:
  `surface: 'stair'` renders a heavier, darker foot set down flat (heel thump ×1.5 at 170 Hz, less toe roll, no grit
  scuff).** — the half-amah stairs snap the controller's feet up or down; a ramp (the kevesh, 9 in 32) changes height
  smoothly and keeps the pavement step — the controller's own stairs estimate (player/, not mine to change).
- **Level: the cue's 56 dB SPL less 10 dB, alternate feet −1 dB.** — a barefoot step heard from 1.6 m is quiet: it
  should sit at the night wind's level and well under the crowd by day.
- `surface` joins the cue's `synth` keys; an undefined surface leaves the existing renders' cache keys (and their bytes:
  the rng sequence of a multi-step render is unchanged) as they were. The `?debug=audio` panel has "my step" buttons.
- Measured (low, 32 kHz; high agrees within 0.4 dB): single step 1.06 s, peak −1 dBFS (the peak cap, so the loudest
  400 ms is −21.8 dBFS pavement / −18.9 stair, under the −16 target), DC < 3e-10, first sample 0 and the last 64
  samples < 3e-11 (no clicks); centroid 537–756 Hz pavement, 179–231 Hz stair (60–73 % of the energy below 300 Hz).
  At the ear: pavement −50.7 dBFS, stair −47.8 dBFS (loudest 400 ms); the wind bed −51.9 dBFS RMS by night, −48.2 by
  day before its gusts; the court crowd from 10 m −36.5; the pyre from 20 m −36.8 — the steps sit with the night wind
  and 14 dB under the day's crowd.
- Cost: per frame a few scalar reads and compares (no allocation); one cue (a voice for ~1 s) per stride, 8 cached
  buffers of ~34–50 KB.
- Not verified: the feel at the ear (cadence, whether the stair thump reads as a stair), and the stair test against the
  live controller on every staircase (frame rate, the auto-walk's path following): checked only by reading the
  controller's step-up code, not in play.

### The steps in play (src/audio/dev/steps-play.js)
- Run with the real controller, the real frame loop and a running AudioContext (low, SwiftShader, ~3–5 s a frame, so
  every frame's dt is the engine's clamp, 0.1 s; the player moves by the same dt, so nothing bunches or goes missing):
  `node src/sim/dev/run.mjs --q low --timeout 900 --keep-ui --script src/audio/dev/steps-play.js ""` (shot mode turns
  audio off; the script enables the input the welcome card holds off and wraps `engine.cue` to count). Measured:
  - level walk (W on the Mount's plaza): 15 cues in 11.15 m and 5 in 3.84 m (1.30–1.35 a metre; 1/0.72 = 1.39 less the
    first stride after a start), none 'stair';
  - level run (Shift+W, 4.5 m/s): 9 in 8.61 m (1/0.9 = 1.11), none 'stair' — not dropped by the 4.5 m/s jump gate,
    since the controller's speed approaches 4.5 from below and the player moves by the same dt the gate uses;
  - the twelve Chel steps from their foot (2.87 m walked, +2.88 m): 3 cues, all 'stair' (the first stride starts at 0);
  - standing after release: 1 cue in the 0.63 m the body coasts, then none; 3 teleports: 0; fly (10 frames up and
    forward): 0; landing from 4 m: 0;
  - auto-walk (`goTo(…, 'walk')`, mode 'auto', grounded every frame): 3 in 2.71 m, none 'stair'.
- So no change to `updateSteps`. Known, left: a `goTo` with `way: 'run'` (only the trip test uses it) keeps the 0.72 m
  stride, since `running` reads the Shift key; a trip at pace ≥ ~3.3 walks faster than the gate and is silent.
- Still not verified: the feel at the ear, the other staircases, and frame rates between 10 and 60 fps on a real GPU.
