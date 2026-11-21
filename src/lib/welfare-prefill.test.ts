import { describe, expect, it } from "vitest";
import type { ConsultantSettings } from "./types";
import { splitName, welfareInspectorPrefill } from "./welfare-prefill";

const settings = (over: Partial<ConsultantSettings> = {}): ConsultantSettings => ({
  companyName: 'יועצי נגישות מתו"ס',
  consultantName: "ישראל ישראלי",
  license: "111.22.33.44",
  phone: "050-0000000",
  email: "inspector@example.com",
  address: "",
  reportFormats: {
    welfare_inspection: {
      surveyType: "welfare_inspection",
      welfareInspectorId: "000000000",
      welfareRegistrationNum: "000000000",
      welfareQualification: "school_safety_inspector",
      welfareInspectorYearsExperience: "10",
    },
  },
  ...over,
});

describe("splitName", () => {
  it("splits a two-word name", () => {
    expect(splitName("ישראל ישראלי")).toEqual({ first: "ישראל", last: "ישראלי" });
  });

  it("keeps a middle name with the family name rather than losing it", () => {
    expect(splitName("דנה בת שבע כהן")).toEqual({ first: "דנה", last: "בת שבע כהן" });
  });

  it("copes with one word, with nothing, and with stray spacing", () => {
    expect(splitName("ישראל")).toEqual({ first: "ישראל", last: "" });
    expect(splitName("")).toEqual({ first: "", last: "" });
    expect(splitName(undefined)).toEqual({ first: "", last: "" });
    expect(splitName("  ישראל   ישראלי  ")).toEqual({ first: "ישראל", last: "ישראלי" });
  });
});

describe("welfareInspectorPrefill", () => {
  it("fills every detail the form asks for twice over", () => {
    expect(welfareInspectorPrefill(settings())).toEqual({
      welfareInspectorFirstName: "ישראל",
      welfareInspectorLastName: "ישראלי",
      welfareInspectorPhone: "050-0000000",
      welfareInspectorEmail: "inspector@example.com",
      welfareInspectorId: "000000000",
      welfareRegistrationNum: "000000000",
      welfareQualification: "school_safety_inspector",
      welfareInspectorYearsExperience: "10",
    });
  });

  // The signatory signs for the framework being inspected — a different
  // person each time, and never the inspector's own account.
  it("never fills in the signatory", () => {
    expect(welfareInspectorPrefill(settings())).not.toHaveProperty("welfareSignatoryName");
  });

  it("trims what was typed with a stray space, so one account cannot produce two spellings", () => {
    const prefill = welfareInspectorPrefill(settings({
      phone: " 050-0000000 ",
      email: " inspector@example.com ",
    }));
    expect(prefill.welfareInspectorPhone).toBe("050-0000000");
    expect(prefill.welfareInspectorEmail).toBe("inspector@example.com");
  });

  it("leaves out what the account has not got, rather than writing blanks", () => {
    const prefill = welfareInspectorPrefill({
      companyName: "", consultantName: "", license: "", phone: "", email: "", address: "",
    });
    expect(prefill).toEqual({});
  });

  it("fills the account details even when the welfare settings are untouched", () => {
    expect(welfareInspectorPrefill(settings({ reportFormats: {} }))).toEqual({
      welfareInspectorFirstName: "ישראל",
      welfareInspectorLastName: "ישראלי",
      welfareInspectorPhone: "050-0000000",
      welfareInspectorEmail: "inspector@example.com",
    });
  });

  it("gives each account its own details, not the owner's", () => {
    const ziv = welfareInspectorPrefill(settings({
      consultantName: "דנה בת שבע כהן",
      phone: "050-1111111",
      email: "second@example.com",
    }));
    expect(ziv.welfareInspectorFirstName).toBe("דנה");
    expect(ziv.welfareInspectorLastName).toBe("בת שבע כהן");
    expect(ziv.welfareInspectorPhone).toBe("050-1111111");
  });
});
