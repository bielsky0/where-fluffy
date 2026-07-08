import { create } from 'zustand';
import type { BottomSheetSnap } from '../types/mapUi.types';

interface PetMapState {
  selectedPetId: string | null;
  sheetSnap: BottomSheetSnap;
  isAddReportModalOpen: boolean;
  selectPet: (petId: string) => void;
  clearSelection: () => void;
  setSheetSnap: (snap: BottomSheetSnap) => void;
  openAddReportModal: () => void;
  closeAddReportModal: () => void;
}

// UI-only state for the map + bottom-sheet shell (PetsMapView.tsx) — which pet is selected,
// how far the sheet is expanded, whether the add-report modal is open. Never touches the
// network; that's api/usePets.ts and api/useSightings.ts's job. Kept separate from
// usePetFilterStore (search/status filters) since the two change for unrelated reasons.
export const usePetMapStore = create<PetMapState>((set) => ({
  selectedPetId: null,
  sheetSnap: 'peek',
  isAddReportModalOpen: false,
  selectPet: (petId) =>
    set((state) => ({
      selectedPetId: petId,
      // Selecting a pet from a collapsed sheet should reveal it — but leave an already
      // peek/full sheet at whatever height the user chose.
      sheetSnap: state.sheetSnap === 'collapsed' ? 'peek' : state.sheetSnap,
    })),
  clearSelection: () => set({ selectedPetId: null }),
  setSheetSnap: (snap) => set({ sheetSnap: snap }),
  openAddReportModal: () => set({ isAddReportModalOpen: true }),
  closeAddReportModal: () => set({ isAddReportModalOpen: false }),
}));
