import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SurveyReport } from "./types";

// A stand-in for the supabase client, scripted per test. It records what was
// asked of it so the assertions can check not just the outcome but that
// nothing was written when nothing should have been.
interface Script {
  updateRows?: { id: string }[];   // what the guarded update reports back
  existing?: { device_id: string; data: SurveyReport; updated_at: number } | null;
}

const calls = {
  update: [] as Record<string, unknown>[],
  insert: [] as Record<string, unknown>[],
  lte: [] as [string, unknown][],
};

let script: Script = {};

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "me" } } }) },
    from: () => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      Object.assign(builder, {
        update(values: Record<string, unknown>) { calls.update.push(values); return chain(); },
        insert(values: Record<string, unknown>) {
          calls.insert.push(values);
          return Promise.resolve({ error: null });
        },
        select() {
          // The guarded update ends in .select("id"); the existence check
          // ends in .maybeSingle(), handled below.
          const result = Promise.resolve({ data: script.updateRows ?? [], error: null });
          return Object.assign(result, builder);
        },
        eq() { return chain(); },
        lte(column: string, value: unknown) { calls.lte.push([column, value]); return chain(); },
        maybeSingle: async () => ({ data: script.existing ?? null, error: null }),
      });
      return builder;
    },
  },
}));

const { remoteSaveReport } = await import("./reports-remote");

const report = (over: Partial<SurveyReport> = {}): SurveyReport => ({
  id: "r1", createdAt: 1000, updatedAt: 5000,
  placeName: "בית ספר", clientName: "", address: "", surveyDate: "2026-11-20",
  surveyType: "element_stability", items: [], generalNotes: "",
  ...over,
} as SurveyReport);

beforeEach(() => {
  script = {};
  calls.update = []; calls.insert = []; calls.lte = [];
});

describe("remoteSaveReport", () => {
  it("saves when the server holds nothing newer", async () => {
    script.updateRows = [{ id: "r1" }];
    const outcome = await remoteSaveReport(report());
    expect(outcome.status).toBe("saved");
    expect(calls.update).toHaveLength(1);
  });

  // The whole point: a stale copy used to be stamped with the moment it
  // reached the server, which made it look like the freshest one there was.
  it("sends the moment of the edit, not the moment of sending", async () => {
    script.updateRows = [{ id: "r1" }];
    const outcome = await remoteSaveReport(report({ updatedAt: 5000 }));
    expect(calls.update[0].updated_at).toBe(5000);
    expect(outcome.report.updatedAt).toBe(5000);
    expect(calls.lte).toEqual([["updated_at", 5000]]);
  });

  it("refuses to overwrite a report somebody else saved later", async () => {
    script.updateRows = [];                    // the guard matched nothing
    script.existing = {
      device_id: "colleague",
      updated_at: 9000,
      data: report({ updatedAt: 9000, placeName: "בית ספר — נערך במשרד" }),
    };

    const outcome = await remoteSaveReport(report({ updatedAt: 5000 }));

    expect(outcome.status).toBe("stale");
    expect(outcome.report.placeName).toBe("בית ספר — נערך במשרד");
    expect(outcome.report.updatedAt).toBe(9000);
    expect(calls.insert).toHaveLength(0);       // nothing was written
  });

  it("hands back the server's copy stamped with its owner", async () => {
    script.updateRows = [];
    script.existing = { device_id: "colleague", updated_at: 9000, data: report({ updatedAt: 9000 }) };
    const outcome = await remoteSaveReport(report({ updatedAt: 5000 }));
    expect(outcome.report.ownerId).toBe("colleague");
  });

  it("inserts a report the server has never seen", async () => {
    script.updateRows = [];
    script.existing = null;
    const outcome = await remoteSaveReport(report());
    expect(outcome.status).toBe("saved");
    expect(calls.insert).toHaveLength(1);
    expect(calls.insert[0].id).toBe("r1");
  });

  it("files a new report under its original author, not whoever sends it", async () => {
    script.updateRows = [];
    script.existing = null;
    await remoteSaveReport(report({ ownerId: "author" }));
    expect(calls.insert[0].device_id).toBe("author");
  });

  it("files a report with no recorded author under the account sending it", async () => {
    script.updateRows = [];
    script.existing = null;
    await remoteSaveReport(report());
    expect(calls.insert[0].device_id).toBe("me");
  });
});
