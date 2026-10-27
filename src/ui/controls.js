// Keys, gestures and buttons per device: the single source for Help → Your controls, the Welcome's three lines and
// README's controls section (keep README in step). Matches the player's input (src/player/input.js: W A S D / arrows,
// Shift, F, Space up, Q/C down; E inspects; left-thumb joystick, right-side drag look, two-finger tap toggles run;
// gamepad) and the console's own keys (src/ui/app.js: Esc, M, T, I, /, Ctrl+K, ?, P, + −; the map's keys).
import { h } from './dom.js';

export const DEVICES = [
  { id: 'mouse', label: 'Mouse & keyboard' },
  { id: 'touch', label: 'Touch' },
  { id: 'pad', label: 'Gamepad' },
  { id: 'sr', label: 'Screen reader' },
];

/** The essentials, printed at the top of Help and on the Welcome (console §2.4) */
export const ESSENTIALS = 'Esc = Menu · E / click / tap = learn about anything · Go ▸ = travel.';

/** the device a fresh page most likely uses */
export function guessDevice() {
  const mq = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  return mq('(pointer: coarse)') && !mq('(pointer: fine)') ? 'touch' : 'mouse';
}

/** the Welcome's three lines per device: [keys[], text] */
export function welcomeLines(device) {
  if (device === 'touch') {
    return [[['Left thumb'], 'walks; the right thumb looks around'], [['Menu'], 'the Menu button (bottom-right): everything else'], [['Tap'], 'anyone or anything to learn about it']];
  }
  if (device === 'pad') {
    return [[['Sticks'], 'walk and look'], [['☰ Menu'], 'everything else'], [['X'], 'learn about what you face']];
  }
  return [[['W', 'A', 'S', 'D'], 'to walk, the mouse to look'], [['Esc'], 'or the Menu button (top-left): everything else'], [['Click'], 'anyone or anything to learn about it']];
}

/** the full list for a device, in groups: [{ title, rows: [keys[], text] }]; 'or' between keys is a word */
export function controlGroups(device = guessDevice()) {
  if (device === 'touch') {
    return [
      { title: 'Walking and looking', rows: [
        [['Left thumb'], 'drag to walk: a joystick appears under your thumb'],
        [['Right thumb'], 'drag to look around'],
        [['Two fingers'], 'tap to switch between walking and running'],
        [['Rise', 'or', 'Sink'], 'buttons while flying (Menu → Fly)'],
      ] },
      { title: 'The Menu', rows: [
        [['Menu'], 'the button bottom-right: where you are, the map, the hour and everything else'],
        [['Tap'], 'empty scenery to show the quick chips (the hour, Map, Search)'],
        [['‹ Menu'], 'back to the tiles; Close, drag the sheet down, or the system back closes'],
      ] },
      { title: 'Learn about anything', rows: [
        [['Tap'], 'anyone or anything: its card, with Go ▸ and Show me ▸'],
        [['Here'], 'Nearby lists everyone and everything around you'],
      ] },
      { title: 'On the map', rows: [
        [['Pinch'], 'zoom; drag to move the plan'],
        [['Tap'], 'select a place; tap twice to go there'],
      ] },
    ];
  }
  if (device === 'pad') {
    return [
      { title: 'Walking and looking', rows: [
        [['Left stick'], 'walk'], [['Right stick'], 'look'], [['LT'], 'hold to run'], [['Y'], 'fly / walk'], [['A', 'or', 'B'], 'rise / sink (flying)'],
      ] },
      { title: 'The Menu', rows: [
        [['☰'], 'Start / Menu: open or close the Menu'], [['View'], 'the map'], [['LB', 'RB'], 'previous / next section'],
        [['D-pad'], 'move between controls'], [['A'], 'choose'], [['B'], 'back, then close'], [['Y'], 'Go on the row in focus'], [['X'], 'Show me on the row in focus'],
      ] },
      { title: 'Learn about anything', rows: [[['X'], 'learn about what you face (the centre of the view)']] },
      { title: 'Travelling', rows: [[['D-pad ←', '→'], 'slower / faster'], [['B'], 'stop (while walking)']] },
    ];
  }
  if (device === 'sr') {
    return [
      { title: 'Finding your way', rows: [
        [['Tab'], 'the Menu button is the first stop: it names where you are'],
        [['Enter'], 'open the Menu; arrow keys on the list of sections switch them'],
        [['Esc'], 'back one level, then close'],
        [['/'], 'search everything: places, rites, people, things, words, settings'],
      ] },
      { title: 'Learn about anything', rows: [
        [['Here'], 'Nearby lists everyone and everything within 15 m, with its direction and distance'],
        [['E'], 'open the card of what is ahead, and hear what it is'],
      ] },
      { title: 'Travelling', rows: [[['Go ▸'], 'walk, run or move at once to any place or rite'], [['+', '−'], 'faster / slower during a trip']] },
    ];
  }
  return [
    { title: 'Walking', rows: [
      [['W', 'A', 'S', 'D'], 'walk forward, left, back, right'],
      [['↑', '↓'], 'walk forward / back'],
      [['←', '→'], 'turn'],
      [['Shift'], 'hold to run'],
      [['Mouse'], 'look around: click the view to capture the mouse (or drag, in Settings → Look & move)'],
      [['F'], 'fly / walk'],
      [['Space'], 'rise (flying)'],
      [['Q', 'or', 'C'], 'sink (flying)'],
    ] },
    { title: 'The Menu', rows: [
      [['Esc'], 'open the Menu (frees the mouse); back one level; close'],
      [['M'], 'the map'],
      [['T'], 'the hour: set any time'],
      [['I'], 'this place'],
      [['/', 'or', 'Ctrl K'], 'search everything'],
      [['?'], 'help: these controls'],
      [['P'], 'pause / play the clock'],
    ] },
    { title: 'Learn about anything', rows: [
      [['Click', 'or', 'E'], 'anyone or anything (mouse free; E at the pointer): its card, with Go ▸ and Show me ▸'],
      [['E', 'or', 'Click'], 'what the centre dot aims at (mouse captured)'],
    ] },
    { title: 'Travelling', rows: [
      [['Go ▸'], 'walk, run or move at once; pace ½× to 10×'],
      [['+', '−'], 'faster / slower during a trip'],
      [['W', 'A', 'S', 'D'], 'stop the trip (looking around does not)'],
    ] },
    { title: 'On the map', rows: [
      [['Drag'], 'move the plan; wheel or + − to zoom'],
      [['Click'], 'select a place; double-click or Enter to go there'],
    ] },
  ];
}

/** key caps for one row's keys */
export function keyCaps(keys) {
  return keys.map((k) => (k === 'or' ? h('span.mk-keys__or', 'or') : h('span.mk-kbd', k)));
}

/** the full list for a device as a block of grouped rows */
export function controlsEl(device) {
  return h('div.mk-keys', controlGroups(device).map((g) => h('div.mk-keys__group',
    h('h4.mk-keys__h', g.title),
    g.rows.map(([keys, text]) => h('div.mk-keys__row', h('span.mk-keys__caps', keyCaps(keys)), h('span.mk-keys__txt', text))))));
}
