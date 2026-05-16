import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check } from "lucide-react";

interface Props {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  consultantName?: string;
}

export function SignaturePad({ onSave, onCancel, consultantName }: Props) {
  const canvasRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    canvasRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (!canvasRef.current || isEmpty) return;
    const dataUrl = canvasRef.current.getTrimmedCanvas().toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <div>
        <p className="text-sm font-semibold mb-1">
          חתימה{consultantName ? ` — ${consultantName}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">חתום בתוך המסגרת</p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-white overflow-hidden" style={{ touchAction: "none" }}>
        <SignatureCanvas
          ref={canvasRef}
          penColor="#1e3a8a"
          canvasProps={{
            width: 320,
            height: 160,
            className: "w-full",
            style: { display: "block" },
          }}
          onBegin={() => setIsEmpty(false)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="gap-1.5"
        >
          <RotateCcw className="h-4 w-4" />
          נקה
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isEmpty}
          onClick={handleSave}
          className="flex-1 gap-1.5"
        >
          <Check className="h-4 w-4" />
          אשר חתימה
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </div>
  );
}
