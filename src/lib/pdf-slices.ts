// Where the printed report is cut into pages.
//
// Kept apart from ./pdf-generate — which drags in jsPDF and html2canvas — so
// that this arithmetic can be tested on its own. It is worth testing: the two
// page-break faults consultants reported both lived here, and the second one
// (a slice that rounded to zero height) hung the tab in a loop that never
// advanced, so "הפק PDF" simply did nothing.

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

export function computeSlices({ contentHeight, pageH, noBreaks, pageBreaks }: SliceInput): Slice[] {
  const slices: Slice[] = [];
  let cursor = 0;

  while (cursor < contentHeight) {
    // Cap at the content end up front — rather than only after the page-break
    // handling — so a forced break is honoured even when everything left would
    // otherwise fit in one slice. Without this, a report shorter than pageH
    // was pushed out as a single slice and every marker in it ignored, which
    // collapsed the welfare inspection's five official pages into one.
    let end = Math.min(cursor + pageH, contentHeight);

    // Break at the first forced marker inside this slice.
    for (const pb of pageBreaks) {
      if (pb > cursor && pb < end) {
        end = pb;
        break;
      }
    }

    // Pull the break earlier while it lands inside a card that must not split.
    // This repeats because moving the break up to one card's top can drop it
    // inside the card above, and doing it once left that card cut in half.
    for (let guard = 0; guard <= noBreaks.length; guard++) {
      const straddled = noBreaks.find((nb) => nb.top < end && nb.bottom > end);
      if (!straddled) break;
      end = straddled.top;
    }

    // A card taller than a whole slice has to overflow its page rather than be
    // cut, so the break goes to its bottom edge.
    if (end <= cursor) {
      const tall = noBreaks.find((nb) => nb.top <= cursor && nb.bottom > cursor);
      end = tall ? tall.bottom : Math.min(cursor + pageH, contentHeight);
    }

    // Whole pixels, and always at least one of them. The offsets above are
    // fractional, and html2canvas rounds the capture height and the slide-up
    // margin separately — a sub-pixel disagreement slices the last row of
    // glyphs across two pages. Rounding alone, though, can land a slice back
    // on the cursor it started from: that one is zero pixels tall, the cursor
    // never moves, and the loop spins forever.
    end = Math.max(cursor + 1, Math.round(end));
    slices.push({ top: cursor, height: end - cursor });
    cursor = end;
  }

  return slices;
}
