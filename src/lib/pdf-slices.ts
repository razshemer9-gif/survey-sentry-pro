// Where the printed report is cut into pages.
//
// Kept apart from ./pdf-generate — which drags in jsPDF and html2canvas — so
// that this arithmetic can be tested on its own. It is worth testing: every
// page-break fault consultants reported lived here, and one of them (a slice
// that rounded to zero height) hung the tab in a loop that never advanced, so
// "הפק PDF" simply did nothing.
//
// Two kinds of number meet in here, which is where the faults came from: the
// card and marker offsets are measured with getBoundingClientRect and carry
// fractions, while the document height and every page boundary are whole
// pixels. Each measurement is therefore rounded to the pixel grid ONCE, up
// front, and the arithmetic below works on the rounded values only.

export interface NoBreakCard {
  /** Offsets from the top of the report element, in CSS pixels. */
  top: number;
  bottom: number;
}

export interface SliceInput {
  contentHeight: number;
  /** The tallest slice this device can capture. */
  pageH: number;
  /** Cards that must not be split across pages ([data-pdf-no-break]). */
  noBreaks: NoBreakCard[];
  /** Offsets where a new page is forced to start ([data-pdf-page-break]). */
  pageBreaks: number[];
}

export interface Slice {
  top: number;
  height: number;
}

/**
 * How far a break may sit from a card's edge and still count as being on it.
 * Half a pixel is below what the rasterizer can draw, so treating such a break
 * as a split only cost pages: it pulled a card down for a gap nobody could see.
 */
const EDGE = 0.5;

export function computeSlices(input: SliceInput): Slice[] {
  const { pageH, noBreaks } = input;

  // The last card can end a fraction of a pixel PAST the height the document
  // reports, because scrollHeight is rounded down while the card's own bottom
  // is not. That fraction is invisible, but it made the end of the document
  // look like a break inside the closing card: the card was pushed onto a page
  // of its own, and Form 8 ended on a stub page holding nothing but the
  // מורשה's name, registration numbers and stamp. Take the document to the
  // furthest edge either measurement knows about.
  const contentEnd = Math.ceil(noBreaks.reduce((h, c) => Math.max(h, c.bottom), input.contentHeight));

  // A forced marker has to be rounded like the boundary it produces. At 932.03
  // it was not: the page ended at 932, the marker still sat ahead of the
  // cursor, and it was honoured a second time as a page one pixel tall.
  const marks = input.pageBreaks.map((p) => Math.round(p)).filter((p) => p > 0 && p < contentEnd);

  const slices: Slice[] = [];
  let cursor = 0;

  while (cursor < contentEnd) {
    // Cap at the content end up front — rather than only after the page-break
    // handling — so a forced break is honoured even when everything left would
    // otherwise fit in one slice. Without this, a report shorter than pageH
    // was pushed out as a single slice and every marker in it ignored, which
    // collapsed the welfare inspection's five official pages into one.
    let end = Math.min(cursor + pageH, contentEnd);

    // Break at the first forced marker inside this slice.
    for (const pb of marks) {
      if (pb > cursor && pb < end) {
        end = pb;
        break;
      }
    }

    // Pull the break earlier while it lands inside a card that must not split.
    // This repeats because moving the break up to one card's top can drop it
    // inside the card above, and doing it once left that card cut in half.
    for (let guard = 0; guard <= noBreaks.length; guard++) {
      const straddled = noBreaks.find((nb) => nb.top < end - EDGE && nb.bottom > end + EDGE);
      if (!straddled) break;
      end = straddled.top;
    }

    // A card taller than a whole slice has to overflow its page rather than be
    // cut, so the break goes to its bottom edge.
    if (end <= cursor) {
      const tall = noBreaks.find((nb) => nb.top <= cursor && nb.bottom > cursor + EDGE);
      end = tall ? Math.ceil(tall.bottom) : Math.min(cursor + pageH, contentEnd);
    }

    // Whole pixels, and always at least one of them. html2canvas rounds the
    // capture height and the slide-up margin separately, so a fractional
    // boundary slices the last row of glyphs across two pages. Rounding alone,
    // though, could land a slice back on the cursor it started from: that one
    // is zero pixels tall, the cursor never moves, and the loop spins forever.
    end = Math.max(cursor + 1, Math.round(end));
    slices.push({ top: cursor, height: end - cursor });
    cursor = end;
  }

  return avoidOrphanTail(slices, pageH, noBreaks, marks);
}

/**
 * A page holding nothing but the block that closes the report reads as a
 * mistake. It happens because that block must not be split, so a break landing
 * inside it pushes the whole thing to a page of its own with nothing after it.
 *
 * The fix moves the boundary EARLIER, taking the card before it down to the
 * closing page as well, so the report ends on a page that holds the signature
 * section rather than a stub. Pages here are cut to their own content, so a
 * shorter page leaves no gap — and nothing grows, which matters because the
 * page height is bounded by what the device can rasterize.
 */
function avoidOrphanTail(slices: Slice[], pageH: number, noBreaks: NoBreakCard[], marks: number[]): Slice[] {
  if (slices.length < 2) return slices;

  const last = slices[slices.length - 1];
  const prev = slices[slices.length - 2];
  if (last.height >= pageH * 0.25) return slices;

  const lastTop = last.top;
  const lastEnd = last.top + last.height;

  // The card that currently ends the page before, pulled down whole.
  const card = [...noBreaks]
    .filter((c) => c.top > prev.top && c.bottom <= lastTop + EDGE)
    .sort((a, b) => b.top - a.top)[0];
  if (!card) return slices;

  const boundary = Math.round(card.top);
  // Don't cross a forced break, don't empty the page before, and don't make
  // the closing page taller than a page.
  if (boundary <= prev.top) return slices;
  if (marks.some((pb) => pb > boundary && pb <= lastTop)) return slices;
  if (lastEnd - boundary > pageH) return slices;

  prev.height = boundary - prev.top;
  last.top = boundary;
  last.height = lastEnd - boundary;
  return slices;
}
