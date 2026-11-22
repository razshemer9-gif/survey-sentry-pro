import { describe, expect, it, vi } from "vitest";
import { currentServerBuild, shouldReload } from "./build-version";

/**
 * When the app is allowed to reload itself.
 *
 * This is the one piece of code that can take the screen away from a
 * consultant mid-sentence, so it is deliberately hard to trigger: only when
 * the server names a different build, only once for that build, never in
 * development, and never because the question could not be asked. A loop
 * here would be worse than the stale build it is meant to cure.
 */
describe("deciding to reload for a new build", () => {
  it("reloads when the server has a different build", () => {
    expect(shouldReload("b2", "a1", null)).toBe(true);
  });

  it("does nothing when the build is the one already running", () => {
    expect(shouldReload("a1", "a1", null)).toBe(false);
  });

  it("does nothing when the server could not be asked", () => {
    // Offline on site is the normal state, not a reason to do anything.
    expect(shouldReload(null, "a1", null)).toBe(false);
  });

  it("never reloads a development build", () => {
    expect(shouldReload("b2", "dev", null)).toBe(false);
  });

  it("reloads once for a given build, not again", () => {
    expect(shouldReload("b2", "a1", "b2")).toBe(false);
  });

  it("still reloads for a build newer than the one it already tried", () => {
    expect(shouldReload("c3", "a1", "b2")).toBe(true);
  });
});

describe("asking the server which build is current", () => {
  const ok = (body: unknown) => vi.fn(async () => ({
    ok: true, json: async () => body,
  })) as unknown as typeof fetch;

  it("reads the build out of the answer", async () => {
    expect(await currentServerBuild(ok({ build: "abc123" }))).toBe("abc123");
  });

  it("treats a missing or empty build as no answer", async () => {
    expect(await currentServerBuild(ok({}))).toBeNull();
    expect(await currentServerBuild(ok({ build: "" }))).toBeNull();
    expect(await currentServerBuild(ok({ build: 7 }))).toBeNull();
  });

  it("treats an error from the server as no answer", async () => {
    const bad = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await currentServerBuild(bad)).toBeNull();
  });

  it("treats being offline as no answer, not as a failure", async () => {
    const offline = vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(currentServerBuild(offline)).resolves.toBeNull();
  });

  it("asks in a way that cannot be served from a cache", async () => {
    const spy = vi.fn(async () => ({ ok: true, json: async () => ({ build: "x" }) }));
    await currentServerBuild(spy as unknown as typeof fetch);
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain("version.json?t=");
    expect((init as RequestInit).cache).toBe("no-store");
  });
});
