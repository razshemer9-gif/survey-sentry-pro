import { v4 as uuid } from "uuid";
import {
  ChecklistTemplate,
  ConsultantSettings,
  DEFAULT_CHECKLIST,
  DEFAULT_SETTINGS,
  SURVEY_TYPES,
  SurveyReport,
  SurveyType,
} from "./types";
import { pickSavedList, SavedListRow, savedListToItems, TYPES_WITH_SAVED_START } from "./starting-items";
import { AccessibilityRequirement } from "./standards-types";
import { supabase } from "./supabase";

/**
 * The account signed in right now, read from the session already on the
 * device — never a network call, because every cache read waits on it.
 * Null when nobody is signed in, which shows nothing rather than everything.
 */
async function currentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
import { RISK_SURVEY_DEFAULT_FENCING_NOTE } from "./risk-survey";
import { FORM8_REQUIREMENTS } from "./form8-data";
import { withTimeout } from "./async";
import { cacheSettings, cachedSettings, resolveSettings } from "./settings-cache";
import {
  getAllCachedReports,
  getCachedReport,
  getDirtyRows,
  isDirty,
  markDeletedLocally,
  putCachedReport,
} from "./offline-db";
import { remoteGetReport, remoteListReports, remoteListReportAuthors, remoteListReportSummaries } from "./reports-remote";
import { startSyncEngine, syncPendingReports } from "./sync-engine";

const K_TEMPLATES = "ans.templates.v1";

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("משתמש לא מחובר");
  return user.id;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- Reports (local-first: IndexedDB cache + background sync) ----------
/**
 * Why the last listReports() call could not refresh from the server, or null
 * if it did. Falling back to the local cache is normal offline behaviour, but
 * it also silently hides reports the cache has never seen — anything written
 * by another user, for instance. Callers surface this so a failed refresh
 * looks like a failure rather than like an empty result.
 */
let lastRefreshError: string | null = null;
export function getLastRefreshError(): string | null {
  return lastRefreshError;
}

// A report row carries its photos inline, so listing every user's reports can
// mean tens of megabytes. The old 6s budget was tuned for "my reports only"
// and is far too tight for that on a mobile connection.
const LIST_TIMEOUT_MS = 30_000;

/**
 * Everything this device already holds, with no network at all.
 *
 * This is what the screen should draw first. listReports() below waits on two
 * remote calls before it returns anything — the list of names, then every
 * recent report in full, megabytes of photographs — so on a slow connection
 * the consultant watched a spinner for up to a minute with a cache sitting
 * on the device that could have answered at once.
 *
 * The sync engine is started here too, so work queued offline goes up whether
 * or not anybody waits for the refresh.
 */
export async function cachedReports(): Promise<SurveyReport[]> {
  startSyncEngine();
  const userId = await currentUserId();
  const cached = await getAllCachedReports(userId);
  return cached.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/**
 * The same refresh listReports() does, but in two steps, each handed to the
 * caller as soon as it is ready.
 *
 * The names arrive first and complete the list; the full reports follow and
 * only add offline reach. Nothing here is awaited by the screen — it draws
 * from the cache and takes these as they come.
 */
export async function refreshReports(
  onReady?: (reports: SurveyReport[]) => void,
): Promise<SurveyReport[]> {
  lastRefreshError = null;
  const userId = await currentUserId();

  const merge = async (summaries: SurveyReport[]) => {
    const cached = await getAllCachedReports(userId);
    const byId = new Set(cached.map((r) => r.id));
    return [...cached, ...summaries.filter((r) => !byId.has(r.id))]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  };

  let summaries: SurveyReport[] = [];
  try {
    summaries = await withTimeout(remoteListReportSummaries(), LIST_TIMEOUT_MS, [] as SurveyReport[]);
    onReady?.(await merge(summaries));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
    lastRefreshError = `שגיאה בטעינת רשימת הדוחות: ${detail}`;
    console.error("[refreshReports] summary fetch failed:", err);
  }

  // Best-effort, and deliberately second: this is the heavy one. Failing here
  // costs offline access to the newest reports, nothing more.
  try {
    const TIMED_OUT = Symbol("timeout");
    const remote = await withTimeout<SurveyReport[] | typeof TIMED_OUT>(
      remoteListReports(),
      LIST_TIMEOUT_MS,
      TIMED_OUT,
    );
    if (remote !== TIMED_OUT) {
      const dirty = await getDirtyRows(userId);
      const dirtyIds = new Set(dirty.map((r) => r.id));
      for (const r of remote) {
        if (!dirtyIds.has(r.id)) await putCachedReport(r, false, userId);
      }
    }
  } catch (err) {
    console.warn("[refreshReports] offline prefetch failed:", err);
  }

  const final = await merge(summaries);
  onReady?.(final);
  return final;
}

export async function listReports(): Promise<SurveyReport[]> {
  startSyncEngine();
  lastRefreshError = null;
  const userId = await currentUserId();
  let summaries: SurveyReport[] = [];

  // The list itself. This is the whole list — every report the account may
  // see, names and dates only — and it is fetched FIRST and on its own.
  //
  // It used to be nested inside the full-report prefetch below, so when that
  // threw, this never ran at all: the screen fell back to whatever the device
  // had cached. On a new phone, which has cached nothing, that meant a list of
  // two reports standing in for two hundred and seventy-seven.
  try {
    summaries = await withTimeout(remoteListReportSummaries(), LIST_TIMEOUT_MS, [] as SurveyReport[]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
    lastRefreshError = `שגיאה בטעינת רשימת הדוחות: ${detail}`;
    console.error("[listReports] summary fetch failed:", err);
  }

  // Separately, and best-effort: pull the most recent reports down in full so
  // they can be opened with no signal. Failing here costs offline access to
  // them, nothing more — the list above is already complete.
  try {
    const TIMED_OUT = Symbol("timeout");
    const remote = await withTimeout<SurveyReport[] | typeof TIMED_OUT>(
      remoteListReports(),
      LIST_TIMEOUT_MS,
      TIMED_OUT,
    );
    if (remote !== TIMED_OUT) {
      const dirty = await getDirtyRows(userId);
      const dirtyIds = new Set(dirty.map((r) => r.id));
      for (const r of remote) {
        if (!dirtyIds.has(r.id)) await putCachedReport(r, false, userId);
      }
    }
  } catch (err) {
    console.warn("[listReports] offline prefetch failed:", err);
  }

  const cached = await getAllCachedReports(userId);
  // The cache wins for any report it holds in full; summaries only fill in
  // rows the device has never had (i.e. other users').
  const byId = new Set(cached.map((r) => r.id));
  const merged = [...cached, ...summaries.filter((r) => !byId.has(r.id))];
  return merged.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/**
 * Account id -> display name, for labelling reports written by someone else.
 * Returns {} when offline or when the profiles table is unreachable; callers
 * treat a missing name as "no badge" rather than an error.
 */
export async function listReportAuthors(): Promise<Record<string, string>> {
  try {
    return await withTimeout(remoteListReportAuthors(), 6000, {} as Record<string, string>);
  } catch {
    return {};
  }
}

export async function getReport(id: string): Promise<SurveyReport | undefined> {
  startSyncEngine();
  const userId = await currentUserId();
  const cached = await getCachedReport(id, userId);
  try {
    const dirty = await isDirty(id);
    if (!dirty) {
      const remote = await withTimeout(remoteGetReport(id), 6000, undefined);
      if (remote) {
        await putCachedReport(remote, false, userId);
        return remote;
      }
    }
  } catch {
    // offline or request failed — fall back to local cache
  }
  return cached;
}

export async function saveReport(report: SurveyReport): Promise<SurveyReport> {
  const updated = { ...report, updatedAt: Date.now() };
  await putCachedReport(updated, true, await currentUserId());
  void syncPendingReports();
  return updated;
}

export async function deleteReport(id: string): Promise<void> {
  await markDeletedLocally(id);
  void syncPendingReports();
}

export async function addRequirementToReport(
  reportId: string,
  req: AccessibilityRequirement
): Promise<void> {
  const report = await getReport(reportId);
  if (!report) throw new Error("דוח לא נמצא");
  const newItem = {
    id: uuid(),
    title: req.requirementTitle,
    status: "non_compliant" as const,
    notes: req.defectText,
    estimatedCost: 0,
    suggestedCorrection: req.correctionText,
    matchedRequirementId: req.id,
    ...(req.standardPart && { standardPart: req.standardPart }),
    ...(req.clause && { clause: req.clause }),
    ...(req.referencePhotos?.length && { referencePhotos: req.referencePhotos }),
    ...(req.referencePhoto && { referencePhoto: req.referencePhoto }),
  };
  await saveReport({ ...report, items: [...report.items, newItem] });
}

/**
 * A new, empty report of this type.
 *
 * `savedItems` is the consultant's own starting list for this type, when
 * there is one — see ./starting-items and loadStartingItems below. Without
 * it each type falls back to what it can supply on its own, so a report can
 * always be started, on any account, with nothing set up first.
 */
export function newReport(
  surveyType: SurveyType = "accessibility",
  savedItems?: SurveyReport["items"],
): SurveyReport {
  const items =
    savedItems?.length
    ? savedItems
    // Safety surveys are written from what the inspector finds on site, so
    // they open on one empty finding rather than a list to work through.
    : surveyType === "general_safety"
    || surveyType === "education_safety" || surveyType === "welfare_inspection" || surveyType === "element_stability"
    ? [{
        id: uuid(),
        title: "",
        status: "non_compliant" as const,
        notes: "",
        estimatedCost: 0,
      }]
    : surveyType === "risk_survey" || surveyType === "accessibility_form_8" || surveyType === "accessibility_form_8_event"
    // risk_survey: findings are created from uploaded photos (bulk picker).
    // the form 8 types: content lives in their own fields, not in items.
    ? []
    : DEFAULT_CHECKLIST.map((i) => ({
        id: uuid(),
        title: i.title,
        status: "non_compliant" as const,
        notes: "",
        estimatedCost: 0,
      }));

  return {
    id: uuid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    surveyType,
    placeName: "",
    clientName: "",
    address: "",
    surveyDate: new Date().toISOString().slice(0, 10),
    items,
    generalNotes: "",
    ...(surveyType === "risk_survey" && {
      riskFencingNote: RISK_SURVEY_DEFAULT_FENCING_NOTE,
      riskFencingNoteEnabled: true,
    }),
    ...(surveyType === "accessibility_form_8" && {
      form8Requirements: FORM8_REQUIREMENTS.map((r) => ({ id: r.id, response: r.defaultResponse ?? "" })),
    }),
  };
}

/**
 * The consultant's own starting list for this report type, or null when the
 * account has none and the built-in list should be used instead.
 *
 * Never throws and never blocks: a list that cannot be read is simply a
 * report that opens on the built-in checklist. See ./starting-items for what
 * the list is and why it has no page of its own.
 */
export async function loadStartingItems(surveyType: SurveyType): Promise<SurveyReport["items"] | null> {
  if (!TYPES_WITH_SAVED_START.includes(surveyType)) return null;
  try {
    const userId = await getUserId();
    const label = SURVEY_TYPES.find((t) => t.id === surveyType)?.label ?? "";

    // Two reads rather than one: the lists carry reference photographs and
    // run to megabytes, so the names come over first and only the matching
    // list is fetched whole.
    //
    // No user filter: the database hands back this account's own lists and
    // the company list the owner publishes, and pickSavedList prefers the
    // account's own. The narrow read is the fallback for a database that
    // does not have the shared column yet, so the order in which the
    // migration and this code land cannot leave anybody without a list.
    let rows: SavedListRow[] | null = null;
    const wide = await supabase
      .from("user_templates")
      .select("id, name, survey_type, user_id, shared")
      .order("updated_at", { ascending: false });
    if (wide.error) {
      console.warn("[starting-items] shared lists unavailable, reading own only", wide.error);
      const narrow = await supabase
        .from("user_templates")
        .select("id, name, survey_type")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (narrow.error) throw narrow.error;
      rows = narrow.data as SavedListRow[] | null;
    } else {
      rows = wide.data as SavedListRow[] | null;
    }

    const match = pickSavedList(rows ?? [], surveyType, label, userId);
    if (!match) return null;

    const { data: row, error: itemsError } = await supabase
      .from("user_templates")
      .select("items")
      .eq("id", match.id)
      .maybeSingle();
    if (itemsError) throw itemsError;

    const items = row?.items;
    if (!Array.isArray(items) || items.length === 0) return null;
    return savedListToItems(items as ChecklistTemplate["items"]);
  } catch (err) {
    console.error("[starting-items] could not read the saved list", err);
    return null;
  }
}

// ---------- Settings (localStorage) ----------
// ---------- User settings (Supabase, with a local copy) ----------
/**
 * The settings a report is drawn from. Read from Supabase, and kept locally
 * so that a read which does not answer — offline, or a request that fails —
 * no longer silently hands the report blank defaults, printing it without the
 * consultant's stamp or company name. See ./settings-cache.
 */
export async function loadUserSettings(userId: string): Promise<ConsultantSettings> {
  try {
    // A timeout, because a phone with one bar should fall back to the local
    // copy rather than keep the report waiting for its stamp.
    const row = await withTimeout<{ settings?: ConsultantSettings } | null>(
      (async () => {
        const { data } = await supabase
          .from("user_settings").select("settings").eq("user_id", userId).single();
        return data as { settings?: ConsultantSettings } | null;
      })(),
      6000,
      null,
    );
    const remote = row?.settings;
    if (remote) {
      cacheSettings(userId, remote);
      return resolveSettings(remote, null);
    }
  } catch {
    // Offline, slow, or no row yet — fall back to the copy we kept.
  }
  return resolveSettings(null, cachedSettings(userId));
}

export async function saveUserSettings(userId: string, s: ConsultantSettings): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, settings: s, updated_at: Date.now() });
  if (error) throw error;
  // Only once the server has it, so the local copy never gets ahead of it.
  cacheSettings(userId, s);
}
