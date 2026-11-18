// Background sync loop: pushes locally-dirty reports to Supabase whenever
// the app might be online. Local-first writes always succeed instantly
// (see storage.ts); this module is what eventually reconciles them with
// the server.
import { toast } from "sonner";
import { getDirtyRows, markSynced, removeCachedReport } from "./offline-db";
import { supabase } from "./supabase";
import { remoteDeleteReport, remoteOldestOwnReports, remoteSaveReport } from "./reports-remote";
import { isOutOfSpace, MAX_EVICTIONS_PER_SAVE, pickEviction } from "./storage-pressure";
import { SurveyReport } from "./types";

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
      // Everything still waiting to be sent is off limits when room has to
      // be made: it exists on this device only.
      const unsent = new Set(dirty.map((r) => r.id));

      for (const row of dirty) {
        try {
          if (row.deleted) {
            await remoteDeleteReport(row.id);
            await removeCachedReport(row.id);
          } else {
            await saveMakingRoomIfNeeded(row.report, unsent);
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

/**
 * Sends a report, and if the database turns it away for want of room, makes
 * room and tries again.
 *
 * The oldest of this account's reports goes first, one at a time, until the
 * save goes through — so the day's work is never the thing that is lost. It
 * only ever runs on an error that means "no room"; see ./storage-pressure
 * for how narrowly that is read, and why.
 */
async function saveMakingRoomIfNeeded(report: SurveyReport, unsent: Set<string>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await remoteSaveReport(report);
      return;
    } catch (err) {
      if (!isOutOfSpace(err) || attempt >= MAX_EVICTIONS_PER_SAVE) throw err;

      const candidates = await remoteOldestOwnReports();
      const victim = pickEviction(candidates, [report.id, ...unsent]);
      if (!victim) throw err;

      await remoteDeleteReport(victim.id);
      await removeCachedReport(victim.id);
      console.warn("[storage] out of room — removed the oldest report", victim.id, victim.name);
      toast.warning(
        `האחסון התמלא. נמחק הדוח הישן ביותר כדי לשמור את החדש: ${victim.name?.trim() || "דוח ללא שם"}`,
        { duration: 10_000 },
      );
    }
  }
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
