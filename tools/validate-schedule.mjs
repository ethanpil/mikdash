// Validator for src/data/schedule.js against site.js and the zmanim (run: node tools/validate-schedule.mjs)
import { EVENTS, DAY_TYPES, eventsFor } from '../src/data/schedule.js';
import { SITE, zoneAtSite } from '../src/data/site.js';
import { computeZmanim } from '../src/time/zmanim.js';
import { OFFERING_TYPES, OFFERING_RULES, STATIONS } from '../src/data/offerings.js';

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
const wrap = (t) => ((t % 1440) + 1440) % 1440;
const hm = (t) => `${String(Math.floor(wrap(Math.round(t)) / 60)).padStart(2, '0')}:${String(wrap(Math.round(t)) % 60).padStart(2, '0')}`;

// ---------------------------------------------------------------- tiny resolver mirroring ARCHITECTURE §6 (GRA)
function makeZ({ alot, sunrise, sunset, tzeit }) {
  const shaahDay = (sunset - sunrise) / 12, shaahNight = (1440 - (sunset - sunrise)) / 12;
  const chatzot = (sunrise + sunset) / 2;
  return { alot, sunrise, sunset, tzeit, chatzot, midnight: wrap(chatzot + 720), shaahDay, shaahNight };
}
function resolver(z) {
  return (spec) => {
    if (!spec || typeof spec !== 'object') return NaN;
    if (spec.at !== undefined) {
      if (!['alot', 'sunrise', 'chatzot', 'sunset', 'tzeit', 'midnight'].includes(spec.at)) return NaN;
      return wrap(z[spec.at] + (+spec.offset || 0));
    }
    if (spec.dayHour !== undefined) return wrap(z.sunrise + spec.dayHour * z.shaahDay);
    if (spec.nightHour !== undefined) return wrap(z.sunset + spec.nightHour * z.shaahNight);
    if (spec.clock !== undefined) { const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(spec.clock)); return m ? wrap(+m[1] * 60 + +m[2] + (+m[3] || 0) / 60) : NaN; }
    return NaN;
  };
}
const DEFAULT = makeZ({ alot: 4 * 60 + 42, sunrise: 5 * 60 + 56, sunset: 16 * 60 + 49, tzeit: 17 * 60 + 26 });
const DATES = ['2026-11-02', '2026-03-20', '2026-06-21', '2026-09-22', '2026-12-21', '2027-01-15', '2026-05-10'];
const zFor = (ds) => { const [y, m, d] = ds.split('-').map(Number); return makeZ(computeZmanim({ y, m, d })); };

// ---------------------------------------------------------------- contract
const ROLES = new Set('kohen kohen_gadol kohen_gadol_white segan levi levi_boy israelite woman elder sanhedrin guard_levi nazir child'.split(' '));
const CUES = new Set('trumpet-tekiah trumpet-teruah gate-boom great-gate-open magrefah muchni knock barkai gevini shalom-call cymbal choir-psalm kinnor nevel chalil bells grinder-chant sheep doves crowd-prostrate footsteps keys'.split(' '));
const CONF = new Set(['explicit', 'ordering', 'reconstruction']);
const LAYERS = new Set(['halachic', 'ritual', 'aggadah']);
const DT = new Set([...DAY_TYPES, 'occasional']);
const ids = new Set();
const point = (spec) => {
  if (Array.isArray(spec)) return spec.length >= 2 && spec.every(Number.isFinite) ? [spec[0], spec[1], spec[2]] : null;
  if (spec && spec.el) {
    const e = SITE.elements[spec.el]; if (!e || !e.box) return null;
    const f = spec.f || [0.5, 0.5, 1];
    return [0, 1, 2].map((i) => e.box.min[i] + (e.box.max[i] - e.box.min[i]) * (f[i] ?? 0.5));
  }
  return null;
};
for (const e of EVENTS) {
  const tag = e.id || '(no id)';
  if (!e.id || ids.has(e.id)) err(`${tag}: missing or duplicate id`); ids.add(e.id);
  if (!e.title?.en || !e.title?.he) err(`${tag}: title en/he`);
  if (!Array.isArray(e.dayTypes) || !e.dayTypes.length || !e.dayTypes.every((d) => DT.has(d))) err(`${tag}: dayTypes ${e.dayTypes}`);
  for (const k of ['start', 'end']) if (!Number.isFinite(resolver(DEFAULT)(e.when?.[k]))) err(`${tag}: when.${k} does not resolve`);
  if (!CONF.has(e.timing?.confidence) || typeof e.timing?.note !== 'string' || !e.timing.note) err(`${tag}: timing`);
  if (!SITE.zones[e.zone]) err(`${tag}: zone ${e.zone} not in site.js`);
  if (!point(e.pos)) err(`${tag}: pos does not resolve`);
  if (!point(e.view?.at) || !Number.isFinite(e.view?.heading) || e.view.heading < 0 || e.view.heading >= 360) err(`${tag}: view`);
  if (typeof e.summary !== 'string' || e.summary.length < 20) err(`${tag}: summary`);
  if (typeof e.description !== 'string' || e.description.length < 80) err(`${tag}: description`);
  const paras = e.description.split('\n\n').length; if (paras > 3) err(`${tag}: ${paras} paragraphs`);
  if (!Array.isArray(e.participants) || !e.participants.every((p) => ROLES.has(p.role) && Number.isInteger(p.count) && p.count > 0)) err(`${tag}: participants`);
  if (!Array.isArray(e.sources) || !e.sources.length || !e.sources.every((s) => typeof s === 'string' && s)) err(`${tag}: sources`);
  if (!Array.isArray(e.sounds) || !e.sounds.every((s) => CUES.has(s))) err(`${tag}: sounds ${e.sounds}`);
  if (typeof e.choreo !== 'string' || !/^[a-z-]+$/.test(e.choreo)) err(`${tag}: choreo`);
  if (![1, 2, 3].includes(e.importance)) err(`${tag}: importance`);
  if (!LAYERS.has(e.layer)) err(`${tag}: layer`);
  if (e.offerings !== undefined && !(Array.isArray(e.offerings) && e.offerings.length && e.offerings.every((o) => OFFERING_TYPES[o]))) err(`${tag}: offerings ${e.offerings} (ids of OFFERING_TYPES in src/data/offerings.js)`);
  const extra = Object.keys(e).filter((k) => !['id', 'title', 'dayTypes', 'when', 'timing', 'zone', 'pos', 'view', 'summary', 'description', 'participants', 'sources', 'sounds', 'choreo', 'importance', 'layer', 'offerings'].includes(k));
  if (extra.length) err(`${tag}: unexpected keys ${extra}`);
}

// ---------------------------------------------------------------- durations on every date (wrap past midnight allowed)
const times = (z) => { const r = resolver(z); const m = {}; for (const e of EVENTS) m[e.id] = { t0: r(e.when.start), t1: r(e.when.end) }; return m; };
for (const ds of DATES) {
  const T = times(zFor(ds));
  for (const e of EVENTS) {
    const { t0, t1 } = T[e.id], dur = wrap(t1 - t0);
    if (!(dur > 0 && dur <= 15 * 60)) err(`${ds} ${e.id}: duration ${dur.toFixed(1)} min (${hm(t0)}→${hm(t1)})`);
  }
}

// ---------------------------------------------------------------- ordering (sources' sequence) on every date
// [a, b]: a ends no later than b starts (minutes measured forward from a's start, so night chains work)
const SEQ = [
  ['moked-night', 'memuneh-knock'], ['dawn-immersion', 'memuneh-knock'], ['gevini', 'memuneh-knock'], ['memuneh-knock', 'first-lottery'],
  ['first-lottery', 'torch-inspection'], ['first-lottery', 'lamp-inspection-shabbat'], ['torch-inspection', 'muchni'],
  ['torch-inspection', 'chavitin-bakers'], ['muchni', 'terumat-hadeshen'], ['terumat-hadeshen', 'clearing-altar'], ['fats-burning', 'clearing-altar'],
  ['clearing-altar', 'tapuach'], ['tapuach', 'great-pile'], ['great-pile', 'second-pile'], ['second-pile', 'second-lottery'],
  ['second-lottery', 'barkai'], ['barkai', 'lamb-brought'], ['barkai', 'vessels'], ['lamb-brought', 'lamb-watered'], ['vessels', 'lamb-watered'],
  ['vessels', 'dishun-men'], ['lamb-watered', 'tamid-slaughter'], ['dishun-men', 'great-gate'], ['gates-blasts', 'great-gate'],
  ['great-gate', 'tamid-slaughter'], ['great-gate', 'inner-clearing'], ['inner-clearing', 'tamid-blood'], ['tamid-slaughter', 'tamid-blood'],
  ['tamid-blood', 'flaying'], ['flaying', 'limbs-to-ramp'], ['limbs-to-ramp', 'gazit-shema'], ['gazit-shema', 'third-fourth-lottery'],
  ['third-fourth-lottery', 'coal-pan'], ['coal-pan', 'magrefah'], ['magrefah', 'into-heichal'], ['into-heichal', 'ketoret-morning'],
  ['ketoret-morning', 'birkat-kohanim'], ['birkat-kohanim', 'limbs-up'], ['limbs-up', 'libation'], ['chavitin-bakers', 'libation'],
  ['libation', 'song-weekday'], ['libation', 'song-friday'], ['libation', 'song-shabbat'],
  ['song-shabbat', 'shabbat-musaf'], ['shabbat-musaf', 'showbread-swap'], ['showbread-swap', 'bazichin'], ['bazichin', 'showbread-divided'],
  // Shabbat between the services: the bread is not eaten before the frankincense burns (Rambam TuM 4:10); the Kohen
  // Gadol's loaves are shown until the incoming watch gathers for the lottery (staging); the altar's tending is shown
  // after the bazichin and before the afternoon crew takes the altar
  ['bazichin', 'showbread-eaten'], ['showbread-divided', 'showbread-eaten'], ['showbread-eaten', 'afternoon-lottery-shabbat'],
  ['bazichin', 'shabbat-altar-day'], ['shabbat-altar-day', 'tamid-afternoon'],
  ['song-weekday', 'sanhedrin'], ['song-weekday', 'private-offerings'], ['showbread-divided', 'afternoon-lottery-shabbat'],
  ['sanhedrin', 'tamid-afternoon'], ['private-offerings', 'tamid-afternoon'], ['kayitz-hamizbeach', 'tamid-afternoon'], ['court-in-chel', 'tamid-afternoon'],
  ['afternoon-lottery', 'tamid-afternoon'], ['afternoon-lottery-shabbat', 'tamid-afternoon'], ['tamid-afternoon', 'afternoon-flaying'],
  ['afternoon-flaying', 'ketoret-afternoon'], ['ketoret-afternoon', 'menorah-lighting'], ['menorah-lighting', 'afternoon-limbs'],
  ['afternoon-limbs', 'afternoon-song'], ['afternoon-limbs', 'afternoon-song-shabbat'], ['afternoon-song', 'friday-blasts-work'],
  ['friday-blasts-work', 'friday-blasts-holy'], ['friday-blasts-holy', 'locking-up'], ['afternoon-song', 'locking-up'],
  ['afternoon-song', 'seals'], ['seals', 'friday-blasts-work'], ['seals', 'locking-up'], ['song-weekday', 'kodashim-meal'], ['kodashim-meal', 'tamid-afternoon'],
  ['locking-up', 'moked-night'],
  // individuals' offerings (src/data/offerings.js): after the morning song, before the afternoon tamid; the evening after it
  ...['private-flaying', 'altar-blood', 'altar-limbs', 'bird-offerings', 'meal-offerings', 'tenufah', 'nikanor-purifications', 'notar-burning']
    .flatMap((id) => [['song-weekday', id], ['song-friday', id], [id, 'tamid-afternoon']]),
  ['afternoon-song', 'evening-altar'], ['afternoon-song', 'friday-last-fats'], ['afternoon-song', 'kodashim-meal-night'],
  ['afternoon-song-shabbat', 'shabbat-evening-altar'], ['evening-altar', 'late-turning'], ['shabbat-evening-altar', 'late-turning'],
  ['night-turning', 'clearing-altar'], ['scouring', 'late-turning'],
];
// [a, b]: a starts no later than b starts (within 12 h)
const SEQ_START = [['locking-up', 'night-watch'], ['night-watch', 'ish-har-habayit'], ['fats-burning', 'locking-up'], ['maamad-morning', 'tamid-slaughter'], ['gate-levites', 'tamid-slaughter']];
const byId = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
for (const [a, b] of SEQ) if (!byId[a] || !byId[b]) err(`SEQ names unknown event ${a} / ${b}`);
// events wholly inside another's window
const INSIDE = [['scouring', 'kodashim-meal-night'], ['late-turning', 'fats-burning'], ['night-turning', 'fats-burning'], ['sleeping-guard', 'ish-har-habayit'], ['mesibah-keri', 'moked-night'], ['magrefah', 'maamad-morning'], ['tamid-slaughter', 'maamad-morning'],
  ['impure-east-gate', 'maamad-morning'], ['tamid-afternoon', 'maamad-afternoon'], ['afternoon-song', 'maamad-afternoon']];
for (const ds of DATES) {
  const T = times(zFor(ds));
  for (const [a, b] of SEQ) {
    if (!byId[a] || !byId[b]) continue;
    const A = T[a], B = T[b];
    // a ends ≤ b starts, measured forward from a.start (≤ 20 h ahead)
    const aEnd = wrap(A.t1 - A.t0), bStart = wrap(B.t0 - A.t0);
    if (!(aEnd <= bStart + 1e-6 && bStart < 20 * 60)) err(`${ds}: ${a} (${hm(A.t0)}–${hm(A.t1)}) should end before ${b} starts (${hm(B.t0)})`);
  }
  for (const [a, b] of SEQ_START) { const A = T[a], B = T[b]; if (wrap(B.t0 - A.t0) > 12 * 60) err(`${ds}: ${a} (${hm(A.t0)}) should start before ${b} (${hm(B.t0)})`); }
  for (const [a, b] of INSIDE) {
    const A = T[a], B = T[b];
    const s = wrap(A.t0 - B.t0), e2 = wrap(A.t1 - B.t0), len = wrap(B.t1 - B.t0);
    if (!(s <= len && e2 <= len && s <= e2)) err(`${ds}: ${a} (${hm(A.t0)}–${hm(A.t1)}) not inside ${b} (${hm(B.t0)}–${hm(B.t1)})`);
  }
}

// ---------------------------------------------------------------- crews: one group of people cannot be in two places at once
// (allowed when the two events share a zone or a choreography module, i.e. one staging)
const CREW = {
  memuneh: ['memuneh-knock', 'first-lottery', 'torch-inspection', 'lamp-inspection-shabbat', 'second-lottery', 'gazit-shema', 'third-fourth-lottery', 'ketoret-morning'],
  'first-winner': ['dawn-immersion', 'first-lottery', 'terumat-hadeshen', 'clearing-altar', 'tapuach', 'great-pile', 'second-pile', 'second-lottery'],
  'altar-company': ['torch-inspection', 'lamp-inspection-shabbat', 'clearing-altar', 'tapuach', 'great-pile', 'second-pile', 'second-lottery'],
  'chavitin-bakers': ['chavitin-bakers'],
  slaughterer: ['lamb-watered', 'tamid-slaughter', 'gazit-shema', 'third-fourth-lottery', 'birkat-kohanim'],
  thrower: ['tamid-slaughter', 'tamid-blood', 'gazit-shema', 'third-fourth-lottery', 'birkat-kohanim'],
  'dishun-men': ['second-lottery', 'dishun-men', 'great-gate', 'inner-clearing', 'gazit-shema', 'third-fourth-lottery', 'into-heichal', 'ketoret-morning', 'birkat-kohanim'],
  nine: ['second-lottery', 'lamb-watered', 'tamid-slaughter', 'flaying', 'limbs-to-ramp', 'gazit-shema', 'third-fourth-lottery', 'birkat-kohanim', 'limbs-up'],
  'incense-man': ['third-fourth-lottery', 'coal-pan', 'ketoret-morning', 'birkat-kohanim'],
  'pan-man': ['coal-pan', 'into-heichal', 'birkat-kohanim'],
  trumpeters: ['gates-blasts', 'libation', 'song-weekday', 'song-friday', 'song-shabbat', 'shabbat-musaf', 'afternoon-song', 'afternoon-song-shabbat', 'friday-blasts-work', 'friday-blasts-holy'],
  segan: ['limbs-up', 'libation', 'afternoon-song', 'afternoon-song-shabbat'],
  'kohen-gadol': ['ketoret-morning', 'birkat-kohanim', 'limbs-up', 'showbread-eaten'],
  choir: ['song-weekday', 'song-friday', 'song-shabbat', 'shabbat-musaf', 'afternoon-song', 'afternoon-song-shabbat'],
  maamad: ['maamad-morning', 'maamad-afternoon'],
  sanhedrin: ['sanhedrin', 'court-in-chel'],
  'ish-har-habayit': ['ish-har-habayit', 'sleeping-guard'],
  'locking-kohen': ['locking-up', 'moked-night'],
  'moked-sleepers': ['moked-night', 'memuneh-knock'],
  'outgoing-mishmar': ['shabbat-musaf', 'showbread-swap', 'showbread-divided'],
  'incoming-mishmar': ['bazichin', 'showbread-divided', 'afternoon-lottery-shabbat', 'tamid-afternoon', 'afternoon-flaying', 'afternoon-limbs', 'afternoon-song-shabbat'],
  'seal-officers': ['seals'],
  'afternoon-crew': ['afternoon-lottery', 'tamid-afternoon', 'afternoon-flaying', 'afternoon-limbs', 'afternoon-song'],
  'afternoon-incense': ['afternoon-lottery', 'ketoret-afternoon'],
  'menorah-man': ['into-heichal', 'menorah-lighting'],
};
for (const [crew, list] of Object.entries(CREW)) for (const id of list) if (!byId[id]) err(`CREW ${crew}: unknown ${id}`);
for (const ds of DATES) {
  const T = times(zFor(ds));
  for (const dt of DAY_TYPES) {
    const on = new Set(eventsFor(dt).map((e) => e.id));
    for (const [crew, list] of Object.entries(CREW)) {
      const L = list.filter((id) => on.has(id));
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const A = byId[L[i]], B = byId[L[j]], a = T[A.id], b = T[B.id];
        const la = wrap(a.t1 - a.t0), lb = wrap(b.t1 - b.t0), d = wrap(b.t0 - a.t0);
        const overlap = d < la || wrap(a.t0 - b.t0) < lb;
        if (overlap && A.zone !== B.zone && A.choreo !== B.choreo) err(`${ds} ${dt} crew ${crew}: ${A.id} (${A.zone} ${hm(a.t0)}–${hm(a.t1)}) overlaps ${B.id} (${B.zone} ${hm(b.t0)}–${hm(b.t1)})`);
      }
    }
  }
}

// ---------------------------------------------------------------- places: zones of pos and view, walkable views
const E = SITE.elements;
function solidBoxes(e) {
  const p = e.params || {};
  const bx = (x0, y0, z0, x1, y1, z1) => ({ min: [x0, y0, z0], max: [x1, y1, z1] });
  if (p.groundPiece) return [p.groundPiece, ...(p.flying || []).map((f) => bx(e.box.min[0], f.y[0], f.undersideZ, e.box.max[0], f.y[1], Math.max(...f.topZ)))];
  if (Array.isArray(p.pieces)) return p.pieces;
  if (Array.isArray(p.segments)) return p.segments.map((s) => (s.min ? s : s.box)).filter((b) => b && b.min);
  if (Array.isArray(p.cells)) return p.cells.map((c) => c.box);
  if (Array.isArray(p.pillars)) { const h = (p.section ?? 1) / 2; return p.pillars.map(([x, y, z]) => bx(x - h, y - h, z, x + h, y + h, z + (p.shaftH ?? 0) + 1)); }
  if (Array.isArray(p.tables)) return p.tables;
  return e.box ? [e.box] : [];
}
const inBox = (q, b, eps = 0) => q[0] > b.min[0] + eps && q[0] < b.max[0] - eps && q[1] > b.min[1] + eps && q[1] < b.max[1] - eps && q[2] > b.min[2] && q[2] < b.max[2];
const SKIP_EL = new Set(['mount.soreg', 'mount.soreg.breaches', 'azarah.amah-channel', 'altar.rings', 'altar.chut-hasikra', 'altar.shitin', 'altar.libation-cups', 'mount.watch-posts',
  'azarah.stations', 'azarah.achsadra-route', 'heichal.even-shetiyah', 'heichal.lul-west', 'altar.maarachah-area', 'altar.walkway', 'heichal.ulam.chains', 'heichal.ulam.vine', 'heichal.ulam.nivreshet']);
function hits(q) {
  // body column: feet + 0.3 … head (≈ +3.3 amot) — any solid element (walls minus their openings/voids/cutouts, fixtures, slabs)
  const out = [];
  for (const e of Object.values(E)) {
    if (!e.box || SKIP_EL.has(e.id) || e.id.startsWith('context.') || ['zone', 'floor', 'opening', 'gate', 'curtain', 'stair', 'ramp', 'chamber'].includes(e.kind)) continue;
    const holes = ['openings', 'voids', 'replacedBy', 'alsoPierces'].flatMap((k) => [].concat(e.params?.[k] ?? [])).map((id) => E[id]?.box).filter(Boolean)
      .concat((e.params?.cutouts || []).map((c) => c.box));
    for (const b of solidBoxes(e)) for (const dz of [0.3, 1.5, 3.2]) {
      const p = [q[0], q[1], q[2] + dz];
      if (inBox(p, b, 0.01) && !holes.some((h) => inBox(p, { min: h.min, max: h.max }, -0.01))) { out.push(e.id); break; }
    }
  }
  return [...new Set(out)];
}
const chambersAt = (q) => Object.values(E).filter((e) => e.kind === 'chamber' && e.box && inBox([q[0], q[1], q[2] + 1], e.box)).map((e) => e.id);
function expectedFloor(X, Y, zone) {
  if (zone === 'kevesh') return 16 + Math.max(0, Math.min(32, Y - 275.5)) * 9 / 32;
  return SITE.zones[zone]?.floorZ;
}
const viewRows = [];
for (const e of EVENTS) {
  const p = point(e.pos), v = point(e.view.at);
  const pz = zoneAtSite(p[0], p[1], p[2] + 0.5);
  if (pz !== e.zone) warn(`${e.id}: pos zone is ${pz}, event zone ${e.zone}`);
  if (!Number.isFinite(v[2])) { err(`${e.id}: view has no Z`); continue; }
  const vz = zoneAtSite(v[0], v[1], v[2] + 0.5);
  if (!vz || vz === 'outside') err(`${e.id}: view in zone ${vz}`);
  const fz = expectedFloor(v[0], v[1], vz);
  if (!Number.isFinite(fz) || Math.abs(fz - v[2]) > 0.6) err(`${e.id}: view Z ${v[2]} vs floor ${fz} of zone ${vz}`);
  const h = hits(v); if (h.length) err(`${e.id}: view inside solid ${h}`);
  // the soreg as built: its thin zone strips (the element box is only the envelope of its path)
  for (const [mn, mx] of SITE.zones.soreg.boxes) if (inBox([v[0], v[1], v[2] + 0.3], { min: mn, max: mx })) err(`${e.id}: view inside the soreg`);
  const ROOMS = { 'beit-hamoked': 'azarah.moked.hall', gazit: 'azarah.chamber.gazit', 'beit-avtinas': 'azarah.beit-avtinas',
    'beit-hatevilah': 'azarah.underground.beit-hatevilah', 'en-chamber-wood': 'en.chamber.wood', 'en-chamber-nazirites': 'en.chamber.nazirites' };
  const ch = chambersAt(v).filter((c) => c !== ROOMS[vz]); if (ch.length) warn(`${e.id}: view inside chamber ${ch}`);
  const dist = Math.hypot(p[0] - v[0], p[1] - v[1]);
  viewRows.push(`${e.id.padEnd(26)} pos ${pz.padEnd(22)} view ${String(vz).padEnd(22)} d=${dist.toFixed(1)}`);
}

// ---------------------------------------------------------------- offering stations (src/data/offerings.js)
for (const [id, st] of Object.entries(STATIONS)) {
  if (!SITE.zones[st.zone]) err(`station ${id}: zone ${st.zone} not in site.js`);
  if (st.el && !SITE.elements[st.el]) err(`station ${id}: element ${st.el} not in site.js`);
  const p = st.at || (st.el && st.f ? point({ el: st.el, f: st.f }) : null);
  if (p && st.zone !== 'outside') { const zz = zoneAtSite(p[0], p[1], p[2] + 0.5); if (zz !== st.zone) warn(`station ${id}: point in zone ${zz}, stated ${st.zone}`); }
}
for (const t of Object.values(OFFERING_TYPES)) for (const s of t.steps || []) for (const a of [].concat(s.at || [])) if (!STATIONS[a]) err(`offering ${t.id} step ${s.id}: unknown station ${a}`);
// frequency: the sets' yields name real types, and each component's remainder after the sets is ≥ 0 with lo ≤ hi
{
  const F = OFFERING_RULES.frequency;
  for (const s of F.sets) {
    const y = OFFERING_TYPES[s]?.frequency?.yields;
    if (!y) { err(`frequency: set ${s} has no frequency.yields`); continue; }
    for (const c of Object.keys(y)) if (!OFFERING_TYPES[c]?.frequency || F.sets.includes(c)) err(`frequency: set ${s} yields unknown or composite type ${c}`);
  }
  for (const [id, [lo, hi]] of Object.entries(F.alone)) if (!(lo >= 0 && hi >= lo)) err(`frequency: ${id} alone [${lo}, ${hi}] — the sets bring more than the type's total`);
}

// ---------------------------------------------------------------- report
const T0 = times(DEFAULT);
console.log(`EVENTS ${EVENTS.length}; weekday ${eventsFor('weekday').length}, friday ${eventsFor('friday').length}, shabbat ${eventsFor('shabbat').length}, occasional ${eventsFor('occasional').length}`);
console.log(`choreo ids (${new Set(EVENTS.map((e) => e.choreo)).size}): ${[...new Set(EVENTS.map((e) => e.choreo))].join(', ')}`);
console.log('\n-- default date 2026-11-02 (alot 04:42, sunrise 05:56, sunset 16:49, tzeit 17:26):');
for (const e of [...EVENTS].sort((a, b) => wrap(T0[a.id].t0 - 12 * 60) - wrap(T0[b.id].t0 - 12 * 60)))
  console.log(`${hm(T0[e.id].t0)}–${hm(T0[e.id].t1)}  ${e.id.padEnd(26)} [${e.dayTypes.join(',')}] ${e.timing.confidence}`);
if (process.argv.includes('--views')) console.log('\n' + viewRows.join('\n'));
console.log(`\nwarnings (${warns.length}):\n  ${warns.join('\n  ')}`);
console.log(`errors (${errors.length}):\n  ${errors.join('\n  ')}`);
process.exitCode = errors.length ? 1 : 0;
