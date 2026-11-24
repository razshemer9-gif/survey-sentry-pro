import { describe, expect, it } from "vitest";
import {
  RISK_DISCLAIMERS_DEFAULT, riskDisclaimerDrafts, riskDisclaimers,
} from "./risk-survey";

/**
 * The clauses that say what a survey is not.
 *
 * Two readers of one list. The editor needs it exactly as it is stored,
 * blank lines included, or a clause being typed would vanish between
 * keystrokes. The printed page needs it cleaned, or an empty numbered line
 * appears in a document handed to a client. Reading both from one place is
 * what keeps the numbering on screen and on paper the same.
 */

describe("the standard clauses", () => {
  it("is the set the surveyor dictated", () => {
    expect(RISK_DISCLAIMERS_DEFAULT).toHaveLength(9);
  });

  it("says the report is not a licence or an occupancy permit", () => {
    const text = RISK_DISCLAIMERS_DEFAULT.join(" ");
    expect(text).toContain("רישיון עסק");
    expect(text).toContain("אישור אכלוס");
  });

  it("says it does not promise that nothing was missed", () => {
    expect(RISK_DISCLAIMERS_DEFAULT.join(" "))
      .toContain("אין בו כדי להבטיח היעדר מוחלט של סיכונים");
  });

  it("ends every clause as a sentence", () => {
    for (const line of RISK_DISCLAIMERS_DEFAULT) expect(line.trim().endsWith(".")).toBe(true);
  });
});

describe("a report that has never been edited", () => {
  it("carries the standard clauses", () => {
    expect(riskDisclaimers({})).toEqual([...RISK_DISCLAIMERS_DEFAULT]);
  });

  it("cannot write back through them", () => {
    riskDisclaimerDrafts({}).push("סעיף שלא ביקשנו");
    expect(RISK_DISCLAIMERS_DEFAULT).toHaveLength(9);
  });
});

describe("a report whose clauses were edited", () => {
  it("keeps exactly what was left", () => {
    const kept = [RISK_DISCLAIMERS_DEFAULT[0], RISK_DISCLAIMERS_DEFAULT[4]];
    expect(riskDisclaimers({ riskDisclaimers: kept })).toEqual(kept);
  });

  it("keeps a clause written by hand", () => {
    const list = [...RISK_DISCLAIMERS_DEFAULT, "סייג מיוחד לאירוע הזה."];
    expect(riskDisclaimers({ riskDisclaimers: list })).toContain("סייג מיוחד לאירוע הזה.");
  });

  it("prints none when every clause was removed", () => {
    // Not the defaults: clearing the list has to stick, exactly as it does
    // for the approvals.
    expect(riskDisclaimers({ riskDisclaimers: [] })).toEqual([]);
  });

  it("keeps the order they were put in", () => {
    const reordered = [RISK_DISCLAIMERS_DEFAULT[2], RISK_DISCLAIMERS_DEFAULT[0]];
    expect(riskDisclaimers({ riskDisclaimers: reordered })).toEqual(reordered);
  });
});

describe("a clause still being typed", () => {
  it("survives in the editor's copy", () => {
    const half = ["סייג ראשון.", ""];
    expect(riskDisclaimerDrafts({ riskDisclaimers: half })).toEqual(half);
  });

  it("but never reaches the printed page", () => {
    expect(riskDisclaimers({ riskDisclaimers: ["סייג ראשון.", "", "   "] }))
      .toEqual(["סייג ראשון."]);
  });
});
