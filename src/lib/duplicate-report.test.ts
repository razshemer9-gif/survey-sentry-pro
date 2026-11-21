import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { copyOfName, copyOfReport } from "./duplicate-report";
import { scheduleDelete, undoDelete, isDeletePending, flushDeletes, UNDO_WINDOW_MS } from "./undo-delete";
import type { SurveyReport } from "./types";

/** A 1×1 PNG, standing in for the photographs a real report carries. */
const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const OTHER = PHOTO.replace("iVBOR", "iVBOQ");

const original = (): SurveyReport => ({
  id: "report-1",
  createdAt: 1_000,
  updatedAt: 2_000,
  placeName: "בית ספר אורנים",
  clientName: "עיריית רעננה",
  address: "הרצל 12",
  surveyDate: "2026-11-18",
  surveyType: "accessibility",
  coverPhoto: PHOTO,
  generalNotes: "הערות כלליות",
  signatureDataUrl: PHOTO,
  signatureDate: "2026-11-18",
  signatureConsultantName: "רז שמר",
  requiredApprovals: ["אישור יועץ בטיחות"],
  selectedClauses: [0, 2],
  eduApprovalStatus: "approve",
  accessibilityComplianceStatus: "yes",
  ownerId: "author",
  items: [
    {
      id: "item-1", title: "מדרגות", status: "non_compliant", notes: "ממצא",
      fieldNotes: "מצב קיים", estimatedCost: 1200, quantity: 2,
      photo: PHOTO, photos: [OTHER], referencePhotos: [PHOTO],
      matchedRequirementId: "req-9", standardPart: 'ת"י 1918 חלק 4', clause: "16.1",
    },
    { id: "item-2", title: "שילוט", status: "compliant", notes: "", estimatedCost: 0 },
  ],
} as SurveyReport);

const makeCopy = (from = original()) => {
  let n = 0;
  return copyOfReport(from, {
    id: "report-2", itemId: () => `new-item-${++n}`, ownerId: "me", now: 9_000,
  });
};

describe("שכפול: the copy carries everything", () => {
  it("keeps every photograph, byte for byte", () => {
    const copy = makeCopy();
    expect(copy.coverPhoto).toBe(PHOTO);
    expect(copy.items[0].photo).toBe(PHOTO);
    expect(copy.items[0].photos).toEqual([OTHER]);
    expect(copy.items[0].referencePhotos).toEqual([PHOTO]);
  });

  it("keeps the signature, the approvals and the findings", () => {
    const copy = makeCopy();
    expect(copy.signatureDataUrl).toBe(PHOTO);
    expect(copy.signatureConsultantName).toBe("רז שמר");
    expect(copy.signatureDate).toBe("2026-11-18");
    expect(copy.requiredApprovals).toEqual(["אישור יועץ בטיחות"]);
    expect(copy.selectedClauses).toEqual([0, 2]);
    expect(copy.eduApprovalStatus).toBe("approve");
    expect(copy.accessibilityComplianceStatus).toBe("yes");
    expect(copy.items).toHaveLength(2);
  });

  it("keeps each finding's own status, cost and standard reference", () => {
    const copy = makeCopy();
    expect(copy.items[0].status).toBe("non_compliant");
    expect(copy.items[0].estimatedCost).toBe(1200);
    expect(copy.items[0].quantity).toBe(2);
    expect(copy.items[0].clause).toBe("16.1");
    expect(copy.items[0].matchedRequirementId).toBe("req-9");
    expect(copy.items[1].status).toBe("compliant");
  });

  it("leaves no field behind", () => {
    const from = original();
    const copy = makeCopy(from);
    const changed = new Set(["id", "placeName", "createdAt", "updatedAt", "ownerId", "items"]);
    for (const key of Object.keys(from) as (keyof SurveyReport)[]) {
      if (changed.has(key)) continue;
      expect({ key, value: copy[key] }).toEqual({ key, value: from[key] });
    }
  });
});

describe("שכפול: the copy is its own report", () => {
  it("has a new id, and a new id for every finding", () => {
    const from = original();
    const copy = makeCopy(from);
    expect(copy.id).not.toBe(from.id);
    expect(copy.items.map((i) => i.id)).toEqual(["new-item-1", "new-item-2"]);
    for (const item of copy.items) {
      expect(from.items.map((i) => i.id)).not.toContain(item.id);
    }
  });

  it("shares no object with the original, so editing one leaves the other alone", () => {
    const from = original();
    const copy = makeCopy(from);

    expect(copy).not.toBe(from);
    expect(copy.items).not.toBe(from.items);
    expect(copy.items[0]).not.toBe(from.items[0]);
    expect(copy.items[0].photos).not.toBe(from.items[0].photos);
    expect(copy.requiredApprovals).not.toBe(from.requiredApprovals);

    copy.items[0].fieldNotes = "נמחק בעותק";
    copy.items[0].photos!.push("another");
    copy.items.pop();
    copy.requiredApprovals!.push("עוד אישור");
    copy.placeName = "משהו אחר";

    expect(from.items).toHaveLength(2);
    expect(from.items[0].fieldNotes).toBe("מצב קיים");
    expect(from.items[0].photos).toEqual([OTHER]);
    expect(from.requiredApprovals).toEqual(["אישור יועץ בטיחות"]);
    expect(from.placeName).toBe("בית ספר אורנים");
  });

  it("starts its own life: new dates, and it belongs to whoever copied it", () => {
    const copy = makeCopy();
    expect(copy.createdAt).toBe(9_000);
    expect(copy.updatedAt).toBe(9_000);
    expect(copy.ownerId).toBe("me");
  });

  it("is told apart in the list by its name", () => {
    expect(makeCopy().placeName).toBe("בית ספר אורנים – עותק");
    expect(copyOfName("")).toBe("עותק");
    expect(copyOfName(undefined)).toBe("עותק");
    expect(copyOfName("  מרפאה  ")).toBe("מרפאה – עותק");
  });

  it("copies a report with no findings and no photographs", () => {
    const bare = { ...original(), items: [], coverPhoto: undefined, signatureDataUrl: undefined };
    const copy = copyOfReport(bare, { id: "x", itemId: () => "y", now: 5 });
    expect(copy.items).toEqual([]);
    expect(copy.id).toBe("x");
  });
});

describe("מחיקה: six seconds to think better of it", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not delete anything until the window is up", async () => {
    const commit = vi.fn(async () => {});
    scheduleDelete("r-1", commit);
    expect(isDeletePending("r-1")).toBe(true);
    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await vi.runAllTimersAsync();
    expect(commit).toHaveBeenCalledOnce();
    expect(isDeletePending("r-1")).toBe(false);
  });

  it("calls it off when the undo is pressed in time", async () => {
    const commit = vi.fn(async () => {});
    scheduleDelete("r-2", commit);
    expect(undoDelete("r-2")).toBe(true);
    await vi.runAllTimersAsync();
    expect(commit).not.toHaveBeenCalled();
  });

  it("says no when the undo comes too late", async () => {
    const commit = vi.fn(async () => {});
    scheduleDelete("r-3", commit);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(undoDelete("r-3")).toBe(false);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("deletes at once when the app is put away", async () => {
    const commit = vi.fn(async () => {});
    scheduleDelete("r-4", commit);
    await flushDeletes();
    expect(commit).toHaveBeenCalledOnce();
    expect(isDeletePending("r-4")).toBe(false);
  });

  it("reports a failed deletion instead of swallowing it", async () => {
    const onError = vi.fn();
    scheduleDelete("r-5", async () => { throw new Error("offline"); }, onError);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("keeps each report's window separate", async () => {
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    scheduleDelete("r-a", a);
    scheduleDelete("r-b", b);
    undoDelete("r-a");
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });
});
