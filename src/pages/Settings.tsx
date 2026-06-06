import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Save, ChevronDown, ChevronUp } from "lucide-react";
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

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [s, setS] = useState<ConsultantSettings | null>(null);
  const [admin, setAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formatsOpen, setFormatsOpen] = useState(false);

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

  const getFormat = (type: SurveyType): SurveyReportFormat =>
    s.reportFormats?.[type] ?? { surveyType: type };

  const updateFormat = (type: SurveyType, patch: Partial<SurveyReportFormat>) => {
    const current = getFormat(type);
    update({
      reportFormats: {
        ...s.reportFormats,
        [type]: { ...current, ...patch },
      },
    });
  };

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
        {/* ── Consultant details ── */}
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
        <Field label="מספר ת.ז.">
          <Input
            value={s.idNumber ?? ""}
            onChange={(e) => update({ idNumber: e.target.value })}
            inputMode="numeric"
            dir="ltr"
          />
        </Field>
        <Field label="מספר רישוי שירות / הסמכה">
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

        {/* ── Survey-type formats ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden" dir="rtl">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-right"
            onClick={() => setFormatsOpen((v) => !v)}
          >
            <div>
              <p className="text-sm font-semibold">הגדרות סוגי סקרים</p>
              <p className="text-xs text-muted-foreground">כותרות, הצהרות, חתימה וחותמת לכל סוג סקר</p>
            </div>
            {formatsOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </button>

          {formatsOpen && (
            <div className="border-t border-border px-4 pb-4 pt-3">
              <Tabs defaultValue="accessibility" dir="rtl">
                <TabsList className="w-full mb-4">
                  {SURVEY_TYPES.map((t) => (
                    <TabsTrigger key={t.id} value={t.id} className="flex-1 text-xs">
                      {t.shortLabel}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {SURVEY_TYPES.map((t) => {
                  const fmt = getFormat(t.id);
                  const upd = (patch: Partial<SurveyReportFormat>) => updateFormat(t.id, patch);
                  return (
                    <TabsContent key={t.id} value={t.id} className="space-y-4 mt-0">

                      {/* Identity per type */}
                      <Field label="כותרת הדוח (PDF)">
                        <Input
                          placeholder={t.pdfTitle}
                          value={fmt.reportTitle ?? ""}
                          onChange={(e) => upd({ reportTitle: e.target.value || undefined })}
                        />
                      </Field>
                      <Field label="שם בעל המקצוע">
                        <Input
                          placeholder="ייקרא מפרטי היועץ הכלליים אם ריק"
                          value={fmt.professionalName ?? ""}
                          onChange={(e) => upd({ professionalName: e.target.value || undefined })}
                        />
                      </Field>
                      <Field label="תפקיד / הסמכה">
                        <Input
                          placeholder='למשל: מורשה נגישות מתו"ס'
                          value={fmt.professionalRole ?? ""}
                          onChange={(e) => upd({ professionalRole: e.target.value || undefined })}
                        />
                      </Field>
                      <Field label="מספר רישוי / הסמכה">
                        <Input
                          placeholder="ייקרא ממספר הרישוי הכללי אם ריק"
                          value={fmt.licenseNumber ?? ""}
                          onChange={(e) => upd({ licenseNumber: e.target.value || undefined })}
                          dir="ltr"
                        />
                      </Field>
                      {/* Textual sections */}
                      <Field label="מבוא קבוע (הקדמה לדוח)">
                        <Textarea
                          placeholder="טקסט הקדמה שיופיע בתחילת הדוח"
                          value={fmt.fixedIntroduction ?? ""}
                          onChange={(e) => upd({ fixedIntroduction: e.target.value || undefined })}
                          rows={4}
                          className="text-sm"
                        />
                      </Field>

                      {/* Images */}
                      <Field label="לוגו ספציפי לסוג סקר זה">
                        <div className="space-y-2">
                          <PhotoPicker
                            value={fmt.companyLogo}
                            onChange={(u) => upd({ companyLogo: u || undefined })}
                            aspect="square"
                            label="העלה לוגו לסוג סקר זה"
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
                      <Field label="חתימה דיגיטלית (לסוג סקר זה)">
                        <div className="space-y-2">
                          <PhotoPicker
                            value={fmt.signatureImage}
                            onChange={(u) => upd({ signatureImage: u || undefined })}
                            aspect="video"
                            label="העלה תמונת חתימה"
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
                      <Field label="חותמת (stamp)">
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

                    </TabsContent>
                  );
                })}
              </Tabs>

              <Button onClick={handleSave} className="w-full gap-2 rounded-2xl mt-4" size="lg" disabled={saving}>
                <Save className="h-5 w-5" /> {saving ? "שומר..." : "שמור הגדרות"}
              </Button>
            </div>
          )}
        </div>

        {/* ── Admin mode ── */}
        <div className="mt-2 rounded-2xl border border-border bg-card p-4" dir="rtl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">מצב מנהל</p>
              <p className="text-xs text-muted-foreground">מאפשר עריכה, הוספה ומחיקה של תבניות וצפייה במקור הפנימי</p>
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
