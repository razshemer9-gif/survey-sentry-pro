import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ReportRow } from "@/components/ReportRow";
import { useResolvedTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { isDirty } from "@/lib/offline-db";
import { cachedReports, deleteReport, listReportAuthors, refreshReports } from "@/lib/storage";
import { subscribeSyncStatus } from "@/lib/sync-engine";
import { getSurveyType, SurveyReport } from "@/lib/types";
import { toast } from "sonner";

/**
 * The full list, used by both "הדוחות שלי" and "דוחות החברה". One screen with
 * two settings rather than two screens that drift apart.
 *
 * It loads the way Home does: the device answers first, the network updates
 * behind it. Nothing here decides who may see what — that is the database's
 * business, and this only narrows what has already been allowed.
 */
export function ReportListScreen({
  title, scope, searchPlaceholder, showAuthor, emptyText,
}: {
  title: string;
  /** "mine" — written by this account. "all" — everything it is allowed to see. */
  scope: "mine" | "all";
  searchPlaceholder: string;
  showAuthor?: boolean;
  emptyText: string;
}) {
  const { user } = useAuth();
  const isDark = useResolvedTheme() === "dark";
  const [params, setParams] = useSearchParams();
  const [reports, setReports] = useState<SurveyReport[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(true);
  const [query, setQuery] = useState(params.get("q") ?? "");

  useEffect(() => {
    let cancelled = false;
    cachedReports()
      .then((rs) => { if (!cancelled) setReports(rs); })
      .catch((err) => console.warn("[reports] cache read failed", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    refreshReports((rs) => { if (!cancelled) setReports(rs); })
      .catch((err) => console.error("[reports] refresh failed", err))
      .finally(() => { if (!cancelled) setRefreshing(false); });
    if (showAuthor) listReportAuthors().then(setAuthors).catch(() => setAuthors({}));
    return () => { cancelled = true; };
  }, [showAuthor]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      Promise.all(reports.map((r) => isDirty(r.id).then((d) => (d ? r.id : null))))
        .then((ids) => { if (!cancelled) setDirtyIds(new Set(ids.filter((x): x is string => !!x))); });
    };
    refresh();
    const unsubscribe = subscribeSyncStatus(refresh);
    return () => { cancelled = true; unsubscribe(); };
  }, [reports]);

  const authorName = useCallback((r: SurveyReport) => {
    if (!r.ownerId || r.ownerId === user?.id) return "אני";
    return authors[r.ownerId] || "עובד אחר";
  }, [authors, user?.id]);

  const visible = useMemo(() => {
    const scoped = scope === "mine"
      ? reports.filter((r) => !r.ownerId || r.ownerId === user?.id)
      : reports;
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((r) => {
      const config = getSurveyType(r.surveyType);
      const fields = [r.placeName, r.address, config.label, config.shortLabel];
      if (showAuthor) fields.push(authorName(r));
      return fields.some((value) => (value ?? "").toLowerCase().includes(q));
    });
  }, [reports, scope, query, user?.id, showAuthor, authorName]);

  async function remove(id: string) {
    if (!confirm("למחוק את הדוח?")) return;
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("הדוח נמחק");
    } catch {
      toast.error("שגיאה במחיקת הדוח");
    }
  }

  function onQuery(next: string) {
    setQuery(next);
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    setParams(params, { replace: true });
  }

  return (
    <AppShell>
      <div className="home-surface px-4 pb-4 safe-top">
        <header className="flex items-baseline justify-between gap-3 pt-5">
          <h1 className="text-[22px] font-extrabold tracking-[-0.01em]">{title}</h1>
          {!loading && (
            <span className="text-[13px] tabular-nums text-[var(--home-muted)]">
              {visible.length === reports.length || query.trim() === ""
                ? `${visible.length}`
                : `${visible.length} מתוך ${reports.length}`}
            </span>
          )}
        </header>

        <div className="relative mt-3">
          <Search aria-hidden className="pointer-events-none absolute end-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--home-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-12 w-full rounded-2xl border border-[var(--home-surface-border)] bg-[var(--home-field)] pe-12 ps-10 text-[15px] placeholder:text-[var(--home-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)] [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery("")}
              aria-label="נקה חיפוש"
              className="absolute start-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[var(--home-muted)] hover:bg-[var(--home-surface)] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-3">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--home-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען…
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--home-surface-border)] px-5 py-10 text-center text-sm text-[var(--home-muted)]">
              {query.trim() ? "אין דוח שתואם לחיפוש." : refreshing ? "טוען…" : emptyText}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {visible.map((r) => (
                <ReportRow
                  key={r.id}
                  report={r}
                  isDark={isDark}
                  authorName={showAuthor ? authorName(r) : undefined}
                  pendingSync={dirtyIds.has(r.id)}
                  onDelete={remove}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
