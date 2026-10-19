// The shared context object passed to every builder and subsystem.
// See ARCHITECTURE.md for the full contract of each field.
import { Vector3 } from 'three';
import { Bus } from './bus.js';
import * as units from './units.js';
import { SITE } from '../data/site.js';

export function createContext(engine, params, quality) {
  const byId = new Map(Object.entries(SITE.elements || {}));
  const ctx = {
    engine,
    renderer: engine.renderer,
    scene: engine.scene,
    camera: engine.camera,
    params,
    quality,
    units,
    bus: new Bus(),
    /** the research-derived site model (src/data/site.js) — the ONLY geometric authority at runtime */
    site: SITE,
    /** site element by id, or throws (helps catch typos early) */
    el(id) {
      const o = byId.get(id);
      if (!o) throw new Error(`site element not found: ${id}`);
      return o;
    },
    elOpt(id) { return byId.get(id) || null; },

    // ---- registries filled by world builders (read by other systems after build) ----
    /** static collision meshes/geometries in WORLD space; player/ builds a BVH from these */
    colliders: [],
    addCollider(meshOrGeometry, tag = 'solid') {
      ctx.colliders.push({ object: meshOrGeometry, tag });
    },
    /** named points: name -> { pos: Vector3 (world), heading?: deg, label?: string, zone?: string } */
    anchors: new Map(),
    addAnchor(name, spec) {
      if (ctx.anchors.has(name)) console.warn(`[anchors] duplicate ${name}`);
      const pos = spec.pos instanceof Vector3 ? spec.pos.clone()
        : units.m2w(spec.pos[0], spec.pos[1], spec.pos[2] ?? 0);
      ctx.anchors.set(name, { ...spec, pos });
    },
    /** fire/light emitters requested by builders; render/fx turns them into visuals + lights */
    fires: [],
    /**
     * spec: { id, kind: 'pyre'|'hearth'|'torch'|'lamp'|'menorah'|'brazier', pos: Vector3|[X,Y,Z] amot,
     *         size: meters (rough flame size), intensity: 0..1, color?: hex,
     *         schedule?: 'always'|'night'|'service' , smoke?: bool }
     */
    addFire(spec) {
      const pos = spec.pos instanceof Vector3 ? spec.pos.clone()
        : units.m2w(spec.pos[0], spec.pos[1], spec.pos[2] ?? 0);
      const f = { intensity: 1, size: 1, kind: 'torch', schedule: 'always', ...spec, pos };
      ctx.fires.push(f);
      return f;
    },

    /** named movable parts the sim animates (gate doors, curtains, kiyor, lamps): id -> Object3D */
    movables: new Map(),

    // ---- subsystem APIs (filled by each subsystem's init) ----
    mats: null,      // world/materials  : get(name) -> Material
    time: null,      // time/            : sim clock + zmanim
    env: null,       // env/             : sky, sun, moon, fog, lights
    fx: null,        // render/fx        : fires, smoke, particles
    post: null,      // render/          : post-processing pipeline
    physics: null,   // player/          : BVH collision, raycasts, floor queries
    nav: null,       // player/          : nav grid + A*
    player: null,    // player/          : observer controller, goTo()
    people: null,    // people/          : figures + crowds
    zones: null,     // sim/zones        : zone detection
    schedule: null,  // sim/             : event schedule + choreography runtime
    audio: null,     // audio/           : soundscape
    ui: null,        // ui/              : HUD & panels
    settings: null,  // ui/settings      : persisted user settings
  };
  return ctx;
}
