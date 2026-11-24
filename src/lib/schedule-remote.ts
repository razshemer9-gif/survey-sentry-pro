/**
 * The uploaded schedule, shared by everyone in the company.
 *
 * Access control lives in the database: anyone signed in may read it —
 * employees have to, or they cannot pick the job they worked — and only an
 * owner or admin may replace it.
 *
 * An upload replaces the days it covers rather than adding to them. The
 * schedule is corrected and resent during the day, and a file that only
 * added rows would leave the cancelled afternoon job sitting there looking
 * current, which is the one thing a schedule must never do.
 */
import { supabase } from "./supabase";
import type { ScheduleRow } from "./schedule";

type Row = { id: string; date: string; data: ScheduleRow };

/** Every scheduled job from this date onwards, oldest day first. */
export async function remoteListSchedule(fromDate: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from("work_schedule")
    .select("id, date, data")
    .gte("date", fromDate)
    .order("date", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({ ...r.data, id: r.id, date: r.date }));
}

/** One day's jobs — what the form needs while an employee fills it in. */
export async function remoteScheduleForDate(date: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from("work_schedule")
    .select("id, date, data")
    .eq("date", date)
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({ ...r.data, id: r.id, date: r.date }));
}

/**
 * Put a parsed file in place of the days it covers.
 *
 * The delete and the insert are two calls, so a failure between them would
 * leave those days empty. That is the right way round: an empty day shows
 * as "no schedule for this day" and the file can simply be uploaded again,
 * whereas a half-replaced day would read as complete and be believed.
 */
export async function remoteReplaceSchedule(rows: ScheduleRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("משתמש לא מחובר");

  const dates = [...new Set(rows.map((r) => r.date))];
  const { error: wipeError } = await supabase
    .from("work_schedule").delete().in("date", dates);
  if (wipeError) throw wipeError;

  const now = Date.now();
  // Two rows of one file can carry one id when a job is listed twice
  // identically; the upload should not fail over a duplicated line.
  const unique = new Map(rows.map((r) => [r.id, r]));
  const { error } = await supabase.from("work_schedule").insert(
    [...unique.values()].map((r) => ({
      id: r.id, date: r.date, data: r,
      uploaded_by: user.id, uploaded_at: now,
    })),
  );
  if (error) throw error;
  return unique.size;
}

/** True once the table exists; the screen says so plainly while it does not. */
export async function scheduleTableReady(): Promise<boolean> {
  const { error } = await supabase.from("work_schedule").select("id").limit(1);
  return !error;
}
