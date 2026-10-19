# people-realism-fix — decisions

Format: **Choice** — why (source / reasoning) — alternative. Fixes the review of `people-realism` (findings 1–11).
Before: the reviewer's `shots/people-realism-review/*.png` and `shots/people-realism-fix/before/`. After:
`shots/people-realism-fix/after/` (harness = `src/people/dev/shot.mjs`; `app-*` = main app via `tools/shot.mjs`).

## 1. Robes over the legs when kneeling, prostrating and lying (finding 1)

- **Root cause (measured, not guessed):** the cage made the robe below the knee follow the shin rigidly. A section
  of the robe's own girth then becomes a horizontal tube about 35 cm tall round the legs. Its upper side stood about
  15 cm proud of the calves ("flags", seen from the side). Seen from behind you look into its open end: the far
  inner wall is back-face culled, so the shins look bare and the hem facing reads as a floating loop. The CPU
  skinning probe (`src/people/dev/skin-probe.mjs`) showed no torn or inverted triangles, only this gaping tube.
- **Skin-space cage pass `clothSkin` (cloth.js)** — run after `poseToSkin` on every baked frame and on every
  cross-fade scratch frame (anim.js). Each cage section (hip→knee, knee→hem) that lies near-horizontal is
  pre-multiplied by an affine squash:
  - vertically, its top comes down to just over the leg, and its underside goes just under the leg, or below the
    floor where the leg rests on it, so no band of cloth lies on the floor round the feet;
  - across, toward the legs (tighter at the ankles).
  It fades in with how horizontal the section lies, so standing, walking and sitting shins are untouched. It costs
  nothing at runtime and needs no extra vertex attributes. — Alternatives: more cage bones (the front and back
  panels fold opposite ways) would exceed `MAX_BONES` 36; double-sided garments double the fill and still gape.
- **Left/right cage divergence capped at 12°** (`capPair`) — legs spread in prostration stretched the cloth
  between them into a web.
- **The hem's inner facing takes exactly the hem ring's weights** (evaluated at the hem height): the facing can no
  longer separate from the hem.
- **Full prostration: the legs rest on the floor** (`keyFlat`: hips flexed 12.5° toward the floor, knees −12°,
  feet −66°; legs 5° apart instead of 11°). The chest-supported pelvis left knees and ankles 14–17 cm in the air.
  Prostration is "pishut yadayim veraglayim", hands and feet stretched out (Shevuot 16b, report §35.2), not
  legs splayed; the exact angles are reconstruction.
- **Mantle sides follow the upper arm at 0.42 instead of 0.75** — with the arms raised (prostration, sleep) the
  sides stood up as wings.
- **A kohen asleep under his own mantle does not also wear it** (mask bit 1 off while the `folded_garments` cover
  shows) — Tamid 1:1 "they covered themselves with their own clothes".

## 2. The Kohen Gadol (findings 2, 8, 11)

- **Ephod, choshen, cheshev and shoulder pieces: the woven far average is baked into the vertex colour
  (`EPHOD_AVG`, human.js)**, so they hold their colour where the weave pattern is not drawn (low-tier LOD1, every
  LOD2). They were white there. The pattern now starts from that colour.
- **Gold read: a gold specular for the far average (`pSpec`, people material)** — the ephod's threads twist 4 gold
  strands with 6 each of techelet, argaman, shani and shesh (Yoma 72a; Rashi Shemot 28:6). The gold was "beaten
  into plates and cut into threads" (Shemot 39:3): flat foil reflects far more than its share of the area. So the
  far cloth has an F0 of `mix(0.04, gold, 0.5)` at roughness 0.34, and the diffuse average leans a quarter
  toward gold. The strand count is unchanged; strands still resolve within arm's reach. That the cloth reads
  "gold-shot" rather than mauve is **reconstruction** of appearance. — Alternative: metalness on a mauve base gives
  a pink-grey specular (the old look).
- **Techelet deepened to `#183b74` (a clear zenith blue), not blue-violet** — partly rejected. The research says
  "sky-blue": report Part VII (`07_materials.md` lines 61 and 96), and Rambam Tzitzit 2:1, "dyed like
  kachal… the likeness of the firmament… in the clarity of the sky". So the me'il, tzitzit and embroidery use a
  deeper sky blue, which also separates the Kohen Gadol from the white kohanim. A violet hue would contradict the
  sources. The exact shade is **reconstruction**.

## 3. Animals (finding 3)

- **Fleece is opaque, clumped geometry; the alpha-dithered strand shells are gone** (screen-door stipple at mid
  range). The geometry lock field keeps only octaves of 4 cm or more, which the mesh can carry; the 1–3 cm octaves
  aliased into "crumpled paper" facets. Finer crimp and crevices are drawn in the shader. The vertex darkening of
  the crevices was cut to a third (it read as camouflage blotches). The dead shell shader block (pattern 24) is
  removed. — Alternative: alpha-to-coverage needs MSAA, which the app's post pipeline does not guarantee.
- **Leg wool tapers out above the knee and hock** into the short brown hair (the radius closes onto the leg and the
  locks flatten); the hair tube starts inside the wool. No woolly sleeves with open cuffs.
- **Sheep head** (lamb, ram):
  - a visible nose pad. The old rhinarium sat inside the muzzle dome and never showed.
  - oblique comma nostrils, the lip line back to the mouth corner, the cleft upper lip, and a chin/lower lip on the
    jaw bone.
  - larger lidded eyes, with the upper lid over the top of the eyeball.
  - two-sided cupped ears: leaf-shaped, a pale inner face turned forward.
  - The shapes are **reconstruction**.
- **The alyah is a heavy pad** — narrow at the tail root, broad and thick where the fat sags toward the hocks, two
  lobes with a groove, and the bare skin on the side toward the legs. The tail tip is woolly and turned up.
  Vayikra 3:9, Tamid 4:3; the shape follows the Awassi type (**reconstruction**).
- **Goat:**
  - a beard rooted in the underside of the chin;
  - one pair of laterally flattened scimitar horns from closer-set bases;
  - long hair parted near the spine, falling over the flank as a 2–3 cm layer with a soft, wavy lower edge and a
    closed underside (no saw-tooth "hula skirt");
  - vertical lock relief on the coat and a less glossy roughness (the long-coat pattern now 0.66, not the 0.45 of
    combed human hair);
  - the hair layer thins into the body at its front and rear ends, so it has no open edge.
- **Bull:** the barrel runs on into the neck as one surface (no seam where a separate neck tube met it). More
  segments, and the per-ring ribbing that faceted the flank is now smooth.
- **Bound pose (Tamid 4:1):** the legs stand out from the belly toward the slaughterer, with fore and hind feet
  drawn together in pairs where the holders grip them. Before, they folded under the belly inside the fleece. The
  neck is drawn back less, so the head (south, face west) stays visible from above while the throat faces east.
  Side, akedah and held-not-tied are unchanged (see `people-realism.md`).

## 4. Faces, hands, garments (findings 4–7)

- **The seam down the forehead and nose was geometry, not normals:** the nose-bridge ridge (`prot`) was never faded
  above the brows, so a 6 mm keel ran up the whole forehead, next to a central groove from the face flattening.
  The bridge now starts at the nasion, and the flattening is broad (no groove).
- **Calmer eyes:**
  - the upper lid sits lower over the iris;
  - the lower lid touches the iris;
  - a lid shadow falls on the eyeball;
  - the sclera is less white.
- **The beard's lower edge** is fuller and slightly pointed under the chin, broken into uneven locks; there is no
  straight cut.
- **Nasolabial folds** for adults.
- **A per-figure skin undertone** (ruddy to olive), on top of the existing light-to-dark range.
- **Relaxed hands** (stand, walk, idle):
  - curl 30/22 at the finger groups;
  - a modelled cascade of 2/6/12/19° from index to little finger;
  - fingers set closer together;
  - the thumb along the side of the index (not splayed forward);
  - a rounder, thicker palm.
- **Mantles:**
  - no separate collar tube (it read as a torus standing off the neck); the sheet's top row rolls in instead.
  - each front panel hangs to the shin with a square outer corner. From there the edge steps up over the arm and
    falls in a curve to the middle of the back, so it is no longer a board.
  - below the elbow the sides narrow toward the hem; more and deeper folds.
  - the tzitzit hang at the four bottom corners of the two front panels (Bamidbar 15:38).
  - How the shawl was draped is **reconstruction**.
- **Head-cloth:** offset along the head's own normal, so the crown no longer pinches into a cowl's point.
- **Avnet:**
  - The embroidery faded on the wrong period: `P_NY(0.006)` was applied to a 2.6 cm motif, so it vanished beyond
    about 1.5 m. It now uses the motif's own period, and the far average is baked into the vertex colour
    (`AVNET_AVG`), so the band reads coloured from the front at any distance and on low tier.
  - The band is thinner, with flat windings and square edges.
  - Rambam Klei HaMikdash 8:1, 8:15, 8:19; the design itself is **reconstruction**.

## 5. Props (finding 9)

- **The head goes up unflayed, with its hair, ears and horns.** This reverses the earlier "head flayed"
  reconstruction. Tamid 4:2: "he flayed downward until he reached the breast; on reaching the breast he cut off
  the head and gave it to the one who won it". The flaying of the hung lamb stops at the breast and the head comes
  off then, so it is never flayed.
  - `limb_head` is baked from the live lamb's head and placed as Tamid 4:3 describes: nose toward the arm, horns
    between the fingers, the place of slaughter uppermost (windpipe and gullet shown), the peder laid on it.
- **Flayed limbs:** a paler, creamier fell, where the red muscle shows through thin patches (pattern 20; the loose
  fat stays creamy); rounded ribs on the flank instead of striped boxes; rounded sternebrae and rib cartilages on
  the breast.
- **Machtot are fire-pans:**
  - a floor with rounded corners, walls flaring to a rolled rim, and a low front lip for scooping and pouring;
  - a socket and collar on the back wall with the handle set in it, ending in a knob (or the ne'ashtik ring on the
    Yom Kippur pan);
  - the per-variant capacity (4/3 kav), wall thickness, handle length and metal are kept (Yoma 4:4, 44b);
  - the form follows the period's fire-shovels (**reconstruction**).

## 6. Draw calls (finding 10)

- **At most 14/22/34/56 distinct prop batches per frame (low/medium/high/ultra), handed out nearest first**
  (system.js `PROP_BATCH_CAP`). Each prop × grip × hand × LOD is its own instanced batch. Beyond the cap a rare prop
  far away is not drawn; a burning torch always is.
  - Measured in the app's worst view (`?debug=people&at=255,96&look=0,-4`): people batches went from 76 to 58 on
    medium and from 58 to 42 on low.
  - Harness dense view: 58 → 49 on medium.
  - Alternatives: one atlas batch with per-instance prop selection would multiply vertex work per instance by the
    atlas size. `BatchedMesh` cannot carry our per-instance animation attributes.

## Tools

- `node src/people/dev/skin-probe.mjs <recipe> <rig> <clip> <phase> [lod]` — skins a figure on the CPU for one clip
  frame and prints, per rest-height band of the garments below the seat, the skinned height range, the vertices
  under the floor and any inside-out triangles (set `OBJ=file.obj` to dump the mesh).
- `node src/people/dev/joints.mjs <rig> <clip> <phase> [bones]` — world joint positions of a clip frame.
