import type { UserRole } from "@/contexts/AuthContext";

/**
 * The last role the server gave for an account, kept on the device.
 *
 * The role is read from `profiles` on every start. When that read fails —
 * a lift, a basement, a request that times out — the old code answered
 * "employee", and an owner quietly lost דוחות החברה and the admin screens
 * until the next good start. A failed question is not an answer of "no".
 *
 * Keeping it here is safe: this only decides what the app OFFERS. What the
 * account may actually read and write is decided by RLS on the server, so a
 * stale or tampered value buys nothing — at worst a tab that opens an empty
 * list.
 */

const KEY = "shemer.role";

type Stored = { userId: string; role: UserRole };

export function readCachedRole(userId: string | undefined | null): UserRole | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (stored.userId !== userId) return null;
    return isRole(stored.role) ? stored.role : null;
  } catch {
    return null;
  }
}

export function cacheRole(userId: string, role: UserRole): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId, role } satisfies Stored));
  } catch { /* private window, or storage full — the app works without it */ }
}

export function clearCachedRole(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

function isRole(value: unknown): value is UserRole {
  return value === "owner" || value === "admin" || value === "employee";
}
