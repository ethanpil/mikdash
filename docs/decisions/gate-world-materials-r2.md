# gate-world-materials-r2 — decision log

`- **Choice** — why (source / reasoning) — alternative.` Owned: `src/world/**` (incl. `src/world/materials/**`).
Round 2 of the QA gate for this area: "Parochet: pure black at night (n3) and a brown-maroon hue on low" and "Golden
incense altar reads as a pale beige box on low". View `at=152,330&look=270,6` (5 amot inside the gate, looking west) at
`t=d3` / `t=n3`, plus `at=144,330&look=270,2&t=d3` (close).
Shots: `shots/gate-world-materials-r2/` — `before/` and `after/` (`low`, `high`; same queries), `after2/` (the sunrise
ramp re-shot, the Nikanor curtains with the old colour by eval), `diag/` (grey-card, sheen and colour sweeps by eval),
`cmp/` (side-by-sides, the altar crop). Regions (1280 × 720): curtain (560,100,760,400) and its lower, lamp-side folds
(520,380,620,470); altar (640,480,670,520), close (645,470,690,560); south wall (100,380,300,500).

## Diagnosis (measured, not assumed)

- **The curtain's albedo is not what differs between the tiers; the light is.** The curtain was replaced by a 0.18 grey card
  in the page (`diag/grey-low`, `diag/grey-high`). At d3 that card reads (55, 42, 24) on low and (109, 107, 105) on high:
  low's light at the far end is ~4× dimmer and strongly gold (linear b/r 0.24 against 0.93). The cause is env's
  analytic gilded-room light on low. The daylight through the gate times GOLD_GAIN (1 + ρ + ρ²) tints every diffuse
  surface alike, including the parochet, which faces the gate and so takes most of its light unbounced. Fire share by
  day ≈ 0 (`env._meter`: Lf 0.001 against Lopen 759; only the ner ma'aravi is lit). At n3 the two tiers' light agrees
  (card (18, 12, 9) low, (11, 8, 5) high, both lamplight).
- **The sheen cannot light the curtain at night in this view.** The Menorah cluster light reaches it (range 14.9 m, the
  curtain 6.4 m off). But lamp and eye are both east of the curtain (backscatter), where the Charlie sheen lobe is ~0.
  Sheen colours up to #ffd0d8 and roughness 0.3–0.55 moved the night curtain 5.7 → 7.0 (`diag/sheen-high`). The curtain
  is dark at night because dark-dyed wool 6–15 m from seven small oil lamps receives little light; no material setting
  changes that.
- **The incense altar's body was `gold_plate`, the walls' key, not the vessels'.** Its east face mirrors the floor and the
  gate behind the viewer. On low the hammered sheet's wide lobe (roughness 0.25–0.4, widened by distance in env's gate
  test) counted as "through the gate" and returned the court's pale radiance: gold F0 × pale stone = beige, flat.

## Parochet

- **COLOR_PAROCHET: sRGB #dce2dd (linear 0.72, 0.77, 0.73) → linear [1, 1.08, 1.04] (SPEC colours may now be linear
  arrays; `setColor`).** — round 1 cut the albedo to calm the curtain under the room's earlier, brighter light. env's
  gate falloff (gate-env-render-r2) later took the far end to 0.33 of the probe's light, so the cut over-darkened it:
  high d3 read (94, 60, 65). Now (105, 68, 75) against materials.md's documented far mix (109, 74, 79). This lifts the
  night and the low tier by the same ×1.35–1.45 linear. The dyes and their even four-ply mix (Shekalim 8:5) are
  unchanged.
- **The Kodesh's two parochot get their own key `parochet_kodesh` (heichal/kodesh.js Drape `key`, on a world built at
  detail 0 only, so medium+ build exactly what they did before; a run-time switch to low keeps the plain key): the same cloth plus
  `lowDay` [1.15, 2.1, 3.1] (linear). On the low tier its colour eases to that by daylight, as the Sun rises from −1°
  to +3° (smoothstep, a pure function of the sim clock, checked every frame for tier changes). Other tiers and nights
  use the plain colour.** — the compensation cancels env's measured low-tier daylight cast on this surface. Low d3:
  (40, 11, 6) brown-maroon → (54, 36, 41); g/r 0.67, b/r 0.76 against the documented 0.68 / 0.72, darker as asked.
  Daylight only because a constant multiplier (`diag/pc-low*`) turned the night curtain violet: the night white
  balance (×0.56, ×1.36, ×4 blue) multiplies any added blue, and low's night hue already matched high's. An earlier
  ramp (−6° → 0°) did the same at sunrise −10 (41, 26, 50). The Azarah gates' curtains, the aliyah's and the lul's
  keep `parochet` (neutral outdoor light: a low-tier cast there would be wrong). — Alternatives: fix the light (env's,
  requested below; then remove `lowDay`); a constant low colour (wrong at night); sheen on low (no effect, see
  above; it would also add a program).
- **No sheen change.** Tested and rejected: see Diagnosis. SHEEN_PAROCHET stays #4a3038 / 0.55.
- Night after: the lamp-side lower folds (17.7, 5.5, 4.9) → (23.4, 8.0, 7.8) on high and (23.9, 5.4, 6.7) → (33.4, 9.9,
  12.6) on low. That is ≈ 4 % of the lit south wall's red (linear), the "few %" asked. The upper folds, ~12 m from the
  lamps, stay near black (8.6, 1.7, 1.4 on high): the lamplight there is ≈ ¼ of the lower folds'.
- Sunrise on low: −10 min (36, 9, 16), lamplit red-violet; +20 min (66, 26, 17), red, as before but brighter. The sun
  then shines straight through the east gate onto the curtain, and high reads (154, 101, 94). Low's sunrise light is
  env's; it was browner before.

## Golden incense altar

- **Its body plated in the vessels' key `gold_vessel` (pure gold #ffe39d, the vessel set's burnished finish, roughness
  ≈ 0.14) instead of `gold_plate` (the walls' beaten natural-gold sheets, #fae5aa, 0.25–0.4).** — Shemot 30:3
  "וצפית אתו זהב טהור": the altar is overlaid with PURE gold, and materials' own rule (index.js GOLD) is that the
  vessels keep zahav tahor while the plating of the building is natural gold. The narrower lobe stays inside env's
  exact gate test, so on low the face mirrors the gilded room (with its gain) as the walls do, not the pale court.
  Low d3 (146, 123, 80) sd 8 → (134, 105, 54) sd 26; close (142, 116, 68) → (124, 89, 31): saturated gold, matching
  the walls and the Menorah, with the lit zer and roof above. High: close (158, 129, 78) → (163, 128, 72), polished,
  not hammered. Same program, no new bucket on high. Alternative: a low-only variant of gold_plate (it would keep the
  wrong grade of gold).
- Noted, not changed (not in the brief): the Shulchan (vessels.js `goldTable(H, b, 'gold_plate')`) is also overlaid
  with zahav tahor (Shemot 25:24) and reads pale on low for the same reason. The same one-word change would apply.

## Verification

- Before / after at low and high from the same queries (above). Console clean in every batch (no errors or warnings).
- Draw calls / triangles unchanged per view on low (152 / 0.54 M at d3, 149 / 0.53 M at n3). High varies between
  identical runs (n3: 223 and 686 calls back to back, `after2/high`): probe / shadow passes in the measured frame,
  not this change. Programs unchanged (variants and the new key share the existing programs).
- `npx vite build` passes; `validate-schedule` 0 errors / 0 warnings; `coverage` no gaps (longest 7 min);
  `nav-coverage` ALL REACHABLE. Sim (low, t=d3): `views.js` ok (every stand, every rite seen), `jumps.js` ok,
  `firstnight.js` firstNightMax 98 ms, againMax 121 ms (gate-env-render-r2 logged 127 / 67 ms on this shared machine).
- `warmup-check`: low, medium, high (shot, play) and ultra shot PASS, programs unchanged (74 / 89 / 101 / 105 shot).
  Ultra play hovers at the 30 s reveal limit: the deferred world materials are shown at +29 to +42 s from run to run.
  It failed 4 times with `parochet_kodesh` on every tier and passed 3 times without it. With the key on low only (ultra
  then builds what it did before but for the altar's key and the colour) it failed once and passed once (+42 s), so
  the limit is load-bound, as gate-env-render-r2 also found. The low-only scoping stays: medium+ are unchanged.

## Requests

- **env-render:** on low, the gilded-room daylight (`interiors-glsl.js` mkIBL: `LbN = mkIntEnv.xyz * gain`) tints a
  surface that faces the gate as fully as one lit only by bounces. At the parochet a grey card reads (55, 42, 24) on low
  and (109, 107, 105) on high (`diag/grey-*`). Ask: weight the gain by the share of the surface's light that is
  bounced (its direct view of the gate, e.g. `mkVm`, takes 1, the rest the gain), or match the probe's chroma. Then
  remove `lowDay` from `parochet_kodesh` (materials/index.js LOW_DAY_PAROCHET), or the curtain on low will go violet.
  Also on low: sunrise −10 at the curtain is lit (lamps) where high is black, and sunrise +20 is half as bright as high.
- **env-render / render (night, if the QA wants more than ≈ 4 % on the near folds):** the curtain's night light is the
  Menorah's direct light only. Its mirror images in the gold floor and the south wall (each ≈ 0.8 × the direct at the
  curtain) are a real source that a point light does not deliver to a diffuse surface. The sheen cannot carry it
  (backscatter, measured).
- **gate-core / orchestrator:** `warmup-check` ultra play is flaky at its 30 s reveal limit on this machine (shown +29 … +42 s,
  48 deferred world materials). The limit or the deferred queue's ultra pace needs a look; it is not specific to this task.
- **orchestrator (docs/API.md materials):** new key `parochet_kodesh` (used on low-built worlds); SPEC `color` may be a linear [r, g, b] (values > 1
  allowed); SPEC `lowDay` (low tier, by daylight).
