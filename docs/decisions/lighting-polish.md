# lighting-polish — decisions

Scope: `src/env/**`, `src/render/**` (env owns interiors and probes; render calls them in its frame). Format:
**choice** — why — alternative. Shots: `shots/lighting-polish/` (`before-*` = `?interiors=0`, the previous state).
Dev scripts (not bundled): `src/render/dev/*.mjs` via `node src/render/dev/session.mjs <script> --q <tier> --query "…"`
(whiteout = the (a) repro; jumps = jumps + 600× dawn/dusk; probe-view = unfold a probe; gputime / variant-ab / kvol-ab =
GPU timing, A/B inside one page). Switches: `?interiors=0` (previous behaviour), `?probes=0`, `?intdebug=1|2`,
`?intshader=0` (logic without the shader patch).

## (a) White-out after a backwards day → night jump
- **Root cause: the sky-view LUT's ground term (below the horizon) is lit by the sky irradiance that the statistics
  measure FROM that LUT, so it used the previous measurement. After a day → night jump that was daylight (2230 lx):
  the LUT held ≈200 cd/m² ground while env normalised the PMREM by the night sky (3.5e-3 lx) → texels ≈ 6e4× too
  bright, and nothing refreshed the PMREM until the Sun moved ≥ 0.5–1° (minutes of sim time). Fix: on a forced
  refresh the LUT is re-run with the freshly measured irradiance when it differs by > 22 %.** — `env.update(true)` (a
  full refresh) cleared it, which pointed at the PMREM/LUT pair; the published readouts (P, La, fog) were all right —
  clamping the PMREM (hides the symptom, wrong lighting for minutes).
- **An asynchronous stats read in flight when a jump forces a synchronous one is dropped (serial check) and uses its
  own buffer.** — it resolved after the jump and put the previous sky back until the next refresh.
- **Exposure snaps for two frames after a forced refresh, and adapts in sim time as well as real time
  (τ 0.7 s + τ 0.5 sim-min); stats are read synchronously while |speed| > 20.** — on the jump frame fx has not
  re-scheduled its fires yet (night lamps), which the interior meter uses; in a 600× time-lapse the sky changes 1000×
  in 2.5 s and a real-time-only eye overexposed dawn and crushed dusk (dawn 600×: mean 218/255 at −8° → 140–155).
  fx's fire adaptation gets the same sim-time term.

## (b) Scene reflection probes
- **Probes are extra SLICES of one CubeUV atlas that becomes `scene.environment` (slice 0 = env's sky PMREM, copied
  on every sky refresh); a global chunk patch (`interiors-glsl.js`) picks slices per fragment by influence box and
  box-projects the reflection onto a proxy box.** — no extra sampler or per-material envMap: every MeshStandard /
  Physical material (world, people, terrain) gets it, and gold_plate is used both outdoors (gates) and in the Kodesh,
  so a per-material probe could not be right — per-material `envMap` (one probe per material), a fixed texture unit
  bound behind three's back (fragile).
- **Atlas slices side by side (stride = PMREM width + 8 px), slice count derived in-shader from `textureSize` and
  three's own `CUBEUV_*` defines.** — stacking vertically changes three's derived `CUBEUV_MAX_MIP` and texel width; a
  uniform slice count reads 0 on a program's first frame.
- **Probes: court (medium+; Azarah, between the Ulam steps and the altar's south line at eye height), Kodesh (medium+;
  centre, eye height, proxy = the room), Ezrat Nashim (high/ultra); positions and boxes from site.js. Same size as
  the sky PMREM per tier (64 medium, 128 high/ultra) so one PMREMGenerator serves all; none on low.** — low keeps the
  sky PMREM plus a scene-aware lower band (below) — probes on low (each face redraws the world).
- **Captures run inside render/'s frame after the shadow light is set up (`ctx.env.probes.render()`), people hidden,
  the world's `terrain` and `mount` groups skipped (⅔ of the triangles; from inside the 40-amah court walls they show
  only through gates). SYNC (all faces; interior probes 2 passes medium / 3 high+, pass 1 without its previous self)
  two frames after 'ready', a clock jump, a date change or a world change; AMORTISED (one face a frame) when the Sun
  moved 3° / 2° / 1.5°, the key light switched, the outdoor light drifted > 1.6×, the fires or doors of the probe's
  room changed — at most one refresh per probe per 1.5 s.** — capture timing measured on the HD 4600 (medium): ≈36 ms
  CPU for a full sync capture, ≈3 ms a face.
- **The capture lights the scene as seen from the probe: fx assigns its plain light slots to the fires ranking highest
  from the probe point (`fx.lightsFor`), interior uniforms re-selected around it, sun/moon attenuated by sky
  visibility.** — the Menorah's light otherwise belonged to whatever the viewer was near.
- **No emissive flames and no Sun/Moon disc in a capture.** — the fire point lights already give the diffuse light and
  the GGX highlight (the flame's mirror image on gold); a captured flame doubled the court's light at night (2.3×), a
  captured Sun disc (uncompressed above 25°) doubled the sun in every indirect term (shaded whitewash went white).
- **Replay scale = P_now / P_capture × (light at the probe now / at capture), the light = outdoor global illuminance ×
  the probe room's sky visibility + the fires that see it; a probe whose outdoor light drifted > 3× fades out (gone
  at 10×) toward the properly normalised sky map until its refresh lands.** — between refreshes a 600× dusk changes
  the sky 100× in 15 sim-minutes; the court probe is dominated by the altar fire, so one scalar cannot renormalise
  its sky part — white frames at 600× dusk before this.
- **Self-feedback ≤ 0.9 during a probe's own capture.** — a closed gold room's red channel is nearly lossless; the
  interreflection must converge.
- **The court probe's shadows: on high/ultra render/'s cascaded sun shadow refits to each face (it is view-fitted);
  on medium env's world-fixed key shadow is reused.**

## (c) Interiors
- **Interior volumes from site.js (Kodesh, KhK + amah traksin, Ulam, the great-gate passage, aliyah, ta'im, Beit
  HaMoked + its passage and Beit HaTevilah, the Azarah chambers, gate passages, Beit Avtinas / HaNitzotz, exedra,
  music chambers, Mount chambers, the four stoas, the Chuldah passages); each has rectangular apertures (doors with
  their live `ctx.movables` state, the F1/F2 windows, the Ulam's 20 × 40 opening, the Moked's oculus, a stoa's
  colonnade side). Sky visibility V = base + Σ Ω(rect)/2π × openness × brightness beyond; Ω is the exact solid angle
  of the rectangle.** — a smooth fall-off from doors and windows with no textures and no baking; changes with the doors
  — baked light maps (needs the final geometry), screen-space GI.
- **V scales outdoor IBL (sky, outdoor probes), the sun/moon where there are no shadow maps (low, and in captures),
  point lights from other rooms (V_light × V_fragment), and the fog in-scatter when the camera is in the same room.
  Specular keeps the outdoor light where the reflected ray leaves through an opening (soft by roughness × distance).**
- **Boxes may be inner (zones) or outer (chambers incl. walls): surfaces within `shell` of the boundary facing
  outward count as outside; zone volumes extend up through their ceiling courses (the Kodesh to the kiyur's top).**
  — the coffers rose an amah above the zone's top, sat outdoors and mirrored daylight into the gold walls (the probe
  measured 667 cd/m² for a room lit through one door).
- **Openings the site model knows (wickets etc.) that pierce a face of a volume without explicit apertures become its
  apertures; the Heichal's rooms are explicit only.** — the Chavitin / Pinchas chambers were black through their open
  wickets.
- **Generic chamber base visibility 0.05; Kodesh 0.004; KhK 0.0015; underground 0.0005; stoas 0.05; ta'im 0.01.** —
  reconstruction: rooms whose doors the site model does not place still have one.
- **The Kodesh probe is not attenuated by V (it already sees the room as lit — the doorway, the lamps on gold, its own
  previous bounce); rooms without a probe (low tier, chambers) get a fire fill: their own fires' flux spread over the
  room's surfaces × 1.6 interreflection, shaped R²/(R² + d²) around the fires.** — the night Kodesh on low was black
  except the Menorah's steps (no probe carries the gold's interreflection there).
- **Exposure inside a room meters what the eye sees there: the Kodesh probe's mean luminance (GPU-measured on capture,
  read back asynchronously — a synchronous read stalls ANGLE ≈0.35 s), centre-weighted toward the view direction; else
  daylight through the openings + the room's fires. Toward a dimmer room the eye adapts 70 % of the way in log
  luminance, toward a brighter one fully; when the room's own fires dominate, the exposure key rises toward 0.115
  (firelight read by a dark-adapted eye). env then meters those fires itself and fx stops adapting to them.**
- **fx light ranking is occlusion-aware (score × max(V_fire·V_viewer, 0.05) across rooms).** — inside the Kodesh the
  altar's pyres took all the low tier's light slots from the Menorah (build-heichal request).
- **Uniforms in one std140 uniform block (`MkInteriors`).** — see Performance.
- **Debug views: `?intdebug=1` (√V grey), `?intdebug=2` (volume tint × probe weights); A/B switches `?interiors=0`,
  `?probes=0`.**

## Low tier: scene-aware lower hemisphere
- **The sky probe's band from the horizon to 16° (in the courts) / 6° (elsewhere) shows the surroundings: limestone
  walls in shade (0.45 × sky + half the lit ground) plus the key light on faces turned toward it.** — gold reflecting
  the bare horizon sky read olive (F0 of gold × blue); this is the only scene awareness low gets.

## (d) The earlier pink issues
- **Bloom halo round a low Sun (medium): not present** (render-fix's soft-knee, sky-masked prefilter) — verified at
  1.9° and 4.4° altitude.
- **Ultra sun-shaft veil: shafts are now weighted by the pixel's own air path, 1 − e^(−d/400 m) (sky = 1).** — the
  radial blur added key-light-coloured (sunset: pink) in-scatter to every "open" pixel, the pavement at one's feet
  included; physically in-scatter grows with optical depth.
- **Ultra vs low sunset ground colour: the pink cast is gone (shafts); a remaining difference is structural — at
  4.4° the Mount's 40-amah west wall shadows the whole plaza on medium+ (shadow maps), while low (no shadow maps) shows
  it sunlit.** — follow-up suggested: analytic shadows from the site's big wall boxes on low.

## Performance (HD 4600, measured with GPU timer queries; `src/render/dev/variant-ab.mjs` / `kvol-ab.mjs` A/B inside one page, because the GPU was shared with other agents' browsers)
- **All interior / probe data in one std140 uniform block (`MkInteriors`, `env/uniforms.js` UniformBlock), bound to
  the last binding point and to binding point 0 (the default of a program linked this frame).** — as ~1.8 KB of plain
  uniforms ANGLE/D3D11 re-uploaded them with every draw call (three sets per-object matrices each draw): the patch
  cost +15–20 ms a frame at low even with all its code disabled — plain uniforms, or a per-material `uniformsGroups`.
- **Per fragment: one test against the union of the selected rooms' boxes, then a dynamic loop over at most the
  tier's room count (low 4, medium 8, high/ultra 12, chosen per frame by apparent size and the view frustum) doing only
  a box-depth test, then the full insideness test and the apertures for the one room the fragment is deepest in (and
  for the second-deepest where the first rejects the surface as facing out of it: the parochet between the Kodesh and
  the KhK otherwise lit as outdoors and blew out under the room's dark-adapted exposure).** — a
  uniform-block read is a memory load on Intel iGPUs (≈ 1–1.5 ms a frame per room tested); fully unrolled
  constant-index loops were slower still (FXC flattened the branches and evaluated every room's / aperture's maths).
- **Cheap aperture solid angle in the shader (equal-area disc on axis × (h²/(h² + e²))^1.5 off axis); the exact
  rectangle formula (4 × atan2) stays on the CPU.** **Block scalars read once per fragment; no `textureSize` (the
  atlas width is in the block); point-light room data read only when a light stands in a room.**
- **Result at low: Azarah view 20.3 → 25.2 ms; inside the Kodesh 15–17 → 22–26 ms; open Mount +≈1 ms (each the median
  of 14 frames, A/B alternated).** — the price of interiors reading dark on the weakest tier; `?interiors=0` turns it off.
- **Probe captures (medium, HD 4600): a full sync capture (court 6 faces + Kodesh 2 × 6) ≈ 36–42 ms CPU, its GPU work
  ≈ 0.3 s on this iGPU — only on load, clock jumps, date or world changes; amortised refreshes draw one face a frame.**
  The mean-luminance read is asynchronous: a synchronous `readPixels` stalled ANGLE ≈ 0.35 s even with the GPU idle,
  and reading a HALF-float target costs ≈ 0.45 s once (FLOAT targets are read instead).
