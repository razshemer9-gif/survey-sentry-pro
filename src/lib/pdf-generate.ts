// Heavy PDF generation — jsPDF + html2canvas live ONLY here.
// This module is loaded on demand (dynamic import) when the user actually
// generates a PDF, keeping the libraries out of the initial bundle.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

  const PX_TO_MM = 25.4 / 96;

  // ── Repeating per-page footer (opt-in) ───────────────────────────────────
  // A report may mark one element with [data-pdf-page-footer]. When present we
  // capture it once, remove it from the sliced content flow, and stamp it at
  // the bottom of every page. Reports without such an element are unaffected.
  // This is a single small strip of text (a header row or two), captured
  // once regardless of how many pages the report has — nowhere near iOS
  // Safari's canvas-size limits even at a high scale — so unlike the main
  // content slices, there's no reason to cap it lower on mobile.
  const scaleForFooter = 2;
  const footerEl = element.querySelector<HTMLElement>("[data-pdf-page-footer]");
  let footerData: string | null = null;
  let footerHpx = 0;
  const GAP_PX = 6;
  if (footerEl) {
    footerHpx = Math.ceil(footerEl.getBoundingClientRect().height);
    const fCanvas = await html2canvas(footerEl, {
      scale: scaleForFooter,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: element.scrollWidth,
      width: element.scrollWidth,
      height: footerHpx,
    });
    footerData = fCanvas.toDataURL("image/jpeg", 0.95);
    // Remove from content flow so it isn't rendered inline in the slices.
    footerEl.style.display = "none";
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }
  const footerHmm = footerHpx * PX_TO_MM;
  const gapMm = footerEl ? GAP_PX * PX_TO_MM : 0;

  // ── Numeric page numbers (opt-in) ────────────────────────────────────────
  // A report may mark its root with [data-pdf-page-numbers]. jsPDF's built-in
  // fonts don't support Hebrew glyphs (all Hebrew text in this app is
  // rasterized via html2canvas, never drawn as native jsPDF text), so this
  // stamps digits only — "1 / 3" — never Hebrew words. Reports without the
  // marker are unaffected.
  const showPageNumbers = element.hasAttribute("data-pdf-page-numbers");

  // ── Page sizing and smart break calculation ──────────────────────────────
  // iOS Safari limits canvas height to ~4096px and total area to ~16 MP.
  // scale=1 produced visibly soft/pixelated text and images when a mobile-
  // generated PDF was zoomed in, so we bump it to 1.5 — MAX_PX/MAX_H stay the
  // same hard physical-pixel ceiling per captured canvas (PAGE_H below is
  // computed to respect them regardless of scale), so this only means
  // slightly shorter page slices on mobile, never a canvas-size violation.
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const scale    = isMobile ? 1.5 : 2;
  const MAX_PX   = isMobile ? 3_500_000 : 14_000_000;
  const MAX_H    = isMobile ? 3_500     : 7_000;
  // Target a real A4 sheet (210×297mm, matching pageWmm below) so each PDF
  // page prints as one physical A4 page at 100% scale instead of a tall
  // custom-size page that print dialogs squash down (shrinking the width
  // along with it, which reads as huge blank side margins on paper).
  // MAX_H/MAX_PX stay in place as an outer safety cap — the A4 height in
  // px is always far under them, so they no longer bind in practice.
  const A4_PAGE_H = 297 / PX_TO_MM;
  // Reserve room for the footer so content + footer stays within one page.
  const PAGE_H   = Math.max(200, Math.min(A4_PAGE_H, MAX_H, Math.floor(MAX_PX / (elWidth * scale))) - footerHpx - GAP_PX);

  // Content height without the (now hidden) footer.
  const contentHeight = footerEl ? element.scrollHeight : elHeight;

  // Positions of [data-pdf-no-break] cards relative to the element's top.
  // Must be computed before any marginTop manipulation.
  const elTop    = element.getBoundingClientRect().top;
  const noBreaks = Array.from(
    element.querySelectorAll<HTMLElement>("[data-pdf-no-break]"),
  ).map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - elTop, bottom: r.bottom - elTop };
  });

  // Positions of [data-pdf-page-break] elements — force a new page to start here.
  const pageBreaks = Array.from(
    element.querySelectorAll<HTMLElement>("[data-pdf-page-break]"),
  ).map((el) => el.getBoundingClientRect().top - elTop);

  // Build slice list — never break inside a no-break card; force break at page-break markers.
  const slices: { top: number; height: number }[] = [];
  let cursor = 0;

  while (cursor < contentHeight) {
    let end = cursor + PAGE_H;

    if (end >= contentHeight) {
      slices.push({ top: cursor, height: contentHeight - cursor });
      break;
    }

    // Force break at the nearest page-break marker that falls between cursor+1 and end.
    for (const pb of pageBreaks) {
      if (pb > cursor && pb < end) {
        end = pb;
        break;
      }
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

  console.log(`[PDF] scale=${scale}, PAGE_H=${PAGE_H}px, slices=${slices.length}, total=${contentHeight}px, footer=${footerHpx}px`);

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
      const contentHmm = pageH * PX_TO_MM;
      // When a repeating footer is used, each page is taller by the footer + gap.
      const pageHmm = contentHmm + (footerData ? gapMm + footerHmm : 0);

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

      pdf.addImage(imgData, "JPEG", 0, 0, pageWmm, contentHmm, undefined, "FAST");

      // Stamp the repeating footer at the bottom of every page.
      if (footerData) {
        pdf.addImage(footerData, "JPEG", 0, contentHmm + gapMm, pageWmm, footerHmm, undefined, "FAST");
      }

      // Digits-only page indicator (see comment above showPageNumbers).
      if (showPageNumbers && slices.length > 1) {
        pdf.setFontSize(9);
        pdf.setTextColor(140, 140, 140);
        pdf.text(`${i + 1} / ${slices.length}`, pageWmm / 2, pageHmm - 4, { align: "center" });
      }
    }
  } finally {
    // Always restore — even if html2canvas throws
    container.style.overflow = savedOverflow;
    container.style.height   = savedHeight;
    element.style.marginTop  = savedMarginTop;
    if (footerEl) footerEl.style.display = "";
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
