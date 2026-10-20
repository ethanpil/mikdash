// Screenshot of the sung-verse captions in the HUD (run with the UI kept):
//   node src/sim/dev/run.mjs --keep-ui --q low --out shots/audio-2 --script src/audio/dev/song-caption-shot.js "t=sunrise+95"
// Sound stays locked here, so the verses run on the real clock (as for a viewer with sound off).
try { ctx.ui?.enter?.(); } catch { /* no intro */ }
await sleep(1500);
const A = ctx.audio;
const seen = [];
ctx.bus.on('caption', (c) => seen.push(c.verse || c.id));
A.cue('choir-psalm', null, { psalm: 24, section: 0 });
await sleep(1200);
await shot('caption-ps24-v1');
await sleep(10500);
await shot('caption-ps24-v2');
A.cue('choir-psalm', null, { song: 'haazinu', week: 0, section: 0 });
await sleep(1200);
await shot('caption-haazinu-1');
return { seen, state: A.state };
