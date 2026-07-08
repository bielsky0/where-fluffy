import { create } from 'zustand';
import type { PetTypeFilter } from '@/modules/pets/lib/petType';
import type { TimeframeFilter } from '@/modules/pets/lib/timeframe';
import type { PetStatus } from '@/modules/pets/types/pet.types';

export type AppState = 'STATE_A' | 'STATE_B' | 'STATE_C';
// Which of the search modal's three accordion cards (1: pet type, 2: location, 3: timeframe)
// is currently expanded. Renamed from the old step-wizard's `WizardStep` when SearchModal.tsx
// became an Airbnb-style accordion (all three cards always mounted, exactly one expanded)
// instead of a linear one-screen-at-a-time wizard — the 1/2/3 ordering is unchanged.
export type AccordionStep = 1 | 2 | 3;
// The app's top-level view, one level above AppState: 'feed' is MainFeedPage (no map mounted
// at all — see AppShell.tsx); 'map' is the pre-existing STATE_A/B/C map+drawer stack. Only
// 'map' ever mounts <MapView/>, so switching back to 'feed' unmounts it (deliberate — see
// AppShell.tsx's comment on why this trades away the old "map state always survives" guarantee
// for not paying Leaflet's cost while the user is just browsing the feed). 'profile' is
// ProfilePage (modules/profile) — same "mounted only while active" treatment, reached only via
// BottomNav's auth-gated "Profil" tab (see AppShell.tsx's runAction).
export type ActiveView = 'feed' | 'map' | 'profile';

export interface LocationFilter {
  label: string;
  // Only set via a Card 2 suggestion tap ("W pobliżu" or a recent search — SearchModal.tsx's
  // selectDraftLocation) — free-typed text has nowhere to be geocoded against (no geocoding
  // endpoint on the backend, see AddReportModal.tsx's "Found" tab for the same "don't fake a
  // capability we don't have" precedent), so it's kept purely as a display label until coords
  // exist.
  coords: { lat: number; lng: number } | null;
}

export interface AppliedFilters {
  // `null` means "both" — the value showAllResults()/resetToMain() land on, so BottomNav's
  // "Lista" or tapping a card out of MainFeedPage's "found" carousel still shows every pet
  // regardless of status. Only applyFilters() (the search modal's "Szukaj" button) ever narrows
  // this to a single PetStatus, taken from the modal's own always-one-selected draftStatus
  // toggle.
  status: PetStatus | null;
  petType: PetTypeFilter | null;
  location: LocationFilter | null;
  timeframe: TimeframeFilter;
}

const EMPTY_FILTERS: AppliedFilters = { status: null, petType: null, location: null, timeframe: 'all' };

interface AppUIState {
  activeView: ActiveView;
  currentAppState: AppState;
  accordionStep: AccordionStep;
  // "Draft" mirrors the wizard's in-progress choices; nothing here affects the map/results
  // until applyFilters() copies it into appliedFilters — so STATE_B can be backed out of
  // (closeSearch) without side effects on STATE_A/STATE_C. draftStatus has no "unset" value
  // (the header's segmented control always shows one side selected), unlike appliedFilters.status.
  draftStatus: PetStatus;
  draftPetType: PetTypeFilter | null;
  draftLocation: LocationFilter | null;
  draftTimeframe: TimeframeFilter;
  appliedFilters: AppliedFilters;
  // Snapshot of {activeView, currentAppState} taken the moment openSearch() runs, so
  // closeSearch() (the wizard's own X) can return the user to wherever they actually opened it
  // from — MainFeedPage (activeView 'feed') or an in-progress STATE_C results view (re-opening
  // the wizard to tweak an already-applied filter) — instead of always landing on one hardcoded
  // fallback.
  preSearchState: { activeView: ActiveView; currentAppState: AppState } | null;

  openSearch: () => void;
  closeSearch: () => void;
  goToStep: (step: AccordionStep) => void;
  setDraftStatus: (status: PetStatus) => void;
  setDraftPetType: (petType: PetTypeFilter) => void;
  setDraftLocation: (location: LocationFilter | null) => void;
  selectDraftLocation: (location: LocationFilter) => void;
  setDraftTimeframe: (timeframe: TimeframeFilter) => void;
  clearDraftFilters: () => void;
  applyFilters: () => void;
  showAllResults: () => void;
  resetToMain: () => void;
  showProfile: () => void;
}

// Drives the three top-level screen states described in AppShell.tsx (STATE_A: main map view,
// STATE_B: the search wizard overlay, STATE_C: filtered results view) plus the wizard's own
// draft filter state. UI-only, like every other store in this app — it never touches the
// network; `usePets` (api/usePets.ts) still owns fetching, this only decides what to ask it
// for and how to describe that to the user. Deliberately separate from usePetMapStore, which
// owns pet *selection* and the results drawer's drag position — those change for unrelated
// reasons and neither store needs to know about the other.
export const useAppUIStore = create<AppUIState>((set, get) => ({
  activeView: 'feed',
  currentAppState: 'STATE_A',
  accordionStep: 1,
  draftStatus: 'missing',
  draftPetType: null,
  draftLocation: null,
  draftTimeframe: 'all',
  appliedFilters: EMPTY_FILTERS,
  preSearchState: null,

  openSearch: () => {
    const { appliedFilters, activeView, currentAppState } = get();
    set({
      activeView: 'map',
      currentAppState: 'STATE_B',
      accordionStep: 1,
      // Reopening from STATE_C (e.g. tapping the results search bar to adjust filters) seeds
      // the wizard with whatever's currently applied, so editing doesn't start from scratch.
      // draftStatus always needs a concrete value — appliedFilters.status's "show both" null
      // falls back to 'missing' rather than leaving the segmented control with nothing selected.
      draftStatus: appliedFilters.status ?? 'missing',
      draftPetType: appliedFilters.petType,
      draftLocation: appliedFilters.location,
      draftTimeframe: appliedFilters.timeframe,
      preSearchState: { activeView, currentAppState },
    });
  },

  closeSearch: () => {
    const { preSearchState } = get();
    set({
      activeView: preSearchState?.activeView ?? 'feed',
      currentAppState: preSearchState?.currentAppState ?? 'STATE_A',
      accordionStep: 1,
      preSearchState: null,
    });
  },

  goToStep: (step) => set({ accordionStep: step }),

  setDraftStatus: (status) => set({ draftStatus: status }),

  setDraftPetType: (petType) =>
    set((state) => ({
      draftPetType: petType,
      // Picking a type is Card 1's own committed choice — auto-advance to Card 2 so a one-tap
      // "just show me cats" search doesn't require also manually opening the location card.
      accordionStep: state.accordionStep === 1 ? 2 : state.accordionStep,
    })),

  setDraftLocation: (location) => set({ draftLocation: location }),

  // Distinct from setDraftLocation: only a suggestion tap (a recent search or the "W pobliżu"
  // GPS row in Card 2) counts as a committed choice that should auto-advance to Card 3 —
  // free-typed text (setDraftLocation, wired to the input's onChange) still updates the draft
  // on every keystroke but must never yank the user into Card 3 mid-type.
  selectDraftLocation: (location) =>
    set((state) => ({
      draftLocation: location,
      accordionStep: state.accordionStep === 2 ? 3 : state.accordionStep,
    })),

  setDraftTimeframe: (timeframe) => set({ draftTimeframe: timeframe }),

  // "Wyczyść wszystko" in the footer — resets the draft back to its opening defaults and
  // re-expands Card 1, but deliberately stays inside STATE_B (unlike closeSearch), since
  // clearing reads as "start this search over", not "cancel it".
  clearDraftFilters: () =>
    set({
      draftStatus: 'missing',
      draftPetType: null,
      draftLocation: null,
      draftTimeframe: 'all',
      accordionStep: 1,
    }),

  applyFilters: () => {
    const { draftStatus, draftPetType, draftLocation, draftTimeframe } = get();
    set({
      currentAppState: 'STATE_C',
      appliedFilters: { status: draftStatus, petType: draftPetType, location: draftLocation, timeframe: draftTimeframe },
    });
  },

  showAllResults: () => set({ activeView: 'map', currentAppState: 'STATE_C', appliedFilters: EMPTY_FILTERS }),

  // Used by both the map view's back button (ResultsTopBar.tsx) and BottomNav's "Lista" tab —
  // both mean the same thing: drop whatever map/filter state exists and go back to the pure
  // feed. See AppShell.tsx's handleBackToMain / runAction('list').
  resetToMain: () =>
    set({
      activeView: 'feed',
      currentAppState: 'STATE_A',
      appliedFilters: EMPTY_FILTERS,
      draftStatus: 'missing',
      draftPetType: null,
      draftLocation: null,
      draftTimeframe: 'all',
      preSearchState: null,
    }),

  showProfile: () => set({ activeView: 'profile' }),
}));
