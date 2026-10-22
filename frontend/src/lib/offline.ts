/**
 * Offline queue for field inspections: photos captured without connectivity are stored in
 * IndexedDB and uploaded automatically when the device is back online.
 */
import { api, ApiError, type ScanMeta } from './api';

const DB_NAME = 'pramiti-offline';
const STORE = 'pending-scans';
export const QUEUE_EVENT = 'pramiti:queue-changed';

export interface PendingScan {
  id: string;
  created_at: string;
  meta: ScanMeta;
  files: { name: string; type: string; blob: Blob }[];
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const notify = () => window.dispatchEvent(new Event(QUEUE_EVENT));

export async function queueScan(files: File[], meta: ScanMeta) {
  const item: PendingScan = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    meta,
    files: files.map((f) => ({ name: f.name, type: f.type, blob: f })),
  };
  await tx('readwrite', (s) => s.put(item));
  notify();
}

export async function listPending(): Promise<PendingScan[]> {
  try {
    return await tx<PendingScan[]>('readonly', (s) => s.getAll());
  } catch {
    return [];
  }
}

let syncing = false;

/** Upload queued scans one by one. Stops on network errors; drops items the server rejects. */
export async function syncPending(): Promise<{ uploaded: number; failed: string[] }> {
  if (syncing || !navigator.onLine) return { uploaded: 0, failed: [] };
  syncing = true;
  let uploaded = 0;
  const failed: string[] = [];
  try {
    for (const item of await listPending()) {
      const files = item.files.map((f) => new File([f.blob], f.name, { type: f.type }));
      try {
        await api.analyse(files, item.meta);
        uploaded++;
        await tx('readwrite', (s) => s.delete(item.id));
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) break; // still offline
        if (e instanceof ApiError && (e.status === 429 || e.status >= 500)) break; // try later
        failed.push(e instanceof Error ? e.message : 'Upload failed');
        await tx('readwrite', (s) => s.delete(item.id));
      }
      notify();
    }
  } finally {
    syncing = false;
    notify();
  }
  return { uploaded, failed };
}
