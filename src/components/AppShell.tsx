import { Link, useLocation } from "react-router-dom";
import { Home, FileStack, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Two places to be, three for whoever runs the company.
 *
 * Settings moved to the gear on Home, and signing out moved into Settings
 * with it: a bar that is reached dozens of times a day should hold the
 * places the work happens, not the way out of the app.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();

  const tabs = [
    { to: "/", label: "בית", icon: Home, match: (p: string) => p === "/" },
    { to: "/my-reports", label: "הדוחות שלי", icon: FileStack, match: (p: string) => p.startsWith("/my-reports") || p.startsWith("/report") },
    ...(isAdmin
      ? [{ to: "/company-reports", label: "דוחות החברה", icon: Building2, match: (p: string) => p.startsWith("/company-reports") }]
      : []),
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--home-surface-border)] safe-bottom backdrop-blur-md"
      style={{ background: "var(--home-nav)" }}
    >
      <ul
        className="mx-auto grid max-w-lg gap-2 px-3 py-2"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)]",
                  active
                    ? "bg-[var(--home-nav-active)] text-foreground"
                    : "text-[var(--home-muted)] hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children, hideNav }: { children: React.ReactNode; hideNav?: boolean }) {
  return (
    <div className="min-h-screen" style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="mx-auto max-w-lg w-full">{children}</div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
