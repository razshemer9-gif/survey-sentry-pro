import { SurveyReport } from "./types";

/**
 * A mark the consultant puts on a report, by hand.
 *
 * Green and red, and what they mean is theirs to decide — done and not
 * done, approved and rejected, paid and unpaid. The app never sets it,
 * never infers it, and never prints it: it exists so a list of two hundred
 * reports can be narrowed to the ones that still need something.
 *
 * It has nothing to do with the statuses inside a report. Those belong to
 * the findings — תקין, לא תקין, לא רלוונטי — are set while surveying, and
 * are what the PDF is built from. This is a flag on the folder, not a
 * judgement about the work.
 */

export type ReportMark = "green" | "red";

/** Pressing the mark walks these in order and comes back round. */
const CYCLE: (ReportMark | undefined)[] = [undefined, "green", "red"];

export function nextMark(current: ReportMark | undefined): ReportMark | undefined {
  const at = CYCLE.findIndex((m) => m === current);
  return CYCLE[(at + 1) % CYCLE.length];
}

export function markLabel(mark: ReportMark | undefined): string {
  if (mark === "green") return "מסומן בירוק";
  if (mark === "red") return "מסומן באדום";
  return "ללא סימון";
}

/** Chosen for a dark card and a white one alike; both clear 3:1 on each. */
export function markColor(mark: ReportMark, isDark: boolean): string {
  if (mark === "green") return isDark ? "#3ED47A" : "#128A42";
  return isDark ? "#FF6B6B" : "#C62828";
}

/** The filter the list offers. "none" means reports with no mark at all. */
export type MarkFilter = "all" | ReportMark | "none";

export function matchesMark(report: SurveyReport, filter: MarkFilter): boolean {
  if (filter === "all") return true;
  if (filter === "none") return !report.mark;
  return report.mark === filter;
}
