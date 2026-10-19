# build-heichal-fix — decisions

The review pass on `src/world/heichal/**` (two reviewers: accuracy; visual + performance). The standing reconstruction
choices are in `build-heichal.md`, whose bullets were corrected in place where this pass changed them. Format: **choice**
— why — alternative. Shots: `shots/build-heichal-fix/`.

## Context that changed the lighting findings
- **The reviewers' lighting measurements (Kodesh darker by day than by night, camera-dependent gold, black walls on low
  at night, the doorway lobe, the "drop ceiling") were taken on my fallback `interior.js`. Since then env has shipped
  its own interior light (`ctx.env.interiors`, lighting-polish, in the working tree), and the fallback stood down
  whenever that existed. This pass deletes `interior.js` instead of re-tuning it.** — env's system does what the
  reviewers asked for, per fragment: sky visibility through the gate (a natural fall-off down the hall), occlusion of
  other rooms' point lights, a Kodesh reflection probe (medium+), a lamp fill where no probe exists (low). Two lighting
  systems would fight (mine swapped `scene.environment`, which now carries env's probe atlas); per-material envMaps
  would bypass that atlas — re-tuning a dead fallback.
- **What is left of those findings is env's (requests in the build report), measured on env's system.** — see the
  verification section of the report.

## Geometry and materials (this folder)
- **Loaves: walls 2½ tefachim (R' Yehudah, lock #31) and separate 7-etzba horns, as rounded smooth "breached boxes"
  with a little lean, sag and hand-made scatter, in a crust-toned variant of `plaster`; kanim as half reeds open side
  down; stack and snifin re-derived (≈ 3 amot).** — Menachot 11:4–6, Part IX §38.2, Part X §53 (Shiltei: the 7
  etzba'ot are the horns'); the horns are curved tapering lobes leaning outward over the kanim (straight cones read as
  spikes) — horns as the walls' corners (the first build, a 7.8-tefach loaf).
- **Shulchan and golden altar in `gold_plate`.** — both are acacia under gold (Shemot 25:24, 30:3; Chagigah 26b–27a;
  Part V §13 table); the altar as a polished `gold_vessel` box mirrored the doorway and read cream — solid gold.
- **Menorah: thicker (shaft 0.3 t, branches 0.24/0.21 t), ornaments grown as far as the inner branches' clearance from
  the head allows (≈ ×1.25, not the suggested ×1.5, which collides), all 22/11/9 ornaments at every tier, smooth
  lathes; centre nozzle ⅓ tefach, the others ½.** — see `build-heichal.md` (Vessels).
- **Nivreshet: indexed smooth lobed globe (R 0.78), a `gold_vessel` variant with roughness × 0.65 (≈ 0.09).** — a
  mirror polish (≈ 0.05) put the sun's image in a sub-pixel spot at court distance; at ≈ 0.09 the spark is a few pixels
  and blooms. `gold_polished` replaces it when materials adds it (still requested) — mirror polish.
- **Vine: two-sided smooth leaves (0.2 m, flatter cup, fewer: 60/140/260/400), oriented every which way, a slightly
  matte `gold_vessel` variant (roughness × 1.25) for leaves and grapes; berries smooth-shaded detail-0 icosahedra at
  every tier (≈ ⅕ of the first build's triangles at ultra); trunks and canes smooth curves (CatmullRom tubes), the trunks rising from small gold
  sockets on the wall above the gate-curtain rod, behind the lower pole and over the upper one, clear of the brackets.**
  — the low-poly star leaves, all turned to the east, put a glint on every leaf at sunrise ("fairy lights"); flat
  normals made them shimmer; straight trunks kinked through the poles and ended in mid-air — the first build.
- **Crowns: wreath crest of pointed leaves, silver north / gold south (code and log now agree), r ½ amah on low marble
  stands at the windows' Ulam face.** — see `build-heichal.md`.
- **F1 splays plated only in the first amah (the throat); outer splay `heichal_whitewash`.** — Middot 4:1.
- **Rovadin recess ¼ → ⅓ amah; the decision log now states the departure from Part V/VII's deep-ledge reading and
  why.** — see `build-heichal.md`.
- **Lintels ⅙ proud, stone courses ⅙ set back, the courses the herodian white row with joints (`uz` UV tag), beam ends
  in end grain; the +62 kiyur round the Ulam block ½ amah deep, its back filling the set-back course.** — see
  `build-heichal.md`.
- **Split curtains lap (1 amah overlap, second half a little over a tefach east), meeting edges straight; edge strips
  continue the faces' UVs and normals; more rows at high/ultra (12/16).** — the closed Ulam curtain interpenetrated in a
  saw-tooth; the parochet's drawn edge showed an 8 cm column of the weave as a bright line.
- **Knife niches lined with `ashlar_plain` (the sealed plug stays `marble_veined`).**
- **Great-gate and wicket leaves in seamless `gold_vessel`; each panel's boss an eight-petal rosette round a button.** —
  the plate's sheet grid read as gilded ashlar; a flat-capped boss read as a ring and a polished dome as a porthole
  mirroring the court — gold_plate leaves with seams aligned to the panels (the sheet grid is in the texture).
- **Even Shetiyah: broken, roughly level top with a crisp margin; a thin `gold_plate` lip where the floor plating turns
  up against it.** — Yoma 5:2 (3 etzba'ot), review.
- **The lul's small curtain hangs closer to the wall and laps the slot by almost half an amah each side and above.** —
  daylight from the slot showed round its edges as a dashed line.
- **Material variants (`kit.variant`), see `build-heichal.md` (Light).**

## Rejected / passed on (with the evidence in the report)
- **Keruv drawing** — materials owns `gold_relief`; requested (child's face, wings upward, no robe or halo-like disc).
- **Chains ending at +48, the lul slot in the KhK west wall, `centerLamp`** — site-model's (requests repeated).
- **Fire-light leaks through masonry, shadow bias stripe, the parochet weave close up** — render/fx and materials
  (requests).
