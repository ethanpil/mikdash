# ux-audit — the Luach console as a newcomer meets it (phase 1: audit only, no source edits)

Goal judged against (the owner): "Intuitive, useful and non-overwhelming navigation and interface." Audience: curious
visitors and students, many on phones or weak laptops, who do not know the layout or the Hebrew terms and will not read
instructions. Spec read: `docs/console-design.md` (§0–§4), `docs/decisions/console-ui.md`, ARCHITECTURE §13.

## Method

- One persistent headless session per device, driven by real mouse / touch / keyboard input (not `ctx.ui` calls,
  except to read state): `shots/ux/driver.mjs` (boots once, keeps the page) + `shots/ux/do.mjs` (sends a step).
  `?q=low`, Chrome via `CHROME_PATH`, fresh profile (first visit). Desktop 1280×720 mouse+keyboard; phone 390×844
  touch DPR 2. Tablet not done (time). Steps: `shots/ux/steps/`. Screens: `shots/ux/desk-*.png`, `shots/ux/phone-*.png`.
- Every count below comes from the live DOM (`info()` in the driver: visible controls, their size, words).
- Caveat: SwiftShader on a machine at load 15–20 made each screenshot take 30–120 s, so 4 s / 8 s transients (wake
  chips, coach marks, the 30 s Show chip, banners) were often gone before capture; the sim clock also crawled. Nothing
  below depends on timing except where said.

## Findings, ranked

Severity: **blocker** (a core task fails), **major** (a core task is confusing or much slower than it should be),
**minor**. Size: S ≤ ½ day, M 1–2 days, L more.

### 1. Phone: "Show me" and a tapped person are framed under the sheet — the visitor sees a wall — blocker
- Seen: Happening → Show me on "The chavitin bakers at work". The 44 % strip above the peek sheet shows only a wall
  corner (`/home/user/mikdash/shots/ux/phone-12-show-bakers.png`); closing the sheet reveals the bakers in the lower
  half, exactly where the sheet was (`/home/user/mikdash/shots/ux/phone-13-show-bakers-closed.png`). Tapping a baker
  then opens his card at peek and the sheet covers him again (`/home/user/mikdash/shots/ux/phone-14-person-card.png`).
  The Show chip reads "Showing: …" (its subject truncated away).
- Why it hurts: "Show me" is the product's best answer to "what is happening, take me there"; on the phone it lands on
  a wall. The Night-watch Show me frames one 20 px figure with the marker diamond over his head
  (`/home/user/mikdash/shots/ux/phone-05-showme.png`).
- Fix: on sheet layouts, a Show me (event row, card, search) and a pick from the world drop the sheet to the **mini**
  detent (header strip only) — the rule a Go already follows — and the card's body rises on a tap / drag of the strip.
  Check that the framing reads the inset of the detent it ends in (inspect-show `lookAt` applies `viewInset.bottom`
  as a pitch offset; the result here shows it did not take effect — likely the inset of the pre-show detent, or the
  pitch clamp). Files: `src/ui/console/console.js` (detent on show / fromWorld card), `eventrow.js` (`runShow`),
  `layout.js`; B's `src/sim/inspect-show.js` only if the inset is read correctly and still clamped. Size M.
- Keep: principle 2 (the strip with where-you-are stays), one card renderer, Back restoring clock and view.

### 2. Phone: a Go from the Map walks you with no travel bar (no Stop, no Skip, no "Walking to …") — blocker
- Seen: Map → select Lishkat HaMetzora'im → Go there. The sheet drops to mini (good), but the travel bar stays hosted
  inside the Map view, now off screen: `.mk-travel` at y 964 in an 844 px viewport
  (`/home/user/mikdash/shots/ux/phone-09-go-walking.png`). It reappears only if the visitor finds Close
  (`/home/user/mikdash/shots/ux/phone-10-walking-closed.png`).
- Fix: the bar is hosted in the map only while the map is actually on screen (full detent / dock Map); at mini or
  closed it moves to the free area, above the strip. Files: `src/ui/console/console.js` / `src/ui/mappanel.js`
  (`.mk-mapv__travel` host), `go.js` `showBar`. Size S.
- Keep: one bar element, two hosts (decision "the travel bar has one element, two hosts").

### 3. Clicking or tapping architecture opens a card; "click the view to look around" only works on the sky — major
- Seen (desktop, Menu closed, mouse free after Esc): a click on a wall opened "Azarah wall — south" (a card with a
  type word, Go, Map and "Sources 2" — nothing else) (`/home/user/mikdash/shots/ux/desk-15-arrived-mizbeach.png`); a
  click on a gatehouse opened its card (`/home/user/mikdash/shots/ux/desk-16-click-wall-closed.png`); a click on the
  floor of the ramp opened "The kevesh". Only a click on the sky captured the mouse. Phone: a tap on a chamber wall
  raises the 56 % sheet with the chamber's card (`/home/user/mikdash/shots/ux/phone-16-tap-wall.png`), so "tap empty
  scenery to wake the Menu" almost never happens indoors.
- Why: the Welcome says "the mouse to look", the wake row says "Click the view to look around", Help says "click the
  view to capture the mouse"; in a court nearly every pixel is a wall, gate, floor element or chamber, so the promise
  fails and a card pops up instead — the visitor cannot tell why. (Drag-to-look does work, but nothing says so with the
  Menu closed.) Cause: `pickui.js` treats only `kind: 'place'` (bare floor) as empty scenery; every `el:` element is a
  subject, and `app.js` `setLockFilter` blocks the lock whenever `pick.hover` is set.
- Fix: a *free* click / tap on structure (walls, gates, gatehouses, chamber shells, floors, steps) is scenery: mouse →
  capture the pointer (look); touch → wake the beacon and show the name chip "Azarah wall — south ›" for 4 s (a tap
  on the chip opens the card). People, animals, props, fires, vessels and markers still open on a click / tap; E, pad
  X and an aimed (locked) click still open anything. Hover keeps the name tooltip for structure but no pointer cursor.
  Files: `src/ui/console/pickui.js` (`pickAt`, hover), `src/ui/app.js` (lock filter), maybe a `structural` flag from
  B's hit (`src/sim/inspect.js`) if the element kind is not already on the hit. Size S–M.
- Keep: "inspect anything" (E / aimed click / Nearby / Things here reach every element); CPU picking only.

### 4. Event rows: the gold button walks you somewhere; the action a visitor wants (Show me) is secondary, and each row is 133 px of three buttons — major
- Seen: Happening on desktop (`/home/user/mikdash/shots/ux/desk-05-happening.png`): 11 rows (5 now, 6 next), each
  133 px tall with **Go** (gold), **Walk · 1× ▾** and **Show me** → 33 row buttons; 2½ rows fit in the 491 px
  content; the list is 1 731 px (3.5 screens). Phone peek: one row per screen
  (`/home/user/mikdash/shots/ux/phone-04-happening.png`), list 2 213 px. Areas are sorted by event count, so the one
  headline rite at that hour ("The second lottery", ◆◆◆) sits third, under two ◆◆ watch rows.
- Why: Go = walk at 1× to a stand (68 s for 96 m; then you arrive behind a back, see 5), Show me = see it now. A
  newcomer presses the gold one. The per-row pace menu repeats the travel bar and Settings → Travel. Rows give no hint
  of what you will see.
- Fix: one compact row: title (+ Hebrew on the same line when it fits), place · "now, 9 min left", progress hairline;
  **Show me** primary (gold), **Go** secondary without the way/pace menu (the default way; the bar changes it mid-trip).
  Sort Now by importance then time, headline first; collapse "Next" to 3 with "More ›". Target ≤ 72 px per row
  desktop. Files: `src/ui/console/eventrow.js`, `sections/happening.js`, `sections/here.js`, `go.js` (a no-menu
  variant), `console.css`. Size M.
- Keep: one event-row component used everywhere, exactly two actions, the dynamic offering groups ("7 individual
  offerings … Show me one"), the click-row-for-card behaviour.

### 5. Arriving by Go: you face a wall or a back — major
- Seen: Go to "The chavitin bakers at work": arrival behind one baker whose body hides the work, half the view a wall
  (`/home/user/mikdash/shots/ux/desk-10-arrived.png`). Map → Go there "the Mizbeach": arrival facing the south wall
  of the Azarah, the altar behind you (`/home/user/mikdash/shots/ux/desk-15-arrived-mizbeach.png`). Phone → Lishkat
  HaMetzora'im: arrival 1 m from a blank wall (`/home/user/mikdash/shots/ux/phone-11-arrived.png`).
- Fix: after a trip's arrival, an event trip turns to its subject with the inspect director's framing
  (`ctx.inspect.frame(\`event:${id}\`)` / `lookAt` with the free-area inset); a place trip faces the place's centre /
  its main feature, not the stand's heading. UI side in `src/ui/console/go.js` (after `goTo` resolves); stand headings
  are C's (`src/player/trip.js`) and the content's stands. Size M.
- Keep: the travel core's API (`goTo(target, { way, pace, label })`), "looking around does not stop a trip".

### 6. Desktop Map: four layers fight for one plan, and a Go from it hides the walk — major
- Seen: the Map widens to the whole window but keeps the 215 px header and the 112 px rail, then a 280 px places list:
  the plan gets 858×491 px (`/home/user/mikdash/shots/ux/desk-11-map.png`, 38 controls). Over the plan sit the legend
  (≈130×130, always), the preset chips, and on selection a card covering 370 of the 858 px
  (`/home/user/mikdash/shots/ux/desk-12-map-select.png`); after Go there the travel bar covers the plan's upper-left
  (`/home/user/mikdash/shots/ux/desk-13-map-go.png`) — and the walk itself is hidden behind the full-window map.
- Fix: in the Map section, the header collapses to the compact strip (names, clock, search) and the rail to icons;
  the legend becomes the labelled **Key** chip (as on the phone); a Go from the Map returns the Menu to its dock width
  (desktop) so the world is seen walking, with the route on the minimap. Files: `src/ui/mappanel.js`,
  `src/ui/console/sections/map.js`, `header.js`, `console.css`, `console.js`. Size M.
- Keep: plan, labels, presets, Me, scale, places list with "Happening now" first, double-click/Enter = Go.

### 7. The map shows *that* something happens, not *what* — major
- Seen: active areas carry a count badge ("1", "2") and coming ones a "18 MIN" pill; only one event name appears on
  the plan ("The night watch", under Har HaBayit) (`/home/user/mikdash/shots/ux/desk-11-map.png`). At the Mount preset
  on the phone the only activity mark is "Har HaBayit 2" (`/home/user/mikdash/shots/ux/phone-06-map.png`).
- Why: the standing requirement is "live activity per area … watchable from the map". A count asks the visitor to
  select each area to learn what it is.
- Fix: under each active area's label, the headline event's short title (≤ 28 chars, the top 3–5 by importance at the
  current zoom, the rest stay counts); tapping it opens the event card with Show me. Files: `src/ui/map/labels.js`,
  `src/ui/map/model.js`. Size M.
- Keep: label collision rules ("big places named only on their own ground", consoletest), fills and markers.

### 8. Headers eat a third of the screen and repeat the place name 4–5 times — major (phone), minor (desktop)
- Seen: dock header 215 px of 720 (30 %), 258 px (36 %) while the "Back to 05:56" chip shows — it stayed across every
  section long after the Show me (`/home/user/mikdash/shots/ux/desk-23-help.png`). Phone: the home header is ≈300 px
  of a 470 px peek sheet, and "Happening here" falls below the fold
  (`/home/user/mikdash/shots/ux/phone-03-menu-home.png`); the section strip is ≈175 px (37 %) leaving one event row
  (`/home/user/mikdash/shots/ux/phone-04-happening.png`). On Here the place is named in the header (he, en, rung line)
  and again in the card ("PLACE", הר הבית, "Har HaBayit — the Temple Mount", "Har HaBayit", "Sanctity of Har HaBayit")
  (`/home/user/mikdash/shots/ux/desk-04-menu-here.png`).
- Fix: phone strip = one 56 px row (disc 40, he + en names, "≈04:37 · night h. 11"), the rung and About move to Here;
  phone home header two rows; Here's card drops its title block when it is the place you are in (the header already
  says it). Dock: the Back chip joins the clock row instead of adding a row. Files: `header.js`, `sections/here.js`,
  `card.js`, `console.css`. Size M.
- Keep: principle 2 — where you are and the clock on every view; About this place reachable from the strip.

### 9. Card "see it in action" buttons do not say what they show, and the primary may jump the clock 11 hours — major
- Seen: the Temple Mount's place card: primary "Watch now (≈1 h 14 left)" — watch what? (`desk-04-menu-here.png`).
  Beit Avtinas (opened by a stray click on its wall at 05:56): primary gold "Skip to ≈17:26 (in 11 h 30)" (seen live;
  its screenshot was later overwritten). The Water Gate gatehouse: "Skip ahead 11 min"
  (`/home/user/mikdash/shots/ux/desk-16-click-wall-closed.png`). The same action is
  "Show me" on rows, "Watch now / Skip ahead / Skip to / Rewind to / From the start" on cards.
- Fix: card.js renders a see-in-action as "Show me: the night watch" with the timing as a sub-line ("now · 1 h 14
  left", "jumps the clock to ≈17:26"); a jump of more than an hour is never the gold primary on a place or object card.
  The core's `what` (`spec.what`) already carries the subject. File: `src/ui/console/card.js` (`actLabel` and the
  action row). Size S.
- Keep: honest timing (the visitor must know the clock moves), Back.

### 10. Jargon on primary surfaces, without a gloss — major for this audience
- Seen: "Night · hour 11 of 12" with a 60 px "11" at 04:37 on the Time dial (`/home/user/mikdash/shots/ux/desk-17-time.png`)
  reads as eleven o'clock; "Sanctity of Har HaBayit" + ten rung bars in every header; the Happening filter "Aggadah";
  importance diamonds with no legend outside Help; names like "Lishkat Osei Chavitin — the chamber of the chavitin
  bakers", "The Tzafon", "Ta'im", "ma'amad", "kevesh" in rows and on the map with the gloss only one tap away.
- Fix: civil time first everywhere a visitor reads the hour ("≈04:37 · night, hour 11 of 12"; the dial's centre shows
  "04:37" large and "hour 11 of the night" under it); "Legends (Aggadah)"; event rows and map labels show the English
  gloss when the title is a transliteration ("Lishkat Osei Chavitin — the bakers' chamber"); a one-line ⓘ on the rung
  ("how holy this ground is: 4 of 10"). Files: `header.js`, `timepanel.js`, `sections/happening.js`, `eventrow.js`,
  `map/labels.js`. Size S–M.
- Keep: seasonal hours as the authority (they drive the schedule), Hebrew alongside, sourced text.

### 11. The first screen is the whole console — minor
- Seen: desktop Welcome sits inside the open Menu: header (minimap, rung, clock, Pause, speed, Close) and the 8-item
  rail are live beside it — 15 controls, 166 words, one of which (Enter the courts) matters
  (`/home/user/mikdash/shots/ux/desk-01-welcome.png`). Phone Welcome offers "‹ Menu", "Close" and "Enter the courts"
  plus the clock and About (7 controls), and prints the keyboard essentials "Esc = Menu · E / click / tap = …" on a
  touch device (`/home/user/mikdash/shots/ux/phone-01-welcome.png`).
- Fix: Welcome as its own layer (the rail and header hidden or inert until Enter); on phones no "‹ Menu"; the essentials
  line per device (`controls.js` already has `welcomeLines(device)`). Files: `welcome.js`, `console.js`,
  `controls.js`. Size S.
- Keep: the live framing sentence, the three device lines, the painted-after-settle rule (cold boot).

### 12. Travel bar: 11 controls for one walk — minor
- Seen: "Walking to the Mizbeach · 43 m · ~36 s", then ½× 1× 2× 5× 10×, Slower −, Faster +, Walk, Run, Skip, Stop:
  900 px wide on desktop (`/home/user/mikdash/shots/ux/desk-14-walking-closed.png`). The pace pills and Slower/Faster do
  the same thing. "Walking to watch: The chavitin bakers at work" reads oddly (`desk-09-go-walking.png`).
- Fix: drop Slower/Faster buttons on desktop too (keep + − as key caps on the pace group, as touch already does);
  "Walking to the chavitin bakers" (event title, no "watch:"). File: `go.js`. Size S.

### 13. Phone touch targets under 44 px — minor
- Seen: Happening filter chips 30 px tall (`phone-04-happening.png`), Map "Clear" 36 px (`phone-08-map-select.png`),
  Time speed chips 30 px and ±1 h 38 px (`phone-15-time.png`), Here "All ›" 23×17 px (`phone-03-menu-home.png`). The
  Time view has 67 sub-44 px focusables, most of them dial arcs.
- Fix: the coarse-pointer rule in `console.css` extended to `.mk-seg button`, `.mk-mapcard` Clear, the time transport,
  link buttons. Size S.

### 14. Search misses everyday words — minor (needs C)
- Seen: "sacrifice" → 1 result (Learn: Offerings); "singing" → 0 (the Levites' song exists); "where do women stand"
  → 0; "altar" → 61 results with two rows titled "After midnight: turning the limbs" (two events)
  (`/home/user/mikdash/shots/ux/desk-19-search-en.png`). Hebrew works well ("כהן גדול" → the Kohen Gadol first,
  `desk-20-search-he.png`); "women", "lamb", "priests", "gate", "temple", "incense", "menorah", "holy of holies" fine.
- Fix: synonyms in the search core (sacrifice/offering → korban, song/singing/music → shir / the Levites' song,
  priest → kohen already works); duplicate rite titles get their time in the title line. `src/search/**` (C). Size S.

### 15. Coach marks cover other UI — minor
- Seen: desktop's first mark ("Your Menu: …") sits on top of the wake row and hides its hour and Map chips
  (`/home/user/mikdash/shots/ux/desk-02-entered.png`); phone's "Tap anyone or anything" mark covers the activity
  marker's label and touches the screen edge (`/home/user/mikdash/shots/ux/phone-02-entered.png`).
- Fix: on desktop place the mark below the chips (or hold the wake row until the mark is dismissed); keep 12 px from
  the edge and clear of markers on touch. `welcome.js`, `console.css`. Size S.

### 16. Time: 94 tab stops and no jump to the rites — minor
- Seen: Time holds 94 focusable elements, ~80 of them event arcs, many 0–3 px wide (`desk-17-time.png`); the only
  presets are the zmanim (Dawn, Sunrise, Midday …). A visitor who wants "the incense" or "the morning tamid" must find
  a 1 px arc or search. "0 hour since sunrise" at sunrise (`desk-18-time-sunrise.png`).
- Fix: arcs out of the tab order (one roving focus on the dial); under the zmanim, a row "Jump to: Morning tamid ·
  Incense · Song of the day · Afternoon tamid · Menorah lit" (each = the event's Show me / Set clock). Grammar:
  "just after sunrise" for < ¼ h. `timepanel.js`. Size M.

### 17. "What's new" and old-UI notes shown to first-time visitors — minor
- Seen: Help → What's new lists "E now inspects what you face; Space still rises …", news only to someone who used
  the old interface (`desk-23-help.png`). Fix: show it only when `welcome.versionChanged`. `sections/help.js`. Size S.

### 18. The rail highlights a section the visitor is not in — minor
- Seen: search results while the rail lights Time (`desk-19-search-en.png`); a person card while it lights Happening
  (`desk-22-person-card.png`); an object card while it lights Map. Fix: no rail highlight (or a "Search" / "Card"
  breadcrumb) while a card or results cover the section. `console.js`. Size S.

## Bugs (with repro)

1. **Phone travel bar off screen** (finding 2): 390×844 touch, Menu → Map → tap a place → Go there → `.mk-travel` at
   y ≈ 964 (> innerHeight); no Stop/Skip until Close.
2. **Phone Show me / pick framed under the sheet** (finding 1): Happening → Show me on the bakers; then tap a baker.
3. **Free click / tap on any element opens a card; pointer capture only on the sky** (finding 3): desktop, Esc twice
   (Menu closed, mouse free), click a wall → card; click the sky → captured.
4. **Activity-marker label and hover tooltip cut by the dock**: "Young kohanim on watch in the upper ro…" and
   "Azarah w…" run under the Menu's left edge (`desk-15-arrived-mizbeach.png`). `markers.js` checks the anchor's
   distance (`LABEL_W = 220`) not the label's right end; the tooltip is not clamped to the free area (`pickui.js`).
5. **Hover / chooser label does not match the figure**: hovering the standing kohen at the slaughter shows "Kohen ·
   Holding the lamb" (`desk-24-wake.png`); a click on him offered two "Kohen · Holding the lamb" rows
   (`desk-22-person-card.png` before choosing). Inspect core / choreo slot labels (B).
6. **"0 hour since sunrise"** on the Time dial at sunrise (`timepanel.js:415`, `quarters(0)`).
7. **Phone map**: the "Me" zoom button is half under the selection card; the "Mesibah" label overlaps the scale bar
   (`phone-08-map-select.png`).
8. **Coach marks overlap** the wake chips (desktop) and a marker label (phone) (finding 15).
9. The Words icon in search and Learn is drawn as a letter "R" (`icons.js` `word`), which reads as a typo.
- Console: no errors in either session (only SwiftShader's "GPU stall due to ReadPixels" and the
  KHR_parallel_shader_compile notice).

## What works and should be left alone

- **The beacon**: one labelled door with the place name in Hebrew and English and a live disc
  (`desk-03-play-steady.png`, `phone-02-entered.png`); the play HUD is otherwise empty except markers — calm.
- **Show me + Back on desktop**: jumps, frames the slaughter well (`desk-21-show-tamid.png`), and "Back to 04:37 at
  Har HaBayit" restores clock and place (`desk-08-back.png`). The naming of Back is excellent.
- **Person cards**: NOW with a progress bar, then actions, then sourced WHY / WHO / DRESS, "Order sourced · minutes
  reconstructed" (`desk-22-person-card.png`). Honest and rich.
- **Search**: Hebrew, transliteration, top result, scope chips with counts, Go / Show me in results.
- **Something is always going on**: at 04:37 five rites are live (night watch, officer of the Mount, second lottery,
  bakers, young kohanim), and the Happening badge counts them.
- **Map basics**: labelled plan with Hebrew, Mount / Courts / Sanctuary presets, Me, scale in amot and metres,
  "Happening now" first in the places list, Who may enter on the selection, a clear "Go there".
- **The phone home's 4×2 labelled tiles** and the travel bar's plain "Walking to … · 89 m · ~1 min".
- Drag-to-look with the Menu open; the dock leaving the world live beside it.

## Recommended fixes, in order (best value for effort)

1. Phone travel bar re-hosted when the map is not on screen (bug 1) — S.
2. Phone Show me / world pick → mini detent, subject framed in the strip above (finding 1) — S–M.
3. Structure is scenery for free clicks / taps: click captures the mouse, tap wakes the beacon with a name chip
   (finding 3) — S–M.
4. Say what Show me shows; no multi-hour jump as the gold primary (finding 9) — S.
5. Compact event row, Show me primary, no per-row pace menu, headline first (finding 4) — M.
6. Arrival faces its subject; a Go from the desktop Map returns to the dock so the walk is seen (findings 5, 6 part) — M.
7. Phone header strip to one row; Here's card drops its repeated title (finding 8) — M.
8. Map: legend into the Key chip on desktop, and the headline event named under each active area (findings 6, 7) — M.
Cheap riders for any of the above: 44 px coarse targets (13), "0 hour" (bug 6), What's new gating (17), coach-mark
placement (15), marker/tooltip clamp (bug 4).

## consoletest (`node src/ui/dev/consoletest.mjs --q low --only desk`, run after both walkthroughs, load ≈ 18)

It launched (the harness is portable now) and stopped after 7 checks: **6 passed, 1 failed, console clean**. The failure
is the harness itself, not a console check — `page.click: Timeout 30000ms exceeded … waiting for
locator('.mk-tab[data-section=time]') … attempting click action … waiting for element to be visible, enabled and
stable` at `consoletest.mjs:94`; the exception ends the desktop profile, so its remaining checks did not run.
Playwright's "stable" test needs two equal boxes on consecutive animation frames, which SwiftShader at this load does
not deliver in 30 s (my own `page.click(selector)` calls failed the same way; coordinate clicks work). Re-run on an
idle machine, or give that suite a longer action timeout, before reading anything into it.

## Tools kept for phase 2

- `node shots/ux/driver.mjs --device desk|phone|land|tablet [--q low] [--port 9411]` (background; boots once, prints
  "listening") and `node shots/ux/do.mjs [-e code | steps/lib.js steps/x.js]` (in scope: `page shot info sleep tap
  click key type ui logs`; `-e "__quit"` stops it). `steps/lib.js` adds `clickText`, `rectOf`, `viewText`.
- Use mouse/touch coordinates, not `page.click(selector)`: Playwright's actionability waits time out on this machine.
  `page.setDefaultTimeout(600000)` first: screenshots take 30–120 s here.

## Phase 2 — what was changed

Every fix is in `src/ui/**`, except one minimal change in `src/sim/inspect-show.js` (see B). Before shots are phase 1's
`shots/ux/desk-*.png` / `phone-*.png`; after shots are in `shots/ux/after/` with the same name, same device, same state.

- **A. The travel bar leaves the map when the map stops covering the world** — `mappanel.js syncTrip` hosts the bar in
  the map only while `app.fullScreen()`; `console.js fullScreen()` no longer counts a phone's portrait Map at its mini
  detent as full screen (the Map is `is-wide` there too); `app.onFree` re-syncs on every detent change. Player input is
  locked by the Map only while it covers the world, so the walk can be stopped by the joystick too. — Alternative: a second
  bar (the duplication console-ui.md removed).
- **B. Show me on a phone drops the sheet to mini first** (`app.onShowStart`, called by `go.js runAction` before
  `seeInAction`), so the director frames in the strip of world it then reads from `viewInset`. A world pick during a show
  is framed too (`app.js scheduleFrame` no longer stands aside in the `showing` phase), and on sheets the subject's chest
  is checked as well as the tap point. **`src/sim/inspect-show.js` (the brief's one exception):** the "stand-in at your
  feet" branch set pitch 0 and ignored the inset; it now uses `insetPitch()` (the same offset `lookAt` already applies).
  Nothing else there changed. — Alternative: the sheet stays at peek and the director pans (it cannot: a peek leaves 44 %).
- **C. Structure is scenery for a free click / tap** (`pickui.js`): site kinds wall, gate, chamber, stair, slab, opening,
  ramp, floor, zone (from `ctx.site.elements[id].kind`; fixtures, curtains and fires stay subjects) and the bare place.
  Desktop: hover names it in a muted tooltip with no pointer cursor and does not block the lock filter, so a click
  captures the mouse (measured: `el:en.wall.east` click → pointer locked, no card). Touch: a tap wakes the beacon and
  shows a 44 px name chip ("Ezrat Nashim wall — east (low) ›") for 6 s; tapping it opens the card. E, an aimed click,
  pad X and Nearby still open structure directly. Help → controls (touch and mouse rows) reworded. — Alternative: ask the
  inspect core for a `structural` flag (not needed: the element kind is on `ctx.site`).
- **D. One verb for see-in-action** (`card.js showWords`): "Show me: <what>" (the core's `a.what`, its "Title: subtitle"
  cut at the colon, "the" lower-cased) with the timing as a sub-line derived from the action's id suffix
  (now/start/warp/later/rewind/tomorrow/another) and `a.t`/`a.date`; a jump over 60 min is never gold (Go takes it).
- **E. Compact event row** (`eventrow.js`, `go.js control({ menu: false })`, `happening.js`, css): Show me gold and
  first, Go plain without the way/pace menu; meta line "now · 9 min left · place · Hebrew" (time first so it is the place
  that gets cut); dock: one title line (full title as tooltip), icon-less buttons; phones: area headings hidden, the place
  on the row instead. Happening: headline (importance) first within an area, areas by their top importance then count.
  Measured: desktop 5 rows in view (53 px each, was 2½ at 133 px); phone peek 3 rows (was 1). "Aggadah" filter →
  "Legends" (tooltip keeps the term).
- **F. Arrival faces what you came for** (`go.js faceOnArrival`): an event trip calls `ctx.inspect.frame(showAction)`
  (else turns to `data.eventPos`); a place trip turns to the place's centre when it is > 4 m away, else to the most open
  of 16 level directions (one `ctx.physics.raycast` each, once). Any look/move input cancels the turn. A Go from the
  dock's Map returns the Menu to the section before the Map (`app.onTripStart`, `console.prevSection`). The travel bar's
  "Walking to watch: The …" is now "Walking to the …".
- **G. Phone header**: a section's strip is one row (disc 44 px, names, About, the civil time); the home header is two
  rows; civil time is shown first everywhere, the seasonal hour under it (desktop) or on the Time tile. Here: the card of
  the place you stand in hides its title block (sr-only) and its type chip reads "Where you are". The Back chip's long life
  (10 min in the header) is the spec's intent (§4.1 step 6), not a bug: kept; the phone's Show chip now reads "Back to
  04:37" (the place moved to its title) so "Showing: …" is no longer squeezed to one word.
- **H. Map**: the legend is behind the Key chip on every layout (closed by default; Esc closes it); each active area's
  label carries its headline rite's short title (at any zoom, where it fits) and a count badge only when > 1; the
  selection card's growth (rows arriving) re-measures the controls and keeps the selected place in view (phone's Me
  button: zoom bottom 411 px, card top 427 px — no longer under it). Marker labels flip to the left of their diamond
  where the right would run under the Menu (real width, measured), and the pick tooltip is clamped to the free area.
- **I. Cheap ones**: coarse targets ≥ 44 px for `.mk-seg` buttons, the map card's Clear and "All ›"; What's new hidden
  unless `welcome.versionChanged`; the desktop coach mark moves under the wake row while it is awake; the rail lights a
  section only while that section is the view shown; the Welcome is its own panel (rail, header, drill bar hidden; 2
  controls instead of 15 on desktop, 2 instead of 7 on the phone) with a per-device essentials line
  (`controls.js essentialsFor`); the travel bar on fine pointers shows Slower · 1× · Faster instead of five pills plus
  Slower/Faster (touch keeps the pills).
- **Not done** (brief): findings 10 (the dial's "11") and 16 / the "0 hour" bug — they live in `timepanel.js` /
  `format.js`, which another agent owns now. Glosses for transliterated names on map labels/rows were not added.
