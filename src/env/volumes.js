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
    const v = { id, min: [...b.min], max, base: o.base ?? CLOSED_ROOM, margin: o.margin ?? 0.3, shell: o.shell ?? SHELL_WALLS, joins: o.joins || [], apertures: o.apertures || [], probe: o.probe || null, gold: !!o.gold };
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
    // qa-r1-fix-env-render: the key light through F1 only where it can pass a real window — n slots evenly spaced along
    // the band (as build-heichal places them), each wIn wide at the Kodesh face and wOut at the outer face, the wall's
    // depth apart (Menachot 86b: narrow inside). The band's openness above stays the windows' share for the sky light.
    const f1n = f1?.params.perSide || 0;
    const f1Slot = f1 && f1n > 1 ? {
      n: f1n, wIn: f1.params.widthInside, wOut: f1.params.widthOutside,
      period: (f1.box.max[0] - f1.box.min[0] - f1.params.widthOutside) / (f1n - 1),
      depth: Math.max(0, (f1.box.max[1] - f1.box.min[1] - (kod0.max[1] - kod0.min[1])) / 2),
    } : null;
    const f2Rect = f2.length ? [[Math.min(...f2.map((w) => w.min[1])), Math.min(...f2.map((w) => w.min[2]))], [Math.max(...f2.map((w) => w.max[1])), Math.max(...f2.map((w) => w.max[2]))]] : null;
    const f2Open = f2Rect ? f2.reduce((sum, w) => sum + (w.max[1] - w.min[1]) * (w.max[2] - w.min[2]), 0) / ((f2Rect[1][0] - f2Rect[0][0]) * (f2Rect[1][1] - f2Rect[0][1])) : 0;
    // the great gate opens onto the roofed Ulam (≈45 % of open sky reaches its back wall); its doors and the
    // curtain in the gate (Middot 4:1, Yoma 54a) gate the light
    const gateOpen = () => door('heichal.gate.great')() * curtain('heichal.gate-curtain')();
    add('heichal.kodesh', kod, {
      base: 0.004, margin: 0.3, shell: SHELL_ZONE, probe: 'kodesh', ceilingTop: kiyurTop, gold: true,
      // its west face is the parochot's line: the KhK beyond, not the open (qa-r1-fix-env-render)
      joins: ['-X'],
      apertures: ap([
        face(kod, 0, +1, gate, gateOpen, 0.45),
        // F1: narrow inside, splayed outward, high in the N and S walls above the ta'im roofs (Part VII §22)
        f1 && { ...face(kod, 1, +1, f1.box, () => f1Open, 0.6), slot: f1Slot },
        f1 && { ...face(kod, 1, -1, f1.box, () => f1Open, 0.6), slot: f1Slot },
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
    let b = trk ? { min: [Math.min(khk.min[0], trk.min[0]), khk.min[1], khk.min[2]], max: [Math.max(khk.max[0], trk.max[0]), khk.max[1], khk.max[2]] } : khk;
    // render-env-2: the lul (a 4-tefach slot behind the Kaporet, closed by a small curtain hung just inside the KhK face)
    // passes the west wall: the curtain's back faces and the slot's jambs sat within the shell of the west face and lit
    // as open sky — the bright dotted edge of the lul curtain. qa-r2-fix-env-render (ENV-R2-2): the KhK was then grown
    // through the whole wall to its outer face at the foot (X 89, 7 amot thick), but the wall steps back to 5 amot above
    // +44 (site.js profile): its outer face above the western ta'im's roof (+55) stood 2 amot inside the grown box, beyond
    // the 0.4 m shell, and was lit as the dark room — a black band on the Heichal's west face up to the KhK's ceiling. Now
    // the west face JOINS the slot's own volume (below) instead: the curtain's back faces stay in the KhK, the jambs are in
    // the slot, and nothing outside the wall's inner face is in the room. The slot itself is no aperture: it runs 17 amot
    // to the open air and is curtained (it shows no sky).
    const wW = box('heichal.wall.west'), lul = box('heichal.lul-west');
    const lulIn = wW && lul ? { min: [wW.min[0], lul.min[1], lul.min[2]], max: [b.min[0], lul.max[1], lul.max[2]] } : null;
    // "a dark chamber" behind the two parochot; gold-plated like the Kodesh (interreflection fill, interiors-glsl.js)
    // its east face is the outer parochet's line (qa-r1-fix-env-render: joins the Kodesh): the inner parochet's east face
    // in the amah traksin, 0.3-0.5 m inside, faces out of the KhK's box but into the dark gap between the curtains
    add('heichal.khk', b, { base: 0.0015, shell: SHELL_ZONE, ceilingTop: kiyurTop, gold: true, joins: lulIn ? ['+X', '-X'] : ['+X'] });
    // the lul through the Heichal's west wall (inner face to outer face at its height): as dark as the KhK it opens from
    if (lulIn) add('heichal.lul-west', lulIn, { base: 0.0015, margin: 0.05, shell: SHELL_ZONE, ceilingTop: lulIn.max[2], joins: ['+X'] });
  }
  const ulam = box('heichal.ulam');
  if (ulam) {
    // the Ulam had no doors (Middot 3:7): a deep porch open 20 × 40 to the east. render-env-2: its box is grown
    // into the end walls of the two wings by the depth of the knife niches of the beit hachalifot (¾ amah, the
    // builder's ⚙ depth, more than the 0.3 m margin), so the niches count as inside — they glowed as open sky
    const NICHE_DEPTH = 0.75 + 0.05;
    const ub = grow(grow(ulam, 1, -1, ulam.min[1] - NICHE_DEPTH), 1, +1, ulam.max[1] + NICHE_DEPTH);
    add('heichal.ulam', ub, { base: 0.02, shell: SHELL_ZONE, probe: 'ulam', apertures: ap([face(ulam, 0, +1, box('heichal.ulam.opening'), curtain('heichal.ulam-curtain', 0.25), 1)]) });
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

/**
 * Fire occluders (render-env-2): the big open-air fires' light must not pass through masonry where no shadow map
 * stops it (low, medium, and the plain light slots of high / ultra). Two cheap analytic shapes, site-derived:
 *   enclosure — a court open to the sky, its walls rising to `tops` (Z per face: [X min, X max, Y min, Y max]): a fire
 *               inside lights nothing outside it below the wall tops (the Azarah, Ezrat Nashim);
 *   plate     — the top of the solid the fire stands on (the altar's upper body): a fire on it lights nothing whose
 *               ray from the flames passes down through that top (the yesod, the pavement close round the altar).
 * Gate openings are ignored: at night, when firelight matters, the gates are shut (Tamid 1:1–2, Middot 1:1).
 * Returns site-frame rects { id, rect: [X0, Y0, X1, Y1], tops | top }.
 * render-env-2-fix: an enclosure's rect is the walls' OUTER faces. With the inner faces every court-facing wall
 * fragment lay exactly on the boundary, where sub-millimetre position noise flipped the inside test and the ray's
 * crossing parameter t → 1 made the over-the-top term explode: black-dot noise and vertical stripes on the firelit
 * walls. Outer faces put the inner faces, the coping and the jambs inside; the outer faces face away from the fire.
 */
export function defineFireOccluders(ctx) {
  const box = (id) => ctx.elOpt(id)?.box || null;
  const enclosures = [];
  const court = (id, w, e, s, n) => {
    const W = box(w), E = box(e), S = box(s), N = box(n);
    if (!W || !E || !S || !N) return;
    enclosures.push({ id, rect: [W.min[0], S.min[1], E.max[0], N.max[1]], tops: [W.max[2], E.max[2], S.max[2], N.max[2]] });
  };
  court('azarah', 'azarah.wall.west', 'azarah.wall.east', 'azarah.wall.south', 'azarah.wall.north');
  court('ezrat-nashim', 'azarah.wall.east', 'en.wall.east', 'en.wall.south', 'en.wall.north');
  const plates = [];
  const top = box('altar.top');
  if (top) plates.push({ id: 'altar.top', rect: [top.min[0], top.min[1], top.max[0], top.max[1]], top: top.max[2] });
  return { enclosures, plates };
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
      // render-audio-3: its irradiance follows the great gate's share of the sky — √(V through the room's first opening
      // here / at the probe), ≤ 2.5 (interiors-glsl.js) — for the share of the probe's light that came in as skylight (not
      // the lamps, not a low Sun's beam landing beyond the probe — probes.js skyShare). Captures moved along the axis at d3
      // and d9 (src/render/dev/kodesh-irr.mjs): 0.55–0.6 of the mid-room probe's irradiance 1 amah from the parochet, 0.65 at
      // 6, 0.8 at 12, 1.2–1.3 at 28, 1.6–2.2 at 34, 1.9–2.8 by the gate; the square root of the gate's ratio gives 0.57,
      // 0.65, 0.76, 1.45, 2.2, 2.5 (its plain ratio falls off as its inverse square: 0.33 … 8; the gold walls spread it)
      irr: { mode: 'main', cap: 2.5 },
      id: 'kodesh', tiers: ['medium', 'high', 'ultra'], outdoor: false, far: 120, hide: HIDE_BEYOND_WALLS,
      pos: [(kod.min[0] + kod.max[0]) / 2, (kod.min[1] + kod.max[1]) / 2, kod.min[2] + eye],
      min: [...kod.min], max: [kod.max[0], kod.max[1], Math.max(kod.max[2], box('heichal.ceiling.kiyur')?.max[2] ?? kod.max[2] + 1)], margin: 0.3, shell: SHELL_ZONE,
      proxyMin: [...kod.min], proxyMax: [...kod.max],
    });
  }
  // render-env-2: the Ulam, a deep porch open to the court: its gold gate leaves, the vine and the nivreshet on the
  // back wall mirrored the open sky (teal cast) where they should mirror the porch itself — its whitewashed marble
  // walls and floor, the court through the 20 × 40 opening. An interior probe (it sees the porch as lit), on the axis
  // at mid-depth, level with the gate's head (the vine and the nivreshet hang above it); proxy = the porch's box.
  const ul = box('heichal.ulam'), gate = box('heichal.gate.great');
  if (ul) {
    const z = gate ? Math.min(gate.max[2] - 2, ul.max[2] - 4) : ul.min[2] + eye;
    out.push({
      // skylit: lit through its opening, not by its own lamps — its irradiance follows the sky visibility (the wings are
      // dim), and env meters the porch from its openings (interiors-glsl.js, env/index.js)
      id: 'ulam', tiers: ['medium', 'high', 'ultra'], outdoor: false, skylit: true, far: 400, hide: HIDE_BEYOND_WALLS,
      pos: [(ul.min[0] + ul.max[0]) / 2, ctx.site?.axisY ?? (ul.min[1] + ul.max[1]) / 2, z],
      min: [ul.min[0], ul.min[1] - 0.8, ul.min[2]], max: [ul.max[0], ul.max[1] + 0.8, ul.max[2] + 1], margin: 0.3, shell: SHELL_ZONE,
      proxyMin: [ul.min[0], ul.min[1], ul.min[2]], proxyMax: [ul.max[0], ul.max[1], ul.max[2]],
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
