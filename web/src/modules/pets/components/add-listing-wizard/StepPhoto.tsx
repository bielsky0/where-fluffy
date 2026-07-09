import { useEffect, useRef, useState } from 'react';
import { Controller, type Control } from 'react-hook-form';
import type { AddListingWizardData } from '../../store/useAddListingWizardStore';

interface StepPhotoProps {
  control: Control<AddListingWizardData>;
}

// Step 2 — a photo helps other users recognize the pet but isn't required to file a report
// (see addListingWizard.schema.ts's stepPhotoSchema), so this step never blocks "Dalej".
export function StepPhoto({ control }: StepPhotoProps) {
  return (
    <Controller
      name="photo"
      control={control}
      render={({ field }) => <PhotoField file={field.value} onChange={field.onChange} />}
    />
  );
}

function PhotoField({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Derived from `file`, not persisted alongside it (see useAddListingWizardStore.ts's own
  // comment) — objectURLs must be revoked on every change or they leak, which is much easier to
  // get right scoped to this one effect than duplicated across every place `photo` is set.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Dodaj zdjęcie</h1>
        <p className="text-sm text-subtle">
          Dobre zdjęcie pomaga innym błyskawicznie rozpoznać zwierzaka. Ten krok jest opcjonalny.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />

      <div className="flex flex-1 items-start justify-center">
        {previewUrl ? (
          // "Hero" status once a photo exists — a large square image is the star of the step;
          // "Zmień" is the one prominent, coral-accented control in the corner, "✕" stays a
          // small neutral affordance so it doesn't compete with it for attention.
          <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-3xl shadow-sm">
            <img src={previewUrl} alt="Podgląd zdjęcia zwierzaka" className="size-full object-cover" />
            <button
              type="button"
              aria-label="Usuń zdjęcie"
              onClick={() => {
                onChange(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur-sm transition-colors hover:bg-white"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute right-3 top-3 rounded-full bg-coral px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-coral-hover"
            >
              Zmień
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-gray-300 bg-white text-subtle transition-colors hover:border-coral hover:text-coral"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-gray-100 text-3xl shadow-sm">
              📷
            </span>
            <span className="text-sm font-medium">Dodaj zdjęcie</span>
            <span className="text-xs text-subtle/80">Dotknij, aby wybrać z galerii</span>
          </button>
        )}
      </div>
    </div>
  );
}
