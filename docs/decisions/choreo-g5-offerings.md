# choreo-g5-offerings — decisions

Choreo `private-offerings` (src/sim/choreo/private-offerings.js, helpers in src/sim/choreo/g5/): the continuous stream of
individuals' offerings between the two temidim — events private-offerings, kayitz-hamizbeach, private-flaying,
altar-blood, altar-limbs, bird-offerings, meal-offerings, tenufah, notar-burning, and bikkurim-late (reference-only;
staged when offeringWindows opens the bikkurim lane by the Hebrew date). Plus the additive dynamic-source API in
src/sim/schedule.js and the grouped "offerings in progress" rows in src/ui (timepanel.js, map/card.js, data.js).

Format: **Choice** — why — alternative. ⚙ = reconstruction (minutes, spots, traffic).

## The generator

- **One plan per date, built in `init` for the boot date and again when the date changes (≈100–140 ms on the HD 4600),
  then only evaluated per frame.** It reads `offeringWindows(dayType, zmanim, { prevDayType, hebrew })` for the window
  and the bikkurim lane, the schedule's events for the stage windows (blood by 8.35, fats and flaying by 8.4 seasonal
  hours), and `OFFERING_TYPES[type].steps` for each step's minutes, stations, actors and props. — Rebuilding per
  frame, or simulating forward (would break jumps).
- **The day's mix: ONE seeded day quantile q for every count** (`frequency.alone[type]` for the types brought alone,
  `frequency.lo/hi` for the sets yoledet, zav-zavah, nazir, metzora), stochastic rounding with a per-type seed. Never
  perDay plus sets (CLAUDE.md). On the default date q = 0.96 (a busy weekday): 160 offerings — 57 animals, 70 bird
  instances (pairs and singles), 28 meal-offerings, 4 bikkurim baskets, notar. — Independent draws per type.
- **Lanes** ⚙: six animal lanes, each a ring + the nearest hook + the marble table in front of it (Middot 3:5;
  Shekalim 6:4; offerings.js lanes.slaughter typical 2–6), checkerboarded on rows 1–3 so neighbouring groups have
  room; the two tamid rings (row 0, columns 1–2) are never used. Lesser offerings prefer the eastern columns
  (offerings-data: "the model uses the eastern rows"). Three bird kohanim and three meal-offering kohanim. An offering
  is slid later until its lane's ring, hold spot, hook and table are free and every figure it needs fits in the pools;
  it is dropped (and counted in `debug`) only when it cannot finish in the window — 9 of 169 on the busiest day.
- **Arrivals are stratified over the window** (seeded jitter in equal slices) so the court is never empty and never
  jammed; measured 2–15 offerings in progress at any minute (mean ≈ 10). — Poisson arrivals (long gaps).
- **Kayitz hamizbeach: olot placed only into lane gaps inside its event's hours, at most two at once** (Shekalim 4:4;
  report §33.6 "when the altar would otherwise stand idle"). No owner, so no leaning (Rambam MK 3:7); the lamb is led
  from Beit HaMoked (the lambs' chamber, Tamid 3:3) by a kohen, who slaughters it.
- **Bulls are not staged** — the hung-carcass props are lamb-based and site.js says a bull hung from the top row
  would not clear the pavement (how it was handled is unsourced). Species weights ⚙ (revised in
  choreo-g5-offerings-fix.md): olah lamb .8 / ram .2; chatat a ewe lamb; asham brought alone a ram; shelamim, todah,
  bechor, ma'aser lamb/kid (ram for shelamim/todah). Goats hang already flayed until goat props exist.
- **Sets staged elsewhere:** the metzora (Nikanor module) and the nazir (chambers module: his chamber and the waving);
  their counts are drawn so the remainders stay exact, but their animals at the altar are not staged here (request
  below). The yoledet's and zav's birds ARE staged here: the Nikanor module reads this plan
  (`state.plan.insts`, `inst.job.set`, `inst.s + 0.5` = the moment the kohen takes the birds at the gate) and stages the
  mother or zav handing them over and standing in the gateway — a contract kept stable.
- **The metzora's ring (229, 355.5) and hook (by pillar 6) are left to the Nikanor module in its window**: the two
  lanes beside them get no work then (never two scenes in one place).

## Staging the steps (sources in offerings.js; places ⚙ where marked)

- **Arrive:** the owner leads his animal on its rope (`lead_walk` / `walk_led` + `setLead`) up the Korban gate's flight
  (Middot 1:5, name only — Report §7.3), the firstling by the Bechorot gate (Middot 1:4), and waits by his ring.
  Owners appear at the foot of the flight on the chel, out of sight of the court. The firstling's bringer is a kohen
  "in his own clothes until he serves" (offerings.js) — drawn as a man in ordinary clothes. The libations' seal
  (Shekalim 5:4) is bought before he comes in (said in the description; not walked).
- **Semichah:** the animal at the ring facing west, the owner east of its head facing west-south-west, both hands on
  its head (Rambam MK 3:13–14 "the animal in the north facing west, the leaner in the east facing west, both hands
  between the horns"); the confession or the words of praise as a caption when the observer is within ≈ 26 m (MK 3:15
  — the Rambam's wording). No leaning on a firstling, a tithe, a woman's offering or a kayitz olah (Menachot 9:7–8).
- **Shechitah:** the animal laid down and held as an akedah, head south and face west at its ring, the slaughterer
  east of it, a kohen holding the legs and a kohen kneeling with the silver mizrak (Tamid 4:1; the people task's
  tableau offsets). The owner slaughters (valid by anyone — Zevachim 3:1); a bleat at the binding.
- **Blood by rite:** two that are four — thrown at the NE corner, then the SW, below the line, the rest poured on the
  southern yesod at the SW (Zevachim 5:4–7; Tamid 4:1; Rambam MK 5:6). Chatat — up the kevesh on its east half, onto
  the sovev by the small ramp, SE → NE → NW → SW with the finger (`sprinkle`, vessel in the left hand), back round the
  sovev to the small ramp (the kevesh's flying span closes the south side), across to the west half, down the small
  ramp to the yesod and the remainder poured on the southern yesod (Zevachim 5:3; 62b). ⚙ the way back round the
  sovev. Firstling and tithe — one pouring against the yesod at the NE (Rambam MK 5:17).
- **Flaying:** after the blood (Rambam MK 5:18) the slain animal is carried in the holder's arms to its hook ⚙ (the
  live animal actor in its bound pose, carried — no unflayed-carcass prop exists; request), hung by the hind leg at
  the lowest row (Tamid 4:2; a ram the middle row): `lamb_hung` → `carcass_flaying` → `carcass_hung`.
- **Rinsing:** the intestines at the marble table, the stomach carried to Lishkat HaMedichin and back (Tamid 4:2;
  Middot 5:3). **Hide** of a most-holy offering on the shoulder to the Parvah (Middot 5:3; Zevachim 12:3).
- **Tenufah (shelamim, todah):** east of the altar (Rambam MK 9:6), the owner facing the altar with the breast and
  thigh (todah: a loaf) on his palms, the kohen opposite with his hands beneath (Menachot 61b) ⚙ facing each other.
- **Haalaah:** an olah's limbs by six (a ram's meat by five and its innards by two — Yoma 2:7; Rambam MK 6:17), in the
  Tamid 4:3 hand-placements (`ctx.people.tamid.carriers`), to the lower west half of the ramp where a kohen salts them
  (Rambam MK 6:4), then up the east half, along the great pile's east face, thrown together, round to the right and
  down the west (Zevachim 6:3). Other offerings: the eimurim by one kohen in a vessel, salted on the lower west half
  of the ramp first (choreo-g5-offerings-fix.md).
- **Nesachim:** flour and oil up the east and onto the fire; the wine man up the WEST half straight to the cups at the
  SW horn and back the same way "on his heel" (Zevachim 6:3), pouring there (Zevachim 6:2). Not for chatat/asham or
  firstling/tithe (Menachot 9:6). Caption with the wine's measure (Report §65.1).
- **Achilah:** the most-holy meat carried to the cooking place in the court (Zevachim 5:3, 11:4) — the eating itself is
  courts-daily's kodashim-meal; a lesser offering's meat handed to its owner, who carries it out on his shoulder
  through Nikanor and Ezrat Nashim (Zevachim 5:6–8; Kelim 1:8), the firstling's by its kohen out by the Bechorot gate.
- **Birds:** the kohen takes the cage at Sha'ar Nikanor (where the Nikanor module's mother or zav hands it over —
  Sotah 1:5, or a man bringing his own gift — Kinnim 1:1); birds bought from the chests (Shekalim 6:5) he brings
  himself (choreo-g5-offerings-fix.md); the chatat bird nipped at the SW corner below the line, its blood sprinkled and squeezed on the yesod
  (Zevachim 6:4), always first, even before a lamb olah (Zevachim 90a); the olah bird on the sovev at the SE horn,
  head salted and thrown onto the fire from there, crop and feathers flung to the ash place (Zevachim 6:5, 64a). The
  cage is set down beside him while he nips (a free prop per bird lane). The chatat bird is left at the kohanim's
  meal on the way out (Zevachim 6:4).
- **Meal-offerings:** the owner comes up from the Mount through Ezrat Nashim and Nikanor onto the lowest step of the
  duchan and hands the flour to a kohen across it ⚙ (he has no need to enter the Ezrat Kohanim — Kelim 1:8); fried or
  baked offerings are kneaded and fried at the court's hearth (Rambam MK 12:23), which this module lights
  ('altar.kitchen.fire') only while one fries; hagashah at the point of the SW horn (Zevachim 6:2); the handful taken
  standing (Menachot 1:2) beside the silver table ⚙; salt from Lishkat HaMelach; the handful burned; the remainder to
  the kohanim's meal.
- **Notar:** two kohanim at the ash place east of the ramp ('altar.beit-hadeshen.fire' lit by this module, faded out
  over 6 min after its window), one bringing yesterday's left-over meat from the cooking place in loads, one stoking
  (Rambam MK 7:3; Pesulei HaMukdashin 19:4 — by day only; offeringWindows gives no notar window on Shabbat).
- **Bikkurim (in season):** carried on the shoulder from the Mount (Bikkurim 3:4); six Levites up from their chambers
  under Ezrat Yisrael (Middot 2:6) onto the duchan, singing as it reaches the court — a lyre cue and the caption
  "Aromimcha" (Psalm 30 is not in the audio's psalms — request); waved with the kohen's hand beneath; set down south of
  the SW horn, he bows and goes; the kohen takes the basket (Bikkurim 3:6, 3:8). ⚙ Six Levites (2:4 requires song; how
  many sang for a lone bringer is not stated).

## Figures, walking, realism

- **Pools sized to the busiest day** (44 kohanim, 16 owners, 6 Levites, 10 lambs, 6 rams, 6 goats, 3 + 3 spare) and
  assigned by interval colouring at plan time, so a figure never changes identity mid-act; max concurrent kohanim on
  the busiest day 31. Kohanim come and go through Beit HaMoked's gate into the court (their house, Middot 1:6–8);
  owners through the gates' flights and the chel steps; nobody appears or vanishes in view.
- **Walks follow an authored corridor graph (≈75 nodes, Dijkstra), not nav**, so every timeline is fixed at plan time
  and independent of nav's arrival and tier; the kevesh is one-way (up east, down west), the sovev and the small ramps
  have their own nodes. The test checks every corridor against nav: three legs differ, all explained (a 1-amah open
  water channel at X≈199 a walker steps over; the 1-amah tread along the Ulam steps nav does not take).
- **Heading turns at 240°/s real time** (snapped after jumps), walk phases stride-matched (`util.phaseFor`), loop poses
  animated by people; one-shot gestures (throw, pour, toss, bow) phased from the clock.

## Watchable instances (schedule + UI)

- **`ctx.schedule.addSource(src)`**: `active()` and `at()` include the sources' events unless `opts.dynamic === false`;
  `upcoming()` includes them only with `opts.dynamic === true` (so the audio pre-fetch and the "Next" list keep the
  day's events); `byId()` finds them; `dynamic(t)` lists them; dynamic events sort after the day's events of equal
  importance. `events` (the dial, nav targets, choreo mapping) is unchanged. — Mixing them into `events` (would flood
  the dial and the runtime's mapping).
- **One persistent event object per offering**, refreshed when asked: id `offering:<type>:<lane>:<n>`, parent = the
  schedule event of its CURRENT stage (private-offerings → altar-blood → private-flaying → tenufah → altar-limbs …),
  summary = the current step, description = what it is + all its steps with the current one marked, zone = where its
  focus figure is now (zones.atSite), view = a walkable spot per kind of place. — A fixed parent per offering (the
  rows would not say which stage they are at).
- **UI:** Happening now groups an event's offerings under it in one expandable entry (type, current step, lane and
  place, until when, Go at the remembered speed); the map card adds one "Individuals' offerings here" entry with
  Watch; the map's per-place activity counts include them through `data.active()`. The info panel keeps the day's
  events only (`data.at` default `dynamic: false`). Styling is inline (existing `.mk-mev` classes) — styles.css is not
  this task's.
