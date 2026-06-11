import { getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Triggers the browser's native print-to-PDF dialog.
 *
 * The element passed in is the live .report-preview div rendered by the
 * id="pdf-print-mount" portal — the same component, same CSS, same data as
 * the visible preview.  @media print CSS hides the rest of the app and
 * resets the mount so the browser renders a proper A4 document.
 */
export async function generateReportPdf(
  element: HTMLElement | null,
  fileName: string,
): Promise<void> {
  // ── Validation ──────────────────────────────────────────────────────────
  if (!element) {
    console.error("[PDF] printRef is null — portal not mounted yet");
    throw new Error("PDF element not found");
  }
  if (!element.innerHTML.trim()) {
    console.error("[PDF] printRef.innerHTML is empty");
    throw new Error("PDF element is empty");
  }
  if (element.offsetHeight === 0) {
    console.error("[PDF] printRef.offsetHeight === 0 — element has no height");
    throw new Error("PDF element has no height");
  }

  // ── Wait for fonts ───────────────────────────────────────────────────────
  if ((document as any).fonts?.ready) {
    await (document as any).fonts.ready;
  }

  // ── Wait for images ──────────────────────────────────────────────────────
  const imgs = Array.from(element.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            }),
    ),
  );

  // ── Print ────────────────────────────────────────────────────────────────
  const origTitle = document.title;
  document.title = fileName.replace(/\.pdf$/i, "");

  try {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      window.addEventListener("afterprint", finish, { once: true });
      setTimeout(finish, 60_000);
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
