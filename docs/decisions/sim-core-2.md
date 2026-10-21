# sim-core-2 — decisions

The sim runtime's shared fires and plan getters, the hand-overs the choreography groups' logs requested, and the
Shabbat-midday staging of the data-3 events. Format: **Choice** — why (source / reasoning) — alternative.
⚙ = reconstruction (the sources fix the order, not the spot or the minute).

## Shared fire wants (runtime, lib/world.js `FireBoard`)

- **`sim.fireWant(id, level)` states this choreo's level for an fx fire in this update (several calls in one update:
  its largest); after every choreo's update the runtime applies, per fire, the largest want of all choreos, or the
  builder's level when none wants it — the fx spec's intensity, which fx's own schedule ('night', 'day', 'service')
  still modulates; a fire a module added itself returns to the level it was added with (0).** — The doors' model
  (max-wins, resolved once per frame), so a fire is a pure function of t across choreos. A choreo skipped by its LOD
  keeps its wants; one that stops being relevant (or fails) drops them. — Each choreo writing `ctx.fx.setFire` itself,
  which needed time-window hand-offs and "write only on change" conventions and left stale levels after jumps (G1's
  determinism bug, G4's kitchen fade, G2's "release").
- **`fx.setFire` is called only when the resolved level differs from what fx holds (its record's target), and the
  runtime snaps fx on every jump and date change (`ctx.fx.snap()`), so the fires are re-posed with the figures in the
  same frame.** — render/ snaps on 'time:jump' only; a date change used to ease the fires for half a second.
- **`sim.fire(id)` stays as an alias: `.set(v)` = `fireWant(id, v)`.** — Documented API; no choreo uses it now.
  `lib/world.js fire()` is removed (no second write path).
- **Migrated:** altar-night (the great pile), terumat-hadeshen (the four piles; its heaped coals), courts-daily and
  private-offerings (the kitchen hearth — max-wins, no more "state it every update and let go once"), private-offerings
  (the notar fire), chambers-daily (the nazirites' hearth — this `always` module wants it 0 unless a set cooks — the two
  stand-in pits, the chavitin bakers' fire), ketoret-morning (the Menorah's seven lamps, the golden altar's coals, the
  pans' coals), night-watch (the sleeping guard's garment). The shabbat modules drive smoke columns only (single
  owner, not fires); the new Shabbat-day staging is altar-night's (below).
- **The night → dawn seam of the great pile is a continuous want, not a hack: altar-night's level sinks in the last
  9 minutes before the muchni to the embers terumat-hadeshen's curves start from (`EMBERS` = 0.55 / 0.45, exported by
  terumat-hadeshen), and terumat-hadeshen's curves start at its window's start (muchni − 0.5) from those levels (the
  incense and kiyum piles from the builder's 0.6 / 0.75).** ⚙ levels. — The old version eased the pile back up to the
  builder's 1.0 just before the muchni (so a release could hand it back), after which terumat-hadeshen dropped it to
  0.55. Also fixed: terumat-hadeshen's curve clock was unwrapped from muchni.t0 although its window starts half a minute
  earlier, so its first half minute read the curves' last key (the lit pile, 1.0).
- **The Menorah's lamps: `serviceSchedule` (switching their fx schedule from 'night' to 'service') is removed** —
  build-heichal now registers them 'service' (the western one 'always'); the lamps are wanted by their fire ids.

## Plan getters

- **A module may export `plan(ctx, state, sim)`; another choreo reads it with `sim.planOf(id)` (also
  `ctx.schedule.runtime.planOf`). The module is initialised first if it was not yet, so the order modules boot in
  does not matter.** — The G4 modules already exported `plan` (g4/book.js); private-offerings exported a private
  `_getPlan`; lotteries and gazit-shema read terumat-hadeshen's and tamid-morning's state directly. — Importing
  module internals.
- **private-offerings, terumat-hadeshen and tamid-morning export `plan`; nikanor-stations, chambers-daily and
  g4/sets.js (`g5PlanOf`) read G5's plan through `sim.planOf('private-offerings')`; lotteries reads terumat-hadeshen's,
  gazit-shema tamid-morning's.** The G5 contracts are unchanged: `inst.s + 0.5` (the bird hand-over at Nikanor),
  `P.counts`, `P.hot` bookings, `P.insts`.

## Hand-overs requested in the groups' logs

- **G4's watchable rows of the sets are `set:<type>:<role>:<n>`; g5/dynamic.js `createSource(ctx, getPlan,
  { prefix })` answers `byId` for its own prefix only (G5's stay `offering:`).** — They could collide with G5's ids.
- **The metzora's asham blood: the vessel kohen's itinerary is one pure function (g4/metzora.js `vesselKohen`), staged
  by nikanor-stations and read by private-offerings before it lays the day's offerings. `vesselAt` measures the
  minutes he is within each of G5's shared places (`P.hot` sw r 1.3, ne r 1.2, sampled every 0.01 min, edges bisected
  to 1e-4); nikanor-stations publishes them (`plan.M.swBlood`, `plan.M.neBlood`) and books its G4 register with them;
  G5 books exactly those intervals (on the days it counts a metzora).** — G5 booked the SW corner from w0 + 19.5 to
  w0 + 25 (≈ 5½ min for a 0.6-min stay) and not the NE corner at all; the G4 register used w0 + 21.4–25.2. On
  2026-11-02: SW 0.61 min, NE 0.31 min. The order of planning (G5 first, then G4) is why the itinerary is shared
  rather than read from nikanor's plan.
- **The inspection's officer, the makers at work, walks out of the chavitin chamber and back through the court — up
  over the duchan, along its east and north sides — to Beit HaMoked by its wicket (the wicket opens for him), waits
  inside it, and goes from there to the Gazit for the second lottery (lotteries.js takes him at the wicket at
  second-lottery − 4.75, out by the wicket and along the court's north side under the Moked's wall).** ⚙ — The holy
  garments are not worn on the Mount; the court's gates are still shut. He used to stand 35 minutes inside the
  chavitin chamber's door. The five who came with him from the chavitin chamber to the second lottery still do.
- **The third lottery's circle (and gazit-shema's mirror of it) is at most 3.9 amot (g1/places.js `lotRadius`:
  ≈0.68 m a man, 2.6–3.9).** — The Gazit's column plinths are 1.28 amot squares round X 69.5 / 76 / 82.5 on Y 375.6 and
  386.4 (courts/chambers.js); at 4.4 four places stood on them; at 3.9 the nearest place clears a plinth's corner by
  0.4 amah (≈0.2 m). The twenty stand ≈0.59 m apart. The stale "≈0.55 m a man" comment is replaced.
- **G3's incense (I1) and pan (P1) men: ketoret-morning is `always` relevant, so its scripts are staged from their first
  leg at the Gazit's doorway (third-fourth-lottery.t1 − 0.46 / − 0.42), exactly where and when lotteries.js ends its
  winners' walks; g3.js now checks it every 0.01 min across the hand-over and after a jump into it.** — No change of
  timing was needed; the check is the fulfilment.
- **The Ish Har HaBayit crosses Beit HaMoked's hall on straight legs round the hearth's west and south between the mats:
  down the gap between the west bay's mat and the hearth, along the band between the hearth and the mats by the kodesh
  line, then down the east lane between the slab kohen's mat and the seats by the east ledges into the kodesh half
  (night-watch circuit, from g1/places.js mokedPlaces: cx − 2.15 / ky + 8.4 → cx − 2.25 / ky + 5 → cx − 1.45 / ky + 2.75
  → cx + 1.45 / ky + 2.5 → cx + 4.65 / ky + 2.2 → cx + 4.65 / ky − 0.6), both ways.** ⚙ — His straight leg from the
  chel door to the kodesh half went through the hearth and between two mats 0.3 m apart. g1-night.js checks every leg
  in the hall against the hearth's keep radius and every mat's and seat's body.

## The libation concert's section lengths (found by g3.js)

- **g3/plan.js `PSALM_DUR` (and g6/musaf.js's Psalm 92 copy, now read from it) comes from the audio's own pure timing,
  `src/audio/timeline.js sectionTiming(...).duration`, read through an eager `import.meta.glob`, with the first audio
  version's table as the fallback.** — audio-2 (in progress in this round) sings every verse of each third: sections
  of 14–71 s against the old 15–26 s (Psalm 48: 40.7 / 39.3 / 59.0 s vs 16.9 / 17.9 / 22.4), so the staged sets,
  prostrations and the Levites' playing fell inside a section still being sung. The glob keeps the sim building if
  audio's new file is not committed with this task. — A hard import (ties this task's commit to audio-2's); a
  regenerated table (goes stale again). Not done: audio-2 can now sing the Shirah and Ha'azinu themselves (with
  per-verse captions); G3/G6 still cue Psalm 92 as their stand-in with its caption off (follow-up).

## Shabbat between the services (data-3's events)

- **shabbat-altar-day (altar-night): now and then one or two of the beit av's young kohanim (the evening crew's faces,
  G1's 'young' pool) come out of Beit HaMoked by its gate (open by day), take forks with the vessels by the ramp's west
  foot, go up the east half and stir the pile from its south and east, then down the west half and back in: a visit
  every 8–20 min, 3½–6½ min at the pile (seeded), the first once the division of the showbread is over (its two groups
  stand east of the altar, across the way round it).** ⚙ (who tended it by day is not recorded). No wood and no new
  limbs: nothing comes up between the services on Shabbat (Temurah 2:1); the limbs of the tamid and the musaf burn in
  their day (Rambam MK 4:3). The fire: the builder's level, with a small flare of the inner pile at each stirring
  (a want only while it flares).
- **showbread-eaten (shabbat-mishmar, g6/bread.js `kgMeal`): the Kohen Gadol (G2/G3's seed — the same man as at the
  tamid) comes out of the Gazit with two of his kohanim by the north of the court before the division's groups form
  and stands east of the altar in a horseshoe open to the north (centre 240, 330.5: clear of the altar's walkway at
  X 236–237.5 and of the duchan at X 242), he at its south facing north. When each group has gathered, before its
  shares, one of the two takes the Kohen Gadol's half off the leader's stack on the horseshoe's open side (0.12 min,
  `receive`) and turns away; the leader keeps the rest for the watch, gives the shares and takes his own last. The two
  bring the halves to him; he takes his loaves from both; after a while the loaves are broken up among them and each
  holds his portion. Through the window other kohanim come out of the Gazit by turns to the open side (visits of 12–35
  min, 2–10 min apart per place, seeded), take a piece from him, eat it standing and go back in; the group goes in
  before the incoming come to the Gazit's door for the afternoon lottery.** ⚙ — Rambam TuM 4:14 and Yoma 17b (half of
  each watch's loaves, never a broken piece); Rambam MK 10:3, 10:7–8 (male kohanim, in the court, by midnight); BhB 7:6
  (standing). **First, not last** (changed in sim-core-2-fix): Mishnah Yoma 1:2 / Yoma 17b "נוטל חלק בראש" (he takes
  a portion first) and Rambam MK 10:18 "אוכל שלא בחלוקה אלא נוטל כל מה שירצה" (not by division: he takes whatever he
  wishes), both checked (local Yoma text; Sefaria). The first version handed him what was left after the watch's
  shares, which contradicts both. Stand-ins: the stacks are `loaves_todah` (G6's, the same prop for the half and for
  the rest); see the eating beat below. — The previous division let each leader's stack vanish at his own share; a
  static group of seven holding stacks for four hours.
- **The eating beat (eatLoop): short whiles of breaking morsels off the piece in the hands — people's `melikah` hands
  (left palm up, the right fingers nipping over it, head bent to them), looped with a seeded `{ cycle: 2.6–4.4 s }`
  phase — between longer whiles at ease, talking (`stand`, idle turning): 0.3–0.8 min and 1.0–3.5 min (≈ 20 % of the
  time eating).** ⚙ (changed in sim-core-2-fix) — The first version held `carry` (both forearms out, open palms, as
  under a tray) with nothing in the hands for 0.8–2.4 min at a time, ≈ 40 % of several hours. No existing prop can
  pass for a piece of bread: `chavitin` carries its griddle (a copper disc in the shots), `solet` a silver vessel,
  `loaves_todah` a reed tray. people has no hand-to-mouth clip, and the sim may not add one. With the hands together at
  the chest, the missing piece reads far less (shabbat-kg-eating.png). Requested from people: a showbread loaf-stack, a
  broken-loaf piece (palm grip), and an `eat` clip (a piece raised to the mouth).
- **Captions:** the Kohen Gadol's half as the first comes off its stack (the north's, ≈ D0 + 2.4: before the shares,
  1.4 min before the Bilgah caption); his meal 0.7 min after showbread-eaten's start (≥ CUE_LEAD, so the UI's
  jump-to-event hears it). The caption says "before the shares … he takes a portion first, not by division".
- **shabbat-mishmar's lead is 3.6 (the Kohen Gadol leaves the Gazit at the division's start − 3.4).**

## Found while verifying

- **G1's legs clear both hands when a man goes from two props back to one or none (g1/util.js applyLeg: the pair is
  cleared through setProps(null, null) first).** — people's setProp never clears the left hand (prop2): the
  inspection's officer walked back through the court with the second torch still in his left hand after laying both
  by the griddle (officer-back-court.png). g1-night.js's determinism snapshot now records the props the actor actually
  draws, so a hand that depends on the jump history shows as a diff. G2, G3 and G4 already set both hands.
- **night-watch checks its greetings in every update while it has a patrol plan, not only while the officer is in his
  window.** — His last greeting (back at his gate) is due DWELL before the window ends; at 600× under load each frame
  is a sim minute (the engine clamps dt to 0.1 s), so the update whose crossing held it often came after the window
  and the greeting was lost (cues.js: 294 of 295 keys, reproduced twice; shalom:14:gate-chuldah-w at 04:42). After:
  295 of 295 under the same load, no doubles, none on jumps.
- **The limb carriers at a table (G4's sets limbsUp, G5's olah): the first to go stand in the back row and come last
  (g5/track.js tableOrder); each goes once he has his limbs and 0.05 min after the one before him.** — The way out
  from the tables is north to the corridor (g5/geo.js route), behind both rows, and the carriers went in the limbs'
  order from the front row, so each front-row man walked through the man standing behind him (g4's sweep: 0.009 m on
  2026-11-02 at 11:15). The limbs keep their order (the head first); only who stands where changes. The second rule
  stops the late-arriving back row from leaving with a front-row man (a first version did: pairs merged for a
  minute). A/B on 2026-11-02, 08:30–12:30, G4 + G5 driven every 0.005 min (forced re-pose), pairs under 0.32 m: at
  the tables, a walker through a man standing 117 events / 62 s → 2 / 1.2 s; walkers crossing there 19 / 10 s →
  27 / 21 s (sub-second corridor crossings); walkers in lockstep over 2 s, anywhere, 25 / 164 s → 23 / 119 s; the
  altar top unchanged (104 / 102 s → 103 / 104 s). — Leaving back row first in the limbs' order (changes which limbs
  go up first); staggering the rows (no room: the next lane's table is 4 amot away).
- **Not fixed here (follow-ups for the offerings' staging):** on the altar top the carriers walk along the pile's
  east face through the men already waiting there to throw (≈100 events of ≈1 s in those four hours, X 229.3,
  Y 319–323); a nazir's companion stands in the corridor north of the tables (X 232–234, Y 381–383) while walkers pass
  through him; Levites file through each other at the duchan's foot as they take their places to sing (G5 g5-levi,
  0.6 s). Each needs the walkers' order or a waiting place changed, and the schedule's hand-overs re-checked.

## Known, not changed

- g1-night: the pop at the 00:00 civil-date wrap on Friday and Shabbat (one man, altar-night ↔ moked-night) is the
  known one from data-3 (each date has its own plan).
- g3 "alive": one half-minute sample (07:31) falls in the 7.5 s between a section's last note and the next set (the
  ring, then GAP_S). It is the pause the sources describe ("they reached a section: they blew"), not idle staging.
- g4 overlaps (its 3-min sweep): one pair left, courts-daily's en-men crossing at 14:15 (0.29 m, walk/stand).

## Verification (2026-10-20, HD 4600, low tier, with other agents' runs on the same machine)

- `npx vite build --outDir .build-sim-core-2`: passes (removed). `node tools/validate-schedule.mjs`: 0 errors, 0
  warnings. `node tools/coverage.mjs`: no gaps (longest 7 min). `node tools/nav-coverage.mjs`: 132 targets; only the 2
  known Heichal-roof failures.
- Sim harness, every test in src/sim/dev/tests, all on the final code (after the last edit of each file they cover),
  no console errors: fires "t=n3", shabbat-midday "t=d4", g1-night "t=n3", g2 (2026-11-02 and 2026-11-07 "t=alot-60"),
  g3 "t=sunrise+40", g4 "t=d3", g5 "t=sunrise+150", g6 (2026-11-07 "t=07:30"), jumps, cues, jumpto, dates, zones
  (--keep-ui), night, patrol, visual, budget, clearing, firstnight, gc, helpers, initcost, navwest.
  - fires: arbitration as specified (largest wins, one owner's largest, back to the builder's level, setFire only on
    change); live board consistent and deterministic on both dates (18 fires), fx snapped after jumps; dawn seam max
    step 0.001; the kitchen hearth wanted by both modules for 232 min, max-wins never wrong.
  - shabbat-midday: deterministic (14 times × 3 orders); every 2 min of showbread-eaten the Kohen Gadol with ≥ 2
    (120/120); one man holds each stack through each hand-over; spacing ≥ 1.34 amot; one Kohen Gadol; captions once
    per pass, none on jumps; someone on the pile 25 % of shabbat-altar-day's minutes (12 visits). (Re-run after the
    review fixes: see below.)
  - g4: deterministic on three dates; cues 56/56, 80/80, 1/1, none on jumps; metzora corners booked exactly by G5
    (SW 09:01:07–09:01:44, 0.61 min; NE 08:59:56–09:00:15, 0.31 min); its rows 'set:…'. g5: deterministic, cues
    57/57, no standing overlaps on three dates.
  - g3: the incense and pan men across the Gazit doorway every 0.01 min, one owner each, no jumps, the same after a
    jump into the hand-over; 13 jump-to-event headlines. g1-night: deterministic on three dates (props as drawn);
    Moked route clears the hearth by 0.37 amot and every body by 0.44. cues: 295/295 greetings, no doubles.
  - Third lottery: r 3.9 amot, nearest plinth 1.24 amot clear (shots2 probe).
- Cost (low): the sim per frame playing the dawn at 60× avg 0.87 ms, p95 1.2 ms (fires.js); the night at 600× avg
  0.95 ms, p95 1.5 ms (cues.js); FireBoard.resolve 0.001–0.002 ms for 22 fires; shabbat-mishmar p95 0.28 ms,
  altar-night p95 0.10 ms; G1's four modules p95 ≤ 0.18 ms each.
- Shots (shots/sim-core-2): shabbat-kg-loaves, shabbat-kg-loaves-near, shabbat-altar-day, moked-ihb-a/-b (the Ish Har
  HaBayit between the hearth and the mats), officer-back-court / officer-back-wicket (no torch left in hand),
  lottery3-circle, dawn-seam-a/-b/-c. Added or re-shot by sim-core-2-fix: shabbat-kg-eating, shabbat-kg-half-first,
  officer-back-wicket, officer-back-wicket-through-nanasin, officer-back-inside.

## Review fixes (sim-core-2-fix, 2026-10-20)

- **Empty hands eating (valid, fixed):** the eating beat is people's `melikah` hands for short whiles, not `carry` with
  nothing in it (see "The eating beat" above). shabbat-kg-eating.png: the near man breaks morsels over his left palm,
  the others at ease. Sampled every 0.1 min from showbread-eaten's start + 20 min to + 120, over all of its
  figures: 1104 `melikah` against 4197 `stand`.
- **The Kohen Gadol's half last (valid, fixed):** it now comes off each stack first, before the shares (see the
  showbread-eaten entry). 2026-11-07: half off the north stack 08:48–08:49, shares N 08:49–08:52, S 08:49–08:53; his
  loaves taken 08:50; caption order divided 08:47, Kohen Gadol's half 08:49, Bilgah 08:50, eaten 08:53 (g6).
  shabbat-midday's stack check now follows the split: leader alone → leader + the Kohen Gadol's man → the man alone
  after the leader's own share, 271 samples a side at 0.02 min, none wrong. shabbat-kg-half-first.png.
- **officer-back-wicket.png "not at the wicket" (rejected as to the place, re-shot for clarity):** the old frame was
  Beit HaMoked's gate: its leaves are gold (`goldLeaf` / `gold_plate`, courts/moked.js — Middot 2:3, all the court's
  gates but Nikanor's turned to gold), the wicket is the open panel low in the east leaf (Middot 1:7), the red curtain
  is the gate's own (`C.curtain('azarah.gate.moked')`), and the hooked pillars are the nanasin, whose row stands at
  Y 383.75, 4–5 amot south of the gate (X 203–231, the gate's opening X 205.75–215.75). The Heichal's doors are 45
  amot west, behind the Ulam. But the officer stood 0.07 min short of the gate behind a pillar, so it proved little.
  Re-shot at the moment he steps through (wicket 0.47–0.65 open, empty-handed): officer-back-wicket.png from between
  the pillars; officer-back-wicket-through-nanasin.png the old framing; officer-back-inside.png in the hall beside the
  wicket. Track (2026-11-02): court 236.5,371 → 213.5,385.4 → gate 213.25,388.6 at 03:52 → wicket → 211.95,394.8.
- **people/human.js 'fade' console error (not sim; already resolved on the tree):** human.js now defines `fade` before
  use, and none of the 24 harness runs below printed a console error or warning.
- Re-verified after the fixes: build passes (removed); validate-schedule 0 errors / 0 warnings; coverage no gaps
  (longest 7 min); nav-coverage 132 targets, only the 2 known Heichal-roof failures. All 24 harness runs ok (every test
  in src/sim/dev/tests, g2 on both dates), no "ok": false anywhere, no console errors. shabbat-midday: determinism
  16 times × 3 orders (now including both hand-overs), 120/120 alive, spacing ≥ 1.34 amot, cues once per pass and none
  on jumps; shabbat-mishmar p95 0.21 ms. Cost on low: dawn at 60× avg 0.73 ms, p95 1.0 ms (fires); night at 600×
  avg 0.83 ms, p95 1.6 ms (cues); FireBoard.resolve 0.001 ms for 22 fires.
- **Open (not from this fix):** fires.js's dawn loop now shows one frame of 38–74 ms at 03:54–03:55 on 2026-11-02, in
  chambers-daily's SetCast.update by wall time (7 runs), only after that test's earlier sections switch dates (none
  when the same loop runs from a fresh boot). It is not the people calls (spawn, spawnProp, phaseFor, setProp/s, Slot
  methods: all ≈ 0 in that frame), and a CPU profile of frames 150–230 shows no sim function behind it. The earlier run
  of the same sim code had a max of 5.7 ms. The Shabbat-only code changed here does not run on 2026-11-02.
