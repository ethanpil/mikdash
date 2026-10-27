// Inspect hooks for the sanctuary, the song and the Shabbat modules: ketoret-morning (G3 — the clearing, the incense, the
// blessing, the libation and its song, the ma'amad, the afternoon lamps), gazit-shema, and G6's shabbat-eve,
// shabbat-mishmar, shabbat-musaf and shabbat-showbread. Texts follow Tamid 3:9, 5:1–7:4, Sukkah 5:5–8, Menachot 11:7.
import { describeWith } from './index.js';
import { SRV } from '../g3/day.js';
import { LEVITES } from '../g3/song.js';

const SONGS = ['song-weekday', 'song-friday', 'song-shabbat', 'afternoon-song', 'afternoon-song-shabbat', 'libation'];
const BLESS = 'On the steps of the Ulam, blessing the people with one blessing — the Name said as it is written, hands raised above their heads';
const SING = 'Singing the psalm of the day on the duchan, in three sections; at each break the trumpets sound and the people prostrate';
const G3 = ['inner-clearing', 'coal-pan', 'magrefah', 'into-heichal', 'ketoret-morning', 'birkat-kohanim', 'ketoret-afternoon', 'menorah-lighting', ...SONGS, 'maamad-morning', 'maamad-afternoon'];

const srv = (i) => Object.keys(SRV).find((k) => SRV[k] === i) || 'X';

export const ketoret = describeWith({
  id: 'ketoret-morning',
  pools: {
    clearing: {
      sub: (who) => (who.index === 0 ? 'A' : 'B'), events: G3,
      phrase: { A: 'the kohen who won the clearing of the inner altar', B: 'the kohen who won the clearing of the Menorah' },
      doing: {
        'inner-clearing': { A: 'Scooping the ashes of the golden altar into the teni with his hands', B: 'Dressing the Menorah\'s lamps from the stone with three steps — five cleaned, the two eastern left burning; the kuz set on the second step' },
        'into-heichal': { A: 'Going up before the others: he takes the teni, prostrates and goes out', B: 'Cleaning the eastern lamp and leaving the western burning, from which the Menorah is lit in the evening; taking the kuz from the second step' },
        'coal-pan': 'Back from the Heichal; he will go up the Ulam steps before the others',
        magrefah: 'Coming to the Ulam steps, to go up before the others',
        'ketoret-morning': 'Out of the Heichal: all withdraw while the incense is burned',
        'birkat-kohanim': `${BLESS}; he holds one of the five vessels`,
        'menorah-lighting': { B: 'Lighting the Menorah in the afternoon from the western lamp', _: 'At the afternoon service' },
        'ketoret-afternoon': 'At the afternoon incense',
      },
    },
    gazit: {
      sub: (who) => (who.index === 3 ? 'I' : who.index === 4 ? 'P' : 'G'), events: G3,
      phrase: { I: 'the kohen who won the incense — new men only, for it brings wealth', P: 'the kohen who won the coal pan', G: 'one of the kohanim of Lishkat HaGazit' },
      doing: {
        'coal-pan': { P: 'With the silver pan up to the top of the altar: clearing the coals this way and that and scooping; down, and emptying them into the gold pan', I: 'Taking the kaf, with the dish heaped with incense inside it and its cover', _: 'In Lishkat HaGazit' },
        magrefah: { P: 'Coming with the coals to the Ulam as the magrefah is thrown', I: 'Coming with the incense to the Ulam as the magrefah is thrown', _: 'Running in at the magrefah\'s crash' },
        'into-heichal': { P: 'Heaping the coals on the golden altar and spreading them with the rim of the pan; he prostrates and goes out', I: 'Into the Heichal with the incense', _: 'Climbing the Ulam steps' },
        'ketoret-morning': { I: 'Alone in the Heichal: at the officer\'s "Hakter!" he lays the incense on the coals, prostrates and goes out; its smoke rises straight', _: 'Withdrawn while the incense is burned' },
        'birkat-kohanim': BLESS,
        _: { P: 'At the service of the coals', I: 'At the service of the incense', G: 'At the service' },
      },
    },
    servers: {
      sub: (who) => srv(who.index), events: G3,
      phrase: {
        F: 'the incense man\'s friend', M: 'the officer (memuneh)', I2: 'the kohen who won the afternoon incense', F2: 'the friend of the afternoon\'s incense man',
        T1: 'one of the two trumpeters', T2: 'one of the two trumpeters', W2: 'the kohen who pours the afternoon wine', P2: 'the kohen of the afternoon\'s coal pan', B2: 'the kohen who lights the Menorah on Shabbat afternoon', X: 'a kohen of the service',
      },
      doing: {
        'ketoret-morning': { F: 'Taking the dish from the kaf and pouring the incense into the incense man\'s hands: "Take care not to begin in front of you, lest you be burned"', M: '"Hakter!" — and the people withdraw from the Heichal and from between the Ulam and the altar', _: 'Withdrawn while the incense is burned' },
        'ketoret-afternoon': { I2: 'Burning the afternoon incense, alone in the Heichal', F2: 'Pouring the incense into the incense man\'s hands', M: '"Hakter!"', P2: 'Bringing the coals for the afternoon incense', _: 'At the afternoon incense' },
        'menorah-lighting': { B2: 'Lighting the Menorah from the western lamp', _: 'At the lighting of the Menorah' },
        libation: { T1: 'On the table of the fats with a silver trumpet: teki\'ah, teru\'ah, teki\'ah; then to the side of the Levite with the cymbal', T2: 'On the table of the fats with a silver trumpet: teki\'ah, teru\'ah, teki\'ah; then to the side of the Levite with the cymbal', _: 'At the libation' },
        'afternoon-song': { T1: 'Sounding the trumpets at the afternoon libation', T2: 'Sounding the trumpets at the afternoon libation', W2: 'Pouring the afternoon wine at the south-west horn', _: 'At the afternoon libation' },
        'afternoon-song-shabbat': { T1: 'Sounding the trumpets at the afternoon libation', T2: 'Sounding the trumpets at the afternoon libation', W2: 'Pouring the afternoon wine at the south-west horn', _: 'At the afternoon libation' },
        'birkat-kohanim': BLESS,
        _: 'At the service of the incense',
      },
    },
    brothers: {
      sub: (who) => (who.index === 12 ? 'WINE' : 'B'), events: G3,
      phrase: { WINE: 'the kohen who won the wine', B: 'one of the kohanim of the day\'s service' },
      doing: {
        'coal-pan': 'Waiting by Lishkat HaGazit until the magrefah is thrown',
        magrefah: 'Running in at the crash of the magrefah — kohanim to prostrate',
        'into-heichal': 'Climbing the Ulam steps after the two who cleared the inner altar and the Menorah',
        'ketoret-morning': 'Withdrawn from between the Ulam and the altar while the incense is burned; then going in to prostrate',
        'birkat-kohanim': BLESS,
        libation: { WINE: 'Pouring the wine at the south-west horn — he bends to pour, the segan waves the flags, the cymbal sounds and the song begins', B: 'At the libation' },
        'song-weekday': { WINE: 'The wine poured; the Levites sing', B: 'Prostrating at each blast of the song' },
        'song-friday': { WINE: 'The wine poured; the Levites sing', B: 'Prostrating at each blast of the song' },
        'song-shabbat': { WINE: 'The wine poured; the Levites sing', B: 'Prostrating at each blast of the song' },
      },
    },
    segan: {
      phrase: 'the segan, deputy of the Kohen Gadol', events: G3,
      doing: { libation: 'Standing on the horn of the altar with the flags in his hand; as the wine is poured he waves them', 'afternoon-song': 'On the horn of the altar with the flags', 'afternoon-song-shabbat': 'On the horn of the altar with the flags', 'ketoret-morning': (ctx) => (ctx.time?.dayType === 'shabbat' ? 'With the Kohen Gadol as he goes in to prostrate' : 'Waiting for the libation'), _: 'Waiting for the libation, when he stands on the horn of the altar with the flags' },
    },
    kg: {
      phrase: 'the Kohen Gadol', events: G3,
      doing: { 'ketoret-morning': 'Going in to prostrate: three hold him — at his right, at his left, and at the precious stones; the officer lifts the curtain for him', 'birkat-kohanim': 'Blessing the people — not raising his hands above the tzitz', libation: 'Offering the wine himself', _: 'At the service' },
    },
    levites: {
      sub: (who) => (LEVITES[who.index]?.inst || 'voice'), events: G3,
      phrase: { cymbal: 'the Levite of the cymbal — one cymbal only (the office the Mishnah names for Ben Arza)', kinnor: 'a Levite with a kinnor', nevel: 'a Levite with a nevel', voice: 'a Levite singer' },
      doing: {
        libation: { cymbal: 'Striking the cymbal as the segan waves the flags — and the Levites begin the song', _: 'On the duchan, ready for the song' },
        'song-weekday': SING, 'song-friday': SING, 'song-shabbat': SING,
        'afternoon-song': SING, 'afternoon-song-shabbat': 'Shabbat afternoon: singing the Song at the Sea on the duchan', magrefah: 'Running to the duchan at the magrefah\'s crash',
        _: (ctx, state, who) => (/walk|run/.test(who.slot?.actor?.poseName || '') ? 'Coming to the duchan from the chambers of the instruments' : 'On the duchan, waiting for the libation'),
      },
    },
    boys: { phrase: 'a Levite boy', events: G3, doing: { _: 'Singing with the Levites, standing on the ground below the duchan, his head between their feet' } },
  },
  crowd(ctx, state, who, t, sim) {
    const ci = who.index;
    const ev = ['maamad-morning', 'maamad-afternoon'].map((id) => sim.event(id)).find((e) => e && Number.isFinite(e.t0) && ((e.t0 <= e.t1 && t >= e.t0 && t < e.t1) || (e.t0 > e.t1 && (t >= e.t0 || t < e.t1))));
    if (ci <= 2) {
      return {
        phrase: { en: "Israelites of the ma'amad" }, eventId: ev?.id,
        doing: { en: 'Standing over the daily offering in Ezrat Yisrael; at every blast of the song they prostrate' },
        why: { en: "The ma'amad: Israelites of the week's delegation stand over the tamid — 'how can a man's offering be brought and he not stand over it?'", sources: ['Taanit 4:2', 'Tamid 7:3'] },
      };
    }
    return { phrase: { en: 'Israelites' }, doing: { en: ci === 3 ? 'Coming up through Sha\'ar Nikanor to Ezrat Yisrael' : 'Going out through Sha\'ar Nikanor' }, eventId: ev?.id };
  },
});

// ------------------------------------------------------------------------------------------------ gazit-shema
const SHEMA = 'Reading the Shema in Lishkat HaGazit: one blessing, the Ten Commandments, Shema, Vehayah im shamoa and Vayomer; then the three blessings — Emet veyatziv, Avodah and the priestly blessing';
export const gazitShema = describeWith({
  id: 'gazit-shema',
  pools: {
    kohanim: { phrase: 'one of the kohanim of the day', doing: { 'gazit-shema': SHEMA, 'outgoing-blessing': 'Blessing the incoming watch: "May He who caused His Name to dwell in this House cause love and brotherhood, peace and friendship to dwell among you"' } },
    incoming: { phrase: 'one of the incoming watch', doing: { 'gazit-shema': SHEMA, 'outgoing-blessing': 'Receiving the outgoing watch\'s blessing' } },
    'tamid-crew': { phrase: 'one of the crew of the morning tamid', doing: { 'before:gazit-shema': 'Coming down from the ramp, the parts laid and salted, to Lishkat HaGazit for the Shema', 'gazit-shema': SHEMA } },
    officer: { phrase: 'the officer (memuneh)', doing: { 'gazit-shema': '"Recite one blessing" — and they bless', 'outgoing-blessing': 'Bidding the outgoing watch bless the incoming' } },
  },
});

// ------------------------------------------------------------------------------------------------ Shabbat
export const shabbatEve = describeWith({
  id: 'shabbat-eve',
  pools: {
    trumpeters: {
      phrase: 'one of the two kohanim with silver trumpets',
      doing: { 'friday-blasts-work': 'Friday: three blasts to make the people stop their work (the place, a roof, is the model\'s)', 'friday-blasts-holy': 'Three blasts more, to separate the holy from the profane' },
    },
  },
});

export const shabbatMishmar = describeWith({
  id: 'shabbat-mishmar',
  pools: {
    outgoing: { phrase: 'one of the outgoing watch', doing: { 'showbread-divided': 'The outgoing watch divides its six loaves in the south of the court — so all may see who is going home', 'showbread-eaten': 'Eating his piece of the showbread in the court' } },
    incoming: { phrase: 'one of the incoming watch', doing: { 'showbread-divided': 'The incoming watch divides its six loaves in the north of the court — so all may see who is arriving', 'showbread-eaten': 'Eating his piece of the showbread in the court' } },
    'kohen-gadol': { phrase: 'the Kohen Gadol, who takes a portion first', doing: { 'showbread-eaten': 'Eating from his loaves, standing in the court', 'showbread-divided': 'Waiting for his loaves of the bread' } },
    'kg-kohanim': { phrase: 'one of the kohanim with the Kohen Gadol', doing: { 'showbread-eaten': (ctx, state, who, t) => (who.index < 2 && Number.isFinite(state.plan?.kg?.t?.take) && t < state.plan.kg.t.take ? 'Bringing the Kohen Gadol his loaves' : 'Eating with the Kohen Gadol in the court, from his loaves'), 'showbread-divided': 'Taking the Kohen Gadol\'s loaves from the stacks, before the shares' } },
  },
});

export const shabbatMusaf = describeWith({
  id: 'shabbat-musaf',
  pools: {
    crew: { phrase: 'one of the morning\'s crew — whoever won a task at the morning tamid does it for the musaf lambs', doing: { 'shabbat-musaf': 'The Shabbat musaf: two yearling lambs, slaughtered at the rings, their blood thrown, flayed and their parts carried to the ramp' } },
    'limbs-up': { phrase: 'one of those who carry the parts up to the altar', doing: { 'shabbat-musaf': 'Carrying the musaf\'s parts up the ramp to the great pile' } },
    pourer: { phrase: 'the kohen who pours the musaf wine', doing: { 'shabbat-musaf': 'Pouring the musaf\'s wine at the south-west horn' } },
    levites: { phrase: 'a Levite leading the musaf lambs (who led them is not recorded: a reconstruction)', doing: { 'shabbat-musaf': 'Bringing a musaf lamb up the flight of Sha\'ar HaKorban' } },
    lambs: { custom: (ctx, state, who) => ({ doing: { en: 'A lamb of the Shabbat musaf' }, phrase: { en: 'one of the two lambs of the Shabbat musaf' }, eventId: 'shabbat-musaf', why: { en: 'On Shabbat, two yearling lambs without blemish for an olah, with their meal-offering and libation.', sources: ['Bamidbar 28:9–10'] }, subjectKey: `shabbat-musaf:lambs:${who.index}` }) },
    trumpeters: { phrase: 'one of the two trumpeters', doing: { 'shabbat-musaf': 'Sounding the silver trumpets at the musaf libation' } },
  },
});

export const shabbatShowbread = describeWith({
  id: 'shabbat-showbread',
  pools: {
    incoming: {
      phrase: 'one of the four of the incoming watch who bring the new bread — two with the stacks, two with the dishes of frankincense',
      doing: {
        'showbread-swap': 'Bringing in the new bread and frankincense: the new stacks slid on from the north as the old are drawn off to the south — "the handbreadth of one beside the handbreadth of the other"',
        bazichin: 'Carrying the old dishes of frankincense up the ramp and burning it on the incense pile',
        'bread-warm': 'The old bread, out on the gold table in the Ulam',
      },
    },
    outgoing: {
      phrase: 'one of the four of the outgoing watch who take the old bread',
      doing: { 'showbread-swap': 'Drawing the old stacks off the Shulchan to the south as the new are slid on; carrying them out to the gold table in the Ulam', 'bread-warm': 'Laying his hand on the old loaves: as warm as on the day they were set', bazichin: 'At the bread' },
    },
  },
});
