import { ConsultantSettings } from "./types";

/**
 * What to call the person using the app.
 *
 * The rule that matters: never an e-mail address. "שלום razshemer9" is not a
 * greeting, it is a database field leaking onto the screen, and it is what
 * would have appeared — the full-name column is empty on every account.
 *
 * In order: a display name the consultant set for themselves; the
 * professional name already in their settings, which every report is signed
 * with and which is filled in on the accounts that exist; the name on their
 * profile. If none of those exist, nothing — the greeting says hello on its
 * own rather than inventing a name or showing an address.
 */
export function resolveDisplayName(
  settings: Partial<Pick<ConsultantSettings, "displayName" | "consultantName">> | null | undefined,
  profileFullName?: string | null,
): string {
  const candidates = [settings?.displayName, settings?.consultantName, profileFullName];
  for (const candidate of candidates) {
    const trimmed = (candidate ?? "").trim();
    if (trimmed && !looksLikeEmail(trimmed)) return trimmed;
  }
  return "";
}

/** The greeting is warmer with one name than with three. */
export function greetingName(
  settings: Parameters<typeof resolveDisplayName>[0],
  profileFullName?: string | null,
): string {
  const full = resolveDisplayName(settings, profileFullName);
  return full.split(/\s+/)[0] ?? "";
}

/** "שלום יוסי", or plain "שלום" when there is no name to use. */
export function greeting(
  settings: Parameters<typeof resolveDisplayName>[0],
  profileFullName?: string | null,
): string {
  const name = greetingName(settings, profileFullName);
  return name ? `שלום ${name}` : "שלום";
}

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}
