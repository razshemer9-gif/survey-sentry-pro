import { SurveyReport } from "./types";

/**
 * The general-safety approval: its closing clauses, and how long it holds.
 *
 * Both used to be fixed. The clauses were five lines written into the page
 * and a sixth behind a tick box, so a consultant who needed to say something
 * else about a particular site had nowhere to say it. And the approval was
 * assumed to be open-ended, while in practice one is often given for a
 * single evening — a street festival, a school fair — and the hours it
 * covers are the whole point of it.
 */

/** What a general-safety report says when nobody has changed it. */
export const SAFETY_CLAUSES_DEFAULT: readonly string[] = [
  "המקום נבדק באזורים המיועדים להימצאות קהל בלבד.",
  "מובהר בזאת כי האישור שנמסר הינו עבור השירות שהתקבל ונכון לרגע הבדיקה בלבד.",
  "במידה ובוצע כל שינוי במקום לאחר הבדיקה, יש לעצור את הפעילות ולזמן בדיקה מחודשת.",
  "במידה וקיימות מערכות חשמל ו/או גז, מחובת המזמין לזמן בדיקה.",
  "אין לעשות כל שינוי במבנים אלא בידיעת הבודק ובאישורו. כל שינוי/שימוש שיעשה ללא אישור יהיה באחריות המזמין בלבד ותוקף האישור יבוטל.",
];

/** The sixth clause, which used to be the only one that could be left out. */
export const SAFETY_CLAUSE_OPTIONAL = "אין האישור מתייחס לבטיחות המשתמשים אלא לבטיחות הסביבה.";

/**
 * The clauses this report actually prints.
 *
 * A report written before the list could be edited has no safetyClauses of
 * its own; it keeps printing exactly what it printed then — the five fixed
 * lines, and the sixth if its tick box was on. Only once the consultant
 * edits the list does the report carry its own copy, and from then on what
 * is on screen is what is printed.
 */
export function safetyClauses(
  report: Pick<SurveyReport, "safetyClauses" | "selectedClauses">,
): string[] {
  return safetyClauseDrafts(report).filter((c) => c.trim());
}

/**
 * The same list as it stands in the editor, blank lines and all.
 *
 * Printing drops an empty clause, because an empty numbered line is not
 * something anybody meant to publish. Editing must not: pressing "הוספת
 * סעיף" adds an empty one to type into, and if the editor read the printed
 * list the new box would vanish the moment it appeared.
 */
export function safetyClauseDrafts(
  report: Pick<SurveyReport, "safetyClauses" | "selectedClauses">,
): string[] {
  if (report.safetyClauses) return [...report.safetyClauses];
  const sixth = report.selectedClauses === undefined || report.selectedClauses.includes(5);
  return sixth
    ? [...SAFETY_CLAUSES_DEFAULT, SAFETY_CLAUSE_OPTIONAL]
    : [...SAFETY_CLAUSES_DEFAULT];
}

/**
 * "22.11.2026 בשעה 22:00", or just the date when no time was given.
 *
 * The same reading the construction approval prints, because a consultant
 * holding both should not have to work out that they mean the same thing.
 */
export function formatValidUntil(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  const [datePart, timePart] = v.split("T");
  const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  const date = `${m[3]}.${m[2]}.${m[1]}`;
  const time = (timePart ?? "").match(/^(\d{2}:\d{2})/);
  return time ? `${date} בשעה ${time[1]}` : date;
}

/**
 * Findings and documentation are both photographed on site, and until now
 * both were filed as faults. A fire door that is perfectly in order, a
 * stage, the layout of a yard — they belong in the report because they
 * describe what was inspected, not because anything is wrong with them.
 */
export function isDocumentation(item: Pick<SurveyReport["items"][number], "documentation">): boolean {
  return item.documentation === true;
}

export function splitItems(report: Pick<SurveyReport, "items">) {
  const items = report.items ?? [];
  return {
    findings: items.filter((i) => !isDocumentation(i)),
    documentation: items.filter(isDocumentation),
  };
}
