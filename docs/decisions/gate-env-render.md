# gate-env-render — decisions

The final QA gate's three env/render findings: the Kodesh's light, the altar fire close up, the opening frame.
Format: **Choice** — why — alternative. ⚙ = reconstruction / art direction. Shots: `shots/gate-env-render/{before,after}`
(`l-*` low, `h-*` high, the QA's own queries plus `kod-east-d3` and four night regression views), `wip*/` iterations,
`diag/` crops and A/B grids. Before shots of extra views were taken with the HEAD versions of env/render swapped in.

## 1. Kodesh: light through the gate only, falling off along the room

- **Medium+ (probe path): the gold's reflections fall off with the gate's share of the sky.** A metal has no diffuse
  term, so the gold walls and floor showed the probe's image of the room as seen from its centre, the same at both ends.
  The render-audio-3 falloff (√ of the main opening's visibility ratio, fitted to captures) only reached lobes rougher
  than 0.35, and the hammered sheets are 0.25–0.4. Now, in a `mode: 'main'` room (the Kodesh), lobes from roughness 0.06
  take `(Vm / Vm at the probe)^0.85` (same cap 2.5, same sky share). The exponent is 0.85, not ½: the probe fit is the room as the
  probe's blurred, self-fed bounces carry it. A mirror-image estimate of the gate in gold (R ≈ 0.85 a bounce) gives
  ≈ 3.5 stops from 3 m to 19 m. 0.85 puts the parochet's end ≈ 3 stops under the gate's (the QA asked for 2.5–3).
  Not in the probe's own capture (`MK_F_CAPTURE`): there it would compound bounce after bounce.
  Measured (display, `h-kodesh-d3`): near wall → mid-far wall −0.53 → −1.04 stops; looking east (`h-kod-east-d3`) the
  walls brighten toward the gate and the relief catches it. — Alternatives: a stronger irradiance fit (the gold has none),
  or relighting the capture.
- **Low (no probes): a small analytic environment for gilded rooms.** A reflection that leaves through an opening now
  sees what the opening shows: `mkIntEnv`, the lit court through the porch, the radiance the room's diffuse light is
  made of, instead of the sky dome above it. The soft exit test, widened by roughness × distance, is renormalised so a
  wide lobe keeps the opening's energy (it reached ≈ 0.86 over 5–6 × the gate's area). The room itself is no longer an
  even surround: ×0.5 … ×2 by the reflected ray's angle to the main opening (mean 1), so the relief's facets turn light
  and dark with their facing. Only for gold rooms without a probe (`mkHw` gain set), only while the gate is open
  (`mkVm > 0`). Low falloff (same crops): −1.00 → −1.29 stops. — Alternative: probes on low (cost, ENV-R2-6).
- **Not changed here (requests to materials):** gold F0 / metalness (already 1 and natural-gold F0 ≈ the QA's), the
  `IBL.gold` peak cap (6 × the mean ambient) that limits the gate's reflection, the parochet's colour by day, and its
  sheen at night. The night "black west end" is the lamps' 0.2 lx on dark wool: the Menorah cluster's light reaches
  the parochet (cut-off 15.9 m), so the render side does not cause it.

## 2. Altar fire: layered flames, a pale translucent core, the same texture on low

- **Pyre cards are layers** (`presets.js` `layers`): card 0 is the envelope over the fuel's centre (×1.08, cooler
  t −0.1, slower ×0.75, opacity 0.8). The body tongues sit on the ring as before. The last card is the hot core:
  narrow (×0.5 × 0.78), +0.28 in temperature, faster (×1.4), soot opacity 0.35, drawn last. Cards per tier
  [3, 4, 5, 5] (were [3, 4, 4, 4]). Each layer has its own scroll speed and turbulence. The depth fade against the logs
  (post tiers) was already in place.
  Other fire kinds are unchanged (no `layers`). — Alternative: crossed fixed cards, as the QA suggested for low. The
  camera-facing layered cards on their ring already give parallax, and a crossed pair shows its edge-on card as a
  sliver from 45°.
- **By day the core is pale and translucent:** soot κ 1.1 → 0.8 m⁻¹ (a pile's flame zone is tongues with gaps, ≈ 0.4
  emissivity at 2 m), and the hottest zone hides 70 % less of what is behind it. Emission is unchanged, so the
  flame reads as luminous and the stone shows through it. Night frames are unchanged in character (`h-altar-n4`).
- **Low uses the same erosion texture as the post tiers** (it took the coarse layer alone). Its hot core is now its own
  additive layer, tone-mapped apart from the body (cap 1.2 × the body's, 55 % of the core emission): within the body's
  low cap (0.75) a flame could not be brighter than sunlit stone and read as an orange haze or a cotton ball.
  At 2.5 / 100 % it became a white blob (`wip-fire2`).
- **Not changed here:** the logs, char, ash bed and soot decal on the altar top are the altar builder's geometry and
  materials. The coal-bed decal (fx) already chars and lights the logs' tops.

## 3. The opening frame

- **Moon key, ambient one stop down ⚙.** The Moon (22 Cheshvan: 47 % lit, 67° up at azimuth 122° at 04:36) already
  is the shadow-casting key on medium+ (high: the cascades). Low has no key-light shadow map (measured too
  costly, ENV-R2-6). The flatness came from the ambient: the moonlit pavement's bounce plus the moonlit sky carried as
  much light onto the east-facing wall as the Moon itself. Under a high Moon at astronomical night
  (`smooth(10°, 25°)` of its altitude × the Sun below −12 … −16°), the sky term (environmentIntensity and
  `ctx.env.ambient`) is now × 0.5. This is art direction: the measured moonlit sky, ≈ 16 % of the moonlight, is
  physically right. Twilight and moonless nights are unchanged. Display: wall −0.67 stops, pavement −0.24; the
  pavement now sits 0.85 stops over the wall (was 0.42).
- **The gate: local adaptation for fires hidden from the viewer (fx).** Through the Ezrat Nashim's east gate the eye
  sees the Heichal's facade lit by the great pile at ≈ 50–70 lx, 13 stops over the moonlit wall. fx's adaptation is
  global, and the Mount's watch torches already set it (0.88 lx at the start spot from all fires). Rays from the eye
  through a 3 × 3 grid on every court gate in view measure what the opening shows (`gateLaf`). The open fires whose
  light does not reach the viewer (`camK` < 0.1: the courts' walls hide them) take an extra gain that holds that patch
  at `GATE_OVER` (5) × env's adaptation level. The gain applies to their point lights, flames, beds, embers, halos
  and smoke glow. Fires that light the viewer keep the eye's own adaptation. Measured: the gate's interior +3.76 →
  +1.80 stops over the wall (display), and the facade's courses, lintels and doorway now read.
  — Alternatives: a global cap (it would have darkened every torch on the Mount to below moonlight); a screen-space
  local tone mapper (a post pass the low tier cannot afford).
- **The gate's spill is physical, so it lands where the opening shows the fire.** A new fx decal lies on the chel
  steps' twelve treads (site params: rise and tread ½ amah) and on the pavement before them. Each pixel takes Lambert's
  polygon irradiance from the gate's outer face. The passage's depth (5 amot) narrows what each point sees of it,
  which gives the trapezoid. The radiance comes from a table by ray slope, measured every 0.5 s with rays from the face
  inward. The result does not follow the QA's expectation. Near the steps the opening shows the sky above the
  facade, and the court beyond the gate is dark except where the altar lights it. 15–20 m out it shows the firelit
  facade and lays ≈ 0.2 lx on the stone (≈ 10 × the moonlight). So the warm light falls on the pavement round the
  viewer, not on the steps. The patch is soft-capped at 3 × env's level (its own local adaptation). The torches' share
  flickers (Tamid 1:3 companies; the courts' watch), the fires' share breathes. Night only (Sun < 2°), within 400 m.
  Low draws it as the tone curve's difference at the stone's level (`uSpillRef`): tone-mapping the added light alone
  lifted it through the curve's toe (pink, `wip-open4`). Cost: one draw call, 16 rays per 0.5 s, deferred one frame
  after a jump. — Alternatives: a point light in the opening (budgeted slots, round falloff, lights through walls on
  low); a lit-material uniform (a block read for every fragment on the Mount).
- **The altar's smoke column is lit from below and rises over the walls.** Pyre smoke height 46 → 80 m. Seen from the
  Mount it stood below the 40-amah walls' top; the pillar rose straight (Avot 5:5, Yoma 21a), and its height is
  unsourced ⚙. The fire's light now reaches up the column's flanks through at most 2.5 widths of smoke
  (`SMOKE_GLOW_PATH`), where before it had to cross the whole column below. Seen from outside, the glow takes the hidden-fire
  gain like the court. By day the grey column now stands over the wall in the opening frame (`after/h-sunrise15`).
- **Sparse cirrus by season ⚙** (high / ultra; the dome only has clouds there): a per-month least coverage, early rains
  0.28–0.3 (Cheshvan–Kislev, ≈ Oct–Jan). It is varied ±25 % by a per-date hash, and the old per-date draw can only add
  to it. In summer it is 0. Default date: 0.21–0.35, thin streaks (`wip-open5/*cirrus-0.3*`). Low and medium keep a clear
  dome: the sky shader's fbm is not free on the HD 4600 at full-screen sky.
- **Not addressed here:** figures in the opening frame (the QA agrees the Mount is quiet before dawn, report 08 §3).

## Verification

- Shots at low and high, before/after from the same queries: the QA's six views, `kod-east-d3`, and night regressions
  `en-court-n3`, `azarah-n3`, `mount-n3`, `moked-n4`. The Azarah, the Mount and the Moked at night are unchanged. In
  the Ezrat Nashim looking at Nikanor the facade over the wall no longer clips. Medium spot-checked (Kodesh falloff
  −0.8 stops).
- `npm run build` passes. `validate-schedule`: no gaps. `coverage`: longest gap 7 min. Sim tests: `fires.js` ok,
  `jumps.js` ran, `firstnight.js` (t=d3, low) 78–94 ms against a 70–80 ms baseline on a busy machine. fx's update on
  the jump frame is 5–10 ms.
- `node tools/warmup-check.mjs`: ALL PASSED. Low reaches its first frame in ≈ 20 s, as in qa-r2; the spill adds one
  program (74 on low shot).
