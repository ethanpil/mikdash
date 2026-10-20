// Live check of the song's render cache (run with the sim harness, low tier: the tightest budget):
//   node src/sim/dev/run.mjs --q low --out shots/audio-2-fix --script src/audio/dev/cache-live.js "t=sunrise+60"
// A. one cache entry per section: prefetchLibation({}) (the psalm of the day), a choreography's cue that names the
//    psalm, and the 'choir' loop all use the same key (no 'weekday' in it);
// B. follow-on: cueing a section of a song not prefetched queues that song's later sections at once;
// C. holds: Psalm 94's three sections (~23 MB at 32 kHz, beside ~19 MB of beds in a 40 MB budget) prefetched on low
//    are all still cached two minutes after they finished, through other renders that push the cache over budget.
const A = ctx.audio, E = A.engine, R = E.renderer;
const wait = (s) => sleep(s * 1000);
const out = { tier: E.tier, budgetMB: R.budget / 1048576 };
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const choirKeys = () => [...R.cache.entries()].filter(([k]) => k.includes(':choir-psalm:')).map(([k, e]) => ({ k: k.replace(/^cue:choir-psalm:\d+:/, ''), ready: !!e.buffer, MB: +(e.bytes / 1048576).toFixed(1), held: e.hold > performance.now() }));
const M = R.lanes.music;
const drain = async (limit) => { const t0 = performance.now(); while (M.busy || M.queue.length) { if (performance.now() - t0 > limit * 1000) return false; await wait(0.5); } return true; };
const clearSong = () => { for (const [k] of [...R.cache.entries()]) if (k.includes(':choir-psalm:')) R.cache.delete(k); M.queue.length = 0; };
await A.unlock();
await wait(20); // the beds and the next events' sounds
out.afterWarmMB = +(R.stats.bytes / 1048576).toFixed(1);
out.pinnedMB = +([...R.cache.values()].filter((e) => e.pinned).reduce((a, e) => a + e.bytes, 0) / 1048576).toFixed(1);
await drain(240);

// ---- A. shared keys
{
  clearSong();
  const day = A.libationTimeline({}).psalm, style = A.libationTimeline({}).style;
  A.prefetchLibation({}, 0);
  const before = choirKeys().map((x) => x.k);
  const hs = [0, 1, 2].map((s) => A.cue('choir-psalm', null, { psalm: day, section: s, style, gain: 0, caption: false }));
  const L = A.loop('choir', null, { psalm: day, section: 1, style, gain: 0 });
  // the loop renders (or finds) its buffer only when it becomes audible: its key, as it would ask for it
  const lv = [...E.loops].find((x) => x.handle === L);
  const loopKey = R.key('cue', 'choir-psalm', lv.rsOpts, E.rateFor('choir-psalm'));
  await wait(0.3);
  const after = choirKeys().map((x) => x.k);
  hs.forEach((h) => h.stop(0)); L.stop(0);
  out.A = { psalm: day, before, after, loopKeyCached: R.cache.has(loopKey) };
  check(before.length === 3, `A: prefetch made ${before.length} section entries, not 3`);
  check(after.length === before.length, `A: a cue naming the psalm added ${after.length - before.length} entries`);
  check(R.cache.has(loopKey), 'A: the loop would render its own copy of the section');
  check(after.every((k) => !k.includes('weekday')), 'A: weekday in a cache key');
  clearSong();
}

// ---- B. follow-on renders of the cued song
{
  const h = A.cue('choir-psalm', null, { song: 'haazinu-3', section: 0, gain: 0, caption: false });
  await wait(0.2);
  const ks = choirKeys().map((x) => x.k);
  h.stop(0);
  out.B = ks;
  check([0, 1, 2].every((s) => ks.some((k) => k.includes('"song":"haazinu-3"') && k.includes(`"section":${s}`))), 'B: the later sections of the cued song were not queued');
  clearSong();
}

// ---- C. holds on low
{
  const t0 = performance.now();
  A.prefetchLibation({ psalm: 94 }, 2);
  out.C = { drained: await drain(400), renderS: +((performance.now() - t0) / 1000).toFixed(1) };
  // other sounds as the day goes on: every variant of the common cues (renders that push the cache over budget)
  for (const id of ['magrefah', 'gate-boom', 'barkai', 'gevini', 'knock', 'muchni', 'shalom-call', 'great-gate-open', 'trumpet-tekiah']) A.prefetch([id]);
  await wait(120);
  const ks = choirKeys();
  out.C.after2min = { sections: ks, totalMB: +(R.stats.bytes / 1048576).toFixed(1) };
  check(ks.filter((x) => x.k.includes('"psalm":94') && x.ready).length === 3, 'C: a prefetched Psalm 94 section was evicted within 2 minutes');
}
out.fails = fails;
out.ok = !fails.length;
return out;
