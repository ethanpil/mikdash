#!/usr/bin/env node
// Travel tests (docs/console-design.md §6.3.1): first the route-places unit checks in node (trip.js), then the
// in-page acceptance script src/player/dev/trip.js through the sim runner (its own Vite server and headless Edge).
//   node src/player/dev/triptest.mjs [--unit] ["<extra query>"]     e.g. "troutes=tunnel&tpaces=1,10"
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Trip, makeRoute, mergeRuns, sampleRuns, clampPace } from '../trip.js';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
let fails = 0;
const check = (name, ok, info = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };

// ---- unit: places along a route ----
const P = (x, y = 0, z = 0) => ({ x, y, z });
// a straight 20 m route through zones by x: A [0,5) · a 0.6 m sliver B [5,5.6) · A [5.6,10) · C [10,10.8) · D [10.8,20]
const zoneAt = (p) => (p.x < 5 ? 'A' : p.x < 5.6 ? 'B' : p.x < 10 ? 'A' : p.x < 10.8 ? 'C' : 'D');
const R = makeRoute([P(0), P(20)]);
const raw = sampleRuns(R, zoneAt, { step: 0.25 });
check('sampleRuns finds every place', raw.map((r) => r.zone).join('') === 'ABACD', raw.map((r) => r.zone).join(''));
const merged = mergeRuns(raw, 1.0, 1);
check('runs under 1 m merge (into both neighbours when they match)', merged.map((r) => r.zone).join('') === 'AD', merged.map((r) => `${r.zone}${r.s0.toFixed(2)}-${r.s1.toFixed(2)}`).join(' '));
const T = new Trip({ id: 1, way: 'walk', pace: 1, mps: 1.4, zoneAt });
T.setRoute([P(0), P(20)]);
const got = [];
for (let s = 0; s <= 20; s += 3.3) got.push(...T.advance(s).map((c) => c.zone));
got.push(...T.advance(20).map((c) => c.zone));
check('advance announces each place once, in order', got.join('') === 'D', got.join(''));
// a re-plan mid-way keeps what was announced and samples the rest from there
const zoneAt2 = (p) => (p.z > 3 ? 'E' : zoneAt(p));
const T2 = new Trip({ id: 2, way: 'walk', pace: 1, mps: 1.4, zoneAt: zoneAt2 });
T2.setRoute([P(0), P(20)]);
const g2 = T2.advance(12).map((c) => c.zone);
T2.setRoute([P(12), P(12, 0, 6), P(20, 0, 6)]);
g2.push(...T2.advance(1e9).map((c) => c.zone));
check('re-plan keeps the announced places and continues from the current distance', g2.join('') === 'DE', `${g2.join('')} route ${T2.total.toFixed(1)} m`);
check('pace clamps to 0.25..10', clampPace(0.1) === 0.25 && clampPace(12) === 10 && clampPace('2') === 2 && clampPace(NaN) === 1);
// a hop (no sampling): start and end only
const T3 = new Trip({ id: 3, way: 'instant', pace: 1, mps: 0, zoneAt });
T3.setRoute([P(1), P(19)], { sample: false });
check('a veiled hop lists only its start and end', T3.zones.map((r) => r.zone).join('') === 'AD' && T3.advance(1e9).map((c) => c.zone).join('') === 'D');

if (args.includes('--unit')) process.exit(fails ? 1 : 0);

// ---- in page ----
const extra = args.filter((a) => !a.startsWith('--')).join('&');
const r = spawnSync(process.execPath, [resolve(root, 'src/sim/dev/run.mjs'), '--q', 'low', '--timeout', '900', '--script', resolve(root, 'src/player/dev/trip.js'), `t=d3${extra ? `&${extra}` : ''}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
const m = /result: (\{[\s\S]*?\n\})/.exec(r.stdout || '');
let res = null;
try { res = m ? JSON.parse(m[1]).value : null; } catch { /* printed above */ }
if (!res) { console.log('FAIL in-page run (no result)'); process.exit(1); }
if (res.tripFails) check(`trips (${Object.keys(res.trips).length})`, res.tripFails.length === 0, res.tripFails.join(' | '));
if (res.look) check('look never cancels; returns ≤ 3.5 s; W cancels', res.look.notCancelledByLook && res.look.backOk && res.look.wCancels, JSON.stringify(res.look));
if (res.keys) check('E inspects and does not rise; Space rises', res.keys.ok, JSON.stringify(res.keys));
if (res.pad) check('pad: a B held over from the Menu does not stop the walk; a fresh B does; a held-over A does not rise', res.pad.ok, JSON.stringify(res.pad));
if (res.touch) check('touch: a tap is timed by its events (a 400 ms stall keeps it a tap); a 400 ms hold is not one', res.touch.ok, JSON.stringify(res.touch));
if (res.api) check('setPace / setWay / finishTrip / superseded', res.api.ok, JSON.stringify(res.api).slice(0, 600));
if (res.cost) check('frame cost at 10× (12 sub-steps) ≤ 1.5 ms median', res.cost.median <= 1.5, JSON.stringify(res.cost));
process.exit(fails || r.status ? 1 : 0);
