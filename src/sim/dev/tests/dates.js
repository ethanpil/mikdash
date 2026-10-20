const rt = ctx.schedule.runtime;
const nw = rt.choreo('night-watch');
for (let i = 0; i < 200 && !(nw.state?.route && nw.state.routeSource.startsWith('nav')); i++) await sleep(250);
const shown = () => rt.entries.map((e) => `${e.id}:${e.pools.map((q) => `${q.name}=${q.slots.filter((s) => s.shown).length}`).join(',')}`).join(' ');
const out = [];
for (const [date, t] of [['2026-11-02', 'n9'], ['2026-11-06', 'n3'], ['2026-11-07', 'n9'], ['2026-11-07', 'n3'], ['2027-06-21', 'n3'], ['2026-11-02', 'n3']]) {
  ctx.time.setDate(date);
  ctx.time.set(ctx.time.parse(t));
  await frames(3);
  const ev = ctx.schedule.byId('night-watch');
  out.push(`${date} ${ctx.time.dayType} ${t}=${ctx.time.format()} events=${ctx.schedule.events.length} watch ${ctx.time.format(ev?.t0)}-${ctx.time.format(ev?.t1)} | ${shown()}`);
}
await shot('debug-overlay');
return out;
