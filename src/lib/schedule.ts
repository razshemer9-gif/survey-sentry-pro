/**
 * The company schedule, as it arrives.
 *
 * The file comes from whoever made it that morning, so nothing here assumes
 * a fixed layout: the header row is found by reading the headers, not by
 * counting down from the top, and the columns are found by name. A schedule
 * with a title line above it, a blank row, or its columns in another order
 * all read the same.
 *
 * Matching a logged job to a scheduled one is done on a normalised name,
 * because the two are typed by different people on different days. But the
 * screen prefers to sidestep the problem entirely: where a schedule exists
 * for the day, the employee picks the job from it instead of typing a name,
 * and then there is nothing to match.
 */

export type ScheduleRow = {
  id: string;
  /** "YYYY-MM-DD". */
  date: string;
  /** The job or event as the schedule calls it. */
  name: string;
  place?: string;
  employee?: string;
  time?: string;
};

/**
 * How a column is recognised, in the order the patterns are tried.
 *
 * The order is the whole design. "name" is last and deliberately broad —
 * it has to catch a column simply headed "אירוע" — so every narrower
 * meaning gets first refusal. Without that, a column headed "שעות עבודה"
 * would be read as the job name, because it contains the word עבודה.
 */
const HEADER_PATTERNS: [keyof Omit<ScheduleRow, "id">, RegExp][] = [
  ["date", /תאריך|^יום$|date/i],
  ["time", /שעה|שעות|time|hour/i],
  ["place", /מקום|כתובת|אתר|יישוב|עיר|place|location|address|site/i],
  ["employee", /עובד|אחראי|מבצע|יועץ|מהנדס|employee|staff|assigned/i],
  ["name", /שם|אירוע|עבודה|פרויקט|event|job|project/i],
];

/**
 * Where the headers are and which column is which.
 *
 * The first row that names both a date and a job is taken as the header row.
 * Requiring both is what stops a title like "לוח זמנים — נובמבר" from being
 * mistaken for headers because it happens to contain a month.
 */
export function findHeader(rows: string[][]): {
  headerRow: number;
  columns: Partial<Record<keyof Omit<ScheduleRow, "id">, number>>;
} | null {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const columns: Partial<Record<keyof Omit<ScheduleRow, "id">, number>> = {};
    rows[r].forEach((cell, c) => {
      const text = cell.trim();
      if (!text) return;
      // The first meaning this header fits, and that no earlier column has
      // already claimed. A sheet with two date columns keeps the first.
      for (const [field, pattern] of HEADER_PATTERNS) {
        if (columns[field] !== undefined) continue;
        if (!pattern.test(text)) continue;
        columns[field] = c;
        return;
      }
    });
    if (columns.date !== undefined && columns.name !== undefined) {
      return { headerRow: r, columns };
    }
  }
  return null;
}

/**
 * A date as the sheet wrote it, as "YYYY-MM-DD".
 *
 * A real date cell already arrives in this form from the reader. Everything
 * else is text somebody typed, and in this country that is day first — so
 * 3/11 is the 3rd of November, never the 11th of March.
 */
export function normaliseDate(value: string): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return "";
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += year < 70 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * A job name reduced to what two people would have typed the same.
 *
 * Quotation marks go because גן "שקד" and גן שקד are one place; the Hebrew
 * gereshayim in an acronym goes with them. Vowel points go because a name
 * copied from a flyer can carry them. What is left is compared.
 */
export function normaliseName(value: string): string {
  return (value ?? "")
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'`״׳“”‘’]/g, "")
    .replace(/[־–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * A row's identity, derived from what the row says.
 *
 * It has to survive the same schedule being sent twice — corrected at noon,
 * resent at four — because an employee who already picked a job from the
 * morning's file must still be pointing at it in the evening's. A counter
 * would renumber everything; the day, the job and the time do not change
 * when the file is saved again.
 */
export function scheduleRowId(row: Pick<ScheduleRow, "date" | "name" | "time">): string {
  return [row.date, normaliseName(row.name), (row.time ?? "").trim()].join("|");
}

/** The schedule rows a sheet holds, newest layout or oldest. */
export function parseSchedule(rows: string[][]): ScheduleRow[] {
  const found = findHeader(rows);
  if (!found) return [];
  const { headerRow, columns } = found;

  const out: ScheduleRow[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const at = (key: keyof Omit<ScheduleRow, "id">) => {
      const c = columns[key];
      return c === undefined ? "" : (row[c] ?? "").trim();
    };
    const date = normaliseDate(at("date"));
    const name = at("name");
    // A row with no job name is a spacer, a note or a total; not a job.
    if (!date || !name) continue;
    const time = at("time") || undefined;
    out.push({
      id: scheduleRowId({ date, name, time }),
      date,
      name,
      place: at("place") || undefined,
      employee: at("employee") || undefined,
      time,
    });
  }
  return out;
}

export type MatchKind = "exact" | "close" | "none";

/**
 * Whether a logged job name corresponds to something on the schedule for
 * that day.
 *
 * "close" exists because the alternative is worse in both directions: an
 * exact-only check reports a mismatch for "פסטיבל אור ראשון" against
 * "פסטיבל אור-ראשון", and a loose check quietly accepts the wrong job. A
 * near miss is reported as a near miss and a person decides.
 */
export function matchJob(
  name: string,
  date: string,
  schedule: ScheduleRow[],
): { kind: MatchKind; row?: ScheduleRow } {
  const wanted = normaliseName(name);
  if (!wanted) return { kind: "none" };
  const sameDay = schedule.filter((s) => s.date === date);
  if (sameDay.length === 0) return { kind: "none" };

  for (const row of sameDay) {
    if (normaliseName(row.name) === wanted) return { kind: "exact", row };
  }
  for (const row of sameDay) {
    const other = normaliseName(row.name);
    if (!other) continue;
    if (other.includes(wanted) || wanted.includes(other)) return { kind: "close", row };
  }
  return { kind: "none" };
}

/** The jobs scheduled for one day, for the list an employee picks from. */
export function scheduleFor(date: string, schedule: ScheduleRow[]): ScheduleRow[] {
  return schedule.filter((s) => s.date === date);
}

/** Every day the schedule covers, newest first — for the upload summary. */
export function datesCovered(schedule: ScheduleRow[]): string[] {
  return [...new Set(schedule.map((s) => s.date))].sort().reverse();
}
