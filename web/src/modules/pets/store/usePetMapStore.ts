import { create } from 'zustand';
import type { DrawerSnap } from '../types/mapUi.types';

interface PetMapState {
  selectedPetId: string | null;
  sheetSnap: DrawerSnap;
  isAddReportModalOpen: boolean;
  selectPet: (petId: string) => void;
  clearSelection: () => void;
  setSheetSnap: (snap: DrawerSnap) => void;
  openAddReportModal: () => void;
  closeAddReportModal: () => void;
}

// UI-only state for the map + results-drawer shell (AppShell.tsx's STATE_C) — which pet is
// selected, how far the drawer is dragged open, whether the add-report modal is open. Never
// touches the network; that's api/usePets.ts and api/useSightings.ts's job. Kept separate from
// useAppUIStore (top-level STATE_A/B/C + the search wizard's own filters) since the two change
// for unrelated reasons.
export const usePetMapStore = create<PetMapState>((set) => ({
  selectedPetId: null,
  sheetSnap: 'collapsed',
  isAddReportModalOpen: false,
  selectPet: (petId) =>
    set((state) => ({
      selectedPetId: petId,
      // Selecting a pet from a collapsed drawer should reveal it — but leave an already
      // half/expanded drawer at whatever height the user chose.
      sheetSnap: state.sheetSnap === 'collapsed' ? 'half' : state.sheetSnap,
    })),
  clearSelection: () => set({ selectedPetId: null }),
  setSheetSnap: (snap) => set({ sheetSnap: snap }),
  openAddReportModal: () => set({ isAddReportModalOpen: true }),
  closeAddReportModal: () => set({ isAddReportModalOpen: false }),
}));
