# world-3-fix — decisions

Scope: the review of world-3 (`docs/decisions/world-3.md`), same ownership: `src/world/courts/**`, `src/world/altar/**`,
`src/world/heichal/**` (not materials). Format: **choice** — why — alternative. ⚙ = reconstruction.
Shots: `shots/world-3-fix/{low,high}/`; run logs `shots/world-3-fix/{low,high}.txt`. Round 2 (the review of this
file's first round): `shots/world-3-fix/r2/{low,high}/`, scripts and logs `shots/world-3-fix/r2/*.{js,txt}`.

## Item 4, the kevesh band at the ramp-top view: still open, it belongs to render

- **No world change to the fires. Item 4 is not done until `V.kevesh` [217, 303, 23.7] at n3 shows a warm-lit ramp at
  low and high.** world-3 fixed a different, real bug: the pavement inside the kevesh and the altar was standable, so a
  placement without Z put the observer inside the mass (still fixed: eye 27.11, floors [23.73]). The schedule's view
  carries a Z and always stood on the ramp, and from the ramp nothing changed.
- **Measured (r2, n3; low and high give the same numbers, `r2/lights-*.txt`).** fx merges fires of one kind within
  1.6 m into one light at their candela-weighted mean (`render/fx/lights.js` `cluster()`). The great pile's two
  emitters are 1.3 m apart:
  - `altar.maarachah.great`: light at +28.90, 21,600 cd;
  - `altar.maarachah.great.inner` (at the bed): light at +27.93, 12,184 cd at intensity 0.9;
  - merged: (223.43, 321.61, **+28.55**), 33,784 cd.

  The ramp's plane extended (kevesh params: +16 at Y 275.5, +25 at Y 307.5) stands at +28.97 at that Y. The light is
  0.42 amah **below** it, so the ramp's top faces away from it (N·L < 0) and gets no firelight at all, only the night
  sky's blue-grey. The kiyum pile's light is below the plane too (+26.94 against +27.11). The incense pile's is 0.21
  above (+26.34 against +26.13) but weak (1,266 cd): at low (2 slots) it gets no light, at high it barely shows. This
  file's first round said "the pile's light at +28.9, on the plane". That was the main emitter alone, and it was wrong.
- **Tried in page: the inner emitter's light off (`light:false`), its flames kept.** Not adopted.
  - The merged light becomes the main emitter alone at +28.90, still 0.04 amah under the plane. The ramp is unchanged
    (`*/ramp-top-inner-off`).
  - The altar top loses a quarter of its firelight (fx lux at (227, 321.5, 25): 5,955 → 4,493). fx derives a fire's
    candela from its size only, so the inner's share cannot be folded into the main emitter without bigger flames.
- **Tried in page: the merged light raised δ amah above the plane, the flames unmoved.** Low and high alike:

  | δ (light Z) | 0.5 (+29.47) | 1 (+29.97) | 2 (+30.97) |
  |---|---|---|---|
  | ramp top (`*/ramp-top-up*`) | barely warmer | dim, warm | warm |
  | lux, altar top E | 4,552 | 3,972 | 3,083 |
  | lux, pavement E (240, 321.5) | 8.5 | 35 | 128 |

  (baseline: 5,955 and 6.4). A higher light is further from the altar top, and it reaches over the altar's east edge
  onto the pavement. Both are what flames that tall would do, but render should look at both.
- **Why world does not move the light itself:**
  - The light's height is fx's (base + 0.6 × size). `addFire` has no per-fire light height.
  - Raising the emitters' bases raises the flames. The main emitter's tongues already reach +28.65 … +32.65 from a base
    (+25.9) inside the 2-amah pile.
  - A light-only emitter does not exist in fx, and it would need its own sim curve, since the sim drives `great` and
    `.inner` by id (terumat-hadeshen, altar-night).
- **The render request is re-filed with these numbers** (see requests). "The highest member's base + 0.6 × size" is
  +28.90 (the inner-off case) and is not enough. The light, or a second one, must stand at least 1 amah over the ramp
  plane at the pile (≥ +30), and +31 for a warm ramp: the upper third of the main flame. Alternatively, a per-fire light
  height in `addFire` would let world say where its flames are visible: the pile is 2 amot high, so the visible flame
  runs +27 … +32.65, middle ≈ +29.8. A wrap term on pyre lights would also do.

## The great pile follows the tapuach (finding 2)

- **For each tenth of `grow(f)`, the pile's rows are refitted to the mound at that size.** Two cases:
  - Where the smaller mound still reaches a row's height, within the original reach (2.6 amot west of the pile box),
    the row runs on west to touch it. Extension billets do this, drawn from their own random stream so nothing else on
    the altar moves; the innermost billet's tip is pushed into the ash.
  - Where it no longer reaches, the row keeps only the billets that rest on the layer below. Each layer may overhang
    the one under it by at most 0.35 amah (the mound's 40° flank gives about ¼ amah a layer), or by its own overhang
    in the full pile if that is more. The bottom layer lies on the floor and the ember bed.

  Why: Tamid 2:4 says "the inner ends of the gizrin touching the tapuach", whatever the mound's size that day (Tamid 2:2:
  "at times about 300 kor"). At f = 0.5 the pile now leans on the half mound (`*/tap05-pile1-*`). At 0 a low apron of
  billets runs on to the remnant, and the upper pile keeps its stepped west face over it (`*/tap0-pile1-*`). Nothing
  overhangs air.
  - Alternative 1, hiding only: this leaves up to 1.8 amot of bare floor between the pile and a remnant mound, so the
    ends no longer touch.
  - Alternative 2, limiting grow's range: any f < 1 already floats the ends that lean on the flank.
  - Alternative 3, a contract only ("grow(f < 1) only while build = 0"): the sim would have to keep the mound full
    whenever the pile stands.
- **The reach stays the original 2.6 amot.**
  - With unlimited reach, at f = 0 the upper layers ran another 3 amot over the remnant's crown: a 9½-amah pile in
    site.js's 6-amah box.
  - Rows that missed the full mound inside the old reach also jumped 3 amot between f = 1 and f = 0.9.
- **Drawing:**
  - Each of the three pile meshes gets an index over its merged billets.
  - The index is rewritten only when the tenth changes, and only the visible prefix is drawn.
  - `build(f)` counts the billets laid at the current size, so `build(1)` is always the whole pile and the pile at
    f = 1 is exactly as before (788 billets at low).
  - The tenth used is the floor of f × 10. Between tenths the rows reach a little further and their tips sink a
    little deeper into the ash; they never stop short.
- **Billets laid at low, by tapuach size:**

  | f | 1 | 0.9 | 0.8 | 0.7 | 0.6 | 0.5 | 0.4 | 0.3 | 0.2 | 0.1 | 0 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | billets | 788 | 894 | 867 | 837 | 825 | 830 | 791 | 744 | 721 | 678 | 664 |

  The extension billets add 3.8k triangles to the buffers at low (altar 40.1k, was 36.3k). They are drawn only below
  f = 1, and there are no new draw calls. The fit costs about 40 ms at load; the march is coarse-then-fine.

## Colliders stay static (finding 3)

- **The tapuach collider stays the full mound and the great pile's box stays as it was; the API now says so. New
  `altar.tapuach.userData.heightAt(X, Y)` gives the visible mound's site Z at the current size, so figures can be
  placed exactly.** — Physics is one static BVH. Measured at low: `physics.rebuild()` takes 110–170 ms on the main
  thread, then about 11 s of nav rebuild in the worker. A movable that rebuilt it whenever the sim moved grow or build
  would hitch, and the sim also replays on every clock jump, since it is a pure function of time. The float is bounded:
  - on the tapuach at grow(0): 2¼ amot (27.97 vs 25.72);
  - over a cleared pile: about 1.3 amot.

  Alternatives:
  - An opt-in `syncCollider()`: a trap at that cost.
  - A collider at the remnant's size: observers would sink 2¼ amot into the full mound, which is the usual state.

## The keys slab (findings 4, 5)

- **The ring is a drop-ring lying in a groove cut in the tablet. The top face of its hexagonal section sits a
  millimetre proud of the floor (ring top 16.002, floor 16).** — Middot 1:9: "he put his garment on it and slept". The
  slab kohen's bedding now lies flat over it (`*/slab-closed-night`); before, a torus 0.05 amah high stood on the top
  face. Alternative: a visible annular groove cut round a sunk ring. That needs a hole in the tablet's top face; at
  arm's length the flush ring reads the same (`*/slab-ring-grazing`). *(r2: the shit and sotah slabs now carry the
  same ring; see "The three ring-slabs" below.)*
- **Eight keys: one for each of the Azarah's seven gates (Middot 1:4) and one for the Moked's wicket ⚙ count.** —
  The sources say only "the keys of the Azarah" (Middot 1:8; Rambam BhB 8:5). At dawn the officer "took the key and
  opened the small gate" (BhB 8:11), so the wicket's key must be one of them and must come off alone. It is the
  smallest key, with the widest bow, in the middle of the bunch. Alternatives:
  - Thirteen keys, one per gate of Middot 2:6's other count: the model builds Middot 1:4's seven.
  - Keys for the chel door and Nikanor's wickets: these are not "of the Azarah" in the narrow sense.
- **`setKeys(v)` accepts:**
  - `true`: every key on the chain;
  - `false`: none;
  - a number `n`: the first n of `keyIds` (the wicket key is last, so `setKeys(7)` means the officer has it);
  - an array of ids: exactly those keys.

  `keys` stays a boolean and is true only while every key hangs; `keysOn` lists what hangs. It is one mesh with an
  index over the keys (no draw calls added); the key ring goes with the last key. Alternative: one mesh per key, at
  +8 draw calls in the hall.
- **The chain and keys now fit the seat.** world-3's keys reached ⅙ amah below the seat's floor (lowest point
  Z − 0.67, floor Z − 0.5), hidden inside the masonry. *(r2: the first round then shrank them to 0.11–0.13 amah
  (5–6 cm) to hang clear. That was casket size, chosen to fit the seat and not from any source. Replaced by the next
  bullet.)*
- **r2: gate-scale keys lying on the seat's floor at the chain's foot.**
  - **Size:** gate keys 0.36–0.42 amah (17–20 cm); the wicket key 0.30, with the widest bow ⚙. The Temple's keys were
    large: Tamid 3:6's two keys of the Heichal, one of which "goes down to the armpit", the kohen reaching in to the lock.
    These keys open gates 20 amot high (Middot 2:3).
  - **Why they lie:** under the ⅙-amah tablet, site.js's ½-amah seat ⚙ leaves ⅓ amah, too little for keys this size to
    hang clear. The chain (5 links, from the staple under the tablet's bearing) runs down to the seat's floor. The keys
    lie there on their ring, fanned ± 44° toward the south where the kohen kneels, each bow raised a little on the
    others. They are still on the chain, as Middot 1:9 has them: "took the keys from the chain … returned the keys to
    the chain".
  - **Measured** (`r2/slabs-*.txt`): the keys lie within the seat's open floor inside the rebate (X 210.47–211.04,
    Y 403.37–403.91), Z 15.502–15.55 over the 15.5 floor.
  - **Shots:** `*/keys-lifted-*`, `*/keys7-*`, `*/keys-wicket-*`, `*/keys-none-*`. They read as a bunch of large iron
    keys from a standing eye, where world-3's were specks.
  - **Unchanged:** the index scheme and `setKeys` (8 / 7 / the wicket key only / none: 4,800 / 4,260 / 1,020 / 0
    indices); no draw calls added.

  Alternatives:
  - A deeper seat from site-model (≥ 1 amah lets 0.4-amah keys hang): still a reconstruction, and nothing in the sources
    asks for it.
  - Tamid 3:6's arm-long key for every gate: that key is the Heichal's, carried by the inner-altar and Menorah kohanim,
    not one "of the Azarah".

## The three ring-slabs: one fitting (r2)

- **One ring for all three slabs: `courts/lib/parts.js` `SLAB_RING` / `slabRingGeometry(X, Y, topZ, d)`.** It is the keys
  slab's drop-ring:
  - radius 0.12, hexagonal section 0.025, lying in a groove, its top face 1 mm proud of the tablet;
  - 0.27 amah in from the tablet's south edge, centred east–west ⚙.

  Why: the review is right. Report Part IX §37.1 says "Model all three as identical fittings", and site.js's keys-slab
  note says the same. Flush suits all three:
  - the keys slab is slept on (Middot 1:9);
  - the shit slab lies in the pavement by the altar's SW corner, where the court is busiest;
  - the sotah slab lies in the Heichal's floor by the door.

  Why the south edge:
  - the kohen kneels south of the keys slab (G1);
  - he turns right (north) from the Heichal's gate to the sotah slab, so he comes to it from the south;
  - the shit slab's north side faces the altar's corner.

  Removed:
  - the shit slab's raised torus (r 0.16, standing +0.055) and its staple;
  - the sotah slab's centred torus (r 0.11) and its staple block.

  Shots: `*/shit-slab-*`, `*/sotah-slab-day`, `*/keys-closed-*`. The shit slab's ring is now in the static altar batch
  without casting a shadow; nothing stands proud to cast one. Alternative: log an exception and ask site-model to change
  its note. No source distinguishes the three fittings.
- **The tablets stay as their builders set them:**
  - the keys tablet is flush in its seat;
  - the sotah tablet is flush in the opened Heichal floor;
  - the shit slab stands 0.025 proud of the pavement on its swept edge, because the pavement runs on under it.

  Each ring sits on its own tablet's top.

## Findings answered without a world change (r2)

- **Nothing drives the new API yet, and it is undocumented.** Valid, but not world's to fix. `docs/API.md` and
  ARCHITECTURE §14 are not this task's files, and others edit them concurrently. The requests to G1 (keys), G2 (build,
  grow, retiring the logs and `altar.two-logs`, lowering the fire), G1/G6 (the Shabbat lamps) and the orchestrator
  stand, and are re-listed.
- **At low the open keys seat is lit as if outdoors.** env/volumes.js builds `azarah.moked.hall` from site.js's hall box
  (min Z 16), not from world, so the time-env request stands: extend the volume down to Z 15.5. It matters a little more
  now that the keys lie on the seat's floor.
- **The colliders do not follow grow or build.** The review accepts this as is. One request is added for G2: keep
  `grow` near 1 except while the ash is carried out, so the full-mound collider matches what is seen.

## The lamps of the Shabbat dawn search (finding 6)

- **The reading: Rambam BhB 8:12 goes with 8:11. It is the dawn search of the Azarah itself.** Two companies with
  torches go east and west round the court to the chavitin bakers. "So they did every night except Shabbat nights,
  when they had no light in hand, but searched by the lamps lit there from Erev Shabbat." So the lamps burn in the court,
  on the companies' way. world-3's lamps in Lishkat HaKelim and the lamb chamber stay. They apply the same principle to
  the Shabbat-night vessels and lamb (G2's request), but 8:12 does not say so; `world-3.md` now says this.
- **Seven oil lamps on stone wall brackets, 4½ amot up, where site.js's circuit (`azarah.achsadra-route`) turns or
  ends ⚙ (no source places or counts them):**
  - `wicket`: by the wicket, on the Moked's south face;
  - `ne`: on the north wall where the east company turns south;
  - `nw`: on the west wall at the Gazit's corner;
  - `sw`: at the west wall's south end;
  - `s`: on the Water Gate house beside the south turn;
  - `se`: on the south wall on the east company's line;
  - `chavitin`: beside the chavitin chamber's door, at the meeting place.

  The fires are `courts.azarah.lamp-*`, kind 'lamp', schedule 'service', intensity 0 (dark until the sim lights them).
  Brackets keep the walkway clear; they are not colliders and do not affect nav.
  - Alternative 1, lamp stands at the route's corners: they stand in the way of the companies and of the night's
    traffic to the altar.
  - Alternative 2, a lamp at every turn (11): it adds little.
- **They light only their own walls.** An oil lamp is small next to the great pile, which lights the whole court all
  night. At high each makes a warm patch round its bracket (`high/insp-wicket-lit`); at low the flame shows and the
  wall stays lit by the altar fire. This is accurate and was not boosted.

## Requests completed (finding 7)

- **The pile requests now cover everything that lies on the great pile.**
  - G2 (terumat-hadeshen):
    - before `build(0)`, move the unburnt limbs and fats to the altar's sides, as Tamid 2:2 says ("they moved the
      limbs … to the sides of the altar");
    - retire the 'log' props and hide `altar.two-logs`, laying them again only on a built pile (Yoma 2:5);
    - lower `altar.maarachah.great` / `.inner` while the pile is down (its fire curves already ease them to the
      embers).
  - G1 (altar-night) and G5 (limbs): put limbs and fats on the pile only while `build` = 1, and send them to the sides
    when G2 clears it.
- **G1 and G6: light the seven search lamps before Shabbat and use them in `lamp-inspection-shabbat`.**
- **G1: use the per-key `setKeys`.** At the locking `setKeys(false)` and back `setKeys(true)`; at dawn, the officer's
  key only: `setKeys(7)`, then `setKeys(true)` when he hangs it back.

## The roof (finding 8): unchanged

- **Still fade-only.** The review confirms the reasoning: a ladder at the aliyah door (R' Shimshon on Middot 4:5); no
  climb mode in the player; site.js's posts stop at +112, under the 3-amah ma'akeh, with no gap in it. The player
  (climb volume) and site-model (posts' top and position) requests stand; world adds the rungs and the volume after
  both.

## Verification

- `npx vite build` passes.
- In page (low and high):
  - the keys hang within the seat (15.518–15.719, floor 15.5) and the ring top is at 16.002;
  - `setKeys(true / 7 / [wicket] / false)` give 8 / 7 without the wicket / the wicket key only / none;
  - the seven lamps are registered (lamp, service, target 0);
  - floors are unchanged (ramp head 23.73, tapuach 27.97, keys slab 16);
  - `heightAt` is 27.97 at f = 1 and 25.72 at f = 0;
  - billets by size are as in the table above (high: 787 at 1, 629 at 0).
- Shots read at low and high: the pile at 0 / 0.3 / 0.5 / 1, from four sides; the slab and ring closed, by day and at
  night under the sleeper; the keys close-up with all keys, without the wicket key, and with only the wicket key; the
  seven lamps lit, and the wicket lamp dark.

### Round 2

- `npx vite build` passes; the output folder is deleted.
- **In page, low and high** (`r2/slabs-{low,high}.txt`):
  - the keys slab's ring: 0.29 × 0.29 × 0.043, top at 16.002;
  - the keys lie within the seat's open floor, Z 15.502–15.55;
  - `setKeys(true / 7 / [wicket] / false / true)` give 8 / 7 without the wicket key / the wicket key only / none / 8;
  - the keys slab's floor is still 16.
- **Altar:** 35 calls / 40.07k triangles at low, 39 / 149.3k at high. The shit slab's ring and staple came out of the
  batch and the new ring went in, so no calls were added.
- **Light experiments** (`r2/lights.js`, `r2/lights-up.js`; logs `r2/lights-*.txt`), at n3, low and high: the numbers in
  item 4 above.
  - The first high run lost its GPU context after the fifth shot, while other agents' harnesses were on the GPU (the
    page crashed: blank frames, `CONTEXT_LOST` warnings).
  - The raised variants were rerun alone (`lights-up.js`) and came back clean.
- **nav-coverage (low):** 132 targets; the only failures are `roof` from both origins; 893,608 nodes, 97,964 collider
  triangles. This is identical to the review's run.
- **Console:** clean in the slab runs (low, high) and in the low lights run.
- **Shots read:**
  - the ramp top at night: base / inner-off / up0.5 / up1 / up2, at low and high;
  - the keys: lifted (all, 7, the wicket key only, none), half-open at night, closed, grazing;
  - the shit slab, close and from the altar's SW corner;
  - the sotah slab.
