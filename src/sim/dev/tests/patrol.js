// The officer's round: route quality (nav length per leg against the authored straight line, which fixes his
// timeline), and screenshots of him and his torch-bearers from a few metres behind.
const rt = ctx.schedule.runtime;
const nw = rt.choreo('night-watch');
for (let i = 0; i < 200 && !nw.state.routeSource.startsWith('nav'); i++) await sleep(250);
await frames(3);
const { m2w, AMAH } = await import('/src/core/units.js');
const S = nw.state, R = S.route;
const legs = [];
for (let i = 0; i < S.stops.length; i++) {
  const a = S.stops[i], b = S.stops[(i + 1) % S.stops.length];
  const st = Math.hypot(a.X - b.X, a.Y - b.Y) * AMAH, nv = R.at[i + 1] - R.at[i];
  if (nv - st > 6) legs.push(`${a.post?.id ?? 'via'}→${b.post?.id ?? 'via'} straight ${st.toFixed(0)} m, nav ${nv.toFixed(0)} m`);
}
const out = { source: S.routeSource, failed: S.routeFailed, km: +(R.path.length / 1000).toFixed(2), roundMin: +S.nom.T.toFixed(1), posts: S.stops.filter((s) => s.post).length, stops: S.stops.length, longLegs: legs };
log(out);
// view the officer from behind (on his own path, 7 m back), at a few times given by the test query list
const times = (globalThis.__simTimes || ['n2', 'n3.2', 'n5']).map((s) => ctx.time.parse(s));
let k = 0;
for (const t of times) {
  ctx.time.set(t);
  await frames(4);
  const P = S.patrol;
  if (!P) { log({ t: ctx.time.format(t), patrol: null }); continue; }
  const q = R.path.sample(Math.max(0, P.d - 7), {});
  const z = ctx.physics.standFloor(m2w(q.X, q.Y, 0).x, m2w(q.X, q.Y, 0).z, m2w(0, 0, Number.isFinite(q.Z) ? q.Z : P.Z).y, true);
  ctx.player.teleport({ at: [q.X, q.Y, (z ?? 0) / AMAH] });
  const h = Math.atan2(P.X - q.X, P.Y - q.Y) * 180 / Math.PI;
  ctx.player.setLook((h + 360) % 360, -4);
  await frames(25);
  log({ t: ctx.time.format(t), at: P.walking ? 'walking' : S.stops[P.stop].post?.id, X: +P.X.toFixed(1), Y: +P.Y.toFixed(1), Z: +P.Z.toFixed(1), zone: ctx.zones.current });
  await shot(`patrol-${k++}`);
}
return out;
