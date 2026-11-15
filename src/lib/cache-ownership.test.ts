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

  // Rows cached before the account was recorded: whoever they belong to is
  // unknown, so they belong to nobody and are fetched again from the server.
  it("ignores a row that predates the account being recorded", () => {
    expect(rowBelongsTo(row(undefined), OWNER)).toBe(false);
    expect(rowBelongsTo(row(""), OWNER)).toBe(false);
  });
});
