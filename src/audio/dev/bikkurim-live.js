// Live check of render-audio-3's audio in the app (run with the sim harness):
//   node src/sim/dev/run.mjs --q low --out shots/render-audio-3 --script src/audio/dev/bikkurim-live.js "t=d3"
// A. the bikkurim song (Psalm 30, 'aromimcha') asked for as the G5 choreography would: song 'bikkurim', section 0 at the
//    duchan — its heading and verse captions (Ps 30:1 …) on the computed timing, with sound locked (captions on the real
//    clock) and then running (the verse chunks render in the Worker and sound: an AnalyserNode on the master);
//    { psalm: 30 } and { song: 'psalm-30' } share its cache key;
// B. 'pot-break' at the scouring's basin: rendered in the Worker, plays, ends; its alias 'pot-shatter'.
const A = ctx.audio, E = A.engine, bus = ctx.bus;
const caps = [];
bus.on('caption', (c) => caps.push({ t: performance.now() / 1000, id: c.id, verse: c.verse || null, dur: +(+c.duration).toFixed(2), en: (c.text?.en || '').slice(0, 90), he: (c.text?.he || '').slice(0, 40) }));
const wait = (s) => sleep(s * 1000);
const out = {};
const pos = [243, 340, 16];

// ---- A1. locked: the captions on the real clock
{
  const opts = { song: 'bikkurim', section: 0 };
  const T = A.sectionTiming(opts, 0);
  out.timing = { id: T.id, duration: +T.duration.toFixed(2), verses: T.verses.map((v) => v.key) };
  caps.length = 0;
  const t0 = performance.now() / 1000;
  A.cue('choir-psalm', pos, opts);
  await wait(Math.min(T.duration, 14) + 0.5);
  const v = caps.filter((c) => c.verse);
  out.A1 = {
    state: A.state, heading: caps.find((c) => !c.verse) ?? null,
    verses: v.map((c, i) => ({ verse: c.verse, at: +(c.t - t0).toFixed(2), want: +(T.verses[i]?.t0 ?? -1).toFixed(2), en: c.en, he: c.he })),
  };
  A.stopAll?.(0.1);
}

// ---- A2. running: it sounds
await A.unlock();
await wait(0.5);
out.state = A.state;
const an = new AnalyserNode(E.ac, { fftSize: 2048 });
E.master.connect(an);
const buf = new Float32Array(2048);
const level = () => { an.getFloatTimeDomainData(buf); let e = 0; for (let i = 0; i < buf.length; i++) e += buf[i] * buf[i]; return 10 * Math.log10(e / buf.length + 1e-12); };
{
  A.ambience?.hush?.(60);
  await wait(1);
  const bed = []; for (let k = 0; k < 10; k++) { bed.push(level()); await wait(0.05); }
  const opts = { song: 'bikkurim', section: 1 };
  const r0 = performance.now();
  await Promise.all(E.fetchSection({ song: 'aromimcha', section: 1, style: 'mishnah' }, { priority: 50 }));
  const renderMs = Math.round(performance.now() - r0);
  caps.length = 0;
  ctx.player.teleport({ at: [243, 330] });
  A.cue('choir-psalm', pos, opts);
  const lv = []; for (let k = 0; k < 40; k++) { await wait(0.25); lv.push(level()); }
  out.A2 = { renderMs, bedDb: +Math.max(...bed).toFixed(1), songDbMax: +Math.max(...lv).toFixed(1), songDbMedian: +lv.sort((a, b) => a - b)[20].toFixed(1), captions: caps.filter((c) => c.verse).map((c) => c.verse) };
  A.stopAll?.(0.2);
  await wait(0.5);
}

// ---- A3. one cache entry for the bikkurim song however it is named
{
  const keys = [];
  const orig = E.renderer.get.bind(E.renderer);
  E.renderer.get = (kind, id, opts, sr, o) => { if (id === 'choir-psalm') keys.push(JSON.stringify(opts)); return orig(kind, id, opts, sr, o); };
  for (const o of [{ song: 'aromimcha' }, { song: 'psalm-30' }, { psalm: 30 }, { song: 30 }]) { const h = A.cue('choir-psalm', pos, { ...o, section: 2, caption: false }); await wait(0.2); h?.stop?.(0); }
  E.renderer.get = orig;
  out.A3 = { distinctKeys: [...new Set(keys.map((k) => { const o = JSON.parse(k); delete o.chunk; return JSON.stringify(o); }))] };
  A.stopAll?.(0);
}

// ---- B. the pot
{
  ctx.player.teleport({ at: [233, 290] });
  await wait(0.5);
  const bed = []; for (let k = 0; k < 10; k++) { bed.push(level()); await wait(0.05); }
  const r0 = performance.now();
  await A.prefetch?.(['pot-break']);
  const h = A.cue('pot-break', [235.1, 293.1, 16]);
  const lv = []; for (let k = 0; k < 30; k++) { await wait(0.05); lv.push(level()); }
  const ended = await Promise.race([h?.ended, wait(5).then(() => 'timeout')]);
  const h2 = A.cue('pot-shatter', [235.1, 293.1, 16], { variant: 1 });
  await wait(0.2);
  out.B = { ms: Math.round(performance.now() - r0), duration: h?.duration ?? null, ended, bedDb: +Math.max(...bed).toFixed(1), peakDb: +Math.max(...lv).toFixed(1), aliasHandle: !!h2, inCues: A.cues.includes('pot-break') };
}
A.ambience?.release?.();
return out;
