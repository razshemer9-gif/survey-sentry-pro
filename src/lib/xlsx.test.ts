import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { columnIndex, columnName, readWorkbook, serialToISO, writeSheet } from "./xlsx";

/**
 * These run against workbooks a real spreadsheet program wrote, not against
 * XML composed here to match the parser. That distinction is the whole value
 * of the test: a schedule arrives from whatever the office happens to use,
 * and a reader that only understands its own output would pass every test
 * and fail on the first real file.
 */
function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(__dirname, "../test/fixtures", name)));
}

describe("column references", () => {
  it("reads letters as a base-26 count with no zero", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("Z9")).toBe(25);
    expect(columnIndex("AA1")).toBe(26);
    expect(columnIndex("BC12")).toBe(54);
  });

  it("writes them back the same way", () => {
    for (const i of [0, 25, 26, 54, 701, 702]) {
      expect(columnIndex(columnName(i) + "1")).toBe(i);
    }
  });
});

describe("Excel date serials", () => {
  it("reads a serial as the day it means", () => {
    expect(serialToISO(46349)).toBe("2026-11-23");
  });

  it("handles the 1900 leap-year bug Excel kept on purpose", () => {
    // 60 is Excel's 29 February 1900, a day that did not exist; 61 is the
    // 1st of March, and from there the count agrees with a real calendar.
    expect(serialToISO(61)).toBe("1900-03-01");
    expect(serialToISO(1)).toBe("1900-01-01");
  });
});

describe("reading a workbook a spreadsheet program wrote", () => {
  it("reads text held in the shared-string table", async () => {
    const [sheet] = await readWorkbook(fixture("schedule-strings.xlsx"));
    expect(sheet.rows[1]).toEqual(["תאריך", "שעה", "שם האירוע", "מקום", "עובד"]);
    expect(sheet.rows[2][2]).toBe("פסטיבל אור ראשון");
    expect(sheet.rows[3][3]).toBe("הוד השרון");
  });

  it("keeps a row's blank cell in place instead of shifting the rest left", async () => {
    const [sheet] = await readWorkbook(fixture("schedule-strings.xlsx"));
    // This row has no time, so the event name must still be in column C.
    const row = sheet.rows[4];
    expect(row[1]).toBe("");
    expect(row[2]).toBe("בדיקת נגישות גן שקד");
    expect(row[3]).toBe("רחובות");
  });

  it("turns a real date cell into a date, not the number 46349", async () => {
    const [sheet] = await readWorkbook(fixture("schedule-dates.xlsx"));
    expect(sheet.rows[1][0]).toBe("2026-11-23");
    expect(sheet.rows[3][0]).toBe("2026-11-24");
    expect(sheet.rows[1][1]).toBe("פסטיבל אור ראשון");
  });

  it("gives every row the same width", async () => {
    const [sheet] = await readWorkbook(fixture("schedule-strings.xlsx"));
    const widths = new Set(sheet.rows.map((r) => r.length));
    expect(widths.size).toBe(1);
  });
});

describe("writing a workbook", () => {
  it("writes rows that read back as themselves", async () => {
    const rows = [
      ["עובד", "תאריך", "אירוע", "שעות"],
      ["זיו", "23.11.2026", 'פסטיבל "אור ראשון" — רעננה', "3:30"],
      ["מריס", "24.11.2026", "יריד חורף & שוק", "2:15"],
    ];
    const bytes = await writeSheet("שעות נוספות", rows);
    const [sheet] = await readWorkbook(bytes);
    expect(sheet.name).toBe("שעות נוספות");
    expect(sheet.rows).toEqual(rows);
  });

  it("keeps a time as text, so no locale turns 3:30 into a fraction", async () => {
    const bytes = await writeSheet("גיליון", [["3:30"], ["0:45"]]);
    const [sheet] = await readWorkbook(bytes);
    expect(sheet.rows).toEqual([["3:30"], ["0:45"]]);
  });

  it("survives a trailing empty cell", async () => {
    const bytes = await writeSheet("גיליון", [["א", "ב"], ["ג", ""]]);
    const [sheet] = await readWorkbook(bytes);
    expect(sheet.rows[1][0]).toBe("ג");
    expect(sheet.rows[1][1] ?? "").toBe("");
  });
});
