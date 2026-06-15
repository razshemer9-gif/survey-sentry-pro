import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .single();
    return (data?.role as UserRole) ?? "employee";
  } catch {
    return "employee";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole]       = useState<UserRole | null>(null);

  async function loadRole(u: User | null) {
    setRole(u ? await fetchRole(u.id) : null);
  }

  async function refreshRole() {
    if (user) setRole(await fetchRole(user.id));
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);
      const u = session?.user ?? null;
      setUser(u);
      await loadRole(u);
      setLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        await loadRole(u);
      },
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
