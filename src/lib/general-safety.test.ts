import { describe, expect, it } from "vitest";
import {
  formatValidUntil, SAFETY_CLAUSES_DEFAULT, SAFETY_CLAUSE_OPTIONAL,
  safetyClauses, splitItems,
} from "./general-safety";
import type { SurveyReport } from "./types";

const report = (over: Partial<SurveyReport> = {}): SurveyReport => ({
  id: "r", createdAt: 1, updatedAt: 1, placeName: "בית דודיקוב", clientName: "", address: "",
  surveyDate: "2026-11-22", surveyType: "general_safety", items: [], generalNotes: "",
  ...over,
} as SurveyReport);

/**
 * A report written before the clauses could be edited must print exactly
 * what it printed then. Reports are signed documents that get reissued and
 * compared against the copy a client already holds, so "the text quietly
 * changed under an old report" is the one outcome worth testing hardest.
 */
describe("the closing clauses of an old report", () => {
  it("prints the five fixed lines and the sixth, as it always did", () => {
    const clauses = safetyClauses(report());
    expect(clauses).toHaveLength(6);
    expect(clauses.slice(0, 5)).toEqual([...SAFETY_CLAUSES_DEFAULT]);
    expect(clauses[5]).toBe(SAFETY_CLAUSE_OPTIONAL);
  });

  it("leaves the sixth out when its tick box was off", () => {
    const clauses = safetyClauses(report({ selectedClauses: [] }));
    expect(clauses).toHaveLength(5);
    expect(clauses).not.toContain(SAFETY_CLAUSE_OPTIONAL);
  });

  it("keeps the sixth when its tick box was on", () => {
    expect(safetyClauses(report({ selectedClauses: [5] }))).toHaveLength(6);
  });
});

describe("the closing clauses once they have been edited", () => {
  it("prints what the consultant wrote, and nothing else", () => {
    const own = ["סעיף משלי", "ועוד אחד"];
    expect(safetyClauses(report({ safetyClauses: own }))).toEqual(own);
  });

  it("lets the list be emptied altogether", () => {
    expect(safetyClauses(report({ safetyClauses: [] }))).toEqual([]);
  });

  it("drops a clause left blank rather than printing an empty number", () => {
    expect(safetyClauses(report({ safetyClauses: ["יש", "   ", "גם"] }))).toEqual(["יש", "גם"]);
  });

  // The edited list wins outright: the old tick box has nothing to add.
  it("ignores the old tick box", () => {
    expect(safetyClauses(report({ safetyClauses: ["רק זה"], selectedClauses: [5] }))).toEqual(["רק זה"]);
  });
});

describe("how long the approval holds", () => {
  it("reads as the construction approval reads", () => {
    expect(formatValidUntil("2026-11-25T22:00")).toBe("25.11.2026 בשעה 22:00");
  });

  it("gives just the date when no hour was set", () => {
    expect(formatValidUntil("2026-11-25")).toBe("25.11.2026");
  });

  it("says nothing when the approval is not limited", () => {
    expect(formatValidUntil(undefined)).toBe("");
    expect(formatValidUntil("")).toBe("");
    expect(formatValidUntil("   ")).toBe("");
  });

  it("leaves anything that is not a date alone rather than inventing one", () => {
    expect(formatValidUntil("בקרוב")).toBe("בקרוב");
  });
});

describe("photographs that are not faults", () => {
  const items = [
    { id: "a", title: "מעקה שבור", status: "non_compliant", notes: "", estimatedCost: 0 },
    { id: "b", title: "הבמה", status: "non_compliant", notes: "", estimatedCost: 0, documentation: true },
    { id: "c", title: "דלת חירום", status: "compliant", notes: "", estimatedCost: 0 },
  ] as SurveyReport["items"];

  it("keeps them apart from the findings", () => {
    const { findings, documentation } = splitItems(report({ items }));
    expect(findings.map((i) => i.id)).toEqual(["a", "c"]);
    expect(documentation.map((i) => i.id)).toEqual(["b"]);
  });

  it("counts nothing as documentation unless it was marked", () => {
    const { documentation } = splitItems(report({ items: items.slice(0, 1) }));
    expect(documentation).toEqual([]);
  });

  it("copes with a report that has no items at all", () => {
    expect(splitItems(report({ items: [] }))).toEqual({ findings: [], documentation: [] });
  });
});
