# choreo-g1-night — decisions

Scope: G1, night and pre-dawn. Modules `src/sim/choreo/moked-night.js` (id `moked-night`, aliases `locking-up`,
`moked-dawn`), `altar-night.js`, `lotteries.js`, `torch-inspection.js`; helpers in `src/sim/choreo/g1/` (`plan.js` the
shared per-date plan, `util.js` the itinerary engine, `places.js` site-derived places, `stage.js` pools/cues/doors/props,
`dev/plan-check.mjs` a node-side checker); test `src/sim/dev/tests/g1-night.js`.
Format: **choice** — why (source / reasoning) — alternative. ⚙ = reconstruction (the sources give the order, not minutes
or spots).

## Engineering

- **One shared plan per date (`g1/plan.js`, cached on the runtime generation): every person of the Moked's night is an
  itinerary of episodes made of legs (holds and walks), and each leg names the module that stages it (`moked`, `altar`,
  `lot`, `insp`, or `none`).** — The Moked's night is one continuous scene with the same men: the slab kohen locks up,
  sleeps on the slab, immerses at dawn, wins the first lottery and walks the torch round; the altar's evening crew go to
  sleep in the Moked and are the volunteers at dawn. Splitting it by event would either duplicate figures at the edges or
  pop them. Modules keep their own pools; the same pool seed and index give the same man in every module. — One module per
  event with ad-hoc hand-overs.
- **`locking-up` and `moked-dawn` are aliases of the `moked-night` module (no separate files).** — The runtime supports a
  module serving several choreo ids (gates.js does the same); one module owns the Moked's pools for the whole night. —
  Three modules each with copies of the same pools.
- **Every pose is a pure function of (t, date): episodes are laid end to end from a start time; walks are stride-matched by
  distance; companies in file use a `follow` leg (distance = the leader's distance along the route less the man's place ×
  1.35 m), so followers stop behind a leader who stops to look.** — determinism under jumps (tested on a weekday, a Friday
  and a Shabbat with forward, reverse and far-away jump orders). — Time-delayed followers, which walked into the paused
  leader.
- **No nav: all walks are authored waypoints on open pavement (site.js boxes), Z snapped per position by
  `Slot.placeNear`.** — the routes the sources imply are fixed (the achsadra route is site.js's), the spiral stair is
  computed from the builder's spiral, and nav ignores doors; straight legs keep timelines nav-independent. — navRoute.
- **The altar's great pile fire (`altar.maarachah.great`, `.inner`) is eased only inside [sunset, muchni.t0 − 0.5] — the
  moment terumat-hadeshen starts driving it — returning to the builder's level before that, and restored outside it.**
  — a stale level after a jump was a determinism bug (found by the test). — Leaving the fire alone.
- **Hand-overs to G2 by seed and place: the slab kohen = terumat-hadeshen's `winner` (pool seed 0x7468), the young y0–y3 =
  its `brothers` 0–3 (0x7469); they stand at its `groupSpot(i)` / winner spot, facing west, at muchni.t0 − 0.8, where
  its figures start. In the Gazit the second lottery starts G2's men at its Scripts' `tEnd` at `P.gazit.inside`
  (read-only from its state), and hands its two barkai watchers (0x6261) to barkai.js at its `tOut`.** — no pop, the
  same faces. The groupSpot jitter is mirrored (rand(0x7468, 'gx'|'gy', i)). — Independent casts (figures vanishing and
  appearing at the same spot).

## The Moked by night (Middot 1:6–9; Tamid 1:1; Rambam BhB 8:5–7)

- **The floor is laid against the figures' real footprints (`places.js FOOT`, measured from the clips and the
  folded_garments mat and cover): `sleep` has its origin at the feet and the body to the figure's right (head 1.46 m
  away), knees and hands toward the heading; `lie` has the feet at the origin and the head behind. The first layout
  assumed the body centred on the origin, which put heads in the hearth and mats through each other (review).** —
  `node src/people/dev/joints.mjs man sleep 0.5`; props.js foldedGarments (mat 1.95 × 0.78 m, cover).
- **The chol half as built holds four mats with clearance: S (the slab kohen, head on the slab, feet east), A (north–south
  in the west bay by the stair door), B (east–west along the kodesh line) and C (north–south in the east bay); and two
  seats in the NE corner by the east ledges (K1, K2).** Everything kept clear: the hearth (kerb r 1.35, star logs to
  1.7; bodies ≥ 1.85 and heads ≥ 2.75 from its centre), the chel door's two 5-amah leaves swinging into the hall (the
  Ish Har HaBayit's party opens them at night, night-watch.js), the lamp stand of the kohanic post, the stair door's way,
  the kodesh half. Minimum clearance between footprints occupied at the same time: 0.19 m on a weekday, 0.10 m on Friday
  and Shabbat (the two men sitting up). — The reviewer asked for 0.5 m between kessets: a search over positions and
  headings (scratch optimiser, with the constraints above) found no layout of five mats with any clearance, so 0.5 m
  for six is not possible in this hall; four is the capacity. `plan-check.mjs --map` draws it and fails on any overlap,
  hearth, leaf, lamp or floor breach.
- **Who lies where is per night (`P.assign`): the impure kohen sleeps on A until his keri, then a man of the evening crew
  takes A; on Friday night, when six would need mats (the Friday crew comes in at sunset), y0 and y3 sit up by the east
  ledges (K2, K1) and y3 lies down on A once the impure kohen has gone down; in the small hours of the Shabbat date y0
  sits up again (he would otherwise be turning the limbs) and goes down to immerse first.** ⚙ — The sources do not say
  all the young slept at once; sitting up by the fire on Friday night keeps the scene alive. Kneeling (sitting on the
  heels) stands in for sitting (requested `sit_floor`).
- **Counts (review finding: below the schedule's notes).** The Moked shows six elders, the slab kohen, three young on mats
  and one or two sitting; five immerse and draw the first lottery; five plus the officer walk the inspection. More young
  would need more mats than the floor holds (above); the second lottery's 16 and the afternoon's 12/20 are unchanged.
  The notes (dawn-immersion 4, first-lottery 12, torch-inspection 8) remain a request to schedule-data.
- **The corner chambers' doors (cedar, open by default) are shut through the night, from the first man in for the night
  (on Friday the altar's crew at sunset) until the gates open; the NW one (the winding stair) opens round each pass on
  the stair.** — Middot 2:3 (every opening had doors); the open NW leaf hid the elders from the moked-night view. ⚙
- **The elders climb onto the rovadin at their kodesh end (standing and walking there is no sitting) and walk along their
  tread to their place; each lies 0.18 amah toward the tread's open edge so the arm on the riser side clears the next
  ledge.** ⚙ — keeps the NE corner of the floor free for the seats; the elders' arms clipped the risers.
- **Elders: role `elder` lying on their backs, one on each tier of the three ledges each side, feet at the kodesh line.** —
  "the elders of the beit av sleep there" on the "rovadin of stone" (Tamid 1:1); `elder` gives the age; it has no folded
  garments (people's offduty switch is per role) — requested `kohen_elder`. — `kohen_offduty` (young-looking).
- **Young kohanim: `kohen` arriving in the four garments, kneeling to take them off and fold them, then `kohen_offduty`
  asleep on the mat with the garments beside the head and covered by their own mantle.** — Tamid 1:1 (fold, under/beside
  the head, cover with their own clothes); "beside" per Rav Pappa / Rambam BhB 8:6 (report §34.1). — Garments under the
  head.
- **The locking kohen is the slab kohen, in his own clothes: he takes the keys from under the slab, locks the Korban gate
  from inside the court and the Moked's own gate from inside the hall (gates.js swings the leaves at its CLOSE_AT times),
  hangs the keys back, sets the slab and lies with his head on it.** — Middot 1:9 ("the kohen locked from within ... put his
  garment on it and slept"); one man cannot reach all seven gates in gates.js's 4.4-minute closing sequence, so the far
  gates are shut by their keepers ⚙. — A kohen visiting every gate.
- **The Levite who "sleeps outside" lies at the foot of the Moked's flight on the Mount, comes from Lishkat HaKorban's
  door at the locking, rises when the officer passes before dawn and leaves when the gates open.** ⚙ — Middot 1:9 names
  no place.
- **Mesibah-keri fills its window (review: he was in the passage view 46 s of 26 min): he rises so as to be in the
  passage as the event begins, walks it slowly (0.5 m/s) by the lamps, immerses, then stands drying and warming himself
  on the fire's west side — the one place at the fire seen down the passage through its arch — and comes back along the
  passage as the event ends; then up and to K1, where he sits until the gates open, and out by the chel door over the
  Mount to the Kiponus gate.** — Tamid 1:1; Middot 1:9; Rambam BhB 8:7. The window is read from the schedule (no fixed
  total): the fire takes up the slack; plan-check measures 99% of the window with him in the passage view. The privy of
  honour is passed, not entered: its honour is the Mishnah's description, and a stop there takes him out of the view
  for two minutes. Kneeling stands in for sitting (requested pose). Kiponus "serves entry and exit" (Middot 1:3).

## Before dawn (Tamid 1:2–3; Yoma 22a, 25a; Rambam BhB 8:11–12)

- **The five immerse as a pair and then a trio, spread over the whole window (review: the room was empty 14 of 23
  minutes): each arrives at the mikveh as the one before him goes over to the fire; lays his folded garments on the stone
  by the mikveh's south side, immerses, stands drying by them (≈ 3 min, in the dawn-immersion view), warms himself at
  the fire (≈ 3 min, out of that view), dresses where he laid them and waits for his companions; the pair goes up as the
  trio comes down, before them, and the trio's last man is dressed as the event ends.** Arrivals are planned
  (`immersionSchedule`) and each man rises so as to arrive then (a dry run of his descent); plan-check measures someone
  in the view 99% of the window and no meeting on the stair. — "whoever wishes to clear the altar rises early and
  immerses before the officer comes" (Tamid 1:2); "he came up, dried himself and warmed himself before the fire" (Tamid
  1:1); Yoma 3:3. The change of role happens at the bottom of a kneel (a bathing figure is requested).
- **Order: on nights when y0 turns the limbs he goes down last (he stays on the altar as long as he may); otherwise y0,
  who sat up, goes first. The circle places follow the order: the pair wait on the circle's south (between the mats and
  the hearth, while others still sleep), the trio take its north.** — The night kohen of the altar comes in by the
  wicket and takes the holy garments off by the mikveh.
- **Gevini comes out of the instrument chamber under Ezrat Yisrael, climbs the fifteen steps, calls facing east from their
  head and goes back.** ⚙ (place: schedule-data's) — the cue `gevini` with the sim's own caption (the audio one is off so
  the line shows with audio locked).
- **The officer comes from Lishkat HaKorban's door on the Mount, up the Moked's flight, knocks; two elders of the west
  ledges open the chel door; he steps in and calls.** ⚙ — "the officer comes and knocks on them, and they open to him"
  (Tamid 1:2); where he spent the night is not said.
- **First lottery round the hearth (chol half), five men with the officer north of the circle, nobody on its west where
  the impure kohen kneels; the count starts with the man whose mitre is lifted and runs clockwise; one or two fingers
  each, three rounds, ending on the slab kohen.** — Yoma 22a (fingers, no thumb), 25a (circle, mitre); the place: the
  hall, as the schedule stages it (CLAUDE.md). The mitre is a `point` toward the head (requested: a lifting gesture and
  a headgear toggle).
- **The torches are lit at the hearth after the lottery (weekdays); on Shabbat no torch.** — Tamid 1:3 "two torches of fire
  in their hands"; Rambam BhB 8:12.
- **Inspection: the officer takes the key from under the slab, unlocks the wicket; the officer leads the east company (with
  one torch), the west company (three, one torch) takes site.js's long route; they stop at the corners to look (east: also
  by the rings and the altar's NE); the east company waits at the meeting place; "Shalom — all is well"; the bearers give
  the torches to the officer, who takes them into the chavitin chamber "to set the makers to work".** ⚙ (which company the
  officer joins, the torches' fate) — Tamid 1:3.

## The altar by night (Rambam MK 4:2–3, TuM 1:6–7; Tamid 2:1; Zevachim 9:6)

- **Evening crew in the four garments with forks, tending at stations round the great pile (its west end touches the
  tapuach) — mostly on its south and east sides, which the ramp-top view sees, now and then on its north; one carries
  the last limbs and fats up from the lower west half of the ramp (where they lie salted, Tamid 4:3) — up on the east half, down on the west (Zevachim 63a); one carries a log now and then ⚙; a limb that springs off is put
  back before midnight (weekdays).** — the schedule's evening events; counts not given.
- **Friday: work ends at sunset, the crew go in to sleep while the Moked gate is open; nobody at the pile on Friday night.
  Shabbat: three put Shabbat's limbs on before sunset, then only tend until midnight; no wood carried on Shabbat ⚙.** —
  Rambam TuM 1:7 (Kesef Mishneh), MK 4:3.
- **After midnight one kohen (y0) waits on the altar top south of the pile, back from its heat, fork in hand, and every 15
  minutes of the clock (a global grid: 1440 is a multiple) turns what lies on the fire — south side, now and then the
  east — then steps back. He is in the ramp-top view the whole time (late-turning 100%). On a weekday his evening track
  at 24:00 and his small-hours track at 00:00 are the same moment of the same round, so the day's wrap no longer jumps
  him 20 m (review).** ⚙ — "turned all night" (TuM 1:6); no one may be at the altar when the clearer goes up alone (Tamid
  1:4). He goes in to immerse so as to reach the mikveh last of the five; from then (≈ alot − 62) the pile burns
  untended until terumat-hadeshen's muchni — an accepted gap in night-turning's view. On Friday and Shabbat dates the
  wrap joins two different nights (Friday night vs Thursday night), so y0 changes place there by nature.
- **Limbs on the fire lie on the great pile's south flank, on the outermost billet of a layer against the next (the pile
  as altar/fire.js builds it), in front of the flames from the ramp-top view (review: they lay inside the flames on
  top). The evening's last three carried limbs stay on the fire through 24:00 at exactly the spots, names and headings of
  the small hours' three leftovers, the last of which is terumat-hadeshen's limb at dawn (its spot on top kept); the
  earlier ones burn away after 4 hours.** ⚙ — Tamid 2:1 (limbs not consumed since evening). Raw-meat props (charred
  variants requested).
- **The evening crew come out of Beit HaMoked by its gate (open by day), round the altar's east to the vessels by the
  ramp's west foot, take their forks there (where they lay them down at night) and go up the east half (review: they
  appeared on open pavement).** ⚙ — altar-night's lead (2.5 min) covers the walk.
- **Friday: the crew go in by the Moked gate at sunset; moked-night is relevant from 45 minutes before the locking, so
  they are staged all the way in (review: they vanished at the gate for 18 minutes).**
- **Fire: full in the evening, a flare (≈ +0.2, decaying over ~1.2 min) at each limb or log, sinking after midnight to
  0.84 (0.7 when untended on Friday night), back to 1.0 in the minutes before muchni.** ⚙

## The Gazit (Yoma 25a; Tamid 3:1, 5:2–3)

- **Circle round the lottery station in the kodesh half, ≈0.68 m a man (radius 2.6–4.4 amot, inside the nave between the
  column rows); the officer in its middle turning to each finger;
  the second lottery's sixteen: G2's winner and eight brothers from the altar, two barkai watchers and five more with the
  officer from the chavitin chamber.** ⚙ — thirteen tasks need at least thirteen; the chol half is closed by the
  Sanhedrin's tiers, so everyone comes by the east door.
- **Third/fourth: only "new" men hold out fingers for the incense; then all for the limbs; those who did not win stand at
  the wall niches and three attendants (chazzanim), who come in by the east door during the fourth draw, go from man to
  man along each wall: each takes the man's garments (`receive`), turns and lays the bundle in the niche (a folded
  garments prop stays there); the man bends as they come off and goes out by the east door.** — Tamid 5:3 ("handed them
  to the chazzanim, who stripped them of their garments and left them only the breeches; there were niches there with
  the names of the vessels written on them"). The attendants are staged as Levites (plain white) ⚙ — the Mishnah does
  not say who they were (Bartenura: attendants). Deviation: with no breeches-only figure the man changes straight into
  his own clothes at the bottom of the bend (requested: a `kohen` variant in breeches only).
- **Afternoon (weekday) twelve, new men for the incense; Shabbat afternoon twenty, the 13 tasks then the incense.** — Yoma
  26a; Sukkah 56b.

## Hand-overs with the neighbouring groups

- **To terumat-hadeshen (G2) at muchni.t0 − 0.8: the slab kohen (its winner, seed 0x7468) and y0–y3 (its brothers 0–3,
  0x7469) standing at its groupSpot, facing west; its brothers 4–7 have no predecessor in G1 (requested).** The last
  small-hours limb on the pile (limb_gerah at onPile[4]) is shown until muchni.t0 − 2, when its leftover limb takes over
  at the same spot.
- **From terumat-hadeshen into the second lottery: its men start in lotteries.js at its Scripts' `tEnd`, at its
  `P.gazit.inside` (read-only from its state when it has planned the date; a fallback otherwise). Two of the circle go out
  as barkai.js's watchers (0x6261) at its `tOut`.** The circle leaves for the tasks after tamid-morning's lamb-bringers
  go out of the door (lamb-brought.t0 + 0.4).
- **gazit-shema hands its twenty regulars (0x6745) and the officer (0x6743) to the third lottery at its t0 − 0.3, at the
  circle spots (it mirrors lotteries.js's circle); lotteries.js starts them in place when that module exists.**
- **The inspection's officer stands just inside the chavitin chamber's door with the two torches while the makers set to
  work, lays the torches down by their griddle (they light their fire from them ⚙), and stays with them until he leaves
  for the second lottery at its t0 − 4.75, where lotteries.js takes him from the same spot (review: he vanished inside
  for 35 minutes). torch-inspection's lag is 38 for this; lotteries' lead 5.**
- **The keys (locking, the officer's key): he kneels at the slab's south side and reaches to it with both hands
  (`hold_legs`: kneeling, leaning, hands to the floor) before the keys show in his hand; the reverse when they go back.
  At the gates the turn of the key is a `point` with the keys, turned so the arm reads from the event's view.** ⚙ —
  requested: a movable keys slab and a 'lock' gesture.

## Checks

- `node src/sim/choreo/g1/dev/plan-check.mjs all [--map] [--legs person]`: per day type — every resting spot on the chol
  floor, clear of hearth, leaves, lamp; no two simultaneous footprints intersecting (minimum clearance printed); no
  walker within 0.3 amah of a resting body; no meeting on the winding stair; view coverage of dawn-immersion,
  mesibah-keri, late-turning and night-turning; continuity of every figure through the whole day (0.02-min steps, the
  24:00 wrap included, module relevance from the modules' own lead/lag): pops fail, appearances and vanishings listed.
- `src/sim/dev/tests/g1-night.js` adds a cross-module hand-over check in the browser (same pool seed + index in any
  choreo is the same man) over the critical windows of the three dates.

## Verification (choreo-g1-night-fix; src/sim/dev/tests/g1-night.js, low tier, HD 4600)

- plan-check `all`: no issues on the three day types. Minimum clearance between footprints occupied at the same time
  0.19 m (weekday), 0.11 m (Friday), 0.12 m (Shabbat — the sitters); no walker within 0.3 amah of a resting body; no
  meeting on the stair. Views: dawn-immersion 99%, mesibah-keri 99%, late-turning 100%, night-turning 82% (the rest is
  after the turner has gone in to immerse — accepted). Continuity: no pops through the day; appearances only inside
  Lishkat HaGazit, Lishkat HaKorban, the music chamber, the Moked hall and the chavitin chamber; vanishings at the
  Kiponus gate, the Gazit's door and the hand-over spots.
- Determinism: 32 moments × 3 jump orders on 2026-11-02, 11-06, 11-07 — every figure, prop, door and the great pile's
  fire identical. (Found and fixed: the fire handle's change cache kept a stale level after terumat-hadeshen had
  driven the same fire in between; altar-night now keeps its own cache, dropped on jumps and release.)
- Hand-overs (same pool seed + index across every choreo, 0.02–0.1-min steps through the critical windows): no one shown
  twice; no pops on the weekday; on Friday and Shabbat dates one jump at 00:00 (y0: the day's wrap joins Friday night
  to Thursday night) — inherent. The Friday crew is staged all the way into the Moked. (Found and fixed: lotteries'
  `gazit:off` pool had 10 slots for 20 men; the incense and pan winners now reach the Gazit doorway exactly when
  ketoret-morning takes them.)
- Cues at 120×: every planned G1 cue in the evening and small hours fired once, no duplicates, none on jumps.
- Cost: per-module p95 0.08 (moked-night), 0.10 (altar-night), 0.18 (lotteries), 0.10 (torch-inspection) ms; one
  lotteries frame of 0.98 ms (its per-date Gazit plan and free props on the first frame).
- Shots: `shots/choreo-g1-night-fix/low` (every event's view, plus review angles) and `.../high` (event views and
  close-ups: the hearth, the Friday sitters, the keri at the fire, the pile's flank, the attendants, the chavitin
  chamber).
