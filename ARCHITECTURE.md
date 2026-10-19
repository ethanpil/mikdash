# Mikdash — architecture & contracts

An immersive, browser-based (three.js r186, WebGLRenderer) walk through Har HaBayit and the Second Temple
in its final (Herodian) form, following the daily service hour by hour. **Accuracy to the research drives
every decision.** Read this whole file before touching code.

## 0. Authority of sources (READ FIRST)

| Use as AUTHORITY | Use ONLY as a cross-check / sample (never as a source of truth) |
|---|---|
| `../report/parts/*.md` — the research text (35k words). Especially §0 (conventions, master dimensions, elevation ladder), Parts I–V (architecture), VII (materials), VIII (living Temple), IX, X, **XI (locked decisions — the build baseline)**, XII (access & services), XIII (days in the life), XIV (final corrections). | `../engine/temple_manifest.json` + `build_manifest.py` (a code-generated sample layout) |
| `../sources/*.txt` — Hebrew primary texts (Middot, Tamid, Shekalim, Parah, Rambam Beit HaBechirah, Yoma, Zevachim, Ezra) for checking any claim | `../diagrams/*` (sample drawings, incl. sheet 10 ritual-clock design) |
| | `../video/VIDEO_NARRATION.md` (sample script) |

Rules: (1) Geometry comes from `src/data/site.js`, which is derived from the report's dimension chains and
locks — never copy coordinates from the manifest or diagrams. (2) Anything the sources do not fix (exact
clock minutes, footprints marked unsourced, decorative detail, faces, city massing) is **reconstruction**:
allowed, but labeled `confidence: 'reconstruction'` in data and kept modest and consistent with §20/§25 of the
report (e.g. NO battlements/arrow loops/blind arcades; NO First-Temple imports like Yachin & Boaz; NO
Yechezkel 40–48 features beyond what the Mishnah imports; NO visible divine fire/glow — Second Temple, §32;
Kalya orev is an iron blade, NOT gold spikes). (3) Never use non-traditional or Christian reconstructions.
(4) Log every non-obvious reconstruction choice you make in `docs/decisions/<your-task>.md`
(one bullet: choice — why — what the alternative would be).

## 1. Frames & units (src/core/units.js)

* **Site frame** (all data files): X = east, Y = north, Z = up, in **amot**. Origin = SW corner of the
  500×500 clear interior of Har HaBayit. Z = 0 = threshold of the eastern gate of Har HaBayit.
  Elevation ladder (§0.4): Mount 0 · Ezrat Nashim +6 · Ezrat Yisrael +13.5 · Azarah +16 · Heichal floor +22 · crown +116.
* **World frame** (three.js): meters; +x east, +y up, −z north. `m2w(X,Y,Z)`, `w2m(v)`, `a(amot)`, `tf(tefachim)`,
  `boxToWorld(min,max)`. `AMAH` = 0.48 m default (R' Chaim Naeh); `?amah=feinstein|chazonish`.
* Headings are compass degrees: 0 N, 90 E, 180 S, 270 W. `headingToYaw`, `headingDir`.

## 2. Ownership (one task owns each path; do not edit files you don't own)

| Path | Owner task |
|---|---|
| `src/core/*`, `src/main.js`, `src/systems.js`, `src/world/index.js`, `src/world/geom.js`, `index.html`, `vite.config.js`, `tools/shot.mjs`, `ARCHITECTURE.md` | orchestrator (ask in your final report if you need a change) |
| `src/data/site.js` (+ `docs/site-model.md`) | site-model |
| `src/data/schedule.js`, `src/data/zones-content.js`, `src/data/glossary.js` | schedule-data |
| `src/world/materials/**` | materials |
| `src/world/terrain/**`, `src/world/mount/**` | build-mount (terrain, Mount walls/gates/stoas, soreg, chel, causeway, city context) |
| `src/world/courts/**` | build-courts (Ezrat Nashim, 15 steps, Nikanor, Azarah walls/gates/chambers, Beit HaMoked, underground) |
| `src/world/altar/**` | build-altar (Mizbeach, kevesh, kiyor, slaughter zone, duchan, Ulam steps) |
| `src/world/heichal/**` | build-heichal (Ulam, Heichal, Kodesh, vessels, parochot, KhK, ta'im, roof) |
| `src/time/**`, `src/env/**` | time-env |
| `src/render/**` (+ may refine `autoDetect` via a function exported from `src/render/`) | render |
| `src/player/**` | player |
| `src/people/**` | people |
| `src/sim/**` | sim |
| `src/audio/**` | audio |
| `src/ui/**` | ui |
| `docs/decisions/<task>.md` | each task its own file |

No new npm dependencies without stating why in your report (installed: three, three-mesh-bvh, postprocessing,
n8ao, vite, playwright-core). **No downloaded assets** (textures, models, sounds, HDRIs): everything is
procedural/generated at runtime — this keeps the page tiny, license-clean and fast.
Google Fonts may be linked from index.html via the orchestrator (request it).

## 3. Boot & the shared context

`main.js`: Engine → `createContext` → `buildWorld(ctx)` (materials, then builders in order terrain, mount,
courts, altar, heichal) → systems in order **time, env, render, player, people, sim, audio, ui**, each
`export async function init(ctx)` → `ctx.bus.emit('ready')` → loop. Per-frame work:
`ctx.engine.onUpdate((dt, ctx) => …, PRIORITY.x)` (time 0, sim 10, people 20, player 30, env 40, fx 50,
audio 60, ui 70, render 100). Global for debugging: `window.__mikdash` (= ctx).

`ctx` fields (filled by owners): `engine renderer scene camera params quality units bus site el(id) elOpt(id)
colliders addCollider anchors addAnchor fires addFire mats time env fx post physics nav player people zones
schedule audio ui settings world`.

Bus events: `ready`, `time:jump` (t), `time:date` ({date}), `zone:change` ({zone, prev}), `player:arrived`
({target}), `settings:change` ({key, value}), `quality:change`, `ui:goto` ({target, speed}),
`audio:unlock`, `build:error`.

## 4. Site model — `src/data/site.js` (site-model task)

```js
export const SITE = {
  meta: { frame, amah: 'building amah = 6 tefachim', sources, generatedFrom: 'report parts …' },
  datums: { mount: 0, ezratNashim: 6, ezratYisrael: 13.5, azarah: 16, heichalFloor: 22, crown: 116 },
  axisY,                 // N–S coordinate of the east–west Temple axis
  elements: {            // id -> element
    'azarah.wall.north': {
      id, name: { en, he }, kind: 'wall'|'floor'|'gate'|'opening'|'stair'|'ramp'|'zone'|'fixture'|'slab'|'curtain'|'chamber',
      box: { min: [X,Y,Z], max: [X,Y,Z] },   // amot, axis-aligned, when meaningful
      params: { … },                          // kind-specific: steps/rise/tread/direction, radius, door count, etc.
      sources: ['Middot 2:6', …],             // the research citations for the numbers
      confidence: 'explicit'|'derived'|'locked'|'reconstruction',
      notes,
    }, …
  },
  zones: { [zoneId]: { boxes: [[min,max], …], priority, floorZ } },  // geometry of named places (see §8)
  chains: [ { name, axis: 'X'|'Y'|'Z', parts: [{ label, amot, source }], total, expected, ok } ],
};
export function el(id) …;  export function zoneGeometry(id) …;
```
Every number is built from named constants with citations (like a parametric builder), self-checked
against the Mishnaic chains (Middot 5:1–2, 4:6–7, 2:5–6, 3:1, 3:6 …) and the Part XI placement locks.
`docs/site-model.md` lists every element, its derivation, and every difference found vs the sample manifest.

## 5. World builders — `src/world/<area>/index.js`

`export async function build(ctx) → Object3D|null`. Rules:
* Read positions/dimensions ONLY from `ctx.site` (`ctx.el(id)`); read the report for form, materials, detail.
* Static geometry → `StaticBatcher` (src/world/geom.js): one merged mesh per material; colliders are
  registered automatically for batched geometry (`collide:false` for decorative/overhead bits; stairs should
  get a smooth ramp collider via `ctx.addCollider(geo, tag)` and `collide:false` on the step treads, or keep
  treads as colliders — the player handles 0.35 m step-up).
* Materials by key from `ctx.mats.get(key)` (keys in `src/world/materials/index.js`; ask materials to add).
  World-scaled UVs (1 UV = 1 m) — `applyWorldUV`, `siteBoxGeometry`.
* Detail by `ctx.quality.detail` (0 low … 3 ultra): e.g. capitals/moldings/drafted margins/relief only ≥1;
  instancing for repeated elements (columns, rings, steps).
* Budgets (whole world): ≤ 350 draw calls at detail 0, ≤ 900 at 3; ≤ 1.5 M triangles at detail 0, ≤ 6 M at 3.
* Register **anchors** for important points (`ctx.addAnchor('altar.top', { pos: [X,Y,Z], heading, label })`)
  and **fires/lamps** (`ctx.addFire({ id, kind, pos, size, schedule })`) — the render task turns fires into
  flames + lights. Movable parts the sim animates (gates' doors, curtains, the kiyor rising on the muchni,
  menorah lamps) must be separate named Object3Ds, registered as `ctx.movables.set(id, object)`.
* The mount builder registers anchor `start`: at the foot of the outer (Chel) steps on the east axis,
  facing west — the default spawn ("slightly before dawn at the outer steps leading into the Temple").

## 6. Time — `src/time/` (time-env task)

```js
ctx.time = {
  t,                 // minutes since local midnight, Israel Standard Time (UTC+2), cyclic [0,1440)
  speed, paused,     // speed = sim-seconds per real-second (1 = real time)
  date: { y, m, d }, weekday /*0=Sun*/, hebrew: { day, month, monthName, year, he },
  dayType,           // 'weekday' | 'friday' | 'shabbat'  (festivals: future)
  zmanim: { alot, sunrise, chatzot, minchaGedola, minchaKetana, plagHamincha, sunset, tzeit, midnight,
            shaahDay, shaahNight },   // minutes; GRA hours (sunrise→sunset; sunset→sunrise), alot = sun −16.1°
  set(t), setDate('YYYY-MM-DD'), setSpeed(n), pause(bool),
  toZmani(t) -> { half: 'day'|'night', hour /*0..12 fractional*/, label },
  fromZmani(half, hour) -> t,
  resolve(spec) -> t,  // spec: { at: 'alot'|'sunrise'|'sunset'|…, offset /*min*/ } | { dayHour: 8.5 } | { nightHour: 11 } | { clock: 'HH:MM' }
  parse(str) -> t,     // URL ?t= forms (see core/params.js)
  sun: { altitude, azimuth /*deg*/, dir /*world unit Vector3 toward sun*/ }, moon: { altitude, azimuth, dir, phase, illumination },
};
```
Default date **2026-11-02** (Monday, 22 Cheshvan — ordinary weekday, psalm 48); default time
**slightly before dawn** (alot − 6 min) unless `?t=`. Jerusalem 31.7780 N, 35.2354 E.

## 7. Environment & render

* **env** (time-env task): physically based sky (sunrise/twilight/night correct), sun + moon (phase) + stars,
  directional sun/moon light, sky/ground ambient, PMREM environment map refreshed as the sun moves (gold and
  marble need it), aerial-perspective fog. `ctx.env = { sunLight, moonLight, envMap, update(), skyColorAt(dir) }`.
* **render** (render task): tiered pipeline (`ctx.quality`): tone mapping, SMAA, bloom (fires/gold glints),
  AO (N8AO) on high+, shadows (cascaded on high+), adaptive resolution to hold frame rate, optional god-rays
  on ultra. **FX**: `ctx.fx` turns `ctx.fires` into flames/glow/smoke + a budgeted set of real lights
  (`quality.maxFireLights`, nearest to camera win); also `ctx.fx.attachTorch(object3D) -> handle`,
  `ctx.fx.smokeColumn({pos, …})` (altar & incense smoke rise **straight up** — Avot 5:5),
  `ctx.fx.setFire(id, intensity)`. Optional **Photo mode** (path-traced still) may be added later.

## 8. Zones — geometry in `site.zones`, content in `src/data/zones-content.js`

Canonical zone ids (both tasks must use these; may add sub-zones):
`outside, kidron, har-hamishchah, parah-causeway, har-habayit, stoa, chel, soreg, gate-shushan, gate-chuldah-w,
gate-chuldah-e, gate-kiponus, gate-tadi, ezrat-nashim, en-gate-east, en-chamber-wood, en-chamber-lepers,
en-chamber-nazirites, en-chamber-oil, en-gallery, fifteen-steps, music-chambers, nikanor, ezrat-yisrael,
ezrat-kohanim, azarah, mizbeach, kevesh, slaughter-zone, bein-haulam-lamizbeach, kiyor, ulam-steps, ulam,
beit-hachalifot, heichal, amah-traksin, kodesh-hakodashim, taim, mesibah, aliyah, roof, gazit, golah,
etz-parhedrin, melach, parvah, medichin, beit-hamoked, underground-passage, beit-hatevilah, beit-avtinas,
beit-hanitzotz, gate-delek, gate-bechorot, gate-mayim, gate-nitzotz, gate-korban, gate-moked`.

`zones-content.js`: `export const ZONE_CONTENT = { [id]: { name: {en, he, translit}, sanctity /*0..10, §0.5*/,
access /*who may enter (Part XII §59)*/, services: [ … ] /*§60*/, description, sources: [ … ],
stand: [X,Y] /*good observer spot*/ } }`. Runtime: `ctx.zones = { current, at(worldPos) -> zone, list }`
(smallest/highest-priority containing box wins), emits `zone:change`.

## 9. Schedule & simulation — `src/data/schedule.js` + `src/sim/`

```js
export const EVENTS = [{
  id: 'tamid-morning-slaughter',
  title: { en, he },
  dayTypes: ['weekday','friday','shabbat'],        // omit = all
  when: { start: <time spec>, end: <time spec> },  // see ctx.time.resolve; ordering is sourced, minutes are reconstruction
  timing: { confidence: 'explicit'|'ordering'|'reconstruction', note },
  zone: 'slaughter-zone',
  pos: [X, Y, Z],                                   // where it happens (site amot)
  view: { at: [X, Y], heading },                    // where an observer should stand to watch it
  summary,                                          // one line for the "happening now" list
  description,                                      // 1–3 short paragraphs, plain English, Hebrew terms transliterated
  participants: [{ role: 'kohen', count: 9, note }],
  sources: ['Tamid 3:9', …],
  sounds: ['shofar-...'],                           // cue ids (see §11)
  choreo: 'tamid-morning',                          // sim module id (several events may share one)
  importance: 1|2|3,                                // 3 = headline
  layer: 'halachic'|'ritual'|'aggadah',             // §36.2
}];
```
**Determinism:** everything the sim shows is a pure function of `(ctx.time.t, date)`; jumping the clock
re-poses every actor instantly (no accumulated state). Sound cues fire only when time passes a cue moment
during continuous play. Choreography modules: `src/sim/choreo/<id>.js` exporting
`{ id, init(ctx, events) -> state, update(ctx, state, t, dt) }`. `ctx.schedule = { events, active(t),
upcoming(t, n), at(zoneId, t), resolveTimes() }`.

## 10. People — `src/people/` (people task)

`ctx.people.spawn({ role, seed }) -> Actor` with roles `kohen, kohen_gadol, kohen_gadol_white, segan, levi,
levi_boy, israelite, woman, elder, sanhedrin, guard_levi, nazir, child` and animals via
`ctx.people.spawnAnimal('lamb'|'ram'|'bull'|'goat'|'dove')`.
Actor: `setSite(X,Y,Z?)` (Z omitted → floor via `ctx.physics.floorAt`), `setPosition(vec3)`, `setHeading(deg)`,
`setPose(name, phase)`, `setProp(name|null, hand)`, `setVisible(bool)`, `dispose()`.
Poses: `stand walk run carry carry_shoulder prostrate bow kneel sing play_kinnor play_nevel play_cymbal
blow_trumpet blow_shofar raise_hands pour throw sprinkle sleep lie sit torch slaughter sweep circle_lot
point`. Props: `torch trumpet kinnor nevel cymbal chalil machtah_silver machtah_gold teni kuz kaf bazach
mizrak_gold mizrak_silver knife limb lamb_carcass log keys flask scroll sudar basket magrefah bowl lot`.
`ctx.people.crowd({ roles, count, region: {min:[X,Y], max:[X,Y]} | points, pose, heading, seed }) ->
{ setPose(name, phase), setVisible, setCount }` — GPU-instanced, cheap. Budget: `quality.maxFigures`.
Costume rules: report Part VIII §34 (kohanim: four white linen garments, barefoot; KG: eight garments;
Levites: no Mishnaic uniform — keep plain and flag).

## 11. Audio — `src/audio/` (audio task)

Procedural WebAudio only. `ctx.audio = { unlock(), cue(id, worldPos?, opts), loop(id, worldPos?, opts) ->
{ setGain, stop, setPosition }, setMaster(v) }`. Cue ids: `trumpet-tekiah trumpet-teruah gate-boom
great-gate-open magrefah muchni knock barkai gevini shalom-call cymbal choir-psalm kinnor nevel chalil bells
grinder-chant sheep doves crowd-prostrate footsteps keys`. Loops: `fire torch water-channel crowd-murmur
wind doves sheep night-insects choir`. Spatialized (HRTF on high, equalpower otherwise), distance-attenuated.

## 12. Player — `src/player/` (player task)

First-person walking: keyboard (WASD/arrows, Shift run, F fly, Space up in fly), mouse look (pointer lock),
touch (left joystick + drag look), gamepad optional. Capsule collision vs a BVH of `ctx.colliders`
(three-mesh-bvh); gravity; step-up 0.35 m; observer may walk ANYWHERE (incl. restricted zones — the UI informs).
`ctx.physics = { floorAt(x, z, fromY?), raycast(origin, dir, far) }`; `ctx.nav = { findPath(fromWorld, toWorld) }`
(grid A* sampled from colliders, multi-level aware); `ctx.player = { position, heading, pitch, mode,
goTo(target, speed) -> Promise, cancel() }` where target = `{ at:[X,Y], heading? }` | anchor name | Vector3
and speed ∈ `instant slow walk fast run` (instant = teleport; others walk the path at 0.8/1.4/2.4/4.5 m/s).

## 13. UI — `src/ui/` (ui task)

HUD: location name (he + en) + sanctity, time chip (seasonal hour), compass/minimap. **Time popup**: current
seasonal hour (sha'ot zmaniyot, night 1–12 / day 1–12) with civil-clock equivalent, a 24-hour seasonal dial
or slider to set any time, play/pause and speed, date; **"Happening now"** list (active + next events) — click
→ walk there with a speed selector (instant/slow/walk/fast/run). **Info panel**: location name, what happens
here, who may enter, what is happening now (from schedule), with **sources**. Settings: quality, amah
standard, volume, mouse sensitivity/invert, FOV, labels, aggadah layer. Mobile-friendly. No UI in `shot=1`.

## 14. Verification

* `npm run build` must pass. `node tools/shot.mjs [--q low|medium|high|ultra] "at=X,Y&look=H,P&t=…"` renders
  a PNG under `shots/` and prints console errors + draw calls/triangles; Read the PNG to inspect it.
  (This machine: Intel HD 4600 — a realistic low-end device. Shots of heavy scenes take a while.)
* Check console output is clean (no errors, no repeated warnings).
* Performance: low tier must stay interactive on this iGPU; report draw calls & triangles for your part.
