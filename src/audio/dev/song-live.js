// Live check of the sung sections in the app (run with the sim harness):
//   node src/sim/dev/run.mjs --q low --out shots/audio-2 --script src/audio/dev/song-live.js "t=sunrise+120"
// A. sound locked: the verses are captioned on the real clock, in time with the computed timing;
// B. sound running: captions against the AudioContext clock and the output level (an AnalyserNode on the master);
// C. a 'choir' loop requested while the cue of its section sounds starts when that cue ends, and captions again with
//    opts.caption: true (and names no verse without it);
// D. libation({ song }) schedules every part where libationTimeline says, and handle.started tells when t = 0 sounded;
//    a time jump cancels the captions.
const A = ctx.audio, E = A.engine, bus = ctx.bus;
const caps = [];
bus.on('caption', (c) => caps.push({ t: performance.now() / 1000, id: c.id, verse: c.verse || null, dur: +(+c.duration).toFixed(2), en: (c.text?.en || '').slice(0, 48) }));
const wait = (s) => sleep(s * 1000);
const out = {};

// ---- A. locked
{
  const opts = { psalm: 93, section: 0 };
  const T = A.sectionTiming(opts);
  out.lockedState = A.state;
  caps.length = 0;
  const t0 = performance.now() / 1000;
  A.cue('choir-psalm', null, opts);
  await wait(T.duration + 0.5);
  const v = caps.filter((c) => c.verse);
  out.A = {
    state: A.state, heading: caps.find((c) => !c.verse)?.en ?? null,
    verses: v.map((c, i) => ({ verse: c.verse, at: +(c.t - t0).toFixed(2), want: T.verses[i]?.t0, dur: c.dur })),
    maxErr: Math.max(...v.map((c, i) => Math.abs(c.t - t0 - (T.verses[i]?.t0 ?? 99)))),
  };
}

// ---- B. running
await A.unlock();
await wait(0.5);
out.state = A.state;
const an = new AnalyserNode(E.ac, { fftSize: 2048 });
E.master.connect(an);
const buf = new Float32Array(2048);
const level = () => { an.getFloatTimeDomainData(buf); let e = 0; for (let i = 0; i < buf.length; i++) e += buf[i] * buf[i]; return 10 * Math.log10(e / buf.length + 1e-12); };
{
  const opts = { psalm: 93, section: 1 };
  const T = A.sectionTiming(opts);
  // render first so the start is not late (late sections join in progress)
  const r0 = performance.now();
  await E.renderer.get('cue', 'choir-psalm', { ...opts, style: 'mishnah' }, E.rateFor('choir-psalm'), { priority: 50 });
  out.renderMs = Math.round(performance.now() - r0);
  const bed = []; for (let k = 0; k < 10; k++) { bed.push(level()); await wait(0.05); }
  caps.length = 0;
  const h = A.cue('choir-psalm', null, opts);
  await wait(0.3);
  const voice = [...E.voices].find((x) => x.id === 'choir-psalm');
  const start = voice?.startTime ?? NaN;
  const env = [];
  const tEnd = E.ac.currentTime + T.duration - 0.2;
  while (E.ac.currentTime < tEnd) { env.push([+(E.ac.currentTime - start).toFixed(2), +level().toFixed(1)]); await wait(0.1); }
  const pnowAtStart = performance.now() / 1000 - (E.ac.currentTime - start); // perf seconds at the buffer start
  const v = caps.filter((c) => c.verse);
  const sing = env.filter(([t]) => T.verses.some((x) => t > x.t0 + 0.3 && t < x.t1 - 0.3)).map((e) => e[1]).sort((a, b) => a - b);
  out.B = {
    duration: h.duration, want: T.duration,
    verses: v.map((c, i) => ({ verse: c.verse, at: +(c.t - pnowAtStart).toFixed(2), want: T.verses[i]?.t0 })),
    maxErr: Math.max(...v.map((c, i) => Math.abs(c.t - pnowAtStart - (T.verses[i]?.t0 ?? 99)))),
    bedDb: +(bed.reduce((a, b) => a + b, 0) / bed.length).toFixed(1), singingMedianDb: sing[Math.floor(sing.length / 2)], singingMaxDb: sing[sing.length - 1],
  };
}

// ---- C. loop continuation
{
  const opts = { psalm: 93, section: 2 };
  const T = A.sectionTiming(opts);
  await E.renderer.get('cue', 'choir-psalm', { psalm: 93, section: 2, style: 'mishnah' }, E.rateFor('choir-psalm'), { priority: 50 });
  caps.length = 0;
  A.cue('choir-psalm', null, opts);
  await wait(4);
  const cueV = [...E.voices].find((x) => x.id === 'choir-psalm');
  const L = A.loop('choir', null, { ...opts, caption: true }); // verse captions on a loop are opt-in
  const lv = [...E.loops].find((x) => x.id === 'choir');
  await wait(T.duration - 4 + 3);
  out.C = {
    cueEnds: cueV ? +(cueV.startTime + cueV.buffer.duration).toFixed(2) : null, loopStarts: lv?.startTime != null ? +lv.startTime.toFixed(2) : null,
    loopActive: L.active, captions: caps.filter((c) => c.verse).map((c) => c.verse),
  };
  L.stop(0.2);
  // without the opt-in (G3's call) the loop sings but names no verse
  await wait(0.5);
  caps.length = 0;
  const L2 = A.loop('choir', null, opts);
  await wait(6);
  out.C.plainLoop = { active: L2.active, verseCaptions: caps.filter((c) => c.verse && c.id === 'choir').length };
  L2.stop(0.2);
}

// ---- D. libation vs libationTimeline, then a jump
{
  const opts = { song: 'az-yashir-yisrael', walk: 4 };
  const T = A.libationTimeline(opts);
  const starts = [];
  const orig = E.startVoice.bind(E);
  E.startVoice = (v, b, when, off, f) => { starts.push({ id: v.id, when, off, perf: performance.now() + (when - E.ac.currentTime) * 1000 }); return orig(v, b, when, off, f); };
  caps.length = 0;
  const t0 = performance.now();
  const lib = A.libation(opts);
  const started = await lib.started;
  const done = await lib.done;
  E.startVoice = orig;
  const waitedS = +((performance.now() - t0) / 1000 - T.done).toFixed(1); // render wait before the first blast
  const s0 = starts.find((x) => x.id === 'trumpet-set')?.when ?? 0;
  const ids = new Set(T.cues.map((c) => c.id));
  // the buffer's zero on the timeline: a section that joined in progress starts later at an offset
  const got = starts.filter((x) => ids.has(x.id)).map((x) => ({ id: x.id, t: +(x.when - x.off - s0).toFixed(2), late: +x.off.toFixed(2) }));
  out.D = {
    timeline: T.cues.map((c) => `${c.id}@${c.t}`), played: got.map((g) => `${g.id}@${g.t}${g.late ? ` (joined ${g.late} s in)` : ''}`),
    maxErr: Math.max(...T.cues.map((c, i) => Math.abs((got[i]?.t ?? 99) - c.t))), done, waitedS,
    // handle.started vs the first blast's actual start (ms)
    startedErrMs: started ? +(starts.find((x) => x.id === 'trumpet-set').perf - started.perf).toFixed(1) : null, startedSim: started?.sim ?? null,
    verses: caps.filter((c) => c.verse).map((c) => c.verse), headings: caps.filter((c) => c.id === 'choir-psalm' && !c.verse).map((c) => c.en),
  };
  // a jump in the middle of a section cancels its captions
  await E.renderer.get('cue', 'choir-psalm', { song: 'haazinu-1', section: 0, style: 'mishnah' }, E.rateFor('choir-psalm'), { priority: 50 });
  caps.length = 0;
  A.cue('choir-psalm', null, { song: 'haazinu-1', section: 0 });
  await wait(3);
  bus.emit('time:jump', {});
  const n = caps.length;
  await wait(8);
  out.jump = { before: n, after: caps.length - n, tracks: E.tracks.size };
}
// ---- E. a section not yet rendered joins in progress at the timeline's place; its captions do not wait for the render
{
  const opts = { song: 'haazinu-2', section: 1 };
  const T = A.sectionTiming(opts);
  // the music lane idle first (the earlier parts' follow-on renders), so the wait measured is this render's own
  const M = E.renderer.lanes.music, d0 = performance.now();
  while ((M.busy || M.queue.length) && performance.now() - d0 < 240000) await wait(0.5);
  const starts = [];
  const orig = E.startVoice.bind(E);
  E.startVoice = (v, b, when, off, f) => { if (v.id === 'choir-psalm') starts.push({ when, off, perf: performance.now() / 1000 + (when - E.ac.currentTime) }); return orig(v, b, when, off, f); };
  caps.length = 0;
  const t0 = performance.now() / 1000;
  A.cue('choir-psalm', null, opts);
  await wait(T.duration + 1);
  E.startVoice = orig;
  const st = starts[0];
  const v = caps.filter((c) => c.verse);
  out.E = {
    startedAfter: st ? +(st.perf - t0).toFixed(2) : null, offset: st ? +st.off.toFixed(2) : null, clockErr: st ? +Math.abs(st.perf - t0 - st.off).toFixed(3) : null,
    verses: v.map((c) => ({ verse: c.verse, at: +(c.t - t0).toFixed(2), want: T.verses.find((x) => x.key === c.verse)?.t0 })),
  };
}
return out;
