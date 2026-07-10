import { useRef, useState } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { compressImage } from '../../lib/compressImage';
import type { AddListingWizardData } from '../../store/useAddListingWizardStore';

interface StepPhotoProps {
  control: Control<AddListingWizardData>;
}

// Step 2 — a gallery of photos. At least one is mandatory for both paths (V2 spec: no report
// without visual documentation) — see addListingWizard.schema.ts's stepPhotoSchema, which blocks
// "Dalej" until `photos.length >= 1`.
export function StepPhoto({ control }: StepPhotoProps) {
  return (
    <Controller
      name="photos"
      control={control}
      render={({ field }) => <PhotoGalleryField photos={field.value} onChange={field.onChange} />}
    />
  );
}

function PhotoGalleryField({ photos, onChange }: { photos: string[]; onChange: (value: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    try {
      // Sequential, not Promise.all — compressImage's canvas decode/draw is CPU-bound, so
      // compressing several large photos concurrently risks janking the main thread all at once.
      // Selection order is preserved either way.
      const compressed: string[] = [];
      for (const file of Array.from(files)) {
        compressed.push(await compressImage(file));
      }
      onChange([...photos, ...compressed]);
    } finally {
      setIsCompressing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = (index: number) => onChange(photos.filter((_, i) => i !== index));

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Dodaj zdjęcia</h1>
        <p className="text-sm text-subtle">
          Dodaj co najmniej jedno zdjęcie — pomaga innym błyskawicznie rozpoznać zwierzaka.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void handleFilesSelected(event.target.files)}
      />

      <div className="grid grid-cols-3 gap-3">
        {photos.map((photo, index) => (
          <div key={index} className="relative aspect-square overflow-hidden rounded-2xl shadow-sm">
            <img src={photo} alt={`Zdjęcie zwierzaka ${index + 1}`} className="size-full object-cover" />
            <button
              type="button"
              aria-label="Usuń zdjęcie"
              onClick={() => removeAt(index)}
              className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-white/90 text-xs text-ink shadow-md backdrop-blur-sm transition-colors hover:bg-white"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isCompressing}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-300 bg-white text-subtle transition-colors hover:border-coral hover:text-coral disabled:opacity-60"
        >
          <span className="text-2xl">{isCompressing ? '⏳' : '＋'}</span>
          <span className="text-[11px] font-medium">{isCompressing ? 'Przetwarzanie…' : 'Dodaj'}</span>
        </button>
      </div>
    </div>
  );
}
