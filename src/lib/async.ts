// Small async helpers shared across the app.

/**
 * Resolves with `promise`'s result, or with `fallback` after `ms` milliseconds
 * — whichever comes first. Used to keep the UI responsive when a network call
 * (Supabase auth/session/query) might hang or take a long time on a flaky
 * connection.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
