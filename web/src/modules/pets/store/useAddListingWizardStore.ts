import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { FALLBACK_ORIGIN } from '@/shared/config/geo.config';
import type { PetTypeFilter } from '../lib/petType';
import type { Coordinate } from '@/shared/components/map';

export type WizardStep = 1 | 2 | 3 | 4;

export interface AddListingWizardData {
  reportType: 'lost' | 'found' | null;
  // Compressed (see lib/compressImage.ts), base64-encoded JPEG data URLs — plain strings, so
  // (unlike the `File`s these represent) they survive JSON.stringify/localStorage naturally. That
  // matters specifically because the wizard's final step may need to send the user through the
  // Ghost Account OTP flow, which can involve a tab switch (SMS app / email client) — the draft,
  // photos included, must still be here on return. At least one photo is required (V2 spec: no
  // report without visual documentation), enforced by stepPhotoSchema's `.min(1)`.
  photos: string[];
  location: Coordinate;
  name: string; // only used/required on the 'lost' path — see addListingWizard.schema.ts
  petType: PetTypeFilter | null;
  description: string;
  phone: string;
  email: string;
  reward: number; // only used on the 'lost' path
  distinguishingMarks: string;
}

interface AddListingWizardState {
  step: WizardStep;
  data: AddListingWizardData;
  setStep: (step: WizardStep) => void;
  updateData: (patch: Partial<AddListingWizardData>) => void;
  reset: () => void;
}

const INITIAL_DATA: AddListingWizardData = {
  reportType: null,
  photos: [],
  // Map starts centered on the same fallback origin as the rest of the app (MapExplorerPage,
  // MainFeedPage) until the user drags it — see StepMapPin.tsx.
  location: FALLBACK_ORIGIN,
  name: '',
  petType: null,
  description: '',
  phone: '',
  email: '',
  reward: 0,
  distinguishingMarks: '',
};

// Bumped from '...-draft' (v1, single `photo: string | null`) — v1's shape doesn't map cleanly
// onto v2's `photos: string[]`/`email`, so rather than guessing at a migration, `migrate` below
// just drops any pre-v2 draft. A key bump alone would already achieve that (a fresh key reads as
// empty), but keeping `version`/`migrate` too means any *other* historical shape drift under the
// old key is handled the same way, not just this one known case.
const STORAGE_KEY = 'where-fluffy:add-listing-wizard-draft-v2';

// Multi-step form state for the "Add Listing" wizard (AddListingWizard.tsx), separate from
// usePetMapStore's map/drawer UI state since the two change for unrelated reasons and this one
// needs to survive back/forth navigation between steps — `data` is never cleared by `setStep`,
// only by `reset` (called once the wizard actually submits or the user closes it, see
// AddListingWizard.tsx). `persist` writes to localStorage synchronously on every `set()`, so any
// interrupted report (tab close, reload, or the header's "Zapisz i wyjdź") survives without this
// store needing its own explicit save action.
export const useAddListingWizardStore = create<AddListingWizardState>()(
  persist(
    (set) => ({
      step: 1,
      data: INITIAL_DATA,
      setStep: (step) => set({ step }),
      updateData: (patch) => set((state) => ({ data: { ...state.data, ...patch } })),
      reset: () => {
        set({ step: 1, data: INITIAL_DATA });
        void useAddListingWizardStore.persist.clearStorage();
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) {
          return { step: 1, data: INITIAL_DATA };
        }
        return persisted as AddListingWizardState;
      },
    },
  ),
);
