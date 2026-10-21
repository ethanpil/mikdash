# world-4 — decisions

Scope: the open requests to the world builders and materials (`src/world/**`, incl. `src/world/materials/**`), plus one
additive param in `src/data/site.js` (`altar.rings` params.bilgah). Format: **choice** — why — alternative.
⚙ = reconstruction. Shots: `shots/world-4/{before,after}/` (medium), `after/low-*`, `after/high-*`; test logs
`shots/world-4/tests/`.

## Walls on the course table (decision: adopt)

- **Every Herodian wall face uses `herodian_wall_courses` / `herodian_wall_inner_courses` (1.00–1.20 m courses):
  the Mount walls and the Shushan chamber (mount/walls.js, gates.js), the court walls, flights' cheeks, podium sides,
  the Gazit and the Nitzotz exedra (courts/masonry.js, chambers.js, azarah.js, moked.js, lib/parts.js), and the
  Heichal's Ulam and otem faces (heichal/shell.js).** — One table for all, so courses run on across corners and from
  one builder's wall to the next; the old 1.1 m keys are no longer drawn (their texture sets are not baked, so the
  switch costs no memory). Alternative: courses keys on the Mount only (mismatched coursing where the walls meet).
- **The modelled set-out steps come from the course table: `src/world/materials/courses.js` `courseRuns(mats, key,
  z0, z1)` walks `ctx.mats.courseAt(key, y)` up a wall (y = site Z × AMAH, the textures' v) and returns the courses
  with their set-out flag.** The Mount walls step out 4 cm on each set-out course (detail ≥ 1; inner faces ≥ 2, now in
  the inner key); the courts' outer faces 1½ etzba'ot on each whole set-out course (detail ≥ 2), as before but on the
  table's heights. Without a table (an old library) it falls back to uniform `tile(key).rowH` rows. — The helper sits
  with the materials because the table is theirs; the builders only ask it. Alternative: each builder re-deriving
  the table from `tile(key).courses` (three copies of the same walk).
- **heichal/uv.js fits the Ulam's rovadin to texture rows chosen from the table (`courseRows`):** a rovad (3 amot,
  projecting) onto a SET-OUT row of its marble — shayish, kochla, marmara in turn (Bava Batra 4a; rows 0, 2, 4 of the
  table) — fitted to the row; the plain 1-amah courses between and the stones between the lintels onto a DRAWN-IN white
  row (row 3) at true scale, centred in it. — The old mapping assumed 1.1 m rows and the old white–kochla–veined
  cycle (rows 0/1/2 for the rovadin, two of them drawn-in rows whose baked shelter band then sat on a projecting
  course). Alternative: world-height UVs on the Ulam (its modelled courses would not meet the texture's joints).

## Materials

- **`herodian_wall_inner` / `_inner_courses`: the plain fine-dressed face's roughness 0.62 → 0.65 (0.63–0.67 with the
  stone-to-stone noise); flat fallback 0.65.** Measured first (in page, ORM read back): the baked map's mean was
  already 0.626 (0.60–0.86), not near-polished. The Ulam wing walls' streak (render-env-2-fix, `ulam-wing-s`) is the
  box-projected probe's reflection of the bright porch at a fine-dressed roughness; raising the map further would
  take the stone out of render's own 0.5–0.65 band, so the streak is returned to render with the measurement
  (before/after `ulam-wing-s`: unchanged in kind). Alternative: roughness ≥ 0.8 (matte chalk, not dressed marble).
- **`bedrock` (the Even Shetiyah) lighter: base / alternate #c2b394 / #b3a486 → #d9cdb2 / #cec2a6,
  patina and soil in the crevices 0.15 → 0.05 / 0.06, crevices and pits 0.5 → 0.35, the set's baked cavity AO 0.55 →
  0.3, and the macro preset MAC.ground → MAC.stone (the ground's 0.4 warm-brown tint).** — Pale meleke-type Jerusalem
  limestone beside the gold of the floor (`even-shetiyah` before/after); it stands indoors, so lichen and soil were
  wrong. Alternative: a new key (bedrock is used only for the Even Shetiyah).
- **New key `lead`: the silver set's maps tinted #6c7075 and roughened (× 3.6): weathered lead, no new texture set
  and the same shader program as silver.** For Bilgah's ring. Alternative: a flat key (a new program on the HD 4600)
  or iron (reads as part of the ring).
- **'logs' / 'bark' and 'soft': no generator uses an identifier `soft` (`kinds-wood.js`); the only `soft` in shader
  code is a declared local in env's interiors chunk.** Confirmed in page: the bark and log sets bake (`bark_fig`,
  `bark_pine`, `bark_olive`, `logs`, `logend`) and no shader error is logged on low, medium or high. The G3 report
  predates materials-2-fix's rewrite of the bark kind.

## Courts

- **Gazit: risers of one amah — tier tops 1, 2, 3, 4 over the floor on the same 1.1 treads (the last 1.05, to the
  side walls); the Nasi's seat stays 0.35 over the first tier with a footstool of 0.35 before it.** — people's `sit`
  has a 1-amah seat; every seated judge's feet now rest on the tier below (the Nasi's on the footstool). Anchor
  `courts.gazit.benches` carries `{ rIn, rOut, tz, seat, footstool }` so the sim can read the benches (its `GZ.tz` is
  still [0.9, 1.5, 2.1, 2.7] — request). Alternative: higher seats on the old tiers (stacked boxes).
- **The chavitin hearth is a firebox: a fire chamber (0.3-amah walls, floor 0.2 up) with its mouth toward the room,
  the griddle over a hole in its top slab, embers and four sticks inside; fire `courts.chavitin.hearth` (hearth,
  0.4 m, 'service', 0).** — "under the griddle" (the request); the old solid stone block could not hold a fire. Its
  place is the sim's stand-in's (251.75, 316.5). Alternative: a fire on the floor beside a solid hearth.
- **Lamps ('lamp', 'service', intensity 0, on the existing stone bracket): `courts.chavitin.lamp` (north wall, 4.2 up),
  `courts.golah.lamp` (west wall, 4.4), `courts.parvah.lamp` (east wall by the door, 4.4) and
  `courts.moked.showbread.lamp` (Beit Garmu's bakery, west wall over the table, 3.6).** ⚙ places. "A lamp in the
  bakery" is read as both the chavitin bakery and Beit Garmu's showbread bakery; both have one. Brackets are not
  colliders.
- **Beit Garmu's chamber (Yoma 38a) re-laid inside its 4½ × 5½ amot: the oven (r 1, was 1.3) in the corner beside
  the door, a dark mouth toward the room; the kneading table (2 × 1.4 × 1.7, was the full width) against the far wall
  away from the oven.** — The old table stood 0.7 amah (34 cm) from the door's wall across the whole room: no room to
  stand at it and the doorway blocked. Now 1.8 × 2.1 amot of floor before the table and the door's approach clear.
  Anchors `courts.moked.showbread.knead` (217.35, 394.05; facing 180; `table`) and `courts.moked.showbread.oven`
  (219.6, 394.9; facing 0; `oven`, `radius`). Alternative: shaping outside, as G4 stages it now (still possible).
- **The thirteen shofarot (Shekalim 6:5–6) stand as a ring in Ezrat Nashim with the kinnin chest on offerings.js's
  station (285, 348, +6), in the Mishnah's order counter-clockwise: new shekels, old shekels, kinnin, gozlei olah,
  wood, frankincense, gold for the kaporet, six nedavah — so the six nedavah close the ring beside the new shekels.**
  Shekalim 7:1–2 rules on money found "between" the shekels and the nedavah, the wood and the frankincense, the
  kinnin and the gozlei olah: those chests stood side by side, which a row in the Mishnah's order cannot give for the
  first pair ⚙ (ring). Form ⚙: "chests whose mouth is narrow above, like a shofar, narrow above and widening"
  (Bartenura, Shekalim 2:1): a cedar chest (0.9 amah square, 1.4 high) under a bronze horn narrowing to a 0.07-amah
  mouth (2.3 amot in all, about 1.1 m), each turned to face the ring's centre. Ring radius 2.6 amot, 1.26 apart;
  centre (285.6, 345.5), south by east of the kinnin chest — the direction farthest from both of the metzora's legs
  past it (1.15 amot from a chest's corner to either, solved over the ring's radius and bearing). Clear of the
  Levites' way from the north music cellar to the steps (Gevini, G3), and of the women's places (courts-daily). The
  inscriptions are not drawn (no text textures); anchors `courts.en.shofar.1…13` carry each one's label, the stand
  point outside the ring facing the chest, and `chest` (its mouth). Static, in batches the courts already draw, so no
  draw calls are added. world-4-fix added iron fittings, a lipped lid, a framed label field and a `copper_worn` horn. Alternatives: a row eastward (crosses the metzora's way and a women's place), westward (the Levites'
  way), or the report's Azarah (out of the yoledet's reach — offerings-data).
- **The three nazirite pits all lit: the middle keeps `courts.en.nazirites.hearth` ('day' — the sim states its level
  all day); `courts.en.nazirites.hearth.0` (Y 275) and `.2` (Y 289) are new, 'service', 0; sticks under every pot.**
  — Each set cooks at its own pit (G4). Alternative: renaming the middle (breaks the sim's id).
- **The Moked's chel door, and every gate pair in the courts, get a lapping meeting astragal: each leaf of a pair
  carries a batten on its +z face at the meeting stile (0.08 wide, 0.06 proud on the frame), lapping 0.12 past its free
  edge; its fellow's +z is the other side, so both faces of the 0.04-amah joint are covered** (`lib/kit.js`
  `leafGeometry(…, o.astragal)`, `ASTRAGAL`; LEAF goldLeaf / bronzeLeaf; the Moked gate's east leaf with the wicket).
  The night line over the hearth is gone (`moked-chel-door-night` before/after). The cedar chamber pairs share one
  instanced set with the single cedar doors, so they keep the joint (splitting the set costs a draw call; open by
  default). Alternative: closing the joint by widening the leaves (they would collide when swinging).
- **The Water Gate terrace's two parapets (and the landing's) at site.js's ROOF_PARAPET_H, 10 tefachim (1⅔ amot),
  read from the landing's parapet box; the mikveh screen's poles stand on the lowered parapet.** — Were 2 amot.
- **Courts logs: one bark species per log, from a hash of its place (`lib/parts.js` `barkSpecies`, `BARK_KEYS`; one
  instanced set per species); at detail 0, where the only logs are the sticks in the fire pits, one species (walnut).**
  — Tamid 2:3's fig, walnut and oil-tree; the box piles' texture already mixes them. Detail 0 saves 4 draw calls for
  sticks under pots.

## Altar

- **Bilgah's ring: site.js `altar.rings` params.bilgah = { index 14, mishmar 15, ring [221, 359.5, 16] } (additive,
  with a runChecks check: one of the 24, not a tamid ring).** "Its ring fixed" (Sukkah 5:8; 56b); Rashi 56a: 24 rings
  "against the 24 mishmarot", turned up for the neck and back into the floor, "Bilgah's is fixed and does not turn".
  Which ring was whose is not recorded ⚙: mishmar n ↔ positions[n − 1] in the list's order; Bilgah is the 15th
  (Divrei HaYamim I 24:14) → index 14, used by no choreography (G2's tamid rings 1, 2; G5's lanes 5, 7, 8, 10, 13, 15;
  G4's 11, 16, 18). Alternative: the 3rd ring of the south half, as the heichal builder numbered the knife niches
  (rings have no halves).
- **Drawn folded down like the others, with lead run over its staple (0.19 × 0.14, 0.11 high) and over its far arc
  onto a second footing plate (0.17 × 0.12, 0.1 high) — the ring cannot be raised.** Anchors: `altar.ring.14` labelled
  as Bilgah's (`bilgah`, `fixed`) and `altar.ring.bilgah`. One draw call (`lead`).
- **Bark per billet on the piles, the kevesh brands and the kitchen's wood (fire.js, kevesh.js, kitchen.js): fig,
  walnut, pine from their own random streams (nothing else on the altar moves); the incense pile all fig ("fine fig
  wood", Tamid 2:5).** The movable great pile has a mesh per bark (build/grow unchanged). +2 static, +2 pile draw calls on medium and up;
  at detail 0 every billet is walnut, so low has no extra calls (world-4-fix).
- **`light: false` on `altar.maarachah.incense` and `.kiyum`** (render-env-2): their flames, glow and smoke stay.

## Heichal

- **Movable `heichal.shulchan.bread`: the twelve loaves, the kanim between them and the two bazichin with their
  levonah. `userData.slide(f, south = true)` draws it off the table by f × (its depth + the horns) to the south (or the
  north); `open(f)` (the last direction, south by default), `openGroup('south'|'north', f)`, `openAmount`; `show(bool)`;
  `kanim(bool)`.** Menachot 11:7: the
  outgoing draw in the south as the incoming set down from the north. The kanim go with the bread (they rest on the
  loaves' walls and would float), and can be hidden for Shabbat (pulled on Friday — Menachot 11:6; where they are laid
  along the table is not drawn). The snifin stay with the table (the sliding stacks pass through their forks for a few
  seconds). Net +2 draw calls (4 meshes; the static bread and frankincense meshes are gone). Alternative: two
  movables (the stacks / the bowls) — the exchange moves them together. world-4-fix added the incoming set,
  `heichal.shulchan.bread.incoming`, so the table is never bare.

## Mount and terrain

- **Olive trunks in `olive_bark` (was the firewood's walnut bark); the city's rubble walls and walled yards in
  `house_rubble`, its earth roofs in `roof_earth` (were terrain_rock / ash).**

## Requests

- **G4 / sim (sanhedrin.js `GZ`):** tz → [1, 2, 3, 4] (or read anchor `courts.gazit.benches`); the Nasi stands on the
  footstool (rIn[0] − 0.75 … − 0.05, top 0.35) to sit.
- **G4 (chambers-daily):** light `courts.chavitin.hearth` (at the stand-in's place; retire `sim.chambers.chavitin`),
  `courts.chavitin.lamp`, `courts.en.nazirites.hearth.0/.2` (retire `sim.chambers.nazirites.0/.2`),
  `courts.golah.lamp` for the draws before light, `courts.parvah.lamp` for the salting; Beit Garmu: knead at
  `courts.moked.showbread.knead`, bake at `.oven`, light `courts.moked.showbread.lamp` on Friday.
- **G4 / G5 (women-court, bird offerings):** the women's gift goes into a shofar: anchor `courts.en.shofar.3` (kinnin)
  / `.4` (gozlei olah), `.1` (new shekels) etc. — stand and face given.
- **G6 (shabbat-showbread):** (rewritten by world-4-fix) the exchange is simultaneous (Menachot 11:7), so drive both
  sets: `incoming.show(true)`, then for f 0 → 1 `heichal.shulchan.bread.slide(f, true)` together with
  `heichal.shulchan.bread.incoming.slide(1 − f, false)` (they stay a set's depth apart, handbreadth beside
  handbreadth); `bread.show(false)` once the old is in the kohanim's hands. To end, swap back (the sets are
  identical): `bread.slide(0)`, `show(true)`, `kanim(false)`; `incoming.show(false)`, `slide(1, false)`.
  `kanim(false)` from Friday's pulling to after Shabbat. Bilgah's caption can point at `altar.ring.bilgah`.
- **render:** the Ulam wing walls' streak is the box-projected probe at roughness 0.65 (map measured 0.60–0.86, mean
  0.626 before this change); the √k widening does not remove it.
- **orchestrator:** docs/API.md (see the report's api field).

## Verification

- `npx vite build` passes (output deleted). site.js `runChecks()`: ok, 1553 checks (was 1552), 0 failures.
- nav-coverage (low): 132 targets; the only failures are `roof` from both origins, as before. 893,581 nodes (was
  893,608: the chests, the footstool and the firebox), collider triangles 98,334 (97,964).
- Sim tests (low, `shots/world-4/tests/`): g4 ok (deterministic on a weekday, a Friday and a Shabbat; cues exact;
  one close pair of two sim walkers, 0.289 m at 14:15), fires ok, g2 ok (ways: 0 legs blocked), g6 ok, jumps ok,
  g1-night ok. validate-schedule: 0 errors / 0 warnings; coverage: no gaps (longest 7 min).
- Console clean on low, medium and high (no shader errors; every bark and log set bakes; only the course-table
  Herodian sets bake now).
- Meshes by area (draw calls when all in view) / triangles: low — terrain 20 / 146k, mount 29 / 98k, courts 43 / 56k
  (as world-3), altar 39–40 / 40k (+4–5: the barks and the lead), heichal 40 / 29k (+2: the bread movable); high —
  terrain 38, mount 34, courts 53, altar 43, heichal 43. Frame draw calls on medium (incl. shadow and pre-passes): +6
  to +25 per view against the before shots; low 29–198 per view.
- Shots read: medium before/after (walls, Ulam wing, Even Shetiyah, Gazit, chel door at night, Water Gate terrace,
  rings, altar), after (shofarot, Bilgah's ring, altar pile, the bread slid half off, chavitin hearth and lamp, the
  nazirite pits, Golah / Parvah / Beit Garmu lamps — lamp shots taken 4 s after lighting, so the exposure has adapted;
  the first frame after forcing a lamp whites the room out, the existing Kelim lamps alike), low and high (walls
  close, Ulam front, shofarot, Bilgah, pile, Gazit, Even Shetiyah, chel door, olive trunks, city).
