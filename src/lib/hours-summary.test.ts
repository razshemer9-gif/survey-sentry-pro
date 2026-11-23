import { describe, expect, it } from "vitest";
import { exportRows, jobLines, matchLabel, summarise, totalMinutes } from "./hours-summary";
import type { ScheduleRow } from "./schedule";
import type { WorkHoursEntry } from "./work-hours";
import { readWorkbook, writeSheet } from "./xlsx";

const schedule: ScheduleRow[] = [
  { id: "s-2", date: "2026-11-23", name: "פסטיבל אור ראשון" },
  { id: "s-3", date: "2026-11-23", name: 'גן עירוני "שקד"' },
  { id: "s-4", date: "2026-11-24", name: "יריד חורף" },
];

const names: Record<string, string> = { u1: "זיו", u2: "מריס" };
const nameOf = (id: string) => names[id] ?? "עובד";

const entries: WorkHoursEntry[] = [
  {
    id: "e1", date: "2026-11-23", ownerId: "u1", createdAt: 1, updatedAt: 1,
    jobs: [
      { id: "j1", name: "פסטיבל אור ראשון", kind: "hourly", from: "17:00", to: "20:30" },
      { id: "j2", name: "סקר נגישות בית ספר", kind: "fixed" },
    ],
  },
  {
    id: "e2", date: "2026-11-24", ownerId: "u1", createdAt: 1, updatedAt: 1,
    jobs: [{ id: "j3", name: "אירוע שלא בלוז", kind: "hourly", from: "18:00", to: "19:00" }],
  },
  {
    id: "e3", date: "2026-11-23", ownerId: "u2", createdAt: 1, updatedAt: 1,
    jobs: [{ id: "j4", name: "גן עירוני שקד", kind: "hourly", from: "20:00", to: "22:00" }],
  },
  {
    id: "e4", date: "2026-10-30", ownerId: "u1", createdAt: 1, updatedAt: 1,
    jobs: [{ id: "j5", name: "חודש קודם", kind: "hourly", from: "08:00", to: "18:00" }],
  },
];

const lines = jobLines(entries, "2026-11", schedule, nameOf);

describe("flattening a month into jobs", () => {
  it("leaves out days from other months", () => {
    expect(lines.map((l) => l.job.id)).not.toContain("j5");
    expect(lines).toHaveLength(4);
  });

  it("marks a job that is on the schedule for its day", () => {
    expect(lines.find((l) => l.job.id === "j1")?.match).toBe("exact");
  });

  it("matches through quotation marks the two people typed differently", () => {
    expect(lines.find((l) => l.job.id === "j4")?.match).toBe("exact");
  });

  it("marks a job that is on no schedule", () => {
    expect(lines.find((l) => l.job.id === "j3")?.match).toBe("none");
  });

  it("trusts a job picked from the schedule without re-reading its text", () => {
    // Picked, not typed: there is nothing that could have been typed wrong,
    // even though this name appears nowhere in the schedule.
    const picked = jobLines(
      [{
        id: "p", date: "2026-11-23", ownerId: "u1", createdAt: 1, updatedAt: 1,
        jobs: [{ id: "jp", name: "שם אחר לגמרי", kind: "hourly", from: "17:00", to: "18:00", scheduleId: "s-2" }],
      }],
      "2026-11", schedule, nameOf,
    );
    expect(picked[0].match).toBe("exact");
    expect(picked[0].scheduledAs).toBe("פסטיבל אור ראשון");
  });
});

describe("the total per employee", () => {
  const summaries = summarise(lines);

  it("adds up only hourly work", () => {
    const ziv = summaries.find((s) => s.employee === "זיו")!;
    // 3:30 at the festival plus 1:00 at the unscheduled event. The
    // fixed-price survey adds nothing.
    expect(ziv.minutes).toBe(210 + 60);
    expect(ziv.events).toBe(2);
    expect(ziv.fixed).toBe(1);
  });

  it("counts the days worked, not the jobs", () => {
    expect(summaries.find((s) => s.employee === "זיו")!.days).toBe(2);
  });

  it("counts the hourly jobs that are not on the schedule", () => {
    expect(summaries.find((s) => s.employee === "זיו")!.unmatched).toBe(1);
    expect(summaries.find((s) => s.employee === "מריס")!.unmatched).toBe(0);
  });

  it("puts the biggest total first", () => {
    expect(summaries.map((s) => s.employee)).toEqual(["זיו", "מריס"]);
  });

  it("adds the month up across everyone", () => {
    expect(totalMinutes(summaries)).toBe(210 + 60 + 120);
  });
});

describe("the workbook the finance office takes away", () => {
  const rows = exportRows("2026-11", summarise(lines), lines);

  it("opens with the month and the per-employee totals", () => {
    expect(rows[0][0]).toBe("שעות נוספות — נובמבר 2026");
    expect(rows[2]).toContain("שעות לתשלום");
    expect(rows[3][0]).toBe("זיו");
    expect(rows[3][1]).toBe("4:30");
  });

  it("states the month's total", () => {
    const total = rows.find((r) => r[0] === 'סה"כ שעות לתשלום');
    expect(total?.[1]).toBe("6:30");
  });

  it("leaves the hours column of a fixed-price job empty, never zero", () => {
    // "0:00" in an hours column is a number somebody will eventually add up.
    const detail = rows.slice(rows.findIndex((r) => r[0] === "פירוט"));
    const fixed = detail.find((r) => r[2] === "סקר נגישות בית ספר")!;
    expect(fixed[6]).toBe("");
    expect(fixed[3]).toBe("מחיר קבוע");
  });

  it("says of each event whether it matched the schedule", () => {
    const detail = rows.slice(rows.findIndex((r) => r[0] === "פירוט"));
    expect(detail.find((r) => r[2] === "פסטיבל אור ראשון")![8]).toBe(matchLabel("exact"));
    expect(detail.find((r) => r[2] === "אירוע שלא בלוז")![8]).toBe(matchLabel("none"));
  });

  it("survives being written to a real .xlsx and read back", async () => {
    const bytes = await writeSheet("שעות נוספות", rows);
    const [sheet] = await readWorkbook(bytes);
    expect(sheet.rows[0][0]).toBe("שעות נוספות — נובמבר 2026");
    expect(sheet.rows[3][1]).toBe("4:30");
  });
});
