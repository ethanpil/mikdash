// render-env-2: sun-shadow parameter A/B on one view (dev only). VIEW=sovev-am3 SETS='r2.2,r1.2,nb0,b0' CROP=x,y,w,h
//   node src/render/dev/session.mjs src/render/dev/shadow-ab.mjs --q high --out shots/render-env-2/wip
import { VIEWS } from './env2-views.mjs';
const SETS = {
  base: {},
  r12: { radius: 1.2 },
  r08: { radius: 0.8 },
  nb0: { normalTexels: 0, normalBias: 0.005 },
  nb15: { normalTexels: 1.5 },
  bpos: { bias: 0.00003 },
  b0: { bias: 0 },
  bneg: { bias: -0.00025 },
  // medium (env's key light): depth (m, toward the light) and normal (texels)
  ds: { doubleSide: true },
  dsb: { doubleSide: true, bias: -0.0002, normalTexels: 1.2 },
  mold: { tune: { depth: 0.04, normal: 1.2 } },
  mnew: { tune: { depth: 0.015, normal: 0.7 } },
  md0: { tune: { depth: 0, normal: 0.7 } },
  mdp: { tune: { depth: -0.03, normal: 0.7 } },
  mn03: { tune: { depth: 0.015, normal: 0.3 } },
  // render-env-2-fix (medium scallops): PCF radius, extent
  mr1: { radius: 1 },
  mr2: { radius: 2 },
  mr3: { radius: 3 },
  me64: { radius: 1, tune: { extent: 64, ahead: 0.5 } },
  me64r2: { radius: 2, tune: { extent: 64, ahead: 0.5 } },
};
export default async function (h) {
  const v = VIEWS[process.env.VIEW || 'sovev-am3'];
  const crop = (process.env.CROP || '380,380,520,200').split(',').map(Number);
  await h.ev((t) => { const T = globalThis.__mikdash.time; T.pause(true); T.set(T.parse(t)); }, v.t);
  await h.ev((v) => { const c = globalThis.__mikdash; if (v.pos) { c.player.setMode('fly'); c.player.teleport({ pos: v.pos }); } else c.player.teleport({ at: v.at }); c.player.setLook(v.look[0], v.look[1]); }, v);
  await h.wait(4000);
  const { resolve } = await import('node:path');
  for (const name of (process.env.SETS || 'base,r12,nb0,b0,bpos').split(',')) {
    const r = await h.ev((p0) => {
      let p = p0;
      const c = globalThis.__mikdash, sh = c.post.shadows?.light?.shadow, e = c.env;
      // casters drawn double-sided (front faces too) — or back to each material's default
      c.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (m.isMeshStandardMaterial) { if (m.__ss === undefined) m.__ss = m.shadowSide; m.shadowSide = p.doubleSide ? 2 : m.__ss; } } });
      p = { ...p }; delete p.doubleSide;
      if (sh) {
        globalThis.__shBase = globalThis.__shBase || { radius: sh.radius, bias: sh.bias, normalBias: sh.normalBias, normalTexels: sh.normalTexels };
        Object.assign(sh, globalThis.__shBase, p);
        sh.needsUpdate = true;
      } else if (e._shadowTune) {
        e._shadowTune.base = e._shadowTune.base || { depth: e._shadowTune.depth, normal: e._shadowTune.normal, extent: e._shadowTune.extent, ahead: e._shadowTune.ahead };
        Object.assign(e._shadowTune, e._shadowTune.base, p.tune || {});
        if (p.radius != null) e.sunLight.shadow.radius = p.radius;
      }
      return sh ? { radius: sh.radius, bias: sh.bias, nb: sh.normalBias, nt: sh.normalTexels } : { ...e._shadowTune, radius: e.sunLight.shadow.radius };
    }, SETS[name] || {});
    await h.wait(1500);
    const f = resolve(h.out, `shadow-ab-${process.env.VIEW || 'sovev-am3'}-${h.q}-${name}.png`);
    await h.page.screenshot({ path: f, clip: { x: crop[0], y: crop[1], width: crop[2], height: crop[3] } });
    h.log(name, JSON.stringify(r), f);
  }
}
