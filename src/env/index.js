// STUB — owned by the time/sky task. Real module: physically based sky, sun/moon/stars for Jerusalem,
// atmospheric fog, sun & sky lighting following ctx.time. See ARCHITECTURE.md §Environment.
import { HemisphereLight, DirectionalLight, Color, Fog } from 'three';
export async function init(ctx) {
  ctx.scene.background = new Color(0x8fb3d9);
  ctx.scene.fog = new Fog(0x8fb3d9, 300, 3000);
  const hemi = new HemisphereLight(0xcfe3ff, 0x8a7a60, 1.2);
  const sun = new DirectionalLight(0xffffff, 2.5);
  sun.position.set(-200, 300, 100);
  ctx.scene.add(hemi, sun);
  ctx.env = { sun, hemi };
}
