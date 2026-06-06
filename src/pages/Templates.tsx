import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { ArrowRight, ChevronDown, ChevronUp, PenLine, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoPicker } from "@/components/PhotoPicker";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChecklistTemplate, SURVEY_TYPES, SurveyType } from "@/lib/types";
import { deleteTemplate, listTemplates, migrateLocalTemplates, saveTemplate } from "@/lib/storage";

type TemplateItem = ChecklistTemplate["items"][number];

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [editingItem, setEditingItem] = useState<{ item: TemplateItem; index: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const migrated = await migrateLocalTemplates();
        if (migrated > 0) toast.success(`הועברו ${migrated} תבניות לחשבון`);
        await refresh();
      } catch (err) {
        toast.error(`שגיאה בטעינת תבניות: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => setTemplates(await listTemplates());

  const startNew = () =>
    setEditing({ id: uuid(), name: "תבנית חדשה", description: "", items: [] });

  const remove = async (id: string) => {
    if (!confirm("למחוק את התבנית?")) return;
    try {
      await deleteTemplate(id);
      await refresh();
      toast.success("נמחק");
    } catch (err) {
      toast.error(`שגיאה במחיקה: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("חסר שם");
    try {
      await saveTemplate(editing);
      setEditing(null);
      await refresh();
      toast.success("נשמר");
    } catch (err) {
      toast.error(`שגיאה בשמירה: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const updateItemInEditing = (index: number, patch: Partial<TemplateItem>) => {
    if (!editing) return;
    const next = [...editing.items];
    next[index] = { ...next[index], ...patch };
    setEditing({ ...editing, items: next });
  };

  const removeItemFromEditing = (index: number) => {
    if (!editing) return;
    setEditing({ ...editing, items: editing.items.filter((_, i) => i !== index) });
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    if (!editing) return;
    const next = [...editing.items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEditing({ ...editing, items: next });
  };

  const addNewItem = () => {
    if (!editing) return;
    const newItem: TemplateItem = { title: "ממצא חדש" };
    const newIndex = editing.items.length;
    setEditing({ ...editing, items: [...editing.items, newItem] });
    setEditingItem({ item: { ...newItem }, index: newIndex });
  };

  const openEditItem = (item: TemplateItem, index: number) => {
    setEditingItem({ item: { ...item }, index });
  };

  const saveEditingItem = async () => {
    if (!editingItem || !editing) return;

    // Compute updated template immediately (can't rely on async state update)
    const nextItems = [...editing.items];
    nextItems[editingItem.index] = { ...nextItems[editingItem.index], ...editingItem.item };
    const updatedEditing = { ...editing, items: nextItems };

    setEditing(updatedEditing);
    setEditingItem(null);

    // Persist to Supabase immediately — no need to click "שמור תבנית" separately
    try {
      await saveTemplate(updatedEditing);
    } catch (err) {
      toast.error(`שגיאה בשמירת הממצא: ${err instanceof Error ? err.message : String(err)}`);
    }
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

      <ul className="space-y-3 px-5 pt-4 pb-8">
        {templates.map((t) => (
          <li key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
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

      {/* Template edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing?.builtIn ? "צפייה בתבנית" : "עריכת תבנית"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">סוג סקר</Label>
                <Select
                  value={editing.surveyType ?? "accessibility"}
                  onValueChange={(v) => setEditing({ ...editing, surveyType: v as SurveyType })}
                >
                  <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {SURVEY_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                <Label className="text-xs">ממצאים ({editing.items.length})</Label>
                <div className="mt-2 space-y-1.5">
                  {editing.items.map((it, i) => (
                    <div key={i} className="rounded-xl border border-border bg-background p-2">
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveItem(i, -1)}
                            disabled={i === 0}
                            className="h-5 w-6 rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                            aria-label="העלה"
                          >
                            <ChevronUp className="h-3.5 w-3.5 mx-auto" />
                          </button>
                          <button
                            onClick={() => moveItem(i, 1)}
                            disabled={i === editing.items.length - 1}
                            className="h-5 w-6 rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                            aria-label="הוריד"
                          >
                            <ChevronDown className="h-3.5 w-3.5 mx-auto" />
                          </button>
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium pr-1">{it.title}</span>
                        <button
                          onClick={() => openEditItem(it, i)}
                          className="shrink-0 rounded-lg p-1.5 text-primary hover:bg-primary-soft"
                          aria-label="ערוך ממצא"
                        >
                          <PenLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeItemFromEditing(i)}
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="הסר ממצא"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {(it.standardPart || it.clause) && (
                        <p className="mt-0.5 pr-14 text-[10px] text-muted-foreground">
                          {it.standardPart}{it.clause ? ` · סעיף ${it.clause}` : ""}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="mt-2 w-full gap-2 border-dashed" onClick={addNewItem}>
                  <Plus className="h-4 w-4" /> הוסף ממצא
                </Button>
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

      {/* Item detail editor dialog */}
      <Dialog open={!!editingItem} onOpenChange={(o) => !o && setEditingItem(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת ממצא</DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">כותרת הממצא</Label>
                <Input
                  value={editingItem.item.title}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, item: { ...editingItem.item, title: e.target.value } })
                  }
                  placeholder="כותרת הממצא..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">חלק תקן</Label>
                  <Input
                    value={editingItem.item.standardPart || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, item: { ...editingItem.item, standardPart: e.target.value || undefined } })
                    }
                    placeholder='ת"י 1918 חלק 4'
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">סעיף</Label>
                  <Input
                    value={editingItem.item.clause || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, item: { ...editingItem.item, clause: e.target.value || undefined } })
                    }
                    placeholder="16.1"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">בעיה / ממצא</Label>
                <Textarea
                  value={editingItem.item.notes || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, item: { ...editingItem.item, notes: e.target.value || undefined } })
                  }
                  placeholder="תיאור הליקוי..."
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">פתרון / תיקון</Label>
                <Textarea
                  value={editingItem.item.suggestedCorrection || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, item: { ...editingItem.item, suggestedCorrection: e.target.value || undefined } })
                  }
                  placeholder="הצעה לתיקון..."
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">תמונת פרט</Label>
                <PhotoPicker
                  value={editingItem.item.referencePhoto}
                  onChange={(u) =>
                    setEditingItem({ ...editingItem, item: { ...editingItem.item, referencePhoto: u || undefined } })
                  }
                  label="צרף תמונת פרט"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={saveEditingItem} className="w-full gap-2">
              <Save className="h-4 w-4" /> אישור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
