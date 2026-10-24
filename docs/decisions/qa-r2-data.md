# qa-r2-data — decisions (src/data/**, tools/validate-schedule.mjs, tools/coverage.mjs)

Fixes for QA round 2, data finding DAT-R2-1. Format: **Choice** — why (source / evidence) — alternative.
Shots: `shots/qa-r2-fix-data/` (weekday 2026-11-02): `before/` (high), `cands*/` and `final-cands/` (candidate spots,
Go-instant at moments when the kohanim are there), `after/` (high, through the data: `src/player/dev/goto-frame.js`,
the UI's Go), `portrait/` (390×844, low).

## DAT-R2-1 — the Kodesh views looked along the Menorah's lamp row

The lamp row runs east–west (site.js `heichal.menorah` lampRow, the model's reading), so a view down the Temple axis sees it
edge-on, like a whisk (before/h11, before/ketoret-morning-view-h270). How broad the lamps look goes with |sin| of the angle
between the line of sight and the row: 0.35 from the old `V.heichal` [150, 330.5] h270, 0.54 from the QA's good frame
[137, 327.5] h237 (which loses the golden altar), 0.67–0.71 from the spots below.

- **New `V.kodesh` [146, 337.5, 22] h236 for ketoret-morning, ketoret-afternoon and the Kodesh zone stand**: the Menorah at
  −8° and three-quarters, the golden altar +7°, the incense man +3.5° and his friend +10° (both rites stage them east and
  NE of the altar: sim g3 places `goldEast`, `fAt`), the table +34° — so the Menorah, the altar and both men stay in a
  portrait phone's ±15° (portrait/p-km-give-kodesh-h236.png). It is the centre of a cell of the brothers' prostration grid
  (sim g3 `places.kneel`: X 143.6/148.4/153.2 × Y 333.6/336.2/338.8 north of the axis, all 18 used), 2.73 amot (1.31 m)
  from each of its four kneelers, just over the arrival check's 1.3 m from a lying figure (player goto.js ARRIVAL.clearLying).
  So a Go during Tamid 7:1's prostration (≈ sunrise+67) stays put and frames it: the brothers prone in front, the altar,
  the smoke, the Menorah (after/go-ketoret-morning-sunrise+67.15.png). Alternatives: `V.heichalNE` or [144, 337] for the
  incense too (closer, but 0.6 and 0.4 m from a kneeler; a Go at the prostration was moved to [140.5–140.9, 335–337.5],
  west of the brothers, and saw none of them: cands3/), or the east end [155.5, 339] h241 (clear of the grid, but the
  figures are 11–14 m off and the north wall fills the right third: cands/km-give-E-155.5-339-h241.png).
- **The old axis spot was the better frame for the prostration alone** (the aisle is kept free for it:
  cands3/km-5.15-oldV-h270.png), but the incense is the event's subject and the axis is exactly the edge-on line — dropped.
  `V.heichal` had no other users and is removed.
- **inner-clearing, into-heichal, menorah-lighting: `V.heichalNE` [142.5, 335.5] at h233 (was h225, and [140, 333] h225 for
  the lighting)**: h225 aimed at the Menorah and put the golden altar at +19–27°, outside a portrait phone's frame
  (portrait/p-old-ml-140-333-h225.png); h233 puts the Menorah at −8° and the altar at +11°. These three rites have no
  prostration in the Kodesh, so the closer spot keeps the lamp kohen on the stone larger than `V.kodesh` would.
- **Zone stand: `stand` → [146, 337.5, 22] plus a new optional `standHeading: 236`** (documented in the zones-content.js
  header): a stand had no heading, so the map's Go arrived facing the last walking leg — from the great gate, due west down
  the axis. The UI and the sim's viewOf fallback must pass it (requested); until then the stand alone does not fix the zone
  Go. Alternative: encode the heading as a fourth element of `stand` (breaks `[X, Y, Z]` readers).
- **validate-schedule.mjs now checks zone stands**: each `stand` lies in its own zone (the header's rule; all 67 pass), a
  `standHeading` is a compass heading and only with a stand, and the eye-ray lint runs on it. Negative-tested (a stand moved
  into the Azarah and a heading of 400 both fail).
- Not changed: the anchor `heichal.kodesh` [154, axis] h270 in src/world/heichal (not mine; requested again, now to
  `V.kodesh`); showbread-swap's [135.6, 337.5] h271 looks at the table, not the Menorah.
