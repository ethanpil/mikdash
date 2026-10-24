// "Next" after midnight (qa-r2 SIM-R2-4): ctx.schedule.upcoming() lists today's later events, then the NEXT civil date's
// own events at their own zmanim — never this date's list wrapped round.
//   Friday 23:30 (2026-11-06): no night-turning (weekday nights only: Friday night is left alone); Shabbat's dawn lamp
//     inspection, not the weekday torch inspection;
//   Saturday 23:30 (2026-11-07): the night-turning of Saturday night, then Sunday's (weekday) dawn;
//   Friday 19:00: nothing of the weekday's after-midnight turning;
//   every listed row: today's with t0 later than t; a next day's carrying nextDay and the day type's events only;
//   an event active now is not listed again for tomorrow.
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/upcoming.js "t=d3"
const time = ctx.time, S = ctx.schedule;
const res = { cases: {} };
let bad = 0;
const fail = (k, why) => { bad++; (res.fail ||= []).push(`${k}: ${why}`); };
const dayOf = (date) => { const d = new Date(`${date}T12:00:00Z`).getUTCDay(); return d === 5 ? 'friday' : d === 6 ? 'shabbat' : 'weekday'; };
const next = (date) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
for (const [date, hm, must, mustNot] of [
  ['2026-11-06', '23:30', ['lamp-inspection-shabbat'], ['night-turning', 'torch-inspection']],
  ['2026-11-07', '23:30', ['night-turning', 'torch-inspection'], ['lamp-inspection-shabbat']],
  ['2026-11-06', '19:00', [], ['night-turning']],
  ['2026-11-02', '23:50', ['night-turning', 'torch-inspection'], ['lamp-inspection-shabbat']],
]) {
  time.setDate(date); await frames(3);
  time.set(time.parse(hm)); await frames(2);
  const t = time.t, list = S.upcoming(t, 40);
  const key = `${date} ${hm}`;
  res.cases[key] = list.slice(0, 8).map((e) => `${e.id}@${time.format(e.t0)}${e.nextDay ? '+1' : ''}`).join(' ');
  const ids = new Set(list.map((e) => e.id));
  for (const id of must) if (!ids.has(id)) fail(key, `missing ${id}`);
  for (const id of mustNot) if (ids.has(id)) fail(key, `lists ${id}`);
  const nd = next(date), dt = dayOf(nd);
  const active = new Set(S.active(t, { dynamic: false }).map((e) => e.id));
  for (const e of list) {
    if (e.nextDay) {
      if (e.nextDay !== nd) fail(key, `${e.id} nextDay ${e.nextDay}`);
      if (e.dayTypes && !e.dayTypes.includes(dt)) fail(key, `${e.id} is not a ${dt} event`);
      if (active.has(e.id)) fail(key, `${e.id} is active now and listed for tomorrow`);
    } else if (!(e.t0 > t)) fail(key, `${e.id} at ${time.format(e.t0)} is not later today`);
  }
  // soonest first
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i], da = a.nextDay ? 1440 - t + a.t0 : a.t0 - t, db = b.nextDay ? 1440 - t + b.t0 : b.t0 - t;
    if (db < da - 1e-6) { fail(key, `order ${a.id} / ${b.id}`); break; }
  }
}
res.ok = bad === 0;
return res;
