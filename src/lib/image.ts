/**
 * Convert a File (image) into a downscaled JPEG dataURL for storage.
 *
 * Sized for the PDF, not the screen: report photos are rasterized at up to
 * 2.5x by the PDF generator, so a photo shown ~350px wide needs ~900 device px.
 * 2000px on the long edge covers full-width photos with headroom, and q=0.90
 * avoids the visible JPEG ringing that q=0.82 left in flat areas like walls
 * and sky. Only affects newly added photos — existing ones keep their
 * original encoding.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxDim = 2000,
  quality = 0.9,
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

/**
 * Rotate an image dataURL by a multiple of 90° (canvas-based, no dependency).
 * Used to fix photos that display sideways/upside-down.
 */
export function rotateImageDataUrl(src: string, degrees: 90 | -90 | 180): Promise<string> {
  return loadImage(src).then((img) => {
    const canvas = document.createElement("canvas");
    const swap = degrees === 90 || degrees === -90;
    canvas.width = swap ? img.naturalHeight : img.naturalWidth;
    canvas.height = swap ? img.naturalWidth : img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
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
