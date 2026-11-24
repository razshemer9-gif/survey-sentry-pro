/**
 * The month, as the person who pays the salaries needs to see it.
 *
 * Two shapes of the same data: a total per employee, which is the number
 * that gets added to a payslip, and a line per job, which is what you look
 * at when a total seems wrong. Both are built here rather than in the screen
 * so the figures in the export are the figures on the screen — a summary
 * that disagrees with its own export is worse than no export.
 *
 * Only hourly work is totalled. Fixed-price jobs are counted and listed,
 * because they are the evidence that a day was worked, but they never reach
 * the minutes column: they are already paid, and a number in that column
 * would eventually be added to a salary by somebody in a hurry.
 */

import {
  type MatchKind, type ScheduleRow, matchJob,
} from "./schedule";
import {
  type WorkHoursEntry, type WorkJob,
  JOB_KIND_SHORT, formatDate, formatMinutes, formatMonth, jobMinutes, monthOf,
} from "./work-hours";

export type JobLine = {
  entryId: string;
  jobId: string;
  ownerId: string;
  employee: string;
  date: string;
  job: WorkJob;
  minutes: number;
  match: MatchKind;
  /** What the schedule calls it, when that differs from what was logged. */
  scheduledAs?: string;
};

export type EmployeeSummary = {
  ownerId: string;
  employee: string;
  /** Payable minutes: hourly work only. */
  minutes: number;
  events: number;
  fixed: number;
  /** Hourly jobs that are not on the schedule for their day. */
  unmatched: number;
  days: number;
};

const MATCH_LABEL: Record<MatchKind, string> = {
  exact: "תואם ללו״ז",
  close: "דומה ללו״ז — לבדוק",
  none: "לא נמצא בלו״ז",
};

export function matchLabel(kind: MatchKind): string {
  return MATCH_LABEL[kind];
}

/**
 * Every job logged in a month, flattened, each with its schedule verdict.
 *
 * A job picked from the schedule carries its row's id and is counted as an
 * exact match without re-comparing text: it was not typed, so there is
 * nothing that could have been typed differently.
 */
export function jobLines(
  entries: WorkHoursEntry[],
  monthISO: string,
  schedule: ScheduleRow[],
  nameOf: (ownerId: string) => string,
): JobLine[] {
  const lines: JobLine[] = [];
  for (const entry of entries) {
    if (monthOf(entry.date) !== monthISO) continue;
    const ownerId = entry.ownerId ?? "";
    for (const job of entry.jobs ?? []) {
      let match: MatchKind = "none";
      let scheduledAs: string | undefined;
      if (job.scheduleId) {
        const row = schedule.find((s) => s.id === job.scheduleId);
        match = "exact";
        scheduledAs = row?.name;
      } else {
        const found = matchJob(job.name, entry.date, schedule);
        match = found.kind;
        scheduledAs = found.row?.name;
      }
      lines.push({
        entryId: entry.id,
        jobId: job.id,
        ownerId,
        employee: nameOf(ownerId),
        date: entry.date,
        job,
        minutes: jobMinutes(job),
        match,
        scheduledAs: scheduledAs !== job.name ? scheduledAs : undefined,
      });
    }
  }
  return lines.sort((a, b) =>
    a.employee.localeCompare(b.employee, "he") || a.date.localeCompare(b.date));
}

/** One row per employee: the month's total and what it is made of. */
export function summarise(lines: JobLine[]): EmployeeSummary[] {
  const byOwner = new Map<string, EmployeeSummary & { dates: Set<string> }>();
  for (const line of lines) {
    let row = byOwner.get(line.ownerId);
    if (!row) {
      row = {
        ownerId: line.ownerId, employee: line.employee, minutes: 0,
        events: 0, fixed: 0, unmatched: 0, days: 0, dates: new Set(),
      };
      byOwner.set(line.ownerId, row);
    }
    row.dates.add(line.date);
    if (line.job.kind === "hourly") {
      row.minutes += line.minutes;
      row.events += 1;
      if (line.match !== "exact") row.unmatched += 1;
    } else {
      row.fixed += 1;
    }
  }
  return [...byOwner.values()]
    .map(({ dates, ...row }) => ({ ...row, days: dates.size }))
    .sort((a, b) => b.minutes - a.minutes || a.employee.localeCompare(b.employee, "he"));
}

/** The month's payable hours across everyone. */
export function totalMinutes(summaries: EmployeeSummary[]): number {
  return summaries.reduce((sum, s) => sum + s.minutes, 0);
}

/**
 * The workbook the finance office takes away.
 *
 * The totals come first, because that is the sheet's job; the detail follows
 * under its own headings so a figure can be traced without opening the app.
 * Every value is text — "3:30" stays "3:30" instead of becoming a fraction
 * of a day in whichever Excel opens it.
 */
export function exportRows(
  monthISO: string,
  summaries: EmployeeSummary[],
  lines: JobLine[],
): string[][] {
  const rows: string[][] = [];
  rows.push([`שעות נוספות — ${formatMonth(monthISO)}`]);
  rows.push([]);
  rows.push(["עובד", "שעות לתשלום", "אירועים", "עבודות במחיר קבוע", "ימי עבודה", "לא תואם ללו״ז"]);
  for (const s of summaries) {
    rows.push([
      s.employee,
      formatMinutes(s.minutes),
      String(s.events),
      String(s.fixed),
      String(s.days),
      s.unmatched ? String(s.unmatched) : "",
    ]);
  }
  rows.push([]);
  rows.push(['סה"כ שעות לתשלום', formatMinutes(totalMinutes(summaries))]);

  rows.push([]);
  rows.push([]);
  rows.push(["פירוט"]);
  rows.push(["עובד", "תאריך", "עבודה", "סוג", "התחלה", "סיום", "שעות", "מקום", "התאמה ללו״ז", "בלו״ז רשום"]);
  for (const line of lines) {
    rows.push([
      line.employee,
      formatDate(line.date),
      line.job.name,
      JOB_KIND_SHORT[line.job.kind],
      line.job.kind === "hourly" ? (line.job.from ?? "") : "",
      line.job.kind === "hourly" ? (line.job.to ?? "") : "",
      line.job.kind === "hourly" ? formatMinutes(line.minutes) : "",
      line.job.place ?? "",
      line.job.kind === "hourly" ? matchLabel(line.match) : "",
      line.scheduledAs ?? "",
    ]);
  }
  return rows;
}

/** "שעות-נוספות-2026-11.xlsx" */
export function exportFilename(monthISO: string): string {
  return `שעות-נוספות-${monthISO}.xlsx`;
}
