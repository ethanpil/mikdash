// Interior volumes and reflection probes, derived from src/data/site.js (site frame: X east, Y north, Z up, amot).
//
// A volume is a roofed space whose air sees the sky only through its apertures (doors, windows, the open side of
// a portico). `base` is the sky visibility left when every aperture is shut (leaks, bounce from the walls of the
// opening): a rough per-kind constant (reconstruction, docs/decisions/lighting-polish.md). An aperture is a
// rectangle on one face plane of the volume: `plane: [axis 0|1|2 (X|Y|Z), coordinate, outward sign]`, `rect`:
// [[min a, min b], [max a, max b]] on the two other site axes in order (X: Y,Z — Y: X,Z — Z: X,Y), `open()` its
// current openness (doors / curtains from ctx.movables; missing movable → open) and `beyond`, how bright the
// space it opens onto is relative to the open sky (the Kodesh's great gate opens onto the roofed Ulam).
// Boxes may be a room's inner extent (zones) or its outer extent (chambers whose walls lie inside the box): the
// shader treats outward-facing surfaces within `shell` metres of the boundary as outside.
//
// Everything is looked up with elOpt: a missing element just drops its volume (the world is built in parallel).
import { EYE_HEIGHT } from '../core/units.js';

const CLOSED_ROOM = 0.05;    // a chamber whose door the site model does not place: leaks + an average door
const SHELL_ZONE = 0.4;      // m — zones are inner extents (wall faces on the boundary)
const SHELL_WALLS = 1.2;     // m — chamber boxes include 1–2.5 amah walls

export function defineVolumes(ctx) {
  const box = (id) => ctx.elOpt(id)?.box || null;
  const par = (id) => ctx.elOpt(id)?.params || {};
  const mov = (key) => ctx.movables?.get?.(key)?.userData;
  const door = (id) => () => { const u = mov(`door:${id}`); return u && Number.isFinite(u.openAmount) ? u.openAmount : 1; };
  const curtain = (id, shut = 0.15) => () => { const u = mov(`curtain:${id}`); const f = u && Number.isFinite(u.openAmount) ? u.openAmount : 1; return shut + (1 - shut) * f; };
  const always = () => 1;
  const vols = [];
  const add = (id, b, o = {}) => {
    if (!b) return null;
    const max = [...b.max];
    // a ZONE box (inner extent) ends at the ceiling's underside, but coffers and beams rise into the ceiling
    // courses: without this the Kodesh coffers sat outside the room and mirrored daylight into the gold
    if (o.ceilingTop != null) max[2] = Math.max(max[2], o.ceilingTop);
    else if ((o.shell ?? SHELL_WALLS) <= SHELL_ZONE) max[2] += 1;
    const v = { id, min: [...b.min], max, base: o.base ?? CLOSED_ROOM, margin: o.margin ?? 0.3, shell: o.shell ?? SHELL_WALLS, apertures: o.apertures || [], probe: o.probe || null };
    vols.push(v);
    return v;
  };
  // aperture on the face of volume box `b` along site axis `ax` (side +1 = max face, -1 = min face), its extent
  // taken from opening box `ob` (or explicit rect)
  const face = (b, ax, side, ob, open = always, beyond = 1, rectOverride = null) => {
    if (!b || (!ob && !rectOverride)) return null;
    const o = [0, 1, 2].filter((k) => k !== ax);
    const rect = rectOverride || [[ob.min[o[0]], ob.min[o[1]]], [ob.max[o[0]], ob.max[o[1]]]];
    return { plane: [ax, side > 0 ? b.max[ax] : b.min[ax], side > 0 ? 1 : -1], rect, open, beyond };
  };
  const ap = (list) => list.filter(Boolean);

  // ------------------------------------------------------------------ the Heichal
  // Recesses in a room's walls (window reveals, wicket passages, lamp niches) lie outside its zone box and read as
  // outdoors (V = 1): the F2 crown windows over the great gate glowed white at night, the passage's lamp niches by
  // day. A volume is therefore grown through the wall thickness where the site model places such openings, and
  // its apertures sit on the grown faces (the outer end of the opening); the wall's outer face lies on the grown
  // boundary facing out, so the shell rule still counts it as outside (lighting-polish-fix).
  const grow = (b, ax, side, to) => {
    if (!b || !Number.isFinite(to)) return b;
    const g = { min: [...b.min], max: [...b.max] };
    if (side > 0) g.max[ax] = Math.max(g.max[ax], to); else g.min[ax] = Math.min(g.min[ax], to);
    return g;
  };
  const kod0 = box('heichal.kodesh');
  const kiyurTop = box('heichal.ceiling.kiyur')?.max[2] ?? null; // the coffered kiyur over the Kodesh and KhK
  const eastWallX = box('heichal.wall.east')?.max[0];
  if (kod0) {
    const gate = box('heichal.gate.great');
    // through the east wall: the great gate's passage and the F2 windows over it
    const kod = grow(kod0, 0, +1, gate ? gate.max[0] : eastWallX);
    const f1 = ctx.elOpt('heichal.windows.f1');
    const f2 = par('heichal.windows.f2').windows || [];
    const f1Open = f1 ? (f1.params.perSide * f1.params.widthInside) / Math.max(1, f1.box.max[0] - f1.box.min[0]) : 0;
    const f2Rect = f2.length ? [[Math.min(...f2.map((w) => w.min[1])), Math.min(...f2.map((w) => w.min[2]))], [Math.max(...f2.map((w) => w.max[1])), Math.max(...f2.map((w) => w.max[2]))]] : null;
    const f2Open = f2Rect ? f2.reduce((sum, w) => sum + (w.max[1] - w.min[1]) * (w.max[2] - w.min[2]), 0) / ((f2Rect[1][0] - f2Rect[0][0]) * (f2Rect[1][1] - f2Rect[0][1])) : 0;
    // the great gate opens onto the roofed Ulam (≈45 % of open sky reaches its back wall); its doors and the
    // curtain in the gate (Middot 4:1, Yoma 54a) gate the light
    const gateOpen = () => door('heichal.gate.great')() * curtain('heichal.gate-curtain')();
    add('heichal.kodesh', kod, {
      base: 0.004, margin: 0.3, shell: SHELL_ZONE, probe: 'kodesh', ceilingTop: kiyurTop,
      apertures: ap([
        face(kod, 0, +1, gate, gateOpen, 0.45),
        // F1: narrow inside, splayed outward, high in the N and S walls above the ta'im roofs (Part VII §22)
        f1 && face(kod, 1, +1, f1.box, () => f1Open, 0.6),
        f1 && face(kod, 1, -1, f1.box, () => f1Open, 0.6),
        // F2 over the gate (Zechariah's crowns) look into the Ulam's upper space: one rectangle over both windows,
        // openness = their share of it (one aperture less per fragment)
        f2.length && face(kod, 0, +1, null, () => f2Open, 0.3, f2Rect),
      ]),
    });
    // (the great gate's passage is part of the grown Kodesh: a separate passage volume overlapped it and the Ulam
    // at the Ulam's back wall, and the shader weighs only the two deepest boxes at a point)
  }
  const khk = box('heichal.khk'), trk = box('heichal.amah-traksin');
  if (khk) {
    const b = trk ? { min: [Math.min(khk.min[0], trk.min[0]), khk.min[1], khk.min[2]], max: [Math.max(khk.max[0], trk.max[0]), khk.max[1], khk.max[2]] } : khk;
    add('heichal.khk', b, { base: 0.0015, shell: SHELL_ZONE, ceilingTop: kiyurTop }); // "a dark chamber" behind the two parochot
  }
  const ulam = box('heichal.ulam');
  if (ulam) {
    // the Ulam had no doors (Middot 3:7): a deep porch open 20 × 40 to the east
    add('heichal.ulam', ulam, { base: 0.02, shell: SHELL_ZONE, apertures: ap([face(ulam, 0, +1, box('heichal.ulam.opening'), curtain('heichal.ulam-curtain', 0.25), 1)]) });
  }
  const ali = box('heichal.aliyah');
  if (ali) add('heichal.aliyah', ali, { base: 0.004, shell: SHELL_ZONE, apertures: ap([face(ali, 1, -1, box('heichal.aliyah.door'), door('heichal.aliyah.door'), 0.7)]) });
  // passages through the Heichal's thick walls between two dark rooms (the NE ta's door into the Kodesh, the
  // wickets of the knife chambers): their own dim volumes — outside every box their walls read as open sky (the
  // white strip beside the great gate in the review's sky-visibility view)
  for (const id of ['heichal.ta.door-ne', 'heichal.chalifot.n.wicket', 'heichal.chalifot.s.wicket']) {
    const b = box(id);
    if (b) add(id, b, { base: 0.01, margin: 0.05, shell: SHELL_ZONE, ceilingTop: b.max[2] });
  }
  // the north and south cells through the Heichal's east wall: the wickets from the Ulam into the ta'im
  for (const k of ['north', 'south', 'west']) add(`heichal.taim.${k}`, k === 'west' ? box(`heichal.taim.${k}`) : grow(box(`heichal.taim.${k}`), 0, +1, eastWallX), { base: 0.01, shell: 0.6 });

  // ------------------------------------------------------------------ Beit HaMoked and the passage under it
  const mk = box('azarah.moked.hall');
  if (mk) {
    const dome = par('azarah.moked.hall').dome;
    const oc = dome?.center || [(mk.min[0] + mk.max[0]) / 2, (mk.min[1] + mk.max[1]) / 2];
    const r = 0.97; // the oculus over the hearth (r 1.1 amot) as an equal-area square
    add('azarah.moked.hall', mk, {
      base: 0.004, shell: SHELL_WALLS,
      apertures: ap([
        face(mk, 1, -1, box('azarah.gate.moked'), door('azarah.gate.moked'), 1),
        face(mk, 1, +1, box('azarah.moked.door-chel'), door('azarah.moked.door-chel'), 1),
        face(mk, 2, +1, null, always, 1, [[oc[0] - r, oc[1] - r], [oc[0] + r, oc[1] + r]]),
      ]),
    });
  }
  // the passage is grown by its lamp niches' depth on both sides (build-courts: 0.6 amah)
  const NICHE = 0.7;
  for (const id of ['azarah.underground.stair', 'azarah.underground.passage', 'azarah.underground.beit-hatevilah']) {
    const b = box(id);
    add(id, id === 'azarah.underground.passage' ? grow(grow(b, 0, -1, b?.min[0] - NICHE), 0, +1, b?.max[0] + NICHE) : b, { base: 0.0005, shell: 0.6 });
  }

  // ------------------------------------------------------------------ chambers of the Azarah
  const gz = box('azarah.chamber.gazit');
  if (gz) {
    const p = par('azarah.chamber.gazit');
    const Z = gz.min[2];
    const doors = (p.doors || []).map((d) => {
      const side = Math.abs(d.x - gz.max[0]) < Math.abs(d.x - gz.min[0]) ? +1 : -1;
      return face(gz, 0, side, null, () => 0.7, 1, [[d.y[0], Z], [d.y[1], Z + 16]]);
    });
    // clerestory windows high in the long walls (build-courts: 2 × 5 amot at +12…+17; 4 south, 2 north)
    const L = gz.max[0] - gz.min[0];
    const win = (side, n) => face(gz, 1, side, null, () => (n * 2) / L, 1, [[gz.min[0], Z + 12], [gz.max[0], Z + 17]]);
    add('azarah.chamber.gazit', gz, { base: 0.01, apertures: ap([...doors, win(-1, 4), win(+1, 2)]) });
  }
  for (const id of ['azarah.chamber.golah', 'azarah.chamber.etz', 'azarah.chamber.melach', 'azarah.chamber.parvah', 'azarah.chamber.medichin',
    'azarah.chamber.kelim', 'azarah.chamber.pinchas', 'azarah.chamber.chavitin', 'azarah.beit-avtinas', 'azarah.beit-hanitzotz']) add(id, box(id));
  // gate passages through the Azarah walls: dark when their doors are shut
  for (const g of ['delek', 'bechorot', 'mayim', 'nitzotz', 'korban']) {
    const b = box(`azarah.gate.${g}`);
    if (!b) continue;
    const o = door(`azarah.gate.${g}`);
    add(`azarah.gate.${g}`, b, { base: 0.03, margin: 0.05, shell: SHELL_ZONE, ceilingTop: b.max[2], apertures: ap([face(b, 1, +1, b, o, 1), face(b, 1, -1, b, o, 1)]) });
  }
  const ex = box('azarah.gate.nitzotz.exedra');
  if (ex) add('azarah.gate.nitzotz.exedra', ex, { base: 0.03, apertures: ap([face(ex, 1, -1, ex, () => 0.75, 1)]) }); // open toward the court

  // ------------------------------------------------------------------ Ezrat Nashim and the Mount
  for (const r of par('en.music-chambers').rooms || []) {
    add(`en.music-chambers.${r.side}`, r.box, { apertures: ap([r.door && face(r.box, 0, +1, r.door, () => 0.8, 1)]) });
  }
  if (!(par('en.music-chambers').rooms || []).length) add('en.music-chambers', box('en.music-chambers'), { base: 0.05 });
  add('en.chamber.chashaim', box('en.chamber.chashaim'));
  for (const id of ['mount.chamber.parochet', 'mount.chamber.korban', 'mount.chamber.beit-haeven', 'mount.gate.shushan.chamber']) add(id, box(id));
  // the stoas: roofed double colonnades open toward the Mount (columns ≈ 25 % of the open side)
  const stoa = [['south', 1, +1], ['north', 1, -1], ['west', 0, +1], ['east', 0, -1]];
  for (const [k, ax, side] of stoa) {
    const b = box(`mount.stoa.${k}`);
    if (b) add(`mount.stoa.${k}`, b, { base: 0.05, shell: SHELL_WALLS, apertures: ap([face(b, ax, side, b, () => 0.75, 1)]) });
  }
  // the Chuldah passages (mechilot) under the Mount: lit from the southern portal and the stairwell at the top
  for (const k of ['w', 'e']) {
    const e = ctx.elOpt(`context.chuldah.tunnel-${k}`);
    if (!e?.box) continue;
    const b = e.box, g = box(`mount.gate.chuldah-${k}`);
    const exit = e.params?.exit;
    add(`context.chuldah.tunnel-${k}`, b, {
      base: 0.002, shell: 0.6,
      apertures: ap([
        face(b, 1, -1, g, door(`mount.gate.chuldah-${k}`), 1),
        exit && face(b, 2, +1, null, always, 1, [[b.min[0], exit[1] - 10], [b.max[0], exit[1]]]),
      ]),
    });
  }
  // Openings the site model knows (wickets, chamber doors, gates) that pierce a face of a volume without explicit
  // apertures become its apertures: a chamber is lit through its own door. The Heichal's rooms are explicit only
  // (its lul and inner doors lead to other dark rooms, not to daylight).
  const openings = Object.values(ctx.site?.elements || {}).filter((e) => (e.kind === 'opening' || e.kind === 'gate') && e.box);
  const EPS = 0.05;
  for (const v of vols) {
    if (v.apertures.length || v.id.startsWith('heichal.')) continue;
    for (const e of openings) {
      const o = e.box;
      if (v.id === e.id) continue;
      // overlap in all three axes (touching counts)
      if ([0, 1, 2].some((k) => o.max[k] < v.min[k] - EPS || o.min[k] > v.max[k] + EPS)) continue;
      // the face it pierces: an axis where the opening reaches the volume's boundary while lying inside it on the
      // other two axes (a wicket through the wall a chamber is built against)
      for (const ax of [0, 1, 2]) {
        const o2 = [0, 1, 2].filter((k) => k !== ax);
        const within = o2.every((k) => o.min[k] >= v.min[k] - EPS && o.max[k] <= v.max[k] + EPS);
        if (!within) continue;
        const side = Math.abs(o.max[ax] - v.max[ax]) < 0.6 || o.max[ax] > v.max[ax] ? +1 : Math.abs(o.min[ax] - v.min[ax]) < 0.6 || o.min[ax] < v.min[ax] ? -1 : 0;
        if (!side) continue;
        // a door in a wall may stand just outside the room's box; a hatch must really pierce floor or ceiling
        const pierce = Math.min(o.max[ax], v.max[ax]) - Math.max(o.min[ax], v.min[ax]);
        if (ax === 2 && pierce < 0.25) continue;
        const a = face(v, ax, side, o, door(e.id), 1);
        if (a) { a.src = e.id; v.apertures.push(a); }
        break;
      }
    }
  }
  return vols;
}

// world groups a probe skips: from eye level inside the 40-amah court walls (or the Kodesh) the terrain and the
// Mount's own walls / stoas show only through gate openings — ⅔ of the world's triangles, and every cube face
// redraws whatever it does not skip
const HIDE_BEYOND_WALLS = ['terrain', 'mount'];

/**
 * Reflection probes (site frame): capture point at eye height, influence box (weight 1 inside, fading over
 * `margin` m outside; outward-facing surfaces within `shell` m excluded) and proxy box for parallax correction.
 * `tiers`: where the probe exists. Outdoor probes are attenuated by sky visibility inside volumes.
 */
export function defineProbes(ctx) {
  const box = (id) => ctx.elOpt(id)?.box || null;
  const eye = EYE_HEIGHT / ctx.units.AMAH;
  const out = [];
  const wW = box('azarah.wall.west'), wE = box('azarah.wall.east'), wS = box('azarah.wall.south'), wN = box('azarah.wall.north');
  const fl = box('azarah.floor');
  if (wW && wE && wS && wN && fl) {
    const alt = box('altar.body');
    // mid-court, north of the altar (the slaughter area), halfway between its north face and the north wall: sees
    // the altar, the Ulam facade with the great gate, the north chambers and gates, Nikanor and the pavement at
    // moderate distances (box projection corrects the walls; the altar and the facade are what it cannot correct,
    // so the probe keeps away from both). It holds no fire light (probes.js), so being far from the pyres costs
    // nothing at night (lighting-polish-fix; it stood 3 m from the altar's south-west corner).
    const X = alt ? (alt.min[0] + alt.max[0]) / 2 : 217;
    const Y = alt ? (alt.max[1] + wN.min[1]) / 2 : 367;
    out.push({
      id: 'court', tiers: ['medium', 'high', 'ultra'], outdoor: true, far: 3000, hide: HIDE_BEYOND_WALLS,
      pos: [X, Y, fl.max[2] + eye],
      min: [wW.max[0], wS.max[1], fl.max[2] - 4], max: [wE.min[0], wN.min[1], 130], margin: 2.6, shell: 3,
      proxyMin: [wW.max[0], wS.max[1], fl.max[2]], proxyMax: [wE.min[0], wN.min[1], 2e4],
    });
  }
  const kod = box('heichal.kodesh');
  if (kod) {
    out.push({
      id: 'kodesh', tiers: ['medium', 'high', 'ultra'], outdoor: false, far: 120, hide: HIDE_BEYOND_WALLS,
      pos: [(kod.min[0] + kod.max[0]) / 2, (kod.min[1] + kod.max[1]) / 2, kod.min[2] + eye],
      min: [...kod.min], max: [kod.max[0], kod.max[1], Math.max(kod.max[2], box('heichal.ceiling.kiyur')?.max[2] ?? kod.max[2] + 1)], margin: 0.3, shell: SHELL_ZONE,
      proxyMin: [...kod.min], proxyMax: [...kod.max],
    });
  }
  const en = box('en.floor'), eW = box('azarah.wall.east'), eE = box('en.wall.east'), eS = box('en.wall.south'), eN = box('en.wall.north');
  if (en && eW && eE && eS && eN) {
    out.push({
      id: 'en', tiers: ['high', 'ultra'], outdoor: true, far: 3000, hide: HIDE_BEYOND_WALLS,
      pos: [(en.min[0] + en.max[0]) / 2, (en.min[1] + en.max[1]) / 2, en.max[2] + eye],
      min: [eW.max[0], eS.max[1], en.max[2] - 4], max: [eE.min[0], eN.min[1], 80], margin: 2.6, shell: 3,
      proxyMin: [eW.max[0], eS.max[1], en.max[2]], proxyMax: [eE.min[0], eN.min[1], 2e4],
    });
  }
  return out;
}
