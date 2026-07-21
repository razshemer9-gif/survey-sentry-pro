import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Download, Eye, FileDown, Images, Loader2, PenLine, Plus, Save, Trash2 } from "lucide-react";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Field } from "@/components/Field";
import { PhotoPicker } from "@/components/PhotoPicker";
import { PrintableReport } from "@/components/PrintableReport";
import { ReferencePhotoPicker } from "@/components/ReferencePhotoPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ChecklistItem, ConsultantSettings, DEFAULT_SETTINGS, ReferencePhotoEntry, SurveyReport } from "@/lib/types";
import { EDU_INSPECTION_TABLE } from "@/lib/edu-inspection-table";
import { ELEMENT_STABILITY_DEFAULT_TERMS } from "@/lib/element-stability";
import { getReport, loadUserSettings, saveReport, saveUserSettings } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";
import { buildPdfFileName, generateReportPdf } from "@/lib/pdf";
import { cropImageDataUrl, formatCurrency } from "@/lib/image";
import { cn } from "@/lib/utils";
import { SignaturePad } from "@/components/SignaturePad";


export default function ReportEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState<SurveyReport | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [settings, setSettings] = useState<ConsultantSettings>({ ...DEFAULT_SETTINGS });
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [refPickerItemId, setRefPickerItemId] = useState<string | null>(null);
  const [croppedCoverPhoto, setCroppedCoverPhoto] = useState<string | null>(null);
  const [customApprovalInput, setCustomApprovalInput] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<SurveyReport | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user) return;
    loadUserSettings(user.id).then(setSettings);
  }, [user]);

  // Keep reportRef in sync so handleGenerate always saves the latest state
  useEffect(() => { reportRef.current = report; }, [report]);

  // Pre-crop cover photo so the off-screen PDF element always has the correct size
  useEffect(() => {
    const src = report?.coverPhoto;
    if (!src) { setCroppedCoverPhoto(null); return; }
    cropImageDataUrl(src, 698, 400).then(setCroppedCoverPhoto);
  }, [report?.coverPhoto]);

  useEffect(() => {
    if (!id) return;
    getReport(id).then((r) => {
      if (!r) {
        toast.error("דוח לא נמצא");
        navigate("/");
        return;
      }
      // education_safety reports must not carry accessibility standards items —
      // strip anything that carries a standards-library signature (id, standard
      // part/clause, or a suggested correction — the latter three survive when
      // items were copied via an older user template that lost matchedRequirementId).
      if (r.surveyType === "education_safety") {
        const isStandardsItem = (it: ChecklistItem) =>
          !!it.matchedRequirementId || !!it.standardPart || !!it.clause || !!it.suggestedCorrection;
        const cleanItems = r.items.filter((it) => !isStandardsItem(it));
        if (cleanItems.length !== r.items.length) {
          const cleaned = { ...r, items: cleanItems, updatedAt: Date.now() };
          setReport(cleaned);
          saveReport(cleaned).catch((err) => {
            console.error("[edu-cleanup] failed to persist cleaned report", err);
            toast.error("שגיאה בשמירת ניקוי הדוח");
          });
          isFirstLoad.current = true;
          return;
        }
      }
      setReport(r);
      isFirstLoad.current = true;
    });
  }, [id, navigate]);

  // Auto-save: debounce 3s after every change
  useEffect(() => {
    if (!report) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try { await saveReport(report); } catch { /* silent */ }
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [report]);

  if (!report) {
    return (
      <AppShell>
        <div className="grid h-screen place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const update = (patch: Partial<SurveyReport>) => setReport((r) => (r ? { ...r, ...patch } : r));

  const updateItem = (itemId: string, patch: Partial<ChecklistItem>) => {
    setReport((r) => {
      if (!r) return r;
      const items = r.items.map((it) => {
        if (it.id !== itemId) return it;
        const updated = { ...it, ...patch };
        return updated;
      });
      return { ...r, items };
    });
  };

  const addItem = () =>
    setReport((r) =>
      r
        ? {
            ...r,
            items: [
              ...r.items,
              { id: uuid(), title: r.surveyType === "element_stability" ? "" : "ממצא חדש", status: "non_compliant", notes: "", estimatedCost: 0 },
            ],
          }
        : r,
    );

  const removeItem = (itemId: string) =>
    setReport((r) => (r ? { ...r, items: r.items.filter((it) => it.id !== itemId) } : r));

  const duplicateItem = (itemId: string) =>
    setReport((r) => {
      if (!r) return r;
      const idx = r.items.findIndex((it) => it.id === itemId);
      if (idx === -1) return r;
      const copy = { ...r.items[idx], id: uuid() };
      const items = [...r.items.slice(0, idx + 1), copy, ...r.items.slice(idx + 1)];
      return { ...r, items };
    });

  const moveItem = (itemId: string, dir: -1 | 1) =>
    setReport((r) => {
      if (!r) return r;
      const idx = r.items.findIndex((it) => it.id === itemId);
      const to = idx + dir;
      if (idx === -1 || to < 0 || to >= r.items.length) return r;
      const items = [...r.items];
      [items[idx], items[to]] = [items[to], items[idx]];
      return { ...r, items };
    });

  const handleSave = async () => {
    if (!report) return;
    try {
      await saveReport(report);
      toast.success("נשמר");
    } catch {
      toast.error("שגיאה בשמירה");
    }
  };

  const handleGenerate = async () => {
    const latest = reportRef.current;
    if (!latest) return;
    setGenerating(true);
    try {
      await saveReport(latest);
      // Two rAF ticks let React commit any pending renders to the print portal DOM
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await generateReportPdf(printRef.current, buildPdfFileName(latest));
      toast.success("ה-PDF הופק והורד");
    } catch (err) {
      console.error("[PDF]", err);
      toast.error("שגיאה ביצירת ה-PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPhotos = async () => {
    if (!report) return;

    type Entry = { name: string; dataUrl: string };
    const entries: Entry[] = [];

    report.items.forEach((item, idx) => {
      const num = String(idx + 1).padStart(2, "0");
      const photos: string[] = [];
      if (item.photo) photos.push(item.photo);
      if (item.referencePhotos?.length) photos.push(...item.referencePhotos);
      else if (item.referencePhoto) photos.push(item.referencePhoto);

      if (photos.length === 0) return;
      if (photos.length === 1) {
        entries.push({ name: `finding-${num}.jpg`, dataUrl: photos[0] });
      } else {
        photos.forEach((p, i) =>
          entries.push({ name: `finding-${num}-${i + 1}.jpg`, dataUrl: p }),
        );
      }
    });

    if (entries.length === 0) {
      toast.info("אין תמונות לשמירה");
      return;
    }

    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      entries.forEach(({ name, dataUrl }) => {
        const base64 = dataUrl.split(",")[1];
        if (base64) zip.file(name, base64, { base64: true });
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const safe = (report.placeName || "report").replace(/[^\w֐-׿\s-]/g, "").trim() || "report";
      const date = report.surveyDate || new Date().toISOString().slice(0, 10);
      const fileName = `תמונות-${safe}-${date}.zip`;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && navigator.canShare?.({ files: [new File([blob], fileName, { type: "application/zip" })] })) {
        await navigator.share({ files: [new File([blob], fileName, { type: "application/zip" })], title: fileName });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.rel = "noopener"; a.style.display = "none";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4_000);
      }
      toast.success(`${entries.length} תמונות הורדו`);
    } catch (err) {
      console.error("[ZIP]", err);
      toast.error("שגיאה ביצירת קובץ התמונות");
    } finally {
      setZipping(false);
    }
  };

  const totalCost = report.items
    .filter((i) => i.includeInCost)
    .reduce((s, i) => s + (Number(i.estimatedCost) || 0) * (i.quantity ?? 1), 0);

  return (
    <>
    <AppShell>
      {/* Header */}
      <header className="brand-gradient text-primary-foreground px-4 pb-5 pt-4 safe-top shadow-elev">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              saveReport(report).finally(() => navigate("/"));
            }}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"
            aria-label="חזור"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold opacity-90">עריכת דוח</div>
          <button
            onClick={handleSave}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"
            aria-label="שמור"
          >
            <Save className="h-5 w-5" />
          </button>
        </div>
        <h1 className="mt-3 truncate text-xl font-bold">{report.placeName || "סקר ללא שם"}</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">

        {/* COVER SECTION */}
        <div className="space-y-4">
          {(() => {
            const isEdu = report.surveyType === "education_safety";
            const isWelfare = report.surveyType === "welfare_inspection";
            const isElement = report.surveyType === "element_stability";
            return (
              <>
                {isElement ? (
                  <>
                    <Field label="שם המזמין">
                      <Input value={report.clientName} onChange={(e) => update({ clientName: e.target.value })} autoComplete="organization" />
                    </Field>
                    <Field label="שם הבודק">
                      <Input value={report.elementInspectorName || ""} onChange={(e) => update({ elementInspectorName: e.target.value })} />
                    </Field>
                    <Field label="מיקום">
                      <Input value={report.address} onChange={(e) => update({ address: e.target.value })} autoComplete="street-address" />
                    </Field>
                    <Field label="תאריך הבדיקה">
                      <Input type="date" value={report.surveyDate} onChange={(e) => update({ surveyDate: e.target.value })} />
                    </Field>
                    <Field label="בתאריך (טקסט חופשי)">
                      <Textarea value={report.elementIntroText || ""} onChange={(e) => update({ elementIntroText: e.target.value })} rows={3} placeholder="פסקת פתיחה חופשית שתופיע מתחת לפרטי הדוח" />
                    </Field>
                  </>
                ) : isWelfare ? (
                  <>
                    <Field label="שם המסגרת">
                      <Input value={report.placeName} onChange={(e) => update({ placeName: e.target.value })} placeholder="שם המסגרת שנבדקה" autoComplete="organization" />
                    </Field>
                    <Field label="לפרט את סוג המסגרת (לשמש כ...)">
                      <Input value={report.welfareFrameworkPurpose || ""} onChange={(e) => update({ welfareFrameworkPurpose: e.target.value })} placeholder="לדוגמה: פנימייה / מעון" />
                    </Field>
                    <Field label="סמל מסגרת">
                      <Input value={report.welfareFrameworkSymbol || ""} onChange={(e) => update({ welfareFrameworkSymbol: e.target.value })} />
                    </Field>
                    <Field label="שאלה פרטיה">
                      <Input value={report.welfareInquiry || ""} onChange={(e) => update({ welfareInquiry: e.target.value })} />
                    </Field>
                    <Field label="כתובת (עיר, רחוב, מספר)">
                      <Input value={report.address} onChange={(e) => update({ address: e.target.value })} autoComplete="street-address" />
                    </Field>
                    <Field label="בעלות הנכס">
                      <Input value={report.welfarePropertyOwner || ""} onChange={(e) => update({ welfarePropertyOwner: e.target.value })} />
                    </Field>
                    <Field label="שם המנהל">
                      <Input value={report.welfareManagerName || ""} onChange={(e) => update({ welfareManagerName: e.target.value })} />
                    </Field>
                    <Field label="נייד המנהל">
                      <Input value={report.welfareManagerPhone || ""} onChange={(e) => update({ welfareManagerPhone: e.target.value })} dir="ltr" />
                    </Field>
                    <Field label="ייעוד המסגרת">
                      <div className="flex gap-2 flex-wrap">
                        {([
                          { v: "outside_home", label: "מסגרת חוץ ביתית" },
                          { v: "daily", label: "מסגרת יומית" },
                          { v: "other", label: "אחר" },
                        ] as const).map(({ v, label }) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => update({ welfarePurposeType: report.welfarePurposeType === v ? undefined : v })}
                            className={cn(
                              "rounded-lg border py-2 px-3 text-sm font-semibold transition-colors",
                              report.welfarePurposeType === v
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {report.welfarePurposeType === "other" && (
                        <Input className="mt-2" value={report.welfarePurposeOther || ""} onChange={(e) => update({ welfarePurposeOther: e.target.value })} placeholder="פרט..." />
                      )}
                    </Field>
                    <Field label="תאריך המבדק">
                      <Input type="date" value={report.surveyDate} onChange={(e) => update({ surveyDate: e.target.value })} />
                    </Field>
                  </>
                ) : isEdu ? (
                  <>
                    <Field label="הישוב">
                      <Input value={report.city || ""} onChange={(e) => update({ city: e.target.value })} placeholder="לדוגמה: זכרון יעקב" />
                    </Field>
                    <Field label="הבעלות / הרשות">
                      <Input value={report.clientName} onChange={(e) => update({ clientName: e.target.value })} placeholder="לדוגמה: מועצה מקומית זכרון יעקב" />
                    </Field>
                    <Field label="שם המוסד">
                      <Input value={report.placeName} onChange={(e) => update({ placeName: e.target.value })} placeholder="לדוגמה: בית ספר יסודי א'" autoComplete="organization" />
                    </Field>
                    <Field label="סמל המוסד">
                      <Input value={report.institutionSymbol || ""} onChange={(e) => update({ institutionSymbol: e.target.value })} />
                    </Field>
                    <Field label="מספר תלמידים וכיתות">
                      <Input value={report.studentCount || ""} onChange={(e) => update({ studentCount: e.target.value })} placeholder="לדוגמה: 320 תלמידים, 12 כיתות" />
                    </Field>
                    <Field label="כתובת המוסד">
                      <Input value={report.address} onChange={(e) => update({ address: e.target.value })} autoComplete="street-address" />
                    </Field>
                    <Field label="שנת הקמה">
                      <Input value={report.establishedYear || ""} onChange={(e) => update({ establishedYear: e.target.value })} placeholder="לדוגמה: 1985" />
                    </Field>
                    <Field label="טלפון המוסד">
                      <Input value={report.institutionPhone || ""} onChange={(e) => update({ institutionPhone: e.target.value })} placeholder="04-0000000" dir="ltr" />
                    </Field>
                    <Field label="שם המנהל/ת">
                      <Input value={report.principalName || ""} onChange={(e) => update({ principalName: e.target.value })} />
                    </Field>
                    <Field label="שם המפקח">
                      <Input value={report.supervisorName || ""} onChange={(e) => update({ supervisorName: e.target.value })} />
                    </Field>
                    <Field label="משתתפים מטעם המוסד החינוכי">
                      <Input value={report.institutionParticipants || ""} onChange={(e) => update({ institutionParticipants: e.target.value })} />
                    </Field>
                    <Field label="משתתפים מטעם הרשות">
                      <Input value={report.authorityParticipants || ""} onChange={(e) => update({ authorityParticipants: e.target.value })} placeholder='לדוגמה: קב"ט — שם' />
                    </Field>
                    <Field label="תאריך המבדק">
                      <Input type="date" value={report.surveyDate} onChange={(e) => update({ surveyDate: e.target.value })} />
                    </Field>
                    <Field label="תמונת המוסד">
                      <PhotoPicker value={report.coverPhoto} onChange={(u) => update({ coverPhoto: u })} label="צרף תמונה" />
                    </Field>
                    <Field label="הערות כלליות (אופציונלי)">
                      <Textarea value={report.generalNotes || ""} onChange={(e) => update({ generalNotes: e.target.value })} rows={3} placeholder="הערות שיופיעו לפני פירוט הממצאים" />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="שם המקום / העסק">
                      <Input value={report.placeName} onChange={(e) => update({ placeName: e.target.value })} placeholder="לדוגמה: בית קפה הגליל" autoComplete="organization" />
                    </Field>
                    <Field label="שם הלקוח">
                      <Input value={report.clientName} onChange={(e) => update({ clientName: e.target.value })} autoComplete="name" />
                    </Field>
                    <Field label="כתובת">
                      <Input value={report.address} onChange={(e) => update({ address: e.target.value })} autoComplete="street-address" />
                    </Field>
                    <Field label="תאריך הסקר">
                      <Input type="date" value={report.surveyDate} onChange={(e) => update({ surveyDate: e.target.value })} />
                    </Field>
                    <Field label="סוג מסמך">
                      <div className="flex gap-2">
                        {(["survey", "approval"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => update({ reportMode: m })}
                            className={cn(
                              "flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors",
                              (report.reportMode ?? "survey") === m
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            {m === "survey" ? "סקר" : "אישור"}
                          </button>
                        ))}
                      </div>
                    </Field>
                    {report.surveyType !== "general_safety" && (
                    <Field label="סוג הבניין">
                      <Select value={report.buildingType || ""} onValueChange={(v) => update({ buildingType: v as "existing_public" | "new_public" | "other" })}>
                        <SelectTrigger><SelectValue placeholder="בחר סוג בניין" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="existing_public">בניין ציבורי קיים</SelectItem>
                          <SelectItem value="new_public">בניין ציבורי חדש</SelectItem>
                          <SelectItem value="other">אחר</SelectItem>
                        </SelectContent>
                      </Select>
                      {report.buildingType === "other" && (
                        <Input className="mt-2" value={report.buildingTypeOther || ""} onChange={(e) => update({ buildingTypeOther: e.target.value })} placeholder="פרט סוג בניין..." />
                      )}
                    </Field>
                    )}
                    <Field label="תמונת שער">
                      <PhotoPicker value={report.coverPhoto} onChange={(u) => update({ coverPhoto: u })} label="צרף תמונת חזית" />
                    </Field>
                    <Field label="הערות כלליות (אופציונלי)">
                      <Textarea value={report.generalNotes || ""} onChange={(e) => update({ generalNotes: e.target.value })} rows={4} placeholder="הערות שיופיעו בעמוד התקציר" />
                    </Field>
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* CHECKLIST SECTION */}
        <div className="space-y-3 pb-20">
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-semibold text-muted-foreground">
              {report.surveyType === "element_stability" ? "אלמנטים" : "ממצאים"} ({report.items.length})
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {report.items.map((item, idx) => {
            const refPhotos = item.referencePhotos && item.referencePhotos.length > 0
              ? item.referencePhotos
              : (item.referencePhoto ? [item.referencePhoto] : []);
            // ── Element stability: dedicated element card ──
            if (report.surveyType === "element_stability") {
              const isOk = item.status === "compliant";
              return (
                <div key={item.id} className="rounded-2xl border border-border border-r-4 border-r-[#0f766e] bg-card shadow-soft animate-fade-in overflow-hidden">
                  <div className="px-4 pt-3 pb-2 bg-muted/30 border-b border-border/60 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">מס׳ סד׳ {idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => moveItem(item.id, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-sm px-1" aria-label="הזז למעלה">▲</button>
                      <button onClick={() => moveItem(item.id, 1)} disabled={idx === report.items.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-sm px-1" aria-label="הזז למטה">▼</button>
                      <button onClick={() => duplicateItem(item.id)} className="text-muted-foreground hover:text-primary text-xs px-1" aria-label="שכפל">⧉</button>
                      <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive" aria-label="מחק"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <Label className="mb-1 block text-xs font-semibold text-foreground">תיאור האלמנט</Label>
                      <Textarea value={item.title} onChange={(e) => updateItem(item.id, { title: e.target.value })} placeholder="תיאור האלמנט שנבדק..." rows={2} />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-semibold text-foreground">תמונה (אופציונלי)</Label>
                      <PhotoPicker value={item.photo} onChange={(u) => updateItem(item.id, { photo: u })} label="צרף תמונת האלמנט" />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-semibold text-foreground">סטטוס</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { status: "compliant" })}
                          className={cn("flex-1 rounded-lg border-2 py-2 text-sm font-bold transition-colors",
                            isOk ? "border-success bg-success/15 text-success ring-2 ring-success/40" : "border-border bg-background text-muted-foreground hover:border-success/50")}
                        >תקין</button>
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { status: "non_compliant" })}
                          className={cn("flex-1 rounded-lg border-2 py-2 text-sm font-bold transition-colors",
                            item.status === "non_compliant" ? "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30" : "border-border bg-background text-muted-foreground hover:border-destructive/50")}
                        >לא תקין</button>
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-semibold text-foreground">חישוב / מלל טכני (אופציונלי)</Label>
                      <Textarea value={item.fieldNotes || ""} onChange={(e) => updateItem(item.id, { fieldNotes: e.target.value })} placeholder="נוסחאות, חישובים, יחידות — כל תווי המקלדת נתמכים..." rows={3} dir="rtl" style={{ unicodeBidi: "plaintext" }} />
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={item.id} className="rounded-2xl border border-border border-r-4 border-r-destructive bg-card shadow-soft animate-fade-in overflow-hidden">

                {/* ── Template data (read-only) ── */}
                <div className="px-4 pt-3 pb-3 bg-muted/30 border-b border-border/60">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">ממצא {idx + 1}</span>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive -mt-0.5" aria-label="מחק">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {!item.notes ? (
                    <input
                      value={item.title}
                      onChange={(e) => updateItem(item.id, { title: e.target.value })}
                      placeholder="שם הממצא"
                      className="w-full font-bold text-sm text-foreground leading-snug bg-transparent border-b border-dashed border-muted-foreground/40 focus:border-primary focus:outline-none pb-0.5"
                    />
                  ) : (
                    <p className="font-bold text-sm text-foreground leading-snug">{item.title || "ממצא ללא כותרת"}</p>
                  )}
                  {item.notes && (
                    <div className="mt-2 rounded-lg bg-background/70 px-2.5 py-1.5 text-xs text-foreground/80 leading-relaxed">
                      <span className="font-semibold text-foreground">ממצא: </span>{item.notes}
                    </div>
                  )}
                  {item.suggestedCorrection && (
                    <div className="mt-1.5 rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-1.5 text-xs text-foreground/80 leading-relaxed">
                      <span className="font-semibold text-primary">פתרון: </span>{item.suggestedCorrection}
                    </div>
                  )}
                  {refPhotos.length > 0 && (
                    <div className={cn("mt-2", refPhotos.length > 1 ? "grid grid-cols-2 gap-1.5" : "")}>
                      {refPhotos.map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt={item.referenceLabel || `פרט ${i + 1}`}
                          className="w-full max-h-24 object-contain rounded-lg border border-border bg-white"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Client-specific (editable) ── */}
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <Label className="mb-1 block text-xs font-semibold text-foreground">תמונת מצב קיים</Label>
                    <PhotoPicker
                      value={item.photo}
                      onChange={(u) => updateItem(item.id, { photo: u })}
                      label="צרף תמונה מהשטח"
                    />
                  </div>

                  <div>
                    <Label className="mb-1 block text-xs font-semibold text-foreground">פירוט מצב קיים</Label>
                    <Textarea
                      value={item.fieldNotes || ""}
                      onChange={(e) => updateItem(item.id, { fieldNotes: e.target.value })}
                      placeholder="תאר את הממצא שנצפה בשטח..."
                      rows={2}
                    />
                  </div>

                  {report.surveyType && report.surveyType !== "accessibility" && (
                  <div className="flex items-center gap-2">
                    <Label className="shrink-0 text-xs text-muted-foreground">קדימות</Label>
                    {([0, 1, 2] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => updateItem(item.id, { priority: item.priority === p ? undefined : p })}
                        className={cn(
                          "h-8 w-10 rounded-lg text-xs font-bold border-2 transition-colors",
                          p === 0
                            ? item.priority === 0 ? "bg-red-500 text-white border-red-500" : "bg-red-100 text-red-600 border-red-400"
                            : p === 1
                            ? item.priority === 1 ? "bg-orange-400 text-white border-orange-400" : "bg-orange-100 text-orange-600 border-orange-400"
                            : item.priority === 2 ? "bg-yellow-400 text-white border-yellow-400" : "bg-yellow-100 text-yellow-600 border-yellow-400"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="shrink-0 text-xs text-muted-foreground">מחיר יחידה (₪)</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={item.estimatedCost || ""}
                      onChange={(e) => updateItem(item.id, { estimatedCost: Number(e.target.value) || 0 })}
                      className="h-9 w-24 min-w-0"
                      placeholder="0"
                    />
                    <Label className="shrink-0 text-xs text-muted-foreground">כמות</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={item.quantity ?? 1}
                      onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className="h-9 w-16 min-w-0"
                      placeholder="1"
                    />
                    {(item.quantity ?? 1) > 1 && item.estimatedCost > 0 && (
                      <span className="text-xs text-muted-foreground">
                        = ₪{(item.estimatedCost * (item.quantity ?? 1)).toLocaleString()}
                      </span>
                    )}
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={!!item.includeInCost}
                        onChange={(e) => updateItem(item.id, { includeInCost: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      כלול באומדן
                    </label>
                  </div>
                </div>

              </div>
            );
          })}

          <Button onClick={addItem} variant="outline" className="w-full gap-2 rounded-2xl border-2 border-[#1e3a8a] text-[#1e3a8a] font-bold hover:bg-[#1e3a8a]/10">
            <Plus className="h-4 w-4" /> {report.surveyType === "element_stability" ? "אלמנט חדש" : "ממצא חדש"}
          </Button>

          {report.surveyType !== "element_stability" && (
          <div className="rounded-2xl bg-primary text-primary-foreground p-4 shadow-glow">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-90">אומדן תיקונים כולל</span>
              <strong className="text-xl">{formatCurrency(totalCost)}</strong>
            </div>
          </div>
          )}

          {/* Element stability — notes, result, editable terms, valid-until */}
          {report.surveyType === "element_stability" && (() => {
            const settingsDefaults = settings.reportFormats?.element_stability?.stabilityTermsDefault;
            const terms = report.stabilityTerms ?? settingsDefaults ?? [...ELEMENT_STABILITY_DEFAULT_TERMS];
            const setTerms = (next: string[]) => update({ stabilityTerms: next });
            return (
              <div className="space-y-4">
                <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-2">
                  <h3 className="font-bold text-sm text-primary">הערות</h3>
                  <Textarea value={report.elementNotes || ""} onChange={(e) => update({ elementNotes: e.target.value })} rows={4} placeholder="טקסט חופשי — פסקאות, רשימות, סימנים מיוחדים..." dir="rtl" style={{ unicodeBidi: "plaintext" }} />
                </div>

                <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-3">
                  <h3 className="font-bold text-sm text-primary">תוצאת הבדיקה</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => update({ elementStabilityStatus: "stable" })}
                      className={cn("flex-1 rounded-lg border-2 py-2.5 text-sm font-bold transition-colors",
                        report.elementStabilityStatus === "stable" ? "border-success bg-success/15 text-success ring-2 ring-success/40" : "border-border bg-background text-muted-foreground hover:border-success/50")}
                    >המתקנים נמצאו יציבים</button>
                    <button type="button" onClick={() => update({ elementStabilityStatus: "unstable" })}
                      className={cn("flex-1 rounded-lg border-2 py-2.5 text-sm font-bold transition-colors",
                        report.elementStabilityStatus === "unstable" ? "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30" : "border-border bg-background text-muted-foreground hover:border-destructive/50")}
                    >המתקנים נמצאו לא יציבים</button>
                  </div>
                  <Field label="תוקף הבדיקה עד תאריך (סעיף 8 ברשימה)">
                    <Input type="date" value={report.elementValidUntil || ""} onChange={(e) => update({ elementValidUntil: e.target.value })} />
                  </Field>
                </div>

                <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-primary">רשימת התנאים הקבועה</h3>
                    <button type="button" onClick={() => update({ stabilityTerms: undefined })} className="text-xs text-muted-foreground underline hover:text-primary">שחזר ברירת מחדל</button>
                  </div>
                  <p className="text-xs text-muted-foreground">ניתן לערוך, להוסיף, למחוק ולשנות סדר. הכיתוב "{"{validUntil}"}" יוחלף בתאריך התוקף.</p>
                  {terms.map((t, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-xs font-bold text-muted-foreground pt-2 w-4 shrink-0">{i + 1}.</span>
                      <Textarea value={t} onChange={(e) => { const n = [...terms]; n[i] = e.target.value; setTerms(n); }} rows={2} className="flex-1" dir="rtl" style={{ unicodeBidi: "plaintext" }} />
                      <div className="flex flex-col gap-0.5 pt-1">
                        <button type="button" onClick={() => { if (i === 0) return; const n = [...terms]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setTerms(n); }} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▲</button>
                        <button type="button" onClick={() => { if (i === terms.length - 1) return; const n = [...terms]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setTerms(n); }} disabled={i === terms.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▼</button>
                        <button type="button" onClick={() => setTerms(terms.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setTerms([...terms, ""])} className="w-full rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary">+ הוסף סעיף</button>
                </div>
              </div>
            );
          })()}

          {/* Required approvals — general_safety only */}
          {report.surveyType === "general_safety" && (() => {
            const PREDEFINED = ["אישור חשמלאי בודק", "אגרונום", "קונסטרוקטור"];
            const selected = report.requiredApprovals ?? [];
            const custom = selected.filter((a) => !PREDEFINED.includes(a));
            return (
              <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-3">
                <h3 className="font-bold text-sm text-primary">אישורים נדרשים</h3>
                {PREDEFINED.map((approval) => (
                  <label key={approval} className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selected.includes(approval)}
                      onChange={(e) => {
                        update({
                          requiredApprovals: e.target.checked
                            ? [...selected, approval]
                            : selected.filter((a) => a !== approval),
                        });
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">{approval}</span>
                  </label>
                ))}
                {custom.map((approval) => (
                  <div key={approval} className="flex items-center gap-2.5">
                    <input type="checkbox" checked readOnly className="h-4 w-4 accent-primary" />
                    <span className="text-sm flex-1">{approval}</span>
                    <button
                      type="button"
                      onClick={() => update({ requiredApprovals: selected.filter((a) => a !== approval) })}
                      className="text-muted-foreground hover:text-destructive text-xs"
                    >✕</button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customApprovalInput}
                    onChange={(e) => setCustomApprovalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customApprovalInput.trim()) {
                        update({ requiredApprovals: [...selected, customApprovalInput.trim()] });
                        setCustomApprovalInput("");
                      }
                    }}
                    placeholder="הוסף אישור נוסף..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    disabled={!customApprovalInput.trim()}
                    onClick={() => {
                      if (customApprovalInput.trim()) {
                        update({ requiredApprovals: [...selected, customApprovalInput.trim()] });
                        setCustomApprovalInput("");
                      }
                    }}
                    className="rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-40"
                  >
                    הוסף
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Opinion summary section */}
          <div dir="rtl" className="rounded-2xl border-2 border-primary/30 bg-card p-4 space-y-3">
            {report.surveyType === "general_safety" ? (
              <>
                <h3 className="font-bold text-sm text-primary">סיכום ממצאי הבדיקה:</h3>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => update({ accessibilityComplianceStatus: report.accessibilityComplianceStatus === "yes" ? undefined : "yes" })}
                    className={cn(
                      "rounded-xl border-2 py-3 px-4 text-sm font-bold text-right transition-colors",
                      report.accessibilityComplianceStatus === "yes"
                        ? "border-success bg-success/15 text-success ring-2 ring-success/40"
                        : "border-border bg-background text-muted-foreground hover:border-success/50 hover:text-success"
                    )}
                  >
                    המקום נמצא בטיחותי - האישור מותנה בהמצאת האישורים הנדרשים
                  </button>
                  <button
                    onClick={() => update({ accessibilityComplianceStatus: report.accessibilityComplianceStatus === "safe" ? undefined : "safe" })}
                    className={cn(
                      "rounded-xl border-2 py-3 px-4 text-sm font-bold text-right transition-colors",
                      report.accessibilityComplianceStatus === "safe"
                        ? "border-success bg-success/15 text-success ring-2 ring-success/40"
                        : "border-border bg-background text-muted-foreground hover:border-success/50 hover:text-success"
                    )}
                  >
                    המקום נמצא בטיחותי !
                  </button>
                  <button
                    onClick={() => update({ accessibilityComplianceStatus: report.accessibilityComplianceStatus === "no" ? undefined : "no" })}
                    className={cn(
                      "rounded-xl border-2 py-3 px-4 text-sm font-bold text-right transition-colors",
                      report.accessibilityComplianceStatus === "no"
                        ? "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30"
                        : "border-border bg-background text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                    )}
                  >
                    לאחר טיפול בליקויים יש לזמן ביקורת נוספת
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-sm text-primary">סיכום חוות הדעת של מורשה הנגישות:</h3>
                <p className="text-sm text-foreground leading-relaxed">
                  האם בוצעו בעסק כל התאמות הנגישות וההוראות החלות עליו לפי התקנות?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => update({ accessibilityComplianceStatus: report.accessibilityComplianceStatus === "yes" ? undefined : "yes" })}
                    className={cn(
                      "flex-1 rounded-xl border-2 py-3 text-sm font-bold transition-colors",
                      report.accessibilityComplianceStatus === "yes"
                        ? "border-success bg-success/15 text-success ring-2 ring-success/40"
                        : "border-border bg-background text-muted-foreground hover:border-success/50 hover:text-success"
                    )}
                  >
                    כן
                  </button>
                  <button
                    onClick={() => update({ accessibilityComplianceStatus: report.accessibilityComplianceStatus === "no" ? undefined : "no" })}
                    className={cn(
                      "flex-1 rounded-xl border-2 py-3 text-sm font-bold transition-colors",
                      report.accessibilityComplianceStatus === "no"
                        ? "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30"
                        : "border-border bg-background text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                    )}
                  >
                    לא
                  </button>
                </div>
              </>
            )}
          </div>
          {/* Disclaimer clauses — general_safety only */}
          {report.surveyType === "general_safety" && (
            <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-2">
              <h3 className="font-bold text-sm text-primary">הערות וסייגים לדוח</h3>
              {[
                "המקום נבדק באזורים המיועדים להימצאות קהל בלבד.",
                "מובהר בזאת כי האישור שנמסר הינו עבור השירות שהתקבל ונכון לרגע הבדיקה בלבד.",
                "במידה ובוצע כל שינוי במקום לאחר הבדיקה, יש לעצור את הפעילות ולזמן בדיקה מחודשת.",
                "במידה וקיימות מערכות חשמל ו/או גז, מחובת המזמין לזמן בדיקה.",
                "אין לעשות כל שינוי במבנים אלא בידיעת הבודק ובאישורו. כל שינוי/שימוש שיעשה ללא אישור יהיה באחריות המזמין בלבד ותוקף האישור יבוטל.",
              ].map((clause, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="shrink-0 font-semibold">{idx + 1}.</span>
                  <span className="leading-relaxed">{clause}</span>
                </div>
              ))}
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1 border-t border-border mt-1">
                <input
                  type="checkbox"
                  checked={report.selectedClauses === undefined || report.selectedClauses.includes(5)}
                  onChange={(e) => {
                    update({ selectedClauses: e.target.checked ? [5] : [] });
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-sm leading-relaxed">אין האישור מתייחס לבטיחות המשתמשים אלא לבטיחות הסביבה.</span>
              </label>
            </div>
          )}

          {/* Education safety — notes + approval summary (appears above the inspection table in PDF) */}
          {report.surveyType === "education_safety" && (
            <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-4">
              <p className="text-xs text-muted-foreground">* דוח זה מתייחס לליקויים שהתגלו ביום הבדיקה בלבד.</p>
              <div>
                <Label className="text-sm font-bold text-primary">הערות:</Label>
                <Textarea
                  value={report.eduNotes || ""}
                  onChange={(e) => update({ eduNotes: e.target.value })}
                  rows={4}
                  placeholder="הזן הערות שיופיעו בדוח..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-bold text-primary">סיכום:</Label>
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => update({ eduApprovalStatus: report.eduApprovalStatus === "approve" ? undefined : "approve" })}
                    className={cn(
                      "rounded-lg border-2 py-2.5 px-3 text-xs font-semibold text-right leading-relaxed transition-colors whitespace-pre-line",
                      report.eduApprovalStatus === "approve"
                        ? "border-success bg-success/15 text-success ring-2 ring-success/40"
                        : "border-border bg-background text-muted-foreground hover:border-success/50"
                    )}
                  >
                    {"ע״פ המבדק והערכת הסיכונים אין במוסד מפגעים בקדימות 0 ו-1 המהווים סכנה ברורה ומיידית לפגיעה באדם במגע מקרי או לא מכוון.\nפערים שנתגלו בקדימות 2, יוסרו באחריות הרשות/בעלות במסגרת תכנית שנתית/רב שנתית."}
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ eduApprovalStatus: report.eduApprovalStatus === "reject" ? undefined : "reject" })}
                    className={cn(
                      "rounded-lg border-2 py-2.5 px-3 text-xs font-semibold text-right leading-relaxed transition-colors whitespace-pre-line",
                      report.eduApprovalStatus === "reject"
                        ? "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30"
                        : "border-border bg-background text-muted-foreground hover:border-destructive/50"
                    )}
                  >
                    {"ע״פ המבדק והערכת הסיכונים יש במוסד מפגעים בקדימות 0 ו-1 המהווים סכנה ברורה ומיידית לפגיעה באדם במגע מקרי או לא מכוון.\nפערים שנתגלו בקדימות 2, יוסרו באחריות הרשות/בעלות במסגרת תכנית שנתית/רב שנתית."}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Education safety inspection table — only rows the user checks appear in PDF */}
          {report.surveyType === "education_safety" && (() => {
            const selected = report.eduInspectionRows ?? [];
            const toggle = (n: number) => {
              const next = selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n];
              update({ eduInspectionRows: next });
            };
            return (
              <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-2">
                <h3 className="font-bold text-sm text-primary">טבלת בדיקות נוספות — מוסדות חינוך</h3>
                <p className="text-xs text-muted-foreground mb-2">סמן וי בשורות שיופיעו בדוח המודפס.</p>
                <div className="space-y-1.5">
                  {EDU_INSPECTION_TABLE.map((row) => {
                    const isChecked = selected.includes(row.num);
                    return (
                      <label key={row.num} className="flex items-start gap-2.5 cursor-pointer select-none p-2 rounded-lg hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(row.num)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-bold text-primary shrink-0">{row.num}.</span>
                            <span className="text-sm font-semibold leading-snug">{row.area}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{row.frequency}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{row.authority}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Welfare inspection — approvals table, defects status, summary, inspector details */}
          {report.surveyType === "welfare_inspection" && (() => {
            const approvals = report.welfareApprovals ?? [];
            const getA = (i: number) => approvals[i] ?? {};
            const setA = (i: number, patch: { presented?: "yes" | "no" | "na"; dateGiven?: string; validUntil?: string }) => {
              const next = [...approvals];
              while (next.length <= i) next.push({});
              next[i] = { ...next[i], ...patch };
              update({ welfareApprovals: next });
            };
            const APPROVAL_ROWS = [
              { title: "מוכנות אמצעי כיבוי למניעת דליקות, ואמצעי מילוט", authority: "הרשות לכיבוי אש", refresh: 'ע"פ דרישת רשות כבאות והצלה' },
              { title: "תעודת גמר (טופס 4) של כל המבנים באתר או אישור של הרשות המקומית, בשטחה ממוקמת המסגרת, בדבר התאמת המבנה לייעודה של המסגרת המופעלת בו.", authority: "רשות מקומית", refresh: "חד פעמי" },
              { title: "מתקני משחקים, ספורט וכו' (במידה וקיימים)", authority: "מעבדה מוסמכת להתקנה ותחזוקת המתקנים או בודק שנתי למתקני משחקים בעל רישיון בהתאם לתקן הישראלי 1498", refresh: "12 חודשים" },
              { title: "בדיקת יציבות מבנים", authority: "מהנדס מבנים (קונסטרוקטור) עם רישיון בתוקף", refresh: "60 חודשים" },
            ];
            return (
              <>
                {/* Approvals table (א. אישורים) */}
                <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-3">
                  <h3 className="font-bold text-sm text-primary">א. אישורים</h3>
                  {APPROVAL_ROWS.map((row, i) => {
                    const a = getA(i);
                    return (
                      <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                        <div className="text-sm font-semibold text-foreground">{i + 1}. {row.title}</div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">הגורם המאשר: </span>{row.authority}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">יש לחדש כל: </span>{row.refresh}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { v: "yes", label: "הוצג אישור" },
                            { v: "no", label: "לא הוצג אישור" },
                            { v: "na", label: "לא רלוונטי" },
                          ] as const).map(({ v, label }) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setA(i, { presented: a.presented === v ? undefined : v })}
                              className={cn(
                                "rounded-lg border py-1.5 px-3 text-xs font-semibold transition-colors",
                                a.presented === v
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">תאריך מתן האישור</Label>
                            <Input type="date" value={a.dateGiven || ""} onChange={(e) => setA(i, { dateGiven: e.target.value })} className="h-9" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">בתוקף עד</Label>
                            <Input type="date" value={a.validUntil || ""} onChange={(e) => setA(i, { validUntil: e.target.value })} className="h-9" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ב. פערים */}
                <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-3">
                  <h3 className="font-bold text-sm text-primary">ב. פערים</h3>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => update({ welfareDefectsStatus: report.welfareDefectsStatus === "none" ? undefined : "none" })}
                      className={cn(
                        "rounded-lg border-2 py-2 px-3 text-sm font-semibold text-right transition-colors",
                        report.welfareDefectsStatus === "none"
                          ? "border-success bg-success/15 text-success ring-2 ring-success/40"
                          : "border-border bg-background text-muted-foreground hover:border-success/50"
                      )}
                    >
                      לא התגלו פערים ביחס לדרישות הבטיחות.
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ welfareDefectsStatus: report.welfareDefectsStatus === "found" ? undefined : "found" })}
                      className={cn(
                        "rounded-lg border-2 py-2 px-3 text-sm font-semibold text-right transition-colors",
                        report.welfareDefectsStatus === "found"
                          ? "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30"
                          : "border-border bg-background text-muted-foreground hover:border-destructive/50"
                      )}
                    >
                      התגלו פערים ביחס לדרישות הבטיחות.
                    </button>
                  </div>
                </div>

                {/* Signatory (מורשה חתימה מטעם המסגרת) */}
                <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-3">
                  <h3 className="font-bold text-sm text-primary">שם מורשה החתימה מטעם המסגרת</h3>
                  <Field label='"אני..."'>
                    <Input value={report.welfareSignatoryName || ""} onChange={(e) => update({ welfareSignatoryName: e.target.value })} placeholder="שם המורשה החתום מטעם המסגרת" />
                  </Field>
                </div>

                {/* סיכום */}
                <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-3">
                  <h3 className="font-bold text-sm text-primary">סיכום</h3>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => update({ welfareSummaryStatus: report.welfareSummaryStatus === "no_impediment" ? undefined : "no_impediment" })}
                      className={cn(
                        "w-full rounded-lg border-2 py-2 px-3 text-sm font-semibold text-right transition-colors",
                        report.welfareSummaryStatus === "no_impediment"
                          ? "border-success bg-success/15 text-success ring-2 ring-success/40"
                          : "border-border bg-background text-muted-foreground hover:border-success/50"
                      )}
                    >
                      אין מניעה כי המתקן שנבדק ישמש כ...
                    </button>
                    {report.welfareSummaryStatus === "no_impediment" && (
                      <Input value={report.welfareSummaryUsage || ""} onChange={(e) => update({ welfareSummaryUsage: e.target.value })} placeholder="למה ישמש המתקן" />
                    )}
                    <button
                      type="button"
                      onClick={() => update({ welfareSummaryStatus: report.welfareSummaryStatus === "after_repair" ? undefined : "after_repair" })}
                      className={cn(
                        "w-full rounded-lg border-2 py-2 px-3 text-sm font-semibold text-right transition-colors",
                        report.welfareSummaryStatus === "after_repair"
                          ? "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30"
                          : "border-border bg-background text-muted-foreground hover:border-destructive/50"
                      )}
                    >
                      ניתן יהיה להמשיך שימוש במתקן לאחר תיקון הליקויים הבאים:
                    </button>
                    {report.welfareSummaryStatus === "after_repair" && (
                      <div className="space-y-2">
                        {(["א", "ב", "ג"] as const).map((letter, idx) => (
                          <div key={letter} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground w-4">{letter}.</span>
                            <Input
                              value={report.welfareRepairList?.[idx] || ""}
                              onChange={(e) => {
                                const cur: [string, string, string] = report.welfareRepairList
                                  ? [...report.welfareRepairList] as [string, string, string]
                                  : ["", "", ""];
                                cur[idx] = e.target.value;
                                update({ welfareRepairList: cur });
                              }}
                              className="h-9"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* פרטי עורך המבדק */}
                <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-3">
                  <h3 className="font-bold text-sm text-primary">פרטי עורך המבדק</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="שם משפחה">
                      <Input value={report.welfareInspectorLastName || ""} onChange={(e) => update({ welfareInspectorLastName: e.target.value })} />
                    </Field>
                    <Field label="שם פרטי">
                      <Input value={report.welfareInspectorFirstName || ""} onChange={(e) => update({ welfareInspectorFirstName: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="מספר תעודת זהות">
                    <Input value={report.welfareInspectorId || ""} onChange={(e) => update({ welfareInspectorId: e.target.value })} dir="ltr" />
                  </Field>
                  <Field label="הגדרת הכשירות">
                    <div className="flex flex-col gap-2">
                      {([
                        { v: "safety_engineer", label: "מהנדס בטיחות רשום" },
                        { v: "safety_officer", label: "ממונה על הבטיחות (יש לצרף אישור כשירות בתוקף)" },
                        { v: "school_safety_inspector", label: "עורך מבדקי בטיחות של מוסדות חינוך" },
                      ] as const).map(({ v, label }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => update({ welfareQualification: report.welfareQualification === v ? undefined : v })}
                          className={cn(
                            "rounded-lg border py-2 px-3 text-xs font-semibold text-right transition-colors",
                            report.welfareQualification === v
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/50"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="מספר תעודת רישום">
                    <Input value={report.welfareRegistrationNum || ""} onChange={(e) => update({ welfareRegistrationNum: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="טלפון נייד">
                      <Input value={report.welfareInspectorPhone || ""} onChange={(e) => update({ welfareInspectorPhone: e.target.value })} dir="ltr" />
                    </Field>
                    <Field label="דוא״ל">
                      <Input value={report.welfareInspectorEmail || ""} onChange={(e) => update({ welfareInspectorEmail: e.target.value })} dir="ltr" />
                    </Field>
                  </div>
                  <Field label="שנות ותק">
                    <Input value={report.welfareInspectorYearsExperience || ""} onChange={(e) => update({ welfareInspectorYearsExperience: e.target.value })} placeholder='למשל: 6' />
                  </Field>
                </div>
              </>
            );
          })()}

          <Button
            variant="outline"
            onClick={handleDownloadPhotos}
            disabled={zipping}
            className="w-full gap-2 rounded-2xl text-xs text-muted-foreground"
          >
            {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
            {zipping ? "יוצר קובץ..." : "שמור את כל התמונות למכשיר"}
          </Button>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 z-30 mx-auto max-w-lg px-4" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-card/95 p-2 shadow-pop backdrop-blur-md border border-border">
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-1.5 rounded-xl text-xs">
            <Eye className="h-4 w-4" /> תצוגה
          </Button>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5 rounded-xl text-xs">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            הפק PDF
          </Button>
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-[95vw] overflow-auto p-2 sm:max-w-2xl" dir="rtl">
          <DialogHeader className="px-2">
            <DialogTitle>תצוגה מקדימה</DialogTitle>
          </DialogHeader>
          <div data-pdf-content="" className="overflow-auto rounded-lg bg-muted p-2">
            <div className="pdf-scale-wrapper origin-top-right scale-[0.42] sm:scale-[0.6]" style={{ transformOrigin: "top right" }}>
              <PrintableReport report={report} settings={settings} />
            </div>
          </div>
          <DialogFooter className="px-2">
            <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              הורד PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature dialog */}
      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>חתימה דיגיטלית</DialogTitle>
          </DialogHeader>
          {report.signatureDataUrl ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-white p-3 text-center">
                <img src={report.signatureDataUrl} alt="חתימה" className="mx-auto max-h-24 object-contain" />
                <p className="mt-1 text-xs text-muted-foreground">{report.signatureConsultantName} • {report.signatureDate}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 text-destructive hover:bg-destructive/10" onClick={() => update({ signatureDataUrl: undefined, signatureDate: undefined, signatureConsultantName: undefined })}>
                  <X className="h-4 w-4" /> מחק חתימה
                </Button>
                <Button className="flex-1" onClick={() => setSignatureOpen(false)}>סגור</Button>
              </div>
            </div>
          ) : (
            <SignaturePad
              consultantName={settings.consultantName}
              onSave={(dataUrl) => {
                update({
                  signatureDataUrl: dataUrl,
                  signatureDate: new Date().toLocaleDateString("he-IL"),
                  signatureConsultantName: settings.consultantName || "",
                });
                setSignatureOpen(false);
                toast.success("החתימה נשמרה");
              }}
              onCancel={() => setSignatureOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reference photo picker */}
      <ReferencePhotoPicker
        open={refPickerItemId !== null}
        onClose={() => setRefPickerItemId(null)}
        onSelect={(photo, label) => {
          if (!refPickerItemId) return;
          const current = report?.items.find((it) => it.id === refPickerItemId);
          const existing = current?.referencePhotos && current.referencePhotos.length > 0
            ? current.referencePhotos
            : (current?.referencePhoto ? [current.referencePhoto] : []);
          const next = [...existing, photo];
          updateItem(refPickerItemId, {
            referencePhotos: next,
            referencePhoto: next[0],
            referenceLabel: label,
          });
        }}
        personalPhotos={settings.referencePhotos ?? []}
        onAddPersonal={async (entry) => {
          const newSettings = { ...settings, referencePhotos: [...(settings.referencePhotos ?? []), entry] };
          setSettings(newSettings);
          if (user) await saveUserSettings(user.id, newSettings);
        }}
        onDeletePersonal={async (id) => {
          const newSettings = { ...settings, referencePhotos: (settings.referencePhotos ?? []).filter((p) => p.id !== id) };
          setSettings(newSettings);
          if (user) await saveUserSettings(user.id, newSettings);
        }}
      />

    </AppShell>

    {/* Dedicated print mount — id="pdf-print-mount" is the ONLY selector used
        by @media print, so there is no dependency on Radix or any other
        third-party portal attribute. Always rendered, always up-to-date. */}
    {createPortal(
      <div
        id="pdf-print-mount"
        aria-hidden="true"
        style={{ position: "fixed", top: "100vh", left: 0, pointerEvents: "none" }}
      >
        <PrintableReport
          ref={printRef}
          report={croppedCoverPhoto ? { ...report, coverPhoto: croppedCoverPhoto } : report}
          settings={settings}
        />
      </div>,
      document.body
    )}
    </>
  );
}

