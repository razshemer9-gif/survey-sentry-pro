import { describe, expect, it } from "vitest";
import { anySignature } from "./report-signature";
import { SURVEY_TYPES, type ConsultantSettings } from "./types";

const settings = (formats: Record<string, string>): Pick<ConsultantSettings, "reportFormats"> => ({
  reportFormats: Object.fromEntries(
    Object.entries(formats).map(([id, signatureImage]) => [id, { surveyType: id, signatureImage }]),
  ) as ConsultantSettings["reportFormats"],
});

describe("anySignature", () => {
  // The report that printed blank: the stamp was set, just under a different
  // report type's tab.
  it("finds a stamp set under another report type", () => {
    expect(anySignature(settings({ general_safety: "stamp" }))).toBe("stamp");
    expect(anySignature(settings({ education_safety: "stamp" }))).toBe("stamp");
  });

  it("has nothing to offer when no stamp was ever set", () => {
    expect(anySignature({})).toBeUndefined();
    expect(anySignature({ reportFormats: {} })).toBeUndefined();
    expect(anySignature(settings({ general_safety: "" }))).toBeUndefined();
  });

  // Two stamps must not make the same report print a different one each time.
  it("picks the same one every time", () => {
    const s = settings({ risk_survey: "second", accessibility: "first" });
    expect(anySignature(s)).toBe(anySignature(s));
    expect(anySignature(s)).toBe("first");
  });

  it("looks under every report type there is", () => {
    for (const { id } of SURVEY_TYPES) {
      expect(anySignature(settings({ [id]: "s" })), id).toBe("s");
    }
  });
});
