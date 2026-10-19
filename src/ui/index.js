// STUB — owned by the UI task. See ARCHITECTURE.md §UI.
export async function init(ctx) {
  ctx.ui = { toast: (m) => console.log('[ui]', m) };
  ctx.settings = { get: () => undefined, set: () => {} };
}
