import { Map } from '@/shared/components/map';
import { petEmoji } from '../lib/petType';
import { formatRelativeTimeShort } from '../lib/format';
import type { Pet } from '../types/pet.types';

interface MapViewProps {
  pets: Pet[];
  center: { lat: number; lng: number };
  selectedPetId: string | null;
  onSelectPet: (petId: string) => void;
}

// Mounted once by AppShell.tsx and never unmounted while the search modal/results drawer
// opens or closes or a pet gets selected — that's what "map state is preserved" means here:
// selecting a pet only changes `selectedPetId` (usePetMapStore), it never remounts <Map/>, so
// the underlying provider's own pan/zoom state survives every state/drawer transition.
export function MapView({ pets, center, selectedPetId, onSelectPet }: MapViewProps) {
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;

  return (
    <Map
      center={center}
      zoom={13}
      focusCenter={selectedPet?.location ?? null}
      markers={pets.map((pet) => ({
        id: pet.id,
        position: pet.location,
        opacity: selectedPetId === null || selectedPetId === pet.id ? 1 : 0.5,
        onClick: () => onSelectPet(pet.id),
        emoji: petEmoji(pet.species),
        freshness: formatRelativeTimeShort(pet.createdAt),
        tone: pet.status === 'missing' ? 'danger' : 'warning',
        selected: pet.id === selectedPetId,
      }))}
    />
  );
}
