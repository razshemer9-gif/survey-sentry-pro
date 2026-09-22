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
