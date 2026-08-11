import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Save, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ConsultantSettings, SurveyReportFormat, SurveyType, SURVEY_TYPES } from "@/lib/types";
import { ELEMENT_STABILITY_DEFAULT_TERMS } from "@/lib/element-stability";
import { loadUserSettings, saveUserSettings } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";

const TAB_ORDER: { id: SurveyType; label: string }[] = [
  { id: "accessibility",     label: "נגישות" },
  { id: "general_safety",    label: "בטיחות כללי" },
  { id: "education_safety",  label: 'בטיחות מוס"ח' },
  { id: "element_stability", label: "יציבות אלמנטים" },
  { id: "risk_survey",       label: "סקר סיכונים" },
  { id: "accessibility_form_8", label: "טופס 8" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [s, setS] = useState<ConsultantSettings | null>(null);
  const [savingType, setSavingType] = useState<SurveyType | null>(null);

  useEffect(() => {
    if (!user) return;
    loadUserSettings(user.id).then(setS);
  }, [user]);

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
        : prev,
    );
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

  const headerTitle   = isAdmin ? "הגדרות מערכת" : "הגדרות אישיות";
  const headerSubtitle = isAdmin
    ? "בחר סוג סקר וערוך את ההגדרות שלו"
    : "עדכן את הפרטים האישיים שלך";

  return (
    <AppShell>
      <header className="brand-gradient text-primary-foreground px-5 pb-5 pt-4 safe-top rounded-b-3xl shadow-elev">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold opacity-90">הגדרות</div>
          <div className="w-10" />
        </div>
        <h1 className="mt-3 text-2xl font-extrabold">{headerTitle}</h1>
        <p className="mt-1 text-sm opacity-85">{headerSubtitle}</p>
      </header>

      <div className="px-4 pt-4 pb-6" dir="rtl">

        {/* ── Admin quick-links ── */}
        {isAdmin && (
          <div className="flex gap-3 mb-5">
            <button
              onClick={() => navigate("/standards")}
              className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <span>מאגר ממצאים</span>
            </button>
            <button
              onClick={() => navigate("/admin/users")}
              className="flex-1 flex items-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              <Users className="h-4 w-4 text-primary shrink-0" />
              <span>ניהול משתמשים</span>
            </button>
          </div>
        )}

        <Tabs defaultValue="accessibility" dir="rtl">
          <TabsList className="w-full mb-5 h-11 justify-start gap-1 overflow-x-auto no-scrollbar rounded-2xl [scroll-snap-type:x_proximity]">
            {TAB_ORDER.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="shrink-0 text-xs font-semibold rounded-xl px-4 [scroll-snap-align:start]"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TAB_ORDER.map(({ id }) => {
            const surveyConfig = SURVEY_TYPES.find((t) => t.id === id)!;
            const fmt    = getFormat(id);
            const upd    = (patch: Partial<SurveyReportFormat>) => updateFormat(id, patch);
            const isSaving = savingType === id;

            return (
              <TabsContent key={id} value={id} className="space-y-4 mt-0">

                {/* ── Admin-only: company / PDF settings ── */}
                {isAdmin && (
                  <>
                    <Field label="שם חברה">
                      <Input
                        placeholder='למשל: יועצי נגישות מתו"ס'
                        value={s.companyName ?? ""}
                        onChange={(e) =>
                          setS((prev) =>
                            prev ? { ...prev, companyName: e.target.value } : prev,
                          )
                        }
                      />
                    </Field>

                    <Field label="כתובת המשרד">
                      <Input
                        placeholder="רחוב, עיר"
                        value={s.address ?? ""}
                        onChange={(e) =>
                          setS((prev) =>
                            prev ? { ...prev, address: e.target.value } : prev,
                          )
                        }
                      />
                    </Field>
                  </>
                )}

                {/* ── Personal details / PDF text overrides / media — not used by
                    Form 8, which has its own dedicated מורשה נגישות identity
                    below instead of the generic professional fields. ── */}
                {id !== "accessibility_form_8" && (
                <>
                <Field label="שם בעל המקצוע">
                  <Input
                    placeholder="שם מלא"
                    value={s.consultantName ?? ""}
                    onChange={(e) =>
                      setS((prev) =>
                        prev ? { ...prev, consultantName: e.target.value } : prev,
                      )
                    }
                  />
                </Field>

                <Field label="תפקיד / הסמכה">
                  <Input
                    placeholder='למשל: מורשה נגישות מתו"ס'
                    value={fmt.professionalRole ?? ""}
                    onChange={(e) => upd({ professionalRole: e.target.value || undefined })}
                  />
                </Field>

                <Field label="טלפון">
                  <Input
                    placeholder="050-0000000"
                    value={s.phone ?? ""}
                    onChange={(e) =>
                      setS((prev) =>
                        prev ? { ...prev, phone: e.target.value } : prev,
                      )
                    }
                    dir="ltr"
                  />
                </Field>

                <Field label="מספר רישיון">
                  <Input
                    placeholder="מספר רישוי שירות"
                    value={s.license ?? ""}
                    onChange={(e) =>
                      setS((prev) =>
                        prev ? { ...prev, license: e.target.value } : prev,
                      )
                    }
                    dir="ltr"
                  />
                </Field>

                <Field label='דוא"ל'>
                  <Input
                    placeholder="email@example.com"
                    value={s.email ?? ""}
                    onChange={(e) =>
                      setS((prev) =>
                        prev ? { ...prev, email: e.target.value } : prev,
                      )
                    }
                    dir="ltr"
                  />
                </Field>

                {/* ── Admin-only: PDF text overrides ── */}
                {isAdmin && (
                  <>
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
                        onChange={(e) =>
                          upd({ fixedIntroduction: e.target.value || undefined })
                        }
                        rows={4}
                        className="text-sm"
                      />
                    </Field>

                    <Field label="שם בעל המקצוע (דוח)">
                      <Input
                        placeholder="יקרא מ'שם בעל המקצוע' אם ריק"
                        value={fmt.professionalName ?? ""}
                        onChange={(e) =>
                          upd({ professionalName: e.target.value || undefined })
                        }
                      />
                    </Field>

                    <Field label="מספר רישיון / תעודה (דוח)">
                      <Input
                        placeholder="יקרא ממספר הרישיון אם ריק"
                        value={fmt.licenseNumber ?? ""}
                        onChange={(e) =>
                          upd({ licenseNumber: e.target.value || undefined })
                        }
                        dir="ltr"
                      />
                    </Field>
                  </>
                )}

                {/* ── Media (all users) ── */}
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
                </>
                )}

                {/* ── Element stability: dedicated settings ── */}
                {id === "element_stability" && (
                  <div className="space-y-4 rounded-2xl border-2 border-primary/20 bg-card p-4">
                    <h3 className="font-bold text-sm text-primary">הגדרות דוח יציבות אלמנטים</h3>

                    <Field label="תמונת Footer (אופציונלי — מחליף את הפוטר הטקסטואלי)">
                      <div className="space-y-2">
                        <PhotoPicker value={fmt.footerImage} onChange={(u) => upd({ footerImage: u || undefined })} label="העלה תמונת Footer" />
                        {fmt.footerImage && (
                          <Button onClick={() => upd({ footerImage: undefined })} variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive/10">נקה Footer</Button>
                        )}
                      </div>
                    </Field>

                    <div className="space-y-2">
                      {([
                        { key: "showFooter", label: "הצג Footer בכל עמוד" },
                        { key: "showSignature", label: "הצג חתימה בעמוד האחרון" },
                        { key: "showStamp", label: "הצג חותמת בעמוד האחרון" },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none text-sm">
                          <input
                            type="checkbox"
                            checked={fmt[key] !== false}
                            onChange={(e) => upd({ [key]: e.target.checked } as Partial<SurveyReportFormat>)}
                            className="h-4 w-4 accent-primary"
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    <Field label='נוסח "המתקנים נמצאו יציבים"'>
                      <Input placeholder="המתקנים נמצאו יציבים" value={fmt.resultStableText ?? ""} onChange={(e) => upd({ resultStableText: e.target.value || undefined })} />
                    </Field>
                    <Field label='נוסח "המתקנים נמצאו לא יציבים"'>
                      <Input placeholder="המתקנים נמצאו לא יציבים" value={fmt.resultUnstableText ?? ""} onChange={(e) => upd({ resultUnstableText: e.target.value || undefined })} />
                    </Field>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-bold text-primary">רשימת התנאים — ברירת מחדל לדוחות חדשים</Label>
                        <button type="button" onClick={() => upd({ stabilityTermsDefault: undefined })} className="text-xs text-muted-foreground underline hover:text-primary">שחזר מקורי</button>
                      </div>
                      <p className="text-xs text-muted-foreground">התו {"{validUntil}"} יוחלף בתאריך התוקף שיוזן בדוח.</p>
                      {(() => {
                        const terms = fmt.stabilityTermsDefault ?? [...ELEMENT_STABILITY_DEFAULT_TERMS];
                        const setTerms = (n: string[]) => upd({ stabilityTermsDefault: n });
                        return (
                          <>
                            {terms.map((t, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <span className="text-xs font-bold text-muted-foreground pt-2 w-4 shrink-0">{i + 1}.</span>
                                <Textarea value={t} onChange={(e) => { const n = [...terms]; n[i] = e.target.value; setTerms(n); }} rows={2} className="flex-1 text-sm" dir="rtl" style={{ unicodeBidi: "plaintext" }} />
                                <div className="flex flex-col gap-0.5 pt-1">
                                  <button type="button" onClick={() => { if (i === 0) return; const n = [...terms]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setTerms(n); }} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▲</button>
                                  <button type="button" onClick={() => { if (i === terms.length - 1) return; const n = [...terms]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setTerms(n); }} disabled={i === terms.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▼</button>
                                  <button type="button" onClick={() => setTerms(terms.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                                </div>
                              </div>
                            ))}
                            <button type="button" onClick={() => setTerms([...terms, ""])} className="w-full rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary">+ הוסף סעיף</button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* ── Form 8 (טופס 8): מורשה נגישות identity, entered once and
                    snapshotted into every new report of this type. ── */}
                {id === "accessibility_form_8" && (
                  <div className="space-y-5 rounded-2xl border-2 border-primary/20 bg-card p-4">
                    <div>
                      <h3 className="font-bold text-sm text-primary">מורשה נגישות מתו״ס</h3>
                      <div className="mt-3 space-y-4">
                        <Field label="שם המורשה">
                          <Input value={fmt.accessibilityMatosName ?? ""} onChange={(e) => upd({ accessibilityMatosName: e.target.value || undefined })} placeholder="שם מלא" />
                        </Field>
                        <Field label='מספר ת"ז'>
                          <Input value={fmt.accessibilityMatosId ?? ""} onChange={(e) => upd({ accessibilityMatosId: e.target.value || undefined })} dir="ltr" inputMode="numeric" />
                        </Field>
                        <Field label="מס' רישום בפנקס הרשם">
                          <Input value={fmt.accessibilityMatosRegistrationNumber ?? ""} onChange={(e) => upd({ accessibilityMatosRegistrationNumber: e.target.value || undefined })} dir="ltr" />
                        </Field>
                        <Field label="שם הפנקס">
                          <Input value={fmt.accessibilityMatosRegistryName ?? ""} onChange={(e) => upd({ accessibilityMatosRegistryName: e.target.value || undefined })} placeholder='מורשה נגישות מתו"ס' />
                        </Field>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="font-bold text-sm text-primary">מורשה נגישות שירות</h3>
                      <div className="mt-3 space-y-4">
                        <Field label="שם המורשה">
                          <Input value={fmt.accessibilityServiceName ?? ""} onChange={(e) => upd({ accessibilityServiceName: e.target.value || undefined })} placeholder="שם מלא" />
                        </Field>
                        <Field label='מספר ת"ז'>
                          <Input value={fmt.accessibilityServiceId ?? ""} onChange={(e) => upd({ accessibilityServiceId: e.target.value || undefined })} dir="ltr" inputMode="numeric" />
                        </Field>
                        <Field label="מס' רישום בפנקס הרשם">
                          <Input value={fmt.accessibilityServiceRegistrationNumber ?? ""} onChange={(e) => upd({ accessibilityServiceRegistrationNumber: e.target.value || undefined })} dir="ltr" />
                        </Field>
                        <Field label="שם הפנקס">
                          <Input value={fmt.accessibilityServiceRegistryName ?? ""} onChange={(e) => upd({ accessibilityServiceRegistryName: e.target.value || undefined })} placeholder="מורשה נגישות השירות" />
                        </Field>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 space-y-4">
                      <h3 className="font-bold text-sm text-primary">פרטי קשר</h3>
                      <Field label="כתובת">
                        <Input value={fmt.accessibilityExpertAddress ?? ""} onChange={(e) => upd({ accessibilityExpertAddress: e.target.value || undefined })} />
                      </Field>
                      <Field label="מספר טלפון">
                        <Input value={fmt.accessibilityExpertPhone ?? ""} onChange={(e) => upd({ accessibilityExpertPhone: e.target.value || undefined })} dir="ltr" placeholder="050-0000000" />
                      </Field>
                      <Field label='כתובת דוא"ל'>
                        <Input value={fmt.accessibilityExpertEmail ?? ""} onChange={(e) => upd({ accessibilityExpertEmail: e.target.value || undefined })} dir="ltr" placeholder="email@example.com" />
                      </Field>
                    </div>

                    <div className="border-t border-border pt-4">
                      <Field label="חתימת המורשה">
                        <div className="space-y-2">
                          <PhotoPicker value={fmt.accessibilityExpertSignature} onChange={(u) => upd({ accessibilityExpertSignature: u || undefined })} aspect="video" label="העלה חתימה" />
                          {fmt.accessibilityExpertSignature && (
                            <Button onClick={() => upd({ accessibilityExpertSignature: undefined })} variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive/10">נקה חתימה</Button>
                          )}
                        </div>
                      </Field>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      הפרטים האלה יועתקו אוטומטית לכל טופס 8 חדש שתיצור. שינוי כאן לא ישפיע על טפסים שכבר נוצרו.
                    </p>
                  </div>
                )}

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

        <p className="pb-2 pt-3 text-center text-xs text-muted-foreground">
          ההגדרות נשמרות בענן ומשויכות לחשבונך
        </p>
      </div>
    </AppShell>
  );
}
