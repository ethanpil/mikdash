# choreo-adopt — decisions

The choreographies switched to the poses, props, roles and movables that people-4 / people-4-fix and world-4 /
world-4-fix delivered. Owner: src/sim/** only. Format: **Choice** — why (source / reasoning) — alternative.
⚙ = reconstruction (the sources fix the order, not the spot, the minute or the hand).

## Shared (lib/actors.js)

- **`Slot.headgear(on)`, `Slot.shaven(mode)`, `Slot.garb(name)`, `Slot.scale(s)` — change-cached like pose/prop, and a
  pool spec may carry `scale`, `shaven`, `garb` applied at spawn.** — Every module that needs a look sets it per update
  from a pure function of t (a window per figure), so a jump re-poses the look with the pose. Additive; `nullActor`
  stubs keep figure-less runs working.
- **Operators at a fixture whose geometry is in metres (CRANK, WINDLASS, WINDLASS_RAISE, KNEAD) and the tenufah pairs
  are at scale 1** (people-4-fix). The pair's poses are authored at one scale; a seeded kohen of 1.04 under an owner
  of 0.97 would miss the hands. — `kohen.setScale(owner.scale)`: possible, but every partner then depends on another
  slot's seed; 1 for both is simpler and deterministic.

## G1 — the night (moked-night, lotteries, night-watch, altar-night; g1/plan, places, stage, util)

- **The first lottery's mitre: the officer goes behind the first man of the count, his crown MITRE_REACH (0.5 m)
  ahead, `lift_mitre` with the grasp at people's `mitreGrasp` (0.33); the man's headgear off from the grasp until it is
  put back after the winner is named (lift_mitre played back), before anyone goes to serve.** — Yoma 25a ("the
  officer takes the mitre from the head of one of them, and they know that the count begins with him"). That it is put
  back before the service: no kohen serves bareheaded (Zevachim 17b) ⚙ the moment. `lot1Times` exports the minutes.
- **Gevini's call (`call`, two cycles, hands cupped) and the officer's knock (`knock`, three raps a pause) on the
  flight's top tread, the door KNOCK_REACH (0.47 m) ahead.** — Tamid 1:2 ("the officer comes and knocks"); Gevini's
  call is Shekalim 5:1 / Tamid 3:8 (heard in Jericho).
- **The keys: the slab lifted by its ring (world's `azarah.moked.keys-slab` lift(f), SLAB_UP 0.75 = 60°), the keys off
  the chain (`setKeys(false)`), the slab ~~down while he locks~~ open until the keys are back (choreo-adopt-fix); at the gates `lock` with the leaves' face LOCK_REACH
  (0.5 m) ahead, from within; the wicket key alone (`setKeys(7)`) for the officer, hung back after.** — Middot 1:8–9,
  Tamid 1:3. ⚙ which key is the wicket's (the last of the eight), and its return (the Mishnah says only that he took it).
- **The immersions in people's `kohen_bathing` (the linen sheet), the change at a kneel unseen; dried and warmed at
  the fire (`warm`); the keri kohen the same.** — Tamid 1:1 ("he went down, immersed, came up, dried himself and warmed
  himself before the fire"); Yoma 3:3 (a sheet of linen between him and the people). ⚙ the sheet as the visible cover.
- **The elders of the beit av as `kohen_elder` (asleep on the ledge in their own clothes on their folded garments) and
  `kohen_elder_offduty` awake, out with the folded garments.** — Tamid 1:1 ("the elders slept there, the keys in their
  hands"); their garments as pillows is Tamid 1:1's "they folded them and put them under their heads" ⚙ for elders.
- **The impure kohen sits on the floor (`sit_floor`), back on his heels, now and then up on his knees.** — Tamid 1:1
  ("he went out and sat beside his brothers") ⚙ the posture.
- **The losers of the lottery in people's `kohen_breeches` at the niches before going out.** — Tamid 5:3 ("they left on
  them only the breeches"). ⚙ the bend at which the change happens, where they dress.
- **The Ish Har HaBayit with his staff (`staff` at posts, `staff_walk` stride-matched between) and, at a sleeping guard,
  three blows (`strike`) with the staff's tip (people's STAFF.strike.tip) on the sleeper's hip.** — Middot 1:2 ("he
  struck him with his staff"). ⚙ the number of blows and where they land.
- **The night's limbs show charred after 25 min on the fire (people's `limb*_charred`, same spot and heading).** —
  Tamid 2:1 ("limbs and fats not consumed since evening"). ⚙ CHARS.

## G2 — the dawn (terumat-hadeshen, g2/tamid, g2/places, g2/lib)

- **The muchni: the wheel's angle is the kiyor's raise(f) — `(1 − f)·drop / 0.36` (world/altar/kiyor.js) — and the
  operator's phase is people's `windlass.phaseAt(angle)` / `windlassRaise.phaseAt(angle)` at the same quantised t.**
  Lowered from the south of the axle; raised from the north, where he must duck under the 1.25 m axle from the frame's
  open south side (choreo-adopt-fix: in pour_low's stoop, not 'bow', whose head stays at the axle's height). — Yoma 3:10 / 37a (Ben Katin's muchni for the kiyor); Tamid 3:8 (its sound heard in Jericho).
  ⚙ which rim is pulled for which direction.
- **Hands and feet sanctified under a spigot of the kiyor (`kiddush`), one man per spigot (twelve, Yoma 37a).** —
  Zevachim 19b (right hand on right foot, left on left). ~~Its nozzle just before his toes~~: facing the laver that put
  his head in the bowl and the spigot at his neck; choreo-adopt-fix turns him 50° off the radial.
- **The great pile is cleared and built again load by load (world's `altar.maarachah.great.pile` build(f)); the
  tapuach settles overnight to 0.94 and is raked up to 1 (`altar.tapuach` grow(f)).** — Tamid 2:2–4. ⚙ the settling.
- **The wood carried as `gizrin_branch` (fig, walnut, oil-wood); the two gizrin of Moshe's measure as boards under each
  pile; the incense pile's fig wood as `branch_bundle`.** — Tamid 2:3–5; Zevachim 62b; Yoma 2:5.
- **The tamid lamb slain carried in `carry_lamb` with `lamb_slain`; the innards rinsed at the table (`rinse`, the edge
  0.25 m ahead) with `entrails`.** — Tamid 4:2.

## G3 — the sanctuary (g3/song, morning, afternoon, places; ketoret-morning)

- **The wine poured bent over the cups (`pour_low`), the jug's tilt reaching the pour as the cymbal sounds; the segan
  waves the sudarin (`wave_sudar`: one swung from over his right shoulder, the other hanging from his left hand).** —
  Tamid 7:3 ("he bent to pour… the segan waved the sudarin and Ben Arza struck the cymbal"). ⚙ the swing.
- **The Menorah dressed with `tend_lamp`, the kuz in the left hand, no flame in the morning (the lamps are out by
  then); in the afternoon lit from a `taper` lit at the western lamp.** — Tamid 3:9, 6:1. ⚙ the taper as the tool.
- **The kaf carried covered (`kaf_covered`, by its handle) and its cover put back (Tamid 7:2).** — Tamid 5:4.
- **The coals emptied from the silver pan into the gold one bent over the ledge (`pour_low`); on Shabbat the
  `psachter` turned over the spilled coals (→ `psachter_inverted`), kept below the ledge.** — Tamid 5:5. ⚙ where the
  psachter is kept.

## G4 — the courts and chambers (chambers-daily, courts-daily, nikanor-stations, sanhedrin, g4/sets)

- **The Golah wheel worked in `crank` at people's CRANK station, its phase from the wheel's angle every frame.** —
  Eruvin 104a / Middot 5:4 (the Golah chamber's wheel). ⚙ the stance.
- **The chavitin kneaded at the chamber's table (`knead`, the dough KNEAD.reach before him) and the isaron `measure`d
  and halved. The showbread is NOT kneaded with `knead`: Beit Garmu's kneaders still kneel with a bowl (no dough, no
  surface) in the Moked's chol half — `knead` needs a surface 0.78 m high there, and the only one is world-4's table in
  the kodesh half.** — Menachot 4:5, 5:1–2; Menachot 11:2 ("their kneading and shaping outside, their baking inside"),
  Rambam TuM 5:7. Request below (choreo-adopt-fix).
- **The builder's 'service' fires lit by `sim.fireWant` only while their work goes on: the chavitin hearth and lamp,
  the Golah, Parvah and showbread lamps, the nazirite pits 0 and 2 while their pots cook.** ⚙ the lamps' hours.
- **The nazir: C2 sets down `sal_matzot` and shaves him with the `razor`; the same figure shaven (`shaven('head')`)
  from then on; the meat taken home in a `clay_pot`; his chatat a `ewe`.** — Bamidbar 6:14–18; Nazir 6:7–8;
  Menachot 7:2. ⚙ who shaves.
- **The nazir's companion waits in the Ezrat Yisrael (X 251.6/253.2, Y 375–378.6) and comes in timed to the meat;
  he takes it a step south of the flayer's place.** (The party's earlier waits by the rings still stood in G5's
  corridors — choreo-adopt-fix re-lays the set at ring 16.) — He had stood 25–37 min at the hook; on the west hook that was on
  the T_W–N_W corridor (dozens of walkers through him a day). Kelim 1:8: an Israelite enters the Ezrat Kohanim only for
  his need. Probe on 2026-11-02/04/09/11: no track and no figure of any choreo within 0.85 amah during his waits.
- **The healed metzora shaven all (`shaven('all')` on an Israelite), not people's declared `metzora` role.** — On his
  eighth day he is clean and no longer bound by Vayikra 13:45; he shaved head, beard and brows on the seventh
  (Vayikra 14:9). The declared metzora is outside Jerusalem (Kelim 1:7), so the role has no place on the Mount.
- **The mourner and the menudeh (Middot 2:2) as people's `mourner` / `menudeh` roles; the broken earthenware pot
  (`clay_pot_broken` until swept, the 'pot-break' sound); coins into the shofarot (Shekalim 6:5) on weekdays and
  Fridays only (no money on Shabbat).** ⚙ who gives to which chest.
- **The judges seated on the Gazit's risers of one amah, feet on the tier below; the Nasi on his footstool.** —
  world-4 benches. ⚙ the seating order beyond Sanhedrin 4:3.

## G5 — the individuals' offerings (g5/plan, geo, track; private-offerings)

- **Each kind its own carcass stages (`CARCASS` in g5/track.js): slain in `carry_lamb` (lamb, ewe, goat, she-goat; a
  ram is too heavy, borne bound as before), hung, flaying, dressed, its hide and its fats (`eimurim_goat`: no alyah,
  Vayikra 3:9, 3:14–15).** — people-4. A flayed ewe or she-goat is drawn as the lamb's or the goat's.
- **An individual's chatat is a ewe or a she-goat (Vayikra 4:28, 4:32).**
- **Tenufah: the owner in `wave`, the kohen facing him in `wave_under`, one phase from the waving's start, both at
  scale 1, WAVE_UNDER.partner (0.74 m) apart; the bikkurim basket held by the rims, the kohen's hands beneath.** —
  Menachot 5:6, 61b; Bikkurim 3:6.
- **Psalm 30 for the bikkurim: three sections of the audio's song 'bikkurim' as the basket reaches the court.** —
  Bikkurim 3:4.
- **The altar top: carriers come round the pile by the south-east (TP_SE, the first of a group farthest north) and
  leave by the north-east (TP_NE, the farthest first), so none walks along the east face through the men waiting
  there to throw.** (Not yet within one offering: a ram's two flour and two wine bearers still passed through each
  other — choreo-adopt-fix.) — sim-core-2's open item (≈100 one-second pass-throughs in four hours). Same change in g4/sets.js.

## G6 — Shabbat (g6/bread, shabbat-showbread)

- **The stacks carried as `showbread_stack` (six loaves, no kanim) and the Kohen Gadol's `showbread_half`; shares
  eaten from the hand (`eat`, `bread_piece`).** — Menachot 11:4–7; Yoma 17b; Rambam MK 10:3.
- **The Shulchan's bread is world's movable: the old set slid off to the south as the new comes on from the north
  ("the handbreadth of this one beside the handbreadth of that", Menachot 11:7), the old hidden once in the stack-men's
  hands; the bowls (':bazichin', ':levonah' meshes) hidden while in the bowl-men's hands; the sets swapped back when
  settled (identical).** ⚙ the slide's timing.
- **shabbat-showbread is `always`: the kanim out from Friday after the afternoon service until after Shabbat.** —
  Menachot 11:6. ⚙ the hours.

## Fixes found on the way

- **A circular import (altar-night ↔ terumat-hadeshen): terumat-hadeshen called altar-night's `charred()` at module
  top level, which throws "Cannot access 'charred' before initialization" when altar-night loads first, and both
  choreos then fail to load.** The order depends on the schedule's mapping; it showed in a probe run. The limb's name
  is spelled out (`limb_gerah_charred`) and the import removed.

## The dawn spike (2026-11-02, 03:54–03:55)

- **The open item from sim-core-2 (one frame of 38–74 ms in chambers-daily's SetCast.update, only after the fires
  test's earlier sections switch dates, no sim function in the CPU profile) does not recur: fires.js on a quiet machine
  max 4.8 / 1.9 ms over ≈1150 frames; an instrumented copy (raw per-module update times, SetCast.update wrapped, JS heap
  per frame) logged no frame over 12 ms in two runs.** The profile's signature (wall time with no sim function, only
  after whole plans were dropped by date switches) is that of a GC pause landing in whichever module was running; this
  change set altered chambers-daily's allocation pattern, so it may simply have moved. Nothing was changed for it.
  One fires run made while another headless browser was compiling shaders showed a single 385 ms frame; it did not
  reproduce alone (contention, not the sim). Not root-caused: the review's three fires runs (max 2.0 / 2.1 / 4.0 ms)
  and choreo-adopt-fix's (2.0 ms) did not reproduce it, and the heap-profiled run shows the same isolated single-frame
  maxima on HEAD's sim (23.3 / 29.2 ms) as on this code (21.3 / 38.3 ms) — not a regression.

## API additions (all additive)

- lib/actors.js: `Slot.headgear(on)`, `Slot.shaven(mode)`, `Slot.garb(name)`, `Slot.scale(s)`; pool spec
  `scale`, `shaven`, `garb`.
- g1/util.js: `cycles(n)`, `shifted(fn, shift)`, `Track.mark(t0, t1, key = 'bare')`; a leg's `bare` window sets the
  headgear off.
- g1/plan.js: `MITRE_GRASP`, `MITRE_REACH`, `lot1Times(F)`.
- altar-night.js: `charred(name)`.
- g2/lib.js: a phase spec may be a function of the clock t (minutes).
- g5/track.js: `CARCASS`, `carcassOf(species)`, `WAVE_P`; g5/plan.js: `ANIMALS`, pools `ewe`, `she_goat`.
- g6/bread.js plan times `bowlsOff`, `bowlsSet`, `swapBack`; shabbat-showbread `always: true`.

## Requests

- **world:** `bowls(bool)` on `heichal.shulchan.bread` / `.incoming` (the sim toggles the ':bazichin' / ':levonah'
  meshes by name).
- **world:** the showbread's kneading table is in Beit HaMoked's kodesh half; Menachot 11:2 puts the kneading outside
  (chol). The sim kneads in the chol half; move the table or confirm.
- **world:** the muchni frame is open only to the south, so the raising station (north of the axle) is reached by
  ducking under the 1.25 m axle; an opening on the north, or confirm.
- **world/nav:** the kiyor's bronze platform is not in the static colliders (the kiddush spots read as off-nav).

## Verification (2026-10-21, HD 4600, low tier unless noted)

- `npx vite build --outDir .build-choreo-adopt --emptyOutDir`: passes (removed). `tools/validate-schedule.mjs`: 0
  errors, 0 warnings. `tools/coverage.mjs`: no gaps (longest 7 min). `tools/nav-coverage.mjs --q low`: 132 targets,
  only the 2 known Heichal-roof failures. `g1/dev/plan-check.mjs all`: no issues on the three day types.
- All harness runs (every test in src/sim/dev/tests, g2 on a weekday and a Shabbat, fires four times): no
  `"ok": false`, no console errors. Adopt sections: g1-night 21/21, g2 12/12, g3 7/7, g4 13/13, g5 8/8, g6 8/8;
  shabbat-midday ok. Determinism holds in every module test. Cost (avg / p95 ms): g2 0.15 / 0.24, g3 0.18 / 0.30,
  g4 Mount 0.43 / 0.7, g5 0.29 / 0.5, g6 0.14 / 0.30, fires (dawn at 60×) 0.81 / 1.2.
- Altar top (g5 plan, 2026-11-02 / 11-06 / 06-15): no carrier walks within 0.85 amah of a man standing on the pile's
  east face (0 events; sim-core-2 counted ≈100 in four hours). Wrong as stated: the check skipped pairs of the same
  offering, and the review's figure probe found 9 per date (a ram's libation bearers); fixed in choreo-adopt-fix.
- The nazir's companion (2026-11-02 / 04 / 09 / 11): during his waits no G5 or set track and no figure of any choreo
  within 0.85 amah.
- Unchanged known items: g3 "alive" 07:31 (the pause between sections); g4's one close pair (courts-daily en-men,
  14:15); g5's three corridor suspects (AW_S–AW_SS, KW_2–S_2, K_SW–S_2) as before.
- Shots: shots/choreo-adopt/low and /high, 40 scenes each (tools/shot.mjs --batch). The two high batches each logged
  one "timed out waiting for __mikdashReady" on their first page (shader compile on a loaded machine); those PNGs
  rendered correctly. The wide night shot of the great pile does not show the charred limbs through the flames (the
  g1-night test asserts them on the pile).
