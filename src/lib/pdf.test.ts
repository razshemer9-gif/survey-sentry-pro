import { describe, expect, it } from "vitest";
import { sanitizeFileNamePart } from "./pdf";

// Guards against the mojibake reported in saved reports: file names came out as
// "��סקר-בטיחות…" and sometimes failed to save, because the old filter kept the
// entire Hebrew Unicode block rather than just Hebrew letters.
describe("sanitizeFileNamePart", () => {
  it("keeps ordinary Hebrew, Latin, digits and separators", () => {
    expect(sanitizeFileNamePart("שבט סופה - סתריה")).toBe("שבט סופה - סתריה");
    expect(sanitizeFileNamePart("Beit Sefer 12_A")).toBe("Beit Sefer 12_A");
  });

  it("removes gershayim and geresh instead of leaving them in the file name", () => {
    expect(sanitizeFileNamePart("שבט רמג״ה")).toBe("שבט רמגה");
    expect(sanitizeFileNamePart("מוס״ח שבטי צופים")).toBe("מוסח שבטי צופים");
    expect(sanitizeFileNamePart("ז׳בוטינסקי")).toBe("זבוטינסקי");
  });

  it("removes curly quotes, which paste in from documents", () => {
    expect(sanitizeFileNamePart("מוס”ח")).toBe("מוסח");
    expect(sanitizeFileNamePart('בי"ס "אלון"')).toBe("ביס אלון");
  });

  it("strips niqqud and cantillation, which are invisible but corrupt the name", () => {
    expect(sanitizeFileNamePart("בֵּית סֵפֶר")).toBe("בית ספר");
  });

  it("strips bidi and zero-width controls", () => {
    expect(sanitizeFileNamePart("‏שבט‎ סופה​")).toBe("שבט סופה");
  });

  it("normalises Hebrew maqaf and dashes to a plain hyphen", () => {
    expect(sanitizeFileNamePart("בית־ספר")).toBe("בית-ספר");
    expect(sanitizeFileNamePart("סופה — סתריה")).toBe("סופה - סתריה");
  });

  it("collapses the runs its substitutions can create", () => {
    expect(sanitizeFileNamePart("שבט   סופה")).toBe("שבט סופה");
    expect(sanitizeFileNamePart("שבט---סופה")).toBe("שבט-סופה");
    expect(sanitizeFileNamePart("  -שבט-  ")).toBe("שבט");
  });

  it("returns an empty string when nothing usable is left, so callers can fall back", () => {
    expect(sanitizeFileNamePart("")).toBe("");
    expect(sanitizeFileNamePart("״׳־")).toBe("");
    expect(sanitizeFileNamePart("🏗️🚧")).toBe("");
  });

  it("leaves no character that would need escaping in a file name", () => {
    const nasty = 'שבט רמג״ה / test\\ 12:34 *?"<>| ‏';
    expect(sanitizeFileNamePart(nasty)).toMatch(/^[א-תa-zA-Z0-9 _-]*$/);
  });
});

// Every report type flows through the same builder, so a fix here covers all
// of them — this pins that down rather than assuming it.
describe("buildPdfFileName across all report types", () => {
  const PREFIXES = [
    "סקר-נגישות", "סקר-בטיחות-חינוך", "סקר-בטיחות", "מבדק-רווחה",
    "דוח-יציבות-אלמנטים", "סקר-סיכונים", "טופס-8-חוות-דעת-נגישות",
  ];
  const SAFE = /^[א-תa-zA-Z0-9 _.-]+$/;

  it("produces a clean name for every type, even with a hostile place name", () => {
    for (const prefix of PREFIXES) {
      const name = `${sanitizeFileNamePart(prefix)}-${sanitizeFileNamePart('מוס״ח בֵּית‏ ספר "אלון"') || "report"}-2026-08-23.pdf`;
      expect(name, prefix).toMatch(SAFE);
      expect(name, prefix).not.toMatch(/[֐-׏׳״]/); // no niqqud or Hebrew punctuation
    }
  });

  it("leaves every type's own prefix untouched", () => {
    for (const prefix of PREFIXES) {
      expect(sanitizeFileNamePart(prefix)).toBe(prefix);
    }
  });
});
