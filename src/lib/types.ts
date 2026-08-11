export type ComplianceStatus = "compliant" | "non_compliant" | "not_applicable" | "pending";

// ── Survey types registry ──────────────────────────────────────────────────
export type SurveyType = "accessibility" | "education_safety" | "general_safety" | "welfare_inspection" | "element_stability" | "risk_survey" | "accessibility_form_8";

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
  {
    id: "welfare_inspection",
    label: "דוח מבדק משרד הרווחה",
    shortLabel: "רווחה",
    pdfTitle: "נספח בדיקת עמידה בדרישות בטיחות",
    filePrefix: "מבדק-רווחה",
    color: "#0891b2",
  },
  {
    id: "element_stability",
    label: "דוח בדיקת יציבות אלמנטים",
    shortLabel: "יציבות אלמנטים",
    pdfTitle: "דוח בדיקת יציבות אלמנטים",
    filePrefix: "דוח-יציבות-אלמנטים",
    color: "#0f766e",
  },
  {
    id: "risk_survey",
    label: "סקר סיכונים",
    shortLabel: "סיכונים",
    pdfTitle: "סקר סיכונים",
    filePrefix: "סקר-סיכונים",
    color: "#c2410c",
  },
  {
    id: "accessibility_form_8",
    label: 'טופס 8 – חוות דעת מורשה נגישות',
    shortLabel: "טופס 8",
    pdfTitle: "חוות דעת מורשה נגישות",
    filePrefix: "טופס-8-חוות-דעת-נגישות",
    color: "#7c3aed",
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
  accessibilityComplianceStatus?: "yes" | "no" | "safe";
  // Document mode
  reportMode?: "survey" | "approval";
  // Required approvals (general_safety only)
  requiredApprovals?: string[];
  // Predefined disclaimer clauses (general_safety only) — indices of selected clauses
  selectedClauses?: number[];
  // Education-safety inspection table — selected row numbers (1..20) that appear in PDF
  eduInspectionRows?: number[];
  // Education-safety free-text notes (appears above the inspection table in PDF)
  eduNotes?: string;
  // Education-safety final approval status (appears above the inspection table in PDF)
  eduApprovalStatus?: "approve" | "reject";
  // ── Welfare inspection (משרד הרווחה) ─────────────────────────────────────
  welfareFrameworkPurpose?: string;   // "לשמש כ __"
  welfareFrameworkSymbol?: string;    // סמל מסגרת
  welfareInquiry?: string;            // שאלה פרטיה
  welfarePropertyOwner?: string;      // בעלות הנכס
  welfareManagerName?: string;        // פרטי המנהל
  welfareManagerPhone?: string;       // נייד המנהל
  welfarePurposeType?: "outside_home" | "daily" | "other";
  welfarePurposeOther?: string;
  welfareApprovals?: Array<{
    presented?: "yes" | "no" | "na";
    dateGiven?: string;
    validUntil?: string;
  }>;
  welfareDefectsStatus?: "none" | "found";
  welfareSummaryStatus?: "no_impediment" | "after_repair";
  welfareSummaryUsage?: string;
  welfareRepairList?: [string, string, string];
  welfareSignatoryName?: string;
  welfareInspectorFirstName?: string;
  welfareInspectorLastName?: string;
  welfareInspectorId?: string;
  welfareQualification?: "safety_engineer" | "safety_officer" | "school_safety_inspector";
  welfareRegistrationNum?: string;
  welfareInspectorPhone?: string;
  welfareInspectorEmail?: string;
  welfareInspectorYearsExperience?: string;
  // ── Element stability inspection (דוח בדיקת יציבות אלמנטים) ───────────────
  elementInspectorName?: string;   // שם הבודק
  elementIntroText?: string;       // "בתאריך:" free text intro
  elementNotes?: string;           // הערות (free text below the table)
  elementStabilityStatus?: "stable" | "unstable"; // המתקנים נמצאו יציבים/לא יציבים
  elementValidUntil?: string;      // date filled into the last default clause
  // Editable list of fixed terms shown below the result (per-report override).
  // undefined ⇒ use ELEMENT_STABILITY_DEFAULT_TERMS.
  stabilityTerms?: string[];
  // ── Risk survey (סקר סיכונים) ──────────────────────────────────────────────
  // Findings themselves are the existing report.items — each uses only
  // photo (the hazard image) and fieldNotes (its short description).
  riskInspectorName?: string;        // שם עורך הדו"ח
  riskFencingNote?: string;          // הנחיה בנושא גידור — free text, editable
  riskFencingNoteEnabled?: boolean;  // allows hiding the note entirely
  // ── Form 8 — חוות דעת מורשה נגישות (טופס 8) ────────────────────────────────
  // חלק א' — פרטי העסק (report-specific; never taken from the sample DOCX)
  form8LocalAuthority?: string;      // אל: רשות רישוי עסקים __
  form8FileNumber?: string;          // מס' תיק/בקשה לרישיון עסק
  form8BusinessName?: string;        // שם העסק (עשוי לכלול גם שם/תיאור אירוע)
  form8EventDate?: string;           // תאריך האירוע — כשרלוונטי, בנפרד משם העסק
  form8Attendance?: string;          // מספר משתתפים / תפוסה
  form8LicenseItemNumber?: string;   // מס' פריט רישוי
  form8BusinessAddress?: string;     // כתובת העסק
  form8BusinessOwnerName?: string;   // בעל/ת העסק
  form8BusinessOwnerId?: string;     // ת.ז./ח.פ
  // חלק ג' — חוות הדעת (report-specific)
  form8BuildingApproved?: boolean;   // הוראות נגישות לבניין קיים/חדש מתקיימות
  form8ServiceApproved?: boolean;    // הוראות נגישות לשירות מתקיימות
  form8InspectionDataDate?: string;  // יום הכרת הנתונים
  form8OpinionDate?: string;         // תאריך חוות הדעת (ליד חתימת המורשה)
  // חלק ד' — טבלת 14 הדרישות הקבועות; רק response משתנה בין דוחות
  form8Requirements?: { id: number; response: string }[];
  // אישור בעל העסק לעניין העברת הרשימה לחייב
  form8OwnerDeclarationName?: string; // ברירת מחדל מ-form8BusinessOwnerName, ניתן לעריכה
  form8OwnerSignature?: string;       // dataURL, אופציונלי
  form8OwnerSignatureDate?: string;
  // חלק ב' — פרטי מורשה נגישות: SNAPSHOT שהועתק מהגדרות היועץ (reportFormats.
  // accessibility_form_8) בעת יצירת הדוח — לעולם לא נקרא מחדש מההגדרות
  // החיות, כדי שדוחות ישנים לא ישתנו רטרואקטיבית אם היועץ יעדכן את פרטיו.
  form8ExpertName?: string;
  form8ExpertId?: string;
  form8ExpertRegistrationNumber?: string;   // מס' רישום בפנקס — מתו"ס
  form8ExpertRegistryName?: string;         // שם הפנקס — מתו"ס
  form8ExpertAddress?: string;
  form8ExpertPhone?: string;
  form8ExpertEmail?: string;
  form8ServiceExpertName?: string;
  form8ServiceExpertId?: string;
  form8ServiceRegistrationNumber?: string;  // מס' רישום בפנקס — שירות
  form8ServiceRegistryName?: string;        // שם הפנקס — שירות
  form8ExpertSignature?: string;            // dataURL, snapshot
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
  signatureImage?: string; // dataURL — signature and/or stamp, combined into one image
  companyLogo?: string; // dataURL — overrides global logo for this survey type
  closingText?: string;
  legalNotes?: string;
  checklistPageTitle?: string;
  opinionSectionTitle?: string;
  opinionQuestion?: string;
  correctionLabel?: string;
  // ── Element stability (דוח בדיקת יציבות אלמנטים) type-level defaults ──
  footerImage?: string;              // dataURL — overrides the text footer
  stabilityTermsDefault?: string[];  // default fixed terms for new reports
  resultStableText?: string;         // override "המתקנים נמצאו יציבים"
  resultUnstableText?: string;       // override "המתקנים נמצאו לא יציבים"
  showFooter?: boolean;              // default true
  showSignature?: boolean;           // default true
  // ── Form 8 (טופס 8) — מורשה נגישות account details, entered once and
  // snapshotted into each new report (see SurveyReport.form8Expert*) ──────
  accessibilityMatosName?: string;
  accessibilityMatosId?: string;
  accessibilityMatosRegistrationNumber?: string;
  accessibilityMatosRegistryName?: string;
  accessibilityExpertAddress?: string;
  accessibilityExpertPhone?: string;
  accessibilityExpertEmail?: string;
  accessibilityServiceName?: string;
  accessibilityServiceId?: string;
  accessibilityServiceRegistrationNumber?: string;
  accessibilityServiceRegistryName?: string;
  accessibilityExpertSignature?: string; // dataURL, PNG עם רקע שקוף עדיף
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
