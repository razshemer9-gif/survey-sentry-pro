// Raw Supabase calls for the `reports` table — no local cache, no offline
// logic. Used by both `storage.ts` (local-first orchestration) and
// `sync-engine.ts` (pushing queued changes), kept here to avoid a circular
// import between those two modules.
import { SurveyReport } from "./types";
import { supabase } from "./supabase";

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("משתמש לא מחובר");
  return user.id;
}

export async function remoteListReports(): Promise<SurveyReport[]> {
  const { data, error } = await supabase.rpc("list_my_reports");
  if (error) throw error;
  return (data ?? [])
    .map((row: { data: SurveyReport }) => row.data)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function remoteGetReport(id: string): Promise<SurveyReport | undefined> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("reports")
    .select("data")
    .eq("id", id)
    .eq("device_id", userId)
    .single();
  if (error) return undefined;
  return data?.data as SurveyReport;
}

export async function remoteSaveReport(report: SurveyReport): Promise<SurveyReport> {
  const userId = await getUserId();
  const updated = { ...report, updatedAt: Date.now() };
  const { error } = await supabase.from("reports").upsert({
    id: report.id,
    device_id: userId,
    data: updated,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  });
  if (error) throw error;
  return updated;
}

export async function remoteDeleteReport(id: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("device_id", userId);
  if (error) throw error;
}
