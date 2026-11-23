/**
 * Reading and writing .xlsx, with no spreadsheet library.
 *
 * An .xlsx is a ZIP of XML, and JSZip is already a dependency of this app,
 * so the whole format costs us a file rather than a megabyte of vendor code
 * on a phone. What is implemented here is only what a schedule needs: the
 * cells of a sheet as text, and a sheet written back out. No formulas, no
 * formatting, no charts.
 *
 * The awkward part of the format is that a cell holding 23/11/2026 can be
 * any of three things — a shared string, an inline string, or the number
 * 46364 wearing a date format — and only the last of those needs styles.xml
 * to be read before it can be understood. All three are handled, because a
 * schedule exported from Excel uses real dates and the same schedule saved
 * from Google Sheets or pasted from WhatsApp often does not.
 */

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/** Built-in number formats that mean "this number is a date". */
const DATE_BUILTINS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

/**
 * Every descendant with this tag.
 *
 * By namespace first, because that is what the format specifies; by plain
 * tag name as a fallback, because a workbook written by a tool that left the
 * namespace off still opens in Excel and so has to open here.
 */
function all(root: Document | Element, tag: string): Element[] {
  const byNs = Array.from(root.getElementsByTagNameNS(MAIN_NS, tag));
  if (byNs.length) return byNs;
  return Array.from(root.getElementsByTagName(tag));
}

/** "BC12" → 54. Column letters are base-26 with no zero. */
export function columnIndex(ref: string): number {
  const letters = (ref.match(/^[A-Z]+/i) ?? [""])[0].toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 0 → "A", 26 → "AA". */
export function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/**
 * An Excel date serial as "YYYY-MM-DD".
 *
 * Day 1 is 1 January 1900, and the format deliberately contains a 29th of
 * February 1900 that never happened — a bug Lotus 1-2-3 shipped and Excel
 * kept for compatibility. Serials above 59 are therefore one day ahead of a
 * true count, which is what the 86400 * (serial - 25569) shift corrects.
 */
export function serialToISO(serial: number): string {
  // Below 60 the phantom day has not been reached yet, so those serials are
  // a true day count and need the shift undone.
  const corrected = serial < 60 ? serial + 1 : serial;
  const ms = Math.round((corrected - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Which cell-format indexes carry a date format, from styles.xml. */
function dateStyles(stylesXml: string | null): Set<number> {
  const dates = new Set<number>();
  if (!stylesXml) return dates;
  const doc = parseXml(stylesXml);

  // Custom formats count as dates when their code mentions days or years.
  const custom = new Map<number, string>();
  for (const fmt of all(doc, "numFmt")) {
    const id = Number(fmt.getAttribute("numFmtId"));
    const code = fmt.getAttribute("formatCode") ?? "";
    if (!Number.isNaN(id)) custom.set(id, code);
  }

  const cellXfs = all(doc, "cellXfs")[0];
  if (!cellXfs) return dates;
  const xfs = all(cellXfs, "xf");
  xfs.forEach((xf, i) => {
    const id = Number(xf.getAttribute("numFmtId") ?? "0");
    if (DATE_BUILTINS.has(id)) { dates.add(i); return; }
    const code = custom.get(id);
    // Strip quoted literals so a format like "yes";"no" is not read as a year.
    if (code && /[dy]/i.test(code.replace(/"[^"]*"/g, ""))) dates.add(i);
  });
  return dates;
}

function sharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const doc = parseXml(xml);
  return all(doc, "si").map((si) => {
    // A run-formatted string is several <t> under <r>; joined, it is the text.
    const parts = all(si, "t");
    return parts.map((t) => t.textContent ?? "").join("");
  });
}

export type Sheet = { name: string; rows: string[][] };

/**
 * Every sheet of a workbook, as rows of trimmed text.
 *
 * Ragged rows are padded, because a schedule whose last column is blank on
 * some lines would otherwise shift those lines' cells left by one and match
 * the wrong column.
 */
export async function readWorkbook(data: ArrayBuffer | Uint8Array): Promise<Sheet[]> {
  const JSZip = (await import("jszip")).default;
  // Built here rather than taken as given: a typed array from another realm
  // (a test's Node buffer against the page's jsdom globals) fails JSZip's
  // instanceof check and is rejected as an unsupported type.
  const bytes = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);
  const zip = await JSZip.loadAsync(bytes);

  const read = async (path: string): Promise<string | null> => {
    const file = zip.file(path);
    return file ? file.async("string") : null;
  };

  const workbookXml = await read("xl/workbook.xml");
  if (!workbookXml) throw new Error("הקובץ אינו קובץ אקסל תקין.");

  const relsXml = await read("xl/_rels/workbook.xml.rels");
  const targets = new Map<string, string>();
  if (relsXml) {
    const relsDoc = parseXml(relsXml);
    for (const rel of Array.from(relsDoc.getElementsByTagName("Relationship"))) {
      targets.set(rel.getAttribute("Id") ?? "", rel.getAttribute("Target") ?? "");
    }
  }

  const strings = sharedStrings(await read("xl/sharedStrings.xml"));
  const dateFormats = dateStyles(await read("xl/styles.xml"));

  const sheets: Sheet[] = [];
  const workbook = parseXml(workbookXml);
  const entries = all(workbook, "sheet");

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const name = entry.getAttribute("name") ?? `גיליון ${i + 1}`;
    const rid = entry.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id",
    ) ?? entry.getAttribute("r:id") ?? "";
    let target = targets.get(rid) ?? `worksheets/sheet${i + 1}.xml`;
    target = target.replace(/^\/?xl\//, "").replace(/^\//, "");
    const sheetXml = await read(`xl/${target}`);
    if (!sheetXml) continue;
    sheets.push({ name, rows: sheetRows(sheetXml, strings, dateFormats) });
  }
  return sheets;
}

function sheetRows(xml: string, strings: string[], dateFormats: Set<number>): string[][] {
  const doc = parseXml(xml);
  const rows: string[][] = [];
  let widest = 0;

  for (const row of all(doc, "row")) {
    const cells: string[] = [];
    for (const c of all(row, "c")) {
      const at = columnIndex(c.getAttribute("r") ?? "");
      const index = at >= 0 ? at : cells.length;
      while (cells.length < index) cells.push("");
      cells.push(cellText(c, strings, dateFormats));
    }
    widest = Math.max(widest, cells.length);
    rows.push(cells);
  }

  for (const row of rows) while (row.length < widest) row.push("");
  return rows;
}

function cellText(c: Element, strings: string[], dateFormats: Set<number>): string {
  const type = c.getAttribute("t") ?? "n";

  if (type === "inlineStr") {
    const is = all(c, "is")[0];
    if (!is) return "";
    return all(is, "t").map((t) => t.textContent ?? "").join("").trim();
  }

  const v = all(c, "v")[0];
  const raw = (v?.textContent ?? "").trim();
  if (!raw) return "";

  if (type === "s") {
    const i = Number(raw);
    return (strings[i] ?? "").trim();
  }
  if (type === "str" || type === "e") return raw;
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";

  // A plain number — a date only if its cell format says so.
  const style = Number(c.getAttribute("s") ?? "-1");
  const n = Number(raw);
  if (!Number.isNaN(n) && dateFormats.has(style)) {
    const iso = serialToISO(n);
    if (iso) return iso;
  }
  return raw;
}

// ── Writing ──────────────────────────────────────────────────

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Excel rejects a file containing control characters, and a pasted
    // schedule can carry them; they are dropped rather than escaped.
    // eslint-disable-next-line no-control-regex -- the point is to remove exactly these
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/**
 * Rows written as a one-sheet workbook.
 *
 * Every cell goes out as an inline string, numbers included. A timesheet is
 * read, not recalculated, and "3:30" kept as text is "3:30" in every locale,
 * where a number would become 0.1458 or a date in 1900 depending on whose
 * Excel opened it.
 */
export async function writeSheet(sheetName: string, rows: string[][]): Promise<Uint8Array> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const body = rows.map((cells, r) => {
    const tags = cells.map((value, c) => {
      const text = value ?? "";
      if (!text) return "";
      return `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${tags}</row>`;
  }).join("");

  zip.file("[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`);

  zip.file("_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`);

  zip.file("xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="${MAIN_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${xmlEscape(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`);

  zip.file("xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`);

  zip.file("xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="${MAIN_NS}"><sheetData>${body}</sheetData></worksheet>`);

  return zip.generateAsync({ type: "uint8array" });
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Hand a built file to the browser to save. */
export function downloadSheet(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
