// Pure PDF-related helpers — NO heavy imports here.
// The actual generator (jsPDF + html2canvas) lives in ./pdf-generate and is
// loaded on demand via dynamic import, so it stays out of the initial bundle.
import { ConsultantSettings, getSurveyType, SurveyReport } from "./types";
import { formatCurrency, formatHebrewDate } from "./image";

/**
 * Phone/tablet detection, used both for the canvas limits in ./pdf-generate
 * and for choosing the share sheet over a download.
 *
 * iPadOS 13+ reports itself as "Macintosh", so the user-agent test alone
 * misses every iPad — the touch-point check is what catches them.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return true;
  return /Mac/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

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


/**
 * Hebrew letters written in Latin ones, for the file names of consultants who
 * save a report to iOS Files before sending it: iOS wraps a right-to-left file
 * name in invisible direction marks on that path, and WhatsApp draws those as
 * "�" — a name in Latin letters alone never gets wrapped.
 *
 * A straight letter-for-letter mapping, not a pronunciation guide: "רננים"
 * comes out "rnnym". The point is that the client can tell two reports apart
 * and trace one back, not that the name reads well aloud.
 */
const HEBREW_TO_LATIN: Record<string, string> = {
  "א": "a", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z",
  "ח": "ch", "ט": "t", "י": "y", "כ": "k", "ך": "k", "ל": "l", "מ": "m",
  "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "a", "פ": "p", "ף": "p",
  "צ": "tz", "ץ": "tz", "ק": "k", "ר": "r", "ש": "sh", "ת": "t",
};

export function transliterateHebrew(input: string): string {
  // Sanitize first, so gershayim and the rest are handled exactly as they are
  // in the Hebrew name — בי״ס becomes ביס, not בי ס — and only then map.
  return Array.from(sanitizeFileNamePart(input))
    .map((ch) => HEBREW_TO_LATIN[ch] ?? ch)
    .join("")
    .replace(/[^a-zA-Z0-9 _-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/-{2,}/g, "-")
    .replace(/^[\s-]+|[\s-]+$/g, "");
}

export function buildPdfFileName(report: SurveyReport, settings?: ConsultantSettings): string {
  // Form 8 keeps the business name in its own field, so reading placeName
  // alone left that name out of the file name entirely.
  const nameSource = report.surveyType === "accessibility_form_8"
    ? report.form8BusinessName || report.placeName
    : report.placeName;
  // A missing name used to fall back to the Latin word "report", which put a
  // left-to-right run in the middle of an otherwise Hebrew name. WhatsApp then
  // wrapped the name in bidi control characters it draws as "�". Leave the
  // segment out instead — the prefix and date already identify the file.
  const date = report.surveyDate || new Date().toISOString().slice(0, 10);
  const config = getSurveyType(report.surveyType);
  const isApproval = report.reportMode === "approval";

  if (settings?.latinFileNames) {
    const prefix = isApproval
      ? config.filePrefixLatin.replace(/-(survey|report)$/, "") + "-approval"
      : config.filePrefixLatin;
    const name = transliterateHebrew(nameSource || "");
    return `${[prefix, name, date].filter(Boolean).join("-").replace(/ /g, "-")}.pdf`;
  }

  const safe = sanitizeFileNamePart(nameSource || "");
  const prefix = isApproval ? config.filePrefix.replace(/^(סקר|דוח)/, "אישור") : config.filePrefix;
  // The prefix is ours, but sanitize it too so a future label cannot
  // reintroduce the problem.
  return `${[sanitizeFileNamePart(prefix), safe, date].filter(Boolean).join("-")}.pdf`;
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
