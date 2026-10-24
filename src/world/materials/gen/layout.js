// CPU-side masonry layout: rows (courses) of blocks that tile seamlessly in a W x H texture tile.
//
// Block starts sit at (k + 0.5) * q (q = start quantum), lengths are multiples of q in [minL, maxL], and
// joints of neighbouring rows (including the last row against the first, for the vertical wrap) stay at
// least `gap` apart — "breaking joints" as in real coursed masonry. Starts are therefore never within q/2 of
// a tile edge or of each other, which lets the shader patch recover each block's absolute start from the
// texture's alpha channel (block-local distance) robustly (see patch.js).
//
// Rows are uniform (H / round(H / rowH)) unless `heights` (a course table, metres, whole centimetres) is given:
// then the rows follow it and the tile height is their sum; `courseLut` maps every centimetre of the tile to its row.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cyc = (d, W) => {
  const m = ((d % W) + W) % W;
  return Math.min(m, W - m);
};

/** course table helpers: row starts (m) and the row at height y inside the tile */
export function courseStarts(heights) {
  const y0 = [0];
  for (const h of heights) y0.push(+(y0[y0.length - 1] + h).toFixed(4));
  return y0;
}

/**
 * @returns {{ rows:number, rowH:number, dMax:number, q:number, lut:Float32Array, lutW:number, list:number[][],
 *            heights:number[]|null, courseLut:Float32Array|null, courseN:number }}
 */
export function masonryLayout({ W, H, rowH, q, minL, maxL, gap, seed = 1, rowType = () => [0, 0], heights = null, rowLens = null }) {
  const rows = heights ? heights.length : Math.round(H / rowH);
  const Wq = Math.round(W / q);
  // rowLens (qa-r2, paving): [[minL, maxL], …] — each row draws its own length window, so rows of short slabs alternate
  // irregularly with rows of long ones instead of every row having the same mix (a regular checkerboard from afar)
  const ranges = rowLens || [[minL, maxL]];
  const dMax = Math.max(...ranges.map((r) => r[1]));
  if (rows > 16) throw new Error(`layout: ${rows} rows > 16`);
  if (Math.abs(Wq * q - W) > 1e-6) throw new Error(`layout: tile width ${W} is not a multiple of q ${q}`);
  if (heights && Math.abs(heights.reduce((a, b) => a + b, 0) - H) > 1e-6) throw new Error('layout: course heights do not sum to the tile height');
  const rng = mulberry32(seed * 7919 + 17);
  const rngL = mulberry32(seed * 104729 + 3);
  const list = [];
  for (let r = 0; r < rows; r++) {
    const [rMin, rMax] = ranges[Math.floor(rngL() * ranges.length) % ranges.length];
    const lo = Math.round(rMin / q);
    const hi = Math.round(rMax / q);
    let pick = null;
    for (let attempt = 0; attempt < 600 && !pick; attempt++) {
      const lens = [];
      let rem = Wq;
      while (rem > 0) {
        let L;
        if (rem <= hi && (rem < 2 * lo || rng() < 0.45)) L = rem;
        else {
          const top = Math.min(hi, rem - lo);
          L = lo + Math.floor(rng() * (top - lo + 1));
        }
        lens.push(L);
        rem -= L;
      }
      const off = Math.floor(rng() * Wq);
      const starts = [];
      let acc = off;
      for (const L of lens) {
        starts.push(((acc % Wq) + 0.5) * q);
        acc += L;
      }
      starts.sort((x, y) => x - y);
      const ok = (other) => !other || starts.every((s) => other.every((t) => cyc(s - t, W) >= gap - 1e-6));
      if (ok(list[r - 1]) && (r !== rows - 1 || ok(list[0]))) pick = starts;
      else if (attempt === 599) pick = starts; // give up gracefully: still a valid partition
    }
    list.push(pick);
  }
  // lookup table: one texel per half-quantum (block boundaries fall on half-quantum edges) and row:
  // (block start m — negative for the block wrapping in from the previous tile —, length m, index, row code)
  const lutW = Wq * 2;
  const lut = new Float32Array(lutW * rows * 4);
  list.forEach((s, r) => {
    const [type, flag] = rowType(r);
    const code = type * 2 + flag;
    const n = s.length;
    for (let i = 0; i < lutW; i++) {
      const xc = (i + 0.5) * q * 0.5;
      let k = -1;
      for (let j = 0; j < n; j++) if (s[j] <= xc) k = j;
      let x0;
      let x1;
      if (k < 0) {
        k = n - 1;
        x0 = s[n - 1] - W;
        x1 = s[0];
      } else {
        x0 = s[k];
        x1 = k + 1 < n ? s[k + 1] : s[0] + W;
      }
      lut.set([x0, x1 - x0, k, code], (r * lutW + i) * 4);
    }
  });
  // course table: one texel per centimetre of the tile height = (row, row start m, row height m, row code)
  let courseLut = null;
  let courseN = 0;
  if (heights) {
    const y0 = courseStarts(heights);
    courseN = Math.round(H * 100);
    courseLut = new Float32Array(courseN * 4);
    let r = 0;
    for (let i = 0; i < courseN; i++) {
      const y = (i + 0.5) / 100;
      while (r < rows - 1 && y >= y0[r + 1]) r++;
      const [type, flag] = rowType(r);
      courseLut.set([r, y0[r], heights[r], type * 2 + flag], i * 4);
    }
  }
  return { rows, rowH: H / rows, dMax, q, lut, lutW, list, heights: heights ? [...heights] : null, courseLut, courseN };
}
