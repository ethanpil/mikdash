# qa-r1-fix-docs — decisions

## DOCS-1 — README, LICENSE flag, repo-relative site-model command

Reproduced: the repo root had no README.md or LICENSE (`ls`), and `docs/site-model.md:11` imported
`file:///C:/Code/temple-walk/mikdash/src/data/site.js`, which resolves only in this one checkout.

- **Live link `https://ethanpil.github.io/mikdash/`.** — No git remote is configured and `ethanpil/mikdash` does not
  exist yet (`gh repo view`); the active `gh` account is `ethanpil` and vite.config.js names the `/mikdash/` subpath.
  **The user must confirm the owner and repo name before publishing**; if they differ, change the three URLs in
  README.md (live site, example link, licence file). Alternative: no link until the repo exists.
- **No LICENSE added; README says "no licence yet, all rights reserved by the author until one is added".** — The user
  must choose: e.g. MIT or Apache-2.0 for the code and CC BY 4.0 or CC BY-SA 4.0 for the content (texts, data, decision
  logs), or all rights reserved on purpose. When chosen, add LICENSE (and LICENSE-content if split) and replace the last
  paragraph of "Credits and licences" in README.md. Alternative: say nothing, which leaves readers guessing.
- **Node 24 stated from the deploy workflow; package.json has no `engines` field.** Vite 8's own floor
  (`^20.19.0 || >=22.12.0`) is quoted beside it. Alternative: claim a package.json version that does not exist.
- **The licence-texts file is named as the build emits it: `third-party-licenses.md`** (vite.config.js
  `build.license`, verified with a scratch `vite build`: three, three-mesh-bvh, postprocessing, n8ao; no font licences).
  `src/ui/aboutpanel.js` links `third-party-licenses.txt`, which the build does not emit (requested from the owners).
- **N8AO credited as "ISC in its package metadata; the LICENSE file it ships is CC0 1.0".** — Both are in
  node_modules/n8ao; the About panel says ISC only. Alternative: ISC only (what the panel does).
- **Fonts: README says they load from Google Fonts and that browsers contact Google's servers.** — UI-10 (self-hosting)
  is blocked on a download (qa-r1-ui.md); update README when `FONTS_HOST` becomes null.
- **Research limits listed: one reading shown where authorities differ, site confidence labels, time badges, weekday /
  Friday / Shabbat only (festivals, Rosh Chodesh, Yom Kippur not simulated: `dayType` comes from the weekday alone,
  src/time/index.js), reconstructed visuals, own English renderings (audio-2.md), amah standards.** — Counts of
  confidence labels (which drift as fixers work) are left out; the README points to site-model.md and the in-app badges.
- **The `../report` and `../sources` references stay; each now says the directory is outside the repository**
  (ARCHITECTURE.md §0, CLAUDE.md "Ground truth", report-errata.md). — Developers and agents in the workspace still need
  the paths. Alternative: remove them, which would break the agents' instructions.
- **Example link `?t=d8.5&at=217.8,344.2&look=40,0`** is the `tamid-afternoon` event's own `view` (schedule.js, timing
  `explicit`, Pesachim 5:1). Checked with `tools/shot.mjs --q low`: kohanim at the slaughter, lamb on the ground.
- **Controls table follows `src/ui/controls.js`** (the list the `?` panel shows), not the player code directly.
  CLAUDE.md now says to keep README in step with controls.js, params.js and the About panel.
- **site-model.md command is `import('./src/data/site.js')` "from the repository root".** — A relative specifier in
  `node --input-type=module -e` resolves against the working directory; the old and new forms both print
  `{ ok: true, count: 1553, failures: [] }` here. The header's "1552 checks" was left as is: site.js is being edited
  concurrently, and that table is regenerated from site.js by its owner.
