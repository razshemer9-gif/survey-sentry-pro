import { Link, useLocation } from "react-router-dom";
import { ClipboardList, Settings, FileStack } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "דוחות", icon: FileStack },
  { to: "/templates", label: "תבניות", icon: ClipboardList },
  { to: "/settings", label: "הגדרות", icon: Settings },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-md safe-bottom">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {tabs.map((t) => {
          const active =
            t.to === "/" ? pathname === "/" || pathname.startsWith("/report") : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "scale-110")} />
                {t.label}
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
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-md">{children}</div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
