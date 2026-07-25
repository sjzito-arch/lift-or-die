import { DB_NAME, DB_VERSION, STORES, seedDefaults } from './schema.js';

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      for (const store of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(store.name)) {
          db.createObjectStore(store.name, { keyPath: store.keyPath });
        }
      }
    };

    req.onsuccess = async (event) => {
      const db = event.target.result;
      try {
        await seedDefaults(db);
        resolve(db);
      } catch (err) {
        reject(err);
      }
    };

    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function getStore(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function getRecord(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, storeName, 'readonly').get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllRecords(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, storeName, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function putRecord(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, storeName, 'readwrite').put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRecord(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db, storeName, 'readwrite').delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Reset all data (spec §14): clears every store, then reseeds the same
// defaults `openDB` would create for a brand-new database — the caller is
// expected to reload the page afterward so the app boots into Setup fresh.
export async function resetAllData() {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const storeNames = Object.values(STORES).map((s) => s.name);
    const txn = db.transaction(storeNames, 'readwrite');
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
    for (const name of storeNames) {
      txn.objectStore(name).clear();
    }
  });
  await seedDefaults(db);
}

// Reset Workout History (Settings): clears storedWorkouts and
// workoutSessions and zeroes lifetimeVotes, but leaves the rest of
// appSettings, exerciseConfigs, and workoutTemplates untouched — lets the
// product owner re-test the workout flow repeatedly without redoing setup.
export async function resetWorkoutHistory() {
  const settings = await getRecord(STORES.appSettings.name, 'settings');
  await runAtomicTransaction(
    [STORES.storedWorkouts.name, STORES.workoutSessions.name, STORES.appSettings.name],
    (stores) => {
      stores[STORES.storedWorkouts.name].clear();
      stores[STORES.workoutSessions.name].clear();
      stores[STORES.appSettings.name].put({ ...settings, lifetimeVotes: 0 });
    }
  );
}

// Puts one record and deletes another in a single transaction so the two
// writes commit together or not at all (e.g. saving a workout to history
// while removing its active session).
export async function putThenDeleteAtomic(putStoreName, putValue, deleteStoreName, deleteKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction([putStoreName, deleteStoreName], 'readwrite');
    let setupError = null;
    // A request queued before an explicit abort() still fires its own
    // bubbling error event, which can reach `onerror` before `onabort` —
    // and `txn.error` is null for a caller-initiated abort (per spec), so
    // a bare `reject(txn.error)` there would resolve the promise with
    // `null` and "win" the race. Both handlers must resolve the same way.
    const rejectWithBestError = () => reject(setupError ?? txn.error ?? new Error('Transaction aborted.'));
    txn.oncomplete = () => resolve();
    txn.onerror = rejectWithBestError;
    txn.onabort = rejectWithBestError;
    try {
      txn.objectStore(putStoreName).put(putValue);
      txn.objectStore(deleteStoreName).delete(deleteKey);
    } catch (err) {
      // If issuing either request throws (e.g. a malformed value), the
      // other request may already be queued. Explicitly abort so it can't
      // still commit on its own — IndexedDB has no way to know our setup
      // code failed partway through unless we tell it.
      setupError = err;
      txn.abort();
    }
  });
}

// General-purpose atomic transaction across multiple stores. `work` is
// called synchronously with `{ storeName: IDBObjectStore }` for each name in
// `storeNames` and should only issue put()/delete() calls (no awaiting) —
// everything it queues commits together or not at all. Used by workout
// completion, which touches exerciseConfigs (progression), storedWorkouts,
// workoutSessions, and appSettings (lifetime votes) in one go.
export async function runAtomicTransaction(storeNames, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(storeNames, 'readwrite');
    const stores = Object.fromEntries(storeNames.map((name) => [name, txn.objectStore(name)]));
    let setupError = null;
    // Same race as `putThenDeleteAtomic`: a request queued before the abort
    // can fire `onerror` (with `txn.error === null`, since this is a
    // caller-initiated abort) before `onabort` fires — both handlers must
    // resolve to the same value so whichever fires first is still correct.
    const rejectWithBestError = () => reject(setupError ?? txn.error ?? new Error('Transaction aborted.'));
    txn.oncomplete = () => resolve();
    txn.onerror = rejectWithBestError;
    txn.onabort = rejectWithBestError;
    try {
      work(stores);
    } catch (err) {
      // `work` may have already queued some requests before throwing (e.g.
      // it puts three of five exercise configs, then hits a bug). Without
      // an explicit abort, those already-queued requests would still
      // commit — IndexedDB only rolls back a transaction that's told to
      // abort, not one whose driving code merely threw.
      setupError = err;
      txn.abort();
    }
  });
}
