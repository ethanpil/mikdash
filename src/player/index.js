// STUB — owned by the player task. Real module: first-person walk (keyboard/mouse/touch), BVH collision,
// nav grid + A*, guided goTo(). See ARCHITECTURE.md §Player.
import { m2w, a, EYE_HEIGHT, headingToYaw } from '../core/units.js';
export async function init(ctx) {
  const cam = ctx.camera;
  const p = ctx.params;
  const start = ctx.anchors.get('start');
  if (p.pos) m2w(p.pos[0], p.pos[1], p.pos[2], cam.position);
  else if (p.at) { m2w(p.at[0], p.at[1], 0, cam.position); cam.position.y += EYE_HEIGHT; }
  else if (start) { cam.position.copy(start.pos); cam.position.y += EYE_HEIGHT; }
  else m2w(430, 330, 0, cam.position).setY(EYE_HEIGHT);
  const heading = p.look?.heading ?? start?.heading ?? 270;
  cam.rotation.set((p.look?.pitch ?? 4) * Math.PI / 180, headingToYaw(heading), 0, 'YXZ');
  ctx.player = { goTo: async () => {}, mode: 'walk' };
}
