// The visibility volume (lowend-visuals): load-time data that replaces per-pixel work on the tiers whose quality flags ask
// for it (quality.interiors 'volume', quality.ao 'volume' — low and medium; high / ultra keep the exact paths).
//
//  1. ROOM BRICKS (interiors 'volume'). Each interior volume (env/volumes.js) gets a small 3D grid over its box (grown by
//     its margin and half a metre), cells 0.4–8 m per axis (at most 32 texels along it: a 240 m stoa is coarse along its
//     length, fine across it). A texel holds, for each of the room's openings (≤ 4, RGBA), the share of the hemisphere it
//     fills seen from there — the shader's own cheap form (interiors-glsl.js mkAperture) with a weight of 1. The shader
//     multiplies them by the openings' live weights (openness × brightness beyond, the same quantised values the exact
//     path packs), so doors and curtains never need a recompute: V = base + Σ share × weight, as the per-aperture loop
//     summed it. Computed in a Worker at env init (well before the first frame; boot waits for it if it is not).
//  2. PRECINCT AO (ao 'volume'). A 2 m grid of ambient obscurance over the Mount, ray-cast on the collision BVH's triangle
//     soup (ctx.physics) in the same Worker once the first frame is up: SH L1 per cell (a + b·n is the cosine-weighted
//     visibility within AO_R around a normal n). Cells inside a room are divided by the room's mean (its enclosure is
//     already its sky visibility: what stays is the corners). Cached in IndexedDB under a hash of the geometry and the
//     parameters, so later visits load it at once; it fades in over a second when it lands.
//
// Both textures reach every lit program as two sampler uniforms registered in three's ShaderLib standard / physical
// uniforms: three binds them per draw like any material texture (a sampler left at unit 0 would clash with the
// material's own sampler types). Their texture objects return themselves from clone(), so the uniform clones three makes
// per material share one GPU texture.
import { Data3DTexture, HalfFloatType, UnsignedByteType, RGBAFormat, LinearFilter, ClampToEdgeWrapping, ShaderLib } from 'three';
import { computeRooms } from './visibility-core.js';

/** room bricks and AO grid parameters (m) */
export const VIS = {
  maxTexels: 32, minCell: 0.4, maxCell: 8, pad: 0.5,
  aoCell: 2, aoRays: 48, aoRadius: 6, aoStrength: 0.75, aoFade: 1.5,
  // the precinct (world m): the Mount's enclosure with its walls and stoas, from below the Chuldah passages to above the
  // Heichal's roof
  aoMin: [-14, -16, -254], aoMax: [254, 64, 14],
  version: 1,
};

class SharedData3DTexture extends Data3DTexture {
  // three clones a built-in material's uniforms for each material: one texture for all of them
  clone() { return this; }
}
/** once uploaded, the GPU holds the volume: drop the CPU copy (a context loss reloads the page: main.js) */
function releaseData(tex) { tex.image.data = null; tex.onUpdate = null; }

/** unique uniform names shared with interiors-glsl.js */
export const VIS_UNIFORMS = { room: 'mkVisRoom', ao: 'mkVisAO' };

/**
 * Pack bricks (sizes [x, y, z] in texels) into a 3D atlas of at most `limit` texels a side: layers along z, each as deep
 * as the first (deepest) brick that opened it, filled by rows along x (best-fitting row first). Returns { pos, dims }.
 */
function packBricks(sizes, limit = 256) {
  const order = sizes.map((s, i) => i).sort((a, b) => sizes[b][2] - sizes[a][2] || sizes[b][1] - sizes[a][1] || sizes[b][0] - sizes[a][0]);
  const pos = new Array(sizes.length);
  const layers = [];
  let depth = 0, W = 0, H = 0;
  const place = (L, s) => {
    let best = null;
    for (const r of L.rows) if (r.h >= s[1] && r.x + s[0] <= limit && (!best || r.h < best.h)) best = r;
    if (!best && L.used + s[1] <= limit) { best = { y: L.used, h: s[1], x: 0 }; L.rows.push(best); L.used += s[1]; }
    if (!best) return null;
    const p = [best.x, best.y, L.z];
    best.x += s[0];
    W = Math.max(W, best.x); H = Math.max(H, best.y + best.h);
    return p;
  };
  for (const i of order) {
    const s = sizes[i];
    let p = null;
    for (const L of layers) if (L.d >= s[2] && (p = place(L, s))) break;
    if (!p) {
      const L = { z: depth, d: s[2], rows: [], used: 0 };
      layers.push(L);
      depth += s[2];
      p = place(L, s);
    }
    pos[i] = p;
  }
  return { pos, dims: [W, H, depth] };
}

export function createVisibility(ctx, volumes, { rooms = true, ao = true } = {}) {
  const renderer = ctx.renderer;
  const stats = { rooms: 0, texels: 0, roomMs: 0, roomBytes: 0, aoCells: 0, aoMs: 0, aoCached: null, aoRays: 0, error: null };
  let worker = null;
  try { worker = new Worker(new URL('./visibility.worker.js', import.meta.url), { type: 'module', name: 'mikdash-visibility' }); }
  catch (e) { console.warn('[env] visibility worker unavailable', e); }
  const pending = new Map();
  let nextId = 1;
  const post = (msg, transfer = []) => new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('no worker')); return; }
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...msg, id }, transfer);
  });
  if (worker) {
    worker.onmessage = (e) => {
      const m = e.data, p = pending.get(m.id);
      if (m.type === 'ao-progress') { stats.aoProgress = `${m.done}/${m.of}`; return; }
      if (!p) return;
      pending.delete(m.id);
      if (m.type === 'error') p.reject(new Error(m.error)); else p.resolve(m);
    };
    worker.onerror = (e) => { stats.error = String(e.message || e); for (const p of pending.values()) p.reject(e); pending.clear(); };
  }

  // ---------------------------------------------------------------------------------------------- room bricks
  const bricks = new Map(); // volume -> { S: [sx,sy,sz], O: [ox,oy,oz] } (uvw = P × S + O)
  let roomTex = null, roomsReady = Promise.resolve();
  if (rooms) {
    const defs = volumes.map((v) => {
      const p = v.margin + VIS.pad;
      const min = [v.min.x - p, v.min.y - p, v.min.z - p], max = [v.max.x + p, v.max.y + p, v.max.z + p];
      const cell = [0, 1, 2].map((a) => Math.min(VIS.maxCell, Math.max(VIS.minCell, (max[a] - min[a]) / (VIS.maxTexels - 1))));
      const n = [0, 1, 2].map((a) => Math.max(2, Math.ceil((max[a] - min[a]) / cell[a]) + 1));
      return { v, min, cell, n };
    });
    const pack = packBricks(defs.map((d) => d.n));
    const [W, H, D] = pack.dims;
    const data = new Uint16Array(W * H * D * 4);
    roomTex = new SharedData3DTexture(data, W, H, D);
    roomTex.format = RGBAFormat; roomTex.type = HalfFloatType;
    roomTex.minFilter = roomTex.magFilter = LinearFilter;
    roomTex.wrapS = roomTex.wrapT = roomTex.wrapR = ClampToEdgeWrapping;
    roomTex.unpackAlignment = 1;
    roomTex.name = 'env:visibility-rooms';
    defs.forEach((d, i) => {
      const o = pack.pos[i];
      // texel k of axis a sits at min + k × cell; uvw = (o + (P − min) / cell + 0.5) / dim
      const dim = [W, H, D];
      const S = [0, 1, 2].map((a) => 1 / (d.cell[a] * dim[a]));
      const O = [0, 1, 2].map((a) => (o[a] + 0.5 - d.min[a] / d.cell[a]) / dim[a]);
      bricks.set(d.v, { S, O, n: d.n, origin: o });
      d.origin = o;
    });
    stats.rooms = defs.length;
    stats.texels = defs.reduce((s, d) => s + d.n[0] * d.n[1] * d.n[2], 0);
    stats.roomBytes = data.byteLength;
    stats.atlas = pack.dims;
    const msg = {
      type: 'rooms', dims: pack.dims,
      rooms: defs.map((d) => ({
        min: d.min, cell: d.cell, n: d.n, origin: d.origin,
        aps: d.v.apertures.slice(0, 4).map((a) => {
          const wo = [0, 1, 2].filter((k) => k !== a.axis);
          return { cx: a.centre.x, cy: a.centre.y, cz: a.centre.z, axis: a.axis, sign: a.sign, u: wo[0], v: wo[1], hx: a.hx, hy: a.hy };
        }),
      })),
    };
    const t0 = performance.now();
    const land = (out, ms) => {
      data.set(out);
      roomTex.needsUpdate = true;
      roomTex.onUpdate = releaseData;
      stats.roomMs = Math.round(performance.now() - t0);
      stats.roomWorkerMs = Math.round(ms);
    };
    roomsReady = post(msg).then((m) => land(m.data, m.ms)).catch((e) => {
      // without the worker: the same on this thread (a fraction of a second)
      console.warn('[env] visibility rooms in a worker failed, computing here', e);
      const t1 = performance.now();
      land(computeRooms(msg), performance.now() - t1);
    });
  }

  // ---------------------------------------------------------------------------------------------- precinct AO
  const aoDims = [0, 1, 2].map((a) => Math.round((VIS.aoMax[a] - VIS.aoMin[a]) / VIS.aoCell));
  let aoTex = null, aoState = { strength: 0, target: 0, t: 0 }, aoReady = null;
  if (ao) {
    const [nx, ny, nz] = aoDims;
    // (no upload until the AO lands: the shader skips the lookup while its strength is 0)
    aoTex = new SharedData3DTexture(null, nx, ny, nz);
    aoTex.format = RGBAFormat; aoTex.type = UnsignedByteType;
    aoTex.minFilter = aoTex.magFilter = LinearFilter;
    aoTex.wrapS = aoTex.wrapT = aoTex.wrapR = ClampToEdgeWrapping;
    aoTex.unpackAlignment = 1;
    aoTex.name = 'env:visibility-ao';
    stats.aoCells = nx * ny * nz;
  }
  /** start the AO job (once): after the first frame, the triangle soup of the collision world */
  function startAO() {
    if (!aoTex || aoReady) return aoReady;
    const soup = ctx.physics?.soup;
    if (!soup?.length || !worker) { aoReady = Promise.resolve(false); return aoReady; }
    const copy = soup.slice();
    const roomsKey = volumes.length + ':' + volumes.map((v) => `${v.min.x.toFixed(1)},${v.max.z.toFixed(1)}`).join(';').length;
    const t0 = performance.now();
    aoReady = post({
      type: 'ao', soup: copy, origin: VIS.aoMin, cell: VIS.aoCell, dims: aoDims, K: VIS.aoRays, R: VIS.aoRadius,
      roomsKey, version: VIS.version,
      rooms: volumes.map((v) => ({ min: [v.min.x, v.min.y, v.min.z], max: [v.max.x, v.max.y, v.max.z] })),
    }, [copy.buffer]).then((m) => {
      aoTex.image.data = m.data;
      aoTex.needsUpdate = true;
      aoTex.onUpdate = releaseData;
      aoState.target = VIS.aoStrength;
      stats.aoMs = Math.round(performance.now() - t0);
      stats.aoWorkerMs = Math.round(m.ms);
      stats.aoCached = !!m.cached;
      stats.aoRays = m.rays || 0;
      return true;
    }).catch((e) => { stats.error = String(e); console.warn('[env] visibility AO failed', e); return false; });
    return aoReady;
  }

  // three's built-in materials pick the samplers up with their ShaderLib uniforms
  for (const lib of [ShaderLib.standard, ShaderLib.physical]) {
    if (!lib?.uniforms) continue;
    if (roomTex) lib.uniforms[VIS_UNIFORMS.room] = { value: roomTex };
    if (aoTex) lib.uniforms[VIS_UNIFORMS.ao] = { value: aoTex };
  }

  return {
    stats,
    get roomTexture() { return roomTex; },
    get aoTexture() { return aoTex; },
    /** world → brick texture coordinates of a volume: { S, O } (uvw = P × S + O), or null */
    brick: (v) => bricks.get(v) || null,
    /** resolves when the room bricks are in their texture (boot waits for this before the first frame) */
    roomsReady: () => roomsReady,
    startAO,
    /** resolves when the AO has landed (or failed); null before startAO */
    aoReady: () => aoReady || Promise.resolve(false),
    /** AO grid: origin (world), cell (m), dims, the strength it is applied with now (fades in when it lands) */
    aoParams(out) {
      out[0] = VIS.aoMin[0]; out[1] = VIS.aoMin[1]; out[2] = VIS.aoMin[2]; out[3] = VIS.aoCell;
      out[4] = aoDims[0]; out[5] = aoDims[1]; out[6] = aoDims[2]; out[7] = aoTex ? aoState.strength : 0;
      return out;
    },
    /** per frame: the AO's fade-in (real seconds); true while it changes */
    update(dt) {
      if (aoState.strength === aoState.target) return false;
      const step = (VIS.aoStrength / VIS.aoFade) * Math.max(dt, 0);
      aoState.strength = aoState.target > aoState.strength ? Math.min(aoState.target, aoState.strength + step) : Math.max(aoState.target, aoState.strength - step);
      return true;
    },
    /** screenshots: no fade */
    snapAO() { aoState.strength = aoState.target; },
    /** dev A/B: the AO applied or not (it fades) */
    get aoEnabled() { return aoState.target > 0 || !aoTex; },
    set aoEnabled(on) { if (aoReady) aoState.target = on ? VIS.aoStrength : 0; },
    dispose() {
      worker?.terminate();
      worker = null;
      for (const lib of [ShaderLib.standard, ShaderLib.physical]) {
        if (!lib?.uniforms) continue;
        delete lib.uniforms[VIS_UNIFORMS.room];
        delete lib.uniforms[VIS_UNIFORMS.ao];
      }
      roomTex?.dispose(); aoTex?.dispose();
    },
  };
}
