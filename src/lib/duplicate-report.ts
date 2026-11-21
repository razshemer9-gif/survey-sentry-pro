import { SurveyReport } from "./types";

/**
 * A copy of a report that owes the original nothing.
 *
 * "שכפול" has to mean a second report, not a second view of the first one.
 * A consultant surveys two wings of the same school and wants the second to
 * start where the first ended: the findings, the photographs taken on site,
 * the signature, the approvals. What must NOT come across is identity — if
 * the copy shared an id with the original, or shared the array its findings
 * live in, editing one would quietly edit both, and the damage would only
 * show up in a PDF weeks later.
 *
 * So: a new id for the report, a new id for every finding, fresh dates, and
 * a structure that shares no object with the original. Everything else —
 * every photograph, every field — comes across byte for byte.
 */

/** What a copy is called, so it is told apart at a glance in the list. */
export const COPY_SUFFIX = "עותק";

export function copyOfName(name: string | undefined): string {
  const base = (name ?? "").trim();
  if (!base) return COPY_SUFFIX;
  return `${base} – ${COPY_SUFFIX}`;
}

export function copyOfReport(
  original: SurveyReport,
  { id, itemId, ownerId, now }: {
    /** The copy's own id. */
    id: string;
    /** A fresh id per finding; called once for each. */
    itemId: () => string;
    /** Whoever pressed שכפול owns the copy, even when copying a colleague's. */
    ownerId?: string;
    now: number;
  },
): SurveyReport {
  // A report holds only plain data — strings, numbers, arrays and the
  // photographs as data URLs — so this both deep-copies and guarantees no
  // object is shared with the original.
  const copy: SurveyReport = JSON.parse(JSON.stringify(original));

  copy.id = id;
  copy.items = (copy.items ?? []).map((item) => ({ ...item, id: itemId() }));
  copy.placeName = copyOfName(original.placeName);
  copy.createdAt = now;
  copy.updatedAt = now;
  if (ownerId) copy.ownerId = ownerId;

  return copy;
}
