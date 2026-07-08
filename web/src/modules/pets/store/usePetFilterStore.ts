import { create } from 'zustand';
import type { PetStatus } from '../types/pet.types';

export type PetStatusFilter = PetStatus | 'all';

interface PetFilterState {
  statusFilter: PetStatusFilter;
  searchTerm: string;
  setStatusFilter: (status: PetStatusFilter) => void;
  setSearchTerm: (term: string) => void;
  reset: () => void;
}

const initialState = {
  statusFilter: 'all' as PetStatusFilter,
  searchTerm: '',
};

// UI-only state — which filters are selected, not the pet data itself. Fetching/caching that
// data is `api/usePets.ts`'s job; this store never touches the network.
export const usePetFilterStore = create<PetFilterState>((set) => ({
  ...initialState,
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  reset: () => set(initialState),
}));
