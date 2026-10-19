// STUB — owned by the sim task: zones detection, schedule runtime, choreographies. See ARCHITECTURE.md §Sim.
export async function init(ctx) {
  ctx.zones = { current: null, at: () => null, list: [] };
  ctx.schedule = { events: [], active: () => [], upcoming: () => [] };
}
