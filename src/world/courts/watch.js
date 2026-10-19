// Lamps at the night-watch posts of the courts (Middot 1:1; Tamid 1:1; Rambam BhB 8:4–9): the kohanic posts in
// Beit Avtinas and Beit HaNitzotz (the Moked's is set by moked.js), and the Levite posts at the Azarah gates (outside),
// at Nikanor, at the Azarah's four outer corners and behind the Beit HaKaporet. Positions from site.js
// (mount.watch-posts); the lamp-stand / wall-bracket form is reconstruction. schedule 'night'.
import { lampStand, wallLamp } from './lib/parts.js';

const MINE = new Set(['beit-avtinas', 'beit-hanitzotz', 'gate-delek', 'gate-bechorot', 'gate-mayim', 'gate-korban', 'gate-nikanor',
  'azarah-sw', 'azarah-nw', 'azarah-ne', 'azarah-se', 'achorei-beit-hakaporet']);

export function buildWatch(C) {
  const posts = C.el('mount.watch-posts').params.posts.filter((p) => MINE.has(p.id));
  const o = { schedule: 'night' };
  for (const p of posts) {
    const [X, Y, Z] = p.pos, id = `courts.watch.${p.id}`;
    if (p.id === 'beit-avtinas') { const b = C.el('azarah.beit-avtinas').box; lampStand(C, id, b.min[0] + 9, b.max[1] - 1.2, b.min[2], o); continue; }
    if (p.id === 'beit-hanitzotz') { const b = C.el('azarah.beit-hanitzotz').box; lampStand(C, id, X + 2, b.min[1] + 2.5, b.min[2], o); continue; }
    if (p.id.startsWith('gate-') && p.id !== 'gate-nikanor') {
      // a bracket lamp on the outer wall face beside the gate, over the head of its flight
      const south = Y < C.axisY;
      const face = south ? C.walls.azS.min[1] : C.walls.azN.max[1];
      wallLamp(C, id, X + 6.8, face, Z + 4.5, [0, south ? -1 : 1], o);
      continue;
    }
    if (p.id === 'gate-nikanor') { lampStand(C, id, X + 2, Y - 7, Z, o); continue; }
    // corner and rear posts: a stand beside the guard's place
    lampStand(C, id, X + (p.id.endsWith('kaporet') ? -2 : 0), Y + (p.id.startsWith('azarah-s') ? -1.5 : p.id.startsWith('azarah-n') ? 1.5 : 0), Z, o);
  }
}
