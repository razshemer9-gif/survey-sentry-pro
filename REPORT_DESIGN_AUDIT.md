# Report Design Audit

Audit of the report-generation layer of survey-sentry-pro, performed before any
refactor. Every claim here was verified against the source; file:line references
are given throughout.

---

## 1. Current architecture

### 1.1 The actual pipeline

```
SurveyReport (data, Supabase + offline IndexedDB)
        │
        ▼
ReportEditor.tsx  ── renders TWO instances of the SAME component ──┐
        │                                                          │
        ├── visible preview (Radix Dialog, CSS-scaled 0.42/0.6)    │
        │      ReportEditor.tsx:1825                               │
        │                                                          │
        └── hidden print mount (portal → document.body,            │
               position:fixed; top:100vh)                          │
               ReportEditor.tsx:1906-1922   ref={printRef}         │
                                                                   ▼
                                                    PrintableReport.tsx
                                                    (1,645 lines, 6 branches)
                                                                   │
                                                                   ▼
                                              generateReportPdf(printRef.current)
                                                    src/lib/pdf-generate.ts
                                                                   │
                              ┌────────────────────────────────────┤
                              ▼                                    ▼
                    html2canvas rasterizes             jsPDF assembles bitmap
                    the DOM slice-by-slice             pages → Blob → download
```

**This is a rasterization pipeline, not a print pipeline.** The DOM is
photographed into bitmaps; the PDF contains images, not text. There is no
Chromium print step, no `window.print()`, no Puppeteer/Playwright.

### 1.2 Consequences of rasterization (critical)

These follow directly from the architecture and constrain everything else:

| Consequence | Detail |
| --- | --- |
| **CSS fragmentation is inert** | `@page`, `@media print`, `break-inside`, `break-before/after`, `page-break-*` have **zero** effect. html2canvas never consults them. Verified: the repo contains none, and the 3 existing inline `pageBreakInside:"avoid"` (PrintableReport.tsx:84, 1482, 1524) do nothing. |
| **Repeating table headers impossible** | `<thead>` repeat-on-break is a CSS-fragmentation feature. Not available. A long table must be paginated manually or allowed to flow as one bitmap. |
| **PDF text is not selectable or searchable** | Everything except the page number is an image. This is a deliberate trade: jsPDF's core fonts have no Hebrew glyphs, so rasterizing is the only way to get correct Hebrew shaping/RTL. |
| **Pagination is a JS attribute protocol** | The real page-break contract is four `data-pdf-*` attributes read by the slicer (§1.3). This is the layer that must be formalized — not print CSS. |
| **Page height is canvas-limited, not A4** | `PAGE_H` derives from canvas-size ceilings, not from 297mm (§1.4). |

### 1.3 The pagination contract (`src/lib/pdf-generate.ts`)

Four attributes, and these are the *only* pagination mechanism that works:

| Attribute | Read at | Meaning |
| --- | --- | --- |
| `data-pdf-no-break` | pdf-generate.ts:110-115 | A page break is never placed inside this element. If it is taller than one page it overflows rather than being cut. |
| `data-pdf-page-break` | pdf-generate.ts:118-120, honored 138-143 | Forces a new page to begin at this element's top edge. |
| `data-pdf-page-footer` | pdf-generate.ts:60-78 | **First match only.** Captured once, removed from flow, stamped at the bottom of every page. |
| `data-pdf-page-numbers` | pdf-generate.ts:88 | Checked on the **root element only**. Stamps digits-only `"N / M"`, and only when there is more than one page. |

Slicing algorithm (pdf-generate.ts:123-162), per page: start at `cursor`, set
`end = min(cursor + PAGE_H, contentHeight)`; pull `end` back to the first
`data-pdf-page-break` in range; then pull it back further to the top of any
`data-pdf-no-break` card straddling it; if that collapses the slice to nothing,
let the oversized card overflow its own page.

Rasterization uses a "marginTop slide" (pdf-generate.ts:168-204): the fixed
off-screen container is clipped to the slice height and the report element is
slid up by `-pageTop` px, then photographed. State is always restored in a
`finally` (pdf-generate.ts:243-249).

### 1.4 Page geometry constants

| Constant | Line | Value |
| --- | --- | --- |
| `PX_TO_MM` | 49 | `25.4 / 96` |
| `scale` | 98 | `1.5` mobile / `2` desktop (html2canvas DPR) |
| `MAX_PX` | 99 | `3_500_000` mobile / `14_000_000` desktop (canvas area cap) |
| `MAX_H` | 100 | `3_500` mobile / `7_000` desktop (canvas height cap) |
| `PAGE_H` | 102 | `max(200, min(MAX_H, floor(MAX_PX / (elWidth*scale))) - footerHpx - GAP_PX)` |
| `GAP_PX` | 63 | `6` (content→footer gap) |

Page **width** is fixed at `794px` (A4 at 96 DPI) and converted to mm for jsPDF.
Page **height** is *not* A4 — it is whatever the canvas ceiling allows. A
previous attempt to cap `PAGE_H` to A4 physical height broke existing reports
and was explicitly reverted; do not reintroduce it without a full re-verification
pass.

Orientation is computed per page (`pageHmm < pageWmm ? "landscape" : "portrait"`,
pdf-generate.ts:218) purely to stop jsPDF silently swapping the `[w,h]` format
array and clipping content. It is a workaround, not a design intent.

### 1.5 Preview / PDF parity

**Already satisfied in principle.** Both mounts render the same
`PrintableReport` (single import, ReportEditor.tsx:11). There is no
`PreviewReport` vs `PdfReport` split.

Two real divergences exist:

1. **Cover-photo divergence** — the PDF mount applies a `croppedCoverPhoto`
   override (ReportEditor.tsx:1917) that the preview mount does not
   (ReportEditor.tsx:1825). The preview therefore shows a different cover image
   than the PDF. *This is a genuine parity bug.*
2. **Scale** — the preview is CSS-scaled to 42%/60%, so it is a faithful but
   non-pixel-exact representation. This is acceptable and expected.

### 1.6 Fonts

Heebo + Assistant, loaded from Google Fonts (`index.html:12-14`). There is no
`@font-face`, no self-hosted file, no `@fontsource` package.

- The generator does `await document.fonts.ready` (pdf-generate.ts:34), which
  waits correctly but **cannot detect a failed load**.
- If the CDN is unreachable, all six report roots fall back to `sans-serif`,
  silently changing every metric in the PDF. The app otherwise has full offline
  support (`offline-db.ts`, `sync-engine.ts`), so this is an inconsistency.
- The stylesheet requests Assistant at weights 400–700, but reports use
  `fontWeight: 800`. Covered by Heebo; synthesized if Assistant is ever reached.

### 1.7 Test coverage

Effectively none. Vitest is configured (`vitest.config.ts`, jsdom) but the only
test in the repo is `src/test/example.test.ts` asserting `true === true`. CI
(`.github/workflows/deploy.yml`) runs `npm ci && npm run build` and never runs
tests or lint. jsdom has no canvas backend, so the PDF pipeline cannot be
exercised there at all — verification must be done in a real browser.

---

## 2. Report types

Seven types, defined in `src/lib/types.ts:4` and configured at `types.ts:15+`.
All are rendered by branches inside the single `PrintableReport.tsx`.

| # | `SurveyType` | Hebrew | Branch | Approx. lines |
| --- | --- | --- | --- | --- |
| 1 | `accessibility` | סקר נגישות מתו״ס ושירות | default (:1251) | shared |
| 2 | `general_safety` | סקר בטיחות כללי | default (:1251) | shared |
| 3 | `education_safety` | סקר בטיחות מוסדות חינוך | :1002 | ~247 |
| 4 | `welfare_inspection` | דוח מבדק משרד הרווחה | :628 | ~373 |
| 5 | `element_stability` | דוח בדיקת יציבות אלמנטים | :362 | ~178 |
| 6 | `risk_survey` | סקר סיכונים | :541 | ~86 |
| 7 | `accessibility_form_8` | טופס 8 – חוות דעת מורשה נגישות | :159 | ~200 |

### 2.1 Per-type structure

**1–2. accessibility / general_safety** (shared default branch)
Cover page → consultant page (fixed introduction, purpose, declaration) →
checklist pages (`renderItem`, :76-157) → disclaimer clauses (general_safety
only) → required approvals (general_safety only) → opinion summary → closing
sign-off + footer.
*Unique:* full-bleed header banners; gradient fade; cost summary table
(accessibility only — general_safety had cost fields removed).

**3. education_safety**
Header → general-data table (5-col `<table>`) → priority legend → findings table
→ cost summary → notes/approval → מוסדות-חינוך inspection table (static rows
from `edu-inspection-table.ts`, filtered by `report.eduInspectionRows`) →
signature → footer.
*Unique:* the only branch using real `<table>/<td>` markup; the only one with a
statutory reference table.

**4. welfare_inspection**
Six explicitly-numbered pages, each a `data-pdf-page-break` section:
(1) ministry header + כללי + form fields, (2) ממצאים / א. אישורים table,
(3) ב. פערים + ג. דרישות tables, (4) declaration + סיכום + inspector details,
(5) הגדרת הכשירות, (6) photo appendix (conditional).
*Unique:* pixel-faithful reproduction of an official government form, verified
against the source PDF at commit `ea9a1c9`. Ministry logo + state emblem
(`welfare-logos.ts`). Underlined fill-in fields. Repeating ministry footer.
*This branch's geometry is a fidelity contract and must not be normalized.*

**5. element_stability**
Header banner → report details → elements table → notes → result + fixed terms →
signature → repeating footer (`data-pdf-page-footer`).
*Unique:* conditional term list (stable-only clauses omitted when unstable);
`fmt.footerImage` override.

**6. risk_survey**
Full-bleed banner → place name + logo → one-line event metadata → 2-up photo
card grid → fencing note → signature.
*Unique:* the only type using `data-pdf-page-numbers`; content is photo-driven
rather than checklist-driven.

**7. accessibility_form_8**
Recipient/subject → חלק א' (business) → חלק ב' (expert) → חלק ג' (opinion +
signature) → חלק ד' (statutory requirements table, `form8-data.ts`) → owner
declaration.
*Unique:* statutory form layout; per-page footer with expert credentials;
calculator-backed default responses (`form8-calc.ts`).

### 2.2 Shared structures (the extraction targets)

Present in three or more branches, currently re-implemented each time:

| Structure | Where it recurs |
| --- | --- |
| **Root document shell** | All 6 branches, byte-identical style object (:206, :428, :550, :698, :1046, :1258) |
| **Section heading** | `SectionTitle` (:167), underlined `<h2>/<h3>` (welfare :694/:734/:737/:792/:803/:860/:880), `<h2>` (:168, :1046, :1093) |
| **Label/value metadata cell** | `Cell` defined **twice, differently** (:183 Form 8 grid, :1066 education `<td>`) |
| **Underlined fill-in field** | `Line` (:654) + 4 hand-rolled copies (:223, :726, :839, :935) |
| **Checkbox** | `Checkbox` (:173) and `CheckBox` (:660) — two near-identical SVG implementations |
| **Bordered data table** | Grid-based (Form 8 :307, welfare :754/:820) and `<table>`-based (education :1058/:1122) |
| **Signature block** | 5 separate implementations (:279, :338, :520, :609, :1210) |
| **Repeating page footer** | `Footer` (:190), `ElementFooter` (:374), `MinistryFooter` (:682) |
| **Photo/image block** | :320, :583, :970, :1214 |

---

## 3. Problems

### 3.1 Duplication (measured)

In `PrintableReport.tsx` (1,645 lines):

| Metric | Count |
| --- | --- |
| Inline `style={{…}}` objects | **404** |
| Hex colour literals | **252**, across **43 distinct** colours |
| `fontSize` literals | **147**, across **15 distinct** sizes |
| `padding` string declarations | **95**, across ~40 distinct combinations |
| Identical root-shell style objects | **6** |
| Sub-components defined more than once | `Cell`, `Checkbox`/`CheckBox`, 3 footer variants |

### 3.2 Design inconsistencies

**Typography** — 15 font sizes with no scale: 11, 12, 12.5, 13, 14, 15, 16, 17,
18, 19, 20, 22, 26, 28, 46. Sizes 17/19/12.5 appear once or twice each and are
almost certainly accidental. No heading hierarchy: an H1 is 46px in the default
cover, 25px in risk_survey, 20px in welfare, 19px in Form 8.

**Colour** — 43 colours where roughly 12 roles exist. Concrete drift:
- Brand blue is inconsistent: `#1e3a8a` (18 uses), `#2563eb`, `#1d4ed8`,
  `#1e40af`, `#2f5eb3`, `#1b75bc`.
- Both `#ffffff` (19) and `#fff` (15) are used for the same white.
- Muted text is `#64748b` (20), `#94a3b8` (13), `#334155` (11), `#6b7280` (2),
  `#475569` (1) — five greys for one role.
- Borders: `#e2e8f0` (18), `#cbd5e1` (7), `#d1d5db` (4), `#000000` (31).
- Danger/warning/success each have 3–4 near-duplicate shades.

**Spacing** — no scale. Values 1–48 appear ad hoc; paddings include `"9px 14px"`,
`"9px 12px"`, `"6px 14px"`, `"1px 8px"`, `"10px 10px"`, `"8px 8px"` — several
differing by a single pixel from a neighbour with no semantic reason.

**Borders** — widths 1/2/3px and radii 4/6/12px chosen per-site.

**Cards / decoration** — the default and risk_survey branches use web-app styling
(`borderRadius: 12`, `shadow-glow`-adjacent gradients, rounded photo cards) that
reads as UI rather than as an engineering document, and sits oddly next to the
two statutory form branches.

**RTL** — the root is correctly `<html lang="he" dir="rtl">` (index.html:2) and
each branch root repeats `dir="rtl" lang="he"`. But `direction: "rtl"` is then
re-declared **20+ times** on descendants that already inherit it (:191, :307,
:375, :420, :451, :457, :506, :520, :655, :683, :738, :754, :790, :820, :937,
:1180, :1204, :1442, :1463). `unicodeBidi: "plaintext"` is applied correctly but
inconsistently — only in element_stability (:482, :496, :512), although the same
mixed Hebrew/number/latin content occurs in every branch. No `dir="ltr"` is used
anywhere, so emails, URLs and phone numbers rely on implicit bidi.

**Page breaks** — usage is uneven. `data-pdf-no-break` appears in every branch,
but `data-pdf-page-break` only in Form 8, welfare, education and general_safety.
`element_stability` and `risk_survey` have no explicit page structure at all.
Two blocks (:1482, :1524) use only the inert `pageBreakInside` and therefore have
**no** break protection.

**Page footers** — the generator supports exactly one `data-pdf-page-footer`
(`querySelector`, first match). Only Form 8 and element_stability use it. The
welfare ministry footer is instead repeated manually per page section, which is
why it is a normal in-flow element rather than a stamped one.

**Page numbers** — only risk_survey opts in. The other six types produce PDFs
with no page numbering, including the multi-page statutory forms where it matters
most.

**Cover pages** — only the default branch has a true cover page. The other five
open directly onto content.

**Images** — no shared sizing rule. Photo containers are variously `height: 210`
fixed (risk_survey :585), `maxHeight` constrained (signatures), or unconstrained
(welfare appendix). Aspect ratio is generally respected via `objectFit:"contain"`,
but this is re-specified per site rather than guaranteed.

**Tables** — two incompatible implementations (CSS grid vs `<table>`). Neither
can repeat headers across pages (architecturally impossible here). Long tables
are protected only by per-row `data-pdf-no-break`, which works but is applied
inconsistently.

**Dead code** — three declared-but-undefined selectors: `.report-preview`
(PrintableReport.tsx:1254), `.pdf-scale-wrapper` (ReportEditor.tsx:1824),
`[data-pdf-content]` (ReportEditor.tsx:1823). Plus the stale `@media print`
comment (ReportEditor.tsx:1907) and an unused `statusLabel` export
(`src/lib/pdf.ts:15`).

---

## 4. What must not change

The following are load-bearing and out of scope for a design refactor:

- `SurveyReport` (100 fields) and `ChecklistItem` in `src/lib/types.ts`
- Persistence: `storage.ts`, `reports-remote.ts`, `offline-db.ts`, `sync-engine.ts`
- Auth/permissions: `auth.ts`, `AuthContext`, `supabase.ts`
- All editor form fields, calculations and validation in `ReportEditor.tsx`
- `form8-calc.ts` regulatory formulas
- Static data: `form8-data.ts`, `edu-inspection-table.ts`, `standards-*`
- Brand assets: all `*-banner.ts`, `welfare-logos.ts` (never redraw the logo)
- The `pdf-generate.ts` slicing algorithm and `PAGE_H` derivation
- welfare_inspection and accessibility_form_8 **geometry** (statutory fidelity)

---

## 5. What was built

### 5.1 New modules

| Path | Purpose |
| --- | --- |
| `src/reporting/design-system/tokens.ts` | Page geometry, type scale, colour roles, spacing scale, borders, image rules |
| `src/reporting/design-system/primitives.tsx` | Shared document components + the pagination contract |
| `src/reporting/design-system/index.ts` | Single import surface |
| `src/reporting/fixtures.ts` | short/normal/stress sample reports for all 7 types |
| `src/reporting/fixtures.test.ts` | Smoke tests over the fixtures |
| `.claude/skills/report-design-system/SKILL.md` | Rules for future work |

### 5.2 Verification method

Because there is no automated PDF test (jsdom has no canvas backend), a
baseline of **21 real PDFs** (7 types × 3 data sizes) was captured from a
headless Chromium *before* any source change. After each migration step the
same 21 were regenerated and diffed page-by-page (page count, page size,
per-pixel delta above an anti-aliasing tolerance).

That baseline is what makes this refactor safe. It caught a real regression
(§5.4), and it also caught a false alarm worth noting: one fixture reported a
1 → 5 page jump that turned out to be the capture harness picking up a stray
in-flight download from an earlier interrupted run, not a rendering change.
Re-running it cleanly gave 0.00%. A structural diff is a prompt to investigate,
not a verdict on its own — confirm the artefact before believing it.

### 5.3 Migration status

Measured against the baseline, all three data sizes per type:

| Report type | Migration | Measured vs baseline |
| --- | --- | --- |
| `accessibility_form_8` | Shell + checkbox dedup, statutory geometry untouched | **0.00% — identical** |
| `welfare_inspection` | Shell + `FormLine`/checkbox dedup, statutory geometry untouched | **0.00% — identical** |
| `element_stability` | Shared shell | **0.00% — identical** |
| `accessibility` | Shared shell | **0.00% — identical** |
| `general_safety` | Shared shell | **0.00% — identical** |
| `education_safety` | Full — tokens, primitives, pagination wrappers | re-spaced; page counts held |
| `risk_survey` | Full — tokens, primitives, pagination wrappers | re-spaced; page counts held |

**15 of 21 fixtures pixel-identical.** The 6 that changed are the two fully
migrated branches, whose spacing was deliberately normalised onto the token
scale; page counts held at every size and content was visually confirmed
present.

The three "shell only" branches keep their existing inline styles. This is a
deliberate stopping point, not an oversight: the design system and the
verification harness are in place, and those branches can be migrated
incrementally against the same baseline.

### 5.4 Regression caught by the baseline

The first version of `FormLine` set `unicodeBidi: "plaintext"` on the value.
That looked like an RTL improvement but broke the welfare form: `plaintext`
re-derives paragraph direction from the first strong character, so values
beginning with a digit or Latin letter (phone numbers, email addresses, ID
numbers) detached from their label and jumped to the far left end of the rule.

The pixel diff flagged it (0.12–0.70% on specific pages); the fix was to drop
the default and document when `plaintext` is and is not appropriate. After the
fix, welfare returned to 0.00% on all three sizes. The rule is recorded in
`SKILL.md`.

### 5.5 Duplication reduction

| Metric | Before | After |
| --- | --- | --- |
| Duplicated root shells | 6 | **1** (shared `ReportShell`) |
| Inline `style={{…}}` objects | 404 | 388 |
| Hex colour literals | 252 | 192 |
| `fontSize` literals | 147 | 114 |
| `padding` string literals | 95 | 68 |
| Checkbox implementations | 2 | **1** (parameterized) |
| Ruled-field implementations | 5 | **1** (`FormLine`) |
| Dead CSS selectors | 3 | **0** |

The remaining literals are concentrated in the four not-yet-fully-migrated
branches; the two fully-migrated branches draw everything from tokens.

### 5.6 Other fixes

- **Preview/PDF parity** — the preview dialog omitted the `croppedCoverPhoto`
  override the PDF applied, so the two disagreed. Both mounts now render one
  `printedReport` object.
- **Stale comment** — the `@media print` reference in `ReportEditor.tsx` was
  replaced with an accurate description of why the capture mount exists.
- **Colour bug** — the education_safety findings table header had a green
  border (`#166534`) left over from an older palette, on a blue header.
- **Dead selectors** — `.report-preview`, `.pdf-scale-wrapper` and
  `[data-pdf-content]` removed.

### 5.7 Known issues not addressed

- Fonts are loaded from Google Fonts only. Offline PDF generation silently
  falls back to `sans-serif` and changes every metric. Self-hosting Heebo would
  fix this; it is a behavioural change and was left out of a design refactor.
- Pre-existing type errors in `src/contexts/AuthContext.tsx`,
  `src/lib/matching.ts` (duplicate object key) and `src/pages/Index.tsx`.
  Unrelated to reports and left untouched.
- `npx tsc --noEmit` at the repo root type-checks **nothing** — the root
  `tsconfig.json` has `"files": []` and only project references. Use
  `npx tsc -p tsconfig.app.json --noEmit`. CI runs neither.
