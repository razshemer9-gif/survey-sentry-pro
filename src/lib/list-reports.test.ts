import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SurveyReport } from "./types";

// The whole list comes from the summary call. The full-report call is only a
// convenience for working offline, and must never be able to take the list
// down with it — which is exactly what it did: a new phone, with nothing
// cached, showed two reports out of two hundred and seventy-seven.
const remoteListReports = vi.fn();
const remoteListReportSummaries = vi.fn();
const cached: SurveyReport[] = [];

vi.mock("./reports-remote", () => ({
  remoteListReports: (...a: unknown[]) => remoteListReports(...a),
  remoteListReportSummaries: () => remoteListReportSummaries(),
  remoteGetReport: vi.fn(),
  remoteSaveReport: vi.fn(),
  remoteDeleteReport: vi.fn(),
  remoteListReportAuthors: vi.fn(async () => ({})),
}));
vi.mock("./offline-db", () => ({
  getAllCachedReports: async () => cached,
  getCachedReport: async () => undefined,
  putCachedReport: async () => {},
  getDirtyRows: async () => [],
  isDirty: async () => false,
  markDeletedLocally: async () => {},
}));
vi.mock("./sync-engine", () => ({ startSyncEngine: () => {}, syncPendingReports: async () => {} }));
vi.mock("./supabase", () => ({ supabase: {} }));

const report = (id: string): SurveyReport =>
  ({ id, placeName: id, items: [], updatedAt: Number(id) } as unknown as SurveyReport);

const { listReports, getLastRefreshError } = await import("./storage");

describe("listReports", () => {
  beforeEach(() => {
    cached.length = 0;
    remoteListReports.mockReset();
    remoteListReportSummaries.mockReset();
  });

  it("shows the whole list even when the full-report fetch throws", async () => {
    remoteListReports.mockRejectedValue(new Error("canceling statement due to statement timeout"));
    remoteListReportSummaries.mockResolvedValue([report("3"), report("2"), report("1")]);

    const list = await listReports();

    expect(remoteListReportSummaries).toHaveBeenCalled();
    expect(list.map((r) => r.id)).toEqual(["3", "2", "1"]);
  });

  it("asks for the list first, not after the heavy fetch", async () => {
    const order: string[] = [];
    remoteListReports.mockImplementation(async () => { order.push("full"); return []; });
    remoteListReportSummaries.mockImplementation(async () => { order.push("summaries"); return []; });

    await listReports();

    expect(order[0]).toBe("summaries");
  });

  it("only pulls a handful of reports down in full", async () => {
    remoteListReports.mockResolvedValue([]);
    remoteListReportSummaries.mockResolvedValue([]);
    await listReports();
    const [limit] = remoteListReports.mock.calls[0] as [number | undefined];
    expect(limit === undefined || limit <= 25).toBe(true);
  });

  it("says so when the list itself could not be fetched", async () => {
    remoteListReports.mockResolvedValue([]);
    remoteListReportSummaries.mockRejectedValue(new Error("offline"));
    await listReports();
    expect(getLastRefreshError()).toContain("offline");
  });

  it("keeps a cached report over its summary, and adds the rest", async () => {
    cached.push({ ...report("2"), placeName: "full copy" } as SurveyReport);
    remoteListReports.mockResolvedValue([]);
    remoteListReportSummaries.mockResolvedValue([report("3"), report("2"), report("1")]);

    const list = await listReports();

    expect(list.map((r) => r.id)).toEqual(["3", "2", "1"]);
    expect(list.find((r) => r.id === "2")?.placeName).toBe("full copy");
  });
});
