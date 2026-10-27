#!/usr/bin/env node
// Search acceptance in node (docs/console-design.md §6.3.2): builds the documents from the data modules (the weekday's
// events as the schedule; A's UI documents from the fixture), then runs dev/queries.js: the first 40 must rank an
// expected document first, the rest in the top 3. Reports the build time and the query time (median, p95).
//   node src/search/dev/searchtest.mjs [--verbose] [--q "query"]
import { createEngine } from '../engine.js';
import { normHe, normLatin, skeleton } from '../normalize.js';
import { swapLayout } from '../layout.js';
import { placeDocs, thingDocs, riteDocs, offeringDocs, roleDocs, wordDocs } from '../sources.js';
import { TOP1, TOP3, CONTEXT, UI_DOCS } from './queries.js';
import { ZONE_CONTENT } from '../../data/zones-content.js';
import { SITE, zoneAtSite } from '../../data/site.js';
import { EVENTS, eventsFor } from '../../data/schedule.js';
import { OFFERING_TYPES } from '../../data/offerings.js';
import { GLOSSARY } from '../../data/glossary.js';
import { OBJECTS } from '../../data/objects.js';
import { ROLES_INFO } from '../../data/people-info.js';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const one = args.includes('--q') ? args[args.indexOf('--q') + 1] : null;
let fails = 0;
const check = (name, ok, info = '') => { if (!ok) fails++; if (!ok || verbose) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };

// ---- normalisation ----
check('niqqud and cantillation stripped', normHe('מִזְבֵּחַ') === 'מזבח' && normHe('בְּרֵאשִׁ֖ית') === 'בראשית');
check('final letters folded; maqaf a space; geresh removed', normHe('שער־המזרח') === 'שער המזרח' && normHe('ך׳') === 'כ');
check('transliteration folds', normLatin("Mizbe'ach") === normLatin('mizbeach') && normLatin('Nicanor') === normLatin('nikanor') && normLatin('tzitz') === normLatin('tsits'));
check('skeleton', skeleton(normLatin('kodashim')) === skeleton(normLatin('kodoshim')));
check('layout swap', swapLayout('nzcj') === 'מזבח' && swapLayout('שךאשר') === 'altar' && swapLayout('altar1') === null);

// ---- the documents ----
const events = eventsFor ? eventsFor('weekday') : EVENTS.filter((e) => !e.dayTypes || e.dayTypes.includes('weekday'));
const engine = createEngine({ amah: 0.48 });
engine.add({ kind: 'place', docs: () => placeDocs({ ZONE_CONTENT, SITE }) });
engine.add({ kind: 'thing', docs: () => thingDocs({ SITE, OBJECTS, ZONE_CONTENT, zoneAtSite }) });
engine.add({ kind: 'rite', docs: () => riteDocs({ events, EVENTS, SITE, ZONE_CONTENT, time: { t: 400 } }) });
engine.add({ kind: 'offering', docs: () => offeringDocs({ OFFERING_TYPES }) });
engine.add({ kind: 'role', docs: () => roleDocs({ ROLES_INFO, GLOSSARY }) });
engine.add({ kind: 'word', docs: () => wordDocs({ GLOSSARY }) });
engine.add({ kind: 'ui', docs: UI_DOCS });
const t0 = performance.now();
engine.build(Infinity);
const buildMs = performance.now() - t0;
const docs = engine.docs();
const byKind = {};
for (const d of docs) byKind[d.kind] = (byKind[d.kind] || 0) + 1;
console.log(`documents: ${docs.length} ${JSON.stringify(byKind)} · built in ${buildMs.toFixed(1)} ms`);
check('every document id is a subject ref', docs.every((d) => /^(zone|el|fire|event|offering|role|term|setting|cmd|learn|help):./.test(d.id)));

if (one) {
  for (const r of engine.query(one, { limit: 10 })) console.log(`${r.score.toFixed(3)} ${r.tier.padEnd(9)} ${r.field.padEnd(9)} ${r.doc.id} — ${r.doc.title.en} ${r.doc.title.he ?? ''}`);
  process.exit(0);
}

// ---- the queries ----
const times = [];
const run = (q) => {
  const a = performance.now();
  const r = engine.query(q, { limit: 40 });
  times.push(performance.now() - a);
  return r;
};
const want = (exp) => (exp == null ? null : [].concat(exp));
const show = (res) => res.slice(0, 5).map((r) => `${r.doc.id} ${r.score.toFixed(2)} ${r.tier}`).join(' | ');
let n1 = 0, n3 = 0;
for (const [q, exp] of TOP1) {
  const res = run(q);
  const ok = res.length > 0 && want(exp).includes(res[0].doc.id);
  if (ok) n1++;
  check(`top1 ${JSON.stringify(q)}`, ok, show(res));
}
for (const [q, exp] of TOP3) {
  const res = run(q);
  const w = want(exp);
  const ok = w ? res.slice(0, 3).some((r) => w.includes(r.doc.id)) : res.length > 0;
  if (ok) n3++;
  check(`top3 ${JSON.stringify(q)}`, ok, show(res));
}
// ---- in context: standing at Sha'ar Nikanor while every rite of the day is in progress (the most the boosts can do) ----
// The context lifts (near, same zone, active, recent) must not carry a word-inside or a skeleton / typo match over an
// exact or leading one, so every fixture still holds, and so do the queries that once failed in play there.
const allActive = events.map((e) => ({ ...e, t0: 0, t1: 1439.9 }));
const ctxEngine = createEngine({ amah: 0.48 });
ctxEngine.add({ kind: 'place', docs: () => placeDocs({ ZONE_CONTENT, SITE }) });
ctxEngine.add({ kind: 'thing', docs: () => thingDocs({ SITE, OBJECTS, ZONE_CONTENT, zoneAtSite }) });
ctxEngine.add({ kind: 'rite', docs: () => riteDocs({ events: allActive, EVENTS, SITE, ZONE_CONTENT, time: { t: 400 } }) });
ctxEngine.add({ kind: 'offering', docs: () => offeringDocs({ OFFERING_TYPES }) });
ctxEngine.add({ kind: 'role', docs: () => roleDocs({ ROLES_INFO, GLOSSARY }) });
ctxEngine.add({ kind: 'word', docs: () => wordDocs({ GLOSSARY }) });
ctxEngine.add({ kind: 'ui', docs: UI_DOCS });
ctxEngine.build(Infinity);
const AT_NIKANOR = { near: ZONE_CONTENT.nikanor.stand.slice(0, 2), zone: 'nikanor' };
const cq = (q) => ctxEngine.query(q, { limit: 40, boost: AT_NIKANOR });
check('context: every rite is active', ctxEngine.docs().filter((d) => d.kind === 'rite' && !d.occasional).every((d) => d.when?.active));
let c1 = 0, c3 = 0, cx = 0;
for (const [q, exp] of CONTEXT) {
  const res = cq(q);
  const ok = res.length > 0 && want(exp).includes(res[0].doc.id);
  if (ok) cx++;
  check(`context top1 ${JSON.stringify(q)}`, ok, show(res));
}
for (const [q, exp] of TOP1) {
  const res = cq(q);
  const ok = res.length > 0 && want(exp).includes(res[0].doc.id);
  if (ok) c1++;
  check(`context top1 ${JSON.stringify(q)}`, ok, show(res));
}
for (const [q, exp] of TOP3) {
  const res = cq(q);
  const w = want(exp);
  const ok = w ? res.slice(0, 3).some((r) => w.includes(r.doc.id)) : res.length > 0;
  if (ok) c3++;
  check(`context top3 ${JSON.stringify(q)}`, ok, show(res));
}
// no approximate (skeleton / typo) result above an exact or leading one, and no word-inside one above those either
let order = 0;
const BAND = { exact: 3, prefix: 2, tokens: 1, substring: 1, skeleton: 0, fuzzy: 0 };
for (const [q] of [...CONTEXT, ...TOP1, ...TOP3]) {
  const res = cq(q);
  for (let k = 1; k < res.length; k++) if (BAND[res[k].tier] > BAND[res[k - 1].tier]) { order++; check(`context band order ${JSON.stringify(q)}`, false, show(res)); break; }
}
console.log(`at Nikanor, every rite active: new ${cx}/${CONTEXT.length}, top1 ${c1}/${TOP1.length}, top3 ${c3}/${TOP3.length}, band order broken ${order}`);

// timing: every query again, warm
times.length = 0;
for (let k = 0; k < 5; k++) for (const [q] of [...TOP1, ...TOP3]) run(q);
times.sort((a, b) => a - b);
const pct = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
console.log(`queries: top1 ${n1}/${TOP1.length}, top3 ${n3}/${TOP3.length} · query ms median ${pct(0.5).toFixed(2)} p95 ${pct(0.95).toFixed(2)} max ${pct(1).toFixed(2)}`);
check('≥ 80 fixture queries', TOP1.length + TOP3.length >= 80, String(TOP1.length + TOP3.length));
check('query p95 ≤ 3 ms (node, this machine)', pct(0.95) <= 3, pct(0.95).toFixed(2));
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
