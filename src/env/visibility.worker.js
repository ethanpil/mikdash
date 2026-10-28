// Visibility volume worker (env/visibility.js; lowend-visuals). Two jobs:
//
//  'rooms' — per room, a brick of the share of the hemisphere each of its openings fills (the shader's own cheap aperture
//            form, weight 1; visibility-core.js computeRooms). Fast (no geometry): runs at boot.
//  'ao'    — ambient obscurance of the precinct on a coarse grid, ray-marched through a voxelisation of the collision
//            world's triangle soup (visibility-core.js computeAO). Cached in IndexedDB by a hash of the geometry and the
//            parameters.
import { computeRooms, computeAO, fnv } from './visibility-core.js';

// ------------------------------------------------------------------------------------------------ AO
const DB = 'mikdash-visibility', STORE = 'ao';
function idb() {
  return new Promise((res) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch { res(null); }
  });
}
async function cacheGet(key) {
  const db = await idb();
  if (!db) return null;
  return new Promise((res) => {
    try {
      const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      rq.onsuccess = () => { db.close(); res(rq.result || null); };
      rq.onerror = () => { db.close(); res(null); };
    } catch { db.close(); res(null); }
  });
}
async function cachePut(key, value) {
  const db = await idb();
  if (!db) return;
  await new Promise((res) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      // one entry per geometry (amah standard, tier detail): keep the newest four
      const all = st.getAllKeys();
      all.onsuccess = () => {
        const keys = all.result.filter((k) => k !== key);
        if (keys.length >= 4) for (const k of keys.slice(0, keys.length - 3)) st.delete(k);
        st.put(value, key);
      };
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = tx.onabort = () => { db.close(); res(); };
    } catch { db.close(); res(); }
  });
}

async function ao(msg) {
  const { soup, origin, cell, dims, K, R, roomsKey, version } = msg;
  const u32 = new Uint32Array(soup.buffer, soup.byteOffset, soup.length);
  const key = `${version}:${fnv(u32).toString(16)}:${soup.length}:${roomsKey}:${dims.join('x')}:${origin.map((v) => v.toFixed(2)).join(',')}:${cell}:${K}:${R}`;
  const t0 = performance.now();
  const hit = await cacheGet(key);
  if (hit?.data) {
    postMessage({ type: 'ao-slab', id: msg.id, data: hit.data, cached: true, ms: performance.now() - t0 }, [hit.data.buffer]);
    return;
  }
  const r = computeAO(msg, (done, of) => postMessage({ type: 'ao-progress', id: msg.id, done, of }));
  const ms = performance.now() - t0;
  await cachePut(key, { data: r.data.slice(), created: Date.now() });
  postMessage({ type: 'ao-slab', id: msg.id, data: r.data, cached: false, ms, rays: r.rays, steps: r.steps, voxMs: r.voxMs }, [r.data.buffer]);
}

onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'rooms') {
      const t0 = performance.now();
      const data = computeRooms(msg);
      postMessage({ type: 'rooms', id: msg.id, data, ms: performance.now() - t0 }, [data.buffer]);
    } else if (msg.type === 'ao') await ao(msg);
  } catch (err) {
    postMessage({ type: 'error', id: msg.id, error: String(err?.stack || err) });
  }
};
