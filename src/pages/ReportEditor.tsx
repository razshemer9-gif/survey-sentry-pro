import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, ArrowRight, Download, Eye, FileDown, Loader2, PenLine, Plus, Save, Trash2, Wand2, X } from "lucide-react";
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

import { ChecklistItem, ComplianceStatus, ConsultantSettings, DEFAULT_SETTINGS, ReferencePhotoEntry, SurveyReport } from "@/lib/types";
import { getReport, listTemplates, loadUserSettings, saveReport, saveUserSettings } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";
import { buildPdfFileName, generateReportPdf, statusLabel } from "@/lib/pdf";
import { formatCurrency } from "@/lib/image";
import { cn } from "@/lib/utils";
import { findMatchingRequirement } from "@/lib/matching";
import { SignaturePad } from "@/components/SignaturePad";
import { listRequirements } from "@/lib/standards-storage";
import { AccessibilityRequirement } from "@/lib/standards-types";

const STATUS_COLOR: Record<ComplianceStatus, string> = {
  compliant: "bg-success/15 text-success border-success/30",
  non_compliant: "bg-destructive/10 text-destructive border-destructive/30",
  not_applicable: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning/15 text-warning border-warning/30",
};

const ITEM_BORDER: Record<ComplianceStatus, string> = {
  compliant: "border-r-success",
  non_compliant: "border-r-destructive",
  not_applicable: "border-r-border",
  pending: "border-r-warning",
};

export default function ReportEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState<SurveyReport | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [settings, setSettings] = useState<ConsultantSettings>({ ...DEFAULT_SETTINGS });
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<AccessibilityRequirement[]>([]);
  const libraryItemsRef = useRef<AccessibilityRequirement[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [refPickerItemId, setRefPickerItemId] = useState<string | null>(null);

  const openRefPicker = async (itemId: string) => {
    if (libraryItemsRef.current.length === 0) {
      const items = await listRequirements();
      setLibraryItems(items);
      libraryItemsRef.current = items;
    }
    setRefPickerItemId(itemId);
  };

  const findMatch = (title: string) =>
    findMatchingRequirement(title, libraryItemsRef.current.length > 0 ? libraryItemsRef.current : undefined);
  const printRef = useRef<HTMLDivElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user) return;
    loadUserSettings(user.id).then(setSettings);
  }, [user]);

  useEffect(() => {
    if (!id) return;
    getReport(id).then((r) => {
      if (!r) {
        toast.error("דוח לא נמצא");
        navigate("/");
        return;
      }
      // Auto-suggest for existing non_compliant items that don't have a suggestion yet
      const items = r.items.map((it) => {
        if (it.status === "non_compliant" && !it.suggestedCorrection && !it.correctionApplied) {
          const found = findMatch(it.title);
          if (found) return { ...it, suggestedCorrection: found.correctionText, matchedRequirementId: found.id };
        }
        return it;
      });
      setReport({ ...r, items });
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
        // Auto-suggest correction when status changes to non_compliant
        if (patch.status === "non_compliant" && !it.suggestedCorrection) {
          const found = findMatch(updated.title);
          if (found) {
            updated.suggestedCorrection = found.correctionText;
            updated.matchedRequirementId = found.id;
          }
        }
        // Clear suggestion when status changes away from non_compliant
        if (patch.status && patch.status !== "non_compliant") {
          updated.suggestedCorrection = undefined;
          updated.matchedRequirementId = undefined;
          updated.correctionApplied = undefined;
        }
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
              { id: uuid(), title: "ממצא חדש", status: "pending", notes: "", estimatedCost: 0 },
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
    if (!printRef.current || !report) return;
    setGenerating(true);
    try {
      await saveReport(report);
      await generateReportPdf(printRef.current, buildPdfFileName(report));
      toast.success("ה-PDF הופק והורד");
    } catch (e) {
      console.error(e);
      toast.error("שגיאה ביצירת ה-PDF");
    } finally {
      setGenerating(false);
    }
  };

  const totalCost = report.items
    .filter((i) => i.includeInCost)
    .reduce((s, i) => s + (Number(i.estimatedCost) || 0), 0);

  return (
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
          <Field label="שם המקום / העסק">
            <Input value={report.placeName} onChange={(e) => update({ placeName: e.target.value })} placeholder="לדוגמה: בית קפה הגליל" />
          </Field>
          <Field label="שם הלקוח">
            <Input value={report.clientName} onChange={(e) => update({ clientName: e.target.value })} />
          </Field>
          <Field label="כתובת">
            <Input value={report.address} onChange={(e) => update({ address: e.target.value })} />
          </Field>
          <Field label="תאריך הסקר">
            <Input type="date" value={report.surveyDate} onChange={(e) => update({ surveyDate: e.target.value })} />
          </Field>
          <Field label="סוג הבניין">
            <Select
              value={report.buildingType || ""}
              onValueChange={(v) => update({ buildingType: v as "existing_public" | "new_public" | "other" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר סוג בניין" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing_public">בניין ציבורי קיים</SelectItem>
                <SelectItem value="new_public">בניין ציבורי חדש</SelectItem>
                <SelectItem value="other">אחר</SelectItem>
              </SelectContent>
            </Select>
            {report.buildingType === "other" && (
              <Input
                className="mt-2"
                value={report.buildingTypeOther || ""}
                onChange={(e) => update({ buildingTypeOther: e.target.value })}
                placeholder="פרט סוג בניין..."
              />
            )}
          </Field>
          <Field label="תמונת שער">
            <PhotoPicker value={report.coverPhoto} onChange={(u) => update({ coverPhoto: u })} label="צרף תמונת חזית" />
          </Field>
          <Field label="הערות כלליות (אופציונלי)">
            <Textarea
              value={report.generalNotes || ""}
              onChange={(e) => update({ generalNotes: e.target.value })}
              rows={4}
              placeholder="הערות שיופיעו בעמוד התקציר"
            />
          </Field>
        </TabsContent>

        {/* CHECKLIST TAB */}
        <TabsContent value="checklist" className="mt-4 space-y-3 pb-20">
          <TemplateSwap onLoad={(items) => setReport((r) => (r ? { ...r, items } : r))} />

          {report.items.map((item, idx) => (
            <div key={item.id} className={cn("rounded-2xl border border-border bg-card p-4 shadow-soft animate-fade-in transition-colors border-r-4", ITEM_BORDER[item.status])}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">ממצא {idx + 1}</span>
                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive" aria-label="מחק">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <Input
                value={item.title}
                onChange={(e) => updateItem(item.id, { title: e.target.value })}
                className="mb-3 font-bold"
              />

              <div className="mb-3 grid grid-cols-2 gap-2">
                {(["compliant", "non_compliant", "not_applicable", "pending"] as ComplianceStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateItem(item.id, { status: s })}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                      item.status === s ? STATUS_COLOR[s] + " ring-2 ring-offset-1 ring-current" : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>

              <Textarea
                value={item.notes}
                onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                placeholder="ממצאים והערות"
                rows={2}
                className="mb-2"
              />

              {/* Recommendation box — shown when non_compliant and not yet applied */}
              {item.status === "non_compliant" && !item.correctionApplied && (
                <div className="mb-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wand2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <p className="text-xs font-semibold text-blue-700">הצעת תיקון</p>
                    {!item.suggestedCorrection && (
                      <button
                        className="mr-auto text-[10px] text-blue-500 underline underline-offset-2"
                        onClick={() => {
                          const found = findMatch(item.title);
                          if (found) updateItem(item.id, { suggestedCorrection: found.correctionText, matchedRequirementId: found.id });
                        }}
                      >
                        חפש מת"י 1918
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={item.suggestedCorrection || ""}
                    onChange={(e) => updateItem(item.id, { suggestedCorrection: e.target.value })}
                    placeholder="הקלד הצעת תיקון ידנית, או לחץ 'חפש מת&quot;י 1918' למעלה..."
                    rows={3}
                    className="text-xs bg-white border-blue-200 text-blue-900 placeholder:text-blue-300 resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!item.suggestedCorrection}
                      className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                      onClick={() => {
                        updateItem(item.id, {
                          notes: item.notes ? `${item.notes}\n${item.suggestedCorrection}` : item.suggestedCorrection,
                          correctionApplied: true,
                        });
                        toast.success("הצעת התיקון הועתקה לממצאים");
                      }}
                    >
                      העבר לממצאים
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={() => updateItem(item.id, { suggestedCorrection: undefined, matchedRequirementId: undefined })}
                    >
                      <X className="h-3 w-3" /> נקה
                    </Button>
                  </div>
                </div>
              )}

              <div className="mb-2">
                <Label className="mb-1 block text-xs text-muted-foreground">תמונה (מצב קיים)</Label>
                <PhotoPicker
                  value={item.photo}
                  onChange={(u) => updateItem(item.id, { photo: u })}
                  label="צרף תמונה לממצא"
                />
              </div>

              <div className="mb-2 rounded-xl border border-dashed border-primary/40 bg-primary-soft/30 p-3">
                <Label className="mb-1 block text-xs font-semibold text-primary">פרט / דוגמה (אופציונלי)</Label>
                <Input
                  value={item.referenceLabel || ""}
                  onChange={(e) => updateItem(item.id, { referenceLabel: e.target.value })}
                  placeholder="פרט:"
                  className="mb-2 bg-card"
                />
                {item.referencePhoto ? (
                  <div className="relative">
                    <img src={item.referencePhoto} alt={item.referenceLabel || "פרט"} className="w-full max-h-28 object-contain rounded-lg border border-border bg-white" />
                    <button
                      onClick={() => updateItem(item.id, { referencePhoto: undefined })}
                      className="absolute top-1 left-1 h-5 w-5 rounded-full bg-destructive/90 text-white flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => openRefPicker(item.id)}
                      className="mt-1 w-full text-xs text-primary underline underline-offset-2"
                    >
                      החלף תמונה
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openRefPicker(item.id)}
                    className="w-full rounded-xl border-2 border-dashed border-primary/40 py-3 flex flex-col items-center gap-1 text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-xs">בחר תמונת פרט מהמאגר</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                  <Label className="shrink-0 text-xs text-muted-foreground">אומדן עלות (₪)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={item.estimatedCost || ""}
                    onChange={(e) => updateItem(item.id, { estimatedCost: Number(e.target.value) || 0 })}
                    className="h-9 w-28 min-w-0"
                    placeholder="0"
                  />
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
          ))}

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={addItem} variant="outline" className="gap-2 rounded-2xl border-dashed">
              <Plus className="h-4 w-4" /> ממצא חדש
            </Button>
            <Button
              variant="outline"
              className="gap-2 rounded-2xl border-dashed"
              onClick={async () => {
                if (libraryItemsRef.current.length === 0) {
                  const items = await listRequirements();
                  setLibraryItems(items);
                  libraryItemsRef.current = items;
                }
                setLibrarySearch("");
                setLibraryOpen(true);
              }}
            >
              <BookOpen className="h-4 w-4" /> מהמאגר
            </Button>
          </div>

          <div className="rounded-2xl bg-primary text-primary-foreground p-4 shadow-glow">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-90">אומדן תיקונים כולל</span>
              <strong className="text-xl">{formatCurrency(totalCost)}</strong>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bottom action bar — sits above BottomNav, accounts for safe-area */}
      <div className="fixed inset-x-0 z-30 mx-auto max-w-lg px-4" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-card/95 p-2 shadow-pop backdrop-blur-md border border-border">
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-1.5 rounded-xl text-xs">
            <Eye className="h-4 w-4" /> תצוגה
          </Button>
          <Button variant="outline" onClick={() => setSignatureOpen(true)} className="gap-1.5 rounded-xl text-xs relative">
            <PenLine className="h-4 w-4" /> חתימה
            {report.signatureDataUrl && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-success" />}
          </Button>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5 rounded-xl text-xs">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            הפק PDF
          </Button>
        </div>
      </div>

      {/* Preview dialog (uses a non-ref scaled clone) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-[95vw] overflow-auto p-2 sm:max-w-2xl" dir="rtl">
          <DialogHeader className="px-2">
            <DialogTitle>תצוגה מקדימה</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto rounded-lg bg-muted p-2">
            <div className="origin-top-right scale-[0.42] sm:scale-[0.6]" style={{ transformOrigin: "top right" }}>
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

      {/* Library picker dialog */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg flex flex-col gap-0 p-0" dir="rtl">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>הוסף ממצא מהמאגר</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2">
            <Input
              placeholder="חיפוש..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
            {libraryItems
              .filter((r) =>
                !librarySearch ||
                r.requirementTitle.includes(librarySearch) ||
                r.subCategory.includes(librarySearch) ||
                r.tags.some((t) => t.includes(librarySearch))
              )
              .map((req) => (
                <button
                  key={req.id}
                  className="w-full text-right rounded-xl border border-border bg-card p-3 hover:bg-muted transition-colors"
                  onClick={() => {
                    const found = findMatch(req.requirementTitle);
                    const newItem = {
                      id: uuid(),
                      title: req.requirementTitle,
                      status: "pending" as const,
                      notes: req.defectText,
                      estimatedCost: 0,
                      referencePhoto: req.referencePhoto,
                      suggestedCorrection: req.correctionText,
                      matchedRequirementId: req.id,
                    };
                    setReport((r) => r ? { ...r, items: [...r.items, newItem] } : r);
                    setLibraryOpen(false);
                    toast.success(`נוסף: ${req.requirementTitle}`);
                  }}
                >
                  <p className="text-sm font-semibold">{req.requirementTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{req.subCategory} · {req.standardPart}</p>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reference photo library picker */}
      <ReferencePhotoPicker
        open={refPickerItemId !== null}
        onClose={() => setRefPickerItemId(null)}
        onSelect={(photo, label) => {
          if (!refPickerItemId) return;
          updateItem(refPickerItemId, { referencePhoto: photo, referenceLabel: label });
        }}
        globalPhotos={libraryItems
          .filter((r) => r.referencePhoto)
          .map((r) => ({ label: r.requirementTitle, photo: r.referencePhoto! }))}
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

      {/* Hidden printable mount used for PDF rasterization */}
      <div className="pointer-events-none fixed -left-[10000px] top-0 opacity-0">
        <PrintableReport ref={printRef} report={report} settings={settings} />
      </div>
    </AppShell>
  );
}

function TemplateSwap({ onLoad }: { onLoad: (items: ChecklistItem[]) => void }) {
  const templates = listTemplates();
  return (
    <div className="rounded-2xl border border-border bg-primary-soft/40 p-3">
      <Label className="mb-2 block text-xs font-semibold text-primary">טען רשימת ממצאים מתבנית</Label>
      <Select
        onValueChange={(val) => {
          const t = templates.find((x) => x.id === val);
          if (!t) return;
          if (!confirm("לטעון את הממצאים מהתבנית? ממצאים קיימים יוחלפו.")) return;
          onLoad(
            t.items.map((i) => ({
              id: uuid(),
              title: i.title,
              status: "pending",
              notes: "",
              estimatedCost: 0,
            })),
          );
          toast.success(`נטענה תבנית: ${t.name}`);
        }}
      >
        <SelectTrigger className="rounded-xl bg-card">
          <SelectValue placeholder="בחר תבנית..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
