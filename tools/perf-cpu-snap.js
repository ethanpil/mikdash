// perf-cpu: a fingerprint of everything the sim and the people system put on screen at a set of moments, for a
// before/after comparison of CPU-side optimisations (the output must not change). Run with the sim harness:
//   node src/sim/dev/run.mjs --q low --timeout 3000 --script tools/perf-cpu-snap.js "at=238,385&look=215,4&t=d3"
// and diff the JSON lines of two builds. Per moment: every shown sim figure (pool slot, position, heading, pose, phase,
// prop), every door, and each people batch's drawn instances (instance matrix, tint, mask, rig row — the parts that do not
// depend on the real-time animation clock), sorted. Auto-advanced pose phases (pAnimA) depend on real frame times and
// are left out; the fades are snapped (shot mode).
const rt = ctx.schedule.runtime;
const r3 = (x) => Math.round(x * 1000) / 1000;
const MOMENTS = [
  ['2026-11-02', 'alot-6', 'start', null],
  ['2026-11-02', 'd3', [238, 385], [215, 4]],
  ['2026-11-02', 'sunrise+40', [238, 385], [215, 4]],
  ['2026-11-11', 'sunrise+140', [238, 385], [215, 4]],
  ['2026-11-02', 'n3', [238, 385], [215, 4]],
  ['2026-11-02', 'd7.5', [250, 300], [270, 2]],
  ['2026-11-07', 'd4', [238, 385], [215, 4]],
];
const out = {};
for (const [date, t, at, look] of MOMENTS) {
  if (ctx.time.dateString !== date) { ctx.time.setDate(date); await frames(2); }
  ctx.player.teleport(typeof at === 'string' ? at : { at, heading: look?.[0] });
  if (look) ctx.player.setLook(look[0], look[1]);
  ctx.time.set(ctx.time.parse(t));
  await frames(4);
  // wait for any plan job a date change started
  for (let i = 0; i < 200 && rt.plans && !rt.plans.done; i++) await sleep(100);
  ctx.time.set(ctx.time.parse(t));
  await frames(4);
  const figs = [];
  for (const e of rt.entries) for (const p of e.pools) for (const s of p.slots) {
    if (!s.shown) continue;
    const o = s.actor.object3D;
    figs.push(`${e.id}/${p.name}#${s.index} ${r3(o.position.x)},${r3(o.position.y)},${r3(o.position.z)} h${r3(s._heading)} ${s._pose}${Number.isNaN(s._phase) ? '' : '@' + r3(s._phase)} ${s._prop || ''}`);
  }
  const crowds = [];
  for (const e of rt.entries) for (const c of e.crowds) if (c.shown) crowds.push(`${e.id} ${c._pose} n${c._n}`);
  const batches = {};
  const sys = ctx.people.system;
  for (const b of sys.batches) {
    if (!b.mesh || !b.n) continue;
    const M = b.mesh.instanceMatrix.array, T = b.aT.array, B = b.aB.array;
    const rows = [];
    for (let i = 0; i < b.n; i++) {
      rows.push([...M.subarray(i * 16, i * 16 + 16)].map(r3).join(',') + '|' + [...T.subarray(i * 4, i * 4 + 4)].map(r3).join(',') + '|' + r3(B[i * 4]) + ',' + r3(B[i * 4 + 3]));
    }
    rows.sort();
    batches[b.name] = rows;
  }
  // the torch flames' anchors (fx follows their world matrices)
  const anchors = [];
  sys.root.updateMatrixWorld();
  for (const o of sys.root.children) if (o.name === 'people:torch-anchor') { const e = o.matrixWorld.elements; anchors.push(`${r3(e[12])},${r3(e[13])},${r3(e[14])}`); }
  anchors.sort();
  const st = sys.stats;
  out[`${date} ${t}`] = { figs: figs.sort(), crowds: crowds.sort(), batches, anchors, lod: [...st.lod], props: st.props, drawn: st.drawn, sim: rt.stats.figures };
}
return out;
