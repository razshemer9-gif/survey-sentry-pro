// Sample reports for visual QA of the report design system.
//
// Three sizes per report type — "short" (minimum viable data), "normal"
// (typical real-world report) and "stress" (long text, many findings, many
// photos, multi-page tables). Used to catch pagination, overflow and RTL
// regressions that only appear at the extremes.
//
// These are fixtures, not production data: they are never imported by the app,
// only by QA harnesses and tests.

import { ChecklistItem, ConsultantSettings, SurveyReport, SurveyType } from "@/lib/types";

export type FixtureSize = "short" | "normal" | "stress";

const IMG_LANDSCAPE = "data:image/jpeg;base64,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";

const IMG_PORTRAIT = "data:image/jpeg;base64,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";

const IMG_SIGNATURE = "data:image/jpeg;base64,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";

// ── Text corpora ───────────────────────────────────────────────────────────
const HE_SHORT = "ליקוי בטיחות שאותר במהלך הסיור.";
const HE_LONG =
  "במהלך הסיור נמצא כי מעקה הבטיחות בקומה השנייה אינו עומד בדרישות התקן הישראלי " +
  "1142, הן מבחינת גובהו (נמדד 92 ס\"מ במקום 105 ס\"מ הנדרשים) והן מבחינת המרווח " +
  "בין השלבים האנכיים (נמדד 17 ס\"מ במקום 10 ס\"מ המרביים). בנוסף, נצפתה קורוזיה " +
  "משמעותית בנקודות העיגון לרצפה, המחייבת בדיקת קונסטרוקטור מוסמך בטרם המשך שימוש.";
const HE_MIXED =
  "נמדד מרווח של 17 ס\"מ (תקן: max 10 ס\"מ), סטייה של 70%. דוח מלא נשלח אל " +
  "safety@example.co.il בתאריך 12.03.2026, טלפון לבירורים 03-1234567.";
const CORRECTION =
  "יש להחליף את המעקה במעקה תקני בגובה 105 ס\"מ לפחות, עם מרווח מרבי של 10 ס\"מ " +
  "בין השלבים, ולבצע חיזוק של נקודות העיגון בהתאם להנחיות קונסטרוקטור.";

function itemsFor(size: FixtureSize): ChecklistItem[] {
  const counts: Record<FixtureSize, number> = { short: 1, normal: 6, stress: 42 };
  const n = counts[size];
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${i + 1}`,
    title: size === "stress" && i % 4 === 0
      ? `ממצא ${i + 1} — כותרת ארוכה במיוחד שנועדה לבדוק גלישת טקסט בתוך תא בטבלה צרה`
      : `ממצא ${i + 1}`,
    status: (i % 3 === 0 ? "compliant" : i % 3 === 1 ? "non_compliant" : "not_applicable") as ChecklistItem["status"],
    notes: size === "short" ? HE_SHORT : i % 3 === 0 ? HE_MIXED : HE_LONG,
    fieldNotes: size === "short" ? "" : i % 2 === 0 ? HE_SHORT : HE_MIXED,
    estimatedCost: size === "short" ? 0 : (i + 1) * 250,
    quantity: i % 5 === 0 ? 3 : 1,
    includeInCost: size !== "short" && i % 2 === 0,
    priority: (i % 3) as 0 | 1 | 2,
    ...(size !== "short" && { photo: i % 2 === 0 ? IMG_LANDSCAPE : IMG_PORTRAIT }),
    ...(size === "stress" && i % 3 === 0 && { photos: [IMG_LANDSCAPE, IMG_PORTRAIT] }),
    ...(size !== "short" && { suggestedCorrection: CORRECTION }),
    ...(size !== "short" && { standardPart: 'ת"י 1918 חלק 4', clause: `${i + 1}.2` }),
  }));
}

// ── Consultant settings ────────────────────────────────────────────────────
export const FIXTURE_SETTINGS: ConsultantSettings = {
  companyName: "שמר בטיחות יועצים",
  consultantName: "יוסי שמר",
  license: "1806",
  phone: "052-1234567",
  email: "office@shemer-safety.co.il",
  address: "רחוב ההסתדרות 12, חיפה",
  reportFormats: {
    risk_survey: { surveyType: "risk_survey", signatureImage: IMG_SIGNATURE, professionalName: "יוסי שמר" },
    element_stability: { surveyType: "element_stability", signatureImage: IMG_SIGNATURE },
    education_safety: { surveyType: "education_safety", signatureImage: IMG_SIGNATURE },
    accessibility: { surveyType: "accessibility", signatureImage: IMG_SIGNATURE },
    general_safety: { surveyType: "general_safety", signatureImage: IMG_SIGNATURE },
  },
};

// ── Base report ────────────────────────────────────────────────────────────
function base(surveyType: SurveyType, size: FixtureSize): SurveyReport {
  const now = Date.now();
  return {
    id: `fixture-${surveyType}-${size}`,
    createdAt: now,
    updatedAt: now,
    surveyType,
    placeName: size === "stress"
      ? "מרכז קהילתי עירוני על שם יצחק נבון — אגף הצפוני, מתחם ב'"
      : "מרכז קהילתי הדוגמה",
    clientName: size === "short" ? "" : "עיריית הדוגמה",
    address: size === "short" ? "" : "רחוב הראשי 15, הדוגמה",
    surveyDate: "2026-08-16",
    items: itemsFor(size),
    generalNotes: size === "short" ? "" : HE_LONG,
    signatureDataUrl: size === "short" ? undefined : IMG_SIGNATURE,
  } as SurveyReport;
}

// ── Per-type field overlays ────────────────────────────────────────────────
function overlay(surveyType: SurveyType, size: FixtureSize): Partial<SurveyReport> {
  const full = size !== "short";
  switch (surveyType) {
    case "accessibility":
      return { accessibilityComplianceStatus: full ? "no" : undefined };

    case "general_safety":
      return {
        accessibilityComplianceStatus: full ? "safe" : undefined,
        requiredApprovals: full ? ["אישור כיבוי אש", "אישור יועץ בטיחות", "אישור קונסטרוקטור"] : [],
      };

    case "education_safety":
      return {
        city: full ? "הדוגמה" : undefined,
        institutionSymbol: full ? "123456" : undefined,
        studentCount: full ? "480 תלמידים ב-18 כיתות" : undefined,
        establishedYear: full ? "1987" : undefined,
        institutionPhone: full ? "04-8123456" : undefined,
        principalName: full ? "רונית כהן" : undefined,
        supervisorName: full ? "אבי מזרחי" : undefined,
        institutionParticipants: full ? "מנהלת, אב בית" : undefined,
        authorityParticipants: full ? "מנהל מחלקת בינוי" : undefined,
        eduNotes: full ? HE_LONG : undefined,
        eduApprovalStatus: full ? "approve" : undefined,
        eduInspectionRows: size === "stress" ? Array.from({ length: 20 }, (_, i) => i + 1) : full ? [1, 2, 5] : [],
      };

    case "welfare_inspection":
      return {
        welfareFrameworkPurpose: full ? "מעון יום לגיל הרך" : undefined,
        welfareFrameworkSymbol: full ? "123456" : undefined,
        welfareInquiry: full ? "בדיקה תקופתית" : undefined,
        welfarePropertyOwner: full ? 'חברת רש"י איזון בע"מ' : undefined,
        welfareManagerName: full ? "יונתן כהן" : undefined,
        welfareManagerPhone: full ? "050-1234567" : undefined,
        welfarePurposeType: full ? "outside_home" : undefined,
        welfareApprovals: full
          ? [
              { presented: "yes", dateGiven: "2026-01-15", validUntil: "2027-01-15" },
              { presented: "yes", dateGiven: "2020-06-01" },
              { presented: "no" },
              { presented: "na" },
            ]
          : undefined,
        welfareDefectsStatus: full ? "found" : "none",
        welfareSummaryStatus: full ? "after_repair" : "no_impediment",
        welfareSummaryUsage: full ? "מעון יום לגיל הרך" : undefined,
        welfareRepairList: full ? [HE_SHORT, HE_MIXED, ""] : ["", "", ""],
        welfareSignatoryName: full ? "דנה לוי" : undefined,
        welfareInspectorFirstName: full ? "יוסי" : undefined,
        welfareInspectorLastName: full ? "שמר" : undefined,
        welfareInspectorId: full ? "123456789" : undefined,
        welfareQualification: full ? "safety_officer" : undefined,
        welfareRegistrationNum: full ? "1806" : undefined,
        welfareInspectorPhone: full ? "052-1234567" : undefined,
        welfareInspectorEmail: full ? "office@shemer-safety.co.il" : undefined,
        welfareInspectorYearsExperience: full ? "12" : undefined,
        coverPhoto: full ? IMG_LANDSCAPE : undefined,
      };

    case "element_stability":
      return {
        elementInspectorName: full ? "יוסי שמר" : undefined,
        elementIntroText: full ? HE_SHORT : undefined,
        elementNotes: full ? HE_LONG : undefined,
        elementStabilityStatus: full ? "stable" : undefined,
        elementValidUntil: full ? "2027-08-16" : undefined,
      };

    case "risk_survey":
      return {
        riskInspectorName: full ? "יוסי שמר" : undefined,
        riskFencingNoteEnabled: true,
        ...(size === "stress" && { riskFencingNote: HE_LONG + "\n" + HE_MIXED }),
      };

    case "accessibility_form_8":
      return {
        form8LocalAuthority: full ? "עיריית הדוגמה" : undefined,
        form8FileNumber: full ? "2026/0456" : undefined,
        form8BusinessName: full ? "מרכז קהילתי הדוגמה" : undefined,
        form8BusinessAddress: full ? "רחוב הראשי 15, הדוגמה" : undefined,
        form8BusinessOwnerName: full ? "עיריית הדוגמה" : undefined,
        form8BusinessOwnerId: full ? "500123456" : undefined,
        form8ExpertName: full ? "יוסי שמר" : undefined,
        form8ExpertRegistrationNumber: full ? "1806" : undefined,
        form8ServiceRegistrationNumber: full ? "536" : undefined,
        form8ExpertSignature: full ? IMG_SIGNATURE : undefined,
        form8OwnerSignature: full ? IMG_SIGNATURE : undefined,
        form8OpinionDate: full ? "2026-08-16" : undefined,
        form8OwnerSignatureDate: full ? "2026-08-16" : undefined,
        form8InspectionDataDate: full ? "2026-08-10" : undefined,
      };

    default:
      return {};
  }
}

/** Build one fixture report. */
export function makeFixture(surveyType: SurveyType, size: FixtureSize): SurveyReport {
  return { ...base(surveyType, size), ...overlay(surveyType, size) } as SurveyReport;
}

export const FIXTURE_TYPES: SurveyType[] = [
  "accessibility",
  "general_safety",
  "education_safety",
  "welfare_inspection",
  "element_stability",
  "risk_survey",
  "accessibility_form_8",
];

export const FIXTURE_SIZES: FixtureSize[] = ["short", "normal", "stress"];
