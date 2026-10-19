#!/usr/bin/env node
// Nav coverage test (player task): can the observer WALK to every place the UI sends them?
//
//   node tools/nav-coverage.mjs [--q low|medium|high|ultra] [--from start,azarah] [--json FILE] [--verbose] [--walk N]
//
// Starts its own Vite server + headless Edge (like tools/shot.mjs), boots the app, waits for ctx.nav, then runs
// ctx.nav.findPath from each origin to every zone 'stand' in src/data/zones-content.js and every event 'view.at' in
// src/data/schedule.js ({el, f} forms resolved against site.js). Targets are resolved exactly as ctx.player.goTo
// resolves them (goto.js resolveTarget: a Z picks the floor nearest it on any level).
//   origins: 'start' (the spawn anchor at the foot of the chel steps) and 'azarah' (a central Azarah point).
// A target PASSES when the path ends within 1 m in plan and 0.5 m in height of the target's floor (goTo's own
// arrival rule; anything farther ends the walk with a fade-hop). Failures are classified:
//   no-floor   the target point has no standable floor near its Z (geometry: wall top, solid, open air …)
//   unreached  the walk ends elsewhere (the place is not connected to the origin by walkable ground)
//   null       findPath returned null (origin off the grid, nothing reachable within 8 m of the target)
// Zones whose stand is null (zones-content.js sets it so on purpose, e.g. a space built as solid masonry) are listed
// as 'no-stand', not tested and not counted as failures.
// --walk N: also walk to the first N reachable targets from 'start' in real time with goTo at 'run' (slow).
// Exit code 1 when any target fails from any origin (known geometry blockers are listed, not excused).
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const opt = { q: 'low', from: ['start', 'azarah'], json: null, verbose: false, timeout: 240, walk: 0 };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--q') opt.q = args[++i];
  else if (a === '--from') opt.from = args[++i].split(',');
  else if (a === '--json') opt.json = args[++i];
  else if (a === '--verbose') opt.verbose = true;
  else if (a === '--timeout') opt.timeout = +args[++i];
  else if (a === '--walk') opt.walk = +args[++i];
}

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
  .find((p) => existsSync(p));
const server = await createServer({
  root, logLevel: 'error', configFile: join(root, 'vite.config.js'),
  server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: EDGE, headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  const url = `${base}?shot=1&q=${opt.q}`;
  await page.goto(url, { waitUntil: 'load', timeout: opt.timeout * 1000 });
  await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: opt.timeout * 1000, polling: 250 });
  const res = await page.evaluate(async ({ from, walk }) => {
    const ctx = globalThis.__mikdash;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 480 && !ctx.nav?.isReady; i++) await sleep(250);
    if (!ctx.nav?.isReady) return { error: 'nav not ready after 120 s' };
    const { m2w, w2m, AMAH } = await import('/src/core/units.js');
    const { resolveTarget } = await import('/src/player/goto.js');
    const { ZONE_CONTENT } = await import('/src/data/zones-content.js');
    const { EVENTS } = await import('/src/data/schedule.js');
    const site = ctx.site;
    /** [X,Y,Z?] | {el, f} → [X,Y,Z?] (site amot) */
    const point = (p) => {
      if (Array.isArray(p)) return p;
      if (p && p.el) {
        const e = site.elements?.[p.el] || ctx.elOpt?.(p.el);
        if (!e?.box) return null;
        const f = p.f || [0.5, 0.5, 1];
        return [0, 1, 2].map((k) => e.box.min[k] + (e.box.max[k] - e.box.min[k]) * f[k]);
      }
      return null;
    };
    const targets = [];
    for (const [id, z] of Object.entries(ZONE_CONTENT)) {
      const p = point(z.stand);
      targets.push({ kind: 'zone', id, at: p });
    }
    const seen = new Map();
    for (const e of EVENTS) {
      const p = point(e.view?.at);
      const key = JSON.stringify(p);
      if (seen.has(key)) { seen.get(key).also.push(e.id); continue; }
      const t = { kind: 'event', id: e.id, at: p, also: [] };
      seen.set(key, t);
      targets.push(t);
    }
    const origins = {};
    const r0 = resolveTarget(ctx, ctx.physics, 'start');
    if (from.includes('start') && r0) origins.start = r0.feet.clone();
    if (from.includes('azarah')) {
      const c = resolveTarget(ctx, ctx.physics, { at: [225, 370, 16] });
      origins.azarah = c.feet.clone();
    }
    const fmt = (v) => { const s = w2m(v); return [+s.X.toFixed(2), +s.Y.toFixed(2), +s.Z.toFixed(2)]; };
    const rows = [];
    for (const t of targets) {
      const row = { kind: t.kind, id: t.id, also: t.also, at: t.at, res: {} };
      rows.push(row);
      if (!t.at) { row.res = { all: { status: 'no-stand' } }; continue; }
      const r = resolveTarget(ctx, ctx.physics, { at: t.at });
      const goal = r.feet;
      row.goal = fmt(goal);
      const wantZ = Number.isFinite(t.at[2]) ? t.at[2] : null;
      // a standable floor near the requested Z?
      const floors = ctx.physics.floorsAt(goal.x, goal.z).map((y) => +(y / AMAH).toFixed(2));
      row.floors = floors;
      const goalZ = goal.y / AMAH;
      const noFloor = wantZ !== null && !floors.some((z) => Math.abs(z - goalZ) <= 0.05) && !floors.some((z) => Math.abs(z - wantZ) <= 1.05);
      for (const [oname, o] of Object.entries(origins)) {
        const t0 = performance.now();
        let p = null;
        try { p = ctx.nav.findPath(o, goal); } catch (e) { row.res[oname] = { status: 'error', msg: String(e) }; continue; }
        const ms = performance.now() - t0;
        if (!p) { row.res[oname] = { status: noFloor ? 'no-floor' : 'null', ms: +ms.toFixed(1), exp: ctx.nav.lastExpanded }; continue; }
        const end = p[p.length - 1];
        const dPlan = Math.hypot(end.x - goal.x, end.z - goal.z), dH = Math.abs(end.y - goal.y);
        let len = 0;
        for (let k = 1; k < p.length; k++) len += p[k].distanceTo(p[k - 1]);
        const ok = dPlan <= 1.0 && dH <= 0.5;
        row.res[oname] = {
          status: ok ? 'ok' : noFloor ? 'no-floor' : 'unreached', ms: +ms.toFixed(1), exp: ctx.nav.lastExpanded,
          len: Math.round(len), pts: p.length, ...(ok ? {} : { end: fmt(end), dPlan: +dPlan.toFixed(2), dH: +dH.toFixed(2) }),
        };
      }
    }
    // optional real-time goTo walks (first `walk` targets that pass from 'start')
    const walks = [];
    if (walk > 0) {
      for (const row of rows.filter((r) => r.res.start?.status === 'ok').slice(0, walk)) {
        ctx.player.teleport('start');
        let done = null;
        const t0 = performance.now();
        ctx.player.goTo({ at: row.at }, 'run').then((v) => { done = v; });
        while (done === null && performance.now() - t0 < 180000) await sleep(250);
        const s = w2m(ctx.player.position);
        walks.push({ id: row.id, done, secs: +((performance.now() - t0) / 1000).toFixed(1), end: [+s.X.toFixed(1), +s.Y.toFixed(1), +s.Z.toFixed(2)] });
      }
    }
    return { rows, walks, nav: ctx.nav.stats, phys: ctx.physics.stats, origins: Object.fromEntries(Object.entries(origins).map(([k, v]) => [k, fmt(v)])) };
  }, { from: opt.from, walk: opt.walk });
  if (res.error) { console.error(res.error); code = 2; } else {
    const { rows } = res;
    console.log(`nav-coverage (${opt.q}): ${rows.length} targets from ${Object.keys(res.origins).map((k) => `${k} ${JSON.stringify(res.origins[k])}`).join(', ')}`);
    console.log(`nav: ${res.nav.nodes} nodes, ${res.nav.layers ?? 1} layer(s), built in ${res.nav.workerMs ?? res.nav.totalMs} ms (${res.nav.how}; ready ${res.nav.totalMs} ms after the start); colliders ${res.phys.triangles} tris, BVH ${res.phys.buildMs} ms`);
    const fails = [], noStand = [];
    let qms = 0, nq = 0;
    for (const r of rows) {
      for (const [o, x] of Object.entries(r.res)) {
        if (x.ms != null) { qms += x.ms; nq++; }
        if (x.status === 'no-stand') noStand.push(r);
        else if (x.status !== 'ok') fails.push({ r, o, x });
      }
      if (opt.verbose) console.log(`  ${r.kind.padEnd(5)} ${r.id.padEnd(26)} ${JSON.stringify(r.at)} → ${Object.entries(r.res).map(([o, x]) => `${o}:${x.status}${x.len != null ? ` ${x.len}m` : ''} ${x.ms ?? ''}ms`).join('  ')}`);
    }
    console.log(`queries: ${nq}, mean ${(qms / Math.max(1, nq)).toFixed(1)} ms`);
    if (noStand.length) console.log(`no stand, not tested (${noStand.length}): ${noStand.map((r) => `${r.kind} ${r.id}`).join(', ')}`);
    if (!fails.length) console.log('ALL REACHABLE');
    else {
      code = 1;
      console.log(`FAILURES (${fails.length}):`);
      for (const { r, o, x } of fails) {
        console.log(`  [${x.status}] ${r.kind} ${r.id}${r.also?.length ? ` (+${r.also.join(',')})` : ''} from ${o}: target ${JSON.stringify(r.at)} goal ${JSON.stringify(r.goal)} floors ${JSON.stringify(r.floors)}${x.end ? ` → ends ${JSON.stringify(x.end)} (${x.dPlan} m off, ${x.dH} m height)` : ''}`);
      }
    }
    if (res.walks?.length) for (const w of res.walks) console.log(`  walk ${w.id}: ${w.done} in ${w.secs} s, ends ${JSON.stringify(w.end)}`);
    if (opt.json) writeFileSync(resolve(opt.json), JSON.stringify(res, null, 1));
  }
  const errs = logs.filter((l) => /error/i.test(l));
  if (errs.length) console.log(`console errors (${errs.length}):\n  ${errs.slice(0, 20).join('\n  ')}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(code);
