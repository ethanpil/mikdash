# render-audio-3 — decisions

Owned: `src/render/**`, `src/env/**`, `src/audio/**`. Format: **choice** — why — alternative. ⚙ = reconstruction.
Requests applied: materials-2-fix (terrain acne on high; `ctx.fx.emissionScale`; Kodesh room light on high),
choreo-g5-offerings (Psalm 30 for the bikkurim), choreo-g4-courts (the scouring's broken pot).
Shots: `shots/render-audio-3/before/{high,low}` (this task's starting code), `after/{high,medium,low}` (same views plus
d9, n3 and the Ulam), `wip/` (A/B and measurement runs). Dev scripts: `src/render/dev/proxy-ab.mjs`, `kodesh-irr.mjs`,
`parochet-irr.mjs`, `kodesh-share-times.mjs`, `aperture-v.mjs`; `src/audio/dev/pot-break-test.mjs`, `bikkurim-live.js`.

## 1 Sun-cascade acne on the terrain (high)

- **Root cause: the terrain's shadow proxy drew its sunlit top into the sun map.** The visible ground does not cast;
  `terrain:shadow-proxy` (world/terrain: a coarse grid sunk 0.6 m, `colorWrite: false`) does. render-env-2's
  `onBeforeShadow` hook draws every orthographic caster's front faces too (for contact edges), the proxy included.
  Across the terraces' concave steps the coarse chords stand above the fine visible ground, and the result was a false
  shadow (the ≈10 m blob). Where the proxy lies just under the ground, within the bias, it gave the concentric rings.
  Evidence (`at=924,197&look=90,4&t=d3`, high): the blob survived depth bias ×10, normal texels ×2 and ×3.3, and PCF off
  (the rings sharpened). The ground's face and vertex normals agree within 2°. Vertical rays found one visible surface;
  the scene list showed the proxy as the only caster there.
- **Fix: a depth-only caster (`colorWrite: false`), or a material that sets its own `shadowSide`, keeps three's back
  faces (render/shadows.js `frontFaces`).** A heightfield drawn by its back faces still casts its ridges' shadows (the
  slopes facing away from the light) and never its own lit side. A/B in one boot (`proxy-ab.mjs`, the old behaviour
  emulated by setting `shadowSide` = DoubleSide on the proxy):
  - the olive views changed (mean |Δ| 6.5 / 5.7 levels, +6 % luminance), and the blob and rings are gone;
  - the Kidron at sunrise + 20 and sunset − 25 / − 40 (the western hill's shadow across the valley), the olive slope at
    sunrise + 40 and the Mount at d9 are byte-identical;
  - medium (env's key light, the same hook) is byte-identical at both views and had no blob.
  Biases unchanged. — Alternatives: a larger cascade bias (materials' test: −0.002 / 0.112 removes it), which lifts every
  contact shadow off the 8 cm lintels; or a finer / deeper-sunk proxy (build-mount's file, not needed now).

## 2 `ctx.fx.emissionScale`

- **Already on ctx.fx (render-env-2-fix, the same commit as the request: `get emissionScale()` = fx's uP × uFireGain);
  now in fx/index.js's header, and verified live.** At n3 by the altar the embers' `emissiveIntensity` is exactly
  1400 cd/m² × emissionScale on low and on high, frame after frame. materials' fallback formula comes out 15 % higher
  (5.4e-5 vs 4.7e-5 on low): it leaves out the tone mapper's parity gain inside fx's emission cap. Before fx's first
  update the getter is 3e-5 (FALLBACK_P × 1), finite.

## 3 The Kodesh room light on medium+ (the parochet "mid-grey")

- **Measured, not assumed.** `kodesh-irr.mjs` moves the Kodesh probe's capture point along the axis (correction off),
  re-captures, and integrates the cube's cosine-weighted irradiance for five normals. The local/mid-room ratio, d3 and
  d9 agreeing:
  - 0.55–0.6 one amah from the parochet;
  - 0.65 at 6 amot, 0.8 at 12;
  - 1.2–1.3 at 28, 1.6–2.2 at 34;
  - 1.9–2.8 at 3 amot from the gate.
  The shader read the mid-room probe as-is everywhere, so the parochet took the gate side's light: a white Lambertian
  there rendered E/π ≈ 1000 cd/m² against ≈ 740 captured at its place (`parochet-irr.mjs`). An earlier pass of this log
  double-counted the capture gain (`p.Pcap` already includes it) and saw a 3–7× error and a "2× too narrow PMREM lobe".
  Both were wrong: the roughness-1 level reads 1226 cd/m² toward the gate against 1271 by cosine integration.
- **Diffuse light from the Kodesh probe × √(V through the great gate here / at the probe), ≤ 2.5 (interiors-glsl.js;
  probe `irr: { mode: 'main', cap: 2.5 }` in volumes.js).** At the six measured places this gives 0.57, 0.65, 0.76,
  1.45, 2.2 and 2.5 (within ≈ 15 %). The gate's plain ratio (its inverse square, 0.33 … 8) is too steep, because the
  gold walls spread the light. The room's total V is wrong for this: the shader's cheap aperture form doubles the F1
  windows' V near the curtain's top (0.034 vs 0.016 exact; `aperture-v.mjs`). The main opening's V is computed by that
  same cheap form on the CPU (`interiors.mainVisibility`) and per fragment (`mkVm`, the room's first aperture), so the
  ratio is like for like. The Ulam keeps render-env-2's rule exactly (all openings, ratio ≤ 1.5). — Alternatives: a
  second Kodesh probe (no atlas slot left on high); SH irradiance per probe (3–7 more block loads a fragment).
- **…for the probe's sky share only (probes.js `skyShare`, taken at each capture).** That is skylight / (skylight + the
  lamps at the probe), × (1 − the share of the openings' area through which the Sun's beam lands beyond the probe,
  directly or off up to two gold-wall bounces). The beam test is BVH rays, 8 × 8 over the gate and 3 × 3 over the
  windows: about 200 rays and up to 5 ms at sunrise + 40, 1.4 ms at d3 (re-measured in render-audio-3-fix with the rays
  timed in page, medium; this log first noted ≈ 15 ms), now run a slice a frame across a refresh's faces. Why: at sunrise + 40 a capture by the parochet takes
  5–10× the mid-room light, and at + 90 twice it 8 amot west of the probe, the opposite of the fit.
  - **The beam counts only as far as env's key light carries the Sun:** × `env.sunTerrainVisibility`, which env
    evaluates at the camera's height, as it does the key light the capture is lit by. So the share is a function of the
    capture's time and of where the camera is, like the key light itself; a jump re-captures, and jumps.js stays
    deterministic. (Corrected in render-audio-3-fix: this log first called it a pure function of time.)
  - **Through a November morning, camera in the Kodesh** (`kodesh-share-times.mjs`, medium, re-measured): ≈ 1 until the
    Sun clears the Mount of Olives (0.98 at sunrise + 15), then 0 within one refresh (0.08 at + 20, 0 at + 30 … + 60,
    0.01 at + 90), eased back by + 130 (0.31, 0.56, 0.92, 0.98 at + 100, 110, 120, 130) and ≈ 1 for the rest of the day.
    Seen from the Kidron floor the Sun clears the ridge later: ≈ 0.99 to + 30, 0 from + 40
    (`shots/render-audio-3-review/share/share-vs-camera.json`). (Corrected: this log first said 0 from sunrise.)
  - It is 0 at night (lamps; the windows' V says nothing about them) and 0 with the gate shut.
- **The same factor on the probe's reflected light, by roughness (smoothstep 0.35–0.8), in the 'main' mode only (the
  Kodesh).** A rough lobe gathers light like the irradiance: the parochet at roughness 0.85 has a 4 % specular as bright
  as its 5.6 % diffuse (decomposed in page). Glossy gold keeps its box-projected image. The first version scaled every
  probe with a V reference, so the Ulam's rough stone followed its V too (its north wing's far wall ≈ 17 levels darker
  in the review's A/B) although this log said the Ulam was untouched. It was never measured there, so render-audio-3-fix
  gates it to `mode: 'main'` (interiors-glsl.js `mq > 0.5`); the Ulam is render-env-2's again.
- **Result (d3, display, AgX):** the parochet went from L 0.49 / S 0.19 to 0.42 / 0.21 on high (−27 % scene-linear;
  medium 0.43). The view toward the gate is within 1 %. Low is unchanged (no probes there; its curtain reads 0.19
  through low's own fill model). Night and the beam hours (about sunrise + 20 … + 90) are unchanged (share 0); before the
  Sun clears the ridge the correction applies, as by day.
- **The curtain / gold-wall ratio barely moves, as expected (added in render-audio-3-fix).** The review's matched A/B on
  high: d3 parochet Y 0.173 → 0.126 (L* 48.6 → 42.1), walls 0.103 → 0.078, ratio 1.69 → 1.61; d9 1.64 → 1.55. In that
  view the walls are seen at grazing angles and mirror the room's far end, which dimmed with the curtain, while the
  curtain faces the gate: the ratio is geometric. materials-2-fix's "diffuse and specular disagree ~10×" does not hold.
  The probe's roughness-1 level reads 1226 cd/m² toward the gate against 1271 by cosine integration (above), so both
  terms see the same light. Low's curtain (L* ≈ 20 against 42 on high, pixel-identical before and after) comes from
  low's own fill model. Calibrating it against these captures stays an env follow-up.
- **White balance: checked, left as it is.** env adapts (k = 0.45 by day with the gate open) to the probe's mean
  radiance, (1.32, 0.95, 0.57), which is the light arriving at the probe point and so consistent with the probe by
  construction. The parochet faces the gate's near-neutral daylight, so under the eye's partial adaptation to the gold
  room it reads mauve. That is plausible: a von Kries degree of 0.45 is modest for a lit room. Low's darker curtain
  comes from low's different fill model, not from high's ambient.

## 4 The bikkurim song — Psalm 30 ("Aromimcha")

- **Song id `aromimcha` (Ps 30:1–13), aliases `psalm-30`, `bikkurim`, `{ psalm: 30 }`, `30`; all four share one render
  cache key (live check).** "They reached the court, and the Levites spoke in song: 'I will exalt You, O Lord, for You
  have drawn me up…'" (Bikkurim 3:4); Rambam Bikkurim 4:17 quotes 30:2 and "וגו'". The whole psalm is ⚙: the sources
  name its opening.
- **A `kind: 'song'`, not a daily psalm.** music.js PSALMS and the sim's g3 PSALM_DUR list the daily seven, and the G3
  test checks one against the other.
- **Three sections, 1–4 | 5–8 | 9–13 (sense breaks), 34.6 / 39.6 / 49.8 s.** It is not a concert: the sections are only
  how it is cued, back to back (sectionTiming gives the lengths). Heading: "The first fruits reach the court, and the
  Levites sing Psalm 30, 'I will exalt You, O Lord' (part k of 3: Psalm 30:a–b; Bikkurim 3:4)" /
  "שִׁירַת הַבִּכּוּרִים — תְּהִלִּים ל׳, …". Verse captions as the daily psalms have them.
- **Hebrew from the Leningrad Codex via make-songs.mjs.** A ketiv joined by maqaf (Ps 30:4 מיורדי־[מִיָּֽרְדִי־] בוֹר) was not
  resolved by the generator. It now is, and the regeneration only added Ps 30's 13 verses. The Divine Names are written
  ה׳ and אֱלֹקָי (30:3, 13); 30:9's אֲדֹנָי is written אֲדֹ-נָי, as Ex 15:17 already was. The English is our own plain
  rendering.
- **The default ensemble (the attested minimum on the duchan, 12 men + boys + strings).** G5 stages six Levites; a
  caller may pass `men`.

## 5 The scouring's broken pot — cue `pot-break`

- **"An earthenware vessel in which [a sin-offering] was cooked shall be broken" (Lev 6:21), in a holy place
  (Mishnah Zevachim 11:4; 11:5 for one taken outside the curtains); the copper vessels are scoured and rinsed (11:7, the
  scouring scene the cue belongs to). Corrected in render-audio-3-fix: the quote was first cited to 11:7. Synthesised
  (foley.js `potBreak`):**
  - a damped knock of the pot's body (fired clay rings for tens of ms) with the floor's thud;
  - a click cluster for the fractures;
  - 3–6 large sherds, each a bounce sequence of its own small-plate modes;
  - small bits skittering, and a sherd sliding to rest;
  - `opts.size` 0.5–1.6.
  ⚙ throughout.
- **A soft clip (×2.5 into tanh) on the rendered pot.** Its millisecond spikes set the peak, and the −1 dBFS cap held
  it ~9 dB under its level. K-weighted loudest 400 ms is now −18.6…−21.8 dB, like `knock` and `keys` (−20…−22).
  Library: 95 dB at 1 m ⚙, foley, 3 variants; aliases `pot-shatter`, `earthenware-break`, `break-pot`.
- **Offline (`pot-break-test.mjs`, five renders):** the hit at 10 ms; the loudest point is the hit; 9–19 sherd onsets
  in 0.05–1.2 s; each half-second quieter; silent by 2.3 s; centroid 2.1–3.5 kHz; 60–300 ms to render. Live (low): it
  renders in the Worker, plays (2.6 s, −18 dB peak over a −30 dB bed at 1.7 m) and ends.

## Requests

- **sim (G5 bikkurim):** cue the song, e.g.
  `ctx.audio.cue('choir-psalm', [243, 340, 16], { song: 'bikkurim', section: s })` for s = 0, 1, 2 back to back, at
  tCourt + 0.35 + Σ `ctx.audio.sectionTiming({ song: 'bikkurim' }, k).duration` (minutes / 60).
  - The song's heading and verse captions replace the one-line caption.
  - The Levites' 'sing' hold (now 4.2 min) can follow the ≈ 124 s.
  - The 'kinnor' cue can stay as the opening.
- **sim (G4 scouring):** `ctx.audio.cue('pot-break', [235.1, 293.1, 16])` at `P.breakAt` beside the caption (the toss's
  moment).
- **orchestrator:** docs/API.md additions (the api field of this task's report).
