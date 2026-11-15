// Finding the consultant's stamp.
//
// Settings keep a signature per report type, which is useful when a report
// is signed in a different capacity — but it means every new report type
// starts with an empty one, and a consultant who set their stamp once is told
// by the app that it is set while the report prints blank. One person signs
// all of these reports, so a type that has no stamp of its own falls back to
// whichever the consultant has already set.
//
// It is a fallback, never an override: a stamp set for this type, or signed
// onto this report, still wins, and a report type told not to show a
// signature at all still shows none.

import { ConsultantSettings, SURVEY_TYPES } from "./types";

/**
 * Any signature the consultant has set, taken in the order the report types
 * are listed so that the same report always picks the same one.
 */
export function anySignature(settings: Pick<ConsultantSettings, "reportFormats">): string | undefined {
  for (const { id } of SURVEY_TYPES) {
    const sig = settings.reportFormats?.[id]?.signatureImage;
    if (sig) return sig;
  }
  return undefined;
}
