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

/**
 * The disclaimers printed under the required approvals.
 *
 * They say what a survey is and, more to the point, what it is not: a
 * visual inspection of what could be reached on one day, not a licence, not
 * an occupancy permit, and not a promise that nothing was missed. The last
 * matters most — a report that reads as a guarantee is the one that gets
 * quoted back at you.
 *
 * Kept as plain sentences rather than one block of text so that any of them
 * can be taken out for a particular job without retyping the rest.
 */
export const RISK_DISCLAIMERS_DEFAULT: readonly string[] = [
  "הממצאים והמסקנות המפורטים בדוח זה משקפים את מצב הבטיחות במקום במועד ביצוע הסקר בלבד, בהתאם לתנאים ולממצאים שנצפו בעת הביקור.",
  "כל שינוי במבנה, במערכות, בציוד, בשימושים או בתנאי הפעילות לאחר מועד הבדיקה עשוי להשפיע על תוקף הממצאים.",
  "הסקר מבוסס על בדיקה חזותית ומקצועית של האזורים שנבדקו והיו נגישים במועד הביקור, אלא אם צוין אחרת בדוח.",
  "אין לראות בסקר בדיקה מקיפה וממצה של כלל הסיכונים האפשריים או של רכיבים ומערכות המחייבים בדיקות ייעודיות.",
  "דוח זה אינו מהווה אישור בטיחות סופי, אישור להפעלת המקום, אישור אכלוס, רישיון עסק או תחליף לכל אישור הנדרש על פי דין מטעם רשות מוסמכת או בעל מקצוע מורשה.",
  "האחריות לביצוע ההמלצות, לתיקון הליקויים המפורטים בדוח, לשמירה על תנאי בטיחות נאותים ולביצוע בדיקות תקופתיות ותחזוקה שוטפת חלה על בעלי המקום, מחזיקיו או הגורם האחראי להפעלתו, בהתאם לחובות החלות עליהם.",
  "ככל שנדרשות בדיקות נוספות, אישורי בעלי מקצוע, בדיקות מערכות או אישורים מטעם גורמים מוסמכים, יש להשלימם בנפרד. עריכת הסקר אינה מחליפה דרישות אלה.",
  "עצם עריכת הסקר והפקת הדוח אינן מהוות אישור לתיקון הליקויים או לעמידת המקום בדרישות הבטיחות. אישור כאמור, ככל שיידרש, יינתן רק לאחר ביצוע הבדיקות והאימותים המתאימים.",
  "דוח זה מהווה כלי מקצועי לאיתור מפגעים ולשיפור רמת הבטיחות במקום. אין בו כדי להבטיח היעדר מוחלט של סיכונים או מפגעים שלא אותרו במועד הבדיקה.",
];

/**
 * The disclaimers as the editor holds them, blank lines and all.
 *
 * A half-typed clause has to survive being typed, so nothing is filtered
 * here. Unset means the standard set; `??` keeps "never touched" apart from
 * "cleared on purpose", exactly as the approvals do.
 */
export function riskDisclaimerDrafts(
  report: { riskDisclaimers?: string[] },
): string[] {
  return report.riskDisclaimers ?? [...RISK_DISCLAIMERS_DEFAULT];
}

/** The disclaimers that print: the drafts, minus anything left blank. */
export function riskDisclaimers(report: { riskDisclaimers?: string[] }): string[] {
  return riskDisclaimerDrafts(report).filter((line) => line.trim());
}
