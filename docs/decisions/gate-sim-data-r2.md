# gate-sim-data-r2 — decisions

The independent gate re-check of gate-sim-data: Friday's leftover limb on Shabbat morning, and the midnight regression
test. Format: **Choice** — why — alternative. ⚙ = reconstruction.

## 1. Friday's leftover limb on Shabbat morning

- **Follow the Rambam, as the rest of the model already does: on Shabbat morning the leftover limb is moved to the side
  of the altar at the clearing (Tamid 2:1) and stays there until Shabbat ends. It is not pushed back into the fire.**
  Rambam TuM 1:7 says: "אברים של תמיד ... אין דוחין את השבת. אלא בערב שבת בלבד מקטירין איברי תמיד של ערב שבת. שהתמיד
  תחלתו דוחה שבת וסופו אינו דוחה". The Kesef Mishneh there reads "בערב שבת בלבד" as "by day only, not on Friday night"
  (Yoma 46a: Rav Huna, the halachah as Rava, the tamid's limbs override impurity but not Shabbat). In the name of the
  Ritva he adds that limbs not burned on Friday are brought up to the altar top on Friday night. They are not disqualified
  there and are burned after Shabbat. Pushing them back onto the pile on Shabbat morning would be the same burning that
  the untended Friday night (fats-burning, altar-night `fridaySunset`) already rules out. — The alternative was R' Meir in
  Yoma 46a ("עושה להן מערכה בפני עצמה ... ואפילו בשבת"). It is not the halachah (Rava's later ruling is), and following
  it would also force Friday night to be tended.
- **Staging (src/sim/choreo/terumat-hadeshen.js):** the fork-man still pushes the limb to the side at the clearing on
  Shabbat. The two tenders skip the push-back loop: they stoke by the tapuach and go to their waiting spots. The limb
  prop stays at its side spot from the clearing until sunset + 40 min ⚙ (`SHABBAT_LIMB_END`, about nightfall). After
  that it is hidden. Its burning after Shabbat is not staged. The 'second-pile' caption is now day-specific. On Shabbat
  it says the incense pile has eight se'ah of coals and that Friday's limb stays at the side (Rambam TuM 1:7). On
  weekdays the text is unchanged. Checked in shots/gate-sim-data-r2/limb-{before,after}-{low,high} and limb-day-low, all
  from the altar top's NE corner looking west at the side spot (222, 332.4). On Shabbat at 04:34, before the fix the limb
  was gone into the fire. After the fix it lies at the side through 11:00 and 15:30, and it is gone at 17:45. On a
  weekday at 04:34 it is back in the fire, before and after.
- **Texts (src/data):** second-pile gets `byDay.shabbat` with a summary and a description: eight se'ah for the bazichin
  (Tamid 2:5), and Friday's limbs stay at the side (Rambam TuM 1:7, Kesef Mishneh/Ritva). fats-burning gets
  `byDay.shabbat.description`. On a Shabbat civil date its window holds Friday night (untended) and Saturday night.
  "Put back on the new pile" is true only of a weekday morning, so the text now says so. On Friday's date the shared
  text stays true, because its morning is Thursday night's. The Mizbeach zone's services line (zones-content.js has no
  day type) adds "except Friday's on Shabbat morning". Swept for the same claim: clearing-altar ("pushed to the sides") is
  true on Shabbat. The night-turning and late-turning rows are absent on Friday night. altar-night's captions were
  already consistent. Nothing else says the limbs go back on the fire.

## 2. The midnight regression test (src/sim/dev/tests/midnight.js)

- **It records only after `ctx.bootTimes.shown` (plus 6 s) and judges each segment from the frame the date changes on.
  When setup picked the date, it judges every frame.** On the dev server the deferred world programs are shown about
  20 s after the first frame. Those frames took 300–800 ms with the sim at about 1 ms, and they landed in the first two
  segments. The clock jump that sets a segment up shows another hour's figures. That cost is GPU, not the plan, and the
  test does not judge it. A segment that never changes the date fails too, so the guard cannot pass empty.
- **It throws on failure,** as views.js does, so run.mjs exits 1.
- **The date picks are relative to the clock's date** (the next day, then the next Friday). A start on 2026-11-02 used to
  reach 11-05 by the 600× crossing, and the hard-coded `setDate('2026-11-05')` was then a no-op.
- **Diagnostics:** a segment that does not change the date reports its start and end date and minute, its frame count,
  speed and pause state. In one run on 2026-11-02, the 600× segment did not change the date. The cause was not found:
  nothing in the app changes the speed or pauses the clock on its own. Every later run crossed normally.
- **Measured (low, dev server, HD 4600).** The old test on 2026-11-02 gave `ok:false` with exit 0, from a 577 ms frame in
  the steady segment. The new test on a quiet machine passed both queries (2026-11-02: judged max 93 ms; 2026-11-06:
  93 ms). While other sessions held the CPU at 100%, three runs failed with judged frames of 100–1027 ms. In most of
  those frames the sim took ≤ 1.5 ms, so the cost was GPU and scheduling, and the test is right to report them. **Run
  it on an idle machine.**
- **The crossing frame's own sim cost** (a profile of `rt.entries` on the frame the date changes). Friday→Shabbat:
  43 ms in total. ketoret-morning took 15.2 ms, shabbat-showbread 12.7, altar-night 8.4, tamid-morning 4.5 and
  terumat-hadeshen 1.5. Wednesday→Thursday: 15 ms. These are `always` modules outside the plan job: their plan() builds
  in the first frame of the new date, as other modules read them through planOf. Moving ketoret-morning and
  shabbat-showbread into the plan job (planRank, with their readers handling a pending plan) would roughly halve the
  Shabbat crossing. It is left as a follow-up because it fits the budget when the machine is idle.
