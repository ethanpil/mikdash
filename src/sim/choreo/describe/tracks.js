// describe for the figures of an individual's offering (G5 private-offerings, G4's nazir and metzora sets and the
// owners on their way up the Mount): each figure is one Track of one offering instance — a role (the owner, the animal,
// the receiver of the blood, the flayer, the carriers, the salter, the libations, the birds, the meal-offering) — and
// the instance's steps carry the data's own labels and sources (src/data/offerings.js steps), so the description is the
// step the offering is at, said from the figure's role. Subject keys name the instance and the role, so a figure is
// found again after a jump only while that same offering is staged (never another owner in the same pooled body).
import { OFFERING_TYPES } from '../../../data/offerings.js';
import { FOCUS } from '../g5/dynamic.js';

const ANIMAL = { lamb: 'lamb', ram: 'ram', goat: 'goat', ewe: 'ewe lamb', she_goat: 'she-goat', bull: 'bull' };
const ANIMAL_POOLS = new Set(['lamb', 'ram', 'goat', 'ewe', 'she_goat', 'bull']);

/** a track's role stripped of the set's prefix: 'cK1' → 'K1', 'oC2' → 'C', 'AO' → 'A', 'N1b' → 'N1', 'm0AG' → 'AG' */
export function baseRole(role, pool) {
  const r = String(role || '');
  if (pool === 'companion') return 'COMP';
  if (/^m\d+AG$/.test(r)) return 'AG';
  if (/^m\d+K0$/.test(r)) return 'K0';
  if (/^(m\d+)?A[CORG]?$/.test(r) && ANIMAL_POOLS.has(pool)) return 'A';
  const m = r.match(/(K\d|KW|KB|KM|C\d|S|N\d|L\d|O|A)b?$/);
  if (!m) return r;
  const b = m[1];
  if (/^C\d$/.test(b)) return 'C';
  if (/^L\d$/.test(b)) return 'L';
  return b;
}

/** the offering's short name: 'olah', 'chatat', … (the data's transliteration) */
export function offeringName(type) {
  const T = OFFERING_TYPES[type];
  const n = T?.names?.translit || type || 'offering';
  return n[0].toUpperCase() + n.slice(1);
}

const PHRASE = {
  O: (x) => (x.pool === 'nazir' ? 'the nazir, at the end of his term' : x.pool === 'kohen' || x.pool === 'kohen_offduty' ? `a kohen bringing his own ${x.name.toLowerCase()}` : `the owner of a${/^[aeiou]/i.test(x.name) ? 'n' : ''} ${x.name.toLowerCase()}`),
  A: (x) => `the ${ANIMAL[x.pool] || x.pool} of a${/^[aeiou]/i.test(x.name) ? 'n' : ''} ${x.name.toLowerCase()}`,
  K1: () => 'the kohen who receives its blood in a service vessel and puts it on the altar',
  K2: () => 'a kohen who holds the animal at the slaughter, then flays it and rinses its innards',
  K3: () => 'a kohen who takes its portions to the altar and the kohanim',
  KW: () => 'the kohen who waves it with the owner, his hands beneath the owner\'s',
  C: () => 'one of the kohanim who carry its limbs to the ramp',
  S: () => 'the kohen who salts its limbs on the ramp',
  N1: () => 'a kohen with its meal-offering of flour mixed with oil',
  N2: () => 'the kohen who pours its wine at the south-west horn',
  KB: () => 'the kohen of the bird offerings, who takes them and offers them at the corners of the altar',
  KM: () => 'the kohen of the meal-offerings, who takes the handful and burns it',
  L: () => 'a Levite singing as the first fruits are brought',
  AG: () => 'the metzora\'s agent, who brings his animals',
  K0: () => 'a kohen at the metzora\'s offering',
  COMP: () => 'a companion of the nazir',
};
const WHY_SRC = (T) => (Array.isArray(T?.sources) ? T.sources : []);

/** the step of an instance at t: the latest begun still running, else the next one (its figures are on their way) */
export function stepAt(inst, t) {
  const st = inst?.steps || [];
  let k = -1, next = null;
  for (let i = 0; i < st.length; i++) {
    if (st[i].t0 > t) { if (!next || st[i].t0 < next.t0) next = st[i]; continue; }
    if (t < st[i].t1 && (k < 0 || st[i].t0 >= st[k].t0)) k = i;
  }
  return { cur: k >= 0 ? st[k] : null, next };
}

/**
 * The hook answer for a figure on track `tr` of instance `inst` at t. o.eventId: the schedule id its rows go by (G5's
 * 'offering:…', G4's 'set:…'); o.key: its subject key; o.way: 'in' | 'out' (the walk up the Mount or home, courts-daily).
 */
export function describeTrack(tr, inst, t, o = {}) {
  if (!tr || !inst) return null;
  const type = inst.type;
  const T = OFFERING_TYPES[type] || null;
  const role = baseRole(tr.role, tr.pool);
  // its own title's head ('An olah (burnt-offering) — a lamb' → 'Olah (burnt-offering)'), else the type's name
  const head = inst.kind !== 'set' && inst.title?.en ? String(inst.title.en).split(' — ')[0].replace(/^(An?|The) /, '') : null;
  const x = { pool: tr.pool, name: o.name || (head ? head[0].toUpperCase() + head.slice(1) : offeringName(type)) };
  const name = x.name;
  const { cur, next } = stepAt(inst, t);
  const human = !ANIMAL_POOLS.has(tr.pool);
  // a mother's offering is hers (Vayikra 12:6): a man who brings it is her husband or agent, never its owner
  const forHer = inst.job?.set === 'yoledet' && role === 'O' && human && tr.pool !== 'woman';
  // a kohen's own phrase only where it fits: the bird kohen at a bird, the meal kohen at a meal-offering, and not in a
  // step that is the owner's alone (the meat taken out: the kohanim's part is over, and NOW tells the owner's step)
  const form = T?.form;
  const roles = cur ? FOCUS[cur.id] : null;
  const ownersStep = !!roles && roles.length === 1 && roles[0] === 'O';
  const misfit = (role === 'KB' && form !== 'bird') || (role === 'KM' && form !== 'meal') || (/^(K\d|KW|KB|KM|C|S|N\d)$/.test(role) && ownersStep);
  const phrase = { en: o.phrase?.[tr.role] || o.phrase?.[role]
    || (forHer ? `her husband or agent, bringing a ${name.toLowerCase()} for her` : null)
    || (misfit ? `a kohen at the ${name.toLowerCase()}` : null)
    || (PHRASE[role] || (() => `one of the figures of a${/^[aeiou]/i.test(x.name) ? 'n' : ''} ${x.name.toLowerCase()}`))(x) };
  const why = T?.broughtBy ? { en: `${T.names?.en || name}: ${typeof T.broughtBy === 'string' ? T.broughtBy : T.broughtBy.en}`, sources: WHY_SRC(T) } : null;
  if (o.way === 'in') {
    return { doing: { en: forHer ? `Bringing a ${x.name.toLowerCase()} up from the city, for her` : human ? `Bringing his ${x.name.toLowerCase()} up from the city` : `Led up from the city for a${/^[aeiou]/i.test(x.name) ? 'n' : ''} ${x.name.toLowerCase()}` }, phrase, eventId: o.eventId, why, subjectKey: o.key,
      next: Number.isFinite(tr.t0) ? { t: tr.t0, label: { en: `${x.name} in the court` } } : undefined };
  }
  if (o.way === 'out') {
    const meat = type === 'shelamim' || type === 'todah' || type === 'maaser' || type === 'bechor';
    return { doing: { en: meat ? `Going home with the meat of his ${x.name.toLowerCase()}, to eat it in Jerusalem` : 'Going home, leaving Har HaBayit by the left' }, phrase, why: meat ? { en: 'The lesser offerings are eaten anywhere in Jerusalem, within its wall.', sources: ['Kelim 1:8', 'Zevachim 5:6–8'] } : why, subjectKey: o.key };
  }
  const step = cur || next;
  let doing;
  if (cur) doing = { en: o.plain ? cur.label : `${x.name}: ${lcFirst(cur.label)}` };
  else if (next) doing = { en: human ? `${tr.pool === 'israelite' || role === 'O' ? 'Coming in' : 'On the way'} — ${o.plain ? '' : `${x.name.toLowerCase()}: `}${lcFirst(next.label)}` : `Led in — ${o.plain ? lcFirst(next.label) : x.name.toLowerCase()}` };
  else doing = { en: role === 'O' ? 'Leaving the court, his offering done' : human ? `Returning from the ${x.name.toLowerCase().replace(/^the /, '')}` : `The ${x.name.toLowerCase()}` };
  return {
    doing, phrase, eventId: o.eventId,
    step: step ? { id: step.id, label: { en: step.label }, t0: step.t0, t1: step.t1, offering: type } : undefined,
    why: step?.sources?.length && why ? { en: why.en, sources: [...new Set([...step.sources, ...why.sources])] } : why,
    subjectKey: o.key,
    next: !cur && next ? { t: next.t0, label: { en: next.label }, step: { id: next.id, label: { en: next.label }, t0: next.t0, t1: next.t1 } } : undefined,
  };
}
const lcFirst = (s) => (s ? String(s)[0].toLowerCase() + String(s).slice(1) : s);

/** the track of a list (sorted by t0) that holds t */
export function trackAt(list, t) {
  if (!list) return null;
  for (let i = list.length - 1; i >= 0; i--) { const tr = list[i]; if (tr.t0 <= t) return t < tr.t1 ? tr : null; }
  return null;
}
