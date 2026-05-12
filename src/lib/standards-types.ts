export type Severity = 'critical' | 'medium' | 'low';
export type PlaceType = 'exterior' | 'interior' | 'restroom' | 'parking' | 'accessible-route' | 'apartment' | 'signage' | 'vision' | 'communication';

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
  severity: Severity;
  measurementFields?: string[];
  inspectionMethod: string;
  appliesTo: PlaceType[];
  tags: string[];
}
