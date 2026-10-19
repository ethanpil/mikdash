// Map model: every zone of ctx.site.zones with its level (ground / upper / roof / below), its group in the list of
// places, a label tier, a short label name, and a label anchor — the most open point of the part of its main box
// that is really "it" on the plan (where a click would select it). Geometry comes only from ctx.site.zones.
import { prettyId } from '../format.js';

/**
 * Zones that are a storey above or below another walkable floor. The site model gives each zone a floorZ, but the
 * courts are raised platforms (Mount 0 → Ezrat Nashim 6 → Azarah 16), so a floor height alone does not say whether a
 * place is stacked over another; these are the stacked ones in site.js. Unknown future zones fall back to
 * floorZ > 30 (upper) or < −1 (below) inside the Mount's footprint.
 */
const LEVEL = {
  'en-gallery': 'upper', 'beit-avtinas': 'upper', 'beit-hanitzotz': 'upper', 'shushan-habirah': 'upper', aliyah: 'upper',
  'ulam-upper': 'upper', roof: 'roof', 'taim-roofs': 'roof',
  'underground-passage': 'below', 'beit-hatevilah': 'below', 'gate-chuldah-w': 'below', 'gate-chuldah-e': 'below',
};
export const LEVEL_TAG = { upper: 'upper', roof: 'roof', below: 'below' };

export const GROUPS = [
  { id: 'around', label: 'Around the Mount' },
  { id: 'mount', label: 'Har HaBayit' },
  { id: 'en', label: 'Ezrat Nashim' },
  { id: 'azarah', label: 'The Azarah' },
  { id: 'chambers', label: 'Chambers and gates of the Azarah' },
  { id: 'sanctuary', label: 'The Sanctuary' },
];
/** list order inside each group: roughly the order in which a visitor meets them */
const GROUP_OF = {
  around: ['outside', 'kidron', 'har-hamishchah', 'parah-causeway'],
  mount: ['har-habayit', 'stoa', 'gate-shushan', 'shushan-habirah', 'gate-tadi', 'gate-kiponus', 'gate-chuldah-w', 'gate-chuldah-e',
    'chel', 'soreg', 'lishkat-hakorban', 'lishkat-haparochet', 'beit-haeven', 'underground-passage', 'beit-hatevilah'],
  en: ['ezrat-nashim', 'en-gate-east', 'en-chamber-wood', 'en-chamber-lepers', 'en-chamber-nazirites', 'en-chamber-oil', 'en-gallery',
    'lishkat-chashaim', 'music-chambers', 'fifteen-steps', 'nikanor'],
  azarah: ['azarah', 'ezrat-yisrael', 'lishkat-hakelim', 'ezrat-kohanim', 'mizbeach', 'kevesh', 'kiyor', 'slaughter-zone',
    'bein-haulam-lamizbeach', 'ulam-steps'],
  chambers: ['gazit', 'golah', 'etz-parhedrin', 'melach', 'parvah', 'medichin', 'beit-hamoked', 'beit-avtinas', 'beit-hanitzotz',
    'gate-delek', 'gate-bechorot', 'gate-mayim', 'gate-nitzotz', 'gate-korban', 'gate-moked'],
  sanctuary: ['ulam', 'beit-hachalifot', 'heichal', 'amah-traksin', 'kodesh-hakodashim', 'taim', 'mesibah', 'aliyah', 'taim-roofs',
    'roof', 'ulam-upper'],
};
const GROUP_INDEX = new Map();
for (const [g, ids] of Object.entries(GROUP_OF)) ids.forEach((id, i) => GROUP_INDEX.set(id, { group: g, order: i }));

/** label tiers: 3 = always named, 2 = named once its mark is visible, 1 = only when zoomed in */
const TIER3 = new Set(['har-habayit', 'ezrat-nashim', 'azarah', 'heichal', 'kodesh-hakodashim', 'mizbeach', 'chel', 'kidron', 'har-hamishchah']);
const TIER2 = new Set(['ulam', 'nikanor', 'fifteen-steps', 'ezrat-yisrael', 'ezrat-kohanim', 'slaughter-zone', 'kevesh', 'kiyor',
  'bein-haulam-lamizbeach', 'ulam-steps', 'gazit', 'beit-hamoked', 'stoa', 'soreg', 'parah-causeway', 'gate-shushan', 'gate-tadi',
  'gate-kiponus', 'gate-chuldah-w', 'gate-chuldah-e', 'en-gate-east', 'taim', 'outside']);

const area2 = (b) => (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]);
const in2 = (b, X, Y) => X >= b[0][0] && X <= b[1][0] && Y >= b[0][1] && Y <= b[1][1];
const overlap2 = (a, b) => a[0][0] < b[1][0] && b[0][0] < a[1][0] && a[0][1] < b[1][1] && b[0][1] < a[1][1];
const contains2 = (a, b) => a[0][0] <= b[0][0] && a[0][1] <= b[0][1] && a[1][0] >= b[1][0] && a[1][1] >= b[1][1];

/** "Har HaBayit — the Temple Mount" → "Har HaBayit"; "The fifteen steps" → "Fifteen steps" (map labels drop the article) */
export function shortName(en) {
  let s = String(en || '');
  for (const sep of [' — ', ', ']) { const cut = s.indexOf(sep); if (cut > 0) s = s.slice(0, cut); }
  s = s.replace(/^The\s+/, '');
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** search key: lower case, no diacritics/niqqud/apostrophes/punctuation */
export function searchKey(s) {
  return String(s || '').normalize('NFD').replace(/[̀-֑ͯ-ׇ]/g, '').toLowerCase().replace(/[^a-z0-9א-ת]+/g, '');
}

export function createModel(ctx, data) {
  const site = ctx.site?.zones || {};
  const mount = site['har-habayit']?.boxes?.[0] || null;
  const zones = new Map();

  for (const [id, z] of Object.entries(site)) {
    if (!Array.isArray(z?.boxes) || !z.boxes.length) continue;
    const fz = Number.isFinite(z.floorZ) ? z.floorZ : null;
    // main box: the largest box standing at the zone's own floor (else the largest)
    const atFloor = z.boxes.filter((b) => fz === null || Math.abs(b[0][2] - fz) <= 1.6);
    const main = (atFloor.length ? atFloor : z.boxes).reduce((a, b) => (area2(b) > area2(a) ? b : a));
    let level = LEVEL[id] || 'ground';
    if (!LEVEL[id] && fz !== null && mount) {
      const c = [(main[0][0] + main[1][0]) / 2, (main[0][1] + main[1][1]) / 2];
      if (in2(mount, c[0], c[1]) && id !== 'har-habayit') level = fz > 30 ? 'upper' : fz < -1 ? 'below' : 'ground';
    }
    const gi = GROUP_INDEX.get(id);
    zones.set(id, {
      id, boxes: z.boxes, priority: z.priority ?? 0, floorZ: fz, main, level, stacked: level !== 'ground',
      tier: TIER3.has(id) ? 3 : TIER2.has(id) ? 2 : 1,
      group: gi?.group || null, order: gi?.order ?? 999,
      area: area2(main),
      // filled lazily
      anchor: null, room: null, children: null, name: null,
    });
  }
  const list = [...zones.values()];
  const ground = list.filter((z) => !z.stacked);
  const stackedList = list.filter((z) => z.stacked);

  // geometric fallback group for zones the table does not know (future sub-zones)
  const boxOf = (id) => zones.get(id)?.main;
  for (const z of list) {
    if (z.group) continue;
    const c = [(z.main[0][0] + z.main[1][0]) / 2, (z.main[0][1] + z.main[1][1]) / 2];
    const inside = (id) => { const b = boxOf(id); return b && in2(b, c[0], c[1]); };
    z.group = ['ulam', 'heichal', 'taim', 'roof'].some(inside) ? 'sanctuary' : inside('azarah') ? 'azarah' : inside('ezrat-nashim') ? 'en'
      : inside('har-habayit') ? 'mount' : 'around';
  }

  /** ground-level zone at a plan point: highest priority, then smallest box (as zoneAtSite, without the Z test) */
  function groundAt(X, Y, skip = null, among = ground) {
    let best = null, bp = -Infinity, bv = Infinity;
    for (const z of among) {
      if (z.id === skip) continue;
      for (const b of z.boxes) {
        if (!in2(b, X, Y)) continue;
        const v = area2(b);
        if (z.priority > bp || (z.priority === bp && v < bv)) { best = z.id; bp = z.priority; bv = v; }
      }
    }
    return best;
  }
  /** stacked zones (upper / roof / below) whose boxes contain a plan point */
  function stackedAt(X, Y) {
    const out = [];
    for (const z of stackedList) if (z.boxes.some((b) => in2(b, X, Y))) out.push(z.id);
    return out;
  }

  /**
   * Higher-priority ground zones overlapping a ground zone (their area is theirs on the plan: the activity fill is
   * cut out under them). Stacked zones have none.
   */
  function childrenOf(z) {
    if (z.children) return z.children;
    const kids = [];
    if (!z.stacked) {
      for (const o of ground) {
        if (o === z) continue;
        const wins = o.priority > z.priority || (o.priority === z.priority && o.area < z.area);
        if (!wins) continue;
        for (const b of o.boxes) if (z.boxes.some((zb) => overlap2(zb, b))) kids.push(b);
      }
    }
    z.children = kids;
    return kids;
  }

  /**
   * Label anchor: rasterise the zone's main box (≤ 30 cells a side), keep the cells that belong to the zone on the
   * plan, run a chamfer distance transform, and take the most open cell (ties: nearest the box centre). room = the
   * free run through the anchor along X and Y (amot), used to decide whether a label fits inside.
   */
  function anchorOf(z) {
    if (z.anchor) return z;
    const [mn, mx] = z.main;
    const w = mx[0] - mn[0], hgt = mx[1] - mn[1];
    const N = 30;
    const cell = Math.max(w, hgt) / N || 1;
    const nx = Math.max(1, Math.round(w / cell)), ny = Math.max(1, Math.round(hgt / cell));
    const cw = w / nx, ch = hgt / ny;
    // candidates that can steal cells: zones with boxes overlapping the main box
    const rivals = z.stacked
      ? stackedList.filter((o) => o !== z && o.priority >= z.priority && Math.abs((o.floorZ ?? 0) - (z.floorZ ?? 0)) < 4 && o.boxes.some((b) => overlap2(b, z.main)))
      : null;
    const near = z.stacked ? null : ground.filter((o) => o.boxes.some((b) => overlap2(b, z.main)));
    const own = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const X = mn[0] + (i + 0.5) * cw, Y = mn[1] + (j + 0.5) * ch;
        let mine;
        if (z.stacked) mine = !rivals.some((o) => o.boxes.some((b) => in2(b, X, Y)) && (o.priority > z.priority || o.area < z.area));
        else mine = groundAt(X, Y, null, near) === z.id;
        own[j * nx + i] = mine ? 1 : 0;
      }
    }
    // chamfer distance (in cells; 1 orthogonal, 1.4 diagonal); the outside of the box counts as "not mine"
    const INF = 1e9;
    const d = new Float32Array(nx * ny);
    for (let k = 0; k < d.length; k++) d[k] = own[k] ? INF : 0;
    const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? 0 : d[j * nx + i]);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!d[k]) continue;
      d[k] = Math.min(d[k], at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + 1.4, at(i + 1, j - 1) + 1.4);
    }
    for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i;
      if (!d[k]) continue;
      d[k] = Math.min(d[k], at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + 1.4, at(i - 1, j + 1) + 1.4);
    }
    let bi = -1, bd = -1, bc = Infinity;
    const ci = (nx - 1) / 2, cj = (ny - 1) / 2;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = d[j * nx + i];
      if (!v) continue;
      const c = (i - ci) ** 2 + (j - cj) ** 2;
      if (v > bd + 0.01 || (Math.abs(v - bd) <= 0.01 && c < bc)) { bd = v; bi = j * nx + i; bc = c; }
    }
    if (bi < 0) {
      z.anchor = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2];
      z.room = [w, hgt];
    } else {
      const i = bi % nx, j = (bi / nx) | 0;
      let i0 = i, i1 = i, j0 = j, j1 = j;
      while (i0 > 0 && own[j * nx + i0 - 1]) i0--;
      while (i1 < nx - 1 && own[j * nx + i1 + 1]) i1++;
      while (j0 > 0 && own[(j0 - 1) * nx + i]) j0--;
      while (j1 < ny - 1 && own[(j1 + 1) * nx + i]) j1++;
      z.room = [(i1 - i0 + 1) * cw, (j1 - j0 + 1) * ch];
      // centre the anchor in its free runs (a long strip is labelled at its middle), if that point is still the zone's
      const mi = Math.min(nx - 1, Math.floor((i0 + i1 + 1) / 2)), mj = Math.min(ny - 1, Math.floor((j0 + j1 + 1) / 2));
      z.anchor = own[mj * nx + mi]
        ? [mn[0] + ((i0 + i1 + 1) / 2) * cw, mn[1] + ((j0 + j1 + 1) / 2) * ch]
        : [mn[0] + (i + 0.5) * cw, mn[1] + (j + 0.5) * ch];
    }
    // the valley and the Mount of Olives: boxes of over a million square amot, whose centre means nothing; name them
    // at their observer spot (the lookout by the Parah's pyre, the valley floor under the causeway)
    if (z.area > 1e6 && z.id !== 'outside') {
      const p = data.point(data.zone(z.id)?.stand);
      if (p && in2(z.main, p[0], p[1])) z.anchor = [p[0], p[1]];
    }
    // the city: its box encloses everything; name it beside the Mount, at its observer spot
    if (z.id === 'outside') {
      const p = data.point(data.zone('outside')?.stand);
      if (p) { z.anchor = [p[0], p[1] - 30]; z.room = [60, 20]; }
    }
    return z;
  }

  /** names from zone content (data.zone: real ZONE_CONTENT, else fixture names, else the id) */
  let named = false;
  function nameOf(z) {
    if (!named) nameAll();
    return z.name;
  }
  /** name every zone; two places with the same short name keep their qualifier ("Sha'ar Chuldah (western)") */
  function nameAll() {
    named = true;
    for (const z of list) nameOne(z);
    const seen = new Map();
    for (const z of list) seen.set(z.name.short, (seen.get(z.name.short) || 0) + 1);
    for (const z of list) {
      if (seen.get(z.name.short) < 2) continue;
      const q = z.name.en.split(' — ')[1];
      if (q) z.name.short = `${z.name.short} (${q})`;
    }
  }
  function nameOne(z) {
    const c = data.zone(z.id) || {};
    const n = c.name || {};
    const en = n.en || prettyId(z.id);
    z.standless = c.stand === null;
    const heShort = String(n.he || '').split(' — ')[0];
    z.name = {
      en, he: heShort, heFull: n.he || '', translit: n.translit || '', short: shortName(en),
      key: searchKey(`${en} ${n.translit || ''} ${n.he || ''} ${z.id}`),
    };
    return z.name;
  }

  /** union extent of all zones but the city: the zoom-out limit */
  function extent() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const z of list) {
      if (z.id === 'outside') continue;
      for (const b of z.boxes) { x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]); x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]); }
    }
    if (!Number.isFinite(x0)) return [[-10, -10], [510, 510]];
    return [[x0, y0], [x1, y1]];
  }
  const unionOf = (ids, pad) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const z = zones.get(id);
      if (!z) continue;
      for (const b of id === 'chel' ? [z.main] : z.boxes) { x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]); x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]); }
    }
    return Number.isFinite(x0) ? [[x0 - pad, y0 - pad], [x1 + pad, y1 + pad]] : null;
  };
  /** preset extents, from the site model */
  const PRESETS = {
    mount: { label: 'Mount', rect: unionOf(['har-habayit'], 4) || [[-10, -10], [510, 510]] },
    courts: { label: 'Courts', rect: unionOf(['chel'], 6) || [[40, 240], [420, 420]] },
    sanctuary: { label: 'Sanctuary', rect: unionOf(['heichal', 'ulam', 'taim', 'mesibah', 'mizbeach', 'kevesh', 'kiyor'], 6) || [[80, 280], [240, 385]] },
  };

  return {
    zones, list, ground, stacked: stackedList,
    get: (id) => zones.get(id) || null,
    groundAt, stackedAt, childrenOf, anchorOf, nameOf, extent, presets: PRESETS,
    /** stacked zones over a ground zone's main box, or the ground zones under a stacked one */
    otherLevels(id) {
      const z = zones.get(id);
      if (!z) return [];
      if (z.stacked) {
        const [mn, mx] = z.main;
        const g = groundAt((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2);
        const out = g ? [g] : [];
        for (const o of stackedList) if (o !== z && o.level !== z.level && o.boxes.some((b) => overlap2(b, z.main))) out.push(o.id);
        return out;
      }
      if (z.area > 20000) return []; // the Mount, the city, the valley: everything is "over" them
      // storeys of about this size over it, and any storey that covers the whole of it (the roof over the Heichal)
      return stackedList.filter((o) => o.boxes.some((b) => overlap2(b, z.main) && (area2(b) < z.area * 4 || contains2(b, z.main)))).map((o) => o.id);
    },
  };
}
