import { v4 as uuid } from "uuid";
import {
  ChecklistTemplate,
  ConsultantSettings,
  DEFAULT_CHECKLIST,
  DEFAULT_SETTINGS,
  SurveyReport,
} from "./types";
import { AccessibilityRequirement } from "./standards-types";
import { supabase } from "./supabase";

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

// ---------- Reports (Supabase) ----------
export async function listReports(): Promise<SurveyReport[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("reports")
    .select("data")
    .eq("device_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.data as SurveyReport);
}

export async function getReport(id: string): Promise<SurveyReport | undefined> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("reports")
    .select("data")
    .eq("id", id)
    .eq("device_id", userId)
    .single();
  if (error) return undefined;
  return data?.data as SurveyReport;
}

export async function saveReport(report: SurveyReport): Promise<SurveyReport> {
  const userId = await getUserId();
  const updated = { ...report, updatedAt: Date.now() };
  const { error } = await supabase.from("reports").upsert({
    id: report.id,
    device_id: userId,
    data: updated,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  });
  if (error) throw error;
  return updated;
}

export async function deleteReport(id: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("device_id", userId);
  if (error) throw error;
}

export function newReport(): SurveyReport {
  return {
    id: uuid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    placeName: "",
    clientName: "",
    address: "",
    surveyDate: new Date().toISOString().slice(0, 10),
    items: DEFAULT_CHECKLIST.map((i) => ({
      id: uuid(),
      title: i.title,
      status: "pending",
      notes: "",
      estimatedCost: 0,
    })),
    generalNotes: "",
  };
}

// ---------- Requirements → Report ----------
export async function addRequirementToReport(
  reportId: string,
  req: AccessibilityRequirement,
): Promise<void> {
  const report = await getReport(reportId);
  if (!report) throw new Error("Report not found");
  const photos = (req.referencePhotos && req.referencePhotos.length > 0)
    ? req.referencePhotos
    : (req.referencePhoto ? [req.referencePhoto] : undefined);
  const newItem = {
    id: uuid(),
    title: req.requirementTitle,
    status: "pending" as const,
    notes: req.defectText,
    estimatedCost: 0,
    referencePhoto: photos?.[0],
    referencePhotos: photos,
    suggestedCorrection: req.correctionText || undefined,
    matchedRequirementId: req.id,
    standardPart: req.standardPart,
    clause: req.clause,
  };
  const updated: SurveyReport = { ...report, items: [...report.items, newItem] };
  await saveReport(updated);
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
}): ChecklistTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    items: Array.isArray(row.items) ? (row.items as ChecklistTemplate["items"]) : [],
  };
}

export async function listTemplates(): Promise<ChecklistTemplate[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("user_templates")
    .select("id, name, description, items")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const custom = (data ?? []).map(rowToTemplate);
  return [...BUILT_IN_TEMPLATES, ...custom];
}

export async function saveTemplate(t: ChecklistTemplate): Promise<void> {
  if (t.builtIn) return;
  const userId = await getUserId();
  // Strip base64 photos from items — too large to store inline.
  // matchedRequirementId is preserved so photos can be re-fetched from the standards DB.
  const safeItems = t.items.map(({ referencePhoto, referencePhotos, ...rest }) => rest);
  const now = Date.now();
  const { error } = await supabase.from("user_templates").upsert({
    id: t.id,
    user_id: userId,
    name: t.name,
    description: t.description ?? null,
    items: safeItems,
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

// One-time migration: push any local-only templates up to Supabase, then clear.
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
