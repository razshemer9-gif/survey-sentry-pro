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
  const scaleForFooter = 2.5;
  // JPEG quality for every captured slice. 0.95 left visible ringing around
  // Hebrew glyph edges; 0.98 removes most of it for a modest size increase.
  const JPEG_QUALITY = 0.98;
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
    footerData = fCanvas.toDataURL("image/jpeg", JPEG_QUALITY);
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
  // The PDF contains bitmaps, not text, so `scale` alone decides how sharp the
  // Hebrew glyphs, table rules and photographs look when the reader zooms in.
  //
  // The three quantities below are deliberately separated:
  //
  //   scale     raster resolution — the ONLY knob to turn for sharpness.
  //   TARGET_H  content height per page slice. This is what determines where
  //             pages break, so it is pinned to the values these reports have
  //             always used. Never tune it to chase image quality: changing it
  //             re-paginates every existing report.
  //   MAX_PX /  hard canvas ceilings (iOS Safari caps canvas height at ~4096px
  //   MAX_H     and total area at ~16 MP). They are safety clamps only; they
  //             are sized so TARGET_H — not the area budget — is what binds,
  //             which is what keeps pagination identical across a scale change.
  //
  // Resulting canvases: desktop 1985 x 7000 (13.9 MP), mobile 1588 x 2938
  // (4.7 MP, height well under the 4096 cap).
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const scale    = isMobile ? 2 : 2.5;
  const TARGET_H = isMobile ? 2_938     : 7_000;
  const MAX_PX   = isMobile ? 8_000_000 : 24_000_000;
  const MAX_H    = isMobile ? 3_500     : 7_000;
  // Reserve room for the footer so content + footer stays within the canvas cap.
  const PAGE_H   = Math.max(
    200,
    Math.min(TARGET_H, MAX_H, Math.floor(MAX_PX / (elWidth * scale))) - footerHpx - GAP_PX,
  );

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
    // Cap at content end up front (rather than only checking this after page-break
    // handling) so a forced break is still honored even when the remaining content
    // would otherwise all fit in one slice — previously, whenever cursor + PAGE_H
    // already reached the end of the document, the loop took a shortcut that pushed
    // the *entire* remainder as a single slice without ever consulting `pageBreaks`,
    // silently ignoring every data-pdf-page-break marker in reports short enough to
    // fit under PAGE_H (e.g. welfare_inspection's officially-multi-page government
    // form collapsing onto one or two continuous slices instead of five).
    let end = Math.min(cursor + PAGE_H, contentHeight);

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
      end = tall ? tall.bottom : Math.min(cursor + PAGE_H, contentHeight);
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

      const imgData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

      // jsPDF's [w, h] format array must match the orientation label it's
      // given, or jsPDF "corrects" it by swapping w/h — e.g. asking for
      // "portrait" with a slice shorter than it is wide (any section that
      // doesn't fill a full page) silently swaps to [h, w], while the image
      // is still placed using the original pageWmm/contentHmm, so the right
      // side of the content lands outside the now-narrower page and gets
      // clipped. Every one of our slices is conceptually a portrait page —
      // just label it "landscape" whenever it happens to be wider than tall
      // so jsPDF's swap-correction never fires and the MediaBox always
      // matches exactly what was drawn.
      const pageOrientation = pageHmm < pageWmm ? "landscape" : "portrait";
      if (i === 0) {
        pdf = new jsPDF({
          orientation: pageOrientation,
          unit:        "mm",
          format:      [pageWmm, pageHmm],
        });
      } else {
        (pdf as any).addPage([pageWmm, pageHmm], pageOrientation);
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
