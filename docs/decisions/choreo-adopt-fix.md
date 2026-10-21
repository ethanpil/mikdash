# choreo-adopt-fix — decisions

Fixes to choreo-adopt after its review (shots/choreo-adopt-review). Owner: src/sim/** only. Format: **Choice** — why
(source / reasoning) — alternative. ⚙ = reconstruction.

## 1. The altar top within one offering (medium) — fixed

- **A ram's two flour bearers and two wine bearers (Yoma 2:7: "the flour and the wine by two each") keep the order the
  limbs keep: the one whose place is farther in goes up first, the other 0.12 min (GAP) behind him, and the farther
  one comes away first** (g5/plan.js nesachim). The flour goes up by TP_SE along the pile's east face, so N1b (the
  northern place) is the farther and goes first; off by TP_NE, N1 no earlier than 0.06 min after N1b. The wine goes
  west along the top's south edge to the cups, so N2 (the western cup place) goes first and N2b comes back first, N2
  no earlier than 0.08 min after him. — The review's figure probe: 9 walk-throughs a date (min 0.013 m), all a ram's
  N1/N1b and N2/N2b. ⚙ the gaps.
- **g5.js's altar-top check now counts every walker through a man standing on the top (Z > 24: the east face and the
  cups at the SW horn), the same offering included, on all three dates of the rules, and asserts that a ram's two
  bearers were staged.** The old check skipped `a.tr.inst === b.tr.inst` and looked only at X > 227.5, so it could not
  see this case.

## 2. Kiddush at the kiyor: the head in the bowl (medium) — fixed

- **He stands turned 50° off the radial, his right side to the laver, the outer edge of his right hand and its instep
  under the nozzle (r 2.3 amot); root at u 2.754 / v −0.084 amot in the spigot's frame (g2/places.js `KID`).** —
  people's `kiddush` is a deep crouch: hands on the insteps 0.03 m before the feet, the head bone 0.32 m before them at
  0.64 m. Facing the axis (the old spot, r 2.4) the head sat at r 1.74 amot: in the bowl (r 1.71–1.87 there) and in the
  spigot pipe (r 1.86–2.3 at 0.73 m). A sideways offset alone (the review's 0.15–0.2 m) leaves the head at r ≈ 1.79,
  still inside. The stance came from a capsule search over people's joints at sizes 0.95–1.05 against world's profile,
  pipes, nozzles and the stopcock keys, with the man at the next spigot (30°) in the same stance: head ≥ 15 cm off the
  bowl, shoulder ≥ 2 cm off pipe and nozzle, ≥ 4 cm from the neighbour. Facing tangentially clears the laver better but
  his back then reaches the next man (the nozzles are 0.58 m apart; eight brothers sanctify at once, Tamid 2:1, as Ben
  Katin's twelve spigots were made for, Yoma 37a). ⚙ the stance; which hand the stream falls on (a stream is one
  point; Zevachim 19b has both hands on both feet).
- **He turns into the stance standing (0.06 min 'stand' at the heading), then crouches; the kiddush act is 0.06 min
  shorter, so every later time is unchanged.** — The Script turns a figure over the first 0.05 min of an act, so he
  had been turning up to 160° already crouched.
- **`places.kiyor.eastHeading` and `spotHeadings[i]` (additive) give the facing; terumat-hadeshen uses them instead of
  facing the axis.**
- **g2.js asserts it with people's joints** (PoseBuilder at the man's phase and size, carried by his figure's matrix)
  against world's kiyor geometry: head off the bowl and the pipes, shoulders off pipes and nozzles, the right hand
  within 12 cm of a nozzle, for every man found in `kiddush`.

## 3. 'knead' for the showbread (medium) — not staged; recorded

- **Beit Garmu's kneaders still kneel with a bowl; the showbread is not kneaded with people's `knead`.** — `knead` needs
  a working surface KNEAD.surface (0.78 m) high with the dough KNEAD.reach (0.42 m) on it. The kneading is outside
  (Menachot 11:2; Rambam TuM 5:7), so in the hall's chol half; the only table is world-4's, inside the showbread chamber
  (kodesh). The hall's rovadin are steps of 0.24/0.48/0.72 m with two amot of lower treads before the top one (world
  courts/moked.js), no kneading surface; people have no trough or table prop. choreo-adopt's log implied it was staged;
  corrected there. The world request below is renewed with a place.

## 4. The nazir's companion (low) — the diagnosis rejected; the cause found and fixed

- **The events the review cites are not the companion taking the meat.** nazir-companions#1 and #3 are C2, the
  basket-bearer (chambers-daily gives C1 slot 2k, C2 slot 2k + 1); (225.5, 363.6) is spot.C2 = ring 18 + (4.7, 0.5),
  where he stood with the basket from the party's arrival until the ram. The ram's meat is taken a step south of a
  hook's flayer, by pillar 0 or 7 (Y ≈ 380.6–382.8). The identical event ("09:43 g5-israelite#6 … nazir-companions#1
  (carry_shoulder) 0.184 m @225.5,363.7") is in the review's HEAD baseline: it predates choreo-adopt.
- **The cause: the party's waiting places east of the rings (O and AR at X+3.6, C2 at X+4.7; C1, AO by the Y 365.5 row)
  lie in G5's corridors — the X 209 / 225 columns and the half-way rows, each with its keep-right line 0.52 amah off —
  and ring 18's cell is boxed in by them on all four sides.** Plan-level probe (G5 walkers within 0.85 amah of a
  standing figure of a nazir set, every 0.01 min): 28 / 39 / 10 / 2 samples on 2026-11-02 / 04 / 06, 2027-06-15.
- **Fix: the three animals at ring 16 one after another (the chatat; the olah once the ewe is lifted; the ram once the
  lamb is lifted), the party waiting west and north of it (no G5 corridor runs west of X 209), coming down the west
  corridor (R_W) and C2 leaving by it; the nazir waits where he slaughtered.** NAZIR_COMBOS keep their shape (rA 0,
  rB ignored). — Ring 18's cell has no place a party of six can stand 0.85 amah off G5's walkers; the second ring
  only saved the olah's minutes, and the order stays chatat, olah, shelamim (Rambam Nezirut 8:2). ⚙ places. After: 2 / 0 / 1 / 0 samples, none of them the party (the limbs' salter
  on the ramp and one limb carrier at a table: 0.6 s each). g4.js asserts no G5 walker within 0.85 amah of the
  nazir, his companions or his animals while they stand in the court.

## 5. The 03:54 dawn spike (low) — not root-caused; no change

- **Not reproduced, and not a regression.** The review's three fires.js runs on this code: max 2.0 / 2.1 / 4.0 ms. Its
  heap-profiled run (gc.js) shows isolated single-frame maxima on both trees — this code 21.3 / 38.3 ms, HEAD's sim
  23.3 / 29.2 ms — with similar allocation per frame (night 4197 vs 4085 B/frame): a profiler/GC artefact, not this
  module. No code changed for it.

## 6. Shots that did not show their adoption (low) — re-taken

- g4-shofarot-coins, g4-golah-crank, g1-strike and g6-eat re-taken with the review's times and cameras
  (shots/choreo-adopt-fix/{low,high}).

## 7. Staging details (low)

- **(1) The tamid lamb stays in the flayer's arms until `cut.hang`, when lamb_hung appears** (it had vanished for
  2.4 s). g2.js asserts the lamb in arms at hang − 0.02 and on the hook at hang + 0.02.
- **(2) Under the muchni's axle he stoops in pour_low's bend (phase 0.3: knees bent, a hand on the knee, the jug's
  tilt not yet begun), not 'bow'.** — 'bow' at full depth keeps the head bone at 1.25 m, the axle's own height (2.6
  amot; its underside 1.17 m): he had passed through the axle. pour_low's head bone is at 0.96 m. He still shuffles
  through without steps (2.15 amot in 3.6 s): people have no stooped walk (request below); world's north opening
  would remove the duck. g2.js asserts head and shoulders below the axle's underside.
- **(3) The keys slab stays out of its place while he locks: one window from the lift to after the keys are back, at
  world's full opening (lift 1, 80°) so it stands by itself.** — Middot 1:9: "he finished locking, returned the keys
  to the chain and the tablet to its place". The review allowed either reading; the Mishnah's order decides it. ⚙ how
  far it is opened. g1-night asserts it open (> 0.95) at the Korban lock.
- **(4) The bowls are still hidden by mesh name** until world's `bowls()` lands (request standing).

## API (additive)

- g2/places.js: `places(…).kiyor.eastHeading`, `kiyor.spotHeadings[i]` (the facing at `east` / `spots[i]`).
- g4/sets.js: NAZIR_COMBOS entries all have rA 0 (ring 16) and rB 0; scriptNazir no longer reads rB.
- g1/plan.js: a `P.slab` window may carry a fifth element, its lift level (moked-night reads `w[4] ?? SLAB_UP`).

## Requests

- **world:** a kneading table (or a trough on a stand) in Beit HaMoked's chol half for Beit Garmu, its top 0.78 m
  (people's KNEAD.surface), near (213.6–216.2, 404.9–405.6), where the sim's two kneaders are; or confirm that the
  kneading is in the kodesh chamber and the sim will knead at `courts.moked.showbread.knead`.
- **people:** a stooped walk (head below ≈ 1.1 m) for ducking under the muchni's axle; a morsel of meat for `eat`
  (standing from choreo-adopt).
- **world** (standing): `bowls(bool)` on `heichal.shulchan.bread` / `.incoming`; the muchni frame's north opening;
  the kiyor's platform in the static colliders.

## Verification (2026-10-21, HD 4600, low tier unless noted; outputs in shots/choreo-adopt-fix/tests)

- `npx vite build --outDir .build-choreo-adopt-fix --emptyOutDir`: passes (removed). validate-schedule: 0 errors.
  coverage: no gaps (longest 7 min). g1/dev/plan-check all: no issues (three day types). nav-coverage --q low: 132
  targets, only the 2 known Heichal-roof failures (world).
- g5: adopt 9/9, the new altar-top check 0.0 s on 2026-11-02 / 11-06 / 06-15 (12 / 2 / 14 N1b/N2b tracks staged);
  deterministic; cost avg 0.20 / p95 0.40 ms. The review's figure probe (altar-top-probe.js, forced every 0.005 min,
  08:30–12:30): 0 events on 2026-11-02 and 2027-06-15 (was 9 and 9).
- g2 weekday and Shabbat: adopt all true, with "kiddush clear of the kiyor" (nine men: head 0.25–0.31 m off the bowl
  and 0.21–0.26 m off the pipes, shoulders 9.4–10 cm from pipe/nozzle axes, right hand 5.6–6.6 cm from a nozzle),
  "under the axle: head below it", "lamb in arms until it hangs"; ways 0 bad, no warnings; deterministic; cost avg
  0.13 / p95 0.22–0.23 ms.
- g1-night: adopt 22/22 (new: "slab open while he locks"); deterministic.
- g4: adopt 14/14 (new: "nazir party off G5 corridors"); nazirites 3/3, 1/1 staged; deterministic; G4 overlaps
  unchanged (the one known pair, courts-daily en-men 14:15); every planned cue fired once, none on jumps; Mount cost
  avg 0.37 / p95 0.6 ms. Nazir corridor probe (nazir-corridor-probe.js) before / after: 28 / 39 / 10 / 2 → 2 / 0 / 1 / 0
  samples on 2026-11-02 / 04 / 06, 2027-06-15.
- fires (dawn at 60×): max 2.0 ms over 1201 frames (avg 0.85, p95 1.2): no spike. g3, g6, shabbat-midday, jumps: ok,
  deterministic, no console errors.
- Shots (fix-shots.js) at low and high, 18 scenes each, all read: kiddush (east, west, front-left, side), the duck
  (from the frame's open south side), the lamb before / after it hangs, a ram's flour and wine bearers, the slab open
  at the Korban lock, the nazir's party at ring 16 for each of the three animals, and the four re-takes. The first
  high batch lost its WebGL context near its end (g1-strike and g6-eat blank, no coin-giver in 10:48–10:52 at high);
  those three were re-taken in a short high run (coins at 10:37), console clean.
