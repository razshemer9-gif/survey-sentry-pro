// The "engineering" look — a new design being tried out by two people
// before anyone else sees it.
//
// Everyone else gets the app exactly as it was: the new look is a class on
// <html> (`eng-ui`) that every new style hangs off, plus a few screens that
// draw differently while it is on. Taking someone off the list, or flipping
// the switch in Settings, puts them straight back on the old design.

/** Compared trimmed and in lower case, like static-calc-access. */
const PREVIEW_USERS = ["razshemer9@gmail.com", "ziv@shemera.co.il"];

export function canPreviewEngUi(email?: string | null): boolean {
  if (!email) return false;
  return PREVIEW_USERS.includes(email.trim().toLowerCase());
}

// The two of them can switch back to the old design for a comparison; the
// choice is kept on the device. On by default.
const PREF_KEY = "ui:engineering";
const listeners = new Set<() => void>();

export function engUiPreferred(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setEngUiPreferred(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch { /* storage unavailable — the choice lasts for this visit only */ }
  listeners.forEach((l) => l());
}

export function subscribeEngUi(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
