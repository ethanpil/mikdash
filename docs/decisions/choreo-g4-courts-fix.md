# choreo-g4-courts-fix — decisions

Review fixes for group G4 (`courts-daily`, `nikanor-stations`, `sanhedrin`, `chambers-daily`, `beit-avtinas`; helpers
in src/sim/choreo/g4/, test src/sim/dev/tests/g4.js). The base design is in choreo-g4-courts.md; this log records what
the review changed. Format: **Choice** — why — alternative. ⚙ = reconstruction.

## One register for the day (g4/book.js)

- **The four G4 modules that put people on the Mount and at the rings book one register per date and generation
  (`G4Book`): the prostration places, the circuit's walking lanes, the gate passages, and the rings, hooks, tables,
  Nikanor's gateway and the altar places their sets use.** Each module drops its own bookings and re-books when it
  plans. — Each module planning blind to the others (the review's heaps of prostrating figures from four troupes).
- **Determinism: the modules always plan in one order — courts-daily, sanhedrin, nikanor-stations, chambers-daily —
  whatever order the runtime updates them in.** A module's plan first asks those ahead of it to plan
  (`planBefore`; each module exports `plan`). nikanor-stations comes before chambers-daily because the metzora's rites
  are fixed to their window while a nazir's set can wait. private-offerings' plan for the date is built on demand
  through its own exported `_getPlan`, so nothing plans provisionally any more. — A cross-module order that depends on
  which module the runtime happens to update first.

## The Mount: prostrations and walking (g4/mount.js)

- **Every station has a row of eleven prostration places 1.2 m apart along the circuit, standing 1.2 m left of the
  line (toward the soreg); a walker steps out of his lane to the free place nearest the station's middle, lies full
  length (what he carries set down beside him), and steps back a little further on.** The arms of a full-length
  prostration reach about ±0.5 m (people clips.js keyFlat), so 1.2 m apart never touch. The row is moved along where
  something stands in its way: no. 13 south of the Gazit's flight, no. 1 short of Sha'ar HaDelek's spur, no. 8 west
  of Beit HaEven ⚙. When every place is taken (rare) he waits beside the one that frees first. A party takes places
  one behind another; when the one ahead took the row's last place, the next takes any free place (without this
  fallback the plan threw on a weekday). — Prostrating in the lane where he walked (bodies 0.4 m apart head to feet).
- **The stream walks in three lanes right of the line, one per pace (1.1, 1.25, 1.4 m/s; 0.75 / 1.45 / 2.15 m out, on
  the narrow west side 0.5 / 0.95 / 1.4 m — the west stoa's front is at X ≈ 21).** Everyone in a lane walks at its
  pace, so nobody overtakes inside it. A party with women walks at the slow pace; men alone at a seeded one. A party
  walks in file, a pace apart. — Free speeds and offsets (the faster walked through the slower).
- **A lane stretch is booked as a line in (time, distance); a walker about to step into a lane where someone is passing
  within 1.15 m waits a moment where he stands — at the junction, at his prostration place — never in the lane.** The
  same for the gate passages (per gate and pace). An animal led on a rope books its own line behind its walker. —
  Shifting whole itineraries (the sweep's merged walkers came from walkers sharing one path).
- **The mourner walks on the circuit's line itself, against the stream, between the lanes and the prostration places;
  the greeter steps out of his lane to face him a pace short.** — The inner side of the way (it is now the places).
- **Itineraries are built per walker at their clock time** (the register needs it); `fitAt` builds a walker whose
  moment is fixed (a judge's seat, a mother's hand-over, a greeting) so that moment still falls on time.
- The overlap sweep (node, every 0.25 min through a weekday; the test samples every 3 min in the app) finds no
  standing overlaps; what remains are single-sample passes where one walker crosses a lane another is walking in.

## The nazir's and the metzora's animals (g4/sets.js)

- **G4 stages these animals itself, with G5's staging of an animal offering.** private-offerings counts the sets but
  leaves them to G4 (g5/plan.js: "staged by the chambers / Nikanor modules"); its offering builder is internal to
  it, so sets.js ports its steps (semichah, shechitah with the blood in a mizrak, the blood by its rite, the hook and
  the flaying, the rinsing, the hide to the Parvah, the limbs or eimurim salted and burned, the chatat's meat to the
  kohanim, the libations) on G5's own court geometry and walking graph (`buildGeo`, imported) and timelines (`Track`).
  — Asking G5 to add set jobs (requested: if it does, G4 keeps only the chamber and gate scenes).
- **Places: the rings of the fifth row (16, 18) and, for the metzora, ring 11; the hooks and tables of the end pillars
  0 and 7, which G5's lanes never use; a third row of rinsing places in Lishkat HaMedichin; two places in the Parvah
  for these hides.** Each altar activity (the blood, the limbs, the eimurim, the libations) waits for its own free
  moment: G5's bookings of the corners, the pile, the cups, the salting place and the drop place, the register, and
  G5's own limbs-salting and libation steps (which it does not book). — Sliding a whole 45-minute set until every
  place fits at once (it never did on a busy day).
- **The nazir (Rambam Nezirut 8:1–4; MK 9:9): in by Sha'ar HaKorban with his party, he leading the ram, a companion
  the two lambs, another the basket of twenty loaves; he leans on each and slaughters it, the chatat first, then the
  olah, then the ram; then he goes down to his chamber and is shaved; the ram's eimurim, breast and thigh are set
  aside on the table and the rest of it is carried down on a companion's shoulder and cooked; with some of the broth
  his hair goes under the pot (Nazir 6:8); a kohen comes down for the cooked foreleg and a loaf and a wafer, the
  nazir follows him up, and east of the altar it is all on his palms, the kohen's hands beneath, and waved; another
  kohen burns the eimurim; home with the meat and the loaves.** The party walks over the Mount like everyone (the
  animals on their ropes keep their place behind their leaders, `Follower`). — Meat arriving from the city in a basket.
- **The metzora: after the oil, his chatat and olah (lambs) are brought by his agent to the gate, and he leans on each
  from the gateway (as on the asham — he may not yet enter; Rambam Mechusrei Kapparah 4:2 says only "then he offers
  his chatat and his olah" ⚙ for the leaning); a kohen takes each to its ring; the chatat's blood comes first
  (Zevachim 10:2); the libations of all three (Negaim 14:7: the three tenths); once their blood is applied he goes
  in.** The agent is an Israelite: kohanim in the garments do not come in from the city. The poor man's birds are not
  staged (the lambs only) ⚙.
- **The counts are private-offerings' (`P.counts.nazir`, `P.counts.metzora`: its one seeded day quantile); with 0 the
  scenes stay idle.** Without G5, the module's own draw. — G4's own quantile, at least one nazir, a metzora daily.
- **Each set is a watchable row under its event** (the nazirites', the metzora's; the chatat's meat under the kohanim's
  meal), through G5's own row source (`g5/dynamic.js` createSource), with its current step and a view.

## The Mount's rows and views

- **The circuit adds rows of its own: "Prostrating opposite the repaired breach (station n)" at the station where most
  are lying now, viewed from the row's end looking along it; and the mourner going round to the left, viewed from a
  few paces ahead of him.** "Go" from these lands where the act is seen. The event's own view is schedule-data's
  (requested). The western Chuldah gate takes more of the stream (0.55; the eastern 0.3, Kiponus 0.15 ⚙), so more
  pass the data view's breach. Measured on the low tier, the data view [290, 225] heading 317 has a circuit figure
  within 35 m and ±45° 39 % of the day (0.8 on average); the row view of station 3 is requested as the event's view.

## Kohanim and the Mount

- **The Parvah's salters come out of Beit HaMoked across the court on G5's walking graph; Beit Garmu's kohanim out of
  Pinchas' chamber and through the court and the Moked gate; the asham's and the sets' kohanim from Beit HaMoked.**
  The holy garments are not worn into the city (Yechezkel 44:19; Rambam Klei HaMikdash 8:11). The test asserts no
  figure of role `kohen` stands below Z 5.5 amot (the Mount, the chel, the city) all day. — Kohanim crossing the
  Mount in white.

## Source details

- The mourner (and the one under a ban) wears his head wrapped: a pool seed whose three figures all draw the head-cloth.
- The kohen takes the cooked foreleg and the loaves and puts them on the nazir's palms (Nazir 6:9); the hair caption
  follows Rambam Nezirut 8:2 (the broth on the hair, under the pot), without "at the door".
- The head of the ma'amad comes up with the ma'amad to the front of its place in Ezrat Yisrael (g3/places.js
  maamad) and goes from there to the gateway (Tamid 5:6). nikanor-stations' lead is 70 min so he is there from the
  ma'amad's start.
- Beit Garmu's shaper stands north of the kodesh line (Y 403.4; "shaping outside", Menachot 11:2).
- The shaven nazir is drawn (until people has a shaven state) as an Israelite in a head-cloth whose seed matches the
  nazir's skin, greying, build and face ⚙.

## Props and places in the nazirites' chamber

- **The basket of twenty loaves (Bamidbar 6:15) is drawn with people's `loaves_todah` tray ⚙** — the only bread
  prop; `basket` is the bikkurim basket heaped with fruit. A `sal_matzot` prop is requested. Achiyah's seals are
  carried in a bowl for the same reason.
- **Each set cooks at its own pit (Y 275 / 282 / 289), tended from the floor west of the raised hearth bench (X 388.3;
  the bench is X 389.1–392.1, 1.4 high).** The builder lit only the middle pit (`courts.en.nazirites.hearth`); the two
  others get stand-in fires (`sim.chambers.nazirites.0/.2`, fx.add) until build-courts lights them (requested).
- **The ram is leaned on with `semichah`** (`semichah_high` is for a bull).

## Smaller overlaps found by the sweep and fixed

- The midday relief stands beside the gatekeeper's post until the man he relieves has stepped off it.
- The kohanim at the meal go to the cook one at a time per place, and only from the cook's side of their group.
- The chavitin carrier takes the cakes east of the griddle baker; the metzora's palm kohen leaves Pinchas' door a few
  paces behind the vessel kohen; the impure leave the gateway one by one; the wood carriers have their own places.
- The asham hangs on G5's lane-1 hook (pillar 6) with its flayer below it, not between pillars 6 and 7.

## Measured (src/sim/dev/tests/g4.js, low tier, HD 4600)

- Deterministic on a weekday, a Friday and Shabbat. 2026-11-02: G5 counts 3 nazirites and 1 metzora, all staged
  (nazirites in at 09:40, 10:07, 10:50, three wavings; the metzora leans at 09:14 and 09:21, goes in at 09:27); the
  chatat's blood before the olah's in every set, the longest blood wait 2.5 min. 2026-11-06: 1 nazir, metzora 0 (idle).
- Overlap sweep: weekday 228 samples (up to 126 figures), one pair under 0.32 m (a single-sample pass); Friday none;
  no kohen below Z 5.5 all day. Cues 55/55, 81/81, 1/1, none on jumps.
- Per frame (G4's five modules): 0.40–0.52 ms average at the busiest views, p95 0.6–0.8 ms; courts-daily's circuit is
  about 0.2 ms of it. Planning a date: 1.6–2.1 s, mostly the nazir sets' placement (each try builds the set). Both are
  at the edge of the budget (see the task's issues).
