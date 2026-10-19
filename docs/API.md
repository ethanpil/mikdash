# Subsystem APIs (as built)

Generated from each task's final report (implementation + review fixes). ARCHITECTURE.md holds the contracts; this file is the as-built detail.


## time + env

ctx.time = { t (min after IST midnight, [0,1440)), speed, paused, frameDelta (sim min this frame, 0 on jumps), date{y,m,d}, dateString, weekday (0=Sun), dayType ('weekday'|'friday'|'shabbat'), hebrew{day,month (Nisan=1; Adar II=13),monthName,year,he,en}, hebrewEvening, hebrewAt(t) (switches at sunset), zmanim{alot,sunrise,sofZmanShma,sofZmanTefillah,chatzot,minchaGedola,minchaKetana,plagHamincha,sunset,tzeit,midnight,shaahDay,shaahNight}, ms (UTC ms of the sim instant), lst (deg), geo{lat,lon,tzMinutes}, sun{altitude (apparent),trueAltitude,azimuth,dir (world: +x E, +y up, −z N),distanceAU,ra,dec}, moon{altitude,trueAltitude,azimuth,dir,phase (0 new, .5 full),illumination,phaseAngle,angularRadius,distanceKm,illuminanceTOA (lx),ra,dec}, planets[{name,altitude,azimuth,dir,mag,ra,dec,elongation}], set(t) emits 'time:jump'(t), setDate('YYYY-MM-DD') emits 'time:date'({date}), setSpeed(n), pause(bool|undefined toggles), toZmani(t)->{half,hour,label}, fromZmani(half,hour)->t, resolve(spec: number|string|{at,offset}|{dayHour}|{nightHour}|{clock}) -> t or NaN (warns once), parse(str: 'HH:MM[:SS]'|'alot-5'|'sunrise+30'|'sunrise 30'|'d8.5'|'n11'; aliases netz, shkia, plag, mincha_gedola, noon, midnight…), format(t)->'HH:MM', tick(dt) }. Clock wraps on the same date.
ctx.env = { sunLight (= moonLight = keyLight: one shadow-casting DirectionalLight, sun by day, moon when sun < −4°), keyIsMoon, envMap (PMREM texture, also scene.environment), sky, stars, planets, sunDir, moonDir, keyDir (Vector3 toward the light), exposure (what the tone mapper applies, ≈1), preExposure (already applied to all env light; SCENE value = photometric value × preExposure, so fires/lamps/emissive must multiply candela or cd/m² by it), physicalExposure, luminance (adaptation, cd/m²), scotopic (0..1), sunIlluminance, moonIlluminance, skyIrradiance (lx, physical), sunTerrainVisibility, ambient{sky,ground} (Color irradiance, scene units), skyColorAt(dir, target?) -> Color radiance in scene units, fireScale (1, neutral), useTerrainVisibility (null auto | bool), haze (aerosol multiplier, 1), cirrus (null = per-date | 0..1; also ?cirrus=), atmosphere (params), shadowsManaged, setShadowsManaged(bool), setHorizonProfile(Float32Array of [height,dist] per 2° az | fn(az)->[H,D]), horizonElevation(az, y), update(now?) forces LUT + stats + PMREM refresh, dispose() }. Global three ShaderChunk overrides installed by env: fog_pars_vertex, fog_vertex, fog_pars_fragment, fog_fragment, tonemapping_fragment (fog applied before tone mapping, then HDR clamped to 6e4, then the stock tone-mapping line). scene.fog is a FogExp2 kept in sync for fallback.


## render

Unchanged from the render task: ctx.fx.add / setFire / attachTorch / smokeColumn / remove / list / illuminanceAt / setAdaptation / snap / stats, and ctx.post.{pipeline, composer, shadows, stats, exposureTotal, toneMapper, setToneMapper, scale, setScale, adaptive, setFireAdaptation, detect, rebuild}.

Changed or added:
- ctx.fx.add(spec) / ctx.addFire: size is in metres and should be passed explicitly (lamp 0.08, torch 0.35, brazier 0.6, hearth 0.8, pyre 1.5–2.5). If omitted, the kind's preset size is used. An exact size 1 arriving through ctx.fires for lamp, menorah or torch is treated as ctx.addFire's default and replaced by the preset size.
- ctx.fx.stats adds shadowLights (number of shadow-casting fire-light slots).
- render/fx/lights.js exports FIRE_SHADOWS = { low|medium: {slots:0}, high: {slots:1, mapSize:128, refresh:0.25, radius:3, normalBias:0.12, bias:-1.5e-4}, ultra: {slots:2, mapSize:160, refresh:0.125, radius:4, normalBias:0.1, bias:-1.5e-4} }. Shadow slots exist only when quality.shadows is set and are taken only by static pyre, hearth and brazier clusters.
- ctx.post.pipeline.post now exposes bloom (SkyMaskedBloom), shafts (SunShaftsEffect) and shaftPass. godRays, godPass and sunDisc are removed.
- render/post-effects.js exports:
  - SkyMaskedBloom(opts), extends BloomEffect: .setPrefilter(threshold, knee, maxLum, discVec3, discR, aspect) and .setDepthTexture(t).
  - SunShaftsEffect({samples, resolutionScale, density, decay}): .setParams({color, narrow, broad, broadWeight, sunView, upView, camera}), .sunUv, .setDepthTexture(t).
- render/shadows.js SHADOW_PRESETS: high {mapSize 2048, split 24, far 210}, ultra {mapSize 4096, split 30, far 300}, each with flyFrom 12, farPerMetre 3, farMax 700/900.


## materials

The API is unchanged: ctx.mats = createMaterialLibrary(ctx) with get(key), keys, has(key), async ready(), info(key), tile(key), stats, bakeAll(), rebuild(quality), dispose(), baker. URL options ?matfx=0 and ?mattex=0 still work. Every existing key is kept.

New keys:
- **heichal_whitewash:** lime wash over dressed ashlar, for the Heichal's annual whitewash (Middot 3:4). Courses are 1.1 m; tile('heichal_whitewash') returns { tile: [10, 4.4], rowH: 1.1 }.
- **timber_pile_end:** the end faces of a stacked log pile.

Conventions:
- **timber_pile:** the long faces of a box pile, with logs running along U (world UVs).
- **timber_pile_end:** the faces where the logs end. With applyWorldUV, if the logs run along world x, use timber_pile on the N/S faces and timber_pile_end on the E/W faces.
- **lime_whitewash:** the altar only (rounded field-stones).
- **herodian_wall:** tile('herodian_wall').rowH is 1.1 m. Even rows are set out by 4 cm; odd rows are drawn in and carry a baked shadow band at their top.
- **Gold:** gold_plate, gold_relief and gold_vessel now use the measured gold F0, #ffe39d.

Internal, materials-only: generator shaders gained a uC6 colour uniform, and the weave, metal and ashlar kinds gained uP2 parameters.


## player

ctx.physics = {
  floorAt(x, z) -> y|null                       // standable WALKING floor (datum floors preferred, not roof tops) == standFloor(x, z)
  floorAt(x, z, fromY, minNy = 0.3, far = Infinity) -> y|null   // highest up-facing surface (ny >= minNy) in [fromY - far, fromY]
  floorsAt(x, z, top = 1e4) -> number[]         // standable floors, ascending
  standFloor(x, z, hintY = null, exact = false) -> y|null   // datum-preferred unless exact; nearest hintY (lowest without)
  insideAt(x, y, z) -> boolean                  // inside a closed solid (column winding parity)
  findStand(p, radius = 8) -> Vector3|null      // nearest standable spot: nav node, else a column ring search
  raycast(origin, dir, far) -> { point, distance, normal, faceIndex } | null
  collideCapsule(feet, radius, bottom, top) -> blocked;  probeGround(feet, up, down) -> y|null
  bvh, soup, bounds, stats { triangles, buildMs }, version, rebuild() -> Promise
}
ctx.nav = { findPath(fromWorld, toWorld) -> Vector3[]|null, landing(p, goal, radius = 16) -> Vector3|null, nearest(p, r = 4), floorsAt(x, z), ready, isReady, stats, lastQueryMs, lastExpanded, rebuild(), grid }
ctx.player = { position, eye, heading, pitch, mode 'walk'|'fly'|'auto', velocity, grounded, running, locked, speeds, body,
  goTo(target, speed = 'walk') -> Promise<boolean>, cancel(), teleport(target) -> boolean, setMode, setLook(h, p), setInputEnabled(bool), unlock(),
  floorAtSite(X, Y) -> y|null, pickFloor(x, z, hintY, exact) }
Targets: anchor | {anchor} | {at:[X,Y]} (datum floor nearest the current height) | {at:[X,Y,Z]} or {at, z} (floor nearest Z on ANY level) | {pos:[X,Y,Z]} (EYE position; inside a solid → nearest floor) | {pos:[X,Y]} (= at) | world Vector3 (feet) | [X,Y].
Speeds: 'instant' | Infinity (teleport, fade via ctx.ui.fade(to, ms)) | 'slow' 0.8 | 'walk' 1.4 | 'fast' 2.4 | 'run' 4.5 | positive number; anything else walks (one warning).
While flying, a floor target lands on a connected, clear cell and walks; an air target glides straight. An unreachable target ends with a fade-hop. Emits only 'player:arrived' {target}.
URL: ?pos=X,Y[,Z] · ?at=X,Y[,Z] · ?look=h,p · ?fly=1.


## people

ctx.people = {
  spawn({ role, seed, site?:[X,Y,Z?|{near}], heading?, pose?, phase?, prop?, hand? }) -> Actor
    roles: kohen segan kohen_gadol kohen_gadol_white levi guard_levi levi_boy israelite nazir woman elder sanhedrin child kohen_offduty
    (kohanic roles in 'sleep'/'lie' automatically wear their own clothes and lie on their folded garments + kesset, Tamid 1:1)
  spawnAnimal('lamb'|'ram'|'goat'|'bull'|'dove', { seed? }) -> Actor   (quad poses: stand walk graze lie bound; dove: stand peck fly)
  spawnProp(name, { seed? }) -> free prop (setSite / setPosition / setHeading / setVisible / dispose); a free torch stands upright and burns
  crowd({ roles: role | [..] | { role: weight }  (person roles OR animal kinds; unknown roles warned + skipped),
          count, region: { min:[X,Y], max:[X,Y], z? | near? } | points: [[X,Y,Z?] | { pos:[X,Y,Z?], heading?, near? }],
          pose, phase?, heading: deg | 'random' | { at:[X,Y] } | fn(i,X,Y) | omitted (= each point's heading, else north),
          seed, prop?, layout?: 'prostrate' (2.1:1 staggered cells; automatic when created prostrating) })
    -> Crowd { setPose(name, phase?), setVisible(b), setCount(n), setHeadings(h?) (no arg = restore point headings), setProp(name|null, hand), dispose(), count, capacity }
    A REGION crowd in a walking pose (walk/run/carry_walk/torch_walk/carry_shoulder_walk) flows along its headings at the stride-matched speed (auto phase or the sim's explicit phases) and wraps inside the region, dithering in/out at its edges. A points crowd walks in place (warned once).
  util: { poseAlongPath(points, distanceMeters) -> { pos, heading, length, done, t }, phaseFor(actor|role, pose='walk', meters) -> phase }
  roles, animals, props, poses, animalPoses, birdPoses
  actors (getter), stats { figures, drawn, lod:[n0,n1,n2,n3], props, batches, culled, overBudget, far, dropped }, root, system
}
Actor { object3D, setSite(X, Y, Z?) — Z number = exact; { near: Z } = walking floor nearest Z; omitted = the walking floor (site datums, never a roof/beam); re-resolved when colliders rebuild,
        setPosition(v), setHeading(deg), setPose(name, phase?), setProp(name|null, 'right'|'left'), setVisible(b), setSpeed(mps), dispose(),
        readable: role, kind, poseName, phase, lod, scale, tint, mask, shownProp }
Props (new/changed): machtah_silver (daily, 4 kav), machtah_gold (DAILY gold 3 kav: greenish, heavy, short handle), machtah_gold_yk (Yom Kippur: red gold, light, long handle + ne'ashtik ring), folded_garments (grips pillow_side / pillow_back / free), limb, lamb_carcass (anatomical), log (AMAH x AMAH), torch (free = upright), shofar; others unchanged.
Grip classes: fist, tray, shoulder, pillow_side, pillow_back, free.
Budget: LOD0-2 up to quality.maxFigures (nearest first, actors first); the next up to 3 x maxFigures as LOD3 silhouettes (~250-360 tris); the last 20% of that allowance dithers out; beyond it figures are dropped and their torch flames go out.
Debug: ?debug=people (row A now includes kohen_offduty; the sleeping/lying kohanim lie on their folded garments; a lamb flock crowd; &crowd=walk flows; &pspace forces the prostrate layout). ctx.people.demo = { crowd, flock }.


## audio

Unchanged from the audio task's API, plus:
- cue/loop opts.area: { min:[X,Y,Z], max:[X,Y,Z] } OR an array of such boxes (site amot); the nearest box to the listener is the source point.
- libation(opts) adds { benArza: [X,Y,Z] (default: centre of azarah.duchan +3), walk: seconds (default: table→Ben Arza distance at 1.4 m/s, clamped 4–25; ≈20 s) }. Set 0 sounds from opts.trumpets (default altar.table.marble +3); sets 1–2 from benArza. Total ≈112 s.
- loop('crowd-murmur', pos, { women: 0..1 (default 0.35), sparse: bool, people, area }); loop('night-insects', null, { temp: °C }). The ambience director creates these itself.
- cue()/prefetch() accept every alias in CUE_ALIAS (psalm, song, levites-song, choir → the psalm of the day + musicStyle + caption; trumpets → trumpet-set, …).
- Internal: engine.inflight (Set), engine.pickVariant(id, def, opts), engine.transmission(space), renderer.retier(tier, synthRate, irMaxLen). The cache key includes the tier for choir-psalm, choir and crowd-murmur.
- Bus consumed: 'time:jump' now also cancels in-flight renders and running libations, and releases the ambience hush. 'quality:change' (reads ctx.quality.key) re-tiers the cache and the reverb and re-warms.
- Pre-render on low reads ctx.schedule.active(t) / upcoming(t, 8). Each event needs `sounds` (cue ids or aliases) and t0 or when.start (resolved by ctx.time.resolve).


## ui

ctx.ui is unchanged: toast(msg | {en, he}, ms?), fade(to, ms) | fade(ms) -> Promise, open(name, opts?), close(), toggle(name), panel, hints(on), enter(), enabled. A toast with he now renders the Hebrew name first, in gold.
ctx.settings is unchanged except that the unused 'minimap' key is removed.
The UI's font stylesheet is now a script-inserted link[data-mk-fonts] plus preconnects, never an @import. __mikdashReady waits for document.fonts.ready, capped at 5 s.
Exported from src/ui/data.js: LADDER rungs now carry src (Kelim 1:8 or 1:9 for rungs 7–10), and RESTRICTED_RUNG = 7.
Exported from src/ui/timepanel.js: packLanes(items, nLanes = 3, gap = 0.06). Each item is { s0, span, ext, long }; the function sets item.lane.
Internal changes: app.goTo(target, label | { event: title }, { speed, keepMap }); hud.travel(text | null); hud.coverable; and app.panelOpen() / app.introOpen() helpers.
Bus usage is unchanged: it consumes 'caption', 'zone:change', 'time:date', 'ready' and 'settings:change'.
Dev scripts: node src/ui/dev/uitest.mjs (45 checks, now including a phone pass) and node src/ui/dev/uishots.mjs.
