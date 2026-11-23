import { describe, expect, it } from "vitest";
import {
  canSend, emailBody, emailSubject, entryMinutes, fixedJobs, formatDate,
  formatMinutes, formatMonth, hourlyJobs, jobMinutes, mailtoUrl, minutesInMonth,
  monthOf, newEntry, newJob, problemsWith, sortEntries, todayISO,
  type WorkHoursEntry, type WorkJob,
} from "./work-hours";

const job = (over: Partial<WorkJob> = {}): WorkJob => ({
  id: "j1", name: "אירוע", kind: "hourly", from: "17:00", to: "20:30", ...over,
});

const entry = (over: Partial<WorkHoursEntry> = {}): WorkHoursEntry => ({
  id: "e1", date: "2026-11-23", jobs: [job()], createdAt: 1, updatedAt: 1, ...over,
});

describe("how long an hourly job lasted", () => {
  it("counts the hours between start and end", () => {
    expect(jobMinutes(job({ from: "17:00", to: "20:30" }))).toBe(210);
  });

  it("counts an event that ran past midnight into the next day", () => {
    // Finishing at 00:30 is an ordinary evening, not a typing mistake.
    expect(jobMinutes(job({ from: "22:00", to: "00:30" }))).toBe(150);
  });

  it("counts nothing for a fixed-price job, whatever hours it carries", () => {
    // A stale pair of times left over from switching the kind must not
    // quietly become payable hours.
    expect(jobMinutes({ kind: "fixed", from: "09:00", to: "17:00" })).toBe(0);
  });

  it("counts nothing when the hours are half-typed", () => {
    expect(jobMinutes(job({ from: "17:0", to: "20:30" }))).toBe(0);
    expect(jobMinutes(job({ from: "", to: "" }))).toBe(0);
  });
});

describe("the hours a day is paid for", () => {
  it("adds up only the hourly jobs", () => {
    const e = entry({
      jobs: [
        job({ id: "a", from: "17:00", to: "19:00" }),
        job({ id: "b", kind: "fixed", name: "סקר נגישות", from: undefined, to: undefined }),
        job({ id: "c", from: "20:00", to: "21:30" }),
      ],
    });
    expect(entryMinutes(e)).toBe(120 + 90);
    expect(hourlyJobs(e)).toHaveLength(2);
    expect(fixedJobs(e)).toHaveLength(1);
  });

  it("is zero for a day of fixed-price work", () => {
    expect(entryMinutes(entry({ jobs: [job({ kind: "fixed" })] }))).toBe(0);
  });

  it("reads as hours and minutes", () => {
    expect(formatMinutes(210)).toBe("3:30");
    expect(formatMinutes(45)).toBe("0:45");
    expect(formatMinutes(0)).toBe("0:00");
  });
});

describe("what stops a day being sent", () => {
  it("lets a complete day through", () => {
    expect(problemsWith(entry())).toEqual([]);
    expect(canSend(entry())).toBe(true);
  });

  it("refuses a day with no work on it", () => {
    expect(problemsWith(entry({ jobs: [] }))).toContain("צריך לפרט לפחות עבודה אחת.");
  });

  it("refuses a job with no name", () => {
    expect(problemsWith(entry({ jobs: [job({ name: "  " })] })))
      .toContain("עבודה 1: חסר שם העבודה.");
  });

  it("demands hours for an event, because that is what it is paid on", () => {
    expect(problemsWith(entry({ jobs: [job({ from: "", to: "" })] })))
      .toContain("עבודה 1: ליווי אירוע מחייב שעת התחלה וסיום.");
  });

  it("asks nothing about hours for fixed-price work", () => {
    const e = entry({ jobs: [{ id: "f", name: "סקר נגישות", kind: "fixed" }] });
    expect(problemsWith(e)).toEqual([]);
    expect(canSend(e)).toBe(true);
  });

  it("refuses an event that starts and ends at the same minute", () => {
    expect(problemsWith(entry({ jobs: [job({ from: "17:00", to: "17:00" })] })))
      .toContain("עבודה 1: שעת ההתחלה והסיום זהות.");
  });

  it("refuses being in two places at once", () => {
    const e = entry({
      jobs: [
        job({ id: "a", from: "17:00", to: "20:00" }),
        job({ id: "b", from: "19:00", to: "21:00" }),
      ],
    });
    expect(problemsWith(e)).toContain("עבודה 1 ועבודה 2 חופפות בשעות.");
  });

  it("allows two events that only touch at their edges", () => {
    const e = entry({
      jobs: [
        job({ id: "a", from: "17:00", to: "19:00" }),
        job({ id: "b", from: "19:00", to: "21:00" }),
      ],
    });
    expect(problemsWith(e)).toEqual([]);
  });

  it("does not call two fixed-price jobs an overlap", () => {
    // They have no hours, so they cannot clash — and a day can hold several.
    const e = entry({
      jobs: [
        { id: "a", name: "סקר א", kind: "fixed" },
        { id: "b", name: "סקר ב", kind: "fixed" },
      ],
    });
    expect(problemsWith(e)).toEqual([]);
  });

  it("refuses a day with no date", () => {
    expect(problemsWith(entry({ date: "" }))).toContain("חסר תאריך.");
  });
});

describe("the message that is sent", () => {
  const full = entry({
    jobs: [
      job({ id: "a", name: "פסטיבל אור ראשון", place: "פארק רעננה", from: "17:00", to: "20:30" }),
      { id: "b", name: "בדיקת נגישות גן שקד", kind: "fixed", place: "רחובות" },
    ],
    note: "נסיעה נוספת לאיסוף ציוד",
  });

  it("names the day and the person", () => {
    expect(emailSubject(full, "זיו")).toBe("דיווח עבודה 23.11.2026 — זיו");
  });

  it("lists the event with its hours", () => {
    const body = emailBody(full, "זיו");
    expect(body).toContain("פסטיבל אור ראשון, פארק רעננה — 17:00–20:30 (3:30)");
  });

  it("totals only the hours that are paid by the hour", () => {
    expect(emailBody(full, "זיו")).toContain('סה"כ שעות לתשלום: 3:30');
  });

  it("lists fixed-price work separately, with no hours beside it", () => {
    const body = emailBody(full, "זיו");
    const fixedPart = body.slice(body.indexOf("עבודות במחיר קבוע:"));
    expect(fixedPart).toContain("בדיקת נגישות גן שקד — רחובות");
    expect(fixedPart).not.toMatch(/\d\d:\d\d/);
  });

  it("leaves out the hours section entirely on a fixed-price day", () => {
    const body = emailBody(entry({ jobs: [{ id: "f", name: "סקר", kind: "fixed" }] }), "רז");
    expect(body).not.toContain('סה"כ שעות לתשלום');
    expect(body).toContain("עבודות במחיר קבוע:");
  });

  it("carries the note when there is one", () => {
    expect(emailBody(full, "זיו")).toContain("הערות: נסיעה נוספת לאיסוף ציוד");
  });

  it("builds a mail link the phone can open", () => {
    const url = mailtoUrl("office@example.test", "נושא", "גוף");
    expect(url.startsWith("mailto:office%40example.test?subject=")).toBe(true);
    expect(url).toContain("&body=");
  });
});

describe("months and days", () => {
  it("adds up a month's payable hours and ignores other months", () => {
    const entries = [
      entry({ id: "a", date: "2026-11-23", jobs: [job({ from: "17:00", to: "20:00" })] }),
      entry({ id: "b", date: "2026-11-24", jobs: [job({ from: "18:00", to: "19:30" })] }),
      entry({ id: "c", date: "2026-10-30", jobs: [job({ from: "08:00", to: "18:00" })] }),
    ];
    expect(minutesInMonth(entries, "2026-11")).toBe(180 + 90);
  });

  it("puts the newest day first", () => {
    const sorted = sortEntries([
      entry({ id: "old", date: "2026-11-20" }),
      entry({ id: "new", date: "2026-11-24" }),
      entry({ id: "mid", date: "2026-11-22" }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["new", "mid", "old"]);
  });

  it("reads a date and a month the way a person writes them", () => {
    expect(formatDate("2026-11-23")).toBe("23.11.2026");
    expect(monthOf("2026-11-23")).toBe("2026-11");
    expect(formatMonth("2026-11")).toBe("נובמבר 2026");
  });

  it("starts a new day on today, with nothing on it yet", () => {
    const e = newEntry("x", Date.parse("2026-11-23T09:00:00"));
    expect(e.date).toBe("2026-11-23");
    expect(e.jobs).toEqual([]);
  });

  it("gives today in the phone's own day, not in UTC", () => {
    // Late evening here is already tomorrow in UTC; the date input must
    // still show today.
    const late = new Date(2026, 10, 23, 23, 30);
    expect(todayISO(late)).toBe("2026-11-23");
  });
});

describe("a new line on the form", () => {
  it("is fixed price by default, because most work is", () => {
    expect(newJob("j").kind).toBe("fixed");
    expect(newJob("j").from).toBeUndefined();
  });

  it("carries empty hours when it is an event, so the fields show", () => {
    expect(newJob("j", "hourly")).toMatchObject({ kind: "hourly", from: "", to: "" });
  });
});
