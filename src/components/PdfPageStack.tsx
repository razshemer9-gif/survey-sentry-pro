/**
 * The generated report, shown as one continuous sheet.
 *
 * The pages are separate images — that is how they come out of the
 * rasterizer — but they are shown butted together, because a dark band
 * between them reads as the document being torn: a section that happens to
 * span a page boundary looks cut in half on screen while the PDF itself is
 * whole. That is what was reported as "הכל חתוך".
 *
 * `block` is load-bearing. An <img> is inline by default, and the baseline
 * gap under each one would put a white line back between every page.
 */
export function PdfPageStack({ pages }: { pages: string[] }) {
  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-lg bg-white shadow-pop">
      {pages.map((src, i) => (
        <img key={i} src={src} alt={`עמוד ${i + 1}`} className="block w-full" />
      ))}
    </div>
  );
}
