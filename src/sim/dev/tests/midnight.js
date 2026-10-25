// A new date in normal play (gate-sim-data): the clock through midnight at speed 1, 60 and 600, and the date picker.
// Each re-plans the G4/G5 chain in the plan job's slices (runtime.js remap → lib/planjob.js restart); no frame may take
// longer than MAX_FRAME ms from the frame the date changes on (a picker's date is new from the first frame). The clock
// jumps that set each segment up are not judged: a jump shows another hour's figures and props (GPU, not planning).
// Recording starts a few seconds after the boot's deferred world programs are shown (ctx.bootTimes.shown — on the dev
// server ~20 s after the first frame, and those frames take 300–800 ms with the sim at ~1 ms). Throws on a failure, so
// run.mjs exits 1. Records requestAnimationFrame deltas, the sim's own ms in the worst frames, the job's slices and its
// longest single step-advance. Run it on an idle machine: frame times under CPU contention fail it (docs/decisions/
// gate-sim-data-r2.md). Normal play only (no shot=1):
//   node src/sim/dev/run.mjs --q low --keep-ui --script src/sim/dev/tests/midnight.js "date=2026-11-02&t=23:50"
const rt = ctx.schedule.runtime, time = ctx.time;
const MAX_FRAME = 100;
if (ctx.params?.shot) throw new Error('midnight.js measures normal play: run with --keep-ui');
try { ctx.ui?.enter?.(); } catch { /* no intro */ }
for (let i = 0; i < 1200 && !(rt.plans.done && Number.isFinite(ctx.bootTimes?.shown)); i++) await sleep(100);
if (!Number.isFinite(ctx.bootTimes?.shown)) throw new Error('midnight.js: the deferred world programs were not shown within 120 s');
await sleep(6000);           // the boot's idle work (material bakes, nav) settles
async function rec(label, setup, ms) {
  const d0 = time.dateString;
  setup();
  const picked = time.dateString !== d0;     // a date picked in setup: every frame is the new date's
  const out = [];
  let last = performance.now();
  const end = last + ms;
  await new Promise((res) => {
    const f = () => {
      const now = performance.now();
      out.push([+(now - last).toFixed(1), +time.t.toFixed(3), time.dateString, +(rt.stats.last ?? 0).toFixed(1), rt.plans.done ? 1 : 0]);
      last = now;
      if (now < end) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
  const d = out.slice(1).map((r) => r[0]).sort((a, b) => a - b);
  const worst = out.slice(1).sort((a, b) => b[0] - a[0]).slice(0, 4);
  // judged: from the frame the date changes on (the first frame of a new date), or every frame when setup picked one
  const k = picked ? 1 : out.findIndex((r) => r[2] !== d0);
  const judged = k < 0 ? [] : out.slice(Math.max(1, k));
  const jmax = judged.reduce((m, r) => Math.max(m, r[0]), 0);
  const ps = rt.plans.stats;
  return { label, frames: out.length, p50: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1], worst,
    from: [d0, out[0]?.[1]], to: [out[out.length - 1]?.[2], out[out.length - 1]?.[1]], speed: time.speed, paused: time.paused,
    crossed: k >= 0, judged: judged.length, judgedMax: jmax, judgedWorst: judged.slice().sort((a, b) => b[0] - a[0]).slice(0, 3),
    job: { runs: rt.plans.runs || 0, done: rt.plans.done, ms: Math.round(ps.ms), slices: ps.slices, maxSlice: +ps.maxSlice.toFixed(1), maxNext: +(ps.maxNext || 0).toFixed(1), maxNextId: ps.maxNextId, took: Math.round((ps.doneAt || performance.now()) - ps.startedAt), order: ps.order } };
}
// dates picked relative to the clock's, so each pick is a real change whatever the query's date
const addDays = (ds, n) => new Date(Date.parse(`${ds}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const nextFriday = (ds) => { let d = addDays(ds, 1); while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 5) d = addDays(d, 1); return d; };
const res = [];
time.pause(false);
res.push(await rec('steady 60x 23:40', () => { time.set(23 * 60 + 40); time.setSpeed(60); }, 3000));
res.push(await rec('midnight speed 1', () => { time.set(1439.92); time.setSpeed(1); }, 9000));
res.push(await rec('midnight 60x', () => { time.set(1439.5); time.setSpeed(60); }, 5000));
res.push(await rec('midnight 600x', () => { time.set(1439); time.setSpeed(600); }, 5000));
res.push(await rec('date picker (10:00, next day)', () => { time.setSpeed(1); time.set(600); time.setDate(addDays(time.dateString, 1)); }, 6000));
res.push(await rec('date picker (Friday) then sunset', () => { time.setDate(nextFriday(time.dateString)); time.set(time.zmanim.sunset - 0.5); time.setSpeed(60); }, 5000));
res.push(await rec('Friday midnight into Shabbat 60x', () => { time.set(1439.5); time.setSpeed(60); }, 5000));
time.setSpeed(1);
// the steady segment is the baseline (no date change); every other segment must change the date and stay under MAX_FRAME
const bad = res.filter((r) => r.label !== 'steady 60x 23:40' && (!r.crossed || r.judgedMax > MAX_FRAME));
log(JSON.stringify(res.map((r) => [r.label, r.p50, r.p95, r.max, 'judged', r.judged, r.judgedMax, r.job.maxSlice, r.job.maxNext, r.job.maxNextId])));
if (bad.length) throw new Error(`midnight.js: ${bad.map((r) => `${r.label}: ${r.crossed ? `${r.judgedMax} ms > ${MAX_FRAME} (${JSON.stringify(r.judgedWorst)})` : `the date did not change (${JSON.stringify({ from: r.from, to: r.to, frames: r.frames, speed: r.speed, paused: r.paused })})`}`).join('; ')}`);
return { ok: true, maxFrame: MAX_FRAME, res };
