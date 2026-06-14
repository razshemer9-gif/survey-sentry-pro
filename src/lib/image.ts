/**
 * Convert a File (image) into a downscaled JPEG dataURL for storage.
 * Keeps localStorage small and PDF generation snappy.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<string> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function cropImageDataUrl(src: string, w: number, h: number): Promise<string> {
  return loadImage(src).then((img) => {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = img.naturalWidth * scale, sh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
    return canvas.toDataURL("image/jpeg", 0.88);
  });
}

export function formatHebrewDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n || 0);
}
