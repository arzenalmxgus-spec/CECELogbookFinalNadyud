/**
 * Tiny promise wrapper around IndexedDB used for offline-first records.
 * Stores: `students`, `visitors`, `visitor_logs` (local mirrors of the tables)
 * and `outbox` (pending mutations that still need to reach PostgreSQL).
 */

const DB_NAME = "visitor-logbook-offline";
const DB_VERSION = 2;
export const STUDENT_STORE = "students";
export const VISITOR_STORE = "visitors";
export const VISIT_LOG_STORE = "visitor_logs";
export const OUTBOX_STORE = "outbox";

export type OutboxOp = "create" | "update" | "delete";
export type OutboxEntity = "students" | "visitors" | "visitor_logs";

export interface OutboxEntry {
  key: string;
  /** Defaults to "students" for entries queued before multi-entity support. */
  entity?: OutboxEntity;
  op: OutboxOp;
  recordId: string;
  payload: unknown;
  createdAt: number;
}


function isBrowser() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of [STUDENT_STORE, VISITOR_STORE, VISIT_LOG_STORE]) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id" });
          }
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = fn(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  if (!isBrowser()) return [];
  try {
    return await run<T[]>(store, "readonly", (s) => s.getAll());
  } catch {
    return [];
  }
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  if (!isBrowser()) return;
  try {
    await run(store, "readwrite", (s) => s.put(value as unknown as Record<string, unknown>));
  } catch {
    /* offline cache is best-effort */
  }
}

export async function idbDelete(store: string, key: string): Promise<void> {
  if (!isBrowser()) return;
  try {
    await run(store, "readwrite", (s) => s.delete(key));
  } catch {
    /* best-effort */
  }
}

export async function idbClear(store: string): Promise<void> {
  if (!isBrowser()) return;
  try {
    await run(store, "readwrite", (s) => s.clear());
  } catch {
    /* best-effort */
  }
}

export async function idbReplaceAll<T extends { id: string }>(store: string, values: T[]): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const objectStore = tx.objectStore(store);
      objectStore.clear();
      values.forEach((value) => objectStore.put(value));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort */
  }
}
