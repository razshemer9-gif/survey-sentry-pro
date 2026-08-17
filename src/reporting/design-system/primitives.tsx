// Shared document primitives for generated reports.
//
// These establish document-system RULES (page geometry, pagination contract,
// RTL, typography, image behaviour). They deliberately do NOT dictate layout —
// each report type composes them into its own structure.
//
// Every component accepts a `style` override so that the statutory form
// branches (welfare_inspection, accessibility_form_8), which reproduce printed
// government originals pixel-for-pixel, can keep their exact geometry while
// still drawing colour and type from the shared tokens.

import React from "react";
import { border, color, font, image, leading, page, radius, space, text, weight } from "./tokens";

type Style = React.CSSProperties;
type Kids = { children?: React.ReactNode };

// ═══════════════════════════════════════════════════════════════════════════
// Pagination contract
//
// The PDF is produced by rasterizing the DOM (html2canvas) and slicing the
// bitmap (jsPDF) — see src/lib/pdf-generate.ts. CSS fragmentation properties
// (@page, break-inside, page-break-*) have NO effect in this pipeline.
//
// These four wrappers are the ONLY working pagination mechanism. Always use
// them instead of hand-writing the data-pdf-* attributes.
// ═══════════════════════════════════════════════════════════════════════════

/** Never split this block across a page boundary. */
export function KeepTogether({ children, style }: Kids & { style?: Style }) {
  return <div data-pdf-no-break="" style={style}>{children}</div>;
}

/** Force a new page to begin here. Renders nothing visible. */
export function PageBreak() {
  return <div data-pdf-page-break="" />;
}

/**
 * Repeating per-page footer. Captured once and stamped at the bottom of every
 * page. Only ONE of these may exist per report — the generator reads the first
 * match only.
 */
export function PageFooter({ children, style }: Kids & { style?: Style }) {
  return (
    <div
      data-pdf-page-footer=""
      style={{ padding: `${space.md}px 0`, boxSizing: "border-box", textAlign: "center", ...style }}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Document shell
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Root of every report document. Owns the fixed A4 width, RTL direction,
 * language, base colour and font family.
 *
 * `pageNumbers` opts into the digits-only "N / M" stamp. It is digits-only
 * because jsPDF's core fonts carry no Hebrew glyphs.
 */
export const ReportShell = React.forwardRef<
  HTMLDivElement,
  Kids & { pageNumbers?: boolean; style?: Style }
>(function ReportShell({ children, pageNumbers, style }, ref) {
  return (
    <div
      ref={ref}
      dir="rtl"
      lang="he"
      {...(pageNumbers ? { "data-pdf-page-numbers": "" } : {})}
      style={{
        width: `${page.width}px`,
        background: color.surface,
        color: color.ink,
        fontFamily: font.family,
        ...style,
      }}
    >
      {children}
    </div>
  );
});

/** A padded band of document content. */
export function Section({ children, style }: Kids & { style?: Style }) {
  return (
    <section style={{ padding: `${page.padY}px ${page.padX}px`, ...style }}>
      {children}
    </section>
  );
}

/** Section heading with the standard accent rule beneath it. */
export function SectionTitle({
  children,
  accent = color.brand,
  size = text.h3,
  style,
}: Kids & { accent?: string; size?: number; style?: Style }) {
  return (
    <h2
      style={{
        fontSize: size,
        fontWeight: weight.heavy,
        color: accent,
        borderBottom: `${border.thick}px solid ${accent}`,
        paddingBottom: space.sm,
        margin: `${space["3xl"]}px 0 ${space.lg}px`,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

/** Underlined heading in the style used by the statutory forms. */
export function FormHeading({
  children,
  size = text.h3,
  style,
}: Kids & { size?: number; style?: Style }) {
  return (
    <h3
      style={{
        fontSize: size,
        fontWeight: weight.heavy,
        textDecoration: "underline",
        marginBottom: space.md,
        ...style,
      }}
    >
      {children}
    </h3>
  );
}

export function Divider({ style }: { style?: Style }) {
  return <div style={{ borderTop: `${border.hairline}px solid ${color.border}`, ...style }} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// Metadata
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Label/value pair.
 *
 * `plaintext` is opt-in, not default: it re-derives paragraph direction from
 * the value's first strong character. Useful for a short inline run whose
 * glyphs would otherwise reorder (e.g. a "600–1,000" range reversing), but it
 * will left-align any value starting with a digit or Latin letter — so never
 * set it on anchored or block-level text. See FormLine for the full rationale.
 */
export function MetadataItem({
  label,
  value,
  plaintext,
  style,
}: {
  label: string;
  value?: string;
  plaintext?: boolean;
  style?: Style;
}) {
  return (
    <div style={{ fontSize: text.small, ...style }}>
      <span style={{ fontWeight: weight.bold, color: color.inkSoft }}>{label}: </span>
      <span style={plaintext ? { unicodeBidi: "plaintext" } : undefined}>{value || "—"}</span>
    </div>
  );
}

/** Inline run of metadata items — one slim line rather than a form. */
export function MetadataRow({ children, style }: Kids & { style?: Style }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: `${space.sm}px ${space["2xl"]}px`,
        fontSize: text.small,
        color: color.inkSoft,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Boxed metadata grid. `columns` is a CSS grid-template-columns value. */
export function MetadataGrid({
  children,
  columns,
  style,
}: Kids & { columns: string; style?: Style }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: columns, ...style }}>{children}</div>
  );
}

/** One boxed cell inside a MetadataGrid. */
export function MetadataCell({
  label,
  value,
  full,
  style,
}: {
  label: string;
  value?: string;
  full?: boolean;
  style?: Style;
}) {
  return (
    <div
      style={{
        padding: `${space.md}px ${space.lg}px`,
        border: `${border.hairline}px solid ${color.borderStrong}`,
        fontSize: text.small,
        ...(full ? { gridColumn: "1 / -1" } : {}),
        ...style,
      }}
    >
      <div style={{ fontWeight: weight.bold, marginBottom: space.xs }}>{label}:</div>
      <div style={{ whiteSpace: "pre-wrap" }}>{value || ""}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Form controls (statutory reproductions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A label followed by a ruled fill-in line, as printed government forms use.
 *
 * The value sits ABOVE the rule rather than on it (paddingBottom), which is a
 * deliberate typographic fix — text baselines otherwise collide with the rule.
 *
 * Deliberately does NOT set `unicodeBidi: "plaintext"`. In an RTL form the
 * value must stay anchored to the label (right) edge of the rule; plaintext
 * derives paragraph direction from the first strong character, which flings
 * LTR-leading values (phone numbers, emails, ID numbers) to the far left end
 * of the rule. The default bidi algorithm already renders those runs correctly
 * inside the inherited RTL context. Pass `valueStyle` if a specific field
 * genuinely needs isolation.
 */
export function FormLine({
  label,
  value,
  rule = color.rule,
  size = text.body,
  style,
  valueStyle,
}: {
  label: string;
  value?: string;
  rule?: string;
  size?: number;
  style?: Style;
  valueStyle?: Style;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: space.md,
        marginBottom: space.xl,
        fontSize: size,
        ...style,
      }}
    >
      <span style={{ fontWeight: weight.bold, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          flex: 1,
          borderBottom: `${border.hairline}px solid ${rule}`,
          paddingBottom: 5,
          minHeight: size + 8,
          ...valueStyle,
        }}
      >
        {value || ""}
      </span>
    </div>
  );
}

/**
 * Square checkbox with a centred tick.
 *
 * The geometry props exist because the two statutory form branches reproduce
 * printed originals whose boxes differ (14px square hairline vs 16px rounded
 * 1.5px). Defaults match the plain 14px square.
 */
export function Checkbox({
  checked,
  size = 14,
  borderWidth = border.hairline,
  cornerRadius = 0,
  tickWidth = 10,
  tickHeight = 8,
  offsetTop = space.xs,
}: {
  checked?: boolean;
  size?: number;
  borderWidth?: number;
  cornerRadius?: number;
  tickWidth?: number;
  tickHeight?: number;
  offsetTop?: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        border: `${borderWidth}px solid ${color.ink}`,
        ...(cornerRadius ? { borderRadius: cornerRadius } : {}),
        boxSizing: "border-box",
        flexShrink: 0,
        ...(offsetTop ? { marginTop: offsetTop } : {}),
      }}
    >
      {checked && (
        <svg
          width={tickWidth}
          height={tickHeight}
          viewBox="0 0 11 9"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 4.5L4 7.5L10 1"
            stroke={color.ink}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Images
//
// Aspect ratio is NEVER altered — every frame uses objectFit "contain" inside
// a fixed-height box, so photographs cannot stretch or blow out pagination.
// ═══════════════════════════════════════════════════════════════════════════

export function ImageFrame({
  src,
  alt = "",
  height = image.cardHeight,
  bg = color.surfaceAlt,
  style,
}: {
  src: string;
  alt?: string;
  height?: number;
  bg?: string;
  style?: Style;
}) {
  return (
    <div
      style={{
        width: "100%",
        height,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}

/** n-up photo grid. Each cell should be wrapped in KeepTogether by the caller. */
export function ImageGrid({
  children,
  columns = 2,
  gap = space.xl,
  style,
}: Kids & { columns?: number; gap?: number; style?: Style }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ImageCaption({ children, style }: Kids & { style?: Style }) {
  return (
    <div
      style={{
        padding: `${space.md}px ${space.lg}px`,
        fontSize: text.body,
        lineHeight: leading.normal,
        color: color.inkSoft,
        textAlign: "center",
        unicodeBidi: "plaintext",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Signature
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Signature/stamp image with its caption. Falls back to a ruled blank line
 * when no signature is stored, so the document always has somewhere to sign.
 * Always wrapped so it cannot be split across pages.
 */
export function SignatureBlock({
  src,
  caption,
  date,
  maxHeight = image.signatureMaxH,
  maxWidth = image.signatureMaxW,
  style,
}: {
  src?: string;
  caption?: string;
  date?: string;
  maxHeight?: number;
  maxWidth?: number;
  style?: Style;
}) {
  return (
    <KeepTogether style={style}>
      {src ? (
        <img
          src={src}
          alt="חתימה"
          crossOrigin="anonymous"
          style={{ maxHeight, maxWidth, height: "auto", display: "block", objectFit: "contain" }}
        />
      ) : (
        <div
          style={{
            height: maxHeight - 8,
            width: maxWidth,
            borderBottom: `${border.hairline}px solid ${color.mutedLight}`,
          }}
        />
      )}
      {(caption || date) && (
        <div style={{ fontSize: text.small, color: color.muted, marginTop: space.sm }}>
          {caption}
          {date ? ` • ${date}` : ""}
        </div>
      )}
    </KeepTogether>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Panels
// ═══════════════════════════════════════════════════════════════════════════

/** Framed callout used for notes, guidance and declarations. */
export function NotePanel({
  title,
  children,
  accent = color.brand,
  tint = color.surfaceTint,
  style,
}: Kids & { title?: string; accent?: string; tint?: string; style?: Style }) {
  return (
    <KeepTogether
      style={{
        border: `${border.thick}px solid ${accent}`,
        borderRadius: radius.lg,
        padding: `${space.xl}px ${space["2xl"]}px`,
        background: tint,
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontWeight: weight.heavy,
            color: accent,
            fontSize: text.bodyLg,
            marginBottom: space.md,
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          fontSize: text.body,
          lineHeight: leading.relaxed,
          color: color.ink,
          whiteSpace: "pre-wrap",
        }}
      >
        {children}
      </div>
    </KeepTogether>
  );
}
