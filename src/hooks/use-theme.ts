import { useEffect, useState } from "react";
import { readPreference, resolveTheme, systemPrefersDark, type Theme } from "@/lib/theme";

/**
 * Which theme is on screen right now.
 *
 * Components that pick a colour in JavaScript — the survey-type marks — need
 * to know, and they need to be told again when the toggle is pressed. The
 * class on <html> is the single source of truth, so this watches that rather
 * than keeping a second copy of the state in a context.
 */
export function useResolvedTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => current());

  useEffect(() => {
    setTheme(current());
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setTheme(current()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

function current(): Theme {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) return "dark";
  if (typeof document !== "undefined") return "light";
  return resolveTheme(readPreference(), systemPrefersDark());
}
