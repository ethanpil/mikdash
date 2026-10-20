// Per-frame garbage + cost of the sim (CDP sampling heap profiler, including objects already collected by minor/major
// GC, so the totals are ALLOCATION volumes), attributed to the allocating function. Needs run.mjs cdp().
const rt = ctx.schedule.runtime, time = ctx.time;
const nw = rt.choreo('night-watch'), gates = rt.choreo('gates-opening');
time.set(time.parse('n2')); await frames(3);
for (let i = 0; i < 240 && !(nw.state.routeSource.startsWith("nav") && nw.state.gpaths.every(Boolean) && gates.state?.walk?.source === "nav"); i++) await sleep(250);
ctx.player.teleport({ at: [270, 250] }); await frames(10);
const out = {};
async function measure(name, startSpec, speed, ms) {
  time.pause(true); time.set(time.parse(startSpec)); await frames(5);
  time.setSpeed(speed); time.pause(false);
  await frames(10);
  const f0 = rt.stats.frames;
  const lasts = [], spikes = [];
  let on = true;
  (async () => { while (on) { await frames(1); lasts.push(rt.stats.last); if (rt.stats.last > 2) spikes.push(`${time.format()} ${rt.stats.last.toFixed(2)} ${rt.entries.map((e) => e.id + ':' + e.ms.toFixed(2)).join(' ')}`); } })();
  await cdp('HeapProfiler.enable');
  await cdp('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  await sleep(ms);
  const prof = await cdp('HeapProfiler.getSamplingProfile');
  await cdp('HeapProfiler.stopSampling');
  on = false;
  time.pause(true);
  const nf = rt.stats.frames - f0;
  const sim = prof.top.filter(([k]) => k.includes('src/sim/'));
  const simBytes = sim.reduce((s, [, b]) => s + b, 0);
  lasts.sort((a, b) => a - b);
  out[name] = {
    frames: nf, fps: +(nf / (ms / 1000)).toFixed(1),
    simBytesPerFrame: Math.round(simBytes / nf), allBytesPerFrame: Math.round(prof.total / nf),
    topSim: sim.slice(0, 14).map(([k, b]) => `${Math.round(b / nf)} B/f ${k}`),
    ms: { p50: lasts[lasts.length >> 1]?.toFixed(3), p95: lasts[Math.floor(lasts.length * 0.95)]?.toFixed(3), max: lasts[lasts.length - 1]?.toFixed(3) },
    spikes: spikes.slice(0, 8),
  };
  log(name, out[name].simBytesPerFrame, out[name].ms);
}
await measure('night-1x', 'n3', 1, 8000);
await measure('night-600x', 'n3', 600, 8000);
await measure('day-1x', 'd3', 1, 8000);
await measure('dawn-60x', 'sunrise-16', 60, 12000);
return out;
