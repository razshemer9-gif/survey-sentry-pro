// ── Risk survey (סקר סיכונים) — deterministic constants ─────────────────────

export const RISK_SURVEY_DEFAULT_FENCING_NOTE =
  'חיבור בין גדרות באמצעות אזיקונים אינו מאושר באירוע. יש לחבר את מקטעי הגידור זה לזה באמצעות חבקים או מחברים ייעודיים, תקינים ומתאימים למערכת הגידור.';

export const RISK_SURVEY_SUBTITLE =
  "תיעוד מפגעים סביבתיים שנמצאו בשטח לקראת האירוע";

/**
 * The hazards that reach the printed page.
 *
 * A hazard can be written down before there is a photograph of it or a word
 * describing it, so that one noticed at the gate with no camera to hand can
 * still be recorded. One still being filled in must not print: an empty
 * bordered box in a PDF handed to a client reads as something that went
 * wrong, not as work in progress.
 */
export function printableHazards<T extends { photo?: string; fieldNotes?: string }>(
  items: readonly T[],
): T[] {
  return items.filter((item) => item.photo || (item.fieldNotes ?? "").trim());
}

/**
 * The approvals a risk survey asks for.
 *
 * All five are required unless somebody says otherwise, which is the way
 * round that matches the work: an event is assumed to need its structure,
 * its electrics, its gas and its trees signed off, and it is the surveyor
 * who knows which of those does not apply here. Opt-out, not opt-in — the
 * danger is the approval nobody remembered to tick.
 */
export const RISK_APPROVALS_DEFAULT: readonly string[] = [
  "קונסטרוקציה",
  "אישור חשמלאי בודק",
  "אישור חשמלאי מוסמך",
  "אישור טכנאי גז",
  "אישור אגרונום",
];

/**
 * The approvals this report carries.
 *
 * An unset list means the report has never been touched, and gets all five.
 * An empty list means somebody cleared them on purpose and gets none — so
 * `??` rather than `||`, because the two cases have to stay distinguishable
 * and `[] || x` would quietly give back the defaults the surveyor had just
 * finished removing.
 */
export function riskApprovals(
  report: { requiredApprovals?: string[] },
): string[] {
  return report.requiredApprovals ?? [...RISK_APPROVALS_DEFAULT];
}
