# qa-r1-fix-core — decisions

Scope: `src/core/**`, `src/main.js`, `index.html`, `vite.config.js`, `tools/shot.mjs`, `.github/**`. Tasks CORE-1…5.
Format: **choice** — why — alternative. Shots: `shots/qa-r1-fix-core/{before,after,og}/`.

## CORE-1 — third-party license notices

- **`build.license: { fileName: 'third-party-licenses.md' }` (vite.config.js).** — the minifier keeps no license
  header in `three.core` and none for three-mesh-bvh, n8ao or postprocessing; Vite 8's license plugin writes one file
  with each bundled package's name, version, SPDX id and full LICENSE text (three MIT, three-mesh-bvh MIT,
  postprocessing Zlib, n8ao). At the dist root, not the default `.vite/license.md`: upload-pages-artifact skips hidden
  paths. Alternative: keep legal comments in the chunks (bigger chunks, and the n8ao/postprocessing headers are not
  `@license` comments, so they would still be lost).
- **n8ao is listed as "(ISC)" over a CC0 text.** — its package.json says ISC (npm's default), its LICENSE and README
  say CC0 1.0. The file reproduces both as published; CC0 asks for no notice anyway. Not patched.
- **Kept the `.md` name the other fixers link to.** — GitHub Pages serves it as `text/markdown`; Chromium shows that as
  text, some browsers may offer a download. Alternative: `.txt` (always shown inline) — would break UI-2/DOCS-1 links.

## CORE-2 — share cards

- **The site URL comes from the deploy, not from a guessed owner: the workflow passes `actions/configure-pages`'
  `base_url` as `MIKDASH_SITE_URL`; vite.config.js `siteUrl()` fills the `%MK_SITE_URL%` placeholder in index.html
  (canonical, og:url, og:image).** — the repo has no remote yet and the Pages owner is unconfirmed; `base_url` is
  right for any owner and for a custom domain. Without the variable (dev, local builds) those lines and the
  og:image details are dropped, so a local build never ships a wrong host. To check a build's cards locally:
  `MIKDASH_SITE_URL=https://<owner>.github.io/mikdash npm run build`. Alternative: hard-code `https://<owner>.github.io/mikdash/` (must be edited if
  the repo moves or gets a domain).
- **Tags: og:type, og:site_name, og:title, og:description, og:url, og:image (+ type, width, height, alt), canonical,
  twitter:card = summary_large_image.** — X falls back to og:title/description/image, so no twitter:title etc.
- **Share image `public/og-image.jpg`: the project's own dawn render, from the west slope of Har HaMishchah looking
  across the Kidron at the Temple, sunrise + 8 min on the default date, ultra, 1200 × 630, JPEG q 0.9 (126 kB).**
  `node tools/shot.mjs --q ultra --w 1200 --h 630 "t=sunrise%2B8&at=1911.7,290.5,114.1&look=271.8,-3.6&fov=40"`.
  — the opening view itself (pre-dawn at the Chel steps, `og-alot-6.png`) and its sunrise variants are a wall and a
  doorway: at card size (≈ 500 px wide) nothing reads. From the east at dawn the Mount, the Heichal facing the viewer,
  the Parah causeway and the city all read, and it is the sightline Middot 2:4 names (the eastern wall kept low so the
  kohen on Har HaMishchah sees into the Heichal). Candidates: `shots/qa-r1-fix-core/og/` (opening view, causeway,
  stoa roof, plaza, lookout). Alternative: the causeway on the axis (`og3-causeway-near.png`). PNG would be ~700 kB.
- **`public/apple-touch-icon.png`, 180 px: the favicon's glyph on a full-bleed ground.** — iOS masks the corners itself;
  a rounded tile would get a dark ring.

## CORE-3 — no WebGL 2

- **The renderer's own context creation is the WebGL 2 check, done before anything else starts (main.js).** — a
  separate probe canvas would create a second context on every successful boot; `WebGL2RenderingContext` exists even
  when WebGL is disabled (checked with `--disable-3d-apis`), so a global check misses the common case. On failure: no
  boot-chunk preloads, no bake worker (production run: only Vite's 5 entry preloads from index.html are fetched). Both
  now start right after the context is created instead of just before it: bootTimes start → 'context' (engine, tier,
  context together) is ~30 ms here, against a world build of 3–6 s that they overlap.
- **Not done: a classic-script fallback for browsers that cannot parse the ES2022 bundle** (they keep showing
  "Loading…"; e.g. pre-2021 Firefox, which had WebGL 2). Not asked; a candidate follow-up.
- **Plain guidance + Retry + folded detail.** "Mikdash needs WebGL 2, and this browser could not start it." / turn on
  hardware acceleration, update the browser or drivers, or use a current Chrome, Edge, Firefox or Safari. The detail
  holds the engine message, the browser's reason (`webglcontextcreationerror.statusMessage`) and the user agent — what a
  bug report needs. Any other boot failure gets the same frame with "Mikdash could not start." The message shows in
  shot mode too (`body.boot-failed`), so the harness captures it.
- **`<noscript>` inside the boot screen**, with a head `<noscript><style>` hiding the progress bar and "Loading…".
- **`tools/shot.mjs --browser-arg` (repeatable)** — to reproduce this without editing the harness:
  `--browser-arg=--disable-3d-apis --keep-ui`.

## CORE-4 — deploy workflow

- **`cancel-in-progress: false`** — as GitHub's Pages starter: a push during a deploy waits instead of cancelling it
  half-way.
- **`node tools/validate-schedule.mjs` before the build** (plain Node, ~1 s, exits 1 on errors). `tools/coverage.mjs`
  and the browser sim tests are not in CI (not asked; the browser ones need a GPU-capable runner).
- **configure-pages moved before the build** (its `base_url` feeds CORE-2).

## CORE-5 — `?fov`

- **Clamped to 40–95 in params.js, the settings slider's range; non-numbers fall back to 62.** — the engine and the UI
  both read `params.fov`, so one clamp covers both.
