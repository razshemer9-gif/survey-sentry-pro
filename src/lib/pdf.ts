import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Captures the live preview element with html2canvas and produces a single
 * long PDF page whose dimensions exactly match the element — no slicing,
 * no scaling, no page breaks.  The result is a 1:1 copy of the preview.
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
  const elWidth = element.scrollWidth;
  const elHeight = element.scrollHeight;
  if (elHeight === 0) {
    console.error("[PDF] element.scrollHeight === 0");
    throw new Error("PDF element has no height");
  }
  console.log(`[PDF] element ${elWidth}×${elHeight}px`);

  // ── Wait for fonts ───────────────────────────────────────────────────────
  if ((document as any).fonts?.ready) {
    await (document as any).fonts.ready;
  }

  // ── Wait for images ──────────────────────────────────────────────────────
  const imgs = Array.from(element.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          }),
    ),
  );

  // ── Scale (capped for iOS Safari 16 MP canvas limit) ────────────────────
  const MAX_CANVAS_PX = 14_000_000;
  const raw = elWidth * elHeight;
  const scale = raw * 4 > MAX_CANVAS_PX
    ? Math.max(1, Math.sqrt(MAX_CANVAS_PX / raw))
    : 2;
  console.log(`[PDF] html2canvas scale: ${scale.toFixed(2)}`);

  // ── Render ───────────────────────────────────────────────────────────────
  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: elWidth,
    width: elWidth,
    height: elHeight,
  });

  // ── Single long-page PDF — 1 px = 25.4 / 96 mm ──────────────────────────
  const PX_TO_MM = 25.4 / 96;
  const pageW = elWidth  * PX_TO_MM;   // ≈ 210 mm for the 794 px report
  const pageH = elHeight * PX_TO_MM;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageW, pageH],
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");

  // ── Download ─────────────────────────────────────────────────────────────
  const blob = pdf.output("blob");
  const url  = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

export function buildPdfFileName(report: SurveyReport): string {
  const safe = (report.placeName || "report").replace(/[^֐-׿a-zA-Z0-9 _-]/g, "").trim() || "report";
  const date  = report.surveyDate || new Date().toISOString().slice(0, 10);
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
