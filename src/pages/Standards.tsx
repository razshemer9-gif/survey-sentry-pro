import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

import { CATEGORIES, PLACE_TYPE_LABELS } from "@/lib/standards-data";
import { AccessibilityRequirement, PlaceType } from "@/lib/standards-types";
import { SurveyReport } from "@/lib/types";
import { listReports, addRequirementToReport } from "@/lib/storage";
import {
  listRequirements,
  saveRequirement,
  deleteRequirement,
  isAdmin,
} from "@/lib/standards-storage";


function emptyReq(): AccessibilityRequirement {
  return {
    id: `req-custom-${Date.now()}`,
    standardPart: 'ת"י 1918',
    clause: "",
    category: CATEGORIES[0].label,
    categoryCode: CATEGORIES[0].code,
    subCategory: "",
    requirementTitle: "",
    practicalRequirement: "",
    defectText: "",
    correctionText: "",
    measurementFields: [],
    inspectionMethod: "",
    appliesTo: [],
    tags: [],
    internalCitation: "",
  };
}

export default function Standards() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [placeFilter, setPlaceFilter] = useState("all");

  const [items, setItems] = useState<AccessibilityRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const admin = isAdmin();

  // Add-to-report dialog state
  const [selectedReq, setSelectedReq] = useState<AccessibilityRequirement | null>(null);
  const [reports, setReports] = useState<SurveyReport[]>([]);
  const [chosenReportId, setChosenReportId] = useState<string>("");
  const [adding, setAdding] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editIsNew, setEditIsNew] = useState(false);
  const [draft, setDraft] = useState<AccessibilityRequirement>(emptyReq());
  const [savingDraft, setSavingDraft] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listRequirements();
      setItems(list);
    } catch {
      toast.error("שגיאה בטעינת מאגר הדרישות");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

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

  const openNew = () => {
    setDraft(emptyReq());
    setEditIsNew(true);
    setEditOpen(true);
  };

  const openEdit = (req: AccessibilityRequirement) => {
    setDraft({
      ...req,
      clause: req.clause ?? "",
      measurementFields: req.measurementFields ?? [],
      internalCitation: req.internalCitation ?? "",
    });
    setEditIsNew(false);
    setEditOpen(true);
  };

  const handleDelete = async (req: AccessibilityRequirement) => {
    if (!confirm(`למחוק את הדרישה "${req.requirementTitle}"?`)) return;
    try {
      await deleteRequirement(req.id);
      toast.success("הדרישה נמחקה");
      await refresh();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const updateDraft = (patch: Partial<AccessibilityRequirement>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const handleSaveDraft = async () => {
    if (!draft.requirementTitle.trim()) {
      toast.error("יש להזין כותרת דרישה");
      return;
    }
    setSavingDraft(true);
    try {
      const cat = CATEGORIES.find((c) => c.label === draft.category) ?? CATEGORIES[0];
      const toSave: AccessibilityRequirement = {
        ...draft,
        category: cat.label,
        categoryCode: cat.code,
        clause: draft.clause?.trim() ? draft.clause.trim() : undefined,
        measurementFields:
          draft.measurementFields && draft.measurementFields.length > 0
            ? draft.measurementFields
            : undefined,
        internalCitation: draft.internalCitation?.trim()
          ? draft.internalCitation.trim()
          : undefined,
      };
      await saveRequirement(toSave);
      toast.success(editIsNew ? "הדרישה נוספה" : "הדרישה עודכנה");
      setEditOpen(false);
      await refresh();
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setSavingDraft(false);
    }
  };

  const filtered = items.filter((req) => {
    const matchSearch =
      !search ||
      req.requirementTitle.includes(search) ||
      req.subCategory.includes(search) ||
      req.defectText.includes(search) ||
      req.standardPart.includes(search) ||
      (req.clause?.includes(search) ?? false) ||
      req.tags.some((t) => t.includes(search));
    const matchCategory = categoryFilter === "all" || req.categoryCode === categoryFilter;
    const matchPlace =
      placeFilter === "all" || req.appliesTo.includes(placeFilter as PlaceType);
    return matchSearch && matchCategory && matchPlace;
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
        <p className="mt-0.5 text-xs opacity-75">
          {items.length} דרישות · {filtered.length} מוצגות
        </p>
      </header>

      {/* Filters */}
      <div className="px-4 pt-4 space-y-3">
        {admin && (
          <Button onClick={openNew} className="w-full gap-2 rounded-xl">
            <Plus className="h-4 w-4" /> הוסף ליקוי חדש
          </Button>
        )}

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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full text-xs sm:flex-1" dir="rtl">
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
            <SelectTrigger className="w-full text-xs sm:flex-1" dir="rtl">
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

      </div>

      {/* Cards */}
      <div className="px-4 pt-4 pb-8 space-y-3">
        {loading && (
          <p className="text-center text-sm text-muted-foreground py-8">טוען מאגר...</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            לא נמצאו דרישות התואמות את הסינון
          </p>
        )}
        {!loading &&
          filtered.map((req) => (
            <Card key={req.id} className="rounded-2xl shadow-soft border-border" dir="rtl">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-bold leading-snug flex-1">
                    {req.requirementTitle}
                  </CardTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    {admin && (
                      <>
                        <button
                          onClick={() => openEdit(req)}
                          className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted text-muted-foreground"
                          aria-label="ערוך"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(req)}
                          className="grid h-7 w-7 place-items-center rounded-full hover:bg-red-50 text-red-600"
                          aria-label="מחק"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
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
                {admin && req.internalCitation && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                      ציטוט/מקור פנימי
                    </p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">
                      {req.internalCitation}
                    </p>
                  </div>
                )}
                {req.referencePhoto && (
                  <div className="pt-1">
                    <p className="text-[10px] font-semibold text-primary mb-1">תמונת פרט</p>
                    <img
                      src={req.referencePhoto}
                      alt="תמונת פרט"
                      className="w-full rounded-xl object-cover border border-border max-h-48"
                    />
                  </div>
                )}
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
        <DialogContent dir="rtl" className="w-[95vw] max-w-sm">
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

      {/* Edit / Add requirement dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="w-[95vw] max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editIsNew ? "הוספת ליקוי חדש" : "עריכת ליקוי"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <DraftField label="כותרת הדרישה">
              <Input
                value={draft.requirementTitle}
                onChange={(e) => updateDraft({ requirementTitle: e.target.value })}
                placeholder="לדוגמה: רמפת גישה לכניסה"
              />
            </DraftField>
            <div className="flex gap-2">
              <DraftField label="חלק התקן" className="flex-1">
                <Input
                  value={draft.standardPart}
                  onChange={(e) => updateDraft({ standardPart: e.target.value })}
                />
              </DraftField>
              <DraftField label="סעיף" className="w-24">
                <Input
                  value={draft.clause ?? ""}
                  onChange={(e) => updateDraft({ clause: e.target.value })}
                />
              </DraftField>
            </div>
            <DraftField label="בעיה">
              <Textarea
                value={draft.defectText}
                onChange={(e) => updateDraft({ defectText: e.target.value })}
                rows={3}
                placeholder="תאר את הליקוי שנמצא..."
              />
            </DraftField>
            <DraftField label="פתרון">
              <Textarea
                value={draft.correctionText}
                onChange={(e) => updateDraft({ correctionText: e.target.value })}
                rows={3}
                placeholder="תאר את הפעולה הנדרשת לתיקון..."
              />
            </DraftField>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditOpen(false)}
            >
              ביטול
            </Button>
            <Button
              className="flex-1"
              disabled={savingDraft}
              onClick={handleSaveDraft}
            >
              {savingDraft ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function DraftField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
