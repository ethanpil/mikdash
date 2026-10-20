// Night: guards at posts, kohanim asleep, the officer's round, doors shut. Screenshots of a few posts.
const rt = ctx.schedule.runtime;
const nw = rt.choreo('night-watch'), gates = rt.choreo('gates-opening');
for (let i = 0; i < 120 && !nw.state.routeSource.startsWith('nav'); i++) await sleep(250);
await frames(3);
const shown = (e) => e.pools.map((p) => `${p.name}:${p.slots.filter((s) => s.shown).length}/${p.count}`).join(' ');
const doors = gates.state.doors.map((d) => `${d.id.split('.').pop()}=${d.h.amount.toFixed(2)}`).join(' ');
const S = nw.state, O = S.patrol;
const out = {
  t: ctx.time.format(), zone: ctx.zones.current, events: ctx.schedule.events.length,
  nw: { rel: nw.relevant, fixture: nw.fixture, shown: shown(nw), debug: nw.mod.debug(S), ev: nw.events.map((e) => [e.id, ctx.time.format(e.t0), ctx.time.format(e.t1)]) },
  gates: { shown: shown(gates), debug: gates.mod.debug(gates.state), doors },
  stats: { ...rt.stats },
  patrol: O && { X: +O.X.toFixed(1), Y: +O.Y.toFixed(1), Z: +O.Z.toFixed(2), stop: S.stops[O.stop].post?.id ?? 'via', walking: O.walking },
};
log(out);
const look = async (name, at, h, p = 0) => { ctx.player.teleport({ at }); ctx.player.setLook(h, p); await frames(20); await shot(name); };
await look('night-shushan', [478, 334], 92, 2);
await look('night-azarah-se', [268, 249], 255, 3);
const P = S.patrol;
if (P) await look('night-patrol', [P.X - 10, P.Y - 6, P.Z], Math.atan2(10, 6) * 180 / Math.PI, 0);
return out;
