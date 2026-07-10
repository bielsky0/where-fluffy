import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { EXACT_LOCATION_TTL_MS } from '@/shared/config/geo.config';
import type { AppLocation } from '../types/location.types';

interface LocationState {
  exactLocation: AppLocation | null;
  exactLocationTimestamp: number | null;
  // Not persisted (see partialize below) — always starts false on every fresh load, so
  // useAppLocation can tell "localStorage genuinely has nothing" apart from "rehydration hasn't
  // run yet" and avoid firing GeoIP for a fix that's about to show up.
  hasHydrated: boolean;
  setExactLocation: (location: AppLocation) => void;
  clearExactLocation: () => void;
  setHasHydrated: (hydrated: boolean) => void;
}

// A persisted GPS fix older than this is still shown immediately (stale-while-revalidate) but
// no longer trusted to skip a background re-fetch.
export function isLocationFresh(timestamp: number | null): boolean {
  return timestamp !== null && Date.now() - timestamp < EXACT_LOCATION_TTL_MS;
}

// Persists only the user's explicitly-granted exact GPS fix (source: 'gps') — the GeoIP-resolved
// origin is re-fetched fresh every session via useAppLocation's own useQuery (not persisted),
// since an IP-based location can go stale/change between visits in a way a one-time GPS grant
// shouldn't be re-asked for. Mirrors useAddListingWizardStore's persist shape (createJSONStorage
// + partialize) for the persisted fields, plus useThemeStore's onRehydrateStorage pattern to
// track hydration completion (no DOM side effect here, just a completion flag).
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      exactLocation: null,
      exactLocationTimestamp: null,
      hasHydrated: false,
      setExactLocation: (location) => set({ exactLocation: location, exactLocationTimestamp: Date.now() }),
      clearExactLocation: () => set({ exactLocation: null, exactLocationTimestamp: null }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: 'where-fluffy:location',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        exactLocation: state.exactLocation,
        exactLocationTimestamp: state.exactLocationTimestamp,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
