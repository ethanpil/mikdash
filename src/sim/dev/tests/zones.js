// Zones: tracking + events + content; schedule API; a short play through the dawn blasts with audio live.
const ev = [];
ctx.bus.on('zone:change', (e) => ev.push(`${e.prev}→${e.zone}`));
const spots = [[405, 330.5, 0], [330, 330, 6], [250, 300, 13.5], [238, 300, 16], [210, 403, 16], [100, 150, 0], [600, 330, 0]];
for (const at of spots) { ctx.player.teleport({ at }); await sleep(450); }
const z = ctx.zones;
const info = z.info('ezrat-nashim');
const s = ctx.schedule;
const t = ctx.time.t;
const act = s.active(t).map((e) => e.id), up = s.upcoming(t, 4).map((e) => `${e.id}@${ctx.time.format(e.t0)}`);
const atZone = s.at('har-habayit', ctx.time.parse('n3')).map((e) => e.id);
const view = s.viewOf(s.byId('great-gate')), pos = s.positionOf(s.byId('great-gate'));
// play through the blasts at 30x with audio on
ctx.time.set(ctx.time.parse('sunrise-7.3'));
ctx.player.teleport({ at: [290, 330.5, 6] }); ctx.player.setLook(270, 6);
ctx.time.setSpeed(30); ctx.time.pause(false);
await sleep(2500);
await shot('ui-blasts');
await sleep(3000);
ctx.time.pause(true);
return {
  zoneEvents: ev, current: z.current, hasContent: !!z.content, contentKeys: z.content ? Object.keys(z.content).length : 0, list: z.list.length,
  info: info && { id: info.id, name: info.name?.en, sanctity: info.sanctity, priority: info.priority, boxes: info.boxes?.length },
  events: s.events.length, dayType: ctx.time.dayType, active: act, upcoming: up, atMountN3: atZone, view, pos: pos && pos.toArray().map((v) => +v.toFixed(2)),
  audio: ctx.audio.state,
};
