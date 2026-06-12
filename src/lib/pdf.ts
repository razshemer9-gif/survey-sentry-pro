import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Captures the live portal element in horizontal strips (each strip ≤ 4 000 px
 * before scaling, keeping every canvas well under the browser's ~16 384 px
 * height limit).  The strips are stitched together into a single long PDF page
 * that is a 1:1 copy of the preview — no page breaks, no scaling distortion.
 */
export async function generateReportPdf(
  element: HTMLElement | null,
  fileName: string,
): Promise<void> {
  // ── Validation ──────────────────────────────────────────────────────────
  if (!element) {
    console.error("[PDF] printRef is null — portal not mounted");
    throw new Error("PDF element not found");
  }
  if (!element.innerHTML.trim()) {
    console.error("[PDF] printRef.innerHTML is empty");
    throw new Error("PDF element is empty");
  }

  const elWidth = element.scrollWidth;
  // Use the largest of the three height measures to avoid truncation
  const fullHeight = Math.max(
    element.scrollHeight,
    element.offsetHeight,
    element.clientHeight,
  );

  console.log("[PDF] element dimensions:", {
    scrollWidth:   element.scrollWidth,
    scrollHeight:  element.scrollHeight,
    offsetHeight:  element.offsetHeight,
    clientHeight:  element.clientHeight,
    fullHeight,
    findingsCount: element.querySelectorAll("[data-pdf-no-break]").length,
  });

  if (fullHeight === 0) {
    console.error("[PDF] fullHeight === 0");
    throw new Error("PDF element has no height");
  }

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
            img.onload  = () => res();
            img.onerror = () => res();
          }),
    ),
  );

  // ── Strip height and scale ───────────────────────────────────────────────
  // Each strip is captured separately so no single canvas exceeds
  // the browser's ~16 384 px height limit.
  // At STRIP_H=4 000 and scale=2 the canvas is 1 588 × 8 000 px — well within limits.
  const STRIP_H = 4_000; // source pixels per strip
  const MAX_CANVAS_PX = 14_000_000;
  const rawStrip = elWidth * STRIP_H;
  const scale = rawStrip * 4 > MAX_CANVAS_PX
    ? Math.max(1, Math.sqrt(MAX_CANVAS_PX / rawStrip))
    : 2;

  const stripCount = Math.ceil(fullHeight / STRIP_H);
  console.log(`[PDF] scale: ${scale.toFixed(2)}, strips: ${stripCount}, totalHeight: ${fullHeight}px`);

  // ── Build PDF ────────────────────────────────────────────────────────────
  // 1 CSS px = 25.4 / 96 mm at standard screen resolution
  const PX_TO_MM = 25.4 / 96;
  const pageW = elWidth    * PX_TO_MM;   // ≈ 210 mm for the 794 px report
  const pageH = fullHeight * PX_TO_MM;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageW, pageH],
  });

  for (let y = 0; y < fullHeight; y += STRIP_H) {
    const h = Math.min(STRIP_H, fullHeight - y);

    const strip = await html2canvas(element, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: elWidth,
      x:      0,
      y,
      width:  elWidth,
      height: h,
    });

    const imgData = strip.toDataURL("image/jpeg", 0.95);
    pdf.addImage(
      imgData, "JPEG",
      0,               // x in mm
      y * PX_TO_MM,    // y in mm
      pageW,           // width in mm
      h * PX_TO_MM,    // height in mm
      undefined,
      "FAST",
    );
  }

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
