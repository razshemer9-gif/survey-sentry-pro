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
import { RISK_SURVEY_DEFAULT_FENCING_NOTE } from "./risk-survey";
import { FORM8_REQUIREMENTS } from "./form8-data";
import { withTimeout } from "./async";
import {
  getAllCachedReports,
  getCachedReport,
  getDirtyRows,
  isDirty,
  markDeletedLocally,
  putCachedReport,
} from "./offline-db";
import { remoteGetReport, remoteListReports, remoteListReportAuthors } from "./reports-remote";
import { startSyncEngine, syncPendingReports } from "./sync-engine";

const K_TEMPLATES = "ans.templates.v1";
const K_SETTINGS = "ans.settings.v1";

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
  try {
    const TIMED_OUT = Symbol("timeout");
    const remote = await withTimeout<SurveyReport[] | typeof TIMED_OUT>(
      remoteListReports(),
      LIST_TIMEOUT_MS,
      TIMED_OUT,
    );
    if (remote === TIMED_OUT) {
      lastRefreshError = `הרשימה לא התרעננה מהשרת (יותר מ-${LIST_TIMEOUT_MS / 1000} שניות). מוצגים הדוחות השמורים במכשיר.`;
    } else {
      const dirty = await getDirtyRows();
      const dirtyIds = new Set(dirty.map((r) => r.id));
      for (const r of remote) {
        if (!dirtyIds.has(r.id)) await putCachedReport(r, false);
      }
    }
  } catch (err) {
    // Still serve the cache — but do not pretend the refresh succeeded.
    const detail = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
    lastRefreshError = `שגיאה בטעינה מהשרת: ${detail}`;
    console.error("[listReports] remote refresh failed:", err);
  }
  const cached = await getAllCachedReports();
  return cached.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
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
  const cached = await getCachedReport(id);
  try {
    const dirty = await isDirty(id);
    if (!dirty) {
      const remote = await withTimeout(remoteGetReport(id), 6000, undefined);
      if (remote) {
        await putCachedReport(remote, false);
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
  await putCachedReport(updated, true);
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
    : surveyType === "risk_survey" || surveyType === "accessibility_form_8"
    // risk_survey: findings are created from uploaded photos (bulk picker).
    // accessibility_form_8: content lives in form8Requirements, not items.
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
export function getSettings(): ConsultantSettings {
  return { ...DEFAULT_SETTINGS, ...read<ConsultantSettings>(K_SETTINGS, DEFAULT_SETTINGS) };
}
export function saveSettings(s: ConsultantSettings) {
  write(K_SETTINGS, s);
}

// ---------- User settings (Supabase) ----------
export async function loadUserSettings(userId: string): Promise<ConsultantSettings> {
  const { data } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .single();
  return { ...DEFAULT_SETTINGS, ...(data?.settings as ConsultantSettings | undefined) };
}

export async function saveUserSettings(userId: string, s: ConsultantSettings): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, settings: s, updated_at: Date.now() });
  if (error) throw error;
}
