import { describe, expect, it } from "vitest";
import { rowBelongsTo, type CachedReportRow } from "./offline-db";
import type { SurveyReport } from "./types";

const row = (userId?: string): CachedReportRow => ({
  id: "r1",
  report: { id: "r1" } as SurveyReport,
  dirty: false,
  deleted: false,
  userId,
});

// IndexedDB belongs to the site, not to whoever is signed in. A second person
// signing in on the same phone was handed the first one's reports, because the
// list merges whatever the cache holds and the cache had never been told the
// account changed.
describe("rowBelongsTo", () => {
  const OWNER = "owner-uuid";
  const EMPLOYEE = "employee-uuid";

  it("shows an account its own cached reports", () => {
    expect(rowBelongsTo(row(OWNER), OWNER)).toBe(true);
  });

  it("never shows one account another's", () => {
    expect(rowBelongsTo(row(OWNER), EMPLOYEE)).toBe(false);
    expect(rowBelongsTo(row(EMPLOYEE), OWNER)).toBe(false);
  });

  it("shows nothing at all when nobody is signed in", () => {
    expect(rowBelongsTo(row(OWNER), null)).toBe(false);
    expect(rowBelongsTo(row(undefined), null)).toBe(false);
  });

  // Rows cached before the account was recorded still carry the report, and
  // the report says who owns it. Without reading that, an edit or a deletion
  // made before the change would sit in the queue for ever — never sent,
  // because the queue is filtered by the same rule.
  describe("a row cached before the account was recorded", () => {
    const owned = (ownerId?: string): CachedReportRow => ({
      ...row(undefined),
      report: { id: "r1", ownerId } as SurveyReport,
    });

    it("falls back to the owner written on the report itself", () => {
      expect(rowBelongsTo(owned(OWNER), OWNER)).toBe(true);
      expect(rowBelongsTo(owned(OWNER), EMPLOYEE)).toBe(false);
    });

    it("belongs to nobody when the report names no owner either", () => {
      expect(rowBelongsTo(owned(undefined), OWNER)).toBe(false);
    });
  });
});
