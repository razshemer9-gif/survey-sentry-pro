/**
 * Which build of the app is running, and noticing when a newer one exists.
 *
 * The app is a page on a static host, added to a phone's Home Screen. iOS
 * keeps that page for a long time, so a consultant can be looking at last
 * week's build while the fix they asked for sits on the server — which has
 * happened, repeatedly, and is indistinguishable from "the change does not
 * work" unless you can see which build you are on.
 *
 * So two things. The build stamps its own id into the bundle, shown at the
 * bottom of הגדרות, and once in a while the app asks the server what the
 * current id is. If the server's is different, the page reloads itself,
 * once, which replaces every cached file with the current one.
 */

/** Replaced at build time — see vite.config.ts. "dev" when serving locally. */
export const BUILD_ID: string =
  (typeof __BUILD_ID__ === "string" && __BUILD_ID__) || "dev";

export const BUILD_TIME: string =
  (typeof __BUILD_TIME__ === "string" && __BUILD_TIME__) || "";

/** So a reload loop can never happen, whatever the server answers. */
const RELOADED_KEY = "shemer.reloaded-for";

export function buildLabel(): string {
  if (BUILD_ID === "dev") return "גרסת פיתוח";
  const when = BUILD_TIME
    ? new Date(BUILD_TIME).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  return when ? `גרסה ${BUILD_ID} · ${when}` : `גרסה ${BUILD_ID}`;
}

/**
 * Ask the server which build is current. Returns the id it reports, or null
 * when it cannot be asked — offline, which is the normal state on site and
 * must change nothing.
 */
export async function currentServerBuild(
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetcher(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json() as { build?: unknown };
    return typeof body.build === "string" && body.build ? body.build : null;
  } catch {
    return null;
  }
}

/**
 * True when the page should reload to pick up a newer build.
 *
 * Deliberately narrow. It reloads only when the server names a build that
 * differs from this one, and only once per build: if the reload somehow
 * does not pick up the new files, the app must not sit in a loop reloading
 * itself in a consultant's hands.
 */
export function shouldReload(
  serverBuild: string | null,
  ourBuild: string = BUILD_ID,
  alreadyReloadedFor: string | null = readReloaded(),
): boolean {
  if (!serverBuild) return false;        // could not ask — carry on
  if (ourBuild === "dev") return false;  // never in development
  if (serverBuild === ourBuild) return false;
  return alreadyReloadedFor !== serverBuild;
}

function readReloaded(): string | null {
  try { return sessionStorage.getItem(RELOADED_KEY); } catch { return null; }
}

function rememberReloaded(build: string): void {
  try { sessionStorage.setItem(RELOADED_KEY, build); } catch { /* ignore */ }
}

/**
 * Check once, now. Called at startup and whenever the app comes back to the
 * foreground, which on a phone is how a new build actually arrives.
 */
export async function checkForNewBuild(): Promise<void> {
  const serverBuild = await currentServerBuild();
  if (!shouldReload(serverBuild)) return;
  rememberReloaded(serverBuild!);
  console.info(`[build] ${BUILD_ID} → ${serverBuild}, reloading`);
  window.location.reload();
}

/** Start checking: at launch, and each time the app is opened again. */
export function watchForNewBuild(): () => void {
  void checkForNewBuild();
  const onVisible = () => {
    if (document.visibilityState === "visible") void checkForNewBuild();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}
