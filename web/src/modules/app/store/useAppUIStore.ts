import { create } from 'zustand';
import type { PetTypeFilter } from '@/modules/pets/lib/petType';
import type { TimeframeFilter } from '@/modules/pets/lib/timeframe';
import type { PublicPetStatus } from '@/modules/pets/types/pet.types';

export type AppState = 'STATE_A' | 'STATE_B' | 'STATE_C';
// Which of the search modal's three accordion steps is currently expanded (SearchModal.tsx).
// Exactly one is always expanded — there's no 'root'/none state the way stack nav's root screen
// used to have — picking a collapsed pill just changes which step is expanded, and picking a
// value inside a step auto-advances this to the next one (see setDraftPetType/selectDraftLocation
// below); only timeframe (the last step) leaves it untouched after a pick.
export type AccordionStep = 'petType' | 'location' | 'timeframe';
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
  // Only set via the location drill-down's GPS row or a real Photon search result
  // (SearchModal.tsx's selectDraftLocation) — free-typed text is kept purely as a display label
  // (setDraftLocation) until the user commits to a geocoded result, since typing on every
  // keystroke has nothing worth geocoding yet.
  coords: { lat: number; lng: number } | null;
  // Populated when a selected Photon result has an `extent` (see backend's geocode.mapper.ts) —
  // null for GPS-sourced locations (which never had a bbox either) or point-feature results
  // Photon didn't return an extent for. Optional consumption hook for the map explorer to seed
  // its initial viewport from a geocoded area; not required to be read anywhere yet.
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  // Set only when this filter's location is genuinely "the user's own resolving location" (the
  // location step's GPS row, or the landing Hero's own-location search) — left undefined for a
  // manually-picked Photon result or a specific pet's location (PetDetailPage), where the label
  // is a deliberate, unchanging choice. Lets MapExplorerPage's header prefer the live, still-
  // resolving city name over this filter's own frozen `label` once it catches up (see
  // MapExplorerPage.tsx's resultsSubline) — without it, a header captured before the async city
  // lookup finishes stays stuck on a stale/generic label forever, even after the real one arrives.
  source?: 'gps';
}

export interface AppliedFilters {
  // `null` means "both" — the value showAllResults()/resetToMain() land on, so BottomNav's
  // "Lista" or tapping a card out of MainFeedPage's "found" carousel still shows every pet
  // regardless of status. Only applyFilters() (the search modal's "Szukaj" button) ever narrows
  // this to a single PetStatus, taken from the modal's own always-one-selected draftStatus
  // toggle.
  status: PublicPetStatus | null;
  petType: PetTypeFilter | null;
  location: LocationFilter | null;
  timeframe: TimeframeFilter;
}

const EMPTY_FILTERS: AppliedFilters = { status: null, petType: null, location: null, timeframe: 'all' };

interface AppUIState {
  activeView: ActiveView;
  currentAppState: AppState;
  expandedStep: AccordionStep;
  // "Draft" mirrors the wizard's in-progress choices; nothing here affects the map/results
  // until applyFilters() copies it into appliedFilters — so STATE_B can be backed out of
  // (closeSearch) without side effects on STATE_A/STATE_C. draftStatus has no "unset" value
  // (the header's segmented control always shows one segment selected), unlike
  // appliedFilters.status — 'both' is its own concrete segment here, not the absence of one.
  draftStatus: PublicPetStatus | 'both';
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
  expandStep: (step: AccordionStep) => void;
  setDraftStatus: (status: PublicPetStatus | 'both') => void;
  setDraftPetType: (petType: PetTypeFilter) => void;
  setDraftLocation: (location: LocationFilter | null) => void;
  selectDraftLocation: (location: LocationFilter) => void;
  setDraftTimeframe: (timeframe: TimeframeFilter) => void;
  clearDraftFilters: () => void;
  applyFilters: () => void;
  showAllResults: () => void;
  resetToMain: () => void;
  showProfile: () => void;
  openMapAt: (location: LocationFilter, status?: PublicPetStatus | null) => void;
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
  expandedStep: 'petType',
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
      // Always reopen on the first step — the collapsed pills already show each step's current
      // value at a glance, so there's no discoverability benefit to "smart resume on the first
      // empty step" logic, only extra state-shape complexity.
      expandedStep: 'petType',
      // Reopening from STATE_C (e.g. tapping the results search bar to adjust filters) seeds
      // the wizard with whatever's currently applied, so editing doesn't start from scratch.
      // appliedFilters.status's "show both" null becomes the draft's own concrete 'both' segment.
      draftStatus: appliedFilters.status === null ? 'both' : appliedFilters.status,
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
      expandedStep: 'petType',
      preSearchState: null,
    });
  },

  expandStep: (step) => set({ expandedStep: step }),

  setDraftStatus: (status) => set({ draftStatus: status }),

  // Picking a type auto-advances the accordion to the next step (Airbnb's own behavior) — the
  // old stack-nav guard (only pop back if this drill-down was the one open) is unreachable now
  // that these rows only render while petType is already the expanded step.
  setDraftPetType: (petType) => set({ draftPetType: petType, expandedStep: 'location' }),

  setDraftLocation: (location) => set({ draftLocation: location }),

  // Distinct from setDraftLocation: only a real commit (a tapped Photon result or the "W
  // pobliżu" GPS row) counts as a choice that should auto-advance — free-typed text
  // (setDraftLocation, wired to the input's onChange) still updates the draft on every
  // keystroke but must never yank the user out of the location step mid-type.
  selectDraftLocation: (location) => set({ draftLocation: location, expandedStep: 'timeframe' }),

  // Timeframe is the accordion's last step — unlike petType/location, picking a value here has
  // nothing further to auto-advance to, so expandedStep is left untouched (the card stays open,
  // showing the choice highlighted, until the user taps a different collapsed pill or Szukaj).
  setDraftTimeframe: (timeframe) => set({ draftTimeframe: timeframe }),

  // "Wyczyść wszystko" in the footer — resets the draft back to its opening defaults and
  // re-expands the first step, but deliberately stays inside STATE_B (unlike closeSearch),
  // since clearing reads as "start this search over", not "cancel it".
  clearDraftFilters: () =>
    set({
      draftStatus: 'missing',
      draftPetType: null,
      draftLocation: null,
      draftTimeframe: 'all',
      expandedStep: 'petType',
    }),

  applyFilters: () => {
    const { draftStatus, draftPetType, draftLocation, draftTimeframe } = get();
    set({
      currentAppState: 'STATE_C',
      appliedFilters: {
        status: draftStatus === 'both' ? null : draftStatus,
        petType: draftPetType,
        location: draftLocation,
        timeframe: draftTimeframe,
      },
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

  // Entry point for "open the full map centered on this one pet/location" (e.g. PetDetailPage's
  // mini-map tap, or the public landing Hero's search overlay) — lands straight on STATE_C
  // (results view) with a location (and optionally status) filter applied, same shape as
  // applyFilters()'s result but skipping the wizard entirely. `status` defaults to null ("both")
  // so PetDetailPage's existing single-arg call is unaffected.
  openMapAt: (location, status = null) =>
    set({ activeView: 'map', currentAppState: 'STATE_C', appliedFilters: { ...EMPTY_FILTERS, location, status } }),
}));
