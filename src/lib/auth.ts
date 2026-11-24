import { User } from "@supabase/supabase-js";
import { clearCachedRole } from "./role-cache";
import { withTimeout } from "./async";
import { storedSessionUser } from "./stored-session";
import { supabase } from "./supabase";

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  // Here, and not wherever the app merely fails to find out who is signed
  // in: this is the one moment a person said to forget them.
  clearCachedRole();
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

/**
 * Bounded, and from the device when the server will not say.
 *
 * getUser always goes to the network, so an unreachable server did not
 * mean "I could not check" — it meant waiting with no end.
 */
export async function getCurrentUser(): Promise<User | null> {
  return withTimeout(
    supabase.auth.getUser().then((r) => r.data.user),
    5000,
    storedSessionUser(),
  );
}
