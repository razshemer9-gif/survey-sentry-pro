// A local copy of the consultant's settings.
//
// Settings — the company details, and the signature and stamp that go at the
// foot of a report — are held in one row per account in Supabase, and were
// read from there every time a report was opened. When that read did not
// answer, which on a phone in the field is an ordinary morning, the app fell
// back to empty defaults without saying anything: the report printed with no
// stamp and no company name, and nothing on screen suggested the settings had
// not arrived. So keep the last answer, and use it when the next read fails.
//
// The copy is per account, because a device is sometimes shared, and one
// consultant must never sign a report with another's stamp.

import { ConsultantSettings, DEFAULT_SETTINGS } from "./types";

const PREFIX = "ans.settings.v1";

export function settingsCacheKey(userId: string): string {
  return `${PREFIX}:${userId}`;
}

/** Best-effort: a full storage quota must not break saving settings. */
export function cacheSettings(userId: string, s: ConsultantSettings): void {
  try {
    localStorage.setItem(settingsCacheKey(userId), JSON.stringify(s));
  } catch {
    /* private mode, or no room for the images — the server copy still stands */
  }
}

export function cachedSettings(userId: string): ConsultantSettings | null {
  try {
    const raw = localStorage.getItem(settingsCacheKey(userId));
    return raw ? (JSON.parse(raw) as ConsultantSettings) : null;
  } catch {
    return null;
  }
}

/**
 * Which copy a report is drawn from: the server's when it answered, the one
 * kept here when it did not, and the bare defaults when neither exists.
 */
export function resolveSettings(
  remote: ConsultantSettings | null | undefined,
  cached: ConsultantSettings | null | undefined,
): ConsultantSettings {
  return { ...DEFAULT_SETTINGS, ...(remote ?? cached ?? {}) };
}
