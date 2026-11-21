import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SurveyReport } from "./types";

/**
 * Duplicating from a list.
 *
 * The company list is built from summaries: rows with the photographs
 * stripped out, because sending everyone's pictures down to a phone is tens
 * of megabytes. Copying what the screen is holding would therefore produce
 * a report whose photographs had quietly vanished — the kind of loss nobody
 * notices until the PDF is in front of a client. So the full report is
 * fetched first, and this is the test that says so.
 */

const PHOTO = "data:image/png;base64,AAAA";

const FULL: SurveyReport = {
  id: "r-1", createdAt: 1, updatedAt: 2,
  placeName: "מרכז רפואי", clientName: "", address: "", surveyDate: "2026-11-18",
  surveyType: "accessibility", coverPhoto: PHOTO, signatureDataUrl: PHOTO,
  items: [{ id: "i-1", title: "מדרגות", status: "non_compliant", notes: "", estimatedCost: 0, photo: PHOTO }],
} as SurveyReport;

/** What the list screen holds: the same report, with the pictures gone. */
const SUMMARY: SurveyReport = {
  ...FULL, coverPhoto: undefined, signatureDataUrl: undefined,
  items: [{ id: "i-1", status: "non_compliant" } as SurveyReport["items"][number]],
};

const saved: { report: SurveyReport; dirty: boolean }[] = [];

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: "me" } } } }) } },
}));
vi.mock("./offline-db", () => ({
  getAllCachedReports: async () => [SUMMARY],
  getCachedReport: async (id: string) => (id === SUMMARY.id ? SUMMARY : undefined),
  putCachedReport: async (r: SurveyReport, dirty: boolean) => { saved.push({ report: r, dirty }); },
  getDirtyRows: async () => [],
  isDirty: async () => false,
  markDeletedLocally: async () => {},
  rowBelongsTo: () => true,
}));
vi.mock("./sync-engine", () => ({ startSyncEngine: () => {}, syncPendingReports: async () => {} }));
vi.mock("./reports-remote", () => ({
  remoteGetReport: async (id: string) => (id === FULL.id ? FULL : undefined),
  remoteListReportSummaries: async () => [SUMMARY],
  remoteListReports: async () => [],
  remoteSaveReport: async () => ({ status: "saved", report: FULL }),
  remoteDeleteReport: async () => {},
  remoteListReportAuthors: async () => ({}),
  remoteOldestOwnReports: async () => [],
}));

describe("duplicating a report the screen only holds a summary of", () => {
  beforeEach(() => { saved.length = 0; });

  it("fetches the whole report, so the copy keeps its photographs", async () => {
    const { duplicateReport } = await import("./storage");
    const copy = await duplicateReport("r-1");
    expect(copy.coverPhoto).toBe(PHOTO);
    expect(copy.signatureDataUrl).toBe(PHOTO);
    expect(copy.items[0].photo).toBe(PHOTO);
    expect(copy.items[0].title).toBe("מדרגות");
  });

  it("writes the copy, and only the copy, to the device", async () => {
    const { duplicateReport } = await import("./storage");
    const copy = await duplicateReport("r-1");
    const written = saved.filter((w) => w.report.id === copy.id);
    expect(written).toHaveLength(1);
    expect(written[0].dirty).toBe(true);           // queued to go up
    expect(copy.id).not.toBe(FULL.id);
    expect(copy.ownerId).toBe("me");

    // The original is only refreshed in the cache, never queued as a change.
    const original = saved.filter((w) => w.report.id === FULL.id);
    expect(original.every((w) => w.dirty === false)).toBe(true);
  });

  it("refuses rather than invent a report that is not there", async () => {
    const { duplicateReport } = await import("./storage");
    await expect(duplicateReport("nope")).rejects.toThrow();
  });
});
