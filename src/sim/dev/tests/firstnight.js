// First appearance of the sim's figures in a session booted by day: the frame after a jump into the night must not
// stall on shader compilation (the runtime warms every pooled figure behind the loading screen). Run with "t=d3".
// Compares the first jump to night with a night-watch-less jump (the world's own cost) and with a repeat jump.
const rt = ctx.schedule.runtime, time = ctx.time;
const nw = rt.choreo('night-watch');
await frames(30);
const measure = async (n = 6) => { const v = []; let p = performance.now(); for (let i = 0; i < n; i++) { await frames(1); const q = performance.now(); v.push({ raf: +(q - p).toFixed(1), sim: +rt.stats.last.toFixed(2) }); p = q; } return v; };
const res = { warmedAtBoot: nw.inited, people: { batches: ctx.people?.system?.batches?.length } };
time.set(time.parse('n2'));
res.firstNight = await measure();
res.firstNightShown = rt.stats.figures;
time.set(time.parse('d3')); await frames(10);
nw.failed = true;                 // the runtime skips it: the world's own day→night cost
time.set(time.parse('n2'));
res.nightWithoutSim = await measure();
nw.failed = false;
time.set(time.parse('d3')); await frames(10);
time.set(time.parse('n2'));
res.nightAgain = await measure();
time.set(time.parse('d3')); await frames(10);
time.set(time.parse('sunrise-6'));
res.dawn = await measure();
res.summary = { firstNightMax: Math.max(...res.firstNight.map((f) => f.raf)), withoutSimMax: Math.max(...res.nightWithoutSim.map((f) => f.raf)), againMax: Math.max(...res.nightAgain.map((f) => f.raf)), dawnMax: Math.max(...res.dawn.map((f) => f.raf)) };
return res;
