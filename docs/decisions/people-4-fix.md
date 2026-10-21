# people-4-fix — decisions

Fixes to people-4 (`people-4.md`) from its review (`shots/people-4-review/`). Format: **Choice** — why — alternative.
Shots: `shots/people-4-fix/` (finals `lineup-{low,high}-{close,medium}-*.png`; work in progress in `wip/`). Where this
log and `people-4.md` disagree, this log wins.

## Figure scale for poses that meet a partner or a fixture

- **`Actor.setScale(s | null)` (clamped 0.8–1.2; null = back to the seeded size), `spawn({ scale })`,
  `spawnAnimal(kind, { scale })`; free props ignore it.** — Every actor draws a size from its role's range (kohen
  0.95–1.05, Israelite 0.94–1.05) and the whole pose scales about its feet. `wave_under` and `wave_basket` were made at
  scale 1, so in most seeded pairs the kohen's palms landed in the owner's hands or a hand's breadth below them
  (`src/people/dev/reach.mjs pair`: up to 12 cm, 88 % of seeded pairs off by more than 2 cm). Nothing public could set
  the size. — Making the clip adapt per pair: clips are baked per rig, not per actor.
- **The rule, written at the constants: the tenufah pair at ONE scale s (`kohen.setScale(owner.scale)`, or both 1),
  `WAVE_UNDER.partner · s` apart; an operator at a fixture whose geometry is in metres (CRANK, WINDLASS,
  WINDLASS_RAISE, KNEAD) at `setScale(1)`.** — Scaling the pair as one keeps the contact exact (`reach.mjs pair`:
  0.00 cm off the scaled design over the whole grid). The windlass and knead stations had the same latent dependence
  (±5 % moves the fists 4–9 cm), so they are documented too. The lineup now follows the rule (`&p4seeded` shows the
  old mismatch).

## The metzora's rent (Vayikra 13:45)

- **A real opening: when the tunic is rent, its body tube starts at the front centre, so the tube's seam is there, and
  the seam is parted along the V (`rentMap`, through a new additive `MeshBuilder.tube` option `thMap`). The cloth within
  0.45 rad of each edge gathers toward it. Rows are added so the V closes exactly at its foot (`rentRings`).** — The old
  rent was a skin patch laid 1.2 mm in front of the garment; the cloth showed through it as a lozenge, a band and a
  diamond on both tiers. — Cutting triangles out of the tube: a jagged hole at the tube's 2–4 cm grid, wider than the
  V at its foot and narrower at its top.
- **Behind the gap, the chest is a curved skin strip 7 mm inside the cloth, reaching 1.2 cm under each edge and darker
  where the cloth overhangs. The torn lips are laid on the tube's own edge vertices, frayed by up to 2 mm at LOD 0 and
  turned out a little.** The neck-to-chest join has no hard step.
- **Unkempt hair (`wild` > 1) is held to the mass:** lock amplitude is capped at ±9 %, calm toward the long-hair sheet's
  side edges, and those edges are tucked in toward the neck and shoulders. The sheet gets its inner face (LOD 0–1), so
  from the front the hair beside the neck reads as hair falling behind the shoulder, not as a sheet seen edge-on (the
  "floating shards"). The nazir's hair is unchanged.

## The atifah (mourner, menudeh)

- **A new archetype `mourner` (the Israelite with the head-cloth wound as the atifah); roles `mourner` and `menudeh`
  use it. The cloth hugs the head and the sides of the face down to the beard, from under the cap's edge (no gap),
  then falls round the neck to the shoulders and back. A fold of it lies over the mouth, from under the nose to the
  chin.** — Moed Katan 24a: "any wrapping not like the wrapping of the Ishmaelites is no wrapping; Rav Nachman showed
  it: up to the sides of the beard". Rambam Avel 5:19: the mourner winds part of the cloth that covers his head "a
  little over his mouth" ("al safam ya'teh", Vayikra 13:45; Onkelos "like a mourner"). The old figure was the short
  Israelite head-cloth recoloured: a cap and two lappets with gaps at the seams. The menudeh's wrap stays
  **reconstruction** (Moed Katan 15a leaves it open). — A mask group on the Israelite figure: every Israelite would
  carry the hidden wrap (≈ +10 % vertices in crowds); the archetype costs nothing for anyone else (the mourner is
  19.4k / 3.4k / 0.74k / 0.35k triangles, ≈ +0.5 % on the Israelite).

## Props

- **`eimurim`: re-laid so every piece is at least 1.5 cm inside the basin wall.** For a sheep, the alyah fills the back
  half, the kidneys sit side by side in front with the liver lobe on the right and the caul folded over them; for a
  goat, everything is spread over the floor. (`eimurim-basin.mjs`: 0 vertices outside, against 256 before; nearest
  1.65 cm from the wall.) The kidneys and the liver are smooth, glossy, unpatterned organ (PAT.NONE), not the marbled
  cut-muscle pattern that read as steak. The alyah is cut off flat at its root, with the cut face sized to that section
  (the old face stood up out of it as a pink blade).
- **`sal_matzot` tray grip [0, −0.02, 0.1]: the 42-cm basket is held 10 cm further out and 2 cm higher.** The back wall
  now clears the belly and the floor sits on the fingers (profile shot). The basket's size is kept: it holds two piles
  of ten (Menachot 76b).
- **`clay_pot_broken`: six shells cut from the pot's own profile (`POT_PROF`, `sherd`).** Each has a 4.5 mm wall, a
  sooted outer face (by height, as on the whole pot), a plain inner face, ribbing on shoulder pieces, and a paler,
  redder fresh break all round an irregular outline. The pieces: the rim with its strap handle lying on its side
  (handle up), the round of the base, wall pieces lying concave side up, one convex side up, one tipped on an edge.
  Zevachim 11:7.
- **The flaying skirts are turned inside out: the pale flesh side outside, the fleece or hair inside, and a roll of
  fleece or hair at the free hem.** A hide peeled downward from the hind legs (Tamid 4:2) turns inside out as it goes.
  This applies to every kind, including the existing `carcass_flaying`.
- **`razor`: one blade.** Its back is straight on the handle's line and its edge swells in a curve into a blunt end.
  It is 1.8 mm thick at the back, ground thin to the edge, with a bright bevel and a bronze bolster. The form is still
  **reconstruction**.
- **`measure` (the isaron): the heap's flour pattern is laid flat from above (planar uv).** The ellipsoid's own uv
  converged at its pole. Note: the review's pinwheel shot (`h2-measure.png`) is the bent kohen's migba'at seen from
  above; the measure is lower, in his hand. The heap itself is smooth (`wip/s-measure-top.png`).
- **`hide_goat`: a hide, not a slab.** Its outline has flaps for the four legs and the neck and the stub of the tail.
  It is folded once along the backbone, hair outside, the upper layer settling onto the lower. A matte shag of broad,
  overlapping locks runs from under the edges onto the floor. Shoulder and free grips are as before.
- **`dough` (new; free): about an isaron's worth, a soft mound pushed out long, a heel-trough, the far edge folded back
  in a ridge, a dusting of flour.** It lies on the KNEAD surface, KNEAD.reach ahead; the kneader is at its +z. The lineup
  puts it on the `&p4fix` table, and G4 should put it on its trough or table.

## Requests (added)

- **G5 (private-offerings):** for tenufah and the bikkurim, `kohen.setScale(owner.scale)` and stand the pair
  `WAVE_UNDER.partner · owner.scale` apart (or `setScale(1)` on both).
- **G4 (chambers-daily, g4/sets.js):** `setScale(1)` on the Golah operator (`crank`) and the kneaders (`knead`); a
  `dough` prop KNEAD.reach before each kneader on the surface. Mourners and the banned as roles `mourner` / `menudeh`
  (they now draw the wrap; `setGarb('black')` on a plain Israelite gives black clothes with no wrap).
- **The sim (g1 and wherever windlass / windlass_raise are staged):** `setScale(1)` on the windlass operators.

## Verification (2026-10-21, HD 4600; other agents' sessions running alongside)

- `npx vite build --outDir .build-people-4-fix`: passes (removed).
- Node checks:
  - `propcheck.mjs`: 99 props × grip × hand × LOD, no NaN, no error.
  - `geotime.mjs`: every archetype incl. `mourner`; atlas 8468 frames, unchanged.
  - `reach.mjs pair`: 0.00 cm off under the rule, against 12 cm worst for seeded pairs.
  - `shots/people-4-review/tests/eimurim-basin.mjs`: 0 / 0 vertices outside.
  - `tools/validate-schedule.mjs`: 0 errors, 0 warnings. `tools/coverage.mjs`: no gaps (longest 7 min).
- Sim harness (`src/sim/dev/run.mjs --q low`), every test ok; logs in `shots/people-4-fix/sim/`:
  - g1-night "t=n3": deterministic on all three dates, nothing failed.
  - g2 "t=alot-60" and g3 "t=sunrise+40": deterministic.
  - g4 "t=d3": deterministic on three dates, no missing cues, the one known close pair.
  - g5 "t=sunrise+150": ok, 0 missing.
  - g6 "date=2026-11-07&t=07:30": deterministic.
  - shabbat-midday "t=d4": 0 samples wrong.
  - jumps: deterministic, no diffs.
  - No console errors.
- `tools/nav-coverage.mjs --q low`: 132 targets, only the 2 known Heichal-roof failures. The first run timed out booting
  while another agent's render session held the CPU at 100 %; the rerun used `--timeout 580`.
- People harness (`&rows=p4&p4fix`), low and high, console clean: `lineup-{low,high}-close-*` (tenufah at s 1.05 /
  0.94, bikkurim at 0.95, knead with dough, crank, eimurim held and free, sal_matzot from above and in profile, the
  metzora's rent and hair, the mourners' wrap, flaying, hides, sherds, small props) and `lineup-{low,high}-medium-*`
  (rows J, K, L).
- App (`tools/shot.mjs`, `?debug=people&rows=p4`, sunrise + 2 h), `app-{low,high}-*.png`:
  - Low: 41–44 fps, 195–196 draw calls, 0.49–0.64 M triangles.
  - High: 21 fps.
  - High logged "THREE.WARNING: Multiple instances of Three.js being imported" on the dev server only. The same view
    from the production bundle (`--prod`, `wip/app-high-KL-prod.png`) is clean, so it is Vite re-optimising its
    dependencies when the high tier first loads, not people code.
