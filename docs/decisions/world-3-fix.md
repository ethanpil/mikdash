# world-3-fix — decisions

Scope: the review of world-3 (`docs/decisions/world-3.md`), same ownership: `src/world/courts/**`, `src/world/altar/**`,
`src/world/heichal/**` (not materials). Format: **choice** — why — alternative. ⚙ = reconstruction.
Shots: `shots/world-3-fix/{low,high}/`; run logs `shots/world-3-fix/{low,high}.txt`.

## Item 4, the kevesh band at the ramp-top view: still open, it belongs to render

- **No further world change; item 4 is not done until the ramp-top view stops showing the band.** — The review is right:
  world-3 fixed a different, real bug. The pavement inside the kevesh and the altar was standable, so a placement
  without Z put the observer inside the mass. But the schedule's view `V.kevesh` = [217, 303, 23.7] carries a Z and
  always stood on the ramp, and from the ramp nothing changed. The band seen there is the light model's: fx puts the
  great pile's point light at +28.9, on the ramp's plane extended (+28.94), so N·L ≈ 0 on the ramp. The review's test
  raised the two great-pile fires 2.5 amot, and the ramp turned warm-lit.
  - Alternative 1: register `altar.maarachah.great` higher. The flames would stand a cubit taller over the pile, and
    terumat-hadeshen's fire curves are tuned to the current emitter.
  - Alternative 2: an extra world-side light. fx clusters and budgets fire lights itself, so a second one would leak,
    as the unshadowed second light did before (fire.js comment).
  - The render request stands: give pyre lights a vertical extent or wrap term, or add a second light at the flame tip.

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
  arm's length the flush ring reads the same (`*/slab-ring-grazing`).
- **Eight keys: one for each of the Azarah's seven gates (Middot 1:4) and one for the Moked's wicket ⚙ count.** —
  The sources say only "the keys of the Azarah" (Middot 1:8; Rambam BhB 8:5). At dawn the officer "took the key and
  opened the small gate" (BhB 8:11), so the wicket's key must be one of them and must come off alone. It hangs at the
  bottom of the ring; it is the smallest key, with the widest bow. Alternatives:
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
  Z − 0.67, floor Z − 0.5), hidden inside the masonry. Now:
  - the staple sits just under the tablet's bearing;
  - two links, then the key ring;
  - keys 0.11–0.13 amah long, lowest point 15.518 over the 15.5 floor (`*/slab-keys-close*`).

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
