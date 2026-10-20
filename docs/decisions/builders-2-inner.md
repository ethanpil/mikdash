# builders-2-inner — decisions

Scope: `src/world/altar/**` and `src/world/heichal/**`, applying site-model-2 (`docs/decisions/site-model-2.md`) and adding
what the simulation needs to place actors (anchors) and fires. Format: **choice** — why — alternative. ⚙ =
reconstruction. Shots: `shots/builders-2-inner/` (low and high). Supersedes the bullets in `build-altar.md` on the
small sovev ramp and the in-shaft hook rows, and in `build-heichal.md` on the chains ending at +48.

## Altar
- **The sovev branch is swept from `params.undersideZ` (+21) with faces 'esnu' when `params.solidToFloor === false`**;
  the yesod branch (`solidToFloor: true`) stays solid. — Zevachim 62b: the small ramps "go out from the kevesh". The slab
  has no west face: it is bonded to the kevesh's east face, whose waver already fades to zero there. Seen from below it
  shows its underside, south face (2.47 high) and east face, with the pavement open beneath. — Alternative: keep it
  solid to the floor (the old 7½-amah pier face).
- **Nanasin built from `shaftH`, `capH`, `topZ` and `hookRowsZ` (3 + 1 amot; rows +19.2/19.5/19.8); the interim hook
  rows leaded into the shaft are removed.** — site-model-2: on every reading the hooks are in the cedar (EK II 51). The
  hooks per row are unchanged (two toward each flaying gap, one on N and S ⚙).
- **Hook anchors use each pillar's south-face hook** (`altar.hook.<pillar>.<row>`, pos = the hook's crook, where the
  pierced hock rests; `stand` 1.3 amot south, facing north). — Rash and Bartenura put the three rows "on the side facing
  the tables"; the band between the tables and the pillars (5.6 amot) leaves the flayer room. — Alternative: the E/W
  hooks into the 2.7-amah flaying gaps (cramped for a carcass and a man).
- **Item anchors: pos = the item, `stand` = where the worker stands** (site amot), heading = the worker's facing.
  `altar.ring.<i>` (i = row × cols + col, rows from the altar, columns from the west, as site.js `positions`; shochet
  1.2 east, facing west — Tamid 4:1; `tamid: 'morning'|'afternoon'` on the rings site.js names), `altar.table.<i>`
  (the top's middle; worker on the north side, coming from the hooks). The old `altar.ring.r<row>c<col>` and
  `altar.marble-table.<n>` are replaced; `altar.ring.tamid-*` are kept as aliases with the same meaning (pos now the
  ring, the shochet in `stand`). Nothing in the tree read the old names.
- **Station anchors `station.<offerings.js STATIONS id>`: pos = the worker's standing point, `target` = what he handles.**
  The prefix lets the sim look any station up by its id, whichever builder owns the area. Stations with an `at` on the
  pavement keep it; `yesod-south`'s `at` is on the yesod, so the stand is on the yesod ramp's level run facing north and
  `at` becomes the target. The horn stations follow offerings.js's reading (blood "from the sovev"): the sovev's corner
  squares at +22, facing the horn. The band stations (rings, nanasin, marble-tables, tzafon) are served by the item
  anchors. — Alternative: element-box fractions only (the sim would land actors on top of horns and tables).
- **The kitchen hearth stands 1.9 amot WEST of `STATIONS.kitchen`; the station is the cook's place, facing it.** ⚙ — The
  dawn inspection route (`azarah.achsadra-route`) runs N–S along X 238.5, through the station point; a hearth there
  would block it. — Alternative: the hearth on the station point (the route walks through it).
- **Kitchen furniture, restrained** ⚙: one course of dry-laid squared hearth stones (`steps_stone`, 0.55 amah ≈ 26 cm —
  *fix*: was 0.36) round an ash bed with a stoking mouth to the east; a lidded copper cauldron seated on the stones over
  the north half ("set on the pot", the hearth stones of Yechezkel 24:3), its bottom and lower belly fire-blackened
  (*fix*); a copper machavat (flat, low rim, handle — Menachot 5:8) over the south half; a
  copper basin of cold water for the scouring with two pots set mouth-down to drain (Zevachim 11:7: "scouring and
  rinsing in cold"); a small stack of split billets. Copper, because a copper vessel a chatat was cooked in is scoured,
  not broken (Vayikra 6:21). +2 draw calls (copper, water). — Alternative: a kirah (two-pot stove, Shabbat 3:1); not
  chosen because the flames would be hidden inside it.
- **Fires the sim drives: `altar.kitchen.fire` (hearth, 0.24 m, on the bed under the cauldron — *fix*: was 0.4 m in the
  gap between cauldron and griddle) and `altar.beit-hadeshen.fire` (pyre, 0.6 m, smoke), both `schedule: 'service'`
  with intensity 0 until the sim calls `ctx.fx.setFire(id, v)`.** — Cooking is mostly by day and notar burning only by
  day (CLAUDE.md), so a cold hearth is the right default. The notar fire sits on the
  Beit HaDeshen heap ("in the court, east of the ramp" — offerings.js beit-hadeshen) with a few half-burnt brands of the
  last burning on its crown (detail ≥ 1). — Alternative: kind 'brazier' (no smoke, and a brazier vessel would be needed).

## Heichal
- **The ner ma'aravi is read from `heichal.menorah.params.nerMaaravi` (`lamp`, `countFrom`)**; flames run east → west, so
  `countFrom: 'west'` would map to `6 − lamp`. Day shot: only the second lamp from the east burns.
- **Chains from `params.topZ` (+62) to `params.bottomZ` (+26), heavier links: ≈ 10 × 7 cm outside, of ≈ 2-cm wire (wire
  radius 0.022 amah ≈ 1.06 cm) ⚙, stadium-shaped and pitched by their inner length 2(r·k − w); a larger end ring (r 0.12)
  to take hold of ⚙.** — Middot 3:8: the young kohanim climb them. The old links (7 mm wire) were jewellery-weight for
  17 m of climbing chain. Tube segments 3×6 / 4×8 / 5×10 by detail (≈ 1,230 instances, one draw call); shadows off as
  before. Anchors `heichal.ulam.chain-<i>` (south → north) on the floor under each, `foot` = the chain's lowest point.
  (*fix*: the first pass called this "1-cm wire" and built each link as a torus stretched ×1.6, which thickened the wire
  at the bends so neighbouring links cut 1.3 cm into each other — see builders-2-inner-fix.md.) — Alternative: keep the
  light links.
- **Gate curtain: the rod line is `wallFaceX + wallClearance + Drape.backReach(spec)`, so the deepest fold of the back
  face stays exactly 0.1 amah off the wall at any `open(f)`** (measured: X 163.100 gathered, 163.236 drawn). Its brackets
  now start at the wall face. — site-model-2 gives the flat sheet's box (X 163.1–163.27); a folded tefach-thick drape
  needs more depth, so the folds reach up to 0.6 amah east of it. — Alternative: flatten the folds to fit the box.
- **The lul's small curtain is built only when `params.smallCurtain`; `walkThrough: false` needs no collider** — the slot
  is 4 tefachim (0.32–0.38 m under every amah standard), narrower than the observer's 0.6 m capsule.

## Verification
- `npx vite build` passes. No console errors or warnings in any shot.
- nav-coverage (low): 127 of 129 targets pass from both origins. The 2 failures are the `roof` zone stand (+112), which
  is reached only by climbing the cedar posts at the aliyah door (site.js `heichal.aliyah.door` postsNote; Middot 4:5),
  so no walk reaches it. Not caused by this pass, which adds no colliders in the Heichal.
- 83 new anchors checked in-page: every `stand`/pos has a floor at its Z. Nav reaches all but the four horn stations,
  which are on the 1-amah sovev ledge (0.48 m, narrower than the nav capsule): the sim places actors there directly.
- `validate-schedule`: 0 errors (1 warning that predates this pass, chavitin-bakers zone).
