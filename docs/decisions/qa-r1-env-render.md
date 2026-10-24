# qa-r1-fix-env-render — decisions

Fixes from the first QA round in `src/render/**`, `src/env/**` and (ENV-6/7, assigned with them) `src/time/**`.
Format: **Choice** — why — alternative. ⚙ = reconstruction. Shots: `shots/qa-r1-fix-env-render/{before,after}` (the QA's
own queries, `tools/shot.mjs`), `wip/` (iterations), `diag/` (A/B and debug views). Dev scripts used are one-boot
`src/render/dev/session.mjs` scripts (kept out of the tree).

## ENV-1 — the altar fire by day (flames, coals, shimmer, smoke base)

- **A few wide, soft procedural flipbook cards per fire instead of a dozen narrow tongue sprites** (`fx/presets.js`
  `cards`, `cardW`, `cardH`, `ringR`; pyre 3/4/4/4 by tier, the card over the fuel's centre widest and tallest). Each card
  is a plume envelope eroded by noise that rises faster with height (the licks tear off at the top), domain-warped, the
  noise in flame-height units so every size looks alike. — Keeping the tongues and softening their edges; rejected: the
  paper-cut look came from many overlapping hard outlines.
- **Two layers in one premultiplied output:** the body emits ∝ its visible density and hides the background by its
  emissivity (Kirchhoff), thinning together at the edge (the path through a round flame is short there) and at the cool
  margins (little soot) — so no dark rim forms where the emission fades before the alpha (the old "black outline" on a
  sunlit wall); the hot core is added on top with alpha 0. Core peak ≈ 1 L + 1.5 × 0.88 L per card (pyre L = 2e4 cd/m²):
  soot at 1600–1700 K is 2–5e4 cd/m² as a black body, i.e. brighter than sunlit white stone (1–2e4), which is what the
  core now is by day. `FIRE_REF_CORE` (the night "eye adapted to the flame" gain) follows the new core (1.6 L).
- **Depth fade against the logs ∝ card width** (0.06–0.45 m) on the post tiers; the card's foot sits 6 % into the fuel and
  fades in, so on low (hard depth test) there is no cut line either.
- **On low the flame is tone-mapped per unit of its coverage, then the coverage is applied again:** low blends into the
  tone-mapped 8-bit canvas, and tone-mapping the premultiplied colour darkened the thin margins into an inked outline (the
  old flames' brown rims too). Overlapping cards are scaled by n^−0.22 so their sum neither saturates nor thins out.
- **By day, seen from Nikanor over the altar's edge, the flame stays pale against the sunlit Heichal:** only its upper,
  cooler part is in view there, and a flame body (≈ 0.5–1e4 cd/m²) is no brighter than white stone in the morning sun
  (≈ 1.5e4). Close up the core is the brightest thing in view. Not pushed further (accuracy first).
- **Coal bed = a deferred decal on the post tiers** (`fx/materials.js` BED_*): a box round the bed; each pixel rebuilds
  the scene surface from the depth texture and, inside the bed's cylinder, chars it (premultiplied alpha) and lets it glow
  in cracked seams, most on up-facing surfaces (normal from the depth's derivatives, taken before any branch for
  ANGLE). It lights whatever the builders put there — the billets' tops and inner ends, the ash, the Moked's logs —
  without touching world geometry. Seams up to `Lbed` 4e3 cd/m² (≈ 1400 K). On low (no depth texture) the box flattens
  into the old disc. — Emissive masks on the world's log meshes (world/materials' files; the decal also serves every
  hearth).
- **Heat shimmer, medium and up** (`post-effects.js` HeatHazeEffect, a `mainUv` transform merged into the grade pass: no
  extra full-screen pass): up to four plumes picked and projected by fx (largest on screen), above the flames' middle,
  only over what lies behind the plume, never pulling a nearer surface in. Amplitude 3e-3 rad at a 2 m pile (∝ √size),
  ≤ 4 px: hot air over a fire bends rays by ~1e-3 rad. `fx.haze`, `fx.time`.
- **Smoke base:** a fire's column now begins at its flame tips (`smokeColumn({ base })`), a third of its width there and
  faint, thickening over the first fifth as it cools. The axis stays vertical (Avot 5:5; Yoma 38a).

## ENV-2 — the facade "lit evenly" and the smoke "rope"

- **No light term bypasses the decay-2 lights (not reproduced).** With fx's point lights forced to 0 the Heichal face and
  the tops of Ezrat Nashim's walls go dark (`diag/l-predawn-nolights.png`). The great piles (great + inner, ≈ 3.5e4 cd)
  stand ≈ 23 m from the face's lowest visible course and 48 m from its top: ≈ 58 lx against ≈ 6.5 lx with the cosine, a
  3-stop fall that AgX's log-like curve shows as 156 → 222 in sRGB (`before/h-env2-predawn.png`). The lit wall tops in
  Ezrat Nashim are real: the Azarah's east wall is 35.5 amot high against 46 for Ezrat Nashim's side walls, so the altar
  fire sees their upper inner faces over it. — Faking a steeper falloff; rejected (accuracy first).
- **The column is lit by the fire only near the fire:** the fire's light reaches a height h through the column's own
  smoke beneath it, exp(−0.6 × density × h / width), and as the inverse square. It widens and thickens with height
  (above), with billows inside (a domain warp with its own slow motion, its relief tilting the normal) and a lower
  density (0.5 → 0.38) and wider spread (3.2 → 4.2): a grey, partly transparent column against the night, glowing orange
  only at its foot.

## ENV-3 — the Beit HaMoked hearth

- **Fire light is not a point:** each fire light carries its flames' radius in its decay (decay = 2 + 0.35 × size; the
  patched `getDistanceAttenuation` in `lights_pars_begin` reads it): 1 / (d² + r²), a Lambertian disc on its axis — the
  same as a point beyond a few radii, no hot spot beside the flames. Other point / spot lights (decay ≤ 2) unchanged.
- **The hearth's and brazier's light sits higher** (0.85 / 0.8 × size above the bed: the flames' middle), so their low
  logs no longer throw long spokes across the floor.
- **Local adaptation counts the viewer's own room's open fires in view, beyond env's meter:** half of (centre-weighted
  luminance the room's pyres, hearths and braziers give the surfaces in view − env's room-mean luminance). Beside the
  hearth the floor was 4 stops over the hall's mean and burned white; now the hall reads as a dark room lit by its fire.
  Lamps are left out (the Kodesh by night stays as env meters it: a first version that counted the Menorah darkened the
  room 2.5×), as are other rooms' fires and the open air (unchanged).
- **A taller multi-card hearth flame** (3–4 cards, 1.05–1.45 × size) with more sparks (10/18/26/34); the decal chars and
  lights the inner log ends and the ash bed. The logs' own mesh (smooth cream cylinders) and the white kerb are
  build-courts' (request filed).

## ENV-4 — the Kodesh

- **(a) The F1 windows pass the key light only through a real window** (`volumes.js` F1 `slot`, `interiors-glsl.js`
  mkSlot): the aperture keeps the band (its openness = the windows' share, for the sky light), but the sun / moon now gets
  through only where a ray passes one of the five windows at both ends — 1 amah wide at the Kodesh face, 2 at the outer
  face, the wall's 5 amot apart (Menachot 86b: narrow inside) — at full strength. The band used to pass a smeared 16 %
  everywhere: the pink diagonal on the parochet on low. Now, as on high, nothing at d2–d3; near noon in November small
  beams fall on the upper north wall (a slot passes the Sun only within ≈ 17° of its axis in azimuth and below 45° in
  altitude). Both tiers.
- **(b) Where two rooms meet, a surface facing out of one faces into the other, never into the open** (mkRoom; volumes
  `joins`): the bright strip at the pinned-back south end was the INNER parochet's east face, 0.3–0.5 m inside the KhK's
  box and facing out of it — the shell rule (outward-facing surfaces within 0.4 m of a box face count as outdoors, meant
  for wall faces on a zone's boundary) made it open sky, lit by the Sun and the sky map (dbg view 3: no room). The KhK's
  east face and the Kodesh's west face are now marked as joining: a surface there beyond the other room's reach stays in
  its own room (the traksin is dark), and one in both is never mixed toward the sky. Debug views and pixel read-backs in
  `diag/` and `wip/`.
- **(c) By day the Kodesh's light comes through the great gate** (gate and its curtain open at d3 in the sim's staging,
  Tamid 3:7), which is behind a viewer looking at the parochet; the gold walls' interreflection colours it. env lights the
  room from whatever the gate, curtain and window states are; the windows now add their narrow beams. Whether the gate's
  curtain (Yoma 54a, one of the 13) hangs drawn by day is staging (request filed); not changed here.
- **(d) The wash at bright doorways is bloom, not aerial perspective:** haze on/off is pixel-identical indoors on low and
  high; bloom off removes the wash. Inside a roofed room (env interiors' insideness at the camera) the bloom's broad-area
  clamp is lowered 65 % and its intensity 40 % (`post.js` BLOOM_INDOOR); flames and sparks keep theirs.

## ENV-5 — the stall at the gates' opening

- **One program: the people's lead ropes** (a plain MeshStandardMaterial on a mesh made at the first led animal, not
  there at boot, so no warm-up could see it): 1.5–1.9 s on the HD 4600 at low. `render/warmup.js warmHidden` runs after
  'firstFrame', one object per idle slice: a kept stand-in mesh with a plain MeshStandardMaterial (same program key; kept,
  because disposing it released the program and three deleted it), then every hidden mesh outside the people's root
  (shown for its compile call only). Each linked program's first use, and env's uniform-block binding of it (a synchronous
  query), happen there too, before the next compile is issued. firstnight.js dawnMax 1420–1645 → 36–39 ms; the jump to
  sunrise − 12 (05:44) 79.6 ms; no new program on either. `?warmhidden=0` turns it off. warmup-check: all tiers and modes
  pass; low play's worst frame in the first 5 s 400–417 ms (434 with `warmhidden=0`; the first frame's own
  getUniformBlockIndex, pre-existing).

## ENV-6 — midnight

- **Playing past 24:00 moves to 00:00 of the next civil date (and back past 00:00 at a negative speed), emitting
  'time:date'**; frameDelta stays (a continuous step). `set(t)` still takes a minute of the current date. Friday 23:59 →
  Shabbat 00:00 (27 Heshvan stays, 'night-turning' no longer reappears); Monday → Tuesday keeps 23 Heshvan. Played through
  midnight on a Friday, a Shabbat and a weekday the G1 figures move ≤ 2.6 m in a frame (was a 43 m pop). g1-night still
  reports one pop on Friday and one on Shabbat because the test walks the 00:00 window with `time.set(W(t))` on one date
  (request filed).

## ENV-7 — years 0–99

- **Dates are built with setUTCFullYear** (`zmanim.js utcDayMs / addDays / formatDate`): any year 1–9999, proleptic
  Gregorian; `dateString` pads the year to four digits; year 0 is rejected with the existing warning. '0070-08-04' → 11 Av
  3830.
- **The sky follows the year:** the J2000 star catalogue is precessed to the date (IAU 1976; 0.36° today, 27° by 70 CE:
  the pole then lay 11° from Polaris, 8.5° from Kochab) and the planets' ecliptic longitudes take the general precession. Standish's
  table-1 elements are fitted to 1800–2050, so the planets are approximate far from it. — Rejecting years < 100 (or
  < 1800) and asking ui for a min on the date input; rejected: the Second Temple's own years are what a visitor might
  enter.
