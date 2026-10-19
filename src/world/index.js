// Builds the static world. Each builder owns one folder and returns an Object3D (or null).
// Builders register colliders / anchors / fires on ctx while building (see core/context.js).
// Order matters only for anchors other builders might read (none should — read ctx.site instead).
import { Group, Mesh, MeshBasicMaterial } from 'three';
import { createMaterialLibrary } from './materials/index.js';
import * as terrain from './terrain/index.js';
import * as mount from './mount/index.js';
import * as courts from './courts/index.js';
import * as altar from './altar/index.js';
import * as heichal from './heichal/index.js';
import { siteBoxGeometry } from './geom.js';
import { buildTestScene } from './testscene.js';

export const BUILDERS = [
  ['terrain', terrain],
  ['mount', mount],
  ['courts', courts],
  ['altar', altar],
  ['heichal', heichal],
];

export async function buildWorld(ctx, onProgress = () => {}) {
  ctx.mats = createMaterialLibrary(ctx);
  await ctx.mats.ready();
  const world = new Group();
  world.name = 'world';
  ctx.world = world;
  ctx.scene.add(world);
  let i = 0;
  for (const [name, mod] of BUILDERS) {
    onProgress(name, i++ / BUILDERS.length);
    const t0 = performance.now();
    try {
      const obj = await mod.build(ctx);
      if (obj) { obj.name ||= name; world.add(obj); }
    } catch (e) {
      console.error(`[world] builder "${name}" failed`, e);
      ctx.bus.emit('build:error', { name, error: e });
    }
    ctx.buildTimes ||= {};
    ctx.buildTimes[name] = Math.round(performance.now() - t0);
  }
  // Fallback test plaza while the real builders are still stubs (or ?debug=testscene).
  if (!world.children.length || ctx.params.debug.has('testscene')) world.add(buildTestScene(ctx));
  // Material swatch preview (?debug=mats) — implemented by the materials task in materials/preview.js.
  if (ctx.params.debug.has('mats')) {
    try {
      const mod = await import('./materials/preview.js');
      const obj = await mod.buildPreview(ctx);
      if (obj) world.add(obj);
    } catch (e) { console.warn('[world] materials preview unavailable', e); }
  }
  if (ctx.params.debug.has('boxes')) world.add(debugElements(ctx));
  onProgress('done', 1);
  return world;
}

/** Translucent boxes for every site element that has a box — debug overlay (?debug=boxes). */
function debugElements(ctx) {
  const grp = new Group();
  grp.name = 'debug-boxes';
  const mat = new MeshBasicMaterial({ color: 0x33aaff, wireframe: true, transparent: true, opacity: 0.5 });
  for (const e of Object.values(ctx.site.elements || {})) {
    if (!e.box) continue;
    grp.add(new Mesh(siteBoxGeometry(e.box.min, e.box.max), mat));
  }
  return grp;
}
