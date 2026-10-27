// G5 — each offering in progress as a watchable sub-event of the schedule (ctx.schedule.addSource): the "Happening
// now" list and the map group them under their parent event (the stage of the stream the offering is at), with its
// current step, place and a walkable spot to watch it from. One persistent object per offering, refreshed when asked.
import { OFFERING_TYPES } from '../../../data/offerings.js';
import { segAt, sampleSeg } from './track.js';
import { upperBound } from '../../lib/core.js';
import { watchPoint } from '../../lib/watch.js';

// (exported for the inspect hooks: describe/tracks.js — which roles a step is about)
export const FOCUS = {
  arrive: ['A', 'O'], semichah: ['O', 'A'], shechitah: ['A', 'O'], holachah: ['K1'], zerikah: ['K1'], matanot: ['K1'], 'matanah-achat': ['K1'],
  hefshet: ['K2'], hadachah: ['K2'], or: ['K2'], tenufah: ['K3', 'O', 'KB'], haalaah: ['C0', 'K3', 'S'], nesachim: ['N2', 'N1'], achilah: ['K3', 'KM', 'KB'],
  takeout: ['O'], nikanor: ['KB', 'O'], kinnin: ['KB'], melikah: ['KB'], haktarah: ['KB', 'KM'], "hava'ah": ['O', 'KM'], afiyah: ['KM'], hagashah: ['KM'], kemitzah: ['KM'],
  notar: ['N1', 'N2'], aliyah: ['O'], hanachah: ['O'],
};
const KIND_PARENT = { bird: 'bird-offerings', meal: 'meal-offerings', notar: 'notar-burning', bikkurim: 'tenufah' };
// above this height a figure is on the ramp, the sovev or the altar top, where the zone lookup answers for the court
// floor beneath: the step's own zone is used there
const PAVEMENT_Z = 19.5;
const _o = {}, _tmp = {};

/**
 * The step of an offering at t (its steps sorted by start): the latest-begun step still running; between steps, the
 * next one (its figures are on their way to it); -1 once its last step is over (only the walk home is left).
 */
function stepIndex(inst, t) {
  const st = inst.steps;
  let k = -1;
  for (let i = 0; i < st.length; i++) {
    if (st[i].t0 > t) { if (k < 0) k = i; break; }
    if (t < st[i].t1) k = i;
  }
  return k;
}
/** the time its last step ends */
const endOf = (inst) => (Number.isFinite(inst.tEnd) ? inst.tEnd : inst.t1);

/** getPlan() → { ok, insts, instT0, maxDur, G }; opts.prefix: the ids' prefix its byId answers to ('offering:') */
export function createSource(ctx, getPlan, { prefix = 'offering:' } = {}) {
  const zoneCache = new Map();
  function refresh(P, inst, t) {
    let ev = inst.ev;
    if (!ev) {
      const T = OFFERING_TYPES[inst.type] || {};
      ev = inst.ev = {
        id: inst.id, dynamic: true, offering: inst.type, kind: inst.kind, importance: 1, layer: 'halachic',
        t0: inst.t0, t1: endOf(inst), title: { en: inst.title?.en || T.names?.en || inst.type, he: inst.title?.he || T.names?.he || '' },
        typeName: { en: inst.title?.en || T.names?.en || inst.type, he: inst.title?.he || T.names?.he || '' },
        summary: '', description: '', sources: [], zone: 'azarah', pos: null, view: null, parent: null, parentTitle: null, step: null, stepIndex: -1,
        where: inst.kind === 'animal' ? laneLabel(P, inst) : inst.kind === 'bird' ? `bird kohen ${inst.lane + 1}` : inst.kind === 'meal' ? `meal-offering kohen ${inst.lane + 1}` : '',
        timing: { confidence: 'reconstruction', note: 'Which offerings come and when is a seeded reconstruction for this date (offerings.js frequencies; one day quantile); the order and places of the steps are sourced.' },
        participants: [], sounds: [],
      };
      // "Go": the step's own spot while from it the row's figure (ev.pos) is seen, else a stand that sees it
      // (lib/watch.js; gate-sim-data — a step's fixed spot missed its figure on the far side of the rings or the gate)
      const own = { v: null };
      Object.defineProperty(ev, 'view', {
        enumerable: true, configurable: true,
        get() { return watchPoint(ctx, own.v, ev.pos, inst); },
        set(v) { own.v = v; },
      });
      inst.steps.sort((a, b) => a.t0 - b.t0);
    }
    let k = stepIndex(inst, t);
    if (k < 0) k = inst.steps.length - 1;          // asked after its end (byId): its last step
    const st = inst.steps[k];
    if (k !== ev.stepIndex) {
      zoneCache.delete(inst);
      ev.stepIndex = k;
      ev.step = st?.id || null;
      ev.summary = st ? st.label : '';
      const parent = st?.parent && P.parents.has(st.parent) ? st.parent : (KIND_PARENT[inst.kind] && P.parents.has(KIND_PARENT[inst.kind]) ? KIND_PARENT[inst.kind] : 'private-offerings');
      ev.parent = inst.kayitz && P.parents.has('kayitz-hamizbeach') && ['arrive', 'shechitah', 'haalaah'].includes(st?.id) ? 'kayitz-hamizbeach' : parent;
      const pe = ctx.schedule?.byId?.(ev.parent);
      ev.parentTitle = pe?.title || null;
      ev.title = { en: `${ev.typeName.en} — ${shortStep(st)}${inst.kind === 'animal' ? ` (${laneLabel(P, inst)})` : ''}`, he: ev.typeName.he };
      ev.view = st?.view ? { at: st.view.at.slice(), heading: st.view.heading } : null;
      ev.zone = st?.zone || 'azarah';
      ev.description = describe(inst, k);
      const T = OFFERING_TYPES[inst.type];
      ev.sources = [...new Set([...(st?.sources || []), ...(T?.sources || [])])].slice(0, 12);
    }
    // where it is now: the figure the step is about. Its zone is where that figure stands on the pavement; on the ramp,
    // the sovev or the altar top, or when the step's own figure is not in view, the step's zone
    const p = focusPos(P, inst, st, t);
    if (p) {
      if (!ev.pos) ev.pos = [0, 0, 0];
      const moved = Math.hypot(ev.pos[0] - p[0], ev.pos[1] - p[1]) > 1.5 || Math.abs(ev.pos[2] - p[2]) > 1;
      ev.pos[0] = p[0]; ev.pos[1] = p[1]; ev.pos[2] = p[2];
      if (moved || !zoneCache.has(inst)) {
        let z = null;
        if (p.own && p[2] < PAVEMENT_Z) { try { z = ctx.zones?.atSite?.(p[0], p[1], p[2] + 0.4) || null; } catch { z = null; } }
        zoneCache.set(inst, z && z !== 'outside' ? z : (st?.zone || 'azarah'));
      }
      ev.zone = zoneCache.get(inst);
    }
    return ev;
  }

  function focusPos(P, inst, st, t) {
    const roles = FOCUS[st?.id] || [];
    const tracks = inst.tracks;
    const pick = (tr, own) => {
      if (!tr || tr.slot < 0 || t < tr.t0 || t >= tr.t1) return null;
      const k = segAt(tr.segs, t);
      if (k < 0) return null;
      const o = sampleSeg(tr.segs[k], t, _o, _tmp);
      const p = [o.X, o.Y, o.Z + (o.up || 0)];
      p.own = own;
      return p;
    };
    for (const r of roles) { const p = pick(tracks.find((x) => x.role === r), true); if (p) return p; }
    for (const tr of tracks) { const p = pick(tr, false); if (p) return p; }
    return st?.view?.at ? [st.view.at[0], st.view.at[1], st.view.at[2] ?? 16] : null;
  }

  const out = [];
  const src = {
    id: 'private-offerings',
    /** offerings in progress at t */
    active(t) {
      out.length = 0;
      const P = getPlan();
      if (!P?.ok || !P.insts.length) return out;
      const hi = upperBound(P.instT0, t);
      for (let i = hi - 1; i >= 0; i--) {
        const inst = P.insts[i];
        if (inst.t0 < t - P.maxDur - 1) break;
        if (t >= inst.t0 && t < endOf(inst)) out.push(refresh(P, inst, t));
      }
      out.sort((a, b) => a.t0 - b.t0);
      return out.slice();
    },
    /** the next n offerings to begin after t */
    upcoming(t, n = 5) {
      const P = getPlan();
      if (!P?.ok) return [];
      const r = [];
      for (let i = upperBound(P.instT0, t); i < P.insts.length && r.length < n; i++) r.push(refresh(P, P.insts[i], P.insts[i].t0 + 1e-3));
      return r;
    },
    byId(id) {
      if (typeof id !== 'string' || !id.startsWith(prefix)) return null;
      const P = getPlan();
      const inst = P?.ok ? P.insts.find((x) => x.id === id) : null;
      return inst ? refresh(P, inst, ctx.time?.t ?? inst.t0) : null;
    },
  };
  return src;
}

function laneLabel(P, inst) { return P.G.lanes[inst.lane]?.label || ''; }

function shortStep(st) {
  if (!st) return '';
  const s = String(st.label || st.id);
  return s.length > 64 ? `${s.slice(0, 61).replace(/[ ,;—-]+\S*$/, '')}…` : s;
}

function describe(inst, cur) {
  const T = OFFERING_TYPES[inst.type] || {};
  const lines = [];
  const what = [];
  if (T.names) what.push(`${T.names.en} — ${T.names.translit} (${T.names.he}), ${T.category === 'kodshei kodashim' ? 'most holy' : T.category === 'kodashim kalim' ? 'of the lesser holiness' : T.category || ''}.`);
  if (T.broughtBy) what.push(`Brought by: ${T.broughtBy}.`);
  if (T.burned) what.push(`On the altar: ${T.burned}.`);
  if (T.eaten?.by) what.push(`Eaten by ${T.eaten.by}${T.eaten.where ? `, ${T.eaten.where}` : ''}${T.eaten.until ? `, ${T.eaten.until}` : ''}.`);
  if (inst.kayitz) what.push('This one is kayitz hamizbeach: bought from surplus funds to keep the altar busy (Shekalim 4:4); with no owner, no one leans on it (Rambam MK 3:7).');
  if (inst.job?.set === 'yoledet' && inst.kind === 'animal') what.push('A mother\'s olah, brought with a bird chatat that is offered first (Zevachim 90a): her husband or agent leads the lamb in once her bird has been offered; a woman does not lean (Menachot 9:8).');
  if (inst.job?.set === 'yoledet' && inst.kind === 'bird' && inst.job?.linked) what.push('She brings a lamb for her olah; it is led in once this bird has been offered — the chatat first, even before an animal olah (Zevachim 90a).');
  if (inst.kind === 'bird' && inst.job?.source === 'chest') what.push('Bought with money put in the chest marked "kinnin" (a chatat and an olah) or "gozlei olah" (olot), as the Sages read Shekalim 6:5: the kohanim offer the birds, and no owner comes in.');
  if (inst.kind === 'bird' && inst.job?.source === 'bringer') what.push('A man\'s own bird, a vow or a gift (Kinnim 1:1: all of these are olot), handed to the kohen at Sha\'ar Nikanor.');
  if (['olah', 'shelamim', 'todah'].includes(inst.type)) what.push('Its libations were bought by seal from Yochanan ben Pinchas and collected from Achiyah before it came in (Shekalim 5:4).');
  lines.push(what.join(' '));
  const steps = inst.steps.map((s, i) => `${i === cur ? '▶ ' : ''}${i + 1}. ${s.label}${i === cur ? ' — now' : ''}`);
  lines.push(`Its steps: ${steps.join('; ')}.`);
  const st = inst.steps[cur];
  if (st?.note) lines.push(st.note);
  return lines.join('\n\n');
}
