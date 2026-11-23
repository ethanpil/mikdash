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
