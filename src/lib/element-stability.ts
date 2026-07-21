// ── Element stability inspection — deterministic constants ──────────────────
// דוח בדיקת יציבות אלמנטים. All copy lives here as plain text so it can be
// reviewed/corrected easily (no OCR dependency at render time) and so the PDF
// keeps the text selectable/searchable rather than baking it into an image.

// Default fixed terms shown under the result ("המתקנים נמצאו יציבים").
// Extracted from the reference form. Each report may override these
// (SurveyReport.stabilityTerms); the "{validUntil}" token in the last clause
// is replaced at render time with report.elementValidUntil.
//
// NOTE (OCR review): clause 3 in the reference reads "...לפי תקנים רלוונטיים...".
// The scanned image showed a spurious "שש" between "תקנים" and "רלוונטיים"
// that appears to be a watermark artifact and was dropped. Verify against a
// clean copy of the source document and adjust here if needed.
export const ELEMENT_STABILITY_DEFAULT_TERMS: string[] = [
  'האלמנטים אשר הוצבו ע"י המזמין נמצאו מורכבים באופן יציב ובצורה תקינה.',
  'אישור זה מתייחס רק אל האלמנטים המפורטים בו, אשר הוצבו ע"י המזמין.',
  'הנני מאשר שהעבודות בוצעו בהתאם להנחיות ולדרישות החוזק, לפי תקנים רלוונטיים בהתאם לשביעות רצוני ואין לי הערות לגבי הביצוע.',
  "תוקף האישור הינו ליום הבדיקה בלבד.",
  "האישור אינו מתייחס לתשתיות המקום.",
  "אין לעשות כל שינוי באלמנטים אלא בידיעת המזמין ובאישורו. כל שינוי באלמנטים מצריך בדיקת יציבות חדשה.",
  'דו"ח זה הינו דו"ח הנדסי ולא דו"ח משפטי ואינו מהווה עדות לבית המשפט.',
  "תוקף הבדיקה הינו לשנה ועד לתאריך ה {validUntil}",
];

export const ELEMENT_STABILITY_RESULT_STABLE = "המתקנים נמצאו יציבים";
export const ELEMENT_STABILITY_RESULT_UNSTABLE = "המתקנים נמצאו לא יציבים";

// Footer shown at the bottom of every page. Falls back to these values when the
// consultant settings don't provide company details. Replaceable via settings.
export const ELEMENT_STABILITY_FOOTER = {
  company: 'שמר בטיחות יועצים בע"מ',
  phone: "052-2321144",
  email: "maris@shemerl.co.il",
  website: "www.shemersafety.co.il",
};

// Returns the effective term list for a report, with {validUntil} substituted.
export function resolveStabilityTerms(
  terms: string[] | undefined,
  validUntil?: string,
): string[] {
  const source = terms && terms.length > 0 ? terms : ELEMENT_STABILITY_DEFAULT_TERMS;
  return source.map((t) => t.replace("{validUntil}", validUntil || "__________"));
}
