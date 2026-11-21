import { getSurveyType, SurveyReport } from "./types";
import { MarkFilter, matchesMark } from "./report-mark";
import type { SurveyType } from "./types";

/** How a list of two hundred reports is put in an order that helps. */
export type SortKey = "updated" | "created" | "name" | "type";

export const SORT_LABELS: Record<SortKey, string> = {
  updated: "עודכן לאחרונה",
  created: "תאריך יצירה",
  name: "שם האתר",
  type: "סוג הסקר",
};

/** What the button itself says — a phone has no room for the long form. */
export const SORT_SHORT: Record<SortKey, string> = {
  updated: "עודכן",
  created: "נוצר",
  name: "שם",
  type: "סוג",
};

/**
 * Putting a long list of reports in a useful order, and narrowing it.
 *
 * Kept apart from the screen so the rules can be tested on their own: with
 * two hundred and fifty reports, a sort that quietly drops the ones with no
 * date, or a filter that reads a missing survey type as a mismatch, is not
 * something a glance at the screen would catch.
 */

export type ListView = {
  query: string;
  sort: SortKey;
  /** undefined — every kind of survey. */
  type?: SurveyType;
  mark: MarkFilter;
};

export function arrangeReports(
  reports: SurveyReport[],
  view: ListView,
  searchFields: (report: SurveyReport) => (string | undefined)[],
): SurveyReport[] {
  const q = view.query.trim().toLowerCase();

  const kept = reports.filter((r) => {
    // A report written before the survey types existed counts as an
    // accessibility survey, which is what getSurveyType already decides.
    if (view.type && getSurveyType(r.surveyType).id !== view.type) return false;
    if (!matchesMark(r, view.mark)) return false;
    if (!q) return true;
    return searchFields(r).some((value) => (value ?? "").toLowerCase().includes(q));
  });

  return kept.sort(comparators[view.sort]);
}

const byName = (a: SurveyReport, b: SurveyReport) =>
  // A report with no name yet belongs with the others, not at one end: it
  // sorts as the empty string, which Hebrew collation puts first.
  (a.placeName ?? "").localeCompare(b.placeName ?? "", "he");

const comparators: Record<SortKey, (a: SurveyReport, b: SurveyReport) => number> = {
  updated: (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  created: (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  name: byName,
  // Within one kind of survey, the newest first — the order the consultant
  // would otherwise have to find by eye.
  type: (a, b) => {
    const left = getSurveyType(a.surveyType).label;
    const right = getSurveyType(b.surveyType).label;
    if (left !== right) return left.localeCompare(right, "he");
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  },
};
