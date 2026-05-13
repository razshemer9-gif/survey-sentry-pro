import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Download, Eye, FileDown, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PhotoPicker } from "@/components/PhotoPicker";
import { PrintableReport } from "@/components/PrintableReport";
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

import { ChecklistItem, ComplianceStatus, SurveyReport } from "@/lib/types";
import { getReport, getSettings, listTemplates, saveReport } from "@/lib/storage";
import { buildPdfFileName, generateReportPdf, statusLabel } from "@/lib/pdf";
import { formatCurrency } from "@/lib/image";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<ComplianceStatus, string> = {
  compliant: "bg-success/15 text-success border-success/30",
  non_compliant: "bg-destructive/10 text-destructive border-destructive/30",
  not_applicable: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning/15 text-warning border-warning/30",
};

export default function ReportEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<SurveyReport | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const settings = useMemo(() => getSettings(), []);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getReport(id).then((r) => {
      if (!r) {
        toast.error("דוח לא נמצא");
        navigate("/");
        return;
      }
      setReport(r);
    });
  }, [id, navigate]);

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
    setReport((r) =>
      r ? { ...r, items: r.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : r,
    );
  };

  const addItem = () =>
    setReport((r) =>
      r
        ? {
            ...r,
            items: [
              ...r.items,
              { id: uuid(), title: "פרמטר חדש", status: "pending", notes: "", estimatedCost: 0 },
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
    .filter((i) => i.status === "non_compliant")
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
        <TabsContent value="checklist" className="mt-4 space-y-3">
          <TemplateSwap onLoad={(items) => setReport((r) => (r ? { ...r, items } : r))} />

          {report.items.map((item, idx) => (
            <div key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft animate-fade-in">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">פרמטר {idx + 1}</span>
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

              <div className="mb-2">
                <Label className="mb-1 block text-xs text-muted-foreground">תמונה (מצב קיים)</Label>
                <PhotoPicker
                  value={item.photo}
                  onChange={(u) => updateItem(item.id, { photo: u })}
                  label="צרף תמונה לפרמטר"
                />
              </div>

              <div className="mb-2 rounded-xl border border-dashed border-primary/40 bg-primary-soft/30 p-3">
                <Label className="mb-1 block text-xs font-semibold text-primary">פרט / דוגמה (אופציונלי)</Label>
                <Input
                  value={item.referenceLabel || ""}
                  onChange={(e) => updateItem(item.id, { referenceLabel: e.target.value })}
                  placeholder="לדוגמה: שלט שירותים נגישים"
                  className="mb-2 bg-card"
                />
                <PhotoPicker
                  value={item.referencePhoto}
                  onChange={(u) => updateItem(item.id, { referencePhoto: u })}
                  label="צרף תמונת פרט מהגלריה"
                />
              </div>

              {item.status === "non_compliant" && (
                <div className="flex items-center gap-2">
                  <Label className="shrink-0 text-xs text-muted-foreground">אומדן עלות (₪)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={item.estimatedCost || ""}
                    onChange={(e) => updateItem(item.id, { estimatedCost: Number(e.target.value) || 0 })}
                    className="h-9 min-w-0 flex-1"
                    placeholder="0"
                  />
                </div>
              )}
            </div>
          ))}

          <Button onClick={addItem} variant="outline" className="w-full gap-2 rounded-2xl border-dashed">
            <Plus className="h-4 w-4" /> הוסף פרמטר
          </Button>

          <div className="rounded-2xl bg-primary text-primary-foreground p-4 shadow-glow">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-90">אומדן תיקונים כולל</span>
              <strong className="text-xl">{formatCurrency(totalCost)}</strong>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-lg px-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-card/95 p-2 shadow-pop backdrop-blur-md border border-border">
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-2 rounded-xl">
            <Eye className="h-4 w-4" /> תצוגה מקדימה
          </Button>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2 rounded-xl">
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

      {/* Hidden printable mount used for PDF rasterization */}
      <div className="pointer-events-none fixed -left-[10000px] top-0 opacity-0">
        <PrintableReport ref={printRef} report={report} settings={settings} />
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

function TemplateSwap({ onLoad }: { onLoad: (items: ChecklistItem[]) => void }) {
  const templates = listTemplates();
  return (
    <div className="rounded-2xl border border-border bg-primary-soft/40 p-3">
      <Label className="mb-2 block text-xs font-semibold text-primary">טען רשימת פרמטרים מתבנית</Label>
      <Select
        onValueChange={(val) => {
          const t = templates.find((x) => x.id === val);
          if (!t) return;
          if (!confirm("לטעון את הפרמטרים מהתבנית? פרמטרים קיימים יוחלפו.")) return;
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
