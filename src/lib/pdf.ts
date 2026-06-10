import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ConsultantSettings, getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Renders the given printable element (already styled in RTL Hebrew with web fonts)
 * into a multi-page A4 PDF and triggers a download.
 *
 * Strategy: rasterize the full document once at high DPI, then slice it into
 * A4-sized page images. This guarantees fonts/RTL render exactly like the preview.
 */
export async function generateReportPdf(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  // Wait for fonts to be ready so html2canvas captures the right metrics.
  if ((document as any).fonts?.ready) {
    await (document as any).fonts.ready;
  }

  // Collect no-break element ranges (CSS px, relative to element top) BEFORE rasterising.
  const containerTop = element.getBoundingClientRect().top;
  const noBreakCss: Array<{ top: number; bottom: number }> = [];
  element.querySelectorAll("[data-pdf-no-break]").forEach((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    noBreakCss.push({ top: r.top - containerTop, bottom: r.bottom - containerTop });
  });

  // iOS Safari caps canvas at ~16.7M pixels total. Reduce scale for tall documents.
  const MAX_CANVAS_PIXELS = 14_000_000; // conservative limit for older iPhones
  const rawPixels = element.scrollWidth * element.scrollHeight;
  const scale = rawPixels * 4 > MAX_CANVAS_PIXELS
    ? Math.max(1, Math.sqrt(MAX_CANVAS_PIXELS / rawPixels))
    : 2;

  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: element.scrollWidth,
  });

  // Scale factor between CSS pixels and canvas pixels.
  const canvasScale = canvas.width / element.scrollWidth;
  const noBreakPx = noBreakCss.map(({ top, bottom }) => ({
    top: Math.floor(top * canvasScale),
    bottom: Math.ceil(bottom * canvasScale),
  }));

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  const pxPerMm = canvas.width / pageWidthMm;
  const pageHeightPx = pageHeightMm * pxPerMm;

  let renderedHeight = 0;
  let pageIndex = 0;

  while (renderedHeight < canvas.height) {
    let cutAt = Math.min(renderedHeight + pageHeightPx, canvas.height);

    // If the ideal cut falls inside a no-break element, move it to before that element.
    // Iterate ALL no-break elements (no early break) so that inner sub-sections of
    // a tall card are also respected when the outer card itself is too tall to keep whole.
    if (cutAt < canvas.height) {
      for (const { top, bottom } of noBreakPx) {
        if (cutAt > top && cutAt < bottom) {
          const blockH = bottom - top;
          // Only move the cut when the block fits on one page — avoids pushing an
          // oversized block to the next page where it would still be cut.
          if (blockH <= pageHeightPx && top > renderedHeight) {
            cutAt = top;
          }
        }
      }
    }

    const sliceHeight = Math.max(1, Math.floor(cutAt - renderedHeight));

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0, renderedHeight,
      canvas.width, sliceHeight,
      0, 0,
      canvas.width, sliceHeight,
    );

    const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    if (pageIndex > 0) pdf.addPage();
    const sliceHeightMm = sliceHeight / pxPerMm;
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, sliceHeightMm, undefined, "FAST");

    renderedHeight += sliceHeight;
    pageIndex++;
  }

  // Use blob + manual <a download> instead of pdf.save() — works better
  // inside iframes (e.g. Lovable preview) and with non-ASCII filenames.
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    // Fallback — open in a new tab so the user can save manually
    window.open(url, "_blank", "noopener,noreferrer");
    throw err;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

export function buildPdfFileName(report: SurveyReport): string {
  const safe = (report.placeName || "report").replace(/[^\u0590-\u05FFa-zA-Z0-9 _-]/g, "").trim() || "report";
  const date = report.surveyDate || new Date().toISOString().slice(0, 10);
  const prefix = getSurveyType(report.surveyType).filePrefix;
  return `${prefix}-${safe}-${date}.pdf`;
}

export function statusLabel(s: string): string {
  switch (s) {
    case "compliant":
      return "תקין";
    case "non_compliant":
      return "לא תקין";
    case "not_applicable":
      return "לא רלוונטי";
    default:
      return "ממתין לבדיקה";
  }
}

export { formatCurrency, formatHebrewDate };
