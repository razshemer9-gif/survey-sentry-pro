/**
 * Overtime, as logged from the field.
 *
 * The point of this screen is not a number of hours — a number on its own
 * cannot be checked against anything. It is the afternoon it was made of:
 * which sites, and between which hours at each. That is what makes a claim
 * verifiable against the schedule, and it is why an entry with no visits
 * cannot be sent.
 *
 * Everything here is pure, so the rules that decide whether an entry may be
 * sent can be tested without a screen or a database.
 */

export type Visit = {
  id: string;
  /** Where the consultant was. */
  place: string;
  /** "HH:MM", 24-hour. */
  from: string;
  to: string;
};

export type WorkHoursEntry = {
  id: string;
  /** "YYYY-MM-DD" — the day the work was done. */
  date: string;
  visits: Visit[];
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
 * How long a visit lasted, in minutes.
 *
 * A visit that ends earlier than it began ran past midnight — a safety
 * survey at a school finishing at 00:30 is an ordinary evening, not a typing
 * mistake — so it counts into the next day rather than coming out negative.
 */
export function visitMinutes(visit: Pick<Visit, "from" | "to">): number {
  if (!isTime(visit.from) || !isTime(visit.to)) return 0;
  const from = toMinutes(visit.from);
  const to = toMinutes(visit.to);
  return to >= from ? to - from : 24 * 60 - from + to;
}

export function entryMinutes(entry: Pick<WorkHoursEntry, "visits">): number {
  return (entry.visits ?? []).reduce((sum, v) => sum + visitMinutes(v), 0);
}

/** "3:45" — hours and minutes, the way a timesheet is read. */
export function formatMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * What is stopping this entry from being sent, in the order a person would
 * meet it. An empty list means it is ready.
 */
export function problemsWith(entry: WorkHoursEntry): string[] {
  const problems: string[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? "")) {
    problems.push("חסר תאריך.");
  }

  const visits = entry.visits ?? [];
  if (visits.length === 0) {
    problems.push("צריך לפרט לפחות מקום אחד שבו ביקרת.");
  }

  visits.forEach((v, i) => {
    const which = `ביקור ${i + 1}`;
    if (!v.place?.trim()) problems.push(`${which}: חסר שם המקום.`);
    if (!isTime(v.from) || !isTime(v.to)) {
      problems.push(`${which}: חסרות שעות התחלה וסיום.`);
    } else if (visitMinutes(v) === 0) {
      problems.push(`${which}: שעת ההתחלה והסיום זהות.`);
    }
  });

  // Being in two places at once is the one thing a schedule cannot match.
  for (const [a, b] of overlappingPairs(visits)) {
    problems.push(`ביקור ${a + 1} וביקור ${b + 1} חופפים בשעות.`);
  }

  return problems;
}

export function canSend(entry: WorkHoursEntry): boolean {
  return problemsWith(entry).length === 0;
}

/** Indexes of visits whose hours run over each other, each pair once. */
function overlappingPairs(visits: Visit[]): [number, number][] {
  const spans = visits.map((v) =>
    isTime(v.from) && isTime(v.to)
      ? { from: toMinutes(v.from), to: toMinutes(v.from) + visitMinutes(v) }
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
  return `שעות נוספות ${formatDate(entry.date)}${who ? ` — ${who}` : ""}`;
}

/**
 * The message itself: plain text, because it is read on a phone, forwarded,
 * and sometimes printed. Every visit on its own line, the total at the end,
 * and nothing that needs the app to make sense of it.
 */
export function emailBody(entry: WorkHoursEntry, consultantName: string): string {
  const lines: string[] = [];
  const who = consultantName.trim();
  if (who) lines.push(`שם: ${who}`);
  lines.push(`תאריך: ${formatDate(entry.date)}`);
  lines.push("");
  lines.push("מקומות ושעות:");
  entry.visits.forEach((v, i) => {
    lines.push(`${i + 1}. ${v.place.trim()} — ${v.from}–${v.to} (${formatMinutes(visitMinutes(v))})`);
  });
  lines.push("");
  lines.push(`סה"כ שעות נוספות: ${formatMinutes(entryMinutes(entry))}`);
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
    visits: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function newVisit(id: string): Visit {
  return { id, place: "", from: "", to: "" };
}

/** Newest day first; two entries on one day keep the later edit on top. */
export function sortEntries(entries: WorkHoursEntry[]): WorkHoursEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return (b.date ?? "").localeCompare(a.date ?? "");
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

/** The hours in a month, for the line that says how the month is going. */
export function minutesInMonth(entries: WorkHoursEntry[], monthISO: string): number {
  return entries
    .filter((e) => (e.date ?? "").startsWith(monthISO))
    .reduce((sum, e) => sum + entryMinutes(e), 0);
}
