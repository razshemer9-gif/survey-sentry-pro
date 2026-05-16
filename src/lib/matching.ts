import { STANDARDS_DATA } from "./standards-data";
import { AccessibilityRequirement } from "./standards-types";

const STOP_WORDS = new Set([
  "את", "של", "עם", "על", "אל", "לא", "יש", "כי", "הם", "הן", "אם",
  "כל", "זה", "זו", "הוא", "היא", "לפי", "בין", "עד", "גם", "רק",
  "כבר", "עוד", "שם", "כן", "אין", "ללא", "אחד", "שני", "הם", "כך",
]);

// Root normalization — maps inflected forms to a canonical root
const ROOT_MAP: Record<string, string> = {
  "נגישה": "נגיש", "נגישות": "נגיש", "נגישים": "נגיש",
  "כניסות": "כניסה", "כניסת": "כניסה",
  "שירותים": "שירות", "שירותי": "שירות",
  "חניות": "חניה", "חנייה": "חניה",
  "מדרגות": "מדרגה", "מדרגת": "מדרגה",
  "רמפות": "רמפה", "כבשים": "רמפה", "כבש": "רמפה",
  "מעליות": "מעלית",
  "שלטים": "שילוט", "שלט": "שילוט",
  "דלתות": "דלת",
  "מאחזי": "מאחז",
  "לולאת": "לולאה",
  "חיית": "חיה",
  "תקניים": "תקני", "תקנית": "תקני",
  "ראשית": "ראשי",
};

function normalize(word: string): string {
  const w = word.toLowerCase();
  return ROOT_MAP[w] ?? w;
}

function tokenize(text: string): string[] {
  return text
    .replace(/[()\/\-.,;:"'״׳]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(normalize);
}

function scoreRequirement(req: AccessibilityRequirement, queryTokens: string[]): number {
  const titleTokens = tokenize(req.requirementTitle);
  const tagTokens = tokenize((req.tags ?? []).join(" "));
  const subCatTokens = tokenize(req.subCategory + " " + req.category);
  const bodyTokens = tokenize((req.defectText ?? "") + " " + (req.practicalRequirement ?? ""));

  let score = 0;

  for (const qt of queryTokens) {
    // Title — highest weight
    for (const rt of titleTokens) {
      if (rt === qt) score += 8;
      else if (rt.includes(qt) || qt.includes(rt)) score += 3;
    }
    // Tags — high weight
    for (const rt of tagTokens) {
      if (rt === qt) score += 5;
      else if (rt.includes(qt) || qt.includes(rt)) score += 2;
    }
    // Sub-category — medium weight
    for (const rt of subCatTokens) {
      if (rt === qt) score += 3;
      else if (rt.includes(qt) || qt.includes(rt)) score += 1;
    }
    // Body text — low weight (context only, not enough to trigger alone)
    for (const rt of bodyTokens) {
      if (rt === qt) score += 1;
    }
  }

  if (req.severity === "critical") score *= 1.15;

  return score;
}

export function findMatchingRequirement(itemTitle: string): AccessibilityRequirement | null {
  if (!itemTitle || itemTitle.trim().length < 3) return null;

  const queryTokens = tokenize(itemTitle);
  if (queryTokens.length === 0) return null;

  let bestScore = 0;
  let secondScore = 0;
  let bestMatch: AccessibilityRequirement | null = null;

  for (const req of STANDARDS_DATA) {
    const score = scoreRequirement(req, queryTokens);
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestMatch = req;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  // Require strong title/tag match (>= 8) AND meaningful lead over second-best
  if (bestScore < 8) return null;
  if (secondScore > 0 && bestScore < secondScore * 1.5) return null;

  return bestMatch;
}
