# console-inspect — Engineer B: the inspect core (docs/console-design.md §6.2)

`ctx.inspect`: CPU picking of people, animals, crowds, site elements, fires and places; one describer that turns any
subject into card data (person, animal, crowd, object, place, event, offering, term, role); the "see it in action"
director (warp, jump, place, frame, follow, Back); `describe`/`locate` hooks on every choreo module; `pickShape` in
people/; the sourced content in `src/data/objects.js` and `src/data/people-info.js`.

## Choices

- **CPU picking only** — one BVH ray through `ctx.physics.raycast` for the occluder, then the figures' pick solids,
  crowd boxes, element boxes and fires, all on the CPU. No readPixels or id pass: a synchronous GPU query stalls on all
  queued work (CLAUDE.md). — Alternative: a GPU id buffer (exact silhouettes, but a stall per pick).
- **Pick solids from `people/pick.js`** — capsule for standing, kneeling and bowing people; a box along the heading
  for lying figures and stock (bull 2.4×0.8×1.5 m, sheep/goats 1.1×0.45×0.8 m); a sphere for birds. The heights come
  from the role (child 1.2 m, Levite boy 1.45, woman 1.66, man 1.75). — Alternative: skinned-mesh raycast (exact, ~100×
  the cost).
- **Tolerance grows with distance** — each solid is padded by `distance × tolerancePx × 2·tan(fov/2) / height`, so a
  far figure is as easy to hit as a near one.
- **Figure grid** — 8 m cells with numeric keys, rebuilt at 4 Hz, walked along the ray in 4 m steps (3×3 cells per
  step). It is invalidated on `time:jump`, `time:date` and `player:arrived`; otherwise a stale grid missed every figure
  for up to 250 ms after a jump. Crowd boxes are cached per crowd (WeakMap); the canvas rect for 250 ms. Cost: median
  0.12 ms, p95 0.38 ms.
- **Who wins a pick** — a figure wins over an object entered up to 0.5 m nearer, and over any pass-through element
  (fixture, curtain, opening; pri ≤ 2) the ray crosses. Without this rule, gateways swallowed the people seen through
  them. A figure up to 0.25 m behind the occluder still counts (feet on the floor). A chamber is not picked when the hit
  is floor-like: the answer is the place. A fire counts as an object only when `objects.js` has a `fire:<id>` entry.
- **Elements by kind priority** — fixture, curtain, opening, gate, stair, ramp, chamber, slab, wall. Among boxes that
  contain the hit point, the more specific kind wins. Boxes come from site.js, plus the `pickBoxes` in objects.js for
  things site.js has no single element for (the soreg breaches, the amah channel, the shofar chests).
- **The describer loads after `firstFrame`** — `inspect.js` (picker and director, ~12 kB) loads at boot; the describer,
  objects.js, people-info.js and the glossary are a separate chunk loaded in idle time after the first frame (or on the
  first `describe`). Until then `describe()` returns a short card with `loading: true`. Cold boot: `?inspect=0` vs on,
  interleaved, low play 14.0 s vs 13.3 s (noise; the shared machine ranged 13–31 s that afternoon).
- **Not in shot mode** — `tools/shot.mjs` has no UI, so the core is skipped there unless `?inspect=1`; `?inspect=0`
  leaves it out of play mode for boot A/B tests.
- **One hook helper for every module** — `choreo/describe/index.js` `describeWith(spec)`: a module states who each pool
  is and what it does at each event; the helper picks the event (active events with text for the pool first, then the
  next one within 12 min, then a recent one within 8 min) and words "Getting ready — … / On the way — … / Done after:
  …". The helper lives in a subfolder, so the runtime's choreo glob does not load it as a module. Hooks only read state
  and the schedule; the runtime never calls them (no behaviour change). The modules' troupe and set state (`starts`,
  `eps`, sets) is read, never written. — Alternative: hand-written hooks per module (19 copies of the same timing
  logic).
- **Subject keys are stable across time** — `module:pool:sub` (e.g. `tamid-morning:crew:S`), `g1:<group>:<idx>`,
  `offering:<id>#<role>`, `set:<type>:<role>:<n>#<role>`, `<module>:<pool>@<t0>` for troupe episodes. `locate()`
  tries the module's own `locate`, then scans that module's slots by `describe().subjectKey`, then the other modules'
  `locate`. This handles a G5 offering whose walk figure belongs to `courts` (g5-ways) while its rite is staged by
  `private-offerings`.
- **Fallback description** — a figure whose module gives no text reads "Taking part in: <event>" or "Between duties"
  / "Waiting". The tests count those cases (`hookCoverage`): 100% hooked in parts C (2185/2185) and E (3956/3956).
- **Moment rules (§4.1)** — the event is on now: "Watch now", plus "From the start" when more than 1 min has gone. It
  starts within 20 sim min: a warp. Later: a jump. Already over: a rewind, plus "Tomorrow" when tomorrow's day type
  has it. A dynamic instance that is over: "Show me another <type>". During a trip or auto walk the action carries
  `note: 'This stops your walk'`.
- **Warp** — speed `clamp(gap·60/4, 10, 600)`, then an ease over `min(0.5, gap·0.25)` sim min down to a floor of v/8.
  The end is set exactly, landing 0.1 min before the moment so its cues fire in continuous play. Captions are held and
  audio is dipped to 25% (`ctx.audio.setMaster`, restored from settings). The longest warp in the test takes 5.7 s
  (budget 6 s); before the floor, short gaps crawled at 1× for over 8 s.
- **Jump** — `setDate` / `time.set`, then a wait of up to 8 s for that day's plans (`runtime.plans.done`), with the
  note "Preparing that day's service…". The observer is teleported under a fade when more than 20 m from the view or
  without line of sight.
- **Framing** — `setLook` toward the subject's chest (+1.3 m), offset for the free area (`setViewInset`), pitch
  clamped −25…+10°. Follow turns at up to 90°/s for up to 3 min and stops on any look, move or fly `player:intent`.
- **Back** — a snapshot of date, t, speed, pause, feet, heading, pitch and fly mode is taken before the first step of
  a show. `back()` restores it; `backLabel` reads "Back to HH:MM at <short zone name>". The show handle's `label` is the
  subject alone, so the bar does not read "Showing: Showing …".
- **Content only from the research** — every purpose, use, note, attire and "who" text in objects.js and
  people-info.js carries `sources`. I checked them against `../report/parts` and the Hebrew in `../sources` (spelling
  folded for plene/defective). An element with nothing sourced has `purpose: null` (kiponus-approach), and the card
  shows less. Placement that is the model's own is marked `confidence: 'reconstruction'` with "Its place is the
  model's."
- **Reconstruction flags** — the Levites' dress (`LEVITE_DRESS`), the stoa teachers, the attendants' posts and the
  Levites of the Golah are flagged as reconstruction: the sources give their office, not their look or exact place.
- **Named offices** — Gevini (the crier) and Ben Arza (the cymbal) are the names the Mishnah gives to the officers of
  one generation (Shekalim 5:1; Tamid 7:3; Yoma 20b). The texts use them as the office the Mishnah names; they do not
  present them as the persons on duty in the model's day.
- **North/south chambers** — the printed Mishnah (Middot 5:3–4) swaps two of the courtyard chambers between north and
  south. Yoma 19a and the Rambam (BhB 5:17), whom the model follows, place them the other way. The cards state both.
- **Citation fixes found while checking** — KhM 8:16–19 (not 8:16); the Levite boys follow R' Eliezer ben Yaakov
  (Arachin 2:6); the kaf's cover is "a kind of cloth"; the mizrak cites Shemot 27:3 and the basins of Pesachim 5:5; the
  ma'arachah logs also cite Yoma 22a.
- **`people/index.js`: two lines** — the import and `pickShape` in `ctx.people`. §6.0 allows one line; the property
  needs the import too.

## Verification

- `node src/sim/dev/tests/objects-check.mjs`: ok. 146 objects, all 117 required elements present (116 with a sourced
  purpose), 167 `inAction` links to real events, 80 aliases, 22 roles, 9 animals, 99 props.
- `node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/inspect.js "t=d3&inspect=1"`:
  - A, cost: median 0.12 ms, p95 0.38 ms.
  - B, picks: every visible figure in 6 event views is found.
  - C, coverage: 100% hooked, 7 times × 3 day types.
  - D: cards of every kind; describing a figure takes 0.10 ms.
  - E (`ip=E`): every event's figures: 3956 described, 0 unhooked, 0 threw.
- `src/sim/dev/tests/inspect-show.js "t=d3&inspect=1&sn=10"`:
  - now: max 181 ms.
  - warp: max 5730 ms.
  - jump-later: 209 ms.
  - rewind: 198 ms.
  - tomorrow: 1731 ms.
  - All shows framed and every Back restored. Inset yaw error: 2.2°, 0.2° and 1.0°.
- `tools/warmup-check.mjs --tiers low --modes shot,play`: pass. `npx vite build`: pass, with inspect, inspect-describe
  and objects in separate chunks.
- Play mode (`--keep-ui`): Show-me framed the slaughterer; `pickCenter()` returned `actor:tamid-morning:crew:0`
  (`shots/console-inspect/inspect-showme-framed.png`).

## Fix round (console review)

Each finding was reproduced with a probe through `src/sim/dev/run.mjs`, fixed and checked again. Shots are in
`shots/console-inspect-fix/`.

| # | Finding | Disposition |
|---|---|---|
| 1 | Show me framed empty floor or a wall when the subject was not there yet | **Fixed.** (a) "From the start" for a troupe figure lands at the figure's own episode start (`…@t0` in its key), and for an offering figure at its track start, plus 0.2 min. The mother at Nikanor now lands at 08:19, not 07:51, with the figure found (0.05° off). (b) After the clock changes, the director asks for the figure's key for up to 0.6 s (0.2 s in `now` mode). It then frames the event at chest height, and keeps looking for 20 s while showing. When the figure appears, it frames it and starts follow. A look or move input stops this. (c) "Show me one" / "another" picks a live instance at a station in the courts. Otherwise it picks the next step in the courts, never the `arrive` walk on the Mount, and lands 0.2 min inside that step. (d) When the eye has no line of sight after the clock change, the director re-reads a dynamic event's `viewOf` at the new time (`watchPoint` stand), checks line of sight from it, and moves there. (e) If the stand-in point lies under the observer's own feet (an event not yet staged, whose place is its stand), the director keeps the view's heading and levels the pitch instead of looking at the floor. `ShowHandle.framedOn` says what was framed: `subject`, `focus` or `event`. |
| 2 | Figure labels were whole sentences | **Fixed.** `shortLabel(title, doing)` gives "Role · doing", ≤ 40 chars: the first clause, with parentheses removed, cut at a word, and a leading verb in lower case. `nearby()` uses it. `pick`, `pickCenter` and `hover` relabel figure hits and their alternatives through `describer.labelOf(ref)`, cached per figure for 1 s and cleared on a jump. Nearby at d3: 28 figures, max 39 chars. The card's NOW keeps the long text. Pick cost after the change: median 0.1 ms, p95 0.22 ms. |
| 3 | NOW read "In 0 min" after a warp | **Fixed.** Under 1 min, it reads "Starting now (≈09:48)", and "starting now" in Next here. |
| 4 | An individual's offering that is over offered "Tomorrow" into Shabbat | **Fixed.** `describeActor` treats `offering:`/`set:` ids as dynamic: `tomorrow: false`, and no `dayTypes` from a missing event. When the step is over, it passes `another` (the next instance of the type via `watchMoment`), keyed to the same role when that instance has one (`offering:<id>#KB`). With none, it rewinds to the figure's own track start. Friday d6 g5-kohen:3 → "Show me another chatat ha'of (≈ in 2 min)", which finds the next bird kohen (0.13° off). `inspect-show.js` checks 667 Friday actions: none goes to another date. |
| 5 | Kohen Gadol shown holding a פרוסה | **Fixed in the card; choreo not changed.** `PROPS_INFO.bread_piece` now says the Kohen Gadol takes whole loaves, never a piece (Yoma 17b; Rambam TuM 4:14, checked on Sefaria: "ואין כהן גדול נוטל פרס"). The typo "kohan's" is fixed. A role-specific entry `bread_piece:kohen_gadol` ("From his own loaves") is what his card shows: he is given whole loaves and eats from them. The describer looks up `${prop}:${role}` first. The kg-kohanim's NOW is split: "Bringing the Kohen Gadol his loaves" (the two bearers, before `kg.t.take`), then "Eating with the Kohen Gadol in the court, from his loaves". Changing his prop to whole loaves in hand needs a one-loaf prop with palm grips in `people/props.js` (not owned here): see requests. |
| 6 | Segan text misread Tamid 7:3 | **Fixed:** "is at his right; at the middle of the ramp he takes him by his right hand and brings him up" (local Mishnah Tamid 7:3). |
| 7 | Water Gate Show me framed a dark gatehouse; labels stated a reconstruction as fact | **Fixed.** When an object's event is staged away from the object (> 8 m across or > 3 m up), or its `inAction` entry says `focus: 'event'`, the action has no element focus. The director frames the event from the event's own view: the Water Gate roof stand; the trumpeters come into frame as they arrive, 0.3 min in. Labels: '"Barkai!" — the watcher (shown on its roof; where he stood is not recorded)', 'Friday: the blasts to stop work (shown from its roof)'. The trumpeters' hook text says the roof is the model's. |
| 8 | Measures contradicted the sourced text | **Fixed.** `OBJECTS[id].measures` overrides the box: the altar 32 / 30 / 24 amot (Middot 3:1) and 10 high with the horns (Rambam BhB 2:5–6, checked on Sefaria); the four Ezrat Nashim chambers 40 per side (Middot 2:5); the sovev 1 wide, 6 above the ground (Middot 3:1); the soreg 1.67 high, ten tefachim (Middot 2:3). Box-derived rows are labelled "(model, outer)". None are shown for wall, slab, floor or ledge kinds, boxes over 120 amot, or heights under 0.05. |
| 9 | Yoledet's olah shown with a man as owner | **Fixed** in `describe/tracks.js`: for a yoledet set, a man in the owner role reads "her husband or agent, bringing a mother's burnt-offering for her", and NOW reads "Bringing a mother's burnt-offering up from the city, for her". This matches the plan's own text ("her husband or agent leads the lamb in"). |
| 10 | Ish Har HaBayit greeting attributed against the cited Rambam | **Fixed:** both readings are given, as the schedule's own description does. The Mishnah can be read that he says it to a guard not standing; the Rambam (BhB 8:10) reads that a guard who does not stand and say "Ish Har HaBayit, shalom alecha" is asleep. Bartenura is **not** cited: on Sefaria his comment on 1:2 glosses only "Ish Har HaBayit", so the reading attributed to him could not be verified. The night-watch caption (a choreo cue, not mine) still has the officer say it: see requests. |
| 11 | Minor slips | **Fixed.** (1) The KB phrase is used only at bird offerings, and the KM phrase only at meal-offerings; otherwise "a kohen at the bikkurim". (2) In a step that is the owner's alone (FOCUS `['O']`: takeout, aliyah, hanachah), a kohen reads "a kohen at the todah". `FOCUS` is now exported from `g5/dynamic.js` (export only). (3) The keri slot reads "one of the kohanim asleep in Beit HaMoked" until mesibah-keri starts. (4) he: 'דיין בסנהדרי גדולה'. (5) "Of children, the Mishnah exempts … only". (6) The flask text cites Sukkah 4:9 only. |
| 12 | A second Show me during a warp left the clock at warp speed after Back | **Fixed.** A show still on its way is marked `superseded`: it stops where it is without restoring. The new show waits for it to settle (capped at 3 s) and inherits its **original** Return snapshot (`h.snap`). `back()` during a running show supersedes it, waits, then restores. Every `ctx.ui.fade` await is raced against its time + 0.7 s, and frame waits are capped, so the director cannot hang. New `inspect-show.js` cases: warp+warp at 1.5 s, warp+warp at 0.15 s, and warp+jump. Back restores t ±0.01, speed and pause in all three. |
| 13 | Show me around midnight landed on the wrong night or day | **Fixed.** Moments carry a date. In progress and started before midnight → "From the start" on date − 1. A start after midnight within 20 min → a warp onto date + 1 ("Skip ahead 10 min"). The director measures warp gaps across dates (`minutesBetween`), and lands at `t − 0.1` on date − 1 when that crosses midnight. A long frame that overshoots a landing just before midnight sets the date back. Cases at 23:50 and 00:10 are in `inspect-show.js`. |

Verification after the fixes:

- `inspect-show.js "t=d3&inspect=1&sn=10"`: 0 failures.
  - now ≤ 317 ms; warp ≤ 5.0 s; jump-later ≤ 123 ms; rewind ≤ 137 ms; tomorrow ≤ 806 ms.
  - Every Back is exact.
  - Inset yaw is 0.19° and 0.04°.
  - The overlap, midnight and Friday cases all pass.
- `inspect.js "t=d3&inspect=1"`: 0 failures (pick median 0.1 ms, p95 0.22 ms).
- `ip=C,E`: 2185/2185 hooked; 3956 figures described, 0 unhooked, 0 threw.
- `objects-check.mjs`: ok.
- `npx vite build`: ok.
- `warmup-check --tiers low --modes play`: PASS, firstFrame 13.6 s.

## API

### `ctx.inspect` (src/sim/inspect.js)

Present when not in shot mode (or `?inspect=1`), absent with `?inspect=0`. Feature-detect it.

```
pick(clientX, clientY, { tolerancePx = 8, maxDist = 150 }?) -> Hit | null   figure hits carry the short label 'Role · doing' (≤ 40)
pickCenter(opts?) -> Hit | null              at the centre of the free area (the reticle)
hover(clientX, clientY) -> { ref, label, kind } | null      ≤ 10 Hz; a pointer resting within 2 px keeps its answer
describe(subject, t = ctx.time.t) -> Card    subject: a Hit, { kind, id } or 'kind:id'
anchorOf(ref) -> Vector3 | null              a live world point (feet / base centre) for rings and framing
nearby(r = 15, { limit = 12 }?) -> NearbyItem[]   figures, crowds and objects near the observer, nearest first
thingsIn(zoneId) -> ThingItem[]              the objects with content in a place
setViewInset({ left, right, top, bottom }); viewInset   the console's free area, px from each edge
frame(subject, { ms = 400 }?) -> Promise     turn the view to the subject (free-area centre)
follow(subject | null)                       keep turning toward it until look / move / fly input
seeInAction(action) -> ShowHandle            run a card's see-in-action action
run(steps, { label }?) -> ShowHandle         director steps: { go }, { time }, { frame }, { say }, { wait }, { follow }
show                                         the current ShowHandle or null
back(); canBack; backLabel                   restore the snapshot taken before the last show
ready: Promise; load()                       the describer chunk (after 'firstFrame'; load() forces it)
picker, describer                            the parts (tests / debug); describer.labelOf(ref) -> {en} (the short label),
                                             describer.heightOf(ref) -> m (an element's height, for framing its middle)
```

Bus: `inspect:show` `{ id, phase, mode, progress?, label:{en} }` at each phase, ≤ 4 Hz while warping.

### Refs

`actor:<choreo>:<pool>:<index>`, `crowd:<choreo>:<ci>`, `el:<siteElementId>`, `fire:<id>`, `zone:<id>`,
`event:<id>` (dynamic too: `offering:…`, `set:…`), `offering:<type>` (offering type), `term:<glossary id>`,
`role:<roles.js id>`.

### Hit

`{ ref, kind: 'person'|'animal'|'object'|'place', crowd?, label:{en}, distance, world: Vector3, at:[X,Y,Z] (amot),
zone, screen:{x,y}, alternatives?: Hit[] (≤ 4 nearby figures) }`

### Card

```
{ ref:{kind,id}, kind, crowd?, title:{en,he?}, translit?, subtitle?, what?:{en,sources?},
  now?: { text:{en}, eventId?, step?, progress?, until? }     ("Out of sight" when the figure is not shown)
  why?: { en, sources },  who?: { en, sources }, holding?: [{ id, title, what }],
  sections: [{ id, title:{en}, text?, items?: [{ ref, title, when?, progress? }], sources? }],
  related: [{ ref, title, kind }], actions: Action[], sources: string[],
  confidence?: 'explicit'|'ordering'|'reconstruction', confidenceNote?,
  subjectKey?, choreo?, hooked?: boolean, loading?: true, window?: { t0, t1 } }
```

Section ids used: `about`, `access` (with `lead`), `aka`, `attire`, `avnet`, `frequency`, `happening`, `instances`,
`model`, `next`, `notes`, `occasional`, `occasions`, `offerings`, `rite`, `sanctity`, `seen`, `services`, `steps`,
`storeys`, `things`, `timing`, `use`, `where`, `who`. The UI's Here section renders `happening`, `next`, `things` and
`nearby` itself and skips those.

### Action

`{ id, kind, label:{en}, primary?, note?:{en} }` plus, by kind:

- `see-in-action`: `mode: 'now'|'warp'|'jump'`, `t`, `date`, `eventId?`, `focus?`, `view?`, `follow`, `subjectKey?`,
  `choreo?` and `what:{en}`. Pass it to `seeInAction`.
- `go`: `target: { at:[X,Y,Z], heading? }`, `goLabel`. "Go closer" stands 3 m from the subject, toward the observer.
- `follow`: `ref`.
- `map`: `zone?`, `at?`, `eventId?`.
- `learn`: `ref` (term or role).
- `time`: `tSet`, `eventId` ("Set clock to start").
- `another`: a see-in-action for the next instance of a dynamic kind.

`momentActions(ctx, spec, t)` (inspect-show.js) builds the see-in-action set for any window
`{ t0, t1, what, eventId?, view?, follow?, subjectKey?, choreo?, dayTypes?, tomorrow? (false: never), stepT0?, another? }`.
Actions carry their `date`: "From the start" of a window begun before midnight is on the previous date; a start just
after midnight within 20 min is a `warp` onto the next date. `minutesBetween(dateA, tA, dateB, tB)` is exported too.
`shortDoing(text, max)` and `shortLabel(title, doing)` (inspect-describe.js) make the short labels.

### ShowHandle

`{ id, action, mode: 'now'|'warp'|'jump'|'run', label:{en} (the subject alone), phase:
'placing'|'warping'|'jumping'|'framing'|'showing'|'done'|'cancelled'|'failed', from, target, progress (0..1), etaReal (s),
skip(), cancel(), done: Promise, framedOn: 'subject'|'focus'|'event'|null, snap }`. `cancel()` restores the snapshot, as
`back()` does. A second `seeInAction` while one is still on its way supersedes it (it stops without restoring) and keeps
its Return snapshot; `back()` during a running show stops it first. A figure not found at the landing (`framedOn`
'event') is looked for 20 s more and framed (and followed) when it comes.

### Choreo hooks (every module in src/sim/choreo/)

```
describe(ctx, state, who, t, sim) -> { doing:{en}, phrase?:{en}, eventId?, step?, why?:{en,sources}, subjectKey,
                                  next?:{ t, label, step } } | null
    who = { kind:'person'|'animal', poolName, index, slot, role?, animal?, crowd? }
locate(ctx, state, subjectKey, t, sim) -> { slot } | { at:[X,Y,Z] } | null
```

Hooks read only; the runtime never calls them. Build them with `describeWith(spec)` from
`src/sim/choreo/describe/index.js` (spec documented in its header). The helpers are `textOf`, `poolsIn`,
`whoOfSlot` and `pickEvent`. The libraries are `describe/tracks.js` (G5 tracks: `describeTrack`, `trackAt`,
`stepAt`), `tamid.js`, `dawn.js`, `sanctuary.js` and `courts.js` (troupes and sets: `troupeKey`, `describeSet`,
`locateSet`).

### `ctx.people.pickShape(kindOrRole, poseName, scale = 1)` (src/people/pick.js)

`{ type:'capsule', r, h } | { type:'box', len, wid, h, off } | { type:'sphere', r, y }`, in metres in the figure's
local frame (box along the heading).

### src/data/objects.js

`OBJECTS[id]`, keyed by site element id, `fire:<id>` or a free id with its own `pickBox`:

```
{ title:{en,he?}, aka?:[…], purpose:{en,sources}|null, use?:{en,sources}, notes?:{en,sources}, glossary?,
  inAction?:[{ event, label:{en} }], zone?|zones?, aliases?:[elementIds], confidence?, confidenceNote?,
  pick?: false, pickBox?: { min:[X,Y,Z], max:[X,Y,Z] }, pickBoxes?: [{ min, max }],   (site amot; computed from SITE at load)
  measures?: [{ label:{en}, amot, confidence?, sources }] }   sourced figures; they replace the box-derived rows
```

`inAction[i].focus`: `'event'` frames the event (where it is staged) rather than the object, `'element'` the object.
Without it, an event staged > 8 m across or > 3 m above the object's base is framed as the event. Box-derived
measures are labelled "(model, outer)" and left out for walls, slabs, floors, ledges and site-spanning boxes.

`ALIASES[elementId] -> objectId`: parts that share one entry (a door to its chamber, a screen to its mikveh).

### src/data/people-info.js

- `ROLES_INFO[role]`: `{ title:{en,he}, who:{en,sources}, attire:{en,sources,confidence?} }`.
- `ROLE_PARTICIPANTS[role]`: the event participant names that match the role.
- `ANIMALS_INFO[kind]`: `{ title, what, glossary? }`.
- `PROPS_INFO[propName]`: `{ title, glossary?, what:{en,sources}|null }`. `PROPS_INFO['<prop>:<role>']` wins for that
  role (the Kohen Gadol's `bread_piece:kohen_gadol`).

### Tests

- `node src/sim/dev/tests/objects-check.mjs`: content and coverage.
- `node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/inspect.js "t=d3&inspect=1[&ip=ABCDE]"`: pick cost,
  picks in event views, hook coverage, cards, every event's figures.
- `… --script src/sim/dev/tests/inspect-show.js "t=d3&inspect=1&sn=10"`: the director's modes, budgets, framing,
  Back and inset; overlapping shows (Back exact); moments around midnight; no Friday individual's offering offers
  another date.
