import { storedSessionUser } from "./stored-session";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "./async";

/**
 * Who is signed in — answered within five seconds, always.
 *
 * Every part of the app needs this, and until today each one asked in its
 * own way and waited for ever. That cost four separate failures in a single
 * outage: a save button stuck on "שומר...", every consultant thrown out of
 * the app, an owner demoted to an employee, and finally nothing saving at
 * all. Each was the same mistake wearing different clothes, so the answer
 * lives in one place now and everyone asks here.
 *
 * The server is still asked first, because it is the authority whenever it
 * can be reached. It simply no longer gets to take for ever, and what the
 * device already holds stands in when it does.
 *
 * This grants nothing. The id decides whose drawer something is filed in on
 * this phone; what an account may actually read or write is settled by the
 * token and by RLS on the server, which never asked this function.
 */
export const USER_LOOKUP_DEADLINE_MS = 5000;

export async function currentUserId(): Promise<string | null> {
  return withTimeout(
    supabase.auth.getSession().then((r) => r.data.session?.user?.id ?? null),
    USER_LOOKUP_DEADLINE_MS,
    storedSessionUser()?.id ?? null,
  );
}

/**
 * The same question for callers that cannot do their work without a name.
 *
 * They used to call getUser, which always goes to the network — so an
 * unreachable server did not mean "I could not check", it meant waiting
 * with no end. Failing is the right answer there; waiting never was.
 */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error("משתמש לא מחובר");
  return id;
}
