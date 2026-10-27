// "See in action" — the director's acceptance (console-design §6.2 "B's acceptance tests", §4.1):
//   for actions of each mode (now, warp, jump-later, rewind, tomorrow): seeInAction reaches 'showing' within its budget
//   (now ≤ 0.6 s, warp ≤ 6 s, jump ≤ 3 s, tomorrow ≤ 10 s on low); the subject is within ±10° of the free area's centre
//   after framing (yaw; pitch unless the director's clamp −25°…+10° binds); back() restores date, t (±0.01), place
//   (±0.1 m), heading (±1°), speed and pause.
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/inspect-show.js "t=d3&inspect=1"   (?sn=10: actions per mode)
const I = ctx.inspect;
if (!I) throw new Error('no ctx.inspect (add &inspect=1 to the query)');
I.load(); await I.ready;
const N = +(ctx.params?.raw?.get?.('sn') || 10);
const BUDGET = { now: 600, warp: 6000, 'jump-later': 3000, rewind: 3000, tomorrow: 10000 };
const fails = [];
const out = { modes: {} };
const V3 = ctx.camera.position.constructor;
const S = ctx.schedule;
const r2 = (x) => Math.round(x * 100) / 100;
await frames(10);

/** the angle (deg) between the view's centre and a world point: { yaw, pitch } */
function aim(p) {
  const cam = ctx.camera;
  cam.updateMatrixWorld();
  const eye = new V3().setFromMatrixPosition(cam.matrixWorld);
  const f = new V3(); cam.getWorldDirection(f);
  const d = p.clone().sub(eye);
  const yawF = Math.atan2(f.x, -f.z), yawD = Math.atan2(d.x, -d.z);
  const pitchF = Math.asin(Math.max(-1, Math.min(1, f.y))), pitchD = Math.atan2(d.y, Math.hypot(d.x, d.z));
  const dy = ((yawD - yawF) * 180 / Math.PI + 540) % 360 - 180;
  return { yaw: dy, pitch: (pitchD - pitchF) * 180 / Math.PI, want: pitchD * 180 / Math.PI };
}
/** where the director framed (h.framedOn): the figure's chest by its key, else the focus / the event (chest height) */
function subjectPoint(a, on) {
  const up = (p, y) => p.add(new V3(0, y, 0));
  if (on === 'subject' || (!on && a.subjectKey)) { const p = a.subjectKey && I.describer.locate(a.choreo, a.subjectKey, new V3()); if (p) return up(p, 1.3); }
  if (a.focus && a.focus.kind !== 'actor' && on !== 'event') {
    if (Array.isArray(a.focus.at)) return null;
    const p = I.anchorOf(a.focus); if (p) return up(p, a.focus.kind === 'el' ? Math.min(1.5, (I.describer.heightOf(a.focus) || 0) / 2) : 0);
  }
  const ev = a.eventId && S.byId(a.eventId);
  return ev ? up(S.positionOf(ev), 1.3) : null;
}
function snap() {
  const p = ctx.player;
  return { date: ctx.time.dateString, t: ctx.time.t, speed: ctx.time.speed, paused: ctx.time.paused, feet: p.position.clone(), heading: p.heading, pitch: p.pitch };
}
function compare(a, b) {
  const why = [];
  if (a.date !== b.date) why.push(`date ${b.date}≠${a.date}`);
  if (Math.abs(((a.t - b.t) % 1440 + 2160) % 1440 - 720) > 0.01) why.push(`t ${r2(b.t)}≠${r2(a.t)}`);
  if (a.feet.distanceTo(b.feet) > 0.1) why.push(`place ${r2(a.feet.distanceTo(b.feet))} m`);
  if (Math.abs(((a.heading - b.heading) % 360 + 540) % 360 - 180) > 1) why.push(`heading ${r2(b.heading)}≠${r2(a.heading)}`);
  if (a.speed !== b.speed) why.push(`speed ${b.speed}≠${a.speed}`);
  if (a.paused !== b.paused) why.push(`paused ${b.paused}≠${a.paused}`);
  return why;
}

// ------------------------------------------------------------------------------------------------ the actions
// candidates from the event cards (rites with a view) and from figures' cards at a few hours: grouped by mode
const DATE = '2026-11-02';
ctx.time.setDate(DATE); await frames(3);
const groups = { now: [], warp: [], 'jump-later': [], rewind: [], tomorrow: [] };
const modeOf = (a) => (a.mode === 'now' ? 'now' : a.mode === 'warp' ? 'warp' : a.date !== DATE ? 'tomorrow' : a.t > ctx.time.t ? 'jump-later' : 'rewind');
for (const h of ['sunrise+20', 'd3', 'd6', 'd9.5', 'n2']) {
  ctx.time.set(ctx.time.parse(h)); ctx.time.pause(true); await frames(3);
  const T = ctx.time.t;
  for (const ev of S.events) {
    if (!Number.isFinite(ev.t0) || ev.dayTypes?.includes?.('occasional')) continue;
    for (const a of I.describe(`event:${ev.id}`).actions.filter((x) => x.kind === 'see-in-action')) groups[modeOf(a)].push({ a, T, from: `event:${ev.id}` });
  }
  // figures (with their subject keys), a few per hour
  let k = 0;
  for (const f of I.picker.figures()) {
    if (k > 12) break;
    const ref = `actor:${f.entry.id}:${f.pool.name}:${f.index}`;
    const c = I.describe(ref);
    for (const a of (c.actions || []).filter((x) => x.kind === 'see-in-action' && x.subjectKey)) { groups[modeOf(a)].push({ a, T, from: ref }); k++; }
  }
}
// spread each mode's picks over the list
const pick = (list) => (list.length <= N ? list : Array.from({ length: N }, (_, i) => list[Math.floor(i * list.length / N)]));

for (const mode of Object.keys(groups)) {
  const rows = [];
  for (const { a, T, from } of pick(groups[mode])) {
    // start where the action was offered: its date, its clock, a neutral place
    if (ctx.time.dateString !== DATE) { ctx.time.setDate(DATE); await frames(3); }
    ctx.time.set(T); ctx.time.pause(true); ctx.time.setSpeed(1);
    ctx.player.teleport({ at: [330, 330.5, 6] }); ctx.player.setLook(270, 0);
    await frames(3);
    const before = snap();
    const t0 = performance.now();
    const h = I.seeInAction(a);
    const ok = await Promise.race([h.done, new Promise((r) => setTimeout(() => r('timeout'), 30000))]);
    const ms = performance.now() - t0;
    await frames(2);
    let p = subjectPoint(a, h.framedOn);
    // a stand-in point at the observer's own feet: the director keeps the view's heading (nothing to aim at)
    if (p && Math.hypot(p.x - ctx.camera.position.x, p.z - ctx.camera.position.z) < 2.5 && h.framedOn !== 'subject') p = null;
    const ang = p ? aim(p) : null;
    const clamped = ang && (ang.want < -25 || ang.want > 10);
    const framed = ang ? Math.abs(ang.yaw) <= 10 && (clamped || Math.abs(ang.pitch) <= 10) : null;
    const row = { from, label: a.label.en, phase: h.phase, ms: Math.round(ms), framed, framedOn: h.framedOn, yaw: ang && r2(ang.yaw), pitch: ang && r2(ang.pitch), subject: !!p };
    if (a.subjectKey && h.framedOn !== 'subject') out.notLocated = (out.notLocated || 0) + 1;
    if (ok !== true || h.phase !== 'showing') fails.push(`${mode}: ${from} "${a.label.en}" ended ${h.phase} (${ok})`);
    if (ms > BUDGET[mode]) fails.push(`${mode}: ${from} took ${Math.round(ms)} ms > ${BUDGET[mode]}`);
    if (framed === false) fails.push(`${mode}: ${from} framed off by yaw ${row.yaw}° pitch ${row.pitch}°`);
    // back
    const b0 = performance.now();
    const back = await I.back();
    await frames(2);
    const diff = compare(before, snap());
    row.back = back ? (diff.length ? diff.join(', ') : 'ok') : 'no back';
    row.backMs = Math.round(performance.now() - b0);
    if (!back || diff.length) fails.push(`${mode}: ${from} back: ${row.back}`);
    rows.push(row);
  }
  out.modes[mode] = { candidates: groups[mode].length, rows };
}
// ------------------------------------------------------------------------------------------------ framing with a docked console
// the console docked on the right (560 px): the subject must come to the FREE area's centre, not the screen's
{
  const W = innerWidth, H = innerHeight;
  I.setViewInset({ right: 560 });
  const rows = [];
  for (const { a, T, from } of pick(groups.now).slice(0, 3)) {
    ctx.time.set(T); ctx.time.pause(true);
    ctx.player.teleport({ at: [330, 330.5, 6] }); ctx.player.setLook(270, 0);
    await frames(3);
    const h = I.seeInAction(a);
    await h.done; await frames(2);
    const p = subjectPoint(a, h.framedOn);
    if (!p || (h.framedOn !== 'subject' && Math.hypot(p.x - ctx.camera.position.x, p.z - ctx.camera.position.z) < 2.5)) { await I.back(); continue; }
    // the angle between the subject and the ray through the free area's centre
    const cam = ctx.camera; cam.updateMatrixWorld();
    const eye = new V3().setFromMatrixPosition(cam.matrixWorld);
    const cx = (W - 560) / 2, cy = H / 2;
    const c = new V3((cx / W) * 2 - 1, -((cy / H) * 2 - 1), 0.5).unproject(cam).sub(eye).normalize();
    const d = p.clone().sub(eye).normalize();
    const yawC = Math.atan2(c.x, -c.z), yawD = Math.atan2(d.x, -d.z);
    const dy = ((yawD - yawC) * 180 / Math.PI + 540) % 360 - 180;
    rows.push({ from, yaw: r2(dy) });
    if (Math.abs(dy) > 10) fails.push(`inset: ${from} off the free centre by ${r2(dy)}°`);
    await I.back();
  }
  I.setViewInset({});
  out.inset = rows;
}

// ------------------------------------------------------------------------------------------------ overlapping shows
// a second Show me while the first is still warping: the first stops where it is, the second runs, and Back restores
// the Return point taken before the FIRST (t ±0.01, speed, paused) — never a mid-warp clock at warp speed
{
  const rows = [];
  const cand = groups.warp.find((x) => x.from.startsWith('event:'));
  if (cand) {
    for (const [name, second, gapMs] of [['warp+warp', 'same', 1500], ['warp+warp fast', 'same', 150], ['warp+jump', 'jump', 1200]]) {
      if (ctx.time.dateString !== DATE) { ctx.time.setDate(DATE); await frames(3); }
      ctx.time.set(cand.T); ctx.time.pause(true); ctx.time.setSpeed(1);
      ctx.player.teleport({ at: [330, 330.5, 6] }); ctx.player.setLook(270, 0);
      await frames(3);
      const before = snap();
      const h1 = I.seeInAction(cand.a);
      await sleep(gapMs);
      const a2 = second === 'same' ? cand.a : { ...cand.a, mode: 'jump', t: (cand.T + 300) % 1440, label: { en: 'a jump' } };
      const h2 = I.seeInAction(a2);
      const r = await Promise.race([h2.done, new Promise((res) => setTimeout(() => res('timeout'), 20000))]);
      const b = await Promise.race([I.back(), new Promise((res) => setTimeout(() => res('timeout'), 15000))]);
      await frames(2);
      const diff = compare(before, snap());
      rows.push({ name, first: h1.phase, second: h2.phase, r, back: b === true ? (diff.length ? diff.join(', ') : 'ok') : String(b) });
      if (r !== true || h2.phase !== 'showing') fails.push(`overlap ${name}: the second show ended ${h2.phase} (${r})`);
      if (b !== true || diff.length) fails.push(`overlap ${name}: back ${b === true ? diff.join(', ') : b}`);
    }
  } else fails.push('overlap: no warp candidate');
  out.overlap = rows;
}
// ------------------------------------------------------------------------------------------------ around midnight
// moments carry a date: 23:50 → a rite at 00:00 is a warp onto the next date; 00:10 → "From the start" of a rite that
// began the evening before is on the previous date; a jump to 00:00 lands 0.1 min before it, on the previous date
{
  const rows = {};
  const D2 = '2026-11-03';
  ctx.time.setDate(DATE); await frames(3);
  ctx.time.set(23 * 60 + 50); ctx.time.pause(true); await frames(2);
  const zero = S.events.filter((ev) => Number.isFinite(ev.t0) && ev.t0 < 10 && !ev.dayTypes?.includes?.('occasional'));
  for (const ev of zero.slice(0, 3)) {
    const acts = I.describe(`event:${ev.id}`).actions.filter((x) => x.kind === 'see-in-action');
    rows[`23:50 ${ev.id}`] = acts.map((x) => `${x.label.en} [${x.mode} ${x.date}]`);
    const a = acts[0];
    if (!a || a.mode !== 'warp' || a.date !== D2) fails.push(`midnight: at 23:50 ${ev.id} (t0 ${r2(ev.t0)}) offers ${a ? `${a.label.en} ${a.mode} ${a.date}` : 'nothing'}, not a warp onto ${D2}`);
  }
  ctx.time.setDate(D2); await frames(3);
  ctx.time.set(10); ctx.time.pause(true); await frames(2);
  const wrapped = S.events.filter((ev) => Number.isFinite(ev.t0) && ev.t0 > ev.t1 && ev.t0 > 600 && ev.t1 > 10 && !ev.dayTypes?.includes?.('occasional'));
  for (const ev of wrapped.slice(0, 3)) {
    const st = I.describe(`event:${ev.id}`).actions.find((x) => /:start$/.test(x.id || ''));
    rows[`00:10 ${ev.id}`] = st ? `${st.label.en} [${st.date}]` : 'none';
    if (st && st.date !== DATE) fails.push(`midnight: at 00:10 ${ev.id} "From the start" is on ${st.date}, not ${DATE}`);
  }
  const h = I.seeInAction({ kind: 'see-in-action', mode: 'jump', t: 0, date: D2, label: { en: 'midnight' } });
  await h.done; await frames(2);
  rows.jumpToMidnight = `${ctx.time.dateString} ${r2(ctx.time.t)}`;
  if (ctx.time.dateString !== DATE || Math.abs(ctx.time.t - 1439.9) > 0.05) fails.push(`midnight: a jump to ${D2} 00:00 landed ${rows.jumpToMidnight}`);
  await I.back();
  out.midnight = rows;
}
// ------------------------------------------------------------------------------------------------ individuals' offerings
// a Friday private offering never offers Shabbat (no "Tomorrow" for a dynamic instance; another of its kind instead)
{
  const FRI = '2026-11-06';
  ctx.time.setDate(FRI); await frames(3);
  let n = 0;
  for (const hh of ['d4', 'd6', 'd8']) {
    ctx.time.set(ctx.time.parse(hh)); ctx.time.pause(false); await sleep(600); ctx.time.pause(true);
    for (const f of I.picker.figures()) {
      if (!/private-offerings|courts-daily/.test(f.entry.id)) continue;
      const c = I.describe(`actor:${f.entry.id}:${f.pool.name}:${f.index}`);
      for (const a of c.actions.filter((x) => x.kind === 'see-in-action')) {
        n++;
        if (a.date && a.date !== FRI && /^(offering|set):/.test(a.eventId || '')) fails.push(`friday: ${c.ref.id} "${a.label.en}" → ${a.date}`);
      }
    }
    for (const ev of S.dynamic(ctx.time.t)) for (const a of I.describe(`event:${ev.id}`).actions.filter((x) => x.kind === 'see-in-action')) { n++; if (a.date && a.date !== FRI) fails.push(`friday: event ${ev.id} "${a.label.en}" → ${a.date}`); }
  }
  out.fridayActions = n;
}

out.fails = fails;
if (fails.length) throw new Error(`inspect-show: ${fails.length} failures\n${fails.join('\n')}\n${JSON.stringify(out, null, 1)}`);
return out;
