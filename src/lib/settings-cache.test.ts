import { beforeEach, describe, expect, it } from "vitest";
import { cacheSettings, cachedSettings, resolveSettings, settingsCacheKey } from "./settings-cache";
import { DEFAULT_SETTINGS, type ConsultantSettings } from "./types";

const withStamp = (stamp: string): ConsultantSettings => ({
  ...DEFAULT_SETTINGS,
  companyName: "שמר בטיחות יועצים",
  reportFormats: { education_safety: { surveyType: "education_safety", signatureImage: stamp } },
});

describe("resolveSettings", () => {
  it("uses the server's copy when it answered", () => {
    const remote = withStamp("fresh");
    expect(resolveSettings(remote, withStamp("old")).reportFormats?.education_safety?.signatureImage).toBe("fresh");
  });

  // The report that printed without a stamp: the read failed and nothing was
  // left to fall back to.
  it("keeps signing with the copy it has when the read fails", () => {
    const s = resolveSettings(null, withStamp("kept"));
    expect(s.reportFormats?.education_safety?.signatureImage).toBe("kept");
    expect(s.companyName).toBe("שמר בטיחות יועצים");
  });

  it("falls back to the defaults only when there is nothing at all", () => {
    expect(resolveSettings(null, null)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings(undefined, undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("fills in anything a stored copy predates", () => {
    const old = { companyName: "שמר" } as ConsultantSettings;
    expect(resolveSettings(null, old)).toEqual({ ...DEFAULT_SETTINGS, companyName: "שמר" });
  });
});

describe("the copy itself", () => {
  beforeEach(() => localStorage.clear());

  it("comes back as it went in", () => {
    cacheSettings("user-a", withStamp("a"));
    expect(cachedSettings("user-a")?.reportFormats?.education_safety?.signatureImage).toBe("a");
  });

  // A shared device must never sign one consultant's report with another's
  // stamp.
  it("is kept apart per account", () => {
    cacheSettings("user-a", withStamp("a"));
    cacheSettings("user-b", withStamp("b"));
    expect(cachedSettings("user-a")?.reportFormats?.education_safety?.signatureImage).toBe("a");
    expect(cachedSettings("user-b")?.reportFormats?.education_safety?.signatureImage).toBe("b");
    expect(settingsCacheKey("user-a")).not.toBe(settingsCacheKey("user-b"));
  });

  it("reports nothing for an account that has none", () => {
    expect(cachedSettings("nobody")).toBeNull();
  });

  it("survives a corrupted entry rather than throwing", () => {
    localStorage.setItem(settingsCacheKey("user-a"), "{not json");
    expect(cachedSettings("user-a")).toBeNull();
  });
});
