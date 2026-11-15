// Background sync loop: pushes locally-dirty reports to Supabase whenever
// the app might be online. Local-first writes always succeed instantly
// (see storage.ts); this module is what eventually reconciles them with
// the server.
import { getDirtyRows, markSynced, removeCachedReport } from "./offline-db";
import { supabase } from "./supabase";
import { remoteSaveReport, remoteDeleteReport } from "./reports-remote";

export interface SyncStatus {
  syncing: boolean;
  pendingCount: number;
}

let status: SyncStatus = { syncing: false, pendingCount: 0 };
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
}

export function subscribeSyncStatus(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

let syncPromise: Promise<void> | null = null;

export async function syncPendingReports(): Promise<void> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    setStatus({ syncing: true });
    try {
      // Only this account's work is pushed. Another account's unsent rows
      // wait on the device until they sign back in — pushing them now would
      // either be refused, or, for an owner, file them under the wrong name.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const dirty = await getDirtyRows(userId);
      setStatus({ pendingCount: dirty.length });
      for (const row of dirty) {
        try {
          if (row.deleted) {
            await remoteDeleteReport(row.id);
            await removeCachedReport(row.id);
          } else {
            await remoteSaveReport(row.report);
            await markSynced(row.id);
          }
        } catch {
          // stays dirty — will retry on the next trigger
        }
      }
      const remaining = await getDirtyRows(userId);
      setStatus({ pendingCount: remaining.length });
    } finally {
      setStatus({ syncing: false });
      syncPromise = null;
    }
  })();
  return syncPromise;
}

let started = false;

export function startSyncEngine(): void {
  if (started) return;
  started = true;

  window.addEventListener("online", () => void syncPendingReports());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncPendingReports();
  });
  setInterval(() => void syncPendingReports(), 30_000);

  void syncPendingReports();
}
