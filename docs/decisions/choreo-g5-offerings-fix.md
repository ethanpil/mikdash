# choreo-g5-offerings-fix — decisions

Review fixes for choreo `private-offerings` (src/sim/choreo/g5/*, src/sim/dev/tests/g5.js). The base design is in
choreo-g5-offerings.md (updated where this fix changes it).

Format: **Choice** — why — alternative. ⚙ = reconstruction.

## Findings fixed

- **The yoledet's bird chatat comes first; her lamb follows.** The plan links the two jobs. The bird is placed first,
  no later than 80 min before the last fats go on the fire. The lamb's arrival is then set 0.5–3 min (seeded) after
  the bird's melikah ends, when her husband or agent leads it in by the Korban gate (Zevachim 90a; Mishnah Zevachim
  10:4). If the lamb cannot be fitted, it is counted as dropped (none on the test dates). The instances carry `link`
  to each other. The test asserts melikah end ≤ the lamb's arrival for every set: 7/7, 2/2 and 7/7 on 2026-11-02,
  11-06 and 06-15. — Alternative: only a minimum gap, with arrivals still stratified: hours apart, and the mother
  would be gone.
- **An asham brought alone is a ram** (offerings.js: gezelot, me'ilot, shifchah charufah, talui). The lamb asham is
  the nazir's or the metzora's, staged elsewhere.
- **No white fleece on a goat.**
  - Goats hang as `carcass_hung` from the moment they are hung. `lamb_hung` and `carcass_flaying` are a sheep's.
  - Most-holy offerings, whose hide is carried to the Parvah in view (the `hide` prop is fleece), are drawn as sheep:
    olah lamb .8 / ram .2, the individual's chatat a ewe lamb (Vayikra 4:32). The data allows both.
  - Goats remain for shelamim, todah, bechor and ma'aser (about 25–40 % of each).
  - The people request for goat variants stands. — Alternative: no goats at all (loses the mixed flocks the sources
    assume).
- **The SW corner has one place per role, and the point is booked.** Geometry: the open amah channel runs south from
  the corner (X 198.5–199.5) and the yesod ramp's landing fills X 201–209, Y 303.5–305.5. The corner is therefore
  reached by a 1½-amah strip over the slab of the shit (Middot 3:3). The places:
  - **point** (on the slab, at the point of the corner): the second throw of two-that-are-four and its pour, and
    the hagashah.
  - **bird places**: three along the west face north of the corner, each with its approach from the corridor and its
    cage set down behind the kohen.
  - **corridor**: west of the bird places (AW_SW 197.8, 306.2), then through the strip (new nodes SWN, SWS). The old
    leg cut over the landing.

  `P.hot` is a booking per shared place. Any figure of an offering within r amot (HOLD spots by distance, WALK legs by
  exact line–circle intersection) books that place for those minutes. A placement that would overlap another
  offering's booking slides later. The booked places are the SW point and strip, the NE corner, the sovev's SE corner
  (a 1-amah ledge, so a bird kohen there blocks the way round), the pile's east face, the cups, the eimurim salting
  place and the portions drop at the hearth. The Nikanor module's metzora blood at the SW is booked from its own
  timing (window start + 19.5 to + 25 min).
- **Birds brought alone are no longer handed over by nobody.**
  - The Sages' reading of Shekalim 6:5: money in the chests "kinnin" (a chatat and an olah) and "gozlei olah" (olot),
    and the kohanim offer the birds. All lone chatat-haof and 55 % of lone olat-haof come this way. The kohen carries
    the cage from the start of his walk from the Moked side (where the birds were kept is not stated ⚙).
  - The other 45 % of olat-haof are a man's own vow or gift (Kinnim 1:1). He comes up from the Mount with the cage
    and hands it over in the gateway at s + 0.5, the same moment as the Nikanor module's mothers.
  - Each row says which.
- **Tenufah: the kohen's hands beneath.** The owner and kohen stand 1.3 amot apart face to face. The owner waves the
  portions (`wave`); the kohen holds `carry` with no prop, whose palms are 0.25 m forward and about 0.05 m lower,
  under the owner's palms (0.30–0.39 m forward). There is no joint waving pose, so his hands hold still (request). The
  bikkurim works the same way: the owner holds the basket by its rims (Bikkurim 3:6). — Alternative: 0.9 amah as
  suggested, which puts the owner's palms inside the kohen's chest with these poses.
- **The minchat chotei's kometz caption** drops the frankincense and cites Vayikra 5:11–12.
- **Eimurim are salted** (Rambam MK 6:4; Vayikra 2:13). The kohen takes the bowl to the lower west half of the ramp
  (one booked place north of the olah's limbs), sets it down, salts, takes it up, then goes up the east half.
- **Watchable rows end with the last step.**
  - Between steps, a row shows the step about to begin.
  - Zone: the step figure's zone only while it stands on the pavement (Z < 19.5); on the ramp, sovev or top, the
    step's own zone. This fixes "The Azarah" for the horns and the fallback to the Levites for the bikkurim waving.
  - The test checks 1,189 row-moments: none after its offering's last step, every one on the altar with its step's
    zone, every one with a summary and a view.
- **Views off the eaters.** `V.sovev` [229.5, 295.5] heading 345 sits between the kevesh's small ramp and the hearth,
  so the SE horn and the sovev's east side are in view. `V.kitchen` [241.4, 288.4] heading 338 sits south-east of the
  hearth, off the corridor.
- **The Levites for a late basket.**
  - Each has a seeded start delay of 0.2–0.6 min after the man ahead; later starters are slower, so nobody
    overtakes.
  - A ±0.18 m sideways offset is eased in and out (Track `side`, now ramped at both ends of a walk, so no pop at
    arrival).
  - They stand in two staggered ranks on the duchan's treads, with seeded headings and departures.
  - Song for a lone late bringer stays reconstruction: Bikkurim 3:4 describes the procession.

## Found by the overlap sweep and fixed

The sweep in g5.js samples every G5 figure every 0.04 min on three dates and lists pairs closer than 0.85 amah
(41 cm between body centres). Before these fixes it found 18–22 standing overlaps a day. Now there are **none**:

- several K2s on one spot in Lishkat HaMedichin and the Parvah: one place per lane inside each chamber (also
  Lishkat HaMelach for the meal kohanim);
- the NE corner (one pouring and the first throw on one spot): booked;
- the pile face (olah carriers, eimurim, handfuls, flour): booked; the first carrier goes to the farthest place,
  and the farthest leaves first;
- owners of one lane waiting on the same spot in Ezrat Yisrael, on the corridor line: two places per lane, taken in
  turn, east of the corridor; firstling kohanim the same in the Ezrat Kohanim;
- the bikkurim kohen 0.8 amah from the bowing man: he waits 1.6 amot off and takes the basket after the man has
  gone;
- a neighbouring lane's kohen at the table: the pick-up places stay within the table's width;
- a lane's next kohanim waiting by the ring while the last carcass is lifted: the ring is reserved from their
  arrival.

Also fixed while there:

- **Walks out of the hook/table band no longer cross the marble tables.** A route that starts or ends between the
  tables and the hooks goes straight to the corridor north of the tables (Y 378.5) and leaves by T_W/T_E, never by a
  node south of the tables.
- **The east corridor no longer runs through the kohanim eating** (courts-daily's middle group at 239.9, 305.4). It
  runs west of the eaters and the cook, 2 amot off the altar (E_W…E_W4), and reaches the hearth's east side from the
  south (E_K).
- **The kitchen has fixed places:** three frying places along the hearth's mouth, one booked drop place for meat,
  birds and remainders, and the notar pick-up south-east of the hearth.
- **The waving places** are reached by each man from his own side (owner from the east, kohen from the west), and
  E_M moved east of the owners.
- **Keep right.** A route's corridor nodes on the open court floor move 0.52 amah to the walker's right, mitred at
  turns. Gates, doors, the ramps, the sovev, stairs and the SW strip are excluded. People meeting on a corridor pass
  a shoulder apart. Momentary walking passes between different offerings are now 1–11 a day (one 0.04-min sample
  each), down from 34. Most are owners leading animals across a column corridor; one is the gate kohen of bird lane 1
  standing on the line through Nikanor (whose position is the Nikanor module's hand-over contract).

- **Kayitz hamizbeach.**
  - Its "at most two at once" check read a flag set only after the build, so the cap never applied; it now reads
    the job.
  - A kayitz olah may now wait up to 6½ min for a gap (its 7-min stride); before, only an exact fit counted.
  - Result: 7 on 2026-11-06 and 8 on 2026-06-15. None on the busiest default day (q 0.96): all six hooks are taken
    through the kayitz hours, so the altar is never idle, which is what kayitz is for (Shekalim 4:4).

## Not changed

- **Meal-offerings that cannot be fitted** (6–9 on the busiest days): three meal kohanim with 20–45 min of frying
  each are the bound, as before; the hearth's mouth has three places.

## Cost

- The plan builds in 125–250 ms per date: 212 ms on the boot date, in init behind the loader.
- The shared-place bookings are sorted with a running maximum (binary-search checks); a CPU profile showed linear
  scans as 32 % of the build before this.
- Per-update cost on low at 120x: avg 0.25 ms, p95 0.4 ms.
