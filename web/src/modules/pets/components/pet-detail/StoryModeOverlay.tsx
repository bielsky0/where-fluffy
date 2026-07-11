import { Map } from '@/shared/components/map';
import { CloseIcon } from './icons';
import type { Pet, PetStatus } from '../../types/pet.types';
import { getPetDisplayInitial, getPetDisplayName } from '../../lib/format';

const STATUS_HEADLINE: Record<PetStatus, string> = {
  missing: 'ZAGINĄŁ',
  found: 'WIDZIANY',
  paused: 'WSTRZYMANE',
  resolved: 'ODNALEZIONY',
};

interface StoryModeOverlayProps {
  pet: Pet;
  onClose: () => void;
}

// Pure CSS/React 9:16 "clean screen" mode for screen-recording into a Reel/Story/TikTok — no
// video encoding happens here (the spec's own workflow is: user records their own screen). All
// normal chrome is hidden; only the photo, a big status/city headline, a static mini-map, and a
// pulsing "still active" indicator remain.
export function StoryModeOverlay({ pet, onClose }: StoryModeOverlayProps) {
  const photo = pet.photoUrls[0] ?? null;
  const cityPhrase = pet.city ? ` w ${pet.city}` : '';

  return (
    <div className="fixed inset-0 z-[1400] flex flex-col bg-black">
      <button
        type="button"
        onClick={onClose}
        aria-label="Zamknij tryb Story"
        className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
      >
        <CloseIcon />
      </button>

      <div className="relative flex-[3] overflow-hidden">
        {photo ? (
          <img src={photo} alt={getPetDisplayName(pet)} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-neutral-900">
            <span className="text-9xl font-bold text-neutral-700">{getPetDisplayInitial(pet)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />

        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-6 text-center">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            Poszukiwania trwają
          </span>
          <h1 className="text-4xl font-extrabold leading-tight text-white drop-shadow-lg">
            {STATUS_HEADLINE[pet.status]}
            {cityPhrase}
          </h1>
          <p className="text-lg font-semibold text-white/90">{getPetDisplayName(pet)}</p>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="relative size-full overflow-hidden rounded-2xl">
          <Map center={pet.location} zoom={14} interactive={false} className="pointer-events-none size-full" />
        </div>
      </div>

      <p className="pb-safe px-6 pb-4 text-center text-xs text-white/60">
        Nagraj ekran, aby zapisać i udostępnić jako Story/Reel
      </p>
    </div>
  );
}
