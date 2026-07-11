import { motion } from 'framer-motion';
import { formatRelativeTime } from '@/modules/pets/lib/format';
import type { PetStatus } from '@/modules/pets/types/pet.types';
import type { ProfileListing } from '../types/profile.types';

const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
const SUCCESS_GREEN = '#22C55E';
const CORAL = '#FF6B4A';

interface ListingRowProps {
  listing: ProfileListing;
  onOpenHub: (id: string) => void;
  onShare: (id: string) => void;
}

// Square monogram placeholder for listings with no stored photo yet — same "letter-in-a-box"
// precedent as PetDetailPanel.tsx's HeroMonogram. Once a listing has photoUrls (real Pet data,
// unlike the old mock rows), the actual photo is shown instead.
function ListingThumbnail({ listing }: { listing: ProfileListing }) {
  if (listing.photoUrl) {
    return (
      <img
        src={listing.photoUrl}
        alt=""
        className="size-16 shrink-0 rounded-2xl object-cover"
        aria-hidden="true"
      />
    );
  }
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

const STATUS_PILL: Record<PetStatus, { label: string; dot: string; bg: string; text: string; pulse: boolean }> = {
  missing: { label: 'W trakcie poszukiwań', dot: '#DC2626', bg: '#FEE2E2', text: '#991B1B', pulse: true },
  found: { label: 'Zgłoszenie widzenia', dot: '#F97316', bg: '#FFEDD5', text: '#9A3412', pulse: false },
  paused: { label: 'Wstrzymane', dot: MUTED_GRAY, bg: '#F1F1F1', text: MUTED_GRAY, pulse: false },
  resolved: { label: 'Odnaleziony', dot: SUCCESS_GREEN, bg: '#DCFCE7', text: '#166534', pulse: false },
};

function StatusPill({ status }: { status: PetStatus }) {
  const pill = STATUS_PILL[status];
  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
      style={{ backgroundColor: pill.bg, color: pill.text }}
    >
      <motion.span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: pill.dot }}
        animate={pill.pulse ? { opacity: [1, 0.35, 1] } : undefined}
        transition={pill.pulse ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      {pill.label}
    </span>
  );
}

function titleLine(listing: ProfileListing): string {
  if (listing.kind === 'missing') {
    return `Zaginął: ${listing.speciesLabel}${listing.petName ? ` ${listing.petName}` : ''}`;
  }
  return `Widziany: ${listing.speciesLabel}`;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.6 6.8-3.2M8.6 13.4l6.8 3.2" strokeLinecap="round" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

// One row in ProfilePage's active-listings feed. `layout` (framer-motion) is what makes the
// remaining rows glide upward into the vacant slot once a sibling is removed from the array
// (resolve or delete) — no manual height/translate bookkeeping needed; `exit` drives that same
// removed row's own fade + slide-out. Edit/Resolve/Pause/Delete all now live behind
// ManagementHubSheet (Flow 2) rather than as inline buttons — this row only opens the hub or
// fires a share.
export function ListingRow({ listing, onOpenHub, onShare }: ListingRowProps) {
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
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <StatusPill status={listing.status} />
          <p className="truncate text-[15px] font-semibold" style={{ color: ANTHRACITE }}>
            {titleLine(listing)}
          </p>
          <p className="text-xs" style={{ color: MUTED_GRAY }}>
            {formatRelativeTime(listing.createdAt)} • {listing.location.lat.toFixed(3)}, {listing.location.lng.toFixed(3)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onShare(listing.id)}
          aria-label="Udostępnij"
          className="flex size-9 items-center justify-center rounded-full bg-neutral-100"
          style={{ color: CORAL }}
        >
          <ShareIcon />
        </button>
        <button
          type="button"
          onClick={() => onOpenHub(listing.id)}
          aria-label="Zarządzaj"
          className="flex size-9 items-center justify-center rounded-full bg-neutral-100"
          style={{ color: ANTHRACITE }}
        >
          <KebabIcon />
        </button>
      </div>
    </motion.div>
  );
}
