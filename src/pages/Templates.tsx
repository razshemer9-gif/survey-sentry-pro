import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { ArrowRight, BookOpen, Check, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChecklistTemplate } from "@/lib/types";
import { deleteTemplate, listTemplates, saveTemplate } from "@/lib/storage";
import { STANDARDS_DATA } from "@/lib/standards-data";
import { listRequirements } from "@/lib/standards-storage";
import { AccessibilityRequirement } from "@/lib/standards-types";
import { cn } from "@/lib/utils";

interface AccessibilityTemplate {
  id: string;
  name: string;
  description: string;
  requirementIds: string[];
}

const ACCESSIBILITY_TEMPLATES: AccessibilityTemplate[] = [
  {
    id: "acc-tpl-01",
    name: "בניין משרדים – כניסה וקומות",
    description: "דרישות נגישות לכניסה, מעברים, מדרגות ומעלית בבניין משרדים.",
    requirementIds: ["req-a-001", "req-a-002", "req-a-005", "req-c-001", "req-d-001", "req-d-003", "req-e-001", "req-e-003", "req-f-001", "req-g-001", "req-g-002"],
  },
  {
    id: "acc-tpl-02",
    name: "חנות ומסחר קמעונאי",
    description: "דרישות נגישות לחנויות: גישה, מעברים, דלפק שירות ושילוט.",
    requirementIds: ["req-a-001", "req-a-002", "req-b-001", "req-e-001", "req-e-004", "req-f-001", "req-f-002", "req-l-001", "req-l-003", "req-n-001", "req-n-004"],
  },
  {
    id: "acc-tpl-03",
    name: "בית ספר ומוסד חינוך",
    description: "דרישות נגישות לבתי ספר: גישה, כיתות, שירותים ושילוט.",
    requirementIds: ["req-a-001", "req-a-002", "req-c-001", "req-c-003", "req-d-001", "req-e-001", "req-f-001", "req-g-001", "req-h-001", "req-h-002", "req-h-004", "req-l-001", "req-m-001"],
  },
  {
    id: "acc-tpl-04",
    name: "מסעדה ובית קפה",
    description: "דרישות נגישות למסעדות: גישה, ישיבה, שירותים ודלפק.",
    requirementIds: ["req-a-001", "req-b-001", "req-e-001", "req-f-001", "req-f-002", "req-h-001", "req-h-002", "req-h-003", "req-n-001", "req-o-001", "req-o-002", "req-l-001"],
  },
  {
    id: "acc-tpl-05",
    name: "בית מלון",
    description: "דרישות נגישות למלונות: לובי, חדרים, שירותים ומקלחות נגישות.",
    requirementIds: ["req-a-001", "req-a-002", "req-b-001", "req-e-001", "req-g-001", "req-g-003", "req-h-001", "req-h-002", "req-h-004", "req-i-001", "req-i-002", "req-i-003", "req-j-001", "req-k-001", "req-l-001"],
  },
  {
    id: "acc-tpl-06",
    name: "חניון ציבורי",
    description: "דרישות נגישות לחניונים: מקומות נגישים, שילוט וגישה לבניין.",
    requirementIds: ["req-b-001", "req-b-002", "req-b-003", "req-b-004", "req-a-001", "req-l-001", "req-m-001", "req-m-002"],
  },
  {
    id: "acc-tpl-07",
    name: "מרפאה ובית חולים",
    description: "דרישות נגישות למוסדות רפואיים: גישה, מעליות, שירותים ותקשורת.",
    requirementIds: ["req-a-001", "req-a-002", "req-b-001", "req-e-001", "req-f-001", "req-g-001", "req-g-002", "req-g-003", "req-h-001", "req-h-002", "req-h-004", "req-l-001", "req-l-004", "req-m-001", "req-n-001", "req-n-003"],
  },
  {
    id: "acc-tpl-08",
    name: "דיור מוגן ודירת נגישות",
    description: "דרישות נגישות ליחידות דיור נגישות: כניסה, מטבח, חדר רחצה.",
    requirementIds: ["req-j-001", "req-j-002", "req-j-003", "req-j-004", "req-i-001", "req-i-002", "req-i-003", "req-i-004", "req-h-001", "req-h-002", "req-k-001", "req-k-003", "req-k-004"],
  },
  {
    id: "acc-tpl-09",
    name: "אולם התרבות / אירועים",
    description: "דרישות נגישות לאולמות: מקומות ישיבה, גישה לבמה, שילוט ושמיעה.",
    requirementIds: ["req-o-001", "req-o-002", "req-o-003", "req-o-004", "req-a-001", "req-b-001", "req-g-001", "req-h-001", "req-l-001", "req-l-003", "req-m-001", "req-n-003"],
  },
  {
    id: "acc-tpl-10",
    name: "רחוב ושטח ציבורי פתוח",
    description: "דרישות נגישות לשטחים ציבוריים פתוחים: מדרכות, צלבי כבישה, פסי הכוונה.",
    requirementIds: ["req-a-001", "req-a-002", "req-a-003", "req-a-004", "req-a-005", "req-b-001", "req-b-003", "req-c-001", "req-c-002", "req-d-003", "req-m-001", "req-m-002", "req-m-003", "req-m-004"],
  },
];

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);

  // Library picker state
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<AccessibilityRequirement[]>([]);
  const libraryItemsRef = useRef<AccessibilityRequirement[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState<string>("all");
  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());

  useEffect(() => refresh(), []);
  const refresh = () => setTemplates(listTemplates());

  const openLibrary = async () => {
    if (libraryItemsRef.current.length === 0) {
      const items = await listRequirements();
      setLibraryItems(items);
      libraryItemsRef.current = items;
    }
    setSelectedReqIds(new Set());
    setLibrarySearch("");
    setLibraryCategory("all");
    setLibraryOpen(true);
  };

  const toggleSelect = (id: string) =>
    setSelectedReqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const addSelectedToTemplate = () => {
    if (!editing) return;
    const existingIds = new Set(
      editing.items.map((i) => i.matchedRequirementId).filter(Boolean) as string[],
    );
    const toAdd = libraryItems.filter(
      (r) => selectedReqIds.has(r.id) && !existingIds.has(r.id),
    );
    if (toAdd.length === 0) {
      toast.info("הממצאים שנבחרו כבר קיימים בתבנית");
      setLibraryOpen(false);
      return;
    }
    const newItems = toAdd.map((r) => {
      const photos = r.referencePhotos && r.referencePhotos.length > 0
        ? r.referencePhotos
        : r.referencePhoto ? [r.referencePhoto] : undefined;
      return {
        title: r.requirementTitle,
        notes: r.defectText || undefined,
        suggestedCorrection: r.correctionText || undefined,
        matchedRequirementId: r.id,
        standardPart: r.standardPart,
        clause: r.clause,
        referencePhoto: photos?.[0],
        referencePhotos: photos,
      };
    });
    setEditing({ ...editing, items: [...editing.items, ...newItems] });
    setLibraryOpen(false);
    toast.success(`נוספו ${newItems.length} ממצאים לתבנית`);
  };

  const categories = Array.from(
    new Set(libraryItems.map((r) => r.category).filter(Boolean)),
  ).sort();

  const filteredLibrary = libraryItems.filter((r) => {
    if (libraryCategory !== "all" && r.category !== libraryCategory) return false;
    if (!librarySearch) return true;
    const q = librarySearch.trim();
    return (
      r.requirementTitle.includes(q) ||
      (r.subCategory || "").includes(q) ||
      (r.standardPart || "").includes(q) ||
      (r.tags || []).some((t) => t.includes(q))
    );
  });

  const startNew = () =>
    setEditing({
      id: uuid(),
      name: "תבנית חדשה",
      description: "",
      items: [{ title: "ממצא ראשון" }],
    });

  const remove = (id: string) => {
    if (!confirm("למחוק את התבנית?")) return;
    deleteTemplate(id);
    refresh();
    toast.success("נמחק");
  };

  const handleSave = () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("חסר שם");
    saveTemplate(editing);
    setEditing(null);
    refresh();
    toast.success("נשמר");
  };

  return (
    <AppShell>
      <header className="brand-gradient text-primary-foreground px-5 pb-6 pt-4 safe-top rounded-b-3xl shadow-elev">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold opacity-90">תבניות צ׳קליסט</div>
          <div className="w-10" />
        </div>
        <h1 className="mt-3 text-2xl font-extrabold">ניהול תבניות</h1>
        <p className="mt-1 text-sm opacity-90">צור רשימות ממצאים מותאמות לסוג מבנה או עסק</p>
      </header>

      <div className="px-5 pt-4">
        <Button onClick={startNew} className="w-full gap-2 rounded-2xl">
          <Plus className="h-5 w-5" /> תבנית חדשה
        </Button>
      </div>

      <ul className="space-y-3 px-5 pt-4">
        {templates.map((t) => (
          <li
            key={t.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-bold">{t.name}</h3>
                  {t.builtIn && (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                      ברירת מחדל
                    </span>
                  )}
                </div>
                {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{t.items.length} ממצאים</p>
              </div>
              <div className="flex flex-col gap-1">
                {!t.builtIn && (
                  <>
                    <button
                      onClick={() => setEditing({ ...t, items: t.items.map((i) => ({ ...i })) })}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="mx-auto h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {t.builtIn && (
                  <button
                    onClick={() =>
                      setEditing({
                        id: uuid(),
                        name: `${t.name} (עותק)`,
                        description: t.description,
                        items: t.items.map((i) => ({ ...i })),
                      })
                    }
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"
                  >
                    שכפל
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Accessibility templates */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">תבניות נגישות ת&quot;י 1918</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          בחר תבנית מוכנה לפי סוג המבנה. כל תבנית תיטען כרשימת ממצאים מותאמת.
        </p>
        <ul className="space-y-2">
          {ACCESSIBILITY_TEMPLATES.map((tpl) => {
            const items = tpl.requirementIds
              .map((id) => STANDARDS_DATA.find((r) => r.id === id))
              .filter(Boolean);
            return (
              <li
                key={tpl.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold">{tpl.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{items.length} דרישות</p>
                  </div>
                  <button
                    onClick={() => {
                      const newTpl: ChecklistTemplate = {
                        id: uuid(),
                        name: tpl.name,
                        description: tpl.description,
                        items: items
                          .filter((r): r is NonNullable<typeof r> => r !== undefined)
                          .map((r) => ({ title: r.requirementTitle })),
                      };
                      setEditing(newTpl);
                    }}
                    className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    טען
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing?.builtIn ? "צפייה" : "עריכת תבנית"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">שם התבנית</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">תיאור</Label>
                <Input
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">ממצאים</Label>
                <div className="mt-2 space-y-2">
                  {editing.items.map((it, i) => (
                    <div key={i} className="min-w-0 rounded-xl border border-border bg-background p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Input
                          className="min-w-0 flex-1"
                          value={it.title}
                          onChange={(e) => {
                            const next = [...editing.items];
                            next[i] = { ...next[i], title: e.target.value };
                            setEditing({ ...editing, items: next });
                          }}
                        />
                        <button
                          onClick={() =>
                            setEditing({ ...editing, items: editing.items.filter((_, idx) => idx !== i) })
                          }
                          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="הסר"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {(it.matchedRequirementId || it.standardPart || it.clause) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1 px-1 text-[10px]">
                          {it.matchedRequirementId && (
                            <span className="rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary">
                              מהמאגר
                            </span>
                          )}
                          {it.standardPart && (
                            <span className="text-muted-foreground">
                              {it.standardPart}{it.clause ? ` · סעיף ${it.clause}` : ""}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() =>
                      setEditing({ ...editing, items: [...editing.items, { title: "ממצא חדש" }] })
                    }
                  >
                    <Plus className="h-4 w-4" /> הוסף ממצא
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-dashed border-primary/40 text-primary hover:bg-primary-soft"
                    onClick={openLibrary}
                  >
                    <BookOpen className="h-4 w-4" /> הוסף ממצא מהמאגר
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleSave} className="w-full gap-2">
              <Save className="h-4 w-4" /> שמור תבנית
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Library picker — multi-select requirements from standards DB */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-lg flex-col gap-0 p-0" dir="rtl">
          <DialogHeader className="px-4 pb-2 pt-4">
            <DialogTitle>הוסף ממצאים מהמאגר</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 px-4 pb-2">
            <Input
              placeholder="חיפוש לפי כותרת, תת-קטגוריה או תגית..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              autoFocus
            />
            <Select value={libraryCategory} onValueChange={setLibraryCategory}>
              <SelectTrigger>
                <SelectValue placeholder="כל הקטגוריות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{filteredLibrary.length} ממצאים</span>
              <span>{selectedReqIds.size} נבחרו</span>
            </div>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-3">
            {filteredLibrary.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">לא נמצאו ממצאים</p>
            )}
            {filteredLibrary.map((req) => {
              const selected = selectedReqIds.has(req.id);
              const alreadyInTemplate = editing?.items.some(
                (i) => i.matchedRequirementId === req.id,
              );
              return (
                <button
                  key={req.id}
                  onClick={() => !alreadyInTemplate && toggleSelect(req.id)}
                  disabled={alreadyInTemplate}
                  className={cn(
                    "w-full rounded-xl border p-3 text-right transition-colors",
                    alreadyInTemplate
                      ? "cursor-not-allowed border-border bg-muted/50 opacity-60"
                      : selected
                        ? "border-primary bg-primary-soft ring-2 ring-primary/30"
                        : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background",
                      )}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{req.requirementTitle}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {req.subCategory}{req.standardPart ? ` · ${req.standardPart}` : ""}
                        {req.clause ? ` · סעיף ${req.clause}` : ""}
                      </p>
                      {alreadyInTemplate && (
                        <p className="mt-1 text-[10px] font-semibold text-warning">
                          כבר קיים בתבנית
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <DialogFooter className="border-t border-border px-4 py-3">
            <Button
              onClick={addSelectedToTemplate}
              disabled={selectedReqIds.size === 0}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              הוסף לתבנית ({selectedReqIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
