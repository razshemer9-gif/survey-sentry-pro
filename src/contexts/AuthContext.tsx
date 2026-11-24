import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { storedSessionUser, supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/async";
import { cacheRole, clearCachedRole, readCachedRole } from "@/lib/role-cache";

export type UserRole = "owner" | "admin" | "employee";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  role: null,
  isAdmin: false,
  refreshRole: async () => {},
});

/**
 * The account's role, or null when the question could not be answered.
 *
 * Null is not "employee". A timeout on a weak connection used to demote an
 * owner, who then found דוחות החברה missing from the bar; the caller now
 * keeps what it knew instead. See lib/role-cache.
 */
async function fetchRole(userId: string): Promise<UserRole | null> {
  try {
    // Narrowed to the one field this reads: the builder is thenable rather
    // than a Promise, and its full response type has no shape a timeout
    // fallback could stand in for.
    const TIMED_OUT = Symbol("timeout");
    const result = await withTimeout<{ data: { role?: string } | null } | typeof TIMED_OUT>(
      (async () => {
        const res = await supabase.from("profiles").select("role").eq("user_id", userId).single();
        if (res.error) throw res.error;
        return { data: res.data as { role?: string } | null };
      })(),
      5000,
      TIMED_OUT,
    );
    if (result === TIMED_OUT) return null;
    const role = result.data?.role;
    // A row with no role is a real answer, and it means the plainest one.
    return role === "owner" || role === "admin" || role === "employee" ? role : "employee";
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole]       = useState<UserRole | null>(null);
  const mounted = useRef(true);

  async function loadRole(u: User | null) {
    if (!u) {
      clearCachedRole();
      if (mounted.current) setRole(null);
      return;
    }
    // What the device remembers, right away, so the bar is right before the
    // network has said anything.
    const remembered = readCachedRole(u.id);
    if (remembered && mounted.current) setRole(remembered);

    const fresh = await fetchRole(u.id);
    if (fresh) {
      cacheRole(u.id, fresh);
      if (mounted.current) setRole(fresh);
    } else if (!remembered && mounted.current) {
      // Nothing known and nothing to be had: the least the app can offer.
      setRole("employee");
    }
  }

  async function refreshRole() {
    if (!user) return;
    const fresh = await fetchRole(user.id);
    if (!fresh) return;
    cacheRole(user.id, fresh);
    setRole(fresh);
  }

  useEffect(() => {
    mounted.current = true;

    const init = async () => {
      // A session the device already holds, in case the server cannot be
      // reached. Taken before the call, so the answer to "did it come back
      // in time" is never confused with "is anybody signed in".
      const known = storedSessionUser();
      try {
        // The fallback is what this device already knows, so a call that
        // does not come back leaves the person exactly as signed in as they
        // were. It used to be "no session", which is why a server that went
        // quiet signed everybody out — and sent them to a login screen that
        // could not let them back in, being served by the same server.
        const u = await withTimeout(
          supabase.auth.getSession().then((r) => r.data.session?.user ?? null),
          8000,
          known,
        );
        if (!mounted.current) return;
        setUser(u);
        await loadRole(u);
      } catch {
        // Unreachable is not signed out.
        if (!mounted.current) return;
        setUser(known);
        await loadRole(known);
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        if (mounted.current) setUser(u);
        await loadRole(u);
      },
    );

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin = role === "owner" || role === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, role, isAdmin, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
