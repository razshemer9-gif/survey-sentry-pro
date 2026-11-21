import { describe, expect, it } from "vitest";
import {
  canSend, emailBody, emailSubject, entryMinutes, formatDate, formatMinutes,
  mailtoUrl, minutesInMonth, problemsWith, sortEntries, visitMinutes,
  type WorkHoursEntry,
} from "./work-hours";

/**
 * The rules that decide whether a claim for overtime can be sent.
 *
 * The whole value of this screen is that the hours can be checked against
 * where the consultant actually was, so the tests that matter are the ones
 * that stop an entry nobody could check: no sites, a site with no name,
 * hours missing, or hours that say the consultant was in two places at once.
 */

const entry = (over: Partial<WorkHoursEntry> = {}): WorkHoursEntry => ({
  id: "e-1",
  date: "2026-11-21",
  visits: [{ id: "v-1", place: "בית ספר אורנים", from: "17:00", to: "19:30" }],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe("how long the work took", () => {
  it("counts the hours between two times", () => {
    expect(visitMinutes({ from: "17:00", to: "19:30" })).toBe(150);
    expect(visitMinutes({ from: "08:15", to: "08:45" })).toBe(30);
  });

  it("counts an evening that ran past midnight", () => {
    // A survey that finishes at half past midnight is an ordinary evening,
    // not a typing mistake, and it must not come out negative.
    expect(visitMinutes({ from: "22:00", to: "00:30" })).toBe(150);
    expect(visitMinutes({ from: "23:45", to: "01:15" })).toBe(90);
  });

  it("counts nothing where the times are not filled in", () => {
    expect(visitMinutes({ from: "", to: "19:00" })).toBe(0);
    expect(visitMinutes({ from: "25:00", to: "26:00" })).toBe(0);
    expect(visitMinutes({ from: "7:00", to: "9:00" })).toBe(0);  // needs 07:00
  });

  it("adds the visits up", () => {
    expect(entryMinutes(entry({
      visits: [
        { id: "a", place: "א", from: "17:00", to: "18:00" },
        { id: "b", place: "ב", from: "18:30", to: "20:15" },
      ],
    }))).toBe(60 + 105);
  });

  it("reads as a timesheet reads", () => {
    expect(formatMinutes(150)).toBe("2:30");
    expect(formatMinutes(60)).toBe("1:00");
    expect(formatMinutes(5)).toBe("0:05");
    expect(formatMinutes(0)).toBe("0:00");
  });
});

describe("what stops an entry being sent", () => {
  it("lets a complete entry through", () => {
    expect(problemsWith(entry())).toEqual([]);
    expect(canSend(entry())).toBe(true);
  });

  it("refuses an entry with no places at all", () => {
    const problems = problemsWith(entry({ visits: [] }));
    expect(problems).toContain("צריך לפרט לפחות מקום אחד שבו ביקרת.");
    expect(canSend(entry({ visits: [] }))).toBe(false);
  });

  it("refuses a place with no name", () => {
    const problems = problemsWith(entry({
      visits: [{ id: "v", place: "   ", from: "17:00", to: "18:00" }],
    }));
    expect(problems.some((p) => p.includes("חסר שם המקום"))).toBe(true);
  });

  it("refuses a place with no hours", () => {
    const problems = problemsWith(entry({
      visits: [{ id: "v", place: "מרפאה", from: "", to: "" }],
    }));
    expect(problems.some((p) => p.includes("חסרות שעות"))).toBe(true);
  });

  it("refuses hours that last no time", () => {
    const problems = problemsWith(entry({
      visits: [{ id: "v", place: "מרפאה", from: "17:00", to: "17:00" }],
    }));
    expect(problems.some((p) => p.includes("זהות"))).toBe(true);
  });

  // The one thing no schedule can match.
  it("refuses being in two places at once", () => {
    const problems = problemsWith(entry({
      visits: [
        { id: "a", place: "א", from: "17:00", to: "19:00" },
        { id: "b", place: "ב", from: "18:00", to: "20:00" },
      ],
    }));
    expect(problems.some((p) => p.includes("חופפים"))).toBe(true);
  });

  it("allows one visit to start exactly when the last one ended", () => {
    expect(canSend(entry({
      visits: [
        { id: "a", place: "א", from: "17:00", to: "18:00" },
        { id: "b", place: "ב", from: "18:00", to: "19:00" },
      ],
    }))).toBe(true);
  });

  it("refuses an entry with no date", () => {
    expect(problemsWith(entry({ date: "" }))).toContain("חסר תאריך.");
  });

  it("names the visit that is wrong, so it can be found", () => {
    const problems = problemsWith(entry({
      visits: [
        { id: "a", place: "בסדר", from: "17:00", to: "18:00" },
        { id: "b", place: "", from: "18:00", to: "19:00" },
      ],
    }));
    expect(problems.some((p) => p.startsWith("ביקור 2"))).toBe(true);
    expect(problems.some((p) => p.startsWith("ביקור 1"))).toBe(false);
  });
});

describe("the message that goes out", () => {
  const full = entry({
    visits: [
      { id: "a", place: "בית ספר אורנים", from: "17:00", to: "19:30" },
      { id: "b", place: "גן שקד", from: "20:00", to: "21:00" },
    ],
    note: "נסיעה נוספת בבוקר",
  });

  it("says whose hours, and for which day", () => {
    expect(emailSubject(full, "רז שמר")).toBe("שעות נוספות 21.11.2026 — רז שמר");
    expect(emailSubject(full, "")).toBe("שעות נוספות 21.11.2026");
  });

  it("lists every place with its hours, and the total", () => {
    const body = emailBody(full, "רז שמר");
    expect(body).toContain("בית ספר אורנים — 17:00–19:30 (2:30)");
    expect(body).toContain("גן שקד — 20:00–21:00 (1:00)");
    expect(body).toContain('סה"כ שעות נוספות: 3:30');
    expect(body).toContain("נסיעה נוספת בבוקר");
    expect(body).toContain("תאריך: 21.11.2026");
  });

  it("leaves out an empty note rather than printing an empty label", () => {
    expect(emailBody(entry({ note: "   " }), "רז")).not.toContain("הערות");
  });

  it("builds a mailto the phone can open", () => {
    const url = mailtoUrl("office@example.test", "נושא", "שורה\nשורה");
    expect(url.startsWith("mailto:office%40example.test?subject=")).toBe(true);
    expect(url).toContain("%0A");                       // the newline survived
    expect(decodeURIComponent(url)).toContain("שורה\nשורה");
  });
});

describe("the list of entries", () => {
  it("puts the most recent day first", () => {
    const rows = [
      entry({ id: "a", date: "2026-11-01" }),
      entry({ id: "b", date: "2026-11-21" }),
      entry({ id: "c", date: "2026-11-10" }),
    ];
    expect(sortEntries(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps the later edit on top within one day", () => {
    const rows = [
      entry({ id: "a", date: "2026-11-21", updatedAt: 10 }),
      entry({ id: "b", date: "2026-11-21", updatedAt: 99 }),
    ];
    expect(sortEntries(rows).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("leaves the caller's array alone", () => {
    const rows = [entry({ id: "a", date: "2026-11-01" }), entry({ id: "b", date: "2026-11-21" })];
    sortEntries(rows);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("adds up a month", () => {
    const rows = [
      entry({ date: "2026-11-02", visits: [{ id: "x", place: "א", from: "17:00", to: "18:00" }] }),
      entry({ date: "2026-11-20", visits: [{ id: "y", place: "ב", from: "17:00", to: "19:00" }] }),
      entry({ date: "2026-10-31", visits: [{ id: "z", place: "ג", from: "17:00", to: "23:00" }] }),
    ];
    expect(minutesInMonth(rows, "2026-11")).toBe(180);
  });
});

describe("dates on screen", () => {
  it("shows the day first, as it is written here", () => {
    expect(formatDate("2026-11-21")).toBe("21.11.2026");
  });

  it("leaves anything that is not a date alone", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("בקרוב")).toBe("בקרוב");
  });
});
