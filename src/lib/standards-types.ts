export type Severity = 'critical' | 'medium' | 'low';
export type PlaceType = 'exterior' | 'interior' | 'restroom' | 'parking' | 'accessible-route' | 'apartment' | 'signage' | 'vision' | 'communication';

export type SourceConfidence = 'high' | 'needs-review';

export interface AccessibilityRequirement {
  id: string;
  standardPart: string; // e.g. "ת\"י 1918 חלק 2"
  clause?: string;
  category: string; // e.g. "A. דרך נגישה"
  categoryCode: string; // "A", "B", etc.
  subCategory: string;
  requirementTitle: string;
  practicalRequirement: string;
  defectText: string;
  correctionText: string;
  severity?: Severity;
  measurementFields?: string[];
  inspectionMethod: string;
  appliesTo: PlaceType[];
  tags: string[];
  internalCitation?: string;
  referencePhoto?: string; // legacy single photo — read for backwards compat
  referencePhotos?: string[]; // multiple detail photos (preferred)
  // Source tracking — for items extracted from the Israeli Standard 1918 documents
  sourceFile?: string;       // original filename in src/empty-folder
  sourceConfidence?: SourceConfidence;
  sourceNote?: string;       // raw text from the standard, or note for items that need review
}
