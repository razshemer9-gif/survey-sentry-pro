// Rows 6 and 7 of Form 8's חלק ד' are the only two that follow from another
// row rather than from professional judgment: the source form fixes both at
// one per special viewing position — "מושבים מותאמים-אחד ליד כל מקום צפיה"
// and "חניות נגישות-כסכום מקומות הצפייה". So once the consultant has read the
// table in row 4 and settled on a number, these two are that same number.
//
// Rows 4 and 5 deliberately stay manual: their tables carry formulas and
// rounding the regulations leave to the מורשה.

export const FORM8_DERIVED_ROW_IDS = [6, 7] as const;

/**
 * The viewing-position count the consultant wrote in row 4, or null when the
 * row holds no number yet.
 *
 * Row 4 is free text by design — the consultant reads the standard's table and
 * writes the requirement in their own words — so the count is read back from
 * what they wrote rather than from a second field beside it. A field of its own
 * only invited the audience figure to be typed there instead.
 *
 * The first number in the row is the count: the row is written as an answer
 * ("6", "נדרשות 6 עמדות צפייה מיוחדות"), so anything that follows — a clause
 * number, the capacity it was derived from — comes after it.
 */
export function viewingPositionsFromText(text: string): number | null {
  const match = text.match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The text row `id` should hold for `positions` special viewing positions,
 * or null when the row isn't one of the derived two.
 */
export function derivedRowText(id: number, positions: number): string | null {
  if (!Number.isFinite(positions) || positions <= 0) return null;
  switch (id) {
    case 6: return `${positions} מושבים מותאמים — אחד ליד כל מקום צפייה מיוחד.`;
    case 7: return `${positions} חניות נגישות — כמספר מקומות הצפייה המיוחדים.`;
    default: return null;
  }
}
