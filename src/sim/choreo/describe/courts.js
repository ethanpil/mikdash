// Inspect hooks for the G4 modules (courts-daily, chambers-daily, nikanor-stations, sanhedrin) and beit-avtinas. Their
// figures run Troupe episodes (g4/lib.js): a figure's key names its episode, so after a jump it is found again only in
// the same episode, never as another visitor in the same pooled body. The nazir's and the metzora's offerings are G4
// sets (g4/sets.js SetCast) read like G5's offerings (describe/tracks.js); the owners on their way up the Mount are G5's
// own (courts-daily's g5-ways), keyed as G5 keys them. Texts follow Middot 2:2–5, 5:3–4, Shekalim 5:4, Tamid 5:6,
// Negaim 14, Sotah 1:5, Sanhedrin 4:3, Zevachim 5:3 and 11:7.
import { describeWith, poolsIn } from './index.js';
import { describeTrack, trackAt } from './tracks.js';

const pose = (who) => who.slot?.actor?.poseName || who.slot?._pose || '';
const PROSTRATE = /prostrate/;

/** a troupe figure's key: its pool, slot and episode (the episode's start), when it is in one — read from the troupe's
 * episode lists without touching its own caches */
export function troupeKey(id, state, who, t) {
  for (const tr of state.troupes || []) {
    if (tr.pool?.name !== who.poolName) continue;
    const st = tr.starts?.[who.index], eps = tr.eps?.[who.index];
    if (!st?.length) continue;
    let lo = 0, hi = st.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (st[m] <= t) lo = m + 1; else hi = m; }
    const e = lo > 0 ? eps[lo - 1] : null;
    if (e && t <= e.t0 + e.T) return `${id}:${who.poolName}:${who.index}@${e.t0.toFixed(2)}`;
  }
  return `${id}:${who.poolName}:${who.index}`;
}

// ------------------------------------------------------------------------------------------------ G4 sets
const instOf = new WeakMap();
function setInst(B) {
  let x = instOf.get(B);
  if (!x) { x = { type: B.type, kind: 'set', title: B.title, steps: [...B.steps].sort((a, b) => a.t0 - b.t0) }; instOf.set(B, x); }
  return x;
}
/** a figure of a nazir's or metzora's set (state.cast: SetCast; castKey: its pool key there) */
export function describeSet(state, who, t, castKey) {
  const tr = trackAt(state.cast?.slots?.[castKey]?.[who.index], t);
  if (!tr) return null;
  const sets = state.plan?.sets || [];
  const B = sets.find((b) => b.tracks.includes(tr));
  if (!B) return null;
  const n = sets.filter((b) => b.steps.length).indexOf(B) + 1;
  const id = `set:${B.type}:${B.role}:${n}`;
  const who2 = B.type === 'nazir' ? 'nazir' : B.type === 'metzora' ? 'metzora' : null;
  return describeTrack(tr, setInst(B), t, {
    eventId: id, key: `${id}#${tr.role}`, plain: true, name: who2 ? `The ${who2}'s offerings` : undefined,
    phrase: who2 ? { AC: `the ${who2}'s chatat, a ewe lamb`, AO: `the ${who2}'s olah, a lamb`, AR: `the ${who2}'s shelamim, a ram`, A: `one of the ${who2}'s animals`, O: `the ${who2}` } : undefined,
  });
}
export function locateSet(state, key, t) {
  const [id, role] = String(key).split('#');
  const m = id.match(/^set:(.+):(.+):(\d+)$/);
  if (!m) return null;
  const B = (state.plan?.sets || []).filter((b) => b.steps.length)[+m[3] - 1];
  const tr = B?.tracks.find((x) => x.role === role);
  if (!tr || tr.slot < 0 || !(t >= tr.t0 && t < tr.t1)) return null;
  const slot = state.cast?.pools?.[tr.pool]?.slot(tr.slot);
  return slot ? { slot } : null;
}

// ------------------------------------------------------------------------------------------------ chambers-daily
/** a nazir's animal on its way up the Mount, before the set takes it into the court (its troupe episode) */
function nazirAnimal(state, who, t, what) {
  return {
    doing: { en: 'Led up the Mount with the nazir, to the court' }, phrase: { en: `the nazir's ${what}` }, eventId: 'nazirites',
    why: { en: 'At the end of his term the nazir brings a ewe lamb for a chatat, a lamb for an olah and a ram for shelamim.', sources: ['Bamidbar 6:14'] },
    subjectKey: troupeKey('chambers-daily', state, who, t),
  };
}
const tkey = (id) => (who, state, sim, t) => troupeKey(id, state, who, t);
const castFirst = (id, castKey, fallback) => (ctx, state, who, t) => describeSet(state, who, t, castKey) ?? fallback;
export const chambers = describeWith({
  id: 'chambers-daily', prefixes: ['chambers-daily:', 'set:nazir'],
  locate: (ctx, state, key, t) => (String(key).startsWith('set:') ? locateSet(state, key, t) : undefined),
  pools: {
    'chavitin-bakers': { phrase: 'one of the chavitin makers', key: tkey('chambers-daily'), doing: { 'chavitin-bakers': 'Making the Kohen Gadol\'s daily chavitin: a tenth of an ephah, made on a griddle with oil — half offered in the morning and half in the evening' }, idle: 'In the chamber of the chavitin makers' },
    'wood-sorters': { phrase: 'a kohen with a blemish, unfit to serve at the altar', key: tkey('chambers-daily'), doing: { 'wood-chamber': 'Picking over the altar\'s wood for worms in the wood chamber — wood with a worm in it is unfit for the altar' }, idle: 'In his own clothes, out of the service' },
    nazirites: { phrase: 'a nazir at the end of his term', key: tkey('chambers-daily'), custom: castFirst('chambers-daily', 'nazir', undefined), doing: { nazirites: 'In the nazirites\' chamber: his head shaved, the hair cast into the fire under the pot of his shelamim' } },
    'nazir-companions': { phrase: 'a companion of the nazir', key: tkey('chambers-daily'), custom: castFirst('chambers-daily', 'companion', undefined), doing: { nazirites: 'With the nazir at the end of his term' } },
    'set-kohanim': { custom: (ctx, state, who, t) => describeSet(state, who, t, 'kohen') },
    'set-lambs': { custom: (ctx, state, who, t) => describeSet(state, who, t, 'lamb') ?? nazirAnimal(state, who, t, 'olah, a lamb') },
    'set-ewes': { custom: (ctx, state, who, t) => describeSet(state, who, t, 'ewe') ?? nazirAnimal(state, who, t, 'chatat, a ewe lamb') },
    'set-rams': { custom: (ctx, state, who, t) => describeSet(state, who, t, 'ram') ?? nazirAnimal(state, who, t, 'shelamim, a ram') },
    'golah-levites': { phrase: 'a Levite at the Golah wheel (who turned it is not recorded: a reconstruction)', key: tkey('chambers-daily'), doing: { 'golah-wheel': 'Turning the wheel over the Golah cistern — from it water was supplied to the whole court' } },
    'hide-salters': { phrase: 'one of those salting the hides', key: tkey('chambers-daily'), doing: { parvah: 'Salting the hides of the offerings in Lishkat HaParvah' } },
    'beit-garmu': { phrase: 'one of the house of Garmu, over the making of the showbread', key: tkey('chambers-daily'), doing: { 'beit-garmu': 'Friday: making the showbread — kneaded one loaf at a time and baked two at a time' } },
    seals: {
      sub: (who) => who.index, key: tkey('chambers-daily'),
      phrase: { 0: 'the officer over the seals', 1: 'the officer over the libations' },
      doing: { seals: 'The evening reckoning: the seals brought out and counted against the money — a surplus goes to the Temple, and a shortfall the officer of the seals pays from his own house' },
    },
  },
});

// ------------------------------------------------------------------------------------------------ courts-daily
const MOUNT = ['entry-circuit'];
const circuit = (ctx, state, who) => (PROSTRATE.test(pose(who)) ? 'Prostrating toward the courts, opposite one of the thirteen repaired breaches of the soreg' : 'Going round Har HaBayit: in by the right, round, and out by the left');
const WAY_ANIMALS = new Set(['lamb', 'ram', 'goat', 'ewe', 'she_goat']);
/** an owner (or his animal) on his way up the Mount or home: the G5 offering whose slot it shares */
function wayFigure(ctx, state, who, t, sim) {
  const name = String(who.poolName).replace(/^g5-ways-/, '');
  const P5 = sim.planOf?.('private-offerings');
  const list = P5?.slotTracks?.[name]?.[who.index];
  if (!list?.length) return null;
  // walking up before his track there, or home after it
  let up = null, home = null;
  for (const tr of list) {
    if (tr.t0 >= t && (!up || tr.t0 < up.t0)) up = tr;
    if (tr.t1 <= t && (!home || tr.t1 > home.t1)) home = tr;
  }
  const way = up && (!home || up.t0 - t <= t - home.t1) ? 'in' : 'out';
  const tr = way === 'in' ? up : home;
  if (!tr?.inst) return null;
  const r = describeTrack(tr, tr.inst, t, { eventId: tr.inst.id, key: `${tr.inst.id}#${tr.role}`, way });
  if (r && WAY_ANIMALS.has(name) && way === 'out') r.doing = { en: 'Led home' };
  return r;
}
export const courts = describeWith({
  id: 'courts-daily', prefixes: ['courts-daily:', 'offering:'],
  locate(ctx, state, key, t, sim) {
    if (!String(key).startsWith('offering:')) return undefined;
    // the owner (or animal) of a G5 offering, on his way up or home: the ways slot that shares his G5 slot
    for (const pool of poolsIn(state)) {
      if (!pool.name.startsWith('g5-ways-')) continue;
      for (let i = 0; i < pool.slots.length; i++) {
        const slot = pool.slots[i];
        if (!slot.want && !slot.shown) continue;
        const d = wayFigure(ctx, state, { kind: 'person', poolName: pool.name, index: i, slot }, t, sim);
        if (d?.subjectKey === key) return { slot };
      }
    }
    return null;
  },
  pools: {
    gatekeepers: { phrase: 'a Levite gatekeeper', key: tkey('courts-daily'), doing: { 'gate-levites': 'Keeping the gate by day' } },
    'circuit-men': { phrase: 'an Israelite come up to Har HaBayit', key: tkey('courts-daily'), events: MOUNT, doing: { _: circuit } },
    'circuit-women': { phrase: 'a woman come up to Har HaBayit', key: tkey('courts-daily'), events: MOUNT, doing: { _: circuit } },
    'circuit-children': { phrase: 'a child come up with his family', key: tkey('courts-daily'), events: MOUNT, doing: { _: circuit } },
    mourner: { phrase: 'a mourner', key: tkey('courts-daily'), events: MOUNT, doing: { _: 'Going round to the left, against the stream; those he meets say: "May He who dwells in this House comfort you"' }, why: { 'entry-circuit': { en: 'All who come onto Har HaBayit enter by the right and leave by the left — except one to whom something has happened, who goes round to the left.', sources: ['Middot 2:2'] } } },
    menudeh: { phrase: 'one under a ban', key: tkey('courts-daily'), events: MOUNT, doing: { _: 'Going round to the left; those he meets say: "May He who dwells in this House put it in their hearts to bring you near"' }, why: { 'entry-circuit': { en: 'One under a ban goes round to the left (R\' Meir; R\' Yosi words the blessing differently).', sources: ['Middot 2:2'] } } },
    greeters: { phrase: 'an Israelite going round the Mount', key: tkey('courts-daily'), events: MOUNT, doing: { _: 'Meeting one who goes round to the left: "Why do you go round to the left?" — and the blessing' } },
    'en-women': { phrase: 'a woman in the Ezrat Nashim', key: tkey('courts-daily'), doing: { 'women-court': 'In the Ezrat Nashim, the women\'s court' } },
    'en-men': { phrase: 'an Israelite', key: tkey('courts-daily'), doing: { 'women-court': 'Through the Ezrat Nashim and up the fifteen steps to stand in Ezrat Yisrael' } },
    'en-children': { phrase: 'a child with his family', key: tkey('courts-daily'), doing: { 'women-court': 'With his family in the Ezrat Nashim' } },
    'soreg-*': { phrase: 'one of a party by the soreg', key: tkey('courts-daily'), events: MOUNT, doing: { _: 'Standing by the soreg, watching the courts' } },
    'stoa-teachers': { phrase: 'an elder teaching in the colonnade (a reconstruction)', key: tkey('courts-daily'), events: MOUNT, doing: { _: 'Teaching in the colonnade of Har HaBayit' }, why: { 'entry-circuit': { en: 'Har HaBayit was colonnaded, a colonnade within a colonnade; the Tosefta tells of a house of study on Har HaBayit.', sources: ['Rambam BhB 5:1', 'Sanhedrin 88b'] } } },
    'stoa-*': { phrase: 'one gathered in the colonnade', key: tkey('courts-daily'), events: MOUNT, doing: { _: 'In the colonnade of Har HaBayit — "a colonnade within a colonnade"' } },
    'plaza-*': { phrase: 'one crossing the Mount', key: tkey('courts-daily'), events: MOUNT, doing: { _: 'Crossing Har HaBayit' } },
    'g5-ways-*': { custom: wayFigure },
    meal: {
      phrase: 'a kohen at the meal of the most-holy portions', key: tkey('courts-daily'),
      doing: {
        'kodashim-meal': 'Eating the most-holy portions, standing in the court — male kohanim, within the hangings, that day and the night until midnight',
        'kodashim-meal-night': 'Eating the most-holy portions until midnight, standing in the court',
        scouring: 'Scouring a copper pot with hot water and rinsing it in cold; an earthenware pot in which holy meat was cooked is broken',
      },
    },
    cook: { phrase: 'the kohen cooking the portions', key: tkey('courts-daily'), doing: { 'kodashim-meal': 'Cooking the portions of the most-holy offerings — they may be eaten prepared in any manner of food', 'kodashim-meal-night': 'Cooking the portions of the most-holy offerings' } },
  },
});

// ------------------------------------------------------------------------------------------------ nikanor-stations
export const nikanor = describeWith({
  id: 'nikanor-stations', prefixes: ['nikanor-stations:', 'set:metzora'],
  locate: (ctx, state, key, t) => (String(key).startsWith('set:') ? locateSet(state, key, t) : undefined),
  pools: {
    impure: { phrase: 'one of the impure', key: tkey('nikanor-stations'), doing: { 'impure-east-gate': 'Stationed with the impure at the eastern gate — the head of the ma\'amad places them there at the crash of the magrefah' } },
    'head-of-maamad': { phrase: 'the head of the ma\'amad', key: tkey('nikanor-stations'), doing: { 'impure-east-gate': 'Stationing the impure at the eastern gate' } },
    metzora: { phrase: 'a healed metzora on his eighth day', key: tkey('nikanor-stations'), doing: { metzora: 'Standing in Sha\'ar Nikanor: he puts his head, then his hand, then his foot into the court, for the blood and then the oil on his right ear, thumb and toe' } },
    'metzora-kohanim': { phrase: 'a kohen at the metzora\'s asham', key: tkey('nikanor-stations'), doing: { metzora: 'The metzora\'s asham: its blood taken in a vessel for the altar and in a kohen\'s palm for the man; then the log of oil, sprinkled seven times toward the west' } },
    asham: { custom: (ctx, state, who, t) => ({ doing: { en: 'The metzora\'s asham: waved alive with his log of oil, then slaughtered in the north' }, phrase: { en: 'the metzora\'s asham, a lamb' }, eventId: 'metzora', why: { en: 'On the eighth day the metzora brings two male lambs and a ewe lamb; the asham and the log of oil are waved, and of its blood the kohen puts on his right ear, thumb and toe.', sources: ['Vayikra 14:10–14', 'Negaim 14:8–10'] }, subjectKey: troupeKey('nikanor-stations', state, who, t) }) },
    mothers: { phrase: 'a mother after childbirth', key: tkey('nikanor-stations'), doing: { 'nikanor-purifications': 'Standing in the gateway of Nikanor while her offering is made for her — there the mothers are purified' } },
    zavim: { phrase: 'a healed zav', key: tkey('nikanor-stations'), doing: { 'nikanor-purifications': 'Standing in the gateway while his pair of birds is offered' } },
    'gate-kohanim': { phrase: 'a kohen of the bird offerings', key: tkey('nikanor-stations'), doing: { 'nikanor-purifications': 'Taking a pair of birds at the gate and carrying them to the altar\'s south-west corner' } },
    'metzora-set-kohanim': { custom: (ctx, state, who, t) => describeSet(state, who, t, 'kohen') },
    'metzora-set-lambs': { custom: (ctx, state, who, t) => describeSet(state, who, t, 'lamb') },
    'metzora-set-ewes': { custom: (ctx, state, who, t) => describeSet(state, who, t, 'ewe') },
    'metzora-agent': { custom: (ctx, state, who, t) => describeSet(state, who, t, 'israelite') },
  },
});

// ------------------------------------------------------------------------------------------------ sanhedrin
const COURT = ['sanhedrin', 'court-in-chel'];
export const sanhedrin = describeWith({
  id: 'sanhedrin',
  pools: {
    judges: { phrase: 'a judge of the Great Sanhedrin', key: tkey('sanhedrin'), events: COURT, doing: { sanhedrin: 'In session in the outer half of Lishkat HaGazit — the seventy-one sit like half a round threshing floor, so that they see one another', 'court-in-chel': 'Shabbat: the court sits in the Chel', 'before:sanhedrin': 'Coming up to the session', 'after:sanhedrin': 'Going home after the session' } },
    scribes: { phrase: 'one of the two scribes of the court', key: tkey('sanhedrin'), events: COURT, doing: { _: 'Standing before the judges, writing the words of those who acquit and of those who convict' } },
    candidate: { phrase: 'a kohen whose lineage is examined', key: tkey('sanhedrin'), events: COURT, doing: { _: 'Standing before the Sanhedrin: found fit, he puts on white and goes in to serve with his brothers; unfit, he puts on black and goes out' } },
    askers: { phrase: 'one who has come to the court', key: tkey('sanhedrin'), events: COURT, doing: { _: 'Bringing a question to the court' } },
  },
});

// ------------------------------------------------------------------------------------------------ beit-avtinas
export const avtinas = describeWith({
  id: 'beit-avtinas',
  pools: {
    avtinas: { phrase: 'one of the house of Avtinas, over the making of the incense', key: tkey('beit-avtinas'), doing: { 'avtinas-compounding': 'Compounding the incense: the spices pounded in a mortar — "grind it fine, fine, grind it", for the voice is good for the spices' } },
  },
});
