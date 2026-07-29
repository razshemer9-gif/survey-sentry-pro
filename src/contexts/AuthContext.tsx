import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/async";

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

async function fetchRole(userId: string): Promise<UserRole> {
  try {
    const { data } = await withTimeout(
      supabase.from("profiles").select("role").eq("user_id", userId).single(),
      5000,
      { data: null, error: null }
    );
    return ((data as { role?: string } | null)?.role as UserRole) ?? "employee";
  } catch {
    return "employee";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole]       = useState<UserRole | null>(null);
  const mounted = useRef(true);

  async function loadRole(u: User | null) {
    const r = u ? await fetchRole(u.id) : null;
    if (mounted.current) setRole(r);
  }

  async function refreshRole() {
    if (user) setRole(await fetchRole(user.id));
  }

  useEffect(() => {
    mounted.current = true;

    const init = async () => {
      try {
        const result = await withTimeout(
          supabase.auth.getSession(),
          8000,
          { data: { session: null }, error: null }
        );
        if (!mounted.current) return;
        const u = result.data.session?.user ?? null;
        setUser(u);
        await loadRole(u);
      } catch {
        // network error — show app as logged out
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
