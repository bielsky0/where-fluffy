import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePets } from '../api/usePets';
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

  // Query center follows the map's own applied location filter — deliberately independent of
  // MainFeedPage's own location (useAppLocation), so browsing the feed never depends on, or pays
  // for, anything the map wizard has done.
  const queryCenter = appliedFilters.location?.coords ?? FALLBACK_ORIGIN;
  const { data: pets, isLoading, isError } = usePets({ ...queryCenter, radius: 5000 });

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

  const filteredPets = useMemo(() => {
    if (!pets) return [];
    return pets.filter(
      (pet) =>
        matchesPetType(pet, appliedFilters.petType) &&
        (appliedFilters.status === null || pet.status === appliedFilters.status) &&
        matchesTimeframe(pet, appliedFilters.timeframe) &&
        (!activeQuickPills.has('reward') || pet.reward > 0),
    );
  }, [pets, appliedFilters.petType, appliedFilters.status, appliedFilters.timeframe, activeQuickPills]);

  const selectedPet = filteredPets.find((pet) => pet.id === selectedPetId) ?? null;

  //TODO infinity scroll list

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
      <MapView pets={filteredPets} center={queryCenter} selectedPetId={selectedPetId} onSelectPet={selectPet} />

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
        >
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Ładowanie…</p>}
          {isError && (
            <p className="py-8 text-center text-sm text-destructive">Nie udało się wczytać zwierzaków w pobliżu.</p>
          )}
          {!isLoading && !isError && (
            <PetResultsList
              pets={filteredPets}
              origin={queryCenter}
              selectedPetId={selectedPetId}
              imageAspectClassName={sheetSnap === 'half' ? 'aspect-[16/9]' : undefined}
            />
          )}
        </BottomSheet>
      )}

      {/* Layer 4: floating sighting preview card — a map pin tap (MapView's onSelectPet) is the
          only thing that ever mounts this; it's fully decoupled from currentAppState/sheetSnap,
          so it works the same whether the results drawer is present (STATE_C) or not. */}
      <AnimatePresence>
        {selectedPet && <PetDetailPanel key={selectedPet.id} pet={selectedPet} origin={queryCenter} onClose={clearSelection} />}
      </AnimatePresence>
    </>
  );
}
