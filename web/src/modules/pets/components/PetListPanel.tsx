import { usePetFilterStore } from '../store/usePetFilterStore';
import { PetCard } from './PetCard';
import type { Pet } from '../types/pet.types';

interface PetListPanelProps {
  pets: Pet[];
  onSelectPet: (petId: string) => void;
}

// Default content of the bottom sheet (see PetsMapView.tsx) when no pet is selected —
// search/filter controls plus the list, swapped for <PetDetailPanel/> once a pin or list
// item is picked. Filter state comes from usePetFilterStore, not local state, so it survives
// switching in and out of a pet's detail view.
export function PetListPanel({ pets, onSelectPet }: PetListPanelProps) {
  const searchTerm = usePetFilterStore((state) => state.searchTerm);
  const setSearchTerm = usePetFilterStore((state) => state.setSearchTerm);
  const statusFilter = usePetFilterStore((state) => state.statusFilter);
  const setStatusFilter = usePetFilterStore((state) => state.setStatusFilter);

  return (
    <div>
      <h2>Nearby Pets</h2>

      <div>
        <input
          type="search"
          placeholder="Search by name"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
        >
          <option value="all">All</option>
          <option value="missing">Missing</option>
          <option value="found">Found</option>
        </select>
      </div>

      <div>
        {pets.map((pet) => (
          <button
            key={pet.id}
            type="button"
            onClick={() => onSelectPet(pet.id)}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: 0 }}
          >
            <PetCard pet={pet} />
          </button>
        ))}
      </div>
    </div>
  );
}
