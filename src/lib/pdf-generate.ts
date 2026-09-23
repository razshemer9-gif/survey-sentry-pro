// Heavy PDF generation — jsPDF + html2canvas live ONLY here.
// This module is loaded on demand (dynamic import) when the user actually
// generates a PDF, keeping the libraries out of the initial bundle.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { isMobileDevice } from "./pdf";

/**
 * How the finished PDF reached the user: straight into the share sheet
 * (mobile) or as a download (desktop, or a share the browser refused).
 */
export type PdfDelivery = "shared" | "downloaded";

/**
 * Whether this browser can actually rasterize a canvas of this size.
 *
 * iOS Safari caps canvas area, silently: over the cap the canvas allocates but
 * draws nothing, so a PDF comes out blank rather than failing. The cap differs
 * by device and iOS version, so instead of assuming the smallest one, draw a
 * known pixel in the far corner and read it back.
 */
function canvasRenders(width: number, height: number): boolean {
  let c: HTMLCanvasElement | null = null;
  try {
    c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = "rgb(18,52,86)";
    ctx.fillRect(width - 2, height - 2, 2, 2);
    const [r, g, b] = ctx.getImageData(width - 1, height - 1, 1, 1).data;
    return r === 18 && g === 52 && b === 86;
  } catch {
    return false;
  } finally {
    // Let the memory go immediately rather than at the next GC.
    if (c) { c.width = 0; c.height = 0; }
  }
}

export async function generateReportPdf(
  element: HTMLElement | null,
  fileName: string,
): Promise<PdfDelivery> {
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

  // ── Closing footer (opt-in) ──────────────────────────────────────────────
  // A report may mark one element with [data-pdf-page-footer]. When present we
  // capture it once, remove it from the sliced content flow, and stamp it at
  // the foot of the LAST page — it closes the report rather than running along
  // the bottom of every page, which is how it read when a long report spilled
  // onto another page. Reports without such an element are unaffected.
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
  // The whole report is rasterized, so the capture scale is what a reader sees
  // when they zoom in on the PDF. Take the sharpest scale this browser will
  // actually render — each candidate is probed at the exact canvas size it
  // would need, so a device that cannot take it falls back instead of
  // producing blank pages. The slice heights are chosen to stay at least as
  // long as the old ones, so a sharper report is not also a longer one.
  const isMobile = isMobileDevice();
  const candidates = isMobile
    ? [{ scale: 2,   maxPx:  5_200_000, maxH: 3_500 },
       { scale: 1.5, maxPx:  3_500_000, maxH: 3_500 }]
    : [{ scale: 3,   maxPx: 17_000_000, maxH: 7_000 },
       { scale: 2,   maxPx: 14_000_000, maxH: 7_000 }];

  const pageHeightFor = (c: { scale: number; maxPx: number; maxH: number }) =>
    Math.max(200, Math.min(c.maxH, Math.floor(c.maxPx / (elWidth * c.scale))) - footerHpx - GAP_PX);

  const chosen = candidates.find((c) =>
    canvasRenders(Math.ceil(elWidth * c.scale), Math.ceil(pageHeightFor(c) * c.scale)),
  ) ?? candidates[candidates.length - 1];

  const scale  = chosen.scale;
  const PAGE_H = pageHeightFor(chosen);

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
      // Only the closing page carries the footer, so only it is taller by the
      // footer + gap. Pages are sized to their own slice, so the others simply
      // end where their content does — no band is held open for a footer that
      // is not drawn on them.
      const drawFooterHere = !!footerData && i === slices.length - 1;
      const pageHmm = contentHmm + (drawFooterHere ? gapMm + footerHmm : 0);

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

      // Stamp the closing footer, on the last page only.
      if (drawFooterHere) {
        pdf.addImage(footerData!, "JPEG", 0, contentHmm + gapMm, pageWmm, footerHmm, undefined, "FAST");
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

  // ── Deliver ──────────────────────────────────────────────────────────────
  const blob = pdf.output("blob");

  // The report is handed over twice: first to the browser, which on a phone
  // opens it in the PDF viewer so the consultant can read what they are about
  // to send, and then — on a phone that can take a file — to the OS share
  // sheet, so sending it is one tap away.
  //
  // The share carries `files` ONLY: no title, no text, no url. Sharing from
  // Safari's own viewer instead attaches the page address, which is how
  // WhatsApp ended up with a stray "blob:https://…" line beside the file, and
  // "Save to Files" from this sheet writes the File object's own UTF-8 name
  // rather than one iOS re-derives from that blob URL and mangles.
  const url = URL.createObjectURL(blob);
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
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const file = new File([blob], fileName, { type: "application/pdf" });
  if (isMobile && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      // Dismissing the sheet is a choice, not a failure, and the file has
      // already been handed over either way — so nothing is reported.
      if ((err as DOMException)?.name !== "AbortError") {
        console.warn("[PDF] share sheet unavailable", err);
      }
    }
  }
  return "downloaded";
}
