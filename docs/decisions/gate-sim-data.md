# gate-sim-data — decisions

Final QA gate, the sim and data findings: Shabbat texts, "Go" views that miss their rite, the chavitin bakers' view, and
the stall at every midnight. Format: **Choice** — why — alternative. ⚙ = reconstruction.

## 1. Day-type text (Shabbat and Friday night)

- **An event may carry `byDay: { [dayType]: { summary?, description?, sounds? } }`; `eventsFor(dayType)` returns one
  stable copy per day type with those fields replaced** (src/data/schedule.js). The validator checks the keys, that the
  day type is one of the event's, and that `eventsFor` gives the text. A byDay text must be true of the whole civil date
  of that day type (a window past midnight holds two nights). — Moving the clause into a weekdays-only event (two rows
  for one place), or "on weekdays…" wording in the shared text (true, but it tells a Shabbat visitor about something
  absent).
- **women-court on Shabbat:** no mother brings her birds; the description says why (Temurah 2:1: an individual's offering
  does not override Shabbat) and the 'doves' cue is dropped. The scene already stages no yoledet.
- **lamb-watered on Shabbat:** inspected "with no torch in hand, by the lamps lit before Shabbat" — Rambam BhB 8:12
  ("בלילי שבת שאין בידם אור אלא בודקין בנרות הדלוקין שם מערב שבת") applied by analogy, said so in the text; no source
  speaks of the lamb's inspection on Shabbat. tamid-morning.js's 'drink' caption picks the same wording on Shabbat.
- **coal-pan on Shabbat:** the summary said the spilled coals are swept into the amah; on Shabbat they are covered with
  the psachter (Tamid 5:5 "ובשבת היה כופה עליהן פסכתר"). The g3 caption already did this.
- **fats-burning:** its description (shown on Friday and Shabbat too) said the pile is turned until morning; it now adds
  that on Friday night no one tends it (Rambam TuM 1:7 with the Kesef Mishneh; Yoma 46a) — true of every night it shows.
- **Swept and left as they were** (true on Friday night and Shabbat as written): the night watch and Ish Har HaBayit,
  the sleeping guard, moked-night (the hearth: Shabbat 1:11), mesibah-keri (lamps and fire lit before Shabbat), the
  dawn immersion, Gevini, the lotteries, lamp-inspection-shabbat, the chavitin (Menachot 11:3), the muchni, terumat
  hadeshen, second-pile (eight se'ah on Shabbat), impure-east-gate, golah-wheel (Eruvin 10:14), kodashim-meal-night
  (Friday night: what was cooked before Shabbat), locking-up. Captions: g1 keyShabbat, g3 spillShabbat, night-watch's
  burn (not on Shabbat night) were already day-specific. Kept: entry-circuit's mourner on Shabbat — the Temple's
  mourners' gate on Shabbatot is in Pirkei deRabbi Eliezer 17 (no change; noted for review).

## 2. "Go" must show the rite — the watch check and the auto view

- **views.js part B "watch" (fails, does not warn):** for every event of importance ≥ 2 and every private-offerings
  event (the grouped rows), at 20/50/80% of its listed window: set the clock, `player.goTo(viewOf(ev), 'instant')` as the
  UI does, and require one of its choreo's drawn figures (within 18 m of its place, else 36 m) to be seen — two of head,
  chest and knees in the frustum and clear of solids (physics rays), ≥ 8% of the screen's height (≈ 17 m at 62°). An
  event of no participants (the nivreshet, the fire) is its place, one point of three. Ten G5 dynamic offering rows a day
  likewise, each its own figure. Weekday, Friday and Shabbat. It throws on any failure (run.mjs exits 1). The math is
  `lib/watch.js seen()`, shared with the auto view. — Pixel/ID-buffer tests (cost; decor that is not a collider — a lamp
  stand — is not caught by rays: composition was checked on shots).
- **The auto view (lib/watch.js `createAutoView`, installed by sim/index.js as `schedule.setAutoView`):** every event's
  `view` is a getter; after a choreo's own live view, it returns the data's view while from it the event's figures are
  seen (with a 25% margin), else a stand round the figure nearest the event's place (then the next two) that sees them,
  starting on the data view's side (rings of 12, 15, 9, 19, 24 amot, bearings every 20°; same level or below, nothing
  solid at +1 m, nothing within 1.5 m ahead). The figures are its choreo's within 18 m of its place (36 m in a lull),
  preferably on its own level (±5 m). Outside the event's window it is the data's view. Cached 2 s of clock and 1.5 s of
  real time per event (a paused clock must not keep a view computed before the figures were placed). Among a ring's stands
  the bearing nearest the preferred side wins unless another sees more figures. — Hand-placing every view (they go stale
  whenever the staging moves); always computing (would discard good authored framing).
- **What "seen" means** (lib/watch.js `seen`, shared by the auto view and views.js): two of a figure's head, chest and
  knees inside the frustum (5% margin) at the arrival's heading and pitch (−4°), clear of colliders, of door leaves (their
  boxes) and of the other figures (0.22 m upright bodies — the QA's "only dark backs"), and ≥ 8% of the screen tall.
- **The arrival:** player/goto.js steps aside (rings of 0.5 m out to 3 m, same level ±0.35 m, farthest from the figures)
  when a figure stands within 0.8 m (1.3 m lying) or a standing body comes within 6° of the first 2.5 m of the sight line.
  In Beit HaMoked that put the observer on a ledge facing a wall. lib/watch.js mirrors the rule (`crowded`) and the step
  (`arrivalOf`, approximated): a data view is judged from where the arrival will stand, and computed stands are not
  crowded. Door leaves are movables, not colliders: the rays also test their boxes (a stand looking through Nikanor's shut
  wicket into the chavitin chamber was taken at first).
- **Follow views** (schedule.liveView + `followView`): terumat-hadeshen follows the lone winner (kiyor → ramp → altar top
  → ash place), preferring the ramp's side; coal-pan follows the fire-pan man (ketoret-morning gazit 4) from behind him,
  down the ramp; metzora follows the metzora while he is in Ezrat Nashim (the metzora'im chamber, the way up) and in the
  gateway gives the data's view from the landing; vessels follows a bearer. G4/G5 dynamic rows: `watchPoint` keeps the step's spot while it sees the row's figure, else a stand round it.
- **Static re-aims (data):** second-lottery, third-fourth-lottery and the afternoon draws V.gazitLot [69, 381, 16] h90 —
  the nave's west end, looking east at the circle between the column rows, clear of its men so the arrival does not step
  aside (the old SE stand had a column and a lamp-stand in the frame; a first try inside the east door north of the nave
  was stepped aside from, onto a column). gazit-shema and outgoing-blessing keep V.gazit, moved to [85.5, 384, 16] h245;
  the
  song (weekday, Friday, Shabbat, afternoon) [234, 331, 16] h90 — Ezrat Kohanim 9½ amot west of the duchan on the axis,
  the Levites face on (old: north end, 19–40 amot off); gates-blasts and metzora from the Nikanor landing [267.5, 325.8,
  13.5] h289 (below the fifteen steps only the trumpeters' heads showed); chavitin-bakers [250, 323, 13.5] h130 inside
  the chamber by its door (old: the chamber's outside wall at 3 m; the validator allows a view in the event's own
  chamber); shabbat-musaf [234, 366, 16] h280 (its rings left, its flaying pillar right; old stand faced the empty
  western rings); terumat-hadeshen's base the head of the ramp; nivreshet [250, 333, 13.5] h268 from Ezrat Yisrael (the
  old stand had it 30° up, out of the frame); moked-night [212, 397.5, 16] h350 (the old stand was where the kohen back
  from the immersion lies). Removed constants they orphaned: V.slaughterNE, V.mokedLedges.
- **Rows listed only while staged (`lib/watch.js stagedRetime`, `lastNear`):** a module publishes the staged end of an
  event through `schedule.retime` — the last minute any of its scripts stands within 18 m of the event's place (sampled
  purely, 0.1 min), or the module's own moment: inner-clearing, into-heichal, ketoret-morning, ketoret-afternoon,
  menorah-lighting (g3), limbs-to-ramp, limbs-up (g2), bazichin (g6), friday-blasts-work, dishun-men (the men through the
  wicket), afternoon-lottery(-shabbat) (the officer leaving the circle). The staging keeps reading the data's window:
  `tPlan` in g2 tamidWindows / win(), g6 evWin, lotteries' ev(), gates' dishun (g3 windows() already did). The data's
  minutes are unchanged (coverage reads them). — Shortening the data windows (some stagings are fitted to them: they would
  shrink again); extending the staging (no source for what they did in those minutes).

## 3. The midnight stall

- **A new date in normal play re-plans the ranked modules (private-offerings, courts-daily, sanhedrin, nikanor-stations,
  chambers-daily) through the plan job, in ~8 ms slices between frames, as at boot: `PlanJob.restart(steps)` from
  `runtime.remap()`; until a module's plan is in, its plan() is null (no figures), and when the job is done they re-pose
  once.** courts-daily's own `time:date → setTimeout(build)` (a synchronous build in one macrotask) is removed. `planOf()`
  returns the pending (null) plan while the job runs — the job, never a frame, builds it. A screenshot boot (shot=1) and
  `?planjob=0` keep planning on demand, so shots and tests see the whole day at once. — Pre-planning the next date before
  00:00 (every planner reads ctx.time's date, zmanim and the schedule's resolved windows: a shadow context through five
  modules and the G4 register); keeping the old date's figures meanwhile (chambers-daily resets its troupes at the start
  of planning).
- **The planners yield every second arrival (courts-daily) and every second placement (G5)**, not every eighth / fourth:
  one step-advance took up to 70 ms (courtVisitors after the date picker); the results are unchanged (a yield does not
  change what is computed).
- **The staged-end search (lastNear) runs in the frame a new date's plan is built** (g3, g2, g6, shabbat-eve): coarse
  steps of 0.5 min back from the window's end, then 0.1 min forward through the last stretch found (a few ms).
- Who is hidden meanwhile: at 00:00 these modules stage nothing (the night meal ends at halachic midnight; the courts,
  chambers and offerings are by day), so the crossing is invisible; after the date picker, the courts' visitors appear
  1.2–1.8 s later, as at boot.
- **Measured, production bundle, low, HD 4600, normal play (the QA's drv.mjs midnight scenario):** the frame at the
  crossing — speed 1: 72 ms (was 753), 60×: 54 (690), 600×: no frame over 58 in the window (576); the date picker: 96
  (611); the worst frame anywhere in each window 90 / 67 / 58 / 96 ms. Dev server (src/sim/dev/tests/midnight.js):
  Friday → Shabbat at 60×: 86 ms (the frame's sim 58 ms: g3's Shabbat plan 22, g6's bread 17, g1's night 11); the job
  0.5–1.0 s of CPU in 42–89 slices over 1.2–2.6 s, its longest slice 26–57 ms. PlanJob.stats gains maxNext / maxNextId
  (the longest single step-advance).
- **Not changed: a screenshot boot (shot=1) still plans on demand,** so cues.js (shot mode, 600×) still shows one slow
  frame at 00:00 (817 ms there): the dev tests and shots need the day planned at once after setDate.
