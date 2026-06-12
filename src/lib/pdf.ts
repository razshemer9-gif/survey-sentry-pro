import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

export async function generateReportPdf(
  element: HTMLElement | null,
  fileName: string,
): Promise<void> {
  if (!element) {
    console.error("[PDF] printRef is null — portal not mounted yet");
    throw new Error("PDF element not found");
  }
  if (!element.innerHTML.trim()) {
    console.error("[PDF] printRef.innerHTML is empty");
    throw new Error("PDF element is empty");
  }

  const container = element.parentElement;
  if (!container) throw new Error("PDF element has no parent container");

  const elWidth  = element.scrollWidth;
  const elHeight = element.scrollHeight;

  if (elHeight === 0) {
    console.error("[PDF] element.scrollHeight === 0");
    throw new Error("PDF element has no height");
  }

  console.log(`[PDF] element ${elWidth}×${elHeight}px`);

  // ── Wait for fonts ───────────────────────────────────────────────────────
  if ((document as any).fonts?.ready) await (document as any).fonts.ready;

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

  // ── Page sizing ──────────────────────────────────────────────────────────
  // At scale 2 each canvas is elWidth*2 × PAGE_H*2 pixels.
  // Stay well under the browser ~16 384 px height limit and 14 MP total.
  const scale    = 2;
  const MAX_PX   = 14_000_000;
  const PAGE_H   = Math.min(4_000, Math.floor(MAX_PX / (elWidth * scale)));
  const numPages = Math.ceil(elHeight / PAGE_H);

  console.log(`[PDF] scale=${scale}, PAGE_H=${PAGE_H}px, pages=${numPages}`);

  const PX_TO_MM = 25.4 / 96;
  const pageWmm  = elWidth * PX_TO_MM;

  // ── Capture each page via the "marginTop slide" technique ────────────────
  // The container (#pdf-print-mount) is position:fixed; top:100vh — always
  // at a known viewport position.  For each page we:
  //   1. Shrink the container to PAGE_H + overflow:hidden
  //   2. Slide the element up by pageTop using a negative margin-top
  //   3. html2canvas(container) captures the container from its own top —
  //      no document-coordinate math needed for the fixed element.
  const savedOverflow  = container.style.overflow;
  const savedHeight    = container.style.height;
  const savedMarginTop = element.style.marginTop;

  let pdf!: jsPDF;

  try {
    for (let i = 0; i < numPages; i++) {
      const pageTop = i * PAGE_H;
      const pageH   = Math.min(PAGE_H, elHeight - pageTop);
      const pageHmm = pageH * PX_TO_MM;

      container.style.overflow = "hidden";
      container.style.height   = pageH + "px";
      element.style.marginTop  = `-${pageTop}px`;

      // Two rAF ticks so the browser repaints before capturing
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );

      const canvas = await html2canvas(container, {
        scale,
        backgroundColor: "#ffffff",
        useCORS:         true,
        windowWidth:     elWidth,
        width:           elWidth,
        height:          pageH,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (i === 0) {
        pdf = new jsPDF({
          orientation: "portrait",
          unit:        "mm",
          format:      [pageWmm, pageHmm],
        });
      } else {
        (pdf as any).addPage([pageWmm, pageHmm]);
      }

      pdf.addImage(imgData, "JPEG", 0, 0, pageWmm, pageHmm, undefined, "FAST");
    }
  } finally {
    // Always restore — even if html2canvas throws
    container.style.overflow = savedOverflow;
    container.style.height   = savedHeight;
    element.style.marginTop  = savedMarginTop;
  }

  // ── Download ─────────────────────────────────────────────────────────────
  const blob = pdf.output("blob");
  const url  = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href          = url;
    a.download      = fileName;
    a.rel           = "noopener";
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
