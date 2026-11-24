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
