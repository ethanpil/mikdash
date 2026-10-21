# world-3 — decisions

Scope: requests from the choreography groups (G1 night, G2 altar, G3 sanctuary) to the world builders this task owns:
`src/world/courts/**`, `src/world/altar/**`, `src/world/heichal/**` (not materials). Format: **choice** — why — alternative.
⚙ = reconstruction. Shots: `shots/world-3/` (`low-*`, `high-*`; `before/` the state found).

## Beit HaMoked: the keys slab (Middot 1:9)

- **Movable `azarah.moked.keys-slab`: a marble tablet ⅙ amah thick resting flush on a stone rebate inside site.js's
  1 × 1 × ½ seat; an iron ring on its top toward the south edge; under it an iron staple in the seat's north wall, a
  short chain, and three iron keys on a ring at its foot.** *(world-3-fix: the ring is now a drop-ring flush in a
  groove, and there are eight keys, one per Azarah gate plus the wicket's; see `world-3-fix.md`.)* — "a place an amah by an amah, a marble tablet with a ring
  fixed in it, and a chain on which the keys hung; he raised the tablet by the ring and took the keys from the chain …
  returned the keys to the chain and the tablet to its place" (Middot 1:9). The Mishnah gives the size and the parts;
  thickness, rebate, ring and staple placement are ⚙. The ring is toward the south edge because the slab kohen kneels
  on its south side (G1). — The ring at the centre (the old static model); the chain fixed to the slab (the Mishnah
  separates lifting the tablet from taking the keys off the chain).
- **`lift(f)`: the tablet tips up about its top north edge, 0 = in place … 1 = 80°, nearly upright, leaning over the
  seat (held); `open(f)` is the same (the sim's door-handle contract: `sim.door(id)` / `movable()` find it by its bare
  id), `openAmount`/`amount` read it back, default 0. `setKeys(bool)` shows or hides the keys on the chain (hide them
  while they are in the kohen's hand).** *(world-3-fix: `setKeys` also takes a count or a list of key ids.)* — A tablet lifted by a ring near one edge pivots on the far edge; pivoting on
  the TOP north edge keeps the tablet out of the floor stone north of the seat at any angle (its lower corner swings
  into the seat). — A straight lift (the tablet would float in his hands while he takes the keys), or a full flip onto
  the floor (he would have to push it past upright from his kneeling place).
- **The keys are short (≈ 9 cm: bow, round shank, toothed bit — Roman-period form ⚙) because the seat is only ½ amah
  deep (site.js); they hang clear of its floor.** *(world-3-fix: wrong. They reached ⅙ amah below the seat's floor;
  the staple, chain and keys were shortened to fit. r2: now gate-scale keys, 0.30–0.42 amah, lying on the seat's floor
  at the chain's foot.)* — A deeper pit or longer keys would change site.js. The keys and chain
  are small and dark; they read at arm's length (`low-slab-lifted-close`), not across the hall.
- **The closed lid is a static collider (box over the tablet's footprint); the moving tablet is not a collider.** — The
  open seat would otherwise be a 24 cm pit in the walking floor for the few seconds it is open; nav and the sleepers'
  spots (G1 plan-check) see the same flush floor as before.
- **The chel door's two leaves already swing into the hall** (`door:azarah.moked.door-chel`, hinged at the chel face,
  `into` = south; `low-chel-door-open*`) — nothing to change.

## Lamps lit before Shabbat (Rambam BhB 8:12)

- **Three lamps on wall brackets, fires kind `lamp`, schedule `service`, intensity 0 (dark until the sim lights them):
  `courts.kelim.lamp-w` (Lishkat HaKelim, west wall, mid-room), `courts.kelim.lamp-s` (its south wall east of the door),
  `courts.moked.lambs.lamp` (the lamb chamber, south wall, over the manger), all ≈ 4 amot up.** — BhB 8:12, read with
  8:11, is about the dawn search of the Azarah itself: on Shabbat nights "they have no light in hand, but search by the
  lamps lit there from Erev Shabbat". The lamps in these two chambers apply the same principle to the Shabbat-night
  vessels and lamb, at G2's request; the halachah does not say so (Tamid 3:3–4 uses a torch on weekdays). The lamps
  along the search route itself were added in world-3-fix (`courts.azarah.lamp-*`). Places ⚙: the free walls, clear of the shelves, the door
  leaves and the manger. The existing bracket lamp (`parts.js wallLamp`) is reused. — Lamp stands on the floor (in the
  way of the lambs and of the men carrying vessels); niches (cut through the chamber walls).

## The altar: the great pile and the tapuach (Tamid 2:2–4)

- **Movable `altar.maarachah.great.pile` with `build(f)`: the great pile's 788 billets (low; as before, all tiers keep
  their own count) in three meshes (bark, end grain, charred) whose draw range grows billet by billet — layer by layer
  from the bottom, each layer row by row from the south, each row from the tapuach out to the face. 0 = cleared: only
  the static bed of embers and its coals remain; 1 = the pile as it stood (the burning pile, its heart burnt hollow and
  charred). `open(f)` alias; default 1.** — Tamid 2:3–4: "they began to bring up gizrin to arrange the fire … the inner
  ends of the gizrin touching the tapuach"; G2 needs to clear and rebuild it at dawn. Order ⚙ (inner ends first is the
  Mishnah's emphasis). The billets are generated exactly as before (same random sequence), so nothing else on the altar
  moved. Draw range on merged buffers: no per-billet objects, no extra cost when built. — One object per billet (788
  draw calls / matrices); a separate fresh-wood pile for the build (the built pile at 1 would then be unburnt all day).
- **The pile at 1 is the burning pile, so the half-burnt billets of its heart appear among the fresh ones while it is
  being built.** — Re-laying the night's half-burnt brands on the new pile is plausible, but no source says it ⚙; a
  second burn parameter was not asked for. The pile's static box collider stays (the cleared pile leaves an invisible
  box ~1 amah high over its bed; nothing walks there).
- **Movable `altar.tapuach` with `grow(f)`: the mound and the charcoal on its flanks scaled about its foot — 1 =
  site.js's mound (r 4, h 3), 0 = a low remnant (radius × 0.55, height × 0.25) after the ash was carried out. `open(f)`
  alias; default 1. The collider stays the full mound.** *(world-3-fix: the great pile's rows now follow the
  mound's size, the colliders stay static by design, and `heightAt(X, Y)` gives the visible surface.)* — Tamid 2:2: "at times about 300 kor on it … on the festivals
  they did not clear it … never was a kohen lazy to carry out the ash" — its size varies from day to day; the sim decides
  how big it is when. Scale range ⚙. — A fixed mound (the sim cannot show the ash heaped onto it).
- **Draw calls: +4 at low (pile ×3, tapuach ×1), +5 from detail 1 (the tapuach's charcoal).** The altar reports 35
  calls / 36.3k triangles at low (`ctx.scene … altar.userData.stats`).

## The kevesh at the ramp-top view (the "blue-grey band with crescent marks")

*(world-3-fix review: the fix below is real, but it is not the reported band. The schedule's view `V.kevesh` carries
a Z and always stood on the ramp, where nothing changed. Item 4 stays open with render, as the last bullet says.)*

- **Found: the pavement runs on under the kevesh and the altar (the courts' fill), and neither mass was closed
  underneath, so the column at the ramp head had two standable floors: +16 (inside the kevesh, 7½ amot under its top)
  and the ramp. `standFloor` prefers the Azarah datum, so any placement by plan alone — `at=217,303` without Z, a
  re-stand after a jump — put the observer INSIDE the kevesh, looking through its culled skin at the altar's south face
  (`lime_whitewash`: its field stones read as crescents, blue-grey by night; `before/at-217-303_*`). The same held under
  the whole altar (+16 under the tapuach).** Fixed by closing both masses at the pavement: the kevesh ground piece gets
  its underside (`rampSweep` faces 'u'), the altar body sweep `capBottom`. The faces are flush with the pavement and
  face down, so they are never drawn from above (no z-fight) and the pavement inside is no longer a floor: floors at
  (217, 303) are now only the ramp (23.73); (217, 321.5) only the tapuach; the sovev 22; under the carried sovev ramp
  the open pavement (16) stays, as it should. — A collider-only lid (a down-facing-only collider trips the physics
  orientation warning), or asking player to test insideAt (the masses should be closed anyway).
- **Not a material, UV or z-fighting fault: with the observer on the ramp, its top in front reads grey by night because
  the great pile's light stands below the ramp's plane extended, so the ramp faces away from it while the level
  walkway beyond is lit.** *(world-3-fix r2, measured: fx merges the great pile's two emitters into one light at their
  candela-weighted mean, +28.55, which is 0.42 amah under the plane there (+28.97). This bullet first said +28.9 "on the
  plane", which was the main emitter alone. See `world-3-fix.md` item 4.)* A real 2.4 m flame reaches ~+32.6, above
  that plane, and would light the ramp at a grazing angle. That is the light model's (render: the pyre's light at its
  flames' height, ≥ +30, or a wrap term). Reported, not faked here.
- **The kiyor's dark shaft-mouth plane (`altar.kiyor:shaft`) is removed**: build-courts carves the well (masonry.js,
  `azarah.floor` params.shafts), its water at +14½, so the sunk laver stands in real water (`low-kiyor-sunk`).

## The Heichal

- **The six branch lamps are registered with fx schedule `service` (intensity 1) instead of `night`; the ner ma'aravi
  stays `always`.** — They are cleaned in the morning (Tamid 3:9, 6:1) and lit in the afternoon after the incense
  (Yoma 14b–15a; Tamid 6:1 "from which he lights the Menorah bein ha'arbayim"); 'night' tied them to the sun. With the
  sim, d5 shows only the second lamp from the east, d11 all seven (`*-menorah-d5`, `*-menorah-d11`). G3's runtime switch
  (`ketoret-morning.js`) is now a no-op.
- **The roof (zone `roof`, stand [170, 330.5, 112]) stays fade-only (goTo walks to the aliyah and fade-hops up).** The
  research does support a route: Middot 4:5 and Rambam BhB 4:13 "at the door of the aliyah were two cedar
  posts by which they went up to the roof of the aliyah", and R' Shimshon (in Tosafot Yom Tov on 4:5): "upright toward
  the roof of the house, and rungs between the posts" — a ladder. It is not built as walkable because:
  1. the observer is a walking capsule (0.35 m step-up, nav stairs to ≈ 50°); a vertical ladder of 45 amot (+67 → +112)
     cannot be walked, and a walkable stand-in needs ≥ 40 amot of run — a helix round a post (the observer orbits the
     post seven times) or a flight hung on the aliyah's south face — neither of which the sources describe;
  2. site.js stops the posts at +112, three amot under the ma'akeh's coping (+115, with the kalya orev to +116), and
     gives no gap in the ma'akeh, so even a ladder there does not land on the roof;
  3. rungs between the posts as site.js places them (the door's jambs, 9½ amot apart) would cross the aliyah door.
  Requests: player — a ladder/climb mode (a climb volume from a foot point to a head point, entered by walking into it);
  site-model — the posts' top vs the ma'akeh (posts to the coping and a gap, or posts beside the door) and where on the
  door the posts stand if they carry rungs. With those, this builder can add rungs and the climb volume.

## Verification

- `npx vite build` passes. Console clean in every run (no errors or warnings from these builders).
- In page (low): the three movables exist with `open`; the fires are registered as above; `altar.kiyor:shaft` is gone;
  floors as listed; the pile has 788 billets; d5/d11 menorah states as above.
- nav-coverage (low): 130 of 132 targets from both origins (before: 127 of 129; the schedule gained 3 targets
  meanwhile); the only failures are the `roof` stand, as before. The nav grid lost ≈ 950 nodes: the floors inside the
  kevesh and the altar.
- Draw calls / triangles by builder (whole area, as built): low — altar 35 / 36.3k, courts 43 / 49.2k; high — altar
  38 / 137k, courts 51 / 163k. New meshes: the pile (3), the tapuach (1–2), the keys slab (tablet, ring, keys: 3).
- Shots: `shots/world-3/{low,high}-*` (keys slab closed / lifted / lifted at night, the chel door open, the lamps in
  Kelim and the lamb chamber lit and dark, the pile at 0 / ½ / 1, the tapuach at 0 / 1, the ramp head placed without Z
  at night, the sunk kiyor, the Menorah at d5 / d11); `shots/world-3/before/` the inside-the-kevesh view.
