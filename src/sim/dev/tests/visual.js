// Screenshots of each scene (camera: site [X,Y,Z] standing spot, heading, pitch), at times taken from the choreos'
// own plans so they follow the schedule.
const rt = ctx.schedule.runtime;
const nw = rt.choreo('night-watch'), gates = rt.choreo('gates-opening');
ctx.time.set(ctx.time.parse('n2')); await frames(3);
for (let i = 0; i < 240 && !(nw.state.routeSource.startsWith('nav') && nw.state.gpaths.every(Boolean) && gates.state?.walk?.source === 'nav'); i++) await sleep(250);
const S = nw.state, Q = S.plan.patrol, W = S.plan.W, G = gates.state.plan;
const arrOf = (id, r = 2) => { for (let i = 0; i < Q.arrK.length; i++) if (S.stops[Q.arrK[i]].post.id === id && Q.arrKey[i].startsWith(`shalom:${r}:`)) return Q.arrT[i]; return NaN; };
const pass = (k) => (Q.p0 + S.passDoors[k].e[4]) % 1440;
const [i0, i1] = W.incident, L = (i1 - i0 + 1440) % 1440;
const views = globalThis.__simViews || [
  // [name, t (minutes or a time string), { at:[X,Y,Z] standing | pos:[X,Y,Z] eye, fly }, heading, pitch]
  ['moked', 'n3', { at: [210.75, 397.5, 16] }, 0, -16],
  ['avtinas', 'n3', { at: [213.5, 260.8, 36] }, 270, -14],
  ['guard-shushan', 'n2', { at: [478, 334, 0] }, 92, 2],
  ['officer-gate', Q.p0 + 0.48, { at: [165, 12, -27.08] }, 180, -2],
  ['moked-door', pass(0) - 0.03, { at: [210.75, 440, 0] }, 180, 12],
  ['moked-pishpash', pass(1) + 0.02, { at: [214.5, 381, 16] }, 0, 2],
  ['kaporet', arrOf('achorei-beit-hakaporet') + 0.1, { at: [74, 345, 16] }, 180, -4],
  ['corner-sw', arrOf('azarah-sw') + 0.1, { at: [44, 262, 0] }, 125, -6],
  ['incident-asleep', i0 - 0.25, { at: [266, 249.5, 0] }, 307, -12],
  ['incident-strike', i0 + 0.07 * L, { at: [266, 249.5, 0] }, 307, -12],
  ['incident-burn', i0 + 0.4 * L, { at: [250, 253.5, 0] }, 78, -10],
  ['guards-in', W.watch[0] - 0.7, { at: [40, 238, 0] }, 300, -1],
  ['guards-out', W.watch[1] + 1.25, { at: [488, 324, 0] }, 268, 0],
  ['rovim-wake', W.upper[1] - 0.4, { at: [213.5, 260.8, 36] }, 270, -14],
  ['clearing-ready', G.tStart - 2, { at: [100, 368, 16] }, 300, 4],
  ['clearing-steps', G.tArrive - 0.25, { at: [200, 340, 16] }, 258, 8],
  ['clearing-wicket', G.tArrive + 0.15, { at: [172, 336, 22] }, 330, 2],
  ['blasts', G.blast + 0.2, { at: [290, 330.5, 6] }, 270, 4],
  ['great-gate', G.great + 1.6, { at: [190, 330.5, 22] }, 270, 2],
  ['day-gates', 'd3', { at: [470, 330.5, 0] }, 90, 2],
];
const out = [];
for (const [name, t, v, h, p] of views) {
  ctx.time.set(typeof t === 'number' ? (t + 1440) % 1440 : ctx.time.parse(t));
  ctx.player.setMode(v.fly ? 'fly' : 'walk');
  ctx.player.teleport(v.pos ? { pos: v.pos } : { at: v.at });
  ctx.player.setLook(h, p);
  await frames(30);
  const shown = rt.entries.map((e) => `${e.id}:${e.pools.map((q) => q.slots.filter((s) => s.shown).length).join('/')}`).join(' ');
  out.push(`${name} ${ctx.time.format()} zone=${ctx.zones.current} ${shown}`);
  await shot(`v-${name}`);
}
return out;
