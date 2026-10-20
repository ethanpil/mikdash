# Subsystem APIs (as built)
Generated from each task's reports (implementation, then review fixes — later entries refine earlier ones). ARCHITECTURE.md holds the contracts; this file is the as-built detail.

## time + env (base)

ctx.time = { t (min after IST midnight, [0,1440)), speed, paused, frameDelta (sim min this frame, 0 on jumps), date{y,m,d}, dateString, weekday (0=Sun), dayType ('weekday'|'friday'|'shabbat'), hebrew{day,month (Nisan=1; Adar II=13),monthName,year,he,en}, hebrewEvening, hebrewAt(t) (switches at sunset), zmanim{alot,sunrise,sofZmanShma,sofZmanTefillah,chatzot,minchaGedola,minchaKetana,plagHamincha,sunset,tzeit,midnight,shaahDay,shaahNight}, ms (UTC ms of the sim instant), lst (deg), geo{lat,lon,tzMinutes}, sun{altitude (apparent),trueAltitude,azimuth,dir (world: +x E, +y up, −z N),distanceAU,ra,dec}, moon{altitude,trueAltitude,azimuth,dir,phase (0 new, .5 full),illumination,phaseAngle,angularRadius,distanceKm,illuminanceTOA (lx),ra,dec}, planets[{name,altitude,azimuth,dir,mag,ra,dec,elongation}], set(t) emits 'time:jump'(t), setDate('YYYY-MM-DD') emits 'time:date'({date}), setSpeed(n), pause(bool|undefined toggles), toZmani(t)->{half,hour,label}, fromZmani(half,hour)->t, resolve(spec: number|string|{at,offset}|{dayHour}|{nightHour}|{clock}) -> t or NaN (warns once), parse(str: 'HH:MM[:SS]'|'alot-5'|'sunrise+30'|'sunrise 30'|'d8.5'|'n11'; aliases netz, shkia, plag, mincha_gedola, noon, midnight…), format(t)->'HH:MM', tick(dt) }. Clock wraps on the same date.
ctx.env = { sunLight (= moonLight = keyLight: one shadow-casting DirectionalLight, sun by day, moon when sun < −4°), keyIsMoon, envMap (PMREM texture, also scene.environment), sky, stars, planets, sunDir, moonDir, keyDir (Vector3 toward the light), exposure (what the tone mapper applies, ≈1), preExposure (already applied to all env light; SCENE value = photometric value × preExposure, so fires/lamps/emissive must multiply candela or cd/m² by it), physicalExposure, luminance (adaptation, cd/m²), scotopic (0..1), sunIlluminance, moonIlluminance, skyIrradiance (lx, physical), sunTerrainVisibility, ambient{sky,ground} (Color irradiance, scene units), skyColorAt(dir, target?) -> Color radiance in scene units, fireScale (1, neutral), useTerrainVisibility (null auto | bool), haze (aerosol multiplier, 1), cirrus (null = per-date | 0..1; also ?cirrus=), atmosphere (params), shadowsManaged, setShadowsManaged(bool), setHorizonProfile(Float32Array of [height,dist] per 2° az | fn(az)->[H,D]), horizonElevation(az, y), update(now?) forces LUT + stats + PMREM refresh, dispose() }. Global three ShaderChunk overrides installed by env: fog_pars_vertex, fog_vertex, fog_pars_fragment, fog_fragment, tonemapping_fragment (fog applied before tone mapping, then HDR clamped to 6e4, then the stock tone-mapping line). scene.fog is a FogExp2 kept in sync for fallback.

## env interiors, probes + render additions (lighting-polish)

New or changed API (all additive):
- ctx.env.interiors (null with ?interiors=0): at(pos) -> {V, vol, s} (sky visibility 0..1, the volume containing pos, how far inside it 0..1); occlusion(fromPos, toPos); maxVolumes; stats(); debug(mode); beginCapture(pos)/endCapture(); setDirectAttenuation(k); setEnvWidth(w); setProbes(...); update(isProbeVolume); beforeRender(pointLights); uniforms; dispose().
- ctx.env.probes (medium+, null on low or with ?probes=0): texture (the CubeUV atlas: slice 0 sky, then the probes); probes [{id, pos, box, ...}]; render(dt), called by render/ every frame after shadows.beforeRender; capture() forces a refresh; roomProbe(pos); roomLuminance(pos); dispose().
- ctx.env.globalIlluminance: outdoor horizontal illuminance (lux, before preExposure). ctx.env.adaptSnap: true for 3 frames after a forced refresh or jump; fx snaps its adaptation then too.
- scene.environment is the probe atlas on medium+ (the plain sky PMREM on low). Uniform block binding 0 and the last binding point are taken by the MkInteriors block.
- fx (src/render/fx): pointLights() lists the current shader-order point lights; lightsFor(pos) points the shader light slots at another position (used for probe capture) and returns a restore function. illuminanceAt(pos, opts) is now occlusion-aware. Light ranking now accounts for occlusion, with a floor of 0.05.
- SunShaftsEffect: new uniform range (default 400 m) and a DEPTH attribute; shaft weight is 1 - exp(viewZ/range).
- Site-derived volumes: volumes.js defineVolumes(ctx) and defineProbes(ctx) read only ctx.site/site.js and the world's door and curtain states.
- URL switches: ?interiors=0 turns interior attenuation off; ?probes=0 turns probes off; ?intdebug=1 shows the V term and ?intdebug=2 shows volume membership.
- No world/ or materials/ files were modified.

All changes are additive; no world/ or materials/ files were touched.
- ctx.env.whiteBalance (Vector3): white-balance gains applied before the tone curve. Applied on the post path (grade effect uniform `wb`) and on the direct path (uniform `mkWBd` = gain − 1, declared in render/tonemap.js and uploaded by env's FogUniforms). Only the default 'agxl' mapper applies it.
- ctx.env._luts and ctx.env._meter: dev read-outs.
- env/luts.js: AtmosphereLUTs.buildTable(alts?) builds the per-source statistics table; estimate(sources[{alt, az, E:[r,g,b]}], refAz, out) returns statistics in the same layout as the GPU stats; .table holds the result.
- ctx.env.interiors additions:
  - setIntEnv(rgb, albedo): radiance seen through openings, per unit sky irradiance (env sets it every frame);
  - fireLuminance(vol): a room's mean surface luminance from its own fires, as rendered;
  - viewVisibility(vol, p, dir): sky visibility where the view ray meets the room's walls;
  - beginCapture(pos, lights, {fires, gain}).
  - The room selection now ranks rooms touching the camera's room just below that room.
- ctx.env.probes additions:
  - meterPending(vol): true while a room's post-jump capture or its measurement is outstanding; env holds its exposure snap meanwhile;
  - coverage(id): 0..1, how much the probe currently stands for its room;
  - roomLuminance() is now log-based, and probes carry meanLog and faceLog.
- MkInteriors uniform block:
  - mkUnionA.w = flags (bits 0–1 active probe count, 3 capture, 4–5 debug view);
  - mkUnionB.w = 1 / width of scene.environment;
  - mkIntQ.z = capture gain;
  - new members mkIntEnv, mkFillCol and uvec4 mkVolH (half-packed room boxes);
  - `#define MK_PROBES` compiles the probe loop only on tiers with probes. env/interiors-glsl.js exports setInteriorProbes(ShaderChunk, on); env recompiles lit materials when the tier switches.
- render/fx: illuminanceAt(pos, {rendered, color}). `rendered` weights each fire by the luminance of its light colour; `color` receives the counted fires' light colour. lightsFor(pos) now lights captures at env's exposure without the viewer's local fire adaptation. FireLights point-light intensities are pre-multiplied by the sky visibility at the fire (light.userData.mkV); MK fragments in rooms divide it out or multiply their own visibility.
- Site-derived volumes:
  - the Kodesh volume extends to X 163 (the great-gate passage and the F2 windows); the separate 'heichal.gate.great' volume is removed;
  - the north and south ta'im extend through the east wall;
  - the underground passage is widened by 0.7 amah on each side for its lamp niches;
  - new passage volumes: heichal.ta.door-ne, heichal.chalifot.n.wicket and heichal.chalifot.s.wicket;
  - the court probe now sits at the altar's centre X, halfway between its north face and the north wall.

## render (base)

ctx.fx (render/fx)
- add(spec) -> handle. spec as ctx.addFire: { id, kind: 'pyre'|'hearth'|'torch'|'lamp'|'menorah'|'brazier', pos: Vector3 world | [X,Y,Z] site amot (the base of the flames = top of the fuel bed), size: metres (rough flame size; pyre ref 2.0, hearth 0.8, brazier 0.6, torch 0.35, lamp 0.08), intensity 0..1, color?, schedule: 'always'|'night'|'service' ('service' = burns until the sim calls setFire), smoke?: bool (default: pyre and torch yes), luminance?: cd/m² override }.
- Every ctx.addFire spec (builders, before or after init) is consumed automatically each frame.
- handle = { id, kind, setIntensity(v), setPosition(Vector3|[X,Y,Z]), remove() }.
- setFire(id, intensity 0..1) — eases (~0.5 s), e.g. fuelling or dying down.
- attachTorch(object3D, { offset:[x,y,z] local metres, size, intensity, kind='torch', schedule, smoke, id }) -> handle. Follows the object's world transform; the flame leans against its velocity.
- smokeColumn({ pos, height=30, width=1, density=0.5, kind:'wood'|'incense', rise, spread }) -> { column, set({height,width,density,pos}), setIntensity(v), remove() }. Columns always rise vertically.
- remove(handle|id); list() -> [{id,kind,intensity,pos}]; fires (Map); illuminanceAt(worldPos) -> lux from all burning fires (physical); setAdaptation(bool).
- stats -> { fires, columns, lights, maxLights, flames, embers, puffs, P, adaptation }; scene (the FX Scene); snap() (on time jumps).

ctx.post (render)
- pipeline; composer (null on low); shadows (SunShadows | null); stats { fps, ms, scale, calls, triangles, tier, mode }.
- exposureTotal; toneMapper; setToneMapper('agxl'|'agx'|'aces'|'neutral') -> Promise.
- scale; setScale(0.5..1 | null = resume adaptive); adaptive; setFireAdaptation(bool).
- detect() -> { tier, gpu, mobile, stringTier, benchTier, score, reason }; rebuild() -> Promise.
- URL ?tm=aces|agx|neutral|agxl selects the operator; ?fixedres=1 disables adaptive resolution; ?debug=stats shows an fps/scale/calls overlay.
- Bus: listens to 'quality:change' (rebuilds from ctx.quality; calls engine.configure if needed) and 'time:jump'.

Other exports
- src/render/detect.js: detectTier(renderer) -> 'low'|'medium'|'high'|'ultra'; detectDevice(renderer, {bench=true}); classifyGpu(gpu, mobile); microBenchmark(); isMobile(); gpuString(renderer).
- src/render/log-filter.js: installShaderLogFilter() — idempotent.
- src/render/pipeline.js: TONE_MAPPERS, TM_GAIN, DEFAULT_TONE_MAPPER='agxl'.
- src/render/shadows.js: CascadedSunShadow({split, far, fade}), SunShadows, SHADOW_PRESETS.

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

ctx.mats = createMaterialLibrary(ctx) (src/world/materials/index.js):
- get(key) -> shared MeshStandardMaterial (MeshPhysicalMaterial for water, and for textiles with sheen on high/ultra). Never mutate per mesh. Unknown keys warn once and return 'debug'.
- keys: string[]; has(key).
- async ready(): compiles the generator programs and builds the basis maps. Sets bake on first get().
- info(key) -> { en, sources[], confidence, note }.
- tile(key) -> { tile: [w, h] in m, rowH } (e.g. tile('herodian_wall').rowH = 1.1 m, to align modelled courses).
- stats { readyMs, compileMs, basisMs, bakeMs, sets, bytes, MB }; bakeAll(); rebuild(quality) (also runs on bus 'quality:change'); dispose(); baker (debug).
- URL: ?matfx=0 (no shader add-on), ?mattex=0 (flat colours).

Existing keys, all kept: marble_white, marble_kochla, marble_veined, herodian_wall, ashlar_plain, paving_mount, paving_azarah, steps_stone, lime_whitewash, sikra_red, plaster, bedrock, terrain_soil, terrain_rock, ash, gold_plate, gold_green, gold_red, gold_vessel, bronze_corinthian, copper, silver, iron, cedar, oak_milah, olive_wood, wood_lattice, timber_rough (now a bark surface for modelled logs and rough timbers), linen_white, parochet, curtain_linen, water, glass_dark, roof_tile (now the plaster/lime-concrete roof fill), debug.

Added keys:
- herodian_wall_inner: same marble courses, plain dressed faces.
- gold_relief: Kodesh walls.
- roof_plaster: alias of roof_tile.
- wood_lattice_screen: the soreg as one cut-out panel (alphaTest 0.5, DoubleSide).
- timber_pile: stacked-log texture for box-shaped wood piles.
- cedar_v, oak_milah_v, olive_wood_v, wood_lattice_v: grain along V.

Conventions:
- 1 UV = 1 m (applyWorldUV); materials set their own repeat.
- Wood grain runs along U; use the *_v keys for posts and door boards.
- herodian_wall courses follow world height (v = y); its texture already includes the drafted margins and the 4 cm set-out relief in the normal map.

Preview: src/world/materials/preview.js exports async buildPreview(ctx) -> Group.

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
  floorAt(x, z, fromY = 1e4, minNy = 0.3, far = Infinity) -> y|null   // highest up-facing surface below fromY (default fromY returns roof tops)
  floorsAt(x, z) -> number[]          // every surface you can stand on at (x,z), ascending (clearance 1.75 m)
  raycast(origin, dir, far) -> { point, distance, normal, faceIndex } | null
  bvh, soup, bounds, stats { triangles, buildMs }, version
  rebuild() -> Promise                 // rebuilds the BVH from ctx.colliders, then the nav grid
  collideCapsule(feet, radius, bottom, top) -> blocked
  probeGround(feet, up, down) -> y|null
}
ctx.nav = {
  findPath(fromWorld, toWorld) -> Vector3[] | null   // feet points; goal snaps to the nearest reachable cell within 8 m
  ready: Promise<stats>, isReady, stats { buildMs, rasterMs, linkMs, graphMs, nodes, components, coarseNodes, ... }
  lastQueryMs, lastExpanded, nearest(p, radius = 4) -> Vector3|null, floorsAt(x, z), rebuild() -> Promise, grid
}
ctx.player = {
  position (feet, live world Vector3), eye (Vector3), heading (deg, get/set), pitch (deg, get/set),
  mode 'walk'|'fly'|'auto' (get/set), velocity, grounded, running, locked, speeds, body,
  goTo(target, speed = 'walk') -> Promise<boolean>   // true on arrival (emits 'player:arrived' {target}); false if cancelled or superseded
  cancel(), teleport(target) -> boolean, setMode('walk'|'fly'), setLook(headingDeg?, pitchDeg?),
  setInputEnabled(bool), unlock(), floorAtSite(X, Y) -> y|null, pickFloor(x, z, hintY)
}
Targets: anchor name | { anchor } | { at:[X,Y], z?, heading?, pitch? } (site amot; floor chosen at walking datums, nearest the current height) | { pos:[X,Y,Z] } (EYE position, same as ?pos=) | world Vector3 (feet) | [X,Y].
Speeds: 'instant' | 'slow' 0.8 | 'walk' 1.4 | 'fast' 2.4 | 'run' 4.5 | a number (m/s).
Bus: listens to 'ui:goto' {target, speed}; emits only 'player:arrived' {target}.
URL: ?pos (eye; hovers in fly mode if there is no floor near), ?at=X,Y[,Z], ?look=heading,pitch, ?fly=1; default anchor 'start'.
Settings read: 'mouseSensitivity' (or 'sensitivity' / 'lookSensitivity'), 'invertY' (or 'invertMouse' / 'invert'), 'headBob'.
Keys: W A S D, arrows, Shift, F, Space, E, Q, C, Esc. Debug overlay: ?debug=nav.

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

All additive; existing signatures are unchanged.
- `ctx.player.path`: getter for the active goTo walk's path (world Vector3[], read-only), or null. The ui-map task asked for this so its route line can skip a second query.
- `ctx.nav.targets`: site points [X, Y, Z?] the far-ground layer must reach. The player fills it at init from zones-content stands and schedule view points.
- `ctx.nav.stats` adds: `layers`, `nodes`, `stitches`, `regions` (the site.js regions given fine patches), `memMB`, `doneAt`, `adoptMs`.
- `ctx.buildTimes['player.nav']`: the nav build time.
- `ctx.nav.grid` is now the layered graph:
  - new: `layers[]`, `layerOf(k)`, `compOf(k)`, `nearestNodeM(x, y, z, metres, comp, accept)`;
  - kept as main-layer views: `nodeY`, `nodeStart`, `nodeCell`, `nodeFlags`, `links`, `nodePos`, `floorsAt`, `nearestNode`.
- `ctx.physics.floorAt(x, z, fromY)`: beyond the collider bounds it now returns the terrain height instead of null.
- `ctx.physics.probeGround(feet, up, down, ring = 0.3, dir = 0)`: the ring default is now the capsule radius (was 0.22); new optional `dir` orients the first ray.
- goTo behaviour:
  - `{at: [X, Y, Z]}` whose only floor is more than 0.5 m above Z (furniture) stands on the nearest spot at that level within 1.5 m;
  - goal and start snapping keep to the requested level.
- Exports from nav/index.js: `navSpecs(ctx, physics, targets)`, `fineRegions(site)`. From nav/multi.js: `buildNav`, `navTransfer`, `FLAG_STITCH`.

All additive; existing signatures keep working.
- `ctx.nav.landing(p, goal, radius = 16, walkK = 3)`:
  - new optional `walkK`, the glide/walk speed ratio; goTo passes max(5, 3v)/v;
  - the result now satisfies a level-move clearance check and is ranked by trip time.
- `ctx.nav.grid` gains:
  - `landingNode(p, t, r, walkK, maxCols = 4000, maxRays = 160)`;
  - `levelHit(p, ux, uz, far)`.
- `nearestNodeM` loses an undocumented 7th `below` flag. Only `landing` used it.
- `ctx.buildTimes['player.nav']` is now the worker's own build time (`nav.stats.workerMs`; main-thread fallback: `totalMs`). `nav.stats.totalMs` stays the wall time from start to ready, which now includes waiting for the first frame.
- The nav Worker is created at player init (in `createNav`); the build is posted on `ready`.

## people

ctx.people = {
  spawn({ role, seed, site?:[X,Y,Z?], heading?, pose?, phase?, prop?, hand? }) -> Actor
    roles: kohen segan kohen_gadol kohen_gadol_white levi guard_levi(default torch prop + torch pose) levi_boy israelite nazir woman elder sanhedrin child
  spawnAnimal('lamb'|'ram'|'goat'|'bull'|'dove', { seed? }) -> Actor
    quadruped poses: stand walk graze lie bound; dove: stand peck fly
  spawnProp(name, { seed? }) -> Actor-like free prop (setSite / setPosition / setHeading / setVisible / dispose)
  crowd({ roles: 'israelite' | [..] | { role: weight }, count, region: { min:[X,Y], max:[X,Y], z? } | points: [[X,Y,Z?] | { pos:[X,Y,Z?], heading }],
          pose, phase?, heading: deg | 'random' | { at:[X,Y] } | fn(i, X, Y) -> deg, seed, prop? })
    -> Crowd { setPose(name, phase?), setVisible(b), setCount(n), setHeadings(same forms as heading), setProp(name|null, hand), dispose(), count, capacity }
  util: {
    poseAlongPath(points, distanceMeters) -> { pos, heading, length, done, t }
      points as site [X,Y(,Z)] give pos as [X,Y(,Z)] in amot; points as world Vector3 give pos as a Vector3
    phaseFor(actor | role, pose = 'walk', meters) -> phase in [0,1) that keeps the feet planted (stride-matched)
  }
  roles, animals, props, poses, animalPoses, birdPoses (name lists)
  actors (getter), stats { figures, drawn, lod:[n0,n1,n2], props, batches, culled, overBudget }, root (Group), system
}

Actor {
  object3D (Group under people root; its matrixWorld drives the instance, so it may be reparented or moved)
  setSite(X, Y, Z?)      Z omitted -> ctx.physics.floorAt(x, z), else 0
  setPosition(Vector3)
  setHeading(deg)        compass degrees
  setPose(name, phase?)  phase 0..1 is held as given (deterministic);
                         omitted -> auto-advance at the clip's natural rate (locomotion at 1.25 m/s, or setSpeed(m/s))
  setProp(name | null, 'right' | 'left')
  setVisible(b)
  setSpeed(mps)
  dispose()
  readable: role, kind, poseName, phase, lod, scale, tint, mask
}

Poses: stand walk run carry carry_walk carry_shoulder carry_shoulder_walk prostrate bow kneel sing play_kinnor play_nevel play_cymbal blow_trumpet blow_shofar raise_hands raise_hands_low pour throw sprinkle sleep lie sit torch torch_walk slaughter sweep circle_lot point
  Loops: phase wraps.
  prostrate / bow / kneel: phase 0–0.3 down, 0.3–0.7 hold (0.5 = fully down), 0.7–1 up.
  pour / throw / circle_lot: single action over 0..1.
  play_cymbal: clash at phase 0.5.
  sit: assumes a seat about 1 amah high; actor origin = floor point under the seat.
  Pose changes cross-fade over 0.4 s (local-space slerp); ctx.bus 'time:jump' snaps them. Crowds switch instantly.

Props: torch trumpet shofar chalil kinnor nevel cymbal (played as a pair) machtah_silver machtah_gold teni kuz flask kaf bazach mizrak_gold mizrak_silver bowl knife limb lamb_carcass log keys scroll sudar basket magrefah lot
  Placement follows the pose's grip class: fist (hand), tray (vessels upright in both hands, attached to the chest), shoulder (carry_shoulder), free.
  Torch flames use ctx.fx.attachTorch on an anchor that tracks the hand bone.

Debug: ?debug=people (URL options &crowd=stand|prostrate|bow|kneel|walk, &pphase=0.5, &crowdn=N). Exposes ctx.people.demo.crowd.

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

people (additive only; every existing role, pose, prop, animal and method still works):
- New animal kinds: spawnAnimal('pigeon'|'turtledove'). 'dove' still works and is the young pigeon.
- New quadruped poses: drink, bound_tied, struggle, walk_led, stand_led, stand_halter. The existing 'bound' now follows the akedah (right side down, legs drawn together, held, throat to the east when heading 180).
- New bird pose: perch.
- Animal Actor: setLead(humanActor|null, hand='right') draws a sagging lead rope from the halter's chin ring to the leader's fist (one draw call for all ropes). The halter shows in walk_led / stand_led / stand_halter / drink. Its hanging end shows only when no leader holds the rope.
- Human Actor: setProps(rightName|null, leftName|null) puts one prop in each hand. Two-handed 'pair' poses use both. In fist poses the left prop goes in the left fist.
- New human poses: semichah, semichah_high (bull), hold_legs, receive, flay, carry_limbs, carry_limbs_walk, lead, lead_walk, wave, kemitzah, melikah, stoke, toss (one-shot), salt.
- New pose aliases: kabbalah→receive, tenufah→wave, hefshet→flay, carry_limb→carry_limbs, led→walk_led, bind→bound.
- New props:
  - Limbs (open-palm grip 'palm', also tray/free): limb_head, limb_foreleg, limb_oketz, limb_chazeh, limb_gerah, limb_dofen, entrails_bazach (tray).
  - Hung states (free props, origin at the hook, so place them with an exact Z at hook height): lamb_hung, carcass_flaying, carcass_hung. Also hide.
  - Birds: dove_held (palm), bird_cage (turtledoves), bird_cage_pigeons.
  - Vessels and food: cup_gold, solet, chavitin, loaves_todah, oil_flask, wine_jug, salt, machavat, marcheshet.
  - Tools: knife_flay, fork (tzinorah).
  - Existing knife (now a long square-ended chalaf), magrefah, kinnor and nevel were remodelled; same names.
- ctx.people.tamid.carriers lists the nine bearers of Tamid 4:3 in order as [{ right, left, pose }].
- Sleeping or lying kohanim (folded_garments pillow variants) now also show their own mantle spread over them.
- Grip class 'palm' is new; clip field pairGrip is new.
- Internal: MAX_BONES is now 36; human rigs gained skirt-cage bones skt_l/r and skh_l/r. Materials take opts.groups (FIG|KG|BEAST|PROP|FLESH) and opts.morph. Instance slots pAnimB.y/z now carry morph weights. Prop materials are chosen per group (PROP / FLESH).

The public people API is unchanged: no roles, poses, props, methods or arguments were renamed or removed.

Behaviour changes:
- **Prop batch cap.** At most 14/22/34/56 distinct prop batches (prop × grip × hand × LOD) are drawn per frame on low/medium/high/ultra, given out nearest first. A rare prop far away may not be drawn; a burning torch always is. The constant is `PROP_BATCH_CAP` in system.js.
- **Sleeping kohanim.** A kohanic actor in `sleep` or `lie` (shown with the folded garments and the mantle cover) no longer also wears the mantle (mask bit 1 is cleared).
- **Bound pose.** `bound`, `bound_tied` and `struggle` now have the legs standing out toward the slaughterer, fore and hind feet drawn together; before, they were folded under the belly. Heading 180 still gives head south, face west, throat east.
- **`limb_head`** is now the unflayed lamb's head with hair, ears and horns, as Tamid 4:3 places it on the palm.
- **Prostration.** In `prostrate`, the legs now rest on the floor and are 5° apart instead of 11°.

Internal additions:
- `clothSkin(rig, out, off)` in cloth.js, called by AnimAtlas.ensure and writeScratch.
- `quadHeadFrame(rig)` exported from animals.js.
- `EPHOD_AVG` and `AVNET_AVG` exported from human.js.
- A per-fragment specular override `pSpec` in the people material; the program cache key is now v4.
- Pattern 24 (fleece shells) is gone from the shader; the `PAT.FLEECE_SHELL` constant remains but is unused.
- New dev tools: `src/people/dev/skin-probe.mjs` (CPU skinning probe) and `src/people/dev/joints.mjs` (joint positions for a clip frame).

## audio

ctx.audio = {
  state,                                // 'locked' | 'running' | 'suspended' | 'disabled' | 'unsupported'
  unlock() -> Promise<bool>,            // create/resume the AudioContext; call from a user gesture. Also self-unlocks on the first pointerdown/keydown/touchend and on bus 'audio:unlock'.
  cue(id, worldPos?, opts?) -> { id, stop(fade=0.15), setPosition(p), setGain(g, t), ended: Promise<bool>, duration },
      // id: trumpet-tekiah trumpet-teruah trumpet-set gate-boom great-gate-open magrefah muchni knock barkai gevini shalom-call cymbal choir-psalm kinnor nevel chalil bells grinder-chant sheep doves crowd-prostrate footsteps keys
      //   aliases accepted: tekiah, teruah, trumpet, trumpets, trumpets-3, tekiah-teruah-tekiah, great-gate, gate, gate-open, gate-close, shalom, choir, psalm, song, levites-song, prostration, cymbal-crash, muchni-creak, kg-bells
      // worldPos: THREE.Vector3 (world m) | [X,Y,Z] (site amot) | Object3D | omitted (non-spatial)
      // opts: { gain, levelDb, delay (s), rate, variant (number, or 'hebron' for barkai, 'all-well' for shalom-call),
      //         area: {min:[X,Y,Z], max:[X,Y,Z]} (site amot), follow: Object3D, people (crowd-prostrate),
      //         caption: false, psalm, section (0-2), style: 'mishnah'|'sg1612', fluteDay, steps, pace, kind ('lamb'|'ewe'|'ram'), maxLatency }
  loop(id, worldPos?, opts?) -> { setGain(g, t=0.5), setPeople(n), setPosition(p), stop(fade=1), active },
      // id: fire torch water-channel crowd-murmur wind doves sheep night-insects choir bells
      // opts as cue plus { size (fire: 1 pyre, ~0.35 hearth), people (crowd-murmur) }
  setMaster(v 0..1),
  tekiahSet(pos?, opts?) -> cue handle,      // teki'ah-teru'ah-teki'ah by two trumpeters; default pos: on the table of the fats (altar.table.marble)
  libation(opts?) -> { stop(), done: Promise<bool> },   // 3 × (TaRaT + crowd prostration) each before a psalm section; cymbal at the pour; opts { people, trumpets, duchan, crowd, style, psalm }
  ambience: { hush(seconds), release(), setPopulation(n | null = auto), setLayer('wind'|'insects'|'doves'|'sheep'|'crowd'|'water'|'fire'|'torch', gain), enabled },
  prefetch([id | [id, opts]]), stopAll(fade), cues: string[], loops: string[], captions: bool, engine
}
Bus emitted: 'caption' { id, text: { en, he }, duration, pos }, 'audio:state' { state }, 'audio:space' { space, zone }.
Bus consumed: 'audio:unlock', 'settings:change' { key: 'volume' (0..1 or 0..100) | 'captions' (bool) }, 'time:jump', 'quality:change', 'ready'.
Settings read: ctx.settings.get('volume'), ctx.settings.get('musicStyle') ('mishnah' default | 'sg1612').
URL: ?audio=0 disables (no-op API); ?debug=audio shows the audition panel plus window.__mikdashAudio { analyze(id, {kind, opts}), renderAll(), throughSpace(id, space, {kind, send, opts, wav}) }.

Unchanged from the audio task's API, plus:
- cue/loop opts.area: { min:[X,Y,Z], max:[X,Y,Z] } OR an array of such boxes (site amot); the nearest box to the listener is the source point.
- libation(opts) adds { benArza: [X,Y,Z] (default: centre of azarah.duchan +3), walk: seconds (default: table→Ben Arza distance at 1.4 m/s, clamped 4–25; ≈20 s) }. Set 0 sounds from opts.trumpets (default altar.table.marble +3); sets 1–2 from benArza. Total ≈112 s.
- loop('crowd-murmur', pos, { women: 0..1 (default 0.35), sparse: bool, people, area }); loop('night-insects', null, { temp: °C }). The ambience director creates these itself.
- cue()/prefetch() accept every alias in CUE_ALIAS (psalm, song, levites-song, choir → the psalm of the day + musicStyle + caption; trumpets → trumpet-set, …).
- Internal: engine.inflight (Set), engine.pickVariant(id, def, opts), engine.transmission(space), renderer.retier(tier, synthRate, irMaxLen). The cache key includes the tier for choir-psalm, choir and crowd-murmur.
- Bus consumed: 'time:jump' now also cancels in-flight renders and running libations, and releases the ambience hush. 'quality:change' (reads ctx.quality.key) re-tiers the cache and the reverb and re-warms.
- Pre-render on low reads ctx.schedule.active(t) / upcoming(t, 8). Each event needs `sounds` (cue ids or aliases) and t0 or when.start (resolved by ctx.time.resolve).

## ui

ctx.settings = { get(key), set(key, value) -> bool, isSet(key), all(), defs }: values persisted as raw strings in localStorage 'mikdash.<key>' (try/catch) and cached, so get() is cheap per mouse event. set() emits bus 'settings:change' {key, value}; changing reducedMotion also emits a headBob change while head bob is unset. Keys: quality(auto|low|medium|high|ultra, reload), amah(naeh|feinstein|chazonish, reload), volume(0..1), captions(bool), musicStyle(mishnah|sg1612), mouseSensitivity(0.2..3), invertY, fov(40..95, applied to ctx.camera unless ?fov=), headBob(default = !reducedMotion), labels, aggadah(default true), reducedMotion(default = OS setting), travelSpeed(instant|slow|walk|fast|run), minimap. Unknown keys are stored loosely. shot=1 ignores stored values.
ctx.ui = { toast(msg | {en,he}, ms?), fade(to0..1, ms) -> Promise (the player's existing call), fade(ms) -> Promise (dips to black, resolves when black, lifts by itself), open('time'|'info'|'map'|'settings', opts?) -> bool (opts: {focusEvent:id} for time, {zone:id} for info; also dismisses the intro), close(), toggle(name), panel (current name|null), hints(on), enter(), enabled }. With ui=0 or shot=1 the same methods are no-ops and no UI code or CSS is loaded.
Keys: T time, I info, M map, G settings, Esc closes the open panel (captured so the player does not also see it), Enter dismisses the intro.
Consumes: bus 'caption' {text:{en,he}|string, duration}, 'zone:change' {zone: id|{id}}, 'time:date', 'ready'. Events: ctx.schedule.events / active(t) / upcoming(t,n) / at(zone,t), unwrapping {event} results if needed; times come from ctx.time.resolve(ev.when.start|end); ev.view.at may be [X,Y(,Z)] or {el,f}. Zone content: ctx.zones.content[id] | ctx.zones.ZONE_CONTENT | zones.info(id) | zones.get(id) | zones.list. Current zone: ctx.zones.current (id or {id}), else zoneAtSite(player feet). Travel: ctx.player.goTo(target, speed), else bus 'ui:goto'.
Dev scripts: node src/ui/dev/uishots.mjs [--w --h --q --prefix --query --steps json]; node src/ui/dev/uitest.mjs.

ctx.ui is unchanged: toast(msg | {en, he}, ms?), fade(to, ms) | fade(ms) -> Promise, open(name, opts?), close(), toggle(name), panel, hints(on), enter(), enabled. A toast with he now renders the Hebrew name first, in gold.
ctx.settings is unchanged except that the unused 'minimap' key is removed.
The UI's font stylesheet is now a script-inserted link[data-mk-fonts] plus preconnects, never an @import. __mikdashReady waits for document.fonts.ready, capped at 5 s.
Exported from src/ui/data.js: LADDER rungs now carry src (Kelim 1:8 or 1:9 for rungs 7–10), and RESTRICTED_RUNG = 7.
Exported from src/ui/timepanel.js: packLanes(items, nLanes = 3, gap = 0.06). Each item is { s0, span, ext, long }; the function sets item.lane.
Internal changes: app.goTo(target, label | { event: title }, { speed, keepMap }); hud.travel(text | null); hud.coverable; and app.panelOpen() / app.introOpen() helpers.
Bus usage is unchanged: it consumes 'caption', 'zone:change', 'time:date', 'ready' and 'settings:change'.
Dev scripts: node src/ui/dev/uitest.mjs (45 checks, now including a phone pass) and node src/ui/dev/uishots.mjs.

ctx.ui.open('map', { zone?, event? }): opens the overlay; zone selects a place and flies to it, event (id) expands that row. ctx.ui.map (null until the map has been opened once) is a debug/test handle: { select(id, opts), deselect(), view() -> {cx,cy,k}, setView({cx,cy,k}, {animate}), fit('mount'|'courts'|'sanctuary'), labels() -> ids, labelRects(), selected(), trip() -> {path}|null, stats() -> {base,dyn,raster,baseMs,dynMs,rasterMs}, hit(x,y), siteToScreen(X,Y), screenToSite(x,y), anchor(id), model(), activity() }.

Panel contract in app.js:
- New side 'map' (modal: true).
- Panels may implement onClose() (called on hide) and onEscape() -> bool (true = Esc handled, do not close).
- app.trip = { key, at:[X,Y(,Z)], label, speed, verb } | null is set by app.goTo for the walk in progress and cleared when it resolves.

format.js: accessLead(text), the first sentence of a zone's access text, or the first two when the first is a terse heading.

Map module internals (src/ui/map/):
- model.js: createModel(ctx, data) -> { list, get, groundAt, stackedAt, childrenOf, anchorOf, nameOf, otherLevels, extent, presets }.
- plan.js: renderPlan(ctx, model, {k, x0, y1, w, h, dpr}) -> canvas.
- view.js: createView(opts).
- labels.js: layoutLabels / drawLabels.
- places.js: createPlaces.
- card.js: createCard(app, opts), seasonalRange(time, t0, t1).

Dev: node src/ui/dev/maptest.mjs [--q low] [--out shots/area-map] runs 40 desktop, phone and landscape checks.

Behaviour change: a single map click now selects; a double-click or Enter goes. app.goTo's keepMap option is still supported but the map no longer uses it.

Additions; nothing existing changed.

- `ctx.ui.map` debug/test handle gains:
  - `marker()` returns `{ off, x, y, ang? }`: where "you" is drawn, in stage CSS px; `off` means the edge chevron.
  - `owns(id, X, Y)` returns true where a click at that site point would select that place.
- `layoutLabels(g, items, tf, blocked, scale, owns)`: new last argument `owns`. Items may set `slide: false`.
- `labels.js` exports `warmLabel(g, { tier, name }, scale)`, which measures a label's text ahead of time.
- The map panel object has `prewarm()`, called once by `app.js` in idle time after 'ready'.
- `app.openPanel()` returns the open panel's name or null; the HUD uses it.
- CSS:
  - `.mk-mapv.is-tapguard` lets taps pass through to the map for 380 ms after a tap selects.
  - `#ui-root.mk-open-map .mk-toasts` hides toasts while the map is open.
  - `.mk-mapv__travel` is now positioned by script (`placeTravel`).

Behaviour:
- Map double-tap timing uses event timestamps.
- A newly selected place's card opens scrolled to the top.
- The HUD's restricted-place notice is held while the map is open and shown when it closes, if the observer is still there.
- "Also here" lists storeys that cover the whole place.

## sim

## sim

ctx.zones = { current (zone id | null), content (ZONE_CONTENT | null), list (all zone ids), info(id) -> { id, boxes, priority, floorZ, ...content } | null (cached), at(worldVec3 feet) -> id (zoneAtSite at feet + 0.4 amot), atSite(X, Y, Z = 0) -> id }. Tracked at 5 Hz and immediately after 'player:arrived'. Emits bus 'zone:change' { zone, prev }.

ctx.schedule = { events (the data's own objects for ctx.time.dayType via eventsFor(dayType, time), else EVENTS filtered by dayTypes; each carries numeric t0/t1 in minutes [0,1440); a window may wrap midnight; missing end = t0 + (ev.duration ?? 15)), missing (true while src/data/schedule.js is absent: events stays [] and choreos use their own fixtures), select() (re-picks for the date; runs on 'time:date'), resolveTimes(), resolveEvent(ev), active(t = time.t) -> events sorted by importance, upcoming(t, n = 5) -> next n not active, at(zoneId, t) -> active in the zone (ev.zone or ev.zones), byId(id), progress(ev, t) -> 0..1 | NaN, positionOf(ev, target?) -> world Vector3 | null (pos, else view.at, else zone centre; {el, f} with default f [.5, .5, 1]), viewOf(ev) -> goTo target { at: [X,Y(,Z)], heading?, label } (view.at, else ZONE_CONTENT stand, else pos), runtime }. The data files are loaded with import.meta.glob, so the build passes without them.

ctx.schedule.runtime = { entries, choreo(id) -> entry, remap() (after select), repose(), playClock, budget (= quality.maxFigures), farCut (= drawDistance / 5), stats { ms (EMA), last, msPeak, figures, wanted, budget, frames }, dispose() }. Runs at PRIORITY.sim.

Choreo module, src/sim/choreo/*.js, export default:
{ id, aliases?, always?, lead? = 2, lag? = 2, importance?, fixtures? (used only when the schedule has no event for the module), init(ctx, events, sim) -> state, update(ctx, state, t, dt, sim) (must be a pure function of t; dt = real seconds, for smoothing only), release?(ctx, state, sim), dispose?, debug?(state) -> string (shown in the overlay) }.

Rules:
- Relevant when an event is within [t0 − lead, t1 + lag) or the module is `always`.
- Init is lazy; pools are spawned hidden at init.
- LOD by distance from the player to sim.setBounds: under 120 m every frame, under 350 m at 15 Hz, else 4 Hz. 'time:jump' and 'time:date' re-pose in the same frame.
- One figure-budget pass per frame; score = distance / (pool importance × choreo importance).

sim (per choreo) = { ctx, id, events, eventsOf(choreoId), event(id) (own events first, then the schedule), lod, distance, crossing, physVersion, crowdScale (low .35, medium .6, high/ultra 1), schedule, hasChoreo(id), pool(spec) -> ActorPool, crowd(spec) -> CrowdHandle, door(id) -> movable handle, fire(id) -> fire handle, sound(id, pos, opts), caption(text, opts), cueAt(key, tCue, fn), setBounds(minXYZ, maxXYZ) (site amot) }.

src/sim/lib (import from '../lib/index.js'):
- core: DAY, wrap, clamp, lerp, smooth, easeInOut, easeOut, window4, hashStr, rng(seed), rand(seed, ...keys) (stateless), randRange, wander(seed, t, period) (−1..1), since, span, within(t, t0, t1) (cyclic), near(t, t0, t1, lead, lag), phase(t, t0, t1, pre, post), segmentAt(list [{d}], start, t, loop).
- path: floorZ(ctx, X, Y, nearZ?) -> site Z (physics.standFloor; exact when nearZ is given, so upper rooms and tunnels work); headingTo; angleDiff; lerpAngle; SitePath(points [X,Y,Z] | Vector3[], {loop}) with .length (m), .cum, .sample(d) -> {X, Y, Z, heading, k, seg}, .offset(d, side, ahead); navRoute(ctx, waypoints [{X, Y, Z, straight?}], {loop, wait}) -> Promise<{ path, at[] (m), source, fallbacks, failed[] }> (nav leg per macrotask; keeps waiting across nav.ready replacements).
- cue: SIM symbol, crossed(state, tCue), cueAt(state, key, tCue, fn) (fires once when continuous play crosses tCue, never on jumps, keys de-duplicated).
- actors: ActorPool { slot(i), warm(), count } and Slot { place(X, Y, Z | {near} | omitted), heading(deg), pose(name, phase?), prop(name|null, hand), show(b) } (all change-cached; visibility comes from the budget pass); CrowdHandle { show(b), pose() } (lazy ctx.people.crowd, count × crowdScale).
- world: movable(ctx, id | 'door:' + id | 'curtain:' + id) -> { exists, amount, set(f), setGroup(group, f), invalidate() } (change-cached); doorAmount(t, tOpen, tClose, swing); fire(ctx, id) -> { exists, set(v) } (no-op for unknown ids); sound(ctx, id, pos, opts) (never throws); caption(ctx, {en, he} | string, { id, duration, pos }) -> bus 'caption'.

Choreos as built:
- 'night-watch' serves night-watch, watch-upper-chambers, ish-har-habayit, sleeping-guard. Stages the Moked's sleepers in the moked-night window until a 'moked-night' module exists.
- 'gates-opening' (alias 'gates-closing') serves dishun-men, gates-blasts, great-gate, nivreshet. The locking comes from schedule 'locking-up', else its own 'gates-closing', else before the night watch, else tzeit. Owns all day: door:mount.gate.{shushan, kiponus, tadi, chuldah-w, chuldah-e}, door:azarah.gate.{nikanor, mayim, bechorot, delek, korban, nitzotz, moked}, door:heichal.gate.great (inner/outer groups), door:heichal.gate.wicket-n.
- Cues used: shalom-call (with caption:false; the sim emits its own caption naming the post), gate-boom, great-gate-open, keys, tekiahSet.

?debug=sim: small overlay (lazy chunk) showing the clock, zone, sim ms, figure budget, each choreo's state / LOD / figures / its events' windows, and choreo debug() lines.

Dev harness: node src/sim/dev/run.mjs [--q tier] [--keep-ui] [--init FILE] --script src/sim/dev/tests/<test>.js "<query>".

## sim (replaces the sim section; zones and schedule are unchanged from sim-runtime)

ctx.schedule.runtime = { entries, choreo(id) -> entry, remap() (bumps generation), repose(), playClock, budget (= quality.maxFigures × 4: people's LOD0–2 share plus its 3× LOD3 allowance), farCut (= drawDistance / 5), generation, stats { ms, last, msPeak, figures (crowd members included), wanted, budget, frames }, dispose() }. Runs at PRIORITY.sim.

Choreo module, src/sim/choreo/*.js, export default:
{ id, aliases?, always?, lead? = 2, lag? = 2, importance?, fixtures?, init(ctx, events, sim) -> state, update(ctx, state, t, dt, sim), release?, dispose?, debug?(state) -> string (may contain '\n') }
- init is called ONCE AT BOOT for every module, and its pools are spawned hidden.
- On the first frame, behind the loader, the runtime stands every pooled figure in front of the camera once, so all people batches and shaders compile at boot.
- update must be a pure function of (t, date, seed). dt is real seconds, for smoothing only.

Rules:
- Sound and captions go only through cueAt / crossed.
- No cue may fall in [t0, t0 + CUE_LEAD) of its event (CUE_LEAD = 0.5 min, lib/cue.js), because the UI's jump-to-event lands at t0 + 0.25 and jumps never fire cues.
- Choreo LOD is as before. Per-slot LOD is sim.due(slot): true near the observer, after a jump and on waking; otherwise 15 Hz under 350 m and 4 Hz beyond. A skipped slot keeps its pose and visibility.
- One ranked budget pass per frame over slots (1 each) and crowds (their members, thinned with setCount when short), scored by distance / (pool importance × choreo importance).
- Doors are shared. sim.door(id).set(f) and .setGroup(g, f) state this choreo's want for this update. The runtime applies the largest want, or the builder's default (movable().default) when no choreo wants the door.
- Per-date plans may be cached on sim.generation.

sim adds: forced (this update must re-pose everything), generation, due(slot), and the shared door() described above.

lib additions:
- core: rand(seed, k0..k3) (fixed arity, at most 4 keys); wanderer(seed, p) -> fn(t); upperBound(arr, x).
- cue: CUE_LEAD.
- path: straightRoute(waypoints, { loop }) -> navRoute's result shape, synchronously, from straight legs.
- actors: Slot.placeNear(X, Y, Z) (= place(X, Y, { near: Z }) without allocating); CrowdHandle { count (tier-scaled), pos (world centre) }.
- world: movable(...).default.

Choreos as built:
- night-watch (lead 16, lag 3):
  - Levites: the 21 walk in at 1.2 m/s on nav from the nearest of Kiponus, Shushan, Chuldah-W and Chuldah-E (never Tadi), arriving at night-watch.t0. The guard behind the Kaporet arrives at locking-up.t0 + 3. They stand, sway and turn to the officer, then walk out from night-watch.t1.
  - Officer: comes in at the western Chuldah portal at ish-har-habayit.t0, greets the Chuldah-W guard at t0 + 0.5, and covers a 21-post circuit (≈2.57 km, a nominal 43.9-min round). That includes the post behind the Kaporet, reached through door:azarah.moked.door-chel and door:azarah.gate.moked.pishpash, which swing open as his party passes.
  - His timeline comes from the authored waypoints with two scales: he reaches the sleeping guard at sleeping-guard.t0 + 0.5, and his last round ends back at his gate at ish-har-habayit.t1.
  - Sleepers are kohen_offduty and kneel for the last 0.75 min of their window. The Moked sleepers are staged here only while no moked-night module exists.
- gates-opening (always):
  - The blasts and the first gate booms are at gates-blasts.t0 + 0.5, the great gate at great-gate.t0 + 0.5.
  - The clearing men stand ready at the Gazit from dishun-men.t0 and reach the wicket 1.5 min before the great gate (nominal walk length).
  - The nivreshet caption fires when the sun clears the env horizon profile at the nivreshet's height and heichal.nivreshet glint(sunDir, eye) ≥ 0.75, within [nivreshet.t0 + 0.5, nivreshet.t1 + 25].
- Cue ids are unchanged: shalom-call (caption:false), gate-boom, great-gate-open, keys, tekiahSet.

Dev: node src/sim/dev/run.mjs [--q tier] [--init FILE] --script src/sim/dev/tests/{jumps,cues,jumpto,firstnight,gc,budget,visual,night,patrol,dates,helpers,zones}.js "t=d3". The page scope adds cdp(method, params); HeapProfiler profiles come back aggregated by allocating function.

## offerings data

src/data/offerings.js (pure data, no imports):
- STATIONS[id] = { zone, el?, at?: [X,Y,Z], f?, note, confidence }. ids: gate-korban, gate-bechorot, nikanor, kinnin-chest, seals, rings, tzafon, nanasin, marble-tables, medichin, melach, parvah, altar-ne, altar-sw, yesod-south, kevesh, kevesh-salting, ramp-sovev, sovev, horn-se/ne/nw/sw, maarachah, cups, table-marble, table-silver, beit-hadeshen, tenufah, kemitzah, hagashah, kitchen, meal, nazirites-chamber, lepers-chamber, city.
- OFFERING_TYPES[id] = { id, names{en,he,translit}, category, form, animals|birds|meal|components|produce, broughtBy, occasions, slaughter, semichah, blood, burned, eaten, hide, nesachim, steps[], frequency{lo,hi,unit}, sources, notes }.
- Each step = { id, label, actors:[{role,count,pose,prop?,gesture?,note?}], at: stationId|[ids], props, animals, minutes:[lo,hi], attire, sources, confidence, note }. In composite sets, a step with `ref` points to another type's steps.
- NESACHIM: lamb/kid/ram/bull → solet (esronim), oil and wine (log), seal.
- OFFERING_RULES: window, night, shabbat, order, salt, nesachim, hides, attire, seasons, lanes, frequency (with perDay).
- ASSET_NEEDS: gestures, props and animal variants the steps want.
- offeringWindows(dayType, zmanim, { prevDayType?, hebrew?: {month (Nisan=1), day} }) → [{ id: 'turning'|'notar'|'individual'|'meal-day'|'evening-burning'|'meal-evening'|'scouring', t0, t1 (0 ≤ t0 < t1 ≤ 1440, minutes on this civil date), offerings, lanes, note, sources }].

schedule.js:
- New optional event key `offerings: [OFFERING_TYPES ids]`; the validator checks the ids.
- Time specs now also use { at: 'midnight', offset } and { clock: 'HH:MM[:SS]' }. ctx.time.resolve already supported both; the validator and coverage resolvers now do too.
- New helpers in the file: midnight(), clock().

tools/coverage.mjs: `node tools/coverage.mjs [--max 10] [--verbose]`. Exits 1 on any gap longer than --max. Its LOW list must be kept in step with schedule.js.

Changes since offerings-data:
- In OFFERING_TYPES, each composite set (nazir, metzora, yoledet, zav-zavah) has frequency.yields = { [componentTypeId]: average count per set }. The metzora and yoledet also have frequency.yieldsNote.
- OFFERING_RULES.frequency:
  - perDay: { [type]: [lo, hi] }, totals that INCLUDE what the sets bring. Unchanged in meaning; now documented.
  - sets: ['nazir', 'metzora', 'yoledet', 'zav-zavah'].
  - alone: { [type]: [lo, hi] }, the remainder brought on its own (perDay minus the sets' yields). It covers every non-set type except nesachim.
  - counting: the rule. Draw ONE seeded day quantile q in [0, 1]. Use lo + q·(hi − lo) for every set and for alone[type]. Never draw perDay and the sets independently. Nesachim are not drawn: they come with every olah, shelamim and todah, and with the metzora's chatat and asham.
- OFFERING_TYPES.nesachim.frequency: { lo, hi computed, withEach: ['olah', 'shelamim', 'todah'], withSets: { metzora: ['asham', 'chatat'] } }.
- OFFERING_RULES.shabbat: new shabbatDay field; fridayNight is re-sourced; sources gain 'Kesef Mishneh on Rambam TuM 1:7', 'Yoma 46a' and 'Rambam MK 4:3'.
- The bechor and ma'aser 'matanah-achat' step's actor is now pose 'pour' with gesture 'shefichah'. ASSET_NEEDS.gestures lists 'shefichah'.
- Glossary: new key 'shefichah', 347 terms.
- tools/validate-schedule.mjs now imports OFFERING_RULES and checks that every set has yields naming real non-set types, and that every alone entry has lo ≥ 0 and hi ≥ lo.
