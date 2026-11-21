import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SurveyReport } from "./types";

/**
 * What a background refresh is not allowed to do.
 *
 * The consultant signs a report in a basement with no signal; the phone
 * holds it as a pending row. Minutes later the connection returns and the
 * refresh pulls the server's older copy of that same report. If that copy
 * were written into the cache, the signature made underground would be gone
 * — silently, with nothing on screen to say so.
 *
 * So: a row with unsent local work is never overwritten by the refresh, and
 * it is the local copy that the screen keeps showing.
 */

const report = (id: string, updatedAt: number, placeName: string): SurveyReport => ({
  id, createdAt: 1, updatedAt, placeName, clientName: "", address: "",
  surveyDate: "2026-11-21", surveyType: "element_stability", items: [], generalNotes: "",
} as SurveyReport);

/** On the phone, signed and not yet sent. */
const PENDING = report("r-pending", 900, "נחתם במרתף");
/** The server's older copy of the very same report. */
const SERVER_COPY = report("r-pending", 400, "לפני החתימה");

const written: SurveyReport[] = [];

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: "me" } } } }) } },
}));

vi.mock("./offline-db", () => ({
  getAllCachedReports: async () => [PENDING],
  getCachedReport: async () => PENDING,
  putCachedReport: async (r: SurveyReport) => { written.push(r); },
  getDirtyRows: async () => [PENDING],
  isDirty: async (id: string) => id === PENDING.id,
  markDeletedLocally: async () => {},
  rowBelongsTo: () => true,
}));

vi.mock("./sync-engine", () => ({
  startSyncEngine: () => {},
  syncPendingReports: async () => {},
}));

vi.mock("./reports-remote", () => ({
  remoteListReportSummaries: async () => [SERVER_COPY],
  remoteListReports: async () => [SERVER_COPY],
  remoteSaveReport: async () => ({ status: "saved", report: PENDING }),
  remoteDeleteReport: async () => {},
  remoteGetReport: async () => SERVER_COPY,
  remoteListReportAuthors: async () => ({}),
  remoteOldestOwnReports: async () => [],
}));

describe("a background refresh and a report with unsent work", () => {
  beforeEach(() => { written.length = 0; });

  it("never writes the server's copy over a pending row", async () => {
    const { refreshReports } = await import("./storage");
    await refreshReports();
    expect(written.map((r) => r.id)).not.toContain(PENDING.id);
  });

  it("keeps showing what the phone holds, not what the server has", async () => {
    const { refreshReports } = await import("./storage");
    const rows = await refreshReports();
    const shown = rows.filter((r) => r.id === PENDING.id);
    expect(shown).toHaveLength(1);
    expect(shown[0].placeName).toBe("נחתם במרתף");
    expect(shown[0].updatedAt).toBe(900);
  });

  it("shows it once, not twice, when the server lists it too", async () => {
    const { refreshReports } = await import("./storage");
    const rows = await refreshReports();
    expect(rows.filter((r) => r.id === PENDING.id)).toHaveLength(1);
  });
});
