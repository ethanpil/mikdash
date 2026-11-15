// Cloud tile bake (env/clouds.js; sky-smoke-fire): ≈ 1 s of CPU off the main thread, started before the world build; cached in
// IndexedDB under the bake's version, size and seed, so later visits load it in a few ms.
import { bakeClouds, BAKE_VERSION } from './clouds-core.js';

const DB = 'mikdash-clouds', STORE = 'tile';
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
function op(db, mode, fn) {
  return new Promise((res) => {
    try {
      const tx = db.transaction(STORE, mode);
      const rq = fn(tx.objectStore(STORE));
      tx.oncomplete = () => res(rq?.result ?? null);
      tx.onerror = tx.onabort = () => res(null);
    } catch { res(null); }
  });
}

self.onmessage = async (e) => {
  const size = e.data?.size || 1024;
  const key = `v${BAKE_VERSION}-${size}`;
  const db = await idb();
  let data = null;
  if (db) {
    const v = await op(db, 'readonly', (st) => st.get(key));
    if (v instanceof Uint8Array && v.length === size * size * 4) data = v;
  }
  const cached = !!data;
  if (!data) {
    data = bakeClouds(size);
    if (db) await op(db, 'readwrite', (st) => { st.clear(); return st.put(data, key); });
  }
  db?.close();
  self.postMessage({ data, cached }, [data.buffer]);
};
