import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Captures the live portal element as a single continuous PDF page.
 *
 * Root cause of the old truncation: html2canvas's `y` option is in DOCUMENT
 * coordinates, but the portal element is `position:fixed; top:100vh`, so its
 * document-Y starts at ~viewportHeight (≈900px), not 0.  Passing `y: 4000`
 * told html2canvas to start at document Y=4000, which is only 3100px into the
 * element — making the last strips miss the tail of the report entirely.
 *
 * Fix: use the "translateY window" technique.  For each strip we:
 *   1. shrink the container to exactly the strip height + overflow:hidden
 *   2. shift the element up with translateY so the desired slice is visible
 *   3. call html2canvas on the *container* (whose viewport position is fixed
 *      and known) — it always sees exactly the strip we want
 *   4. restore styles before the next strip
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

  const container = element.parentElement;
  if (!container) throw new Error("PDF element has no parent container");

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
  console.log(`[PDF] scale=${scale.toFixed(2)}, strips=${stripCount}, fullHeight=${fullHeight}px`);

  // ── Build PDF (single long page) ─────────────────────────────────────────
  const PX_TO_MM = 25.4 / 96;
  const pageW = elWidth    * PX_TO_MM;
  const pageH = fullHeight * PX_TO_MM;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageW, pageH],
  });

  // ── Capture strips via translateY window ──────────────────────────────────
  const savedOverflow  = container.style.overflow;
  const savedHeight    = container.style.height;
  const savedTransform = element.style.transform;

  try {
    for (let i = 0; i < stripCount; i++) {
      const eY = i * STRIP_H;                        // element-relative Y
      const h  = Math.min(STRIP_H, fullHeight - eY); // actual strip height

      // Expose only this strip through the container's clipping window
      container.style.overflow = "hidden";
      container.style.height   = h + "px";
      element.style.transform  = `translateY(-${eY}px)`;

      // Two rAF ticks so the browser repaints before we screenshot
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );

      const canvas = await html2canvas(container, {
        scale,
        backgroundColor: "#ffffff",
        useCORS: true,
        windowWidth: elWidth,
        width:  elWidth,
        height: h,
      });

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,             // x mm
        eY * PX_TO_MM, // y mm — correct offset in the long page
        pageW,         // width mm
        h  * PX_TO_MM, // height mm
        undefined,
        "FAST",
      );
    }
  } finally {
    // Always restore — even if html2canvas throws
    container.style.overflow = savedOverflow;
    container.style.height   = savedHeight;
    element.style.transform  = savedTransform;
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
