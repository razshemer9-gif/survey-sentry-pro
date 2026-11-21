// Raw Supabase calls for the `reports` table — no local cache, no offline
// logic. Used by both `storage.ts` (local-first orchestration) and
// `sync-engine.ts` (pushing queued changes), kept here to avoid a circular
// import between those two modules.
//
// Access control lives in the database (RLS), not here. An employee's policy
// matches only rows where device_id = their uid; owners/admins additionally
// match every row (see admin-reports-access.sql). That means these queries
// deliberately do NOT filter by device_id themselves — doing so would re-apply
// the employee rule to admins and hide the very rows they are allowed to see.
// If the admin migration has not been run, admins simply get their own reports
// back and the feature stays dormant.
import { SurveyReport } from "./types";
import { supabase } from "./supabase";

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("משתמש לא מחובר");
  return user.id;
}

/** Stamp the owning account onto the report payload — see SurveyReport.ownerId. */
function withOwner(data: SurveyReport, deviceId: string): SurveyReport {
  return { ...data, ownerId: deviceId };
}

/**
 * Which account a report must be stored under.
 *
 * Always the original author when known, never simply "whoever is saving".
 * An admin may edit a colleague's report; writing their own id here would
 * hand them the report and remove it from the author's list. A report with
 * no recorded owner is new, so the saver owns it.
 */
export function resolveOwnerId(report: Pick<SurveyReport, "ownerId">, currentUserId: string): string {
  return report.ownerId || currentUserId;
}

/**
 * How many of the caller's own reports are pulled down in full so that they
 * can be opened with no signal. A report carries its photos inline and
 * averages well over a megabyte, so "all of them" was never a real option:
 * for an account with 146 reports that was a quarter of a gigabyte, which
 * failed every time and took the whole list down with it. The rest of the
 * list arrives as summaries, and opening any report fetches it in full.
 */
const OFFLINE_PREFETCH = 10;

/**
 * The caller's most recent reports, in full.
 *
 * Deliberately scoped to one account even though RLS would allow an admin to
 * read every row: a report stores its photos inline, so pulling everyone's
 * full rows shipped tens of megabytes and Postgres cancelled the statement
 * ("canceling statement due to statement timeout"). Own reports are a bounded
 * set, and fetching them in full is what keeps the offline cache complete.
 * Other people's reports arrive as summaries instead — see below.
 */
export async function remoteListReports(limit = OFFLINE_PREFETCH): Promise<SurveyReport[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("reports")
    .select("device_id, data")
    .eq("device_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? [])
    .map((row: { device_id: string; data: SurveyReport }) => withOwner(row.data, row.device_id))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/**
 * Every report the caller may see, stripped to what the list renders: no
 * photos, notes or costs. `items` keeps only {id, status} so status counts
 * still work.
 *
 * These are NOT complete reports and must never be written to the offline
 * cache — the editor would then be able to save a stripped summary over the
 * real row. Opening a report always fetches the full row via remoteGetReport.
 *
 * Requires report-summaries.sql. Without it the RPC is missing and the caller
 * falls back to own-reports-only, which is the pre-existing behaviour.
 */
export async function remoteListReportSummaries(): Promise<SurveyReport[]> {
  const { data, error } = await supabase.rpc("list_report_summaries", { p_limit: 300 });
  if (error) throw error;
  return ((data ?? []) as { id: string; device_id: string; summary: SurveyReport }[])
    .map((row) => withOwner(row.summary, row.device_id))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/**
 * The caller's own reports, oldest first, as just enough to choose one to
 * remove when the database has no room left — see ./storage-pressure. Never
 * anyone else's: an owner can read the whole company's reports, and making
 * room for their own work must not cost an employee theirs.
 */
export async function remoteOldestOwnReports(
  limit = 20,
): Promise<{ id: string; updatedAt: number; name: string | null }[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("reports")
    .select("id, updated_at, name:data->>placeName")
    .eq("device_id", userId)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as { id: string; updated_at: number; name: string | null }[])
    .map((row) => ({ id: row.id, updatedAt: Number(row.updated_at) || 0, name: row.name }));
}

export async function remoteGetReport(id: string): Promise<SurveyReport | undefined> {
  const { data, error } = await supabase
    .from("reports")
    .select("device_id, data")
    .eq("id", id)
    .single();
  if (error) return undefined;
  if (!data) return undefined;
  return withOwner(data.data as SurveyReport, data.device_id as string);
}

/**
 * What happened to a report that was sent to the server.
 *
 * "stale" means somebody else saved that report after the copy on this
 * device was last in step with the server — a colleague editing from the
 * office while this phone was out of signal. `report` is then the server's
 * copy, not the one that was sent.
 */
export type SaveOutcome =
  | { status: "saved"; report: SurveyReport }
  | { status: "stale"; report: SurveyReport };

/**
 * Sends a report, unless the server holds a newer one.
 *
 * This used to be a plain upsert, which meant the last device to reach the
 * server won, whatever it was carrying. A phone that had been out of signal
 * since the morning would quietly overwrite an afternoon's work from the
 * office, with nobody told. Worse, it stamped the moment of *sending* onto
 * the report, so a stale copy always looked like the freshest one there was.
 *
 * Now the report carries the moment it was actually edited, and the write
 * only lands if the server has nothing newer. If it does, nothing is
 * overwritten and the caller is handed the server's copy to keep instead.
 */
export async function remoteSaveReport(report: SurveyReport): Promise<SaveOutcome> {
  const userId = await getUserId();
  // The time of the edit, set when it was saved on the device — never the
  // time this happens to reach the server.
  const updated = { ...report, updatedAt: report.updatedAt || Date.now() };

  const { data: written, error } = await supabase
    .from("reports")
    .update({ data: updated, updated_at: updated.updatedAt })
    .eq("id", report.id)
    .lte("updated_at", updated.updatedAt)
    .select("id");
  if (error) throw error;
  if (written && written.length > 0) return { status: "saved", report: updated };

  // Nothing was written: either the report is not on the server yet, or what
  // is there is newer than this.
  const { data: existing, error: readError } = await supabase
    .from("reports")
    .select("device_id, data, updated_at")
    .eq("id", report.id)
    .maybeSingle();
  if (readError) throw readError;

  if (!existing) {
    const { error: insertError } = await supabase.from("reports").insert({
      id: report.id,
      // Preserve the original author. Without this, an admin editing someone
      // else's report would rewrite device_id to their own id and quietly take
      // the report away from whoever wrote it.
      device_id: resolveOwnerId(report, userId),
      data: updated,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    });
    if (insertError) throw insertError;
    return { status: "saved", report: updated };
  }

  return {
    status: "stale",
    report: withOwner(existing.data as SurveyReport, existing.device_id as string),
  };
}

export async function remoteDeleteReport(id: string): Promise<void> {
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Display name per account id, for showing who wrote a report.
 * Only owners/admins can read other people's profiles (RLS), so for an
 * employee this resolves to just themselves — which is all they ever need.
 * profiles.full_name is frequently empty, hence the email fallback.
 */
export async function remoteListReportAuthors(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("profiles").select("user_id, full_name, email");
  if (error) return {};
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { user_id: string; full_name: string | null; email: string | null }[]) {
    const name = (row.full_name || "").trim() || (row.email || "").trim();
    if (name) map[row.user_id] = name;
  }
  return map;
}
