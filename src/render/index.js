// STUB — owned by the render task. Real module: post-processing per tier (AO, bloom, SMAA, tone mapping),
// shadows/cascades, adaptive resolution, fire/smoke/torch FX from ctx.fires. See ARCHITECTURE.md §Render.
export async function init(ctx) {
  ctx.post = null;
  ctx.fx = { fires: ctx.fires };
}
