# gate-people — decisions

Fixes the two art-direction findings of the final QA gate in area `people` ("Figures still read as stylised mannequins…",
"Sacrificial goats and sheep read as black box silhouettes…"). Format: **Choice** — why (source / reasoning) —
alternative. Builds on `people*.md`, `qa-r1-people.md`, `qa-r2-people.md` (still valid unless noted here).
Shots: `shots/gate-people/before/` and `after/` (app, `tools/shot.mjs`, the QA's three queries at `--q high` and `--q low`,
plus `z-*` narrow-fov views of the same spots in `after/`); `crops/` before/after crops; harness work in `wip/`.

## The root cause: the people's bump never shaded (affects both findings)

- **`pPerturb` (material.js) now takes the screen derivatives of the position unnormalised.** It was a copy of three's
  `perturbNormalArb`, which normalises them because three's bump maps are unitless and scaled by `bumpScale`. Every people
  pattern writes `pH` as a height in metres (cloth folds 3–6 mm, the box weave, pores, hair ridges, fleece locks, the
  Tzitz's letters), so the normal tilted by "metres per pixel" ≈ 1e-4: no relief from any pattern ever showed, only
  colour. That is a large part of the "smooth tubes", "no folds", "flat-shaded" look. The slope is held under 0.9 (42°).
  — re-tuning every `pH` to unitless numbers (would tie the relief to the view distance).
- **With relief live, terms near the pixel scale sparkled in the specular**: a new `P_NYB(P)` fades bump terms between 8
  and 4 px per period (P_NY: 4 → 2 px, kept for colour). The wool twill (0.12 → 0.05 mm), hair strands and ridges
  (0.4 → 0.18, 0.12 → 0.05 mm), fleece crimp (0.6 → 0.2 mm), short coat (0.5 → 0.2 mm) are lower and use it; the
  ketonet's box weave 0.45 → 0.18 mm (at full height the meshubetzet boxes read as quilting at 1 m).
- Not on low's LOD1 / LOD2–3 (no `P_DETAIL`): there the vertex colour carries the forms (below).

## People

- **Hands: LOD1 has five separate fingers** (`handLod1`, human.js): palm with the knuckle ridge, thenar pad, four
  fingers of two segments on their own bones in the relaxed cascade of LOD0, the thumb along the index. LOD1 is drawn
  ≈ 3–8 m on low and 5–12 m on high — the 'Go' views' distances; the mitten (LOD2+) is now only beyond. ≈ 255
  triangles a hand (mitten 100). — modelled fingers at LOD2 (≤ 5 px wide there).
- **Low tier: no helmet hair.** The hair/beard shells and the hairline fringe (pattern 23) are alpha-tested by the detail
  pattern code; programs without it (low's LOD1, all LOD2/3) drew them solid — an outer cap 4 mm proud of the hair with a
  pale band along the hairline. Those programs now collapse pattern-23 vertices (VERT_BEGIN). The cap itself carries the
  locks instead: LOD1 20 × 6 (was 12 × 5) with lock relief 0.4 (was 0.25) and **vertex-colour streaks** along the fall of
  the hair (every tier). The LOD1 shell/fringe keep the 12 × 5 grid.
- **Low tier: no ear disc.** LOD1 ears get LOD0's hollowed concha and rolled rim, a thinner rim (0.8 cm), 0.26 rad off
  the head (was 0.38) with the root 2 mm further in.
- **Hairline and beard tufts** (the QA's strand cards): small alpha-tested strand patches from inside the cap's edge running
  past the hairline (longer over the ears and nape, short and close on the forehead) — 26 at LOD0, 12 at LOD1, seeded per
  hairline; 18/10 along the beard's lower edge (hanging past it) and its cheek line. Same pattern 23 as the shells, so
  sparse at their tips, faded beyond ~6 m, and dropped where nothing alpha-tests. Single-sided like the shells (they lie on
  the head). — cross-quad cards standing off the head (spiky at mid range, double the triangles).
- **Facial planes and cavities: an analytic height/cavity field in the face pattern (19/25), not a baked texture.** In the
  face's own coordinates (units of hs): orbital recess and brow ridge, cheekbone, nasolabial fold with the cheek's fullness
  above it, philtrum ridges, vermilion border and fuller lower lip, mouth line, chin crease; full strength at LOD1 (26 × 18
  mesh, which loses everything under ~1.5 cm), a third at LOD0 (48 × 36 carries the forms). Cavities darker and less shiny
  (cavity shade works on every tier; the relief needs P_DETAIL). Brow and cheekbone shift per figure (vPSeed) on top of the
  continuous face morph. — the QA's 6–8 baked normal/cavity maps per head variant: a sampler and texture fetch in every
  figure program, a bake at load, and the variants would not follow the per-figure morph (`pMorph`), which is continuous.
- **Skin: T-zone sheen** — roughness 0.58–0.64 off the T-zone, ≈ 0.45 on forehead and nose (was 0.46–0.58 everywhere: a
  plastic gloss); the wrapped, red-shifted terminator (subsurface approximation, people-realism) is unchanged. Skin palette a
  little less orange at both ends (`#c49c80` / `#7e5940`, was `#c89c78` / `#86593a`): the research's olive to light brown
  (roles.js header); it read as one orange-tan under AgX.
- **Mantles: gravity folds from the shoulders** — the drape starts at the shoulders (start 0.2, was 1: below the chest),
  13 folds (was 9, ≈ 10 cm apart), crease occlusion 1.8× (`drape` option `ao`); **a hemmed edge ≈ 1–1.5 cm thick** (rolled
  bulge 8 mm down and 3 mm out at the hem, 6 mm at the front edges; was 4 mm). With the bump fixed, the wool's own fold
  layer shades too. The mantle's inner face stays the darker lining value. How the tallit was draped remains
  **reconstruction**. Not done: an arm-driven fold layer at the shoulder and wrist (would need the arm push's amount in the
  fragment — a varying more on 15 of 16 attributes' programs).
- **Robes: gather folds under the avnet and the belt, creases at the elbows** — drawn by the linen and wool patterns from a
  fold zone carried in uv.v (garmentBody `gatherY`: v = 20 at the belt's middle; armBody: v = 10 at the elbow; the
  pattern subtracts it, so weaves are unchanged): tight folds ≈ 2.9 cm apart from the belt's lower edge, dying out ~25 cm
  below, a softer blousing above (the ketonet "blouses softly at the avnet", people-realism; Rambam KhM 8:19 the avnet over
  the heart); wavy creases across the sleeve ±6 cm about the elbow. A girded garment's u is measured from its front centre
  (`MeshBuilder.tube` option `uPhase`, the tube run from a welded back seam) so the folds hang plumb where the rings narrow
  toward the belt. Static, not driven by the elbow's bend (that needs the bend per vertex: two more bone fetches). Faded
  before they alias (P_NY of 2.7 cm: gone beyond ~8 m), so relief only on detail programs.

## Animals

- **LOD0 out to 12.5 m on high** (`ANIMAL_LOD0_M` = 6 / 8.5 / 12.5 / 16 m by tier, scaled with the focal length; was
  0.6 × the figures' size on screen ≈ 5 m on high, 3 on low). 2–6 animals at an offering spot; each LOD0 goat ≈ 10.7k
  triangles, still counted against `MAX_HERO`.
- **Seeded coats** (roles.js `coats`/`pied`, system.js `makeTint`): goats black 40 %, black-brown 18 %, red-brown 22 %, pied
  20 %; the face and legs drawn in the same family. The Levantine black goat (Shir HaShirim 4:1, 6:5 "a flock of goats
  streaming down Gilead"; 1:5 "black as the tents of Kedar", goat-hair tents) with the speckled, spotted and brown animals
  of Bereshit 30:32–35 among them; any colour is fit for an offering. Weights and shades are **reconstruction**. Black is
  now 2.4 % albedo (was 1–1.5 %: it read as a black box); sheep keep their cream fleece and brown faces.
- **Pied patches in the vertex palette** (`pPied`, BEAST programs only): white patches in the animal's rest space, ≈ 30–40
  cm, more from the belly down, ragged edges; on every LOD and tier. The phase rides in tint.y ≥ 2 (unused by quadrupeds).
  — a fragment mask (no pied on low's LOD1).
- **A coat that reads**: the topline lighter and the belly, flank's lower edge and hanging locks darker in the vertex colour
  (`shadeCoat`: goats and the bull, every tier); goat hair roughness 0.62 (was 0.74); the sheen of the long and short coats
  held at a fixed 4–5 % grey in the coat's hue (three's sheen is albedo × pSheen: nothing for a black coat, yet black hair
  shines); the long coat's lock relief now shades (bump fix).
- **A catchlight in the animal eye** (pattern 27, as the human eye's: never under a pixel, dimmed as it widens).
- **A contact blob under each hoof on every tier** (`hoofPrints`, contact.js; `CONTACT[t].hoof`): the sun's cascades at
  8–12 m (and the figures' 2 cm shadow-depth push) leave a gap under a hoof, so the animals floated. One draw call (the
  existing contact-shadow mesh, now also on high/ultra with the body blob off there); a lifted hoof's blob fades.
- Not changed: the alpha-tested fleece shells stay removed (people-realism-fix: screen-door stipple); the fleece is opaque
  clumped geometry whose lock relief now shades.

## Cost (HD 4600)

- Triangles per figure LOD0 / LOD1, before → after: kohen 19968 / 3856 → 20112 / 4688; israelite 22224 / 5896 →
  22680 / 6872 (LOD2/3 unchanged). Goat LOD0 10705 (now used to 12.5 m on high).
- App, the QA's views (`after/*.log` vs `before/*.log`): see Verification.

## Verification
(2026-10-24, HD 4600, a machine shared with other sessions)

- App before → after, the QA's three queries (`before/{high,low}/`, `after/{high,low}/`, crops in `crops/`):
  - Low: draw calls 244 / 252 / 242 → 244 / 252 / 242 (unchanged); triangles 0.629 / 0.671 / 0.656 M → 0.629 / 0.673 /
    0.658 M.
  - High, slaughter d4: 1170 → 1180 calls (at both, the frame included a shadow-cache refresh), 7.59 → 7.70 M
    triangles. The two goats there are LOD0 now (9.5 and 12.6 m): one red-brown, one black.
  - The calls of the high gateway view swing 628 ↔ 1165 between runs of the same build: that is the sun's shadow cache
    re-rendering in the sampled frame, not people.
- `tools/warmup-check.mjs`: ALL PASSED. Compiled / first frame: low 19.6 / 19.7 s, medium 35.2 / 35.6, high 47.8 / 48.8,
  ultra 59.5 / 60.6. qa-r2 measured low 17.1–20.7 s on this machine.
- `src/people/dev/compiletime.mjs --cold`, HEAD material vs this one (solo kohen / goat, low / medium): 5.3–7.8 s vs
  5.5–9.1 s, with an outlier at 17 s. Within the run-to-run noise of the shared machine. The pied noise is evaluated once
  per vertex, in BEAST programs only.
- Sim harness (`--q low`): jumps "t=d3" deterministic, no diffs; g5 "t=sunrise+150" deterministic, 0 missing, adopt ok;
  views 172 ok (the 3 known data-owned blocked views); budget ok.
- `validate-schedule.mjs` / `coverage.mjs`: no gaps (longest 7 min).
- People: `propcheck.mjs` bad 0; `covercheck.mjs` all clean; `reach.mjs pair` 0.00 cm; `geotime.mjs` ok (atlas 8924 frames;
  clips untouched).
- Harness close-ups (`wip/`): LOD1 hands, ears side-on on low, hair and tufts, avnet gather (`g4/`), the bump A/B
  (`bump/pre-*` vs `bump/fix-*`), pied and seeded coats (`an3/`), the animal catchlight, hoof blobs (`h3/h-hooves`).
