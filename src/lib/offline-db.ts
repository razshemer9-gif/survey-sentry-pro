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

export async function getCachedReport(id: string): Promise<SurveyReport | undefined> {
  const row = await getRow(id);
  return row && !row.deleted ? row.report : undefined;
}

export async function putCachedReport(report: SurveyReport, dirty: boolean): Promise<void> {
  await putRow({ id: report.id, report, dirty, deleted: false });
}

export async function getAllCachedReports(): Promise<SurveyReport[]> {
  const rows = await getAllRows();
  return rows.filter((r) => !r.deleted).map((r) => r.report);
}

export async function getDirtyRows(): Promise<CachedReportRow[]> {
  const rows = await getAllRows();
  return rows.filter((r) => r.dirty);
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

export async function removeCachedReport(id: string): Promise<void> {
  await deleteRow(id);
}
