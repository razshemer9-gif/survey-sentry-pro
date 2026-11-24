import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SurveyReport } from "./types";

/**
 * Saving a report while the server is unreachable.
 *
 * saveReport writes to the device and lets the sync engine carry it up
 * later, so it should never have needed the network at all. But it asked
 * who was signed in first, and that question went to the server with no
 * bound on the wait. While Supabase was down, tapping a survey type spun
 * for ever and nothing could be created or saved: the local-first app was
 * held up by a question it did not need answered to do its job.
 */

const SESSION_KEY = "sb-dkbujtvotivpqyomyhnf-auth-token";
let authHangs = false;
const filedUnder: (string | null | undefined)[] = [];

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => {
        if (authHangs) await new Promise(() => { /* never answers */ });
        return { data: { session: { user: { id: "u-server" } } }, error: null };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ async single() { return { data: null, error: null }; } }) }) }),
  },
}));

vi.mock("./offline-db", () => ({
  putCachedReport: async (_r: SurveyReport, _dirty: boolean, userId?: string | null) => {
    filedUnder.push(userId);
  },
  getAllCachedReports: async () => [],
  getCachedReport: async () => undefined,
  deleteCachedReport: async () => {},
  isDirty: async () => false,
  clearCacheFor: async () => {},
  markClean: async () => {},
  putCachedReports: async () => {},
}));

vi.mock("./sync-engine", () => ({
  syncPendingReports: async () => {},
  startSyncEngine: () => {},
}));

const { saveReport } = await import("./storage");

const report = { id: "r-1", surveyType: "general_safety", items: [] } as unknown as SurveyReport;

beforeEach(() => {
  filedUnder.length = 0;
  authHangs = false;
  localStorage.clear();
});

describe("saving while the server is reachable", () => {
  it("files the report under the account the server names", async () => {
    await expect(saveReport(report)).resolves.toMatchObject({ id: "r-1" });
    expect(filedUnder).toEqual(["u-server"]);
  });
});

describe("saving while the server is unreachable", () => {
  it("still finishes, instead of waiting for ever", async () => {
    vi.useFakeTimers();
    authHangs = true;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { id: "u-device" } }));

    const saving = saveReport(report);
    let settled = false;
    void saving.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(4000);
    expect(settled).toBe(false);          // still within its deadline
    await vi.advanceTimersByTimeAsync(2000);
    await saving;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("files it under the account this device holds", async () => {
    vi.useFakeTimers();
    authHangs = true;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { id: "u-device" } }));

    const saving = saveReport(report);
    await vi.advanceTimersByTimeAsync(6000);
    await saving;
    // Not undefined: a report filed under nobody is a report its owner
    // cannot find again on this phone.
    expect(filedUnder).toEqual(["u-device"]);
    vi.useRealTimers();
  });

  it("still saves when the device knows nobody either", async () => {
    vi.useFakeTimers();
    authHangs = true;

    const saving = saveReport(report);
    await vi.advanceTimersByTimeAsync(6000);
    await expect(saving).resolves.toMatchObject({ id: "r-1" });
    expect(filedUnder).toEqual([null]);
    vi.useRealTimers();
  });
});
