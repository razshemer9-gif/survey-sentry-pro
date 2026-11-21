import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyTheme, readPreference, resolveTheme, savePreference, systemPrefersDark,
  type Theme,
} from "@/lib/theme";

/**
 * One switch, and pressing it anywhere flips the theme.
 *
 * It used to be two halves, each selecting its own theme — which reads as a
 * control with two buttons, so pressing the lit half appeared to do nothing
 * at all. A switch has one job and one target: the whole of it.
 *
 * The knob carries the icon of the theme that is on, and slides to the side
 * that theme belongs to, so the control still says which state it is in
 * rather than only what it will do next.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveTheme(readPreference(), systemPrefersDark()),
  );

  useEffect(() => {
    setTheme(resolveTheme(readPreference(), systemPrefersDark()));
  }, []);

  function flip() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    savePreference(next);
    applyTheme(next);
    setTheme(next);
  }

  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "מצב כהה — החלף לבהיר" : "מצב בהיר — החלף לכהה"}
      title={dark ? "מצב כהה" : "מצב בהיר"}
      onClick={flip}
      className={cn(
        "relative inline-flex h-10 w-[4.5rem] shrink-0 items-center rounded-full border p-1 transition-colors",
        "border-[var(--home-surface-border)] bg-[var(--home-field)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)]",
        className,
      )}
    >
      {/* The empty side shows, faintly, what pressing will give. */}
      <Sun aria-hidden className={cn("pointer-events-none absolute end-3 h-4 w-4 text-[var(--home-muted)] transition-opacity", dark ? "opacity-70" : "opacity-0")} />
      <Moon aria-hidden className={cn("pointer-events-none absolute start-3 h-4 w-4 text-[var(--home-muted)] transition-opacity", dark ? "opacity-0" : "opacity-70")} />

      <span
        aria-hidden
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full shadow-sm transition-transform duration-200",
          "bg-[var(--home-nav-active)] text-foreground",
          // Laid out at the start edge, which in RTL is the right; a negative
          // translate is therefore a slide to the left, to the other side.
          dark ? "translate-x-0" : "-translate-x-[30px]",
        )}
      >
        {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
    </button>
  );
}
