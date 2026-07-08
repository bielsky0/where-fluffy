import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePets } from '@/modules/pets/api/usePets';
import { usePetFilterStore } from '@/modules/pets/store/usePetFilterStore';
import { usePetMapStore } from '@/modules/pets/store/usePetMapStore';
import { MapView } from '@/modules/pets/components/MapView';
import { BottomSheet } from '@/modules/pets/components/BottomSheet';
import { PetListPanel } from '@/modules/pets/components/PetListPanel';
import { PetDetailPanel } from '@/modules/pets/components/PetDetailPanel';
import { AddReportModal } from '@/modules/pets/components/AddReportModal';
import { AuthModal } from '@/modules/auth/components/AuthModal';
import { useAuthStore, type AttemptedAction } from '@/modules/auth/store/useAuthStore';
import { useSessionStore } from '@/modules/auth/store/useSessionStore';

// Placeholder origin for the nearby-search until real geolocation/map-driven search is wired up.
const DEFAULT_CENTER = { lat: 52.2297, lng: 21.0122 };
const ACTION_BAR_HEIGHT = 64;

type ActionId = 'quick-sighting' | 'add-report' | 'view-database';

// This module intentionally reaches into modules/pets (MapView, BottomSheet, its panels) —
// AppShell's whole job per this design is *to be* the pets-map experience, not just a layout
// wrapping one. That's a deliberate cross-module dependency (app -> pets), not an oversight:
// pets/chat/auth still never depend back on app or on each other.
//
// Routed directly at /app (see app/routes.tsx — no more nested <Outlet/>; chat moved to its
// own sibling route, reachable via the small chat link below rather than the old top nav,
// since the new 3-button action bar has no room for a 4th destination and the spec only
// called out these three).
//
// Ride-hailing-style layering: full-screen <MapView/> as the persistent backdrop, a draggable
// <BottomSheet/> overlay for list/detail content, and a fixed bottom action bar. The map is
// never conditionally rendered — only `usePetMapStore`'s selection state changes — so its
// pan/zoom survives every sheet/modal interaction (see MapView.tsx's own comment).
export default function AppShell() {
  const { data: pets, isLoading, isError } = usePets({ ...DEFAULT_CENTER, radius: 5000 });

  const statusFilter = usePetFilterStore((state) => state.statusFilter);
  const searchTerm = usePetFilterStore((state) => state.searchTerm);

  const selectedPetId = usePetMapStore((state) => state.selectedPetId);
  const selectPet = usePetMapStore((state) => state.selectPet);
  const clearSelection = usePetMapStore((state) => state.clearSelection);
  const sheetSnap = usePetMapStore((state) => state.sheetSnap);
  const setSheetSnap = usePetMapStore((state) => state.setSheetSnap);
  const isAddReportOpen = usePetMapStore((state) => state.isAddReportModalOpen);
  const openAddReport = usePetMapStore((state) => state.openAddReportModal);
  const closeAddReport = usePetMapStore((state) => state.closeAddReportModal);

  const currentUser = useSessionStore((state) => state.currentUser);
  const requestAuth = useAuthStore((state) => state.requestAuth);

  const filteredPets = useMemo(() => {
    if (!pets) return [];
    return pets.filter((pet) => {
      const matchesStatus = statusFilter === 'all' || pet.status === statusFilter;
      const matchesSearch = pet.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [pets, statusFilter, searchTerm]);

  const selectedPet = filteredPets.find((pet) => pet.id === selectedPetId) ?? null;

  // What each action-bar button actually does once a session exists. "Quick sighting" jumps
  // straight to "pick a pet, then log a sighting against it" — there's no pet-less/global
  // sighting endpoint on the backend (comments are always POSTed to /pets/:petId/comments), so
  // this is a shortcut into the existing pick-a-pet-then-add-sighting flow, not a separate
  // capability. "Baza" just expands the sheet to show the full list.
  const runAction = (action: ActionId) => {
    if (action === 'quick-sighting') {
      clearSelection();
      setSheetSnap('full');
    } else if (action === 'add-report') {
      openAddReport();
    } else if (action === 'view-database') {
      setSheetSnap('full');
    }
  };

  const handleActionBarClick = (action: ActionId) => {
    if (!currentUser) {
      requestAuth({ id: action });
      return;
    }
    runAction(action);
  };

  const handleAuthenticated = (attemptedAction: AttemptedAction | null) => {
    if (attemptedAction) runAction(attemptedAction.id as ActionId);
  };

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      <MapView
        pets={filteredPets}
        center={DEFAULT_CENTER}
        selectedPetId={selectedPetId}
        onSelectPet={selectPet}
      />

      <Link
        to="/app/chat"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 500,
          background: 'white',
          borderRadius: 999,
          padding: '8px 16px',
          textDecoration: 'none',
          color: 'inherit',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        Chat
      </Link>

      <BottomSheet snap={sheetSnap} onSnapChange={setSheetSnap} bottomOffset={ACTION_BAR_HEIGHT}>
        {isLoading && <p>Loading pets…</p>}
        {isError && <p>Could not load nearby pets.</p>}
        {!isLoading && !isError && selectedPet && (
          <PetDetailPanel pet={selectedPet} onBack={clearSelection} />
        )}
        {!isLoading && !isError && !selectedPet && (
          <PetListPanel pets={filteredPets} onSelectPet={selectPet} />
        )}
      </BottomSheet>

      <nav
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: ACTION_BAR_HEIGHT,
          zIndex: 1100,
          display: 'flex',
          background: 'white',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <button type="button" onClick={() => handleActionBarClick('quick-sighting')} style={{ flex: 1 }}>
          Szybkie widzenie
        </button>
        <button type="button" onClick={() => handleActionBarClick('add-report')} style={{ flex: 1 }}>
          Ogłoszenie
        </button>
        <button type="button" onClick={() => handleActionBarClick('view-database')} style={{ flex: 1 }}>
          Baza
        </button>
      </nav>

      {isAddReportOpen && <AddReportModal onClose={closeAddReport} />}
      <AuthModal onAuthenticated={handleAuthenticated} />
    </div>
  );
}
