// Group G4 — the Mount's circuit as watchable rows of the schedule (ctx.schedule.addSource, as private-offerings does
// for each offering): under "In by the right, out by the left" the "Happening now" list shows where someone is
// prostrating opposite a repaired breach at this moment and, three times a day, the mourner (or the one under a ban)
// going round to the left — each with a place to watch it from, so "Go" lands where the act can be seen. The rows
// are read from courts-daily's plan; nothing here changes the scene.
import { LOOP, BREACHES, COL_LAT, L } from './mount.js';
import { AMAH } from '../../../core/units.js';

const PARENT = 'entry-circuit';
const _s = {}, _q = {};

/** stand-off for watching a station's row of places: on the row's line, beyond its last place, looking back along it */
function stationView(b) {
  const sEnd = b.s + b.cols[b.cols.length - 1] + 3.2;
  LOOP.sample(sEnd, _q, -COL_LAT - 0.4);
  return { at: [_q.X, _q.Y, 0], heading: (_q.heading + 180 - 10) % 360 };
}

function row(id, title, summary, sources) {
  return {
    id, dynamic: true, parent: PARENT, parentTitle: null, importance: 1, layer: 'ritual', zone: 'har-habayit',
    t0: 0, t1: 0, title, typeName: title, summary, description: summary, sources, pos: [0, 0, 0], view: null,
    timing: { confidence: 'reconstruction', note: 'Who comes up and when is a seeded reconstruction for this date; the rule of the circuit and the prostrations is the Mishnah\'s.' },
    participants: [], sounds: [], where: 'Har HaBayit',
  };
}

export function mountSource(ctx, getPlan) {
  const pro = row('g4:prostration', { en: 'Prostrating opposite a repaired breach', he: 'השתחוויה כנגד הפרצות' },
    'Opposite each of the thirteen breaches the Greek kings made in the soreg, repaired, those going round prostrate full length (Middot 2:3).',
    ['Middot 2:3', 'Middot 2:2']);
  const mou = row('g4:mourner', { en: 'A mourner goes round to the left', he: 'אבל מקיף לשמאל' },
    '"Why do you go round to the left?" — "I am a mourner." — "May He who dwells in this House comfort you" (Middot 2:2).',
    ['Middot 2:2']);
  const out = [];
  /** the station where most are prostrating at t (from the plan's circuit episodes) */
  function prostrationAt(P, t) {
    const count = new Map();
    for (const e of P.circEps || []) {
      if (e.t0 > t) break;
      if (t > e.t0 + e.T) continue;
      const leg = e.it.legAt(t - e.t0);
      if (leg.kind !== 1 || leg.pose !== 'prostrate') continue;
      // the station: the one whose places this is at
      let best = null, bd = Infinity;
      for (const b of BREACHES) { const d = Math.hypot(leg.X - b.loop[0], leg.Y - b.loop[1]); if (d < bd) { bd = d; best = b; } }
      if (!best) continue;
      const c = count.get(best) || { n: 0, t0: e.t0 + leg.t0, t1: e.t0 + leg.t1 };
      c.n++; c.t0 = Math.min(c.t0, e.t0 + leg.t0); c.t1 = Math.max(c.t1, e.t0 + leg.t1);
      count.set(best, c);
    }
    let pick = null;
    for (const [b, c] of count) if (!pick || c.n > pick.c.n) pick = { b, c };
    return pick;
  }
  const src = {
    id: 'g4-mount',
    active(t) {
      out.length = 0;
      let P = null;
      try { P = getPlan(); } catch { P = null; }
      if (!P) return out;
      const p = prostrationAt(P, t);
      if (p) {
        pro.t0 = p.c.t0; pro.t1 = p.c.t1 + 0.6;
        pro.view = stationView(p.b);
        pro.pos[0] = p.b.loop[0]; pro.pos[1] = p.b.loop[1]; pro.pos[2] = 0;
        pro.title = { en: `Prostrating opposite the repaired breach (station ${p.b.n} of 13)`, he: 'השתחוויה כנגד הפרצות' };
        out.push(pro);
      }
      for (const w of P.watch || []) {
        if (w.kind !== 'mourner' || t < w.t0 || t >= w.t1) continue;
        w.it.sample(t - w.t0, _s);
        mou.t0 = w.t0; mou.t1 = w.t1;
        mou.title = w.ban ? { en: 'One under a ban goes round to the left', he: 'מנודה מקיף לשמאל' } : { en: 'A mourner goes round to the left', he: 'אבל מקיף לשמאל' };
        mou.summary = w.ban
          ? '"Why do you go round to the left?" — "I am under a ban." — "May He who dwells in this House put it in their hearts to bring you near" (Middot 2:2).'
          : '"Why do you go round to the left?" — "I am a mourner." — "May He who dwells in this House comfort you" (Middot 2:2).';
        mou.description = mou.summary;
        mou.pos[0] = _s.X; mou.pos[1] = _s.Y; mou.pos[2] = _s.Z;
        // a few paces ahead of him beyond the prostration places (on his right, toward the soreg), facing back to him
        const h = (_s.heading * Math.PI) / 180;
        const ax = _s.X + (Math.sin(h) * 7) / AMAH, ay = _s.Y + (Math.cos(h) * 7) / AMAH;
        const rx = Math.cos(h), ry = -Math.sin(h);           // his right (the soreg side: he goes clockwise)
        mou.view = { at: [ax + (rx * 4.0) / AMAH, ay + (ry * 4.0) / AMAH, Math.max(0, _s.Z)], heading: (_s.heading + 180 + 25 + 360) % 360 };
        out.push(mou);
        break;
      }
      return out.slice();
    },
    upcoming() { return []; },
    byId(id) { if (id === pro.id) return pro; if (id === mou.id) return mou; return null; },
  };
  void L;
  return src;
}
