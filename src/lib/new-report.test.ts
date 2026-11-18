import { describe, expect, it, vi } from "vitest";
import type { SurveyType } from "./types";

vi.mock("./supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("./offline-db", () => ({
  getAllCachedReports: async () => [], getCachedReport: async () => undefined,
  putCachedReport: async () => {}, getDirtyRows: async () => [], isDirty: async () => false,
  markDeletedLocally: async () => {}, rowBelongsTo: () => true,
}));
vi.mock("./sync-engine", () => ({ startSyncEngine: () => {}, syncPendingReports: async () => {} }));

const { newReport } = await import("./storage");

// A report used to be built from a template the consultant had to create
// first, which is why a brand-new account could not start a survey at all:
// it was told to go to a page and make one. Every type now has its own
// starting point, built in.
describe("newReport", () => {
  it("opens an accessibility survey on the standing checklist", () => {
    const r = newReport("accessibility");
    expect(r.items.length).toBeGreaterThan(5);
    expect(r.items.every((i) => i.title)).toBe(true);
  });

  it("opens a safety survey on one empty finding, to be written on site", () => {
    for (const t of ["general_safety", "education_safety", "welfare_inspection", "element_stability"] as SurveyType[]) {
      const r = newReport(t);
      expect(r.items.length, t).toBe(1);
      expect(r.items[0].title, t).toBe("");
    }
  });

  it("opens the photo and form types with nothing in the list", () => {
    for (const t of ["risk_survey", "accessibility_form_8", "accessibility_form_8_event"] as SurveyType[]) {
      expect(newReport(t).items, t).toEqual([]);
    }
  });

  it("opens on the consultant's own saved list when the account has one", () => {
    const saved = [
      { id: "x", title: "שילוט- כניסה נגישה", status: "non_compliant" as const, notes: "",
        estimatedCost: 0, suggestedCorrection: "יוצב שילוט", standardPart: "1" },
    ];
    const r = newReport("accessibility", saved);
    expect(r.items).toEqual(saved);
  });

  it("falls back to the built-in list when the saved one is empty or absent", () => {
    const builtIn = newReport("accessibility").items.length;
    expect(newReport("accessibility", []).items.length).toBe(builtIn);
    expect(newReport("accessibility", undefined).items.length).toBe(builtIn);
  });

  it("starts every type without anything having to be set up first", () => {
    for (const t of ["accessibility", "general_safety", "education_safety", "welfare_inspection",
                     "element_stability", "risk_survey", "accessibility_form_8",
                     "accessibility_form_8_event"] as SurveyType[]) {
      expect(() => newReport(t), t).not.toThrow();
      expect(newReport(t).surveyType, t).toBe(t);
    }
  });
});
