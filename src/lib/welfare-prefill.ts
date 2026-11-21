import { ConsultantSettings, SurveyReport } from "./types";

/**
 * The inspector's own details on a welfare inspection report.
 *
 * These never change from one inspection to the next, and yet the form asked
 * for all eight of them every time. Retyping the same reference numbers into
 * every report is how small discrepancies get onto documents that go to a
 * ministry: a digit dropped here, a different spacing there.
 *
 * So a new welfare report starts with them filled in from the account, where
 * they are written once. They stay editable — the inspector on a given
 * inspection may not be the account holder.
 *
 * Four of them live in the account's general details, where the reports
 * already draw the consultant's name, telephone and e-mail. The rest are
 * particular to this form — identity number, qualification, registration
 * number, years of experience — and are kept with the welfare report's own
 * settings.
 *
 * What is deliberately NOT filled in: the signatory. That is whoever signs
 * for the framework being inspected, a different person each time.
 */
export function welfareInspectorPrefill(settings: ConsultantSettings): Partial<SurveyReport> {
  const fmt = settings.reportFormats?.welfare_inspection;
  const { first, last } = splitName(settings.consultantName);

  const prefill: Partial<SurveyReport> = {};
  if (first) prefill.welfareInspectorFirstName = first;
  if (last) prefill.welfareInspectorLastName = last;
  if (settings.phone?.trim()) prefill.welfareInspectorPhone = settings.phone.trim();
  if (settings.email?.trim()) prefill.welfareInspectorEmail = settings.email.trim();
  if (fmt?.welfareInspectorId?.trim()) prefill.welfareInspectorId = fmt.welfareInspectorId.trim();
  if (fmt?.welfareQualification) prefill.welfareQualification = fmt.welfareQualification;
  if (fmt?.welfareRegistrationNum?.trim()) prefill.welfareRegistrationNum = fmt.welfareRegistrationNum.trim();
  if (fmt?.welfareInspectorYearsExperience?.trim()) {
    prefill.welfareInspectorYearsExperience = fmt.welfareInspectorYearsExperience.trim();
  }
  return prefill;
}

/**
 * A full name into the given name and family name the form asks for
 * separately. Everything after the first word is the family name, so
 * a three-part name keeps its middle part with the family name rather than
 * losing a word.
 */
export function splitName(fullName?: string): { first: string; last: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}
