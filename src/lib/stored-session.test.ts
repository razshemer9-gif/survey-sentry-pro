import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who this device knows is signed in, without asking the server.
 *
 * The app treated a call that did not come back as "nobody is signed in".
 * During an outage that threw every consultant out of an app they were
 * signed into, and sent them to a login screen that could not let them back
 * in — because logging in needs the same server that was not answering.
 *
 * Reading the stored session is what makes "unreachable" and "signed out"
 * two different answers again.
 */

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({}),
}));

const { SESSION_STORAGE_KEY, storedSessionUser } = await import("./supabase");

const SESSION = {
  access_token: "a-token",
  user: { id: "u-1", email: "ziv@example.test", aud: "authenticated" },
};

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("the session this device holds", () => {
  it("is found under the key Supabase stores it at", () => {
    expect(SESSION_STORAGE_KEY).toMatch(/^sb-.+-auth-token$/);
  });

  it("gives back whoever is signed in", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(SESSION));
    expect(storedSessionUser()?.id).toBe("u-1");
    expect(storedSessionUser()?.email).toBe("ziv@example.test");
  });

  it("reads the older shape too, so an app that has not been reopened in a while still knows", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ currentSession: SESSION }));
    expect(storedSessionUser()?.id).toBe("u-1");
  });

  it("says nobody when nobody has signed in on this device", () => {
    expect(storedSessionUser()).toBeNull();
  });

  it("says nobody rather than throwing on a damaged entry", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "{ not json");
    expect(storedSessionUser()).toBeNull();
  });

  it("says nobody when the entry carries no user", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ access_token: "a" }));
    expect(storedSessionUser()).toBeNull();
  });

  it("survives storage being unavailable, as in a private window", () => {
    vi.stubGlobal("localStorage", {
      getItem() { throw new Error("storage is blocked here"); },
    });
    expect(storedSessionUser()).toBeNull();
  });
});
