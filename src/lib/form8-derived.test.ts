import { describe, expect, it } from "vitest";
import { derivedRowText, viewingPositionsFromText } from "./form8-derived";

// These two rows go into a חוות דעת filed with a licensing authority, so the
// wording and the count are pinned rather than assumed.
describe("derivedRowText", () => {
  it("states one adapted seat per viewing position for row 6", () => {
    expect(derivedRowText(6, 4)).toBe("4 מושבים מותאמים — אחד ליד כל מקום צפייה מיוחד.");
    expect(derivedRowText(6, 1)).toBe("1 מושבים מותאמים — אחד ליד כל מקום צפייה מיוחד.");
  });

  it("states one accessible parking space per viewing position for row 7", () => {
    expect(derivedRowText(7, 12)).toBe("12 חניות נגישות — כמספר מקומות הצפייה המיוחדים.");
  });

  it("leaves every other row alone, so nothing else is auto-written", () => {
    for (const id of [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14]) {
      expect(derivedRowText(id, 4), `row ${id}`).toBeNull();
    }
  });

  it("returns null for a count that is not a usable number", () => {
    expect(derivedRowText(6, 0)).toBeNull();
    expect(derivedRowText(6, -3)).toBeNull();
    expect(derivedRowText(7, Number.NaN)).toBeNull();
  });
});

// The count is read back from row 4's own text, so what the consultant
// actually types there has to come out right.
describe("viewingPositionsFromText", () => {
  it("reads a bare count", () => {
    expect(viewingPositionsFromText("6")).toBe(6);
    expect(viewingPositionsFromText(" 13 ")).toBe(13);
  });

  it("reads the count out of a written answer", () => {
    expect(viewingPositionsFromText("נדרשות 6 עמדות צפייה מיוחדות")).toBe(6);
    expect(viewingPositionsFromText("נדרשות 13 עמדות צפייה מיוחדות (לפי 700 מקומות ישיבה).")).toBe(13);
  });

  it("returns null when the row holds no count yet", () => {
    expect(viewingPositionsFromText("")).toBeNull();
    expect(viewingPositionsFromText("טרם נקבע")).toBeNull();
    expect(viewingPositionsFromText("0")).toBeNull();
  });
});
