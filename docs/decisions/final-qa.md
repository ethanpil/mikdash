# final-qa — decisions

Found while re-shooting the session's baseline views on the finished tree. Format: **choice** — why — alternative.
Shots: `shots/final/` (`pairs/` = before / after of the baseline views, `sunset/` = the exposure repro).

## The court washed out white from a stoa's open side (env/interiors.js, env/index.js, env/volumes.js)

- **Root cause: `apertureFraction` returned 0 for a point on an opening's plane or beyond it, while `inside` still counts
  the room's margin beyond the plane as in the room.** — at `at=250,20` (the Royal Stoa's open side, exactly on the
  plane) `interiors.at` gave `s = 1, V = base = 0.05`: the meter took the eye for one in a closed room and exposed the
  court 16× over (P 5.1e-4 against 3.1e-5 two amot further out), at any hour, on every tier (`shots/final/sunset/`:
  low at sunset − 40, sunset − 10, sunrise + 10; medium at sunset − 10). Walking out through any doorway crossed the same
  band (0.3 m, the margin), eased by the 0.7 s adaptation into a short over-exposed flash.
- **Fix: within `APERTURE_BEYOND` (3 m, past the widest margin, 2.6 m) of the plane the point reads the opening as from
  the plane itself** — the solid-angle formula's own limit: the whole opening (× its openness) inside the rectangle, none
  beside it; V is now continuous across the plane and into the margin (measured at Y 19 / 20 / 20.4 / 21: V 0.78 / 0.80 /
  0.91 / 0.89, P 3.1–3.5e-5). — Alternative: shrink the margin to 0 for rooms with apertures (the shader's room blend
  uses it too).
- **The shader's `mkAperture` keeps its `h <= 0 → 0`.** — changing it re-keys and recompiles every lit program, and the
  band it affects (fragments within the margin beyond an opening's plane) is shaded mostly as outdoors already
  (`s` → 0); not verified in a close-up. — Alternative: the same clamp in GLSL, with goldens on real hardware.
- **The stoas are `colonnade` volumes: the share of the view that leaves between the columns (`interiors.viewOut`: nine
  rays over the field of view, followed to the room's box, arithmetic only) is metered at the outdoor level, and weighs
  the view term by 0.4 + 0.6 × that share.** — a colonnade open along a whole side shows the eye that looks out the
  court and little of the walk it stands in; with the room / view weights of a chamber (0.6 / 0.4) the court read
  0.8 stop over from the middle of the stoa. Looking at the back wall is unchanged (measured at `at=250,8`: P 3.4e-5
  looking out, 5.9e-5 looking back). Every other room has share 0 and is metered exactly as before (the Kodesh at d3,
  low: mean absolute difference 0.01 / 65535 against the shot from before the fix). — Alternative: the same weighting
  for every room with an open door (the Kodesh looking out of the great gate would darken by up to a stop: tuned views
  and goldens would move; left for a pass with real hardware).

## Not verified here

- No GPU: no frame rates, no `tools/warmup-check.mjs`, no `tools/goldens.mjs` (the materials, sky and smoke work changed
  the images on purpose, so the goldens need regenerating on real hardware). High was run once for program variants
  (perf-cpu round 2c); ultra was not run.
- `src/ui/dev/consoletest.mjs`: timing checks fail at this machine's 0.5–2 fps; each was re-run by hand with longer waits
  (ux-audit.md, round 3).
