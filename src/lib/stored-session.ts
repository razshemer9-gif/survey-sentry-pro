import type { User } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./supabase-url";

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
