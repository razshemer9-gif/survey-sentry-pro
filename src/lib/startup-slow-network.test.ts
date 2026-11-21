import { describe, expect, it, vi } from "vitest";
import type { SurveyReport } from "./types";

/**
 * How long the consultant waits for the reports to appear, on the kind of
 * connection a site actually has: one bar, a slow uplink, a building in the
 * way.
 *
 * The numbers below stand in for that — a list of names takes seconds, and
 * the full reports, which carry the photographs, take several more. The old
 * path awaited both before showing anything. These tests put a budget on the
 * difference so it cannot quietly come back.
 */

const SLOW_SUMMARY_MS = 2_500;   // the list of names over a weak connection
const SLOW_PREFETCH_MS = 6_000;  // the recent reports in full — megabytes

const report = (id: string, updatedAt: number): SurveyReport => ({
  id, createdAt: 1, updatedAt, placeName: id, clientName: "", address: "",
  surveyDate: "2026-11-21", surveyType: "element_stability", items: [], generalNotes: "",
} as SurveyReport);

const CACHED = [report("on-the-phone-1", 300), report("on-the-phone-2", 200)];

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: "me" } } } }) } },
}));
vi.mock("./offline-db", () => ({
  getAllCachedReports: async () => [...CACHED],
  getCachedReport: async () => undefined,
  putCachedReport: async () => {},
  getDirtyRows: async () => [],
  isDirty: async () => false,
  markDeletedLocally: async () => {},
  rowBelongsTo: () => true,
}));
vi.mock("./sync-engine", () => ({ startSyncEngine: () => {}, syncPendingReports: async () => {} }));
vi.mock("./reports-remote", () => ({
  remoteListReportSummaries: async () => {
    await new Promise((r) => setTimeout(r, SLOW_SUMMARY_MS));
    return [report("a-colleagues", 250)];
  },
  remoteListReports: async () => {
    await new Promise((r) => setTimeout(r, SLOW_PREFETCH_MS));
    return [];
  },
  remoteSaveReport: async () => ({ status: "saved", report: CACHED[0] }),
  remoteDeleteReport: async () => {},
  remoteGetReport: async () => undefined,
  remoteListReportAuthors: async () => ({}),
  remoteOldestOwnReports: async () => [],
}));

const ms = async (fn: () => Promise<unknown>) => {
  const t = performance.now();
  await fn();
  return Math.round(performance.now() - t);
};

describe("opening the app on a site with one bar of signal", () => {
  it("draws from the phone in well under a second, and the old path did not", async () => {
    const { cachedReports, listReports, refreshReports } = await import("./storage");

    const cold = await ms(cachedReports);
    let firstPaint = 0;
    const started = performance.now();
    const refreshed = refreshReports(() => {
      if (!firstPaint) firstPaint = Math.round(performance.now() - started);
    });
    const old = await ms(listReports);
    await refreshed;

    console.log(
      `\n  slow network (${SLOW_SUMMARY_MS}ms names + ${SLOW_PREFETCH_MS}ms full reports)\n` +
      `    old path, nothing on screen until:   ${old}ms\n` +
      `    new path, list on screen after:      ${cold}ms\n` +
      `    first refresh wave lands after:      ${firstPaint}ms\n`,
    );

    // The device answers without the network at all.
    expect(cold).toBeLessThan(200);
    // And it is at least an order of magnitude ahead of waiting for both calls.
    expect(old).toBeGreaterThan(cold * 10);
  }, 30_000);
});
