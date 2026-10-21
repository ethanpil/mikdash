// 24-hour coverage check for src/data/schedule.js (run: node tools/coverage.mjs [--max 10] [--verbose])
//
// Walks every minute of the cycle for each day type ('weekday' | 'friday' | 'shabbat') on several dates of the year and
// lists the minutes in which NO watchable activity is going on in the courts or on the Mount. An event counts as
// ACTIVE when people are doing something an observer can watch; static guards, sleepers, a standing delegation and
// a figure who appears only now and then count as LOW, and a scene with no participants (the fire alone) counts as
// NONE. Exit code 1 when any gap of
// ACTIVE coverage is longer than --max minutes (default 10), including gaps that run across civil midnight between
// consecutive day types of a real week, and when the Azarah itself has no ACTIVE event for longer than that between
// sunrise and sunset.
import { EVENTS, eventsFor, DAY_TYPES } from '../src/data/schedule.js';
import { computeZmanim } from '../src/time/zmanim.js';

const args = process.argv.slice(2);
const MAX = Number(args[args.indexOf('--max') + 1]) || 10;
const VERBOSE = args.includes('--verbose');

const wrap = (t) => ((t % 1440) + 1440) % 1440;
const hm = (t) => `${String(Math.floor(wrap(Math.round(t)) / 60)).padStart(2, '0')}:${String(wrap(Math.round(t)) % 60).padStart(2, '0')}`;

// ---------------------------------------------------------------- activity level of each event
// Default: participants with a total count > 0 → ACTIVE. Exceptions below (keep this list in step with schedule.js).
const LOW = new Set([
  'night-watch',          // guards standing at their posts
  'watch-upper-chambers', // young kohanim keeping watch in two upper rooms
  'moked-night',          // the beit av asleep in Beit HaMoked
  'gate-levites',         // gatekeepers standing at the gates by day
  'maamad-morning',       // the ma'amad standing (the tamid itself is staged by its own events)
  'maamad-afternoon',
  // intermittent: the window is long but a figure shows only now and then, so it cannot carry a stretch by itself
  'late-turning',         // one kohen turning the limbs after midnight now and then
  'night-turning',
  'shabbat-altar-day',    // one or two kohanim now and then at the great pile on Shabbat by day
]);
const level = (e) => {
  if (LOW.has(e.id)) return 'low';
  const n = (e.participants || []).reduce((s, p) => s + (p.count || 0), 0);
  return n > 0 ? 'active' : 'none';
};

// ---------------------------------------------------------------- resolver (ARCHITECTURE §6, GRA hours)
function makeZ({ alot, sunrise, sunset, tzeit }) {
  const shaahDay = (sunset - sunrise) / 12, shaahNight = (1440 - (sunset - sunrise)) / 12;
  const chatzot = (sunrise + sunset) / 2;
  return { alot, sunrise, sunset, tzeit, chatzot, midnight: wrap(sunset + 6 * shaahNight), shaahDay, shaahNight };
}
const resolver = (z) => (spec) => {
  if (!spec || typeof spec !== 'object') return NaN;
  if (spec.at !== undefined) return z[spec.at] === undefined ? NaN : wrap(z[spec.at] + (+spec.offset || 0));
  if (spec.dayHour !== undefined) return wrap(z.sunrise + spec.dayHour * z.shaahDay);
  if (spec.nightHour !== undefined) return wrap(z.sunset + spec.nightHour * z.shaahNight);
  if (spec.clock !== undefined) { const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(spec.clock)); return m ? wrap(+m[1] * 60 + +m[2] + (+m[3] || 0) / 60) : NaN; }
  return NaN;
};
const DATES = ['2026-11-02', '2026-03-20', '2026-06-21', '2026-09-22', '2026-12-21', '2027-01-15', '2026-05-10'];
const zFor = (ds) => { const [y, m, d] = ds.split('-').map(Number); return makeZ(computeZmanim({ y, m, d })); };

// ---------------------------------------------------------------- per-minute coverage of one day type on one date
function coverage(dayType, z) {
  const r = resolver(z);
  const evs = eventsFor(dayType).map((e) => ({ e, lvl: level(e), t0: r(e.when.start), t1: r(e.when.end) }));
  const on = (x, t) => { const len = wrap(x.t1 - x.t0); return wrap(t - x.t0) < len; };
  const minutes = [];
  for (let t = 0; t < 1440; t++) {
    const act = evs.filter((x) => on(x, t + 0.5));
    minutes.push({
      active: act.filter((x) => x.lvl === 'active').map((x) => x.e.id),
      low: act.filter((x) => x.lvl === 'low').map((x) => x.e.id),
    });
  }
  return minutes;
}
// runs of minutes without an ACTIVE event (cyclic within one day type)
function gaps(minutes, cyclic = true) {
  const out = [];
  let start = -1;
  for (let t = 0; t < minutes.length; t++) {
    const empty = !minutes[t].active.length;
    if (empty && start < 0) start = t;
    if (!empty && start >= 0) { out.push([start, t]); start = -1; }
  }
  if (start >= 0) out.push([start, minutes.length]);
  if (cyclic && out.length > 1 && out[0][0] === 0 && out[out.length - 1][1] === minutes.length) {
    const last = out.pop(); out[0] = [last[0] - minutes.length, out[0][1]];
  }
  return out.map(([a, b]) => ({ from: a, to: b, len: b - a, low: [...new Set(minutes.slice(Math.max(0, a), b).flatMap((m) => m.low))] }));
}

// ---------------------------------------------------------------- report
let worst = 0, fails = 0;
const rows = [];
for (const ds of DATES) {
  const z = zFor(ds);
  const cov = Object.fromEntries(DAY_TYPES.map((dt) => [dt, coverage(dt, z)]));
  for (const dt of DAY_TYPES) {
    for (const g of gaps(cov[dt])) {
      worst = Math.max(worst, g.len);
      const bad = g.len > MAX; if (bad) fails++;
      if (bad || VERBOSE) rows.push(`${bad ? 'GAP ' : 'gap '} ${ds} ${dt.padEnd(8)} ${hm(g.from)}–${hm(g.to)} (${String(g.len).padStart(3)} min)  low: ${g.low.join(', ') || '—'}`);
    }
  }
  // the real week across civil midnight: weekday→weekday, weekday(Thu)→friday, friday→shabbat, shabbat→weekday(Sun)
  for (const [a, b] of [['weekday', 'weekday'], ['weekday', 'friday'], ['friday', 'shabbat'], ['shabbat', 'weekday']]) {
    const seq = [...cov[a], ...cov[b]];
    for (const g of gaps(seq, false)) {
      if (!(g.from < 1440 && g.to > 1440)) continue; // only runs that cross midnight
      worst = Math.max(worst, g.len);
      const bad = g.len > MAX; if (bad) fails++;
      if (bad || VERBOSE) rows.push(`${bad ? 'GAP ' : 'gap '} ${ds} ${a}→${b} ${hm(g.from)}–${hm(g.to)} (${String(g.len).padStart(3)} min) across midnight  low: ${g.low.join(', ') || '—'}`);
    }
  }
}

// ---------------------------------------------------------------- the court by day
// Activity on the Mount or in Ezrat Nashim fills the clock above, but the Azarah itself (its open court, the altar, the
// Ulam and the Heichal — not its chambers) must not stand empty while the gates are open: from sunrise to sunset on
// every day type some ACTIVE event must be in one of these zones (Shabbat between the services was such a gap).
// Lishkat HaGazit counts only by the events held in its holy half (the Shema and the lotteries, the Mishnah's own
// lull in the court); the Sanhedrin sits in its profane half, outside the Azarah, and must not fill the court's day.
const COURT = new Set(['azarah', 'ezrat-yisrael', 'ezrat-kohanim', 'mizbeach', 'kevesh', 'slaughter-zone', 'bein-haulam-lamizbeach', 'kiyor', 'ulam-steps', 'ulam', 'heichal']);
const GAZIT_HOLY = new Set(['second-lottery', 'gazit-shema', 'outgoing-blessing', 'third-fourth-lottery', 'afternoon-lottery', 'afternoon-lottery-shabbat']);
const inCourt = (e) => COURT.has(e.zone) || (e.zone === 'gazit' && GAZIT_HOLY.has(e.id));
for (const id of GAZIT_HOLY) if (!EVENTS.some((e) => e.id === id)) { console.log(`GAZIT_HOLY names unknown event ${id}`); fails++; }
for (const ds of DATES) {
  const z = zFor(ds);
  const r = resolver(z);
  for (const dt of DAY_TYPES) {
    const evs = eventsFor(dt).filter((e) => inCourt(e) && level(e) === 'active').map((e) => ({ t0: r(e.when.start), t1: r(e.when.end) }));
    const on = (x, t) => wrap(t - x.t0) < wrap(x.t1 - x.t0);
    const day = [];
    for (let t = Math.ceil(z.sunrise); t < Math.floor(z.sunset); t++) day.push({ active: evs.some((x) => on(x, t + 0.5)) ? ['court'] : [], low: [] });
    for (const g of gaps(day, false)) {
      worst = Math.max(worst, g.len);
      const bad = g.len > MAX; if (bad) fails++;
      const a = Math.ceil(z.sunrise) + g.from, b = Math.ceil(z.sunrise) + g.to;
      if (bad || VERBOSE) rows.push(`${bad ? 'GAP ' : 'gap '} ${ds} ${dt.padEnd(8)} ${hm(a)}–${hm(b)} (${String(g.len).padStart(3)} min) nobody at work in the Azarah by day`);
    }
  }
}

// minute-by-minute digest for the default date (2026-11-02) when verbose
if (VERBOSE) {
  const z = zFor('2026-11-02');
  for (const dt of DAY_TYPES) {
    const cov = coverage(dt, z);
    console.log(`\n-- ${dt}, 2026-11-02: active events by hour`);
    for (let h = 0; h < 24; h++) {
      const ids = new Set(cov.slice(h * 60, h * 60 + 60).flatMap((m) => m.active));
      console.log(`${String(h).padStart(2, '0')}:00  ${[...ids].join(', ') || '— none —'}`);
    }
  }
}
const counts = Object.fromEntries(['active', 'low', 'none'].map((k) => [k, EVENTS.filter((e) => level(e) === k).length]));
console.log(`\nevents: ${EVENTS.length} (active ${counts.active}, low ${counts.low}, none ${counts.none}); dates ${DATES.length}; max allowed gap ${MAX} min`);
console.log(rows.length ? rows.join('\n') : 'no gaps');
console.log(`longest gap without watchable activity: ${worst} min; gaps over ${MAX} min: ${fails}`);
process.exitCode = fails ? 1 : 0;
