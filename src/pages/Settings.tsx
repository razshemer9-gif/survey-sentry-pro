import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Save } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Switch } from "@/components/ui/switch";
import { ConsultantSettings } from "@/lib/types";
import { loadUserSettings, saveUserSettings } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [s, setS] = useState<ConsultantSettings | null>(null);
  const [admin, setAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setAdmin(localStorage.getItem("ans.admin") === "1");

    loadUserSettings(user.id).then(setS);
  }, [user]);

  const toggleAdmin = (v: boolean) => {
    setAdmin(v);
    if (v) localStorage.setItem("ans.admin", "1");
    else localStorage.removeItem("ans.admin");
    toast.success(v ? "מצב מנהל הופעל" : "מצב מנהל בוטל");
  };

  if (!s) return null;

  const update = (patch: Partial<ConsultantSettings>) => setS({ ...s, ...patch });

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveUserSettings(user.id, s);
      toast.success("ההגדרות נשמרו");
    } catch {
      toast.error("שגיאה בשמירת ההגדרות");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <header className="brand-gradient text-primary-foreground px-5 pb-6 pt-4 safe-top rounded-b-3xl shadow-elev">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold opacity-90">הגדרות</div>
          <div className="w-10" />
        </div>
        <h1 className="mt-3 text-2xl font-extrabold">פרטי היועץ</h1>
        <p className="mt-1 text-sm opacity-90">הפרטים יופיעו בכל דוח שתפיק</p>
      </header>

      <div className="space-y-4 px-5 pt-5">
        <Field label="לוגו / סמליל">
          <div className="space-y-2">
            <PhotoPicker value={s.logo} onChange={(u) => update({ logo: u })} aspect="square" label="העלה לוגו" />
            {s.logo && (
              <Button
                onClick={() => update({ logo: undefined })}
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:bg-destructive/10"
              >
                נקה לוגו
              </Button>
            )}
          </div>
        </Field>

        <Field label="שם החברה / משרד">
          <Input value={s.companyName} onChange={(e) => update({ companyName: e.target.value })} />
        </Field>
        <Field label="שם היועץ">
          <Input value={s.consultantName} onChange={(e) => update({ consultantName: e.target.value })} />
        </Field>
        <Field label="מספר רישוי / הסמכה">
          <Input value={s.license} onChange={(e) => update({ license: e.target.value })} />
        </Field>
        <Field label="טלפון">
          <Input value={s.phone} onChange={(e) => update({ phone: e.target.value })} type="tel" inputMode="tel" />
        </Field>
        <Field label='דוא"ל'>
          <Input value={s.email} onChange={(e) => update({ email: e.target.value })} type="email" inputMode="email" />
        </Field>
        <Field label="כתובת המשרד">
          <Input value={s.address} onChange={(e) => update({ address: e.target.value })} />
        </Field>

        <Button onClick={handleSave} className="w-full gap-2 rounded-2xl" size="lg" disabled={saving}>
          <Save className="h-5 w-5" /> {saving ? "שומר..." : "שמור הגדרות"}
        </Button>

        <div className="mt-2 rounded-2xl border border-border bg-card p-4" dir="rtl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">מצב מנהל</p>
              <p className="text-xs text-muted-foreground">מאפשר עריכה, הוספה ומחיקה של דרישות במאגר וצפייה במקור הפנימי</p>
            </div>
            <Switch checked={admin} onCheckedChange={toggleAdmin} />
          </div>
        </div>

        <p className="pb-4 pt-2 text-center text-xs text-muted-foreground">
          ההגדרות נשמרות בענן ומשויכות לחשבונך
        </p>
      </div>
    </AppShell>
  );
}
