# qa-r2-people — decisions

Format: **Choice** — why (source / reasoning) — alternative. Fixes PPL-R2-1 … PPL-R2-8 of the second QA round. Builds on
`people.md`, `people-realism*.md`, `people-3*.md`, `people-4*.md`, `qa-r1-people.md` (still valid unless noted).
Shots: `shots/qa-r2-fix-people/before/` and `after/` (app, `tools/shot.mjs --q high`, the QA's queries), `wip/` (people
harness `src/people/dev/views.mjs` and frozen-frame app views `src/people/dev/appviews.mjs`).

## PPL-R2-1 — mantles and the arms

- **A mantle is kept outside its wearer's arms in the vertex shader, per frame, from the arm's own bones** (material.js
  `pArmPush` / `pExit`; human.js `mantle` flags its sheets and rolled edges at LOD0/1 with pattern id + `MANTLE_ARMS`). Two
  segments per arm, posed by the upper-arm and forearm matrices: the upper arm from 30 % below the shoulder joint to the
  elbow, and the forearm with the hand hanging from it (a relaxed wrist) to the fingertips, tapering — the sleeve's girth +
  1.5 cm. The rest joints are a uniform table per human rig (`ARM_TABLE`, `HUMAN_RIG_ID`; the instance's `pAnimB.x`, unused
  before, carries the rig's row). Colour passes only, in the figure programs only (not the animals', props' or depth
  programs). Cost: two extra bone matrices (12 texel fetches) on mantle vertices; compile, measured on cold harness pages
  (`src/people/dev/compiletime.mjs --cold`, new flag): no push 4.5 s, the first version (three segments, a const array,
  every figure and depth program) 5.4 s, this one 4.9–5.0 s; the people depth programs at a high first frame 0.72 / 0.71 s
  with the push → 0.25 / 0.23 s without it (`tools/boot-prof.mjs`). — the QA's bake-time push (no per-vertex data in the
  atlas, which holds bone matrices: it would need cloth bones, and MAX_BONES 36 is reached); a 0.15–0.3 arm share below the
  elbow (brings back the belt patch in semichah, qa-r1); the push in the shadow pass too (the casters are back faces 2 cm
  deep, and the lift moves the cloth a few centimetres: no visible difference, and it slowed the first frame).
- **The cloth drapes over the arm as over a cylinder** — across the arm, the cloth must lie at depth ≥ a half-ellipse R + 1 cm
  high that spreads 6 cm past the arm's sides; cloth more than ~5 cm behind the arm (the far side of the body) is left
  alone. Pushed out radially (the first try), the vertices either side of an arm lying in the cloth parted round it and the
  arm still showed through the gap (`wip/c-song-ab3.png`); jumped across the arm vertex by vertex (the second), the lifted
  columns stood out beside it as a board (`wip/c-song-z3.png`). The 7 × 4 silhouette sheets (LOD2/3, from ≈ 14 m on high)
  are not flagged: they cannot drape, and an arm in them is a pixel or two.
- **Only while the arm hangs (within ~20° of plumb; faded from |axis.y| 0.94 to 0.82)** — a man standing or walking has
  his arms under the mantle; a raised arm (semichah, carrying, a hand held out) is out in front of it, and the cloth falls
  behind it as before. Pushed there too, the panels were lifted into a box over the forearms (`wip/m2-isr-semi.png`, the
  second try). The semichah front view keeps the belt in the opening, no patch (`wip/c-sm1.png`).
- **LOD1 mantle 32 × 12 (was 24 × 11)**: between sparser columns the drape over a forearm showed facets. +~550 triangles on a
  mantled LOD1 figure.
- **The "jagged gaps at the hems" were the tzitzit at LOD1**: three ribbons of 1.6 mm, sub-pixel from 4 m, broke into
  flickering dashes. LOD1 now draws each tassel as one 6.5 mm bundle with its 2.2 mm techelet strand beside it (the strands
  hang together; the eight strands with their techelet one are kept at LOD0). — no tzitzit at LOD1.
- Result: `after/h-song.png` (crops `wip/c-song-ab5.png`, `wip/c-song-z4.png`): no forearm patches, no boards;
  `after/h-nikanor-d2.png`: the sleeve no longer pokes through the side.

## PPL-R2-2 — faces, hair, neck

- **The strand shells now hold out to ~6 m**: their lock noise has two scales — strands within reach, clumps (≈ 1.5 cm across,
  ≈ 9 cm along the hair) from ~1 m — and they fade out only when the clumps go sub-pixel (pPx 5.5–9.5 mm). Before, with the
  3.5 mm strands alone, the shells were discarded beyond ~1.2 m: from 2 m on, hair and beard were their solid caps (the
  helmet and the mask of the QA). Applies to the goats' long-coat shells too (same pattern 23/35).
- **Three hair and three beard shells at LOD0 (were two), one of each at LOD1 (were none)**, the hair's outermost 6 mm out
  (was 3.5): the outline breaks up instead of a smooth cap.
- **A hairline fringe**: a strip from 5 mm inside the hairline to 6 mm past it, alpha-tested like a shell, sparser and
  lighter toward its edge (skin between the hairs), short strands (the hairs at the line are short and grow back) — the cap's
  edge was one hard line. Forehead, temples and sides (the nape's edge is in shadow). LOD0/LOD1.
- **The hairline wavers irregularly**: three incommensurate waves, the phases per head (one regular wave read as a
  scalloped cap).
- **Three colour zones on the face** (pattern 19/25): the forehead a little yellower, the nose, cheeks and ears warmer (the
  flush a little stronger; the ears' own vertex colour), the jaw, chin and upper lip cooler and greyer — strongly for a
  bearded man (his beard shadow, bluish), barely for a woman or a boy; the beard's painted shadow above its line is
  bluish-grey, part the hair's colour. — a skin texture map (none are downloaded).
- **Eyes**: a catchlight on the cornea over the iris (the sky mirrored; never thinner than a pixel, dimmed as it widens so far
  off it is a faint spark), on LOD1's painted eyes too while it spans a pixel; the upper lashes as a dark band along the
  upper lid's margin, thicker toward the outer corner; the lids rougher (0.62) and their outer rows sunk further under the
  socket's skin (they stood out as glossy shells).
- **The neck tapers to the jaw, with the two sternocleidomastoid cords** (from the notch above the breastbone up and back to
  behind the ears), **the larynx standing out in front (a man's Adam's apple; a trace in women and boys) and the jugular
  notch**, the hollows beside the cords a touch darker (LOD0 9 rings × 24, LOD1 6 × 12). — the plain tube.
- Cost: see the per-figure totals under Verification (the shells, fringe and neck are most of the LOD1 growth).
- Not done (beyond this round): subsurface skin, modelled lashes, sculpted lids — the face is still a stylised average one.

## PPL-R2-3 — bare feet

- **The foot was already ≈ 15 % of stature at LOD0 (25.6 cm at 1.67 m, measured on the geometry); LOD1 was 13.7 %.** The
  "paddle" was LOD1's single pointed ellipsoid (from 3–14 m, where most kohanim are seen), not its length — the length is
  kept. Kohanim served barefoot, nothing between foot and floor (Zevachim 24a; report §34).
- **LOD1 is now the LOD0 foot's loft in five sections (heel, ankle, instep, arch, ball) with the medial arch lifted, and
  mitten toes**: the big toe and the four others in two pairs. 104 → 294 triangles per foot (+380 per figure).
- **The sole's edge darker (dust of the courts), contact occlusion within a centimetre of the floor (under the heel, the
  ball and the toes), the crease where each toe leaves the foot and across its joint** — LOD0 and LOD1.

## PPL-R2-4 — the animals

- **Animals are heroes (LOD0) from 0.6 × the figures' on-screen size** (system.js): a few at most in any view, and their
  LOD0 has the head with ears, muzzle and nose pad, the knee, hock, fetlock and pastern, the cloven hooves, horns, the
  fleece locks — a lamb is LOD0 to ≈ 5 m on high instead of 3.
- **Their LOD1 (3–14 m) is no longer a barrel on posts**: body 14 rings × 20 (was 8 × 12), neck 14 segments, the head five
  rows × 14 with its sockets, brow and cheeks (was four × 10, smooth), every leg ring kept (knee or hock, cannon, fetlock,
  pastern; was six of nine), ears 7 × 5, horns 12 × 6. Lamb LOD1 3017 → 4233 triangles. The carried and hung lambs (props
  baked from the animal at LOD ≤ 1: `bakeAnimal`) get the better LOD1 with it.
- **The fat tail shows**: the alyah is offered whole (Vayikra 3:9, "the whole alyah, cut off near the backbone"; with the
  right hind leg, Tamid 4:3) — the breed is the region's fat-tailed type (Awassi-like; **reconstruction**, as
  people-realism-fix.md). It was seated inside the rump's wool, so from behind the lamb was a plain white box; it now hangs
  further back and lower (to the hocks), its wool shorter than the body's, soiled toward its lower edge, with a dark crease
  where its root meets the buttocks (`wip/an2-rear.png`).
- **The fleece is soiled underneath**: the belly, the lower flanks, the breech and the legs' wool cuffs yellowed (lanolin)
  and grey-brown (dust, dung) — vertex colour, the back the cleanest. — the earlier alpha-tested fleece shells (removed in
  people-realism as a stipple at mid range; not brought back).
- **The carried lamb is not the standing mesh**: `lamb_dead` / `*_slain` are already baked in their own carried pose
  (`lambDead`: on its left side, the neck hanging limp, the legs hanging — a slaughtered animal's legs fall, they are not
  gathered); it read as shapeless because it was baked from the coarse LOD1 (now upgraded). — gathered legs (the QA's
  suggestion; a live lamb carried by a shepherd).
- Goats keep their scimitar horns swept back and the long-hair skirt; their shells gain the clumped noise (above).

## PPL-R2-5 — the animation atlas

- **The atlas keeps its half floats and encodes only a new rig's frames** (anim.js `_encode`): the bake returns them
  (`bakeRig(...).half`, converted in the prebake worker when it got there first), each frame's row segment is copied into
  its block; a texture with more blocks re-lays the rows already there by a row copy and is created anew (a DataTexture is
  CPU-only until three's first upload), otherwise the whole texture is re-uploaded once at the next render, however many
  rigs arrived before it. Height is always 1024 rows. The CPU master / local buffers grow geometrically (×1.5). Before,
  every ensure() re-encoded every frame baked so far (DataUtils.toHalfFloat per float) into a new buffer: quadratic in rigs.
  — upload with updateRanges per appended frame (≈ 2000 texSubImage2D calls of 108 texels; three's ranges are single rows).
- **'child' is prebaked in the worker** (prebake.js BOOT_RIGS): the sim's pools ensure it at every boot (the women's court
  crowds), and it was the one rig baked on the main thread then.
- `atlas.stats = { ensureMs, uploads, rigs: [[key, frames, ms]] }` for measurement.
- Measured (production, low, default view, `--eval __mikdash.people.system.atlas.stats`): ensure() total 1818 ms
  (re-encoding + uploads 1252 ms; child 670 ms, elder 559 ms) → 80–143 ms (each rig ≤ 25 ms). `sys:people → sys:sim`
  3486 ms → 372–500 ms; `ready` 9.3 s → 6.2–6.6 s.
- **The animals' LOD0 program is in the boot warm set on every tier** (system.js `warmupObjects`): with animals heroes from
  0.6 × (PPL-R2-4) and the sim standing every pooled animal before the camera at boot, it was issued at ≈ 7.7 s, after the
  rest, and linked last (19.1 s = `compiled`, 3 s after everything else, `tools/boot-prof.mjs --q low`); issued with the
  others it links by 14 s. `compiled` 18.2 s (before) → 17.1 s, `firstImage` 18.8 → 18.7 s (one quiet run; the machine was
  shared with other fixers' runs, and other runs gave 18.6–20.7). The first view is now gated by the world's programs
  (linking until ≈ 17 s) and a ≈ 1.5 s first-frame task, not by people's boot. CLAUDE.md's "low ~14 s" is not reached on this
  machine today: the numbers above are what docs should record.

## PPL-R2-6 — the dot screen on garments

- **It was not the twill**: frozen-frame A/B at the QA's view (`wip/dots-cmp.png`, `wip/acne-cmp*.png`): the dots stayed with
  N8AO off and at full render scale, went with `receiveShadow = false` on the people, and with all casters off; they stayed
  with only the people casting, with the wrap and translucency terms off, and with a 2 cm caster depth push — and went with
  the sun's shadow radius at 0. They are three r186's PCF: it rotates its 5-tap Vogel disk per pixel by interleaved gradient
  noise, and on a figure much of the surface lies in a soft self-shadow penumbra (folds, the far side of a curve, a mantle's
  edge over the tunic), where the rotation prints a regular dot screen.
- **The people's programs take the PCF taps unrotated** (material.js `shadowPars`: the chunk read at compile time — render's
  patched one — with `phi = 0`): each tap is still a hardware bilinear PCF, so a penumbra is a smooth ramp. Program cache key
  v9. — retuning the light's bias (render/env's, shared with the architecture); TAA (not in the pipeline).
- **Figures also write their shadow depth 2 cm behind their surface** (orthographic shadow maps: `gl_Position.z −=
  P[2][2]·b`; the fires' cube maps: MeshDistanceMaterial's distance + b) — people cast by their back faces, and the mantle's
  lining, the hems' facings and the hair and beard shells put a back face just behind a lit surface, which darkened its own
  lit cloth. Bodies are thicker: a figure still shadows itself (an arm the torso, the mantle the tunic). Depth key v6.
- The twill (pattern 3, period 2.5 mm, bump only, faded by 2 px per period) is visible only within ~0.5 m and is unchanged.

## PPL-R2-7 — migba'at and mitznefet

- **Modelled windings**: each band a 3 cm (`WOUND_PITCH`) of the strip showing, five or six up the head; from the lip of the
  winding that laps it, the cloth rises in a rounded lip standing ~3 mm proud (its shadow on the band below, in the vertex
  shade and the pattern) and falls away under the next — a sawtooth in the geometry at LOD0 (34 rings, was 22), a gentle
  bulge at LOD1 (11 rings) where the pattern carries the lines; the lowest turn sags ~5 mm at the back and sides; the strip's
  end is tucked under a winding behind, a little to one side, as a short tapering tongue. The pattern's phase now runs the
  same way as the geometry (the lip at the band's lower edge).
- **The shapes stay distinct**: the migba'at a rounded dome with diagonal windings (two pitches per turn), "like a hat"; the
  mitznefet lower and broader with level windings (one pitch per turn), "like one who bandages a fracture" (Rambam Klei
  HaMikdash 8:2; people.md). The 16-amah strip (Yoma 7:5; report §34) at ~60 cm a turn is ≈ 13 turns lapping each other, so
  a band shows ≈ 3 cm of a strip about a tefach wide.
- **Plain linen, not the box weave**: the meshubetzet weave is the ketonet's (Shemot 28:39); the headgear is shesh, plain
  (Shemot 39:28). The pattern's fine thread noise stands for it (the QA asked for the box weave at LOD0).

## PPL-R2-8 — the carcass being flayed

- **The hide hangs as a draped skin, not a sack**: deeper, uneven folds, and its hem drawn down into the two empty skins of
  the hind legs (peeled off them first) hanging as tapering flaps at the sides.
- **The fore legs hang below the hide's hem** either side of the head, baked from the live animal (short hair, hooves): the
  flaying goes down to the breast before the head and the legs are taken off (Tamid 4:2). Cheap (two leg bakes).

## Verification

- App shots before → after at the QA's queries (`before/`, `after/`, crops `after/crop-*-ab.png`): h-song, h-nikanor-d2,
  h-birkat-0708, h-animals-d4, h-owners-d4, h-flay-d4. Frozen-frame A/B views (`appviews.mjs`, people update frozen) for the
  dot screen and the song.
- Harness views (`wip/`): mantles front / side / 3/4 / back at forced LOD0 and LOD1 (`ctx.people.system.forceLod = 0..2`, a
  new dev hook), stand variants, semichah, sit, walk, prostrate; feet; faces at 1 m and 3 m; headdress; animals; the carcass.
- `tools/warmup-check.mjs`: all tiers PASS (high/ultra after the depth programs lost the push: + 1.0–1.2 s; one ultra-play
  run failed on a network console error, `ERR_SOCKET_NOT_CONNECTED`, and passed on the re-run). Sim tests (low, `t=d3`):
  jumps deterministic, firstnight ok (first night frame 154 ms), budget ok, gc ok. `propcheck.mjs` bad 0;
  `covercheck.mjs` all clean; `validate-schedule.mjs` / `coverage.mjs` no gaps; `npm run build` ok.
- Triangles per figure (LOD0 / 1 / 2 / 3), qa-r1 → now: kohen 17190 / 3160 / 611 / 257 → 19968 / 3856 / 611 / 257; israelite
  20516 / 4636 / 732 / 348 → 22224 / 5896 / 732 / 348 (LOD2/3 unchanged). Animals LOD1 ≈ 3.0k → 4.2k; LOD0 ≈ 10.5k (unchanged,
  used to 0.6 × the figures' size).
- Dev tools: `src/people/dev/compiletime.mjs --cold` (a fresh browser per query, for shader A/B).
