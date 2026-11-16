import { describe, expect, it } from "vitest";
import { applyColdStart, coldStartHash } from "./cold-start";

describe("coldStartHash", () => {
  it("sends a cold start on the settings page to the reports list", () => {
    expect(coldStartHash("#/settings")).toBe("#/");
  });

  it("covers the other settings-like pages", () => {
    expect(coldStartHash("#/standards")).toBe("#/");
    expect(coldStartHash("#/admin/users")).toBe("#/");
  });

  it("ignores a trailing slash and a query string", () => {
    expect(coldStartHash("#/settings/")).toBe("#/");
    expect(coldStartHash("#/settings?tab=stamp")).toBe("#/");
  });

  it("leaves the reports list alone", () => {
    expect(coldStartHash("#/")).toBeNull();
    expect(coldStartHash("")).toBeNull();
    expect(coldStartHash("#")).toBeNull();
  });

  it("leaves a report open, so a reload mid-edit stays on it", () => {
    expect(coldStartHash("#/report/abc-123")).toBeNull();
  });

  it("leaves the sign-in page alone", () => {
    expect(coldStartHash("#/auth")).toBeNull();
  });

  it("does not match a route that merely starts with the same letters", () => {
    expect(coldStartHash("#/settings-export")).toBeNull();
  });
});

describe("applyColdStart", () => {
  it("rewrites the address in place, leaving no history entry behind", () => {
    window.history.replaceState(null, "", "/#/settings");
    applyColdStart(window.location);
    expect(window.location.hash).toBe("#/");
  });

  it("leaves a report's address untouched", () => {
    window.history.replaceState(null, "", "/#/report/abc-123");
    applyColdStart(window.location);
    expect(window.location.hash).toBe("#/report/abc-123");
  });
});
