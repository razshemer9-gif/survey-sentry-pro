import { describe, expect, it } from "vitest";
import { computeSlices, type SliceInput } from "./pdf-slices";

const run = (patch: Partial<SliceInput>) =>
  computeSlices({ contentHeight: 1000, pageH: 400, noBreaks: [], pageBreaks: [], ...patch });

const covers = (slices: { top: number; height: number }[], contentHeight: number) => {
  let at = 0;
  for (const s of slices) {
    expect(s.top).toBe(at);
    expect(s.height).toBeGreaterThan(0);
    at = s.top + s.height;
  }
  expect(at).toBeGreaterThanOrEqual(contentHeight);
};

describe("computeSlices", () => {
  it("walks the document in order, leaving no gap and no overlap", () => {
    covers(run({}), 1000);
  });

  it("starts a new slice at every forced break", () => {
    const slices = run({ contentHeight: 900, pageH: 800, pageBreaks: [300, 600] });
    expect(slices.map((s) => s.top)).toEqual([0, 300, 600]);
  });

  it("honours a forced break even when the rest would fit in one slice", () => {
    const slices = run({ contentHeight: 200, pageH: 1000, pageBreaks: [120] });
    expect(slices.map((s) => s.top)).toEqual([0, 120]);
  });

  it("pulls a break back out of a card rather than splitting it", () => {
    const slices = run({ contentHeight: 1000, pageH: 400, noBreaks: [{ top: 380, bottom: 450 }] });
    expect(slices[0].height).toBe(380);
  });

  it("keeps pulling back when the move lands inside the card above", () => {
    // 395 sits inside the lower card; its top, 360, sits inside the upper one.
    const slices = run({
      contentHeight: 1000,
      pageH: 400,
      noBreaks: [{ top: 300, bottom: 370 }, { top: 360, bottom: 450 }],
    });
    expect(slices[0].height).toBe(300);
    for (const s of slices) {
      for (const card of [{ top: 300, bottom: 370 }, { top: 360, bottom: 450 }]) {
        const end = s.top + s.height;
        expect(card.top < end && card.bottom > end, `break at ${end} splits a card`).toBe(false);
      }
    }
  });

  it("lets a card taller than a page overflow rather than cutting it", () => {
    const slices = run({ contentHeight: 1000, pageH: 400, noBreaks: [{ top: 0, bottom: 520 }] });
    expect(slices[0].height).toBe(520);
  });

  // The regression that hung the tab: rounding could land the slice back on
  // the cursor it started from, so the loop never advanced and "הפק PDF" did
  // nothing at all.
  it("always advances, even when a break sits a fraction of a pixel ahead", () => {
    const slices = run({ contentHeight: 50.6, pageH: 400, noBreaks: [{ top: 0.2, bottom: 50.4 }], pageBreaks: [0.3] });
    covers(slices, 50.6);
    expect(slices.length).toBeLessThan(10);
  });

  it("advances through a run of cards that all start on fractions", () => {
    const noBreaks = Array.from({ length: 30 }, (_, i) => ({ top: i * 33.4, bottom: i * 33.4 + 33.1 }));
    const slices = computeSlices({ contentHeight: 1002, pageH: 200, noBreaks, pageBreaks: [100.2, 400.7] });
    covers(slices, 1002);
    expect(slices.length).toBeLessThan(40);
  });

  it("returns whole-pixel boundaries", () => {
    for (const s of run({ contentHeight: 997.3, pageH: 333.7 })) {
      expect(Number.isInteger(s.top)).toBe(true);
      expect(Number.isInteger(s.height)).toBe(true);
    }
  });
});
