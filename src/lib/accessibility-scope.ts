// "נגישות מתו״ס" and "נגישות שירות" are two separate certifications. A
// consultant certified in both covers the whole survey; one certified in a
// single field may only report on that field, and the report has to say so —
// its title included.
//
// A report with no scope recorded predates this choice and is treated as
// covering both, which is what every such report was.

import { SurveyReport } from "./types";

export type AccessibilityScope = "both" | "matos" | "service";

export function accessibilityScopeOf(report: Pick<SurveyReport, "accessibilityScope">): AccessibilityScope {
  return report.accessibilityScope ?? "both";
}

/** The scope two checkboxes describe; neither one ticked is not a scope. */
export function scopeFromChecks(matos: boolean, service: boolean): AccessibilityScope | null {
  if (matos && service) return "both";
  if (matos) return "matos";
  if (service) return "service";
  return null;
}

export function scopeChecks(scope: AccessibilityScope): { matos: boolean; service: boolean } {
  return { matos: scope !== "service", service: scope !== "matos" };
}

/** What the scope is called on its own, e.g. in the cover's details block. */
export function accessibilityScopeLabel(scope: AccessibilityScope): string {
  switch (scope) {
    case "matos":   return 'נגישות מתו״ס';
    case "service": return "נגישות שירות";
    default:        return 'נגישות מתו״ס ושירות';
  }
}

/**
 * The report's title for this scope — "סקר" for a survey, "אישור" for an
 * approval, matching how the other report types name their approval variant.
 */
export function accessibilityTitle(scope: AccessibilityScope, isApproval: boolean): string {
  return `${isApproval ? "אישור" : "סקר"} ${accessibilityScopeLabel(scope)}`;
}
