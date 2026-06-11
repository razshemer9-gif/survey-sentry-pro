import { getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Triggers the browser's native print-to-PDF dialog.
 * The report content is already in the DOM via a [data-pdf-portal] element;
 * @media print CSS hides the rest of the app and resets the portal to static
 * flow so the browser renders it as a proper A4 document — vector text,
 * original-quality images, and correct CSS (object-fit, border-radius, etc.).
 *
 * document.title is temporarily set to `fileName` so Chrome/Edge suggest the
 * right filename in the Save dialog.
 */
export async function generateReportPdf(fileName: string): Promise<void> {
  const origTitle = document.title;
  document.title = fileName.replace(/\.pdf$/i, "");

  try {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      window.addEventListener("afterprint", finish, { once: true });
      setTimeout(finish, 60_000); // fallback if afterprint never fires
      window.print();
    });
  } finally {
    document.title = origTitle;
  }
}

export function buildPdfFileName(report: SurveyReport): string {
  const safe = (report.placeName || "report").replace(/[^֐-׿a-zA-Z0-9 _-]/g, "").trim() || "report";
  const date = report.surveyDate || new Date().toISOString().slice(0, 10);
  const prefix = getSurveyType(report.surveyType).filePrefix;
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
