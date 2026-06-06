import { ConsultantSettings, getSurveyType, SurveyReport, SurveyReportFormat } from "@/lib/types";
import { formatCurrency, formatHebrewDate, statusLabel } from "@/lib/pdf";
import { forwardRef } from "react";

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

  const totalCost = report.items
    .filter((i) => i.includeInCost)
    .reduce((sum, i) => sum + (Number(i.estimatedCost) || 0), 0);

  const counts = {
    compliant: report.items.filter((i) => i.status === "compliant").length,
    non_compliant: report.items.filter((i) => i.status === "non_compliant").length,
    not_applicable: report.items.filter((i) => i.status === "not_applicable").length,
    pending: report.items.filter((i) => i.status === "pending").length,
  };

  const coverLogo = fmt.companyLogo || settings.logo;
  const licNum = fmt.licenseNumber || settings.license;
  const sigName = fmt.professionalName || report.signatureConsultantName || settings.consultantName;

  return (
    <div
      ref={ref}
      dir="rtl"
      lang="he"
      style={{
        width: "794px",
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: "Heebo, Assistant, sans-serif",
      }}
    >
      {/* COVER PAGE */}
      <section
        style={{
          minHeight: "1100px",
          padding: "0",
          position: "relative",
          background: `linear-gradient(160deg,${surveyConfig.color}dd 0%,${surveyConfig.color} 55%,${surveyConfig.color}99 100%)`,
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* White band header */}
        <div
          style={{
            background: "#ffffff",
            padding: "28px 48px 24px",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          {coverLogo && (
            <img
              src={coverLogo}
              alt={settings.companyName || "לוגו"}
              style={{ height: 140, objectFit: "contain" }}
              crossOrigin="anonymous"
            />
          )}
          {settings.companyName && (
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 800, letterSpacing: 1, color: "#1e3a8a" }}>
              {settings.companyName}
            </div>
          )}
          {settings.consultantName && (
            <div style={{ fontSize: 16, color: "#475569", marginTop: 4 }}>
              {settings.consultantName}
            </div>
          )}
        </div>

        <div style={{ height: 40, background: "linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0) 100%)", marginTop: -8 }} />

        <div style={{ padding: "10px 48px 24px" }}>
          <h1 style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>
            {fmt.reportTitle || surveyConfig.pdfTitle}
          </h1>
          <div style={{ fontSize: 22, marginTop: 14, opacity: 0.95 }}>{report.placeName || "ללא שם"}</div>
        </div>

        {report.coverPhoto && (
          <div style={{ padding: "0 48px" }}>
            <img
              src={report.coverPhoto}
              alt="cover"
              style={{ width: "100%", height: 380, objectFit: "cover", borderRadius: 16, boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}
            />
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div
          style={{
            margin: "32px 48px 48px",
            background: "rgba(255,255,255,0.96)",
            color: "#0f172a",
            borderRadius: 16,
            padding: "24px 28px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px 28px",
            fontSize: 15,
          }}
        >
          <Field label="שם המקום / העסק" value={report.placeName} />
          <Field label="שם הלקוח" value={report.clientName} />
          <Field label="כתובת" value={report.address} />
          <Field label="תאריך הסקר" value={formatHebrewDate(report.surveyDate)} />
          {report.buildingType && (
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
      </section>

      {/* CONSULTANT PAGE */}
      <section style={{ padding: "48px", background: "#fff" }}>
        <PageHeader title="פרטי בעל המקצוע" company={settings.companyName} accentColor={surveyConfig.color} />

        {/* Fixed introduction */}
        {fmt.fixedIntroduction && (
          <div style={{ marginTop: 20, fontSize: 14, lineHeight: 1.8, color: "#334155", whiteSpace: "pre-wrap" }}>
            {fmt.fixedIntroduction}
          </div>
        )}

        <div
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
          {settings.idNumber && <Field label="מספר ת.ז." value={settings.idNumber} dark />}
          {licNum && <Field label="מספר רישיון" value={licNum} dark />}
          <Field label="טלפון" value={settings.phone} dark />
          <Field label='דוא"ל' value={settings.email} dark />
          <Field label="כתובת המשרד" value={settings.address} dark />
        </div>

        <h3 style={{ marginTop: 36, fontSize: 18, color: "#1e3a8a" }}>תקציר ממצאים</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 12 }}>
          <SummaryCard color="#16a34a" label="תקין" value={counts.compliant} />
          <SummaryCard color="#dc2626" label="לא תקין" value={counts.non_compliant} />
          <SummaryCard color="#64748b" label="לא רלוונטי" value={counts.not_applicable} />
          <SummaryCard color="#f59e0b" label="ממתין" value={counts.pending} />
        </div>

        <div
          style={{
            marginTop: 18,
            background: surveyConfig.color,
            color: "#fff",
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 16,
          }}
        >
          <span style={{ opacity: 0.9 }}>אומדן עלות תיקונים כולל</span>
          <strong style={{ fontSize: 22 }}>{formatCurrency(totalCost)}</strong>
        </div>

        {report.generalNotes && (
          <>
            <h3 style={{ marginTop: 36, fontSize: 18, color: "#1e3a8a" }}>הערות כלליות</h3>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.7, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, fontSize: 14 }}>
              {report.generalNotes}
            </div>
          </>
        )}

        {/* Signature + stamp */}
        <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-start", gap: 48, alignItems: "flex-end" }}>
          <div>
            {(fmt.signatureImage || report.signatureDataUrl) ? (
              <img
                src={fmt.signatureImage || report.signatureDataUrl}
                alt="חתימה"
                style={{ height: 64, maxWidth: 200, objectFit: "contain", display: "block" }}
                crossOrigin="anonymous"
              />
            ) : (
              <div style={{ height: 64, width: 200, borderBottom: "1px solid #94a3b8" }} />
            )}
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {sigName || "חתימת בעל המקצוע"}
              {report.signatureDate ? ` • ${report.signatureDate}` : ""}
            </div>
            {licNum && (
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>רישיון {licNum}</div>
            )}
            {settings.idNumber && (
              <div style={{ fontSize: 11, color: "#475569" }}>ת.ז. {settings.idNumber}</div>
            )}
          </div>

          {fmt.stampImage && (
            <div style={{ textAlign: "center" }}>
              <img
                src={fmt.stampImage}
                alt="חותמת"
                style={{ height: 80, maxWidth: 120, objectFit: "contain", display: "block" }}
                crossOrigin="anonymous"
              />
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>חותמת</div>
            </div>
          )}
        </div>
      </section>

      {/* CHECKLIST PAGE(S) */}
      <section style={{ padding: "48px", background: "#fff" }}>
        <PageHeader title="חוות דעת מקצועית" company={settings.companyName} accentColor={surveyConfig.color} />

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {report.items.map((item, idx) => (
            <div
              key={item.id}
              style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", background: "#fff", pageBreakInside: "avoid" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>ממצא {idx + 1}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{item.title}</div>
                  {(item.standardPart || item.clause) && (
                    <div style={{ fontSize: 11, color: "#1e40af", marginTop: 4, fontWeight: 600 }}>
                      {item.standardPart}{item.clause ? ` · סעיף ${item.clause}` : ""}
                    </div>
                  )}
                </div>
                <StatusPill status={item.status} />
              </div>

              {(() => {
                const refPhotos = item.referencePhotos && item.referencePhotos.length > 0
                  ? item.referencePhotos
                  : (item.referencePhoto ? [item.referencePhoto] : []);
                const hasCurrent = !!item.photo;
                const hasRefs = refPhotos.length > 0;
                if (!hasCurrent && !hasRefs) return null;
                return (
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: hasCurrent && hasRefs ? "1fr 1fr" : "1fr", gap: 10 }}>
                    {hasCurrent && (
                      <div>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>מצב קיים</div>
                        <img src={item.photo} alt={item.title} style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0" }} />
                      </div>
                    )}
                    {hasRefs && (
                      <div>
                        <div style={{ fontSize: 11, color: "#1e3a8a", marginBottom: 4, fontWeight: 600 }}>
                          פרט מבוקש{item.referenceLabel ? `: ${item.referenceLabel}` : ""}
                          {refPhotos.length > 1 ? ` (${refPhotos.length})` : ""}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: refPhotos.length > 1 ? "1fr 1fr" : "1fr", gap: 6 }}>
                          {refPhotos.map((p, i) => (
                            <img key={i} src={p} alt={item.referenceLabel || `פרט ${i + 1}`} style={{ width: "100%", maxHeight: 260, objectFit: "contain", background: "#f8fafc", borderRadius: 10, border: "1px solid #bfdbfe" }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {item.notes && (
                <div style={{ marginTop: 10, fontSize: 14, color: "#334155", background: "#f8fafc", borderRadius: 10, padding: "10px 12px", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {item.notes}
                </div>
              )}

              {item.status === "non_compliant" && item.suggestedCorrection && (
                <div style={{ marginTop: 10, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#1e40af", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700, display: "block", marginBottom: 2 }}>📋 הצעת תיקון:</span>
                  {item.suggestedCorrection}
                </div>
              )}

              {item.status === "non_compliant" && (item.estimatedCost || 0) > 0 && (
                <div style={{ marginTop: 10, display: "inline-block", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, padding: "6px 10px", borderRadius: 999, fontWeight: 600 }}>
                  אומדן עלות תיקון: {formatCurrency(item.estimatedCost)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Opinion summary */}
        {report.accessibilityComplianceStatus && (
          <div style={{ marginTop: 32, border: "2px solid #1e3a8a", borderRadius: 14, padding: "20px 24px", background: "#f0f4ff", pageBreakInside: "avoid" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>
              סיכום חוות הדעת:
            </h3>
            <p style={{ margin: 0, fontSize: 15, color: "#0f172a", lineHeight: 1.7 }}>
              האם בוצעו כל ההוראות החלות לפי התקנות?
            </p>
            <div style={{ marginTop: 14, display: "flex", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: report.accessibilityComplianceStatus === "yes" ? "#15803d" : "#6b7280" }}>
                <span style={{ display: "inline-block", width: 20, height: 20, borderRadius: "50%", border: `2px solid ${report.accessibilityComplianceStatus === "yes" ? "#15803d" : "#d1d5db"}`, background: report.accessibilityComplianceStatus === "yes" ? "#15803d" : "transparent", flexShrink: 0 }} />
                כן
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: report.accessibilityComplianceStatus === "no" ? "#b91c1c" : "#6b7280" }}>
                <span style={{ display: "inline-block", width: 20, height: 20, borderRadius: "50%", border: `2px solid ${report.accessibilityComplianceStatus === "no" ? "#b91c1c" : "#d1d5db"}`, background: report.accessibilityComplianceStatus === "no" ? "#b91c1c" : "transparent", flexShrink: 0 }} />
                לא
              </div>
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

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    compliant: { bg: "#dcfce7", fg: "#166534" },
    non_compliant: { bg: "#fee2e2", fg: "#991b1b" },
    not_applicable: { bg: "#e2e8f0", fg: "#334155" },
    pending: { bg: "#fef3c7", fg: "#92400e" },
  };
  const c = map[status] || map.pending;
  return (
    <span style={{ background: c.bg, color: c.fg, fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {statusLabel(status)}
    </span>
  );
}
