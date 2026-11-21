import { ArrowDownUp, Check, Filter } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { markColor, MarkFilter } from "@/lib/report-mark";
import { SORT_LABELS, SORT_SHORT, SortKey } from "@/lib/report-sort";
import { SURVEY_TYPES, SurveyType } from "@/lib/types";

const MARK_LABELS: Record<MarkFilter, string> = {
  all: "הכל",
  green: "ירוק",
  red: "אדום",
  none: "ללא סימון",
};

/**
 * Two menus and three dots: order, kind of survey, and the mark.
 *
 * They sit on one line under the search box and say what they are set to,
 * so the screen answers "why am I not seeing it?" without being opened.
 */
export function ReportListControls({
  sort, onSort, type, onType, mark, onMark, isDark,
}: {
  sort: SortKey;
  onSort: (next: SortKey) => void;
  /** undefined — every kind of survey. */
  type: SurveyType | undefined;
  onType: (next: SurveyType | undefined) => void;
  mark: MarkFilter;
  onMark: (next: MarkFilter) => void;
  isDark: boolean;
}) {
  const typeLabel = type ? SURVEY_TYPES.find((t) => t.id === type)?.shortLabel ?? "סוג" : "כל הסוגים";

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <Menu icon={ArrowDownUp} label={SORT_SHORT[sort]} active={sort !== "updated"}>
        <DropdownMenuLabel>מיון</DropdownMenuLabel>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <DropdownMenuItem key={key} onSelect={() => onSort(key)} className="gap-2">
            <Tick on={sort === key} />
            {SORT_LABELS[key]}
          </DropdownMenuItem>
        ))}
      </Menu>

      <Menu icon={Filter} label={typeLabel} active={!!type}>
        <DropdownMenuLabel>סוג הסקר</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onType(undefined)} className="gap-2">
          <Tick on={!type} />
          כל הסוגים
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {SURVEY_TYPES.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => onType(t.id)} className="gap-2">
            <Tick on={type === t.id} />
            {t.label}
          </DropdownMenuItem>
        ))}
      </Menu>

      {/* The mark is three choices, so it is three targets rather than a
          menu that hides which one is on. */}
      <div className="ms-auto flex items-center gap-1 rounded-full border border-[var(--home-surface-border)] bg-[var(--home-field)] p-1" role="group" aria-label="סינון לפי סימון">
        {(["all", "green", "red", "none"] as MarkFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onMark(value)}
            aria-pressed={mark === value}
            aria-label={MARK_LABELS[value]}
            title={MARK_LABELS[value]}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)]",
              mark === value ? "bg-[var(--home-nav-active)] text-foreground" : "text-[var(--home-muted)]",
            )}
          >
            {value === "all" ? "הכל"
              : value === "none" ? <span className="h-2.5 w-2.5 rounded-full border-2 border-current" />
              : <span className="h-2.5 w-2.5 rounded-full" style={{ background: markColor(value, isDark) }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function Menu({
  icon: Icon, label, active, children,
}: {
  icon: typeof Filter;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-9 min-w-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-cta-top)]",
          active
            ? "border-[var(--home-cta-top)] bg-[var(--home-nav-active)] text-foreground"
            : "border-[var(--home-surface-border)] bg-[var(--home-field)] text-[var(--home-muted)]",
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60vh] min-w-48 overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Tick({ on }: { on: boolean }) {
  return <Check className={cn("h-4 w-4 shrink-0", on ? "opacity-100" : "opacity-0")} aria-hidden />;
}
