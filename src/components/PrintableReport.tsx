import { ConsultantSettings, getSurveyType, SurveyReport, SurveyReportFormat } from "@/lib/types";
import { formatCurrency, formatHebrewDate } from "@/lib/pdf";
import { EDU_INSPECTION_TABLE } from "@/lib/edu-inspection-table";
import { ISRAEL_STATE_EMBLEM, MOLSA_HEADER_LOGO } from "@/lib/welfare-logos";
import {
  ELEMENT_STABILITY_FOOTER,
  ELEMENT_STABILITY_RESULT_STABLE,
  ELEMENT_STABILITY_RESULT_UNSTABLE,
  ELEMENT_STABILITY_STABLE_ONLY_INDICES,
  resolveStabilityTerms,
} from "@/lib/element-stability";
import { ELEMENT_STABILITY_HEADER_BANNER } from "@/lib/element-stability-banner";
import { ACCESSIBILITY_HEADER_BANNER_APPROVAL, ACCESSIBILITY_HEADER_BANNER_SURVEY } from "@/lib/accessibility-header-banner";
import { RISK_SURVEY_DEFAULT_FENCING_NOTE, RISK_SURVEY_SUBTITLE } from "@/lib/risk-survey";
import React, { forwardRef } from "react";

interface Props {
  report: SurveyReport;
  settings: ConsultantSettings;
}

function getFormat(settings: ConsultantSettings, report: SurveyReport): SurveyReportFormat {
  return settings.reportFormats?.[report.surveyType ?? "accessibility"] ?? { surveyType: report.surveyType ?? "accessibility" };
}

/**
 * Printable A4 (210mm) layout — RTL Hebrew, blue/white themed.
 * Width is fixed in px to give html2canvas a stable canvas to rasterize.
 */
export const PrintableReport = forwardRef<HTMLDivElement, Props>(({ report, settings }, ref) => {
  const surveyConfig = getSurveyType(report.surveyType);
  const fmt = getFormat(settings, report);

  const SAFETY_CLAUSES_FIXED = [
    "המקום נבדק באזורים המיועדים להימצאות קהל בלבד.",
    "מובהר בזאת כי האישור שנמסר הינו עבור השירות שהתקבל ונכון לרגע הבדיקה בלבד.",
    "במידה ובוצע כל שינוי במקום לאחר הבדיקה, יש לעצור את הפעילות ולזמן בדיקה מחודשת.",
    "במידה וקיימות מערכות חשמל ו/או גז, מחובת המזמין לזמן בדיקה.",
    "אין לעשות כל שינוי במבנים אלא בידיעת הבודק ובאישורו. כל שינוי/שימוש שיעשה ללא אישור יהיה באחריות המזמין בלבד ותוקף האישור יבוטל.",
  ];
  const SAFETY_CLAUSE_6 = "אין האישור מתייחס לבטיחות המשתמשים אלא לבטיחות הסביבה.";

  const itemTotal = (i: typeof report.items[0]) => (Number(i.estimatedCost) || 0) * (i.quantity ?? 1);
  const totalCost = report.items
    .filter((i) => i.includeInCost)
    .reduce((sum, i) => sum + itemTotal(i), 0);

  const coverLogo = fmt.companyLogo || settings.logo;
  const licNum = fmt.licenseNumber || settings.license;
  const sigName = fmt.professionalName || report.signatureConsultantName || settings.consultantName;
  const isApproval = report.reportMode === "approval" ||
    (report.surveyType === "general_safety" && (report.accessibilityComplianceStatus === "yes" || report.accessibilityComplianceStatus === "safe"));
  // Accessibility ("נגישות מתו"ס ושירות") uses a fixed brand banner instead of
  // the generic per-account logo + title — the banner already has the title
  // text baked in, so it swaps entirely between the survey/approval variants.
  const isAccessibilityType = !report.surveyType || report.surveyType === "accessibility";

  const hasPriorities = report.items.some(i => i.priority !== undefined);
  const PRIORITY_GROUPS: { priority: 0 | 1 | 2 | undefined; label: string; color: string; bg: string; border: string }[] = [
    { priority: 0, label: "קדימות 0 — דחוף",  color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    { priority: 1, label: "קדימות 1 — גבוה",  color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
    { priority: 2, label: "קדימות 2 — רגיל",  color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    { priority: undefined, label: "ממצאים נוספים", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
  ];
  const PRIORITY_BADGE_LABEL = ["דחוף", "גבוה", "רגיל"] as const;

  const renderItem = (item: typeof report.items[0], globalIdx: number) => {
    const refPhotos = item.referencePhotos && item.referencePhotos.length > 0
      ? item.referencePhotos
      : (item.referencePhoto ? [item.referencePhoto] : []);
    const priorityMeta = item.priority !== undefined ? PRIORITY_GROUPS.find(g => g.priority === item.priority) : undefined;
    return (
      <div
        key={item.id}
        data-pdf-no-break=""
        style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#fff", pageBreakInside: "avoid" }}
      >
        {/* ── Section 1: Template / professional data ── */}
        <div data-pdf-no-break="" style={{ padding: "16px 20px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
            <span>ממצא {globalIdx + 1}</span>
            {priorityMeta && item.priority !== undefined && (
              <span style={{ background: priorityMeta.bg, color: priorityMeta.color, border: `1px solid ${priorityMeta.border}`, borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                {PRIORITY_BADGE_LABEL[item.priority]}
              </span>
            )}
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#0f172a" }}>{item.title}</div>
          {item.notes && item.notes.split("\n").map((line, li) => (
            <div key={`n${li}`} data-pdf-no-break="" style={{ marginTop: li === 0 ? 10 : 0, fontSize: 15, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {li === 0 ? <><span style={{ fontWeight: 700 }}>ממצא: </span>{line}</> : line}
            </div>
          ))}
          {item.suggestedCorrection && item.suggestedCorrection.split("\n").map((line, li) => (
            <div key={`c${li}`} data-pdf-no-break="" style={{ marginTop: li === 0 ? 8 : 0, fontSize: 15, color: "#1e40af", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {li === 0 ? <><span style={{ fontWeight: 700 }}>פתרון: </span>{line}</> : line}
            </div>
          ))}
          {refPhotos.length > 0 && (
            <div data-pdf-no-break="" style={{ marginTop: 12, display: "grid", gridTemplateColumns: refPhotos.length > 1 ? "1fr 1fr" : "260px", gap: 10 }}>
              {refPhotos.map((p, i) => (
                <div key={i} data-pdf-no-break="">
                  <img
                    src={p}
                    alt={item.referenceLabel || `פרט ${i + 1}`}
                    style={{ maxWidth: "100%", height: "auto", display: "block", background: "#fff", borderRadius: 8, border: "1px solid #bfdbfe" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 2: Client / field data ── */}
        {(item.photo || item.fieldNotes || (item.estimatedCost || 0) > 0) && (
          <div data-pdf-no-break="" style={{ padding: "14px 20px" }}>
            {(item.photo || item.fieldNotes) && (
              <div style={{ display: "grid", gridTemplateColumns: item.photo && item.fieldNotes ? "1fr 1fr" : "1fr", gap: 14, alignItems: "start" }}>
                {item.photo && (
                  <div data-pdf-no-break="">
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>מצב קיים</div>
                    <img
                      src={item.photo}
                      alt="מצב קיים"
                      style={{ maxWidth: "100%", height: "auto", display: "block", borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                  </div>
                )}
                {item.fieldNotes && (
                  <div data-pdf-no-break="">
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>פירוט מצב קיים</div>
                    <div style={{ fontSize: 15, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#f8fafc", borderRadius: 8, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                      {item.fieldNotes}
                    </div>
                  </div>
                )}
              </div>
            )}
            {(item.estimatedCost || 0) > 0 && (
              <div style={{ marginTop: 12, display: "inline-block", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 15, padding: "6px 14px", borderRadius: 999, fontWeight: 600 }}>
                אומדן עלות תיקון: {(item.quantity ?? 1) > 1 ? `${formatCurrency(item.estimatedCost)} × ${item.quantity} = ${formatCurrency(itemTotal(item))}` : formatCurrency(item.estimatedCost)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Element stability inspection: דוח בדיקת יציבות אלמנטים ─────────────────
  if (report.surveyType === "element_stability") {
    const accent = "#1e3a8a"; // blue accent (matches brand)
    const inspectorName = report.elementInspectorName || sigName;

    // Footer pulls from consultant settings when available, else reference defaults.
    const footer = {
      company: settings.companyName || ELEMENT_STABILITY_FOOTER.company,
      phone: settings.phone || ELEMENT_STABILITY_FOOTER.phone,
      email: settings.email || ELEMENT_STABILITY_FOOTER.email,
      website: ELEMENT_STABILITY_FOOTER.website,
    };
    // Marked with data-pdf-page-footer so pdf.ts stamps it on EVERY page.
    // A custom footer image (from settings) takes precedence when provided.
    const footerImg = fmt.footerImage;
    // Explicit top/bottom padding (not margin) so the captured box fully
    // contains the text with breathing room and can never clip the last line.
    const ElementFooter = () => (
      <div data-pdf-page-footer="" style={{ direction: "rtl", padding: "14px 0 12px", boxSizing: "border-box" }}>
        {footerImg ? (
          <img src={footerImg} alt="footer" crossOrigin="anonymous" style={{ width: "100%", height: "auto", display: "block" }} />
        ) : (
          <>
            <div style={{ height: 3, background: "#2f5eb3", borderRadius: 2, marginBottom: 8 }} />
            <div style={{ textAlign: "center", fontSize: 12, color: "#0f172a", lineHeight: 1.9 }}>
              <div style={{ fontWeight: 700 }}>{footer.company}{footer.phone ? `, נייד : ${footer.phone}` : ""}</div>
              <div>
                <span style={{ fontWeight: 700 }}>דוא"ל: </span>
                <span style={{ color: "#1d4ed8", textDecoration: "underline" }}>{footer.email}</span>
                {footer.website ? (
                  <>
                    {"   אתר : "}
                    <span style={{ color: "#1d4ed8", textDecoration: "underline" }}>{footer.website}</span>
                  </>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    );

    // Valid-until may carry a time part (datetime-local: "YYYY-MM-DDTHH:mm").
    const formatValidUntil = (v?: string) => {
      if (!v) return undefined;
      const datePart = formatHebrewDate(v);
      const timeMatch = v.match(/T(\d{2}:\d{2})/);
      return timeMatch ? `${datePart} בשעה ${timeMatch[1]}` : datePart;
    };
    const validUntilText = formatValidUntil(report.elementValidUntil);
    const terms = resolveStabilityTerms(
      report.stabilityTerms ?? fmt.stabilityTermsDefault,
      validUntilText,
    );
    const resultText = report.elementStabilityStatus === "unstable"
      ? (fmt.resultUnstableText || ELEMENT_STABILITY_RESULT_UNSTABLE)
      : (fmt.resultStableText || ELEMENT_STABILITY_RESULT_STABLE);
    const isElementApproval = report.reportMode === "approval";
    const showStamp = fmt.showStamp !== false;
    const showSig = fmt.showSignature !== false;
    const showFooter = fmt.showFooter !== false;
    const stampImg = showStamp ? fmt.stampImage : undefined;
    const sigImg = showSig ? (report.signatureDataUrl || fmt.signatureImage) : undefined;

    const CoverLine = ({ label, value }: { label: string; value?: string }) => (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 10, fontSize: 14, direction: "rtl" }}>
        <span style={{ fontWeight: 700, flexShrink: 0 }}>{label}:</span>
        <span style={{ flex: 1, borderBottom: "1px solid #cbd5e1", paddingBottom: 2, minHeight: 18 }}>{value || ""}</span>
      </div>
    );

    return (
      <div ref={ref} dir="rtl" lang="he"
        style={{ width: "794px", background: "#ffffff", color: "#0f172a", fontFamily: "Heebo, Assistant, sans-serif" }}>
        <section style={{ padding: "32px 56px 28px", background: "#fff" }}>
          {/* 1. Header banner — dedicated to this report type only */}
          <div style={{ marginBottom: 12 }}>
            <img src={ELEMENT_STABILITY_HEADER_BANNER} alt="דו״ח יציבות קונסטרוקציה" crossOrigin="anonymous"
              style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: accent, textAlign: "center", margin: "0 0 20px" }}>
            {isElementApproval ? "אישור יציבות קונסטרוקציה" : 'דו״ח יציבות קונסטרוקציה'}
          </h1>

          {/* 2. Report details */}
          <CoverLine label="שם המזמין" value={report.clientName} />
          <CoverLine label="שם הבודק" value={inspectorName} />
          <CoverLine label="מיקום" value={report.address} />
          <CoverLine label="תאריך הבדיקה" value={report.surveyDate ? formatHebrewDate(report.surveyDate) : ""} />
          <CoverLine label={isElementApproval ? "תוקף האישור" : "תוקף הבדיקה"} value={validUntilText} />

          {report.elementIntroText && (
            <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", direction: "rtl" }}>
              <span style={{ fontWeight: 700 }}>בתאריך: </span>{report.elementIntroText}
            </div>
          )}

          {/* 3. Elements table — container may span pages; individual rows never split */}
          <div style={{ marginTop: 22, border: "1px solid #0f172a", direction: "rtl", fontSize: 13 }}>
            <div data-pdf-no-break="" style={{ display: "grid", gridTemplateColumns: "60px 1.6fr 1fr", background: "#eff6ff", fontWeight: 800 }}>
              <div style={{ padding: "8px 6px", borderLeft: "1px solid #0f172a", textAlign: "center" }}>מס׳ סד׳</div>
              <div style={{ padding: "8px 6px", borderLeft: "1px solid #0f172a", textAlign: "center" }}>תיאור האלמנט / תמונה</div>
              <div style={{ padding: "8px 6px", textAlign: "center" }}>תקין / לא תקין</div>
            </div>
            {report.items.map((item, i) => {
              const ok = item.status === "compliant";
              return (
                <div key={item.id} data-pdf-no-break="" style={{ display: "grid", gridTemplateColumns: "60px 1.6fr 1fr", borderTop: "1px solid #0f172a" }}>
                  <div style={{ padding: "10px 6px", borderLeft: "1px solid #0f172a", textAlign: "center", fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ padding: "10px 10px", borderLeft: "1px solid #0f172a" }}>
                    {item.title && (
                      <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: item.photo ? 8 : 0 }}>{item.title}</div>
                    )}
                    {item.photo && (
                      <img src={item.photo} alt={item.title || `אלמנט ${i + 1}`} crossOrigin="anonymous"
                        style={{ maxWidth: "100%", height: "auto", display: "block", borderRadius: 6, border: "1px solid #e2e8f0" }} />
                    )}
                  </div>
                  <div style={{ padding: "10px 10px" }}>
                    <div style={{ textAlign: "center", fontWeight: 800, fontSize: 15, color: ok ? "#15803d" : "#b91c1c" }}>
                      {ok ? "תקין" : "לא תקין"}
                    </div>
                    {item.fieldNotes && (
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: "#0f172a", whiteSpace: "pre-wrap", textAlign: "right", unicodeBidi: "plaintext" }}>
                        {item.fieldNotes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5. Notes */}
          {report.elementNotes && (
            <div data-pdf-no-break="" style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: accent, margin: "0 0 6px" }}>הערות:</h3>
              <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", direction: "rtl", unicodeBidi: "plaintext" }}>{report.elementNotes}</div>
            </div>
          )}

          {/* 6+7. Result + fixed terms — kept together on one page */}
          <div data-pdf-no-break="" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: accent, margin: "0 0 10px" }}>
              {resultText}
            </h3>
            {/* When 'unstable', omit the stable-only clauses (1,3,4,8); keep the rest. */}
            <div style={{ direction: "rtl" }}>
              {terms
                .filter((_, i) => report.elementStabilityStatus !== "unstable" || !ELEMENT_STABILITY_STABLE_ONLY_INDICES.includes(i))
                .map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, fontSize: 13, lineHeight: 1.7 }}>
                    <span style={{ flexShrink: 0, fontWeight: 700, minWidth: 20, textAlign: "right" }}>{i + 1}.</span>
                    <span style={{ flex: 1, whiteSpace: "pre-wrap", unicodeBidi: "plaintext" }}>{t}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* 9. Signature + stamp — left side of the page, last page only, when present */}
          {(sigImg || stampImg) && (
            <div data-pdf-no-break="" style={{ marginTop: 48, display: "flex", justifyContent: "flex-end", gap: 48, direction: "rtl" }}>
              {sigImg && (
                <div style={{ textAlign: "center" }}>
                  <img src={sigImg} alt="חתימה" crossOrigin="anonymous" style={{ maxHeight: 70, maxWidth: 200, height: "auto", display: "block", margin: "0 auto" }} />
                  <div style={{ borderTop: "1px solid #0f172a", marginTop: 4, paddingTop: 4, fontSize: 12, color: "#64748b" }}>
                    חתימת הבודק{inspectorName ? ` — ${inspectorName}` : ""}
                  </div>
                </div>
              )}
              {stampImg && (
                <div style={{ textAlign: "center" }}>
                  <img src={stampImg} alt="חותמת" crossOrigin="anonymous" style={{ maxHeight: 90, maxWidth: 130, height: "auto", display: "block", margin: "0 auto" }} />
                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>חותמת</div>
                </div>
              )}
            </div>
          )}

          {showFooter && <ElementFooter />}
        </section>
      </div>
    );
  }

  // ── Risk survey: תיעוד תמונות מפגעים לפני אירוע ─────────────────────────────
  if (report.surveyType === "risk_survey") {
    const accent = "#c2410c";
    const fencingNote = report.riskFencingNote ?? RISK_SURVEY_DEFAULT_FENCING_NOTE;
    const showFencingNote = report.riskFencingNoteEnabled !== false && fencingNote.trim().length > 0;

    return (
      // data-pdf-page-numbers: opt-in digits-only "1 / N" page indicator
      // (see pdf-generate.ts) — this report type is the only one using it.
      <div ref={ref} dir="rtl" lang="he" data-pdf-page-numbers=""
        style={{ width: "794px", background: "#ffffff", color: "#0f172a", fontFamily: "Heebo, Assistant, sans-serif" }}>
        <section style={{ padding: "40px 48px 44px" }}>

          {/* Header: title (+ event name) on the right, logo on the left */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${accent}`, paddingBottom: 16, marginBottom: 8 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, color: accent }}>
                {surveyConfig.pdfTitle}{report.placeName ? ` - ${report.placeName}` : ""}
              </h1>
              <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>{RISK_SURVEY_SUBTITLE}</div>
            </div>
            {coverLogo && (
              <img src={coverLogo} alt="לוגו" crossOrigin="anonymous" style={{ maxHeight: 60, maxWidth: 150, height: "auto", width: "auto", display: "block", objectFit: "contain" }} />
            )}
          </div>

          {/* Compact event details — one slim line, not a form */}
          {(report.clientName || report.address || report.surveyDate || report.riskInspectorName) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", fontSize: 12.5, color: "#334155", marginBottom: 22 }}>
              {report.clientName && <span><span style={{ fontWeight: 700 }}>לקוח/רשות: </span>{report.clientName}</span>}
              {report.address && <span><span style={{ fontWeight: 700 }}>מיקום: </span>{report.address}</span>}
              {report.surveyDate && <span><span style={{ fontWeight: 700 }}>תאריך סיור: </span>{formatHebrewDate(report.surveyDate)}</span>}
              {report.riskInspectorName && <span><span style={{ fontWeight: 700 }}>עורך הדו״ח: </span>{report.riskInspectorName}</span>}
            </div>
          )}

          {/* Photo cards — 2 per row; image + caption never split across pages */}
          {report.items.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {report.items.map((item) => (
                <div key={item.id} data-pdf-no-break="" style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                  {item.photo && (
                    <div style={{ width: "100%", height: 210, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src={item.photo} alt="" crossOrigin="anonymous" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
                    </div>
                  )}
                  {item.fieldNotes && (
                    <div style={{ padding: "10px 14px", fontSize: 13, lineHeight: 1.65, color: "#1e293b", textAlign: "center" }}>
                      {item.fieldNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>לא נוספו תמונות</div>
          )}

          {/* Fencing note — appears once, at the very end, framed across the page width */}
          {showFencingNote && (
            <div data-pdf-no-break="" style={{ marginTop: 28, border: `2px solid ${accent}`, borderRadius: 12, padding: "16px 20px", background: "#fdf4ee" }}>
              <div style={{ fontWeight: 800, color: accent, fontSize: 14, marginBottom: 6 }}>הנחיה לעניין הגדרות</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "#1e293b", whiteSpace: "pre-wrap" }}>{fencingNote}</div>
            </div>
          )}
        </section>
      </div>
    );
  }

  // ── Welfare inspection: government form layout ────────────────────────────
  if (report.surveyType === "welfare_inspection") {
    const headerColor = "#1b75bc"; // Ministry blue, matches the original form
    const inspectorFull = `${report.welfareInspectorFirstName ?? ""} ${report.welfareInspectorLastName ?? ""}`.trim();

    const APPROVAL_ROWS = [
      { title: "מוכנות אמצעי כיבוי למניעת דליקות, ואמצעי מילוט", authority: "הרשות לכיבוי אש", refresh: 'ע"פ דרישת רשות כבאות והצלה' },
      { title: "תעודת גמר (טופס 4) של כל המבנים באתר או אישור של הרשות המקומית, בשטחה ממוקמת המסגרת, בדבר התאמת המבנה לייעודה של המסגרת המופעלת בו.", authority: "רשות מקומית", refresh: "חד פעמי" },
      { title: "מתקני משחקים, ספורט וכו' * (במידה וקיימים)", authority: "מעבדה מוסמכת להתקנה ותחזוקת המתקנים או בודק שנתי למתקני משחקים בעל רישיון בהתאם לתקן הישראלי 1498", refresh: "12 חודשים" },
      { title: "**בדיקת יציבות מבנים", authority: "מהנדס מבנים (קונסטרוקטור) עם רישיון בתוקף", refresh: "60 חודשים" },
    ];

    const purposeLabel = (() => {
      if (report.welfarePurposeType === "outside_home") return "מסגרת חוץ ביתית";
      if (report.welfarePurposeType === "daily") return "מסגרת יומית";
      if (report.welfarePurposeType === "other") return report.welfarePurposeOther || "אחר";
      return "";
    })();

    const qualLabel = (() => {
      if (report.welfareQualification === "safety_engineer") return "מהנדס בטיחות רשום";
      if (report.welfareQualification === "safety_officer") return "ממונה על הבטיחות";
      if (report.welfareQualification === "school_safety_inspector") return "עורך מבדקי בטיחות של מוסדות חינוך";
      return "";
    })();

    // Renders label exactly as given (colon included only where the original form has one)
    const Line = ({ label, value }: { label: string; value?: string }) => (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 16, fontSize: 13, direction: "rtl" }}>
        <span style={{ fontWeight: 700, flexShrink: 0 }}>{label}</span>
        <span style={{ flex: 1, borderBottom: "1px solid #000000", paddingBottom: 2, minHeight: 18 }}>{value || ""}</span>
      </div>
    );
    const CheckBox = ({ checked }: { checked: boolean }) => (
      <span style={{ display: "inline-block", width: 14, height: 14, border: "1px solid #0f172a", textAlign: "center", lineHeight: "12px", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
        {checked ? "✓" : ""}
      </span>
    );

    // Original state emblem image from the official form footer
    const GovEmblem = () => (
      <img src={ISRAEL_STATE_EMBLEM} alt="סמל המדינה" style={{ width: 41, height: 50, flexShrink: 0, display: "block" }} />
    );

    // Original ministry header block (logo + name), centered as in the form
    const MinistryHeader = () => (
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
        <img src={MOLSA_HEADER_LOGO} alt="משרד העבודה הרווחה והשירותים החברתיים" style={{ width: 320, height: "auto", display: "block" }} />
      </div>
    );

    const MinistryFooter = ({ marginTop = 24 }: { marginTop?: number }) => (
      <div data-pdf-no-break="" style={{ marginTop, display: "flex", justifyContent: "center", alignItems: "center", gap: 14, direction: "rtl" }}>
        <div style={{ fontSize: 11, color: "#000000", textAlign: "right" }}>
          <div style={{ fontWeight: 800, fontSize: 12 }}>האגף לשירותים חברתיים ואישיים | שירות ילד ונוער</div>
          <div>
            <span style={{ color: "#1b75bc", textDecoration: "underline" }}>www.molsa.gov.il</span>
            {" | "}אתר ממשל זמין - <span style={{ color: "#1b75bc", textDecoration: "underline" }}>www.gov.il</span>
          </div>
          <div>רחוב ירמיהו 39, מגדלי הבירה, ירושלים | טלפון: 02-5085601, פקס: 02-5085947</div>
        </div>
        <GovEmblem />
      </div>
    );

    return (
      <div ref={ref} dir="rtl" lang="he"
        style={{ width: "794px", background: "#ffffff", color: "#0f172a", fontFamily: "Heebo, Assistant, sans-serif" }}>

        {/* Page 1: Header + כללי */}
        <section style={{ padding: "40px 56px", background: "#fff" }}>
          <MinistryHeader />

          <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, margin: "16px 0 26px", color: "#000000" }}>
            נספח בדיקת עמידה בדרישות בטיחות
          </h1>

          <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: "underline", marginBottom: 12, textAlign: "right" }}>כללי</h2>
          <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>קריטריונים בעלי סמכות לביצוע המבדק</div>
            <div>1. המסמך ימולא ויאושר על-ידי בודק שהוא אחד מאלה:</div>
            <div style={{ paddingRight: 24, margin: "6px 0" }}>
              {[
                'מהנדס בטיחות רשום בפנקס המהנדסים והאדריכלים במדור בטיחות אש ומניעתה או במדור בטיחות כללית.',
                'ממונה על בטיחות המוסמך ע"י משרד הכלכלה עם ותק של 5 שנים לפחות מיום קבלת ההסמכה וביצע לפחות 50 מבדקי בטיחות במסגרות ציבוריות.',
                'עורך מבדקי בטיחות של מוסדות חינוך עם ותק של 5 שנים לפחות מיום קבלת ההסמכה וביצע לפחות 50 מבדקי בטיחות במסגרות ציבוריות.',
              ].map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <span style={{ flexShrink: 0, fontSize: 14, lineHeight: "18px", fontWeight: 700 }}>•</span>
                  <span style={{ flex: 1 }}>{item}</span>
                </div>
              ))}
            </div>
            <div>2. הנספח ייחתם הן על ידי הבודק עצמו והן על ידי מורשה חתימה מטעם מפעיל המסגרת.</div>
          </div>

          <Line label="בתאריך" value={formatHebrewDate(report.surveyDate)} />
          <Line label="קיימתי מבדק בטיחות במסגרת המיועדת לשמש כ (לפרט את סוג המסגרת)" value={report.welfareFrameworkPurpose} />
          <Line label="סמל מסגרת:" value={report.welfareFrameworkSymbol} />
          <Line label="שאלה פרטיה:" value={report.welfareInquiry} />
          <Line label="כתובת: (עיר, רחוב, מספר)" value={report.address} />
          <Line label="בעלות הנכס:" value={report.welfarePropertyOwner} />
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><Line label="פרטי המנהל:" value={report.welfareManagerName} /></div>
            <div style={{ width: 200 }}><Line label="נייד:" value={report.welfareManagerPhone} /></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, fontSize: 13, direction: "rtl" }}>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>ייעוד המסגרת:</span>
              <span style={{ flex: 1, borderBottom: "1px solid #000000", paddingBottom: 2, minHeight: 18 }}>{purposeLabel}</span>
            </div>
            <div style={{ fontSize: 12, marginTop: 2 }}>(מסגרת חוץ ביתית/מסגרת יומית/אחר)</div>
          </div>
        </section>

        {/* Page 2: ממצאים / א. אישורים */}
        <section data-pdf-page-break="" style={{ padding: "24px 56px", background: "#fff" }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: "underline", marginBottom: 8 }}>ממצאים</h2>
          <div style={{ fontSize: 13, marginBottom: 12 }}>במבדק עלו הממצאים הבאים:</div>

          <h3 style={{ fontSize: 15, fontWeight: 800, textDecoration: "underline", marginTop: 12, marginBottom: 8 }}>א. אישורים</h3>
          <div style={{ fontSize: 12, marginBottom: 10 }}>על הבודק למלא את הטבלה בהתאם לאישורים שהוצגו בפניו:</div>

          <div data-pdf-no-break="" style={{ direction: "rtl", border: "1px solid #000000", fontSize: 11 }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px 1.3fr 1.3fr 1fr 80px 95px 115px", background: "#ffffff", fontWeight: 700 }}>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>מספר</div>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>נושא האישור</div>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>הגורם המאשר</div>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>יש לחדש כל -</div>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>הוצג אישור /לא הוצג אישור/לא רלוונטי</div>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>תאריך מתן האישור</div>
              <div style={{ padding: "6px 4px", textAlign: "center" }}>בתוקף עד</div>
            </div>
            {APPROVAL_ROWS.map((row, i) => {
              const a = report.welfareApprovals?.[i] ?? {};
              const presentedLabel = a.presented === "yes" ? "הוצג אישור" : a.presented === "no" ? "לא הוצג אישור" : a.presented === "na" ? "לא רלוונטי" : "";
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1.3fr 1.3fr 1fr 80px 95px 115px", borderTop: "1px solid #000000" }}>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000", textAlign: "center", fontWeight: 700 }}>{i + 1}.</div>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000", fontWeight: 700 }}>{row.title}</div>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>{row.authority}</div>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>{row.refresh}</div>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>{presentedLabel}</div>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>{a.dateGiven ? formatHebrewDate(a.dateGiven) : "___/___/___"}</div>
                  <div style={{ padding: "8px 4px", textAlign: "center" }}>
                    {/* Row 2 (טופס 4, חד פעמי) has no expiry in the original form */}
                    {i === 1 ? (a.validUntil ? formatHebrewDate(a.validUntil) : "") : (
                      <>
                        {a.validUntil ? formatHebrewDate(a.validUntil) : "___/___/___"}
                        {i === 0 && <div style={{ marginTop: 6 }}>אם הוגבל בתוקף</div>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footnotes referencing rows 3 and 4 */}
          <div style={{ marginTop: 14, fontSize: 11, lineHeight: 1.7, direction: "rtl" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>*</span>
              <span>לרבות מתקני משחקים, מתקני ספורט, וילונות חלוקה באולמות, מתקני כושר בחצר, מגרשים, חדרים ואולמות.</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <span style={{ fontWeight: 700 }}>**</span>
              <span>כל סוגי המבנים לרבות מבנים יבילים, תקרות תלויות, עמודי תאורה, יחידות מיזוג תלויות, מערכות סולאריות 'סככות הצללה.</span>
            </div>
          </div>

          <MinistryFooter />
        </section>

        {/* Page 3: ב. פערים + ג. דרישות */}
        <section data-pdf-page-break="" style={{ padding: "24px 56px", background: "#fff" }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, textDecoration: "underline", marginBottom: 8 }}>ב. פערים:</h3>
          <div style={{ fontSize: 12, marginBottom: 8 }}>(סמן ב- ✓ את המשבצת המתאימה)</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, fontSize: 13 }}>
            <CheckBox checked={report.welfareDefectsStatus === "none"} />
            <span>לא התגלו פערים ביחס לדרישות הבטיחות.</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 16, fontSize: 13 }}>
            <CheckBox checked={report.welfareDefectsStatus === "found"} />
            <span>התגלו פערים (ראה בטבלה להלן) ביחס לדרישות הבטיחות.</span>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 800, textDecoration: "underline", marginTop: 20, marginBottom: 8 }}>ג. דרישות לביצוע ביחס לפערים שהתגלו</h3>
          <div style={{ fontSize: 12, marginBottom: 10 }}>פירוט הפעולות שיינקטו (להלן-פעולות מתקנות) לתיקון הפערים ביחס לדרישות הבטיחות, שמפעיל המסגרת התחייב ליישמן בלוחות הזמנים המפורטים בטבלה הבאה:</div>

          <div style={{ direction: "rtl", border: "1px solid #000000", fontSize: 11 }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1.1fr 1.1fr 150px", background: "#ffffff", fontWeight: 700 }}>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>מספר</div>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>הדרישה</div>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>מהות הפער</div>
              <div style={{ padding: "6px 4px", borderLeft: "1px solid #000000", textAlign: "center" }}>הפעולה המתקנת</div>
              <div style={{ padding: "6px 4px", textAlign: "center" }}>מועדי סיום ליישום פעולות מתקנות על פי התחייבות מפעיל המסגרת</div>
            </div>
            {/* Always render at least 5 rows like the original form */}
            {Array.from({ length: Math.max(report.items.length, 5) }, (_, i) => {
              const item = report.items[i];
              return (
                <div key={item?.id ?? `empty-${i}`} data-pdf-no-break="" style={{ display: "grid", gridTemplateColumns: "40px 1fr 1.1fr 1.1fr 150px", borderTop: "1px solid #000000" }}>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000", textAlign: "center", fontWeight: 700 }}>{i + 1}.</div>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000", minHeight: 46 }}>{item?.title || ""}</div>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000" }}>{item ? (item.notes || item.fieldNotes || "") : ""}</div>
                  <div style={{ padding: "8px 4px", borderLeft: "1px solid #000000" }}>{item?.suggestedCorrection || ""}</div>
                  <div style={{ padding: "8px 4px", textAlign: "center" }}>
                    <div>לא יאוחר מ</div>
                    <div>{item?.clause || "___/___/___"}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <MinistryFooter />
        </section>

        {/* Page 4: הצהרת מורשה חתימה + סיכום + פרטי מבדק */}
        <section data-pdf-page-break="" style={{ padding: "24px 56px", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>אני</span>
            <span style={{ flex: 1, borderBottom: "1px solid #0f172a", paddingBottom: 2, minHeight: 20, fontSize: 14 }}>{report.welfareSignatoryName || ""}</span>
          </div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>(מורשה חתימה מטעם מפעיל המסגרת), מצהיר ומתחייב בזאת כי:</div>
          <div style={{ paddingRight: 12, fontSize: 12, lineHeight: 1.75, margin: "8px 0" }}>
            {[
              "לא התווספו מבנים או מתקנים מאז קבלת האישור ליציבות מבנים (שורה 4 בטבלת האישורים).",
              "כל האישורים שניתנו על-ידי הרשויות למיניהם (רשות כבאות, רשות מקומית, מעבדה מוסמכת וכו') הינם בתוקף ולא נשללו על-ידי גורם כלשהו.",
              "כל הליקויים שנמצאו במסגרת בדיקת בטיחות זו, יתוקנו במסגרת לוח הזמנים שנקבע דלעיל.",
              "באחריות הספק להזמין את הבודק שביצע את הבדיקה (ככל שניתן) לבצע בדיקה חוזרת לאחר המועד האחרון להשלמת הפערים ולאשר את תיקון הפערים ותקינות / אי תקינות המסגרת.",
              "באחריות הספק להמציא אישור בודק בטיחות לאחר תיקון כל הליקויים שהתגלו במסמך זה.",
              "ידוע לי כי נספח חתום ותקין זה הינו תנאי לחידוש הסכם / חוזה – תנאי לאישור המסגרת על ידי משרד העבודה, הרווחה והשירותים החברתיים.",
            ].map((text, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <span style={{ flexShrink: 0, fontWeight: 700, minWidth: 20, textAlign: "right" }}>{idx + 1}.</span>
                <span style={{ flex: 1 }}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 30, textAlign: "center", fontSize: 12 }}>שם וחתימת מורשה החתימה מטעם המסגרת</div>
          <div style={{ margin: "6px auto 24px", width: 260, borderBottom: "1px solid #0f172a", height: 30, textAlign: "center", fontSize: 14, paddingTop: 4 }}>{report.welfareSignatoryName || ""}</div>

          <h3 style={{ fontSize: 15, fontWeight: 800, textDecoration: "underline", marginTop: 20, marginBottom: 10 }}>סיכום</h3>
          <div style={{ fontSize: 12, marginBottom: 10 }}>1. לאור ממצאי המבדק, הערכת הסיכונים והתכנית לשיפורי בטיחות, הנני קובע כי מהבחינה הבטיחותית (סמן ✓ במשבצת המתאימה):</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13 }}>
            <CheckBox checked={report.welfareSummaryStatus === "no_impediment"} />
            <span style={{ display: "flex", alignItems: "baseline", gap: 6, flex: 1 }}>
              <span>אין מניעה כי המתקן שנבדק ישמש כ</span>
              <span style={{ flex: 1, borderBottom: "1px solid #94a3b8", minHeight: 16, paddingBottom: 1 }}>{report.welfareSummaryUsage || ""}</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13 }}>
            <CheckBox checked={report.welfareSummaryStatus === "after_repair"} />
            <span>ניתן יהיה להמשיך לעשות שימוש במתקן לאחר תיקון הליקויים הבאים:</span>
          </div>
          {(["א", "ב", "ג"] as const).map((letter, idx) => (
            <div key={letter} style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6, marginRight: 22, fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{letter}.</span>
              <span style={{ flex: 1, borderBottom: "1px solid #94a3b8", minHeight: 16, paddingBottom: 1 }}>{report.welfareRepairList?.[idx] || ""}</span>
            </div>
          ))}

          <h3 style={{ fontSize: 15, fontWeight: 800, textDecoration: "underline", marginTop: 24, marginBottom: 10 }}>פרטי עורך המבדק וחתימתו</h3>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <div style={{ flex: 1 }}><Line label="שם משפחה:" value={report.welfareInspectorLastName} /></div>
            <div style={{ flex: 1 }}><Line label="שם פרטי:" value={report.welfareInspectorFirstName} /></div>
          </div>
          <Line label="מספר תעודת זהות:" value={report.welfareInspectorId} />

          {/* Ministry footer with government emblem — end of page 4 */}
          <MinistryFooter />
        </section>

        {/* Page 5: הגדרת הכשירות */}
        <section data-pdf-page-break="" style={{ padding: "40px 56px", background: "#fff" }}>
          <MinistryHeader />

          <h3 style={{ fontSize: 14, fontWeight: 800, marginTop: 8, marginBottom: 10 }}>הגדרת הכשירות (סמן ✓ במשבצת המתאימה וצרף העתק של התעודה):</h3>
          {[
            { v: "safety_engineer", label: "מהנדס בטיחות רשום" },
            { v: "safety_officer", label: "ממונה על הבטיחות (יש לצרף אישור כשירות בתוקף)" },
            { v: "school_safety_inspector", label: "עורך מבדקי בטיחות של מוסדות חינוך" },
          ].map(({ v, label }) => (
            <div key={v} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, fontSize: 13 }}>
              <CheckBox checked={report.welfareQualification === v} />
              <span>{label}</span>
            </div>
          ))}

          <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}><Line label="מספר תעודת הרישום :" value={report.welfareRegistrationNum} /></div>
            <div style={{ flex: 1 }}><Line label="טלפון נייד:" value={report.welfareInspectorPhone} /></div>
          </div>
          <Line label="כתובת דואר אלקטרוני:" value={report.welfareInspectorEmail} />

          <div style={{ marginTop: 20 }}>
            <Line label="אני" value={inspectorFull} />
            <Line label="ת.ז." value={report.welfareInspectorId} />
            <Line label="מצהיר בזאת כי הנני בעל/ת וותק של" value={report.welfareInspectorYearsExperience} />
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              שנים מיום קבלת הסמכה בתחום בטיחות וביצעתי לפחות 50 מבדקי בטיחות במסגרות ציבוריות.
            </div>
          </div>

          {/* One row: signature (right) and date (left), as in the original */}
          <div style={{ display: "flex", gap: 40, marginTop: 40, fontSize: 13, direction: "rtl" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flex: 1.2 }}>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>חתימת עורך המבדק:</span>
              {report.signatureDataUrl ? (
                <img src={report.signatureDataUrl} alt="חתימה" crossOrigin="anonymous"
                  style={{ maxHeight: 36, maxWidth: 160, height: "auto", display: "block", borderBottom: "1px solid #000000", flexShrink: 0 }} />
              ) : (
                <span style={{ flex: 1, borderBottom: "1px solid #000000", minHeight: 18 }} />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flex: 1 }}>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>תאריך:</span>
              <span style={{ flex: 1, borderBottom: "1px solid #000000", minHeight: 18, textAlign: "center", paddingBottom: 2 }}>{formatHebrewDate(report.surveyDate)}</span>
            </div>
          </div>

          <MinistryFooter marginTop={60} />
        </section>

      </div>
    );
  }

  // ── Education Safety: bespoke table layout ────────────────────────────────
  if (report.surveyType === "education_safety") {
    const inspectorName = fmt.professionalName || settings.consultantName;
    const inspectorRole = fmt.professionalRole;
    const headerColor = "#1e3a8a"; // blue accent (matches brand)

    const EDU_PRIORITY: { p: 0 | 1 | 2; label: string; desc: string; color: string; bg: string; border: string }[] = [
      { p: 0, label: "קדימות 0", desc: "מפגע בטיחותי — מחייב הסרה מיידית.",              color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
      { p: 1, label: "קדימות 1", desc: "תיקון ליקוי — פער גדול בין הממצא לדרישה.",     color: "#c2410c", bg: "#fff7ed", border: "#fdba74" },
      { p: 2, label: "קדימות 2", desc: "תיקון ליקוי — פער קטן עד בינוני.",             color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
    ];

    const TH: React.CSSProperties = {
      background: headerColor, color: "#fff", fontWeight: 700, fontSize: 12,
      padding: "8px 8px", border: "1px solid #166534", textAlign: "center",
    };
    const TD: React.CSSProperties = {
      padding: "8px 8px", fontSize: 12, border: "1px solid #d1d5db", verticalAlign: "top",
      lineHeight: 1.6,
    };
    const COL = "50px 120px 64px 1fr 1fr";

    const renderTableRow = (item: typeof report.items[0], idx: number) => (
      <div key={item.id} data-pdf-no-break="" style={{ display: "grid", gridTemplateColumns: COL }}>
        <div style={{ ...TD, textAlign: "center", fontWeight: 700 }}>{idx + 1}</div>
        <div style={TD}>{item.title || "—"}</div>
        <div style={{ ...TD, textAlign: "center" }}>{item.clause || "—"}</div>
        <div style={TD}>{item.notes || "—"}</div>
        <div style={TD}>
          {item.fieldNotes || "—"}
          {item.photo && (
            <img src={item.photo} alt="מצב קיים" crossOrigin="anonymous"
              style={{ marginTop: 6, maxWidth: "100%", height: "auto", display: "block", borderRadius: 4 }} />
          )}
        </div>
      </div>
    );

    const groups0 = report.items.filter(i => i.priority === 0);
    const groups1 = report.items.filter(i => i.priority === 1);
    const groups2 = report.items.filter(i => i.priority === 2);
    const groupsNone = report.items.filter(i => i.priority === undefined);

    return (
      <div ref={ref} dir="rtl" lang="he"
        style={{ width: "794px", background: "#ffffff", color: "#0f172a", fontFamily: "Heebo, Assistant, sans-serif" }}>

        {/* Header */}
        <div style={{ padding: "32px 48px 20px", textAlign: "center", borderBottom: `3px solid ${headerColor}` }}>
          {coverLogo && (
            <img src={coverLogo} alt="logo" crossOrigin="anonymous"
              style={{ maxHeight: 90, maxWidth: "100%", height: "auto", display: "block", margin: "0 auto 12px" }} />
          )}
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>{formatHebrewDate(report.surveyDate)}</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: headerColor, margin: "0 0 8px" }}>
            {fmt.reportTitle || "הבטחת תנאים בטיחותיים במוסדות חינוך"}
          </h1>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 6, color: "#334155" }}>
            ד ו ח &nbsp; ס י כ ו ם &nbsp; מ ב ד ק
          </div>
        </div>

        {/* General data */}
        <div style={{ padding: "24px 48px 16px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: headerColor, borderBottom: `2px solid ${headerColor}`, paddingBottom: 6, marginBottom: 14 }}>
            נתונים כלליים
          </h2>
          {(() => {
            const C: React.CSSProperties = { border: "1px solid #374151", padding: "6px 8px", fontSize: 13, verticalAlign: "top" };
            const L: React.CSSProperties = { fontWeight: 700, fontSize: 11, display: "block", marginBottom: 2 };
            const Cell = ({ label, value, colSpan }: { label: string; value?: string; colSpan?: number }) => (
              <td style={{ ...C, ...(colSpan ? { colSpan } : {}) }} colSpan={colSpan}>
                <span style={L}>{label}:</span>{value || ""}
              </td>
            );
            return (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  <tr>
                    <Cell label="הישוב" value={report.city} />
                    <Cell label="הבעלות" value={report.clientName} />
                    <Cell label="שם המוסד" value={report.placeName} />
                    <Cell label="סמל המוסד" value={report.institutionSymbol} />
                    <Cell label="מספר תלמידים וכיתות" value={report.studentCount} />
                  </tr>
                  <tr>
                    <td style={C} colSpan={3}><span style={L}>כתובת המוסד:</span>{report.address || ""}</td>
                    <Cell label="שנת הקמה" value={report.establishedYear} />
                    <Cell label="טלפון המוסד" value={report.institutionPhone} />
                  </tr>
                  <tr>
                    <td style={C} colSpan={2}><span style={L}>שם המנהל/ת:</span>{report.principalName || ""}</td>
                    <Cell label="שם המפקח" value={report.supervisorName} />
                    <Cell label="משתתפים מטעם המוסד החינוכי" value={report.institutionParticipants} />
                    <Cell label="משתתפים מטעם הרשות" value={report.authorityParticipants} />
                  </tr>
                  <tr>
                    <td style={C} colSpan={3}><span style={L}>תאריך המבדק:</span>{formatHebrewDate(report.surveyDate)}</td>
                    <td style={C} colSpan={2}>
                      <span style={L}>פרטי הבודק:</span>
                      {[inspectorName, inspectorRole, licNum ? `מ.ר ${licNum}` : ""].filter(Boolean).join(" — ")}
                    </td>
                  </tr>
                </tbody>
              </table>
            );
          })()}
        </div>

        {/* Priority legend */}
        <div style={{ padding: "0 48px 20px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: headerColor, borderBottom: `2px solid ${headerColor}`, paddingBottom: 6, marginBottom: 12 }}>
            ממצאים לפי תחומי בדיקה וקדימות טיפול
          </h2>
          {EDU_PRIORITY.map(({ label, desc }) => (
            <div key={label} style={{ fontSize: 13, lineHeight: 1.8 }}>
              <strong>{label}:</strong> {desc}
            </div>
          ))}
          {report.generalNotes && (
            <div style={{ marginTop: 10, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.7, background: "#f8fafc", borderRadius: 8, padding: "10px 14px", border: "1px solid #e2e8f0" }}>
              {report.generalNotes}
            </div>
          )}
        </div>

        {/* Findings table */}
        <div style={{ padding: "0 48px 48px" }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: COL }}>
            <div style={TH}>מס״ד</div>
            <div style={TH}>תחום הבדיקה</div>
            <div style={TH}>סעיף</div>
            <div style={TH}>הדרישה</div>
            <div style={TH}>מיקום הממצא, תיאור הממצא ומהותו</div>
          </div>

          {EDU_PRIORITY.map(({ p, label, color, bg, border }) => {
            const items = p === 0 ? groups0 : p === 1 ? groups1 : groups2;
            if (!items.length) return null;
            return (
              <div key={p}>
                <div style={{ background: bg, color, fontWeight: 800, fontSize: 14, padding: "9px 14px", border: `2px solid ${border}`, marginTop: 8, marginBottom: 2 }}>
                  {label}
                </div>
                {items.map(item => renderTableRow(item, report.items.indexOf(item)))}
              </div>
            );
          })}

          {groupsNone.length > 0 && (
            <div>
              <div style={{ background: "#f8fafc", color: "#334155", fontWeight: 800, fontSize: 14, padding: "9px 14px", border: "2px solid #e2e8f0", marginTop: 8, marginBottom: 2 }}>
                ממצאים נוספים
              </div>
              {groupsNone.map(item => renderTableRow(item, report.items.indexOf(item)))}
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
            * דוח זה מתייחס לליקויים שהתגלו ביום הבדיקה בלבד.
          </div>

          {/* Cost summary if any */}
          {totalCost > 0 && (
            <div style={{ marginTop: 24, background: headerColor, color: "#fff", borderRadius: 12, overflow: "hidden" }}>
              {report.items.filter(i => i.includeInCost && (Number(i.estimatedCost) || 0) > 0).map((item, idx, arr) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.2)" : undefined, fontSize: 13 }}>
                  <span style={{ opacity: 0.85, flex: 1 }}>{item.title}</span>
                  {(item.quantity ?? 1) > 1 && <span style={{ opacity: 0.7, fontSize: 12 }}>{formatCurrency(item.estimatedCost)} × {item.quantity}</span>}
                  <span style={{ fontWeight: 600 }}>{formatCurrency(itemTotal(item))}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderTop: "2px solid rgba(255,255,255,0.35)" }}>
                <span>אומדן עלות תיקונים כולל</span>
                <strong style={{ fontSize: 18 }}>{formatCurrency(totalCost)}</strong>
              </div>
            </div>
          )}

          {/* Signature */}
          <div style={{ marginTop: 32, display: "flex", gap: 48, alignItems: "flex-end" }}>
            <div>
              {(fmt.signatureImage || report.signatureDataUrl) ? (
                <img src={fmt.signatureImage || report.signatureDataUrl} alt="חתימה" crossOrigin="anonymous"
                  style={{ maxHeight: 64, maxWidth: 200, display: "block" }} />
              ) : (
                <div style={{ height: 56, width: 200, borderBottom: "1px solid #94a3b8" }} />
              )}
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                {sigName || "חתימת הבודק"}
                {report.signatureDate ? ` • ${report.signatureDate}` : ""}
              </div>
            </div>
            {fmt.stampImage && (
              <div>
                <img src={fmt.stampImage} alt="חותמת" crossOrigin="anonymous"
                  style={{ maxHeight: 80, maxWidth: 120, display: "block" }} />
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>חותמת</div>
              </div>
            )}
          </div>
        </div>

        {/* Education-safety notes + approval summary — appears above the inspection table */}
        {(report.eduNotes || report.eduApprovalStatus) && (
          <div data-pdf-no-break="" style={{ padding: "0 56px", marginTop: 8, direction: "rtl" }}>
            {report.eduNotes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: headerColor, textDecoration: "underline", marginBottom: 6 }}>הערות:</div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7, color: "#0f172a", borderBottom: "1px solid #94a3b8", paddingBottom: 8 }}>{report.eduNotes}</div>
              </div>
            )}
            {report.eduApprovalStatus && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: headerColor, textDecoration: "underline", marginBottom: 8 }}>סיכום:</div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.7, color: "#0f172a", whiteSpace: "pre-line" }}>
                  <span style={{ display: "inline-block", width: 14, height: 14, border: "1px solid #0f172a", textAlign: "center", lineHeight: "12px", fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>✓</span>
                  <span>{report.eduApprovalStatus === "approve"
                    ? "ע״פ המבדק והערכת הסיכונים אין במוסד מפגעים בקדימות 0 ו-1 המהווים סכנה ברורה ומיידית לפגיעה באדם במגע מקרי או לא מכוון.\nפערים שנתגלו בקדימות 2, יוסרו באחריות הרשות/בעלות במסגרת תכנית שנתית/רב שנתית."
                    : "ע״פ המבדק והערכת הסיכונים יש במוסד מפגעים בקדימות 0 ו-1 המהווים סכנה ברורה ומיידית לפגיעה באדם במגע מקרי או לא מכוון.\nפערים שנתגלו בקדימות 2, יוסרו באחריות הרשות/בעלות במסגרת תכנית שנתית/רב שנתית."}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Education-safety inspection table — only selected rows appear */}
        {(report.eduInspectionRows?.length ?? 0) > 0 && (
          <div data-pdf-page-break="" style={{ padding: "0 56px", marginTop: 24 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 800, color: headerColor }}>טבלת בדיקות נוספות</h3>
            <div style={{ border: `1px solid ${headerColor}`, borderRadius: 6, overflow: "hidden", direction: "rtl" }}>
              <div style={{ display: "flex", backgroundColor: headerColor, color: "#ffffff", fontWeight: 700, fontSize: 13 }}>
                <div style={{ width: 40, padding: "10px 8px", textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.3)" }}>מס'</div>
                <div style={{ flex: 2, padding: "10px 10px", textAlign: "right", borderLeft: "1px solid rgba(255,255,255,0.3)" }}>תחום הבדיקה</div>
                <div style={{ flex: 2, padding: "10px 10px", textAlign: "right", borderLeft: "1px solid rgba(255,255,255,0.3)" }}>תדירות</div>
                <div style={{ flex: 2, padding: "10px 10px", textAlign: "right" }}>הגוף המקצועי הבודק והמאשר</div>
              </div>
              {EDU_INSPECTION_TABLE.filter((row) => report.eduInspectionRows?.includes(row.num)).map((row, i) => (
                <div key={row.num} data-pdf-no-break="" style={{ display: "flex", backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderTop: "1px solid #cbd5e1", fontSize: 12, lineHeight: 1.55 }}>
                  <div style={{ width: 40, padding: "10px 8px", textAlign: "center", borderLeft: "1px solid #cbd5e1", fontWeight: 700 }}>{row.num}</div>
                  <div style={{ flex: 2, padding: "10px 10px", borderLeft: "1px solid #cbd5e1", whiteSpace: "pre-line" }}>{row.area}</div>
                  <div style={{ flex: 2, padding: "10px 10px", borderLeft: "1px solid #cbd5e1", whiteSpace: "pre-line" }}>{row.frequency}</div>
                  <div style={{ flex: 2, padding: "10px 10px", whiteSpace: "pre-line" }}>{row.authority}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "12px 48px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
          <span>{settings.companyName}</span>
          <span>הופק בתאריך {formatHebrewDate(new Date().toISOString().slice(0, 10))}</span>
        </div>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={ref}
      className="report-preview"
      dir="rtl"
      lang="he"
      style={{
        width: "794px",
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: "Heebo, Assistant, sans-serif",
      }}
    >
      {/* White band — outside the blue section so html2canvas never composites it against a colored parent */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: isAccessibilityType ? "20px 32px" : "28px 48px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {isAccessibilityType ? (
          <img
            src={isApproval ? ACCESSIBILITY_HEADER_BANNER_APPROVAL : ACCESSIBILITY_HEADER_BANNER_SURVEY}
            alt={isApproval ? "אישור נגישות מתו״ס ושירות" : "סקר נגישות מתו״ס ושירות"}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        ) : coverLogo && (
          <img
            src={coverLogo}
            alt={settings.companyName || "לוגו"}
            style={{ maxHeight: 140, height: "auto", maxWidth: "100%" }}
            crossOrigin="anonymous"
          />
        )}
      </div>

      {/* COVER PAGE */}
      <section
        style={{
          padding: "0",
          position: "relative",
          background: `linear-gradient(160deg,${surveyConfig.color}dd 0%,${surveyConfig.color} 55%,${surveyConfig.color}99 100%)`,
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Gradient fade from white into blue */}
        <div style={{ height: 40, background: `linear-gradient(to bottom, #ffffff 0%, ${surveyConfig.color}dd 100%)` }} />

        <div style={{ padding: "10px 48px 24px" }}>
          {!isAccessibilityType && (
            <h1 style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>
              {(() => {
                const base = fmt.reportTitle || surveyConfig.pdfTitle;
                return isApproval ? base.replace(/^סקר/, "אישור") : base;
              })()}
            </h1>
          )}
          <div style={{ fontSize: 22, marginTop: isAccessibilityType ? 0 : 14, opacity: 0.95 }}>{report.placeName || "ללא שם"}</div>
        </div>

        <div
          data-pdf-no-break=""
          style={{
            margin: "24px 0 0",
            background: "#ffffff",
            color: "#0f172a",
          }}
        >
          {report.coverPhoto && (
            <img
              src={report.coverPhoto}
              alt="cover"
              width={698}
              height={400}
              style={{ width: "100%", height: 400, display: "block" }}
            />
          )}
          <div style={{
            padding: "24px 28px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px 28px",
            fontSize: 15,
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
          }}>
            <Field label="שם המקום / העסק" value={report.placeName} />
            <Field label="שם הלקוח" value={report.clientName} />
            <Field label="כתובת" value={report.address} />
            <Field label="תאריך הסקר" value={formatHebrewDate(report.surveyDate)} />
            {report.surveyType !== "general_safety" && report.buildingType && (
              <Field
                label="סוג הבניין"
                value={
                  report.buildingType === "existing_public" ? "בניין ציבורי קיים" :
                  report.buildingType === "new_public" ? "בניין ציבורי חדש" :
                  report.buildingTypeOther || "אחר"
                }
              />
            )}
          </div>
        </div>
      </section>

      {/* CONSULTANT PAGE */}
      <section style={{ padding: "48px", background: "#fff" }}>
        {/* Fixed introduction */}
        {fmt.fixedIntroduction && (
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "#334155", whiteSpace: "pre-wrap" }}>
            {fmt.fixedIntroduction}
          </div>
        )}

        <div style={{ marginTop: fmt.fixedIntroduction ? 28 : 0 }}>
          <PageHeader title="פרטי בעל המקצוע" company={settings.companyName} accentColor={surveyConfig.color} />
        </div>

        <div
          data-pdf-no-break=""
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "18px 28px",
            fontSize: 15,
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: 24,
          }}
        >
          <Field label="חברה" value={settings.companyName} dark />
          <Field label="שם בעל המקצוע" value={fmt.professionalName || settings.consultantName} dark />
          {(fmt.professionalRole) && <Field label="תפקיד / הסמכה" value={fmt.professionalRole} dark />}

          {licNum && <Field label="מספר רישיון" value={licNum} dark />}
          <Field label="טלפון" value={settings.phone} dark />
          <Field label='דוא"ל' value={settings.email} dark />
          <Field label="כתובת המשרד" value={settings.address} dark />
        </div>


      </section>

      {/* CHECKLIST PAGE(S) */}
      <section style={{ padding: "48px", background: "#fff" }}>
        <PageHeader title="חוות דעת מקצועית" company={settings.companyName} accentColor={surveyConfig.color} />

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {hasPriorities
            ? PRIORITY_GROUPS.flatMap(({ priority, label, color, bg, border }) => {
                const groupItems = report.items.filter(i => i.priority === priority);
                if (groupItems.length === 0) return [];
                return [
                  <div
                    key={`group-${String(priority ?? "none")}`}
                    style={{ padding: "10px 18px", background: bg, border: `2px solid ${border}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 10, marginBottom: -4 }}
                  >
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 16, fontWeight: 800, color }}>{label}</span>
                    <span style={{ fontSize: 13, color: "#64748b", marginRight: "auto" }}>({groupItems.length} ממצאים)</span>
                  </div>,
                  ...groupItems.map(item => renderItem(item, report.items.indexOf(item))),
                ];
              })
            : report.items.map((item, idx) => renderItem(item, idx))
          }
        </div>

        {/* Disclaimer clauses — general_safety: 1-5 always, 6 conditional */}
        {report.surveyType === "general_safety" && (
          <div data-pdf-page-break="" style={{ marginTop: 32, border: "2px solid #1e3a8a", borderRadius: 14, padding: "20px 24px", backgroundColor: "#f0f4ff" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>הערות וסייגים</h3>
            <div style={{ direction: "rtl" }}>
              {SAFETY_CLAUSES_FIXED.map((clause, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                  <span style={{ flexShrink: 0, fontWeight: 700, minWidth: 22, textAlign: "right", fontSize: 13, color: "#1e293b" }}>{idx + 1}.</span>
                  <span style={{ flex: 1, fontSize: 13, lineHeight: 1.8, color: "#1e293b" }}>{clause}</span>
                </div>
              ))}
              {(report.selectedClauses === undefined || report.selectedClauses.includes(5)) && (
                <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                  <span style={{ flexShrink: 0, fontWeight: 700, minWidth: 22, textAlign: "right", fontSize: 13, color: "#1e293b" }}>6.</span>
                  <span style={{ flex: 1, fontSize: 13, lineHeight: 1.8, color: "#1e293b" }}>{SAFETY_CLAUSE_6}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Required approvals — general_safety only */}
        {report.surveyType === "general_safety" && (report.requiredApprovals?.length ?? 0) > 0 && (
          <div data-pdf-page-break="" style={{ marginTop: 32, border: "2px solid #1e3a8a", borderRadius: 14, padding: "20px 24px", backgroundColor: "#f0f4ff" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>אישורים נדרשים</h3>
            <div style={{ direction: "rtl", fontSize: 14, border: "1px solid #1e3a8a", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ display: "flex", backgroundColor: "#1e3a8a", color: "#ffffff", fontWeight: 700 }}>
                <div style={{ flex: 1, padding: "8px 12px", textAlign: "right" }}></div>
                <div style={{ width: 80, padding: "8px 12px", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.3)" }}>נדרש</div>
              </div>
              {(report.requiredApprovals ?? []).map((a, i) => (
                <div key={i} style={{ display: "flex", backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderTop: "1px solid #cbd5e1" }}>
                  <div style={{ flex: 1, padding: "9px 12px" }}>{a}</div>
                  <div style={{ width: 80, padding: "9px 12px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                    <span style={{ display: "inline-block", width: 14, height: 14, backgroundColor: "#1e3a8a", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opinion summary */}
        {report.accessibilityComplianceStatus && (
          <div style={{ marginTop: 32, border: "2px solid #1e3a8a", borderRadius: 14, padding: "20px 24px", backgroundColor: "#f0f4ff", pageBreakInside: "avoid" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>
              {report.surveyType === "general_safety" ? "סיכום ממצאי הבדיקה:" : "סיכום חוות הדעת:"}
            </h3>
            {report.surveyType === "general_safety" ? (
              <div style={{ marginTop: 8 }}>
                {[
                  { value: "yes", label: "המקום נמצא בטיחותי - האישור מותנה בהמצאת האישורים הנדרשים", selectedBg: "#dcfce7", selectedColor: "#15803d", selectedBorder: "#16a34a" },
                  { value: "safe", label: "המקום נמצא בטיחותי !", selectedBg: "#dcfce7", selectedColor: "#15803d", selectedBorder: "#16a34a" },
                  { value: "no", label: "לאחר טיפול בליקויים יש לזמן ביקורת נוספת", selectedBg: "#fee2e2", selectedColor: "#b91c1c", selectedBorder: "#dc2626" },
                ].map(({ value, label, selectedBg, selectedColor, selectedBorder }, idx) => {
                  const selected = report.accessibilityComplianceStatus === value;
                  return (
                    <div key={value} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginTop: idx > 0 ? 8 : 0, border: `2px solid ${selected ? selectedBorder : "#cbd5e1"}`, backgroundColor: selected ? selectedBg : "#ffffff", borderRadius: 8 }}>
                      <span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", border: `2px solid ${selected ? selectedColor : "#94a3b8"}`, backgroundColor: selected ? selectedColor : "#ffffff", flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: selected ? selectedColor : "#64748b" }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 15, color: "#0f172a", lineHeight: 1.7 }}>
                  האם בוצעו כל ההוראות החלות לפי התקנות?
                </p>
                <div style={{ marginTop: 14, display: "flex", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: report.accessibilityComplianceStatus === "yes" ? "#15803d" : "#6b7280" }}>
                    <span style={{ display: "inline-block", width: 20, height: 20, borderRadius: "50%", border: `2px solid ${report.accessibilityComplianceStatus === "yes" ? "#15803d" : "#d1d5db"}`, backgroundColor: report.accessibilityComplianceStatus === "yes" ? "#15803d" : "transparent", flexShrink: 0 }} />
                    כן
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: report.accessibilityComplianceStatus === "no" ? "#b91c1c" : "#6b7280" }}>
                    <span style={{ display: "inline-block", width: 20, height: 20, borderRadius: "50%", border: `2px solid ${report.accessibilityComplianceStatus === "no" ? "#b91c1c" : "#d1d5db"}`, backgroundColor: report.accessibilityComplianceStatus === "no" ? "#b91c1c" : "transparent", flexShrink: 0 }} />
                    לא
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CLOSING: general notes + professional sign-off */}
        {(report.generalNotes || fmt.professionalName || settings.consultantName || fmt.signatureImage || report.signatureDataUrl || fmt.stampImage) && (
          <div style={{ marginTop: 40, pageBreakInside: "avoid" }}>
            {report.generalNotes && (
              <>
                <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#1e3a8a" }}>הערות כלליות</h3>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, fontSize: 14, marginBottom: 32 }}>
                  {report.generalNotes}
                </div>
              </>
            )}

            {totalCost > 0 && (
              <div
                style={{
                  marginBottom: 32,
                  background: surveyConfig.color,
                  color: "#fff",
                  borderRadius: 14,
                  overflow: "hidden",
                  fontSize: 16,
                }}
              >
                {report.items.filter((i) => i.includeInCost && (Number(i.estimatedCost) || 0) > 0).map((item, idx, arr) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 20px",
                      borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.2)" : undefined,
                      fontSize: 14,
                      gap: 12,
                    }}
                  >
                    <span style={{ opacity: 0.85, flex: 1 }}>{item.title || `ממצא ${idx + 1}`}</span>
                    {(item.quantity ?? 1) > 1 && (
                      <span style={{ opacity: 0.7, whiteSpace: "nowrap", fontSize: 12 }}>
                        {formatCurrency(item.estimatedCost)} × {item.quantity}
                      </span>
                    )}
                    <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{formatCurrency(itemTotal(item))}</span>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 20px",
                    borderTop: "2px solid rgba(255,255,255,0.35)",
                  }}
                >
                  <span style={{ opacity: 0.9 }}>אומדן עלות תיקונים כולל</span>
                  <strong style={{ fontSize: 22 }}>{formatCurrency(totalCost)}</strong>
                </div>
              </div>
            )}

            <h3 style={{ margin: "0 0 12px", fontSize: 18, color: "#1e3a8a" }}>פרטי עורך הדוח</h3>
            <div style={{ fontSize: 14, color: "#334155", lineHeight: 2 }}>
              {(fmt.professionalName || settings.consultantName) && (
                <div><strong>שם:</strong> {fmt.professionalName || settings.consultantName}</div>
              )}
              {fmt.professionalRole && (
                <div><strong>תפקיד / הסמכה:</strong> {fmt.professionalRole}</div>
              )}
              {licNum && (
                <div><strong>מספר רישיון:</strong> {licNum}</div>
              )}

            </div>

            <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-start", gap: 48, alignItems: "flex-end" }}>
              <div>
                {(fmt.signatureImage || report.signatureDataUrl) ? (
                  <img
                    src={fmt.signatureImage || report.signatureDataUrl}
                    alt="חתימה"
                    style={{ maxHeight: 64, height: "auto", maxWidth: 200, display: "block" }}
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div style={{ height: 64, width: 200, borderBottom: "1px solid #94a3b8" }} />
                )}
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {sigName || "חתימת בעל המקצוע"}
                  {report.signatureDate ? ` • ${report.signatureDate}` : ""}
                </div>
              </div>

              {fmt.stampImage && (
                <div style={{ textAlign: "center" }}>
                  <img
                    src={fmt.stampImage}
                    alt="חותמת"
                    style={{ maxHeight: 80, height: "auto", maxWidth: 120, display: "block" }}
                    crossOrigin="anonymous"
                  />
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>חותמת</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 36, paddingTop: 16, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
          <span>{settings.companyName}</span>
          <span>הופק בתאריך {formatHebrewDate(new Date().toISOString().slice(0, 10))}</span>
        </div>
      </section>
    </div>
  );
});

PrintableReport.displayName = "PrintableReport";

function Field({ label, value, dark }: { label: string; value?: string; dark?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: dark ? "#475569" : "#64748b", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{value || "—"}</div>
    </div>
  );
}

function PageHeader({ title, company, accentColor }: { title: string; company: string; accentColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `3px solid ${accentColor ?? "#2563eb"}`, paddingBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 28, color: "#1e3a8a", fontWeight: 800 }}>{title}</h2>
      <div style={{ fontSize: 13, color: "#64748b" }}>{company}</div>
    </div>
  );
}

