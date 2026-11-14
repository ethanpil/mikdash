#!/usr/bin/env node
// Tables from tools/cpu-prof.mjs output: node tools/cpu-prof-table.mjs shots/perf-cpu/base-low [more dirs…] [--top 25] [--draws]
// One row per scene and directory: the update window's JS ms/frame by system and allocations, the draw window's render JS,
// calls / triangles / programs. --top N prints the update window's top functions by self time; --draws the draw breakdown.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
let top = 0, draws = false;
const dirs = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--top') top = +args[++i]; else if (args[i] === '--draws') draws = true; else dirs.push(args[i]); }
const f2 = (x) => (x == null ? '-' : (+x).toFixed(2));
console.log('| scene | run | upd tick | sim | zones | people | player | env | fx+world(50) | world(45/55) | audio | ui | busy | gc | KB/f | draw JS | draw tick | calls | tris | programs | figures drawn (L0/1/2/3) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const d of dirs) {
  for (const f of readdirSync(d).filter((x) => x.endsWith('.json') && x !== 'summary.json').sort()) {
    const r = JSON.parse(readFileSync(join(d, f), 'utf8'));
    const u = r.update, w = r.draw, p = u.stats.perSystem;
    const ps = w.stats.people;
    console.log(`| ${r.scene.name} | ${d.split('/').pop()} | ${f2(u.stats.tickMsPerFrame)} | ${f2(p.sim)} | ${f2(p.p11)} | ${f2(p.people)} | ${f2(p.player)} | ${f2(p.env)} | ${f2(p.fx)} | ${f2((p.p45 || 0) + (p.p55 || 0))} | ${f2(p.audio)} | ${f2(p.ui)} | ${f2(u.cpu.busyMsPerFrame)} | ${f2(u.cpu.gcMsPerFrame)} | ${u.heap ? u.heap.kbPerFrame.toFixed(0) : '-'} | ${f2(w.stats.perSystem.draw)} | ${f2(w.stats.tickMsPerFrame)} | ${w.stats.callsMed} | ${(w.stats.trisMed / 1e6).toFixed(3)}M | ${w.stats.programs} | ${ps ? `${ps.drawn} (${ps.lod.join('/')})` : '-'} |`);
    if (top) {
      console.log(`\n${r.scene.name} — update window, self ms/frame:`);
      for (const [k, v] of u.cpu.selfTop.filter(([k]) => !/^\((idle|program)\)/.test(k)).slice(0, top)) console.log(`  ${v.toFixed(3)}  ${k}`);
      console.log('  alloc KB/frame:');
      for (const [k, v] of (u.heap?.byFn || []).slice(0, 10)) console.log(`  ${v.toFixed(1)}  ${k}`);
      console.log('  draw window, self ms/frame:');
      for (const [k, v] of w.cpu.selfTop.filter(([k]) => !/^\((idle|program)\)/.test(k)).slice(0, Math.min(15, top))) console.log(`  ${v.toFixed(3)}  ${k}`);
      console.log('');
    }
    if (draws && r.draws) {
      const agg = {};
      for (const [k, v] of Object.entries(r.draws)) {
        if (!Array.isArray(v)) continue;
        const [pass, grp] = k.split('|');
        const g = grp.startsWith('people/') ? grp.replace(/:.*$/, '').replace(/^people\/(L\d|proxy|prop).*$/, 'people/$1') : grp;
        const kk = `${pass}|${g}`;
        agg[kk] = agg[kk] || [0, 0]; agg[kk][0] += v[0]; agg[kk][1] += v[1];
      }
      console.log(`\n${r.scene.name} — one frame's draws (calls, triangles) by pass | group:`);
      for (const [k, v] of Object.entries(agg).sort((a, b) => b[1][1] - a[1][1])) console.log(`  ${k.padEnd(40)} ${String(v[0]).padStart(4)} ${String(v[1]).padStart(8)}`);
    }
  }
}
