// ctx.fx — fires, carried torches, smoke columns and their budgeted lights.
//
//   ctx.fx.add(spec) -> handle            spec as ctx.addFire: { id, kind, pos: Vector3|[X,Y,Z] amot, size,
//                                         intensity, color, schedule: 'always'|'night'|'day'|'service', smoke,
//                                         light (false: flames, glow and smoke only — no point light; small piles) }
//                                         size: flame size in metres — pass it explicitly (lamp 0.08, torch 0.35,
//                                         brazier 0.6, hearth 0.8, pyre 1.5–2.5); omitted => the kind's preset.
//                                         ctx.addFire's default size 1 is ignored for lamps and torches.
//   ctx.fx.setFire(id, intensity 0..1)    eases toward the new intensity (fuelling, dying down)
//   ctx.fx.attachTorch(object3D, opts)    -> handle; opts { offset:[x,y,z] local m, size, intensity, kind }
//   ctx.fx.smokeColumn({ pos, height, width, density, kind:'wood'|'incense', rise }) -> handle
//   ctx.fx.remove(handle | id)
//
// Rendering: four instanced draw calls total (flames, halos, embers, smoke) in a separate scene (`fx.scene`)
// that render/ draws AFTER ambient occlusion (so AO never darkens flames) with soft depth intersection.
import { Scene, Vector3, Vector2, Color, Object3D } from 'three';
import { m2w } from '../../core/units.js';
import { InstanceBatch } from './batch.js';
import { createFxMaterials, setFxMaterialMode } from './materials.js';
import { getNoiseTexture } from './noise.js';
import { kindPreset } from './presets.js';
import { FireLights, FIRE_SHADOWS } from './lights.js';
import { createGlint } from './glint.js';
import { sunAltitude, sunDir, envDirLights, lightIrradiance, ambientRadiance, exposure } from '../env-link.js';

/** scene units per physical unit when env does not define preExposure (three's legacy 'noon sun ≈ 3') */
const FALLBACK_P = 3e-5;
/**
 * Display-referred soft cap for emission: post tiers ≈ 4 stops above mid-grey (cores pale yellow, bodies
 * orange). The low tier tone-maps every layer separately, so it needs a lower cap to keep colour.
 */
const EMISSION_CAP = { low: 0.75, post: 3 };
// Local eye adaptation to firelight. env meters sun/moon/sky only; a fire's own light and emission are scaled
// by how far firelight at the viewer raises adaptation: a = (La / (La + La_fire))^SLOPE. Keeps half-float
// buffers in range at night and reads like human local adaptation (fire and moonlit surroundings both legible).
const ADAPT_ALBEDO = 0.3;
const ADAPT_SLOPE = 0.85; // ≈ d log(P)/d log(La) of env's exposure key, moonlit → firelit
const ADAPT_TAU = 0.8;    // s
// Looking INTO the fire the eye adapts to the flames themselves: emission is scaled so that a reference flame
// core (1.25 × 2e4 cd/m²) lands at FIRE_CORE_HEADROOM × the display cap (then soft-capped). Below that
// (daylight) the gain is 1. Without it every part of a night fire sits far above the cap and the soft cap
// flattens core, body and tips into one cream mass.
const FIRE_REF_CORE = 1.25 * 2.0e4;
const FIRE_CORE_HEADROOM = 1.8;
// render-env-2: local adaptation also to the firelit surfaces in view (rays in screen-fraction units of the half fov)
// [x, y, weight]: the centre (what one looks at) counts most
const VIEW_RAYS = [[0, 0, 0.4], [0.4, 0.1, 0.15], [-0.4, 0.1, 0.15], [0, 0.45, 0.15], [0, -0.35, 0.15]];
const VIEW_PERIOD = 0.2; // s between samplings
const VIEW_FAR = 600;    // m
const VIEW_WEIGHT = 0.6; // share of the view the sampled surfaces stand for (as the camera term's 0.6)

const TIER_INDEX = { low: 0, medium: 1, high: 2, ultra: 3 };
// low: more, smaller puffs (less stretching along the column => no torn strips), each a little thinner
const SMOKE_PUFFS = [24, 30, 40, 52];
const SMOKE_DENSITY = [0.8, 1, 1, 1];
const INCENSE_PUFFS = [10, 18, 26, 34];

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

const _v = new Vector3();

export function createFx(ctx, { tier = 'medium', soft = false } = {}) {
  const scene = new Scene();
  scene.name = 'fx';
  scene.matrixWorldAutoUpdate = true;
  const noise = getNoiseTexture();
  let ti = TIER_INDEX[tier] ?? 1;
  let low = ti === 0;
  const mats = createFxMaterials({ soft, low, noise });
  const flames = new InstanceBatch('flames', { iPos: 3, iSize: 2, iParams: 4, iLean: 4 }, 1024);
  const halos = new InstanceBatch('halos', { iPos: 3, iParams: 4, iColor: 3 }, 512, { x0: -1, x1: 1, y0: -1, y1: 1 });
  const embers = new InstanceBatch('embers', { iPos: 3, iParams: 4, iParams2: 2 }, 4096);
  const beds = new InstanceBatch('beds', { iPos: 3, iParams: 4 }, 512, { x0: -1, x1: 1, y0: -1, y1: 1 });
  const smoke = new InstanceBatch('smoke', { iPos: 3, iCol: 4, iPuff: 4, iGlow: 3, iMisc: 2 }, 4096, { x0: -1, x1: 1, y0: -1, y1: 1 });
  // draw order: smoke (alpha) first, then additive glow, flames, embers on top
  scene.add(smoke.makeMesh(mats.smoke));
  scene.add(beds.makeMesh(mats.bed));
  scene.add(halos.makeMesh(mats.halo));
  scene.add(flames.makeMesh(mats.flame));
  scene.add(embers.makeMesh(mats.ember));
  smoke.mesh.renderOrder = 1; beds.mesh.renderOrder = 2; halos.mesh.renderOrder = 2; flames.mesh.renderOrder = 3; embers.mesh.renderOrder = 4;
  // render-env-2-fix: the nivreshet's sun glint (fx/glint.js)
  const glint = createGlint(ctx, mats.glint);
  scene.add(glint.mesh);
  const _sz = new Vector2();

  const shadowCfg = () => (ctx.quality?.shadows && FIRE_SHADOWS[ctx.quality.key]) || FIRE_SHADOWS.low;
  const lights = new FireLights(ctx.scene, ctx.quality?.maxFireLights ?? 4, shadowCfg());
  const fires = new Map();     // id -> fire
  const columns = new Set();   // smoke columns
  const seen = new WeakSet();  // ctx.fires specs already consumed
  let auto = 0;
  let time = 0;
  let haloScale = low ? 0.3 : 0.15;
  let adaptOn = true;
  let logAdapt = 0;
  let viewClock = 1e9, viewLaf = 0;
  let snap = true;             // first frame / time jump: no easing

  // ------------------------------------------------------------------ fires
  function toWorld(pos) {
    if (pos?.isVector3) return pos.clone();
    if (Array.isArray(pos)) return m2w(pos[0], pos[1], pos[2] ?? 0);
    return new Vector3();
  }

  function scheduleFactor(f) {
    if (f.schedule === 'night') return smooth(3, -3, sunAltitude(ctx)); // lit around sunset, out after sunrise
    if (f.schedule === 'day') return smooth(-3, 3, sunAltitude(ctx));   // render-env-2: 1 − the night factor (a day hearth)
    return 1;
  }

  function buildFire(f) {
    const P = f.preset;
    const rnd = mulberry(f.seedInt);
    const size = f.size;
    const nT = P.tongues[ti];
    f.tongues = [];
    for (let i = 0; i < nT; i++) {
      // central tongues tallest; outer ones lower and wider apart
      const ring = nT === 1 ? 0 : Math.sqrt((i + 0.5) / nT);
      const a = i * 2.39996 + rnd() * 0.6;
      const r = ring * P.spread * size;
      const tall = 1 - 0.55 * ring;
      const h = size * (P.tongueH[0] + (P.tongueH[1] - P.tongueH[0]) * (0.35 * rnd() + 0.65 * tall));
      const w = size * (P.tongueW[0] + (P.tongueW[1] - P.tongueW[0]) * rnd());
      const slot = flames.alloc();
      f.tongues.push({ ox: Math.cos(a) * r, oz: Math.sin(a) * r, w, h, seed: rnd() * 10, slot, speed: P.speed * (0.85 + 0.3 * rnd()), turb: P.turb * (0.85 + 0.3 * rnd()) });
    }
    f.halo = halos.alloc();
    f.bed = P.bed ? beds.alloc() : null;
    f.emberSlots = [];
    const nE = P.embers[ti];
    for (let i = 0; i < nE; i++) {
      const s = embers.alloc();
      if (!s) break;
      f.emberSlots.push({ slot: s, seed: rnd() * 100, rate: P.emberRate[0] + (P.emberRate[1] - P.emberRate[0]) * rnd() });
    }
    // smoke
    const wantSmoke = f.spec.smoke ?? !!P.smoke;
    const sp = P.smoke;
    if (wantSmoke && sp && ti >= (sp.minTier ?? 0)) {
      // render-env-2: a big pile makes more smoke than a small one, not only a wider column: the smoke flux grows with
      // the burning area (∝ size²) while the column's width and rise speed grow ≈ ∝ size, so its optical depth ∝ size
      // (softened): the great pile's column is denser as well as wider than the small piles' thin ones
      const k = f.kind === 'pyre' ? size / P.refSize : 1;
      f.smoke = addColumn({
        pos: f.pos, height: sp.height * (f.kind === 'pyre' ? Math.sqrt(k) : 1),
        width: Math.max(sp.width * size, 0.05), density: sp.density * Math.min(1.5, Math.max(0.3, k ** 0.8)), rise: sp.rise, spread: sp.spread,
        kind: sp.kind, fire: f, seed: f.seedInt,
      });
    }
    writeFire(f);
  }

  function writeFire(f) {
    const inten = f.cur;
    // overlap-aware emission so a 12-tongue pyre doesn't saturate to white at its base
    const bright = f.tongues.length > 2 ? Math.pow(3 / f.tongues.length, 0.35) : 1;
    const L = f.lean;
    for (const t of f.tongues) {
      flames.set(t.slot, 'iPos', f.pos.x + t.ox, f.pos.y, f.pos.z + t.oz);
      flames.set(t.slot, 'iSize', t.w, t.h);
      flames.set(t.slot, 'iParams', t.seed, inten, t.turb, t.speed);
      flames.set(t.slot, 'iLean', L.x, L.y, bright, f.L);
    }
    const hp = f.preset.halo;
    halos.set(f.halo, 'iPos', f.pos.x, f.pos.y + f.size * 0.45, f.pos.z);
    halos.set(f.halo, 'iParams', hp.radius * f.size, hp.frac * f.L * f.cur * haloScale, f.seedInt % 97, 0);
    halos.set(f.halo, 'iColor', f.color.r, f.color.g, f.color.b);
    const P = f.preset;
    if (f.bed) {
      beds.set(f.bed, 'iPos', f.pos.x, f.pos.y, f.pos.z);
      beds.set(f.bed, 'iParams', Math.max(0.05, P.spread * f.size * P.bed), (P.Lbed || 0) * f.cur, (f.seedInt % 89) / 13, 0);
    }
    for (const e of f.emberSlots) {
      embers.set(e.slot, 'iPos', f.pos.x, f.pos.y + f.size * 0.15, f.pos.z);
      embers.set(e.slot, 'iParams', e.seed, P.spread * f.size * 0.8 + 0.02, P.emberRise * f.size, (P.Lember || 0) * f.cur);
      embers.set(e.slot, 'iParams2', e.rate, P.emberSize * Math.sqrt(f.size / P.refSize));
    }
  }

  function freeFire(f) {
    for (const t of f.tongues || []) flames.free(t.slot);
    halos.free(f.halo);
    if (f.bed) beds.free(f.bed);
    for (const e of f.emberSlots || []) embers.free(e.slot);
    if (f.smoke) removeColumn(f.smoke);
    f.tongues = []; f.emberSlots = []; f.halo = null; f.bed = null; f.smoke = null;
  }

  function makeHandle(f) {
    return {
      id: f.id,
      kind: f.kind,
      fire: f,
      setIntensity(v) { f.target = Math.max(0, v); },
      setPosition(p) { f.pos.copy(toWorld(p)); f.moved = true; lights.structureDirty = true; },
      remove() { api.remove(f.id); },
    };
  }

  function add(spec = {}) {
    const kind = spec.kind || 'torch';
    const preset = kindPreset(kind);
    let id = spec.id || `fire-${++auto}`;
    if (fires.has(id)) {
      console.warn(`[fx] duplicate fire id "${id}" — renamed`);
      id = `${id}#${++auto}`;
    }
    const size = Number.isFinite(spec.size) && spec.size > 0 ? spec.size : preset.refSize;
    const color = new Color(spec.color ?? preset.light?.color ?? 0xff9040);
    const f = {
      id, kind, preset, spec, size, color,
      pos: toWorld(spec.pos),
      schedule: spec.schedule || 'always',
      target: Number.isFinite(spec.intensity) ? spec.intensity : 1,
      cur: 0,
      follow: spec.follow || null,
      offset: spec.offset ? new Vector3().fromArray(spec.offset) : new Vector3(),
      lean: new Vector2(), prevPos: null,
      seedInt: hashStr(id), seed: (hashStr(id) % 1000) / 37,
      lightPos: new Vector3(),
      lightColor: color.clone(),
      L: Number.isFinite(spec.luminance) ? spec.luminance : preset.L,
      // light:false — the flames, coal bed, glow and smoke stay, but no point light (and no room fill, no
      // adaptation): small piles beside a great one (render-env-2)
      lightCandela: spec.light === false ? 0 : (preset.light?.candela ?? 0) * (size / preset.refSize) ** 2,
      glowCandela: (preset.light?.candela ?? 0) * (size / preset.refSize) ** 2, // what lights its own smoke from below
      lightDistance: (preset.light?.distance ?? 10) * Math.max(0.6, size / preset.refSize),
    };
    if (f.follow) updateFollow(f, 0);
    f.cur = f.target * scheduleFactor(f);
    // where its light sits, now: env meters fires before fx's first update (boot, interiors)
    f.lightPos.set(f.pos.x, f.pos.y + f.size * (preset.light?.height ?? 0.5), f.pos.z);
    buildFire(f);
    fires.set(id, f);
    lights.structureDirty = true;
    f.handle = makeHandle(f);
    return f.handle;
  }

  function updateFollow(f, dt) {
    const o = f.follow;
    o.updateWorldMatrix(true, false);
    _v.copy(f.offset);
    o.localToWorld(_v);
    if (f.prevPos && dt > 0) {
      // flames trail behind a carried torch: tip displaced against the velocity
      const vx = (_v.x - f.prevPos.x) / dt;
      const vz = (_v.z - f.prevPos.z) / dt;
      const k = 1 - Math.exp(-dt * 6);
      f.lean.x += (Math.max(-0.6, Math.min(0.6, -vx * 0.12)) - f.lean.x) * k;
      f.lean.y += (Math.max(-0.6, Math.min(0.6, -vz * 0.12)) - f.lean.y) * k;
    }
    f.prevPos = (f.prevPos || new Vector3()).copy(_v);
    f.pos.copy(_v);
  }

  function attachTorch(object3D, opts = {}) {
    if (!(object3D instanceof Object3D)) throw new Error('fx.attachTorch: object3D required');
    return add({
      id: opts.id, kind: opts.kind || 'torch', size: opts.size, intensity: opts.intensity ?? 1,
      color: opts.color, schedule: opts.schedule || 'always', smoke: opts.smoke,
      follow: object3D, offset: opts.offset || [0, 0, 0],
    });
  }

  // ------------------------------------------------------------------ smoke columns
  function addColumn(o) {
    const kindNum = o.kind === 'incense' || o.kind === 1 ? 1 : 0;
    const col = {
      pos: toWorld(o.pos), height: o.height ?? 30, width: o.width ?? 1, density: o.density ?? 0.5,
      rise: o.rise ?? (kindNum ? 0.8 : 2.2), spread: o.spread ?? (kindNum ? 1.3 : 3.0),
      kind: kindNum, fire: o.fire || null, seed: ((o.seed ?? hashStr(String(Math.random()))) % 1000) / 1000,
      slots: [], glow: new Color(0, 0, 0), intensity: 1,
    };
    if (col.fire) col.pos = col.fire.pos; // shares the Vector3: follows the fire
    allocColumn(col);
    columns.add(col);
    return col;
  }

  function allocColumn(col) {
    for (const s of col.slots) smoke.free(s);
    col.slots = [];
    const n = (col.kind ? INCENSE_PUFFS : SMOKE_PUFFS)[ti];
    for (let i = 0; i < n; i++) { const s = smoke.alloc(); if (s) col.slots.push(s); }
    writeColumn(col);
  }

  function writeColumn(col) {
    const n = col.slots.length;
    const k = col.fire ? col.fire.cur : col.intensity;
    for (let i = 0; i < n; i++) {
      const s = col.slots[i];
      smoke.set(s, 'iPos', col.pos.x, col.pos.y, col.pos.z);
      smoke.set(s, 'iCol', col.height, col.width, col.density * SMOKE_DENSITY[ti] * Math.min(1, k), col.seed * 7 + i * 0.13);
      smoke.set(s, 'iPuff', (i + col.seed) / n, col.kind, col.rise, col.spread);
      smoke.set(s, 'iGlow', col.glow.r, col.glow.g, col.glow.b);
      smoke.set(s, 'iMisc', n, 0);
    }
  }

  function removeColumn(col) {
    for (const s of col.slots) smoke.free(s);
    col.slots = [];
    columns.delete(col);
  }

  function smokeColumn(o = {}) {
    const col = addColumn(o);
    return {
      column: col,
      set(p = {}) {
        if (p.height != null) col.height = p.height;
        if (p.width != null) col.width = p.width;
        if (p.density != null) col.density = p.density;
        if (p.pos) col.pos = toWorld(p.pos);
        writeColumn(col);
      },
      setIntensity(v) { col.intensity = Math.max(0, v); writeColumn(col); },
      remove() { removeColumn(col); },
    };
  }

  // ------------------------------------------------------------------ per-frame
  function consumeCtxFires() {
    for (const spec of ctx.fires) {
      if (seen.has(spec)) continue;
      seen.add(spec);
      try { add(fromCtxSpec(spec)); } catch (e) { console.warn('[fx] bad fire spec', spec, e); }
    }
  }

  /**
   * ctx.addFire (core/context.js) fills `size: 1` when a builder omits it, which would turn an oil lamp into a
   * 1 m flame (and its light into ~470 cd). A 1 m lamp or torch flame is never intended, so for kinds whose
   * reference size is far below 1 m an exact 1 is read as "unspecified" and the preset size is used. Builders
   * should still pass explicit sizes (lamp 0.08, torch 0.35, brazier 0.6, hearth 0.8, pyre 1.5–2.5).
   */
  function fromCtxSpec(spec) {
    if (spec.size !== 1 || kindPreset(spec.kind || 'torch').refSize >= 0.5) return spec;
    return { ...spec, size: undefined };
  }

  function update(dt) {
    time += dt;
    const sh = mats.shared;
    sh.uTime.value = time;
    consumeCtxFires();
    const env = ctx.env || {};
    const fireScale = Number.isFinite(env.fireScale) ? env.fireScale : 1;
    const ex = ctx.post?.exposureTotal ?? exposure(ctx);
    sh.uCap.value = (low ? EMISSION_CAP.low : EMISSION_CAP.post) / Math.max(ex, 1e-6);
    const fog = ctx.scene.fog;
    if (fog?.isFogExp2) sh.uFog.value.set(2, fog.density, 0, 1);
    else if (fog?.isFog) sh.uFog.value.set(1, 0, fog.near, fog.far);
    else sh.uFog.value.set(0, 0, 0, 1);
    if (fog) sh.uFogColor.value.copy(fog.color);
    const ease = snap ? 1 : 1 - Math.exp(-dt * 1.8);
    for (const f of fires.values()) {
      const tgt = f.target * scheduleFactor(f);
      const prev = f.cur;
      f.cur += (tgt - f.cur) * ease;
      if (f.follow) updateFollow(f, dt);
      const hgt = f.size * (f.preset.light?.height ?? 0.5);
      f.lightPos.set(f.pos.x, f.pos.y + hgt, f.pos.z);
      if (f.follow || f.moved || Math.abs(prev - f.cur) > 1e-4 || snap) {
        writeFire(f);
        f.moved = false;
      }
    }
    const La = env.luminance;
    let target = 0;
    lights.visibility = env.interiors ? env.interiors.at : null;
    lights.interiors = env.interiors || null;
    if (adaptOn && Number.isFinite(La) && La > 0) {
      // fires in the viewer's own room are metered by env (interiors); the rest adapt locally, through the walls
      const E = illuminanceAt(ctx.camera.position, { split: true });
      let Laf = (0.6 * ADAPT_ALBEDO * Math.max(0, E.all - E.sameS)) / Math.PI;
      // render-env-2: …and to the firelit surfaces in view — the Heichal's facade lit by the altar seen over the courts'
      // walls from the dark Mount, where the camera itself (behind the walls) receives no firelight at all
      viewClock += dt;
      if (snap || env.adaptSnap || viewClock > VIEW_PERIOD) { viewClock = 0; viewLaf = viewFireLuminance(); }
      Laf = Math.max(Laf, VIEW_WEIGHT * viewLaf);
      target = ADAPT_SLOPE * Math.log(La / (La + Laf));
    }
    // real time (τ ADAPT_TAU) plus sim time (τ 0.5 sim-min, as env's meter): keeps up in a 600× time-lapse
    const simDt = Math.abs(ctx.time?.frameDelta || 0);
    // snaps with env's exposure (boot, clock jumps), else eases
    const hard = snap || !!env.adaptSnap;
    logAdapt += (target - logAdapt) * (hard ? 1 : 1 - Math.exp(-(dt / ADAPT_TAU + simDt / 0.5)));
    const P = (Number.isFinite(env.preExposure) && env.preExposure > 0 ? env.preExposure : FALLBACK_P) * fireScale * Math.exp(logAdapt);
    sh.uP.value = P;
    sh.uFireGain.value = Math.min(1, (FIRE_CORE_HEADROOM * sh.uCap.value) / (FIRE_REF_CORE * P));
    if (env.whiteBalance?.isVector3) sh.uWB.value.copy(env.whiteBalance);
    // smoke: the fire beneath lights it (physical cd; the shader applies inverse square × uP)
    for (const col of columns) {
      const f = col.fire;
      if (f) {
        col.glow.copy(f.color).multiplyScalar(f.glowCandela * f.cur);
        writeColumn(col);
      }
    }
    const su = mats.smoke.uniforms;
    const dl = envDirLights(ctx);
    sunDir(ctx, su.uSunDir.value);
    if (env.keyDir?.isVector3) su.uSunDir.value.copy(env.keyDir); // sun by day, moon by night
    lightIrradiance(dl[0], su.uSunColor.value);
    ambientRadiance(ctx, su.uSky.value, su.uGround.value);
    // lights
    if (lights.structureDirty) { lights.cluster([...fires.values()]); lights.structureDirty = false; }
    lights.update(dt, ctx.camera.position, time, P);
    // the glint is lit by the Sun at env's exposure (not the fires' local adaptation); its size in the target's pixels
    const size = low ? ctx.renderer.getDrawingBufferSize(_sz) : sh.uResolution.value;
    if (size.y >= 16 && Number.isFinite(env.preExposure)) glint.update(dt, env.preExposure, low, size);
    else glint.mesh.visible = false;
    flames.flush(); halos.flush(); embers.flush(); smoke.flush(); beds.flush();
    snap = false;
  }

  /**
   * Mean luminance (cd/m², physical) that the fires give the surfaces in view, along a few rays from the camera
   * (centre-weighted, ctx.physics BVH): ADAPT_ALBEDO × E / π at each hit, misses count 0. Fires in the hit point's own
   * room are left out (env meters a room's own fires).
   */
  const _vd = new Vector3(), _vp = new Vector3();
  function viewFireLuminance() {
    const ph = ctx.physics, cam = ctx.camera;
    if (typeof ph?.raycast !== 'function' || !fires.size) return 0;
    const th = Math.tan(((cam.fov || 60) * Math.PI) / 360);
    let sum = 0;
    for (const [x, y, w] of VIEW_RAYS) {
      _vd.set(x * th * (cam.aspect || 1), y * th, -1).normalize().applyQuaternion(cam.quaternion);
      let hit = null;
      try { hit = ph.raycast(cam.position, _vd, VIEW_FAR); } catch { hit = null; }
      if (!hit?.point) continue;
      _vp.copy(hit.point).addScaledVector(_vd, -0.08);
      const E = illuminanceAt(_vp, { split: true });
      sum += w * Math.max(0, E.all - E.same);
    }
    return (ADAPT_ALBEDO * sum) / Math.PI;
  }

  /**
   * Physical illuminance (lux) from the burning fires at a world point — for eye adaptation. With env's interiors
   * a fire in another room counts only through both rooms' openings. opts.sameVolume: only fires in the point's
   * own room (0 outdoors); opts.split: returns { all, same, sameS } (sameS = same × how far the point is inside).
   * opts.rendered: each fire weighted by the luminance of its light colour, i.e. what its point light renders
   * (three scales intensity × colour: a lamp's (1, 0.46, 0.16) renders 55 % of its candela). opts.color: a Color
   * that receives the counted fires' light colour, weighted by their contribution (lighting-polish-fix).
   */
  const _ins = { V: 1, vol: null, s: 0 };
  function illuminanceAt(pos, opts = {}) {
    if (fires.size < ctx.fires.length) consumeCtxFires(); // env meters before fx's first update (boot)
    const I = ctx.env?.interiors;
    const at = I?.at;
    const ins = at ? at(pos, _ins) : null;
    let E = 0, Es = 0, cr = 0, cg = 0, cb = 0;
    for (const f of fires.values()) {
      if (!f.lightCandela || f.cur <= 0) continue;
      const d2 = Math.max(f.lightPos.distanceToSquared(pos), 1);
      let k = 1, same = !ins || !ins.vol;
      if (ins) {
        if (!f.ins || f.follow || f.insAt !== f.lightPos.x + f.lightPos.y + f.lightPos.z) {
          f.ins = at(f.lightPos, f.ins || { V: 1, vol: null, s: 0 });
          f.insAt = f.lightPos.x + f.lightPos.y + f.lightPos.z;
          // a static open-air fire's occluder record: the court's walls, the altar's top (render-env-2)
          f.rec = !f.follow && I?.fireRecord ? I.fireRecord(f.lightPos) : -1;
          f.recR = I?.fireRadius ? I.fireRadius(f.size) : 0.3;
        }
        same = f.ins.vol === ins.vol;
        if (!same) k = f.ins.V * (ins.Vap ?? ins.V); // the receiver's room lets a light in through its apertures only
        else if (!ins.vol && f.rec >= 0) k = I.fireVisibility(f.rec, f.lightPos, pos, f.recR);
      }
      const lc = f.lightColor;
      const e = ((f.lightCandela * f.cur) / d2) * (opts.rendered ? 0.2126 * lc.r + 0.7152 * lc.g + 0.0722 * lc.b : 1);
      E += e * k;
      if (same && ins?.vol) Es += e;
      if (opts.color && (!opts.sameVolume || (same && ins?.vol))) { const w = opts.sameVolume ? e : e * k; cr += lc.r * w; cg += lc.g * w; cb += lc.b * w; }
    }
    if (opts.color) { const w = cr + cg + cb; if (w > 0) opts.color.setRGB(cr / w * 3, cg / w * 3, cb / w * 3); else opts.color.setRGB(1, 1, 1); }
    if (opts.split) return { all: E, same: Es, sameS: Es * (ins?.s || 0) };
    return opts.sameVolume ? Es : E;
  }

  /** Soft-depth inputs for the post tiers (FXPass calls this before drawing). */
  function setDepth(depthTexture, width, height, camera) {
    const s = mats.shared;
    s.uDepth.value = depthTexture;
    s.uResolution.value.set(width, height);
    s.uNearFar.value.set(camera.near, camera.far);
  }

  function setMode({ tier: t, soft: sft }) {
    const nti = TIER_INDEX[t] ?? ti;
    const tierChanged = nti !== ti;
    ti = nti;
    low = ti === 0;
    haloScale = low ? 0.3 : 0.15; // bloom provides the glare on post tiers
    setFxMaterialMode(mats, { soft: sft, low });
    lights.setMax(ctx.quality?.maxFireLights ?? lights.max, shadowCfg());
    lights.structureDirty = true;
    if (tierChanged) {
      // rebuild instance allocations at the new detail
      const list = [...fires.values()];
      const freeCols = [...columns].filter((c) => !c.fire);
      for (const f of list) freeFire(f);
      for (const f of list) buildFire(f);
      for (const c of freeCols) allocColumn(c);
    }
  }

  const api = {
    scene,
    materials: mats,
    get fires() { return fires; },
    add,
    attachTorch,
    smokeColumn,
    setFire(id, intensity) {
      const f = fires.get(id);
      if (!f) { console.warn(`[fx] setFire: unknown fire "${id}"`); return; }
      f.target = Math.max(0, intensity);
    },
    remove(h) {
      if (!h) return;
      if (h.column) { removeColumn(h.column); return; }
      const id = typeof h === 'string' ? h : h.id;
      const f = fires.get(id);
      if (!f) return;
      freeFire(f);
      fires.delete(id);
      lights.structureDirty = true;
    },
    list() { return [...fires.values()].map((f) => ({ id: f.id, kind: f.kind, intensity: f.cur, pos: f.pos.clone() })); },
    /** the fire point lights in three's shader order (env/interiors assigns each to its room) */
    pointLights() { return lights.shaderOrder(); },
    /**
     * temporarily assign the plain light slots as seen from a world point (probe captures), at env's exposure
     * without the viewer's local adaptation to firelight (the probe is normalised by env's exposure); returns restore()
     */
    lightsFor(pos, { adapted = false } = {}) {
      const env = ctx.env || {};
      const fireScale = Number.isFinite(env.fireScale) ? env.fireScale : 1;
      // adapted (render-env-2-fix): at fx's own gain, the viewer's local adaptation to firelight included — a porch lit by
      // open-air fires (the Ulam) is seen in the same light as their point lights render it in the frame
      if (adapted) return lights.assignFor(pos, mats.shared.uP.value);
      return lights.assignFor(pos, (Number.isFinite(env.preExposure) && env.preExposure > 0 ? env.preExposure : FALLBACK_P) * fireScale);
    },
    /** fx's gain over env's exposure: the viewer's local adaptation to firelight (≤ 1) */
    get fireAdaptation() {
      const env = ctx.env || {};
      const P0 = (Number.isFinite(env.preExposure) && env.preExposure > 0 ? env.preExposure : FALLBACK_P) * (Number.isFinite(env.fireScale) ? env.fireScale : 1);
      return mats.shared.uP.value / P0;
    },
    update,
    illuminanceAt,
    setDepth,
    setMode,
    snap() { snap = true; },
    setAdaptation(on) { adaptOn = !!on; },
    /**
     * scene units per cd/m² of fire emission, as fx's own flames, embers and coal beds use it: env.preExposure ×
     * fireScale × the local adaptation to firelight × the flame-core gain (materials' glowing embers; materials-2 request)
     */
    get emissionScale() { return mats.shared.uP.value * mats.shared.uFireGain.value; },
    /** internal (dev scripts): the light pool */
    get _lights() { return lights; },
    get stats() {
      return {
        fires: fires.size, columns: columns.size, lights: lights.active ?? 0, maxLights: lights.max,
        shadowLights: lights.pools[0]?.lights.length ?? 0,
        flames: flames.count, embers: embers.count, puffs: smoke.count, P: +mats.shared.uP.value.toPrecision(3),
        adaptation: +Math.exp(logAdapt).toPrecision(3), viewLaf: +viewLaf.toPrecision(3),
        glint: glint.mesh.visible ? { I: +glint.stats.I.toPrecision(3), sparks: glint.stats.n, vis: +glint.stats.vis.toFixed(2), L0: +glint.stats.L0.toPrecision(3) } : null,
      };
    },
    dispose() {
      for (const b of [flames, halos, embers, smoke, beds]) b.dispose();
      for (const m of [mats.flame, mats.halo, mats.ember, mats.smoke, mats.bed, mats.glint]) m.dispose();
      glint.dispose();
      lights.dispose();
    },
  };
  return api;
}
