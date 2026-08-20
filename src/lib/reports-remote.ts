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
 * The caller's OWN reports, in full.
 *
 * Deliberately scoped to one account even though RLS would allow an admin to
 * read every row: a report stores its photos inline, so pulling everyone's
 * full rows shipped tens of megabytes and Postgres cancelled the statement
 * ("canceling statement due to statement timeout"). Own reports are a bounded
 * set, and fetching them in full is what keeps the offline cache complete.
 * Other people's reports arrive as summaries instead — see below.
 */
export async function remoteListReports(): Promise<SurveyReport[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("reports")
    .select("device_id, data")
    .eq("device_id", userId)
    .order("updated_at", { ascending: false });
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

export async function remoteSaveReport(report: SurveyReport): Promise<SurveyReport> {
  const userId = await getUserId();
  const updated = { ...report, updatedAt: Date.now() };
  const { error } = await supabase.from("reports").upsert({
    id: report.id,
    // Preserve the original author. Without this, an admin editing someone
    // else's report would rewrite device_id to their own id and quietly take
    // the report away from whoever wrote it.
    device_id: resolveOwnerId(report, userId),
    data: updated,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  });
  if (error) throw error;
  return updated;
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
