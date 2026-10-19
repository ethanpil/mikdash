// people/ — procedural, research-grounded people and animals (ARCHITECTURE.md §10).
//
//   ctx.people.spawn({ role, seed, site?, heading?, pose?, phase?, prop?, hand? }) -> Actor
//   ctx.people.spawnAnimal('lamb'|'ram'|'goat'|'bull'|'dove', { seed }) -> Actor (poses: stand walk lie bound graze | dove: stand peck fly)
//   ctx.people.spawnProp(name) -> Actor-like free prop (setSite / setHeading / setVisible / dispose); a free torch burns
//   ctx.people.crowd({ roles, count, region:{min:[X,Y],max:[X,Y],z?|near?} | points:[[X,Y,Z?] | {pos,heading,near?}],
//                      pose, phase, heading, seed, prop, layout?:'prostrate' })
//        -> { setPose(name, phase), setVisible(b), setCount(n), setHeadings(deg|'random'|{at:[X,Y]}|fn|omitted=points'), setProp, dispose }
//        roles may be person roles or animal kinds (a flock). A region crowd in a walking pose flows along its
//        headings and wraps inside the region (dithering in/out at the edges); a points crowd walks in place.
//        layout 'prostrate' gives each member a 2:1 cell (staggered) so a full-length prostration has room.
//   ctx.people.util.poseAlongPath(points, distanceMeters) -> { pos, heading, length, done, t }
//   ctx.people.util.phaseFor(actor|role, pose, distanceMeters) -> walk/run phase that keeps feet planted
//
// Actor: object3D, setSite(X,Y,Z?), setPosition(v), setHeading(deg), setPose(name, phase?), setProp(name|null, hand),
//        setVisible(b), setSpeed(m/s), dispose(). Phase omitted → the pose animates on its own.
//        setSite Z: a number = exact height; { near: Z } = the walking floor nearest Z (stairs, galleries, upper
//        rooms); omitted = the walking floor (court/hall floors on the site datums — never a roof or beam above).
//        Floors are re-resolved when the colliders are (re)built.
//        Kohanic roles in 'sleep' / 'lie' wear their own clothes and lie on their folded garments (Tamid 1:1).
// Rendering: GPU-instanced; every figure is skinned in the vertex shader from a baked animation atlas. Beyond
// quality.maxFigures the next figures (up to 3× more) are drawn as LOD3 silhouettes that dither out at the cap.
import { PRIORITY } from '../core/engine.js';
import { PeopleSystem } from './system.js';
import { ROLE_NAMES, ANIMAL_NAMES, ROLES } from './roles.js';
import { PROP_NAMES, setPropMetals } from './props.js';
import { HUMAN_CLIPS } from './clips.js';
import { QUAD_CLIPS, BIRD_CLIPS } from './animal-clips.js';
import { poseAlongPath } from './util.js';

function matHex(ctx, key) {
  try {
    if (!ctx.mats?.keys?.includes?.(key)) return null;
    const c = ctx.mats.get(key)?.color;
    return c ? `#${c.getHexString()}` : null;
  } catch { return null; }
}

export async function init(ctx) {
  setPropMetals({
    gold: matHex(ctx, 'gold_vessel'), goldGreen: matHex(ctx, 'gold_green'), goldRed: matHex(ctx, 'gold_red'),
    silver: matHex(ctx, 'silver'), copper: matHex(ctx, 'copper'), iron: matHex(ctx, 'iron'), bronze: matHex(ctx, 'bronze_corinthian'),
  });
  const sys = new PeopleSystem(ctx);
  ctx.engine.onUpdate((dt) => {
    sys.update(dt);
    sys.setSnap(false);
  }, PRIORITY.people);
  ctx.bus.on('time:jump', () => {
    sys.setSnap(true);
    for (const a of sys.actors) { a.fade = 0; a.prev = null; }
    for (const c of sys.crowds) c.fade = 0;
  });
  ctx.bus.on('quality:change', () => sys.reconfigure(ctx.quality));

  const phaseFor = (who, pose = 'walk', meters = 0) => {
    const arch = typeof who === 'string' ? sys.arch((ROLES[who] || ROLES.israelite).arch) : who?.arch;
    const clip = arch?.clip(pose);
    if (!clip?.stride) return 0;
    const scale = typeof who === 'string' ? 1 : (who.scale || 1);
    const p = meters / (clip.stride * scale);
    return p - Math.floor(p);
  };

  ctx.people = {
    spawn: (o) => sys.spawn(o),
    spawnAnimal: (kind, o) => sys.spawnAnimal(kind, o),
    spawnProp: (name, o) => sys.spawnProp(name, o),
    crowd: (o) => sys.crowd(o),
    util: { poseAlongPath, phaseFor },
    roles: ROLE_NAMES,
    animals: ANIMAL_NAMES,
    props: PROP_NAMES,
    poses: Object.keys(HUMAN_CLIPS),
    animalPoses: Object.keys(QUAD_CLIPS),
    birdPoses: Object.keys(BIRD_CLIPS),
    get actors() { return [...sys.actors]; },
    get stats() { return sys.stats; },
    root: sys.root,
    system: sys,
  };

  if (ctx.params?.debug?.has?.('people')) {
    try {
      const { buildDemo } = await import('./demo.js');
      buildDemo(ctx);
    } catch (e) { console.error('[people] demo failed', e); }
  }
}
