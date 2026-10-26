# The Luach console: final design spec

Status: final design, ready to build. Supersedes ARCHITECTURE §13 (UI) once built. The orchestrator owns ARCHITECTURE.md
and updates §13/§14 from §6 of this file.

Inputs: the console audit (`shots/console-audit/`), the two proposals (Luach codex console; Ring console), and the
three judges' reports. All three judges chose Luach. This spec starts from Luach and adds the grafts the judges named.
It also fixes the criticisms they raised and cuts the scope they flagged.

---------------------------------------------------------------------------------------------------------------------

## 0. The design in one page

**One door, always visible, always labelled.** In play the screen shows one control: the **Menu beacon**. It is a
small pill that holds:

- a live minimap disc with a glowing dot for "you";
- the name of the place you are in (Hebrew and English);
- the word **Menu**;
- the key cap of the device you are using (`Esc`, the Menu glyph on a gamepad, nothing on touch).

On desktop it sits top-left, where the location card is today. On touch it sits bottom-right, under the thumb and
outside the joystick zone. If you move the mouse (pointer free) or tap empty scenery, the beacon "wakes": it pulses
once and shows a row of labelled quick chips (the hour, Map, Search, Help) for 4 s. This meets the request to "move
the mouse or tap to present the option" literally, and the beacon itself never hides.

**The Menu (the console, לוח).** Opening it never hides the world.

- Desktop and tablet landscape: the Menu docks on the right (560 px). The world stays live on the left; you can drag
  to look, click to inspect, and keep walking with WASD.
- Phones: the Menu is a bottom sheet (a right sheet in landscape). Its home screen is a 4×2 grid of labelled tiles.

Every Menu view starts with the same **header**:

- the minimap (a glowing dot, a heading cone, a gold diamond toward the Kodesh HaKodashim);
- the current area's Hebrew and English names, its sanctity rung and **"About this place ›"**;
- the live clock with pause and speed;
- one **search** field that takes English, Hebrew or transliteration;
- labelled actions: Fly/Walk, Sound, Close.

**Eight labelled sections.** Each has an icon and a visible name, plus live micro-text such as "Happening · 7" and
"Time · hour 4":

| | Section | Holds |
|---|---|---|
| ⌂ | **Here** | This place's card |
| ✦ | **Happening** | Now and next: Everywhere, Here or Near me |
| ▦ | **Map** | |
| ◔ | **Time** | Dial, transport, date and zmanim |
| ❡ | **Learn** | Codex, glossary, method and sources |
| ♪ | **Listen** | Sound, subtitles, music, recent captions; the home of narration |
| ⚙ | **Settings** | |
| ? | **Help** | Controls for your device |

**One card for everything.** A person, an animal, an object, a place, an event, an offering type and a word all
render through one card. Every card has the same action row:

- **Go ▸**: one travel control (Walk, Run or Instant; pace ½× 1× 2× 5× 10×).
- **Show me ▸**: fast-forward or rewind to the moment and frame the subject, with a visible progress bar, Skip,
  Cancel and "↶ Back".
- **Map**.
- **Learn**.

**Click or tap anyone or anything** to open its card:

- Desktop with the pointer free: click it.
- Desktop with the pointer locked: aim the centre reticle, then click or press `E`.
- Touch: tap it.
- Gamepad: press X.
- Keyboard and screen-reader users: use the "Nearby" list.

**Area banner.** Entering an area, on foot or while travelling, shows its name in the upper third as a calligraphic
banner. Click or tap it to open that place's card. At 5× and 10× a "via …" breadcrumb names the areas you pass
through.

**One key to remember: Esc.** Every other key is printed on the control it triggers.

Three engineers build it in parallel (§6):

- **A, UI console** (`src/ui/**`).
- **B, Inspect core** (`src/sim/inspect*.js`, choreo `describe` hooks, `src/people/pick.js`, `src/data/objects.js`,
  `src/data/people-info.js`).
- **C, Travel and Search core** (`src/player/**`, `src/search/**`).

### 0.1 What changed from the winning proposal, and why

| Judges' point | Resolution here |
|---|---|
| Esc via `pointerlockchange` is fragile as the only door | The **beacon** is the advertised door on every device. Esc is an accelerator (§2.2), guarded against alt-tab, fullscreen exit and unlocks the app itself caused. |
| Tab as an open key fights focus and screen readers (Ring) | Not adopted. Tab is standard focus. The beacon is the first Tab stop. |
| "Auto" L1 hides the minimap while walking; extra state machine | Dropped. The beacon (with its minimap disc and place name) is **always** on. The only extra state is the 4 s "wake" chip row. |
| Seven tabs too heavy; Here, Now and Time overlap; phone tab bar does not fit | **Eight sections in a 4×2 labelled tile grid on phones** (which fits 390 px with every label visible) and a labelled vertical rail on desktop. Here shows only "Happening here (3) · All ›". The full list lives in Happening, with an Everywhere / Here / Near me filter. Time holds no lists. |
| Type-to-search conflicts with T/M/I accelerators | No global type-to-search. Search is focused by `/`, by `Ctrl/⌘+K`, by clicking the field, or by the Search chip. Letter accelerators work from the world only. With the Menu open and focus outside a text field, letters do nothing except the movement keys. |
| Listen deserves a first-class home for audio and narration | **Listen** is a section, and the default mount point for audio and narration modules (§5). |
| Fly unreachable on touch and gamepad-UI | A labelled **Fly / Walk** toggle in the Menu header. On touch in fly mode, labelled **Rise / Sink** buttons appear. |
| ½× missing once "slow" is gone | Pace set **½× 1× 2× 5× 10×**. |
| Silent warp; cue and caption bursts during a warp | A visible **Show-me bar** (progress, target name, Skip, Cancel). During a warp, captions are held and audio is dipped (§4.2). |
| Breadcrumb at high pace | Done (§4.5). |
| "Things here" chips | On the place card, next to "Nearby" (§4.1). |
| A 10 fps render throttle needs an engine hook and risks resume latency | **Deferred.** The Menu never covers the whole world, so there is little to save. |
| Wrong-keyboard-layout mapping, discovery journal, gamepad spatial nav, hold-Start quick select | The layout map is kept: it is 30 lines (§4.4). The journal and hold-Start quick select are deferred. Gamepad uses a linear focus order, not spatial navigation. |
| Cross-owner scope (E rebind, pickables, describe, content) | Assigned explicitly to B and C, with feature detection so that A ships without them (§6.4). No change to the schedule data, the engine or orchestrator files. |
| Follow of a pooled slot may land on another figure after a jump | Subjects carry a stable `subjectKey` that choreos resolve with `locate()`. Without it, the camera frames the event, not a guessed figure (§6.2). |

---------------------------------------------------------------------------------------------------------------------

## 1. Principles and precedents

### 1.1 Principles

1. **One door.** There is one visible, labelled thing to remember on every device: the Menu beacon. Its key cap
   follows the last input you used.
2. **"Where am I" is never hidden.** The beacon always shows the minimap dot and the place name. Every Menu view starts
   with the full header (minimap, area name, "About this place ›", clock, search). No view, card or sheet can scroll
   them away.
3. **The world is the content.** The Menu docks beside the world or sits under it as a sheet; it never covers it all.
   Only the Map takes the full screen on a phone, and its header still shows where you are.
4. **Every icon has a visible text label.** The only exception is ✕, and on phones ✕ reads "Close".
5. **One home per kind of information; other paths are doors to it.** There is one card renderer, one event row, one
   travel control and one search.
6. **Keys are shown, not taught.** Each control carries its key cap for the active device. Help lists them all.
   Nothing teaches by a timer that disappears.
7. **Honest content.** Cards show only sourced text, with sources and confidence badges. Figures are role slots ("a
   kohen of the morning crew"), never invented individuals. When nothing sourced exists, the card shows less.
8. **Cheap on weak GPUs.**
   - Animate only transform and opacity; never box-shadow or filter.
   - Backdrop blur only on high and ultra.
   - Write to the DOM only on change.
   - No new shaders, no `readPixels`, no synchronous WebGL queries.
   - CPU picking, with the pick ring drawn in the DOM.
9. **Expandable.** Built-in sections register through the same module registry (§5) that narration, tours and an
   audio guide will use.

### 1.2 Precedents (what we follow, and what we deliberately do not)

| Precedent | Taken | Not taken |
|---|---|---|
| Zelda BotW Sheikah Slate; Compendium | One tablet-like console with labelled sections. "Inspect anything, and it lives in the codex" (Learn). | Freezing and hiding the world. |
| Elden Ring, Dark Souls, Skyrim area titles | A large calligraphic place name on entering a region. | — |
| Assassin's Creed Discovery Tour, museum audio guides | Guided "show me" moments that frame the subject. Tours and narration are made of the same steps. | — |
| Destiny, Halo and other contextual HUDs | The HUD wakes on input. | Hiding the essentials (the beacon stays). |
| Browser pointer-lock games (three.js FPS, Krunker) | Esc frees the mouse and shows the menu; click to resume. | Making it the only door. |
| Spotlight, VS Code Ctrl+K, Windows Start | One search for everything, grouped by kind, with keyboard Enter and Esc. Commands appear in the results. | Global type-to-search (it conflicts with WASD). |
| Google Maps and Apple Maps cards | The same card and actions everywhere; a chooser for overlapping pins. | — |
| RTS minimaps | A north-up minimap with a glowing self dot. The Map section shows the viewport rectangle. | — |
| Flight Simulator sim-rate, Kerbal warp, city-builder 1×/2×/3× | Pace steps with + and −. Warp eases out before the target. Substeps keep the physics stable. | — |
| Xbox and PlayStation conventions | Start = menu, B = back, LB/RB = sections, X = interact. Prompt glyphs swap with the device. | — |
| iOS and Android bottom sheets; Android back | Drag down to dismiss; the system back closes one level. | — |
| GTA weapon wheel (Ring proposal) | — | Wheels hide labels and do not suit phones or screen readers. |

---------------------------------------------------------------------------------------------------------------------

## 2. Invocation per device

### 2.1 Summary table

| Device | The affordance in play | Open the Menu | Straight to a section | Back / close | Inspect |
|---|---|---|---|---|---|
| Desktop mouse, pointer **locked** | The beacon, always visible. The reticle prompt "Kohen · slaughtering — E Inspect" appears when aiming at a subject | **Esc** (the browser frees the mouse; the Menu opens, §2.2), or press M, T, I, `/`, `?` | M Map · T Time · I Here · `/` Search · `?` Help | Esc goes back one level, then closes. The **✕ Close** click re-locks the pointer (it is a user gesture) | Left click or **E** on the reticle target |
| Desktop mouse, pointer **free** | Mouse move wakes the beacon: pulse plus quick chips for 4 s | Click the beacon or a chip, or Esc | Same keys; the chips | Esc / ✕ / Close | Hover shows a name tooltip and a pointer cursor. **Click** a subject (a click on a subject never grabs the pointer). E inspects at the cursor |
| Laptop trackpad | As mouse. Look mode `lock` (default on fine pointers) or `drag` (Settings → Look & move) | As mouse | As mouse | As mouse | Tap-click as click |
| Touch phone (portrait and landscape) | The beacon bottom-right. A tap on empty scenery wakes it (pulse plus chips stacked above it) | Tap the beacon, or tap a chip (Time, Map, Search) | Chips; tiles on the Menu home | "‹ Menu" goes back to the tiles; **Close**, drag the grabber down, or system back (one `history` entry per level) | **Tap** anyone or anything (a tap is < 300 ms and moves < 10 px) |
| Tablet | Landscape ≥ 960×560 uses the docked desktop layout with touch sizing. Portrait uses the phone sheet | As phone | As phone | As phone | Tap |
| Gamepad (standard mapping) | Any button wakes the beacon. The key cap shows the Menu glyph | **Start/Menu (9)** | **View (8)** = Map. LB/RB = previous/next section while the Menu is open | **B** goes back, then closes. Start closes | **X (2)** at the reticle |
| Keyboard only | The beacon is the **first Tab stop** ("Menu — Ezrat Nashim · Esc") | Esc, or Enter on the beacon | Accelerators | Esc | **E** (the reticle while locked; the screen centre otherwise). Here → **Nearby** lists every subject without aiming |
| Screen reader | The beacon is the first stop, with `aria-keyshortcuts="Escape"`. Zone changes are announced politely | Same | Same | Same | Here → Nearby (with bearing and distance). E announces "Ahead: Kohen, slaughtering. Press Enter for details." |

### 2.2 Pointer lock and the Menu (exact rules, owned by A)

- **Esc while locked.** The browser exits pointer lock and does not deliver the keydown. On `pointerlockchange` to
  unlocked, A opens the Menu only when all of these hold:
  - A did not cause the unlock itself (A sets `expectUnlock = true` for 500 ms before every `player.unlock()` or
    `setInputEnabled` call that releases the lock);
  - `document.visibilityState === 'visible'`;
  - `document.hasFocus()` is true when checked in the next `requestAnimationFrame` (alt-tab and window blur fail this);
  - no `fullscreenchange` happened in the last 300 ms.
- **Closing with Esc cannot re-lock** (Esc is not a user-activation key). The world stays unlocked. The beacon's wake
  row shows "Click the view to look around" once per session.
- **✕ Close or "Resume" by click** re-locks the pointer within that gesture. Chrome refuses a re-lock for about 1 s after
  a user Esc; on `pointerlockerror`, the player's existing drag-look fallback applies (retry after 1.5 s).
- **Opening the Menu by M, T, I, `/`, `?` or Start while locked:** A calls `player.unlock()` with `expectUnlock` set.
- **Clicking the scene while the Menu is open never closes it.** This is today's audit item 8. A click inspects (if it
  lands on a subject) or does nothing. A drag looks around. The Menu closes only with ✕, Esc, B or the system back.
- **The Menu open on a fine pointer.** The player is fully enabled except that it **does not request pointer lock**:
  `ctx.player.setInputEnabled({ pointerLock: false })`. Look is click-and-drag on the world.
- **Menu closed, pointer free:** `ctx.player.setLockFilter(fn)` is called with
  `fn = (e) => !(menuOpen || hoverHasSubject(e))`. A click on a subject therefore inspects instead of locking, and a
  click on empty world locks.

### 2.3 How movement keys and the Menu coexist

- With the Menu open and focus **outside a text field**:
  - **W A S D, Shift, Space, Q/C and F still move the observer.** The docked Menu is a HUD, not a pause screen.
  - Arrows, Space, Enter, Home/End and PgUp/PgDn go to the Menu whenever focus is inside it.
- With focus **in a text field** (search), every key goes to the field.
- On a phone, the sheet covers part of the canvas. The joystick and look-drag work on the visible part. When the Map,
  Learn, Settings or Help sheet takes the full screen, player input is disabled (as the map does today).
- The gamepad drives the Menu while it is open: `setInputEnabled({ pad: false })` for the player, and A polls the pad.

### 2.4 Bindings: old → new

| Input | Old | New |
|---|---|---|
| W A S D / ↑↓ / ←→ / Shift / Space / Q C / F | Move, turn, run, fly up/down, fly toggle | Unchanged. Arrows and Space go to the Menu when focus is inside it |
| **E** | Fly up (duplicate of Space) | **Inspect.** Space still rises; Q/C still sink |
| T / I / M | Toggle Time / Info / Map | Open the Menu at Time / Here / Map. Pressing the same key again closes it |
| G | Settings (no mnemonic, undocumented) | Silent alias for Menu → Settings for one release, then removed. Never printed |
| ? | About at Controls | Menu → **Help** |
| / | Map search, only with the map focused | **Menu search, from anywhere** |
| Ctrl/⌘ + K | — | Menu search |
| **P** | — | Pause / play the clock (printed on the clock's ❚❚ button) |
| Esc | Free mouse + close panel + clear search + **cancel walk** | **Menu: open / back / close** (the browser still frees the mouse first). It never cancels a walk. Inside a text field, the first Esc clears the field |
| + / − | Map zoom (map focused) | Map zoom when the Map stage is focused; otherwise, **pace up/down during a trip** |
| Enter | Dismiss the intro; Go on the map; set the clock on an arc | Activates the focused control. On a map selection: Go. Arcs: open the event card |
| Tab | Trapped in modals | Standard. Trapped only in full-screen phone sheets (`aria-modal`) |
| Click scene, locked | Nothing | **Inspect at the reticle** |
| Click scene, free | Lock the pointer | Inspect when over a subject; else lock |
| Mouse look during a guided walk | **Cancelled the walk** | Looks around freely; the walk continues (§4.3) |
| Touch tap on the world | Nothing | Inspect; on empty scenery, wake the beacon |
| Two-finger tap | Run / walk | Unchanged |
| Pad X | — | Inspect |
| Pad Start / View | — | Menu / Map |
| Pad D-pad ← → during a trip | — | Pace −/+ |
| Pad B during a trip (walking) | Sink (fly only) | Stop the trip. In fly mode it is still sink |

The essentials, printed at the top of Help and on the Welcome screen:
**Esc = Menu · E / click / tap = learn about anything · Go ▸ = travel.**

---------------------------------------------------------------------------------------------------------------------

## 3. Layout, information architecture and look

### 3.1 Layers (z-order, bottom to top)

1. **World canvas.**
2. **In-world layer:**
   - activity markers;
   - the hover/pick ring (a DOM ellipse at the subject's feet);
   - the reticle and its prompt (locked or gamepad only).
3. **Captions lane:** bottom centre of the *free* area, max 2 lines, en + he.
4. **Area banner:** upper third of the free area.
5. **Travel bar / Show-me bar:** bottom of the free area. At most one of them at a time; the Show-me bar wins.
6. **Beacon** and its wake chips.
7. **Menu:** dock or sheet. While the Menu is open in dock layout, the beacon hides, because the header repeats it.
8. **Notices:** max 2, top centre of the free area. Errors and confirmations only (§3.7).
9. **Veil:** the fade, used by teleports and jumps.
10. **Welcome and coach marks.**
11. **Debug overlays** (unchanged).

"Free area" = the viewport minus the docked Menu (dock layout) or minus the sheet (phone). A publishes it as CSS
variables `--mk-free-l/r/t/b` and calls `ctx.inspect.setViewInset()` (§6.2) so framing centres in it.

### 3.2 Breakpoints

| Layout | When | The Menu is | Navigation |
|---|---|---|---|
| **dock** | width ≥ 960 and height ≥ 560 (desktop, laptop, tablet landscape) | A right panel 560 px wide (`min(560px, 46vw)`), full height minus 12 px margins. **Map** widens it to the full viewport minus 12 px | Labelled vertical rail (112 px) plus content (448 px) |
| **sheet-portrait** | otherwise, with height > width (phones, tablet portrait) | A bottom sheet. Detents: **peek** 56 dvh (Here, Happening, Time, cards, the home) and **full** 100 dvh minus the safe area (Map, Learn, Settings, Help, Listen, search with the keyboard up). Drag the grabber between detents or down to close | Home = 4×2 tiles; a section = drill-down with "‹ Menu" |
| **sheet-landscape** | otherwise, with width ≥ height (phones in landscape) | A right sheet `min(480px, 58vw)`, full height. The Map takes the full screen | As sheet-portrait |

Tablets use 44 px touch targets in every layout (`pointer: coarse`).

### 3.3 Wireframes

#### 3.3.1 Desktop play, Menu closed (1280×720)

```
+----------------------------------------------------------------------------------------------+
| +-------------------------------------------------------+                                    |
| | (◉) עזרת הנשים · Ezrat Nashim          | ☰ Menu  [Esc] |  <- BEACON (always). Disc = live    |
| +-------------------------------------------------------+     minimap 40 px, glowing dot      |
|   [◔ Day · hour 4 · ≈08:39] [▦ Map  M] [⌕ Search  /] [? Help  ?]   <- WAKE ROW (4 s, on mouse  |
|                                                                      move / pad / zone change)  |
|                        +--------------- ENTERING ---------------+                            |
|                        |               עזרת ישראל                |  <- AREA BANNER (3.2 s)     |
|                        |       Ezrat Yisrael  ▮▮▮▮▮▯▯▯▯▯▯          |     click / tap = place card|
|                        |   via Chel · Sha'ar Nikanor   More [I] |     (breadcrumb at ≥ 5×)    |
|                        +----------------------------------------+                            |
|                                          ·  <- reticle (locked / pad only)                    |
|                                Kohen · slaughtering   [E] Inspect                             |
|                                                                                               |
|           The Levites sing: "A song of ascents…" · שיר המעלות          <- CAPTIONS            |
| +-- Walking to the Mizbeach · 84 m · ~9 s  [½× 1× 2× (5×) 10×] [−][+]  [Walk|Run] [Skip ⇥] [■ Stop] --+
+----------------------------------------------------------------------------------------------+
```

Beacon detail:

- Height 44 px. The disc is 40 px; its rim carries the N tick and the gold KhK diamond.
- The Hebrew name is gold (Frank Ruhl). The English name is ink; "— the …" subtitles are dropped.
- The name truncates at 260 px with an ellipsis. The full name is in the `aria-label`.
- When the clock is not at 1×, a speed badge (`10×` or `❚❚`) sits on the disc, so a fast or paused clock is never
  hidden.
- At sanctity rung ≥ 7, a red-gold underline appears.

#### 3.3.2 Desktop, Menu open, section Here (dock)

```
+--------------------------------------------------+-------------------------------------------------+
|                                                  | +---------+ עזרת הנשים     [✈ Fly] [♪ Sound] [✕ Close Esc] |
|                                                  | |    N    | Ezrat Nashim — the Women's Court               |
|                                                  | |  · ◉>   | ▮▮▮▮▯▯▯▯▯▯▯ Sanctity of Ezrat Nashim            |
|   LIVE WORLD (free area)                         | |    ◆  ✦ | About this place ›                              |
|   drag = look · click = inspect · WASD = walk    | +---------+ ◔ Day · hour 4 of 12 · ≈08:39 [❚❚ P] [10× ▾]|
|   hover → "Levi · singing" tooltip + ring        | [⌕ Search places, rites, people, things…        / ]|
|                                                  | +-------------+-----------------------------------+|
|                                                  | | ⌂ Here    I | HAPPENING HERE · 2      All in ✦ ›  ||
|                                                  | | ✦ Happening | ◆◆ The Levites' song   now · 12 min ||
|                                                  | |    · 7      |    [Go ▸ Walk·2× ▾] [Show me ▸]     ||
|                                                  | | ▦ Map     M | ◆  Nazirites' offerings  in 14 min  ||
|                                                  | | ◔ Time    T |    [Go ▸] [Show me ▸]               ||
|                                                  | |    hour 4   | THINGS HERE                         ||
|                                                  | | ❡ Learn     | [The 15 steps] [Nikanor gate]       ||
|                                                  | | ♪ Listen    | [Lishkat HaNezirim] [+4]            ||
|                                                  | | ⚙ Settings  | NEARBY  Levi, singing · 6 m ahead › ||
|                                                  | | ? Help    ? | WHO MAY ENTER  Everyone pure… more› ||
|   caption lane (centred in the free area)        | |             | WHAT IS DONE HERE ›  ABOUT ›  9 SOURCES › ||
+--------------------------------------------------+-------------------------------------------------+
```

- The header is about 170 px tall and fixed. The minimap disc is 120 px.
- The rail and content scroll independently.
- Rail items are 44 px: icon, label, live micro-text (≤ 2 Hz), and the key cap on fine pointers only.
- The ✕ Close button carries `Esc` and on a click re-locks the pointer when look mode is `lock`.

#### 3.3.3 Phone portrait (390×844)

Play:

```
+--------------------------------------+
|                                      |
|    +------ ENTERING ------+          |  banner: upper third
|    |       עזרת ישראל       |          |
|    |  Ezrat Yisrael More ›  |          |
|    +----------------------+          |
|                                      |
|  The Levites sing… שיר המעלות          |  captions
| Walking to the Mizbeach · 84 m ~9 s  |  travel bar: 2 rows
| [½× 1× 2× 5× 10×] [Run] [Skip] [Stop]|
|                 [◔ hour 4 · ≈08:39] |  wake chips (4 s), right-aligned
|                 [▦ Map]  [⌕ Search] |  above the beacon
|  (joystick zone) +-----------------+ |
|                  |(◉) עזרת הנשים    | |  BEACON bottom-right,
|                  |  Ezrat Nashim  ☰ | |  44–56 px tall, ≤ 220 px wide
+--------------------------------------+
```

Menu home (peek detent; drag up for full):

```
+--------------------------------------+
|  world visible above (44 %)          |
+===============  ═══  ================+
| +------+ עזרת הנשים         [Close] |
| | ·◉>  | Ezrat Nashim                 |
| |  ◆   | ▮▮▮▮▯▯▯ About this place ›   |
| +------+ ◔ hour 4 · ≈08:39 [❚❚] [10×]|  minimap disc 72 px
| [⌕ Search places, rites, people…    ]|
| +--------+--------+--------+-------+ |
| |   ⌂    |   ✦    |   ▦    |   ◔   | |  tiles 4×2, ≥ 84×64 px each,
| |  Here  |Happen- |  Map   | Time  | |  icon + label + micro-text
| |        |ing · 7 |        |hour 4 | |
| +--------+--------+--------+-------+ |
| |   ❡    |   ♪    |   ⚙    |   ?   | |
| | Learn  | Listen |Settings| Help  | |
| +--------+--------+--------+-------+ |
| HAPPENING HERE · 2          All ›    |
| ◆◆ The Levites' song · now           |
|    [Go ▸]  [Show me ▸]               |
| [✈ Fly]  [♪ Sound on]                |  header actions move here on phones
+--------------------------------------+
```

A section (drill-down), for example Here, or a card from a tap on a person:

```
+--------------------------------------+
|  world (subject framed in this part) |
+===============  ═══  ================+
| [‹ Menu]   ⌂ Here               [✕] |
| (◉56) עזרת הנשים · Ezrat Nashim       |  compact header strip: ALWAYS present
|       ◔ hour 4 · ≈08:39  About ›     |
| ----------------------------------- |
| HAPPENING HERE · 2 …                 |
+--------------------------------------+
```

- The labels "Happening" (four columns at 390 px) and "Settings" fit at 14 px. Below 340 px wide the grid becomes
  2×4. Labels are never truncated or scrolled.
- The phone Map section: full screen; the compact header strip stays at the top. A "Places" chip opens the places list
  drawer. A labelled "Key" chip shows the legend. The selection card is a bottom sheet with its own detents.

#### 3.3.4 Phone landscape (844×390)

```
+-------------------------------------------------------------------------------+
|                                        | +----+ עזרת הנשים · Ezrat Nashim [Close]|
|   world (free area, 362 px wide)        | |◉56 | ◔ hour 4 · ≈08:39  About ›       |
|                                        | +----+ [⌕ Search…                    ]   |
|   banner / captions centred here        | [ ⌂ Here ][ ✦ Happening·7 ][ ▦ Map ][ ◔ Time ] |
|                                        | [ ❡ Learn ][ ♪ Listen ][ ⚙ Settings ][ ? Help ]|
|   joystick (left 45 %) still works      | HAPPENING HERE · 2 …                    |
|                          beacon hidden  | (scrolls)                               |
+-------------------------------------------------------------------------------+
```

The right sheet is `min(480px, 58vw)`. The header is one row of 64 px. The tiles are 4×2 at 40 px tall, with icon and
label on one line. Below the tiles, the home shows "Happening here".

#### 3.3.5 Search results (desktop dock; the phone is the same in the full detent)

```
[⌕ mizbe                                                    ✕ ]
[ All ] [ Places ] [ Rites ] [ People ] [ Things ] [ Words ] [ Settings ]   <- scope chips (counts)
PLACES
  ▦ המזבח · The Mizbeach (altar)            Azarah        [Go ▸]
THINGS
  ◇ כיור · The kiyor (laver)  "…beside the Mizbeach"      [Show me ▸]
RITES — happening now
  ✦ Blood on the altar: four horns…  now · 6 min left    [Go ▸] [Show me ▸]
WORDS
  ❡ מזבח · mizbeach — the altar of burnt-offering
COMMANDS
  ⚙ Pause the clock                                   P
↑↓ choose · Enter open · Ctrl+Enter Go · Esc clear
```

Before you type, the empty state shows:

- **Near you now** (3 events);
- **Recent** (your last 8 searches, stored on this device);
- **Try:** `מזבח · altar · Nikanor · tamid · subtitles`.

#### 3.3.6 Cards

Person card (dock content, or the phone peek sheet):

```
PERSON · כהן                                            [pin] [✕]
Kohen — one of the kohanim at the slaughter (morning crew)
NOW   Slaughtering the morning tamid  ━━━━━━━━░░░  ≈4 min left
WHY   The tamid is slaughtered at the north side, at the rings… (Tamid 4:1)  more ›
WHO   A kohen hedyot serves barefoot in four white linen garments… (Yoma 7:5)  more ›
HOLDING  knife (סכין)
ORDER SOURCED · minutes reconstructed            SOURCES 4 ›
[▸ Watch now] [▸ From the start ≈08:12] [◎ Follow] [Go closer ▸] [Map] [Learn: Kohen ›]
```

Object card:

```
OBJECT · כיור                                             [pin] [✕]
The kiyor (laver) — between the Ulam and the Mizbeach
WHAT IT IS FOR   Kohanim sanctify hands and feet from it before the service… (Shemot 30:18–21; Tamid 1:4)
MEASURES  —  (no sourced dimensions)          CONFIDENCE  reconstruction ⓘ
IN ACTION  • The kiyor is lowered into the well (≈ 21:40)  • Hands and feet sanctified (now)
SOURCES 3 ›
[▸ Show me: hands and feet sanctified (now)] [Go ▸ Walk·1×] [Map] [Learn ›]
```

Place, event, offering, term and role cards share the skeleton:

- a **type chip**;
- the **title** (he large, en, transliteration);
- **NOW**: a live line, updated at 4 Hz, with progress;
- **WHY / WHAT FOR**: the lead sentence plus "more ›";
- sections for the type, collapsed after the first;
- **SOURCES n ›**;
- the **confidence badge**;
- the **action row**.

#### 3.3.7 Go control and the Show-me bar

```
[ Go ▸  |  Walk · 2× ▾ ]
          ▾  How:   (•) Walk   ( ) Run   ( ) Instant
             Pace:  [½×] [1×] [2×] [5×] [10×]      (disabled for Instant)
             These become your defaults.
```

```
+-- Showing the slaughter of the morning tamid ---------------------------------------------+
|  Skipping ahead 14 min  ━━━━━━━━━━━━━░░░░░░  ≈08:26 → 08:40     [Skip ⇥] [Cancel ✕]       |
+-------------------------------------------------------------------------------------------+
  after arrival:  [ Showing: Slaughter of the morning tamid · ↶ Back to 08:39 at Ezrat Nashim ]
```

### 3.4 The header: exact contents (every Menu view)

1. **Minimap disc**: 120 px (dock), 72 px (phone home), 56 px (compact strip), 40 px (beacon). Contents:
   - The plan raster from `src/ui/map/plan.js`, north-up. The current zone is outlined in gold.
   - The **glowing dot** at the centre: a gold 8 px dot plus a separate 28 px radial-gradient halo whose opacity
     pulses 0.5 ↔ 1 every 2.4 s; static with reduced motion.
   - A **heading cone**, rotated by transform.
   - The rim carries an N tick and a **gold diamond toward the Kodesh HaKodashim**. This replaces the compass strip
     and gives phones orientation back.
   - **Activity dots** for active events within the radius (refreshed at 2 Hz).
   - The **route line** during a trip.
   - A **storey badge** (UPPER / BELOW / ROOF) on another level.
   - Radius by area: the Mount and outside 140 m; the courts 60 m; inner rooms 30 m. Changes ease over 400 ms.
   - Click: Map section centred on you. On the Map section the disc becomes the **overview**: the whole Mount with the
     viewport rectangle.
2. **Location block:**
   - Hebrew name (Frank Ruhl, large) and English name.
   - The rung bars plus "Sanctity of X", red-gold at rung ≥ 7.
   - A storey tag.
   - **About this place ›** opens Here; if Here is already open, it scrolls to About.
3. **Clock block:**
   - The mini seasonal dial, "Day · hour 4 of 12", "≈ 08:39".
   - **[❚❚ P]** play/pause.
   - **[10× ▾]**, a speed menu (1× 10× 60× 600×).
   - A click on the block opens Time.
   - While a Show-me "Back" is available, a **[↶ Back]** chip sits here.
4. **Search field:**
   - Placeholder "Search places, rites, people, things…", key cap `/`, `dir="auto"`.
   - It searches everything (C's engine), with a scope that follows the section: Places on Map, Settings on Settings.
5. **Actions, all labelled:**
   - [✈ Fly] / [⇣ Walk] toggle (its label names what it will do);
   - [♪ Sound on/off];
   - [✕ Close Esc].
   - On phones, Fly and Sound move under the tiles on the home screen, and into Settings and Listen.
6. **Module status chip:** one slot, empty by default, for example "▶ Narrating · Stop" (§5).

### 3.5 Sections and the full information architecture

| # | Section | Contents | Replaces |
|---|---|---|---|
| 10 | ⌂ **Here** | The **place card** for `zones.current`. It follows you unless pinned. Order: Happening here (≤ 3, then "All in Happening ›"); **Things here** (element chips, `ctx.inspect.thingsIn`); **Nearby** (subjects within 15 m with bearing words, `ctx.inspect.nearby`); Who may enter (lead + more); What is done here; About; Sources (count chip); "Also here" storeys; [Go to this place's stand] | Info panel, the location-card click, the ⓘ tool, the map card's About |
| 20 | ✦ **Happening** | Filter: **Everywhere · Here · Near me (≤ 60 m)** plus an Aggadah chip when that layer is on. "Now", grouped by area with counts. Dynamic offering groups collapse to "7 individual offerings at the rings · **Show me one ▸**" and expand to instance rows. "Next" (6). Every row is the single **event row** | The Time panel lists; the floating-tag destination; the map's "Happening now" group; Info's "Happening here" |
| 30 | ▦ **Map** | The existing map code (plan, labels, view, presets, zoom, scale bar, live fills and markers, route line, double-click/Enter = Go). The places list becomes a browse list with **no input**; the header search filters it with the Places scope. Legend → a labelled **Key** toggle, visible on phones. The phone's initial view is fitted (no empty top band). The selection uses the shared card plus the map extras ("This spot", "No floor to stand on here") | The Map modal |
| 40 | ◔ **Time** | The dial (arcs and handle; keys unchanged), transport (−1 seasonal hour, ❚❚, +1; 1× 10× 60× 600×), the date row, the zman buttons, "How the hours are counted" (the **single home** of that explanation). An arc click or Enter → the **event card** under the dial (Go, Show me, "Set clock to start") | The Time panel without its lists |
| 50 | ❡ **Learn** | The codex, with sections: Places · Rites & events (today, and other day types read-only) · People (roles) · Things (objects with content) · Offerings (`OFFERING_TYPES`) · **Words** (the 347 glossary terms, A–Z and א–ת) · How to read (badges, the **sanctity ladder** in full, a link to Time's hours) · Method · Where the sources differ (12) · The amah · Credits & licences. Every entry is a card (`describe(ref)`) | About; the unused glossary; Info's sources |
| 60 | ♪ **Listen** | Volume; Sound on/off; **Subtitles**; Music style; **Recent captions** (the last 50, each with ≈time and source, tap = replay text); the module slot "Narration" (only when a module registers) | Settings → Sound |
| 70 | ⚙ **Settings** | **Travel**: default way and pace. **Look & move**: look mode lock/drag, sensitivity, invert, FOV, head bob. **Display**: quick chips (on wake / always), area names (always / when travelling / off), restricted-area notices, activity markers, aggadah layer, reduce motion. **Graphics**: quality (reloads). **Measure**: amah (reloads). A link: "Sound & subtitles are in Listen ›". After a reload, the Menu reopens at Settings | The Settings modal |
| 80 | ? **Help** | **The essentials** (3 lines). **Your controls**: the detected device, with a switcher Mouse & keyboard / Touch / Gamepad / Screen reader (from `controls.js`, still the single source, which also feeds README). Replay the welcome. What the symbols mean (links into Learn). What's new (a dot when the build changes) | The hint bar, the ghost hints, About → Controls, the intro rows, `?` |

The default section when opening: the last one used this session; in a new session, **Here**. Opening from a chip,
a key or a card goes to that section.

**The single event row**, used everywhere events are listed:

- the importance diamonds, the title, the Hebrew;
- the place, "now · 12 min left" or "in 14 min", and a progress bar;
- **exactly two buttons: [Go ▸] and [Show me ▸]**.

A click on the row opens the event card. The per-row `<select>` and "Start" are removed.

#### 3.5.1 Every audited surface → its new home

| Audit surface | New home | Removed |
|---|---|---|
| Intro card | **Welcome** (§3.9) | "M plan" typo; the hard-coded key list |
| HUD location card | Beacon plus header | The card |
| HUD clock chip | Wake chip plus header clock block plus the beacon speed badge | The chip |
| Tool column (4 icon-only buttons) | Sections | **Removed** |
| Compass strip | The minimap rim (N tick plus KhK diamond), also on phones | **Removed** |
| Desktop hint bar | Key caps on controls; Help | **Removed** |
| Touch ghost hints | Shown once, in the first touch session (Welcome) | Repeats |
| Floating tags | **Activity markers** (§3.6). A click opens the event card (not Time) | Stacking behind walls |
| Time panel | Time (control) + Happening (lists) | Row selects; Start |
| Info panel | Here | The panel |
| Map modal | Map section | The map-local search input; the hidden phone legend |
| Settings modal | Settings + Listen | — |
| About | Learn (+ Help for Controls) | Its repeat of the seasonal-hour explanation |
| Toasts | Notices (errors and confirmations only). "Arrived" → the ARRIVED banner. The access notice → the restricted banner. "Clock set" → the Show-me chip | Toasts that carry information |
| Captions | Unchanged lane; log in Listen | — |
| Travel pill + map travel pill | One travel bar | Two pills |
| Fade veil | Kept | — |
| Touch joystick, look pill, Run flash | Kept (player-owned). The look pill shows in the first session only | — |
| Debug overlays, URL params, `shot=1`, `ui=0` | Unchanged | — |
| 9 Go entry points, 5 speed widgets | One Go control (§3.3.7) + map double-click/Enter (defaults) | 4 widgets |

#### 3.5.2 Every path to information → one canonical home

| Information | Home | Doors |
|---|---|---|
| Where am I / about this place | Place card (Here) | Beacon, header link, banner, minimap, map, search, pick on the floor |
| Happening now and next | Happening | Here (3), minimap dots, map, markers, search |
| Event detail and sources | Event card | Any event row, arc, marker, search |
| A person / animal / object | Its card | Pick, Nearby, Things here, search, Learn |
| Seasonal hours | Time → How the hours are counted | Learn → How to read links to it |
| Sanctity ladder | Learn → How to read | Rung bars everywhere (one line each) |
| Controls | Help | Key caps on controls, the Welcome |
| Sources, method, credits | Learn, plus per-card Sources | — |
| Travel | The Go control | Every card, row and search result |
| Time control | Time + the header clock block | — |
| Sound and captions | Listen | The header Sound toggle |

### 3.6 Activity markers (replace the floating tags; owned by A)

- At most **3** markers, for active events whose anchor has a **line of sight**. The check is one
  `ctx.physics.raycast` per candidate at 2 Hz, and the anchor must be within 80 m.
- Beyond 25 m a marker is a 10 px gold diamond with no text. Its label appears within 25 m, or on hover, on the reticle,
  or on keyboard focus.
- Hidden while the Menu is full-screen. Never more than one label in the centre 40 % of the screen; the others become
  diamonds.
- A click or tap opens the **event card**.
- The `labels` setting key is kept and renamed in the UI to "Activity markers".

### 3.7 Notices, captions, audio

- **Notices** (`ctx.ui.toast` kept as an alias): max 2, top centre of the free area, 3.2 s. Used only for errors
  ("No viewing place is given for this event"), "Reloading…" and "Welcome back · Esc opens the menu".
- **Captions:**
  - Bus `'caption'` `{ text:{en,he}|string, duration, id?, source?: 'audio'|'sim'|'narration' }`.
  - Shown only when Subtitles is on, max 2. Held while a Show-me warp runs (§4.2).
  - Every caption goes to the Listen log, even with Subtitles off.
  - Subtitles **no longer** silences the restricted-area notice; that has its own setting.

### 3.8 Visual and motion language

**Tokens.** Keep the existing ones:

- gold `#d4a640 / #f2d38a / #8d6c2a`;
- ink `#f1e8d4 / #cdbf9f / #978b74`;
- warm glass and a 1 px gold hairline;
- fonts: Cormorant Garamond (titles), EB Garamond (body, 16 px desktop and 15 px phone minimum), Frank Ruhl Libre
  (Hebrew, `unicode-bidi: isolate`).

**Icons.** 20 px line icons, stroke 1.5, inline SVG in `src/ui/console/icons.js`. Always paired with a label.

**Hit targets.** ≥ 36 px on a fine pointer; ≥ 44 px on a coarse pointer.

**Glass.**

- Low and medium: 97 % opaque warm glass.
- High and ultra: backdrop blur on the Menu panel only.
- There is no full-screen scrim in dock layout.
- Phone full detents dim the strip above at rgba(10,7,4,.45). That is an opacity transition, not a filter.

**Motion** (transform and opacity only; durations from `--mk-dur-*`):

| Element | Motion | ms |
|---|---|---|
| Beacon wake | The chips fade in and translateY(6px) to 0, staggered 30 ms. The pulse ring is a `::after` going scale 1 → 1.6, opacity .8 → 0 | 160 / 700 |
| Menu dock open / close | translateX(16px) to 0 plus opacity | 180 / 140 |
| Sheet detents | translateY with a spring-like cubic-bezier; follows the finger | 220 |
| Section switch | Content crossfade. The rail indicator slides by translateY; the tile pressed scales .96 | 120 |
| Card push | translateX(12px) plus opacity | 160 |
| Area banner | In: opacity plus 6 px rise, then the gold rule draws in by scaleX 0 → 1. Out: opacity | 300 / 240 |
| Minimap halo | Opacity pulse on its own small element | 2400 loop |
| Pick ring | DOM ellipse at the subject's feet, positioned by transform at 30 Hz while a card is open | — |
| Show-me | A sundial glyph (SVG) spins under the veil, by transform | — |

With reduced motion (the setting or the OS): opacity only, 120 ms; no pulses (a static halo); no spin. The ≥ 5×
travel vignette stays, because it reduces motion sickness.

### 3.9 First run and returning users

**First run.** Shown when `localStorage mikdash.seen` is missing. The Menu opens in the **Welcome** state: a docked
panel on desktop (the world visible beside it), the full sheet on phones. It contains:

- מקדש / Mikdash;
- the live framing sentence (clock and place, as today) and the Hebrew date;
- **three device-specific lines**:
  - Mouse & keyboard: "WASD to walk, mouse to look". "Esc or the Menu button (top-left): everything else". "Click
    anyone or anything to learn about it".
  - Touch: "Left thumb walks, right thumb looks". "The Menu button (bottom-right): everything else". "Tap anyone or
    anything".
  - Gamepad: "Sticks to walk and look". "☰ Menu: everything else". "X: learn about what you face".
- **[Enter the courts]**: unlocks audio and requests pointer lock, as today.
- "How this was reconstructed ›", which goes to Learn → Method.

Then up to **three coach marks**, one at a time. Each dismisses on its action or after 8 s and is stored in
`mikdash.coach`:

1. on the beacon: "Your Menu: where you are, the map, the hour and everything else";
2. near the screen centre: "Click (or tap) anyone or anything to learn what it is";
3. on the beacon disc: "The gold dot is you".

The touch joystick and look ghosts show during the first touch session only.

**Returning users.** `mikdash.seen` holds the build version, and the Welcome is skipped. The notice "Welcome back · Esc
opens the menu" (the device's own key) shows in the first 3 returning sessions. If the version changed, Help shows a
"What's new" dot, and the beacon shows a small dot once.

**Settings reload.** As today, `sessionStorage mikdash.resume` resumes position, look and time, and the Menu reopens at
Settings.

### 3.10 Accessibility

**Structure.**

- **Beacon:** a `<button>`, the first focusable element, with `aria-label="Menu — Ezrat Nashim, sanctity of Ezrat
  Nashim"` and `aria-keyshortcuts="Escape"`.
- **Menu:**
  - dock: `role="dialog" aria-modal="false"` labelled "Menu";
  - phone full detent: `aria-modal="true"` with a focus trap;
  - focus returns to the invoker on close.
- **Rail:** `role="tablist" aria-orientation="vertical"` with a roving tabindex, ↑↓ between tabs, Home/End,
  `aria-keyshortcuts` per tab. Panels are `role="tabpanel"`.
- **Phone tiles:** a `<ul>` of buttons. The drill-down sets the title as a heading and moves focus to it.
- **Search:** a combobox plus listbox (the pattern from `places.js`), with an `aria-live` count ("12 results, 3
  places").

**Live regions.** All polite: area banner text; travel start ("Walking to the Mizbeach, 84 metres") and arrival;
Show-me phases ("Clock set to about 10:12, showing the slaughter of the tamid"); captions (existing). The reticle
prompt is **not** live; E announces it on demand.

**Non-pointing inspection.**

- **Nearby** (Here) lists subjects with bearing words ("ahead-left, 6 m").
- **Things here** lists the elements in the zone.
- The command **"What's ahead?"** (in search, and E with a screen reader) announces `pickCenter`.

**Visual.**

- `forced-colors` and `:focus-visible` are kept. The gamepad focus ring is 3 px gold.
- Contrast: ink on glass AA or better; gold text ≥ 18 px only.
- The map stage stays `role="application"`; the dial stays `role="slider"`.
- The UI must stay usable with the 3D view at 1 fps (no logic depends on frames for input).

---------------------------------------------------------------------------------------------------------------------

## 4. Flows

### 4.1 Inspect a person, animal, object or place

1. **Point.**
   - Desktop, pointer free: on `mousemove` over the canvas, A calls `ctx.inspect.hover(x, y)`, which B throttles to
     10 Hz and caches. A hit sets `cursor: pointer`, a name tooltip ("Kohen · slaughtering") and the DOM ring.
   - Locked or gamepad: A calls `pickCenter()` at 5 Hz while the observer is not moving faster than walking. A hit
     shows the reticle prompt "[E] Inspect".
2. **Pick.**
   - Click, tap, E or X → `ctx.inspect.pick(x, y)`, or `pickCenter()`.
   - Candidates within the pixel tolerance → `hit.alternatives`. A shows a **chooser** ("3 here: Kohen, receiving the
     blood · Kohen, slaughtering · Lamb").
   - `null` → on touch, wake the beacon; on mouse, nothing (or lock, per §2.2).
3. **Card.** A calls `ctx.inspect.describe(hit)` and pushes a card view.
   - The Menu opens at the card: dock content, or the phone peek sheet.
   - A sets the view inset. If the subject is outside the free area, A calls `ctx.inspect.frame(hit)`, a 400 ms ease.
   - The card's **NOW** line re-describes at 4 Hz (`describe(hit, t).now` only).
   - If the subject is culled or out of range, NOW reads "Out of sight". Show me still works through the event.
4. **Card contents per kind** (all produced by B, §6.2):

   | Kind | Contents |
   |---|---|
   | person | Role name (he, en), the pool's phrase ("one of the kohanim at the slaughter"), NOW (doing + progress), WHY, WHO (role and attire, sourced), HOLDING (props with names), confidence, sources |
   | animal | Kind, NOW ("being led to the rings for an olah"), WHY (the offering it is for), sources |
   | crowd | The group phrase ("Israelites of the ma'amad"), NOW, WHY |
   | object | Name, WHAT IT IS FOR (sourced purpose, or none), measures (amot and m, with confidence), IN ACTION (event list with times), sources |
   | place | See Here (§3.5) |
   | event | Window, progress, summary, description, Who (participants), Timing (confidence + note), Sources. Dynamic groups list instances |
   | offering | Names, category, who brings it, the steps (each with its station: tap = place card), today's frequency, sources |
   | term | Hebrew, transliteration, definition, aka, sources, "Seen in" (places, events, objects that cite it) |
   | role | The role's who and attire, and where they are now (the Happening entries with participants of that role) |

5. **Actions** (always in this order, only those that apply): **See in action** (1–2 variants), **Follow**, **Go**,
   **Map**, **Learn**, then module actions (for example "Listen ▸").

**See in action: behaviour (B's director; A renders the bar).**

**Choosing the moment.** B returns it in each `see-in-action` action, as `t`, `date` and `mode`:

| Situation | Mode | Label |
|---|---|---|
| The subject's step is in progress now | `now` | "▸ Watch now (≈4 min left)" |
| In progress, and the user may want the start | `jump` (rewind) | Secondary: "▸ From the start (≈08:12)" |
| Starts later today, gap ≤ 20 sim min | `warp` | "▸ Skip ahead 14 min" |
| Starts later today, gap > 20 sim min | `jump` | "▸ Skip to ≈10:12 (in 1 h 33)" |
| Already over today | `jump` (rewind) | Primary: "▸ Rewind to ≈07:43". Secondary when it recurs: "▸ Tomorrow, ≈07:40" (`date` = tomorrow) |
| A dynamic offering instance that is over | — | "▸ Show me another olah (≈ in 6 min)", the next instance of that type, else the earliest today |

The label always says what will happen.

**Steps:**

1. **Return snapshot:** `{ date, t, speed, paused, feet, heading, pitch, mode }`. An active trip is cancelled; when one
   is running, the card says "This stops your walk".
2. **Place.** If the observer is more than 20 m from the moment's view point, or has no line of sight to the subject's
   position at the target time:
   - veil (`ctx.ui.fade(1, 220)`);
   - `ctx.player.teleport(view, { fade: false })`, where the view is `schedule.viewOf(ev)`, a step view, or B's
     computed stand.
3. **Time:**
   - `now`: no change. If the clock is paused it plays; the speed becomes 1×.
   - `warp`:
     - `setSpeed(v)` with `v = clamp(gap·60/4, 10, 600)`, so the warp takes about 4 s of real time.
     - Over the last 0.5 sim min the speed eases toward 1×. The warp ends at `t_target − 0.1`, then plays at 1×.
     - During the warp, the master audio dips to 25 % via `ctx.audio.setMaster`, and is restored at the end.
       `inspect.show.phase === 'warping'` tells A to hold captions.
   - `jump`:
     - Under the veil: `setDate(date)` if it differs. With a new date, the director **waits for the plan job**
       (`ctx.schedule.runtime.plans.done`, capped at 8 s) and shows "Preparing that day's service…" on the veil.
     - Then `time.set(t_target − 0.1)`, `pause(false)`, `setSpeed(1)`.
     - Landing 6 s before the moment means the event's own cues (never in `[t0, t0+0.5)`, lib/cue.js) fire in
       continuous play.
4. **Frame:**
   - Resolve the subject after the time change: `subjectKey` → choreo `locate()` → its slot or position. Fallback: the
     event `pos`.
   - `ctx.player.setLook()` puts the subject at the centre of the free area (the view inset); pitch toward chest height,
     clamped −25° … +10°.
   - Lift the veil.
5. **Follow** (when the action has `follow: true`, or after a click on [◎ Follow]):
   - Each frame (B, at `PRIORITY.player − 1`) turns the view toward the subject at up to 90°/s.
   - It stops on any `look` or `move` intent (bus `player:intent`), when the subject cannot be located, or after 3 min.
6. **Show-me bar (A):**
   - Label, mode text ("Skipping ahead 14 min" / "Rewinding to ≈07:43" / "Tomorrow, ≈07:40"), progress (sim time
     during a warp; indeterminate during a jump), [Skip ⇥] (warp → jump now), [Cancel] (restore the snapshot).
   - After `showing`, a chip: "Showing: X · ↶ Back to 08:39 at Ezrat Nashim" for 30 s, then the **[↶ Back]** chip in
     the header clock block and the beacon wake row. That chip lasts until the next trip or show, or for 10 min.
   - **Back** restores the snapshot under the veil.

### 4.2 Cue and caption gate during a warp

During `warping`, A holds incoming captions. It keeps the last one and logs all of them. Audio is dipped by the
director, so cue bursts are not jarring. At 1× after the warp, everything behaves normally. No sim or audio changes
are needed.

### 4.3 Travel

- **Way:** Walk (1.4 m/s) | Run (4.5 m/s) | Instant (a veiled teleport).
- **Pace:** ½× | 1× | 2× | 5× | 10×; not used for Instant.
- At 10×, Walk is 14 m/s and Run is 45 m/s. The pace is a **sub-stepped multiplier of the walker and the controller**
  (C, §6.3). It is not a higher m/s, so collision, stairs and nav corners stay stable. The sim clock is unaffected.
- **Settings:** `travelWay` (default `walk`) and `travelPace` (default 1). Any change in a Go menu or the travel bar
  writes them (they are sticky, as today).
- **Migration of `travelSpeed`:** instant → instant; slow → walk ½×; walk → walk 1×; fast → walk 2×; run → run 1×.
- **Start.** Any [Go ▸] calls `ctx.player.goTo(target, { way, pace, label })`.
  - The Menu stays open in dock layout, and collapses to its compact header strip on phones so the walk is visible.
  - The travel bar appears.
  - The minimap and Map draw the route.
  - A polite live region announces "Walking to the Mizbeach, 84 metres".
- **During.**
  - **Pace:** the bar's buttons, + / − (when the Map stage is not focused), or pad D-pad ← →.
  - **Way:** the [Walk | Run] toggle.
  - **Look around freely** with mouse, trackpad, touch look or the right stick. The view eases back to the walker's
    look-ahead 2.5 s after the last look input.
  - **[Skip ⇥]** = `ctx.player.finishTrip()` (a veiled teleport to the target).
  - **[■ Stop]** = `cancel()`.
  - **Movement input stops the trip:** WASD, arrows (focus in the world), the joystick, the left stick, F, or pad B
    when walking.
- **Comfort at ≥ 5×.** Head bob is off for the trip. A static CSS radial vignette fades in by opacity. There is no FOV
  change and no filter.
- **Arrival.** The **ARRIVED** banner shows the destination place or "In place to watch: X". For an event that is not
  active yet, it adds [Show me ▸] (warp or jump to its start). Arrival is announced politely.
- **Instant** shows the ARRIVED banner only.

### 4.4 Search

**Where.** The header field on every Menu view. Opened from the world by `/`, by Ctrl/⌘+K, or by the Search chip.

**Engine.** C's `src/search/` (§6.3). It is built in idle time after `firstFrame` and rebuilt on `time:date`, plus
live providers. It indexes:

- places (zones);
- things (site elements plus `objects.js` aliases);
- rites (today's events, plus occasional events flagged as such);
- live **dynamic instances** ("Olah · at the slaughter · now");
- offering types;
- people roles (`people-info.js`);
- words (glossary);
- Learn sections;
- settings (with keywords: "subtitles", "captions", "volume", "mouse", "fov", "quality");
- Help topics;
- commands (registry: pause, play, speed 10×, fly, walk, subtitles on/off, replay welcome, what's ahead);
- module sources.

**Matching.**

- Hebrew:
  - niqqud and cantillation stripped;
  - final letters folded;
  - geresh, gershayim and maqaf normalised;
  - prefixes ה/ו/ב/ל/מ/ש tried as variants;
  - a matres-lectionis-free skeleton (י/ו dropped) as a lower tier.
- Transliteration:
  - folds ch/kh/h, tz/ts/z, k/q/c/ck, ph/f, w/v, th/t, doubled letters, ei/ai/ay/ey;
  - the Ashkenazi s↔t variant (Shabbos, Beis, ezras);
  - a vowel-free consonant skeleton as a lower tier, which covers kodoshim/kodashim and Mizbeach/Mizbe'ach.
- English: case, diacritics, apostrophes, an optional leading "the"/"ha".
- **Wrong keyboard layout:** each query is also tried through the Israeli SI-1452 map in both directions, so `nzcj` →
  מזבח and `שךאש` → `altar`.

**Ranking.** Exact > prefix > token prefix > substring > skeleton > Damerau-1 (tokens ≥ 4 chars), weighted by kind.

- The section's scope gets a ×1.5 boost.
- Active events ×1.3; the current zone and nearby things ×1.2.
- Recent selections ×1.1.

**Results.** Grouped by kind, max 6 per group in "All" (a "more" row expands). Scope chips with counts.

| Kind | Row | Enter | Ctrl/⌘+Enter | Secondary button |
|---|---|---|---|---|
| Place | ▦ name he · en · parent area | Place card | Go | [Go ▸] |
| Thing | ◇ name · area | Object card | Go | [Show me ▸] if it has an in-action entry, else [Go ▸] |
| Rite / dynamic | ✦ title · place · now / in | Event card | Go | [Go ▸] [Show me ▸] |
| Offering type | ⟡ name · category | Offering card | — | [Show me one ▸] |
| Role | ☺ name | Role card | — | — |
| Word | ❡ he · translit · definition (1 line) | Term card | — | — |
| Setting | ⚙ label · current value | Settings at that control | — | Inline toggle or value |
| Help / Learn | ? title | That topic | — | — |
| Command | ⌘ title · key cap | Runs it | — | — |

**Behaviour.**

- ↑↓ move, Enter opens, Ctrl/⌘+Enter goes. Esc clears the field, then a second Esc goes back.
- Hebrew IME: A queries on `input`, and only after `compositionend`. Debounce 60 ms.
- On phones the sheet goes to the full detent while the keyboard is up.

### 4.5 Area-entry banner

**When.**

- **During a trip** (way walk or run): C emits `travel:zone` when the walker's path distance crosses into the next zone
  of its pre-computed route zones. These are exact and never flicker, because C merges runs shorter than 1 m.
  - The banner shows at once.
  - If the next zone arrives less than 1.5 s later (common at 5× and 10×), the title swaps in place without
    re-animating, and the previous name moves into a breadcrumb "via A · B" (max 3, newest last).
  - The final zone gives **ARRIVED**.
- **Instant travel:** ARRIVED only.
- **On foot** (no trip):
  - From `zone:change` (sim, 5 Hz), after a **dwell of 0.8 s** in the new zone.
  - The same zone is not shown again within **60 s**.
  - Banners are at least **2 s** apart; a newer one replaces an older one.
  - None while the Welcome is open.
  - While a phone sheet is at the full detent, the banner is held: only the latest is kept, and it is shown on
    close if you are still there.
- **Setting `areaNames`:** `always` (default) | `travel` | `off`. Restricted notices have their own setting,
  `restrictedNotices` (default on). It applies even with `areaNames` off.

**Content.**

- The kicker: **ENTERING** / **ARRIVED**, plus a storey tag when aloft or below.
- The Hebrew name, 44 px desktop and 34 px phone. The English name. The rung bars.
- **More ›** with key cap `I`.
- **Restricted variant** (rung ≥ 7, entered from a lower rung):
  - a red-gold rule;
  - the access lead (`accessLead`) and its Kelim source;
  - "You see it here as an observer" at rung ≥ 9.
  - It lasts 4.2 s, versus 3.2 s for an ordinary banner.
  - It replaces the access-notice toast (same 90 s per-zone rule).

**Interaction.**

- Click or tap → the Menu at the **place card of that zone**, pinned, with the line "You passed through here at
  ≈08:41" when that is no longer where you are.
- `I` opens Here (which is the same zone when you are still in it).
- Hover or focus pauses the dismissal.
- Announced politely: "Entering Ezrat Yisrael, sanctity of Ezrat Yisrael".

### 4.6 Captions, narration and audio

- The captions lane and the Listen log are described in §3.7. Each caption carries a `source` so narration lines can
  be styled (italic) and filtered in the log.
- **Listen** is the default mount for audio modules. The **narration contract** is reserved; no module ships in this
  round:

  ```js
  ctx.narration = {
    available(subject) -> boolean,                 // e.g. { kind:'place', id } or a card subject
    play(subject | script, { lang:'en'|'he' }) -> Promise<void>,
    stop(), pause(), resume(),
    state: 'idle'|'playing'|'paused',
    on(fn) -> off,                                 // fn({ state, subject, progress })
  };
  ```

  Narration text goes out on bus `'caption'` with `source:'narration'`. The ambience ducks through
  `ctx.audio.ambience.hush()/release()`. Headphone play/pause maps through the Media Session API.
- **Tours** are sequences of director steps (`ctx.inspect.run`, §6.2): `go`, `time`, `frame`, `say`, `wait`,
  `follow`. A tour module needs no new mechanics.

---------------------------------------------------------------------------------------------------------------------

## 5. Module registry (future features: narration, audio guide, tours…)

Owned by A (`src/ui/console/modules.js`), exposed as `ctx.ui.modules`. **All eight built-in sections register through
it**, so the API is exercised from day one.

```js
const off = ctx.ui.modules.register({
  id: 'narration',                                   // unique, /^[a-z][a-z0-9-]*$/
  title: { en: 'Narration', he: 'קריינות' },

  // A Menu section (a rail item on desktop, a tile on phones). Optional.
  section: {
    id: 'narration', label: { en: 'Narrate', he: 'קריינות' }, icon: 'voice' /* icons.js id, or an SVG string */,
    order: 55,                                       // built-ins: here 10, happening 20, map 30, time 40, learn 50,
                                                     // listen 60, settings 70, help 80. 9+ sections: phone grid 4×3
    key: null,                                       // optional world accelerator (KeyboardEvent.code); printed if set
    badge: (ctx) => '2 stops' | null,                // live micro-text, read ≤ 2 Hz while the Menu is open
    fullDetent: false,                               // phone: open at the full detent
    mount(el, api) { return { show(opts) {}, hide() {}, update() {}, dispose() {} }; },
  },

  // A block inside Listen (the default home for audio modules). Optional.
  listen: { order: 10, mount(el, api) { return { update() {}, dispose() {} }; } },

  // Card extensions: given the card data (§6.2 Card), return extra actions / sections. Optional.
  cardActions: (card, api) => [{ id: 'listen', label: { en: 'Listen' }, icon: 'play', run: () => api.ctx.narration.play(card.ref) }],
  cardSections: (card, api) => [{ id: 'script', title: { en: 'Narration' }, mount(el) {} }],

  // Search: documents (C's SearchDoc shape, §6.3) and commands. Optional.
  search: { kind: 'tour', label: { en: 'Tours' }, docs: (ctx) => SearchDoc[] },
  commands: [{ id: 'narration.stop', title: { en: 'Stop narration' }, keywords: ['quiet', 'stop'], run: (api) => {} }],

  // Settings (namespaced 'module.<id>.<key>' in localStorage; shown in their group). Optional.
  settings: [{ key: 'voice', group: 'listen', type: 'select', label: { en: 'Voice' },
               values: [['en', 'English'], ['he', 'עברית']], default: 'en' }],

  // Hooks. Optional.
  banner: (zoneId, api) => ({ action: { label: { en: 'Narrate' }, run() {} } }) | null,
  status: (ctx) => ({ label: { en: '▶ Narrating' }, action: { label: { en: 'Stop' }, run() {} } }) | null,  // one header chip
  on: { 'zone:change': (e, api) => {}, 'ui:card': (card, api) => {}, 'inspect:show': (e, api) => {}, 'travel:zone': (e, api) => {} },
});
// off() unregisters: removes the section, the actions, the docs and the settings UI (stored values are kept).
```

`api` (passed to every hook) is:

```js
{
  ctx,
  open(sectionId, opts),
  card(subjectRef),
  close(),
  caption(text, ms),
  notice(text, ms),
  settings: { get(key), set(key, v) },   // scoped to the module
  h,                                      // DOM helper
  t(obj),                                 // picks en/he
}
```

**Rules.**

- Modules load lazily, after `firstFrame`.
- A throwing hook is caught and logged once, and the module is disabled; it never breaks the Menu.
- Modules use only transform and opacity animations (the same perf rule).
- `ctx.settings.define(def)` (A, `settings.js`) is the API behind `settings:`.

---------------------------------------------------------------------------------------------------------------------

## 6. Build contracts

### 6.0 Shared conventions

**Units.** Site positions are `[X, Y, Z]` in amot (site frame); world positions are `THREE.Vector3` in metres; times
are sim minutes `t ∈ [0, 1440)` of `date` ('YYYY-MM-DD'); headings are compass degrees. Language objects are
`{ en, he? }`.

**Subject references.** These are stable strings, shared by all three engineers:

| Ref | Meaning |
|---|---|
| `zone:<zoneId>` | A place. A floor pick also carries `at` |
| `el:<siteElementId>` | An object (a site element) |
| `fire:<fxId>` | An altar or hearth fire (should; §6.2) |
| `actor:<choreoId>:<poolName>:<slotIndex>` | A pooled figure (person or animal) |
| `crowd:<choreoId>:<crowdIndex>` | An instanced crowd |
| `event:<eventId>` | A schedule event. Dynamic ids keep their own form, e.g. `event:offering:…`, `event:set:…` |
| `offering:<OFFERING_TYPES id>` | An offering type |
| `term:<glossary key>` | A word |
| `role:<people role>` | A role |
| `learn:<sectionId>` | A Learn section |
| `help:<topicId>` | A Help topic |
| `setting:<key>` | A setting |
| `cmd:<id>` | A command |

`ref` objects are `{ kind, id }`, where `id` is the part after the colon.

**New bus events.** Names are exact.

| Event | Payload | Emitter | Rate |
|---|---|---|---|
| `travel:start` | `{ id, label:{en}, way, pace, mps, distance, eta, to:[X,Y,Z], zones:[{zone, s0, s1}] }` | C | Once |
| `travel:progress` | `{ id, s, total, remaining, eta, pace, effectivePace }` | C | ≤ 4 Hz |
| `travel:pace` | `{ id, pace, way }` | C | On change |
| `travel:zone` | `{ id, zone, prev, index, s, at:[X,Y,Z], final:boolean }` | C | Per zone crossed |
| `travel:end` | `{ id, ok, reason: 'arrived'\|'cancelled'\|'superseded'\|'failed'\|'skipped' }` | C | Once |
| `player:tap` | `{ x, y, pointerType }`: a tap or click on the canvas that did not lock, drag or look | C | — |
| `player:inspect` | `{ source: 'key'\|'click'\|'pad', x?, y? }`: E, a locked click (no x/y = centre) or pad X | C | — |
| `player:intent` | `{ kind: 'move'\|'look'\|'fly'\|'escape'\|'tap' }` | C | ≤ 4 Hz per kind |
| `inspect:show` | `{ id, phase, mode, progress?, label:{en} }` | B | Each phase; ≤ 4 Hz in a warp |
| `ui:card` | `{ ref, card }` | A | When a card opens |
| `ui:menu` | `{ open:boolean, section }` | A | — |

Existing events are unchanged: `zone:change`, `time:jump`, `time:date`, `player:arrived`, `settings:change`,
`caption`, `ui:goto` (still honoured by the player, without pace).

**Ownership for this round** (disjoint; each engineer edits only these):

| Engineer | Owns |
|---|---|
| **A, UI** | `src/ui/**` (incl. `settings.js`, `controls.js`, `styles.css`, the new `src/ui/console/**`, `src/ui/dev/**`), `README.md` (the controls section only), `docs/decisions/console-ui.md`, and the final merge of every section into `docs/API.md` |
| **B, Inspect** | `src/sim/inspect.js`, `src/sim/inspect-pick.js`, `src/sim/inspect-describe.js`, `src/sim/inspect-show.js`, `src/sim/index.js` (the install lines only), `src/sim/choreo/**` (adding the `describe`/`locate` exports and helpers only; no behaviour change), `src/sim/dev/tests/inspect*.js`, `src/people/pick.js`, `src/people/index.js` (one line exposing `ctx.people.pickShape`), `src/data/objects.js`, `src/data/people-info.js`, `docs/decisions/console-inspect.md` |
| **C, Travel & Search** | `src/player/**` (index, goto, input, controller as needed, a new `trip.js`), `src/search/**` (new), `docs/decisions/console-travel.md` |

Nobody edits `src/core/*`, `src/main.js`, `src/systems.js`, `index.html`, `tools/*`, the schedule data, the site data,
the zones content or the glossary. Every API below was designed so that none of those needs to change. **Each
engineer writes their API section in their decisions file under `## API`. A merges them into `docs/API.md` at
integration.** The orchestrator updates ARCHITECTURE §13/§14 from this file.

---

### 6.1 (A) UI console: `src/ui/**`

**Files** (new unless marked):

```
src/ui/app.js                  REWRITE: shell; mounts the console; keyboard / pointer-lock rules (§2); ticker
src/ui/console/console.js      state, view stack (section | card | search | welcome), layout (dock/sheet), history entries
src/ui/console/layout.js       breakpoints, free-area CSS vars, setViewInset, sheet detents and drag
src/ui/console/header.js       minimap block, location block, clock block, search field, actions, module status chip
src/ui/console/minimap.js      shared plan raster (map/plan.js) per level; 4 sizes; dot + halo + cone + rim + dots + route
src/ui/console/beacon.js       beacon + wake row + pulse; key-cap swapping
src/ui/console/nav.js          rail (tablist) / tiles / drill-down / micro-text badges
src/ui/console/card.js         ONE card renderer for B's Card data; action row; live NOW line
src/ui/console/eventrow.js     the single event row (replaces events.js eventRow + map card rows)
src/ui/console/go.js           Go split button + menu; travel bar; action runner (go / see-in-action / learn / follow / map / time)
src/ui/console/showbar.js      Show-me bar, Back chip
src/ui/console/banner.js       area banner (travel + on foot), restricted variant, breadcrumb
src/ui/console/search.js       search UI over C's engine (combobox), scopes, empty state, recent
src/ui/console/captions.js     captions lane + Listen log (moved out of hud.js)
src/ui/console/markers.js      activity markers (LOS-checked)
src/ui/console/pickui.js       hover tooltip, ring, reticle + prompt, chooser
src/ui/console/inputmode.js    last input → data-input = mouse | touch | keyboard | pad
src/ui/console/gamepad.js      Start/View/X/D-pad polling; linear focus navigation in the Menu
src/ui/console/welcome.js      Welcome + coach marks + returning-user notice
src/ui/console/modules.js      registry (§5); built-in sections register here
src/ui/console/commands.js     built-in commands for search
src/ui/console/icons.js        inline SVG line icons
src/ui/console/sections/{here,happening,map,time,learn,listen,settings,help}.js
src/ui/console/console.css     (or extend styles.css)
src/ui/mappanel.js, map/*      KEEP; adapted to be the Map section (no own search input; Key toggle; shared card)
src/ui/timepanel.js            KEEP dial/transport/date/zmanim code; lists removed; arcs → event card
src/ui/hud.js, intro.js, infopanel.js, aboutpanel.js, settingspanel.js, events.js   RETIRE (code moved), delete at the end
src/ui/settings.js             new keys + migration + define()
src/ui/controls.js             rewritten per device (single source for Help + README)
src/ui/dev/consoletest.mjs     new; ports uitest.mjs (45) + maptest.mjs (40) checks
src/ui/dev/uishots.mjs         real touch (hasTouch) for any --touch run, incl. landscape
```

**Public API.** It stays compatible; every old call keeps working.

```js
ctx.ui = {
  // kept
  toast(msg | {en,he}, ms?),            // → notice
  fade(to, ms) | fade(ms) -> Promise,   // unchanged (player / director veil)
  open(name, opts?) -> boolean,         // names: 'here'|'happening'|'map'|'time'|'learn'|'listen'|'settings'|'help'
                                        // + legacy: 'info' → here, 'about' → learn ({section:'controls'} → help), 'time' {focusEvent}
                                        //   → time + that event's card, 'info' {zone} → here pinned, 'map' {zone, event} as today
  close(), toggle(name), get panel(),    // panel = current section id | null
  hints(on), enter(), enabled, map,     // map = the existing test handle
  // new
  card(ref | hit) -> boolean,           // open the card for a subject
  search(q?, { scope? }) -> void,       // open the Menu with the search focused (and filled)
  banner(zoneId | { en, he }, { kind: 'enter'|'arrive' }?),
  modules,                              // §5
  console: {                            // test / debug handle
    state() -> { open, layout, view: { type, id }, section, detent },
    results() -> SearchResult[],        // current search results
    card() -> Card | null,              // the card on screen
    beacon() -> { name, expanded, rect },
    banners() -> [{ zone, kind, text, t }],   // the last 10
    pick(x, y) -> Hit | null,           // = ctx.inspect.pick + UI handling
  },
};
```

**Settings** (`settings.js`; `localStorage mikdash.<key>`):

| Key | Values | Default | Note |
|---|---|---|---|
| `travelWay` | instant \| walk \| run | walk | migrated from `travelSpeed` (§4.3), then `travelSpeed` is removed |
| `travelPace` | 0.5 \| 1 \| 2 \| 5 \| 10 | 1 | |
| `lookMode` | lock \| drag | lock (fine pointer) | read by the player (C) |
| `quickChips` | wake \| always | wake | the beacon's chip row |
| `areaNames` | always \| travel \| off | always | |
| `restrictedNotices` | bool | true | split from `captions` |
| `labels` | bool | true | now "Activity markers" |
| others | unchanged | | `quality amah volume captions musicStyle mouseSensitivity invertY fov headBob aggadah reducedMotion` |
| `module.<id>.<key>` | per module | | `ctx.settings.define({ key, type, values?, min?, max?, default })` |

**What A consumes, with feature detection.** A ships and passes its tests with none of B or C present:

| A needs | When missing |
|---|---|
| `ctx.inspect` (B) | No hover, pick or cards for people and objects. Place, event and term cards come from A's fallback describer, built from the existing `data.js`, zones content and glossary. Nearby and Things here are hidden; Show me is hidden; "Set clock to start" still works |
| `ctx.player.setPace`, the `goTo` options object, `travel:*` events (C) | Speeds map to the old string API (walk 1×, run 1×, slow for ½×). The pace buttons are hidden. The banner falls back to `zone:change` with dwell during a trip as well. Look-cancels-walk stays (old behaviour) |
| `src/search/index.js` (C) | Loaded through `import.meta.glob` (as `sim/index.js` does). When absent, the search uses the existing `places.js` matcher over places only |
| `player:tap` / `player:inspect` (C) | A listens to canvas `pointerup` itself for touch and unlocked mouse; no E or pad X |

**Behaviour details A must get right.**

- **Pointer lock:** §2.2. **Movement keys alongside the Menu:** §2.3.
- **One ticker** at `PRIORITY.ui`. DOM writes happen only on change.
  - Header text at 4 Hz.
  - Minimap: transform at ≤ 15 Hz; raster blit at 4 Hz. Raster re-render only when you cross 25 % of the radius or
    change level, and **≤ 6 ms** each on low.
  - Badges at 2 Hz. Card NOW at 4 Hz.
  - Pick ring at 30 Hz, only while a card or hover is live.
- **The minimap raster:** one whole-Mount raster per level, built in idle time after `firstFrame` (with the map
  prewarm) at ≈ 0.5 m/px. Each disc is a `drawImage` crop.
- **No new WebGL work.** Projection for the ring and markers uses `camera` matrices (the existing tag code).
- **History:** each Menu level pushes one `history.pushState({ mk: depth })`; `popstate` goes back. The state is
  cleaned up on close, so the browser history does not grow.
- **Gamepad in the Menu:**
  - D-pad / left stick ↑↓: previous / next focusable in the current region.
  - ←→: rail ↔ content (dock) or between tiles (grid).
  - LB/RB: sections. A: activate. B: back. X: the focused row's Show me. Y: the focused row's Go.
  - Right stick: scroll, or pan on Map. LT/RT on Time: −/+ 1/12 hour.
  - Repeat 400 ms then 90 ms. A 3 px gold focus ring.
  - Glyphs: Xbox by default; PlayStation when `gamepad.id` matches /054c|playstation|dualsense|dualshock/i.

---

### 6.2 (B) Inspect core: pick, describe, see in action

**Install** (in `src/sim/index.js`, after the runtime exists):

```js
const { createInspect } = await import('./inspect.js');
ctx.inspect = createInspect(ctx, { schedule, runtime, zones });
```

Inspect is not created when `ctx.params.shot` is set; the UI does not exist then.

**API**

```js
ctx.inspect = {
  /** CPU pick at client px; null = nothing pickable (sky). opts: { tolerancePx = 8, maxDist = 150 } */
  pick(clientX, clientY, opts?) -> Hit | null,
  /** = pick at the free area's centre (reticle) */
  pickCenter(opts?) -> Hit | null,
  /** cheap cached hover (internally ≤ 10 Hz): { ref, label:{en}, kind } | null */
  hover(clientX, clientY) -> HoverInfo | null,
  /** card data for a Hit or a ref ({kind,id} or 'kind:id'), at sim time t (default ctx.time.t) */
  describe(subject, t?) -> Card,
  /** a live world point for the subject (feet or base centre) for the ring / framing; null when gone */
  anchorOf(ref) -> Vector3 | null,
  /** subjects within r metres, nearest first: [{ ref, kind, title:{en,he}, label:{en}, distance, bearing:{en}, heading }] */
  nearby(r = 15, { limit = 12 }?) -> NearbyItem[],
  /** site elements with content inside a zone (for "Things here"): [{ ref, title:{en,he}, kind }] */
  thingsIn(zoneId) -> ThingItem[],
  /** the console's free area so framing centres there (px from each edge) */
  setViewInset({ left, right, top, bottom }),
  /** turn the view to put the subject at the free area's centre (ease ms) */
  frame(subject, { ms = 400 }?) -> Promise<void>,
  /** keep turning toward the subject until look/move input (null = stop) */
  follow(subject | null),
  /** run a see-in-action action (from a Card) */
  seeInAction(action) -> ShowHandle,
  /** director steps (tours, narration later): [{ go:{target}|{subject} }, { time:{t,date?,mode?} }, { frame:subject },
   *  { say:{text,ms} }, { wait: ms | 'event-start' }, { follow: subject }] */
  run(steps, { label }) -> ShowHandle,
  get show() -> ShowHandle | null,
  back() -> Promise<boolean>,           // restore the last show's Return snapshot
  get canBack() -> boolean,
  get backLabel() -> { en } | null,     // "Back to 08:39 at Ezrat Nashim"
};
```

**Types**

```js
Hit = {
  ref: 'actor:tamid-morning:slaughterers:2' | 'el:altar.kiyor' | 'zone:azarah' | 'crowd:…' | 'fire:…',
  kind: 'person' | 'animal' | 'object' | 'place',
  crowd?: true,
  label: { en },                       // short: "Kohen · slaughtering", "The kiyor", "Ezrat Yisrael"
  distance,                            // m from the eye
  world: Vector3, at: [X, Y, Z],       // the hit point (a floor hit: the spot for "Walk here")
  zone,                                // zone id at the hit point
  screen: { x, y },
  alternatives?: Hit[],                // other candidates within tolerance (max 4, nearest first)
};

Card = {
  ref: { kind, id },
  kind: 'person' | 'animal' | 'object' | 'place' | 'event' | 'offering' | 'term' | 'role',
  title: { en, he? }, translit?, subtitle?: { en },
  now: { text: { en, he? }, eventId?, step?: { id, label: { en, he? }, t0, t1 }, progress?: 0..1, until?: t } | null,
  why:  { text: { en }, sources: string[] } | null,      // persons/animals/events: why this is done
  what: { text: { en }, sources: string[] } | null,      // objects: name's purpose; terms: definition
  who:  { text: { en }, sources: string[] } | null,      // persons: role & attire; events: participants
  holding?: [{ prop, title: { en, he? }, what?: { en } }],
  measures?: [{ label: { en }, amot, m, confidence }],
  sections?: [{ id, title: { en }, items?: …, text?: { en }, refs?: Ref[] }],   // type-specific (place: access, services…)
  related?: [{ ref, title: { en, he? }, kind }],
  sources: string[],
  confidence?: 'explicit' | 'ordering' | 'reconstruction', confidenceNote?: string,
  zone?, at?: [X, Y, Z],
  actions: Action[],
};

Action = {
  id, label: { en }, kind: 'see-in-action' | 'go' | 'learn' | 'follow' | 'map' | 'time',
  primary?: true,
  // see-in-action:
  t?, date?, mode?: 'now' | 'warp' | 'jump', focus?: Ref | { at: [X, Y, Z] }, view?: { at, heading }, eventId?, follow?: boolean,
  // go: the player target (as goTo accepts) + a label
  target?: { at: [X, Y, Z?], heading?, look?: [X, Y, Z] }, goLabel?: { en },
  // learn / map / time:
  ref?: Ref, zone?, tSet?,
};

ShowHandle = {
  id, action, mode, label: { en },
  phase: 'placing' | 'warping' | 'jumping' | 'framing' | 'showing' | 'done' | 'cancelled' | 'failed',
  from: { date, t }, target: { date, t },
  progress: 0..1 | null, etaReal: seconds | null,
  skip(), cancel(), done: Promise<boolean>,
};
```

**Picking** (`inspect-pick.js`; CPU only; never `readPixels` or GPU queries).

- **Ray:** from `ctx.camera` through NDC. **Occluder:** one `ctx.physics.raycast(eye, dir, 150)` → `hitDist`
  (∞ for sky).
- **Figures:**
  - Iterate `ctx.schedule.runtime.entries[*].pools[*].slots` where `slot.shown && slot.placed && slot.actor`.
  - Test a shape from `ctx.people.pickShape(kindOrRole, poseName, scale)` (people/pick.js), oriented by the slot's
    heading:
    - capsule `{r: 0.3, h}`, with h = 1.75 standing, 1.1 kneeling, 1.0 sitting;
    - lying, sleeping or prostrate: a box 1.9 × 0.6 × 0.5 along the heading;
    - animals by kind: lamb, ram or goat box 1.1 × 0.45 × 0.8; bull 2.4 × 0.8 × 1.5; birds a sphere 0.15.
  - The pose comes from `slot._pose`.
  - **Tolerance:** the radius is inflated by `distance × tolerancePx × 2·tan(fov/2) / viewportHeight`.
  - **Bucket grid:** 8 m cells, rebuilt at 4 Hz from `slot.pos`. Only cells the ray passes within 40 m are tested.
- **Crowds:** for `CrowdHandle`s with `shown`, test the region box at 1.8 m high (or point boxes, max 64). The result is
  `kind: 'person'` with `crowd: true`.
- **Visibility:** a candidate counts only if its entry distance ≤ `hitDist + 0.25 m`.
- **Objects:** build world AABBs once from `ctx.site.elements[*].box` (site amot → world); a new amah means a reload,
  so this is never stale. Pickable kinds and priority: fixture 0, curtain 1, opening 2, gate 3, stair 4, ramp 5,
  chamber 6, slab 7, wall 8. The kinds floor and zone are never objects. Candidates:
  - (a) boxes containing the occluder hit point, expanded 0.25 amah;
  - (b) fixture, curtain and opening boxes the ray enters before `hitDist + 0.3 m` that do not contain the eye.
  - Pick by priority, then the smallest volume.
  - Movables and fires map to elements or `fire:` refs through `objects.js` aliases (`door:<el>` → `el:<el>`,
    `heichal.menorah.lamp-N` → `el:heichal.menorah`, …).
- **Order:** a person or animal beats an object when its entry distance ≤ the object's entry distance + 0.5 m. With
  none of these, a floor or wall hit gives `kind:'place'` (the zone at the hit point via `ctx.zones.atSite`, plus `at`).
- **Cost** on low (HD 4600, Edge): **≤ 0.5 ms per pick** (one BVH ray, ≤ 60 capsules, ≤ 161 AABBs). `hover` is cached
  per 2 px / 100 ms. B measures this in `src/sim/dev/tests/inspect.js`.

**Describing people** (`inspect-describe.js` plus the choreo hooks).

- Lookup: `actor → { entry, pool, slot, index }` through a map built after `firstFrame` from runtime entries, rebuilt
  on a miss.
- **New optional choreo exports**, in every module under `src/sim/choreo/*.js` that owns pools. Coverage is required
  in §7:

```js
/** Who is this figure and what is it doing at t? Pure function of (t, date, seed) like update(). */
describe(ctx, state, who, t, sim) -> null | {
  doing:  { en, he? },                 // "Slaughtering the morning tamid"
  phrase?: { en },                     // "one of the kohanim at the slaughter (morning crew)"
  eventId?: string,                    // the schedule event (or dynamic id) this is part of
  step?: { id, label: { en, he? }, t0, t1, offering?: OFFERING_TYPES id },
  why?: { en, sources: string[] },     // sourced only
  subjectKey?: string,                 // stable across time jumps, e.g. 'tamid-morning:shochet' or 'offering:<inst>:owner'
  next?: { t, label: { en }, step? },  // the next moment worth showing for this figure (see-in-action)
};
// who = { kind: 'person'|'animal'|'crowd', poolName, index, slot, role?, animal?, crowd? }

/** Where is the figure with this subjectKey at t (after a jump)? */
locate(ctx, state, subjectKey, t, sim) -> { slot } | { at: [X, Y, Z] } | null;
```

- **Fallback** (no hook, or `null`): the choreo's events active at t, the nearest one to the slot → `doing` "Taking
  part in: <event title>", `why` = the event summary with its sources. With no active event: "Between duties"
  (persons) or "Waiting" (animals), and the role info only.
- **Role and attire** come from `src/data/people-info.js`:

  ```js
  ROLES_INFO[role]  = { title: { en, he }, who: { en, sources }, attire: { en, sources } }
  ANIMALS_INFO[kind] = { title: { en, he }, what: { en, sources } }
  PROPS_INFO[prop]   = { title: { en, he? }, what: { en, sources }, glossary? }
  ```

  Every role in `src/people/roles.js`, every animal kind and every prop the choreos use needs an entry. The text comes
  from the glossary and the report, and must be sourced. "Avnet set aside" is shown when `slot._avnet === false`.
- **Identity honesty:** never a personal name. The phrase is the role plus the pool's job.

**Describing objects.** `src/data/objects.js`:

```js
export const OBJECTS = {
  'altar.kiyor': {
    aka: ['laver', 'kiyor', 'כיור'],              // extra search terms (C indexes these)
    purpose: { en: '…', sources: ['Shemot 30:18–21', 'Tamid 1:4'] } | null,   // null = no sourced purpose: name+measures+sources only
    glossary: 'kiyor',                             // optional term key
    inAction: [                                    // optional: event ids in src/data/schedule.js (or dynamic kinds)
      { event: 'kiyor-raise', label: { en: 'The kiyor is raised from the well' } },
      { event: 'kiyor-sanctify', step: 'start', label: { en: 'Hands and feet sanctified' } },
    ],
    view: { at: [X, Y, Z?], heading },             // optional stand; else B computes one 3–6 m from the box, facing it
    aliases: ['altar.kiyor.wheel'],                // movable ids / child elements that map here
  },
  // 'fire:<fx id>' entries allowed (should)
};
```

**Coverage required:**

- **every** element of kind fixture, gate, chamber, curtain, stair, ramp and opening (≈ 96);
- ≥ 60 of them with a sourced `purpose`;
- every `inAction.event` exists in the schedule (or is a dynamic kind B resolves);
- every `aliases` id exists in `ctx.movables` or the site.

The node check `src/sim/dev/tests/objects-check.mjs` runs without a browser. Unsourced text is never written. The
validator rejects a `purpose` without `sources`.

**Describing places, events, offerings, terms and roles** (B, so that A has one card source):

| Kind | Source |
|---|---|
| place | `zones.content[id]`: name; sanctity (via the UI's ladder numbering rule, which A passes in, or a copy of `data.js` LADDER logic); `accessLead`; services; description; sources; stand; Happening here and Next here (`schedule.at`, `upcoming`); Things here; Also here storeys |
| event | The schedule event, plus `progress`, participants, timing, sources, `viewOf`. Dynamic groups list their instances |
| offering | `OFFERING_TYPES` |
| term | `GLOSSARY`, with "Seen in" built once by scanning zone content, event descriptions and `OBJECTS` for the term or its aka |
| role | `ROLES_INFO`, plus active events whose participants include the role |

**Choosing the moment** (`inspect-show.js`): the rules are the table in §4.1. For a figure:

- the step it is in now (from `describe().step`);
- `next` from `describe()`;
- the event's `[t0, t1]`.

For an object: its `inAction` entries through the event times for the current date. For a past moment, B offers
"tomorrow" only when the event's `dayTypes` include tomorrow's day type. Dynamic instances come from
`runtime.planOf('private-offerings').insts` and the G4 set plans, through their `byId` sources. B never creates
figures; it only reads.

**Director** (`inspect-show.js`):

- Steps are as §4.1. The snapshot is restored on `cancel()` and `back()`.
- Uses only public APIs: `ctx.time` (set, setDate, setSpeed, pause), `ctx.player` (teleport `{fade:false}`, setLook,
  cancel, mode), `ctx.ui.fade`, `ctx.audio.setMaster` (restored from `ctx.settings.get('volume')`),
  `ctx.schedule.viewOf`, and `runtime.plans.done`.
- Emits `inspect:show`.
- **Follow** runs in an `onUpdate` at `PRIORITY.player − 1` and stops on `player:intent` look or move.

**B's acceptance tests** (sim dev runner, `src/sim/dev/run.mjs --script src/sim/dev/tests/inspect.js "t=d3"`, and
`n2`, `friday`, `shabbat` variants):

- For 200 random screen points over a populated view: `pick` never throws; median ≤ 0.3 ms and p95 ≤ 0.5 ms on low.
- Every visible pooled figure in 6 sample views (morning tamid, rings, duchan, Nikanor, night watch, Shabbat
  showbread) picks to its own ref when clicked at its projected chest.
- **describe coverage:** across t ∈ {d0.5, d2, d3, d5, d8, n1, n3} on weekday, Friday and Shabbat, ≥ 90 % of visible
  pooled figures get a hook-provided `doing` (not the fallback). 100 % get a role title and either an `eventId` or
  "Between duties".
- `seeInAction` for 10 actions of each mode (now, warp, jump-later, rewind, tomorrow) reaches `showing` within its
  budget (now ≤ 0.6 s, warp ≤ 6 s, jump ≤ 3 s, tomorrow ≤ 10 s on low). The subject is within ±10° of the free area's
  centre after framing. `back()` restores date, t (±0.01), position (±0.1 m), heading (±1°), speed and paused.
- No console errors; no new warnings.

---

### 6.3 (C) Travel and Search core

#### 6.3.1 Player API additions (`src/player/**`)

```js
ctx.player.goTo(target, speedOrOpts = 'walk') -> Promise<boolean>
//   speedOrOpts: 'instant'|'slow'|'walk'|'fast'|'run'|number (unchanged meaning)
//              | { way: 'instant'|'walk'|'run'|number(m/s), pace: 0.5|1|2|5|10 (any 0.25..10), label?: string|{en} }
ctx.player.setPace(p) -> number          // mid-trip; clamped [0.25, 10]; emits travel:pace
ctx.player.setWay(way) -> void           // mid-trip 'walk' ↔ 'run'; emits travel:pace
ctx.player.finishTrip() -> Promise<boolean>   // veiled teleport to the trip's target; travel:end reason 'skipped'
ctx.player.trip -> null | { id, label, way, pace, effectivePace, mps, s, total, remaining, eta, to:[X,Y,Z], zones:[{zone,s0,s1}] }
ctx.player.teleport(target, { fade = true } = {})   // fade:false for callers who hold their own veil (the director)
ctx.player.setInputEnabled(v: boolean | { keys?, move?, look?, pointerLock?, pad?, touch? })
//   boolean keeps today's meaning (all on / all off + release lock). Object form: unspecified fields unchanged.
ctx.player.setLockFilter(fn | null)       // fn(pointerEvent) -> boolean; false = do not request pointer lock (emit player:tap)
ctx.player.setVertical(-1 | 0 | 1)        // fly up/down for touch buttons (held state; 0 releases)
```

**Pace by sub-stepping**, in `player/index.js`'s update while `auto.active`:

- `n = ceil(pace · dt · 60)` sub-steps, each `dt' = pace · dt / n`, calling `auto.update(dt')` then
  `ctrl.update(dt', cmd)`.
- `n` is capped at **12** per frame. When the cap binds, the effective pace is `12 / (dt·60)`, reported as
  `effectivePace`.
- The camera is applied once per frame.
- **Glides** (fly) scale their duration by `1/pace`. **Instant** ignores pace.
- **The sim clock is untouched.**
- At pace ≥ 5, head bob is off for the trip (C reads nothing else; the vignette is A's).

**Route zones** (`player/trip.js`, at plan time):

- Sample the planned path every 0.5 m. World → site (`w2m`) → `ctx.zones.atSite(X, Y, Z)` (fallback
  `zoneAtSite` from `site.js`).
- Merge runs shorter than 1.0 m into the neighbouring run, so there is no flicker at walls and gates.
- Emit `travel:start` with `zones`, and `travel:zone` when `s` crosses each `s0`. The last run gets `final: true` at
  arrival.
- A path re-plan (a climb leg, a re-route) recomputes the zones from the current `s` on, keeping the same `id`.

**Events:** `travel:start`, `travel:progress` (≤ 4 Hz), `travel:pace`, `travel:zone` and `travel:end`, as in §6.0. The
existing `player:arrived` is kept.

**Free look during a trip** (resolves audit 9):

- `onIntent` cancels the trip **only** for `move` (WASD, arrows with focus in the world, joystick, left stick), `fly`
  (F, Space, Q, C) and pad B while walking.
- `look` (mouse, trackpad, touch look, right stick), `escape`, `tap` and `inspect` **do not** cancel.
- **Look offset.** During auto, look deltas accumulate into `lookOff = { yaw, pitch }` on top of the walker's own
  view yaw and pitch. The steering direction is unaffected.
  - Starting 2.5 s after the last look input, `lookOff` eases to 0 with τ = 0.6 s.
  - Pitch offset is clamped to ±60°.
  - At arrival framing, if the user looked within the last 1.0 s, their view is kept: the arrival does not override it.
- `input.js` must tag intents precisely. Today joystick and look both send `'touch'`; they become `'move'` and
  `'look'`. `player:intent` is emitted on the bus, throttled to 4 Hz per kind.

**Input changes** (`input.js`):

- `KeyE` is removed from `MOVE_KEYS.up` (Space stays up).
- `KeyE` keydown (not typing, not repeat) → `player:inspect { source:'key', x, y }`, with the last known mouse client
  position when unlocked and no x/y when locked.
- **Locked left click** → `player:inspect { source:'click' }`. It does not also re-lock.
- **Unlocked click** on the canvas with movement < 5 px and duration < 300 ms:
  - if `lockFilter(e) === false`, or when `pointerLock:false` → `player:tap`;
  - otherwise lock, as today.
  - A drag (≥ 5 px) is drag-look, as today, when the lock is refused or disabled.
- **Touch:** a single pointer, < 10 px, < 300 ms, not part of a two-finger tap, in either zone → `player:tap`. The
  joystick only appears after 10 px of movement or 150 ms of hold, so a quick tap in the left zone neither flashes the
  joystick nor moves.
- **Keyboard focus rules:**
  - Arrows, Space, Enter, Home/End and PgUp/PgDn are ignored by the player when `document.activeElement` is inside
    `#ui-root` and is not `body` or the canvas.
  - W A S D, Shift, Q, C and F still move unless the target is a text input.
  - `+`, `-` and `=` are never consumed by the player.
- **Gamepad:**
  - X (2) → `player:inspect { source:'pad' }`.
  - During a trip, B (1) while not flying → cancel. A movement of the left stick → cancel (move intent).
  - The player does not read buttons 8, 9 or 12–15 (the UI does).
  - With `pad:false`, no pad input at all.
- **`lookMode`:** the player reads `ctx.settings.get('lookMode')`. With `'drag'`, it never requests a lock, and
  click-and-drag looks.

**C's travel tests** (`src/player/dev/`, existing runner style, or a new `src/player/dev/triptest.mjs`):

- Walk and run at paces ½, 1, 2, 5 and 10 over 6 routes (the Chel steps → the Mizbeach top; Chuldah → the Heichal
  roof stairs; the upper chamber; a tunnel route; a climb leg; the 15 steps): arrival true, no tunnelling (the feet
  never pass through a collider; physics `insideAt` stays false), and arrival time ≈ length / (mps · pace) ±15 % for
  paces ≤ 5.
- `travel:zone` sequence equals the offline sample of the path. No zone is emitted twice in a row. Every crossing of a
  zone ≥ 1 m long is emitted, including at 10×.
- Looking during a trip (synthetic mouse deltas) never cancels. WASD cancels. The view returns to the look-ahead within
  3.5 s.
- E no longer rises; Space still does.
- Frame cost at 10× (12 sub-steps): player update ≤ 1.5 ms on low.

#### 6.3.2 Search engine (`src/search/**`)

**Files:**

```
src/search/index.js       createSearch(ctx) -> Search
src/search/normalize.js   normHe, normLatin, skeleton, variants
src/search/layout.js      SI-1452 ↔ QWERTY maps
src/search/sources.js     built-in document sources (zones, elements+objects, events, dynamic, offerings, roles, glossary)
src/search/dev/queries.js ≥ 80 fixture queries with expected top results
src/search/dev/searchtest.mjs   node runner (no browser): builds docs from the data modules + fixture schedule, runs queries
```

**API**

```js
import { createSearch } from '../search/index.js';
const search = createSearch(ctx);       // cheap; docs are built lazily in idle slices (≤ 8 ms per slice)
search.ready -> Promise<void>           // built-in sources indexed
search.add(source) -> () => void        // source: { kind, label:{en}, docs: Doc[] | (ctx) => Doc[], live?: boolean }
                                        //   live sources are called at query time (dynamic instances, module docs)
search.query(q, { scope?: kind | kind[], limit = 40, boost?: { kinds?: {kind: factor}, near?: [X,Y], zone? } })
  -> Result[]                           // sorted; synchronous; ≤ 3 ms for 1 500 docs on low
search.rebuild()                        // after time:date (index.js does this itself on the bus)
search.normalize(q) -> { he: string, latin: string, skeleton: string, layoutSwapped: string|null }

Doc = {
  id: 'zone:azarah',                   // the subject ref (§6.0)
  kind: 'place'|'thing'|'rite'|'offering'|'role'|'word'|'learn'|'help'|'setting'|'command'|string(module kinds),
  title: { en, he? }, translit?: string, aka?: string[], keywords?: string[],
  subtitle?: { en },                   // shown under the title (parent area, current value, definition…)
  when?: { t0, t1, active: boolean },  // rites
  at?: [X, Y, Z],                      // for proximity boost
  weight?: number,                     // default 1
}
Result = { doc, score, field: 'title.en'|'title.he'|'translit'|'aka'|'keywords', ranges: [[start, end]], tier }
```

**Built-in sources** (C):

| Kind | Source | Approx. docs |
|---|---|---|
| place | `ZONE_CONTENT` (name en, he, translit), parent area from `site.zones` | ≈ 60 |
| thing | `SITE.elements` of pickable kinds (§6.2) + `OBJECTS[id].aka` (via `import.meta.glob('../data/objects.js')`; absent → names only) | ≈ 96 |
| rite | `ctx.schedule.events` for the date (title en, he; zone name and choreo id as keywords). `dayTypes:['occasional']` flagged | ≈ 120 |
| rite (live) | `ctx.schedule.dynamic(t)` plus dynamic `upcoming` → `event:<id>`, title "<typeName> · <step>" | 0–40 |
| offering | `OFFERING_TYPES` names (en, he, translit) | ≈ 30 |
| role | `ROLES_INFO` (glob of `people-info.js`; absent → people roles with glossary names) | ≈ 25 |
| word | `GLOSSARY` (key, he, translit, aka, the first 12 words of en as keywords) | 347 |

A adds learn, help, setting and command docs, and module docs, through `search.add`.

**Normalisation** (exact rules, `normalize.js`):

- **Hebrew** (`normHe`):
  - NFC;
  - remove U+0591–U+05AF (cantillation) and U+05B0–U+05BD, U+05BF, U+05C1–U+05C2, U+05C4–U+05C5, U+05C7 (niqqud);
  - maqaf U+05BE → space; geresh U+05F3, gershayim U+05F4, `'` and `"` removed;
  - finals ך→כ ם→מ ן→נ ף→פ ץ→צ;
  - whitespace collapsed.
  - Variant tokens: each token with a leading ה, ו, ב, ל, מ or ש removed when the token has ≥ 3 letters, scored
    ×0.9.
  - **Matres skeleton:** each token with medial י and ו removed, as a lower tier (×0.7), so ניקנור ~ נקנור.
- **Latin** (`normLatin`):
  - NFKD and strip combining marks; lower case;
  - remove `' ’ ‘ ` - .`;
  - `sh → §` (protected); `tz|ts → z`; `ch|kh → h`; `ph → f`; `th → t`; `ck|q|c → k`; `w → v`; `x → ks`;
  - `ei|ai|ay|ey → ai`; `ee → i`; `oo → u`;
  - doubled letters → single;
  - a leading `the ` or `ha` (when the rest is ≥ 3 letters) as a variant (×0.95).
  - **Ashkenazi variant:** `s` (not from `sh`) → `t` at word end or between vowels, as an alternative token (×0.9).
  - **Skeleton** (×0.7): remove the vowels a, e, i, o, u, y after the folds, keeping a leading vowel, so kodashim ~
    kodoshim and mizbeach ~ mizbe'ach.
- **English** doc titles go through `normLatin` too. Stop words (`the of a an and`) are dropped from multi-token
  matching.
- **Layout map** (`layout.js`): a query of only Latin letters and punctuation is also mapped QWERTY → Hebrew (SI-1452),
  and a query of only Hebrew letters is mapped back; each scored ×0.85. The map:
  `q/ w' eק rר tא yט uו iן oם pפ aש sד dג fכ gע hי jח kל lך ;ף zז xס cב vה bנ nמ mצ ,ת .ץ`.
  For example `nzcj` → מזבח, and `שךאש` → `altar`.

**Matching and ranking.** Per field, the best tier wins:

| Tier | Score |
|---|---|
| exact (whole field) | 1.00 |
| prefix of the field | 0.90 |
| every query token is a prefix of a field token, in any order | 0.80 |
| substring | 0.65 |
| skeleton or matres match | × 0.7 |
| Damerau-Levenshtein 1 on tokens ≥ 4 chars (2 on tokens ≥ 8) | 0.50 |

- Field weights: `title.en` 1, `title.he` 1, `translit` 0.95, `aka` 0.9, `keywords` 0.6.
- Final score = tier × field weight × doc weight × kind boost × proximity boost (`near` within 60 m ×1.2; same zone
  ×1.2) × active-rite boost ×1.3.
- Ties: shorter title first.
- Empty or 1-character Latin queries return `[]`. A 1-letter Hebrew query is allowed (prefix only).

**C's search acceptance** (`searchtest.mjs`; ≥ 80 queries; each must place the expected doc in the **top 3**, and the
first 40 in the **top 1**). The set includes at least:

- `mizbeach`, `mizbe'ach`, `mizbeah`, `altar`, `מזבח`, `מִזְבֵּחַ`, `המזבח`, `nzcj`;
- `nikanor`, `nicanor`, `ניקנור`, `נקנור`;
- `ezrat nashim`, `ezras noshim`, `women's court`, `עזרת הנשים`;
- `kodesh hakodashim`, `kodesh kodoshim`, `holy of holies`, `קודש הקדשים`, `קדש הקדשים`;
- `heichal`, `hekhal`, `היכל`;
- `lishkat hagazit`, `gazit`, `chamber of hewn stone`;
- `kiyor`, `laver`, `כיור`;
- `tamid`, `תמיד`, `morning tamid`;
- `olah`, `ola`, `burnt offering`, `עולה`;
- `chatat`, `chatas`, `sin offering`;
- `semichah`, `smicha`, `leaning`;
- `shofar`, `levites`, `levi'im`, `duchan`;
- `subtitles`, `captions`, `volume`, `mouse`, `pause`;
- `kohen gadol`, `high priest`;
- `beit hamoked`, `beis hamoked`;
- `shushan`, `chuldah`, `huldah`;
- `parochet`, `paroches`, `curtain`;
- `menorah`, `מנורה`, `shulchan`, `showbread`, `lechem hapanim`.

Performance: the index builds in ≤ 60 ms in total across idle slices; a query takes ≤ 3 ms p95 on low.

---

### 6.4 Integration order and stubs

1. **Day 0:** all three engineers start at once.
   - A builds against feature detection (§6.1); B against the existing runtime and data; C against the existing
     player and data.
   - Shared refs, events and types are frozen by this file. A change needs all three to agree, and is logged in each
     decisions file.
2. **Checkpoint 1:**
   - B: `pick`, `hover`, `describe` for place, event, term and object, and the people fallback.
   - C: `goTo` options, `setPace`, the travel events, `player:tap` / `player:inspect`, free look, the search engine.
   - A: the shell, beacon, header and minimap, all eight sections on ported content, search UI, banner, travel bar.
   - A integrates and runs `consoletest.mjs`.
3. **Checkpoint 2:**
   - B: choreo `describe`/`locate` hooks for all modules, `objects.js` and `people-info.js` content, the director.
   - C: the zone-route edge cases (climbs, re-plans), the test suites.
   - A: cards with actions, the Show-me bar, the Welcome and coach marks, gamepad, markers, modules, docs.
4. **Final:**
   - The full test plan (§7).
   - `npm run build`.
   - `node tools/warmup-check.mjs` (cold boot must not regress: the Menu's minimap raster and the search index are
     built after `firstFrame`, in idle time).
   - Delete the retired UI files.
   - Update README (controls), `docs/API.md` (A merges) and the decisions logs.
   - Request ARCHITECTURE §13/§14 updates from the orchestrator.

---------------------------------------------------------------------------------------------------------------------

## 7. Test plan and acceptance criteria

### 7.1 Automated

| Suite | Owner | Runs |
|---|---|---|
| `src/ui/dev/consoletest.mjs` | A | Playwright: desktop 1280×720 (mouse), 1920×1080, phone 390×844 (`hasTouch`, DPR 2), phone landscape 844×390 (`hasTouch`), tablet 1024×768 (`hasTouch`) and 768×1024. Includes every uitest and maptest check ported, plus the checks below |
| `src/ui/dev/uishots.mjs` | A | New steps: play, wake, Menu home per layout, each section, search en/he, a person card, an object card, the Show-me bar, the banner (enter, arrive, restricted, breadcrumb), the travel bar at 10×, Welcome. Shots under `shots/console/` |
| `src/sim/dev/tests/inspect.js`, `inspect-show.js`, `objects-check.mjs` | B | §6.2 |
| `src/player/dev/triptest.mjs` | C | §6.3.1 |
| `src/search/dev/searchtest.mjs` | C | §6.3.2 |
| `node tools/warmup-check.mjs`, `npm run build` | All (A runs at the end) | Cold boot per tier; build |

The gamepad is emulated in Playwright by stubbing `navigator.getGamepads` with a scripted standard-mapping pad.
Pointer lock is emulated by dispatching `pointerlockchange` with a stubbed `document.pointerLockElement`. A also tests
on a real browser manually (§7.2).

### 7.2 Per device: manual test scripts

Each script is run on Edge (the HD 4600 dev machine, `low`) and Chrome. The phone scripts run on a real Android phone
and on iOS Safari (VoiceOver too) via the LAN dev server.

1. **Desktop mouse, pointer locked.**
   - Enter: the pointer locks, the beacon is visible and readable.
   - Press Esc: the Menu opens at Here. Esc goes back, Esc closes.
   - Alt-tab away and back while locked: the Menu does **not** open.
   - ✕ Close by click re-locks.
   - Aim at a kohen: the prompt appears. Click opens the person card. "Watch now" frames him at the free area's centre.
   - Press M, T, `?`, `/`: each opens its section. The same key closes it.
   - Press P: the clock pauses, and the beacon badge shows ❚❚.
2. **Desktop pointer free and trackpad.**
   - Mouse move wakes the beacon (pulse plus chips for 4 s).
   - Hover over a person: pointer cursor plus tooltip. Click: the card opens and the pointer is not locked.
   - Click empty floor: it locks. In `drag` look mode: drag looks, click inspects.
   - With the Menu open: WASD walks, drag looks, a click on the world inspects, and the Menu never closes on a scene
     click.
   - Two-finger scroll and pinch on the Map zoom.
3. **Keyboard only.**
   - Tab: the beacon is first. Enter opens the Menu. Arrows on the rail switch sections.
   - Here → Nearby → Enter on an item opens its card. E announces what is ahead.
   - Search "מזבח" → Enter → Ctrl+Enter goes there. During the trip: + raises the pace, and an arrow key with focus in
     the world stops it.
   - Esc clears the search, then goes back, then closes.
4. **Screen reader** (NVDA + Edge; VoiceOver + iOS Safari).
   - The beacon is announced with the place name and its shortcut. A zone change is announced once.
   - The Menu is a dialog with a labelled tablist. Search announces the result count. Cards read title, NOW and WHY in
     order.
   - Travel start and arrival are announced. The banner is announced. Captions are read.
   - No live region chatters (≤ 1 announcement per 2 s outside captions).
5. **Touch phone, portrait** (390×844 and 360×740).
   - The beacon is bottom-right and does not overlap the joystick.
   - A tap on empty scenery: pulse plus chips. A tap on a person: the card in the peek sheet, the subject framed in the
     visible area.
   - Tiles: all 8 labels fully visible at 360 px. Drill into Here and back with "‹ Menu" and with system back.
   - Drag the sheet to full and down to close.
   - Search in Hebrew with the system keyboard (IME). Results update after composition.
   - Go at 10×: the travel bar, the banner breadcrumb, a tap on the banner opens that place.
   - Two-finger tap still toggles run. A quick tap in the joystick zone does not flash the joystick.
6. **Touch phone, landscape** (844×390). Right sheet; header one row; tiles 4×2. The world on the left still supports
   joystick and look. Map full screen; the card is a bottom sheet with Go reachable without scrolling.
7. **Tablet** (1024×768 landscape: dock with touch sizing; 768×1024 portrait: sheet). The same scripts as 2 and 5
   with touch.
8. **Gamepad** (Xbox standard; a DualSense if available).
   - Start opens the Menu. LB/RB switch sections. The D-pad moves focus with a visible ring. A activates. B backs out,
     then closes.
   - View opens the Map. X inspects at the reticle. Y on a row goes.
   - During a trip: D-pad ←/→ change the pace, B stops. The right stick looks without cancelling.
   - Glyphs swap to the pad after any button press, and back on mouse movement.
9. **Low-end GPU** (HD 4600, Edge, `low`).
   - Interleaved in-page A/B (CLAUDE.md method): fps with the Menu closed vs open (dock, Here) vs open (Time) vs
     Show-me warp vs 10× travel.
   - The Menu open must cost ≤ 1 fps median vs closed (vsync-quantised). There is no blur on low.
   - UI tick ≤ 0.3 ms median and ≤ 1 ms p95 (`performance.measure` around `hud.tick`/`console.tick`).
   - No CSS animation of box-shadow or filter anywhere (A greps `styles.css` and `console.css` for
     `@keyframes … box-shadow|filter` → none).
   - Cold boot (`warmup-check.mjs`) is within 5 % of the current first-frame times per tier.
10. **Mixed and edge cases.**
    - At night: the minimap night tint, the dot readable, picking works on dark figures, Show me the night watch.
    - Inside an upper chamber and a tunnel: the storey badge, the banner storey tag, picking inside rooms.
    - At 600× clock: card NOW lines pin to the event, banners still work, and Show me resets to 1×.
    - Aggadah off: no aggadah events in cards, Happening or search.
    - `shot=1` and `ui=0`: no UI code is loaded and no `ctx.inspect` exists (B skips install).
    - A settings reload resumes and reopens Settings.

### 7.3 Acceptance criteria (all must pass)

**Invocation and orientation**

- **AC-1** In play, the beacon (minimap disc with a glowing dot, the current area's Hebrew and English names, "Menu",
  and a device key cap) is visible at all times on every device. Nothing else persistent is on screen except the
  in-world markers.
- **AC-2** Moving the mouse with the pointer free, tapping empty scenery, or pressing any pad button reveals the quick
  chips within 200 ms. They stay for 4 s after the last trigger.
- **AC-3** The Menu opens with:
  - mouse (click the beacon);
  - keyboard (Esc, or Enter on the beacon);
  - locked pointer (Esc);
  - touch (tap the beacon);
  - gamepad (Start);
  - screen reader (the first Tab stop).
  It never opens on alt-tab or window blur.
- **AC-4** Every Menu view shows the minimap with the glowing dot, the current area's names, the "About this place ›"
  link and the clock. No scroll position hides them.
- **AC-5** Every icon in the beacon, the chips, the header, the rail, the tiles, the cards, the bars and the banner
  has a visible text label. ✕ is labelled "Close" on phones and carries "Esc" on desktop.
- **AC-6** Every audited surface and duplicate path (§3.5.1, §3.5.2) has exactly one home. The four icon-only tools,
  the compass strip, the hint bar, the per-row speed selects and the map-local search input are gone.

**Inspect and see in action**

- **AC-7** Clicking or tapping a visible person, animal or object opens its card within 150 ms, with title, NOW, WHY or
  WHAT FOR (when sourced), sources and actions. Overlapping candidates show a chooser.
- **AC-8** "See in action":
  - takes the labelled mode (now, warp, jump, rewind or tomorrow);
  - shows the Show-me bar with progress, Skip and Cancel;
  - frames the subject within ±10° of the free area's centre;
  - offers ↶ Back, which restores date, time, place, view, speed and pause.
  Captions are held and audio is dipped during warps.
- **AC-9** Keyboard, screen-reader and gamepad users can inspect every subject within 15 m through Nearby, without
  aiming.

**Search**

- **AC-10** Search reaches places, things, rites (including live offering instances), offering types, roles, words,
  settings, help and commands, in English, Hebrew (with or without niqqud, and with prefixes) and transliteration.
  The wrong-layout `nzcj` finds the Mizbeach. All §6.3.2 queries pass. Each result can Go, Show me, or open its card
  from the result row.

**Travel and the area banner**

- **AC-11** Every Go uses one control with Walk, Run or Instant and pace ½× 1× 2× 5× 10×. The pace and the way can
  change mid-trip from the travel bar (+/−, D-pad). Skip and Stop work. Looking around never cancels a trip. Movement
  does.
- **AC-12** At 10× run, no collider is tunnelled on the six test routes, and arrival works.
- **AC-13** Entering an area shows its banner:
  - during walk and run trips (every zone crossed of length ≥ 1 m, with a "via" breadcrumb at fast pace);
  - on foot (after the 0.8 s dwell, at most once per zone per 60 s);
  - on arrival, including Instant.
  A click or tap opens that place's card. The restricted variant replaces the old access toast and does not depend on
  Subtitles.

**Audio and extensibility**

- **AC-14** Listen holds volume, sound on/off, subtitles, music and the recent-captions log. A dummy module
  (`src/ui/dev/demo-module.js`, test only) registering a section, a card action, a search doc, a command and a setting
  appears in all those places and unregisters cleanly.

**Performance and regressions**

- **AC-15** Performance per §7.2 item 9. No new shaders. No synchronous GPU queries. No box-shadow or filter
  animations. Cold boot is not regressed by more than 5 %.
- **AC-16** `npm run build` passes. The console is clean (no errors, no repeated warnings) in every test run. All
  ported uitest and maptest checks pass. README controls match `controls.js`.

---------------------------------------------------------------------------------------------------------------------

## 8. Deferred, and risks

**Deferred** (not in this build):

- the engine 10 fps render throttle behind the Menu;
- the discovery journal ("Places you've stood");
- spatial gamepad navigation and hold-Start quick select;
- a narration or tour module (the contract and registry are ready);
- walking, rather than teleporting, to a Show-me stand;
- a per-object `objects` key on schedule events (`objects.js` holds the mapping instead, so schedule data is
  untouched).

**Risks and mitigations:**

- **Content accuracy gates the person and object cards.** `describe` hooks and `objects.js` must be sourced. Where they
  are not, the card shows less. The fallback ("Taking part in: <event>") makes every figure useful from day one.
- **Pointer-lock quirks differ by browser.** The beacon is the primary door; drag look is always available; §2.2 guards
  are tested manually on Edge, Chrome and Firefox.
- **10× comfort.** Sub-steps, no bob, a vignette, Skip and Instant.
- **E rebind retrains users.** It is listed under Help → What's new. Space keeps rising.
- **Regressions in the map and time code.** Both are kept and adapted, not rewritten. All 85 existing UI checks are
  ported before the retired files are deleted.
- **Pooled-slot identity across jumps.** `subjectKey` plus `locate`, falling back to framing the event; never a
  guessed figure.
