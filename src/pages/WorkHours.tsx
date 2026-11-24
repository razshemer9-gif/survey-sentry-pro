import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { CalendarClock, Clock, Mail, Plus, Save, Trash2, Upload, X } from "lucide-react";
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
import { remoteScheduleForDate } from "@/lib/schedule-remote";
import { matchJob, type ScheduleRow } from "@/lib/schedule";
import {
  canSend, emailBody, emailSubject, entryMinutes, formatDate, formatMinutes,
  jobMinutes, JOB_KIND_SHORT, mailtoUrl, minutesInMonth, newEntry, newJob,
  openMail, problemsWith, sortEntries, todayISO,
  type JobKind, type WorkHoursEntry, type WorkJob,
} from "@/lib/work-hours";
import { cn } from "@/lib/utils";

/** Where the report is sent, remembered on the device after the first time. */
const RECIPIENT_KEY = "shemer.hours.recipient";
/** What is being typed right now, so a closed app loses nothing. */
const DRAFT_KEY = "shemer.hours.draft";

/** The value the job picker uses for "not on the schedule — I'll type it". */
const TYPE_IT = "__type__";

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
  const [daySchedule, setDaySchedule] = useState<ScheduleRow[]>([]);

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

  // The day's scheduled jobs, so the employee can pick instead of typing.
  // A day with no schedule is ordinary — the file may not have arrived yet —
  // so this never raises anything; it just leaves the picker as a text box.
  const draftDate = draft?.date;
  useEffect(() => {
    if (!draftDate) { setDaySchedule([]); return; }
    let current = true;
    remoteScheduleForDate(draftDate)
      .then((rows) => { if (current) setDaySchedule(rows); })
      .catch(() => { if (current) setDaySchedule([]); });
    return () => { current = false; };
  }, [draftDate]);

  // What is half-typed survives a closed app, a dropped connection and a
  // failed save. A day is logged at the end of a long one; losing it to a
  // lock screen would be the end of anyone using this.
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
    setDraft({ ...newEntry(uuid()), jobs: [newJob(uuid())] });
  }

  function patchDraft(patch: Partial<WorkHoursEntry>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function patchJob(id: string, patch: Partial<WorkJob>) {
    setDraft((prev) => prev
      ? { ...prev, jobs: prev.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }
      : prev);
  }

  /**
   * Switching a job between fixed price and hourly.
   *
   * Going to fixed price drops the hours rather than hiding them: hours that
   * are out of sight but still in the record are hours that will eventually
   * be paid by mistake.
   */
  function setKind(job: WorkJob, kind: JobKind) {
    if (job.kind === kind) return;
    if (kind !== "hourly") {
      patchJob(job.id, { kind, from: undefined, to: undefined });
      return;
    }
    // Most people pick the job first and mark it an event second, so the
    // schedule's start time has to be offered here too, not only at the
    // moment of picking.
    const row = job.scheduleId
      ? daySchedule.find((s) => s.id === job.scheduleId)
      : undefined;
    patchJob(job.id, { kind, from: job.from || (row?.time ?? ""), to: job.to ?? "" });
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
          <h1 className="text-[22px] font-extrabold tracking-[-0.01em]">דיווח עבודה</h1>
          <span className="text-[13px] tabular-nums text-[var(--home-muted)]">
            שעות לתשלום החודש: {formatMinutes(thisMonth)}
          </span>
        </header>

        {isAdmin && (
          <div className="mt-3 flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1 gap-2 rounded-2xl">
              <Link to="/hours/summary">
                <CalendarClock className="h-4 w-4" />
                סיכום חודשי
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1 gap-2 rounded-2xl">
              <Link to="/hours/schedule">
                <Upload className="h-4 w-4" />
                העלאת לו״ז
              </Link>
            </Button>
          </div>
        )}

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
                  מה עשית היום
                </span>
                <span className="text-[13px] font-bold tabular-nums">
                  {formatMinutes(entryMinutes(draft))}
                </span>
              </div>

              <ul className="space-y-2">
                {draft.jobs.map((job, i) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    index={i}
                    date={draft.date}
                    schedule={daySchedule}
                    onPatch={(patch) => patchJob(job.id, patch)}
                    onKind={(kind) => setKind(job, kind)}
                    onRemove={() => patchDraft({ jobs: draft.jobs.filter((x) => x.id !== job.id) })}
                  />
                ))}
              </ul>

              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full gap-2 rounded-2xl"
                onClick={() => patchDraft({ jobs: [...draft.jobs, newJob(uuid())] })}
              >
                <Plus className="h-4 w-4" />
                הוספת עבודה
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
              עוד לא דיווחת עבודה.
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

/**
 * One job on the form.
 *
 * The kind comes first, because it decides whether the rest of the row even
 * exists. Where the day has a schedule the name is chosen from it rather
 * than typed, which is what makes the month's check against the schedule
 * meaningful: a name that was picked cannot have been mistyped.
 */
function JobRow({
  job, index, date, schedule, onPatch, onKind, onRemove,
}: {
  job: WorkJob;
  index: number;
  date: string;
  schedule: ScheduleRow[];
  onPatch: (patch: Partial<WorkJob>) => void;
  onKind: (kind: JobKind) => void;
  onRemove: () => void;
}) {
  const picked = schedule.find((s) => s.id === job.scheduleId);
  const [typing, setTyping] = useState(!picked && !!job.name);
  const useList = schedule.length > 0 && !typing;

  function choose(value: string) {
    if (value === TYPE_IT) {
      setTyping(true);
      onPatch({ scheduleId: undefined, name: "" });
      return;
    }
    const row = schedule.find((s) => s.id === value);
    if (!row) return;
    onPatch({
      scheduleId: row.id,
      name: row.name,
      place: row.place ?? job.place,
      // The schedule's own start time is a sensible opening guess for an
      // event, but never the end — only the person who was there knows that.
      from: job.kind === "hourly" && !job.from ? (row.time ?? "") : job.from,
    });
  }

  // Only meaningful for a typed name on a day the schedule covers.
  const match = !job.scheduleId && job.name.trim() && schedule.length > 0
    ? matchJob(job.name, date, schedule).kind
    : null;

  return (
    <li className="rounded-2xl border border-[var(--home-surface-border)] bg-[var(--home-field)] p-2.5">
      <div className="flex items-center gap-2">
        <div role="group" aria-label={`סוג עבודה ${index + 1}`} className="flex gap-1">
          {(["fixed", "hourly"] as JobKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={job.kind === kind}
              onClick={() => onKind(kind)}
              className={cn(
                "rounded-xl px-2.5 py-1.5 text-[12px] font-bold transition-colors",
                job.kind === kind
                  ? "bg-[var(--home-cta-top)] text-white"
                  : "bg-[var(--home-surface)] text-[var(--home-muted)]",
              )}
            >
              {JOB_KIND_SHORT[kind]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`הסרת עבודה ${index + 1}`}
          className="ms-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--home-muted)] hover:bg-[var(--home-surface)] hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2">
        {useList ? (
          <select
            aria-label={`שם העבודה ${index + 1}`}
            value={job.scheduleId ?? ""}
            onChange={(e) => choose(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="" disabled>בחירת עבודה מהלו״ז…</option>
            {schedule.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}{row.time ? ` · ${row.time}` : ""}
              </option>
            ))}
            <option value={TYPE_IT}>אחר — לא מופיע בלו״ז</option>
          </select>
        ) : (
          <Input
            placeholder={`שם העבודה ${index + 1}`}
            value={job.name}
            onChange={(e) => onPatch({ name: e.target.value, scheduleId: undefined })}
          />
        )}

        {schedule.length > 0 && typing && (
          <button
            type="button"
            onClick={() => { setTyping(false); onPatch({ name: "", scheduleId: undefined }); }}
            className="mt-1 text-[12px] text-[var(--home-cta-top)] underline"
          >
            בחירה מהלו״ז במקום
          </button>
        )}

        {match === "none" && (
          <p className="mt-1 text-[12px] text-amber-600 dark:text-amber-400">
            העבודה הזו לא מופיעה בלו״ז של התאריך הזה.
          </p>
        )}
        {match === "close" && (
          <p className="mt-1 text-[12px] text-amber-600 dark:text-amber-400">
            השם דומה אבל לא זהה לשם שבלו״ז.
          </p>
        )}
      </div>

      {/*
        The time fields have to be allowed to shrink. A shadcn Input is
        w-full, which in a flex row means "as wide as the row" rather than
        "share it", so two of them plus the running total came to 324px in a
        302px row and pushed the total out through the side of the card.
        min-w-0 is what lets a flex child go narrower than its content wants.
      */}
      {job.kind === "hourly" && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="time"
            className="min-w-0 flex-1"
            aria-label={`שעת התחלה — עבודה ${index + 1}`}
            value={job.from ?? ""}
            onChange={(e) => onPatch({ from: e.target.value })}
          />
          <span aria-hidden className="shrink-0 text-[var(--home-muted)]">–</span>
          <Input
            type="time"
            className="min-w-0 flex-1"
            aria-label={`שעת סיום — עבודה ${index + 1}`}
            value={job.to ?? ""}
            onChange={(e) => onPatch({ to: e.target.value })}
          />
          <span className="shrink-0 text-[13px] tabular-nums text-[var(--home-muted)]">
            {formatMinutes(jobMinutes(job))}
          </span>
        </div>
      )}
    </li>
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
  const payable = entryMinutes(entry);
  return (
    <li className="rounded-2xl border border-[var(--home-surface-border)] bg-[var(--home-surface)] p-3">
      <div className="flex items-baseline gap-2">
        <Clock aria-hidden className="h-4 w-4 shrink-0 translate-y-0.5 text-[var(--home-muted)]" />
        <span className="text-[15px] font-bold tabular-nums">{formatDate(entry.date)}</span>
        {payable > 0 && (
          <span className="text-[15px] font-bold tabular-nums text-[var(--home-cta-top)]">
            {formatMinutes(payable)}
          </span>
        )}
        <span className={cn("ms-auto text-[12px]", entry.sentAt ? "text-[var(--home-muted)]" : "text-amber-500")}>
          {entry.sentAt ? "נשלח" : "לא נשלח"}
        </span>
      </div>

      <ul className="mt-1.5 space-y-0.5 ps-6">
        {(entry.jobs ?? []).map((job) => (
          <li key={job.id} className="truncate text-[13px] text-[var(--home-muted)]">
            {job.name}
            {job.kind === "hourly"
              ? <> · <span className="tabular-nums">{job.from}–{job.to}</span></>
              : <> · {JOB_KIND_SHORT.fixed}</>}
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
