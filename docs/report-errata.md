# Errata found in the research report while building

The build agents cross-checked the report (`../report/parts/*.md`, in the author's workspace beside this repository and
not published with it) against the Hebrew primary texts.
These are places where the report contradicts itself or its citation. The model follows the resolution given.

| # | Report location | Problem | Resolution used in Mikdash |
|---|---|---|---|
| 1 | §27.2, §62 vs §28 #2 | All four lotteries placed in Lishkat HaGazit, but §28 #2 (and Tamid 1:2) has the first lottery before the wicket into the Azarah is opened | First lottery in Beit HaMoked (Tamid 1:2–3); lotteries 2–4 in the Gazit (Yoma 25a) |
| 2 | §28 #12 | Afternoon incense and menorah lighting at "dusk" | With the afternoon tamid, ≈ 9¼ seasonal hours (Tamid 6:1 order; Pesachim 5:1 times) |
| 3 | §59 #5 | Citation given for the unsanctified Nikanor gateway does not support it | Content cites the sources the verifiers confirmed; flagged in zones-content |
| 4 | §36.3 vs §28 #2 | Disagree on when Gevini's cry sounds | Shown at cockcrow (Yoma 1:8, 20b), with Rav / R' Shila on "keriat hagever" |
| 5 | §9.3 | Says Lishkat HaKelim was guarded per Middot 1:1 | Middot 1:1 does not list it; no guard shown there |
| 6 | §3 vs §33.2 | Where the Pesach groups waited (Pesachim 5:10) | §33.2 / the Mishnah: second group on Har HaBayit, third in the Chel |
| 7 | §2.3 | Implies the dawn inspection ran along the Mount's colonnades | Tamid 1:3 puts the two torch companies inside the Azarah |
| 8 | §12 / Register #25 | "Total run 22" for the Ulam stair only works with R' Yehudah's top rovad of 5 | Treads 3/3/3/4 (run 21) + a 1-amah level apron (reconstruction) |
| 9 | sample manifest (not the report) | Altar horns shifted 1 amah, crown +115, inner parochet inside the KhK, etc. | Corrected in `src/data/site.js`; see docs/site-model.md §7 |
