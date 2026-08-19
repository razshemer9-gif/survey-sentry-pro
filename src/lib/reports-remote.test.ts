import { describe, expect, it } from "vitest";
import { resolveOwnerId } from "./reports-remote";

// Guards a data-loss bug: admins may edit reports written by other people, and
// storing such an edit under the editor's account would move the report out of
// the author's list and into the admin's.
describe("resolveOwnerId", () => {
  const ADMIN = "admin-uuid";
  const AUTHOR = "author-uuid";

  it("keeps the original author when an admin edits their report", () => {
    expect(resolveOwnerId({ ownerId: AUTHOR }, ADMIN)).toBe(AUTHOR);
  });

  it("assigns a brand-new report to whoever creates it", () => {
    expect(resolveOwnerId({}, ADMIN)).toBe(ADMIN);
    expect(resolveOwnerId({ ownerId: undefined }, AUTHOR)).toBe(AUTHOR);
  });

  it("treats an empty owner as unset rather than as a real account", () => {
    expect(resolveOwnerId({ ownerId: "" }, ADMIN)).toBe(ADMIN);
  });

  it("is unchanged when the author saves their own report", () => {
    expect(resolveOwnerId({ ownerId: AUTHOR }, AUTHOR)).toBe(AUTHOR);
  });
});
