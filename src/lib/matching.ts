import { STANDARDS_DATA } from "./standards-data";
import { AccessibilityRequirement } from "./standards-types";
const STOP_WORDS = new Set([
  "את", "של", "עם", "על", "אל", "לא", "יש", "כי", "הם", "הן", "אם",
  "כל", "זה", "זו", "הוא", "היא", "לפי", "בין", "עד", "גם", "רק",
  "כבר", "עוד", "שם", "כן", "אין", "ללא", "כך", "אחד", "שני",
]);

// Maps any inflected/prefixed form → canonical root
const ROOT_MAP: Record<string, string> = {
  // נגיש
  "נגישה": "נגיש", "נגישות": "נגיש", "נגישים": "נגיש", "נגישי": "נגיש",
  // כניסה
  "כניסות": "כניסה", "כניסת": "כניסה",
  // שירות
  "שירותים": "שירות", "שירותי": "שירות", "ובשירותים": "שירות", "בשירותים": "שירות",
  // חניה
  "חניות": "חניה", "חנייה": "חניה", "לחניה": "חניה",
  // מדרגה
  "מדרגות": "מדרגה", "מדרגת": "מדרגה",
  // רמפה / כבש
  "רמפות": "רמפה", "ברמפה": "רמפה",
  "כבשים": "כבש", "וכבשים": "כבש",
  // מעלית
  "מעליות": "מעלית", "ובמעליות": "מעלית", "במעליות": "מעלית",
  // שילוט
  "שלטים": "שילוט", "שלט": "שילוט", "ושילוט": "שילוט",
  // דלת
  "דלתות": "דלת",
  // מאחז
  "מאחזי": "מאחז", "ומאחזי": "מאחז",
  // לולאה
  "לולאת": "לולאה",
  // חיה
  "חיית": "חיה", "חיות": "חיה",
  // תקני
  "תקניים": "תקני", "תקנית": "תקני",
  // ראשי
  "ראשית": "ראשי",
  // נכה
  "נכים": "נכה", "לנכים": "נכה",
  // עיוור
  "עיוורים": "עיוור", "לעיוורים": "עיוור",
  // מקום
  "מקומות": "מקום",
  // דרך
  "דרכי": "דרך", "דרכים": "דרך",
  // פס / אריח
  "פסי": "פס", "אריחי": "אריח",
  // שמיעה
  "שמיעתי": "שמיעה",
  // הכוונה
  "להכוונה": "הכוונה",
  // חצן / לחצן
  "לחצן": "לחצן",
  // מקלט
  "מקלטים": "מקלט",
  // מרחב
  "מרחבים": "מרחב",
  // ישיבה
  "מקומות": "מקום",
  // גובה
  "בגובה": "גובה",
  // רוחב
  "ברוחב": "רוחב",
};

function normalize(word: string): string {
  return ROOT_MAP[word] ?? word;
}

function tokenize(text: string): string[] {
  return text
    .replace(/[()\/\-.,;:"'״׳]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(normalize)
    .filter((w) => w.length > 1);
}

function scoreRequirement(req: AccessibilityRequirement, queryTokens: string[]): number {
  const titleTokens = tokenize(req.requirementTitle);
  const tagTokens = tokenize((req.tags ?? []).join(" "));
  const subCatTokens = tokenize(req.subCategory + " " + req.category);
  const bodyTokens = tokenize((req.defectText ?? "") + " " + (req.practicalRequirement ?? ""));

  let score = 0;

  for (const qt of queryTokens) {
    for (const rt of titleTokens) {
      if (rt === qt) score += 8;
      else if (rt.length > 2 && qt.length > 2 && (rt.includes(qt) || qt.includes(rt))) score += 3;
    }
    for (const rt of tagTokens) {
      if (rt === qt) score += 5;
      else if (rt.length > 2 && qt.length > 2 && (rt.includes(qt) || qt.includes(rt))) score += 2;
    }
    for (const rt of subCatTokens) {
      if (rt === qt) score += 3;
      else if (rt.length > 2 && qt.length > 2 && (rt.includes(qt) || qt.includes(rt))) score += 1;
    }
    for (const rt of bodyTokens) {
      if (rt === qt) score += 1;
    }
  }

  if (req.severity === "critical") score *= 1.15;
  return score;
}

export function findMatchingRequirement(
  itemTitle: string,
  source: AccessibilityRequirement[] = STANDARDS_DATA,
): AccessibilityRequirement | null {
  if (!itemTitle || itemTitle.trim().length < 3) return null;

  const queryTokens = tokenize(itemTitle);
  if (queryTokens.length === 0) return null;

  const scored = source
    .map((req) => ({ req, score: scoreRequirement(req, queryTokens) }))
    .filter(({ score }) => score >= 8)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const bestScore = scored[0].score;
  // Collect all requirements within 50% of the best score
  const relevant = scored.filter(({ score }) => score >= bestScore * 0.5);

  if (relevant.length === 1) return relevant[0].req;

  // Merge correctionTexts from all relevant requirements into a synthetic one
  const seen = new Set<string>();
  const merged = relevant
    .map(({ req }) => req.correctionText)
    .filter((t) => { if (seen.has(t)) return false; seen.add(t); return true; })
    .join("\n• ");

  return {
    ...relevant[0].req,
    correctionText: "• " + merged,
  };
}
