import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileSpreadsheet, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { parseSchedule, type ScheduleRow } from "@/lib/schedule";
import {
  remoteListSchedule, remoteReplaceSchedule, scheduleTableReady,
} from "@/lib/schedule-remote";
import { formatDate, todayISO } from "@/lib/work-hours";
import { readWorkbook } from "@/lib/xlsx";

/**
 * The daily schedule, put in by hand.
 *
 * It arrives as a file in a WhatsApp group, which nothing can read on its
 * own, so somebody drops it here once a day. That is ten seconds, and it
 * buys the thing that matters: the employee then picks the job from a list
 * instead of typing its name, and there is nothing left to match.
 *
 * Nothing is saved until the file has been read and shown. A schedule that
 * silently replaced the day's jobs with a misread file would be worse than
 * no schedule at all.
 */
export default function ScheduleUpload() {
  const { isAdmin } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(true);
  const [parsed, setParsed] = useState<ScheduleRow[] | null>(null);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<ScheduleRow[]>([]);

  useEffect(() => {
    scheduleTableReady().then((ok) => {
      setReady(ok);
      if (ok) refresh();
    });
  }, []);

  function refresh() {
    remoteListSchedule(todayISO())
      .then(setCurrent)
      .catch(() => setCurrent([]));
  }

  async function pick(file: File) {
    setFilename(file.name);
    setParsed(null);
    try {
      const sheets = await readWorkbook(await file.arrayBuffer());
      // The schedule is rarely the only sheet, and not always the first;
      // the one that reads as a schedule is the one we want.
      let rows: ScheduleRow[] = [];
      for (const sheet of sheets) {
        const found = parseSchedule(sheet.rows);
        if (found.length > rows.length) rows = found;
      }
      if (rows.length === 0) {
        toast.error("לא מצאתי לו״ז בקובץ", {
          description: "צריך שורת כותרות עם עמודת תאריך ועמודת שם העבודה או האירוע.",
        });
        return;
      }
      setParsed(rows);
    } catch (err) {
      console.error("[schedule] could not read the file", err);
      toast.error("לא הצלחתי לקרוא את הקובץ", {
        description: "צריך קובץ אקסל (xlsx.).",
      });
    }
  }

  async function confirm() {
    if (!parsed) return;
    setBusy(true);
    try {
      const saved = await remoteReplaceSchedule(parsed);
      toast.success(`נשמרו ${saved} עבודות בלו״ז`);
      setParsed(null);
      setFilename("");
      if (fileInput.current) fileInput.current.value = "";
      refresh();
    } catch (err) {
      console.error("[schedule] could not be saved", err);
      toast.error("לא הצלחתי לשמור את הלו״ז");
    } finally {
      setBusy(false);
    }
  }

  const days = [...new Set((parsed ?? []).map((r) => r.date))].sort();

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="home-surface px-4 pb-4 safe-top">
          <p className="mt-10 rounded-2xl border border-dashed border-[var(--home-surface-border)] px-5 py-8 text-center text-sm text-[var(--home-muted)]">
            העלאת לו״ז פתוחה להנהלה בלבד.
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
          <h1 className="text-[22px] font-extrabold tracking-[-0.01em]">העלאת לו״ז</h1>
        </header>

        {!ready ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--home-surface-border)] px-5 py-8 text-center text-sm text-[var(--home-muted)]">
            הטבלה עדיין לא נוצרה במסד הנתונים.
          </p>
        ) : (
          <>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--home-muted)]">
              בוחרים את קובץ האקסל שהגיע בוואטסאפ. אחרי ההעלאה העובדים יבחרו את
              שם העבודה מתוך הלו״ז במקום להקליד אותו.
            </p>

            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pick(file);
              }}
            />

            <Button
              type="button"
              className="home-cta mt-4 h-14 w-full gap-3 rounded-[22px] text-[17px] font-extrabold text-white"
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="h-5 w-5" />
              בחירת קובץ
            </Button>

            {parsed && (
              <section className="mt-4 rounded-[22px] border border-[var(--home-surface-border)] bg-[var(--home-surface)] p-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet aria-hidden className="h-4 w-4 text-[var(--home-muted)]" />
                  <span className="truncate text-[14px] font-bold">{filename}</span>
                </div>
                <p className="mt-1 text-[13px] text-[var(--home-muted)]">
                  {parsed.length} עבודות, {days.length === 1
                    ? `לתאריך ${formatDate(days[0])}`
                    : `לתאריכים ${formatDate(days[0])}–${formatDate(days[days.length - 1])}`}
                </p>

                <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                  {parsed.map((row) => (
                    <li key={row.id} className="truncate text-[13px]">
                      <span className="tabular-nums text-[var(--home-muted)]">
                        {formatDate(row.date)}{row.time ? ` ${row.time}` : ""}
                      </span>
                      {" · "}
                      {row.name}
                      {row.employee ? <span className="text-[var(--home-muted)]"> · {row.employee}</span> : null}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-[12px] text-amber-600 dark:text-amber-400">
                  שמירה תחליף את הלו״ז הקיים בתאריכים האלה.
                </p>

                <div className="mt-3 flex gap-2">
                  <Button className="flex-1 rounded-2xl" disabled={busy} onClick={confirm}>
                    שמירת הלו״ז
                  </Button>
                  <Button
                    variant="ghost"
                    className="rounded-2xl"
                    disabled={busy}
                    onClick={() => { setParsed(null); setFilename(""); }}
                  >
                    ביטול
                  </Button>
                </div>
              </section>
            )}

            <h2 className="mt-6 text-[15px] font-bold">הלו״ז הנוכחי</h2>
            {current.length === 0 ? (
              <p className="mt-2 rounded-2xl border border-dashed border-[var(--home-surface-border)] px-5 py-6 text-center text-sm text-[var(--home-muted)]">
                אין לו״ז מהיום והלאה.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {current.map((row) => (
                  <li key={row.id} className="truncate text-[13px]">
                    <span className="tabular-nums text-[var(--home-muted)]">
                      {formatDate(row.date)}{row.time ? ` ${row.time}` : ""}
                    </span>
                    {" · "}
                    {row.name}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
