// sim/ — zones, the schedule and the choreography runtime (ARCHITECTURE §8, §9).
//
//   ctx.zones    = { current, content, list, info(id), at(worldPos), atSite(X,Y,Z) }      (zones.js)
//   ctx.schedule = { events, active(t), upcoming(t,n), at(zone,t), byId(id), progress(ev,t), resolveTimes(),
//                    positionOf(ev), viewOf(ev), select(), runtime }                     (schedule.js)
//   ctx.schedule.runtime: the choreography runtime (runtime.js) — choreos in src/sim/choreo/*.js, toolkit in lib/.
//
// Data (src/data/schedule.js, src/data/zones-content.js) is optional at build time: while a file is missing the
// runtime uses each choreo's own fixtures and ctx.schedule.events stays empty (the UI then shows its fixtures).
// ?debug=sim shows the runtime overlay (debug.js).
import { PRIORITY } from '../core/engine.js';
import { createZones, trackZones } from './zones.js';
import { createSchedule } from './schedule.js';
import { createRuntime } from './runtime.js';
import { createAutoView } from './lib/watch.js';

const DATA = import.meta.glob(['../data/schedule.js', '../data/zones-content.js']);

async function loadData() {
  const out = { schedule: null, zones: null };
  for (const [path, load] of Object.entries(DATA)) {
    try {
      const m = await load();
      if (path.endsWith('schedule.js')) out.schedule = m; else out.zones = m;
    } catch (e) { console.error(`[sim] failed to load ${path}`, e); }
  }
  return out;
}

export async function init(ctx) {
  const data = await loadData();
  const zones = createZones(ctx, data.zones);
  zones.current = zones.at(ctx.player?.position) ?? null;
  ctx.zones = zones;

  const schedule = createSchedule(ctx, data.schedule, zones);
  ctx.schedule = schedule;
  const runtime = await createRuntime(ctx, schedule);
  schedule.runtime = runtime;
  // "Go" always shows something: an event's data view while its figures are seen from it, else a stand that sees them
  // (lib/watch.js; gate-sim-data)
  schedule.setAutoView(createAutoView(ctx, runtime, schedule));

  // a new date can change the day type (weekday / friday / shabbat) and every zman
  ctx.bus.on('time:date', () => { schedule.select(); runtime.remap(); });

  const zoneTick = trackZones(ctx, zones);
  ctx.engine.onUpdate((dt) => zoneTick(dt), PRIORITY.sim + 1);

  // the inspect core (console-design §6.2): not in shot mode, where there is no UI (?inspect=1 forces it for tests,
  // ?inspect=0 leaves it out — boot A/B)
  const ip = ctx.params?.raw?.get?.('inspect');
  if ((!ctx.params?.shot || ip === '1') && ip !== '0') {
    try { const { createInspect } = await import('./inspect.js'); ctx.inspect = createInspect(ctx, { schedule, runtime, zones }); } catch (e) { console.error('[sim] inspect failed', e); }
  }

  if (ctx.params?.debug?.has?.('sim')) {
    try { (await import('./debug.js')).installDebug(ctx, runtime); } catch (e) { console.error('[sim] debug overlay failed', e); }
  }
}
