import { describe, expect, it } from "vitest";
import { canPreviewEngUi } from "./eng-ui";

describe("canPreviewEngUi", () => {
  it("shows the new design to the two people trying it", () => {
    expect(canPreviewEngUi("razshemer9@gmail.com")).toBe(true);
    expect(canPreviewEngUi("ziv@shemera.co.il")).toBe(true);
  });

  it("reads an address however it was typed", () => {
    expect(canPreviewEngUi("  Ziv@Shemera.co.il ")).toBe(true);
  });

  it("keeps everyone else on the current design", () => {
    expect(canPreviewEngUi("someone@shemera.co.il")).toBe(false);
    expect(canPreviewEngUi("razshemer9@gmail.com.attacker.test")).toBe(false);
    expect(canPreviewEngUi(undefined)).toBe(false);
    expect(canPreviewEngUi(null)).toBe(false);
    expect(canPreviewEngUi("")).toBe(false);
  });
});
