// The inspect core's acceptance (console-design §6.2 "B's acceptance tests"; docs/decisions/console-inspect.md):
//   A. cost    — 200 random screen points over a populated view: pick never throws; median ≤ 0.3 ms, p95 ≤ 0.5 ms (low)
//   B. picks   — every visible pooled figure in six sample views (morning tamid, rings, duchan, Nikanor, night watch,
//                Shabbat showbread) picks to its own ref when clicked at its projected chest (a figure hidden by
//                a collider or by a nearer figure is not counted; one that lands in alternatives counts as found)
//   C. describe — across t ∈ {d0.5, d2, d3, d5, d8, n1, n3} on a weekday, a Friday and a Shabbat: ≥ 90 % of the
//                visible pooled figures get a hook-provided doing (not the fallback); 100 % a role title and either
//                an eventId or "Between duties"/"Waiting"
//   D. content — every card kind renders (object, place, event, offering, term, role, crowd) with no throw
//   F. sky     — at the start, pitch 40°: picks into the sky return null; hover gives no tooltip or pointer
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/inspect.js "t=d3&inspect=1"   (?ip=A,B,C,D,F picks parts)
const I = ctx.inspect;
if (!I) throw new Error('no ctx.inspect (add &inspect=1 to the query)');
I.load(); await I.ready;
const raw = ctx.params?.raw;
const parts = new Set((raw?.get?.('ip') || 'A,B,C,D,F').split(','));
const out = {};
const fails = [];
const W = innerWidth, H = innerHeight;
const V3 = ctx.camera.position.constructor;
const r2 = (x) => Math.round(x * 1000) / 1000;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const settle = async (n = 6) => { await frames(n); };
async function view(date, t, at, look) {
  if (date && ctx.time.dateString !== date) { ctx.time.setDate(date); await sleep(200); }
  ctx.time.set(typeof t === 'string' ? ctx.time.parse(t) : t);
  ctx.time.pause(true);
  ctx.player.teleport({ at });
  ctx.player.setLook(look[0], look[1]);
  await settle(8);
}
// the plan job (shot mode plans at once) and the people's batches
await settle(10);

// ------------------------------------------------------------------------------------------------ A. cost
if (parts.has('A')) {
  await view('2026-11-02', 'sunrise+40', [214, 330, 16], [0, -6]);   // facing the slaughterhouse during the tamid
  const ms = [];
  let thrown = 0, hits = 0;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // (the page's clock is clamped to 0.1 ms: each point is picked 5 times and its time is the mean of the five)
  I.pick(W / 2, H / 2);
  for (let i = 0; i < 200; i++) {
    const x = rnd() * W, y = rnd() * H;
    const t0 = performance.now();
    try { for (let k = 0; k < 5; k++) { const h = I.pick(x, y); if (k === 0 && h) hits++; } } catch (e) { thrown++; if (thrown < 3) fails.push(`pick threw: ${e.message}`); }
    ms.push((performance.now() - t0) / 5);
  }
  out.cost = { n: 200, hits, thrown, median: r2(q(ms, 0.5)), p95: r2(q(ms, 0.95)), max: r2(Math.max(...ms)), figures: I.picker.figures().length };
  if (thrown) fails.push(`A: ${thrown} picks threw`);
  if (out.cost.median > 0.3) fails.push(`A: median ${out.cost.median} ms > 0.3`);
  if (out.cost.p95 > 0.5) fails.push(`A: p95 ${out.cost.p95} ms > 0.5`);
}

// ------------------------------------------------------------------------------------------------ B. picks
// each view: an event's window (k of the way through) seen from the schedule's own view of it
const VIEWS = [
  { name: 'morning tamid', date: '2026-11-02', ev: 'tamid-slaughter', k: 0.5, pitch: -10 },
  { name: 'rings', date: '2026-11-02', ev: 'private-offerings', k: 0.3, pitch: -12 },
  { name: 'duchan', date: '2026-11-02', ev: 'song-weekday', k: 0.5, pitch: -2 },
  { name: 'nikanor', date: '2026-11-02', ev: 'impure-east-gate', k: 0.5, pitch: -4 },
  { name: 'night watch', date: '2026-11-02', ev: 'moked-night', k: 0.5, pitch: -14 },
  { name: 'shabbat showbread', date: '2026-11-07', ev: 'showbread-swap', k: 0.5, pitch: -6 },
];
async function eventView(v) {
  if (ctx.time.dateString !== v.date) { ctx.time.setDate(v.date); await sleep(200); await settle(4); }
  const e = ctx.schedule.byId(v.ev);
  if (!e || !Number.isFinite(e.t0)) return false;
  const len = ((e.t1 - e.t0) % 1440 + 1440) % 1440;
  ctx.time.set(e.t0 + len * v.k); ctx.time.pause(true);
  await settle(4);
  const vw = ctx.schedule.viewOf(e);
  if (!vw) return false;
  ctx.player.teleport(vw);
  if (Number.isFinite(vw.heading)) ctx.player.setLook(vw.heading, v.pitch);
  await settle(8);
  return true;
}
async function figureTargets() {
  const cam = ctx.camera;
  const eye = new V3().setFromMatrixPosition(cam.matrixWorld);
  const list = [];
  for (const f of I.picker.figures()) {
    const a = f.slot.actor;
    const shape = ctx.people.pickShape(f.pool.spec.animal || a.role, a.poseName, a.scale);
    const p = a.object3D.position.clone();
    p.y += shape.type === 'capsule' ? Math.min(1.3, shape.h * 0.72) : shape.type === 'sphere' ? shape.y : shape.h * 0.6;
    const s = p.clone().project(cam);
    if (s.z > 1 || Math.abs(s.x) > 0.95 || Math.abs(s.y) > 0.95) continue;
    const d = p.distanceTo(eye);
    if (d > 60) continue;
    const dir = p.clone().sub(eye).normalize();
    const hit = ctx.physics.raycast(eye, dir, d);
    if (hit && hit.distance < d - 0.4) continue;            // behind a collider
    list.push({ f, x: (s.x + 1) / 2 * W, y: (1 - s.y) / 2 * H, d, ref: `actor:${f.entry.id}:${f.pool.name}:${f.index}` });
  }
  return list;
}
if (parts.has('B')) {
  out.picks = [];
  for (const v of VIEWS) {
    if (!(await eventView(v))) { out.picks.push({ view: v.name, skipped: 'no event or view today' }); continue; }
    const tg = await figureTargets();
    let top = 0, found = 0, blocked = 0;
    const miss = [];
    for (const g of tg) {
      const h = I.pick(g.x, g.y);
      if (h?.ref === g.ref) { top++; found++; continue; }
      if ((h?.alternatives || []).some((x) => x.ref === g.ref)) { found++; continue; }
      // a nearer figure covering its chest is a correct answer too
      if (h?.kind === 'person' || h?.kind === 'animal') { if (h.distance < g.d - 0.3) { blocked++; continue; } }
      miss.push(`${g.ref} → ${h?.ref || 'null'}`);
    }
    const n = tg.length - blocked;
    out.picks.push({ view: v.name, figures: tg.length, top, found, blocked, miss: miss.slice(0, 6) });
    if (n > 0 && found < n) fails.push(`B ${v.name}: ${n - found}/${n} figures not picked (${miss.slice(0, 3).join('; ')})`);
    if (raw?.get?.('ishots') === '1') await shot(`inspect-${v.name.replace(/\s+/g, '-')}`);
  }
}

// ------------------------------------------------------------------------------------------------ C. describe coverage
if (parts.has('C')) {
  const T = ['d0.5', 'd2', 'd3', 'd5', 'd8', 'n1', 'n3'];
  const D = [['weekday', '2026-11-02'], ['friday', '2026-11-06'], ['shabbat', '2026-11-07']];
  const rows = [];
  let all = 0, hooked = 0, titled = 0, anchored = 0;
  const byModule = {};
  const samples = [];
  const fallbackAt = {};
  for (const [dt, date] of D) {
    ctx.time.setDate(date); await sleep(150); await settle(4);
    for (const tq of T) {
      ctx.time.set(ctx.time.parse(tq)); ctx.time.pause(true);
      await settle(3);
      let n = 0, h = 0;
      for (const entry of ctx.schedule.runtime.entries) {
        for (const pool of entry.pools) {
          pool.slots.forEach((slot, i) => {
            if (!slot.shown || !slot.actor) return;
            n++;
            const card = I.describe(`actor:${entry.id}:${pool.name}:${i}`);
            const m = (byModule[entry.id] ||= { n: 0, hook: 0 });
            m.n++;
            if (card.hooked) { h++; m.hook++; } else (fallbackAt[`${entry.id}:${pool.name}`] ||= []).push(`${dt}/${tq}`);
            if (card.title?.en) titled++;
            const txt = card.now?.text?.en || '';
            if (card.now?.eventId || /Between duties|Waiting|Out of sight/.test(txt) || card.hooked) anchored++;
            if (samples.length < 40 && (i === 0)) samples.push(`${entry.id}/${pool.name}: ${card.title?.en} — ${txt}${card.subtitle ? ` (${card.subtitle.en})` : ''}`);
          });
        }
      }
      all += n; hooked += h;
      rows.push(`${dt} ${tq}: ${h}/${n}`);
    }
  }
  out.describe = { rows, all, hooked, pct: all ? r2(hooked / all) : 1, titled, anchored, byModule, fallback: Object.fromEntries(Object.entries(fallbackAt).slice(0, 20).map(([k, v]) => [k, v.length])), samples };
  if (all && hooked / all < 0.9) fails.push(`C: hook coverage ${(100 * hooked / all).toFixed(1)}% < 90%`);
  if (titled < all) fails.push(`C: ${all - titled} figures without a role title`);
  if (anchored < all) fails.push(`C: ${all - anchored} figures with neither an event nor "Between duties"`);
}

// ------------------------------------------------------------------------------------------------ D. cards of every kind
if (parts.has('D')) {
  ctx.time.setDate('2026-11-02'); await sleep(150);
  ctx.time.set(ctx.time.parse('sunrise+40')); await settle(4);
  const refs = ['el:altar.kiyor', 'el:heichal.menorah', 'el:azarah.gate.nikanor', 'el:en.shofarot', 'fire:altar.maarachah.great', 'el:mount.soreg.breaches',
    'zone:ezrat-nashim', 'zone:kodesh-hakodashim', 'event:tamid-slaughter', 'event:private-offerings', 'offering:olah', 'offering:yoledet', 'term:kiyor', 'term:mizbeach', 'role:kohen', 'role:levi'];
  const dyn = ctx.schedule.dynamic(ctx.time.t)[0];
  if (dyn) refs.push(`event:${dyn.id}`);
  const crowdEntry = ctx.schedule.runtime.entries.find((e) => e.crowds.some((c) => c.shown));
  if (crowdEntry) refs.push(`crowd:${crowdEntry.id}:${crowdEntry.crowds.findIndex((c) => c.shown)}`);
  out.cards = [];
  for (const r of refs) {
    try {
      const c = I.describe(r);
      out.cards.push({ ref: r, kind: c.kind, title: c.title?.en, now: c.now?.text?.en, what: c.what?.text?.en?.slice(0, 80), sources: c.sources?.length, actions: (c.actions || []).map((a) => a.label?.en) });
      if (!c.title?.en) fails.push(`D: ${r} has no title`);
    } catch (e) { fails.push(`D: ${r} threw ${e.message}`); }
  }
  // the card's NOW line is re-described at 4 Hz: one describe of a figure must be cheap
  const f0 = I.picker.figures()[0];
  if (f0) {
    const ref = `actor:${f0.entry.id}:${f0.pool.name}:${f0.index}`;
    const t0 = performance.now();
    for (let k = 0; k < 50; k++) I.describe(ref);
    out.describeMs = r2((performance.now() - t0) / 50);
    if (out.describeMs > 2) fails.push(`D: describe of a figure ${out.describeMs} ms > 2`);
  }
  out.nearby = I.nearby(15).map((x) => `${x.label.en} (${x.bearing.en})`).slice(0, 8);
  out.things = I.thingsIn('azarah').map((x) => x.title.en).slice(0, 12);
}

// ------------------------------------------------------------------------------------------------ E. every event's figures
// (?ip=E) for each event of each day type: the clock at its middle, every shown figure of its choreo described; a figure
// with no hook answer is a failure; one text per pool is kept for review
if (parts.has('E')) {
  const seen = {};
  let n = 0, unhooked = 0, threw = 0;
  for (const date of ['2026-11-02', '2026-11-06', '2026-11-07']) {
    ctx.time.setDate(date); await sleep(150); await settle(3);
    for (const ev of ctx.schedule.events) {
      if (!Number.isFinite(ev.t0) || ev.dayTypes?.includes?.('occasional')) continue;
      const e = ctx.schedule.runtime.choreo(ev.choreo);
      if (!e) continue;
      const len = ((ev.t1 - ev.t0) % 1440 + 1440) % 1440;
      ctx.time.set(ev.t0 + len * 0.5); ctx.time.pause(true);
      const p = ctx.schedule.positionOf(ev);
      if (p) ctx.player.teleport(p.clone());
      await settle(3);
      for (const pool of e.pools) {
        pool.slots.forEach((slot, i) => {
          if (!slot.shown || !slot.actor) return;
          n++;
          let card;
          try { card = I.describe(`actor:${e.id}:${pool.name}:${i}`); } catch (err) { threw++; fails.push(`E: ${e.id}/${pool.name} threw ${err.message}`); return; }
          if (!card.hooked) unhooked++;
          const k = `${e.id}/${pool.name}`;
          (seen[k] ||= new Set()).add(`${ev.id}: ${card.now?.text?.en} [${card.subtitle?.en || '-'}]`);
        });
      }
    }
  }
  out.events = { n, unhooked, threw, texts: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v].slice(0, 6)])) };
  if (unhooked) fails.push(`E: ${unhooked}/${n} figures without a hook answer`);
}

// ------------------------------------------------------------------------------------------------ F. the sky
// gatefix-B: a ray that hits nothing (hitDist = Infinity) once picked any lit fire on the Mount. At the start, pitch 40°:
// the centre and the upper half pick nothing, and hover gives no tooltip and no pointer cursor
if (parts.has('F')) {
  ctx.time.setDate('2026-11-02'); await sleep(150);
  ctx.time.set(ctx.time.parse('sunrise-20')); ctx.time.pause(true);
  ctx.player.teleport('start');
  ctx.player.setLook(279, 40);
  await settle(8);
  const lit = [...(ctx.fx?.fires?.values?.() || [])].filter((f) => f.cur > 0.05).length;
  const pts = [[W / 2, H / 2], [W * 0.2, H * 0.1], [W * 0.5, H * 0.25], [W * 0.8, H * 0.4]];
  const got = pts.map(([x, y]) => I.pick(x, y)?.ref || null);
  const c = I.pickCenter()?.ref || null;
  await sleep(350);                                       // past the hover cache (3 × 100 ms when still)
  const hov = I.hover(W / 2, H / 2)?.ref || null;
  // the console's pick layer (when mounted): a mouse move over the sky leaves the tooltip and the cursor off
  const canvas = ctx.renderer?.domElement;
  const tip = document.querySelector('.mk-ptip');
  let ui = 'no pick layer';
  if (canvas && tip) {
    canvas.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: W / 2, clientY: H / 2, bubbles: true }));
    await sleep(300); await settle(4);
    ui = { cursor: canvas.style.cursor || '', tip: tip.classList.contains('in') };
    if (ui.cursor === 'pointer' || ui.tip) fails.push(`F: hover over the sky shows ${ui.tip ? 'a tooltip' : ''}${ui.cursor === 'pointer' ? ' a pointer cursor' : ''}`);
  }
  out.sky = { lit, picks: got, center: c, hover: hov, ui };
  if (!lit) fails.push('F: no lit fire (the test needs one to be meaningful)');
  got.forEach((r, i) => { if (r) fails.push(`F: sky pick at (${pts[i].map(Math.round)}) → ${r}`); });
  if (c) fails.push(`F: pickCenter at the sky → ${c}`);
  if (hov) fails.push(`F: hover at the sky → ${hov}`);
}

out.fails = fails;
if (fails.length) throw new Error(`inspect: ${fails.length} failures\n${fails.join('\n')}\n${JSON.stringify(out, null, 1)}`);
return out;
