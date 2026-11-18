/**
 * What to do when the database has no room left.
 *
 * The database is on a plan with a fixed ceiling, and a report carries its
 * photographs inside it, so the ceiling is reachable. When it is reached
 * every save is refused and the work of a whole day can sit on a phone with
 * nowhere to go. Rather than let that happen, the oldest report is removed
 * to make room for the one being written, and the consultant is told which
 * one went.
 *
 * Two rules keep this from ever being destructive by accident:
 *
 *  1. It only ever runs on an error that *means* "no room" — a handful of
 *     exact Postgres codes and phrases. A dropped connection, a refused
 *     permission or a rate limit never reaches it. This is deliberately
 *     narrow: the cost of a false positive is somebody's report.
 *  2. It only ever removes a report that is already safely on the server,
 *     belongs to the account doing the saving, and is not the one being
 *     written. Anything still waiting to be sent is untouchable.
 */

/** A report the server holds, as a candidate for removal. */
export interface EvictionCandidate {
  id: string;
  /** When it was last written to — the oldest goes first. */
  updatedAt: number;
  /** For telling the consultant what was removed. */
  name?: string | null;
}

/**
 * Postgres says it has no room in one of these ways. Supabase also puts the
 * whole database into read-only once the plan's ceiling is passed, which
 * arrives as 25006.
 */
const OUT_OF_SPACE_CODES = new Set([
  "53100", // disk_full
  "53200", // out_of_memory
  "25006", // read_only_sql_transaction — how a passed storage ceiling arrives
]);

/**
 * Matched against the message only when there is no code to go by. Each
 * phrase is specific enough that nothing else produces it: the bare words
 * "quota" or "exceeded" are deliberately not here, because a rate limit
 * would match them and reports would be deleted over a burst of traffic.
 */
const OUT_OF_SPACE_PHRASES = [
  "read-only transaction",
  "read only transaction",
  "read-only mode",
  "disk full",
  "no space left on device",
  "disk quota exceeded",
  "database size limit",
];

export function isOutOfSpace(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };

  if (typeof e.code === "string" && OUT_OF_SPACE_CODES.has(e.code)) return true;

  const message = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return OUT_OF_SPACE_PHRASES.some((p) => message.includes(p));
}

/**
 * The report to remove next: the one written to longest ago that is safe to
 * lose. Null when there is nothing safe to remove, in which case the save
 * fails as it would have anyway and nothing has been destroyed.
 *
 * `protectedIds` holds the report being saved and everything still waiting
 * to be sent from this device — a report that has not reached the server
 * cannot be recovered from it, so it is never a candidate.
 */
export function pickEviction(
  candidates: EvictionCandidate[],
  protectedIds: Iterable<string>,
): EvictionCandidate | null {
  const protect = new Set(protectedIds);
  return (
    candidates
      .filter((c) => !protect.has(c.id))
      .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))[0] ?? null
  );
}

/**
 * How many reports one save may remove before giving up. A report is at most
 * a few megabytes and the ceiling is hit by degrees, so one is normally
 * enough; the limit is there so that an error wrongly read as "no room"
 * could never empty the account.
 */
export const MAX_EVICTIONS_PER_SAVE = 10;
