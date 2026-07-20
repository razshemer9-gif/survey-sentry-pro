import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, Trash2, Calendar, MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { deleteReport, listReports, listTemplates, newReport, saveReport } from "@/lib/storage";
import { getSurveyType, SURVEY_TYPES, SurveyReport, SurveyType } from "@/lib/types";
import { formatHebrewDate } from "@/lib/image";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const Index = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<SurveyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SurveyType | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      listReports()
        .then(setReports)
        .catch((err: unknown) => {
          const detail = err instanceof Error
            ? err.message
            : (err as { message?: string })?.message ?? JSON.stringify(err);
          console.error("listReports error:", err);
          toast.error(`שגיאה בטעינת הדוחות: ${detail}`);
        })
        .finally(() => setLoading(false));
    });
  }, [navigate]);

  function openNewDialog() {
    setSelectedType(null);
    setTypeDialogOpen(true);
  }

  async function createNew() {
    if (!selectedType) return;
    setCreating(true);
    try {
      // education_safety, welfare_inspection and element_stability start with a
      // single empty finding — no template needed
      if (selectedType === "education_safety" || selectedType === "welfare_inspection" || selectedType === "element_stability") {
        const r = await saveReport(newReport(selectedType));
        setTypeDialogOpen(false);
        navigate(`/report/${r.id}`);
        return;
      }

      const templates = await listTemplates();
      const surveyLabel = SURVEY_TYPES.find((t) => t.id === selectedType)?.label ?? "";
      const normalize = (s: string) =>
        s.trim().replace(/[״"]/g, '"').replace(/[׳']/g, "'");

      const matched =
        templates.find((t) => !t.builtIn && t.surveyType === selectedType) ??
        templates.find((t) => !t.builtIn && normalize(t.name) === normalize(surveyLabel));

      if (!matched) {
        toast.error("לא הוגדרה תבנית עבור סוג סקר זה. יש ליצור תבנית מתאימה בדף התבניות.");
        return;
      }
      const r = await saveReport(newReport(selectedType, matched.items));
      setTypeDialogOpen(false);
      navigate(`/report/${r.id}`);
    } catch {
      toast.error("שגיאה ביצירת דוח חדש");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק את הדוח?")) return;
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("הדוח נמחק");
    } catch {
      toast.error("שגיאה במחיקת הדוח");
    }
  }

  return (
    <AppShell>
      <header className="hero-gradient text-primary-foreground rounded-b-[2rem] px-5 pb-8 pt-10 safe-top shadow-pop">
        <div className="text-xs tracking-[0.3em] opacity-80">ANS · SURVEYS</div>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">מערכת ניהול סקרים מקצועית</h1>
        <p className="mt-1 text-sm opacity-90">צור, נהל והפק דוחות מקצועיים ישירות מהטלפון</p>

        <Button
          onClick={openNewDialog}
          size="lg"
          variant="secondary"
          className="mt-6 w-full gap-2 rounded-2xl bg-card text-foreground shadow-elev hover:bg-card/90"
        >
          <Plus className="h-5 w-5" />
          סקר חדש
        </Button>
      </header>

      <section className="px-5 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">דוחות אחרונים</h2>
          <span className="text-xs text-muted-foreground">{reports.length} סה״כ</span>
        </div>

        {loading ? (
          <div className="grid place-items-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : reports.length === 0 ? (
          <div className="grid place-items-center rounded-3xl border-2 border-dashed border-border bg-card/60 px-6 py-14 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/70" />
            <p className="text-sm text-muted-foreground">אין דוחות שמורים. לחץ על "סקר חדש" כדי להתחיל.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => {
              const cfg = getSurveyType(r.surveyType);
              return (
                <li key={r.id} className="animate-fade-in">
                  <Link
                    to={`/report/${r.id}`}
                    className="block rounded-2xl border border-border bg-card shadow-soft transition-all duration-200 hover:shadow-elev hover:-translate-y-0.5 active:scale-[0.99] active:shadow-soft overflow-hidden"
                  >
                    <div className="flex items-start gap-3 p-4">
                      {r.coverPhoto ? (
                        <img src={r.coverPhoto} alt="" className="h-16 w-16 flex-shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div
                          className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-xl text-white"
                          style={{ background: cfg.color }}
                        >
                          <FileText className="h-7 w-7" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-bold">{r.placeName || "ללא שם"}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {r.address && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {r.address}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatHebrewDate(r.surveyDate)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ background: cfg.color }}
                          >
                            {cfg.shortLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                            ✓ {r.items.filter((i) => i.status === "compliant").length} תקין
                          </span>
                          {r.items.filter((i) => i.status === "non_compliant").length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                              ✕ {r.items.filter((i) => i.status === "non_compliant").length} לא תקין
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); remove(r.id); }}
                        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="מחק"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {r.items.length > 0 && (() => {
                      const total = r.items.length;
                      const ok = r.items.filter(i => i.status === "compliant").length;
                      const bad = r.items.filter(i => i.status === "non_compliant").length;
                      return (
                        <div className="flex h-1 w-full overflow-hidden">
                          <div className="bg-success/60 transition-all" style={{ width: `${(ok / total) * 100}%` }} />
                          <div className="bg-destructive/50 transition-all" style={{ width: `${(bad / total) * 100}%` }} />
                          <div className="flex-1 bg-border/40" />
                        </div>
                      );
                    })()}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Survey type selection dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={(o) => { if (!creating) setTypeDialogOpen(o); }}>
        <DialogContent className="w-[92vw] max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>בחר סוג סקר</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {SURVEY_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={cn(
                  "w-full rounded-2xl border-2 px-4 py-4 text-right transition-all",
                  selectedType === t.id
                    ? "ring-2 ring-offset-1"
                    : "border-border bg-background hover:bg-muted",
                )}
                style={
                  selectedType === t.id
                    ? { borderColor: t.color, background: t.color + "12", ringColor: t.color }
                    : {}
                }
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-4 w-4 rounded-full border-2 flex-shrink-0 transition-colors"
                    style={{
                      borderColor: t.color,
                      background: selectedType === t.id ? t.color : "transparent",
                    }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: selectedType === t.id ? t.color : undefined }}
                  >
                    {t.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <Button
            onClick={createNew}
            disabled={!selectedType || creating}
            className="mt-1 w-full gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            צור דוח
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Index;
