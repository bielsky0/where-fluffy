import { useNavigate } from 'react-router-dom';
import type { Coordinate } from '@/shared/components/map/types';
import { PetCard } from './PetCard';
import type { Pet } from '../types/pet.types';

interface PetResultsListProps {
  pets: Pet[];
  origin: Coordinate;
  selectedPetId: string | null;
  // Passed straight through to each PetCard — MapExplorerPage.tsx sets this to a landscape
  // ratio at BottomSheet.tsx's 'half' snap (which slices `pets` down to a single card, see its
  // own `visibleResultsPets` comment), so that one card's image stops over-extending past the
  // half-screen budget; left undefined (PetCard's own portrait default) at every other snap.
  imageAspectClassName?: string;
}

// Content of the results drawer (BottomSheet.tsx) in AppShell.tsx's STATE_C. Deliberately no
// filter controls here — those live entirely in SearchModal.tsx's wizard now; this only
// renders whatever `pets` it's given. At the drawer's "half" snap only ~2-3 cards fit in the
// visible viewport and at "expanded" the rest is reachable by scrolling — both are just this
// same list clipped by the drawer's current height, not two different renders.
//
// Tapping a card navigates straight to PetDetailPage (its own full-screen route) rather than
// calling usePetMapStore's selectPet — selectPet is what MapView's own pin taps still use to
// show the lightweight PetDetailPanel inline in this same drawer; deliberately not reusing that
// here, since setting selectedPetId would make the drawer land back on PetDetailPanel (instead
// of this list) if the user later taps the browser/OS back button off of PetDetailPage.
export function PetResultsList({ pets, origin, selectedPetId, imageAspectClassName }: PetResultsListProps) {
  const navigate = useNavigate();

  if (pets.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Brak zwierzaków spełniających wybrane filtry.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4 pb-4">
      {pets.map((pet) => (
        <li key={pet.id}>
          <PetCard
            pet={pet}
            origin={origin}
            selected={pet.id === selectedPetId}
            onClick={() => navigate(`/app/pets/${pet.id}`)}
            className="w-full"
            imageAspectClassName={imageAspectClassName}
          />
        </li>
      ))}
    </ul>
  );
}
