// Night watch fires and the Mount's anchors.
// Torches at the Levite posts on Har HaBayit (mount.watch-posts, Middot 1:1): the five gates, the four inner corners
// and the two chambers' posts (schedule 'night'); small iron wall brackets ⚙. Lamps in the Chuldah passages ⚙.
import { AMAH } from '../../core/units.js';
import { wallDesc } from './walls.js';
import { getTerrain } from '../terrain/height.js';

const TORCH = 0.35, LAMP = 0.08;
const GATES = { 'mount.gate.shushan': 'east', 'mount.gate.kiponus': 'west', 'mount.gate.tadi': 'north' };

export function buildPosts(ctx, kit, detail, chuldah = []) {
  const posts = Object.fromEntries(ctx.el('mount.watch-posts').params.posts.map((p) => [p.id, p]));
  const fire = (id, pos, kind = 'torch') => ctx.addFire({ id, kind, pos, size: kind === 'lamp' ? LAMP : TORCH, intensity: kind === 'lamp' ? 0.7 : 1, schedule: 'night' });
  const bracket = (pos, n) => {
    if (detail < 1) return;
    const [x, y, z] = pos;
    // an iron arm from the wall to the torch and a socket
    const ax = n[0] !== 0 ? [Math.min(x, x - n[0] * 0.5), Math.max(x, x - n[0] * 0.5)] : [x - 0.04, x + 0.04];
    const ay = n[1] !== 0 ? [Math.min(y, y - n[1] * 0.5), Math.max(y, y - n[1] * 0.5)] : [y - 0.04, y + 0.04];
    kit.box([ax[0], ay[0], z - 0.75], [ax[1], ay[1], z - 0.67], 'iron', { collide: false, castShadow: false });
    kit.box([x - 0.08, y - 0.08, z - 0.95], [x + 0.08, y + 0.08, z - 0.55], 'iron', { collide: false, castShadow: false });
  };
  // the three gates that open at the Mount level: a torch either side on the inner face
  for (const [id, side] of Object.entries(GATES)) {
    const W = wallDesc(ctx, side);
    const o = W.openings.find((g) => g.id === id);
    const off = 0.45;
    const t = W.tInt - W.extSign * off;
    const n = W.nT(-W.extSign);
    for (const s of [o.s0 - 1.8, o.s1 + 1.8]) {
      const pos = W.pt(s, t, o.z0 + 5.5);
      fire(`mount.torch.${id.split('.').pop()}.${s < o.s0 ? 'a' : 'b'}`, pos);
      bracket(pos, n);
    }
  }
  // Chuldah posts are inside the portals (site.js), in the passages: a torch on each side wall
  for (const c of chuldah) {
    const k = c.id.endsWith('w') ? 'chuldah-w' : 'chuldah-e';
    const y = (posts[`gate-${k}`]?.pos[1] ?? 1) + 1.5;
    for (const [x, nx] of [[c.x0 + 0.45, 1], [c.x1 - 0.45, -1]]) {
      const pos = [x, y, c.zP + 6];
      fire(`mount.torch.${k}.${nx > 0 ? 'a' : 'b'}`, pos);
      bracket(pos, [nx, 0, 0]);
    }
    c.lamps.forEach((p, i) => fire(`mount.lamp.${k}.${i}`, p, 'lamp'));
  }
  // the four inner corners: on the south / north wall, clear of the corner stair
  const M = ctx.el('mount.floor').box.max[0];
  for (const [id, x, y, ny] of [['mount-sw', 6, 0.45, 1], ['mount-se', M - 6, 0.45, 1], ['mount-nw', 6, M - 0.45, -1], ['mount-ne', M - 6, M - 0.45, -1]]) {
    if (!posts[id]) continue;
    const pos = [x, y, 5.5];
    fire(`mount.torch.${id}`, pos);
    bracket(pos, [0, ny, 0]);
  }
  // the chambers' posts: beside the door
  for (const key of ['korban', 'parochet']) {
    const e = ctx.el(`mount.chamber.${key}`);
    const d = e.params.door;
    const pos = [d.x[1] + 1.2, e.box.min[1] - 0.45, 5.5];
    fire(`mount.torch.lishkat-ha${key}`, pos);
    bracket(pos, [0, -1, 0]);
  }
}

export function registerAnchors(ctx, app) {
  const T = getTerrain(ctx);
  const A = AMAH;
  const add = (name, pos, heading, label, extra = {}) => ctx.addAnchor(name, { pos, heading, label, ...extra });
  const steps = ctx.el('mount.chel.steps').params;
  const axis = ctx.site.axisY;
  // Default spawn: on the axis 38 amot (≈18 m) east of the foot of the Chel steps, so the soreg, the twelve steps
  // and the Ezrat Nashim gate (with the altar's smoke column above the wall) frame together. At the foot itself the
  // risers fill the view, and the Heichal is hidden by the Ezrat Nashim east wall from anywhere on this axis.
  // qa-r2-fix-world: the eye turned 9° north of the axis (heading 279) — square on, the wall was a flat backdrop with the
  // glow dead centre; turned, the glow of the Heichal through the gates sits left of centre and the wall recedes toward
  // its north corner. Still on the axis (off it, the two gates no longer line up on the Heichal) ⚙
  add('start', [steps.foot[0] + 38, axis, 0], 279, 'Before dawn at the twelve steps of the Chel', { zone: 'har-habayit', pitch: 10 });
  add('mount.chel.steps.foot', steps.foot, 270, 'At the foot of the twelve steps of the Chel', { zone: 'chel', pitch: 20 });
  // the same axis 53 amot further east: soreg, chel steps, the Ezrat Nashim gate and, through it, Nikanor and the Ulam
  add('mount.chel.approach', [steps.foot[0] + 53, axis, 0], 270, 'Approaching the Chel steps on the Temple axis', { zone: 'har-habayit', pitch: 9 });
  add('mount.chel', [405, 372, 0], 180, 'The Chel, inside the soreg', { zone: 'chel' });
  add('mount.soreg', [418, 296, 0], 270, 'The soreg and the chel steps', { zone: 'har-habayit' });
  add('mount.plaza.south', [250, 150, 0], 0, 'Har HaBayit — the open south of the Mount', { zone: 'har-habayit', pitch: 6 });
  add('mount.gate.shushan', [478, axis, 0], 90, "Sha'ar Shushan (the Eastern Gate)", { zone: 'stoa' });
  add('mount.gate.shushan.outside', [522, axis, 0], 270, 'Before the Eastern Gate, on the causeway — Shushan HaBirah over it', { zone: 'parah-causeway', pitch: 10 });
  const ch = ctx.el('mount.gate.shushan.chamber').box;
  add('mount.shushan-habirah', [ch.min[0] + 1.8, axis - 1, ch.min[2]], 30, 'Shushan HaBirah — the two standard amot (Kelim 17:9)', { zone: 'shushan-habirah', pitch: -14 });
  add('mount.stoa.roof', [488, axis + 18, ctx.el('mount.stoa.east').box.max[2]], 270, 'On the roof of the east stoa', { zone: 'stoa' });
  const kip = ctx.el('mount.gate.kiponus').box, kipY = (kip.min[1] + kip.max[1]) / 2;
  add('mount.gate.kiponus', [27, kipY, 0], 270, "Sha'ar Kiponus (the western gate)", { zone: 'stoa' });
  add('mount.gate.kiponus.bridge', [kip.min[0] - 40, kipY, 0], 90, 'On the bridge before Kiponus', { zone: 'outside' });
  const tadi = ctx.el('mount.gate.tadi').box;
  add('mount.gate.tadi', [(tadi.min[0] + tadi.max[0]) / 2, 473, 0], 0, "Sha'ar Tadi (the northern gate)", { zone: 'har-habayit' });
  for (const k of ['w', 'e']) {
    const g = ctx.el(`mount.gate.chuldah-${k}`).box;
    const cx = (g.min[0] + g.max[0]) / 2;
    add(`mount.gate.chuldah-${k}`, [cx, T.plan.plaza.y0 + 8, g.min[2]], 0, `Sha'ar Chuldah (${k === 'w' ? 'west' : 'east'}) from the Ophel`, { zone: 'outside', pitch: 8 });
    const t = ctx.el(`context.chuldah.tunnel-${k}`).params.exit;
    add(`mount.chuldah-${k}.exit`, [t[0], t[1] + 3, t[2]], 0, 'Coming up from the Chuldah passage', { zone: 'har-habayit' });
  }
  add('mount.stoa.south', [250, 15, 0], 90, 'The double stoa — south', { zone: 'stoa' });
  add('mount.stoa.east', [485, 200, 0], 0, 'The double stoa — east', { zone: 'stoa' });
  add('mount.stoa.north', [300, 485, 0], 270, 'The double stoa — north', { zone: 'stoa' });
  add('mount.stoa.west', [15, 150, 0], 0, 'The double stoa — west', { zone: 'stoa' });
  for (const key of ['korban', 'parochet']) {
    const b = ctx.el(`mount.chamber.${key}`).box;
    add(`mount.chamber.${key}`, [(b.min[0] + b.max[0]) / 2, b.min[1] - 6, 0], 0, ctx.el(`mount.chamber.${key}`).name.en, { zone: 'har-habayit' });
  }
  const be = ctx.el('mount.chamber.beit-haeven').box;
  add('mount.chamber.beit-haeven', [(be.min[0] + be.max[0]) / 2, be.max[1] + 7, 0], 180, 'Lishkat Beit HaEven', { zone: 'har-habayit' });
  // outside: the causeway, the Kidron, and the Parah sight-line from the crest of Har HaMishchah
  const cw = ctx.el('context.parah-causeway').box;
  add('mount.causeway', [(cw.min[0] + cw.max[0]) / 2, axis, 0], 270, 'On the Parah causeway over the Kidron', { zone: 'parah-causeway', pitch: 3 });
  const thalX = ctx.el('context.kidron').params.thalwegX;
  add('mount.kidron', [thalX, axis - 60, T.heightZ(thalX, axis - 60)], 300, 'Nachal Kidron, below the east wall', { zone: 'kidron', pitch: 14 });
  const pyre = ctx.el('context.parah.pyre');
  // the daily viewpoint: site.js groundEye, a viewer on the crest with no pyre built. The burning-place floor is flush
  // with the crest ground (terrain/context.js), so the standing eye here is groundEye. (kohenEye now stands ON the
  // arrangement — Parah 3:9 — inside the pyre's footprint, so it is not a ground point.)
  const eye = pyre.params.groundEye;
  add('mount.har-hamishchah', [eye[0], eye[1], pyre.box.min[2]], 270, 'Har HaMishchah — where the kohen burning the Parah sees the Heichal entrance', { zone: 'har-hamishchah', pitch: -2.5 });
  // the kohen's stand at the sprinkling: on the arrangement, east of the heifer, facing west (Parah 3:9). Only stood on
  // when the pyre is built (movable 'parah.pyre'); for the sim and the people, not a walking target
  const ks = pyre.params.kohenStand;
  add('mount.har-hamishchah.kohen-stand', [ks[0], ks[1], ks[2]], 270, 'On the arrangement — the kohen sprinkles toward the Heichal (Parah 3:9)', { zone: 'har-hamishchah', pitch: -2.5 });
  const [browX, browY] = T.plan.slopeLookout;                     // down the west slope, where the Kidron opens below
  add('mount.har-hamishchah.slope', [browX, browY, T.heightZ(browX, browY)], 280, 'The west slope of Har HaMishchah, above the Kidron', { zone: 'har-hamishchah', pitch: -6 });
  add('mount.ophel', [(T.plan.plaza.x0 + T.plan.plaza.x1) / 2, T.plan.plaza.y0 + 4, ctx.el('mount.gate.chuldah-w').box.min[2]], 0, 'The Ophel plaza before the Chuldah gates', { zone: 'outside', pitch: 10 });
  void A; void app;
}
