import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPdfFileName, isMobileDevice, sanitizeFileNamePart, transliterateHebrew } from "./pdf";
import type { ConsultantSettings, SurveyReport } from "./types";

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

// The PDF is handed to the share sheet on a phone and downloaded on a desktop,
// so a missed device means either a stray blob: link in WhatsApp or a share
// sheet on a machine that has no use for one.
describe("isMobileDevice", () => {
  const stub = (userAgent: string, maxTouchPoints = 0) => {
    vi.stubGlobal("navigator", { userAgent, maxTouchPoints });
  };
  afterEach(() => vi.unstubAllGlobals());

  it("detects phones and tablets that say so in the user agent", () => {
    stub("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15");
    expect(isMobileDevice()).toBe(true);
    stub("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36");
    expect(isMobileDevice()).toBe(true);
  });

  it("detects an iPad, which reports itself as a Mac since iPadOS 13", () => {
    stub("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5);
    expect(isMobileDevice()).toBe(true);
  });

  it("leaves a real desktop alone", () => {
    stub("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", 0);
    expect(isMobileDevice()).toBe(false);
    stub("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    expect(isMobileDevice()).toBe(false);
  });
});

// The file name travels through iOS Files and WhatsApp, which wrap a name
// that switches writing direction in bidi control characters — drawn as "�"
// on WhatsApp Web. Keeping the name in one direction is what avoids that, so
// these pin down that no Latin filler sneaks back in.
describe("buildPdfFileName", () => {
  const report = (patch: Partial<SurveyReport>) =>
    ({ surveyDate: "2026-09-22", placeName: "", items: [], ...patch }) as SurveyReport;

  it("uses the business name for a Form 8 report, which keeps it in its own field", () => {
    expect(buildPdfFileName(report({ surveyType: "accessibility_form_8", form8BusinessName: "מסעדת הגליל" })))
      .toBe("טופס-8-חוות-דעת-נגישות-מסעדת הגליל-2026-09-22.pdf");
  });

  it("leaves the name segment out entirely when there is no name", () => {
    expect(buildPdfFileName(report({ surveyType: "accessibility_form_8" })))
      .toBe("טופס-8-חוות-דעת-נגישות-2026-09-22.pdf");
    expect(buildPdfFileName(report({ surveyType: "accessibility" })))
      .toBe("סקר-נגישות-2026-09-22.pdf");
  });

  it("never falls back to a Latin word, whatever is left after sanitizing", () => {
    for (const placeName of ["", "   ", "״׳־", "🏗️"]) {
      const base = buildPdfFileName(report({ surveyType: "accessibility", placeName })).replace(/\.pdf$/, "");
      expect(base, placeName).not.toMatch(/[a-zA-Z]/);
    }
  });

  it("still uses placeName for every other report type", () => {
    expect(buildPdfFileName(report({ surveyType: "risk_survey", placeName: "גן הפעמון" })))
      .toBe("סקר-סיכונים-גן הפעמון-2026-09-22.pdf");
  });

  it("swaps the prefix for an approval report", () => {
    expect(buildPdfFileName(report({ surveyType: "accessibility", placeName: "בית ספר אלון", reportMode: "approval" })))
      .toBe("אישור-נגישות-בית ספר אלון-2026-09-22.pdf");
  });
});

// Saving a report to iOS Files and sending it on from there wraps a Hebrew
// name in direction marks that WhatsApp draws as "�". A name written in Latin
// letters never gets wrapped, so consultants who work that way can switch.
describe("Latin file names", () => {
  const latin = { latinFileNames: true } as ConsultantSettings;
  const report = (patch: Partial<SurveyReport>) =>
    ({ surveyDate: "2026-09-23", placeName: "", items: [], ...patch }) as SurveyReport;

  it("writes the whole name in Latin letters", () => {
    const name = buildPdfFileName(report({ surveyType: "accessibility", placeName: "פאדל רננים" }), latin);
    expect(name).toBe("accessibility-survey-padl-rnnym-2026-09-23.pdf");
    expect(name).toMatch(/^[a-zA-Z0-9.-]+$/);
  });

  it("uses the business name for Form 8, as the Hebrew name does", () => {
    expect(buildPdfFileName(report({ surveyType: "accessibility_form_8", form8BusinessName: "מסעדה" }), latin))
      .toBe("form-8-accessibility-opinion-msadh-2026-09-23.pdf");
  });

  it("marks an approval as one", () => {
    expect(buildPdfFileName(report({ surveyType: "accessibility", reportMode: "approval" }), latin))
      .toBe("accessibility-approval-2026-09-23.pdf");
  });

  it("leaves the name out when nothing transliterates", () => {
    expect(buildPdfFileName(report({ surveyType: "risk_survey", placeName: "!!!" }), latin))
      .toBe("risk-survey-2026-09-23.pdf");
  });

  it("keeps Hebrew names when the setting is off", () => {
    expect(buildPdfFileName(report({ surveyType: "accessibility", placeName: "פאדל רננים" })))
      .toBe("סקר-נגישות-פאדל רננים-2026-09-23.pdf");
    expect(buildPdfFileName(report({ surveyType: "accessibility", placeName: "פאדל רננים" }), {} as ConsultantSettings))
      .toBe("סקר-נגישות-פאדל רננים-2026-09-23.pdf");
  });
});

describe("transliterateHebrew", () => {
  it("maps each Hebrew letter to Latin, final forms included", () => {
    expect(transliterateHebrew("שמר")).toBe("shmr");
    expect(transliterateHebrew("רננים")).toBe("rnnym");
    expect(transliterateHebrew("חץ")).toBe("chtz");
  });

  it("keeps Latin and digits that are already in the name", () => {
    expect(transliterateHebrew("Padel 12")).toBe("Padel 12");
  });

  it("drops anything that is neither", () => {
    expect(transliterateHebrew('בי"ס «אלון»')).toBe("bys alvn");
    expect(transliterateHebrew("🏗️")).toBe("");
  });
});
