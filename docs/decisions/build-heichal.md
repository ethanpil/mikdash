# build-heichal — decisions

Scope: `src/world/heichal/**` — the otem, the Ulam (facade, rovadin, the five milah lintels, interior fittings, the beit
hachalifot), the great gate and wickets, the Kodesh and its vessels, the amah traksin and the parochot, the Kodesh
HaKodashim, the ta'im, mesibah, water-descent house, aliyah, the ceiling and roof courses, the ma'akeh and kalya orev.
Every position and dimension is read from `src/data/site.js`; the bullets below are the choices the sources leave
open. Format: **choice** — why — alternative.

## Method
- **The whole masonry is ONE greedy-meshed box solid (otem pieces + Ulam block + ta'im mass + aliyah block + lintels +
  parapets, minus every room, void, opening, cell, niche and recess site.js lists), each face dressed by what it looks
  into (room / opening / exterior).** — watertight colliders, no internal faces, no z-fighting between walls; the site's
  `openings`, `cells`, `openVoids`, `pieces` map one-to-one onto subtracted boxes — hand-modelled walls per part.
- **The Ulam block above its ceiling (the "upper storey" site.js leaves undescribed) and the dilpah voids are solid.**
  — no source describes them and nothing can see them — modelled voids.
- **Mesibah: 66 half-steps in six flights of eleven with five 5.8-amah landings, a level landing of 10 at the NE door,
  built as solid stone (treads are the colliders: ½ amah = 0.24 m ≤ 0.35 m step-up).** — run 73 vs 33 needed (site.js);
  Middot 4:5 gives only the route — a continuous ramp (1:2.2, steeper than the 1:3 ramps of Zevachim 63a).
- **Ta'im roof stair: solid stone treads with cheek walls (¾ wide inside the 3); the landing on two 1 × 1 piers, with
  1½-amah parapets on its open sides; the cedar posts (r 0.3) stand on it as site.js places them.** — a 12-amah drop
  needs a guard — open stair.

## Ulam facade
- **Rambam's rovadin (BhB 4:9) as banded ledges: from the Heichal floor, a plain 1-amah course set back a THIRD of an
  amah, then a 3-amah rovad standing out from it, repeated to the top, the top rovad 4 — which ends exactly on the
  ma'akeh's top (+115: 22 × 4 + 1 + 4 = 93). Each rovad's head is a ⅓-amah stone ledge under the plain course above.**
  — "אמה אחת חלק ורבד שלש אמות … רחב כל רבד שלש אמות … ורבד העליון ארבע". This DEPARTS from Part V §13.4 / Part VII
  §25, which read each rovad as a stepped ledge 3 amot deep: a 3-amah setback every 4 amot up the 90-amah front would
  make it a stepped pyramid (≈ 67 amot of setback against a 5-amah wall), so "רחב" is taken as the band's height and the
  ledge as its shallow projection (build-heichal-fix: ¼ → ⅓ amah so the ledge reads from the court) — the attested ledge
  rhythm at a buildable depth; alternative: flush courses (no ledges) / deep ledges (unbuildable).
- **Colours: the 3-amah rovadin cycle shayish (white) → kochla (blue-green) → marmara (veined); the plain courses between
  them are white, read by their quarter-amah shadow line; the herodian set's own course rows are used (UVs mapped so each
  modelled course shows exactly one texture course).** — Bava Batra 4a / Sukkah 51b (kochla, shayish, marmara — "like the
  waves of the sea"); Part VII §21 #18 "bare polychrome Herodian marble"; the same banding language as the court walls.
  Tried first: the plain courses in kochla — a thin dark line every 4 amot read as modern louvres from Ezrat Nashim. The
  brief said "white marble": white dominates — an all-white facade (ignores BB 4a).
- **The Ulam block (its east face, both ends and the exposed west faces of the wings) is bare marble; the body (ta'im
  mass, aliyah block) is `heichal_whitewash`.** — Middot 3:4 (the Heichal whitewashed once a year, at Pesach) and Bava
  Batra 4a (Herod's banded marble, left unplastered) both speak of the building; the wide front is the "Herod's
  building" everyone saw, the narrow body behind it took the annual wash — all bare / all washed.
- **The five lintels: oak (milah) beams 1 amah deep through the full wall thickness, standing ⅙ amah PROUD of the
  facade, with the stone course between each pair set back ⅙ amah and as long as the beam above it, so the stack steps
  out at each course; the beams' ends show their end grain where they stand out of the wall, the courses are the white
  marble of the coursing with its joints.** — Middot 3:7 gives lengths (22 → 30), the count and the courses; flush beams
  read as painted stripes (review); the depth is reconstruction (build-heichal-fix) — flush / courses as long as the
  beam below.
- **Plain courses at +62, +66, +70 stop at the beams lying at those heights (beams 1, 3, 5); beams 2 and 4 lie within
  rovadin.** — falls out of the arithmetic; the beam ends show a half-amah return (⅓ recess + ⅙ proud).
- **No architrave or door case round the Ulam opening.** — the lintels are its frame (Middot 3:7); restraint (Part VII
  §25) — a moulded frame.
- **Exterior kiyur stringcourses: a one-amah marble moulding (fascia, cyma, fascia, cavetto drip) round the whole house —
  the aliyah block and the Ulam block — at both ceiling lines (+62, +107); on the facade at +62 it replaces that plain
  course and dies against the lowest lintel beam.** — Part VII §25 lists the kiyur among the attested stringcourses ("a
  one-amah ornamental course at each ceiling line"); lock #40. It gives the 94-amah mass a base, two storeys and a crown
  — none (an unbroken striped block). At +62 round the Ulam block it projects ½ amah (0.36 elsewhere) and its back
  fills the set-back plain course it lies on, so it reads as the front's storey line (build-heichal-fix).
- **A restrained cavetto coping (⅘ amah, projecting ⅓) on the ma'akeh's outer face, under the kalya orev.** — a finished
  wall-head, not a battlement (Part VII §25) — a bare parapet top.
- **The otem's faces are drafted Herodian ashlar (`herodian_wall`).** — the podium reads as foundation masonry like the
  Mount's walls — marble like the facade.

## Kalya orev, ma'akeh, roofs
- **Kalya orev: one continuous wrought-iron blade on the parapet's centre line all round the T outline, 1 amah high,
  ~3 cm thick at its foot, flat faces to ⅘ of its height, then bevelled to a sword's edge.** — lock #27, Rambam BhB 4:3
  "טס של ברזל כמו סיף" — Rashi's spiked plates (Register #27); gold spikes are unsourced (Part VII §25).
- **Ma'akeh 1 thick inside the outline (site), marble coping; its outer face continues the rovadin on the Ulam block,
  whitewashed on the aliyah block.** — site.js `thickness: 1` — a separate parapet style.
- **Ta'im-roof parapets ½ amah thick, 3 high, on the outer edges and along the mesibah and water-house voids (open at the
  mesibah's head where the stair arrives).** — site.js `parapet` ⚙ — none.

## Great gate, wickets, doors
- **Great gate: the outer pair hinged at the Ulam face, opening 90° to lie on the reveals (covering 5 of the 6 amot);
  the inner pair hinged at the Kodesh face, closing just inside the house and opening 180° to lie flat on the 10 amot of
  east wall behind them. Leaves of gold sheet over panelled olive wood (four panels, raised bosses and nail heads at
  higher detail).** — Middot 4:1 (the stam); R' Yehudah's folding leaves within the doorway (site `yehudahAlt`) — the
  alternative. The leaves render in the seamless `gold_vessel` (the sheet grid of `gold_plate` ran across the panels and
  read as gilded ashlar) and their bosses are low domes (a flat cap read as a hollow ring) (build-heichal-fix).
- **"Behind the doors" left unplated: the east wall's inner face beside the gate to door height, and the gate's reveals
  (behind the outer leaves), are plain marble coursing.** — Middot 4:1 "the whole house plated with gold except behind
  the doors" — plating the reveals.
- **Movables: one `door:heichal.gate.great` drives all four leaves (`open(f)`), with `openGroup('outer'|'inner', f)` for
  the pairs; default open (daytime), the sim closes them.** — the morning sequence (Tamid 3:7) opens them from within.
- **Wickets: single gold leaves hinged at the Ulam face; the north `daily: true`, the south `permanentlyClosed: true`
  (the sim must never open it); the beit hachalifot wickets gold, shut by default.** — Middot 4:2; Zevachim 55b.
- **The NE ta's door to the Heichal is gold (the house's side); its door to the mesibah and the aliyah's two leaves are
  cedar boards.** — "the whole house plated" — all gold / all cedar.

## Ulam interior
- **Ten cedar kelunsot across the Ulam at +57.4 to +58.8, every 9 amot, clear of the chains.** — Middot 3:8 gives the
  ties, not their number or height — a single row of beams at the ceiling.
- **Chains: four, hanging from the ceiling to +48 as site.js gives them (instanced oval links at detail ≥ 1, a rod at
  detail 0).** — note: +48 is 26 amot above the floor; how the young kohanim reached them is not modelled.
- **The golden vine: two gold trunks rising from small gold sockets on the wall over the gate head (above the
  gate-curtain rod), canes winding along two cedar poles carried on cedar brackets from the wall, gold leaves
  (five-lobed, a little cupped, turned every way) and hanging clusters, all within the site box.** — Middot 3:8
  "trained on kelunsot", donors' "leaf, berry, cluster"; its size and the poles' arrangement are reconstruction.
- **Helena's nivreshet: a lobed (gadrooned) gold globe, SMOOTH (shared vertices, the lobes a radius modulation), with
  eight small lamp nozzles round its rim, hung by a gold chain from the Ulam ceiling; movable `heichal.nivreshet` (pivot
  at the chain's head); as large as its site box allows (R 0.78 amah).** — Yoma 37b "a nivreshet of gold over the door of
  the Heichal; when the sun rose sparks went out of it": every smooth convex lobe has a point mirroring the low sun to
  any eye in front of it, so the flash is a physical reflection, not a glow (Part VIII §32). (The first build used flat
  facets "for sparkle", which was wrong: flat facets mirror into a few discrete directions and missed most viewers.) It
  uses `gold_polished` when the materials task adds it (requested); until then a kit variant of `gold_vessel` with its
  roughness × 0.65 (≈ 0.09: same maps and shader program, no extra draw call; a true mirror (≈ 0.05) put the sun's image
  in a sub-pixel spot at court distance). Physically the flash at +47 comes
  ≈ 15 min after sunrise, when the sun clears Har HaMishchah's ridge (≈ 2.6° from there) — a flare sprite.
- **Zechariah's crowns: two, silver (north window) and gold (south), circlets (r ½ amah) with a wreath crest of pointed
  leaves, alternately tall and short, each on a low moulded marble stand just inside its window's Ulam face.** —
  Zechariah 6:11 "take silver and gold and make crowns", Bartenura on Middot 3:8 (lock #28); which metal went where is not
  recorded; a wreath diadem is period-plausible, while a crest of square tabs read as a castellated crown (review) — one
  crown / four (one per name in 6:14).
- **Showbread tables: the gold one in the Shulchan's form (zer, legs, misgeret low); the marble one a monolithic slab top
  on two slab supports.** — Shekalim 6:4 (materials only); form after Second-Temple stone tables — legs for both. Their
  sides follow site.js (marble north, gold south); the brief's "marble E / gold W" is not what site.js gives.
- **Knife niches: 12 in each wing, two rows of six on the end wall, 1 × 1 × ¾ amah, lined with the wing's plain dressed
  stone (`ashlar_plain`; white marble read as lit cubbies); Bilgah's (the 15th mishmar = the 3rd of the south wing)
  sealed with a slightly recessed plug of veined marble; iron knives in the open ones at detail ≥ 2.**
  — Sukkah 56b, SG (12 + 12; site params) — positions open; one row of 12 would not fit 11 amot.

## Curtains
- **All curtains are the tefach-thick parochet weave (`parochet`), including the Ulam's.** — they are among the
  thirteen parochot (Yoma 54a; Rambam Klei HaMikdash 7:16) and the Ulam's "linen curtain" is flagged in Part VII §23 as
  Chabad's uncited claim — linen for the Ulam (as the brief said).
- **Curtains are real thick drapes (two faces + edges, folds ±0.1 amah, deeper where gathered) whose geometry is re-laid
  only when `open(f)` changes.** — a tefach-thick textile cannot be a plane; CPU re-layout costs nothing per frame.
- **Ulam and gate curtains: split, gathered to the jambs, default open (1). The gate curtain hangs just clear of the wall
  face (≈5 cm outside the site box) so the folds never enter the stone. The two halves overlap an amah at the middle on
  two lines a little over a tefach apart (the second toward the east) and their meeting edges hang straight, so drawn
  shut they lap instead of interpenetrating; the tefach-thick edges continue the faces' weave and shading.** — Yoma 54a;
  Tamid 7:1 ("he lifted the parochet"); build-heichal-fix — one sheet.
- **The two parochot: the outer fixed at the north and drawn back ("perufah") at its south end, the inner fixed at the
  south and drawn back at its north end; by default each leaves a 2-amah gap, the last 22 % of the cloth bunched into
  deep folds; `open(f)` draws it further back (1 = fully gathered).** — Yoma 52b, locks #5, #42; the size of the gap is
  not given.
- **The aliyah's two curtains hang closed (static); the lul's small curtain hangs at the KhK face.** — Yoma 54a; site
  `smallCurtain`.

## Kodesh and KhK
- **Lining: a 1-amah gold plinth, six registers of relief (6 amot each: a band of open flowers, palms alternating with
  keruvim, a band of flowers) from +23 to +59, a 3-amah gold frieze and a gold cavetto cornice under the kiyur. The relief
  is mapped in amot (module 4, register 6) whatever amah standard is chosen, with palms on every corner.** — Middot 4:1,
  Yoma 54a, 1 Melachim 6:29 (lock #34); the arrangement is reconstruction — a single giant register.
- **The keruv in that relief is drawn by the materials task (`gold_relief`, gen/kinds.js keruv()); as drawn it is an adult
  in a floor-length robe with a disc head and two oval wings — the Western angel, not the keruv of the Jewish sources:
  a child's face ("ke-ravya", Sukkah 5b, Chagigah 13b; Rashi on Shemot 25:18), wings spread upward (Shemot 25:20),
  paired figures (Yoma 54a, Rav Acha bar Yaakov). Requested from materials (build-heichal-fix): child proportions, a large
  round head with a child's face, a short body without the long robe, no halo-like disc, wings rising from the
  shoulders, optionally pairs facing across each palm; low relief and restrained (Part VII §25).** — the motif covers
  every register of the two holiest rooms; this folder only maps it.
- **The KhK has the same relief over beaten-gold plating; its floor gold sheets; the Even Shetiyah a low natural rock
  (≤ 3 etzba'ot) with a broken, roughly level top and a crisp margin breaking through the floor plating, whose edge is
  turned up against it as a thin gold lip.** — Shekalim 4:4, Yoma 5:2, lock #15 — a soft mound (read as a puddle).
- **Floors of the Kodesh and KhK gold sheet (`gold_plate`).** — Part V §13.11 ("interior floors gold, per the plating
  rule") — stone.
- **The kiyur as a coffered gold ceiling: 3-amah coffers on a 4-amah grid (aligned with the relief modules), two steps
  deep, an open flower hanging in each at detail ≥ 2; the KhK's central coffer is the lulin shaft.** — lock #40 (kiyur
  = decorated course); 1 Melachim 6:29's open flowers — a flat ceiling.
- **F1 windows: five a side, spread over the site band (centres 122 … 152), 1 amah wide at the Kodesh face splaying to
  2 outside; the reveals plated only in the throat (the first amah in from the Kodesh face), the outer splay the wall's
  washed stone.** — Menachot 86b; Part VII §22; Middot 4:1 plates the house within, nothing gilds the outside; count open
  (site 5).
- **Sotah slab: a marble tablet set flush into the gold floor (the floor is cut for it), an iron ring fixed in it.** —
  Sotah 2:2; Part IX §37.1 — a raised slab.

## Vessels
- **Menorah, by the tefach ladder (Menachot 28b; Rambam BhB 3:10): legs and base flower 3, plain 2, goblet-knob-flower
  1, plain 2, knob with branches 1, plain 1, knob 1, plain 1, knob 1, plain 2, three goblets-knob-flower 3; three legs;
  goblets as Alexandrian cups (wide mouth, narrow foot), knobs egg-shaped, flowers as bowls with out-turned lips (Rambam
  BhB 3:9); all 22 goblets, 11 knobs and 9 flowers at every detail tier (BhB 3:3: each is me'akev).** — sourced.
- **Menorah thickness (no source fixes it): shaft radius 0.3 tefach, branches 0.24 → 0.21, the head's goblet mouths
  0.55, knobs ≈ 0.5, the branch goblets 0.44; smooth lathes (24–32 segments at high/ultra).** — at 0.2 it read as a wire
  stand; the reviewer's ×1.5 would make the inner branches' goblets collide with the head's (the inner branches pass
  1.0–1.5 tefachim from the axis at the head's height, the lamps being 2 tefachim apart), so the ornaments grow only as far
  as that clearance allows (build-heichal-fix) — a fuller menorah needs a wider span than site.js's 2 amot.
- **Branches: straight diagonals from their knobs to an east–west row of seven lamps evenly spread over the site's 2-amah
  span; the ornaments (three goblets, knob, flower) sit along each branch's last three tefachim, aligned with it.** —
  lock #30 (straight), lock #11 (E–W); the even spacing is site.js's span ⚙ — parallel 45° diagonals as in the Rambam's
  sketch (uneven spacing, wider span).
- **Lamps: small round-bodied oil lamps (≈ 7 cm) with a short nozzle, fixed on the branches; the six outer nozzles point
  to the centre, the middle one west.** — Rambam BhB 3:7–8. At 2 tefachim spacing the centre lamp and the inner western
  lamp face each other: the outer nozzles reach ½ tefach, the centre's only ⅓ (it need only face the KhK, BhB 3:8), so
  the flames stand 2 tefachim apart except the centre / inner-west pair, ≈ 1.1 tefachim (9 cm; 6 cm before the fix).
- **Ner ma'aravi = the second lamp from the east (`heichal.menorah.lamp-1`): it burns 'always', the others 'night'.** —
  lock #11 rests on Tamid 3:9 / 6:1 ("he found the two eastern lamps burning … left the western burning"), which with an
  E–W row makes the western of the two eastern lamps the second from the east (Rashi, Menachot 98b). site.js's
  `centerLamp` note follows the Rambam's N–S row — the centre lamp.
- **The stone before the Menorah: three ½-amah steps rising south toward the lamps, on its north side (site.js).** —
  Tamid 3:9.
- **Shulchan: a gold-PLATED table (`gold_plate`: acacia under gold, Shemot 25:24; "the Shulchan is wood", Chagigah 26b)
  with a zer round the top, four legs, the misgeret a tefach high low between the legs.** — locks #12, #31–#33.
- **Lechem hapanim (build-heichal-fix): each loaf a rounded "breached box" (R' Chanina) — a 5-tefach floor across the
  table and walls folded up 2½ tefachim (10 etzba'ot) on the N and S, so the 10-tefach loaf spans R' Yehudah's 5-tefach
  table (Menachot 11:4–5, lock #31); open at the east and west; horns at the walls' four ends rising 7 etzba'ot and
  curling outward past the kanim (the 7 etzba'ot are the horns' own height, not the walls' — Shiltei HaGiborim, Part X
  §53); the walls lean out a little and dip toward the middle, and each loaf is ≤ 2 % off square and ½ etzba off line.
  Kanim: half hollow reeds (Menachot 11:6; Rambam BhB 3:14 "כחצי קנה חלול"), 2 etzba'ot across, open side down on the
  walls of the loaf below, 3-3-3-3-2; a stack stands ≈ 3 amot; the snifin rise to its head, forked there; one bazach of
  levonah in each top loaf's trough, the heaped resin above its walls.** — the first build's 7-etzba walls (a
  7.8-tefach loaf) misread the horns as the walls; the bazichin "beside the stacks" (Rambam; Abba Shaul's gap on R' Meir's
  table) have no room on a 10 × 5 table, so "on the stack" (Vayikra 24:7, the Rabbis' answer in Menachot 96a). Loaves use
  a crust-toned variant of `plaster`, the levonah a pale one, until `bread` / `frankincense` exist (requested).
- **Golden altar: plinth, body, a gold zer just below the top, four horns a tefach high within the 2 amot; the body
  plated (`gold_plate`), zer and horns `gold_vessel`.** — Shemot 30:1–5 (gold over acacia; "the altars … because they are
  plated", Chagigah 27a); horn size open. As a polished box it mirrored the bright doorway and read as a cream block.

## Light
- **No interior lighting in this folder any more (build-heichal-fix): `interior.js`, the camera-volume fallback that
  swapped scene.environment, is removed.** — env now owns interior light (`ctx.env.interiors`, lighting-polish:
  per-fragment sky visibility through the great gate, the F1/F2 windows and the curtains, occlusion of other rooms' fire
  lights, a Kodesh reflection probe on medium+, a lamp fill where no probe exists), which is what this folder requested;
  the fallback stood down whenever that existed, and its camera dependence was the reviewers' main lighting complaint.
- **Seven Menorah lamp fires (kind 'lamp', 7.5 cm flames), ids `heichal.menorah.lamp-0…6` east → west.** — fx lights
  them; env's interiors give the Kodesh their fill.
- **Material variants (lib/kit.js `variant()`): where a key does not exist yet, a part uses a library material's own
  maps and shader program with a plain tint or roughness change (crust-toned bread, pale levonah, polished nivreshet),
  replaced by the real key as soon as materials adds it.** — same program (no shader compile), batched like library
  keys — wrong-looking fallbacks.
