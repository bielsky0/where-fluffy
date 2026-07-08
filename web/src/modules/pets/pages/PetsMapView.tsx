import { useMemo } from 'react';
import { usePets } from '../api/usePets';
import { usePetFilterStore } from '../store/usePetFilterStore';
import { usePetMapStore } from '../store/usePetMapStore';
import { MapView } from '../components/MapView';
import { BottomSheet } from '../components/BottomSheet';
import { PetListPanel } from '../components/PetListPanel';
import { PetDetailPanel } from '../components/PetDetailPanel';
import { AddReportModal } from '../components/AddReportModal';

// Placeholder origin for the nearby-search until real geolocation/map-driven search is wired up.
const DEFAULT_CENTER = { lat: 52.2297, lng: 21.0122 };

// Routed at /app/pets (see app/routes.tsx). The Map is the persistent backdrop; the
// BottomSheet overlays it and swaps its *content* (list vs. a selected pet's detail) based on
// usePetMapStore — the <MapView/> element itself is never conditionally rendered or keyed by
// selection, so it never remounts and its pan/zoom state survives every sheet interaction.
export default function PetsMapView() {
  const { data: pets, isLoading, isError } = usePets({ ...DEFAULT_CENTER, radius: 5000 });

  const statusFilter = usePetFilterStore((state) => state.statusFilter);
  const searchTerm = usePetFilterStore((state) => state.searchTerm);

  const selectedPetId = usePetMapStore((state) => state.selectedPetId);
  const selectPet = usePetMapStore((state) => state.selectPet);
  const clearSelection = usePetMapStore((state) => state.clearSelection);
  const sheetSnap = usePetMapStore((state) => state.sheetSnap);
  const setSheetSnap = usePetMapStore((state) => state.setSheetSnap);
  const isAddReportOpen = usePetMapStore((state) => state.isAddReportModalOpen);
  const openAddReport = usePetMapStore((state) => state.openAddReportModal);
  const closeAddReport = usePetMapStore((state) => state.closeAddReportModal);

  const filteredPets = useMemo(() => {
    if (!pets) return [];
    return pets.filter((pet) => {
      const matchesStatus = statusFilter === 'all' || pet.status === statusFilter;
      const matchesSearch = pet.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [pets, statusFilter, searchTerm]);

  const selectedPet = filteredPets.find((pet) => pet.id === selectedPetId) ?? null;

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <MapView
        pets={filteredPets}
        center={DEFAULT_CENTER}
        selectedPetId={selectedPetId}
        onSelectPet={selectPet}
      />

      <button
        type="button"
        onClick={openAddReport}
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 500 }}
      >
        + Report pet
      </button>

      <BottomSheet snap={sheetSnap} onSnapChange={setSheetSnap}>
        {isLoading && <p>Loading pets…</p>}
        {isError && <p>Could not load nearby pets.</p>}
        {!isLoading && !isError && selectedPet && (
          <PetDetailPanel pet={selectedPet} onBack={clearSelection} />
        )}
        {!isLoading && !isError && !selectedPet && (
          <PetListPanel pets={filteredPets} onSelectPet={selectPet} />
        )}
      </BottomSheet>

      {isAddReportOpen && <AddReportModal onClose={closeAddReport} />}
    </div>
  );
}
