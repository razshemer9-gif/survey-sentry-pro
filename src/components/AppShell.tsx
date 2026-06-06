import { Link, useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, Settings, FileStack, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";

const tabs = [
  { to: "/", label: "דוחות", icon: FileStack },
  { to: "/templates", label: "תבניות", icon: ClipboardList },
  { to: "/settings", label: "הגדרות", icon: Settings },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/auth");
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur-md safe-bottom shadow-[0_-1px_12px_hsl(217_91%_20%/0.06)]">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map((t) => {
          const active =
            t.to === "/" ? pathname === "/" || pathname.startsWith("/report") : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] sm:text-xs font-medium transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute top-0 inset-x-4 h-[2px] rounded-b-full bg-primary" />
                )}
                <span className={cn(
                  "grid place-items-center rounded-xl px-3 py-1 transition-all duration-200",
                  active ? "bg-primary/10" : "",
                )}>
                  <Icon className="h-5 w-5 shrink-0" />
                </span>
                <span className="truncate">{t.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            onClick={handleSignOut}
            className="flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[10px] sm:text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
            title="התנתק"
          >
            <span className="grid place-items-center rounded-xl px-3 py-1">
              <LogOut className="h-5 w-5 shrink-0" />
            </span>
            <span className="truncate">יציאה</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function AppShell({ children, hideNav }: { children: React.ReactNode; hideNav?: boolean }) {
  return (
    <div className="min-h-screen" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="mx-auto max-w-lg w-full">{children}</div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
