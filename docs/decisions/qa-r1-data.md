# qa-r1-data — decisions (src/data/**, tools/validate-schedule.mjs, tools/coverage.mjs)

Fixes for QA round 1, data findings DATA-1 to DATA-4. Format: **Choice** — why (source / evidence) — alternative.
⚙ = reconstruction. Shots: `shots/qa-r1-fix-data/` (low tier, weekday 2026-11-02 unless noted): `before/`, `r1`–`r3/`
(candidate views), `after/`.

## DATA-1 — no internal report references in public text

- **Every `Report §N` / `lock #N` / "the report's …" in a user-facing string is replaced by what the claim rests on:
  the primary source, a named commentator, or `Reconstruction (model)`** — the report is not published with the site,
  so these were dead grey chips. Touched: schedule.js (≈ 70), zones-content.js (≈ 150), offerings.js (9), glossary.js
  (13). Code comments keep their report references. site.js's 82 references are left alone: its `sources`/`notes`
  are never shown (the map reads only its boxes).
- **The loci used, checked against the texts**: Bartenura on Middot 1:4–5 (Delek = wood, Bechorot = firstlings,
  Korban = most-holy offerings — the old "§7.3"); Bartenura on Middot 2:3 (soreg a lattice; the Chel "an open place of
  ten amot" inside it); Rambam BhB 5:17 (Parhedrin = Lishkat HaEtz in the northern trio — lock #20; with Yoma 19a lock
  #7); Yoma 31a (first immersion "beside his chamber" on the Water Gate); Mishnah Yoma 4:5 (up the ramp on the east,
  down on the west; the Kohen Gadol by the middle on Yom Kippur — the old "§10.8/§65.2"); Yoma 15b (every turn to the
  right); Mishnah Shevuot 2:3 (one made impure in the court leaves by the short way — the old "§59" exit rule);
  Pesachim 85b (Nikanor's gateway left unsanctified "because metzora'im stand there", R. Shmuel bar Rav Yitzchak —
  this also settles errata #3); Pesachim 86a (Abba Shaul: the place over the KhK entered "once in a shavua"; the other
  views twice in a shavua, once in a jubilee — hence seven years); Tosefta Sanhedrin 7:1 (the beit midrash on Har
  HaBayit on Shabbat); Bartenura on Shekalim 4:4 (kayitz hamizbeach "when the altar is idle"); Bartenura on Tamid 5:5
  (letech = 15 se'ah); Bartenura on Middot 3:7 (milah = the gall-nut tree, an oak); Rambam KhM 4:11 (batei avot, one
  day each); Rashi on Shabbat 90a (kalya orev plates edged like knives, set with nails); Menachot 4:5 and 6:5
  (chavitin: a whole isaron halved; twelve loaves); Sukkah 45a (the itztaba beside "Har HaBayit was a double stoa").
- **Ezrat Kohanim is cited by the mishnah it comments on, not by page** (`Ezrat Kohanim on Middot 5:4`) — the report's
  "EK I/II p.N" are PDF page numbers of the project's scans (report §45), useless to a reader with a printed copy. The
  mishnah was read from the running heads of the cited scan pages: I 148–154 → 1:6; I 167–168 (plan legend, gate
  stations) → 1:9; I 174–188 (walls) → 2:1; I 202–215 (soreg and Chel) → 2:3; I 253–254 (Nikanor's wickets) → 2:6;
  II 104–105 → 4:3; II 180–188 → 4:7; II 233–253 → 5:3–4; II 247–250 (margins) → 5:4. In prose it is "the commentary
  Ezrat Kohanim", since Ezrat Kohanim is also a court here. Shiltei HaGiborim by chapter (`ch. 3`).
- ⚙ **Where the report's claim had no source behind it, the text now says reconstruction**: the Golah wheel's Levites
  and the gatekeepers at Nikanor (§61, the report's composite day), where the kohanim ate (§62), the seals in the NE
  corner chamber (§9.2/§60), Lishkat HaKelim = the dawn vessel store (§9.3/§60), Lishkat HaParochet as a weaving room
  (§9.3/§23 — no commentator found: not Bartenura, Rambam's commentary or Tosafot Yom Tov on Middot 1:1), Lishkat
  HaKorban's stores, the Friday blasts from the Water Gate roof (§33.1; Shabbat 35b's roof is the town chazan's, cited
  as the analogy), the 23-court at Ezrat Nashim (§4.6), the court's drain under the Water Gate (§9.4).
- **The "report's clock" notes now give the source or say reconstruction**: Gevini at cock-crow (Yoma 1:8; Tamid 1:2),
  Barkai "at first light" with the hour to the slaughter the model's, the incense and lighting with the afternoon
  tamid rather than at dusk (errata #2).
- **`validate-schedule.mjs` now fails on a dead reference in any public string** (events, zones, offerings, stations,
  nesachim, glossary: `§N`, `lock #N`, "the report") — it flags 75 in the old schedule.js. The UI fixer may add
  Sefaria links for `Bartenura on …`, `Tosefta …`, `Rashi on …` (request).

## DATA-2 — Go/anchor views

Measured with an in-page harness (Go-instant through `ctx.schedule.viewOf`, as the UI's Go): the arrival pose, the
eye-ray distance, figures near the event. In the current build the authored heading is applied; several QA frames
(compass ≈ 250° for any event) were taken before that.

- **dishun-men: window sunrise −15 → −5 became −6.5 → −5; view [168, 362, 22] h190 (inside the Ulam, north end,
  looking south along the facade)** — the choreography (gates.js) only stages the two men from ≈ −7.3 (a walk from the
  Gazit) to ≈ −5.5 (through the wicket), so for two-thirds of the old window nobody was there; and the old spot stood
  2.4 m from the facade. Now the opening's curtains, the men reaching the north wicket and the great gate further
  along the same wall (it opens at −4.5) are in one frame (after/a-dishun-men.png). Order kept: vessels → dishun-men →
  great-gate. Alternative: the court before the Ulam (sees the walk, not the wicket).
- **memuneh-knock [210.75, 399.5] h0** — back to the hall's middle: the hearth, the kohanim and the officer in the open
  chel door; the upper frame is the night beyond the 20-amah door, not a void.
- **seals [208.5, 399] h50** — the two officers stand by the keys slab, 1.7 m from the old spot; now both, the hearth and
  the north-east chamber's door are in frame.
- **lamb-brought [209, 377.5] h10, from the court** — the kohen holds the lamb just outside the Moked gate, which is shut
  until the gates open (he went out by the wicket, Tamid 1:3): from inside the hall the view is a shut leaf. Seen
  between the 207 and 211 nanasin, the gate and its wicket behind.
- **parvah [134.5, 279.5] h205** — from the bright court through the open door: the salting kohen and the hides.
- **moked-night: new `V.mokedLedges` [217.5, 405] h250** (V.moked stays for first-lottery) — the elders on the west
  ledges, the rashei pispasin, the sleepers and the hearth instead of the bare north wall.
- **gate-levites [270.5, 323.5, 11.5] h290, on the eleventh step** — both gatekeepers at Nikanor's wickets, people
  passing; validate-schedule now computes the floor of the fifteen steps from site.js `stepRadii`.
- **songs (5 events): `V.duchan` [239.5, 372] h175, north end of Ezrat Kohanim looking south** — the sim stands the
  people in the north half of Ezrat Yisrael (Y 348–384), the Levites on the duchan at Y 321–344 and the altar to the
  south-west: only a view from the north holds all three (r4/s-song-a.png). The Levites read small; request to the sim to stand the
  public east of the duchan, after which the same view frames them better. Alternative: the old [234, 342] h140
  (Levites large, no people, no altar).
- **`V.heichalNE` [142.5, 335.5] h225 (inner-clearing, into-heichal)** — the Menorah's lamps run east–west, so a
  three-quarter view needs equal east and north offsets from it; the golden altar is in frame too.
- **Unchanged, verified: lamb-watered (the frame shifts 2 amot east off a figure — fine), sanhedrin (the two scribes
  frame the semicircle; the player fix keeps the centre clear).**
- **Not mine, requested: `heichal.kodesh` anchor → [145, 337, 22] h238** (Menorah at three-quarters, golden altar, table
  — r3/r3-kodesh-anchor.png; the entrance cannot give a three-quarter view); **`mount.har-hamishchah` pitch −2.5 → ≈ −4**
  (centres the Heichal; its size is set by the 800 m and the FOV).
- **validate-schedule.mjs: an eye-ray lint (warning)** — from the eye along the heading at −4°, solid fabric within
  8 amot (≈ 4 m), or a chamber entered from outside that does not hold the event. It catches walls; door leaves are not
  in site.js (the old dishun, lamb-brought and seals frames were blocked by leaves), so the Go shots remain the check.

## DATA-3 — Shabbat-night summaries

- **Day-neutral wording rather than split events**: the officer's summary says "torches burning before him — except on
  Shabbat night", the sleeping guard's "may burn his garment — but never on Shabbat night"; the descriptions give the
  reasons and the sources gain Rambam BhB 8:12 and Shemot 35:3 — night-watch.js reads `ish-har-habayit` and
  `sleeping-guard` by id (patrol window, live view), and the night wraps the civil date line, so a split needs four
  events and a sim change. Alternative: split by dayTypes with `clock()` cuts at midnight plus a sim lookup by choreo.
- **No burning on Shabbat is law (Shemot 35:3); no torches is by analogy** with the dawn inspection, which on Shabbat
  nights carried no fire but went by the lamps lit before Shabbat (Rambam BhB 8:12) — labelled the model's choice.

## DATA-4 — the firstling's bringer

- **bechor arrive: "The kohen it was given to brings it in by Sha'ar HaBechorot"** (≤ 64 chars, g5's shortStep), with
  Bamidbar 18:17–18 and Bartenura on Middot 1:4 (the gate named for the firstlings) — the step already gave the arrive to
  a kohen in his own clothes, as the sim draws him.
