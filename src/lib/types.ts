export type ComplianceStatus = "compliant" | "non_compliant" | "not_applicable" | "pending";

export interface ChecklistItem {
  id: string;
  title: string;
  status: ComplianceStatus;
  notes: string;
  estimatedCost: number; // ILS
  includeInCost?: boolean;
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
  items: Omit<ChecklistItem, "id" | "status" | "notes" | "estimatedCost" | "photo">[];
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
  // Optional notes
  generalNotes?: string;
  // Digital signature
  signatureDataUrl?: string;
  signatureDate?: string;
  signatureConsultantName?: string;
  // Opinion summary
  accessibilityComplianceStatus?: "yes" | "no";
}

export interface ReferencePhotoEntry {
  id: string;
  label: string;
  photo: string; // dataURL
}

export interface ConsultantSettings {
  companyName: string;
  consultantName: string;
  license: string; // מספר רישוי שירות (מורשה נגישות)
  idNumber?: string; // ת.ז. היועץ
  phone: string;
  email: string;
  address: string;
  logo?: string; // dataURL
  referencePhotos?: ReferencePhotoEntry[]; // personal photo library
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
