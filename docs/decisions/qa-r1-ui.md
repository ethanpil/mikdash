# qa-r1-fix-ui — decisions

Fixes from the first QA round in src/ui/** (UI-1 … UI-10). Format: **Choice** — why — alternative.
Evidence: shots/qa-r1-fix-ui/before → after (repro.json in each), uitest/, maptest/, about/.

## UI-1 — compass
- **`lastHeading` starts at Infinity and the test is `!(Math.abs(hd - lastHeading) < 0.05)`** — any comparison with NaN
  is false, so the strip never moved and sat at ≈ 244° whatever the heading; the KhK mark was placed on that frozen
  strip. Either change alone fixes it; both keep a NaN heading from freezing it again. — uitest checks the strip's
  centre equals the heading at 0, 90 and 180.

## UI-2 — About panel
- **A modal "About Mikdash" panel (src/ui/aboutpanel.js), opened by a fourth HUD tool button (book icon), the `?` key
  and a link on the intro card** — the build had nowhere that states its method. `A` was not used: it is strafe-left.
  The intro link enters without pointer lock (a lock would close the panel at once, app.js pointerlockchange).
- **"Where the sources differ" lists twelve choices, each with the reading shown, the one not shown, and links for both**:
  the Heichal's T-plan vs the Rambam's square (lock #1), solid walls vs the Rambam's hollow walls (#38), two curtains vs
  R' Yosi's one (#5), the altar south of the axis (REbY) vs centred (R' Yehudah) (#4), the six chambers' sides (#7, said
  to be genuinely open), seven gates vs thirteen (#9), the Chel as a terrace vs the Rambam's reading of a 10-amah height
  (#26), the menorah lamps E–W vs N–S (#11), the Ulam treads (#25), the kalya orev (#27), the rings (#18), and Friday
  night (the Rambam/Kesef Mishneh after Rava vs Rav Chisda, from data/offerings.js). Each was checked against what
  site.js / the data actually build and, where the text is local, against ../sources (BhB 3:12, 4:2–5, 5:3, 6:4). The
  altar's height (lock #2) was left out: the register's "R' Yehudah: 3 amot" is his reading of the altar of the
  wilderness (Shemot 27:1, Zevachim 59b), and a one-line "or 3 amot" would misstate the dispute. — Alternative: link the report's register (not public; Level-1–3 sources are).
- **The confidence badges are explained with the same badge elements the event rows use**; times, the GRA hours and the
  zman angles are read from ZMAN_ANGLES, the amah standards from AMAH_STANDARDS (the one in use marked), so the panel
  cannot drift from the engine.
- **Credits name three.js (MIT), three-mesh-bvh (MIT), postprocessing (Zlib), N8AO (ISC) and the three OFL typefaces, and
  say the fonts are served by Google Fonts** (`FONTS_HOST`, null once UI-10 lands). n8ao's package.json says ISC but its
  repository LICENSE file is CC0 1.0; the panel follows the package (both are permissive). The licence-text link is
  `third-party-licenses.txt` beside the page (`LICENSES_URL`), to be confirmed against CORE-1.

## UI-3 — floating tags
- **Screen-space declutter each frame: sort by importance, then distance; each tag sits above its anchor, is moved out of
  the location card / clock / tool column (sideways, else below), then pushed up past the tags already placed; the
  leader (`--lh`, `--lx`) runs down to the anchor; lower (earlier-placed) tags paint above the leaders of the tags pushed
  over them.** At most four tags, so stacking never grows past three rows. — Alternative: merge into a "+n events here"
  chip (hides what is happening; one more tap).
- **Tag widths are re-measured on font load and resize; HUD rects are measured in the 4 Hz tick, before the frame's tag
  writes** (no forced layout per frame). Long titles ellipsize within `min(360px, 100vw − 32px)`.
- **Coarse pointers: tags take no pointer events; a tap that moved < 10 px within 500 ms on the canvas is hit-tested
  against the placed tags.** A look-drag that starts on a tag now reaches the player's canvas handlers (it went to the
  button, then pointercancel). A tap on a tag in the left 45 % briefly shows the player's joystick ring — accepted.
  Fine pointers keep the button (hover, focus, click); `touch-action: none` stops page gestures on hybrid devices.
  — Alternative: forward moves by synthetic events to the canvas (couples the UI to the player's internals).

## UI-4 — controls
- **One list (src/ui/controls.js) for the intro (short) and About → Controls (full: W A S D, arrows, Shift, mouse, Esc, F,
  Space/E, Q/C, T I M G ?, the map's drag / `/` / click / double-click / Enter, touch, gamepad)**, matched to
  player/input.js and mappanel.js. Reachable from `?`, the About button, the intro link and Settings → Controls → "Show
  all". The desktop hint bar gains `? all controls`; the intro swaps "G settings" for "? all controls".
- **Touch devices get ghost controls instead of the key bar: a dashed joystick ring bottom-left ("Drag to walk") and a
  look pill bottom-right ("Drag to look"), animated by transform only, plus a pill "Two-finger tap: walk / run · tap the
  clock for the hour"; they go after 9 s, on the first touch on the view, or after 2.5 m of walking.** Phones had no
  in-game hint at all (`.mk-hints` is display:none there). — Alternative: a text pill only (does not show where).

## UI-5 — citations
- **Added: Rambam MK (= Ma'aseh HaKorbanot → Sacrificial_Procedure), Pesulei HaMukdashin (→ Sacrifices_Rendered_Unfit),
  Rambam Bikkurim (→ First_Fruits_and_other_Gifts_to_Priests_Outside_the_Sanctuary); Mishnah/Bavli Kinnim, Negaim,
  Nazir, Temurah, Bekhorot, Eruvin, Ketubot, Shevuot; Shmuel I/II, 1/2 Divrei HaYamim; "Kesef Mishneh on Rambam …" (→
  Kessef_Mishneh_on_Mishneh_Torah,_…); "Bartenura on <Mishnah>"; "Rashi on <Bavli/Tanakh>"; and "X (in Y)" links Y.**
  Every title was resolved through the Sefaria API on 2026-10-23. `MK` alone is not taken as the Rambam (it can be
  Moed Katan); the data always writes "Rambam MK".
- **Ranges are Sefaria ranges**: Numbers.28.9-10, Mishnah_Tamid.3.9-4.1, Yoma.16a-16b, Yoma.30b-31a, Shemot 25–30 →
  Exodus.25-30. (Supersedes ui.md's "ranges link to their first reference".)
- **Plain text on purpose, and exempt in the test with reasons: Report, "Reconstruction (model)", Ezrat Kohanim (not on
  Sefaria), Shiltei HaGiborim (Portaleone 1612; Sefaria's "Shiltei HaGiborim" is a different work, on the Rif), Tosefta
  (Sefaria's edition numbers differently: the Rabban Gamliel letters cited as Sanhedrin 2:6 are its 2:2, and its 2:6 is
  another passage), Yerushalmi.** — Alternative: link the Tosefta anyway (opens the wrong text).
- **src/ui/dev/sourcestest.mjs**: 39 parser cases + every `sources` array in schedule, zones-content, offerings (types
  and steps), the ladder and the About panel; fails on any unlinked citation outside the exempt kinds. `--online` asks
  Sefaria for every distinct URL (551 today, all resolve; one retry on the API's occasional HTML answer).

## UI-6 — page zoom on phones
- **`#ui-root { touch-action: pan-x pan-y }` (scroll yes, pinch and double-tap zoom no, for everything in the UI), panel
  bodies `pan-y`; the map stage keeps `none` and its own pinch.** Reproduced with a two-finger CDP touch pinch on the
  info panel (Pixel-7-size, 412 × 915 @2.625): scale 1 → 5, still 5 after closing and after a reload. After: 1 on the
  panel, the HUD and the map, and the map's own zoom still goes 0.68 → 5.3. No `maximum-scale` meta: it would also
  block accessibility zoom on the page's text, and the UI needs none now. — Alternative: index.html viewport meta (core).
  `CDP Input.synthesizePinchGesture` does not reproduce it (scale stays 1 before the fix too); the uitest uses touches.

## UI-7 — access notices
- **`sentences()` splits on a period followed by space or the end, outside parentheses and not after a lone capital
  ("R. Eliezer")** — `(Report §10.8).` made the old regex start the lead at "8).". `hasCitation()`: the ladder's Kelim
  reference is appended only when the lead cites nothing itself.
- **Access notices have one id (`access`): a new one replaces the old; it is dismissed when a Go starts, or when the
  visitor steps down below its rung.** Not on every zone change: walking from Ezrat Kohanim into the slaughter area or the
  ramp (same rung) would flash it away within a second. A deeper place brings its own notice anyway. Re-entry within
  90 s still shows nothing (boundary flapping).

## UI-8 — the day after sunset
- **`dayPhrase()` names the halachic day: "Shabbat night (Friday evening)", "dusk as Shabbat begins (Friday evening)",
  "motza'ei Shabbat (Saturday night)", "dusk as Shabbat ends (Saturday evening)", "Monday evening, the night of
  Tuesday", "dusk on Monday evening, as Tuesday begins"; before sunset the civil day as before.** Not "Tuesday night
  (Monday evening)": in English "Tuesday night" is the night after Tuesday. Saturday 18:00–tzeit is still Shabbat
  (dusk). The time panel's day badge follows (`dayBadge`: Friday after sunset "Shabbat night", Saturday after tzeit
  "Motza'ei Shabbat"); the psalm badge keeps the civil weekday (sung by day).

## UI-9 — grouped offerings
- **Each group in the hour panel has its own speed select ("Watch one, travelling at …"), shared by its rows, and sets the
  default like the event rows' selects; the map card's group keeps using the card's speed control (no second one).**
- **Headers are named by stage from the parent event id ("Offerings now at the blood on the altar", "Bird offerings now at
  the corners of the altar", "On the circuit of the Mount now" — that group holds prostrations and a mourner, not
  offerings); an unknown parent falls back to "Now: <its title>".**

## UI-10 — self-hosted fonts (not done: needs a download)
- **Blocked: the woff2 files have to be fetched, and a workflow agent may not download files without the user's
  approval.** On this machine: Frank Ruhl Libre (variable TTF + OFL.txt, C:\Code\hashaon\third_party\fonts, from
  google/fonts) and one EB Garamond 400 woff2; no Cormorant Garamond and no other EB Garamond weights. A partial switch
  (some faces local, some from Google) would keep contacting Google, and dropping Cormorant/EB weights would degrade the
  type. Done meanwhile: the OFL credit in About, and an honest "served by Google Fonts" there. fontTools 4.63 + brotli
  are installed, so once the sources are in the project the change is: pyftsubset to Latin (+ Hebrew for Frank Ruhl)
  woff2 in src/ui/fonts, `@font-face` with `font-display: swap` in styles.css, remove `loadFonts()` and the
  preconnects in index.js, set `FONTS_HOST = null`.
