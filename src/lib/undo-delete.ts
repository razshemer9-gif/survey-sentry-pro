/**
 * Deleting a report, with a few seconds to think better of it.
 *
 * A thumb on a phone held in one hand on a building site hits the wrong row
 * sooner or later, and a report is an afternoon's work and photographs that
 * cannot be taken again. The confirmation catches the careless press; this
 * catches the confident one.
 *
 * The timer lives here rather than in a screen, so walking away from the
 * list — or opening another report — neither cancels the deletion nor loses
 * it. If the app is put away before the window is up the deletion is
 * committed at once: the alternative is a report the consultant watched
 * disappear coming back the next morning.
 */

export const UNDO_WINDOW_MS = 6_000;

type Pending = {
  timer: ReturnType<typeof setTimeout>;
  commit: () => Promise<void>;
};

const pending = new Map<string, Pending>();

/** Delete this report in a few seconds' time, unless undoDelete is called. */
export function scheduleDelete(
  id: string,
  commit: () => Promise<void>,
  onError?: (err: unknown) => void,
): void {
  cancelTimer(id);
  const run = async () => {
    pending.delete(id);
    try {
      await commit();
    } catch (err) {
      onError?.(err);
    }
  };
  pending.set(id, { timer: setTimeout(run, UNDO_WINDOW_MS), commit: run });
}

/** True when the deletion was still waiting and has now been called off. */
export function undoDelete(id: string): boolean {
  return cancelTimer(id);
}

export function isDeletePending(id: string): boolean {
  return pending.has(id);
}

/** Carry out every waiting deletion now. */
export async function flushDeletes(): Promise<void> {
  const waiting = [...pending.values()];
  for (const p of waiting) clearTimeout(p.timer);
  pending.clear();
  await Promise.all(waiting.map((p) => p.commit()));
}

function cancelTimer(id: string): boolean {
  const found = pending.get(id);
  if (!found) return false;
  clearTimeout(found.timer);
  pending.delete(id);
  return true;
}

// Putting the app away ends the window: the deletion the consultant saw
// happen must not be undone by closing a tab.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushDeletes();
  });
}
