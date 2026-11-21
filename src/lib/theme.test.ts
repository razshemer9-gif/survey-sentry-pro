import { describe, expect, it } from "vitest";
import { nextPreference, readPreference, resolveTheme, savePreference } from "./theme";
import { resolveDisplayName, greeting, greetingName } from "./display-name";
import { SURVEY_COLOR_ON_DARK, surveyColor } from "./survey-colors";
import { SURVEY_TYPES } from "./types";

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

describe("theme preference", () => {
  it("follows the phone until the consultant chooses", () => {
    const store = fakeStorage();
    expect(readPreference(store)).toBe("system");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("keeps a chosen theme whatever the phone does", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("remembers the choice, and forgets it when handed back to the phone", () => {
    const store = fakeStorage();
    savePreference("dark", store);
    expect(readPreference(store)).toBe("dark");
    savePreference("system", store);
    expect(readPreference(store)).toBe("system");
    expect(store.dump()).toEqual({});
  });

  it("treats anything unexpected in storage as no choice at all", () => {
    expect(readPreference(fakeStorage({ "shemer.theme": "neon" }))).toBe("system");
    expect(readPreference(null)).toBe("system");
  });

  it("makes the toggle an explicit choice, never a return to the phone", () => {
    expect(nextPreference("dark")).toBe("light");
    expect(nextPreference("light")).toBe("dark");
  });
});

describe("what to call the person", () => {
  it("prefers a display name they set for themselves", () => {
    expect(resolveDisplayName({ displayName: "רז", consultantName: "יוסי שמר" })).toBe("רז");
  });

  it("falls back to the professional name already in their settings", () => {
    expect(resolveDisplayName({ consultantName: "יוסי שמר" })).toBe("יוסי שמר");
  });

  it("falls back to the name on the profile", () => {
    expect(resolveDisplayName({}, "זיו שמר")).toBe("זיו שמר");
  });

  // The whole point: this is what would have been on screen.
  it("never shows an e-mail address", () => {
    expect(resolveDisplayName({ displayName: "razshemer9@gmail.com" }, "someone@example.com")).toBe("");
    expect(greeting({ displayName: "razshemer9@gmail.com" })).toBe("שלום");
  });

  it("greets with one name, not three", () => {
    expect(greetingName({ consultantName: "זיו שלמה שמר" })).toBe("זיו");
    expect(greeting({ consultantName: "יוסי שמר" })).toBe("שלום יוסי");
  });

  it("says hello on its own when there is no name anywhere", () => {
    expect(greeting(null)).toBe("שלום");
    expect(greeting({ displayName: "   ", consultantName: "" }, "  ")).toBe("שלום");
  });
});

describe("survey-type colour", () => {
  it("prints with the colours the PDFs have always used", () => {
    for (const type of SURVEY_TYPES) {
      expect(surveyColor(type.id, false)).toBe(type.color);
    }
  });

  it("has a readable stand-in for every type on the dark interface", () => {
    for (const type of SURVEY_TYPES) {
      expect(SURVEY_COLOR_ON_DARK[type.id]).toMatch(/^#[0-9A-F]{6}$/);
      expect(surveyColor(type.id, true)).toBe(SURVEY_COLOR_ON_DARK[type.id]);
    }
  });

  it("clears the contrast floor on the card it sits on", () => {
    const CARD = "#182939";
    for (const type of SURVEY_TYPES) {
      expect(contrast(SURVEY_COLOR_ON_DARK[type.id], CARD)).toBeGreaterThanOrEqual(3);
    }
  });

  it("leaves the printed colours alone", () => {
    const beforeChange = SURVEY_TYPES.map((t) => t.color);
    surveyColor("general_safety", true);
    expect(SURVEY_TYPES.map((t) => t.color)).toEqual(beforeChange);
  });
});

function contrast(a: string, b: string): number {
  const l = (hex: string) => {
    const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = parts.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const [hi, lo] = [l(a), l(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
