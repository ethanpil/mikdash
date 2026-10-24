# qa-r2-fix-core — decisions

Scope: `src/core/**`, `src/main.js`, `src/systems.js`, `src/world/index.js`, `src/world/geom.js`, `index.html`,
`vite.config.js`, `tools/shot.mjs`, `tools/warmup-check.mjs`, `.github/**`. Tasks CORE-R2-1…3.
Format: **choice**: why. Alternative. Shots: `shots/qa-r2-fix-core/{og-cands,og,fonts}/`.

## CORE-R2-1: share card (`public/og-image.jpg`)

- **Reproduced.** The old card (`t=sunrise+8`, Har HaMishchah slope 675 m east, fov 40) puts the whole Mount in about
  310 of 1200 px. A cause besides distance: at sunrise + 8 the Heichal is still in the shadow of Har HaMishchah. The
  crest (808 m, 800 m east of the wall) stands ≈ 4° above the Temple, so on the default date the sun clears it only
  ≈ 15–20 min after sunrise. The +8 frames come out grey or pink (`og-cands/u-c3-plaza-s8`, `u-c4-ne-s8`).
- **New card: from above the north-east of the Mount, looking south-west at the Heichal, sunrise + 25 min, ultra,
  1200 × 630, JPEG q 90 (progressive, 4:2:0, 117 kB; was 126 kB):**
  `node tools/shot.mjs --prod --q ultra --w 1200 --h 630 --out shots/qa-r2-fix-core/og --name og "fly=1&pos=410,460,92&look=241,-7&fov=40&t=sunrise%2B25"`
  then `magick shots/qa-r2-fix-core/og/og.png -strip -sampling-factor 4:2:0 -interlace JPEG -quality 90 public/og-image.jpg`.
  The facade with the Ulam opening and the milah lintels, the north side in shade, the courts, the altar fire and its
  smoke column fill about half the frame, with the city beyond. The smoke rises straight up, as the sources describe:
  the smoke of the ma'arachah does not move from its place even when all the winds blow (Yoma 21a–b).
  The task suggested two other options:
  - **Axis view** (`u-c3b-plaza-s25`, `u-c1-axis-s15`): Nikanor, the 15 steps and the facade in a stack. Lit from
    the front, it renders flat, and the smoke column runs down the middle of the facade.
  - **Populated court at eye level:** the faces are still stylized at close range (`qa-r2-fix-people/after`), and the
    facade (122 amot high) does not fit at fov ≤ 62 from anywhere in the Azarah.
  The vantage needs `fly=1` (44 m above the platform), which the app offers. Candidates: `og-cands/`.
- **Re-shoot after the round's visual fixes merge.** Other fixers were editing world, materials, env and people while
  this was shot. The command above reproduces the card from whatever the tree holds. The default date is fixed, so the
  sun and the schedule match.
- **og:image:alt rewritten for the new view.** Size and type tags are unchanged.

## CORE-R2-2: web fonts at boot (index.html)

- **Reproduced** (production build, low tier, play mode). The UI added the font CSS at `sys:ui` (≈ 6.3 s). The woff2
  requests went out at ≈ 12.5 s, at the UI's first layout, which waits for the world build and the shader warm-up.
  Faces were ready at 15–16 s. Cormorant 600 and 500 italic arrived at 21–24 s, after the intro (18.3–19.5 s).
  Offline (`navigator.onLine` false, Google hosts refused) the console logged
  `Failed to load resource: net::ERR_INTERNET_DISCONNECTED`.
- **A small inline script in `<head>` adds the preconnects and the stylesheet (`data-mk-fonts`, media=print → all on
  load).** On load it calls `FontFace.load()` for the latin and Hebrew faces. That is 6 woff2 files, ≈ 190 kB: the
  set the UI loads in its first 25 s anyway, so no extra bytes. Reasons for a script rather than static tags:
  - With static tags, screenshot mode (shot=1, ui=0) would fetch fonts it never draws. Today it fetches none, and
    offline the tools would log an error in every shot and fail warmup-check.
  - The `navigator.onLine === false` guard means no request and so no error. The link sits in the head without an
    href until the `online` event, so `src/ui/index.js` (which skips its own insert when `link[data-mk-fonts]` exists)
    does not fetch either.
  The alternative, static `<link>` tags as the task proposed, would leave the woff2 at the UI's first layout:
  measured at 11.3–12.3 s with the sheet already in at 0.3 s, so the swap stays on long boots.
- **Ranges matched tolerantly: `/\bU\+0+-0*FF\b|\bU\+0*590-0*5FF\b/i`.** Chromium serializes `unicodeRange` as
  `U+0-FF` and `U+590-5FF`, without the CSS's leading zeros. The first version, which matched `U+0000-00FF`, loaded
  nothing.
- **After:** the CSS is in at 0.2–0.4 s and all 13 faces by 0.6–1.3 s, before `sys:ui`. Offline: no font request and
  a clean console. Back online: the 13 faces load. shot=1 and ui=0: no font requests. Interleaved A/B (3+3 cold
  production boots, low tier): world 5121 vs 5113 ms, firstFrame 18.65 vs 18.41 s (median, with vs without). The
  run-to-run spread is ±0.4 s, so there is no measurable cost.
- **Not done: self-hosting (UI-10)**, which needs a font download the user has not approved. A network that is up but
  has no internet (`navigator.onLine` true) still logs the failed CSS request, as before.

## CORE-R2-3: headless tools without Windows Edge

- **`tools/browser.mjs` `launchBrowser(chromium, opts)` tries, in order:**
  1. `CHROME_PATH`. It is an explicit choice, so if it is missing or will not start, that is the error.
  2. Playwright channel `msedge`.
  3. Channel `chrome`.
  4. Playwright's own Chromium.
  If none starts, one message lists each attempt and the three ways to fix it. Edge stays first because the documented
  HD 4600 timings were measured with it, and on Windows the `msedge` channel resolves to the same msedge.exe the
  hard-coded paths named.
- **`GPU_ARGS` passes `--use-angle=d3d11` only on Windows.** Elsewhere ANGLE's default backend is used (Metal on
  macOS); D3D11 does not exist there.
- **shot.mjs and warmup-check.mjs import it, start the browser before the dev server or production build (a missing
  browser fails at once), and print which browser ran.** A shared module rather than two copies because 14 more dev
  runners carry the same hard-coded Edge lookup: `tools/{boot-prof,nav-coverage}.mjs`, `src/sim/dev/run.mjs`,
  `src/ui/dev/{maptest,uishots,uitest}.mjs`, `src/render/dev/session.mjs`, `src/people/dev/*.mjs` (7). Filed to
  their owners.
- **Verified:** default → Edge 155; `CHROME_PATH` = Chrome → Chrome 155; a missing `CHROME_PATH` gives a clear error.
  With stubs refusing earlier entries: no Edge → Chrome; no Edge or Chrome → Playwright's Chromium 156; nothing → the
  combined message. A full shot through `CHROME_PATH` = Chrome renders on the HD 4600 (`browser/chrome-low.png`).
  Not run on Linux or macOS: there is no such machine here.

## Harnesses at the end

`node tools/warmup-check.mjs`: ALL PASSED, all four tiers in shot and play modes. Play mode now loads the fonts at
boot, and its console is clean. `node tools/validate-schedule.mjs`: 0 errors, 0 warnings. A production build with
`MIKDASH_SITE_URL` set emits canonical, og:image (+ type, size, alt) and copies og-image.jpg.
