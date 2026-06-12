import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Captures the live portal element as a single continuous PDF page.
 *
 * Key: html2canvas `y` is in DOCUMENT coordinates, not element-relative.
 * The portal element is `position:fixed; top:100vh`, so its document-Y
 * ≈ window.innerHeight (~900 px).  We compute elementDocTop once and add
 * each strip's element-relative offset to get the correct document-Y for
 * every html2canvas call.  The strips are stitched into one long PDF page
 * at their correct element-relative Y positions.
 */
export async function generateReportPdf(
  element: HTMLElement | null,
  fileName: string,
): Promise<void> {
  // ── Validation ──────────────────────────────────────────────────────────
  if (!element) {
    console.error("[PDF] printRef is null");
    throw new Error("PDF element not found");
  }
  if (!element.innerHTML.trim()) {
    console.error("[PDF] printRef.innerHTML is empty");
    throw new Error("PDF element is empty");
  }

  const elWidth = element.scrollWidth;
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

  if (fullHeight === 0) throw new Error("PDF element has no height");

  // ── Wait for fonts ───────────────────────────────────────────────────────
  if ((document as any).fonts?.ready) await (document as any).fonts.ready;

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

  // ── Strip config ─────────────────────────────────────────────────────────
  // 4 000 px source → 8 000 px canvas at scale 2 — well under the 16 384 px limit.
  const STRIP_H = 4_000;
  const MAX_CANVAS_PX = 14_000_000;
  const scale = elWidth * STRIP_H * 4 > MAX_CANVAS_PX
    ? Math.max(1, Math.sqrt(MAX_CANVAS_PX / (elWidth * STRIP_H)))
    : 2;

  const stripCount = Math.ceil(fullHeight / STRIP_H);

  // html2canvas `y` is in document coordinates.
  // parseBounds(element) = getBoundingClientRect().top + window.scrollY.
  // For position:fixed; top:100vh → docTop ≈ window.innerHeight + scrollY.
  // Each strip must pass (docTop + elementRelativeY) so html2canvas crops
  // exactly the right slice — not from the top of the page.
  const elementDocTop = element.getBoundingClientRect().top + window.scrollY;

  console.log(`[PDF] scale=${scale.toFixed(2)}, strips=${stripCount}, fullHeight=${fullHeight}px, elementDocTop=${Math.round(elementDocTop)}px`);

  // ── Build PDF (single long page) ─────────────────────────────────────────
  const PX_TO_MM = 25.4 / 96;
  const pageW = elWidth    * PX_TO_MM;
  const pageH = fullHeight * PX_TO_MM;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageW, pageH],
  });

  // ── Capture strips with correct document-Y offsets ───────────────────────
  for (let i = 0; i < stripCount; i++) {
    const eY = i * STRIP_H;                        // element-relative Y
    const h  = Math.min(STRIP_H, fullHeight - eY); // actual strip height

    const canvas = await html2canvas(element, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth:  elWidth,
      x:            0,
      y:            elementDocTop + eY, // ← document Y of this strip's start
      width:        elWidth,
      height:       h,
    });

    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      0,             // x mm
      eY * PX_TO_MM, // y mm — element-relative, matches strip offset
      pageW,         // width mm
      h  * PX_TO_MM, // height mm
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
    setTimeout(() => URL.revokeObjectURL(url), 4_000);
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
