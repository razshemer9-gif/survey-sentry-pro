// Local-first cache for reports, backed by IndexedDB (no new dependency).
// `storage.ts` reads/writes here first; `sync-engine.ts` pushes dirty rows
// to Supabase in the background via `reports-remote.ts`.
import { SurveyReport } from "./types";

const DB_NAME = "survey-sentry-offline";
const DB_VERSION = 1;
const STORE = "reports";

export interface CachedReportRow {
  id: string;
  report: SurveyReport;
  dirty: boolean;
  deleted: boolean;
  /**
   * The account this copy was cached for.
   *
   * IndexedDB belongs to the site, not to whoever is signed in, so without
   * this a second person signing in on the same phone was handed the first
   * one's reports: the list merges the cache, and the cache had never been
   * told that the account had changed. Every read is now filtered by it.
   *
   * Rows written before this existed carry no account and are ignored —
   * they are re-fetched from the server for whoever is actually signed in.
   */
  userId?: string;
}

/** Whether a cached row may be shown to the account now signed in. */
export function rowBelongsTo(row: CachedReportRow, userId: string | null): boolean {
  return !!userId && row.userId === userId;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getRow(id: string): Promise<CachedReportRow | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  return promisifyRequest(tx.objectStore(STORE).get(id));
}

async function putRow(row: CachedReportRow): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  await promisifyRequest(tx.objectStore(STORE).put(row));
}

async function deleteRow(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  await promisifyRequest(tx.objectStore(STORE).delete(id));
}

async function getAllRows(): Promise<CachedReportRow[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const rows = await promisifyRequest(tx.objectStore(STORE).getAll());
  return rows ?? [];
}

// ── Public API ──────────────────────────────────────────────────────────

export async function getCachedReport(id: string, userId: string | null): Promise<SurveyReport | undefined> {
  const row = await getRow(id);
  return row && !row.deleted && rowBelongsTo(row, userId) ? row.report : undefined;
}

export async function putCachedReport(report: SurveyReport, dirty: boolean, userId: string | null): Promise<void> {
  await putRow({ id: report.id, report, dirty, deleted: false, userId: userId ?? undefined });
}

export async function getAllCachedReports(userId: string | null): Promise<SurveyReport[]> {
  const rows = await getAllRows();
  return rows.filter((r) => !r.deleted && rowBelongsTo(r, userId)).map((r) => r.report);
}

/**
 * Rows waiting to be pushed, for this account only. Someone else's unsent
 * work stays where it is — it is not shown, and not pushed under the wrong
 * account; it goes up when they sign back in.
 */
export async function getDirtyRows(userId: string | null): Promise<CachedReportRow[]> {
  const rows = await getAllRows();
  return rows.filter((r) => r.dirty && rowBelongsTo(r, userId));
}

export async function isDirty(id: string): Promise<boolean> {
  const row = await getRow(id);
  return !!row?.dirty;
}

export async function markSynced(id: string): Promise<void> {
  const row = await getRow(id);
  if (!row) return;
  if (row.deleted) {
    await deleteRow(id);
  } else {
    await putRow({ ...row, dirty: false });
  }
}

export async function markDeletedLocally(id: string): Promise<void> {
  const row = await getRow(id);
  if (!row) return;
  await putRow({ ...row, deleted: true, dirty: true });
}

/** Everything this device holds for one account — used when they sign out. */
export async function clearCacheFor(userId: string): Promise<void> {
  const rows = await getAllRows();
  for (const row of rows) {
    if (row.userId === userId && !row.dirty) await deleteRow(row.id);
  }
}

export async function removeCachedReport(id: string): Promise<void> {
  await deleteRow(id);
}
