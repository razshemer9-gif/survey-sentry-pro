import { STANDARDS_DATA } from "./standards-data";
import { AccessibilityRequirement } from "./standards-types";

const STOP_WORDS = new Set(["את", "של", "עם", "על", "אל", "לא", "יש", "כי", "הם", "הן", "אם", "כל", "זה", "זו", "הוא", "היא", "לפי", "בין", "עד", "גם", "רק", "כבר", "עוד", "שם", "כן", "אין", "ללא", "אחד", "שני"]);

// Key Hebrew accessibility synonyms / root forms
const SYNONYMS: Record<string, string[]> = {
  "נגיש": ["נגישה", "נגישות", "נגישים"],
  "כניסה": ["כניסות", "כניסת"],
  "שירות": ["שירותים", "שירותי"],
  "חניה": ["חניות", "חנייה"],
  "מדרגה": ["מדרגות", "מדרגת"],
  "רמפה": ["רמפות", "כבש", "כבשים"],
  "מעלית": ["מעליות"],
  "שילוט": ["שלטים", "שלט"],
  "דלת": ["דלתות", "דלפק"],
  "שירותי נכים": ["שירותים", "נכים"],
  "מאחז": ["מאחזי", "אחיזה"],
  "לולאה": ["לולאת", "השראה"],
};

function normalize(word: string): string {
  const w = word.toLowerCase();
  for (const [root, forms] of Object.entries(SYNONYMS)) {
    if (forms.includes(w) || root === w) return root;
  }
  return w;
}

function tokenize(text: string): string[] {
  return text
    .replace(/[()\/\-.,;:"']/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(normalize);
}

function scoreRequirement(req: AccessibilityRequirement, queryTokens: string[]): number {
  const searchableText = [
    req.requirementTitle,
    req.subCategory,
    req.category,
    req.defectText,
    req.practicalRequirement,
    ...(req.tags ?? []),
  ]
    .join(" ");

  const reqTokens = tokenize(searchableText);
  let score = 0;

  for (const qt of queryTokens) {
    for (const rt of reqTokens) {
      if (rt === qt) {
        score += 2; // exact / normalized match
      } else if (rt.includes(qt) || qt.includes(rt)) {
        score += 1; // partial match
      }
    }
  }

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

  return bestScore >= 1 ? bestMatch : null;
}
