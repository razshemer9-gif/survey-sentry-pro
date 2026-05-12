import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

import { STANDARDS_DATA, CATEGORIES, PLACE_TYPE_LABELS } from "@/lib/standards-data";
import { AccessibilityRequirement, Severity, PlaceType } from "@/lib/standards-types";
import { SurveyReport } from "@/lib/types";
import { listReports, addRequirementToReport } from "@/lib/storage";

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "קריטי",
  medium: "בינוני",
  low: "נמוך",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

const SEVERITY_CHIP_ACTIVE: Record<Severity, string> = {
  critical: "bg-red-600 text-white",
  medium: "bg-yellow-500 text-white",
  low: "bg-green-600 text-white",
};

export default function Standards() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState<Set<Severity>>(new Set());
  const [placeFilter, setPlaceFilter] = useState("all");

  // Dialog state
  const [selectedReq, setSelectedReq] = useState<AccessibilityRequirement | null>(null);
  const [reports, setReports] = useState<SurveyReport[]>([]);
  const [chosenReportId, setChosenReportId] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const toggleSeverity = (s: Severity) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const openDialog = async (req: AccessibilityRequirement) => {
    setSelectedReq(req);
    setChosenReportId("");
    try {
      const r = await listReports();
      setReports(r);
      if (r.length > 0) setChosenReportId(r[0].id);
    } catch {
      toast.error("שגיאה בטעינת הדוחות");
    }
  };

  const handleAddToReport = async () => {
    if (!selectedReq || !chosenReportId) return;
    setAdding(true);
    try {
      await addRequirementToReport(chosenReportId, selectedReq);
      toast.success("הדרישה נוספה לדוח בהצלחה");
      setSelectedReq(null);
    } catch {
      toast.error("שגיאה בהוספה לדוח");
    } finally {
      setAdding(false);
    }
  };

  const filtered = STANDARDS_DATA.filter((req) => {
    const matchSearch =
      !search ||
      req.requirementTitle.includes(search) ||
      req.subCategory.includes(search) ||
      req.defectText.includes(search) ||
      req.tags.some((t) => t.includes(search));
    const matchCategory = categoryFilter === "all" || req.categoryCode === categoryFilter;
    const matchSeverity = severityFilter.size === 0 || severityFilter.has(req.severity);
    const matchPlace =
      placeFilter === "all" || req.appliesTo.includes(placeFilter as PlaceType);
    return matchSearch && matchCategory && matchSeverity && matchPlace;
  });

  return (
    <AppShell>
      {/* Header */}
      <header className="brand-gradient text-primary-foreground px-5 pb-6 pt-4 safe-top rounded-b-3xl shadow-elev">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold opacity-90">
            <BookOpen className="h-4 w-4" />
            מאגר דרישות נגישות
          </div>
          <div className="w-10" />
        </div>
        <h1 className="mt-3 text-xl font-extrabold">מאגר דרישות נגישות</h1>
        <p className="mt-0.5 text-xs opacity-90">ת&quot;י 1918 – כל הקטגוריות A עד O</p>
        <p className="mt-0.5 text-xs opacity-75">{STANDARDS_DATA.length} דרישות · {filtered.length} מוצגות</p>
      </header>

      {/* Filters */}
      <div className="px-4 pt-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pr-9"
            placeholder="חיפוש לפי כותרת, תיאור, תגיות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir="rtl"
          />
        </div>

        {/* Category + Place filters */}
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="flex-1 text-xs" dir="rtl">
              <SelectValue placeholder="קטגוריה" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">כל הקטגוריות</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={placeFilter} onValueChange={setPlaceFilter}>
            <SelectTrigger className="flex-1 text-xs" dir="rtl">
              <SelectValue placeholder="סוג מקום" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">כל המקומות</SelectItem>
              {Object.entries(PLACE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Severity chips */}
        <div className="flex gap-2" dir="rtl">
          {(["critical", "medium", "low"] as Severity[]).map((s) => {
            const active = severityFilter.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleSeverity(s)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                  active
                    ? SEVERITY_CHIP_ACTIVE[s]
                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {SEVERITY_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards */}
      <div className="px-4 pt-4 pb-8 space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            לא נמצאו דרישות התואמות את הסינון
          </p>
        )}
        {filtered.map((req) => (
          <Card key={req.id} className="rounded-2xl shadow-soft border-border" dir="rtl">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-bold leading-snug flex-1">
                  {req.requirementTitle}
                </CardTitle>
                <Badge
                  className={`shrink-0 text-[10px] px-2 py-0.5 border rounded-full ${SEVERITY_COLORS[req.severity]}`}
                >
                  {SEVERITY_LABELS[req.severity]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="outline" className="text-[10px] rounded-full">
                  {req.standardPart}
                  {req.clause ? ` סעיף ${req.clause}` : ""}
                </Badge>
                <Badge variant="secondary" className="text-[10px] rounded-full">
                  {req.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">ליקוי</p>
                <p className="text-xs text-foreground">{req.defectText}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">תיקון</p>
                <p className="text-xs text-foreground">{req.correctionText}</p>
              </div>
              {req.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {req.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                className="w-full mt-2 rounded-xl text-xs"
                onClick={() => openDialog(req)}
              >
                הוסף לדוח
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add to report dialog */}
      <Dialog open={!!selectedReq} onOpenChange={(o) => !o && setSelectedReq(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">הוסף לדוח</DialogTitle>
          </DialogHeader>
          {selectedReq && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">{selectedReq.requirementTitle}</p>
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  אין דוחות קיימים. צור דוח חדש תחילה.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">בחר דוח:</p>
                  <Select value={chosenReportId} onValueChange={setChosenReportId}>
                    <SelectTrigger dir="rtl" className="text-sm">
                      <SelectValue placeholder="בחר דוח" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      {reports.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.placeName || r.address || r.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setSelectedReq(null)}
            >
              ביטול
            </Button>
            <Button
              className="flex-1"
              disabled={!chosenReportId || adding || reports.length === 0}
              onClick={handleAddToReport}
            >
              {adding ? "מוסיף..." : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
