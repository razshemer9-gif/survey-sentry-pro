import { describe, expect, it } from "vitest";
import { derivedRowText } from "./form8-derived";

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
