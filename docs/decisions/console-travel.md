# console-travel — Engineer C: the travel and search core (docs/console-design.md §6.3)

The player's trips: a pace multiplier (½×–10×) by sub-stepping, the way switched mid-trip, Skip, the route's places
announced as they are crossed, the travel:* events; looking around during a trip without stopping it; the input's
taps, E / click / pad X inspect and precise intents; the partial input switches, the lock filter and touch Rise / Sink.
And `src/search/`: one index over places, things, rites (live offerings too), offering types, roles and words, plus
whatever the UI and modules add, in English, Hebrew and transliteration. Format: **choice** — why — alternative.

## Choices — travel

- **Pace = more walker steps per frame, never a higher speed.** Each frame runs `n = ceil(pace·dt / SUB)` steps of
  the walker and the controller, `SUB` = 1/50 s of walking time, at most 12. When the cap binds, the pace actually run
  is `12·SUB/dt`. It is reported as `effectivePace`: 14× at 60 fps, 7× at 30 fps, 4.8× at 20 fps. The camera is applied once
  per frame. — Why: collisions, stairs and nav corners behave as at 1×. A 10× run moves 9 cm per step, under the
  controller's own 12 cm collision step. The spec's 1/60 s gave two steps at 1× whenever a frame took 16.8 ms
  (`ceil(1.008)`), so the 1× cost doubled on vsync jitter. — Alternative: speed × pace (tunnels at 45 m/s).
- **What the pace applies to.** Walking and the climb are sub-stepped. A glide runs its clock × pace. The arrival's turn, the
  teleports and the waits run in real time. — Why: at 10× the arrival turn would spin the view in 0.25 s.
- **Head bob is off for a trip at 5× and faster** (`controller.state.noBob`). The camera's stair smoothing runs on the
  paced time, so the eye keeps up with the feet on a 10× flight.
- **The route is the planned path as a polyline of feet points, measured in 3D.** The walker's distance along it is
  mapped exactly from its leg, segment and progress (`goto.js tripS`), not by projecting the body. A climb's via, a
  glide and a re-plan each know their index in the route. — Why: projection fails on stacked paths (newel stairs).
- **Places along the route.** The route is sampled every 0.5 m. A stair or ramp segment is sampled on the floor under it,
  because the string-pulled path cuts the air above a flight. Each boundary is bisected to ~3 cm, and runs under 1 m are
  merged into their neighbours. — Why bisect: a run's length decides whether it is merged, and the midpoint rule made
  a 0.8 m sliver measure 1.0 m.
- **The destination is announced twice.** Entering it gives `final: false` (an ENTERING banner when the last stretch is
  long). Arriving gives `final: true`, which marks the arrival (the UI shows ARRIVED from the goTo promise). — Why: a 40 m
  walk across the Azarah would otherwise name the Azarah only on arrival. "No place twice in a row" holds for every
  event except this marker. — Alternative: hold the destination until arrival.
- **The place the trip starts in is not announced.** Veiled jumps (Instant, Skip, the walker's hop over an unreachable
  stretch) announce no places in between, only the arrival.
- **A re-plan keeps the trip's id and the places already announced.** It samples again from the current distance
  (the arrival's re-frame walk, the landing after a glide, a stuck hop).
- **ETA = remaining / the walk's observed speed along the route** (smoothed over ~2 s, never under 0.3 × mps · pace).
  — Why: the walker slows on stairs, newel stairs and turns by design. The six test routes take 1.08–1.39 × length / mps
  walking, and 2.7× running the newel stair to the Beit HaTevilah, so length / mps would promise too early an arrival.
- **Free look during a trip is a view offset on top of the walker's own yaw and pitch.** Steering never sees it. Its pitch is held to ±60°.
  It eases back starting 2.5 s after the last look input: τ 0.6 s plus 40°/s, so a 90° look is back in 0.9 s. At the
  end of the trip the offset is folded into the view, with no jump. — Why the added rate: a pure exponential leaves 19 % after
  1 s and never lands, while the spec's test asks for the look-ahead within 3.5 s. During the arrival's turn the offset eases at once. A
  user who looked in the last 1.0 s keeps their view: the arrival ends without turning.
- **The look clock is the frame clock** (the sum of frame times), not `performance.now()`. — Why: a hidden tab or a
  test stepping frames by hand sees the same 2.5 s.
- **Intents.** move: WASD, arrows, joystick, left stick, pad B on a walking trip. look: mouse, drag, touch look, right
  stick. fly: F, Space, Q, C, pad Y, Rise / Sink. escape. tap. Inspect has its own event. A move or fly intent stops a
  trip at once; the bus event is throttled to 4 Hz per kind. Space is a fly intent in walk mode too, so it stops a
  walking trip (§6.3.1 lists it). The pad's own up / down buttons (A, B, LB, RB) emit no intent, because A would
  otherwise stop a trip.
- **`teleport(target)` stays synchronous by default** (`{ fade: false }`). `{ fade: true }` is the veiled one and
  returns a Promise. — Why: every existing caller expects an immediate teleport that returns a boolean: the sim test
  scripts, the audio dev pages, and B's director (which holds its own veil). This deviates from the spec's default
  `fade = true`; nobody asks for the veiled form yet.
- **Clicks, unlocked.** Whether to capture the mouse is decided at pointerdown, which is the user gesture. A capture
  needs `pointerLock` and `look` enabled, `lookMode` ≠ drag, no refusal in the last 1.5 s, and a lock filter that does
  not say false. A click under 5 px and 300 ms that did not capture is a `player:tap`. A drag looks only after 5 px.
  — Why: a click's jitter fired look intents, and those stop B's Follow.
- **E with the mouse free inspects at the last pointer position over the canvas.** Over the Menu, or when no position
  is known, it sends no x/y, which means the centre. When captured, it always sends no x/y.
- **Touch.** A touch on the left is a pending joystick until it moves 10 px or is held 150 ms (not while it may still be
  half of a two-finger tap). A single touch under 10 px and 300 ms, in either zone, is a tap, also when the hold had
  shown the joystick but it never moved the observer.
- **Taps and clicks are timed by the events' own timestamps** (`e.timeStamp` at pointerdown and pointerup; the
  two-finger tap too), not by `performance.now()` in the handlers. The joystick's 150 ms hold has no event to time it,
  so it counts frame time, at most 50 ms per frame. — Why: a frame that blocks the main thread between the two events
  (a shader compile, a Show-me jump; the HD 4600 compiles for seconds after boot) made a 178 ms tap read as 539 ms, so
  it neither inspected nor woke the beacon. A frame inside the stall could also start the joystick before the
  pointerup was read. — Alternative: the latest event's timestamp as the hold clock (a finger held still sends none).
- **Gamepad hand-over.** A button or the left stick held while the pad belonged to the Menu (`pad: false`) is ignored by
  the player until it is released. The held set is filled every frame while pad input is off, and again when it is
  turned back on (whichever runs first in the frame). — Why: the Menu closes on B's press edge and hands the pad back
  with B still down; the player saw a new B and stopped the walk, and a held A / B / LB / RB rose or sank in fly mode.
- **Focus rule for the Menu keys.** The player leaves arrows, Space, Enter, Home, End, PgUp and PgDn alone while any
  control other than the page or the canvas has focus. This is broader than "inside #ui-root", because Space on any
  focused button would click it. `+ - =` are never read.
- **`setInputEnabled({ … })` changes only the fields given.** `pointerLock: false` (or `look: false`) releases a
  capture; `move: false` zeroes movement but keeps E and Esc (those belong to `keys`); `pad: false` reads no pad at all.
- **Test hooks, not API.** `player._hold`, `_tick(dt)`, `_walkerHeading()`, `_flying()` and `_input` are
  non-enumerable and exist for `src/player/dev/trip.js`.

## Choices — search

- **The engine (`engine.js`) is pure; `index.js` wires it to the app.** `index.js` handles idle building, the bus, the
  live sources and `import.meta.glob` for the optional `objects.js` and `people-info.js`. — Why: the node test can run
  the same engine and sources without Vite.
- **The documents are built in idle slices of at most 8 ms after the first frame.** The UI imports the module then.
  The day's rites are rebuilt on `time:date`. A query before the build is done finishes the build synchronously, a
  one-time cost of about 100 ms: correct results come before a smooth first keystroke.
- **The normalisation follows §6.3.2, with these changes.**
  - NFKD is applied only where it matters: Hebrew presentation forms, and Latin text with accents. Plain ASCII and
    plain Hebrew skip it, because it was the largest share of the build time.
  - A hyphen is a space. The compact form (all tokens joined) also matches the joined spelling, so "burnt-offering"
    and "beithamoked" both work. The spec removes the hyphen.
  - A word-final h after a vowel is dropped, before ch → h: olah ~ ola, semichah ~ smicha, chuldah ~ huldah.
  - Prefix letters are stripped from the query (any of הובלמש). On the documents only the article ה is stripped,
    because stripping ל from לשכת would produce a nonsense token.
  - The ha- article is a variant on both sides.
- **The consonant and matres skeleton is a lower tier**, matching only whole tokens or their beginnings, and only when
  each query token keeps 3 or more letters. — Why: "mouse" → "ms" matched the mesibah.
- **The prefilter keys on word beginnings.** A query token's first three letters must begin one of the document's tokens
  (in some form). So the substring tier applies to strings that begin at a word or at a compact join, and a substring
  starting mid-word is not searched for. The article-stripped forms already cover "hamoked" → "moked". — Why: scanning
  every document's strings cost about 0.5 ms a query; a set lookup costs about 0.05 ms.
- **The wrong keyboard layout and typos are fallbacks.** They run only when fewer than 8 documents matched.
  Damerau-Levenshtein 1 (2 for tokens of 8 letters or more) is tried only for query tokens that begin no known word,
  over a token dictionary indexed by first and second letter. It is computed once per query token against all prefix
  lengths. — Why: a re-typed or misspelt query finds little in its own form, and running both on every query cost about 2 ms.
- **Ranking is by band, then by score.** Bands follow the tiers: exact › prefix › tokens and substring › skeleton
  and typo. Weights and boosts order results only within a band. The context boosts (near ×1.2, same zone ×1.2,
  active ×1.3, recent ×1.1) multiply to at most ×1.25. The scope's ×1.5 is the caller's choice and is not capped. —
  Why: in play at Sha'ar Nikanor, "huldah" ranked "A healed metzora" (a skeleton match, h-l-d) above the Chuldah gates,
  "mouse" ranked "Mothers and the healed" (a typo match) above the settings, and "altar" ranked six active rites
  ("Blood on the altar…") above the altar. The node fixture had no active rites, so it never saw the boosts. A cap
  alone was not enough: a word-inside match ×1.25 (1.0) still beat an exact aka (0.86–0.9). — Alternative: boosts
  only as tie-breaks (then a nearby rite would never lead an equally good match).
- **Weights by kind.** Places and rites 1. Things, offering types, roles, settings and commands 0.95. Words, Learn and
  Help 0.85. A wall or slab element counts ×0.75, and an element with no objects.js entry ×0.85. — Why: the 347
  glossary words must not crowd out the place they name.
- **Place documents list their id among the aka** (the ids are transliterations: nikanor, beit-hamoked, gazit), along
  with the full name and its English descriptor. The subtitle is the parent area: the zone that holds the stand, one
  level up. It is computed on first read.
- **Things are the site elements of the kinds a person can point at, plus objects.js entries that are no single
  element** (the fires, the thirteen shofarot). Their zone and subtitle are computed on first read (`zoneAtSite` for
  170 elements was 18 ms of the build).
- **Live offerings** (`schedule.dynamic` + `upcoming(…, { dynamic: true })`) are a live source, cached for 0.5 s or
  0.1 sim min, so a burst of keystrokes reuses them.
- **A glossary entry's first 12 words of definition form one keyword field**, not twelve.
- **Recent choices** are read from the UI's `localStorage mikdash.recent` (×1.1). The aggadah layer off hides its
  rites.

## Verification

- `node src/player/dev/triptest.mjs`. First, the node unit checks of trip.js: sampling, merging, announcing, re-plan,
  hop, pace clamp. Then the in-page suite on low, with walks stepped on a virtual 60 Hz clock:
  - **60 trips** (6 routes × walk and run × ½ 1 2 5 10): all arrive.
  - No tunnelling: the body is never inside a collider (two jittered columns agree), and no step's ray passes through
    one. This holds at 10× on every route, including the climb, the newel stair and the 15 steps.
  - The walk to the stand at pace p takes the 1× time / p within 0.99–1.01.
  - `travel:zone` equals an offline 0.25 m sample of the planned path, with no place twice in a row. It agrees with the
    feet: every announced place was stood in, and every place walked through for ≥ 1.5 m was announced.
  - Absolute time vs length / (mps · pace): 1.08–1.39 walking, 2.73 running the tunnel route. The spec's ±15 % absolute
    check fails on stair and curve routes by the walker's design, so the suite checks the pace against the 1× walk.
  - Look: a 50° drag look does not cancel, and the view is back on the look-ahead 3.1 s after the last look. W cancels.
  - E: no rise, one `player:inspect`. Space rises.
  - Pad hand-over: a B pressed while the pad is off and held after it is handed back does not stop a walk (both
    orders in the frame); a fresh B does. A held-over A does not rise in fly mode (0 m); a fresh A does (2.1 m).
  - Touch: a 40 ms tap whose pointerup is read after a 400 ms stall, with a player frame inside the stall, is one tap,
    in the right zone and in the joystick zone. A 400 ms still hold is not a tap.
  - setPace(2) → 2, setPace(99) → 10, setWay('run'): three `travel:pace` events. finishTrip → true with reason
    'skipped'. A new goTo makes the old trip 'superseded'.
  - Player frame at 10× with the 12-step cap binding (dt 1/40 s): median 0.4 ms, p95 0.8 ms (budget 1.5).
- `node src/search/dev/searchtest.mjs`:
  - 749 documents (68 places, 170 things, 82 rites, 20 offering types, 22 roles, 347 words, 40 UI documents).
  - 40/40 top-1 and 73/73 top-3. These include every query §6.3.2 lists, typos, wrong-layout input both ways,
    prefixed and pointed Hebrew, and partial typing.
  - The same 113 again with the observer at Sha'ar Nikanor and every rite active (the most the boosts can do), plus
    `CONTEXT` (huldah, altar, mouse, שךאשר, nikanor) top-1: all pass, and no result outranks one in a higher band.
  - Query time in node on this machine: median 0.43–0.53 ms, p95 1.2–2.1 ms (budget 3).
  - Build: 95–115 ms cold in node, about 65 ms warm, spread over idle slices of at most 8 ms after the first frame.
    This is over the spec's 60 ms total. The cost is the preparing of ~3 000 field strings; the main thread never
    gives it more than 8 ms at a time.
- In the page (headless Edge, low, render loop running):
  - The search is ready 1.37 s after creation: 92 ms of building in 18 idle slices.
  - The 113 fixture queries × 3, warm: median 0.9 ms, p95 2.3 ms, max 12.4 ms (one GC).
  - Live offering instances are found by title, and an active one ranks first (×1.3).
  - Through A's console, `ctx.ui.search('nzcj')` → zone:mizbeach first.
  - A 10× run from Ezrat Nashim to the Azarah gave the banners ENTERING fifteen-steps, lishkat-chavitin,
    ezrat-yisrael, restricted ezrat-kohanim, then azarah.
  - No console errors.
- `npx vite build`: passes. `src/search` is its own lazy chunk (18.7 kB) and the player chunk adds no new imports.
- `node tools/warmup-check.mjs --tiers low --modes play`: PASS. First frame 14.1 s (A's interleaved runs gave
  13.8–14.2 s on the same tree before this work). Worst frame in play 484 ms. The search builds after 'firstFrame'.
- Other people's tests that drive the player still pass:
  - B's `src/sim/dev/tests/inspect-show.js "t=d3&inspect=1&sn=4"`: no failures (teleport `{ fade: false }`, cancel,
    setLook).
  - `src/player/dev/goto-frame.js` and `src/player/dev/climb.js`: up and down the cedar posts.
  - A's `node src/ui/dev/consoletest.mjs` with this core present: 181 passed, 0 failed, console clean. It covers the
    lock filter and taps, the pointer-lock rules, the travel bar with pace, the banner on travel:zone, and search
    through the core.

## API

### ctx.player (src/player/index.js) — additions; every old call keeps its meaning

```js
ctx.player.goTo(target, speedOrOpts = 'walk') -> Promise<boolean>
//   speedOrOpts: 'instant'|'slow'|'walk'|'fast'|'run'|number m/s (pace 1, as before)
//              | { way: 'instant'|'walk'|'run'|number (m/s), pace: 0.25..10 (UI: ½ 1 2 5 10), label?: string | { en } }
//   Every goTo is a trip with an id (travel:* events). A new goTo supersedes the running one.
ctx.player.setPace(p) -> number          // the running trip's pace, clamped 0.25..10 (returned); emits travel:pace
ctx.player.setWay('walk' | 'run')        // mid-trip; emits travel:pace
ctx.player.finishTrip() -> Promise<boolean>   // veiled teleport to the trip's target; travel:end reason 'skipped'
ctx.player.trip -> null | { id, label: { en } | null, way, pace, effectivePace, mps, s, total, remaining, eta,
                            to: [X, Y, Z], zones: [{ zone, s0, s1 }] }      // a fresh snapshot per read; metres, seconds
ctx.player.teleport(target, { fade = false } = {})   // fade false: now, returns boolean; fade true: under ctx.ui.fade,
                                                     // returns Promise<boolean>
ctx.player.setInputEnabled(true | false | { keys?, move?, look?, pointerLock?, pad?, touch? })
//   boolean: all on / all off (and release the pointer). Object: only the given fields change; pointerLock or look
//   false releases a capture. keys = the keyboard (movement keys also need move; E and Esc need only keys).
ctx.player.setLockFilter(fn | null)      // fn(pointerdown event) -> false: an unlocked click does not capture the mouse
                                          // (a short one is a player:tap)
ctx.player.setVertical(-1 | 0 | 1)       // held fly down / release / up (touch Sink / Rise); a fly intent
ctx.player.toggleFly() -> 'walk' | 'fly' // F's action (cancels a trip)
ctx.player.heading / pitch               // the VIEW's (free look during a trip included); setting them, or setLook(),
                                          // clears the free-look offset
ctx.player.path                          // as before, or the trip's route while gliding to a landing
```

Pace: walking and climbing are sub-stepped (≤ 1/50 s of walking time per step, ≤ 12 steps a frame). A glide's clock
runs × pace. Instant, the arrival's turn and the veil run in real time. The sim clock is never touched. At pace ≥ 5,
head bob is off. Settings read: `lookMode` ('drag': never capture; drag looks, a click taps), `mouseSensitivity`,
`invertY`, `headBob`.

### Bus (emitted by the player)

| Event | Payload | When |
|---|---|---|
| `travel:start` | `{ id, label, way, pace, mps, distance, eta, to: [X,Y,Z], zones: [{ zone, s0, s1 }] }` | once the route is known (after nav planning; at once for Instant) |
| `travel:progress` | `{ id, s, total, remaining, eta, pace, effectivePace }` | ≤ 4 Hz |
| `travel:pace` | `{ id, pace, way }` | setPace / setWay |
| `travel:zone` | `{ id, zone, prev, index, s, at: [X,Y,Z], final }` | each place entered along the route (runs ≥ 1 m, never the start, never twice in a row); then once more with `final: true` at arrival (the place the feet stand in) |
| `travel:end` | `{ id, ok, reason: 'arrived'\|'cancelled'\|'superseded'\|'failed'\|'skipped' }` | once |
| `player:tap` | `{ x, y, pointerType }` | a short click on the canvas that did not capture the mouse; a short single touch |
| `player:inspect` | `{ source: 'key'\|'click'\|'pad', x?, y? }` | E (x/y: the pointer over the canvas while free), a click while captured (no x/y), pad X |
| `player:intent` | `{ kind: 'move'\|'look'\|'fly'\|'escape'\|'tap' }` | ≤ 4 Hz per kind; move and fly stop a trip |

`player:arrived` and `ui:goto` are unchanged.

### Search (src/search/index.js)

```js
import { createSearch } from '../search/index.js';   // the UI loads it through import.meta.glob after 'firstFrame'
const search = createSearch(ctx);       // cheap; documents prepared in idle slices (≤ 8 ms); the rites again on time:date
search.ready -> Promise<void>           // the built-in sources (and objects.js / people-info.js when present) indexed
search.add(source) -> () => void        // { kind, label: { en }, docs: Doc[] | (ctx) => Doc[], live?: boolean }
                                         // live: called at query time (re-prepared only when a doc's text changes)
search.query(q, { scope?: kind | kind[], limit = 40, boost?: { kinds?: { [kind]: factor }, near?: [X, Y], zone?,
                  recent?: id[] } }) -> Result[]        // synchronous, best first
search.rebuild()                        // re-prepare every static source
search.normalize(q) -> { he, latin, skeleton, layoutSwapped }
search.stats -> { slices, ms }          // the build's cost so far

Doc = { id: '<subject ref>', kind, title: { en, he? }, translit?, aka?: string[], keywords?: string[], subtitle?: { en },
        when?: { t0, t1, active }, at?: [X, Y, Z?], zone?, weight? }
Result = { doc, score, field: 'title.en'|'title.he'|'translit'|'aka'|'keywords', ranges: [[start, end]], tier:
           'exact'|'prefix'|'tokens'|'substring'|'skeleton'|'fuzzy' }
```

Built-in documents and their ids:

| Kind | Id | From |
|---|---|---|
| place | `zone:<id>` | ZONE_CONTENT |
| thing | `el:<element>`, `fire:<fx>` | the site elements of the kinds a person can point at, plus objects.js |
| rite | `event:<id>` | the day's `ctx.schedule.events`, plus EVENTS with dayTypes 'occasional' (`occasional: true`, subtitle "Occasional") |
| rite (live) | `event:<dynamic id>` | `schedule.dynamic(t)` plus `upcoming(t, 40, { dynamic: true })` |
| offering | `offering:<id>` | OFFERING_TYPES |
| role | `role:<id>` | ROLES_INFO (else the people roles) |
| word | `term:<key>` | GLOSSARY |

The UI adds `setting:`, `cmd:`, `learn:` and `help:` documents, and modules add their own. Rites carry a live `when`
(the clock decides `active`) and a hidden `layer`. With the `aggadah` setting off, aggadah rites are not returned.
Order: by band (exact › prefix › tokens / substring › skeleton / typo), then by score. Boosts act within a band:
scope ×1.5 (the caller's `boost.kinds`); context: active ×1.3, `near` within 60 m ×1.2, same `zone` ×1.2, recent ×1.1,
together at most ×1.25 (`CONTEXT_CAP` in engine.js).
Lower-level pieces for tests: `engine.js` (`createEngine`, `prepare`, `prepareQuery`, `dl`), `normalize.js`,
`layout.js` (`swapLayout`, `EN_HE`, `HE_EN`), `sources.js`.

## Fix round 1 (review findings)

| Finding | Disposition |
|---|---|
| high — Gamepad B that closes the Menu also cancels the trip | **Fixed** (`src/player/input.js`). Reproduced in `trip.js` part `input` on the pre-fix file: the walk ended 'cancelled' after the hand-over and a held A rose 2.1 m. Now a button or the left stick held across `pad: false → true` is ignored until released. Checked in the app with A's UI and a stubbed Xbox pad (the reviewer's sequence): B goes back from search to Here, B closes the Menu and the walk continues (40 m left), a fresh B stops it. |
| medium — Context boosts swamp the match tier | **Fixed** (`src/search/engine.js`). Reproduced in node with the observer at Nikanor and the rites active (huldah → metzora 1.18 skeleton; altar → six rites 1.25; mouse → "Mothers…" fuzzy 0.84). Now ranking is by band, then score, and the context boosts are capped at ×1.25. In the page at Nikanor, t=d3: huldah → the Chuldah gates, altar → el:altar.body, mouse → the mouse settings, menorah → the menorah, שךאש → zone:kevesh then el:altar.body. zone:mizbeach still ranks in the tokens band for "altar", because its only English "altar" is in "the outer altar". It leads the Places group, and the top result for "altar" is the altar (el:altar.body, the same subject). New fixtures: `CONTEXT` in `src/search/dev/queries.js`, and the whole fixture set re-run in that context in `searchtest.mjs`. |
| medium — Touch taps judged by handler time | **Fixed** (`src/player/input.js`). Reproduced in `trip.js` part `input` on the pre-fix file: a 40 ms tap read after a 400 ms stall gave 0 taps in both zones. Now taps, clicks and the two-finger tap compare event timestamps, the joystick hold counts at most 50 ms per frame, and a hold-shown joystick that never moved still lets a short touch be a tap. `setPointerCapture` is wrapped, because it throws for a pointer that is already up. A real-touch run through CDP from inside the page was inconclusive: the post-boot compiles put the touch events 0.8–6 s apart in event time. |

