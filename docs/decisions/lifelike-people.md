# Lifelike people and animals (idle life)

Three small changes so that waiting figures and animals read as alive. All three are baked clips (people/clips.js,
people/animal-clips.js): the motion is a function of the clip phase, which is a function of sim time and the figure's
own phase offset, so it scrubs and repeats exactly. No per-frame code, no shader, no new program, bones unchanged.

## 1. Animals: three idle variants of `stand` and `stand_halter`
- Choice: `QUAD_CLIPS['stand~1..3']` and `['stand_halter~1..3']` (animal-clips.js `IDLE`, `quadIdle`), picked per
  animal by its seed through the existing `CLIP_VARIANTS` / `variantOf` path (`stand_halter: 3` added). Each is an
  11–15 s loop of 48 frames: breath (≈ 3 s), one or two looks aside (13–20°) and back, each ear flicking on its own beat,
  one tail swish (≈ 1.5 s), and in variant 2 the nose lowered toward the paving and lifted (≈ 15 cm at the lamb's poll;
  only a dip on a halter, whose head moves 0.6× as much — the lead is held short). The base idle's right ear, held
  still before, now flicks too.
- Why: every animal of a kind ran the same 10 s, 24-frame loop with one ear moving; the individual offerings keep
  animals waiting on halters through the day, side by side.
- Alternative: chewing the cud (the rig has a jaw) — dropped: a 1.3 Hz chew needs ≥ 5 frames a second over the whole
  loop (≈ 70 frames more per clip) and is invisible beyond a few metres. Per-figure procedural offsets on the GPU were
  ruled out (new uniform/attribute path, re-keyed programs).
- Cost: +288 frames per quad rig (+864 for lamb/ram/goat at boot, ≈ 10 ms each in the prebake worker;
  `node src/people/dev/bake-stats.mjs`), ≈ 0.75 MB more half-float atlas for the three boot rigs. Per frame: none.
- Evidence: `node src/people/dev/idle-probe.mjs lamb stand~1,stand~2,stand~3,stand_halter~2` — loop seams 0.00 cm,
  largest step between baked frames 1–4 cm (lamb), head yaw sweeps 5 → 25 → 5° (stand~1), −4 → −21 → −4° (stand~2).

## 2. Standing people glance aside and back
- Choice: `stand`, `stand~1..3` and `stand_hold` now hold two of their former 8 s sway-and-breath cycles (16–20 s,
  48 frames, the same rates) and once a loop the head turns 12–15° (neck 45 % of it) for ≈ 1.5 s and back (`glance()`),
  each variant at its own phase, toward the side it is not already facing (so it reads as looking across at something,
  not turning away from his place). The pitch during it is 1–3°.
- Why: the head was held within ±2.4°: a waiting crowd was a row of slightly swaying statues. A glance is the largest
  idle movement that still reads at 20–40 m. Crowd members keep their phase offsets, so the glances are spread out.
- Not done: a blink (no eyelid bones; a material path would be a new uniform), eye-lines that follow a rite (needs the
  sim to pass a target per figure: per-frame work). Not irreverent: no gesture, no turning the back; only the head.
- Cost: +120 frames per human rig that has the stand variants (+600 at boot, ≈ 25 ms of prebake). Per frame: none.
- Evidence: idle-probe `man stand,stand~1,stand~2,stand~3,stand_hold`: a point 15 cm ahead of the head travels
  6–7 cm across, the head yaw goes −11 → +15 → −11° in stand~1; frame steps ≤ 3 cm; seams 0.00 cm.

## 3. A man waiting with his animal on the lead looks down along it
- Choice: `lead` (a 16-frame still pose with an 8 s breath) gets the stand sway and breath and once a loop looks down to
  his right, along the lead (≈ 11° down, 10° right) for ≈ 1.5 s. The lead hand is an IK target, so it stays on the rope
  (moves ≤ 1 cm).
- Why: the man and his animal are the subject of most "Happening now" individual offerings; he stood rigid while it
  moved.
- Cost: +32 frames per serving rig (man, elder). Per frame: none.

## Atlas and boot
- The atlas grows from 8932 to ≈ 10 470 frames for the eight boot rigs (two more 1024-row blocks: ≈ 1.8 MB of half
  floats on the GPU, one texture as before). The extra bake runs in the prebake worker (≈ 60 ms on this machine in
  node). Headless low-tier boots with the changes: firstFrame 36.8 s / 38.5 s under a load average of ~38 (other agents
  sharing the 4 cores), so not comparable to the HD 4600 numbers in CLAUDE.md; not measured there.

## Images (SwiftShader, low; `?debug=people` lineup)
- shots/lifelike/people/animals-lineup_t0900-00.png and _t0900-04.png, and animals-idle_0900-00_vs_0900-04_crop-and-diff.png
  (the two moments and a thresholded difference): the animals render with the variants, no pops; over 4 s the visible
  change at this distance is small (edges of heads, legs, tails), as intended. Console: warnings only, no errors.

- shots/lifelike/people/standing-row_t0900-00.png / _t0900-08.png (+ _and-diff): the role row renders, no errors. These
  two do NOT show the glance: see the finding below.
- shots/lifelike/people/solo-glance_pphase-0.30.png / _0.62.png: five figures at a fixed clip phase (`&pphase=`), so the
  variants whose glance falls at 0.30 (stand~1) or 0.62 (base stand) are caught mid-glance;
  solo-glance_heads_0.30-top_0.62-bottom.png enlarges the five heads: the Israelite (1st) and the elder (4th) are turned
  aside at 0.30 and face ahead at 0.62. At 5 m the turn reads clearly; at 20–40 m (crowd shots) it is a few pixels.

## Finding (pre-existing, not changed)
- An actor or crowd posed without an explicit phase advances it by frame time (system.js `_tick`: `phase += dt × rate`),
  not as a function of sim time. So an idle loop's phase is not reproducible across a scrub or across two shot runs at
  different `t` (shot mode pauses the clock; the phase drifts with frame count). The clips themselves are pure functions
  of the phase. Making idle phases `(simTime × rate + offset) mod 1` would be a system.js change touching every auto
  pose: left for its own change.

## Not verified
- On a GPU: nothing was looked at on the HD 4600. Shots here are SwiftShader, low tier (see shots/lifelike/people/).
- Whether the glance phase lines up across actors the sim starts at the same instant with the same phase (actors set
  their own phase; crowd members are offset): a scripted row of kohanim placed at one moment could glance together.
- The rope's look while the animal's head moves on a halter (the lead end follows the head bone; not inspected in an
  image at the extremes).
- Goldens (`tools/goldens.mjs`) were not re-run: figures in the golden views will be at a different pose for the same
  time, by design.
