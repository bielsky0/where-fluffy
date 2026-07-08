import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { ProfileListing } from '../types/profile.types';

const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
const CORAL = '#FF6B4A';

export interface ListingPatch {
  petName: string | null;
  speciesLabel: string;
}

interface EditListingPanelProps {
  listing: ProfileListing | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, patch: ListingPatch) => void;
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Flow 2's full-screen edit form — always mounted (never conditionally rendered) so the
// container itself can be the thing that slides in from `translate-x-full` to `translate-x-0`;
// unmounting it on close would mean re-mounting (and re-sliding-in from scratch) on every open
// instead of a single continuous transform. There is no `PATCH /pets/:id` endpoint on the
// backend (pets.routes.ts only exposes create + nearby list — see CLAUDE.md's PostGIS section
// for the raw-SQL gymnastics even the fields that *do* exist require), so `onSave` only patches
// ProfilePage's own local mock listing array — the same "local-only until a real endpoint
// exists" precedent as this module's mockProfileData.ts.
export function EditListingPanel({ listing, open, onClose, onSave }: EditListingPanelProps) {
  const [petName, setPetName] = useState('');
  const [speciesLabel, setSpeciesLabel] = useState('');

  useEffect(() => {
    if (!listing) return;
    setPetName(listing.petName ?? '');
    setSpeciesLabel(listing.speciesLabel);
  }, [listing]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!listing) return;
    onSave(listing.id, { petName: petName.trim() || null, speciesLabel: speciesLabel.trim() });
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
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED_GRAY }}>
            Imię zwierzaka (opcjonalnie)
          </span>
          <input
            value={petName}
            onChange={(event) => setPetName(event.target.value)}
            placeholder="np. Oreo"
            className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-neutral-400"
            style={{ borderColor: HAIRLINE_BORDER, color: ANTHRACITE }}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED_GRAY }}>
            Gatunek / opis
          </span>
          <input
            value={speciesLabel}
            onChange={(event) => setSpeciesLabel(event.target.value)}
            placeholder="np. Pies w typie Beagle"
            required
            className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-neutral-400"
            style={{ borderColor: HAIRLINE_BORDER, color: ANTHRACITE }}
          />
        </label>

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
