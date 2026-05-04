import { ConsultantSettings, SurveyReport } from "@/lib/types";
import { formatCurrency, formatHebrewDate, statusLabel } from "@/lib/pdf";
import { forwardRef } from "react";
import companyLogo from "@/assets/company-logo.png";

const BRAND_NAME = "שמר בטיחות יועצים";

interface Props {
  report: SurveyReport;
  settings: ConsultantSettings;
}

/**
 * Printable A4 (210mm) layout — RTL Hebrew, blue/white themed.
 * Width is fixed in px to give html2canvas a stable canvas to rasterize.
 */
export const PrintableReport = forwardRef<HTMLDivElement, Props>(({ report, settings }, ref) => {
  const totalCost = report.items
    .filter((i) => i.status === "non_compliant")
    .reduce((sum, i) => sum + (Number(i.estimatedCost) || 0), 0);

  const counts = {
    compliant: report.items.filter((i) => i.status === "compliant").length,
    non_compliant: report.items.filter((i) => i.status === "non_compliant").length,
    not_applicable: report.items.filter((i) => i.status === "not_applicable").length,
    pending: report.items.filter((i) => i.status === "pending").length,
  };

  return (
    <div
      ref={ref}
      dir="rtl"
      lang="he"
      style={{
        width: "794px", // ~A4 at 96dpi
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
          background: "linear-gradient(160deg,#1e3a8a 0%,#2563eb 55%,#0ea5e9 100%)",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Decorative blurred glow behind logo for soft blend */}
        <div
          style={{
            padding: "44px 48px 8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              width: 360,
              height: 220,
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
              filter: "blur(2px)",
              pointerEvents: "none",
            }}
          />
          <img
            src={settings.logo || companyLogo}
            alt={BRAND_NAME}
            style={{
              height: 150,
              objectFit: "contain",
              position: "relative",
              mixBlendMode: "screen",
              filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.25))",
            }}
            crossOrigin="anonymous"
          />
          <div
            style={{
              marginTop: 14,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 1,
              color: "#ffffff",
              textShadow: "0 2px 6px rgba(0,0,0,0.25)",
              position: "relative",
            }}
          >
            {BRAND_NAME}
          </div>
          <div
            style={{
              marginTop: 6,
              width: 80,
              height: 3,
              background: "rgba(255,255,255,0.7)",
              borderRadius: 999,
            }}
          />
        </div>

        <div style={{ padding: "10px 48px 24px" }}>
          <div style={{ fontSize: 14, letterSpacing: 4, opacity: 0.85, marginBottom: 12 }}>דו״ח רשמי</div>
          <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>
            סקר נגישות מתו״ס
          </h1>
          <div style={{ fontSize: 22, marginTop: 14, opacity: 0.95 }}>{report.placeName || "ללא שם"}</div>
        </div>

        {report.coverPhoto && (
          <div style={{ padding: "0 48px" }}>
            <img
              src={report.coverPhoto}
              alt="cover"
              style={{
                width: "100%",
                height: 380,
                objectFit: "cover",
                borderRadius: 16,
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              }}
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
        </div>
      </section>

      {/* CONSULTANT PAGE */}
      <section style={{ padding: "48px", background: "#fff" }}>
        <PageHeader title="פרטי היועץ" company={settings.companyName} />

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
          <Field label="שם היועץ" value={settings.consultantName} dark />
          <Field label="מספר רישוי" value={settings.license} dark />
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
            background: "#1e3a8a",
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
            <div
              style={{
                marginTop: 8,
                whiteSpace: "pre-wrap",
                lineHeight: 1.7,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                fontSize: 14,
              }}
            >
              {report.generalNotes}
            </div>
          </>
        )}
      </section>

      {/* CHECKLIST PAGE(S) */}
      <section style={{ padding: "48px", background: "#fff" }}>
        <PageHeader title="ממצאי הסקר" company={settings.companyName} />

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {report.items.map((item, idx) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "16px 18px",
                background: "#fff",
                pageBreakInside: "avoid",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>פרמטר {idx + 1}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{item.title}</div>
                </div>
                <StatusPill status={item.status} />
              </div>

              {(item.photo || item.referencePhoto) && (
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: item.photo && item.referencePhoto ? "1fr 1fr" : "1fr",
                    gap: 10,
                  }}
                >
                  {item.photo && (
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>מצב קיים</div>
                      <img
                        src={item.photo}
                        alt={item.title}
                        style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0" }}
                      />
                    </div>
                  )}
                  {item.referencePhoto && (
                    <div>
                      <div style={{ fontSize: 11, color: "#1e3a8a", marginBottom: 4, fontWeight: 600 }}>
                        פרט מבוקש{item.referenceLabel ? `: ${item.referenceLabel}` : ""}
                      </div>
                      <img
                        src={item.referencePhoto}
                        alt={item.referenceLabel || "פרט"}
                        style={{ width: "100%", maxHeight: 260, objectFit: "contain", background: "#f8fafc", borderRadius: 10, border: "1px solid #bfdbfe" }}
                      />
                    </div>
                  )}
                </div>
              )}

              {item.notes && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    color: "#334155",
                    background: "#f8fafc",
                    borderRadius: 10,
                    padding: "10px 12px",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                  }}
                >
                  {item.notes}
                </div>
              )}

              {item.status === "non_compliant" && (item.estimatedCost || 0) > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    display: "inline-block",
                    background: "#fef2f2",
                    color: "#991b1b",
                    border: "1px solid #fecaca",
                    fontSize: 13,
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontWeight: 600,
                  }}
                >
                  אומדן עלות תיקון: {formatCurrency(item.estimatedCost)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 36,
            paddingTop: 16,
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#64748b",
          }}
        >
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

function PageHeader({ title, company }: { title: string; company: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #2563eb", paddingBottom: 12 }}>
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
    <span
      style={{
        background: c.bg,
        color: c.fg,
        fontSize: 13,
        fontWeight: 700,
        padding: "6px 12px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {statusLabel(status)}
    </span>
  );
}
