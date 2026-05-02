import { useRef } from "react";
import { Camera, Upload, X } from "lucide-react";
import { fileToCompressedDataUrl } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  className?: string;
  label?: string;
  aspect?: "video" | "square";
}

export function PhotoPicker({ value, onChange, className, label = "הוסף תמונה", aspect = "video" }: Props) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  async function handle(file?: File | null) {
    if (!file) return;
    const url = await fileToCompressedDataUrl(file);
    onChange(url);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className={cn("relative w-full overflow-hidden rounded-2xl border border-border bg-muted", aspect === "video" ? "aspect-video" : "aspect-square")}>
          <img src={value} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-2 left-2 grid h-9 w-9 place-items-center rounded-full bg-background/90 text-foreground shadow-elev"
            aria-label="הסר תמונה"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className={cn("grid w-full place-items-center rounded-2xl border-2 border-dashed border-border bg-primary-soft/40 text-muted-foreground", aspect === "video" ? "aspect-video" : "aspect-square")}>
          <span className="text-sm">{label}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={() => camRef.current?.click()} className="gap-2">
          <Camera className="h-4 w-4" />
          מצלמה
        </Button>
        <Button type="button" variant="outline" onClick={() => galRef.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" />
          גלריה
        </Button>
      </div>

      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
}
