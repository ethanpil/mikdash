# console-ui — Engineer A: the Luach console (docs/console-design.md §6.1)

Replaces the HUD, the five panels, the intro, the floating tags, the compass strip and the hint bar with one console:
the Menu beacon, the Menu (docked or a sheet) with its header and eight sections, one card renderer, one Go control,
search, the area banner, activity markers, the pick UI, the Show-me bar, captions and notices, the Welcome, the gamepad
and the module registry. Every optional core (B: `ctx.inspect`; C: the player's travel additions and `src/search/`) is
feature-detected, so the UI ships and passes its tests with or without them.

## Choices

- **Accelerators only from the world** — M T I P ? G act when focus is on the page or the canvas; with focus inside the
  Menu (not a text field) letters do nothing, as §2.3 says. `/` and Ctrl/⌘+K search from anywhere. Opening by a key from
  the world leaves focus in the world, so the same key closes the section again (§7.2 script 1); opening from the UI
  (the beacon, a tile, the rail, Enter) moves focus into the Menu. — Alternative: letters everywhere outside text fields
  (simpler, but contradicts §2.3 and fights screen readers' browse keys).
- **Header grid: Close top-right, Fly and Sound in the clock row** — the wireframe puts all three actions on the
  Hebrew name's line, but in 560 px beside a 120 px disc that squeezes the place's names to ~80 px. Close keeps the
  top-right corner; Fly and Sound follow the clock's Pause and speed. — Alternative: a separate action bar (taller
  header, ~230 px against the 170 px target).
- **One minimap raster, not one per level** — the shared plan raster (map/plan.js at 0.5 m/px over the Mount ± 300
  amot, built in idle time after 'firstFrame', ~1 Mpx) already draws other storeys as dashed / dotted outlines; the
  disc adds a storey badge. Each disc is a `drawImage` crop into a canvas 1.5× its size, redrawn at ≤ 4 Hz when it has
  moved a quarter of the radius (or the zone, activity or route changed) and moved by a CSS transform in between.
  — Alternative: per-level rasters (plan.js would need a level filter; 2–3× the memory).
- **Places open as Here, pinned** — `ctx.ui.card('zone:x')`, a banner click, a search result and the map card's About
  all open the Here section pinned to that place, so a place card has one home (§3.5.2). — Alternative: a place card in
  the card view (two renderings of the same place).
- **Here renders its live blocks itself** — Happening here, Things here and Nearby are mounted as live card sections
  before the place card's own (access, services, about, sources); card sections with ids `happening`, `next`, `things`,
  `nearby` from the inspect core are skipped there, so nothing shows twice.
- **The map card keeps its map extras around the shared Go control** — the selection card (names, rung, access, "Also
  here", events here now and next as single event rows) keeps "This spot" and "About" beside the one Go control; the
  per-card speed segment is gone. — Alternative: the full card renderer inside the map (it has no room for the map's
  spot and storey chips).
- **The travel bar has one element, two hosts** — it sits at the bottom of the free area, and moves into the map while
  the Map covers the world (the old map's own travel pill is gone). — Alternative: two bars (the duplication §3.5.1
  removes).
- **A Go on a phone** — portrait: the sheet drops to its "mini" detent (the header strip only) so the walk is seen;
  landscape: the right sheet closes (its strip would still cover half the view). The dock stays open.
- **Sound on/off is volume 0 / the last volume** (`localStorage mikdash.soundVolume`), not a new setting: the audio
  system already follows `volume`. — Alternative: a `muted` key the audio would have to learn.
- **History: one entry per Menu level, operations queued** — `history.back()` is asynchronous; a `pushState` issued
  before its popstate lands on the wrong entry, and a later `go(-n)` left the page (found by uishots). Every push / pop
  / clear is queued and each traversal waits for its popstate (1 s cap). A popstate that is not ours is the system back.
- **Integration: the travel core is required; its stand-ins are gone** — every Go is `goTo(target, { way, pace,
  label })`; distance, ETA and pace come from `travel:start | progress | pace`; the pace buttons, Walk / Run and Skip
  always show. The old string speeds, the path-measured ETA, the UI's own canvas taps and the `zone:change` banners
  during trips were removed. The banner knows a walk or run is under way from `travel:start` / `travel:end`, whoever
  started it, so a trip the director or a module starts names its places from `travel:zone` too. — Alternative: keep
  the feature detection (dead code: the player is always present).
- **Integration: the search core is required; the UI's matcher is gone** — `src/search/index.js` is imported
  dynamically (its own chunk) in idle time after 'firstFrame'. A query typed before it has loaded shows "Preparing
  the search…", starts the load and runs again when it lands (`onReady`). The UI's rite documents (only used by the
  matcher) were removed; the core indexes the day's rites and live offerings itself.
- **E with focus inside the Menu does nothing** — the player fires `player:inspect` for E whenever no text field has
  focus (C's choice); the UI drops a key-sourced inspect while focus is inside the Menu, as §2.3 says of letters there.
- **Show me waits for the describer once** — before the inspect core's describer chunk has loaded its cards are
  placeholders with no actions; `runShow(app, ref)` (eventrow.js) awaits `ctx.inspect.ready` once and then runs the
  primary see-in-action, so an early Show me is not a dead button.
- **A see-in-action's note** ("This stops your walk") is printed in italics under the action row.
- **Action labels lose the inspect core's glyphs** — its labels carry "▸ Watch now", "◎ Follow", "Go ▸"; the buttons
  draw their own icons, so the card strips a leading ▸ ◎ ↶ and a trailing ▸ (card.js `actLabel`). — Alternative: ask
  B to drop the glyphs (other consumers, such as the tests and future modules, read them as plain text).
- **The Show chip reads "Showing: X" and its button carries the way back** ("↶ Back to 08:39 at Lishkat HaGazit"),
  centred in the free area like the Show bar. Integration found it centred on the viewport, under the docked Menu, where
  its Back could not be clicked.
- **Touch, Menu closed: the bars keep clear of the beacon** — above it in portrait, beside it in landscape (where the
  height is short). Integration found the 10× travel bar's Skip and Stop under the landscape beacon. On coarse pointers
  the Slower / Faster buttons are dropped (the pace row is the control, as the phone wireframe has it; + / − and the
  D-pad still step the pace).
- **Nearby rows print the inspect core's bearing words as they come** ("ahead-left, 6 m"); they already carry the
  distance, which the UI had appended a second time.
- **An activity marker's label is left off where it would run under the Menu** (within 220 px of its edge); the
  diamond stays, and hover still labels it.
- **Here renders the core's place card without its NOW line and its What / Who leads** — the core's place card stands
  alone elsewhere (a lead sentence plus the full sections); in Here, Happening here, Who may enter and About are
  sections already, so the leads repeated them. Nearby shows only on the card of the place you are in (a card pinned to
  another place listed what is around you), and appears or goes as you enter or leave the pinned place.
- **Cards opened from a ref frame their subject too** (Nearby, Things here, search), not only pick hits: the subject's
  live anchor is projected, and when it is outside the free area the view turns to it (`ctx.inspect.frame`).
- **A card opens at its top** — the card view is reused; its scroll is reset after it is shown as well (a hidden view
  keeps the offset an earlier card left, so a person card opened at its Sources).
- **Without the inspect core (`?inspect=0` only)** — no hover, pick, Nearby, Things here or Show me; cards for places,
  rites, words, offering types, roles and site elements come from the UI's describer (`console/describe.js`), built
  only from the existing data (zone content, schedule, glossary, OFFERING_TYPES, site elements). Kept because
  `?inspect=0` is a supported boot A/B switch. With the core present it only supplies the Here card's Go when the
  core's place card has none (a place whose content gives no stand: the UI goes to the plan's anchor).
- **A tap or a free click on bare floor is empty scenery** — the inspect core answers a floor or wall hit with
  `kind: 'place'`; from a tap or an unlocked click that wakes the beacon (touch) or does nothing (mouse), as §2.4 says
  of empty scenery. E, a click with the pointer captured and pad X (deliberate aims) open that place's card.
  — Alternative: every floor tap opens Here (a card on almost every tap).
- **Cards rebuild when their data arrives** — the inspect core returns a placeholder (`loading: true`) until its
  describer has loaded; a card showing one rebuilds itself on the first live update that is not a placeholder.
- **Stage titles for grouped offerings** — "7 individual offerings at the blood on the altar", "2 meal-offerings in
  progress", "1 nazirite's offerings": the stage words are the stream's own stages (g5/plan.js), worded as counts.
- **Coach marks**: the pick coach mark is skipped without the inspect core (it would promise something that does not
  happen); marks hide while the Menu is open and resume after it closes.
- **Backdrop blur only on the Menu panel, only on high/ultra** — the old rule blurred every glass element.
- **Map section padding** — the map fills its view edge to edge on every layout (the sheets' view padding is overridden).
- **UI version** `2026.11-luach` in `console/welcome.js` drives "What's new" and the beacon's one-time dot.

## Verification

- `node src/ui/dev/consoletest.mjs` — 181 checks over desktop 1280×720, the map, phone 390×844 and 360×740, phone
  landscape 844×390, tablets 1024×768 and 768×1024, 1920×1080: every uitest.mjs / maptest.mjs check ported, plus the
  beacon, wake, pointer lock (stubbed `pointerLockElement`: Esc opens; alt-tab, blur and fullscreen exit do not), the
  gamepad (stubbed `getGamepads`), sections, search (en / he / commands / settings), cards, the travel bar, the banner
  (dwell, restricted variant, 60 s rule, areaNames off), captions and the Listen log, the demo module (AC-14), and
  guards: no box-shadow / filter animation or transition, UI tick in play ≤ 0.3 ms.
- UI tick on this machine (headless Edge, low): 0.14 ms EMA in play, 0.18 ms with Here open; the Map, while drawn,
  ≈ 0.45 ms (its canvases, as before).
- Cold boot (`node tools/warmup-check.mjs --tiers low --modes play`), A/B against the same tree with HEAD's `src/ui`,
  interleaved (base, console, base, console) on the HD 4600: first frame 21.3 / 14.2 / 13.8 / 13.8 s (the first pair
  under other load), worst frame in play 984 / 884 / 484 / 417 ms. No regression: the minimap raster, the search engine,
  the card content and the map prewarm all start in idle time after 'firstFrame'. Shot mode loads no UI.
- `node src/ui/dev/uishots.mjs [--touch] --w W --h H` walks play, wake, each section, search en/he, cards and the
  banner variants into `shots/console/`.
- `node src/ui/dev/sourcestest.mjs` — every citation Learn shows links.

### Integration (Checkpoint 2 → Final), with B's and C's cores present

- `node src/ui/dev/consoletest.mjs`: 209 passed, 0 failed, console clean (every device profile). New checks: Go calls
  `goTo(target, { way, pace, label })`; the bar has pace and Skip; a figure picks to its own ref; hover gives the
  tooltip and pointer cursor; a click on a person opens its card with no capture (110–250 ms), NOW, Show me, the ring,
  at its top; Show me reaches "showing", the chip reads "Showing: X" with "Back to …", and Back restores the clock and
  view; a warp shows the bar with "Skipping ahead", Skip and Cancel, holds captions, and shows the held one after Skip;
  E with focus in the Menu opens nothing; opening Here shows where you are; + raises the pace mid-trip, Run switches the way, both become the defaults;
  looking does not stop a trip; Skip arrives with ARRIVED; 10× shows the vignette and names each place on the route
  with a "via" breadcrumb; the search core finds `nzcj`, a role, a thing and a rite.
- B's suites: `inspect.js` (pick median 0.12 ms, p95 0.34 ms; 2185/2185 figures hooked; fails []); `inspect-show.js`
  `sn=10` (now ≤ 150 ms, warp ≤ 5.07 s, jump ≤ 247 ms, rewind ≤ 235 ms, tomorrow ≤ 1.03 s; every show framed, every
  Back ok); `objects-check.mjs` ok. C's: `triptest.mjs` all ok (60 trips; 10× frame median 0.4 ms); `searchtest.mjs`
  40/40 top-1, 73/73 top-3, p95 1.14 ms on an idle machine. Sim `zones.js` and `midnight.js` with the UI: pass.
  `tools/validate-schedule.mjs` 0 errors, 0 warnings; `tools/nav-coverage.mjs --q low` all reachable.
- `npx vite build` passes (search 18.8 kB, inspect 25.1 kB and inspect-describe 27.5 kB are their own chunks).
  `tools/warmup-check.mjs --tiers low --modes shot,play`: PASS, first frame 14.5 s (shot) and 13.4 s (play), worst
  frame in play 400 ms — no regression against the 13.3–14.1 s B and C measured.
- Device shots (`uishots.mjs` with an integration script: play, wake, Menu, Here/Nearby, a person card, Show me, an
  object card, search `nzcj` / מזבח, a 10× run with its banners, the Map) at 1280×720, 1920×1080, 390×844, 844×390
  and 1024×768 (touch): `shots/console-int/devices/`, console clean on all five. They found the integration fixes above (Show
  chip, action glyphs, card scroll, framing from a ref, Nearby distance, marker labels, touch bars, Here duplicates).

## Fix round (console review)

All 36 findings for A were fixed. The pre-fix console source is not in git, so the UI findings were reproduced by reading the
code path each finding names. Each one now has a consoletest check written to the reviewer's repro, and every check
passes. The cold boot, the leak and the overlapping fade were reproduced by measurement:
- boot: 1668 ms at +232 ms before the fix;
- leak: the soak guard;
- fade: the overlapping-fade check.

### Choices made in this round

- **Cold boot: no ambient animation until the boot's compile queue drains.** The medium play regression was bisected
  in the real `warmup-check` with temporary switches (since removed). The results:
  - ticker, Welcome and beacon off: pass, 985 ms;
  - beacon hidden alone: pass, 1018 ms;
  - its disc hidden: pass, 1018 ms;
  - only the halo's infinite opacity pulse stopped: pass, 1301 ms;
  - ticker off alone: fail, 1886 ms;
  - Welcome off alone: fail, 1702 ms.

  A compositor animation keeps the GPU process drawing frames while this thread waits on a program link, and every
  such wait grew. The first wait at the first frame (env's `MkInteriors` uniform-block apply on the probes' programs)
  grew from about 0.9 s to over 1.2 s, and a second wait of 0.5–0.7 s appeared at +1 s.

  `#ui-root.mk-quiet` holds the halo still (opacity 0.8) until `ctx.bootTimes.drained`, polled at 1 Hz and capped at
  4 min. The halo pulses after that, as §3.4 asks.
  - Alternative: no pulse at all. Rejected: the spec wants it, and it costs nothing once nothing is linking.
- **The Welcome's panel is painted once the boot settles.** "Settled" means main.js `warmup:issued`, 2 s after the
  first frame, with a 4 s fallback.
  - The Welcome is logically open from the first frame. Keys are gated, Enter enters, and main.js's Enter pause sees
    `.mk-intro-open`.
  - Painting it at the first frame failed twice (1819 and 1835 ms) and brought the second wait back: a 560 × 696 docked
    panel's first raster competes the same way.
  - The cost: a first-run visitor sees the scene for about 2 s before the Welcome.
  - The map prewarm, the search engine and the card content wait until the queue has drained (`app.afterDrained`; each
    also loads on first use: opening the Map, a query, Learn).
  - The minimap raster is built 6 s after "settled", which is close to where its idle callback landed before (+8.4 s).
    Built at +2.4 s, it fell on the frame where the deferred queue's first programs link.
  - The UI ticker does nothing before the first frame.
  - The minimap canvases are software canvases (`willReadFrequently`; `renderPlan(..., { cpu: true })` for their raster),
    so they never issue GPU-process work. They draw nothing until the raster exists; the dark disc is CSS.
- **The Welcome ends on any way out.** `console.open()` and `close()` call `welcome.enter()` while the Welcome is open.
  The rail and the tiles go through `console.open`, not `app.open`, so they were leaving the Welcome state behind.
- **E opens what it aims at.** E opens the card or the chooser in every input mode, and also announces "Ahead: X." for
  screen readers. Only the "What's ahead?" command just announces, with Enter for details.
- **A card picked in the world with the dock closed is the Menu's only level.** This covers a click, a tap, E, pad X and
  a marker. Esc or B returns to the world.
  - Phones keep the tiles under it, because their back button reads "‹ Menu".
  - A card opened from inside the Menu keeps its section underneath.
- **A place opened from a search result or a card is pushed over it.** Back returns to the results or the card.
  - A section view keeps its state when another level covers it (an optional `state()` on the section instance). Here
    returns as it was, pinned or not.
- **Search shows the best match first.** A "Top result" row holds the engine's first result among the shown kinds, and
  it is Enter's default. It is left out of its own group; the group count keeps the total.
  - A Go from the search blurs the field and focuses the travel bar's pace, so + and − are the pace again.
  - Every input event queries, including during an IME composition. §4.4 said "after compositionend", but Android
    keyboards compose every word until a space. Only Enter waits for the composition.
  - A new Menu session starts with an empty field, and a click into a held query selects it.
  - One "Open the Map / Time / …" command per section, so "map", "time" or "settings" find a way there.
- **A search row's buttons are reached by keys, not Tab.**
  - → at the end of the field enters the marked row's buttons; ← and → move between them; ← from the first, ↑, ↓ or
    Esc returns to the field.
  - Alt+Enter is Show me.
  - Each option's text names the keys it has.
  - The keys hint is hidden on touch.
  - Alternative: the ARIA grid pattern (heavier; deferred).
- **The header search over the Map is scoped to Places.** The scope chip shows Places and the results are filtered.
  Enter, or a click on a place, returns to the Map with that place selected on the plan.
  - Alternative: filtering the map's own list in place. There is no room for a results list on the plan.
- **The card's action row sits right under NOW,** so "see it in action" is in view when a card opens: actions at y 467–644
  in a 707 px view, against 877 before. This departs from the wireframe's order; the screen-reader order is title, NOW,
  actions, WHY.
  - Each WHY / WHAT / WHO block's citations sit behind one "n sources ›" chip; a single citation stays inline.
  - HOLDING chips open what the prop is for in place.
  - The see-in-action buttons are rebuilt (at most 1 Hz) when what they would do changes, and focus stays on the same
    action.
- **Header (dock).**
  - Close sits in the top-right corner over the names' line.
  - The rung and "About this place ›" share one line.
  - The English name stays on one line (cut, never wrapped).
  - Fly and Sound sit beside the search field.
  - Height at 1280×720: 266 → 202 px, or 244 px while the "↶ Back to 08:39" chip shows.
  - The chip names the hour it returns to, and its title holds the place.
- **Chambers half in kodesh and half in chol.** Lishkat HaGazit and Beit HaMoked (their `sanctityNote` begins so) read
  "Half kodesh, half chol ⓘ", with the note as the title, in the header, the beacon's label and the banner. They never get
  the restricted variant.
  - Request (zones owner): split the gazit zone at the line between its halves, so the rung follows the visitor.
- **Smaller fixes.**
  - Wake chips: out of the Tab order and the accessibility tree from boot, labelled at creation.
  - Gamepad: the right stick scrolls the current view; ←/→ reach a visible control in the header.
  - Chooser:
    - root-mounted at z 30, above the Menu, and kept inside the free area;
    - options carry their distance, plus left / right / ahead for look-alikes;
    - a captured pointer is freed first.
  - Captions: the lane sits above whichever bottom bar shows, measured with a ResizeObserver
    (`app.updateCaptionGap`).
  - Returning visitors from before the console (`mikdash.seen` = `1` or a version before 2026.11) get the three coach
    marks once.
  - Peek detent: the moved-out part of the portrait sheet is view padding, so every view's end scrolls into sight.
  - Input mode:
    - the mouse is detected from `pointermove` with `pointerType 'mouse'` only;
    - keys typed into a field on touch, or while composing, change nothing.
  - Flying on touch: the chips stack above Rise / Sink.
  - Sheets while typing a search:
    - the header folds to the field;
    - in landscape, Back and Close share the field's row;
    - the first result is at y 123 of a 190 px strip.
  - Coarse pointers: every control is at least 44 px; the inline "more ›" gets a larger hit area.
  - The full-sheet focus trap counts real Tab stops only.
  - The veil's sundial spins only while shown, and never with reduced motion (`body.mk-reduce` mirrors the setting).
  - Touch coach marks are right-aligned past 45 % of the width, and hidden while the chips are awake.
  - A soft keyboard that shortens the view while a field has focus keeps the layout.
  - Go controls are found in the page for repaints (no module-level set).
  - A superseded fade settles its promise.
  - The Show-me bar says "Tomorrow" or "Yesterday" for one day and the weekday and date otherwise (`dayText`).

### Dispositions

| # | Finding | Disposition |
|---|---|---|
| 1 | Rail or Close during the Welcome left "welcome open" | Fixed (console.js open/close end the Welcome). Test: rail Time → welcome false; Close; T opens Time; picking on |
| 2 | E after Esc / arrows only announced | Fixed: E opens the card or chooser and announces. Test: Esc ×2 then E → card, "Ahead: …" |
| 3 | Welcome's Enter below the fold at 1280×720 / 1366×768 | Fixed: sticky button; no search row on the Welcome. Test: in view at both sizes (bottom 657 of 707) |
| 4 | Search Enter opened the first group's first row | Fixed: "Top result" row, Enter's default. Test: kohen → role:kohen; mouse → a setting, Enter opens Settings |
| 5 | Focus stayed in the field after Go | Fixed: blur, focus the pace. Test: Ctrl+K nikanor, Ctrl+Enter, = → pace 2, field unchanged |
| 6 | Card actions two screens down | Fixed: actions under NOW; one sources chip per block. Test: actions in view at 1280×720; ≤ 3 inline chips |
| 7 | Invisible wake chips tabbable, unlabelled | Fixed. Tests: boot chips tabindex −1 and labelled; second Tab stop is past them |
| 8 | Pad: right stick no scroll; header unreachable | Fixed. Test: stick scrolls 735 px; ← reaches the rail, then the header |
| 9 | Map search hid the map, not scoped | Fixed (alternative in the finding): Places scope; Enter returns to the Map, place selected. Test: gazit |
| 10 | Chooser: identical entries; shown while locked | Fixed: distance and side; unlock first. Test: "Woman · 5 m · left" / "Woman · 8 m · right" |
| 11 | Two "Back" buttons | Fixed: header chip reads "Back to 08:39". Test |
| 12 | Header 266 px | Fixed: 202 px (244 with the Back chip). Test: ≤ 210 |
| 13 | Captions under the Show chip / travel bar | Fixed: measured lane offset. Test: caption bottom 642 ≤ chip top 660 |
| 14 | Back from a world card landed on Here | Fixed on the dock (phones keep "‹ Menu" to the tiles). Test: one stack level; Esc closes |
| 15 | Search gaps (Enter on a place, "map", stale query, row actions) | Fixed: push over search; section commands; empty new session and select on click; → and Alt+Enter. Tests for each |
| 16 | Pre-console returning users: only a notice | Fixed: coach marks once. Test: seen = 1 → coach "Your Menu…" |
| 17 | Peek: bottom 44 % unreachable | Fixed: view padding = the sheet offset. Tests: card end and home end in sight at peek |
| 18 | Phones flipped to mouse caps | Fixed: pointer-type detection; text-field keys ignored. Test: two CDP taps keep touch, no cap |
| 19 | Fly on touch: chips over Rise / Sink | Fixed: chips stack above. Tests: no overlap; holding Rise climbs |
| 20 | Search silent during IME composition | Fixed: queries on input. Test: imeSetComposition מז → results |
| 21 | Landscape keyboard hides results; portrait keeps the full header | Fixed: header folds while typing; landscape Back / Close on the field row. Test: first result at 123 of 190 |
| 22 | Touch targets under 44 px | Fixed. Tests: card controls and the 10× travel bar ≥ 44 px |
| 23 | Focus trap leaked | Fixed: Tab stops only. Test: 45 Tabs, 0 outside |
| 24 | Reduced motion: sundial spun | Fixed. Test: animationName none with the setting |
| 25 | Coach marks over chips and the joystick ghost | Fixed: right-aligned ≥ 45 %; hidden while chips are awake. Test: left ≥ 175 px, no overlap with the ghost |
| 26 | Keyboard resize flipped the layout | Fixed. Tests: 1024×368 stays dock; 768×600 stays the bottom sheet |
| 27 | Search row buttons inside role=option | Fixed by keys (→, Alt+Enter) and option text; hint hidden on touch. Grid pattern deferred |
| 28 | Chooser under the sheet | Fixed: root-mounted, z 30, inside the free area. Test: parent #ui-root, z 30 |
| 29 | Holding descriptions tooltip-only | Fixed: chips expand in place. Test |
| 30 | Gazit shown as one rung | Fixed in the UI ("Half kodesh, half chol ⓘ"); request for the zones split filed. Test |
| 31 | Cold medium play boot FAIL | Fixed: quiet halo until drained; Welcome paint at settle. warmup-check: see Verification |
| 32 | Go controls leaked detached DOM | Fixed: no registry. Test: 50 cards + 20 searches leave +203 nodes after GC |
| 33 | Stale "See in action" labels | Fixed: rebuilt at ≤ 1 Hz. Test: "Watch now (≈3 h 47 left)" → "Rewind to ≈07:42" past the end |
| 34 | Superseded fade never settled | Fixed. Test: two overlapping fades both resolve |
| 35 | Sundial spinning while hidden | Fixed. Test: no running mk-spin in play |
| 36 | "Tomorrow" for any later date | Fixed (`dayText`). Test: +1 Tomorrow, +2 "Wednesday 4 Nov", −1 Yesterday |

### Verification (fix round)

- `node src/ui/dev/consoletest.mjs`: 255 passed and 1 failed in the full run, with a clean console. The failure was
  the Here tick at 0.409 ms against a 0.4 ms limit; most of it was the inspect core's place `describe` (0.55 ms per
  call) at 4 Hz. A card without its NOW line (Here) now re-describes at 1 Hz. The desktop profile was re-run after that:
  161/161, Here 0.31 ms, play 0.25 ms. Every new check is listed in the dispositions.
- Medium play cold boot, before the fix: FAIL, 1668 ms at +232 ms, with a second `getUniformBlockIndex` wait of
  581 ms at +1266 ms. Stacks from a scratch copy of the check show both waits are env/interiors.js `beforeRender` →
  `UniformBlock.apply`.
- `tools/warmup-check.mjs`, all tiers × shot and play: ALL PASSED.
  - Play, final code:
    - low: 16.1 s first frame, worst frame 384 ms;
    - medium: 1018–1301 ms worst frame over four runs, then 1168 ms;
    - high: 1385 ms.
  - Ultra play sits near its 2000 ms limit with the old UI as well. Interleaved on the same tree with HEAD's `src/ui`:
    the console 1618 and 1685 ms; the old UI 2336 (FAIL) and 1518 ms. Other runs of the final code: 1668, 1819,
    1868 ms.
  - Ultra's worst frame (+2.1–2.7 s) is env's probe readback (`getBufferSubData`) right after main.js issues its
    deferred queue. Moving the Welcome's paint 1.5 s later did not change it (1785 and 1985 ms).
- Other suites:
  - B: `inspect.js "t=d3&inspect=1"` fails [], `inspect-show.js` fails [], `objects-check.mjs` ok;
  - C: `searchtest.mjs` 40/40 top-1, 73/73 top-3; `triptest.mjs` all ok;
  - `validate-schedule` 0 errors, 0 warnings; `nav-coverage --q low` all reachable; `sourcestest.mjs` passed;
  - `npx vite build` ok; sim `zones.js --keep-ui` ok.
- Sim `midnight.js --keep-ui` failed one segment per run (113–204 ms frames, sim ≤ 1 ms in them). The same tree with
  the old UI fails it too (371.7 ms at speed 1). This machine was not idle (other sessions), which the test warns
  against; nothing in it points at the console.

## API

### ctx.ui (src/ui/app.js)

All the old calls keep working.

```js
ctx.ui = {
  toast(msg | { en, he }, ms = 3200, { id }?),      // a notice: max 2, top centre of the free area
  fade(to 0..1, ms) | fade(ms) -> Promise,          // the veil (player / director contract unchanged); a fade
                                                    //   superseded by a newer one resolves at once
  open(name, opts?) -> boolean,
  //   names: 'here' | 'happening' | 'map' | 'time' | 'learn' | 'listen' | 'settings' | 'help' | a module's section id
  //   legacy: 'info' → here ({ zone } → pinned), 'about' → learn ({ section: 'controls' } → help)
  //   opts: here { zone, pinned, passedAt, scrollTo: 'about' }; happening { filter: 'all'|'here'|'near'|'aggadah' };
  //         map { zone, event, centerMe }; time { focusEvent }; learn { section }; help { topic }
  close(), toggle(name), get panel(),              // panel = the current section id | null
  hints(on),                                        // no-op (the hint bar is gone)
  enter(),                                          // dismiss the Welcome
  enabled, map,                                     // map = the map's test handle (see below)
  card(ref | hit, opts?) -> boolean,                // 'kind:id' | { kind, id } | an inspect Hit; zone refs open Here pinned
                                                    //   (pushed over a search or a card); opts.fromWorld: picked in the
                                                    //   world — with the dock closed the card is the Menu's only level
  search(q?, { scope }?),                           // the Menu with the search focused (and filled); without a scope
                                                    //   it follows the section it opens over (Places over the Map)
  banner(zoneId | { en, he }, { kind: 'enter'|'arrive'|'restricted' }?),
  modules,                                          // the registry (§5)
  announce(text),                                   // a polite live-region line
  console: {
    state() -> { open, layout: 'dock'|'sheet-portrait'|'sheet-landscape', view: { type, id }, section, detent, welcome, stack },
    results() -> Result[], card() -> Card | null, beacon() -> { name, expanded, rect }, banners() -> [{ zone, kind, text, t, via }],
    pick(x, y) -> Hit | null, markers() -> [{ id, vis, label }], free() -> { l, r, t, b },
    stats() -> { tickMs, tickMax, n, parts: { [name]: { ema, max } } }, travel() -> trip | null, input() -> 'mouse'|'touch'|'keyboard'|'pad',
  },
};
```

`ctx.ui.map` (unchanged from the map task, plus): `places(on)`, `key(on)`. The map section's instance also has
`viewRect()` (the visible plan, for the header's overview disc) and `selectPlace(id)`.

### Bus

Emits `ui:card { ref, card }` when a card opens and `ui:menu { open, section }`. Consumes `caption` (with optional
`source: 'audio'|'sim'|'narration'`), `zone:change`, `time:date`, `settings:change`, `quality:change`, `firstFrame`,
`travel:start | progress | pace | zone | end` (C), `player:tap | inspect | intent` (C), `inspect:show` (B), and
main.js's `warmup:issued` (the boot has settled: the Welcome's panel and the UI's idle work start then).

### ctx.settings (src/ui/settings.js)

New keys: `travelWay` (instant | walk | run; default walk), `travelPace` (0.5 | 1 | 2 | 5 | 10; default 1), `lookMode`
(lock | drag; default lock on a fine pointer, read by the player), `quickChips` (wake | always), `areaNames` (always |
travel | off), `restrictedNotices` (bool, default true). `labels` is shown as "Activity markers". `travelSpeed` is
migrated once (instant → instant; slow → walk ½×; walk → walk 1×; fast → walk 2×; run → run 1×) and removed.
`ctx.settings.define({ key, type: 'bool'|'number'|'enum'|'select', values?, min?, max?, default, group?, label? })`
declares a setting (modules: `module.<id>.<key>`) and returns an undefine function (the stored value is kept).
After a quality / amah reload, `sessionStorage mikdash.resumeMenu = 'settings'` reopens the Menu at Settings.

### ctx.ui.modules (src/ui/console/modules.js)

As §5 of the design: `register(def) -> off`, `unregister(id)`, `has(id)`, `get(id)`. A def may carry `section`
(`{ id, label, icon, order, key?, badge?(ctx), fullDetent?, mount(el, api) -> { show(opts), hide(), update(), tick?(dt), state?()
(what Back restores: kept on the view's stack entry when another level covers it and passed back as show({ back, state })),
onEscape?() -> bool, focusTarget?(), dispose() } }`), `listen` (`{ order, mount(el, api) -> { update, dispose } }`),
`cardActions(card, api) -> [{ id, label, icon?, run }]`, `cardSections(card, api) -> [{ id, title, mount(el) | text | items | refs }]`,
`search: { kind, label, docs(ctx) -> Doc[] }` (a live source), `commands: [{ id, title, keywords?, key?, run(api) }]`,
`settings: [{ key, group, type, label, values?, default }]`, `banner(zoneId, api) -> { action: { label, run } } | null`,
`status(ctx) -> { label, action? } | null` (the header's one chip), `on: { [busEvent]: (e, api) => {} }`.
`api = { ctx, open, card, close, caption(text, ms), notice(text, ms), settings: { get, set }, h, t }`. A hook that
throws is logged once and disables its module. The eight built-in sections register through it (orders 10…80).

### Card data the renderer accepts (src/ui/console/card.js)

B's `Card` (§6.2). Section objects may carry `text`, `lead` (+ `text`: the lead with "more ›"), `items` (strings or
`{ text, ref?, sources? }`), `refs` (chips that open cards), `sources`, `open`, or `mount(el) -> { update(t) }` (live).
The first section is open; the rest collapse. Actions render in the order see-in-action (≤ 2), follow, go (the Go
control), time ("Set clock to start", `tSet`), map, learn, then module actions.

### Files

`src/ui/console/`: console.js (the Menu, views, history, detents), layout.js, header.js, minimap.js, beacon.js,
card.js, describe.js (cards when the inspect core is absent, `?inspect=0`; `parseRef`, `refStr`, `ROLE_NAMES`), eventrow.js (`eventRow`, `dynGroup`,
`stageTitle`, `showAction`, `runShow`), go.js (travel), showbar.js (`dayText(fromDate, toDate)`), banner.js, search.js (`createSearchEngine`, `createSearchUI`),
commands.js (`COMMANDS`, `sectionCommands(app)`), captions.js, markers.js, pickui.js, inputmode.js, gamepad.js, welcome.js (`UI_VERSION`, `WHATS_NEW`),
modules.js, content.js, icons.js, console.css, sections/{here,happening,map,time,learn,listen,settings,help,widgets}.js.
Kept and adapted: timepanel.js (`createTimeControl(app, { onArc })`, `packLanes`), mappanel.js (the Map section's
view), map/card.js, map/places.js (a browse list; no input), map/plan.js (`renderPlan(ctx, model, { …, cpu })`: cpu → a
software canvas). Retired: hud.js, intro.js, infopanel.js, aboutpanel.js,
settingspanel.js, events.js, panel.js, and the tests dev/uitest.mjs and dev/maptest.mjs (every check ported to consoletest.mjs). `ABOUT_SOURCES` now comes from `console/sections/learn.js`.
Dev: `src/ui/dev/consoletest.mjs`, `src/ui/dev/demo-module.js`, `uishots.mjs` (`--touch`, `print` steps).
