import { supabase } from "./supabase";
import { STANDARDS_DATA } from "./standards-data";
import { AccessibilityRequirement, Severity, PlaceType } from "./standards-types";

const TABLE = "accessibility_requirements";

interface DbRow {
  id: string;
  standard_part: string;
  clause: string | null;
  category: string;
  category_code: string;
  sub_category: string;
  requirement_title: string;
  practical_requirement: string;
  defect_text: string;
  correction_text: string;
  severity: string;
  measurement_fields: string[] | null;
  inspection_method: string;
  applies_to: string[];
  tags: string[];
  internal_citation: string | null;
  reference_photo?: string | null; // SQL: ALTER TABLE accessibility_requirements ADD COLUMN reference_photo text;
  reference_photos?: string[] | null; // SQL: ALTER TABLE accessibility_requirements ADD COLUMN reference_photos jsonb;
  updated_at: number;
}

function rowToReq(r: DbRow): AccessibilityRequirement {
  return {
    id: r.id,
    standardPart: r.standard_part,
    clause: r.clause ?? undefined,
    category: r.category,
    categoryCode: r.category_code,
    subCategory: r.sub_category,
    requirementTitle: r.requirement_title,
    practicalRequirement: r.practical_requirement,
    defectText: r.defect_text,
    correctionText: r.correction_text,
    severity: r.severity as Severity,
    measurementFields: r.measurement_fields ?? undefined,
    inspectionMethod: r.inspection_method,
    appliesTo: (r.applies_to ?? []) as PlaceType[],
    tags: r.tags ?? [],
    internalCitation: r.internal_citation ?? undefined,
    referencePhoto: r.reference_photo ?? undefined,
    referencePhotos: normalizePhotos(r.reference_photos, r.reference_photo),
  };
}

// Backwards-compat: prefer reference_photos array; fall back to single reference_photo
function normalizePhotos(arr: string[] | null | undefined, single: string | null | undefined): string[] | undefined {
  if (Array.isArray(arr) && arr.length > 0) return arr.filter(Boolean);
  if (single) return [single];
  return undefined;
}

function reqToRow(req: AccessibilityRequirement): DbRow {
  return {
    id: req.id,
    standard_part: req.standardPart,
    clause: req.clause ?? null,
    category: req.category,
    category_code: req.categoryCode,
    sub_category: req.subCategory,
    requirement_title: req.requirementTitle,
    practical_requirement: req.practicalRequirement,
    defect_text: req.defectText,
    correction_text: req.correctionText,
    severity: req.severity ?? "",
    measurement_fields: req.measurementFields ?? null,
    inspection_method: req.inspectionMethod,
    applies_to: req.appliesTo ?? [],
    tags: req.tags ?? [],
    internal_citation: req.internalCitation ?? null,
    reference_photo: (req.referencePhotos && req.referencePhotos.length > 0)
      ? req.referencePhotos[0]
      : (req.referencePhoto ?? null),
    reference_photos: (req.referencePhotos && req.referencePhotos.length > 0)
      ? req.referencePhotos
      : (req.referencePhoto ? [req.referencePhoto] : null),
    updated_at: Date.now(),
  };
}

export async function seedRequirements(): Promise<void> {
  const rows = STANDARDS_DATA.map(reqToRow);
  // ignoreDuplicates: true — never overwrite rows that already exist (admin edits are safe)
  const { error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function listRequirements(): Promise<AccessibilityRequirement[]> {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw error;
  if (!data || data.length === 0) {
    await seedRequirements();
    const res = await supabase.from(TABLE).select("*");
    if (res.error) throw res.error;
    return (res.data ?? []).map((r) => rowToReq(r as DbRow));
  }
  return data.map((r) => rowToReq(r as DbRow));
}

export async function saveRequirement(req: AccessibilityRequirement): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(reqToRow(req), { onConflict: "id" });
  if (error) throw error;
}

export async function deleteRequirement(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export function isAdmin(): boolean {
  return localStorage.getItem("ans.admin") === "1";
}

// Async version: validates that the admin flag belongs to a real authenticated session.
// Clears the flag and returns false if the user is not logged in.
export async function validateAdminSession(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      localStorage.removeItem("ans.admin");
      return false;
    }
    return localStorage.getItem("ans.admin") === "1";
  } catch {
    return false;
  }
}
