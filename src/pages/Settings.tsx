import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Save } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ConsultantSettings } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/storage";

export default function Settings() {
  const navigate = useNavigate();
  const [s, setS] = useState<ConsultantSettings | null>(null);

  useEffect(() => setS(getSettings()), []);

  if (!s) return null;

  const update = (patch: Partial<ConsultantSettings>) => setS({ ...s, ...patch });

  const handleSave = () => {
    saveSettings(s);
    toast.success("ההגדרות נשמרו");
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
          <PhotoPicker value={s.logo} onChange={(u) => update({ logo: u })} aspect="square" label="העלה לוגו" />
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

        <Button onClick={handleSave} className="w-full gap-2 rounded-2xl" size="lg">
          <Save className="h-5 w-5" /> שמור הגדרות
        </Button>

        <p className="pb-4 pt-2 text-center text-xs text-muted-foreground">
          כל הנתונים נשמרים מקומית במכשיר שלך בלבד
        </p>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
