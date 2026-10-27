// Search fixture (docs/console-design.md §6.3.2): queries with the documents that must come first. Each entry is
// [query, expected id | [acceptable ids]]; the first 40 must rank an expected document first, the rest in the top 3.
// Where two documents are the same subject (the place and its fixture, the term and the place it names), either counts.

export const TOP1 = [
  ['mizbeach', ['zone:mizbeach', 'el:altar.body']],
  ["mizbe'ach", ['zone:mizbeach', 'el:altar.body']],
  ['mizbeah', ['zone:mizbeach', 'el:altar.body']],
  ['altar', ['el:altar.body', 'zone:mizbeach']],
  ['מזבח', ['zone:mizbeach', 'el:altar.body']],
  ['מִזְבֵּחַ', ['zone:mizbeach', 'el:altar.body']],
  ['המזבח', ['zone:mizbeach', 'el:altar.body']],
  ['nzcj', ['zone:mizbeach', 'el:altar.body']],                     // מזבח typed on an English layout
  ['nikanor', ['zone:nikanor', 'el:azarah.gate.nikanor']],
  ['nicanor', ['zone:nikanor', 'el:azarah.gate.nikanor']],
  ['ezrat nashim', 'zone:ezrat-nashim'],
  ['ezras noshim', 'zone:ezrat-nashim'],
  ["women's court", 'zone:ezrat-nashim'],
  ['עזרת הנשים', 'zone:ezrat-nashim'],
  ['kodesh hakodashim', 'zone:kodesh-hakodashim'],
  ['kodesh kodoshim', ['zone:kodesh-hakodashim', 'term:kodesh hakodashim']],
  ['קודש הקדשים', 'zone:kodesh-hakodashim'],
  ['heichal', 'zone:heichal'],
  ['hekhal', ['zone:heichal', 'term:heichal']],
  ['היכל', ['zone:heichal', 'term:heichal']],
  ['lishkat hagazit', ['zone:gazit', 'el:azarah.chamber.gazit']],
  ['gazit', ['zone:gazit', 'el:azarah.chamber.gazit']],
  ['kiyor', ['zone:kiyor', 'el:altar.kiyor']],
  ['laver', ['el:altar.kiyor', 'zone:kiyor']],
  ['כיור', ['zone:kiyor', 'el:altar.kiyor']],
  ['olah', 'offering:olah'],
  ['ola', 'offering:olah'],
  ['burnt offering', 'offering:olah'],
  ['עולה', 'offering:olah'],
  ['chatat', 'offering:chatat'],
  ['chatas', 'offering:chatat'],
  ['sin offering', 'offering:chatat'],
  ['kohen gadol', 'role:kohen_gadol'],
  ['beit hamoked', 'zone:beit-hamoked'],
  ['beis hamoked', 'zone:beit-hamoked'],
  ['menorah', 'el:heichal.menorah'],
  ['מנורה', 'el:heichal.menorah'],
  ['shulchan', 'el:heichal.shulchan'],
  ['subtitles', 'setting:captions'],
  ['volume', 'setting:volume'],
];

export const TOP3 = [
  ['נקנור', ['zone:nikanor', 'el:azarah.gate.nikanor']],
  ['ניקנור', ['zone:nikanor', 'el:azarah.gate.nikanor']],
  ['holy of holies', ['zone:kodesh-hakodashim', 'term:kodesh hakodashim']],
  ['קדש הקדשים', ['zone:kodesh-hakodashim', 'term:kodesh hakodashim']],
  ['chamber of hewn stone', ['zone:gazit', 'el:azarah.chamber.gazit']],
  ['tamid', ['term:tamid', 'event:tamid-slaughter', 'event:tamid-afternoon']],
  ['תמיד', ['term:tamid', 'event:tamid-slaughter', 'event:tamid-afternoon']],
  ['morning tamid', 'event:tamid-slaughter'],
  ['semichah', 'term:semichah'],
  ['smicha', 'term:semichah'],
  ['leaning', ['term:semichah', 'event:private-offerings']],
  ['shofar', ['term:shofar', 'el:en.shofarot']],
  ['levites', ['role:levi', 'term:levi']],
  ["levi'im", ['role:levi', 'term:levi']],
  ['duchan', ['el:azarah.duchan', 'term:duchan']],
  ['captions', 'setting:captions'],
  ['mouse', ['setting:lookMode', 'setting:mouseSensitivity', 'setting:invertY']],
  ['pause', 'cmd:pause'],
  ['high priest', ['role:kohen_gadol', 'term:kohen gadol']],
  ['shushan', ['zone:shushan-habirah', 'zone:gate-shushan', 'el:mount.gate.shushan']],
  ['chuldah', ['zone:gate-chuldah-w', 'zone:gate-chuldah-e', 'el:mount.gate.chuldah-w', 'el:mount.gate.chuldah-e']],
  ['huldah', ['zone:gate-chuldah-w', 'zone:gate-chuldah-e', 'el:mount.gate.chuldah-w', 'el:mount.gate.chuldah-e']],
  ['parochet', ['el:heichal.parochet.outer', 'el:heichal.parochet.inner', 'term:parochet']],
  ['paroches', ['el:heichal.parochet.outer', 'el:heichal.parochet.inner', 'term:parochet']],
  ['curtain', ['el:heichal.parochet.outer', 'el:heichal.parochet.inner', 'el:heichal.ulam-curtain', 'el:heichal.gate-curtain']],
  ['showbread', ['el:heichal.shulchan', 'term:lechem hapanim']],
  ['lechem hapanim', ['el:heichal.shulchan', 'term:lechem hapanim']],
  // typos (Damerau 1)
  ['mizbaech', ['zone:mizbeach', 'el:altar.body']],
  ['nikaonr', ['zone:nikanor', 'el:azarah.gate.nikanor']],
  ['menroah', 'el:heichal.menorah'],
  // prefixes and partial typing
  ['ezrat yis', 'zone:ezrat-yisrael'],
  ['bein haulam', 'zone:bein-haulam-lamizbeach'],
  ['בעזרה', 'zone:azarah'],
  ['ש', null],                                                           // one Hebrew letter: allowed (any result)
  // wrong layout, Hebrew typed meaning Latin
  ['שךאשר', ['el:altar.body', 'zone:mizbeach']],                       // "altar" on a Hebrew layout
  // offering types and roles
  ['shelamim', 'offering:shelamim'],
  ['todah', 'offering:todah'],
  ['thanksgiving', 'offering:todah'],
  ['bikkurim', ['offering:bikkurim', 'term:bikkurim']],
  ['first fruits', ['offering:bikkurim', 'term:bikkurim']],
  ['nazir', ['role:nazir', 'offering:nazir', 'term:nazir']],
  ['segan', ['role:segan', 'term:segan']],
  ['metzora', ['role:metzora', 'offering:metzora', 'term:metzora']],
  // places
  ['azarah', 'zone:azarah'],
  ['ulam', 'zone:ulam'],
  ['chel', 'zone:chel'],
  ['soreg', ['zone:soreg', 'term:soreg']],
  ['fifteen steps', ['zone:fifteen-steps', 'el:en.steps15']],
  ['15 steps', ['el:en.steps15', 'zone:fifteen-steps']],
  ['kevesh', ['zone:kevesh', 'el:altar.kevesh']],
  ['ramp', ['el:altar.kevesh', 'zone:kevesh']],
  ['har habayit', 'zone:har-habayit'],
  ['temple mount', 'zone:har-habayit'],
  ['הר הבית', 'zone:har-habayit'],
  ['mount of olives', 'zone:har-hamishchah'],
  // things
  ['golden altar', 'el:heichal.mizbach-hazahav'],
  ['incense', ['el:heichal.mizbach-hazahav', 'term:ketoret', 'event:ketoret-morning', 'event:second-pile', 'zone:beit-avtinas']],
  ['foundation stone', 'el:heichal.even-shetiyah'],
  ['red line', 'el:altar.chut-hasikra'],
  ['rings', 'el:altar.rings'],
  ['golden vine', 'el:heichal.ulam.vine'],
  // rites
  ['birkat kohanim', ['event:birkat-kohanim', 'term:birkat kohanim']],
  ['terumat hadeshen', ['event:terumat-hadeshen', 'term:terumat hadeshen']],
  ['barkai', ['event:barkai', 'term:barkai']],
  ['lottery', ['event:first-lottery', 'event:second-lottery', 'event:third-fourth-lottery', 'event:afternoon-lottery']],
  ['ketoret', ['term:ketoret', 'event:ketoret-morning', 'event:ketoret-afternoon']],
  ['menorah lighting', 'event:menorah-lighting'],
  // UI documents (A's, mirrored in the fixture)
  ['fov', 'setting:fov'],
  ['quality', 'setting:quality'],
  ['fly', 'cmd:fly'],
  ['controls', 'help:controls'],
  ['glossary', 'learn:words'],
  ['sanctity', 'learn:how'],
];

/**
 * Run with the observer at Sha'ar Nikanor and every rite in progress (searchtest.mjs): each must rank an expected
 * document first. These once lost to skeleton, typo or word-inside matches on nearby rites lifted by the context boosts
 * (huldah → "A healed metzora", mouse → "Mothers…", altar → "Blood on the altar…").
 */
export const CONTEXT = [
  ['huldah', ['zone:gate-chuldah-w', 'zone:gate-chuldah-e', 'el:mount.gate.chuldah-w', 'el:mount.gate.chuldah-e']],
  ['altar', ['el:altar.body', 'zone:mizbeach']],
  ['mouse', ['setting:lookMode', 'setting:mouseSensitivity', 'setting:invertY']],
  ['שךאשר', ['el:altar.body', 'zone:mizbeach']],                       // "altar" on a Hebrew layout
  ['nikanor', ['zone:nikanor', 'el:azarah.gate.nikanor']],
];

/**
 * A's UI documents as of this build (src/ui/console/sections/settings.js LABELS, commands.js COMMANDS, learn.js
 * LEARN_SECTIONS, help.js HELP_TOPICS): the app adds them through search.add; the node test has no DOM, so a copy.
 */
export const UI_DOCS = [
  ...[['travelWay', 'Way to travel', ['travel', 'go', 'walk', 'run', 'instant', 'default']], ['travelPace', 'Pace', ['travel', 'speed', 'faster', 'slower', 'pace']],
    ['lookMode', 'Look mode', ['mouse', 'pointer lock', 'drag', 'look', 'camera', 'trackpad']], ['mouseSensitivity', 'Look sensitivity', ['mouse', 'sensitivity', 'look speed', 'touch']],
    ['invertY', 'Invert vertical look', ['invert', 'mouse', 'look', 'y axis']], ['fov', 'Field of view', ['fov', 'zoom', 'wide', 'angle', 'camera']],
    ['headBob', 'Head bob', ['bob', 'sway', 'motion', 'walking']], ['quickChips', 'Quick chips', ['chips', 'wake', 'menu', 'buttons']],
    ['areaNames', 'Area names', ['banner', 'names', 'places', 'entering', 'arrived']], ['restrictedNotices', 'Restricted-area notices', ['restricted', 'access', 'notice', 'kohanim', 'warning']],
    ['labels', 'Activity markers', ['markers', 'labels', 'tags', 'diamonds', 'activity']], ['aggadah', 'Aggadah layer', ['aggadah', 'miracles', 'traditions', 'legends']],
    ['reducedMotion', 'Reduce motion', ['motion', 'animation', 'accessibility', 'sickness']], ['quality', 'Graphics quality', ['quality', 'graphics', 'performance', 'gpu', 'low', 'high', 'ultra']],
    ['amah', 'Length of the amah', ['amah', 'cubit', 'measure', 'scale', 'naeh', 'chazon ish', 'feinstein']], ['volume', 'Volume', ['volume', 'sound', 'audio', 'loud']],
    ['captions', 'Subtitles', ['subtitles', 'captions', 'text', 'hearing']], ['musicStyle', 'Music', ['music', 'levites', 'song', 'instruments', 'shiltei hagiborim']],
  ].map(([k, t, kw]) => ({ id: `setting:${k}`, kind: 'setting', title: { en: t }, keywords: kw })),
  ...[['pause', 'Pause the clock', ['stop', 'freeze', 'time', 'hold']], ['speed-10', 'Clock speed 10×', ['speed', 'fast', 'faster', 'time', 'clock', '10x', '10×']],
    ['fly', 'Fly', ['fly', 'air', 'above', 'float']], ['subtitles-off', 'Subtitles off', ['subtitles', 'captions', 'text']],
    ['sound-off', 'Sound off', ['mute', 'silence', 'quiet', 'audio', 'volume']], ['welcome', 'Replay the welcome', ['intro', 'start', 'introduction', 'tutorial']],
    ['ahead', 'What’s ahead?', ['ahead', 'front', 'what is this', 'inspect', 'look']],
  ].map(([k, t, kw]) => ({ id: `cmd:${k}`, kind: 'command', title: { en: t }, keywords: kw })),
  ...[['places', 'Places', ['zones', 'courts', 'chambers', 'gates']], ['rites', 'Rites & events', ['service', 'schedule', 'order of the day']],
    ['people', 'People', ['roles', 'kohanim', 'levites', 'who']], ['things', 'Things', ['objects', 'vessels', 'gates', 'elements']],
    ['offerings', 'Offerings', ['korbanot', 'sacrifices', 'olah', 'chatat']], ['words', 'Words', ['glossary', 'terms', 'dictionary', 'hebrew']],
    ['how', 'How to read', ['badges', 'confidence', 'sanctity', 'ladder', 'rungs']], ['method', 'Method', ['sources', 'how it was made', 'reconstruction']],
    ['choices', 'Where the sources differ', ['machloket', 'disputes', 'readings', 'choices']], ['amah', 'The amah', ['cubit', 'measure', 'length', 'chazon ish', 'naeh', 'feinstein']],
    ['credits', 'Credits & licences', ['credits', 'licences', 'licenses', 'fonts', 'three.js']],
  ].map(([k, t, kw]) => ({ id: `learn:${k}`, kind: 'learn', title: { en: t }, keywords: kw })),
  ...[['essentials', 'The essentials', ['help', 'how', 'start', 'keys']], ['controls', 'Your controls', ['controls', 'keys', 'keyboard', 'mouse', 'touch', 'gamepad', 'screen reader', 'shortcuts']],
    ['welcome', 'Replay the welcome', ['intro', 'welcome', 'start again']], ['symbols', 'What the symbols mean', ['symbols', 'badges', 'icons', 'diamonds', 'rungs']],
  ].map(([k, t, kw]) => ({ id: `help:${k}`, kind: 'help', title: { en: t }, keywords: kw })),
];
