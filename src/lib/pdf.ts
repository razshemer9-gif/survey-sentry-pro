// Pure PDF-related helpers — NO heavy imports here.
// The actual generator (jsPDF + html2canvas) lives in ./pdf-generate and is
// loaded on demand via dynamic import, so it stays out of the initial bundle.
import { getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

export function buildPdfFileName(report: SurveyReport): string {
  const safe = (report.placeName || "report").replace(/[^֐-׿a-zA-Z0-9 _-]/g, "").trim() || "report";
  const date  = report.surveyDate || new Date().toISOString().slice(0, 10);
  const basePrefix = getSurveyType(report.surveyType).filePrefix;
  const prefix = report.reportMode === "approval" ? basePrefix.replace(/^סקר/, "אישור") : basePrefix;
  return `${prefix}-${safe}-${date}.pdf`;
}

export function statusLabel(s: string): string {
  switch (s) {
    case "compliant":      return "תקין";
    case "non_compliant":  return "לא תקין";
    case "not_applicable": return "לא רלוונטי";
    default:               return "ממתין לבדיקה";
  }
}

export { formatCurrency, formatHebrewDate };
