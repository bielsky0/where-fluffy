import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppLocation } from '../types/location.types';

interface LocationState {
  exactLocation: AppLocation | null;
  setExactLocation: (location: AppLocation) => void;
  clearExactLocation: () => void;
}

// Persists only the user's explicitly-granted exact GPS fix (source: 'gps') — the GeoIP-resolved
// origin is re-fetched fresh every session via useAppLocation's own useQuery (not persisted),
// since an IP-based location can go stale/change between visits in a way a one-time GPS grant
// shouldn't be re-asked for. Mirrors useAddListingWizardStore's persist shape (createJSONStorage
// + partialize) rather than useThemeStore's, since there's no DOM side effect to replay on
// rehydrate here.
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      exactLocation: null,
      setExactLocation: (location) => set({ exactLocation: location }),
      clearExactLocation: () => set({ exactLocation: null }),
    }),
    {
      name: 'where-fluffy:location',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ exactLocation: state.exactLocation }),
    },
  ),
);
