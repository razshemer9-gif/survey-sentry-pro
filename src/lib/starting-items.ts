import { v4 as uuid } from "uuid";
import { ChecklistItem, ChecklistTemplate, SurveyType } from "./types";

/**
 * The saved list an accessibility survey starts from.
 *
 * This list is the consultant's professional work: for each finding it
 * carries the clause of the standard, the correction to propose, and the
 * reference drawing or photograph that goes with it. The app used to call
 * it a "תבנית" and gave it a page of its own. That page is gone — a new
 * account had no list and was told to go and build one before it could
 * start a survey at all — but the list itself is still in the database and
 * is still what a survey has to begin from. Everything here is the plumbing
 * that reads it; nothing shows it to anybody.
 *
 * Saved lists for the other report types are deliberately left alone. The
 * safety surveys are written from what the inspector finds on site, and the
 * education survey had an accessibility list saved against it, which is the
 * very thing the editor strips out when one of those reports is opened.
 */
export const TYPES_WITH_SAVED_START: SurveyType[] = ["accessibility"];

/** A row of user_templates, as the database hands it over. */
export interface SavedListRow {
  id: string;
  name: string;
  survey_type: string | null;
  /** Absent on an account's own rows fetched the narrow way. */
  user_id?: string;
  /** The company list, published from the owner's account for everyone. */
  shared?: boolean;
}

/**
 * Hebrew quotation marks are typed both ways — ״ and " for gershayim, ׳ and
 * ' for geresh — so a name saved with one spelling still matches a label
 * written with the other.
 */
const normalize = (s: string) => s.trim().replace(/[״"]/g, '"').replace(/[׳']/g, "'");

/**
 * Which saved list a new report of this type starts from, or null when
 * there is none — in which case the built-in checklist is used and the
 * report still opens.
 *
 * An account's own list wins; failing that, the company list the owner
 * publishes, so that an employee starting an accessibility survey begins
 * from the same 39 findings as the consultant rather than from bare
 * titles. Within each, a row tagged with the report type wins over one
 * merely named after it — the older rows predate the tag and are tied to a
 * type only by their name.
 *
 * `userId` null (signed out, or an identity that could not be read) leaves
 * only the company list, which is the safe way round: a list is never
 * treated as this account's own unless it is known to be.
 */
export function pickSavedList(
  rows: SavedListRow[],
  surveyType: SurveyType,
  surveyLabel: string,
  userId?: string | null,
): SavedListRow | null {
  const match = (within: SavedListRow[]) =>
    within.find((r) => r.survey_type === surveyType) ??
    within.find((r) => normalize(r.name) === normalize(surveyLabel));

  // A row with no user_id came from a read that asked for this account's
  // rows only, so it is this account's.
  const own = rows.filter((r) => r.user_id === undefined || r.user_id === userId);
  const company = rows.filter((r) => r.shared && r.user_id !== undefined && r.user_id !== userId);
  return (userId ? match(own) : undefined) ?? match(company) ?? null;
}

/**
 * Turns a saved list into the findings a new report opens with. Each one
 * gets its own id and starts as not-compliant, to be worked through on site;
 * everything the consultant prepared — the proposed correction, the clause,
 * the reference photographs — is carried across as it stands.
 */
export function savedListToItems(items: ChecklistTemplate["items"]): ChecklistItem[] {
  return items.map((i) => ({
    id: uuid(),
    title: i.title,
    status: "non_compliant" as const,
    notes: i.notes || "",
    estimatedCost: i.defaultCost || 0,
    ...(i.defaultPriority !== undefined && { priority: i.defaultPriority }),
    ...(i.includeInCost !== undefined && { includeInCost: i.includeInCost }),
    ...(i.referencePhoto && { referencePhoto: i.referencePhoto }),
    ...(i.referencePhotos?.length && { referencePhotos: i.referencePhotos }),
    ...(i.referenceLabel && { referenceLabel: i.referenceLabel }),
    ...(i.suggestedCorrection && { suggestedCorrection: i.suggestedCorrection }),
    ...(i.matchedRequirementId && { matchedRequirementId: i.matchedRequirementId }),
    ...(i.standardPart && { standardPart: i.standardPart }),
    ...(i.clause && { clause: i.clause }),
  }));
}
