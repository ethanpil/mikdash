# data-3 — decisions (schedule.js, zones-content.js, validate-schedule.mjs, coverage.mjs)

The choreography groups' data requests, and Shabbat activity in the Azarah between the services.
Format: **Choice** — why (source / evidence) — alternative. ⚙ = reconstruction. Shots: `shots/data-3/` (low tier).

## Views and places requested by the choreography groups (each checked with a shot)

- **G1 moked-night: `V.moked` [210.75, 396.5, 16] heading 0, in the kodesh half looking north** — the hearth, the
  sleepers on the chol floor and the elders on both ledges in one frame (moked-night.png). An observer standing in the
  kodesh half is fine; only sitting and sleeping are not (Yoma 25a) — the old spot by the keys slab looked west into
  the ledges.
- **G2: terumat-hadeshen [233, 277, 16] h320 (moved 3 amot east in data-3-fix, below); lamb-brought [210.5, 399.8, 16] h205; lamb-watered [217.5, 387.5, 16] h270;
  tamid-slaughter [209.8, 344.2, 16] h40; tamid-afternoon [217.8, 344.2, 16] h40; tamid-blood [239.5, 332.5, 16] h305**
  (choreo-g2-altar-fix.md). The last four are in G2's log though not in this task's list; the shots show the binding
  from the south-west and the receiver side-on at the NE corner. `V.slaughterNW` lost its last user and is removed.
- **G2 timing: tamid-blood starts at sunrise + 3, when tamid-slaughter ends (was + 4), so the blood is not held between
  the windows; inner-clearing now ends at sunrise + 3 (was + 4)** — Yoma 33a puts the five lamps before the tamid's
  blood, and the validator keeps inner-clearing ending before the blood. G3 reads only the window's start
  (g3/morning.js `W.IC[0]`) and its five lamps are done ≈ sunrise + 1.4, both men out ≈ + 2.5 — leaving the blood at
  + 4 (the request unmet).
- **G3 magrefah: view [196.5, 302.5, 16] h5, pos the magrefah's landing [196.3, 314.7, 16] (g3/places.js)** — from the
  south between the muchni and the altar's west face, the throw and the kohanim at the Ulam steps in view (G3's own
  alt shot); the old [186, 290] h40 looked into the muchni's frame.
- **G3 ma'amad: `V.maamad` [253, 389.5, 13.5] h200, the north end of its place looking over it to the altar** — the old
  spot stood inside the crowd facing Lishkat Pinchas' wall.
- **G4 sanhedrin [46, 381, 16] h90** (just inside the chol door, facing the semicircle) — the old [68, 381] stood behind
  the benches.
- **G4 court-in-chel: pos [37.75, 381, 11] (the rows on the Gazit flight's steps), view [22, 379, 0] h82, description and
  sources (Sanhedrin 11b; Tosefta Sanhedrin 2:6)** — the frontal view up the flight shows the rows facing the Mount and a
  questioner at its foot (court-in-chel-B.png). It stands in the outer lane of the circuit's west side; a spot further
  west meets the west stoa ⚙ — the south-west three-quarter view [22.5, 371] (rows cut by the flight's parapet).
- ~~G4 entry-circuit [295.3, 239.3, 0] h260, the row view of station 3~~ — reverted in data-3-fix to the old
  [290, 225, 0] h317 (below).
- **G4 beit-garmu [206.5, 404, 16] h100, in the chol half west of the keys slab** — the hearth, both kneaders, the shaper
  and the showbread chamber's door in one frame (beit-garmu-A.png). Not the spot north of the hearth (G4's fix shot):
  there the north-east corner chamber hides the shaper and the second kneader (beit-garmu-B.png).
- **G5 altar-limbs [217, 266.5, 16] h0 and bird-offerings [229.8, 288.6, 16] h2** — g5/geo.js `V.ramp` / `V.sovev`, the
  module's own "Go" spots (the fix log's [229.5, 295.5] h345 was superseded in the code). **bikkurim-late [200.2, 289,
  16] h2**, the set-down place south of the SW horn (as G5's fix shot).
- **G6 friday-blasts-work/holy [216.3, 261.2, 36] h78; showbread-swap [135.6, 337.5, 22] h271; bread-warm [171.0, 323.6,
  22] h270** (choreo-g6-shabbat.md). The swap is over by T + 3.05, so the shot is at T + 1.5.

## Data

- **Counts aligned with G1's staging: dawn-immersion, first-lottery, torch-inspection and lamp-inspection-shabbat show
  five kohanim; moked-night's young kohanim 20 → 5** — G1: the hall's floor as built holds four sleeping places, five
  immerse, draw the first lottery and walk the inspection. The notes still say the sources give no number. moked-night
  was not in the request list; it is the same review finding.
- **Sources: shabbat-musaf + Rambam TuM 4:9 (the morning's winners at the same tasks); bazichin + TuM 4:10–11 (not eaten
  before the frankincense, salted; after the musafim by two); showbread-divided + Yoma 39a and TuM 4:12** — each with a
  sentence in the description, so the citation says what it supports.
- **chavitin-bakers zone 'lishkat-chavitin'** (its pos was already there: the validator's one warning is gone).
- **zones-content har-hamishchah stand = site.js `params.groundEye` X/Y, with Z the ground under that eye**
  (groundEye Z minus the eye height kohenEye − kohenStand) — a stand's Z is the floor stood on; 1 amah east of the
  arrangement (was 3 east of the kohen's eye).

## Shabbat between the services (≈ 09:10 to the afternoon lottery)

The Azarah had no figure: individuals' offerings do not override Shabbat (Temurah 2:1), the Sanhedrin sits in the
Chel, and the scheduled work ended with the division of the showbread.

- **showbread-eaten** — re-scoped in data-3-fix to the Kohen Gadol's loaves, sunrise + 190 → 8.1 h (below). The first
  version (both watches eating their shares through the late morning, sunrise + 190 → 6 h) contradicted Yoma 39a's
  bean's worth and G6's staging, in which each man eats his share at the division.
- **shabbat-altar-day (Shabbat, sunrise + 166 → 8.3 h, choreo altar-night): the tamid's and the musaf's limbs burning,
  one or two kohanim now and then tending the great pile with forks** — Vayikra 6:6; Rambam TuM 2:1, 2:4 (a pile kept
  only for the fire; Yoma 45a); Rambam MK 4:3 (their burning overrides Shabbat, not put off to the night); Tamid 2:1,
  Rambam TuM 1:6 (forks, turning). 'reconstruction': who tended it by day is not recorded. It starts after the
  bazichin (their men are on the altar until then) and ends before the afternoon crew takes the altar. Being
  intermittent, it counts as LOW in coverage.mjs (data-3-fix), so it cannot carry the court by itself.
- **No separate "two watches in the court" event** — no source says what the watches did between the services beyond
  the division and the eating of their shares, which showbread-divided covers; the Levites at the gates (gate-levites) and the Sanhedrin in the
  Chel (court-in-chel) already run on Shabbat.

## Tools

- **coverage.mjs: a court-by-day check — from sunrise to sunset on every day type some ACTIVE event in the Azarah's own
  zones (the open court, altar, ramp, Ulam, Heichal, Ezrat Yisrael), no gap over --max** — the old check counted the
  Mount and Ezrat Nashim, so the Shabbat midday gap passed. Worst court gap 7 min (8.4 → 8.5 h, before the afternoon
  tamid) — not counting LOW events (the ma'amad), which would hide an empty court behind a standing delegation. The
  Gazit counts only by an allow-list of its holy-half events (data-3-fix, below).
- **validate-schedule.mjs: order bazichin / showbread-divided → showbread-eaten, bazichin → shabbat-altar-day →
  tamid-afternoon; showbread-eaten in the Kohen Gadol's crew** (data-3-fix took it out of the watches' crews and added
  showbread-eaten → afternoon-lottery-shabbat).

## Verification (2026-10-20, HD 4600, low tier)

- `node tools/validate-schedule.mjs`: 101 events, 0 errors, 0 warnings (the chavitin zone warning is gone).
  `node tools/coverage.mjs`: no gaps; longest 7 min (the court check, 8.4 → 8.5 h). Without the two new events the court
  check fails on every date (Shabbat 218–386 min), which the old check passed.
- `npx vite build --outDir .build-data-3`: passes (directory deleted).
- `node tools/nav-coverage.mjs`: 132 targets; the two failures are the pre-existing Heichal roof (reached by the cedar
  posts) — every new view and the Har HaMishchah stand are reached.
- Sim harness, every test in src/sim/dev/tests (g1-night "t=n3"; g2 weekday and Shabbat; g3; g4; g5; g6; jumps; cues;
  jumpto; dates; zones --keep-ui; night; patrol; visual; budget; clearing; firstnight; gc; helpers; initcost; navwest):
  all `ok: true`, no console errors. g1-night: deterministic on the three dates, only the known 00:00 wrap pop on Friday
  and Shabbat. g2: deterministic, faces 0, hand-over gaps 0; its two "ways" findings are gazit-shema men on the Gazit's
  column plinths (known, choreo-g2-altar-fix.md). g3: all 13 jump-to-event headlines (inner-clearing with its shorter
  window). g4: cues 55/55, 81/81, 1/1. g5/g6: no missing or extra cues, none on jumps. cues: 296 shalom-call = night-watch's
  295 keys + torch-inspection's greeting.

## Review fixes (data-3-fix)

Shots: `shots/data-3-fix/` (low tier). Review shots: `shots/data-3-review/`.

- **showbread-eaten re-scoped to the Kohen Gadol's loaves: sunrise + 190 → 8.1 h, 'reconstruction'; participants the
  Kohen Gadol and six kohanim eating with him ("who and how many is not recorded")** — the Kohen Gadol always takes half
  of the loaves each watch has won, never a broken piece (Rambam TuM 4:14, checked on Sefaria; Yoma 17b: "half to Aharon
  and half to his sons", and the Rabbis agree a broken piece is not fitting for him), i.e. six of the twelve, each of two
  tenths of fine flour (Vayikra 24:5): the only bread large enough to take hours. Eaten by male kohanim in the court by
  midnight (Rambam MK 10:3, 10:7–8), standing (BhB 7:6); he takes without waiting for a division (MK 10:18). The
  watches' bean's-worth shares (Yoma 39a) stay inside showbread-divided, where G6 stages each man eating his share. The
  window ends when the incoming watch gathers for the afternoon lottery (validator: showbread-eaten →
  afternoon-lottery-shabbat), so the court has a group continuously from the division to the lottery. The id is kept:
  G6's `mm-eat` caption key of the same name is only a caption key (sim.caption id, not a schedule link). Taken out of
  the outgoing/incoming-mishmar crews (the eaters are not the watches); kept in the Kohen Gadol's. — Rejected: keeping
  the watches eating through the late morning (contradicts Yoma 39a and G6); ending at midday (leaves 11:23–13:17 to
  an intermittent figure).
- **coverage.mjs: intermittent events count as LOW** — shabbat-altar-day, late-turning and night-turning (a figure only
  now and then). With showbread-eaten cut back to 6 h the court check now fails on every Shabbat (115–149 min; scratch
  run), where before shabbat-altar-day passed it. The night still has no gap over 10 min without the two turnings.
- **coverage.mjs: the Gazit counts for the court only through an allow-list** — second-lottery, gazit-shema,
  outgoing-blessing, third-fourth-lottery, afternoon-lottery, afternoon-lottery-shabbat (the holy half). The Sanhedrin
  (chol half, outside the Azarah) no longer fills the weekday court by itself. An unknown id in the list fails the run.
- **entry-circuit view back to [290, 225, 0] h317** — it frames station 3's prostration row at its centre (≈ 9 m) and
  the south lane crossing. Measured on the low tier (2026-11-02, 2026-11-07, 2026-06-21; every 4 min from sunrise + 10
  to sunset − 20; courts-daily figures within 35 m and ±45°): old view 33–36 % of the window, the row view 32–34 %, seven
  other spots along the south lane, the eastern gate and the western Chuldah junction 21–41 % — no fixed spot does
  materially better, and the old view is as empty at 4, 6 and 8 h as the row view (entry-old-d4/d6/d8.png). The cause
  is the stream's density on a ≈ 590 m circuit, not the spot: requested from G4 a live view (as g5/dynamic.js does) or
  a denser stream. The row view stays on G4's live "Prostrating opposite the repaired breach" rows.
- **terumat-hadeshen view [236, 277, 16] h320 (3 amot east)** — the ramp's flank fills less of the frame, the heap is
  nearer the centre and the brothers waiting by the kiyor stay in view (terumah-E3-43 / -41 / -39.5.png against
  terumah-cur-43.png). The winner on the altar top stays small from any floor spot (views carry no pitch). Further
  south-east (237, 273) puts the wood stacks in the foreground.
- **lamb-brought view unchanged (G2's request)** — the review's finding that it frames the fetch only for the first
  ≈ 2 min is returned to G2 as a request (shorten the window to the fetch, or let the view follow the lamb out through
  the Moked gate).

### Verification (data-3-fix, 2026-10-20, HD 4600, low tier)

- `node tools/validate-schedule.mjs`: 101 events, 0 errors, 0 warnings. `node tools/coverage.mjs`: no gaps, longest 7 min
  (court 8.4 → 8.5 h); events active 90, low 9, none 2. Scratch run with showbread-eaten ending at 6 h: the court check
  fails on all 7 dates' Shabbat (115–149 min).
- `npx vite build --outDir .build-data-3-fix`: built (directory deleted). `node tools/nav-coverage.mjs`: 132 targets,
  only the two pre-existing Heichal-roof failures; the moved terumat-hadeshen and restored entry-circuit spots are reached.
- Sim harness, 22 runs (g1-night; g2 weekday and Shabbat; g3; g4; g5; g6; jumps; cues; jumpto; dates; night; patrol;
  visual; budget; clearing; firstnight; gc; helpers; initcost; navwest; zones --keep-ui): all `ok: true`, no console
  errors or warnings. g1-night deterministic on 3 dates; g2 faces 0, hand-over gaps 0, the same two gazit-shema plinth
  "ways"; g3 all 13 jump-to-event headlines; g4 cues 55/55 and 81/81; g5/g6 no missing cues, nothing on jumps, G6
  hand-overs 0; cues 296 shalom-call (295 keys + the greeting), no doubles.
