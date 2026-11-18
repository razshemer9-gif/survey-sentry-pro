import { describe, expect, it } from "vitest";
import { isOutOfSpace, MAX_EVICTIONS_PER_SAVE, pickEviction } from "./storage-pressure";

describe("isOutOfSpace", () => {
  it("recognises the Postgres codes that mean there is no room", () => {
    expect(isOutOfSpace({ code: "53100", message: "could not extend file" })).toBe(true);
    expect(isOutOfSpace({ code: "53200", message: "out of memory" })).toBe(true);
    expect(isOutOfSpace({ code: "25006", message: "cannot execute INSERT in a read-only transaction" })).toBe(true);
  });

  it("recognises the wording when no code comes with it", () => {
    expect(isOutOfSpace({ message: "cannot execute UPDATE in a read-only transaction" })).toBe(true);
    expect(isOutOfSpace({ message: "The project is in read-only mode" })).toBe(true);
    expect(isOutOfSpace({ message: "No space left on device" })).toBe(true);
  });

  // The cost of a false positive here is somebody's report, so these matter
  // more than the ones above.
  it("does not fire on anything else that can fail a save", () => {
    for (const error of [
      { code: "42501", message: "new row violates row-level security policy" },
      { code: "23505", message: "duplicate key value violates unique constraint" },
      { code: "57014", message: "canceling statement due to statement timeout" },
      { message: "Failed to fetch" },
      { message: "TypeError: NetworkError when attempting to fetch resource" },
      { message: "Rate limit exceeded, too many requests" },
      { message: "Request quota exceeded for this API key" },
      { message: "JWT expired" },
      { code: "PGRST116", message: "The result contains 0 rows" },
    ]) {
      expect(isOutOfSpace(error), JSON.stringify(error)).toBe(false);
    }
  });

  it("does not fire on nothing at all", () => {
    expect(isOutOfSpace(null)).toBe(false);
    expect(isOutOfSpace(undefined)).toBe(false);
    expect(isOutOfSpace("read-only transaction")).toBe(false);
    expect(isOutOfSpace({})).toBe(false);
  });
});

describe("pickEviction", () => {
  const candidates = [
    { id: "new", updatedAt: 3000, name: "חדש" },
    { id: "old", updatedAt: 1000, name: "ישן" },
    { id: "middle", updatedAt: 2000, name: "אמצע" },
  ];

  it("takes the report written to longest ago", () => {
    expect(pickEviction(candidates, [])?.id).toBe("old");
  });

  it("never takes one that is still waiting to be sent, or the one being saved", () => {
    expect(pickEviction(candidates, ["old"])?.id).toBe("middle");
    expect(pickEviction(candidates, ["old", "middle"])?.id).toBe("new");
  });

  it("returns nothing rather than take something it was told to protect", () => {
    expect(pickEviction(candidates, ["old", "middle", "new"])).toBeNull();
    expect(pickEviction([], [])).toBeNull();
  });

  it("treats a missing timestamp as the oldest there is", () => {
    const withMissing = [...candidates, { id: "undated", updatedAt: undefined as unknown as number }];
    expect(pickEviction(withMissing, [])?.id).toBe("undated");
  });

  it("will not empty an account over one save", () => {
    expect(MAX_EVICTIONS_PER_SAVE).toBeLessThanOrEqual(10);
    expect(MAX_EVICTIONS_PER_SAVE).toBeGreaterThan(0);
  });
});
