// STUB — owned by the time/sky task. Real module: zmanim (NOAA solar math for Jerusalem),
// sha'ot zmaniyot conversion, Hebrew date, sim clock. See ARCHITECTURE.md §Time.
import { PRIORITY } from '../core/engine.js';
export async function init(ctx) {
  const time = {
    t: 5 * 60, speed: 1, paused: !!ctx.params.pause || ctx.params.shot,
    zmanim: { alot: 290, sunrise: 362, chatzot: 690, sunset: 1018, tzeit: 1040, midnight: 1410, shaahDay: 54.67, shaahNight: 65.33 },
    set(t) { time.t = ((t % 1440) + 1440) % 1440; ctx.bus.emit('time:jump', time.t); },
  };
  ctx.time = time;
  ctx.engine.onUpdate((dt) => {
    if (!time.paused) time.t = (time.t + dt * time.speed / 60) % 1440;
  }, PRIORITY.time);
}
