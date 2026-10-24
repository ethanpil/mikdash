// The sha'atnez avnet (qa-r2 SIM-R2-1): worn only in the avodah (Rambam Klei HaMikdash 8:11; docs/decisions/people.md).
//   1. off — every kohen of these states shown without it: the meal by day and at night and the scouring
//      (courts-daily), the showbread's division and the Kohen Gadol's loaves (shabbat-mishmar), the four who took the
//      old bread out waiting by the gold table for the division (shabbat-showbread);
//   2. on — the kohanim in the avodah keep it: the tamid's crew at the slaughter, the change of the showbread itself,
//      the bazichin, the kohanim of the individuals' offerings at mid-morning.
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/avnet.js "t=d3"
const rt = ctx.schedule.runtime, time = ctx.time;
const res = { off: {}, on: {} };
let bad = 0;
const kohanim = (ids, pools) => {
  const out = [];
  for (const id of ids) {
    const e = rt.choreo(id);
    if (!e) continue;
    for (const p of e.pools) {
      if (p.spec.role !== 'kohen' || (pools && !pools.includes(p.name))) continue;
      for (const s of p.slots) if (s.want && s.actor) out.push({ k: `${id}/${p.name}#${s.index}`, avnet: s.actor.avnet });
    }
  }
  return out;
};
const at = async (date, t) => { if (time.dateString !== date) { time.setDate(date); await frames(3); } time.set(((t % 1440) + 1440) % 1440); await frames(3); };
const check = (bucket, key, list, want) => {
  const wrong = list.filter((x) => x.avnet !== want).map((x) => x.k);
  bad += wrong.length + (list.length ? 0 : 1);
  res[bucket][key] = list.length ? `${list.length - wrong.length}/${list.length}${wrong.length ? ` wrong: ${wrong.slice(0, 4).join(' ')}` : ''}` : 'none shown';
};
const mid = (id, f) => { const e = ctx.schedule.byId(id); return e ? e.t0 + ((e.t1 - e.t0 + 1440) % 1440) * f : NaN; };

for (const [date, id, f, ids, pools] of [
  ['2026-11-02', 'kodashim-meal', 0.5, ['courts-daily'], ['meal', 'cook']],
  ['2026-11-02', 'kodashim-meal-night', 0.25, ['courts-daily'], ['meal', 'cook']],
  ['2026-11-02', 'scouring', 0.5, ['courts-daily'], ['meal']],
  ['2026-11-07', 'showbread-divided', 0.4, ['shabbat-mishmar'], null],
  ['2026-11-07', 'showbread-eaten', 0.3, ['shabbat-mishmar'], null],
]) {
  await at(date, 0);
  await at(date, mid(id, f));
  check('off', `${id} ${time.format(time.t)}`, kohanim(ids, pools), false);
}
// the swap: the four of the outgoing wait by the gold table without it; at the change all eight wear it
{
  await at('2026-11-07', mid('showbread-swap', 0.5));
  const B = rt.choreo('shabbat-showbread')?.state?.plan;
  if (B) {
    await at('2026-11-07', B.t.lift + 0.8);
    check('on', `the change ${time.format(time.t)}`, kohanim(['shabbat-showbread']), true);
    await at('2026-11-07', (B.t.oldOnGoldEnd + B.div[0]) / 2);
    check('off', `waiting by the gold table ${time.format(time.t)}`, kohanim(['shabbat-showbread'], ['outgoing']), false);
    await at('2026-11-07', B.t.pour[0]);
    check('on', `the bazichin ${time.format(time.t)}`, kohanim(['shabbat-showbread'], ['incoming']).filter((x) => /#(2|3)$/.test(x.k)), true);
  } else { bad++; res.off.swap = 'no shabbat-showbread plan'; }
}
await at('2026-11-02', mid('tamid-slaughter', 0.5));
check('on', `tamid-slaughter ${time.format(time.t)}`, kohanim(['tamid-morning']), true);
await at('2026-11-02', time.parse('d4'));
check('on', `private offerings ${time.format(time.t)}`, kohanim(['private-offerings']), true);
res.ok = bad === 0;
return res;
