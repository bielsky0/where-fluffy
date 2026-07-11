import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useMapPins } from '@/modules/map/api/useMapPins';
import { useFeedInfiniteBbox } from '@/modules/feed/api/useFeedInfiniteBbox';
import { useAppLocation } from '@/modules/location/api/useAppLocation';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';
import type { Bbox } from '@/shared/lib/bbox';
import type { BoundsRect, Coordinate } from '@/shared/components/map/types';
import { ErrorState } from '@/shared/components/ErrorState';
import { usePetMapStore } from '../store/usePetMapStore';
import { matchesPetType, PET_TYPE_LABELS_PLURAL } from '../lib/petType';
import { matchesTimeframe, TIMEFRAME_LABELS } from '../lib/timeframe';
import { FALLBACK_ORIGIN } from '@/shared/config/geo.config';
import { MapView } from '../components/MapView';
import { BottomSheet } from '../components/BottomSheet';
import { PetResultsList } from '../components/PetResultsList';
import { PetDetailPanel } from '../components/PetDetailPanel';
import { ResultsTopBar } from '../components/ResultsTopBar';
import { MapFabButton } from '../components/MapFabButton';
import { useAppUIStore } from '@/modules/app/store/useAppUIStore';
import { SearchBar } from '@/modules/app/components/SearchBar';
import { SearchModal } from '@/modules/app/components/SearchModal';
import { BOTTOM_NAV_CLEARANCE } from '@/modules/app/components/BottomNav';

// Leaflet's own `moveend` already fires only once per gesture (not per animation frame, see
// LeafletMap.tsx's BoundsTracker) — this debounce exists on top of that so a *sequence* of rapid
// gestures (flick-pan, flick-pan, flick-pan) collapses into one bbox-keyed fetch instead of one
// per gesture (CLAUDE.md's 60fps guide calls for 300-400ms here).
const BBOX_DEBOUNCE_MS = 350;

// Rough viewport half-extent in degrees, used only until the very first real `moveend` supplies
// Leaflet's own exact bounds — just enough that the map/drawer aren't empty on initial load.
const INITIAL_BBOX_DELTA_DEG = 0.05;

function deriveInitialBbox(center: { lat: number; lng: number }): Bbox {
  return {
    minLng: center.lng - INITIAL_BBOX_DELTA_DEG,
    minLat: center.lat - INITIAL_BBOX_DELTA_DEG,
    maxLng: center.lng + INITIAL_BBOX_DELTA_DEG,
    maxLat: center.lat + INITIAL_BBOX_DELTA_DEG,
  };
}

// Quick-filter pills in ResultsTopBar's sub-header row. Only 'reward' maps to a real field
// (Pet.reward) — 'large'/'photo' have no backing data (PetResponseDTO has no size or photo
// field, see PetCard.tsx's own comment on the placeholder image) so they toggle their pill's
// selected style without narrowing `filteredPets`, the same "don't fake a capability we don't
// have" stance already taken by add-listing-wizard/StepFork.tsx's disabled "Znalazłem" tile.
const QUICK_PILLS = [
  { id: 'reward', label: 'Z nagrodą' },
  { id: 'large', label: 'Duże psy' },
  { id: 'photo', label: 'Ze zdjęciem' },
] as const;

// Everything map-related lives here now — AppShell.tsx only knows this page exists as a whole,
// never what's happening inside it. `currentAppState` (STATE_A/B/C) and the search wizard's
// draft/applied filter state still physically live in useAppUIStore rather than local
// component state, because <SearchModal/> (Layer 2 below) is a sibling overlay that reads and
// writes that same wizard state — moving it to local state here would mean either lifting
// SearchModal inside this component's render (fine) or prop-drilling the whole wizard shape
// into it (worse). The encapsulation boundary that actually matters — AppShell never touching
// STATE_A/B/C — holds either way: this page and SearchModal are now the *only* two files in
// the app that read `currentAppState`.
//
// Three layers, per the map experience's own spec:
//   Layer 1 (background) — <MapView/>, always mounted while this page is.
//   Layer 2 (controls overlay) — SearchBar (STATE_A), ResultsTopBar (STATE_C), or SearchModal
//     (STATE_B), chosen strictly by currentAppState.
//   Layer 3 (results drawer) — <BottomSheet/>, only during STATE_C, itself choosing between
//     loading/error/<PetDetailPanel/>/<PetResultsList/>.
export function MapExplorerPage() {
  const currentAppState = useAppUIStore((state) => state.currentAppState);
  const appliedFilters = useAppUIStore((state) => state.appliedFilters);
  const openSearch = useAppUIStore((state) => state.openSearch);
  const resetToMain = useAppUIStore((state) => state.resetToMain);

  // The user's real position (GPS fix > GeoIP > static fallback, see useAppLocation's own
  // three-tier doc comment). Distance shown on PetCard must answer "how far is this pet from
  // me", not "how far is this pet from the point I searched"; those are the same value only when
  // the user searches their own location. Also feeds the one-shot auto-center effect below.
  const { origin: userOrigin } = useAppLocation();

  const hasAutoCenteredRef = useRef(false);
  const [resolvedOrigin, setResolvedOrigin] = useState<Coordinate | null>(null);

  // Auto-centers the map on the user's real location the first time it resolves beyond the
  // static fallback — but only if no explicit search-modal filter has been applied yet, since
  // that must keep taking priority. One-shot via hasAutoCenteredRef: later origin refinements
  // (e.g. geoip -> gps) shouldn't yank the map again once the user may have already panned it
  // themselves.
  useEffect(() => {
    if (appliedFilters.location) return;
    if (hasAutoCenteredRef.current) return;
    if (userOrigin.source === 'fallback') return;
    hasAutoCenteredRef.current = true;
    setResolvedOrigin(userOrigin);
  }, [userOrigin, appliedFilters.location]);

  // Query center follows, in priority order: an explicit search-modal location filter, then the
  // user's real resolved location (once available — see the auto-center effect above), then the
  // static fallback. Only the *initial* centering comes from userOrigin; once the user pans the
  // map or searches explicitly, this stops moving on its own.
  const queryCenter = appliedFilters.location?.coords ?? resolvedOrigin ?? FALLBACK_ORIGIN;

  // Dual-query architecture (CLAUDE.md): the map's pins (lightweight, unpaginated, drives
  // clustering) and the drawer's cards (heavy DTO, cursor-paginated) are two independent
  // bbox-keyed queries against two different endpoints, not one query feeding both — this is
  // what lets the drawer scroll/paginate without ever re-fetching or re-rendering the map's pins.
  const [bbox, setBbox] = useState<Bbox>(() => deriveInitialBbox(queryCenter));
  const handleBoundsChange = useDebouncedCallback((bounds: BoundsRect) => setBbox(bounds), BBOX_DEBOUNCE_MS);

  const { data: pins = [] } = useMapPins(bbox, appliedFilters.petType);
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useFeedInfiniteBbox(bbox, appliedFilters.petType);
  const feedPets = useMemo(() => feedData?.pages.flatMap((page) => page.items) ?? [], [feedData]);

  // BottomSheet's own content div is the real scroll/gesture container — PetResultsList's
  // virtualizer windows against it via this shared ref rather than owning a nested scroll
  // container (see BottomSheet.tsx's contentRef doc comment).
  const drawerContentRef = useRef<HTMLDivElement>(null);

  const selectedPetId = usePetMapStore((state) => state.selectedPetId);
  const selectPet = usePetMapStore((state) => state.selectPet);
  const clearSelection = usePetMapStore((state) => state.clearSelection);
  const sheetSnap = usePetMapStore((state) => state.sheetSnap);
  const setSheetSnap = usePetMapStore((state) => state.setSheetSnap);

  // ResultsTopBar's sub-header pills — see QUICK_PILLS' own comment on why only 'reward'
  // actually narrows results.
  const [activeQuickPills, setActiveQuickPills] = useState<ReadonlySet<string>>(new Set());
  const toggleQuickPill = (id: string) =>
    setActiveQuickPills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // category (appliedFilters.petType) is already applied server-side by both bbox queries above
  // — this only re-applies filters the backend doesn't support (status/timeframe/reward).
  const filteredPets = useMemo(() => {
    return feedPets.filter(
      (pet) =>
        matchesPetType(pet, appliedFilters.petType) &&
        (appliedFilters.status === null || pet.status === appliedFilters.status) &&
        matchesTimeframe(pet, appliedFilters.timeframe) &&
        (!activeQuickPills.has('reward') || pet.reward > 0),
    );
  }, [feedPets, appliedFilters.petType, appliedFilters.status, appliedFilters.timeframe, activeQuickPills]);

  // Looked up from whatever's currently loaded in the paginated feed — a pin the drawer hasn't
  // paginated to yet won't resolve here (no per-pet detail endpoint exists to fall back to), so
  // a click on such a pin is a silent no-op rather than opening PetDetailPanel with stale/no data.
  const selectedPet = filteredPets.find((pet) => pet.id === selectedPetId) ?? null;

  const resultsHeadline = appliedFilters.petType
    ? `${PET_TYPE_LABELS_PLURAL[appliedFilters.petType]} w okolicy`
    : 'Zwierzęta w okolicy';
  const resultsSubline =
    [appliedFilters.location?.label, appliedFilters.timeframe !== 'all' ? TIMEFRAME_LABELS[appliedFilters.timeframe] : null]
      .filter((part): part is string => Boolean(part))
      .join(' • ') || 'Cała okolica';

  const handleBackToMain = () => {
    resetToMain();
    clearSelection();
    setSheetSnap('collapsed');
  };

  return (
    <>
      {/* Layer 1: background */}
      <MapView
        pins={pins}
        center={queryCenter}
        selectedPetId={selectedPetId}
        onSelectPet={selectPet}
        onBoundsChange={handleBoundsChange}
      />

      {currentAppState !== 'STATE_B' && (
        <Link
          to="/app/chat"
          className="pointer-events-auto fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-[900] rounded-full bg-card/80 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur-md"
        >
          Chat
        </Link>
      )}

      {/* Layer 2: controls overlay */}
      {currentAppState === 'STATE_A' && <SearchBar onOpenSearch={openSearch} />}
      {currentAppState === 'STATE_C' && (
        <ResultsTopBar
          headline={resultsHeadline}
          subline={resultsSubline}
          sheetExpanded={sheetSnap === 'expanded'}
          onBack={handleBackToMain}
          onOpenSearch={openSearch}
          onCollapseSheet={() => setSheetSnap('half')}
          pills={QUICK_PILLS}
          activePillIds={activeQuickPills}
          onTogglePill={toggleQuickPill}
        />
      )}
      {currentAppState === 'STATE_B' && <SearchModal />}

      {/* Floating "Mapa" FAB — only at 'expanded', where the drawer covers ~95% of the
          viewport and leaves no other visible anchor back to the map (ResultsTopBar's own
          back/filter circles read as "back to results", not "show me the map"). Dropping one
          snap to 'half' (not all the way to 'collapsed') keeps the user in results context
          while still exposing most of the map. */}
      <AnimatePresence>
        {currentAppState === 'STATE_C' && sheetSnap === 'expanded' && (
          <MapFabButton onClick={() => setSheetSnap('half')} />
        )}
      </AnimatePresence>

      {/* Layer 3: results drawer — slides fully out of view while a pin selection drives Layer
          4's floating preview card instead (see BottomSheet's own `hidden` prop and Layer 4
          below); its own content keeps rendering underneath so reappearing is instant, not a
          re-fetch/re-mount. */}
      {currentAppState === 'STATE_C' && (
        <BottomSheet
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          resultCount={filteredPets.length}
          // AppShell.tsx slides BottomNav fully out of view while collapsed (see its own
          // `isBottomNavHidden`) — this must free up the clearance it was reserving at the
          // same moment, or the collapsed header would still stop short of the real screen
          // edge, leaving the exact gap the nav used to fill but now empty.
          bottomOffset={sheetSnap === 'collapsed' ? 0 : BOTTOM_NAV_CLEARANCE}
          hidden={selectedPet !== null}
          contentRef={drawerContentRef}
        >
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Ładowanie…</p>}
          {isError && (
            <ErrorState
              icon="📡"
              title="Ups! Coś poszło nie tak"
              message="Nie udało się wczytać zwierzaków w pobliżu."
              action={{ label: 'Spróbuj ponownie', onClick: refetch }}
            />
          )}
          {!isLoading && !isError && (
            <PetResultsList
              pets={filteredPets}
              origin={userOrigin}
              selectedPetId={selectedPetId}
              imageAspectClassName={sheetSnap === 'half' ? 'aspect-[16/9]' : undefined}
              scrollContainerRef={drawerContentRef}
              fetchNextPage={fetchNextPage}
              hasNextPage={hasNextPage ?? false}
              isFetchingNextPage={isFetchingNextPage}
            />
          )}
        </BottomSheet>
      )}

      {/* Layer 4: floating sighting preview card — a map pin tap (MapView's onSelectPet) is the
          only thing that ever mounts this; it's fully decoupled from currentAppState/sheetSnap,
          so it works the same whether the results drawer is present (STATE_C) or not. */}
      <AnimatePresence>
        {selectedPet && <PetDetailPanel key={selectedPet.id} pet={selectedPet} origin={userOrigin} onClose={clearSelection} />}
      </AnimatePresence>
    </>
  );
}
