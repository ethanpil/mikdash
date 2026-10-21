# people-3-fix — decisions

Format: **Choice** — why (source / reasoning) — alternative. Fixes the review of `people-3` (its log, `people-3.md`, stays
valid unless noted here). Shots: `shots/people-3-fix/*.png` (finals), work in progress in `shots/people-3-fix/wip/`.
Tools added: `src/people/dev/views.mjs` (many camera views / pose phases per harness load), `appviews.mjs` (the same in
the app, with a setup script), `covercheck.mjs` (sleepers' covers against every LOD and phase of the bodies they cover).

## The elders' bedding on the rovadin (Tamid 1:1)

- **`lie` now rests the hands on the belly with the elbows at the sides (0.47 m across the elbows; it was ≈ 0.7 m with
  the arms at the sides and 9° out)** — a man lying on his back on a 1-amah (0.48 m) stone ledge cannot have his arms
  beside him; hands folded on the belly is also the ordinary sleeping posture. Changed for every role (the slab kohen,
  sleepers on the floor) — one more variant was not worth an extra clip. — A ledge-only variant clip.
- **The sleeper's mantle is draped over the posed body itself.** The off-duty figure (israelite / elder recipe; LOD0,
  1 and 2 together, without his mantle and head) is skinned in the `lie` / `sleep` clip at the breath in and out,
  rasterised (triangles, not vertices) into a 2.5 cm height field in the pillow frame; the cloth hangs from the
  highest points as a cone of slope 2.6 (wool falls steeply off shoulders and knees but tents over hollows), is
  smoothed twice and kept ≥ 1.6 cm above the body; each cover vertex takes the field's max over its own mesh cell, so
  peaks between vertices are not cut. `covercheck.mjs`: 0 pokes for both beddings × lie / sleep × figure LOD0–2 ×
  every baked phase, at full build. — The old fixed height profile (0.62 m wide, tunic and finger pokes everywhere).
- **On the ledge (`folded_garments_ledge`) the mantle runs over the body to ±0.245 m (or 1.2 cm outside the body where
  it is wider) and then falls straight down 0.2 m past both edges** — on the open side it hangs over the lip down the
  riser (as a blanket overhangs a bench), on the wall side the fall is tucked down between body and riser, inside the
  stone. Nothing stays flat in the air beyond the lip, so the covers of the three tiers no longer lie over each other
  like shingles and the lowest no longer floats over the hall floor. The kesset folded double is 0.39 m (half of the
  0.78 m mat). — A one-sided fall (needs to know which side is open: it differs between the west and east ledges).
- **The bedding assumes the body centred on the 1-amah tread** (G1 places it 0.18 amah toward the open edge, a
  workaround for the old arms-at-the-sides pose: with it the body's shoulder hangs 8.6 cm over the lip). Requested from
  G1: drop the offset (`M.elders … at: [t.X, …]`); its `FOOT.lie.body.r` can shrink to ±0.55 amah. Shots on the real
  ledges with both placements: `app-led-g1-*.png` (G1 today) and `app-led-c-*.png` (centred).
- **Cost**: a height field is built once per bedding × lay (at most four per session; the Moked night needs three):
  ≈ 50–290 ms each on this machine (other agents' builds running), paid when the first sleeper of that kind is drawn.

## Windlass (the muchni, Tamid 1:4, 3:8)

- **The pose ↔ wheel coupling is exported**: `stations.windlass.spin0 = π/12` and `phaseAt(angle) = ((angle − spin0) /
  (π/2)) mod 1` — the wheel's 8 pegs sit at k·45° from the top at rotation 0, and the stroke (30° → −15° on the
  operator's side) meets them only with a 15° offset. The review measured the same offset in the app.
- **`windlass_raise` + `stations.windlassRaise`**: the operator mirrored onto the north side of the axle (1.5625 amot
  north, heading 90, the hub on his right), pulling the north rim down — the direction that raises the kiyor
  (`kiyor.userData.raise(f)` sets `rotation.x = (1 − f)·drop/0.36`, so raising turns it negative; `spin0 = −π/12`,
  `phaseAt(angle) = ((spin0 − angle)/(π/2)) mod 1`). Pulling down uses the body's weight for the heavy lift; pushing the
  south pegs up would be the weak direction. Whether the dawn raising and the evening lowering were done from
  different sides is not stated: **reconstruction**. — Playing `windlass` backwards (pushing up).

## Psachter (Tamid 5:5)

- **Chains and rings of copper, darkened with use** — Middot 3:4: "iron disqualifies by touch", they would not plaster
  the altar with an iron trowel "lest it touch"; the psachter is pulled down the ramp by one chain and brings the ashes
  down from the altar (Tamid 5:5), so its chains touch the altar's stones. Copper like the vessel (Shemot 27:3). The
  chains now fall from the rings with a sag and lie in an irregular meander with a loop where one fell on itself.

## Bare bodies (kohen_breeches, kohen_bathing)

- **The neck is part of the bare torso's tube** (head(…, { neck: false })): from inside the skull it widens into the
  trapezius, whose upper rings descend toward the front (to the collarbones) and the back (down the nape) as well as
  the sides — no seam and no ring standing proud of the neck ("collar shelf"). Clothed figures keep the old neck.
- **The deltoid cap is a low dome whose axis is the normal of the trapezius slope at the acromion**, its crown just under
  the slope's continuation: the outline runs from the neck over the deltoid tangentially; only the cap's descending
  outer side shows. Its crown is skinned to the clavicle and chest (like the torso under it) and its rim to the arm, so
  a swung arm stretches the deltoid instead of tilting a lid out of the shoulder; the cap's normals are bent toward the
  slope's where they meet (`MeshBuilder.normalFix`, new). Two earlier attempts (a level dome; a dome centred in the
  torso) still read as shoulder pads (`wip/b2-*`, `wip/b3-*`).
- **Arms**: deltoid, biceps and triceps, the olecranon behind the elbow, the forearm flatter toward the wrist
  ([across, front–back] radii per ring).
- **The michnasayim are cut like trousers**: the body tube ends at the seat; each leg starts as that ring's half — a D
  whose flat inner wall is the crotch seam, skinned like the seat — so the legs grow out of it with no hem or step when
  walking; the junction is shaded with the ring's own normal. Gathered pleats under the drawstring, which now covers the
  gathered edge. — The earlier pouch with a hem over two leg tubes (the review's "box with a skirt-like hem").
- **The bather**: his skin ends under the wrap's rolled top (the belly's round crossed the wrap's folds below it), the
  shins only just above the hem (higher, the knees came out through the wrap as they bent in the immersion), the wrap a
  little fuller at the hem.

## Poses

- **`wave_sudar`**: the cloth swung high from over the right shoulder out to the side and back, the fist ≥ 0.3 m right of
  the head and forward of it — the 0.54 m drape no longer passes through the head (Tamid 7:3).
- **`strike`**: the blow lands — the staff's tip at `stations.staff.strike.tip` = (0.08, 0.2, −1.32) m (the top of a man
  lying on his back, 1.32 m ahead), the fist ≈ 0.46 H up, a deeper forward lean (Middot 1:2).
- **`call`**: the hands on either side of the mouth like a funnel — palms in and forward, little-finger edges down by the
  chin, fingertips ≈ 10 cm before the lips — and the elbows forward at about shoulder height. The old hint pointed along
  the shoulder→wrist line and crossed the forearms. The jaw cannot open: the rig is at MAX_BONES (36), and the hands
  hide the mouth (reviewed request rejected with that evidence).
- **`knock`**: an empty fist — fingers fully curled, thumb tucked (it held the 'O' of a grip with nothing in it).
- **`pour_low`**: the left hand rests on the thigh just above the knee, palm down, fingers over the kneecap.
- **`sit_floor`**: the hands half-way down the thighs, the arms hanging close (the tunic's sleeves stayed under the
  mantle in every view checked).
- **Wood on the shoulder (`carry_log`, `carry_log_walk`)**: `gizrin_branch` and `branch_bundle` choose their own clip
  for `carry_shoulder(_walk)` (new prop field `poses`): the right palm up under the load's front end. Their shoulder grips
  now rest the load on the shoulder (its underside ≈ 2 cm below the anchor) and out on the acromion, clear of the head
  (they floated ≈ 20 cm above the shoulder joint and the bundle cut through the head and beard).

## Props

- **Bark (`PAT.BARK`, 40)**: the smooth grey bark of the fig with lenticels and a greenish film; the furrowed ridges of
  walnut and oil-wood (Tamid 2:3), chosen by the roughness channel. Branches bend, taper and swell at lopped shoots;
  the cut ends show growth rings inside a dark rim of bark. The bundle mixes the three woods, cords wound twice and
  knotted.
- **Entrails**: a heap of loops — the narrow small intestine in many coils, the wider large intestine in a few, glossy,
  with the mesentery's fat and a lumpy stomach (it was a flat spiral like a rose).
- **Charred limbs**: the crust varies — roasted brown where it is thin, red-brown in the fissures, grey-white ash settled
  on it, matt except where fat ran; charred bone dark; cords and strings char too.

## Engineering

- **Service clips are baked only for the men's rigs (`man`, `elder`); `sit_floor` and `warm` for every rig** — women,
  boys and children never serve; a missing pose falls back to `stand` with a warning, as any unknown pose does. Atlas
  with every rig loaded: 8924 → 7764 frames despite three new clips.
- **`bathe` on a role without a bathing figure warns once** ("immerses in its clothes"). The dead `Crowd.offduty`
  array is gone. The `sit_floor` comment in clips.js describes the clip as it is.
- **The kaf's new size (3 kav, ≈ 30 cm across)**: G3 asked to re-check where it sets the kaf down (the silver table,
  beside the golden altar).


# Round 2 (review r2, `shots/people-3-review/r2/`)

Shots: `shots/people-3-fix/r2/final/` (the `?debug=people` lineup, rows G–I, low and high, close and medium) and the
work sheets `shots/people-3-fix/r2/s-*.png`; scripts and probes in `shots/people-3-fix/r2/` (`gen.mjs` close-ups per
subject, `gen-lineup.mjs`, `tests/*.mjs` numeric probes of hands, props, the lamb, the cover fields and their cost).

## Bare bodies (kohen_breeches, kohen_bathing, every kohen in `bathe`)

- **The torso carries the deltoid; the arm grows out of it** — bareTorso's top rings run round a circular arc over the
  shoulder joint (`deltArc`: r 5.8 cm, widest at shX + 5.6 cm, ≈ 0.49 m across both deltoids, the bideltoid breadth)
  and turn in steeply under its widest to the armpit ring; the arm tube starts inside that mass and its first full ring
  (just under the widest) meets the arc there, so the outer contour runs on from the cap down the arm. The torso's
  outer shoulder is skinned 60 % to the arm (and its clavicle) so a swung arm carries the deltoid; the arm's top blends
  from the girdle to the arm over 6.5 cm. Below the widest the torso's normals are levelled like the arm's: no dark
  line at the junction. The anterior and posterior heads fill out the ellipse's thin diagonals. — The low dome on the
  arm's tube (r1), which read as a lid on a pipe with a seam at the armpit; a single welded mesh (not cheap to build
  procedurally per LOD). Raised arms (`raise_hands`) still stretch the armpit; none of the bare roles uses them.
- **Arms**: the deltoid's insertion, biceps (deepest front–back at its peak) and triceps, narrower above the elbow, the
  olecranon and epicondyles with the hollow in front, the forearm widest a hand below the elbow, a flat wrist.
- **Back**: stronger shoulder blades with their lower angles and the hollow between blade and spine, a deeper spinal
  furrow, a soft shadow under the blades; the trapezius falls gently toward the back (no shelf).
- **Bare shins** (`bareShin`, when a foot is built up past mid-shin): the ankle's neck with the malleoli (inner higher),
  the Achilles tendon, the tibia's flat face and crest, the calf's belly behind in the upper half (its inner head lower),
  the kneecap and condyles with the hollow behind the knee. Clothed figures keep the old ankle tube.
- **Michnasayim**: looser legs that stay full to the knee, drag folds from the crotch toward the outer knee, an uneven
  hem (lower behind and outside, a soft wave); the gathered top now lies just over the skin (1 mm inside it, the skin
  showed through the pleats at the back).
- **The bather's wrap in the immersion crouch**: wrapped snug (thickness 0.8 cm, was 1.2) with a thinner roll close
  round the waist, so the back's curve no longer lifts it off; the tucked end lies on the wrap's own folds (on plain
  rings it cut in and out of them). The wrap still goes boxy over the knees: that is the leg cage every robe shares
  (a crouch-only cage limit would change every robe's kneel).

## Seated mantle (sit_floor, sit, kneel)

- **Tzitzit hang plumb** — each fringe vertex carries its height below its knot in the (zero) metalness channel; the
  vertex shader skins the knot with the cloth and hangs the strand straight down in the figure's frame; what reaches
  the floor lies on it pointing outward. No bone is free (MAX_BONES 36). Applies to every mantle (the old `sit` too).
- **The mantle's sides hang from the pelvis while the figure is upright** — below the seat the panels' outer cloth
  (|cos θ| 0.5 → 0.93) blends toward the pelvis by `hang × uprightness of the pelvis` (shader, `pel[1].y`): seated, the
  mantle falls beside him from the arms to the floor and only its inner edges lie on the thighs; lying (sleep, lie,
  prostrate) the cage alone, as before. — Static weights (tried: a lying Levite's mantle then stood out past his
  drawn-up knees); limiting the shared cage (the tunic must follow the thighs).

## Carried lamb (carry_lamb, carry_lamb_walk)

- **Cradled, the back against the belly** — the lamb's back line is taken from the barrel only (the raised head had
  set it and held the body 0.14 m out); the arms: elbows at the sides, forearms under the barrel sloping ≈ 22° down to
  the hands, palms up round the far flank. The fleeced yearling (the shared live model) is ≈ 0.49 m thick, so its top
  comes to the collarbones. — Hands at 90° elbows (≈ 1.05 m): the lamb covered the face.
- **The head hangs** by lateral flexion (the lamb lies on its left side: the neck falls about its dorsal axis), muzzle
  down beside the left forearm. The earlier z-rotations rolled the head about the muzzle's own axis.

## Sleepers' covers

- **The side sleeper's arms rest on the floor** — the real cause of the "wall": in `sleep` the upper arm was held out at
  shoulder height (0.4 m up) and the lower arm lay 20 cm under the floor; the cover hung from the floating arm. Now the
  lower arm comes forward from under the body, its hand palm down before the face; the upper arm has fallen forward over
  it, the hand on the floor before the chest (IK in the lying frame). The hem at the head end curves (pulled up over the
  shoulder, sagging back where the cloth falls to the floor) and rolls down. `covercheck.mjs`: all clean.
- **Built ahead (prewarmBedding)** — the four height fields (bedding × lay) and the bedding props' LOD1/0 geometry are
  resumable jobs: a 120 ms slice in people's init (behind the loader), then 6 ms idle slices (requestIdleCallback,
  timeout 500 ms; browser only). A sleeper drawn earlier drains what is left of its job. Node: 31 steps, 0.39 s in all,
  the largest step ≈ 48 ms (a LOD0 recipe build) — was a 0.2–0.7 s stall at the first sleeper. The bedding geometry is
  cached and handed out as clones; the merged figure (several MB of plain arrays) is freed once both lays are built. —
  Precomputed fields in a data file (stale after any body or clip change); a worker (the cover would pop in).

## Smaller

- **sudar** joins HELD_VESSELS: the segan's signal cloth stays drawn at LOD 2 (Tamid 7:3: Ben Arza acts on it).
- **call**: palms facing each other, fingers forward and level (compensating the raised head), so the front shows the
  hands' edges framing the mouth. The elbows stay forward and a little out: the wrists at the mouth are only ≈ 9 cm
  ahead of the shoulder joints, so an elbow at the side would have to rise above the shoulder.
- **knock**: all four fingers rolled tight (108°/110°), the thumb across the middle phalanges — its rotation solved
  against the curled fingers' positions (`tests/thumb.mjs`); `fingers()` folds the thumb toward the palm only (a hook).
- **kaf / kaf_covered held by the handle**: the fist grip pitches the pan 19° down about the handle (how far the hanging
  hand's fingers point forward of vertical) and the props choose `stand_hold` / `walk_hold` (new clips, `PROPS.poses`):
  the fingers closed on the handle, that arm carried steady. Level in stand and walk (it hung 19–34° nose-up).
- **lift_mitre**: the officer turns his shoulders ≈ 15° left as he reaches (pelvis, spine and chest share it, the head
  turns back): the crown 0.5 m straight ahead (unchanged for G1) comes to the right of his body line, the arm rises
  beside his face.
- **Charred limbs**: a black, matt crust broken into plates by dark fissures with only a little red deep in them,
  blisters, a fine ash dusting, small greasy spots; the charred head's ears fold back flat. The "white rims" were the
  ground seen through openings: the cut faces' half-lenses (one faced into the loft and was culled) are now closed
  lenses covering the loft's ripple, and the oketz's fat tail is seated against the rump (a gap between them).
- **The bare head (setHeadgear(false))**: a short-hair band from the cap down to the nape (GRP.BARE, shown only when
  the headgear is lifted), kept behind the ears' line where the skull still bulges. The ketonet's round neckline below
  is the garment's; a thin gap behind the jaw is the beard's edge (both unchanged).
