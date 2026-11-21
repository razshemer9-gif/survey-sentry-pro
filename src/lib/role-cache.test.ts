import { beforeEach, describe, expect, it } from "vitest";
import { cacheRole, clearCachedRole, readCachedRole } from "./role-cache";

/**
 * An owner who steps into a basement is still an owner.
 *
 * The role is read from the server on every start, and when that read
 * failed the app used to settle for "employee": דוחות החברה vanished from
 * the bar and the admin screens bounced back to Home. These keep the
 * device's memory of the answer honest.
 */
describe("remembering what this account is", () => {
  beforeEach(() => { localStorage.clear(); });

  it("gives back what was stored, for that account", () => {
    cacheRole("u-1", "owner");
    expect(readCachedRole("u-1")).toBe("owner");
  });

  it("says nothing about a different account", () => {
    cacheRole("u-1", "owner");
    expect(readCachedRole("u-2")).toBeNull();
    expect(readCachedRole(undefined)).toBeNull();
  });

  it("says nothing when nothing was stored", () => {
    expect(readCachedRole("u-1")).toBeNull();
  });

  it("forgets on request — signing out must not leave a role behind", () => {
    cacheRole("u-1", "admin");
    clearCachedRole();
    expect(readCachedRole("u-1")).toBeNull();
  });

  it("ignores a value that is not a role", () => {
    localStorage.setItem("shemer.role", JSON.stringify({ userId: "u-1", role: "superuser" }));
    expect(readCachedRole("u-1")).toBeNull();
  });

  it("ignores anything that is not the shape it wrote", () => {
    localStorage.setItem("shemer.role", "not json at all");
    expect(readCachedRole("u-1")).toBeNull();
  });
});
