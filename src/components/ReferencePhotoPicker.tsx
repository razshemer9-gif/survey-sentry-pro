import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search } from "lucide-react";
import { fileToCompressedDataUrl } from "@/lib/image";
import { ReferencePhotoEntry } from "@/lib/types";
import { v4 as uuid } from "uuid";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (photo: string, label: string) => void;
  // Global photos from standards library
  globalPhotos: { label: string; photo: string }[];
  // User's personal library
  personalPhotos: ReferencePhotoEntry[];
  onAddPersonal: (entry: ReferencePhotoEntry) => void;
  onDeletePersonal: (id: string) => void;
}

export function ReferencePhotoPicker({
  open, onClose, onSelect, globalPhotos, personalPhotos, onAddPersonal, onDeletePersonal,
}: Props) {
  const [search, setSearch] = useState("");
  const [addingLabel, setAddingLabel] = useState("");
  const [addingPhoto, setAddingPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredGlobal = globalPhotos.filter((p) =>
    !search || p.label.includes(search)
  );
  const filteredPersonal = personalPhotos.filter((p) =>
    !search || p.label.includes(search)
  );

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    const dataUrl = await fileToCompressedDataUrl(file);
    setAddingPhoto(dataUrl);
  };

  const handleSavePersonal = () => {
    if (!addingPhoto) return;
    const entry: ReferencePhotoEntry = {
      id: uuid(),
      label: addingLabel || "תמונת פרט",
      photo: addingPhoto,
    };
    onAddPersonal(entry);
    setAddingPhoto(null);
    setAddingLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg flex flex-col gap-0 p-0" dir="rtl">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle>בחר תמונת פרט</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="חיפוש..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-4">
          {/* Personal library */}
          <div>
            <p className="text-xs font-semibold text-primary mb-2">הספרייה שלי</p>
            <div className="grid grid-cols-3 gap-2">
              {filteredPersonal.map((p) => (
                <div key={p.id} className="relative group">
                  <button
                    className="w-full rounded-xl overflow-hidden border-2 border-transparent hover:border-primary transition-all"
                    onClick={() => { onSelect(p.photo, p.label); onClose(); }}
                  >
                    <img src={p.photo} alt={p.label} className="w-full aspect-square object-cover" />
                    <p className="text-[10px] text-center py-1 truncate px-1">{p.label}</p>
                  </button>
                  <button
                    onClick={() => onDeletePersonal(p.id)}
                    className="absolute top-1 left-1 h-5 w-5 rounded-full bg-destructive/90 text-white hidden group-hover:flex items-center justify-center"
                    aria-label={`מחק ${p.label}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Add new personal photo */}
              {!addingPhoto ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-1 text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[10px]">הוסף תמונה</span>
                </button>
              ) : (
                <div className="col-span-3 rounded-xl border border-border p-3 space-y-2">
                  <img src={addingPhoto} alt="" className="w-full max-h-32 object-contain rounded-lg" />
                  <Input
                    placeholder="שם הפרט..."
                    value={addingLabel}
                    onChange={(e) => setAddingLabel(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={handleSavePersonal}>שמור לספרייה</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddingPhoto(null); setAddingLabel(""); }}>ביטול</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Global photos from standards library */}
          {filteredGlobal.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">מאגר ת"י 1918</p>
              <div className="grid grid-cols-3 gap-2">
                {filteredGlobal.map((p, i) => (
                  <button
                    key={i}
                    className="w-full rounded-xl overflow-hidden border-2 border-transparent hover:border-primary transition-all"
                    onClick={() => { onSelect(p.photo, p.label); onClose(); }}
                  >
                    <img src={p.photo} alt={p.label} className="w-full aspect-square object-cover" />
                    <p className="text-[10px] text-center py-1 truncate px-1">{p.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredGlobal.length === 0 && filteredPersonal.length === 0 && !addingPhoto && (
            <p className="text-center text-sm text-muted-foreground py-8">אין תמונות פרט זמינות עדיין</p>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />
      </DialogContent>
    </Dialog>
  );
}
