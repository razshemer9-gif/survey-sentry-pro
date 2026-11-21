import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { deleteReport, duplicateReport, getReport, saveReport } from "@/lib/storage";
import { scheduleDelete, undoDelete, UNDO_WINDOW_MS } from "@/lib/undo-delete";
import { SurveyReport } from "@/lib/types";

/**
 * What the three-dot menu does, shared by the three screens that show it,
 * so a report behaves the same wherever it is met.
 */
export function useReportActions(
  setReports: (update: (prev: SurveyReport[]) => SurveyReport[]) => void,
) {
  const navigate = useNavigate();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  /** Rows whose deletion is waiting out its undo window. */
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const duplicate = useCallback(async (id: string) => {
    if (duplicatingId) return;
    setDuplicatingId(id);
    // The copy carries every photograph, so this is seconds, not milliseconds.
    const working = toast.loading("משכפל את הדוח…");
    try {
      const copy = await duplicateReport(id);
      setReports((prev) => [copy, ...prev.filter((r) => r.id !== copy.id)]);
      toast.success("הדוח שוכפל", {
        id: working,
        description: copy.placeName,
        action: { label: "פתח", onClick: () => navigate(`/report/${copy.id}`) },
      });
    } catch (err) {
      console.error("[duplicate] failed", err);
      toast.error("שגיאה בשכפול הדוח", {
        id: working,
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDuplicatingId(null);
    }
  }, [duplicatingId, navigate, setReports]);

  const remove = useCallback((id: string) => {
    if (!confirm("למחוק את הדוח?")) return;

    const unhide = () => setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    setHiddenIds((prev) => new Set(prev).add(id));
    scheduleDelete(
      id,
      async () => {
        await deleteReport(id);
        setReports((prev) => prev.filter((r) => r.id !== id));
      },
      (err) => {
        console.error("[delete] failed", err);
        unhide();
        toast.error("שגיאה במחיקת הדוח");
      },
    );

    toast("הדוח נמחק", {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "ביטול",
        onClick: () => {
          if (undoDelete(id)) {
            unhide();
            toast.success("המחיקה בוטלה");
          } else {
            // The window closed between the press and the handler.
            toast.error("המחיקה כבר בוצעה");
          }
        },
      },
    });
  }, [setReports]);

  /**
   * The coloured mark on a report. Written straight through to the report,
   * and shown at once — a mark that waits for the network is a mark pressed
   * twice.
   */
  const setMark = useCallback(async (id: string, mark: SurveyReport["mark"]) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, mark } : r)));
    let previous: SurveyReport["mark"];
    try {
      const full = await getReport(id);
      if (!full) throw new Error("הדוח לא נמצא");
      previous = full.mark;   // what to put back, from the report itself
      await saveReport({ ...full, mark });
    } catch (err) {
      console.error("[mark] failed", err);
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, mark: previous } : r)));
      toast.error("לא הצלחתי לשמור את הסימון");
    }
  }, [setReports]);

  return { duplicate, remove, setMark, duplicatingId, hiddenIds };
}
