# zones-content — decisions

`src/data/zones-content.js` (66 zones: the 58 canonical + 8 site-model sub-zones) and `src/data/glossary.js` (315 terms, covering zones-content and schedule.js).
Each bullet: choice — why — the alternative.

## Sanctity rungs
- **`sanctity` counts the ladder from 0 (Eretz Yisrael) to 10 (Kodesh HaKodashim); Har HaBayit = 3.** — Rambam BhB 7:12–13 counts this way, and it is the only 0..10 scale on which the KhK keeps a rung of its own; the rungs and their order are those of Report §0.5. The UI detects it (`har-habayit === 3`). `SANCTITY_SCALE` exports the eleven rungs. — §0.5's 1-based numbers (Har HaBayit 4, Heichal 10), with the KhK either sharing 10 or at 11.
- **Roofs and upper storeys (roof, taim-roofs, ulam-upper, beit-avtinas, beit-hanitzotz, shushan-habirah) at Har HaBayit's rung (3).** — Rambam BhB 6:7: "the roofs and the upper storeys were not sanctified"; the Water Gate's roof was chol (Yoma 3:3, 31a). The sources give such places no rung; 3 is the precinct around them. — The rung of the space below, or of the only way in (the Heichal).
- **The aliyah at the Heichal's rung (9).** — Despite 6:7, Rambam BhB 7:23 restricts the place over the KhK ("once in a shavua", which Report §59 reads as once in seven years) and Middot 4:5 marks its line with rashei pispasin. — 10 for the part over the KhK; 3 like the other upper storeys.
- **Passages under the Mount (both Chuldah gates, underground-passage, beit-hatevilah) at Jerusalem's rung (2).** — Rambam BhB 6:9: passages opening to Har HaBayit are chol; 8:7: so a kohen with a night emission, barred from the Mount itself (Devarim 23:11), walks there. — Har HaBayit's rung (3).
- **Half-and-half chambers take one number:** Gazit 7 (the kodesh half — lotteries, prayers, the stand); Beit HaMoked 4 (the chol half where the kohanim slept, keys slab, stand). Each `sanctityNote` explains the split. — The other half's rung.
- **Etz/Parhedrin at 4 is an inference, labelled as such.** — No source gives its rung or its door. The KG slept there and no one may sit in the court (Yoma 25a; Rambam BhB 7:6), so the model reads it as built in kodesh and opening to chol (the general rule of Rambam BhB 6:7; Tosafot's plan as Ezrat Kohanim adopts it, Report §52), matching site.js's single north door to the Chel. Against it: Yoma 11a gives Nikanor a mezuzah because Parhedrin lay "inside it", i.e. reached through the court. — 7, with a door to the court.
- **Ta'im and mesibah at the Heichal's rung (9).** — Within the House's hundred amot and entered only through the Ulam and the NE ta; the sources say nothing of their sanctity. — The court's rung (7).
- **Amah traksin at the KhK's rung (10).** — Its status was the doubt itself (Yoma 51b–52a; Rambam BhB 4:2); the sources describe only the KG walking in it. — The Heichal's (9).
- **Nikanor, the fifteen steps, the music chambers, the gallery and the EN chambers at Ezrat Nashim's rung (5).** — Nikanor's threshold was left unsanctified (Pesachim 85b; Yoma 30b–31a); the steps rise "from within" EN; the cellars open into EN. — 6 for Nikanor and the steps.
- **Azarah gate zones at the court's rung (7)** although site.js's zone boxes include the outer stairs. — The gateway, in the wall's thickness, "is as within" (Rambam BhB 6:9). — 4 (the Chel the stairs descend through).
- **Kidron, Har HaMishchah and the causeway at 0; `outside` (the city) at 2.** — The Parah is burned "outside the camp" (Bamidbar 19:3); that the Kidron lay outside the city wall is an assumption, said so in the note. — 2 for all context.

## Stands
- **`stand` is `[X, Y, Z]`**, not `[X, Y]`. — Z picks the floor where levels stack (aliyah over the Kodesh, gallery over EN, tunnels under the Mount); player `goto.js` honours it and the UI's `data.point` accepts it. Every stand is checked: `zoneAtSite(X, Y, Z + 0.1 | 0.4 | 1.0) === id`. — 2-D stands, which can land on the wrong level in the stacked zones.
- **Landscape stands are computed from site.js elements** (Ophel grade, Kidron thalweg, Parah pyre). — These are metre-native and move with the amah standard. — Hard-coded numbers valid only at 48 cm.
- **`ulam-upper` has `stand: null`.** — build-heichal made the Ulam block above its ceiling solid; there is no walkable spot. The UI falls back to the zone centre. — The roof above (another zone).
- **Narrow places:** the amah-traksin stand is in the 4-tefach way between the curtains (curtains are not colliders); the soreg stand is in the east passage through the fence, the only walkable point of that thin zone.

## Content
- **Gate functions of Delek, Bechorot and Korban are given as readings of their names.** — Middot 1:4–5 names them only; the uses are the Report's (§7.3). — State the uses as fact.
- **Lishkat HaKorban and HaParochet: "named only as night posts".** — Middot 1:1 says nothing more; the curtain-workshop link is the commentators' (Report §9.3, §23).
- **No 13 shofar-chests or "treasury" in Ezrat Nashim.** — Shekalim 6:1, 6:5 say only "in the Mikdash" (site-model §8).
- **The achsadra of the dawn inspection is in the Azarah, not the Mount's colonnades.** — Tamid 1:3: the companies go from the Moked into the court. Report §2.3 can be read otherwise.
- **Beit Avtinas on the Water Gate is derived, not stated.** — Tamid 1:1 says only "upper chamber", Rambam BhB 8:5 "beside the gates of the court"; Yoma 19a/31a put one of the KG's two chambers "beside" the Water Gate immersion and leave open which (Rav Pappa leans to Parhedrin south). With Rambam's north Parhedrin (lock #20) the southern one is Avtinas. The Report states it as fact (§7.3, §60); the content marks it derived.
- **Thirteen prostrations: the breaches view (Middot 2:3) is shown at the soreg; the gates view (Shekalim 6:3; Abba Yosi b. Chanan, Middot 2:6) is given as the alternative.** The 4/4/3/2 side counts belong to the gates view; site.js borrows them to spread the breach stations, and the soreg's confidenceNote says so.
- **Lotteries: Gazit hosts the 2nd–4th; the 1st is in Beit HaMoked** (Tamid 1:2–3; 2:5).
- **Slaughter bands: Rambam's chain is built (8/12½/8/24/8 from the north wall; lock #4), Middot 5:2's chain (8/24/4/4/8 from the altar + remainder) is stated beside it.**
- **Times are relative** (cockcrow, first light, seasonal hours); exact minutes never appear.
- **Glossary keys are lower-case Sefaria-style transliterations with an `aka` list** (plurals, other spellings, English) for lookups; no two entries share an alias.
