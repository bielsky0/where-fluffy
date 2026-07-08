import { useState, type UIEvent } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Coordinate } from '@/shared/components/map/types';
import { cn } from '@/shared/lib/cn';
import { distanceMeters, formatDistance, formatRelativeTime } from '../lib/format';
import type { Pet } from '../types/pet.types';

interface PetDetailPanelProps {
  pet: Pet;
  origin: Coordinate;
  onClose: () => void;
}

// No photo field exists on PetResponseDTO yet (see pet.types.ts, and PetCard.tsx's own
// PetImage/gallery-dot precedent for the same gap) — one real slide, not several fabricated
// ones. The scroll-snap slider and its dot row below are still the genuine mechanism (functional
// for N slides), just fed by real data that today happens to total one.
const HERO_SLIDES = [0];

function HeroMonogram({ pet }: { pet: Pet }) {
  return (
    <div
      className="flex size-full items-center justify-center bg-neutral-100 text-7xl font-bold text-neutral-300"
      aria-hidden="true"
    >
      {pet.name.charAt(0).toUpperCase()}
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
      className={cn('size-[18px]', filled ? 'text-rose-600' : 'text-[#222222]')}
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="size-[18px] text-[#222222]" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_LABEL: Record<Pet['status'], string> = {
  missing: 'ZAGINĄŁ',
  found: 'WIDZIANY',
};

// Same red/orange coding PetCard.tsx and the map pill markers already use, kept in sync so the
// floating card reads as the same status as its pin on the map.
const STATUS_ACCENT: Record<Pet['status'], string> = {
  missing: 'bg-red-600',
  found: 'bg-orange-500',
};

// No reverse-geocoded place name exists anywhere in this app (PetResponseDTO only ever carries
// raw lat/lng, see pet.types.ts) — same "don't fake data" precedent as PetCard.tsx's
// RewardBadge/PetImage and PetDetailPage.tsx's own coordinate fallback. Shows the coordinate
// pair rather than inventing a neighborhood label.
function formatLocationAnchor(location: Coordinate): string {
  return `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}`;
}

// Isolated floating "Sighting Preview Card" — mounted by MapExplorerPage as its own layer,
// decoupled from BottomSheet.tsx's results drawer entirely (that sheet slides fully out of view
// the moment this mounts, see BottomSheet's own `hidden` prop). A pin tap on the map
// (usePetMapStore's selectPet) is the only thing that ever opens this; PetResultsList.tsx's own
// cards deliberately navigate straight to PetDetailPage instead (see its own comment) — so this
// stays a lightweight glance-and-go preview, not the full profile. The sighting log and
// "add sighting" form that used to live in this panel now live on PetDetailPage, which is the
// only other place a pet's sightings are shown — this card only ever links out to it.
export function PetDetailPanel({ pet, origin, onClose }: PetDetailPanelProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [favorited, setFavorited] = useState(false);

  const distance = formatDistance(distanceMeters(origin, pet.location));

  const handleSlideScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    if (clientWidth === 0) return;
    setActiveSlide(Math.round(scrollLeft / clientWidth));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      // z-[1200] beats every other floating layer in this page (BottomSheet 1000, ResultsTopBar
      // 1050, MapFabButton 1150, BottomNav 1100) — this card is meant to visually levitate over
      // all of them, map included, not just the drawer it replaces.
      className="absolute inset-x-0 bottom-0 z-[1200] m-4 overflow-hidden rounded-[24px] bg-white shadow-[0_16px_40px_-8px_rgba(0,0,0,0.4)]"
      style={{ marginBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      {/* Upper layer: hero picture slider */}
      <div className="relative aspect-[4/3] w-full">
        <div
          onScroll={handleSlideScroll}
          className="flex size-full snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {HERO_SLIDES.map((slide) => (
            <div key={slide} className="size-full shrink-0 snap-center">
              <HeroMonogram pet={pet} />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          {HERO_SLIDES.map((slide) => (
            <span
              key={slide}
              className={cn(
                'h-1.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-all duration-200',
                slide === activeSlide ? 'w-4' : 'w-1.5 opacity-70',
              )}
            />
          ))}
        </div>

        <span
          className={cn(
            'absolute left-3 top-3 rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]',
            STATUS_ACCENT[pet.status],
          )}
        >
          {STATUS_LABEL[pet.status]}
          {pet.reward > 0 ? ` • ${pet.reward} zł nagrody` : ''}
        </span>

        <div className="absolute right-3 top-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFavorited((prev) => !prev)}
            aria-pressed={favorited}
            aria-label={favorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            className="flex size-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]"
          >
            <HeartIcon filled={favorited} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij podgląd i wróć do listy"
            className="flex size-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Lower layer: metadata resume block */}
      <div className="flex flex-col gap-1 bg-white px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[17px] font-bold text-[#222222]">
            {pet.name} • {pet.species}
          </p>
          <span className="shrink-0 text-[13px] font-semibold text-[#222222]">⭐ {distance} stąd</span>
        </div>
        <p className="truncate text-[13px] font-medium text-neutral-400">Widziany w: {formatLocationAnchor(pet.location)}</p>
        <p className="text-[12.5px] font-medium text-neutral-400">{formatRelativeTime(pet.createdAt)}</p>

        {pet.reward > 0 && (
          <span className="mt-1 inline-flex w-fit items-center rounded-full bg-rose-50 px-3 py-1 text-[12.5px] font-bold text-rose-600">
            Nagroda: {pet.reward} zł
          </span>
        )}

        <Link
          to={`/app/pets/${pet.id}`}
          className="mt-2 text-center text-[13px] font-semibold text-rose-600 underline-offset-2 hover:underline"
        >
          Zobacz pełny profil →
        </Link>
      </div>
    </motion.div>
  );
}
