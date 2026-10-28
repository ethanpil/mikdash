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
//   ctx.fx.smokeColumn({ pos, height, width, density, kind:'wood'|'incense', rise, base }) -> handle
//                                         base: height (m) above pos where the visible smoke begins (default 0)
//   ctx.fx.remove(handle | id)
//   ctx.fx.emissionScale                  scene units per cd/m² of fire emission as fx's own flames, embers and beds use
//                                         it (env.preExposure × fireScale × local fire adaptation × flame-core gain):
//                                         for emissive materials that glow with the fires (materials' embers)
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
// core (1.6 × 2e4 cd/m²: a card's body peak plus its added hot core, qa-r1-fix-env-render) lands at
// FIRE_CORE_HEADROOM × the display cap (then soft-capped). Below that (daylight) the gain is 1. Without it every part
// of a night fire sits far above the cap and the soft cap flattens core, body and tips into one cream mass.
const FIRE_REF_CORE = 1.6 * 2.0e4;
const FIRE_CORE_HEADROOM = 1.8;
// render-env-2: local adaptation also to the firelit surfaces in view (rays in screen-fraction units of the half fov)
// [x, y, weight]: the centre (what one looks at) counts most
const VIEW_RAYS = [[0, 0, 0.4], [0.4, 0.1, 0.15], [-0.4, 0.1, 0.15], [0, 0.45, 0.15], [0, -0.35, 0.15]];
const VIEW_PERIOD = 0.2; // s between samplings
const VIEW_FAR = 600;    // m
const VIEW_WEIGHT = 0.6; // share of the view the sampled surfaces stand for (as the camera term's 0.6)
const SAME_ROOM_VIEW = 0.5; // how much of the excess of the own room's firelit view over env's room meter adapts the eye
// gate-env-render: looking from the dark into a firelit court through its gate (the opening frame: the Mount before dawn,
// the Ezrat Nashim's east gate showing the Heichal's facade lit by the altar at ≈ 50 lx, 13 stops over the moonlit wall
// round it), the eye adapts LOCALLY to what the opening shows. The open fires whose light does not reach the viewer (the
// court's walls hide them: camK) take an extra gain that holds the firelit surfaces seen through a court's open gate to
// GATE_OVER × env's adaptation level — ≈ 2 stops over the wall, not clipped — while the fires that do light the viewer
// (the Mount's watch torches) keep the eye's own adaptation. Sampled by rays from the eye through a grid on the opening
// (GATE_GRID, fractions of its half width and of its height)
const GATE_OVER = 5;
const GATE_GRID = [[-0.55, 0.3], [0, 0.3], [0.55, 0.3], [-0.55, 0.6], [0, 0.6], [0.55, 0.6], [-0.55, 0.88], [0, 0.88], [0.55, 0.88]];
const GATE_FAR = 320; // m: gates farther than this are not sampled
// gate-env-render: the light the Ezrat Nashim's east gate throws onto the chel steps and the pavement before it (fx/materials
// SPILL_FS): the gate, the steps whose treads receive it, how far out onto the pavement and to either side its patch runs
// (amot), the firelit court's albedo as the measuring rays see it, and the flicker of the torches' share of its light
const SPILL = { gate: 'en.gate.east', steps: 'mount.chel.steps', out: 45, side: 30, albedo: 0.5, far: 400, torch: 0.22, fire: 0.06 };
// …and its own local adaptation: from the pavement 20 m out the opening shows the facade, lit at ≈ 50 lx, and lays ≈ 0.2 lx on
// the stone (≈ 10 × the moonlight); near the steps it shows the sky above the facade and little else. The patch is soft-capped
// at SPILL_OVER × env's adaptation level (the eye adapts to a lit patch as to the gate, GATE_OVER)
const SPILL_OVER = 3;
// the opening's luminance table: ray slopes SPILL_S0 + k × SPILL_DS (k 0 … 7, rising inward), rays at these heights of the
// opening (fractions), re-measured every SPILL_PERIOD s (the court's light is static; the flicker is applied analytically)
const SPILL_S0 = -0.1, SPILL_DS = 0.15, SPILL_ROWS = [0.3, 0.7], SPILL_PERIOD = 0.5;
const TORCH = new Set(['torch']);

const TIER_INDEX = { low: 0, medium: 1, high: 2, ultra: 3 };
// the open fires: heat shimmer over them (post tiers; render/post-effects.js HeatHazeEffect, the plumes in view, by screen
// size) and the local adaptation to their light in the viewer's own room
const OPEN_FIRES = new Set(['pyre', 'hearth', 'brazier']);
const HAZE_MAX = 4;
const HAZE_RAD = 3e-3;   // rad of deflection at the reference pile size (2 m); ∝ √size (a deeper plume)
const HAZE_PX = 4;       // cap, pixels
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
  const flames = new InstanceBatch('flames', { iPos: 3, iSize: 2, iParams: 4, iLean: 4, iCore: 1, iLayer: 2 }, 1024);
  const halos = new InstanceBatch('halos', { iPos: 3, iParams: 4, iColor: 3 }, 512, { x0: -1, x1: 1, y0: -1, y1: 1 });
  const embers = new InstanceBatch('embers', { iPos: 3, iParams: 4, iParams2: 2 }, 4096);
  const beds = new InstanceBatch('beds', { iPos: 3, iParams: 4, iChar: 2 }, 512, 'box');
  const smoke = new InstanceBatch('smoke', { iPos: 3, iCol: 4, iPuff: 4, iGlow: 3, iMisc: 2 }, 4096, { x0: -1, x1: 1, y0: -1, y1: 1 });
  const spills = new InstanceBatch('spill', { iRect: 4, iY: 1 }, 32);
  // draw order: the coal-bed decal (it chars and lights the scene's own surfaces), smoke (alpha), additive glow, flames,
  // embers on top
  scene.add(beds.makeMesh(mats.bed));
  scene.add(smoke.makeMesh(mats.smoke));
  scene.add(halos.makeMesh(mats.halo));
  scene.add(flames.makeMesh(mats.flame));
  scene.add(embers.makeMesh(mats.ember));
  scene.add(spills.makeMesh(mats.spill));
  spills.mesh.renderOrder = -1;
  beds.mesh.renderOrder = 0; smoke.mesh.renderOrder = 1; halos.mesh.renderOrder = 2; flames.mesh.renderOrder = 3; embers.mesh.renderOrder = 4;
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
  let viewClock = 1e9, viewLaf = 0, viewLafSame = 0, gateLaf = 0, logGate = 0, gateClock = 1e9;
  const _vl = { same: 0 };
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
    // qa-r1-fix-env-render: a few wide soft cards (procedural flipbooks) instead of a dozen narrow tongue sprites — the
    // card over the fuel's centre is the widest and tallest, the rest stand on a small ring round it at their own phase
    const nC = P.cards[ti];
    f.tongues = [];
    // gate-env-render: a pyre's cards are LAYERS (P.layers, presets.js): the envelope over the fuel's centre first, the body
    // tongues on their ring, the hot core last (drawn over them); each its own size, scroll speed, temperature and opacity
    const lay = P.layers && nC >= 3 ? P.layers : null;
    for (let i = 0; i < nC; i++) {
      const role = !lay ? (i > 0 ? 'body' : 'centre') : i === 0 ? 'envelope' : i === nC - 1 ? 'core' : 'body';
      const L = lay ? lay[role] || lay.body : null;
      const outer = role === 'body';
      const a = i * 2.39996 + rnd() * 0.8;
      const r = outer ? P.ringR * size * (0.75 + 0.5 * rnd()) : 0;
      const k = outer ? 0 : 1;
      const h = size * (P.cardH[0] + (P.cardH[1] - P.cardH[0]) * k) * (0.9 + 0.2 * rnd()) * (L?.h ?? 1);
      const w = size * (P.cardW[0] + (P.cardW[1] - P.cardW[0]) * k) * (0.9 + 0.2 * rnd()) * (L?.w ?? 1);
      const slot = flames.alloc();
      f.tongues.push({
        ox: Math.cos(a) * r, oz: Math.sin(a) * r, w, h, seed: rnd() * 10, slot,
        speed: P.speed * (0.85 + 0.3 * rnd()) * (L?.speed ?? 1), turb: P.turb * (0.85 + 0.3 * rnd()) * (L?.turb ?? 1),
        tBoost: L?.t ?? 0, occ: L?.occ ?? 1, core: (P.core ?? 1.4) * (L?.core ?? 1),
      });
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
        // the visible smoke begins where the flames end (a thin base there, thickening as it rises)
        base: 0.75 * size * P.cardH[1],
      });
    }
    writeFire(f);
  }

  function writeFire(f) {
    const inten = f.cur;
    // overlap-aware emission: the cards overlap over the fuel, so their sum must not saturate there
    const bright = f.tongues.length > 1 ? Math.pow(1 / f.tongues.length, 0.22) : 1;
    const L = f.lean;
    for (const t of f.tongues) {
      flames.set(t.slot, 'iPos', f.pos.x + t.ox, f.pos.y, f.pos.z + t.oz);
      flames.set(t.slot, 'iSize', t.w, t.h);
      flames.set(t.slot, 'iParams', t.seed, inten, t.turb, t.speed);
      flames.set(t.slot, 'iLean', L.x, L.y, bright, f.L * (f.gain ?? 1));
      flames.set(t.slot, 'iCore', t.core);
      flames.set(t.slot, 'iLayer', t.tBoost, t.occ);
    }
    const hp = f.preset.halo;
    halos.set(f.halo, 'iPos', f.pos.x, f.pos.y + f.size * 0.45, f.pos.z);
    const gk = f.gain ?? 1;
    halos.set(f.halo, 'iParams', hp.radius * f.size, hp.frac * f.L * f.cur * haloScale * gk, f.seedInt % 97, 0);
    halos.set(f.halo, 'iColor', f.color.r, f.color.g, f.color.b);
    const P = f.preset;
    if (f.bed) {
      beds.set(f.bed, 'iPos', f.pos.x, f.pos.y, f.pos.z);
      beds.set(f.bed, 'iParams', Math.max(0.05, P.spread * f.size * P.bed), (P.Lbed || 0) * f.cur * gk, (f.seedInt % 89) / 13, (P.bedH ?? 0.42) * f.size);
      beds.set(f.bed, 'iChar', P.charR ?? 1, P.ash ?? 0);
    }
    for (const e of f.emberSlots) {
      embers.set(e.slot, 'iPos', f.pos.x, f.pos.y + f.size * 0.15, f.pos.z);
      embers.set(e.slot, 'iParams', e.seed, P.spread * f.size * 0.8 + 0.02, P.emberRise * f.size, (P.Lember || 0) * f.cur * gk);
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
      rise: o.rise ?? (kindNum ? 0.8 : 2.2), spread: o.spread ?? (kindNum ? 1.3 : 3.0), base: Math.max(0, o.base ?? 0),
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
      smoke.set(s, 'iMisc', n, col.base);
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
      if (snap || env.adaptSnap || viewClock > VIEW_PERIOD) { viewClock = 0; viewLaf = viewFireLuminance(_vl); viewLafSame = _vl.same; }
      // gate-env-render: the gates' rays once a jump (not in each of env's snap frames) and every VIEW_PERIOD
      gateClock += dt;
      if (snap || gateClock > VIEW_PERIOD) { gateClock = 0; gateLaf = gateFireLuminance(); markHidden(); }
      Laf = Math.max(Laf, VIEW_WEIGHT * viewLaf);
      // qa-r1-fix-env-render: …and, centre-weighted, to half of what the viewer's own room's fires light in view beyond
      // env's whole-room meter (La): looking at the Moked's hearth from beside it, the floor round it was 4 stops over
      // the hall's mean and burned white (half: the eye adapts to a bright patch only in part)
      Laf = Math.max(Laf, SAME_ROOM_VIEW * (VIEW_WEIGHT * viewLafSame - La));
      target = ADAPT_SLOPE * Math.log(La / (La + Laf));
    }
    // gate-env-render: the hidden fires' extra gain (GATE_OVER above), on top of the eye's adaptation
    const gateTarget = adaptOn && gateLaf > 0 && Number.isFinite(La) && La > 0 ? Math.min(0, Math.log((GATE_OVER * La) / (gateLaf * Math.exp(target)))) : 0;
    // real time (τ ADAPT_TAU) plus sim time (τ 0.5 sim-min, as env's meter): keeps up in a 600× time-lapse
    const simDt = Math.abs(ctx.time?.frameDelta || 0);
    // snaps with env's exposure (boot, clock jumps), else eases
    const hard = snap || !!env.adaptSnap;
    const adaptK = hard ? 1 : 1 - Math.exp(-(dt / ADAPT_TAU + simDt / 0.5));
    logAdapt += (target - logAdapt) * adaptK;
    logGate += (gateTarget - logGate) * adaptK;
    const gateGain = Math.exp(logGate);
    for (const f of fires.values()) {
      const g = f.hidden ? gateGain : 1;
      if (Math.abs(g - (f.gain ?? 1)) > 2e-3 * Math.max(g, 1e-3)) { f.gain = g; writeFire(f); }
    }
    const P = (Number.isFinite(env.preExposure) && env.preExposure > 0 ? env.preExposure : FALLBACK_P) * fireScale * Math.exp(logAdapt);
    sh.uP.value = P;
    sh.uFireGain.value = Math.min(1, (FIRE_CORE_HEADROOM * sh.uCap.value) / (FIRE_REF_CORE * P));
    if (env.whiteBalance?.isVector3) sh.uWB.value.copy(env.whiteBalance);
    // smoke: the fire beneath lights it (physical cd; the shader applies inverse square × uP)
    for (const col of columns) {
      const f = col.fire;
      if (f) {
        col.glow.copy(f.color).multiplyScalar(f.glowCandela * f.cur * (f.gain ?? 1));
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
    updateSpill(dt);
    flames.flush(); halos.flush(); embers.flush(); smoke.flush(); beds.flush(); spills.flush();
    updateHaze();
    snap = false;
  }

  /** the plumes for the heat shimmer: up to HAZE_MAX static big fires in front of the camera, largest on screen first */
  const haze = { n: 0, a: new Float32Array(HAZE_MAX * 4), b: new Float32Array(HAZE_MAX * 4) };
  const _hz = new Vector3(), _hv = new Vector3();
  const _hs = new Float32Array(HAZE_MAX); // the kept plumes' screen areas (largest first), no per-frame allocation
  function updateHaze() {
    haze.n = 0;
    if (low) return;
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    const P = cam.projectionMatrix.elements;
    const H = Math.max(1, mats.shared.uResolution.value.y);
    const tanHalf = 1 / Math.max(P[5], 1e-6);
    for (const f of fires.values()) {
      if (f.cur < 0.05 || f.follow || !OPEN_FIRES.has(f.kind)) continue;
      const hF = f.size * f.preset.cardH[1];
      // the plume's box: from the flames' middle to about two flame heights above them (the shimmer starts at the tips:
      // post-effects.js HeatHazeEffect)
      _hz.set(f.pos.x, f.pos.y + hF * 1.4, f.pos.z);
      _hv.copy(_hz).applyMatrix4(cam.matrixWorldInverse);
      const z = _hv.z;
      if (z > -0.5) continue;
      const sy = (0.5 * P[5]) / -z, sx = (0.5 * P[0]) / -z; // uv per metre
      const hy = 1.25 * hF * sy, hx = 0.6 * f.size * f.preset.cardW[1] * sx;
      if (hy < 0.015) continue;
      _hz.project(cam);
      if (Math.abs(_hz.x) > 1 + 2 * hx || Math.abs(_hz.y) > 1 + 2 * hy) continue;
      const sc = hx * hy * Math.min(1, f.cur);
      // insertion into the largest-first list of HAZE_MAX
      let i = haze.n;
      while (i > 0 && _hs[i - 1] < sc) i--;
      if (i >= HAZE_MAX) continue;
      for (let j = Math.min(haze.n, HAZE_MAX - 1); j > i; j--) {
        _hs[j] = _hs[j - 1];
        for (let k = 0; k < 4; k++) { haze.a[j * 4 + k] = haze.a[(j - 1) * 4 + k]; haze.b[j * 4 + k] = haze.b[(j - 1) * 4 + k]; }
      }
      const amp = Math.min((HAZE_RAD * Math.sqrt(f.size / 2)) / (2 * tanHalf), HAZE_PX / H) * Math.min(1, f.cur);
      _hs[i] = sc;
      haze.a[i * 4] = _hz.x * 0.5 + 0.5; haze.a[i * 4 + 1] = _hz.y * 0.5 + 0.5; haze.a[i * 4 + 2] = hx; haze.a[i * 4 + 3] = hy;
      haze.b[i * 4] = z; haze.b[i * 4 + 1] = amp; haze.b[i * 4 + 2] = (f.seedInt % 97) / 31; haze.b[i * 4 + 3] = 0;
      haze.n = Math.min(HAZE_MAX, haze.n + 1);
    }
  }

  /**
   * Mean luminance (cd/m², physical) that the fires give the surfaces in view, along a few rays from the camera
   * (centre-weighted, ctx.physics BVH): ADAPT_ALBEDO × E / π at each hit, misses count 0. Fires in the hit point's own
   * room are left out (env meters a room's own fires).
   */
  const _vd = new Vector3(), _vp = new Vector3(), _vi = { V: 1, vol: null, s: 0 }, _vc = { V: 1, vol: null, s: 0 };
  // kodesh-night-fx: how far along (o, d) the ray leaves room v's box, and whether it leaves through one of its open
  // apertures there (env/interiors.js world apertures: centre, normal axis and sign, half extents along the other two
  // axes in order, openness). A physics ray passes what the colliders leave out — curtains (the parochot), door leaves,
  // a slot like the lul — so from inside a room it could end beyond a wall the eye cannot see through.
  const _ro = [0, 0, 0], _rd = [0, 0, 0], _re = [0, 0, 0];
  function roomExit(v, o, d) {
    _ro[0] = o.x; _ro[1] = o.y; _ro[2] = o.z; _rd[0] = d.x; _rd[1] = d.y; _rd[2] = d.z;
    const lo = [v.min.x, v.min.y, v.min.z], hi = [v.max.x, v.max.y, v.max.z];
    let t = Infinity, ax = -1;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(_rd[a]) < 1e-9) continue;
      const ta = ((_rd[a] > 0 ? hi[a] : lo[a]) - _ro[a]) / _rd[a];
      if (ta < t) { t = ta; ax = a; }
    }
    if (!(t > 0) || ax < 0) return { t: Infinity, open: true };
    for (let a = 0; a < 3; a++) _re[a] = _ro[a] + _rd[a] * t;
    const sign = _rd[ax] > 0 ? 1 : -1;
    let open = false;
    for (const ap of v.apertures || []) {
      if (ap.axis !== ax || ap.sign !== sign || !(ap.openness > 0.05)) continue;
      const c = [ap.centre.x, ap.centre.y, ap.centre.z], o2 = [0, 1, 2].filter((k) => k !== ax);
      if (Math.abs(_re[o2[0]] - c[o2[0]]) <= ap.hx && Math.abs(_re[o2[1]] - c[o2[1]]) <= ap.hy) { open = true; break; }
    }
    return { t, open };
  }
  function viewFireLuminance(out = null) {
    const ph = ctx.physics, cam = ctx.camera;
    if (out) out.same = 0;
    if (typeof ph?.raycast !== 'function' || !fires.size) return 0;
    const th = Math.tan(((cam.fov || 60) * Math.PI) / 360);
    // out.same: the same mean for the fires of the viewer's own room, where the ray ends in that room (qa-r1-fix-env-render)
    const at = ctx.env?.interiors?.at;
    const camIn = at ? at(cam.position, _vc) : null;
    const camVol = out && camIn ? camIn.vol : null;
    // kodesh-night-fx: the room the eye stands in (deep enough to be in it), whose walls and curtains bound what it sees
    const room = camIn?.vol && camIn.s > 0.5 ? camIn.vol : null;
    let sum = 0, same = 0;
    for (const [x, y, w] of VIEW_RAYS) {
      _vd.set(x * th * (cam.aspect || 1), y * th, -1).normalize().applyQuaternion(cam.quaternion);
      let hit = null;
      try { hit = ph.raycast(cam.position, _vd, VIEW_FAR); } catch { hit = null; }
      if (!hit?.point) continue;
      _vp.copy(hit.point).addScaledVector(_vd, -0.08);
      // kodesh-night-fx: a ray that leaves the eye's room other than through an open aperture (through the parochot, a shut
      // door, the lul) ends at the room's boundary: the Kodesh looking west saw past both curtains and the lul to the
      // Azarah's strip behind the Heichal, which the fire occluders (court walls, the altar's top) count as lit by the
      // altar — 13.7 lx there, and the eye's firelight adaptation fell to 0.05 of env's on every tier
      if (room) {
        const ex = roomExit(room, cam.position, _vd);
        if (!ex.open && hit.distance > ex.t + 0.08) _vp.copy(cam.position).addScaledVector(_vd, Math.max(ex.t - 0.08, 0));
      }
      const E = illuminanceAt(_vp, { split: true });
      sum += w * Math.max(0, E.all - E.same);
      // open fires only (pyre, hearth, brazier): a room lit by its lamps (the Kodesh by the Menorah) stays as env meters it
      if (camVol && at(_vp, _vi).vol === camVol) same += w * illuminanceAt(_vp, { split: true, kinds: OPEN_FIRES }).same;
    }
    if (out) out.same = (ADAPT_ALBEDO * same) / Math.PI;
    return (ADAPT_ALBEDO * sum) / Math.PI;
  }

  /**
   * gate-env-render: the firelit luminance (cd/m², physical, ADAPT_ALBEDO) a court's open gate shows the eye: rays from the
   * camera through a grid on each gate opening in front of it (site elements en.gate.* / azarah.gate.* of kind 'gate');
   * a ray that meets something before the opening's plane (a closed leaf, a wall) is not through it. Per gate the mean of
   * the rays through it and their brightest, averaged; the brightest gate counts.
   */
  let gates = null;
  const _gc = new Vector3(), _gd = new Vector3(), _gp = new Vector3();
  function gateFireLuminance() {
    const ph = ctx.physics, cam = ctx.camera;
    if (typeof ph?.raycast !== 'function' || !fires.size) return 0;
    if (!gates) {
      gates = [];
      for (const [id, e] of Object.entries(ctx.site?.elements || {})) {
        if (e?.kind !== 'gate' || !e.box || !/^(en|azarah)\.gate\.[a-z-]+$/.test(id)) continue;
        const { min, max } = e.box;
        const dx = max[0] - min[0], dy = max[1] - min[1];
        const lo = m2w(min[0], min[1], min[2]), hi = m2w(max[0], max[1], max[2]);
        // the opening's plane is across the wall's thin dimension; u runs along the wall
        gates.push({ id, c: lo.clone().add(hi).multiplyScalar(0.5), y0: lo.y, h: hi.y - lo.y,
          u: dx < dy ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0), hw: (dx < dy ? Math.abs(hi.z - lo.z) : Math.abs(hi.x - lo.x)) / 2 });
      }
    }
    cam.getWorldDirection(_gd);
    let best = 0;
    for (const g of gates) {
      _gc.copy(g.c).sub(cam.position);
      const dist = _gc.length();
      if (dist > GATE_FAR || dist < 1 || _gc.dot(_gd) < 0.3 * dist) continue;
      let n = 0, sum = 0, max = 0;
      for (const [fu, fv] of GATE_GRID) {
        _gp.copy(g.c).addScaledVector(g.u, fu * g.hw);
        _gp.y = g.y0 + fv * g.h;
        _gc.copy(_gp).sub(cam.position);
        const d = _gc.length();
        _gc.divideScalar(d);
        let hit = null;
        try { hit = ph.raycast(cam.position, _gc, d + 400); } catch { hit = null; }
        if (!hit || hit.distance < d - 0.5) continue; // the sky beyond (a miss) or a solid before the opening
        n++;
        _vp.copy(hit.point).addScaledVector(_gc, -0.08);
        const L = (ADAPT_ALBEDO * illuminanceAt(_vp)) / Math.PI;
        sum += L; if (L > max) max = L;
      }
      if (n) best = Math.max(best, 0.5 * (sum / n + max));
    }
    return best;
  }

  /**
   * gate-env-render: which open fires are hidden from the viewer — their light does not reach the eye (the courts' walls,
   * or another room's walls, stand between): camK, the same transport factor illuminanceAt uses
   */
  const _hi = { V: 1, vol: null, s: 0 };
  function markHidden() {
    const I = ctx.env?.interiors, at = I?.at, cam = ctx.camera.position;
    const ins = at ? at(cam, _hi) : null;
    for (const f of fires.values()) {
      if (!OPEN_FIRES.has(f.kind) || f.follow || !ins) { f.hidden = false; continue; }
      if (!f.ins || f.insAt !== f.lightPos.x + f.lightPos.y + f.lightPos.z) {
        // as illuminanceAt fills them (it skips the fires that light nothing: light:false piles, whose smoke still glows)
        f.ins = at(f.lightPos, f.ins || { V: 1, vol: null, s: 0 });
        f.insAt = f.lightPos.x + f.lightPos.y + f.lightPos.z;
        f.rec = I?.fireRecord ? I.fireRecord(f.lightPos) : -1;
        f.recR = I?.fireRadius ? I.fireRadius(f.size) : 0.3;
      }
      let k = 1;
      if (f.ins) {
        if (f.ins.vol !== ins.vol) k = f.ins.V * (ins.Vap ?? ins.V);
        else if (!ins.vol && f.rec >= 0) k = I.fireVisibility(f.rec, f.lightPos, cam, f.recR);
      }
      f.camK = k;
      f.hidden = k < 0.1;
    }
  }

  // ------------------------------------------------------------------ the gate's spill (gate-env-render)
  // built once from the site: the gate's outer face (its threshold's height, centre, width, height, the passage's depth) and
  // horizontal patches on the chel steps' treads and on the pavement before them; the radiance the opening shows is
  // measured every VIEW_PERIOD from a point before the steps (rays through GATE_GRID), the torches' share of it flickering
  let spillDef = null, spillClock = 1e9, spillT = 0;
  const spillTab = new Float32Array(8), spillTorchTab = new Float32Array(8), spillColor = new Color(1, 1, 1);
  const _sc = new Color(), _sr = new Vector3(), _sd = new Vector3(), _up = new Vector3(0, 1, 0);
  function buildSpill() {
    spillDef = false;
    const g = ctx.elOpt?.(SPILL.gate)?.box, st = ctx.elOpt?.(SPILL.steps);
    if (!g || !st?.box) return;
    const A = ctx.units?.AMAH || 0.48;
    const sp = st.params || {}, n = sp.steps || 0, rise = sp.rise || 0, tread = sp.tread || 0;
    // an east-facing gate (the steps descend eastward: ascent heading 270) — the only case the opening frame needs
    if (!(n > 0 && rise > 0 && tread > 0) || Math.abs((sp.ascentHeading ?? 270) - 270) > 1) return;
    const xo = g.max[0], yc = (g.min[1] + g.max[1]) / 2;
    spillDef = {
      C: m2w(xo, yc, g.min[2]), hw: ((g.max[1] - g.min[1]) / 2) * A, H: (g.max[2] - g.min[2]) * A, D: (g.max[0] - g.min[0]) * A,
      U: new Vector3(0, 0, -1), N: new Vector3(1, 0, 0),
    };
    const rect = (x0, y0, x1, y1, z) => {
      const s = spills.alloc();
      if (!s) return;
      const a = m2w(x0, y0, z), b = m2w(x1, y1, z);
      spills.set(s, 'iRect', Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z));
      spills.set(s, 'iY', a.y);
    };
    // the treads (step i's top at i × rise, from the head of the flight eastward), then the pavement at the foot
    const head = st.box.min[0], foot = st.box.max[0];
    for (let i = n; i >= 1; i--) rect(head + (n - i) * tread, st.box.min[1], head + (n - i + 1) * tread, st.box.max[1], st.box.min[2] + i * rise);
    rect(foot, yc - SPILL.side, foot + SPILL.out, yc + SPILL.side, st.box.min[2]);
    const u = mats.spill.uniforms;
    u.uGateC.value.set(spillDef.C.x, spillDef.C.y, spillDef.C.z, spillDef.hw);
    u.uGateU.value.set(spillDef.U.x, spillDef.U.y, spillDef.U.z, spillDef.D);
    u.uGateN.value.set(spillDef.N.x, spillDef.N.y, spillDef.N.z, spillDef.H);
  }
  /**
   * the firelit luminance (physical cd/m²) the gate's opening shows along rays of slope SPILL_S0 + k × SPILL_DS rising
   * inward (k 0 … 7): rays from just outside its face at SPILL_ROWS heights; a miss is the sky (no firelight). Torches apart
   */
  function measureSpill() {
    const ph = ctx.physics, d = spillDef;
    spillTab.fill(0); spillTorchTab.fill(0);
    if (typeof ph?.raycast !== 'function') return;
    const opts = { color: _sc }, topts = { kinds: TORCH };
    let cr = 0, cg = 0, cb = 0, cw = 0;
    for (let k = 0; k < 8; k++) {
      const sl = SPILL_S0 + k * SPILL_DS;
      _sd.copy(d.N).negate().addScaledVector(_up, sl).normalize();
      for (const fv of SPILL_ROWS) {
        _sr.copy(d.C).addScaledVector(d.N, 0.3);
        _sr.y += fv * d.H;
        let hit = null;
        try { hit = ph.raycast(_sr, _sd, 900); } catch { hit = null; }
        if (!hit) continue;
        _vp.copy(hit.point).addScaledVector(_sd, -0.08);
        const kk = SPILL.albedo / Math.PI / SPILL_ROWS.length;
        const E = illuminanceAt(_vp, opts);
        spillTab[k] += kk * E;
        cr += E * _sc.r; cg += E * _sc.g; cb += E * _sc.b; cw += E;
        spillTorchTab[k] += kk * illuminanceAt(_vp, topts);
      }
    }
    for (let k = 0; k < 8; k++) spillTab[k] = Math.max(0, spillTab[k] - spillTorchTab[k]);
    if (cw > 0) spillColor.setRGB(cr / cw, cg / cw, cb / cw); else spillColor.setRGB(1, 1, 1);
    const l = 0.2126 * spillColor.r + 0.7152 * spillColor.g + 0.0722 * spillColor.b;
    if (l > 0) spillColor.multiplyScalar(1 / l);
  }
  function updateSpill(dt) {
    if (spillDef === null) buildSpill();
    const m = spills.mesh;
    if (!spillDef) { m.visible = false; return; }
    spillT += dt;
    // by day the firelit court adds nothing the Sun has not already lit a thousand times brighter
    const far = sunAltitude(ctx) > 2 || ctx.camera.position.distanceTo(spillDef.C) > SPILL.far;
    spillClock += dt;
    // after a jump: the next frame (the jump's own frame carries the sim's and the gates' work)
    if (snap) spillClock = SPILL_PERIOD;
    else if (!far && spillClock > SPILL_PERIOD) { spillClock = 0; measureSpill(); }
    // the torches' flame-scale flicker, the fires' slower breathing (deterministic in fx's clock)
    const t = spillT;
    const ft = 1 + SPILL.torch * (0.55 * Math.sin(t * 9.1) + 0.3 * Math.sin(t * 15.7 + 1.3) + 0.15 * Math.sin(t * 23.3 + 2.1));
    const ff = 1 + SPILL.fire * (0.6 * Math.sin(t * 3.7 + 0.4) + 0.4 * Math.sin(t * 6.3 + 2.2));
    const u = mats.spill.uniforms;
    const T = (k) => spillTab[k] * ff + spillTorchTab[k] * ft;
    u.uSpillT0.value.set(T(0), T(1), T(2), T(3));
    u.uSpillT1.value.set(T(4), T(5), T(6), T(7));
    u.uSpillS.value.set(SPILL_S0, SPILL_DS);
    u.uSpillCol.value.set(spillColor.r, spillColor.g, spillColor.b);
    // the patch's own local adaptation (SPILL_OVER × env's level, scene units)
    const La = ctx.env?.luminance, P0 = ctx.env?.preExposure;
    u.uSpillCap.value = Number.isFinite(La) && Number.isFinite(P0) ? SPILL_OVER * La * P0 : 1e9;
    u.uSpillRef.value = Number.isFinite(La) && Number.isFinite(P0) ? La * P0 : 0;
    spills.flush();
    let any = 0;
    for (let k = 0; k < 8; k++) any += spillTab[k] + spillTorchTab[k];
    m.visible = !far && spills.count > 0 && any > 1e-9;
  }

  /**
   * Physical illuminance (lux) from the burning fires at a world point — for eye adaptation. With env's interiors
   * a fire in another room counts only through both rooms' openings. opts.sameVolume: only fires in the point's
   * own room (0 outdoors); opts.split: returns { all, same, sameS } (sameS = same × how far the point is inside).
   * opts.rendered: each fire weighted by the luminance of its light colour, i.e. what its point light renders
   * (three scales intensity × colour: a lamp's (1, 0.46, 0.16) renders 55 % of its candela). opts.color: a Color
   * that receives the counted fires' light colour, weighted by their contribution (lighting-polish-fix). opts.kinds: a Set
   * of fire kinds to count (all when omitted).
   */
  const _ins = { V: 1, vol: null, s: 0 };
  function illuminanceAt(pos, opts = {}) {
    if (fires.size < ctx.fires.length) consumeCtxFires(); // env meters before fx's first update (boot)
    const I = ctx.env?.interiors;
    const at = I?.at;
    const ins = at ? at(pos, _ins) : null;
    let E = 0, Es = 0, cr = 0, cg = 0, cb = 0;
    for (const f of fires.values()) {
      if (!f.lightCandela || f.cur <= 0 || (opts.kinds && !opts.kinds.has(f.kind))) continue;
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
    /** the heat-shimmer plumes this frame (post tiers): { n, a: [u, v, half w, half h] × n, b: [view z, amplitude (uv), seed, 0] × n } */
    get haze() { return haze; },
    /** fx's animation clock (s) */
    get time() { return time; },
    /** internal (dev scripts): the light pool */
    get _lights() { return lights; },
    get stats() {
      return {
        fires: fires.size, columns: columns.size, lights: lights.active ?? 0, maxLights: lights.max,
        shadowLights: lights.pools[0]?.lights.length ?? 0,
        flames: flames.count, embers: embers.count, puffs: smoke.count, P: +mats.shared.uP.value.toPrecision(3),
        spill: spills.mesh.visible ? [...spillTab].map((v, k) => +(v + spillTorchTab[k]).toPrecision(3)) : 0,
        adaptation: +Math.exp(logAdapt).toPrecision(3), viewLaf: +viewLaf.toPrecision(3), viewLafSame: +viewLafSame.toPrecision(3), gateLaf: +gateLaf.toPrecision(3), gateGain: +Math.exp(logGate).toPrecision(3),
        glint: glint.mesh.visible ? { I: +glint.stats.I.toPrecision(3), sparks: glint.stats.n, vis: +glint.stats.vis.toFixed(2), L0: +glint.stats.L0.toPrecision(3) } : null,
      };
    },
    dispose() {
      for (const b of [flames, halos, embers, smoke, beds, spills]) b.dispose();
      for (const m of [mats.flame, mats.halo, mats.ember, mats.smoke, mats.bed, mats.glint, mats.spill]) m.dispose();
      glint.dispose();
      lights.dispose();
    },
  };
  return api;
}
