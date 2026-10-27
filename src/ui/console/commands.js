// Built-in commands for search (console §4.4): pause, play, clock speeds, fly, walk, subtitles, sound, replay the
// welcome, what's ahead. Each: { id, title: { en }, keywords, key?, run(app) }. Modules add theirs through the registry.
import { soundToggle } from './header.js';

export const COMMANDS = [
  { id: 'pause', title: { en: 'Pause the clock' }, keywords: ['stop', 'freeze', 'time', 'hold'], key: 'P', when: (a) => !a.ctx.time?.paused, run: (a) => a.ctx.time?.pause(true) },
  { id: 'play', title: { en: 'Play the clock' }, keywords: ['resume', 'start', 'time', 'unpause'], key: 'P', when: (a) => !!a.ctx.time?.paused, run: (a) => a.ctx.time?.pause(false) },
  ...[1, 10, 60, 600].map((n) => ({
    id: `speed-${n}`, title: { en: n === 1 ? 'Clock at real time (1×)' : `Clock speed ${n}×` }, keywords: ['speed', 'fast', 'faster', 'time', 'clock', `${n}x`, `${n}×`],
    run: (a) => { a.ctx.time?.setSpeed(n); a.ctx.time?.pause(false); },
  })),
  { id: 'fly', title: { en: 'Fly' }, keywords: ['fly', 'air', 'above', 'float'], key: 'F', when: (a) => a.ctx.player?.mode !== 'fly', run: (a) => a.ctx.player?.setMode?.('fly') },
  { id: 'walk', title: { en: 'Walk (land)' }, keywords: ['walk', 'land', 'ground'], key: 'F', when: (a) => a.ctx.player?.mode === 'fly', run: (a) => a.ctx.player?.setMode?.('walk') },
  { id: 'subtitles-on', title: { en: 'Subtitles on' }, keywords: ['subtitles', 'captions', 'text'], when: (a) => a.ctx.settings.get('captions') === false, run: (a) => a.ctx.settings.set('captions', true) },
  { id: 'subtitles-off', title: { en: 'Subtitles off' }, keywords: ['subtitles', 'captions', 'text'], when: (a) => a.ctx.settings.get('captions') !== false, run: (a) => a.ctx.settings.set('captions', false) },
  { id: 'sound-off', title: { en: 'Sound off' }, keywords: ['mute', 'silence', 'quiet', 'audio', 'volume'], when: (a) => a.ctx.settings.get('volume') > 0, run: (a) => soundToggle(a.ctx) },
  { id: 'sound-on', title: { en: 'Sound on' }, keywords: ['unmute', 'audio', 'volume'], when: (a) => !(a.ctx.settings.get('volume') > 0), run: (a) => soundToggle(a.ctx) },
  { id: 'welcome', title: { en: 'Replay the welcome' }, keywords: ['intro', 'start', 'introduction', 'tutorial'], run: (a) => a.welcome?.replay() },
  { id: 'ahead', title: { en: 'What’s ahead?' }, keywords: ['ahead', 'front', 'what is this', 'inspect', 'look'], key: 'E', when: (a) => !!a.ctx.inspect?.pickCenter, run: (a) => a.whatsAhead?.() },
];

/** "Open the Map", "Open Time"…: one command per Menu section (built-in and modules'), so a search for a section's name
 * ("map", "time", "settings") finds a way there */
export function sectionCommands(app) {
  const recs = app.modules?.sections?.() || [];
  return recs.map((rec) => {
    const s = rec.def.section;
    const label = app.modules.t(s.label) || s.id;
    const the = s.id === 'map' ? 'the ' : '';
    return {
      id: `open-${s.id}`, title: { en: `Open ${the}${label}` }, keywords: [label.toLowerCase(), s.id, 'section', 'menu', 'open', 'show'],
      key: s.keyCap || null, run: (a) => a.open(s.id, { from: 'nav' }),
    };
  });
}
