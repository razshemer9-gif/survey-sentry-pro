/**
 * Which page the app opens on.
 *
 * The app is a page in a browser tab, so it opens wherever it was left: iOS
 * restores a tab at the exact address it was closed on, and a shortcut added
 * to the home screen keeps the address it was created with, hash and all. Go
 * to הגדרות once and that is what greets you the next time — and every time
 * after, for a home-screen shortcut.
 *
 * So a cold start that lands on one of the settings-like pages is sent to the
 * reports list instead. Everything else is left exactly as it is: a report's
 * own address still opens that report, which keeps a mid-edit reload on the
 * report being edited, and moving around inside the app never goes through
 * here at all.
 *
 * @param hash  window.location.hash at load time.
 * @returns the hash to start on, or null to leave the address alone.
 */
export function coldStartHash(hash: string): string | null {
  const route = hash.replace(/^#/, "").split("?")[0].replace(/\/+$/, "") || "/";
  const settingsLike = ["/settings", "/standards", "/admin/users"];
  const isSettingsLike = settingsLike.some(
    (r) => route === r || route.startsWith(`${r}/`),
  );
  return isSettingsLike ? "#/" : null;
}

/**
 * Applies {@link coldStartHash} to the current address, before React mounts
 * and reads it — a replaceState rather than a navigation, so the settings
 * page never renders and no history entry is left behind for Back to return
 * to.
 */
export function applyColdStart(loc: Location = window.location): void {
  const next = coldStartHash(loc.hash);
  if (next) {
    window.history.replaceState(null, "", `${loc.pathname}${loc.search}${next}`);
  }
}
