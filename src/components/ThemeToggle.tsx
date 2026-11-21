import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyTheme, nextPreference, readPreference, resolveTheme, savePreference, systemPrefersDark,
  type Theme,
} from "@/lib/theme";

/**
 * Two halves of one control, with the lit half showing which is on. A single
 * icon that swaps on press says what will happen next but not what is true
 * now, and at a glance on site that is the wrong way round.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveTheme(readPreference(), systemPrefersDark()),
  );

  useEffect(() => {
    setTheme(resolveTheme(readPreference(), systemPrefersDark()));
  }, []);

  function choose(next: Theme) {
    if (next === theme) return;
    savePreference(nextPreference(theme));
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full p-1",
        "bg-[var(--home-field)] border border-[var(--home-surface-border)]",
        className,
      )}
      role="group"
      aria-label="מצב תצוגה"
    >
      {([
        { value: "light" as const, Icon: Sun, label: "מצב בהיר" },
        { value: "dark" as const, Icon: Moon, label: "מצב כהה" },
      ]).map(({ value, Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          aria-pressed={theme === value}
          aria-label={label}
          title={label}
          className={cn(
            "grid h-8 w-9 place-items-center rounded-full transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)]",
            theme === value
              ? "bg-[var(--home-nav-active)] text-foreground"
              : "text-[var(--home-muted)] hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
