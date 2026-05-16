import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, Trash2, Calendar, MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { deleteReport, listReports, newReport, saveReport } from "@/lib/storage";
import { SurveyReport } from "@/lib/types";
import { formatHebrewDate } from "@/lib/image";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<SurveyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listReports()
      .then(setReports)
      .catch(() => toast.error("שגיאה בטעינת הדוחות"))
      .finally(() => setLoading(false));
  }, []);

  async function createNew() {
    try {
      const r = await saveReport(newReport());
      navigate(`/report/${r.id}`);
    } catch {
      toast.error("שגיאה ביצירת דוח חדש");
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
        <div className="text-xs tracking-[0.3em] opacity-80">ANS · ACCESSIBILITY</div>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">סקר נגישות מתו״ס</h1>
        <p className="mt-1 text-sm opacity-90">צור, נהל והפק דוחות נגישות מקצועיים ישירות מהטלפון</p>

        <Button
          onClick={createNew}
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
            <p className="text-sm text-muted-foreground">אין דוחות שמורים. התחל סקר חדש כדי להתחיל.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="animate-fade-in">
                <Link
                  to={`/report/${r.id}`}
                  className="block rounded-2xl border border-border bg-card shadow-soft transition-all duration-200 hover:shadow-elev hover:-translate-y-0.5 active:scale-[0.99] active:shadow-soft overflow-hidden"
                >
                  <div className="flex items-start gap-3 p-4">
                    {r.coverPhoto ? (
                      <img src={r.coverPhoto} alt="" className="h-16 w-16 flex-shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-xl brand-gradient text-primary-foreground">
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
                      <div className="mt-2 flex items-center gap-2">
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
                  {/* Thin status bar at bottom */}
                  {r.items.length > 0 && (() => {
                    const total = r.items.length;
                    const ok = r.items.filter(i => i.status === "compliant").length;
                    const bad = r.items.filter(i => i.status === "non_compliant").length;
                    return (
                      <div className="flex h-1 w-full overflow-hidden">
                        <div className="bg-success/60 transition-all" style={{ width: `${(ok/total)*100}%` }} />
                        <div className="bg-destructive/50 transition-all" style={{ width: `${(bad/total)*100}%` }} />
                        <div className="flex-1 bg-border/40" />
                      </div>
                    );
                  })()}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
};

export default Index;
