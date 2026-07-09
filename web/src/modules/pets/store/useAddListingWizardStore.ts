import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { FALLBACK_ORIGIN } from '@/shared/config/geo.config';
import type { PetTypeFilter } from '../lib/petType';
import type { Coordinate } from '@/shared/components/map';

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface AddListingWizardData {
  reportType: 'lost' | 'found' | null;
  // A compressed (see lib/compressImage.ts), base64-encoded JPEG data URL — a plain string, so
  // (unlike the `File` this used to hold) it survives JSON.stringify/localStorage naturally. That
  // matters specifically because the wizard's last step may need to send the user through the
  // Ghost Account OTP flow (AuthBottomSheet), which can involve a tab switch (SMS app / email
  // client) — the draft, photo included, must still be here on return.
  photo: string | null;
  location: Coordinate;
  name: string;
  petType: PetTypeFilter | null;
  description: string;
  phone: string;
  reward: number;
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
  photo: null,
  // Map starts centered on the same fallback origin as the rest of the app (MapExplorerPage,
  // MainFeedPage) until the user drags it — see StepMapPin.tsx.
  location: FALLBACK_ORIGIN,
  name: '',
  petType: null,
  description: '',
  phone: '',
  reward: 0,
  distinguishingMarks: '',
};

const STORAGE_KEY = 'where-fluffy:add-listing-wizard-draft';

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
    },
  ),
);
