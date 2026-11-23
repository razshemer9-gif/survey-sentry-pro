/**
 * What an employee did in a day, and which part of it is paid by the hour.
 *
 * Most work here is paid a fixed price for the job, so asking for start and
 * end times would be asking for numbers nobody uses — and a field nobody
 * uses is a field that gets filled in carelessly, which is worse than not
 * having it. The exception is accompanying an event as its safety engineer:
 * that is priced by the hour, so there the hours are mandatory and are
 * checked.
 *
 * Hence a kind per job rather than per day: one afternoon can hold a fixed
 * price survey and an evening event, and only the second adds to a salary.
 *
 * Everything here is pure, so the rules that decide whether a day may be
 * sent can be tested without a screen or a database.
 */

export type JobKind = "hourly" | "fixed";

export const JOB_KIND_LABEL: Record<JobKind, string> = {
  hourly: "ליווי אירוע — לפי שעה",
  fixed: "עבודה במחיר קבוע",
};

export const JOB_KIND_SHORT: Record<JobKind, string> = {
  hourly: "לפי שעה",
  fixed: "מחיר קבוע",
};

export type WorkJob = {
  id: string;
  /** The job as the schedule calls it, where there is a schedule. */
  name: string;
  kind: JobKind;
  /** "HH:MM", 24-hour. Required for an hourly job, absent from a fixed one. */
  from?: string;
  to?: string;
  place?: string;
  /** The schedule row this was picked from, when it was picked and not typed. */
  scheduleId?: string;
};

export type WorkHoursEntry = {
  id: string;
  /** "YYYY-MM-DD" — the day the work was done. */
  date: string;
  jobs: WorkJob[];
  note?: string;
  createdAt: number;
  updatedAt: number;
  /** The account that logged it; stamped from the row on the way in. */
  ownerId?: string;
  /** When this entry was last sent by e-mail, if it was. */
  sentAt?: number;
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTime(value: string | undefined): boolean {
  return TIME.test((value ?? "").trim());
}

function toMinutes(time: string): number {
  const [h, m] = time.trim().split(":").map(Number);
  return h * 60 + m;
}

/**
 * How long an hourly job lasted, in minutes. A fixed-price job is zero,
 * because it is not measured in time at all.
 *
 * A job that ends earlier than it began ran past midnight — an event
 * finishing at 00:30 is an ordinary evening, not a typing mistake — so it
 * counts into the next day rather than coming out negative.
 */
export function jobMinutes(job: Pick<WorkJob, "kind" | "from" | "to">): number {
  if (job.kind !== "hourly") return 0;
  if (!isTime(job.from) || !isTime(job.to)) return 0;
  const from = toMinutes(job.from!);
  const to = toMinutes(job.to!);
  return to >= from ? to - from : 24 * 60 - from + to;
}

/** The hours in a day that are paid by the hour. */
export function entryMinutes(entry: Pick<WorkHoursEntry, "jobs">): number {
  return (entry.jobs ?? []).reduce((sum, j) => sum + jobMinutes(j), 0);
}

export function hourlyJobs(entry: Pick<WorkHoursEntry, "jobs">): WorkJob[] {
  return (entry.jobs ?? []).filter((j) => j.kind === "hourly");
}

export function fixedJobs(entry: Pick<WorkHoursEntry, "jobs">): WorkJob[] {
  return (entry.jobs ?? []).filter((j) => j.kind !== "hourly");
}

/** "3:45" — hours and minutes, the way a timesheet is read. */
export function formatMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * What is stopping this day from being sent, in the order a person would
 * meet it. An empty list means it is ready.
 */
export function problemsWith(entry: WorkHoursEntry): string[] {
  const problems: string[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? "")) {
    problems.push("חסר תאריך.");
  }

  const jobs = entry.jobs ?? [];
  if (jobs.length === 0) {
    problems.push("צריך לפרט לפחות עבודה אחת.");
  }

  jobs.forEach((job, i) => {
    const which = `עבודה ${i + 1}`;
    if (!job.name?.trim()) problems.push(`${which}: חסר שם העבודה.`);
    if (job.kind !== "hourly") return;
    // Only here, because only here do the hours decide what is paid.
    if (!isTime(job.from) || !isTime(job.to)) {
      problems.push(`${which}: ליווי אירוע מחייב שעת התחלה וסיום.`);
    } else if (jobMinutes(job) === 0) {
      problems.push(`${which}: שעת ההתחלה והסיום זהות.`);
    }
  });

  // Being in two places at once is the one thing a schedule cannot match.
  for (const [a, b] of overlappingPairs(jobs)) {
    problems.push(`עבודה ${a + 1} ועבודה ${b + 1} חופפות בשעות.`);
  }

  return problems;
}

export function canSend(entry: WorkHoursEntry): boolean {
  return problemsWith(entry).length === 0;
}

/** Indexes of hourly jobs whose hours run over each other, each pair once. */
function overlappingPairs(jobs: WorkJob[]): [number, number][] {
  const spans = jobs.map((j) =>
    j.kind === "hourly" && isTime(j.from) && isTime(j.to)
      ? { from: toMinutes(j.from!), to: toMinutes(j.from!) + jobMinutes(j) }
      : null,
  );
  const pairs: [number, number][] = [];
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i];
      const b = spans[j];
      if (!a || !b) continue;
      if (a.from < b.to && b.from < a.to) pairs.push([i, j]);
    }
  }
  return pairs;
}

/** "21.11.2026" — the form a date is read in, not the form it is stored in. */
export function formatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return date ?? "";
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export function emailSubject(entry: WorkHoursEntry, consultantName: string): string {
  const who = consultantName.trim();
  return `דיווח עבודה ${formatDate(entry.date)}${who ? ` — ${who}` : ""}`;
}

/**
 * The message itself: plain text, because it is read on a phone, forwarded,
 * and sometimes printed. The hourly work and the fixed-price work are listed
 * apart, and only the hourly total is added up — that total is the number
 * the month's salary is adjusted by, and putting anything else beside it
 * would invite the two to be added together.
 */
export function emailBody(entry: WorkHoursEntry, consultantName: string): string {
  const lines: string[] = [];
  const who = consultantName.trim();
  if (who) lines.push(`שם: ${who}`);
  lines.push(`תאריך: ${formatDate(entry.date)}`);

  const hourly = hourlyJobs(entry);
  const fixed = fixedJobs(entry);

  if (hourly.length) {
    lines.push("");
    lines.push("ליווי אירועים (לפי שעה):");
    hourly.forEach((j, i) => {
      const where = j.place?.trim() ? `, ${j.place.trim()}` : "";
      lines.push(`${i + 1}. ${j.name.trim()}${where} — ${j.from}–${j.to} (${formatMinutes(jobMinutes(j))})`);
    });
    lines.push("");
    lines.push(`סה"כ שעות לתשלום: ${formatMinutes(entryMinutes(entry))}`);
  }

  if (fixed.length) {
    lines.push("");
    lines.push("עבודות במחיר קבוע:");
    fixed.forEach((j, i) => {
      const where = j.place?.trim() ? ` — ${j.place.trim()}` : "";
      lines.push(`${i + 1}. ${j.name.trim()}${where}`);
    });
  }

  if (entry.note?.trim()) {
    lines.push("");
    lines.push(`הערות: ${entry.note.trim()}`);
  }
  return lines.join("\n");
}

/**
 * A link the phone's mail app opens with the message ready.
 *
 * mailto rather than sending from a server: the consultant sees exactly what
 * leaves their name, it needs no mail service and no key, and it works from
 * whichever account the phone already sends from.
 */
export function mailtoUrl(to: string, subject: string, body: string): string {
  const address = encodeURIComponent(to.trim());
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Hand the message to the phone's mail app.
 *
 * Through a link that is clicked, rather than by assigning to
 * location.href: an app opened from the Home Screen runs without a browser
 * around it, and assigning an address the app itself cannot display is
 * quietly ignored there. A click on a real anchor is what the system
 * actually listens for.
 */
export function openMail(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Today, as the date input wants it, in the phone's own timezone. */
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function newEntry(id: string, now: number = Date.now()): WorkHoursEntry {
  return {
    id,
    date: todayISO(new Date(now)),
    jobs: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A new line on the form.
 *
 * Fixed price by default, because that is most of the work. An employee who
 * accompanied an event says so deliberately, and is then asked for hours —
 * rather than everyone being asked for hours and most people leaving them
 * blank or, worse, inventing them.
 */
export function newJob(id: string, kind: JobKind = "fixed"): WorkJob {
  return kind === "hourly"
    ? { id, name: "", kind, from: "", to: "" }
    : { id, name: "", kind };
}

/** Newest day first; two entries on one day keep the later edit on top. */
export function sortEntries(entries: WorkHoursEntry[]): WorkHoursEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return (b.date ?? "").localeCompare(a.date ?? "");
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

/** The payable hours in a month, for the line that says how the month is going. */
export function minutesInMonth(entries: WorkHoursEntry[], monthISO: string): number {
  return entries
    .filter((e) => (e.date ?? "").startsWith(monthISO))
    .reduce((sum, e) => sum + entryMinutes(e), 0);
}

/** "2026-11" — the month a date falls in. */
export function monthOf(date: string): string {
  return (date ?? "").slice(0, 7);
}

/** "נובמבר 2026", for a heading. */
export function formatMonth(monthISO: string): string {
  const months = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ];
  const [y, m] = (monthISO ?? "").split("-");
  const i = Number(m) - 1;
  if (!y || i < 0 || i > 11) return monthISO ?? "";
  return `${months[i]} ${y}`;
}
