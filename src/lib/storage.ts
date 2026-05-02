import { v4 as uuid } from "uuid";
import {
  ChecklistTemplate,
  ConsultantSettings,
  DEFAULT_CHECKLIST,
  DEFAULT_SETTINGS,
  SurveyReport,
} from "./types";

const K_REPORTS = "ans.reports.v1";
const K_TEMPLATES = "ans.templates.v1";
const K_SETTINGS = "ans.settings.v1";

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

// ---------- Reports ----------
export function listReports(): SurveyReport[] {
  return read<SurveyReport[]>(K_REPORTS, []).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getReport(id: string): SurveyReport | undefined {
  return listReports().find((r) => r.id === id);
}
export function saveReport(report: SurveyReport) {
  const all = read<SurveyReport[]>(K_REPORTS, []);
  const idx = all.findIndex((r) => r.id === report.id);
  const updated = { ...report, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  write(K_REPORTS, all);
  return updated;
}
export function deleteReport(id: string) {
  write(
    K_REPORTS,
    read<SurveyReport[]>(K_REPORTS, []).filter((r) => r.id !== id),
  );
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

// ---------- Templates ----------
const BUILT_IN_TEMPLATES: ChecklistTemplate[] = [
  {
    id: "builtin-default",
    name: "תבנית ברירת מחדל",
    description: "רשימה כללית לסקר נגישות מתו״ס",
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
  const all = read<ChecklistTemplate[]>(K_TEMPLATES, []);
  const idx = all.findIndex((x) => x.id === t.id);
  if (idx >= 0) all[idx] = t;
  else all.push(t);
  write(K_TEMPLATES, all);
}
export function deleteTemplate(id: string) {
  write(
    K_TEMPLATES,
    read<ChecklistTemplate[]>(K_TEMPLATES, []).filter((t) => t.id !== id),
  );
}

// ---------- Settings ----------
export function getSettings(): ConsultantSettings {
  return { ...DEFAULT_SETTINGS, ...read<ConsultantSettings>(K_SETTINGS, DEFAULT_SETTINGS) };
}
export function saveSettings(s: ConsultantSettings) {
  write(K_SETTINGS, s);
}
