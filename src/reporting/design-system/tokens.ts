// Design tokens for every generated report.
//
// These are the single source of truth for the shared visual language:
// typography, colour, spacing, borders and page geometry. Report branches
// choose their own LAYOUT, but must draw their values from here.
//
// Why plain objects and inline styles rather than CSS classes: reports are
// rasterized by html2canvas (see src/lib/pdf-generate.ts). Inline styles are
// what that pipeline reads most reliably, and the existing renderer is already
// inline-styled throughout. Introducing a stylesheet layer would add a second
// styling mechanism without removing the first.

// ── Page geometry ──────────────────────────────────────────────────────────
// A4 at 96 DPI. WIDTH is authoritative — the renderer is a fixed-width
// document and pdf-generate converts it to mm via PX_TO_MM.
//
// HEIGHT is reference-only. The PDF slicer derives its own page height
// (PAGE_H) from html2canvas canvas-size ceilings, NOT from A4. Do not try to
// force slices to A4_HEIGHT: that was attempted and reverted because it broke
// existing reports.
export const page = {
  width: 794,
  /** Reference only — the slicer does not use this. See note above. */
  a4Height: 1123,
  /** Standard content inset for document body sections. */
  padX: 48,
  padY: 32,
  /** Wider inset used by the statutory government-form branches. */
  padXForm: 56,
} as const;

// ── Typography ─────────────────────────────────────────────────────────────
// Heebo is the primary face (loaded in index.html); Assistant is the fallback.
// Sizes form a deliberate scale — do not introduce intermediate values.
export const font = {
  family: "Heebo, Assistant, sans-serif",
} as const;

export const text = {
  /** Cover-page display size. */
  display: 46,
  /** Report title on a content page. */
  h1: 22,
  h2: 18,
  h3: 16,
  h4: 15,
  /** Default body copy. */
  body: 13,
  bodyLg: 14,
  small: 12,
  caption: 11,
  /** Table cell text. */
  table: 12,
  tableDense: 11,
  footer: 11,
} as const;

export const weight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
} as const;

export const leading = {
  tight: 1.3,
  snug: 1.55,
  normal: 1.65,
  relaxed: 1.8,
} as const;

// ── Colour ─────────────────────────────────────────────────────────────────
// Roles, not shades. If you need a colour that is not here, the right move is
// almost always to reuse an existing role rather than add a new hex.
export const color = {
  /** Company brand blue. The default accent for all report types. */
  brand: "#1e3a8a",
  /** Slightly lighter blue for links and secondary emphasis. */
  brandAlt: "#1d4ed8",

  /** Primary body text. */
  ink: "#0f172a",
  /** Secondary text — still readable, less prominent. */
  inkSoft: "#334155",
  /** Muted labels and captions. */
  muted: "#64748b",
  /** Faintest text and placeholder rules. */
  mutedLight: "#94a3b8",

  surface: "#ffffff",
  /** Zebra striping and inset panels. */
  surfaceAlt: "#f8fafc",
  /** Brand-tinted panel background. */
  surfaceTint: "#f0f4ff",

  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  /** Hard black rules used by statutory forms that reproduce a printed original. */
  rule: "#000000",

  success: "#15803d",
  successBg: "#dcfce7",
  warning: "#b45309",
  warningBg: "#fef3c7",
  danger: "#b91c1c",
  dangerBg: "#fef2f2",

  /** Ministry of Welfare blue — statutory, matches the official form. */
  ministry: "#1b75bc",
} as const;

/** Priority colours (0 = urgent, 1 = high, 2 = normal). */
export const priorityColor = {
  0: { fg: "#ffffff", bg: "#dc2626", border: "#dc2626" },
  1: { fg: "#ffffff", bg: "#ea580c", border: "#ea580c" },
  2: { fg: "#7c4a03", bg: "#fde68a", border: "#fdba74" },
} as const;

// ── Spacing ────────────────────────────────────────────────────────────────
// One scale, used for margins, padding and gaps.
export const space = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  "4xl": 32,
  "5xl": 40,
  "6xl": 48,
} as const;

// ── Borders ────────────────────────────────────────────────────────────────
export const border = {
  hairline: 1,
  thick: 2,
  heavy: 3,
} as const;

export const radius = {
  /** Table and panel corners. */
  sm: 4,
  md: 6,
  /** Photo cards. Use sparingly — reports are documents, not web UI. */
  lg: 12,
} as const;

// ── Images ─────────────────────────────────────────────────────────────────
// Aspect ratio is never altered: every image box uses objectFit "contain".
export const image = {
  /** Height of a photo frame in a 2-up finding grid. */
  cardHeight: 210,
  /** Height of a photo frame in a dense appendix grid. */
  thumbHeight: 150,
  signatureMaxH: 64,
  signatureMaxW: 200,
  logoMaxH: 60,
  logoMaxW: 150,
} as const;
