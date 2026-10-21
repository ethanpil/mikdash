# render-audio-3-fix — decisions

Review of render-audio-3 (five low findings). Owned: `src/render/**`, `src/env/**`, `src/audio/**`. Corrections to
render-audio-3's own entries are made in place in `render-audio-3.md` and marked "Corrected in render-audio-3-fix".
Shots: `shots/render-audio-3-fix/` (`after-high`: the review's views from `shots/render-audio-3-review/review-views.mjs`;
`wip/beam-{before,after}`: the beam test's per-frame cost, measured with `wip/beam-cost.mjs`, run by
`src/render/dev/session.mjs`; `wip/share`: the Kodesh sky share through a morning).

## 1 The rough-reflection scale reached the Ulam — gated to the Kodesh

- **`rad *= mix(1, vr, smoothstep(0.35, 0.8, roughness))` now runs only for a probe in the 'main' mode (interiors-glsl.js,
  `mq > 0.5`).** The scale was measured and fitted in the Kodesh only. render-audio-3 applied it to every probe with a V
  reference, which included the Ulam's 'total' mode, so the Ulam's rough stone followed V/V_probe (≤ 1.5) as well. That
  contradicted the log's "the Ulam keeps render-env-2's rule exactly", and no Ulam A/B had been taken. — Alternative:
  keep it in the Ulam (physically plausible: the review found its north wing darker) and document it. Not taken: it
  is unmeasured there, and the Ulam's porch light was calibrated by render-env-2 without it.
- **Check (high, the review's views and script, `after-high`):**
  - ulam-wing-d3 against the review's matched "before" tree: mean |Δ| 0.00, 26 pixels > 10 levels (against its
    "after": 3.34 and 152 k);
  - ulam-in-d3: everything outside the great gate matches "before". The 45 k pixels that differ are all inside the
    Kodesh seen through the gate (its coffers and floor: the intended correction);
  - kodesh-parochet-d3 / -d9 / kodesh-east-d3 against the review's "after": mean |Δ| 0.01 / 0.00 / 0.03 (Kodesh
    unchanged);
  - tools/shot.mjs high kodesh-parochet and olive-15m: identical to render-audio-3's `after/high`; low identical to
    `after/low`.

## 2 The broken pot's citation

- **"An earthenware vessel in which it was cooked shall be broken" is Lev 6:21; the breaking in a holy place is Mishnah
  Zevachim 11:4 (11:5 for a pot taken outside the curtains). 11:7 is the scouring and rinsing.** Checked against
  the local Bavli (`sources/Zevachim - he - merged.txt`: 11:4 "ושבירת כלי חרס במקום קדוש"; 11:7 "...טעונין מריקה
  ושטיפה") and Sefaria's mishnah numbering. Fixed in foley.js, library.js, audio/index.js, synth/index.js,
  pot-break-test.mjs and render-audio-3.md §5. The cue still belongs to the scouring scene (11:7).
- **sim's scouring caption (`src/sim/choreo/courts-daily.js`, not this task's file)** quotes Lev 6:21 and cites
  "(Zevachim 11:7)". That is a request below.

## 3 The Kodesh sky share's documented timeline

- **Corrected (probes.js `skyShare` comment, render-audio-3.md §3), with no change in behaviour.** The share is not 0 from
  sunrise. It is ≈ 1 until the Sun clears the Mount of Olives, then 0 within one refresh until about + 90, eased back by
  + 130. The beam fraction is × `env.sunTerrainVisibility`, which env evaluates at the camera's height (the key light the
  capture is lit by does the same), so the share is a function of the capture's time and of the camera's place, not of
  time alone. Re-measured from inside the Kodesh (medium, `kodesh-share-times.mjs`, `wip/share`): 0.98 at sunrise + 10
  and + 15; 0.08 at + 20; 0 at + 30 and + 60; 0.01 at + 90; 0.31 / 0.56 / 0.92 / 0.98 at + 100 / 110 / 120 / 130;
  1.00 at + 150 and d3; 0.97 at sunset − 10. The review's table from the Kidron floor (`share-vs-camera.json`): 0.99
  to + 30, 0 from + 40. The deep-beam fraction comment was stale too (0.22 / 0.12 at + 100 / + 120; measured 0.19 / 0.05).
- **Kept the camera-height visibility, not the probe's.** The capture is lit by env's key light, which carries exactly
  that visibility: a share computed from the probe's own horizon would claim a beam the capture does not contain.
  Clock jumps re-capture, and the sim's jumps.js stays deterministic.

## 4 The beam test as a job (time-lapse hitch)

- **`skyShare` is a generator: it takes the Sun, its terrain visibility and the openings' openness when it starts (a
  refresh's first face) and yields after each row of rays. `stepShare` runs SHARE_SLICE_MS = 1 ms of it per face frame
  and the rest before the capture is applied. A sync capture (after a jump) runs it at once.** The result does not
  depend on the slicing. `finish` now holds the share of its own capture, since a deferred apply can land after the next
  refresh has begun.
- **Measured (medium, camera in the Kodesh, the rays timed by wrapping `ctx.physics.raycast`, a refresh forced at the same
  paused time; `wip/beam-before`, `wip/beam-after`):**
  - before: one frame carried all of it: 5.1 ms (203 rays) at sunrise + 40, 3.7 ms at + 110, 1.4 ms at d3, 0.3 ms at d9;
  - after: at most 2.3 / 1.8 / 1.2 / 0.4 ms in any frame (that includes the ≈ 6 rays a frame of other callers),
    spread over 4–5 face frames;
  - share and beam fraction bit-identical before and after, sync and amortised (e.g. + 110: 0.5572623871 sync,
    0.5572625657 amortised, both runs).
  The review's "15 ms" came from render-audio-3's first note; the measured worst case is 5 ms. — Alternatives: a cache
  per Sun-direction bucket (no hits within one morning: each refresh is a new 2–3° step); a 4 × 4 gate grid (changes the
  result, and only halves the cost); skipping the test in a time-lapse (stale share through the morning).

## 5 The parochet / gold-wall ratio

- **Recorded in render-audio-3.md §3: the fix dims the parochet and the gold walls alike, and that is expected.** In
  the review's matched A/B on high: d3 parochet Y 0.173 → 0.126 (L* 48.6 → 42.1), walls 0.103 → 0.078, ratio
  1.69 → 1.61; d9 1.64 → 1.55. In that view the walls are seen at grazing angles and mirror the room's far end, which
  the fix dimmed as well, while the curtain faces the gate. Their ratio is set by that geometry, not by a mismatch
  between the light terms. The "diffuse and specular disagree ~10×" premise is refuted by the probe itself: its
  roughness-1 level reads 1226 cd/m² toward the gate, against 1271 by cosine integration of the same cube.
- **Low stays a tracked env follow-up.** Its curtain reads L* ≈ 20 against 42 on high, pixel-identical before and after.
  Low has no probes; its fill model (light from the openings × V × a gold gain) needs calibrating against these captures.

## Requests

- **sim (scouring caption, courts-daily.js:733):** cite "(Lev 6:21; Zevachim 11:4)" for the broken earthenware pot. The
  Hebrew is Lev 6:21. 11:7 is the scouring itself and can stay on the scene's other text.
