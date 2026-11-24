import { describe, expect, it } from "vitest";
import { RISK_APPROVALS_DEFAULT, riskApprovals } from "./risk-survey";

/**
 * Which approvals a risk survey asks for.
 *
 * The rule that matters is the difference between "nobody has said" and
 * "somebody said none". An untouched report needs all five; a report whose
 * list was deliberately emptied needs none. Collapse the two and the
 * surveyor who just finished unticking every line watches them all come
 * back — which is the kind of bug that gets an approval onto a report
 * nobody meant to require.
 */

describe("the approvals a risk survey asks for", () => {
  it("asks for all five when nobody has said otherwise", () => {
    expect(riskApprovals({})).toEqual([...RISK_APPROVALS_DEFAULT]);
    expect(riskApprovals({ requiredApprovals: undefined })).toHaveLength(5);
  });

  it("names the five the surveyor expects", () => {
    expect(riskApprovals({})).toEqual([
      "קונסטרוקציה",
      "אישור חשמלאי בודק",
      "אישור חשמלאי מוסמך",
      "אישור טכנאי גז",
      "אישור אגרונום",
    ]);
  });

  it("asks for none when the list was deliberately emptied", () => {
    // Not the defaults: unticking every line has to stick.
    expect(riskApprovals({ requiredApprovals: [] })).toEqual([]);
  });

  it("keeps exactly what was left ticked", () => {
    const kept = ["קונסטרוקציה", "אישור טכנאי גז"];
    expect(riskApprovals({ requiredApprovals: kept })).toEqual(kept);
  });

  it("keeps an approval somebody added by hand", () => {
    const list = [...RISK_APPROVALS_DEFAULT, "אישור מכבי אש"];
    expect(riskApprovals({ requiredApprovals: list })).toContain("אישור מכבי אש");
  });

  it("hands back a list that cannot write through to the defaults", () => {
    // The caller edits what it is given; the shared constant must not move.
    const first = riskApprovals({});
    first.push("אישור שלא ביקשנו");
    expect(riskApprovals({})).toHaveLength(5);
  });
});
