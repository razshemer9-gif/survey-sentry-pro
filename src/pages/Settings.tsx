import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Save } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Switch } from "@/components/ui/switch";
import { ConsultantSettings, SurveyReportFormat, SurveyType, SURVEY_TYPES } from "@/lib/types";
import { loadUserSettings, saveUserSettings } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";

// Tab labels in the order the user requested
const TAB_ORDER: { id: SurveyType; label: string }[] = [
  { id: "accessibility",    label: "נגישות" },
  { id: "general_safety",   label: 'בטיחות כללי' },
  { id: "education_safety", label: 'בטיחות מוס"ח' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [s, setS] = useState<ConsultantSettings | null>(null);
  const [admin, setAdmin] = useState(false);
  const [savingType, setSavingType] = useState<SurveyType | null>(null);
  const [savingGeneral, setSavingGeneral] = useState(false);

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

  const getFormat = (type: SurveyType): SurveyReportFormat =>
    s.reportFormats?.[type] ?? { surveyType: type };

  const updateFormat = (type: SurveyType, patch: Partial<SurveyReportFormat>) => {
    const current = getFormat(type);
    setS((prev) =>
      prev
        ? {
            ...prev,
            reportFormats: {
              ...prev.reportFormats,
              [type]: { ...current, ...patch },
            },
          }
        : prev
    );
  };

  const updGeneral = (patch: Partial<ConsultantSettings>) =>
    setS((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleSaveGeneral = async () => {
    if (!user || !s) return;
    setSavingGeneral(true);
    try {
      await saveUserSettings(user.id, s);
      toast.success("פרטי היועץ נשמרו");
    } catch {
      toast.error("שגיאה בשמירת הפרטים");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSave = async (type: SurveyType) => {
    if (!user || !s) return;
    setSavingType(type);
    try {
      await saveUserSettings(user.id, s);
      toast.success("ההגדרות נשמרו");
    } catch {
      toast.error("שגיאה בשמירת ההגדרות");
    } finally {
      setSavingType(null);
    }
  };

  return (
    <AppShell>
      <header className="brand-gradient text-primary-foreground px-5 pb-5 pt-4 safe-top rounded-b-3xl shadow-elev">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold opacity-90">הגדרות</div>
          <div className="w-10" />
        </div>
        <h1 className="mt-3 text-2xl font-extrabold">הגדרות סוגי סקרים</h1>
        <p className="mt-1 text-sm opacity-85">בחר סוג סקר וערוך את ההגדרות שלו</p>
      </header>

      <div className="px-4 pt-4 pb-6" dir="rtl">

        {/* ── Consultant profile ── */}
        <div className="mb-5 rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">פרטי יועץ</p>

          <Field label="שם חברה">
            <Input
              placeholder='למשל: יועצי נגישות מתו"ס'
              value={s.companyName ?? ""}
              onChange={(e) => updGeneral({ companyName: e.target.value })}
            />
          </Field>

          <Field label="שם בעל המקצוע">
            <Input
              placeholder="שם מלא"
              value={s.consultantName ?? ""}
              onChange={(e) => updGeneral({ consultantName: e.target.value })}
            />
          </Field>

          <Field label="מספר רישוי">
            <Input
              placeholder="מספר רישוי שירות"
              value={s.license ?? ""}
              onChange={(e) => updGeneral({ license: e.target.value })}
              dir="ltr"
            />
          </Field>

          <Field label="טלפון">
            <Input
              placeholder="050-0000000"
              value={s.phone ?? ""}
              onChange={(e) => updGeneral({ phone: e.target.value })}
              dir="ltr"
            />
          </Field>

          <Field label='דוא"ל'>
            <Input
              placeholder="email@example.com"
              value={s.email ?? ""}
              onChange={(e) => updGeneral({ email: e.target.value })}
              dir="ltr"
            />
          </Field>

          <Field label="כתובת">
            <Input
              placeholder="רחוב, עיר"
              value={s.address ?? ""}
              onChange={(e) => updGeneral({ address: e.target.value })}
            />
          </Field>

          <Button
            onClick={handleSaveGeneral}
            className="w-full gap-2 rounded-2xl"
            size="lg"
            disabled={savingGeneral}
          >
            <Save className="h-5 w-5" />
            {savingGeneral ? "שומר..." : "שמור פרטי יועץ"}
          </Button>
        </div>

        <Tabs defaultValue="accessibility" dir="rtl">
          {/* ── Tab triggers ── */}
          <TabsList className="w-full mb-5 rounded-2xl h-11">
            {TAB_ORDER.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="flex-1 text-xs font-semibold rounded-xl">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Tab content ── */}
          {TAB_ORDER.map(({ id }) => {
            const surveyConfig = SURVEY_TYPES.find((t) => t.id === id)!;
            const fmt = getFormat(id);
            const upd = (patch: Partial<SurveyReportFormat>) => updateFormat(id, patch);
            const isSaving = savingType === id;

            return (
              <TabsContent key={id} value={id} className="space-y-4 mt-0">

                <Field label="כותרת הדוח (PDF)">
                  <Input
                    placeholder={surveyConfig.pdfTitle}
                    value={fmt.reportTitle ?? ""}
                    onChange={(e) => upd({ reportTitle: e.target.value || undefined })}
                  />
                </Field>

                <Field label="הקדמה קבועה">
                  <Textarea
                    placeholder="טקסט שיופיע בתחילת הדוח, לפני הממצאים"
                    value={fmt.fixedIntroduction ?? ""}
                    onChange={(e) => upd({ fixedIntroduction: e.target.value || undefined })}
                    rows={4}
                    className="text-sm"
                  />
                </Field>

                <Field label="שם בעל המקצוע">
                  <Input
                    placeholder="יקרא מפרטי היועץ הכלליים אם ריק"
                    value={fmt.professionalName ?? ""}
                    onChange={(e) => upd({ professionalName: e.target.value || undefined })}
                  />
                </Field>

                <Field label="תפקיד בעל המקצוע">
                  <Input
                    placeholder='למשל: מורשה נגישות מתו"ס'
                    value={fmt.professionalRole ?? ""}
                    onChange={(e) => upd({ professionalRole: e.target.value || undefined })}
                  />
                </Field>

                <Field label="מספר רישיון / תעודה">
                  <Input
                    placeholder="יקרא ממספר הרישוי הכללי אם ריק"
                    value={fmt.licenseNumber ?? ""}
                    onChange={(e) => upd({ licenseNumber: e.target.value || undefined })}
                    dir="ltr"
                  />
                </Field>

                <Field label="לוגו חברה">
                  <div className="space-y-2">
                    <PhotoPicker
                      value={fmt.companyLogo}
                      onChange={(u) => upd({ companyLogo: u || undefined })}
                      aspect="square"
                      label="העלה לוגו"
                    />
                    {fmt.companyLogo && (
                      <Button
                        onClick={() => upd({ companyLogo: undefined })}
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:bg-destructive/10"
                      >
                        נקה לוגו
                      </Button>
                    )}
                  </div>
                </Field>

                <Field label="חתימה">
                  <div className="space-y-2">
                    <PhotoPicker
                      value={fmt.signatureImage}
                      onChange={(u) => upd({ signatureImage: u || undefined })}
                      aspect="video"
                      label="העלה חתימה"
                    />
                    {fmt.signatureImage && (
                      <Button
                        onClick={() => upd({ signatureImage: undefined })}
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:bg-destructive/10"
                      >
                        נקה חתימה
                      </Button>
                    )}
                  </div>
                </Field>

                <Field label="חותמת">
                  <div className="space-y-2">
                    <PhotoPicker
                      value={fmt.stampImage}
                      onChange={(u) => upd({ stampImage: u || undefined })}
                      aspect="square"
                      label="העלה חותמת"
                    />
                    {fmt.stampImage && (
                      <Button
                        onClick={() => upd({ stampImage: undefined })}
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:bg-destructive/10"
                      >
                        נקה חותמת
                      </Button>
                    )}
                  </div>
                </Field>

                <Button
                  onClick={() => handleSave(id)}
                  className="w-full gap-2 rounded-2xl"
                  size="lg"
                  disabled={isSaving}
                >
                  <Save className="h-5 w-5" />
                  {isSaving ? "שומר..." : "שמור הגדרות"}
                </Button>

              </TabsContent>
            );
          })}
        </Tabs>

        {/* ── Admin mode ── */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">מצב מנהל</p>
              <p className="text-xs text-muted-foreground">מאפשר עריכה, הוספה ומחיקה של תבניות</p>
            </div>
            <Switch checked={admin} onCheckedChange={toggleAdmin} />
          </div>
        </div>

        <p className="pb-2 pt-3 text-center text-xs text-muted-foreground">
          ההגדרות נשמרות בענן ומשויכות לחשבונך
        </p>
      </div>
    </AppShell>
  );
}
