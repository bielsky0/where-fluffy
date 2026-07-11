import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, Reorder } from 'framer-motion';
import { toast } from 'sonner';
import { compressImage } from '@/modules/pets/lib/compressImage';
import type { Pet } from '@/modules/pets/types/pet.types';
import { useUpdatePet, type UpdatePetPayload } from '../api/useMyPets';

const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
const CORAL = '#FF6B4A';

interface EditListingPanelProps {
  pet: Pet | null;
  open: boolean;
  onClose: () => void;
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-6" aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="size-3.5" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="white" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

interface FloatingLabelInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}

// CSS-only floating label — a `peer` input plus a sibling label positioned via
// `peer-focus`/`peer-[:not(:placeholder-shown)]`, cheaper than animating a motion component per
// keystroke across 6 fields. `placeholder=" "` (a single space, not empty) is required for
// `:placeholder-shown` to behave as "field is empty", not "field has no placeholder attribute".
function FloatingLabelInput({ label, value, onChange, type = 'text', required }: FloatingLabelInputProps) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        placeholder=" "
        className="peer w-full rounded-2xl border px-4 pb-2.5 pt-6 text-sm outline-none focus:border-neutral-400"
        style={{ borderColor: HAIRLINE_BORDER, color: ANTHRACITE }}
      />
      <span
        className="pointer-events-none absolute left-4 top-4 text-sm transition-all duration-150 peer-focus:top-2 peer-focus:text-[11px] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px]"
        style={{ color: MUTED_GRAY }}
      >
        {label}
      </span>
    </div>
  );
}

// Flow 3's full-screen edit form — always mounted (never conditionally rendered) so the
// container itself can be the thing that slides in from `translate-x-full` to `translate-x-0`;
// unmounting it on close would mean re-mounting (and re-sliding-in from scratch) on every open
// instead of a single continuous transform. Takes the full `Pet` (not the thin ProfileListing
// view-model) — it edits the real UpdatePetDTO field set, most of which ProfileListing doesn't
// carry.
export function EditListingPanel({ pet, open, onClose }: EditListingPanelProps) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [distinguishingMarks, setDistinguishingMarks] = useState('');
  const [reward, setReward] = useState('0');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updatePet = useUpdatePet();

  useEffect(() => {
    if (!pet) return;
    setName(pet.name ?? '');
    setSpecies(pet.species);
    setDistinguishingMarks(pet.distinguishingMarks ?? '');
    setReward(String(pet.reward));
    setPhone(pet.phone ?? '');
    setEmail(pet.email ?? '');
    setPhotoUrls(pet.photoUrls);
  }, [pet]);

  const handleAddPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    try {
      const compressed: string[] = [];
      for (const file of Array.from(files)) {
        compressed.push(await compressImage(file));
      }
      setPhotoUrls((prev) => [...prev, ...compressed]);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemovePhoto = (url: string) => {
    setPhotoUrls((prev) => prev.filter((entry) => entry !== url));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!pet) return;

    const patch: UpdatePetPayload['patch'] = {
      name: name.trim() || undefined,
      species: species.trim(),
      distinguishingMarks: distinguishingMarks.trim() || undefined,
      reward: Number(reward) || 0,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      photoBase64s: photoUrls,
    };

    // "Aktualizujemy inteligentny radar..." → success/error — this is the moment the AI worker
    // re-embeds name/species/distinguishingMarks (see pets.service.ts's updatePet, which only
    // re-enqueues when one of those actually changed). Deliberately NOT sonner's toast.promise:
    // it does `promise instanceof Promise` internally, but this app's zone.js (OpenTelemetry
    // context propagation, see App.tsx) replaces the global Promise constructor, so a native
    // fetch-derived promise fails that check and sonner tries to call it as a function instead
    // — a real "e is not a function" crash observed when wired that way. toast.loading/success/
    // error with a shared id sidesteps the check entirely and morphs the same toast in place,
    // same visual result.
    const toastId = toast.loading('Aktualizujemy inteligentny radar...');
    updatePet.mutate(
      { petId: pet.id, patch },
      {
        onSuccess: () => toast.success('Profil zaktualizowany', { id: toastId }),
        onError: () => toast.error('Nie udało się zapisać zmian', { id: toastId }),
      },
    );
    onClose();
  };

  return (
    <motion.div
      initial={false}
      animate={{ x: open ? '0%' : '100%' }}
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 z-[1300] flex flex-col bg-white"
      aria-hidden={!open}
    >
      <div className="flex shrink-0 items-center gap-3 border-b px-4 pb-4 pt-safe" style={{ borderColor: HAIRLINE_BORDER, paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Anuluj edycję"
          className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-[#222222]"
        >
          <BackArrowIcon />
        </button>
        <h2 className="text-lg font-bold" style={{ color: ANTHRACITE }}>
          Edytuj zgłoszenie
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED_GRAY }}>
            Zdjęcia
          </span>
          <Reorder.Group
            axis="x"
            values={photoUrls}
            onReorder={setPhotoUrls}
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {photoUrls.map((url) => (
              <Reorder.Item
                key={url}
                value={url}
                className="relative size-20 shrink-0 cursor-grab active:cursor-grabbing"
              >
                <img src={url} alt="" className="size-20 rounded-2xl object-cover" draggable={false} />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(url)}
                  aria-label="Usuń zdjęcie"
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black/70"
                >
                  <RemoveIcon />
                </button>
              </Reorder.Item>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="flex size-20 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed text-neutral-300 disabled:opacity-50"
              style={{ borderColor: HAIRLINE_BORDER }}
            >
              <PlusIcon />
            </button>
          </Reorder.Group>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void handleAddPhotos(event.target.files)}
          />
          <p className="text-[11px]" style={{ color: MUTED_GRAY }}>
            Przeciągnij, aby zmienić kolejność — pierwsze zdjęcie jest zdjęciem głównym.
          </p>
        </div>

        <FloatingLabelInput label="Imię zwierzaka (opcjonalnie)" value={name} onChange={setName} />
        <FloatingLabelInput label="Gatunek / opis" value={species} onChange={setSpecies} required />
        <FloatingLabelInput label="Znaki szczególne" value={distinguishingMarks} onChange={setDistinguishingMarks} />
        <FloatingLabelInput label="Nagroda (zł)" value={reward} onChange={setReward} type="number" />
        <FloatingLabelInput label="Telefon" value={phone} onChange={setPhone} />
        <FloatingLabelInput label="E-mail" value={email} onChange={setEmail} type="email" />

        <div className="mt-auto flex flex-col gap-3 pb-safe">
          <button
            type="submit"
            className="rounded-full px-5 py-3.5 text-sm font-bold text-white transition-transform active:scale-95"
            style={{ backgroundColor: CORAL, boxShadow: `0 6px 18px -6px ${CORAL}99` }}
          >
            Zapisz zmiany
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-3 text-sm font-semibold"
            style={{ color: MUTED_GRAY }}
          >
            Anuluj
          </button>
        </div>
      </form>
    </motion.div>
  );
}
