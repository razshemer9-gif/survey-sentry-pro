import { createClient, type User } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://dkbujtvotivpqyomyhnf.supabase.co";

// The new sb_publishable_ key format has connectivity issues — fall back to legacy JWT key
const SUPABASE_ANON_KEY =
  !import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY.startsWith("sb_")
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYnVqdHZvdGl2cHF5b215aG5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mjk0NzgsImV4cCI6MjA5NDAwNTQ3OH0.IxLBjBgycaauc2a7QyyBh0WKisDsfoGz8jbl-_AafIc"
    : import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * The project's reference, which is also the prefix Supabase stores the
 * session under: `sb-<ref>-auth-token` in localStorage.
 */
const PROJECT_REF = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];

export const SESSION_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

/**
 * Whoever is signed in on this device, read from storage alone.
 *
 * getSession() looks here first but goes to the network when the access
 * token has expired, and that call can hang for as long as the server is
 * unreachable. The app cannot wait forever, but the thing it must never do
 * is take silence for an answer: a request that did not come back is not
 * the same as nobody being signed in, and treating it that way throws a
 * consultant out of an app they are signed into, in the middle of a survey,
 * with no way back in while the server is still down.
 *
 * So when the question cannot be asked, this is the answer: what the device
 * already knew. It grants nothing — every request still carries the token
 * the server will accept or refuse on its own terms.
 */
export function storedSessionUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: User; currentSession?: { user?: User } };
    // Supabase stores the whole user object, so this is the same shape the
    // client would have handed back — not a stand-in for it.
    const user = parsed?.user ?? parsed?.currentSession?.user;
    return user?.id ? user : null;
  } catch {
    // A private window, cleared storage, or a shape we do not recognise.
    return null;
  }
}
