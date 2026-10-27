// Inspect hooks for the night and dawn modules that stage the G1 people (g1/plan.js): moked-night, lotteries,
// torch-inspection, altar-night — the same men in each (pools 'group:role': the role is only his dress, so a man is
// keyed 'g1:<group>:<index>' wherever he is staged) — and terumat-hadeshen, barkai, gates, night-watch.
// Texts follow Tamid 1–3, Middot 1 and Yoma 2 (each module's own header names its sources).
import { describeWith } from './index.js';

const SLEEP = /sleep|lie/;
const g1Key = (who) => `g1:${String(who.poolName).split(':')[0]}:${who.index}`;
const pose = (who) => who.slot?.actor?.poseName || who.slot?._pose || '';

// ------------------------------------------------------------------------------------------------ moked-night
const MOKED_EVENTS = ['locking-up', 'moked-night', 'mesibah-keri', 'dawn-immersion', 'gevini', 'memuneh-knock'];
const asleepOr = (asleep, awake) => (ctx, state, who) => (SLEEP.test(pose(who)) ? asleep : awake);
const youngMoked = {
  phrase: 'one of the young kohanim of the day\'s beit av', key: g1Key, events: MOKED_EVENTS,
  doing: {
    'moked-night': asleepOr('Asleep on the floor of Beit HaMoked in his own clothes, the holy garments folded under his head', 'In Beit HaMoked, by the hearth'),
    'dawn-immersion': (ctx, state, who) => (/bath/.test(who.poolName) ? 'Immersing in the Beit HaTevilah before the officer comes, to be ready to clear the altar; then drying and warming himself at the fire' : SLEEP.test(pose(who)) ? 'Asleep on the floor of Beit HaMoked' : 'Up early, waiting by the hearth for the officer'),
    'memuneh-knock': 'Waiting by the hearth: the officer knocks — "Whoever has immersed, come and cast lots"',
    'locking-up': asleepOr('Asleep on the floor of Beit HaMoked', 'In Beit HaMoked as the gates are locked'),
  },
};
export const mokedNight = describeWith({
  id: 'moked-night', prefixes: ['g1:', 'moked-night:'],
  pools: {
    'young:*': youngMoked,
    'keri:*': {
      // until his night's moment he is one of the sleepers: nothing is known of him before it (qa: the phrase ran ahead)
      phrase: (ctx, state, who, t) => {
        const k = ctx.schedule?.byId?.('mesibah-keri');
        const after = k && Number.isFinite(k.t0) && ((t - k.t0 + 1440) % 1440) < ((720 - k.t0 + 1440) % 1440);
        return after ? 'a kohen who became impure in the night' : 'one of the kohanim asleep in Beit HaMoked';
      },
      key: g1Key, events: MOKED_EVENTS,
      doing: {
        'mesibah-keri': 'Down the winding passage under the Birah to the Beit HaTevilah; he immerses, dries himself, warms himself at the fire, and sits by his brothers until the gates open',
        'moked-night': asleepOr('Asleep on the floor of Beit HaMoked', 'Sitting with his brothers until the gates open'),
        'memuneh-knock': 'Sitting with his brothers until the gates open',
        'dawn-immersion': 'Sitting with his brothers until the gates open',
      },
    },
    'slab:*': {
      phrase: 'the kohen who locks the court and sleeps on the keys slab', key: g1Key, events: MOKED_EVENTS,
      doing: {
        'locking-up': 'Locking up: he lifts the marble slab by its ring, takes the keys from the chain, locks from within, hangs the keys back, sets the slab in place and spreads his garment over it',
        'moked-night': asleepOr('Asleep on the keys slab, his garment spread over it', 'In Beit HaMoked'),
        'dawn-immersion': (ctx, state, who) => (/bath/.test(who.poolName) ? 'Immersing before dawn, to be ready to clear the altar' : 'Up early, waiting for the officer'),
        'memuneh-knock': 'Waiting by the hearth for the lottery',
      },
    },
    'elders:*': {
      phrase: 'an elder of the beit av', key: g1Key, events: MOKED_EVENTS,
      doing: {
        'moked-night': asleepOr('Asleep on the stone ledges round the hall, the keys of the Azarah in hand', 'Awake on the ledges of Beit HaMoked'),
        'locking-up': asleepOr('Asleep on the stone ledges round the hall', 'On the ledges of Beit HaMoked as the court is locked'),
        'memuneh-knock': asleepOr('Asleep on the stone ledges', 'Opening to the officer\'s knock'),
        'dawn-immersion': asleepOr('Asleep on the stone ledges', 'Awake on the ledges of Beit HaMoked'),
      },
    },
    'levite:*': { phrase: 'the Levite who sleeps outside the door', key: g1Key, events: MOKED_EVENTS, doing: { 'locking-up': 'The kohen locks from within; the Levite sleeps outside', 'moked-night': 'Asleep outside the door of Beit HaMoked' } },
    'officer:*': { phrase: 'the officer (memuneh)', key: g1Key, events: MOKED_EVENTS, doing: { 'memuneh-knock': 'The officer comes and knocks; they open to him: "Whoever has immersed — come and cast lots!"' } },
    'gevini:*': { phrase: 'the crier (the office the Mishnah names for Gevini)', key: g1Key, events: MOKED_EVENTS, doing: { gevini: 'Crying out at the head of the fifteen steps: "Arise, kohanim, to your service; Levites, to your platform; Israelites, to your ma\'amad!"' }, why: { gevini: { en: 'Gevini the crier; his voice was heard three parsaot away, and Agrippa sent him gifts for it.', sources: ['Shekalim 5:1', 'Yoma 20b', 'Tamid 3:8'] } } },
  },
});

// ------------------------------------------------------------------------------------------------ lotteries
const LOT_EVENTS = ['first-lottery', 'second-lottery', 'third-fourth-lottery', 'afternoon-lottery', 'afternoon-lottery-shabbat'];
const inCircle = 'In the circle, holding out a finger or two; the officer counts round from one man, and the count decides — a thumb is never put out in the Mikdash';
export const lotteries = describeWith({
  id: 'lotteries', prefixes: ['g1:', 'lotteries:'],
  pools: {
    'slab:k': { phrase: 'the kohen who wins the clearing of the ashes', key: g1Key, events: LOT_EVENTS, doing: { 'first-lottery': 'Casting lots round the hearth — and winning the clearing of the altar', _: inCircle } },
    'officer:k': {
      phrase: 'the officer (memuneh) of the lotteries', key: g1Key, events: LOT_EVENTS,
      doing: {
        'first-lottery': '"Whoever has immersed, come and cast lots": he takes the mitre off one man\'s head and counts the fingers round from him',
        'second-lottery': '"Come and cast lots: who slaughters, who throws, who clears the inner altar, who clears the Menorah, who brings up the limbs…" — thirteen tasks in one draw',
        'third-fourth-lottery': '"New men for the incense, come and cast lots" — then new and old together, for the limbs from the ramp to the altar',
        _: 'Calling the lottery',
      },
    },
    'young:k': { phrase: 'one of the young kohanim who immersed', key: g1Key, events: LOT_EVENTS, doing: { 'first-lottery': inCircle, _: inCircle } },
    'barkai:k': { phrase: 'one of the circle, sent out after the lottery to see if the time has come', events: LOT_EVENTS, doing: { 'second-lottery': inCircle, _: inCircle } },
    'gazit:k': { phrase: 'one of the kohanim in the lottery circle of Lishkat HaGazit', events: LOT_EVENTS, doing: { 'second-lottery': inCircle, 'third-fourth-lottery': inCircle, 'afternoon-lottery': 'Casting lots for the afternoon incense — new men only', 'afternoon-lottery-shabbat': 'The incoming watch cast lots for the afternoon\'s tasks', _: inCircle } },
    'gazit:br': { phrase: 'one who won no task this morning', events: LOT_EVENTS, doing: { 'third-fourth-lottery': 'Handed to the attendants, who take off his garments and leave him only the breeches; the garments go into the niches marked with the vessels\' names', _: 'In the breeches only, his garments laid in their niche' } },
    'chazzan:levi': { phrase: 'an attendant (chazan) — staged as a Levite, a reconstruction', events: LOT_EVENTS, doing: { 'third-fourth-lottery': 'Taking the garments of those who won nothing and laying them in the niches marked with the vessels\' names', _: 'An attendant of Lishkat HaGazit' } },
  },
});

// ------------------------------------------------------------------------------------------------ torch-inspection
const INSP = ['torch-inspection', 'lamp-inspection-shabbat'];
const company = 'Following the officer through the wicket with burning torches; they divide into two companies — one by the colonnade on the east, one on the west — inspecting until they meet at the chamber of the chavitin makers: "Shalom — all is well"';
export const torchInspection = describeWith({
  id: 'torch-inspection', prefixes: ['g1:', 'torch-inspection:'],
  pools: {
    'young:k': { phrase: 'one of the kohanim of the inspection', key: g1Key, events: INSP, doing: { 'torch-inspection': company, 'lamp-inspection-shabbat': 'The inspection on Shabbat: by the light of the lamps, with no torch in hand; two companies, east and west, meeting at the chamber of the chavitin makers' } },
    'slab:k': { phrase: 'the kohen who won the clearing of the ashes', key: g1Key, events: INSP, doing: { 'torch-inspection': company, 'lamp-inspection-shabbat': 'In the inspection by lamplight' } },
    'officer:k': {
      phrase: 'the officer (memuneh)', key: g1Key, events: INSP,
      doing: { _: 'He took the key from under the slab and opened the wicket into the Azarah; the companies inspect east and west and meet at the chavitin makers: "Shalom — all is well"; the bakers are set to work' },
    },
  },
});

// ------------------------------------------------------------------------------------------------ altar-night
const ALTAR = ['evening-altar', 'friday-last-fats', 'shabbat-evening-altar', 'late-turning', 'night-turning', 'shabbat-altar-day', 'fats-burning'];
export const altarNight = describeWith({
  id: 'altar-night', prefixes: ['g1:', 'altar-night:'],
  pools: {
    'young:k': {
      phrase: 'one of the kohanim tending the altar\'s fire', key: g1Key, events: ALTAR,
      doing: {
        'evening-altar': 'Putting the day\'s last limbs and fats on the fire, carried up from where they lay salted on the ramp; tending the pile with a fork',
        'friday-last-fats': 'Friday: the last fats on the fire before Shabbat',
        'shabbat-evening-altar': 'Shabbat: arranging Shabbat\'s own limbs on the fire before sunset; after it only tending them',
        'late-turning': 'Turning what lies on the fire with a fork, so that it burns through by dawn',
        'night-turning': 'Turning what lies on the fire with a fork, so that it burns through by dawn',
        'shabbat-altar-day': 'Tending the great pile with a fork',
        'fats-burning': 'Tending the fire',
      },
    },
  },
});

// ------------------------------------------------------------------------------------------------ terumat-hadeshen
const TH = ['muchni', 'terumat-hadeshen', 'clearing-altar', 'tapuach', 'great-pile', 'second-pile'];
export const terumatHadeshen = describeWith({
  id: 'terumat-hadeshen',
  pools: {
    winner: {
      phrase: 'the kohen who won the clearing of the ashes in the first lottery', events: TH,
      doing: {
        muchni: 'Alone, with no lamp, by the light of the altar fire; the wheel Ben Katin made for the kiyor creaks — and his brothers say "the time has come"',
        'terumat-hadeshen': 'Sanctifying his hands and feet at the kiyor; with the silver pan up the ramp, clearing the coals aside and scooping from the inner, consumed ones; down, and heaping them on the pavement three tefachim from the ramp',
        'clearing-altar': 'On the altar with his brothers, clearing it',
        tapuach: 'Raising the ashes onto the tapuach in the middle of the altar',
        'great-pile': 'Building the great pile on the east of the altar, its face to the east',
        'second-pile': 'Laying the second pile for the incense and the two logs; both piles lit',
      },
    },
    brothers: {
      phrase: 'one of the brothers of the one who cleared the ashes', events: TH,
      doing: {
        muchni: 'Waiting for the sound of the wheel: "the time has come"',
        'terumat-hadeshen': 'Watching for him to come down from the altar',
        'clearing-altar': 'Running to sanctify hands and feet at the kiyor, then up with shovels and forks: the limbs not consumed in the night pushed to the sides of the altar',
        tapuach: 'Raising the ashes onto the tapuach',
        'great-pile': 'Carrying logs up the ramp for the great pile — fig, walnut or oil-tree, never olive or vine',
        'second-pile': 'Choosing fine fig wood for the incense pile; the leftover limbs put back on the fire; then down to Lishkat HaGazit',
      },
    },
    'kiyor-lowerer': {
      custom: () => ({
        doing: { en: 'Lowering the kiyor into its well at the locking of the court, so that its water is not left overnight' },
        phrase: { en: 'the kohen who sinks the kiyor for the night' },
        why: { en: 'Ben Katin made a machine for the kiyor so that its water would not become unfit by staying overnight.', sources: ['Yoma 3:10', 'Yoma 37a', 'Tamid 3:8'] },
        subjectKey: 'terumat-hadeshen:kiyor-lowerer:0',
      }),
    },
  },
});

// ------------------------------------------------------------------------------------------------ barkai
export const barkai = describeWith({
  id: 'barkai',
  pools: {
    watchers: {
      sub: (who) => (who.index === 0 ? 'watcher' : 'asker'),
      phrase: { watcher: 'the kohen sent up to watch the eastern sky', asker: 'the kohen who waits below to ask' },
      doing: {
        'before:barkai': 'Going out at the officer\'s word: "Go out and see whether the time for slaughtering has come"',
        barkai: { watcher: 'On the roof of the Water Gate, watching the east; when it is all lit he calls "Barkai!"', asker: 'Below on the pavement: "Is the whole face of the east lit, as far as Hebron?" — "Yes!"' },
        'after:barkai': 'Going back to tell the officer',
      },
    },
  },
});

// ------------------------------------------------------------------------------------------------ gates
export const gates = describeWith({
  id: 'gates-opening',
  pools: {
    trumpeters: { phrase: 'one of the two kohanim with silver trumpets', doing: { 'gates-blasts': 'Sounding teki\'ah, teru\'ah, teki\'ah on the silver trumpets for the opening of the gates' } },
    'clearing-men': {
      sub: (who) => who.index,
      phrase: { 0: 'the kohen who won the clearing of the inner altar', 1: 'the kohen who won the clearing of the Menorah' },
      doing: { 'dishun-men': 'Going ahead with the teni, the kuz and two keys; the north wicket of the great gate opened, through the cell into the Heichal' },
    },
    'great-gate-opener': {
      phrase: 'the kohen who won the clearing of the inner altar — he opens the gate',
      doing: { 'great-gate': 'Opening the great gate from within: the bolt drawn back, the locks opened — the slaughterer waits for its sound, heard as far as Yericho' },
    },
  },
});

// ------------------------------------------------------------------------------------------------ night-watch
const NW = ['night-watch', 'watch-upper-chambers', 'ish-har-habayit', 'sleeping-guard'];
export const nightWatch = describeWith({
  id: 'night-watch',
  pools: {
    guards: {
      phrase: 'a Levite of the night watch', events: NW,
      doing: {
        'night-watch': (ctx, state, who) => (SLEEP.test(pose(who)) ? 'Asleep at his post' : 'Standing at his post through the night — one of the twenty-one Levite posts; a guard does not sit'),
        'sleeping-guard': (ctx, state, who) => (SLEEP.test(pose(who)) ? 'Found asleep at his post: the officer strikes him with his staff, and may burn his garment' : 'Standing at his post'),
        'ish-har-habayit': (ctx, state, who) => (SLEEP.test(pose(who)) ? 'Asleep at his post' : 'Standing at his post; the officer comes round: "Shalom alecha!"'),
      },
    },
    officer: { phrase: 'the officer of the Mount (Ish Har HaBayit)', events: NW, doing: { 'ish-har-habayit': 'Going round every post with torches burning before him; at each the greeting is "Shalom alecha!" (the Mishnah can be read that he says it to a guard not standing; the Rambam, that the guard stands and greets him) — one found asleep he strikes with his staff', 'sleeping-guard': 'He finds a guard asleep and strikes him with his staff', 'night-watch': 'On his round of the posts' } },
    'torch-bearers': { phrase: 'one of the torch-bearers of the officer of the Mount', events: NW, doing: { _: 'Carrying a burning torch before the officer of the Mount on his round' } },
    rovim: { phrase: 'a young kohen of the watch in the upper chambers', events: NW, doing: { 'watch-upper-chambers': 'On watch in Beit Avtinas or Beit HaNitzotz: asleep in his own clothes, the holy garments folded under his head', _: 'On watch in an upper chamber' } },
  },
});
