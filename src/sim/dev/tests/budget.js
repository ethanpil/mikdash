// Figure budget and LOD: the cap leaves room for people's LOD3 silhouettes (maxFigures × 4), ranks by distance /
// importance, counts crowds by their members (thinning them when short), and sim.due() updates far posts less often.
const rt = ctx.schedule.runtime, time = ctx.time;
const nw = rt.choreo('night-watch');
time.set(time.parse('n3')); await frames(3);
for (let i = 0; i < 240 && !(nw.state.routeSource.startsWith('nav') && nw.state.gpaths.every(Boolean)); i++) await sleep(250);
const out = { maxFigures: ctx.quality.maxFigures, budget: rt.budget, expect: ctx.quality.maxFigures * 4 };
const shown = () => { const r = []; for (const e of rt.entries) for (const p of e.pools) for (const s of p.slots) if (s.shown) r.push(`${p.name}#${s.index}`); return r; };
// near the officer: a small budget keeps him and his torches first
const P = nw.state.patrol;
ctx.player.teleport({ at: [P.X + 6, P.Y, P.Z] }); await frames(5);
out.full = shown().length;
rt.budget = 6; await frames(3);
out.cut6 = shown();
rt.budget = 0; await frames(3);
out.cut0 = shown().length;
ctx.bus.emit('quality:change'); await frames(3);
out.restored = { budget: rt.budget, shown: shown().length };
// crowds by day (night-watch idle, so the test crowd keeps the want it is given)
time.set(time.parse('d3')); await frames(3);
ctx.player.teleport({ at: [330, 200] }); await frames(3);
const c = nw.sim.crowd({ roles: 'israelite', count: 40, region: { min: [320, 190], max: [340, 210] }, pose: 'stand', heading: 'random', seed: 5 });
c.want = true; await frames(3);
out.crowd = { members: c.count, shown: c.shown, drawn: c.crowd?.count, figures: rt.stats.figures };
rt.budget = 5; await frames(3);
out.crowdThin = { shown: c.shown, drawn: c.crowd?.count, figures: rt.stats.figures };
rt.budget = 0; await frames(3);
out.crowdNone = { shown: c.shown, figures: rt.stats.figures };
ctx.bus.emit('quality:change'); await frames(3);
out.crowdBack = { shown: c.shown, drawn: c.crowd?.count };
c.want = false; await frames(2);
// per-slot LOD: heading updates per second of a near guard (Shushan) and a far one (SW corner) while the clock runs
time.set(time.parse('n3')); await frames(3);
ctx.player.teleport({ at: [470, 330.5, 0] }); await frames(5);
const S = nw.state, iNear = S.levites.findIndex((p) => p.id === 'gate-shushan'), iFar = S.levites.findIndex((p) => p.id === 'mount-sw');
const gN = S.guards.slots[iNear], gF = S.guards.slots[iFar];
time.setSpeed(60); time.pause(false);
let nN = 0, nF = 0, hN = gN._heading, hF = gF._heading, fr = 0;
const t0 = performance.now();
while (performance.now() - t0 < 2000) { await frames(1); fr++; if (gN._heading !== hN) { nN++; hN = gN._heading; } if (gF._heading !== hF) { nF++; hF = gF._heading; } }
time.pause(true);
const sec = (performance.now() - t0) / 1000;
out.slotLod = { fps: +(fr / sec).toFixed(1), nearHz: +(nN / sec).toFixed(1), farHz: +(nF / sec).toFixed(1), farDist: Math.round(gF.pos.distanceTo(ctx.player.position)) };
return out;
