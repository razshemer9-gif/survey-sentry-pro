import { describe, expect, it } from "vitest";
import {
  accessibilityScopeLabel,
  accessibilityScopeOf,
  accessibilityTitle,
  scopeChecks,
  scopeFromChecks,
} from "./accessibility-scope";
import type { SurveyReport } from "./types";

describe("accessibilityScopeOf", () => {
  it("reads the scope the report carries", () => {
    expect(accessibilityScopeOf({ accessibilityScope: "matos" } as SurveyReport)).toBe("matos");
    expect(accessibilityScopeOf({ accessibilityScope: "service" } as SurveyReport)).toBe("service");
  });

  it("treats a report written before the choice existed as covering both", () => {
    expect(accessibilityScopeOf({} as SurveyReport)).toBe("both");
  });
});

describe("scopeFromChecks / scopeChecks", () => {
  it("maps the two checkboxes onto a scope", () => {
    expect(scopeFromChecks(true, true)).toBe("both");
    expect(scopeFromChecks(true, false)).toBe("matos");
    expect(scopeFromChecks(false, true)).toBe("service");
  });

  it("refuses an empty pair, which is not a scope a report can have", () => {
    expect(scopeFromChecks(false, false)).toBeNull();
  });

  it("round-trips back to the boxes", () => {
    for (const scope of ["both", "matos", "service"] as const) {
      const { matos, service } = scopeChecks(scope);
      expect(scopeFromChecks(matos, service), scope).toBe(scope);
    }
  });
});

// The title goes on the cover of a report filed with a client, so both halves
// of it — the wording and which certifications it names — are pinned here.
describe("accessibilityTitle", () => {
  it("names both certifications when the consultant holds both", () => {
    expect(accessibilityTitle("both", false)).toBe('סקר נגישות מתו״ס ושירות');
    expect(accessibilityTitle("both", true)).toBe('אישור נגישות מתו״ס ושירות');
  });

  it("names only the certification the report covers", () => {
    expect(accessibilityTitle("matos", false)).toBe('סקר נגישות מתו״ס');
    expect(accessibilityTitle("service", false)).toBe("סקר נגישות שירות");
    expect(accessibilityTitle("matos", true)).toBe('אישור נגישות מתו״ס');
    expect(accessibilityTitle("service", true)).toBe("אישור נגישות שירות");
  });

  it("never claims a certification the scope excludes", () => {
    expect(accessibilityScopeLabel("matos")).not.toContain("שירות");
    expect(accessibilityScopeLabel("service")).not.toContain("מתו");
  });
});
