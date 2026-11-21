/**
 * Light or dark, and who decides.
 *
 * The phone decides until the consultant says otherwise: a surveyor who keeps
 * their phone dark all evening should not have to tell this app as well. Once
 * they touch the toggle, that choice is theirs and it sticks — across
 * sessions, across devices of their own, and whatever the phone does later.
 *
 * Tailwind is configured for `darkMode: ["class"]`, and nothing in the app
 * ever set that class before now, so the dark half of the palette has never
 * been on screen. Everything here is deliberately small and testable.
 */

export type ThemePreference = "light" | "dark" | "system";
export type Theme = "light" | "dark";

const STORAGE_KEY = "shemer.theme";

/** What the consultant has chosen, or "system" when they never have. */
export function readPreference(storage: Pick<Storage, "getItem"> | null = safeStorage()): ThemePreference {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : "system";
  } catch {
    return "system";
  }
}

export function savePreference(
  preference: ThemePreference,
  storage: Pick<Storage, "setItem" | "removeItem"> | null = safeStorage(),
): void {
  try {
    if (preference === "system") storage?.removeItem(STORAGE_KEY);
    else storage?.setItem(STORAGE_KEY, preference);
  } catch {
    // A private window with storage blocked still gets a working toggle for
    // this visit; it just will not be remembered.
  }
}

/** Which of the two is actually drawn. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === "light" || preference === "dark") return preference;
  return systemPrefersDark ? "dark" : "light";
}

/** The next preference when the toggle is pressed: always an explicit choice. */
export function nextPreference(current: Theme): ThemePreference {
  return current === "dark" ? "light" : "dark";
}

function safeStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function systemPrefersDark(): boolean {
  try {
    return typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  // So the phone's own chrome — the status bar, the pull-to-refresh backdrop —
  // matches the page instead of flashing white above it.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#05111E" : "#ffffff");
}

/**
 * Applies the current theme and keeps following the phone until the
 * consultant makes a choice. Returns a function that stops listening.
 */
export function startTheme(): () => void {
  const sync = () => applyTheme(resolveTheme(readPreference(), systemPrefersDark()));
  sync();

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => { if (readPreference() === "system") sync(); };
  media.addEventListener?.("change", onChange);
  return () => media.removeEventListener?.("change", onChange);
}
