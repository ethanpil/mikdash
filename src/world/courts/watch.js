// Lights at the night-watch posts of the courts (Middot 1:1; Tamid 1:1; Rambam BhB 8:4–9), positions from site.js
// (mount.watch-posts). The kohanic posts in Beit Avtinas and Beit HaNitzotz keep a stone lamp-stand (the Moked's lamp
// is set by moked.js). The Levite posts — outside the Azarah gates, at Nikanor, at the Azarah's four outer corners and
// behind the Beit HaKaporet — carry torches on iron wall brackets, as the Levite posts of the Mount do (mount/posts.js);
// the fittings are reconstruction. schedule 'night'.
import { lampStand } from './lib/parts.js';

const KOHANIC = new Set(['beit-avtinas', 'beit-hanitzotz']);
const LEVITE = new Set(['gate-delek', 'gate-bechorot', 'gate-mayim', 'gate-korban', 'gate-nikanor',
  'azarah-sw', 'azarah-nw', 'azarah-ne', 'azarah-se', 'achorei-beit-hakaporet']);
const TORCH = 0.35;      // flame size (m) — the Mount posts' torches
const TORCH_Z = 5.5;     // torch height above the post's floor (amot), as on the Mount

/** a torch in an iron wall bracket: arm from the wall face, socket ring, wooden shaft and a charred head; the flame at
 *  pos. n = [nx, ny] outward normal of the wall face (the bracket stands out 0.5 from it) ⚙ */
function torch(C, id, pos, n) {
  const [x, y, z] = pos;
  if (C.d >= 1) {
    const iron = C.kit.m('iron', false, false), wood = C.kit.m('timber_rough', false, false), head = C.kit.m('ash', false, false);
    const ax = n[0] !== 0 ? [Math.min(x, x - n[0] * 0.5), Math.max(x, x - n[0] * 0.5)] : [x - 0.04, x + 0.04];
    const ay = n[1] !== 0 ? [Math.min(y, y - n[1] * 0.5), Math.max(y, y - n[1] * 0.5)] : [y - 0.04, y + 0.04];
    iron.box([ax[0], ay[0], z - 0.75], [ax[1], ay[1], z - 0.67]);
    iron.box([x - 0.09, y - 0.09, z - 0.95], [x + 0.09, y + 0.09, z - 0.6]);
    wood.box([x - 0.05, y - 0.05, z - 1.25], [x + 0.05, y + 0.05, z - 0.26]);
    head.box([x - 0.085, y - 0.085, z - 0.26], [x + 0.085, y + 0.085, z - 0.04]);
  }
  return C.ctx.addFire({ id, kind: 'torch', pos: [x, y, z], size: TORCH, intensity: 1, schedule: 'night' });
}

export function buildWatch(C) {
  const posts = C.el('mount.watch-posts').params.posts.filter((p) => KOHANIC.has(p.id) || LEVITE.has(p.id));
  const o = { schedule: 'night' };
  const W = C.walls, Z_AZ = C.datums.azarah;
  const off = 0.5;                                     // the torch stands this far out from the wall face
  for (const p of posts) {
    const [X, Y, Z] = p.pos, id = `courts.watch.${p.id}`;
    if (p.id === 'beit-avtinas') { const b = C.el('azarah.beit-avtinas').box; lampStand(C, id, b.min[0] + 9, b.max[1] - 1.2, b.min[2], o); continue; }
    if (p.id === 'beit-hanitzotz') { const b = C.el('azarah.beit-hanitzotz').box; lampStand(C, id, X + 2, b.min[1] + 2.5, b.min[2], o); continue; }
    if (p.id === 'gate-nikanor') {
      // on the Nikanor wall's east face, outboard of the two wickets, over the head of the fifteen steps
      const wn = C.el('azarah.gate.nikanor.wicket-n').box, ws = C.el('azarah.gate.nikanor.wicket-s').box, xf = W.azE.max[0];
      torch(C, `${id}.a`, [xf + off, ws.min[1] - 1.6, Z + TORCH_Z], [1, 0]);
      torch(C, `${id}.b`, [xf + off, wn.max[1] + 1.6, Z + TORCH_Z], [1, 0]);
      continue;
    }
    if (p.id.startsWith('gate-')) {
      // a torch either side of the gate on the outer wall face, clear of its door-case, over the head of its flight
      const g = C.el(`azarah.gate.${p.id.slice(5)}`).box, south = Y < C.axisY;
      const yf = south ? W.azS.min[1] - off : W.azN.max[1] + off, n = [0, south ? -1 : 1];
      torch(C, `${id}.a`, [g.min[0] - 1.8, yf, Z_AZ + TORCH_Z], n);
      torch(C, `${id}.b`, [g.max[0] + 1.8, yf, Z_AZ + TORCH_Z], n);
      continue;
    }
    if (p.id === 'achorei-beit-hakaporet') {
      // on the inner face of the Azarah's west wall, beside the guard's place opposite the lul
      torch(C, id, [W.azW.max[0] + off, Y + 2, Z + TORCH_Z], [1, 0]);
      continue;
    }
    // the Azarah's outer corners: on the south / north wall face, just in from the corner (as the Mount's corners)
    const south = p.id.startsWith('azarah-s'), west = p.id.endsWith('w');
    const xc = west ? W.azW.min[0] + 1.2 : X;
    torch(C, id, [xc, south ? W.azS.min[1] - off : W.azN.max[1] + off, Z + TORCH_Z], [0, south ? -1 : 1]);
  }
}
