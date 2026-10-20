// Node-side check of the G1 night plan (no browser): builds the plan for the three day types from site.js and
// schedule.js with a simple zmanim resolver, and reports every person's episodes and the plan's invariants:
//   - floor: every sleeping / sitting spot in Beit HaMoked inside the chol floor, clear of the hearth (body ≥ 1.85,
//     head ≥ 2.75 amot from its centre), the chel door's leaf sweeps, the lamp stand; no two footprints (mat + cover)
//     that are occupied at the same time intersect (the minimum clearance is printed);
//   - walkers: nobody walking in the hall passes within WALKER_R of a sleeping or sitting body at that moment;
//   - stair: nobody comes up the winding stair while another goes down;
//   - views: who is in the event's view through dawn-immersion, mesibah-keri, late-turning and night-turning;
//   - continuity: a figure staged by a relevant module never jumps (> 2.6 m/s), and appears / vanishes only where
//     listed (doors, gates, hand-overs) — sampled every 0.02 min round the whole day, across the 24:00 wrap;
//   - fast walks and overlapping episodes.
//   node src/sim/choreo/g1/dev/plan-check.mjs [weekday|friday|shabbat|all] [--legs person] [--map] [--at HH:MM]
import { SITE } from '../../../../data/site.js';
import { EVENTS } from '../../../../data/schedule.js';
import { nightPlan } from '../plan.js';
import { personAt } from '../util.js';
import { footprint } from '../places.js';
import { AMAH } from '../../../../core/units.js';
import mokedNight from '../../moked-night.js';
import altarNight from '../../altar-night.js';
import lotteries from '../../lotteries.js';
import torchInspection from '../../torch-inspection.js';

const ZM = {   // 2026-11-02-ish (Jerusalem), minutes
  weekday: { alot: 283, sunrise: 356, sunset: 1007, tzeit: 1044, midnight: 1402, shaahDay: 54.25, shaahNight: 65.75 },
  friday: { alot: 286, sunrise: 359, sunset: 1005, tzeit: 1042, midnight: 1402, shaahDay: 53.8, shaahNight: 66.2 },
  shabbat: { alot: 286, sunrise: 360, sunset: 1005, tzeit: 1042, midnight: 1403, shaahDay: 53.72, shaahNight: 66.28 },
};
const DAY = 1440, WALKER_R = 0.3;
const wrap = (t) => ((t % DAY) + DAY) % DAY;
const fmt = (t) => { const w = wrap(t); return `${String(Math.floor(w / 60)).padStart(2, '0')}:${String(Math.floor(w % 60)).padStart(2, '0')}:${String(Math.round((w % 1) * 60) % 60).padStart(2, '0')}`; };

function makeCtx(dayType) {
  const z = ZM[dayType];
  const resolve = (s) => {
    if (s.at) return wrap(z[s.at] + (s.offset || 0));
    if (s.dayHour != null) return wrap(z.sunrise + s.dayHour * z.shaahDay);
    if (s.nightHour != null) return wrap(z.sunset + s.nightHour * z.shaahNight);
    if (s.clock) { const [h, m, sec] = s.clock.split(':').map(Number); return h * 60 + m + (sec || 0) / 60; }
    return NaN;
  };
  const events = EVENTS.filter((e) => !e.dayTypes || e.dayTypes.includes(dayType)).map((e) => ({ ...e, t0: resolve(e.when.start), t1: resolve(e.when.end) }));
  const byId = new Map(events.map((e) => [e.id, e]));
  const ctx = {
    el: (id) => { const e = SITE.elements[id]; if (!e) throw new Error(`no element ${id}`); return e; },
    elOpt: (id) => SITE.elements[id] || null,
    time: { zmanim: z, dayType },
  };
  const sim = { generation: Math.random(), schedule: { byId: (id) => byId.get(id) || null, events } };
  return { ctx, sim, events };
}

// ------------------------------------------------------------------------------------------------- geometry
const segPt = (a, b, p) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-9; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]); };
const inside = (P, p) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const ptPoly = (P, p) => (inside(P, p) ? -1 : Math.min(...P.map((a, i) => segPt(a, P[(i + 1) % P.length], p))));
const cross = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
const polyPoly = (A, B) => {
  for (const p of A) if (inside(B, p)) return -1;
  for (const p of B) if (inside(A, p)) return -1;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (cross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return -1;
  let d = Infinity; for (const p of A) d = Math.min(d, ptPoly(B, p)); for (const p of B) d = Math.min(d, ptPoly(A, p)); return d;
};

/** a leg's site position at local minutes */
const _q = {};
function posAt(leg, local) {
  if (leg.kind === 'hold') return leg.at;
  if (leg.kind === 'walk') { const k = Math.max(0, Math.min(1, local / (leg.dur || 1e-6))); const q = leg.path.sample(leg.d0 + (leg.d1 - leg.d0) * k, _q); return [q.X, q.Y, q.Z]; }
  if (leg.kind === 'follow') {
    const tl = leg.tl, t = leg.t0abs + local;
    let i = 0; while (i + 1 < tl.tS.length && tl.tS[i + 1] <= t) i++;
    const D = tl.dS[i] + tl.vS[i] * Math.max(0, t - tl.tS[i]);
    const q = tl.path.sample(Math.max(0, Math.min(tl.L, D) - leg.off), _q); return [q.X, q.Y, q.Z];
  }
  return null;
}

// ------------------------------------------------------------------------------------------------- one day type
function check(which, opts) {
  const { ctx, sim, events } = makeCtx(which);
  const P = nightPlan(ctx, sim);
  const T = P.T, M = P.M;
  const out = [], issues = [];
  out.push(`${which}: lock ${fmt(T.lock[0])}–${fmt(T.lock[1])} imm ${fmt(T.imm[0])} knock ${fmt(T.knock[0])} first ${fmt(T.first[0])} insp ${fmt(T.insp[0])}–${fmt(T.insp[1])} handG2 ${fmt(T.handG2)} eve ${T.eve ? `${T.eve.id} ${fmt(T.eve.t0)}–${fmt(T.eve.t1)}` : '-'} late ${T.late ? fmt(T.late[0]) : '-'} nightTurn ${T.nightTurn ? fmt(T.nightTurn[1]) : '-'} keri ${T.keri ? `${fmt(T.keri[0])}–${fmt(T.keri[1])}` : '-'}`);
  out.push(`meet ${fmt(P.meet.t)} · y0 hand ${fmt(P.altar.y0hand)} · imm F ${P.imm.F.toFixed(2)} D ${P.imm.D.toFixed(2)} · arrive ${Object.entries(P.imm.a).map(([k, v]) => `${k} ${fmt(v)}`).join(' ')} · rise ${Object.entries(P.rise).map(([k, v]) => `${k} ${fmt(v)}`).join(' ')}`);
  const people = [];
  for (const [k, v] of Object.entries(P.people)) { if (Array.isArray(v)) v.forEach((p, i) => people.push([`${k}${i}`, p])); else people.push([k, v]); }

  // ---- module relevance (the runtime's rule: an event of the module within [t0 − lead, t1 + lag))
  const MODS = { moked: mokedNight, altar: altarNight, lot: lotteries, insp: torchInspection };
  const evOf = (mod) => events.filter((e) => [mod.id, ...(mod.aliases || [])].includes(e.choreo) && Number.isFinite(e.t0));
  const near = (t, a, b, lead, lag) => { const L = wrap(b - a) + lead + lag; return wrap(t - (a - lead)) < L; };
  const relevant = Object.fromEntries(Object.entries(MODS).map(([o, mod]) => { const evs = evOf(mod); return [o, (t) => evs.some((e) => near(t, e.t0, e.t1, mod.lead ?? 2, mod.lag ?? 2))]; }));

  // ---- episodes, fast walks
  const r = {};
  for (const [name, p] of people) {
    out.push(`  ${name.padEnd(9)} ${p.pool}#${p.idx} eps: ${p.eps.map((e) => `${fmt(e.S)}+${e.total.toFixed(1)}`).join(' | ')}`);
    for (const e of p.eps) for (const l of e.legs) {
      if (!(l.dur >= 0)) issues.push(`${name}: bad leg dur ${l.dur}`);
      if (l.kind === 'walk' && l.dur > 0 && l.len / (l.dur * 60) > 2.6) issues.push(`${name}: fast walk ${(l.len / (l.dur * 60)).toFixed(2)} m/s at ${fmt(e.S)} (${l.owner})`);
    }
    if (opts.legs === name) {
      for (const e of p.eps) {
        let u = e.S;
        for (const l of e.legs) {
          const at = l.kind === 'walk' ? `${l.path.points[0].X.toFixed(1)},${l.path.points[0].Y.toFixed(1)}→${l.path.points.at(-1).X.toFixed(1)},${l.path.points.at(-1).Y.toFixed(1)} ${(l.len / (l.dur * 60)).toFixed(2)}m/s` : l.kind === 'follow' ? `follow off ${l.off}` : `${l.at[0].toFixed(2)},${l.at[1].toFixed(2)},${l.at[2]} h${Math.round(l.h)}`;
          out.push(`     ${fmt(u)} ${l.dur.toFixed(2).padStart(6)} ${l.owner.padEnd(5)} ${l.role.padEnd(5)} ${l.kind.padEnd(6)} ${(l.pose || '').padEnd(16)} ${(l.prop || (l.props || []).join('+') || '').padEnd(15)} ${at}`);
          u += l.dur;
        }
      }
    }
  }

  // ---- the floor: every lying / sitting leg in the hall (a hold of ≥ 0.3 min), with its absolute span
  const inHall = (p) => p && p[0] > M.i.min[0] - 0.01 && p[0] < M.i.max[0] + 0.01 && p[1] > M.i.min[1] && p[1] < M.i.max[1] && Math.abs((p[2] ?? M.Z) - M.Z) < 2;
  const K = M.keep;
  const rest = [];
  for (const [name, p] of people) for (const e of p.eps) {
    let u = e.S;
    for (const l of e.legs) {
      if (l.kind === 'hold' && ['sleep', 'lie', 'kneel'].includes(l.pose) && l.dur >= 0.3 && inHall(l.at) && l.owner !== 'none') {
        const pose = l.pose === 'lie' && p.pool === 'elders' ? 'lie_bare' : l.pose;
        rest.push({ name, pose, at: l.at, h: l.h, t0: u, t1: u + l.dur, fp: footprint(pose, l.at, l.h), body: footprint(pose, l.at, l.h, 'body') });
      }
      u += l.dur;
    }
  }
  const spots = new Map();
  for (const s of rest) { const k = `${s.name}@${s.at.map((v) => v.toFixed(2)).join(',')}h${Math.round(s.h)}${s.pose}`; if (!spots.has(k)) spots.set(k, s); }
  let minGap = Infinity, minPair = '';
  for (const s of spots.values()) {
    if (s.at[2] > M.Z + 0.1) continue;                     // on the ledges (elders)
    const F = s.fp;
    for (const p of F.pts) if (!K.floor(p[0], p[1])) issues.push(`floor: ${s.name} ${s.pose} at ${s.at.map((v) => v.toFixed(2))} corner ${p.map((v) => v.toFixed(2))} off the chol floor`);
    const dh = ptPoly(s.body.pts, M.hearth), dhd = Math.hypot(F.head[0] - M.hearth[0], F.head[1] - M.hearth[1]);
    if (dh < K.bodyR) issues.push(`hearth: ${s.name} ${s.pose} body ${dh.toFixed(2)} < ${K.bodyR}`);
    if (s.pose !== 'kneel' && dhd < K.headR) issues.push(`hearth: ${s.name} head ${dhd.toFixed(2)} < ${K.headR}`);
    for (const hg of K.leaves) { const d = ptPoly(F.pts, hg); if (d < K.leafR) issues.push(`leaf: ${s.name} ${s.pose} ${d.toFixed(2)} from a chel-door hinge (< ${K.leafR})`); }
    const dl = ptPoly(F.pts, K.lamp);
    if (dl < K.lampR) issues.push(`lamp: ${s.name} ${dl.toFixed(2)}`);
  }
  const span2 = (a, b) => a.t0 < b.t1 && b.t0 < a.t1;
  for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) {
    const a = rest[i], b = rest[j];
    if (a.name === b.name || !span2(a, b)) continue;
    if (Math.abs(a.at[2] - b.at[2]) > 0.3) continue;
    const g = polyPoly(a.fp.pts, b.fp.pts);
    if (g < minGap) { minGap = g; minPair = `${a.name}/${b.name} at ${fmt(Math.max(a.t0, b.t0))}`; }
    if (g < 0.05) issues.push(`overlap: ${a.name} ${a.pose} and ${b.name} ${b.pose} (${fmt(Math.max(a.t0, b.t0))}–${fmt(Math.min(a.t1, b.t1))}) clearance ${g.toFixed(2)}`);
  }
  out.push(`floor: ${spots.size} distinct resting spots · min clearance between simultaneous footprints ${minGap === Infinity ? '-' : `${minGap.toFixed(2)} amot (${(minGap * AMAH).toFixed(2)} m) ${minPair}`}`);

  // ---- walkers in the hall against resting bodies
  const restAt = (t) => rest.filter((s) => s.t0 <= t && t < s.t1);
  let walkHits = 0;
  for (const [name, p] of people) for (const e of p.eps) {
    let u = e.S;
    for (const l of e.legs) {
      if ((l.kind === 'walk') && l.owner !== 'none') {
        for (let k = 0; k <= 20; k++) {
          const loc = (l.dur * k) / 20, q = posAt(l, loc);
          if (!inHall(q)) continue;
          for (const s of restAt(u + loc)) {
            if (s.name === name) continue;
            const d = ptPoly(s.body.pts, q);
            if (d < WALKER_R && Math.abs((q[2] ?? M.Z) - s.at[2]) < 0.3) { if (walkHits++ < 12) issues.push(`walker: ${name} passes ${d.toFixed(2)} from ${s.name}'s body (${s.pose}) at ${fmt(u + loc)} (${q[0].toFixed(1)},${q[1].toFixed(1)})`); break; }
          }
        }
      }
      u += l.dur;
    }
  }
  if (walkHits > 12) issues.push(`walker: … ${walkHits} hits in all`);

  // ---- the winding stair: no one up while another goes down
  const log = P.stairLog || [];
  for (const d of log.filter((x) => x.dir === 'down')) for (const u of log.filter((x) => x.dir === 'up')) {
    if (d.key !== u.key && d.t0 < u.t1 && u.t0 < d.t1) issues.push(`stair: ${d.key} going down ${fmt(d.t0)}–${fmt(d.t1)} meets ${u.key} coming up ${fmt(u.t0)}–${fmt(u.t1)}`);
  }
  out.push(`stair: ${log.map((x) => `${x.key}${x.dir === 'down' ? '↓' : '↑'}${fmt(x.t0)}`).join(' ')}`);

  // ---- views: who is in the event's view through its window
  const ev = (id) => events.find((e) => e.id === id);
  const bear = (o, h, p, half, dMin, dMax) => { const dx = p[0] - o[0], dy = p[1] - o[1], d = Math.hypot(dx, dy); const b = (Math.atan2(dx, dy) * 180) / Math.PI; let db = ((b - h + 540) % 360) - 180; return d >= dMin && d <= dMax && Math.abs(db) <= half; };
  const VIEWS = {
    'dawn-immersion': (p) => p[2] < -6 && p[1] >= 450 && bear([203.25, 452], 260, p, 40, 1.5, 22),
    'mesibah-keri': (p) => p[2] < -6 && ((p[1] > 416 && p[1] < 450 && p[0] > 201.2 && p[0] < 205.3) || (p[1] >= 450 && Math.abs(p[0] - 203.25) <= 2.0 * (p[1] - 415.5) / 34.5 + 0.2)),
    'late-turning': (p) => p[2] > 24 && bear([217, 303], 0, p, 42, 4, 32),
    'night-turning': (p) => p[2] > 24 && bear([217, 303], 0, p, 42, 4, 32),
  };
  const _o = {};
  for (const [id, inView] of Object.entries(VIEWS)) {
    const e = ev(id);
    if (!e || !Number.isFinite(e.t0)) continue;
    const L = wrap(e.t1 - e.t0) || DAY;
    let gap = 0, gapStart = null, longest = 0, covered = 0, n = 0;
    const gaps = [];
    for (let s = 0; s <= L; s += 0.05) {
      const t = wrap(e.t0 + s);
      let any = false;
      for (const [, p] of people) { const q = personAt(p.eps, t, _o); if (!q || q.leg.owner === 'none' || !relevant[q.leg.owner]?.(t)) continue; const pos = posAt(q.leg, q.local); if (pos && inView(pos)) { any = true; break; } }
      n++;
      if (any) { covered++; if (gapStart != null) { gaps.push([gapStart, s]); gapStart = null; } } else if (gapStart == null) gapStart = s;
    }
    if (gapStart != null) gaps.push([gapStart, L]);
    // accepted: night-turning after the one kohen has gone in to immerse (he is a volunteer; the pile burns untended
    // until the clearing, and terumat-hadeshen fills the view from the muchni)
    const accept = (a) => id === 'night-turning' && Number.isFinite(P.altar.turnerLeft) && wrap(e.t0 + a - P.altar.turnerLeft) < 120;
    for (const [a, b] of gaps) if (!accept(a)) longest = Math.max(longest, b - a);
    out.push(`view ${id} ${fmt(e.t0)}–${fmt(e.t1)}: someone in view ${(100 * covered / n).toFixed(0)}% · gaps ${gaps.filter(([a, b]) => b - a > 0.2).map(([a, b]) => `${fmt(e.t0 + a)}+${(b - a).toFixed(1)}${accept(a) ? ' (accepted: the turner has gone in)' : ''}`).join(' ') || 'none'}`);
    if (longest > 1.0) issues.push(`view ${id}: empty for ${longest.toFixed(1)} min`);
  }

  // ---- continuity round the day (0.02 min steps, across the 24:00 wrap)
  const STEP = 0.02;
  const jumps = [];
  for (const [name, p] of people) {
    let prev = null;
    for (let s = 0; s <= DAY; s += STEP) {
      const t = wrap(s);
      const q = personAt(p.eps, t, _o);
      const shown = q && q.leg.owner !== 'none' && relevant[q.leg.owner]?.(t);
      const cur = shown ? { t, pos: posAt(q.leg, q.local), owner: q.leg.owner, pose: q.leg.pose || q.leg.kind } : null;
      if (prev && cur && cur.pos && prev.pos) {
        const dm = Math.hypot(cur.pos[0] - prev.pos[0], cur.pos[1] - prev.pos[1], (cur.pos[2] ?? 0) - (prev.pos[2] ?? 0)) * AMAH;
        if (dm > 2.6 * STEP * 60 + 0.25) jumps.push(`POP ${fmt(t)} ${name} ${prev.owner}->${cur.owner} ${dm.toFixed(2)} m (${prev.pos.map((v) => v.toFixed(1))} → ${cur.pos.map((v) => v.toFixed(1))})`);
      } else if (prev && !cur) jumps.push(`VANISH ${fmt(t)} ${name} ${prev.owner} ${prev.pose} at ${prev.pos?.map((v) => v.toFixed(1))}`);
      else if (!prev && cur && s > 0) jumps.push(`APPEAR ${fmt(t)} ${name} ${cur.owner} ${cur.pose} at ${cur.pos?.map((v) => v.toFixed(1))}`);
      prev = cur;
    }
  }
  out.push(`continuity (${jumps.length}):\n    ${jumps.join('\n    ')}`);
  for (const j of jumps) if (j.startsWith('POP')) issues.push(j);

  // ---- who is staged at a few moments, by owner
  for (const t of [T.lock[0] + 5, 1300, 30, T.imm[0] + 4, T.knock[0] + 1, T.first[0] + 2, T.insp[0] + 4, P.meet.t + 0.4, T.handG2 - 0.1]) {
    const by = {};
    for (const [name, p] of people) { const q = personAt(p.eps, wrap(t), _o); if (q) (by[q.leg.owner] ||= []).push(`${name}:${q.leg.pose || q.leg.kind}`); }
    out.push(`  @${fmt(t)} ${Object.entries(by).map(([o, l]) => `${o}[${l.join(' ')}]`).join(' ')}`);
  }
  out.push(`cues ${P.cues.length}: ${P.cues.map((c) => `${fmt(c.t)} ${c.id || 'caption'}(${c.owner})`).join(', ')}`);
  out.push(`props ${P.props.length}; altar stack ${P.altar.stack.length} pile ${P.altar.pile.length} tosses ${P.altar.tosses.length}; doors chel ${P.doors.chel.map((d) => fmt(d[0])).join(' ')} pish ${P.doors.pish.map((d) => fmt(d[0])).join(' ')} nw ${P.doors.nw.length} night ${P.doors.night.map(fmt).join('–')}`);

  if (opts.map) out.push(drawMap(P, rest, opts.at != null ? opts.at : null));
  out.push(issues.length ? `ISSUES (${issues.length}):\n  ${issues.slice(0, 60).join('\n  ')}` : 'no issues');
  return { out, issues };
}

/** ascii map of the chol half (amot; 4 cells an amah): mats and seats occupied at time t (or all spots) */
function drawMap(P, rest, t) {
  const M = P.M, K = M.keep, list = t == null ? rest : rest.filter((s) => s.t0 <= t && t < s.t1);
  const seen = new Map();
  for (const s of list) { const k = `${s.at.map((v) => v.toFixed(2))}${s.pose}`; if (!seen.has(k) && s.at[2] < M.Z + 0.1) seen.set(k, s); }
  const Q = [...seen.values()];
  const rows = [`map ${t == null ? '(every resting spot of the day)' : `at ${fmt(t)}`}: X ${M.i.min[0]}–${M.i.max[0]} →, Y ↑; O hearth (logs o), / chel-door leaf sweep, L lamp, # wall/ledges, @ head, ! overlap`];
  for (let y = M.i.max[1]; y >= M.ky - 0.5; y -= 0.25) {
    let row = '';
    for (let x = M.i.min[0] + 1.75; x <= M.i.max[0] - 1.75; x += 0.25) {
      let c = K.floor(x, y) ? '.' : y < M.ky ? '-' : '#';
      const dh = Math.hypot(x - M.hearth[0], y - M.hearth[1]);
      if (dh < 1.35) c = 'O'; else if (dh < K.hearthR) c = 'o';
      if (c === '.' && K.leaves.some((h) => Math.hypot(x - h[0], y - h[1]) < 4.98)) c = '/';
      if (Math.hypot(x - K.lamp[0], y - K.lamp[1]) < 0.45) c = 'L';
      let hit = 0;
      for (const s of Q) if (inside(s.fp.pts, [x, y])) { hit++; c = s.name.replace(/^elders/, 'e').replace('winner', 'W')[s.name.startsWith('y') ? 1 : 0]; }
      if (hit > 1) c = '!';
      for (const s of Q) if (s.pose !== 'kneel' && Math.hypot(x - s.fp.head[0], y - s.fp.head[1]) < 0.3) c = '@';
      row += c;
    }
    rows.push(`${y.toFixed(2)} ${row}`);
  }
  return rows.join('\n');
}

const args = process.argv.slice(2);
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'weekday';
const opts = { legs: args.includes('--legs') ? args[args.indexOf('--legs') + 1] : null, map: args.includes('--map') };
if (args.includes('--at')) { const [h, m] = args[args.indexOf('--at') + 1].split(':').map(Number); opts.at = h * 60 + m; }
let total = 0;
for (const d of which === 'all' ? ['weekday', 'friday', 'shabbat'] : [which]) {
  const { out, issues } = check(d, opts);
  console.log(out.join('\n'));
  total += issues.length;
}
process.exitCode = total ? 1 : 0;
