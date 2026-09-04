import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// No signUp helper on purpose. Accounts are created by an administrator in the
// Supabase dashboard, so the app never calls the sign-up endpoint. Note that
// removing this only takes the feature out of the app — the endpoint itself
// stays open until sign-ups are disabled in the Supabase auth settings, which
// is the actual enforcement point.

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
