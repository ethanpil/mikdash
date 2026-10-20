// =============================================================================
// Mikdash — SITE MODEL  (src/data/site.js, owner: site-model task)
// =============================================================================
// The ONLY geometric authority for the 3D builders (ARCHITECTURE.md §4).
// Written as a parametric derivation: every number is a named constant carrying
// its citation, and every element is computed from those constants.
//
// Authority: ../report/parts/*.md (esp. §0.3–0.4, Parts I–V, VII §22, IX §37–38,
// X §46–52, XI locks, XIV §64) and the Hebrew primary texts in ../sources
// (Mishnah Middot was checked against the Hebrew line by line; Tamid, Parah,
// Shekalim, Rambam BhB 2–6, Yoma 16a–19a/25a/31a and Zevachim 53b–63a at the
// loci used). The sample manifest (../engine/temple_manifest.json) and the
// diagrams were NOT used as sources; differences are listed in
// docs/site-model.md. Non-obvious choices: docs/decisions/site-model.md.
//
// Frame: X = east, Y = north, Z = up, in amot (building amah = 6 tefachim).
// Origin = SW corner of the 500 x 500 clear interior of Har HaBayit.
// Z = 0 = threshold of the eastern gate of Har HaBayit (Shushan gate).
// The surrounding landscape (Kidron, Har HaMishchah) is meter-native and is
// converted with the page's amah standard (core/units.js AMAH).
//
// confidence: 'explicit'  — the number is stated in a primary source
//             'derived'   — follows arithmetically from explicit numbers
//             'locked'    — fixed by a Part XI lock (a choice between sources,
//                           or an Ezrat Kohanim placement lock ⚙)
//             'reconstruction' — the sources do not fix it (kept modest)
// An element is labelled by the WEAKEST number that defines its box. params.fieldConfidence records the
// stronger parts (e.g. { interior: 'explicit', height: 'reconstruction' }). runChecks() enforces: any ⚙ in an
// element ⇒ confidence 'reconstruction', or a fieldConfidence entry naming the ⚙ part 'reconstruction'.
// =============================================================================
import { AMAH } from '../core/units.js';

// -----------------------------------------------------------------------------
// 0. Small helpers
// -----------------------------------------------------------------------------
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const sum = (a) => a.reduce((s, v) => s + v, 0);
function bx(x0, y0, z0, x1, y1, z1) {
  return {
    min: [r6(Math.min(x0, x1)), r6(Math.min(y0, y1)), r6(Math.min(z0, z1))],
    max: [r6(Math.max(x0, x1)), r6(Math.max(y0, y1)), r6(Math.max(z0, z1))],
  };
}

// -----------------------------------------------------------------------------
// 1. CONSTANTS (with citations)
// -----------------------------------------------------------------------------
// --- units ---
const TEFACH = 1 / 6;                    // building amah = 6 tefachim (Kelim 17:9; Rambam BhB 2:6)
const ETZBA = TEFACH / 4;                // 4 etzba'ot per tefach

// --- the standard opening and step (Middot 2:3) ---
const GATE_W = 10;                       // "all the openings and gates there were 10 wide" — Middot 2:3
const GATE_H = 20;                       // "... 20 high", except the Ulam's — Middot 2:3; Rambam BhB 5:2
const STEP_RISE = 0.5;                   // "rise of a step ½ amah" — Middot 2:3
const STEP_TREAD = 0.5;                  // "its tread ½ amah", except the Ulam's — Middot 2:3
const LINTEL_COURSE = 2;                 // ⚙ lintel/coping course over a 20-amah gate head. EK I 174's "not less than 22" (= 20 + 2) is his
                                         //   minimum for the HIGH walls; the low east walls are his stated exception, so their +gate+2 is our choice
const SHUSHAN_CHAMBER_H = 6;             // ⚙ Shushan HaBirah chamber over the E gate (Kelim 17:9; Part X §48; Part XIV §65.4): floor on the
                                         //   lintel course, top kept at the EN east wall's +28 so it adds no new block to the Parah line
const SHUSHAN_CHAMBER_WALL_T = 1;        // ⚙
const FOOT_BLEND_M = 40;                 // ⚙ m: N/S Mount-wall feet blend to the lower E/W corner grades over this length (approx. topography)

// --- Har HaBayit (Middot 2:1; Part XI §58) ---
const MOUNT = 500;                       // 500 x 500 — Middot 2:1; Rambam BhB 5:1 (clear interior: lock §58, EK I 174)
const MOUNT_WALL_T = 5;                  // ⚙ lock §58 (EK I 174) — walls stand OUTSIDE the square
const MOUNT_WALL_H = 40;                 // ⚙ lock §58 baseline (EK: "some say 40"; sourced floor ≥ 22)
const MOUNT_EAST_WALL_H = GATE_H + LINTEL_COURSE; // 22 ⚙ — "low" is sourced (Middot 2:4; Rambam BhB 6:5 "the wall above this gate made low"); the number is our gate + lintel course
const MARGIN_W = 63;                     // ⚙ lock §58 (EK II 247–250)
const MARGIN_S = 258;                    // ⚙ lock §58
const MARGIN_N = 97;                     // ⚙ lock §58
const MARGIN_E = 100;                    // ⚙ lock §58 (ordering S > E > N > W: Middot 2:1; Rambam BhB 5:6)
const CHULDAH_SPAN = 160;                // ⚙ lock §58: two Chuldah gates trisect the S wall: 160+10+160+10+160
const KIPONUS_Y = MOUNT / 2;             // ⚙ lock §58: Kiponus at the exact middle of the W wall
const STOA_DEPTH = 20;                   // ⚙ "stav lifnim mistav" (Rambam BhB 5:1) — two aisles of 10; depth unsourced (§20 #7)
const STOA_AISLE = 10;                   // ⚙
const STOA_ROOF = 20;                    // ⚙ roof top; ≤ MOUNT_EAST_WALL_H so the east side stays under the Parah sight-line
const STOA_BAY = 10;                     // ⚙ column spacing
// as built by build-mount (src/world/mount/stoas.js STOA) — recorded as params.overhangs on each stoa, outside the 20-amah band ⚙
const STOA_FRONT_REACH = 2;              // the front row stands ON the band's inner edge: columns r 1, entablature 2.2 wide, cornice face 22 from the wall
const ROOF_PARAPET_H = 10 * TEFACH;      // ma'akeh of 10 tefachim on open roof edges (Devarim 22:8) — stoa roofs, gate-bay roof, causeway, bridge
const STOA_PARAPET_T = 0.8;
const STOA_GATE_BAY = { halfAlong: 8.1, depth: 11.1, riseNW: 3.6 }; // raised bay over the outer aisle before Shushan, Kiponus, Tadi (clears the gate heads)
const STOA_ENTABLATURE_Z = 16.4;         // underside of the front architrave (columns below)

// --- soreg & chel (Middot 2:3; lock #26/#44) ---
const SOREG_H = 10 * TEFACH;             // lattice 10 tefachim — Middot 2:3; Rambam BhB 5:3
const SOREG_BASE = 1;                    // ⚙ lock #26: on a 1-amah stone base (EK I 205)
const SOREG_T = 1;                       // ⚙ base thickness (lattice 0.25)
const CHEL = 10;                         // "the chel, 10 amot" — Middot 2:3 (lock #26: a 10-amah strip, soreg at its outer line)
const CHEL_STEPS = 12;                   // "12 steps were there" — Middot 2:3; Rambam BhB 6:1
const CHEL_STEPS_W = 20;                 // ⚙ flight width (gate 10 + 5 each side)
const SOREG_BREACHES = 13;               // Middot 2:3 (13 breaches, 13 prostrations "opposite them" — no distribution given)
const PROSTRATIONS_BY_SIDE = { N: 4, S: 4, E: 3, W: 2 };   // ⚙ borrowed: Shekalim 6:3 gives 4N 4S 3E 2W for the prostrations "opposite the
                                                           //   13 GATES" (the gates view; Abba Yosi b. Chanan, Middot 2:6) — used here only to spread the breaches

// --- the court complex ---
const COURT_WALL_T = 5;                  // ⚙ lock §58 (EK I 174, 181)
const COURT_WALL_H = 40;                 // ⚙ lock §58 baseline, above each court's floor; "east low" (Middot 2:4)
const EN = 135;                          // Ezrat Nashim 135 x 135 — Middot 2:5; Rambam BhB 5:7
const EN_CHAMBER = 40;                   // corner chambers 40 x 40, unroofed — Middot 2:5 (lock #23)
const EN_CHAMBER_WALL_T = 2;             // ⚙ inner walls of the corner chambers
const EN_CHAMBER_WALL_H = 22;            // ⚙ (unroofed — Middot 2:5); top +28 = the low EN east wall, so no partition stands above the outer wall
const EN_GALLERY_Z = 10;                 // ⚙ gezuztra floor above the EN floor (Middot 2:5; Sukkah 51b)
const EN_GALLERY_D = 4;                  // ⚙ gallery depth
const EN_GALLERY_PARAPET = 2;            // ⚙
const NIKANOR_STEPS = 15;                // 15 semicircular steps — Middot 2:5; Rambam BhB 6:2 (rise ½, tread ½)
const STEPS15_LANDING_R = 10.5;          // ⚙ top landing radius (covers Nikanor + both wickets)
const AZ_LEN = 187;                      // Azarah E–W — Middot 2:6, 5:1; Rambam BhB 5:4
const AZ_WID = 135;                      // Azarah N–S — Middot 2:6, 5:2
const EY = 11;                           // Ezrat Yisrael 135 x 11 — Middot 2:6, 5:1
const EK = 11;                           // Ezrat Kohanim 135 x 11 — Middot 2:6, 5:1
const DUCHAN_STEP = 1;                   // REbY: a step 1 amah high — Middot 2:6; Rambam BhB 6:3 (lock #10)
const DUCHAN_HALF_STEPS = 3;             // ... and on it the duchan with 3 steps of ½ — Middot 2:6
const DUCHAN_STEP_TREAD = 1;             // ⚙ tread of the 1-amah step (duchan treads ½ — Rambam BhB 6:3)

// --- the elevation ladder (§0.4; Rambam BhB 6:1–5) ---
const Z_MOUNT = 0;                                               // datum: E-gate threshold (Rambam BhB 6:5)
const Z_EN = Z_MOUNT + CHEL_STEPS * STEP_RISE;                   // +6   (Rambam BhB 6:1; lock #45)
const Z_EY = Z_EN + NIKANOR_STEPS * STEP_RISE;                   // +13.5 (Rambam BhB 6:2)
const Z_AZ = Z_EY + DUCHAN_STEP + DUCHAN_HALF_STEPS * STEP_RISE; // +16  (Middot 2:6: EK 2½ above EY)
const ULAM_STEPS = 12;                                           // Middot 3:6
const Z_HEICHAL = Z_AZ + ULAM_STEPS * STEP_RISE;                 // +22  (Rambam BhB 6:4–5)

// --- Azarah N–S chain (Rambam BhB 5:13–15 resolving Middot 5:2) ---
const N_MARGIN = 8;                      // N wall → mitbachayim 8 — Middot 5:2 ("nanasin → wall 8"); Rambam BhB 5:13
const MITBACHAYIM = 12.5;                // Beit HaMitbachayim 12½ — Rambam BhB 5:13 (Middot: part of the 25 remainder)
const TABLES_BAND = 8;                   // place of the tables 8 — Rambam BhB 5:14 (= Middot 4 + 4)
const RINGS_BAND = 24;                   // place of the rings 24 — Middot 5:2; Rambam BhB 5:14
const RINGS_TO_ALTAR = 8;                // altar → rings 8 — Middot 5:2
const ALTAR = 32;                        // Mizbeach 32 x 32 — Middot 3:1, 5:1; Rambam BhB 2:5
const KEVESH_GROUND = 30;                // kevesh consumes 30 on the ground — Rambam BhB 2:13; Middot 5:2 ("kevesh + altar 62")
const S_MARGIN = 12.5;                   // kevesh → S wall 12½ — Rambam BhB 5:15
// --- Azarah E–W chain (Middot 5:1; Rambam BhB 5:12) ---
const BEIN_HAULAM = 22;                  // between the Ulam and the altar — Middot 3:6, 5:1
const HEICHAL_LEN = 100;                 // Middot 4:6–7, 5:1
const BEHIND_KAPORET = 11;               // behind the Beit HaKaporet — Middot 5:1

// --- the altar (Middot 3:1–3; locks #2–#4, #17, #18) ---
const YESOD_RISE = 1, YESOD_INSET = 1;   // "rose 1, drew in 1 — this is the yesod" — Middot 3:1
const SOVEV_RISE = 5, SOVEV_INSET = 1;   // "rose 5, drew in 1 — this is the sovev" — Middot 3:1
const TOP_RISE = 3;                      // sovev → top 3 (R' Yosi, Zevachim 59b–60a; Rambam BhB 2:5) — lock #2
const KEREN = 1;                         // horns 1 x 1 x 1 — Middot 3:1; Zevachim 54a (Levi's braita)
const WALKWAY = 1;                       // "the place of the kohanim's feet 1 amah" — Middot 3:1
const KEVESH_LEN = 32;                   // kevesh 32 long — Middot 3:3; Rambam BhB 2:13
const KEVESH_W = 16;                     // ... 16 wide — Middot 3:3
const SMALL_RAMP_W = 2;                  // ⚙ the two small kevashim (Zevachim 62b; Rambam BhB 2:14)
const SMALL_RAMP_SLAB = 1;               // ⚙ each branch "goes out from the kevesh" as a slab of its mass, underside 1 below its low end
                                         //   (sovev branch: open below at +21; yesod branch: its underside is the pavement, so it stands solid)
const RAMP_SLOPE = 3;                    // "all ramps 3 amot (run) per amah (rise)" except the altar's — Zevachim 63a (Rami b. Chama)
const RING_ROWS = 6, RING_COLS = 4;      // lock #18: 6 rows of 4 — Middot 3:5 (first opinion)
const NANASIN = 8;                       // 8 dwarf pillars — Middot 3:5
const NANAS_H = 3, NANAS_CAP = 1;        // ⚙ shaft 3 ("dwarf" pillars, Middot 3:5) + squared cedar block 1 → top +4 ≈ a man's height, so the
                                         //   three rows of iron hooks in the block (Z +3 to +4 ≈ 1.45–1.9 m) are within a standing kohen's reach for
                                         //   the lamb (Tamid 4:2); row spacing ⚙; heavy carcasses are outside the reach rule (altar.nanasin rowsNote)
const MARBLE_TABLES = 8;                 // Shekalim 6:4; Rambam BhB 5:14
const BEIT_HADESHEN_WALK = 10;           // "walked to the east of the kevesh about 10 amot" — Tamid 1:4
const BEIT_HADESHEN_OFF = 3 * TEFACH;    // "3 tefachim from the kevesh" — Tamid 1:4
const INCENSE_PILE_OFF = 4;              // second ma'arachah drawn 4 amot north of the SW horn — Tamid 2:5
const KIYOR_D = 4, KIYOR_H = 3;          // ⚙ (12 spigots: Yoma 37a; Tamid 3:8)

// --- the 12 Ulam steps (Middot 3:6; lock #25; Yoma 4:3 "the fourth rovad") ---
const ULAM_TREADS = [1, 1, 3, 1, 1, 3, 1, 1, 3, 1, 1, 4]; // "amah amah, rovéd 3; ... the top: amah amah, rovéd 4"
const ULAM_STEPS_W = 20;                 // ⚙ = the Ulam opening; leaves the south of the strip for the kiyor

// --- the Heichal (Middot 4:1–7; locks #1, #5, #38–#42) ---
const ULAM_WALL = 5, ULAM_IN = 11, HEI_WALL = 6, KODESH_LEN = 40, TRAKSIN = 1,
  KHK = 20, TA = 6, TA_WALL = 5;          // E–W chain — Middot 4:7
const MESIBAH_WALL = 5, MESIBAH = 3, KODESH_WID = 20, WATER_HOUSE = 3, OUTER_WALL = 5; // N–S chain — Middot 4:7
const ULAM_WING = 15;                    // "the Ulam exceeds it 15 N and 15 S" — Middot 4:7 (lock #1 T-plan)
const ULAM_END_WALL = 5;                 // ⚙ wing end walls (= the Ulam wall)
const ULAM_OPEN_W = 20, ULAM_OPEN_H = 40;// Ulam opening — Middot 3:7; Rambam BhB 4:8
const LINTELS = 5;                       // five milah lintels, 22 → 30 — Middot 3:7
const LINTEL_DEPTH = 1;                  // ⚙ beam depth; stone course between each pair (Middot 3:7) also 1 ⚙
const KODESH_H = 40;                     // interior height — Middot 4:6; Yoma 52a
const STACK = [                          // Middot 4:6 (Rambam BhB 4:3); lock #6 kalya orev counted
  ['otem', 6], ['kodesh', 40], ['kiyur', 1], ['beit dilpah', 2], ['tikrah', 1], ['ma\'azivah', 1],
  ['aliyah', 40], ['kiyur', 1], ['beit dilpah', 2], ['tikrah', 1], ['ma\'azivah', 1], ['ma\'akeh', 3], ['kalya orev', 1],
];
const TA_STORY = [5, 6, 7];              // ta widths lower/middle/upper — Middot 4:4 (1 Melachim 6:6)
const TA_STORY_H = 11;                   // ⚙ three stories of 11 → ta'im roofs at +55, below the F1 band (Part VII §22 F1: "above the ta'im roofline");
                                         //   the last 12 amot to the aliyah door (+67) are a flight on the south ta'im roof (heichal.taim.roof-stair)
const TA_COUNT = { N: [5, 5, 5], S: [5, 5, 5], W: [3, 3, 2] }; // Middot 4:3; Rambam BhB 4:10 (lock #38)
const WICKET_W = 3, WICKET_H = 8;        // ⚙ width; 8-amah height per the attested pishpeshin (Zevachim 55b)
const LUL_W = 4 * TEFACH, LUL_H = 8;     // lul behind the Kaporet: 8 high (Zevachim 55b), 4 tefachim wide (EK II 178)
const SHULCHAN = [10 * TEFACH, 5 * TEFACH]; // top 10 x 5 tefachim — lock #31 (R' Yehudah, Menachot 96a)
const SHULCHAN_H = 1.5 * 5 * TEFACH;     // 1½ "amot" in R' Yehudah's 5-tefach vessel-amah = 1.25 (Shemot 25:23) ⚙ consistency
const VESSEL_WALL_OFF = 2.5;             // Shulchan/Menorah 2½ amot from the walls — Yoma 33b; Menachot 98b
const MENORAH_H = 18 * TEFACH;           // 18 tefachim — Menachot 28b; Rambam BhB 3:10
const GOLDEN_ALTAR = [1, 1, 2];          // 1 x 1 x 2 — Shemot 30:2; Rambam BhB 3:17
const EVEN_SHETIYAH_H = 3 * ETZBA;       // 3 etzba'ot above the floor — Yoma 5:2 (53b)

// --- chambers & attached structures (footprints unsourced: lock §58 "nominal boxes") ---
const MOKED = 24;                        // ⚙ lock §58: Beit HaMoked hall 24 x 24 straddling the N wall
const MOKED_WALL_T = 2;                  // ⚙
const MOKED_CHAMBER_W = 5;               // ⚙ "like small bedrooms" (Middot 1:6): 5 along the hall's S/N walls so the 10-amah gate and chel door open
const MOKED_CHAMBER_D = 6;               // ⚙   onto a full 10-amah passage between each pair (interior 20 = 5 + 10 + 5); 6 deep
const MOKED_DOME_SPRING = 20;            // ⚙ walls to +36, dome (kippah — Middot 1:8)
const GATEHOUSE_ROOF = GATE_H;           // gate roofs 20 above the court floor, marble, negligibly thin — Yoma 31a–b
const MIKVEH_DEPTH = 3;                  // "amah x amah x 3" — Yoma 31a; En Eitam = gate 20 + 3 = 23 over the Azarah floor
const UPPER_ROOM_H = 10;                 // ⚙ aliyot over the Water Gate (Beit Avtinas) and Nitzotz
const CHAMBER_ROOF = GATEHOUSE_ROOF;     // ⚙ six chambers' roofs (Etz/Golah/Gazit "level" — Middot 5:4). Not above the gate roofs: the KG's four
                                         //   kodesh immersions were in the mikveh on the Parvah roof (Middot 5:3; Yoma 31a) and Abaye takes the
                                         //   En-Eitam head (+23) from the Water Gate's 20 + 3 — a higher Parvah roof would set a higher head
const CHAMBER_DOOR_H = 16;               // ⚙ the six chambers' doors. Middot 2:3 reads "all the openings AND gates there, 20 high, 10 wide", but
                                         //   it is the gates' and great doorways' standard: Zevachim 55b quotes it as "all the GATES there" against the
                                         //   8-amah pishpeshin and answers "pishpeshin are different" (פשפשין שאני; also the 8-amah lul); Rambam BhB
                                         //   5:5 has "every GATE of them" (כל שער מהן); Middot 4:3 gives each ta three openings, which cannot be 20 high;
                                         //   the Moked's pishpash (Middot 1:7). So under the 20-amah roof: 20 − 1 roof slab − 3 lintel course = 16
const FLIGHT_RISERS = (Z_AZ - Z_MOUNT) / STEP_RISE; // 32 half-steps from a N/S court door down to the chel (EK I 202–215)

// --- real-world context (meters; approximate topography — reconstruction) ---
const DATUM_ASL = 740;                   // m: Temple Mount platform ≈ Z0 (brief; modern platform 737–744 m)
const EYE_M = 1.6;                       // m: standing eye height
const TOPO = {                           // distance outward from each Mount-wall outer face (m) → ground ASL (m)
  E: [[0, 712], [60, 698], [200, 675], [330, 700], [480, 740], [650, 790], [800, 808], [950, 798], [1500, 760]],
  S: [[0, 727], [150, 712], [400, 690]],
  W: [[0, 722], [60, 716], [250, 742], [600, 770]],
  N: [[0, 738], [200, 745], [600, 758]],
};
const KIDRON_THALWEG_M = 200;            // m east of the E wall; ancient bed ≈ 675 m (today's fill ~10 m higher)
const PARAH_SITE_M = 800;                // m east of the E wall: crest of Har HaMishchah on the Temple axis (~808 m)
const PARAH_PYRE = { back: 6, front: 1, halfW: 3, h: 8 }; // ⚙ the arrangement "like a tower with windows, its face west" (Parah 3:8): X from crest−6 to
                                         //   crest−1 (5 E–W) x 6, 8 high; the heifer lies on its top (Parah 3:9)
const PARAH_KOHEN_IN = 1;                // ⚙ the kohen stands on the top 1 amah in from its east edge, east of the heifer (Parah 3:9 "stands in the east")
const HEIFER = { len: 5, w: 2, h: 2 };   // ⚙ envelope of the bound heifer lying on the top, head south (Parah 3:9)
const OPHEL_GRADE_M = TOPO.S[0][1];      // Chuldah portals open south onto the Ophel street (~727 m)

// -----------------------------------------------------------------------------
// 2. DERIVED POSITIONS (site frame)
// -----------------------------------------------------------------------------
// Court complex outline (lock §58: footprint 337 x 145 incl. 5-amah walls)
const X_CX_W = MARGIN_W;                         // 63  outer face of the Azarah W wall
const X_AZ_W = X_CX_W + COURT_WALL_T;            // 68  inner face (Azarah W end)
const X_AZ_E = X_AZ_W + AZ_LEN;                  // 255 Azarah E end (inner face of the Nikanor wall)
const X_EN_W = X_AZ_E + COURT_WALL_T;            // 260 EN W end
const X_EN_E = X_EN_W + EN;                      // 395 EN E end
const X_CX_E = X_EN_E + COURT_WALL_T;            // 400 outer face of the EN E wall (= 500 − 100)
const Y_CX_S = MARGIN_S;                         // 258
const Y_AZ_S = Y_CX_S + COURT_WALL_T;            // 263
const Y_AZ_N = Y_AZ_S + AZ_WID;                  // 398
const Y_CX_N = Y_AZ_N + COURT_WALL_T;            // 403 (= 500 − 97)
const AXIS_Y = (Y_AZ_S + Y_AZ_N) / 2;            // 330.5 — lock §58: Heichal axis = Azarah N–S centerline (lock #13)
// Azarah E–W chain, from the east (Middot 5:1)
const X_EY_W = X_AZ_E - EY;                      // 244
const X_EK_W = X_EY_W - EK;                      // 233
const X_ALT_E = X_EK_W;                          // 233 altar E face
const X_ALT_W = X_ALT_E - ALTAR;                 // 201 altar W face
const X_ULAM_E = X_ALT_W - BEIN_HAULAM;          // 179 Ulam front face
const X_HEI_W = X_ULAM_E - HEICHAL_LEN;          // 79  Heichal block W face (→ + 11 = Azarah W end)
// Azarah N–S chain, from the north (Rambam BhB 5:13–15)
const Y_MITB_S = Y_AZ_N - N_MARGIN;              // 390   S edge of the N margin = N edge of the mitbachayim
const Y_TABLES_N = Y_MITB_S - MITBACHAYIM;       // 377.5
const Y_RINGS_N = Y_TABLES_N - TABLES_BAND;      // 369.5
const Y_ALT_N = Y_RINGS_N - RINGS_BAND - RINGS_TO_ALTAR; // 337.5 altar N face (60.5 from the N wall — lock #4)
const Y_ALT_S = Y_ALT_N - ALTAR;                 // 305.5
const Y_KEV_FOOT = Y_ALT_S - KEVESH_GROUND;      // 275.5 foot of the kevesh
// Altar tiers (Middot 3:1)
const ALT_X0 = X_ALT_W, ALT_Y0 = Y_ALT_S;        // SW corner of the 32-square
const T30 = YESOD_INSET, T28 = T30 + SOVEV_INSET, T26 = T28 + KEREN, T24 = T26 + WALKWAY; // insets 1/2/3/4
const Z_YESOD = Z_AZ + YESOD_RISE;               // 17
const Z_SOVEV = Z_YESOD + SOVEV_RISE;            // 22
const Z_ALT_TOP = Z_SOVEV + TOP_RISE;            // 25  (ma'arachah level, 9 over the court)
const Z_KEREN = Z_ALT_TOP + KEREN;               // 26  (altar 10 high — lock #2)
const Z_SIKRA = Z_AZ + (Z_KEREN - Z_AZ) / 2;     // 21  "girds it at its middle" — Middot 3:1
const ALT_CX = ALT_X0 + ALTAR / 2, ALT_CY = ALT_Y0 + ALTAR / 2; // 217, 321.5
// Kevesh (centered on the altar's S face; Middot 3:3)
const X_KEV_W = ALT_CX - KEVESH_W / 2, X_KEV_E = ALT_CX + KEVESH_W / 2; // 209, 225
const Y_KEV_TOP = Y_KEV_FOOT + KEVESH_LEN;       // 307.5 = altar S face + yesod 1 + sovev 1 (flies 2 — Middot 5:2)
const kevZ = (y) => Z_AZ + (Z_ALT_TOP - Z_AZ) * (y - Y_KEV_FOOT) / KEVESH_LEN;
// Heichal (Middot 4:7)
const X_ULAM_IN_E = X_ULAM_E - ULAM_WALL;        // 174
const X_ULAM_IN_W = X_ULAM_IN_E - ULAM_IN;       // 163
const X_KODESH_E = X_ULAM_IN_W - HEI_WALL;       // 157
const X_KODESH_W = X_KODESH_E - KODESH_LEN;      // 117
const X_KHK_E = X_KODESH_W - TRAKSIN;            // 116
const X_KHK_W = X_KHK_E - KHK;                   // 96
const X_HEI_WALL_W = X_KHK_W - HEI_WALL;         // 90
const X_TA_W_W = X_HEI_WALL_W - TA;              // 84
const BODY_HALF = (MESIBAH_WALL + MESIBAH + TA_WALL + TA + HEI_WALL); // 25 each side of the 20 interior
const Y_KOD_S = AXIS_Y - KODESH_WID / 2, Y_KOD_N = AXIS_Y + KODESH_WID / 2; // 320.5, 340.5
const Y_HW_N = Y_KOD_N + HEI_WALL;               // 346.5 (middle-story line)
const Y_TA_N = Y_HW_N + TA;                      // 352.5
const Y_TAW_N = Y_TA_N + TA_WALL;                // 357.5
const Y_MES_N = Y_TAW_N + MESIBAH;               // 360.5
const Y_BODY_N = Y_MES_N + MESIBAH_WALL;         // 365.5
const Y_HW_S = Y_KOD_S - HEI_WALL;               // 314.5
const Y_TA_S = Y_HW_S - TA;                      // 308.5
const Y_TAW_S = Y_TA_S - TA_WALL;                // 303.5
const Y_WATER_S = Y_TAW_S - WATER_HOUSE;         // 300.5
const Y_BODY_S = Y_WATER_S - OUTER_WALL;         // 295.5
const Y_ULAM_S = Y_BODY_S - ULAM_WING, Y_ULAM_N = Y_BODY_N + ULAM_WING; // 280.5, 380.5
// Vertical stack (Middot 4:6) — the 100 includes the otem and rises from the Azarah floor (lock §58; Part XIV §64.1)
const stackZ = {}; { let z = Z_AZ; STACK.forEach(([k, h], i) => { stackZ[i] = [z, z + h]; z += h; }); }
const Z_KOD_TOP = stackZ[1][1];                  // 62
const Z_ALIYAH = stackZ[5][1];                   // 67  aliyah floor
const Z_ALIYAH_TOP = stackZ[6][1];               // 107
const Z_ROOF = stackZ[10][1];                    // 112 roof surface
const Z_MAAKEH = stackZ[11][1];                  // 115
const Z_CROWN = stackZ[12][1];                   // 116 — Part XIV §64.1
// Heichal walls step back to carry the ta'im floors: wall + ta = 12 at every story (Middot 4:4)
const HEI_WALL_BY_STORY = TA_STORY.map((w) => HEI_WALL + TA - w); // [7, 6, 5]
const taStoryZ = (k) => [Z_HEICHAL + k * TA_STORY_H, Z_HEICHAL + (k + 1) * TA_STORY_H]; // incl. 1-amah slab at the top
const Z_TAIM_ROOF = taStoryZ(2)[1];              // 55 ⚙ roofs of the ta'im (Middot 4:5 "the roofs of the ta'im")
const F1_BAND = [Z_KOD_TOP - 6, Z_KOD_TOP - 1];  // 56–61 ⚙ the high Kodesh windows (Part VII §22 F1), above the ta'im roofline
const HEI_WALL_UPPER = HEI_WALL_BY_STORY[2];     // 5 — aliyah walls continue at the upper-story thickness
const X_ALIYAH_W_FACE = X_KHK_W - HEI_WALL_UPPER; // 91
// Azarah gates on N and S walls: 39¼-amah spacing (lock §58, EK I plan legend)
const AZ_GATE_GAP = (AZ_LEN - 3 * GATE_W) / 4;   // 39.25
const azGateX0 = (i) => X_AZ_W + AZ_GATE_GAP * (i + 1) + GATE_W * i; // i = 0 west, 1, 2 east
const AZ_GATE_CX = [0, 1, 2].map((i) => azGateX0(i) + GATE_W / 2);    // 112.25, 161.5, 210.75
// The Ulam steps
const ULAM_RUN = sum(ULAM_TREADS);               // 21
const ULAM_APRON = BEIN_HAULAM - ULAM_RUN;       // 1 — level apron at the foot (R' Yehudah's top landing 5 would close it)

// -----------------------------------------------------------------------------
// 3. ELEMENTS
// -----------------------------------------------------------------------------
const elements = {};
function add(id, o) {
  if (elements[id]) throw new Error(`site.js: duplicate element ${id}`);
  const e = { id, name: { en: o.en, he: o.he }, kind: o.kind };
  if (o.b) e.box = bx(...o.b);
  e.params = o.p || {};
  // per-field confidence: the element's `confidence` describes its box (weakest number that defines it);
  // fieldConfidence records the sourced parts (and names the ⚙ parts) — see docs/site-model.md §2
  if (o.fc) e.params.fieldConfidence = o.fc;
  e.sources = o.src;
  e.confidence = o.c;
  if (o.der) e.derivation = o.der;
  if (o.n) e.notes = o.n;
  elements[id] = e;
  return e;
}
const L58 = 'Part XI §58 (EK placement locks)';

// ===== 3.1 Har HaBayit ======================================================
const zGrade = (side) => r6((TOPO[side][0][1] - DATUM_ASL) / AMAH); // exterior grade at each wall foot (amot)
add('mount.floor', { en: 'Har HaBayit pavement', he: 'רצפת הר הבית', kind: 'floor',
  b: [0, 0, -1, MOUNT, MOUNT, Z_MOUNT], src: ['Middot 2:1', 'Rambam BhB 5:1', 'Parah 3:3', 'EK I 184 (Part X §47)'],
  c: 'explicit', der: '500 x 500 clear interior at the datum Z0', p: { substructure: 'kippin al gabbei kippin (hollow vaults)', paving: 'marble' } });
// The N and S walls run through the corners (X −5…505). Their feet follow a profile along X that drops to the lower
// E/W grade at each corner (Kidron east, Tyropoeon west), so no corner column is left open above the E/W wall feet.
const footBlend = FOOT_BLEND_M / AMAH;                                           // amot (AMAH-dependent)
const footProfileNS = (k) => {
  const zs = zGrade(k), zw = Math.min(zs, zGrade('W')), ze = Math.min(zs, zGrade('E'));
  return [[-MOUNT_WALL_T, zw], [0, zw], [footBlend, zs], [MOUNT - footBlend, zs], [MOUNT, ze], [MOUNT + MOUNT_WALL_T, ze]].map(([s, z]) => [r6(s), r6(z)]);
};
const mountWalls = [
  ['south', -MOUNT_WALL_T, -MOUNT_WALL_T, MOUNT + MOUNT_WALL_T, 0, MOUNT_WALL_H, 'S', 'X', ['mount.gate.chuldah-w', 'mount.gate.chuldah-e']],
  ['north', -MOUNT_WALL_T, MOUNT, MOUNT + MOUNT_WALL_T, MOUNT + MOUNT_WALL_T, MOUNT_WALL_H, 'N', 'X', ['mount.gate.tadi']],
  ['west', -MOUNT_WALL_T, 0, 0, MOUNT, MOUNT_WALL_H, 'W', 'Y', ['mount.gate.kiponus']],
  ['east', MOUNT, 0, MOUNT + MOUNT_WALL_T, MOUNT, MOUNT_EAST_WALL_H, 'E', 'Y', ['mount.gate.shushan']],
];
for (const [side, x0, y0, x1, y1, h, k, along, openings] of mountWalls) {
  const he = { south: 'דרום', north: 'צפון', west: 'מערב', east: 'מזרח' }[side];
  const ns = side === 'south' || side === 'north';
  const profile = ns ? footProfileNS(k) : [[0, zGrade(k)], [MOUNT, zGrade(k)]];
  const footMin = Math.min(...profile.map(([, z]) => z));
  add(`mount.wall.${side}`, { en: `Har HaBayit wall — ${side}`, he: `חומת הר הבית — ${he}`, kind: 'wall',
    b: [x0, y0, footMin, x1, y1, h],
    src: side === 'east' ? ['Middot 2:4', 'Rambam BhB 6:5', L58, 'EK I 174, 181 (Part X §47)'] : ['Middot 2:1', L58, 'EK I 174 (Part X §47)'],
    c: side === 'east' ? 'reconstruction' : 'locked',
    der: side === 'east'
      ? `low (Middot 2:4; Rambam BhB 6:5); +${MOUNT_EAST_WALL_H} = gate ${GATE_H} + lintel course ${LINTEL_COURSE}, chosen ⚙ (EK's "not less than 22" is for the high walls)`
      : `thickness ${MOUNT_WALL_T} outside the square; height ${MOUNT_WALL_H} above Z0 (lock §58 baseline)`,
    fc: side === 'east' ? { low: 'explicit', plan: 'locked', height: 'reconstruction', footProfile: 'reconstruction' } : { plan: 'locked', height: 'locked', footProfile: 'reconstruction' },
    p: { thickness: MOUNT_WALL_T, heightAboveMount: h, openings,
      outerFootZ: zGrade(k), footProfile: { along, points: profile, note: ns ? `exterior grade along the wall: the side's own grade, blending over ${FOOT_BLEND_M} m to the lower E/W grade at each corner (approximate real topography ⚙, AMAH-dependent); box.min Z is the lowest point` : 'exterior grade, constant along the wall (approximate real topography ⚙, AMAH-dependent)' },
      masonry: 'Herodian courses of white/blue-green/veined marble, set-out/set-in, unplastered (Bava Batra 4a)' },
    n: side === 'east' ? 'All walls were high except the eastern (Middot 2:4); its top kept below the Parah sight-line (see parahSightLine()). The Shushan HaBirah chamber stands on it over the gate (mount.gate.shushan.chamber).' : undefined });
}
// Mount gates (Middot 1:3; 2:3; Rambam BhB 5:2) — stations per lock §58
const chuldahX = [CHULDAH_SPAN, 2 * CHULDAH_SPAN + GATE_W];        // 160, 330
const zChuldah = zGrade('S');
add('mount.gate.chuldah-w', { en: 'Chuldah gate (west)', he: 'שער חולדה (מערבי)', kind: 'gate',
  b: [chuldahX[0], -MOUNT_WALL_T, zChuldah, chuldahX[0] + GATE_W, 0, zChuldah + GATE_H],
  src: ['Middot 1:3', 'Middot 2:3', L58], c: 'locked', der: 'S wall trisected 160 | 10 | 160 | 10 | 160 (lock §58); portal at the Ophel grade',
  p: { width: GATE_W, height: GATE_H, doors: 2, doorFinish: 'gold-plated (Middot 2:3)', lintel: 'shekufah', use: 'entry and exit (Middot 1:3)', tunnel: 'context.chuldah.tunnel-w', faces: 180 } });
add('mount.gate.chuldah-e', { en: 'Chuldah gate (east)', he: 'שער חולדה (מזרחי)', kind: 'gate',
  b: [chuldahX[1], -MOUNT_WALL_T, zChuldah, chuldahX[1] + GATE_W, 0, zChuldah + GATE_H],
  src: ['Middot 1:3', 'Middot 2:3', L58], c: 'locked', der: 'S wall trisection (lock §58)',
  p: { width: GATE_W, height: GATE_H, doors: 2, doorFinish: 'gold-plated', lintel: 'shekufah', use: 'entry and exit', tunnel: 'context.chuldah.tunnel-e', faces: 180 } });
add('mount.gate.kiponus', { en: 'Kiponus gate (west)', he: 'שער קיפונוס', kind: 'gate',
  b: [-MOUNT_WALL_T, KIPONUS_Y - GATE_W / 2, Z_MOUNT, 0, KIPONUS_Y + GATE_W / 2, GATE_H],
  src: ['Middot 1:3', 'Middot 2:3', L58], c: 'locked', der: 'center of the W wall (Y 250)',
  p: { width: GATE_W, height: GATE_H, doors: 2, doorFinish: 'gold-plated', lintel: 'shekufah', use: 'entry and exit', faces: 270, exteriorApproach: 'unsourced (bridge to the upper city) — reconstruction: context.kiponus-approach', approach: 'context.kiponus-approach' } });
const MOKED_CX = AZ_GATE_CX[2];                                     // Moked gate is the E-most of the N trio (lock §58)
add('mount.gate.tadi', { en: 'Tadi gate (north)', he: 'שער טדי', kind: 'gate',
  b: [MOKED_CX - GATE_W / 2, MOUNT, Z_MOUNT, MOKED_CX + GATE_W / 2, MOUNT + MOUNT_WALL_T, GATE_H],
  src: ['Middot 1:3', 'Middot 2:3', 'Middot 1:9', L58], c: 'locked', der: 'opposite the Beit HaMoked gate (lock §58)',
  p: { width: GATE_W, height: GATE_H, doors: 2, doorFinish: 'gold-plated', lintel: 'two stones leaning one on the other (pointed head) — Middot 2:3',
    use: 'served no public purpose (Middot 1:3); REbY: the tamei kohen left by it (Middot 1:9)', faces: 0 } });
add('mount.gate.shushan', { en: 'Shushan gate (the Eastern Gate)', he: 'שער המזרח — שושן הבירה', kind: 'gate',
  b: [MOUNT, AXIS_Y - GATE_W / 2, Z_MOUNT, MOUNT + MOUNT_WALL_T, AXIS_Y + GATE_W / 2, GATE_H],
  src: ['Middot 1:3', 'Middot 2:3', 'Middot 2:4', 'Kelim 17:9', 'Rambam BhB 6:5', L58], c: 'locked',
  der: 'on the Heichal axis Y = 330.5 (lock §58); threshold = datum Z0',
  p: { width: GATE_W, height: GATE_H, doors: 2, doorFinish: 'gold-plated', lintel: 'shekufah', relief: 'image of Shushan the capital on it (Middot 1:3)',
    chamber: 'mount.gate.shushan.chamber',
    use: 'the Parah, the kohen burning her and all her attendants go out to Har HaMishchah (Middot 1:3)', faces: 90 },
  n: 'The Shushan HaBirah chamber over the gate (Part X §48; Part XIV §65.4) holds the two standard amot of Kelim 17:9.' });
{
  const y0 = AXIS_Y - GATE_W / 2 - SHUSHAN_CHAMBER_WALL_T, y1 = AXIS_Y + GATE_W / 2 + SHUSHAN_CHAMBER_WALL_T;
  const z0 = MOUNT_EAST_WALL_H, z1 = z0 + SHUSHAN_CHAMBER_H, xi = MOUNT + MOUNT_WALL_T - SHUSHAN_CHAMBER_WALL_T, zAm = z0 + 2;
  add('mount.gate.shushan.chamber', { en: 'Shushan HaBirah — the chamber over the Eastern Gate', he: 'שושן הבירה', kind: 'chamber',
    b: [MOUNT, y0, z0, MOUNT + MOUNT_WALL_T, y1, z1],
    src: ['Kelim 17:9', 'Middot 1:3', 'Menachot 98a', 'Part X §48 (EK I 167–168)', 'Part XIV §65.4', 'Rambam BhB 6:5'], c: 'reconstruction',
    der: `on the lintel course over the gate (+${z0}), within the wall's thickness, the gate's width + ${SHUSHAN_CHAMBER_WALL_T}-amah walls; top +${z1} ⚙ (= the low EN east wall, so the Parah line loses nothing under real topography)`,
    fc: { existence: 'explicit', placementOverGate: 'locked', size: 'reconstruction', height: 'reconstruction' },
    p: { floorZ: z0, roofZ: z1, wallT: SHUSHAN_CHAMBER_WALL_T, relief: 'the image of Shushan the capital on its east face (Middot 1:3) ⚙ face',
      standardAmot: {
        note: 'two standard amot: the NE one Moshe\'s amah + ½ etzba, the SE one + 1 etzba — contractors bid in Moshe-amot and delivered in the large (Kelim 17:9; Menachot 98a; Part XIV §65.4); mounting height ⚙',
        ne: { at: [xi, y1 - SHUSHAN_CHAMBER_WALL_T, zAm], lengthAmot: r6(1 + ETZBA / 2) },
        se: { at: [xi, y0 + SHUSHAN_CHAMBER_WALL_T, zAm], lengthAmot: r6(1 + ETZBA) } },
      access: 'unsourced ⚙ — from the east stoa roof (+20) beside the gate', sightLine: 'included in parahSightLine() as part of the wall over the gate' },
    n: 'Middot 1:3 has the depiction "on" the gate; EK (I 167–168) and the report draw a chamber above it. Under the Gemara\'s level-line model (Yoma 16a) it removes the 25–26 band; the real-topography line passes ≈15 amot above it (docs/site-model.md §4).' });
}
// Double stoas (Rambam BhB 5:1) — band geometry, all reconstruction
const stoaGaps = {
  east: [[AXIS_Y - GATE_W / 2, AXIS_Y + GATE_W / 2]], west: [[KIPONUS_Y - GATE_W / 2, KIPONUS_Y + GATE_W / 2]],
  north: [[MOKED_CX - GATE_W / 2, MOKED_CX + GATE_W / 2]], south: [],
};
const stoaBands = {
  south: [0, 0, MOUNT, STOA_DEPTH], north: [0, MOUNT - STOA_DEPTH, MOUNT, MOUNT],
  west: [0, STOA_DEPTH, STOA_DEPTH, MOUNT - STOA_DEPTH], east: [MOUNT - STOA_DEPTH, STOA_DEPTH, MOUNT, MOUNT - STOA_DEPTH],
};
// s = along the wall, t = distance from the wall's inner face → site box
const stoaBox = (side, s0, s1, t0, t1, z0, z1) => {
  const P = (s, t) => (side === 'south' ? [s, t] : side === 'north' ? [s, MOUNT - t] : side === 'west' ? [t, s] : [MOUNT - t, s]);
  const a = P(s0, t0), b = P(s1, t1);
  return bx(a[0], a[1], z0, b[0], b[1], z1);
};
const stoaOverhangs = (side) => {
  const [s0, s1] = side === 'south' || side === 'north' ? [0, MOUNT] : [STOA_DEPTH, MOUNT - STOA_DEPTH];
  const front = STOA_DEPTH + STOA_FRONT_REACH;
  return [
    { part: 'front columns, entablature and cornice', box: stoaBox(side, s0, s1, STOA_DEPTH, front, Z_MOUNT, STOA_ROOF), solidFromZ: STOA_ENTABLATURE_Z,
      note: `the front row stands on the band's inner edge (columnRowsFromWall ${STOA_DEPTH}): its columns, architrave, frieze and cornice reach ${STOA_FRONT_REACH} beyond the band, up to the roof top (solid from +${STOA_ENTABLATURE_Z}; columns below)` },
    { part: 'roof parapet', box: stoaBox(side, s0, s1, front - STOA_PARAPET_T, front, STOA_ROOF, r6(STOA_ROOF + ROOF_PARAPET_H)), solidFromZ: STOA_ROOF,
      note: '10 tefachim on the roof\'s open edge (Devarim 22:8), above the stoa box' },
    ...stoaGaps[side].map(([a, b]) => {
      const g = (a + b) / 2, low = side === 'east';
      const roofZ = low ? MOUNT_EAST_WALL_H - 0.05 : STOA_ROOF + STOA_GATE_BAY.riseNW;
      return { part: `raised gate bay before ${{ east: 'Shushan', west: 'Kiponus', north: 'Tadi' }[side]}`,
        box: stoaBox(side, g - STOA_GATE_BAY.halfAlong, g + STOA_GATE_BAY.halfAlong, 0, STOA_GATE_BAY.depth, Z_MOUNT, r6(low ? roofZ + ROOF_PARAPET_H : roofZ)), roofZ,
        soffitZ: r6(roofZ - (low ? 0.55 : 1)), solidFromZ: r6(roofZ - (low ? 0.55 : 1)),
        note: (low ? 'its roof flush under the low east wall\'s top, a landing before Shushan HaBirah with a 10-tefach parapet' : 'raised over the outer aisle so its soffit clears the 20-amah gate head and its inner lintel') + '; open below its soffit (the gate passage continues into the aisle)' };
    }),
  ];
};
for (const [side, [x0, y0, x1, y1]] of Object.entries(stoaBands)) {
  const overhangs = stoaOverhangs(side);
  add(`mount.stoa.${side}`, { en: `Double stoa — ${side}`, he: 'סטיו לפנים מסטיו', kind: 'zone',
    b: [x0, y0, Z_MOUNT, x1, y1, STOA_ROOF], src: ['Rambam BhB 5:1', 'Tamid 1:3', 'Shekalim 8:4', 'Sukkah 4:4', 'Part I §2.3'], c: 'reconstruction',
    der: `band ${STOA_DEPTH} deep (two aisles of ${STOA_AISLE}) inside the wall; roof top ${STOA_ROOF}`,
    p: { aisles: 2, aisleDepth: STOA_AISLE, columnRowsFromWall: [STOA_AISLE, STOA_DEPTH], bay: STOA_BAY, roofTopZ: STOA_ROOF,
      roofWalkable: true, gateGaps: stoaGaps[side], along: (side === 'east' || side === 'west') ? 'Y' : 'X',
      materials: 'marble courses as the walls; flat roof (the itztaba roof — Shekalim 8:4)',
      overhangs, envelopeTopZ: Math.max(...overhangs.map((o) => o.box.max[2])),
      overhangsNote: 'as built by build-mount (src/world/mount/stoas.js) — outside the band box; the box stays the 20-amah band so its gate gaps, columns and stairs keep their reference ⚙' },
    n: 'Depth and height unsourced (§20 #7). Kept ≤ the low east wall so the Parah sight-line is never blocked; Tavnit-Heichal 30/45-amah stoas are Josephus-derived and not used. STOA_ROOF stays 20 rather than ≥ gate + 2: no source sets it, and the raised gate bays already clear the gate heads.' });
}
// Soreg (lock #26/#44) — an orthogonal path 10 amot (the chel) outside the court complex and its projecting chambers
// (complex outline incl. the projecting chambers: the Gazit's chol half (west) and Beit HaMoked (north); see §3.4–3.5)
// North trio at the NW (lock #7). Etz = Parhedrin is "behind both" (Middot 5:4; Rambam BhB 5:17) and one of the "six chambers in
// the Azarah" (Middot 5:3): it stands inside the court against the N wall and through its thickness, opening only north to the
// chel (built in kodesh, opening to chol → its interior is chol, Rambam BhB 6:7). Gazit (straddling the W wall, Yoma 25a) and
// Golah stand in front of it; the Gazit keeps a 5½-amah passage clear of the Heichal's north wall (Tamid 1:3 west circuit).
const ETZ_D = 7;                                                    // ⚙ into the court, + the 5-amah wall
const ETZ = { x0: X_AZ_W, x1: 98, y0: Y_AZ_N - ETZ_D, y1: Y_CX_N };   // 68..98 x 391..403
const GAZIT = { x0: 43, x1: 88, y0: ETZ.y0 - 20, y1: ETZ.y0 };      // 43..88 x 371..391 ⚙ (45 x 20 basilica)
const GOLAH = { x0: GAZIT.x1, x1: ETZ.x1, y0: ETZ.y0 - 10, y1: ETZ.y0 }; // 88..98 x 381..391 ⚙
const MOKED_BOX = { x0: MOKED_CX - MOKED / 2, x1: MOKED_CX + MOKED / 2, y0: Y_AZ_N - N_MARGIN, y1: Y_AZ_N - N_MARGIN + MOKED }; // 198.75..222.75 x 390..414: enters the Azarah only within the 8-amah strip N of the nanasin band (Middot 5:2)
const MOKED_KODESH_Y = MOKED_BOX.y0 + MOKED / 2;  // 402 — rashei pispasin: half / half (lock #43; Middot 1:6 "two in kodesh, two in chol")
const SOREG_PATH = [
  [X_CX_W - CHEL, Y_CX_S - CHEL], [X_CX_E + CHEL, Y_CX_S - CHEL], [X_CX_E + CHEL, Y_CX_N + CHEL],
  [MOKED_BOX.x1 + CHEL, Y_CX_N + CHEL], [MOKED_BOX.x1 + CHEL, MOKED_BOX.y1 + CHEL], [MOKED_BOX.x0 - CHEL, MOKED_BOX.y1 + CHEL], [MOKED_BOX.x0 - CHEL, Y_CX_N + CHEL],
  [X_CX_W - CHEL, Y_CX_N + CHEL], [X_CX_W - CHEL, GAZIT.y1 + CHEL], [GAZIT.x0 - CHEL, GAZIT.y1 + CHEL], [GAZIT.x0 - CHEL, GAZIT.y0 - CHEL],
  [X_CX_W - CHEL, GAZIT.y0 - CHEL],
].map(([x, y]) => [r6(x), r6(y)]);
// passages through the soreg line: the east entry and every flight that crosses it (filled in below)
const soregPassages = [{ at: 'east entry (chel steps)', side: 'E', along: 'Y', from: AXIS_Y - CHEL_STEPS_W / 2, to: AXIS_Y + CHEL_STEPS_W / 2 }];
add('mount.chel.steps', { en: 'The twelve steps of the Chel', he: 'שתים עשרה מעלות שבחיל', kind: 'stair',
  b: [X_CX_E, AXIS_Y - CHEL_STEPS_W / 2, Z_MOUNT, X_CX_E + CHEL_STEPS * STEP_TREAD, AXIS_Y + CHEL_STEPS_W / 2, Z_EN],
  src: ['Middot 2:3', 'Rambam BhB 6:1', 'Part XI lock #45'], c: 'reconstruction',
  der: `${CHEL_STEPS} x rise ${STEP_RISE} = +${Z_EN}; run ${CHEL_STEPS * STEP_TREAD} in the inner part of the 10-amah chel, at the EN east gate; width ${CHEL_STEPS_W} ⚙`,
  fc: { steps: 'explicit', rise: 'explicit', tread: 'explicit', againstTheGate: 'derived', width: 'reconstruction' },
  p: { steps: CHEL_STEPS, rise: STEP_RISE, tread: STEP_TREAD, ascentHeading: 270, foot: [X_CX_E + CHEL_STEPS * STEP_TREAD + 1, AXIS_Y, Z_MOUNT], head: [X_CX_E, AXIS_Y, Z_EN],
    widthNote: 'width unsourced ⚙' },
  n: 'Rambam BhB 6:1: one walks level to the end of the chel and ascends 12 steps to Ezrat Nashim — the flight sits against the EN east wall, leaving the outer 4 amot of the chel level. Spawn: foot of these steps facing west.' });
// soreg + its passages + breaches are added after the flights are known (end of §3.5)

// ===== 3.2 Ezrat Nashim =====================================================
const Z_EN_EAST_TOP = Z_EN + GATE_H + LINTEL_COURSE;   // 28 — east wall low (lock §58 "court walls … east low"; Middot 2:4)
add('en.floor', { en: 'Ezrat Nashim pavement', he: 'עזרת הנשים', kind: 'floor',
  b: [X_EN_W, Y_AZ_S, Z_EN - 1, X_EN_E, Y_AZ_N, Z_EN], src: ['Middot 2:5', 'Rambam BhB 5:7', 'Rambam BhB 6:1'], c: 'explicit',
  der: `${EN} x ${EN} at +${Z_EN} (12 chel steps)`, p: { floorZ: Z_EN } });
add('en.wall.north', { en: 'Ezrat Nashim wall — north', he: 'כותל עזרת הנשים — צפון', kind: 'wall',
  b: [X_EN_W, Y_AZ_N, Z_MOUNT, X_CX_E, Y_CX_N, Z_EN + COURT_WALL_H], src: [L58, 'Middot 2:4'], c: 'locked',
  der: `5 thick; top = EN floor + ${COURT_WALL_H} (lock §58 baseline, read above this court's floor ⚙)`,
  fc: { thickness: 'locked', height: 'locked', heightDatum: 'reconstruction' }, p: { thickness: COURT_WALL_T, gates: [], voids: ['en.chamber.chashaim'] } });
add('en.wall.south', { en: 'Ezrat Nashim wall — south', he: 'כותל עזרת הנשים — דרום', kind: 'wall',
  b: [X_EN_W, Y_CX_S, Z_MOUNT, X_CX_E, Y_AZ_S, Z_EN + COURT_WALL_H], src: [L58, 'Middot 2:4'], c: 'locked',
  der: `5 thick; top = EN floor + ${COURT_WALL_H} (lock §58 baseline, read above this court's floor ⚙)`,
  fc: { thickness: 'locked', height: 'locked', heightDatum: 'reconstruction' }, p: { thickness: COURT_WALL_T, gates: [] } });
add('en.wall.east', { en: 'Ezrat Nashim wall — east (low)', he: 'כותל מזרחי של עזרת הנשים', kind: 'wall',
  b: [X_EN_E, Y_AZ_S, Z_MOUNT, X_CX_E, Y_AZ_N, Z_EN_EAST_TOP], src: ['Middot 2:4', L58], c: 'reconstruction',
  der: `low (Middot 2:4; lock §58 "east low"); +${Z_EN_EAST_TOP} = gate head ${Z_EN + GATE_H} + lintel course ${LINTEL_COURSE} ⚙`,
  fc: { low: 'explicit', thickness: 'locked', height: 'reconstruction' }, p: { thickness: COURT_WALL_T, openings: ['en.gate.east'] },
  n: 'Lock §58 "court walls … (east low)"; the real-topography Parah line crosses this wall at ≈ +37 to +49, so a 40-amah wall (+46) blocks it completely (needs ≤ +36.7 for the full view).' });
add('en.gate.east', { en: 'East gate of Ezrat Nashim', he: 'השער היוצא למזרח', kind: 'gate',
  b: [X_EN_E, AXIS_Y - GATE_W / 2, Z_EN, X_CX_E, AXIS_Y + GATE_W / 2, Z_EN + GATE_H], src: ['Sukkah 5:4', 'Middot 2:3', 'Middot 2:4'], c: 'derived',
  der: 'on the axis; threshold at the head of the chel steps (+6); 20 x 10',
  p: { width: GATE_W, height: GATE_H, doors: 2, doorFinish: 'gold-plated (Middot 2:3)', faces: 90 },
  n: 'The only attested gate of the court ("the gate that exits east", Sukkah 5:4); no N/S gates are modeled (§20 #6).' });
// corner chambers (Middot 2:5): SE nazirites, NE wood, NW lepers, SW oil — 40 x 40 interiors, unroofed
const enCorner = (cx, cy) => { // cx: 'W'|'E', cy: 'S'|'N' → outer footprint incl. its two inner walls
  const w = EN_CHAMBER + EN_CHAMBER_WALL_T;
  const x0 = cx === 'W' ? X_EN_W : X_EN_E - w, y0 = cy === 'S' ? Y_AZ_S : Y_AZ_N - w;
  return [x0, y0, x0 + w, y0 + w];
};
const enChambers = [
  ['nazirites', 'E', 'S', 'Chamber of the Nazirites', 'לשכת הנזירים', 'nazirites cook their shelamim, shave, cast the hair under the pot'],
  ['wood', 'E', 'N', 'Chamber of the Wood (Dir HaEtzim)', 'לשכת דיר העצים', 'blemished kohanim pick wormy wood; tradition of the hidden Aron beneath its floor (Shekalim 6:1–2)'],
  ['lepers', 'W', 'N', 'Chamber of the Metzora\'im', 'לשכת המצורעים', 'metzora\'im immerse on their eighth day (R\' Yehudah: anyone — Yoma 30b)'],
  ['oil', 'W', 'S', 'Chamber of Oils (Beit Shamanya)', 'לשכת בית שמניה', 'wine and oil stores (Abba Shaul; REbY forgot its use)'],
];
for (const [key, cx, cy, en, he, use] of enChambers) {
  const [x0, y0, x1, y1] = enCorner(cx, cy);
  const doorFaceY = cy === 'S' ? y1 : y0;                     // door faces the court's E–W centerline ⚙
  const doorCx = (cx === 'W' ? x0 : x0 + EN_CHAMBER_WALL_T) + EN_CHAMBER / 2;
  add(`en.chamber.${key}`, { en, he, kind: 'chamber', b: [x0, y0, Z_EN, x1, y1, Z_EN + EN_CHAMBER_WALL_H],
    src: ['Middot 2:5', 'Rambam BhB 5:7–8', 'Part XI lock #23'], c: 'reconstruction',
    der: `interior ${EN_CHAMBER} x ${EN_CHAMBER} in the ${cy}${cx} corner; inner walls ${EN_CHAMBER_WALL_T} ⚙, height ${EN_CHAMBER_WALL_H} ⚙ (top +${Z_EN + EN_CHAMBER_WALL_H} = the low east wall)`,
    fc: { interior: 'explicit', corner: 'explicit', unroofed: 'explicit', innerWallT: 'reconstruction', height: 'reconstruction', door: 'reconstruction' },
    p: { interior: [EN_CHAMBER, EN_CHAMBER], roofed: false, innerWallT: EN_CHAMBER_WALL_T, use,
      door: { faceY: doorFaceY, x: [doorCx - GATE_W / 2, doorCx + GATE_W / 2], z: [Z_EN, Z_EN + GATE_H], note: 'position unsourced ⚙' } },
    n: 'Unroofed ("ketorot", Middot 2:5 from Yechezkel 46:21–22). The 30 x 40 variant is Yechezkel\'s and is not used.' });
}
// gezuztra (Middot 2:5; Sukkah 51b; Rambam BhB 5:9) — between the corner chambers on N, S, E; open over the E gate
const galZ0 = Z_EN + EN_GALLERY_Z, galZ1 = galZ0 + 1 + EN_GALLERY_PARAPET;
const xGal0 = X_EN_W + EN_CHAMBER + EN_CHAMBER_WALL_T, xGal1 = X_EN_E - EN_CHAMBER - EN_CHAMBER_WALL_T; // 302..353
const yGal0 = Y_AZ_S + EN_CHAMBER + EN_CHAMBER_WALL_T, yGal1 = Y_AZ_N - EN_CHAMBER - EN_CHAMBER_WALL_T; // 305..356
const galGateGap = [AXIS_Y - GATE_W / 2 - 3, AXIS_Y + GATE_W / 2 + 3];
add('en.gallery', { en: 'Gezuztra — the women\'s gallery', he: 'גזוזטרא', kind: 'slab',
  b: [xGal0, Y_AZ_S, galZ0, X_EN_E, Y_AZ_N, galZ1], src: ['Middot 2:5', 'Sukkah 51b–52a', 'Rambam BhB 5:9'], c: 'reconstruction',
  der: `balconies ${EN_GALLERY_D} deep, floor +${galZ0} (10 above EN) ⚙, parapet ${EN_GALLERY_PARAPET}`,
  p: { segments: [
    bx(xGal0, Y_AZ_N - EN_GALLERY_D, galZ0, xGal1, Y_AZ_N, galZ1),
    bx(xGal0, Y_AZ_S, galZ0, xGal1, Y_AZ_S + EN_GALLERY_D, galZ1),
    bx(X_EN_E - EN_GALLERY_D, yGal0, galZ0, X_EN_E, galGateGap[0], galZ1),
    bx(X_EN_E - EN_GALLERY_D, galGateGap[1], galZ0, X_EN_E, yGal1, galZ1)],
  floorZ: galZ0, depth: EN_GALLERY_D, parapet: EN_GALLERY_PARAPET, access: 'unsourced', permanent: 'Rambam BhB 5:9 codifies it; Sukkah 51b: built for Simchat Beit HaShoeivah' },
  n: 'Women above, men below (Middot 2:5). Not run along the W wall (15 steps, Nikanor) nor across the E gate opening.' });
// Lishkat Chasha'im (Shekalim 5:6) — a lock §58 nominal box: in Ezrat Nashim, open to every donor and every needy family,
// built into the N wall under the gezuztra balcony ⚙
const CHASH = { x0: (xGal0 + xGal1) / 2 - 7.5, x1: (xGal0 + xGal1) / 2 + 7.5, y0: Y_AZ_N - EN_GALLERY_D, y1: Y_CX_N }; // 320..335 x 394..403
add('en.chamber.chashaim', { en: "Lishkat Chasha'im (Chamber of Secret Gifts)", he: 'לשכת חשאים', kind: 'chamber',
  b: [CHASH.x0, CHASH.y0, Z_EN, CHASH.x1, CHASH.y1, galZ0],
  src: ['Shekalim 5:6', 'Part III §9.3', 'Part XII §60', L58], c: 'reconstruction',
  der: `nominal box (lock §58, footprint unsourced): in the EN N wall + ${EN_GALLERY_D} under the gallery, floor +${Z_EN}, roof = gallery floor +${galZ0} ⚙`,
  fc: { existence: 'explicit', footprint: 'reconstruction', position: 'reconstruction' },
  p: { footprint_unsourced: true, floorZ: Z_EN, door: { face: 'south', x: [CHASH.x0 + 5.5, CHASH.x0 + 9.5], z: [Z_EN, Z_EN + 6] },
    use: 'the sin-fearing put gifts in secretly and the poor of good families were supported from it secretly (Shekalim 5:6)',
    placementNote: 'Ezrat Nashim is open to men and women alike, which the secret gifts and the genteel poor need ⚙' } });
// the 15 semicircular steps (Middot 2:5) — concentric half-rings centered on Nikanor, rising westward
const S15_OUTER = STEPS15_LANDING_R + (NIKANOR_STEPS - 1) * STEP_TREAD; // 17.5
add('en.steps15', { en: 'The fifteen semicircular steps', he: 'חמש עשרה מעלות', kind: 'stair',
  b: [X_EN_W, AXIS_Y - S15_OUTER, Z_EN, X_EN_W + S15_OUTER, AXIS_Y + S15_OUTER, Z_EY],
  src: ['Middot 2:5', 'Rambam BhB 6:2', 'Sukkah 5:4', 'Part XI lock #45'], c: 'reconstruction',
  der: `15 x rise ½ = +7½ (6 → 13½); semicircles about [${X_EN_W}, ${AXIS_Y}], landing r ${STEPS15_LANDING_R} ⚙, foot r ${S15_OUTER}`,
  fc: { steps: 'explicit', rise: 'explicit', tread: 'explicit', semicircular: 'explicit', landingRadius: 'reconstruction' },
  p: { form: 'semicircle-east', center: [X_EN_W, AXIS_Y, Z_EN], steps: NIKANOR_STEPS, rise: STEP_RISE, tread: STEP_TREAD,
    landingRadius: STEPS15_LANDING_R, outerRadius: S15_OUTER, ascentHeading: 270,
    stepRadii: Array.from({ length: NIKANOR_STEPS }, (_, k) => ({ step: k + 1, topZ: Z_EN + (k + 1) * STEP_RISE, rOuter: S15_OUTER - k * STEP_TREAD })) },
  n: '"Not straight-cornered but rounded like half a round threshing floor" (Middot 2:5). The Levites sang on them; trumpeters descended them at Shoeivah dawn (Sukkah 5:4).' });
// music chambers under Ezrat Yisrael opening onto Ezrat Nashim (Middot 2:6; Rambam BhB 6:6)
const musicDoorY = { N: [AXIS_Y + S15_OUTER + 2, AXIS_Y + S15_OUTER + 6], S: [AXIS_Y - S15_OUTER - 6, AXIS_Y - S15_OUTER - 2] };
const MUSIC_LEN = 30;
add('en.music-chambers', { en: 'Chambers of the instruments (under Ezrat Yisrael)', he: 'לשכות כלי השיר', kind: 'chamber',
  b: [X_EY_W, musicDoorY.S[1] + 2 - MUSIC_LEN, Z_EN, X_EN_W, musicDoorY.N[0] - 2 + MUSIC_LEN, Z_EY - 0.5],
  src: ['Middot 2:6', 'Rambam BhB 6:6', 'Shiltei HaGiborim 3 (Part X §45)'], c: 'reconstruction',
  der: 'cellars in the 7½-amah step between EN (+6) and EY (+13½), flanking the 15 steps; doors through the Azarah E wall into EN',
  p: { rooms: [
    { side: 'N', box: bx(X_EY_W, musicDoorY.N[0] - 2, Z_EN, X_AZ_E, musicDoorY.N[0] - 2 + MUSIC_LEN, Z_EY - 0.5), door: bx(X_AZ_E, musicDoorY.N[0], Z_EN, X_EN_W, musicDoorY.N[1], Z_EN + 6) },
    { side: 'S', box: bx(X_EY_W, musicDoorY.S[1] + 2 - MUSIC_LEN, Z_EN, X_AZ_E, musicDoorY.S[1] + 2, Z_EY - 0.5), door: bx(X_AZ_E, musicDoorY.S[0], Z_EN, X_EN_W, musicDoorY.S[1], Z_EN + 6) }],
    contents: 'kinnorot, nevalim, metziltayim and all instruments of song (Middot 2:6); SG: also music books' },
  n: 'Doors fall between the foot of the 15 steps (r 17½) and the corner chambers (|Δy| ≥ 25½) — the only stretch of the wall that opens on the EN floor.' });

// ===== 3.3 Sha'ar Nikanor, Ezrat Yisrael, Ezrat Kohanim =====================
const Z_AZ_EAST_TOP = Z_EY + GATE_H + LINTEL_COURSE;   // 35.5 — Azarah E wall low (lock §58 "east low")
add('azarah.wall.east', { en: 'East wall of the Azarah (Nikanor wall)', he: 'כותל מזרחי של העזרה', kind: 'wall',
  b: [X_AZ_E, Y_AZ_S, Z_MOUNT, X_EN_W, Y_AZ_N, Z_AZ_EAST_TOP], src: ['Middot 2:4', L58], c: 'reconstruction',
  der: `5 thick; low (Middot 2:4; lock §58 "east low"); +${Z_AZ_EAST_TOP} = Nikanor head ${Z_EY + GATE_H} + lintel course ${LINTEL_COURSE} ⚙`,
  fc: { low: 'explicit', thickness: 'locked', height: 'reconstruction' },
  p: { thickness: COURT_WALL_T, openings: ['azarah.gate.nikanor', 'azarah.gate.nikanor.wicket-n', 'azarah.gate.nikanor.wicket-s'],
    voids: ['azarah.chamber.pinchas', 'azarah.chamber.chavitin'], alsoPierces: ['en.music-chambers'], alsoPiercesNote: 'the two music-chamber doors (en.music-chambers params.rooms[].door)',
    corners: 'spans only between the N and S walls (Y 263–398): the high N/S walls run through the corner squares (X 255–260), as the EN N/S walls run through theirs at X 395–400, so no notch drops to +35½ between the 56 and 46 walls' },
  n: 'Read as one of the "eastern walls" kept low (Middot 2:4; lock §58 court walls "east low"). With it at +56 the Parah line still threads the Nikanor opening, but sees only the lowest ~5 amot of the Heichal doorway.' });
add('azarah.gate.nikanor', { en: "Sha'ar Nikanor (the Upper Gate)", he: 'שער ניקנור', kind: 'gate',
  b: [X_AZ_E, AXIS_Y - GATE_W / 2, Z_EY, X_EN_W, AXIS_Y + GATE_W / 2, Z_EY + GATE_H],
  src: ['Middot 1:4', 'Middot 2:3', 'Middot 2:6', 'Rambam BhB 5:4–5', 'Yoma 38a', 'Part XI lock #14'], c: 'derived',
  der: 'centered on the axis opposite the Heichal (Rambam BhB 5:4); threshold +13½ at the head of the 15 steps',
  p: { width: GATE_W, height: GATE_H, doors: 2, doorFinish: 'Corinthian bronze, unplated, gleaming like gold (lock #14)', curtain: 'parochet (one of the 13 — Yoma 54a)',
    thresholdSanctity: 'unsanctified as Azarah: stations of the metzora, sotah, yoledet (Yoma 30b–31a; Sotah 1:5)', faces: 90 } });
const WICKET_OFF = GATE_W / 2 + 2;     // ⚙ wicket from 7 to 10 off the axis
add('azarah.gate.nikanor.wicket-n', { en: 'Nikanor — north (right) wicket', he: 'פשפש ימני של שער ניקנור', kind: 'opening',
  b: [X_AZ_E, AXIS_Y + WICKET_OFF, Z_EY, X_EN_W, AXIS_Y + WICKET_OFF + WICKET_W, Z_EY + WICKET_H],
  src: ['Middot 2:6', 'Shekalim 6:3', 'EK I 253–254, 288–289 (Part X §48)'], c: 'reconstruction',
  der: 'one on its right, one on its left; = doorway of the flanking chamber built in the wall (EK/Chanukat HaBayit)',
  p: { width: WICKET_W, height: WICKET_H, opensInto: 'azarah.chamber.pinchas' } });
add('azarah.gate.nikanor.wicket-s', { en: 'Nikanor — south (left) wicket', he: 'פשפש שמאלי של שער ניקנור', kind: 'opening',
  b: [X_AZ_E, AXIS_Y - WICKET_OFF - WICKET_W, Z_EY, X_EN_W, AXIS_Y - WICKET_OFF, Z_EY + WICKET_H],
  src: ['Middot 2:6', 'Shekalim 6:3', 'EK I 253–254 (Part X §48)'], c: 'reconstruction',
  der: 'mirror of the north wicket', p: { width: WICKET_W, height: WICKET_H, opensInto: 'azarah.chamber.chavitin' } });
const NIK_CH_LEN = 10, NIK_CH_DEPTH = 7;  // ⚙
const NIK_CH_DOOR = { w: 4, h: 8 };       // ⚙ door to Ezrat Yisrael, centred on the west face (as built by build-courts); the pishpash scale (Zevachim 55b)
const nikChDoor = (y0, y1) => ({ face: 'west', x: X_AZ_E - NIK_CH_DEPTH, y: [(y0 + y1) / 2 - NIK_CH_DOOR.w / 2, (y0 + y1) / 2 + NIK_CH_DOOR.w / 2], z: [Z_EY, Z_EY + NIK_CH_DOOR.h], note: 'to Ezrat Yisrael; size and place ⚙' });
add('azarah.chamber.pinchas', { en: 'Chamber of Pinchas HaMalbish (vestments)', he: 'לשכת פנחס המלביש', kind: 'chamber',
  b: [X_AZ_E - NIK_CH_DEPTH, AXIS_Y + GATE_W / 2 + 1, Z_EY, X_EN_W, AXIS_Y + GATE_W / 2 + 1 + NIK_CH_LEN, Z_EY + GATE_H],
  src: ['Middot 1:4', 'Rambam BhB 5:17', 'Yoma 19a'], c: 'reconstruction',
  der: 'right of the gate for one entering westward = north (Rambam BhB 5:17 "to the right of the east gate"); in the wall + 7 into EY',
  p: { floorZ: Z_EY, doors: ['wicket to EN (azarah.gate.nikanor.wicket-n)', 'door to Ezrat Yisrael (west face) ⚙'], door: nikChDoor(AXIS_Y + GATE_W / 2 + 1, AXIS_Y + GATE_W / 2 + 1 + NIK_CH_LEN),
    zone: 'lishkat-pinchas', inEzratYisrael: 'Rambam BhB 5:17: "two other chambers were there in Ezrat Yisrael"' } });
add('azarah.chamber.chavitin', { en: 'Chamber of the Chavitin bakers', he: 'לשכת עושי חביתין', kind: 'chamber',
  b: [X_AZ_E - NIK_CH_DEPTH, AXIS_Y - GATE_W / 2 - 1 - NIK_CH_LEN, Z_EY, X_EN_W, AXIS_Y - GATE_W / 2 - 1, Z_EY + GATE_H],
  src: ['Middot 1:4', 'Rambam BhB 5:17', 'Tamid 1:3'], c: 'reconstruction',
  der: 'left of the gate = south; mirror of Pinchas',
  p: { floorZ: Z_EY, doors: ['wicket to EN (azarah.gate.nikanor.wicket-s)', 'door to Ezrat Yisrael ⚙'], door: nikChDoor(AXIS_Y - GATE_W / 2 - 1 - NIK_CH_LEN, AXIS_Y - GATE_W / 2 - 1),
    zone: 'lishkat-chavitin', note: 'the two dawn inspection companies met here (Tamid 1:3)' } });
add('azarah.ezrat-yisrael', { en: 'Ezrat Yisrael', he: 'עזרת ישראל', kind: 'floor',
  b: [X_EY_W, Y_AZ_S, Z_EY - 0.5, X_AZ_E, Y_AZ_N, Z_EY], src: ['Middot 2:6', 'Middot 5:1', 'Rambam BhB 5:12', 'Rambam BhB 6:2'], c: 'explicit',
  der: `${AZ_WID} x ${EY} at +${Z_EY} (the first 11 of the 187)`, p: { floorZ: Z_EY } });
const X_DUCHAN_E = X_EY_W, X_DUCHAN_W = X_DUCHAN_E - DUCHAN_STEP_TREAD - (DUCHAN_HALF_STEPS - 1) * STEP_TREAD; // 244 → 242
add('azarah.duchan', { en: 'The 1-amah step and the duchan of the Levites', he: 'מעלה ודוכן', kind: 'stair',
  b: [X_DUCHAN_W, Y_AZ_S, Z_EY, X_DUCHAN_E, Y_AZ_N, Z_AZ], src: ['Middot 2:6 (REbY)', 'Rambam BhB 6:3', 'Rambam BhB 6:6', 'Arachin 2:6', 'Part XI lock #10'], c: 'reconstruction',
  fc: { oneAmahStep: 'locked', threeHalfSteps: 'locked', totalRise: 'explicit', halfTreads: 'explicit', stepTread: 'reconstruction', inEzratKohanim: 'reconstruction' },
  der: `riser 1 at X ${X_DUCHAN_E} → +${Z_EY + DUCHAN_STEP} (tread ${DUCHAN_STEP_TREAD} ⚙), then 3 half-steps → +${Z_AZ}`,
  p: { ascentHeading: 270, profile: [
    { x: X_DUCHAN_E, rise: DUCHAN_STEP, topZ: Z_EY + DUCHAN_STEP, tread: DUCHAN_STEP_TREAD },
    { x: X_DUCHAN_E - DUCHAN_STEP_TREAD, rise: STEP_RISE, topZ: Z_EY + 1.5, tread: STEP_TREAD },
    { x: X_DUCHAN_E - DUCHAN_STEP_TREAD - STEP_TREAD, rise: STEP_RISE, topZ: Z_EY + 2, tread: STEP_TREAD },
    { x: X_DUCHAN_W, rise: STEP_RISE, topZ: Z_AZ, tread: 'EK floor' }],
    boundaryMarkers: 'rashei pispasin between EY and EK (Middot 2:6, stam)', levitesMin: 12 },
  n: 'Built within the east edge of Ezrat Kohanim (the higher court); the Levites stood on it to sing over the korban.' });
add('azarah.ezrat-kohanim', { en: 'Ezrat Kohanim', he: 'עזרת כהנים', kind: 'zone',
  b: [X_EK_W, Y_AZ_S, Z_AZ, X_EY_W, Y_AZ_N, Z_AZ + 0.01], src: ['Middot 2:6', 'Middot 5:1', 'Rambam BhB 6:3'], c: 'explicit',
  der: `${AZ_WID} x ${EK} at +${Z_AZ} (2½ above EY)`, p: { floorZ: Z_AZ } });

// ===== 3.4 The Azarah envelope, gates, flights ===============================
add('azarah.floor', { en: 'Azarah pavement', he: 'רצפת העזרה', kind: 'floor',
  b: [X_AZ_W, Y_AZ_S, Z_AZ - 1, X_DUCHAN_W, Y_AZ_N, Z_AZ], src: ['Middot 5:1–2', 'Rambam BhB 1:10', 'Rambam BhB 5:12', 'Zevachim 24a'], c: 'explicit',
  der: `X ${X_AZ_W}–${X_DUCHAN_W} at +${Z_AZ}: the court from behind the Kaporet through Ezrat Kohanim (mekom drisat haKohanim, X ${X_EK_W}–${X_EY_W}) up to the foot of the duchan`,
  p: { floorZ: Z_AZ, paving: '"precious stones" (Rambam BhB 1:10)', hollowUnder: 'yes, except under the altar (Zevachim 58a)', includes: 'the Ezrat Kohanim pavement X 233–242 (azarah.ezrat-kohanim is the zone)' } });
// Rooms inside the wall lines: `voids` = rooms built within a wall's thickness (cut them; the wall continues above and below);
// `replacedBy` = the wall is omitted along that element's plan; `cutouts` = explicit boxes removed from the wall.
const azWallsNS = { north: [X_CX_W, Y_AZ_N, X_EN_W, Y_CX_N], south: [X_CX_W, Y_CX_S, X_EN_W, Y_AZ_S] };   // through both corner squares (W and E)
const COURT_WALL_FC = { thickness: 'locked', height: 'locked', heightDatum: 'reconstruction' };
add('azarah.wall.north', { en: 'Azarah wall — north', he: 'כותל העזרה — צפון', kind: 'wall',
  b: [azWallsNS.north[0], azWallsNS.north[1], Z_MOUNT, azWallsNS.north[2], azWallsNS.north[3], Z_AZ + COURT_WALL_H], src: [L58, 'Middot 2:4', 'Rambam BhB 1:8'], c: 'locked',
  der: `5 thick; top = Azarah floor + ${COURT_WALL_H} = ${Z_AZ + COURT_WALL_H} (lock §58 baseline, read above this court's floor ⚙)`, fc: COURT_WALL_FC,
  p: { thickness: COURT_WALL_T, openings: ['azarah.gate.nitzotz', 'azarah.gate.korban'], replacedBy: ['azarah.moked.hall'],
    voids: ['azarah.gate.nitzotz.exedra', 'azarah.beit-hanitzotz', 'azarah.chamber.etz', 'azarah.chamber.kelim'],
    windows: 'attested collectively, positions unstated (Zevachim 56a — F5)' } });
add('azarah.wall.south', { en: 'Azarah wall — south', he: 'כותל העזרה — דרום', kind: 'wall',
  b: [azWallsNS.south[0], azWallsNS.south[1], Z_MOUNT, azWallsNS.south[2], azWallsNS.south[3], Z_AZ + COURT_WALL_H], src: [L58, 'Middot 2:4'], c: 'locked',
  der: `5 thick; top ${Z_AZ + COURT_WALL_H} (lock §58 baseline, read above this court's floor ⚙); lowered to the Water Gate house roof over its span`, fc: COURT_WALL_FC,
  p: { thickness: COURT_WALL_T, openings: ['azarah.gate.delek', 'azarah.gate.bechorot', 'azarah.gate.mayim'],
    voids: ['azarah.gate.mayim.house'], cutouts: [] /* filled with the Water Gate roof terrace below */, windows: 'F5 — unstated' } });
add('azarah.wall.west', { en: 'Azarah wall — west', he: 'כותל העזרה — מערב', kind: 'wall',
  b: [X_CX_W, Y_AZ_S, Z_MOUNT, X_AZ_W, Y_AZ_N, Z_AZ + COURT_WALL_H], src: [L58, 'Middot 2:4'], c: 'locked',
  der: `5 thick; top ${Z_AZ + COURT_WALL_H} (lock §58 baseline, read above this court's floor ⚙)`, fc: COURT_WALL_FC,
  p: { thickness: COURT_WALL_T, replacedBy: ['azarah.chamber.gazit'] } });
// The seven gates (Middot 1:4–5; Rambam BhB 5:4; lock #9) — N/S at 39¼ spacing (lock §58)
const GATEHOUSE_W = 30;                          // ⚙ Water Gate house (stays within the wall: the 12½ S margin is explicit)
const gateHouse = (cx, side) => side === 'S'
  ? [cx - GATEHOUSE_W / 2, Y_CX_S, cx + GATEHOUSE_W / 2, Y_AZ_S]
  : [cx - MOKED / 2, Y_AZ_N - COURT_WALL_T, cx + MOKED / 2, Y_CX_N];   // Nitzotz exedra projects 5 into the court (clear of the altar chain) ⚙
const azGates = [
  ['delek', 'S', 0, "Sha'ar HaDelek", 'שער הדלק', 'firewood brought in (Middot 1:4)'],
  ['bechorot', 'S', 1, "Sha'ar HaBechorot", 'שער הבכורות', 'firstborn animals brought in (Middot 1:4)'],
  ['mayim', 'S', 2, "Sha'ar HaMayim (Water Gate)", 'שער המים', 'the Sukkot water flask; En-Eitam aqueduct; opposite the altar (Middot 2:6; Shekalim 6:3)'],
  ['nitzotz', 'N', 0, "Sha'ar HaNitzotz", 'שער הניצוץ', 'an exedra with an upper storey; door to the chel (Middot 1:5)'],
  ['korban', 'N', 1, "Sha'ar HaKorban", 'שער הקרבן', 'kodshei kodashim animals enter (Middot 1:5)'],
];
const flights = [];
for (const [key, side, i, en, he, use] of azGates) {
  const cx = AZ_GATE_CX[i];
  const yw0 = side === 'S' ? Y_CX_S : Y_AZ_N, yw1 = side === 'S' ? Y_AZ_S : Y_CX_N;
  add(`azarah.gate.${key}`, { en, he, kind: 'gate', b: [cx - GATE_W / 2, yw0, Z_AZ, cx + GATE_W / 2, yw1, Z_AZ + GATE_H],
    src: ['Middot 1:4–5', 'Middot 2:3', 'Rambam BhB 5:4', 'Yoma 31a–b', 'Part XI lock #9', L58], c: 'locked',
    der: `${side} wall, ${['west', 'middle', 'east'][i]} of three at 39¼ spacing → center X ${cx}`,
    p: { width: GATE_W, height: GATE_H, doors: 2, doorFinish: 'gold-plated', curtain: 'parochet (one of the 13 — Yoma 54a)', roofZ: Z_AZ + GATEHOUSE_ROOF, roof: 'thin marble (Yoma 31b)', use,
      faces: side === 'S' ? 180 : 0, flight: `azarah.gate.${key}.flight` } });
  // exterior flight down to the chel/Mount: 32 half-steps (EK I 202–215 — they cross the soreg line on N and S)
  const y0 = side === 'S' ? Y_CX_S : Y_CX_N, y1 = side === 'S' ? Y_CX_S - FLIGHT_RISERS * STEP_TREAD : Y_CX_N + FLIGHT_RISERS * STEP_TREAD;
  add(`azarah.gate.${key}.flight`, { en: `${en} — exterior steps`, he: `מעלות ${he}`, kind: 'stair',
    b: [cx - GATE_W / 2, y0, Z_MOUNT, cx + GATE_W / 2, y1, Z_AZ], src: ['Middot 2:3', 'Rambam BhB 6:1–4', 'EK I 202–215 (Part X §49)'], c: 'reconstruction',
    der: `${FLIGHT_RISERS} x rise ½ / tread ½ from +${Z_AZ} to the Mount; run ${FLIGHT_RISERS * STEP_TREAD}`,
    p: { steps: FLIGHT_RISERS, rise: STEP_RISE, tread: STEP_TREAD, ascentHeading: side === 'S' ? 0 : 180, head: [cx, y0, Z_AZ], foot: [cx, y1, Z_MOUNT] },
    n: 'The sources give no stair for the N/S gates; the elevation ladder forces one. EK notes it must cross the 10-amah chel and the soreg line.' });
  flights.push({ id: `azarah.gate.${key}.flight`, side, along: 'X', from: cx - GATE_W / 2, to: cx + GATE_W / 2 });
}
// Water Gate gatehouse, Beit Avtinas (aliyah over it) and the KG's first mikveh on its roof (Yoma 19a, 31a)
{
  const [x0, y0, x1, y1] = gateHouse(AZ_GATE_CX[2], 'S');
  const zr = Z_AZ + GATEHOUSE_ROOF;
  // as built by build-courts ⚙: ½-amah marble walls; the newel stair fills the east room's depth; the walk runs along the court edge
  const GATEHOUSE_WALL_T = 0.5, STAIR_R = (y1 - y0) / 2 - GATEHOUSE_WALL_T - 0.05;      // 1.95
  const stairC = [x1 - GATEHOUSE_WALL_T - STAIR_R - 0.05, (y0 + y1) / 2];                  // 223.25, 260.5
  const WALK = [y1 - 2, y1 - 0.4];                                                         // 261 .. 262.6
  // the S wall stops at the gatehouse roof over its span, so Beit Avtinas and the mikveh stand on an open roof terrace
  elements['azarah.wall.south'].params.cutouts.push({ id: 'water-gate roof terrace', box: bx(x0, y0, zr, x1, y1, Z_AZ + COURT_WALL_H),
    note: 'wall lowered to the Water Gate house roof (+36) over its 30-amah span: Beit Avtinas is an aliyah "on" the gate (Tamid 1:1; Rambam BhB 8:5) and the mikveh is "on the roof of the Water Gate" (Yoma 31a) ⚙' });
  add('azarah.gate.mayim.house', { en: 'Water Gate gatehouse', he: 'בית שער המים', kind: 'chamber', b: [x0, y0, Z_AZ, x1, y1, zr],
    src: ['Yoma 31a–b', 'Middot 1:4'], c: 'reconstruction', der: `within the wall thickness; roof at gate head +${zr} ("marble, negligibly thin" — Yoma 31b); ${GATEHOUSE_W} wide ⚙`,
    fc: { roofAtGateHead: 'explicit', width: 'reconstruction', withinWall: 'reconstruction' },
    p: { roofZ: zr, roofTerrace: true, wallT: GATEHOUSE_WALL_T,
      roofStair: { form: 'newel spiral', center: [r6(stairC[0]), r6(stairC[1])], radius: STAIR_R, box: bx(stairC[0] - STAIR_R, stairC[1] - STAIR_R, Z_AZ, stairC[0] + STAIR_R, stairC[1] + STAIR_R, zr),
        steps: (zr - Z_AZ) / STEP_RISE, headOpening: 'its head is an open well in the roof (the box at +36): not walkable',
        note: 'access to the roof, Beit Avtinas and the mikveh — unsourced ⚙: a newel stair filling the depth of the gatehouse\'s east room (r 1.95 inside ½-amah marble walls, Yoma 31b — as built by build-courts; a 3-amah stair cannot pass a person), its last step turned west onto the terrace walk',
        // annotation (builders-2-outer): the head as built; headOpening and terraceWalk's east end await site-model
        asBuilt: { perTurn: 15, topStepEnds: 'due north of the newel; the walker steps off westward onto the landing', well: 'the stair\'s square less its north-west quarter',
          landing: { box: bx(stairC[0] - STAIR_R, stairC[1], zr, stairC[0], stairC[1] + STAIR_R, zr), parapet: bx(stairC[0] - STAIR_R, stairC[1], zr, stairC[0] - 0.45, stairC[1] + 0.3, r6(zr + ROOF_PARAPET_H)) },
          walkEndX: stairC[0],
          note: 'the well\'s north-west quarter stays roofed as a walkable landing (10-tefach parapet on its open south edge), and the terrace walk runs on over it to the newel (X 223.25), so headOpening\'s "not walkable" and terraceWalk.box\'s east end (X 221.3) describe the earlier head ⚙' } },
      terraceWalk: { box: bx(x0 + 20, WALK[0], zr, stairC[0] - STAIR_R, WALK[1], zr),
        note: 'the walk along the court-side edge from the stair head past the mikveh to Beit Avtinas\'s east door, behind a 0.4-amah parapet (to Y 263) ⚙. East of the mikveh is the stair\'s open well, and the court\'s S wall rises 20 amot just beyond it (X ≥ 225.75): no further walkable roof there' } } });
  add('azarah.beit-avtinas', { en: 'Beit Avtinas (upper chamber over the Water Gate)', he: 'בית אבטינס', kind: 'chamber',
    b: [x0, y0, zr, x0 + 20, y1, zr + UPPER_ROOM_H], src: ['Tamid 1:1', 'Middot 1:1', 'Yoma 19a', 'Yoma 38a', 'Rambam BhB 8:5'], c: 'reconstruction',
    der: 'aliyah on the Water Gate roof terrace (+36); footprint ⚙',
    fc: { onWaterGate: 'explicit', footprint: 'reconstruction', height: 'reconstruction' },
    p: { floorZ: zr, use: 'incense compounding; KG\'s oath night; kohanic watch post', access: 'from the roof terrace (azarah.gate.mayim.house params.roofStair) ⚙' } });
  // tank 3½ x 2½ (as built by build-courts): between the stair well and Beit Avtinas, south of the walk, so the walk stays open ⚙
  const mx0 = x0 + 22, mx1 = stairC[0] - STAIR_R - 0.05, my0 = y0 + 0.5, my1 = WALK[0];
  add('azarah.mikveh.mayim-roof', { en: 'KG\'s first-immersion mikveh on the Water Gate roof', he: 'מקוה על גבי שער המים', kind: 'fixture',
    b: [mx0, my0, zr, mx1, my1, zr + MIKVEH_DEPTH], src: ['Yoma 31a (Abaye)', 'Yoma 19a', 'Part XIV §65.7'], c: 'reconstruction',
    der: `water surface = gate head ${GATEHOUSE_ROOF} + mikveh ${MIKVEH_DEPTH} = ${GATEHOUSE_ROOF + MIKVEH_DEPTH} over the Azarah floor = En Eitam head (Yoma 31a); tank ${r6(mx1 - mx0)} x ${r6(my1 - my0)} and its place on the terrace ⚙`,
    fc: { waterSurfaceZ: 'derived', depth: 'explicit', size: 'reconstruction', position: 'reconstruction' },
    p: { waterSurfaceZ: zr + MIKVEH_DEPTH, enEitamHeadZ: Z_AZ + 23, sanctity: 'chol (roofs not sanctified)', screen: 'linen sheet (Yoma 3:4)', open: 'on the open roof terrace',
      sizeNote: `outer tank ${r6(mx1 - mx0)} x ${r6(my1 - my0)} (narrowed from 4 x 4 so the terrace walk to Beit Avtinas stays open); water 2.7 x 1.7 x 3 inside its walls ≥ the amah x amah x 3 of Yoma 31a; steps up its west side ⚙`,
      westSteps: bx(mx0 - 1.6, my0, zr, mx0, my1, zr + MIKVEH_DEPTH + 0.5) } });
}
// Nitzotz gatehouse (exedra) + Beit HaNitzotz upper storey (Middot 1:5; Tamid 1:1)
{
  const [x0, y0, x1, y1] = gateHouse(AZ_GATE_CX[0], 'N');
  const zr = Z_AZ + GATEHOUSE_ROOF;
  add('azarah.gate.nitzotz.exedra', { en: "Sha'ar HaNitzotz — exedra", he: 'אכסדרה של שער הניצוץ', kind: 'chamber', b: [x0, y0, Z_AZ, x1, y1, zr],
    src: ['Middot 1:5', 'Yoma 19a'], c: 'reconstruction', der: `"like an exedra" — open colonnaded gatehouse; roof +${zr}; ${MOKED} wide ⚙`,
    p: { open: 'colonnaded on the court side ⚙', guards: 'Levites below (Middot 1:5)', doorToChel: 'via the gate and its flight' } });
  add('azarah.beit-hanitzotz', { en: 'Beit HaNitzotz (upper storey)', he: 'בית הניצוץ', kind: 'chamber', b: [x0, y0, zr, x1, y1, zr + UPPER_ROOM_H],
    src: ['Middot 1:1', 'Middot 1:5', 'Tamid 1:1'], c: 'reconstruction', der: '"an upper storey built on top" — kohanim watch above (Middot 1:5); footprint and height ⚙',
    fc: { onTheGate: 'explicit', footprint: 'reconstruction', height: 'reconstruction' },
    p: { floorZ: zr, openBays: 'F12 (Part VII §22)', within: 'the N wall line; it is listed in azarah.wall.north params.voids' } });
}
// Lishkat HaKelim (Shekalim 5:6; Tamid 3:4) — a lock §58 nominal box: NE corner of the court, 7 into Ezrat Yisrael + the N wall ⚙
const KELIM = { x0: X_EY_W, x1: X_AZ_E, y0: Y_AZ_N - 7, y1: Y_CX_N };   // 244..255 x 391..403
add('azarah.chamber.kelim', { en: 'Lishkat HaKelim (Chamber of the Vessels)', he: 'לשכת הכלים', kind: 'chamber',
  b: [KELIM.x0, KELIM.y0, Z_EY, KELIM.x1, KELIM.y1, Z_EY + GATE_H],
  src: ['Shekalim 5:6', 'Tamid 3:4', 'Part III §9.3', 'Part XII §60', L58], c: 'reconstruction',
  der: 'nominal box (lock §58, footprint unsourced): NE corner of the court, 7 into Ezrat Yisrael and through the N wall; floor +13½ ⚙',
  fc: { existence: 'explicit', footprint: 'reconstruction', position: 'reconstruction' },
  p: { footprint_unsourced: true, floorZ: Z_EY, door: { face: 'south', x: [KELIM.x0 + 3.5, KELIM.x0 + 7.5], z: [Z_EY, Z_EY + 8] },
    use: 'donated vessels thrown in, opened every 30 days by the treasurers (Shekalim 5:6); the 93 gold and silver vessels of the daily service were taken from it (Tamid 3:4)',
    placementNote: 'reachable from the Azarah at dawn, a short walk from the lamb chamber (Tamid 3:3–4), and open to any Israelite donor from Ezrat Yisrael ⚙' } });

// ===== 3.5 The six chambers, Beit HaMoked, underground ======================
// Gazit straddles the Azarah WEST wall at its north end: Yoma 25a (Abaye) — lottery in its EAST in kodesh, elder sitting in its
// WEST in chol → the kodesh/chol line runs N–S, which on the Azarah's outline only the W wall provides with kodesh to the east.
// This is a reading of lock #7 ("Gazit trio NORTH"): the chamber stands in the north of the court, against the Etz, but straddles
// the W wall (flagged for sign-off; the N-wall straddle is kept as params.variants.nWallStraddle).
const GAZIT_SPLIT_X = X_CX_W + COURT_WALL_T / 2;   // 65.5 — rashei pispasin line (half / half — Rambam BhB 5:17)
const GAZIT_MID_Y = (GAZIT.y0 + GAZIT.y1) / 2;
add('azarah.chamber.gazit', { en: 'Lishkat HaGazit (Chamber of Hewn Stone)', he: 'לשכת הגזית', kind: 'chamber',
  b: [GAZIT.x0, GAZIT.y0, Z_AZ, GAZIT.x1, GAZIT.y1, Z_AZ + CHAMBER_ROOF],
  src: ['Middot 5:4', 'Yoma 25a', 'Yoma 19a', 'Rambam BhB 5:17', 'Rambam BhB 6:7–8', 'Tamid 2:5–5:1', 'Part XI lock #7', 'Middot 2:3 with Zevachim 55b (doors)'], c: 'reconstruction',
  der: `straddles the Azarah W wall in front of the Etz; kodesh (east) half X ${GAZIT_SPLIT_X}–${GAZIT.x1}, chol (west) half ${GAZIT.x0}–${GAZIT_SPLIT_X}; 45 x 20 ⚙`,
  fc: { halfKodeshHalfChol: 'explicit', twoDoors: 'explicit', kodeshEastCholWest: 'derived', northTrio: 'locked', placement: 'reconstruction', footprint: 'reconstruction' },
  p: { form: 'like a great basilica (Yoma 25a)', kodeshHalf: bx(GAZIT_SPLIT_X, GAZIT.y0, Z_AZ, GAZIT.x1, GAZIT.y1, Z_AZ + CHAMBER_ROOF),
    cholHalf: bx(GAZIT.x0, GAZIT.y0, Z_AZ, GAZIT_SPLIT_X, GAZIT.y1, Z_AZ + CHAMBER_ROOF), dividingLine: { x: GAZIT_SPLIT_X, marker: 'rashei pispasin' },
    doors: [{ to: 'Azarah (kodesh)', face: 'east', x: GAZIT.x1, y: [GAZIT.y0 + 1, GOLAH.y0 - 1], z: [Z_AZ, Z_AZ + CHAMBER_DOOR_H],
      note: 'the clear opening: 1-amah piers at the chamber\'s SE corner and before the Golah\'s SW corner (the free stretch of the east face is Y 371–381) ⚙' },
    { to: 'chel (chol)', face: 'west', x: GAZIT.x0, y: [GAZIT_MID_Y - 5, GAZIT_MID_Y + 5], z: [Z_AZ, Z_AZ + CHAMBER_DOOR_H], flight: 'azarah.chamber.gazit.flight' }],
    doorRule: 'chamber doors are not the 20 x 10 of Middot 2:3 ("all the openings and gates there"), which is the gates\' and great doorways\' standard. Zevachim 55b quotes the rule as "all the gates there" against the 8-amah pishpeshin of the beit hachalifot and answers "pishpeshin are different" (פשפשין שאני); Rambam BhB 5:5 states it of the gates ("every gate of them", כל שער מהן); Middot 4:3 gives each ta three openings, which cannot be 20 high. Heights (CHAMBER_DOOR_H = 16) and widths ⚙',
    stations: { lottery: [GAZIT.x1 - 8, GAZIT_MID_Y, Z_AZ], sanhedrin: [GAZIT.x0 + 10, GAZIT_MID_Y, Z_AZ] },
    podium: 'azarah.chamber.gazit.podium', roofLevelWith: ['azarah.chamber.golah', 'azarah.chamber.etz'],
    variants: { nWallStraddle: { note: 'lock #7 read as "straddling the N wall": its halves would be N (chol) / S (kodesh), against Yoma 25a\'s lottery-in-the-east / elder-in-the-west; recorded, not built (docs/decisions/site-model-fix.md)' } } },
  n: 'Footprint unsourced (§20 #3). EK\'s own east-wall Gazit is recorded, not adopted. The Sanhedrin sat in the chol half (Rambam BhB 5:17). A 5½-amah passage stays open between it and the Heichal\'s north wall.' });
add('azarah.chamber.gazit.podium', { en: 'Lishkat HaGazit — substructure of the chol half', he: 'יסוד לשכת הגזית', kind: 'slab',
  b: [GAZIT.x0, GAZIT.y0, Z_MOUNT, X_CX_W, GAZIT.y1, Z_AZ], src: ['Yoma 25a', 'Rambam BhB 6:8', 'EK I 174, 184 (Part X §47)'], c: 'reconstruction',
  der: `solid masonry from the Mount (Z0) up to the Azarah floor (+${Z_AZ}) under the part outside the W wall ⚙`,
  p: { topZ: Z_AZ, carries: 'azarah.chamber.gazit', note: 'built in chol; the court podium (EK\'s mechilot #2) does not extend past the walls' } });
add('azarah.chamber.golah', { en: 'Lishkat HaGolah (cistern and wheel)', he: 'לשכת הגולה', kind: 'chamber',
  b: [GOLAH.x0, GOLAH.y0, Z_AZ, GOLAH.x1, GOLAH.y1, Z_AZ + CHAMBER_ROOF], src: ['Middot 5:4', 'Yoma 19a', 'Rambam BhB 5:17'], c: 'reconstruction',
  der: 'inside the Azarah east of the Gazit, in front of the Etz; footprint 10 x 10 ⚙',
  fc: { northTrio: 'locked', inFrontOfEtz: 'explicit', footprint: 'reconstruction' },
  p: { cistern: { box: bx(GOLAH.x0 + 2, GOLAH.y0 + 2, Z_MOUNT + 2, GOLAH.x1 - 2, GOLAH.y1 - 2, Z_AZ - 1) }, wheel: 'galgal on the cistern (Middot 5:4)', use: 'supplies water to the whole Azarah',
    door: { face: 'south', x: [GOLAH.x0 + 3, GOLAH.x1 - 3], z: [Z_AZ, Z_AZ + 8], note: 'a small service door (as built) ⚙' } } });
add('azarah.chamber.etz', { en: 'Lishkat HaEtz = Lishkat Parhedrin (KG\'s chamber)', he: 'לשכת העץ — לשכת פרהדרין', kind: 'chamber',
  b: [ETZ.x0, ETZ.y0, Z_AZ, ETZ.x1, ETZ.y1, Z_AZ + CHAMBER_ROOF],
  src: ['Middot 5:3–4 (Abba Shaul)', 'Rambam BhB 5:17', 'Rambam BhB 6:7', 'Yoma 2a', 'Yoma 8b', 'Yoma 10a', 'Yoma 11a', 'Yoma 19a', 'Part X §52', 'Part XI locks #7, #20'], c: 'reconstruction',
  der: `"behind both of them" (Middot 5:4): inside the Azarah against the N wall and through its thickness, with the Gazit and Golah in front; ${ETZ.x1 - ETZ.x0} x ${ETZ_D} + the 5-amah wall ⚙; roofs of all three level`,
  fc: { inAzarah: 'explicit', behindBoth: 'explicit', roofLevel: 'explicit', northTrio: 'locked', footprint: 'reconstruction' },
  p: { sanctity: 'chol — built in kodesh, opening only to chol (Rambam BhB 6:7); a dwelling, the only chamber with a mezuzah (Yoma 10a)',
    door: { face: 'north', x: [ETZ.x0 + 10, ETZ.x0 + 20], z: [Z_AZ, Z_AZ + CHAMBER_DOOR_H], throughWall: true, flight: 'azarah.chamber.etz.flight', note: 'height ⚙ (CHAMBER_DOOR_H)' } },
  n: 'Middot 5:3 counts it among the "six chambers in the Azarah"; Yoma 11a puts Lishkat Parhedrin "inside" Sha\'ar Nikanor; EK (Part X §52) keeps it in the Azarah opening to chol. Yoma 19a\'s inference (Parhedrin south, beside the Water Gate) is the flagged alternative (Register #20).' });
// south trio (lock #7): Melach, Parvah, Medichin along the S wall
const SCH_DEPTH = 12;
const southTrio = [
  ['melach', 75, 95, 'Lishkat HaMelach (salt)', 'לשכת המלח', 'salt for the korbanot', {}],
  ['parvah', azGateX0(0) + GATE_W + 3, azGateX0(0) + GATE_W + 23, 'Lishkat HaParvah (hides)', 'לשכת הפרוה', 'hides of kodashim salted',
    { roofMikveh: { note: 'Beit HaTevilah of the KG on Yom Kippur on its roof (Middot 5:3) — four immersions, ten kiddushin, in kodesh (Yoma 31a)', waterSurfaceZ: Z_AZ + CHAMBER_ROOF + MIKVEH_DEPTH } }],
  ['medichin', azGateX0(0) + GATE_W + 23, azGateX0(0) + GATE_W + 35, 'Lishkat HaMedichin (rinsers)', 'לשכת המדיחין', 'innards of kodashim rinsed',
    { mesibah: { note: 'a winding stair from it up to the Parvah roof (Middot 5:3); a newel stair sized for a person (r 1.9 round a ½-amah newel, ≥ 1.35 of tread — as built by build-courts) in the chamber\'s SW corner, the box incl. the chamber\'s 1-amah walls ⚙',
      form: 'newel spiral', center: [r6(azGateX0(0) + GATE_W + 23 + 1 + 1.9 + 0.05), r6(Y_AZ_S + 1 + 1.9 + 0.05)], radius: 1.9, steps: CHAMBER_ROOF / STEP_RISE,
      box: bx(azGateX0(0) + GATE_W + 23, Y_AZ_S, Z_AZ, azGateX0(0) + GATE_W + 28, Y_AZ_S + 5, Z_AZ + CHAMBER_ROOF) } }],
];
const SCH_DOOR_W = 10;                     // ⚙ as built: 10 wide where the chamber allows (6 in the Medichin, beside its stair)
for (const [key, x0, x1, en, he, use, extra] of southTrio) {
  const w = Math.min(SCH_DOOR_W, x1 - x0 - 6), dx = key === 'medichin' ? x1 - 2 - w / 2 : (x0 + x1) / 2;
  add(`azarah.chamber.${key}`, { en, he, kind: 'chamber', b: [x0, Y_AZ_S, Z_AZ, x1, Y_AZ_S + SCH_DEPTH, Z_AZ + CHAMBER_ROOF],
    src: ['Middot 5:3', 'Yoma 19a', 'Rambam BhB 5:17', 'Part XI lock #7'], c: 'reconstruction',
    der: `south trio (lock #7) against the S wall between its gates; ${x1 - x0} x ${SCH_DEPTH} ⚙`,
    p: { use, ...extra, door: { face: 'north', x: [r6(dx - w / 2), r6(dx + w / 2)], z: [Z_AZ, Z_AZ + CHAMBER_DOOR_H], note: 'onto the court; width and height ⚙ (CHAMBER_DOOR_H)' } },
    n: 'Printed Middot 5:3 puts this trio north — the flagged variant (Register #7).' });
}
// Beit HaMoked (Middot 1:5–9; Tamid 1:1; Rambam BhB 5:9–10; locks #8, #43; lock §58 24 x 24)
const MK = MOKED_BOX, mkIn = { x0: MK.x0 + MOKED_WALL_T, x1: MK.x1 - MOKED_WALL_T, y0: MK.y0 + MOKED_WALL_T, y1: MK.y1 - MOKED_WALL_T };
add('azarah.moked.hall', { en: 'Beit HaMoked (the Hearth House)', he: 'בית המוקד', kind: 'chamber',
  b: [MK.x0, MK.y0, Z_AZ, MK.x1, MK.y1, Z_AZ + MOKED_DOME_SPRING + (mkIn.x1 - mkIn.x0) / 2],
  src: ['Middot 1:5–9', 'Tamid 1:1', 'Tamid 3:3', 'Rambam BhB 5:9–10', 'Part XI locks #8, #43', L58], c: 'reconstruction',
  der: `24 x 24 (lock §58) straddling the N wall at the Moked gate (center X ${MOKED_CX}); 8 into the Azarah / 16 out ⚙ so it enters only the 8-amah strip (Middot 5:2); kodesh/chol line at Y ${MOKED_KODESH_Y} → 12 | 12 (lock #43)`,
  fc: { size: 'locked', station: 'locked', straddle: 'explicit', halfKodesh: 'locked', offsetAcrossWall: 'reconstruction', walls: 'reconstruction', dome: 'explicit' },
  p: { floorZ: Z_AZ, interior: bx(mkIn.x0, mkIn.y0, Z_AZ, mkIn.x1, mkIn.y1, Z_AZ + MOKED_DOME_SPRING), wallT: MOKED_WALL_T,
    dome: { springZ: Z_AZ + MOKED_DOME_SPRING, radius: (mkIn.x1 - mkIn.x0) / 2, center: [MOKED_CX, (mkIn.y0 + mkIn.y1) / 2] },
    rovadin: 'stepped stone ledges ringing the hall (Middot 1:8) — elders sleep on them with the keys ⚙ 3 tiers of ½',
    kodeshLine: { y: MOKED_KODESH_Y, marker: 'rashei pispasin (Middot 1:6)', kodeshSide: 'south', basis: 'lock #43 half / half. The line falls 1 amah inside the replaced wall line (Y 398–403); the wall-thickness rule (Rambam BhB 6:9) is not applied, since the hall replaces the wall here' },
    hearth: 'perpetual fire (the moked) ⚙ centre of the hall', podium: 'azarah.moked.podium' },
  n: 'Rambam BhB 5:9: "a large house beside the Azarah on its north, between the Azarah and the Chel". The hall replaces the N wall where it stands.' });
add('azarah.moked.podium', { en: 'Beit HaMoked — substructure of the chol part', he: 'יסוד בית המוקד', kind: 'slab',
  b: [MK.x0, Y_CX_N, Z_MOUNT, MK.x1, MK.y1, Z_AZ], src: ['Rambam BhB 5:9', 'EK I 174, 184 (Part X §47)'], c: 'reconstruction',
  der: `solid masonry from the Mount (Z0) up to the hall floor (+${Z_AZ}) under the part north of the N wall ⚙`,
  p: { topZ: Z_AZ, carries: 'azarah.moked.hall', voids: ['azarah.underground.stair'], voidsNote: 'the winding stair from the NW chamber descends through it (Middot 1:6, 1:9); the keys slab is set into its top' } });
add('azarah.gate.moked', { en: "Sha'ar Beit HaMoked (door to the Azarah)", he: 'שער בית המוקד', kind: 'gate',
  b: [MOKED_CX - GATE_W / 2, MK.y0, Z_AZ, MOKED_CX + GATE_W / 2, MK.y0 + MOKED_WALL_T, Z_AZ + GATE_H],
  src: ['Middot 1:5', 'Middot 1:7', 'Tamid 1:3', 'Rambam BhB 8:11', 'Part XI lock #9', L58], c: 'reconstruction',
  der: 'the Moked gate is the door of the hall into the Azarah (E-most of the N trio, center X 210.75); its Y follows the hall ⚙',
  fc: { station: 'locked', size: 'explicit', y: 'reconstruction' },
  p: { width: GATE_W, height: GATE_H, doors: 2, doorFinish: 'gold-plated', faces: 180,
    pishpash: { box: bx(MOKED_CX + 1.5, MK.y0, Z_AZ, MOKED_CX + 3.5, MK.y0 + MOKED_WALL_T, Z_AZ + 4), in: 'east leaf of the gate',
      note: 'R. Yehudah: "it had a small pishpash" for the night patrol (Middot 1:7; Tamid 1:3; Rambam BhB 8:11 "the small gate between the Beit HaMoked and the Azarah"); set in the east leaf so it opens onto the hall, not into a corner chamber ⚙ size' } } });
add('azarah.moked.door-chel', { en: 'Beit HaMoked — door to the Chel', he: 'פתח בית המוקד לחיל', kind: 'opening',
  b: [MOKED_CX - GATE_W / 2, MK.y1 - MOKED_WALL_T, Z_AZ, MOKED_CX + GATE_W / 2, MK.y1, Z_AZ + GATE_H], src: ['Middot 1:7', 'Rambam BhB 5:9'], c: 'reconstruction',
  der: 'second door, to the chel (north face, opposite the gate) ⚙ position', fc: { exists: 'explicit', size: 'explicit', position: 'reconstruction' }, p: { flight: 'azarah.moked.flight' } });
add('azarah.moked.flight', { en: 'Beit HaMoked — steps down to the Chel', he: 'מעלות בית המוקד', kind: 'stair',
  b: [MOKED_CX - GATE_W / 2, MK.y1, Z_MOUNT, MOKED_CX + GATE_W / 2, MK.y1 + FLIGHT_RISERS * STEP_TREAD, Z_AZ], src: ['Middot 2:3', 'EK I 202–215'], c: 'reconstruction',
  der: `${FLIGHT_RISERS} half-steps from +16 to the Mount`, p: { steps: FLIGHT_RISERS, rise: STEP_RISE, tread: STEP_TREAD, ascentHeading: 180 } });
flights.push({ id: 'azarah.moked.flight', side: 'N', along: 'X', from: MOKED_CX - GATE_W / 2, to: MOKED_CX + GATE_W / 2 });
// the four corner chambers (Middot 1:6 set — lock #8): SW lambs, SE showbread bakers, NE Hasmonean altar stones, NW descent to the tevilah
const mkCh = (cx, cy) => {
  const x0 = cx === 'W' ? mkIn.x0 : mkIn.x1 - MOKED_CHAMBER_W, y0 = cy === 'S' ? mkIn.y0 : mkIn.y1 - MOKED_CHAMBER_D;
  return [x0, y0, Z_AZ, x0 + MOKED_CHAMBER_W, y0 + MOKED_CHAMBER_D, Z_AZ + 10];
};
const mokedChambers = [
  ['lambs', 'W', 'S', 'Chamber of the Tamid lambs', 'לשכת טלאי קרבן', 'kodesh', 'minimum six inspected lambs (Arachin 2:5; Tamid 3:3)', { splayedCorner: true, note: 'cut off at the corner — reads SW from one approach, NW from the other (Yoma 17a; lock #8)' }],
  ['showbread', 'E', 'S', 'Chamber of the Showbread bakers (Beit Garmu)', 'לשכת עושי לחם הפנים', 'kodesh', 'lechem hapanim baked (Yoma 38a)', {}],
  ['altar-stones', 'E', 'N', 'Chamber of the defiled altar stones', 'לשכה שגנזו בה בני חשמונאי את אבני המזבח', 'chol', 'the Hasmoneans stored the altar stones defiled by the Greek kings (Middot 1:6); seals (Tamid 3:3)', {}],
  ['tevilah-descent', 'W', 'N', 'Chamber of the descent to the Beit HaTevilah', 'לשכה שבה יורדין לבית הטבילה', 'chol', 'stair down to the underground passage (Middot 1:6, 1:9)', { stair: 'azarah.underground.stair' }],
];
for (const [key, cx, cy, en, he, sanct, use, extra] of mokedChambers) {
  add(`azarah.moked.chamber.${key}`, { en, he, kind: 'chamber', b: mkCh(cx, cy), src: ['Middot 1:6', 'Tamid 3:3', 'Yoma 15b–17a', 'Part XI locks #8, #43'], c: 'reconstruction',
    der: `${cy}${cx} corner of the hall, ${MOKED_CHAMBER_W} (E–W) x ${MOKED_CHAMBER_D} ⚙, flanking the ${cy === 'S' ? 'Azarah gate' : 'chel door'} so its 10 amot stay clear; ${sanct} half`,
    fc: { corner: 'locked', sanctity: 'explicit', size: 'reconstruction' },
    p: { sanctity: sanct, opensOnto: 'azarah.moked.hall ("like bedrooms opening onto a banquet hall")', use, ...extra } });
}
add('azarah.moked.keys-slab', { en: 'The keys slab (marble, ring and chain)', he: 'טבלא של שיש — מקום המפתחות', kind: 'slab',
  b: [MOKED_CX - 0.5, MOKED_KODESH_Y + 1, Z_AZ - 0.5, MOKED_CX + 0.5, MOKED_KODESH_Y + 2, Z_AZ], src: ['Middot 1:9', 'Yoma 25a', 'Part IX §37.1'], c: 'reconstruction',
  der: '1 x 1 amah in the hall floor (Middot 1:9); in the chol half, since the officer slept on it and there is no sitting, let alone sleeping, in the kodesh (Yoma 25a); position ⚙ near the hall centre',
  fc: { size: 'explicit', cholHalf: 'derived', position: 'reconstruction' },
  p: { size: [1, 1], ring: true, chain: true, note: 'identical fitting to altar.shit-slab and heichal.sotah-slab (Part IX §37.1)' } });
// underground mesibah under the Birah to the Beit HaTevilah (Middot 1:9; Tamid 1:1; lock #21 stam)
{
  const [sx0, sy0, , sx1, sy1] = mkCh('W', 'N');
  const Z_TUN = -12, TUN_H = 8, TUN_W = 4;
  const tx = (sx0 + sx1) / 2;
  const tevY0 = 450, tevY1 = 468;
  add('azarah.underground.stair', { en: 'Winding stair down from the Moked', he: 'מסיבה — ירידה', kind: 'stair',
    b: [sx0 + 0.5, sy0 + 0.5, Z_TUN, sx1 - 0.5, sy1 - 0.5, Z_AZ], src: ['Middot 1:6', 'Middot 1:9', 'Tamid 1:1'], c: 'reconstruction',
    der: `spiral of ${(Z_AZ - Z_TUN) / STEP_RISE} half-steps from +16 to ${Z_TUN}`, p: { form: 'spiral', steps: (Z_AZ - Z_TUN) / STEP_RISE, rise: STEP_RISE, center: [tx, (sy0 + sy1) / 2] } });
  add('azarah.underground.passage', { en: 'The passage under the Birah', he: 'מסיבה ההולכת תחת הבירה', kind: 'zone',
    b: [tx - TUN_W / 2, sy1 - 1, Z_TUN, tx + TUN_W / 2, tevY0, Z_TUN + TUN_H], src: ['Middot 1:9', 'Tamid 1:1', 'Rambam BhB 5:11', 'Rambam BhB 6:9', 'Part XI lock #21'], c: 'reconstruction',
    der: 'vaulted passage north under the Mount; route and depth ⚙ (the Birah\'s location is §20 #8)',
    p: { lamps: 'burning on both sides (Middot 1:9)', sanctity: 'chol (opens to Har HaBayit — Rambam BhB 6:9)', floorZ: Z_TUN, variant: 'REbY: under the chel, exit by Tadi' } });
  add('azarah.underground.beit-hatevilah', { en: 'Beit HaTevilah (immersion house)', he: 'בית הטבילה', kind: 'chamber',
    b: [tx - 9, tevY0, Z_TUN - MIKVEH_DEPTH, tx + 9, tevY1, Z_TUN + TUN_H], src: ['Tamid 1:1', 'Middot 1:9', 'Rambam BhB 5:11', 'Yoma 31a'], c: 'reconstruction',
    der: 'underground under the north of the Mount ⚙; mikveh ≥ 1 x 1 x 3 (Yoma 31a)',
    p: { floorZ: Z_TUN, mikveh: bx(tx - 7, tevY0 + 2, Z_TUN - MIKVEH_DEPTH, tx - 3, tevY0 + 6, Z_TUN), medurah: [tx + 4, tevY0 + 9, Z_TUN],
      beitKisseShelKavod: bx(tx + 5, tevY1 - 5, Z_TUN, tx + 8, tevY1 - 1, Z_TUN + 6) } });
}
// exterior flights for the Gazit (chol door, west) and Etz (north, through the wall)
add('azarah.chamber.gazit.flight', { en: 'Lishkat HaGazit — steps to the Chel', he: 'מעלות לשכת הגזית', kind: 'stair',
  b: [GAZIT.x0 - FLIGHT_RISERS * STEP_TREAD, GAZIT_MID_Y - 5, Z_MOUNT, GAZIT.x0, GAZIT_MID_Y + 5, Z_AZ], src: ['Yoma 25a', 'EK I 202–215'], c: 'reconstruction',
  der: '32 half-steps west from the chol door', p: { steps: FLIGHT_RISERS, rise: STEP_RISE, tread: STEP_TREAD, ascentHeading: 90 } });
flights.push({ id: 'azarah.chamber.gazit.flight', side: 'W', along: 'Y', from: GAZIT_MID_Y - 5, to: GAZIT_MID_Y + 5 });
add('azarah.chamber.etz.flight', { en: 'Lishkat Parhedrin — steps to the Chel', he: 'מעלות לשכת פרהדרין', kind: 'stair',
  b: [ETZ.x0 + 10, ETZ.y1, Z_MOUNT, ETZ.x0 + 20, ETZ.y1 + FLIGHT_RISERS * STEP_TREAD, Z_AZ], src: ['Yoma 10a', 'Rambam BhB 6:7', 'EK I 202–215'], c: 'reconstruction',
  der: '32 half-steps north from its door in the N wall', p: { steps: FLIGHT_RISERS, rise: STEP_RISE, tread: STEP_TREAD, ascentHeading: 180 } });
flights.push({ id: 'azarah.chamber.etz.flight', side: 'N', along: 'X', from: ETZ.x0 + 10, to: ETZ.x0 + 20 });

// ----- soreg, its passages and the 13 breach stations (now that the flights are known) -----
for (const f of flights) soregPassages.push({ at: f.id, side: f.side, along: f.along, from: f.from, to: f.to });
// underpasses (build-courts, annotation): every flight crosses the whole 10-amah chel, 6–16 amot above it, and its soreg
// passage is the flight itself — without a way under it, the chel between two flights is a closed pocket. Each flight
// is carried on a barrel vault over the chel walkway (axis along the chel; ⚙ span, springing). Vaulting is the precinct's
// attested construction: the hollows under the Mount and the courts (Parah 3:3) and the causeway's arches (Parah 3:6).
{
  const UP = { s0: 0.75, s1: 8.25, springZ: 4 };   // ⚙ distances from the flight's head (the wall face); springing above a walker's head (≈ 1.9 m), amot
  for (const f of flights) {
    const e = elements[f.id], b = e.box, h = e.params.ascentHeading;
    const crownZ = r6(UP.springZ + (UP.s1 - UP.s0) / 2);
    const box = h === 0 ? bx(b.min[0], b.max[1] - UP.s1, Z_MOUNT, b.max[0], b.max[1] - UP.s0, crownZ)      // south flights
      : h === 180 ? bx(b.min[0], b.min[1] + UP.s0, Z_MOUNT, b.max[0], b.min[1] + UP.s1, crownZ)            // north flights
        : bx(b.max[0] - UP.s1, b.min[1], Z_MOUNT, b.max[0] - UP.s0, b.max[1], crownZ);                     // the Gazit's (west)
    e.params.underpass = { box, walkway: f.along, fromHead: [UP.s0, UP.s1], springZ: UP.springZ, crownZ, span: UP.s1 - UP.s0,
      form: 'semicircular barrel vault under the flight, its axis along the chel', confidence: 'reconstruction',
      sources: ['Parah 3:3 (kippin under the Mount and the courts)', 'Parah 3:6 (the causeway\'s arches)', 'Middot 2:3 (the chel, 10 amot)'],
      note: 'keeps the chel continuous at ground level under the flight (the soreg passage is the flight itself) ⚙ form, span and springing; zone boxes still give the space under the flight to the gate\'s zone' };
  }
}
// stations: counts per side borrowed from the gates view of the prostrations (Shekalim 6:3: 4N 4S 3E 2W "opposite the 13 gates") —
// Middot 2:3's breaches view gives no distribution; positions evenly spread, then moved ≥ 2 amot clear of any passage ⚙
// (on this soreg line the gates' flights occupy exactly the spots "opposite the gates")
function pathSegments() { const s = []; for (let i = 0; i < SOREG_PATH.length; i++) s.push([SOREG_PATH[i], SOREG_PATH[(i + 1) % SOREG_PATH.length]]); return s; }
const BREACH_CLEAR = 2;
function clearOfPassages(side, v) {
  for (const ps of soregPassages.filter((q) => q.side === side)) {
    const lo = Math.min(ps.from, ps.to) - BREACH_CLEAR, hi = Math.max(ps.from, ps.to) + BREACH_CLEAR;
    if (v > lo && v < hi) return v - lo <= hi - v ? lo : hi;
  }
  return v;
}
const breachStations = (() => {
  const st = [];
  const y = (p) => p[1], x = (p) => p[0];
  // S side: Y = 248, X 53..410 (4); N side: north-most runs (4); E: X 410 (3); W: west runs (2)
  const sX = [0.125, 0.375, 0.625, 0.875].map((f) => X_CX_W - CHEL + f * (X_CX_E - X_CX_W + 2 * CHEL));
  for (const X of sX) st.push({ side: 'S', pos: [r6(clearOfPassages('S', X)), Y_CX_S - CHEL] });
  const nTargets = [0.125, 0.375, 0.625, 0.875].map((f) => GAZIT.x0 - CHEL + f * (X_CX_E + CHEL - (GAZIT.x0 - CHEL)));
  for (const X0 of nTargets) { // snap to the northern run of the path at this X
    const X = clearOfPassages('N', X0);
    let best = null; for (const [a, b] of pathSegments()) if (y(a) === y(b) && y(a) > AXIS_Y && X >= Math.min(x(a), x(b)) && X <= Math.max(x(a), x(b))) best = Math.max(best ?? -1, y(a));
    st.push({ side: 'N', pos: [r6(X), best] });
  }
  for (const Y of [Y_CX_S - CHEL + (AXIS_Y - CHEL_STEPS_W / 2 - (Y_CX_S - CHEL)) / 3, Y_CX_S - CHEL + 2 * (AXIS_Y - CHEL_STEPS_W / 2 - (Y_CX_S - CHEL)) / 3, (AXIS_Y + CHEL_STEPS_W / 2 + Y_CX_N + CHEL) / 2])
    st.push({ side: 'E', pos: [X_CX_E + CHEL, r6(clearOfPassages('E', Y))] });
  st.push({ side: 'W', pos: [X_CX_W - CHEL, r6(clearOfPassages('W', (Y_CX_S - CHEL + GAZIT.y0 - CHEL) / 2))] });
  st.push({ side: 'W', pos: [GAZIT.x0 - CHEL, r6(clearOfPassages('W', (GAZIT.y0 - CHEL + GAZIT.y1 + CHEL) / 2))] });
  return st.map((s, i) => ({ n: i + 1, ...s }));
})();
add('mount.soreg', { en: 'The Soreg (lattice fence)', he: 'סורג', kind: 'wall',
  b: [Math.min(...SOREG_PATH.map((p) => p[0])) - SOREG_T / 2, Math.min(...SOREG_PATH.map((p) => p[1])) - SOREG_T / 2, Z_MOUNT,
    Math.max(...SOREG_PATH.map((p) => p[0])) + SOREG_T / 2, Math.max(...SOREG_PATH.map((p) => p[1])) + SOREG_T / 2, SOREG_BASE + SOREG_H],
  src: ['Middot 2:3', 'Rambam BhB 5:3', 'Kelim 1:8', 'Part XI lock #26/#44', 'EK I 202–215 (Part X §49)'], c: 'locked',
  der: `closed path ${CHEL} amot outside the court complex (incl. its projecting chambers); lattice ${r6(SOREG_H)} (10 tefachim) on a ${SOREG_BASE}-amah base`,
  p: { path: SOREG_PATH, closed: true, baseHeight: SOREG_BASE, latticeHeight: r6(SOREG_H), baseThickness: SOREG_T, latticeThickness: 0.25,
    lattice: 'wooden slats crossed diagonally "like a bed-frame laced with cords" (Bartenura, Middot 2:3)', passages: soregPassages },
  n: 'Gaps (passages) only where the chel steps and the court flights cross its line; EK notes the N/S flights must cross it.' });
add('mount.soreg.breaches', { en: 'The thirteen repaired breaches (prostration stations)', he: 'שלש עשרה פרצות', kind: 'fixture',
  b: [Math.min(...breachStations.map((s) => s.pos[0])) - 1, Math.min(...breachStations.map((s) => s.pos[1])) - 1, Z_MOUNT,
    Math.max(...breachStations.map((s) => s.pos[0])) + 1, Math.max(...breachStations.map((s) => s.pos[1])) + 1, SOREG_BASE + SOREG_H],
  src: ['Middot 2:3', 'Shekalim 6:1', 'Shekalim 6:3 (side counts, gates view)', 'Middot 2:6 (Abba Yosi b. Chanan)', 'EK I 207 (Part X §49)'], c: 'reconstruction',
  der: `13 breaches (Middot 2:3); their side counts 4N 4S 3E 2W are borrowed from the prostrations "opposite the 13 gates" (Shekalim 6:3) ⚙; positions spread evenly and kept ${BREACH_CLEAR} clear of the passages ⚙`,
  fc: { count: 'explicit', sideCounts: 'reconstruction', positions: 'reconstruction' },
  p: { count: SOREG_BREACHES, stations: breachStations, breachWidth: 2, note: 'repaired segments of the lattice; one prostration opposite each (Middot 2:3)',
    sideCountsNote: 'Two views of the 13 prostrations: Middot 2:3 sets them opposite the 13 breaches the Greek kings made in the soreg, with no distribution; Shekalim 6:3 (stam) and Abba Yosi b. Chanan (Middot 2:6) set them "opposite the thirteen gates" — and it is that view whose counts are "four in the north, four in the south, three in the east and two in the west". The model shows the breaches view and borrows the gates view\'s side counts only to spread the 13 stations ⚙.',
    gatesNote: 'EK I 207 draws the breaches opposite the gates. Here the flights of the gates cross the soreg through passages at exactly those spots, so the stations are spread evenly along each side instead ⚙.' } });
if (breachStations.length !== SOREG_BREACHES) throw new Error('site.js: breach station count');

// ----- chambers on Har HaBayit (reconstruction; Middot 1:1 watch posts, Parah 3:1) -----
// Lishkat HaKorban and Lishkat HaParochet are Levite watch posts (Middot 1:1; Rambam BhB 8:9). Levites guard outside the Azarah
// (Rambam BhB 8:4, 8:8), and the Parochet was woven by women (Ketubot 106a), so both stand on the Mount just outside the soreg,
// flanking the foot of Sha'ar HaKorban's flight ⚙. Footprints unsourced.
const MT_CH = { d: 12, w: 14, h: 12, y0: Y_CX_N + FLIGHT_RISERS * STEP_TREAD + 1 };   // ⚙ 14 x 12, 12 high; Y from 420
for (const [key, x0, en, he, use, src] of [
  ['parochet', AZ_GATE_CX[1] - GATE_W / 2 - 1 - MT_CH.w, 'Lishkat HaParochet (Chamber of the Curtain)', 'לשכת הפרכת',
    'the curtain office: weaving and keeping the 13 parochot (Shekalim 5:1 — Elazar over the parochot; Ketubot 106a — women weavers paid from hekdesh)', ['Middot 1:1', 'Rambam BhB 8:9', 'Shekalim 5:1', 'Shekalim 8:4–5', 'Ketubot 106a']],
  ['korban', AZ_GATE_CX[1] + GATE_W / 2 + 1, 'Lishkat HaKorban (Chamber of the Offerings)', 'לשכת הקרבן',
    'korban stores (Part III §9.3); beside the gate by which the kodshei kodashim animals entered (Middot 1:5)', ['Middot 1:1', 'Middot 1:5', 'Rambam BhB 8:9']],
]) {
  add(`mount.chamber.${key}`, { en, he, kind: 'chamber', b: [x0, MT_CH.y0, Z_MOUNT, x0 + MT_CH.w, MT_CH.y0 + MT_CH.d, Z_MOUNT + MT_CH.h],
    src: [...src, 'Part III §9.3', 'Part XII §60'], c: 'reconstruction',
    der: `on the Mount just outside the soreg, flanking the foot of the Korban gate flight; ${MT_CH.w} x ${MT_CH.d} x ${MT_CH.h} ⚙`,
    fc: { existence: 'explicit', watchPost: 'explicit', footprint: 'reconstruction', position: 'reconstruction' },
    p: { footprint_unsourced: true, floorZ: Z_MOUNT, use, sanctity: 'Har HaBayit',
      door: { face: 'south', x: [x0 + MT_CH.w / 2 - 2, x0 + MT_CH.w / 2 + 2], z: [Z_MOUNT, Z_MOUNT + 8] },
      guardPost: [x0 + MT_CH.w / 2, MT_CH.y0 - 0.5, Z_MOUNT] } });
}
const BEIT_HAEVEN = { x0: 365, x1: 385, y0: 432, y1: 447 };   // ⚙
add('mount.chamber.beit-haeven', { en: 'Lishkat Beit HaEven (the Stone House)', he: 'לשכת בית האבן', kind: 'chamber',
  b: [BEIT_HAEVEN.x0, BEIT_HAEVEN.y0, Z_MOUNT, BEIT_HAEVEN.x1, BEIT_HAEVEN.y1, Z_MOUNT + MT_CH.h],
  src: ['Parah 3:1', 'Yoma 2a', 'Part III §9.3'], c: 'reconstruction',
  der: '"the chamber facing the Birah, to the north-east" (Parah 3:1): on the Mount NE of the court complex, its door facing north toward the Birah (whose site is open — §20 #8; the underground passage runs north) ⚙',
  fc: { existence: 'explicit', northEast: 'explicit', footprint: 'reconstruction', position: 'reconstruction' },
  p: { footprint_unsourced: true, floorZ: Z_MOUNT, door: { face: 'north', x: [BEIT_HAEVEN.x0 + 8, BEIT_HAEVEN.x0 + 12], z: [Z_MOUNT, Z_MOUNT + 8] },
    use: 'seven-day separation of the kohen who burns the Parah; all its vessels of stone, dung or earth (Parah 3:1; Yoma 2a)', sanctity: 'Har HaBayit' } });

// ===== 3.6 The Mizbeach and its zone ========================================
const A = (dx0, dy0, z0, dx1, dy1, z1) => [ALT_X0 + dx0, ALT_Y0 + dy0, z0, ALT_X0 + dx1, ALT_Y0 + dy1, z1];
add('altar.yesod', { en: 'Mizbeach — yesod (base)', he: 'יסוד המזבח', kind: 'fixture', b: A(0, 0, Z_AZ, ALTAR, ALTAR, Z_YESOD),
  src: ['Middot 3:1', 'Zevachim 53b–54a', 'Rambam BhB 2:7, 2:10', 'Part XI locks #2–#4'], c: 'explicit',
  der: 'rise 1, inset 1; along the whole N and W faces, "eating" 1 amah into S and E; none at the SE (Rav: in structure)',
  p: { pieces: [
    bx(...A(0, ALTAR - YESOD_INSET, Z_AZ, ALTAR, ALTAR, Z_YESOD)),                       // north, full
    bx(...A(0, 0, Z_AZ, YESOD_INSET, ALTAR - YESOD_INSET, Z_YESOD)),                       // west, full
    bx(...A(YESOD_INSET, 0, Z_AZ, 2 * YESOD_INSET, YESOD_INSET, Z_YESOD)),                 // south stub (1 amah past the SW corner)
    bx(...A(ALTAR - YESOD_INSET, ALTAR - 2 * YESOD_INSET, Z_AZ, ALTAR, ALTAR - YESOD_INSET, Z_YESOD))], // east stub
    southernYesod: 'SW end (remainders of outer-altar bloods — Zevachim 53a)', westernYesod: 'W face (inner-altar bloods)' },
  n: 'Read "eats one amah in the south and one in the east" as one amah beyond the corner squares; the corner-squares-only reading is the alternative.' });
add('altar.body', { en: 'Mizbeach — body to the sovev (30 x 30)', he: 'גוף המזבח', kind: 'fixture', b: A(T30, T30, Z_AZ, ALTAR - T30, ALTAR - T30, Z_SOVEV),
  src: ['Middot 3:1', 'Zevachim 54a'], c: 'explicit', der: 'rise 5 above the yesod, inset 1 → 30 x 30 to +6 (stands on the floor where the yesod is absent)',
  p: { finish: 'lime whitewash twice a year (Middot 3:4)', construction: 'cast solid: whole stones in lime-lead-pitch slurry (Zevachim 54a; Rambam BhB 2:16)' } });
add('altar.sovev', { en: 'Mizbeach — sovev (circuit ledge)', he: 'סובב', kind: 'slab', b: A(T30, T30, Z_SOVEV - 0.01, ALTAR - T30, ALTAR - T30, Z_SOVEV),
  src: ['Middot 3:1', 'Zevachim 62a (karkov)'], c: 'explicit', der: 'the 1-amah ledge between the 30- and 28-squares at +6 over the court',
  p: { ringOuter: 30, ringInner: 28, z: Z_SOVEV, karkov: 'lock #19: ornamental band + walkway ledge' } });
add('altar.top', { en: 'Mizbeach — upper body (28 x 28)', he: 'ראש המזבח', kind: 'fixture', b: A(T28, T28, Z_SOVEV, ALTAR - T28, ALTAR - T28, Z_ALT_TOP),
  src: ['Middot 3:1', 'Zevachim 59b–60a (R\' Yosi)', 'Rambam BhB 2:5', 'Part XI locks #2, #3'], c: 'locked',
  der: '3 above the sovev → top at 9 over the court (+25)', p: { topZ: Z_ALT_TOP, rambamAlt: 'Rambam BhB 2:9: top at 9 amot less a tefach (mixed amot) — annotation' } });
const kerenBox = (cx, cy) => A(cx === 'W' ? T28 : ALTAR - T28 - KEREN, cy === 'S' ? T28 : ALTAR - T28 - KEREN, Z_ALT_TOP, cx === 'W' ? T28 + KEREN : ALTAR - T28, cy === 'S' ? T28 + KEREN : ALTAR - T28, Z_KEREN);
for (const [cx, cy] of [['W', 'S'], ['E', 'S'], ['W', 'N'], ['E', 'N']]) {
  const k = `${cy}${cx}`.toLowerCase();
  add(`altar.keren.${k}`, { en: `Mizbeach — ${cy}${cx} keren (horn)`, he: 'קרן המזבח', kind: 'fixture', b: kerenBox(cx, cy),
    src: ['Middot 3:1', 'Zevachim 54a–b'], c: 'explicit', der: '1 x 1 x 1 hollow cube at the corner of the 28-square',
    p: { hollow: true, role: { sw: 'chatat ha\'of; libations (Zevachim 63a–64b)', se: 'olat ha\'of (Zevachim 64b); circuit starts here', ne: '', nw: '' }[k] } });
}
add('altar.walkway', { en: 'Mizbeach — kohanim\'s walkway', he: 'מקום הילוך רגלי הכהנים', kind: 'zone', b: A(T26, T26, Z_ALT_TOP, ALTAR - T26, ALTAR - T26, Z_ALT_TOP + 0.01),
  src: ['Middot 3:1'], c: 'explicit', der: '1-amah ring inside the horns (26 → 24)', p: { ringOuter: 26, ringInner: 24 } });
add('altar.maarachah-area', { en: 'Mizbeach — place of the ma\'arachah (24 x 24)', he: 'מקום המערכה', kind: 'zone', b: A(T24, T24, Z_ALT_TOP, ALTAR - T24, ALTAR - T24, Z_ALT_TOP + 0.01),
  src: ['Middot 3:1', 'Tamid 2:2–5', 'Part XI lock #17'], c: 'explicit', der: '24 x 24 at +25',
  fc: { area: 'explicit', threePiles: 'locked', greatAndIncensePiles: 'explicit', thirdPilePosition: 'reconstruction', tapuachSize: 'reconstruction' },
  p: { tapuach: { center: [ALT_CX, ALT_CY, Z_ALT_TOP], radius: 4, height: 3, note: 'ash mound "at times ~300 kor"; festivals unslimmed (Tamid 2:2) ⚙ size' },
    piles: [
      { id: 'great', box: bx(ALT_CX + 4, ALT_CY - 4, Z_ALT_TOP, ALT_CX + 10, ALT_CY + 4, Z_ALT_TOP + 2), note: 'great pile east, its face east, log-ends touching the tapuach (Tamid 2:4)' },
      { id: 'incense', box: bx(ALT_X0 + T24, ALT_Y0 + T28 + INCENSE_PILE_OFF - 1, Z_ALT_TOP, ALT_X0 + T24 + 2, ALT_Y0 + T28 + INCENSE_PILE_OFF + 1, Z_ALT_TOP + 1), note: 'opposite the SW horn, drawn 4 amot north (Tamid 2:5)' },
      { id: 'kiyum-haesh', box: bx(ALT_X0 + 9, ALT_Y0 + 8, Z_ALT_TOP, ALT_X0 + 12, ALT_Y0 + 11, Z_ALT_TOP + 1), note: 'third pile (R\' Yosi, Yoma 45a; lock #17) — position unsourced ⚙' }] } });
add('altar.chut-hasikra', { en: 'Chut HaSikra (red line)', he: 'חוט הסיקרא', kind: 'fixture', b: A(T30, T30, Z_SIKRA - 0.05, ALTAR - T30, ALTAR - T30, Z_SIKRA + 0.05),
  src: ['Middot 3:1', 'Zevachim 53a', 'Rambam BhB 2:9'], c: 'derived', der: `half of the 10 → +${Z_SIKRA - Z_AZ} over the court (Rambam: 29 of 58 tefachim)`,
  p: { z: Z_SIKRA, color: 'red ochre', divides: 'upper bloods above / lower bloods below' } });
add('altar.shitin', { en: 'The two drain holes at the SW corner', he: 'שני נקבים — שיתין', kind: 'fixture', b: A(0, 0, Z_YESOD - 0.2, YESOD_INSET, YESOD_INSET, Z_YESOD),
  src: ['Middot 3:2', 'Rambam BhB 2:11', 'Zevachim 61b–62a'], c: 'explicit', der: 'on the SW yesod corner',
  p: { holes: 2, form: 'like two thin nostrils', drainsTo: 'the amah channel → Nachal Kidron' } });
add('altar.libation-cups', { en: 'Silver libation cups at the SW horn', he: 'ספלים של כסף', kind: 'fixture', b: A(T28 + KEREN, T28, Z_ALT_TOP, T28 + KEREN + 1, T28 + 1, Z_ALT_TOP + 0.5),
  src: ['Sukkah 4:9', 'Sukkah 48b', 'Part XI lock #29'], c: 'reconstruction', der: 'beside the SW horn on top ⚙', p: { count: 2, material: 'silver (R\' Yehudah: plaster)', spouts: 'wine wide, water narrow (Sukkah 48b)' } });
add('altar.shit-slab', { en: 'Marble slab over the shit (SW, in the pavement)', he: 'טבלא של שיש — לשית', kind: 'slab',
  b: [ALT_X0 - 1, ALT_Y0 - 1, Z_AZ - 0.25, ALT_X0, ALT_Y0, Z_AZ], src: ['Middot 3:3', 'Rambam BhB 2:12', 'Part IX §37.1'], c: 'derived',
  der: '1 x 1 in the pavement at the SW corner', p: { size: [1, 1], ring: true } });
add('altar.kevesh', { en: 'Kevesh (the altar ramp)', he: 'כבש המזבח', kind: 'ramp', b: [X_KEV_W, Y_KEV_FOOT, Z_AZ, X_KEV_E, Y_KEV_TOP, Z_ALT_TOP],
  src: ['Middot 3:3', 'Middot 5:2', 'Rambam BhB 2:13', 'Zevachim 62b–63a'], c: 'reconstruction',
  der: `32 x 16, south, centered on the altar ⚙; 30 on the ground + flies 1 over the yesod line and 1 over the sovev; rises ${Z_ALT_TOP - Z_AZ}`,
  fc: { length: 'explicit', width: 'explicit', southSide: 'explicit', groundRun: 'explicit', rise: 'locked', eastWestCentring: 'reconstruction' },
  p: { from: [ALT_CX, Y_KEV_FOOT, Z_AZ], to: [ALT_CX, Y_KEV_TOP, Z_ALT_TOP], width: KEVESH_W, run: KEVESH_LEN, rise: Z_ALT_TOP - Z_AZ, groundRun: KEVESH_GROUND,
    boxNote: 'box = overall extent; build from groundPiece + flying (the last 2 amot fly over the yesod line and the sovev, so the box overlaps altar.body)',
    groundPiece: bx(X_KEV_W, Y_KEV_FOOT, Z_AZ, X_KEV_E, Y_KEV_FOOT + KEVESH_GROUND, kevZ(Y_KEV_FOOT + KEVESH_GROUND)),
    flying: [
      { y: [ALT_Y0, ALT_Y0 + YESOD_INSET], undersideZ: Z_YESOD, topZ: [r6(kevZ(ALT_Y0)), r6(kevZ(ALT_Y0 + YESOD_INSET))], over: 'the yesod line (no yesod here on the S face)' },
      { y: [ALT_Y0 + YESOD_INSET, Y_KEV_TOP], undersideZ: Z_SOVEV, topZ: [r6(kevZ(ALT_Y0 + YESOD_INSET)), Z_ALT_TOP], over: 'the sovev (a hair\'s breadth above it)' }],
    ascentHeading: 0, airGap: "a hair's breadth before the altar (Zevachim 62b)", circulation: 'up on the east, down on the west (Zevachim 63a)',
    rambamAlt: 'rise 9 less a sixth (BhB 2:13)', slopeNote: 'Zevachim 63a: gentler than the 1:3 of other ramps' } });
// the two small ramps (Zevachim 62b; Rambam BhB 2:14) — branches at the 1:3 ramp slope (Zevachim 63a) ⚙
const branchJunction = (zEnd, yEnd) => { // kevesh z(y) = branch zb(y) = zEnd + (yEnd − y)/3
  const k = (Z_ALT_TOP - Z_AZ) / KEVESH_LEN;
  return (zEnd + yEnd / RAMP_SLOPE - Z_AZ + k * Y_KEV_FOOT) / (k + 1 / RAMP_SLOPE);
};
{
  const yS = branchJunction(Z_SOVEV, ALT_Y0 + T30), zS = kevZ(yS), zU = Z_SOVEV - SMALL_RAMP_SLAB;
  add('altar.kevesh.ramp-sovev', { en: 'Small ramp to the sovev (east)', he: 'כבש קטן לסובב', kind: 'ramp',
    b: [X_KEV_E, yS, Z_AZ, X_KEV_E + SMALL_RAMP_W, ALT_Y0 + T30, zS], src: ['Zevachim 62b', 'Rambam BhB 2:14'], c: 'reconstruction',
    der: `leaves the kevesh where both are at +${r6(zS)} and descends 1:3 north to the sovev (+${Z_SOVEV}); a slab carried on the kevesh's side, flat underside +${zU} (params.undersideZ; the box runs to the pavement) ⚙`,
    fc: { exists: 'explicit', leavesTheKevesh: 'explicit', hairsBreadth: 'explicit', slope: 'reconstruction', width: 'reconstruction', carried: 'reconstruction' },
    p: { from: [X_KEV_E + SMALL_RAMP_W / 2, r6(yS), r6(zS)], to: [X_KEV_E + SMALL_RAMP_W / 2, ALT_Y0 + T30, Z_SOVEV], width: SMALL_RAMP_W, gap: "a hair's breadth from the altar",
      solidToFloor: false, undersideZ: zU, bondedTo: 'altar.kevesh (its east face)',
      boxNote: `box = the overall extent down to the pavement, open space below the slab included (as altar.kevesh's boxNote). Build the slab from params.undersideZ (+${zU}) with an underside face; a builder that sweeps from box.min[2] gets the older solid branch, which stays closed`,
      carriedNote: `"two small ramps go out FROM the kevesh" (Zevachim 62b; Rambam BhB 2:14): a branch of the kevesh's mass, corbelled from its east face with a flat underside ${SMALL_RAMP_SLAB} below the sovev end (south end face ${r6(zS - zU)} high, not ${r6(zS - Z_AZ)} to the pavement); the space below, ${r6(zU - Z_AZ)} high, stays open ⚙` } });
  const yEndY = ALT_Y0 - 2, yY = branchJunction(Z_YESOD, yEndY), zY = kevZ(yY);
  add('altar.kevesh.ramp-yesod', { en: 'Small ramp to the yesod (west)', he: 'כבש קטן ליסוד', kind: 'ramp',
    b: [ALT_X0, yY, Z_AZ, X_KEV_W, ALT_Y0, zY], src: ['Zevachim 62b', 'Rambam BhB 2:14'], c: 'reconstruction',
    der: `leaves the kevesh at +${r6(zY)}, descends 1:3 north to +${Z_YESOD}, then runs level west along the S face to the SW corner, where it meets the S stub and the W yesod along the face (X ${ALT_X0}–${ALT_X0 + 2 * YESOD_INSET})`,
    p: { segments: [
      { box: bx(X_KEV_W - SMALL_RAMP_W, yY, Z_AZ, X_KEV_W, yEndY, zY), from: [X_KEV_W - 1, r6(yY), r6(zY)], to: [X_KEV_W - 1, yEndY, Z_YESOD] },
      { box: bx(ALT_X0, yEndY, Z_AZ, X_KEV_W, ALT_Y0, Z_YESOD), level: Z_YESOD, landsOn: 'altar.yesod (S stub X 202–203 and the W strip X 201–202), stepping north across the face line' }],
      width: SMALL_RAMP_W, gap: "a hair's breadth from the altar (Zevachim 62b)",
      solidToFloor: true, undersideZ: Math.max(Z_AZ, Z_YESOD - SMALL_RAMP_SLAB),
      carriedNote: `the same rule as the sovev branch (a slab of the kevesh's mass, underside ${SMALL_RAMP_SLAB} below its low end +${Z_YESOD}) puts its underside on the pavement, so it stands solid ⚙` } });
  add('altar.machtah-niche', { en: 'Rest of the silver machtah (ramp–altar angle)', he: 'מקום המחתה', kind: 'fixture',
    b: [ALT_X0 + 4, ALT_Y0, Z_AZ, ALT_X0 + 5, ALT_Y0 + T30, Z_AZ + 0.5], src: ['Tamid 1:4'], c: 'reconstruction',
    der: '"in the corner between the kevesh and the altar, west of the kevesh" — on the pavement north of the yesod branch', p: {} });
}
add('altar.kevesh.revuvah', { en: 'Revuvah (window in the kevesh, west face)', he: 'רבובה', kind: 'opening',
  b: [X_KEV_W - 0.1, Y_KEV_FOOT + 14.5, Z_AZ + 1, X_KEV_W, Y_KEV_FOOT + 15.5, Z_AZ + 2], src: ['Middot 3:3', 'Rambam BhB 2:14'], c: 'reconstruction',
  der: 'window 1 x 1 in the west face (position along the ramp ⚙)', p: { size: [1, 1], use: 'disqualified bird-chatat await decay of form' } });
add('altar.table.marble', { en: 'Marble table west of the kevesh ("table of the fats")', he: 'שלחן של שיש', kind: 'fixture',
  b: [X_KEV_W - 4, Y_KEV_FOOT + 9.5, Z_AZ, X_KEV_W - 3, Y_KEV_FOOT + 11.5, Z_AZ + 1.5], src: ['Shekalim 6:4', 'Rambam BhB 2:15', 'Tamid 7:3', 'Tamid 4:3'], c: 'reconstruction',
  der: 'west of the kevesh at its lower half ⚙', p: { use: 'limbs staged; trumpeters stand at it at the libation (Tamid 7:3)' } });
add('altar.table.silver', { en: 'Silver table west of the kevesh', he: 'שלחן של כסף', kind: 'fixture',
  b: [X_KEV_W - 4, Y_KEV_FOOT + 4.5, Z_AZ, X_KEV_W - 3, Y_KEV_FOOT + 6.5, Z_AZ + 1.5], src: ['Shekalim 6:4', 'Rambam BhB 2:15'], c: 'reconstruction',
  der: 'west of the kevesh ⚙', p: { use: 'service vessels' } });
add('altar.beit-hadeshen', { en: 'Beit HaDeshen (place of the ashes)', he: 'בית הדשן', kind: 'fixture',
  b: [X_KEV_E + BEIT_HADESHEN_OFF, Y_KEV_FOOT + BEIT_HADESHEN_WALK - 1, Z_AZ, X_KEV_E + BEIT_HADESHEN_OFF + 2, Y_KEV_FOOT + BEIT_HADESHEN_WALK + 1, Z_AZ + 0.5],
  src: ['Tamid 1:4', 'Zevachim 64a'], c: 'reconstruction', der: 'from the kevesh foot, facing north, ~10 amot along its east side; 3 tefachim off the ramp; 2 x 2 ⚙',
  fc: { walkAboutTen: 'explicit', offsetFromKevesh: 'explicit', size: 'reconstruction' },
  p: { receives: 'terumat hadeshen, bird crops, inner-altar & menorah ashes', swallowedInPlace: true } });
// slaughter zone (Middot 3:5, 5:2; Rambam BhB 5:13–16)
const ringXs = Array.from({ length: RING_COLS }, (_, i) => ALT_X0 + (i + 0.5) * ALTAR / RING_COLS);
const ringYs = Array.from({ length: RING_ROWS }, (_, j) => Y_ALT_N + RINGS_TO_ALTAR + (j + 0.5) * RINGS_BAND / RING_ROWS);
add('altar.rings', { en: 'The 24 rings (taba\'ot)', he: 'טבעות', kind: 'fixture',
  b: [ALT_X0, Y_ALT_N + RINGS_TO_ALTAR, Z_AZ, ALT_X0 + ALTAR, Y_RINGS_N, Z_AZ + 0.3], src: ['Middot 3:5', 'Middot 5:2', 'Tamid 4:1', 'Rambam BhB 5:14', 'Part XI lock #18'], c: 'reconstruction',
  der: '6 rows x 4 in the 24-amah band 8 north of the altar; E–W extent = the altar\'s 32 ⚙',
  fc: { band: 'explicit', distanceFromAltar: 'explicit', rowsByCols: 'locked', eastWestExtent: 'reconstruction' },
  p: { rows: RING_ROWS, cols: RING_COLS, positions: ringYs.flatMap((Y) => ringXs.map((X) => [r6(X), r6(Y), Z_AZ])),
    tamidMorning: { ring: [r6(ringXs[1]), r6(ringYs[0]), Z_AZ], note: 'NW corner, second ring (Tamid 4:1) ⚙ reading' },
    tamidAfternoon: { ring: [r6(ringXs[2]), r6(ringYs[0]), Z_AZ], note: 'NE corner, second ring' }, binding: 'head south, face west; shochet east facing west (Tamid 4:1)' } });
const tableXs = Array.from({ length: MARBLE_TABLES }, (_, i) => ALT_X0 + (i + 0.5) * ALTAR / MARBLE_TABLES);
add('altar.marble-tables', { en: 'The eight marble tables', he: 'שמונה שלחנות של שיש', kind: 'fixture',
  b: [ALT_X0, Y_RINGS_N, Z_AZ, ALT_X0 + ALTAR, Y_TABLES_N, Z_AZ + 1.5], src: ['Shekalim 6:4', 'Middot 3:5', 'Middot 5:2', 'Rambam BhB 5:14', 'Tamid 3:5'], c: 'reconstruction',
  der: 'the 8-amah tables band (Rambam BhB 5:14 = Middot 5:2 "rings → tables 4, tables → nanasin 4"); one row centred in the band ⚙; size 2½ x 1½ x 1½ ⚙',
  fc: { count: 'explicit', band: 'explicit', singleRow: 'reconstruction', size: 'reconstruction' },
  p: { count: MARBLE_TABLES, tables: tableXs.map((X) => bx(X - 1.25, Y_RINGS_N + TABLES_BAND / 2 - 0.75, Z_AZ, X + 1.25, Y_RINGS_N + TABLES_BAND / 2 + 0.75, Z_AZ + 1.5)),
    use: 'pieces laid on them and the meat and innards rinsed (Rambam BhB 5:14; Shekalim 6:4)',
    variants: { betweenPillars: 'Middot 3:5 / Tamid 3:5 "they flay on marble tables that are between the pillars" and Shekalim 6:4 "eight of marble in the Beit HaMitbachayim" read literally put the tables among the nanasin (report §11). Not built: Middot 5:2 itself puts the tables 4 south of the nanasin, which is Rambam\'s band. Flaying stations between the pillars are in altar.nanasin params.flayingStations.' } } });
const nanasXs = Array.from({ length: NANASIN }, (_, i) => ALT_X0 + (i + 0.5) * ALTAR / NANASIN);
const NANAS_Y = r6((Y_TABLES_N + Y_MITB_S) / 2);
add('altar.nanasin', { en: 'The eight dwarf pillars (nanasin) with hooks', he: 'עמודים ננסין', kind: 'fixture',
  b: [ALT_X0, Y_TABLES_N, Z_AZ, ALT_X0 + ALTAR, Y_MITB_S, Z_AZ + NANAS_H + NANAS_CAP], src: ['Middot 3:5', 'Tamid 3:5', 'Tamid 4:2', 'Rambam BhB 5:13', 'EK II 51, 58'], c: 'reconstruction',
  der: 'Beit HaMitbachayim band 12½ (Rambam); one row of 8 at its centre line ⚙; height ⚙',
  fc: { count: 'explicit', band: 'explicit', cedarCaps: 'explicit', hooks: 'explicit', threeRows: 'explicit', singleRow: 'reconstruction', height: 'reconstruction', rowSpacing: 'reconstruction' },
  p: { count: NANASIN, pillars: nanasXs.map((X) => [r6(X), NANAS_Y, Z_AZ]), section: 1, shaftH: NANAS_H, capH: NANAS_CAP, topZ: Z_AZ + NANAS_H + NANAS_CAP,
    cap: 'squared cedar block (revi\'in shel erez)', hooks: 'iron, three rows on each (Middot 3:5)',
    hookRowsZ: [0.2, 0.5, 0.8].map((f) => r6(Z_AZ + NANAS_H + f * NANAS_CAP)),
    heightNote: `"dwarf" pillars (Middot 3:5; Tamid 3:5): shaft ${NANAS_H} + cedar block ${NANAS_CAP} = ${NANAS_H + NANAS_CAP} amot, about a man's height. The reach rule fixes the lamb's row: the Tamid lamb is hung by a hind leg pierced at the hock ("נוקבו מתוך ערכובו ותולה בו", Tamid 4:2) and flayed downward, so its hook must be within a standing kohen's reach, and the block's rows (Z ${Z_AZ + NANAS_H}–${Z_AZ + NANAS_H + NANAS_CAP} ≈ ${r6(NANAS_H * AMAH).toFixed(2)}–${r6((NANAS_H + NANAS_CAP) * AMAH).toFixed(2)} m) are. Heavy carcasses are outside the rule: hung from the top row a bull would not clear the pavement, and the sources do not say how it was handled. Row spacing (0.3 amah) ⚙`,
    rowsNote: 'three rows "to each one" (Middot 3:5; Tamid 3:5), in the cedar block: iron hooks cannot be set in the stone (EK II 51). Readings (EK II 58): Rash and Bartenura (so too Shiltei HaGiborim; Tavnit Heichal: "each high or low according to its size") — three rows one above another on the side facing the tables, the low for a lamb, the middle for a ram, the high for a bull, which needs a tall block; Raavyah (in Tosafot Yom Tov) — one row on three sides (N, E, S); Raavad on Tamid — the rows under a broad cedar board laid across two pillars. The model: three rows one above another in a 1-amah block, hooks on all four faces (build-altar); block height and spacing ⚙. Not spread into the shaft: on every reading the rows are in the cedar',
    flayingStations: nanasXs.slice(0, -1).map((X, i) => [r6((X + nanasXs[i + 1]) / 2), NANAS_Y, Z_AZ]),
    flayingNote: 'carcasses hung on the hooks and flayed beside the pillars (Rambam BhB 5:13 "there they hang and flay"); the 7 gaps between the pillars are the flaying stations (Middot 3:5 "between the pillars") ⚙' } });
add('altar.tzafon', { en: 'The Tzafon (halachic north)', he: 'צפון', kind: 'zone', b: [X_ULAM_E, Y_ALT_N, Z_AZ, X_AZ_E, Y_AZ_N, Z_AZ + 0.01],
  src: ['Rambam BhB 5:15–16', 'Middot 5:2', 'Zevachim 58b', 'Yoma 16a–17a'], c: 'derived',
  der: `N wall → altar N face ${Y_AZ_N - Y_ALT_N} x Ulam line → E wall ${X_AZ_E - X_ULAM_E}`, p: { depth: Y_AZ_N - Y_ALT_N, length: X_AZ_E - X_ULAM_E } });
// kiyor (Middot 3:6; Zevachim 59a; Tamid 1:4, 3:8; Yoma 37a)
const KIY = { cx: X_ULAM_E + BEIN_HAULAM / 2, cy: AXIS_Y - ULAM_STEPS_W / 2 - 1.5 - KIYOR_D / 2 };
add('altar.kiyor', { en: 'The Kiyor (laver)', he: 'כיור', kind: 'fixture',
  b: [KIY.cx - KIYOR_D / 2, KIY.cy - KIYOR_D / 2, Z_AZ, KIY.cx + KIYOR_D / 2, KIY.cy + KIYOR_D / 2, Z_AZ + KIYOR_H],
  src: ['Middot 3:6', 'Zevachim 59a', 'Tamid 1:4', 'Tamid 3:8', 'Yoma 37a', 'Rambam BhB 3:18'], c: 'reconstruction',
  der: '"between the Ulam and the altar, drawn south" — mid-strip (X 190 = the middle of the 22) just south of the Ulam steps; diameter 4 ⚙ so 12 kohanim stand round its 12 spigots at once (circumference ≈ 12½); height 3 ⚙',
  fc: { betweenUlamAndAltar: 'explicit', drawnSouth: 'explicit', spigots: 'explicit', size: 'reconstruction', position: 'reconstruction' },
  p: { center: [KIY.cx, KIY.cy, Z_AZ], diameter: KIYOR_D, spigots: 12, material: 'copper/bronze' } });
add('altar.kiyor.muchni', { en: 'Muchni (Ben Katin\'s wheel machine) and well', he: 'מוכני', kind: 'fixture',
  b: [KIY.cx - 4, KIY.cy - KIYOR_D / 2 - 5, Z_MOUNT + 2, KIY.cx + 4, KIY.cy + KIYOR_D / 2, Z_AZ + KIYOR_H + 3], src: ['Tamid 1:4', 'Tamid 3:8', 'Yoma 37a–b', 'Rambam BhB 3:18'], c: 'reconstruction',
  der: 'wheel frame south of the kiyor; well beneath it into which the kiyor sinks overnight ⚙',
  p: { wheel: bx(KIY.cx - 4, KIY.cy - KIYOR_D / 2 - 5, Z_AZ, KIY.cx + 4, KIY.cy - KIYOR_D / 2 - 0.5, Z_AZ + KIYOR_H + 3),
    well: bx(KIY.cx - KIYOR_D / 2, KIY.cy - KIYOR_D / 2, Z_MOUNT + 2, KIY.cx + KIYOR_D / 2, KIY.cy + KIYOR_D / 2, Z_AZ),
    wellNote: 'an open shaft in the court\'s solid fill (the courts are filled from Z 0 to the pavement): build-courts carves it (listed in azarah.floor params.shafts); build-altar builds the curb, the lift and the laver that sinks into it ⚙ depth',
    sanctity: 'chol (Rambam BhB 3:18)', sound: 'its wood heard to Yericho (Tamid 3:8)' } });
elements['azarah.floor'].params.shafts = [{ id: 'altar.kiyor.muchni', box: elements['altar.kiyor.muchni'].params.well,
  note: 'the kiyor well (Yoma 37a–b): carve it from the court fill, open at the pavement, clear of the Ulam steps (1½ amot north) and the amah channel' }];
// the 12 Ulam steps (Middot 3:6; lock #25)
{
  const prof = []; let x = X_ULAM_E + ULAM_RUN;
  ULAM_TREADS.forEach((t, k) => { prof.push({ step: k + 1, riserX: x, topZ: Z_AZ + (k + 1) * STEP_RISE, tread: t, rovad: t > 1 ? (prof.filter((p) => p.tread > 1).length + 1) : 0 }); x -= t; });
  add('altar.ulam-steps', { en: 'The twelve steps of the Ulam', he: 'מעלות האולם', kind: 'stair',
    b: [X_ULAM_E, AXIS_Y - ULAM_STEPS_W / 2, Z_AZ, X_ULAM_E + BEIN_HAULAM, AXIS_Y + ULAM_STEPS_W / 2, Z_HEICHAL],
    src: ['Middot 3:6', 'Yoma 4:3 ("the fourth rovad")', 'Tamid 7:2', 'Part XI lock #25'], c: 'reconstruction',
    der: `rise ½ x 12 = 6; treads ${ULAM_TREADS.join('+')} = ${ULAM_RUN}; level apron ${ULAM_APRON} at the foot by the altar ⚙; width ${ULAM_STEPS_W} ⚙`,
    fc: { rise: 'explicit', treadOne: 'explicit', rovadSizes: 'explicit', twelveSteps: 'explicit', fourRovadim: 'derived', width: 'reconstruction', apron: 'reconstruction' },
    p: { steps: ULAM_STEPS, rise: STEP_RISE, treads: ULAM_TREADS, profile: prof, apron: bx(X_ULAM_E + ULAM_RUN, AXIS_Y - ULAM_STEPS_W / 2, Z_AZ - 0.01, X_ALT_W, AXIS_Y + ULAM_STEPS_W / 2, Z_AZ),
      apronNote: 'the 22nd amah: court pavement between the bottom riser and the altar ⚙ (it could equally be read as a wider top landing). The report (§12; Register #25) says "total run 22 fills the strip", which only R. Yehudah\'s top rovad of 5 gives; Middot\'s stam 4 gives 21 — flagged for the orchestrator',
      rovadim: 4, ascentHeading: 270, widthNote: 'width unsourced ⚙', rambamAlt: 'BhB 6:4 treads ½ (Register #25)', yehudahAlt: 'top rovad 5 → run 22 exactly' },
    n: 'Twelve rises of ½ with the "amah, amah, rovad" groups of Middot 3:6 need four groups (3 x 3 steps + the top 3), so four rovadim result (3,3,3,4) — matching the "fourth rovad" of Yoma 4:3. Lock #25\'s "3/3/4" lists the sizes in the order the Mishnah names them. Kohanim stood on these steps for Birkat Kohanim (Tamid 7:2).' });
}
add('altar.bein-haulam', { en: 'Between the Ulam and the Mizbeach', he: 'בין האולם ולמזבח', kind: 'zone', b: [X_ULAM_E, Y_AZ_S, Z_AZ, X_ALT_W, Y_AZ_N, Z_AZ + 0.01],
  src: ['Middot 3:6', 'Middot 5:1', 'Kelim 1:9', 'Tamid 5:6 (magrefah)'], c: 'explicit', der: '22 amot E–W across the court', p: { width: BEIN_HAULAM } });

// ===== 3.7 The Heichal =======================================================
add('heichal.otem', { en: 'Otem (solid podium)', he: 'אטם', kind: 'slab', b: [X_HEI_W, Y_ULAM_S, Z_AZ, X_ULAM_E, Y_ULAM_N, Z_HEICHAL],
  src: ['Middot 4:6', 'Part XI lock #39', 'Rosh (Part X §50)'], c: 'locked', der: '6 amot above grade under the T-plan; the 12 Ulam steps climb it',
  p: { pieces: [bx(X_HEI_W, Y_BODY_S, Z_AZ, X_KODESH_E, Y_BODY_N, Z_HEICHAL), bx(X_KODESH_E, Y_ULAM_S, Z_AZ, X_ULAM_E, Y_ULAM_N, Z_HEICHAL)],
    rashiAlt: 'under the full 100 x 100 incl. the 15-strips (Register #1)', boxNote: 'box = bounding box of the T; build from params.pieces (body + Ulam block)' } });
const H = (x0, y0, z0, x1, y1, z1) => [x0, y0, z0, x1, y1, z1];
add('heichal.ulam.wall-front', { en: 'Ulam — front wall', he: 'כותל האולם', kind: 'wall', b: H(X_ULAM_IN_E, Y_ULAM_S, Z_HEICHAL, X_ULAM_E, Y_ULAM_N, Z_ROOF),
  src: ['Middot 4:7', 'Middot 3:7–8'], c: 'derived', der: 'E–W chain item 1 (5); spans the full 100',
  p: { thickness: ULAM_WALL, openings: ['heichal.ulam.opening'], tieBeams: 'cedar kelunsot from the Heichal wall to the Ulam wall so it not bulge (Middot 3:8)',
    rovadinRambam: 'Rambam BhB 4:9 reads stepped ledges (1 plain + 3 ledge, top 4) around the Ulam walls — optional detail' } });
add('heichal.ulam.wall-n', { en: 'Ulam — north end wall', he: 'כותל האולם — צפון', kind: 'wall', b: H(X_ULAM_IN_W, Y_ULAM_N - ULAM_END_WALL, Z_HEICHAL, X_ULAM_IN_E, Y_ULAM_N, Z_ROOF), src: ['Middot 4:7'], c: 'reconstruction', der: 'thickness ⚙ = 5', p: { thickness: ULAM_END_WALL } });
add('heichal.ulam.wall-s', { en: 'Ulam — south end wall', he: 'כותל האולם — דרום', kind: 'wall', b: H(X_ULAM_IN_W, Y_ULAM_S, Z_HEICHAL, X_ULAM_IN_E, Y_ULAM_S + ULAM_END_WALL, Z_ROOF), src: ['Middot 4:7'], c: 'reconstruction', der: 'thickness ⚙ = 5', p: { thickness: ULAM_END_WALL } });
add('heichal.ulam.opening', { en: 'The Ulam opening (40 x 20, no doors)', he: 'פתחו של אולם', kind: 'opening', b: H(X_ULAM_IN_E, AXIS_Y - ULAM_OPEN_W / 2, Z_HEICHAL, X_ULAM_E, AXIS_Y + ULAM_OPEN_W / 2, Z_HEICHAL + ULAM_OPEN_H),
  src: ['Middot 2:3', 'Middot 3:7', 'Rambam BhB 4:8', 'Yoma 54a'], c: 'explicit', der: '40 high x 20 wide on the axis', p: { width: ULAM_OPEN_W, height: ULAM_OPEN_H, doors: 0, curtain: 'parochet (Yoma 54a)' } });
add('heichal.ulam.lintels', { en: 'The five milah lintels with stone courses', he: 'חמש מלתראות של מילת', kind: 'fixture',
  b: H(X_ULAM_IN_E, AXIS_Y - (ULAM_OPEN_W + 2 * LINTELS) / 2, Z_HEICHAL + ULAM_OPEN_H, X_ULAM_E, AXIS_Y + (ULAM_OPEN_W + 2 * LINTELS) / 2, Z_HEICHAL + ULAM_OPEN_H + (2 * LINTELS - 1) * LINTEL_DEPTH),
  src: ['Middot 3:7', 'Rambam BhB 4:8'], c: 'reconstruction', der: 'lowest 22 (1 over each side), each +2, top 30; a stone course between each pair; depths ⚙ 1',
  fc: { count: 'explicit', lengths: 'explicit', stoneCourses: 'explicit', depths: 'reconstruction' },
  p: { beams: Array.from({ length: LINTELS }, (_, k) => ({ length: ULAM_OPEN_W + 2 + 2 * k, z: [Z_HEICHAL + ULAM_OPEN_H + 2 * k * LINTEL_DEPTH, Z_HEICHAL + ULAM_OPEN_H + (2 * k + 1) * LINTEL_DEPTH] })),
    stoneCourses: Array.from({ length: LINTELS - 1 }, (_, k) => ({ z: [Z_HEICHAL + ULAM_OPEN_H + (2 * k + 1) * LINTEL_DEPTH, Z_HEICHAL + ULAM_OPEN_H + (2 * k + 2) * LINTEL_DEPTH] })),
    wood: 'milah (oak/ash) — not "mahogany"' } });
add('heichal.ulam', { en: 'The Ulam (porch hall)', he: 'אולם', kind: 'zone', b: H(X_ULAM_IN_W, Y_ULAM_S + ULAM_END_WALL, Z_HEICHAL, X_ULAM_IN_E, Y_ULAM_N - ULAM_END_WALL, Z_KOD_TOP),
  src: ['Middot 4:7', 'Middot 3:8', 'Shekalim 6:4', 'Yoma 37a–b'], c: 'reconstruction', der: `interior ${ULAM_IN} deep; height = 40 (ceiling height unsourced ⚙, set = Kodesh)`,
  fc: { depth: 'explicit', width: 'explicit', height: 'reconstruction' },
  p: { floorZ: Z_HEICHAL, ceilingZ: Z_KOD_TOP, ceilingCourses: bx(X_ULAM_IN_W, Y_ULAM_S + ULAM_END_WALL, Z_KOD_TOP, X_ULAM_IN_E, Y_ULAM_N - ULAM_END_WALL, Z_ALIYAH),
    upperStorey: bx(X_ULAM_IN_W, Y_ULAM_S + ULAM_END_WALL, Z_ALIYAH, X_ULAM_IN_E, Y_ULAM_N - ULAM_END_WALL, Z_ALIYAH_TOP),
    upperStoreyNote: 'no source describes the Ulam block above its ceiling — treat as closed', roofCourses: bx(X_ULAM_IN_W, Y_ULAM_S + ULAM_END_WALL, Z_ALIYAH_TOP, X_ULAM_IN_E, Y_ULAM_N - ULAM_END_WALL, Z_ROOF) } });
add('heichal.ulam.tables', { en: 'Showbread tables in the Ulam (marble N, gold S)', he: 'שני שלחנות באולם', kind: 'fixture',
  b: H(X_ULAM_IN_W + 0.5, AXIS_Y - GATE_W / 2 - 2.5, Z_HEICHAL, X_ULAM_IN_W + 2.5, AXIS_Y + GATE_W / 2 + 2.5, Z_HEICHAL + 1.5), src: ['Shekalim 6:4', 'Menachot 99b', 'Rambam BhB 3:16'], c: 'reconstruction',
  der: '"inside the Ulam at the entrance of the House"; which side each stands is unsourced ⚙',
  p: { marble: bx(X_ULAM_IN_W + 0.5, AXIS_Y + GATE_W / 2 + 1.5, Z_HEICHAL, X_ULAM_IN_W + 2.5, AXIS_Y + GATE_W / 2 + 2.5, Z_HEICHAL + 1.5),
    gold: bx(X_ULAM_IN_W + 0.5, AXIS_Y - GATE_W / 2 - 2.5, Z_HEICHAL, X_ULAM_IN_W + 2.5, AXIS_Y - GATE_W / 2 - 1.5, Z_HEICHAL + 1.5), rule: 'marble for the incoming bread, gold for the outgoing' } });
add('heichal.ulam.vine', { en: 'The golden vine over the Heichal entrance', he: 'גפן של זהב', kind: 'fixture',
  b: H(X_ULAM_IN_W, AXIS_Y - 12, Z_HEICHAL + GATE_H + 0.5, X_ULAM_IN_W + 1, AXIS_Y + 12, Z_HEICHAL + GATE_H + 5), src: ['Middot 3:8'], c: 'reconstruction',
  der: 'over the Heichal entrance, trained on cedar posts; extent ⚙', p: { posts: 'kelunsot (cedar)', donors: 'leaves, berries, clusters' } });
const CHAIN_FOOT = 4;                    // ⚙ chain ends 4 amot (≈1.9 m) above the Ulam floor: over a walking man's head, within an upward reach
add('heichal.ulam.chains', { en: 'Gold chains from the Ulam ceiling', he: 'שרשרות של זהב', kind: 'fixture',
  b: H(X_ULAM_IN_W + 1, AXIS_Y - 8, Z_HEICHAL + CHAIN_FOOT, X_ULAM_IN_W + 2, AXIS_Y + 8, Z_KOD_TOP), src: ['Middot 3:8', 'Part XI lock #28'], c: 'reconstruction',
  der: `fixed in the Ulam ceiling (+${Z_KOD_TOP}) and hanging to ${CHAIN_FOOT} amot over its floor, so the young kohanim could take hold and climb them to see the crowns (Middot 3:8) ⚙`,
  fc: { fixedInTheCeiling: 'explicit', climbedByThePirchei: 'explicit', count: 'reconstruction', length: 'reconstruction', positions: 'reconstruction' },
  p: { count: 4, topZ: Z_KOD_TOP, bottomZ: Z_HEICHAL + CHAIN_FOOT, spacing: 'evenly over the box\'s Y extent (the two inner ones before the F2 crown windows)',
    climbNote: '"gold chains fixed in the ceiling of the Ulam, by which the young kohanim climb and see the crowns" (Middot 3:8): a chain one climbs must hang within reach of the floor; ending at +48 (26 amot up) they could not be reached. They end 4 amot up ⚙ — clear of heads, ½ amah beside the ends of the two Ulam tables (top +23.5) — and a climber at the F2 windows (+48–52) is 26–30 amot up' } });
add('heichal.ulam.nivreshet', { en: 'Queen Helena\'s golden nivreshet', he: 'נברשת של זהב', kind: 'fixture',
  b: H(X_ULAM_IN_W + 1.5, AXIS_Y - 1, Z_HEICHAL + 24, X_ULAM_IN_W + 3.5, AXIS_Y + 1, Z_HEICHAL + 26), src: ['Yoma 37a–b'], c: 'reconstruction',
  der: 'over the Heichal entrance ⚙', p: { note: 'flashes at sunrise — keriat Shema signal' } });
// beit hachalifot wings (Middot 4:7; Zevachim 55b; Sukkah 56b)
for (const [k, y0, y1, wy] of [['n', Y_BODY_N, Y_ULAM_N - ULAM_END_WALL, (Y_BODY_N + Y_ULAM_N - ULAM_END_WALL) / 2], ['s', Y_ULAM_S + ULAM_END_WALL, Y_BODY_S, (Y_ULAM_S + ULAM_END_WALL + Y_BODY_S) / 2]]) {
  add(`heichal.chalifot.${k}`, { en: `Beit HaChalifot — ${k === 'n' ? 'north' : 'south'} wing`, he: 'בית החליפות', kind: 'zone', b: H(X_ULAM_IN_W, y0, Z_HEICHAL, X_ULAM_IN_E, y1, Z_KOD_TOP),
    src: ['Middot 4:7', 'Sukkah 56a–b', 'Shiltei HaGiborim (Part X §50)'], c: 'reconstruction', der: 'the 15-amah projection of the Ulam beyond the 70 body; height = the Ulam interior ⚙',
    fc: { plan: 'explicit', height: 'reconstruction' },
    p: { knifeNiches: { count: 12, note: '24 niches, one per mishmar — 12 N + 12 S (SG); Bilgah\'s sealed; positions ⚙' } } });
  add(`heichal.chalifot.${k}.wicket`, { en: `Beit HaChalifot ${k === 'n' ? 'north' : 'south'} — 8-amah wicket`, he: 'פשפש בבית החליפות', kind: 'opening',
    b: H(X_KODESH_E, wy - WICKET_W / 2, Z_HEICHAL, X_ULAM_IN_W, wy + WICKET_W / 2, Z_HEICHAL + 8), src: ['Zevachim 55b', 'Part IX §37.2', 'Part VII §22 F6'], c: 'reconstruction',
    der: 'west wall of the wing, opening onto the court flank; 8 high (Zevachim 55b); width ⚙',
    fc: { height: 'explicit', inChalifot: 'explicit', width: 'reconstruction', position: 'reconstruction' },
    p: { height: 8, width: WICKET_W, purpose: 'validates the flanks for eating/slaughter sight-lines', walkThrough: false,
      sillNote: `a sanctity opening (Zevachim 55b), not a route: its sill is the Heichal floor (+${Z_HEICHAL}), ${Z_HEICHAL - Z_AZ} above the court flank outside, and no stair is attested` } });
}
add('heichal.wall.east', { en: 'Heichal — east wall (great gate wall; rear of the Ulam)', he: 'כותל ההיכל — מזרח', kind: 'wall', b: H(X_KODESH_E, Y_ULAM_S, Z_HEICHAL, X_ULAM_IN_W, Y_ULAM_N, Z_ROOF),
  src: ['Middot 4:7', 'Middot 4:1–2'], c: 'derived', der: 'E–W chain item 3 (6), continued across the wings',
  p: { thickness: HEI_WALL, openings: ['heichal.gate.great', 'heichal.gate.wicket-n', 'heichal.gate.wicket-s', 'heichal.chalifot.n.wicket', 'heichal.chalifot.s.wicket', 'heichal.windows.f2'] } });
add('heichal.gate.great', { en: 'The great gate of the Heichal (four doors)', he: 'השער הגדול', kind: 'gate', b: H(X_KODESH_E, AXIS_Y - GATE_W / 2, Z_HEICHAL, X_ULAM_IN_W, AXIS_Y + GATE_W / 2, Z_HEICHAL + GATE_H),
  src: ['Middot 4:1', 'Middot 2:3', 'Rambam BhB 4:7', 'Tamid 3:6–7', 'Yoma 54a'], c: 'explicit', der: '20 x 10 on the axis in the 6-amah wall',
  p: { width: GATE_W, height: GATE_H, doors: 4, leafWidth: GATE_W / 2,
    outerPair: { hingeX: X_ULAM_IN_W, swing: 'into the doorway, covering the 6-amah thickness' }, innerPair: { hingeX: X_KODESH_E, swing: 'into the house, covering the 10 amot behind the doors (not gold-plated)' },
    yehudahAlt: 'all four within the doorway, double-folding leaves of 2½ with ½-amah jambs', keys: 'one reaching arm-deep through the door, one direct (Tamid 3:6)', curtain: 'parochet (Yoma 54a)', faces: 90 } });
add('heichal.gate.wicket-n', { en: 'North wicket of the great gate (daily entry)', he: 'פשפש צפוני', kind: 'opening',
  b: H(X_KODESH_E, Y_HW_N + 1.5, Z_HEICHAL, X_ULAM_IN_W, Y_HW_N + 1.5 + WICKET_W, Z_HEICHAL + WICKET_H), src: ['Middot 4:2', 'Middot 4:3', 'Tamid 3:7', 'Rambam BhB 4:6'], c: 'reconstruction',
  der: 'leads from the Ulam into the NE ta (whence into the Heichal) — so it sits in front of the north ta, 1½ in from the wall line ⚙; size ⚙',
  fc: { northSide: 'explicit', intoTheTa: 'explicit', offset: 'reconstruction', size: 'reconstruction' }, p: { opensInto: 'heichal.taim.north', opensIntoNote: 'the NE (easternmost lower) cell', daily: true } });
add('heichal.gate.wicket-s', { en: 'South wicket of the great gate (never entered)', he: 'פשפש דרומי', kind: 'opening',
  b: H(X_KODESH_E, Y_HW_S - 1.5 - WICKET_W, Z_HEICHAL, X_ULAM_IN_W, Y_HW_S - 1.5, Z_HEICHAL + WICKET_H), src: ['Middot 4:2', 'Yechezkel 44:2'], c: 'reconstruction',
  der: 'mirror of the north wicket (offset and size ⚙)', fc: { southSide: 'explicit', offset: 'reconstruction', size: 'reconstruction' }, p: { permanentlyClosed: true, note: '"this gate shall be shut" (Middot 4:2 quoting Yechezkel 44:2)' } });
add('heichal.kodesh', { en: 'The Kodesh (Heichal hall)', he: 'היכל — קודש', kind: 'zone', b: H(X_KODESH_W, Y_KOD_S, Z_HEICHAL, X_KODESH_E, Y_KOD_N, Z_KOD_TOP),
  src: ['Middot 4:7', 'Middot 4:6', 'Middot 4:1', 'Yoma 52a'], c: 'explicit', der: '40 x 20 x 40', p: { floorZ: Z_HEICHAL, finish: 'gold-plated except behind the doors (Middot 4:1); relief keruvim/palms/flowers (Yoma 54a)' } });
add('heichal.amah-traksin', { en: 'Amah Traksin (the amah between the curtains)', he: 'אמה טרקסין', kind: 'zone', b: H(X_KHK_E, Y_KOD_S, Z_HEICHAL, X_KODESH_W, Y_KOD_N, Z_KOD_TOP),
  src: ['Middot 4:7', 'Yoma 51b–52b', 'Rambam BhB 4:2', 'Part XI locks #5, #42'], c: 'locked', der: '1 amah; no wall (Bava Batra 3a)', p: {} });
add('heichal.parochet.outer', { en: 'Outer Parochet (pinned back at its south end)', he: 'פרוכת חיצונה', kind: 'curtain', b: H(X_KODESH_W - TEFACH, Y_KOD_S, Z_HEICHAL, X_KODESH_W, Y_KOD_N, Z_KOD_TOP),
  src: ['Yoma 51b–52b', 'Shekalim 8:5', 'Rambam BhB 4:2', 'Part XI locks #5, #42'], c: 'locked', der: 'a tefach thick, its east face on the Kodesh\'s 40th amah; 40 x 20',
  p: { thickness: TEFACH, size: [40, 20], pinnedBack: 'south', weave: '72 cords x 24 strands: techelet, argaman, tola\'at shani, shesh (Shekalim 8:5)' } });
add('heichal.parochet.inner', { en: 'Inner Parochet (pinned back at its north end)', he: 'פרוכת פנימית', kind: 'curtain', b: H(X_KHK_E, Y_KOD_S, Z_HEICHAL, X_KHK_E + TEFACH, Y_KOD_N, Z_KOD_TOP),
  src: ['Yoma 51b–52b', 'Rambam BhB 4:2', 'Part XI locks #5, #42'], c: 'locked', der: 'a tefach thick on the KhK\'s line; clear gap 4 tefachim (1 + 4 + 1 = the amah)',
  p: { thickness: TEFACH, size: [40, 20], pinnedBack: 'north', sgAlt: 'a clear amah between them (1⅓ overall) — Register #42' } });
add('heichal.khk', { en: 'Kodesh HaKodashim', he: 'קודש הקודשים', kind: 'zone', b: H(X_KHK_W, Y_KOD_S, Z_HEICHAL, X_KHK_E, Y_KOD_N, Z_KOD_TOP),
  src: ['Middot 4:7', 'Yoma 21b', 'Yoma 53b', 'Shekalim 4:4', 'Part XI lock #15'], c: 'explicit', der: '20 x 20 x 40; empty but for the Even Shetiyah',
  p: { floorZ: Z_HEICHAL, windows: 0, finish: 'beaten-gold plates (Shekalim 4:4)', reliefKeruvim: 'Yoma 54a (Rav Acha bar Yaakov)' } });
add('heichal.even-shetiyah', { en: 'Even Shetiyah (Foundation Stone)', he: 'אבן שתיה', kind: 'fixture', b: H(X_KHK_W + 1, AXIS_Y - 1.5, Z_HEICHAL, X_KHK_W + 3, AXIS_Y + 1.5, Z_HEICHAL + EVEN_SHETIYAH_H),
  src: ['Yoma 5:2 (53b)', 'Rambam BhB 4:1', 'Part XI lock #15'], c: 'reconstruction', der: 'in the west of the chamber, 3 etzba\'ot high; footprint ⚙ ≥ the Aron 2½ x 1½',
  p: { height: EVEN_SHETIYAH_H, kgStation: [X_KHK_W + 5, AXIS_Y, Z_HEICHAL], kgFacing: 270 } });
// vessels (Yoma 33b; Menachot 98b; Rambam BhB 3:12–17; locks #11, #12, #31)
const X_THIRD = X_KODESH_E - KODESH_LEN / 3;            // 143.67 — vessels "from a third of the Heichal inward" (Rambam BhB 3:17)
const X_VESSELS = (X_KODESH_W + X_THIRD) / 2;           // 130.33 — middle of the inner two-thirds ⚙
add('heichal.shulchan', { en: 'The Shulchan (table of the showbread)', he: 'שלחן', kind: 'fixture',
  b: H(X_VESSELS - SHULCHAN[0] / 2, Y_KOD_N - VESSEL_WALL_OFF - SHULCHAN[1], Z_HEICHAL, X_VESSELS + SHULCHAN[0] / 2, Y_KOD_N - VESSEL_WALL_OFF, Z_HEICHAL + SHULCHAN_H),
  src: ['Yoma 33b', 'Menachot 98b', 'Menachot 96a', 'Rambam BhB 3:12–17', 'Part XI locks #12, #31–#33'], c: 'reconstruction',
  der: 'north, 2½ off the N wall; length E–W; top 10 x 5 tefachim; E–W position = middle of the inner ⅔ ⚙',
  fc: { northSide: 'explicit', wallOffset: 'explicit', lengthEastWest: 'locked', top: 'locked', height: 'reconstruction', eastWestStation: 'reconstruction' },
  p: { top: SHULCHAN, height: SHULCHAN_H, heightNote: '1½ amot in R\' Yehudah\'s 5-tefach amah (consistent with lock #31); 6-tefach reading 1½', lengthAxis: 'X', snifin: 4, kanim: 28, bezichin: 2, loaves: 12 } });
add('heichal.menorah', { en: 'The Menorah', he: 'מנורה', kind: 'fixture',
  b: H(X_VESSELS - 1, Y_KOD_S + VESSEL_WALL_OFF, Z_HEICHAL, X_VESSELS + 1, Y_KOD_S + VESSEL_WALL_OFF + 0.5, Z_HEICHAL + MENORAH_H),
  src: ['Yoma 33b', 'Menachot 28b', 'Tamid 3:9', 'Rambam BhB 3:1–11', 'Part XI locks #11, #30'], c: 'reconstruction',
  der: 'south, 2½ off the S wall, opposite the Shulchan (E–W station = middle of the inner ⅔ ⚙); 18 tefachim; lamp row E–W (lock #11); branch span 2 ⚙',
  fc: { southSide: 'explicit', wallOffset: 'explicit', height: 'explicit', lampRow: 'locked', branches: 'locked', span: 'reconstruction', eastWestStation: 'reconstruction' },
  p: { height: MENORAH_H, lampRow: 'E–W', lamps: 7, lampOrder: 'index 0 = the easternmost lamp; 7 lamps evenly over the span',
    centerLamp: 'the middle lamp (index 3), on the central stem. Under lock #11 (E–W row) it is not the ner ma\'aravi (that is lamp 1, see nerMaaravi), and Tamid\'s rite (3:9, 6:1) gives it no role of its own. In the Rambam\'s N–S row (nerMaaravi.readings.northSouth) it is the ner ma\'aravi: the six branch lamps face it and it faces the KhK (BhB 3:8)',
    nerMaaravi: { lamp: 1, countFrom: 'east',
      basis: 'lock #11 (E–W row, Raavad on BhB 3:12) with Tamid 6:1: "he found the two eastern lamps burning, cleaned the eastern and left the western burning, from which he lit the Menorah in the evening" (also Tamid 3:9) — the two eastern lamps are indices 0 and 1, the western of them is index 1, the second from the east (Rashi\'s reading)',
      readings: {
        eastWest: { lamp: 1, source: 'Raavad on Rambam BhB 3:12; Tamid 3:9, 6:1; Rashi — lamps E–W, the ner ma\'aravi the second from the east (the model)' },
        northSouth: { lamp: 3, source: 'Rambam BhB 3:8, 3:12 — lamps N–S "across the width of the House", the ner ma\'aravi the middle lamp, facing the KhK (Register #11)' } } },
    branches: 'straight diagonals (lock #30)', span: 2,
    stone: { box: bx(X_VESSELS - 0.5, Y_KOD_S + VESSEL_WALL_OFF + 0.75, Z_HEICHAL, X_VESSELS + 0.5, Y_KOD_S + VESSEL_WALL_OFF + 2.25, Z_HEICHAL + 1.5), steps: 3, note: 'stone with three steps before it; the kuz rests on the second (Tamid 3:9) — on its north (front) side ⚙' } } });
add('heichal.mizbach-hazahav', { en: 'The golden altar (incense)', he: 'מזבח הזהב', kind: 'fixture',
  b: H(X_VESSELS + 2 - GOLDEN_ALTAR[0] / 2, AXIS_Y - GOLDEN_ALTAR[1] / 2, Z_HEICHAL, X_VESSELS + 2 + GOLDEN_ALTAR[0] / 2, AXIS_Y + GOLDEN_ALTAR[1] / 2, Z_HEICHAL + GOLDEN_ALTAR[2]),
  src: ['Shemot 30:1–10', 'Yoma 33b', 'Rambam BhB 3:17'], c: 'reconstruction',
  der: 'centered N–S, "between the Shulchan and the Menorah, drawn outward" (east) by 2 ⚙; inside the inner ⅔',
  fc: { size: 'explicit', centredNorthSouth: 'explicit', drawnOutward: 'explicit', offset: 'reconstruction' },
  p: { size: GOLDEN_ALTAR, horns: 4, kelimAlt: 'Kelim 17:10 (R\' Meir): 5-tefach amot → 0.83 x 0.83 x 1.67' } });
add('heichal.sotah-slab', { en: 'The Sotah slab (marble, with ring)', he: 'טבלא של שיש — עפר סוטה', kind: 'slab',
  b: H(X_KODESH_E - 2, AXIS_Y + GATE_W / 2 + 1.5, Z_HEICHAL - 0.25, X_KODESH_E - 1, AXIS_Y + GATE_W / 2 + 2.5, Z_HEICHAL),
  src: ['Sotah 2:2', 'Shiltei HaGiborim 33 (Part X §53)', 'Part IX §37.1', 'Part VII §22 F13'], c: 'reconstruction',
  der: 'entering, turned right = north, just within the great gate; 1 x 1; 1½ north of the jamb and 1 in from the wall face, beyond the inner door leaf ⚙',
  fc: { north: 'explicit', size: 'explicit', position: 'reconstruction' }, p: { size: [1, 1], ring: true } });
// Heichal walls with ta'im setbacks (Middot 4:4)
const wallProfile = (lo) => TA_STORY.map((_, k) => ({ z: taStoryZ(k), t: HEI_WALL_BY_STORY[k] })).concat([{ z: [taStoryZ(2)[1], Z_ROOF], t: HEI_WALL_UPPER }]);
add('heichal.wall.north', { en: 'Heichal — north wall', he: 'כותל ההיכל — צפון', kind: 'wall', b: H(X_KHK_W - HEI_WALL_BY_STORY[0], Y_KOD_N, Z_HEICHAL, X_KODESH_E, Y_KOD_N + HEI_WALL_BY_STORY[0], Z_ROOF),
  src: ['Middot 4:7', 'Middot 4:4', '1 Melachim 6:6'], c: 'derived', der: 'interior face at Y 340.5; 7 / 6 / 5 thick by ta story (wall + ta = 12), 5 above',
  fc: { thickness: 'explicit', setbacks: 'derived', setbackHeights: 'reconstruction' },
  p: { interiorFaceY: Y_KOD_N, profile: wallProfile(), openings: ['heichal.ta.door-ne', 'heichal.windows.f1'] } });
add('heichal.wall.south', { en: 'Heichal — south wall', he: 'כותל ההיכל — דרום', kind: 'wall', b: H(X_KHK_W - HEI_WALL_BY_STORY[0], Y_KOD_S - HEI_WALL_BY_STORY[0], Z_HEICHAL, X_KODESH_E, Y_KOD_S, Z_ROOF),
  src: ['Middot 4:7', 'Middot 4:4'], c: 'derived', der: 'as the north wall', fc: { thickness: 'explicit', setbacks: 'derived', setbackHeights: 'reconstruction' }, p: { interiorFaceY: Y_KOD_S, profile: wallProfile(), openings: ['heichal.windows.f1', 'heichal.aliyah.door'] } });
add('heichal.wall.west', { en: 'Heichal — west wall', he: 'כותל ההיכל — מערב', kind: 'wall', b: H(X_KHK_W - HEI_WALL_BY_STORY[0], Y_KOD_S - HEI_WALL_BY_STORY[0], Z_HEICHAL, X_KHK_W, Y_KOD_N + HEI_WALL_BY_STORY[0], Z_ROOF),
  src: ['Middot 4:7', 'Middot 4:4'], c: 'derived', der: 'interior face at X 96; 7 / 6 / 5 by story', fc: { thickness: 'explicit', setbacks: 'derived', setbackHeights: 'reconstruction' }, p: { interiorFaceX: X_KHK_W, profile: wallProfile(), openings: ['heichal.lul-west'] } });
// ta'im (lock #38: solid walls, cells in file). Story heights ⚙: 3 x 11 → roofs at +55, below the F1 band (Part VII §22)
const taCells = [];
const cellsAlong = (a0, a1, n, part = 1) => { const L = (a1 - a0 - (n - 1) * part) / n; return Array.from({ length: n }, (_, i) => [a0 + i * (L + part), a0 + i * (L + part) + L]); };
for (let k = 0; k < 3; k++) {
  const [z0, z1] = taStoryZ(k), w = TA_STORY[k], zi = z1 - 1;
  cellsAlong(X_TA_W_W + w, X_KODESH_E, TA_COUNT.N[k]).forEach(([a, b], i) => taCells.push({ side: 'N', story: k + 1, n: i + 1, box: bx(a, Y_TA_N - w, z0, b, Y_TA_N, zi) }));
  cellsAlong(X_TA_W_W + w, X_KODESH_E, TA_COUNT.S[k]).forEach(([a, b], i) => taCells.push({ side: 'S', story: k + 1, n: i + 1, box: bx(a, Y_TA_S, z0, b, Y_TA_S + w, zi) }));
  cellsAlong(Y_TA_S, Y_TA_N, TA_COUNT.W[k]).forEach(([a, b], i) => taCells.push({ side: 'W', story: k + 1, n: i + 1, box: bx(X_TA_W_W, a, z0, X_TA_W_W + w, b, zi) }));
}
const taZ = [Z_HEICHAL, Z_TAIM_ROOF];
const TA_FC = { count: 'locked', widths: 'explicit', threeStories: 'explicit', storyHeight: 'reconstruction' };
const TA_DER = `widths 5/6/7 by story (Middot 4:4); 3 stories of ${TA_STORY_H} ⚙ → roofs +${Z_TAIM_ROOF}, below the F1 windows (Part VII §22)`;
add('heichal.taim.north', { en: "Ta'im — north (5 over 5 over 5)", he: 'תאים — צפון', kind: 'chamber', b: H(X_TA_W_W + TA_STORY[0], Y_TA_N - TA_STORY[2], taZ[0], X_KODESH_E, Y_TA_N, taZ[1]),
  src: ['Middot 4:3–4', 'Rambam BhB 4:10', 'Part XI lock #38', 'Part VII §22'], c: 'reconstruction', der: TA_DER, fc: TA_FC,
  p: { cells: taCells.filter((c) => c.side === 'N'), storyHeight: TA_STORY_H, roofZ: Z_TAIM_ROOF, doorsPerCell: 'right, left, above (Middot 4:3)', neCorner: 'NE lower cell: 5 doors — right, above, mesibah, pishpash, Heichal (Middot 4:3; Rambam: middle story)', partitions: 1 } });
add('heichal.taim.south', { en: "Ta'im — south (5 over 5 over 5)", he: 'תאים — דרום', kind: 'chamber', b: H(X_TA_W_W + TA_STORY[0], Y_TA_S, taZ[0], X_KODESH_E, Y_TA_S + TA_STORY[2], taZ[1]),
  src: ['Middot 4:3–4', 'Rambam BhB 4:10', 'Part XI lock #38', 'Part VII §22'], c: 'reconstruction', der: TA_DER, fc: TA_FC,
  p: { cells: taCells.filter((c) => c.side === 'S'), storyHeight: TA_STORY_H, roofZ: Z_TAIM_ROOF, partitions: 1 } });
add('heichal.taim.west', { en: "Ta'im — west (3 over 3, 2 over them)", he: 'תאים — מערב', kind: 'chamber', b: H(X_TA_W_W, Y_TA_S, taZ[0], X_TA_W_W + TA_STORY[2], Y_TA_N, taZ[1]),
  src: ['Middot 4:3–4', 'Middot 4:7', 'Part XI lock #38', 'Part VII §22'], c: 'reconstruction', der: `the 6-amah ta of the E–W chain; 3 + 3 + 2 cells; ${TA_DER}`, fc: TA_FC,
  p: { cells: taCells.filter((c) => c.side === 'W'), storyHeight: TA_STORY_H, roofZ: Z_TAIM_ROOF, axialCell: 'middle cell of the lower story', partitions: 1 } });
add('heichal.ta.door-ne', { en: 'NE ta — door into the Heichal', he: 'פתח מן התא להיכל', kind: 'opening', b: H(X_KODESH_E - 7, Y_KOD_N, Z_HEICHAL, X_KODESH_E - 4, Y_KOD_N + HEI_WALL_BY_STORY[0], Z_HEICHAL + WICKET_H),
  src: ['Middot 4:2–3', 'Tamid 3:7'], c: 'reconstruction', der: 'the daily route: wicket → NE ta → Heichal; position ⚙', p: {} });
const OUTER_FC = { thickness: 'explicit', height: 'reconstruction' };
add('heichal.ta-wall.north', { en: "Ta'im outer wall — north", he: 'כותל התא — צפון', kind: 'wall', b: H(X_TA_W_W, Y_TA_N, Z_HEICHAL, X_KODESH_E, Y_TAW_N, Z_TAIM_ROOF), src: ['Middot 4:7'], c: 'reconstruction',
  der: `5 (Middot 4:7); up to the ta'im roofs +${Z_TAIM_ROOF} ⚙`, fc: OUTER_FC, p: { door: bx(X_KODESH_E - 7, Y_TA_N, Z_HEICHAL, X_KODESH_E - 4, Y_TAW_N, Z_HEICHAL + WICKET_H), doorNote: 'NE ta → mesibah (Middot 4:3)' } });
add('heichal.ta-wall.south', { en: "Ta'im outer wall — south", he: 'כותל התא — דרום', kind: 'wall', b: H(X_TA_W_W, Y_TAW_S, Z_HEICHAL, X_KODESH_E, Y_TA_S, Z_TAIM_ROOF), src: ['Middot 4:7'], c: 'reconstruction',
  der: `5 (Middot 4:7); up to the ta'im roofs +${Z_TAIM_ROOF} ⚙`, fc: OUTER_FC, p: {} });
add('heichal.ta-wall.west', { en: "Ta'im outer wall — west", he: 'כותל התא — מערב', kind: 'wall', b: H(X_HEI_W, Y_BODY_S, Z_HEICHAL, X_TA_W_W, Y_BODY_N, Z_TAIM_ROOF), src: ['Middot 4:7'], c: 'reconstruction',
  der: `E–W chain item 9 (5), closing the N/S voids at their west ends; up to +${Z_TAIM_ROOF} ⚙`, fc: OUTER_FC, p: { openings: ['heichal.lul-west'] } });
add('heichal.mesibah', { en: 'The Mesibah (winding ascent)', he: 'מסיבה', kind: 'stair', b: H(X_TA_W_W, Y_TAW_N, Z_HEICHAL, X_KODESH_E, Y_MES_N, Z_TAIM_ROOF),
  src: ['Middot 4:5', 'Middot 4:7', 'Rambam BhB 4:12', 'EK II 180–182 (roofless)'], c: 'reconstruction',
  der: `3-amah void on the north; rises from the NE (+22) to the NW onto the ta'im roofs (+${Z_TAIM_ROOF} ⚙); then W and S on the roofs, and up the roof stair to the aliyah door (+${Z_ALIYAH})`,
  fc: { width: 'explicit', route: 'explicit', height: 'reconstruction', roofless: 'reconstruction' },
  p: { from: [X_KODESH_E, (Y_TAW_N + Y_MES_N) / 2, Z_HEICHAL], to: [X_TA_W_W, (Y_TAW_N + Y_MES_N) / 2, Z_TAIM_ROOF], risers: (Z_TAIM_ROOF - Z_HEICHAL) / STEP_RISE, rise: STEP_RISE, tread: STEP_TREAD,
    landings: `run 73 > ${(Z_TAIM_ROOF - Z_HEICHAL) / STEP_RISE * STEP_TREAD} needed: landings between flights ⚙`, ascentHeading: 270, roofed: false,
    head: { landing: 'heichal.taim.roofs params.pieces (mesibah-landing)', at: [X_TA_W_W + 2, (Y_TAW_N + Y_MES_N) / 2, Z_TAIM_ROOF] },
    route: 'NE → NW (ascending, facing west) → along the W (facing south) → along the S (facing east) → heichal.taim.roof-stair → aliyah door (Middot 4:5)' } });
add('heichal.mesibah-wall', { en: 'Mesibah wall', he: 'כותל המסיבה', kind: 'wall', b: H(X_HEI_W, Y_MES_N, Z_HEICHAL, X_KODESH_E, Y_BODY_N, Z_TAIM_ROOF), src: ['Middot 4:7', 'EK II 180–182'], c: 'reconstruction',
  der: `5 (outermost on the north); up to +${Z_TAIM_ROOF} ⚙`, fc: OUTER_FC, p: {} });
add('heichal.beit-horadat-hamayim', { en: 'Beit Horadat HaMayim (water-descent house)', he: 'בית הורדת המים', kind: 'zone', b: H(X_TA_W_W, Y_WATER_S, Z_HEICHAL, X_KODESH_E, Y_TAW_S, Z_TAIM_ROOF),
  src: ['Middot 4:7', 'Rambam BhB 4:5', 'Part XI lock #41'], c: 'reconstruction', der: `3-amah void on the south, open to the sky above the ta'im roofs (+${Z_TAIM_ROOF} ⚙)`,
  fc: { width: 'explicit', function: 'locked', height: 'reconstruction' }, p: { use: 'roof-rainwater chase (Mahari); En-Eitam piping noted (EK)', openTop: true } });
add('heichal.outer-wall.south', { en: 'Heichal — outer south wall', he: 'כותל — דרום', kind: 'wall', b: H(X_HEI_W, Y_BODY_S, Z_HEICHAL, X_KODESH_E, Y_WATER_S, Z_TAIM_ROOF), src: ['Middot 4:7'], c: 'reconstruction',
  der: `5 (outermost on the south); up to +${Z_TAIM_ROOF} ⚙`, fc: OUTER_FC, p: {} });
add('heichal.lul-west', { en: 'The lul behind the Kaporet (8 amot high)', he: 'לול קטן אחורי בית הכפורת', kind: 'opening',
  b: H(X_HEI_W, AXIS_Y - LUL_W / 2, Z_HEICHAL, X_KHK_W, AXIS_Y + LUL_W / 2, Z_HEICHAL + LUL_H), src: ['Zevachim 55b', 'EK II 178–179', 'Part VII §22 F7'], c: 'reconstruction',
  der: '8 high (Zevachim 55b), 4 tefachim wide (EK); through the KhK wall, the axial west ta and its outer wall',
  fc: { height: 'explicit', behindTheKaporet: 'explicit', width: 'reconstruction', throughTheKhKWall: 'reconstruction' },
  p: { width: LUL_W, height: LUL_H, smallCurtain: true, walkThrough: false,
    pierces: ['heichal.wall.west', 'heichal.taim.west (axial cell, lower story)', 'heichal.ta-wall.west'],
    piercingBasis: 'EK II 178–179: only 4 tefachim wide (hence "lul", not "petach"), with a small curtain, piercing the KhK\'s own wall (with Tosafot on Zevachim 55b; against Mahari). Zevachim 55b gives its purpose: it validates the court behind the Kaporet for eating kodshei kodashim and slaughtering kodashim kalim — an opening of the House itself',
    darkness: 'the KhK stays the dark chamber of Part VII §22 (no window is attested): the lul is a sanctity opening, not a window, and its small curtain closes it (Yoma 54a\'s count of curtains does not include it; EK supplies it) ⚙',
    sillNote: `a slot 4 tefachim wide whose sill is the KhK floor (+${Z_HEICHAL}), ${Z_HEICHAL - Z_AZ} above the strip behind the House: not a passage` } });
// ceiling, aliyah, roof (Middot 4:5–6; Rambam BhB 4:3; locks #6, #27, #40)
const stackSlab = (i, en, he, x0, y0, x1, y1) => ({ en, he, kind: 'slab', b: H(x0, y0, stackZ[i][0], x1, y1, stackZ[i][1]), src: ['Middot 4:6', 'Rambam BhB 4:3', 'Part XI lock #40'], c: i === 3 || i === 8 ? 'locked' : 'explicit', der: `stack item ${i + 1}: ${STACK[i][0]} ${STACK[i][1]}` });
add('heichal.ceiling.kiyur', { ...stackSlab(2, 'Ceiling — kiyur (decorated course)', 'כיור', X_KHK_W, Y_KOD_S, X_KODESH_E, Y_KOD_N), p: { form: 'decorated crown course (lock #40)' } });
add('heichal.ceiling.dilpah', { ...stackSlab(3, 'Ceiling — beit dilpah (drip void)', 'בית דילפא', X_KHK_W, Y_KOD_S, X_KODESH_E, Y_KOD_N), p: { form: 'void between double ceilings (lock #40)', hollow: true } });
add('heichal.ceiling.tikrah', { ...stackSlab(4, 'Ceiling — tikrah', 'תקרה', X_KHK_W, Y_KOD_S, X_KODESH_E, Y_KOD_N), p: {} });
add('heichal.ceiling.maazivah', { ...stackSlab(5, 'Ceiling — ma\'azivah (fill) = aliyah floor', 'מעזיבה', X_KHK_W, Y_KOD_S, X_KODESH_E, Y_KOD_N), p: { topZ: Z_ALIYAH } });
add('heichal.aliyah', { en: 'The Aliyah (upper storey)', he: 'עליה', kind: 'zone', b: H(X_KHK_W, Y_KOD_S, Z_ALIYAH, X_KODESH_E, Y_KOD_N, Z_ALIYAH_TOP),
  src: ['Middot 4:5–6', 'Yoma 54a', 'Rambam BhB 4:3', 'Rambam BhB 7:23'], c: 'explicit', der: '40 high over the Kodesh + KhK',
  fc: { height: 'explicit', plan: 'explicit', lulinPosition: 'reconstruction' },
  p: { floorZ: Z_ALIYAH, rasheiPispasin: bx(X_KHK_E, Y_KOD_S, Z_ALIYAH, X_KODESH_W, Y_KOD_N, Z_ALIYAH + 0.25),
    curtains: [bx(X_KODESH_W - TEFACH, Y_KOD_S, Z_ALIYAH, X_KODESH_W, Y_KOD_N, Z_ALIYAH_TOP), bx(X_KHK_E, Y_KOD_S, Z_ALIYAH, X_KHK_E + TEFACH, Y_KOD_N, Z_ALIYAH_TOP)],
    lulin: [bx(X_KHK_W + 9, AXIS_Y - 1, Z_ALIYAH - 0.1, X_KHK_W + 11, AXIS_Y + 1, Z_ALIYAH)],
    lulinNote: 'hatches into the KhK for craftsmen in tevot (Middot 4:5); one 2 x 2 shown, centred over the KhK (X 106 = (96 + 116) / 2) ⚙ — the Mishnah has the plural', entered: 'once in seven years' } });
add('heichal.aliyah.door', { en: 'Door of the Aliyah (south)', he: 'פתחה של עליה', kind: 'opening', b: H(X_KODESH_W + 15, Y_KOD_S - HEI_WALL_UPPER, Z_ALIYAH, X_KODESH_W + 25, Y_KOD_S, Z_ALIYAH + GATE_H),
  src: ['Middot 4:5', 'Middot 2:3', 'Rambam BhB 4:12'], c: 'reconstruction',
  der: `opens south (Middot 4:5) onto the landing of the roof stair; 20 x 10 (Middot 2:3 standard); X ${X_KODESH_W + 15}–${X_KODESH_W + 25} ⚙ = centred on the part of the aliyah over the Kodesh (X ${X_KODESH_W}–${X_KODESH_E}, centre ${(X_KODESH_W + X_KODESH_E) / 2}), not over the KhK`,
  fc: { southFace: 'explicit', size: 'explicit', x: 'reconstruction' },
  p: { cedarPosts: [[X_KODESH_W + 15.25, Y_KOD_S - HEI_WALL_UPPER - 0.5, Z_ALIYAH], [X_KODESH_W + 24.75, Y_KOD_S - HEI_WALL_UPPER - 0.5, Z_ALIYAH]], postsTopZ: Z_ROOF,
    postsNote: 'two cedar posts at the door by which they climbed to the aliyah roof (Middot 4:5); they stand on the landing ⚙', reachedBy: 'heichal.taim.roof-stair' } });
add('heichal.roof.kiyur', { ...stackSlab(7, 'Roof — kiyur', 'כיור', X_KHK_W, Y_KOD_S, X_KODESH_E, Y_KOD_N), p: {} });
add('heichal.roof.dilpah', { ...stackSlab(8, 'Roof — beit dilpah', 'בית דילפא', X_KHK_W, Y_KOD_S, X_KODESH_E, Y_KOD_N), p: { hollow: true } });
add('heichal.roof.tikrah', { ...stackSlab(9, 'Roof — tikrah', 'תקרה', X_KHK_W, Y_KOD_S, X_KODESH_E, Y_KOD_N), p: {} });
add('heichal.roof.maazivah', { ...stackSlab(10, 'Roof — ma\'azivah (roof surface)', 'מעזיבה', X_KHK_W, Y_KOD_S, X_KODESH_E, Y_KOD_N), p: { topZ: Z_ROOF } });
const ROOF_PATH = [[X_ALIYAH_W_FACE, Y_KOD_S - HEI_WALL_UPPER], [X_KODESH_E, Y_KOD_S - HEI_WALL_UPPER], [X_KODESH_E, Y_ULAM_S], [X_ULAM_E, Y_ULAM_S],
  [X_ULAM_E, Y_ULAM_N], [X_KODESH_E, Y_ULAM_N], [X_KODESH_E, Y_KOD_N + HEI_WALL_UPPER], [X_ALIYAH_W_FACE, Y_KOD_N + HEI_WALL_UPPER]];
add('heichal.roof', { en: 'Heichal roof (main)', he: 'גג ההיכל', kind: 'slab', b: H(X_ALIYAH_W_FACE, Y_ULAM_S, Z_ROOF - 0.01, X_ULAM_E, Y_ULAM_N, Z_ROOF),
  src: ['Middot 4:6', 'Rambam BhB 4:3'], c: 'derived', der: `roof surface +${Z_ROOF} over the aliyah block and the Ulam block (T outline)`, p: { outline: ROOF_PATH, z: Z_ROOF } });
add('heichal.maakeh', { en: "Ma'akeh (parapet, 3)", he: 'מעקה', kind: 'wall', b: H(X_ALIYAH_W_FACE, Y_ULAM_S, Z_ROOF, X_ULAM_E, Y_ULAM_N, Z_MAAKEH),
  src: ['Middot 4:6', 'Rambam BhB 4:3', 'Part XI lock #6'], c: 'explicit', der: '3 amot around the roof outline', p: { path: ROOF_PATH, height: 3, thickness: 1, battlements: 'none (Part VII §25)' } });
add('heichal.kalya-orev', { en: 'Kalya orev (iron blade, 1 amah)', he: 'כלה עורב', kind: 'fixture', b: H(X_ALIYAH_W_FACE, Y_ULAM_S, Z_MAAKEH, X_ULAM_E, Y_ULAM_N, Z_CROWN),
  src: ['Middot 4:6', 'Rambam BhB 4:3', 'Menachot 107a', 'Part XI locks #6, #27'], c: 'locked', der: `on the parapet → crown +${Z_CROWN} (Part XIV §64.1)`,
  p: { path: ROOF_PATH, height: 1, material: 'iron', form: 'continuous blade "like a sword" (lock #27); NOT gold spikes' } });
// the ta'im roofs (+55 ⚙): the mesibah and the water-descent house stay open to the sky (EK II 180–182; lock #41 roof-rain chase);
// a landing covers only the mesibah's NW head, where the ascent arrives
const zT = Z_TAIM_ROOF, MES_LANDING = 4;
const taimRoofPieces = {
  north: bx(X_HEI_W, Y_KOD_N + HEI_WALL_UPPER, zT - 1, X_KODESH_E, Y_TAW_N, zT),
  'mesibah-wall': bx(X_HEI_W, Y_MES_N, zT - 1, X_KODESH_E, Y_BODY_N, zT),
  'mesibah-landing': bx(X_HEI_W, Y_TAW_N, zT - 1, X_TA_W_W + MES_LANDING, Y_MES_N, zT),
  west: bx(X_HEI_W, Y_KOD_S - HEI_WALL_UPPER, zT - 1, X_ALIYAH_W_FACE, Y_KOD_N + HEI_WALL_UPPER, zT),
  south: bx(X_HEI_W, Y_TAW_S, zT - 1, X_KODESH_E, Y_KOD_S - HEI_WALL_UPPER, zT),
  'water-house-west-end': bx(X_HEI_W, Y_WATER_S, zT - 1, X_TA_W_W, Y_TAW_S, zT),
  'outer-wall-south': bx(X_HEI_W, Y_BODY_S, zT - 1, X_KODESH_E, Y_WATER_S, zT),
};
add('heichal.taim.roofs', { en: "Roofs of the ta'im (walk to the aliyah)", he: 'גגות התאים', kind: 'slab', b: H(X_HEI_W, Y_BODY_S, zT - 1, X_KODESH_E, Y_BODY_N, zT),
  src: ['Middot 4:5', 'Part VII §22', 'EK II 180–182'], c: 'reconstruction',
  der: `+${zT} ⚙: below the F1 windows (+${F1_BAND[0]}–${F1_BAND[1]}), with the mesibah and the water-descent house open between the pieces`,
  fc: { walkOnRoofs: 'explicit', height: 'reconstruction' },
  p: { pieces: Object.values(taimRoofPieces), pieceNames: Object.keys(taimRoofPieces), z: zT,
    openVoids: { mesibah: bx(X_TA_W_W + MES_LANDING, Y_TAW_N, zT - 1, X_KODESH_E, Y_MES_N, zT), 'beit-horadat-hamayim': bx(X_TA_W_W, Y_WATER_S, zT - 1, X_KODESH_E, Y_TAW_S, zT) },
    boxNote: 'box = overall extent; build from params.pieces (the voids are open)', walk: 'Middot 4:5: up the mesibah to the NW, W along the west roof, E along the south roof to the roof stair',
    parapet: { height: 3, note: 'unsourced; by analogy with the main ma\'akeh, along the outer edges and the void edges ⚙' } } });
// the climb from the ta'im roofs to the aliyah door: 24 half-steps along the outer edge of the south roof, rising east, then a
// landing slab bridging to the door. The flight keeps clear of the F1 windows; the landing passes above them, open below ⚙
{
  const run = (Z_ALIYAH - zT) / STEP_RISE * STEP_TREAD, xd0 = X_KODESH_W + 15, xd1 = X_KODESH_W + 25;
  const fy0 = Y_TAW_S + 0.5, fy1 = fy0 + 3, fx1 = xd0 - 2, fx0 = fx1 - run;
  add('heichal.taim.roof-stair', { en: "Stair from the ta'im roofs to the Aliyah door", he: 'מעלות לפתח העליה', kind: 'stair',
    b: H(fx0, fy0, zT, xd1, Y_KOD_S - HEI_WALL_UPPER, Z_ALIYAH),
    src: ['Middot 4:5', 'Rambam BhB 4:12', 'Part VII §22'], c: 'reconstruction',
    der: `${(Z_ALIYAH - zT) / STEP_RISE} half-steps (+${zT} → +${Z_ALIYAH}) along the south roof, rising east (Middot 4:5 "he walked in the south, facing east, to the door of the aliyah"), then a landing to the door ⚙`,
    fc: { route: 'explicit', existence: 'reconstruction', geometry: 'reconstruction' },
    p: { climb: { box: bx(fx0, fy0, zT, fx1, fy1, Z_ALIYAH), steps: (Z_ALIYAH - zT) / STEP_RISE, rise: STEP_RISE, tread: STEP_TREAD, ascentHeading: 90,
        from: [fx0, (fy0 + fy1) / 2, zT], to: [fx1, (fy0 + fy1) / 2, Z_ALIYAH] },
      landing: { box: bx(fx1, fy0, Z_ALIYAH - 1, xd1, Y_KOD_S - HEI_WALL_UPPER, Z_ALIYAH), topZ: Z_ALIYAH, openBelow: true, note: 'carried on piers so the F1 windows behind it still open to the air' },
      door: 'heichal.aliyah.door' } });
}
// fenestration (Part VII §22)
add('heichal.windows.f1', { en: 'F1 — the Heichal windows (shekufim atumim)', he: 'חלונות שקופים אטומים', kind: 'opening',
  b: H(X_KODESH_W + 4, Y_KOD_S - HEI_WALL_UPPER, F1_BAND[0], X_KODESH_E - 4, Y_KOD_N + HEI_WALL_UPPER, F1_BAND[1]),
  src: ['1 Melachim 6:4', 'Menachot 86b', 'Rashi ad loc.', 'Part VII §22'], c: 'reconstruction',
  der: `high band of the Kodesh N/S walls (+${F1_BAND[0]} to +${F1_BAND[1]}), above the ta'im roofline (+${Z_TAIM_ROOF}) as Part VII §22 requires; count unstated → 5 per side ⚙`,
  fc: { highInKodeshWalls: 'explicit', aboveTaimRoofline: 'explicit', splay: 'explicit', band: 'reconstruction', count: 'reconstruction' },
  p: { perSide: 5, widthInside: 1, widthOutside: 2, splay: 'narrow inside, wide outside', band: F1_BAND, opensTo: 'the open air above the ta\'im roofs' } });
add('heichal.windows.f2', { en: 'F2 — the crown windows over the entrance', he: 'חלונות העטרות', kind: 'opening',
  b: H(X_KODESH_E, AXIS_Y - 4, Z_HEICHAL + 26, X_ULAM_IN_W, AXIS_Y + 4, Z_HEICHAL + 30), src: ['Middot 3:8', 'Bartenura ad loc.', 'Zechariah 6:14', 'Part XI lock #28'], c: 'reconstruction',
  der: 'two windows in the Heichal E wall above the great gate, facing the Ulam; size ⚙',
  p: { windows: [bx(X_KODESH_E, AXIS_Y - 4, Z_HEICHAL + 26, X_ULAM_IN_W, AXIS_Y - 2, Z_HEICHAL + 30), bx(X_KODESH_E, AXIS_Y + 2, Z_HEICHAL + 26, X_ULAM_IN_W, AXIS_Y + 4, Z_HEICHAL + 30)], contents: 'Zechariah\'s memorial crowns' } });
add('heichal.ulam-curtain', { en: 'Curtain of the Ulam opening', he: 'פרוכת האולם', kind: 'curtain', b: H(X_ULAM_IN_E - TEFACH, AXIS_Y - ULAM_OPEN_W / 2, Z_HEICHAL, X_ULAM_IN_E, AXIS_Y + ULAM_OPEN_W / 2, Z_HEICHAL + ULAM_OPEN_H),
  src: ['Yoma 54a', 'Rambam Klei HaMikdash 7:16'], c: 'reconstruction', der: 'one of the 13 parochot; hung on the inner face of the opening ⚙', p: { size: [ULAM_OPEN_H, ULAM_OPEN_W] } });
const CURTAIN_CLEAR = 0.1;               // ⚙ ≈5 cm: a hanging curtain stands clear of the wall face so its folds never touch it
add('heichal.gate-curtain', { en: 'Curtain of the Heichal gate', he: 'פרוכת שער ההיכל', kind: 'curtain', b: H(X_ULAM_IN_W + CURTAIN_CLEAR, AXIS_Y - GATE_W / 2 - 1, Z_HEICHAL, X_ULAM_IN_W + CURTAIN_CLEAR + TEFACH, AXIS_Y + GATE_W / 2 + 1, Z_HEICHAL + GATE_H + 1),
  src: ['Yoma 54a'], c: 'reconstruction', der: `one of the 13; before the outer doors, ${CURTAIN_CLEAR} clear of the wall face ⚙`, p: { wallClearance: CURTAIN_CLEAR, wallFaceX: X_ULAM_IN_W } });

// ===== 3.7b Stations, routes and channels (people / sim anchors) =============
// the 24 night-watch posts (Middot 1:1; Tamid 1:1; Rambam BhB 8:4–9): 3 kohanic, 21 Levite. Places sourced, exact spots ⚙
{
  const el_ = (id) => elements[id];
  const ctr = (id, z) => { const b = el_(id).box; return [r6((b.min[0] + b.max[0]) / 2), r6((b.min[1] + b.max[1]) / 2), z ?? b.min[2]]; };
  const azGateOut = (key, side) => [AZ_GATE_CX[{ delek: 0, bechorot: 1, mayim: 2, nitzotz: 0, korban: 1 }[key]], side === 'S' ? Y_CX_S - STEP_TREAD / 2 : Y_CX_N + STEP_TREAD / 2, Z_AZ - STEP_RISE];
  const posts = [
    // kohanim (Middot 1:1): two upper chambers and the Moked (its chol half — they sleep there)
    { id: 'beit-avtinas', by: 'kohanim', place: 'Beit Avtinas (upper chamber over the Water Gate)', pos: ctr('azarah.beit-avtinas') },
    { id: 'beit-hanitzotz', by: 'kohanim', place: 'Beit HaNitzotz (upper storey over the Nitzotz gate)', pos: ctr('azarah.beit-hanitzotz') },
    { id: 'beit-hamoked', by: 'kohanim', place: 'Beit HaMoked (chol half)', pos: [MOKED_CX, MOKED_KODESH_Y + 4, Z_AZ] },
    // Levites: the 5 Mount gates
    { id: 'gate-chuldah-w', by: 'leviim', place: 'Chuldah gate (west)', pos: [chuldahX[0] + GATE_W / 2, 1, r6(zChuldah)] },
    { id: 'gate-chuldah-e', by: 'leviim', place: 'Chuldah gate (east)', pos: [chuldahX[1] + GATE_W / 2, 1, r6(zChuldah)] },
    { id: 'gate-kiponus', by: 'leviim', place: 'Kiponus gate', pos: [2, KIPONUS_Y, Z_MOUNT] },
    { id: 'gate-tadi', by: 'leviim', place: 'Tadi gate', pos: [MOKED_CX, MOUNT - 2, Z_MOUNT] },
    { id: 'gate-shushan', by: 'leviim', place: 'Shushan gate', pos: [MOUNT - 2, AXIS_Y, Z_MOUNT] },
    // the Mount's four corners, inside
    ...[['mount-sw', 2, 2], ['mount-se', MOUNT - 2, 2], ['mount-nw', 2, MOUNT - 2], ['mount-ne', MOUNT - 2, MOUNT - 2]].map(([id, x, y]) => ({ id, by: 'leviim', place: `corner of Har HaBayit (${id.slice(6).toUpperCase()}), inside`, pos: [x, y, Z_MOUNT] })),
    // 5 Azarah gates, outside (the kohanim hold the Moked and Nitzotz gates — Rambam BhB 8:8)
    { id: 'gate-delek', by: 'leviim', place: "Sha'ar HaDelek, outside", pos: azGateOut('delek', 'S') },
    { id: 'gate-bechorot', by: 'leviim', place: "Sha'ar HaBechorot, outside", pos: azGateOut('bechorot', 'S') },
    { id: 'gate-mayim', by: 'leviim', place: "Sha'ar HaMayim, outside", pos: azGateOut('mayim', 'S') },
    { id: 'gate-korban', by: 'leviim', place: "Sha'ar HaKorban, outside", pos: azGateOut('korban', 'N') },
    { id: 'gate-nikanor', by: 'leviim', place: "Sha'ar Nikanor, outside (head of the 15 steps)", pos: [X_EN_W + 1, AXIS_Y, Z_EY] },
    // the Azarah's four corners, outside (no sitting in the Azarah — Rambam BhB 8:8)
    { id: 'azarah-sw', by: 'leviim', place: 'SW corner of the Azarah, outside', pos: [X_CX_W - 2, Y_CX_S - 2, Z_MOUNT] },
    { id: 'azarah-nw', by: 'leviim', place: 'NW corner of the Azarah, outside', pos: [X_CX_W - 2, Y_CX_N + 2, Z_MOUNT] },
    { id: 'azarah-ne', by: 'leviim', place: 'NE corner of the Azarah, outside', pos: [X_AZ_E + COURT_WALL_T / 2, Y_CX_N + 2, Z_MOUNT] },
    { id: 'azarah-se', by: 'leviim', place: 'SE corner of the Azarah, outside', pos: [X_AZ_E + COURT_WALL_T / 2, Y_CX_S - 2, Z_MOUNT] },
    // the three chambers' posts
    { id: 'lishkat-hakorban', by: 'leviim', place: 'Lishkat HaKorban', pos: el_('mount.chamber.korban').params.guardPost },
    { id: 'lishkat-haparochet', by: 'leviim', place: 'Lishkat HaParochet', pos: el_('mount.chamber.parochet').params.guardPost },
    { id: 'achorei-beit-hakaporet', by: 'leviim', place: 'behind the Beit HaKaporet (the 11-amah western strip, at the lul)', pos: [r6((X_AZ_W + X_HEI_W) / 2), AXIS_Y, Z_AZ] },
  ];
  const xs = posts.map((p) => p.pos[0]), ys = posts.map((p) => p.pos[1]), zs = posts.map((p) => p.pos[2]);
  add('mount.watch-posts', { en: 'The 24 night-watch posts', he: 'משמרות הלילה', kind: 'zone',
    b: [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.min(...zs), Math.max(...xs) + 1, Math.max(...ys) + 1, Math.max(...zs) + 2],
    src: ['Middot 1:1–2', 'Tamid 1:1', 'Rambam BhB 8:4–10', 'Part I §2 (24 posts)', 'Part VIII §28'], c: 'reconstruction',
    der: '3 kohanic + 21 Levite posts at the places Middot 1:1 names; the spot at each place ⚙',
    fc: { places: 'explicit', count: 'explicit', positions: 'reconstruction' },
    p: { count: posts.length, posts, patrol: 'the Ish Har HaBayit makes the rounds with torches (Middot 1:2; Rambam BhB 8:10)' } });
  // the Yom Kippur lottery station: "he came to the east of the Azarah, to the north of the altar … and the kalpi was there" (Yoma 3:9 [37a])
  add('azarah.stations', { en: 'Service stations in the Azarah', he: 'מקומות בעזרה', kind: 'zone',
    b: [X_EK_W + 3, Y_ALT_N + 5.5, Z_AZ, X_EK_W + 8, Y_ALT_N + 9.5, Z_AZ + 2],
    src: ['Yoma 3:9 (37a)', 'Yoma 39a', 'Part VI App. B'], c: 'reconstruction',
    der: '"the east of the Azarah, to the north of the altar" (Yoma 37a): in Ezrat Kohanim, opposite the altar\'s north part ⚙',
    fc: { eastOfAzarahNorthOfAltar: 'explicit', position: 'reconstruction' },
    p: { kalpi: { pos: [X_EK_W + 5.5, Y_ALT_N + 7.5, Z_AZ], heading: 270, note: 'the KG with the segan at his right and the head of the beit av at his left; the two goats and the kalpi with its two lots (Yoma 3:9 [37a])' } } });
}
// the amah — the open water channel of the Azarah (Middot 3:2; Tamid 5:5; Pesachim 5:8; report §9.4 #4). Course ⚙
{
  const W_AM = 1, xA = ALT_X0 - 2, yA = Y_KEV_FOOT - 7, xG = AZ_GATE_CX[2];
  const path = [
    { at: [ALT_X0 - 0.5, ALT_Y0 - 0.5, Z_AZ - 4], covered: true, note: 'the shit under the SW corner: the yesod bloods from the shitin join the amah here (Middot 3:2–3)' },
    { at: [xA, ALT_Y0 - 0.5, Z_AZ - 1], open: true },
    { at: [xA, yA, Z_AZ - 1], open: true, note: 'west of the yesod ramp and the tables' },
    { at: [xG, yA, Z_AZ - 1], open: true, note: 'passes 7 south of the kevesh foot (the spilled coals are swept into it — Tamid 5:5)' },
    { at: [xG, Y_AZ_S, Z_AZ - 1.5], covered: true, note: 'under the Water Gate threshold (REbY: "through it the water trickles" — Middot 2:6)' },
    { at: [xG, Y_CX_S, Z_AZ - 2], covered: true },
    { at: [xG, Y_CX_S - 20, Z_MOUNT - 3], covered: true, note: 'under the Mount' },
    { at: [MOUNT + MOUNT_WALL_T, Y_CX_S - 20, Z_MOUNT - 10], covered: true, note: 'out through the east wall toward Nachal Kidron (context.kidron); the effluent sold to gardeners (Yoma 58b)' },
  ];
  add('azarah.amah-channel', { en: 'The amah (water channel of the Azarah)', he: 'האמה', kind: 'fixture',
    b: [xA - W_AM / 2, Y_CX_S - 20, Z_MOUNT - 10, MOUNT + MOUNT_WALL_T, ALT_Y0, Z_AZ],
    src: ['Middot 3:2', 'Tamid 5:5', 'Pesachim 5:8', 'Yoma 58b', 'Middot 2:6', 'Part III §9.4'], c: 'reconstruction',
    der: `open channel ${W_AM} wide in the pavement from the altar's SW corner, past the kevesh foot, out under the Water Gate, then covered under the Mount to the Kidron; course ⚙`,
    fc: { existence: 'explicit', swCornerJunction: 'explicit', toKidron: 'explicit', course: 'reconstruction', size: 'reconstruction' },
    p: { width: W_AM, depth: 1, path,
      openSegments: path.filter((q) => q.open).map((q) => q.at).reduce((acc, a, i, arr) => (i + 1 < arr.length ? [...acc, bx(Math.min(a[0], arr[i + 1][0]) - W_AM / 2, Math.min(a[1], arr[i + 1][1]) - W_AM / 2, Z_AZ - 1, Math.max(a[0], arr[i + 1][0]) + W_AM / 2, Math.max(a[1], arr[i + 1][1]) + W_AM / 2, Z_AZ)] : acc), []),
      uses: 'carries the altar bloods out (Middot 3:2); receives the spilled kav of coals (Tamid 5:5); flushes the court when unplugged (Pesachim 5:8)',
      feeder: 'the En-Eitam aqueduct enters at Sha\'ar HaMayim (Part III §9.4 #2) — junction not modeled' } });
}
// the dawn inspection circuit (Tamid 1:3; Rambam BhB 8:11): from the pishpash two companies with torches, one by the east and one
// by the west, "along the achsadra", meeting at the chamber of the chavitin bakers. The colonnade itself is not built: Rambam
// BhB 1:9 allows only stone exedras in the Azarah and no source places or sizes one ⚙
{
  const start = [MOKED_CX + 2.5, Y_MITB_S - 0.5, Z_AZ], meet = [X_AZ_E - NIK_CH_DEPTH - 0.5, AXIS_Y - GATE_W / 2 - 1 - NIK_CH_LEN / 2, Z_EY];
  const xEK = X_EK_W + 5.5, yPass = (Y_BODY_N + GAZIT.y0) / 2, xStrip = (X_AZ_W + X_HEI_W) / 2, yS = Y_ULAM_S - 1.5, ySm = Y_KEV_FOOT - 6;
  const routes = {
    east: [start, [xEK, start[1], Z_AZ], [xEK, meet[1], Z_AZ], meet],
    west: [start, [GOLAH.x1 + 3, start[1], Z_AZ], [GOLAH.x1 + 3, yPass, Z_AZ], [xStrip, yPass, Z_AZ], [xStrip, yS, Z_AZ], [ALT_X0 - 1, yS, Z_AZ], [ALT_X0 - 1, ySm, Z_AZ], [xEK, ySm, Z_AZ], [xEK, meet[1], Z_AZ], meet],
  };
  const all = [...routes.east, ...routes.west];
  add('azarah.achsadra-route', { en: 'The dawn inspection circuit (along the achsadra)', he: 'בדיקת העזרה באכסדרא', kind: 'zone',
    b: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Z_EY, Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1])), Z_AZ + 2],
    src: ['Tamid 1:3', 'Rambam BhB 8:11', 'Rambam BhB 1:9', 'Middot 1:7'], c: 'reconstruction',
    der: 'two torch-lit companies from the Moked pishpash, east and west round the court, meeting at the chavitin bakers\' chamber; polylines ⚙ kept clear of every structure',
    fc: { startAndMeeting: 'explicit', twoCompanies: 'explicit', path: 'reconstruction', colonnade: 'reconstruction' },
    p: { routes, start: 'azarah.gate.moked params.pishpash', meet: 'azarah.chamber.chavitin', torches: 2, onShabbat: 'no torches; they inspect by the lamps lit from erev Shabbat (Rambam BhB 8:12)',
      colonnade: 'not built — Tamid 1:3 names an achsadra; Rambam BhB 1:9 allows stone exedras in the Azarah; none is placed or sized by the sources' } });
}

// ===== 3.8 Context (meter-native → amot with the page's AMAH) ===============
const eastFace = MOUNT + MOUNT_WALL_T;           // 505
const mE = (m) => eastFace + m / AMAH;           // meters east of the E wall → site X
const zM = (asl) => (asl - DATUM_ASL) / AMAH;    // ASL → site Z
function topoAt(side, m) { const P = TOPO[side]; if (m <= P[0][0]) return P[0][1]; for (let i = 1; i < P.length; i++) if (m <= P[i][0]) { const [a, za] = P[i - 1], [b, zb] = P[i]; return za + (zb - za) * (m - a) / (b - a); } return P[P.length - 1][1]; }
const causewayEndM = (() => { for (let m = KIDRON_THALWEG_M; m < 1500; m += 0.5) if (topoAt('E', m) >= DATUM_ASL) return m; return 480; })();
// The Parah burning place (Parah 3:8–9): the heifer lies ON the arrangement ("נתנוה על גב המערכה", head south, face west), the kohen
// "stands in the east facing west", slaughters, sprinkles toward the KhK, wipes his hand on her body — and then "descends" (ירד) to
// kindle the fire. So during the sprinkling he stands on the arrangement, at its east end, east of the heifer ⚙ (place on the top).
const PARAH_X = mE(PARAH_SITE_M), Z_CREST = zM(topoAt('E', PARAH_SITE_M));
const PYRE = { x0: PARAH_X - PARAH_PYRE.back, x1: PARAH_X - PARAH_PYRE.front, top: Z_CREST + PARAH_PYRE.h };
const PARAH_STAND = [r6(PYRE.x1 - PARAH_KOHEN_IN), AXIS_Y, r6(PYRE.top)];                       // the kohen's feet, on the arrangement
const PARAH_EYE = [PARAH_STAND[0], AXIS_Y, r6(PYRE.top + EYE_M / AMAH)];                         // his eye at the sprinkling
const PARAH_GROUND_EYE = [r6(PARAH_X), AXIS_Y, r6(zM(topoAt('E', PARAH_SITE_M) + EYE_M))];        // a viewer on the crest ground, no pyre
const HEIFER_BOX = bx(PYRE.x1 - PARAH_KOHEN_IN - 0.5 - HEIFER.w, AXIS_Y - HEIFER.len / 2, PYRE.top, PYRE.x1 - PARAH_KOHEN_IN - 0.5, AXIS_Y + HEIFER.len / 2, PYRE.top + HEIFER.h);
// the Kiponus approach (unsourced): level with the threshold from the gate west to where the west slope regains the platform level
const kiponusEndM = (() => { for (let m = TOPO.W[1][0]; m < 600; m += 0.5) if (topoAt('W', m) >= DATUM_ASL) return m; return 235; })();
add('context.terrain', { en: 'Surrounding topography (approximate)', he: 'סביבת הר הבית', kind: 'zone',
  b: [-MOUNT_WALL_T - 600 / AMAH, -MOUNT_WALL_T - 400 / AMAH, zM(660), eastFace + 1500 / AMAH, MOUNT + MOUNT_WALL_T + 600 / AMAH, zM(820)],
  src: ['Brief: platform ≈ 740 m ASL, Kidron bed 660–680 m, Mount of Olives ridge 800–818 m 700–900 m east'], c: 'reconstruction',
  der: 'profiles: meters outward from each wall face → elevation ASL; Z = (ASL − 740) / AMAH',
  p: { datumASL: DATUM_ASL, amahMeters: AMAH, profilesMeters: TOPO, toSite: 'E: X = 505 + m/AMAH; W: X = −5 − m/AMAH; S: Y = −5 − m/AMAH; N: Y = 505 + m/AMAH; Z = (ASL − 740)/AMAH',
    kidronThalweg: { x: r6(mE(KIDRON_THALWEG_M)), zByY: [[MOUNT + 400 / AMAH, r6(zM(682))], [-400 / AMAH, r6(zM(668))]], note: 'falls southward; ancient bed ~10 m below today\'s fill' } },
  n: 'Massing context only. Real ground east of the wall, real Ophel grade south; the 500-amah square is the halachic Mount inside Herod\'s larger esplanade (not modeled).' });
add('context.kidron', { en: 'Nachal Kidron', he: 'נחל קדרון', kind: 'zone', b: [mE(60), -400 / AMAH, zM(668), mE(330), MOUNT + 400 / AMAH, 0],
  src: ['Middot 3:2', 'Yoma 58b', 'Shekalim 4:2'], c: 'reconstruction', der: `valley ${60}–${330} m east of the wall; thalweg ${KIDRON_THALWEG_M} m at ≈675 m ASL`,
  p: { thalwegX: r6(mE(KIDRON_THALWEG_M)), thalwegZ: r6(zM(675)), receives: 'the altar drain via the amah channel' } });
add('context.har-hamishchah', { en: 'Har HaMishchah (Mount of Olives)', he: 'הר המשחה', kind: 'zone', b: [mE(330), -400 / AMAH, zM(700), mE(1000), MOUNT + 400 / AMAH, zM(812)],
  src: ['Middot 1:3', 'Middot 2:4', 'Parah 3:6–9'], c: 'reconstruction', der: `west slope from the Kidron to the crest ≈808 m at ${PARAH_SITE_M} m east`,
  p: { crestX: r6(mE(PARAH_SITE_M)), crestZ: r6(zM(808)) } });
add('context.parah-causeway', { en: 'The Parah causeway (arches upon arches)', he: 'כבש הפרה', kind: 'ramp',
  b: [eastFace, AXIS_Y - GATE_W / 2, r6(zM(675)), r6(mE(causewayEndM)), AXIS_Y + GATE_W / 2, 0],
  src: ['Parah 3:6', 'Middot 1:3', 'Shekalim 4:2'], c: 'reconstruction',
  der: `level deck at the Shushan threshold (Z0) on the axis, from the gate to where the slope regains 740 m (${r6(causewayEndM)} m east)`,
  p: { deckZ: 0, width: GATE_W, tiers: 2, form: 'arches upon arches, each arch over the pier below ("kippah keneged ha\'atum") — against a deep grave',
    parapet: { thickness: 1, height: r6(ROOF_PARAPET_H), placement: 'inside the 10-amah width (clear deck 8)', note: 'was "parapet: 1" — that is the thickness; the height is 10 tefachim (Devarim 22:8) ⚙' },
    overhangs: [
      { part: 'parapets', box: bx(eastFace, AXIS_Y - GATE_W / 2, 0, r6(mE(causewayEndM)), AXIS_Y + GATE_W / 2, r6(ROOF_PARAPET_H)), note: 'two 1-amah parapets on the deck edges, 10 tefachim above the deck (Z0)' },
      { part: 'lower tier', box: bx(eastFace, AXIS_Y - GATE_W / 2 - 0.5, r6(zM(675)), r6(mE(causewayEndM)), AXIS_Y + GATE_W / 2 + 0.5, 0), note: 'the lower arcade is ½ amah wider each side than the upper (as built by build-mount) ⚙' },
      { part: 'string course at the tier line', projection: 0.85, note: 'projects 0.85 each side of the deck width (build-mount) ⚙' }],
    continuesAs: 'path up the slope to the burning place', alt: 'a deck descending/climbing with the terrain' } });
add('context.parah.pyre', { en: 'The Parah burning place on Har HaMishchah', he: 'מקום שריפת הפרה', kind: 'fixture',
  b: [r6(PYRE.x0), AXIS_Y - PARAH_PYRE.halfW, r6(Z_CREST), r6(PYRE.x1), AXIS_Y + PARAH_PYRE.halfW, r6(PYRE.top)],
  src: ['Parah 3:8–9', 'Middot 2:4'], c: 'reconstruction',
  der: 'on the axis at the crest; the arrangement "like a tower with windows, its face west" (Parah 3:8); the heifer on its top, the kohen standing on it at its east end facing west (Parah 3:9 — he "descends" afterwards) ⚙',
  fc: { onTheCrest: 'reconstruction', faceWest: 'explicit', heiferOnTop: 'explicit', kohenEastOfHer: 'explicit', kohenRaised: 'derived', size: 'reconstruction' },
  p: { woods: 'cedar, pine, cypress, smooth fig (Parah 3:8)', facing: 270, mikveh: 'a beit tevilah there (Parah 3:7)', topZ: r6(PYRE.top),
    heifer: { box: HEIFER_BOX, head: 'south', faces: 270, note: 'bound and laid on the arrangement, head south, face west (Parah 3:9); envelope ⚙' },
    kohenStand: PARAH_STAND, kohenEye: PARAH_EYE, groundEye: PARAH_GROUND_EYE,
    kohenNote: 'Parah 3:9: the heifer is put "on the arrangement"; the kohen "stands in the east, facing west", slaughters, sprinkles seven times toward the KhK, wipes his hand on her body, and then "descended (ירד) and kindled the fire" — he stood up on the arrangement beside her. kohenEye is that eye, over the heifer, for the sprinkling (Middot 2:4: "he aims and sees the entrance of the Heichal"); the pyre itself is under his feet and no longer between him and the Heichal (it was 4.7 amot above a ground eye)',
    groundEyeNote: 'a viewer standing on the crest ground 1 amah east of the arrangement\'s place, when no pyre is built — the daily viewpoint (anchors, map); the Parah line also passes from here (parahSightLine({ stand: \'ground\' }))' } });
for (const [k, gx] of [['w', chuldahX[0]], ['e', chuldahX[1]]]) {
  // the stair: a whole number of risers, each within 1% of ½ (Middot 2:3) since the drop is the real Ophel–platform difference; treads ½
  const zP = zChuldah, runIn = 45, rise = -zP, risers = Math.round(rise / STEP_RISE), riseEach = rise / risers, stairRun = risers * STEP_TREAD;
  add(`context.chuldah.tunnel-${k}`, { en: `Chuldah passage (${k === 'w' ? 'west' : 'east'})`, he: 'מבוא שערי חולדה', kind: 'zone',
    b: [gx, -MOUNT_WALL_T, zP, gx + GATE_W, runIn + stairRun, 0], src: ['Middot 1:3', 'Rambam BhB 6:9', 'Parah 3:3'], c: 'reconstruction',
    der: `portal on the S wall at the Ophel grade (${r6(zP)}); level passage north ${runIn} under the vaults, then ${risers} steps (rise ${r6(riseEach)} ≈ ½, tread ½) up to the Mount`,
    p: { portal: [gx + GATE_W / 2, -MOUNT_WALL_T, r6(zP)], level: bx(gx, -MOUNT_WALL_T, zP, gx + GATE_W, runIn, zP + GATE_H),
      stairPath: { from: [gx + GATE_W / 2, runIn, r6(zP)], to: [gx + GATE_W / 2, r6(runIn + stairRun), 0], risers, rise: r6(riseEach), tread: STEP_TREAD,
        note: 'whole risers: the drop (real Ophel grade − platform, AMAH-dependent) is divided evenly, each rise within 1% of Middot 2:3\'s ½ amah' },
      exit: [gx + GATE_W / 2, r6(runIn + stairRun), 0], exitSouth: [gx + GATE_W / 2, -MOUNT_WALL_T, r6(zP)], sanctity: 'mechilot opening to Har HaBayit are chol (Rambam BhB 6:9)' },
    n: 'Where the Chuldah passages exit south: the portals open onto the Ophel ~13 m below the platform; length and depth from the real elevation difference ⚙.' });
}
{
  const mW = (m) => -MOUNT_WALL_T - m / AMAH, half = GATE_W / 2 + 1;
  const lowASL = Math.min(...TOPO.W.filter(([m]) => m <= kiponusEndM).map(([, z]) => z));
  add('context.kiponus-approach', { en: 'The Kiponus approach (bridge to the upper city)', he: 'מבוא שער קיפונוס', kind: 'ramp',
    b: [r6(mW(kiponusEndM)), KIPONUS_Y - half, r6(zM(lowASL)), -MOUNT_WALL_T, KIPONUS_Y + half, 0], src: ['Middot 1:3', 'Middot 2:3'], c: 'reconstruction',
    der: `level deck at the Kiponus threshold (Z0) from the gate west across the Tyropoeon to where the west slope regains 740 m (${r6(kiponusEndM)} m); clear width ${GATE_W} between 1-amah parapets ⚙`,
    fc: { gateServesEntry: 'explicit', existence: 'reconstruction', form: 'reconstruction', length: 'reconstruction' },
    p: { deckZ: 0, clearWidth: GATE_W, width: GATE_W + 2, endM: r6(kiponusEndM), endX: r6(mW(kiponusEndM)), gate: 'mount.gate.kiponus',
      zone: 'outside', zoneNote: 'the deck is outside Har HaBayit, in the city: Jerusalem\'s rung (2), the "outside" zone. It is not part of the gate-kiponus zone (rung 3); unlike the Chuldah passages it does not run under the Mount (Rambam BhB 6:9)',
      parapet: { thickness: 1, height: r6(ROOF_PARAPET_H), placement: 'outside the gate width (each side)' },
      overhangs: [{ part: 'parapets', box: bx(mW(kiponusEndM), KIPONUS_Y - half, 0, -MOUNT_WALL_T, KIPONUS_Y + half, ROOF_PARAPET_H), note: '10 tefachim above the deck' }],
      form: 'a single tier of arches (build-mount: bays 18, piers 4, an opening over the Tyropoeon street) ⚙ — one tier, so as not to read as the Parah\'s halachic double arcade (Parah 3:6)',
      crosses: `the Tyropoeon (≈${lowASL} m at ${TOPO.W[1][0]} m from the wall; the threshold is 740 m)` },
    n: 'No source describes the western approach. The gate "serves entry and exit" (Middot 1:3) at the platform level, about 18 m above the Tyropoeon at the wall\'s foot, so a bridge or ramp is implied; a level deck like the Parah causeway is the modest reading.' });
}

// -----------------------------------------------------------------------------
// 4. ZONES (ARCHITECTURE.md §8) — boxes [[min],[max]], priority (higher wins), floorZ
// -----------------------------------------------------------------------------
const zones = {};
const zb = (e) => [e.box.min, e.box.max];
const zbx = (...a) => { const b = bx(...a); return [b.min, b.max]; };
function zone(id, priority, floorZ, boxes) { zones[id] = { boxes, priority, floorZ }; }
const ZTOP = 140;
zone('outside', 0, null, [zbx(-3000, -3000, -300, 6000, 4000, 600)]);
zone('kidron', 2, r6(zM(675)), [zb(elements['context.kidron'])]);
zone('har-hamishchah', 2, r6(zM(808)), [zb(elements['context.har-hamishchah'])]);
zone('parah-causeway', 4, 0, [zbx(eastFace, AXIS_Y - GATE_W / 2, -1, mE(causewayEndM), AXIS_Y + GATE_W / 2, 6)]);
zone('har-habayit', 5, Z_MOUNT, [zbx(-MOUNT_WALL_T, -MOUNT_WALL_T, -40, MOUNT + MOUNT_WALL_T, MOUNT + MOUNT_WALL_T, ZTOP)]);
zone('stoa', 8, Z_MOUNT, ['south', 'north', 'west', 'east'].map((s) => zb(elements[`mount.stoa.${s}`])));
zone('chel', 10, Z_MOUNT, [zbx(X_CX_W - CHEL, Y_CX_S - CHEL, -1, X_CX_E + CHEL, Y_CX_N + CHEL, 12),
  zbx(MOKED_BOX.x0 - CHEL, Y_CX_N, -1, MOKED_BOX.x1 + CHEL, MOKED_BOX.y1 + CHEL, 12), zbx(GAZIT.x0 - CHEL, GAZIT.y0 - CHEL, -1, X_CX_W, GAZIT.y1 + CHEL, 12)]);
zone('soreg', 12, Z_MOUNT, pathSegments().map(([a, b]) => zbx(Math.min(a[0], b[0]) - 0.75, Math.min(a[1], b[1]) - 0.75, -1, Math.max(a[0], b[0]) + 0.75, Math.max(a[1], b[1]) + 0.75, 4)));
const gz = (id, e, pad = 3, zpad = 2) => zbx(e.box.min[0] - (e.box.max[0] - e.box.min[0] < 6 ? pad : 0), e.box.min[1] - (e.box.max[1] - e.box.min[1] < 6 ? pad : 0), e.box.min[2] - 1,
  e.box.max[0] + (e.box.max[0] - e.box.min[0] < 6 ? pad : 0), e.box.max[1] + (e.box.max[1] - e.box.min[1] < 6 ? pad : 0), e.box.max[2] + zpad);
zone('gate-shushan', 30, Z_MOUNT, [gz('', elements['mount.gate.shushan'])]);
zone('gate-chuldah-w', 30, zChuldah, [gz('', elements['mount.gate.chuldah-w']), zb(elements['context.chuldah.tunnel-w'])]);
zone('gate-chuldah-e', 30, zChuldah, [gz('', elements['mount.gate.chuldah-e']), zb(elements['context.chuldah.tunnel-e'])]);
zone('gate-kiponus', 30, Z_MOUNT, [gz('', elements['mount.gate.kiponus'])]);   // the approach deck west of it is 'outside' (Jerusalem's rung)
zone('gate-tadi', 30, Z_MOUNT, [gz('', elements['mount.gate.tadi'])]);
zone('ezrat-nashim', 20, Z_EN, [zbx(X_EN_W, Y_AZ_S, Z_EN - 1, X_EN_E, Y_AZ_N, ZTOP)]);
zone('en-gate-east', 30, Z_EN, [gz('', elements['en.gate.east'])]);
zone('en-chamber-wood', 25, Z_EN, [zb(elements['en.chamber.wood'])]);
zone('en-chamber-lepers', 25, Z_EN, [zb(elements['en.chamber.lepers'])]);
zone('en-chamber-nazirites', 25, Z_EN, [zb(elements['en.chamber.nazirites'])]);
zone('en-chamber-oil', 25, Z_EN, [zb(elements['en.chamber.oil'])]);
zone('en-gallery', 26, galZ0, elements['en.gallery'].params.segments.map((s) => [s.min, [s.max[0], s.max[1], s.max[2] + 3]]));
zone('fifteen-steps', 27, Z_EN, [zbx(X_EN_W, AXIS_Y - S15_OUTER, Z_EN - 0.5, X_EN_W + S15_OUTER, AXIS_Y + S15_OUTER, Z_EY + 6)]);
zone('music-chambers', 28, Z_EN, elements['en.music-chambers'].params.rooms.flatMap((r) => [[r.box.min, r.box.max], [r.door.min, r.door.max]]));
zone('nikanor', 35, Z_EY, [zbx(X_AZ_E - 1, AXIS_Y - GATE_W / 2, Z_EY - 0.5, X_EN_W + 1, AXIS_Y + GATE_W / 2, Z_EY + GATE_H)]);
zone('azarah', 15, Z_AZ, [zbx(X_AZ_W, Y_AZ_S, Z_EY - 0.5, X_AZ_E, Y_AZ_N, ZTOP)]);
zone('ezrat-yisrael', 22, Z_EY, [zbx(X_EY_W, Y_AZ_S, Z_EY - 0.5, X_AZ_E, Y_AZ_N, 60)]);
zone('ezrat-kohanim', 22, Z_AZ, [zbx(X_EK_W, Y_AZ_S, Z_EY + 0.5, X_EY_W, Y_AZ_N, 60)]);
zone('slaughter-zone', 21, Z_AZ, [zbx(X_ULAM_E, Y_ALT_N, Z_AZ - 0.5, X_AZ_E, Y_AZ_N, 50)]);
zone('bein-haulam-lamizbeach', 23, Z_AZ, [zbx(X_ULAM_E, Y_AZ_S, Z_AZ - 0.5, X_ALT_W, Y_AZ_N, 60)]);
zone('mizbeach', 30, Z_AZ, [zbx(ALT_X0, ALT_Y0, Z_AZ - 0.5, ALT_X0 + ALTAR, ALT_Y0 + ALTAR, Z_KEREN + 8)]);
zone('kevesh', 31, Z_AZ, [zbx(X_KEV_W - 2, Y_KEV_FOOT, Z_AZ - 0.5, X_KEV_E + 2, Y_KEV_TOP, Z_ALT_TOP + 6)]);
zone('kiyor', 32, Z_AZ, [zbx(KIY.cx - 4, KIY.cy - KIYOR_D / 2 - 5, Z_AZ - 0.5, KIY.cx + 4, KIY.cy + KIYOR_D / 2 + 1, Z_AZ + 8)]);
zone('ulam-steps', 30, Z_AZ, [zbx(X_ULAM_E, AXIS_Y - ULAM_STEPS_W / 2, Z_AZ - 0.5, X_ULAM_E + ULAM_RUN, AXIS_Y + ULAM_STEPS_W / 2, Z_HEICHAL + 6)]);
zone('ulam', 40, Z_HEICHAL, [zbx(X_ULAM_IN_W, Y_ULAM_S + ULAM_END_WALL, Z_HEICHAL - 0.5, X_ULAM_E, Y_ULAM_N - ULAM_END_WALL, Z_KOD_TOP)]);
zone('beit-hachalifot', 41, Z_HEICHAL, [zb(elements['heichal.chalifot.n']), zb(elements['heichal.chalifot.s'])]);
zone('heichal', 40, Z_HEICHAL, [zbx(X_KODESH_W, Y_KOD_S, Z_HEICHAL - 0.5, X_KODESH_E, Y_KOD_N, Z_KOD_TOP), zbx(X_KODESH_E, AXIS_Y - GATE_W / 2, Z_HEICHAL - 0.5, X_ULAM_IN_W, AXIS_Y + GATE_W / 2, Z_HEICHAL + GATE_H)]);
zone('amah-traksin', 45, Z_HEICHAL, [zb(elements['heichal.amah-traksin'])]);
zone('kodesh-hakodashim', 45, Z_HEICHAL, [zb(elements['heichal.khk'])]);
zone('taim', 40, Z_HEICHAL, [zb(elements['heichal.taim.north']), zb(elements['heichal.taim.south']), zb(elements['heichal.taim.west'])]);
zone('mesibah', 41, Z_HEICHAL, [zb(elements['heichal.mesibah'])]);
zone('aliyah', 42, Z_ALIYAH, [zbx(X_KHK_W, Y_KOD_S, Z_ALIYAH - 0.5, X_KODESH_E, Y_KOD_N, Z_ALIYAH_TOP)]);
zone('roof', 42, Z_ROOF, [zbx(X_ALIYAH_W_FACE, Y_ULAM_S, Z_ROOF - 0.5, X_ULAM_E, Y_ULAM_N, Z_CROWN + 6)]);
// sub-zones (ARCHITECTURE §8 allows them): the ta'im roofs with the climb to the aliyah door; the closed Ulam storey above its ceiling
zone('taim-roofs', 42, Z_TAIM_ROOF, [...elements['heichal.taim.roofs'].params.pieces.map((p) => [[p.min[0], p.min[1], Z_TAIM_ROOF - 0.5], [p.max[0], p.max[1], Z_TAIM_ROOF + 6]]),
  zbx(...elements['heichal.taim.roof-stair'].box.min, ...elements['heichal.taim.roof-stair'].box.max.map((v, i) => (i === 2 ? v + 3 : v)))]);
zone('ulam-upper', 40, Z_ALIYAH, [zbx(X_KODESH_E, Y_ULAM_S, Z_KOD_TOP, X_ULAM_E, Y_ULAM_N, Z_ROOF - 0.5)]);
for (const k of ['gazit', 'golah', 'melach', 'parvah', 'medichin']) zone(k, 30, Z_AZ, [zb(elements[`azarah.chamber.${k}`])]);
zone('etz-parhedrin', 30, Z_AZ, [zb(elements['azarah.chamber.etz'])]);
zone('lishkat-hakelim', 30, Z_EY, [zb(elements['azarah.chamber.kelim'])]);
zone('lishkat-pinchas', 30, Z_EY, [zb(elements['azarah.chamber.pinchas'])]);
zone('lishkat-chavitin', 30, Z_EY, [zb(elements['azarah.chamber.chavitin'])]);
zone('lishkat-chashaim', 30, Z_EN, [zb(elements['en.chamber.chashaim'])]);
zone('lishkat-hakorban', 30, Z_MOUNT, [zb(elements['mount.chamber.korban'])]);
zone('lishkat-haparochet', 30, Z_MOUNT, [zb(elements['mount.chamber.parochet'])]);
zone('beit-haeven', 30, Z_MOUNT, [zb(elements['mount.chamber.beit-haeven'])]);
zone('shushan-habirah', 31, MOUNT_EAST_WALL_H, [zb(elements['mount.gate.shushan.chamber'])]);
zone('beit-hamoked', 32, Z_AZ, [zb(elements['azarah.moked.hall'])]);
zone('underground-passage', 30, -12, [zb(elements['azarah.underground.stair']), zb(elements['azarah.underground.passage'])]);
zone('beit-hatevilah', 32, -12, [zb(elements['azarah.underground.beit-hatevilah'])]);
zone('beit-avtinas', 33, Z_AZ + GATEHOUSE_ROOF, [zbx(...[...elements['azarah.beit-avtinas'].box.min, ...elements['azarah.beit-avtinas'].box.max]), zb(elements['azarah.mikveh.mayim-roof']),
  zbx(elements['azarah.gate.mayim.house'].box.min[0], Y_CX_S, Z_AZ + GATEHOUSE_ROOF - 0.5, elements['azarah.gate.mayim.house'].box.max[0], Y_AZ_S, Z_AZ + GATEHOUSE_ROOF + UPPER_ROOM_H)]);
zone('beit-hanitzotz', 33, Z_AZ + GATEHOUSE_ROOF, [zb(elements['azarah.beit-hanitzotz'])]);
for (const k of ['delek', 'bechorot', 'mayim', 'nitzotz', 'korban']) zone(`gate-${k}`, 31, Z_AZ, [gz('', elements[`azarah.gate.${k}`]), zb(elements[`azarah.gate.${k}.flight`])]);
zone('gate-moked', 31, Z_AZ, [gz('', elements['azarah.gate.moked']), zb(elements['azarah.moked.door-chel']), zb(elements['azarah.moked.flight'])]);

// -----------------------------------------------------------------------------
// 5. DIMENSION CHAINS (self-checked)
// -----------------------------------------------------------------------------
const chains = [];
function chain(name, axis, parts, expected, note) {
  const total = r6(sum(parts.map((p) => p.amot)));
  chains.push({ name, axis, parts, total, expected, ok: Math.abs(total - expected) < 1e-6, note });
}
const P = (label, amot, source) => ({ label, amot, source });
chain('Har HaBayit E–W (margins + complex)', 'X', [P('west margin', MARGIN_W, 'lock §58'), P('Azarah W wall', COURT_WALL_T, 'lock §58'), P('Azarah', AZ_LEN, 'Middot 5:1'),
  P('Nikanor wall', COURT_WALL_T, 'lock §58'), P('Ezrat Nashim', EN, 'Middot 2:5'), P('EN E wall', COURT_WALL_T, 'lock §58'), P('east margin', MARGIN_E, 'lock §58')], MOUNT);
chain('Har HaBayit N–S (margins + complex)', 'Y', [P('south margin', MARGIN_S, 'lock §58'), P('S wall', COURT_WALL_T, 'lock §58'), P('Azarah/EN width', AZ_WID, 'Middot 5:2; 2:5'),
  P('N wall', COURT_WALL_T, 'lock §58'), P('north margin', MARGIN_N, 'lock §58')], MOUNT);
chain('Azarah E–W (Middot 5:1)', 'X', [P('mekom drisat Yisrael', EY, 'Middot 5:1'), P('mekom drisat haKohanim', EK, 'Middot 5:1'), P('the Mizbeach', ALTAR, 'Middot 5:1'),
  P('between the Ulam and the Mizbeach', BEIN_HAULAM, 'Middot 5:1'), P('the Heichal', HEICHAL_LEN, 'Middot 5:1'), P('behind the Beit HaKaporet', BEHIND_KAPORET, 'Middot 5:1')], AZ_LEN);
chain('Azarah N–S (Rambam BhB 5:13–15)', 'Y', [P('N wall → mitbachayim', N_MARGIN, 'BhB 5:13'), P('Beit HaMitbachayim', MITBACHAYIM, 'BhB 5:13'), P('place of the tables', TABLES_BAND, 'BhB 5:14'),
  P('place of the rings', RINGS_BAND, 'BhB 5:14; Middot 5:2'), P('rings → altar', RINGS_TO_ALTAR, 'Middot 5:2'), P('the Mizbeach', ALTAR, 'Middot 3:1'), P('the kevesh (ground)', KEVESH_GROUND, 'BhB 5:15; 2:13'),
  P('kevesh → S wall', S_MARGIN, 'BhB 5:15')], AZ_WID);
chain('Azarah N–S (Middot 5:2 as written)', 'Y', [P('kevesh and Mizbeach', ALTAR + KEVESH_GROUND, 'Middot 5:2'), P('Mizbeach → rings', RINGS_TO_ALTAR, 'Middot 5:2'), P('place of the rings', RINGS_BAND, 'Middot 5:2'),
  P('rings → tables', 4, 'Middot 5:2'), P('tables → nanasin', 4, 'Middot 5:2'), P('nanasin → wall', N_MARGIN, 'Middot 5:2'), P('remainder (kevesh–wall + place of the nanasin)', MITBACHAYIM + S_MARGIN, 'Middot 5:2; Rambam splits 12½ + 12½')], AZ_WID);
chain('Heichal E–W (Middot 4:7)', 'X', [P('Ulam wall', ULAM_WALL, 'Middot 4:7'), P('Ulam', ULAM_IN, 'Middot 4:7'), P('Heichal wall', HEI_WALL, 'Middot 4:7'), P('Kodesh', KODESH_LEN, 'Middot 4:7'),
  P('amah traksin', TRAKSIN, 'Middot 4:7'), P('Kodesh HaKodashim', KHK, 'Middot 4:7'), P('Heichal wall', HEI_WALL, 'Middot 4:7'), P('ta', TA, 'Middot 4:7'), P('ta wall', TA_WALL, 'Middot 4:7')], HEICHAL_LEN);
chain('Heichal N–S body (Middot 4:7)', 'Y', [P('mesibah wall', MESIBAH_WALL, 'Middot 4:7'), P('mesibah', MESIBAH, 'Middot 4:7'), P('ta wall', TA_WALL, 'Middot 4:7'), P('ta', TA, 'Middot 4:7'),
  P('Heichal wall', HEI_WALL, 'Middot 4:7'), P('interior', KODESH_WID, 'Middot 4:7'), P('Heichal wall', HEI_WALL, 'Middot 4:7'), P('ta', TA, 'Middot 4:7'), P('ta wall', TA_WALL, 'Middot 4:7'),
  P('beit horadat hamayim', WATER_HOUSE, 'Middot 4:7'), P('wall', OUTER_WALL, 'Middot 4:7')], 70);
chain('Ulam front (Middot 4:7)', 'Y', [P('wing N (beit hachalifot)', ULAM_WING, 'Middot 4:7'), P('body', 70, 'Middot 4:7'), P('wing S', ULAM_WING, 'Middot 4:7')], 100);
chain('Heichal height (Middot 4:6)', 'Z', STACK.map(([k, h]) => P(k, h, 'Middot 4:6')), 100, `crown = Azarah floor ${Z_AZ} + 100 = ${Z_CROWN} (Part XIV §64.1)`);
chain('Elevation ladder to the Heichal floor', 'Z', [P('12 chel steps', CHEL_STEPS * STEP_RISE, 'Middot 2:3; BhB 6:1'), P('15 steps', NIKANOR_STEPS * STEP_RISE, 'Middot 2:5; BhB 6:2'),
  P('1-amah step', DUCHAN_STEP, 'Middot 2:6'), P('3 duchan half-steps', DUCHAN_HALF_STEPS * STEP_RISE, 'Middot 2:6'), P('12 Ulam steps', ULAM_STEPS * STEP_RISE, 'Middot 3:6')], 22, 'Rambam BhB 6:5: Heichal floor 22 over the E-gate threshold');
chain('Otem = Ulam-step rise', 'Z', [P('otem', STACK[0][1], 'Middot 4:6')], ULAM_STEPS * STEP_RISE, 'lock #39: the 12 steps climb the 6-amah podium');
chain('Altar plan (Middot 3:1)', 'X', [P('ma\'arachah', 24, 'Middot 3:1'), P('walkway x2', 2 * WALKWAY, 'Middot 3:1'), P('keranot x2', 2 * KEREN, 'Middot 3:1'), P('sovev inset x2', 2 * SOVEV_INSET, 'Middot 3:1'), P('yesod inset x2', 2 * YESOD_INSET, 'Middot 3:1')], ALTAR);
chain('Altar height (lock #2)', 'Z', [P('yesod', YESOD_RISE, 'Middot 3:1'), P('to the sovev', SOVEV_RISE, 'Middot 3:1'), P('to the top', TOP_RISE, 'Zevachim 59b–60a'), P('keranot', KEREN, 'Middot 3:1')], 10);
chain('Kevesh length (Middot 3:3, 5:2)', 'Y', [P('on the ground', KEVESH_GROUND, 'Rambam BhB 2:13'), P('over the yesod', YESOD_INSET, 'Middot 5:2 gemara'), P('over the sovev', SOVEV_INSET, 'ibid.')], KEVESH_LEN);
chain('12 Ulam steps run (Middot 3:6)', 'X', ULAM_TREADS.map((t, i) => P(`tread ${i + 1}`, t, 'Middot 3:6')).concat([P('apron at the foot', ULAM_APRON, 'derived')]), BEIN_HAULAM);
chain('Ulam lintels (Middot 3:7)', 'Y', [P('opening', ULAM_OPEN_W, 'Middot 3:7'), P('overhang x2 per beam x5', 2 * LINTELS, 'Middot 3:7')], 30, 'top beam 30');
chain('Azarah N/S gate stations (lock §58)', 'X', [P('gap', AZ_GATE_GAP, 'EK 39¼'), P('gate', GATE_W, ''), P('gap', AZ_GATE_GAP, ''), P('gate', GATE_W, ''), P('gap', AZ_GATE_GAP, ''), P('gate', GATE_W, ''), P('gap', AZ_GATE_GAP, '')], AZ_LEN);
chain('Chuldah trisection (lock §58)', 'X', [P('corner → gate', CHULDAH_SPAN, 'EK'), P('gate', GATE_W, ''), P('gate → gate', CHULDAH_SPAN, ''), P('gate', GATE_W, ''), P('gate → corner', CHULDAH_SPAN, '')], MOUNT);
chain('EN along its W wall', 'Y', [P('SW chamber (40 + wall)', EN_CHAMBER + EN_CHAMBER_WALL_T, 'Middot 2:5'), P('free stretch', EN - 2 * (EN_CHAMBER + EN_CHAMBER_WALL_T), 'derived'), P('NW chamber', EN_CHAMBER + EN_CHAMBER_WALL_T, 'Middot 2:5')], EN);
chain('Tzafon (Rambam BhB 5:15)', 'Y', [P('N wall → altar', Y_AZ_N - Y_ALT_N, 'BhB 5:15')], 60.5);
chain('Tzafon length (Rambam BhB 5:15)', 'X', [P('Ulam → E wall', X_AZ_E - X_ULAM_E, 'BhB 5:15')], 76);
chain("Ta'im count (Middot 4:3)", '-', [P('north', sum(TA_COUNT.N), 'Middot 4:3'), P('south', sum(TA_COUNT.S), 'Middot 4:3'), P('west', sum(TA_COUNT.W), 'Middot 4:3')], 38);
chain('En Eitam head (Yoma 31a)', 'Z', [P('gate', GATE_H, 'Middot 2:3'), P('mikveh', MIKVEH_DEPTH, 'Yoma 31a')], 23);
chain('Wall + ta per story (Middot 4:4)', '-', TA_STORY.map((w, k) => P(`story ${k + 1}: wall ${HEI_WALL_BY_STORY[k]} + ta ${w}`, HEI_WALL_BY_STORY[k] + w - 12, 'Middot 4:4')), 0, 'each story sums to 12');

// -----------------------------------------------------------------------------
// 6. THE PARAH SIGHT-LINE (Middot 2:4; Yoma 16a–b; Rambam BhB 6:5; Parah 3:9)
// -----------------------------------------------------------------------------
/**
 * Line from the kohen on Har HaMishchah to the Heichal doorway, in the vertical plane Y = axisY.
 * opts: { amah (m), eyeDistM, crestASL, eyeM, walls: { mountEast, enEast, azarahEast, shushanChamber } (top Z overrides; shushanChamber 0 = no chamber),
 *         stand: 'arrangement' (default: the kohen on the pyre at the sprinkling, Parah 3:9) | 'ground' (a viewer on the crest, no pyre),
 *         target: 'outer'|'inner', level: bool (the Gemara's level-line model) }
 * Returns visible door-height intervals and per-obstacle clearances for the best line.
 */
export function parahSightLine(opts = {}) {
  const a = opts.amah ?? AMAH;
  const scaleM = (m) => m / a;                                  // meters → amot at this standard
  const eF = MOUNT + MOUNT_WALL_T;
  const groundAt = (x) => { const m = (x - eF) * a; return m < 0 ? null : (topoAt('E', m) - DATUM_ASL) / a; };
  const crestM = opts.eyeDistM ?? PARAH_SITE_M;
  const onPyre = !opts.level && opts.stand !== 'ground';
  const crestX = eF + scaleM(crestM), crestZ = ((opts.crestASL ?? topoAt('E', crestM)) - DATUM_ASL) / a;
  const pyreTop = crestZ + PARAH_PYRE.h, kohenX = crestX - PARAH_PYRE.front - PARAH_KOHEN_IN;
  const eye = opts.level ? null : onPyre ? [kohenX, pyreTop + (opts.eyeM ?? EYE_M) / a] : [crestX, crestZ + (opts.eyeM ?? EYE_M) / a];
  const w = { mountEast: MOUNT_EAST_WALL_H, enEast: Z_EN_EAST_TOP, azarahEast: Z_AZ_EAST_TOP, shushanChamber: MOUNT_EAST_WALL_H + SHUSHAN_CHAMBER_H, ...(opts.walls || {}) };
  const xT = opts.target === 'inner' ? X_KODESH_E : X_ULAM_IN_W;
  // the east stoa on the axis: its band (taken as solid to the roof, conservatively) plus the solid parts of the overhangs that cross the
  // axis (front entablature, roof parapet, the raised bay before Shushan — open below its soffit)
  const stoaE = elements['mount.stoa.east'];
  const stoaObs = [{ part: 'roof', box: stoaE.box }, ...stoaE.params.overhangs].filter((o) => o.box.min[1] <= AXIS_Y && o.box.max[1] >= AXIS_Y)
    .map((o) => ({ id: `mount.stoa.east (${o.part})`, x: [o.box.min[0], o.box.max[0]], block: [[o.solidFromZ ?? -50, o.box.max[2]]] }));
  // obstacles crossing the axis (blocked Z intervals)
  const O = [
    ...stoaObs,
    { id: 'mount.wall.east + Shushan HaBirah chamber (over the gate)', x: [MOUNT, eF], block: [[-50, 0], [GATE_H, Math.max(w.mountEast, w.shushanChamber || 0)]] },
    { id: 'mount.chel.steps', x: [X_CX_E, X_CX_E + CHEL_STEPS * STEP_TREAD], block: [[-50, Z_EN]] },
    { id: 'en.wall.east (EN gate)', x: [X_EN_E, X_CX_E], block: [[-50, Z_EN], [Z_EN + GATE_H, w.enEast]] },
    { id: 'en.steps15 + landing', x: [X_EN_W, X_EN_W + S15_OUTER], block: [[-50, Z_EY]] },
    { id: 'azarah.wall.east (Nikanor)', x: [X_AZ_E, X_EN_W], block: [[-50, Z_EY], [Z_EY + GATE_H, w.azarahEast]] },
    { id: 'court floors (EY/EK)', x: [X_ALT_E, X_AZ_E], block: [[-50, Z_AZ]] },
    { id: 'altar.yesod (W strip)', x: [ALT_X0, ALT_X0 + T30], block: [[-50, Z_YESOD]] },
    { id: 'altar.body (to the sovev)', x: [ALT_X0 + T30, ALT_X0 + ALTAR - T30], block: [[-50, Z_SOVEV]] },
    { id: 'altar.top (ma\'arachah level)', x: [ALT_X0 + T28, ALT_X0 + ALTAR - T28], block: [[-50, Z_ALT_TOP]] },
    { id: 'heichal.ulam.wall-front (opening)', x: [X_ULAM_IN_E, X_ULAM_E], block: [[-50, Z_HEICHAL], [Z_HEICHAL + ULAM_OPEN_H, Z_ROOF]] },
    { id: 'heichal.ulam (floor)', x: [X_ULAM_IN_W, X_ULAM_IN_E], block: [[-50, Z_HEICHAL]] },
  ];
  if (opts.target === 'inner') O.push({ id: 'heichal.gate.great (passage)', x: [X_KODESH_E, X_ULAM_IN_W], block: [[-50, Z_HEICHAL], [Z_HEICHAL + GATE_H, Z_ROOF]] });
  if (onPyre) {   // the arrangement under the kohen's feet and the heifer lying on it, west of him (Parah 3:9)
    const hx1 = kohenX - 0.5, hx0 = hx1 - HEIFER.w;
    O.push({ id: 'context.parah.pyre (the arrangement)', x: [crestX - PARAH_PYRE.back, crestX - PARAH_PYRE.front], block: [[-50, pyreTop]] });
    O.push({ id: 'the heifer lying on it', x: [hx0, hx1], block: [[pyreTop, pyreTop + HEIFER.h]] });
  }
  const lineZ = (zt, x) => opts.level ? zt : zt + (eye[1] - zt) * (x - xT) / (eye[0] - xT);
  function clear(zt) {
    for (const o of O) {
      const z0 = lineZ(zt, o.x[0]), z1 = lineZ(zt, o.x[1]), lo = Math.min(z0, z1), hi = Math.max(z0, z1);
      for (const [b0, b1] of o.block) if (hi > b0 && lo < b1) return false;
    }
    // Ulam steps (stepped profile)
    for (const s of elements['altar.ulam-steps'].params.profile) { const x = s.riserX - s.tread; if (lineZ(zt, x) < s.topZ || lineZ(zt, s.riserX) < s.topZ) return false; } // tread corners
    if (!opts.level) for (let x = eF; x < eye[0] - 1; x += 5) { const g = groundAt(x); if (g != null && lineZ(zt, x) < g) return false; }
    return true;
  }
  const intervals = []; let cur = null; const dz = 0.01;
  for (let zt = Z_HEICHAL; zt <= Z_HEICHAL + GATE_H + 1e-9; zt += dz) {
    const ok = clear(zt);
    if (ok && !cur) cur = [zt, zt]; else if (ok) cur[1] = zt; else if (cur) { intervals.push(cur); cur = null; }
  }
  if (cur) intervals.push(cur);
  const visible = r6(sum(intervals.map(([p, q]) => q - p)));
  const report = (zt) => O.map((o) => {
    const z0 = lineZ(zt, o.x[0]), z1 = lineZ(zt, o.x[1]), lo = Math.min(z0, z1), hi = Math.max(z0, z1);
    let c = Infinity; for (const [b0, b1] of o.block) { if (lo >= b1) c = Math.min(c, lo - b1); else if (hi <= b0) c = Math.min(c, b0 - hi); else c = Math.min(c, -Math.min(hi - b0, b1 - lo)); }
    return { obstacle: o.id, lineZ: [r6(Math.round(z1 * 100) / 100), r6(Math.round(z0 * 100) / 100)], clearance: r6(Math.round(c * 100) / 100) };
  });
  const threshold = intervals.length ? intervals[0][0] : null;
  const best = intervals.length ? intervals.reduce((p, q) => (q[1] - q[0] > p[1] - p[0] ? q : p)) : null;
  return {
    amahMeters: a, eye: eye ? { X: r6(eye[0]), Y: AXIS_Y, Z: r6(eye[1]), distanceFromEastWallM: crestM, stand: onPyre ? 'on the arrangement (Parah 3:9)' : 'crest ground' } : 'level line (Yoma 16a model)', targetPlaneX: xT,
    walls: w, visibleIntervals: intervals.map(([p, q]) => [r6(Math.round(p * 100) / 100), r6(Math.round(q * 100) / 100)]), visibleAmot: r6(Math.round(visible * 100) / 100),
    passes: visible > 0, lowestLine: threshold != null ? report(threshold) : null, bestLine: best ? { doorZ: r6((best[0] + best[1]) / 2), clearances: report((best[0] + best[1]) / 2) } : null,
  };
}

// -----------------------------------------------------------------------------
// 7. SITE object, lookups
// -----------------------------------------------------------------------------
export const SITE = {
  meta: {
    frame: 'X east, Y north, Z up; amot; origin = SW corner of the 500x500 clear interior of Har HaBayit; Z0 = threshold of the eastern (Shushan) gate',
    amah: 'building amah = 6 tefachim (Kelim 17:9; Rambam BhB 2:6); context terrain converted at AMAH = ' + AMAH + ' m',
    sources: ['report/parts 00–14 (esp. §0.3–0.4, Parts I–V, VII §22, IX §37–38, X §46–52, XI locks, XIV §64)', 'sources/Mishnah Middot (Hebrew, ch. 1–5)', 'Mishnah Tamid, Parah 3, Shekalim 6', 'Rambam Hilchot Beit HaBechirah 1–6', 'Bavli Yoma 15b–19b, 25a, 31a, 51b–54a; Zevachim 53a–64b'],
    generatedFrom: 'parametric derivation in this file from the report\'s dimension chains and Part XI locks; NOT from engine/temple_manifest.json',
    confidenceLevels: ['explicit', 'derived', 'locked', 'reconstruction'],
    confidenceRule: 'element confidence = the weakest number defining its box; params.fieldConfidence lists the parts per field',
    docs: 'docs/site-model.md; docs/decisions/site-model.md',
  },
  datums: { mount: Z_MOUNT, ezratNashim: Z_EN, ezratYisrael: Z_EY, azarah: Z_AZ, heichalFloor: Z_HEICHAL, taimRoofs: Z_TAIM_ROOF, kodeshCeiling: Z_KOD_TOP, aliyahFloor: Z_ALIYAH, roof: Z_ROOF, crown: Z_CROWN },
  axisY: AXIS_Y,
  elements,
  zones,
  chains,
  context: { datumASL: DATUM_ASL, amahMeters: AMAH, parahEye: PARAH_EYE, parahGroundEye: PARAH_GROUND_EYE, causewayEndX: r6(mE(causewayEndM)), kiponusEndX: r6(-MOUNT_WALL_T - kiponusEndM / AMAH) },
};
export function el(id) { return SITE.elements[id]; }
export function zoneGeometry(id) { return SITE.zones[id] || null; }
/** Zone id at a site point: the containing box with the highest priority; ties → smallest box volume. */
export function zoneAtSite(X, Y, Z) {
  let best = null, bp = -Infinity, bv = Infinity;
  for (const [id, z] of Object.entries(SITE.zones)) for (const [mn, mx] of z.boxes) {
    if (X < mn[0] || X > mx[0] || Y < mn[1] || Y > mx[1] || Z < mn[2] || Z > mx[2]) continue;
    const v = (mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]);
    if (z.priority > bp || (z.priority === bp && v < bv)) { best = id; bp = z.priority; bv = v; }
  }
  return best;
}

// -----------------------------------------------------------------------------
// 8. SELF-CHECKS — runChecks() → { ok, count, failures[] }
// -----------------------------------------------------------------------------
export const CANONICAL_ZONES = ['outside', 'kidron', 'har-hamishchah', 'parah-causeway', 'har-habayit', 'stoa', 'chel', 'soreg', 'gate-shushan', 'gate-chuldah-w',
  'gate-chuldah-e', 'gate-kiponus', 'gate-tadi', 'ezrat-nashim', 'en-gate-east', 'en-chamber-wood', 'en-chamber-lepers', 'en-chamber-nazirites', 'en-chamber-oil', 'en-gallery',
  'fifteen-steps', 'music-chambers', 'nikanor', 'ezrat-yisrael', 'ezrat-kohanim', 'azarah', 'mizbeach', 'kevesh', 'slaughter-zone', 'bein-haulam-lamizbeach', 'kiyor', 'ulam-steps',
  'ulam', 'beit-hachalifot', 'heichal', 'amah-traksin', 'kodesh-hakodashim', 'taim', 'mesibah', 'aliyah', 'roof', 'gazit', 'golah', 'etz-parhedrin', 'melach', 'parvah', 'medichin',
  'beit-hamoked', 'underground-passage', 'beit-hatevilah', 'beit-avtinas', 'beit-hanitzotz', 'gate-delek', 'gate-bechorot', 'gate-mayim', 'gate-nitzotz', 'gate-korban', 'gate-moked'];
export function runChecks() {
  const failures = []; let count = 0;
  const check = (label, cond) => { count++; if (!cond) failures.push(label); };
  const eq = (label, got, want) => check(`${label}: got ${got}, want ${want}`, Math.abs(got - want) < 1e-6);
  const E = (id) => { const e = SITE.elements[id]; if (!e) failures.push(`missing element ${id}`); return e; };
  const span = (id, ax) => { const e = E(id); return e ? r6(e.box.max[ax] - e.box.min[ax]) : NaN; };
  const overlap = (a, b) => a.min[0] < b.max[0] && b.min[0] < a.max[0] && a.min[1] < b.max[1] && b.min[1] < a.max[1] && a.min[2] < b.max[2] && b.min[2] < a.max[2];
  const inside = (a, b) => a.min.every((v, i) => v >= b.min[i] - 1e-9) && a.max.every((v, i) => v <= b.max[i] + 1e-9);
  const overlap2D = (a, b) => a.min[0] < b.max[0] && b.min[0] < a.max[0] && a.min[1] < b.max[1] && b.min[1] < a.max[1];
  const isBox = (b) => !!b && Array.isArray(b.min) && Array.isArray(b.max);
  // the true solids of an element: its box, unless params give the real pieces (the box is then only an envelope)
  const solidBoxes = (e) => {
    const p = e.params || {};
    if (p.groundPiece) return [p.groundPiece, ...(p.flying || []).map((f) => bx(e.box.min[0], f.y[0], f.undersideZ, e.box.max[0], f.y[1], Math.max(...f.topZ)))];
    if (Array.isArray(p.pieces)) return p.pieces;
    if (Array.isArray(p.segments)) return p.segments.map((s) => (isBox(s) ? s : s.box)).filter(isBox);
    if (Array.isArray(p.cells)) return p.cells.map((c) => c.box);
    if (Array.isArray(p.rooms)) return p.rooms.flatMap((r) => [r.box, r.door]);
    if (Array.isArray(p.pillars)) { const h = (p.section ?? 1) / 2; return p.pillars.map(([x, y, z]) => bx(x - h, y - h, z, x + h, y + h, z + (p.shaftH ?? 0) + NANAS_CAP)); }
    if (Array.isArray(p.tables)) return p.tables;
    return e.box ? [e.box] : [];
  };
  const overlapsAny = (A, B) => A.some((a) => B.some((b) => overlap(a, b)));
  // chains
  for (const c of chains) check(`chain "${c.name}" total ${c.total} ≠ ${c.expected}`, c.ok);
  // element integrity
  const CONF = new Set(SITE.meta.confidenceLevels);
  for (const [id, e] of Object.entries(SITE.elements)) {
    check(`${id}: id mismatch`, e.id === id);
    check(`${id}: name.en/he`, !!(e.name && e.name.en && e.name.he));
    check(`${id}: sources`, Array.isArray(e.sources) && e.sources.length > 0);
    check(`${id}: confidence`, CONF.has(e.confidence));
    if (e.box) check(`${id}: box min<=max`, e.box.min.every((v, i) => v <= e.box.max[i]) && [...e.box.min, ...e.box.max].every(Number.isFinite));
    const fcv = e.params.fieldConfidence;
    if (fcv) check(`${id}: fieldConfidence values are confidence levels`, Object.values(fcv).every((v) => CONF.has(v)));
    // a ⚙ marks a number the sources do not fix: the element is then 'reconstruction', or its fieldConfidence names the ⚙ part as 'reconstruction'
    if ([e.derivation, e.notes, JSON.stringify(e.params)].join(' ').includes('⚙') && e.confidence !== 'reconstruction')
      check(`${id}: carries ⚙ but is '${e.confidence}' without a fieldConfidence entry 'reconstruction'`, !!fcv && Object.values(fcv).includes('reconstruction'));
  }
  // datums & ladder
  eq('EN floor', Z_EN, 6); eq('EY floor', Z_EY, 13.5); eq('Azarah floor', Z_AZ, 16); eq('Heichal floor', Z_HEICHAL, 22); eq('crown', Z_CROWN, 116);
  eq('otem top = Heichal floor', stackZ[0][1], Z_HEICHAL); eq('aliyah floor', Z_ALIYAH, 67); eq('roof', Z_ROOF, 112);
  // envelope geometry measured from the element boxes
  eq('Mount interior X', E('mount.floor').box.max[0] - E('mount.floor').box.min[0], MOUNT);
  eq('EN interior E–W', span('en.floor', 0), EN); eq('EN interior N–S', span('en.floor', 1), EN);
  eq('Azarah length (W wall inner face → Nikanor wall inner face)', E('azarah.wall.east').box.min[0] - E('azarah.wall.west').box.max[0], AZ_LEN);
  eq('Azarah width', E('azarah.wall.north').box.min[1] - E('azarah.wall.south').box.max[1], AZ_WID);
  eq('EN E wall outer face = 500 − east margin', E('en.wall.east').box.max[0], MOUNT - MARGIN_E);
  eq('complex N face = 500 − north margin', E('azarah.wall.north').box.max[1], MOUNT - MARGIN_N);
  eq('altar N face → N wall = 60½ (lock #4)', Y_AZ_N - E('altar.yesod').box.max[1], 60.5);
  eq('altar W face → Ulam front = 22', E('altar.yesod').box.min[0] - E('heichal.ulam.wall-front').box.max[0], BEIN_HAULAM);
  eq('Heichal W face → Azarah W wall = 11', E('heichal.ta-wall.west').box.min[0] - E('azarah.wall.west').box.max[0], BEHIND_KAPORET);
  eq('kevesh foot → S wall = 12½', E('altar.kevesh').box.min[1] - E('azarah.wall.south').box.max[1], S_MARGIN);
  eq('kevesh length', span('altar.kevesh', 1), KEVESH_LEN); eq('kevesh width', span('altar.kevesh', 0), KEVESH_W);
  eq('Kodesh 40', span('heichal.kodesh', 0), 40); eq('Kodesh 20', span('heichal.kodesh', 1), 20); eq('Kodesh h 40', span('heichal.kodesh', 2), 40);
  eq('KhK 20 x 20 x 40', span('heichal.khk', 0) + span('heichal.khk', 1) + span('heichal.khk', 2), 80); eq('traksin 1', span('heichal.amah-traksin', 0), 1);
  eq('Heichal E–W 100 (ta wall W face → Ulam front)', E('heichal.ulam.wall-front').box.max[0] - E('heichal.ta-wall.west').box.min[0], 100);
  eq('Ulam front 100', span('heichal.ulam.wall-front', 1), 100); eq('body N–S 70', E('heichal.mesibah-wall').box.max[1] - E('heichal.outer-wall.south').box.min[1], 70);
  eq('Ulam opening 20 wide', span('heichal.ulam.opening', 1), 20); eq('Ulam opening 40 high', span('heichal.ulam.opening', 2), 40);
  eq('great gate 10 x 20', span('heichal.gate.great', 1) + span('heichal.gate.great', 2), 30);
  eq('kalya orev top = crown', E('heichal.kalya-orev').box.max[2], Z_CROWN);
  eq('top lintel 30', E('heichal.ulam.lintels').params.beams[LINTELS - 1].length, 30);
  eq('Ulam step profile ends at the Ulam', E('altar.ulam-steps').params.profile[ULAM_STEPS - 1].riserX - ULAM_TREADS[ULAM_STEPS - 1], X_ULAM_E);
  eq('Ulam top step = Heichal floor', E('altar.ulam-steps').params.profile[ULAM_STEPS - 1].topZ, Z_HEICHAL);
  check('Water Gate opposite the altar (lock §58)', AZ_GATE_CX[2] > ALT_X0 && AZ_GATE_CX[2] < ALT_X0 + ALTAR);
  check('Tadi opposite the Moked gate', E('mount.gate.tadi').box.min[0] === E('azarah.gate.moked').box.min[0]);
  check('Shushan on the axis', (E('mount.gate.shushan').box.min[1] + E('mount.gate.shushan').box.max[1]) / 2 === AXIS_Y);
  check('Kiponus mid-west', (E('mount.gate.kiponus').box.min[1] + E('mount.gate.kiponus').box.max[1]) / 2 === MOUNT / 2);
  eq('ta\'im cells', E('heichal.taim.north').params.cells.length + E('heichal.taim.south').params.cells.length + E('heichal.taim.west').params.cells.length, 38);
  eq('rings', E('altar.rings').params.positions.length, 24); eq('marble tables', E('altar.marble-tables').params.tables.length, 8); eq('nanasin', E('altar.nanasin').params.pillars.length, 8);
  eq('soreg breaches', E('mount.soreg.breaches').params.stations.length, 13);
  for (const [s, n] of Object.entries(PROSTRATIONS_BY_SIDE)) eq(`breaches on ${s}`, E('mount.soreg.breaches').params.stations.filter((b) => b.side === s).length, n);
  eq('mikveh surface on the Water Gate = En Eitam head (+23 over the Azarah)', E('azarah.mikveh.mayim-roof').box.max[2], Z_AZ + 23);
  // cross-references between elements resolve
  for (const e of Object.values(SITE.elements)) for (const k of ['openings', 'voids', 'replacedBy', 'alsoPierces', 'roofLevelWith', 'flight', 'stair', 'tunnel', 'opensInto', 'podium', 'carries', 'chamber', 'reachedBy', 'approach'])
    for (const ref of [].concat(e.params[k] ?? [])) check(`${e.id}.params.${k} → ${ref} exists`, typeof ref === 'string' && !!SITE.elements[ref]);
  for (const e of Object.values(SITE.elements)) if (e.params.zone) check(`${e.id}.params.zone → ${e.params.zone} is a zone holding it`, !!SITE.zones[e.params.zone] && zoneAtSite((e.box.min[0] + e.box.max[0]) / 2, (e.box.min[1] + e.box.max[1]) / 2, e.box.min[2] + 0.5) === e.params.zone);
  // the explicit open strips of the Azarah N–S chain stay clear (Middot 5:2; Rambam BhB 5:13–15)
  check('Beit HaMoked does not enter the mitbachayim band', E('azarah.moked.hall').box.min[1] >= Y_MITB_S);
  check('Water Gate house does not enter the 12½ south margin', E('azarah.gate.mayim.house').box.max[1] <= Y_AZ_S);
  for (const id of ['altar.nanasin', 'altar.marble-tables', 'altar.rings']) check(`${id} within the Tzafon`, inside(E(id).box, { min: [X_ULAM_E, Y_ALT_N, Z_AZ], max: [X_AZ_E, Y_AZ_N, 40] }));
  // containment
  for (const id of ['heichal.shulchan', 'heichal.menorah', 'heichal.mizbach-hazahav', 'heichal.sotah-slab']) check(`${id} inside the Kodesh`, inside({ min: [...E(id).box.min.slice(0, 2), Z_HEICHAL], max: [...E(id).box.max.slice(0, 2), Z_HEICHAL + 1] }, E('heichal.kodesh').box));
  for (const id of ['heichal.shulchan', 'heichal.menorah', 'heichal.mizbach-hazahav']) check(`${id} within the inner two-thirds (Rambam BhB 3:17)`, E(id).box.max[0] <= X_THIRD);
  check('golden altar east of the Shulchan/Menorah ("drawn outward")', E('heichal.mizbach-hazahav').box.min[0] > (E('heichal.shulchan').box.min[0] + E('heichal.shulchan').box.max[0]) / 2);
  check('Even Shetiyah inside the KhK', inside(E('heichal.even-shetiyah').box, E('heichal.khk').box));
  check('kiyor between the Ulam and the altar (X)', E('altar.kiyor').box.min[0] >= X_ULAM_E && E('altar.kiyor').box.max[0] <= X_ALT_W);
  check('kiyor south of the axis ("drawn south")', E('altar.kiyor').box.max[1] < AXIS_Y);
  check('kiyor within the altar\'s N–S span ("between the Ulam and the altar")', E('altar.kiyor').box.min[1] >= ALT_Y0 && E('altar.kiyor').box.max[1] <= ALT_Y0 + ALTAR);
  for (const id of ['en.chamber.wood', 'en.chamber.lepers', 'en.chamber.nazirites', 'en.chamber.oil']) check(`${id} inside EN`, inside({ min: E(id).box.min, max: [E(id).box.max[0], E(id).box.max[1], E(id).box.min[2]] }, { min: [X_EN_W, Y_AZ_S, Z_EN], max: [X_EN_E, Y_AZ_N, Z_EN] }));
  // things that must not collide — tested on the true solids (params.pieces / segments / cells / pillars / kevesh pieces), not on bounding boxes
  const noOverlap = [
    ['altar.kiyor', 'altar.ulam-steps'], ['altar.kiyor.muchni', 'altar.ulam-steps'], ['altar.kiyor', 'altar.yesod'], ['altar.table.marble', 'altar.kevesh'], ['altar.table.silver', 'altar.kevesh'],
    ['altar.table.marble', 'altar.kevesh.ramp-yesod'], ['altar.beit-hadeshen', 'altar.kevesh'], ['altar.beit-hadeshen', 'altar.kevesh.ramp-sovev'], ['altar.machtah-niche', 'altar.kevesh.ramp-yesod'],
    ['altar.kevesh', 'altar.body'], ['altar.kevesh', 'altar.top'], ['altar.kevesh', 'altar.yesod'], ['altar.kevesh.ramp-yesod', 'altar.yesod'], ['altar.kevesh.ramp-yesod', 'altar.shit-slab'],
    ['en.steps15', 'en.chamber.lepers'], ['en.steps15', 'en.chamber.oil'], ['azarah.chamber.pinchas', 'azarah.gate.nikanor'], ['azarah.chamber.chavitin', 'azarah.gate.nikanor'],
    ['azarah.chamber.golah', 'azarah.gate.nitzotz.exedra'], ['azarah.chamber.gazit', 'heichal.mesibah-wall'], ['azarah.chamber.gazit', 'heichal.otem'], ['azarah.chamber.melach', 'azarah.gate.delek'], ['azarah.chamber.parvah', 'azarah.gate.delek'],
    ['azarah.chamber.medichin', 'azarah.gate.bechorot'], ['azarah.chamber.etz', 'azarah.gate.nitzotz.flight'], ['azarah.chamber.etz', 'azarah.moked.flight'], ['azarah.chamber.etz', 'azarah.gate.nitzotz.exedra'],
    ['azarah.chamber.etz', 'azarah.chamber.gazit'], ['azarah.chamber.etz', 'azarah.chamber.golah'], ['azarah.chamber.gazit', 'azarah.chamber.golah'],
    ['azarah.chamber.kelim', 'azarah.chamber.pinchas'], ['azarah.chamber.kelim', 'azarah.duchan'], ['en.chamber.chashaim', 'en.gallery'], ['en.chamber.chashaim', 'en.chamber.wood'], ['en.chamber.chashaim', 'en.chamber.lepers'],
    ['mount.chamber.korban', 'azarah.gate.korban.flight'], ['mount.chamber.parochet', 'azarah.gate.korban.flight'], ['mount.chamber.korban', 'azarah.moked.flight'], ['mount.chamber.beit-haeven', 'mount.stoa.north'],
    ['azarah.moked.hall', 'azarah.gate.korban'], ['azarah.gate.mayim.house', 'altar.kevesh'], ['heichal.ulam.tables', 'heichal.gate.great'], ['altar.rings', 'altar.yesod'],
    ['mount.chel.steps', 'en.wall.east'], ['heichal.taim.roof-stair', 'heichal.windows.f1'],
  ];
  for (const [a, b] of noOverlap) check(`${a} must not overlap ${b}`, !overlapsAny(solidBoxes(E(a)), solidBoxes(E(b))));
  for (const r of E('en.music-chambers').params.rooms) {
    check(`music room ${r.side} inside the element box`, inside(r.box, E('en.music-chambers').box) && inside(r.door, E('en.music-chambers').box));
    const dy = r.side === 'N' ? r.door.min[1] - AXIS_Y : AXIS_Y - r.door.max[1];
    check(`music-chamber door ${r.side} clear of the 15 steps`, dy >= S15_OUTER);
    check(`music-chamber door ${r.side} clear of the corner chambers`, (r.side === 'N' ? Y_AZ_N - r.door.max[1] : r.door.min[1] - Y_AZ_S) >= EN_CHAMBER + EN_CHAMBER_WALL_T);
  }
  for (const w of ['azarah.gate.nikanor.wicket-n', 'azarah.gate.nikanor.wicket-s']) check(`${w} reached from the 15-steps landing`, Math.max(Math.abs(E(w).box.min[1] - AXIS_Y), Math.abs(E(w).box.max[1] - AXIS_Y)) <= STEPS15_LANDING_R);
  for (const f of flights) { const e = E(f.id); check(`${f.id} crosses the soreg line through a passage`, SITE.elements['mount.soreg'].params.passages.some((p) => p.at === f.id)); check(`${f.id} ends on the Mount (Z0)`, e.box.min[2] === Z_MOUNT); }
  // ---- verification-pass checks (docs/site-model.md "Verification log") ----
  // floor elements tile every court footprint (no hole in the pavement for the builders or the colliders)
  const gapIn = (ids, [x0, y0, x1, y1], step) => { const B = ids.map((id) => E(id).box);
    for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step)
      if (!B.some((b) => x >= b.min[0] && x <= b.max[0] && y >= b.min[1] && y <= b.max[1])) return [r6(x), r6(y)];
    return null; };
  for (const [name, ids, rect, step] of [['Azarah (incl. Ezrat Kohanim, the duchan, Ezrat Yisrael)', ['azarah.floor', 'azarah.duchan', 'azarah.ezrat-yisrael'], [X_AZ_W, Y_AZ_S, X_AZ_E, Y_AZ_N], 0.5],
    ['Ezrat Nashim', ['en.floor'], [X_EN_W, Y_AZ_S, X_EN_E, Y_AZ_N], 0.5], ['Har HaBayit', ['mount.floor'], [0, 0, MOUNT, MOUNT], 1]]) {
    const g = gapIn(ids, rect, step); check(`floor elements tile the ${name}${g ? ` — gap at ${g}` : ''}`, !g);
  }
  check('azarah.floor runs to the foot of the duchan (Ezrat Kohanim paved)', E('azarah.floor').box.max[0] === E('azarah.duchan').box.min[0]);
  // Beit HaMoked: both doors open their full 10 amot onto the hall; the pishpash opens onto the hall; the keys slab is in the chol half
  const mkChBoxes = Object.keys(SITE.elements).filter((id) => id.startsWith('azarah.moked.chamber.')).map((id) => E(id).box);
  for (const [id, inner] of [['azarah.gate.moked', 'max'], ['azarah.moked.door-chel', 'min']]) {
    const g = E(id).box, y = g[inner][1], probe = { min: [g.min[0], inner === 'max' ? y : y - 1, g.min[2]], max: [g.max[0], inner === 'max' ? y + 1 : y, g.max[2]] };
    check(`${id}: its whole width opens onto the hall, clear of the corner chambers`, !mkChBoxes.some((c) => overlap(probe, c)));
  }
  check('Moked pishpash is within the gate (it opens onto the hall)', inside(E('azarah.gate.moked').params.pishpash.box, E('azarah.gate.moked').box));
  check('Moked keys slab is in the chol half (the officer slept on it)', E('azarah.moked.keys-slab').box.min[1] >= MOKED_KODESH_Y);
  // the north trio: Etz behind both, inside the Azarah line, opening north to chol; the Gazit's east door faces open court
  { const etz = E('azarah.chamber.etz').box, gz = E('azarah.chamber.gazit').box, go = E('azarah.chamber.golah').box;
    check('Etz is behind both Gazit and Golah (Middot 5:4)', etz.min[1] >= gz.max[1] - 1e-9 && etz.min[1] >= go.max[1] - 1e-9 && etz.min[0] < go.max[0] && etz.max[0] >= go.max[0]);
    check('Etz stands in the Azarah, within its wall line (Middot 5:3)', etz.min[0] >= X_AZ_W && etz.max[0] <= X_AZ_E && etz.min[1] >= Y_AZ_S && etz.max[1] <= Y_CX_N);
    check('Etz opens north through the wall to the chel', E('azarah.chamber.etz').params.door.face === 'north' && etz.max[1] === Y_CX_N);
    const d = E('azarah.chamber.gazit').params.doors[0];
    check('Gazit kodesh door faces open court, not the Golah', d.y[1] <= go.min[1] + 1e-9 || d.y[0] >= go.max[1] - 1e-9);
    check('Gazit leaves a passage to the Heichal\'s north wall', gz.min[1] - E('heichal.mesibah-wall').box.max[1] >= 5); }
  // anything at the Azarah floor level stands on the court podium or on an explicit substructure
  { const pods = Object.values(SITE.elements).filter((e) => e.id.endsWith('.podium')).map((e) => e.box);
    for (const e of Object.values(SITE.elements)) {
      if (!e.box || !['chamber', 'gate', 'opening'].includes(e.kind) || Math.abs(e.box.min[2] - Z_AZ) > 1e-9) continue;
      let ok = true;
      for (let x = e.box.min[0] + 0.25; x < e.box.max[0] && ok; x += 0.5) for (let y = e.box.min[1] + 0.25; y < e.box.max[1] && ok; y += 0.5) {
        const onCourt = x >= X_CX_W && x <= X_EN_W && y >= Y_CX_S && y <= Y_CX_N;
        if (!onCourt && !pods.some((b) => x >= b.min[0] && x <= b.max[0] && y >= b.min[1] && y <= b.max[1] && b.max[2] >= Z_AZ - 1e-9)) ok = false;
      }
      check(`${e.id}: stands on the court podium or a substructure (nothing floats at +${Z_AZ})`, ok);
    } }
  // the small ramp to the yesod lands on the yesod
  { const lv = E('altar.kevesh.ramp-yesod').params.segments.find((s) => s.level != null).box;
    const shared = E('altar.yesod').params.pieces.reduce((acc, p) => acc + (Math.abs(p.min[1] - lv.max[1]) < 1e-9 && Math.abs(p.max[2] - lv.max[2]) < 1e-9 ? Math.max(0, Math.min(p.max[0], lv.max[0]) - Math.max(p.min[0], lv.min[0])) : 0), 0);
    check(`yesod ramp: its level end meets the yesod along ≥ 1 amah at +${Z_YESOD} (${r6(shared)})`, shared >= 1); }
  // the kevesh flies its last 2 amot (Rambam BhB 2:13): ground piece ends at the yesod line, undersides clear the altar's tiers
  { const kv = E('altar.kevesh').params;
    eq('kevesh ground piece = 30', kv.groundPiece.max[1] - kv.groundPiece.min[1], KEVESH_GROUND);
    check('kevesh flying span starts where the ground piece ends', kv.flying[0].y[0] === kv.groundPiece.max[1] && kv.flying[kv.flying.length - 1].y[1] === Y_KEV_TOP); }
  // the soreg breaches keep clear of the passages
  for (const st of E('mount.soreg.breaches').params.stations) {
    const v = st.side === 'N' || st.side === 'S' ? st.pos[0] : st.pos[1];
    check(`breach ${st.n} (${st.side}) clear of the soreg passages`, !E('mount.soreg').params.passages.some((ps) => ps.side === st.side && v > Math.min(ps.from, ps.to) - 1 && v < Math.max(ps.from, ps.to) + 1));
  }
  // F1: "high in the Kodesh walls, above the ta'im roofline" (Part VII §22); the climb to the aliyah door (Middot 4:5)
  for (const id of ['heichal.taim.north', 'heichal.taim.south', 'heichal.taim.west', 'heichal.taim.roofs', 'heichal.mesibah', 'heichal.ta-wall.north', 'heichal.ta-wall.south', 'heichal.mesibah-wall', 'heichal.outer-wall.south'])
    check(`${id} stays below the F1 windows`, E(id).box.max[2] < E('heichal.windows.f1').box.min[2]);
  check('F1 windows lie in the Kodesh height', E('heichal.windows.f1').box.max[2] <= Z_KOD_TOP && E('heichal.windows.f1').box.min[2] > Z_HEICHAL);
  { const rs = E('heichal.taim.roof-stair').params, door = E('heichal.aliyah.door').box, f1 = E('heichal.windows.f1').box;
    check('roof stair climbs from the ta\'im roofs to the aliyah floor', rs.climb.from[2] === Z_TAIM_ROOF && rs.climb.to[2] === Z_ALIYAH && rs.climb.steps * rs.climb.rise === Z_ALIYAH - Z_TAIM_ROOF);
    check('roof stair landing meets the aliyah door at its sill', rs.landing.topZ === door.min[2] && rs.landing.box.min[0] <= door.min[0] && rs.landing.box.max[0] >= door.max[0] && rs.landing.box.max[1] === door.min[1]);
    check('roof stair flight keeps 3+ amot clear of the F1 windows', !overlap2D(rs.climb.box, { min: [f1.min[0], f1.min[1] - 3], max: [f1.max[0], f1.min[1]] }));
    check('roof stair landing passes above the F1 band', rs.landing.box.min[2] > f1.max[2]); }
  { const tr = E('heichal.taim.roofs').params;
    for (const [name, v] of Object.entries(tr.openVoids)) check(`ta'im roof pieces leave the ${name} open`, !tr.pieces.some((p) => overlap(p, v))); }
  check('the mesibah rises to the ta\'im roofs (Middot 4:5)', E('heichal.mesibah').params.to[2] === Z_TAIM_ROOF);
  // rooms inside the court walls are listed on the wall (openings / voids / replacedBy / alsoPierces) or sit in a cutout
  for (const wid of ['azarah.wall.north', 'azarah.wall.south', 'azarah.wall.east', 'azarah.wall.west', 'en.wall.north', 'en.wall.south', 'en.wall.east']) {
    const w = E(wid), refs = new Set(['openings', 'voids', 'replacedBy', 'alsoPierces'].flatMap((k) => [].concat(w.params[k] ?? []))), cuts = (w.params.cutouts || []).map((c) => c.box);
    for (const e of Object.values(SITE.elements)) {
      if (e.id === wid || !e.box || e.params.path || e.id.startsWith('mount.soreg') || !['chamber', 'gate', 'opening', 'fixture', 'stair'].includes(e.kind) || !overlap(e.box, w.box)) continue;
      check(`${wid}: ${e.id} lies in the wall and is listed on it or sits in a cutout`, refs.has(e.id) || cuts.some((c) => inside(e.box, c)));
    }
  }
  check('Beit Avtinas and the roof mikveh stand on the open Water Gate roof terrace', ['azarah.beit-avtinas', 'azarah.mikveh.mayim-roof'].every((id) => E('azarah.wall.south').params.cutouts.some((c) => inside(E(id).box, c.box))));
  // the dawn inspection circuit and the amah keep clear of every structure
  { const skip = new Set(['azarah.floor', 'azarah.ezrat-yisrael', 'mount.soreg', 'mount.soreg.breaches', 'azarah.amah-channel', 'altar.rings']);
    const solids = Object.values(SITE.elements).filter((e) => e.box && !skip.has(e.id) && !['zone', 'floor', 'opening', 'gate', 'curtain', 'stair'].includes(e.kind) && !e.id.startsWith('context.')).map((e) => [e.id, solidBoxes(e)]);
    for (const [name, pts] of Object.entries(E('azarah.achsadra-route').params.routes)) {
      let hit = null;
      for (let i = 0; i + 1 < pts.length && !hit; i++) {
        const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
        for (let k = 0; k <= n && !hit; k++) {
          const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
          for (const [id, boxes] of solids) if (boxes.some((q) => x > q.min[0] && x < q.max[0] && y > q.min[1] && y < q.max[1] && q.min[2] < z + 1.5 && q.max[2] > z + 0.2)) { hit = `${id} at (${r6(x)}, ${r6(y)})`; break; }
        }
      }
      check(`dawn circuit (${name} company) is clear of every structure${hit ? ` — hits ${hit}` : ''}`, !hit);
    }
    const segs = E('azarah.amah-channel').params.openSegments;
    check('amah: the open channel lies in the Azarah pavement', segs.every((s) => s.min[0] >= X_AZ_W && s.max[0] <= X_EK_W && s.min[1] >= Y_AZ_S && s.max[1] <= Y_AZ_N && s.max[2] === Z_AZ));
    for (const id of ['altar.kevesh', 'altar.kevesh.ramp-yesod', 'altar.table.marble', 'altar.table.silver', 'altar.yesod', 'altar.shit-slab', 'altar.kiyor.muchni', 'altar.ulam-steps'])
      check(`amah: the open channel passes clear of ${id}`, !segs.some((s) => solidBoxes(E(id)).some((q) => overlap2D(s, q)))); }
  // the night watch: 24 posts — 3 kohanim, 21 Leviim (Middot 1:1; Rambam BhB 8:4)
  { const posts = E('mount.watch-posts').params.posts;
    eq('watch posts', posts.length, 24); eq('kohanic watch posts', posts.filter((q) => q.by === 'kohanim').length, 3); }
  // Mount wall feet meet at the corners (no open corner column)
  for (const s of ['south', 'north']) { const pr = E(`mount.wall.${s}`).params.footProfile.points;
    check(`mount.wall.${s}: foot drops to the W wall's foot at the corner`, pr[0][1] <= E('mount.wall.west').params.outerFootZ + 1e-9 && pr[1][1] <= E('mount.wall.west').params.outerFootZ + 1e-9);
    check(`mount.wall.${s}: foot drops to the E wall's foot at the corner`, pr[pr.length - 1][1] <= E('mount.wall.east').params.outerFootZ + 1e-9 && pr[pr.length - 2][1] <= E('mount.wall.east').params.outerFootZ + 1e-9);
    check(`mount.wall.${s}: box reaches the lowest point of its foot`, E(`mount.wall.${s}`).box.min[2] <= Math.min(...pr.map((q) => q[1])) + 1e-9); }
  // EN corner chambers stay under the low east wall; the Shushan chamber holds the two amot and costs the Parah line nothing
  for (const id of ['en.chamber.wood', 'en.chamber.nazirites', 'en.chamber.lepers', 'en.chamber.oil']) check(`${id} stands no higher than the EN east wall`, E(id).box.max[2] <= E('en.wall.east').box.max[2]);
  { const ch = E('mount.gate.shushan.chamber'), sa = ch.params.standardAmot;
    for (const k of ['ne', 'se']) check(`Shushan HaBirah: the ${k.toUpperCase()} standard amah hangs inside the chamber`, sa[k].at.every((v, i) => v >= ch.box.min[i] - 1e-9 && v <= ch.box.max[i] + 1e-9));
    check('Shushan HaBirah: the NE amah is ½ etzba long and the SE 1 etzba long over the amah', Math.abs(sa.ne.lengthAmot - (1 + ETZBA / 2)) < 1e-6 && Math.abs(sa.se.lengthAmot - (1 + ETZBA)) < 1e-6);
    const withC = parahSightLine().visibleAmot, without = parahSightLine({ walls: { shushanChamber: 0 } }).visibleAmot;
    check(`Shushan HaBirah chamber costs nothing on the real-topography Parah line (${withC} vs ${without})`, Math.abs(withC - without) < 1e-6);
    check('Gemara level-line model still sees part of the doorway with the chamber', parahSightLine({ level: true }).passes); }
  // ---- site-model-2 checks (builders' requests; docs/decisions/site-model-2.md) ----
  // the Water Gate roof: a stair a person can pass, a mikveh of at least amah x amah x 3 inside its walls, an open walk to Beit Avtinas
  { const h = E('azarah.gate.mayim.house'), rs = h.params.roofStair, mk = E('azarah.mikveh.mayim-roof').box, walk = h.params.terraceWalk.box, av = E('azarah.beit-avtinas').box;
    check('Water Gate roof stair: radius ≥ 1.9 (a person passes) and inside the gatehouse', rs.radius >= 1.9 && inside(rs.box, h.box));
    check('Water Gate roof mikveh: water ≥ 1 x 1 x 3 inside 0.4-amah walls (Yoma 31a)', mk.max[0] - mk.min[0] - 0.8 >= 1 && mk.max[1] - mk.min[1] - 0.8 >= 1 && mk.max[2] - mk.min[2] >= MIKVEH_DEPTH);
    check('Water Gate terrace walk runs from the stair head to Beit Avtinas, clear of the mikveh and the stair well', walk.min[0] <= av.max[0] + 1e-9 && walk.max[0] >= rs.box.min[0] - 1e-9 && !overlap2D(walk, mk) && !overlap2D(walk, { min: [rs.box.min[0] + 1e-6, rs.box.min[1]], max: rs.box.max }) && walk.max[1] - walk.min[1] >= 1.5);
    check('Water Gate roof mikveh stands clear of the stair well', mk.max[0] <= rs.box.min[0] + 1e-9); }
  { const me = E('azarah.chamber.medichin'), ms = me.params.mesibah;
    check('Medichin winding stair: radius ≥ 1.9 within its box, inside the chamber', ms.radius >= 1.9 && inside(ms.box, me.box) && ms.center[0] - ms.radius >= ms.box.min[0] && ms.center[0] + ms.radius <= ms.box.max[0] && ms.center[1] + ms.radius <= ms.box.max[1]);
    const d = me.params.door;
    check('Medichin door (north face) clear of its winding stair', !overlap2D({ min: [d.x[0], me.box.max[1] - 1], max: [d.x[1], me.box.max[1]] }, ms.box)); }
  // chamber doors fit under their roofs (Middot 2:3's 20 x 10 is the gates' standard, not the chambers') and keep jambs
  for (const id of ['azarah.chamber.gazit', 'azarah.chamber.etz', 'azarah.chamber.golah', 'azarah.chamber.melach', 'azarah.chamber.parvah', 'azarah.chamber.medichin', 'azarah.chamber.pinchas', 'azarah.chamber.chavitin']) {
    const e = E(id), ds = id.endsWith('gazit') ? e.params.doors : [e.params.door];
    for (const d of ds) check(`${id}: door has a height that fits under the roof slab (z ${d.z})`, Array.isArray(d.z) && d.z[0] === e.box.min[2] && d.z[1] <= e.box.max[2] - 1);
  }
  { const d = E('azarah.chamber.gazit').params.doors[0], gz = E('azarah.chamber.gazit').box, go = E('azarah.chamber.golah').box;
    check('Gazit east door keeps 1-amah piers at the chamber corner and before the Golah', d.y[0] >= gz.min[1] + 1 && d.y[1] <= go.min[1] - 1); }
  check('chamber roofs not above the gate roofs (the Parvah-roof mikveh under the En-Eitam head, Yoma 31a)', E('azarah.chamber.parvah').params.roofMikveh.waterSurfaceZ <= Z_AZ + 23);
  // the nanasin: dwarf pillars, the hook rows within a standing kohen's reach; the small sovev ramp carried on the kevesh
  { const n = E('altar.nanasin').params;
    check('nanasin: the three hook rows within reach (≤ 4 amot over the court)', n.hookRowsZ.length === 3 && Math.max(...n.hookRowsZ) <= Z_AZ + 4 && n.topZ === E('altar.nanasin').box.max[2]); }
  { const r = E('altar.kevesh.ramp-sovev'), p = r.params;
    check('small ramp to the sovev: carried on the kevesh (underside above the pavement), meeting it at the junction; box to the pavement', !p.solidToFloor && r.box.min[2] === Z_AZ && p.undersideZ > Z_AZ && Math.abs(p.from[2] - kevZ(p.from[1])) < 1e-4 && p.undersideZ < Z_SOVEV); }
  // the Ulam chains reach down to a climber; the lul is a curtained slot through the KhK's own wall; the gate curtain stands clear
  { const c = E('heichal.ulam.chains').box;
    check('Ulam chains hang from the ceiling to within reach of the floor (Middot 3:8 "they climb them")', c.max[2] === Z_KOD_TOP && c.min[2] - Z_HEICHAL >= 3.5 && c.min[2] - Z_HEICHAL <= 4.5); }
  { const l = E('heichal.lul-west');
    check('lul: pierces the KhK west wall (EK II 178–179), curtained, not a passage', l.box.max[0] === X_KHK_W && l.box.min[0] === X_HEI_W && l.params.smallCurtain && l.params.walkThrough === false); }
  check('Heichal gate curtain hangs clear of the wall face', E('heichal.gate-curtain').box.min[0] - X_ULAM_IN_W >= 0.05);
  check('Menorah: ner ma\'aravi is lamp 1 from the east (lock #11 E–W; Tamid 6:1)', E('heichal.menorah').params.nerMaaravi.lamp === 1 && E('heichal.menorah').params.lampRow === 'E–W');
  // the Chuldah stairs: whole risers within 1% of ½; the Kiponus approach level to where the slope regains the platform
  for (const k of ['w', 'e']) { const s = E(`context.chuldah.tunnel-${k}`).params.stairPath;
    check(`Chuldah ${k}: whole risers (${s.risers}), each within 1% of ½ amah`, Number.isInteger(s.risers) && Math.abs(s.rise - STEP_RISE) <= 0.005 && Math.abs(s.risers * s.rise - (s.to[2] - s.from[2])) < 1e-4 && Math.abs(s.to[1] - s.from[1] - s.risers * STEP_TREAD) < 1e-6); }
  { const k = E('context.kiponus-approach').box;
    check('Kiponus approach: level deck at the threshold from the W wall to where the slope regains 740 m', k.max[0] === -MOUNT_WALL_T && k.max[2] === E('mount.gate.kiponus').box.min[2] && topoAt('W', kiponusEndM) >= DATUM_ASL - 1e-9 && topoAt('W', kiponusEndM - 1) < DATUM_ASL); }
  // the east corners of the Azarah: the high N/S walls run through the corner squares; the low E wall spans between them
  { const e = E('azarah.wall.east').box, n = E('azarah.wall.north').box, s = E('azarah.wall.south').box;
    check('Azarah E wall spans between the N and S walls; they run through the corner squares (no notch)', e.min[1] === s.max[1] && e.max[1] === n.min[1] && n.max[0] === X_EN_W && s.max[0] === X_EN_W && E('en.wall.north').box.min[0] === X_EN_W); }
  // the Parah burning place: the kohen stands on the arrangement east of the heifer (Parah 3:9)
  { const py = E('context.parah.pyre'), p = py.params;
    check('Parah: the kohen stands on the arrangement, within its top', p.kohenStand[2] === py.box.max[2] && p.kohenStand[0] > py.box.min[0] && p.kohenStand[0] < py.box.max[0]);
    check('Parah: the heifer lies on the top, west of the kohen', p.heifer.box.min[2] === py.box.max[2] && p.heifer.box.max[0] < p.kohenStand[0] && p.heifer.box.min[0] >= py.box.min[0]);
    check('Parah: the eye is the standing eye over the stand', Math.abs(p.kohenEye[2] - p.kohenStand[2] - EYE_M / AMAH) < 1e-4 && p.kohenEye[0] === p.kohenStand[0]);
    check('Parah: the arrangement no longer stands between the eye and the Heichal', p.kohenEye[2] > py.box.max[2]);
    check(`Parah sight-line passes from a viewer on the crest ground, no pyre (${parahSightLine({ stand: 'ground' }).visibleAmot})`, parahSightLine({ stand: 'ground' }).passes); }
  // the kiyor well is listed for the court-fill carve and stays clear of the Ulam steps and the open amah
  { const sh = (E('azarah.floor').params.shafts || []).find((s) => s.id === 'altar.kiyor.muchni');
    check('kiyor well listed in azarah.floor params.shafts (carved from the court fill)', !!sh && sh.box === E('altar.kiyor.muchni').params.well);
    check('kiyor well clear of the Ulam steps and the open amah channel', !!sh && !overlap2D(sh.box, E('altar.ulam-steps').box) && !E('azarah.amah-channel').params.openSegments.some((s) => overlap2D(s, sh.box))); }
  // stoa overhangs recorded; the Parah line clears them (they are obstacles in parahSightLine)
  for (const s of ['south', 'north', 'west', 'east']) check(`mount.stoa.${s}: overhangs recorded with boxes`, E(`mount.stoa.${s}`).params.overhangs.every((o) => isBox(o.box)));
  // zones
  for (const z of CANONICAL_ZONES) check(`zone ${z} defined`, !!(SITE.zones[z] && SITE.zones[z].boxes.length));
  const zp = [
    [[X_CX_E + 8, AXIS_Y, 0.5], 'chel'], [[300, 120, 1], 'har-habayit'], [[ALT_CX, ALT_CY, Z_ALT_TOP + 1], 'mizbeach'], [[(X_KHK_W + X_KHK_E) / 2, AXIS_Y, 30], 'kodesh-hakodashim'],
    [[(X_KODESH_W + X_KODESH_E) / 2, AXIS_Y, 30], 'heichal'], [[116.5, AXIS_Y, 30], 'amah-traksin'], [[330, 330, 8], 'ezrat-nashim'], [[250, 300, 14], 'ezrat-yisrael'], [[238, 300, 17], 'ezrat-kohanim'],
    [[120, 280, 17], 'azarah'], [[217, 360, 17], 'slaughter-zone'], [[190, 300, 17], 'bein-haulam-lamizbeach'], [[KIY.cx, KIY.cy, 17], 'kiyor'], [[190, AXIS_Y, 19], 'ulam-steps'],
    [[168, AXIS_Y, 30], 'ulam'], [[168, 370, 30], 'beit-hachalifot'], [[120, 349, 30], 'taim'], [[120, 359, 40], 'mesibah'], [[130, AXIS_Y, 80], 'aliyah'], [[130, AXIS_Y, 113], 'roof'],
    [[60, 385, 17], 'gazit'], [[MOKED_CX, 400, 17], 'beit-hamoked'], [[MOKED_CX, 393, 17], 'beit-hamoked'], [[217, 291, 20], 'kevesh'], [[265, AXIS_Y, 9], 'fifteen-steps'], [[257.5, AXIS_Y, 15], 'nikanor'],
    [[mE(200), AXIS_Y, zM(680)], 'kidron'], [[mE(700), AXIS_Y, zM(800)], 'har-hamishchah'], [[mE(100), AXIS_Y, -1], 'parah-causeway'], [[-500, -500, 0], 'outside'],
    [[502.5, AXIS_Y, 5], 'gate-shushan'], [[AZ_GATE_CX[2], 250, 10], 'gate-mayim'], [[MOKED_CX, 415, 5], 'gate-moked'], [[393, 310, 17], 'en-gallery'], [[375, 375, 10], 'en-chamber-wood'],
    [[10, 250, 5], 'stoa'], [[203.75, 420, -8], 'underground-passage'], [[205, 455, -8], 'beit-hatevilah'], [[205, 262, 40], 'beit-avtinas'], [[112, 398, 40], 'beit-hanitzotz'],
    [[170, AXIS_Y, 80], 'ulam-upper'], [[230, AXIS_Y, 80], 'azarah'], [[120, 300, 75], 'azarah'], [[300, 330, 80], 'ezrat-nashim'], [[120, 349, Z_TAIM_ROOF + 1], 'taim-roofs'], [[124, 305.5, 62], 'taim-roofs'],
    [[502.5, AXIS_Y, 25], 'shushan-habirah'], [[250, 395, 15], 'lishkat-hakelim'], [[327.5, 398, 8], 'lishkat-chashaim'], [[174.5, 426, 3], 'lishkat-hakorban'], [[148.5, 426, 3], 'lishkat-haparochet'],
    [[375, 440, 3], 'beit-haeven'], [[80, 395, 17], 'etz-parhedrin'], [[93, 386, 17], 'golah'], [[223, 262, 37], 'beit-avtinas'], [[45, 390, 5], 'chel'],
    [[250.5, 341.5, Z_EY + 0.4], 'lishkat-pinchas'], [[257.5, 343, Z_EY + 0.4], 'lishkat-pinchas'], [[250.5, 319.5, Z_EY + 0.4], 'lishkat-chavitin'], [[257.5, 318, Z_EY + 0.4], 'lishkat-chavitin'],
    [[250, 336, Z_EY + 0.4], 'ezrat-yisrael'], [[(E('context.kiponus-approach').box.min[0] - MOUNT_WALL_T) / 2, KIPONUS_Y, 0.4], 'outside'],
    [[-MOUNT_WALL_T - 40, KIPONUS_Y, 0.4], 'outside'], [[-MOUNT_WALL_T / 2, KIPONUS_Y, 0.4], 'gate-kiponus'],
  ];
  for (const [[x, y, z], want] of zp) { const got = zoneAtSite(x, y, z); check(`zoneAt(${r6(x)}, ${r6(y)}, ${r6(z)}) = ${got}, want ${want}`, got === want); }
  // the Parah sight-line must pass with the locked walls (default amah)
  const sl = parahSightLine();
  check(`Parah sight-line passes (visible ${sl.visibleAmot} amot of the doorway)`, sl.passes);
  return { ok: failures.length === 0, count, failures };
}
