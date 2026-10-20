# choreo-g4-courts — decisions

Group G4: daily life of the Mount, the outer courts and the chambers. The review fixes (choreo-g4-courts-fix.md) changed
the entries marked (fix). Modules `courts-daily`, `nikanor-stations`,
`sanhedrin`, `chambers-daily`, `beit-avtinas` (src/sim/choreo/), helpers in src/sim/choreo/g4/ (`lib.js` routes,
itineraries, troupes, parties; `mount.js` the circuit, gates, prostration stations, spurs), test
src/sim/dev/tests/g4.js. Format: **Choice** — why (source / reasoning) — alternative. ⚙ = reconstruction.

## Engine

- **Every figure runs episodes planned once per date (`Troupe`), each an itinerary of legs (`Itin`): walks along
  authored routes and stands in place.** Position, heading, pose and prop are a pure function of minutes into the
  episode, so a jump re-poses everything; the itinerary of the current episode is built once per episode. — Per-frame
  state machines, which a jump cannot reproduce.
- **Routes carry exact floor heights at their vertices (the datums, and each sourced stair by its tread-midpoint line:
  the chel steps 12 × ½, the semicircular fifteen steps radially, the gate flights 32 × ½, the Chuldah stairs).** No
  physics query per frame; feet stay within half a riser of the treads. — `placeNear` floor lookups (0.025 ms each,
  times dozens of walkers).
- **A walk leg starts exactly where the last leg ended and merges into its own line over 3 m (position) and 1.6 m
  (heading); stand legs turn in and out over 0.045 min, and a sitting or stepping-into-place leg eases its origin over
  0.012 min.** No pops at junctions, corners, lane changes or when sitting down. — Snapping to each leg's line.
- **Arrivals and departures are through gates and doors only:** deep in the Chuldah tunnels, far out on Kiponus' bridge,
  the door of Pinchas' chamber into Ezrat Yisrael (kohanim by day — "Pinchas the dresser", Shekalim 5:1), Beit
  HaMoked's wicket (kohanim at night, after the locking), Lishkat HaMedichin's door (the dressed asham), the Gazit's chol
  door. — Appearing at the place of work.
- **People come in small parties (alone, two, three; couples and families) at a seeded rate that rises after the
  morning tamid and tapers toward evening** (`arrivals`, `assignParties`). Peak ≈ 1.25 parties a minute × max(0.6,
  crowdScale) on the circuit; women's parties ≈ 0.3/min and men going up to Ezrat Yisrael ≈ 0.1/min. A few dozen on
  the Mount at once on high tiers, about a dozen on low. ⚙ — Evenly spaced singles (read as empty and mechanical).
- **Still figures on an unchanged leg are only kept wanted, not re-posed; figures 40–120 m from the observer are re-posed
  every other frame (beyond that the runtime's own LOD thins them); cue closures are made only when `crossed()` says the
  moment was passed.** Each moving figure costs two matrix updates through the people API (setSite, setHeading).
  Per-frame cost of the five modules on low, 1×, observer at the scenes: 0.31–0.33 ms average, p95 0.5–0.6 ms
  (src/sim/dev/tests/g4.js). — Re-posing every slot every frame (0.45 ms average, GC spikes from per-frame closures).

## The Mount — entry-circuit (Middot 2:2–3)

- **Direction: counter-clockwise seen from above (south side eastward…), the courts on the walker's left.** Entering
  from the south facing north, "by the right" is east, and the same rule ("all your turns to the right") governs the
  altar's circuit (Zevachim 62b). Exits: the first public gate at least 40% of the way round (the gates are the two
  Chuldah gates and Kiponus; Shushan is the Parah's and Tadi "served nothing", Middot 1:3). ⚙ circuit line: a
  rectangle round the soreg (S Y 236, E X 420, N Y 452, W X 25) clear of the gate flights, the Gazit flight and Beit
  HaEven. — Walking the stoas' line (far from the breaches).
- **Everyone who passes a repaired breach turns to it and prostrates full length (13 stations, `mount.soreg.breaches`
  positions), 0.42 min each, at a place of his own in a row of eleven beside the station (fix: g4/book.js register).**
  Middot 2:3. On the north side (52 amot from the breaches) "opposite" is taken loosely. — Prostrating only at some.
- **Three counter-circuits a day (two mourners, sometimes one under a ban — seeded), each with four greetings: a man
  with the stream stops facing him, and the caption gives the Mishnah's exchange** (R' Meir's blessing for the ban,
  R' Yosi's in parentheses). The mourner and the banned man wear the head covered (atifah) ⚙ (fix: forced by the pool
  seed). They walk on the circuit's line, the stream's lanes on one side and the prostration places on the other
  (fix). — A caption without a meeting.
- **Women walk the circuit too** (only the zavah, niddah and yoledet in her days are barred from the Mount — Kelim
  1:8). — Women only in Ezrat Nashim.

## Ezrat Nashim — women-court

- **The gezuztra stays empty on an ordinary day.** It was built for the Water-Drawing (Middot 2:5; Sukkah 51b) and the
  report calls it "in season" (§59); the data's own description says so. Women stand on the court's floor in small
  parties, praying toward the Sanctuary (a bow now and then, hands lifted a while) or talking together ⚙; one in six
  women alone leaves a gift at Lishkat Chasha'im (Shekalim 5:6). — Women on the gallery daily.
- **Men pass up the fifteen steps (south lane up, north lane down) and stand in Ezrat Yisrael's south part**, clear of
  the ma'amad's place north of the axis; during the metzora's rites they stay in Ezrat Nashim. — Men in Ezrat Nashim
  only.
- **The kinnin chest is not used:** no chests are built yet (requested). — Women gesturing at nothing.

## Gate Levites — gate-levites

- **Two at Nikanor on the landing at the head of the fifteen steps, two just inside Ezrat Nashim's east gate, facing
  out; a fresh four relieve them at midday.** Report §61 (a Levite "standing gate-duty at Nikanor"); 1 Divrei HaYamim
  9:17–27. Role `guard_levi` without its torch (it is day). ⚙ posts and relief. — One shift all day.

## The kohanim's meal and the scouring

- **The meal is south-east of Ezrat Kohanim beside the cooking place, in small standing groups (no one sits in the
  Azarah — Rambam BhB 7:6), bowls held up and a trip to the cook now and then; the cook tends the cauldron from the
  hearth's west side**, because private-offerings brings the meat and fries the meal-offerings at the hearth's east
  side (offerings.js STATIONS.kitchen). ⚙ — The cook at the station (collides with G5's fryers).
- **By day they come and go by Pinchas' chamber; the evening group thins out from about two hours after nightfall and
  goes home to Beit HaMoked through its wicket (its door swings as each passes); the last three scour before
  midnight** (kneeling at the copper basin, pouring hot water, an earthenware pot broken with a caption — Zevachim 11:7).
  On Friday the fire is let die before sunset and they eat what was cooked before Shabbat. — A separate scouring crew
  (would appear in the court).
- **The kitchen fire is shared with private-offerings**, which writes it only on its own changes; this module states
  its want every update while it wants the fire and lets go once. After a jump the hearth can fade in over ~0.5 s when
  G5 wrote last. Shared max-wins fires in the runtime are requested.

## Nikanor — nikanor-stations

- **The impure (Tamid 5:6) come up from the Mount a few minutes before the magrefah, wait below the steps, and are
  called up by the head of the ma'amad (an elder, out of Pinchas' door) as it falls; they stand in the gateway and on
  the landing until the window ends.** The commentators take them as those awaiting atonement (the gateway is not the
  Azarah — Yoma 30b–31a); counts tier-scaled (3–6). ⚙ timing. — Standing there all morning.
- **The metzora's eighth day in the sourced order (Negaim 14:7–10):** waiting in the lepers' chamber on its bench (the
  immersion itself is not shown: figures cannot undress, and immersing clothed would show a chatzitzah), up to the
  gateway; the live asham waved with him (Menachot 5:6) and leaned on from the gateway, the lamb broadside within his
  reach (Zevachim 33a; Rambam MK 3:11); led to the easternmost ring of the third row and slaughtered; two kohanim take
  the blood, one in a vessel (thrown at the NE and SW corners, the rest on the southern yesod), one in his palm;
  head, hand and foot into the gate for the blood; oil poured into the colleague's left palm, sprinkled seven times
  westward, put on the same places and on his head; then his chatat and olah, brought to the gate for him to lean on
  and offered (fix: g4/sets.js); once their blood is applied he goes into Ezrat Yisrael. A metzora only on the days
  private-offerings counts one (fix).
  The carcass is hung on the nearest flaying station and carried, dressed, into Lishkat HaMedichin. Minutes ⚙.
  The metzora is an Israelite with a head-cloth: a shaven role is requested. — Leaving the asham to the general stream
  (private-offerings counts the metzora set but leaves its rites to this module).
- **Mothers and the healed zav / zavah are synchronised with private-offerings' bird jobs**: G5 schedules the
  yoledet and zav-zavah pairs (its kohen takes the cage at Nikanor and offers the birds); this module stages the
  bringer — up from the Mount with the cage, handing it to that kohen at his moment, then standing in the gateway until
  the birds are offered (Sotah 1:5), a woman not leaning (Menachot 9:8). It reads G5's plan (`state.plan.insts`) and
  re-plans when G5's plan for the date is ready; without G5 it plans its own (15–45 mothers and 2–10 zavim, one day
  quantile) with two gate kohanim of its own. — Two independent streams (double staging of the same birds).

## Sanhedrin

- **Weekdays in the Gazit's chol half on build-courts' stepped benches: the Nasi on the raised seat at the apex, the
  Av Beit Din at his right, the rest by rank from the apex outward; two scribes at the lecterns holding their scrolls;
  every hour or so a kohen stands before them (Middot 5:4) with the verdict as a caption.** They come up by the circuit
  and the Gazit's flight over the half-hour before the session, the outer benches first; leave front benches first. The
  `sit` pose has a 1-amah seat: exact on the first bench (0.9), but the benches above rise only 0.6, so feet sink about
  0.4 amah into the bench below — 1-amah risers requested of build-courts. Disciples sitting before them (Sanhedrin
  4:3) are not shown (no floor-sitting pose). — Standing judges.
- **On the low tier, attendance is crowdScale × 1.4 of the 71 (at least half: 36), the front benches by rank with the
  Nasi and the Av Beit Din; all 71 on medium and above.** Seventy-one close figures took the Gazit view to ~9 fps on the
  HD 4600 (22 fps with 36). The court did not always sit complete: one who had to go out saw that twenty-three remained
  (Sanhedrin 37a; Rambam Sanhedrin 3:2). — 71 on every tier.
- **On Shabbat (court-in-chel) they sit on the steps of the Gazit's flight inside the soreg — the Chel, below its door
  — in rows facing the Mount, the Nasi in the middle of the front row; people come to the flight's foot to ask.** Sages
  sitting on steps on Har HaBayit is attested (Sanhedrin 11b, Tosefta Sanhedrin 2:6); the steps give the `sit` pose its
  exact seat (two half-steps up, feet one amah forward). The Chel's open pockets are 10 amot wide and seatless. — A
  floating semicircle in the pocket south of the Gazit.

## Chambers — chambers-daily

- **Chavitin bakers: before dawn the Mount's gates are shut, so the bakers are kohanim of the beit av already in their
  dark chamber when torch-inspection's officer brings the torches in "to set them to work" (Tamid 1:3; g1/plan.js puts
  him just inside the door); one kneads at the table, one at the griddle with oil, one measures the whole isaron and
  halves it (Menachot 4:5) and carries the cakes, laying the morning six on the table before the limbs go to the ramp —
  tamid-morning's bearers (g2/tamid.js) take the flour, the chavitin and the wine from inside the chamber; the bakers'
  posts keep clear of both.** They leave by Pinchas' door when the window ends. A stand-in fire under the griddle
  (`sim.chambers.chavitin`, fx.add) lights the chamber until build-courts adds one. — Bakers walking in at dawn (the
  Mount is still shut) or a hand-over at the door (where the bearers walk out).
- **Wood store: blemished kohanim in their own clothes (`kohen_offduty`: unfit to serve, so not in the garments): one
  sitting on the low pile turning a log over, one kneeling among the loose logs and throwing a wormy one aside, two
  carrying from the piles to the sorting floor and on to the stacks.** Middot 2:5. ⚙ — Kohanim in white.
- **Nazirites (fix: choreo-g4-courts-fix.md): as many sets as private-offerings counts for the day, none on many days;
  the three animals offered in the court (g4/sets.js), the shaving and the cooking in the chamber, the cooked foreleg
  taken by a kohen and waved on the nazir's palms in the court (Nazir 6:7–9; Rambam Nezirut 8:1–4, MK 9:9).**
- **Golah wheel: a draw every six minutes — the bucket wound up (≈ 3.8 turns of the drum for 13 amot), emptied into a
  jar, the wheel let run back; a Levite at the spokes (`sweep` until a crank pose exists), a Levite at the curb carrying
  the jar out to the court; the wheel's creak (`muchni` cue) near.** Middot 5:4; Eruvin 10:14 (Shabbat too); Levites
  per report §61 ⚙. — A static wheel.
- **Parvah: two kohanim salting hides on the racks, one fetching salt from Lishkat HaMelach and throwing fresh hides
  over the rack; they come out of Beit HaMoked across the court (fix: never over the Mount in the holy garments).**
  Middot 5:3. — Hides brought by private-offerings only.
- **Beit Garmu (Friday): kneading in Beit HaMoked's chol half, the baker at the oven in the showbread chamber, a shaper
  north of the kodesh line carrying each dough between them** — "kneading and shaping outside, baking inside"
  (Menachot 11:2), one by one and two by two (11:1). They come out of Pinchas' chamber and through the court and the
  Moked gate (fix: not over the Mount). The chamber as built has no standing room at its table (requested). — All four
  inside.
- **Seals: Yochanan ben Pinchas and Achiyah in their own clothes come by the chel door; Achiyah brings the seals out of
  the north-east chamber and they reckon before it** (Shekalim 5:4; Tamid 3:3). — Seated on the ledges (the ledges'
  half-amah rises do not fit the seat).
- **Beit Avtinas (occasional): never on the daily clock; if a date makes it active, three kohanim of the house come up
  the gatehouse stair and pound and blend at the mortars, with the grinder's chant (Keritot 6b).**

## Poses and props (stand-ins until people adds them — requested)

- **`receive` is kept for catching blood only** (the bent catch at the animal's neck); handing over birds, holding a
  bowl to the cook, the seals' basket and the Golah bucket use `carry`; a hand put into the gate or a gift left in the
  chest use `point`. — `receive` everywhere (read as crouching).
- Kneading `kemitzah`, cranking the Golah wheel `sweep`, shaving `semichah_high` with `knife_flay`, the earthenware pot a
  `wine_jug`, the scribes' writing `carry` with `scroll`.

## Hand-overs with other groups

- The night-watch Levites leave at sunrise − 5; the gatekeepers arrive at sunrise − 3.
- Kohanim going home at night pass Beit HaMoked's wicket (`door:azarah.gate.moked.pishpash`, shared want) into the hall
  where moked-night stages the sleepers; they disappear in the wicket's passage.
- private-offerings: the birds of the sets (above); it also brings the most-holy meat and meal-offering remainders to
  the meal and the kitchen — the two scenes share the place, which suits them.
