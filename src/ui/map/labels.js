// Map labels: one per zone, English (short name) + Hebrew, sized by tier, placed greedily by priority so no two
// labels (or a label and an overlay) ever overlap. Small places appear only when their mark is big enough on
// screen; a label that does not fit inside its place may sit just outside it (gates on a wall line). Long, narrow
// strips (Ezrat Yisrael, Ezrat Kohanim) take a rotated label. Activity adds a count badge or a "soon" pill and,
// zoomed in, the top activity's title as a callout.

const EN_FONT = "'Cormorant Garamond', 'EB Garamond', Georgia, serif";
const HE_FONT = "'Frank Ruhl Libre', 'David Libre', David, 'Times New Roman', serif";
const SM_FONT = "'EB Garamond', 'Cormorant Garamond', Georgia, serif";
const SIZE = { 3: [17, 14.5], 2: [14.5, 12.5], 1: [13, 11.5] };
const LINE = 1.08;
const TAG_FS = 10.5; // level tags and "N MIN" pills: not scaled down on phones (legibility)

const widths = new Map();
function measure(g, font, text) {
  const key = `${font}|${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    g.font = font;
    w = g.measureText(text).width;
    if (widths.size > 4000) widths.clear();
    widths.set(key, w);
  }
  return w;
}
/** the canvas font cache is only valid once the web fonts have loaded */
export function clearMeasureCache() { widths.clear(); }

function wrapTwo(text) {
  const words = text.split(' ');
  if (words.length < 2) return null;
  let best = null, bd = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const d = Math.abs(a.length - b.length);
    if (d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const fontsOf = (tier, scale) => {
  const [fsEn, fsHe] = SIZE[tier].map((v) => v * scale);
  return { fsEn, fsHe, enFont: `italic ${tier === 1 ? 500 : 600} ${fsEn}px ${EN_FONT}`, heFont: `500 ${fsHe}px ${HE_FONT}` };
};

/** measure a place's label texts ahead of the first open (a web font's first use on a canvas is slow): { tier, name } */
export function warmLabel(g, it, scale = 1) {
  const { enFont, heFont } = fontsOf(it.tier, scale);
  measure(g, enFont, it.name.short);
  if (it.name.short.length > 18) for (const t of wrapTwo(it.name.short) || []) measure(g, enFont, t);
  if (it.name.he) measure(g, heFont, it.name.he);
}

/**
 * items: [{ id, tier, level, name: {short, he}, anchor:[X,Y], room:[w,h], main, score, active, soon, callout,
 *           selected, current, force }], sorted by the caller (most important first)
 * tf: view transform; blocked: [{l,t,r,b}] css px; scale: font scale (phones)
 * owns(id, X, Y): true where a click at the site point would select that place (a label slid in from an off-screen
 *   anchor must still sit on its own place: a big envelope box — the city, the Mount, the Chel — is mostly others')
 * returns placed labels [{ id, x, y, w, h, rot, lines, rect, item }]
 */
export function layoutLabels(g, items, tf, blocked, scale = 1, owns = null) {
  const { k, W, H } = tf;
  const placed = [];
  const taken = blocked.map((b) => ({ ...b }));
  const free = (r) => r.l >= 4 && r.t >= 4 && r.r <= W - 4 && r.b <= H - 4 && !taken.some((o) => r.l < o.r && o.l < r.r && r.t < o.b && o.t < r.b);
  // where each place is "named from" on screen (its anchor)
  const marks = [];
  for (const it of items) {
    const x = tf.x(it.anchor[0]), y = tf.y(it.anchor[1]);
    if (x > -20 && y > -20 && x < W + 20 && y < H + 20) marks.push({ id: it.id, x, y });
  }
  const M = 8; // px kept clear around each anchor: a click near a place's centre selects that place
  const coversMark = (r, id) => marks.some((m) => m.id !== id && m.x > r.l - M && m.x < r.r + M && m.y > r.t - M && m.y < r.b + M);

  for (const it of items) {
    const [mn, mx] = [it.main[0], it.main[1]];
    const sx0 = tf.x(mn[0]), sx1 = tf.x(mx[0]), sy0 = tf.y(mx[1]), sy1 = tf.y(mn[1]);
    if (sx1 < 0 || sx0 > W || sy1 < 0 || sy0 > H) continue; // off screen
    const sw = sx1 - sx0, sh = sy1 - sy0, smax = Math.max(sw, sh);
    const gate = it.force ? 0 : it.tier === 3 ? 0 : it.tier === 2 ? 9 : it.stacked ? 30 : 24;
    if (smax < gate) continue;
    const { fsEn, fsHe, enFont, heFont } = fontsOf(it.tier, scale);
    const coFont = `italic 500 ${12 * scale}px ${SM_FONT}`;
    const tagFont = `600 ${TAG_FS}px ${SM_FONT}`;
    const ax = tf.x(it.anchor[0]), ay = tf.y(it.anchor[1]);
    const roomW = it.room[0] * k, roomH = it.room[1] * k;

    // extras on the first line: level tag, activity badge or "soon" pill
    const tag = it.level && it.level !== 'ground' ? it.level.toUpperCase() : null;
    const tagW = tag ? measure(g, tagFont, tag) + 10 * scale : 0;
    const badgeW = it.active ? 18 * scale : it.soon != null ? measure(g, tagFont, `${Math.max(1, Math.round(it.soon))} MIN`) + 12 * scale : 0;
    const extra = (tag ? tagW + 5 : 0) + (badgeW ? badgeW + 5 : 0);

    const variants = [];
    const enW = measure(g, enFont, it.name.short);
    const heW = it.name.he ? measure(g, heFont, it.name.he) : 0;
    const co = it.callout ? clip(it.callout, 34) : null;
    const coW = co ? measure(g, coFont, co) : 0;
    const mk = (enLines, withHe, withCo) => {
      const lines = enLines.map((t) => ({ text: t, font: enFont, fs: fsEn, kind: 'en', w: measure(g, enFont, t) }));
      if (withHe) lines.push({ text: it.name.he, font: heFont, fs: fsHe, kind: 'he', w: heW });
      if (withCo) lines.push({ text: co, font: coFont, fs: 12 * scale, kind: 'co', w: coW });
      const w = Math.max(lines[0].w + extra, ...lines.slice(1).map((l) => l.w));
      const h = lines.reduce((s, l) => s + l.fs * LINE, 0);
      return { lines, w, h };
    };
    const big = it.tier === 3 || sw > 70 * scale || it.selected;
    const wantCo = !!co && Math.min(sw, sh) >= 54 && k >= 1.6;
    const long = it.name.short.length > 18 ? wrapTwo(it.name.short) : null;
    if (heW && big) variants.push(mk([it.name.short], true, wantCo));
    if (heW && long) variants.push(mk(long, true, wantCo));
    variants.push(mk([it.name.short], false, wantCo));
    if (long) variants.push(mk(long, false, wantCo));
    if (wantCo) variants.push(mk([it.name.short], false, false));

    let done = null;
    // rotated: a long narrow strip whose name runs along it
    if (roomH > roomW * 2.2 && enW + extra > roomW * 1.05 && enW + extra <= roomH * 0.95 && fsEn * 1.4 <= roomW * 1.6) {
      const w = enW + extra, h = fsEn * LINE;
      // at its anchor, else farther along the strip (clear of a marker on it) while it stays on the strip
      for (const f of [0, -0.6, 0.6, -1.2, 1.2]) {
        const y = ay + f * (w / 2 + 12);
        const r = { l: ax - h / 2 - 2, r: ax + h / 2 + 2, t: y - w / 2 - 2, b: y + w / 2 + 2 };
        if (f && (r.t < ay - roomH / 2 || r.b > ay + roomH / 2)) continue;
        if (free(r) && !coversMark(r, it.id)) { done = { x: ax, y, w, h, rot: -Math.PI / 2, lines: [{ text: it.name.short, font: enFont, fs: fsEn, kind: 'en', w: enW }], rect: r }; break; }
      }
    }
    for (const V of variants) {
      if (done) break;
      const fits = V.w <= roomW * 1.1 + 6 && V.h <= roomH * 1.25 + 4;
      const pos = [];
      if (fits || it.tier === 3 || it.force || sw >= V.w * 0.7) {
        pos.push([ax, ay]);
        // nudged up or down within its place (clear of an event marker at the anchor)
        if (roomH * 0.5 >= V.h * 0.5 + 9 || it.force) pos.push([ax, ay - V.h / 2 - 9], [ax, ay + V.h / 2 + 9]);
        // a storey above / below shares its anchor with the place beneath (the roof over the Heichal): it may stand
        // a little farther off, above or below that place's label, while it stays inside its own box
        if (it.stacked) {
          for (const d of [22, 36, 52]) {
            if (ay - V.h - d > sy0) pos.push([ax, ay - V.h / 2 - d]);
            if (ay + V.h + d < sy1) pos.push([ax, ay + V.h / 2 + d]);
          }
        }
      }
      if (!fits && smax < 160) {
        // just outside its mark: above, below, then the sides
        const gap = 3;
        pos.push([(sx0 + sx1) / 2, sy0 - gap - V.h / 2], [(sx0 + sx1) / 2, sy1 + gap + V.h / 2],
          [sx1 + gap + V.w / 2, (sy0 + sy1) / 2], [sx0 - gap - V.w / 2, (sy0 + sy1) / 2]);
      }
      for (let [x, y] of pos) {
        const exempt = it.tier === 3 && x === ax && y === ay; // a principal name at its own anchor always stands
        // near the edge of the map: slide the label inward while it still sits on its place (on ground the place
        // owns, across the label's middle — not merely inside its bounding box)
        const cx = Math.max(V.w / 2 + 8, Math.min(W - V.w / 2 - 8, x)), cy = Math.max(V.h / 2 + 6, Math.min(H - V.h / 2 - 6, y));
        if ((cx !== x || cy !== y) && it.slide !== false && cx >= sx0 && cx <= sx1 && cy >= sy0 && cy <= sy1
          && (!owns || [0, -0.35, 0.35].every((f) => owns(it.id, tf.X(cx + f * V.w), tf.Y(cy))))) { x = cx; y = cy; }
        const r = { l: x - V.w / 2 - 3, r: x + V.w / 2 + 3, t: y - V.h / 2 - 1, b: y + V.h / 2 + 1 };
        // a label never covers where another place is named from: a click there must select that place
        if (free(r) && (exempt || !coversMark(r, it.id))) { done = { x, y, w: V.w, h: V.h, rot: 0, lines: V.lines, rect: r }; break; }
      }
    }
    if (!done) continue;
    done.id = it.id; done.item = it; done.tag = tag; done.tagW = tagW; done.badgeW = badgeW; done.tagFont = tagFont;
    taken.push(done.rect);
    placed.push(done);
  }
  return placed;
}

/** draw placed labels; alpha(id) → 0..1 fade-in */
export function drawLabels(g, placed, alpha) {
  g.save();
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  for (const L of placed) {
    const a = alpha(L.id);
    if (a <= 0.01) continue;
    const it = L.item;
    g.globalAlpha = a;
    g.save();
    g.translate(L.x, L.y);
    if (L.rot) g.rotate(L.rot);
    let y = -L.h / 2;
    L.lines.forEach((ln, i) => {
      const lh = ln.fs * LINE;
      const cy = y + lh / 2;
      y += lh;
      g.font = ln.font;
      // first line: text, then tag / badge to its right; the whole line is centred
      const lineW = i === 0 ? ln.w + (L.tag ? L.tagW + 5 : 0) + (L.badgeW ? L.badgeW + 5 : 0) : ln.w;
      let x = -lineW / 2;
      g.textAlign = 'left';
      g.lineWidth = ln.kind === 'en' ? 3.6 : 3.2;
      g.strokeStyle = 'rgba(10,8,5,0.9)';
      g.fillStyle = ln.kind === 'he' ? (it.active ? '#ffe3a3' : 'rgba(242,211,138,0.95)')
        : ln.kind === 'co' ? '#e9c46f'
          : it.selected ? '#fff4d8' : it.active ? '#f6dc9a' : it.tier === 1 ? 'rgba(241,232,212,0.86)' : 'rgba(241,232,212,0.95)';
      if (ln.kind === 'he') { g.direction = 'rtl'; g.textAlign = 'right'; x = ln.w / 2; }
      g.strokeText(ln.text, x, cy);
      g.fillText(ln.text, x, cy);
      g.direction = 'ltr';
      if (i !== 0) return;
      x = -lineW / 2 + ln.w + 5;
      if (L.tag) {
        const tw = L.tagW, th = Math.min(TAG_FS + 4, lh + 1);
        g.font = L.tagFont;
        g.save();
        g.setLineDash(it.level === 'below' ? [1.2, 2] : [3, 2]);
        g.strokeStyle = it.level === 'below' ? 'rgba(170,190,220,0.9)' : 'rgba(241,232,212,0.75)';
        g.fillStyle = 'rgba(10,8,5,0.78)';
        g.lineWidth = 1;
        roundRect(g, x, cy - th / 2, tw, th, th / 2);
        g.fill(); g.stroke();
        g.restore();
        g.fillStyle = it.level === 'below' ? '#c8d6ee' : 'rgba(241,232,212,0.92)';
        g.textAlign = 'center';
        g.fillText(L.tag, x + tw / 2, cy + 0.5);
        x += tw + 5;
      }
      if (it.active) {
        const r = L.badgeW / 2;
        g.fillStyle = '#e2b85a';
        g.strokeStyle = 'rgba(10,8,5,0.9)';
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(x + r, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#1b1409';
        g.font = `700 ${Math.round(r * 1.25)}px ${SM_FONT}`;
        g.textAlign = 'center';
        g.fillText(String(it.active), x + r, cy + 0.5);
      } else if (it.soon != null && L.badgeW) {
        const tw = L.badgeW, th = Math.min(TAG_FS + 4, lh + 1);
        g.save();
        g.fillStyle = 'rgba(10,8,5,0.78)';
        g.strokeStyle = 'rgba(226,184,90,0.85)';
        g.lineWidth = 1;
        roundRect(g, x, cy - th / 2, tw, th, th / 2);
        g.fill(); g.stroke();
        g.restore();
        g.font = L.tagFont;
        g.fillStyle = '#e9c46f';
        g.textAlign = 'center';
        g.fillText(`${Math.max(1, Math.round(it.soon))} MIN`, x + tw / 2, cy + 0.5);
      }
    });
    g.restore();
  }
  g.restore();
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
