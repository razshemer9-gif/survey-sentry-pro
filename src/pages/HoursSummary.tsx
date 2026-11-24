import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/Field";
import { useAuth } from "@/contexts/AuthContext";
import { listReportAuthors } from "@/lib/storage";
import { remoteListSchedule } from "@/lib/schedule-remote";
import type { ScheduleRow } from "@/lib/schedule";
import { remoteListWorkHours, workHoursTableReady } from "@/lib/work-hours-remote";
import {
  exportFilename, exportRows, jobLines, matchLabel, summarise, totalMinutes,
  type EmployeeSummary, type JobLine,
} from "@/lib/hours-summary";
import {
  formatDate, formatMinutes, formatMonth, todayISO, type WorkHoursEntry,
} from "@/lib/work-hours";
import { downloadSheet, writeSheet } from "@/lib/xlsx";
import { cn } from "@/lib/utils";

/**
 * The month, for whoever adds the hours to a payslip.
 *
 * One number per employee, and under it the jobs that number is made of,
 * each marked according to whether it appears on that day's schedule. The
 * marks are the point: a total is only worth trusting if you can see what
 * it is made of and which parts nobody scheduled.
 */
export default function HoursSummary() {
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [entries, setEntries] = useState<WorkHoursEntry[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    workHoursTableReady().then((ok) => {
      setReady(ok);
      if (!ok) { setLoading(false); return; }
      Promise.all([
        remoteListWorkHours(2000),
        // From the start of time as far as this screen is concerned: a month
        // being reviewed is in the past, so today's schedule is no use here.
        remoteListSchedule("2000-01-01").catch(() => [] as ScheduleRow[]),
        listReportAuthors().catch(() => ({} as Record<string, string>)),
      ])
        .then(([rows, sched, names]) => {
          setEntries(rows);
          setSchedule(sched);
          setAuthors(names);
        })
        .catch((err) => {
          console.error("[hours] summary could not be read", err);
          toast.error("שגיאה בטעינת הנתונים");
        })
        .finally(() => setLoading(false));
    });
  }, [isAdmin]);

  const nameOf = useCallback(
    (ownerId: string) => authors[ownerId] || "עובד",
    [authors],
  );

  const lines = useMemo(
    () => jobLines(entries, month, schedule, nameOf),
    [entries, month, schedule, nameOf],
  );
  const summaries = useMemo(() => summarise(lines), [lines]);

  async function exportMonth() {
    try {
      const bytes = await writeSheet("שעות נוספות", exportRows(month, summaries, lines));
      downloadSheet(bytes, exportFilename(month));
    } catch (err) {
      console.error("[hours] export failed", err);
      toast.error("לא הצלחתי לייצא את הקובץ");
    }
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="home-surface px-4 pb-4 safe-top">
          <p className="mt-10 rounded-2xl border border-dashed border-[var(--home-surface-border)] px-5 py-8 text-center text-sm text-[var(--home-muted)]">
            הסיכום החודשי פתוח להנהלה בלבד.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="home-surface px-4 pb-4 safe-top">
        <header className="flex items-center gap-2 pt-5">
          <Button asChild variant="ghost" size="sm" className="gap-1 rounded-xl px-2">
            <Link to="/hours" aria-label="חזרה לדיווח עבודה">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-[22px] font-extrabold tracking-[-0.01em]">סיכום חודשי</h1>
        </header>

        {!ready ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--home-surface-border)] px-5 py-8 text-center text-sm text-[var(--home-muted)]">
            הטבלה עדיין לא נוצרה במסד הנתונים.
          </p>
        ) : (
          <>
            <div className="mt-3">
              <Field label="חודש">
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-4 rounded-[22px] border border-[var(--home-surface-border)] bg-[var(--home-surface)] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-[var(--home-muted)]">
                  {formatMonth(month)} — סה״כ שעות לתשלום
                </span>
                <span className="text-[22px] font-extrabold tabular-nums text-[var(--home-cta-top)]">
                  {formatMinutes(totalMinutes(summaries))}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full gap-2 rounded-2xl"
              disabled={loading || summaries.length === 0}
              onClick={exportMonth}
            >
              <Download className="h-4 w-4" />
              ייצוא לאקסל
            </Button>

            <div className="mt-5">
              {loading ? (
                <p className="py-10 text-center text-sm text-[var(--home-muted)]">טוען…</p>
              ) : summaries.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--home-surface-border)] px-5 py-8 text-center text-sm text-[var(--home-muted)]">
                  אין דיווחים בחודש הזה.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {summaries.map((s) => (
                    <EmployeeCard
                      key={s.ownerId}
                      summary={s}
                      lines={lines.filter((l) => l.ownerId === s.ownerId)}
                      open={open === s.ownerId}
                      onToggle={() => setOpen(open === s.ownerId ? null : s.ownerId)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function EmployeeCard({
  summary, lines, open, onToggle,
}: {
  summary: EmployeeSummary;
  lines: JobLine[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-2xl border border-[var(--home-surface-border)] bg-[var(--home-surface)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 p-3 text-start"
      >
        <span className="text-[16px] font-bold">{summary.employee}</span>
        <span className="text-[16px] font-extrabold tabular-nums text-[var(--home-cta-top)]">
          {formatMinutes(summary.minutes)}
        </span>
        {summary.unmatched > 0 && (
          <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            {summary.unmatched} לא בלו״ז
          </span>
        )}
        <span className="ms-auto text-[12px] text-[var(--home-muted)]">
          {summary.days} ימים · {summary.events} אירועים
          {summary.fixed > 0 ? ` · ${summary.fixed} במחיר קבוע` : ""}
        </span>
      </button>

      {open && (
        <ul className="border-t border-[var(--home-surface-border)] px-3 py-2">
          {lines.map((line) => (
            <li key={`${line.entryId}-${line.jobId}`} className="py-1.5 text-[13px]">
              <div className="flex items-baseline gap-2">
                <span className="tabular-nums text-[var(--home-muted)]">
                  {formatDate(line.date)}
                </span>
                <span className="min-w-0 flex-1 truncate">{line.job.name}</span>
                {line.job.kind === "hourly" ? (
                  <span className="shrink-0 tabular-nums">
                    {line.job.from}–{line.job.to} · {formatMinutes(line.minutes)}
                  </span>
                ) : (
                  <span className="shrink-0 text-[var(--home-muted)]">מחיר קבוע</span>
                )}
              </div>
              {line.job.kind === "hourly" && line.match !== "exact" && (
                <p className={cn(
                  "mt-0.5 text-[12px]",
                  line.match === "none"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-[var(--home-muted)]",
                )}>
                  {matchLabel(line.match)}
                  {line.scheduledAs ? ` — בלו״ז: ${line.scheduledAs}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
