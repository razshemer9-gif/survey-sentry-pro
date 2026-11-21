import { ConsultantSettings } from "./types";

/**
 * What to call the person using the app.
 *
 * The rule that matters: never an e-mail address. "שלום razshemer9" is not a
 * greeting, it is a database field leaking onto the screen, and it is what
 * would have appeared — the full-name column is empty on every account.
 */

/**
 * The names of the people who use this app, given by the owner, keyed by how
 * their address begins.
 *
 * This is not derived from the address: "info" is not a name, and nothing
 * here is shown unless it was written down on purpose. It is a small table
 * for a small firm, so that every account is greeted properly from the first
 * launch, before anybody has been to הגדרות. The field there still wins —
 * whoever wants to be called something else types it and is.
 *
 * It beats the professional name in settings on purpose: that name is what a
 * report is signed with, and an employee signing on behalf of the office
 * would otherwise be greeted by their employer's name.
 */
const NAMES_BY_ADDRESS_START: readonly (readonly [string, string])[] = [
  ["shemerziv", "זיו"],
  ["ziv", "זיו"],
  ["info", "מריס"],
  ["raz", "רז"],
];

/** The name recorded for this account, or "" for an account not listed. */
export function nameForAccount(email?: string | null): string {
  const local = (email ?? "").trim().toLowerCase().split("@")[0];
  if (!local) return "";
  // Longest prefix first, so "shemerziv" is not read as something shorter.
  const match = [...NAMES_BY_ADDRESS_START]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([start]) => local.startsWith(start));
  return match ? match[1] : "";
}

/**
 * In order: the display name the consultant set for themselves; the name the
 * owner recorded for that account; the professional name in their settings,
 * which every report is signed with; the name on their profile. If none of
 * those exist, nothing — the greeting says hello on its own rather than
 * inventing a name or showing an address.
 */
export function resolveDisplayName(
  settings: Partial<Pick<ConsultantSettings, "displayName" | "consultantName">> | null | undefined,
  profileFullName?: string | null,
  accountEmail?: string | null,
): string {
  const candidates = [
    settings?.displayName,
    nameForAccount(accountEmail),
    settings?.consultantName,
    profileFullName,
  ];
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
  accountEmail?: string | null,
): string {
  const full = resolveDisplayName(settings, profileFullName, accountEmail);
  return full.split(/\s+/)[0] ?? "";
}

/** "שלום זיו", or plain "שלום" when there is no name to use. */
export function greeting(
  settings: Parameters<typeof resolveDisplayName>[0],
  profileFullName?: string | null,
  accountEmail?: string | null,
): string {
  const name = greetingName(settings, profileFullName, accountEmail);
  return name ? `שלום ${name}` : "שלום";
}

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}
