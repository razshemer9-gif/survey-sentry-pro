// Raw Supabase calls for the `work_hours` table.
//
// Access control lives in the database, not here. An employee's policies
// match only rows where device_id is their own uid; an owner or admin
// additionally matches every row for reading — and only for reading. There
// is deliberately no admin policy to update or delete someone else's hours:
// a record of time worked that the employer can silently change is not a
// record. Corrections are made by the person who logged them.
//
// So these queries do not filter by device_id themselves. Doing so would
// re-apply the employee rule to an owner and hide the very rows the screen
// exists to show.
import { requireUserId as getUserId } from "./current-user";
import { supabase } from "./supabase";
import { WorkHoursEntry } from "./work-hours";



type Row = { id: string; device_id: string; data: WorkHoursEntry };

function withOwner(data: WorkHoursEntry, deviceId: string): WorkHoursEntry {
  return { ...data, ownerId: deviceId };
}

/**
 * Every entry this account may see: an employee's own, and for an owner or
 * admin, everyone's. Newest day first.
 */
export async function remoteListWorkHours(limit = 500): Promise<WorkHoursEntry[]> {
  const { data, error } = await supabase
    .from("work_hours")
    .select("id, device_id, data")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Row[]).map((row) => withOwner(row.data, row.device_id));
}

export async function remoteSaveWorkHours(entry: WorkHoursEntry): Promise<WorkHoursEntry> {
  const userId = await getUserId();
  const saved: WorkHoursEntry = { ...entry, ownerId: entry.ownerId || userId, updatedAt: Date.now() };
  const { error } = await supabase.from("work_hours").upsert({
    id: saved.id,
    // An entry always belongs to whoever logged it, never to whoever is
    // looking at it — an owner reading the list must not become its author.
    device_id: saved.ownerId,
    data: saved,
    created_at: saved.createdAt,
    updated_at: saved.updatedAt,
  });
  if (error) throw error;
  return saved;
}

export async function remoteDeleteWorkHours(id: string): Promise<void> {
  const { error } = await supabase.from("work_hours").delete().eq("id", id);
  if (error) throw error;
}

/** True once the table exists; the screen says so plainly while it does not. */
export async function workHoursTableReady(): Promise<boolean> {
  const { error } = await supabase.from("work_hours").select("id").limit(1);
  return !error;
}
