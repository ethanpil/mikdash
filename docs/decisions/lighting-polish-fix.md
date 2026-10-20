# lighting-polish-fix — decisions

Review fixes to lighting-polish (scope `src/env/**`, `src/render/**`). Format: **choice** — why — alternative.
Shots: `shots/lighting-polish-fix/`. Dev scripts (not bundled, `node src/render/dev/session.mjs <script> --q <tier>`):
`room-jumps.mjs` (jumps, drag, 600× inside a probe room), `views.mjs` (named views × times in one boot),
`stats-table.mjs` (sky statistics table vs GPU read-back), `drag-prof.mjs` (per-system frame cost during a
time-panel drag), `perf-var.mjs` (GPU timer A/B of shader variants), `probe-cost.mjs` (capture cost),
`probe-dump.mjs` / `atlas-dump.mjs` (probe cube / atlas contents), `tier-switch.mjs` (runtime low ↔ medium).

## Clock jumps, drags and time-lapse (review items 2, 7, 8)
- **The sky statistics come from a per-source table on a jump and in a time-lapse, not from a synchronous GPU
  read.** The sky above the horizon is linear in its two sources, so the 8 statistics are Σ E × T(altitude),
  horizon terms rotated by the source's azimuth from the reference light; T is measured once at boot (one LUT +
  stats pass per altitude, 94 altitudes dense through twilight, ONE read). An async read refines the estimate once
  the clock runs normally; the LUT's ground term is re-run when the measurement differs by > 22 %. — a drag on the
  time panel profiled at 120–190 ms of `env.update` per jump frame (the sync read drained the GPU), not the probes;
  a forced env update is now 1–4 ms. Accuracy vs the GPU read: < 1 % by day and through civil twilight; at night
  the half-float LUT itself is the less accurate one (values next to the night-sky floor) — alternative: keep
  reading back synchronously (the stall), or a CPU sky model (a second atmosphere implementation to keep in step).
- **Probe rooms: on a jump the rooms' measured luminance is dropped at once and env holds its exposure snap until
  the post-jump capture's measurement lands (≤ 0.6 s after the capture); the capture runs one frame after an
  isolated jump; a burst of jumps (the time panel sets the clock every 90 ms) is captured once the clock has rested
  — 3 frames without a jump AND 0.5 s of real time — with the probes off meanwhile (sky light + the rooms' fire
  fill — what the meter's estimate assumes).** — the 3-frame snap used the previous time's measurement, then the eye
  adapted for seconds (black fade-in / white-out in the Kodesh); a capture per drag step stuttered. Real time and
  frames both: on high a frame (often the capture's own) outlasts the quiet period, and the capped frame clock made
  every drag step look isolated (5–9 captures a drag before, none during it now).
- **The room estimate (openings + fires) is the room's mean surface luminance from its own fires (flux / area,
  interreflected, as rendered) × 0.3, the log-average/mean ratio measured on the Kodesh probe.** — it was the fire
  illuminance at the camera: 3× the probe's value beside the Menorah, a visible pop when the measurement landed.
  Low and medium now meter the night Kodesh alike (0.0088 vs 0.0068–0.0080 cd/m²).
- **Amortised refreshes of a metered (interior) probe keep the previous capture in the atlas until the new one's
  measurement lands, then swap light and meter in the same frame; refreshes may run back to back (0.3 s) in a
  time-lapse; a probe faded for staleness is metered as the same blend with the estimate.** — at 600× the light
  swapped frames before the meter (flashes), 1.5 s real is 15 sim-minutes, and a stale probe was metered as if
  shown. Dusk 600× in the Kodesh: worst step between samples ×1.27 (was 2–3× back and forth); dawn changes
  monotonically (the one step is the sunrise entering through the gate).

## Scene probes (review item 1, and a night-gold artefact found on the way)
- **Outdoor probes are captured without fire light (point lights off, no room fill) and refreshed only by sky /
  Sun / Moon / door / world triggers.** — a probe's irradiance is used everywhere in its influence box, a fire's is
  not: the court probe 3 m from the pyres lit every night surface (and the Gazit through its door) like the faces
  next to the altar. The fires reach the court through their real point lights and GGX highlights. Alternatives:
  specular-only outdoor probes (loses daylight bounce), several court probes (cost).
- **The court probe stands mid-court north of the altar (halfway to the north wall) at eye height.** — away from
  the two things box projection cannot correct (the altar, the Ulam facade).
- **Probe captures leave out the stars and planets** — point sprites a few texels wide on a 64² face became
  green / magenta blotches on night gold once the probes stopped holding fire light; their light is in the
  night-sky floor already.
- **A capture is brightened to a mean of ≈ 0.5 scene units (gain ≥ 1, through the block's capture flag in env's
  tone-mapping chunk and the dome's output scale) and replayed × 1/gain.** — a capture taken at the exposure of a
  lamp-lit room (P ≈ 4 instead of 124 outdoors, e.g. the court probe right after a jump made inside the Kodesh)
  put the moonless court into half-float denormals whose per-channel rounding the PMREM turned into colour noise
  on the Ulam's gold doors. Alternative: float probe targets (PMREM is half-float anyway).
- **Probe captures light the fires at env's exposure, without the viewer's local adaptation to firelight (fx
  `lightsFor`, the shadow slots rescaled alike, the rooms' fill likewise).** — beside the altar fx's factor is
  ≈ 1e-4: a Kodesh capture taken while the camera stood near a fire came out black (seen on high, where the jump
  happened at the spawn with a brazier on the shadow slot), and the room was then lit by the Menorah's direct light
  alone. Pre-existing; exposed by the jump tests.
- **On a runtime switch to low the probe slots are cleared in the shader header** — the probe count stayed and the
  shader sampled atlas slices that no longer existed.
- **Room meter: log-average (geometric mean, ε 1e-4 cd/m²) of the capture, per face and over the sphere,
  0.6 sphere + 0.4 view-weighted (in log); partial adaptation toward a dimmer room 0.9 (was 0.7).** — the
  arithmetic mean was set by the sunlit gate (3 % of the sphere, 10× the walls) and kept the Kodesh murky looking
  west. Daylight interiors are photopic (≈ 100–200 cd/m² log-average): the eye adapts nearly fully in seconds; 0.9
  keeps the "dim" impression together with the lower exposure key at those levels.
- **Rooms without a probe (low, chambers) are metered the same way from the model: the room (sky visibility at the
  eye + its fires) and the part in view (sky visibility where the view ray meets the room's walls), 0.6 / 0.4 in
  log.** — the estimate ignored the view: from the Kodesh's west end looking at the sunlit gate low exposed for the
  dim end (La 90 vs medium's 363; now 222).

## Interiors (review items 3, 4, 6)
- **Volumes grow through the wall thickness where the site model places openings (Kodesh through the east wall:
  the great gate's passage and the F2 windows; the north and south ta'im through it: the wickets; the underground
  passage by its 0.6-amah lamp niches); the separate great-gate volume is dropped.** — recesses outside every box
  read as outdoors. The wall's outer face lies on the grown boundary facing out, so the shell rule still puts it
  outside; three boxes meeting at the Ulam's back wall exceeded the shader's two-candidate test, hence no gate box.
  F1 reveals stay outdoors (they are open to the sky above the ta'im).
- **Passages through the Heichal's thick walls between two dark rooms (the NE ta's door into the Kodesh, the knife
  chambers' wickets) get their own dim volumes (base 0.01), and the shader's room selection ranks the rooms
  touching the camera's room just below it.** — the strip beside the great gate that the review called "the north
  wicket" is the ta's door (`heichal.ta.door-ne`) through the 7-amah north wall; as a tiny room it also lost the
  selection to bigger, farther ones.
- **No shell rule on a volume's floor face** — a floor is solid ground; the Menorah's feet (down-facing within the
  shell) lit as outdoors.
- **Inside a room the outdoor light (sky slice and outdoor probes) is V × the radiance the openings show — the lit
  court (pavement under the global light, walls half sunlit) and 15 % horizon sky, per unit sky irradiance
  (`mkIntEnv`) — not the sky toward the surface normal; a reflection that does not leave through an opening sees the
  room's own surfaces (albedo 0.6 × V × that).** — gold under blue zenith sky × V read olive / teal on low.
  Rooms now receive ≈ 2× the light by day (sunlit stone is brighter than the sky) and warm.
- **The fire fill takes the fires' linear light colour (as the point lights render it) and its reflection is the
  fill where the reflected ray has gone as far as the fires.** — the old constant was the lamp preset's sRGB hex
  read as linear (yellower, brighter): low and medium disagreed; a uniform reflection made gold matte on low.
- **Partial von Kries adaptation toward the fires' colour when they light the room the eye is in (degree 0.6 ×
  fire share), luminance-preserving, applied before the tone curve (grade effect on medium+, the direct path's
  CustomToneMapping on low).** — gold × 1900 K light, squared by interreflection, is deep red in RGB; the eye sees
  firelit gold warm and golden. Alternative: desaturating the probe's interreflection (wrong for the walls lit
  directly).

## Performance (review item 7; HD 4600, shared with other agents' browsers — A/B in one page, min of 30 frames)
- **Point lights: fx multiplies each fire light by the sky visibility at the fire; fragments in rooms divide it out
  for the same room and multiply their own V otherwise; outdoor fragments read nothing.** — every fragment read
  each light's room from the block whenever a lamp burned in a selected room.
- **The interior block's header: an outdoor fragment reads two vec4s (union min / max; their w carry the flags,
  probe count and the atlas width); `mkIntP` only inside the union; `mkIntEnv` only in rooms; probe influence boxes
  stored grown so a fragment outside one reads two vec4s; a room's coarse box is six halves in one uvec4 (rounded
  outward); the reflection's exit through an opening is tested in the same pass over the apertures as the sky
  visibility (it re-read every aperture).** — each block vec4 is a memory load on Intel iGPUs. Measured gain small:
  the A/B showed the cost is mostly register pressure, not reads (below).
- **The probe loop is compiled only on tiers with probes (`#define MK_PROBES`, medium+; a runtime tier switch
  rewrites the chunk and recompiles the lit materials).** — with the room path compiled in but never executed the
  court still cost +5 ms at low: occupancy, not work. Compiling the (never used) probe loop out on low saved ≈ 2.8 ms
  in the court and ≈ 3.5 ms in the Kodesh. Dropping also the second-candidate room test and the reflection-exit test
  would save ≈ 1 ms more; kept (the parochet between Kodesh and KhK, reflections of the great gate on low).
- **Result at low (night, same-page A/B vs the stock three chunks, min of 30 frames): court +4–5.5 ms (was +6.5–7),
  Kodesh +5–7 ms (was +9.5–10).** Medium: court +23 ms, Kodesh +29 ms over stock chunks (interiors + probes; the
  reviewer measured +18 / +32 under contention) — not reduced further here. Drags: probes capture at most once per
  drag; env's forced update is 1–4 ms (was 120–190 ms of sync read-back); medium drag frames p95 250 ms, max 284 ms
  under contention (were p95 250, max 517).
