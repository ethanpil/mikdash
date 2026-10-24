# qa-r2-fix-sim — decisions

Fixes from the second QA round in src/sim/** (SIM-R2-1 … SIM-R2-12). Format: **Choice** — why — alternative. ⚙ = reconstruction.

## SIM-R2-1 — the avnet outside the avodah

- **The sha'atnez avnet is off for every kohen whose state here is not avodah: the meal by day and at night, its cook and
  the scouring (courts-daily `meal` / `cook` pools), the showbread's division and eating and the Kohen Gadol's eaters
  (shabbat-mishmar `outgoing` / `incoming` / `kg-kohanim` pools), and the waiting that hands over to them in the swap
  (shabbat-showbread: the four who took the old bread out, from the moment they have laid it on the gold table; the two
  who burned the bazichin, from Lishkat HaKelim on).** Rambam Klei HaMikdash 8:11 and the logged ruling
  (docs/decisions/people.md). Set per pool (`spec.avnet: false`) or per Script segment (`Script.avnet(false)`), never per
  pose: a pose is the same in and out of the avodah. — Per pose (a stand would be guessed as idle) or people/ deciding.
- **Kept on for anyone between parts of a service he goes on with (the Gazit's Shema between the tamid's parts, the lots,
  the blessing, a G5 kohen between the steps of one offering), and for those entering avodah (the change of the bread,
  the bazichin, the tamid, the individuals' offerings).** Untying and re-tying a 32-amah sash between two parts of one
  service is not plausible and is not described. — Taking it off at every pause.
- **The Kohen Gadol's flag is not touched** (his golden avnet is under the me'il; people/ has no flag for him).
- **Left as they were: kohanim at work that is preparation rather than a service in the court — compounding the incense
  (beit-avtinas), salting the hides (chambers-daily parvah), baking the chavitin and the showbread (bakers, Beit Garmu).**
  Whether these count as avodah for the avnet is not decided by the logged ruling; changing them needs one. — Taking it
  off for every task that is not one of the services.
- API: `Slot.avnet(on)` (change-cached; undefined = the pool's own), pool spec `avnet`, `Script.avnet(on)` (g2/lib.js,
  stamped on the steps that follow; `applyFigure` applies it). Test: src/sim/dev/tests/avnet.js.

## SIM-R2-2 — "Go" watch spots

- **New spots (g5/geo.js V): korban [168, 384.5, 16] h 330 and bechorot [170, 272, 16] h 215 — in the strips between the
  Heichal's base and the court's walls, before each gate and off the way in, looking into the gateway and down its flight
  (a first try further east looked along the strips at the gates' folded leaves); south [182.5, 274, 16] h 276 (the south strip's east end, looking along the chambers'
  north faces to the Parvah); nikanor [267.5, 325.8, 13.5] h 289 (on the landing at the head of the fifteen steps, south
  of the way up, through the open gate into the niche between Lishkat Pinchas and the chavitin makers' chamber); moked
  [195, 383.5, 16] h 66 (west of the hooks' pillars: the old spot stood among them, 2.3 m before a pillar).** ⚙ The QA's
  suggested nikanor spot north of Pinchas [253, 356] looks south into Pinchas' north face (the chamber reaches X 248 into
  Ezrat Yisrael) and stands in the ma'amad's rows: the gate's niche is visible only from the west or from the landing.
- **A separate view for the meal-offering's hava'ah (g5 V.hava [246.3, 309.5, 13.5] h 355):** the hand-over at the foot of
  the duchan, south-west of the gate, is behind the chavitin makers' chamber from the landing. — One spot for both.
- **The mourner's row view is checked against the physics (g4/watch.js mournerView: the first of 12 stands ahead and to
  his right that is open Mount floor with him in sight).** Near the southern gates' flights it stood on a flight or 2.5 m
  from its side.
- **Guard: src/sim/dev/tests/views.js** — every data view, every dynamic row's view through the day (three day types)
  and the live views: a floor within 0.6 m of its Z, nothing solid at +1 m, a level ray from the eye clear for 4 m. It
  splits failures by owner; the data's three (chavitin-bakers, bread-warm, court-in-chel) are requested from data.

## SIM-R2-3 — the Chuldah passages under every amah

- **The passages' walking line is read from site.js (`context.chuldah.tunnel-w` stairPath: the level passage's floor and
  the stair's tread-midpoint line) — g4/mount.js `CHULDAH`, `chuldahLine(x, inward)` — and every route through them uses
  it: the gates' in / out, the mourner's, the stoa's and the plaza's.** The depth is the real Ophel–platform drop, so in
  amot it changes with the standard (Naeh −27.08, Feinstein −24.08, Chazon Ish −22.57; the stair 54 / 48 / 45 risers).
  — Per-frame floor queries for the tunnel walkers (cost, and they snapped onto the stair's side walls).
- Test: src/sim/dev/tests/floors.js "ways" under `amah=naeh|feinstein|chazonish` (0 bad samples in all three).

## SIM-R2-4 — "Next" after midnight

- **`schedule.upcoming()` lists today's events that start later today, then the next civil date's own events (eventsFor
  its day type) resolved against its own zmanim; a next-day row is `Object.create(event)` with its own t0 / t1 / tPlan and
  `nextDay: 'YYYY-MM-DD'`, so the data's object and today's resolution are untouched.** An event active now is not listed
  again for tomorrow; an empty window (a retime for something not staged today) is not listed. The next day's resolution
  is cached per date and retimer set. — Wrapping today's list (Friday night showed the weekday night-turning; Saturday
  night Shabbat's dawn lamps).
- A retimer is called with a third argument `{ nextDay: true }` for the next day's rows (the nazirites' then keeps the
  data's window: tomorrow's sets are not planned yet).
- Test: src/sim/dev/tests/upcoming.js. The UI shows `nextDay` rows as today's: requested (label them, and set the date
  before jumping to one).

## SIM-R2-5 — Ish Har HaBayit

- **At the Mount's own gates (Tadi, Shushan, Kiponus) the officer greets the guard from the Mount, behind him** — the
  guard faces into his gateway, so "in front of him" was in the shut gate's passage; the torch-bearers then stand between
  them on the Mount. **Off a post the bearers are clamped to the Mount's floor inside its walls (3–497 amot) while he walks
  on it.** Along the north wall the side offset had put one in the wall, placed on its top 40 amot up.
- **"Go" stands ahead of him on his line, a little aside (15, 12, 19, 9 … 36 m ahead × ±1.8, ±3, 0 m), facing back toward
  him: the first stand on open floor at his level with nothing solid at +1 m, him in sight (no wall, pier or door leaf —
  the door leaves are tested by their world boxes), nothing within 4 m straight ahead and a ±20° cone clear for 3 m; then
  with the level ray only; then him in sight alone, behind him too (down a Chuldah stair the treads hide him from above).**
  Cached for 2 s of the clock. He comes toward the viewer for about 13 s (15 m at his 1.15 m/s) and passes a pace to the
  side, instead of walking out of the frame in 8 s. — Behind him (the old rule), or a fixed view.
- "Re-query on arrival" for slow travel is the UI's (it walks to the stand read at the click): requested.

## SIM-R2-6 — the listed windows staged

- **vessels: from the first bearer out of Lishkat HaKelim to the last vessel set on its table (+0.3); showbread-swap:
  from its start to the old bread laid on the gold table (bread-warm carries the Ulam on); nazirites: from the first
  party crossing Ezrat Nashim to the chamber until the last leaves it, an empty window on a day without a nazir** —
  published with `ctx.schedule.retime` as offsets from the data's start (vessels, swap) or the date's own plan
  (nazirites, after its plan is built; the data's window until then), the data's window kept as `tPlan` for staging
  (chambers-daily now reads tPlan: `winPlan`). On 2026-11-02 / 11-07: vessels 04:56–05:01 (data 04:54–05:06; the four
  bearers out at its start, two at its end), swap 08:30–08:34.4 (data –08:40), nazirites 09:53–12:24 (data 08:12–13:11).
  The vessels' caption moves to the first bearer's exit + 0.55 (CUE_LEAD rule). — Stretching the staging over the data's
  minutes (the sources give the order, not minutes).
- The vessels view itself (data's [249.5, 386, 13.5] h 0, a door leaf 1 m away) is requested from data.

## SIM-R2-7 — the Mount's plaza by day

- **People crossing the open Mount (courts-daily plazaWalkers): small parties up the western Chuldah passage by its
  middle, right across the pavement to a place on it (a Poisson set of 13-amah-apart places between the stairs' lines,
  south of the circuit's lanes), standing a while talking or turned toward the Sanctuary, sometimes moving on to a second,
  and out down the eastern passage's middle — in by the right, out by the left (Middot 2:2) ⚙.** They pass no station
  (they do not go round), cross the stream's way up from the western stair only when its passage booking is clear (as the
  stoa's gatherings), keep the passages' middle lines in file with the stoa's, are kept 1.2 m from other parties by a
  closest-approach test (straight motion between samples 4 s apart) on a (time, cell) hash, and leave a place in file
  (3 m apart). Rate 1.1/min × the tier's density × the day's rhythm ⚙; ≈ 0.1 s of planning on low.
  — More of the stream (doubles its booking cost; the stream crosses the plaza only on its two straight lines), or
  re-routing the stream's junctions across the plaza (would skip stations 1–2 of the thirteen).
- Measured on low (2026-10-23, Y 46–230 off the stoa's front): see the verification section.

## SIM-R2-8 — Ezrat Nashim's standing places

- **The west column's two outer places are clipped to the oil and lepers' chambers' east faces (site.js) plus an amah: X
  303 for Y 303.5 and 357.5.** Plan-time check (courts-daily `checkPlaces`, once per physics version): every fixed
  standing place of the module (EN clusters and their members' places, Ezrat Yisrael's, the gatekeepers' posts, the
  plaza's and stoa's places, the meal's, the cook's, the scouring's) not inside a solid at +1 m and within 0.15 m of the
  floor at its level, else one console warning.

## SIM-R2-9 — the altar's tenders

- **The stations round the great pile are booked: each tender of the evening crew stands only at a station no one
  planned before him holds then; he cuts a wait short where another is due and moves to the nearest free one; his last
  wait (to midnight or the crew's going down) is at a station free for all of it.** The limb and log tosses are thrown
  from the east face between its two stations (every third limb was thrown from station 2's own spot). — Fixed offsets
  per tender (two at one station 0.2 m apart still overlap).

## SIM-R2-10 — off-floor legs

- **The sovev: from the small ramp's head onto the ledge (node RS_3 [226, 307, 22]) before turning east to the SE corner**
  (the straight leg crossed the gap east of the ramp, 2.9 m over the pavement).
- **Lishkat HaMedichin's places follow its furniture as build-courts lays it (g5/geo.js `medichin`: the winding stair in
  the SW corner, two marble tables, the trough): three places north of the north table, three in the aisle facing it (G5
  lanes 0–5), three facing the south table (G4's sets), reached round the north table's west end (nodes MED_W, MED_A,
  MED_B).** They stood on the stair's treads and the tables' tops. — Raising the figures onto the furniture's height.
- **The chel steps tread by tread (g4/mount.js `chelSteps`, from site.js mount.chel.steps: each tread at its height, the
  riser climbed over 0.12 amah)** — the slope through them was up to 0.24 m under the treads.
- Found by the new floor check and fixed with it: the wine bearers round the kevesh's SW corner (they cut through the
  ramp), the ma'aser's kohen and the hava'ah's owner off the duchan's step, the metzora's bow after his atonement out of
  the chavitin makers' chamber's corner, the Moked hall's threshold and the head of the fifteen steps placed by the
  physics (MOK_X, LAND), the nazir's waving kohen keeping the graph's stair flags over the duchan and the steps.
- Test: src/sim/dev/tests/floors.js — tracks (G5's offerings and G4's sets at their authored heights) and a sweep of every
  wanted G4 / G5 figure each 10 min for solids and floors.

## SIM-R2-11 — the shabbat-midday test

- **The test sets a time inside showbread-eaten after setDate and waits (≤ 120 frames) for both modules' plans** (they
  are built lazily in an update while an event is near).

## SIM-R2-12 — the day's planning off the boot's critical path

- **The heavy per-date plans (private-offerings, courts-daily, sanhedrin, nikanor-stations, chambers-daily: `planRank`)
  are steps of a boot plan job (src/sim/lib/planjob.js) run after the first image, in ~8 ms slices between frames on the
  macrotask queue, in the order they read one another; until a module's plan is in it shows nothing (`sim.planNow()`
  false, its plan() null).** The planners are iterators (`planSteps`): G5's placements yield every 4 animals / 8 birds
  and meal-offerings, courts-daily's planners every 8 arrivals, chambers-daily between its parts and the nazirites'
  sets. A screenshot boot (shot=1: the shot tool, the dev tests) finishes the job at 'firstFrame' in one go, so shots
  and tests see the whole day planned, in the same order with the same results as before. `?planjob=0` plans in init as
  before (an A/B switch). — Planning only the hours near the clock first: the bookings make a later plan depend on the
  whole day before it, so a partial plan is not a prefix of the full one (figures would jump when it was replaced); a
  Worker (the planners read ctx: the physics, anchors, people's stations); planning in the shader warm-up (tried first:
  see below).
- **Measured, production, low, cold (this HD 4600), interleaved A/B:** the plans cost 3.0–5.1 s of main thread in sim's
  init (private-offerings 0.4–0.8, courts-daily 1.5–2.3, chambers-daily 1.0–1.7 s). Tried first — the job sliced from
  'ready' through the shader warm-up — it only lengthened the CPU-bound warm-up by as much: 'ready' 3 s sooner, 'compiled'
  and the first image no sooner (20.5–20.9 s against 20.2–20.6 s). After 'firstFrame' (kept): 'ready' at 5.3 s against
  8.6 s, the first image at 19.07 s against 18.99 s (the clean pair; the other pair's job run was disturbed — world and
  people 2–4 s slower than every other run), the job done 4.2–4.7 s after the first frame in 77–89 slices (CPU 1.6–1.9 s,
  the longest slice 170–290 ms). On this GPU the first image waits for the shader programs issued from sys:people on,
  which the old init-time planning already overlapped: what this saves here is 3 s of frozen loader and main thread, not
  first-image time; a GPU that links faster gains up to the planning time. warmup-check (cold, prod): low shot +96 ms /
  play +155 ms after 'compiled' (worst play frame in 5 s 717 ms; before 767 ms), high +950 / +975 ms — all pass.
- **Remaining: a date change in play (the clock through midnight, the date picker) still plans the G4 chain in the
  frame that needs it** (chambers-daily is always relevant): ≈ 0.7 s on low at 00:00 in the cues test, as qa-r1 left it
  plus this round's plaza planner. Running that through the job would leave the courts empty for the seconds it takes.

## Verification

All on low unless noted (this machine's HD 4600); shots in shots/qa-r2-fix-sim/.

- avnet.js: off 7/7 at the day meal, 8/8 at the night meal, 3/3 at the scouring, 32/32 at the division, 5/5 at the Kohen
  Gadol's loaves, 4/4 waiting by the gold table; on 8/8 at the change, 2/2 at the bazichin, 8/8 at the tamid's
  slaughter, 14/14 for the individuals' offerings (before: every eater wore it).
- views.js: 173 views, none of the sim's failing (before: the four G5 spots inside masonry, the officer at the north wall's
  top and under the fifteen steps' landing, the moked spot before a pillar, the mourner on the southern gates' flights).
  The data's three failures are requested. Shots v-*.png (before: shots/qa-r2-ux/v-nikanor.png, v-bechor-240.png).
- floors.js under Naeh / Feinstein / Chazon Ish: ways 0 bad of 3040 / 3373 / 3573 samples (before: every Chuldah sample
  buried by 1.76 m / 2.74 m under the larger amot); G5 / G4 tracks 0 bad of ~360–420 thousand samples; the sweep of every
  wanted G4 / G5 figure each 10 min 06:00–18:00, 0 inside a solid or off the floor (before: en-men / en-women in the oil
  and lepers' chambers, the metzora in the chavitin makers' chamber, set kohanim on the Medichin's stair and tables).
  Shots chuldah-*-1236.png, en300-0930.png, medichin-1145.png.
- upcoming.js: Friday 23:30 lists Shabbat's dawn (lamp-inspection-shabbat), no night-turning; Saturday 23:30 the
  night-turning, then Sunday's torch-inspection; Friday 19:00 no after-midnight turning.
- altar stations (probe every 0.5 min through the evening windows of 11-02 / 11-06 / 11-07): 0 pairs closer than 0.45 m
  (before: two at 228.4, 323.3 on Friday 15:30, three at 222.4, 316.1 on Shabbat 19:00). Shot altar-sat-1900.png.
- the officer: no figure of his party above Z 5 on the north leg (before: 40); live views o-*.png (19:20 in the north
  stoa, alot − 25 by the NE corner, Shabbat 00:30 in the Azarah's north strip — before: a stoa pier, a door leaf).
- windows: vessels 04:56–05:01 with 4 / 3 / 2 bearers shown at its start / middle / end; showbread-swap 08:30–08:34;
  nazirites 09:53–12:24 (2026-11-02).
- plaza (2026-10-23, Y 46–230, every 15 min 07:30–15:45): low avg 8.4 (0–18), high avg 20 (5–33) people on it, all drawn;
  before: none. Shots plaza-*.png.
- regressions (low): g4 — deterministic on three dates, its overlap sweep 0 close pairs on both days (a first run found
  20 between members of one plaza party leaving a place together: they now leave in file), cues 56 / 80 / 1 all fired,
  cost ≤ 0.7 ms avg; g5 — deterministic (after the carried animals' empty prop is stated), cues 57 / 57, missing 0;
  g6, g1-night (pops 0, dups 0), g2 (ways 0 bad), jumps, jumpto, cues (600×, no doubles), dates, patrol, fires — pass;
  shabbat-midday now runs as documented and passes. validate-schedule and coverage: 0 errors, no gap over 10 min.
