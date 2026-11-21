import { useCallback, useEffect, useMemo, useState } from "react";
import { v4 as uuid } from "uuid";
import { Clock, Mail, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/Field";
import { useAuth } from "@/contexts/AuthContext";
import { listReportAuthors, loadUserSettings } from "@/lib/storage";
import {
  remoteDeleteWorkHours, remoteListWorkHours, remoteSaveWorkHours, workHoursTableReady,
} from "@/lib/work-hours-remote";
import {
  canSend, emailBody, emailSubject, entryMinutes, formatDate, formatMinutes,
  mailtoUrl, minutesInMonth, newEntry, newVisit, openMail, problemsWith, sortEntries,
  todayISO, visitMinutes, type WorkHoursEntry,
} from "@/lib/work-hours";
import { cn } from "@/lib/utils";

/** Where the report is sent, remembered on the device after the first time. */
const RECIPIENT_KEY = "shemer.hours.recipient";
/** What is being typed right now, so a closed app loses nothing. */
const DRAFT_KEY = "shemer.hours.draft";

function keptDraft(): WorkHoursEntry | null {
  try {
    const kept = localStorage.getItem(DRAFT_KEY);
    return kept ? (JSON.parse(kept) as WorkHoursEntry) : null;
  } catch {
    return null;
  }
}

export default function WorkHours() {
  const { user, isAdmin } = useAuth();
  const [entries, setEntries] = useState<WorkHoursEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);
  // Read on the very first render, not in an effect: an effect would run
  // after the one below, which would already have cleared the key.
  const [draft, setDraft] = useState<WorkHoursEntry | null>(keptDraft);
  const [saving, setSaving] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [consultantName, setConsultantName] = useState("");
  const [authors, setAuthors] = useState<Record<string, string>>({});

  useEffect(() => {
    workHoursTableReady().then((ok) => {
      setReady(ok);
      if (!ok) { setLoading(false); return; }
      remoteListWorkHours()
        .then((rows) => setEntries(sortEntries(rows)))
        .catch((err) => {
          console.error("[hours] could not be read", err);
          toast.error("שגיאה בטעינת השעות");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadUserSettings(user.id)
      .then((s) => {
        setConsultantName(s.consultantName ?? "");
        try {
          const kept = localStorage.getItem(RECIPIENT_KEY);
          setRecipient(kept || s.email || "");
        } catch { setRecipient(s.email || ""); }
      })
      .catch(() => { /* the name and the address can be typed by hand */ });
    if (isAdmin) listReportAuthors().then(setAuthors).catch(() => setAuthors({}));
  }, [user?.id, isAdmin]);

  // What is half-typed survives a closed app, a dropped connection and a
  // failed save. Hours are logged at the end of a long day; losing them to
  // a lock screen would be the end of anyone using this.
  useEffect(() => {
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch { /* private window — the form still works */ }
  }, [draft]);

  const mine = useMemo(
    () => entries.filter((e) => !e.ownerId || e.ownerId === user?.id),
    [entries, user?.id],
  );
  const thisMonth = minutesInMonth(mine, todayISO().slice(0, 7));

  const authorName = useCallback((e: WorkHoursEntry) => {
    if (!e.ownerId || e.ownerId === user?.id) return "אני";
    return authors[e.ownerId] || "עובד אחר";
  }, [authors, user?.id]);

  function startNew() {
    setDraft(newEntry(uuid()));
  }

  function patchDraft(patch: Partial<WorkHoursEntry>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function patchVisit(id: string, patch: Partial<WorkHoursEntry["visits"][number]>) {
    setDraft((prev) => prev
      ? { ...prev, visits: prev.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)) }
      : prev);
  }

  async function save(entry: WorkHoursEntry): Promise<WorkHoursEntry | null> {
    setSaving(true);
    try {
      const saved = await remoteSaveWorkHours(entry);
      setEntries((prev) => sortEntries([saved, ...prev.filter((e) => e.id !== saved.id)]));
      return saved;
    } catch (err) {
      console.error("[hours] save failed", err);
      toast.error("לא הצלחתי לשמור", {
        description: "מה שמילאת נשמר במכשיר — אפשר לנסות שוב כשיש קליטה.",
      });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndClose() {
    if (!draft) return;
    if (await save(draft)) {
      setDraft(null);
      toast.success("הדיווח נשמר");
    }
  }

  async function sendByMail() {
    if (!draft) return;
    if (!recipient.trim()) {
      toast.error("צריך כתובת מייל לשליחה");
      return;
    }
    const saved = await save({ ...draft, sentAt: Date.now() });
    if (!saved) return;
    try { localStorage.setItem(RECIPIENT_KEY, recipient.trim()); } catch { /* ignore */ }
    setDraft(null);
    // The phone's own mail app opens with the message ready; the consultant
    // sees exactly what leaves in their name and presses send.
    openMail(mailtoUrl(
      recipient,
      emailSubject(saved, consultantName),
      emailBody(saved, consultantName),
    ));
  }

  async function remove(id: string) {
    if (!confirm("למחוק את הדיווח?")) return;
    try {
      await remoteDeleteWorkHours(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("הדיווח נמחק");
    } catch (err) {
      console.error("[hours] delete failed", err);
      toast.error("שגיאה במחיקת הדיווח");
    }
  }

  const problems = draft ? problemsWith(draft) : [];

  return (
    <AppShell>
      <div className="home-surface px-4 pb-4 safe-top">
        <header className="flex items-baseline justify-between gap-3 pt-5">
          <h1 className="text-[22px] font-extrabold tracking-[-0.01em]">שעות נוספות</h1>
          <span className="text-[13px] tabular-nums text-[var(--home-muted)]">
            החודש: {formatMinutes(thisMonth)}
          </span>
        </header>

        {!ready && (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--home-surface-border)] px-5 py-8 text-center text-sm text-[var(--home-muted)]">
            הטבלה עדיין לא נוצרה במסד הנתונים, ולכן אי אפשר לשמור דיווחים.
          </p>
        )}

        {ready && !draft && (
          <button
            type="button"
            onClick={startNew}
            className="home-cta mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-[22px] text-[17px] font-extrabold text-white transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)]"
          >
            <Plus className="h-5 w-5" />
            דיווח חדש
          </button>
        )}

        {draft && (
          <section className="mt-4 space-y-4 rounded-[22px] border border-[var(--home-surface-border)] bg-[var(--home-surface)] p-4">
            <Field label="תאריך">
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => patchDraft({ date: e.target.value })}
              />
            </Field>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  איפה היית, ובאילו שעות
                </span>
                <span className="text-[13px] font-bold tabular-nums">
                  {formatMinutes(entryMinutes(draft))}
                </span>
              </div>

              <ul className="space-y-2">
                {draft.visits.map((v, i) => (
                  <li key={v.id} className="rounded-2xl border border-[var(--home-surface-border)] bg-[var(--home-field)] p-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        placeholder={`מקום ${i + 1}`}
                        value={v.place}
                        onChange={(e) => patchVisit(v.id, { place: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => patchDraft({ visits: draft.visits.filter((x) => x.id !== v.id) })}
                        aria-label={`הסרת מקום ${i + 1}`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--home-muted)] hover:bg-[var(--home-surface)] hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`שעת התחלה — מקום ${i + 1}`}
                        value={v.from}
                        onChange={(e) => patchVisit(v.id, { from: e.target.value })}
                      />
                      <span aria-hidden className="text-[var(--home-muted)]">–</span>
                      <Input
                        type="time"
                        aria-label={`שעת סיום — מקום ${i + 1}`}
                        value={v.to}
                        onChange={(e) => patchVisit(v.id, { to: e.target.value })}
                      />
                      <span className="ms-auto shrink-0 text-[13px] tabular-nums text-[var(--home-muted)]">
                        {formatMinutes(visitMinutes(v))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full gap-2 rounded-2xl"
                onClick={() => patchDraft({ visits: [...draft.visits, newVisit(uuid())] })}
              >
                <Plus className="h-4 w-4" />
                הוספת מקום
              </Button>
            </div>

            <Field label="הערה (לא חובה)">
              <Textarea
                rows={2}
                placeholder="למשל: נסיעה נוספת, ציוד שהושאר באתר"
                value={draft.note ?? ""}
                onChange={(e) => patchDraft({ note: e.target.value })}
              />
            </Field>

            <Field label="נשלח אל">
              <Input
                type="email"
                inputMode="email"
                placeholder="כתובת המייל של המשרד"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </Field>

            {problems.length > 0 && (
              <ul className="space-y-1 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-600 dark:text-amber-400">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2 rounded-2xl"
                disabled={!canSend(draft) || saving}
                onClick={sendByMail}
              >
                <Mail className="h-4 w-4" />
                שליחה במייל
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-2xl"
                disabled={saving}
                onClick={saveAndClose}
              >
                <Save className="h-4 w-4" />
                שמירה
              </Button>
              <Button
                variant="ghost"
                className="rounded-2xl"
                disabled={saving}
                onClick={() => setDraft(null)}
              >
                ביטול
              </Button>
            </div>
          </section>
        )}

        <div className="mt-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-[var(--home-muted)]">טוען…</p>
          ) : entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--home-surface-border)] px-5 py-8 text-center text-sm text-[var(--home-muted)]">
              עוד לא דיווחת שעות נוספות.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {entries.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  author={isAdmin ? authorName(e) : undefined}
                  mine={!e.ownerId || e.ownerId === user?.id}
                  onEdit={() => setDraft(e)}
                  onDelete={() => remove(e.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/** One day's claim, as it reads in the list. */
function EntryRow({
  entry, author, mine, onEdit, onDelete,
}: {
  entry: WorkHoursEntry;
  author?: string;
  /** Someone else's hours can be read, never edited — see work-hours-remote. */
  mine: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-2xl border border-[var(--home-surface-border)] bg-[var(--home-surface)] p-3">
      <div className="flex items-baseline gap-2">
        <Clock aria-hidden className="h-4 w-4 shrink-0 translate-y-0.5 text-[var(--home-muted)]" />
        <span className="text-[15px] font-bold tabular-nums">{formatDate(entry.date)}</span>
        <span className="text-[15px] font-bold tabular-nums text-[var(--home-cta-top)]">
          {formatMinutes(entryMinutes(entry))}
        </span>
        <span className={cn("ms-auto text-[12px]", entry.sentAt ? "text-[var(--home-muted)]" : "text-amber-500")}>
          {entry.sentAt ? "נשלח" : "לא נשלח"}
        </span>
      </div>

      <ul className="mt-1.5 space-y-0.5 ps-6">
        {entry.visits.map((v) => (
          <li key={v.id} className="truncate text-[13px] text-[var(--home-muted)]">
            {v.place} · <span className="tabular-nums">{v.from}–{v.to}</span>
          </li>
        ))}
      </ul>

      {entry.note?.trim() && (
        <p className="mt-1.5 ps-6 text-[12px] text-[var(--home-muted)]">{entry.note}</p>
      )}

      <div className="mt-2 flex items-center gap-2 ps-6">
        {author && <span className="text-[12px] text-[var(--home-muted)]">{author}</span>}
        {mine && (
          <div className="ms-auto flex gap-1">
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[13px]" onClick={onEdit}>
              עריכה
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 rounded-xl text-[13px] text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחיקה
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
