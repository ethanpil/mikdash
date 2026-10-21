// Group G3 (sanctuary & song): the 'ketoret-morning' module serving ketoret-morning, birkat-kohanim, libation-song,
// menorah-lighting and maamad.
//   1. determinism — the same t reached by three jump orders gives identical figures (position, heading, pose, phase,
//      props), free vessels, lamps, fires, the gate curtain and the ma'amad crowd;
//   2. cues — continuous play at 120× through the morning (coal-pan → the song) and the afternoon (incense → song):
//      every cue key once, no sound twice at one moment, none on jumps;
//   3. jump-to-event — for each G3 event, the UI's landing (t0 + 0.25) then play at 6×: its headline cue fires;
//   4. cost — the module's update time per frame (runtime EMA) during the plays;
//   5. the audio durations the staging is timed by (g3/plan.js) against the synth (src/audio/synth);
//   6. Shabbat: the Kohen Gadol, the musaf's concert, shabbat-musaf still running after the date change, the afternoon's
//      Song at the Sea captions (no Psalm 92 caption);
//   7. the song is alive: every half minute of each song window shows the Levites playing / singing or a set;
//   8. adopted assets (choreo-adopt): the wine poured with pour_low at the cymbal, the segan's wave_sudar with the two
//      sudarin, the Menorah dressed (tend_lamp, the kuz in his left hand) and lit with the taper, the kaf covered and
//      held by its handle, the coals emptied with pour_low, and on Shabbat the psachter turned over the coals.
// run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/g3.js "t=sunrise+40"
const rt = ctx.schedule.runtime;
const E = rt.choreo('ketoret-morning');
if (!E || E.failed) return { error: 'module missing or failed', ok: !!E };
const r3 = (x) => Math.round(x * 1000) / 1000;
const tOf = (s) => (typeof s === 'number' ? ((s % 1440) + 1440) % 1440 : ctx.time.parse(s));

function snap() {
  const figs = [];
  for (const p of E.pools) for (const s of p.slots) {
    if (!s.want) continue;
    const o = s.actor.object3D.position;
    figs.push(`${p.name}#${s.index} ${r3(o.x)},${r3(o.y)},${r3(o.z)} h${r3(s._heading)} ${s._pose}${Number.isNaN(s._phase) ? '' : '@' + r3(s._phase)} ${s._g3r || ''}/${s._g3l || ''}`);
  }
  const S = E.state;
  const props = S.props.items.filter((it) => it.vis).map((it) => `${it.name} ${it.key}`);
  const crowds = E.crowds.map((c) => (c.want ? `1${c._pose || ''}${Number.isNaN(c._phase) ? '' : '@' + r3(c._phase)}` : '0')).join(' ');
  const mv = ctx.movables.get('curtain:heichal.gate-curtain');
  return {
    // the module's fires as the runtime's shared board applied them (sim.fireWant → FireBoard)
    figs, props, crowds, lamps: S.lamps.map((L) => L.v).join(''), incense: Math.max(0, S.incenseV),
    fires: ['g3.mizbach-hazahav.coals', 'g3.pan-coals', 'g3.pan-coals.ledge', ...S.lamps.map((L) => L.id)].map((id) => r3(Math.max(0, rt.fires.state(id)?.value ?? 0))).join(' '),
    curtain: r3(mv?.userData?.openAmount ?? -1), pan: ctx.movables.get('altar.machtah')?.visible,
  };
}
const at = async (s) => { ctx.time.set(tOf(s)); await frames(3); return snap(); };

// ---- 1. determinism
const T = ['sunrise-0.5', 'sunrise+1.5', 'sunrise+3', 'sunrise+50.4', 'sunrise+51.5', 'sunrise+53', 'sunrise+54.6', 'sunrise+55.45', 'sunrise+55.55', 'sunrise+56',
  'sunrise+57', 'sunrise+58.3', 'sunrise+60', 'sunrise+62.3', 'sunrise+63', 'sunrise+64.2', 'sunrise+65', 'sunrise+66.5', 'sunrise+67.2', 'sunrise+69',
  'sunrise+71.6', 'sunrise+72.5', 'sunrise+73.1', 'sunrise+74.6', 'sunrise+80', 'sunrise+88.7', 'sunrise+89.9', 'sunrise+90.55', 'sunrise+90.62', 'sunrise+91.5',
  'sunrise+92.6', 'sunrise+95', 'sunrise+96.3', 'sunrise+100', 'sunrise+104.9', 'sunrise+105.9', 'sunrise+106.3', 'd9.05', 'd9.17', 'd9.22', 'd9.27', 'd9.32', 'd9.38', 'd9.6',
  'd9.67', 'd9.68', 'd9.7', 'd9.9', 'd9.96', 'n3'];
const A = {}, B = {}, C = {};
for (const s of T) A[s] = await at(s);
for (const s of [...T].reverse()) B[s] = await at(s);
for (const s of T) { await at('d4'); C[s] = await at(s); }
const diffs = [];
for (const s of T) {
  const a = JSON.stringify(A[s]), b = JSON.stringify(B[s]), c = JSON.stringify(C[s]);
  if (a !== b || a !== c) {
    const fa = A[s].figs, fb = B[s].figs, fc = C[s].figs;
    diffs.push({ t: s, n: [fa.length, fb.length, fc.length], fig: fa.find((x, i) => x !== fb[i] || x !== fc[i]), figB: fb.find((x, i) => x !== fa[i]), figC: fc.find((x, i) => x !== fa[i]),
      rest: ['props', 'crowds', 'lamps', 'coals', 'incense', 'glow', 'curtain', 'pan'].filter((k) => JSON.stringify(A[s][k]) !== JSON.stringify(B[s][k]) || JSON.stringify(A[s][k]) !== JSON.stringify(C[s][k])).map((k) => `${k}: ${JSON.stringify(A[s][k])} | ${JSON.stringify(B[s][k])} | ${JSON.stringify(C[s][k])}`) });
  }
}
const summary = {};
for (const s of T) {
  const count = {};
  for (const f of A[s].figs) { const k = f.split('#')[0]; count[k] = (count[k] || 0) + 1; }
  summary[s] = `${ctx.time.format(tOf(s))} ${JSON.stringify(count)} crowds ${A[s].crowds} props ${A[s].props.length} lamps ${A[s].lamps} coals ${A[s].coals} inc ${A[s].incense} curtain ${A[s].curtain}`;
}

// ---- 7. the song is alive: every half minute from the first section to the last note
const PLAYING = new Set(['play_kinnor', 'play_nevel', 'sing', 'play_cymbal']);
const alive = {};
for (const L of E.state.plan.libs) {
  const T = L.T, dead = [];
  let n = 0;
  for (let t = T.ch[0][0] + 0.1; t < T.ch[2][1] - 0.05; t += 0.5) {
    const sn = await at(t);
    const poseOf = (f) => f.split(' ')[3].split('@')[0];
    const lev = sn.figs.filter((f) => (f.startsWith('levites#') || f.startsWith('boys#')) && PLAYING.has(poseOf(f))).length;
    const blow = sn.figs.some((f) => poseOf(f) === 'blow_trumpet');
    const prost = /prostrate/.test(sn.crowds);
    n++;
    if (lev < 8 && !blow && !prost) dead.push(`${ctx.time.format(t)} lev ${lev}`);
  }
  alive[L.key] = { samples: n, dead: dead.length, first: dead.slice(0, 6), sections: T.ch.map((c) => `${ctx.time.format(c[0])}-${ctx.time.format(c[2])}`).join(' '), sets: T.sets.map((x) => ctx.time.format(x)).join(' ') };
}

// ---- 2. cues at 120x + 4. cost
const SPEED = +(globalThis.__simSpeed || 120);
const calls = [], caps = [], libs = [], hushes = [];
const audio = ctx.audio;
const origCue = audio.cue, origLib = audio.libation, origHush = audio.ambience?.hush, origLoop = audio.loop;
const loops = [];
audio.loop = (id, pos, opts) => { if (id === 'choir') loops.push({ id, t: +ctx.time.t.toFixed(3), section: opts?.section }); return origLoop.call(audio, id, pos, opts); };
audio.cue = (id, pos, opts) => { calls.push({ id, t: +ctx.time.t.toFixed(3), pos: Array.isArray(pos) ? pos.map((v) => +v.toFixed(1)).join(',') : '' }); return origCue.call(audio, id, pos, opts); };
audio.libation = (opts) => { libs.push({ t: +ctx.time.t.toFixed(3), walk: opts?.walk }); return origLib.call(audio, opts); };
if (audio.ambience) audio.ambience.hush = (s) => { hushes.push({ t: +ctx.time.t.toFixed(2), s: +s.toFixed(1) }); return origHush?.call(audio.ambience, s); };
const offCap = ctx.bus.on?.('caption', (e) => caps.push({ id: e.id, t: +ctx.time.t.toFixed(2) }));
const fired = {}, multi = [];
let keysFired = 0;
const cost = [], spikes = [];
async function play(from, to, stand, speed = SPEED) {
  ctx.player.teleport({ at: stand });
  ctx.time.set(tOf(from)); await frames(3);
  E.handle.fired.clear();
  ctx.time.setSpeed(speed); ctx.time.pause(false);
  const len = (tOf(to) - tOf(from) + 1440) % 1440;
  let prev = ctx.time.t, played = 0;
  while (played < len) {
    await frames(1);
    const t = ctx.time.t;
    played += (t - prev + 1440) % 1440; prev = t;
    cost.push(E.ms);
    if (E.ms > 0.5) spikes.push(`${ctx.time.format(t)} ${E.ms.toFixed(3)}`);
  }
  ctx.time.pause(true);
  for (const k of E.handle.fired.keys()) fired[k] = (fired[k] || 0) + 1;
  for (const [k, n] of Object.entries(fired)) if (n > 1) multi.push(k);
  for (const k of Object.keys(fired)) delete fired[k];
  keysFired += E.handle.fired.size;
}
await play('sunrise+48', 'sunrise+108', [236, 342]);
await play('d9.0', 'd10.0', [236, 342]);
// the morning concert's opening at the normal speed: each part once as a cue (no ctx.audio.libation), then the 'choir'
// loop carrying the first section on
const callsBefore1x = calls.length, loopsBefore1x = loops.length;
const T0 = E.state.plan.libs[0].T;
await play(T0.L0 - 0.1, T0.loop[0][0] + 0.12, [236, 342], 1);
const at1x = calls.slice(callsBefore1x).map((c) => `${ctx.time.format(c.t)} ${c.id}`);
const loops1x = loops.slice(loopsBefore1x).map((c) => `${ctx.time.format(c.t)} ${c.id} s${c.section}`);
ctx.time.setSpeed(1);
// jumps across cue moments fire nothing
const before = calls.length, capsBefore = caps.length, libBefore = libs.length;
for (const s of ['sunrise+55.4', 'sunrise+55.6', 'sunrise+71.4', 'sunrise+71.6', 'sunrise+91.9', 'sunrise+92.1', 'sunrise+92.6', 'd9.3', 'd9.7']) { ctx.time.set(tOf(s)); await frames(2); }
const jumpCalls = calls.length - before, jumpCaps = caps.length - capsBefore, jumpLibs = libs.length - libBefore;
const count = {};
for (const c of calls) count[c.id] = (count[c.id] || 0) + 1;
const dup = [];
const seen = new Map();
for (const c of calls) { const k = `${c.id}@${c.pos}`; const last = seen.get(k); if (last !== undefined && Math.abs(c.t - last) < 0.05) dup.push(c); seen.set(k, c.t); }
const capDup = [];
const capSeen = new Map();
for (const c of caps) { const last = capSeen.get(c.id); if (last !== undefined && Math.abs(c.t - last) < 0.05) capDup.push(c); capSeen.set(c.id, c.t); }

// ---- 3. jump-to-event: land at t0 + 0.25 and play at 6x for 3 min: the headline captions/cues of each event
const HEAD = {
  'inner-clearing': 'inner-clearing', 'coal-pan': 'coal-pan', magrefah: 'magrefah', 'into-heichal': 'into-heichal', 'ketoret-morning': 'ketoret-bazach',
  'birkat-kohanim': 'birkat-kohanim', libation: 'libation-pour', 'song-weekday': 'song-day', 'song-friday': 'song-day', 'song-shabbat': 'song-day',
  'ketoret-afternoon': 'pm-heap', 'menorah-lighting': 'menorah-lighting', 'afternoon-song': 'libation-trumpets', 'afternoon-song-shabbat': 'libation-trumpets', 'maamad-morning': 'maamad', 'maamad-afternoon': 'maamad',
};
const jumpto = [];
for (const ev of E.events) {
  const want = HEAD[ev.id];
  if (!want) continue;
  const view = ev.view?.at;
  ctx.player.teleport({ at: Array.isArray(view) ? view : [236, 342] });
  const c0 = caps.length;
  ctx.time.set((ev.t0 + 0.25) % 1440); await frames(3);
  ctx.time.setSpeed(6); ctx.time.pause(false);
  const tStart = ctx.time.t;
  while (((ctx.time.t - tStart + 1440) % 1440) < 3) await frames(1);
  ctx.time.pause(true); ctx.time.setSpeed(1);
  const got = caps.slice(c0).map((c) => c.id);
  jumpto.push(`${ev.id}: ${got.includes(want) ? 'ok' : 'MISSING ' + want} [${got.join(',')}]`);
}
audio.cue = origCue; audio.libation = origLib; audio.loop = origLoop; if (audio.ambience) audio.ambience.hush = origHush;
offCap?.();

// ---- 6. Shabbat: the Kohen Gadol (handed over with tamid-morning), the musaf's concert claimed from shabbat-musaf
const d0 = ctx.time.date, wd = ctx.time.weekday;
const sat = new Date(Date.UTC(d0.y, d0.m - 1, d0.d + (((6 - wd + 7) % 7) || 7)));
const satStr = sat.toISOString().slice(0, 10);
ctx.time.setDate(satStr); await frames(4);
const TS = ['sunrise+63', 'sunrise+66.8', 'sunrise+68.2', 'sunrise+72', 'sunrise+74.9', 'sunrise+88.2', 'sunrise+91.8', 'sunrise+92.55', 'sunrise+100'];
const mus = E.state.plan.libs.find((l) => l.key === 'musaf')?.T;
if (mus) TS.push(mus.L0 + 0.1, mus.cym[0] + 0.05, mus.ch[1][0] + 0.05, mus.end + 2.0);
const SA = {}, SB = {};
for (const s of TS) SA[s] = await at(s);
for (const s of [...TS].reverse()) SB[s] = await at(s);
const shabbatDiffs = TS.filter((s) => JSON.stringify(SA[s]) !== JSON.stringify(SB[s]));
const g6 = rt.choreo('shabbat-musaf');
const SP = E.state.plan, pmL = SP.libs.find((l) => l.key === 'pm');
// between the tamid's song and the musaf's the Levites are in their chambers (when the gap is long)
const gapT = mus ? (SP.W.SG[1] + mus.L0 - 4) / 2 : NaN;
const levGap = mus ? (await at(gapT)).figs.filter((f) => f.startsWith('levites')).length : 'n/a';
const shabbat = {
  date: satStr, deterministic: shabbatDiffs.length === 0, diffs: shabbatDiffs.map(String),
  g6failed: !!g6?.failed, g6error: g6?.error ? String(g6.error).slice(0, 200) : null,
  pmCaptionOff: pmL?.audio?.caption === false, shirah: SP.cues.filter((q) => q.id === 'song-shirah').map((q) => `${ctx.time.format(q.t)} ${q.caption.en.slice(0, 70)}`),
  levitesBetweenSongs: mus ? `${ctx.time.format(gapT)}: ${levGap}` : 'n/a',
  musaf: mus ? `${ctx.time.format(mus.L0)} pour ${ctx.time.format(mus.cym[0])} end ${ctx.time.format(mus.end)}` : 'none',
  g6claimed: g6?.state?.claimed ?? 'n/a',
  kg: TS.map((s) => `${typeof s === 'number' ? ctx.time.format(s) : s}: ${SA[s].figs.filter((f) => f.startsWith('kg') || f.startsWith('segan')).map((f) => f.split(' ').slice(0, 1).concat(f.split(' ').slice(3, 4)).join(' ')).join(', ')} | levites ${SA[s].figs.filter((f) => f.startsWith('levites')).length}`),
};
ctx.time.setDate(`${d0.y}-${String(d0.m).padStart(2, '0')}-${String(d0.d).padStart(2, '0')}`); await frames(3);

// ---- 5. the audio durations the staging is timed by
let durations = 'skipped';
try {
  const mus = await import('/src/audio/synth/music.js');
  const plan = await import('/src/sim/choreo/g3/plan.js');
  const bad = [];
  for (const [k, p] of Object.entries(mus.PSALMS)) p.sections.forEach((s, i) => {
    const d = mus.psalmMelody(s, { tempo: 1 }).length + 3.5;
    if (Math.abs(d - (plan.PSALM_DUR[k]?.[i] ?? -9)) > 0.01) bad.push(`${k}/${i} ${d.toFixed(3)} vs ${plan.PSALM_DUR[k]?.[i]}`);
  });
  durations = bad.length ? bad : 'ok';
} catch (e) { durations = `error ${e.message}`; }

// ---- 6. the incense (I1) and pan (P1) men from the third lottery: lotteries.js walks its winners (Gazit circle slots 3
// and 4, seed 0x6745) to the Gazit's east doorway; ketoret-morning's scripts take them there from their first leg. Every
// 0.01 min across the hand-over: exactly one module wants each man, and he never jumps (≤ 3 m/s); also after jumps
const doorway = {};
{
  const tl1 = ctx.schedule.byId('third-fourth-lottery')?.t1;
  const who = () => {
    const m = new Map();
    for (const e of rt.entries) if (e.relevant) for (const p of e.pools) if (p.spec?.seed === 0x6745) for (const s of p.slots) {
      if (!s.want || (s.index !== 3 && s.index !== 4)) continue;
      const k = s.index;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push({ id: e.id, at: s._site.slice() });
    }
    return m;
  };
  const ev = [];
  let prev = null;
  for (let t = tl1 - 1.0; t <= tl1 + 0.2; t += 0.01) {
    ctx.time.set(t); await frames(1);
    const cur = who();
    for (const k of [3, 4]) {
      const c = cur.get(k) || [];
      if (c.length !== 1) ev.push(`${ctx.time.format(t)}+${(t % 1).toFixed(2)} #${k} wanted by ${c.length} (${c.map((x) => x.id).join(',')})`);
      const p = prev?.get(k)?.[0];
      if (p && c[0]) { const dm = Math.hypot(c[0].at[0] - p.at[0], c[0].at[1] - p.at[1]) * 0.48; if (dm > 3.0 * 0.6 + 0.2) ev.push(`${ctx.time.format(t)} #${k} jump ${dm.toFixed(2)} m ${p.id}→${c[0].id}`); }
    }
    prev = cur;
  }
  // a jump straight into the hand-over: the same place whichever module stages him
  ctx.time.set(tl1 - 0.44); await frames(3);
  const j1 = who();
  ctx.time.set(tl1 + 120); await frames(2); ctx.time.set(tl1 - 0.44); await frames(3);
  const j2 = who();
  const same = [3, 4].every((k) => JSON.stringify(j1.get(k)) === JSON.stringify(j2.get(k)));
  doorway.ok = ev.length === 0 && same;
  doorway.events = ev.slice(0, 8);
  doorway.jumpSame = same;
  doorway.owner = Object.fromEntries([3, 4].map((k) => [k, (j1.get(k) || []).map((x) => x.id).join(',')]));
}

// ---- 8. the adopted assets
const adopt = {};
{
  const ok = (k, v, info) => { adopt[k] = v ? true : `FAIL ${info ?? ''}`; };
  const slotsW = () => E.pools.flatMap((p) => p.slots.filter((x) => x.want));
  const go = async (t) => { ctx.time.set(((t % 1440) + 1440) % 1440); await frames(2); };
  const find = async (t0, t1, step, pred) => { for (let t = t0; t <= t1 + 1e-9; t += step) { await go(t); const x = slotsW().find(pred); if (x) return x; } return null; };
  const D = E.state.plan, W = D.W;
  const am = D.libs.find((l) => l.key === 'am')?.T;
  if (am) {
    ok('wine pour_low at the cymbal', await find(am.cym[0] - 0.05, am.cym[0] + 0.03, 0.02, (x) => x._pose === 'pour_low' && x._g3r === 'wine_jug'));
    ok('segan wave_sudar (two sudarin)', await find(am.cym[0] - 0.04, am.cym[0] + 0.04, 0.02, (x) => x._pose === 'wave_sudar' && x._g3r === 'sudar' && x._g3l === 'sudar'));
  } else ok('wine pour_low at the cymbal', false, 'no morning libation');
  const lo = D.lampOut.filter(Number.isFinite);
  ok('Menorah dressed (tend_lamp, kuz)', lo.length && await find(Math.min(...lo) - 0.2, Math.min(...lo), 0.03, (x) => x._pose === 'tend_lamp' && x._g3l === 'kuz'));
  const ll = D.lampLight.filter(Number.isFinite);
  ok('Menorah lit (tend_lamp, taper)', ll.length && await find(Math.min(...ll) - 0.2, Math.min(...ll), 0.03, (x) => x._pose === 'tend_lamp' && x._g3r === 'taper'));
  const kw = (D.props.kaf_covered || [])[0];
  ok('kaf_covered by its handle', kw && await find(kw.t1 + 0.12, kw.t1 + 1.5, 0.1, (x) => x._g3r === 'kaf_covered' && (x._pose === 'walk' || x._pose === 'stand')));
  ok('coals emptied (pour_low)', await find(W.CP[0], W.CP[1] + 3, 0.04, (x) => x._pose === 'pour_low' && x._g3r === 'machtah_silver'));
  // Shabbat: the psachter turned over the coals
  ctx.time.setDate('2026-11-07'); await frames(3);
  const D2 = E.state.plan;
  const inv = (D2.props.psachter_inverted || [])[0];
  if (inv) { await go(inv.t0 + 0.5); ok('psachter turned over (Shabbat)', E.state.props.items.some((it) => it.name === 'psachter_inverted' && it.vis)); } else ok('psachter turned over (Shabbat)', false, 'no window');
  ctx.time.setDate('2026-11-02'); await frames(3);
}

cost.sort((a, b) => a - b);
const pct = (p) => +(cost[Math.min(cost.length - 1, Math.floor(p * cost.length))] || 0).toFixed(3);
return {
  adopt, adoptOk: Object.values(adopt).every((v) => v === true),
  doorway,
  deterministic: diffs.length === 0, diffs: diffs.slice(0, 6), summary,
  cues: { sounds: count, libations: libs, at1x, loops1x, choirLoops: loops.length, hushes, captions: caps.map((c) => `${ctx.time.format(c.t)} ${c.id}`), captionDoubles: capDup.slice(0, 5), keys: keysFired, multi, doubles: dup.slice(0, 5), jumpCalls, jumpCaps, jumpLibs },
  jumpto, shabbat, alive,
  spikes: { n: spikes.length, first: spikes.slice(0, 8) },
  costMs: { frames: cost.length, avg: +(cost.reduce((a, b) => a + b, 0) / Math.max(1, cost.length)).toFixed(3), p50: pct(0.5), p95: pct(0.95), max: pct(1) },
  durations, debug: E.mod.debug?.(E.state),
};
