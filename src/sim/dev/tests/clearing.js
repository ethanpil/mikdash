const rt = ctx.schedule.runtime;
const gates = rt.choreo('gates-opening');
for (let i = 0; i < 200 && !(gates.state?.walk?.source === 'nav'); i++) await sleep(250);
const W = gates.state.walk;
const P = gates.state.plan;
const out = { source: W.source, at: W.at.map((d) => +d.toFixed(1)), pts: W.path.points.map((p) => `${p.X.toFixed(1)},${p.Y.toFixed(1)},${p.Z.toFixed(1)}`), tStart: ctx.time.format(P.tStart), tArrive: ctx.time.format(P.tArrive), wicket: ctx.time.format(P.wicket), rows: [] };
for (let k = 0; k <= 30; k++) {
  const t = P.tStart + k * 0.1;
  ctx.time.set(t); await frames(2);
  const s = gates.state.clearing.slots[0];
  out.rows.push(`${(k * 0.1).toFixed(1)} ${s.shown ? s.actor.object3D.position.toArray().map((v) => (v / 0.48).toFixed(1)).join(',') : '-'} ${s._pose} ${s._prop} wicket=${gates.state.doors.find((d) => d.kind === 'wicket').h.amount.toFixed(2)}`);
}
// a picture on the Ulam steps
ctx.time.set(P.tArrive - 0.25); ctx.player.teleport({ at: [200, 340, 16] }); ctx.player.setLook(258, 8); await frames(30); await shot('v-clearing-steps');
ctx.time.set(P.tArrive + 0.2); ctx.player.teleport({ at: [172, 336, 22] }); ctx.player.setLook(330, 2); await frames(30); await shot('v-clearing-wicket');
return out;
