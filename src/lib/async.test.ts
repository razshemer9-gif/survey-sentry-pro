import { describe, expect, it, vi } from "vitest";
import { TimeoutError, withDeadline, withTimeout } from "./async";

/**
 * A save has to end in an answer.
 *
 * The settings save had no deadline at all, so a request that never settled
 * — which is what a phone gets when the server stops answering mid-flight —
 * left the button saying "שומר..." until the screen was closed. Neither
 * done nor failed, and nothing the person could do about it.
 */

describe("waiting with a deadline", () => {
  it("gives back the answer when it arrives in time", async () => {
    await expect(withDeadline(Promise.resolve("נשמר"), 1000)).resolves.toBe("נשמר");
  });

  it("fails when the answer never comes", async () => {
    vi.useFakeTimers();
    const stuck = new Promise(() => { /* never settles, like a dropped request */ });
    const race = withDeadline(stuck, 30_000, "השרת לא השיב");
    const assertion = expect(race).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    vi.useRealTimers();
  });

  it("carries the reason, so the screen can say which failure it was", async () => {
    vi.useFakeTimers();
    const race = withDeadline(new Promise(() => {}), 100, "השרת לא השיב");
    const assertion = expect(race).rejects.toThrow("השרת לא השיב");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    vi.useRealTimers();
  });

  it("passes a real failure through as itself, not as a timeout", async () => {
    const refused = new Error("permission denied");
    await expect(withDeadline(Promise.reject(refused), 1000)).rejects.toBe(refused);
  });

  it("does not hold a timer open after the work is done", async () => {
    // Left running, every save would keep the page awake for its full
    // deadline after already succeeding.
    vi.useFakeTimers();
    await withDeadline(Promise.resolve(1), 30_000);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe("the difference between the two helpers", () => {
  it("withTimeout answers with a fallback — right for a read", async () => {
    vi.useFakeTimers();
    const race = withTimeout(new Promise<string[]>(() => {}), 100, []);
    await vi.advanceTimersByTimeAsync(100);
    await expect(race).resolves.toEqual([]);
    vi.useRealTimers();
  });

  it("withDeadline refuses to — a write must never resolve to nothing", async () => {
    // Were a save to come back with a fallback, the screen would say it had
    // been stored when the server had never heard of it.
    vi.useFakeTimers();
    const race = withDeadline(new Promise(() => {}), 100);
    const assertion = expect(race).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    vi.useRealTimers();
  });
});
