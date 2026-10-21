# people-3 — decisions

Format: **Choice** — why (source / reasoning) — alternative. Builds on `people.md`, `people-realism.md` and
`people-realism-fix.md` (all still valid unless noted). Requests from the choreography logs (`choreo-g1-night.md`,
`choreo-g2-altar*.md`, `choreo-g3-sanctuary.md`). Shots: `shots/people-3/lineup-{low,high}-{close,medium}-*.png`
(the `?debug=people` lineup in the people harness: rows G, H, I), `shots/people-3/app-*.png` (the same lineup in the
app, sunrise + 2 h), `shots/people-3/lineup-low-lod2-vessels.png`; work in progress in `shots/people-3/wip/`.

## Roles

- **`kohen_elder`: the elder rig (stoop, 1.64 m) in the four garments, grey to white hair, receding hairline, a long
  beard; in `sleep` / `lie` he wears his own clothes (the elder's tunic and mantle), lies on his folded garments and is
  covered by his own mantle; `kohen_elder_offduty` is the same man awake in his own clothes** — Tamid 1:1 ("the elders of
  the beit av sleep there … they did not sleep in the holy garments but took them off, folded them and laid them under
  their heads, and covered themselves with their own clothes"). Mirrors `kohen` / `kohen_offduty`, so G1's elders can
  rise and open the door in their own clothes without a costume change. — Re-using `elder` (no garments) or the
  young `kohen_offduty` body (G1's stand-ins).
- **The elders' bedding on the rovadin is the same bundle and mantle with the kesset folded double along its length
  (0.42 m wide, `folded_garments_ledge`)** — the ledges are 1 amah deep (`courts/moked.js`, `g1/places.js`); the young
  men's 0.78 m mat would hang 0.3 m over the edge. That the elders had a kesset at all is not stated (the Mishnah says it
  of the young, "each his kesset on the ground"): **reconstruction**. — No mat (bare stone) or the full mat.
- **`kohen_breeches`: bare from the chest up, head bare, plain linen breeches from just under the chest to the knee,
  gathered by a drawstring, bare shins** — Tamid 5:3 ("they stripped them of their garments and left them only the
  breeches"); Rambam Klei HaMikdash 8:18 (from above the navel near the heart to the knee, closed like a pouch, with
  shnatzim — checked on Sefaria), Shemot 28:42. Plain linen (pattern `LINEN`), not the ketonet's boxed weave. The
  drawstring's knot at the front is **reconstruction**. — A mask hiding the ketonet (there is no body under it).
- **`kohen_bathing`: bare upper body and a linen sheet wrapped from the waist to mid-calf, tucked at the front left;
  kohanic roles (`kohen`, `segan`, `kohen_offduty`, `kohen_breeches`, the elders) switch to it automatically in
  `bathe` (`kohen_bathing_old` for the elders)** — Tamid 1:1–2 (he went down and immersed, came up, dried himself and
  warmed himself at the fire), Yoma 3:3 (a linen sheet spread between the Kohen Gadol and the people). Kept modest: the
  immersion itself is without garments (anything on the body would interpose), so the wrap stands for the towel
  ("nistapeg") and the water hides the rest; the sim puts the figure in the pool. — An unclothed figure; a wrap that
  pretends to be worn in the water (wrong halachically).
- **Bare bodies are sculpted only where they show: pectorals over the sternum's groove with a soft lower border,
  collar bones, shoulder blades, the spine's furrow, the lats; the deltoid rounds the shoulder (the torso's shoulder line
  sits inside it and the arm's cap is tucked under the trapezius slope); biceps, triceps, the forearm's bulk** — at the
  walk-through distances the figure reads as a man, not a mannequin; first versions showed a collar "plug" at the neck,
  knob shoulders and a flat chest (`wip/s-bare-close*.png`). No nipples or body hair (modest; vertex shading cannot
  resolve them). — Full anatomical meshes (cost) or garments over everything.

## Poses (figure frame: metres, −z ahead, +x his right; `ctx.people.stations` exports the numbers)

- **`sit_floor` sits back on the heels: knees on the floor ahead, shins along it, hands on the thighs** — Tamid 1:1
  ("he came and sat beside his brothers"); held for hours by the fire. The first version sat with the knees drawn up:
  the robe stood over the knees like a table with bare shins below (`wip/s-sit.png`); kneeling-sitting keeps the robe
  over the legs through the skirt cage, as kneeling does. — Cross-legged (the cage cannot spread the robe 90°).
- **`call`: both hands cupped round the mouth from below (a funnel), chin raised, the chest lifting with each call** —
  Yoma 20b (Gevini the crier, "Arise, kohanim, to your service!", heard three parsaot). The gesture is
  **reconstruction**.
- **`knock`: three raps with the knuckles on a door 0.47 m ahead, then a pause** — Tamid 1:2 ("the officer comes and
  knocks on them"). The rhythm is **reconstruction**.
- **`lift_mitre` + `Actor.setHeadgear(false)`: the officer reaches to the crown of the man 0.5 m before him, grasps the
  migba'at at `MITRE_GRASP` (0.33), lifts it high (0.4–0.62) and holds it at the chest; the sim swaps the officer's
  prop to `migbaat` and calls `target.setHeadgear(false)` at that moment; the hair (with strand shells close up)
  shows** — Yoma 25a ("the officer comes and takes the mitznefet from the head of one of them, and they know the count
  starts from him"). The headgear (migba'at, mitznefet, tzitz) is now in a mask group, on by default. — Hiding the whole
  head-dress by swapping archetypes (an extra batch per man).
- **`lock`: the key held by its ring, the long key's shaft running on from the fingers into a lock 0.5 m ahead at chest
  height; turned 90° over 0.15–0.45, back over 0.65–0.95** — Middot 1:9 (the kohen locks from within). The `keys`
  prop now has a fist grip (ring in the hand, keys along the fingers), so walking with the keys they hang from the
  hand, and G1's `point` turn points the key forward. — The old identity grip (keys sticking out from the thumb).
- **`staff` (planted, the hand 0.1 m below the top of a 1.25 m staff), `staff_walk` (planted with the left foot and
  passed over, then swung forward) and `strike` (raised by 0.35, down onto a man lying ≈ 1.3 m ahead by 0.5)** —
  Middot 1:2 ("if he found him asleep he struck him with his staff"). Staff length and form are **reconstruction**.
- **`windlass`: hand over hand on the pegs of the muchni's wheel as built (`world/altar/kiyor.js`: rim r 1.7 amot,
  axle 2.6 amot up, pegs on the west face): the hub 0.75 m to his left and 0.55 m ahead, each hand pulls a peg from 30°
  to −15° (0° = right of the hub) while the other returns clear of the pegs; the wheel turns π/2 per cycle with the rim
  on his right going down (the operator faces east: `wheel.userData.spin(+)`)** — Tamid 1:4, 3:8; Yoma 37a. Who
  turned it and how is **reconstruction** (G2: the winner himself).
- **`kiddush`: a deep stoop, standing, right hand on the right foot and left on the left, palms on the insteps** —
  Zevachim 19b ("he places his right hand on his right foot and his left hand on his left foot and sanctifies";
  sitting is excluded — "sheirut is standing"). The knees bend (≈ 90°) because the hands cannot reach the insteps
  otherwise. — R' Yosi b. Yehudah's hands-on-hands (rejected there as impossible).
- **`rinse`: hands working the innards on a marble table 1½ amot high** — Tamid 4:2; Rambam BhB 5:14 (the tables' use);
  height from `site.js` (`altar.marble-tables`, ⚙). New free prop `entrails` for the table.
- **`carry_lamb` / `carry_lamb_walk` with `lamb_dead`: the slaughtered lamb across the forearms, its back against the
  carrier, head hanging to his left, legs dangling** — G2's request (the slaughterer carries the dead lamb to the hook,
  Tamid 4:2 ⚙). `lamb_dead` is baked from the live lamb rig (unflayed, limp, on its left side); free, it lies on the
  ground with the legs out (also G5's unflayed-carcass request).
- **`pour_low`: bent (hips and knees) to pour at the floor ahead, the vessel tipped 78° over its front lip; the left hand
  on the left knee** — Tamid 7:3 ("he bent to pour"), 5:5 (the coals emptied from the silver pan into the gold one). A
  new grip class `pour` holds pans and jugs upright with the lip along the thumb (falls back to `fist`), so the same
  hand motion pours from `wine_jug`, `kuz`, `flask`, the `machtah`s, the `mizrak`s, `bowl`, `teni`. The fist ends
  ≈ 0.45 m above the floor (the task's 0.35 is out of reach with the torso at 45° for a 1.67 m man without a squat).
- **`wave_sudar`: the cloth swung overhead from side to side; a second cloth may hang in the left hand (`setProps`)** —
  Tamid 7:3 ("the segan stood at the horn with the sudarin in his hand … the segan waved the sudarin"). The `sudar`
  prop now hangs from a pinched corner in a narrow drape with deep folds (rigid; props are skinned to one bone); laid
  down (`free`) it lies flat.
- **`tend_lamp` with `taper` (+ the `kuz` in the left hand): the taper's tip at the lamp's mouth ≈ 0.84 m above his
  feet and 0.45 m ahead** — Tamid 3:9 (the stone with three steps before the Menorah; the kuz on its second step), 6:1.
  With the Menorah 18 tefachim high and the stone 1½ amot (site.js ⚙), the lamps are ≈ 0.72 m above the top step: a
  forward stoop. The `taper` (a splinter with a linen wick) burns with a small `lamp`-kind flame (`PROPS.taper.flame`);
  the tool itself is **reconstruction**.
- **`warm` (hands held out to a fire, now and then rubbed) and `bathe` (down into a deep crouch, under 0.3–0.6, up)** —
  Tamid 1:1. `warm` was not requested but the keri and the five immersers stand warming themselves at the fire in G1.

## Props

- **`staff`** (above). **`migbaat`**: the hedyot's wound linen dome off the head, held by its crown — the same profile
  as the worn one (Rambam KhM 8:2 "like a hat").
- **`psachter` / `psachter_inverted`: a deep copper vessel holding a letech (15 se'ah ≈ 124 l at R' Chaim Naeh,
  scaled with the amah), sooty inside, a rolled rim, two rings and two chains (≈ 1.6 m) lying on the floor; inverted =
  mouth down over the coals** — Tamid 5:5 ("a large vessel holding a letech, with two chains: one he pulls by and goes
  down, one he holds from above so it does not roll"; "they turn it over the coals on Shabbat"). Copper because every
  vessel of the outer altar was copper (Shemot 27:3); the shape is **reconstruction**. Chains are links at LOD0, a
  cord at LOD1.
- **`kaf` remodelled to hold exactly 3 kav (≈ 4.1 l, was ≈ 1.3 l), a deep gold vessel with a short side handle;
  `kaf_covered` adds its domed cover and a linen cloth over it** — Tamid 5:4 ("like a large gold tarkav holding three
  kav, the bazach in it full and heaped; it had a cover, and a kind of metotelet on it from above"), 7:2 ("the kaf and
  its cover in one hand"). Metotelet read as a covering cloth (the commentators' "a cloth spread over the vessel") —
  **reconstruction**. Same names and grips, so existing staging keeps working.
- **`gizrin_branch`: a round fig branch ≈ 1 amah long, smooth grey bark, pale cut ends with rings, lopped shoots
  (shoulder, tray, free); `branch_bundle`: thinner branches tied at two places (shoulder, tray, free)** — Tamid 2:3
  ("murbiyot of fig, walnut and oil-wood"); the `log` (1 × 1 amah slab, Zevachim 62b) is unchanged. Fig chosen for the
  bark; walnut / oil-wood would differ only in bark — **reconstruction**.
- **`limb*_charred`: the seven limbs' geometry with every flesh material swapped for a cracked black crust over
  dark roasted meat (new pattern `CHAR`, 39, FLESH group) and the head's wool singed black** — Tamid 2:1 (limbs not
  consumed since evening, put back on the fire), for G1's pile. Same grips, so a limb can be swapped in place. No
  emission: the pyre's flames light them. — Emissive embers (would need light-unit plumbing in the people material).
- **`folded_garments` gets a two-hand `tray` grip** (the chazzanim of Tamid 5:3, a kohen dressing).
- **`entrails`**: the coiled intestines and stomach for the rinsing table.

## Rendering and engineering

- **Ritual vessels in an actor's hands stay drawn at LOD 2** (`HELD_VESSELS` in props.js: the mizrakot, machtot, kaf,
  kaf_covered, bazach, kuz, teni, flask, bowl, cup_gold, wine_jug, oil_flask, solet, chavitin, entrails_bazach,
  machavat, marcheshet); crowds keep only big props there — G2's request (vessels vanished beyond ≈ 9 m on low). LOD2
  uses the LOD1 prop geometry (the same batch), and the per-tier prop-batch cap still applies.
- **Headgear and bare-head groups by the instance mask (`GRP.HEADGEAR` = bit 8, on by default; `GRP.BARE` = bit 16, the
  hair's strand shells at LOD0)** — no extra archetypes or draw calls; ≈ 1.4k hidden triangles per LOD0 kohen.
- **Per-role pose variants (`poseVariant`): `offArch` / `offProp` for sleeping, `bathArch` for bathing**, used by
  actors and crowds alike; the existing `kohen_offduty` behaviour is unchanged.
- **Props can carry their own flame (`flame: { size, intensity, kind }`)**; a prop swap relights.
- **Cost**: 18 more baked clips per human rig (atlas 6.5k → 8.9k frames with every rig loaded, ≈ +2 MB half-float);
  bake per rig ≈ +100–300 ms on first use (geotime.mjs). New archetypes ≈ 14.7k / 2.3–2.5k / 0.55–0.6k / 0.26–0.29k
  triangles (LOD0–3), like a kohen. `psachter` 7.2k at LOD0 (chain links), `lamb_dead` 10k (the lamb's LOD0).
- **Clip conventions learnt the hard way**: `openHand`'s `thumb` is the flat hand's thumb side, perpendicular to the
  fingers (the first `call` had them nearly parallel: hands crossed at the throat); an elbow hint opposite the
  shoulder-to-wrist direction cancels out (elbows crossed in front).

## Verification (HD 4600, other agents' builds running alongside)

- `npx vite build` passes; `src/people/dev/geotime.mjs` builds every archetype and LOD; every prop × grip class × hand ×
  LOD (442 variants) builds in Node.
- `src/sim/dev/run.mjs --q low --script src/sim/dev/tests/g1-night.js "t=n3"`: ok, nothing failed; deterministic on the
  weekday, Friday and Shabbat dates (the Moked's sleepers go through the new pose-variant code).
- `tools/nav-coverage.mjs --q low`: 130 of 132 pass; the two failures (zone `roof` from both origins) are world
  geometry, unrelated to people (people register no colliders).
- App, `?debug=people` at sunrise + 2 h, low tier: 43 fps, 185 draw calls, 0.53 M triangles with the whole lineup
  (359 figures) in view; high: 24–26 fps, ≈ 1.1k calls. Console clean apart from ANGLE's X4122 notes and the favicon 404.
- Vessels at LOD 2 (`lineup-low-lod2-vessels.png`): LOD 2 actors carry solet, chavitin, wine_jug, keys, migbaat … and
  the vessels among them stay drawn.
