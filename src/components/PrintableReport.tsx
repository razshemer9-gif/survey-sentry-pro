import { ConsultantSettings, getSurveyType, SurveyReport, SurveyReportFormat } from "@/lib/types";
import { formatCurrency, formatHebrewDate } from "@/lib/pdf";
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

  const itemTotal = (i: typeof report.items[0]) => (Number(i.estimatedCost) || 0) * (i.quantity ?? 1);
  const totalCost = report.items
    .filter((i) => i.includeInCost)
    .reduce((sum, i) => sum + itemTotal(i), 0);

  const coverLogo = fmt.companyLogo || settings.logo;
  const licNum = fmt.licenseNumber || settings.license;
  const sigName = fmt.professionalName || report.signatureConsultantName || settings.consultantName;

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
                    <Cell label="מספר תלמידים וכיתות" value={report.studentCount} />
                    <Cell label="סמל המוסד" value={report.institutionSymbol} />
                    <Cell label="שם המוסד" value={report.placeName} />
                    <Cell label="הבעלות" value={report.clientName} />
                    <Cell label="הישוב" value={report.city} />
                  </tr>
                  <tr>
                    <Cell label="טלפון המוסד" value={report.institutionPhone} />
                    <Cell label="שנת הקמה" value={report.establishedYear} />
                    <td style={C} colSpan={3}><span style={L}>כתובת המוסד:</span>{report.address || ""}</td>
                  </tr>
                  <tr>
                    <Cell label="משתתפים מטעם הרשות" value={report.authorityParticipants} />
                    <Cell label="משתתפים מטעם המוסד החינוכי" value={report.institutionParticipants} />
                    <Cell label="שם המפקח" value={report.supervisorName} />
                    <td style={C} colSpan={2}><span style={L}>שם המנהל/ת:</span>{report.principalName || ""}</td>
                  </tr>
                  <tr>
                    <td style={C} colSpan={2}>
                      <span style={L}>פרטי הבודק:</span>
                      {[inspectorName, inspectorRole, licNum ? `מ.ר ${licNum}` : ""].filter(Boolean).join(" — ")}
                    </td>
                    <td style={C} colSpan={3}><span style={L}>תאריך המבדק:</span>{formatHebrewDate(report.surveyDate)}</td>
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
          padding: "28px 48px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {coverLogo && (
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
          <h1 style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>
            {(() => {
              const base = fmt.reportTitle || surveyConfig.pdfTitle;
              return report.reportMode === "approval" ? base.replace(/^סקר/, "אישור") : base;
            })()}
          </h1>
          <div style={{ fontSize: 22, marginTop: 14, opacity: 0.95 }}>{report.placeName || "ללא שם"}</div>
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

        {/* Required approvals — general_safety only */}
        {report.surveyType === "general_safety" && (report.requiredApprovals?.length ?? 0) > 0 && (
          <div data-pdf-page-break="" style={{ marginTop: 32, border: "2px solid #1e3a8a", borderRadius: 14, padding: "20px 24px", backgroundColor: "#f0f4ff", pageBreakInside: "avoid" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>אישורים נדרשים</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, direction: "rtl" }}>
              <thead>
                <tr style={{ backgroundColor: "#1e3a8a", color: "#ffffff" }}>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, border: "1px solid #1e3a8a" }}>אישור</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, border: "1px solid #1e3a8a", width: 70 }}>נדרש</th>
                </tr>
              </thead>
              <tbody>
                {(report.requiredApprovals ?? []).map((a, i) => (
                  <tr key={a} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>{a}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                      <span style={{ display: "inline-block", width: 14, height: 14, backgroundColor: "#1e3a8a", borderRadius: 3 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  { value: "yes", label: "המקום נמצא בטיחותי", selectedBg: "#dcfce7", selectedColor: "#15803d", selectedBorder: "#16a34a" },
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

