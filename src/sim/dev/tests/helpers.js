const rt = ctx.schedule.runtime;
const nw = rt.choreo('night-watch');
const sim = nw.sim;
// crowd helper
const c = sim.crowd({ roles: { israelite: 3, woman: 1 }, count: 12, region: { min: [300, 150], max: [320, 170] }, pose: 'stand', heading: 'random', seed: 7 });
c._apply(true);
const made = !!c.crowd, cnt = c.crowd?.count;
c._apply(false);
// fire helper
const f = sim.fire('mount.torch.shushan.a');
const before = ctx.fx.fires.get('mount.torch.shushan.a')?.target;
f.set(0.3);
const after = ctx.fx.fires.get('mount.torch.shushan.a')?.target;
f.set(1);
const unknown = sim.fire('no.such.fire'); unknown.set(0.5);
// path + segments
const { segmentAt, phase, rand, wander } = await import('/src/sim/lib/core.js');
const seg = segmentAt([{ id: 'a', d: 2 }, { id: 'b', d: 3 }], 100, 103.5);
return { crowd: { made, cnt, scale: sim.crowdScale }, fire: { exists: f.exists, before, after, unknownExists: unknown.exists }, seg: seg && { id: seg.seg.id, k: +seg.k.toFixed(3) }, phase: [phase(95, 100, 110), phase(105, 100, 110), phase(115, 100, 110), phase(100 + 800, 100, 110)], rand: [rand(1, 'a', 2), rand(1, 'a', 2) === rand(1, 'a', 2)], wander: +wander(3, 10).toFixed(3) };
