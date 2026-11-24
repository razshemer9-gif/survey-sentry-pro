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

/** Thrown by `withDeadline` when the work did not finish in time. */
export class TimeoutError extends Error {
  constructor(message = "הפעולה לא הסתיימה בזמן") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Like `withTimeout`, but it fails instead of pretending.
 *
 * `withTimeout` answers with a fallback, which is right for reads — an empty
 * list of names is a worse screen, not a wrong one. It is exactly wrong for
 * a write: a save that quietly resolves to nothing tells the person their
 * work is stored when it is not.
 *
 * Without one of the two, a request that never settles leaves the button
 * saying "שומר..." for as long as the screen is open, which is the least
 * useful thing an interface can say — it is neither done nor failed, and
 * there is nothing to do about it.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
