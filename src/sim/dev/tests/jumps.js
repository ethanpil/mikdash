// Determinism under clock jumps: the same t must give the same world, whatever the order of jumps.
// Snapshot = every sim figure's visibility / position / heading / pose + every door's open amount (the gates and the
// Moked's doors the officer's party opens).
const rt = ctx.schedule.runtime;
const nw = rt.choreo('night-watch'), gates = rt.choreo('gates-opening');
ctx.time.set(ctx.time.parse('n2')); await frames(3);
for (let i = 0; i < 240 && !(nw.state.routeSource.startsWith('nav') && nw.state.gpaths.every(Boolean) && gates.state?.walk?.source === 'nav'); i++) await sleep(250);
const S = nw.state, W = S.plan.W, Q = S.plan.patrol;
const pass = S.passDoors[0]?.e ? (Q.p0 + S.passDoors[0].e[3]) % 1440 : NaN;
const T = ['n2', 'alot-6', 'sunrise', 'd3', 'sunset+30', 'sunrise-6', 'sunrise-12.5', 'sunrise-4.5', 'tzeit-8', 'tzeit+2', 'n7.52', 'n7.56', 'n7.6', 'n9',
  W.watch[0] - 1, W.watch[1] + 1.2, W.lockStart + 2.5, Q.p0 + 0.49, (Q.p0 + Q.len - 0.004 + 1440) % 1440, pass, pass + 0.05, 'sunrise+16'];
const r3 = (x) => Math.round(x * 1000) / 1000;
function snap() {
  const figs = [];
  for (const e of rt.entries) for (const p of e.pools) for (const s of p.slots) {
    if (!s.shown) continue;
    const o = s.actor.object3D;
    figs.push(`${e.id}/${p.name}#${s.index} ${r3(o.position.x)},${r3(o.position.y)},${r3(o.position.z)} h${r3(s._heading)} ${s._pose}${Number.isNaN(s._phase) ? '' : '@' + r3(s._phase)} ${s._prop || ''}`);
  }
  const doors = [...gates.state.doors.map((d) => `${d.id}=${r3(d.h.amount)}`), ...S.passDoors.map((d) => `${d.id}=${r3(d.door.amount)}`)];
  return { figs, doors, cloak: r3(S.cloakLevel) };
}
const tOf = (s) => (typeof s === 'number' ? (s + 1440) % 1440 : ctx.time.parse(s));
const at = async (s) => { ctx.time.set(tOf(s)); await frames(3); return snap(); };
const A = {}, B = {};
for (const s of T) A[s] = await at(s);
for (const s of [...T].reverse()) B[s] = await at(s);
// and a jump straight from far away to each time again
const C = {};
for (const s of T) { await at('d6'); C[s] = await at(s); }
const diffs = [];
for (const s of T) {
  const a = JSON.stringify(A[s]), b = JSON.stringify(B[s]), c = JSON.stringify(C[s]);
  if (a !== b || a !== c) diffs.push({ t: s, a: A[s].figs.length, b: B[s].figs.length, c: C[s].figs.length, firstA: A[s].figs.find((x, i) => x !== B[s].figs[i]), firstB: B[s].figs.find((x, i) => x !== A[s].figs[i]), doorsA: A[s].doors.join(' ') === B[s].doors.join(' ') ? 'same' : A[s].doors.filter((x, i) => x !== B[s].doors[i]) });
}
const summary = {};
for (const s of T) {
  const count = {};
  for (const f of A[s].figs) { const k = f.split('#')[0]; count[k] = (count[k] || 0) + 1; }
  const walking = A[s].figs.filter((f) => / walk/.test(f)).length;
  const open = A[s].doors.filter((d) => +d.split('=')[1] > 0.5).length, mid = A[s].doors.filter((d) => { const v = +d.split('=')[1]; return v > 0.01 && v < 0.99; });
  summary[typeof s === 'number' ? s.toFixed(2) : s] = `${ctx.time.format(tOf(s))} figs ${A[s].figs.length} (walking ${walking}) ${JSON.stringify(count)} doors open ${open}/${A[s].doors.length}${mid.length ? ' moving ' + mid.join(' ') : ''}${A[s].cloak > 0 ? ' cloak ' + A[s].cloak : ''}`;
}
return { deterministic: diffs.length === 0, diffs, summary };
