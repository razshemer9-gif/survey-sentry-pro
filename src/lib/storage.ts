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
import { withTimeout } from "./async";
import {
  getAllCachedReports,
  getCachedReport,
  getDirtyRows,
  isDirty,
  markDeletedLocally,
  putCachedReport,
} from "./offline-db";
import { remoteGetReport, remoteListReports } from "./reports-remote";
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
export async function listReports(): Promise<SurveyReport[]> {
  startSyncEngine();
  try {
    const remote = await withTimeout(remoteListReports(), 6000, null as SurveyReport[] | null);
    if (remote) {
      const dirty = await getDirtyRows();
      const dirtyIds = new Set(dirty.map((r) => r.id));
      for (const r of remote) {
        if (!dirtyIds.has(r.id)) await putCachedReport(r, false);
      }
    }
  } catch {
    // offline or request failed — serve from local cache below
  }
  const cached = await getAllCachedReports();
  return cached.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
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
    : surveyType === "risk_survey"
    // Findings are created from uploaded photos (bulk picker) — none upfront.
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
