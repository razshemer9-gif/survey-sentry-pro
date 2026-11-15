import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

type Profile = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "admin" | "employee";
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  employee: "עובד",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800",
  admin: "bg-blue-100 text-blue-800",
  employee: "bg-gray-100 text-gray-700",
};

export default function UserManagement() {
  const navigate = useNavigate();
  const { user: currentUser, refreshRole } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, role, created_at")
      .order("created_at");
    if (error) toast.error("שגיאה בטעינת משתמשים");
    else setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (userId: string, newRole: string) => {
    setUpdating(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("user_id", userId);
    if (error) {
      toast.error("שגיאה בעדכון תפקיד");
    } else {
      toast.success("תפקיד עודכן");
      if (userId === currentUser?.id) await refreshRole();
      await load();
    }
    setUpdating(null);
  };

  /**
   * Opening an account is done by the server, not here.
   * The key that can create a user has full run of the database, and this app
   * is a static site — anything it holds is readable by anyone who opens the
   * page. So the request goes to the create-user function, which checks that
   * the caller is an owner or an admin before it uses that key.
   */
  const createUser = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || newPassword.length < 8) {
      toast.error("יש להזין דוא\"ל וסיסמה באורך 8 תווים לפחות");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email, password: newPassword },
      });
      // A refused request carries its reason in the body, not in `error`.
      const failure = (data as { error?: string } | null)?.error;
      if (error || failure) throw new Error(failure || error?.message || "שגיאה");
      toast.success(`נפתח חשבון עבור ${email}`);
      setNewEmail("");
      setNewPassword("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בפתיחת החשבון");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <header className="brand-gradient text-primary-foreground px-5 pb-5 pt-4 safe-top rounded-b-3xl shadow-elev">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/settings")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold opacity-90">ניהול משתמשים</div>
          <button
            onClick={load}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15"
            title="רענן"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold">משתמשים והרשאות</h1>
        <p className="mt-1 text-sm opacity-85">ניהול גישות לצוות — {profiles.length} משתמשים</p>
      </header>

      <div className="px-4 pt-4 pb-8 space-y-3" dir="rtl">

        {/* Opening an account. Registration is closed to the public, so this
            is the way in for a new member of the team. */}
        <div className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
            <UserPlus className="h-4 w-4" /> פתיחת חשבון חדש
          </h2>
          <p className="text-xs text-muted-foreground">
            המשתמש ייפתח כ"עובד" ויוכל להתחבר מיד. אפשר לשנות לו הרשאה ברשימה שלמטה.
          </p>
          <div className="space-y-2">
            <div>
              <Label className="mb-1 block text-xs">דואר אלקטרוני</Label>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                dir="ltr"
                autoComplete="off"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">סיסמה ראשונית (8 תווים לפחות)</Label>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="text"
                dir="ltr"
                autoComplete="off"
                placeholder="הסיסמה שתמסור לו"
              />
            </div>
          </div>
          <Button onClick={createUser} disabled={creating} className="w-full gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            פתח חשבון
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-10">טוען...</p>
        ) : profiles.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">אין משתמשים</p>
        ) : (
          profiles.map((p) => {
            const isSelf = p.user_id === currentUser?.id;
            const isOwner = p.role === "owner";
            return (
              <div
                key={p.user_id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">
                        {p.full_name || p.email}
                      </p>
                      {isSelf && (
                        <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold">
                          אני
                        </span>
                      )}
                    </div>
                    {p.full_name && (
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      הצטרף: {new Date(p.created_at).toLocaleDateString("he-IL")}
                    </p>
                  </div>

                  {/* Own row or owner row — show badge only, no dropdown */}
                  {isSelf || isOwner ? (
                    <span
                      className={`text-xs font-semibold rounded-full px-3 py-1 shrink-0 ${ROLE_COLORS[p.role]}`}
                    >
                      {ROLE_LABELS[p.role]}
                    </span>
                  ) : (
                    <Select
                      value={p.role}
                      onValueChange={(v) => changeRole(p.user_id, v)}
                      disabled={updating === p.user_id}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="admin">מנהל</SelectItem>
                        <SelectItem value="employee">עובד</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })
        )}

        <p className="pt-2 text-center text-xs text-muted-foreground">
          משתמשים חדשים מצטרפים כעובדים אוטומטית
        </p>
      </div>
    </AppShell>
  );
}
