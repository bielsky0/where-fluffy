import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_CENTER } from '../lib/geo';
import type { PetTypeFilter } from '../lib/petType';
import type { Coordinate } from '@/shared/components/map';

export type WizardStep = 1 | 2 | 3 | 4;

export interface AddListingWizardData {
  reportType: 'lost' | 'found' | null;
  // Kept local-only (see addListingWizard.schema.ts's own comment) — the backend's CreatePetDTO
  // has no photo field yet, so this never reaches useCreatePetReport's payload. The preview
  // thumbnail is derived from this File directly (an objectURL, see StepPhoto.tsx) rather than
  // also stored here — deriving it keeps this store from holding a blob URL that needs its own
  // revoke lifecycle.
  photo: File | null;
  location: Coordinate;
  name: string;
  petType: PetTypeFilter | null;
  description: string;
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
  location: DEFAULT_CENTER,
  name: '',
  petType: null,
  description: '',
};

const STORAGE_KEY = 'where-fluffy:add-listing-wizard-draft';

type PersistedWizardState = Pick<AddListingWizardState, 'step' | 'data'>;

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
      // File objects don't survive JSON.stringify as `File` (they serialize to `{}`), and the
      // field is local-only/derived-preview anyway (see AddListingWizardData's own comment on
      // `photo`), so a rehydrated draft always comes back with no photo and the user re-attaches
      // one, rather than restoring a corrupt non-null placeholder.
      partialize: (state): PersistedWizardState => ({
        step: state.step,
        data: { ...state.data, photo: null },
      }),
    },
  ),
);
