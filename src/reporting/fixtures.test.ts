import { describe, expect, it } from "vitest";

import { FIXTURE_SIZES, FIXTURE_TYPES, makeFixture } from "./fixtures";
import { SURVEY_TYPES } from "@/lib/types";

describe("report fixtures", () => {
  it("covers every registered survey type", () => {
    expect([...FIXTURE_TYPES].sort()).toEqual(SURVEY_TYPES.map((t) => t.id).sort());
  });

  it("builds a report for every type and size", () => {
    for (const type of FIXTURE_TYPES) {
      for (const size of FIXTURE_SIZES) {
        const r = makeFixture(type, size);
        expect(r.surveyType).toBe(type);
        expect(r.id).toBe(`fixture-${type}-${size}`);
        expect(r.surveyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Array.isArray(r.items)).toBe(true);
      }
    }
  });

  it("scales content up across the three sizes", () => {
    for (const type of FIXTURE_TYPES) {
      const short = makeFixture(type, "short").items.length;
      const normal = makeFixture(type, "normal").items.length;
      const stress = makeFixture(type, "stress").items.length;
      expect(short).toBeLessThan(normal);
      expect(normal).toBeLessThan(stress);
    }
  });

  it("gives every item the fields the renderers read", () => {
    const items = makeFixture("education_safety", "stress").items;
    expect(items.length).toBeGreaterThan(20);
    for (const i of items) {
      expect(i.id).toBeTruthy();
      expect(i.title).toBeTruthy();
      expect(typeof i.estimatedCost).toBe("number");
      expect(["compliant", "non_compliant", "not_applicable", "pending"]).toContain(i.status);
    }
  });

  it("exercises the stress case with photos, for pagination coverage", () => {
    const withPhotos = makeFixture("risk_survey", "stress").items.filter((i) => i.photo);
    expect(withPhotos.length).toBeGreaterThan(20);
  });
});
