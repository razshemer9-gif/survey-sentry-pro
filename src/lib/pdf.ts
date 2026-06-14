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

  // ── Page sizing and smart break calculation ──────────────────────────────
  // iOS Safari limits canvas height to ~4096px and total area to ~16 MP.
  // Use scale=1 on mobile so each canvas stays within those bounds.
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const scale    = isMobile ? 1 : 2;
  const MAX_PX   = isMobile ? 3_500_000 : 14_000_000;
  const MAX_H    = isMobile ? 3_500     : 7_000;
  const PAGE_H   = Math.min(MAX_H, Math.floor(MAX_PX / (elWidth * scale)));

  // Positions of [data-pdf-no-break] cards relative to the element's top.
  // Must be computed before any marginTop manipulation.
  const elTop    = element.getBoundingClientRect().top;
  const noBreaks = Array.from(
    element.querySelectorAll<HTMLElement>("[data-pdf-no-break]"),
  ).map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - elTop, bottom: r.bottom - elTop };
  });

  // Build slice list — never break inside a no-break card.
  const slices: { top: number; height: number }[] = [];
  let cursor = 0;

  while (cursor < elHeight) {
    let end = cursor + PAGE_H;

    if (end >= elHeight) {
      slices.push({ top: cursor, height: elHeight - cursor });
      break;
    }

    // Pull break earlier if it lands inside a no-break card.
    for (const nb of noBreaks) {
      if (nb.top < end && nb.bottom > end) {
        end = nb.top;
        break;
      }
    }

    // If a single card is taller than PAGE_H, let it overflow its page
    // rather than cutting it — push end to the card's bottom edge.
    if (end <= cursor) {
      const tall = noBreaks.find((nb) => nb.top <= cursor && nb.bottom > cursor);
      end = tall ? tall.bottom : cursor + PAGE_H;
    }

    slices.push({ top: cursor, height: end - cursor });
    cursor = end;
  }

  console.log(`[PDF] scale=${scale}, PAGE_H=${PAGE_H}px, slices=${slices.length}, total=${elHeight}px`);

  const PX_TO_MM = 25.4 / 96;
  const pageWmm  = elWidth * PX_TO_MM;

  // ── Capture each slice via the "marginTop slide" technique ───────────────
  // The container (#pdf-print-mount) is position:fixed; top:100vh — always
  // at a known viewport position.  For each slice we:
  //   1. Shrink the container to sliceH + overflow:hidden
  //   2. Slide the element up by sliceTop using a negative margin-top
  //   3. html2canvas(container) captures the container from its own top —
  //      no document-coordinate math needed for the fixed element.
  const savedOverflow  = container.style.overflow;
  const savedHeight    = container.style.height;
  const savedMarginTop = element.style.marginTop;

  let pdf!: jsPDF;

  try {
    for (let i = 0; i < slices.length; i++) {
      const { top: pageTop, height: pageH } = slices[i];
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
