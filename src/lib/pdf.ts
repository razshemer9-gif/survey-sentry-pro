import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ConsultantSettings, getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Renders the given printable element into a multi-page A4 PDF and triggers a download.
 *
 * Cut strategy: rasterize the full document once, then for each page boundary
 * scan backward through the rendered pixels looking for a "background row" —
 * a row where ≥95% of sampled pixels are light-colored (white or near-white).
 * This catches blank lines between paragraphs (#f8fafc gray background),
 * gaps between cards (white), and card padding rows without any DOM measurement.
 */
export async function generateReportPdf(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  if ((document as any).fonts?.ready) {
    await (document as any).fonts.ready;
  }

  // iOS Safari caps canvas at ~16.7M pixels total.
  const MAX_CANVAS_PIXELS = 14_000_000;
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

  const ctx = canvas.getContext("2d")!;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const pxPerMm = canvas.width / pageWidthMm;
  const pageHeightPx = pageHeightMm * pxPerMm;

  let renderedHeight = 0;
  let pageIndex = 0;

  while (renderedHeight < canvas.height) {
    const idealCut = Math.min(renderedHeight + pageHeightPx, canvas.height);
    const cutAt = idealCut < canvas.height
      ? findNaturalCut(ctx, canvas.width, renderedHeight, idealCut)
      : idealCut;

    const sliceHeight = Math.max(1, Math.floor(cutAt - renderedHeight));

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const pCtx = pageCanvas.getContext("2d")!;
    pCtx.fillStyle = "#ffffff";
    pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pCtx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    if (pageIndex > 0) pdf.addPage();
    const sliceHeightMm = sliceHeight / pxPerMm;
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, sliceHeightMm, undefined, "FAST");

    renderedHeight += sliceHeight;
    pageIndex++;
  }

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
    window.open(url, "_blank", "noopener,noreferrer");
    throw err;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

/**
 * Scans backward from idealCut looking for the last "background row" —
 * a row where ≥95% of sampled pixels have R,G,B all ≥ 235.
 * This covers white (#fff), near-white, and the light gray used in Section 1 (#f8fafc = 248,250,252).
 * Sampling every 4th column for performance (~400 samples per row on a 1588px canvas).
 */
function findNaturalCut(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  pageStart: number,
  idealCut: number,
): number {
  const BG_THRESHOLD = 235;
  const MIN_BG_RATIO = 0.95;
  const SAMPLE_STEP = 4;
  // Search the last 35% of the current page for a background row.
  const searchRange = Math.floor((idealCut - pageStart) * 0.35);
  const searchFrom = Math.max(Math.floor(pageStart), Math.floor(idealCut) - searchRange);
  const scanHeight = Math.floor(idealCut) - searchFrom;

  if (scanHeight <= 0) return idealCut;

  const imageData = ctx.getImageData(0, searchFrom, canvasWidth, scanHeight);
  const { data } = imageData;
  const sampledCols = Math.floor(canvasWidth / SAMPLE_STEP);

  for (let row = scanHeight - 1; row >= 0; row--) {
    let bgCount = 0;
    for (let ci = 0; ci < sampledCols; ci++) {
      const i = (row * canvasWidth + ci * SAMPLE_STEP) * 4;
      if (data[i] >= BG_THRESHOLD && data[i + 1] >= BG_THRESHOLD && data[i + 2] >= BG_THRESHOLD) {
        bgCount++;
      }
    }
    if (bgCount / sampledCols >= MIN_BG_RATIO) {
      return searchFrom + row + 1;
    }
  }

  return idealCut;
}

export function buildPdfFileName(report: SurveyReport): string {
  const safe = (report.placeName || "report").replace(/[^֐-׿a-zA-Z0-9 _-]/g, "").trim() || "report";
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
