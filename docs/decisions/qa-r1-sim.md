# qa-r1-fix-sim — decisions

Fixes from the first QA round in src/sim/** (SIM-1 … SIM-5). Format: **Choice** — why — alternative. ⚙ = reconstruction.

## SIM-1 — the ordinary weekday's people on the Mount and in the outer courts

- **How many: an ordinary Cheshvan weekday, never a festival crowd. The report's own baseline is "ma'amad + staff ≈ low
  hundreds" (§36.5); around it, through the day, come the owners of private offerings, women bringing their birds,
  those paying vows, shekels and gifts at the chests, families, and people who come up to pray, to prostrate opposite the
  breaches (Middot 2:3) and to watch the service.** On high this stages ≈ 350–370 figures in all at the morning's peak
  (the sim wants ≈ 280 at 10:30, courts-daily ≈ 180 of them, against 65 before), on low ≈ 100 in the courts and on the
  Mount (courts-daily 77–105; the sim 155–205 within the runtime's 240), with the far ones drawn as people's LOD3
  silhouettes. `g4/crowd.js DENSITY` = low 0.55, medium 0.9, high 1.6, ultra 2.0 scales the arrival rates and the pools
  together ⚙. — A festival-size crowd (Pesachim 64b's three groups), or an unbooked "conveyor" crowd; rejected: the first
  is wrong for the day, the second would walk through the circuit's stream and skip the prostrations that every visitor
  makes.
- **More of the sourced kinds rather than a new crowd: the circuit's stream (Middot 2:2–3), the women's court, plus three
  long-stay kinds that give density without many more booked walks:** families with children in the circuit and in Ezrat
  Nashim (parties m+w+c…; children in the slow lane, beside their mother; parties of four or five stand in the open
  bands, smaller ones anywhere; a woman alone on one of the original places — the chests are reached from those —
  gives at a chest more often, 0.55 for 0.32, so the chests are used about as before); people standing a while by the soreg looking
  at the courts (`SOREG_SITES`, 26 sites on the S, E and N strips, away from the stations' rows, the spurs, the flights
  and the corners; back row first, front row leaves `WATCH_ROW_GAP` before it); and gatherings before the royal stoa — men
  talking, a teacher with students round him ("Rabban Gamliel … sitting on a step on Har HaBayit", Sanhedrin 11b),
  families resting — who come up the western Chuldah passage by its middle, go right along the stoa and leave by the
  left down the eastern passage's middle (Middot 2:2), never reaching the soreg's line ⚙. — Raising the stream's rate
  alone (plan cost rises faster than linearly: lane checks) and leaving the south plaza and the stoas empty.
- **Ezrat Nashim's open bands (north and south of the court's middle, between the corner chambers) get 30 Poisson-disc
  spots (6.5 amot apart, each a party's cluster of up to five, `FAMILY_OFF`), reached by aisles (Y 341.5 / 319.5 in,
  343 / 318 out) and five columns between the original rows; no spot lies within 2.3 amot of a column, and a party comes
  along its own row from the column — the first takes the place farthest from it and leaves last.** ⚙ — The original
  diagonals from the gate straight to a spot (they cross the rows).
- **Private offerings' owners are bound to their offerings: G5's owners and animals appear at the foot of the Korban
  gate's flight (the firstling's bringer at the Bechorot gate's, the bringers of birds, meal-offerings and bikkurim and the
  meat carriers at the foot of the chel steps) and were gone from there; courts-daily now walks them up from the city by
  the gate before that place with the stream and home with the stream to the first exit, prostrating like everyone, the
  animal on its rope behind (`g5Ways`; new spurs `bechorot` and `chel`).** They are G5's own figures: courts-daily's pools
  mirror G5's pools' roles and seeds (`g5/plan.js poolSeed`), and G5 keeps a figure free `WAY_RES` minutes (14 before,
  15 after) around each such track, so the man who leads the lamb up the Mount is the man who leans on it, never in two
  places. 91 in / 91 out on 2026-11-02, none dropped; G5's israelite pool is 30 (was 16), the animal pools grew to match;
  `missing` stays 0. The animal's first rope segment at the gate starts a rope's length behind its owner
  (`track.js extrap`), not under him. — A second, look-alike figure handing over at the foot (a visible swap), or leaving
  the pop-in/out.
- **Planned first in courts-daily (the owners' minutes are fixed by the offerings; the stream plans round them), then the
  stream, the women's court, the soreg, the stoa.** courts-daily's plan is now built at init (behind the loader) and right
  after a date change (`time:date`, deferred one task), not in the frame the module wakes in: ≈ 1.1–1.2 s on high and
  ≈ 0.35 s on low on this machine's CPU under the round's load (it was ≈ 0.3 s on high, built mid-play when the module
  woke). — Building it lazily (a hitch around sunrise−33 in play). The cost is in the booked walks' builds and retries
  (Ezrat Nashim's ≈ 0.6 s on high); a later pass could plan the day in idle slices.
- **G4 booking fixes the higher density exposed (all pre-existing mechanisms; the baseline had the same pairs at fine
  sampling):** (1) `walkLoop` looked at the lane only up to the next station's middle, but the place taken may lie up to
  the row's far end — the walk on to it stepped into a lane nobody had checked; it now looks to the row's far end
  (`stretchEnd`, `firstStretch`). (2) A party's next member sets off after any wait the one ahead made before stepping
  into the lane (`memberStart`). (3) The way down a spur is booked like a gate's passage, and a walker who can stay
  longer where he was (`flex`: EN visitors) is rebuilt staying longer instead of waiting at the spur's foot; leaders are
  retimed (`buildFrom` tries 3) rather than wait at their gate's junction. (4) An animal on a rope: its line is checked and
  booked with its leader's (`lags`, chambers-daily's nazir party too — its unchecked shadows walked into the stream).
  (5) Someone standing in a lane's way — one waiting at the head of a spur (a walker who cannot stay longer where he
  was), one waiting where a gate's passage begins — is booked as a block (`LaneBook.block`), so the lines planned after
  him keep clear. (Tried and withdrawn: blocking the lane where a led animal stands at the halter by its leader's
  prostration place — it made walkers behind wait at their own places, past the window their place was booked for, so
  the next one to book that place found them still on it; the place booking's fixed window is the older weakness.) (6) Stations no. 9 and no. 10 (24 amot apart on the
  east side) shared their rows' end places: each row is moved 0.8 m off the other. (7) A G4 `Follower` stands a rope's
  length behind its leader until he has walked that far (it stood under him where they came in together). (8) The way
  down from the foot of the chel steps is booked as the court's way down where they meet. (9) `buildFrom` retries a
  walker later by the wait it saw, and `Itin.walk` computes the heading a walk sets off on only when a stand precedes it
  (planning cost). (10) When every place at a station is taken, the walker waits a pace short of the one that frees
  first between it and the circuit's line — it was toward his own lane, so an outer lane's walker stood in lane 0.

- **Verification (2026-11-02 / -06 / -07, low):** g4.js deterministic on all three dates, its overlap sweep 0 pairs on
  both days (up to 179 figures; the original 14:15 EY pair gone), every planned cue once; g5.js deterministic, cues
  57/57, `missing` 0, the same 12 offerings not fitted as before. A finer sweep (every 15 s, 07:30–12:30 and 07:30–11:30)
  finds 12 transient contacts of under a second (where walkers step out to or back from a station's places, where an
  animal stands at the halter, and nikanor-stations' own) with up to 179 figures shown — the unchanged code shows 12 of
  the same kinds with up to 129.

## SIM-2 — Ish Har HaBayit: Go/view and the dawn phase

- **"Go" to the officer's row stands 4 m behind him on the line he walks, facing him (`ctx.schedule.liveView`: `ev.view`
  becomes a getter evaluated at the clock's time; the data's view when he is not out).** At his gate's portal the stand is
  a few metres up his round, so he walks toward it. — A fixed view (an empty gate almost always), or the next post (a
  long wait).
- **At a post his torch-bearers stand before him, one either side, between him and the guard ("torches burning before
  him", Middot 1:2), blended in over his last 2.5 m to it and out over his first metres from it.** — The path's "ahead",
  which at the turning posts put them on the way back, between him and the viewer.
- **The round's phase (⚙ model choice — the sources fix none: "he went round every post", Middot 1:2; "all the night",
  Rambam BhB 8:10): he reaches the foot of the Chel steps on his way in to Nikanor's post `DAWN_LEAD` = 0.5 min after the
  default opening (alot − 6, `DEFAULT_OFFSET_FROM_ALOT`).** From the start view he comes up the chel strip with his torches,
  climbs the steps into the open gateway, greets the Nikanor guard framed in it, and comes back down toward the viewer
  about three minutes in. The scales to that anchor stay near 1 (the incident's anchor is kept). — The old phase (his
  last round ended at his gate at alot: at the opening he was at the Mount's NW corner, 450 amot away).
- **After his event ends he finishes the leg to the soreg's east entry (≈ 0.3 min after alot), then walks across the open
  south of the Mount to his gate — the western Chuldah passage — greets its guard and goes out (≈ alot + 4).** He never
  goes back into the Azarah during the morning's lots, the barkai and the lamb. Without a usable dawn anchor (an odd
  window) the old rule holds. — Completing the round after dawn (through the Moked and the Azarah while the morning
  service runs).

## SIM-3 — Birkat kohanim's listed window

- **The event's listed window is the blessing as staged: from its start (the kohanim taking their places) to the hands
  coming down, `BLESS_DOWN` = 2.0 min (`ctx.schedule.retime`); the data's 4-minute window stays as `ev.tPlan` for the
  staging.** The research gives no minutes; one blessing of fifteen words said slowly with the Name (Tamid 7:2) is well
  inside two minutes, so the raise was not stretched to four. The first half-minute (before the raise) stays in the window:
  the UI's jump lands at start + 0.25 and no cue may fall before start + CUE_LEAD. — Raising the hands for four minutes
  (unsupported), or hiding the time before the raise.

## SIM-4 — Ezrat Yisrael

- **Men walk to their places in Ezrat Yisrael along an aisle by the court's east wall (in at X 253.9, out at X 253.0)
  and then along their own row — moved off the row where it would pass within 1.4 amot of another place — not diagonally
  past the other places.** — Offsetting the places (the diagonal still crosses whichever place lies on it).

## SIM-5 — the gc test

- **Heap sampling at 4096 B a sample over 2-second windows, each ended by `HeapProfiler.stopSampling` (the one call that
  returns the profile), aggregated in Node; run.mjs aggregates stopSampling too, so no profile crosses back into the
  page.** The old test sampled every 256 B for 8 s and transferred the profile twice (getSamplingProfile, then the raw
  stopSampling result back into the page) — over Playwright's 100 MB message cap when allocation ran high. — A larger
  pipe (not configurable in Playwright).
