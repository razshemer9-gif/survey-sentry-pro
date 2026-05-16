import { STANDARDS_DATA } from "./standards-data";
import { AccessibilityRequirement } from "./standards-types";

const STOP_WORDS = new Set(["את", "של", "עם", "על", "אל", "לא", "יש", "כי", "הם", "הן", "אם", "כל", "זה", "זו", "הוא", "היא", "לפי", "בין", "עד", "גם", "רק", "כבר", "עוד", "שם", "כן", "אין"]);

function tokenize(text: string): string[] {
  return text
    .replace(/[()\/\-.,;:"']/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function scoreRequirement(req: AccessibilityRequirement, queryTokens: string[]): number {
  const searchableText = [
    req.requirementTitle,
    req.subCategory,
    req.category,
    req.defectText,
    ...req.tags,
  ]
    .join(" ")
    .toLowerCase();

  const reqTokens = tokenize(searchableText);
  let score = 0;

  for (const qt of queryTokens) {
    const ql = qt.toLowerCase();
    for (const rt of reqTokens) {
      if (rt === ql) {
        score += 2; // exact match
      } else if (rt.includes(ql) || ql.includes(rt)) {
        score += 1; // partial match
      }
    }
  }

  // Boost critical requirements
  if (req.severity === "critical") score *= 1.2;

  return score;
}

export function findMatchingRequirement(itemTitle: string): AccessibilityRequirement | null {
  if (!itemTitle || itemTitle.trim().length < 3) return null;

  const queryTokens = tokenize(itemTitle);
  if (queryTokens.length === 0) return null;

  let bestScore = 0;
  let bestMatch: AccessibilityRequirement | null = null;

  for (const req of STANDARDS_DATA) {
    const score = scoreRequirement(req, queryTokens);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = req;
    }
  }

  // Minimum threshold to avoid false matches
  return bestScore >= 2 ? bestMatch : null;
}
