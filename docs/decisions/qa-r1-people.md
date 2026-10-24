# qa-r1-people — decisions

Format: **Choice** — why (source / reasoning) — alternative. Fixes PPL-1 … PPL-6 of the first QA round. Builds on
`people.md`, `people-realism*.md`, `people-3*.md`, `people-4*.md` (still valid unless noted).
Shots: `shots/qa-r1-fix-people/before/` and `after/` (app, `tools/shot.mjs`), `wip/` (people harness, `src/people/dev/views.mjs`).

## PPL-1 — faces, beards, hair, skin

- **The beard runs up in front of the ear as the sideburn and joins the scalp hair** (`beardTop`, `BEARD_PHI` in human.js):
  its top edge at the sides reaches eyeY + 3 cm, over the hair cap's side edge (eyeY + 1.4 cm), and its back edge stops in
  front of the ear (1.45 rad), then follows the jaw's angle back below the ear. The sideburn thins to the skin at its back
  edge. — A full beard that grows into the sideburns is the ordinary male beard (Vayikra 19:27 forbids destroying the
  corners of the beard; adult Jewish men of the period wore full beards — reconstruction of its exact line). Before, the
  shell ended behind the ear with a straight hard top edge and a gap to the hair: at 3–15 m it read as a cloth mask. —
  alpha-tested strand cards (stipple at mid range without MSAA, which the app's post chain does not guarantee).
- **The beard's line is also painted on the face**: above it the skin carries the beard's colour over ~1.7 cm (the face
  shader, pattern 19/25; a bearded face carries −20 in v on the front, so no extra attribute) — hair finer than a pixel at
  any distance, so the cheek line is soft and the sideburn runs into the temple. Off with the beard (`setShaven('all')`).
- **A lighter fringe and a darker body**: the cheek line, the sideburn and the lower edge are lighter (thinner hair, skin
  showing through: vertex shade ×1.22), the locks alternate light and dark. The moustache is parted under the philtrum and
  droops past the mouth's corners; the lips show between moustache and beard.
- **Hair is a dull sheen, not a gloss**: hair pattern roughness 0.52–0.78 (was 0.38–0.58), shells 0.56 (was 0.45); the
  lock-scale light/dark (clump noise) stays at any distance; lock-scale ridges (~2 cm) carry the strand normal where the
  strands are sub-pixel. Locks break the outline at LOD1 too, calm at the crown (they drew a point); the hairline's last two
  rows are lighter (thinning out); the nape's line dips toward the middle (no bowl cut). — Kajiya–Kay (measured −40 % fps
  on the HD 4600 in people-realism).
- **The darkest hair is a very dark brown, `#2e221a` (≈3 % albedo), not `#1c1611` (≈1 %)** — the period's population had
  dark brown to black hair; at 1 % albedo every beard and head read as a flat black hole in the sun. — keep near-black.
- **Head sculpt** (`headShape`): the nose dorsum stays narrow and widens only into a rounded lobule with alae and an alar
  groove (a linear widening made a wedge); a deeper male brow ridge with the glabella; cheekbones fuller, the hollow below
  them, and the zygomatic arch carried back toward the ear (an outward X bulge); the nasolabial fold as a crease with the
  cheek full above it. Vertex AO on the front: sockets, the upper-lid crease, beside the nose, the folds, under the lip and
  the nose. All reconstruction of an average adult face; per-figure morphs (people-realism) still vary them.
- **LOD1 head 26 × 18 with the rows gathered in the face band (was 18 × 12), LOD0 48 × 36 (was 44 × 34)** — LOD1 is the face
  seen from 3–8 m on high (the commonest), where the old facets made a wedge nose. Cost: LOD1 +500–600 triangles a figure.
- **Eyes calmer**: LOD0 sclera duller and more shaded by the upper lid; LOD1 painted eye narrower (3.5 mm half-height),
  its sclera barely lighter than the skin. — the bright all-round sclera read as a doll's stare.
- **Skin**: wrap 0.52 with a redder terminator (`pSSS` 1, 0.36, 0.22); a roughness map — the T-zone (forehead, nose)
  oilier, the cheeks drier — and under-eye colour. — subsurface blur (a screen-space pass: too costly for low).

## PPL-2 — garments

- **Head-cloth hangs plumb**: from the cap's edge the cloth falls straight down past the jaw until it meets the neck,
  trapezius and shoulders, which push it out (neck/torso clearance), then lies on them; the short cloth's front ends now
  reach the collarbones. Its weights hand over from the head to the neck, collarbones and chest as it falls (head weight
  1 → 0.25). Before, each column ran straight from the cap to a point out on the shoulder tip (and the short cloth stopped
  8 cm above it): the ends stood out from the temples like wings, and swung with every turn of the head. — the robe's
  skirt-cage bones (no free bones: MAX_BONES 36 is reached).
- **Clavi 1.1 cm wide at ±9.8 cm** (were 1.7 cm at ±8.2 cm): two narrow woven stripes either side of the neck opening,
  over the shoulders from the front hem to the back hem — the period's tunics are two sheets joined at the shoulders and
  the clavi run over them continuously (Judean textile finds; reconstruction). They already reached the hem front and back.
- **Mantle edges rolled**: a strip from the outer sheet's edge round a ~4 mm bulge to the inner sheet along the hem and both
  front edges (with the edge's weights and seated hang share) — the hem had no thickness. LOD1 mantle 24 × 11 (was 16 × 9):
  the coarser sheet showed flat facets at 3–8 m. Wool: a stronger fold bump, a fine twill rib within reach and a roughness
  that varies with the yarn's slub and is lower on the folds' ridges (nap rubbed down).
- **The red patch was the belt**: in semichah (arms forward) the mantle's sides, skinned 42 % to the upper arms down to
  8 cm below the elbow line, were pulled off the waist and the madder belt showed through. The arm share now fades out
  between 2 and 16 cm above the elbow line; the cloth at the waist stays with the torso. (Not a tzitzit corner or a decal.)

## PPL-3 — the avnet outside the avodah

- **`Actor.setGarb({ avnet: false })` (and `Crowd.setGarb`, `spawn/crowd({ garb: { avnet: false } })`), the avnet in its
  own mask group** — Rambam Klei HaMikdash 8:11 (checked on Sefaria): the garments may be worn on the day of service outside
  the avodah, except the avnet, which is sha'atnez. Logged in `people.md`. The Kohen Gadol: his golden avnet is under the
  me'il (no visible change); the ephod and choshen hold wool and linen too but are not forbidden per the Rambam (Kesef
  Mishneh / R' Yosef Corcos on 8:11: not worn for warmth, Kilayim 10:19), so they stay; the YK avnet is all linen and has
  no group. — infer it from the pose ('eat'): rejected — a meal alternates eat / stand / carry, and the avnet would pop on
  and off; what is avodah is the sim's knowledge. **The sim must pass the flag** (request in the report).

## PPL-4 — crowds and poses

- **Region-crowd grid chosen by score** (system.js Crowd): the cell aspect (2.1 : 1 along the heading when prostrating,
  square otherwise), the least room a person needs (prostrate 2.25 × 1.0 m, standing 0.7 × 0.55 m) and, for six or more,
  at least two ranks and two files where the region has room. The ma'amad bands (10 × 12.5 amot, 10 men, prostrate
  layout) were one file of 10; now 2 ranks × 5, brick-staggered. How many stand there is still the sim's choice.
- **Pose variants baked per rig, chosen per figure** (`CLIP_VARIANTS`: stand × 3, raise_hands × 3 beside the base): weight
  on one leg with the other foot forward and out, head turned and tilted, arms more or less bent; in Birkat Kohanim the
  wrists wider or narrower, higher or lower, one hand a little higher, palms turned out more or less, fingers spread
  more or less, the head tilted. An actor keeps the variant its seed gives, a crowd member the one its offset gives (no
  extra random draws: existing crowds keep their looks). The hands stay above the head (Tamid 7:2 / Sotah 38a); the Kohen
  Gadol's `raise_hands_low` is unchanged. — per-instance pose noise in the shader (bone offsets: costs fetches on every
  vertex).
- **Long sleeves fuller over the arm** (×1.12 above the elbow, ×1.1 below), still closing to a hand's width at the wrist
  (Rambam KhM 8:17: the sleeve to the wrist, as wide as the hand) — raised in the blessing, sleeves cut to the arm's girth
  read as sticks.
- **Sleepers**: the cover (his own mantle, Tamid 1:1) is undyed wool lighter than the kesset under him; where it falls from
  the body it hangs in folds (rounded ridges and creases displaced along its normal, running down the fall), and an
  occlusion term darkens its hollows and the foot of each fall, so head, shoulder, hip and knees read; in `lie` the right
  knee is a little drawn up, its heel on the floor. — The Levites' single file on the duchan is placed by the sim
  (g3/song.js, request); the song view's heading is DATA-2.

## PPL-5 — fades

- **Every dither fade is temporal**: a figure's alpha moves toward 0 or 1 over 0.25 s of real frame time and snaps on
  'time:jump', on pause/resume and in shot mode (`ctx.params.shot`), so nothing is left half dithered while the clock
  stands still. The far-cap fade has a target per figure with hysteresis (out in the last 6 % of the far allowance, back
  in below 12 %); the flowing crowds fade a member out within 0.35 m of the edge it crosses and in again past the other.
  (The near "dithered man" of the QA shot was a flowing-crowd member 1.6 m from its region's edge: the old spatial fade
  froze him at 46 % — and kept him off LOD0, which wants alpha 1.) — the old rank/distance fades.
- **Interleaved gradient noise instead of the 4 × 4 Bayer matrix** for the dither threshold (also the hair shells' far
  fade) — no visible grid; the fades are short now, so the pattern shows only for a quarter second.
- `src/people/dev/probe-main.mjs` finds the project root from its own URL (was a hard-coded `C:/Code/...`).

## PPL-6 — contact shadows

- **One instanced mesh of soft ellipses under every person and animal on low and medium** (contact.js; strength 0.7 / 0.38,
  fading out 35–60 m / 45–75 m): the footprint is the box of the pose's joints below 55 % of the figure's height (cached per
  baked frame), so a standing man gets a small blob, a prostrate one a long one, a lamb its own. Alpha-blended black (dst ×
  (1 − a)), polygon offset, no shadow casting, warmed with the people programs. Seen at a grazing angle the ellipse is
  stretched along the line of sight to cover ≥ 3 pixel rows (vertex shader), else it vanishes into a sub-pixel line. Not
  under birds (tiny; in flight). High/ultra keep shadow maps and AO only. — a screen-space contact AO (a full-screen pass
  on low); a fake directional shadow from the sun (wrong under roofs, and low draws no other shadows).
- **Its program is warmed with the people programs through a stand-in with its own geometry** — the instanced mesh
  frees its geometry's attributes when it grows, and a stand-in sharing that geometry compiled a second, attribute-less
  program in the background warm-up (`tools/warmup-check.mjs`: "two programs", low and medium).
- Measured on low (HD 4600): +1 draw call; e.g. the 15-steps view 251 → 252 calls, 55–56 fps unchanged.

## Verification

- App shots before/after (`shots/qa-r1-fix-people/{before,after}`): high `h-ppl1a-d2` (+ `-live`, UI), `h-ppl1b-0710`,
  `h-ppl2-0900`, `h-song-0735`, `h-birkat-070820`, `h-moked-n4`; low `l-k1130` (+ `after/l-k1130-avnetoff`, the flag
  set by eval), `l-15steps-d3` (+ crops), `l-ppl1a-d2`, `l-ppl2-0900`, `l-birkat-070820`, `l-moked-n4`; medium
  `m-ppl2-0900`, `m-15steps-d3`. Harness: `after/final-{high,low}-{3m,8m,15m}` (+ `crop-*`), close-ups
  `final-high-1m-*`, `avnet-onoff`, `avnet-pair`.
- Tests: `src/sim/dev/tests/jumps.js` deterministic; `gc.js`, `budget.js`, `firstnight.js` ok; `tools/warmup-check.mjs`
  all tiers PASS (low/medium re-run after the stand-in fix); `src/people/dev/covercheck.mjs` all clean;
  `propcheck.mjs` bad 0; `tools/validate-schedule.mjs` 0 errors, `tools/coverage.mjs` no gaps; `npm run build` ok.
- Triangles per figure (LOD0 / 1 / 2 / 3), before → after: kohen 16302 / 2568 / 611 / 257 → 17190 / 3160 / 611 / 257;
  israelite 19332 / 3380 → 20516 / 4636 (LOD2/3 unchanged). Geometry build time unchanged within noise (interleaved
  bench: LOD0 140–220 ms, LOD1 16–50 ms either way).
- Not people's: a first jump to dawn after a day boot (`firstnight.js` "dawn") stalls ≈ 1.3 s on low on a non-people
  MeshStandardMaterial program compiled at that frame (people.update 8 ms there) — reported to render/env.
