// Travel acceptance (docs/console-design.md §6.3.1, AC-11, AC-12): trips at every way and pace over six routes, stepped
// by hand on a virtual 60 Hz clock (ctx.player._hold / _tick), so the walk is measured in walking time whatever the
// machine's frame rate. Checks per trip: arrival; no tunnelling (the body never inside a collider; no straight step
// passes through one); the walk to the stand takes the 1× walk's time / pace within ±15 % for paces ≤ 5 (the absolute
// ratio to length / (m/s · pace) is reported: the walker slows on stairs, newel stairs and turns by design); the
// travel:zone sequence equals an offline sample of the planned path (every 0.25 m, runs under 1 m merged), with no place
// twice in a row, and agrees with where the feet went (every place announced was stood in, in order; every place
// walked through for 1.5 m or more was announced). Then: looking around never cancels and the view returns to the look-ahead within 3.5 s; W cancels; E no longer
// rises and Space does; setPace / setWay / finishTrip and their events; the frame cost at 10× (12 sub-steps).
//   node src/player/dev/triptest.mjs            (= node src/sim/dev/run.mjs --q low --script src/player/dev/trip.js "t=d3")
// URL extras: &troutes=chel-mizbeach,… · &tways=walk,run · &tpaces=0.5,1,2,5,10 · &tparts=trips,look,keys,input,api,cost
const q = new URLSearchParams(location.search);
const { mergeRuns, makeRoute, routeZones } = await import('/src/player/trip.js');
const P = ctx.player, bus = ctx.bus, ph = ctx.physics;
await ctx.nav.ready;
const DT = 1 / 60;
const r2 = (v) => Math.round(v * 100) / 100;
const ROUTES = {
  'chel-mizbeach': [[407, 312, 0], [217, 309, 25]],               // the Chel steps → the top of the Mizbeach (the kevesh)
  'chuldah-taimroofs': [[165, 20, -27.083333], [105, 309.5, 55]],  // Chuldah → the ta'im roofs (the Heichal's roof stairs)
  'upper-chamber': [[229, 292, 16], [140, 330.5, 67]],           // the Azarah → the Aliyah (the mesibah)
  tunnel: [[207, 404.5, 16], [203, 458, -12]],                    // Beit HaMoked → Beit HaTevilah (the winding stair, the passage)
  climb: [[105, 309.5, 55], [170, 330.5, 112]],                   // the ta'im roofs → the roof of the Heichal (the cedar posts)
  'fifteen-steps': [[345, 330.5, 6], [257.5, 330.5, 13.5]],       // Ezrat Nashim → Sha'ar Nikanor (the 15 steps)
};
const routes = (q.get('troutes') || Object.keys(ROUTES).join(',')).split(',');
const ways = (q.get('tways') || 'walk,run').split(',');
const paces = (q.get('tpaces') || '0.5,1,2,5,10').split(',').map(Number);
const parts = new Set((q.get('tparts') || 'trips,look,keys,input,api,cost').split(','));

const log = [];
const NAMES = ['travel:start', 'travel:progress', 'travel:pace', 'travel:zone', 'travel:end', 'player:intent', 'player:inspect', 'player:tap'];
for (const n of NAMES) bus.on(n, (e) => log.push([n, e]));
const since = (i, n) => log.slice(i).filter((x) => x[0] === n).map((x) => x[1]);

P._hold = true;
const tick = (dt = DT) => P._tick(dt);
const yieldFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function place(at, heading = 270) {
  P.cancel();
  P.setMode('walk');
  P.teleport({ at });
  P.setLook(heading, 0);
  for (let i = 0; i < 5; i++) tick();
}

/** run one trip on the virtual clock; per-tick checks; returns the measurements */
async function trip(name, way, pace, { maxS = 1500, onTick = null } = {}) {
  const [from, to] = ROUTES[name];
  place(from);
  const i0 = log.length;
  let fin = null;
  P.goTo({ at: to }, { way, pace, label: name }).then((v) => { fin = v; });
  const start = since(i0, 'travel:start')[0];
  // the planned path, sampled offline (finer than the live 0.5 m; vertical segments, the climb, are not on a floor)
  let offline = null;
  let vt = 0, n = 0, inside = 0, through = 0, maxStep = 0, walkT = null;
  const prev = P.position.clone();
  const feet = [];  // [s, zone] every 0.25 m walked
  let walked = 0, lastSample = -1;
  const o = new prev.constructor(), d = new prev.constructor();
  while (fin === null && vt < maxS) {
    tick(); vt += DT; n++;
    const f = P.position, step = f.distanceTo(prev);
    maxStep = Math.max(maxStep, step);
    if (!offline && P.path && P.trip?.zones?.length) {
      const pts = P.path, air = pts.slice(1).map((p, k) => Math.abs(p.y - pts[k].y) > Math.hypot(p.x - pts[k].x, p.z - pts[k].z));
      offline = routeZones(makeRoute(pts, air), (p) => ctx.zones.at(p), { step: 0.25, snap: (p) => ph.nearestFloor(p.x, p.z, p.y) }).map((r) => r.zone);
    }
    if (walkT === null && P.trip && P.trip.remaining <= 0.05 && P.trip.total > 0) walkT = vt;
    // a continuous step (not a teleport, a nudge or the climb): never into or through a collider (two nearby columns
    // agree: a column exactly on a face edge can count it twice)
    if (step > 1e-4 && step < 1.0 && !P._flying()) {
      if (ph.insideAt(f.x, f.y + 0.9, f.z) && ph.insideAt(f.x + 0.013, f.y + 0.9, f.z - 0.017)) inside++;
      o.set(prev.x, prev.y + 0.6, prev.z); d.set(f.x - prev.x, f.y - prev.y, f.z - prev.z);
      const L = d.length();
      if (L > 1e-3 && ph.raycast(o, d.normalize(), L)) through++;
    }
    if (step < 1.0) walked += step;
    if (walked - lastSample >= 0.25 || lastSample < 0) { lastSample = walked; feet.push([walked, ctx.zones.at(f)]); }
    prev.copy(f);
    onTick?.(vt);
    if (n % 240 === 0) await yieldFrame();
    await null;
  }
  feet.push([walked, ctx.zones.at(P.position)]);
  const zones = since(i0, 'travel:zone');
  const end = since(i0, 'travel:end')[0];
  const emitted = zones.filter((z) => !z.final).map((z) => z.zone);
  // the places the feet crossed: runs over the walked distance, runs under 1 m merged (as the route's are)
  const raw = [];
  for (const [s, z] of feet) { const l = raw[raw.length - 1]; if (l && l.zone === z) l.s1 = s; else raw.push({ zone: z, s0: l ? l.s1 : 0, s1: s }); }
  const stood = raw.map((r) => r.zone);
  const walkedLong = mergeRuns(raw, 1.0, 1).filter((r, i) => i > 0 && r.s1 - r.s0 >= 1.5).map((r) => r.zone);
  // a ⊑ b: a is b with some items left out, in order
  const sub = (a, b) => { let j = 0; for (const x of a) { while (j < b.length && b[j] !== x) j++; if (j++ >= b.length) return false; } return true; };
  let twice = 0;
  for (let i = 1; i < emitted.length; i++) if (emitted[i] === emitted[i - 1]) twice++;
  const off = (offline || []).slice(1);
  const mps = start?.mps || 1, total = start?.distance || 0;
  const ideal = total / (mps * pace);
  return {
    ok: fin === true, reason: end?.reason, vt: r2(vt), walkT: walkT === null ? null : r2(walkT), total: r2(total), ideal: r2(ideal), ratio: ideal && walkT ? r2(walkT / ideal) : null,
    inside, through, maxStep: r2(maxStep), emitted, offline: off, sameZones: JSON.stringify(emitted) === JSON.stringify(off),
    feetAgree: sub(emitted, stood) && sub(walkedLong, emitted), walkedLong, twice,
    final: zones.filter((z) => z.final).map((z) => z.zone), startZones: start?.zones?.length ?? 0,
    progress: since(i0, 'travel:progress').length,
  };
}

const out = {};

if (parts.has('trips')) {
  out.trips = {};
  const fails = [];
  for (const name of routes) {
    for (const way of ways) {
      // the 1× walk first: the other paces are timed against it
      const order = [...paces].sort((a, b) => (a === 1 ? -1 : b === 1 ? 1 : a - b));
      let base = null;
      for (const pace of order) {
        const r = await trip(name, way, pace);
        out.trips[`${name} ${way} ${pace}`] = r;
        if (pace === 1) base = r.walkT;
        r.rel = base && r.walkT ? r2((r.walkT * pace) / base) : null;
        const bad = [];
        if (!r.ok) bad.push(`not arrived (${r.reason})`);
        if (r.inside || r.through) bad.push(`tunnel inside ${r.inside} through ${r.through}`);
        if (pace <= 5 && r.rel !== null && (r.rel < 0.85 || r.rel > 1.15)) bad.push(`time ×${r.rel} of 1×/pace`);
        if (!r.sameZones) bad.push(`zones ${JSON.stringify(r.emitted)} ≠ offline ${JSON.stringify(r.offline)}`);
        if (!r.feetAgree) bad.push(`zones ${JSON.stringify(r.emitted)} vs feet (long runs ${JSON.stringify(r.walkedLong)})`);
        if (r.twice) bad.push('a place twice in a row');
        if (bad.length) fails.push(`${name} ${way} ${pace}×: ${bad.join('; ')}`);
        log.length = 0;
      }
    }
  }
  out.tripFails = fails;
}

if (parts.has('look')) {
  // drag look (no pointer lock headless): a look offsets the view and never cancels; the view returns ≤ 3.5 s after
  const canvas = ctx.renderer.domElement;
  place(ROUTES['chel-mizbeach'][0]);
  const i0 = log.length;
  let fin = null;
  P.goTo({ at: ROUTES['chel-mizbeach'][1] }, { way: 'walk', pace: 1 }).then((v) => { fin = v; });
  for (let i = 0; i < 240; i++) tick();
  const before = P.heading;
  canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', button: 0, buttons: 1, clientX: 400, clientY: 300, bubbles: true }));
  for (let k = 0; k < 10; k++) { document.dispatchEvent(new MouseEvent('mousemove', { buttons: 1, movementX: 40, movementY: 0, bubbles: true })); tick(); }
  window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', button: 0, clientX: 800, clientY: 300, bubbles: true }));
  const lookedBy = ((P.heading - before + 540) % 360) - 180;
  // the view's offset from the walker's own heading (deg)
  const cs = () => Math.abs(((P.heading - P._walkerHeading() + 540) % 360) - 180);
  const offAfterLook = r2(cs());
  let back = null, vt = 0;
  while (vt < 6 && fin === null) { tick(); vt += DT; if (back === null && cs() < 0.5) back = r2(vt); }
  const ended = since(i0, 'travel:end')[0] || null;
  // W stops the trip
  const i1 = log.length;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
  tick();
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));
  const wEnd = since(i1, 'travel:end')[0] || null;
  out.look = {
    lookedBy: r2(lookedBy), offAfterLook, notCancelledByLook: !ended, backAfter: back, backOk: back !== null && back <= 3.5,
    intents: since(i0, 'player:intent').map((e) => e.kind), wCancels: wEnd?.reason === 'cancelled',
  };
  for (let i = 0; i < 30; i++) tick();
}

if (parts.has('keys')) {
  // E inspects and no longer rises (fly mode); Space still rises
  place(ROUTES['fifteen-steps'][0]);
  P.setMode('fly');
  for (let i = 0; i < 10; i++) tick();
  const i0 = log.length;
  const y0 = P.position.y;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
  for (let i = 0; i < 60; i++) tick();
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }));
  const yE = P.position.y;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
  for (let i = 0; i < 60; i++) tick();
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
  const yS = P.position.y;
  out.keys = { eRise: r2(yE - y0), spaceRise: r2(yS - yE), inspect: since(i0, 'player:inspect'), ok: Math.abs(yE - y0) < 0.01 && yS - yE > 0.5 && since(i0, 'player:inspect').length === 1 };
  P.setMode('walk');
  for (let i = 0; i < 30; i++) tick();
}

if (parts.has('input')) {
  // Gamepad hand-over: the Menu takes the pad (pad: false), B closes it (pad: true again) while still held: that B is not
  // a new press, so the walk goes on; a fresh B afterwards still stops it. In fly mode a held-over A does not rise.
  const btn = () => ({ pressed: false, value: 0 });
  const pad = { id: 'Xbox standard (stub)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
  const getPads = navigator.getGamepads;
  navigator.getGamepads = () => [pad];
  window.dispatchEvent(new Event('gamepadconnected'));
  const press = (i, on) => { pad.buttons[i].pressed = on; pad.buttons[i].value = on ? 1 : 0; };
  place(ROUTES['fifteen-steps'][0]);
  const i0 = log.length;
  P.goTo({ at: ROUTES['fifteen-steps'][1] }, { way: 'walk', pace: 1 });
  for (let i = 0; i < 60; i++) tick();
  P.setInputEnabled({ pad: false });                 // the Menu opens and polls the pad
  for (let i = 0; i < 10; i++) tick();
  press(1, true); tick();                            // B: the player (pad off) sees it held …
  P.setInputEnabled({ pad: true });                  // … the Menu closes on B's press edge
  for (let i = 0; i < 8; i++) tick();                // B held (≈ 120 ms)
  press(1, false);
  for (let i = 0; i < 30; i++) tick();
  const afterClose = since(i0, 'travel:end')[0] || null;
  // the same with no player frame between the press and the hand-over (the UI first in the frame)
  P.setInputEnabled({ pad: false });
  tick();
  press(1, true);
  P.setInputEnabled({ pad: true });
  for (let i = 0; i < 8; i++) tick();
  press(1, false);
  for (let i = 0; i < 10; i++) tick();
  const afterClose2 = since(i0, 'travel:end')[0] || null;
  press(1, true); for (let i = 0; i < 4; i++) tick(); press(1, false); tick();
  const freshB = since(i0, 'travel:end')[0] || null;
  P.setMode('fly');
  for (let i = 0; i < 10; i++) tick();
  P.setInputEnabled({ pad: false });
  press(0, true); tick();
  P.setInputEnabled({ pad: true });
  const yA0 = P.position.y;
  for (let i = 0; i < 30; i++) tick();
  const heldRise = P.position.y - yA0;
  press(0, false); tick();
  press(0, true);
  const yA1 = P.position.y;
  for (let i = 0; i < 30; i++) tick();
  const freshRise = P.position.y - yA1;
  press(0, false); tick();
  P.setMode('walk');
  navigator.getGamepads = getPads;
  window.dispatchEvent(new Event('gamepaddisconnected'));
  out.pad = {
    afterClose, afterClose2, freshB, heldRise: r2(heldRise), freshRise: r2(freshRise),
    ok: !afterClose && !afterClose2 && freshB?.reason === 'cancelled' && Math.abs(heldRise) < 0.01 && freshRise > 0.3,
  };
  for (let i = 0; i < 10; i++) tick();

  // Touch taps are timed by the events' timestamps: a 40 ms tap whose pointerup is read after a 400 ms stall is still a
  // tap, and the stall does not make it a joystick (left zone, a player frame inside the stall). A still hold of
  // > 300 ms is not a tap.
  const canvas = ctx.renderer.domElement;
  const busy = (ms) => { const e = performance.now() + ms; while (performance.now() < e) { /* a long frame */ } };
  const touch = (type, x, y, id) => new PointerEvent(type, { pointerType: 'touch', pointerId: id, isPrimary: true, clientX: x, clientY: y, bubbles: true });
  const taps = () => since(i1, 'player:tap').length;
  const i1 = log.length;
  const lx = innerWidth * 0.2, ly = innerHeight * 0.6, rx = innerWidth * 0.75, ry = innerHeight * 0.3;
  const stalled = (x, y, id) => {
    canvas.dispatchEvent(touch('pointerdown', x, y, id));
    tick();
    busy(40);
    const up = touch('pointerup', x, y, id);           // the finger lifts at 40 ms …
    busy(400);                                        // … during a 400 ms stall
    tick();                                           // a player frame runs before the pointerup is read
    canvas.dispatchEvent(up);
  };
  stalled(rx, ry, 71);
  const tapRight = taps();
  stalled(lx, ly, 72);
  const tapLeft = taps() - tapRight;
  // a real hold on the left becomes the joystick and is not a tap
  canvas.dispatchEvent(touch('pointerdown', lx, ly, 73));
  for (let k = 0; k < 8; k++) { tick(); await new Promise((r) => setTimeout(r, 50)); }
  canvas.dispatchEvent(touch('pointerup', lx, ly, 73));
  const holdTap = taps() - tapRight - tapLeft;
  out.touch = { tapRight, tapLeft, holdTap, ok: tapRight === 1 && tapLeft === 1 && holdTap === 0 };
  for (let i = 0; i < 10; i++) tick();
}

if (parts.has('api')) {
  // setPace / setWay mid-trip (travel:pace), the trip snapshot, finishTrip (skipped), a superseded trip
  place(ROUTES['chel-mizbeach'][0]);
  const i0 = log.length;
  let fin = null;
  P.goTo({ at: ROUTES['chel-mizbeach'][1] }, { way: 'walk', pace: 1, label: { en: 'the Mizbeach' } }).then((v) => { fin = v; });
  for (let i = 0; i < 120; i++) tick();
  const p2 = P.setPace(2), p99 = P.setPace(99);
  P.setWay('run');
  const snap = P.trip;
  for (let i = 0; i < 60; i++) tick();
  const skipped = await P.finishTrip();
  const end1 = since(i0, 'travel:end');
  const i1 = log.length;
  place(ROUTES['fifteen-steps'][0]);
  P.goTo({ at: ROUTES['fifteen-steps'][1] }, 'walk');
  for (let i = 0; i < 30; i++) tick();
  P.goTo({ at: ROUTES['fifteen-steps'][0] }, { way: 'instant' });
  for (let i = 0; i < 30; i++) tick();
  await null;
  const end2 = since(i1, 'travel:end');
  out.api = {
    p2, p99, paceEvents: since(i0, 'travel:pace'), snap: snap && { id: snap.id, label: snap.label, way: snap.way, pace: snap.pace, total: r2(snap.total), zones: snap.zones.length, eta: r2(snap.eta) },
    skipped, fin, end1, end2: end2.map((e) => e.reason),
    ok: p2 === 2 && p99 === 10 && skipped === true && end1[0]?.reason === 'skipped' && end2.join() !== '' && end2[0].reason === 'superseded' && end2[1]?.reason === 'arrived',
  };
}

if (parts.has('cost')) {
  // the player's frame at 10× run with the sub-step cap binding (dt 1/40 s: 12 steps)
  place(ROUTES['chel-mizbeach'][0]);
  let fin = null;
  P.goTo({ at: ROUTES['chel-mizbeach'][1] }, { way: 'run', pace: 10 }).then((v) => { fin = v; });
  for (let i = 0; i < 20; i++) tick(1 / 40);
  const ms = [];
  for (let i = 0; i < 400 && fin === null; i++) {
    const t0 = performance.now();
    tick(1 / 40);
    ms.push(performance.now() - t0);
    if (i % 60 === 0) await yieldFrame();
  }
  ms.sort((a, b) => a - b);
  const pct = (p) => r2(ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] || 0);
  out.cost = { frames: ms.length, median: pct(0.5), p95: pct(0.95), max: pct(1), effectivePace: r2(P.trip?.effectivePace ?? NaN) };
}

P._hold = false;
return out;
