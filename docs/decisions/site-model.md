# Decisions — site-model (`src/data/site.js`)

Format: **choice** — why (source / reasoning) — alternative. ⚙ = reconstruction-class.
Locks of Part XI are followed as written; the entries below are the choices the locks and sources leave open.

## Frame, units, context
- **Context in meters, sanctuary in amot**: the Kidron, Har HaMishchah, the wall feet and the Chuldah portals are meter profiles relative to the wall faces, converted with `core/units.js` `AMAH`. — The landscape is real (≈740 m platform, ≈675 m Kidron bed, 808 m crest), while the Temple scales with the chosen amah. — Alternative: freeze the context at 48 cm. That would misplace the terrain under the Feinstein and Chazon Ish standards.
- **`site.js` imports `AMAH` from `core/units.js`** (read-only). — The context depends on the page's amah standard. — Alternative: export a `buildSite(amah)` factory; heavier for every consumer.
- **Terrain profile numbers** (E: 712 m at the wall foot, 675 m at 200 m, 740 m at 480 m, 808 m at 800 m; S: 727; W: 722; N: 738) ⚙ — approximate real topography per the brief; the ancient Kidron bed taken ~10 m below today's fill. — Alternative: a DEM (not allowed: no downloaded assets).

## Har HaBayit
- **East walls low = gate head + 2-amah lintel course** ⚙: Mount E +22, Ezrat Nashim E +28, Azarah (Nikanor) E +35½. — Middot 2:4 ("all walls high except the eastern"); lock §58 "court walls … (east low)". The +2 is our choice: EK's "not less than 22" is his minimum for the *high* walls (corrected in site-model-fix). With the real topography the Parah line crosses the EN east wall at ≈+37 to +49. At +46 it is fully blocked, and the undiminished view needs ≤ +36.7 (docs/site-model.md §4). — Alternative: only the wall over the Shushan gate low (Rambam BhB 6:5's wording). That works for the Gemara's level-line model, but the real-topography line is then blocked by the EN east wall.
- **Court wall height = court floor + 40** (EN 46, Azarah 56) ⚙ — the lock's "baseline 40" read per court. — Alternative: 40 above datum.
- **Double stoas: 20 deep (two aisles of 10), roof +20, columns every 10**, uniform on all sides ⚙ — "stav lifnim mistav" (Rambam BhB 5:1) gives no numbers; a roof ≤ the low east wall keeps the Parah line clear. — Alternative: Tavnit Heichal's 30/45-amah stoas (Josephus-derived, not used).
- **Chuldah portals at the Ophel grade (−27 at 48 cm)**, each with a 45-amah level passage north and a stair of half-steps up to the Mount ⚙ — "where the tunnels exit south"; real ≈13 m difference. — Alternative: gates at Z0 like the others (no tunnel).
- **Kiponus, Tadi and Shushan thresholds at Z0**; the exterior approaches are left to the terrain builder. — Unsourced.
- ~~No chamber over the Shushan gate~~ — superseded (site-model-fix): the Shushan HaBirah chamber is modeled over the gate (+22 → +28) with the two standard amot at its NE and SE corners (Kelim 17:9; Part X §48; Part XIV §65.4).

## Soreg & Chel
- **Soreg path 10 amot outside the whole complex, jogging around the projecting parts** (the Gazit's chol half to the west; Beit HaMoked to the north). — Middot 2:3 fixes the chel at 10; lock #26 puts the soreg at its outer line. — Alternative: a plain rectangle 10 out from the court walls, which would make the chel 0 wide at those chambers.
- **Exterior flights of 32 half-steps** from every N/S court door down to the Mount, perpendicular to the wall; the soreg has passages where they cross ⚙ — the +16 court over a Mount at 0 forces them; EK I 202–215 notes they must cross the chel and soreg. — Alternatives: flights parallel to the wall inside the chel; or a raised chel.
- **The 12 chel steps**: in the inner 6 amot of the east chel strip, against the EN east gate, 20 wide ⚙ — Rambam BhB 6:1 (walk level to the end of the chel, then ascend 12). — Alternatives: across the full chel width, or across the whole EN front.
- **Breach stations**: side counts 4N 4S 3E 2W follow the 13 prostrations of Shekalim 6:3, spread evenly along each side and clear of the passages ⚙. — Alternative: EK's breaches opposite the 13 gates.

## Ezrat Nashim
- **Corner chambers: 40 × 40 interior plus 2-amah inner walls**, walls 22 high (top +28, level with the low east wall — site-model-fix), a 20 × 10 door toward the court's E–W centerline ⚙ — Middot 2:5 gives the interior; unroofed.
- **Gezuztra**: balconies 4 deep, floor at +16, parapet 2, along N, S and E between the corner chambers, interrupted over the E gate ⚙. — Alternative: a continuous ring (it would cross the 15 steps and the gate opening).
- **15 steps: landing radius 10½, foot radius 17½**, concentric about the Nikanor threshold ⚙. — The landing must reach both wickets (|Δy| ≤ 10). The music-chamber doors must open onto the EN floor between the foot of the stair and the corner chambers (|Δy| 19½–23½ < 25½). — Alternative: a larger semicircle, which leaves no wall for those doors.
- **Music chambers**: two rooms under Ezrat Yisrael flanking the stair, doors 4 wide × 6 high through the Nikanor wall ⚙ — Middot 2:6 ("under EY, opening to EN"); Part II §4.5 ("flanked the stair").

## Nikanor, EY, EK
- **Wickets 3 × 8 at 7–10 amot off the axis**, each the doorway of a chamber built in the wall: Pinchas HaMalbish to the right (north) and Osei Chavitin to the left (south). The chambers occupy the wall plus 7 amot into EY ⚙. — Middot 1:4, 2:6; Rambam BhB 5:17 ("to the right of the east gate"); EK/Chanukat HaBayit (Part X §48); the 8-amah height follows the attested pishpeshin of Zevachim 55b. — Alternative: free-standing wickets with the chambers elsewhere.
- **Duchan in the east edge of Ezrat Kohanim**: a 1-amah riser with a 1-amah tread ⚙, then 3 half-steps with ½ treads (Rambam BhB 6:3), across the full 135. — Alternative: built into EY's west edge.

## Azarah: gates & chambers
- **Gatehouse roofs at gate head (+36)** for every N/S gate; the six chambers' roofs at the same level. — Yoma 31a–b: gate 20 with a negligible marble roof; Middot 5:4: the north trio's roofs level.
- **Water Gate house stays within the wall's thickness** (30 wide ⚙). Beit Avtinas (20 × 5 × 10 ⚙) and the KG's first-immersion mikveh (4 × 4 × 3 tank) sit on its roof, so the mikveh surface is at +39 = the En Eitam head (Yoma 31a: 20 + 3 = 23). — The 12½-amah margin south of the kevesh is explicit (Rambam BhB 5:15). — Alternative: a gatehouse projecting into the court.
- **Lishkat HaGazit straddles the Azarah WEST wall at its north end** (kodesh east half / chol west half, split at the wall's centreline), 45 × 20 in front of the Etz ⚙ — a reading of lock #7, flagged for sign-off (site-model-fix). — Yoma 25a (Abaye): the lottery was in its *east* in kodesh and the elder sat in its *west* in chol, so the kodesh/chol line runs N–S. Lock #7 puts the trio in the north; the NW corner is on the north side. — Alternatives: straddling the N wall (N/S halves, against Abaye's derivation); EK's east-wall Gazit (Part X §52; it also contradicts Yoma 25a's orientation); wholly inside.
- ~~Etz outside the N wall~~ — superseded (site-model-fix): **Etz = Parhedrin inside the Azarah against and through the N wall, behind the Gazit and the Golah, opening only north to chol** (Middot 5:3–4; Yoma 10a, 11a; Rambam BhB 6:7). — Alternative: Parhedrin south by the Water Gate (Yoma 19a inference; Register #20).
- **South trio between the gates**: Melach between the SW corner and Delek; Parvah and Medichin between Delek and Bechorot; all 12 deep, with Medichin's winding stair up to the Parvah roof ⚙. — The chambers must not block the gates.
- **Beit HaMoked 24 × 24 (lock §58) entering the Azarah only through the 8-amah strip north of the nanasin band** (Y 390–414). Kodesh/chol line at Y 402 (12 | 12) by lock #43's half / half (the wall-thickness argument is dropped — site-model-fix). Floor +16, walls to +36, dome above ⚙. — If the hall were centred on the wall it would push 12 amot into the Azarah, eating the explicit "nanasin → wall 8" of Middot 5:2 at the altar's cross-section; the lock puts the Moked gate opposite the altar. — Alternatives: centred straddle; or wholly outside (Rambam's all-chol camp, Register #43).
- **The Moked gate is the hall's south door** (Y 390). R' Yehudah's pishpash is a wicket in its east leaf (2 × 4 ⚙ — site-model-fix). The chel door is on the hall's north face, with a 32-step flight.
- **Moked corner chambers 5 (along the S/N walls) × 6 inside the hall** ⚙ (were 6 × 6; site-model-fix, so both doors open their full 10): SW lambs (with the splayed corner, lock #8) and SE bakers in the kodesh half; NE altar stones and NW descent in the chol half (Middot 1:6). — EK keeps the lamb chamber in chol; not followed (lock #8 fixes SW).
- **Underground**: a spiral of 56 half-steps from the NW chamber down to −12, a 4-wide vaulted passage north, and the Beit HaTevilah at Y 450–468 (mikveh, medurah, beit kisse) ⚙. — Lock #21 (under the Birah); the Birah's location is open (§20 #8). — Alternative: REbY's route under the chel to Tadi.

## Mizbeach
- **Yesod: N and W full, plus a 1-amah stub beyond each corner on S and E**, none at the SE (structural absence, Rav). — Reading of "eats 1 amah in the south and 1 in the east" (Middot 3:1). — Alternative: the corner squares themselves are the "1 amah" (L-shape only).
- **Where the yesod is absent, the 30-square body stands on the pavement.**
- **Top at 9 whole amot (+25), horns to +26, chut hasikra at +21** (half of the 10). — Locks #2, #3. — Rambam's mixed-amah 58 tefachim, top at 9 less a tefach, is noted on the elements.
- **Kevesh centred on the altar's south face**, 16 wide, rising +9 over its 32-amah run to the 28-square. — Middot 3:3; Rambam BhB 2:13. Centring is unsourced but standard; Tamid 1:4's "corner between the kevesh and the altar, west of the kevesh" requires it not to reach the SW corner.
- **Small ramps as 1:3 branches** (the general ramp slope of Zevachim 63a). The sovev branch leaves the kevesh at +7.47 and drops to the sovev face. The yesod branch drops to +17, then runs level west along the S face to the SW yesod (the only yesod on that side). Each is 2 wide ⚙. — Alternative: level side-landings at the target heights.
- **Machtah niche** on the pavement west of the yesod branch, against the altar's face ⚙ (Tamid 1:4).
- **Marble and silver tables** 1 × 2, 3 amot west of the kevesh at its lower half ⚙ (Shekalim 6:4; Tamid 4:3 limbs on the lower half west).
- **Beit hadeshen**: ≈10 amot north of the kevesh foot along its east side, 3 tefachim off it (Tamid 1:4: "turned to the north, walked to the east of the kevesh about ten amot").
- **Ma'arachot**: the great pile east of the tapuach; the incense pile 4 north of the SW horn (Tamid 2:4–5); the third pile's place is unsourced, set SW of centre and off the axis ⚙ (lock #17). Tapuach r 4 × h 3 ⚙.
- **Rings across the altar's 32-amah width** (4 columns at 8, 6 rows at 4). The tamid "second ring" is read as the 2nd column from the W (morning) or E (afternoon) in the row next to the altar ⚙. — Tamid 4:1; lock #18. — Alternative: a 24-wide field.
- **Tables and nanasin follow Rambam's chain exactly** (wall 8 · mitbachayim 12½ · tables 8 · rings 24 · 8); Middot 3:5's "tables between the pillars" is a logged variant and the flaying stations stand between the pillars (site-model-fix). There is one row of 8 tables (2½ × 1½ × 1½ ⚙) centred in its band, and one row of 8 pillars (1 × 1, shaft 5 + cedar block 1 ⚙) on the mitbachayim's centre line. — Rambam BhB 5:13–15; Middot 5:2's "rings → tables 4, tables → nanasin 4" is the same 8.
- **Kiyor**: 4 diameter × 3 ⚙, mid-strip just south of the 20-wide Ulam steps and inside the altar's N–S span ("between the Ulam and the altar, drawn south" — Middot 3:6; Zevachim 59a). The muchni wheel frame stands south of it, over a well into which it sinks.
- **Ulam steps 20 wide** (= the Ulam opening) ⚙. Treads 1,1,3 ×3 + 1,1,4 = 21 (lock #25), giving exactly four rovadim, as the "fourth rovad" of Yoma 4:3 requires. The 22nd amah is a level apron at the foot ⚙ (the report's "run 22" only follows from R' Yehudah's 5 — flagged, site-model-fix). — Alternatives: R' Yehudah's top landing of 5 (21 + 1 = 22 with no apron); a stair across the full 100-amah front (the kiyor would then stand on the steps).

## Heichal
- **Ulam interior height 40 (ceiling at +62, = the Kodesh)**, with the same ceiling courses to +67. The Ulam block above is a closed storey to +107, then the roof courses to +112 ⚙. — Unsourced.
- **Ulam end walls 5** ⚙. **The Heichal east wall (6) continues across the wings** as their rear wall.
- **Lintels and the stone courses between them, 1 amah each** ⚙ (Middot 3:7 gives the lengths).
- **The north wicket sits in front of the NE ta** (Y 348–351), so the officer enters the ta and then the Heichal (Middot 4:2, Tanna Kamma). Wickets are 3 × 8 ⚙. — Alternative: R' Yehudah, walking inside the wall's thickness.
- **NE ta with five doors on the lower story** (Middot 4:3 plain). — Rambam: the middle story.
- ~~Ta'im: 3 stories of 15 filling +22 → +67~~ — superseded (site-model-fix): **3 stories of 11 → roofs +55** ⚙, below the F1 windows (Part VII §22), with a 24-step flight on the south roof to the aliyah door. The Heichal walls step back 7/6/5 so that wall + ta = 12 at every story (Middot 4:4). Partitions 1 ⚙. — Alternative: roofs at the aliyah floor (+67) for a level walk (Middot 4:5 does not say it is level).
- **F1 windows**: a band at +56 to +61 in the Kodesh N/S walls, 5 per side ⚙, now opening to the air above the ta'im roofs (+55), as Part VII §22 says (site-model-fix).
- **F2**: two windows 2 × 4 at +48 to +52 above the gate, with the golden vine below them (+42½ to +47) ⚙ (Bartenura on Middot 3:8; lock #28).
- **Parochot inside the traksin amah**: a tefach each, 4 tefachim clear (1 + 4 + 1); outer pinned back at its south end, inner at its north. — Lock #42; Yoma 51b–52b. — Alternative: SG's clear amah (1⅓ overall).
- **Shulchan top 10 × 5 tefachim (lock #31), height 1¼** — the 1½ "amot" in R' Yehudah's 5-tefach amah, kept consistent with the lock. — Alternative: 1½ (6-tefach amah).
- **Vessel stations**: the Shulchan and Menorah centred in the inner two-thirds (X 130.33; Rambam BhB 3:17), 2½ off the walls (Yoma 33b). The golden altar is 2 amot east of their line, on the axis ⚙. Menorah base 2 × ½; the three-step stone on its north (front) side ⚙.
- **Sotah slab**: 1½ north of the gate jamb and 1 amah in from the wall face, clear of the inner door leaf ⚙ (Sotah 2:2; SG perek 33 places it north).
- **Even Shetiyah 2 (E–W) × 3 (N–S), 1 amah off the west wall** ⚙ — at least the Aron's 2½ × 1½.
- **Aliyah door 20 × 10** (Middot 2:3 standard) in the aliyah's own south wall at X 132–142 — centred on the aliyah's part over the Kodesh (X 117–157) — with two cedar posts outside on the landing of the roof stair ⚙.
- **Ta'im roofs get a 3-amah parapet** ⚙ by analogy with the ma'akeh (unsourced).
- **Main roof and ma'akeh/kalya orev only on the aliyah block + the Ulam block** (the T outline). Parapet thickness 1 ⚙.
- **The lul behind the Kaporet** pierces the KhK west wall, the axial west ta and its outer wall (EK II 178–179: 4 tefachim wide); 8 high (Zevachim 55b).
- **Beit hachalifot wickets** in the wings' west walls, 3 × 8, opening onto the court flanks ⚙ (Zevachim 55b): sanctity openings, not routes (`walkThrough: false`).

## Sample coincidences (re-derived; reviewer finding 10)
Four reconstruction values equal the sample manifest's. Each follows from the research constraints below, so they are kept; the coincidence is recorded so a reviewer can judge.
- **Lulin hatch X 105–107 × Y 329½–331½** — Middot 4:5 has hatches "open in the aliyah into the KhK"; one 2 × 2 hatch is centred over the KhK (X 106 = (96 + 116) / 2, Y = the axis) ⚙. The Mishnah has the plural; one is shown.
- **Kiyor X 188–192, 4 across, 3 high** — X 190 is the middle of the 22-amah strip "between the Ulam and the altar" (Middot 3:6); 4 across so 12 kohanim stand round its 12 spigots at once (Yoma 37a; Tamid 3:8 — circumference ≈ 12½); 3 high ⚙. Its Y (south of the 20-wide Ulam steps, inside the altar's N–S span) differs from the sample's.
- **Gezuztra floor +16, 4 deep** — 10 above the EN floor ⚙, which puts the women's eyes (≈ +19½) above the Levites standing on the 15 steps' head (+13½) and the men below (Middot 2:5; Sukkah 51b); 4 deep ⚙ holds two standing rows. The sample's ring through the chambers and gates is not used.
- **Aliyah door from X 132** — centred on the aliyah's part over the Kodesh (X 117–157, centre 137), not over the KhK (Middot 4:5).

## Zones
- **Chel** = the soreg-enclosed region at priority 10, with Z up to +12. The courts and chambers override it with higher priorities.
- **Bein ha-Ulam la-Mizbeach** spans the full court width (Kelim 1:9 grades the strip); **slaughter-zone** = the Tzafon rectangle (Rambam BhB 5:15–16), below EY/EK in priority.
- **Shared ids**: the gate zones include each gate's exterior flight; `gate-moked` includes the hall's two doors and its flight.
