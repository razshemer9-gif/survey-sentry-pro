// Pure PDF-related helpers — NO heavy imports here.
// The actual generator (jsPDF + html2canvas) lives in ./pdf-generate and is
// loaded on demand via dynamic import, so it stays out of the initial bundle.
import { getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Reduce arbitrary user text to characters that survive a file name intact.
 *
 * The previous filter kept the whole Hebrew Unicode block (U+0590–U+05FF),
 * which is far more than Hebrew letters: it also passes niqqud and cantillation
 * marks (invisible combining characters), gershayim ״, geresh ׳ and the Hebrew
 * maqaf ־. Those reached the saved file name, and any system along the way that
 * mishandled them — mail clients especially — rendered each one as replacement
 * characters, so a report came out as "��סקר-בטיחות…" and could fail to save.
 *
 * So keep only what is unambiguous: Hebrew letters, Latin letters, digits,
 * space, hyphen and underscore. Hebrew punctuation that carries meaning is
 * transliterated rather than dropped, so "רמג״ה" stays readable as "רמגה"
 * instead of losing a character silently.
 */
export function sanitizeFileNamePart(input: string): string {
  return input
    // Decompose so any combining marks become separate code points…
    .normalize("NFD")
    // …then drop them. This also removes niqqud and cantillation.
    .replace(/[̀-֑ͯ-ׇֽֿׁׂׅׄ]/g, "")
    // Hebrew and typographic punctuation that reads as a separator or quote.
    .replace(/[־‐-―]/g, "-")   // maqaf ־ and en/em dashes
    // Geresh, gershayim, curly quotes and their ASCII equivalents. Removed
    // rather than replaced: in Hebrew they mark abbreviations, so בי"ס should
    // become ביס, not "בי ס".
    .replace(/[׳״‘-‟'"]/g, "")
    // Bidi and zero-width controls: invisible, and they corrupt file names.
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, "")
    // Whatever is left must be a Hebrew letter, Latin letter, digit or separator.
    .replace(/[^א-תa-zA-Z0-9 _-]/g, " ")
    // Tidy the separators the substitutions above may have doubled up.
    .replace(/\s+/g, " ")
    .replace(/-{2,}/g, "-")
    .replace(/^[\s-]+|[\s-]+$/g, "");
}

export function buildPdfFileName(report: SurveyReport): string {
  const safe = sanitizeFileNamePart(report.placeName || "") || "report";
  const date  = report.surveyDate || new Date().toISOString().slice(0, 10);
  const basePrefix = getSurveyType(report.surveyType).filePrefix;
  const prefix = report.reportMode === "approval" ? basePrefix.replace(/^(סקר|דוח)/, "אישור") : basePrefix;
  // The prefix is ours, but sanitize it too so a future label cannot
  // reintroduce the problem.
  return `${sanitizeFileNamePart(prefix)}-${safe}-${date}.pdf`;
}

export function statusLabel(s: string): string {
  switch (s) {
    case "compliant":      return "תקין";
    case "non_compliant":  return "לא תקין";
    case "not_applicable": return "לא רלוונטי";
    default:               return "ממתין לבדיקה";
  }
}

export { formatCurrency, formatHebrewDate };
