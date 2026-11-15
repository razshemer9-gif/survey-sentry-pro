import { v4 as uuid } from "uuid";
import {
  ChecklistTemplate,
  ConsultantSettings,
  DEFAULT_CHECKLIST,
  DEFAULT_SETTINGS,
  SurveyReport,
  SurveyType,
} from "./types";
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

export function newReport(
  surveyType: SurveyType = "accessibility",
  templateItems?: ChecklistTemplate["items"]
): SurveyReport {
  const items = templateItems
    ? templateItems.map((i) => ({
        id: uuid(),
        title: i.title,
        status: "non_compliant" as const,
        notes: i.notes || "",
        estimatedCost: i.defaultCost || 0,
        ...(i.defaultPriority !== undefined && { priority: i.defaultPriority }),
        ...(i.includeInCost !== undefined && { includeInCost: i.includeInCost }),
        ...(i.referencePhoto && { referencePhoto: i.referencePhoto }),
        ...(i.referencePhotos?.length && { referencePhotos: i.referencePhotos }),
        ...(i.referenceLabel && { referenceLabel: i.referenceLabel }),
        ...(i.suggestedCorrection && { suggestedCorrection: i.suggestedCorrection }),
        ...(i.matchedRequirementId && { matchedRequirementId: i.matchedRequirementId }),
        ...(i.standardPart && { standardPart: i.standardPart }),
        ...(i.clause && { clause: i.clause }),
      }))
    : surveyType === "education_safety" || surveyType === "welfare_inspection" || surveyType === "element_stability"
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

// ---------- Templates (Supabase) ----------
const BUILT_IN_TEMPLATES: ChecklistTemplate[] = [
  {
    id: "builtin-default",
    name: "תבנית ברירת מחדל",
    description: "רשימה כללית לסקר נגישות מתו״ס ושירות",
    items: DEFAULT_CHECKLIST,
    builtIn: true,
  },
];

function rowToTemplate(row: {
  id: string;
  name: string;
  description: string | null;
  items: unknown;
  survey_type: string | null;
}): ChecklistTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    items: Array.isArray(row.items) ? (row.items as ChecklistTemplate["items"]) : [],
    ...(row.survey_type ? { surveyType: row.survey_type as ChecklistTemplate["surveyType"] } : {}),
  };
}

export async function listTemplates(): Promise<ChecklistTemplate[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("user_templates")
    .select("id, name, description, items, survey_type")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const custom = (data ?? []).map(rowToTemplate);
  return [...BUILT_IN_TEMPLATES, ...custom];
}

export async function saveTemplate(t: ChecklistTemplate): Promise<void> {
  if (t.builtIn) return;
  const userId = await getUserId();
  const now = Date.now();
  const { error } = await supabase.from("user_templates").upsert({
    id: t.id,
    user_id: userId,
    name: t.name,
    description: t.description ?? null,
    items: t.items,
    survey_type: t.surveyType ?? null,
    updated_at: now,
  });
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from("user_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function migrateLocalTemplates(): Promise<number> {
  const raw = localStorage.getItem(K_TEMPLATES);
  if (!raw) return 0;
  try {
    const local = JSON.parse(raw) as ChecklistTemplate[];
    if (!Array.isArray(local) || local.length === 0) {
      localStorage.removeItem(K_TEMPLATES);
      return 0;
    }
    for (const t of local) {
      if (!t.builtIn) await saveTemplate(t);
    }
    localStorage.removeItem(K_TEMPLATES);
    return local.length;
  } catch {
    return 0;
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
