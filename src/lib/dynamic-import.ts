// Every deploy replaces the previous build's hashed chunk files entirely
// (see .github/workflows/deploy.yml — gh-pages content is overwritten, not
// merged). A tab left open from before a deploy — or a stale cached
// index.html — can therefore try to fetch a chunk that no longer exists,
// surfacing as a generic "error loading dynamically imported module".
// Wrapping every dynamic import with this retries ONCE via a full reload
// (which fetches the current index.html + matching chunks) before giving up,
// so the failure self-heals instead of showing a scary error to the user.
const RELOAD_FLAG = "ans.chunk-reload-attempted";

export async function importWithReload<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const mod = await loader();
    sessionStorage.removeItem(RELOAD_FLAG);
    return mod;
  } catch (err) {
    if (!sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
      // Never resolves — the reload navigates away before this matters.
      return new Promise<T>(() => {});
    }
    throw err;
  }
}
