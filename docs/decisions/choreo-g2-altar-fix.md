# choreo-g2-altar-fix — decisions

Review fixes for group G2 (`terumat-hadeshen`, `barkai`, `tamid-morning`, `tamid-afternoon`, `gazit-shema`; helpers in
src/sim/choreo/g2/). The base decisions are in choreo-g2-altar.md; this file records what changed and why.
Format: **Choice** — why (source / evidence) — alternative. ⚙ = reconstruction.

## Who

- **The Shabbat afternoon crew is the incoming mishmar with faces of its own: `SEEDS.shabbatIn` = 0x696e (was 0x7469,
  the dawn brothers' seed).** — Sukkah 56b: the outgoing watch offers the morning tamid, the incoming the afternoon.
  The same seed now drives gazit-shema's incoming rows (15 men: the afternoon crew 0–12 and its two lamb-fetchers 13–14)
  and G6's incoming watch (g6/bread.js imports `SEEDS.shabbatIn`). — Reusing gazit-shema's old slots 20–31 of 0x6745
  (the lotteries' regulars' pool) would tie the incoming watch to G1's pool size.
- **The limbs-up bearers are lotteries.js's fourth-lottery winners: `SEEDS.up` = `seedFrom(0x6745, 11)`, so slot i is
  Gazit man 11 + i (the six limbs, the flour, the chavitin — lotteries' `limbWinners` 11–19, the 19th being the wine).**
  — Tamid 5:2: the fourth lottery is "who brings the limbs up from the ramp to the altar". `seedFrom` inverts the pool
  face formula (seed × 7919 + i × 104729, mod 2³²; 7919 is odd, so it has an inverse), so a small pool continues men
  from the middle of another module's pool. G6 musaf's `limbs-up` pool imports `SEEDS.up` and follows. The flour and
  chavitin go up with up#6/#7, not with the morning crew's F/C (no more `hide()` teleport).

## Hand-overs and entrances

- **gazit-shema `lead` 9 (was 1.2).** — Its crew scripts start at `M.t.gazitIn`, the moment tamid-morning brings each man
  to the Gazit's inside spot; the slaughterer arrives ≈ 5½ min before the Shema. With lead 1.2 the men vanished at the
  door and reappeared deeper in the hall minutes later. A plan-time warning fires if the lead stops covering it.
- **The regulars and the officer come out of the chavitin makers' chamber (as lotteries.js does) and walk the court's
  north to the Gazit; the incoming watch comes in by the Nikanor gate.** — They no longer pop in at the inside spot, which
  is the schedule's Gazit view spot. ⚙ origins.
- **The limbs-up men leave the Gazit (where they won the lottery) ≈ 3½ min before limbs-up and wait south of the ramp's
  foot; by the north passage and the east of the court.** — Not across the Ulam's steps while the kohanim bless the
  people there (birkat-kohanim, sunrise+71–75); they used to appear in a line on the apron.
- **The tamid's watering limb-winners leave the Gazit just in time to walk there at a normal pace (`Script.walkAt`).** —
  `walkBy` stretched whole walks into a crawl when there was slack.

- **The Kohen Gadol and the segan on Shabbat: taken over from G3 at limbs-up t0 + 0.002 on the apron and handed back
  to G3's libation at t1 − 0.002 at the SW corner (same spots; a probe showed both ends meet).** — The scripts used to
  include both boundary instants, so the faces check saw the man twice at t1.

## Ways and floors

- **Every G2 figure stands at its authored Z (`Script.exact()`); only legs over stairs query the floor (the Ulam's twelve
  steps, the duchan between Ezrat Kohanim and Ezrat Yisrael, the Water Gate's newel stair).** — `placeNear` picked a
  higher collider passed under or beside: the Gazit's roof (Z 36) and a beam (18.6) near its east door, the nanasin's
  cedar caps (20), table tops (17.5). Exact placement also saves a physics query (≈ 0.006 ms) per moving figure per frame.
  Other groups' use of `Script` is unchanged (exact is opt-in).
- **Routes rebuilt where a probe of every leg against the physics floor found something in the way:** west of the ramp
  the way passed through the silver and marble tables, and between the ramp and the altar's SW corner it crossed the
  amah's open channel (site.js: open, 1 wide, at X 198.5–199.5 up to Y 305.5) — now `way.westUp`/`westDown` keep west
  of the tables and round the channel's north end; the receiver's way to Lishkat HaParvah went through the Ulam's south
  wall — now round the south of the Ulam block; diagonals through the nanasin and the marble tables — now straight
  through their gaps (`lane()`); the rakers crossed the tapuach on chords — now on arcs round its foot; the fig-wood
  bearer cut across the incense pile; into the muchni's frame from its open south side. The test (g2.js §2) keeps it so.
- **The shovels and forks lie side by side west of the tables, east of the channel, taken up from the east.** — The old
  spot was on the new way. ⚙
- **The Gazit's rows stand in the nave between its two rows of columns (courts/chambers.js: Y 375.6 and 386.4, X 69.5 /
  76 / 82.5, on plinths ≈ 1.3 amot from their axes), eight abreast, kept 1.5 amot off both column lines; the officer
  between two southern columns; on Shabbat the incoming in the two northern rows; everyone enters past the south-east
  lamp stand.** — The old rows stood on column plinths and the walk-ins passed through the column by the door (the Z 36
  flicks were the roof found inside it). Remaining: lotteries' third-lottery circle (radius 4.4 round (80, 381)) puts
  places 4–6 and 16 on the column plinths (G1 request).
- **The court's east line bends west at Y 297–301 round a copper vessel the altar builder stands there (a probe found
  it; it is in no site.js element).**
- **The limbs are thrown on from the great pile's south side, the first of it a bearer reaches turning right from the
  ramp's head ⚙ (the east face before), then on round to the right and down the west half.** — Where on the pile is not
  stated; the south side is also in view from the top of the ramp (the limbs-up view).

## The service

- **Knives from Beit HaChalifot (Middot 4:7 "where they store the knives"): the slaughterer goes up the Ulam's steps to
  the north wing's niches, takes the slaughtering and the flaying knife, lays the flaying knife on the marble table and
  keeps the other; after the flaying he takes both back there.** — The knives no longer come from Lishkat HaKelim. Which
  niche, and when they are put back, ⚙.
- **The binding: two kneel holding the lamb from the north (the bound hind legs, the hindquarters), four stand by 2½–3
  amot back.** — Four kneeling men overlapped and hid it; the lamb's head (south), face (west) and the slaughterer on its
  east now show from the south-west (a view there is requested).
- **The cut at slaughter.t0 + 1.6 (inside the window), the receiver goes straight to the NE corner and throws at
  blood.t0 + 0.3, walks round the north and west at a measured pace, throws at the SW corner ≈ t0 + 1.8, pours ≈ t0 + 2.4,
  takes the basin back through ≈ t0 + 3.2.** — The blood's action used to end ≈ 1.2 min into its 4-min window and the
  blood was held ≈ 4½ min. The schedule's 1-min gap between the windows remains (request: start tamid-blood when the
  slaughter ends).
- **Salt on everything laid on the ramp except the wine: the six bearers' parts, the flour and the chavitin.** — Tamid
  4:3 "and they salted them"; nothing goes on the altar without salt except the wine of the libations, the blood and the
  wood (Rambam Isurei Mizbeach 5:11; Menachot 20b). The wine's spot was being salted.
- **The sixth bearer holds the shanks from the cut until the innards (Tamid 4:2 gives them to him first), shown as an
  empty `bazach` ⚙; `entrails_bazach` already models the shanks laid on the innards (people/props.js).** — The review's
  "shanks not shown" holds only for that interval; a shanks prop is requested.
- **The limbs stay on the great pile after they are thrown, for LIMB_BURNS = 240 min (altar-night's convention), both
  temidim, owned by tamid-morning (always relevant).** — They vanished at the throw. The innards (their bazach is not
  burnt), the flour and the chavitin are not shown on the fire.
- **The new wood shows on the piles as each log is thrown (the great pile's gizrin east–west, the fig wood on the incense
  pile) until the afternoon's two logs.** — The builder's pile cannot be cleared or rebuilt (one static mesh); a pile
  movable is requested. ⚙ placement.
- **Shabbat: the incense pile is lit to 0.85 (eight se'ah of coals, not five — Tamid 2:5) and eases to the builder's 0.6
  over 4 hours; terumat-hadeshen is its only writer.** ⚙ levels.
- **Vessels: two in hand a trip, more trips (10 vessels shown on the silver and marble tables), and taken back a pair a
  trip after the afternoon (`VESSEL_LOADS`, `RETURN_TRIPS`).** — Tamid 3:4 says 93; the destination of most is not stated
  (⚙). The torch-bearer lights the shelves just inside the door, seen from the schedule's doorway view.

## Poses and effects (stand-ins until the requested poses land)

- **Muchni: 'stoke' (both fists forward, working) instead of a standing 'carry'.** — The 'windlass' pose is requested.
- **The silver pan carried in both hands before him ('carry_walk', tray grip) instead of raised like a torch.** — Tamid
  1:4: he goes without a lamp; the old pose read as one.
- **The heaped coals: a small hearth at ≤ 0.2 without its own light: a glowing bed with low flickers.** — An 'embers'
  fx kind is requested.
- **Gazit: most stand listening; now and then one speaks ('sing') for half a minute to a minute (≈ 15 %).** — Everyone
  had both arms forward.

## Views (schedule-data owns them; each checked with a shot in shots/choreo-g2-altar-fix)

- **Kept:** vessels (the torch-bearer now lights the shelves just inside the door, in the doorway view); limbs-up and
  afternoon-limbs (the throw is now from the pile's south side, in the view from the top of the ramp).
- **Requested:** terumat-hadeshen [233, 277, 16] h 320 (the ramp's east half, the top's edge and Beit HaDeshen);
  lamb-brought [210.5, 399.8, 16] h 205 (inside Beit HaMoked: the wicket and the lamb chamber's door both in frame);
  lamb-watered [217.5, 387.5, 16] h 270; tamid-slaughter [209.8, 344.2, 16] h 40 and tamid-afternoon [217.8, 344.2, 16]
  h 40 (south-west of the ring: the lamb's head, face and the slaughterer on its east); tamid-blood [239.5, 332.5, 16]
  h 305 (side-on to the NE corner, the basin in view; from the old spot his back hides it).
- **Timing requested:** tamid-blood to start when tamid-slaughter ends (sunrise + 3), so the blood is not held a minute
  between the windows (Tamid 4:1 runs straight from the receiving to the NE corner).

## Cost

- **Exact Z, and the floor query only on stairs.** — g2.js §6 on low (the five modules summed, runtime EMA per frame,
  120× play through the dawn service, the Shema and the afternoon tamid): weekday 2026-11-02 avg 0.13 ms, p95 0.22 ms;
  Shabbat 2026-11-07 avg 0.17 ms, p95 0.30 ms, max 0.43 ms. Single-frame hitches still show now and then (an EMA peak of
  0.5–0.8 ms decaying over a few frames, a different module and minute in each run: 04:51 barkai, 04:57 tamid-morning,
  06:33 gazit-shema with terumat-hadeshen at once, 14:26 tamid-afternoon); timing the update directly across the 04:57
  minute found no frame over 2 ms and no audio cue over 1 ms, so they read as main-thread pauses shared with the other
  sessions running on this machine, not per-frame work.
