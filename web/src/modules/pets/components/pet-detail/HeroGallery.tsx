import { useState } from 'react';
import { BackArrowIcon, ShareIcon, HeartIcon, CameraIcon } from './icons';
import type { Pet } from '../../types/pet.types';

interface HeroGalleryProps {
  pet: Pet;
  onBack: () => void;
  onShare: () => void;
  onOpenLightbox: (startIndex: number) => void;
  onOpenStoryMode: () => void;
}

// Full-bleed image carousel, always touching the device's top/left/right edges (no page header
// above it — see PetDetailPage's own layout). Renders `pet.photoUrls` as real slides now that
// the field exists; falls back to a single monogram slide when it's empty (0 or 1 photos is the
// realistic case until the report-creation wizard captures more than one — see the pet-detail
// plan's "known limitation" note). Pagination dots only render once there's something to
// paginate between.
export function HeroGallery({ pet, onBack, onShare, onOpenLightbox, onOpenStoryMode }: HeroGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const photos = pet.photoUrls;
  const slideCount = photos.length > 0 ? photos.length : 1;

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    if (clientWidth === 0) return;
    setActiveIndex(Math.round(scrollLeft / clientWidth));
  };

  return (
    <div className="relative h-[42vh] w-full shrink-0 bg-neutral-100">
      <div
        onScroll={handleScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-contain"
      >
        {photos.length > 0 ? (
          photos.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => onOpenLightbox(index)}
              className="h-full w-full shrink-0 snap-start"
              aria-hidden={index !== activeIndex}
              aria-label={`Zdjęcie ${index + 1} z ${photos.length}, powiększ`}
            >
              <img src={url} alt={pet.name} className="size-full object-cover" />
            </button>
          ))
        ) : (
          <div className="flex h-full w-full shrink-0 snap-start items-center justify-center bg-neutral-100">
            <span className="text-8xl font-bold text-neutral-300">{pet.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-safe">
        <button
          type="button"
          onClick={onBack}
          aria-label="Wstecz"
          className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]"
        >
          <BackArrowIcon />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenStoryMode}
            aria-label="Generuj materiał wideo / Story"
            className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]"
          >
            <CameraIcon />
          </button>
          <button
            type="button"
            onClick={onShare}
            aria-label="Udostępnij"
            className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]"
          >
            <ShareIcon />
          </button>
          <button
            type="button"
            onClick={() => setFavorited((prev) => !prev)}
            aria-pressed={favorited}
            aria-label={favorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]"
          >
            <HeartIcon filled={favorited} />
          </button>
        </div>
      </div>

      {pet.reward > 0 && (
        <div className="absolute bottom-3 left-3 rounded-full bg-[#FF6B4A] px-3 py-1.5 text-xs font-extrabold text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.45)]">
          Nagroda: {pet.reward} zł
        </div>
      )}

      {slideCount > 1 && (
        <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {activeIndex + 1} / {slideCount}
        </div>
      )}
    </div>
  );
}
