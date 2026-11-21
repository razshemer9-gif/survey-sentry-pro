import { Link } from "react-router-dom";
import { Circle, Copy, FileText, Loader2, MoreHorizontal, Pencil, Trash2, User } from "lucide-react";
import { markColor, markLabel, nextMark } from "@/lib/report-mark";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { surveyColor } from "@/lib/survey-colors";
import { getSurveyType, SurveyReport } from "@/lib/types";

/**
 * One report in a list. The same row on all three screens, so a report looks
 * the same wherever it is met.
 *
 * What it shows is what tells one report from another: the site, when it was
 * started, when it was last touched, and which kind of survey it is. Not how
 * many findings passed — that belongs inside the report, and a second
 * colour-coded signal in the list would only make the type colour mean less.
 */
export function ReportRow({
  report, isDark, authorName, pendingSync, onDelete, onDuplicate, duplicating, onMark,
}: {
  report: SurveyReport;
  isDark: boolean;
  /** Only where reports by more than one person are listed. */
  authorName?: string;
  pendingSync?: boolean;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  /** True while this report's copy is being made. */
  duplicating?: boolean;
  /** Pressing the mark asks for the next one; undefined hides the control. */
  onMark?: (id: string, mark: SurveyReport["mark"]) => void;
}) {
  const config = getSurveyType(report.surveyType);
  const color = surveyColor(report.surveyType, isDark);

  return (
    <li
      className={cn(
        "relative flex items-stretch gap-1 overflow-hidden rounded-2xl border",
        "border-[var(--home-surface-border)] bg-[var(--home-surface)]",
      )}
    >
      {/* The type, as a rule down the leading edge. */}
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: color }} />

      <Link
        to={`/report/${report.id}`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-2.5 ps-3.5 transition-colors",
          "hover:bg-[var(--home-field)] active:bg-[var(--home-field)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--home-cta-top)]",
        )}
      >
        <Thumbnail report={report} color={color} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold leading-snug">
            {report.placeName?.trim() || "דוח ללא שם"}
          </span>
          <span className="mt-1 block truncate text-[11px] text-[var(--home-muted)] tabular-nums">
            נוצר {dayMonth(report.createdAt)} · עודכן {shortDate(report.updatedAt)}
          </span>
          {(authorName || pendingSync) && (
            <span className="mt-1 flex items-center gap-2 text-[11px] text-[var(--home-muted)]">
              {authorName && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{authorName}</span>
                </span>
              )}
              {pendingSync && <span className="shrink-0 text-amber-500">ממתין לסנכרון</span>}
            </span>
          )}
        </span>

        {/* A narrow column, so the site and its dates keep the width. The
            label wraps rather than truncates: "יציבות אלמנטים" over two
            lines still reads; "יציבות אל…" does not. */}
        <span className="flex shrink-0 items-center gap-2">
          <span className="h-9 w-px bg-[var(--home-surface-border)]" aria-hidden />
          <span className="flex w-[4rem] items-start gap-1.5 text-[12px] font-semibold leading-tight" style={{ color }}>
            <span className="mt-[0.3em] h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            <span className="min-w-0">{config.shortLabel}</span>
          </span>
        </span>
      </Link>

      <span className="flex shrink-0 flex-col items-center justify-center gap-0.5 pe-0.5">
        {onMark && <MarkButton report={report} isDark={isDark} onMark={onMark} />}
        <RowMenu reportId={report.id} onDelete={onDelete} onDuplicate={onDuplicate} duplicating={duplicating} />
      </span>
    </li>
  );
}

function Thumbnail({ report, color }: { report: SurveyReport; color: string }) {
  // Only reports this device holds in full carry a photograph; the list that
  // comes down from the server has none, by design, or it would weigh
  // megabytes. So a picture appears where there is one to show, and the type
  // stands in everywhere else.
  if (report.coverPhoto) {
    return (
      <img
        src={report.coverPhoto}
        alt=""
        loading="lazy"
        decoding="async"
        width={52}
        height={52}
        className="h-[52px] w-[52px] shrink-0 rounded-xl object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl"
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
    >
      <FileText className="h-5 w-5" />
    </span>
  );
}

/**
 * Three entries, and no more: open it, copy it, throw it away.
 *
 * There is deliberately no report status. The statuses that exist belong to
 * the findings inside a report, and they stay there.
 */
function RowMenu({
  reportId, onDelete, onDuplicate, duplicating,
}: {
  reportId: string;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  duplicating?: boolean;
}) {
  if (!onDelete && !onDuplicate) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "grid h-8 w-9 shrink-0 place-items-center rounded-xl text-[var(--home-muted)] transition-colors",
          "hover:bg-[var(--home-field)] hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--home-cta-top)]",
        )}
        aria-label="פעולות על הדוח"
      >
        {duplicating
          ? <Loader2 className="h-5 w-5 animate-spin" aria-label="משכפל" />
          : <MoreHorizontal className="h-5 w-5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuItem asChild>
          <Link to={`/report/${reportId}`} className="gap-2">
            <Pencil className="h-4 w-4" />
            עריכה
          </Link>
        </DropdownMenuItem>
        {onDuplicate && (
          <DropdownMenuItem
            onSelect={() => onDuplicate(reportId)}
            disabled={duplicating}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            שכפול
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onSelect={() => onDelete(reportId)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            מחיקה
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The mark, as a dot that can be pressed.
 *
 * Green, red, or nothing at all, and what the two colours mean is the
 * consultant's own business — done and not done, approved and rejected,
 * paid and unpaid. One press moves to the next, and round again, so there
 * is nothing to learn and nothing to undo but another press.
 *
 * It sits beside the three-dot menu rather than inside it: the menu is
 * three entries and stays three, and a mark that takes two taps and a
 * reading step is a mark nobody keeps up to date.
 */
function MarkButton({
  report, isDark, onMark,
}: {
  report: SurveyReport;
  isDark: boolean;
  onMark: (id: string, mark: SurveyReport["mark"]) => void;
}) {
  const mark = report.mark;
  const color = mark ? markColor(mark, isDark) : undefined;
  return (
    <button
      type="button"
      onClick={() => onMark(report.id, nextMark(mark))}
      aria-label={`${markLabel(mark)} — לחיצה משנה`}
      title={markLabel(mark)}
      className={cn(
        "grid h-8 w-9 shrink-0 place-items-center rounded-xl transition-colors",
        "hover:bg-[var(--home-field)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--home-cta-top)]",
      )}
    >
      {mark ? (
        <span className="h-[14px] w-[14px] rounded-full" style={{ background: color }} />
      ) : (
        <Circle className="h-[14px] w-[14px] text-[var(--home-surface-border)]" strokeWidth={2.5} />
      )}
    </button>
  );
}

/** "21.11" — the created date, which needs no year beside the updated one. */
function dayMonth(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

/** "21.11.26" — the form the approved design uses. */
function shortDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("he-IL", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}
