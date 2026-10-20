# builders-2-outer — decisions

Scope: `src/world/terrain/**`, `src/world/mount/**`, `src/world/courts/**`, plus one additive annotation in `src/data/site.js`
(`params.underpass` on the eight court flights). Applies the site-model-2 deltas and clears the outer area's geometry blockers
found by `tools/nav-coverage.mjs`. Format: **choice** — why — alternative. ⚙ = reconstruction-class.

## The Mount pavement and the Moked's winding stair
- **No Mount pavement under the court complex (the walls' outline X 63–400 × Y 258–403, and the Gazit and Moked podiums).** —
  build-courts fills the courts solid from Z 0, so the pavement there lay hidden inside the fill, and over the Moked's winding
  stair it capped the shaft at Z 0: the underground passage, the Beit HaTevilah and both dawn-immersion views were unreachable.
  One rule opens the shaft and removes the hidden pavement (and its floor cells) from inside the fill. — A hole for the
  shaft alone (keeps the hidden pavement inside the solid).
- **Round the shaft, under the Moked podium, the underground masonry rises to Z 0 to meet the court fill.** — it stopped
  1.2 amot under the old pavement, which left an open slot round the shaft between −1.2 and 0 once the cap was gone. Under the
  Mount north of the podium it still stops at −1.2 (the pavement is there).
- **The 0.9-amah floor bridge at the head of the Moked stair is gone; the marble landing step is carried out to the shaft's
  walls instead and meets the NW chamber's door on the south wall.** — the bridge and the landing overlapped coplanar at +16,
  and the landing's round edge left a crack against the shaft walls. — Keep the bridge and clip the landing to it (two
  floors, one joint).

## The chel: vaults under the flights (Middot 2:3; Parah 3:3, 3:6) ⚙
- **Every court flight that crosses the chel stands on a semicircular barrel vault over the chel walkway: its axis along the
  chel, spanning 0.75–8.25 amot out from the flight's head, springing at +4, crown +7.75 (params.underpass in site.js).** —
  The N/S gate flights (EK I 202–215), the Moked, Gazit and Etz flights each cross the whole 10-amah chel, 6–16 amot above it,
  and their soreg passages are the flights themselves; so the chel between two flights was a closed pocket (the event
  `court-in-chel` and most of the chel could not be walked; only the east chel was open, from the chel steps). Vaulting is
  the attested construction of the precinct: the Mount and the courts stood on hollows (Parah 3:3, "the Temple Mount and
  the courts — beneath them hollow"), the Parah causeway on "arches upon arches" (Parah 3:6). The flights keep their
  site.js boxes, risers and treads; the chel stays continuous at ground level under each. — Flights turned parallel to the
  walls (changes every flight box and the soreg passages, and a 16-amah run along the wall eats the chel's width); wider
  soreg passages with open-sided flights (the chel would still be cut at every flight).
- **The springing is at +4 amot (1.92 m), not lower.** — the nav bounds a wall triangle by its full height: any arch face
  lower than the walker's 1.75 m head walls off the whole vault mouth. At +4 every intrados and spandrel face clears it, and
  ≥ 2.2 amot (≈ 1.06 m at 48 cm) of masonry still lie under the treads at every point of the span: the least is at the
  tread corner 7 amot out from the head, where the 1:1 flight comes down toward the arch's haunch (2.205 on all eight flights;
  the arch's chords only add stone). — A lower, flatter segmental arch.
- **The cheek walls are built as three prisms (pier, over the arch, foot), not one notched prism.** — earcut triangulates a
  notched cap with triangles reaching from the foot (Z 0) across the passage to the head; the nav then treats them as a
  wall from the ground up along the whole flight. Split, no cap triangle over the passage reaches below the springing.
- **The vault's faces are dressed limestone (`ashlar_plain`), as the cheeks.** — the flights' sides are already plain
  dressed stone; the drafted Herodian face stays on the court walls.
- **Known gap (asked of site-model):** the space under a vault is inside the flight's box, which belongs to the gate's zone
  (priority 31), so the HUD names it after the gate rather than the chel while one walks under it.

## Har HaMishchah (Middot 2:4; Parah 3:7–9)
- **The ground anchors and the terrain viewpoint read `groundEye`; a new anchor `mount.har-hamishchah.kohen-stand` is the
  kohen's stand on the arrangement (`kohenStand`, facing west).** — site-model-2 moved `kohenEye` onto the pyre (Parah 3:9:
  he "descended" after sprinkling); it is no longer a ground point. The kohen-stand anchor is for the sim and the people
  (it is only stood on when the hidden pyre `parah.pyre` is shown).
- **The terrain grid gets lines on the edges of the burning place's graded flat, its stone floor and the tank, on every
  tier; the ground is cut out under the floor and the tank, and graded LIFT (0.17 m) under the floor's top.** — on low the
  coarse cells straddled the flat, so the ground round the floor sagged to ≈ 1 m under its top (2 amot) and the stand could
  not be reached. Now the flat is exactly level on every tier, the floor stands as a 17 cm platform, and the Parah path's
  paving (draped LIFT over the ground) meets its top. — Steps round the floor (the floor itself is unsourced; a step is a
  second invention).
- **The beit tevilah's tank moved ¼ amah east, its west wall against the floor's east edge; the floor is closed underneath
  and the tank has a floor collider.** — it overlapped the floor's corner; with the ground cut out under both, each must be
  closed.

## Courts (site-model-2 deltas)
- **The Gazit's east door is the clear opening Y 372–380** (the builder's `+1` dropped); **the Golah and south-trio doors
  read site.js `door.x` / `door.z`; the Pinchas and chavitin doors to Ezrat Yisrael read `params.door` (4 × 8, west face).**
  — site.js now records them; the values match what was built except the Gazit's south jamb.
- **The kiyor's well (azarah.floor params.shafts) is carved from the court fill as a plastered shaft, Z 2–16, its water
  1½ amot under the pavement (+14.5) ⚙.** — The muchni *sinks* the laver into the well's water overnight so its water is
  not disqualified by linah: Abaye, "a wheel that sank it" (גילגלא דהוה משקעא ליה, Yoma 37a); "a kiyor he did not sink
  in the evening" (כיור שלא שקעו מבערב, Zevachim 20a). build-altar lowers the laver 4.8 amot (its rim to +14.13, its bail
  ring to +15.75), so the water must stand above +14.13 to cover it: +14.5 puts the laver under water with the bail and ring
  above it. — Water at the bottom of the 14-amah shaft (the laver would hang dry above it, against the sources' purpose).
- **The N/S Azarah walls run to X 260 (site.js), so the EN N/S walls' cornices (+46) stop flush at X 260 instead of
  returning round their west ends; the low E wall's buried end faces lose their set-out courses (detail ≥ 2).** — the
  returns were now buried in the 56-amah walls and their 0.6-amah overhang stuck out of those walls' faces as stubs. The
  Azarah wall's own cornice still wraps its end above the EN wall.
- **Water Gate stair head: 15 steps to the turn (was 14), starting at the south-west and ending due north of the newel; the
  well in the roof is the stair's square less its north-west quarter, which stays roofed as the landing onto the terrace
  walk, with a 10-tefach parapet on its open south edge.** ⚙ — the old top step ended at 147°–173° inside a square hole: a
  crack and a wedge stood between it and the walk, and the nav could not reach Beit Avtinas' door (or the Barkai view).
  With the top step ending at 90° the walker steps off westward straight onto the landing; under the landing the turn below
  keeps ≥ 5 amot of head room, and the foot is still entered from the room's west part. — A wider landing step (still a
  round edge against a square well).
- **Newel stair heads (Water Gate, Nitzotz, Medichin, the Moked descent): the top step's outer edge is carried out to the
  well's rectangular edge (`spiral({ topRect })`, corners included).** — the steps stop 0.05 amah (2.4 cm) short of the
  shaft, which left a crack, and a wedge at the square's corners, between the last tread and the floor.

## Night watch (Middot 1:1–2; Rambam BhB 8:4–10)
- **The ten Levite posts of the courts (outside the Delek, Bechorot, Mayim and Korban gates; at Nikanor; at the Azarah's
  four outer corners; behind the Beit HaKaporet) carry torches on iron wall brackets (schedule 'night'), as the Mount's Levite
  posts do; the kohanic posts (Beit Avtinas, Beit HaNitzotz, the Moked) keep their lamps.** ⚙ fittings — the Azarah's posts
  had stone lamp-stands and small lamps, unlike the Mount's torches. Gate posts: a torch either side of the gate on the outer
  wall face, 1.8 amot outside the jambs, 5½ amot over the threshold; Nikanor: outboard of the two wickets; corners: on the
  N/S face just in from the corner. Each torch: iron arm and socket, a wooden shaft and a charred head under the flame
  (render draws only the flame). — Free-standing torch stands (the posts stand against the walls).

## Review fixes (builders-2-outer-fix)
- **The vault's masonry figure is corrected to ≥ 2.2 amot** (above; it said 2.75). The structure is unchanged.
- **`azarah.gate.mayim.house.params.roofStair.asBuilt` records the head as built: perTurn 15, the top step ending due north of
  the newel, the well (the square less its NW quarter), the landing and its parapet boxes, and the walk's east end
  (`walkEndX` 223.25).** — `headOpening` ("not walkable") and `terraceWalk.box` (east end X 221.3) describe the earlier head.
  Rewriting them is site-model's call: runChecks keeps the walk off the stair box. An additive key keeps the data true
  meanwhile. — Leave site.js stale until site-model lands.
- **`arc()` is removed from `courts/lib/geo.js`**: the vault work left it with no callers. The file's CRLF endings are kept.

## Verification
- `node tools/nav-coverage.mjs` (low): 2 failures, both the Heichal roof (zone `roof`, +112; build-heichal's — no way
  up from the aliyah landing at +67). Every outer-area target passes, among them `underground-passage`, `beit-hatevilah`,
  `mesibah-keri`, `dawn-immersion`, `beit-avtinas`, `watch-upper-chambers`, `barkai`, `har-hamishchah` and `court-in-chel`;
  a probe along the whole chel ring (under all eight vaults) reaches every point from the start.
- `runChecks()` PASS (1552); `validate-schedule` 0 errors; `vite build` passes. Shots: `shots/builders-2-outer/` (low and high).
