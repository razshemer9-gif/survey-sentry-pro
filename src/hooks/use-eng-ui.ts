import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canPreviewEngUi, engUiPreferred, subscribeEngUi } from "@/lib/eng-ui";

/** Whether this user may switch the new design on at all. */
export function useCanPreviewEngUi(): boolean {
  const { user } = useAuth();
  return canPreviewEngUi(user?.email);
}

/** Whether the new design is showing for this user right now. */
export function useEngUi(): boolean {
  const allowed = useCanPreviewEngUi();
  const preferred = useSyncExternalStore(subscribeEngUi, engUiPreferred, () => true);
  return allowed && preferred;
}

/** Keeps the `eng-ui` class on <html> in step with useEngUi(). */
export function EngUiRoot() {
  const on = useEngUi();
  useEffect(() => {
    document.documentElement.classList.toggle("eng-ui", on);
  }, [on]);
  return null;
}
