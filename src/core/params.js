// URL parameters (all optional). Used for deep links, debugging and the headless screenshot tool.
//
//   q=low|medium|high|ultra|auto   quality tier (default auto)
//   amah=naeh|feinstein|chazonish  amah standard (read in units.js)
//   t=...                          sim time: "HH:MM" (Israel Standard Time), or a zman anchor with
//                                  optional minute offset ("alot-5", "sunrise+30", "sunset", "chatzot"),
//                                  or seasonal hours "d8.5" (day hour 8.5) / "n11" (night hour 11)
//   date=YYYY-MM-DD                Gregorian date driving sun/moon (default: see time/ module)
//   pos=X,Y,Z                      observer EYE position in SITE amot (Z = eye height in amot)
//   at=X,Y                         observer standing at site X,Y (floor found automatically)
//   look=heading,pitch             degrees; heading 0=N 90=E 180=S 270=W; pitch + = up
//   fly=1                          start in free-flight (no gravity/collision)
//   speed=N                        sim-time multiplier (1 = real time)
//   pause=1                        sim clock paused
//   shot=1                         screenshot mode: no UI chrome, no intro, clock paused, sets window.__mikdashReady
//   ui=0                           hide UI
//   audio=0                        disable audio
//   debug=boxes,zones,nav,anchors,stats   comma list of debug overlays
//   seed=N                         deterministic seed for procedural variation
//   fov=N                          camera vertical field of view in degrees

function num(v, d) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
}

function triple(v) {
  if (!v) return null;
  const p = v.split(',').map(Number);
  return p.every(Number.isFinite) ? p : null;
}

export function readParams(search = globalThis.location?.search || '') {
  const u = new URLSearchParams(search);
  const flag = (k) => u.get(k) === '1' || u.get(k) === 'true';
  const look = triple(u.get('look'));
  return {
    q: u.get('q') || 'auto',
    t: u.get('t'),
    date: u.get('date'),
    pos: triple(u.get('pos')),
    at: triple(u.get('at')),
    look: look ? { heading: look[0], pitch: look[1] ?? 0 } : null,
    fly: flag('fly'),
    speed: u.has('speed') ? num(u.get('speed'), 1) : null,
    pause: flag('pause'),
    shot: flag('shot'),
    ui: u.get('ui') !== '0' && !flag('shot'),
    audio: u.get('audio') !== '0' && !flag('shot'),
    debug: new Set((u.get('debug') || '').split(',').filter(Boolean)),
    seed: num(u.get('seed'), 5786),
    fov: num(u.get('fov'), 62),
    raw: u,
  };
}
