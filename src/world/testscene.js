// Fallback test plaza, used only while the real builders return nothing.
// Gives the sky / render / materials / player tasks geometry to light, shade and walk on.
// Located in the open south of Har HaBayit (site X≈250, Y≈120); the 'start' anchor faces it.
import { Group, CylinderGeometry, PlaneGeometry, BoxGeometry } from 'three';
import { StaticBatcher, siteBoxGeometry, applyWorldUV } from './geom.js';
import { m2w, a } from '../core/units.js';

export function buildTestScene(ctx) {
  const b = new StaticBatcher(ctx, 'testscene');
  // ground: 600 x 600 amot of paving at Z=0
  b.add(siteBoxGeometry([-50, -50, -1], [550, 550, 0]), 'paving_mount');
  // a Herodian wall 40 amot long, 30 high, 5 thick (north side of the plaza)
  b.add(siteBoxGeometry([220, 150, 0], [260, 155, 30]), 'herodian_wall');
  // gold-plated door in it (10 wide, 20 high), slightly proud
  b.add(siteBoxGeometry([235, 149.8, 0], [245, 150, 20]), 'gold_plate', { collide: false });
  // 12 steps (rise 0.5, tread 0.5) up to a platform at +6, running north
  for (let i = 0; i < 12; i++) {
    b.add(siteBoxGeometry([262, 120 + i * 0.5, 0], [272, 126 + i * 0.5, (i + 1) * 0.5]), 'steps_stone');
  }
  b.add(siteBoxGeometry([262, 126, 0], [272, 146, 6]), 'marble_white');
  // whitewashed block with a red line (altar-like test body), 12 x 12 x 6
  b.add(siteBoxGeometry([280, 110, 0], [292, 122, 6]), 'lime_whitewash');
  b.add(siteBoxGeometry([279.95, 109.95, 2.9], [292.05, 122.05, 3.1]), 'sikra_red', { collide: false });
  // colonnade: 8 columns, 2 amot diameter, 20 high, with cedar architrave
  for (let i = 0; i < 8; i++) {
    const g = new CylinderGeometry(a(1), a(1.1), a(20), 24);
    const p = m2w(200 + i * 6, 110, 10);
    g.translate(p.x, p.y, p.z);
    applyWorldUV(g);
    b.add(g, i % 2 ? 'marble_veined' : 'marble_white');
  }
  b.add(siteBoxGeometry([198, 109, 20], [245, 111, 21.5]), 'cedar');
  // kochla band wall segment and bronze panel
  b.add(siteBoxGeometry([300, 130, 0], [304, 150, 12]), 'marble_kochla');
  b.add(siteBoxGeometry([299.9, 136, 2], [300, 144, 12]), 'bronze_corinthian', { collide: false });
  // linen cloth hanging (curtain test) and an iron blade
  const cloth = new PlaneGeometry(a(8), a(12));
  const cp = m2w(310, 120, 6);
  cloth.translate(cp.x, cp.y, cp.z);
  applyWorldUV(cloth);
  b.add(cloth, 'parochet', { collide: false });
  b.add(siteBoxGeometry([200, 112, 21.5], [245, 112.2, 22.5]), 'iron', { collide: false });
  // silver & gold vessels (small boxes)
  b.add(new BoxGeometry(0.6, 0.6, 0.6).translate(m2w(286, 116, 6).x, a(6) + 0.3, m2w(286, 116, 6).z), 'gold_vessel', { collide: false });

  const group = new Group();
  group.name = 'testscene';
  group.add(b.build());

  // a pyre on the block, a hearth and torches for the FX task
  ctx.addFire({ id: 'test.pyre', kind: 'pyre', pos: [286, 116, 6], size: 2.0, smoke: true });
  ctx.addFire({ id: 'test.torch1', kind: 'torch', pos: [258, 149, 9], size: 0.35 });
  ctx.addFire({ id: 'test.torch2', kind: 'torch', pos: [222, 149, 9], size: 0.35 });
  ctx.addFire({ id: 'test.lamp', kind: 'lamp', pos: [266, 140, 6.4], size: 0.08 });
  ctx.addAnchor('start', { pos: [255, 95, 0], heading: 0, label: 'Test plaza (fallback)' });
  return group;
}
