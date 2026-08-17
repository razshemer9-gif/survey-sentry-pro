---
name: report-design-system
description: Rules for building and changing generated PDF reports in this repo. Use whenever touching src/components/PrintableReport.tsx, src/lib/pdf-generate.ts, src/reporting/**, adding a new report type, or changing any report's layout, styling, pagination, images, tables, signatures or RTL behaviour.
---

# Report design system

All generated reports share one visual language. This file is the contract.
Read it before changing anything under `src/reporting/`,
`src/components/PrintableReport.tsx`, or `src/lib/pdf-generate.ts`.

## The one thing to understand first

**This is a rasterization pipeline, not a print pipeline.**

```
SurveyReport  →  PrintableReport (React, inline styles)  →  html2canvas
                                                              ↓
                            jsPDF slices the bitmap into pages → Blob download
```

Therefore:

- **`@page`, `@media print`, `break-inside`, `break-before/after` and
  `page-break-*` do NOTHING.** html2canvas never consults them. Do not add a
  print stylesheet; it will silently have no effect.
- **PDF text is not selectable.** Everything except page numbers is an image.
  This is deliberate: jsPDF's core fonts have no Hebrew glyphs, so rasterizing
  is the only way to get correct Hebrew shaping and RTL.
- **`<thead>` cannot repeat across pages.** That is a CSS-fragmentation feature
  and is unavailable here. Long tables paginate by row instead (see Tables).

## Architecture

| Path | Role |
| --- | --- |
| `src/reporting/design-system/tokens.ts` | All page, type, colour, spacing, border, image values |
| `src/reporting/design-system/primitives.tsx` | Shared document components + the pagination contract |
| `src/reporting/design-system/index.ts` | Single import surface |
| `src/reporting/fixtures.ts` | short/normal/stress sample reports for visual QA |
| `src/components/PrintableReport.tsx` | One branch per report type; composes primitives |
| `src/lib/pdf-generate.ts` | The slicer. Rarely needs changing — be very careful |

Import from the barrel:

```ts
import { ReportShell, Section, KeepTogether, color, type, space } from "@/reporting/design-system";
```

## The three government-template reports (read this first)

`accessibility_form_8`, `welfare_inspection` and `education_safety` reproduce
**fixed government templates**. They are explicitly **exempt** from the company
visual template that the other report types follow.

For these three:

- **Do not restyle them.** No spacing normalisation onto the token scale, no
  font-size changes, no colour "corrections", no radius/border tweaks. Their
  measurements are a fidelity requirement, not a style choice.
- They may adopt shared components **only** where the result is provably
  pixel-identical (e.g. `ReportShell`, which emits the same markup).
- Any change to them must be verified as **0.00% pixel diff** against a
  baseline PDF before it is committed.
- Improving *raster quality* (resolution, JPEG quality) is fine and welcome —
  that sharpens the same layout without altering it.

This has been got wrong once: `education_safety` was migrated to the token
scale, which silently re-spaced a statutory document. It was reverted to be
byte-identical. If you find yourself editing spacing in one of these three
branches, stop.

## Shared vs report-specific

The design system owns the **visual language**. Each report owns its **layout**.

| Design system decides | Report branch decides |
| --- | --- |
| Font family and size scale | Which sections exist and in what order |
| Colour roles | Its own page structure |
| Spacing scale | Table column layout |
| Page width, RTL, language | Which metadata to show |
| Pagination primitives | Where page breaks belong |
| Image and signature behaviour | Cover/banner choice |

Reports must be **consistent, not identical**. A statutory government form and a
photo survey legitimately look different. They must still draw every colour,
size and spacing value from the tokens.

## Page rules

- Width is fixed at `page.width` (794px = A4 @ 96 DPI). Never hardcode `794`.
- **Page height is NOT A4.** The slicer derives `PAGE_H` from html2canvas
  canvas-size ceilings. `page.a4Height` exists for reference only.
- **Never cap slice height to A4.** This was tried and it broke every report;
  it was reverted on explicit instruction. Do not reintroduce it.

## Pagination — the only mechanism that works

Use these primitives. Never hand-write the `data-pdf-*` attributes.

| Primitive | Effect |
| --- | --- |
| `<KeepTogether>` | Block is never split across pages. Overflows its own page if taller than one page. |
| `<PageBreak />` | Forces a new page to start here. Renders nothing. |
| `<PageFooter>` | Captured once, stamped on every page. **Only one per report** — the generator reads the first match only. |
| `pageNumbers` prop on `<ReportShell>` | Digits-only `"N / M"` stamp. Digits only, because jsPDF has no Hebrew glyphs. |

Rules:

- Wrap every finding card, signature block, table row group and photo cell in
  `<KeepTogether>` so it cannot be cut in half.
- A heading must never be the last thing on a page. Keep it together with the
  block that follows it.
- Content must **flow to more pages**. Never fix an overflow by hiding,
  truncating or `overflow: hidden` on report content.

## Tables

- Wrap **each row** in `<KeepTogether>`, not the whole table — otherwise a long
  table becomes one oversized unbreakable block that overflows.
- Headers cannot repeat on later pages (architecturally impossible). If a table
  is long enough that this matters, break it into explicit sections with
  `<PageBreak />` and repeat the header yourself.
- Never let a table silently lose rows. Test at 1, 5, 20 and 50+ rows.
- Long Hebrew cell text must wrap, not clip. Numbers, URLs and measurements in a
  cell need `unicodeBidi: "plaintext"`.

## Images

- Always use `<ImageFrame>`. It fixes the box height and uses
  `objectFit: "contain"`, so aspect ratio is never altered and a tall photo
  cannot blow out pagination.
- Never set both `width: 100%` and `height: 100%` on a photo.
- Captions go in `<ImageCaption>`; keep caption and image inside one
  `<KeepTogether>`.
- Never replace, recolour or redraw the company logo or the statutory ministry
  logos in `src/lib/welfare-logos.ts` and the `*-banner.ts` files.

## Hebrew / RTL

- The document root is already `dir="rtl" lang="he"` — set by `<ReportShell>`
  and by `index.html`. **Do not re-declare `direction: "rtl"` on descendants.**
  It inherits.
- **`unicodeBidi: "plaintext"` is a scalpel, not a default.** It re-derives
  paragraph direction from the value's first strong character. That is what you
  want for a short **inline** or **centred** run whose glyphs would otherwise
  reorder (a range label like `"600–1,000"` reversing to `"1,000–600"`).

  It is actively **wrong** on:
  - **Ruled form fields.** A phone number or email starting with a digit/Latin
    letter gets LTR paragraph direction and jumps to the far *left* end of the
    rule, detaching from its label. `FormLine` therefore does not set it —
    the default bidi algorithm already renders those runs correctly inside the
    inherited RTL context. (This regression was shipped once and caught by
    visual diff against a baseline; don't reintroduce it.)
  - **Blocks of prose.** A paragraph that happens to begin with a number flips
    to left-aligned while its neighbours stay right-aligned.

  Rule of thumb: safe on centred and short inline runs; never on left/right
  aligned block text or anchored field values.
- Use explicit `dir="ltr"` only where a value is genuinely LTR as a whole (a
  bare URL or email on its own line). Do not wrap whole Hebrew paragraphs.
- Fonts are Heebo + Assistant from Google Fonts (`index.html`). They are
  **CDN-only**; if the network is unavailable the PDF silently falls back to
  `sans-serif` and every metric changes.

## Preview / PDF parity

`ReportEditor.tsx` renders **the same `PrintableReport` component twice**:

1. the visible preview dialog (CSS-scaled to 42%/60%), and
2. a hidden print mount (`position: fixed; top: 100vh`) that carries `printRef`
   and is what gets rasterized.

**Never create a second report renderer.** If the preview and the PDF disagree,
that is a bug in the props passed to one of the two mounts — fix the props, do
not fork the component.

The print mount must stay laid out and painted. Do not hide it with
`display: none`, `visibility: hidden` or `opacity: 0` — html2canvas needs real
geometry. `pdf-generate.ts` also mutates that mount's parent (`height`,
`overflow`) and the element's `marginTop` while slicing, so **each report
instance needs its own wrapper element**; two reports sharing a parent will
clip each other.

## Adding a new report type

1. Add the `SurveyType` and any report-specific fields to `src/lib/types.ts`.
2. Add its config to `SURVEY_TYPES` (label, pdfTitle, filePrefix, color).
3. Add a branch in `PrintableReport.tsx`, composing existing primitives.
4. Draw **every** value from tokens. If you need a value that isn't there,
   reuse the nearest role — only add a token if it is genuinely a new role.
5. Add a fixture case to `src/reporting/fixtures.ts` (short, normal, stress).
6. Generate real PDFs at all three sizes and look at them. Compiling is not
   verification.
7. Add editor fields in `ReportEditor.tsx` if the type needs them.

## Never do this

- Add a print stylesheet, `@page` rule or `break-*` property — inert here.
- Hardcode a hex colour, font size, padding or `794` in a report branch.
- Re-declare `direction: "rtl"` on a descendant.
- Create a second report renderer, or a preview-only component.
- Add a second `[data-pdf-page-footer]` — only the first is used.
- Cap the slice height to A4.
- **Touch the layout of the three government-template reports.** See below.
- Solve an overflow by hiding content.

## Verifying a change

There is no automated PDF test (jsdom has no canvas backend). Verify in a real
browser:

1. `npm run dev -- --port 8123 --host 127.0.0.1`
2. Launch headless Chromium with `--remote-debugging-port=9333 --remote-allow-origins=*`
3. Drive a route that renders the fixture and calls `generateReportPdf`, then
   `pdftoppm -png` the result and actually look at the pages.
4. Compare against the previous output before/after your change.

Always delete any temporary QA route and harness file before committing.
