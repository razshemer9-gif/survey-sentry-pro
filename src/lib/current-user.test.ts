import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One answer to "who is signed in", bounded, used by everything.
 *
 * A single outage produced four separate failures from this one question
 * being asked four different ways, each waiting for ever: a save button
 * stuck on "שומר...", every consultant thrown out of the app, an owner
 * demoted to an employee, and nothing saving at all. The reason to put it
 * in one place is so there is one thing to get right — and one thing to
 * test.
 */

const SESSION_KEY = "sb-dkbujtvotivpqyomyhnf-auth-token";
let hangs = false;
let serverUser: { id: string } | null = { id: "u-server" };

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => {
        if (hangs) await new Promise(() => { /* never answers */ });
        return { data: { session: serverUser ? { user: serverUser } : null } };
      },
    },
  },
}));

const { currentUserId, requireUserId, USER_LOOKUP_DEADLINE_MS } =
  await import("./current-user");

beforeEach(() => {
  hangs = false;
  serverUser = { id: "u-server" };
  localStorage.clear();
});

describe("asking who is signed in", () => {
  it("takes the server's answer when it gives one", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { id: "u-device" } }));
    await expect(currentUserId()).resolves.toBe("u-server");
  });

  it("falls back to the device when the server never answers", async () => {
    vi.useFakeTimers();
    hangs = true;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { id: "u-device" } }));

    const asking = currentUserId();
    await vi.advanceTimersByTimeAsync(USER_LOOKUP_DEADLINE_MS + 100);
    await expect(asking).resolves.toBe("u-device");
    vi.useRealTimers();
  });

  it("answers within its deadline, whatever the server does", async () => {
    vi.useFakeTimers();
    hangs = true;

    const asking = currentUserId();
    let settled = false;
    void asking.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(USER_LOOKUP_DEADLINE_MS - 500);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    await asking;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("says nobody when neither the server nor the device knows", async () => {
    vi.useFakeTimers();
    hangs = true;

    const asking = currentUserId();
    await vi.advanceTimersByTimeAsync(USER_LOOKUP_DEADLINE_MS + 100);
    await expect(asking).resolves.toBeNull();
    vi.useRealTimers();
  });

  it("reports a signed-out account as signed out, not as the device's memory", async () => {
    // The server answered, and its answer was "nobody". That is a real
    // answer and it wins; the fallback is only for silence.
    serverUser = null;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { id: "u-device" } }));
    await expect(currentUserId()).resolves.toBeNull();
  });
});

describe("when a caller cannot work without a name", () => {
  it("hands it over when there is one", async () => {
    await expect(requireUserId()).resolves.toBe("u-server");
  });

  it("fails rather than waits when there is none", async () => {
    vi.useFakeTimers();
    hangs = true;

    const asking = requireUserId();
    const assertion = expect(asking).rejects.toThrow("משתמש לא מחובר");
    await vi.advanceTimersByTimeAsync(USER_LOOKUP_DEADLINE_MS + 100);
    await assertion;
    vi.useRealTimers();
  });
});
