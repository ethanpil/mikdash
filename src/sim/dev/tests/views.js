// "Go" views (qa-r2 SIM-R2-2; gate-sim-data): every place the UI's "Go" stands the observer to watch something must be
// open floor with a clear view ahead, AND from it the thing must be seen. Two parts, on a weekday, a Friday and a
// Shabbat; the test THROWS (the harness exits 1) when either finds a failure.
//
// A. stand — for every view of the day's events (src/data/schedule.js), of the dynamic rows (G4's sets and the
//    circuit, G5's offerings in progress — sampled through the day) and of the live views:
//      1. floor  — a standable floor within 0.6 m of the view's Z (its datum floor when it gives none);
//      2. inside — the point 1 m over that floor is not inside a solid (physics.insideAt);
//      3. ahead  — a level ray from the eye (1.6 m) along the view's heading meets nothing within 4 m (an authored
//                  view; a computed one — live or auto — 1.5 m, as lib/watch.js standFor keeps).
// B. watch — for every event of importance ≥ 2, and every event of the individuals' offerings (private-offerings'
//    grouped rows), at WATCH_K of its window: the clock is set there, the observer goes to the view exactly as the
//    UI's "Go" at Instant does (player.goTo(viewOf(ev), 'instant')), and at least one figure its choreo draws (within
//    NEAR of its place, else 2 × NEAR) must be seen from the camera as it stands — lib/watch.js seen(): two of head,
//    chest and knees in the frustum, clear of colliders, door leaves and other figures, ≥ MIN_FRAC of the screen tall.
//    An event of no participants (the nivreshet, the fire) is its own place, one point of three. G5's dynamic offering
//    rows are sampled too: the row's own figure (ev.pos) must be seen from its view the same way.
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/views.js "t=d3"   (?vt=stand|watch, ?vd=YYYY-MM-DD,…)
const rt = ctx.schedule.runtime, time = ctx.time, ph = ctx.physics, S = ctx.schedule;
const { AMAH: AM } = await import('/src/core/units.js');
const V3 = ctx.camera.position.constructor;
const raw = ctx.params?.raw;
const EYE = 1.6, AHEAD = 4, FLOOR_TOL = 0.6;
const WATCH_K = [0.2, 0.5, 0.8];
const NEAR = 18;                  // m: the figures counted are within this of the event's place (positionOf)
const SHOTS = raw?.get?.('vshots') === '1';
const only = raw?.get?.('vt') || 'all';
const DATES = (raw?.get?.('vd') || '2026-11-02,2026-11-06,2026-11-07').split(',');
const IDS = raw?.get?.('vi') ? new Set(raw.get('vi').split(',')) : null;     // only these events (debugging)
const r2 = (x) => Math.round(x * 100) / 100;
const span = (a, b) => ((b - a) % 1440 + 1440) % 1440;
const out = { dates: DATES };

// ------------------------------------------------------------------------------------------------ A. stand
if (only === 'all' || only === 'stand') {
  const views = new Map();   // key -> { at, heading, who, owner }
  const add = (v, who, owner) => {
    const p = v?.at;
    if (!p) return;
    let at = null;
    if (Array.isArray(p)) at = p;
    else if (p.el) { const b = ctx.elOpt?.(p.el)?.box; if (b) { const f = p.f || [0.5, 0.5, 1]; at = [0, 1].map((i) => b.min[i] + (b.max[i] - b.min[i]) * (f[i] ?? 0.5)); } }
    if (!at) return;
    const h = Number.isFinite(v.heading) ? v.heading : null;
    const key = `${r2(at[0])},${r2(at[1])},${Number.isFinite(at[2]) ? r2(at[2]) : '-'}|${h ?? '-'}`;
    if (!views.has(key)) views.set(key, { at, heading: h, who: new Set(), owner });
    const e = views.get(key);
    e.who.add(who);
    if (owner === 'sim') e.owner = 'sim';
  };
  for (const date of DATES) {
    time.setDate(date); await frames(3);
    for (const ev of S.events) {
      if (ev.dayTypes?.includes?.('occasional')) continue;
      // a live view (a getter) is the sim's; read it at a few moments of the event
      // (and the auto view, lib/watch.js: the stand that replaces a data view showing nothing, sampled through the window)
      const d = Object.getOwnPropertyDescriptor(ev, 'view');
      if (d && d.get) {
        time.set((ev.t0 + 720) % 1440); await frames(1);        // (outside its window: the data's own view)
        add(ev.view, ev.id, 'data');
        const n = S.hasLiveView?.(ev.id) ? 6 : 3;
        for (let k = 0; k < n; k++) { time.set(ev.t0 + span(ev.t0, ev.t1) * (k + 0.5) / n); await frames(1); add(ev.view, `${ev.id}@${time.format(time.t)}`, 'sim'); }
      } else add(ev.view, ev.id, 'data');
    }
    // the dynamic rows through the day
    for (let t = 0; t < 1440; t += 3) for (const ev of S.dynamic(t)) add(ev.view, `${ev.parent || ''}/${ev.id}`.replace(/:\d+(\.\d+)?$/, ''), 'sim');
  }
  const bad = [];
  let n = 0;
  for (const [key, v] of views) {
    n++;
    const X = v.at[0], Y = v.at[1], x = X * AM, z = -Y * AM;
    const hasZ = Number.isFinite(v.at[2]);
    const f = hasZ ? ph.levelFloor(x, z, v.at[2] * AM) : ph.floorAt(x, z);
    const why = [];
    if (f == null || (hasZ && Math.abs(f - v.at[2] * AM) > FLOOR_TOL)) why.push(`no floor near Z ${hasZ ? r2(v.at[2]) : '-'} (floor ${f == null ? '-' : r2(f / AM)})`);
    const fy = f ?? (hasZ ? v.at[2] * AM : 0);
    if (ph.insideAt(x, fy + 1.0, z)) why.push('inside a solid at +1 m');
    // (4 m for an authored view; a computed one — a live or auto view, checked by part B to see its figures — 1.5 m,
    // as lib/watch.js standFor keeps: from the pavement an altar-top figure is watched over the altar's side)
    const ahead = v.owner === 'data' ? AHEAD : 1.5;
    if (v.heading != null) {
      const a = (v.heading * Math.PI) / 180;
      const hit = ph.raycast(new V3(x, fy + EYE, z), new V3(Math.sin(a), 0, -Math.cos(a)), ahead);
      if (hit && hit.distance < ahead) why.push(`view blocked at ${r2(hit.distance)} m`);
    }
    if (why.length) bad.push({ owner: v.owner, at: key, why: why.join('; '), who: [...v.who].slice(0, 4).join(', ') });
  }
  out.stand = { views: n, bad };
}

// ------------------------------------------------------------------------------------------------ B. watch
// what the camera shows now (lib/watch.js seen(): the same test the auto view applies — two of a figure's head, chest
// and knees in the frustum and clear of solids, MIN_FRAC of the screen tall), from the camera as it stands
const W = await import('/src/sim/lib/watch.js');
const { EYE_HEIGHT } = await import('/src/core/units.js');
const _cd = new V3();
function seen(figs) {
  const cam = ctx.camera;
  cam.updateMatrixWorld();
  const feet = new V3().setFromMatrixPosition(cam.matrixWorld);
  feet.y -= EYE_HEIGHT;
  cam.getWorldDirection(_cd);
  const heading = ((Math.atan2(_cd.x, -_cd.z) * 180) / Math.PI + 360) % 360;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, _cd.y))) * 180) / Math.PI;
  const r = W.seen(ctx, feet, heading, figs, pitch);
  let d = NaN;
  for (const g of figs) { const x = g.p.distanceTo(feet); if (!(x >= d)) d = x; }
  return { ok: r.n > 0, frac: r2(r.frac), d: r2(d), why: r.why };
}
/** the figures a choreo draws now: { p (world feet), H } — within `near` m of `at` (world) when given */
function drawn(entry, at = null, near = Infinity) {
  const figs = [];
  if (!entry) return figs;
  const keep = (p) => !at || p.distanceTo(at) <= near;
  for (const p of entry.pools) {
    const animal = !!p.spec?.animal, bird = /dove|pigeon/.test(p.spec?.animal || '');
    for (const s of p.slots) {
      if (!s.shown || !s.actor?.object3D) continue;
      let o = s.actor.object3D, vis = true;
      for (; o; o = o.parent) if (!o.visible) { vis = false; break; }
      if (!vis) continue;
      const q = s.actor.object3D.getWorldPosition(new V3());
      if (keep(q)) figs.push({ p: q, H: bird ? 0.25 : animal ? 0.75 : 1.7 });
    }
  }
  for (const c of entry.crowds) if (c.shown && c.pos && keep(c.pos)) figs.push({ p: c.pos.clone(), H: 1.6 });
  return figs;
}
/** the choreo's drawn figures about the event's place (as the auto view takes them: within NEAR, else 2 × NEAR) */
function nearest(entry, at) {
  const f = drawn(entry, at, NEAR);
  return f.length || !at ? f : drawn(entry, at, 2 * NEAR);
}
async function look(ev, t) {
  time.set(t); await frames(2);
  // (a dynamic row as the UI has it at the click: refreshed at the clock's time)
  if (ev.dynamic) ev = S.byId(ev.id) || ev;
  const v = S.viewOf(ev);
  if (!v) return { ok: false, why: 'no view' };
  await ctx.player.goTo(v, 'instant');
  await frames(4);
  return v;
}
if (only === 'all' || only === 'watch') {
  const bad = [], rows = [];
  let checks = 0;
  for (const date of DATES) {
    time.setDate(date); await frames(3);
    const list = S.events.filter((ev) => !ev.dayTypes?.includes?.('occasional') && Number.isFinite(ev.t0) && ev.t1 !== ev.t0
      && ((ev.importance || 1) >= 2 || ev.choreo === 'private-offerings') && (!IDS || IDS.has(ev.id)));
    for (const ev of list) {
      const entry = rt.choreo(ev.choreo);
      const res = [];
      for (const k of WATCH_K) {
        const t = (ev.t0 + span(ev.t0, ev.t1) * k) % 1440;
        const v = await look(ev, t);
        checks++;
        // the figures about the event's place (a moving event's live view follows its own: all its choreo's figures);
        // an event of no figures (the nivreshet's flash) is its own place seen
        const live = !!S.hasLiveView?.(ev.id);
        const at = S.positionOf(ev);
        const r = v.ok === false ? v : !ev.participants?.length && at ? seen(W.objectOf(at))
          : entry ? seen(nearest(entry, live ? null : at)) : { ok: false, why: `no choreo "${ev.choreo}"` };
        res.push(`${time.format(t)} ${r.ok ? `ok ${r.frac} @${r.d}m` : `${r.why}${Number.isFinite(r.d) ? ` (${r.frac} @${r.d}m)` : ''}`}`);
        if (!r.ok) {
          bad.push({ date, id: ev.id, t: time.format(t), why: r.why, frac: r.frac, d: r.d, view: v.at ? `${v.at.map(r2).join(',')}|${v.heading ?? '-'}` : '-' });
          if (SHOTS) await shot(`views-${date}-${ev.id}-${time.format(t).replace(':', '')}`);
        }
      }
      rows.push(`${date} ${ev.id}: ${res.join(' · ')}`);
    }
    // G5's offerings in progress (weekdays): a few rows through the individuals' window, each its own figure
    const dyn = [];
    if (!IDS) for (let t = 0; t < 1440 && dyn.length < 10; t += 17) for (const ev of S.dynamic(t)) if (ev.id?.startsWith?.('offering:') && ev.pos && !dyn.some((x) => x.ev.id === ev.id)) { dyn.push({ ev, t }); break; }
    for (const { ev, t } of dyn) {
      const v = await look(ev, t);
      checks++;
      const row = S.byId(ev.id) || ev;
      const p = row.pos;
      const r = v.ok === false ? v : p ? seen([{ p: new V3(p[0] * AM, p[2] * AM, -p[1] * AM), H: 1.7 }]) : { ok: false, why: 'no pos' };
      rows.push(`${date} ${ev.id} (${row.step}): ${time.format(t)} ${r.ok ? `ok ${r.frac} @${r.d}m` : r.why}`);
      if (!r.ok) bad.push({ date, id: ev.id, step: row.step, t: time.format(t), why: r.why, frac: r.frac, d: r.d, view: v.at ? `${v.at.map(r2).join(',')}|${v.heading ?? '-'}` : '-' });
    }
  }
  out.watch = { checks, bad, rows };
}
const nBad = (out.stand?.bad.length || 0) + (out.watch?.bad.length || 0);
out.ok = nBad === 0;
log(JSON.stringify({ stand: out.stand?.bad, watch: out.watch?.bad }));
if (!out.ok) throw new Error(`views: ${nBad} failures\n${JSON.stringify({ stand: out.stand?.bad, watch: out.watch?.bad, rows: out.watch?.rows }, null, 1)}`);
return out;
