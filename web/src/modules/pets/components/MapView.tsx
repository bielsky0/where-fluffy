import { Map } from '@/shared/components/map';
import type { Pet } from '../types/pet.types';

interface MapViewProps {
  pets: Pet[];
  center: { lat: number; lng: number };
  selectedPetId: string | null;
  onSelectPet: (petId: string) => void;
}

// Mounted once by AppShell.tsx and never unmounted while the bottom sheet opens/closes or a
// pet gets selected — that's what "map state is preserved" means here: selecting a pet only
// changes `selectedPetId` (usePetMapStore), it never remounts <Map/>, so the underlying
// provider's own pan/zoom state survives every sheet interaction.
export function MapView({ pets, center, selectedPetId, onSelectPet }: MapViewProps) {
  return (
    <Map
      center={center}
      zoom={13}
      markers={pets.map((pet) => ({
        id: pet.id,
        position: pet.location,
        opacity: selectedPetId === null || selectedPetId === pet.id ? 1 : 0.5,
        onClick: () => onSelectPet(pet.id),
      }))}
    />
  );
}
