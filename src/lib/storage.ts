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

// ---------- Templates (localStorage) ----------
const BUILT_IN_TEMPLATES: ChecklistTemplate[] = [
  {
    id: "builtin-default",
    name: "תבנית ברירת מחדל",
    description: "רשימה כללית לסקר נגישות מתו״ס ושירות",
    items: DEFAULT_CHECKLIST,
    builtIn: true,
  },
];

export function listTemplates(): ChecklistTemplate[] {
  const custom = read<ChecklistTemplate[]>(K_TEMPLATES, []);
  return [...BUILT_IN_TEMPLATES, ...custom];
}
export function saveTemplate(t: ChecklistTemplate) {
  if (t.builtIn) return;
  // Strip base64 photos from template items — they're too large for localStorage.
  // matchedRequirementId is preserved so photos can be re-fetched on report load.
  const safe: ChecklistTemplate = {
    ...t,
    items: t.items.map(({ referencePhoto, referencePhotos, ...rest }) => rest),
  };
  const all = read<ChecklistTemplate[]>(K_TEMPLATES, []);
  const idx = all.findIndex((x) => x.id === safe.id);
  if (idx >= 0) all[idx] = safe;
  else all.push(safe);
  write(K_TEMPLATES, all);
}
export function deleteTemplate(id: string) {
  write(
    K_TEMPLATES,
    read<ChecklistTemplate[]>(K_TEMPLATES, []).filter((t) => t.id !== id),
  );
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
