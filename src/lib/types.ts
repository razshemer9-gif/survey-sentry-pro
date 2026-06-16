export type ComplianceStatus = "compliant" | "non_compliant" | "not_applicable" | "pending";

// ── Survey types registry ──────────────────────────────────────────────────
export type SurveyType = "accessibility" | "education_safety" | "general_safety";

export interface SurveyTypeConfig {
  id: SurveyType;
  label: string;       // Hebrew full name shown in dialogs
  shortLabel: string;  // Badge label on report cards
  pdfTitle: string;    // Cover page H1
  filePrefix: string;  // PDF filename prefix
  color: string;       // Accent hex for badges / cover
}

export const SURVEY_TYPES: SurveyTypeConfig[] = [
  {
    id: "accessibility",
    label: 'סקר נגישות מתו״ס ושירות',
    shortLabel: "נגישות",
    pdfTitle: 'סקר נגישות מתו״ס ושירות',
    filePrefix: "סקר-נגישות",
    color: "#2563eb",
  },
  {
    id: "education_safety",
    label: "סקר בטיחות מוסדות חינוך",
    shortLabel: "בטיחות חינוך",
    pdfTitle: "סקר בטיחות מוסדות חינוך",
    filePrefix: "סקר-בטיחות-חינוך",
    color: "#16a34a",
  },
  {
    id: "general_safety",
    label: "סקר בטיחות כללי",
    shortLabel: "בטיחות כללית",
    pdfTitle: "סקר בטיחות",
    filePrefix: "סקר-בטיחות",
    color: "#1e3a8a",
  },
];

// Returns the config for a type, defaulting to accessibility for old reports.
export function getSurveyType(id?: SurveyType): SurveyTypeConfig {
  return SURVEY_TYPES.find((t) => t.id === id) ?? SURVEY_TYPES[0];
}
// ──────────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  title: string;
  status: ComplianceStatus;
  notes: string;           // ממצא — מגיע מתבנית, read-only בדוח
  fieldNotes?: string;     // פירוט מצב קיים — נמלא בשטח, ייעודי לדוח
  estimatedCost: number; // ILS — unit price
  quantity?: number;     // units (default 1); total = estimatedCost × quantity
  includeInCost?: boolean;
  priority?: 0 | 1 | 2; // קדימות לתיקון (0=דחוף, 1=גבוה, 2=רגיל)
  photo?: string; // dataURL — תמונת מצב קיים
  referencePhoto?: string; // legacy single photo — read for backwards compat
  referencePhotos?: string[]; // multiple detail photos (preferred)
  referenceLabel?: string; // טקסט תיאור הפרט
  // Auto-recommendation fields
  suggestedCorrection?: string; // הצעת תיקון מת"י 1918
  matchedRequirementId?: string; // ID של הדרישה
  correctionApplied?: boolean; // האם המשתמש אישר את ההצעה
  // Standard reference (from accessibility_requirements) — shown in PDF
  standardPart?: string; // למשל 'ת"י 1918 חלק 4'
  clause?: string; // למשל '16.1'
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  surveyType?: SurveyType;
  items: (Omit<ChecklistItem, "id" | "status" | "notes" | "estimatedCost" | "photo"> & { notes?: string; defaultCost?: number; defaultPriority?: 0 | 1 | 2 })[];
  builtIn?: boolean;
}

export interface SurveyReport {
  id: string;
  createdAt: number;
  updatedAt: number;
  // Cover
  placeName: string;
  clientName: string;
  address: string;
  surveyDate: string; // YYYY-MM-DD
  coverPhoto?: string; // dataURL
  // Body
  items: ChecklistItem[];
  // Building type
  buildingType?: "existing_public" | "new_public" | "other";
  buildingTypeOther?: string;
  // Survey type — undefined means legacy report, treated as "accessibility"
  surveyType?: SurveyType;
  // Optional notes
  generalNotes?: string;
  // Education safety specific fields
  city?: string;
  institutionSymbol?: string;
  studentCount?: string;
  establishedYear?: string;
  institutionPhone?: string;
  principalName?: string;
  supervisorName?: string;
  institutionParticipants?: string;
  authorityParticipants?: string;
  // Digital signature
  signatureDataUrl?: string;
  signatureDate?: string;
  signatureConsultantName?: string;
  // Opinion summary
  accessibilityComplianceStatus?: "yes" | "no";
  // Document mode
  reportMode?: "survey" | "approval";
  // Required approvals (general_safety only)
  requiredApprovals?: string[];
}

export interface ReferencePhotoEntry {
  id: string;
  label: string;
  photo: string; // dataURL
}

// ── Per-survey-type report format ─────────────────────────────────────────
export interface SurveyReportFormat {
  surveyType: SurveyType;
  reportTitle?: string;
  fixedIntroduction?: string;
  surveyPurposeText?: string;
  professionalDeclarationText?: string;
  professionalName?: string;
  professionalRole?: string;
  licenseNumber?: string;
  certificationText?: string;
  signatureImage?: string; // dataURL
  stampImage?: string; // dataURL
  companyLogo?: string; // dataURL — overrides global logo for this survey type
  closingText?: string;
  legalNotes?: string;
  checklistPageTitle?: string;
  opinionSectionTitle?: string;
  opinionQuestion?: string;
  correctionLabel?: string;
}

export interface ConsultantSettings {
  companyName: string;
  consultantName: string;
  license: string; // מספר רישוי שירות (מורשה נגישות)
  phone: string;
  email: string;
  address: string;
  logo?: string; // dataURL
  referencePhotos?: ReferencePhotoEntry[]; // personal photo library
  reportFormats?: Partial<Record<SurveyType, SurveyReportFormat>>;
}

export const DEFAULT_SETTINGS: ConsultantSettings = {
  companyName: 'יועצי נגישות מתו"ס',
  consultantName: "",
  license: "",
  phone: "",
  email: "",
  address: "",
};

export const DEFAULT_CHECKLIST: Omit<ChecklistItem, "id" | "status" | "notes" | "estimatedCost" | "photo">[] = [
  { title: "שילוט הכוונה לכניסה הנגישה" },
  { title: "כניסה נגישה ראשית" },
  { title: "כניסת חיית שירות" },
  { title: "דלפק קבלה / שירות בגובה נגיש" },
  { title: "דרכי תנועה פנימיות (רוחב מינימלי)" },
  { title: "מעלית נגישה" },
  { title: "שירותי נכים תקניים" },
  { title: "מקומות חניה לנכים" },
  { title: "לחצן מצוקה בשירותים ובמעליות" },
  { title: "מלתחה נגישה" },
  { title: "מקלט / מרחב מוגן נגיש" },
  { title: "לולאת השראה לכבדי שמיעה" },
  { title: "שילוט מידע ושילוט בטיחות" },
  { title: "תקני ישיבה / מקומות מותאמים בקהל" },
  { title: "תאורה והדגשת מכשולים" },
  { title: "אזהרות לעיוורים (פסי אזהרה / אריחי הכוונה)" },
  { title: "מדרגות ומאחזי יד" },
  { title: "רמפות וכבשים" },
];
