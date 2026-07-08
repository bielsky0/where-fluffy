import { motion } from 'framer-motion';
import { formatRelativeTime } from '@/modules/pets/lib/format';
import type { ProfileListing } from '../types/profile.types';

const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
const SUCCESS_GREEN = '#22C55E';

interface ListingRowProps {
  listing: ProfileListing;
  onEdit: (id: string) => void;
  onResolve: (id: string) => void;
}

// Square monogram placeholder — same "letter-in-a-box" precedent as PetDetailPanel.tsx's
// HeroMonogram, standing in for the photo PetResponseDTO has no field for at all.
function ListingThumbnail({ listing }: { listing: ProfileListing }) {
  const initial = (listing.petName ?? listing.speciesLabel).charAt(0).toUpperCase();
  return (
    <div
      className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-2xl font-bold text-neutral-300"
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

function titleLine(listing: ProfileListing): string {
  if (listing.kind === 'missing') {
    return `Zaginął: ${listing.speciesLabel}${listing.petName ? ` ${listing.petName}` : ''}`;
  }
  return `Widziany: ${listing.speciesLabel}`;
}

// One row in ProfilePage's active-listings feed. `layout` (framer-motion) is what makes the
// remaining rows glide upward into the vacant slot once a sibling is removed from the array on
// resolve — no manual height/translate bookkeeping needed, per Flow 3's "hardware-accelerated
// layouts" requirement; `exit` drives that same removed row's own fade + slide-out.
export function ListingRow({ listing, onEdit, onResolve }: ListingRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.3, ease: 'easeIn' } }}
      transition={{ layout: { duration: 0.32, ease: [0.32, 0.72, 0, 1] } }}
      className="flex flex-col gap-3 border-b px-1 py-4"
      style={{ borderColor: HAIRLINE_BORDER }}
    >
      <div className="flex gap-3.5">
        <ListingThumbnail listing={listing} />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <p className="truncate text-[15px] font-semibold" style={{ color: ANTHRACITE }}>
            {titleLine(listing)}
          </p>
          <p className="text-xs" style={{ color: MUTED_GRAY }}>
            {formatRelativeTime(listing.createdAt)} • {listing.location.lat.toFixed(3)}, {listing.location.lng.toFixed(3)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onEdit(listing.id)}
          className="rounded-full px-3.5 py-2 text-xs font-semibold"
          style={{ color: MUTED_GRAY }}
        >
          ✏️ Edytuj
        </button>
        <button
          type="button"
          onClick={() => onResolve(listing.id)}
          className="rounded-full px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95"
          style={{ backgroundColor: SUCCESS_GREEN, boxShadow: `0 6px 16px -6px ${SUCCESS_GREEN}aa` }}
        >
          🎉 Odnaleziony
        </button>
      </div>
    </motion.div>
  );
}
