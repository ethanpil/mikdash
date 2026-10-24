// Keys and gestures: one list for the intro card (short) and the About panel's Controls section (full).
// Matches src/player/input.js (W A S D / arrows, Shift, F, Space/E up, Q/C down, Esc; left-thumb joystick, right-side
// drag look, two-finger tap toggles run; gamepad), the UI's shortcuts (app.js KEYS, '?') and the map's (mappanel.js).
import { h } from './dom.js';

const pointer = () => {
  const mq = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  return { touch: mq('(pointer: coarse)'), fine: mq('(pointer: fine)') };
};

/** the intro's short list: [keys, text] rows for this device */
export function introRows({ touch, fine } = pointer()) {
  const rows = [];
  if (!touch || fine) {
    rows.push([['W', 'A', 'S', 'D'], 'walk'], [['Shift'], 'run'], [['Mouse'], 'look around (click the view)'], [['F'], 'fly / walk'],
      [['T'], 'the hour & what is happening'], [['I'], 'about this place'], [['M'], 'plan'], [['?'], 'all controls, sources & credits']);
  }
  if (touch) {
    rows.push([['Left thumb'], 'walk'], [['Right thumb'], 'look around'], [['Two fingers'], 'tap to run / walk'], [['Clock'], 'tap for the hour']);
  }
  return rows;
}

/** the full list, in groups: [{ title, rows: [keys[], text] }] — keys: each string one key cap; 'or' a word between */
export function controlGroups({ touch, fine } = pointer()) {
  const keyboard = !touch || fine;
  const groups = [];
  if (keyboard) {
    groups.push({
      title: 'Walking',
      rows: [
        [['W', 'A', 'S', 'D'], 'walk forward, left, back, right'],
        [['↑', '↓'], 'walk forward / back'],
        [['←', '→'], 'turn'],
        [['Shift'], 'hold to run'],
        [['Mouse'], 'look around: click the view to capture the mouse'],
        [['Esc'], 'free the mouse'],
        [['F'], 'fly / walk'],
        [['Space', 'or', 'E'], 'rise (flying)'],
        [['Q', 'or', 'C'], 'sink (flying)'],
      ],
    });
    groups.push({
      title: 'Panels',
      rows: [
        [['T'], 'the hour: set any time, and what is happening now'],
        [['I'], 'about this place: who may enter, what is done here, sources'],
        [['M'], 'the map: every place, what is happening there, go'],
        [['G'], 'settings'],
        [['?'], 'controls, method, sources & credits'],
        [['Esc'], 'close the open panel'],
      ],
    });
    groups.push({
      title: 'On the map',
      rows: [
        [['Drag'], 'move the plan; wheel or + − to zoom'],
        [['/'], 'search the places'],
        [['Click'], 'select a place; double-click or Enter to go there'],
      ],
    });
  }
  if (touch) {
    groups.push({
      title: 'Touch',
      rows: [
        [['Left thumb'], 'drag to walk: a joystick appears under your thumb'],
        [['Right thumb'], 'drag to look around'],
        [['Two fingers'], 'tap to switch between walking and running'],
        [['Clock'], 'tap for the hour and what is happening now'],
        [['Map'], 'pinch to zoom; tap a place to select it, tap twice to go'],
      ],
    });
  }
  groups.push({ title: 'Gamepad', rows: [[['Left stick'], 'walk'], [['Right stick'], 'look'], [['LT'], 'hold to run'], [['Y'], 'fly / walk'], [['A', 'or', 'B'], 'rise / sink (flying)']] });
  return groups;
}

/** key caps for one row's keys */
export function keyCaps(keys) {
  return keys.map((k) => (k === 'or' ? h('span.mk-keys__or', 'or') : h('span.mk-kbd', k)));
}

/** the full list as a block of grouped rows */
export function controlsEl(opts) {
  return h('div.mk-keys', controlGroups(opts).map((g) => h('div.mk-keys__group',
    h('h4.mk-keys__h', g.title),
    g.rows.map(([keys, text]) => h('div.mk-keys__row', h('span.mk-keys__caps', keyCaps(keys)), h('span.mk-keys__txt', text))))));
}
