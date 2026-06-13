import { ConsultantSettings, getSurveyType, SurveyReport, SurveyReportFormat } from "@/lib/types";
import { formatCurrency, formatHebrewDate } from "@/lib/pdf";
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

  const itemTotal = (i: typeof report.items[0]) => (Number(i.estimatedCost) || 0) * (i.quantity ?? 1);
  const totalCost = report.items
    .filter((i) => i.includeInCost)
    .reduce((sum, i) => sum + itemTotal(i), 0);

  const coverLogo = fmt.companyLogo || settings.logo;
  const licNum = fmt.licenseNumber || settings.license;
  const sigName = fmt.professionalName || report.signatureConsultantName || settings.consultantName;

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
            {fmt.reportTitle || surveyConfig.pdfTitle}
          </h1>
          <div style={{ fontSize: 22, marginTop: 14, opacity: 0.95 }}>{report.placeName || "ללא שם"}</div>
        </div>

        <div
          data-pdf-no-break=""
          style={{
            margin: "24px 48px 48px",
            background: "rgba(255,255,255,0.96)",
            color: "#0f172a",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          }}
        >
          {report.coverPhoto && (
            <img
              src={report.coverPhoto}
              alt="cover"
              crossOrigin="anonymous"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          )}
          <div style={{
            padding: "24px 28px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px 28px",
            fontSize: 15,
          }}>
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
          {settings.idNumber && <Field label="מספר ת.ז." value={settings.idNumber} dark />}
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
          {report.items.map((item, idx) => {
            const refPhotos = item.referencePhotos && item.referencePhotos.length > 0
              ? item.referencePhotos
              : (item.referencePhoto ? [item.referencePhoto] : []);
            return (
              <div
                key={item.id}
                data-pdf-no-break=""
                style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#fff", pageBreakInside: "avoid" }}
              >
                {/* ── Section 1: Template / professional data ── */}
                <div data-pdf-no-break="" style={{ padding: "16px 20px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 3 }}>ממצא {idx + 1}</div>
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
          })}
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
              {settings.idNumber && (
                <div><strong>מספר ת.ז.:</strong> {settings.idNumber}</div>
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

