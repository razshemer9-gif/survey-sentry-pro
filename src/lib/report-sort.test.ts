import { describe, expect, it } from "vitest";
import { arrangeReports } from "./report-sort";
import { nextMark, markLabel, matchesMark, markColor } from "./report-mark";
import type { SurveyReport, SurveyType } from "./types";

/**
 * Finding one report among two hundred and fifty.
 *
 * Sorting and filtering are the whole reason the list screen exists now
 * that Home no longer carries reports, and they are exactly the kind of
 * thing a glance cannot check: a sort that drops reports with no date, or
 * a type filter that reads a legacy report as a mismatch, looks fine until
 * the one report somebody needs is the one that is missing.
 */

const r = (
  id: string,
  over: Partial<SurveyReport> = {},
): SurveyReport => ({
  id, createdAt: 1_000, updatedAt: 2_000, placeName: id, clientName: "", address: "",
  surveyDate: "2026-11-18", surveyType: "accessibility", items: [], generalNotes: "",
  ...over,
} as SurveyReport);

const names = (rows: SurveyReport[]) => rows.map((x) => x.placeName);
const all = (over: Partial<Parameters<typeof arrangeReports>[1]> = {}) =>
  ({ query: "", sort: "updated" as const, mark: "all" as const, ...over });
const fields = (x: SurveyReport) => [x.placeName, x.address];

describe("ordering the list", () => {
  const rows = [
    r("בית ספר", { updatedAt: 300, createdAt: 10, surveyType: "education_safety" as SurveyType }),
    r("מרפאה",  { updatedAt: 100, createdAt: 90, surveyType: "accessibility" as SurveyType }),
    r("אולם",   { updatedAt: 200, createdAt: 50, surveyType: "accessibility" as SurveyType }),
  ];

  it("puts the most recently touched first, by default", () => {
    expect(names(arrangeReports(rows, all(), fields))).toEqual(["בית ספר", "אולם", "מרפאה"]);
  });

  it("orders by when they were started", () => {
    expect(names(arrangeReports(rows, all({ sort: "created" }), fields))).toEqual(["מרפאה", "אולם", "בית ספר"]);
  });

  it("orders by name, in Hebrew", () => {
    expect(names(arrangeReports(rows, all({ sort: "name" }), fields))).toEqual(["אולם", "בית ספר", "מרפאה"]);
  });

  it("groups by survey type, newest first inside each", () => {
    const out = names(arrangeReports(rows, all({ sort: "type" }), fields));
    // The groups run in the Hebrew order of their names, whatever that is;
    // what matters is that each group is whole and ordered within itself.
    const accessibility = [out.indexOf("אולם"), out.indexOf("מרפאה")];
    expect(Math.abs(accessibility[0] - accessibility[1])).toBe(1);
    expect(accessibility[0]).toBeLessThan(accessibility[1]);  // אולם is newer
    expect(out).toHaveLength(3);
  });

  it("does not drop a report with no dates at all", () => {
    const odd = [...rows, r("ללא תאריכים", { updatedAt: undefined, createdAt: undefined })];
    for (const sort of ["updated", "created", "name", "type"] as const) {
      expect(arrangeReports(odd, all({ sort }), fields)).toHaveLength(4);
    }
  });

  it("leaves the caller's array alone", () => {
    const before = names(rows);
    arrangeReports(rows, all({ sort: "name" }), fields);
    expect(names(rows)).toEqual(before);
  });
});

describe("narrowing the list", () => {
  const rows = [
    r("אולם", { surveyType: "accessibility" as SurveyType, mark: "green" }),
    r("מרפאה", { surveyType: "welfare_inspection" as SurveyType, mark: "red" }),
    r("מחסן", { surveyType: "accessibility" as SurveyType }),
    r("ישן", { surveyType: undefined }),   // written before survey types existed
  ];

  it("filters by survey type, and counts a legacy report as a נגישות survey", () => {
    const out = names(arrangeReports(rows, all({ type: "accessibility" }), fields));
    expect(out.sort()).toEqual(["אולם", "ישן", "מחסן"].sort());
  });

  it("filters by the mark", () => {
    expect(names(arrangeReports(rows, all({ mark: "green" }), fields))).toEqual(["אולם"]);
    expect(names(arrangeReports(rows, all({ mark: "red" }), fields))).toEqual(["מרפאה"]);
    expect(names(arrangeReports(rows, all({ mark: "none" }), fields)).sort()).toEqual(["ישן", "מחסן"].sort());
    expect(arrangeReports(rows, all({ mark: "all" }), fields)).toHaveLength(4);
  });

  it("searches, and narrows with the filters at the same time", () => {
    const out = arrangeReports(rows, all({ query: "מ", type: "accessibility", mark: "none" }), fields);
    expect(names(out)).toEqual(["מחסן"]);
  });

  it("ignores the case and the spaces around a search", () => {
    const latin = [r("Clinic"), r("Depot")];
    expect(names(arrangeReports(latin, all({ query: "  cLiN " }), (x) => [x.placeName]))).toEqual(["Clinic"]);
  });
});

describe("the mark itself", () => {
  it("walks ללא → ירוק → אדום and round again", () => {
    expect(nextMark(undefined)).toBe("green");
    expect(nextMark("green")).toBe("red");
    expect(nextMark("red")).toBeUndefined();
  });

  it("says what it is, for a screen reader and a tooltip", () => {
    expect(markLabel(undefined)).toBe("ללא סימון");
    expect(markLabel("green")).toBe("מסומן בירוק");
    expect(markLabel("red")).toBe("מסומן באדום");
  });

  it("matches a report against a filter", () => {
    expect(matchesMark(r("x", { mark: "green" }), "green")).toBe(true);
    expect(matchesMark(r("x", { mark: "green" }), "red")).toBe(false);
    expect(matchesMark(r("x"), "none")).toBe(true);
    expect(matchesMark(r("x", { mark: "red" }), "all")).toBe(true);
  });

  it("has a colour for each theme", () => {
    expect(markColor("green", true)).not.toBe(markColor("green", false));
    expect(markColor("red", true)).toMatch(/^#/);
  });
});
