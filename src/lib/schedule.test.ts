import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  datesCovered, findHeader, matchJob, normaliseDate, normaliseName,
  parseSchedule, scheduleFor, scheduleRowId,
} from "./schedule";
import { readWorkbook } from "./xlsx";

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(__dirname, "../test/fixtures", name)));
}

describe("finding the columns", () => {
  it("skips a title line and finds the real header row", () => {
    const rows = [
      ["לוח זמנים יומי — נובמבר 2026", "", ""],
      ["", "", ""],
      ["תאריך", "שם האירוע", "מקום"],
      ["23/11/2026", "יריד", "רעננה"],
    ];
    expect(findHeader(rows)).toEqual({
      headerRow: 2,
      columns: { date: 0, name: 1, place: 2 },
    });
  });

  it("finds them whatever order they are in", () => {
    const rows = [["מקום", "שם העבודה", "עובד", "תאריך"]];
    expect(findHeader(rows)?.columns).toEqual({ place: 0, name: 1, employee: 2, date: 3 });
  });

  it("does not mistake a working-hours column for the job name", () => {
    // "שעות עבודה" contains the word עבודה; the time pattern must win.
    const rows = [["תאריך", "שעות עבודה", "שם האירוע"]];
    const found = findHeader(rows);
    expect(found?.columns.time).toBe(1);
    expect(found?.columns.name).toBe(2);
  });

  it("gives up rather than guess when there is no job column", () => {
    expect(findHeader([["תאריך", "הערות", "סכום"]])).toBeNull();
  });
});

describe("reading dates the way they are written here", () => {
  it("keeps a date that already arrived as a date", () => {
    expect(normaliseDate("2026-11-23")).toBe("2026-11-23");
  });

  it("reads a typed date as day first, not month first", () => {
    // 3/11 is the 3rd of November. Read the American way it would be March.
    expect(normaliseDate("3/11/2026")).toBe("2026-11-03");
    expect(normaliseDate("23.11.2026")).toBe("2026-11-23");
    expect(normaliseDate("23-11-26")).toBe("2026-11-23");
  });

  it("refuses something that is not a date", () => {
    expect(normaliseDate("סה\"כ")).toBe("");
    expect(normaliseDate("45/11/2026")).toBe("");
    expect(normaliseDate("")).toBe("");
  });
});

describe("comparing two people's spelling of one job", () => {
  it("ignores quotation marks, including the Hebrew ones", () => {
    expect(normaliseName('גן "שקד"')).toBe(normaliseName("גן שקד"));
    expect(normaliseName("בי״ס אורנים")).toBe(normaliseName("ביס אורנים"));
  });

  it("ignores spacing and dash shapes", () => {
    expect(normaliseName("פסטיבל  אור–ראשון")).toBe(normaliseName("פסטיבל אור-ראשון"));
  });
});

describe("the schedule from a real file", () => {
  it("reads every job, with its day", async () => {
    const [sheet] = await readWorkbook(fixture("schedule-strings.xlsx"));
    const schedule = parseSchedule(sheet.rows);
    expect(schedule).toHaveLength(4);
    expect(schedule[0]).toMatchObject({
      date: "2026-11-23", name: "פסטיבל אור ראשון", place: "פארק רעננה",
      employee: "זיו", time: "17:00",
    });
    expect(schedule[3]).toMatchObject({ date: "2026-11-24", name: "יריד חורף" });
  });

  it("reads a file whose dates are real date cells", async () => {
    const [sheet] = await readWorkbook(fixture("schedule-dates.xlsx"));
    const schedule = parseSchedule(sheet.rows);
    expect(schedule).toHaveLength(3);
    expect(schedule.map((s) => s.date)).toEqual(["2026-11-23", "2026-11-23", "2026-11-24"]);
  });

  it("lists the days it covers, newest first", async () => {
    const [sheet] = await readWorkbook(fixture("schedule-strings.xlsx"));
    expect(datesCovered(parseSchedule(sheet.rows))).toEqual(["2026-11-24", "2026-11-23"]);
  });

  it("offers one day's jobs on their own", async () => {
    const [sheet] = await readWorkbook(fixture("schedule-strings.xlsx"));
    const day = scheduleFor("2026-11-23", parseSchedule(sheet.rows));
    expect(day.map((s) => s.name)).toEqual([
      "פסטיבל אור ראשון", "הופעה בהיכל התרבות", "בדיקת נגישות גן שקד",
    ]);
  });
});

describe("a schedule row's identity", () => {
  it("is the same when the same schedule is sent again", () => {
    const row = { date: "2026-11-23", name: "פסטיבל אור ראשון", time: "17:00" };
    expect(scheduleRowId(row)).toBe(scheduleRowId({ ...row }));
  });

  it("survives the name being re-typed with different punctuation", () => {
    // The afternoon's corrected file must not orphan a job picked at noon.
    expect(scheduleRowId({ date: "2026-11-23", name: 'גן "שקד"', time: "" }))
      .toBe(scheduleRowId({ date: "2026-11-23", name: "גן שקד", time: "" }));
  });

  it("tells two sittings of the same job apart by their time", () => {
    expect(scheduleRowId({ date: "2026-11-23", name: "יריד", time: "10:00" }))
      .not.toBe(scheduleRowId({ date: "2026-11-23", name: "יריד", time: "18:00" }));
  });
});

describe("checking a logged job against the schedule", () => {
  const schedule = [
    { id: "a", date: "2026-11-23", name: "פסטיבל אור ראשון" },
    { id: "b", date: "2026-11-23", name: 'גן עירוני "שקד"' },
    { id: "c", date: "2026-11-24", name: "יריד חורף" },
  ];

  it("matches the same name exactly", () => {
    expect(matchJob("פסטיבל אור ראשון", "2026-11-23", schedule).kind).toBe("exact");
  });

  it("matches through quotation marks and spacing", () => {
    expect(matchJob("גן עירוני שקד", "2026-11-23", schedule).kind).toBe("exact");
  });

  it("calls a partial name close, not a match and not a miss", () => {
    const m = matchJob("פסטיבל אור", "2026-11-23", schedule);
    expect(m.kind).toBe("close");
    expect(m.row?.name).toBe("פסטיבל אור ראשון");
  });

  it("will not match a job scheduled for another day", () => {
    // The same event a day late is the thing this check exists to catch.
    expect(matchJob("יריד חורף", "2026-11-23", schedule).kind).toBe("none");
  });

  it("reports nothing rather than guessing when the day is not covered", () => {
    expect(matchJob("יריד חורף", "2026-12-01", schedule).kind).toBe("none");
  });
});
