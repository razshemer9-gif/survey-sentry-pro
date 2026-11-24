import { describe, expect, it } from "vitest";
import { printableHazards } from "./risk-survey";
import type { ChecklistItem } from "./types";

/**
 * Which hazards reach the printed page.
 *
 * A hazard can now be written down before there is a photograph of it or a
 * word describing it — that is the point of the new button. A card still
 * being filled in must not print: an empty bordered box in a PDF handed to a
 * client reads as something that went wrong, not as work in progress.
 *
 * The function under test is the one PrintableReport actually calls, not a
 * copy of it here — a copy would keep passing while the real filter was
 * loosened.
 */

const hazard = (over: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: "h", title: "", status: "non_compliant", notes: "", estimatedCost: 0, ...over,
});

describe("which hazards are printed", () => {
  it("prints one with a photograph and a description", () => {
    const items = [hazard({ photo: "data:image/png;base64,x", fieldNotes: "אבן גדולה" })];
    expect(printableHazards(items)).toHaveLength(1);
  });

  it("prints one with only a photograph", () => {
    expect(printableHazards([hazard({ photo: "data:image/png;base64,x" })])).toHaveLength(1);
  });

  it("prints one with only a description", () => {
    // Noticed at the gate with no camera to hand: still a hazard.
    expect(printableHazards([hazard({ fieldNotes: "שער ללא נעילה" })])).toHaveLength(1);
  });

  it("leaves out one that is still blank", () => {
    expect(printableHazards([hazard()])).toHaveLength(0);
  });

  it("leaves out one whose description is only spaces", () => {
    expect(printableHazards([hazard({ fieldNotes: "   \n " })])).toHaveLength(0);
  });

  it("keeps the order of the ones it prints", () => {
    const items = [
      hazard({ id: "a", fieldNotes: "ראשון" }),
      hazard({ id: "blank" }),
      hazard({ id: "b", fieldNotes: "שני" }),
    ];
    expect(printableHazards(items).map((i) => i.id)).toEqual(["a", "b"]);
  });
});
