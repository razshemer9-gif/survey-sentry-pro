import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SurveyReport } from "./types";

/**
 * What the Home screen waits for before it can draw.
 *
 * The old path awaited two remote calls — the list of names, then every
 * recent report in full — before returning anything at all, even though the
 * device already held a usable list. On a slow connection that was a spinner
 * for as long as both calls took, with the answer sitting in IndexedDB.
 *
 * These tests pin the two properties that matter: the cache answers without
 * touching the network, and the refresh still produces exactly what the old
 * path produced.
 */

const SUMMARY_MS = 120;   // the list of names
const PREFETCH_MS = 480;  // every recent report in full — the heavy one

const report = (id: string, updatedAt: number, extra: Partial<SurveyReport> = {}): SurveyReport => ({
  id, createdAt: 1, updatedAt, placeName: id, clientName: "", address: "",
  surveyDate: "2026-11-21", surveyType: "element_stability", items: [], generalNotes: "",
  ...extra,
} as SurveyReport);

const CACHED = [report("cached-old", 100), report("cached-new", 300)];
const SUMMARIES = [report("someone-elses", 200)];

const calls = { summaries: 0, prefetch: 0, syncStarted: 0 };

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

vi.mock("./sync-engine", () => ({
  startSyncEngine: () => { calls.syncStarted++; },
  syncPendingReports: async () => {},
}));

vi.mock("./reports-remote", () => ({
  remoteListReportSummaries: async () => {
    calls.summaries++;
    await new Promise((r) => setTimeout(r, SUMMARY_MS));
    return [...SUMMARIES];
  },
  remoteListReports: async () => {
    calls.prefetch++;
    await new Promise((r) => setTimeout(r, PREFETCH_MS));
    return [];
  },
  remoteGetReport: async () => undefined,
  remoteSaveReport: async () => ({ status: "saved" }),
  remoteDeleteReport: async () => {},
  remoteListReportAuthors: async () => ({}),
  remoteOldestOwnReports: async () => [],
  resolveOwnerId: (r: { ownerId?: string }, me: string) => r.ownerId || me,
}));

const { cachedReports, refreshReports, listReports } = await import("./storage");

beforeEach(() => { calls.summaries = 0; calls.prefetch = 0; calls.syncStarted = 0; });

describe("what the Home screen waits for", () => {
  it("answers from the device without touching the network", async () => {
    const started = Date.now();
    const reports = await cachedReports();
    const elapsed = Date.now() - started;

    expect(reports.map((r) => r.id)).toEqual(["cached-new", "cached-old"]);
    expect(calls.summaries).toBe(0);
    expect(calls.prefetch).toBe(0);
    expect(elapsed).toBeLessThan(SUMMARY_MS);
  });

  it("still starts the sync engine, so work queued offline goes up", async () => {
    await cachedReports();
    expect(calls.syncStarted).toBe(1);
  });

  it("hands over the complete list as soon as the names land, without waiting for the photographs", async () => {
    const seen: { at: number; ids: string[] }[] = [];
    const started = Date.now();

    await refreshReports((reports) => seen.push({ at: Date.now() - started, ids: reports.map((r) => r.id) }));

    expect(seen).toHaveLength(2);
    // First callback: the full list, after the names only.
    expect(seen[0].ids).toEqual(["cached-new", "someone-elses", "cached-old"]);
    expect(seen[0].at).toBeLessThan(SUMMARY_MS + PREFETCH_MS);
    // Second: after the heavy prefetch, same list.
    expect(seen[1].ids).toEqual(seen[0].ids);
  });

  it("produces the same list the blocking path produced", async () => {
    const before = await listReports();
    const after = await refreshReports();
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
  });

  it("costs the device nothing extra: one call to each endpoint per refresh", async () => {
    await refreshReports();
    expect(calls.summaries).toBe(1);
    expect(calls.prefetch).toBe(1);
  });
});
