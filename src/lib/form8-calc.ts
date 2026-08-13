// Calculators for Form 8's חלק ד' rows 4 and 5 — the two rows whose static
// text (in FORM8_REQUIREMENTS) is a lookup table rather than a fixed clause.
// These only ever produce a *suggestion* the consultant reviews and inserts
// manually — never write directly into the report, since the underlying
// regulations round in ways that can require professional judgment.

export interface Form8Bracket {
  label: string;       // e.g. "600–1,000"
  min: number;          // exclusive lower bound (min < n), except the first bracket which includes 0
  max: number | null;   // inclusive upper bound; null = no upper bound
}

// Single source of truth for bracket boundaries — both the UI (which
// highlights the matching row) and the formulas below index into the same
// array, so they can never disagree on which bracket applies.
function bracketIndexFor(brackets: Form8Bracket[], n: number): number {
  if (!Number.isFinite(n) || n <= 0) return -1;
  return brackets.findIndex((b) => n > b.min && (b.max === null || n <= b.max));
}

// טבלת עמדות צפייה מיוחדות — לפי כמות קהל/תפוסה
export const SEATING_BRACKETS: Form8Bracket[] = [
  { label: "עד 600", min: 0, max: 600 },
  { label: "600–1,000", min: 600, max: 1000 },
  { label: "1,000–3,000", min: 1000, max: 3000 },
  { label: "3,000–10,000", min: 3000, max: 10000 },
  { label: "מעל 10,000", min: 10000, max: null },
];

export function seatingBracketIndex(attendance: number): number {
  return bracketIndexFor(SEATING_BRACKETS, attendance);
}

// Returns the required number of special/accessible seating positions,
// rounded up (the conservative direction for an accessibility minimum).
export function computeSeatingPositions(attendance: number): number | null {
  switch (seatingBracketIndex(attendance)) {
    case 0: return Math.max(4, Math.ceil(attendance / 150));
    case 1: return Math.ceil(6 + 0.01 * attendance);
    case 2: return Math.ceil(4 + 0.01 * attendance);
    case 3: return Math.ceil(28 + 0.005 * attendance);
    case 4: return Math.ceil(63 + 0.0025 * attendance);
    default: return null;
  }
}

// טבלת בתי שימוש/תאים נגישים (תקנה 8.147) — לפי מספר מקומות ישיבה מיוחדים
export const UNITS_BRACKETS: Form8Bracket[] = [
  { label: "0–12", min: 0, max: 12 },
  { label: "13–24", min: 12, max: 24 },
  { label: "25–40", min: 24, max: 40 },
  { label: "41–60", min: 40, max: 60 },
  { label: "61 ומעלה", min: 60, max: null },
];

export function unitsBracketIndex(specialSeats: number): number {
  return bracketIndexFor(UNITS_BRACKETS, specialSeats);
}

export interface UnitsResult {
  count: number | null;     // null when the row just refers to clause 8.146 (no fixed number)
  sharedNote?: string;      // e.g. "שמתוכם 1 משותף לשני המינים"
  referToOther?: boolean;   // 0–12 bracket: no formula here, refers to clause 8.146
}

export function computeAccessibleUnits(specialSeats: number): UnitsResult | null {
  switch (unitsBracketIndex(specialSeats)) {
    case 0: return { count: null, referToOther: true };
    case 1: return { count: 3, sharedNote: "שמתוכם 1 משותף לשני המינים" };
    case 2: return { count: 4, sharedNote: "שמתוכם 1 משותף לשני המינים" };
    case 3: return { count: 5, sharedNote: "שמתוכם 2 משותפים לשני המינים" };
    // "5 ועוד 1 לכל 20 מקומות מיוחדים נוספים מעל 61" — at exactly 61 the count
    // is still the base 5; the +1-per-20 only counts places beyond 61.
    case 4: return { count: 5 + Math.ceil(Math.max(0, specialSeats - 61) / 20) };
    default: return null;
  }
}
