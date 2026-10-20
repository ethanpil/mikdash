# choreo-g2-altar — decisions

Group G2: the dawn altar and both temidim — `terumat-hadeshen`, `barkai`, `tamid-morning`, `tamid-afternoon`,
`gazit-shema` (src/sim/choreo/*.js) with shared helpers in src/sim/choreo/g2/ (lib.js scripts and free props,
places.js spots and ways, tamid.js the tamid service builder). Test: src/sim/dev/tests/g2.js.

Format: **Choice** — why (source / reasoning) — alternative. ⚙ = reconstruction (the sources fix the order, not the
spot or the minute).

## Engineering

- **Every figure is a `Script`: walks along authored waypoints and actions in place, laid end to end from an absolute
  minute, evaluated with `since(t, t0)`; built once per date (`sim.generation`), at init behind the loader.** — The
  whole morning is then a pure function of the clock: the determinism test (48 times, three jump orders) is identical,
  and nothing waits on nav. — nav-routed walks (gates.js style), which change shape when nav arrives and can route
  through shut doors.
- **No nav: the ways are authored on open pavement (places.js), kept off the amah's open channel (site.js
  azarah.amah-channel), the pillars and the marble tables (lanes through their gaps).** — The court is mostly open and
  the lanes are exact; placeNear keeps feet on the ramp, the altar top, the duchan and the newel stair. — nav legs.
- **Free props (vessels on tables, parts on the ramp, the carcass states on the hook, the hide, logs, tools) are
  `people.spawnProp` actors with a show window and keyframes, spawned at init and toggled by the module.** — They are
  not figures, so they are outside the runtime's budget pass. — A prop pool in the runtime (requested).
- **The two `always` modules own what must be right at any hour: terumat-hadeshen the kiyor (sunk from the locking ⚙
  until the muchni raises it), the silver pan in its niche, the two logs on the great pile (morning and afternoon), the
  wood and the tools; tamid-morning the lamb chamber (six lambs plus the day's two tamid lambs, Arachin 2:5), the
  vessels on the silver and marble tables (out of use while in someone's hands, morning and afternoon), and the salt on
  the ramp.** — A jump to any hour shows them right without anyone else's module. — Restoring them on release.
- **The altar fires are driven every frame only inside terumat-hadeshen's window (muchni − 0.5 → second pile + 0.5) and
  handed back at the builder's levels; altar-night stops writing at muchni − 1 (it does).** — One writer at a time. —
  A shared fire want in the runtime like doors (requested).
- **Cues: each headline moment is at least CUE_LEAD after its event's start; captions only near (30–70 m; 260 m for the
  muchni and the barkai call).** — The UI's jump-to-event lands at t0 + 0.25. Verified at 120×: every key once, no
  doubled sound or caption, nothing on jumps.
- **Cost on low, 120× continuous play through the dawn service and the afternoon tamid** — see choreo-g2-altar-fix.md
  (figures now stand at their authored Z, no floor query per moving figure; the test lists frames over 0.45 ms).

## Hand-overs with other groups (same seeds → same faces)

- **G1 (torch-inspection, lotteries, altar-night) hands over the winner and brothers 0–3 at terumat-hadeshen's group
  spots at muchni − 0.8 (pool seeds 0x7468 / 0x7469, `groupSpot` formula kept stable); brothers 4–7 come out of Beit
  HaMoked through the wicket (it opens for them).** — No one pops at the meeting place. — Eight brothers appearing.
- **lotteries.js reads `plan.W` / `plan.B[i].tEnd` (terumat-hadeshen) to take the men in at the Gazit's door for the
  second lottery; barkai's watchers start at the Gazit's inside spot with its seed (0x6261).**
- **The dawn's one leftover limb is altar-night's last small-hours limb (`limb_gerah`, g1 onPile[4], heading 220),
  taken over at its spot at muchni − 2.5.** — Their night burns the evening's limbs down; Tamid 2:1/2:5's "limbs not
  consumed" is then one piece pushed aside and put back. — Four limbs of our own (the first version).
- **gazit-shema uses lotteries.js's seeds for its 20 regulars and the officer and walks them into that module's
  third-lottery circle (N 20, ≈0.68 m a man, round the lottery station), arriving at its start − 0.3 where it takes
  them over; the tamid's nine and the slaughterer come in from the ramp at the times tamid-morning brings them to the
  door (`M.t.gazitIn`).**

## terumat-hadeshen (Tamid 1:4–2:5)

- **The winner himself works the muchni.** — "No one goes in with him … they did not see him or hear his voice until
  they heard the sound of the wood of the muchni" (Tamid 1:4): the creak is the first sign of what he does. — A second
  kohen at the wheel (the schedule's note leaves it open). Pose ⚙ 'carry' (hands on the spokes; a windlass pose is
  requested).
- **The kiyor sinks at the locking of the court (locking-up t0) and rises at the muchni.** — The muchni keeps its water
  from linah overnight (Yoma 37a); when it was lowered is not stated, the locking is the end of the day's service in
  the court ⚙. — Midnight.
- **Sanctifying: stooped under a spigot (bow held), the brothers round the laver's east and west (the Ulam steps rise
  1½ amot north of it and the muchni stands south).** — Zevachim 19b: right hand on right foot, left on left. A
  'kiddush' pose is requested.
- **The pan: from its pocket between the small yesod ramp's level run and the altar he stoops from the run (Z 17).** —
  site.js puts the niche (Tamid 1:4 "the corner between the ramp and the altar, west of the ramp") behind that 1-amah
  block. ⚙
- **Up the east half, round the top to the right, down the west half — also with the coals.** — Zevachim 6:3: all who
  go up ascend on the right, go round, descend on the left; terumat hadeshen is not among the exceptions. —
  Straight down after the scoop.
- **He scoops at the great pile's inner end (south side, by the tapuach).** — "From the inner, consumed coals" ⚙ spot.
- **"Turned his face to the north, went along the east of the ramp about ten amot": round the foot to the east side,
  north to Beit HaDeshen (site.js), heaps the coals; a small glow there for 40 min ⚙ (the module's own fx fire).**
- **After it he puts the pan back in its niche ⚙ and takes a fork; the shovels and forks are kept on the pavement west of
  the silver table, "on which the service vessels were placed" (Shekalim 6:4) ⚙.**
- **Eight brothers ⚙ (the number is not given): run (3 m/s) by the south of the ramp, sanctify, take magrefot/tzinorot,
  up the east half; one fork pushes the limb off the fire to the north edge, the others spread coals; then all rake the
  ash onto the tapuach in shifts; six carry logs (two trips), two of them bring fig wood to the incense pile on their
  second trip; two tend the fire and push the limb back (2:5); the winner builds the great pile at its east face
  (Yoma 22a: he who won the clearing builds the pile and the two logs), lays the two logs, and lights the kindling with
  a brand from the third pile (R' Yosi's fire-keeping pile, lock #17); all go down and walk to the Gazit (2:5).**
- **The wood: 16 'log' boards in two piles east of the ramp's foot from midnight ⚙ (12 for the pile, the morning's two,
  the afternoon's two).** — The people 'log' prop is the gizer of Zevachim 62b (an amah square, thin). Tamid 2:3 calls
  the pile's wood gizrin too, but of fig, walnut and oil-wood branches: a round-log / branch-bundle prop is requested.
- **Fire levels ⚙: the night's embers 0.55 → raked 0.3 → lit to the builder's 1.0/0.9 (incense 0.6) at "they lit both
  piles"; the third pile stays 0.7–0.75 through the clearing.**

## barkai (Tamid 3:2; Yoma 28b)

- **The watcher goes up the Water Gate's newel stair (inside its east room) to the roof walk, faces east-north-east over
  the court's low east wall and scans; the second man waits on the pavement below, east of the amah channel.** — Yoma
  28b: one on the roof, one on the ground; the schedule names the roof. ⚙ spots.
- **Two cues: "Barkai!" (audio 'barkai') at t0 + 2.6, then the question from below and the answer (variant 'hebron') at
  t0 + 3.5 — the tanna kamma's call and Matya ben Shmuel's exchange both shown.** ⚙ order.

## tamid-morning / tamid-afternoon (Tamid 3:3–4:3, 7:3)

- **Lamb chamber: two kohanim from the Gazit through the Moked wicket (open as they pass); one chooses among the
  lambs, leads it (rope: `setLead`) out to the pavement inside the Moked gate; he holds it there until the watering.**
  ⚙ who and where.
- **The vessels: four kohanim through the vessels window — one lights the dark chamber with a torch and hands out, the
  others carry two at a time to the silver table (mizrakim, bowls) and to a marble table in the slaughterhouse (gold
  cup, mizrak, a bowl).** — Tamid 3:4 (93 vessels); Shekalim 6:4 (the silver table). The knives come from Beit
  HaChalifot (Middot 4:7; choreo-g2-altar-fix.md). The marble table for the
  slaughter vessels is ⚙. They go back to Lishkat HaKelim after the afternoon limbs ⚙ (the Mishnah describes only
  taking them out).
- **Watering: one holds the gold cup at its muzzle (lamb 'drink'), one examines it on his knees round it, two hold
  torches (morning only).** — Tamid 3:4. ⚙ roles.
- **No light in hand on Shabbat night: no torches at the lamb's inspection or in the vessel chamber on Shabbat.** — The
  night's inspection is by the lamps lit before Shabbat (Rambam BhB 8:12); the project's night scenes (torch-inspection,
  night-watch) apply it, so these do by analogy ⚙. — Torches every day as Tamid 3:4 reads plainly. The brand that
  lights the altar's kindling stays: the service's fire is lit on Shabbat.
- **Binding at the second ring (site.js rings tamidMorning/Afternoon): the lamb 'bound' heading 180 = head south, face
  west, throat east; the slaughterer east of it facing west; two kneel holding it from the north, four stand by; the
  receiver at the neck.** — Tamid 4:1. They wait for the great gate's sound (gates.js opens it at great-gate t0 + 0.5);
  the cut at tamid-slaughter t0 + 1.6 (choreo-g2-altar-fix.md).
- **The slaughterer also flays ⚙ (Tamid 4:2's "he" is unnamed); he carries the dead lamb to the hook in his arms (a
  carried-lamb prop is requested) and stands at the carcass's south-west facing north-east, so the carcass stays in view
  from the schedule's southern view.**
- **Hook: pillar 3 (morning, by the NW ring) / pillar 5 (afternoon), row 0 (a lamb) — the builder's altar.hook.P.0
  anchors; carcass states lamb_hung → carcass_flaying (head off) → carcass_hung (opened) → gone with the left hind leg;
  the hide laid by the pillar, then carried to Lishkat HaParvah (Middot 5:3) by the receiver ⚙.**
- **The cuts in the Mishnah's order at fixed fractions of the flaying window ⚙; each winner steps up, receives, goes
  back to the row beside the flayer (west of him, clear of the view); the innards rinsed on the nearest marble table.**
- **Flour, chavitin and wine come from the chavitin makers' chamber by Nikanor (Middot 1:4) ⚙ and join the row.**
- **The nine in file through the table gap and along the altar's west to the ramp's foot, up the west half; laid on its
  lower half, west side (Tamid 4:3; lock #16), the first highest; two of them salt everything but the wine from salt
  kept on the ramp (Menachot 21b ⚙; Rambam Isurei Mizbeach 5:11).** The wine stays until the libation's start (libation-song takes it from there — requested).
- **Afternoon: the lamb fetched and watered before 8½ hours (unscheduled, as the morning ⚙; no torches), the NE ring,
  pillar 5; after salting the crew waits as a loose knot south-east of the ramp's foot (off the amah channel and out of
  the strip between the Ulam and the altar during the incense) ⚙; at 9½ hours the nine and the two log-bearers (Yoma
  2:5) — limbs, logs, minchah, chavitin.** On weekdays the same faces as the morning (Yoma 26a); on Shabbat the incoming
  mishmar (`SEEDS.shabbatIn`, shared with gazit-shema and G6). The afternoon lamb waits in the chamber under tamid-morning (same seed and slot) until led out.
- **Limbs up (morning): the fourth lottery's winners (lotteries.js's Gazit men 11–18 via `seedFrom`); picked up on the west half,
  up the east half, round to the great pile's face, a throw across to the fire; limbs, then minchah, then chavitin
  (Yoma 33a).**
- **Shabbat: the Kohen Gadol offers the limbs** — Rambam Klei HaMikdash 5:12 (he offers on Shabbatot, new moons and
  festivals) with Tamid 7:3: up the ramp with the segan at his right, the segan taking his right hand at mid-ramp; the
  first bearer hands him the head and leg, he leans on them and throws them; each next bearer hands his parts to the
  first, who gives them to him, and slips away; then he goes round the top SE → NE → NW → SW and stands at the SW
  corner for the wine (libation-song — requested). — Weekdays without him (the schedule: "when he wishes").

## gazit-shema (Tamid 4:3–5:1; Berachot 12a)

- **Rows in the holy half's east facing south toward the Heichal ⚙, the officer before them; speech postures in turn,
  not in unison ⚙; the text as captions.** On Shabbat the outgoing watch (south rows) turns north to the incoming (north
  rows, Sukkah 56b's sides) for the blessing; the incoming then leave by the door.

## Views

- See choreo-g2-altar-fix.md (requested view spots, each checked with a shot). Hand-held vessels on low beyond ≈ 8–10 m
  still depend on the people LOD request (ritual vessels at LOD 2).
