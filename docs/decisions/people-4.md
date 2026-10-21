# people-4 — decisions

Format: **Choice** — why (source / reasoning) — alternative. Builds on `people.md`, `people-realism*.md`, `people-3*.md`
(all still valid unless noted). Requests from `choreo-g4-courts*.md`, `choreo-g5-offerings*.md`, `choreo-g6-shabbat.md`,
`sim-core-2.md`. Shots: `shots/people-4/` (finals: `lineup-{low,high}-{close,medium}-*.png` in the people harness,
`app-{low,high}-*.png` in the app); work in progress in `shots/people-4/wip/`. The lineup is `?debug=people` rows J–L
(`&rows=p4` builds only them, from Y 103; `&p4fix` adds the kneading table and the Golah wheel the poses assume).

**Partly superseded by `people-4-fix.md`** (the scale rule for wave_under / crank / knead, the metzora's rent, the
atifah, the eimurim layout, the flaying skirts' layers, hide_goat, razor, the sherds, sal_matzot's tray grip, dough).

## Eating the showbread

- **`eat`: a piece held between thumb and curled fingers, its broken edge out of the top of the fist, raised to the
  lips (0.1–0.3), bitten (0.36–0.42, the hand pulls a little down and away), lowered (to 0.64), chewed (small nods of
  the head) to the end of the loop; the left arm at rest. Baked for every rig.** — The share is eaten standing in the
  court (Rambam MK 10:3; BhB 7:6), by hand. A first version held the piece on the open palm turned toward the face; from
  the front the hand hid the bread and it read as covering the mouth (`wip/c-eat-a.png`). The rig has no jaw bone
  (MAX_BONES 36): chewing is the head's small nods. — Palm-up "presenting" the piece (the wrist would have to bend back).
- **`bread_piece`: a corner broken off a showbread loaf — a piece of the floor with the stub of a wall (the loaf's own
  2½-cm crust thickness, `world/heichal/vessels.js`), the pale crumb on three ragged broken faces; ≈ 7 × 6 cm. Grips
  palm (lying on the palm: the `melikah` breaking-morsels beat of `sim-core-2.md` now has bread in it), fist (the eat
  grip: the broken edge along the thumb), tray, free.** — Yoma 39a: since Shimon HaTzaddik a share was "a bean's worth";
  this piece is the size of the Kohen Gadol's loaves broken among his men (the request); a bean-sized morsel would not
  be visible.

## The showbread stack (Menachot 11:4–7)

- **`showbread_stack` (six loaves) and `showbread_half` (three, the Kohen Gadol's half — Yoma 17b, Rambam TuM 4:14):
  each loaf built as vessels.js builds it on the Shulchan — 10 × 5 tefachim, a 5-tefach floor with walls of 2½ folded
  up on two sides (R' Yehudah, 11:5 / 96a), a "breached box" open at both ends (R' Chanina, 94b), walls 1¼ etzba thick,
  leaning out and dipping toward the middle; four 7-etzba horns at the walls' ends curling outward (11:4; the seven
  etzba'ot are the horns' height — Shiltei HaGiborim, report Part X §53).** — The same loaf as the table's, so the
  carried stacks and the table match. Each loaf a touch off line (hand-made).
- **Stacked loaf on loaf, no kanim** — Menachot 11:6: the kanim are pulled on erev Shabbat and laid along the table;
  the bread is changed on Shabbat without them. A six-loaf stack is therefore 6 × 2½ tefachim ≈ 1.2 m tall (at
  R' Chaim Naeh's amah), rising above the carrier's head — the geometry the sources imply; it is not shortened.
- **Carried with the walls toward and away from the carrier, on the forearms well out from the chest (`carry_stack`,
  chosen by the stacks for `carry` / `carry_walk`), leaning back a little, the head turned to see past it** — Menachot
  11:7 says only "two with the two stacks in their hands". Turned the other way the viewer looks into the open troughs
  and the stack reads as a shelf (`wip/c-stack.png`); held this way the solid bread faces the court. The back horns curl
  toward him: held out 0.19 m further than a vessel, they clear his chest by 2–3 cm. Which way the kohanim turned the
  stacks is **reconstruction**. Free: standing on its bottom loaf.

## Carcasses by kind

- **`lamb_slain` (and `ewe_slain`, `goat_slain`, `she_goat_slain`): the slaughtered, unflayed animal (the lamb_dead
  bake by kind) with the shechitah cut across the throat behind the jaw — a dark-red slit, the cut windpipe's pale ring
  — and the fleece or coat about it dark with blood.** — Chullin 2:1 (the gullet and windpipe); the blood itself is
  caught in the mizrak (Zevachim 3:1; Tamid 4:1), so only a soaked patch shows. Grips: tray (`carry_lamb`, in the arms
  as `lamb_dead`), shoulder, free (lying).
- **Shoulder: across the shoulders behind the neck, its back to the rear, the fore legs over the left shoulder to the
  left fist and the hind legs over the right to the right fist, the head hanging limp at the left (`carry_slain`,
  chosen for `carry_shoulder(_walk)`; the legs aimed at the fists by IK in the bake)** — the herdsman's carry of a
  sheep (the period's kriophoros statues); how a slain animal was brought to the hook is not stated (G5 already carries
  it in the arms) — **reconstruction**. A first placement put the barrel through the carrier's head
  (`wip/c-slain-shoulder.png`); its belly now lies on the trapezius behind the neck. No `ram_slain`: a ram is too heavy to
  carry so (G5 keeps its live-actor stand-in or a hook nearby).
- **Hung states by kind (origin at the hook, free): `ram_hung`, `goat_hung`, `ewe_hung`, `she_goat_hung` (the live rig
  of that kind in the hanging pose); `carcass_flaying_{ram,goat,ewe,she_goat}`; `carcass_hung_{ram,goat}`** — Tamid 4:2
  (pierced through the hock, hung, flayed down to the breast, the head cut off there). Proportions against the lamb's:
  ram 1.22 long and full, the fat tail 1.3×; goat 1.07 long and 0.88 slim, the fell redder (a goat carries less fat over
  the muscle) and **no fat tail** (a goat's tail is a short stub; Vayikra 3:9 gives the alyah to sheep only); the ewe a
  touch smaller. A flayed ewe or she-goat is drawn as the lamb's or goat's (the difference does not show).
- **The flaying carcass's head is now baked from the live animal of its kind (horns, ears, face), hanging nose-down
  below the turned-back hide, the throat cut on its underside; the goat's hide hangs as its long black hair** — the old
  lamb head was a brown ellipsoid; a goat or ram needs its horns. This also changes the existing `carcass_flaying`
  (same name, same frame).
- **`hide_goat`: the goat's hide, its black hair outside, folded once, the pale inner face at the fold, locks over the
  edges** (Zevachim 12:3, Middot 5:3: the hides of the most-holy to the Parvah).

## The chatat's females (Vayikra 4:28, 4:32)

- **`ewe`: the lamb rig and fleece, female (a small udder, two teats, no scrotum) and polled; `she_goat`: the goat rig,
  female, horns ×0.55 and beard ×0.55** — the individual's chatat is a she-goat (se'irat izim) or a ewe lamb (kivsah).
  That the region's fat-tailed ewes were hornless is **reconstruction** (Awassi ewes are mostly polled; the male yearling
  keeps its short horns, Tamid 4:3). The young female's udder is small; under the ewe's fleece it hardly shows. Same
  clips as their rigs (bound, led, …).

## The fats (eimurim)

- **`eimurim` in a silver basin: the alyah (a broad two-lobed pad, the cut through the tail at its root showing the
  vertebra), the two kidneys in their white suet (opened enough to show the kidney), the lobe of the liver, the caul as a
  thin lacy sheet folded at the front, small lumps of the fat stripped from the innards; `eimurim_goat` the same without
  the alyah** — Vayikra 3:9–10 (sheep: "the whole alyah, cut off near the backbone"), 3:14–15 (goat), 4:8–9; one kohen
  takes them up in a vessel to be salted (Rambam MK 6:4; choreo-g5-offerings-fix). Raw fat is drawn plain and waxy (the
  carcass's fell pattern shows red through it — a first version looked blotched pink: `wip/c-eimurim.png`). Grips
  tray, palm, free; kept drawn at LOD 2 in an actor's hands (HELD_VESSELS).

## Tenufah together and the bikkurim

- **`wave_under`: the kohen's palms up beneath the owner's hands, following the owner's `wave` exactly — the owner's
  palm centres (from the same formula as `wave`) mirrored into the kohen's frame at WAVE_UNDER.partner = 0.74 m (≈ 1.55
  amot, origin to origin, facing each other) and dropped 3.6 cm (under the backs of his hands); he leans back as the
  hands come toward him. Give both the SAME phase.** — Menachot 61b ("the kohen puts his hand under the owner's hand and
  waves"); Rambam MK 9:6. At G5's 1.3 amot the kohen's wrists would be 16 cm before his chest — `carry`'s palms were only
  roughly under the owner's and held still (G5's request). **Requested from G4/G5: stand the pair WAVE_UNDER.partner
  apart and drive both clips with one phase.**
- **The bikkurim: `wave` with the `basket` now chooses `wave_basket` — the owner holds the basket by its rims (the
  right fist on the right rim, grip class 'rims'; the left on the left) and its bottom follows the path of the palms in
  `wave`, 2 cm lower, so the same `wave_under` meets it** — Bikkurim 3:6 ("he holds it by its rims, the kohen puts his
  hand beneath it and waves it"). One clip serves both waves.

## Work poses

- **`crank`: the Golah wheel (courts/chambers.js — 8 hand-spokes out to r 2.65 amot on a wheel of r 2.1, the axle 5.2
  amot up). CRANK: the operator east of the wheel facing it (heading 270), 0.84 amot from its plane and 1.85 amot south
  of the axle — the hub 0.89 m up to his right; each hand in turn pulls a spoke down through φ 126°→171° (a spoke step
  of 45° per half cycle; the wheel turns π/2 per cycle), the other going back up clear of the spokes; his hips and
  shoulders follow the pulling hand down to his right. phase = CRANK.phaseAt(wheel rotation).** — Middot 5:4 ("the wheel
  placed on it"); the spokes' side going down as chambers-daily turns it to raise the bucket. The spot is set by the
  chamber's posts and braces: nearer the axle the brace's foot is in his legs; at G4's spot (1.25 amot out) the upper
  spokes are out of reach. Reach measured over the cycle (`p4-reach` probe): on the spokes everywhere except across the
  hand-over at 0.44–0.5, where the hands slip 5–9 cm off for ≈ 0.2 s (the hub up to his right forces the left hand's
  stroke across his body; the alternative — both hands letting go together — would let the loaded wheel run back).
  **Requested from G4: stand the operator at CRANK.stand (X ≈ 95.94, Y ≈ 384.15 for the wheel at X 95.1, axle Y 386),
  pose `crank` with phase CRANK.phaseAt(the wheel's angle)** — 'sweep' until now. Letting it run back: the same clip
  played backwards from the wheel's angle.
- **`knead`: bent over a trough or table whose working surface is KNEAD.surface = 0.78 m high, the dough KNEAD.reach =
  0.42 m ahead: the heels of both hands push the dough forward and down (0–0.45), the fingers fold the far edge back
  (0.45–0.75), a press (0.75–1)** — the meal offerings kneaded (Menachot 5:1–2; Rambam MK 12:23) and the showbread's
  dough (Beit Garmu, Yoma 38a). The surface height is **reconstruction**. Replaces G4's `kemitzah` stand-in.

## The nazir shaven, the metzora, mourners

- **Hair and beard are mask groups (GRP.HAIR 6, GRP.BEARD 8, on by default) with a shaven scalp (GRP.SHAVEN 7) and a
  shaven jaw (GRP.SHAVEN_FACE 9) drawn instead; `Actor.setShaven('head' | 'all' | false)` switches them on the SAME
  actor — the seed, face, skin, build and garments do not change; role `nazir_shaven` is the nazir shaven from the start
  (the same seed gives the same man as `nazir`: identical role ranges and draws). The figures that carry the groups:
  israelite (and the roles dressed as one: mourner, menudeh, kohen_offduty), nazir, nazir_shaven, metzora.** — The nazir
  shaves his head at the end of his term (Bamidbar 6:18; Nazir 6:8 — in his chamber, Middot 2:5); the beard is not
  part of the nezer. No extra draw calls: hidden groups collapse in the vertex shader (≈ +0.6k / 0.16k / 24 triangles at
  LOD 0 / 1 / 2 per israelite-type figure).
- **The shaven scalp: a skin shell 0.7 mm over the skull within the hairline, paler and a touch cooler than the face
  (long under the hair; the razor's stubble), fading into the forehead and nape at its edge** — a bare skull alone shows
  the face's tan up to the crown.
- **`setShaven('all')`: head, beard and brows** — Vayikra 14:9 (the metzora's seventh day: "all his hair: his head, his
  beard and his eyebrows"). The brows go in the face shader by the same mask bit (256).
- **`metzora`: as Vayikra 13:45 describes the declared metzora — the tunic rent at the breast (a V from the neckline,
  20 cm, the chest showing, the frayed edges turned out), the hair let grow long and uncombed, the beard untrimmed** —
  Rambam Tumat Tzara'at 10:6 (rending; no haircut or washing of clothes "all the days of his declaration"); Rashi/Moed
  Katan 15a ("paru'a" = grown hair). Not modelled: the wrap over the upper lip ("al safam ya'teh", like a mourner's
  atifah — it would hide the face; the head-cloth group can stand in) and the head covering the Rambam's text adds.
  **Note for G4:** the metzora in the Mikdash is only the healed one on his eighth day, who has shaved all his hair on
  the seventh and washed his clothes (Vayikra 14:8–9) and is no longer bound by 13:45 (those apply "all the days of his
  declaration") — draw him as `israelite` (or a mourner's colours if wanted) with `setShaven('all')`; the `metzora` role
  is the declared metzora, who never comes inside the city (Kelim 1:7).
- **`setGarb('black' | 'white' | null)` (and `spawn({ garb })`, `crowd({ garb })`, `Crowd.setGarb`): the tunic, mantle
  and head-cloth classes in black or white wool, keeping each figure's own shade; roles `mourner` and `menudeh` —
  israelite figures with the head wrapped (atifah) and black by default** — Middot 2:2 (they go round to the left);
  Moed Katan 15a (the mourner wraps his head; for the menudeh the Gemara leaves it open — he is wrapped here as in G4,
  **reconstruction**); the colour from the period's mourning dress: Josephus, War
  2.1.1 (Archelaus "put on a white garment" when his seven days ended), Bava Metzia 59b (R' Akiva "dressed in black and
  wrapped himself in black" to tell R' Eliezer of the ban), Middot 5:4 (the kohen found unfit "dresses in black and wraps
  in black"; the fit one in white). Black is a dark undyed wool (#2a2622), not a dye-black. The palette carries the
  four garb colours at 14–17 (tint index 4 = black, 5 = white).

## Props

- **`sal_matzot`: a shallow willow basket with two handles, ten challot (thick, glossy with oil) and ten rekikin (thin
  wafers) in two piles** — Bamidbar 6:15; Menachot 7:2 (the nazir's loaves: matzot only, challot and rekikin, no revuchah), 76b (ten of each).
  Grips tray, shoulder, fist (a handle), free.
- **`razor`: a broad iron blade with a curved edge on a short bone handle** — the ta'ar (Bamidbar 6:5, 6:18); the form
  after the period's razors (**reconstruction**). Fist, free.
- **`clay_pot` / `clay_pot_broken`: the Jerusalem cooking pot of the period — thin red-brown ware, ribbed shoulder,
  short neck with an everted rim, two strap handles, the base sooted; broken = its sherds on the floor** — the nazir's
  shelamim cooked in his chamber (Middot 2:5; Nazir 6:8); "an earthenware vessel in which it was cooked is broken"
  (Zevachim 11:7). Form after Herodian Jerusalem pottery (**reconstruction**). Matte unglazed (the flour pattern's grain).
- **`coins`: three silver (Tyrian shekels and half-shekels) and three small bronze prutot** — the sanctuary's coin was
  the Tyrian ("in the Tyrian maneh", Mishnah Bekhorot 8:7); for the chests (Shekalim 6:5) or the seals (5:4). Palm (lying on the open palm),
  fist, free.
- **`measure`: the isaron in silver, straight-walled, as deep as wide, holding a tenth of an ephah (43⅕ eggs ≈ 2.5 l at
  R' Chaim Naeh, scaled with the amah), heaped with fine flour** — Menachot 9:1 (the two dry measures: the isaron and the
  half-isaron), 9:5 ("all the measures in the Mikdash were heaped"). The form and metal are **reconstruction**. Tray,
  palm, pour (pour_low tips it over the rim), free.

## API changes

- **`setProp(null)` empties both hands** (a left-hand prop set with `setProps` goes too); `setProp(name)` still changes
  only the one prop. The sim's work-arounds (g1/util.js, g4/sets.js, private-offerings — `setProps(null, null)` before
  `setProp`) keep working and may be dropped.
- Additive only otherwise: roles, animals, poses, props, grip class `rims`, `Actor.setShaven/shaven/setGarb/garb`,
  `Crowd.setGarb`, `spawn({ shaven, garb })`, `crowd({ garb })`, `ctx.people.stations.{crank, waveUnder, knead, eat}`,
  clip aliases achilah→eat, lash→knead, galgal→crank, tenufah_under / wave_beneath→wave_under.
- Internal: the palette is 18 colours (pal() appends the garb colours), `uPPal[18]`, program key v7; `slabC` (slab with
  its poles closed — the superellipsoid's exponent opened a square hole of ≈ 13 % of the side at each pole of slab();
  the older props keep slab()).

## Requests to other tasks

- **G4 (chambers-daily, g4/sets.js):** the Golah operator at CRANK.stand with `crank` driven by CRANK.phaseAt(the wheel's
  angle) (was 'sweep' at [96.35, 384.35]); `knead` for the kneaders (was 'kemitzah'); the shaven nazir as the same
  `nazir` actor with `setShaven('head')` (was an Israelite in a head-cloth with a matching seed); the eighth-day metzora
  as an `israelite` with `setShaven('all')` (see above); the mourners and the banned as roles `mourner` / `menudeh`
  (or `setGarb('black')` on their pool); `sal_matzot` for the nazir's basket (was `loaves_todah`), `clay_pot` /
  `clay_pot_broken` (was `wine_jug`), `measure` for the isaron, `coins` for the chests, `razor` for the shaving (was
  `knife_flay`).
- **G5 (private-offerings):** tenufah and the bikkurim with the pair WAVE_UNDER.partner (0.74 m ≈ 1.55 amot) apart, the
  owner in `wave` (with the basket for the bikkurim — it holds it by the rims) and the kohen in `wave_under`, ONE phase
  for both (was 1.3 amot, 'carry' held still); `lamb_slain` / `goat_slain` / `ewe_slain` / `she_goat_slain` for the
  carry to the hook (was the live actor in 'bound'); the goat and ram hung states and `hide_goat` (goats hung already
  flayed until now); `ewe` and `she_goat` for the chatat; `eimurim` / `eimurim_goat` for the fats carried up.
- **G6 / sim-core-2 (shabbat-mishmar):** `showbread_stack` / `showbread_half` for the stacks (was `loaves_todah`), `eat`
  with `bread_piece` for the eating beat and `melikah` with `bread_piece` (the piece is now in the hands).
- **The sim:** the `setProps(null, null)` work-arounds before `setProp` (g1/util.js, g4/sets.js, private-offerings) are no
  longer needed (kept harmless).

## Verification (2026-10-21, HD 4600; other agents' builds and edits running alongside)

- `npx vite build --outDir .build-people-4`: passes (removed).
- Node: every prop × grip class × hand × LOD builds — 98 props, 752 variants, no NaN, no error
  (`src/people/dev/propcheck.mjs`); every archetype and LOD builds and every clip bakes on every rig with no error
  (`geotime.mjs`; atlas 8468 frames with every rig loaded, +704 frames ≈ +0.6 MB half-float). Crank reach:
  `src/people/dev/reach.mjs crank` (on the spokes except the hand-over slip above).
- Triangles (LOD0/1/2/3): metzora 18.2k / 3.1k / 0.72k / 0.32k; israelite 19.3k / 3.4k / 0.73k / 0.35k (+0.6k / +0.16k /
  +24 for the hidden shaven shells); ewe 9.7k / 2.9k, she_goat 10.8k / 3.1k. Props LOD0/1: showbread_stack 6.6k / 2.9k,
  half 3.3k / 1.4k, *_slain ≈ 10k / 2.8k (baked from the live rigs, like lamb_dead), *_hung ≈ 10k / 2.7k,
  carcass_flaying_* 4.7–5.6k / 1.5–1.8k, eimurim 2.1k / 1.0k, sal_matzot 2.1k / 0.6k, clay_pot 1.9k / 0.4k, coins
  0.7k / 0.4k, measure 0.7k / 0.4k, bread_piece 0.5k / 0.2k.
- Sim harness (src/sim/dev/run.mjs, low), all on this code: g1-night "t=n3" (deterministic on the weekday, Friday and
  Shabbat, nothing failed, props as drawn), g2 "t=alot-60", g3 "t=sunrise+40", g4 "t=d3" (deterministic on three dates,
  no missing cues, the one known close pair), g5 "t=sunrise+150", g6 "date=2026-11-07&t=07:30", shabbat-midday "t=d4"
  (nothing failed, 0 samples wrong), jumps (deterministic, no diffs): every one ok, no console errors.
- `tools/validate-schedule.mjs`: 0 errors, 0 warnings. `tools/coverage.mjs`: no gaps (longest 7 min).
  `tools/nav-coverage.mjs --q low`: 132 targets, only the 2 known Heichal-roof failures (world geometry).
- App (`tools/shot.mjs`, `?debug=people&rows=p4`, sunrise + 2 h): low 37–42 fps, 200–211 draw calls, 0.49–0.62 M
  triangles with the new rows in view; high 21–22 fps, ≈ 1.2k calls (`app-{low,high}-*.png`). Console clean (the first
  cold high boot exceeded the shot tool's 120 s ready wait — shader compiles — and was re-shot with a longer wait).
- Shots: `shots/people-4/lineup-{low,high}-close-*.png` (every new pose, prop, role and animal up close) and
  `lineup-{low,high}-medium-*.png` (rows J, K, L at 6–10 m), people harness with `&p4fix`.
