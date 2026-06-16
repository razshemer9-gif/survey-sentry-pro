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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
              { id: uuid(), title: "ממצא חדש", status: "non_compliant", notes: "", estimatedCost: 0 },
            ],
          }
        : r,
    );

  const removeItem = (itemId: string) =>
    setReport((r) => (r ? { ...r, items: r.items.filter((it) => it.id !== itemId) } : r));

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

      <Tabs defaultValue="cover" className="px-4 pt-4">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl">
          <TabsTrigger value="cover" className="rounded-xl">שער</TabsTrigger>
          <TabsTrigger value="checklist" className="rounded-xl">
            ממצאים ({report.items.length})
          </TabsTrigger>
        </TabsList>

        {/* COVER TAB */}
        <TabsContent value="cover" className="mt-4 space-y-4">
          {(() => {
            const isEdu = report.surveyType === "education_safety";
            return (
              <>
                {isEdu ? (
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
        </TabsContent>

        {/* CHECKLIST TAB */}
        <TabsContent value="checklist" className="mt-4 space-y-3 pb-20">
          {report.items.map((item, idx) => {
            const refPhotos = item.referencePhotos && item.referencePhotos.length > 0
              ? item.referencePhotos
              : (item.referencePhoto ? [item.referencePhoto] : []);
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
                          "h-8 w-10 rounded-lg text-xs font-bold border transition-colors",
                          item.priority === p
                            ? p === 0 ? "bg-red-500 text-white border-red-500"
                            : p === 1 ? "bg-orange-400 text-white border-orange-400"
                            : "bg-yellow-400 text-white border-yellow-400"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50"
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

          <Button onClick={addItem} variant="outline" className="w-full gap-2 rounded-2xl border-dashed">
            <Plus className="h-4 w-4" /> ממצא חדש
          </Button>

          <div className="rounded-2xl bg-primary text-primary-foreground p-4 shadow-glow">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-90">אומדן תיקונים כולל</span>
              <strong className="text-xl">{formatCurrency(totalCost)}</strong>
            </div>
          </div>

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
                    onClick={() => update({ accessibilityComplianceStatus: "yes" })}
                    className={cn(
                      "rounded-xl border-2 py-3 px-4 text-sm font-bold text-right transition-colors",
                      report.accessibilityComplianceStatus === "yes"
                        ? "border-success bg-success/15 text-success ring-2 ring-success/40"
                        : "border-border bg-background text-muted-foreground hover:border-success/50 hover:text-success"
                    )}
                  >
                    המקום נמצא בטיחותי
                  </button>
                  <button
                    onClick={() => update({ accessibilityComplianceStatus: "no" })}
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
                    onClick={() => update({ accessibilityComplianceStatus: "yes" })}
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
                    onClick={() => update({ accessibilityComplianceStatus: "no" })}
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
          {report.surveyType === "general_safety" && (() => {
            const CLAUSES = [
              "במקום נבדק באזורים המיועדים להימצאות קהל בלבד.",
              "מובהר בזאת כי האישור שנמסר הינו עבור השירות שהתקבל ונכון לרגע הבדיקה בלבד.",
              "במידה ונותר כל שינוי במקום לאחר הבדיקה, יש לעצור את הפעילות ולזמן בדיקה מחודשת.",
              "במידה וקיימות מערכות חשמל ו/או גז, מחובת המזמין לזמן בדיקה.",
              "אין לעשות כל שינוי במבנים אלא בידיעת הבודק ובאישורו. כל שינוי/שימוש שיעשה ללא אישור יהיה באחריות המזמין בלבד ותוקף האישור יבוטל.",
              "אין האישור מתייחס לבטיחות המשתמשים אלא לבטיחות הסביבה.",
            ];
            const selected = report.selectedClauses ?? [];
            return (
              <div dir="rtl" className="rounded-2xl border-2 border-primary/20 bg-card p-4 space-y-3">
                <h3 className="font-bold text-sm text-primary">הערות וסייגים לדוח</h3>
                {CLAUSES.map((clause, idx) => (
                  <label key={idx} className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selected.includes(idx)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selected, idx]
                          : selected.filter((i) => i !== idx);
                        update({ selectedClauses: next });
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="text-sm leading-relaxed">{clause}</span>
                  </label>
                ))}
              </div>
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
        </TabsContent>
      </Tabs>

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

