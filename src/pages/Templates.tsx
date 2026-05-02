import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { ArrowRight, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChecklistTemplate } from "@/lib/types";
import { deleteTemplate, listTemplates, saveTemplate } from "@/lib/storage";

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);

  useEffect(() => refresh(), []);
  const refresh = () => setTemplates(listTemplates());

  const startNew = () =>
    setEditing({
      id: uuid(),
      name: "תבנית חדשה",
      description: "",
      items: [{ title: "פרמטר ראשון" }],
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
        <p className="mt-1 text-sm opacity-90">צור רשימות פרמטרים מותאמות לסוג מבנה או עסק</p>
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
                <p className="mt-2 text-xs text-muted-foreground">{t.items.length} פרמטרים</p>
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

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-auto" dir="rtl">
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
                <Label className="text-xs">פרמטרים</Label>
                <div className="mt-2 space-y-2">
                  {editing.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={it.title}
                        onChange={(e) => {
                          const next = [...editing.items];
                          next[i] = { title: e.target.value };
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
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="mt-2 w-full gap-2"
                  onClick={() =>
                    setEditing({ ...editing, items: [...editing.items, { title: "פרמטר חדש" }] })
                  }
                >
                  <Plus className="h-4 w-4" /> הוסף פרמטר
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
    </AppShell>
  );
}
