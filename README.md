# Mikdash

Mikdash is a first-person 3D walk through Har HaBayit and the Second Temple in its final, Herodian form, running in the
browser with three.js. The building follows the measurements of Mishnah Middot and the daily service follows Mishnah
Tamid and the Rambam, hour by hour. You arrive a little before dawn at the steps of the Chel, east of the Temple, and
can walk anywhere on or near the Mount. Set the clock to any hour (told in seasonal hours, sha'ot zmaniyot), see what is
happening now and be walked to it, open the map to go to any place, and read who could enter each place, what was done
there and the sources for it. On weekdays, individuals' offerings fill the hours between the two daily tamid offerings,
and on ordinary nights the day's limbs and fats burn on the altar while the watch keeps its posts.

Live site: <https://ethanpil.github.io/mikdash/>

It needs a browser with WebGL 2. Everything (stone, gold, cloth, people, animals, sky and sound) is generated in the
browser from code, so the download is small. It runs on integrated graphics and adds detail on stronger GPUs.

## Running it locally

Use Node.js 24, the version the deploy workflow builds with. Vite 8 itself needs Node 20.19+ or 22.12+.

```sh
npm ci            # install the exact versions in package-lock.json
npm run dev       # dev server at http://127.0.0.1:5173/
npm run build     # production bundle in dist/
npm run preview   # serve dist/ at http://127.0.0.1:4173/
```

The deploy workflow runs `node tools/validate-schedule.mjs` before every build. Other checks:
`node tools/coverage.mjs` (no gap in watchable activity on any day type), `node src/sim/dev/run.mjs` (simulation
tests) and `node tools/shot.mjs "<query>"` (headless screenshots). See [ARCHITECTURE.md](ARCHITECTURE.md) section 15.

## Controls

Press `?` in the app for the full list for your device.

| Keyboard and mouse | |
|---|---|
| `W` `A` `S` `D`, or `Up`/`Down` | walk (`Left`/`Right` turn) |
| `Shift` | hold to run |
| Mouse | look around (click the view first; `Esc` frees the mouse) |
| `F` | fly / walk; while flying, `Space` or `E` rises, `Q` or `C` sinks |
| `T` | the hour: set any time, see what is happening now, go there |
| `I` | about this place: who may enter, what is done here, sources |
| `M` | the map: every place, its activity now, select and go (`/` searches) |
| `G` | settings: quality, length of the amah, volume, field of view and more |
| `?` | controls, method, sources and credits |
| `Esc` | close the open panel |

On a phone or tablet, drag with the left thumb to walk and with the right thumb to look; tap with two fingers to switch
between walking and running, and tap the clock for the hour. A gamepad also works: left stick walks, right stick looks,
LT runs, Y toggles flying.

When you choose an event or a place you pick a travel speed: instant, slow, walk, fast or run.

## Links to a time and place

Add these parameters to the address to share a moment. All are optional.

| Parameter | Meaning | Examples |
|---|---|---|
| `t=` | Time of day, Israel Standard Time. A clock time, a zman with an offset in minutes, or a seasonal hour (`d` day, `n` night). Default: 6 minutes before dawn (alot hashachar). | `t=05:30`, `t=sunrise+10`, `t=alot-6`, `t=d8.5`, `t=n11` |
| `date=` | Civil date, which sets the sun, moon and day type. Default 2026-11-02, an ordinary Monday (22 Cheshvan 5787). | `date=2026-11-07` (Shabbat) |
| `at=` | Where you stand, in site amot: X east, Y north, measured from the south-west corner of the Mount's 500 x 500 amot. The floor is found for you; an optional third number picks the level on stacked floors. | `at=217.8,344.2`, `at=140,333,22` |
| `look=` | Compass heading and pitch in degrees (0 north, 90 east; positive pitch looks up). | `look=270,5` |
| `q=` | Graphics quality. Default `auto`. | `q=low`, `q=medium`, `q=high`, `q=ultra` |

Also: `amah=naeh|feinstein|chazonish` picks the length of the amah (default R' Chaim Naeh, 48 cm), `fly=1` starts
flying, `fov=` sets the field of view (40 to 95). The full list, including debug switches, is in
[src/core/params.js](src/core/params.js).

Example, the slaughter of the afternoon tamid at eight and a half hours (Pesachim 5:1):
<https://ethanpil.github.io/mikdash/?t=d8.5&at=217.8,344.2&look=40,0>

## The research behind it, and its limits

Only traditional Jewish sources are treated as authorities: Tanakh, the Mishnah (Middot, Tamid, Yoma, Shekalim, Kelim,
Zevachim, Menachot and others), the Talmud, the Rambam's Mishneh Torah, the classic commentators, and Ezrat Kohanim
for placing the courts on the Mount. No non-traditional or Christian reconstruction is used, and no modern drawing is
taken as evidence. Every place and event in the app lists its sources, linked to the texts on Sefaria where Sefaria
has them.

The project was built from a research report of about 35,000 words and the Hebrew texts of the main tractates. Those
live in the author's workspace beside this repository (`../report/parts/` and `../sources/`) and are **not included in
this repository**. ARCHITECTURE.md, CLAUDE.md and docs/report-errata.md refer to them by those paths.
[docs/report-errata.md](docs/report-errata.md) lists the places where the report contradicted itself or its citation
and what the model does instead.

Limits you should know about:

- Where the authorities disagree (the shape of the Heichal, the side of the Azarah's six chambers, the single or double
  curtain, and others) the model shows one reading. The About panel (`?`, "Where the sources differ") names the reading
  shown and the one not shown, with sources for both.
- Every element of the site model is labelled `explicit` (a number stated in a source), `derived` (arithmetic from
  stated numbers), `locked` (a recorded choice between sources) or `reconstruction` (not fixed by the sources). An
  element takes the label of its weakest defining number, so many whose plan is in Middot are still `reconstruction`
  because a height or footprint is not given. Details are in [docs/site-model.md](docs/site-model.md).
- The sources give the order of the service, and seldom its minutes. In the app each event carries a badge: "Time
  sourced", "Order sourced · minutes reconstructed" or "Time reconstructed". Clock times are shown with ≈ because the
  Mishnah counts hours. Seasonal hours follow the Vilna Gaon (sunrise to sunset is twelve hours); dawn is the sun 16.1°
  below the horizon and nightfall 8.5°.
- The calendar knows weekdays, Fridays and Shabbat only. Festivals, Rosh Chodesh, Yom Kippur and Pesach are not
  simulated: a festival date shows an ordinary day of that weekday.
- Faces, clothing detail beyond what the sources describe, the melodies of the Levites' song, the fill of the city
  around the Mount and similar details are modest reconstructions. They are logged with their reasons in
  [docs/decisions/](docs/decisions/README.md).
- English renderings of verses and quotations are the project's own, kept close to the Hebrew. They are not taken from
  a published translation.
- The default amah is R' Avraham Chaim Naeh's 48 cm; R' Moshe Feinstein's (about 54 cm) and the Chazon Ish's (about
  57.6 cm) can be chosen in Settings. The Mount's surroundings stay at their real size in metres.

## Project documents

- [ARCHITECTURE.md](ARCHITECTURE.md): contracts between the parts, frames and units, ownership, verification tools.
- [docs/API.md](docs/API.md): the runtime API as built.
- [docs/site-model.md](docs/site-model.md): every element of the site model, how its numbers were derived, and its checks.
- [docs/decisions/README.md](docs/decisions/README.md): the decision logs, one per task, with the alternative not taken.
- [docs/report-errata.md](docs/report-errata.md): errors found in the research report and how they were resolved.
- [CLAUDE.md](CLAUDE.md): standing requirements and lessons for developers and coding agents.

## Credits and licences

Bundled code: [three.js](https://threejs.org/) (MIT), [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)
(MIT), [postprocessing](https://github.com/pmndrs/postprocessing) (Zlib) and [N8AO](https://github.com/N8python/n8ao)
(ISC in its package metadata; the LICENSE file it ships is CC0 1.0). The build writes their full licence texts to
`third-party-licenses.md` next to the page, so the live site serves them at
<https://ethanpil.github.io/mikdash/third-party-licenses.md>.

Typefaces: Cormorant Garamond, EB Garamond and Frank Ruhl Libre, under the SIL Open Font License 1.1. The page loads
them from Google Fonts, so visitors' browsers contact Google's font servers.

The Hebrew of the psalms and songs is from the Westminster Leningrad Codex (public domain). Source links open on
[Sefaria](https://www.sefaria.org/); no Sefaria text is bundled.

No textures, models, recordings or other downloaded assets are used.

This repository has no licence for its own code and content yet, so all rights are reserved by the author until one is
added.

## Deploying to GitHub Pages

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds and deploys on every push to `main`, and can be run
by hand from the Actions tab. It runs `npm ci`, validates the schedule, builds with the site's address from
`actions/configure-pages` (used for the share cards, so a custom domain needs no code change), and deploys `dist/`.

One-time setup: in the repository, open **Settings > Pages** and set **Build and deployment > Source** to
**GitHub Actions**. The workflow runs `configure-pages` without `enablement: true`, so it will not switch Pages on by
itself; until the source is set, the first run fails at that step.
