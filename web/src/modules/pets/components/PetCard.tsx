import { memo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { motion, useAnimation } from 'framer-motion';
import type { Coordinate } from '@/shared/components/map/types';
import { cn } from '@/shared/lib/cn';
import { distanceMeters, formatDistance, formatRelativeTime, getPetDisplayInitial, getPetDisplayName } from '../lib/format';
import { PET_STATUS_LABEL } from '../lib/petStatus';
import type { Pet } from '../types/pet.types';

interface PetCardProps {
  pet: Pet;
  origin: Coordinate;
  selected?: boolean;
  onClick?: () => void;
  // Width/shrink/snap behavior differs by context — a 75-80vw snap-carousel item in
  // MainFeedPage vs. a full-width row in PetResultsList's drawer — so the card itself stays
  // unopinionated about it and just merges whatever the caller passes in.
  className?: string;
  // Defaults to the portrait Airbnb-style ratio used everywhere else. PetResultsList.tsx
  // overrides this to a landscape ratio for BottomSheet.tsx's 'half' snap, which only ever
  // shows a single full card in the visible half-screen budget — the tall portrait ratio there
  // forced the image (and so the whole card) to over-extend past that budget.
  imageAspectClassName?: string;
}

// Same red/orange coding as the map pill markers (LeafletMap.tsx's TONE_ACCENT) — kept in sync
// so a card in the drawer reads as the same status as its pin on the map.
const STATUS_BADGE_TEXT: Record<Pet['status'], string> = {
  missing: 'text-red-600',
  found: 'text-orange-500',
  // PetCard only ever renders public feed/map/nearby pets (always 'missing'/'found' — see
  // pet.types.ts's PublicPetStatus) in practice, but Pet['status'] is the wider PetStatus.
  paused: 'text-neutral-500',
  resolved: 'text-green-600',
};

const STATUS_VERB: Record<Pet['status'], string> = {
  missing: 'Zaginął',
  found: 'Widziany',
  paused: 'Wstrzymane',
  resolved: 'Odnaleziony',
};

// pet.photoUrls[0] mirrors ProfilePage.tsx's/HeroGallery.tsx's own fallback: alt="" + aria-hidden
// since the card's outer role="button" already carries the accessible name via
// getPetDisplayName, so the image itself is decorative. Falls back to a neutral, minimal initial
// block — deliberately uncolored by status (the premium spec keeps the image surface
// quiet/monochrome and puts all status signal in the ZAGINĄŁ/WIDZIANY badge instead) — when the
// pet has no photo yet.
function PetImage({ pet }: { pet: Pet }) {
  // Optional chaining, not a plain index: a localStorage-persisted TanStack Query cache
  // (AppProviders.tsx) can still hold a pre-fix feed response shaped like the old DTO, which had
  // no photoUrls field at all — not even `[]` — until it's next refetched.
  const photoUrl = pet.photoUrls?.[0];

  if (photoUrl) {
    return <img src={photoUrl} alt="" aria-hidden="true" className="size-full object-cover" />;
  }

  return (
    <div
      className="flex size-full items-center justify-center bg-neutral-100 text-6xl font-bold text-neutral-300"
      aria-hidden="true"
    >
      {getPetDisplayInitial(pet)}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      className={cn(
        'size-[18px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]',
        filled ? 'text-rose-600' : 'text-white',
      )}
      aria-hidden="true"
    >
      <path
        d="M12 20.5s-7.5-4.6-10-9.3C.4 7.8 2 4.5 5.4 4a5 5 0 0 1 6.6 2.4A5 5 0 0 1 18.6 4c3.4.5 5 3.8 3.4 7.2-2.5 4.7-10 9.3-10 9.3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// pet.reward is the one real "trust"-adjacent signal PetResponseDTO actually carries — used here
// as the right-hand side of the metadata block's third line instead of a fabricated star/review
// rating (this app has no ratings or reviews feature anywhere, so a "⭐ 4.94" badge would be
// invented data, not a real trust score).
function RewardBadge({ reward }: { reward: number }) {
  if (reward <= 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-black">
      <span aria-hidden="true">💰</span>
      {reward} zł
    </span>
  );
}

// Reusable atomic card — premium/Airbnb-style vertical layout (image on top, strict 3-line
// metadata block below), used both as a fixed-width item inside MainFeedPage's snap carousels
// and as a full-width row inside PetResultsList's drawer. Wrapped in memo() (see the named
// export below) since both parents re-render frequently (scroll position, drawer snap, filter
// toggles) for reasons unrelated to any single card's own props.
function PetCardComponent({
  pet,
  origin,
  selected = false,
  onClick,
  className,
  imageAspectClassName = 'aspect-[16/9]',
}: PetCardProps) {
  const [favorited, setFavorited] = useState(false);
  const heartControls = useAnimation();

  const distance = formatDistance(distanceMeters(origin, pet.location));

  const handleToggleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    // The heart sits inside the card's own clickable area but must not also trigger onClick.
    event.stopPropagation();
    setFavorited((prev) => !prev);
    heartControls.start({ scale: [1, 1.3, 1], transition: { duration: 0.35, ease: 'easeInOut' } });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick?.();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-pressed={selected}
      className={cn('group flex cursor-pointer flex-col gap-2.5 text-left outline-none', className)}
    >
      <div
        className={cn(
          // `transition-[aspect-ratio]` is what makes the half↔expanded ratio swap (see
          // imageAspectClassName's own doc comment above) read as a fluid reflow instead of an
          // instant jump-cut — modern browsers interpolate the `aspect-ratio` CSS property like
          // any other animatable numeric property, so a plain Tailwind class swap between
          // renders is enough to get a smooth transition with no JS-driven animation needed.
          'relative w-full overflow-hidden rounded-3xl transition-[aspect-ratio] duration-300 ease-out',
          imageAspectClassName,
          selected && 'ring-2 ring-rose-600 ring-offset-2 ring-offset-white',
        )}
      >
        <PetImage pet={pet} />

        {/* Decorative gallery-position chrome, not a real multi-photo carousel — PetImage above
            only ever shows pet.photoUrls[0], so a single active dot mirrors reality rather than
            implying more photos are swipeable here (the full gallery lives on the detail page's
            HeroGallery). */}
        <div className="absolute inset-x-0 bottom-2.5 flex items-center justify-center" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
        </div>

        <span
          className={cn(
            'absolute left-2.5 top-2.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold tracking-wide shadow-[0_2px_8px_-2px_rgba(0,0,0,0.25)]',
            STATUS_BADGE_TEXT[pet.status],
          )}
        >
          {PET_STATUS_LABEL[pet.status]}
        </span>

        <motion.button
          type="button"
          onClick={handleToggleFavorite}
          animate={heartControls}
          aria-pressed={favorited}
          aria-label={favorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center"
        >
          <HeartIcon filled={favorited} />
        </motion.button>
      </div>

      <div className="flex flex-col gap-0.5 px-0.5">
        <p className="truncate text-[15px] font-semibold text-black">
          {getPetDisplayName(pet)} • {pet.species}
        </p>
        <p className="truncate text-[13px] font-medium text-neutral-400">
          {STATUS_VERB[pet.status]} {formatRelativeTime(pet.createdAt)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-black">Blisko Ciebie • {distance}</span>
          <RewardBadge reward={pet.reward} />
        </div>
      </div>
    </div>
  );
}

export const PetCard = memo(PetCardComponent);
